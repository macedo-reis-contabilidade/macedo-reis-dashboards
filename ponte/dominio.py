"""`py -3 -m ponte dominio conexao | tabelas | sql` — a ligação com o banco do Domínio Web (29/10/2026).

A Domínio liberou o banco do Domínio Web pro IP fixo do escritório e mandou, no chamado, onde ele fica: o host, a
porta, o nome do servidor (o "Engine") e o do banco. O usuário é o "externo", que o escritório cria no próprio Domínio
com um usuário GERENTE (Controle › Permissões › Usuários › Novo › Tipo de acesso: Externo) — só de leitura.

    conexao [--esperar]
        Pergunta o host, a porta, o servidor, o banco, o usuário e a senha (a senha sem aparecer, duas vezes), monta a
        string ODBC do SQL Anywhere com o driver que este Python enxerga, grava no [dominio] conexao do config.ini (só
        essa linha) e testa: abre, diz a versão do servidor e quantas tabelas o usuário vê. Quem digita é o Samuel,
        nesta janela: nada passa por chat. Sem uma janela que aceite digitação (o terminal do pedreiro), não pergunta
        nada e diz como abrir uma. --esperar: no fim, espera o Enter (a janela não fecha antes de ele ler).
    tabelas [--procurar termo] [--saida arquivo.txt]
        O catálogo do banco: as tabelas e as colunas, o tipo, a descrição que o banco guarda e quantas linhas cada
        tabela tem. NENHUM dado das tabelas: só o catálogo (SYS). Grava em C:\\ponte-dominio\\dominio-tabelas.txt (nunca
        no repositório, que é público) e, com --procurar, mostra as tabelas e as colunas cujo nome ou descrição tem o
        termo — o "Busca Tabelas" do Domínio, aqui.
    sql "SELECT …" | --arquivo consulta.sql [--mes AAAA-MM] [--linhas N]
        Roda UMA consulta só de leitura (SELECT ou WITH) e mostra até 50 linhas — pra escrever as consultas da ponte.
        Só contagem e soma por empresa: nunca nome, documento pessoal, salário, endereço ou contato de funcionário. A
        trava (pra engano, não pra quem quer burlar): resultado com coluna desse tipo não é mostrado. --mes passa o
        primeiro e o último dia do mês nos dois ? da consulta, como a rodada faz.

Código de saída: 0 deu certo; 1 a conexão não abriu ou a consulta deu erro no banco; 2 nada feito (falta o config.ini,
o pyodbc ou o driver; o que foi digitado não serve; a consulta não é só de leitura ou traria dado pessoal).
"""
import datetime
import getpass
import pathlib
import re
import struct
import sys
import time
import unicodedata

from . import config
from .chave import gravar_campo
from .fonte_dominio import abrir_odbc, limites_do_mes
from .log import Registro

OK, NAO_ABRIU, NADA_FEITO = 0, 1, 2
ARQUIVO_TABELAS = 'dominio-tabelas.txt'
LINHAS_PADRAO, LINHAS_MAX = 50, 500
MOSTRAR_MAX = 300                  # linhas do --procurar na tela; o resto está no arquivo
PROIBIDOS = set(';{}"\'')          # quebram a string de conexão ODBC
DONOS_DO_SISTEMA = {'SYS', 'DBO', 'RS_SYSTABGROUP', 'SA_DEBUG', 'DIAGNOSTICS', 'PUBLIC'}

_HOST = re.compile(r'[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?')
_NOME = re.compile(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}')

# o catálogo muda de nome entre as versões do SQL Anywhere: cada item tem mais de um jeito, e vale o primeiro que o
# banco aceitar — todos devolvem as mesmas colunas
SQL_VERSAO = ('SELECT @@version AS versao',)
SQL_DONOS = ('SELECT creator AS dono, COUNT(*) AS tabelas FROM SYS.SYSCATALOG GROUP BY creator',
             'SELECT USER_NAME(creator) AS dono, COUNT(*) AS tabelas FROM SYS.SYSTAB GROUP BY creator')
