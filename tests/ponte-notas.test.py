"""Teste da ponte das notas (ponte/notas/) — sem a Domínio, sem o sistema e sem internet. Precisa do Python 3.11+ e do
node (o validarPacoteNotas de verdade, de supabase/functions/ponte/notas.js).

    python tests/ponte-notas.test.py

A Domínio de mentira (ponte/notas/falso.py) lê o cenário de cada caso de um JSON (PONTE_NOTAS_FALSO), e um sistema de
mentira responde como a função `ponte` (a lista das autorizadas e o pacote conferido pelo validarPacoteNotas, no node),
numa thread, porta 0. Cada caso usa uma pasta temporária em PONTE_PASTA. Empresas, fornecedores, produtos e valores são
todos inventados (os CNPJs com o dígito verificador errado de propósito; as chaves com o certo, montadas aqui).

  1. a lista: só as empresas dela, só as prontas (no --sem-enviar, todas), só com o documento igual ao da Domínio
  2. os itens do XML (o "SEM GTIN" nulo, a unidade tributável, o IPI e o ICMS-ST do item, o CFOP da Domínio) e o XML
     fora do pacote
  3. sem o XML: origem "dominio", o IPI do item nulo quando não bate com o da nota, e o valor quando bate
  4. a nota sem itens na Domínio: com o XML vai (o CFOP da nota, quando é um só); sem ele, não; com dois CFOPs, não
  5. só os itens de compra: a bonificação e a devolução ficam; a nota só com elas fica de fora
  6. de fora: o emitente CPF, o destinatário diferente, o finNFe 4; o XML ilegível, o sem a autorização e o de outra
     nota vão pela Domínio; o XML compactado com zlib abre
  7. a divisão em pacotes (200 notas; 4 MB)
  8. o estado: a segunda rodada não manda de novo; a que mudou vai; a recusada não vai de novo; a mandada do XML que
     perde o XML não vai de novo (e a que ganha o XML vai); a empresa que sai da lista some do estado
  9. as respostas: o 503 do destino para sem marcar; o 502 não marca e vai na próxima; o 403 não repete
  10. a janela: na primeira vez e no domingo, de `desde`; nos outros dias, três meses
  11. o `ponte rodar` roda a etapa das notas no fim, no mesmo modo, e o erro nela não muda a rodada dos totais
  12. nada de chave, CNPJ, nome de fornecedor, produto ou valor no log; o conferir mostra só os números
  +  todo pacote que a ponte mandou passou pelo validarPacoteNotas de verdade sem nenhuma recusa, e o CFOPS_DE_COMPRA
     da ponte é o mesmo da função
Termina com código 1 se alguma checagem falhar.
"""
import copy
import hashlib
import http.server
import json
import os
import pathlib
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
    print('O teste da ponte das notas precisa do node (o validarPacoteNotas da função, em JavaScript).')
    sys.exit(1)
NOTAS_JS = RAIZ / 'supabase' / 'functions' / 'ponte' / 'notas.js'

from ponte.notas import falso, pacote as pac_mod  # noqa: E402

CHAVE_PONTE = 'SEGREDO-DA-PONTE-DAS-NOTAS'
IMPRESSAO = hashlib.sha256(CHAVE_PONTE.encode('utf-8')).hexdigest()
CHAVE_PUBLICA = 'chave-publica-de-teste'
SEM_DESTINO = 'O destino das notas ainda não foi configurado no sistema.'
SEM_AUTORIZACAO = 'Esta empresa não tem autorização ativa pra mandar as notas.'
DESTINO_FORA = 'O destino das notas não recebeu agora: elas vão na próxima rodada.'
DOC_A, DOC_B, DOC_C = '11222333000100', '22333444000100', '33444555000100'    # o dígito verificador errado de propósito
FORN = '55666777000100'
FORN_NOME = 'FORNECEDOR-SECRETO-DO-TESTE LTDA'
PROD = 'PRODUTO-SECRETO-DO-TESTE'
VALOR = '4321.98'                     # um valor que só aparece nas notas

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
    p = pathlib.Path(tempfile.mkdtemp(prefix='ponte-notas-teste-'))
    PASTAS.append(p)
    return p


# ---------------------------------------------------------------- o node: o validarPacoteNotas de verdade

VALIDADOR = None


def validar_no_node(p):
    r = subprocess.run([NODE, str(VALIDADOR)], input=json.dumps(p, ensure_ascii=False), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=60)
    if r.returncode != 0:
        raise RuntimeError('o validarPacoteNotas (node) quebrou: ' + (r.stderr or '')[-500:])
    return json.loads(r.stdout)


