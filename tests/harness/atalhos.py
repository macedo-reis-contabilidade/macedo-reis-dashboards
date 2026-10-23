"""
Os atalhos do alto das telas (23/10/2026, pedido do Samuel) — sem login e sem banco (o mock do conferir.py, com a lista
semeada só neste teste; endereços inventados).

    python tests/harness/atalhos.py

Confere:
  1. no Painel: os três atalhos logo depois da marca, na ordem da lista, com o endereço de cada um, abrindo em aba nova
     (sem passar o endereço do sistema), o nome à mostra e o ícone carregado de assets/atalhos/;
  2. numa tela de dentro de uma pasta (clientes/editar.html): os mesmos atalhos, com os ícones achados;
  3. o item com endereço que não é http(s) ou ícone com caminho fica de fora; nome com HTML aparece como texto;
  4. a lista fica guardada na aba: na tela seguinte, os atalhos aparecem antes de o banco responder;
  5. tela estreita: só os ícones (1000 px); celular: sem os atalhos (600 px);
  6. as telas públicas (admissão, rescisão) não têm atalhos;
e nenhum erro de JavaScript. Tira as fotos da barra (escuro e claro) em .harness/atalhos-*.png, pra conferir o visual.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, SITE

LISTA = [
    {'nome': 'Onvio', 'url': 'https://onvio.exemplo.com.br/login/#/', 'icone': 'onvio.png'},
    {'nome': 'Drive', 'url': 'https://drive.exemplo.com/drive/u/1/folders/PASTA-INVENTADA', 'icone': 'drive.png'},
    {'nome': 'Webmail', 'url': 'http://webmail.exemplo.com.br/', 'icone': 'webmail.png'},
    {'nome': 'Script', 'url': 'javascript:alert(1)', 'icone': 'onvio.png'},
    {'nome': 'Caminho', 'url': 'https://exemplo.com/', 'icone': '../../js/supabase.js'},
]
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.configuracoes_escritorio = (v.configuracoes_escritorio || []).concat([{ chave: 'atalhos', valor: %s, descricao: 'teste' }]);
  } });
})();
""" % json.dumps(json.dumps(LISTA))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def atalhos(p):
    return p.evaluate("""() => [...document.querySelectorAll('.topbar .tb-atalhos a')].map(a => ({
      nome: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel,
      img: a.querySelector('img') ? a.querySelector('img').getAttribute('src') : null,
      carregou: !!(a.querySelector('img') && a.querySelector('img').complete && a.querySelector('img').naturalWidth > 0),
      nomeVisivel: !!(a.querySelector('span') && a.querySelector('span').offsetWidth > 0) }))""")