SQL_TABELAS = (
    'SELECT creator AS dono, tname AS tabela, tabletype AS tipo, remarks AS descricao FROM SYS.SYSCATALOG',
    'SELECT USER_NAME(t.creator) AS dono, t.table_name AS tabela, t.table_type_str AS tipo, r.remarks AS descricao '
    'FROM SYS.SYSTAB t LEFT OUTER JOIN SYS.SYSREMARK r ON r.object_id = t.object_id',
)
SQL_COLUNAS = (
    'SELECT creator AS dono, tname AS tabela, colno AS ordem, cname AS coluna, coltype AS tipo, length AS tamanho, '
    'syslength AS escala, nulls AS nulos, in_primary_key AS chave, remarks AS descricao FROM SYS.SYSCOLUMNS',
    'SELECT USER_NAME(t.creator) AS dono, t.table_name AS tabela, c.column_id AS ordem, c.column_name AS coluna, '
    'd.domain_name AS tipo, c.width AS tamanho, c.scale AS escala, c.nulls AS nulos, NULL AS chave, '
    'r.remarks AS descricao FROM SYS.SYSTABCOL c JOIN SYS.SYSTAB t ON t.table_id = c.table_id '
    'JOIN SYS.SYSDOMAIN d ON d.domain_id = c.domain_id LEFT OUTER JOIN SYS.SYSREMARK r ON r.object_id = c.object_id',
)
SQL_LINHAS = ('SELECT USER_NAME(creator) AS dono, table_name AS tabela, "count" AS linhas FROM SYS.SYSTAB',
              'SELECT USER_NAME(creator) AS dono, table_name AS tabela, "count" AS linhas FROM SYS.SYSTABLE')

# a trava do `sql`: coluna de resultado com um destes nomes (sem acento, em minúsculas, pedaço a pedaço) não é mostrada
PESSOAIS_EXATOS = {'cpf', 'rg', 'pis', 'nit', 'nis', 'ctps', 'cnh', 'cep', 'mae', 'pai', 'sus', 'mail'}
PESSOAIS_COMECO = ('nome', 'cpf', 'salar', 'remuner', 'nasc', 'ender', 'logra', 'bairro', 'email', 'fone', 'telef',
                   'celul', 'conjug', 'apelid')
_COMENTARIO = re.compile(r'--[^\n]*|/\*.*?\*/', re.S)
_TEXTO_SQL = re.compile(r"'(?:[^']|'')*'")
_NAO_LEITURA = re.compile(r'\b(INTO|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|EXEC|EXECUTE|'
                          r'TRUNCATE|LOAD|UNLOAD|OUTPUT|COMMIT|ROLLBACK|SET)\b', re.I)


# ---------------------------------------------------------------- pedaços puros (os testes usam)

def driver_sql_anywhere(drivers):
    """O driver do SQL Anywhere mais novo da lista ('SQL Anywhere 17'), ou None."""
    achados = []
    for d in drivers or ():
        m = re.fullmatch(r'\s*SQL Anywhere (\d+)\s*', str(d))
        if m:
            achados.append((int(m.group(1)), str(d).strip()))
    return max(achados)[1] if achados else None


def montar_conexao(driver, host, porta, servidor, banco, usuario, senha):
    """A string ODBC do SQL Anywhere: o servidor pelo nome e pelo endereço (Host=ip:porta), o banco pelo nome. O texto
    vem em UTF-8 (CharSet) — e a ponte ainda pede ao driver o texto já convertido (abrir_odbc)."""
    return (f'DRIVER={{{driver}}};UID={usuario};PWD={senha};ServerName={servidor};DatabaseName={banco};'
            f'Host={host}:{porta};CharSet=UTF-8')


def problema_do_host(v):
    return None if _HOST.fullmatch(v) else 'só letras, números, ponto e hífen — o IP ou o nome, sem http:// e sem espaço'


def problema_da_porta(v):
    return None if v.isdigit() and 1 <= int(v) <= 65535 else 'tem que ser um número de 1 a 65535'


