"""Teste da ponte da Receita (ponte/receita/) — sem o Serpro, sem o sistema e sem internet. Precisa do Python 3.11+
com o cryptography e o pypdf (py -3 -m pip install cryptography pypdf).

    python tests/ponte-receita.test.py

Um Serpro de mentira (a entrada, /authenticate, e o gateway, servindo as respostas do ambiente de demonstração
guardadas em tests/fixtures/receita/) e um sistema de mentira (a lista de empresas e o recebimento dos pacotes), os
dois em http.server numa thread, porta 0. Cada caso usa uma pasta temporária em PONTE_PASTA. Empresas, chaves, senhas
e o certificado são todos inventados (os CNPJs das empresas com o dígito verificador errado; o do escritório, com
letras, montado aqui).

  1. token: o Basic certo, role-type TERCEIROS, grant_type=client_credentials; renova antes de vencer e numa 401;
     duas 401 seguidas = sai com 2
  2. certificado: um .pfx gerado aqui carrega; os arquivos temporários somem (também com a senha errada e com erro
     no meio); a chave vai cifrada pro disco; o conferir mostra o titular e os dias até vencer, o vencido em destaque
  3. cada serviço, com as respostas da demonstração, vira o bloco certo (os valores com os centavos)
  4. acesso negado = sem_autorizacao sem repetir; 503, 503, 200 = foi na terceira; o teto para com `teto`
  5. o calendário: dia 21 o pgdas só do Simples; dia 5 a situação fiscal; sábado nada; --so passa por cima; a
     mensagem e a declaração já lidas não voltam
  6. o que sai: só o contrato; o assunto não vai pro log; o PDF e o texto da mensagem nunca vão pro pacote
  7. segredo nunca aparece (consumer key e secret, a senha do certificado, os tokens), com o Registro de verdade
  8. PDF que não dá pra ler = null e a_conferir, o PDF guardado
  9. o tests/ponte.test.py continua passando
  +  a lista de empresas que não vem, os pendentes, o --falso, a demonstração e o --saida
Termina com código 1 se alguma checagem falhar.
"""
import base64
import copy
import datetime
import http.server
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading

sys.dont_write_bytecode = True          # importar a ponte aqui não deixa __pycache__ no repositório
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
FIXTURES = RAIZ / 'tests' / 'fixtures' / 'receita'

try:
    import cryptography  # noqa: F401
    import pypdf  # noqa: F401
except ImportError:
    print('O teste da ponte da Receita precisa do cryptography e do pypdf: py -3 -m pip install cryptography pypdf')
    sys.exit(1)

# o contrato da fila (2.5), escrito aqui e não importado da ponte: um campo a mais na ponte tem que derrubar o teste
CONTRATO_TOPO = {'versao', 'tipo', 'rodada', 'empresas', 'faltou'}
CONTRATO_RODADA = {'id', 'inicio', 'fim', 'maquina', 'ponte', 'ambiente', 'chamadas_mes'}
CONTRATO_BLOCOS = {
    'autorizacao': {'situacao', 'valida_ate'},
    'pgdas': {'ano', 'meses'},
    'faturamento': {'competencia', 'receita_mes', 'receita_12_meses'},
    'caixa_postal': {'mensagens'},
    'situacao_fiscal': {'consultada_em', 'pendencias'},
}
CONTRATO_MES = {'competencia', 'transmitida_em', 'das_pago'}
CONTRATO_MENSAGEM = {'id', 'assunto', 'enviada_em', 'origem', 'lida'}
CONTRATO_PENDENCIA = {'orgao', 'titulo'}
CONTRATO_FALTOU = {'documento', 'servico', 'motivo'}

KEY = 'CONSUMER-KEY-DE-TESTE'
SECRET = 'CONSUMER-SECRET-DE-TESTE'
SENHA_PFX = 'SENHA-PFX-DE-TESTE'
CHAVE_PONTE = 'SEGREDO-DA-PONTE-DE-TESTE'
CHAVE_PUBLICA = 'chave-publica-de-teste'
TITULAR = 'Escritorio de Teste da Ponte'
TEXTO_INTEIRO = 'TEXTO-INTEIRO-DA-MENSAGEM-QUE-NAO-SAI'
A, B, C = '11222333000100', '22333444000100', '33444555000100'     # o dígito verificador errado de propósito
EMPRESAS = [{'documento': A, 'regime': 'simples'}, {'documento': B, 'regime': 'presumido'},
            {'documento': C, 'regime': 'mei'}]


def cnpj_com_dv(base):
    """Os dois dígitos verificadores do CNPJ (também o alfanumérico) — montado aqui, de propósito, sem a ponte."""
    v = [ord(c) - 48 for c in base]
    for pesos in ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]):
        r = sum(a * b for a, b in zip(v, pesos)) % 11
        v.append(0 if r < 2 else 11 - r)
    return base + ''.join(str(d) for d in v[12:])


CNPJ_ESCRITORIO = cnpj_com_dv('TESTEPONTE01')     # com letras: não é de ninguém

falhas = 0
PASTAS = []


def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond:
        falhas += 1


def titulo(t):
    print(f'\n{t}')


def fixture(nome):
    return json.loads((FIXTURES / f'{nome}.json').read_text(encoding='utf-8'))


# ---------------------------------------------------------------- o Serpro de mentira

class Serpro:
    """/authenticate e o gateway. As respostas: as fixtures da demonstração; o teste pode pôr na frente uma fila por
    serviço (filas) ou por serviço e empresa (por_doc): um número (o HTTP), um dict (o corpo, 200) ou
    (http, corpo, cabeçalhos)."""

    def __init__(self):
        self.trava = threading.Lock()
        self.fixtures = {p.stem.split('-', 1)[1]: json.loads(p.read_text(encoding='utf-8'))
                         for p in FIXTURES.glob('*.json')}
        self.zerar()
        dono = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _enviar(self, codigo, corpo, cabecalhos=None):
                bruto = json.dumps(corpo, ensure_ascii=False).encode('utf-8') if corpo is not None else b''
                try:
                    self.send_response(codigo)
                    for k, v in (cabecalhos or {}).items():
                        self.send_header(k, v)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(bruto)))
                    self.end_headers()
                    self.wfile.write(bruto)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    pass

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                bruto = self.rfile.read(n)
                cab = {k.lower(): v for k, v in self.headers.items()}
                if self.path.endswith('/authenticate'):
                    with dono.trava:
                        dono.auth.append({'cabecalhos': cab, 'corpo': bruto.decode('utf-8', 'replace')})
                        resposta = dono.auth_respostas.pop(0) if dono.auth_respostas else 200
                        if resposta == 200:
                            dono.n_token += 1
                            n_tok = dono.n_token
                    if resposta != 200:
                        return self._enviar(resposta, {'error': 'recusado pelo teste'})
                    return self._enviar(200, {'access_token': f'ACCESS-TOKEN-DE-TESTE-{n_tok}',
                                              'jwt_token': f'JWT-DE-TESTE-{n_tok}', 'expires_in': dono.validade,
                                              'token_type': 'Bearer', 'scope': 'default'})
                pedido = json.loads(bruto.decode('utf-8'))
                servico = pedido['pedidoDados']['idServico']
                doc = str(pedido['contribuinte']['numero'])
                with dono.trava:
                    dono.pedidos.append({'endpoint': self.path.rsplit('/', 1)[-1], 'servico': servico, 'doc': doc,
                                         'cabecalhos': cab, 'pedido': pedido})
                    fila = dono.por_doc.get((servico, doc)) or dono.filas.get(servico)
                    resposta = fila.pop(0) if fila else None
                    if servico == 'SOLICEVENTOSPJ132':
                        dono.ultimo_lote = doc.split(',')
                if resposta is None:
                    return self._enviar(200, dono.padrao(servico))
                if isinstance(resposta, int):
                    if resposta == 403:
                        return self._enviar(403, {'status': 403, 'mensagens': [
                            {'codigo': '[AcessoNegado-ICGERENCIADOR-022]', 'texto': 'Procuração não encontrada.'}]})
                    return self._enviar(resposta, {'status': resposta, 'mensagens': [
                        {'codigo': '[Erro-TESTE]', 'texto': f'HTTP {resposta} do teste'}]})
                if isinstance(resposta, dict):
                    return self._enviar(200, resposta)
                return self._enviar(*resposta)

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{self.srv.server_address[1]}'
        self.url_token = base + '/authenticate'
        self.url_gateway = base + '/integra-contador/v1/'

    def zerar(self):
        with self.trava:
            self.auth, self.pedidos = [], []
            self.auth_respostas, self.filas, self.por_doc = [], {}, {}
            self.validade = 3000
            self.n_token = 0
            self.eventos = {}             # cnpj -> 'AAMMDD' | '' | 'x' (o que não estiver aqui: '')
            self.ultimo_lote = []
            self.procuracao_ate = '20271231'   # None = a da demonstração (vencida em 2023)
            self.pgdas_ano = None              # ex.: '2026' = os meses da demonstração trocados pra esse ano
            self.extra_mensagem = False        # um campo a mais (o texto inteiro) em cada mensagem da lista

    def padrao(self, servico):
        if servico == 'OBTEREVENTOSPJ134':
            matriz = [[d, self.eventos.get(d, '')] for d in self.ultimo_lote if d]
            return {'status': 200, 'mensagens': [{'codigo': '[Sucesso-EVENTOSATUALIZACAO]', 'texto': 'ok'}],
                    'dados': json.dumps(matriz)}
        r = copy.deepcopy(self.fixtures[servico])
        if servico == 'OBTERPROCURACAO41' and self.procuracao_ate:
            r['dados'] = r['dados'].replace('20230414', self.procuracao_ate)
        if servico == 'CONSDECLARACAO13' and self.pgdas_ano:
            r['dados'] = r['dados'].replace('2018', self.pgdas_ano)
        if servico == 'MSGCONTRIBUINTE61' and self.extra_mensagem:
            d = json.loads(r['dados'])
            for m in d['conteudo'][0]['listaMensagens']:
                m['corpoMensagem'] = TEXTO_INTEIRO
            r['dados'] = json.dumps(d, ensure_ascii=False)
        return r

    def servicos(self, servico):
        """Os contribuintes de cada pedido daquele serviço, na ordem."""
        with self.trava:
            return [p['doc'] for p in self.pedidos if p['servico'] == servico]

    def fechar(self):
        self.srv.shutdown()


