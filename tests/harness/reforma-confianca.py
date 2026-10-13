"""Teste da confiança dos números na ficha da Reforma (fiscal-reforma.html, 13/10/2026): de onde veio cada número, o nível
de confiança e o "sem conclusão" quando um número fraco muda o resultado — na tela, na lista, na análise técnica, no
relatório do cliente e no comunicado.
Sem login e sem banco: mesmo mock do conferir.py. Clientes e casos (inventados) entram no banco falso por uma armadilha em
window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.
(A conta da confiança em si está em tests/rt-confianca.test.mjs; a medição das compras e do % de PJ por período, em
tests/dominio-relatorios.test.mjs.)

    python tests/harness/reforma-confianca.py

Confere:
  1. a ficha abre a simulação gravada com a origem de cada campo de volta (a etiqueta embaixo do campo);
  2. numa indústria recém-chegada — compras não medidas e % de PJ deduzido pelo perfil —, "Calcular" mostra SEM CONCLUSÃO,
     o número que decide, a partir de quanto o resultado vira e o que falta, sem nenhum dos lados como o recomendado;
  3. gravando: a procedência e a confiança vão com a simulação, o fundamento não recebe a frase da conta provisória e a
     lista mostra "Simulado: sem conclusão", com o filtro;
  4. a análise técnica e o relatório do cliente saem como "SEM CONCLUSÃO — FALTAM DADOS", com a seção 7 (fonte, período,
     confiança e por quê) e o pedido dos dados;
  5. o comunicado de decisão gravada sobre simulação sem conclusão pede confirmação antes de abrir;
  6. digitando as compras e o % de PJ, a origem vira "informado na ficha" (confiança média) e a conclusão volta — o 0
     digitado também (consultoria que não compra nada): deixa de ser "não medido";
  7. simulação gravada antes de 13/10/2026 (sem a procedência): a origem é deduzida do resumo do Domínio e aparece como
     "simulação anterior"; o número que o resumo não explica (% de PJ, mix 100% cheio) sai "origem não registrada";
  8. importação de ponta a ponta com períodos diferentes (planilhas do Domínio: faturamento de set/25 a ago/26, entradas e
     saídas só de set/26): a prévia mostra as entradas de setembro e as compras ÷ a receita do mesmo mês (não zero, nem
     ÷ 12 meses); aplicado, cada campo diz de onde veio e em que mês, a confiança sai "baixa" (1 mês) e a gravação leva a
     procedência com os meses;
  9. o resumo da importação fica preso à ficha em que foi aplicado: gravar outro cliente depois não leva junto os
     relatórios do primeiro;
  10. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

M12 = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
CLIENTES = [
    {'id': 'cf1', 'nome_principal': 'INDÚSTRIA NOVA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000701', 'cnae_principal': '3299-0/99', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'cf2', 'nome_principal': 'ATACADO ANTIGO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000702', 'cnae_principal': '4649-4/99', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 'cf3', 'nome_principal': 'METALÚRGICA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000703', 'cnae_principal': '2599-3/99', 'cidade': 'Parobé', 'status': 'ativo'},
]
# indústria do Anexo II, ~R$ 108,5 mil por mês; compras não medidas (0%) e 90% de PJ deduzido pelo perfil
ENT = {'anexo': 'II', 'rbt12': 1300600, 'aliqEfetivaInformada': None, 'receita': 108504, 'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0,
       'pctComprasComCredito': None, 'pctComprasMercadorias': 0, 'pctComprasDespesas': 0, 'pctDespesasComCredito': None, 'pctImpostoEmbutido': 0, 'pctExcluidoST': 0,
       'pctReceitaMonofasica': 0, 'partilha': 14, 'cbs': 9.2, 'ibs': 0.1, 'pctPJ': 90, 'creditoEstoqueMes': 0}
DEDUZIDO = 'deduzido: indústria vende essencialmente a empresas — confirme importando as saídas em XLS (trazem o CNPJ do cliente)'
PROC = {'receita': {'fonte': 'faturamento', 'meses': M12, 'texto': 'do Domínio: faturamento Domínio: R$ 1.302.048,00 ÷ 12 mês(es) (09/25 a 08/26)'},
        'rbt12': {'fonte': 'pgdas', 'meses': ['2026-09'], 'texto': 'do Domínio: PGDAS 2026-09'}, 'anexo': {'fonte': 'pgdas', 'meses': ['2026-09']},
        'aliqEfetiva': {'fonte': 'vazio'}, 'partilha': {'fonte': 'tabela'}, 'pctMerc': {'fonte': 'vazio'}, 'pctDesp': {'fonte': 'vazio'},
        'pctPJ': {'fonte': 'deduzido', 'perfil': 'industria', 'texto': DEDUZIDO}, 'mix': {'fonte': 'padrao', 'texto': 'sem mix informado: assumido 100% à alíquota cheia'}}
DOM = {'faturamento': {'total': 1302048, 'servicos': 0, 'saidas': 1302048}, 'periodoRotulo': 'set/25–ago/26', 'meses': [{'competencia': c, 'total': 108504} for c in M12],
       'pgdas': {'competencia': '2026-09', 'dasTotal': 9100, 'cbsNoDas': 1274, 'aliquotaEfetiva': 8.39}, 'pctPJDeduzido': DEDUZIDO}
# simulação gravada antes de 13/10/2026: sem a procedência, com o resumo do Domínio (entradas sem o período)
ENT2 = {**ENT, 'anexo': 'I', 'rbt12': 2400000, 'receita': 200000, 'pctComprasMercadorias': 75, 'pctComprasDespesas': 3, 'pctPJ': 60, 'partilha': 15.5}
DOM2 = {'faturamento': {'total': 2400000, 'servicos': 0, 'saidas': 2400000}, 'periodoRotulo': 'set/25–ago/26', 'meses': [{'competencia': c, 'total': 200000} for c in M12],
        'pgdas': {'competencia': '2026-08', 'dasTotal': 21000, 'cbsNoDas': 3255, 'aliquotaEfetiva': 10.5}, 'entradas': {'grupos': [{'grupo': 'mercadoria', 'rotulo': 'Mercadorias', 'notas': 300, 'valor': 1800000, 'credita': True, 'incluido': True}]}}
def caso(n, cli, sim_obs, dentro, fora):
    return {'id': 'cfk' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': None, 'segmento': 'industria',
            'sinal_b2b': 2, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 3, 'triagem': 'simular',
            'perfil_validado': False, 'decisao': 'pendente', 'status': 'simulado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
            'sim_custo_dentro': dentro, 'sim_custo_fora': fora, 'fundamento': None, 'sim_obs': json.dumps(sim_obs, ensure_ascii=False), 'obs': None}
CASOS = [caso(1, 'cf1', {'v': 1, 'input': ENT, 'veredito': 'MANTENHA', 'frase': 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 58.397,04 dentro do Simples…',
                         'calculado_em': '2026-10-13', 'procedencia': PROC, 'dominio': DOM}, 58397.04, 108071.37),
         caso(2, 'cf2', {'v': 1, 'input': ENT2, 'veredito': 'OPTE', 'frase': 'A simulação do primeiro semestre de 2027 indica…', 'calculado_em': '2026-10-01', 'dominio': DOM2}, 120000, 90000),
         {**caso(3, 'cf3', {}, None, None), 'sim_obs': None, 'status': 'triado'}]

# planilhas do Domínio (inventadas), em CSV com ";": o leitor da página é o mesmo do XLS (lerPlanilha); o SheetJS do CDN é
# trocado por um leitor de CSV de dez linhas (abaixo), pra o teste não depender da rede
CNPJ3 = '10.000.000/0007-03'
MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
def csv(linhas): return ('\n'.join(';'.join(str(c) for c in l) for l in linhas) + '\n').encode('utf-8')
FAT_CSV = csv([['RELATÓRIO DE FATURAMENTO'], ['Empresa:', 'METALÚRGICA DE TESTE LTDA'], ['CNPJ:', CNPJ3], ['Período:', '01/09/2025 até 31/08/2026'],
               ['Mês', 'Ano', 'Saídas', 'Serviços', 'Outros', 'Total']]
              + [[MESES_NOME[int(c[5:]) - 1], c[:4], '108.504,00', '0,00', '0,00', '108.504,00'] for c in M12]
              + [['Totais', '', '1.302.048,00', '0,00', '0,00', '1.302.048,00']])
CAB_ENT = ['Código', 'Data Emissão', 'Data Entrada', 'Nota', 'Série', 'Espécie', 'Código', 'Fornecedor', 'CNPJ/CPF/CEI/CAEPF', 'Insc. Est.', 'CFOP', 'AC.', 'UF', 'Valor Contábil', 'Tipo']
ENT_CSV = csv([['703 - METALÚRGICA DE TESTE LTDA'], ['CNPJ:', CNPJ3], ['Período:', '01/09/2026 até 30/09/2026'], ['', '', '', '', 'ACOMPANHAMENTO DE ENTRADAS'], CAB_ENT]
              + [[str(i), '05/09/2026', '05/09/2026', str(100 + i), '1', '55', '9', 'FORNECEDOR %02d LTDA' % i, '2%013d' % i, '', '1-101', '67', 'RS', '4.000,00', 'ICMS'] for i in range(11)]
              + [[str(20 + i), '08/09/2026', '08/09/2026', str(200 + i), '1', '57', '9', 'TRANSPORTADORA %02d LTDA' % i, '4%013d' % i, '', '1-353', '56', 'RS', '440,00', 'ICMS'] for i in range(5)]
              + [['Total Geral', '', '', '', '', '', '', '', '', '', '', '', '', '46.200,00']])
CAB_SAI = ['Código', 'Data Emissão', 'Data', 'Nota', 'Série', 'Espécie', 'Código', 'Cliente', 'CNPJ/CPF/CEI/CAEPF', 'Insc. Est.', 'CFOP', 'AC.', 'UF', 'Valor Contábil']
SAI_CSV = csv([['703 - METALÚRGICA DE TESTE LTDA'], ['CNPJ:', CNPJ3], ['Período:', '01/09/2026 até 30/09/2026'], ['', '', '', '', 'ACOMPANHAMENTO DE SAÍDAS'], CAB_SAI]
              + [[str(i), '10/09/2026', '10/09/2026', str(300 + i), '1', '55', '9', 'CLIENTE %02d LTDA' % i, '3%013d' % i, '', '5-101', '35', 'RS', '8.500,00'] for i in range(11)]
              + [[str(40 + i), '12/09/2026', '12/09/2026', str(400 + i), '1', '55', '9', 'PESSOA %02d' % i, '5%010d' % i, '', '5-101', '35', 'RS', v] for i, v in enumerate(['5.000,00', '5.000,00', '6.500,00'])]
              + [['Total Geral', '', '', '', '', '', '', '', '', '', '', '', '', '110.000,00']])
LEITOR_CSV = """window.XLSX = { read(buf) { const t = new TextDecoder('utf-8').decode(new Uint8Array(buf));
  return { SheetNames: ['Planilha1'], Sheets: { Planilha1: t.split(/\\r?\\n/).filter(l => l).map(l => l.split(';')) } }; },
  utils: { sheet_to_json(ws) { return ws; } } };"""
# regime dos fornecedores e clientes (consultar-cnpjs): todos do regime regular
REGIMES = """window.__mockInvoke = async (nome, opts) => nome === 'consultar-cnpjs'
  ? { data: { resultados: ((opts.body || {}).cnpjs || []).map(c => ({ cnpj: c, simples: false, mei: false, razao: 'EMPRESA ' + c })) }, error: null }
  : { data: null, error: { message: 'fora do teste' } };"""
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
  const CLIENTES = %s, CASOS = %s, PARAMS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

def etiqueta(p, campo):
    return p.evaluate("id => { const s = document.getElementById(id).nextElementSibling; return s && s.classList.contains('xml-origem') ? s.textContent : ''; }", campo)

def chip(p, nome):
    return p.evaluate("n => { const tr = [...document.querySelectorAll('#rtLista tr')].find(t => t.textContent.includes(n)); const c = tr && tr.querySelector('.rt-chip'); return c ? { t: c.textContent.trim(), titulo: c.title } : null; }", nome)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        ctx = b.new_context(viewport={'width': 1500, 'height': 1000})
        p = ctx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.add_init_script(REGIMES)
        p.route('**/cdnjs.cloudflare.com/ajax/libs/xlsx/**', lambda r: r.fulfill(body=LEITOR_CSV, content_type='application/javascript'))
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1500)

        # 1) a origem de cada campo volta com a simulação gravada
        p.click('#rtLista tr:has-text("INDÚSTRIA NOVA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok('faturamento Domínio' in etiqueta(p, 'sReceita') and '12 mês(es)' in etiqueta(p, 'sReceita'), f'a receita volta com a origem ({etiqueta(p, "sReceita")[:60]}…)')
        ok(etiqueta(p, 'sPctPJ').startswith('deduzido: indústria vende essencialmente a empresas'), 'o % de PJ volta marcado como deduzido pelo perfil')
        ok(etiqueta(p, 'sPctMerc').startswith('não medido: sem relatório'), 'as compras zeradas e sem origem aparecem como não medidas')

        # 2) compras não medidas e PJ deduzido: sem conclusão
        p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok(v.startswith('SEM CONCLUSÃO — os dados de hoje não sustentam uma decisão.'), f'o veredito não conclui ({v[:70]}…)')
        ok('Compras com crédito (% da receita)' in v and 'não medido' in v and 'vira a partir de 8,' in v, 'diz o número que decide (compras, não medido) e a partir de quanto o resultado vira')
        ok('Para concluir, falta: o acompanhamento de entradas' in v, 'diz o que falta')
        ok('Conta provisória, só pra referência (não é recomendação)' in v, 'a conta de hoje aparece como provisória')
        ok('semconc' in (p.get_attribute('#bVeredito', 'class') or '') and not p.query_selector_all('#bRetratos .rt-ret.win, #bRetratos .rt-ret.ambar'), 'nenhum dos dois lados aparece como o recomendado')
        ok('Confiança dos dados: receita alta' in v, 'a linha de confiança dos dados aparece')

        # 3) gravando: procedência e confiança vão junto; o fundamento fica vazio
        p.click('#bGravar'); p.wait_for_timeout(600)
        ok('sem conclusão' in p.inner_text('#bMsg'), f'a mensagem de gravado avisa ({p.inner_text("#bMsg")[:60]}…)')
        k1 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'cfk1')")
        obs = json.loads(k1.get('sim_obs') or '{}')
        ok(obs.get('confianca', {}).get('conclusao') == 'sem_conclusao' and 'Compras com crédito (% da receita)' in obs['confianca'].get('decisivos', []), 'a confiança vai gravada com a simulação')
        ok(obs.get('procedencia', {}).get('pctMerc', {}).get('fonte') == 'vazio' and obs['procedencia'].get('pctPJ', {}).get('fonte') == 'deduzido'
           and obs['procedencia'].get('receita', {}).get('meses') == M12, 'e a procedência de cada campo também')
        ok(p.input_value('#cFund') == '', 'o fundamento não recebe a frase da conta provisória')

        # 4) análise técnica e relatório do cliente
        with p.expect_popup() as pop:
            p.click('#dAnalise')
        an = pop.value; an.wait_for_load_state(); an.wait_for_timeout(300)
        t = br(an.inner_text('body'))
        ok('SEM CONCLUSÃO — FALTAM DADOS' in t and 'Sem recomendação por enquanto — faltam dados que decidem o resultado' in t, 'análise: sem conclusão, sem recomendação')
        # (o cabeçalho da tabela sai em maiúsculas pelo CSS: compara sem caixa)
        ok('7. De onde vem cada número — e quanto dá pra confiar' in t and 'por que não é verdade absoluta' in t.lower() and 'set/25–ago/26, 12 meses' in t, 'análise: a seção 7 com fonte, período, confiança e por quê')
        ok('Deduzido pelo tipo de atividade' in t and 'deduzido' in t, 'análise: o % de PJ aparece como deduzido')
        an.close()
        with p.expect_popup() as pop:
            p.click('#dCliente')
        cl = pop.value; cl.wait_for_load_state(); cl.wait_for_timeout(300)
        t = br(cl.inner_text('body'))
        ok('SEM CONCLUSÃO — FALTAM DADOS' in t and 'Ainda não dá pra recomendar um dos lados' in t, 'relatório do cliente: sem conclusão')
        ok('Pra concluir a análise, precisamos de' in t and 'Com que segurança:' in t, 'relatório do cliente: o pedido dos dados e a segurança de cada número')
        cl.close()

        # 5) comunicado de decisão sobre simulação sem conclusão: pede confirmação
        p.check('input[name="cDec"][value="por_dentro"]'); p.wait_for_timeout(100)
        p.click('#cGravar'); p.wait_for_timeout(500)
        msgs = []
        def recusa(d):
            msgs.append(d.message); d.dismiss()
        p.once('dialog', recusa)
        antes = len(ctx.pages)
        p.click('#dGerar'); p.wait_for_timeout(500)
        ok(msgs and 'SEM CONCLUSÃO' in msgs[0] and 'Compras com crédito' in msgs[0], 'gerar o comunicado pede confirmação e diz por quê')
        ok(len(ctx.pages) == antes, 'recusando, o comunicado não abre')

        # lista: o chip e o filtro
        p.click('#fiFechar'); p.wait_for_timeout(400)
        c1 = chip(p, 'INDÚSTRIA NOVA DE TESTE LTDA') or {}
        ok(c1.get('t') == 'Simulado: sem conclusão' and 'Sem conclusão: Compras com crédito' in c1.get('titulo', ''), f'a lista mostra "Simulado: sem conclusão" ({c1.get("t")})')
        p.select_option('#rtFtri', 'sim_sem_conclusao'); p.wait_for_timeout(200)
        nomes = p.eval_on_selector_all('#rtLista tr td:nth-child(2) b', 'els => els.map(e => e.textContent.trim())')
        ok(nomes == ['INDÚSTRIA NOVA DE TESTE LTDA'], f'o filtro "Simulado: sem conclusão" ({nomes})')
        p.select_option('#rtFtri', ''); p.wait_for_timeout(200)

        # 6) digitando compras e % de PJ: "digitado na ficha", confiança média — a conclusão volta
        p.click('#rtLista tr:has-text("INDÚSTRIA NOVA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(etiqueta(p, 'sPctPJ').startswith('deduzido'), 'reaberta, a ficha traz de volta a origem gravada')
        for campo, valor in [('#sPctMerc', '40'), ('#sPctDesp', '2'), ('#sPctPJ', '85')]:
            p.fill(campo, valor)
        ok(etiqueta(p, 'sPctPJ') == '', 'editado à mão, o campo perde a etiqueta de origem')
        p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok(not v.startswith('SEM CONCLUSÃO') and 'compras com crédito média' in v and 'vendas a clientes que aproveitam o crédito média' in v,
           f'com os números digitados, confiança média e a conclusão volta ({v[:60]}…)')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 6b) o 0 digitado é informação, não "não medido" (consultoria que não compra nada informa 0% de compras)
        p.click('#rtLista tr:has-text("INDÚSTRIA NOVA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(etiqueta(p, 'sPctMerc').startswith('não medido'), 'antes: compras zeradas e sem origem, "não medido"')
        for campo in ('#sPctMerc', '#sPctDesp'):
            p.fill(campo, '0')
        ok(etiqueta(p, 'sPctMerc') == '', 'digitando 0, a etiqueta "não medido" sai')
        p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok('compras com crédito média' in v and 'compras com crédito não medido' not in v, f'e as compras passam a "informado" (confiança média), não "não medido"')
        pr0 = p.evaluate("() => { const r = {}; ['sPctMerc', 'sPctDesp'].forEach(id => { r[id] = document.getElementById(id).value; }); return r; }")
        ok(pr0 == {'sPctMerc': '0', 'sPctDesp': '0'}, f'os campos ficam com o 0 digitado ({pr0})')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 7) simulação antiga, sem a procedência: deduzida do resumo do Domínio
        p.click('#rtLista tr:has-text("ATACADO ANTIGO DE TESTE LTDA")'); p.wait_for_timeout(500)
        e = etiqueta(p, 'sPctMerc')
        ok(e.startswith('simulação anterior — do Domínio: entradas (período não registrado)'), f'simulação antiga: a origem das compras é deduzida e marcada ({e})')
        ok(etiqueta(p, 'sReceita').startswith('simulação anterior — do Domínio: faturamento de set/25–ago/26'), 'e a da receita, com o período do faturamento')
        # o % de PJ (sem saídas nem dedução no resumo) e o mix 100% cheio: não dá pra saber de onde vieram — a ficha diz isso
        ok(etiqueta(p, 'sPctPJ') == 'simulação anterior — origem não registrada', f'o % de PJ sem origem no resumo: "origem não registrada" ({etiqueta(p, "sPctPJ")})')
        ok(etiqueta(p, 'sMixCheia') == 'simulação anterior — 100% à alíquota cheia, origem não registrada', f'o mix 100% cheio: pode ter vindo das notas ou ser o padrão ({etiqueta(p, "sMixCheia")})')
        p.click('#bCalcular'); p.wait_for_timeout(400)
        v = br(p.inner_text('#bVeredito'))
        ok('compras com crédito média' in v, 'na simulação antiga, as compras saem com confiança média (período não registrado)')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 8) importação de ponta a ponta: faturamento até ago/26, entradas e saídas só de set/26
        p.click('#rtLista tr:has-text("METALÚRGICA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'II')
        for campo, valor in [('#sRbt12', '1.302.048,00'), ('#sPartilha', '14')]:
            p.fill(campo, valor)
        p.click('#bImportarDom'); p.wait_for_selector('#ovDom.on', timeout=5000)
        p.set_input_files('#domFile', files=[{'name': 'faturamento.csv', 'mimeType': 'text/csv', 'buffer': FAT_CSV},
                                             {'name': 'entradas.csv', 'mimeType': 'text/csv', 'buffer': ENT_CSV},
                                             {'name': 'saidas.csv', 'mimeType': 'text/csv', 'buffer': SAI_CSV}])
        p.wait_for_function("() => /% compras de mercadorias/.test(document.getElementById('domPrevia').textContent) && !document.getElementById('domAplicar').disabled", timeout=8000)
        p.wait_for_timeout(300)
        lidos = br(p.inner_text('#domLidos'))
        ok('faturamento · 12 mês(es)' in lidos and 'entradas · 16 lançamento(s)' in lidos and 'saídas · 14 nota(s) · CNPJ do cliente' in lidos, f'os três relatórios lidos ({lidos})')
        prev = br(p.inner_text('#domPrevia'))
        ok('Mercadorias' in prev and 'R$ 44.000,00' in prev, 'a prévia mostra as entradas de setembro (antes saía vazia: o mês não estava no faturamento)')
        ok('entradas Domínio de set/26 (1 mês): R$ 44.000,00 ÷ R$ 110.000,00 de receita no mesmo período (saídas)' in prev, 'compras de set/26 ÷ receita de set/26 (das saídas), não zero nem ÷ 12 meses')
        ok('Compras medidas em set/26 (1 mês), contra 12 meses do faturamento' in prev and 'O % de vendas para PJ foi medido nas saídas de set/26 (1 mês)' in prev, 'a prévia avisa que compras e % de PJ são de um mês só')
        p.click('#domAplicar'); p.wait_for_selector('#bSaida:not([hidden])', timeout=8000); p.wait_for_timeout(400)
        ok(p.input_value('#sPctMerc') == '40' and p.input_value('#sPctDesp') == '2' and p.input_value('#sPctPJ') == '85', f'campos: 40% de mercadorias, 2% de despesas, 85% de PJ ({p.input_value("#sPctMerc")}, {p.input_value("#sPctDesp")}, {p.input_value("#sPctPJ")})')
        ok(etiqueta(p, 'sPctMerc').startswith('do Domínio: entradas Domínio de set/26 (1 mês)'), 'a etiqueta das compras diz o mês e de onde veio a receita')
        v = br(p.inner_text('#bVeredito'))
        ok('compras com crédito baixa (set/26, 1 mês)' in v and 'vendas a clientes que aproveitam o crédito baixa (set/26, 1 mês)' in v and 'receita alta (set/25–ago/26, 12 meses)' in v,
           'a confiança dos dados: compras e PJ baixa (1 mês), receita alta (12 meses)')
        p.click('#bGravar'); p.wait_for_timeout(600)
        k3 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'cfk3')")
        o3 = json.loads(k3.get('sim_obs') or '{}')
        pr = o3.get('procedencia', {})
        ok(pr.get('pctMerc', {}).get('meses') == ['2026-09'] and pr['pctMerc'].get('receitaDe') == ['saídas'] and pr['pctMerc'].get('mesesFaturamento') == 12,
           'gravada: as compras com o mês (set/26), a fonte da receita e os 12 meses do faturamento')
        ok(pr.get('pctPJ', {}).get('fonte') == 'saidas' and pr['pctPJ'].get('regimeConsultado') is True and pr.get('receita', {}).get('meses') == M12, 'o % de PJ das saídas (regime consultado) e a receita dos 12 meses')
        ok(o3.get('dominio', {}).get('periodoEntradas') == 'set/26' and o3['dominio'].get('periodoVendas') == 'set/26', 'o resumo do Domínio leva o período das entradas e das saídas')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 9) o resumo da importação é da METALÚRGICA: gravar a INDÚSTRIA NOVA agora não leva os relatórios dela
        p.click('#rtLista tr:has-text("INDÚSTRIA NOVA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.click('#bGravar'); p.wait_for_timeout(600)
        o1 = json.loads(p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'cfk1')").get('sim_obs') or '{}')
        ok(not o1.get('dominio', {}).get('vendas') and not o1['dominio'].get('periodoEntradas') and o1['dominio'].get('pctPJDeduzido') == DEDUZIDO,
           'outra ficha gravada depois da importação continua com o próprio resumo do Domínio')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        ctx.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