def problema_do_nome(v):
    return None if _NOME.fullmatch(v) else 'só letras, números, ponto, hífen e sublinhado, sem espaço'


def problema_do_usuario(v):
    if any(c.isspace() for c in v) or set(v) & PROIBIDOS or not v.isprintable():
        return 'sem espaço, ponto e vírgula, chaves ou aspas'
    return None


def problema_da_senha(v):
    if not v:
        return 'em branco'
    if v != v.strip():
        return 'tem espaço no começo ou no fim'
    if not v.isascii() or not v.isprintable():
        return 'tem acento ou caractere especial — use letras, números e símbolos comuns'
    if set(v) & PROIBIDOS:
        return 'tem ponto e vírgula, chaves ou aspas, que quebram a conexão — troque a senha do usuário no Domínio'
    return None


def do_sistema(dono):
    d = str(dono or '').strip().upper()
    return d in DONOS_DO_SISTEMA or d.startswith('SYS_')


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn').lower()


def coluna_pessoal(nome):
    for pedaco in re.split(r'[^a-z0-9]+', sem_acento(nome)):
        if pedaco and (pedaco in PESSOAIS_EXATOS or pedaco.startswith(PESSOAIS_COMECO)):
            return True
    return False


def problema_da_consulta(sql):
    """None quando é UMA consulta só de leitura (SELECT ou WITH); senão, o porquê."""
    corpo = _TEXTO_SQL.sub("''", _COMENTARIO.sub(' ', sql or '')).strip().rstrip(';').strip()
    if not corpo:
        return 'a consulta está em branco'
    if ';' in corpo:
        return 'uma consulta por vez (tem ; no meio)'
    if corpo.split(None, 1)[0].upper() not in ('SELECT', 'WITH'):
        return 'só consulta de leitura: SELECT ou WITH'
    m = _NAO_LEITURA.search(corpo)
    if m:
        return f'tem {m.group(1).upper()}, que não é de leitura'
    return None


def interrogacoes(sql):
    """Quantos ? a consulta espera (fora de texto e de comentário)."""
    return _TEXTO_SQL.sub("''", _COMENTARIO.sub(' ', sql or '')).count('?')


def dica_do_erro(e):
    """O que fazer, pela mensagem do driver; None quando não dá pra saber."""
    estado = str(e.args[0]) if getattr(e, 'args', None) else ''
    texto = str(e).lower()      # toda mensagem do driver começa com "[SAP][ODBC Driver]": "driver" sozinho não diz nada
    if estado in ('IM002', 'IM003') or 'data source name not found' in texto or 'driver could not be loaded' in texto:
        return ('o Windows não achou o driver: instale o SQL Anywhere 17 com os mesmos bits do Python (o LEIA-ME diz '
                'onde) e rode de novo')
    if estado == '28000' or 'user id' in texto or 'password' in texto:
        return ('usuário ou senha recusados: confira os dois e se o usuário está ativo no Domínio, com o Tipo de acesso '
                'Externo (Controle › Permissões › Usuários)')
    if 'database not found' in texto:          # o "Specified database not found" (o "Database server not found" não)
        return 'o servidor respondeu, mas não achou o banco: confira o Banco do chamado da Domínio'
    if estado == 'HYT00' or 'timeout' in texto or 'timed out' in texto:
        return 'o servidor demorou demais pra responder: tente de novo; se repetir, é a rede ou o servidor da Domínio'
    if estado == '08001' or 'server not found' in texto or 'unable to connect' in texto or 'refused' in texto:
        return ('o servidor não respondeu: confira o host, a porta e o Engine — e se este PC está na internet do '
                'escritório (o IP liberado pela Domínio é o fixo de lá; o py -3 -m ponte conferir mostra o IP de saída)')
    return None


def _milhar(n):
    return f'{int(n):,}'.replace(',', '.')


def _limpo(texto):
    return ' '.join(str(texto).split()) if texto is not None else ''


def _erro(e):
    return f'{type(e).__name__}: {e}'