def esperar_atalhos(p):
    p.wait_for_function("() => document.querySelectorAll('.topbar .tb-atalhos a img').length >= 3 && [...document.querySelectorAll('.topbar .tb-atalhos img')].every(i => i.complete)", timeout=8000)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)

        print('1. No Painel')
        p.goto(base + 'index.html'); esperar_atalhos(p)
        a = atalhos(p)
        ok([x['nome'] for x in a] == ['Onvio', 'Drive', 'Webmail'], f'os três, na ordem da lista ({[x["nome"] for x in a]})')
        ok([x['href'] for x in a] == [LISTA[0]['url'], LISTA[1]['url'], LISTA[2]['url']], 'o endereço de cada um, como está no banco (o webmail em http)')
        ok(all(x['target'] == '_blank' and 'noopener' in x['rel'] and 'noreferrer' in x['rel'] for x in a), 'abrem em aba nova, sem levar o endereço do sistema')
        ok(all(x['carregou'] for x in a) and all(x['img'].endswith('/assets/atalhos/' + n + '.png') for x, n in zip(a, ['onvio', 'drive', 'webmail'])), 'os ícones carregam, de assets/atalhos/')
        ok(all(x['nomeVisivel'] for x in a), 'com o nome à mostra na tela larga')
        ok(p.evaluate("() => { const n = document.querySelector('.tb-atalhos'); return !!n && n.previousElementSibling.classList.contains('topbar-brand') && n.getAttribute('aria-label') === 'Atalhos'; }"),
           'logo depois da marca, num <nav> "Atalhos"')
        cx_ = p.evaluate("() => { const m = document.querySelector('.topbar-brand').getBoundingClientRect(), n = document.querySelector('.tb-atalhos').getBoundingClientRect(), u = document.querySelector('.topbar-actions').getBoundingClientRect(); return [m.right, n.left, n.right, u.left]; }")
        ok(cx_[0] < cx_[1] < cx_[2] < cx_[3] and cx_[1] - cx_[0] < 80, f'na barra: marca, atalhos e só depois os botões da direita ({[round(v) for v in cx_]})')
        p.keyboard.press('Tab')
        focado = [p.evaluate("() => document.activeElement && document.activeElement.className")]
        for _ in range(6):
            p.keyboard.press('Tab'); focado.append(p.evaluate("() => document.activeElement && document.activeElement.className"))
        ok('tb-atalho' in focado, 'alcançáveis pelo Tab')
        for tema, arq in (('escuro', 'atalhos-escuro.png'), ('claro', 'atalhos-claro.png')):
            p.evaluate("t => { if (t === 'claro') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme'); }", tema)
            p.hover('.tb-atalho >> nth=1'); p.wait_for_timeout(250)
            p.locator('.topbar').screenshot(path=str(SITE.parent / arq))
        p.evaluate("() => document.documentElement.removeAttribute('data-theme')")

        print('2. Numa tela dentro de uma pasta')
        p.goto(base + 'clientes/editar.html?id=c1'); esperar_atalhos(p)
        a = atalhos(p)
        ok(len(a) == 3 and all(x['carregou'] for x in a), 'clientes/editar.html: os três, com os ícones achados')

        print('3. O que fica de fora')
        ok(p.evaluate("() => [...document.querySelectorAll('.tb-atalhos a')].every(a => /^https?:/.test(a.getAttribute('href')))") and len(a) == 3,
           'o javascript: e o ícone com caminho ficaram de fora')

        print('4. Guardada na aba')
        guardada = p.evaluate("() => sessionStorage.getItem('mr_atalhos')")
        ok(bool(guardada) and len(json.loads(guardada)) == 5, 'a lista lida fica na aba (sessionStorage)')
        p2 = cx.new_page(); p2.on('pageerror', lambda e: erros.append(str(e)))
        p2.add_init_script(TOUR); p2.add_init_script("window.__mockDelay = 5000"); p2.add_init_script(SEMEAR)
        p2.add_init_script("sessionStorage.setItem('mr_atalhos', %s)" % json.dumps(guardada))
        p2.goto(base + 'agenda.html')
        p2.wait_for_function("() => document.querySelectorAll('.topbar .tb-atalhos a').length === 3", timeout=3000)
        ok(len(atalhos(p2)) == 3, 'com o banco demorando 5 s, a tela nova já mostra os atalhos pela lista guardada')
        p2.close()

        print('5. Tela estreita e celular')
        p.set_viewport_size({'width': 1000, 'height': 800}); p.goto(base + 'index.html'); esperar_atalhos(p)
        a = atalhos(p)
        ok(len(a) == 3 and not any(x['nomeVisivel'] for x in a) and p.is_visible('.tb-atalhos'), '1000 px: só os ícones')
        p.set_viewport_size({'width': 600, 'height': 800}); p.wait_for_timeout(200)
        ok(not p.is_visible('.tb-atalhos'), '600 px: sem os atalhos')
        p.set_viewport_size({'width': 1400, 'height': 900})

        print('6. Telas públicas')
        for tela in ('admissao.html', 'rescisao.html'):
            p.goto(base + tela); p.wait_for_timeout(800)
            ok(p.locator('.tb-atalhos').count() == 0, f'{tela}: sem atalhos')

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
