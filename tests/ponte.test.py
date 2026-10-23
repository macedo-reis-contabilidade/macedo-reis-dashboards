"""Teste da ponte do Domínio (ponte/) — sem Domínio, sem sistema e sem internet. Roda no Windows e no Linux, só com
a biblioteca padrão do Python (3.11+); o pyodbc não precisa estar instalado.

    python tests/ponte.test.py

Cada caso usa uma pasta temporária em PONTE_PASTA e um sistema de mentira (http.server numa thread, porta 0), que
também responde o "IP de saída" do conferir (203.0.113.7, endereço de documentação — não é de ninguém).
Empresas, chaves e senhas são todas inventadas.

  1. rodar --falso --sem-enviar: as empresas, as linhas dos 3 meses, os tipos, dados_ate = ontem e null onde a fonte
     não trouxe (um 0 de verdade continua 0)
  2. campo a mais vindo da fonte (nome de funcionário, salário) não sai no pacote
  3. consulta "-- A CONFERIR" fica de fora e vai pro faltou; sem a de empresas, nada é mandado (e nem conecta);
     consulta que não veio contada ou que deu erro também fica de fora, sem derrubar o resto
  4. envio: 503, 503, 200 -> foi na terceira; 401 -> não repete, sai com 2, nada em pendentes; rede fora -> pendente
     e sai com 1, e a rodada seguinte manda o pendente primeiro e o apaga; tempo esgotado tenta de novo; pendente
     recusado (400) é apagado; pendente de mais de 30 dias é apagado com aviso; --falso nunca manda pro sistema de
     verdade
  5. o sistema recebe os cabeçalhos certos (x-chave, apikey, Authorization, Content-Type)
  6. segredo nunca aparece: nem a chave da ponte, nem a senha da conexão, na tela, no log, no pacote ou nos pendentes
  7. conferir com a configuração incompleta diz o que falta sem mostrar valor; completa, faz o ping (404 = função
     ainda não publicada) e não grava nada
  +  --meses, o [rodada] meses do config.ini e a limpeza dos logs de mais de 60 dias
Termina com código 1 se alguma checagem falhar.
"""
import datetime
import http.server
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

sys.dont_write_bytecode = True          # importar a ponte aqui não deixa __pycache__ no repositório
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

# o contrato da fila (2.4), escrito aqui e não importado da ponte: um campo a mais na ponte tem que derrubar o teste
CONTRATO_EMPRESA = {'codigo', 'documento', 'nome', 'ativa'}
CONTRATO_MENSAL = ['codigo', 'competencia', 'funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore',
                   'notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas', 'lancamentos', 'ultimo_lancamento']

SEGREDO = 'SEGREDO-DE-TESTE'
SENHA = 'SENHA-DE-TESTE'
CHAVE_PUBLICA = 'chave-publica-de-teste'
CONEXAO = f'DRIVER={{SQL Anywhere 17}};UID=EXTERNO;PWD={SENHA};ServerName=srvteste'
IP_DOC = '203.0.113.7'

falhas = 0
PASTAS = []


def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond:
        falhas += 1


def titulo(t):
    print(f'\n{t}')


# ---------------------------------------------------------------- o sistema de mentira

class Sistema:
    def __init__(self):
        self.respostas = []      # o que responder aos POST, na ordem (200, 302, 401, 503, 'lento'…); acabou -> 200
        self.recebidos = []
        self.gets = []           # os GET que não são o do IP (um redirecionamento seguido apareceria aqui)
        self.trava = threading.Lock()
        dono = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _responder(self, codigo, corpo):
                try:
                    self.send_response(codigo)
                    if 300 <= codigo < 400:
                        self.send_header('Location', '/outro-lugar')
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(corpo)))
                    self.end_headers()
                    self.wfile.write(corpo)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    pass   # o cliente desistiu (tempo esgotado)

            def do_GET(self):
                if self.path != '/ip':
                    with dono.trava:
                        dono.gets.append({'caminho': self.path, 'cabecalhos': {k.lower(): v for k, v in self.headers.items()}})
                self._responder(200, IP_DOC.encode())

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                bruto = self.rfile.read(n)
                with dono.trava:
                    dono.recebidos.append({'cabecalhos': {k.lower(): v for k, v in self.headers.items()},
                                           'corpo': json.loads(bruto.decode('utf-8'))})
                    resposta = dono.respostas.pop(0) if dono.respostas else 200
                if resposta == 'lento':
                    time.sleep(1.5)
                    resposta = 200
                self._responder(resposta, b'{"ok":true}' if resposta < 300 else b'{"erro":"recusado pelo teste"}')

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        porta = self.srv.server_address[1]
        self.url = f'http://127.0.0.1:{porta}/functions/v1/ponte-dominio'
        self.ip_url = f'http://127.0.0.1:{porta}/ip'

    def zerar(self, *respostas):
        with self.trava:
            self.respostas = list(respostas)
            self.recebidos = []
            self.gets = []

    def fechar(self):
        self.srv.shutdown()