def _primeira(cur, candidatos):
    """Roda a primeira consulta da lista que o banco aceitar e devolve as linhas como dicionários (colunas em
    minúsculas). Nenhuma aceita: levanta o erro da última."""
    erro = None
    for sql in candidatos:
        try:
            cur.execute(sql)
            nomes = [str(d[0]).lower() for d in (cur.description or ())]
            return [dict(zip(nomes, linha)) for linha in cur.fetchall()]
        except Exception as e:   # o nome do catálogo desta versão é outro: tenta o seguinte
            erro = e
    raise erro


def _fechar(*coisas):
    for c in coisas:
        try:
            c.close()
        except Exception:
            pass


def testar_conexao(conexao, conectar=abrir_odbc):
    """(abriu, linhas pra tela). Abre, pergunta a versão do servidor e quantas tabelas o usuário vê — só o catálogo."""
    try:
        con = conectar(conexao)
    except Exception as e:
        linhas = [f'Conexão com o Domínio: não abriu — {_erro(e)}']
        dica = dica_do_erro(e)
        return False, linhas + ([f'  {dica}'] if dica else [])
    cur = None
    try:
        cur = con.cursor()
        versao = _limpo(_primeira(cur, SQL_VERSAO)[0].get('versao'))
        donos = {}
        for linha in _primeira(cur, SQL_DONOS):
            if not do_sistema(linha.get('dono')):
                donos[_limpo(linha.get('dono'))] = int(linha.get('tabelas') or 0)
    except Exception as e:
        return True, [f'Conexão com o Domínio: abriu, mas o catálogo não respondeu — {_erro(e)}']
    finally:
        _fechar(*(c for c in (cur, con) if c is not None))
    total = sum(donos.values())
    partes = ', '.join(f'{d} {_milhar(n)}' for d, n in sorted(donos.items(), key=lambda x: (-x[1], x[0])))
    linhas = [f'Conexão com o Domínio: abriu — SQL Anywhere {versao}; o usuário vê {_milhar(total)} tabela(s) do '
              f'Domínio' + (f' ({partes})' if partes else '')]
    if not total:
        linhas.append('  nenhuma tabela do Domínio à vista: confira se o usuário é do Tipo de acesso Externo')
    return True, linhas


# ---------------------------------------------------------------- conexao

PERGUNTAS = (
    ('host', 'Host (o endereço do chamado da Domínio)', problema_do_host),
    ('porta', 'Porta', problema_da_porta),
    ('servidor', 'Engine (o nome do servidor)', problema_do_nome),
    ('banco', 'Banco', problema_do_nome),
    ('usuario', 'Usuário externo (o que vocês criaram no Domínio)', problema_do_usuario),
)


def _drivers_do_pyodbc():
    """Os drivers ODBC que este Python enxerga, ou None sem o pyodbc."""
    try:
        import pyodbc
    except ImportError:
        return None
    return pyodbc.drivers()


def _interativa():
    try:
        return sys.stdin is not None and sys.stdin.isatty()
    except (AttributeError, ValueError):
        return False


def _pergunta(funcao, texto):
    try:
        return funcao(texto)
    except (EOFError, KeyboardInterrupt):
        return None


def conexao(esperar=False, perguntar=input, senha=getpass.getpass, interativa=None, drivers=None, conectar=None):
    try:
        return _conexao(perguntar, senha, interativa or _interativa, drivers or _drivers_do_pyodbc,
                        conectar or abrir_odbc)
    finally:
        if esperar:
            _pergunta(perguntar, '\nAperte Enter pra fechar esta janela.')