# ---------------------------------------------------------------- o sistema de mentira

class Sistema:
    def __init__(self):
        self.trava = threading.Lock()
        self.todas = []                      # toda validação de pacote (nunca zerada)
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
                if hashlib.sha256((cab.get('x-chave') or '').encode('utf-8')).hexdigest() != IMPRESSAO:
                    return self._enviar(401, {'erro': 'Chave da ponte recusada.'})
                if not isinstance(corpo, dict) or corpo.get('versao') != 1:
                    return self._enviar(422, {'erro': 'Versão do pacote desconhecida.'})
                if corpo.get('ping'):
                    return self._enviar(200, {'ok': True, 'ponte': 'ok'})
                if corpo.get('tipo') == 'notas' and corpo.get('pedir') == 'autorizadas':
                    with dono.trava:
                        dono.listas += 1
                        return self._enviar(200, {'empresas': copy.deepcopy(dono.empresas)})
                if corpo.get('tipo') != 'notas':
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
                    return self._enviar(422, {'erro': f"Pacote de notas recusado: {v['erro']} ({v['campo']})."})
                recusadas = list(v['recusadas'])
                with dono.trava:
                    for ch in dono.recusar:
                        if any(x['chave'] == ch for x in corpo['notas']):
                            # o motivo que o destino escreve pode trazer o CNPJ: a ponte não o põe no log
                            recusadas.append({'chave': ch, 'campo': 'notas[0].itens',
                                              'erro': f'recusada pelo teste (fornecedor {ch[6:20]})'})
                return self._enviar(200, {'ok': True, 'notas': v['notas'], 'mandadas': v['notas'],
                                          'itens_fora': v['itensFora'], 'recusadas': recusadas})

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}/functions/v1/ponte'

    def zerar(self, empresas=None, respostas=(), recusar=()):
        with self.trava:
            self.empresas = copy.deepcopy(empresas or [])
            self.respostas = list(respostas)
            self.recusar = set(recusar)
            self.pacotes, self.listas = [], 0

    def notas(self):
        """As notas de todos os pacotes recebidos (que passaram do sistema de mentira), na ordem."""
        with self.trava:
            return [n for p in self.pacotes for n in p['corpo']['notas']]

    def fechar(self):
        self.srv.shutdown()


# ---------------------------------------------------------------- o cenário e a ponte

def item(n, cfop=1102, descricao=None, ipi='0', icms_st='0', total='100.00', forn_cod=None, ean='7891000100103',
         quantidade='10'):
    return {'item': n, 'produto_fornecedor': forn_cod or f'C{n}', 'descricao': descricao or f'{PROD} {n}',
            'ean': ean, 'ncm': '73181500', 'cfop': cfop, 'unidade': 'CX', 'quantidade': quantidade, 'valor_unitario': '10.00',
            'valor_total': total, 'desconto': '0', 'ipi': ipi, 'icms_st': icms_st}


def nota(numero, itens=None, cfops=None, entrada='2026-09-16', com_xml=False, xml_itens=None, xml=None, xml_zlib=False,
         emitente_doc=FORN, emitente_tipo=1, nota_ipi='0', **xml_kw):
    itens = [item(1)] if itens is None else itens
    ch = falso.chave(FORN, numero)
    SEGREDOS.add(ch)
    if com_xml and xml is None:
        xi = xml_itens or [{'n': it['item'], 'codigo': it['produto_fornecedor'], 'descricao': it['descricao'],
                            'quantidade': '10', 'valor_unitario': '10.00', 'valor_total': it['valor_total'],
                            'ean': '7891000100103', 'ean_trib': '7891000100110', 'unidade': 'CX',
                            'unidade_trib': 'UN', 'quantidade_trib': '100', 'valor_unitario_trib': '1.00'} for it in itens]
        xml = falso.xml_nfe(ch, xi, emit_nome=FORN_NOME, **xml_kw)
    total = str(sum(float(it['valor_total']) for it in itens) or 100)
    return {'chave': ch, 'entrada': entrada, 'emissao': entrada[:8] + '01', 'emitente_doc': emitente_doc,
            'emitente_tipo': emitente_tipo, 'emitente_nome': FORN_NOME, 'emitente_uf': 'SC',
            'totais': {'produtos': total, 'desconto': '0', 'frete': '0', 'ipi': nota_ipi, 'icms_st': '0', 'total': total},
            'cfops': cfops if cfops is not None else sorted({it['cfop'] for it in itens}), 'itens': itens,
            'xml': xml, 'xml_zlib': xml_zlib}


