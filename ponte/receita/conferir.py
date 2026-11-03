"""`py -3 -m ponte receita conferir` — não grava nem manda dado nenhum. Mostra:

    o cryptography e o pypdf (instalados?) · a seção [integra] (de cada campo, só "preenchido", "falta", "ainda é o do
    exemplo" ou "inválido (o porquê)") · a impressão digital da chave da ponte (o SHA-256 que o sistema guarda — não é
    segredo; a chave nunca aparece) · o certificado do escritório (o titular e quantos dias faltam pra vencer —
    vencido ou a menos de 30 dias, em destaque) · a conexão com o Serpro (o certificado dele confere com o
    ac-serpro-2025.pem) · o token (em produção, pede um e diz "ok" ou o erro, sem mostrar o token; em demonstração,
    "demonstração") · o procurador (opcional: os três campos, o titular e a validade do e-CPF dele, se ele é do CPF
    configurado e, em produção, o token dele — manda o termo de autorização assinado, que não tem dado de cliente, e diz
    "ok" ou a recusa do Serpro) · o ping pro sistema, como no conferir do Domínio, com a mensagem da função como veio
    (o 503 da chave ainda não cadastrada, o 401 da chave recusada)

Código de saída: 0 com a configuração completa pro ambiente do config.ini; 1 quando falta alguma coisa.
"""
import datetime
import json
import re

from .. import config, envio
from ..chave import RECADO, impressao
from ..log import Registro
from . import VERSAO, procurador as proc_mod, serpro, sistema
from .rodada import hoje_local

AVISO_DIAS = 30


def _instalado(nome):
    try:
        __import__(nome)
        return True
    except ImportError:
        return False