def _conexao(perguntar, senha, interativa, drivers, conectar):
    base = config.pasta()
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())
    if not cfg.existe:
        tela(f'Não achei {cfg.arquivo} — copie o ponte/config.exemplo.ini pra lá (o LEIA-ME explica) e rode de novo.')
        return NADA_FEITO
    if cfg.erro_leitura:
        tela(f'Não consegui ler {cfg.arquivo} ({cfg.erro_leitura}) — confira o formato com o config.exemplo.ini.')
        return NADA_FEITO
    lista = drivers()
    if lista is None:
        tela('Falta o pyodbc: instale com   py -3 -m pip install pyodbc   e rode de novo.')
        return NADA_FEITO
    driver = driver_sql_anywhere(lista)
    if not driver:
        bits = struct.calcsize('P') * 8
        tela(f'Este Python ({bits} bits) não enxerga o driver do SQL Anywhere. Instale o SQL Anywhere 17 de {bits} bits '
             '(o LEIA-ME diz onde) e rode de novo.')
        tela('  os drivers que ele enxerga: ' + (', '.join(map(str, lista)) or 'nenhum'))
        return NADA_FEITO
    if not interativa():
        tela('Esta janela não aceita digitação. Abra uma janela do PowerShell, na pasta do repositório, e rode:')
        tela('  py -3 -m ponte dominio conexao')
        tela('(o pedreiro abre uma pra você com o Start-Process — o LEIA-ME mostra o comando)')
        return NADA_FEITO

    tela('A ligação com o banco do Domínio Web: os dados do chamado da Domínio e o usuário externo.')
    tela(f'O que você digitar vai direto pro {cfg.arquivo}: não passa por chat e não aparece no log.')
    tela(f'Driver: {driver}')
    tela('')
    if cfg.situacao('dominio', 'conexao') == 'preenchido':
        r = _pergunta(perguntar, 'Já existe uma conexão gravada. Digite s pra trocar por uma nova (Enter só testa a de agora): ')
        if r is None:
            tela('Nada foi mudado.')
            return NADA_FEITO
        if r.strip().lower() != 's':
            tela('Não troquei. Testando a que está gravada…')
            abriu, linhas = testar_conexao(cfg.valor('dominio', 'conexao'), conectar)
            for linha in linhas:
                tela(linha)
            return OK if abriu else NAO_ABRIU

    valores = {}
    for campo, texto, problema in PERGUNTAS:
        if campo in valores:          # a porta, quando veio colada no host
            continue
        while True:
            v = _pergunta(perguntar, f'{texto}: ')
            if v is None:
                tela('Desisti: nada foi gravado.')
                return NADA_FEITO
            v = v.strip().strip('"').strip()
            porta = None
            if campo == 'host':
                m = re.fullmatch(r'(.+):(\d{1,5})', v)
                if m:                 # colou "endereço:porta" de uma vez
                    v, porta = m.group(1), m.group(2)
            p = 'em branco' if not v else problema(v)
            if not p and porta is not None:
                p = problema_da_porta(porta)
            if p:
                tela(f'  não serve ({p}) — de novo:')
                continue
            valores[campo] = v
            if porta is not None:
                valores['porta'] = porta
            break

    while True:
        s1 = _pergunta(senha, 'Senha do usuário externo (não aparece enquanto você digita): ')
        if s1 is None:
            tela('Desisti: nada foi gravado.')
            return NADA_FEITO
        p = problema_da_senha(s1)
        if p:
            tela(f'  não serve ({p}) — de novo:')
            continue
        s2 = _pergunta(senha, 'A senha de novo: ')
        if s2 is None:
            tela('Desisti: nada foi gravado.')
            return NADA_FEITO
        if s1 != s2:
            tela('  as duas não são iguais — de novo:')
            continue
        break

    nova = montar_conexao(driver, valores['host'], valores['porta'], valores['servidor'], valores['banco'],
                          valores['usuario'], s1)
    reg = Registro(base / 'logs', segredos=cfg.segredos() + [nova, s1])
    s1 = s2 = None
    gravar_campo(cfg.arquivo, 'dominio', 'conexao', nova)
    if config.carregar().valor('dominio', 'conexao') != nova:
        reg(f'não consegui gravar a conexão do Domínio em {cfg.arquivo} — confira o arquivo', 'erro')
        return NADA_FEITO
    reg(f'conexão do Domínio gravada em {cfg.arquivo} pelo "dominio conexao" (driver {driver}; os valores não aparecem)')
    tela('Testando…')
    abriu, linhas = testar_conexao(nova, conectar)
    nova = None
    for linha in linhas:
        reg(linha, 'info' if abriu else 'erro')
    if not abriu:
        tela('A conexão ficou gravada. Acertado o que faltava, rode de novo (py -3 -m ponte dominio conexao) — ou, se '
             'o que faltava era fora daqui (a rede, o usuário no Domínio), só teste: py -3 -m ponte conferir')
        return NAO_ABRIU
    tela('Pronto. Daqui em diante: py -3 -m ponte dominio tabelas (o catálogo) e py -3 -m ponte conferir.')
    return OK


