"""Teste da ponte da Receita (ponte/receita/) — sem o Serpro, sem o sistema e sem internet. Precisa do Python 3.11+
com o cryptography e o pypdf (py -3 -m pip install cryptography pypdf) e do node (o validarPacote e os feriados de
verdade, em JavaScript).

    python tests/ponte-receita.test.py

Um Serpro de mentira (a entrada, /authenticate, e o gateway, servindo as respostas do ambiente de demonstração
guardadas em tests/fixtures/receita/ — as mensagens da Caixa Postal com datas recentes, que as de 2022 cairiam no filtro
dos 90 dias) e um sistema de mentira que responde como a função `ponte` de verdade (a chave pela impressão digital:
sem ela, 503; outra, 401; o ping; a lista de empresas; e o pacote conferido pelo validarPacote de
supabase/functions/ponte/receita.js, rodado no node — 422 se a rodada sair do contrato, 200 com as recusadas e, da
demonstração e do --falso, "gravado": false), os dois em http.server numa thread, porta 0. Cada caso usa uma pasta
temporária em PONTE_PASTA. Empresas, chaves, senhas e o certificado são todos inventados (os CNPJs das empresas com o
dígito verificador errado; o do escritório, com letras, montado aqui).

  1. token: o Basic certo, role-type TERCEIROS, grant_type=client_credentials; renova antes de vencer e numa 401;
     duas 401 seguidas = sai com 2
  2. certificado: um .pfx gerado aqui carrega; os arquivos temporários somem (também com a senha errada e com erro
     no meio); a chave vai cifrada pro disco; o conferir mostra o titular e os dias até vencer, o vencido em destaque
  3. cada serviço, com as respostas da demonstração, vira o bloco certo (os valores com os centavos)
  4. acesso negado = sem_autorizacao sem repetir; 503, 503, 200 = foi na terceira; o teto para com `teto`
  5. o calendário "a partir do dia": o dia marcado ou a primeira rodada depois dele (o PC desligado no dia 5 → a
     situação fiscal no 6, e no 7 não; o pgdas marcado pra terça 24/11/2026, o PC desligado → quarta 25); o pgdas
     só do Simples; sábado nada; --so passa por cima; a mensagem e a declaração já lidas não voltam
  6. o que sai: só o contrato; o assunto não vai pro log; o PDF e o texto da mensagem nunca vão pro pacote
  7. segredo nunca aparece (uma senha longa e única do certificado, consumer key e secret, os tokens — depois de uma
     rodada com a senha errada e outra com a certa); a senha curta ("2026") não apaga as datas do log
  8. PDF que não dá pra ler: o bloco não vai — só o faltou com a_conferir, o PDF guardado; a lista de pendências
     cortada em 100 vai, com o aviso no log
  9. o tests/ponte.test.py continua passando
  10. o item 4: a chave (py -3 -m ponte chave e a impressão no conferir), os feriados iguais aos do JavaScript
      (2023 a 2031), a autorização toda segunda pra quem estava sem, o limite da Caixa Postal (100 mais recentes, 90
      dias na primeira leitura, a lida que vai de novo), as mensagens do 503 e do 401 e as recusadas
  +  a lista de empresas que não vem, os pendentes, o --falso, a demonstração e o --saida — e todo pacote que a ponte
     mandou passou pelo validarPacote de verdade sem nenhuma recusa
Termina com código 1 se alguma checagem falhar.
"""
import base64
import copy
import datetime
import hashlib
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
NODE = shutil.which('node')
if not NODE:
    print('O teste da ponte da Receita precisa do node (o validarPacote da função e os feriados, em JavaScript).')
    sys.exit(1)
RECEITA_JS = RAIZ / 'supabase' / 'functions' / 'ponte' / 'receita.js'
FERIADOS_JS = RAIZ / 'assets' / 'js' / 'rescisao-datas.js'

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
SENHA_PFX = 'Senha-Longa-E-Unica-Do-Pfx-7f3a9c2e'     # longa e única: procurada em tudo que a ponte escreve
CHAVE_PONTE = 'SEGREDO-DA-PONTE-DE-TESTE'
IMPRESSAO = hashlib.sha256(CHAVE_PONTE.encode('utf-8')).hexdigest()
SEM_CHAVE = 'A chave da ponte ainda não foi cadastrada no sistema.'
RECADO = 'Mande esta impressão pro Claude da sessão do Samuel (ela não é segredo).'
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
            # as mensagens da demonstração são de 2022: com elas, a primeira leitura (só os últimos 90 dias) não mandaria
            # nada — aqui a mais nova é desta data e as outras, um dia pra trás cada, na mesma ordem
            self.mensagens_ate = datetime.date(2026, 10, 1)
            self.fora_do_lote = set()          # CNPJs pedidos no lote de eventos que não voltam na resposta

    def padrao(self, servico):
        if servico == 'OBTEREVENTOSPJ134':
            matriz = [[d, self.eventos.get(d, '')] for d in self.ultimo_lote if d and d not in self.fora_do_lote]
            return {'status': 200, 'mensagens': [{'codigo': '[Sucesso-EVENTOSATUALIZACAO]', 'texto': 'ok'}],
                    'dados': json.dumps(matriz)}
        r = copy.deepcopy(self.fixtures[servico])
        if servico == 'OBTERPROCURACAO41' and self.procuracao_ate:
            r['dados'] = r['dados'].replace('20230414', self.procuracao_ate)
        if servico == 'CONSDECLARACAO13' and self.pgdas_ano:
            r['dados'] = r['dados'].replace('2018', self.pgdas_ano)
        if servico == 'MSGCONTRIBUINTE61':
            d = json.loads(r['dados'])
            lista = d['conteudo'][0]['listaMensagens']
            ordem = sorted(range(len(lista)), key=lambda i: (lista[i]['dataEnvio'], -i), reverse=True)
            for pos, i in enumerate(ordem):
                lista[i]['dataEnvio'] = (self.mensagens_ate - datetime.timedelta(days=pos)).strftime('%Y%m%d')
            if self.extra_mensagem:
                for m in lista:
                    m['corpoMensagem'] = TEXTO_INTEIRO
            r['dados'] = json.dumps(d, ensure_ascii=False)
        return r

    def servicos(self, servico):
        """Os contribuintes de cada pedido daquele serviço, na ordem."""
        with self.trava:
            return [p['doc'] for p in self.pedidos if p['servico'] == servico]

    def fechar(self):
        self.srv.shutdown()


VALIDADOR = None     # o .mjs que roda o validarPacote de verdade (escrito numa pasta temporária no começo)


def validar_no_node(pac):
    """O validarPacote de supabase/functions/ponte/receita.js, rodado no node: {ok, campo, erro, recusadas, empresas}."""
    r = subprocess.run([NODE, str(VALIDADOR)], input=json.dumps(pac, ensure_ascii=False), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=60)
    if r.returncode != 0:
        raise RuntimeError('o validarPacote (node) quebrou: ' + (r.stderr or '')[-500:])
    return json.loads(r.stdout)


