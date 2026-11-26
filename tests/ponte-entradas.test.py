"""Teste da ponte das datas de entrada (ponte/entradas.py, 26/11/2026) — sem a Domínio, sem o sistema e sem internet.
Precisa do Python 3.11+ e do node (o validarPacoteEntradas de verdade, de supabase/functions/ponte/entradas.js).

    python tests/ponte-entradas.test.py

A Domínio de mentira (FonteEntradasFalsa) lê o cenário de cada caso de um JSON (PONTE_ENTRADAS_FALSO), e um sistema de
mentira responde como a função `ponte` (a lista das empresas da SEDIF/DeSTDA e o pacote conferido pelo
validarPacoteEntradas, no node), numa thread, porta 0. Cada caso usa uma pasta temporária em PONTE_PASTA. Empresas,
fornecedores e chaves inventados (os CNPJs com o dígito verificador errado de propósito; as chaves com o certo).

  1. a lista e o pacote: só as empresas da lista, só a chave e a data; de fora, a nota do RS, a NFC-e, a de emitente
     pessoa física (pelo tipo do fornecedor e pelo CPF na chave), a chave inválida, a data antes da emissão e a
     repetida, contadas no log; o pacote passa pelo validarPacoteEntradas sem nenhuma recusa
  2. --sem-enviar: pede a lista, lê e conta; não manda
  3. as respostas: a lista com a chave recusada (2), o sistema fora no pacote (1, depois das tentativas), o pacote
     recusado (2); a resposta da função no log, e as recusadas sem números
  4. a divisão em pacotes (20 mil notas; a empresa com mais vai em partes, nunca repetida no mesmo pacote)
  5. o `ponte rodar` roda a etapa das datas de entrada no fim, no mesmo modo, e um erro nela não muda a rodada dos totais
  6. nada de chave ou CNPJ no log nem na tela
  +  a consulta entradas_fora.sql pronta (o comentário, as colunas, os 3 parâmetros e as regras), e a conferência da
     chave da ponte igual à da função (o dígito verificador, o CPF no lugar do CNPJ)
Termina com código 1 se alguma checagem falhar.
"""
import copy
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

sys.dont_write_bytecode = True
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
NODE = shutil.which('node')
if not NODE:
    print('O teste da ponte das datas de entrada precisa do node (o validarPacoteEntradas da função, em JavaScript).')
    sys.exit(1)
ENTRADAS_JS = RAIZ / 'supabase' / 'functions' / 'ponte' / 'entradas.js'
NOTAS_JS = RAIZ / 'supabase' / 'functions' / 'ponte' / 'notas.js'

from ponte import entradas as ent  # noqa: E402

CHAVE_PONTE = 'SEGREDO-DA-PONTE-DAS-ENTRADAS'
IMPRESSAO = hashlib.sha256(CHAVE_PONTE.encode('utf-8')).hexdigest()
CHAVE_PUBLICA = 'chave-publica-de-teste'
HOJE = '2026-11-26'
FORN = '55666777000100'                       # inventado, com o dígito verificador errado de propósito
CPF_NA_CHAVE = '000' + '52998224725'          # um CPF de exemplo com os dígitos certos, no lugar do CNPJ

PASTAS, SEGREDOS = [], set()
falhas = 0


def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond:
        falhas += 1


def titulo(t):
    print(f'\n{t}')


def pasta_nova():
    p = pathlib.Path(tempfile.mkdtemp(prefix='ponte-entradas-teste-'))
    PASTAS.append(p)
    return p


def chave(numero, uf='42', aamm='2609', cnpj=FORN, modelo='55'):
    base = f'{uf}{aamm}{cnpj}{modelo}001{numero:09d}112345678'
    ch = base + str(ent.dv_da_chave(base))
    SEGREDOS.add(ch)
    return ch


# ---------------------------------------------------------------- o node: o validarPacoteEntradas de verdade

VALIDADOR = None


def validar_no_node(p):
    r = subprocess.run([NODE, str(VALIDADOR), HOJE], input=json.dumps(p, ensure_ascii=False), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=120)
    if r.returncode != 0:
        raise RuntimeError('o validarPacoteEntradas (node) quebrou: ' + (r.stderr or '')[-500:])
    return json.loads(r.stdout)


# ---------------------------------------------------------------- o sistema de mentira