# ---------------------------------------------------------------- tabelas

def _abrir_da_config(tela, conectar):
    """(conexão, None) ou (None, código de saída) — com o motivo já na tela."""
    cfg = config.carregar()
    if not cfg.existe or cfg.erro_leitura:
        tela(f'Não achei ou não consegui ler {cfg.arquivo} — o LEIA-ME explica como montar.')
        return None, NADA_FEITO
    situacao = cfg.situacao('dominio', 'conexao')
    if situacao != 'preenchido':
        tela(f'A [dominio] conexao do config.ini está {situacao}: rode antes   py -3 -m ponte dominio conexao')
        return None, NADA_FEITO
    try:
        return (conectar or abrir_odbc)(cfg.valor('dominio', 'conexao')), None
    except Exception as e:
        tela(f'Conexão com o Domínio: não abriu — {_erro(e)}')
        dica = dica_do_erro(e)
        if dica:
            tela(f'  {dica}')
        return None, NAO_ABRIU


def _tipo(c):
    t = _limpo(c.get('tipo'))
    tam, esc = c.get('tamanho'), c.get('escala')
    if t.lower() in ('char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary', 'long varchar') and tam:
        return f'{t}({tam})'
    if t.lower() in ('numeric', 'decimal') and tam:
        return f'{t}({tam},{esc or 0})'
    return t


def catalogo(cur):
    """{(dono, tabela): {tipo, descricao, linhas, colunas: [...]}} das tabelas que não são do próprio SQL Anywhere, e
    se a contagem de linhas veio. Só o catálogo (SYS): nenhuma linha das tabelas."""
    tabelas = {}
    for t in _primeira(cur, SQL_TABELAS):
        if do_sistema(t.get('dono')):
            continue
        chave = (_limpo(t.get('dono')), _limpo(t.get('tabela')))
        tabelas[chave] = {'tipo': _limpo(t.get('tipo')), 'descricao': _limpo(t.get('descricao')), 'linhas': None,
                          'colunas': []}
    for c in _primeira(cur, SQL_COLUNAS):
        chave = (_limpo(c.get('dono')), _limpo(c.get('tabela')))
        if chave in tabelas:
            tabelas[chave]['colunas'].append(c)
    for t in tabelas.values():
        t['colunas'].sort(key=lambda c: int(c.get('ordem') or 0))
    try:
        contagem = _primeira(cur, SQL_LINHAS)
    except Exception:
        contagem = None           # sem a contagem, o catálogo serve do mesmo jeito
    for linha in contagem or ():
        chave = (_limpo(linha.get('dono')), _limpo(linha.get('tabela')))
        if chave in tabelas and linha.get('linhas') is not None:
            tabelas[chave]['linhas'] = int(linha['linhas'])
    return tabelas, contagem is not None


