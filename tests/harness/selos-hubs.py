"""
Os números dos cards de Transição (comercial.html) e Regularizações (fiscal.html) — 19/10/2026. Antes os dois nunca
recebiam número e ficavam pra sempre no "·" cinza de "carregando". Sem login e sem banco (o mock do conferir.py; as
transições e as regularizações entram por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/selos-hubs.py

Confere:
  1. Comercial: o card da Transição diz "N em andamento", contando só as transições em andamento (as concluídas não);
  2. Fiscal: o card das Regularizações diz "N em aberto", sem as regularizadas e as sem acordo;
  3. os dois cards saem do "·" de carregando;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

def TX(i, titulo, status):
    return {'id': 'txs%d' % i, 'titulo': titulo, 'tipo': 'entrada', 'proposta_id': None, 'padrinho': None, 'inicio': '2026-10-01', 'previsao_fim': '2026-12-30',
            'tera_funcionarios': None, 'contato': None, 'observacao': None, 'status': status, 'concluida_em': None, 'criado_em': '2026-10-01T12:00:00Z', 'transicao_empresas': []}
def RG(i, status):
    return {'id': 'rgs%d' % i, 'cliente_id': 'c1', 'status': status, 'total_debitos': 1000 * i, 'entrada_prevista': 100 * i, 'obs_geral': None,
            'criado_em': '2026-10-01T12:00:00Z', 'atualizado_em': '2026-10-01T12:00:00Z'}
# o mock já traz uma transição em andamento (tx1); aqui entram mais uma em andamento e duas concluídas
TRANSICOES = [TX(1, 'LOJA EM TRANSIÇÃO (TESTE)', 'em_andamento'), TX(2, 'OFICINA QUE JÁ ENTROU (TESTE)', 'concluida'), TX(3, 'MERCADO QUE JÁ ENTROU (TESTE)', 'concluida')]
REGULARIZACOES = [RG(1, 'levantamento'), RG(2, 'apresentado'), RG(3, 'parcelado'), RG(4, 'regularizado'), RG(5, 'sem_acordo'), RG(6, 'regularizado')]
SEMEAR = """
(() => {
  const TX = %s, RG = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.transicoes.push(...TX); v.regularizacoes = RG.map(r => ({ ...r }));
  } });
})();
""" % (json.dumps(TRANSICOES, ensure_ascii=False), json.dumps(REGULARIZACOES, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def selo(p, href):
    p.wait_for_function("h => { const e = document.querySelector('.card-status[data-mod=\"' + h + '\"]'); return e && !e.classList.contains('st-load'); }", arg=href, timeout=5000)
    return p.evaluate("h => { const e = document.querySelector('.card-status[data-mod=\"' + h + '\"]'); return { texto: e.textContent.trim(), carregando: e.classList.contains('st-load') }; }", href)

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

        print('1. Comercial › Transição')
        p.goto(base + 'comercial.html')
        s = selo(p, 'comercial-transicao.html')
        esperado = p.evaluate("() => window.__mockDb.transicoes.filter(t => t.status === 'em_andamento').length")
        ok(esperado == 2, f'1. (o banco falso tem {esperado} em andamento entre {len(TRANSICOES) + 1} transições)')
        ok(s['texto'] == f'{esperado} em andamento', f'1. o card diz "{s["texto"]}"')
        ok(not s['carregando'] and s['texto'] != '·', '3. o card da Transição saiu do "·" de carregando')

        print('2. Fiscal › Regularizações')
        p.goto(base + 'fiscal.html')
        s = selo(p, 'fiscal-regularizacao.html')
        ok(s['texto'] == '3 em aberto', f'2. o card diz "{s["texto"]}" (6 casos: 3 em aberto, 2 regularizados, 1 sem acordo)')
        ok(not s['carregando'] and s['texto'] != '·', '3. o card das Regularizações saiu do "·" de carregando')
        p.close()
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