def porta_fechada():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    porta = s.getsockname()[1]
    s.close()
    return f'http://127.0.0.1:{porta}/fora-do-ar'


# ---------------------------------------------------------------- ajudantes

def pasta_nova():
    p = pathlib.Path(tempfile.mkdtemp(prefix='ponte-teste-'))
    PASTAS.append(p)
    return p


def escrever_config(pasta, url=None, conexao=CONEXAO, chave_publica=CHAVE_PUBLICA, chave_ponte=SEGREDO, meses=None):
    linhas = ['[dominio]', f'conexao = {conexao}' if conexao else '', '[sistema]',
              f'url = {url}' if url else '',
              f'chave_publica = {chave_publica}' if chave_publica else '',
              f'chave_ponte = {chave_ponte}' if chave_ponte else '',
              '[rodada]', f'meses = {meses}' if meses is not None else '']
    (pasta / 'config.ini').write_text('\n'.join(linhas) + '\n', encoding='utf-8')


def ponte(pasta, *args, ip_url=None, timeout_req='5'):
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT=timeout_req,
               PONTE_IP_URL=ip_url or 'http://127.0.0.1:9/sem-ip', PYTHONIOENCODING='utf-8',
               PYTHONDONTWRITEBYTECODE='1')
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=180)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def rodar_dentro(pasta, url, **opcoes):
    """A rodada de verdade (sem --falso), aqui dentro do processo, com o Domínio trocado pelo de mentira — é o caminho
    que mexe nos pendentes, que o --falso não toca. Devolve (código de saída, o que foi pra tela)."""
    import contextlib
    import io
    from ponte import rodada, fonte_dominio
    from ponte.fonte_falsa import FonteFalsa
    escrever_config(pasta, url=url)
    guardado = {k: os.environ.get(k) for k in ('PONTE_PASTA', 'PONTE_ESPERAS', 'PONTE_TIMEOUT')}
    os.environ.update(PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5')
    original = fonte_dominio.FonteDominio
    fonte_dominio.FonteDominio = lambda conexao, **k: FonteFalsa()
    tela = io.StringIO()
    try:
        with contextlib.redirect_stdout(tela):
            cod = rodada.rodar(**opcoes)
    finally:
        fonte_dominio.FonteDominio = original
        for k, v in guardado.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return cod, tela.getvalue()


def pendentes(pasta):
    p = pasta / 'pendentes'
    return sorted(p.glob('*.json')) if p.is_dir() else []


def logs(pasta):
    p = pasta / 'logs'
    return '\n'.join(a.read_text(encoding='utf-8') for a in sorted(p.glob('*.log'))) if p.is_dir() else ''


def ontem():
    return datetime.date.today() - datetime.timedelta(days=1)


def comps_esperadas(n, ate=None):
    d = ate or ontem()
    ano, mes, saida = d.year, d.month, []
    for _ in range(n):
        saida.append(f'{ano:04d}-{mes:02d}')
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
    return saida[::-1]


class Anotador:
    """Faz as vezes do registro da ponte nos testes de dentro do processo: guarda as linhas, já ocultadas."""

    def __init__(self, segredos=()):
        from ponte.log import ocultar
        self.linhas, self._ocultar, self.segredos = [], ocultar, list(segredos)

    def __call__(self, msg, nivel='info'):
        self.linhas.append(self._ocultar(msg, self.segredos))


# ---------------------------------------------------------------- 1 e 2: o pacote do Domínio de mentira

def caso_pacote():
    titulo('1. rodar --falso --sem-enviar: o pacote')
    pasta = pasta_nova()                      # sem config.ini: --falso --sem-enviar não precisa de nenhum
    saida = pasta / 'pacote.json'
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', '--saida', str(saida))
    ok(cod == 0, f'sai com 0 (saiu {cod})')
    ok(saida.is_file(), 'gravou o pacote no --saida')
    if not saida.is_file():
        print(out)
        return
    texto = saida.read_text(encoding='utf-8')
    p = json.loads(texto)
    ok(p['versao'] == 1 and set(p) == {'versao', 'rodada', 'empresas', 'mensal', 'faltou'}, 'versão 1, só as cinco chaves do contrato')
    r = p['rodada']
    ok(set(r) == {'id', 'inicio', 'fim', 'dados_ate', 'maquina', 'ponte'}, 'rodada com id, inicio, fim, dados_ate, maquina, ponte')
    ok(r['dados_ate'] == ontem().isoformat(), f"dados_ate é ontem ({r['dados_ate']})")
    ok(re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', r['id']) is not None, 'id é um uuid4')
    hora_com_fuso = r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d'
    ok(re.fullmatch(hora_com_fuso, r['inicio']) and re.fullmatch(hora_com_fuso, r['fim']) and r['inicio'] <= r['fim'],
       'inicio e fim com o fuso do PC, inicio <= fim')
    ok(bool(r['maquina']) and r['ponte'] == '0.1.0', 'maquina preenchida, ponte 0.1.0')

    emp = {e['codigo']: e for e in p['empresas']}
    ok(sorted(emp) == [101, 102, 103, 104], 'as 4 empresas inventadas, pelo código')
    ok(all(set(e) == CONTRATO_EMPRESA for e in p['empresas']), 'cada empresa só com codigo, documento, nome, ativa (o contrato da fila)')
    ok(all(type(e['codigo']) is int and type(e['ativa']) is bool and isinstance(e['nome'], str)
           and re.fullmatch(r'[0-9A-Z]+', e['documento']) for e in p['empresas']),
       'tipos: codigo inteiro, ativa verdadeiro/falso, nome texto, documento sem pontuação')
    ok(emp[104]['documento'] == '44555666000100', 'documento com pontuação sai sem (44.555.666/0001-00)')
    ok(emp[103]['ativa'] is False and emp[101]['ativa'] is True, 'a inativa vai com ativa = false')

    comps = comps_esperadas(3)
    ok(len(p['mensal']) == 12, f"12 linhas mensais = 4 empresas × 3 meses (vieram {len(p['mensal'])})")
    ok(sorted({l['competencia'] for l in p['mensal']}) == comps, f'as 3 competências até o mês de ontem: {", ".join(comps)}')
    ok(all(list(l) == CONTRATO_MENSAL for l in p['mensal']), 'cada linha mensal com os campos do contrato da fila, nessa ordem')
    inteiros = ('funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore', 'notas_saida', 'notas_entrada', 'lancamentos')
    ok(all(l[c] is None or type(l[c]) is int for l in p['mensal'] for c in inteiros), 'contagens: inteiro ou null')
    ok(all(l[c] is None or type(l[c]) is float for l in p['mensal'] for c in ('valor_saidas', 'valor_entradas')),
       'valores: número com casas (o Decimal do ODBC vira número) ou null')
    ok(all(l['ultimo_lancamento'] is None or re.fullmatch(r'\d{4}-\d\d-\d\d', l['ultimo_lancamento']) for l in p['mensal']),
       'ultimo_lancamento: data AAAA-MM-DD ou null')
    ok(all(l['ultimo_lancamento'] is None or l['ultimo_lancamento'] <= r['dados_ate'] for l in p['mensal']),
       'nenhum lançamento depois de dados_ate')

    linhas = {(l['codigo'], l['competencia']): l for l in p['mensal']}
    ok(all(v is None for c in comps for k, v in linhas[(103, c)].items() if k not in ('codigo', 'competencia')),
       'a 103 (inativa, sem nada) sai com tudo null — nada de 0 inventado')
    ok(all(linhas[(104, c)]['lancamentos'] is None and linhas[(104, c)]['ultimo_lancamento'] is None for c in comps),
       'a 104 sem contabilidade: lancamentos e ultimo_lancamento null')
    ok(all(linhas[(102, c)]['funcionarios_ativos'] == 0 for c in comps), 'a 102 sem funcionário: 0 de verdade continua 0')
    sem_nota = [c for c in comps if int(c[5:]) % 2 == 1]
    com_nota = [c for c in comps if int(c[5:]) % 2 == 0]
    ok(all(linhas[(102, c)]['notas_saida'] is None and linhas[(102, c)]['valor_saidas'] is None for c in sem_nota)
       and all(linhas[(102, c)]['notas_saida'] == 25 for c in com_nota),
       f'a 102 no mês sem nota ({", ".join(sem_nota)}): fiscal null; nos outros, com nota')
    m = lambda c: int(c[5:])
    ok(all(linhas[(101, c)]['valor_saidas'] == round(84211.50 + m(c), 2) and linhas[(101, c)]['valor_entradas'] == 51003.10
           and linhas[(101, c)]['notas_saida'] == 300 + m(c) and linhas[(101, c)]['notas_entrada'] == 40 + m(c) for c in comps),
       'os valores da 101 (o Decimal do ODBC) chegam com os centavos e cada um no seu campo')
    ok(all(linhas[(104, c)]['valor_saidas'] == 18000.0 and linhas[(104, c)]['valor_entradas'] == 950.25 for c in comps)
       and all(linhas[(102, c)]['valor_saidas'] == 7300.4 and linhas[(102, c)]['valor_entradas'] == 2100.0 for c in com_nota),
       'os valores da 104 e da 102 (inteiro e número com casas) também')
    ok(all(linhas[(101, c)]['funcionarios_ativos'] == 4 + m(c) % 3 and linhas[(101, c)]['admissoes'] == m(c) % 2
           and linhas[(101, c)]['pro_labore'] == 2 and linhas[(102, c)]['pro_labore'] == 1 for c in comps),
       'a folha: funcionários, admissões e pró-labore de cada empresa')
    ok(p['faltou'] == [], 'faltou vazio (o Domínio de mentira tem os quatro blocos)')
    ok('4 empresa(s)' in out and '12 linha(s)' in out, 'mostra o resumo na tela')
    ok(pendentes(pasta) == [], '--sem-enviar não deixa nada em pendentes')

    titulo('2. campo a mais vindo da fonte não sai no pacote')
    ok('nome_funcionario' not in texto and 'FULANO' not in texto and 'salario' not in texto and '1234.56' not in texto,
       'o nome e o salário de funcionário que a folha de mentira devolve não estão no pacote')
    from ponte.fonte_falsa import FonteFalsa
    from ponte import pacote

    class Suja(FonteFalsa):
        def empresas(self):
            return [dict(e, cpf_do_socio='000.000.000-00', SENHA_ERP='x') for e in super().empresas()]

        def fiscal(self, mes):
            return [dict(l, nome_do_cliente_da_nota='CONSUMIDOR INVENTADO') for l in super().fiscal(mes)]

    reg = Anotador()
    pc = pacote.montar(Suja(), 2, reg)
    t2 = json.dumps(pc, ensure_ascii=False)
    ok('cpf_do_socio' not in t2 and 'SENHA_ERP' not in t2 and 'nome_do_cliente_da_nota' not in t2 and 'CONSUMIDOR' not in t2,
       'colunas a mais em empresas e no fiscal também ficam de fora')


# ---------------------------------------------------------------- 3: consultas a conferir, erro, sem contar

class ConexaoFalsa:
    """Uma conexão ODBC de mentira: responde pela marca /*bloco*/ que cada .sql de teste carrega."""

    def __init__(self, respostas):
        self.respostas, self.executados, self.fechada = respostas, [], False

    def cursor(self):
        dono = self

        class Cursor:
            description = None

            def execute(self, sql, params=None):
                bloco = re.search(r'/\*(\w+)\*/', sql).group(1)
                dono.executados.append((bloco, tuple(params or ())))
                r = dono.respostas[bloco]
                if isinstance(r, Exception):
                    raise r
                cols, self._linhas = r(params) if callable(r) else r
                self.description = [(c,) for c in cols]

            def fetchall(self):
                return list(self._linhas)

            def close(self):
                pass

        return Cursor()

    def close(self):
        self.fechada = True


def consultas(pasta, **sql):
    pasta.mkdir(parents=True, exist_ok=True)
    for bloco in ('empresas', 'folha', 'fiscal', 'contabil'):
        (pasta / f'{bloco}.sql').write_text(sql.get(bloco, '-- A CONFERIR: falta a documentação da Domínio\n'), encoding='utf-8')
    return pasta


def caso_a_conferir(sis):
    titulo('3. consulta "-- A CONFERIR", sem a de empresas, consulta que não veio contada ou com erro')
    from ponte.fonte_dominio import FonteDominio
    from ponte import pacote
    ate = datetime.date(2026, 10, 21)
    respostas = {
        'empresas': (['CODIGO', 'DOCUMENTO', 'NOME', 'ATIVA'],          # maiúsculas, como o SQL Anywhere devolve
                     [(1, '11222333000100', 'EMPRESA UM (INVENTADA)', 'A'), (2, '22333444000100', 'EMPRESA DOIS (INVENTADA)', 'I')]),
        'folha': lambda prm: (['codigo', 'funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore'],
                              [(1, 3, 0, 0, 0, 1)]),
        'contabil': (['codigo', 'lancamentos', 'ultimo_lancamento'], [(1, 10, datetime.date(2026, 9, 30)), (2, 4, None)]),
    }
    p = pasta_nova()
    fonte = FonteDominio(CONEXAO, consultas(p / 'c1', empresas='/*empresas*/ SELECT 1', folha='/*folha*/ SELECT 1',
                                             contabil='/*contabil*/ SELECT 1'),
                         conectar=lambda s: con)
    con = ConexaoFalsa(respostas)
    reg = Anotador()
    pc = pacote.montar(fonte, 2, reg, dados_ate=ate)
    fonte.fechar()
    ok(pc['faltou'] == [{'bloco': 'fiscal', 'motivo': 'consulta a conferir'}], 'o fiscal "A CONFERIR" vai pro faltou')
    ok(all(l['notas_saida'] is None and l['valor_entradas'] is None for l in pc['mensal']), 'e os campos dele saem null')
    ok(not any(b == 'fiscal' for b, _ in con.executados), 'a consulta a conferir não roda')
    ok(all(l['funcionarios_ativos'] == 3 for l in pc['mensal'] if l['codigo'] == 1) and
       all(l['lancamentos'] == (10 if l['codigo'] == 1 else 4) for l in pc['mensal']),
       'os outros blocos entram (folha e contábil)')
    ok({e['codigo']: e['ativa'] for e in pc['empresas']} == {1: True, 2: False}, "'A'/'I' do Domínio viram ativa true/false")
    folhas = [prm for b, prm in con.executados if b == 'folha']
    ok(folhas == [(datetime.date(2026, 9, 1), datetime.date(2026, 9, 30)), (datetime.date(2026, 10, 1), datetime.date(2026, 10, 31))],
       'folha recebe pelo ? o primeiro e o último dia de cada mês')
    ok(con.fechada and 'pyodbc' not in sys.modules, 'a conexão é fechada no fim, e o pyodbc nem foi importado')

    def nao_conecta(s):
        raise AssertionError('não era pra conectar')
    fonte = FonteDominio(CONEXAO, consultas(p / 'c2', folha='/*folha*/ SELECT 1'), conectar=nao_conecta)
    try:
        pacote.montar(fonte, 3, Anotador())
        ok(False, 'sem a consulta de empresas a montagem para')
    except pacote.SemEmpresas:
        ok(True, 'sem a consulta de empresas a montagem para (SemEmpresas) — e nem conecta no banco')
    except AssertionError as e:
        ok(False, str(e))

    respostas2 = dict(respostas)
    respostas2['folha'] = (['codigo', 'funcionarios_ativos'], [(1, 1), (1, 1), (1, 1)])   # uma linha por funcionário
    respostas2['contabil'] = RuntimeError(f'[SQL Anywhere] erro de teste na conexão PWD={SENHA};UID=EXTERNO')
    con = ConexaoFalsa(respostas2)
    fonte = FonteDominio(CONEXAO, consultas(p / 'c3', empresas='/*empresas*/ SELECT 1', folha='/*folha*/ SELECT 1',
                                             contabil='/*contabil*/ SELECT 1'), conectar=lambda s: con)
    reg = Anotador(segredos=[CONEXAO, SENHA])
    pc = pacote.montar(fonte, 2, reg, dados_ate=ate)
    motivos = {f['bloco']: f['motivo'] for f in pc['faltou']}
    ok(motivos.get('folha', '').startswith('mais de uma linha'), 'folha que veio uma linha por funcionário fica de fora (não veio contada)')
    ok(motivos.get('contabil') == 'erro na consulta', 'contábil com erro no banco fica de fora, sem derrubar a rodada')
    ok(all(l['funcionarios_ativos'] is None and l['lancamentos'] is None for l in pc['mensal']), 'os dois saem null inteiros')
    ok(not any(SENHA in l for l in reg.linhas) and any('erro na consulta' in l or 'deu erro' in l for l in reg.linhas),
       'o erro vai pro log sem a senha que vinha na mensagem do driver')

    pasta = pasta_nova()
    escrever_config(pasta, url=sis.url)
    sis.zerar()
    cod, out = ponte(pasta, 'rodar')                 # o Domínio de verdade, com as consultas do repositório
    ok(cod == 0 and len(sis.recebidos) == 0, f'pelo programa, com as consultas do repositório (todas a conferir): sai com 0 e nada é mandado (saiu {cod}, {len(sis.recebidos)} envio(s))')
    ok('A CONFERIR' in out and 'A CONFERIR' in logs(pasta), 'e avisa na tela e no log')


# ---------------------------------------------------------------- 4 e 5: o envio

def caso_envio(sis):
    titulo('4. envio: tentar de novo, recusado, pendentes')
    pasta = pasta_nova()
    escrever_config(pasta, url=sis.url)
    sis.zerar(503, 503, 200)
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 0 and len(sis.recebidos) == 3, f'503, 503, 200: foi na terceira e sai com 0 (saiu {cod}, {len(sis.recebidos)} tentativa(s))')
    ok(pendentes(pasta) == [], 'nada em pendentes')
    ok(len({json.dumps(r['corpo'], sort_keys=True) for r in sis.recebidos}) == 1, 'as três tentativas mandam o mesmo pacote')

    titulo('5. os cabeçalhos')
    cab = sis.recebidos[-1]['cabecalhos']
    ok(cab.get('x-chave') == SEGREDO, 'x-chave = a chave da ponte')
    ok(cab.get('apikey') == CHAVE_PUBLICA and cab.get('authorization') == f'Bearer {CHAVE_PUBLICA}',
       'apikey e Authorization: Bearer = a chave pública')
    ok(cab.get('content-type', '').startswith('application/json'), 'Content-Type: application/json')
    ok(sis.recebidos[-1]['corpo']['versao'] == 1 and len(sis.recebidos[-1]['corpo']['empresas']) == 4, 'o corpo é o pacote')

    titulo('4. (continuação)')
    sis.zerar(401)
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 2 and len(sis.recebidos) == 1, f'401: não repete e sai com 2 (saiu {cod}, {len(sis.recebidos)} tentativa(s))')
    ok(pendentes(pasta) == [], '401: nada em pendentes')

    sis.zerar('lento', 200)
    cod, out = ponte(pasta, 'rodar', '--falso', timeout_req='0.5')
    ok(cod == 0 and len(sis.recebidos) == 2, f'tempo esgotado na primeira: tenta de novo e vai (saiu {cod}, {len(sis.recebidos)} tentativa(s))')

    print('   — o --falso não toca nos pendentes')
    de_verdade = pasta / 'pendentes' / f'{(datetime.date.today() - datetime.timedelta(days=1)):%Y%m%d}-070000-cccccccc.json'
    de_verdade.parent.mkdir(exist_ok=True)
    de_verdade.write_text(json.dumps({'versao': 1, 'rodada': {'id': 'cccccccc-de-verdade'}}), encoding='utf-8')
    sis.zerar()
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 0 and len(sis.recebidos) == 1 and sis.recebidos[0]['corpo']['rodada']['id'] != 'cccccccc-de-verdade'
       and de_verdade.exists(), 'o pendente de verdade não vai pro sistema de mentira e continua na fila')
    escrever_config(pasta, url=porta_fechada())
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 1 and pendentes(pasta) == [de_verdade],
       f'rede fora no --falso: sai com 1 e não guarda empresa inventada em pendentes (saiu {cod})')
    de_verdade.unlink()

    print('   — a rodada de verdade (o Domínio trocado pelo de mentira, dentro do processo)')
    pasta = pasta_nova()
    cod, out = rodar_dentro(pasta, porta_fechada())
    pend = pendentes(pasta)
    ok(cod == 1 and len(pend) == 1, f'rede fora: guarda em pendentes e sai com 1 (saiu {cod}, {len(pend)} pendente(s))')
    id_pendente = json.loads(pend[0].read_text(encoding='utf-8'))['rodada']['id'] if pend else None
    sis.zerar()
    cod, out = rodar_dentro(pasta, sis.url)
    ids = [r['corpo']['rodada']['id'] for r in sis.recebidos]
    ok(cod == 0 and len(ids) == 2 and ids[0] == id_pendente and ids[1] != id_pendente,
       'a rodada seguinte manda o pendente primeiro, depois a dela')
    ok(pendentes(pasta) == [], 'e apaga o pendente que foi')

    p1 = pasta / 'pendentes' / f'{(datetime.date.today() - datetime.timedelta(days=3)):%Y%m%d}-070000-dddddddd.json'
    p2 = pasta / 'pendentes' / f'{(datetime.date.today() - datetime.timedelta(days=2)):%Y%m%d}-070000-eeeeeeee.json'
    p1.parent.mkdir(exist_ok=True)
    p2.write_text(json.dumps({'versao': 1, 'rodada': {'id': 'eeeeeeee-mais-novo'}}), encoding='utf-8')
    p1.write_text(json.dumps({'versao': 1, 'rodada': {'id': 'dddddddd-mais-velho'}}), encoding='utf-8')
    sis.zerar()
    cod, out = rodar_dentro(pasta, sis.url)
    ids = [r['corpo']['rodada']['id'] for r in sis.recebidos]
    ok(ids[:2] == ['dddddddd-mais-velho', 'eeeeeeee-mais-novo'] and len(ids) == 3 and pendentes(pasta) == [],
       'vários pendentes: do mais velho pro mais novo, depois a do dia, e todos apagados')

    velho = pasta / 'pendentes' / '20250101-070000-aaaaaaaa.json'
    velho.write_text('{"versao": 1}', encoding='utf-8')
    recusavel = pasta / 'pendentes' / f'{(datetime.date.today() - datetime.timedelta(days=2)):%Y%m%d}-070000-bbbbbbbb.json'
    recusavel.write_text(json.dumps({'versao': 1, 'rodada': {'id': 'bbbbbbbb-pendente'}}), encoding='utf-8')
    sis.zerar(400, 200)
    cod, out = rodar_dentro(pasta, sis.url)
    ok(not velho.exists() and 'tinha' in logs(pasta) and 'apagado sem ser mandado' in logs(pasta),
       'pendente de mais de 30 dias é apagado, com aviso no log')
    ok(not recusavel.exists() and len(sis.recebidos) == 2 and cod == 2,
       f'pendente recusado (400) é apagado, a rodada do dia vai, e sai com 2 pra alguém olhar (saiu {cod})')

    print('   — redirecionamento')
    guarda = pasta / 'pendentes' / f'{(datetime.date.today() - datetime.timedelta(days=1)):%Y%m%d}-070000-ffffffff.json'
    guarda.write_text(json.dumps({'versao': 1, 'rodada': {'id': 'ffffffff-pendente'}}), encoding='utf-8')
    sis.zerar(302)
    cod, out = rodar_dentro(pasta, sis.url)
    ok(cod == 2 and len(sis.recebidos) == 1 and sis.gets == [],
       f'302: não segue (a chave não vai pro outro endereço), não repete e sai com 2 (saiu {cod}, {len(sis.recebidos)} POST, {len(sis.gets)} GET)')
    ok(guarda.exists() and 'redireciona' in out, 'o pendente fica, e o log diz pra conferir a url')

    escrever_config(pasta, url='https://exemplo.invalid/functions/v1/ponte-dominio')
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 2 and 'sistema de mentira' in out, '--falso não manda empresa inventada pra endereço que não é local')


