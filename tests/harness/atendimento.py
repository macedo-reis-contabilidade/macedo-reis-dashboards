"""Teste da tela de atendimento pelo WhatsApp (atendimento.html, 08/11/2026, a etapa 2 da fase 1), com o banco falso e a
função whatsapp como dublê (window.__mockInvoke faz o que ela faz: grava a mensagem e avisa as telas pelo tempo real).
Dados inventados — nada de cliente.

    python tests/harness/atendimento.py

Confere:
  1. a lista, entrando como a Thalia: abre na Fila (nada com ela), com o fiscal e o sem setor (as filas dela); as contagens;
     o nome e a mensagem que são HTML aparecem como texto (nada roda); o filtro de setor;
  2. a conversa: as mensagens e o evento, o número que já falou por uma empresa, o aviso "Assuma pra responder" com a caixa
     só na nota interna; a nota vai pela função, aparece uma vez, escapada, e não tira a conversa de "esperando";
  3. Assumir grava a situação e o responsável e o evento; a caixa aparece; responder chama a função com o id da tela, e a
     mensagem aparece uma vez só; a que não foi mostra "Tentar de novo", que manda o mesmo id;
  4. ligar o número à empresa (o que já falou por ela): a conversa ganha a empresa, o número fica confirmado, o evento;
     o arquivo do cliente vai pro Drive da empresa com o "Salvar no Drive" e fica com o link "No Drive";
  5. passar pro DP com recado: a fila do DP, sem ninguém, o evento com o recado no histórico; sai das minhas;
  6. o simulador: o cliente de teste escreve, a conversa nasce na fila do setor escolhido e chega na lista na hora, com o
     aviso; a resposta do escritório aparece no "celular" do cliente;
  7. encerrar e reabrir; a mudança de outra pessoa chega ao vivo;
  8. o link ?c= de uma conversa com a Vitória: a Thalia não passa nem encerra; o Samuel (sócio) sim;
  9. no celular, a conversa toma a tela e o "Voltar pra lista" volta;
 10. o card no Painel central; nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

THALIA, VITORIA, SAMUEL = 'fiscal@macedoereis.com.br', 'rh@macedoereis.com.br', 'financeiro@macedoereis.com.br'
SEMEAR = """
(() => {
  const agora = Date.now(), iso = m => new Date(agora - m * 60000).toISOString(), depois = new Date(agora + 23 * 3600e3).toISOString();
  const C = (id, extra) => ({ id, telefone: '5551988887777', contato_nome: 'Maria', cliente_id: null, situacao: 'fila', setor: 'fiscal', responsavel: null,
    assumida_por: null, assumida_em: null, encerrada_por: null, encerrada_em: null, resumo: null, janela_ate: depois, ultima_em: iso(10),
    ultima_do_cliente_em: iso(10), teste: true, criado_em: iso(10), ...extra });
  const M = (id, conversa_id, direcao, texto, min, autor) => ({ id, conversa_id, direcao, autor: autor || (direcao === 'entrada' ? 'cliente' : 'rh@macedoereis.com.br'),
    tipo: 'texto', texto, transcricao: null, anexos: [], status: direcao === 'saida' ? 'enviada' : null, erro: null, criada_em: iso(min) });
  const CONV = [
    C('k1', {}),
    C('k2', { telefone: '5551977776666', contato_nome: '<img src=x onerror="window.__xss=1">', setor: 'dp', cliente_id: 'c1', ultima_em: iso(20), ultima_do_cliente_em: iso(20), criado_em: iso(20) }),
    C('k3', { telefone: '5551966665555', contato_nome: 'João', situacao: 'atendendo', setor: 'dp', responsavel: 'rh@macedoereis.com.br', assumida_em: iso(30), ultima_em: iso(25), ultima_do_cliente_em: iso(40), criado_em: iso(40) }),
    C('k4', { telefone: '5551955554444', contato_nome: 'Ana', situacao: 'encerrada', encerrada_por: 'contabil@macedoereis.com.br', encerrada_em: iso(100), ultima_em: iso(100), criado_em: iso(200) }),
    C('k5', { telefone: '5551944443333', contato_nome: 'Pedro', setor: null, ultima_em: iso(30), ultima_do_cliente_em: iso(30), criado_em: iso(30) })
  ];
  const MSG = [
    M('m1', 'k1', 'entrada', 'Oi, preciso da guia do DAS deste mês <b>urgente</b>', 10),
    M('m2', 'k2', 'entrada', 'Olá <img src=x onerror="window.__xss=2">', 20),
    M('m3', 'k3', 'entrada', 'Bom dia, sobre as férias', 40), M('m4', 'k3', 'saida', 'Bom dia! Já vejo.', 25),
    M('m5', 'k4', 'entrada', 'Obrigada!', 100), M('m6', 'k5', 'entrada', 'Qual o horário de vocês?', 30)
  ];
  const EV = [{ id: 1, conversa_id: 'k1', tipo: 'abriu', setor: 'fiscal', para: null, por: null, observacao: 'simulador', em: iso(10) }];
  const NUM = [{ id: 'n-k1', telefone: '5551988887777', cliente_id: 'c2', nome: 'Maria', confirmado: false, ativo: true, origem: 'cobranca' }];
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) { db = v;
    v.atend_conversas = CONV; v.atend_mensagens = MSG; v.atend_eventos = EV; v.atend_numeros = NUM; } });
  window.__log = []; window.__avisos = []; window.__falharUmaVez = false;
  window.addEventListener('mr:atendimento-aviso', e => window.__avisos.push(e.detail));
  // o que o banco de verdade preenche sozinho (o gatilho atend_quem): quem e quando do evento
  window.__mockAntesDeInserir = (t, r) => { if (t === 'atend_eventos') { r.por = window.__mockEmail; r.em = new Date().toISOString(); } };
  // a função whatsapp: grava a mensagem (com o id da tela) e o tempo real avisa as telas
  window.__mockInvoke = async (nome, opts) => {
    const b = JSON.parse(JSON.stringify(opts.body || {})); window.__log.push([nome, b]);
    if (nome !== 'whatsapp') return { data: null, error: { message: 'outra função' } };
    const agoraIso = new Date().toISOString();
    if (b.acao === 'responder') {
      if (window.__falharUmaVez) { window.__falharUmaVez = false;
        return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status: 500, json: async () => ({ error: 'O servidor caiu.' }) } } }; }
      if (db.atend_mensagens.some(m => m.id === b.id)) return { data: { ok: true, id: b.id, repetida: true }, error: null };
      const m = { id: b.id, conversa_id: b.conversa_id, direcao: 'saida', autor: window.__mockEmail, tipo: (b.anexos || []).length ? 'documento' : 'texto', texto: b.texto || null, transcricao: null, anexos: b.anexos || [], status: 'enviada', erro: null, criada_em: agoraIso };
      db.atend_mensagens.push(m); setTimeout(() => window.__mockEmitir('atend_mensagens', 'INSERT', m), 30);
      return { data: { ok: true, id: b.id }, error: null };
    }
    if (b.acao === 'simular') {
      let c = db.atend_conversas.find(x => x.telefone === b.telefone && x.situacao !== 'encerrada'), nova = false;
      if (!c) {
        c = { id: 'sim-' + db.atend_conversas.length, telefone: b.telefone, contato_nome: b.nome, cliente_id: null, situacao: b.setor === 'robo' ? 'robo' : 'fila', setor: b.setor === 'robo' ? null : b.setor, responsavel: null,
          assumida_por: null, assumida_em: null, encerrada_por: null, encerrada_em: null, resumo: null, janela_ate: new Date(Date.now() + 864e5).toISOString(),
          ultima_em: agoraIso, ultima_do_cliente_em: agoraIso, teste: true, criado_em: agoraIso };
        db.atend_conversas.push(c); nova = true; window.__mockEmitir('atend_conversas', 'INSERT', c);
        db.atend_eventos.push({ id: Date.now(), conversa_id: c.id, tipo: 'abriu', setor: b.setor, para: null, por: null, observacao: 'simulador', em: agoraIso });
      }
      const m = { id: b.id || ('msg-' + Math.random().toString(36).slice(2)), conversa_id: c.id, direcao: 'entrada', autor: 'cliente', tipo: (b.anexos || []).length ? 'imagem' : 'texto', texto: b.texto || null, transcricao: null, anexos: b.anexos || [], status: null, erro: null, criada_em: agoraIso };
      db.atend_mensagens.push(m); window.__mockEmitir('atend_mensagens', 'INSERT', m);
      let robo = null;
      if (c.situacao === 'robo') {   // o assistente (11/11/2026): a IA de mentira responde e passa pro DP, com o resumo
        const r = { id: 'robo-' + Math.random().toString(36).slice(2), conversa_id: c.id, direcao: 'saida', autor: 'robo', tipo: 'texto',
          texto: 'Oi! Já passei pra Vitória, do DP, com a sua pergunta; ela te responde por aqui.', transcricao: null, anexos: [], status: 'enviada', erro: null, criada_em: agoraIso };
        db.atend_mensagens.push(r); window.__mockEmitir('atend_mensagens', 'INSERT', r);
        Object.assign(c, { situacao: 'fila', setor: 'dp', resumo: 'Quer saber das <b>férias</b> de um funcionário.' }); window.__mockEmitir('atend_conversas', 'UPDATE', c);
        db.atend_eventos.push({ id: Date.now() + 1, conversa_id: c.id, tipo: 'robo_passou', setor: 'dp', para: null, por: null, observacao: null, em: agoraIso });
        robo = { respondeu: true, passou: true, setor: 'dp' };
      }
      return { data: { ok: true, conversa_id: c.id, nova, mensagem_id: m.id, robo }, error: null };
    }
    if (b.acao === 'salvar_drive') {
      const m = db.atend_mensagens.find(x => x.id === b.mensagem_id), c = m && db.atend_conversas.find(x => x.id === m.conversa_id);
      if (!c || !c.cliente_id) return { data: null, error: { message: 'non-2xx', context: { status: 409, json: async () => ({ error: 'Ligue a conversa a uma empresa antes de salvar no Drive.' }) } } };
      m.anexos = m.anexos.map(a => a.caminho === b.caminho ? { ...a, drive_id: 'drv123456789', drive_url: 'https://drive.google.com/file/d/drv123456789/view' } : a);
      return { data: { ok: true, anexos: m.anexos, drive_url: 'https://drive.google.com/file/d/drv123456789/view' }, error: null };
    }
    if (b.acao === 'nota') {
      if (db.atend_mensagens.some(m => m.id === b.id)) return { data: { ok: true, id: b.id, repetida: true }, error: null };
      const m = { id: b.id, conversa_id: b.conversa_id, direcao: 'interna', autor: window.__mockEmail, tipo: 'texto', texto: b.texto, transcricao: null, anexos: [], status: null, erro: null, criada_em: agoraIso };
      db.atend_mensagens.push(m); setTimeout(() => window.__mockEmitir('atend_mensagens', 'INSERT', m), 30);
      return { data: { ok: true, id: b.id }, error: null };
    }
    return { data: null, error: { message: 'ação ' + b.acao } };
  };
})();
"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def db(p, tabela):
    return p.evaluate('t => JSON.parse(JSON.stringify(window.__mockDb[t] || []))', tabela)

