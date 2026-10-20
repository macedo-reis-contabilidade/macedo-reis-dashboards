"""
O feed de notícias (20/10/2026, assets/js/noticias.js): o card do Painel, a aba "Notícias" do balão e a página
noticias.html. Sem login e sem banco (o mock do conferir.py; as fontes, as notícias e os clientes inventados entram por
uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/noticias.py

Confere, com 7 notícias inventadas (uma é a mesma de outra fonte, uma é antiga, uma foi descartada pela IA, uma tem
HTML no título):
  1. Painel (o Samuel, sócio): o card diz "3 novas" e "2 importantes" (a antiga e a de pouco efeito não contam);
  2. a aba Notícias: o número fica na barra das abas e não soma no balão; "Pra você" com as importantes e as que vale
     saber de todos os setores, sem a repetida (que aparece em "Também em") e sem a descartada; "Todas" com a de pouco
     efeito; o "nova" nas 3; o título com HTML sai como texto; abrir a aba grava o "visto" e zera o número;
  3. a Vitória (DP): "Pra você" só com as do DP; o recado da carinha com a importante nova, uma vez só;
  4. a página: "Desde a sua última visita", os filtros (setor, só as importantes, com as de pouco efeito, as descartadas,
     a fonte — que acha também a repetida —, só as que alcançam clientes, a busca), a lista dos clientes com o link da
     ficha, as fontes com a que falhou, "Coletar agora" (só os sócios) e o link de uma notícia repetida abrindo a
     principal com os clientes;
  5. a Thalia (fiscal): a página começa no setor Fiscal e sem "Coletar agora";
  6. no celular (390 px), nada passa da largura da tela;
e nenhum erro de JavaScript, nem o código do título inventado rodando. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

AGORA = datetime.datetime.now(datetime.timezone.utc)
def iso(**delta): return (AGORA - datetime.timedelta(**delta)).isoformat().replace('+00:00', 'Z')

FONTES = [
    {'id': 'fx1', 'nome': 'Receita Federal (teste)', 'tipo': 'oficial', 'site': 'https://receita.exemplo', 'url': 'https://receita.exemplo/rss', 'ativo': True,
     'ultima_coleta': iso(minutes=20), 'ultimo_ok': iso(minutes=20), 'ultimo_erro': None, 'itens_ultima': 6},
    {'id': 'fx2', 'nome': 'Portal Contábil (teste)', 'tipo': 'imprensa', 'site': 'https://portal.exemplo', 'url': 'https://portal.exemplo/feed', 'ativo': True,
     'ultima_coleta': iso(minutes=20), 'ultimo_ok': iso(minutes=20), 'ultimo_erro': None, 'itens_ultima': 30},
    {'id': 'fx3', 'nome': 'Entidade com erro (teste)', 'tipo': 'classe', 'site': 'https://entidade.exemplo', 'url': 'https://entidade.exemplo/feed', 'ativo': True,
     'ultima_coleta': iso(minutes=20), 'ultimo_ok': iso(days=2), 'ultimo_erro': 'HTTP 500', 'itens_ultima': 0},
]
def N(i, fonte, titulo, situacao='triada', relevancia='media', setores=(), publicada=None, triada=None, clientes=(), grupo=None, resumo=None, por_que=None, acao=None):
    return {'id': i, 'fonte_id': fonte, 'url': 'https://noticia.exemplo/' + i, 'titulo': titulo, 'publicada_em': publicada, 'coletada_em': publicada or iso(hours=1),
            'triada_em': triada or iso(hours=1), 'situacao': situacao, 'relevancia': relevancia if situacao == 'triada' else None, 'setores': list(setores),
            'resumo': resumo or ('Resumo de ' + titulo), 'por_que': por_que, 'acao': acao, 'clientes': list(clientes), 'grupo': grupo}
XSS = '<img src=x onerror="window.__xss=1"> Norma contábil nova (teste)'
NOTICIAS = [
    N('nx1', 'fx1', 'eSocial muda o leiaute (teste)', relevancia='alta', setores=['dp'], publicada=iso(hours=2), triada=iso(hours=1), clientes=['c1', 'c2'],
      por_que='Alcança as 2 empresas com funcionários.', acao='Conferir os eventos antes de 26/10.'),
    N('nx2', 'fx2', 'Portal: eSocial tem leiaute novo (teste)', relevancia='media', setores=['dp'], publicada=iso(hours=3), triada=iso(minutes=50), clientes=['c1'], grupo='nx1'),
    N('nx3', 'fx1', 'Prazo do PGDAS muda (teste)', relevancia='alta', setores=['fiscal'], publicada=iso(hours=5), triada=iso(hours=4), clientes=['c2'], acao='Avisar os clientes do Simples.'),
    N('nx4', 'fx2', XSS, relevancia='media', setores=['fiscal', 'contabil'], publicada=iso(days=1), triada=iso(hours=20), resumo='<b>negrito</b> & cia'),
    N('nx5', 'fx2', 'Dicas pra abrir empresa (teste)', relevancia='baixa', setores=['societario'], publicada=iso(days=1, hours=2), triada=iso(hours=20)),
    N('nx6', 'fx1', 'Antiga: mudança no FGTS (teste)', relevancia='alta', setores=['dp'], publicada=iso(days=10), triada=iso(hours=1)),
    N('nx7', 'fx2', 'Evento de contabilidade (teste)', situacao='descartada', publicada=iso(days=2), triada=iso(days=2)),
]
SEMEAR = """
(() => {
  const F = %s, N = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.noticias_fontes = F.map(x => ({ ...x })); v.noticias = N.map(x => ({ ...x })); v.noticias_visto = [];
  } });
  window.__mockInvoke = async (nome, op) => { (window.__invocados ||= []).push({ nome, body: op && op.body });
    return { data: { ok: true, novas: 3, triagem: { triadas: 2, descartadas: 1, restam: 0 }, segundos: 40 }, error: null }; };
})();
""" % (json.dumps(FONTES, ensure_ascii=False), json.dumps(NOTICIAS, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def nova_pagina(b, email=None, largura=1400, altura=900, espera_recado=None):
    p = b.new_page(viewport={'width': largura, 'height': altura})
    p.on('pageerror', lambda e: ERROS.append(str(e)))
    p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
    p.add_init_script(SEMEAR)
    if email: p.add_init_script("window.__mockEmail = %s;" % json.dumps(email))
    if espera_recado is not None: p.add_init_script("window.__noticiasEsperaMs = %d;" % espera_recado)
    return p

ERROS = []
def titulos(p, sel):
    return p.eval_on_selector_all(sel + ' .fd-item', 'xs => xs.map(x => x.dataset.id)')

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. O card do Painel (o Samuel)')
        p = nova_pagina(b)
        p.goto(base + 'index.html')
        p.wait_for_function("() => { const e = document.querySelector('a[href=\"noticias.html\"] .card-status'); return e && !e.classList.contains('st-load'); }", timeout=6000)
        st = p.text_content('a[href="noticias.html"] .card-status')
        pill = p.text_content('a[href="noticias.html"] .badge-hoje') if p.query_selector('a[href="noticias.html"] .badge-hoje') else ''
        ok(st == '3 novas', f'1. o card diz "3 novas" (a antiga, a de pouco efeito, a repetida e a descartada não contam) — "{st}"')
        ok(pill == '2 importantes', f'1. e "2 importantes" em destaque — "{pill}"')

        print('2. A aba Notícias do balão')
        p.wait_for_selector('.as-lancador', timeout=6000)
        p.click('.as-lancador'); p.wait_for_selector('.as-aba[data-aba="noticias"]', timeout=4000)
        p.wait_for_function("() => document.querySelector('.as-aba[data-aba=\"noticias\"] .as-aba-n').textContent === '3'", timeout=6000)
        ok(p.inner_text('.as-aba[data-aba="noticias"] .as-aba-n') == '3', '2. a barra das abas mostra "Notícias 3"')
        ok(p.is_hidden('.as-selo'), '2. o número das notícias não soma no balão (o balão é das mensagens)')
        p.click('.as-aba[data-aba="noticias"]')
        p.wait_for_selector('.fd-aba .fd-item', timeout=6000)
        ids = titulos(p, '.fd-aba')
        ok(ids == ['nx1', 'nx3', 'nx4', 'nx6'], f'2. "Pra você" (sócio): as importantes e as que vale saber de todos os setores, na ordem da publicação, sem a repetida e sem a descartada ({ids})')
        tambem = p.inner_text('.fd-aba .fd-item[data-id="nx1"] .fd-tambem')
        ok('Portal Contábil (teste)' in tambem, f'2. a repetida aparece em "Também em" na principal ("{tambem}")')
        novas = p.eval_on_selector_all('.fd-aba .fd-e-nova', 'xs => xs.map(x => x.dataset.id)')
        ok(novas == ['nx1', 'nx3', 'nx4'], f'2. o "nova" nas 3 novas (a antiga não) ({novas})')
        txt = p.inner_text('.fd-aba .fd-item[data-id="nx4"] .fd-titulo')
        ok(XSS in txt and p.evaluate('() => window.__xss') is None and not p.query_selector('.fd-aba .fd-item[data-id="nx4"] img'),
           '2. o título com HTML sai como texto (e o código dele não roda)')
        ok('<b>negrito</b> & cia' in p.inner_text('.fd-aba .fd-item[data-id="nx4"] .fd-resumo'), '2. o resumo também sai como texto')
        link = p.get_attribute('.fd-aba .fd-item[data-id="nx1"] .fd-clientes a', 'href') or ''
        ok(link.endswith('noticias.html?n=nx1') and 'Alcança 2 clientes' in p.inner_text('.fd-aba .fd-item[data-id="nx1"] .fd-clientes'),
           f'2. "Alcança 2 clientes da carteira" leva pra página na notícia ({link})')
        alvo = p.get_attribute('.fd-aba .fd-item[data-id="nx1"] .fd-titulo', 'target')
        ok(alvo == '_blank', '2. o título abre a notícia numa aba nova')
        p.click('.fd-aba .fd-filtro [data-f="todas"]')
        ids = titulos(p, '.fd-aba')
        ok(ids == ['nx1', 'nx3', 'nx4', 'nx5', 'nx6'], f'2. "Todas": entra a de pouco efeito (a descartada não) ({ids})')
        p.wait_for_function("() => (window.__mockDb.noticias_visto || []).some(v => v.email === 'financeiro@macedoereis.com.br')", timeout=5000)
        ok(True, '2. abrir a aba grava o "visto" de quem está na tela')
        p.click('.as-aba[data-aba="assistente"]')
        p.wait_for_function("() => document.querySelector('.as-aba[data-aba=\"noticias\"] .as-aba-n').hidden", timeout=5000)
        ok(True, '2. depois de ver, o número da aba zera')
        p.close()

        print('3. A Vitória (DP)')
        p = nova_pagina(b, 'rh@macedoereis.com.br', espera_recado=600)
        p.goto(base + 'index.html')
        p.wait_for_selector('.as-recado:not([hidden])', timeout=8000)
        recado = p.inner_text('.as-recado')
        ok('Notícia importante' in recado and 'eSocial muda o leiaute (teste)' in recado and 'PGDAS' not in recado,
           f'3. o recado da carinha com a importante nova do DP ("{recado[:120]}")')
        p.click('.as-recado .as-chip-acao:has-text("Ver as notícias")')
        p.wait_for_selector('.fd-aba .fd-item', timeout=6000)
        ids = titulos(p, '.fd-aba')
        ok(ids == ['nx1', 'nx6'], f'3. "Ver as notícias" abre a aba; "Pra você" só com as do DP ({ids})')
        avisadas = p.evaluate("() => JSON.parse(localStorage.getItem('mr_noticias_avisadas:rh@macedoereis.com.br') || '[]')")
        ok('nx1' in avisadas, '3. a notícia avisada fica guardada nesta máquina (não avisa de novo)')
        p.close()

        print('4. A página (o Samuel)')
        p = nova_pagina(b)
        p.goto(base + 'noticias.html')
        p.wait_for_selector('#fdLista .fd-item', timeout=6000)
        desde = p.inner_text('#fdDesde')
        ok(desde == 'Desde a sua última visita: 2 importantes e 1 que vale saber.', f'4. "{desde}"')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx3', 'nx4', 'nx6'], f'4. a lista começa com as importantes e as que vale saber ({titulos(p, "#fdLista")})')
        ok(len(p.query_selector_all('#fdLista .fd-dia')) >= 2, '4. a lista é separada por dia')
        ok(p.is_hidden('#fdMais'), '4. sem "Mostrar mais" quando cabe tudo')
        ok('Por que importa' in p.inner_text('#fdLista .fd-item[data-id="nx1"]'), '4. na página, o "Por que importa" aparece')
        p.click('#fdSetor [data-s="dp"]')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx6'], f'4. setor DP ({titulos(p, "#fdLista")})')
        p.click('#fdSetor [data-s=""]')
        p.select_option('#fdRel', 'a')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx3', 'nx6'], f'4. só as importantes ({titulos(p, "#fdLista")})')
        p.select_option('#fdRel', 'abc')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx3', 'nx4', 'nx5', 'nx6'], f'4. com as de pouco efeito ({titulos(p, "#fdLista")})')
        p.select_option('#fdRel', 'fora')
        p.wait_for_function("() => [...document.querySelectorAll('#fdLista .fd-item')].map(x => x.dataset.id).join() === 'nx7'", timeout=5000)
        ok('Descartada pela IA' in p.inner_text('#fdLista .fd-item[data-id="nx7"]'), '4. as descartadas pela IA, pra conferir')
        p.select_option('#fdRel', 'ab')
        p.wait_for_function("() => document.querySelectorAll('#fdLista .fd-item').length === 4", timeout=5000)
        p.select_option('#fdFonte', 'fx2')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx4'], f'4. a fonte acha também a notícia em que ela é a repetida ({titulos(p, "#fdLista")})')
        p.select_option('#fdFonte', '')
        p.check('#fdComClientes')
        ok(titulos(p, '#fdLista') == ['nx1', 'nx3'], f'4. só as que alcançam clientes ({titulos(p, "#fdLista")})')
        p.uncheck('#fdComClientes')
        p.fill('#fdBusca', 'pgdas')
        p.wait_for_function("() => document.querySelectorAll('#fdLista .fd-item').length === 1", timeout=3000)
        ok(titulos(p, '#fdLista') == ['nx3'], '4. a busca no título e no resumo (sem acento e sem maiúscula)')
        p.fill('#fdBusca', '')
        p.wait_for_function("() => document.querySelectorAll('#fdLista .fd-item').length === 4", timeout=3000)
        p.click('#fdLista .fd-item[data-id="nx1"] .fd-ver-clientes')
        p.wait_for_selector('.fd-lista-clientes[data-de="nx1"] a', timeout=4000)
        nomes = p.eval_on_selector_all('.fd-lista-clientes[data-de="nx1"] a', 'as => as.map(a => [a.textContent, a.getAttribute("href")])')
        ok(nomes == [['COMÉRCIO MODELO ME', 'clientes/editar.html?id=c1'], ['EMPRESA EXEMPLO LTDA', 'clientes/editar.html?id=c2']],
           f'4. os clientes que a notícia alcança, com o link da ficha ({nomes})')
        fontes = p.inner_text('#fdFontes')
        ok('Entidade com erro (teste)' in fontes and 'Falhou na última coleta' in fontes and p.query_selector('#fdFontes .fd-erro') is not None,
           '4. as fontes, com a que falhou na última coleta em destaque')
        ok(p.is_visible('#fdColetar'), '4. "Coletar agora" pros sócios')
        p.click('#fdColetar')
        p.wait_for_function("() => document.querySelector('#fdColetaMsg').textContent.startsWith('Pronto')", timeout=5000)
        msg = p.inner_text('#fdColetaMsg')
        inv = p.evaluate('() => window.__invocados')
        ok(msg == 'Pronto: 3 notícias novas, 3 lidas pela IA.' and inv and inv[0]['nome'] == 'noticias' and inv[0]['body'] == {'coletar': True}, f'4. "{msg}" ({inv})')
        p.wait_for_function("() => (window.__mockDb.noticias_visto || []).some(v => v.email === 'financeiro@macedoereis.com.br')", timeout=5000)
        ok(True, '4. abrir a página grava o "visto"')
        p.goto(base + 'noticias.html?n=nx2')
        p.wait_for_selector('.fd-item.fd-alvo', timeout=6000)
        ok(p.get_attribute('.fd-item.fd-alvo', 'data-id') == 'nx1' and p.is_visible('.fd-lista-clientes[data-de="nx1"] a'),
           '4. o link de uma notícia repetida abre a principal, em destaque, com os clientes')
        p.close()

        print('5. A Thalia (fiscal)')
        p = nova_pagina(b, 'fiscal@macedoereis.com.br')
        p.goto(base + 'noticias.html')
        p.wait_for_selector('#fdLista .fd-item', timeout=6000)
        ok(p.get_attribute('#fdSetor [data-s="fiscal"]', 'aria-pressed') == 'true' and titulos(p, '#fdLista') == ['nx3', 'nx4'],
           f'5. a página começa no setor Fiscal ({titulos(p, "#fdLista")})')
        ok(p.is_hidden('#fdColetaBloco'), '5. sem "Coletar agora" (é dos sócios)')
        ok(p.inner_text('#fdDesde') == 'Desde a sua última visita: 1 importante e 1 que vale saber pro seu setor.', f'5. "{p.inner_text("#fdDesde")}"')
        p.close()

        print('6. No celular')
        p = nova_pagina(b, largura=390, altura=820)
        p.goto(base + 'noticias.html')
        p.wait_for_selector('#fdLista .fd-item', timeout=6000)
        larg = p.evaluate('() => document.documentElement.scrollWidth')
        ok(larg <= 390, f'6. nada passa da largura da tela ({larg} px)')
        p.close()
        b.close()
    srv.shutdown()
    for e in ERROS: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(ERROS)} falha(s).' if falhas or ERROS else '\nTudo certo.')
    sys.exit(1 if falhas or ERROS else 0)

if __name__ == '__main__':
    main()
