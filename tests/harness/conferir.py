"""
Conferência visual das telas nos dois temas — roda em Windows, Mac ou Linux, sem login e sem banco.

    python tests/harness/conferir.py fiscal-reforma.html comercial-precificacao.html

1. Monta uma cópia do site em .harness/site (ignorada pelo git) com o mock do Supabase no lugar do real
   (dados inventados — nada de cliente).
2. Sobe um servidor local numa porta livre.
3. Abre cada tela no tema escuro e no claro e salva em .harness/fotos/<tema>-<tela>.png
4. Lista erro de JavaScript que a tela der.

Pré-requisito (uma vez): pip install playwright  e  python -m playwright install chromium
"""
import sys, shutil, threading, http.server, socketserver, functools, pathlib, time

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SITE = RAIZ / '.harness' / 'site'
FOTOS = RAIZ / '.harness' / 'fotos'

def montar_site():
    if SITE.exists(): shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    for f in RAIZ.glob('*.html'): shutil.copy2(f, SITE / f.name)
    for pasta in ('clientes', 'assets'):
        if (RAIZ / pasta).exists(): shutil.copytree(RAIZ / pasta, SITE / pasta)
    # sempre por último: o mock substitui o supabase.js real
    shutil.copy2(RAIZ / 'tests' / 'harness' / 'supabase.mock.js', SITE / 'assets' / 'js' / 'supabase.js')

class _Quieto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def servir():
    h = functools.partial(_Quieto, directory=str(SITE))
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

def main(telas):
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            p = b.new_page(viewport={'width': 1600, 'height': 900})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            p.goto(base + 'index.html')
            p.evaluate(f"() => {{ localStorage.setItem('mr_tema', '{tema}'); for (const k of ['agenda_v1','reforma_v1','clientes_v1']) localStorage.setItem('mr_tour_' + k + '::financeiro@macedoereis.com.br', 'ok'); }}")
            for t in telas:
                p.goto(base + t); p.wait_for_timeout(1500)
                destino = FOTOS / f"{tema}-{t.replace('/', '_').replace('.html', '')}.png"
                p.screenshot(path=str(destino), full_page=True)
                print('foto:', destino.relative_to(RAIZ))
            p.close()
        b.close()
    srv.shutdown()
    print('\nErros de JavaScript:', 'nenhum' if not erros else '')
    for e in erros: print('  ', e)

if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    main(sys.argv[1:])