class Sistema:
    def __init__(self):
        self.trava = threading.Lock()
        self.todas = []
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
                    recusar_chave = dono.recusar_chave
                if recusar_chave or hashlib.sha256((cab.get('x-chave') or '').encode('utf-8')).hexdigest() != IMPRESSAO:
                    return self._enviar(401, {'erro': 'Chave da ponte recusada.'})
                if not isinstance(corpo, dict) or corpo.get('versao') != 1:
                    return self._enviar(422, {'erro': 'Versão do pacote desconhecida.'})
                if corpo.get('tipo') == 'entradas' and corpo.get('pedir') == 'empresas':
                    with dono.trava:
                        dono.listas += 1
                        return self._enviar(200, {'empresas': copy.deepcopy(dono.empresas), 'desde': dono.desde, 'ate': HOJE})
                if corpo.get('tipo') != 'entradas':
                    return self._enviar(422, {'erro': 'Nada pra fazer com este pacote.'})
                with dono.trava:
                    dono.pacotes.append({'bruto': bruto.decode('utf-8'), 'corpo': corpo})
                    fila = dono.respostas.pop(0) if dono.respostas else None
                if fila is not None:
                    return self._enviar(fila[0], {'erro': fila[1]})
                v = validar_no_node(corpo)
                with dono.trava:
                    dono.todas.append(v)
                if not v['ok']:
                    return self._enviar(422, {'erro': f"Pacote das datas de entrada recusado: {v['erro']} ({v['campo']})."})
                notas = sum(len(e['notas']) for e in v['pacote']['empresas'])
                recusadas = list(v['recusadas'])
                with dono.trava:
                    for ch in dono.recusar:
                        # a recusa da função traz a chave no campo: a ponte não a põe no log
                        recusadas.append({'codigo': 901, 'chave': ch, 'campo': f'empresas[0].notas[0].chave {ch}',
                                          'erro': f'recusada pelo teste (fornecedor {ch[6:20]})'})
                return self._enviar(200, {'ok': True, 'gravado': True, 'empresas': len(v['pacote']['empresas']), 'notas': notas,
                                          'recebidas': notas, 'achadas': max(0, notas - 1), 'atualizadas': max(0, notas - 2),
                                          'recusadas': recusadas, 'total_recusadas': len(recusadas)})

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}/functions/v1/ponte'

    def zerar(self, codigos=(), respostas=(), recusar=(), recusar_chave=False, desde='2026-09-01'):
        with self.trava:
            self.empresas = [{'codigo': c} for c in codigos]
            self.respostas = list(respostas)
            self.recusar = list(recusar)
            self.recusar_chave = recusar_chave
            self.desde = desde
            self.pacotes, self.listas = [], 0

    def notas(self):
        with self.trava:
            return [(e['codigo'], n) for p in self.pacotes for e in p['corpo']['empresas'] for n in e['notas']]

    def fechar(self):
        self.srv.shutdown()


# ---------------------------------------------------------------- o cenário e a ponte

def cenario(pasta, empresas):
    """empresas: {codigo: [linhas]} — cada linha {chave, entrada, emitente_tipo?}."""
    arq = pasta / 'cenario.json'
    arq.write_text(json.dumps({'empresas': {str(c): ls for c, ls in empresas.items()}}, ensure_ascii=False), encoding='utf-8')
    return arq


def config_ini(pasta, sis):
    (pasta / 'config.ini').write_text(
        f'[sistema]\nurl = {sis.url}\nchave_publica = {CHAVE_PUBLICA}\nchave_ponte = {CHAVE_PONTE}\n', encoding='utf-8')


SAIDAS = []


def ponte(pasta, *args, arq=None):
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5', PONTE_HOJE=HOJE,
               PONTE_IP_URL='http://127.0.0.1:9/sem-ip', PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')
    if arq:
        env['PONTE_ENTRADAS_FALSO'] = str(arq)
        env['PONTE_NOTAS_FALSO'] = str(arq.parent / 'sem-notas.json')
        (arq.parent / 'sem-notas.json').write_text('{"empresas": {}}', encoding='utf-8')
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=300, stdin=subprocess.DEVNULL)
    saida = (r.stdout or '') + (r.stderr or '')
    SAIDAS.append(saida)
    return r.returncode, saida


