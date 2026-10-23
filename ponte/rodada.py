"""`py -3 -m ponte rodar` — lê, monta, manda, registra.

Código de saída:
    0  mandou (ou não tinha o que mandar, ou foi --sem-enviar)
    1  não conseguiu mandar (ou ler o Domínio) e guardou pra mandar na próxima
    2  o sistema recusou, ou a configuração não deixa rodar — repetir do mesmo jeito não adianta
"""
import json
import pathlib
import traceback

from . import VERSAO, config, envio, pacote
from .log import Registro

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2


def rodar(falso=False, sem_enviar=False, saida=None, meses=None):
    base = config.pasta()
    cfg = config.carregar()
    reg = Registro(base / 'logs', segredos=cfg.segredos())
    reg.limpar_antigos()

    # ---- o que a configuração precisa ter pra esta rodada
    precisa = []
    if not falso:
        precisa += config.CAMPOS_DOMINIO
    if not sem_enviar:
        precisa += config.CAMPOS_SISTEMA
    if precisa and not cfg.existe:
        reg(f'não achei {cfg.arquivo} — copie o ponte/config.exemplo.ini pra lá e preencha', 'erro')
        return NAO_ADIANTA
    if precisa and cfg.erro_leitura:
        reg(f'não consegui ler {cfg.arquivo} ({cfg.erro_leitura}) — confira o formato com o config.exemplo.ini', 'erro')
        return NAO_ADIANTA
    falta = cfg.falta(precisa)
    if falta:
        reg('a configuração não deixa rodar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    if falso and not sem_enviar and not config.endereco_local(cfg.valor('sistema', 'url')):
        # o Domínio de mentira nunca manda empresa inventada pro sistema de verdade
        reg('--falso só manda pra um sistema de mentira (endereço local); use --falso --sem-enviar', 'erro')
        return NAO_ADIANTA
    if meses is None:
        meses, problema = cfg.meses()
        if problema:
            reg(problema, 'aviso')

    inicio = pacote.agora()
    reg(f'rodada da ponte {VERSAO}: {meses} mes(es), dados até {pacote.ontem():%d/%m/%Y}'
        + (' — Domínio de mentira' if falso else '') + (' — sem enviar' if sem_enviar else ''))

    # ---- lê e monta
    if falso:
        from .fonte_falsa import FonteFalsa
        fonte = FonteFalsa()
    else:
        from .fonte_dominio import FonteDominio
        fonte = FonteDominio(cfg.valor('dominio', 'conexao'))
    try:
        pac = pacote.montar(fonte, meses, reg, inicio=inicio)
    except pacote.SemEmpresas:
        reg('a consulta de empresas ainda está "A CONFERIR" (falta a documentação da Domínio): nada a mandar', 'aviso')
        return OK
    except Exception as e:
        reg(f'não consegui ler o Domínio: {type(e).__name__}: {e}', 'erro')
        reg(traceback.format_exc().rstrip(), 'erro')
        return TENTAR_DE_NOVO
    finally:
        try:
            fonte.fechar()
        except Exception:
            pass

    reg('lido: ' + pacote.resumo(pac))
    corpo = json.dumps(pac, ensure_ascii=False).encode('utf-8')
    if saida:
        # caminho solto vai pra pasta da ponte, nunca pra pasta de onde se roda: o pacote de verdade tem nome e CNPJ
        # dos clientes, e rodado da pasta do repositório (que é público) ele cairia lá dentro
        destino = pathlib.Path(saida)
        if not destino.is_absolute():
            destino = base / destino
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(json.dumps(pac, ensure_ascii=False, indent=1).encode('utf-8'))
        reg(f'pacote gravado em {destino}')
    if sem_enviar:
        reg('--sem-enviar: nada foi mandado')
        return OK

    env = envio.Envio(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                      cfg.valor('sistema', 'chave_ponte'), reg)
    if falso:
        # o Domínio de mentira não toca nos pendentes: nem manda os de verdade pro sistema de mentira, nem deixa
        # pacote de empresa inventada na fila que a rodada de verdade manda
        r = env.mandar(corpo, f'rodada {pac["rodada"]["id"][:8]} (Domínio de mentira)')
        if r == envio.FOI:
            return OK
        if r == envio.FALHOU:
            reg('com --falso nada é guardado em pendentes', 'aviso')
            return TENTAR_DE_NOVO
        return NAO_ADIANTA

    # ---- manda: primeiro os pendentes, do mais velho pro mais novo; depois o desta rodada
    pasta_pend = base / 'pendentes'
    envio.apagar_velhos(pasta_pend, reg)
    codigo = OK
    for arq in envio.listar(pasta_pend):
        r = env.mandar(arq.read_bytes(), f'pendente {arq.name}')
        if r == envio.FOI:
            arq.unlink()
            continue
        if r == envio.CONFIG:
            reg('paro aqui — os pendentes ficam guardados pra quando o config.ini for acertado', 'erro')
            return NAO_ADIANTA
        if r == envio.RECUSADO:
            if env.ultimo_status in (401, 403):
                reg('a chave foi recusada: paro aqui — os pendentes ficam guardados pra quando a chave for corrigida', 'erro')
                return NAO_ADIANTA
            arq.unlink()
            reg(f'pendente {arq.name} recusado pelo sistema e apagado (repetir não adianta)', 'erro')
            codigo = NAO_ADIANTA
            continue
        guardado = envio.guardar(pasta_pend, pac)
        reg(f'o sistema não respondeu: a rodada de hoje ficou guardada em pendentes\\{guardado.name}', 'erro')
        return TENTAR_DE_NOVO

    r = env.mandar(corpo, f'rodada {pac["rodada"]["id"][:8]}')
    if r == envio.FOI:
        return codigo
    if r in (envio.RECUSADO, envio.CONFIG):
        return NAO_ADIANTA
    guardado = envio.guardar(pasta_pend, pac)
    reg(f'guardei em pendentes\\{guardado.name} pra mandar na próxima rodada', 'erro')
    return TENTAR_DE_NOVO