def texto_do_catalogo(tabelas, com_contagem, versao, quando):
    colunas = [c for t in tabelas.values() for c in t['colunas']]
    resumo = (f"{_milhar(len(tabelas))} tabela(s) ({_milhar(sum(1 for t in tabelas.values() if t['descricao']))} com "
              f"descrição) · {_milhar(len(colunas))} coluna(s) ({_milhar(sum(1 for c in colunas if _limpo(c.get('descricao'))))} "
              'com descrição)')
    if com_contagem:
        resumo += f" · {_milhar(sum(1 for t in tabelas.values() if t['linhas']))} com linhas"
    else:
        resumo += ' · a contagem de linhas não veio'
    saida = [f'Catálogo do banco do Domínio — {quando:%d/%m/%Y %H:%M}, pelo py -3 -m ponte dominio tabelas',
             'Só a estrutura (as tabelas, as colunas, os tipos, as descrições e quantas linhas): nenhum dado das tabelas.',
             f'Servidor: SQL Anywhere {versao}', resumo, '']
    for (dono, tabela), t in sorted(tabelas.items(), key=lambda x: (x[0][0].lower(), x[0][1].lower())):
        cab = f'=== {dono}.{tabela}'
        if t['tipo'] and t['tipo'].upper() not in ('TABLE', 'BASE'):
            cab += f" [{t['tipo']}]"
        if t['linhas'] is not None:
            cab += f" — {_milhar(t['linhas'])} linha(s)"
        if t['descricao']:
            cab += f" — {t['descricao']}"
        saida.append(cab)
        for c in t['colunas']:
            chave = 'PK' if _limpo(c.get('chave')).upper() == 'Y' else ''
            nulo = 'não nulo' if _limpo(c.get('nulos')).upper() == 'N' else ''
            saida.append(f"    {_limpo(c.get('coluna')):<26} {_tipo(c):<18} {chave:<3} {nulo:<9} "
                         f"{_limpo(c.get('descricao'))}".rstrip())
        saida.append('')
    return '\n'.join(saida) + '\n', resumo


def procurar_no_catalogo(tabelas, termo):
    """As tabelas e as colunas cujo nome ou descrição têm todas as palavras do termo (sem acento, sem maiúscula)."""
    palavras = sem_acento(termo).split()
    if not palavras:
        return [], []
    achadas, colunas = [], []
    for (dono, tabela), t in sorted(tabelas.items(), key=lambda x: (x[0][0].lower(), x[0][1].lower())):
        if all(p in sem_acento(f"{dono}.{tabela} {t['descricao']}") for p in palavras):
            achadas.append(f"{dono}.{tabela}" + (f" — {_milhar(t['linhas'])} linha(s)" if t['linhas'] is not None else '')
                           + (f" — {t['descricao']}" if t['descricao'] else ''))
        for c in t['colunas']:
            nome = _limpo(c.get('coluna'))
            desc = _limpo(c.get('descricao'))
            if all(p in sem_acento(f'{tabela}.{nome} {desc}') for p in palavras):
                colunas.append(f'{dono}.{tabela}.{nome} {_tipo(c)}' + (f' — {desc}' if desc else ''))
    return achadas, colunas


def _destino(saida, nome_padrao):
    """Caminho solto vai pra pasta da ponte — nunca pra pasta de onde se roda (o repositório é público)."""
    destino = pathlib.Path(saida or nome_padrao)
    return destino if destino.is_absolute() else config.pasta() / destino


def tabelas(procurar=None, saida=None, conectar=None, agora=None):
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())
    con, codigo = _abrir_da_config(tela, conectar)
    if con is None:
        return codigo
    cur = None
    try:
        cur = con.cursor()
        try:
            versao = _limpo(_primeira(cur, SQL_VERSAO)[0].get('versao'))
        except Exception:
            versao = '(a versão não veio)'
        lidas, com_contagem = catalogo(cur)
    except Exception as e:
        tela(f'O catálogo não respondeu — {_erro(e)}')
        return NAO_ABRIU
    finally:
        _fechar(*(c for c in (cur, con) if c is not None))

    texto, resumo = texto_do_catalogo(lidas, com_contagem, versao, agora or datetime.datetime.now())
    destino = _destino(saida, ARQUIVO_TABELAS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding='utf-8-sig')      # com BOM: o Bloco de Notas abre com os acentos certos
    reg = Registro(config.pasta() / 'logs', segredos=cfg.segredos())
    reg(f'catálogo do Domínio gravado em {destino}: {resumo}')
    if procurar:
        achadas, colunas = procurar_no_catalogo(lidas, procurar)
        tela('')
        tela(f'"{procurar}": {_milhar(len(achadas))} tabela(s) e {_milhar(len(colunas))} coluna(s)')
        linhas = ([f'  {a}' for a in achadas] + ([''] if achadas and colunas else []) + [f'  {c}' for c in colunas])
        for linha in linhas[:MOSTRAR_MAX]:
            tela(linha)
        if len(linhas) > MOSTRAR_MAX:
            tela(f'  … e mais {_milhar(len(linhas) - MOSTRAR_MAX)} linha(s): estão todas no {destino.name}')
    return OK


