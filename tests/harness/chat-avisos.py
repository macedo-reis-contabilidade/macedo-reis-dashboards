"""Teste dos avisos do sistema no chat da equipe (assets/js/chat-equipe.js, 20/10/2026, pedido do Samuel: "sendo poucas
coisas, as que interessam mesmo, e podendo silenciar"): a conversa "Avisos do sistema" (um grupo só da pessoa, chave
'avisos|<e-mail>', que o banco cria no primeiro aviso — chat_avisar, gatilhos nas tarefas) na lista com o sininho e as não
lidas; aberta, só pra ler (no lugar da caixa, a nota; sem "Responder" nem o nome de quem mandou), com o botão de cada aviso
(só tela do sistema: o endereço de fora não vira botão) e o menu só com o silenciar; a outra conversa volta a ter a caixa; o
aviso que chega com o painel fechado mostra o recado com o botão dele, que abre a tela (a Agenda com a tarefa aberta, pelo
link ?tarefa=); com a tela atrás, o aviso do Windows; silenciada, nada; e a conversa que nasce com o primeiro aviso aparece
com o número certo (1, não 2) e um aviso só, com o botão — nas duas ordens em que o tempo real pode entregar a conversa e a
mensagem. O banco do chat entra como dublê, como no chat-equipe.py; o SQL tem teste próprio (Postgres local). Quem está na
tela é o Samuel (financeiro@).

    python tests/harness/chat-avisos.py

Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

AGORA = datetime.datetime.now(datetime.timezone.utc)
T = lambda minutos: (AGORA - datetime.timedelta(minutes=minutos)).isoformat().replace('+00:00', 'Z')
EU, TH = 'financeiro@macedoereis.com.br', 'fiscal@macedoereis.com.br'
CONVERSAS = [
    {'id': 'c-th', 'tipo': 'direta', 'titulo': None, 'chave': EU + '|' + TH, 'criada_por': TH, 'criada_em': T(2000), 'ultima_em': T(60)},
    {'id': 'c-av', 'tipo': 'grupo', 'titulo': 'Avisos do sistema', 'chave': 'avisos|' + EU, 'criada_por': 'sistema', 'criada_em': T(1000), 'ultima_em': T(5)}]
MEMBROS = [{'conversa_id': 'c-th', 'email': EU, 'lido_ate': T(50), 'silenciada': False}, {'conversa_id': 'c-th', 'email': TH, 'lido_ate': T(50), 'silenciada': False},
           {'conversa_id': 'c-av', 'email': EU, 'lido_ate': T(40), 'silenciada': False}]
M = lambda i, conv, autor, texto, minutos, **x: {'id': i, 'conversa_id': conv, 'autor': autor, 'texto': texto, 'anexos': [], 'criada_em': T(minutos), 'apagada_em': None, 'responde_a': None, 'acao': None, **x}
MENSAGENS = [
    M('m1', 'c-th', TH, 'Bom dia!', 60),
    M('a1', 'c-av', 'sistema', 'Thalia te passou uma tarefa: Enviar guias do mês — EMPRESA EXEMPLO LTDA · prazo 20/10.', 45, acao={'rotulo': 'Abrir a tarefa', 'link': 'agenda.html?tarefa=t1'}),
    M('a2', 'c-av', 'sistema', 'Chegou uma proposta pelo formulário: PADARIA FICTÍCIA LTDA.', 20, acao={'rotulo': 'Abrir a proposta', 'link': 'comercial-precificacao.html?proposta=pp1'}),
    M('a3', 'c-av', 'sistema', 'Aviso com um endereço de fora.', 5, acao={'rotulo': 'Abrir', 'link': 'https://fora.com/x.html'})]
SEMEAR = """
(() => {
  const CONV = %s, MEMB = %s, MSGS = %s;
  const EU = '%s', PESSOAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.chat_conversas = CONV; v.chat_membros = MEMB; v.chat_mensagens = MSGS;
  } });
  const agora = () => new Date().toISOString();
  window.__mockAntesDeInserir = (t, r) => {
    if (t !== 'chat_mensagens') return;
    r.autor = EU; r.criada_em = agora(); r.apagada_em = null; r.anexos = r.anexos || []; r.acao = null;
    const c = db.chat_conversas.find(x => x.id === r.conversa_id); if (c) c.ultima_em = r.criada_em;
    const m = db.chat_membros.find(x => x.conversa_id === r.conversa_id && x.email === EU); if (m) m.lido_ate = r.criada_em;
  };
  window.__rpcs = [];
  const resumo = () => db.chat_membros.filter(m => m.email === EU).map(eu => {
    const c = db.chat_conversas.find(x => x.id === eu.conversa_id);
    const ms = db.chat_mensagens.filter(m => m.conversa_id === c.id).sort((a, b) => a.criada_em.localeCompare(b.criada_em)), u = ms[ms.length - 1];
    return { conversa_id: c.id, tipo: c.tipo, titulo: c.titulo, chave: c.chave, ultima_em: u ? u.criada_em : c.ultima_em, lido_ate: eu.lido_ate, silenciada: !!eu.silenciada,
      nao_lidas: ms.filter(m => m.autor !== EU && !m.apagada_em && m.criada_em > eu.lido_ate).length, membros: db.chat_membros.filter(o => o.conversa_id === c.id).map(o => o.email).sort(),
      ultima_autor: u ? u.autor : null, ultima_texto: u ? u.texto : null, ultima_anexos: u ? (u.anexos || []).length : 0, ultima_apagada: u ? !!u.apagada_em : false };
  });
  window.__mockRpc = (nome, a) => {
    window.__rpcs.push({ nome, a: JSON.parse(JSON.stringify(a || {})) });
    if (nome === 'chat_preparar') return { data: null, error: null };
    if (nome === 'chat_resumo') return { data: resumo(), error: null };
    if (nome === 'chat_pessoas') return { data: PESSOAS, error: null };
    return { data: [], error: null };
  };
  window.__avisos = []; addEventListener('mr:chat-aviso', e => window.__avisos.push(e.detail));
  window.__notificacoes = [];
  window.__permissao = window.__permissao || 'granted';
  window.Notification = class { constructor(t, o) { window.__notificacoes.push({ titulo: t, ...o }); window.__ultimaNotificacao = this; }
    close() {} static get permission() { return window.__permissao; } static async requestPermission() { window.__permissao = 'granted'; return 'granted'; } };
  window.__naFrente = true; document.hasFocus = () => window.__naFrente;
})();
""" % (json.dumps(CONVERSAS, ensure_ascii=False), json.dumps(MEMBROS, ensure_ascii=False), json.dumps(MENSAGENS, ensure_ascii=False), EU, json.dumps(sorted([EU, TH])))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        db = lambda js: p.evaluate('() => ' + js)
        emitir = lambda tabela, ev, linha: p.evaluate('([t, e, l]) => window.__mockEmitir(t, e, l)', [tabela, ev, linha])
        agora = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
        def aviso(i, texto, acao=None, conv='c-av', emitir_ja=True):
            linha = {'id': i, 'conversa_id': conv, 'autor': 'sistema', 'texto': texto, 'anexos': [], 'criada_em': agora(), 'apagada_em': None, 'responde_a': None, 'acao': acao}
            p.evaluate('l => { window.__mockDb.chat_mensagens.push(l); const c = window.__mockDb.chat_conversas.find(c => c.id === l.conversa_id); if (c) c.ultima_em = l.criada_em; }', linha)
            if emitir_ja: emitir('chat_mensagens', 'INSERT', linha); p.wait_for_timeout(250)
            return linha
        linha_av = '.ch-linha[data-conversa="c-av"]'
        # o painel pequeno mostra uma coluna só: da conversa, volta pra lista antes de clicar noutra
        def pra_lista():
            if p.is_visible('.ch-v-conversa .ch-voltar[data-ch="voltar"]'): p.click('.ch-v-conversa .ch-voltar[data-ch="voltar"]')

        # 1) a lista: a conversa de avisos com o sininho, o último aviso e as não lidas
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=6000)
        p.wait_for_function("() => !document.querySelector('.as-selo').hidden", timeout=6000)
        ok(p.inner_text('.as-selo') == '2', f'o balão com os 2 avisos não lidos ({p.inner_text(".as-selo")!r})')
        p.click('.as-lancador'); p.click('.as-aba[data-aba="equipe"]'); p.wait_for_selector(linha_av, timeout=3000)
        nomes = p.eval_on_selector_all('.ch-conversas .ch-linha b', 'bs => bs.map(b => b.textContent)')
        ok(nomes[:2] == ['Avisos do sistema', 'Thalia'], f'"Avisos do sistema" na lista, pela hora do último aviso ({nomes})')
        txt = p.inner_text(linha_av)
        ok(p.query_selector(linha_av + ' .ch-avatar-avisos svg') and 'Aviso com um endereço de fora.' in txt and 'Sistema:' not in txt and p.inner_text(linha_av + ' .ch-n') == '2',
           f'a linha: o sininho, o último aviso (sem "Sistema:" na frente) e 2 novos ({txt!r})')

        # 2) aberta: só pra ler — a nota no lugar da caixa, o botão de cada aviso, sem "Responder" nem o nome
        p.click(linha_av); p.wait_for_selector('.ch-v-conversa:not([hidden]) .ch-msg[data-id="a3"]', timeout=3000)
        ok(p.inner_text('.ch-v-conversa .ch-cab-quem') == 'Avisos do sistema\nSó pra ler', f'o topo: "Avisos do sistema", só pra ler ({p.inner_text(".ch-v-conversa .ch-cab-quem")!r})')
        ok(p.is_hidden('.ch-entrada') and p.is_visible('.ch-so-ler') and 'não dá pra responder' in p.inner_text('.ch-so-ler'), 'no lugar da caixa, a nota de que é só pra ler (e como silenciar)')
        hrefs = p.eval_on_selector_all('.ch-msgs a.ch-acao', 'as => as.map(a => [a.closest(".ch-msg").dataset.id, a.textContent, a.getAttribute("href")])')
        ok(hrefs == [['a1', 'Abrir a tarefa', base + 'agenda.html?tarefa=t1'], ['a2', 'Abrir a proposta', base + 'comercial-precificacao.html?proposta=pp1']],
           f'cada aviso com o botão da tela dele; o endereço de fora não vira botão ({hrefs})')
        ok(p.locator('.ch-msgs [data-ch="responder"]').count() == 0 and p.locator('.ch-msgs [data-ch="apagar"]').count() == 0 and p.locator('.ch-msgs .ch-autor').count() == 0,
           'sem "Responder", sem "Apagar" e sem o nome de quem mandou em cima')
        ok(p.evaluate("() => { const n = document.querySelector('.ch-novas'); return !!n && n.nextElementSibling.dataset.id === 'a2'; }"), 'o "Novas" antes do primeiro aviso não lido')
        p.wait_for_function("() => document.querySelector('.as-selo').hidden", timeout=3000)
        lido = db("window.__mockDb.chat_membros.find(m => m.conversa_id === 'c-av').lido_ate")
        ok(lido == MENSAGENS[3]['criada_em'], f'leu até o último aviso (o balão sem número) ({lido})')
        p.click('[data-ch="menu"]')
        itens = p.eval_on_selector_all('.ch-menu .ch-menu-item', 'bs => bs.map(b => b.textContent)')
        ok(itens == ['Silenciar (sem bipe nem aviso do Windows)'], f'o menu: só o silenciar (nada de pessoas nem nome do grupo) ({itens})')
        p.keyboard.press('Escape')

        # 3) a outra conversa volta a ter a caixa
        pra_lista(); p.click('.ch-linha[data-conversa="c-th"]'); p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Thalia'", timeout=3000)
        ok(p.is_visible('.ch-entrada textarea') and p.is_hidden('.ch-so-ler'), 'a conversa com a Thalia: a caixa de volta, sem a nota')

        # 4) chega um aviso com o painel fechado: o recado com o botão dele e o bipe; o botão abre a tela (a Agenda com a tarefa)
        p.click('.as-acao[data-a="fechar"]')
        aviso('a4', 'Diego te passou uma tarefa: Enviar guias do mês · prazo 20/10.', {'rotulo': 'Abrir a tarefa', 'link': 'agenda.html?tarefa=t1'})
        p.wait_for_selector('.as-recado:not([hidden])', timeout=3000)
        rec = p.inner_text('.as-recado')
        ok('Avisos do sistema' in rec and 'Diego te passou uma tarefa' in rec and p.inner_text('.as-recado .as-chip-acao') == 'Abrir a tarefa' and p.inner_text('.as-selo') == '1'
           and db('window.__avisos.slice(-1)[0].tipo') == 'bipe', f'painel fechado: o recado com o aviso e o botão dele, o bipe e o número ({rec!r})')
        with p.expect_navigation(timeout=6000):
            p.click('.as-recado .as-chip-acao')
        ok(p.url == base + 'agenda.html?tarefa=t1', f'o botão abre a tela do aviso ({p.url})')
        p.wait_for_selector('#detOverlay.is-open', timeout=6000)
        ok(p.inner_text('#dTipo') == 'Enviar guias do mês', f'a Agenda abre com a tarefa do link aberta ({p.inner_text("#dTipo")!r})')
        p.goto(base + 'agenda.html?tarefa=nao-existe'); p.wait_for_timeout(1500)
        ok(p.query_selector('#detOverlay.is-open') is None, 'tarefa que não existe: a Agenda abre normal, sem janela')

        # 5) a tela atrás: o aviso do Windows com o título da conversa e o aviso
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=6000); p.wait_for_timeout(600)
        p.evaluate('window.__naFrente = false')
        aviso('a5', 'Chegou uma rescisão pelo link: Pedro — Loja Z · pagar até 29/10.', {'rotulo': 'Abrir a rescisão', 'link': 'dp-rescisoes.html?rescisao=r1'})
        p.wait_for_function('() => window.__notificacoes.length > 0', timeout=3000)
        n = db('window.__notificacoes.slice(-1)[0]')
        ok(n['titulo'] == 'Avisos do sistema' and n['body'] == 'Chegou uma rescisão pelo link: Pedro — Loja Z · pagar até 29/10.' and n['tag'] == 'mr-chat-c-av',
           f'atrás: o aviso do Windows com "Avisos do sistema" e o aviso ({n})')
        p.evaluate('window.__naFrente = true')

        # 6) silenciada: conta na linha, sem bipe, sem recado, sem aviso do Windows e fora do número do balão
        p.click('.as-lancador'); p.click('.as-aba[data-aba="equipe"]'); pra_lista(); p.click(linha_av)
        p.wait_for_selector('.ch-v-conversa:not([hidden]) .ch-msg[data-id="a5"]', timeout=3000)
        p.click('[data-ch="menu"]'); p.click('.ch-menu [data-ch="silenciar"]')
        p.wait_for_function("() => window.__mockDb.chat_membros.find(m => m.conversa_id === 'c-av').silenciada === true", timeout=3000)
        ok(p.inner_text('.ch-v-conversa .ch-cab-quem small') == 'Só pra ler · silenciada', 'silenciou: o topo diz')
        pra_lista(); p.click('.ch-linha[data-conversa="c-th"]'); p.wait_for_timeout(300)
        p.click('.as-acao[data-a="fechar"]')
        av0, no0 = len(db('window.__avisos')), len(db('window.__notificacoes'))
        aviso('a6', 'Chegou uma admissão pelo link: Maria — Padaria X.', {'rotulo': 'Abrir a admissão', 'link': 'dp-admissoes.html?admissao=a1'})
        p.wait_for_timeout(500)
        ok(len(db('window.__avisos')) == av0 and len(db('window.__notificacoes')) == no0 and p.is_hidden('.as-recado') and p.is_hidden('.as-selo'),
           'silenciada: o aviso chega sem bipe, sem recado, sem aviso do Windows e fora do número do balão')

        # 7) o primeiro aviso de todos: a conversa nasce no banco (a pessoa entra nela e o aviso chega) — o número certo e um aviso só,
        # com o botão, nas duas ordens do tempo real
        for ordem in ('membro primeiro', 'mensagem primeiro'):
            p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=6000); p.wait_for_timeout(800)
            # sem a conversa de avisos (o Samuel nunca recebeu aviso)
            p.evaluate("() => { const d = window.__mockDb; d.chat_membros = d.chat_membros.filter(m => m.conversa_id !== 'c-av'); }")
            # (a lista lê de novo quando alguém põe a pessoa numa conversa: aqui, sem a de avisos)
            p.evaluate("() => window.__mockEmitir('chat_membros', 'INSERT', { conversa_id: 'c-th', email: '" + EU + "', lido_ate: new Date().toISOString(), silenciada: false })")
            p.wait_for_function("() => document.querySelector('.as-selo').hidden", timeout=3000)
            cid = 'c-av-nova-' + ('1' if ordem == 'membro primeiro' else '2')
            p.evaluate("([cid, eu]) => { const d = window.__mockDb; d.chat_conversas.push({ id: cid, tipo: 'grupo', titulo: 'Avisos do sistema', chave: 'avisos|' + eu + '|' + cid, criada_por: 'sistema', criada_em: new Date().toISOString(), ultima_em: new Date().toISOString() });"
                       " d.chat_membros.push({ conversa_id: cid, email: eu, lido_ate: new Date(Date.now() - 1000).toISOString(), silenciada: false }); }", [cid, EU])
            linha = aviso('n-' + cid, 'Thalia te passou uma tarefa: Conferir notas de entrada · prazo 21/10.', {'rotulo': 'Abrir a tarefa', 'link': 'agenda.html?tarefa=t61'}, conv=cid, emitir_ja=False)
            membro = {'conversa_id': cid, 'email': EU, 'lido_ate': linha['criada_em'], 'silenciada': False}
            av0 = len(db('window.__avisos'))
            if ordem == 'membro primeiro':
                emitir('chat_membros', 'INSERT', membro); p.wait_for_timeout(400); emitir('chat_mensagens', 'INSERT', linha)
            else:
                emitir('chat_mensagens', 'INSERT', linha); p.wait_for_timeout(30); emitir('chat_membros', 'INSERT', membro)
            p.wait_for_selector('.as-recado:not([hidden])', timeout=3000)
            p.wait_for_timeout(600)
            rec = p.inner_text('.as-recado')
            bipes = [a for a in db('window.__avisos')[av0:] if a.get('tipo') == 'bipe']
            ok(p.inner_text('.as-selo') == '1' and len(bipes) == 1 and 'Conferir notas de entrada' in rec and p.inner_text('.as-recado .as-chip-acao') == 'Abrir a tarefa',
               f'{ordem}: a conversa nova aparece com 1 não lido (não 2), um bipe só e o recado com o botão ({p.inner_text(".as-selo")!r}, {len(bipes)} bipe(s), {rec!r})')

        ok(not erros, f'sem erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print(f'\n{falhas} falha(s)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
