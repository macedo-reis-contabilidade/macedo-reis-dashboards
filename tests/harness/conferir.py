"""
Conferência visual das telas nos dois temas — roda em Windows, Mac ou Linux, sem login e sem banco.

    python tests/harness/conferir.py fiscal-reforma.html comercial-precificacao.html "clientes/editar.html?id=c1"
    python tests/harness/conferir.py --sem-sessao login.html

1. Monta uma cópia do site em .harness/site (ignorada pelo git) com o mock do Supabase no lugar do real
   (dados inventados — nada de cliente).
2. Sobe um servidor local numa porta livre.
3. Abre cada tela no tema escuro e no claro e salva em .harness/fotos/<tema>-<tela>.png
4. Lista erro de JavaScript que a tela der.

--sem-sessao: mesmo banco falso, mas sem ninguém logado. Serve pro login.html, que com sessão
manda direto pro painel e por isso nunca aparecia nas fotos.

Pré-requisito (uma vez): pip install playwright  e  python -m playwright install chromium
"""
import sys, re, shutil, threading, http.server, socketserver, functools, pathlib, time

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SITE = RAIZ / '.harness' / 'site'
FOTOS = RAIZ / '.harness' / 'fotos'

SEM_SESSAO = '''
// --sem-sessao: o mesmo banco falso, só que sem ninguém logado
supabase.auth.getUser = async () => ({ data: { user: null } });
supabase.auth.getSession = async () => ({ data: { session: null } });
getCurrentUser = async () => null;
'''

def montar_site(sem_sessao=False):
    if SITE.exists(): shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    for f in RAIZ.glob('*.html'): shutil.copy2(f, SITE / f.name)
    for pasta in ('clientes', 'assets'):
        if (RAIZ / pasta).exists(): shutil.copytree(RAIZ / pasta, SITE / pasta)
    # sempre por último: o mock substitui o supabase.js real
    destino = SITE / 'assets' / 'js' / 'supabase.js'
    shutil.copy2(RAIZ / 'tests' / 'harness' / 'supabase.mock.js', destino)
    if sem_sessao:
        with open(destino, 'a', encoding='utf-8') as f: f.write(SEM_SESSAO)

class _Quieto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def servir():
    h = functools.partial(_Quieto, directory=str(SITE))
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

def main(telas, sem_sessao=False):
    from playwright.sync_api import sync_playwright
    montar_site(sem_sessao); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            p = b.new_page(viewport={'width': 1600, 'height': 900})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            # nenhum tour por cima da foto: qualquer chave mr_tour_* responde "já visto"
            p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
            if sem_sessao:
                # sem sessão, o index manda pro login: o tema vai pelo próprio navegador
                p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}')")
            else:
                p.goto(base + 'index.html')
                p.evaluate(f"() => {{ localStorage.setItem('mr_tema', '{tema}'); for (const k of ['agenda_v1','reforma_v1','clientes_v1']) localStorage.setItem('mr_tour_' + k + '::financeiro@macedoereis.com.br', 'ok'); }}")
            for t in telas:
                p.goto(base + t); p.wait_for_timeout(1500)
                nome = re.sub(r'[^A-Za-z0-9_-]+', '_', t.replace('.html', ''))   # aceita tela?id=... (o Windows não deixa ? no nome)
                destino = FOTOS / f"{tema}-{nome}.png"
                p.screenshot(path=str(destino), full_page=True)
                print('foto:', destino.relative_to(RAIZ))
            p.close()
        b.close()
    srv.shutdown()
    print('\nErros de JavaScript:', 'nenhum' if not erros else '')
    for e in erros: print('  ', e)

if __name__ == '__main__':
    args = sys.argv[1:]
    sem_sessao = '--sem-sessao' in args
    telas = [a for a in args if not a.startswith('--')]
    if not telas: print(__doc__); sys.exit(1)
    main(telas, sem_sessao)