class Sistema:
    """A função `ponte` do sistema, como a de verdade (supabase/functions/ponte/servidor.js): a chave pela impressão
    digital (sem impressão cadastrada, 503; chave que não bate, 401), o ping, a lista de empresas e o pacote conferido
    pelo validarPacote de verdade (node) — 422 se a rodada sair do contrato; 200 com as recusadas; da demonstração e
    do --falso, "gravado": false. Na frente, pra simular o sistema fora ou a função não publicada, uma fila de
    respostas (o HTTP) pros pacotes e o empresas_status pra lista. `recusadas_extra` acrescenta recusadas à resposta
    (a ponte nunca manda um bloco fora do contrato — é pra ver o que ela faz com elas)."""

    def __init__(self):
        self.trava = threading.Lock()
        self.todas_validacoes = []          # todo pacote que a ponte mandou, conferido (nunca zerado)
        self.zerar()
        dono = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _enviar(self, codigo, corpo):
                bruto = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
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
                bruto = self.rfile.read(n)
                cab = {k.lower(): v for k, v in self.headers.items()}
                try:
                    corpo = json.loads(bruto.decode('utf-8'))
                except (ValueError, UnicodeDecodeError):
                    corpo = None
                with dono.trava:
                    if isinstance(corpo, dict) and corpo.get('pedir') == 'empresas':
                        dono.pedidos_empresas.append(cab)
                        if dono.empresas_status != 200:
                            return self._enviar(dono.empresas_status, {'erro': 'teste'})
                    elif isinstance(corpo, dict) and not corpo.get('ping'):
                        dono.pacotes.append({'cabecalhos': cab, 'corpo': corpo})
                        fila = dono.respostas.pop(0) if dono.respostas else None
                        if fila is not None:
                            return self._enviar(fila, {'erro': f'HTTP {fila} do teste'})
                    impressao, extra, empresas = dono.impressao, list(dono.recusadas_extra), copy.deepcopy(dono.empresas)
                # daqui pra baixo, como a função
                if not impressao:
                    return self._enviar(503, {'erro': SEM_CHAVE})
                if hashlib.sha256((cab.get('x-chave') or '').encode('utf-8')).hexdigest() != impressao:
                    return self._enviar(401, {'erro': 'Chave da ponte recusada.'})
                if not isinstance(corpo, dict):
                    return self._enviar(400, {'erro': 'O corpo não é um JSON.'})
                if corpo.get('versao') != 1:
                    return self._enviar(422, {'erro': 'Versão do pacote desconhecida (esta função lê a 1).'})
                if corpo.get('ping') is True:
                    with dono.trava:
                        dono.pings += 1
                    return self._enviar(200, {'ok': True, 'ponte': 'ok'})
                if corpo.get('tipo') == 'receita' and corpo.get('pedir') == 'empresas':
                    return self._enviar(200, {'empresas': empresas})
                if corpo.get('tipo') != 'receita':
                    return self._enviar(422, {'erro': 'Nada pra fazer com este pacote.'})
                v = validar_no_node(corpo)
                ambiente = (corpo.get('rodada') or {}).get('ambiente')
                with dono.trava:
                    registro = {'ambiente': ambiente, 'ok': v['ok'], 'campo': v.get('campo'), 'recusadas': v['recusadas']}
                    dono.validacoes.append(registro)
                    dono.todas_validacoes.append(registro)
                if not v['ok']:
                    return self._enviar(422, {'erro': f"Pacote da Receita recusado: {v['erro']} ({v['campo']})."})
                recusadas = v['recusadas'] + extra
                if ambiente != 'producao':
                    return self._enviar(200, {'ok': True, 'gravado': False, 'recusadas': recusadas,
                                              'motivo': 'Pacote do ambiente de demonstração: nada foi gravado.'})
                return self._enviar(200, {'ok': True, 'gravado': True, 'empresas': v['empresas'], 'sem_cadastro': 0,
                                          'recusadas': recusadas})

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}/functions/v1/ponte'

    def zerar(self, *respostas, empresas=None, empresas_status=200, impressao=IMPRESSAO, recusadas_extra=()):
        with self.trava:
            self.respostas = list(respostas)
            self.pacotes, self.pedidos_empresas, self.validacoes = [], [], []
            self.pings = 0
            self.empresas = copy.deepcopy(EMPRESAS if empresas is None else empresas)
            self.empresas_status = empresas_status
            self.impressao = impressao
            self.recusadas_extra = list(recusadas_extra)

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


def ponte(pasta, srp, *args, hoje=None, entrada=None, extra_env=None):
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5',
               PONTE_SERPRO_TOKEN_URL=srp.url_token, PONTE_SERPRO_GATEWAY=srp.url_gateway,
               PONTE_RECEITA_INTERVALO='0', PONTE_RECEITA_ESPERA_MAX='0', PYTHONIOENCODING='utf-8',
               PYTHONDONTWRITEBYTECODE='1')
    env.pop('PONTE_HOJE', None)
    if hoje:
        env['PONTE_HOJE'] = hoje
    env.update(extra_env or {})
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=300, input=entrada if entrada is not None else '')
    saida = (r.stdout or '') + (r.stderr or '')
    SAIDAS.append(saida)
    return r.returncode, saida


def rodar(pasta, srp, *args, hoje='2026-10-23', extra_env=None):
    return ponte(pasta, srp, 'receita', 'rodar', *args, hoje=hoje, extra_env=extra_env)


def pgdas_ate(srp, ano, ate_mes):
    """A resposta da demonstração do CONSDECLARACAO13 com os meses trocados pro ano e só até o mês dado."""
    r = copy.deepcopy(srp.fixtures['CONSDECLARACAO13'])
    d = json.loads(r['dados'].replace('2018', ano))
    d['periodos'] = [p for p in d['periodos'] if int(str(p['periodoApuracao'])[4:6]) <= ate_mes]
    r['dados'] = json.dumps(d)
    return r


def periodos_lidos(srp):
    return [json.loads(p['pedido']['pedidoDados']['dados'])['periodoApuracao'] for p in srp.pedidos
            if p['servico'] == 'CONSULTIMADECREC14']


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