def entradas(pasta, *args, **k):
    return ponte(pasta, 'entradas', 'rodar', '--falso', *args, **k)


def logs(pasta):
    p = pasta / 'logs'
    return '\n'.join(a.read_text(encoding='utf-8') for a in sorted(p.glob('*.log'))) if p.is_dir() else ''


# ---------------------------------------------------------------- os casos

def caso_pacote(sis):
    titulo('1. a lista e o pacote: só a chave e a data, só das empresas da lista; o que fica de fora, contado')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    boas = [chave(1), chave(2, aamm='2610'), chave(3, cnpj='AB12CD34EF5601')]
    ruim = chave(9)
    linhas901 = [
        {'chave': boas[0], 'entrada': '2026-10-01'},                       # emitida em setembro, entrou em outubro
        {'chave': boas[1].lower(), 'entrada': '2026-10-03T00:00:00'},      # a data do ODBC, com a hora
        {'chave': boas[2], 'entrada': '2026-09-30', 'emitente_tipo': 1},
        {'chave': chave(4, uf='43'), 'entrada': '2026-10-01'},              # do RS
        {'chave': chave(5, modelo='65'), 'entrada': '2026-10-01'},          # NFC-e
        {'chave': chave(6), 'entrada': '2026-10-01', 'emitente_tipo': 2},   # o fornecedor pessoa física
        {'chave': chave(7, cnpj=CPF_NA_CHAVE), 'entrada': '2026-10-01'},    # o CPF no lugar do CNPJ
        {'chave': ruim[:43] + str((int(ruim[43]) + 1) % 10), 'entrada': '2026-10-01'},   # o dígito verificador errado
        {'chave': chave(8, aamm='2611'), 'entrada': '2026-10-20'},          # a entrada antes do mês da emissão
        {'chave': boas[0], 'entrada': '2026-10-02'},                        # repetida
    ]
    arq = cenario(pasta, {901: linhas901, 902: [], 903: [{'chave': chave(10), 'entrada': '2026-10-05'}]})
    sis.zerar(codigos=(901, 902))
    cod, out = entradas(pasta, arq=arq)
    mandadas = sis.notas()
    ok(cod == 0 and sis.listas == 1 and len(sis.pacotes) == 1, f'pediu a lista e mandou um pacote (saiu {cod}, {len(sis.pacotes)} pacote(s))')
    ok(sorted(n['chave'] for _, n in mandadas) == sorted(boas) and all(c == 901 for c, _ in mandadas),
       'só as notas de fora do RS da empresa da lista (a 903 não está nela; a 902 não tem nota e não vai)')
    ok(all(set(n) == {'chave', 'entrada'} for _, n in mandadas)
       and dict((n['chave'], n['entrada']) for _, n in mandadas)[boas[1]] == '2026-10-03',
       'só a chave e a data, a chave em maiúscula e a data sem a hora')
    pac = sis.pacotes[0]['corpo']
    ok(pac['tipo'] == 'entradas' and pac['versao'] == 1 and set(pac['rodada']) == {'id', 'inicio', 'maquina', 'ponte'}
       and pac['rodada']['ponte'] == ent.VERSAO and [e['codigo'] for e in pac['empresas']] == [901],
       'o pacote: a rodada (id, início, máquina, a versão da ponte) e as empresas com nota')
    log = logs(pasta)
    ok('entradas 901: 3 nota(s) de fora do RS' in log and '1 com a chave inválida' in log and '1 que não são NF-e (modelo 55)' in log
       and '1 do RS' in log and '2 de emitente pessoa física' in log and '1 com a data de entrada fora da janela ou antes da emissão' in log
       and '1 repetidas' in log, 'o log conta o que ficou de fora, por motivo')
    ok('entradas: pacote 1 de 1 (3 nota(s)): 3 recebida(s), 2 achada(s) na base, 1 com a data nova' in log, 'e o que o sistema respondeu')
    ok('entradas: 2 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 26/11/2026' in log, 'a janela que o sistema deu')