def conversa(p, cid):
    return next((c for c in db(p, 'atend_conversas') if c['id'] == cid), None)

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        def pagina(email, largura=1400, url='atendimento.html'):
            ctx = b.new_context(viewport={'width': largura, 'height': 900})
            p = ctx.new_page()
            p.on('pageerror', lambda e: erros.append(f'{email}: {e}'))
            p.add_init_script(f"window.__mockEmail = {json.dumps(email)};")
            p.add_init_script(SEMEAR)
            p.goto(base + url)
            p.wait_for_function("() => document.querySelectorAll('.at-item').length > 0 || !document.getElementById('vazio').hidden", timeout=8000)
            return p

        print('1. A lista, como a Thalia')
        p = pagina(THALIA)
        ok(p.get_attribute('#aba-fila', 'aria-selected') == 'true', 'sem nada com ela, abre na Fila')
        ok(p.inner_text('#nMinhas') == '0' and p.inner_text('#nFila') == '2' and p.inner_text('#nTodas') == '2', f'as contagens: minhas 0, fila 2, abertas 2 ({p.inner_text("#nMinhas")}, {p.inner_text("#nFila")}, {p.inner_text("#nTodas")})')
        nomes = p.eval_on_selector_all('.at-item .at-item-nome', 'es => es.map(e => e.textContent)')
        ok(any('Maria' in n for n in nomes) and any('Pedro' in n for n in nomes) and not any('João' in n for n in nomes), f'a fila dela: o fiscal e o sem setor ({nomes})')
        ok('Na fila do Fiscal há 10 min' in p.inner_text('.at-item[data-id="k1"]') and p.locator('.at-item[data-id="k1"].espera').count() == 1, 'a Maria esperando há 10 min, com o ponto de esperando resposta')
        ok('Atendimento (2 esperando)' in p.title(), f'o título da aba conta as que esperam resposta ({p.title()!r})')
        p.click('#setores button[data-f="todos"]'); p.wait_for_timeout(150)
        ok(p.locator('.at-item[data-id="k2"]').count() == 1 and '<img' in p.inner_text('.at-item[data-id="k2"]') and p.evaluate('() => window.__xss') is None,
           'em Todos, o nome que é HTML aparece como texto e nada roda')
        p.click('#setores button[data-f="dp"]'); p.wait_for_timeout(150)
        ok(p.eval_on_selector_all('.at-item', 'es => es.map(e => e.dataset.id)') == ['k2'], 'o filtro do DP: só a do DP sem ninguém')
        p.click('#setores button[data-f="meus"]'); p.wait_for_timeout(150)

        print('2. A conversa')
        p.click('.at-item[data-id="k1"]')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-msg').length === 1")
        ok('<b>urgente</b>' in p.inner_text('#cTempo') and p.locator('#cTempo b').count() == 0, 'a mensagem com HTML aparece como texto')
        ok('A conversa começou, na fila do Fiscal' in p.inner_text('#cTempo'), 'o evento de quando a conversa começou')
        ok('Sem empresa' in p.inner_text('#cMeta') and '(51) 98888-7777' in p.inner_text('#cMeta'), 'o telefone formatado e "Sem empresa"')
        ok('EMPRESA EXEMPLO LTDA (a confirmar)' in p.inner_text('#cFaixas'), 'o número já falou pela EMPRESA EXEMPLO (a confirmar)')
        ok('Assuma a conversa pra responder.' in p.inner_text('#cNota') and p.is_visible('#cCaixa') and p.is_disabled('#mResposta')
           and p.get_attribute('#mNota', 'aria-pressed') == 'true' and p.inner_text('#cEnviar') == 'Anotar', 'sem assumir, o aviso e a caixa só na nota interna')
        p.fill('#cTexto', 'Ligar pro contador antes <i>dela</i>'); p.press('#cTexto', 'Enter')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-msg.interna').length === 1")
        p.wait_for_timeout(250)
        notas = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'nota']
        ok(len(notas) == 1 and notas[0]['conversa_id'] == 'k1' and len(notas[0].get('id', '')) == 36, 'a nota vai pela função, com a conversa e o id da tela')
        nota_txt = p.inner_text('#cTempo .at-msg.interna')
        ok('<i>dela</i>' in nota_txt and 'Nota de Thalia' in nota_txt and p.locator('#cTempo .at-msg.interna i').count() == 0 and p.locator('#cTempo .at-msg.interna').count() == 1,
           'a nota aparece uma vez, com quem anotou, e o HTML como texto')
        ok(p.locator('.at-item[data-id="k1"].espera').count() == 1 and 'Ligar pro contador' not in p.inner_text('.at-item[data-id="k1"]'),
           'a nota não tira a conversa de "esperando resposta" nem vira a prévia da lista')
        ok(not [m for m in db(p, 'atend_conversas') if m['id'] == 'k1' and m['ultima_em'] != conversa(p, 'k1')['ultima_em']], 'a nota não mexe na conversa')
        ok('c=k1' in p.url, 'o endereço guarda a conversa aberta')

        print('3. Assumir e responder')
        p.click('#cAcoes button[data-acao="assumir"]')
        p.wait_for_function("() => !document.getElementById('mResposta').disabled")
        ok(p.get_attribute('#mResposta', 'aria-pressed') == 'true' and p.inner_text('#cEnviar') == 'Enviar', 'assumida, a caixa volta pra resposta')
        k1 = conversa(p, 'k1')
        ok(k1['situacao'] == 'atendendo' and k1['responsavel'] == THALIA, 'Assumir: atendendo, com a Thalia')
        ev = [e for e in db(p, 'atend_eventos') if e['conversa_id'] == 'k1' and e['tipo'] == 'assumiu']
        ok(len(ev) == 1 and ev[0]['por'] == THALIA, 'o evento assumiu, com quem')
        ok(p.inner_text('#nMinhas') == '1' and 'Thalia assumiu' in p.inner_text('#cTempo') and 'Com você' in p.inner_text('#cSit'), 'nas minhas, com o evento no histórico e "Com você"')
        p.fill('#cTexto', 'Bom dia! Já te mando a guia.'); p.press('#cTexto', 'Enter')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-msg.saida').length === 1")
        p.wait_for_timeout(250)
        chamadas = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'responder']
        ok(len(chamadas) == 1 and chamadas[0]['conversa_id'] == 'k1' and len(chamadas[0].get('id', '')) == 36 and chamadas[0]['texto'] == 'Bom dia! Já te mando a guia.',
           'responder chama a função com a conversa, o texto e o id da tela')
        ok(p.locator('#cTempo .at-msg.saida').count() == 1 and p.input_value('#cTexto') == '' and 'Thalia' in p.inner_text('#cTempo .at-msg.saida'),
           'a resposta aparece uma vez só (a da tela e a do tempo real são a mesma), com quem respondeu')
        p.evaluate('() => { window.__falharUmaVez = true; }')
        p.fill('#cTexto', 'Segue em anexo.'); p.click('#cEnviar')
        p.wait_for_selector('#cDeNovo')
        ok('O servidor caiu.' in p.inner_text('#cErro') and p.input_value('#cTexto') == 'Segue em anexo.', 'a que não foi: o erro da função e o texto fica na caixa')
        p.click('#cDeNovo')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-msg.saida').length === 2")
        ids = [x[1]['id'] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('texto') == 'Segue em anexo.']
        ok(len(ids) == 2 and ids[0] == ids[1] and p.inner_text('#cErro') == '', '"Tentar de novo" manda o mesmo id, e a mensagem entra uma vez')

        print('4. Ligar o número à empresa')
        p.click('#cFaixas button[data-num="ligar"]')
        p.wait_for_function("() => document.querySelector('#cMeta a') !== null")
        k1 = conversa(p, 'k1'); num = next(n for n in db(p, 'atend_numeros') if n['id'] == 'n-k1')
        ok(k1['cliente_id'] == 'c2' and num['confirmado'] is True, 'a conversa com a EMPRESA EXEMPLO e o número confirmado pra ela')
        ok('editar.html?id=c2' in p.get_attribute('#cMeta a', 'href') and 'Thalia ligou o número à empresa EMPRESA EXEMPLO LTDA' in p.inner_text('#cTempo'), 'o link da ficha e o evento no histórico')

        print('4b. Salvar o arquivo no Drive da empresa')
        p.evaluate("""() => { const m = { id: 'm7', conversa_id: 'k1', direcao: 'entrada', autor: 'cliente', tipo: 'documento', texto: null, transcricao: null, status: null, erro: null,
          anexos: [{ caminho: '0b6e4f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b/extrato.pdf', nome: 'extrato.pdf', tamanho: 2048, tipo: 'application/pdf' }], criada_em: new Date().toISOString() };
          window.__mockDb.atend_mensagens.push(m); window.__mockEmitir('atend_mensagens', 'INSERT', m); }""")
        p.wait_for_selector('#cTempo .at-anexo-salvar')
        ok(p.locator('#cTempo .at-anexo-salvar').count() == 1 and not p.is_disabled('#cTempo .at-anexo-salvar'), 'com a empresa ligada, o arquivo do cliente tem o "Salvar no Drive"')
        p.click('#cTempo .at-anexo-salvar')
        p.wait_for_selector('#cTempo a.at-anexo-drive')
        sd = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'salvar_drive']
        ok(len(sd) == 1 and sd[0]['mensagem_id'] == 'm7' and sd[0]['caminho'].endswith('/extrato.pdf'), 'chama a função com a mensagem e o caminho do arquivo')
        href = p.get_attribute('#cTempo a.at-anexo-drive', 'href'); rel = p.get_attribute('#cTempo a.at-anexo-drive', 'rel') or ''
        ok(href == 'https://drive.google.com/file/d/drv123456789/view' and 'noopener' in rel and p.locator('#cTempo .at-anexo-salvar').count() == 0, 'depois, o link "No Drive" no lugar do botão, numa aba nova')

        print('5. Passar pro DP')
        p.click('#cAcoes button[data-acao="transferir"]')
        p.select_option('#trSetor', 'dp'); p.fill('#trObs', 'é sobre férias')
        p.click('#cFaixas button[data-num="passar"]')
        p.wait_for_function("() => document.getElementById('cTempo').innerText.includes('passou pro DP')")
        k1 = conversa(p, 'k1')
        ok(k1['situacao'] == 'fila' and k1['setor'] == 'dp' and k1['responsavel'] is None, 'a fila do DP, sem ninguém')
        ev = [e for e in db(p, 'atend_eventos') if e['conversa_id'] == 'k1' and e['tipo'] == 'transferiu']
        ok(len(ev) == 1 and ev[0]['setor'] == 'dp' and ev[0]['observacao'] == 'é sobre férias', 'o evento transferiu, com o recado')
        ok('Thalia passou pro DP: “é sobre férias”' in p.inner_text('#cTempo') and p.inner_text('#nMinhas') == '0' and p.is_disabled('#mResposta'),
           'o recado no histórico, saiu das minhas e a caixa fica só na nota')

        print('6. O simulador')
        p.click('#btnSimulador'); p.wait_for_selector('#simulador:not([hidden])')
        p.select_option('#simQuem', '1'); p.select_option('#simSetor', 'fiscal')
        antes = len(p.evaluate('() => window.__avisos'))
        p.fill('#simTexto', 'Olá, quero saber do meu boleto'); p.click('#simEnviar')
        p.wait_for_function("() => [...document.querySelectorAll('.at-item .at-item-nome')].some(e => e.textContent.includes('Cliente de teste B'))")
        sim = next(c for c in db(p, 'atend_conversas') if c['telefone'] == '5551900000002')
        chamada = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'simular'][-1]
        ok(chamada['telefone'] == '5551900000002' and chamada['setor'] == 'fiscal' and chamada['nome'] == 'Cliente de teste B' and sim['teste'] is True,
           'o simulador manda o telefone, o nome e o setor; a conversa nasce de teste')
        ok(len(p.evaluate('() => window.__avisos')) > antes, 'a conversa nova na fila dela avisa (o bipe)')
        p.wait_for_function("() => document.getElementById('simTela').innerText.includes('quero saber do meu boleto')")
        ok(p.is_disabled('#simSetor'), 'com a conversa aberta, o setor do simulador trava (muda pelo "Passar pra…")')
        p.click('.at-item[data-id="%s"]' % sim['id'])
        p.wait_for_selector('#cAcoes button[data-acao="assumir"]')
        p.click('#cAcoes button[data-acao="assumir"]'); p.wait_for_function("() => !document.getElementById('cCaixa').hidden")
        p.fill('#cTexto', 'Oi! Já vejo pra você.'); p.press('#cTexto', 'Enter')
        p.wait_for_function("() => document.getElementById('simTela').innerText.includes('Oi! Já vejo pra você.')")
        ok('Macedo & Reis · Thalia' in p.inner_text('#simTela'), 'a resposta aparece no "celular" do cliente, com quem respondeu')
        p.fill('#simTexto', 'Obrigado!'); p.press('#simTexto', 'Enter')
        p.wait_for_function("() => document.getElementById('cTempo').innerText.includes('Obrigado!')")
        ok(len([c for c in db(p, 'atend_conversas') if c['telefone'] == '5551900000002']) == 1, 'a segunda mensagem do cliente segue na mesma conversa')
        # os arquivos (09/11/2026): o cliente manda uma foto, com o nome que é HTML; o escritório responde com um PDF
        png = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000') + b'\x00' * 40
        p.set_input_files('#simArquivo', files=[{'name': 'foto <b>nota</b>.png', 'mimeType': 'image/png', 'buffer': png}])
        ok('foto <b>nota</b>.png' in p.inner_text('#simEscolhidos'), 'o arquivo escolhido aparece no simulador, o nome como texto')
        p.click('#simEnviar')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-anexo').length === 1")
        arqs = p.evaluate('() => Object.keys(window.__mockDb.__arquivos || {})')
        chamada = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'simular'][-1]
        an = (chamada.get('anexos') or [{}])[0]
        ok(len(arqs) == 1 and arqs[0].startswith('atendimento/' + chamada['id'] + '/') and an.get('caminho') == arqs[0][len('atendimento/'):] and an.get('tipo') == 'image/png',
           f'a foto sobe na pasta atendimento, em <id da mensagem>/<nome>, e vai pra função com o caminho ({arqs})')
        ok(p.locator('#cTempo .at-anexo b').count() == 0 and 'foto <b>nota</b>.png' in p.inner_text('#cTempo .at-anexo') and p.locator('#cTempo img.at-anexo-img[src]').count() == 1,
           'na conversa, a foto com a miniatura e o nome escapado')
        ok(p.inner_text('#simEscolhidos') == '', 'mandou, a lista do simulador esvazia')
        p.set_input_files('#cArquivo', files=[{'name': 'guia DAS.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 teste'}])
        p.click('#cEnviar')
        p.wait_for_function("() => document.querySelectorAll('#cTempo .at-msg.saida .at-anexo').length === 1")
        p.wait_for_function("() => document.getElementById('simTela').innerText.includes('guia DAS.pdf')")
        resp = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'responder'][-1]
        ok(resp.get('texto') == '' and len(resp.get('anexos') or []) == 1 and resp['anexos'][0]['caminho'] == resp['id'] + '/guia DAS.pdf',
           'a resposta só com o PDF vai com o caminho na pasta da mensagem, sem texto, e chega no "celular"')
        p.evaluate("() => { window.__abertos = []; window.open = () => { const j = { opener: 1, close() {}, location: {} }; window.__abertos.push(j); return j; }; }")
        p.click('#cTempo .at-msg.saida .at-anexo'); p.wait_for_timeout(200)
        ab = p.evaluate('() => window.__abertos.map(j => [j.location.href, j.opener])')
        ok(len(ab) == 1 and 'arquivos.teste/atendimento/' in (ab[0][0] or '') and ab[0][1] is None, f'clicar abre o arquivo pelo link assinado, numa aba sem volta pra tela ({ab})')
        p.screenshot(path=str(FOTOS / 'atendimento-simulador.png'))

        print('6c. O assistente (a IA escolhe a fila)')
        ok(p.eval_on_selector('#simSetor', 'e => e.options[0].value') == 'robo', 'no simulador, o assistente é a primeira opção da fila')
        p.select_option('#simQuem', '2'); p.select_option('#simSetor', 'robo')
        p.fill('#simTexto', 'preciso ver as férias do meu funcionário'); p.click('#simEnviar')
        p.wait_for_function("() => document.getElementById('simTela').innerText.includes('Macedo & Reis · Assistente')")
        chamada = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'whatsapp' and x[1].get('acao') == 'simular'][-1]
        rob = next(c for c in db(p, 'atend_conversas') if c['telefone'] == '5551900000003')
        ok(chamada['setor'] == 'robo' and rob['situacao'] == 'fila' and rob['setor'] == 'dp', 'a conversa vai pro assistente e ele passa pro DP')
        ok('Já passei pra Vitória, do DP' in p.inner_text('#simTela') and p.inner_text('#simErro') == '', 'o cliente vê a resposta do assistente, sem aviso de erro')
        p.click('#aba-todas'); p.wait_for_timeout(150)
        if p.locator('#setores button[data-f="todos"]').is_visible(): p.click('#setores button[data-f="todos"]'); p.wait_for_timeout(150)
        p.click('.at-item[data-id="%s"]' % rob['id']); p.wait_for_timeout(200)
        fx = p.inner_text('#cFaixas')
        ok('O que o assistente entendeu: Quer saber das <b>férias</b> de um funcionário.' in fx and p.locator('#cFaixas b b').count() == 0, f'o resumo do assistente aparece na conversa, escapado ({fx[:120]!r})')
        ok('Assistente' in p.inner_text('#cTempo'), 'na conversa, a resposta é do Assistente')
        p.click('.at-item[data-id="%s"]' % sim['id']); p.wait_for_timeout(200)
        if p.locator('#setores button[data-f="meus"]').is_visible(): p.click('#setores button[data-f="meus"]'); p.wait_for_timeout(150)
        p.click('#simFechar'); p.wait_for_selector('#simulador', state='hidden')

        print('7. Encerrar, reabrir e a mudança de outra pessoa')
        p.click('#cAcoes button[data-acao="encerrar"]')
        p.wait_for_selector('#cAcoes button[data-acao="reabrir"]')
        ok(conversa(p, sim['id'])['situacao'] == 'encerrada' and 'Conversa encerrada' in p.inner_text('#cNota'), 'encerrada, com a nota pra reabrir')
        p.click('#aba-encerradas'); p.wait_for_timeout(150)
        ok(p.locator('.at-item[data-id="%s"]' % sim['id']).count() == 1, 'nas encerradas')
        p.click('#cAcoes button[data-acao="reabrir"]'); p.wait_for_function("() => !document.getElementById('cCaixa').hidden")
        ok(conversa(p, sim['id'])['situacao'] == 'atendendo' and conversa(p, sim['id'])['responsavel'] == THALIA, 'reabrir: de volta com ela')
        p.click('#aba-fila'); p.wait_for_timeout(100)
        k5 = conversa(p, 'k5'); k5.update({'situacao': 'atendendo', 'responsavel': VITORIA})
        p.evaluate('c => window.__mockEmitir("atend_conversas", "UPDATE", c)', k5)
        p.wait_for_function("() => !document.querySelector('.at-item[data-id=\"k5\"]')")
        ok(p.inner_text('#nFila') == '0', 'a Vitória pegou a do Pedro: saiu da fila na hora')
        antes = len(p.evaluate('() => window.__avisos'))
        p.evaluate("""() => window.__mockEmitir('atend_conversas', 'INSERT', { id: 'k9', telefone: '5551933332222', contato_nome: 'Lia', cliente_id: null, situacao: 'fila', setor: 'fiscal',
          responsavel: null, janela_ate: new Date(Date.now() + 864e5).toISOString(), ultima_em: new Date().toISOString(), ultima_do_cliente_em: new Date().toISOString(), teste: true, criado_em: new Date().toISOString() })""")
        p.wait_for_selector('.at-item[data-id="k9"]')
        ok(len(p.evaluate('() => window.__avisos')) > antes and p.inner_text('#nFila') == '1', 'uma conversa nova na fila do fiscal chega na hora, com o aviso')

        print('8. A conversa com outra pessoa')
        p2 = pagina(THALIA, url='atendimento.html?c=k3')
        p2.wait_for_function("() => document.getElementById('cNome').textContent.includes('João')")
        acoes = p2.eval_on_selector_all('#cAcoes button', 'bs => bs.map(b => b.dataset.acao)')
        ok(acoes == [] and 'A conversa está com Vitória.' in p2.inner_text('#cNota'), f'a Thalia não assume, não passa nem encerra a da Vitória ({acoes})')
        p2.context.close()
        p3 = pagina(SAMUEL, url='atendimento.html?c=k3')
        p3.wait_for_function("() => document.getElementById('cNome').textContent.includes('João')")
        acoes = p3.eval_on_selector_all('#cAcoes button', 'bs => bs.map(b => b.dataset.acao)')
        ok('transferir' in acoes and 'encerrar' in acoes and 'assumir' not in acoes, f'o Samuel (sócio) passa e encerra ({acoes})')
        p3.context.close()

        print('9. No celular')
        p4 = pagina(THALIA, largura=420)
        ok(p4.is_visible('.at-lista') and not p4.is_visible('#conversa'), 'a lista ocupa a tela')
        p4.click('.at-item[data-id="k5"]'); p4.wait_for_selector('#btnVoltar', state='visible')
        ok(not p4.is_visible('.at-lista') and p4.is_visible('#cTempo'), 'a conversa toma a tela')
        larg = p4.evaluate('() => document.documentElement.scrollWidth')
        ok(larg <= 420, f'sem rolagem pro lado ({larg} px)')
        p4.click('#btnVoltar'); p4.wait_for_timeout(150)
        ok(p4.is_visible('.at-lista'), '"Voltar pra lista" volta')
        p4.screenshot(path=str(FOTOS / 'atendimento-celular.png'))
        p4.context.close()

        print('10. O card no Painel central')
        p5 = b.new_page(viewport={'width': 1400, 'height': 900})
        p5.on('pageerror', lambda e: erros.append(f'painel: {e}'))
        p5.add_init_script(f"window.__mockEmail = {json.dumps(THALIA)};"); p5.add_init_script(SEMEAR)
        p5.goto(base + 'index.html')
        p5.wait_for_function("() => { const s = document.querySelector('a.dashboard-card[href=\"atendimento.html\"] .card-status'); return s && s.textContent.trim() !== '·'; }", timeout=8000)
        st = p5.text_content('a.dashboard-card[href="atendimento.html"] .card-status').strip()
        ok(st == '2 pra você', f'o card do Atendimento diz quantas são pra quem entrou ({st!r})')
        p5.close()

        ok(not erros, 'nenhum erro de JavaScript' + (f': {erros}' if erros else ''))
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