def pdf_simples(linhas, tamanho=9, entrelinha=14):
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
    conteudo = (b'BT /F1 %d Tf %d TL 30 800 Td\n' % (tamanho, entrelinha)
                + b''.join(b'(' + esc(lin) + b') Tj T*\n' for lin in linhas) + b'ET')
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
       'Notificação de recebimento de mensagem e-MAC - Mensagem nº 083548 (complemento)', 'enviada_em': '2026-10-01',
       'origem': 'Receita', 'lida': False}, 'caixa_postal: as 50 mensagens, com id, assunto, data, origem e lida')
    ok(msgs[-1]['enviada_em'] == '2026-08-13' and all(m['enviada_em'] >= '2026-07-25' for m in msgs),
       'caixa_postal: as datas recentes do mock (dentro dos 90 dias da primeira leitura)')
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
    titulo('5. o calendário "a partir do dia": o dia marcado ou a primeira rodada depois dele; sábado nada; --so')
    pasta = pasta_nova()
    escrever_config(pasta, sis)
    srp.zerar()
    srp.eventos = {A: '261001'}
    sis.zerar()
    cod, saida = rodar(pasta, srp, hoje='2026-10-01')                 # quinta, primeiro dia útil — a primeira rodada
    ok(cod == 0 and sorted(srp.servicos('OBTERPROCURACAO41')) == sorted([A, B, C]),
       'primeiro dia útil: a autorização de todas')
    ok(srp.servicos('CONSDECLARACAO13') == [A] and sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]),
       'a primeira rodada (nada consultado ainda): os dias marcados de setembro já passaram — o pgdas do Simples e a '
       'situação fiscal de todas')
    ok(srp.servicos('CONSULTIMADECREC14') == [A], '  e a declaração do mês mais recente (o faturamento)')
    ok(srp.servicos('MSGCONTRIBUINTE61') == [A] and len((empresa(sis.ultimo(), A) or {}).get('caixa_postal', {})
                                                       .get('mensagens', [])) == 50,
       'caixa postal todo dia: as mensagens só de quem teve novidade')
    est = estado(pasta) or {}
    ok(len(est.get('mensagens', {}).get(A, [])) == 50 and est.get('eventos', {}).get(A) == '261001',
       'o estado.json guardou as mensagens mandadas e a data da novidade')
    ok(est.get('pgdas_consultado', {}).get(A) == '2026-10-01' and est.get('situacao_fiscal', {}).get(B) == '2026-10-01'
       and (est.get('autorizacao', {}).get(C) or {}).get('consultada_em') == '2026-10-01',
       '  e o dia de cada consulta feita (autorização, pgdas, situação fiscal)')

    srp.zerar()
    srp.eventos = {A: '261001'}
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-02')                              # sexta, nada marcado
    ok(not srp.servicos('OBTERPROCURACAO41') and not srp.servicos('CONSDECLARACAO13')
       and not srp.servicos('SOLICITARPROTOCOLO91'), 'no dia seguinte, sem dia marcado: nada além da caixa postal')
    ok(srp.servicos('MSGCONTRIBUINTE61') == [A]
       and (empresa(sis.ultimo(), A) or {}).get('caixa_postal') == {'mensagens': []},
       'a novidade do dia da leitura: lê de novo uma vez (pode ter chegado outra depois), sem repetir as mandadas')

    srp.zerar()
    srp.eventos = {A: '261001'}
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-05')                              # segunda, dia 5
    ok(not srp.servicos('MSGCONTRIBUINTE61') and srp.servicos('SOLICEVENTOSPJ132'),
       'a mesma data de novidade, já lida depois dela: não pede as mensagens de novo')
    ok(sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]), 'dia 5: a situação fiscal de todas')
    ok(not srp.servicos('OBTERPROCURACAO41') and not srp.servicos('CONSDECLARACAO13'),
       'sem autorização (já feita no mês) e sem pgdas')

    srp.zerar()
    srp.eventos = {A: '261021', B: '261021'}
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-21')                              # quarta: o prazo de setembro foi terça, 20/10
    pac = sis.ultimo()
    ok(srp.servicos('CONSDECLARACAO13') == [A], 'o primeiro dia útil depois do prazo: o pgdas, só do Simples')
    ok(not srp.servicos('CONSULTIMADECREC14'), 'a declaração já lida (a mesma transmissão) não é lida de novo')
    ok(not srp.servicos('SOLICITARPROTOCOLO91'), 'sem situação fiscal')
    ok(sorted(srp.servicos('MSGCONTRIBUINTE61')) == [A, B]
       and (empresa(pac, A) or {}).get('caixa_postal') == {'mensagens': []}
       and len((empresa(pac, B) or {}).get('caixa_postal', {}).get('mensagens', [])) == 50,
       'novidade de novo: a mensagem já mandada não volta (a da outra empresa vai)')

    srp.zerar()
    srp.pgdas_ano = '2026'
    sis.zerar()
    rodar(pasta, srp, '--so', 'pgdas,faturamento', hoje='2026-10-22')
    ok(srp.servicos('CONSULTIMADECREC14') == [A]
       and (empresa(sis.ultimo(), A) or {}).get('faturamento', {}).get('competencia') == '2026-01',
       'meses novos declarados: lê a declaração do mais antigo depois do último lido (um por rodada)')

    srp.zerar()
    sis.zerar()
    rodar(pasta, srp, hoje='2026-10-30')                              # sexta, último dia útil
    ok(not srp.servicos('CONSDECLARACAO13'), 'último dia útil: quem não tem mês sem declaração não consulta o pgdas')
    p2 = pasta_nova()                       # os meses da demonstração são de 2018: nenhum de 2026 declarado
    escrever_config(p2, sis)
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, hoje='2026-10-22')
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, hoje='2026-10-29')
    ok(not srp.servicos('CONSDECLARACAO13'), 'quem tem mês sem declaração: antes do último dia útil, nada')
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, hoje='2026-10-30')
    ok(srp.servicos('CONSDECLARACAO13') == [A], '  e no último dia útil, o pgdas de novo')
    p3 = pasta_nova()
    escrever_config(p3, sis)
    srp.zerar()
    sis.zerar()
    rodar(p3, srp, hoje='2026-01-21')                                 # janeiro: o ano anterior também
    anos = [json.loads(p['pedido']['pedidoDados']['dados'])['anoCalendario'] for p in srp.pedidos
            if p['servico'] == 'CONSDECLARACAO13']
    ok(anos == ['2025', '2026'], f'em janeiro, o ano anterior também ({anos})')

    # 2.2: o PC desligado o dia inteiro no dia marcado — roda na primeira rodada depois, e só uma vez
    p4 = pasta_nova()
    escrever_config(p4, sis)
    for dia in ('2026-10-02', '2026-10-22'):
        srp.zerar()
        srp.pgdas_ano = '2026'
        sis.zerar()
        rodar(p4, srp, hoje=dia)
    srp.zerar()
    sis.zerar()
    rodar(p4, srp, hoje='2026-11-06')                                 # sexta: desligado no dia 5 (quinta)
    ok(sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]),
       'situação fiscal: o PC desligado no dia 5 — roda no dia 6')
    srp.zerar()
    sis.zerar()
    rodar(p4, srp, hoje='2026-11-09')                                 # segunda seguinte
    ok(not srp.servicos('SOLICITARPROTOCOLO91'), '  e na rodada seguinte não roda de novo')
    p5 = pasta_nova()                       # o exemplo da fila: dia 5 numa segunda (outubro de 2026)
    escrever_config(p5, sis)
    srp.zerar()
    sis.zerar()
    rodar(p5, srp, hoje='2026-10-02')
    srp.zerar()
    sis.zerar()
    rodar(p5, srp, hoje='2026-10-06')                                 # terça: desligado na segunda, dia 5
    ok(sorted(srp.servicos('SOLICITARPROTOCOLO91')) == sorted([A, B, C]), 'desligado na segunda, dia 5: roda na terça, 6')
    srp.zerar()
    sis.zerar()
    rodar(p5, srp, hoje='2026-10-07')
    ok(not srp.servicos('SOLICITARPROTOCOLO91'), '  e na quarta, 7, não')
    srp.zerar()
    srp.pgdas_ano = '2026'
    sis.zerar()
    rodar(p4, srp, hoje='2026-11-23')                                 # segunda: o prazo de outubro (20/11 é feriado)
    ok(not srp.servicos('CONSDECLARACAO13'), 'pgdas: no dia do prazo (segunda, 23/11/2026) não consulta')
    srp.zerar()
    srp.pgdas_ano = '2026'
    sis.zerar()
    rodar(p4, srp, hoje='2026-11-25')                                 # quarta: desligado na terça, 24/11
    ok(srp.servicos('CONSDECLARACAO13') == [A],
       'pgdas: a consulta marcada pra terça, 24/11, com o PC desligado — roda na quarta, 25/11')
    ok((estado(p4) or {}).get('pgdas_consultado', {}).get(A) == '2026-11-25', '  e o estado.json guarda o dia do pgdas')
    srp.zerar()
    srp.pgdas_ano = '2026'
    sis.zerar()
    rodar(p4, srp, hoje='2026-11-26')
    ok(not srp.servicos('CONSDECLARACAO13'), '  e na quinta, 26, não roda de novo')

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
    titulo('7. segredo nunca aparece (a senha longa e única, a consumer key e secret, os tokens); a senha curta não '
           'apaga as datas')
    pasta = pasta_nova()
    pfx = gerar_pfx(pasta / 'escritorio.pfx')
    # uma rodada (e o conferir, que abre o .pfx) com a senha errada — que tem a de verdade dentro — e outra com a certa
    escrever_config(pasta, sis, pfx=pfx, senha_certificado=SENHA_PFX + '-errada')
    srp.zerar()
    sis.zerar()
    cod, saida = ponte(pasta, srp, 'receita', 'conferir')
    ok('a senha está errada' in saida, 'o conferir com a senha errada diz que está errada')
    srp.eventos = {A: '261022'}
    rodar(pasta, srp, '--so', 'autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal', '--saida', 'errada.json')
    escrever_config(pasta, sis, pfx=pfx)
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
    for nome, s in (('a senha do certificado (longa e única)', SENHA_PFX), ('a consumer_key', KEY),
                    ('a consumer_secret', SECRET), ('o Basic', basic), ('o access_token', 'ACCESS-TOKEN-DE-TESTE'),
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

    # 2.3: a senha curta do certificado ("2026") não é procurada no meio do texto — apagaria as datas
    p2 = pasta_nova()
    escrever_config(p2, sis, pfx=gerar_pfx(p2 / 'curta.pfx', senha='2026'), senha_certificado='2026')
    srp.zerar()
    sis.zerar()
    rodar(p2, srp, '--so', 'autorizacao', '--empresas', '1')
    log = logs(p2)
    ok('23/10/2026' in log and '***' not in log, 'com a senha "2026", a data do log da Receita fica inteira')
    cod, saida = ponte(p2, srp, 'receita', 'conferir')
    ok(f'Certificado: {TITULAR}' in saida and '***' not in saida, '  e o conferir abre o .pfx com ela, sem ***')
    cod, saida = ponte(p2, srp, 'rodar', '--falso', '--sem-enviar')                 # a ponte do Domínio
    ok(cod == 0 and re.search(r'dados até \d\d/\d\d/20\d\d', logs(p2)) and '***' not in logs(p2),
       '  e a do Domínio também (o cfg.segredos() é um só)')

    def registrar_curta():
        reg = Registro(p2 / 'logs-curta', config.carregar().segredos())
        reg('competência 2026-09, consulta em 23/10/2026, 2026 inteiro')
        reg.tela('na tela: 2026')
    _, tela = no_processo(p2, srp, registrar_curta)
    escrito = tela + ''.join(a.read_text(encoding='utf-8') for a in (p2 / 'logs-curta').glob('*.log'))
    ok('competência 2026-09, consulta em 23/10/2026, 2026 inteiro' in escrito and 'na tela: 2026' in escrito,
       'o Registro de verdade, com a senha "2026" nos segredos: as datas e o "2026" ficam (tela e log)')
    ok(ocultar('a senha 2026 e a chave Chave-Longa-De-Teste-123', ['2026', 'Chave-Longa-De-Teste-123'])
       == 'a senha 2026 e a chave ***', 'só o segredo de 8 ou mais caracteres é trocado no meio do texto')


# ---------------------------------------------------------------- 8. PDF ilegível

def caso_pdf_ilegivel(srp, sis):
    titulo('8. PDF que não dá pra ler: o bloco não vai, só o faltou com a_conferir; o PDF guardado')
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
    ok(cod == 0 and 'faturamento' not in e and e.get('pgdas'),
       f"a declaração ilegível: o faturamento não vai (nem com null) — o pgdas vai ({sorted(e)})")
    ok('situacao_fiscal' not in e, 'o relatório sem o que procurar: a situação fiscal não vai (a lista nula seria '
                                   '"sem pendência" no sistema)')
    ok(faltou(pac) == [(A, 'faturamento', 'a_conferir'), (A, 'situacao_fiscal', 'a_conferir')],
       'os dois vão só pro faltou, com a_conferir')
    pdfs = sorted(p.name for p in (pasta / 'receita' / 'pdfs').glob('*.pdf'))
    ok(pdfs == [f'{A}-declaracao-2018-12.pdf', f'{A}-situacao-fiscal-2026-10-23.pdf'],
       f'os PDFs ficam guardados pra ajustar a leitura ({pdfs})')
    ok(((pasta / 'receita' / 'pdfs' / f'{A}-declaracao-2018-12.pdf').read_bytes() == b'isto nao e um pdf'),
       '  como vieram')
    ok('a conferir' in logs(pasta), 'o log diz o que ficou a conferir')
    ok('2018-12' not in (estado(pasta) or {}).get('declaracoes_lidas', {}).get(A, {}),
       'a declaração não lida não fica marcada como lida (a próxima tenta de novo)')
    from ponte.receita import pacote
    p = pacote.montar({A: {'faturamento': {'competencia': '2026-09', 'receita_mes': None, 'receita_12_meses': 1},
                           'situacao_fiscal': {'consultada_em': '2026-10-05', 'pendencias': None}}}, [],
                      'i', 'f', 'producao', 0)
    ok(p['empresas'] == [], 'e o pacote.montar também deixa de fora o faturamento sem os valores e as pendências nulas')
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

    # a lista de pendências cortada em 100: foi lida — vai, com o aviso no log, sem a_conferir
    titulos = [f'Pendência - Débito (SIEF) nº {i:03d}' for i in range(1, 102)]
    srp.zerar()
    srp.filas['RELATORIOSITFIS92'] = [com_pdf(srp, 'RELATORIOSITFIS92', pdf_simples(
        ['Diagnóstico Fiscal na Receita Federal'] + titulos, tamanho=5, entrelinha=7))]
    sis.zerar()
    rodar(pasta, srp, '--so', 'situacao_fiscal', '--empresas', '1')
    pac = sis.ultimo()
    pend = ((empresa(pac, A) or {}).get('situacao_fiscal') or {}).get('pendencias') or []
    ok(len(pend) == 100 and pend[0]['titulo'] == titulos[0] and pend[-1]['titulo'] == titulos[99],
       f'101 pendências no relatório: vão as 100 primeiras ({len(pend)})')
    ok(faltou(pac) == [] and 'vão as 100 primeiras' in logs(pasta), '  sem a_conferir, com o aviso no log')


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
    v = sis.validacoes[-1] if sis.validacoes else {'ok': False, 'recusadas': ['-']}
    msgs = (sis.pacotes[0]['corpo']['empresas'][0].get('caixa_postal') or {}).get('mensagens', []) if sis.pacotes else []
    ok(v['ok'] and v['recusadas'] == [] and len(msgs) == 50,
       f"  o pacote do --falso passa pelo validarPacote de verdade sem nenhuma recusa, com as 50 mensagens ({v['recusadas']})")
    ok('não gravou' in saida, '  e o log diz que o sistema recebeu e não gravou (não é produção)')
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
    v = sis.validacoes[-1] if sis.validacoes else {'ok': False, 'recusadas': ['-']}
    ok(v['ok'] and v['recusadas'] == [] and set(pac['empresas'][0]) == {'documento', 'autorizacao', 'pgdas', 'faturamento',
                                                                        'caixa_postal', 'situacao_fiscal'},
       f"  o pacote da demonstração (os cinco blocos) passa pelo validarPacote de verdade sem nenhuma recusa ({v['recusadas']})")
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


# ---------------------------------------------------------------- 10. o item 4: a chave

def caso_chave(srp, sis):
    titulo('10. a chave da ponte: py -3 -m ponte chave gera, grava e mostra só a impressão digital')
    from ponte import chave as chave_mod
    p = pasta_nova()
    cod, saida = ponte(p, srp, 'chave')
    ok(cod == 2 and 'Não achei' in saida, f'sem config.ini: diz o que fazer e sai com 2 (saiu {cod})')
    exemplo = (RAIZ / 'ponte' / 'config.exemplo.ini').read_text(encoding='utf-8')
    ok('url = https://exemplo.supabase.co/functions/v1/ponte\n' in exemplo and 'ponte-dominio' not in exemplo.split('[sistema]')[1].split('[')[0],
       'o config.exemplo.ini aponta pra função ponte (/functions/v1/ponte)')
    leia = (RAIZ / 'ponte' / 'LEIA-ME.md').read_text(encoding='utf-8')
    ok('https://exemplo.supabase.co/functions/v1/ponte' in leia and '/functions/v1/ponte-dominio' not in leia,
       '  e o LEIA-ME também')
    original = ('﻿; config de teste — este comentário fica\r\n[sistema]\r\n'
                f'url = {sis.url}\r\nchave_publica = {CHAVE_PUBLICA}\r\n; o segredo da ponte\r\n'
                'chave_ponte = segredo-de-exemplo\r\n\r\n[integra]\r\nambiente = demonstracao\r\n'
                'cnpj_escritorio = 99999999999999\r\n')
    (p / 'config.ini').write_bytes(original.encode('utf-8'))
    cod, saida = ponte(p, srp, 'chave')
    texto = (p / 'config.ini').read_bytes().decode('utf-8')
    nova = re.search(r'^chave_ponte = (.*)$', texto, re.M).group(1).strip()
    marca = hashlib.sha256(nova.encode('utf-8')).hexdigest()
    ok(cod == 0 and nova != 'segredo-de-exemplo' and len(nova) >= 40 and nova.isascii() and re.fullmatch(r'[A-Za-z0-9_-]+', nova),
       f'a chave do exemplo vira uma chave nova (token_urlsafe, só ASCII) — saiu {cod}')
    ok(f'Impressão digital: {marca}' in saida and RECADO in saida and len(marca) == 64,
       'mostra a impressão digital (SHA-256 dos bytes UTF-8, 64 caracteres) e o recado')
    ok(nova not in saida and nova not in logs(p) and marca in logs(p),
       'a chave não aparece na tela nem no log (a impressão, sim)')
    ok(texto.startswith('﻿') and texto.count('\r\n') == original.count('\r\n')
       and texto.replace(nova, 'segredo-de-exemplo') == original,
       'o config.ini muda só nessa linha: os comentários, o BOM e as quebras de linha ficam')
    antes = (p / 'config.ini').read_bytes()
    cod, saida = ponte(p, srp, 'chave')
    ok(cod == 0 and 'já existe' in saida and f'Impressão digital: {marca}' in saida and (p / 'config.ini').read_bytes() == antes,
       'de novo: a chave já existe — não muda nada e mostra a mesma impressão')
    cod, saida = ponte(p, srp, 'chave', '--trocar', entrada='n\n')
    ok(cod == 1 and (p / 'config.ini').read_bytes() == antes, f'--trocar sem o "s": não troca (saiu {cod})')
    cod, saida = ponte(p, srp, 'chave', '--trocar', entrada='s\n')
    outra = re.search(r'^chave_ponte = (.*)$', (p / 'config.ini').read_text(encoding='utf-8-sig'), re.M).group(1).strip()
    ok(cod == 0 and outra != nova and f'Impressão digital: {hashlib.sha256(outra.encode()).hexdigest()}' in saida
       and outra not in saida, '--trocar com o "s": troca e mostra a impressão nova')
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok(f'Chave da ponte: impressão digital {hashlib.sha256(outra.encode()).hexdigest()}' in saida and outra not in saida,
       'o receita conferir mostra a impressão digital (e não a chave)')
    # o chave_ponte vazio, e sem a seção [sistema]
    (p / 'config.ini').write_text('[sistema]\nurl = x\nchave_ponte =\n', encoding='utf-8')
    cod, saida = ponte(p, srp, 'chave')
    linhas = (p / 'config.ini').read_text(encoding='utf-8').splitlines()
    ok(cod == 0 and linhas[:2] == ['[sistema]', 'url = x'] and linhas[2].startswith('chave_ponte = ') and len(linhas) == 3,
       'o chave_ponte vazio: gera ali mesmo')
    (p / 'config.ini').write_text('[integra]\nambiente = demonstracao\n', encoding='utf-8')
    cod, saida = ponte(p, srp, 'chave')
    from ponte import config
    gerada = no_processo(p, srp, lambda: config.carregar().valor('sistema', 'chave_ponte'))[0]
    ok(cod == 0 and gerada and '[integra]' in (p / 'config.ini').read_text(encoding='utf-8'),
       'sem a seção [sistema]: acrescenta a seção com a chave')
    ok(chave_mod.impressao('abc') == 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
       'a impressão é o SHA-256 em hexadecimal minúsculo (o do "abc")')


# ---------------------------------------------------------------- 10. o item 4: os feriados

def caso_feriados():
    titulo('10. os feriados do pgdas iguais aos do JavaScript (assets/js/rescisao-datas.js), de 2023 a 2031')
    from ponte.receita import calendario
    js = (f"import {{ feriado }} from '{FERIADOS_JS.resolve().as_uri()}';"
          "const out = []; for (let a = 2023; a <= 2031; a++) for (let d = new Date(Date.UTC(a, 0, 1)); "
          "d.getUTCFullYear() === a; d.setUTCDate(d.getUTCDate() + 1)) { const iso = d.toISOString().slice(0, 10); "
          "const f = feriado(iso); if (f) out.push([iso, f]); } console.log(JSON.stringify(out));")
    r = subprocess.run([NODE, '--input-type=module', '-e', js], capture_output=True, encoding='utf-8', errors='replace',
                       timeout=60)
    do_js = [tuple(x) for x in json.loads(r.stdout)] if r.returncode == 0 else None
    do_py = sorted((d.isoformat(), n) for a in range(2023, 2032) for d, n in calendario.feriados_do_ano(a).items())
    ok(do_js is not None and do_js == do_py,
       f'os mesmos dias e os mesmos nomes ({len(do_py)} feriados; o JavaScript deu {len(do_js) if do_js else r.stderr[-200:]})')
    ok(('2023-11-20', 'Dia da Consciência Negra') not in do_py and ('2024-11-20', 'Dia da Consciência Negra') in do_py,
       'o 20/11 a partir de 2024')
    d = datetime.date
    ok(calendario.prazo_pgdas('2026-10') == d(2026, 11, 23) and calendario.consulta_pgdas('2026-10') == d(2026, 11, 24),
       '10/2026: o prazo é segunda, 23/11 (20/11 é feriado) e a consulta, terça, 24/11')
    ok(calendario.consulta_pgdas('2026-11') == d(2026, 12, 22) and calendario.consulta_pgdas('2026-05') == d(2026, 6, 23),
       '11/2026 → consulta 22/12; 05/2026 → consulta 23/06')


# ---------------------------------------------------------------- 10. o item 4: a autorização toda segunda

SEM_PROCURACAO = {'status': 200, 'dados': '', 'mensagens': [
    {'codigo': '[Aviso-PROCURACOES-40400]', 'texto': 'Não possui procuração ativa.'}]}


def caso_autorizacao_segunda(srp, sis):
    titulo('10. a autorização: toda segunda pra quem estava sem (a partir do dia); o acesso negado não volta todo dia')
    p = pasta_nova()
    escrever_config(p, sis)
    srp.zerar()
    srp.por_doc[('OBTERPROCURACAO41', A)] = [SEM_PROCURACAO]
    srp.por_doc[('OBTERPROCURACAO41', B)] = [403]
    sis.zerar()
    rodar(p, srp, hoje='2026-10-01')                                  # quinta: A sem procuração, B com acesso negado
    est = estado(p) or {}
    ok((est.get('autorizacao', {}).get(A) or {}).get('situacao') == 'sem'
       and (est.get('autorizacao', {}).get(B) or {}).get('situacao') == 'sem'
       and (est.get('autorizacao', {}).get(B) or {}).get('consultada_em') == '2026-10-01',
       'o estado.json lembra quem está sem (também o acesso negado, que respondeu)')
    srp.zerar()
    sis.zerar()
    rodar(p, srp, hoje='2026-10-02')
    ok(not srp.servicos('OBTERPROCURACAO41'), 'sexta: não pergunta de novo (nem o do acesso negado)')
    srp.zerar()
    sis.zerar()
    rodar(p, srp, hoje='2026-10-06')                                  # terça: desligado na segunda, dia 5
    ok(sorted(srp.servicos('OBTERPROCURACAO41')) == sorted([A, B]),
       'a segunda-feira com o PC desligado: na terça pergunta de novo, só de quem estava sem')
    ok((empresa(sis.ultimo(), A) or {}).get('autorizacao', {}).get('situacao') == 'ativa',
       '  e o cliente que autorizou aparece na mesma semana')
    srp.zerar()
    sis.zerar()
    rodar(p, srp, hoje='2026-10-07')
    ok(not srp.servicos('OBTERPROCURACAO41'), '  e na quarta não')


# ---------------------------------------------------------------- 10. o item 4: o limite da Caixa Postal

def _msg(isn, enviada, lida=False, assunto='Aviso de teste nº ++VARIAVEL++', valor='1'):
    return {'isn': isn, 'dataEnvio': enviada.strftime('%Y%m%d'), 'indicadorLeitura': '1' if lida else '0',
            'assuntoModelo': assunto, 'valorParametroAssunto': valor, 'tipoOrigem': '1',
            'descricaoOrigem': 'RECEITA FEDERAL'}


def _caixa(msgs):
    return {'status': 200, 'mensagens': [{'codigo': '[Sucesso-CAIXAPOSTAL]', 'texto': 'ok'}],
            'dados': json.dumps({'conteudo': [{'quantidadeMensagens': str(len(msgs)), 'listaMensagens': msgs}]})}


def caso_caixa_postal(srp, sis):
    titulo('10. a Caixa Postal: as 100 mais recentes; na primeira leitura, só os últimos 90 dias; a lida vai de novo')
    hoje = datetime.date(2026, 10, 23)
    recentes = [_msg(f'R{i:03d}', hoje - datetime.timedelta(days=1 + i % 80)) for i in range(120)]
    sem_assunto = _msg('VAZIA', hoje, assunto='', valor='')
    antigas = [_msg(f'V{i:03d}', hoje - datetime.timedelta(days=100 + i)) for i in range(10)]
    p = pasta_nova()
    escrever_config(p, sis)
    srp.zerar()
    srp.eventos = {A: '261022'}
    srp.por_doc[('MSGCONTRIBUINTE61', A)] = [_caixa([sem_assunto] + recentes + antigas)]
    sis.zerar()
    rodar(p, srp, '--so', 'caixa_postal', '--empresas', '1')
    msgs = ((empresa(sis.ultimo(), A) or {}).get('caixa_postal') or {}).get('mensagens', [])
    ok(len(msgs) == 100 and msgs[0]['id'] == 'VAZIA', f'121 recentes: vão as 100 mais recentes ({len(msgs)})')
    ok(msgs and msgs[0]['assunto'] == '(sem assunto)', 'mensagem sem assunto vai com "(sem assunto)" (a função recusaria o bloco)')
    ok(not any(m['id'].startswith('V0') for m in msgs), 'na primeira leitura, as de mais de 90 dias ficam no e-CAC')
    lembradas = (estado(p) or {}).get('mensagens', {}).get(A, {})
    ok(sum(1 for v in lembradas.values() if v == 'antiga') == 10 and len(lembradas) == 110,
       'o estado.json lembra as antigas (pra não irem depois) e as 100 mandadas')
    v = sis.validacoes[-1] if sis.validacoes else {'ok': False, 'recusadas': ['-']}
    ok(v['ok'] and v['recusadas'] == [], '  e o pacote passa pelo validarPacote de verdade sem recusa')
    # a segunda leitura: a R000 (mandada como não lida) agora lida; as 21 que sobraram vão; as antigas não
    srp.zerar()
    srp.eventos = {A: '261023'}
    lida = dict(recentes[0], indicadorLeitura='1')
    srp.por_doc[('MSGCONTRIBUINTE61', A)] = [_caixa([sem_assunto, lida] + recentes[1:] + antigas)]
    sis.zerar()
    rodar(p, srp, '--so', 'caixa_postal', '--empresas', '1')
    msgs2 = ((empresa(sis.ultimo(), A) or {}).get('caixa_postal') or {}).get('mensagens', [])
    ids = {m['id'] for m in msgs2}
    sobraram = {m['isn'] for m in [sem_assunto] + recentes} - {m['id'] for m in msgs}
    ok(any(m['id'] == 'R000' and m['lida'] is True for m in msgs2), 'a mandada como não lida que aparece lida vai de novo')
    ok(sobraram <= ids and not any(i.startswith('V0') for i in ids) and len(msgs2) == len(sobraram) + 1,
       f'as que sobraram da primeira vão agora; as antigas, nunca ({len(msgs2)})')


# ---------------------------------------------------------------- 10. o item 4: as respostas da função

def caso_respostas_da_funcao(srp, sis):
    titulo('10. as respostas da função: o 503 da chave não cadastrada, o 401 da chave recusada e as recusadas')
    p = pasta_nova()
    escrever_config(p, sis)
    srp.zerar()
    sis.zerar(impressao=None)
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok(f'Sistema: {SEM_CHAVE} (HTTP 503)' in saida and RECADO in saida,
       'o conferir mostra a mensagem do 503 como veio, com o recado da impressão')
    cod, saida = rodar(p, srp, '--so', 'autorizacao')
    ok(cod == 1 and SEM_CHAVE in saida and not srp.pedidos, f'a lista de empresas com o 503: a mensagem no log, sai com 1 (saiu {cod})')
    sis.zerar(impressao='0' * 64)
    cod, saida = ponte(p, srp, 'receita', 'conferir')
    ok('Sistema: Chave da ponte recusada. (HTTP 401)' in saida and 'impressão digital' in saida,
       'o conferir mostra a mensagem do 401 como veio')
    cod, saida = rodar(p, srp, '--so', 'autorizacao')
    ok(cod == 2 and 'Chave da ponte recusada.' in saida, f'a lista de empresas com o 401: sai com 2 (saiu {cod})')
    # o 503 no envio (o --falso não pede a lista): não insiste — o mesmo dado voltaria igual até a impressão ser cadastrada
    p3 = pasta_nova()
    escrever_config(p3, sis)
    sis.zerar(impressao=None)
    cod, saida = rodar(p3, srp, '--falso')
    ok(cod == 1 and len(sis.pacotes) == 1 and SEM_CHAVE in saida and 'Claude da sessão do Samuel' in saida
       and 'tento de novo' not in saida, f'o 503 da chave no envio: uma tentativa só, com a mensagem e o recado (saiu {cod})')
    # as recusadas: no log, o CNPJ, o campo e o erro (nunca o valor); o bloco não é reenviado
    srp.zerar()
    srp.eventos = {A: '261022'}
    sis.zerar(recusadas_extra=[{'documento': A, 'campo': 'empresas[0].caixa_postal.mensagens[2].enviada_em',
                                'erro': 'data que não existe'}])
    cod, saida = rodar(p, srp, '--so', 'caixa_postal')
    log = logs(p)
    ok(cod == 0 and f'{A}: caixa_postal.mensagens[2].enviada_em — data que não existe' in log
       and 'não reenvio' in log, 'as recusadas vão pro log: o CNPJ, o campo e o erro')
    assuntos = [m['assunto'] for m in ((empresa(sis.ultimo(), A) or {}).get('caixa_postal') or {}).get('mensagens', [])]
    ok(assuntos and not any(a in log for a in assuntos), '  nunca o valor (o assunto das mensagens não vai pro log)')
    srp.zerar()
    srp.eventos = {A: '261023'}
    sis.zerar()
    rodar(p, srp, '--so', 'caixa_postal')
    ok((empresa(sis.ultimo(), A) or {}).get('caixa_postal') == {'mensagens': []},
       '  e o bloco recusado não é reenviado (as mensagens contam como mandadas)')
    ok('empresa(s) gravada(s)' in logs(p), 'o log diz quantas empresas o sistema gravou')


def caso_validacoes(sis):
    titulo('+ todo pacote que a ponte mandou passou pelo validarPacote de verdade (node) sem nenhuma recusa')
    todas = sis.todas_validacoes
    ruins = [v for v in todas if not v['ok'] or v['recusadas']]
    ok(len(todas) >= 30 and not ruins, f'{len(todas)} pacotes conferidos; com recusa: {ruins[:3]}')



# ---------------------------------------------------------------- a revisão de 24/10 (o ramo inteiro)

def caso_faturamento_pendente(srp, sis):
    titulo('+ revisão: a declaração que não veio volta na rodada seguinte, e o mês de antes não é pulado')
    q = pasta_nova()
    escrever_config(q, sis)
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 7)]
    sis.zerar()
    rodar(q, srp, hoje='2026-10-01')
    ok(periodos_lidos(srp) == ['202607'], f'a primeira vez: só o mês mais recente ({periodos_lidos(srp)})')
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 9)]
    sis.zerar()
    rodar(q, srp, hoje='2026-10-21')
    ok(periodos_lidos(srp) == ['202608'], f'dois meses novos (08 e 09): lê o mais antigo primeiro ({periodos_lidos(srp)})')
    srp.zerar()
    sis.zerar()
    rodar(q, srp, hoje='2026-10-22')
    ok(periodos_lidos(srp) == ['202609'] and not srp.servicos('CONSDECLARACAO13'),
       f'  e no dia seguinte, sem o pgdas, o que ficou ({periodos_lidos(srp)})')
    srp.zerar()
    sis.zerar()
    rodar(q, srp, hoje='2026-10-23')
    ok(not periodos_lidos(srp), '  nada pendente: nenhuma chamada da declaração')
    # o Serpro fora na hora da declaração
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 10)]
    srp.filas['CONSULTIMADECREC14'] = [503, 503, 503, 503]
    sis.zerar()
    rodar(q, srp, hoje='2026-11-24')
    ok((A, 'faturamento', 'erro') in faltou(sis.ultimo()), 'o Serpro fora na declaração: o faturamento vai como erro')
    srp.zerar()
    sis.zerar()
    rodar(q, srp, hoje='2026-11-25')
    ok(periodos_lidos(srp) == ['202610'] and (empresa(sis.ultimo(), A) or {}).get('faturamento', {}).get('competencia')
       == '2026-10', f'  e volta na rodada seguinte, mesmo sem o pgdas ({periodos_lidos(srp)})')
    # o --so pgdas no dia marcado: a tarefa do mesmo dia lê a declaração
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 11)]
    sis.zerar()
    rodar(q, srp, '--so', 'pgdas', hoje='2026-12-22')
    ok(srp.servicos('CONSDECLARACAO13') == [A] and not periodos_lidos(srp), 'o --so pgdas não lê a declaração')
    srp.zerar()
    sis.zerar()
    rodar(q, srp, hoje='2026-12-22')
    ok(periodos_lidos(srp) == ['202611'] and not srp.servicos('CONSDECLARACAO13'),
       f'  e a tarefa do mesmo dia lê, sem consultar o pgdas de novo ({periodos_lidos(srp)})')
    # a declaração com o PDF ilegível não é pedida todo dia: volta no dia do pgdas
    q2 = pasta_nova()
    escrever_config(q2, sis)
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 8)]
    srp.filas['CONSULTIMADECREC14'] = [com_pdf(srp, 'CONSULTIMADECREC14', b'isto nao e um pdf')]
    sis.zerar()
    rodar(q2, srp, hoje='2026-10-01')
    ok((A, 'faturamento', 'a_conferir') in faltou(sis.ultimo()), 'o PDF ilegível: a_conferir')
    srp.zerar()
    sis.zerar()
    rodar(q2, srp, hoje='2026-10-02')
    ok(not periodos_lidos(srp), '  no dia seguinte não pede de novo (nem o mês de antes no lugar)')
    srp.zerar()
    srp.filas['CONSDECLARACAO13'] = [pgdas_ate(srp, '2026', 8)]
    sis.zerar()
    rodar(q2, srp, hoje='2026-10-21')
    ok(periodos_lidos(srp) == ['202608'] and (empresa(sis.ultimo(), A) or {}).get('faturamento'),
       f'  e no dia do pgdas tenta de novo ({periodos_lidos(srp)})')


