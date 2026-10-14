"""Teste da mudança da Reforma vinda da Imersão da Reforma Tributária (14/10/2026) na ficha (fiscal-reforma.html): o imposto
embutido nas compras. O fornecedor do regime normal destaca o IBS/CBS sobre o valor sem o ICMS (LC 214, art. 12, §2º, V); o
ICMS-ST e o IPI vêm por cima do produto — nada disso entra no crédito de quem compra. Com o campo em 0, a conta credita sobre o
valor cheio da nota e pende para o "por fora".
Sem login e sem banco: mesmo mock do conferir.py. Clientes, casos e notas (inventados) entram no banco falso por uma armadilha
em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.
(A conta da confiança está em tests/rt-confianca.test.mjs; a medida nas notas, em tests/operacao-xml.test.mjs; a análise, em
tests/rt-analise.test.mjs.)

    python tests/harness/reforma-imersao.py

Confere:
  1. a dica do campo "% imposto embutido nas compras": ICMS, ICMS-ST e IPI das notas de compra, sem PIS/COFINS, o ISS do
     serviço tomado; o título traz a LC 214, art. 12, §2º, V, e o que a confiança faz com o campo em branco;
  2. puxar das notas mede o imposto embutido nas notas de compra de fornecedor do regime normal (sem o fornecedor do Simples):
     o campo vem preenchido, com a etiqueta de onde veio; a confiança da ficha marca o número como medido; gravando, a
     procedência vai junto (notas, os meses, quantas notas e a cobertura) e volta ao abrir a ficha; com um % digitado antes,
     as notas o trocam e avisam;
  3. sem as notas de compra, com compras na ficha: "Calcular" marca o campo como não medido e, num varejo que só dá "optar
     por fora" com o crédito sobre o valor cheio das notas, mostra SEM CONCLUSÃO, com o número que decide e a partir de quanto
     vira; zerando as compras, a etiqueta sai; digitando o %, a etiqueta sai e a conclusão volta;
  4. notas de compra que cobrem pouco das compras com nota (o resto é serviço tomado, com o ISS, que as notas importadas não
     trazem): a etiqueta diz a cobertura e a confiança fica baixa; com um % digitado, ele fica e o aviso diz o que as notas
     mediram;
  5. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CLIENTES = [
    {'id': 'imc1', 'nome_principal': 'MOVEIS COM NOTAS DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000801', 'cnae_principal': '4754-7/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'imc2', 'nome_principal': 'MOVEIS SEM NOTAS DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000802', 'cnae_principal': '4754-7/01', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 'imc3', 'nome_principal': 'MOVEIS COM SERVICOS DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000803', 'cnae_principal': '4754-7/01', 'cidade': 'Parobé', 'status': 'ativo'},
]
def caso(n, cli):
    return {'id': 'imk' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '4754', 'segmento': 'comercio',
            'sinal_b2b': 0, 'sinal_entradas': 2, 'sinal_reducao': 0, 'sinal_aliquota': 1, 'score': 3, 'triagem': 'simular',
            'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
            'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'fundamento': None, 'obs': 'Triagem automática por CNAE (teste).'}
CASOS = [caso(1, 'imc1'), caso(2, 'imc2'), caso(3, 'imc3')]
# notas inventadas (o repositório é público): vendas a consumidor em jun, jul e ago; compras de fornecedor do regime normal
# (CRT 3) nos três meses e uma de fornecedor do Simples (CRT 1), que fica fora da medida
def doc(id_, data, tipo, valor, crt=1, extra=None, cli='imc1'):
    d = {'id': id_, 'cliente_id': cli, 'status': 'autorizada', 'modelo': '55', 'data_emissao': data, 'tipo': tipo, 'finalidade': 1,
         'emit_doc': '10000000000801' if tipo == 'saida' else '44444444000144', 'emit_nome': 'TESTE', 'emit_uf': 'RS', 'emit_crt': crt,
         'dest_doc': 'P' + id_ if tipo == 'saida' else '10000000000801', 'dest_tipo': 'PF' if tipo == 'saida' else 'PJ', 'dest_nome': 'CONSUMIDOR ' + id_,
         'dest_uf': 'RS', 'valor_total': valor, 'cfop_principal': '5102', 'icms': 0, 'icms_st': 0, 'ipi': 0}
    d.update(extra or {})
    return d
NOTAS = [doc('v1', '2026-06-10', 'saida', 30000), doc('v2', '2026-07-10', 'saida', 30000), doc('v3', '2026-08-10', 'saida', 30000),
         doc('c1', '2026-06-05', 'entrada', 10000, 3, {'icms': 1530, 'ipi': 1000}),
         doc('c2', '2026-07-05', 'entrada', 5000, 3, {'icms': 600, 'icms_st': 400}),
         doc('c3', '2026-08-05', 'entrada', 6000, 3, {'icms': 1020}),
         doc('c4', '2026-07-06', 'entrada', 3000, 1)]
# loja que compra quase tudo em serviço (NFS-e tomada): a nota de mercadoria do regime normal é só 10% das compras com nota
NOTAS += [doc('w1', '2026-06-10', 'saida', 40000, cli='imc3'), doc('w2', '2026-07-10', 'saida', 40000, cli='imc3'), doc('w3', '2026-08-10', 'saida', 40000, cli='imc3'),
          doc('x1', '2026-06-05', 'entrada', 3000, 3, {'icms': 540}, cli='imc3')] \
       + [{**doc('t' + str(i), '2026-0' + str(5 + i) + '-08', 'entrada', 9000, 3, cli='imc3'), 'modelo': 'nfse', 'cfop_principal': None} for i in (1, 2, 3)]
def item(d):
    return {'documento_id': d['id'], 'ncm': None if d['modelo'] == 'nfse' else '94036000', 'descricao': ('SERVICO ' if d['modelo'] == 'nfse' else 'MOVEL ') + d['id'],
            'cfop': None if d['modelo'] == 'nfse' else '5102', 'unidade': 'UN', 'quantidade': 1, 'valor_total': d['valor_total'],
            'nf_documentos.cliente_id': d['cliente_id'], 'nf_documentos.status': 'autorizada', 'nf_documentos.data_emissao': d['data_emissao']}
ITENS = [item(d) for d in NOTAS]
def faixas(pcts):
    lims = [180000, 360000, 720000, 1800000, 3600000, 4800000]
    return [{'ate': l, 'cbs': p, 'ibs': 0, 'pct': p} for l, p in zip(lims, pcts)]
PARAMS = [
    {'chave': 'aliq_ref_2027', 'valor': {'cbs': 9.3, 'ibs': 0.1, 'cbs_aplicada': 9.2}},
    {'chave': 'partilha_cbs_ibs', 'valor': {'anexos': {
        'I': faixas([15.5, 15.5, 15.5, 15.5, 15.5, 34.02]), 'II': faixas([14, 14, 14, 14, 14, 25.22]), 'III': faixas([15.6, 17.1, 16.6, 16.6, 15.6, 19.29]),
        'IV': faixas([21.5, 25, 24, 23, 22, 24.7]), 'V': faixas([17.15, 17.15, 18.15, 19.15, 17.15, 19.78])}}},
]
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, PARAMS = %s, NOTAS = %s, ITENS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
    v.nf_documentos = NOTAS; v.nf_itens = ITENS; v.rt_ncm_regras = [];
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS, NOTAS, ITENS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

def etiqueta(p, campo):
    return br(p.evaluate("id => { const s = document.getElementById(id).nextElementSibling; return s && s.classList.contains('xml-origem') ? s.textContent : ''; }", campo))

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        p = b.new_page(viewport={'width': 1500, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1500)

        # 1) a dica e o título do campo
        p.click('#rtLista tr:has-text("MOVEIS COM NOTAS DE TESTE LTDA")'); p.wait_for_timeout(500)
        dica = br(p.inner_text('label:has(#sPctEmb) .hint:not(.xml-origem)'))
        tit = br(p.get_attribute('label:has(#sPctEmb)', 'title') or '')
        ok(dica == 'ICMS, ICMS-ST e IPI das notas de compra, em % do valor delas — o crédito é sobre o valor sem eles; sem PIS/COFINS; serviço tomado: o ISS',
           f'dica do campo: ICMS, ICMS-ST e IPI em % do valor das notas, sem PIS/COFINS, ISS no serviço tomado ({dica[:50]}…)')
        ok('LC 214, art. 12, §2º, II e V' in tit and 'fica fora pela regra de cálculo da NF-e (a confirmar na orientação normativa)' in tit and 'Não ponha PIS e COFINS: acabam em 2027' in tit
           and '“Puxar das notas” mede nas notas de entrada (XML)' in tit and 'o IPI, zerado em 2027 (salvo Zona Franca), sai do valor da nota' in tit
           and 'a confiança testa o imposto que costuma vir no preço' in tit, 'título do campo: a lei (II e V; o ICMS-ST a confirmar), o IPI de 2027, sem PIS/COFINS, o "Puxar das notas" e o campo em branco')
        ok(p.get_attribute('#sPctEmb', 'placeholder') == 'vazio = não medido (ex.: 12 ou 18)', 'o campo vazio diz que vazio é "não medido"')

        # 2) puxar das notas: mede nas notas de compra de fornecedor do regime normal
        p.select_option('#sAnexo', 'I'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '360.000,00'), ('#sPctST', '0'), ('#sPctMono', '0'), ('#sEstoque', '0'), ('#sPartilha', '15,5'), ('#sPctEmb', '10')]:
            p.fill(campo, valor)
        p.click('#bImportarDom')
        p.wait_for_selector('#ovDom.on', timeout=5000)
        p.wait_for_function("() => /nota\\(s\\) autorizada/.test(document.getElementById('domNotas').textContent)", timeout=5000)
        p.click('#domAplicar')
        p.wait_for_selector('#bXmlInfo:not([hidden])', timeout=5000); p.wait_for_timeout(400)
        # (1.530 + 1.000 + 600 + 400 + 1.020) ÷ 21.000 = 21,7% — a compra do fornecedor do Simples (R$ 3.000) fica fora
        ok(p.input_value('#sPctEmb') == '21,7', f'o campo vem das notas de compra: 21,7% ({p.input_value("#sPctEmb")})')
        ok(etiqueta(p, 'sPctEmb') == 'das notas de compra: ICMS, ICMS-ST e IPI ÷ valor de 3 notas de fornecedor do regime normal', f'com a etiqueta de onde veio ({etiqueta(p, "sPctEmb")})')
        avisos = [br(x) for x in p.eval_on_selector_all('#bXmlInfo [data-aviso-notas]', 'els => els.map(e => e.textContent)')]
        ok(any('O % de imposto embutido digitado na ficha (10%) foi trocado pelo medido nas notas de compra (21,7%).' in a for a in avisos), f'o 10% digitado antes foi trocado, com aviso ({avisos})')
        ok(p.input_value('#sPctMerc') == '26,7', f'(as compras continuam com a do Simples: 24.000 ÷ 90.000 = 26,7% — {p.input_value("#sPctMerc")})')
        p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok('imposto embutido nas compras alta (jun/26–ago/26, 3 meses)' in v, f'a confiança da ficha marca o imposto embutido como medido ({v[v.find("Confiança dos dados"):][:200]}…)')
        p.click('#bGravar'); p.wait_for_timeout(600)
        k1 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'imk1')")
        obs = json.loads(k1.get('sim_obs') or '{}')
        pe = obs.get('procedencia', {}).get('pctEmb', {})
        ok(pe.get('fonte') == 'notas' and pe.get('meses') == ['2026-06', '2026-07', '2026-08'] and pe.get('notas') == 3 and pe.get('cobertura') == 100 and obs.get('input', {}).get('pctImpostoEmbutido') == 21.7,
           f'gravando, a procedência vai junto: notas, os 3 meses, quantas notas e a cobertura ({pe})')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        p.click('#rtLista tr:has-text("MOVEIS COM NOTAS DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(p.input_value('#sPctEmb') == '21,7' and etiqueta(p, 'sPctEmb').startswith('das notas de compra: ICMS, ICMS-ST e IPI'), 'ao abrir de novo, o campo volta com a origem')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 3) sem as notas de compra: não medido — o varejo só dá "optar por fora" com o crédito sobre o valor cheio das notas
        p.click('#rtLista tr:has-text("MOVEIS SEM NOTAS DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'I'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sReceita', '100.000,00'), ('#sPctPJ', '2'), ('#sPctMerc', '90'), ('#sPctDesp', '2'),
                             ('#sPctST', '0'), ('#sPctMono', '0'), ('#sEstoque', '0'), ('#sPartilha', '15,5'), ('#sMixCheia', '100')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(400)
        ok(etiqueta(p, 'sPctEmb').startswith('não medido: sem as notas de compra (XML), a conta considera 0%'), f'o campo em branco com compras: "não medido" ({etiqueta(p, "sPctEmb")[:70]}…)')
        v = br(p.inner_text('#bVeredito'))
        ok(v.startswith('SEM CONCLUSÃO — os dados de hoje não sustentam uma decisão.') and 'Com os números como estão, a conta daria “optar por fora”' in v,
           f'sem as notas de compra, o varejo que dá "optar por fora" fica sem conclusão ({v[:90]}…)')
        ok('Imposto embutido nas compras' in v and 'vira a partir de 7,' in v and 'as notas de compra (XML de entrada) dos fornecedores do regime normal' in v,
           'diz o número que decide, a partir de quanto vira (~7%) e o que falta')
        p.fill('#sPctMerc', '0'); p.fill('#sPctDesp', '0'); p.click('#bCalcular'); p.wait_for_timeout(400)
        ok(etiqueta(p, 'sPctEmb') == '' and 'imposto embutido' not in br(p.inner_text('#bVeredito')), 'zerando as compras com a etiqueta na tela: o campo não pesa — a etiqueta sai e o número sai da confiança')
        p.fill('#sPctMerc', '90'); p.fill('#sPctDesp', '2'); p.click('#bCalcular'); p.wait_for_timeout(400)
        ok(etiqueta(p, 'sPctEmb').startswith('não medido: sem as notas de compra (XML)'), 'com compras de novo, a etiqueta de não medido volta')
        p.fill('#sPctEmb', '15'); p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok(etiqueta(p, 'sPctEmb') == '' and not v.startswith('SEM CONCLUSÃO') and 'imposto embutido nas compras média' in v,
           'digitando 15%, a etiqueta sai, o número fica "informado" (média) e a conclusão volta')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 4) notas que cobrem pouco das compras com nota: a etiqueta diz a cobertura, a confiança fica baixa; o digitado fica
        p.click('#rtLista tr:has-text("MOVEIS COM SERVICOS DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'I'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '480.000,00'), ('#sPctST', '0'), ('#sPctMono', '0'), ('#sEstoque', '0'), ('#sPartilha', '15,5')]:
            p.fill(campo, valor)
        p.click('#bImportarDom')
        p.wait_for_selector('#ovDom.on', timeout=5000)
        p.wait_for_function("() => /nota\\(s\\) autorizada/.test(document.getElementById('domNotas').textContent)", timeout=5000)
        p.click('#domAplicar')
        p.wait_for_selector('#bXmlInfo:not([hidden])', timeout=5000); p.wait_for_timeout(400)
        ok(p.input_value('#sPctEmb') == '18' and etiqueta(p, 'sPctEmb') == 'das notas de compra: ICMS, ICMS-ST e IPI ÷ valor de 1 nota de fornecedor do regime normal — 10% das compras com nota (o resto é serviço tomado, sem o ISS nas notas)',
           f'a etiqueta diz a cobertura: 1 nota, 10% das compras com nota ({p.input_value("#sPctEmb")} · {etiqueta(p, "sPctEmb")})')
        p.click('#bCalcular'); p.wait_for_timeout(400)
        ok('imposto embutido nas compras baixa' in br(p.inner_text('#bVeredito')), 'cobertura de 10%: a confiança do número fica baixa')
        p.fill('#sPctEmb', '6')
        p.click('#bImportarDom')
        p.wait_for_selector('#ovDom.on', timeout=5000)
        p.wait_for_function("() => /nota\\(s\\) autorizada/.test(document.getElementById('domNotas').textContent)", timeout=5000)
        p.click('#domAplicar')
        p.wait_for_selector('#bXmlInfo:not([hidden])', timeout=5000); p.wait_for_timeout(400)
        avisos = [br(x) for x in p.eval_on_selector_all('#bXmlInfo [data-aviso-notas]', 'els => els.map(e => e.textContent)')]
        ok(p.input_value('#sPctEmb') == '6' and etiqueta(p, 'sPctEmb') == '' and any('O % de imposto embutido digitado na ficha (6%) ficou: as notas de compra de fornecedor do regime normal mediram 18%, mas são só 10% das compras com nota' in a for a in avisos),
           f'com 6% digitado, o digitado fica e o aviso diz o que as notas mediram ({p.input_value("#sPctEmb")} · {avisos})')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
