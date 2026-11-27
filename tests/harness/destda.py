"""
Conferência SEDIF/DeSTDA (Fiscal, 27/10/2026, pedido da Thalia) — sem login e sem banco (o mock do conferir.py, com as
empresas, a obrigação, a regra da ração e uma nota importada antes semeadas só neste teste; nomes, CNPJs — com o dígito
errado — e notas inventados). O relógio fica parado em 27/10/2026, meio-dia: a tela abre em 09/2026.

    python tests/harness/destda.py

Confere, nos temas escuro e claro:
  1. a tela abre no mês anterior, na aba "Todas", recolhida (uma linha por empresa), com as empresas da obrigação
     SEDIF/DeSTDA (o vínculo desligado fica de fora); a nota importada antes de 27/10 (sem a alíquota nos itens) pede pra
     importar de novo, já na linha da empresa; as outras, "sem notas de entrada", numa lista que abre e recolhe; a aba
     "Falta importar" lista as duas coisas (e fica marcada durante a importação, com a lista encolhendo);
  2. a importação de um ZIP com subpastas e de um XML solto, com as notas de várias empresas: cada nota na empresa do
     CNPJ (a nota entre duas empresas do cadastro nas duas: venda numa, compra na outra), a de fora do cadastro ignorada
     e contada, o arquivo que não é nota fora; a que já estava na base não entra de novo, mas os itens dela ganham a
     alíquota; um lote por empresa; o resumo por empresa, com a que não está na obrigação marcada;
  3. a conferência de 09/2026: na linha da empresa, o DIFAL e o ST do mês; aberta, as notas de fora do RS a 4% (a do RS
     a 4% e o item a 12% não), cada nota numa linha com o total dela e o DIFAL (13% da base dos itens a 4%, na nota
     inteira), os itens abrindo embaixo, o total e a linha da conta; o diferencial, a nota e a empresa recolhem;
     a ração de SP (mesmo a 12%) no ICMS-ST, com o que o fornecedor reteve, o item sem retenção e o ST a recolher da nota
     (17% da base − o ICMS destacado, a retida fora); a ração do PR não; a de cavalo (2309.90.10) fica fora pelo nome,
     numa linha embaixo; a empresa sem nada a recolher e a sem notas de entrada;
  3b. as abas (pedido da Thalia): "Com DIFAL" com só o diferencial, "Com ICMS-ST" com só o ST, "Sem nada a recolher" e
     "Falta importar" com os nomes, cada uma com a conta dela embaixo; pelo teclado (Enter e espaço);
  3c. o recolher (pedido do Samuel): agrupar as notas por fornecedor e por data, com o subtotal e guardado no navegador;
     Expandir tudo e Recolher tudo;
  3d. a data de entrada (26/11/2026, a nota emitida em 30/09 que a Domínio pôs em outubro, da Thalia): a lista das notas
     do fim do mês anterior sem a data, com o "Entrou em <mês>"; a janela (a sugestão, antes da emissão e depois de hoje
     não gravam, o Esc, o Enter); marcada, a nota entra no mês da entrada, com quem marcou na linha dela, e sai da lista
     do mês da emissão, onde aparece entre as que entraram noutro mês; "Voltar à data de emissão"; a data que a Domínio
     manda com a janela aberta fica (a tela não grava por cima), e a da Domínio não tem o botão de mudar;
  3e. a empresa sem notas de entrada no mês (26/11/2026, pedido da Thalia): o "Não teve notas de entrada no mês" em
     "Falta importar" grava a marca (só a empresa e o mês) e leva a empresa pra "Sem nada a recolher", com quem marcou e o
     "Desmarcar"; a marca fica ao ler o mês de novo; a nota de entrada que chega vale mais que a marca; a marca que outra
     pessoa gravou no mesmo instante vale; desmarcar volta; a marca que não se lê não para a conferência;
  3f. a lista da Domínio (26/11/2026, o "vai" do Samuel): a linha embaixo das abas (de quando é, quantas faltam, ou
     conferida); as que faltam na linha da empresa, no detalhe e em "Falta importar", por empresa (a data de entrada da
     Domínio, o número e a série, quem emitiu — o nome pelas notas dele, como texto; na NF-e avulsa, o CNPJ do Fisco —, a
     emissão e a chave), com o "Copiar as chaves"; a que a Domínio não lista mais, não; a nota da base sem a data que a
     Domínio pôs no mês conta nele, pela lista, sem gravar nada e sem o botão de mudar; a do fim do mês anterior que ela pôs
     no anterior sai da virada; a empresa sem nada a recolher com nota faltando vai pra "Falta importar"; a sem notas na
     base sem o "Não teve", e a marca dela não vale; a lista que não se lê não para a conferência;
  4. trocar o mês na aba "Com DIFAL": 08/2026 mostra só a nota de GO, com o DIFAL dela, e a aba fica; o item a 4% que o
     nome não decide fica fora do DIFAL, com o aviso;
  4b. a ração pet de outro NCM (28/10/2026, as notas da Thalia com 2309.90.10): a de gato entra no ST pelo nome, com a
     palavra; o TERNERON fica fora pelo nome; a marca que nenhuma lista conhece fica "a conferir", fora das duas contas,
     com o CEST; o "Abrir as regras" leva pros nomes que entram da regra, e pôr a marca lá a põe no ST na hora; a palavra
     nas duas listas avisa;
  5. as regras: estado que não existe, NCM curto e regra sem nome não gravam; pôr o PR na ração grava e a nota do PR
     entra na hora; a regra nova grava e a excluída sai; a desligada tira o ICMS-ST da conferência;
  6. texto de fora entra como texto (o nome da empresa, do fornecedor, do item e do arquivo com <img onerror>);
  7. o card no Fiscal: "4 empresas";
  8. as do Simples todas (27/11/2026, pedido da Thalia: "todas do simples"): as do Simples Nacional da carteira de hoje
     entram na conferência sem o vínculo da obrigação (a que saiu da carteira e o MEI, não), com a nota "sem a tarefa do
     mês" na linha; a sem nota de entrada que a Domínio diz que não comprou mercadoria no mês (as saídas lá, as compras
     zeradas) vai sozinha pra "Sem nada a recolher", sem botão; a que a Domínio diz que comprou segue em "Falta importar",
     com o "Não teve"; o mês da Domínio que não se lê não para a conferência; o card no Fiscal conta todas;
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

def chave_de(numero, uf, cnpj_emit, data, serie='001'):   # a chave das notas daqui (o dígito verificador não é conferido)
    chave = CUF[uf] + data[2:4] + data[5:7] + cnpj_emit + '55' + serie + str(numero).zfill(9) + '1' + str(numero).zfill(8) + '0'
    assert len(chave) == 44
    return chave

def nfe(numero, uf, cnpj_emit, nome_emit, cnpj_dest, data, itens, tpnf=1):
    chave = chave_de(numero, uf, cnpj_emit, data)
    def det(i, it):   # (ncm, descrição, cfop, valor, icms[, cest])
        ncm, desc, cfop, valor, icms = it[:5]
        cest = f'<CEST>{it[5]}</CEST>' if len(it) > 5 else ''
        return (f'<det nItem="{i}"><prod><cProd>{i}</cProd><xProd>{xt(desc)}</xProd><NCM>{ncm}</NCM>{cest}<CFOP>{cfop}</CFOP><uCom>UN</uCom>'
                f'<qCom>1</qCom><vUnCom>{valor:.2f}</vUnCom><vProd>{valor:.2f}</vProd></prod><imposto><ICMS>{icms}</ICMS></imposto></det>')
    dets = ''.join(det(i, it) for i, it in enumerate(itens, 1))
    total = sum(i[3] for i in itens)
    return chave, f'''<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe{chave}" versao="4.00">
<ide><cUF>{CUF[uf]}</cUF><mod>55</mod><serie>1</serie><nNF>{numero}</nNF><dhEmi>{data}T10:00:00-03:00</dhEmi><tpNF>{tpnf}</tpNF><finNFe>1</finNFe></ide>
<emit><CNPJ>{cnpj_emit}</CNPJ><xNome>{xt(nome_emit)}</xNome><enderEmit><UF>{uf}</UF></enderEmit><CRT>3</CRT></emit>
<dest><CNPJ>{cnpj_dest}</CNPJ><xNome>EMPRESA DE DESTINO TESTE</xNome><enderDest><UF>RS</UF></enderDest></dest>
{dets}<total><ICMSTot><vProd>{total:.2f}</vProd><vNF>{total:.2f}</vNF></ICMSTot></total>
</infNFe></NFe><protNFe><infProt><chNFe>{chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>'''

# setembro: d1 tem uma nota de SC já na base (item a 4% e outro a 12%), a ração de SP (uma sem e outra com o ST retido —
# o ST a recolher, 17% de 500 − 60 = 25,00 —, e a ração de cavalo, 2309.90.10, que não é pet), a ração do PR (fora da
# regra) e uma compra do RS a 4% de outra empresa do cadastro (d4, que não é da SEDIF); d2 compra
# de MG com dois itens a 4% (o fornecedor e o item com <img onerror>; o DIFAL da nota, 13% de 1.050,05 = 136,5065 →
# 136,51); d5 só compra a 12%; e uma nota entre dois de fora do cadastro. Agosto: uma de GO a 4% pra d1
CH1, N1 = nfe(101, 'SC', '81000000000100', 'FORNECEDOR SC TESTE SA', EMP['d1'], '2026-09-05',
              [('85163100', 'SECADOR', '6102', 1000, icms00(4, 1000)), ('84145100', 'VENTILADOR', '6102', 300, icms00(12, 300))])
_, N2 = nfe(202, 'SP', '82000000000100', 'PET FOODS SP TESTE SA', EMP['d1'], '2026-09-12',
            [('23091000', 'RACAO CAES 15KG', '6102', 500, icms00(12, 500)), ('23091000', 'RACAO GATOS 10KG', '6403', 400, icms10(12, 400, 560, 47.20)),
             ('23099010', 'RACAO CAVALO 40KG', '6101', 300, icms00(12, 300))])
_, N3 = nfe(303, 'PR', '83000000000100', 'PET PR TESTE SA', EMP['d1'], '2026-09-15', [('23091000', 'RACAO FILHOTES', '6102', 250, icms00(12, 250))])
_, N4 = nfe(404, 'RS', EMP['d4'], 'DISTRIBUIDORA DO CADASTRO LTDA', EMP['d1'], '2026-09-20', [('85163100', 'SECADOR', '5102', 100, icms00(4, 100))])
_, N5 = nfe(505, 'MG', '84000000000100', PERIGO_FORNECEDOR, EMP['d2'], '2026-09-08',
            [('85098090', PERIGO_ITEM, '6102', 800, icms00(4, 800)), ('85094050', 'LIQUIDIFICADOR', '6102', 250.05, icms00(4, 250.05))])
_, N6 = nfe(606, 'SC', '81000000000100', 'FORNECEDOR SC TESTE SA', EMP['d5'], '2026-09-09', [('19052090', 'PAO', '6102', 200, icms00(12, 200))])
_, N7 = nfe(707, 'SP', '86000000000100', 'TERCEIRO SA', '87000000000100', '2026-09-10', [('85163100', 'SECADOR', '6102', 90, icms00(4, 90))])
_, N8 = nfe(808, 'GO', '88000000000100', 'GOIAS TESTE SA', EMP['d1'], '2026-08-20', [('85163100', 'SECADOR', '6102', 700, icms00(4, 700))])
# agosto, a ração pet que o fornecedor pôs no 2309.90.10 (as notas da Thalia, 28/10/2026): a de gato entra pelo nome (ST de
# 17% de 200 − 24 = 10,00), o TERNERON fica fora pelo nome e a marca que nenhuma lista conhece, a 4%, fica a conferir
_, N9 = nfe(909, 'SC', '89000000000100', 'RACOES SC TESTE SA', EMP['d1'], '2026-08-25',
            [('23099010', 'RACAO GRAN NATURE GATOS CASTRADOS 10KG', '6102', 200, icms00(12, 200)),
             ('23099010', 'TERNERON 25KG', '6102', 150, icms00(12, 150)),
             ('23099010', 'RACAO MARCA NOVA 15KG', '6102', 100, icms00(4, 100), '2200100')])

def zip_das_notas():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for nome, xml in (('entradas/101.xml', N1), ('entradas/202.xml', N2), ('entradas/303.xml', N3), ('entradas/404.xml', N4),
                          ('entradas/606.xml', N6), (ARQ_FORA, N7), ('entradas/agosto/808.xml', N8), ('entradas/agosto/909.xml', N9)):
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
                'ativo': True, 'observacao': None,
                'nomes_entram': ['CÃO', 'CÃES', 'GATO', 'FILHOTE', 'GRAN NATURE', 'G. N.'], 'nomes_fora': ['CAVALO', 'EQUINO', 'BEZERRO', 'TERNERON', 'AVES']}],
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

def abas(p):   # o número de cada aba
    return p.eval_on_selector_all('#abas [data-aba]', 'els => Object.fromEntries(els.map(e => [e.dataset.aba, e.querySelector(".fc-num").textContent]))')

def aba_ativa(p):
    return p.eval_on_selector_all('#abas [data-aba]', 'els => els.filter(e => e.getAttribute("aria-pressed") === "true").map(e => e.dataset.aba)')

def abrir_aba(p, k):
    p.click(f'#abas [data-aba="{k}"]')

def cards(p):
    return p.eval_on_selector_all('#lista .ds-emp', 'els => els.map(e => e.dataset.empresa)')

def linhas(p, sel):   # as linhas que estão na tela (as recolhidas ficam de fora, e a da data de entrada da nota também: o 3d confere)
    return p.eval_on_selector_all(sel, 'trs => trs.filter(t => !t.closest("[hidden]") && !t.classList.contains("ds-ent")).map(t => [...t.cells].map(c => c.innerText.replace(/\\s+/g, " ").trim()))')

def texto(p, sel):   # o texto de um elemento, numa linha só
    return p.eval_on_selector(sel, 'e => e.innerText.replace(/\\s+/g, " ").trim()')

def esperar(p, js, arg=None):
    p.wait_for_function(js, arg=arg, timeout=8000)

N909 = "window.__mockDb.nf_documentos.find(d => d.numero === '909' && d.cliente_id === 'd1')"

def campo(p, nome):   # um campo da nota 909 da d1 no banco falso (o que falta volta None)
    return db(p, '(' + N909 + '.' + nome + ' ?? null)')

def campo_de(p, numero, nome):   # um campo de uma nota da d1 no banco falso
    return db(p, "(window.__mockDb.nf_documentos.find(d => d.numero === '" + numero + "' && d.cliente_id === 'd1')." + nome + ' ?? null)')

def valores(p, id_):   # o DIFAL e o ST na linha da empresa
    return p.eval_on_selector_all(f'.ds-emp[data-empresa="{id_}"] > .ds-emp-linha .ds-emp-val', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')

def aberta(p, id_):
    return p.get_attribute(f'.ds-emp[data-empresa="{id_}"] > .ds-emp-linha h3 button', 'aria-expanded') == 'true'

def abrir_empresa(p, id_, abrir=True):
    if aberta(p, id_) != abrir:
        p.click(f'.ds-emp[data-empresa="{id_}"] > .ds-emp-linha h3 button')

def abrir_nota(p, id_, tabela, numero):
    p.locator(f'.ds-emp[data-empresa="{id_}"] table.{tabela} tr.ds-n').filter(has=p.locator(f'td:nth-child(2):text-is("{numero}")')).locator('button').click()

def abertas(p):
    return p.locator('.ds-emp-corpo:not([hidden])').count()

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
    cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))   # o "Copiar as chaves" (3f)
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
    ok(not aberta(p, 'd1') and p.is_hidden('#det-d1') and p.is_visible('#ferr'), 'o mês abre recolhido: a empresa numa linha só')
    ok('1 nota de fora do RS sem a alíquota: importe de novo' in p.inner_text('.ds-emp[data-empresa="d1"] > .ds-emp-linha'),
       'a nota importada antes (itens sem a alíquota) aparece já na linha da empresa')
    abrir_empresa(p, 'd1')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok(p.is_visible('#det-d1') and 'foi importada antes de 27/10/2026' in c1 and 'nº 101' in c1 and 'importe os XMLs do mês de novo' in c1,
       'aberta, ela pede pra importar de novo')
    abrir_empresa(p, 'd1', False)
    ok(p.is_hidden('#det-d1') and not aberta(p, 'd1'), 'e recolhe de novo')
    ok(abas(p) == {'difal': '0', 'st': '0', 'nada': '0', 'importar': '4', 'todas': '4'} and aba_ativa(p) == ['todas'],
       f'os números das abas: as 3 sem notas e a da nota importada antes em "Falta importar"; abre em "Todas" ({abas(p)}, {aba_ativa(p)})')
    ok('fc-warn' in p.get_attribute('#abas [data-aba="importar"]', 'class'), '"Falta importar" em amarelo')
    curtas = p.inner_text('#curtas')
    ok('Sem notas de entrada importadas de 09/2026 (3)' in curtas and 'MERCADO SEM NOTAS LTDA' not in curtas, 'a lista das sem notas vem recolhida, só com o título')
    p.click('#curtas h3[data-alterna="l:semNotas"] button')
    curtas = p.inner_text('#curtas')
    ok('MERCADO SEM NOTAS LTDA' in curtas and 'PADARIA NADA A RECOLHER LTDA' in curtas and 'EX-CLIENTE' not in curtas and 'DISTRIBUIDORA' not in curtas,
       'aberta: as sem notas de entrada; o vínculo desligado e a empresa fora da obrigação, não')
    ok('Ração pet (alimento para cães e gatos) · NCM 2309.10.00 · SC, BA, GO, RN, RO, SP · o resto do 2309 pelo nome (6 nomes que entram, 5 que ficam fora)' in p.inner_text('#regrasResumo'),
       f'o resumo das regras, com as listas de nomes ({p.inner_text("#regrasResumo")!r})')
    abrir_aba(p, 'importar')
    imp = p.inner_text('#lista')
    ok(aba_ativa(p) == ['importar'] and cards(p) == [] and p.inner_text('#curtas').strip() == '' and p.inner_text('#conta').strip() == '' and p.is_hidden('#ferr'),
       'a aba "Falta importar": só ela marcada, sem as empresas, sem as listas de baixo e sem o agrupar')
    ok('Sem notas de entrada importadas de 09/2026 (3)' in imp and 'MERCADO SEM NOTAS LTDA' in imp and 'PADARIA NADA A RECOLHER LTDA' in imp and PERIGO_EMPRESA in imp
       and 'Com nota de fora do RS importada antes de 27/10/2026, sem a alíquota do ICMS (1)' in imp and 'AGROPECUÁRIA TESTE LTDA (AGRO TESTE)\nnota 101' in imp,
       f'as sem notas de entrada e a da nota importada antes, com o número da nota ({imp!r})')
    FOTOS.mkdir(parents=True, exist_ok=True)
    p.screenshot(path=str(FOTOS / f'{tema}-destda-importar.png'), full_page=True)

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
    ok(msg == '8 notas novas · 1 já estava na base · notas de 08/2026 (2), 09/2026 (7)', f'o resumo ({msg!r})')
    rel = p.text_content('#rel')
    ok('4 empresas nas notas' in rel and 'AGROPECUÁRIA TESTE LTDA: 5 novas, 1 já na base' in rel, 'o resumo por empresa: a d1 com 5 novas e 1 já na base')
    ok('DISTRIBUIDORA DO CADASTRO LTDA: 0 novas' not in rel and 'DISTRIBUIDORA DO CADASTRO LTDA: 1 nova, 0 já na base · não está na obrigação SEDIF/DeSTDA' in rel,
       'a empresa do cadastro fora da obrigação, marcada')
    ok('1 nota de empresa fora do cadastro (ignorada)' in rel and 'fora-<img src=z onerror="window.__pego=4">.xml' in rel,
       'a nota de fora do cadastro: ignorada, contada, com o nome do arquivo como texto')
    docs = db(p, 'window.__mockDb.nf_documentos')
    ok(len(docs) == 9, f'8 notas novas + a que já estava ({len(docs)})')
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
    imp = p.inner_text('#lista')
    ok(aba_ativa(p) == ['importar'] and 'Sem notas de entrada importadas de 09/2026 (1)' in imp and 'MERCADO SEM NOTAS LTDA' in imp
       and 'PADARIA' not in imp and 'AGROPECUÁRIA' not in imp and 'antes de 27/10/2026' not in imp,
       f'a aba fica marcada depois da importação, e a lista encolhe: só a que segue sem notas ({imp!r})')

    print(f'[{tema}] 3. A conferência de 09/2026')
    abrir_aba(p, 'todas')
    ok(cards(p) == ['d1', 'd2'], f'as empresas com o que conferir, pelo nome ({cards(p)})')
    ok(abas(p) == {'difal': '2', 'st': '1', 'nada': '1', 'importar': '1', 'todas': '4'}, f'os números ({abas(p)})')
    ok(not aberta(p, 'd1') and not aberta(p, 'd2') and abertas(p) == 0, 'recolhidas: uma linha por empresa')
    ok(valores(p, 'd1') == ['DIFAL: R$ 130,00 1 nota', 'ICMS-ST a recolher: R$ 25,00 1 nota'] and valores(p, 'd2') == ['DIFAL: R$ 136,51 1 nota', 'ICMS-ST a recolher: —'],
       f'na linha, o DIFAL e o ST do mês de cada empresa ({valores(p, "d1")}, {valores(p, "d2")})')
    ok('sem a alíquota' not in p.inner_text('.ds-emp[data-empresa="d1"] > .ds-emp-linha'), 'a nota importada de novo não pede mais nada')
    abrir_empresa(p, 'd1')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok('foi importada antes' not in c1, 'nem no detalhe')
    dif = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(dif == [['05/09/2026', '101', 'FORNECEDOR SC TESTE SA SC', '1', '1.000,00', '1.000,00', '', '40,00', '130,00']],
       f'aberta: o diferencial numa linha por nota, com o total dela e o DIFAL de 13% (a do RS a 4% e o item a 12%, não); os itens recolhidos ({dif})')
    abrir_nota(p, 'd1', 'ds-dif', '101')
    dif = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(dif[1:] == [['', '', 'SECADOR NCM 8516.31.00 · CFOP 6102', '', '1.000,00', '1.000,00', '4%', '40,00', '']], f'clicar na nota abre os itens dela ({dif})')
    ok(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tfoot tr') == [['Total', '1', '1.000,00', '1.000,00', '', '40,00', '130,00']], 'o total do diferencial, com o DIFAL')
    ok('Diferencial de alíquota — ICMS a 4% de fora do RS · 1 nota, 1 item · DIFAL R$ 130,00' in c1, 'o título do diferencial, com o DIFAL')
    abrir_empresa(p, 'd2')
    dif2 = linhas(p, '.ds-emp[data-empresa="d2"] table.ds-dif tbody tr')
    ok(len(dif2) == 1 and dif2[0][:2] == ['08/09/2026', '505'] and dif2[0][3:] == ['2', '1.050,05', '1.050,05', '', '42,00', '136,51'],
       f'a nota de MG com dois itens a 4%: numa linha só (o totalizador por nota, pedido da Thalia), com o DIFAL da nota inteira — 13% de 1.050,05 = 136,51 ({dif2})')
    abrir_nota(p, 'd2', 'ds-dif', '505')
    dif2 = linhas(p, '.ds-emp[data-empresa="d2"] table.ds-dif tbody tr')
    ok(len(dif2) == 3 and [l[7:] for l in dif2[1:]] == [['32,00', ''], ['10,00', '']], f'aberta, os dois itens embaixo, sem o DIFAL — ele é da nota ({[l[7:] for l in dif2]})')
    ok(linhas(p, '.ds-emp[data-empresa="d2"] table.ds-dif tfoot tr')[0][-1] == '136,51', 'o total da empresa')
    conta = p.inner_text('#conta').split('\n')
    ok(len(conta) == 2 and conta[0].startswith('DIFAL = a base do ICMS dos itens a 4% × 13% (os 17% do RS menos os 4% da nota), nota por nota, sem o IPI.')
       and conta[1].startswith('ICMS-ST = a base do ICMS dos itens da regra × 17% (a alíquota do RS) − o ICMS destacado neles, nota por nota, sem MVA.')
       and p.get_attribute('.ds-emp[data-empresa="d1"] table.ds-dif th:last-child', 'title') == conta[0]
       and p.get_attribute('.ds-emp[data-empresa="d1"] table.ds-st th:last-child', 'title') == conta[1],
       f'como o DIFAL e o ST são calculados, embaixo da lista e na dica das colunas ({conta!r})')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st == [['12/09/2026', '202', 'PET FOODS SP TESTE SA SP', '2', '900,00', '500,00', '', '60,00', '47,20', '25,00']],
       f'o ICMS-ST: a nota da ração de SP numa linha, com a base e o ICMS só dos itens da conta (a retida fora), o retido e o a recolher (17% de 500 − 60) ({st})')
    abrir_nota(p, 'd1', 'ds-st', '202')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st[1:] == [['', '', 'RACAO CAES 15KG NCM 2309.10.00 · CFOP 6102', '', '500,00', '500,00', '12%', '60,00', 'sem retenção', ''],
                  ['', '', 'RACAO GATOS 10KG NCM 2309.10.00 · CFOP 6403', '', '400,00', '400,00', '12%', '48,00', '47,20', '']],
       f'os itens: a ração de SP a 12%, a sem e a com a retenção; a do PR e a de cavalo não ({st})')
    ok(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tfoot tr') == [['Total', '2', '900,00', '500,00', '', '60,00', '47,20', '25,00']], 'o total do ICMS-ST')
    ok('ICMS-ST na entrada — Ração pet (alimento para cães e gatos) · 1 nota, 2 itens · ST a recolher R$ 25,00' in p.inner_text('.ds-emp[data-empresa="d1"]'), 'o título do ICMS-ST')
    ok('RACAO CAVALO' not in p.text_content('.ds-emp[data-empresa="d1"] table.ds-st')
       and 'Ficou fora pelo nome: RACAO CAVALO 40KG (nota 202, por "CAVALO").' in p.inner_text('.ds-emp[data-empresa="d1"]'),
       'a ração de cavalo (2309.90.10, outro NCM da posição) fica fora do ST pelo nome, numa linha embaixo')
    c2 = p.inner_text('.ds-emp[data-empresa="d2"]')
    ok(PERIGO_EMPRESA in c2 and '<b>NEGRITO</b>' in c2 and PERIGO_FORNECEDOR in c2 and PERIGO_ITEM in c2 and '32,00' in c2,
       'a compra de MG a 4%, com o nome da empresa, o fantasia, o fornecedor e o item como texto')
    ok(p.get_attribute('.ds-emp[data-empresa="d1"] > .ds-emp-linha > a', 'href') == 'clientes/editar.html?id=d1', 'o link da ficha')
    p.click('.ds-emp[data-empresa="d1"] .ds-cat[data-cat="dif"] h4 button')
    ok(p.is_hidden('.ds-emp[data-empresa="d1"] .ds-cat[data-cat="dif"] .ds-tab') and p.is_visible('.ds-emp[data-empresa="d1"] .ds-cat[data-cat="st"] .ds-tab'),
       'o diferencial recolhe sozinho; o ICMS-ST continua aberto')
    p.click('.ds-emp[data-empresa="d1"] .ds-cat[data-cat="dif"] h4 button')
    ok(p.is_visible('.ds-emp[data-empresa="d1"] .ds-cat[data-cat="dif"] .ds-tab'), 'e abre de novo')
    p.click('.ds-emp[data-empresa="d1"] table.ds-st tr.ds-n td:nth-child(5)')
    ok(len(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')) == 1, 'clicar em qualquer lugar da linha da nota recolhe os itens')
    p.focus('.ds-emp[data-empresa="d2"] > .ds-emp-linha h3 button'); p.keyboard.press('Enter')
    ok(not aberta(p, 'd2') and p.is_hidden('#det-d2'), 'pelo teclado: Enter na empresa recolhe')
    curtas = p.inner_text('#curtas')
    ok('Sem nada a recolher em 09/2026 (1)' in curtas and 'PADARIA' not in curtas and 'Sem notas de entrada importadas de 09/2026 (1)' in curtas and 'MERCADO SEM NOTAS LTDA' in curtas,
       'embaixo, a sem nada a recolher recolhida e a sem notas aberta, como ficou antes')
    p.click('#curtas h3[data-alterna="l:nada"] button')
    ok('PADARIA NADA A RECOLHER LTDA' in p.inner_text('#curtas'), 'abrir a lista das sem nada a recolher')
    p.screenshot(path=str(FOTOS / f'{tema}-destda.png'), full_page=True)

    print(f'[{tema}] 3b. As abas (pedido da Thalia)')
    p.click('#btnFecharTudo')
    ok(abertas(p) == 0 and 'PADARIA' not in p.inner_text('#curtas') and 'MERCADO' not in p.inner_text('#curtas'), '"Recolher tudo" fecha as empresas e as listas')
    abrir_aba(p, 'difal')
    ok(aba_ativa(p) == ['difal'] and cards(p) == ['d1', 'd2'] and valores(p, 'd1') == ['DIFAL: R$ 130,00 1 nota'],
       f'"Com DIFAL": as duas empresas, a linha só com o DIFAL ({cards(p)}, {valores(p, "d1")})')
    abrir_empresa(p, 'd1')
    ok(p.locator('.ds-emp[data-empresa="d1"] table.ds-dif').count() == 1 and p.locator('.ds-emp table.ds-st').count() == 0,
       'aberta, só o diferencial: o ICMS-ST da d1 fica na aba dele')
    conta = p.inner_text('#conta').strip()
    ok(conta.startswith('DIFAL = ') and 'ICMS-ST =' not in conta and p.inner_text('#curtas').strip() == '', 'embaixo, só a conta do DIFAL; sem as listas')
    abrir_aba(p, 'st')
    ok(aba_ativa(p) == ['st'] and cards(p) == ['d1'] and valores(p, 'd1') == ['ICMS-ST a recolher: R$ 25,00 1 nota'] and aberta(p, 'd1')
       and p.locator('.ds-emp table.ds-dif').count() == 0
       and linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tfoot tr') == [['Total', '2', '900,00', '500,00', '', '60,00', '47,20', '25,00']],
       f'"Com ICMS-ST": só a d1, aberta como estava, só com o ST ({cards(p)})')
    ok(p.inner_text('#conta').strip().startswith('ICMS-ST = ') and 'DIFAL =' not in p.inner_text('#conta'), 'embaixo, só a conta do ST')
    abrir_aba(p, 'nada')
    nada = p.inner_text('#lista')
    ok(aba_ativa(p) == ['nada'] and cards(p) == [] and 'Sem nada a recolher em 09/2026 (1)' in nada and 'PADARIA NADA A RECOLHER LTDA' in nada
       and 'MERCADO' not in nada and 'Têm notas de entrada do mês na base' in nada and p.is_hidden('#ferr'),
       f'"Sem nada a recolher": só a padaria, com o porquê ({nada!r})')
    p.focus('#abas [data-aba="importar"]'); p.keyboard.press('Enter')
    ok(aba_ativa(p) == ['importar'] and 'MERCADO SEM NOTAS LTDA' in p.inner_text('#lista'), 'pelo teclado: Enter na aba abre')
    p.focus('#abas [data-aba="difal"]'); p.keyboard.press(' ')
    ok(aba_ativa(p) == ['difal'], 'e espaço também')

    print(f'[{tema}] 3c. Agrupar por data e por fornecedor, expandir e recolher tudo (pedido do Samuel)')
    abrir_aba(p, 'todas')
    ok(aberta(p, 'd1') and not aberta(p, 'd2'), 'em "Todas", a d1 continua aberta')
    p.click('#agrupar [data-agrupar="fornecedor"]')
    dif = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(dif == [['FORNECEDOR SC TESTE SA (SC) 1 nota', '1', '1.000,00', '1.000,00', '', '40,00', '130,00']] and p.get_attribute('#agrupar [data-agrupar="fornecedor"]', 'aria-pressed') == 'true',
       f'por fornecedor: o subtotal de cada fornecedor, com as notas recolhidas ({dif})')
    p.click('.ds-emp[data-empresa="d1"] table.ds-dif tr.ds-g button')
    dif = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(len(dif) == 2 and dif[1][:2] == ['05/09/2026', '101'], f'abrir o fornecedor mostra as notas dele ({dif})')
    p.click('#agrupar [data-agrupar="data"]')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st == [['12/09/2026 1 nota', '2', '900,00', '500,00', '', '60,00', '47,20', '25,00']], f'por data: o subtotal do dia ({st})')
    ok(p.evaluate("() => localStorage.getItem('mr_destda_agrupar')") == 'data', 'o agrupar fica guardado neste navegador')
    p.click('#btnAbrirTudo')
    ok(aberta(p, 'd1') and aberta(p, 'd2') and len(linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')) == 4
       and len(linhas(p, '.ds-emp[data-empresa="d2"] table.ds-dif tbody tr')) == 4 and 'PADARIA NADA A RECOLHER LTDA' in p.inner_text('#curtas'),
       '"Expandir tudo": as empresas, os dias, as notas, os itens e as listas de baixo')
    p.click('#btnFecharTudo')
    ok(abertas(p) == 0 and 'PADARIA' not in p.inner_text('#curtas'), '"Recolher tudo": tudo fechado de novo')
    p.click('#agrupar [data-agrupar="nota"]')

    print(f'[{tema}] 3d. A data de entrada (26/11/2026, a nota de 30/09 que entrou em 01/10 da Thalia)')
    curtas = p.inner_text('#curtas')
    ok('Notas do fim de agosto sem a data de entrada (1)' in curtas and 'RACOES SC TESTE SA' not in curtas,
       'em "Todas", a lista das notas do fim de agosto sem a data de entrada, recolhida')
    p.click('#curtas h3[data-alterna="l:virada"] button')
    vir = linhas(p, '#curtas table.ds-vir tbody tr')
    ok(vir == [['AGROPECUÁRIA TESTE LTDA', '25/08/2026', '909', 'RACOES SC TESTE SA SC', '—', '10,00 1 item a conferir', 'Entrou em setembro']],
       f'aberta: a nota de SC de 25/08, com o que ela soma (sem DIFAL: o item a 4% está a conferir) ({vir})')
    ok(valores(p, 'd1') == ['DIFAL: R$ 130,00 1 nota', 'ICMS-ST a recolher: R$ 25,00 1 nota'], 'sem a data de entrada, ela não entra na conferência de setembro')
    p.click('#curtas table.ds-vir [data-entrada]')
    ok('is-open' in p.get_attribute('#ovEnt', 'class') and p.evaluate("() => document.activeElement.id") == 'eData', 'o botão abre a janela da data de entrada, com o cursor na data')
    ok(p.inner_text('#eNota') == 'Nota nº 909 de RACOES SC TESTE SA (SC), da AGROPECUÁRIA TESTE LTDA, emitida em 25/08/2026.'
       and p.input_value('#eData') == '2026-09-01' and p.inner_text('#eDica') == 'Conta na conferência de setembro de 2026.' and p.is_hidden('#eVoltar'),
       f'a nota, a data sugerida (o primeiro dia de setembro) e o mês em que ela conta ({p.inner_text("#eNota")!r}, {p.input_value("#eData")}, {p.inner_text("#eDica")!r})')
    p.keyboard.press('Escape')
    ok('is-open' not in p.get_attribute('#ovEnt', 'class') and p.evaluate("() => document.activeElement.dataset.entrada") == db(p, N909 + '.id'),
       'Esc fecha a janela, e o foco volta pro botão')
    p.click('#curtas table.ds-vir [data-entrada]')
    p.fill('#eData', '2026-08-20')
    p.click('#eSalvar')
    ok(p.inner_text('#eErro') == 'A entrada não pode ser antes da emissão (25/08/2026).' and campo(p, 'data_entrada') is None and p.inner_text('#eDica') == '',
       'antes da emissão não grava')
    p.fill('#eData', '2026-10-28')
    ok(p.inner_text('#eErro') == '', 'mudar a data tira o aviso')
    p.keyboard.press('Enter')
    ok(p.inner_text('#eErro') == 'A entrada não pode ser depois de hoje.' and campo(p, 'data_entrada') is None, 'depois de hoje também não (e o Enter grava)')
    p.fill('#eData', '2026-09-02')
    ok(p.inner_text('#eDica') == 'Conta na conferência de setembro de 2026.', 'a dica acompanha a data')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-entrada.png'))
    p.click('#eSalvar')
    esperar(p, "() => !document.querySelector('#curtas table.ds-vir') && document.querySelector('#lista .ds-emp')")
    nd = db(p, N909)
    ok(nd['data_entrada'] == '2026-09-02' and nd['entrada_origem'] == 'manual' and nd['entrada_por'] == 'financeiro@macedoereis.com.br' and nd['entrada_em'],
       f'grava a data, marcada à mão, com quem e quando ({nd.get("data_entrada")}, {nd.get("entrada_origem")}, {nd.get("entrada_por")})')
    ok('is-open' not in p.get_attribute('#ovEnt', 'class')
       and p.inner_text('#msgEnt') == 'A nota nº 909 de RACOES SC TESTE SA entrou em 02/09/2026: conta na conferência de setembro de 2026.'
       and p.evaluate("() => document.activeElement.id") == 'msgEnt',
       f'a janela fecha, com o aviso (e o foco nele) ({p.inner_text("#msgEnt")!r})')
    ok(valores(p, 'd1') == ['DIFAL: R$ 130,00 1 nota', 'ICMS-ST a recolher: R$ 35,00 2 notas 1 item a conferir'] and abas(p)['st'] == '1'
       and 'Notas do fim de agosto' not in p.inner_text('#curtas'),
       f'a nota entra na conferência de setembro: o ST dela soma (25,00 + 10,00), e ela sai da lista do fim de agosto ({valores(p, "d1")})')
    abrir_empresa(p, 'd1')
    st = [l for l in linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr') if l[1] == '909']
    ok(st == [['25/08/2026', '909', 'RACOES SC TESTE SA SC entrou em 02/09/2026 · marcada por Samuel em 27/10', '1', '200,00', '200,00', '', '24,00', '0,00', '10,00']],
       f'na linha da nota, quando ela entrou e quem marcou ({st})')
    abrir_nota(p, 'd1', 'ds-st', '909')
    ent = p.locator('.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent:not([hidden])')
    ok(ent.count() == 1 and texto(p, '.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent:not([hidden])') == 'Entrou em 02/09/2026 (marcada por Samuel em 27/10). Mudar a data de entrada',
       'aberta, embaixo dos itens, a data de entrada e o botão de mudar')
    ent2 = p.locator('.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent').all_inner_texts()
    ok(any('Sem a data de entrada: conta pela emissão.' in t and 'Entrou noutro mês' in t for t in ent2), 'a nota sem a data de entrada diz que conta pela emissão, com o botão')
    abrir_nota(p, 'd1', 'ds-st', '909')
    p.click('#btnFecharTudo')

    trocar_mes(p, '2026-08')
    ok(abas(p) == {'difal': '1', 'st': '0', 'nada': '0', 'importar': '3', 'todas': '4'}, f'em agosto, a nota de 25/08 sai do ICMS-ST ({abas(p)})')
    curtas = p.inner_text('#curtas')
    ok('Emitidas em agosto que entraram noutro mês (1)' in curtas and 'RACOES' not in curtas, 'embaixo, a lista das emitidas em agosto que entraram noutro mês, recolhida')
    p.click('#curtas h3[data-alterna="l:sairam"] button')
    sai = linhas(p, '#curtas table.ds-vir tbody tr')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-sairam.png'), full_page=True)
    ok(sai == [['AGROPECUÁRIA TESTE LTDA', '25/08/2026', '909', 'RACOES SC TESTE SA SC', '02/09/2026 marcada por Samuel em 27/10', '—', '10,00 1 item a conferir', 'Mudar a data de entrada']],
       f'aberta: a nota, com a entrada e quem marcou ({sai})')
    p.click('#curtas table.ds-vir [data-entrada]')
    ok(p.input_value('#eData') == '2026-09-02' and p.is_visible('#eVoltar'), 'a janela abre com a data marcada e o "Voltar à data de emissão"')
    p.click('#eVoltar')
    esperar(p, "() => !document.querySelector('#curtas table.ds-vir') && document.querySelector('#lista .ds-emp')")
    nd = db(p, N909)
    ok(nd['data_entrada'] is None and nd['entrada_origem'] is None and nd['entrada_por'] is None and nd['entrada_em'] is None
       and p.inner_text('#msgEnt') == 'A nota nº 909 de RACOES SC TESTE SA voltou pro mês da emissão: conta na conferência de agosto de 2026.'
       and abas(p)['st'] == '1',
       f'"Voltar à data de emissão" apaga a data, e a nota volta pra agosto ({p.inner_text("#msgEnt")!r}, {abas(p)})')
    # a Domínio manda a data com a janela aberta: a tela não grava por cima
    abrir_empresa(p, 'd1')
    abrir_nota(p, 'd1', 'ds-st', '909')
    p.click('.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent:not([hidden]) [data-entrada]')
    ok(p.input_value('#eData') == '2026-09-01' and p.inner_text('#eDica') == 'Conta na conferência de setembro de 2026.',
       f'da nota do mês, a sugestão é o primeiro dia do mês seguinte ({p.input_value("#eData")})')
    p.evaluate("(() => { Object.assign(" + N909 + ", { data_entrada: '2026-08-28', entrada_origem: 'dominio', entrada_por: 'ponte', entrada_em: '2026-10-27T10:00:00Z' }); })()")
    p.click('#eSalvar')
    esperar(p, "() => /mudou enquanto/.test(document.getElementById('msgEnt').textContent) && document.querySelector('#lista .ds-emp')")
    nd = db(p, N909)
    ok(nd['data_entrada'] == '2026-08-28' and nd['entrada_origem'] == 'dominio' and 'ds-err' in p.get_attribute('#msgEnt', 'class')
       and p.inner_text('#msgEnt') == 'A nota mudou enquanto a janela estava aberta: a Domínio já mandou a data de entrada dela. A conferência foi lida de novo.',
       'a data que a Domínio mandou com a janela aberta fica, com o aviso')
    ok(texto(p, '.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent:not([hidden])') == 'Entrou em 28/08/2026 (pela Domínio).'
       and p.locator('.ds-emp[data-empresa="d1"] table.ds-st tr.ds-ent:not([hidden]) [data-entrada]').count() == 0
       and p.evaluate("() => document.activeElement.id") == 'msgEnt',
       'a da Domínio aparece na nota, sem o botão de mudar (não se muda aqui)')
    p.evaluate("(() => { const d = " + N909 + "; ['data_entrada', 'entrada_origem', 'entrada_por', 'entrada_em'].forEach(k => delete d[k]); })()")
    p.click('#btnFecharTudo')
    trocar_mes(p, '2026-09')
    abrir_aba(p, 'todas')
    ok(cards(p) == ['d1', 'd2'] and abertas(p) == 0 and p.inner_text('#msgEnt') == '', 'de volta a setembro, sem o aviso')

    print(f'[{tema}] 3e. A empresa sem notas de entrada no mês (26/11/2026, pedido da Thalia)')
    # o banco grava quem e quando (o gatilho destda_sem_notas_quem); o teste guarda o que a tela mandou
    p.evaluate("""() => { window.__mockAntesDeInserir = (t, r) => { if (t !== 'destda_sem_notas') return;
      window.__veio = Object.keys(r).filter(k => k !== 'id').sort().join(',');
      r.marcado_por = 'fiscal@macedoereis.com.br'; r.marcado_em = '2026-10-27T15:00:00Z'; }; }""")
    ok(abas(p)['importar'] == '1' and abas(p)['nada'] == '1', f'antes: a sem notas em "Falta importar" e a padaria em "Sem nada a recolher" ({abas(p)})')
    abrir_aba(p, 'importar')
    BTN = '#lista [data-sem-notas="d3"]'
    imp = p.inner_text('#lista')
    ok(p.is_visible(BTN) and texto(p, BTN) == 'Não teve notas de entrada no mês' and 'marque em "Não teve notas de entrada no mês"' in imp,
       'em "Falta importar", o botão embaixo da empresa sem notas, com a explicação')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-marcar.png'), full_page=True)
    p.click(BTN)
    esperar(p, "() => /sem notas de entrada em 09\\/2026/.test(document.getElementById('msgEnt').textContent)")
    marcas = db(p, 'window.__mockDb.destda_sem_notas')
    ok(len(marcas) == 1 and marcas[0]['cliente_id'] == 'd3' and marcas[0]['competencia'] == '2026-09' and p.evaluate('() => window.__veio') == 'cliente_id,competencia',
       f'grava a marca: só a empresa e o mês (quem e quando, o banco) ({p.evaluate("() => window.__veio")})')
    ok(abas(p)['importar'] == '0' and abas(p)['nada'] == '2' and 'fc-warn' not in p.get_attribute('#abas [data-aba="importar"]', 'class'),
       f'sai de "Falta importar" e entra em "Sem nada a recolher" ({abas(p)})')
    ok(p.inner_text('#msgEnt') == 'MERCADO SEM NOTAS LTDA: sem notas de entrada em 09/2026. Foi pra "Sem nada a recolher", onde dá pra desmarcar.'
       and 'ds-ok' in p.get_attribute('#msgEnt', 'class') and p.evaluate("() => document.activeElement.id") == 'msgEnt',
       'o aviso diz o que mudou, com o foco nele')
    ok(p.inner_text('#lista').strip() == 'Nada falta importar de 09/2026: a empresa marcada sem notas de entrada no mês está em "Sem nada a recolher".',
       f'a aba fica vazia, dizendo onde a marcada está ({p.inner_text("#lista").strip()!r})')
    abrir_aba(p, 'nada')
    nada = p.inner_text('#lista')
    ok('Sem nada a recolher em 09/2026 (2)' in nada and 'MERCADO SEM NOTAS LTDA\nsem notas de entrada no mês · marcado por Thalia em 27/10\nDesmarcar' in nada
       and 'PADARIA NADA A RECOLHER LTDA' in nada and 'Têm notas de entrada do mês na base' in nada and 'As marcadas sem notas de entrada no mês ficam aqui' in nada,
       f'em "Sem nada a recolher", com quem marcou e o "Desmarcar" ({nada!r})')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-sem-notas.png'), full_page=True)
    abrir_aba(p, 'todas')
    p.click('#curtas h3[data-alterna="l:nada"] button')
    curtas = p.inner_text('#curtas')
    ok('Sem nada a recolher em 09/2026 (2)' in curtas and 'marcado por Thalia' in curtas and 'Sem notas de entrada importadas' not in curtas,
       'em "Todas", a lista de baixo também')
    p.click('#curtas h3[data-alterna="l:nada"] button')
    trocar_mes(p, '2026-08')
    ok(abas(p)['importar'] == '3', f'a marca é do mês: em agosto, a empresa segue faltando importar ({abas(p)})')
    trocar_mes(p, '2026-09')
    ok(abas(p)['importar'] == '0' and abas(p)['nada'] == '2', f'de volta a setembro, a marca segue (lida do banco) ({abas(p)})')
    # a nota de entrada que chega vale mais que a marca
    p.evaluate("""() => { window.__mockDb.nf_documentos.push({ id: 'ndM', cliente_id: 'd3', tipo: 'entrada', status: 'autorizada', emit_uf: 'RS',
      emit_doc: '91000000000100', emit_nome: 'FORNECEDOR RS TESTE', dest_doc: '40000000000100', data_emissao: '2026-09-15', numero: '777' }); }""")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    abrir_aba(p, 'nada')
    nada = p.inner_text('#lista')
    ok('MERCADO SEM NOTAS LTDA' in nada and 'marcado por' not in nada and 'Desmarcar' not in nada and 'Têm notas de entrada do mês na base' in nada,
       'com nota de entrada do mês na base, vale a nota: a marca nem aparece')
    p.evaluate("() => { const l = window.__mockDb.nf_documentos; l.splice(l.findIndex(d => d.id === 'ndM'), 1); }")
    # desmarcar
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    p.click('#lista [data-desmarcar="d3"]')
    esperar(p, "() => /a marca saiu/.test(document.getElementById('msgEnt').textContent)")
    ok(db(p, 'window.__mockDb.destda_sem_notas') == [] and abas(p)['importar'] == '1' and abas(p)['nada'] == '1'
       and p.inner_text('#msgEnt') == 'MERCADO SEM NOTAS LTDA: a marca saiu. Sem as notas de entrada de 09/2026, volta pra "Falta importar".',
       f'"Desmarcar" tira a marca, e ela volta pra "Falta importar" ({abas(p)})')
    # a marca que outra pessoa gravou no mesmo instante: vale a dela
    abrir_aba(p, 'importar')
    p.evaluate("() => { window.__mockDb.destda_sem_notas.push({ cliente_id: 'd3', competencia: '2026-09', marcado_por: 'diego@macedoereis.com.br', marcado_em: '2026-10-27T14:00:00Z' }); }")
    p.click(BTN)
    esperar(p, "() => /sem notas de entrada em 09\\/2026/.test(document.getElementById('msgEnt').textContent)")
    abrir_aba(p, 'nada')
    ok(len(db(p, 'window.__mockDb.destda_sem_notas')) == 1 and 'marcado por Diego em 27/10' in p.inner_text('#lista'), 'quem marcou antes fica: a marca não duplica')
    p.click('#lista [data-desmarcar="d3"]')
    esperar(p, "() => /a marca saiu/.test(document.getElementById('msgEnt').textContent)")
    # a marca que não se lê não para a conferência
    p.evaluate("() => { window.__mockErroTabela = { destda_sem_notas: 'permission denied for table destda_sem_notas' }; }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    abrir_aba(p, 'importar')
    imp = p.inner_text('#lista')
    ok(abas(p)['importar'] == '1' and 'MERCADO SEM NOTAS LTDA' in imp and p.locator('#lista [data-sem-notas]').count() == 0
       and 'recarregue a tela pra marcar' in imp and 'permission denied' not in imp,
       'sem ler as marcas, a conferência segue: quem não tem nota fica em "Falta importar", sem o botão, com o porquê')
    p.evaluate("() => { window.__mockErroTabela = null; window.__mockAntesDeInserir = null; }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    abrir_aba(p, 'todas')
    p.evaluate("() => { document.getElementById('msgEnt').textContent = ''; }")
    ok(cards(p) == ['d1', 'd2'] and abas(p)['importar'] == '1', 'de volta a setembro, como estava')

    print(f'[{tema}] 3f. A lista da Domínio (26/11/2026, o "vai" do Samuel: as notas de fora do RS que faltam)')
    # o que a ponte guardou da Domínio (nf_entradas_dominio): da d1, a 202 (na base), duas que não estão aqui (uma do
    # fornecedor com <img onerror>, de MG, e uma do de SC) e uma que a Domínio não lista mais; a 808, de agosto, que a
    # Domínio pôs em setembro (está na base, sem a data); a 909, do fim de agosto, que ela pôs em agosto; da d3 (sem notas
    # na base), uma do PR; e da padaria (nada a recolher nas dela), uma NF-e avulsa de SP
    VISTO = '2026-10-27T10:05:00Z'
    def ld(cliente, chave, entrada, **o):
        return {'cliente_id': cliente, 'chave': chave, 'entrada': entrada, 'visto_em': VISTO, 'saiu_em': None, **o}
    LISTA = [ld('d1', chave_de(202, 'SP', '82000000000100', '2026-09-12'), '2026-09-12'),
             ld('d1', chave_de(111, 'MG', '84000000000100', '2026-09-03'), '2026-09-04'),
             ld('d1', chave_de(112, 'SC', '81000000000100', '2026-09-10'), '2026-09-11'),
             ld('d1', chave_de(113, 'SC', '81000000000100', '2026-09-10'), '2026-09-11', saiu_em='2026-10-27T10:05:00Z'),
             ld('d1', chave_de(808, 'GO', '88000000000100', '2026-08-20'), '2026-09-01'),
             ld('d1', chave_de(909, 'SC', '89000000000100', '2026-08-25'), '2026-08-28'),
             ld('d3', chave_de(301, 'PR', '93000000000100', '2026-09-20'), '2026-09-21'),
             ld('d5', chave_de(501, 'SP', '95000000000100', '2026-09-05', serie='890'), '2026-09-06')]
    p.evaluate("l => { window.__mockDb.nf_entradas_dominio = l; }", LISTA)
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    ok(abas(p) == {'difal': '2', 'st': '1', 'nada': '0', 'importar': '3', 'todas': '4'},
       f'os números: a padaria sai de "Sem nada a recolher" e, com a d1 e a d3, vai pra "Falta importar" ({abas(p)})')
    dom = p.inner_text('#dominio')
    ok(dom == 'Pela lista da Domínio (lida em 27/10, às 07h05), faltam 4 das 6 notas de fora do RS de 09/2026, de 3 empresas: veja em "Falta importar".'
       and 'ds-warn' in p.get_attribute('#dominio', 'class'), f'embaixo das abas, a lista da Domínio: de quando é, e quantas faltam ({dom!r})')
    ok(valores(p, 'd1') == ['DIFAL: R$ 221,00 2 notas', 'ICMS-ST a recolher: R$ 25,00 1 nota']
       and '2 notas de fora do RS que a Domínio tem não estão aqui' in p.inner_text('.ds-emp[data-empresa="d1"] > .ds-emp-linha'),
       f'a 808, que a Domínio pôs em setembro, já soma no DIFAL (130,00 + 91,00); a linha da d1 diz quantas faltam ({valores(p, "d1")})')
    ok('Notas do fim de agosto sem a data de entrada' not in p.inner_text('#curtas'), 'a 909, que a Domínio pôs em agosto, sai da lista do fim de agosto')
    curtas = p.inner_text('#curtas')
    ok('Notas de fora do RS que a Domínio tem e não estão aqui (4, de 3 empresas)' in curtas and 'Sem nada a recolher' not in curtas
       and 'Sem notas de entrada importadas de 09/2026 (1)' in curtas, 'em "Todas", a lista das que faltam, recolhida, em cima das outras')
    abrir_empresa(p, 'd1')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok('A Domínio tem 2 notas de fora do RS desta empresa em 09/2026 que não estão aqui: o DIFAL e o ICMS-ST do mês ficam sem elas.' in c1,
       'aberta, a d1 diz as que faltam, em cima')
    fal = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-faltam tbody tr')
    ok(fal == [['04/09/2026', '111 série 1', PERIGO_FORNECEDOR + ' 84.000.000/0001-00 · MG', '09/2026', chave_de(111, 'MG', '84000000000100', '2026-09-03')],
               ['11/09/2026', '112 série 1', 'FORNECEDOR SC TESTE SA 81.000.000/0001-00 · SC', '09/2026', chave_de(112, 'SC', '81000000000100', '2026-09-10')]],
       f'cada uma pela data de entrada da Domínio, o número, quem emitiu (o nome pelas notas dele aqui, como texto), a emissão e a chave; a que saiu da lista, não ({fal})')
    d808 = [l for l in linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr') if l[1] == '808']
    ok(d808 == [['20/08/2026', '808', 'GOIAS TESTE SA GO entrou em 01/09/2026 · pela lista da Domínio', '1', '700,00', '700,00', '', '28,00', '91,00']],
       f'no diferencial, a 808 com a entrada pela lista da Domínio ({d808})')
    abrir_nota(p, 'd1', 'ds-dif', '808')
    ok(texto(p, '.ds-emp[data-empresa="d1"] table.ds-dif tr.ds-ent:not([hidden])') == 'Entrou em 01/09/2026, pela lista da Domínio: a ponte grava a data na próxima leitura.'
       and p.locator('.ds-emp[data-empresa="d1"] table.ds-dif tr.ds-ent:not([hidden]) [data-entrada]').count() == 0,
       'aberta, a data é a da lista, sem o botão de mudar (a ponte grava a da Domínio)')
    ok(campo_de(p, '808', 'data_entrada') is None, 'e nada foi gravado na nota: a data da lista é só da tela')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-faltam-empresa.png'), full_page=True)
    p.click('.ds-emp[data-empresa="d1"] .ds-falta [data-copiar-chaves="d1"]')
    esperar(p, "() => /chaves de acesso foram copiadas/.test(document.getElementById('msgEnt').textContent)")
    copiado = p.evaluate('() => navigator.clipboard.readText()')
    ok(copiado == chave_de(111, 'MG', '84000000000100', '2026-09-03') + '\n' + chave_de(112, 'SC', '81000000000100', '2026-09-10')
       and p.inner_text('#msgEnt') == 'AGROPECUÁRIA TESTE LTDA: as 2 chaves de acesso foram copiadas, uma por linha.'
       and texto(p, '.ds-emp[data-empresa="d1"] .ds-falta [data-copiar-chaves="d1"]') == '✓ Copiadas',
       f'"Copiar as chaves" copia as chaves da empresa, uma por linha ({copiado!r})')
    p.click('#btnFecharTudo')
    abrir_aba(p, 'importar')
    imp = p.inner_text('#lista')
    ok(imp.startswith('Notas de fora do RS que a Domínio tem e não estão aqui (4, de 3 empresas)')
       and 'AGROPECUÁRIA TESTE LTDA (AGRO TESTE) 2 notas' in imp and 'MERCADO SEM NOTAS LTDA 1 nota' in imp and 'PADARIA NADA A RECOLHER LTDA 1 nota' in imp,
       f'"Falta importar": as que faltam, por empresa, em cima ({imp[:300]!r})')
    pad = linhas(p, '#lista .ds-falta:has([data-copiar-chaves="d5"]) table.ds-faltam tbody tr')
    ok(pad == [['06/09/2026', '501 série 890', '95.000.000/0001-00 (do Fisco: NF-e avulsa) SP', '09/2026', chave_de(501, 'SP', '95000000000100', '2026-09-05', serie='890')]],
       f'a NF-e avulsa diz que o CNPJ da chave é o do Fisco ({pad})')
    ok(p.locator('#lista [data-sem-notas="d3"]').count() == 0 and 'MERCADO SEM NOTAS LTDA\na Domínio tem 1 nota de fora do RS dela neste mês' in imp,
       'a d3, sem notas na base, não tem o "Não teve notas de entrada no mês": a Domínio diz que teve')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-faltam.png'), full_page=True)
    # a marca "sem notas" que alguém pôs não vale quando a Domínio tem nota no mês
    p.evaluate("() => { window.__mockDb.destda_sem_notas.push({ cliente_id: 'd3', competencia: '2026-09', marcado_por: 'fiscal@macedoereis.com.br', marcado_em: '2026-10-27T14:00:00Z' }); }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    imp = p.inner_text('#lista')
    ok(abas(p)['importar'] == '3' and abas(p)['nada'] == '0'
       and 'MERCADO SEM NOTAS LTDA\nmarcada sem notas de entrada no mês por Thalia em 27/10, mas a Domínio tem 1 nota de fora do RS dela neste mês\nDesmarcar' in imp,
       f'a marcada sem notas segue em "Falta importar", com o "Desmarcar" ({abas(p)})')
    p.click('#lista [data-desmarcar="d3"]')
    esperar(p, "() => /a marca saiu/.test(document.getElementById('msgEnt').textContent)")
    ok(db(p, 'window.__mockDb.destda_sem_notas') == [], '"Desmarcar" tira a marca')
    # a lista que não se lê não para a conferência
    p.evaluate("() => { window.__mockErroTabela = { nf_entradas_dominio: 'permission denied for table nf_entradas_dominio' }; }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    ok(abas(p) == {'difal': '2', 'st': '1', 'nada': '1', 'importar': '1', 'todas': '4'}
       and p.inner_text('#dominio') == 'Não consegui ler agora a lista das notas que a Domínio tem: a conferência segue sem ela.'
       and 'permission denied' not in p.inner_text('body'),
       f'sem ler a lista, a conferência segue como era, com o aviso ({abas(p)})')
    p.evaluate("() => { window.__mockErroTabela = null; }")
    # com todas as da lista aqui: conferida
    p.evaluate("""() => { window.__mockDb.nf_entradas_dominio = window.__mockDb.nf_entradas_dominio.filter(l => ['d1'].includes(l.cliente_id)
      && /^(35|52)/.test(l.chave)); }""")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    dom = p.inner_text('#dominio')
    ok(dom == 'Conferida com a lista da Domínio (lida em 27/10, às 07h05): as 2 notas de fora do RS de 09/2026 que ela tem estão todas aqui.'
       and 'ds-ok' in p.get_attribute('#dominio', 'class') and abas(p)['importar'] == '1', f'com todas as da lista aqui, a linha diz que está conferida ({dom!r})')
    p.evaluate("() => { window.__mockDb.nf_entradas_dominio = []; document.getElementById('msgEnt').textContent = ''; }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    abrir_aba(p, 'todas')
    ok(p.inner_text('#dominio') == '' and cards(p) == ['d1', 'd2'] and abas(p) == {'difal': '2', 'st': '1', 'nada': '1', 'importar': '1', 'todas': '4'}
       and valores(p, 'd1') == ['DIFAL: R$ 130,00 1 nota', 'ICMS-ST a recolher: R$ 25,00 1 nota'], 'sem a lista, a tela como era (e a linha some)')

    print(f'[{tema}] 4. Trocar o mês (na aba "Com DIFAL")')
    abrir_aba(p, 'difal')
    trocar_mes(p, '2026-08')
    abrir_empresa(p, 'd1')
    ago = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-dif tbody tr')
    ok(aba_ativa(p) == ['difal'] and cards(p) == ['d1'] and ago == [['20/08/2026', '808', 'GOIAS TESTE SA GO', '1', '700,00', '700,00', '', '28,00', '91,00']],
       f'agosto, na mesma aba: só a nota de GO a 4%, com o DIFAL (13% de 700) ({ago})')
    ok(abas(p) == {'difal': '1', 'st': '1', 'nada': '0', 'importar': '3', 'todas': '4'}, f'os números de agosto ({abas(p)})')
    ok(valores(p, 'd1') == ['DIFAL: R$ 91,00 1 nota 1 item a 4% a conferir']
       and 'Diferencial de alíquota — ICMS a 4% de fora do RS · 1 nota, 1 item · DIFAL R$ 91,00' in p.inner_text('.ds-emp[data-empresa="d1"]')
       and '1 item a 4% ficou fora do DIFAL: é de outro NCM da mesma posição de uma regra de ICMS-ST, e o nome não diz se entra no ST. Veja na aba Com ICMS-ST.'
           in p.inner_text('.ds-emp[data-empresa="d1"]'),
       f'a ração a 4% que o nome não decide fica fora do DIFAL também, com o aviso na linha e no detalhe ({valores(p, "d1")})')

    print(f'[{tema}] 4b. A ração pet de outro NCM, pelo nome (as notas da Thalia, 28/10/2026)')
    abrir_aba(p, 'st')
    ok(cards(p) == ['d1'] and valores(p, 'd1') == ['ICMS-ST a recolher: R$ 10,00 1 nota 1 item a conferir'] and aberta(p, 'd1'),
       f'"Com ICMS-ST": a d1, com o ST da ração que entrou pelo nome e o item a conferir ({valores(p, "d1")})')
    c1 = p.inner_text('.ds-emp[data-empresa="d1"]')
    ok('ICMS-ST na entrada — Ração pet (alimento para cães e gatos) · 1 nota, 1 item · ST a recolher R$ 10,00 · 1 item a conferir' in c1, 'o título do ICMS-ST, com o a conferir')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st == [['25/08/2026', '909', 'RACOES SC TESTE SA SC', '1', '200,00', '200,00', '', '24,00', '0,00', '10,00']],
       f'a nota: só a ração de gato na conta (17% de 200 − 24 = 10,00) ({st})')
    abrir_nota(p, 'd1', 'ds-st', '909')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(st[1:] == [['', '', 'RACAO GRAN NATURE GATOS CASTRADOS 10KG NCM 2309.90.10 · CFOP 6102 entrou pelo nome: GATO', '', '200,00', '200,00', '12%', '24,00', 'sem retenção', '']],
       f'o item diz a palavra que o pôs no ST ({st[1:]})')
    conf = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-conf tbody tr')
    ok(conf == [['25/08/2026', '909', 'RACOES SC TESTE SA SC', 'RACAO MARCA NOVA 15KG NCM 2309.90.10 · CEST 22.001.00', '100,00', '100,00', '4%', '4,00']]
       and '1 item a conferir: é de outro NCM da mesma posição da regra, e o nome não diz se entra. Fica fora da conta' in c1,
       f'a marca que nenhuma lista conhece: a conferir, com o CEST, fora da conta ({conf})')
    ok('Ficou fora pelo nome: TERNERON 25KG (nota 909, por "TERNERON").' in c1 and 'TERNERON' not in p.text_content('.ds-emp[data-empresa="d1"] table.ds-st'),
       'o TERNERON fica fora pelo nome')
    p.click('.ds-emp[data-empresa="d1"] [data-abrir-regras]')
    p.wait_for_function("() => document.activeElement && document.activeElement.dataset.campo === 'nomes_entram'", timeout=3000)
    ok(p.evaluate("() => document.getElementById('secRegras').open && document.activeElement.closest('.ds-regra').dataset.id") == 'rg1'
       and p.input_value('.ds-regra[data-id="rg1"] [data-campo="nomes_entram"]') == 'CÃO, CÃES, GATO, FILHOTE, GRAN NATURE, G. N.'
       and p.input_value('.ds-regra[data-id="rg1"] [data-campo="nomes_fora"]') == 'CAVALO, EQUINO, BEZERRO, TERNERON, AVES',
       '"Abrir as regras" abre as regras com o cursor nos nomes que entram da regra')
    p.keyboard.type(', marca nova')
    salvar_regra(p, 'rg1')
    p.wait_for_function("() => /Salva/.test(document.querySelector('.ds-regra[data-id=\"rg1\"] .ds-regra-msg').textContent)", timeout=3000)
    ok(db(p, "window.__mockDb.destda_regras_st.find(r => r.id === 'rg1').nomes_entram") == ['CÃO', 'CÃES', 'GATO', 'FILHOTE', 'GRAN NATURE', 'G. N.', 'MARCA NOVA']
       and msg_regra(p, 'rg1') == 'Salva — a conferência já usa.', 'a marca entra na lista da regra, em maiúsculas como os nomes das notas')
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr')
    ok(valores(p, 'd1') == ['ICMS-ST a recolher: R$ 23,00 1 nota'] and p.locator('.ds-emp[data-empresa="d1"] table.ds-conf').count() == 0
       and st[0] == ['25/08/2026', '909', 'RACOES SC TESTE SA SC', '2', '300,00', '300,00', '', '28,00', '0,00', '23,00']
       and st[2][2] == 'RACAO MARCA NOVA 15KG NCM 2309.90.10 · CFOP 6102 entrou pelo nome: MARCA NOVA',
       f'na hora, a ração da marca nova entra no ST (17% de 300 − 28 = 23,00) e sai do a conferir ({st})')
    ok(p.input_value('.ds-regra[data-id="rg1"] [data-campo="nomes_entram"]') == 'CÃO, CÃES, GATO, FILHOTE, GRAN NATURE, G. N., MARCA NOVA', 'a lista volta em maiúsculas na tela')
    p.fill('.ds-regra[data-id="rg1"] [data-campo="nomes_entram"]', 'CÃO, CÃES, GATO, FILHOTE, GRAN NATURE, G. N., MARCA NOVA, Aves')
    salvar_regra(p, 'rg1')
    p.wait_for_function("() => /Salva/.test(document.querySelector('.ds-regra[data-id=\"rg1\"] .ds-regra-msg').textContent)", timeout=3000)
    ok(msg_regra(p, 'rg1') == 'Salva — a conferência já usa. AVES está nas duas listas: vale a de entrar.', f'a palavra nas duas listas avisa ({msg_regra(p, "rg1")!r})')
    p.click('#secRegras > summary')
    abrir_aba(p, 'difal')
    ok(valores(p, 'd1') == ['DIFAL: R$ 91,00 1 nota'] and '4% ficou fora do DIFAL' not in p.inner_text('.ds-emp[data-empresa="d1"]'),
       'no DIFAL, o aviso some: o item agora é do ST')
    trocar_mes(p, '2026-09')
    ok(aba_ativa(p) == ['difal'] and cards(p) == ['d1', 'd2'], 'de volta a setembro')
    abrir_aba(p, 'todas')
    ok(cards(p) == ['d1', 'd2'] and aberta(p, 'd1') and p.locator('.ds-emp[data-empresa="d1"] table.ds-st').count() == 1,
       '"Todas": a tela inteira de novo, com a d1 aberta como ficou')

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
    st = linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tbody tr.ds-n')
    ok(len(st) == 2 and st[1][:3] == ['15/09/2026', '303', 'PET PR TESTE SA PR'] and st[1][3:] == ['1', '250,00', '250,00', '', '30,00', '0,00', '12,50']
       and linhas(p, '.ds-emp[data-empresa="d1"] table.ds-st tfoot tr')[0][-1] == '37,50' and aberta(p, 'd1'),
       f'a nota do PR entra na conferência na hora, com o ST dela (17% de 250 − 30 = 12,50) no total, e a empresa segue aberta ({st})')
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
       and abas(p)['st'] == '0' and p.inner_text('#regrasResumo').strip() == 'Nenhuma regra ativa.',
       'a regra desligada tira o ICMS-ST da conferência')

    print(f'[{tema}] 6. Texto de fora')
    ok(p.evaluate('() => window.__pego') is None, 'nenhum <img onerror> rodou')

    print(f'[{tema}] 7. O card no Fiscal')
    p.goto(base + 'fiscal.html')
    p.wait_for_function("() => document.querySelector('.card-status[data-mod=\"fiscal-destda.html\"]').textContent !== '·'", timeout=8000)
    selo = p.text_content('.card-status[data-mod="fiscal-destda.html"]')   # o selo é em maiúsculas só no CSS
    ok(selo == '4 empresas', f'"4 empresas" ({selo})')
    cx.close()

# 8. as do Simples todas (27/11/2026): num contexto à parte, com a carteira, o cadastro e o mês na Domínio
SIMPLES = {
    'clientes': [
        {'id': 'd7', 'nome_principal': 'SALÃO DO SIMPLES LTDA', 'nome_fantasia': None, 'documento': '80000000000100', 'status': 'ativo',
         'regime_tributario': 'Simples Nacional', 'tipo_pessoa': 'PJ'},
        {'id': 'd8', 'nome_principal': 'FÁBRICA DO SIMPLES LTDA', 'nome_fantasia': None, 'documento': '90000000000100', 'status': 'ativo',
         'regime_tributario': 'Simples Nacional', 'tipo_pessoa': 'PJ'},
        {'id': 'd9', 'nome_principal': 'SAIU DO SIMPLES LTDA', 'nome_fantasia': None, 'documento': '91000000000100', 'status': 'ativo',
         'regime_tributario': 'Simples Nacional', 'tipo_pessoa': 'PJ'},
        {'id': 'd10', 'nome_principal': 'MEI DE TESTE', 'nome_fantasia': None, 'documento': '92000000000100', 'status': 'ativo',
         'regime_tributario': 'MEI', 'tipo_pessoa': 'PJ'}],
    'carteira': [{'cliente_id': c, 'entrada': '2025-01-01', 'saida': s} for c, s in (('d7', None), ('d8', None), ('d9', '2026-09-30'), ('d10', None))],
    'dominio_empresas': [{'codigo': 977, 'cliente_id': 'd7'}, {'codigo': 978, 'cliente_id': 'd8'}, {'codigo': 973, 'cliente_id': 'd3'}],
    'dominio_mensal': [
        {'codigo': 977, 'competencia': '2026-09', 'notas_entrada': 2, 'notas_saida': 15, 'compras': 0, 'ativo_e_consumo': 0, 'outras_entradas': 0, 'devolucoes_de_venda': 0},
        {'codigo': 973, 'competencia': '2026-09', 'notas_entrada': 9, 'notas_saida': 30, 'compras': 1500, 'ativo_e_consumo': 0, 'outras_entradas': 0, 'devolucoes_de_venda': 0},
        {'codigo': 978, 'competencia': '2026-09', 'notas_entrada': 1, 'notas_saida': 4, 'compras': 1000, 'ativo_e_consumo': 0, 'outras_entradas': 0, 'devolucoes_de_venda': 0}],
    'docs': [{'id': 'nd8', 'cliente_id': 'd8', 'importacao_id': None, 'chave': '35260985000000000100550010000008011000008010', 'modelo': '55', 'numero': '801',
              'data_emissao': '2026-09-10', 'tipo': 'entrada', 'status': 'autorizada', 'emit_doc': '85000000000100', 'emit_nome': 'FORNECEDOR SP TESTE SA',
              'emit_uf': 'SP', 'dest_doc': '90000000000100', 'tp_nf': 1, 'data_entrada': None, 'entrada_origem': None}],
    'itens': [{'id': 'ni8', 'documento_id': 'nd8', 'n_item': 1, 'ncm': '85163100', 'descricao': 'SECADOR', 'cfop': '6102', 'valor_total': 1000,
               'icms_valor': 40, 'icms_st_valor': 0, 'icms_base': 1000, 'icms_aliquota': 4, 'icms_st_base': None}],
}
SEMEAR_SIMPLES = """
(() => {
  const X = %s;
  const d = Object.getOwnPropertyDescriptor(window, '__mockDb');
  Object.defineProperty(window, '__mockDb', { configurable: true, get: d.get, set(v) {
    d.set(v);
    v.clientes = v.clientes.concat(X.clientes);
    v.carteira_info = (v.carteira_info || []).concat(X.carteira);
    v.dominio_empresas = (v.dominio_empresas || []).concat(X.dominio_empresas);
    v.dominio_mensal = (v.dominio_mensal || []).concat(X.dominio_mensal);
    v.nf_documentos = v.nf_documentos.concat(X.docs);
    v.nf_itens = v.nf_itens.concat(X.itens);
  } });
})();
""" % json.dumps(SIMPLES, ensure_ascii=False)

def simples(b, base, tema, erros):
    cx = b.new_context(viewport={'width': 1400, 'height': 900})
    p = cx.new_page()
    p.on('pageerror', lambda e: erros.append(f'{tema} (8): {e}'))
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}');")
    p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(SEMEAR_SIMPLES)
    p.clock.set_fixed_time('2026-10-27T12:00:00')
    p.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())

    print(f'[{tema}] 8. As do Simples todas (27/11/2026, pedido da Thalia: "todas do simples")')
    p.goto(base + 'fiscal-destda.html')
    esperar_mes(p, '09/2026')
    ok(abas(p) == {'difal': '1', 'st': '0', 'nada': '1', 'importar': '4', 'todas': '6'},
       f'as 4 da obrigação e as 2 do Simples da carteira (a que saiu e o MEI, não) ({abas(p)})')
    ok(cards(p) == ['d1', 'd8'] and valores(p, 'd8') == ['DIFAL: R$ 130,00 1 nota', 'ICMS-ST a recolher: —'],
       f'a do Simples sem o vínculo, com o DIFAL da nota dela ({cards(p)}, {valores(p, "d8")})')
    ok('do Simples, sem a obrigação SEDIF/DeSTDA em Obrigações fiscais: sem a tarefa do mês' in p.inner_text('.ds-emp[data-empresa="d8"] > .ds-emp-linha')
       and 'sem a tarefa do mês' not in p.inner_text('.ds-emp[data-empresa="d1"] > .ds-emp-linha'),
       'a linha da do Simples diz que ela não tem a obrigação (a da obrigação, não)')
    abrir_aba(p, 'nada')
    nada = p.inner_text('#lista')
    ok('SALÃO DO SIMPLES LTDA\nsem compra de mercadoria no mês, pela Domínio' in nada and p.locator('#lista [data-desmarcar="d7"]').count() == 0
       and 'As sem compra de mercadoria no mês, pela Domínio' in nada,
       f'a sem nota de entrada que a Domínio diz que não comprou mercadoria: "Sem nada a recolher", sozinha, sem botão ({nada[:200]!r})')
    abrir_aba(p, 'importar')
    imp = p.inner_text('#lista')
    ok(p.locator('#lista [data-sem-notas="d3"]').count() == 1 and 'SALÃO DO SIMPLES' not in imp and 'SAIU DO SIMPLES' not in imp and 'MEI DE TESTE' not in imp,
       'a que a Domínio diz que comprou segue em "Falta importar", com o "Não teve"; a sem compra, a que saiu e o MEI, não')
    p.screenshot(path=str(FOTOS / f'{tema}-destda-simples.png'), full_page=True)
    p.evaluate("() => { window.__mockErroTabela = { dominio_mensal: 'permission denied for table dominio_mensal' }; }")
    trocar_mes(p, '2026-08'); trocar_mes(p, '2026-09')
    ok(abas(p) == {'difal': '1', 'st': '0', 'nada': '0', 'importar': '5', 'todas': '6'} and 'permission denied' not in p.inner_text('body'),
       f'sem ler o mês na Domínio, a conferência segue como era: a sem compra volta pra "Falta importar" ({abas(p)})')
    p.evaluate("() => { window.__mockErroTabela = null; }")

    p.goto(base + 'fiscal.html')
    p.wait_for_function("() => document.querySelector('.card-status[data-mod=\"fiscal-destda.html\"]').textContent !== '·'", timeout=8000)
    selo = p.text_content('.card-status[data-mod="fiscal-destda.html"]')
    ok(selo == '6 empresas', f'o card no Fiscal conta as do Simples também ({selo})')
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
            simples(b, base, tema, erros)
        b.close()
    srv.shutdown()
    for e in erros:
        print('  ✗ erro de JavaScript: ' + e)
    total = falhas + len(erros)
    print(f'\n{total} FALHA(S)' if total else '\nTudo certo.')
    sys.exit(1 if total else 0)

if __name__ == '__main__':
    main()
