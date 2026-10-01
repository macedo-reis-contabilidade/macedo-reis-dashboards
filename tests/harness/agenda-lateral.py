"""
Teste da lateral da Agenda (agenda.html) em telas largas — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/agenda-lateral.py

01/10/2026: saíram os Atalhos da esquerda; o Radar do escritório continua fixo à direita e a Agenda usa a largura
até ele. Confere:
  1. em nenhuma largura existem os Atalhos;
  2. de 1640 a ~2200 px: a Agenda começa alinhada com o topo (x = 40) e termina 32 px antes do Radar — sem encostar;
  3. em monitor muito largo (2560, 3440): a Agenda fica centrada no espaço ao lado do Radar, sem passar de ~1630 px;
  4. abaixo de 1640 px: sem Radar e a Agenda centrada, como sempre foi;
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
  const rad = document.querySelector('.ag-lateral.dir'); const rr = rad.getBoundingClientRect();
  return { esq, dir, larg: dir - esq, radarVisivel: getComputedStyle(rad).display !== 'none', radarEsq: rr.left,
           atalhos: document.querySelectorAll('.ag-lateral.esq, #agAtalhosBox, .ag-atalho').length,
           vw: document.documentElement.clientWidth }; }"""

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w in (1440, 1640, 1920, 2560, 3440):
            p = b.new_page(viewport={'width': w, 'height': 1000})
            p.on('pageerror', lambda e: erros.append(f'{w}: {e}'))
            p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
            p.goto(base + 'agenda.html'); p.wait_for_timeout(1500)
            m = p.evaluate(MEDIR)
            print(f'[{w}px]')
            ok(m['atalhos'] == 0, '1. sem Atalhos')
            if w < 1640:
                ok(not m['radarVisivel'], '4. sem Radar abaixo de 1640 px')
                ok(abs(m['esq'] - (m['vw'] - m['dir'])) <= 2, '4. Agenda centrada')
            else:
                ok(m['radarVisivel'], 'Radar à direita')
                vao = m['radarEsq'] - m['dir']
                ok(vao >= 24, f'a Agenda não encosta no Radar (vão de {vao:.0f} px)')
                if w <= 2200:
                    ok(abs(m['esq'] - 40) <= 1 and abs(vao - 32) <= 1, f'2. começa em x = 40 (está em {m["esq"]:.0f}) e para 32 px antes do Radar')
                else:
                    ok(m['larg'] <= 1640 and abs(m['esq'] - vao) <= 16, f'3. centrada ao lado do Radar (esquerda {m["esq"]:.0f}, vão {vao:.0f}, largura {m["larg"]:.0f})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, '5. nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
