"""
Teste da largura da Agenda (agenda.html) e da coluna "Seu dia" — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/agenda-lateral.py

20/10/2026 (pedido do Samuel): saiu o Radar do escritório, a lateral fixa das telas largas (e antes, em 01/10, os
Atalhos da esquerda); a Agenda fica centrada, até 1700 px, com a coluna "Seu dia" à direita da lista. Confere, de 1440 a
3440 px:
  1. em nenhuma largura existem o Radar nem os Atalhos;
  2. a Agenda centrada, sem passar de 1620 px de conteúdo (1700 menos as margens);
  3. a coluna "Seu dia" à direita da lista, encostada na margem da Agenda, entre 300 e 384 px;
  4. quando a coluna acompanha a rolagem, ela termina antes do balão do assistente (ou o balão fica fora dela);
  5. sem erro de JavaScript.
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

MEDIR = """() => { const m = document.querySelector('main.content'); const cs = getComputedStyle(m); const r = m.getBoundingClientRect();
  const esq = r.left + parseFloat(cs.paddingLeft), dir = r.right - parseFloat(cs.paddingRight);
  const col = document.querySelector('.ag-dia-col').getBoundingClientRect(), sd = document.getElementById('agSeuDia');
  const rs = sd.getBoundingClientRect(), bal = document.querySelector('.as-lancador'), rb = bal ? bal.getBoundingClientRect() : null;
  return { esq, dir, larg: dir - esq, colDir: col.right, sdEsq: rs.left, sdDir: rs.right, sdLarg: rs.width, sdAlt: sd.offsetHeight,
           fixa: sd.classList.contains('sd-fixa'), balEsq: rb ? rb.left : null, balTopo: rb ? rb.top : null,
           antigos: document.querySelectorAll('.ag-lateral, #agRadarBox, #agAtalhosBox, .ag-atalho, #agResumo').length,
           vw: document.documentElement.clientWidth }; }"""

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w, h in ((1440, 900), (1640, 1000), (1920, 1080), (2560, 1300), (3440, 1400)):
            p = b.new_page(viewport={'width': w, 'height': h})
            p.on('pageerror', lambda e: erros.append(f'{w}: {e}'))
            p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
            p.goto(base + 'agenda.html')
            p.wait_for_selector('#agSeuDia #sdProximos .sd-dia', timeout=8000)
            p.wait_for_selector('.as-lancador', timeout=6000)
            p.wait_for_timeout(2800)   # a coluna confere de novo a altura depois que o balão chega
            m = p.evaluate(MEDIR)
            print(f'[{w}x{h}]')
            ok(m['antigos'] == 0, '1. sem o Radar, sem os Atalhos e sem o Resumo do dia')
            ok(abs(m['esq'] - (m['vw'] - m['dir'])) <= 2, f'2. a Agenda centrada (esquerda {m["esq"]:.0f}, direita {m["vw"] - m["dir"]:.0f})')
            ok(m['larg'] <= 1621, f'2. sem passar de 1620 px de conteúdo ({m["larg"]:.0f})')
            ok(m['sdEsq'] >= m['colDir'] + 23 and abs(m['sdDir'] - m['dir']) <= 1 and 299 <= m['sdLarg'] <= 385,
               f'3. "Seu dia" à direita da lista (vão de {m["sdEsq"] - m["colDir"]:.0f} px, largura {m["sdLarg"]:.0f})')
            if m['fixa']:
                fora = m['balEsq'] is None or m['balEsq'] >= m['sdDir']
                ok(fora or 16 + m['sdAlt'] <= m['balTopo'] - 12, f'4. presa na tela, ela termina antes do balão (altura {m["sdAlt"]}, balão em {m["balTopo"]})')
            else:
                ok(True, f'4. a coluna rola com a página (altura {m["sdAlt"]} px)')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, '5. nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