def cenario(pasta, empresas):
    """empresas: {codigo: (documento, [notas])}."""
    arq = pasta / 'cenario.json'
    arq.write_text(json.dumps({'empresas': {str(c): {'documento': d, 'notas': ns} for c, (d, ns) in empresas.items()}},
                              ensure_ascii=False), encoding='utf-8')
    return arq


def lista(*empresas):
    """(codigo, documento, desde, pronta)."""
    return [{'codigo': c, 'documento': d, 'desde': desde, 'pronta': pronta} for c, d, desde, pronta in empresas]


def config_ini(pasta, sis, url=None):
    (pasta / 'config.ini').write_text(
        f'[sistema]\nurl = {url or sis.url}\nchave_publica = {CHAVE_PUBLICA}\nchave_ponte = {CHAVE_PONTE}\n',
        encoding='utf-8')


SAIDAS = []


def ponte(pasta, *args, hoje='2026-11-04', arq=None):
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5',
               PONTE_HOJE=hoje, PONTE_IP_URL='http://127.0.0.1:9/sem-ip', PYTHONIOENCODING='utf-8',
               PYTHONDONTWRITEBYTECODE='1')
    if arq:
        env['PONTE_NOTAS_FALSO'] = str(arq)
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=300, stdin=subprocess.DEVNULL)
    saida = (r.stdout or '') + (r.stderr or '')
    SAIDAS.append(saida)
    return r.returncode, saida


def notas(pasta, *args, **k):
    return ponte(pasta, 'notas', 'rodar', '--falso', *args, **k)


def estado(pasta):
    arq = pasta / 'notas' / 'estado.json'
    return json.loads(arq.read_text(encoding='utf-8')) if arq.is_file() else None


def logs(pasta):
    p = pasta / 'logs'
    return '\n'.join(a.read_text(encoding='utf-8') for a in sorted(p.glob('*.log'))) if p.is_dir() else ''


def por_chave(ns):
    return {n['chave']: n for n in ns}


# ---------------------------------------------------------------- os casos