def caso_sem_enviar(sis):
    titulo('2. --sem-enviar: pede a lista, lê e conta; não manda')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    arq = cenario(pasta, {901: [{'chave': chave(20), 'entrada': '2026-10-01'}]})
    sis.zerar(codigos=(901,))
    cod, out = entradas(pasta, '--sem-enviar', arq=arq)
    ok(cod == 0 and sis.listas == 1 and not sis.pacotes and 'sem enviar' in out and 'entradas: 1 nota(s) de 1 empresa(s)' in out,
       f'--sem-enviar: a lista, a contagem, nenhum pacote (saiu {cod})')
    sis.zerar()
    cod, out = entradas(pasta, arq=arq)
    ok(cod == 0 and not sis.pacotes and 'nenhuma empresa da SEDIF/DeSTDA' in out, 'a lista vazia: nada a fazer')


def caso_respostas(sis):
    titulo('3. as respostas')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    arq = cenario(pasta, {901: [{'chave': chave(30), 'entrada': '2026-10-01'}, {'chave': chave(31), 'entrada': '2026-10-02'}]})
    sis.zerar(codigos=(901,), recusar_chave=True)
    cod, out = entradas(pasta, arq=arq)
    ok(cod == 2 and not sis.pacotes and 'HTTP 401' in out, f'a chave recusada na lista: sai com 2, sem mandar (saiu {cod})')
    sis.zerar(codigos=(901,), respostas=[(503, 'fora')] * 4)
    cod, out = entradas(pasta, arq=arq)
    ok(cod == 1 and len(sis.pacotes) == 4 and 'desisti depois de 4 tentativas' in out,
       f'o sistema fora: as tentativas e sai com 1 (a próxima rodada manda tudo de novo) (saiu {cod}, {len(sis.pacotes)} tentativa(s))')
    sis.zerar(codigos=(901,), respostas=[(422, 'Pacote das datas de entrada recusado: teste (rodada.id).')])
    cod, out = entradas(pasta, arq=arq)
    ok(cod == 2 and len(sis.pacotes) == 1, f'o pacote recusado: não repete, sai com 2 (saiu {cod})')
    sis.zerar(codigos=(901,), recusar=[chave(30)])
    cod, out = entradas(pasta, arq=arq)
    log = logs(pasta)
    ok(cod == 0 and 'o sistema deixou de fora 1' in log and 'recusada — empresas[0].notas[0].chave …: recusada pelo teste (fornecedor …)' in log,
       'a recusa da função vai pro log sem a chave nem o CNPJ')


def caso_pacotes():
    titulo('4. a divisão em pacotes')
    n = ent.LIMITE_NOTAS
    rodada = {'id': 'r', 'inicio': 'i', 'maquina': 'm', 'ponte': 'p'}
    nota = lambda i: {'chave': str(i), 'entrada': '2026-10-01'}
    ps = ent.pacotes([(901, [nota(i) for i in range(n - 10)]), (902, [nota(i) for i in range(30)])], rodada)
    ok([[(e['codigo'], len(e['notas'])) for e in p['empresas']] for p in ps] == [[(901, n - 10)], [(902, 30)]],
       'a empresa que não cabe no pacote vai no seguinte')
    ps = ent.pacotes([(901, [nota(i) for i in range(n + 5)]), (902, [nota(i) for i in range(3)])], rodada)
    ok([[(e['codigo'], len(e['notas'])) for e in p['empresas']] for p in ps] == [[(901, n)], [(901, 5), (902, 3)]],
       'a empresa com mais de ' + str(n) + ' notas vai em partes, nunca repetida no mesmo pacote')
    ps = ent.pacotes([(c, [nota(c)]) for c in range(1, ent.LIMITE_EMPRESAS + 2)], rodada)
    ok([len(p['empresas']) for p in ps] == [ent.LIMITE_EMPRESAS, 1], f'até {ent.LIMITE_EMPRESAS} empresas num pacote')
    ok(ent.pacotes([], rodada) == [], 'sem nota, nenhum pacote')


def caso_rodar(sis):
    titulo('5. o `ponte rodar` roda a etapa das datas de entrada no fim, no mesmo modo')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    arq = cenario(pasta, {901: [{'chave': chave(40), 'entrada': '2026-10-01'}]})
    sis.zerar(codigos=(901,))
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'entradas: rodada' in out and 'entradas: sem enviar' in out and not sis.pacotes and sis.listas == 1,
       '--falso --sem-enviar: a etapa pede a lista, lê da Domínio de mentira e não manda')
    quebrado = pasta / 'quebrado.json'
    quebrado.write_text('{isto não é json', encoding='utf-8')
    sis.zerar(codigos=(901,))
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=quebrado)
    ok(cod == 0 and 'entradas:' in out and 'Traceback' not in out,
       'um erro na etapa vai pro log e não muda o código de saída da rodada dos totais')
    pasta2 = pasta_nova()
    cod, out = ponte(pasta2, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'a etapa das datas de entrada não roda' in out, 'sem o [sistema] no config.ini: a etapa diz que não roda')