class Sistema:
    """A função do sistema: devolve a lista de empresas e recebe os pacotes (com uma fila de respostas)."""

    def __init__(self):
        self.trava = threading.Lock()
        self.zerar()
        dono = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _enviar(self, codigo, corpo):
                bruto = json.dumps(corpo).encode('utf-8')
                try:
                    self.send_response(codigo)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(bruto)))
                    self.end_headers()
                    self.wfile.write(bruto)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    pass

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                corpo = json.loads(self.rfile.read(n).decode('utf-8'))
                cab = {k.lower(): v for k, v in self.headers.items()}
                with dono.trava:
                    if corpo.get('pedir') == 'empresas':
                        dono.pedidos_empresas.append(cab)
                        if dono.empresas_status != 200:
                            return self._enviar(dono.empresas_status, {'erro': 'teste'})
                        return self._enviar(200, {'empresas': dono.empresas})
                    if corpo.get('ping'):
                        dono.pings += 1
                        return self._enviar(200, {'ok': True})
                    dono.pacotes.append({'cabecalhos': cab, 'corpo': corpo})
                    resposta = dono.respostas.pop(0) if dono.respostas else 200
                return self._enviar(resposta, {'ok': resposta < 300})

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}/functions/v1/ponte-dominio'

    def zerar(self, *respostas, empresas=None, empresas_status=200):
        with self.trava:
            self.respostas = list(respostas)
            self.pacotes, self.pedidos_empresas = [], []
            self.pings = 0
            self.empresas = copy.deepcopy(EMPRESAS if empresas is None else empresas)
            self.empresas_status = empresas_status

    def ultimo(self):
        with self.trava:
            return self.pacotes[-1]['corpo'] if self.pacotes else None

    def fechar(self):
        self.srv.shutdown()


# ---------------------------------------------------------------- ajudantes

def pasta_nova():
    p = pathlib.Path(tempfile.mkdtemp(prefix='ponte-receita-teste-'))
    PASTAS.append(p)
    return p


