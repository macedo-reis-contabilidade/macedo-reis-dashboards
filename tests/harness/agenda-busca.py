"""
Teste da busca da Agenda (agenda.html) com os filtros de setor e de responsável — sem login e sem banco (mesmo mock
do conferir.py; o mock não filtra o texto da busca, então "achar" = todas as tarefas inventadas).

    python tests/harness/agenda-busca.py

07/10/2026 (pedido da Thalia): com Fiscal + Thalia escolhidos, digitar uma empresa trazia outros setores e outras
pessoas. Confere:
  1. com Fiscal + Thalia, a busca mostra só as tarefas fiscais da Thalia (de qualquer data), diz o filtro e quantas
     ficaram de fora, e o "Selecionar todas" do lote conta só as abertas da tela;
  2. trocar o responsável ou o setor com a busca aberta refaz a lista na hora;
  3. sem filtro, volta a ser busca em todos os setores e responsáveis;
  4. filtro sem nenhum resultado avisa quantos há em outros setores ou responsáveis;
  5. Limpar busca volta pra agenda; sem erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

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
        p = b.new_page(viewport={'width': 1440, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.goto(base + 'agenda.html'); p.wait_for_timeout(1500)
        total = p.evaluate('() => window.__mockDb.tarefas.length')
        esperado = sorted(p.evaluate("() => window.__mockDb.tarefas.filter(t => t.setor === 'fiscal' && t.responsavel === 'Thalia').map(t => t.id)"))
        abertas = p.evaluate("() => window.__mockDb.tarefas.filter(t => t.setor === 'fiscal' && t.responsavel === 'Thalia' && t.status !== 'concluida').length")
        fiscais = p.evaluate("() => window.__mockDb.tarefas.filter(t => t.setor === 'fiscal').length")
        ids = lambda: sorted(p.evaluate("() => [...document.querySelectorAll('[data-bstask]')].map(e => e.dataset.bstask)"))
        nota = lambda: p.inner_text('#agBuscaNota')
        cont = lambda: int(p.inner_text('.ag-dia-secao .cont'))

        print('[1] Fiscal + Thalia')
        p.select_option('#fSetor', 'fiscal'); p.select_option('#fResp', 'Thalia'); p.wait_for_timeout(300)
        p.fill('#agBusca', 'empresa'); p.wait_for_timeout(900)
        ok(ids() == esperado and cont() == len(esperado), f'1. só as {len(esperado)} tarefas fiscais da Thalia: {ids()}')
        cards = p.evaluate("() => [...document.querySelectorAll('[data-bstask] .ag-card-meta')].map(e => e.textContent)")
        ok(cards and all('Thalia' in c and 'Fiscal' in c for c in cards), '1. cada cartão é do Fiscal e da Thalia')
        ok(f'só Fiscal · Thalia · {total - len(esperado)} de outros setores ou responsáveis ficaram de fora' in nota(), '1. diz o filtro e quantas ficaram de fora: ' + nota())
        ok(f'Selecionar todas ({abertas})' in p.inner_text('#agLoteBarra'), f'1. o lote conta só as {abertas} abertas da tela')

        print('[2] trocando os filtros com a busca aberta')
        p.select_option('#fResp', ''); p.wait_for_timeout(300)
        ok(cont() == fiscais and f'só Fiscal · {total - fiscais} de outros' in nota(), f'2. todos os responsáveis do Fiscal: {cont()} — ' + nota())

        print('[3] sem filtro')
        p.select_option('#fSetor', ''); p.wait_for_timeout(300)
        ok(cont() == total and 'busca em todas as datas, setores e responsáveis' in nota(), f'3. todas as {total}: ' + nota())

        print('[4] filtro sem resultado')
        p.select_option('#fSetor', 'dp'); p.select_option('#fResp', 'Thalia'); p.wait_for_timeout(300)
        corpo = p.inner_text('main')
        ok(cont() == 0 and f'Nada com esse termo em DP · Thalia — há {total} resultado(s) em outros setores ou responsáveis' in corpo, '4. avisa que há resultados fora do filtro')

        print('[5] limpar')
        p.click('#agBuscaLimpar'); p.wait_for_timeout(400)
        ok(p.locator('#agBuscaNota').count() == 0 and p.input_value('#agBusca') == '', '5. Limpar busca volta pra agenda')
        p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:5])))
    print(('\nOK' if not falhas else f'\n{falhas} FALHA(S)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
