"""Teste das janelas (modais): ficam por cima da barra do topo e fecham com Esc (assets/js/janelas.js)
— sem login e sem banco (mesmo mock do conferir.py, dados inventados).

    python tests/harness/janelas-esc.py

Confere, nos temas escuro e claro, numa tela baixa (1280x480 — celular deitado):
  Tarefas do setor (fiscal-tarefas.html)
    1. com a janela do lote aberta, o que está no lugar da barra do topo é a janela (antes era a barra);
    2. escrever um texto e apertar Esc fecha a janela;
    3. nada é gravado no histórico;
    4. ao reabrir, a caixa está vazia (mesma limpeza do Cancelar);
    5. Esc fecha também o detalhe da tarefa;
    6. sem janela aberta, Esc não faz nada.
  Os outros formatos de janela do sistema, um de cada:
    7. "Vincular empresas" das tarefas recorrentes (dp-regras.html, #rvOv com classe 'on');
    8. "Nova tarefa" (agenda.html, #ntOverlay com classe 'is-open', fecha pelo ×);
    9. "Importar clientes do Taskdo" (clientes/index.html, .imp-overlay com classe 'is-open');
   10. "Adicionar empresa ao mês" (financeiro-boletos.html, #ov com classe 'open', fecha pelo "Fechar").
Fotos das janelas em tela baixa em .harness/fotos/janela-<tema>-*.png.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, tema, pagina, erros, altura=480):
    p = b.new_page(viewport={'width': 1280, 'height': altura})
    p.on('pageerror', lambda e: erros.append(f'{tema} {pagina}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
    p.goto(base + pagina)
    return p

def aberta(p, seletor, classe):
    return p.evaluate(f"() => {{ const e = document.querySelector('{seletor}'); return !!e && e.classList.contains('{classe}'); }}")

def no_lugar_da_barra(p, seletor):
    """O que responde ao clique onde fica a barra do topo é a janela, e não a barra."""
    return p.evaluate(f"""() => {{
      const j = document.querySelector('{seletor}');
      const alvo = document.elementFromPoint(Math.round(innerWidth / 2), 8);
      return !!j && !!alvo && (j === alvo || j.contains(alvo));
    }}""")

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}] fiscal-tarefas.html — janela do lote')
            p = abrir(b, base, tema, 'fiscal-tarefas.html', erros)
            p.wait_for_selector('details.fa-grupo')
            p.click('.fa-focus-card[data-periodo="todas"]')
            g = p.locator('details.fa-grupo[data-titulo="Conferir notas de entrada"]')
            g.wait_for()
            if not g.evaluate('d => d.open'): g.locator('.fa-grupo-nome').click()
            caixas = g.locator('input[data-sel]')
            caixas.nth(0).check(); caixas.nth(1).check()
            g.locator('[data-lote-and]').click(); p.wait_for_timeout(400)
            ok(aberta(p, '#loteOverlay', 'is-open'), '1. a janela do lote abriu')
            ok(no_lugar_da_barra(p, '#loteOverlay'), '1. a janela está por cima da barra do topo')
            p.screenshot(path=str(FOTOS / f'janela-{tema}-lote-1280x480.png'))

            antes = p.evaluate('() => window.__mockDb.tarefa_historico.length')
            p.fill('#loteObs', 'texto que não era pra ser gravado')
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#loteOverlay', 'is-open'), '2. Esc fechou a janela')
            ok(p.evaluate('() => window.__mockDb.tarefa_historico.length') == antes, '3. nada foi gravado no histórico')
            g.locator('[data-lote-and]').click(); p.wait_for_timeout(400)
            ok(p.input_value('#loteObs') == '', '4. ao reabrir, a caixa está vazia')
            p.keyboard.press('Escape'); p.wait_for_timeout(300)

            g.locator('tr[data-id]').first.click(); p.wait_for_timeout(600)
            ok(aberta(p, '#detOverlay', 'is-open'), '5. o detalhe da tarefa abriu')
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#detOverlay', 'is-open'), '5. Esc fechou o detalhe')

            marcadas = p.evaluate("() => document.querySelectorAll('input[data-sel]:checked').length")
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
            sem_janela = p.evaluate("() => document.querySelectorAll('.fa-modal-overlay.is-open').length")
            ok(sem_janela == 0 and p.evaluate("() => document.querySelectorAll('input[data-sel]:checked').length") == marcadas,
               '6. sem janela aberta, Esc não mexe na tela')
            p.close()

            print(f'[{tema}] os outros formatos de janela')
            p = abrir(b, base, tema, 'dp-regras.html', erros)
            p.wait_for_timeout(1400)
            p.locator('.rv-item', has_text='FOLHA DE PAGAMENTO (TESTE)').click(); p.wait_for_timeout(300)
            p.click('#rvVinc'); p.wait_for_timeout(400)
            ok(aberta(p, '#rvOv', 'on'), '7. "Vincular empresas" abriu')
            ok(no_lugar_da_barra(p, '#rvOv'), '7. está por cima da barra do topo')
            p.screenshot(path=str(FOTOS / f'janela-{tema}-vincular-1280x480.png'))
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#rvOv', 'on'), '7. Esc fechou')
            p.close()

            p = abrir(b, base, tema, 'agenda.html', erros)
            p.wait_for_timeout(1800)
            p.click('#btnNovaAv'); p.wait_for_timeout(500)
            ok(aberta(p, '#ntOverlay', 'is-open'), '8. "Nova tarefa" abriu')
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#ntOverlay', 'is-open'), '8. Esc fechou')
            p.close()

            p = abrir(b, base, tema, 'clientes/index.html', erros)
            p.wait_for_timeout(1400)
            p.click('#btnImportar'); p.wait_for_timeout(400)
            ok(aberta(p, '#impOverlay', 'is-open'), '9. "Importar clientes do Taskdo" abriu')
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#impOverlay', 'is-open'), '9. Esc fechou')
            p.close()

            p = abrir(b, base, tema, 'financeiro-boletos.html', erros)
            p.wait_for_timeout(1600)
            p.click('#btnAdd'); p.wait_for_timeout(400)
            ok(aberta(p, '#ov', 'open'), '10. "Adicionar empresa ao mês" abriu')
            p.keyboard.press('Escape'); p.wait_for_timeout(400)
            ok(not aberta(p, '#ov', 'open'), '10. Esc fechou')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
