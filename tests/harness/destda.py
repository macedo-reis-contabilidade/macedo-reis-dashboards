"""
Conferência SEDIF/DeSTDA (Fiscal, 27/10/2026, pedido da Thalia) — sem login e sem banco (o mock do conferir.py, com as
empresas, a obrigação, a regra da ração e uma nota importada antes semeadas só neste teste; nomes, CNPJs — com o dígito
errado — e notas inventados). O relógio fica parado em 27/10/2026, meio-dia: a tela abre em 09/2026.

    python tests/harness/destda.py

Confere, nos temas escuro e claro:
  1. a tela abre no mês anterior com as empresas da obrigação SEDIF/DeSTDA (o vínculo desligado fica de fora); a nota
     importada antes de 27/10 (sem a alíquota nos itens) pede pra importar de novo; as outras, "sem notas de entrada";
  2. a importação de um ZIP com subpastas e de um XML solto, com as notas de várias empresas: cada nota na empresa do
     CNPJ (a nota entre duas empresas do cadastro nas duas: venda numa, compra na outra), a de fora do cadastro ignorada
     e contada, o arquivo que não é nota fora; a que já estava na base não entra de novo, mas os itens dela ganham a
     alíquota; um lote por empresa; o resumo por empresa, com a que não está na obrigação marcada;
  3. a conferência de 09/2026: as notas de fora do RS a 4% (a do RS a 4% e o item a 12% não), com os totais; a ração de
     SP (mesmo a 12%) no ICMS-ST, com o que o fornecedor reteve e o item sem retenção; a ração do PR não; a empresa sem
     nada a recolher e a sem notas de entrada;
  4. trocar o mês: 08/2026 mostra só a nota de agosto;
  5. as regras: estado que não existe, NCM curto e regra sem nome não gravam; pôr o PR na ração grava e a nota do PR
     entra na hora; a regra nova grava e a excluída sai; a desligada tira o ICMS-ST da conferência;
  6. texto de fora entra como texto (o nome da empresa, do fornecedor, do item e do arquivo com <img onerror>);
  7. o card no Fiscal: "4 empresas";
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, io, json, zipfile
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

VENDOR = pathlib.Path(__file__).resolve().parent / 'vendor'      # jszip.min.js 3.10.1, o mesmo do CDN da página

EMP = {'d1': '20000000000100', 'd2': '30000000000100', 'd3': '40000000000100', 'd4': '50000000000100',
       'd5': '60000000000100', 'd6': '70000000000100'}
CUF = {'RS': '43', 'SC': '42', 'PR': '41', 'SP': '35', 'MG': '31', 'GO': '52'}
PERIGO_EMPRESA = 'COMÉRCIO <img src=x onerror="window.__pego=1"> LTDA'
PERIGO_FORNECEDOR = 'FORNECEDOR <img src=y onerror="window.__pego=2"> MG'
PERIGO_ITEM = '<img src=w onerror="window.__pego=3">'
ARQ_FORA = 'entradas/fora-<img src=z onerror="window.__pego=4">.xml'

def xt(s):   # texto dentro do XML
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def icms00(aliq, base):
    return f'<ICMS00><orig>1</orig><CST>00</CST><modBC>3</modBC><vBC>{base:.2f}</vBC><pICMS>{aliq:.4f}</pICMS><vICMS>{base * aliq / 100:.2f}</vICMS></ICMS00>'

def icms10(aliq, base, base_st, st):
    return (f'<ICMS10><orig>0</orig><CST>10</CST><modBC>3</modBC><vBC>{base:.2f}</vBC><pICMS>{aliq:.2f}</pICMS><vICMS>{base * aliq / 100:.2f}</vICMS>'
            f'<modBCST>4</modBCST><pMVAST>40.00</pMVAST><vBCST>{base_st:.2f}</vBCST><pICMSST>17.00</pICMSST><vICMSST>{st:.2f}</vICMSST></ICMS10>')

def nfe(numero, uf, cnpj_emit, nome_emit, cnpj_dest, data, itens, tpnf=1):
    chave = CUF[uf] + data[2:4] + data[5:7] + cnpj_emit + '55' + '001' + str(numero).zfill(9) + '1' + str(numero).zfill(8) + '0'
    assert len(chave) == 44
    dets = ''.join(f'<det nItem="{i}"><prod><cProd>{i}</cProd><xProd>{xt(desc)}</xProd><NCM>{ncm}</NCM><CFOP>{cfop}</CFOP><uCom>UN</uCom>'
                   f'<qCom>1</qCom><vUnCom>{valor:.2f}</vUnCom><vProd>{valor:.2f}</vProd></prod><imposto><ICMS>{icms}</ICMS></imposto></det>'
                   for i, (ncm, desc, cfop, valor, icms) in enumerate(itens, 1))
    total = sum(i[3] for i in itens)
    return chave, f'''<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe{chave}" versao="4.00">
<ide><cUF>{CUF[uf]}</cUF><mod>55</mod><serie>1</serie><nNF>{numero}</nNF><dhEmi>{data}T10:00:00-03:00</dhEmi><tpNF>{tpnf}</tpNF><finNFe>1</finNFe></ide>
<emit><CNPJ>{cnpj_emit}</CNPJ><xNome>{xt(nome_emit)}</xNome><enderEmit><UF>{uf}</UF></enderEmit><CRT>3</CRT></emit>
<dest><CNPJ>{cnpj_dest}</CNPJ><xNome>EMPRESA DE DESTINO TESTE</xNome><enderDest><UF>RS</UF></enderDest></dest>
{dets}<total><ICMSTot><vProd>{total:.2f}</vProd><vNF>{total:.2f}</vNF></ICMSTot></total>
</infNFe></NFe><protNFe><infProt><chNFe>{chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>'''

# setembro: d1 tem uma nota de SC já na base (item a 4% e outro a 12%), a ração de SP (uma sem e outra com o ST retido),
# a ração do PR (fora da regra) e uma compra do RS a 4% de outra empresa do cadastro (d4, que não é da SEDIF); d2 compra
# de MG a 4% (o fornecedor e o item com <img onerror>); d5 só compra a 12%; e uma nota entre dois de fora do cadastro.
# Agosto: uma de GO a 4% pra d1
CH1, N1 = nfe(101, 'SC', '81000000000100', 'FORNECEDOR SC TESTE SA', EMP['d1'], '2026-09-05',
              [('85163100', 'SECADOR', '6102', 1000, icms00(4, 1000)), ('84145100', 'VENTILADOR', '6102', 300, icms00(12, 300))])
_, N2 = nfe(202, 'SP', '82000000000100', 'PET FOODS SP TESTE SA', EMP['d1'], '2026-09-12',
            [('23091000', 'RACAO CAES 15KG', '6102', 500, icms00(12, 500)), ('23091000', 'RACAO GATOS 10KG', '6403', 400, icms10(12, 400, 560, 47.20))])
_, N3 = nfe(303, 'PR', '83000000000100', 'PET PR TESTE SA', EMP['d1'], '2026-09-15', [('23091000', 'RACAO FILHOTES', '6102', 250, icms00(12, 250))])
_, N4 = nfe(404, 'RS', EMP['d4'], 'DISTRIBUIDORA DO CADASTRO LTDA', EMP['d1'], '2026-09-20', [('85163100', 'SECADOR', '5102', 100, icms00(4, 100))])
_, N5 = nfe(505, 'MG', '84000000000100', PERIGO_FORNECEDOR, EMP['d2'], '2026-09-08', [('85098090', PERIGO_ITEM, '6102', 800, icms00(4, 800))])
_, N6 = nfe(606, 'SC', '81000000000100', 'FORNECEDOR SC TESTE SA', EMP['d5'], '2026-09-09', [('19052090', 'PAO', '6102', 200, icms00(12, 200))])
_, N7 = nfe(707, 'SP', '86000000000100', 'TERCEIRO SA', '87000000000100', '2026-09-10', [('85163100', 'SECADOR', '6102', 90, icms00(4, 90))])
_, N8 = nfe(808, 'GO', '88000000000100', 'GOIAS TESTE SA', EMP['d1'], '2026-08-20', [('85163100', 'SECADOR', '6102', 700, icms00(4, 700))])

def zip_das_notas():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for nome, xml in (('entradas/101.xml', N1), ('entradas/202.xml', N2), ('entradas/303.xml', N3), ('entradas/404.xml', N4),
                          ('entradas/606.xml', N6), (ARQ_FORA, N7), ('entradas/agosto/808.xml', N8)):
            z.writestr(nome, xml)
        z.writestr('entradas/leia-me.txt', 'não é nota')
    return buf.getvalue()

DADOS = {
    'clientes': [
        {'id': 'd1', 'nome_principal': 'AGROPECUÁRIA TESTE LTDA', 'nome_fantasia': 'AGRO TESTE', 'documento': '20.000.000/0001-00', 'status': 'ativo'},
        {'id': 'd2', 'nome_principal': PERIGO_EMPRESA, 'nome_fantasia': '<b>NEGRITO</b>', 'documento': EMP['d2'], 'status': 'ativo'},
        {'id': 'd3', 'nome_principal': 'MERCADO SEM NOTAS LTDA', 'nome_fantasia': None, 'documento': EMP['d3'], 'status': 'ativo'},
        {'id': 'd4', 'nome_principal': 'DISTRIBUIDORA DO CADASTRO LTDA', 'nome_fantasia': None, 'documento': EMP['d4'], 'status': 'ativo'},
        {'id': 'd5', 'nome_principal': 'PADARIA NADA A RECOLHER LTDA', 'nome_fantasia': None, 'documento': EMP['d5'], 'status': 'ativo'},
        {'id': 'd6', 'nome_principal': 'EX-CLIENTE DESLIGADO LTDA', 'nome_fantasia': None, 'documento': EMP['d6'], 'status': 'ativo'},
    ],
    'obrigacao': {'id': 'oD', 'nome': 'SEDIF/DESTDA - SIMPLES NACIONAL', 'periodicidade': 'mensal', 'meses_vencimento': [], 'dia_prazo': 20,
                  'gatilho_dias_antes': 0, 'ativo': True, 'regimes_aplicaveis': ['Simples Nacional']},
    'vinculos': [{'id': 'v' + c, 'cliente_id': c, 'obrigacao_id': 'oD', 'responsavel': 'Thalia', 'dia_prazo_override': None, 'ativo': c != 'd6'}
                 for c in ('d1', 'd2', 'd3', 'd5', 'd6')],
    'regras': [{'id': 'rg1', 'nome': 'Ração pet (alimento para cães e gatos)', 'ncm': '23091000', 'ufs': ['SC', 'BA', 'GO', 'RN', 'RO', 'SP'],
                'ativo': True, 'observacao': None}],
    # a nota de SC importada antes de 27/10/2026 (pela Reforma): os itens sem a base e a alíquota do ICMS
    'docs': [{'id': 'nd1', 'cliente_id': 'd1', 'importacao_id': None, 'chave': CH1, 'modelo': '55', 'numero': '101', 'data_emissao': '2026-09-05',
              'tipo': 'entrada', 'status': 'autorizada', 'emit_doc': '81000000000100', 'emit_nome': 'FORNECEDOR SC TESTE SA', 'emit_uf': 'SC',
              'dest_doc': EMP['d1'], 'tp_nf': 1}],
    'itens': [{'id': 'ni1', 'documento_id': 'nd1', 'n_item': 1, 'ncm': '85163100', 'descricao': 'SECADOR', 'cfop': '6102', 'valor_total': 1000,
               'icms_valor': 40, 'icms_st_valor': 0, 'icms_base': None, 'icms_aliquota': None, 'icms_st_base': None},
              {'id': 'ni2', 'documento_id': 'nd1', 'n_item': 2, 'ncm': '84145100', 'descricao': 'VENTILADOR', 'cfop': '6102', 'valor_total': 300,
               'icms_valor': 36, 'icms_st_valor': 0, 'icms_base': None, 'icms_aliquota': None, 'icms_st_base': None}],
}
SEMEAR = """
(() => {
  const D = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.clientes = (v.clientes || []).concat(D.clientes);
    v.obrigacoes_fiscais = (v.obrigacoes_fiscais || []).concat([D.obrigacao]);
    v.cliente_obrigacoes = (v.cliente_obrigacoes || []).concat(D.vinculos);
    v.destda_regras_st = D.regras;
    v.nf_documentos = D.docs;
    v.nf_itens = D.itens;
    v.nf_importacoes = [];
  } });
})();
""" % json.dumps(DADOS, ensure_ascii=False)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def chips(p):
    return p.eval_on_selector_all('#chips .ds-chip', 'els => els.map(e => e.textContent.trim())')

def cards(p):
    return p.eval_on_selector_all('#lista .ds-emp', 'els => els.map(e => e.dataset.empresa)')

def linhas(p, sel):
    return p.eval_on_selector_all(sel, 'trs => trs.map(t => [...t.cells].map(c => c.innerText.replace(/\\s+/g, " ").trim()))')

def db(p, expr):
    return p.evaluate('() => JSON.parse(JSON.stringify(' + expr + '))')

def esperar_mes(p, mes):
    p.wait_for_function("m => document.getElementById('tMes').textContent === 'de ' + m && !document.querySelector('#lista .spinner')", arg=mes, timeout=8000)

def trocar_mes(p, comp):
    p.evaluate("v => { const m = document.getElementById('mes'); m.value = v; m.dispatchEvent(new Event('change')); }", comp)
    esperar_mes(p, comp[5:7] + '/' + comp[:4])

def salvar_regra(p, id_):
    p.click(f'.ds-regra[data-id="{id_}"] [data-salvar]')

def msg_regra(p, id_):
    return p.inner_text(f'.ds-regra[data-id="{id_}"] .ds-regra-msg').strip()

def fluxo(b, base, tema, erros):
    cx = b.new_context(viewport={'width': 1400, 'height': 900})
    p = cx.new_page()
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}');")
    p.add_init_script(TOUR); p.add_init_script(SEMEAR)
    p.clock.set_fixed_time('2026-10-27T12:00:00')
    p.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
    p.route('**/cdnjs.cloudflare.com/ajax/libs/jszip/**', lambda r: r.fulfill(path=str(VENDOR / 'jszip.min.js'), content_type='application/javascript'))

    print(f'[{tema}] 1. A tela antes da importação')
    p.goto(base + 'fiscal-destda.html')
    esperar_mes(p, '09/2026')
    ok(p.input_value('#mes') == '2026-09', f'abre no mês anterior ({p.input_value("#mes")})')
    ok(cards(p) == ['d1'], f'só a empresa com nota de fora na base aparece ({cards(p)})')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok('foi importada antes de 27/10/2026' in c1 and 'nº 101' in c1 and 'importe os XMLs do mês de novo' in c1,
       'a nota importada antes (itens sem a alíquota) pede pra importar de novo')
    ok(chips(p) == ['0 com nota de fora do RS a 4%', '0 com ICMS-ST na entrada', '0 sem nada a recolher', '3 sem notas de entrada de 09/2026'],
       f'os números ({chips(p)})')
    curtas = p.inner_text('#curtas')
    ok('MERCADO SEM NOTAS LTDA' in curtas and 'PADARIA NADA A RECOLHER LTDA' in curtas and 'EX-CLIENTE' not in curtas and 'DISTRIBUIDORA' not in curtas,
       'as sem notas de entrada listadas; o vínculo desligado e a empresa fora da obrigação, não')
    ok('Ração pet (alimento para cães e gatos) · NCM 2309.10.00 · SC, BA, GO, RN, RO, SP' in p.inner_text('#regrasResumo'), 'o resumo das regras')

    print(f'[{tema}] 2. A importação')
    p.set_input_files('#fileInput', files=[
        {'name': 'notas-setembro.zip', 'mimeType': 'application/zip', 'buffer': zip_das_notas()},
        {'name': 'nota-505-mg.xml', 'mimeType': 'text/xml', 'buffer': N5.encode('utf-8')},
        {'name': 'relatorio.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4'},
    ])
    ok(p.inner_text('#arqs').strip() == '2 arquivo(s) na fila: 1 XML · 1 ZIP', f'a fila ({p.inner_text("#arqs")!r})')
    ok('1 arquivo(s) fora do padrão (.xml ou .zip) não entraram.' in p.inner_text('#msgImp'), 'o PDF fica de fora, com o aviso')
    p.click('#btnImportar')
    p.wait_for_function("() => document.getElementById('btnImportar').textContent === 'Importar' && /novas/.test(document.getElementById('msgImp').textContent)", timeout=15000)
    esperar_mes(p, '09/2026')
    msg = p.inner_text('#msgImp')
    ok(msg == '7 notas novas · 1 já estava na base · notas de 08/2026 (1), 09/2026 (7)', f'o resumo ({msg!r})')
    rel = p.text_content('#rel')
    ok('4 empresas nas notas' in rel and 'AGROPECUÁRIA TESTE LTDA: 4 novas, 1 já na base' in rel, 'o resumo por empresa: a d1 com 4 novas e 1 já na base')
    ok('DISTRIBUIDORA DO CADASTRO LTDA: 0 novas' not in rel and 'DISTRIBUIDORA DO CADASTRO LTDA: 1 nova, 0 já na base · não está na obrigação SEDIF/DeSTDA' in rel,
       'a empresa do cadastro fora da obrigação, marcada')
    ok('1 nota de empresa fora do cadastro (ignorada)' in rel and 'fora-<img src=z onerror="window.__pego=4">.xml' in rel,
       'a nota de fora do cadastro: ignorada, contada, com o nome do arquivo como texto')
    docs = db(p, 'window.__mockDb.nf_documentos')
    ok(len(docs) == 8, f'7 notas novas + a que já estava ({len(docs)})')
    n4 = sorted((d['cliente_id'], d['tipo']) for d in docs if d.get('numero') == '404')
    ok(n4 == [('d1', 'entrada'), ('d4', 'saida')], f'a nota entre duas empresas do cadastro: compra numa, venda na outra ({n4})')
    ok(not any(d.get('numero') == '707' for d in docs), 'a de fora do cadastro não entra')
    ok(sum(1 for d in docs if d.get('chave') == CH1) == 1, 'a que já estava não entra de novo')
    it1 = db(p, "window.__mockDb.nf_itens.filter(i => i.documento_id === 'nd1')")
    ok(len(it1) == 2 and next(i for i in it1 if i['n_item'] == 1)['icms_aliquota'] == 4 and next(i for i in it1 if i['n_item'] == 1)['icms_base'] == 1000
       and next(i for i in it1 if i['n_item'] == 2)['icms_aliquota'] == 12,
       'os itens da que já estava ganharam a base e a alíquota, sem repetir')
    lotes = db(p, 'window.__mockDb.nf_importacoes')
    ok(sorted(l['cliente_id'] for l in lotes) == ['d1', 'd2', 'd4', 'd5'] and all(l['usuario'] == 'Samuel' for l in lotes),
       f'um lote por empresa, com quem importou ({sorted(l["cliente_id"] for l in lotes)})')
    ok(p.inner_text('#arqs').strip() == '' and p.is_disabled('#btnImportar'), 'a fila esvazia')

    print(f'[{tema}] 3. A conferência de 09/2026')
    ok(cards(p) == ['d1', 'd2'], f'as empresas com o que conferir, pelo nome ({cards(p)})')
    ok(chips(p) == ['2 com nota de fora do RS a 4%', '1 com ICMS-ST na entrada', '1 sem nada a recolher', '1 sem notas de entrada de 09/2026'],
       f'os números ({chips(p)})')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok('foi importada antes' not in c1, 'a nota importada de novo não pede mais nada')
    dif = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(dif == [['05/09/2026', '101', 'FORNECEDOR SC TESTE SA SC', 'SECADOR NCM 8516.31.00 · CFOP 6102', '1.000,00', '1.000,00', '4%', '40,00']],
       f'o diferencial: só o item a 4% da nota de SC (a do RS a 4% e o item a 12%, não) ({dif})')
    ok(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tfoot tr') == [['Total', '1.000,00', '1.000,00', '', '40,00']], 'o total do diferencial')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st == [['12/09/2026', '202', 'PET FOODS SP TESTE SA SP', 'RACAO CAES 15KG NCM 2309.10.00 · CFOP 6102', '500,00', '12%', 'sem retenção'],
              ['', '', '', 'RACAO GATOS 10KG NCM 2309.10.00 · CFOP 6403', '400,00', '12%', '47,20']],
       f'o ICMS-ST: a ração de SP a 12%, a sem e a com a retenção; a do PR não ({st})')
    ok(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tfoot tr') == [['Total', '900,00', '', '47,20']], 'o total do ICMS-ST')
    ok('ICMS-ST na entrada — Ração pet (alimento para cães e gatos) · 1 nota, 2 itens · 1 item sem ST retida na nota' in c1, 'o título do ICMS-ST')
    c2 = p.inner_text('.ds-emp[data-empresa="d2"]')
    ok(PERIGO_EMPRESA in c2 and '<b>NEGRITO</b>' in c2 and PERIGO_FORNECEDOR in c2 and PERIGO_ITEM in c2 and '32,00' in c2,
       'a compra de MG a 4%, com o nome da empresa, o fantasia, o fornecedor e o item como texto')
    ok(p.get_attribute('.ds-emp[data-empresa="d1"] header a', 'href') == 'clientes/editar.html?id=d1', 'o link da ficha')
    curtas = p.inner_text('#curtas')
    ok('Sem nada a recolher em 09/2026 (1)' in curtas and 'PADARIA NADA A RECOLHER LTDA' in curtas
       and 'Sem notas de entrada importadas de 09/2026 (1)' in curtas and 'MERCADO SEM NOTAS LTDA' in curtas, 'a sem nada a recolher e a sem notas')
    FOTOS.mkdir(parents=True, exist_ok=True)
    p.screenshot(path=str(FOTOS / f'{tema}-destda.png'), full_page=True)

    print(f'[{tema}] 4. Trocar o mês')
    trocar_mes(p, '2026-08')
    ok(cards(p) == ['d1'] and linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')[0][:3] == ['20/08/2026', '808', 'GOIAS TESTE SA GO'],
       'agosto: só a nota de GO a 4%')
    ok(chips(p) == ['1 com nota de fora do RS a 4%', '0 com ICMS-ST na entrada', '0 sem nada a recolher', '3 sem notas de entrada de 08/2026'],
       f'os números de agosto ({chips(p)})')
    trocar_mes(p, '2026-09')
    ok(cards(p) == ['d1', 'd2'], 'de volta a setembro')

    print(f'[{tema}] 5. As regras')
    p.click('#secRegras > summary')
    ok(p.input_value('.ds-regra[data-id="rg1"] [data-campo="ncm"]') == '2309.10.00' and p.input_value('.ds-regra[data-id="rg1"] [data-campo="ufs"]') == 'SC, BA, GO, RN, RO, SP',
       'a regra da ração, com o NCM e os estados')
    p.fill('.ds-regra[data-id="rg1"] [data-campo="ufs"]', 'SC, BA, GO, RN, RO, SP, XX')
    salvar_regra(p, 'rg1')
    ok(msg_regra(p, 'rg1') == 'Não é estado: XX.' and db(p, "window.__mockDb.destda_regras_st[0].ufs") == ['SC', 'BA', 'GO', 'RN', 'RO', 'SP'],
       'estado que não existe não grava')
    p.fill('.ds-regra[data-id="rg1"] [data-campo="ufs"]', 'sc ba go rn ro sp pr')
    salvar_regra(p, 'rg1')
    p.wait_for_function("() => /Salva/.test(document.querySelector('.ds-regra[data-id=\"rg1\"] .ds-regra-msg').textContent)", timeout=3000)
    ok(db(p, "window.__mockDb.destda_regras_st.find(r => r.id === 'rg1').ufs") == ['SC', 'BA', 'GO', 'RN', 'RO', 'SP', 'PR'], 'o PR entra na regra')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(len(st) == 3 and st[2][:3] == ['15/09/2026', '303', 'PET PR TESTE SA PR'], f'a nota do PR entra na conferência na hora ({[l[:2] for l in st]})')
    p.click('#btnNovaRegra')
    ok(p.locator('.ds-regra[data-id=""]').count() == 1, '"+ Nova regra" abre uma linha')
    p.click('#btnNovaRegra')
    ok(p.locator('.ds-regra[data-id=""]').count() == 1, 'uma de cada vez')
    salvar_regra(p, '')
    ok(msg_regra(p, '') == 'Dê um nome à regra.', 'sem nome não grava')
    p.fill('.ds-regra[data-id=""] [data-campo="nome"]', 'Bebida teste')
    p.fill('.ds-regra[data-id=""] [data-campo="ncm"]', '2')
    p.fill('.ds-regra[data-id=""] [data-campo="ufs"]', 'SP')
    salvar_regra(p, '')
    ok(msg_regra(p, '').startswith('O NCM tem de ter de 2 a 8 dígitos') and len(db(p, 'window.__mockDb.destda_regras_st')) == 1, 'NCM curto não grava')
    p.fill('.ds-regra[data-id=""] [data-campo="ncm"]', '2202')
    p.fill('.ds-regra[data-id=""] [data-campo="ufs"]', '')
    salvar_regra(p, '')
    ok(msg_regra(p, '') == 'Ponha pelo menos um estado de origem.', 'sem estado não grava')
    p.fill('.ds-regra[data-id=""] [data-campo="ufs"]', 'SP')
    salvar_regra(p, '')
    p.wait_for_function("() => !document.querySelector('.ds-regra[data-id=\"\"]')", timeout=3000)
    nova = db(p, "window.__mockDb.destda_regras_st.find(r => r.nome === 'Bebida teste')")
    ok(nova and nova['ncm'] == '2202' and nova['ufs'] == ['SP'] and nova['ativo'] is True, f'a regra nova grava ({nova})')
    p.once('dialog', lambda d: d.accept())
    p.click(f'.ds-regra[data-id="{nova["id"]}"] [data-excluir]')
    p.wait_for_function("id => !document.querySelector('.ds-regra[data-id=\"' + id + '\"]')", arg=nova['id'], timeout=3000)
    ok(len(db(p, 'window.__mockDb.destda_regras_st')) == 1, 'a excluída sai')
    p.click('#btnNovaRegra'); p.click('.ds-regra[data-id=""] [data-cancelar]')
    ok(p.locator('.ds-regra[data-id=""]').count() == 0, '"Cancelar" tira a linha nova')
    p.uncheck('.ds-regra[data-id="rg1"] [data-campo="ativo"]')
    salvar_regra(p, 'rg1')
    p.wait_for_function("() => /Salva/.test(document.querySelector('.ds-regra[data-id=\"rg1\"] .ds-regra-msg').textContent)", timeout=3000)
    ok(db(p, "window.__mockDb.destda_regras_st[0].ativo") is False and p.locator('.ds-emp[data-empresa="d1"] table.ds-st').count() == 0
       and chips(p)[1] == '0 com ICMS-ST na entrada' and p.inner_text('#regrasResumo').strip() == 'Nenhuma regra ativa.',
       'a regra desligada tira o ICMS-ST da conferência')

    print(f'[{tema}] 6. Texto de fora')
    ok(p.evaluate('() => window.__pego') is None, 'nenhum <img onerror> rodou')

    print(f'[{tema}] 7. O card no Fiscal')
    p.goto(base + 'fiscal.html')
    p.wait_for_function("() => document.querySelector('.card-status[data-mod=\"fiscal-destda.html\"]').textContent !== '·'", timeout=8000)
    selo = p.text_content('.card-status[data-mod="fiscal-destda.html"]')   # o selo é em maiúsculas só no CSS
    ok(selo == '4 empresas', f'"4 empresas" ({selo})')
    cx.close()

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            fluxo(b, base, tema, erros)
        b.close()
    srv.shutdown()
    for e in erros:
        print('  ✗ erro de JavaScript: ' + e)
    total = falhas + len(erros)
    print(f'\n{total} FALHA(S)' if total else '\nTudo certo.')
    sys.exit(1 if total else 0)

if __name__ == '__main__':
    main()
