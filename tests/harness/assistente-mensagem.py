"""O assistente manda mensagem no chat da equipe (19/10/2026): a função propõe (a "acao" enviar_mensagem — aqui o dublê
window.__mockInvoke devolve conforme a pergunta; a função tem teste próprio em tests/assistente-funcao.test.mjs) e o cartão
embaixo da resposta (assets/js/assistente-acoes.js) mostra a mensagem, editável, com o link do Drive dos arquivos; "Enviar"
manda pela regra do chat (assets/js/chat-equipe.js), em nome de quem está na tela; "Abrir a conversa" abre a aba Equipe
nela, com o arquivo como link do Drive; "Desfazer" apaga. O banco do chat entra como dublê, o mesmo do
tests/harness/chat-equipe.py (as funções chat_* no window.__mockRpc e as tabelas no banco falso). Quem está na tela é o
Samuel (financeiro@). Os dados são inventados.

    python tests/harness/assistente-mensagem.py

Confere:
  1. pra quem já tem conversa: o cartão (pra quem, o texto, o arquivo com o link do Drive — o link de fora do Drive não
     entra), editar e enviar (na conversa a dois, com o texto editado e o link), "Enviada" e a carinha;
  2. "Abrir a conversa": a aba Equipe na conversa, com a mensagem e o arquivo como link do Drive (aba nova);
  3. "Desfazer": a mensagem apagada e o cartão diz;
  4. pra quem ainda não tem conversa (Diego) e pro grupo de todos: a conversa a dois nasce, o grupo vem pela chave, um
     "Abrir" pra cada;
  5. um grupo que não existe: nada vai, o motivo aparece, "Agora não" deixa como estava; com dois destinos, um que não
     existe: vai pro outro, o que faltou aparece e "Tentar de novo" não duplica;
  6. recarregar: o cartão volta no estado em que ficou;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
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
EU, TH, VI, AD, DI = 'financeiro@macedoereis.com.br', 'fiscal@macedoereis.com.br', 'rh@macedoereis.com.br', 'contabil@macedoereis.com.br', 'diego@macedoereis.com.br'
CONVERSAS = [
    {'id': 'c-esc', 'tipo': 'grupo', 'titulo': 'Escritório', 'chave': 'escritorio', 'criada_por': EU, 'criada_em': T(3000), 'ultima_em': T(90)},
    {'id': 'c-th', 'tipo': 'direta', 'titulo': None, 'chave': EU + '|' + TH, 'criada_por': TH, 'criada_em': T(2000), 'ultima_em': T(5)},
    {'id': 'c-g1', 'tipo': 'grupo', 'titulo': 'Fiscal e DP', 'chave': None, 'criada_por': VI, 'criada_em': T(1000), 'ultima_em': T(20)}]
MEMBROS = [{'conversa_id': 'c-esc', 'email': e, 'lido_ate': T(80), 'silenciada': False} for e in (EU, TH, VI, AD, DI)] + [
    {'conversa_id': 'c-th', 'email': EU, 'lido_ate': T(1), 'silenciada': False}, {'conversa_id': 'c-th', 'email': TH, 'lido_ate': T(1), 'silenciada': False},
    {'conversa_id': 'c-g1', 'email': EU, 'lido_ate': T(1), 'silenciada': False}, {'conversa_id': 'c-g1', 'email': VI, 'lido_ate': T(1), 'silenciada': False}]
MENSAGENS = [{'id': 'm1', 'conversa_id': 'c-th', 'autor': TH, 'texto': 'Me manda o contrato da padaria?', 'anexos': [], 'criada_em': T(5), 'apagada_em': None}]
LINK = 'https://drive.google.com/file/d/ARQ_CONTRATO_TESTE_1/view'
ACOES = {
    'Manda o contrato pra Thalia': {'tipo': 'enviar_mensagem', 'para': [{'email': TH, 'nome': 'Thalia'}], 'texto': 'Thalia, segue o contrato social da padaria.',
        'arquivos': [{'nome': 'Contrato Social.pdf', 'link': LINK, 'pasta': 'PROCESSOS / ABERTURA'}, {'nome': 'Malicioso.pdf', 'link': 'javascript:alert(1)', 'pasta': ''}]},
    'Avisa o Diego e o escritório': {'tipo': 'enviar_mensagem', 'para': [{'email': DI, 'nome': 'Diego'}, {'grupo': 'escritorio', 'nome': 'Escritório'}], 'texto': 'Amanhã fechamos ao meio-dia.'},
    'Manda no grupo da diretoria': {'tipo': 'enviar_mensagem', 'para': [{'grupo': 'Diretoria', 'nome': 'Diretoria'}], 'texto': 'Oi, pessoal.'},
    'Pergunta pra Vitória e pra diretoria': {'tipo': 'enviar_mensagem', 'para': [{'email': VI, 'nome': 'Vitória'}, {'grupo': 'Diretoria', 'nome': 'Diretoria'}], 'texto': 'A folha da padaria fechou?'}}
SEMEAR = """
(() => {
  const CONV = %s, MEMB = %s, MSGS = %s, ACOES = %s;
  const EU = '%s', PESSOAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.chat_conversas = CONV; v.chat_membros = MEMB; v.chat_mensagens = MSGS; v.assistente_chat = [];
  } });
  const agora = () => new Date().toISOString();
  // o que o banco de verdade faz na mensagem nova: quem, quando, a conversa sobe e quem mandou já leu
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
  window.__mockRpc = (nome, a) => {
    window.__rpcs.push({ nome, a: JSON.parse(JSON.stringify(a || {})) });
    if (nome === 'chat_preparar') return { data: 'c-esc', error: null };
    if (nome === 'chat_resumo') return { data: resumo(), error: null };
    if (nome === 'chat_pessoas') return { data: PESSOAS, error: null };
    if (nome === 'chat_abrir_direta') {
      const k = [EU, a.outro].sort().join('|'), ja = db.chat_conversas.find(c => c.chave === k);
      if (ja) return { data: ja.id, error: null };
      const id = 'c-nova' + (++n);
      db.chat_conversas.push({ id, tipo: 'direta', titulo: null, chave: k, criada_por: EU, criada_em: agora(), ultima_em: agora() });
      [EU, a.outro].forEach(e => db.chat_membros.push({ conversa_id: id, email: e, lido_ate: agora(), silenciada: false }));
      return { data: id, error: null };
    }
    return { data: [], error: null };
  };
  window.__chamadas = []; window.__feitos = 0;
  addEventListener('mr:feito', () => { window.__feitos++; });
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    const acao = ACOES[opts.body.pergunta] || null;
    return { data: ev({ tipo: 'etapa', texto: 'Escrevendo a mensagem pra você conferir' }) + ev({ tipo: 'resposta', texto: 'A mensagem está pronta: confira e envie.', ...(acao ? { acao } : {}) }), error: null };
  };
  // sem bipe nem aviso do Windows no teste
  window.Notification = class { constructor() {} close() {} static get permission() { return 'denied'; } static async requestPermission() { return 'denied'; } };
})();
""" % (json.dumps(CONVERSAS, ensure_ascii=False), json.dumps(MEMBROS, ensure_ascii=False), json.dumps(MENSAGENS, ensure_ascii=False), json.dumps(ACOES, ensure_ascii=False),
       EU, json.dumps(sorted([EU, TH, VI, AD, DI])))
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
        msgs = lambda conv: p.evaluate('c => window.__mockDb.chat_mensagens.filter(m => m.conversa_id === c)', conv)
        def perguntar(texto):
            p.fill('.as-entrada textarea', texto); p.press('.as-entrada textarea', 'Enter')
            p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)
        ultimo = '.as-lista .as-msg.ia:last-child .as-cartao'

        print('1. Pra quem já tem conversa, com o arquivo do Drive')
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=5000)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        perguntar('Manda o contrato pra Thalia')
        p.wait_for_selector(ultimo + ' textarea', timeout=5000)
        ok(p.inner_text(ultimo + ' .as-cartao-tit') == 'Mensagem pra Thalia', 'o cartão diz pra quem')
        ok(p.input_value(ultimo + ' textarea') == 'Thalia, segue o contrato social da padaria.', 'o texto que a IA escreveu, pra conferir')
        links = p.eval_on_selector_all(ultimo + ' a.as-arquivo', 'as => as.map(a => [a.textContent, a.getAttribute("href"), a.target])')
        ok(len(links) == 1 and links[0][1] == LINK and links[0][2] == '_blank' and 'Contrato Social.pdf' in links[0][0] and 'vai o link do Drive' in links[0][0],
           f'o arquivo com o link do Drive (abre numa aba nova); o link de fora do Drive não entra ({links})')
        ok('sai em seu nome' in p.inner_text(ultimo) and p.inner_text(ultimo + ' .as-botao-pri') == 'Enviar', 'avisa que sai em nome de quem está na tela; o botão "Enviar"')
        antes = len(msgs('c-th'))
        p.fill(ultimo + ' textarea', 'Thalia, segue o contrato social da padaria (o de 2026).')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        th = msgs('c-th')
        nova = th[-1] if th else {}
        ok(len(th) == antes + 1 and nova.get('autor') == EU and nova.get('texto') == 'Thalia, segue o contrato social da padaria (o de 2026).'
           and nova.get('anexos') == [{'nome': 'Contrato Social.pdf', 'link': LINK, 'pasta': 'PROCESSOS / ABERTURA'}], f'foi na conversa a dois, em nome do Samuel, com o texto editado e o link ({nova})')
        ok(p.inner_text(ultimo + ' .as-cartao-ok') == '✓ Enviada pra Thalia.' and p.evaluate('window.__feitos') >= 0, 'o cartão diz que foi')
        botoes = p.eval_on_selector_all(ultimo + ' .as-botao', 'bs => bs.map(b => b.textContent)')
        ok(botoes == ['Abrir a conversa', 'Desfazer'], f'"Abrir a conversa" e "Desfazer" ({botoes})')

        print('2. Abrir a conversa')
        p.click(ultimo + ' .as-botao >> text=Abrir a conversa')
        p.wait_for_function("() => { const n = document.querySelector('.ch-v-conversa .ch-cab-quem b'); return n && n.textContent === 'Thalia' && n.offsetParent; }", timeout=5000)
        ok(p.is_visible('.ch-msgs') and 'segue o contrato social da padaria (o de 2026)' in p.inner_text('.ch-msgs'), 'a aba Equipe abre na conversa com a Thalia, com a mensagem')
        arq = p.eval_on_selector_all('.ch-msgs a.ch-arq-link', 'as => as.map(a => [a.getAttribute("href"), a.target, a.rel, a.textContent])')
        ok(len(arq) == 1 and arq[0][0] == LINK and arq[0][1] == '_blank' and 'noopener' in arq[0][2] and 'Contrato Social.pdf' in arq[0][3] and 'Drive' in arq[0][3],
           f'na conversa, o arquivo é o link do Drive, numa aba nova ({arq})')

        print('3. Desfazer')
        p.click('.as-aba[data-aba="assistente"]'); p.wait_for_selector(ultimo + ' .as-botao >> text=Desfazer', timeout=5000)
        p.click(ultimo + ' .as-botao >> text=Desfazer')
        p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        apagada = msgs('c-th')[-1]
        # o banco de verdade tira o texto e o link da apagada (o gatilho do chat); o dublê só marca
        ok(apagada['apagada_em'] and apagada['autor'] == EU, 'a mensagem foi apagada (a própria, pelo "Desfazer")')
        ok('a mensagem foi apagada (quem já tinha lido, leu)' in p.inner_text(ultimo), 'o cartão diz que desfez, e que quem leu, leu')

        print('4. Pra quem ainda não tem conversa e pro grupo de todos')
        perguntar('Avisa o Diego e o escritório'); p.wait_for_selector(ultimo + ' textarea', timeout=5000)
        ok(p.inner_text(ultimo + ' .as-cartao-tit') == 'Mensagem pra Diego e o grupo Escritório', 'pra quem: a pessoa e o grupo')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        rpcs = p.evaluate('window.__rpcs')
        nova_conv = p.evaluate("k => (window.__mockDb.chat_conversas.find(c => c.chave === k) || {}).id", '|'.join(sorted([EU, DI])))
        ok(any(r['nome'] == 'chat_abrir_direta' and r['a'] == {'outro': DI} for r in rpcs) and nova_conv and [m['texto'] for m in msgs(nova_conv)] == ['Amanhã fechamos ao meio-dia.'],
           f'a conversa a dois com o Diego nasce e a mensagem vai nela ({nova_conv})')
        ok([m['texto'] for m in msgs('c-esc')][-1:] == ['Amanhã fechamos ao meio-dia.'], 'e no grupo de todos (pela chave)')
        botoes = p.eval_on_selector_all(ultimo + ' .as-botao', 'bs => bs.map(b => b.textContent)')
        ok(p.inner_text(ultimo + ' .as-cartao-ok') == '✓ Enviada pra Diego e o grupo Escritório.' and botoes == ['Abrir: Diego', 'Abrir: Escritório', 'Desfazer'], f'um "Abrir" pra cada ({botoes})')

        print('5. Grupo que não existe; e dois destinos, um que não existe')
        total = p.evaluate('window.__mockDb.chat_mensagens.length')
        perguntar('Manda no grupo da diretoria'); p.wait_for_selector(ultimo + ' textarea', timeout=5000)
        ok(p.inner_text(ultimo + ' .as-cartao-tit') == 'Mensagem pro grupo Diretoria', '"pro grupo"')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-erro:not([hidden])', timeout=5000)
        ok('você não está em nenhum grupo chamado "Diretoria"' in p.inner_text(ultimo + ' .as-cartao-erro') and p.evaluate('window.__mockDb.chat_mensagens.length') == total,
           'nada vai, e o motivo aparece')
        p.click(ultimo + ' .as-botao >> text=Agora não'); p.wait_for_timeout(150)
        ok(p.inner_text(ultimo) == 'Não enviei.', '"Agora não": fica como estava')
        perguntar('Pergunta pra Vitória e pra diretoria'); p.wait_for_selector(ultimo + ' textarea', timeout=5000)
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        conv_vi = p.evaluate("k => (window.__mockDb.chat_conversas.find(c => c.chave === k) || {}).id", '|'.join(sorted([EU, VI])))
        card = p.inner_text(ultimo)
        ok('✓ Enviada pra Vitória.' in card and 'Não foi pro grupo Diretoria (você não está em nenhum grupo chamado "Diretoria")' in card and len(msgs(conv_vi)) == 1,
           f'vai pra Vitória e diz o que faltou ({card!r})')
        p.click(ultimo + ' .as-botao >> text=Tentar de novo'); p.wait_for_timeout(400)
        ok(len(msgs(conv_vi)) == 1 and 'Não foi pro grupo Diretoria' in p.inner_text(ultimo), '"Tentar de novo": a da Vitória não duplica; o grupo continua faltando')

        print('6. Recarregar')
        p.reload(); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_selector(ultimo, timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('✓ Enviada pra Vitória.') and 'Tentar de novo' in card and not p.query_selector(ultimo + ' textarea'), 'o cartão volta no estado em que ficou')
        cartoes = p.eval_on_selector_all('.as-lista .as-cartao', 'cs => cs.map(c => c.innerText.split("\\n")[0])')
        ok(any(c.startswith('↺ Desfeito') for c in cartoes) and 'Não enviei.' in cartoes, f'os de antes também ({cartoes})')
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