def caso_lista(sis):
    titulo('1. a lista: só as da lista, só as prontas (no --sem-enviar, todas), só com o documento da Domínio')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    a, b, c, d = nota(1), nota(2), nota(3), nota(4)
    arq = cenario(pasta, {901: (DOC_A, [a]), 902: (DOC_B, [b]), 903: ('99999999000100', [c]), 904: (DOC_C, [d])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', False),
                    (903, DOC_C, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    recebidas = por_chave(sis.notas())
    ok(cod == 0 and set(recebidas) == {a['chave']},
       f'manda só a da lista, pronta e com o documento igual (saiu {cod}, {len(recebidas)} nota(s))')
    ok('documento diferente' in out and 'sem o destino pronto' in out, 'o log diz o documento diferente e a não pronta')
    ok(sis.listas == 1, 'pediu a lista uma vez')
    pasta2 = pasta_nova()
    config_ini(pasta2, sis)
    sis.zerar(lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', False)))
    saida = pasta2 / 'saida.json'
    cod, out = notas(pasta2, '--sem-enviar', '--saida', str(saida), arq=arq)
    gravado = json.loads(saida.read_text(encoding='utf-8'))
    chaves = {n['chave'] for p in gravado['pacotes'] for n in p['notas']}
    ok(cod == 0 and not sis.pacotes and chaves == {a['chave'], b['chave']} and estado(pasta2) is None,
       f'--sem-enviar: lê todas (as prontas e as não), não manda nem grava o estado ({len(chaves)} nota(s) no --saida)')
    sis.zerar([])
    pasta3 = pasta_nova()
    config_ini(pasta3, sis)
    cod, out = notas(pasta3, arq=arq)
    ok(cod == 0 and 'nenhuma empresa autorizada' in out and 'consultas em' not in out,
       'lista vazia: nada a fazer, e nem abre a Domínio')


def caso_xml(sis):
    titulo('2. os itens do XML, com o CFOP da Domínio, e o XML fora do pacote')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    itens = [item(1, ipi='5.25', icms_st='3.10'), item(2, ean=None)]
    xi = [{'n': 1, 'codigo': 'FORN-1', 'descricao': 'DESCRICAO DO XML 1', 'quantidade': '2', 'valor_unitario': '50.00',
           'valor_total': '100.00', 'ean': 'SEM GTIN', 'ean_trib': '7891000100110', 'unidade': 'CX', 'unidade_trib': 'UN',
           'quantidade_trib': '24', 'valor_unitario_trib': '4.1666666667', 'ipi': '5.25', 'icms_st': '3.10'},
          {'n': 2, 'codigo': 'FORN-2', 'descricao': 'DESCRICAO DO XML 2', 'quantidade': '1', 'valor_unitario': '100.00',
           'valor_total': '100.00', 'ean': '7891000100103'}]
    n = nota(10, itens=[item(1, cfop=1102, quantidade='2'), item(2, cfop=2102, quantidade='1')], com_xml=True, xml_itens=xi,
             totais={'produtos': '200.00', 'ipi': '5.25', 'icms_st': '3.10', 'total': '208.35', 'frete': '0', 'desconto': '0'})
    arq = cenario(pasta, {901: (DOC_A, [n])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    x = (sis.notas() or [None])[0]
    ok(cod == 0 and x and x['origem'] == 'xml', 'a nota vai com origem "xml"')
    if x:
        i1, i2 = x['itens']
        ok(i1['codigo'] == 'FORN-1' and i1['descricao'] == 'DESCRICAO DO XML 1' and i1['ean'] is None
           and i1['ean_trib'] == '7891000100110' and i1['unidade_trib'] == 'UN' and i1['quantidade_trib'] == 24
           and abs(i1['valor_unitario_trib'] - 4.1666666667) < 1e-9,
           'o item do XML: o cProd, o xProd, o "SEM GTIN" nulo e a unidade tributável')
        ok(i1['ipi'] == 5.25 and i1['icms_st'] == 3.1 and i2['ipi'] == 0 and i2['icms_st'] == 0,
           'o IPI e o ICMS-ST do item (0 sem eles)')
        ok(i1['cfop'] == '1102' and i2['cfop'] == '2102', 'o CFOP de cada item vem da Domínio, pelo número do item')
        ok(x['totais'] == {'produtos': 200.0, 'desconto': 0.0, 'frete': 0.0, 'ipi': 5.25, 'icms_st': 3.1, 'total': 208.35},
           'os totais do ICMSTot')
        ok(x['emitente']['nome'] == FORN_NOME and x['emitente']['cnpj'] == x['chave'][6:20], 'o emitente do XML, o CNPJ da chave')
    bruto = sis.pacotes[0]['bruto'] if sis.pacotes else ''
    ok(bruto and 'nfeProc' not in bruto and 'infNFe' not in bruto and 'xmlns' not in bruto, 'o XML não está no pacote mandado')
    ok('produto_empresa' not in bruto and 'C1' not in json.dumps([i.get('codigo') for i in (x or {}).get('itens', [])]),
       'o código do produto no cadastro do cliente não vai')


def caso_par(sis):
    titulo('2b. o CFOP do item do XML: o mesmo item da Domínio (a quantidade e o valor), não só o número')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    xi = [{'n': 1, 'codigo': 'F1', 'descricao': 'COMPRA', 'quantidade': '2', 'valor_unitario': '50.00', 'valor_total': '100.00'},
          {'n': 2, 'codigo': 'F2', 'descricao': 'BRINDE', 'quantidade': '1', 'valor_unitario': '50.00', 'valor_total': '50.00'}]
    # a Domínio numerou ao contrário: o 1 dela é o brinde, o 2 é a compra
    invertida = nota(40, itens=[item(1, cfop=1910, quantidade='1', total='50.00'), item(2, cfop=1102, quantidade='2', total='100.00')],
                     com_xml=True, xml_itens=xi)
    # nenhum item da Domínio com a quantidade e o valor do XML: um CFOP só na nota (vai com ele) e dois (fica de fora)
    xs = [{'n': 1, 'codigo': 'F1', 'descricao': 'COMPRA', 'quantidade': '3', 'valor_unitario': '10.00', 'valor_total': '30.00'}]
    um_cfop = nota(41, itens=[item(1, cfop=1102)], cfops=[1102], com_xml=True, xml_itens=xs)
    dois_cfops = nota(42, itens=[item(1, cfop=1102), item(2, cfop=1910)], cfops=[1102, 1910], com_xml=True, xml_itens=xs)
    arq = cenario(pasta, {901: (DOC_A, [invertida, um_cfop, dois_cfops])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    a, b = r.get(invertida['chave']), r.get(um_cfop['chave'])
    ok(cod == 0 and a and [(i['descricao'], i['cfop']) for i in a['itens']] == [('COMPRA', '1102')],
       'a Domínio numerada em outra ordem: a compra vai com o CFOP dela e o brinde fica (não vai como compra)')
    ok(b and b['itens'][0]['cfop'] == '1102', 'sem o mesmo item na Domínio e um CFOP só na nota: vai com o CFOP da nota')
    ok(dois_cfops['chave'] not in r, 'sem o mesmo item e dois CFOPs na nota: fica de fora (CFOP incerto)')
    log = logs(pasta)
    ok('1 item(ns) do XML sem o mesmo item na Domínio' in log and 'CFOP da nota incerto' in log,
       'o log conta o item sem par e a nota de CFOP incerto')

    # o MEI antigo tem o CPF do dono no nome empresarial: o nome sai sem ele (a comparação usa o CNPJ)
    pasta = pasta_nova()
    config_ini(pasta, sis)
    mei = nota(43)
    mei['emitente_nome'] = 'FULANO DE TAL 123.456.789-09'
    arq = cenario(pasta, {901: (DOC_A, [mei])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    x = (sis.notas() or [None])[0]
    ok(cod == 0 and x and x['emitente']['nome'] == 'FULANO DE TAL' and '123.456.789-09' not in (sis.pacotes[0]['bruto'] if sis.pacotes else 'x'),
       'o nome do fornecedor sai sem o CPF que o MEI antigo tem no nome empresarial')


def caso_dominio(sis):
    titulo('3. sem o XML: origem "dominio", o IPI do item nulo quando não bate e o valor quando bate')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    nao_bate = nota(20, itens=[item(1, ipi='0'), item(2, ipi='0')], nota_ipi='12.50')
    bate = nota(21, itens=[item(1, ipi='3.00'), item(2, ipi='2.00')], nota_ipi='5.00')
    arq = cenario(pasta, {901: (DOC_A, [nao_bate, bate])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    a, b = r.get(nao_bate['chave']), r.get(bate['chave'])
    ok(cod == 0 and a and b and a['origem'] == b['origem'] == 'dominio', 'as duas vão com origem "dominio"')
    if a and b:
        ok([i['ipi'] for i in a['itens']] == [None, None], 'a soma dos itens não bate com o IPI da nota: o IPI do item nulo')
        ok([i['ipi'] for i in b['itens']] == [3.0, 2.0], 'bate: o valor de cada item')
        ok(all(i['ean_trib'] is None and i['unidade_trib'] is None and i['quantidade_trib'] is None for i in a['itens']),
           'sem a unidade tributável (a Domínio não guarda)')
        ok(a['itens'][0]['codigo'] == 'C1' and a['emitente']['uf'] == 'SC', 'o código do fornecedor do de-para e a UF da Domínio')


def caso_sem_itens(sis):
    titulo('4. a nota sem itens na Domínio')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    xi = [{'n': 1, 'codigo': 'X1', 'descricao': 'ITEM SO NO XML', 'quantidade': '1', 'valor_unitario': '9.90',
           'valor_total': '9.90'}]
    com_xml = nota(30, itens=[], cfops=[1102], com_xml=True, xml_itens=xi)
    sem_xml = nota(31, itens=[], cfops=[1102])
    dois_cfops = nota(32, itens=[], cfops=[1102, 1403], com_xml=True, xml_itens=xi)
    arq = cenario(pasta, {901: (DOC_A, [com_xml, sem_xml, dois_cfops])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    x = r.get(com_xml['chave'])
    ok(x and x['origem'] == 'xml' and x['itens'][0]['cfop'] == '1102', 'com o XML vai, com o CFOP da nota (um só)')
    ok(sem_xml['chave'] not in r and dois_cfops['chave'] not in r, 'sem o XML não vai; com dois CFOPs na nota, também não')
    ok('sem itens na Domínio e sem o XML' in out and 'CFOP da nota incerto' in out, 'o log conta os dois motivos')


def caso_compra(sis):
    titulo('5. só os itens de compra')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    mista = nota(40, itens=[item(1, cfop=1102), item(2, cfop=1910), item(3, cfop=2202)])
    so_bonif = nota(41, itens=[item(1, cfop=1910), item(2, cfop=1202)])
    arq = cenario(pasta, {901: (DOC_A, [mista, so_bonif])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    m = r.get(mista['chave'])
    ok(m and [i['cfop'] for i in m['itens']] == ['1102'], 'a bonificação (1910) e a devolução (2202) não vão')
    ok(so_bonif['chave'] not in r and 'sem item de compra' in out, 'a nota só com elas fica de fora (o log conta)')
    ok(all(v['itensFora'] == 0 for v in sis.todas[-1:]), 'nenhum item que não é de compra chega ao sistema')


def caso_de_fora(sis):
    titulo('6. de fora: o CPF, o destinatário, o finNFe 4; o XML ilegível, sem autorização e de outra nota pela Domínio')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    cpf_dom = nota(50, emitente_doc='12345678909')
    cpf_xml = nota(51, com_xml=True, emit_cpf='12345678909')
    outro_dest = nota(52, com_xml=True, dest=DOC_B)
    devolucao = nota(53, com_xml=True, fin='4')
    ilegivel = nota(54, xml='\x00\x01lixo que não é xml\x02')
    sem_aut = nota(55, com_xml=True, cstat='110')
    outra = nota(56, com_xml=True, id_=falso.chave(FORN, 9999))
    compactado = nota(57, com_xml=True, xml_zlib=True)
    arq = cenario(pasta, {901: (DOC_A, [cpf_dom, cpf_xml, outro_dest, devolucao, ilegivel, sem_aut, outra, compactado])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    ok(not {cpf_dom['chave'], cpf_xml['chave'], outro_dest['chave'], devolucao['chave']} & set(r),
       'o emitente CPF (na Domínio e no XML), o destinatário diferente e o finNFe 4 não vão')
    ok('emitente pessoa física' in out and 'destinatário diferente' in out and 'finalidade' in out, 'o log conta os motivos')
    ok(all(r.get(n['chave'], {}).get('origem') == 'dominio' for n in (ilegivel, sem_aut, outra)),
       'o XML ilegível, o sem a autorização e o de outra nota: vão pela Domínio')
    ok('XML ilegível' in out and 'XML sem a autorização' in out and 'XML de outra nota' in out, 'o log conta os três')
    ok(r.get(compactado['chave'], {}).get('origem') == 'xml', 'o XML compactado com zlib abre')


def caso_pacotes(sis):
    titulo('7. a divisão em pacotes (200 notas; 4 MB)')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    ns = [nota(1000 + i) for i in range(205)]
    arq = cenario(pasta, {901: (DOC_A, ns)})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    tamanhos = [len(p['corpo']['notas']) for p in sis.pacotes]
    ok(cod == 0 and tamanhos == [200, 5], f'205 notas: um pacote de 200 e um de 5 ({tamanhos})')
    grande = {'chave': 'X', 'itens': ['y' * 1024] * 4200}
    pequenas = [{'chave': f'n{i}', 'itens': ['y' * 1024] * 400} for i in range(12)]
    pacs, grandes = pac_mod.dividir(pequenas + [grande], {'codigo': 1, 'documento': DOC_A},
                                    {'id': 'x', 'inicio': 'x', 'maquina': 'x', 'ponte': 'x'})
    ok(all(len(json.dumps(p, ensure_ascii=False).encode('utf-8')) <= pac_mod.LIMITE_BYTES for p in pacs)
       and sum(len(p['notas']) for p in pacs) == 12 and len(pacs) >= 2 and len(grandes) == 1,
       f'pelo tamanho: nenhum pacote passa de 4 MB ({len(pacs)} pacote(s)); a nota maior que 4 MB fica de fora')


def caso_estado(sis):
    titulo('8. o estado')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    a, b, rec = nota(60), nota(61, com_xml=True), nota(62)
    arq = cenario(pasta, {901: (DOC_A, [a, b, rec]), 902: (DOC_B, [nota(63)])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', True)), recusar=[rec['chave']])
    cod, out = notas(pasta, arq=arq)
    ok(cod == 0 and len(sis.notas()) == 4, f'a primeira rodada manda as 4 ({len(sis.notas())})')
    ok('recusada pelo teste (fornecedor …)' in logs(pasta) and rec['chave'][6:20] not in logs(pasta),
       'a recusa vai pro log sem os números que o destino escreveu (o CNPJ, a chave)')
    e = estado(pasta)
    campos = set(e['empresas']['901']['notas'][a['chave']]) if e else set()
    ok(campos == {'entrada', 'impressao', 'origem', 'mandada_em'}, 'o estado guarda só a entrada, a impressão, o origem e quando')
    sis.zerar(lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    ok(cod == 0 and not sis.pacotes, 'a segunda rodada não manda de novo (nem a recusada)')
    a['itens'][0]['quantidade'] = '11'
    b['xml'] = None                          # a Domínio apagou o XML: a nota passaria a sair dela
    c_ganha = nota(64)
    arq = cenario(pasta, {901: (DOC_A, [a, b, rec, c_ganha]), 902: (DOC_B, [nota(63)])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    ok(set(r) == {a['chave'], c_ganha['chave']}, 'a que mudou vai; a mandada do XML que perdeu o XML não vai de novo')
    ok('já mandada(s) com o XML' in out, 'o log conta a que já foi com o XML')
    ok(estado(pasta)['empresas']['901']['notas'][b['chave']]['origem'] == 'xml', 'o estado continua com a do XML')
    c_ganha['xml'] = falso.xml_nfe(c_ganha['chave'], [{'n': 1, 'codigo': 'Z', 'descricao': 'COM XML AGORA',
                                                       'quantidade': '10', 'valor_unitario': '10.00', 'valor_total': '100.00'}])
    arq = cenario(pasta, {901: (DOC_A, [a, b, rec, c_ganha]), 902: (DOC_B, [nota(63)])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    r = por_chave(sis.notas())
    ok(set(r) == {c_ganha['chave']} and r[c_ganha['chave']]['origem'] == 'xml', 'a que ganhou o XML vai')
    ok('902' not in estado(pasta)['empresas'], 'a empresa que saiu da lista saiu do estado')
    (pasta / 'notas' / 'estado.json').write_text('{isto não é json', encoding='utf-8')
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq)
    ok(cod == 0 and 'não consegui ler o que já foi mandado (o arquivo está ilegível)' in logs(pasta) and len(sis.notas()) == 4,
       'o estado ilegível: o log avisa, e a janela inteira vai de novo (o destino conta como repetidas)')


def caso_respostas(sis):
    titulo('9. as respostas')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    arq = cenario(pasta, {901: (DOC_A, [nota(70)]), 902: (DOC_B, [nota(71)])})
    autorizadas = lista((901, DOC_A, '2026-01-01', True), (902, DOC_B, '2026-01-01', True))
    sis.zerar(autorizadas, respostas=[(503, SEM_DESTINO)])
    cod, out = notas(pasta, arq=arq)
    ok(cod == 1 and len(sis.pacotes) == 1 and estado(pasta) in (None, {'versao': 1, 'empresas': {}}),
       f'503 do destino: um pedido só, para as notas e nada fica como mandado (saiu {cod}, {len(sis.pacotes)} pedido(s))')
    sis.zerar(autorizadas, respostas=[(502, DESTINO_FORA)] * 4)
    cod, out = notas(pasta, arq=arq)
    ok(cod == 1 and len(sis.pacotes) == 4 and not (estado(pasta) or {}).get('empresas'),
       f'502: as tentativas do envio, nada marcado (saiu {cod}, {len(sis.pacotes)} pedido(s))')
    sis.zerar(autorizadas)
    cod, out = notas(pasta, arq=arq)
    ok(cod == 0 and len(sis.notas()) == 2, 'e vai na rodada seguinte')
    pasta2 = pasta_nova()
    config_ini(pasta2, sis)
    sis.zerar(autorizadas, respostas=[(403, SEM_AUTORIZACAO)])
    cod, out = notas(pasta2, arq=arq)
    ok(cod == 2 and len(sis.pacotes) == 2 and len(sis.notas()) == 2,
       f'403: não repete a empresa, e a seguinte segue (saiu {cod}, {len(sis.pacotes)} pedido(s))')
    ok('902' in (estado(pasta2) or {}).get('empresas', {}) and '901' not in (estado(pasta2) or {}).get('empresas', {}),
       'a do 403 não fica como mandada; a outra fica')


def caso_janela(sis):
    titulo('10. a janela')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    velha, recente = nota(80, entrada='2026-03-10'), nota(81, entrada='2026-09-10')
    antes = nota(82, entrada='2025-12-20')
    arq = cenario(pasta, {901: (DOC_A, [velha, recente, antes])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq, hoje='2026-11-04')          # quarta, primeira vez: desde
    ok(set(por_chave(sis.notas())) == {velha['chave'], recente['chave']}, 'na primeira vez, de `desde` (nunca antes dele)')
    velha['itens'][0]['quantidade'] = '12'
    recente['itens'][0]['quantidade'] = '12'
    arq = cenario(pasta, {901: (DOC_A, [velha, recente, antes])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq, hoje='2026-11-04')
    ok(set(por_chave(sis.notas())) == {recente['chave']} and 'de 01/08/2026' in out,
       'nos outros dias, do dia 1º de três meses atrás (a velha mudada não é lida)')
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = notas(pasta, arq=arq, hoje='2026-11-08')          # domingo
    ok(set(por_chave(sis.notas())) == {velha['chave']}, 'no domingo, de `desde` de novo')


def caso_rodar(sis):
    titulo('11. o `ponte rodar` roda a etapa das notas no fim, no mesmo modo')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    arq = cenario(pasta, {901: (DOC_A, [nota(90)])})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'notas: rodada' in out and 'sem enviar' in out and not sis.pacotes and sis.listas == 1,
       '--falso --sem-enviar: a etapa pede a lista, lê da Domínio de mentira e não manda')
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)))
    quebrado = pasta / 'quebrado.json'
    quebrado.write_text('{isto não é json', encoding='utf-8')
    cod, out = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=quebrado)
    ok(cod == 0 and 'notas:' in out and 'Traceback' not in out,
       'um erro na etapa das notas vai pro log e não muda o código de saída da rodada dos totais')
    pasta2 = pasta_nova()
    cod, out = ponte(pasta2, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'a etapa das notas não roda' in out, 'sem o [sistema] no config.ini: a etapa diz que não roda')


def caso_segredos(sis):
    titulo('12. nada de chave, CNPJ, nome, produto ou valor no log; o conferir mostra só os números')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    ns = [nota(95, itens=[item(1, total=VALOR)], com_xml=True), nota(96, itens=[item(1, total=VALOR)])]
    arq = cenario(pasta, {901: (DOC_A, ns)})
    sis.zerar(lista((901, DOC_A, '2026-01-01', True)), recusar=[ns[1]['chave']])
    notas(pasta, arq=arq)
    cod, out = ponte(pasta, 'conferir')
    ok('Notas: 1 empresa(s) autorizada(s) no sistema, 1 pronta(s)' in out, 'o conferir: quantas autorizadas e prontas')
    tudo = logs(pasta) + '\n'.join(SAIDAS)
    vazou = [s for s in SEGREDOS | {DOC_A, DOC_B, DOC_C, FORN, FORN_NOME, PROD, VALOR, CHAVE_PONTE} if s in tudo]
    ok(not vazou, f'nenhuma chave, CNPJ, fornecedor, produto, valor ou segredo no log e na tela ({len(vazou)} achado(s))')


def caso_contrato():
    titulo('+ o contrato')
    ok(all(not v['recusadas'] and v['ok'] for v in SIS.todas) and SIS.todas,
       f'todo pacote mandado passou pelo validarPacoteNotas sem nenhuma recusa ({len(SIS.todas)} pacote(s))')
    r = subprocess.run([NODE, '--input-type=module', '-e',
                        f"import {{ CFOPS_DE_COMPRA }} from '{NOTAS_JS.resolve().as_uri()}';"
                        "console.log(JSON.stringify([...CFOPS_DE_COMPRA].sort()))"],
                       capture_output=True, encoding='utf-8', timeout=60)
    ok(json.loads(r.stdout) == sorted(pac_mod.CFOPS_DE_COMPRA), 'o CFOPS_DE_COMPRA da ponte é o mesmo da função')


SIS = None


def main():
    global VALIDADOR, SIS
    pasta_js = pasta_nova()
    VALIDADOR = pasta_js / 'validar.mjs'
    VALIDADOR.write_text(
        f"import {{ validarPacoteNotas }} from '{NOTAS_JS.resolve().as_uri()}';\n"
        "let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => s += d);\n"
        "process.stdin.on('end', () => { const r = validarPacoteNotas(JSON.parse(s)); process.stdout.write(JSON.stringify("
        "{ ok: r.ok, campo: r.campo || null, erro: r.erro || null, recusadas: r.recusadas || [], "
        "itensFora: r.itensFora || 0, notas: r.ok ? r.pacote.notas.length : 0 })); });\n", encoding='utf-8')
    SIS = Sistema()
    try:
        for caso in (caso_lista, caso_xml, caso_par, caso_dominio, caso_sem_itens, caso_compra, caso_de_fora, caso_pacotes,
                     caso_estado, caso_respostas, caso_janela, caso_rodar, caso_segredos):
            try:
                caso(SIS)
            except Exception as e:
                import traceback
                traceback.print_exc()
                ok(False, f'{caso.__name__} parou: {type(e).__name__}: {e}')
        caso_contrato()
    finally:
        SIS.fechar()
        for p in PASTAS:
            shutil.rmtree(p, ignore_errors=True)
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