# ---------------------------------------------------------------- 6 e 7: segredos e conferir

def caso_segredos(sis):
    titulo('6. segredo nunca aparece (chave da ponte, senha da conexão, chave pública, a conexão inteira)')
    pasta = pasta_nova()
    escrever_config(pasta, url=sis.url)
    saidas = []
    sis.zerar(404)
    saidas.append(ponte(pasta, 'conferir', ip_url=sis.ip_url)[1])
    sis.zerar()
    saidas.append(ponte(pasta, 'rodar', '--falso', '--saida', str(pasta / 'saida.json'))[1])
    saidas.append(rodar_dentro(pasta, porta_fechada())[1])             # a rodada de verdade, rede fora: grava pendente
    escrever_config(pasta, url=sis.url, conexao=CONEXAO + ';LINKS=tcpip(host=srv-inexistente)')
    saidas.append(ponte(pasta, 'rodar')[1])                            # o Domínio de verdade (consultas a conferir)
    arquivos = [a for a in pasta.rglob('*') if a.is_file() and a.name != 'config.ini']
    ok(any(a.parent.name == 'logs' for a in arquivos) and any(a.parent.name == 'pendentes' for a in arquivos),
       'houve log e pendente pra conferir')
    tudo = '\n'.join(saidas) + '\n'.join(a.read_text(encoding='utf-8', errors='replace') for a in arquivos)
    for nome, s in (('a chave da ponte', SEGREDO), ('a senha da conexão', SENHA), ('a chave pública', CHAVE_PUBLICA),
                    ('a string de conexão', 'ServerName=srvteste')):
        ok(s not in tudo, f'{nome} não está na tela, no log, no pacote nem nos pendentes')
    from ponte.log import ocultar
    ok(ocultar(f'Falhou: Driver=X;Pwd={{outra senha}};UID=u') == 'Falhou: Driver=X;Pwd=***;UID=u',
       'senha de conexão que o log não conhecia (PWD= na mensagem de um erro) também vira ***')

    # o Registro de verdade, com os segredos que ele mesmo tira do config.ini — a mensagem traz todos de propósito,
    # como traria um erro do driver ou do urllib (as rodadas acima nunca chegam a escrever um segredo)
    import contextlib
    import io
    from ponte import config
    from ponte.log import Registro
    guardado = os.environ.get('PONTE_PASTA')
    os.environ['PONTE_PASTA'] = str(pasta)
    try:
        escrever_config(pasta, url=sis.url)
        cfg = config.carregar()
        tela = io.StringIO()
        with contextlib.redirect_stdout(tela):
            reg = Registro(pasta / 'logs-registro', cfg.segredos())
            reg(f'erro do driver: {CONEXAO} · chave {SEGREDO} · pública {CHAVE_PUBLICA}', 'erro')
            reg.tela(f'na tela: senha {SENHA} e chave {SEGREDO}')
    finally:
        if guardado is None:
            os.environ.pop('PONTE_PASTA', None)
        else:
            os.environ['PONTE_PASTA'] = guardado
    escrito = tela.getvalue() + ''.join(a.read_text(encoding='utf-8') for a in (pasta / 'logs-registro').glob('*.log'))
    ok('***' in escrito and not any(s in escrito for s in (SEGREDO, SENHA, CHAVE_PUBLICA, 'ServerName=srvteste')),
       'o Registro da ponte, com os segredos do config.ini, oculta todos na tela e no log')


