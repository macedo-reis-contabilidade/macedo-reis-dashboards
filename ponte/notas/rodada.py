"""`py -3 -m ponte notas rodar` — a lista das empresas autorizadas, a janela, as consultas, os pacotes, o envio, o
estado e o log. Roda também no fim do `py -3 -m ponte rodar` (etapa()), no mesmo modo.

    --sem-enviar   pede a lista, lê e conta (todas as autorizadas, também as que não estão prontas) e não manda nem
                   grava o estado
    --saida        grava os pacotes num arquivo (sem pasta = na pasta da ponte; nunca no repositório: tem dado de cliente)
    --falso        a Domínio de mentira (falso.py); a lista vem do sistema, e só manda pra um sistema de mentira (local)
    --tudo         a janela inteira, de `desde`
    --empresa N    só esta empresa, se estiver na lista

A janela: na primeira vez de uma empresa (sem ela no estado) e aos domingos, de `desde` até hoje; nos outros dias, do dia
1º do mês de três meses atrás até hoje (a nota que entra atrasada na Domínio e o XML, que ela guarda uns dois meses) —
nunca antes de `desde`. Mês a mês, pela data de entrada.

O log, por empresa e pelo código (nunca o nome, a chave, um CNPJ, um produto ou um valor): as notas lidas, com o XML,
novas ou mudadas, mandadas, recusadas (o campo e o erro) e as de fora por motivo, e o tempo das consultas.

Código de saída: 0 (foi, ou nada a mandar, ou --sem-enviar) · 1 (a lista não veio, ou o envio não foi: vai na próxima
rodada) · 2 (configuração, chave recusada).
"""
import calendar
import datetime
import json
import os
import pathlib
import socket
import time
import traceback
import uuid

from .. import config, envio
from ..log import Registro
from . import VERSAO, estado as est_mod, pacote, sistema

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2


def hoje_local():
    bruto = os.environ.get('PONTE_HOJE')          # pros testes da janela
    if bruto:
        try:
            return datetime.date.fromisoformat(bruto)
        except ValueError:
            pass
    return datetime.date.today()


def agora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def inicio_da_janela(hoje, desde, primeira, tudo):
    if tudo or primeira or hoje.weekday() == 6:
        return desde
    ano, mes = hoje.year, hoje.month - 3
    if mes < 1:
        ano, mes = ano - 1, mes + 12
    return max(desde, datetime.date(ano, mes, 1))


def meses(ini, fim):
    """[(primeiro, último)] mês a mês, de ini a fim."""
    saida, d = [], ini
    while d <= fim:
        ultimo = datetime.date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])
        saida.append((d, min(ultimo, fim)))
        d = ultimo + datetime.timedelta(days=1)
    return saida


def _contar(contagem, chave, n=1):
    contagem[chave] = contagem.get(chave, 0) + n


def _texto_contagem(contagem, rotulos):
    return ', '.join(f'{n} {rotulos.get(k, k)}' for k, n in sorted(contagem.items(), key=lambda x: (-x[1], x[0])))


def ler_empresa(fonte, emp, ini, fim, est, reg):
    """As notas da empresa na janela: ([(nota, impressão, xml)], resumo)."""
    cod, doc = emp['codigo'], emp['documento']
    resumo = {'lidas': 0, 'com_xml': 0, 'fora': {}, 'avisos': {}, 'itens_fora': 0, 'iguais': 0, 'ja_xml': 0,
              'por_mes': {}, 'segundos': 0.0}
    novas = []
    for a, b in meses(ini, fim):
        t0 = time.monotonic()
        linhas = fonte.linhas(cod, a, b)
        xmls = fonte.xmls(cod, a, b)
        resumo['segundos'] += time.monotonic() - t0
        por_chave = {}
        for l in linhas:
            por_chave.setdefault(str(l.get('chave') or '').strip().upper(), []).append(l)
        mes = f'{a:%Y-%m}'
        no_mes = {'lidas': 0, 'com_xml': 0}
        for chave, ls in por_chave.items():
            resumo['lidas'] += 1
            no_mes['lidas'] += 1
            bruto = xmls.get(chave)
            nota, fora, avisos, itens_fora = pacote.montar_nota(ls, bruto, doc)
            for av in avisos:
                _contar(resumo['avisos'], av)
            if nota is None:
                _contar(resumo['fora'], fora.motivo if fora.motivo != 'fora_do_contrato' else f'fora_do_contrato:{fora.campo}')
                continue
            if nota['origem'] == 'xml':
                resumo['com_xml'] += 1
                no_mes['com_xml'] += 1
            resumo['itens_fora'] += itens_fora
            imp = pacote.impressao(nota, bruto if nota['origem'] == 'xml' else None)
            vai, porque = est.vai(cod, chave, imp, nota['origem'])
            if not vai:
                if porque == 'ja_foi_com_xml':
                    resumo['ja_xml'] += 1
                else:
                    resumo['iguais'] += 1
                continue
            novas.append((nota, imp))
        resumo['por_mes'][mes] = no_mes
    return novas, resumo