def caso_segredos():
    titulo('6. nada de chave ou CNPJ no log nem na tela')
    tudo = '\n'.join(logs(p) for p in PASTAS) + '\n'.join(SAIDAS)
    vazou = [s for s in SEGREDOS | {FORN, CPF_NA_CHAVE, CHAVE_PONTE} if s in tudo]
    ok(not vazou, f'nenhuma chave, CNPJ ou segredo no log e na tela ({len(vazou)} achado(s))')


def caso_contrato(sis):
    titulo('+ o contrato')
    ok(all(v['ok'] and not v['recusadas'] for v in sis.todas) and sis.todas,
       f'todo pacote mandado passou pelo validarPacoteEntradas sem nenhuma recusa ({len(sis.todas)} pacote(s))')
    texto = (RAIZ / 'ponte' / 'consultas' / 'entradas_fora.sql').read_text(encoding='utf-8-sig')
    codigo = '\n'.join(l.split('--', 1)[0] for l in texto.splitlines())
    comentario = '\n'.join(l for l in texto.splitlines() if l.lstrip().startswith('--'))
    from ponte.fonte_dominio import a_conferir
    regras = ["codigo_modelo = '55'", "emitente_ent = 'T'", 'NOT IN (2, 3, 4, 5)', "<> '43'", 'tins_for, 0) <> 2',
              'LENGTH(TRIM(e.chave_nfe_ent)) = 44', 'dent_ent BETWEEN']
    ok(not a_conferir(texto) and texto.lstrip().startswith('--') and '?' not in comentario and codigo.count('?') == 3
       and all(re.search(rf'\bAS\s+{c}\b', codigo, re.I) for c in ('chave', 'entrada')) and all(r in codigo for r in regras),
       'entradas_fora.sql pronta: o comentário no começo, a chave e a data, os 3 parâmetros e as regras (modelo 55, '
       'terceiro, sem cancelada, fora do RS, sem pessoa física, pela data de entrada)')
    amostras = [chave(i, uf=uf, cnpj=c) for i, (uf, c) in enumerate([('42', FORN), ('35', 'AB12CD34EF5601'), ('31', CPF_NA_CHAVE)], 50)]
    js = subprocess.run([NODE, '--input-type=module', '-e',
                         f"import {{ dvDaChave, pareceCpf }} from '{NOTAS_JS.resolve().as_uri()}';"
                         f"const a = {json.dumps(amostras)};"
                         "console.log(JSON.stringify(a.map(c => [dvDaChave(c.slice(0, 43)), pareceCpf(c.slice(6, 20))])))"],
                        capture_output=True, encoding='utf-8', timeout=60)
    py = [[ent.dv_da_chave(c[:43]), ent.parece_cpf(c[6:20])] for c in amostras]
    ok(js.returncode == 0 and json.loads(js.stdout) == py and py[2][1] is True,
       'o dígito verificador da chave e o CPF no lugar do CNPJ: a ponte confere igual à função')


def main():
    global VALIDADOR
    tmp = pasta_nova()
    VALIDADOR = tmp / 'validar.mjs'
    VALIDADOR.write_text(
        f"import {{ validarPacoteEntradas }} from '{ENTRADAS_JS.resolve().as_uri()}';\n"
        "let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => s += d);\n"
        "process.stdin.on('end', () => process.stdout.write(JSON.stringify(validarPacoteEntradas(JSON.parse(s), process.argv[2]))));\n",
        encoding='utf-8')
    sis = Sistema()
    try:
        caso_pacote(sis)
        caso_sem_enviar(sis)
        caso_respostas(sis)
        caso_pacotes()
        caso_rodar(sis)
        caso_segredos()
        caso_contrato(sis)
    finally:
        sis.fechar()
        for p in PASTAS:
            shutil.rmtree(p, ignore_errors=True)
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
