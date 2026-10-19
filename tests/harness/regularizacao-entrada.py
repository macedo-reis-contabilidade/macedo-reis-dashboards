"""
Regularizações: a entrada de cada débito (19/10/2026) — sem login e sem banco (o mock do conferir.py, com dois casos
semeados por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/regularizacao-entrada.py

Confere:
  1. a ficha tem a coluna "Entrada (R$)" no lugar da "Situação";
  2. digitar as entradas soma na hora a "Entrada prevista" (sem a linha "Ñ soma"); a linha "↳ Junto" não tem entrada;
  3. Salvar grava a entrada de cada débito e a entrada prevista do caso (a soma, arredondada);
  4. a apresentação mostra a coluna Entrada e a caixa "Entrada prevista para regularizar" com a soma, sem a situação;
  5. caso antigo, sem a entrada dos débitos: a ficha mostra a entrada gravada antes, Salvar não a apaga e a
     apresentação sai sem a coluna Entrada;
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CASOS = [
    {'id': 'rg1', 'cliente_id': 'crg1', 'campanha': 'Exclusão Simples 2026', 'data_base': '2026-10-19', 'prazo_final': '2026-10-30',
     'status': 'levantamento', 'total_debitos': 48077.49, 'entrada_prevista': None, 'obs_geral': None, 'contexto': None, 'proximos_passos': None},
    {'id': 'rg2', 'cliente_id': 'crg2', 'campanha': 'Exclusão Simples 2026', 'data_base': '2026-09-20', 'prazo_final': '2026-10-30',
     'status': 'apresentado', 'total_debitos': 28289.89, 'entrada_prevista': 840.44, 'obs_geral': None, 'contexto': None, 'proximos_passos': None},
]
def D(id, caso, ordem, orgao, desc, valor, cond, ns=False, jt=False, entrada=None):
    return {'id': id, 'regularizacao_id': caso, 'ordem': ordem, 'orgao': orgao, 'descricao': desc, 'valor': valor, 'condicao': cond,
            'situacao': None, 'status': 'pendente', 'obs': None, 'nao_soma': ns, 'junto_anterior': jt, 'entrada': entrada}
DEBITOS = [
    D('dg1', 'rg1', 1, 'RFB', 'SIMPLES NACIONAL 08 A 11/2025 (TESTE)', 44084.45, '10% DE ENTRADA: 4.408,44 + 59X 672,47'),
    D('dg2', 'rg1', 2, 'RFB', 'INSS 04 A 07/26 (TESTE)', 2596.77, '5X 519,35'),
    D('dg3', 'rg1', 3, 'RFB', 'IRRF 04 A 07/26 (TESTE)', None, None, jt=True),
    D('dg4', 'rg1', 4, 'PREFEITURA', 'TAXA ALVARÁ (TESTE)', 396.27, 'A VISTA'),
    D('dg5', 'rg1', 5, 'PGFN', 'CONSOLIDAÇÃO ALTERNATIVA (TESTE)', 1000.00, 'OU 10X 100,00', ns=True),
    D('dg6', 'rg2', 1, 'INSS', 'INSS ref. 2025 (TESTE)', 8229.38, '16x R$ 514,33'),
    D('dg7', 'rg2', 2, 'Simples Nacional', 'Simples Nacional ref. 2025 (TESTE)', 20060.51, '60x R$ 334,34'),
]
SEMEAR = """
(() => {
  const CASOS = %s, DEBITOS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.regularizacoes = CASOS.map(c => ({ ...c }));
    v.regularizacao_debitos = DEBITOS.map(d => ({ ...d }));
    v.regularizacao_servicos = [];
    v.clientes.push({ id: 'crg1', nome_principal: 'EMPRESA EM REGULARIZAÇÃO LTDA (TESTE)', documento: '11222333000181', tipo_pessoa: 'PJ', status: 'ativo' },
                    { id: 'crg2', nome_principal: 'CASO ANTIGO LTDA (TESTE)', documento: '11222333000262', tipo_pessoa: 'PJ', status: 'ativo' });
  } });
})();
""" % (json.dumps(CASOS, ensure_ascii=False), json.dumps(DEBITOS, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def txt(s):
    return (s or '').replace('\xa0', ' ')

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 1400, 'height': 950})
        p.on('pageerror', lambda e: erros.append(f'fiscal-regularizacao.html: {e}'))
        p.on('dialog', lambda d: d.accept())
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.goto(base + 'fiscal-regularizacao.html'); p.wait_for_timeout(1500)

        print('1. A ficha')
        p.click('#rgLista tr[data-id="rg1"] td:first-child'); p.wait_for_timeout(400)
        cab = txt(p.evaluate("() => document.querySelector('#ovFicha .rg-ed thead').textContent"))
        ok('Entrada (R$)' in cab and 'Situação' not in cab, f'1. a coluna "Entrada (R$)" no lugar da "Situação" ({cab.split()})')
        linhas = p.locator('#fiDebitos tr')
        ok(linhas.count() == 5, f'1. os 5 débitos ({linhas.count()})')
        ok(p.locator('#fiDebitos tr[data-id="dg3"] .d-entrada').is_disabled(), '1. a linha "↳ Junto" não tem entrada (o campo fica travado)')
        ok(txt(p.inner_text('#fiTotEnt')) == '', '1. sem entrada nenhuma, o total fica vazio')

        print('2. As entradas somam na hora')
        p.fill('#fiDebitos tr[data-id="dg1"] .d-entrada', '4.408,44')
        p.fill('#fiDebitos tr[data-id="dg2"] .d-entrada', '519,35')
        p.fill('#fiDebitos tr[data-id="dg4"] .d-entrada', '396,27')
        p.fill('#fiDebitos tr[data-id="dg5"] .d-entrada', '100,00')
        tot = txt(p.inner_text('#fiTotEnt'))
        ok('Entrada prevista: R$ 5.324,06' in tot and 'Ñ soma' in tot, f'2. a soma sem a linha "Ñ soma" ({tot})')
        p.uncheck('#fiDebitos tr[data-id="dg5"] .d-ns')
        ok('R$ 5.424,06' in txt(p.inner_text('#fiTotEnt')), '2. desmarcar o "Ñ soma" põe a linha na soma')
        p.check('#fiDebitos tr[data-id="dg5"] .d-ns')

        print('3. Salvar')
        p.click('#fiSalvar'); p.wait_for_timeout(1200)
        dbs = p.evaluate("() => Object.fromEntries(window.__mockDb.regularizacao_debitos.filter(d => d.regularizacao_id === 'rg1').map(d => [d.id, d.entrada]))")
        ok(dbs == {'dg1': 4408.44, 'dg2': 519.35, 'dg3': None, 'dg4': 396.27, 'dg5': 100}, f'3. a entrada de cada débito gravada ({dbs})')
        caso = p.evaluate("() => window.__mockDb.regularizacoes.find(c => c.id === 'rg1')")
        ok(caso['entrada_prevista'] == 5324.06, f'3. a entrada prevista do caso é a soma ({caso["entrada_prevista"]})')
        ok(caso['total_debitos'] == 47077.49, f'3. o total dos débitos sem a linha "Ñ soma", arredondado nos centavos ({caso["total_debitos"]})')
        ok('R$ 5.324,06' in txt(p.inner_text('#rgLista tr[data-id="rg1"]')), '3. a lista mostra a entrada prevista do caso')

        print('4. A apresentação')
        with p.expect_popup() as pop:
            p.click('#fiApresentar')
        ap = pop.value; ap.wait_for_load_state(); ap.wait_for_timeout(300)
        ths = [txt(t) for t in ap.locator('table').first.locator('th').all_inner_texts()]
        ok([t.upper() for t in ths] == ['ÓRGÃO', 'DÉBITO / REFERÊNCIAS', 'VALOR', 'ENTRADA', 'CONDIÇÃO SIMULADA'], f'4. a coluna Entrada ao lado do Valor ({ths})')
        corpo = txt(ap.inner_text('body'))
        ok('R$ 4.408,44' in corpo and 'R$ 519,35' in corpo and 'R$ 396,27' in corpo, '4. a entrada de cada débito no quadro')
        caixa = txt(ap.inner_text('.entrada'))
        ok('R$ 5.324,06' in caixa, f'4. a caixa "Entrada prevista para regularizar" com a soma ({caixa})')
        ok(ap.locator('.sit').count() == 0, '4. sem a situação embaixo do órgão')
        ap.close()
        p.click('#fiFechar'); p.wait_for_timeout(200)

        print('5. Caso antigo, sem a entrada dos débitos')
        p.click('#rgLista tr[data-id="rg2"] td:first-child'); p.wait_for_timeout(400)
        tot = txt(p.inner_text('#fiTotEnt'))
        ok('gravada antes: R$ 840,44' in tot, f'5. a ficha mostra a entrada gravada antes ({tot})')
        p.click('#fiSalvar'); p.wait_for_timeout(1200)
        caso = p.evaluate("() => window.__mockDb.regularizacoes.find(c => c.id === 'rg2')")
        ok(caso['entrada_prevista'] == 840.44, f'5. Salvar não apaga a entrada gravada ({caso["entrada_prevista"]})')
        with p.expect_popup() as pop:
            p.click('#fiApresentar')
        ap = pop.value; ap.wait_for_load_state(); ap.wait_for_timeout(300)
        ths = [txt(t).upper() for t in ap.locator('table').first.locator('th').all_inner_texts()]
        ok('ENTRADA' not in ths and 'R$ 840,44' in txt(ap.inner_text('.entrada')), f'5. a apresentação sem a coluna Entrada, com a entrada gravada na caixa ({ths})')
        ap.close()
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