def caso_conferir(sis):
    titulo('7. conferir')
    pasta = pasta_nova()
    cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
    ok(cod == 1 and 'não achei' in out, 'sem config.ini: diz que não achou e sai com 1')

    escrever_config(pasta, url=sis.url, conexao=None, chave_publica=None, chave_ponte=None)
    cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
    ok(cod == 1, f'incompleto: sai com 1 (saiu {cod})')
    ok('[sistema] url: preenchido' in out and '[dominio] conexao: falta' in out and '[sistema] chave_publica: falta' in out
       and '[sistema] chave_ponte: falta' in out, 'diz campo a campo o que está preenchido e o que falta')
    ok(sis.url not in out and '127.0.0.1' not in out.replace(IP_DOC, ''), 'sem mostrar o valor do que está preenchido')

    shutil.copy(RAIZ / 'ponte' / 'config.exemplo.ini', pasta / 'config.ini')
    cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
    ok(cod == 1 and out.count(': ainda é o do exemplo') == 4, 'config.ini copiado do modelo e não preenchido: "ainda é o do exemplo" nos 4')
    ok('segredo-de-exemplo' not in out and 'exemplo.supabase.co' not in out, 'e nem o valor de exemplo aparece')

    escrever_config(pasta, url=sis.url)
    sis.zerar(404)
    cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
    ok(cod == 0 and 'Tudo certo na configuração' in out, f'completo: sai com 0 (saiu {cod})')
    ok('função do sistema ainda não publicada' in out, 'ping com 404: "função do sistema ainda não publicada", sem erro')
    ok(len(sis.recebidos) == 1 and sis.recebidos[0]['corpo'] == {'versao': 1, 'ping': True}
       and sis.recebidos[0]['cabecalhos'].get('x-chave') == SEGREDO, 'o ping é {"versao": 1, "ping": true}, com a chave')
    ok(f'IP de saída: {IP_DOC}' in out, 'mostra o IP de saída na tela')
    ok('Python ' in out and ' bits' in out and ('pyodbc' in out or 'Drivers ODBC' in out),
       'mostra a versão e os bits do Python e os drivers (ou como instalar o pyodbc)')
    ok(sorted(a.name for a in pasta.iterdir()) == ['config.ini'], 'conferir não grava nada (nem log)')