def mandar_empresa(env, emp, novas, rodada, est, reg, saidas):
    """Manda os pacotes da empresa, um de cada vez. (código, parar a rodada das notas)."""
    cod, doc = emp['codigo'], emp['documento']
    pacotes, grandes = pacote.dividir([n for n, _ in novas], {'codigo': cod, 'documento': doc}, rodada)
    if grandes:
        reg(f'notas {cod}: {len(grandes)} nota(s) grande(s) demais pra um pacote de 4 MB ficaram de fora', 'aviso')
    saidas.extend(pacotes)
    if env is None:
        return OK, False
    imp = {n['chave']: i for n, i in novas}
    mandadas = recusadas = 0
    for k, pac in enumerate(pacotes, 1):
        corpo = json.dumps(pac, ensure_ascii=False).encode('utf-8')
        r = env.mandar(corpo, f'notas {cod}: pacote {k} de {len(pacotes)} ({len(pac["notas"])} nota(s))')
        if r == envio.FOI:
            resp = env.ultima_resposta or {}
            est.marcar(cod, doc, [(n['chave'], n['entrada'], imp[n['chave']], n['origem']) for n in pac['notas']], agora())
            est.gravar()
            mandadas += len(pac['notas'])
            rec = [x for x in (resp.get('recusadas') or []) if isinstance(x, dict)]
            recusadas += len(rec)
            for x in rec[:30]:
                campo = str(x.get('campo') or '')[:120]
                erro = ' '.join(str(x.get('erro') or '').split())[:200]
                reg(f'notas {cod}: recusada — {campo}: {erro}', 'aviso')
            fora = resp.get('itens_fora')
            if isinstance(fora, int) and not isinstance(fora, bool) and fora > 0:
                reg(f'notas {cod}: o sistema tirou {fora} item(ns) que não eram de compra (deviam ter ficado na ponte)', 'aviso')
            continue
        if r == envio.RECUSADO:
            if env.ultimo_status == 401:
                return NAO_ADIANTA, True
            return NAO_ADIANTA, False              # 403, 422: esta empresa não repete; as outras seguem
        if r == envio.CONFIG:
            return NAO_ADIANTA, True
        return TENTAR_DE_NOVO, True                # o destino não configurado, a chave, o sistema fora: nada marcado
    reg(f'notas {cod}: {mandadas} mandada(s) em {len(pacotes)} pacote(s)'
        + (f', {recusadas} recusada(s) (ficam como mandadas: só vão de novo se mudarem)' if recusadas else ''))
    return OK, False