def gerar_pfx(caminho, senha=SENHA_PFX, dias=400, titular=TITULAR):
    """Um .pfx autoassinado, com senha, que vence daqui a `dias` dias (negativo = já vencido), ao meio-dia UTC."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID
    chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nome = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, titular)])
    hoje = datetime.datetime.now(datetime.timezone.utc).date()
    vence = datetime.datetime.combine(hoje + datetime.timedelta(days=dias), datetime.time(12), datetime.timezone.utc)
    inicio = min(vence, datetime.datetime.now(datetime.timezone.utc)) - datetime.timedelta(days=30)
    cert = (x509.CertificateBuilder().subject_name(nome).issuer_name(nome).public_key(chave.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(inicio).not_valid_after(vence)
            .sign(chave, hashes.SHA256()))
    caminho.write_bytes(pkcs12.serialize_key_and_certificates(
        b'teste', chave, cert, None, serialization.BestAvailableEncryption(senha.encode())))
    return caminho


PFX_PADRAO = None


def escrever_config(pasta, sis, ambiente='producao', teto=None, pfx=None, url=None, cnpj=None, **extra):
    global PFX_PADRAO
    if pfx is None:
        if PFX_PADRAO is None:
            PFX_PADRAO = gerar_pfx(pasta_nova() / 'escritorio.pfx')
        pfx = PFX_PADRAO
    campos = {'ambiente': ambiente, 'consumer_key': KEY, 'consumer_secret': SECRET, 'certificado': str(pfx),
              'senha_certificado': SENHA_PFX, 'cnpj_escritorio': cnpj or CNPJ_ESCRITORIO}
    campos.update(extra)
    linhas = ['[sistema]', f'url = {url or sis.url}', f'chave_publica = {CHAVE_PUBLICA}', f'chave_ponte = {CHAVE_PONTE}',
              '[integra]'] + [f'{k} = {v}' for k, v in campos.items() if v is not None]
    if teto is not None:
        linhas.append(f'teto_mes = {teto}')
    (pasta / 'config.ini').write_text('\n'.join(linhas) + '\n', encoding='utf-8')


SAIDAS = []     # tudo o que foi pra tela, pro caso 7


def ponte(pasta, srp, *args, hoje=None):
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5',
               PONTE_SERPRO_TOKEN_URL=srp.url_token, PONTE_SERPRO_GATEWAY=srp.url_gateway,
               PONTE_RECEITA_INTERVALO='0', PONTE_RECEITA_ESPERA_MAX='0', PYTHONIOENCODING='utf-8',
               PYTHONDONTWRITEBYTECODE='1')
    env.pop('PONTE_HOJE', None)
    if hoje:
        env['PONTE_HOJE'] = hoje
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=300)
    saida = (r.stdout or '') + (r.stderr or '')
    SAIDAS.append(saida)
    return r.returncode, saida


def rodar(pasta, srp, *args, hoje='2026-10-23'):
    return ponte(pasta, srp, 'receita', 'rodar', *args, hoje=hoje)


def logs(pasta):
    p = pasta / 'logs'
    return '\n'.join(a.read_text(encoding='utf-8') for a in sorted(p.glob('*.log'))) if p.is_dir() else ''


def estado(pasta):
    arq = pasta / 'receita' / 'estado.json'
    return json.loads(arq.read_text(encoding='utf-8')) if arq.is_file() else None


def pendentes(pasta):
    p = pasta / 'pendentes'
    return sorted(p.glob('*.json')) if p.is_dir() else []


def empresa(pac, doc):
    return next((e for e in (pac or {}).get('empresas', []) if e['documento'] == doc), None)


def faltou(pac, doc=None):
    return sorted((f['documento'], f['servico'], f['motivo']) for f in (pac or {}).get('faltou', [])
                  if doc is None or f['documento'] == doc)


def pdf_simples(linhas):
    """Um PDF de uma página com estas linhas de texto (Helvetica, WinAnsi) — pros valores com centavos."""
    def esc(t):
        saida = b''
        for c in t.encode('cp1252'):
            ch = bytes([c])
            if ch in b'()\\':
                saida += b'\\' + ch
            elif c > 126:
                saida += b'\\%03o' % c
            else:
                saida += ch
        return saida
    conteudo = b'BT /F1 9 Tf 14 TL 30 800 Td\n' + b''.join(b'(' + esc(lin) + b') Tj T*\n' for lin in linhas) + b'ET'
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>',
            b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> '
            b'/Contents 5 0 R >>',
            b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            b'<< /Length %d >>\nstream\n' % len(conteudo) + conteudo + b'\nendstream']
    saida, posicoes = b'%PDF-1.4\n', []
    for i, o in enumerate(objs, 1):
        posicoes.append(len(saida))
        saida += b'%d 0 obj\n' % i + o + b'\nendobj\n'
    xref = len(saida)
    saida += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % p for p in posicoes)
    saida += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
    return saida


def com_pdf(srp, servico, conteudo):
    """A resposta da demonstração daquele serviço com o PDF trocado."""
    r = copy.deepcopy(srp.fixtures[servico])
    d = json.loads(r['dados'])
    b64 = base64.b64encode(conteudo).decode('ascii')
    if servico == 'CONSULTIMADECREC14':
        d['declaracao']['pdf'] = b64
    else:
        d['pdf'] = b64
    r['dados'] = json.dumps(d)
    return r


def no_processo(pasta, srp, funcao):
    """Roda `funcao()` aqui dentro, com as variáveis da ponte apontando pra pasta e pro Serpro de mentira."""
    import contextlib
    import io
    novas = dict(PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5',
                 PONTE_SERPRO_TOKEN_URL=srp.url_token, PONTE_SERPRO_GATEWAY=srp.url_gateway,
                 PONTE_RECEITA_INTERVALO='0', PONTE_RECEITA_ESPERA_MAX='0')
    guardado = {k: os.environ.get(k) for k in novas}
    os.environ.update(novas)
    tela = io.StringIO()
    try:
        with contextlib.redirect_stdout(tela):
            resultado = funcao()
    finally:
        for k, v in guardado.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    SAIDAS.append(tela.getvalue())
    return resultado, tela.getvalue()


def cliente(srp, pasta, registro):
    from ponte.receita import estado as est_mod, serpro
    cont = est_mod.Contador(pasta, datetime.date(2026, 10, 23), 1500, contar=False)
    return serpro.Cliente('producao', CNPJ_ESCRITORIO, registro, cont, pasta / 'tmp', consumer_key=KEY,
                          consumer_secret=SECRET, url_token=srp.url_token, url_gateway=srp.url_gateway)


PROCURACAO = {'outorgante': A, 'tipoOutorgante': '2', 'outorgado': CNPJ_ESCRITORIO, 'tipoOutorgado': '2'}


# ---------------------------------------------------------------- 1. o token

def caso_token(srp, sis):
    titulo('1. token: Basic, role-type, grant_type; renova antes de vencer e numa 401; duas 401 = sai com 2')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao', '--empresas', '1')
    ok(cod == 0, f'a rodada de uma empresa saiu com 0 (saiu {cod})')
    basic = 'Basic ' + base64.b64encode(f'{KEY}:{SECRET}'.encode()).decode()
    a = srp.auth[0] if srp.auth else {'cabecalhos': {}, 'corpo': ''}
    ok(len(srp.auth) == 1, f'um pedido de token só (foram {len(srp.auth)})')
    ok(a['cabecalhos'].get('authorization') == basic, 'Authorization: Basic base64(consumer_key:consumer_secret)')
    ok(a['cabecalhos'].get('role-type') == 'TERCEIROS', 'role-type: TERCEIROS')
    ok(a['cabecalhos'].get('content-type') == 'application/x-www-form-urlencoded', 'content-type do formulário')
    ok(a['corpo'] == 'grant_type=client_credentials', 'corpo grant_type=client_credentials')
    p = srp.pedidos[0] if srp.pedidos else {'cabecalhos': {}, 'pedido': {}, 'endpoint': ''}
    ok(p['cabecalhos'].get('authorization') == 'Bearer ACCESS-TOKEN-DE-TESTE-1'
       and p['cabecalhos'].get('jwt_token') == 'JWT-DE-TESTE-1', 'o gateway recebe o Bearer e o jwt_token')
    ok(p['endpoint'] == 'Consultar' and p['pedido'].get('contratante') == {'numero': CNPJ_ESCRITORIO, 'tipo': 2}
       and p['pedido'].get('autorPedidoDados') == {'numero': CNPJ_ESCRITORIO, 'tipo': 2}
       and p['pedido'].get('contribuinte') == {'numero': A, 'tipo': 2},
       'o corpo: contratante e autor = o escritório (tipo 2), contribuinte = a empresa (tipo 2)')
    dados = json.loads(p['pedido'].get('pedidoDados', {}).get('dados') or '{}')
    ok(dados == PROCURACAO and p['pedido']['pedidoDados'].get('idSistema') == 'PROCURACOES',
       'o pedidoDados da procuração (dados em texto JSON)')

    # renova antes de vencer: com 1 s de validade, a 80% (0,8 s) já pede outro
    from ponte.log import Registro
    srp.zerar()
    srp.validade = 1

    def duas_chamadas():
        import time
        cli = cliente(srp, pasta, Registro(None, []))
        cli.chamar('Consultar', 'PROCURACOES', 'OBTERPROCURACAO41', A, PROCURACAO, versao='1')
        time.sleep(0.9)
        cli.chamar('Consultar', 'PROCURACOES', 'OBTERPROCURACAO41', A, PROCURACAO, versao='1')
    no_processo(pasta, srp, duas_chamadas)
    ok(len(srp.auth) == 2 and srp.pedidos[-1]['cabecalhos'].get('authorization') == 'Bearer ACCESS-TOKEN-DE-TESTE-2',
       f'passados 80% da validade, pede outro token antes de chamar (tokens: {len(srp.auth)})')
    srp.zerar()

    def tres_chamadas():
        cli = cliente(srp, pasta, Registro(None, []))
        for _ in range(3):
            cli.chamar('Consultar', 'PROCURACOES', 'OBTERPROCURACAO41', A, PROCURACAO, versao='1')
    no_processo(pasta, srp, tres_chamadas)
    ok(len(srp.auth) == 1 and len(srp.pedidos) == 3, 'dentro da validade, um token serve pras chamadas todas')

    # uma 401: renova e chama de novo
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [401]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao', '--empresas', '1')
    pedidos = srp.servicos('OBTERPROCURACAO41')
    ok(cod == 0 and len(srp.auth) == 2 and len(pedidos) == 2
       and srp.pedidos[-1]['cabecalhos'].get('authorization') == 'Bearer ACCESS-TOKEN-DE-TESTE-2',
       f'uma 401: pede outro token e repete com ele (saiu {cod}, tokens {len(srp.auth)}, chamadas {len(pedidos)})')
    ok(empresa(sis.ultimo(), A) and empresa(sis.ultimo(), A).get('autorizacao', {}).get('situacao') == 'ativa',
       'e o dado veio')

    # duas 401 seguidas: configuração — sai com 2, sem pendente
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [401, 401]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao', '--empresas', '1')
    ok(cod == 2, f'duas 401 seguidas: sai com 2 (saiu {cod})')
    ok(not pendentes(pasta) and not sis.pacotes, 'e não manda nem guarda pacote')
    ok('401' in logs(pasta), 'o log diz o porquê (401)')

    # a entrada recusada (401 no /authenticate) também é configuração
    srp.zerar()
    srp.auth_respostas = [401]
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao', '--empresas', '1')
    ok(cod == 2 and not srp.pedidos, f'a entrada recusada: sai com 2 sem chamar o gateway (saiu {cod})')


# ---------------------------------------------------------------- 2. o certificado

def caso_certificado(srp, sis):
    titulo('2. certificado: carrega, os temporários somem, a chave vai cifrada; o conferir mostra titular e dias')
    import ssl
    from ponte.receita import serpro
    pasta = pasta_nova()
    pfx = gerar_pfx(pasta / 'escritorio.pfx')
    tmp = pasta / 'tmp'
    ctx = serpro.contexto_com_certificado(pfx, SENHA_PFX, tmp)
    ok(isinstance(ctx, ssl.SSLContext), 'o .pfx com a senha certa vira o SSLContext do TLS mútuo')
    ok(tmp.is_dir() and not list(tmp.iterdir()), 'os arquivos temporários sumiram')
    try:
        serpro.contexto_com_certificado(pfx, 'senha-errada', tmp)
        ok(False, 'a senha errada devia parar')
    except serpro.ErroConfig as e:
        ok('senha' in str(e) and 'senha-errada' not in str(e), 'a senha errada para com ErroConfig, sem repetir a senha')
    ok(not list(tmp.iterdir()), 'e não sobra arquivo nenhum')

    # erro no meio (o ssl recusa depois de os arquivos existirem): somem também; e a chave foi cifrada pro disco
    visto = {}

    class CtxQueRecusa:
        def load_cert_chain(self, certfile, keyfile=None, password=None):
            visto['chave'] = pathlib.Path(keyfile).read_bytes()
            visto['cert'] = pathlib.Path(certfile).read_bytes()
            visto['senha'] = password
            raise ssl.SSLError('recusado pelo teste')
    original = serpro.contexto_tls
    serpro.contexto_tls = lambda: CtxQueRecusa()
    try:
        serpro.contexto_com_certificado(pfx, SENHA_PFX, tmp)
        ok(False, 'o erro do ssl devia parar')
    except serpro.ErroConfig:
        ok(True, 'o erro do ssl vira ErroConfig')
    finally:
        serpro.contexto_tls = original
    ok(not list(tmp.iterdir()), 'com erro no meio, os temporários somem também')
    ok(b'BEGIN ENCRYPTED PRIVATE KEY' in visto.get('chave', b'') and b'BEGIN PRIVATE KEY' not in visto.get('chave', b''),
       'a chave foi pro disco cifrada (nunca aberta)')
    ok(visto.get('senha') and visto['senha'] != SENHA_PFX, 'cifrada com uma senha aleatória, não a do .pfx')
    ok(b'BEGIN CERTIFICATE' in visto.get('cert', b''), 'o certificado vai em PEM')

    # o conferir
    for dias, espera, destaque in ((400, 'vence em 400 dias', False), (10, 'vence em 10 dia(s)', True),
                                   (-5, 'VENCIDO há 5 dia(s)', True)):
        p = pasta_nova()
        arq = gerar_pfx(p / 'cert.pfx', dias=dias)
        escrever_config(p, sis, pfx=arq)
        srp.zerar()
        sis.zerar()
        antes = sorted(x.relative_to(p) for x in p.rglob('*'))
        cod, saida = ponte(p, srp, 'receita', 'conferir')
        ok(f'Certificado: {TITULAR}' in saida and espera in saida, f'conferir com {dias} dias: "{espera}"')
        ok(('ATENÇÃO' in saida) == destaque, '  em destaque' if destaque else '  sem destaque')
        if dias == 400:
            ok(cod == 0 and 'Token: ok' in saida and len(srp.auth) == 1, f'  token ok e configuração completa (saiu {cod})')
            ok('Sistema: respondeu ao ping' in saida and sis.pings == 1, '  e o ping do sistema')
            ok(sorted(x.relative_to(p) for x in p.rglob('*')) == antes and not srp.pedidos and not sis.pacotes,
               '  não grava arquivo, não chama o gateway, não manda pacote')
        if dias == -5:
            ok(cod == 1 and 'Token: não pedi' in saida, f'  vencido: não pede token e sai com 1 (saiu {cod})')
    # o conferir sem o .pfx no caminho e com a senha errada
    p = pasta_nova()
    escrever_config(p, sis, pfx=p / 'nao-existe.pfx')
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok(cod == 1 and 'certificado: inválido (o arquivo .pfx não está nesse caminho)' in saida, 'o .pfx que não existe')
    escrever_config(p, sis, pfx=gerar_pfx(p / 'c.pfx'), senha_certificado='outra-senha-errada')
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok(cod == 1 and 'a senha está errada' in saida and 'outra-senha-errada' not in saida,
       'a senha errada: diz, sem mostrar a senha')
    # campos: preenchido / falta / exemplo / inválido, nunca o valor
    escrever_config(p, sis, pfx=gerar_pfx(p / 'c.pfx'), consumer_key=None, consumer_secret='chave com acentuação',
                    cnpj_escritorio=A)
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok('consumer_key: falta' in saida and 'consumer_secret: inválido' in saida
       and 'cnpj_escritorio: inválido (o dígito verificador não confere)' in saida and 'acentuação' not in saida,
       'cada campo com a situação (falta, inválido), sem o valor')
    exemplo = (RAIZ / 'ponte' / 'config.exemplo.ini').read_text(encoding='utf-8')
    (p / 'config.ini').write_text(exemplo, encoding='utf-8')
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok('consumer_key: ainda é o do exemplo' in saida and 'Token: demonstração' in saida
       and 'cnpj_escritorio: ainda é o do exemplo' in saida, 'com o exemplo: "ainda é o do exemplo" e demonstração')


# ---------------------------------------------------------------- 3. cada serviço vira o bloco certo

def caso_servicos(srp, sis):
    titulo('3. cada serviço, com as respostas da demonstração, vira o bloco certo')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.eventos = {A: '261022'}
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal',
                       '--empresas', '1')
    pac = sis.ultimo()
    e = empresa(pac, A) or {}
    ok(cod == 0 and pac is not None, f'a rodada mandou o pacote (saiu {cod})')
    ok(e.get('autorizacao') == {'situacao': 'ativa', 'valida_ate': '2027-12-31'},
       f"autorizacao: ativa até 2027-12-31 (a maior das datas) — {e.get('autorizacao')}")
    meses = (e.get('pgdas') or {}).get('meses') or []
    por = {m['competencia']: m for m in meses}
    ok(e.get('pgdas', {}).get('ano') == 2018 and len(meses) == 12, 'pgdas: o ano da demonstração e os 12 meses')
    ok(por.get('2018-01') == {'competencia': '2018-01', 'transmitida_em': '2022-03-31T15:25:12-03:00', 'das_pago': False},
       f"pgdas: janeiro transmitido em 31/03/2022 15:25:12, DAS não pago — {por.get('2018-01')}")
    ok(por.get('2018-02', {}).get('transmitida_em') == '2022-06-06T15:30:46-03:00',
       'pgdas: a retificadora vale como a transmissão do mês')
    ok(por.get('2018-03', {}).get('das_pago') is None, 'pgdas: mês sem DAS = das_pago null')
    ok(e.get('faturamento') == {'competencia': '2018-12', 'receita_mes': 20000.0, 'receita_12_meses': 12000.0},
       f"faturamento: o mês mais recente, RPA 20.000,00 e RBT12 12.000,00 do PDF — {e.get('faturamento')}")
    ok(srp.servicos('CONSULTIMADECREC14') == [A]
       and json.loads(srp.pedidos[[p['servico'] for p in srp.pedidos].index('CONSULTIMADECREC14')]['pedido']
                      ['pedidoDados']['dados']) == {'periodoApuracao': '201812'},
       'faturamento: pede o período 201812')
    msgs = (e.get('caixa_postal') or {}).get('mensagens') or []
    ok(len(msgs) == 50 and msgs[0] == {'id': '0001493189', 'assunto':
       'Notificação de recebimento de mensagem e-MAC - Mensagem nº 083548 (complemento)', 'enviada_em': '2022-08-02',
       'origem': 'Receita', 'lida': False}, 'caixa_postal: as 50 mensagens, com id, assunto, data, origem e lida')
    lista = json.loads(srp.fixtures['MSGCONTRIBUINTE61']['dados'])['conteudo'][0]['listaMensagens']
    ok([m['lida'] for m in msgs] == [m['indicadorLeitura'] == '1' for m in lista]
       and 0 < sum(1 for m in msgs if m['lida']) < 50, 'caixa_postal: as lidas e as não lidas como vieram')
    lote = srp.pedidos[[p['servico'] for p in srp.pedidos].index('SOLICEVENTOSPJ132')]['pedido']
    ok(lote['contribuinte'] == {'numero': A, 'tipo': 4} and json.loads(lote['pedidoDados']['dados']) == {'evento': 'E0601'},
       'eventos: o lote de CNPJs (tipo 4), evento E0601 (Caixa Postal)')
    ok(e.get('situacao_fiscal') == {'consultada_em': '2026-10-23', 'pendencias': []},
       f"situacao_fiscal: \"Não foram detectadas pendências\" = lista vazia — {e.get('situacao_fiscal')}")
    ok(srp.servicos('SOLICITARPROTOCOLO91') == [A] and srp.servicos('RELATORIOSITFIS92') == [A],
       'situacao_fiscal: o pedido (Apoiar) e o relatório (Emitir)')
    ok([p['endpoint'] for p in srp.pedidos if p['servico'] == 'SOLICITARPROTOCOLO91'] == ['Apoiar']
       and [p['endpoint'] for p in srp.pedidos if p['servico'] == 'RELATORIOSITFIS92'] == ['Emitir'],
       'os endpoints certos')
    ok(faltou(pac) == [], 'nada no faltou')
    ok(pac and pac['tipo'] == 'receita' and pac['versao'] == 1 and pac['rodada']['ponte'] == '0.2.0'
       and pac['rodada']['ambiente'] == 'producao', 'o pacote: tipo receita, versão 1, ponte 0.2.0, produção')
    ok(pac and pac['rodada']['chamadas_mes'] == len(srp.pedidos), f'chamadas_mes = as chamadas do mês ({len(srp.pedidos)})')

    # a autorização vencida (a da demonstração, de 2023)
    srp.zerar()
    srp.procuracao_ate = None
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao,pgdas', '--empresas', '1')
    pac = sis.ultimo()
    ok((empresa(pac, A) or {}).get('autorizacao') == {'situacao': 'vencida', 'valida_ate': '2023-04-14'},
       'a procuração da demonstração (2023): vencida')
    ok(faltou(pac, A) == [(A, 'pgdas', 'sem_autorizacao')] and not srp.servicos('CONSDECLARACAO13'),
       'vencida: o pgdas vai pro faltou como sem_autorizacao, sem chamar')
    # sem procuração (o aviso 40400)
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [{'status': 200, 'dados': '', 'mensagens': [
        {'codigo': '[Aviso-PROCURACOES-40400]', 'texto': 'Não possui procuração ativa.'}]}]
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao,situacao_fiscal', '--empresas', '1')
    pac = sis.ultimo()
    ok((empresa(pac, A) or {}).get('autorizacao') == {'situacao': 'sem', 'valida_ate': None}
       and faltou(pac, A) == [(A, 'situacao_fiscal', 'sem_autorizacao')] and not srp.servicos('SOLICITARPROTOCOLO91'),
       'sem procuração: situacao "sem", e o resto sem_autorizacao sem chamar')

    # os centavos: a declaração e o relatório com valores e pendências de verdade (PDFs montados aqui)
    srp.zerar()
    srp.filas['CONSULTIMADECREC14'] = [com_pdf(srp, 'CONSULTIMADECREC14', pdf_simples([
        'Declaração do Simples Nacional',
        'Receita Bruta do PA (RPA) - Competência   84.211,50   0,00   84.211,50',
        'Receita bruta acumulada nos doze meses anteriores ao PA (RBT12)   912.000,07   0,00   912.000,07',
        'Receita bruta acumulada nos doze meses anteriores ao PA proporcionalizada (RBT12p)   1,00   0,00   1,00']))]
    srp.filas['RELATORIOSITFIS92'] = [com_pdf(srp, 'RELATORIOSITFIS92', pdf_simples([
        'Diagnóstico Fiscal na Receita Federal', 'Pendência - Débito (SIEF)', 'Omissão de declaração',
        'Diagnóstico Fiscal na Procuradoria-Geral da Fazenda Nacional', 'Pendência - Inscrição (SIDA)']))]
    sis.zerar()
    pasta2 = pasta_nova()
    escrever_config(pasta2, sis)
    rodar(pasta2, srp, '--so', 'pgdas,faturamento,situacao_fiscal', '--empresas', '1')
    e = empresa(sis.ultimo(), A) or {}
    ok(e.get('faturamento') == {'competencia': '2018-12', 'receita_mes': 84211.5, 'receita_12_meses': 912000.07},
       f"os centavos: RPA 84.211,50 e RBT12 912.000,07 (e não o RBT12p) — {e.get('faturamento')}")
    ok(e.get('situacao_fiscal', {}).get('pendencias') == [
        {'orgao': 'Receita', 'titulo': 'Pendência - Débito (SIEF)'}, {'orgao': 'Receita', 'titulo': 'Omissão de declaração'},
        {'orgao': 'PGFN', 'titulo': 'Pendência - Inscrição (SIDA)'}],
       'as pendências: o título de cada uma e o órgão (Receita ou PGFN)')

    # o relatório que ainda não ficou pronto: 204 com a espera no ETag, e pede de novo
    srp.zerar()
    srp.filas['RELATORIOSITFIS92'] = [(204, None, {'ETag': '"tempoEspera:10"'})]
    sis.zerar()
    rodar(pasta2, srp, '--so', 'situacao_fiscal', '--empresas', '1')
    ok(srp.servicos('RELATORIOSITFIS92') == [A, A] and (empresa(sis.ultimo(), A) or {}).get('situacao_fiscal'),
       'relatório ainda processando (204 + ETag tempoEspera): espera e pede de novo')


# ---------------------------------------------------------------- 4. acesso negado, novas tentativas, teto

def caso_respostas(srp, sis):
    titulo('4. acesso negado sem repetir; 503, 503, 200 = foi na terceira; o teto para com `teto`')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.por_doc[('CONSDECLARACAO13', A)] = [403]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'pgdas')
    pac = sis.ultimo()
    ok(cod == 0 and faltou(pac) == [(A, 'pgdas', 'sem_autorizacao')], f'403 = sem_autorizacao (saiu {cod})')
    ok(srp.servicos('CONSDECLARACAO13') == [A], 'e não repete (uma chamada só)')
    srp.zerar()
    srp.por_doc[('OBTERPROCURACAO41', A)] = [403]
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao,pgdas,situacao_fiscal')
    pac = sis.ultimo()
    ok(faltou(pac, A) == [(A, 'autorizacao', 'sem_autorizacao'), (A, 'pgdas', 'sem_autorizacao'),
                          (A, 'situacao_fiscal', 'sem_autorizacao')]
       and A not in srp.servicos('CONSDECLARACAO13') + srp.servicos('SOLICITARPROTOCOLO91'),
       'a procuração com acesso negado: as outras da empresa nem são chamadas')
    ok(empresa(pac, B) and empresa(pac, B).get('situacao_fiscal') is not None, 'as outras empresas seguem')
    srp.zerar()
    srp.filas['MSGCONTRIBUINTE61'] = [{'status': 200, 'dados': '', 'mensagens': [
        {'codigo': '[AcessoNegado-CAIXAPOSTAL-01]', 'texto': 'sem autorização'}]}]
    srp.eventos = {A: '261020'}
    sis.zerar()
    rodar(pasta, srp, '--so', 'caixa_postal')
    ok(faltou(sis.ultimo()) == [(A, 'caixa_postal', 'sem_autorizacao')] and srp.servicos('MSGCONTRIBUINTE61') == [A],
       'a mensagem AcessoNegado (com HTTP 200) também é sem_autorizacao, sem repetir')
    srp.zerar()
    srp.eventos = {A: '261020', B: 'x'}
    sis.zerar()
    rodar(pasta, srp, '--so', 'caixa_postal')
    ok((B, 'caixa_postal', 'sem_autorizacao') in faltou(sis.ultimo()) and B not in srp.servicos('MSGCONTRIBUINTE61'),
       'o "x" no lote de eventos = sem autorização, sem pedir as mensagens')

    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [503, 503]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'pgdas')
    ok(cod == 0 and srp.servicos('CONSDECLARACAO13') == [A, A, A] and (empresa(sis.ultimo(), A) or {}).get('pgdas'),
       f'503, 503, 200: foi na terceira (chamadas: {len(srp.servicos("CONSDECLARACAO13"))})')
    ok('tento de novo' in saida, 'e o log diz que tentou de novo')
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [429, 200]
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas')
    ok(len(srp.servicos('CONSDECLARACAO13')) == 2, '429 também tenta de novo')
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [503, 503, 503, 503]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao,situacao_fiscal')
    pac = sis.ultimo()
    ok(cod == 0 and pac and all(m == 'erro' for _, _, m in faltou(pac)) and len(faltou(pac)) == 6
       and len(srp.pedidos) == 4, f'o Serpro fora: 4 tentativas, depois o resto vai como erro sem chamar '
       f'(chamadas {len(srp.pedidos)}, faltou {len(faltou(pac or {}))})')
    ok(saida.count('não veio') == 1, 'e o log diz uma vez, não uma por empresa')
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [{'status': 400, 'dados': '', 'mensagens': [
        {'codigo': '[EntradaIncorreta-PGDASD-01]', 'texto': 'Ano-calendário inválido'}]}]
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas')
    ok(faltou(sis.ultimo()) == [(A, 'pgdas', 'erro')] and 'Ano-calendário inválido' in logs(pasta)
       and len(srp.servicos('CONSDECLARACAO13')) == 1, 'outra recusa = erro com a mensagem do Serpro, sem repetir')
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [(302, {'status': 302}, {'Location': 'http://127.0.0.1:9/outro'})]
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao')
    ok(cod == 2 and len(srp.pedidos) == 1, f'redirecionamento não é seguido: sai com 2 (saiu {cod})')

    # o teto
    pasta = pasta_nova()
    escrever_config(pasta, sis, teto=3)
    srp.zerar()
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'autorizacao,pgdas,situacao_fiscal')
    pac = sis.ultimo()
    ok(cod == 0 and len(srp.pedidos) == 3, f'teto 3: três chamadas e para (foram {len(srp.pedidos)})')
    ok(faltou(pac) == sorted([(A, 'pgdas', 'teto'), (A, 'situacao_fiscal', 'teto'), (B, 'situacao_fiscal', 'teto'),
                              (C, 'situacao_fiscal', 'teto')]), 'o que faltou vai com motivo teto')
    ok('teto' in logs(pasta) and pac['rodada']['chamadas_mes'] == 3, 'o log avisa e o pacote diz as 3 chamadas do mês')
    contas = json.loads((pasta / 'receita' / 'chamadas-2026-10.json').read_text(encoding='utf-8'))
    ok(contas == {'OBTERPROCURACAO41': 3}, f'chamadas-2026-10.json conta por serviço — {contas}')
    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao')
    ok(not srp.pedidos and len(faltou(sis.ultimo())) == 3, 'no mesmo mês, a rodada seguinte já começa no teto')
    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao', hoje='2026-11-03')
    ok(len(srp.pedidos) == 3, 'no mês seguinte, conta de novo')


# ---------------------------------------------------------------- 5. o calendário

def caso_calendario(srp, sis):
    titulo('5. o calendário: dia 21, dia 5, último dia útil, sábado, --so; o já lido não volta')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.eventos = {A: '261001'}
    sis.zerar()
    cod, saida = rodar(pasta, srp, hoje='2026-10-01')                 # quinta, primeiro dia útil
    ok(cod == 0 and sorted(srp.servicos('OBTERPROCURACAO41')) == sorted([A, B, C]),
       'primeiro dia útil: a autorização de todas')
    ok(not srp.servicos('CONSDECLARACAO13') and not srp.servicos('SOLICITARPROTOCOLO91'),
       'e nem pgdas nem situação fiscal')
    ok(srp.servicos('MSGCONTRIBUINTE61') == [A] and len((empresa(sis.ultimo(), A) or {}).get('caixa_postal', {})
                                                       .get('mensagens', [])) == 50,
       'caixa postal todo dia: as mensagens só de quem teve novidade')
    est = estado(pasta) or {}
    ok(len(est.get('mensagens', {}).get(A, [])) == 50 and est.get('eventos', {}).get(A) == '261001',
       'o estado.json guardou as mensagens mandadas e a data da novidade')

    srp.zerar()
    srp.eventos = {A: '261001'}
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-05')                              # segunda, dia 5
    ok(sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]), 'dia 5: a situação fiscal de todas')
    ok(not srp.servicos('OBTERPROCURACAO41') and not srp.servicos('CONSDECLARACAO13'),
       'sem autorização (já consultada) e sem pgdas')
    ok(not srp.servicos('MSGCONTRIBUINTE61') and srp.servicos('SOLICEVENTOSPJ132'),
       'a mesma data de novidade: não pede as mensagens de novo')

    srp.zerar()
    srp.eventos = {A: '261021', B: '261021'}
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-21')                              # quarta, dia 21
    pac = sis.ultimo()
    ok(srp.servicos('CONSDECLARACAO13') == [A], 'dia 21: o pgdas só do Simples')
    ok(srp.servicos('CONSULTIMADECREC14') == [A] and (empresa(pac, A) or {}).get('faturamento'),
       'e a declaração ainda não lida (o faturamento)')
    ok(not srp.servicos('SOLICITARPROTOCOLO91'), 'sem situação fiscal')
    ok(sorted(srp.servicos('MSGCONTRIBUINTE61')) == [A, B]
       and (empresa(pac, A) or {}).get('caixa_postal') == {'mensagens': []}
       and len((empresa(pac, B) or {}).get('caixa_postal', {}).get('mensagens', [])) == 50,
       'novidade de novo: a mensagem já mandada não volta (a da outra empresa vai)')

    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas,faturamento', hoje='2026-10-22')
    ok(srp.servicos('CONSDECLARACAO13') == [A] and not srp.servicos('CONSULTIMADECREC14'),
       'a declaração já lida (a mesma transmissão) não é lida de novo')
    srp.zerar()
    srp.pgdas_ano = '2026'
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas,faturamento', hoje='2026-10-22')
    ok(srp.servicos('CONSULTIMADECREC14') == [A]
       and (empresa(sis.ultimo(), A) or {}).get('faturamento', {}).get('competencia') == '2026-12',
       'um mês novo declarado: lê a declaração dele')

    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-30')                              # sexta, último dia útil
    ok(not srp.servicos('CONSDECLARACAO13'), 'último dia útil: quem já tem o mês anterior não consulta o pgdas')
    p2 = pasta_nova()
    escrever_config(p2, sis)
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, hoje='2026-10-30')
    ok(srp.servicos('CONSDECLARACAO13') == [A], 'último dia útil: quem não tem o mês anterior consulta')
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, hoje='2026-01-21')                                 # janeiro: o ano anterior também
    anos = [json.loads(p['pedido']['pedidoDados']['dados'])['anoCalendario'] for p in srp.pedidos
            if p['servico'] == 'CONSDECLARACAO13']
    ok(anos == ['2025', '2026'], f'em janeiro, o ano anterior também ({anos})')

    srp.zerar()
    sis.zerar()
    cod, saida = rodar(pasta, srp, hoje='2026-10-24')                 # sábado
    ok(cod == 0 and not srp.pedidos and not srp.auth and not sis.pedidos_empresas and not sis.pacotes,
       f'sábado: nada (nem token, nem lista de empresas) — saiu {cod}')
    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'situacao_fiscal', hoje='2026-10-24')
    ok(sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]) and not srp.servicos('SOLICEVENTOSPJ132'),
       '--so passa por cima do calendário (sábado, só a situação fiscal)')
    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas', '--empresas', '2', hoje='2026-10-24')
    ok(srp.servicos('CONSDECLARACAO13') == [A], '--so pgdas: só o Simples, e --empresas 2 corta a lista')
    cod, saida = rodar(pasta, srp, '--so', 'pgdas,qualquer')
    ok(cod == 2 and 'não conheço: qualquer' in saida, '--so com serviço que não existe: recusa')


# ---------------------------------------------------------------- 6. o que sai

def conferir_contrato(pac):
    problemas = []
    if set(pac) != CONTRATO_TOPO:
        problemas.append(f'topo {sorted(pac)}')
    if set(pac['rodada']) != CONTRATO_RODADA:
        problemas.append(f"rodada {sorted(pac['rodada'])}")
    for e in pac['empresas']:
        if not set(e) <= {'documento'} | set(CONTRATO_BLOCOS):
            problemas.append(f'empresa {sorted(e)}')
        for s, campos in CONTRATO_BLOCOS.items():
            if s in e and set(e[s]) != campos:
                problemas.append(f'{s} {sorted(e[s])}')
        for m in e.get('pgdas', {}).get('meses', []):
            if set(m) != CONTRATO_MES:
                problemas.append(f'mês {sorted(m)}')
        for m in e.get('caixa_postal', {}).get('mensagens', []):
            if set(m) != CONTRATO_MENSAGEM:
                problemas.append(f'mensagem {sorted(m)}')
        for p in (e.get('situacao_fiscal', {}).get('pendencias') or []):
            if set(p) != CONTRATO_PENDENCIA:
                problemas.append(f'pendência {sorted(p)}')
    for f in pac['faltou']:
        if set(f) != CONTRATO_FALTOU:
            problemas.append(f'faltou {sorted(f)}')
    return problemas


def caso_o_que_sai(srp, sis):
    titulo('6. o que sai: só o contrato; o assunto não vai pro log; o PDF e o texto da mensagem nunca vão')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.eventos = {A: '261022'}
    srp.extra_mensagem = True
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal', '--saida', 'pacote.json')
    pac = sis.ultimo()
    ok(pac is not None and conferir_contrato(pac) == [], f'só os campos do contrato: {conferir_contrato(pac) if pac else "-"}')
    bruto = json.dumps(pac, ensure_ascii=False)
    ok(TEXTO_INTEIRO not in bruto, 'o texto inteiro da mensagem (um campo a mais na resposta) não vai')
    ok('JVBER' not in bruto and '"pdf"' not in bruto, 'nenhum PDF (nem em base64) no pacote')
    ok('PGDASD-DECLARACAO' not in bruto and 'numeroDeclaracao' not in bruto and 'cnpjMatriz' not in bruto,
       'nada da resposta do Serpro além do contrato')
    log = logs(pasta)
    ok('e-MAC' not in log and 'Dossiê' not in log and TEXTO_INTEIRO not in log, 'o assunto das mensagens não vai pro log')
    ok('50 mensagem(ns) nova(s)' in log, 'o log diz só quantas')
    ok((pasta / 'pacote.json').is_file() and json.loads((pasta / 'pacote.json').read_text(encoding='utf-8'))['tipo']
       == 'receita', '--saida sem pasta grava na pasta da ponte (nunca na de onde se roda)')
    ok(not (RAIZ / 'pacote.json').exists(), '  e não na pasta do repositório')
    pdfs = sorted((pasta / 'receita' / 'pdfs').glob('*.pdf'))
    ok(len(pdfs) == 4 and all(p.read_bytes().startswith(b'%PDF') for p in pdfs),
       f'os PDFs (a declaração e as 3 situações fiscais) ficam em receita\\pdfs ({len(pdfs)})')
    cab = sis.pacotes[-1]['cabecalhos']
    ok(cab.get('x-chave') == CHAVE_PONTE and cab.get('apikey') == CHAVE_PUBLICA
       and cab.get('authorization') == f'Bearer {CHAVE_PUBLICA}', 'os cabeçalhos do envio são os do Domínio')
    ok(sis.pedidos_empresas and sis.pedidos_empresas[0].get('x-chave') == CHAVE_PONTE,
       'o pedido da lista de empresas também leva a chave da ponte')

    # a trava do pacote: o que vier a mais é descartado
    from ponte.receita import pacote
    p = pacote.montar({A: {'autorizacao': {'situacao': 'ativa', 'valida_ate': '2027-01-01', 'nome': 'CLIENTE X'},
                           'caixa_postal': {'mensagens': [{'id': '1', 'assunto': 'a', 'enviada_em': '2026-10-01',
                                                           'origem': 'Receita', 'lida': False, 'texto': TEXTO_INTEIRO}]},
                           'faturamento': {'competencia': '2026-09', 'receita_mes': '84211.499', 'receita_12_meses': 1,
                                           'pdf': 'JVBERi0x'},
                           'outra_coisa': {'x': 1}}},
                      [{'documento': A, 'servico': 'pgdas', 'motivo': 'teto', 'detalhe': 'segredo'},
                       {'documento': A, 'servico': 'inventado', 'motivo': 'erro'}], 'i', 'f', 'producao', 7)
    bruto = json.dumps(p, ensure_ascii=False)
    ok(conferir_contrato(p) == [] and 'CLIENTE X' not in bruto and TEXTO_INTEIRO not in bruto and 'JVBER' not in bruto
       and 'outra_coisa' not in bruto and 'segredo' not in bruto,
       'pacote.montar descarta o que não é do contrato (nome, texto, pdf, bloco e serviço inventados)')
    ok(p['empresas'][0]['faturamento']['receita_mes'] == 84211.5, 'e arredonda o valor nos centavos')


# ---------------------------------------------------------------- 7. segredos

def caso_segredos(srp, sis):
    titulo('7. segredo nunca aparece: consumer key e secret, a senha do certificado, os tokens')
    pasta = pasta_nova()
    escrever_config(pasta, sis, pfx=gerar_pfx(pasta / 'escritorio.pfx'))
    srp.zerar()
    sis.zerar()
    ponte(pasta, srp, 'receita', 'conferir')
    srp.zerar()
    srp.eventos = {A: '261022'}
    sis.zerar(503, 503, 503, 503)                                       # o sistema fora: vai pra pendentes
    rodar(pasta, srp, '--so', 'autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal', '--saida', 's.json')
    # o Serpro devolve o token na mensagem de erro (um eco): o log tem que esconder
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [{'status': 400, 'dados': '', 'mensagens': [
        {'codigo': '[Erro-TESTE]', 'texto': 'token ACCESS-TOKEN-DE-TESTE-1 e JWT-DE-TESTE-1 recusados'}]}]
    sis.zerar(503, 503, 503, 503)
    rodar(pasta, srp, '--so', 'pgdas')
    srp.zerar()
    srp.filas['OBTERPROCURACAO41'] = [401, 401]
    rodar(pasta, srp, '--so', 'autorizacao')
    ok('token *** e *** recusados' in logs(pasta), 'o eco do token no erro do Serpro saiu como *** no log')
    arquivos = [a for a in pasta.rglob('*') if a.is_file() and a.name != 'config.ini' and a.suffix != '.pfx']
    ok(any(a.parent.name == 'logs' for a in arquivos) and any(a.parent.name == 'pendentes' for a in arquivos),
       'houve log e pendente pra conferir')
    basic = base64.b64encode(f'{KEY}:{SECRET}'.encode()).decode()
    tudo = '\n'.join(SAIDAS) + '\n'.join(a.read_text(encoding='utf-8', errors='replace') for a in arquivos)
    tudo += json.dumps([p['corpo'] for p in sis.pacotes])
    for nome, s in (('a consumer_key', KEY), ('a consumer_secret', SECRET), ('o Basic', basic),
                    ('a senha do certificado', SENHA_PFX), ('o access_token', 'ACCESS-TOKEN-DE-TESTE'),
                    ('o jwt_token', 'JWT-DE-TESTE'), ('a chave da ponte', CHAVE_PONTE)):
        ok(s not in tudo, f'{nome} não está na tela, no log, no pacote, na --saida nem nos pendentes')

    # o Registro de verdade, com os segredos do config.ini e os tokens que o Cliente acrescenta
    from ponte import config
    from ponte.log import Registro, ocultar

    def registrar():
        cfg = config.carregar()
        reg = Registro(pasta / 'logs-registro', cfg.segredos())
        cli = cliente(srp, pasta, reg)
        cli.token()
        reg(f'erro: key {KEY} secret {SECRET} senha {SENHA_PFX} basic {basic} token ACCESS-TOKEN-DE-TESTE-1 '
            f'jwt JWT-DE-TESTE-1', 'erro')
        reg.tela(f'na tela: {KEY} {SENHA_PFX} ACCESS-TOKEN-DE-TESTE-1')
    srp.zerar()
    _, tela = no_processo(pasta, srp, registrar)
    escrito = tela + ''.join(a.read_text(encoding='utf-8') for a in (pasta / 'logs-registro').glob('*.log'))
    ok('***' in escrito and not any(s in escrito for s in (KEY, SECRET, SENHA_PFX, basic, 'ACCESS-TOKEN-DE-TESTE',
                                                           'JWT-DE-TESTE')),
       'o Registro da ponte oculta todos, na tela e no log')
    ok(ocultar('Authorization: Bearer abcdefghij123456') == 'Authorization: Bearer ***'
       and ocultar('{"access_token": "abcdefghij123456"}') == '{"access_token": "***"}',
       'token que o log não conhecia (Bearer, access_token) também vira ***')


# ---------------------------------------------------------------- 8. PDF ilegível

def caso_pdf_ilegivel(srp, sis):
    titulo('8. PDF que não dá pra ler = null e a_conferir, o PDF guardado')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.filas['CONSULTIMADECREC14'] = [com_pdf(srp, 'CONSULTIMADECREC14', b'isto nao e um pdf')]
    srp.filas['RELATORIOSITFIS92'] = [com_pdf(srp, 'RELATORIOSITFIS92',
                                              pdf_simples(['Um relatório com outro texto qualquer']))]
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'pgdas,faturamento,situacao_fiscal', '--empresas', '1')
    pac = sis.ultimo()
    e = empresa(pac, A) or {}
    ok(cod == 0 and e.get('faturamento') == {'competencia': '2018-12', 'receita_mes': None, 'receita_12_meses': None},
       f"a declaração ilegível: receita null, nunca um número inventado — {e.get('faturamento')}")
    ok(e.get('situacao_fiscal') == {'consultada_em': '2026-10-23', 'pendencias': None},
       'o relatório sem o que procurar: pendencias null')
    ok(faltou(pac) == [(A, 'faturamento', 'a_conferir'), (A, 'situacao_fiscal', 'a_conferir')],
       'os dois vão pro faltou com a_conferir')
    pdfs = sorted(p.name for p in (pasta / 'receita' / 'pdfs').glob('*.pdf'))
    ok(pdfs == [f'{A}-declaracao-2018-12.pdf', f'{A}-situacao-fiscal-2026-10-23.pdf'],
       f'os PDFs ficam guardados pra ajustar a leitura ({pdfs})')
    ok(((pasta / 'receita' / 'pdfs' / f'{A}-declaracao-2018-12.pdf').read_bytes() == b'isto nao e um pdf'),
       '  como vieram')
    ok('a conferir' in logs(pasta), 'o log diz o que ficou a conferir')
    ok('2018-12' not in (estado(pasta) or {}).get('declaracoes_lidas', {}).get(A, {}),
       'a declaração não lida não fica marcada como lida (a próxima tenta de novo)')
    # PDF velho é apagado
    velho = pasta / 'receita' / 'pdfs' / 'velho.pdf'
    velho.write_bytes(b'%PDF')
    t = (datetime.datetime.now() - datetime.timedelta(days=31)).timestamp()
    os.utime(velho, (t, t))
    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, '--so', 'autorizacao', '--empresas', '1')
    ok(not velho.exists() and len(list((pasta / 'receita' / 'pdfs').glob('*.pdf'))) == 2,
       'o PDF de mais de 30 dias é apagado (os novos ficam)')


# ---------------------------------------------------------------- + a lista, os pendentes, o --falso, a demonstração

def caso_envio(srp, sis):
    titulo('+ a lista de empresas, os pendentes, o --falso e a demonstração')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    sis.zerar(empresas_status=404)
    cod, saida = rodar(pasta, srp)
    ok(cod == 1 and not srp.pedidos and not srp.auth and not sis.pacotes,
       f'sem a lista de empresas: não consulta nada, avisa e sai com 1 (saiu {cod})')
    ok('ainda não foi publicada' in saida, '  e diz que a função do sistema não está publicada (404)')
    srp.zerar()
    sis.zerar(empresas=[{'documento': '11.222.333/0001-00', 'regime': 'SIMPLES'}, {'documento': A, 'regime': 'mei'},
                        {'documento': 'abc'}, {'documento': '123', 'regime': 'real'}])
    rodar(pasta, srp, '--so', 'pgdas')
    ok(srp.servicos('CONSDECLARACAO13') == [A] and 'ficaram de fora' in logs(pasta),
       'a lista: documento com pontuação vale, repetido e inválido ficam de fora')

    # os pendentes: o sistema fora guarda; a rodada seguinte manda o pendente primeiro
    srp.zerar()
    srp.eventos = {A: '261020'}
    sis.zerar(503, 503, 503, 503)
    cod, saida = rodar(pasta, srp, '--so', 'caixa_postal')
    ok(cod == 1 and len(pendentes(pasta)) == 1, f'o sistema fora: o pacote fica em pendentes e sai com 1 (saiu {cod})')
    ok(len((estado(pasta) or {}).get('mensagens', {}).get(A, [])) == 50,
       'guardado em pendentes conta como mandado: as mensagens não voltam na próxima')
    srp.zerar()
    srp.eventos = {A: '261021'}
    sis.zerar()
    cod, saida = rodar(pasta, srp, '--so', 'caixa_postal')
    ok(cod == 0 and not pendentes(pasta) and len(sis.pacotes) == 2
       and len(sis.pacotes[0]['corpo']['empresas'][0]['caixa_postal']['mensagens']) == 50
       and sis.pacotes[1]['corpo']['empresas'][0]['caixa_postal']['mensagens'] == [],
       'a rodada seguinte manda o pendente primeiro e o apaga')
    p2 = pasta_nova()
    escrever_config(p2, sis)
    srp.zerar()
    srp.eventos = {A: '261020'}
    sis.zerar(401)
    cod, saida = rodar(p2, srp, '--so', 'caixa_postal')
    ok(cod == 2 and not pendentes(p2), f'a chave recusada (401): sai com 2, sem pendente (saiu {cod})')
    ok(not (estado(p2) or {}).get('mensagens', {}).get(A), '  e não marca nada como mandado')
    srp.zerar()
    srp.eventos = {A: '261020'}
    sis.zerar()
    cod, saida = rodar(p2, srp, '--so', 'caixa_postal', '--sem-enviar')
    ok(cod == 0 and not sis.pacotes and srp.servicos('MSGCONTRIBUINTE61') and estado(p2) is None,
       '--sem-enviar consulta, não manda e não marca nada como lido')
    ok((p2 / 'receita' / 'chamadas-2026-10.json').is_file(), '  mas conta as chamadas no teto (elas custam)')

    # --falso: o Serpro de mentira da ponte, só pra endereço local, sem tocar nos pendentes
    p3 = pasta_nova()
    escrever_config(p3, sis)
    (p3 / 'pendentes').mkdir()
    pend = p3 / 'pendentes' / '20261020-070000-aaaaaaaa.json'
    pend.write_text('{"versao": 1}', encoding='utf-8')
    srp.zerar()
    sis.zerar()
    cod, saida = rodar(p3, srp, '--falso')
    ok(cod == 0 and len(sis.pacotes) == 1 and sis.pacotes[0]['corpo']['rodada']['ambiente'] == 'falso'
       and not srp.pedidos and not sis.pedidos_empresas, f'--falso manda pro sistema local, sem o Serpro de verdade (saiu {cod})')
    ok(pend.exists() and estado(p3) is None and not (p3 / 'receita' / 'chamadas-2026-10.json').exists(),
       '  sem tocar nos pendentes, sem estado e sem contar no teto')
    escrever_config(p3, sis, url='https://sistema-de-verdade.example/functions/v1/ponte-dominio')
    cod, saida = rodar(p3, srp, '--falso')
    ok(cod == 2 and 'endereço local' in saida, '--falso com o sistema de verdade: recusa (sai com 2)')
    cod, saida = rodar(p3, srp, '--falso', '--demonstracao')
    ok(cod == 2, '--falso e --demonstracao juntos: recusa')

    # a demonstração: os corpos dos cenários do Serpro, sem chamar a internet aqui
    from ponte.receita import demonstracao, serpro
    cli = serpro.Cliente('demonstracao', '99999999999999', None, None, pasta / 'tmp')
    ok(cli.gateway == demonstracao.GATEWAY and cli.token() == (demonstracao.TOKEN, demonstracao.TOKEN),
       'demonstração: o gateway trial e o token público')
    ok(all(cli.corpo(s.split('-')[0], s.split('-')[1], A, {}) == demonstracao.corpo(s.split('-')[1])
           for s in ('PGDASD-CONSDECLARACAO13', 'CAIXAPOSTAL-MSGCONTRIBUINTE61', 'SITFIS-RELATORIOSITFIS92')),
       'demonstração: cada pedido vai com o corpo do cenário do Serpro')
    ok(all(demonstracao.corpo(nome.split('-', 1)[1]) is not None for nome in (p.stem for p in FIXTURES.glob('*.json'))),
       'demonstração: há cenário pra cada serviço das fixtures')
    p5 = pasta_nova()
    escrever_config(p5, sis, ambiente='demonstracao', consumer_key=None, consumer_secret=None, certificado=None,
                    senha_certificado=None, cnpj_escritorio='99999999999999')
    srp.zerar()
    srp.eventos = {demonstracao.EMPRESAS[0]['documento']: '261022'}
    sis.zerar()
    cod, saida = rodar(p5, srp, '--demonstracao', '--so', 'autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal')
    pac = sis.ultimo() or {'rodada': {}}
    ok(cod == 0 and pac['rodada'].get('ambiente') == 'demonstracao' and pac['rodada'].get('chamadas_mes') == 0
       and len(pac.get('empresas', [])) == 1, f'--demonstracao manda o pacote com ambiente "demonstracao" (saiu {cod})')
    ok(not srp.auth and srp.pedidos and all(p['cabecalhos'].get('authorization') == f'Bearer {demonstracao.TOKEN}'
                                            for p in srp.pedidos), '  com o token público, sem pedir token')
    ok(all(p['pedido'] == demonstracao.corpo(p['servico']) for p in srp.pedidos),
       '  cada pedido com o corpo do cenário do Serpro')
    ok(estado(p5) is None and not list((p5 / 'receita').glob('chamadas-*.json')) and not pendentes(p5),
       '  sem estado, sem contar no teto, sem pendentes')
    p4 = pasta_nova()
    cod, saida = rodar(p4, srp, '--demonstracao', '--sem-enviar')
    ok(cod == 2 and 'não achei' in saida, 'demonstração sem config.ini: diz o que falta')
    escrever_config(p4, sis, ambiente='demonstracao', consumer_key=None, consumer_secret=None, certificado=None,
                    senha_certificado=None, cnpj_escritorio=None)
    cod, saida = rodar(p4, srp, '--demonstracao', '--sem-enviar')
    ok(cod == 2 and 'cnpj_escritorio' in saida, 'demonstração sem o cnpj_escritorio: sai com 2')
    escrever_config(p4, sis, ambiente='producao', consumer_key=None)
    cod, saida = rodar(p4, srp)
    ok(cod == 2 and 'integra.consumer_key (falta)' in saida and not srp.auth, 'produção sem a consumer_key: sai com 2')
    escrever_config(p4, sis, cnpj=A)
    cod, saida = rodar(p4, srp)
    ok(cod == 2 and 'dígito verificador' in saida, 'produção com o CNPJ do escritório errado: sai com 2')


# ---------------------------------------------------------------- 9. a ponte do Domínio

def caso_dominio():
    titulo('9. o tests/ponte.test.py continua passando sem mudança')
    r = subprocess.run([sys.executable, str(RAIZ / 'tests' / 'ponte.test.py')], cwd=str(RAIZ), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=600,
                       env=dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1'))
    ok(r.returncode == 0 and 'Tudo certo' in r.stdout, f'tests/ponte.test.py: saiu {r.returncode}')
    if r.returncode != 0:
        print('\n'.join(lin for lin in r.stdout.splitlines() if '✗' in lin))
    if shutil.which('git'):
        g = subprocess.run(['git', 'diff', '--quiet', 'origin/main', '--', 'tests/ponte.test.py'], cwd=str(RAIZ))
        ok(g.returncode == 0, 'e o arquivo é o mesmo da main')
    else:
        print('  (sem o git aqui: não conferi se o arquivo é o mesmo da main)')


def main():
    srp, sis = Serpro(), Sistema()
    try:
        for caso in (lambda: caso_token(srp, sis), lambda: caso_certificado(srp, sis), lambda: caso_servicos(srp, sis),
                     lambda: caso_respostas(srp, sis), lambda: caso_calendario(srp, sis),
                     lambda: caso_o_que_sai(srp, sis), lambda: caso_segredos(srp, sis),
                     lambda: caso_pdf_ilegivel(srp, sis), lambda: caso_envio(srp, sis), caso_dominio):
            try:
                caso()
            except Exception as e:   # um caso que quebra no meio não esconde os outros
                import traceback
                traceback.print_exc()
                ok(False, f'o caso parou com erro: {type(e).__name__}: {e}')
    finally:
        srp.fechar()
        sis.fechar()
        for p in PASTAS:
            shutil.rmtree(p, ignore_errors=True)
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