def caso_virada_do_ano(srp, sis):
    titulo('+ revisão: a consulta de dezembro recuperada em fevereiro vê dezembro; o feriado entre o prazo e a consulta')
    from ponte.receita import calendario
    d = datetime.date
    ok(calendario.anos_do_pgdas(d(2027, 2, 1)) == [2026, 2027] and calendario.anos_do_pgdas(d(2027, 2, 24)) == [2027]
       and calendario.anos_do_pgdas(d(2027, 1, 5)) == [2026, 2027],
       'os anos do pgdas: em fevereiro, antes da consulta de janeiro, o anterior também')
    em_dia_2026 = {f'2026-{m:02d}': 'x' for m in range(1, 13)}
    ok(not calendario.falta_declaracao(d(2027, 2, 1), em_dia_2026)
       and calendario.falta_declaracao(d(2027, 2, 1), {k: v for k, v in em_dia_2026.items() if k != '2026-12'}),
       'fevereiro: quem declarou 2026 inteiro não tem "mês sem declaração" (sem o pgdas a mais); sem dezembro, tem')
    ate_fev = {f'2027-{m:02d}': 'x' for m in (1, 2)}
    ok(not calendario.falta_declaracao(d(2027, 4, 21), ate_fev),
       'Tiradentes (21/04/2027, entre o prazo de março e a consulta de 22/04): março ainda não conta como sem declaração')

    class Est:
        def __init__(self, declarados, pgdas_em):
            self.declarados, self.pgdas_em = declarados, pgdas_em

        def consultada_em(self, servico, doc):
            return {'pgdas': self.pgdas_em, 'autorizacao': '2027-04-01', 'situacao_fiscal': '2027-04-05'}[servico]

        def sem_autorizacao(self, doc, hoje):
            return False

        def meses_declarados(self, doc):
            return self.declarados
    s = calendario.servicos_do_dia(d(2027, 4, 21), {'documento': A, 'regime': 'simples'}, Est(ate_fev, '2027-03-23'))
    ok('pgdas' not in s, f'  e o pgdas não roda no feriado, só no dia 22 ({sorted(s)})')
    r = pasta_nova()
    escrever_config(r, sis)
    srp.zerar()
    sis.zerar()
    rodar(r, srp, hoje='2027-01-04')
    srp.zerar()
    sis.zerar()
    rodar(r, srp, hoje='2027-02-01')                                  # desligado de 21/01 (a consulta de 12/2026) a 29/01
    anos = [json.loads(p['pedido']['pedidoDados']['dados'])['anoCalendario'] for p in srp.pedidos
            if p['servico'] == 'CONSDECLARACAO13']
    ok(anos == ['2026', '2027'], f'a consulta de dezembro recuperada em 01/02/2027 pede 2026 também ({anos})')