def rodar(sem_enviar=False, saida=None, falso=False, tudo=False, empresa=None, etapa=False, registro=None):
    base = config.pasta()
    cfg = config.carregar()
    reg = registro or Registro(base / 'logs', segredos=cfg.segredos())
    hoje = hoje_local()

    precisa = list(config.CAMPOS_SISTEMA) + ([] if falso else list(config.CAMPOS_DOMINIO))
    if not cfg.existe or cfg.erro_leitura or cfg.falta(precisa):
        falta = cfg.falta(precisa) if cfg.existe and not cfg.erro_leitura else ['config.ini']
        if etapa:
            reg('notas: a etapa das notas não roda (falta no config.ini: ' + ', '.join(falta) + ')')
            return OK
        reg('notas: a configuração não deixa rodar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    pode_mandar = not sem_enviar
    if falso and pode_mandar and not config.endereco_local(cfg.valor('sistema', 'url')):
        if etapa:
            reg('notas: com a Domínio de mentira, as notas só vão pra um sistema de mentira (endereço local): só conto')
            pode_mandar = False
        else:
            reg('notas: --falso só manda pra um sistema de mentira (endereço local); use --falso --sem-enviar', 'erro')
            return NAO_ADIANTA

    reg(f'notas: rodada {VERSAO}, {hoje:%d/%m/%Y}' + (' — Domínio de mentira' if falso else '')
        + ('' if pode_mandar else ' — sem enviar') + (' — a janela inteira' if tudo else ''))
    lista, status = sistema.pedir_autorizadas(cfg, reg)
    if lista is None:
        return NAO_ADIANTA if status in (401, 403) else TENTAR_DE_NOVO
    est = est_mod.Estado(base / 'notas', gravar=pode_mandar)
    if empresa is None and pode_mandar:
        saiu = est.manter_so([e['codigo'] for e in lista])
        if saiu:
            reg(f'notas: {saiu} empresa(s) que saíram da lista saíram do estado')
            est.gravar()
    if not lista:
        reg('notas: nenhuma empresa autorizada — nada a fazer')
        return OK
    escolhidas = lista
    if empresa is not None:
        escolhidas = [e for e in lista if e['codigo'] == empresa]
        if not escolhidas:
            reg(f'notas: a empresa {empresa} não está na lista das autorizadas', 'aviso')
            return OK
    if pode_mandar:
        nao_prontas = [e for e in escolhidas if not e['pronta']]
        if nao_prontas:
            reg(f'notas: {len(nao_prontas)} empresa(s) autorizada(s) sem o destino pronto ficam pra depois')
        escolhidas = [e for e in escolhidas if e['pronta']]
    reg(f'notas: {len(lista)} empresa(s) autorizada(s), {sum(1 for e in lista if e["pronta"])} pronta(s); '
        f'leio {len(escolhidas)}')
    if not escolhidas:
        return OK

    if falso:
        from .falso import FonteNotasFalsa
        fonte = FonteNotasFalsa()
    else:
        from .fonte import FonteNotasDominio
        fonte = FonteNotasDominio(cfg.valor('dominio', 'conexao'))
    env = None
    if pode_mandar:
        env = sistema.EnvioNotas(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                                 cfg.valor('sistema', 'chave_ponte'), reg)
    rodada = {'id': str(uuid.uuid4()), 'inicio': agora(), 'maquina': socket.gethostname()[:60], 'ponte': VERSAO}
    codigo, saidas, diferentes = OK, [], 0
    rotulos = dict(pacote.MOTIVOS, **pacote.AVISOS_XML)
    try:
        for emp in escolhidas:
            cod = emp['codigo']
            try:
                doc_dominio = pacote.documento(fonte.documento(cod))
            except Exception as e:
                reg(f'notas {cod}: a consulta do documento deu erro ({type(e).__name__})', 'erro')
                codigo = max(codigo, TENTAR_DE_NOVO)
                continue
            if doc_dominio != emp['documento']:
                diferentes += 1
                reg(f'notas {cod}: documento diferente do da Domínio — a empresa não é lida', 'aviso')
                continue
            primeira = not est.conhece(cod, emp['documento'])
            ini = inicio_da_janela(hoje, emp['desde'], primeira, tudo)
            if ini > hoje:
                reg(f'notas {cod}: a autorização começa depois de hoje — nada a ler')
                continue
            try:
                novas, r = ler_empresa(fonte, emp, ini, hoje, est, reg)
            except Exception as e:
                reg(f'notas {cod}: a leitura da Domínio deu erro ({type(e).__name__})', 'erro')
                codigo = max(codigo, TENTAR_DE_NOVO)
                continue
            mes = ', '.join(f'{m}: {v["lidas"]} ({v["com_xml"]} com XML)' for m, v in r['por_mes'].items())
            reg(f'notas {cod}: de {ini:%d/%m/%Y} a {hoje:%d/%m/%Y} — {r["lidas"]} lida(s), {r["com_xml"]} com XML, '
                f'{len(novas)} nova(s) ou mudada(s)' + (f', {r["iguais"]} já mandada(s) sem mudança' if r['iguais'] else '')
                + (f', {r["ja_xml"]} já mandada(s) com o XML' if r['ja_xml'] else '')
                + f'; consultas em {r["segundos"]:.1f} s')
            reg(f'notas {cod}: por mês — {mes}')
            if r['fora']:
                reg(f'notas {cod}: de fora — {_texto_contagem(r["fora"], rotulos)}')
            if r['avisos']:
                reg(f'notas {cod}: pela Domínio — {_texto_contagem(r["avisos"], rotulos)}')
            if r['itens_fora']:
                reg(f'notas {cod}: {r["itens_fora"]} item(ns) que não são de compra ficaram na ponte')
            if not novas:
                continue
            c, parar = mandar_empresa(env, emp, novas, rodada, est, reg, saidas)
            codigo = max(codigo, c)
            if parar:
                reg('notas: paro as notas nesta rodada — o que não foi vai na próxima', 'erro')
                break
    except Exception as e:
        # só o tipo e onde (a mensagem de um erro aqui pode trazer um valor de nota)
        onde = traceback.extract_tb(e.__traceback__)[-1]
        reg(f'notas: a rodada parou: {type(e).__name__} em {pathlib.Path(onde.filename).name}:{onde.lineno}', 'erro')
        codigo = max(codigo, TENTAR_DE_NOVO)
    finally:
        try:
            fonte.fechar()
        except Exception:
            pass
    if diferentes:
        reg(f'notas: {diferentes} empresa(s) com o documento diferente do da Domínio ficaram de fora', 'aviso')
    if saida:
        destino = pathlib.Path(saida)
        if not destino.is_absolute():
            destino = base / destino            # nunca na pasta de onde se roda (o repositório é público)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(json.dumps({'pacotes': saidas}, ensure_ascii=False), encoding='utf-8')
        reg(f'notas: {len(saidas)} pacote(s) gravado(s) em {destino}')
    if not pode_mandar:
        reg('notas: sem enviar — nada foi mandado nem gravado no estado')
    return codigo


def etapa(falso=False, sem_enviar=False, registro=None):
    """A etapa das notas no fim do `py -3 -m ponte rodar`: um erro aqui vai pro log e não muda a rodada dos totais."""
    try:
        rodar(sem_enviar=sem_enviar, falso=falso, etapa=True, registro=registro)
    except Exception as e:
        if registro is not None:
            registro(f'notas: a etapa das notas parou ({type(e).__name__}) — a rodada dos totais segue como foi', 'erro')