# ---------------------------------------------------------------- sql

def _valor_tela(v):
    if v is None:
        return 'null'
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray, memoryview)):
        return f'<{len(v)} bytes>'
    s = _limpo(v)
    return s if len(s) <= 60 else s[:57] + '...'


def sql(consulta=None, arquivo=None, mes=None, linhas=None, conectar=None):
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())
    if arquivo:
        try:
            consulta = pathlib.Path(arquivo).read_text(encoding='utf-8-sig')
        except OSError as e:
            tela(f'Não consegui ler {arquivo} ({type(e).__name__}).')
            return NADA_FEITO
    problema = problema_da_consulta(consulta)
    if problema:
        tela(f'Não rodo: {problema}.')
        return NADA_FEITO
    precisa = interrogacoes(consulta)
    if mes:
        if precisa != 2:
            tela(f'Com --mes a consulta precisa de dois ? (o primeiro e o último dia do mês, nessa ordem); esta tem {precisa}.')
            return NADA_FEITO
        parametros = list(limites_do_mes(mes))
    elif precisa:
        tela(f'A consulta tem {precisa} ?: passe o mês com --mes AAAA-MM (vão o primeiro e o último dia).')
        return NADA_FEITO
    else:
        parametros = []
    maximo = linhas or LINHAS_PADRAO

    con, codigo = _abrir_da_config(tela, conectar)
    if con is None:
        return codigo
    cur = None
    reg = Registro(config.pasta() / 'logs', segredos=cfg.segredos())
    try:
        cur = con.cursor()
        inicio = time.monotonic()
        try:
            if parametros:
                cur.execute(consulta, parametros)
            else:
                cur.execute(consulta)
        except Exception as e:
            tela(f'A consulta deu erro no banco — {_erro(e)}')
            return NAO_ABRIU
        nomes = [str(d[0]) for d in (cur.description or ())]
        pessoais = [n for n in nomes if coluna_pessoal(n)]
        if pessoais:
            reg('dominio sql: consulta recusada pela trava do dado pessoal (nada foi mostrado)', 'aviso')
            tela('Não mostro: a consulta traz coluna de dado pessoal (' + ', '.join(pessoais) + '). Só contagem e soma por '
                 'empresa — nada de nome, documento pessoal, salário, endereço ou contato. (Contagem? Dê um apelido: '
                 'COUNT(*) AS quantos. O nome das empresas sai pelo py -3 -m ponte rodar --sem-enviar --saida '
                 'conferencia.json, que fica na pasta da ponte.)')
            return NADA_FEITO
        trazidas = cur.fetchmany(maximo + 1)
        segundos = time.monotonic() - inicio
    finally:
        _fechar(*(c for c in (cur, con) if c is not None))
    mais = len(trazidas) > maximo
    trazidas = trazidas[:maximo]
    tela(' | '.join(nomes))
    for linha in trazidas:
        tela(' | '.join(_valor_tela(v) for v in linha))
    tela(f'{_milhar(len(trazidas))} linha(s) em {segundos:.1f} s'
         + (f' — e mais (não mostradas; --linhas até {LINHAS_MAX})' if mais else ''))
    reg(f'dominio sql: {len(trazidas)} linha(s){" (e mais)" if mais else ""} em {segundos:.1f} s · '
        + _limpo(consulta)[:500])
    return OK