def caso_config_invalida(sis):
    titulo('+ configuração que não dá pra usar: url sem https://, chave em duas linhas')
    pasta = pasta_nova()
    for url, porque in (('exemplo.supabase.co/functions/v1/ponte', 'sem http(s)://'),
                        ('http://exemplo.supabase.co/functions/v1/ponte', 'http:// fora do endereço local'),
                        ('https://exemplo.supabase.co/funções/ponte', 'com acento')):
        escrever_config(pasta, url=url)
        cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
        ok(cod == 1 and '[sistema] url: inválido' in out and url not in out and 'Traceback' not in out,
           f'conferir: url {porque} sai "inválido", sem mostrar o endereço')
        sis.zerar()
        cod, out = ponte(pasta, 'rodar', '--falso')
        ok(cod == 2 and 'Traceback' not in out and 'sistema.url (inválido' in out and len(sis.recebidos) == 0,
           f'rodar: url {porque} para com 2, dizendo o que acertar, sem traceback e sem mandar nada')
    linhas = ['[dominio]', f'conexao = {CONEXAO}', '[sistema]', f'url = {sis.url}', f'chave_publica = {CHAVE_PUBLICA}',
              f'chave_ponte = {SEGREDO}', '    CONTINUACAO-DA-CHAVE']     # a chave colada em duas linhas
    (pasta / 'config.ini').write_text('\n'.join(linhas) + '\n', encoding='utf-8')
    cod, out = ponte(pasta, 'conferir', ip_url=sis.ip_url)
    ok(cod == 1 and '[sistema] chave_ponte: inválido' in out and SEGREDO not in out and 'CONTINUACAO' not in out,
       'conferir: chave colada em duas linhas sai "inválido", sem mostrar a chave')
    sis.zerar()
    cod, out = ponte(pasta, 'rodar', '--falso')
    ok(cod == 2 and SEGREDO not in out and 'CONTINUACAO' not in out and 'Traceback' not in out and len(sis.recebidos) == 0,
       'rodar: com a chave em duas linhas para com 2, sem a chave na tela e sem mandar')


