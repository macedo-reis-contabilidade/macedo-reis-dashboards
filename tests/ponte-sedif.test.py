"""Teste da ponte das notas de entrada da SEDIF/DeSTDA (ponte/sedif.py, 26/11/2026) — sem a Domínio, sem o sistema e sem
internet. Precisa do Python 3.11+ e do node (o validarPacoteSedif e o notasDaEmpresa de verdade, de
supabase/functions/ponte/sedif.js).

    python tests/ponte-sedif.test.py

A Domínio de mentira (FonteSedifFalsa) lê o cenário de cada caso de um JSON (PONTE_SEDIF_FALSO: a lista das notas e o XML
de cada uma) e anota as consultas (PONTE_SEDIF_CHAMADAS); um sistema de mentira responde como a função `ponte` (a lista
das empresas da SEDIF/DeSTDA e o pacote de cada empresa, conferido no node), numa thread, porta 0. Cada caso usa uma
pasta temporária em PONTE_PASTA. Empresas, fornecedores e chaves inventados (os CNPJs com o dígito verificador errado
de propósito; as chaves com o certo).

  1. a primeira vez: só as empresas da lista; a nota de fora do RS e a do RS vão, com os itens do XML (a base e a
     alíquota do ICMS, a ST); de fora, contadas no log: a sem o XML na Domínio, a de fornecedor pessoa física, a
     rejeitada pela Sefaz, a de XML de outra nota, a de XML ilegível, a NFC-e, a com o XML que não veio; o pacote passa
     pelo validarPacoteSedif e pelo notasDaEmpresa sem nenhuma recusa; o estado guarda só a chave e a data
  2. de novo: nada vai, e o XML nem é buscado
  3. a data de entrada que muda na Domínio: só aquela nota vai, e o XML só do trecho dela
  4. --tudo manda de novo; o leitor novo também; --sem-enviar não manda nem grava o estado
  5. os pacotes: até 200 notas cada, a empresa em partes
  6. as respostas: a chave recusada na lista (2), o sistema fora (1, nada marcado como mandado), o pacote de uma empresa
     recusado (as outras seguem; 2), a recusa da função no log sem números
  7. o `ponte rodar` roda a etapa no fim, no mesmo modo, e um erro nela não muda a rodada dos totais
  8. nada de chave, CNPJ, nome ou XML no log, na tela ou no estado
  +  a consulta sedif_lista.sql pronta (o comentário, as colunas, os 3 parâmetros e as regras)
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
    print('O teste da ponte das notas de entrada precisa do node (o validarPacoteSedif da função, em JavaScript).')
    sys.exit(1)
SEDIF_JS = RAIZ / 'supabase' / 'functions' / 'ponte' / 'sedif.js'

from ponte import entradas as ent  # noqa: E402
from ponte import nfe, sedif  # noqa: E402

CHAVE_PONTE = 'SEGREDO-DA-PONTE-DAS-NOTAS-SEDIF'
IMPRESSAO = hashlib.sha256(CHAVE_PONTE.encode('utf-8')).hexdigest()
CHAVE_PUBLICA = 'chave-publica-de-teste'
HOJE = '2026-11-26'
EMPRESA = '22333444000100'                     # o documento do cadastro da empresa 901 (inventado)
FORN_SC = '55666777000100'
FORN_RS = '66777888000100'
CPF_NA_CHAVE = '000' + '52998224725'
NOMES = ('FORNECEDOR CATARINENSE LTDA', 'FORNECEDOR GAUCHO LTDA', 'EMPRESA TESTE DA SEDIF')

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
    p = pathlib.Path(tempfile.mkdtemp(prefix='ponte-sedif-teste-'))
    PASTAS.append(p)
    return p


def chave(numero, uf='42', aamm='2609', cnpj=FORN_SC, modelo='55'):
    base = f'{uf}{aamm}{cnpj}{modelo}001{numero:09d}112345678'
    ch = base + str(ent.dv_da_chave(base))
    SEGREDOS.add(ch)
    return ch


def xml(ch, emit=FORN_SC, uf='SC', dest=EMPRESA, prot='100', emissao='2026-09-30'):
    """Uma NF-e inventada: um item a 4% e um com ST (a ração), como a conferência usa."""
    return (f'<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe>'
            f'<infNFe Id="NFe{ch}" versao="4.00"><ide><cUF>42</cUF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie>'
            f'<nNF>{int(ch[25:34])}</nNF><dhEmi>{emissao}T10:00:00-03:00</dhEmi><tpNF>1</tpNF><finNFe>1</finNFe></ide>'
            f'<emit><CNPJ>{emit}</CNPJ><xNome>{NOMES[0] if uf != "RS" else NOMES[1]}</xNome><enderEmit><UF>{uf}</UF>'
            f'</enderEmit><CRT>3</CRT></emit><dest><CNPJ>{dest}</CNPJ><xNome>{NOMES[2]}</xNome><enderDest><UF>RS</UF>'
            f'</enderDest></dest>'
            f'<det nItem="1"><prod><cProd>1</cProd><xProd>SECADOR</xProd><NCM>85163100</NCM><CFOP>6102</CFOP><uCom>UN</uCom>'
            f'<qCom>10</qCom><vUnCom>100.00</vUnCom><vProd>1000.00</vProd></prod><imposto><ICMS><ICMS00><orig>1</orig>'
            f'<CST>00</CST><vBC>1000.00</vBC><pICMS>4.00</pICMS><vICMS>40.00</vICMS></ICMS00></ICMS></imposto></det>'
            f'<det nItem="2"><prod><cProd>2</cProd><xProd>RACAO CAES</xProd><NCM>23091000</NCM><CFOP>6403</CFOP>'
            f'<uCom>SC</uCom><qCom>5</qCom><vUnCom>100.00</vUnCom><vProd>500.00</vProd></prod><imposto><ICMS><ICMS10>'
            f'<orig>0</orig><CST>10</CST><vBC>500.00</vBC><pICMS>12.00</pICMS><vICMS>60.00</vICMS><vBCST>700.00</vBCST>'
            f'<pICMSST>17.00</pICMSST><vICMSST>59.00</vICMSST></ICMS10></ICMS></imposto></det>'
            f'<total><ICMSTot><vBC>1500.00</vBC><vICMS>100.00</vICMS><vST>59.00</vST><vProd>1500.00</vProd>'
            f'<vNF>1559.00</vNF></ICMSTot></total></infNFe></NFe>'
            f'<protNFe><infProt><chNFe>{ch}</chNFe><cStat>{prot}</cStat></infProt></protNFe></nfeProc>')


# ---------------------------------------------------------------- o node: o validarPacoteSedif de verdade

VALIDADOR = None


def validar_no_node(p):
    r = subprocess.run([NODE, str(VALIDADOR), HOJE, EMPRESA], input=json.dumps(p, ensure_ascii=False), capture_output=True,
                       encoding='utf-8', errors='replace', timeout=120)
    if r.returncode != 0:
        raise RuntimeError('o validarPacoteSedif (node) quebrou: ' + (r.stderr or '')[-500:])
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
                        return self._enviar(200, {'empresas': copy.deepcopy(dono.empresas), 'desde': '2026-09-01', 'ate': HOJE})
                if corpo.get('tipo') != 'sedif':
                    return self._enviar(422, {'erro': 'Nada pra fazer com este pacote.'})
                with dono.trava:
                    dono.pacotes.append({'bruto': bruto.decode('utf-8'), 'corpo': corpo})
                    fila = dono.respostas.pop(0) if dono.respostas else None
                    recusar_empresa = (corpo.get('empresa') or {}).get('codigo') in dono.recusar_empresas
                if fila is not None:
                    return self._enviar(fila[0], {'erro': fila[1]})
                if recusar_empresa:
                    return self._enviar(422, {'erro': 'Empresa fora da conferência SEDIF/DeSTDA (ou sem a ligação com o cadastro).'})
                r = validar_no_node(corpo)
                with dono.trava:
                    dono.todas.append(r)
                v = r['v']
                if not v['ok']:
                    return self._enviar(422, {'erro': f"Pacote das notas de entrada recusado: {v['erro']} ({v['campo']})."})
                recusadas = list(v['recusadas']) + list(r['g']['recusadas'])
                with dono.trava:
                    for ch in dono.recusar:
                        recusadas.append({'codigo': 901, 'chave': ch, 'campo': f'notas[0].chave {ch}',
                                          'erro': f'recusada pelo teste (fornecedor {ch[6:20]})'})
                notas = len(r['g']['notas'])
                return self._enviar(200, {'ok': True, 'gravado': True, 'notas': notas, 'recebidas': notas,
                                          'novas': max(0, notas - 1), 'ja_na_base': min(1, notas), 'itens': 2 * notas,
                                          'itens_completados': 1, 'datas': min(1, notas),
                                          'recusadas': recusadas, 'total_recusadas': len(recusadas)})

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}/functions/v1/ponte'

    def zerar(self, codigos=(), respostas=(), recusar=(), recusar_chave=False, recusar_empresas=()):
        with self.trava:
            self.empresas = [{'codigo': c} for c in codigos]
            self.respostas = list(respostas)
            self.recusar = list(recusar)
            self.recusar_chave = recusar_chave
            self.recusar_empresas = set(recusar_empresas)
            self.pacotes, self.listas = [], 0

    def notas(self):
        with self.trava:
            return [(p['corpo']['empresa']['codigo'], n) for p in self.pacotes for n in p['corpo']['notas']]

    def fechar(self):
        self.srv.shutdown()


# ---------------------------------------------------------------- o cenário e a ponte

def cenario(pasta, empresas):
    """empresas: {codigo: [linhas]} — cada linha {chave, entrada, emitente_tipo?, tem_xml?, xml?}."""
    arq = pasta / 'cenario.json'
    arq.write_text(json.dumps({'empresas': {str(c): ls for c, ls in empresas.items()}}, ensure_ascii=False), encoding='utf-8')
    return arq


def config_ini(pasta, sis):
    (pasta / 'config.ini').write_text(
        f'[sistema]\nurl = {sis.url}\nchave_publica = {CHAVE_PUBLICA}\nchave_ponte = {CHAVE_PONTE}\n', encoding='utf-8')


SAIDAS = []


def ponte(pasta, *args, arq=None):
    chamadas = pasta / 'chamadas.jsonl'
    if chamadas.exists():
        chamadas.unlink()
    env = dict(os.environ, PONTE_PASTA=str(pasta), PONTE_ESPERAS='0.05,0.05,0.05', PONTE_TIMEOUT='5', PONTE_HOJE=HOJE,
               PONTE_IP_URL='http://127.0.0.1:9/sem-ip', PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1',
               PONTE_SEDIF_CHAMADAS=str(chamadas))
    if arq:
        env['PONTE_SEDIF_FALSO'] = str(arq)
        for nome in ('PONTE_NOTAS_FALSO', 'PONTE_ENTRADAS_FALSO'):
            vazio = arq.parent / f'vazio-{nome}.json'
            vazio.write_text('{"empresas": {}}', encoding='utf-8')
            env[nome] = str(vazio)
    r = subprocess.run([sys.executable, '-m', 'ponte', *args], cwd=str(RAIZ), env=env, capture_output=True,
                       encoding='utf-8', errors='replace', timeout=300, stdin=subprocess.DEVNULL)
    saida = (r.stdout or '') + (r.stderr or '')
    SAIDAS.append(saida)
    feitas = [json.loads(l) for l in chamadas.read_text(encoding='utf-8').splitlines()] if chamadas.exists() else []
    return r.returncode, saida, feitas


def rodar_sedif(pasta, *args, **k):
    return ponte(pasta, 'sedif', 'rodar', '--falso', *args, **k)


def logs(pasta):
    p = pasta / 'logs'
    return '\n'.join(a.read_text(encoding='utf-8') for a in sorted(p.glob('*.log'))) if p.is_dir() else ''


def estado(pasta):
    arq = pasta / 'sedif' / 'estado.json'
    return json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else None


# ---------------------------------------------------------------- os casos

def caso_primeira(sis):
    titulo('1. a primeira vez: as notas com o XML vão, com os itens; o resto fica de fora, contado')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    sc, rs = chave(1), chave(2, uf='43', cnpj=FORN_RS, aamm='2610')
    sem_xml, pf, rejeitada = chave(3), chave(4), chave(5)
    outra, ilegivel, nfce, nao_veio = chave(6), chave(7), chave(8, modelo='65'), chave(9)
    linhas = [
        {'chave': sc, 'entrada': '2026-10-01', 'xml': xml(sc)},                                    # emitida em 30/09, entrou em 01/10
        {'chave': rs.lower(), 'entrada': '2026-10-03T00:00:00', 'xml': xml(rs, emit=FORN_RS, uf='RS', emissao='2026-10-02')},
        {'chave': sem_xml, 'entrada': '2026-10-04'},                                               # a digitada: sem o XML
        {'chave': pf, 'entrada': '2026-10-04', 'emitente_tipo': 2, 'xml': xml(pf)},                # o fornecedor pessoa física
        {'chave': rejeitada, 'entrada': '2026-10-05', 'xml': xml(rejeitada, prot='204')},
        {'chave': outra, 'entrada': '2026-10-05', 'xml': xml(chave(60))},                          # o XML de outra nota
        {'chave': ilegivel, 'entrada': '2026-10-06', 'xml': '<nfeProc><NFe><infNFe'},
        {'chave': nfce, 'entrada': '2026-10-06', 'xml': xml(nfce)},
        {'chave': nao_veio, 'entrada': '2026-10-07', 'tem_xml': 1},                                # o catálogo diz que tem
        {'chave': sc, 'entrada': '2026-10-02', 'xml': xml(sc)},                                    # repetida
    ]
    arq = cenario(pasta, {901: linhas, 902: [], 903: [{'chave': chave(10), 'entrada': '2026-10-05', 'xml': xml(chave(10))}]})
    sis.zerar(codigos=(901, 902))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    mandadas = sis.notas()
    ok(cod == 0 and sis.listas == 1 and len(sis.pacotes) == 1, f'pediu a lista e mandou um pacote (saiu {cod}, {len(sis.pacotes)} pacote(s))')
    ok(sorted(n['chave'] for _, n in mandadas) == sorted([sc, rs]) and all(c == 901 for c, _ in mandadas),
       'só as notas com o XML, das empresas da lista (a de fora do RS e a do RS; a 903 não está na lista)')
    n = {x['chave']: x for _, x in mandadas}
    a = n.get(sc) or {}
    ok(set(a) == {'chave', 'entrada', 'doc', 'itens'} and a.get('entrada') == '2026-10-01' and n.get(rs, {}).get('entrada') == '2026-10-03',
       'cada nota com a chave, a data de entrada (sem a hora), a nota e os itens — e nada do XML')
    itens = a.get('itens') or [{}, {}]
    ok(len(itens) == 2 and itens[0].get('icms_aliquota') == 4 and itens[0].get('icms_base') == 1000
       and itens[1].get('icms_st_base') == 700 and itens[1].get('icms_st_valor') == 59 and a['doc'].get('emit_uf') == 'SC'
       and a['doc'].get('dest_doc') == EMPRESA, 'os itens como a importação grava: a base e a alíquota do ICMS, a ST')
    pac = sis.pacotes[0]['corpo'] if sis.pacotes else {}
    ok(pac.get('tipo') == 'sedif' and set(pac.get('rodada') or {}) == {'id', 'inicio', 'maquina', 'ponte'}
       and pac['rodada']['ponte'] == sedif.VERSAO and pac.get('empresa') == {'codigo': 901},
       'o pacote: a rodada (com a versão da ponte) e a empresa pelo código')
    log = logs(pasta)
    ok('sedif 901: 10 nota(s) na janela, 0 já mandada(s), 2 vão' in log and '1 sem o XML na Domínio' in log
       and '1 de emitente pessoa física' in log and '1 não autorizadas pela Sefaz' in log and '1 com o XML de outra nota' in log
       and '1 com o XML ilegível' in log and '1 que não são NF-e (modelo 55)' in log and '1 com o XML que não veio da Domínio' in log
       and '1 repetidas' in log, 'o log conta o que ficou de fora, por motivo')
    ok('sedif 901: pacote 1 de 1 (2 nota(s)): 2 recebida(s), 1 nova(s) na base, 1 já estavam (1 item(ns) completado(s), 1 com a data de entrada nova)' in log,
       'e o que o sistema respondeu')
    xmls = [f for f in feitas if f[0] == 'xmls']
    ok(xmls == [['xmls', '901', '2026-10-01', '2026-10-07']], f'o XML buscado só do trecho das que iam ({xmls})')
    est = estado(pasta)
    ok(est and est['empresas'].get('901') == {sc: '2026-10-01|' + nfe.LEITOR, rs: '2026-10-03|' + nfe.LEITOR},
       'o estado guarda só a chave e a data de entrada das que foram (com a versão do leitor)')
    return pasta, arq, linhas, sc, rs


def caso_de_novo(sis, pasta, arq, linhas, sc, rs):
    titulo('2. de novo: nada vai, e o XML só da que não veio é buscado de novo')
    sis.zerar(codigos=(901, 902))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    ok(cod == 0 and not sis.pacotes and [f for f in feitas if f[0] == 'xmls'] == [['xmls', '901', '2026-10-07', '2026-10-07']],
       f'nenhum pacote; a rejeitada, a ilegível e a de outra nota não são lidas de novo; a que não veio, sim (saiu {cod})')
    log = logs(pasta).split('sedif: rodada')[-1]
    ok('sedif 901: 10 nota(s) na janela, 2 já mandada(s), 0 vão' in log and '1 não autorizadas pela Sefaz' in log
       and '1 com o XML ilegível' in log and '1 com o XML de outra nota' in log, 'o log diz quantas já tinham ido, e segue contando as de fora')
    linhas = [l for l in linhas if l.get('tem_xml') != 1]
    arq = cenario(pasta, {901: linhas})
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    ok(cod == 0 and not sis.pacotes and not [f for f in feitas if f[0] == 'xmls'], f'sem ela, nenhum XML é buscado (saiu {cod})')

    titulo('3. a data de entrada que muda na Domínio: só aquela nota vai')
    linhas = [dict(l, entrada='2026-10-09') if l['chave'] == rs.lower() else l for l in linhas]
    arq = cenario(pasta, {901: linhas})
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    ok(cod == 0 and [x['chave'] for _, x in sis.notas()] == [rs] and sis.notas()[0][1]['entrada'] == '2026-10-09',
       'só a nota da data nova vai, com a data nova')
    ok([f for f in feitas if f[0] == 'xmls'] == [['xmls', '901', '2026-10-09', '2026-10-09']], 'e o XML só do dia dela')

    titulo('4. --tudo, o leitor novo e --sem-enviar')
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, '--tudo', arq=arq)
    ok(cod == 0 and sorted(x['chave'] for _, x in sis.notas()) == sorted([sc, rs]), '--tudo manda de novo as da janela')
    est = estado(pasta)
    est['empresas']['901'] = {k: v.split('|')[0] + '|0' for k, v in est['empresas']['901'].items()}
    (pasta / 'sedif' / 'estado.json').write_text(json.dumps(est), encoding='utf-8')
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    ok(cod == 0 and len(sis.notas()) == 2, 'o leitor de outra versão: as notas da janela vão de novo')
    antes = (pasta / 'sedif' / 'estado.json').read_text(encoding='utf-8')
    linhas.append({'chave': chave(11), 'entrada': '2026-11-02', 'xml': xml(chave(11), emissao='2026-11-01')})
    arq = cenario(pasta, {901: linhas})
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, '--sem-enviar', arq=arq)
    ok(cod == 0 and not sis.pacotes and 'sedif: 1 nota(s) iriam de 1 empresa(s)' in out and 'sem enviar' in out
       and (pasta / 'sedif' / 'estado.json').read_text(encoding='utf-8') == antes and [f for f in feitas if f[0] == 'xmls'],
       '--sem-enviar: lê e confere o XML das que iriam, não manda e não grava o estado')
    est = json.loads(antes)
    est['empresas']['999'] = {chave(12): '2026-08-01|' + nfe.LEITOR}
    est['empresas']['901'][chave(13)] = '2026-08-15|' + nfe.LEITOR
    (pasta / 'sedif' / 'estado.json').write_text(json.dumps(est), encoding='utf-8')
    sis.zerar(codigos=(901,))
    cod, out, feitas = rodar_sedif(pasta, arq=arq)
    est = estado(pasta)
    ok(cod == 0 and '999' not in est['empresas'] and chave(13) not in est['empresas']['901'] and chave(11) in est['empresas']['901'],
       'a empresa que saiu da lista e a nota que saiu da janela somem do estado')


def caso_pacotes():
    titulo('5. os pacotes')
    rodada = {'id': 'r', 'inicio': 'i', 'maquina': 'm', 'ponte': 'p'}
    nota = lambda i: {'chave': str(i), 'entrada': '2026-10-01', 'doc': {}, 'itens': [{'n_item': 1}]}
    ps = sedif.pacotes(901, [nota(i) for i in range(sedif.LIMITE_NOTAS * 2 + 5)], rodada)
    ok([len(p['notas']) for p in ps] == [sedif.LIMITE_NOTAS, sedif.LIMITE_NOTAS, 5] and all(p['empresa'] == {'codigo': 901} for p in ps),
       f'até {sedif.LIMITE_NOTAS} notas por pacote, a empresa em partes')
    grande = lambda i: {'chave': str(i), 'entrada': '2026-10-01', 'doc': {}, 'itens': [{'descricao': 'X' * 1000}] * 900}
    ps = sedif.pacotes(901, [grande(i) for i in range(6)], rodada)
    ok(len(ps) > 1 and all(len(json.dumps(p).encode('utf-8')) <= sedif.LIMITE_BYTES for p in ps),
       'e até 4 MB por pacote (as notas grandes vão em mais pacotes)')
    ok(sedif.pacotes(901, [], rodada) == [], 'sem nota, nenhum pacote')


def caso_respostas(sis):
    titulo('6. as respostas')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    a, b, c = chave(30), chave(31), chave(32)
    arq = cenario(pasta, {901: [{'chave': a, 'entrada': '2026-10-01', 'xml': xml(a)}, {'chave': b, 'entrada': '2026-10-02', 'xml': xml(b)}],
                          902: [{'chave': c, 'entrada': '2026-10-03', 'xml': xml(c)}]})
    sis.zerar(codigos=(901, 902), recusar_chave=True)
    cod, out, _ = rodar_sedif(pasta, arq=arq)
    ok(cod == 2 and not sis.pacotes and 'HTTP 401' in out, f'a chave recusada na lista: sai com 2, sem mandar (saiu {cod})')
    sis.zerar(codigos=(901, 902), respostas=[(503, 'fora')] * 4)
    cod, out, _ = rodar_sedif(pasta, arq=arq)
    ok(cod == 1 and len(sis.pacotes) == 4 and not (estado(pasta) or {}).get('empresas', {}).get('901')
       and 'desisti depois de 4 tentativas' in out,
       f'o sistema fora: as tentativas, para a rodada e nada fica como mandado (saiu {cod}, {len(sis.pacotes)} tentativa(s))')
    sis.zerar(codigos=(901, 902), recusar_empresas=(901,))
    cod, out, _ = rodar_sedif(pasta, arq=arq)
    est = (estado(pasta) or {}).get('empresas', {})
    ok(cod == 2 and [x['chave'] for _, x in sis.notas()] == [a, b, c] and not est.get('901') and c in est.get('902', {}),
       f'o pacote de uma empresa recusado: ela fica pra próxima, as outras seguem; sai com 2 (saiu {cod})')
    sis.zerar(codigos=(901,), recusar=[a])
    cod, out, _ = rodar_sedif(pasta, arq=arq)
    log = logs(pasta)
    ok(cod == 0 and 'o sistema deixou de fora 1' in log and 'recusada — notas[0].chave …: recusada pelo teste (fornecedor …)' in log,
       'a recusa da função vai pro log sem a chave nem o CNPJ')


def caso_rodar(sis):
    titulo('7. o `ponte rodar` roda a etapa no fim, no mesmo modo')
    pasta = pasta_nova()
    config_ini(pasta, sis)
    a = chave(40)
    arq = cenario(pasta, {901: [{'chave': a, 'entrada': '2026-10-01', 'xml': xml(a)}]})
    sis.zerar(codigos=(901,))
    cod, out, _ = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'sedif: rodada' in out and 'sedif: sem enviar' in out and not sis.pacotes,
       '--falso --sem-enviar: a etapa pede a lista, lê da Domínio de mentira e não manda')
    quebrado = pasta / 'quebrado.json'
    quebrado.write_text('{isto não é json', encoding='utf-8')
    sis.zerar(codigos=(901,))
    cod, out, _ = ponte(pasta, 'rodar', '--falso', '--sem-enviar', arq=quebrado)
    ok(cod == 0 and 'sedif:' in out and 'Traceback' not in out, 'um erro na etapa vai pro log e não muda o código de saída da rodada')
    pasta2 = pasta_nova()
    cod, out, _ = ponte(pasta2, 'rodar', '--falso', '--sem-enviar', arq=arq)
    ok(cod == 0 and 'a etapa das notas de entrada não roda' in out, 'sem o [sistema] no config.ini: a etapa diz que não roda')


def caso_segredos():
    titulo('8. nada de chave, CNPJ, nome ou XML no log, na tela ou no estado (o estado só tem a chave)')
    tudo = '\n'.join(logs(p) for p in PASTAS) + '\n'.join(SAIDAS)
    vazou = [s for s in SEGREDOS | {FORN_SC, FORN_RS, EMPRESA, CPF_NA_CHAVE, CHAVE_PONTE, *NOMES, '<nfeProc', 'SECADOR'} if s in tudo]
    ok(not vazou, f'nenhuma chave, CNPJ, nome, produto ou segredo no log e na tela ({len(vazou)} achado(s))')
    estados = [json.loads((p / 'sedif' / 'estado.json').read_text(encoding='utf-8')) for p in PASTAS
               if (p / 'sedif' / 'estado.json').exists()]
    valores = [(ch, v) for e in estados for grupo in ('empresas', 'fora') for notas in (e.get(grupo) or {}).values()
               for ch, v in notas.items()]
    ok(estados and valores and set(k for e in estados for k in e) <= {'versao', 'empresas', 'fora'}
       and all(re.fullmatch(r'[0-9A-Z]{44}', ch) and re.fullmatch(r'\d{4}-\d{2}-\d{2}\|\d+(\|[a-z_]+)?', v) for ch, v in valores),
       f'o estado guarda só a chave, a data, a versão do leitor e o porquê de ficar de fora ({len(valores)} nota(s))')


def caso_contrato(sis):
    titulo('+ o contrato')
    ok(sis.todas and all(r['v']['ok'] and not r['v']['recusadas'] and not r['g']['recusadas'] for r in sis.todas),
       f'todo pacote mandado passou pelo validarPacoteSedif e pelo notasDaEmpresa sem nenhuma recusa ({len(sis.todas)} pacote(s))')
    texto = (RAIZ / 'ponte' / 'consultas' / 'sedif_lista.sql').read_text(encoding='utf-8-sig')
    codigo = '\n'.join(l.split('--', 1)[0] for l in texto.splitlines())
    comentario = '\n'.join(l for l in texto.splitlines() if l.lstrip().startswith('--'))
    from ponte.fonte_dominio import a_conferir
    regras = ["codigo_modelo = '55'", "emitente_ent = 'T'", 'NOT IN (2, 3, 4, 5)', 'LENGTH(TRIM(e.chave_nfe_ent)) = 44',
              'dent_ent BETWEEN', 'XML_EXCLUIDO = 0', 'c.TIPO = 1', 'tins_for']
    ok(not a_conferir(texto) and texto.lstrip().startswith('--') and '?' not in comentario and codigo.count('?') == 3
       and all(re.search(rf'\bAS\s+{c}\b', codigo, re.I) for c in ('chave', 'entrada', 'emitente_tipo', 'tem_xml'))
       and all(r in codigo for r in regras) and "<> '43'" not in codigo,
       'sedif_lista.sql pronta: o comentário no começo, a chave, a data, o tipo do fornecedor e o tem_xml, os 3 parâmetros e '
       'as regras (modelo 55, terceiro, sem cancelada, pela data de entrada, o catálogo do XML) — e de todos os estados')
    ok((RAIZ / 'ponte' / 'consultas' / 'notas_xml.sql').is_file(), 'o XML vem pela notas_xml.sql, a mesma da ponte das notas')


def main():
    global VALIDADOR
    tmp = pasta_nova()
    VALIDADOR = tmp / 'validar.mjs'
    VALIDADOR.write_text(
        f"import {{ validarPacoteSedif, notasDaEmpresa }} from '{SEDIF_JS.resolve().as_uri()}';\n"
        "let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => s += d);\n"
        "process.stdin.on('end', () => { const v = validarPacoteSedif(JSON.parse(s), process.argv[2]);\n"
        "  const g = v.ok ? notasDaEmpresa(v.pacote, process.argv[3]) : { notas: [], recusadas: [] };\n"
        "  process.stdout.write(JSON.stringify({ v, g })); });\n",
        encoding='utf-8')
    sis = Sistema()
    try:
        r = caso_primeira(sis)
        caso_de_novo(sis, *r)
        caso_pacotes()
        caso_respostas(sis)
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
