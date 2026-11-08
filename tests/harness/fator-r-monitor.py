"""
O Fator R › Acompanhadas pelo sistema (08/11/2026): a seção do painel acha sozinha as empresas do Simples do fator r
(o CNAE ou o Anexo V no Domínio) e calcula o fator pela ponte, sem nada digitado. Sem login e sem banco (o mock do
conferir.py; os clientes e o Domínio entram por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/fator-r-monitor.py

Confere:
  1. a agência de publicidade do Simples entra, com o fator de 25% (Anexo V) e o aviso do apurado no Anexo III;
  2. o supermercado do Simples e a agência do Presumido ficam de fora;
  3. o nome que veio do banco não vira HTML;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

hoje = datetime.date.today()
def mes_antes(y, m, k):
    t = y * 12 + (m - 1) - k
    return '%04d-%02d' % (t // 12, t % 12 + 1)
# o PA que a tela mostra: o mês seguinte ao último fechado (até o dia 20, o de dois meses atrás)
fech = mes_antes(hoje.year, hoje.month, 1 if hoje.day > 20 else 2)
pa_y, pa_m = int(fech[:4]), int(fech[5:]) + 1
if pa_m == 13: pa_y, pa_m = pa_y + 1, 1
CLI = [
  {'id': 'frm1', 'nome_principal': 'AGENCIA <b>TESTE</b> LTDA', 'nome_fantasia': None, 'documento': '22222222000122', 'status': 'ativo', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'cnae_principal': '7311-4/00 - Agências de publicidade', 'cnaes_secundarios': []},
  {'id': 'frm2', 'nome_principal': 'SUPERMERCADO TESTE LTDA', 'nome_fantasia': None, 'documento': '33333333000133', 'status': 'ativo', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'cnae_principal': '4711-3/02 - Supermercados', 'cnaes_secundarios': []},
  {'id': 'frm3', 'nome_principal': 'AGENCIA PRESUMIDA LTDA', 'nome_fantasia': None, 'documento': '44444444000144', 'status': 'ativo', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Lucro Presumido', 'cnae_principal': '7311-4/00 - Agências de publicidade', 'cnaes_secundarios': []},
]
DOM = []
for k in range(1, 14):
    c = mes_antes(pa_y, pa_m, k)
    for cid in ('frm1', 'frm2'):
        DOM.append({'cliente_id': cid, 'competencia': c, 'receita_simples': 10000, 'receita_bruta': 10000, 'receita_anexo_3': 10000 if cid == 'frm1' else 0, 'receita_anexo_5': 0,
                    'receita_servicos': 10000, 'rbt12': 120000 if k == 1 else None, 'meses_rbt12': 12, 'salarios': 2000, 'decimo_terceiro': 0, 'pro_labore_valor': 300, 'fgts': 200,
                    'inss_empresa': 0, 'inss_rat': 0, 'inss_terceiros': 0})
SEMEAR = """
(() => {
  const CLI = %s, DOM = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes = (v.clientes || []).concat(CLI); v.dominio_mensal = DOM; v.receita_pgdas = []; v.fr_empresas = v.fr_empresas || []; v.fr_lancamentos = v.fr_lancamentos || [];
  } });
})();
""" % (json.dumps(CLI, ensure_ascii=False), json.dumps(DOM, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.goto(base + 'fator-r.html')
        p.wait_for_selector('#frMonitor table, #frMonitor .fr-erro, #frMonitor p:not(:first-child)', timeout=8000)
        txt = p.inner_text('#frMonitor')
        linhas = p.eval_on_selector_all('#frMonitor tbody tr', 'rs => rs.map(r => r.innerText)')
        ok(len(linhas) == 1, f'1. uma empresa acompanhada ({len(linhas)}): {txt[:200]!r}')
        ok(linhas and '25,00%' in linhas[0], '1. o fator de 25%')
        ok(linhas and 'Anexo V' in linhas[0], '1. no Anexo V')
        ok(linhas and 'Apurado no Anexo III' in linhas[0], '1. com o aviso do apurado no Anexo III')
        ok('SUPERMERCADO' not in txt and 'PRESUMIDA' not in txt, '2. o supermercado e o Presumido ficam de fora')
        ok(p.eval_on_selector_all('#frMonitor b', 'bs => bs.length') == 0 and 'AGENCIA <b>TESTE</b> LTDA' in txt, '3. o nome sai escapado')
        p.close(); b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