def caso_certificado_do_serpro(srp, sis):
    titulo('+ revisão: o certificado do Serpro que não confere é configuração (sai com 2), não o Serpro fora')
    import ssl
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    p = pasta_nova()
    chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nome = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, '127.0.0.1')])
    agora = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(nome).issuer_name(nome).public_key(chave.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(agora - datetime.timedelta(days=1))
            .not_valid_after(agora + datetime.timedelta(days=30)).sign(chave, hashes.SHA256()))
    (p / 'c.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    (p / 'k.pem').write_bytes(chave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                  serialization.NoEncryption()))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(p / 'c.pem'), str(p / 'k.pem'))

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        escrever_config(p, sis)
        srp.zerar()
        sis.zerar()
        cod, saida = rodar(p, srp, '--so', 'autorizacao', '--empresas', '1',
                           extra_env={'PONTE_SERPRO_GATEWAY': f'https://127.0.0.1:{srv.server_address[1]}/v1/'})
        ok(cod == 2 and 'não reconheceu o certificado do Serpro' in saida and 'ac-serpro-2025.pem' in saida
           and 'tento de novo' not in saida, f'sai com 2 na primeira vez, com o recado de trocar o ac-serpro-2025.pem (saiu {cod})')
        ok(not sis.pacotes, '  e não manda um pacote só de "erro" como se o Serpro estivesse fora')
    finally:
        srv.shutdown()


def caso_caixa_postal_revisao(srp, sis):
    titulo('+ revisão: a Caixa Postal do CNPJ com letras; a empresa que não volta no lote; a mensagem da tarde')
    alfa = 'AB12CD34000155'                 # inventado, com letras (o CNPJ alfanumérico de julho/2026)
    p = pasta_nova()
    escrever_config(p, sis)
    srp.zerar()
    srp.eventos = {A: '261022', alfa: '261022'}
    srp.fora_do_lote = {B}
    sis.zerar(empresas=[{'documento': A, 'regime': 'simples'}, {'documento': alfa, 'regime': 'presumido'},
                        {'documento': B, 'regime': 'presumido'}])
    rodar(p, srp, '--so', 'caixa_postal')
    pac = sis.ultimo()
    ok(sorted(srp.servicos('MSGCONTRIBUINTE61')) == sorted([A, alfa])
       and len(((empresa(pac, alfa) or {}).get('caixa_postal') or {}).get('mensagens', [])) == 50,
       'o CNPJ com letras volta do lote com as letras: as mensagens dele são lidas')
    ok((B, 'caixa_postal', 'erro') in faltou(pac) and 'não voltaram na resposta' in logs(p),
       'a empresa pedida no lote que não volta na resposta vai pro faltou como erro, com o aviso no log')
    # a mensagem que chega à tarde, no mesmo dia da que foi lida de manhã
    q = pasta_nova()
    escrever_config(q, sis)
    m1 = _msg('M1', datetime.date(2026, 10, 22))
    m2 = _msg('M2', datetime.date(2026, 10, 22))
    srp.zerar()
    srp.eventos = {A: '261022'}
    srp.por_doc[('MSGCONTRIBUINTE61', A)] = [_caixa([m1])]
    sis.zerar()
    rodar(q, srp, '--so', 'caixa_postal', '--empresas', '1', hoje='2026-10-22')
    srp.zerar()
    srp.eventos = {A: '261022'}
    srp.por_doc[('MSGCONTRIBUINTE61', A)] = [_caixa([m2, m1])]
    sis.zerar()
    rodar(q, srp, '--so', 'caixa_postal', '--empresas', '1', hoje='2026-10-23')
    ids = [m['id'] for m in ((empresa(sis.ultimo(), A) or {}).get('caixa_postal') or {}).get('mensagens', [])]
    ok(ids == ['M2'], f'a mensagem da tarde (o mesmo dia do evento) é lida no dia seguinte ({ids})')
    srp.zerar()
    srp.eventos = {A: '261022'}
    sis.zerar()
    rodar(q, srp, '--so', 'caixa_postal', '--empresas', '1', hoje='2026-10-26')
    ok(not srp.servicos('MSGCONTRIBUINTE61'), '  e depois, com o mesmo evento, não lê mais')


# ---------------------------------------------------------------- 9. a ponte do Domínio

def caso_dominio():
    titulo('9. o tests/ponte.test.py continua passando sem mudança')
    r = subprocess.run([sys.executable, str(RAIZ / 'tests' / 'ponte.test.py')], cwd=str(RAIZ), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=600,
                       env=dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1'))
    ok(r.returncode == 0 and 'Tudo certo' in r.stdout, f'tests/ponte.test.py: saiu {r.returncode}')
    if r.returncode != 0:
        print('\n'.join(lin for lin in r.stdout.splitlines() if '✗' in lin))
    ramo = ''
    if shutil.which('git'):
        ramo = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=str(RAIZ), capture_output=True,
                              encoding='utf-8', errors='replace').stdout.strip()
    if not shutil.which('git'):
        print('  (sem o git aqui: não conferi se o arquivo é o mesmo da main)')
    elif ramo == 'main':
        # na própria main o teste do Domínio muda quando a ponte do Domínio muda (29/10/2026: os comandos do dominio);
        # a trava é pros ramos das filas, que não mexem nele
        print('  (na main: o arquivo é o da main)')
    else:
        g = subprocess.run(['git', 'diff', '--quiet', 'origin/main', '--', 'tests/ponte.test.py'], cwd=str(RAIZ))
        ok(g.returncode == 0, 'e o arquivo é o mesmo da main')


def main():
    global VALIDADOR
    pasta_js = pasta_nova()
    VALIDADOR = pasta_js / 'validar.mjs'
    VALIDADOR.write_text(
        f"import {{ validarPacote }} from '{RECEITA_JS.resolve().as_uri()}';\n"
        "let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => s += d);\n"
        "process.stdin.on('end', () => { const r = validarPacote(JSON.parse(s)); process.stdout.write(JSON.stringify("
        "{ ok: r.ok, campo: r.campo || null, erro: r.erro || null, recusadas: r.recusadas || [], "
        "empresas: r.ok ? r.pacote.empresas.length : 0 })); });\n", encoding='utf-8')
    srp, sis = Serpro(), Sistema()
    try:
        for caso in (lambda: caso_token(srp, sis), lambda: caso_certificado(srp, sis), lambda: caso_servicos(srp, sis),
                     lambda: caso_respostas(srp, sis), lambda: caso_calendario(srp, sis),
                     lambda: caso_o_que_sai(srp, sis), lambda: caso_segredos(srp, sis),
                     lambda: caso_pdf_ilegivel(srp, sis), lambda: caso_envio(srp, sis), lambda: caso_chave(srp, sis),
                     caso_feriados, lambda: caso_autorizacao_segunda(srp, sis), lambda: caso_caixa_postal(srp, sis),
                     lambda: caso_respostas_da_funcao(srp, sis), lambda: caso_faturamento_pendente(srp, sis),
                     lambda: caso_virada_do_ano(srp, sis), lambda: caso_certificado_do_serpro(srp, sis),
                     lambda: caso_caixa_postal_revisao(srp, sis), lambda: caso_validacoes(sis), caso_dominio):
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
