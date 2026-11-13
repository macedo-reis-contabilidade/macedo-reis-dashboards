"""Teste da abertura do Painel central e do "mais alegria" (13/11/2026, pedido do Samuel): o Painel abre com "Bom dia,
<nome>", a data por extenso, a frase do dia, os números do dia (cada um com o seu caminho) e o anel do dia; os cards dos
painéis levam a cor do módulo e o número na frente; e cada pessoa tem a sua cor (a Agenda e o chat).
As contas do dia têm teste próprio (tests/painel-dia.test.mjs), os cards (tests/cards-painel.test.mjs), as cores das
pessoas (tests/cores-pessoas.test.mjs) e o contraste do tema (tests/tema-contraste.test.mjs); aqui, a tela.
Sem login e sem banco: o mock do conferir.py (quem está na tela é o Samuel, financeiro@, sócio), com o relógio parado
numa sexta-feira (13/11/2026) — as tarefas do banco falso são "de hoje" pelo relógio da página.

    python tests/harness/painel-bom-dia.py

Confere:
  1. a abertura do Samuel numa sexta à tarde: a data, a saudação com o nome, a frase, os números (pra hoje, atrasadas,
     avisos do vigia, mensagens da equipe), o anel (40%, 2 de 5 feitas, rotinas 1 de 2) e o card da Agenda;
  2. cada número leva ao seu lugar: "atrasadas" abre a revisão do assistente, "avisos do vigia" o cartão do vigia,
     "mensagens da equipe" a aba Equipe e "pra hoje" a Agenda;
  3. o que muda nas tarefas refaz a conta (o evento mr:tarefas-mudaram);
  4. a saudação pela hora (bom dia, boa noite) e o sábado sem rotina;
  5. cada um vê o seu: a Thalia (sem as de "Ambos"), o Diego (nada marcado: sem números, o anel com o traço);
  6. o login de fora da equipe: o primeiro nome da conta como texto (HTML não vira HTML), sem números; a leitura que
     falha: a frase de sempre, sem o anel;
  7. os cards: a cor do ícone no card (--cor), o número em <b> com o texto igual, o zero apagado, nos painéis dos setores
     também; o tema claro com o bronze e o contraste da data;
  8. cada pessoa com a sua cor: o responsável na Agenda (a bolinha com a inicial, o texto continua só o nome) e o avatar
     no chat; a data da Agenda por extenso do jeito da casa;
e sem erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, re, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

EU, TH, DI = 'financeiro@macedoereis.com.br', 'fiscal@macedoereis.com.br', 'diego@macedoereis.com.br'
SEXTA_TARDE, SEXTA_MANHA, SEXTA_NOITE, SABADO = '2026-11-13T14:00:00', '2026-11-13T09:00:00', '2026-11-13T19:30:00', '2026-11-14T10:00:00'
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def A(i, resp, situacao='aberto', grav='media'):
    return {'id': 'vg-' + i, 'chave': 'tarefa_sem_responsavel:' + i, 'regra': 'tarefa_sem_responsavel', 'titulo': 'Achado de teste ' + i, 'detalhe': 'Inventado pro teste.', 'setor': 'fiscal',
            'responsavel': resp, 'gravidade': grav, 'so_socios': False, 'cliente_id': None, 'ref_tabela': None, 'ref_id': None, 'link': 'fiscal-tarefas.html', 'prazo': None, 'situacao': situacao,
            'primeiro_visto': '2026-11-11T12:00:00+00:00', 'ultimo_visto': '2026-11-13T12:00:00+00:00', 'ignorado_em': None, 'ignorado_por': None}
# 2 do Samuel (o dele e o de "Ambos", que é dos sócios), 1 da Thalia e 1 dele já ignorado
ACHADOS = [A('1', 'Samuel', grav='alta'), A('2', 'Ambos'), A('3', 'Thalia'), A('4', 'Samuel', situacao='ignorado')]
# o chat: 2 mensagens não lidas da Thalia, e 5 num grupo silenciado (que não contam)
RESUMO = [
    {'conversa_id': 'c-th', 'tipo': 'direta', 'titulo': None, 'chave': EU + '|' + TH, 'ultima_em': '2026-11-13T13:50:00+00:00', 'lido_ate': '2026-11-13T12:00:00+00:00', 'silenciada': False, 'nao_lidas': 2,
     'membros': [EU, TH], 'ultima_autor': TH, 'ultima_texto': 'manda a guia da Adega?', 'ultima_anexos': 0, 'ultima_apagada': False},
    {'conversa_id': 'c-g1', 'tipo': 'grupo', 'titulo': 'Fiscal e DP', 'chave': None, 'ultima_em': '2026-11-13T13:00:00+00:00', 'lido_ate': '2026-11-13T09:00:00+00:00', 'silenciada': True, 'nao_lidas': 5,
     'membros': [EU, TH], 'ultima_autor': TH, 'ultima_texto': 'Folha fechada.', 'ultima_anexos': 0, 'ultima_apagada': False}]
SEMEAR = """
(() => {
  const ACHADOS = %s, RESUMO = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.vigia_achados = ACHADOS.map(a => ({ ...a })); v.chat_conversas = []; v.chat_membros = []; v.chat_mensagens = [];
  } });
  window.__mockRpc = (nome) => {
    if (nome === 'chat_preparar') return { data: 'c-esc', error: null };
    if (nome === 'chat_resumo') return { data: RESUMO, error: null };
    if (nome === 'chat_pessoas') return { data: ['%s', '%s'], error: null };
    return { data: [], error: null };
  };
})();
""" % (json.dumps(ACHADOS, ensure_ascii=False), json.dumps(RESUMO, ensure_ascii=False), EU, TH)

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

ABERTURA = """() => {
  const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  const chips = [...document.querySelectorAll('#pnChips .pn-chip')].map(c => ({ id: c.id, texto: c.textContent.replace(/\\s+/g, ' ').trim(), n: c.querySelector('b').textContent, tag: c.tagName, href: c.getAttribute('href') }));
  const anel = document.getElementById('pnAnel'), arco = document.getElementById('pnAnelArco');
  const st = document.querySelector('a.dashboard-card[href="agenda.html"] .card-status');
  return { data: t('pnData'), ola: t('pnOla'), nome: (document.querySelector('#pnOla em') || {}).textContent || null, frase: t('pnFrase'), chips,
    lendo: document.getElementById('pnChips').classList.contains('is-lendo'), chipsVisiveis: getComputedStyle(document.getElementById('pnChips')).display !== 'none',
    anel: anel.hidden ? null : { pct: t('pnAnelPct'), n: t('pnAnelN'), s: t('pnAnelS'), rotulo: anel.getAttribute('aria-label'), href: anel.getAttribute('href'),
      arco: getComputedStyle(arco).strokeDasharray.split(/[ ,]+/).map(parseFloat), arcoVisivel: getComputedStyle(arco).visibility === 'visible' },
    agenda: st ? { texto: st.textContent.trim(), classe: st.className, b: (st.querySelector('b') || {}).textContent || null } : null };
}"""
# as cores que a tela desenhou, com o contraste de verdade: a cor pode vir como rgb(…) ou color(srgb …), e o fundo com
# transparência é posto por cima do que está atrás dele (o número, sobre o fundo dele, sobre o do botão, sobre o da tela)
CORES_DA_ABERTURA = """() => {
  const ler = c => { const n = c.match(/-?[\\d.]+(?:e-?\\d+)?/g).map(Number), k = /^color\\(/.test(c) ? 1 : 255; return { r: n[0] / k, g: n[1] / k, b: n[2] / k, a: n[3] == null ? 1 : n[3] }; };
  const sobre = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = c => { const [r, g, b] = [c.r, c.g, c.b].map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ct = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const cs = (el, prop) => ler(getComputedStyle(el)[prop]);
  const fundo = cs(document.body, 'backgroundColor'), q = s => document.querySelector(s);
  return { tema: document.documentElement.dataset.theme || 'dark', sol: getComputedStyle(document.documentElement).getPropertyValue('--sol').trim(), nome: getComputedStyle(q('#pnOla em')).color,
    data: ct(cs(q('#pnData'), 'color'), fundo), frase: ct(cs(q('#pnFrase'), 'color'), fundo),
    chips: [...document.querySelectorAll('#pnChips .pn-chip')].map(c => { const b = c.querySelector('b'), atras = sobre(cs(c, 'backgroundColor'), fundo); return ct(cs(b, 'color'), sobre(cs(b, 'backgroundColor'), atras)); }) };
}"""
def pronta(p):
    p.wait_for_function("() => !document.getElementById('pnChips').classList.contains('is-lendo')", timeout=8000)
    p.wait_for_timeout(1300)   # o anel enche em 0,9 s
    return p.evaluate(ABERTURA)

def fechar_painel(p):
    p.click('.as-acao[data-a="fechar"]')
    p.wait_for_selector('.as-painel', state='hidden', timeout=4000)

def nova(b, relogio, extra=None, email=None):
    p = b.new_page(viewport={'width': 1440, 'height': 900})
    p.clock.set_fixed_time(relogio)
    p.add_init_script(TOUR)
    if email: p.add_init_script("window.__mockEmail = '%s'" % email)
    if extra: p.add_init_script(extra)
    return p

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        def pagina(*a, **k):
            p = nova(b, *a, **k)
            p.on('pageerror', lambda e: erros.append(str(e)))
            return p

        print('1. A abertura do Samuel, sexta à tarde')
        p = pagina(SEXTA_TARDE, extra=SEMEAR)
        p.goto(base + 'index.html')
        p.wait_for_selector('#pnEquipe', timeout=10000)   # o número das mensagens vem do balão, que monta depois
        a = pronta(p)
        ok(a['data'] == 'Sexta-feira, 13 de Novembro', f'a data por extenso, do jeito da casa ("{a["data"]}")')
        ok(a['ola'] == 'Boa tarde, Samuel.' and a['nome'] == 'Samuel', f'a saudação com o nome ("{a["ola"]}")')
        # o banco falso: 3 tarefas do Samuel pra hoje (1 concluída) e 2 rotinas (1 feita); 2 atrasadas, a mais antiga de 10 dias atrás
        ok(a['frase'] == 'Faltam 3 tarefas pra fechar o dia. Tem 2 atrasadas, a mais antiga de 03/11: que tal começar por elas?', f'a frase do dia ("{a["frase"]}")')
        ch = {c['id']: c for c in a['chips']}
        ok([c['id'] for c in a['chips']] == ['pnHoje', 'pnAtrasadas', 'pnVigia', 'pnEquipe'], f'os quatro números, nesta ordem ({[c["id"] for c in a["chips"]]})')
        ok(ch.get('pnHoje', {}).get('texto') == '3 pra hoje' and ch['pnHoje']['tag'] == 'A' and ch['pnHoje']['href'] == 'agenda.html', '"3 pra hoje" é um link pra Agenda')
        ok(ch.get('pnAtrasadas', {}).get('texto') == '2 atrasadas' and ch['pnAtrasadas']['tag'] == 'BUTTON', '"2 atrasadas"')
        ok(ch.get('pnVigia', {}).get('texto') == '2 avisos do vigia', f'"2 avisos do vigia": o dele e o de "Ambos", sem o da Thalia e o ignorado ({ch.get("pnVigia", {}).get("texto")})')
        ok(ch.get('pnEquipe', {}).get('texto') == '2 mensagens da equipe', f'"2 mensagens da equipe": sem as do grupo silenciado ({ch.get("pnEquipe", {}).get("texto")})')
        an = a['anel']
        ok(an is not None and an['pct'] == '40%' and an['n'] == '2 de 5 feitas' and an['s'] == 'rotinas 1 de 2', f'o anel: {an and (an["pct"], an["n"], an["s"])}')
        ok(an is not None and an['arcoVisivel'] and abs(an['arco'][0] - 75.4) < 0.2 and abs(an['arco'][1] - 188.5) < 0.2, f'o arco do anel em 40% da volta ({an and an["arco"]})')
        ok(an is not None and an['href'] == 'agenda.html' and an['rotulo'] == 'Seu dia: 2 de 5 feitas (40%), rotinas 1 de 2. Abrir a Agenda', f'o anel leva à Agenda e diz o que mostra ("{an and an["rotulo"]}")')
        ok(a['agenda'] == {'texto': '3 pra hoje', 'classe': 'badge card-status st-open', 'b': '3'}, f'o card da Agenda: {a["agenda"]}')
        ok(p.evaluate("() => document.querySelector('.pn-hero').getBoundingClientRect().bottom < document.querySelector('.dashboard-grid').getBoundingClientRect().top") , 'a abertura fica acima dos cards')
        ok(p.evaluate("() => getComputedStyle(document.querySelector('.dashboard-grid')).gridTemplateColumns.split(' ').length") == 3, 'os cards em três colunas')
        ok(p.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth"), 'sem rolagem pro lado')

        print('2. Cada número leva ao seu lugar')
        p.click('#pnAtrasadas')
        p.wait_for_selector('.as-painel:not([hidden]) .as-cartao', timeout=6000)
        ok('Vamos passar as suas atrasadas a limpo' in p.inner_text('.as-lista'), '"atrasadas" abre a revisão do assistente')
        fechar_painel(p)
        p.click('#pnVigia')
        p.wait_for_function("() => document.querySelector('.as-lista') && document.querySelector('.as-lista').innerText.includes('O que o vigia achou pra você conferir')", timeout=6000)
        p.wait_for_function("() => [...document.querySelectorAll('.as-cartao')].some(c => c.innerText.includes('Achado de teste 1'))", timeout=6000)
        ok(True, '"avisos do vigia" abre o cartão do vigia com os de quem entrou')
        ok(p.evaluate("() => !new URLSearchParams(location.search).has('vigia')"), 'sem recarregar a tela (o endereço segue o mesmo)')
        fechar_painel(p)
        p.click('#pnEquipe')
        p.wait_for_selector('.as-painel:not([hidden]) .as-vista[data-aba="equipe"]:not([hidden])', timeout=6000)
        ok(p.evaluate("() => document.querySelector('.as-aba.as-aba-atual').dataset.aba") == 'equipe', '"mensagens da equipe" abre a aba Equipe do balão')
        ok(p.evaluate("() => { const av = document.querySelector('.as-vista[data-aba=\"equipe\"] .ch-avatar[style*=\"--p\"]'); return av ? av.style.getPropertyValue('--p') : null; }") == '#F08FB8',
           '8. no chat, o avatar da Thalia com a cor dela')
        fechar_painel(p)

        print('3. O que muda nas tarefas refaz a conta')
        p.evaluate("() => { const t = window.__mockDb.tarefas.find(x => x.id === 't32'); t.status = 'concluida'; window.dispatchEvent(new CustomEvent('mr:tarefas-mudaram', { detail: { ids: ['t32'] } })); }")
        p.wait_for_function("() => document.getElementById('pnAnelN').textContent === '3 de 5 feitas'", timeout=6000)
        a = pronta(p)
        ok(a['anel']['pct'] == '60%' and a['frase'].startswith('Faltam 2 tarefas pra fechar o dia.') and a['chips'][0]['texto'] == '2 pra hoje' and a['agenda']['texto'] == '2 pra hoje',
           f'concluída uma: 60%, faltam 2, no número e no card da Agenda ({a["anel"]["pct"]}, "{a["chips"][0]["texto"]}", "{a["agenda"]["texto"]}")')
        ok(any(c['id'] == 'pnEquipe' and c['texto'] == '2 mensagens da equipe' for c in a['chips']), 'e o número das mensagens continua lá')
        with p.expect_navigation():
            p.click('#pnHoje')
        ok(p.url.endswith('/agenda.html'), '2. "pra hoje" leva à Agenda')
        p.wait_for_function("() => document.getElementById('agPeriodo').textContent.trim().length > 3", timeout=8000)
        ok(p.text_content('#agPeriodo') == 'Sexta-feira, 13 de Novembro', f'8. a data da Agenda por extenso, do jeito da casa ("{p.text_content("#agPeriodo")}")')
        p.wait_for_selector('.ag-card-meta .pessoa-chip', timeout=8000)
        chip = p.evaluate("() => { const c = [...document.querySelectorAll('.pessoa-chip')].find(x => x.textContent === 'Samuel'); return c ? { p: c.style.getPropertyValue('--p'), i: c.dataset.i, antes: getComputedStyle(c, '::before').content } : null; }")
        ok(chip == {'p': '#6CA6EA', 'i': 'S', 'antes': '"S"'}, f'8. na Agenda, o responsável com a cor e a inicial dele; o texto segue só o nome ({chip})')
        p.close()

        print('4. A saudação pela hora, e o sábado')
        p = pagina(SEXTA_MANHA); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['ola'] == 'Bom dia, Samuel.', f'de manhã ("{a["ola"]}")')
        ok([c['id'] for c in a['chips']] == ['pnHoje', 'pnAtrasadas'], 'sem aviso do vigia e sem mensagem nova, só os dois números do dia')
        p.close()
        p = pagina(SEXTA_NOITE); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['ola'] == 'Boa noite, Samuel.', f'à noite ("{a["ola"]}")')
        p.close()
        p = pagina(SABADO); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['data'] == 'Sábado, 14 de Novembro' and a['anel']['n'] == '1 de 3 feitas' and a['anel']['s'] == 'faltam 2' and a['anel']['pct'] == '33%',
           f'no sábado não tem rotina: só as 3 tarefas do dia ({a["data"]}, {a["anel"]["n"]}, {a["anel"]["s"]})')
        p.close()

        print('5. Cada um vê o seu')
        p = pagina(SEXTA_TARDE, email=TH); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['ola'] == 'Boa tarde, Thalia.' and a['frase'] == 'Faltam 4 tarefas pra fechar o dia.', f'a Thalia: as 4 dela, nenhuma atrasada ("{a["frase"]}")')
        ok([c['texto'] for c in a['chips']] == ['4 pra hoje'] and a['anel']['pct'] == '0%' and a['anel']['n'] == '0 de 4 feitas' and a['anel']['s'] == 'faltam 4' and not a['anel']['arcoVisivel'],
           f'um número só, e o anel vazio sem o ponto do começo ({[c["texto"] for c in a["chips"]]}, {a["anel"]["pct"]})')
        p.close()
        p = pagina(SEXTA_TARDE, email=DI); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['ola'] == 'Boa tarde, Diego.' and a['frase'] == 'Nada marcado pra hoje e nenhuma atrasada. Dia livre pra adiantar a semana.', f'o Diego, sem nada ("{a["frase"]}")')
        ok(a['chips'] == [] and not a['chipsVisiveis'] and a['anel']['pct'] == '—' and a['anel']['n'] == 'Nada marcado' and a['anel']['s'] == 'pra hoje', f'sem números, e o anel com o traço ({a["anel"]})')
        ok(a['agenda'] == {'texto': 'Em dia', 'classe': 'badge card-status st-clear', 'b': None}, f'o card da Agenda em dia ({a["agenda"]})')
        p.close()

        print('6. O login de fora da equipe e a leitura que falha')
        conta = {'logado': True, 'email': 'novo@macedoereis.com.br', 'meta': {'full_name': '<img src=x onerror=window.__xss=1> Fulano'}, 'senhas': {}, 'log': []}
        p = pagina(SEXTA_TARDE, extra="sessionStorage.setItem('mock_auth', %s)" % json.dumps(json.dumps(conta)))
        p.goto(base + 'index.html'); a = pronta(p)
        ok(a['nome'] == '<img' and a['ola'] == 'Boa tarde, <img.' and not p.query_selector('#pnOla img') and not p.evaluate('() => window.__xss'), f'o nome da conta entra como texto ("{a["ola"]}")')
        ok(a['frase'] == 'Tudo do escritório num lugar só.' and a['chips'] == [] and a['anel'] is None and a['agenda']['texto'] == '—', f'sem números pra quem não é da equipe ("{a["frase"]}", {a["agenda"]})')
        p.close()
        p = pagina(SEXTA_TARDE, extra="window.__mockErroTabela = { rotinas: 'fora do ar' }"); p.goto(base + 'index.html'); a = pronta(p)
        ok(a['ola'] == 'Boa tarde, Samuel.' and a['frase'] == 'Tudo do escritório num lugar só.' and a['anel'] is None and a['chips'] == [], f'a leitura falhou: a frase de sempre, sem número e sem anel ("{a["frase"]}")')
        p.close()

        print('7. Os cards, nos dois temas')
        p = pagina(SEXTA_TARDE); p.goto(base + 'index.html'); pronta(p)
        cards = p.evaluate("""() => [...document.querySelectorAll('.dashboard-card')].map(c => { const st = c.querySelector('.card-status'), ic = c.querySelector('.dashboard-card-icon');
          return { href: c.getAttribute('href'), cor: c.style.getPropertyValue('--cor'), icone: getComputedStyle(ic).color, texto: st ? st.textContent.trim() : null, b: st && st.querySelector('b') ? st.querySelector('b').textContent : null,
            desc: c.querySelector('p').title, linhas: Math.round(c.querySelector('p').getBoundingClientRect().height / parseFloat(getComputedStyle(c.querySelector('p')).lineHeight)) }; })""")
        ok(len(cards) == 6 and all(c['cor'] and c['cor'] == c['icone'] for c in cards), f'cada card com a cor do próprio ícone ({[c["cor"] for c in cards]})')
        ok(len(set(c['cor'] for c in cards)) == 6, 'e as seis cores são diferentes')
        com_num = [c for c in cards if c['texto'] and re.match(r'^\d', c['texto'])]
        ok(len(com_num) >= 2 and all(c['b'] and c['texto'].startswith(c['b'] + ' ') for c in com_num), f'o número na frente, em <b>, com o texto igual ({[c["texto"] for c in com_num]})')
        ok(all(c['desc'] and c['linhas'] <= 2 for c in cards), 'a descrição em até duas linhas, inteira no title')
        tema = p.evaluate(CORES_DA_ABERTURA)
        ok(tema['tema'] != 'light' and tema['sol'].upper() == '#E9C39C' and tema['nome'] == 'rgb(233, 195, 156)', f'no tema escuro, o nome em champanhe ({tema["sol"]}, {tema["nome"]})')
        ok(min(tema['data'], tema['frase'], *tema['chips']) >= 4.5, f'a data, a frase e os números leem no escuro ({tema["data"]:.1f}, {tema["frase"]:.1f} e {[round(c, 1) for c in tema["chips"]]} pra 1)')
        p.evaluate("() => localStorage.setItem('mr_tema', 'claro')")
        p.goto(base + 'index.html'); a = pronta(p)
        claro = p.evaluate(CORES_DA_ABERTURA)
        ok(claro['tema'] == 'light' and claro['sol'].upper() == '#8C5A26' and claro['nome'] == 'rgb(140, 90, 38)', f'no tema claro, o nome no bronze da logo ({claro["sol"]}, {claro["nome"]})')
        ok(min(claro['data'], claro['frase'], *claro['chips']) >= 4.5, f'a data, a frase e os números leem no claro ({claro["data"]:.1f}, {claro["frase"]:.1f} e {[round(c, 1) for c in claro["chips"]]} pra 1)')
        ok(a['ola'] == 'Boa tarde, Samuel.' and a['anel']['pct'] == '40%' and len(claro['chips']) == 2, 'e a abertura é a mesma')
        p.evaluate("() => localStorage.removeItem('mr_tema')")
        p.goto(base + 'fiscal.html')
        p.wait_for_function("() => { const e = document.querySelector('.card-status[data-mod=\"fiscal-tarefas.html\"]'); return e && !e.classList.contains('st-load'); }", timeout=8000)
        p.wait_for_timeout(400)
        hub = p.evaluate("""() => [...document.querySelectorAll('.dashboard-card')].map(c => { const st = c.querySelector('.card-status'), b = st && st.querySelector('b');
          return { cor: c.style.getPropertyValue('--cor'), texto: st ? st.textContent.trim() : null, b: b ? b.textContent : null, zero: !!(b && b.hasAttribute('data-zero')) }; })""")
        num = [c for c in hub if c['b'] is not None]
        ok(len(hub) >= 8 and sum(1 for c in hub if c['cor']) >= 8, f'no painel do Fiscal, os cards com a cor do módulo ({sum(1 for c in hub if c["cor"])} de {len(hub)})')
        ok(len(num) >= 4 and all(c['texto'].startswith(c['b'] + ' ') for c in num) and all(c['zero'] == (c['b'] == '0') for c in num), f'os números na frente, o zero apagado ({[c["texto"] for c in num]})')
        p.close()
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