def caso_meses_e_logs(sis):
    titulo('+ --meses, [rodada] meses e a limpeza dos logs')
    pasta = pasta_nova()
    saida = pasta / 'p.json'
    cod, _ = ponte(pasta, 'rodar', '--falso', '--sem-enviar', '--meses', '24', '--saida', str(saida))
    p = json.loads(saida.read_text(encoding='utf-8')) if saida.is_file() else {'mensal': []}
    ok(cod == 0 and sorted({l['competencia'] for l in p['mensal']}) == comps_esperadas(24), '--meses 24: 24 competências (carga inicial)')
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', '--meses', '25')
    ok(cod == 2 and 'de 1 a 24' in out, '--meses 25 é recusado')
    escrever_config(pasta, meses=2)
    cod, _ = ponte(pasta, 'rodar', '--falso', '--sem-enviar', '--saida', str(saida))
    p = json.loads(saida.read_text(encoding='utf-8'))
    ok(sorted({l['competencia'] for l in p['mensal']}) == comps_esperadas(2), '[rodada] meses = 2 no config.ini vale quando não tem --meses')
    antigo = pasta / 'logs' / '2000-01-01.log'
    alheio = pasta / 'logs' / 'anotacoes.log'
    antigo.write_text('velho', encoding='utf-8')
    alheio.write_text('não é da ponte', encoding='utf-8')
    ponte(pasta, 'rodar', '--falso', '--sem-enviar')
    ok(not antigo.exists() and alheio.exists(), 'log de mais de 60 dias é apagado; arquivo que não é da ponte fica')
    ok((pasta / 'logs' / f'{datetime.date.today():%Y-%m-%d}.log').is_file(), 'um arquivo de log por dia, AAAA-MM-DD.log')
    solto = 'pacote-teste-da-ponte.json'
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', '--saida', solto)   # o programa roda da raiz do repositório
    ok(cod == 0 and (pasta / solto).is_file() and not (RAIZ / solto).exists(),
       '--saida sem pasta grava na pasta da ponte, nunca na pasta de onde se roda (o repositório é público)')
    (RAIZ / solto).unlink(missing_ok=True)


def main():
    sis = Sistema()
    try:
        for caso in (caso_pacote, lambda: caso_a_conferir(sis), lambda: caso_envio(sis), lambda: caso_segredos(sis),
                     lambda: caso_conferir(sis), lambda: caso_config_invalida(sis), lambda: caso_meses_e_logs(sis)):
            try:
                caso()
            except Exception as e:   # um caso que quebra no meio não esconde os outros
                import traceback
                traceback.print_exc()
                ok(False, f'o caso parou com erro: {type(e).__name__}: {e}')
    finally:
        sis.fechar()
        for p in PASTAS:
            shutil.rmtree(p, ignore_errors=True)
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
