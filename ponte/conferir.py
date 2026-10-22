"""`py -3 -m ponte conferir` — não grava nem manda dado nenhum. Mostra:

    o Python (versão e bits) · a configuração (de cada campo, só "preenchido", "falta" ou "ainda é o do exemplo") ·
    o IP de saída (só na tela) · os drivers ODBC que o Python enxerga · a conexão com o Domínio (abre e fecha) ·
    o ping pro sistema ({"versao": 1, "ping": true} — o sistema só responde, sem gravar)

Código de saída: 0 com a configuração completa; 1 quando falta alguma coisa nela.
O endereço que diz o IP pode ser trocado pela variável PONTE_IP_URL (é pros testes).
"""
import json
import os
import platform
import struct
import sys
import urllib.request

from . import VERSAO, config, envio
from .log import Registro

IP_URL = 'https://api.ipify.org'


def _ip_de_saida():
    try:
        with urllib.request.urlopen(os.environ.get('PONTE_IP_URL') or IP_URL, timeout=10) as r:
            return r.read(64).decode('ascii', 'replace').strip()
    except Exception as e:
        return f'não consegui descobrir ({type(e).__name__} — sem internet?)'


def conferir():
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())   # sem pasta: nada vai pra arquivo
    bits = struct.calcsize('P') * 8
    tela(f'Ponte do Domínio {VERSAO} — conferência (não grava nem manda dado nenhum)')
    tela('')
    tela(f'Python {platform.python_version()}, {bits} bits — {sys.executable}')
    if sys.version_info < (3, 11):
        tela('  ATENÇÃO: a ponte pede o Python 3.11 ou mais novo')

    # ---- configuração
    problemas = 0
    if not cfg.existe:
        tela(f'Configuração: não achei {cfg.arquivo}')
        tela('  copie o ponte/config.exemplo.ini pra lá e preencha (o LEIA-ME explica)')
        problemas += 1
    elif cfg.erro_leitura:
        tela(f'Configuração: achei {cfg.arquivo}, mas não consegui ler ({cfg.erro_leitura}) — confira o formato')
        problemas += 1
    else:
        tela(f'Configuração: {cfg.arquivo}')
    if cfg.existe and not cfg.erro_leitura:
        for secao, campo in config.CAMPOS:
            situacao = cfg.situacao(secao, campo)
            if situacao != 'preenchido':
                problemas += 1
            tela(f'  [{secao}] {campo}: {situacao}')
        meses, problema = cfg.meses()
        if problema:
            tela(f'  [rodada] meses: inválido — {problema}')
            problemas += 1
        else:
            tela('  [rodada] meses: ' + ('preenchido' if cfg.valor('rodada', 'meses') else f'em branco (usa {meses})'))

    # ---- IP de saída: só na tela
    tela(f'IP de saída: {_ip_de_saida()} (a Domínio libera o acesso só pro IP fixo do escritório)')

    # ---- drivers e conexão
    try:
        import pyodbc
    except ImportError:
        pyodbc = None
        tela('Drivers ODBC: o pyodbc não está instalado — instale com: py -3 -m pip install pyodbc')
    if pyodbc is not None:
        drivers = pyodbc.drivers()
        tela(f'Drivers ODBC que este Python ({bits} bits) enxerga: ' + (', '.join(drivers) if drivers else 'nenhum'))
        tela('  o driver da Domínio precisa ter os mesmos bits do Python')

    conexao = cfg.valor('dominio', 'conexao')
    if cfg.situacao('dominio', 'conexao') != 'preenchido':
        tela('Conexão com o Domínio: não testei (falta a [dominio] conexao)')
    elif pyodbc is None:
        tela('Conexão com o Domínio: não testei (falta o pyodbc)')
    else:
        from .fonte_dominio import abrir_odbc
        try:
            abrir_odbc(conexao).close()
            tela('Conexão com o Domínio: abriu e fechou')
        except Exception as e:
            tela(f'Conexão com o Domínio: não abriu — {type(e).__name__}: {e}')

    # ---- ping pro sistema
    falta_sistema = cfg.falta(config.CAMPOS_SISTEMA)
    if falta_sistema:
        tela('Sistema: não testei (falta ' + ', '.join(falta_sistema) + ')')
    else:
        env = envio.Envio(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                          cfg.valor('sistema', 'chave_ponte'), tela)
        corpo = json.dumps({'versao': 1, 'ping': True}).encode('utf-8')
        resultado, status, detalhe = env.uma_vez(corpo)
        if resultado == envio.FOI:
            tela(f'Sistema: respondeu ao ping (HTTP {status})')
        elif status == 404:
            tela('Sistema: função do sistema ainda não publicada (HTTP 404) — normal até o sistema ficar pronto')
        elif status in (401, 403):
            tela(f'Sistema: a chave foi recusada (HTTP {status}) — confira a chave_publica e a chave_ponte')
        elif status:
            tela(f'Sistema: respondeu HTTP {status}' + (f' — {detalhe}' if detalhe else ''))
        else:
            tela(f'Sistema: sem resposta ({detalhe})')

    tela('')
    tela('Tudo certo na configuração.' if not problemas else f'{problemas} coisa(s) a acertar na configuração.')
    return 0 if not problemas else 1
