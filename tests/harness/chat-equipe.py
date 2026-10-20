"""Teste do chat da equipe (assets/js/chat-equipe.js, a aba "Equipe" do balão do canto, 16/10/2026): a lista das conversas
(as não lidas, quem está online, quem ainda não tem conversa), abrir e ler (o "visto"), enviar e receber na hora (o tempo
real), o aviso só no computador (com a tela na frente, o recado e o bipe; atrás, o aviso do Windows; silenciada, nada; no
celular, nada), arquivos e imagens (a pasta "chat"), apagar a própria mensagem, grupo novo, pôr alguém no grupo, a busca nas
mensagens, as duas colunas com o painel aumentado e o que fica guardado ao recarregar. O banco do chat entra como dublê, no
window.__mockRpc (as funções chat_*) e nas tabelas do banco falso (tests/harness/supabase.mock.js, que entrega o que muda
nelas aos canais de tempo real); o SQL do chat tem teste próprio (Postgres local) e as regras puras, em
tests/chat-equipe.test.mjs. Quem está na tela é o Samuel (financeiro@).

    python tests/harness/chat-equipe.py

Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime, base64
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

AGORA = datetime.datetime.now(datetime.timezone.utc)
T = lambda minutos: (AGORA - datetime.timedelta(minutes=minutos)).isoformat().replace('+00:00', 'Z')
EU, TH, VI, AD, DI = 'financeiro@macedoereis.com.br', 'fiscal@macedoereis.com.br', 'rh@macedoereis.com.br', 'contabil@macedoereis.com.br', 'diego@macedoereis.com.br'
CONVERSAS = [
    {'id': 'c-esc', 'tipo': 'grupo', 'titulo': 'Escritório', 'chave': 'escritorio', 'criada_por': EU, 'criada_em': T(3000), 'ultima_em': T(90)},
    {'id': 'c-th', 'tipo': 'direta', 'titulo': None, 'chave': EU + '|' + TH, 'criada_por': TH, 'criada_em': T(2000), 'ultima_em': T(5)},
    {'id': 'c-g1', 'tipo': 'grupo', 'titulo': 'Fiscal e DP', 'chave': None, 'criada_por': VI, 'criada_em': T(1000), 'ultima_em': T(20)}]
MEMBROS = [{'conversa_id': 'c-esc', 'email': e, 'lido_ate': T(80), 'silenciada': False} for e in (EU, TH, VI, AD, DI)] + [
    {'conversa_id': 'c-th', 'email': EU, 'lido_ate': T(30), 'silenciada': False}, {'conversa_id': 'c-th', 'email': TH, 'lido_ate': T(5), 'silenciada': False},
    {'conversa_id': 'c-g1', 'email': EU, 'lido_ate': T(60), 'silenciada': True}, {'conversa_id': 'c-g1', 'email': TH, 'lido_ate': T(20), 'silenciada': False},
    {'conversa_id': 'c-g1', 'email': VI, 'lido_ate': T(20), 'silenciada': False}]
M = lambda i, conv, autor, texto, minutos, **x: {'id': i, 'conversa_id': conv, 'autor': autor, 'texto': texto, 'anexos': [], 'criada_em': T(minutos), 'apagada_em': None, **x}
MENSAGENS = [
    M('m1', 'c-th', EU, 'Thalia, já saiu a DCTFWeb da padaria?', 40), M('m2', 'c-th', TH, 'Saiu sim, te mando a guia.', 10),
    M('m3', 'c-th', TH, 'manda a guia da Adega?', 5), M('m4', 'c-esc', VI, 'Reunião às 15h na sala.', 90),
    M('m5', 'c-g1', VI, 'Folha da padaria fechada.', 20)]
SEMEAR = """
(() => {
  const CONV = %s, MEMB = %s, MSGS = %s;
  const EU = '%s', PESSOAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.chat_conversas = CONV; v.chat_membros = MEMB; v.chat_mensagens = MSGS;
  } });
  const agora = () => new Date().toISOString();
  // o que o banco de verdade faz sozinho na mensagem nova: quem, quando, a conversa sobe na lista e quem mandou já leu
  window.__mockAntesDeInserir = (t, r) => {
    if (t !== 'chat_mensagens') return;
    r.autor = EU; r.criada_em = agora(); r.apagada_em = null; r.anexos = r.anexos || [];
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
  let n = 0;
  const novaConversa = (tipo, titulo, chave, quem) => {
    const id = 'c-nova' + (++n);
    db.chat_conversas.push({ id, tipo, titulo, chave, criada_por: EU, criada_em: agora(), ultima_em: agora() });
    quem.forEach(e => db.chat_membros.push({ conversa_id: id, email: e, lido_ate: agora(), silenciada: false }));
    return id;
  };
  window.__mockRpc = (nome, a) => {
    window.__rpcs.push({ nome, a: JSON.parse(JSON.stringify(a || {})) });
    if (nome === 'chat_preparar') return { data: 'c-esc', error: null };
    if (nome === 'chat_resumo') return { data: resumo(), error: null };
    if (nome === 'chat_pessoas') return { data: PESSOAS, error: null };
    if (nome === 'chat_abrir_direta') {
      const k = [EU, a.outro].sort().join('|'), ja = db.chat_conversas.find(c => c.chave === k);
      return { data: ja ? ja.id : novaConversa('direta', null, k, [EU, a.outro]), error: null };
    }
    if (nome === 'chat_criar_grupo') return { data: novaConversa('grupo', a.titulo.trim(), null, [EU, ...a.emails]), error: null };
    if (nome === 'chat_grupo_adicionar') { db.chat_membros.push({ conversa_id: a.c, email: a.email, lido_ate: agora(), silenciada: false }); return { data: null, error: null }; }
    if (nome === 'chat_grupo_renomear') { db.chat_conversas.find(c => c.id === a.c).titulo = a.titulo.trim(); return { data: null, error: null }; }
    if (nome === 'chat_grupo_sair') { db.chat_membros = db.chat_membros.filter(m => !(m.conversa_id === a.c && m.email === EU)); return { data: null, error: null }; }
    return { data: [], error: null };
  };
  // os avisos: o bipe e a notificação (o aviso do Windows) que o chat dispara, e os links de arquivo que ele abre
  window.__avisos = []; addEventListener('mr:chat-aviso', e => window.__avisos.push(e.detail));
  window.__notificacoes = [];
  window.__permissao = window.__permissao || 'granted';
  window.Notification = class { constructor(t, o) { window.__notificacoes.push({ titulo: t, ...o }); window.__ultimaNotificacao = this; }
    close() {} static get permission() { return window.__permissao; } static async requestPermission() { window.__permissao = 'granted'; return 'granted'; } };
  window.__links = []; HTMLAnchorElement.prototype.click = function () { window.__links.push(this.href); };
  // a tela na frente (o teste muda pra "atrás")
  window.__naFrente = true; document.hasFocus = () => window.__naFrente;
})();
""" % (json.dumps(CONVERSAS, ensure_ascii=False), json.dumps(MEMBROS, ensure_ascii=False), json.dumps(MENSAGENS, ensure_ascii=False), EU, json.dumps(sorted([EU, TH, VI, AD, DI])))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

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
        def chegar(i, conv, autor, texto, **x):
            linha = {'id': i, 'conversa_id': conv, 'autor': autor, 'texto': texto, 'anexos': [], 'criada_em': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'), 'apagada_em': None, **x}
            p.evaluate('l => { window.__mockDb.chat_mensagens.push(l); window.__mockDb.chat_conversas.find(c => c.id === l.conversa_id).ultima_em = l.criada_em; }', linha)
            emitir('chat_mensagens', 'INSERT', linha); p.wait_for_timeout(250)
        linha_de = lambda nome: '.ch-linha:has(b:text-is("' + nome + '"))'

        # 1) a lista: as não lidas (a silenciada não conta no balão), quem está online e quem ainda não tem conversa
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=6000)
        p.wait_for_function("() => !document.querySelector('.as-selo').hidden", timeout=6000)
        ok(p.inner_text('.as-selo') == '2' and p.title().startswith('(2) '), f'o balão e o título da aba com as 2 não lidas (a do grupo silenciado não conta) ({p.inner_text(".as-selo")!r}, {p.title()!r})')
        p.click('.as-lancador'); p.wait_for_selector('.as-abas .as-aba', timeout=3000)
        abas = p.eval_on_selector_all('.as-aba', 'bs => bs.map(b => b.innerText.replace(/\\s+/g, " ").trim())')
        ok(abas == ['Assistente', 'Equipe 2', 'Notícias'], f'as abas Assistente, Equipe (com o número) e Notícias ({abas})')
        p.evaluate("window.__mockOnline(['" + TH + "'])")
        p.click('.as-aba[data-aba="equipe"]'); p.wait_for_selector('.ch-linha', timeout=3000)
        linhas = p.eval_on_selector_all('.ch-conversas .ch-linha b', 'bs => bs.map(b => b.textContent)')
        ok(linhas == ['Thalia', 'Fiscal e DP', 'Escritório', 'Adaini', 'Diego', 'Vitória'], f'a ordem: pela última mensagem; depois quem ainda não tem conversa a dois ({linhas})')
        th = p.inner_text(linha_de('Thalia'))
        ok('manda a guia da Adega?' in th and p.inner_text(linha_de('Thalia') + ' .ch-n') == '2' and p.query_selector(linha_de('Thalia') + ' .ch-online'),
           f'a linha da Thalia: a última mensagem, 2 novas e online ({th!r})')
        ok(p.query_selector(linha_de('Fiscal e DP') + ' .ch-mudo') and 'Vitória: Folha da padaria fechada.' in p.inner_text(linha_de('Fiscal e DP')),
           'o grupo silenciado mostra o sininho e quem mandou a última')
        ok(p.inner_text('.as-nome') == 'Equipe' and 'Thalia online' in p.inner_text('.as-status-txt'), f'o topo diz quem está online ({p.inner_text(".as-status-txt")!r})')

        # 2) abrir a conversa: o "Novas" antes das não lidas, e lida (o banco e o número)
        p.click(linha_de('Thalia')); p.wait_for_selector('.ch-v-conversa:not([hidden]) .ch-msg', timeout=3000)
        textos = p.eval_on_selector_all('.ch-msgs .ch-msg .ch-bolha', 'bs => bs.map(b => b.textContent)')
        ok(textos == ['Thalia, já saiu a DCTFWeb da padaria?', 'Saiu sim, te mando a guia.', 'manda a guia da Adega?'], f'as mensagens em ordem ({textos})')
        ok(p.evaluate("() => { const n = document.querySelector('.ch-novas'); return !!n && n.nextElementSibling.dataset.id === 'm2'; }"), 'o "Novas" antes da primeira não lida')
        p.wait_for_function("() => document.querySelector('.as-selo').hidden", timeout=3000)
        lido = db("window.__mockDb.chat_membros.find(m => m.conversa_id === 'c-th' && m.email === '" + EU + "').lido_ate")
        ok(lido == MENSAGENS[2]['criada_em'] and not p.title().startswith('('), f'leu: até a última (a hora do banco), o balão e o título sem número ({lido})')
        ok(p.inner_text('.ch-v-conversa .ch-cab-quem') == 'Thalia\nonline', f'o topo da conversa: quem e se está online ({p.inner_text(".ch-v-conversa .ch-cab-quem")!r})')

        # 3) enviar (Enter) e o "visto" quando ela lê
        p.fill('.ch-entrada textarea', 'Mando já, Thalia'); p.press('.ch-entrada textarea', 'Enter')
        p.wait_for_function("() => window.__mockDb.chat_mensagens.some(m => m.texto === 'Mando já, Thalia')", timeout=3000)
        p.wait_for_timeout(300)
        nova = db("window.__mockDb.chat_mensagens.find(m => m.texto === 'Mando já, Thalia')")
        ok(nova['conversa_id'] == 'c-th' and nova['autor'] == EU and p.eval_on_selector_all('.ch-msg.eu .ch-bolha', 'bs => bs.filter(b => b.textContent === "Mando já, Thalia").length') == 1,
           'enviou na conversa dela, uma vez só (a volta pelo tempo real não duplica)')
        ok(p.input_value('.ch-entrada textarea') == '' and 'Você: Mando já, Thalia' in p.inner_text(linha_de('Thalia')), 'a caixa limpa e a lista com a minha última')
        p.evaluate("([id]) => { const m = window.__mockDb.chat_membros.find(x => x.conversa_id === 'c-th' && x.email === '" + TH + "'); m.lido_ate = new Date(Date.now() + 1000).toISOString(); window.__mockEmitir('chat_membros', 'UPDATE', m); }", ['x'])
        p.wait_for_selector('.ch-visto', timeout=3000)
        ok(p.inner_text('.ch-msg.eu:last-of-type .ch-visto') == 'Visto', 'ela leu: "Visto" na minha última')

        # 4) chega da Thalia com a conversa aberta e a tela na frente: entra na hora, sem aviso, lida
        avisos0 = len(db('window.__avisos'))
        chegar('m10', 'c-th', TH, 'Valeu!')
        ok(p.eval_on_selector_all('.ch-msgs .ch-bolha', 'bs => bs.map(b => b.textContent)')[-1] == 'Valeu!' and len(db('window.__avisos')) == avisos0
           and p.query_selector('.as-selo').is_hidden(), 'chega na conversa aberta: aparece na hora, sem bipe nem número')

        # 5) chega no Escritório com a Thalia aberta: o número na linha e na aba, e o bipe (a tela está na frente)
        chegar('m11', 'c-esc', VI, 'Alguém viu o malote?')
        ok(p.inner_text(linha_de('Escritório') + ' .ch-n') == '1' and p.inner_text('.as-aba[data-aba="equipe"] .as-aba-n') == '1' and db('window.__avisos.slice(-1)[0].tipo') == 'bipe',
           'outra conversa: o número na linha e na aba, e o bipe')

        # 6) com o painel fechado: o recado da carinha com "Responder", que abre a conversa
        p.click('.as-acao[data-a="fechar"]')
        chegar('m12', 'c-esc', AD, 'Eu vi, está na recepção.')
        p.wait_for_selector('.as-recado:not([hidden])', timeout=3000)
        rec = p.inner_text('.as-recado')
        ok('Escritório' in rec and 'Adaini: Eu vi, está na recepção.' in rec and 'Responder' in rec and p.inner_text('.as-selo') == '2', f'painel fechado: o recado com quem e o quê, e o número no balão ({rec!r})')
        p.click('.as-recado .as-chip-acao'); p.wait_for_selector('.ch-v-conversa:not([hidden])', timeout=3000)
        p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Escritório'", timeout=3000)
        p.wait_for_function("() => document.querySelector('.as-selo').hidden", timeout=3000)
        ok(p.inner_text('.ch-msgs').count('Alguém viu o malote?') == 1 and 'Adaini' in p.inner_text('.ch-msgs'), '"Responder" abre o Escritório, com quem mandou cada uma, e lê')

        # 7) a tela atrás (outra janela na frente): o aviso do Windows; clicar nele abre a conversa
        p.evaluate('window.__naFrente = false')
        chegar('m13', 'c-th', TH, 'Mandei a guia no seu e-mail também.')
        p.wait_for_function('() => window.__notificacoes.length > 0', timeout=3000)
        n = db('window.__notificacoes.slice(-1)[0]')
        ok(n['titulo'] == 'Thalia' and n['body'] == 'Mandei a guia no seu e-mail também.' and n['tag'] == 'mr-chat-c-th', f'atrás: o aviso do Windows com quem e o texto ({n})')
        p.evaluate('window.__naFrente = true'); p.evaluate('window.__ultimaNotificacao.onclick()')
        p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Thalia'", timeout=3000)
        ok('Mandei a guia no seu e-mail também.' in p.inner_text('.ch-msgs'), 'clicar no aviso abre a conversa dela')

        # 8) silenciada: nada de aviso
        av, no = len(db('window.__avisos')), len(db('window.__notificacoes'))
        chegar('m14', 'c-g1', VI, 'Lembrete: e-Social amanhã.')
        ok(len(db('window.__avisos')) == av and len(db('window.__notificacoes')) == no and p.inner_text(linha_de('Fiscal e DP') + ' .ch-n') == '2',
           'na conversa silenciada: conta na linha, mas sem bipe nem aviso')

        # 9) arquivos: um PDF e uma imagem; o arquivo baixa pelo link assinado, a imagem aparece em miniatura
        p.set_input_files('.ch-clipe input', files=[{'name': 'Guia DAS março.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 teste'},
                                                    {'name': 'print.png', 'mimeType': 'image/png', 'buffer': PNG}])
        ok(p.eval_on_selector_all('.ch-pend span', 'ss => ss.map(s => s.textContent)') == ['Guia DAS março.pdf', 'print.png'], 'os arquivos esperam embaixo, com o nome')
        p.click('.ch-enviar')
        p.wait_for_function("() => window.__mockDb.chat_mensagens.some(m => (m.anexos || []).length === 2)", timeout=4000)
        msg = db("window.__mockDb.chat_mensagens.find(m => (m.anexos || []).length === 2)")
        cams = [a['caminho'] for a in msg['anexos']]
        ok(cams[0] == 'c-th/' + msg['id'] + '/Guia DAS marco.pdf' and msg['anexos'][0]['nome'] == 'Guia DAS março.pdf' and 'chat/' + cams[0] in db('window.__mockDb.__arquivos'),
           f'os arquivos na pasta da conversa (o nome sem acento na pasta, o de verdade na mensagem) ({cams})')
        p.wait_for_selector('.ch-img img[src^="data:image"]', timeout=3000)
        p.click('.ch-arq[data-caminho]')
        p.wait_for_function('() => window.__links.length > 0', timeout=3000)
        link = db('window.__links.slice(-1)[0]')
        ok('arquivos.teste/chat/c-th/' in link and 'download=Guia%20DAS%20mar%C3%A7o.pdf' in link, f'o PDF baixa pelo link assinado, com o nome de verdade ({link})')

        # 10) apagar a minha (o arquivo sai da pasta)
        p.hover('.ch-msg[data-id="' + msg['id'] + '"]'); p.click('.ch-msg[data-id="' + msg['id'] + '"] [data-ch="apagar"]')
        p.click('[data-ch="apagar-sim"]')
        p.wait_for_selector('.ch-msg[data-id="' + msg['id'] + '"].ch-apagada', timeout=3000)
        ok(db("window.__mockDb.chat_mensagens.find(m => m.id === '" + msg['id'] + "').apagada_em") and not any(k.startswith('chat/c-th/' + msg['id']) for k in db('window.__mockDb.__arquivos')),
           'apagar: a mensagem fica "apagada" e os arquivos saem da pasta')

        # 11) a busca nas mensagens: abre a conversa na mensagem achada
        p.click('[data-ch="voltar"]'); p.fill('.ch-busca input', 'malote')
        p.wait_for_selector('.ch-achada', timeout=3000)
        ok('Alguém viu o malote?' in p.inner_text('.ch-achadas') and 'Escritório' in p.inner_text('.ch-achadas'), 'a busca acha a mensagem e diz de qual conversa')
        p.click('.ch-achada'); p.wait_for_selector('.ch-msg.ch-destaque', timeout=3000)
        ok('malote' in p.inner_text('.ch-msg.ch-destaque'), 'abre a conversa com a mensagem achada em destaque')
        p.click('[data-ch="voltar"]'); p.fill('.ch-busca input', '')

        # 12) quem ainda não tem conversa: clicar abre (a função cria a conversa a dois)
        p.click(linha_de('Diego')); p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Diego'", timeout=3000)
        ok(any(r['nome'] == 'chat_abrir_direta' and r['a'] == {'outro': DI} for r in db('window.__rpcs')) and 'Nenhuma mensagem ainda' in p.inner_text('.ch-msgs'),
           'a conversa com o Diego nasce pela função e abre vazia')

        # 13) grupo novo e pôr alguém nele
        p.click('[data-ch="voltar"]'); p.click('[data-ch="novo-grupo"]')
        p.fill('[data-ch="nome-grupo"]', 'Societário'); p.check('.ch-quem-item input[value="' + AD + '"]'); p.click('[data-ch="criar-grupo"]')
        p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Societário'", timeout=3000)
        cg = [r for r in db('window.__rpcs') if r['nome'] == 'chat_criar_grupo'][-1]['a']
        ok(cg == {'titulo': 'Societário', 'emails': [AD]}, f'o grupo novo pela função, com o nome e quem entra ({cg})')
        p.click('[data-ch="menu"]'); p.click('.ch-menu [data-ch="pessoas"]')
        p.wait_for_selector('.ch-v-grupo:not([hidden]) .ch-membros', timeout=3000)
        p.select_option('[data-ch="quem-por"]', VI); p.click('[data-ch="por"]')
        p.wait_for_function("() => document.querySelector('.ch-membros').innerText.includes('Vitória')", timeout=3000)
        ok(any(r['nome'] == 'chat_grupo_adicionar' and r['a']['email'] == VI for r in db('window.__rpcs')), 'pôr a Vitória no grupo, e ela aparece em quem está')

        # 14) o painel aumentado: as duas colunas lado a lado
        p.click('.as-acao[data-a="largo"]'); p.wait_for_selector('.ch-raiz.ch-duas', timeout=3000)
        ok(p.is_visible('.ch-col-lista') and p.is_visible('.ch-col-conversa'), 'aumentado: a lista e a conversa lado a lado')
        p.click(linha_de('Thalia')); p.wait_for_function("() => document.querySelector('.ch-v-conversa .ch-cab-quem b').textContent === 'Thalia'", timeout=3000)
        ok(p.is_visible('.ch-col-lista') and p.query_selector('.ch-linha.ch-atual b').inner_text() == 'Thalia', 'a conversa aberta fica marcada na lista ao lado')

        # 15) recarregar: a aba Equipe e a conversa continuam abertas
        p.reload(); p.wait_for_selector('.ch-v-conversa:not([hidden]) .ch-msg', timeout=6000)
        ok(p.get_attribute('.as-aba[data-aba="equipe"]', 'aria-selected') == 'true' and p.inner_text('.ch-v-conversa .ch-cab-quem b') == 'Thalia', 'recarregou: a aba Equipe e a conversa da Thalia continuam')
        p.click('.as-aba[data-aba="assistente"]')
        ok(p.is_visible('.as-entrada textarea') and p.is_hidden('.ch-raiz'), 'a aba do assistente volta com a caixa de perguntas')
        ok(not erros, f'sem erro de JavaScript ({erros[:3]})')
        p.close()

        # 16) no celular: nada de aviso nem do botão de avisos
        cel = b.new_context(viewport={'width': 390, 'height': 844}, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', has_touch=True)
        q = cel.new_page(); errosq = []; q.on('pageerror', lambda e: errosq.append(str(e)))
        q.add_init_script(TOUR); q.add_init_script(SEMEAR)
        q.goto(base + 'index.html'); q.wait_for_selector('.as-lancador', timeout=6000)
        q.click('.as-lancador'); q.click('.as-aba[data-aba="equipe"]'); q.wait_for_selector('.ch-linha', timeout=3000)
        ok(q.is_hidden('[data-ch="avisos"]'), 'no celular, sem o botão de avisos')
        q.evaluate("() => { const l = { id: 'mc1', conversa_id: 'c-esc', autor: '" + VI + "', texto: 'oi', anexos: [], criada_em: new Date().toISOString(), apagada_em: null }; window.__mockDb.chat_mensagens.push(l); window.__mockEmitir('chat_mensagens', 'INSERT', l); }")
        q.wait_for_timeout(700)
        ok(q.evaluate('window.__avisos.length') == 0 and q.evaluate('window.__notificacoes.length') == 0 and q.inner_text('.ch-linha:has(b:text-is("Escritório")) .ch-n') == '1',
           'no celular, a mensagem conta na lista, sem bipe nem aviso')
        ok(not errosq, f'sem erro de JavaScript no celular ({errosq[:3]})')
        cel.close()
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
