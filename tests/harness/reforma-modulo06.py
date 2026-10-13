"""Teste das mudanças da Reforma vindas do Módulo 06 do curso (regimes específicos e notas fiscais) na ficha
(fiscal-reforma.html, 13/10/2026): a dica do campo "Crédito das despesas (% do cheio)" com o aluguel de imóvel e com
VR, VA e plano de saúde dos empregados.
Sem login e sem banco: mesmo mock do conferir.py. Cliente e caso (inventados) entram no banco falso por uma armadilha em
window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.
(O CT-e e o MDF-e no importador estão em tests/harness/importar-xml.py; os textos da análise — refeição por contrato
nos bares, transporte e a fonte do crédito das despesas — em tests/rt-analise.test.mjs.)

    python tests/harness/reforma-modulo06.py

Confere:
  1. a dica do campo diz quanto credita o aluguel (30% se o locador for do regime regular; nada se for pessoa física não
     contribuinte) e que VR, VA e plano de saúde creditam só o débito do fornecedor, sem perder a linha do −30%;
  2. o título do campo cita os artigos (LC 214, art. 261, parágrafo único, e art. 57, §3º, IV, na redação da LC 227);
  3. a tela não dá erro de JavaScript.
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
    {'id': 'm6c1', 'nome_principal': 'RESTAURANTE DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000601', 'cnae_principal': '5611-2/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
]
CASOS = [{'id': 'm6k1', 'cliente_id': 'm6c1', 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '5611', 'segmento': 'alimentacao',
          'sinal_b2b': 0, 'sinal_entradas': 1, 'sinal_reducao': 1, 'sinal_aliquota': 0, 'score': 2, 'triagem': 'simular',
          'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
          'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Triagem automática por CNAE (teste).'}]
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS);
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

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

        p.click('#rtLista tr:has-text("RESTAURANTE DE TESTE LTDA")'); p.wait_for_timeout(500)
        dica = br(p.inner_text('label:has(#sPctDespCred) .hint'))
        titulo = br(p.get_attribute('label:has(#sPctDespCred)', 'title') or '')
        ok('art. 127' in dica and '70%' in dica, f'a dica mantém o −30% das profissões (70% do cheio) ({dica[:70]}…)')
        ok('aluguel de imóvel: 30% se o locador for do regime regular' in dica and 'nada se for pessoa física não contribuinte' in dica,
           'a dica diz quanto credita o aluguel: 30% (locador do regime regular) ou nada (pessoa física não contribuinte)')
        ok('VR, VA e plano de saúde: só o débito do fornecedor' in dica, 'a dica diz que VR, VA e plano de saúde creditam só o débito do fornecedor')
        ok('art. 261, parágrafo único' in titulo and 'redução de 70%' in titulo and 'art. 57, §3º, IV' in titulo and 'LC 227' in titulo,
           'o título cita a redução de 70% da locação (art. 261, parágrafo único) e o art. 57, §3º, IV, na redação da LC 227')
        ok(p.get_attribute('#sPctDespCred', 'placeholder') == '100 = cheio', 'o campo continua com o mesmo id e o mesmo padrão')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