def conferir():
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())   # sem pasta: nada vai pra arquivo
    tela(f'Ponte da Receita {VERSAO} — conferência (não grava nem manda dado nenhum)')
    tela('')
    problemas = 0

    faltam = [n for n in ('cryptography', 'pypdf') if not _instalado(n)]
    if faltam:
        tela(f"Bibliotecas: falta {' e '.join(faltam)} — instale com: py -3 -m pip install cryptography pypdf")
        problemas += 1
    else:
        tela('Bibliotecas: cryptography e pypdf instalados')

    # ---- configuração
    if not cfg.existe:
        tela(f'Configuração: não achei {cfg.arquivo}')
        tela('  copie o ponte/config.exemplo.ini pra lá e preencha (o LEIA-ME explica)')
        tela('')
        tela('1 coisa(s) a acertar na configuração.')
        return 1
    if cfg.erro_leitura:
        tela(f'Configuração: achei {cfg.arquivo}, mas não consegui ler ({cfg.erro_leitura}) — confira o formato')
        tela('')
        tela('1 coisa(s) a acertar na configuração.')
        return 1
    tela(f'Configuração: {cfg.arquivo}')
    ambiente = cfg.ambiente_integra()
    if ambiente not in ('demonstracao', 'producao'):
        ambiente = None
    exigidos = set(cfg.campos_integra(ambiente)) if ambiente else set(config.CAMPOS_INTEGRA)
    for secao, campo in config.CAMPOS_INTEGRA:
        situacao = cfg.situacao(secao, campo)
        if campo == 'cnpj_escritorio' and situacao == 'preenchido' and \
                not config.documento_valido(re.sub(r'[./\s-]', '', cfg.valor(secao, campo)).upper()):
            situacao = 'inválido (o dígito verificador não confere)'
        exigido = (secao, campo) in exigidos
        if ambiente == 'demonstracao' and campo == 'cnpj_escritorio' and situacao != 'falta':
            ok = True                                    # na demonstração vale o do exemplo
        else:
            ok = situacao == 'preenchido' or not exigido
        if not ok:
            problemas += 1
        nota = '' if exigido or situacao == 'preenchido' else ' (em demonstração não precisa)'
        tela(f'  [{secao}] {campo}: {situacao}{nota}')
    teto, problema = cfg.teto()
    if problema:
        tela(f'  [integra] teto_mes: inválido — {problema}')
        problemas += 1
    else:
        tela('  [integra] teto_mes: ' + ('preenchido' if cfg.valor('integra', 'teto_mes') else
                                         f'em branco (usa {config.TETO_PADRAO})') + f' — {teto} chamadas por mês')
    proc, problema_proc = cfg.procurador()
    if proc is None and problema_proc is None:
        tela('  [integra] procurador_cpf, procurador_certificado, procurador_senha: em branco (o procurador é opcional — '
             'o LEIA-ME explica)')
    else:
        for secao, campo in config.CAMPOS_PROCURADOR:
            tela(f'  [{secao}] {campo}: {cfg.situacao(secao, campo)}')
        if problema_proc:
            problemas += 1
    for secao, campo in config.CAMPOS_SISTEMA:
        situacao = cfg.situacao(secao, campo)
        if situacao != 'preenchido':
            problemas += 1
        tela(f'  [{secao}] {campo}: {situacao}')
    if cfg.situacao('sistema', 'chave_ponte') == 'preenchido':
        tela(f"Chave da ponte: impressão digital {impressao(cfg.valor('sistema', 'chave_ponte'))}")
        tela('  é o que o sistema confere (não é segredo); a chave mesmo nunca sai deste PC')
    else:
        tela('Chave da ponte: ainda não há — gere com py -3 -m ponte chave (mostra a impressão digital)')
    tela('Ambiente: ' + {'demonstracao': 'demonstração (o Serpro responde exemplos fixos, sem custo)',
                         'producao': 'produção (o Integra Contador de verdade, com o contrato)',
                         None: 'inválido — o [integra] ambiente tem que ser demonstracao ou producao'}[ambiente])

    # ---- o certificado do escritório
    cert_ok = False
    pfx, senha = cfg.valor('integra', 'certificado'), cfg.valor('integra', 'senha_certificado')
    if cfg.situacao('integra', 'certificado') != 'preenchido' or cfg.situacao('integra', 'senha_certificado') != 'preenchido':
        tela('Certificado: não abri (falta o caminho do .pfx ou a senha)'
             + (' — em demonstração não precisa' if ambiente == 'demonstracao' else ''))
    elif 'cryptography' in faltam:
        tela('Certificado: não abri (falta o cryptography)')
    else:
        try:
            titular, vence = serpro.ler_certificado(pfx, senha)
            dias = (vence.date() - datetime.datetime.now(datetime.timezone.utc).date()).days
            if dias < 0:
                tela(f'Certificado: {titular} — ATENÇÃO: VENCIDO há {-dias} dia(s)')
                if ambiente == 'producao':
                    problemas += 1
            elif dias < AVISO_DIAS:
                tela(f'Certificado: {titular} — ATENÇÃO: vence em {dias} dia(s); renove antes')
                cert_ok = True
            else:
                tela(f'Certificado: {titular} — vence em {dias} dias')
                cert_ok = True
        except serpro.ErroConfig as e:
            tela(f'Certificado: {e}')
            if ambiente == 'producao':
                problemas += 1

    # ---- o e-CPF do procurador (opcional)
    proc_cert_ok = False
    if proc:
        if 'cryptography' in faltam:
            tela('Procurador: não abri o e-CPF (falta o cryptography)')
        else:
            try:
                _, cert_p, _ = serpro._abrir(proc['certificado'], proc['senha'])
                if cert_p is None:
                    raise serpro.ErroConfig('o .pfx não tem certificado dentro')
                nome, numero = proc_mod.nome_e_documento(cert_p)
                dias = (cert_p.not_valid_after_utc.date() - datetime.datetime.now(datetime.timezone.utc).date()).days
                if numero and numero != proc['cpf']:
                    tela(f'Procurador: {nome} — ATENÇÃO: o e-CPF é de outro CPF (não o do procurador_cpf)')
                    problemas += 1
                elif dias < 0:
                    tela(f'Procurador: {nome} — ATENÇÃO: o e-CPF VENCEU há {-dias} dia(s)')
                    problemas += 1
                elif dias < AVISO_DIAS:
                    tela(f'Procurador: {nome} — o e-CPF é do procurador_cpf — ATENÇÃO: vence em {dias} dia(s); '
                         f'renove antes')
                    proc_cert_ok = True
                else:
                    tela(f'Procurador: {nome} — o e-CPF é do procurador_cpf e vence em {dias} dias'
                         if numero else f'Procurador: {nome} — o e-CPF vence em {dias} dias')
                    proc_cert_ok = True
                if not numero:
                    tela('  não achei o CPF no nome do certificado: quem confere se é o do procurador_cpf é o Serpro, '
                         'no token do procurador')
            except serpro.ErroConfig as e:
                tela(f'Procurador: o e-CPF não abriu — {e}')
                problemas += 1

    # ---- a conexão com o Serpro (só abre e fecha; nenhum pedido)
    gateway = serpro.gateway_de(ambiente or 'producao')
    problema = serpro.conferir_tls(gateway)
    tela('Conexão com o Serpro: ' + (problema or ('o certificado do gateway confere' if gateway.startswith('https://')
                                                    else 'endereço de teste')))

    # ---- o token (e o do procurador)
    cli = None
    if ambiente == 'demonstracao':
        tela('Token: demonstração (o token público do ambiente de demonstração)')
        if proc:
            tela('Token do procurador: só em produção (a demonstração não tem o procurador)')
    elif ambiente == 'producao':
        falta = cfg.falta(config.CAMPOS_INTEGRA)
        if falta or not cert_ok:
            tela('Token: não pedi (a [integra] ou o certificado não estão prontos)')
        else:
            reg = Registro(None, segredos=cfg.segredos())
            cli = serpro.Cliente('producao', cfg.valor('integra', 'cnpj_escritorio'), reg, _SemContar(),
                                 config.pasta() / 'receita' / 'tmp', consumer_key=cfg.valor('integra', 'consumer_key'),
                                 consumer_secret=cfg.valor('integra', 'consumer_secret'), certificado=pfx,
                                 senha_certificado=senha, procurador=proc, hoje=hoje_local())
            try:
                cli.token()
                tela('Token: ok')
            except (serpro.ErroConfig, serpro.SerproFora) as e:
                tela(f'Token: {e}')
                problemas += 1
                cli = None
        if proc:
            if cli is None or not proc_cert_ok:
                tela('Token do procurador: não pedi (o token do escritório ou o e-CPF do procurador não estão prontos)')
            else:
                try:
                    cli.token_procurador()
                    tela('Token do procurador: ok')
                except (serpro.ProcuradorIndisponivel, serpro.ErroConfig, serpro.SerproFora) as e:
                    tela(f'Token do procurador: {e}')
                    problemas += 1

    # ---- ping pro sistema (como no conferir do Domínio)
    falta_sistema = cfg.falta(config.CAMPOS_SISTEMA)
    if falta_sistema:
        tela('Sistema: não testei (falta ' + ', '.join(falta_sistema) + ')')
    else:
        env = sistema.EnvioReceita(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                                   cfg.valor('sistema', 'chave_ponte'), tela)
        resultado, status, detalhe = env.uma_vez(json.dumps({'versao': 1, 'ping': True}).encode('utf-8'))
        if resultado == envio.FOI:
            tela(f'Sistema: respondeu ao ping (HTTP {status})')
        elif resultado == envio.CONFIG:
            tela(f'Sistema: {detalhe}' + (f' (HTTP {status})' if status else ''))
        elif status == 404:
            tela('Sistema: função do sistema ainda não publicada (HTTP 404) — normal até o sistema ficar pronto')
        elif sistema.sem_chave(status, detalhe):
            tela(f'Sistema: {detalhe} (HTTP {status})')
            tela(f'  {RECADO}')
        elif status in (401, 403):
            tela(f'Sistema: {detalhe or "a chave foi recusada"} (HTTP {status}) — a chave_ponte deste PC não é a que o '
                 f'sistema tem (confira a impressão digital acima) ou a chave_publica está errada')
        elif status:
            tela(f'Sistema: respondeu HTTP {status}' + (f' — {detalhe}' if detalhe else ''))
        else:
            tela(f'Sistema: sem resposta ({detalhe})')

    tela('')
    tela('Tudo certo na configuração.' if not problemas else f'{problemas} coisa(s) a acertar na configuração.')
    return 0 if not problemas else 1


class _SemContar:
    """O conferir não conta no teto (o token nem é uma consulta)."""
    teto = 0

    def somar(self, servico):
        pass

    def acabou(self):
        return False

    def total(self):
        return 0
