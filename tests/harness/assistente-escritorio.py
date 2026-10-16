"""Teste do assistente do escritório nas telas (assets/js/assistente-escritorio.js, montado pelo auth-guard, 14/10/2026):
o mesmo balão em todas as telas com login, a conversa que acompanha de tela em tela, a resposta retomada depois de trocar de
tela (pela linha do histórico, assistente_chat), as perguntas prontas e o recado do dia de cada tela (contado do banco, sem
IA), a empresa aberta na ficha como contexto, a carinha viva (olhos que seguem o mouse, comemoração ao concluir, discreta
com janela aberta) e nada nas telas públicas. A Edge Function "assistente" entra como dublê, por window.__mockInvoke; a
função tem teste próprio em tests/assistente-funcao.test.mjs; a tela da Reforma, em tests/harness/reforma-chat.py.
Sem login e sem banco: mesmo mock do conferir.py; os dados (inventados) entram por uma armadilha em window.__mockDb.

    python tests/harness/assistente-escritorio.py

Confere:
  1. o balão em várias telas (sem erro de JavaScript); a tela e o setor na frase de status e nas perguntas prontas;
  2. a saudação do dia na primeira tela e o recado do dia de outra (Boletos), uma vez por tela;
  3. a conversa acompanha de tela em tela, com o painel aberto; a pergunta vai com a tela de onde saiu;
  4. trocou de tela no meio da resposta: a tela nova retoma pelo id da pergunta; pergunta que não chegou volta pra caixa;
  5. na ficha da empresa (clientes/editar.html?id=…): a faixa "Sobre a empresa aberta", o recado e a empresa na pergunta;
  6. olhos seguem o mouse; concluir tarefa faz a carinha comemorar (e a cada 5, um recadinho); com janela aberta, discreta;
  7. nas telas públicas (admissão, rescisão), nada de assistente.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, re, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
# os boletos que vencem este mês são os da competência do mês passado (gerados no começo do mês)
COMP = (HOJE.replace(day=1) - datetime.timedelta(days=1)).strftime('%Y-%m')
EMPRESA = '9a1b2c3d-0000-4000-8000-00000000c0de'
CLIENTES = [{'id': EMPRESA, 'nome_principal': 'PADARIA DO TESTE LTDA', 'nome_fantasia': 'PADARIA TESTE', 'documento': '10000000000272', 'status': 'ativo', 'tipo_pessoa': 'PJ'}]
COBRANCAS = [{'id': 'cb1', 'cliente_id': EMPRESA, 'competencia': COMP, 'valor': 450, 'vencimento': (HOJE + datetime.timedelta(days=3)).isoformat(), 'status': 'enviado'},
             {'id': 'cb2', 'cliente_id': EMPRESA, 'competencia': COMP, 'valor': 300, 'vencimento': (HOJE + datetime.timedelta(days=20)).isoformat(), 'status': 'a_emitir'}]
SEMEAR = """
(() => {
  const CLIENTES = %s, COBRANCAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); v.cobrancas_mensais = COBRANCAS; v.assistente_chat = [];
  } });
  window.__chamadas = [];
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    await new Promise(r => setTimeout(r, window.__demora || 0));
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    return { data: ev({ tipo: 'etapa', texto: 'Consultando as tarefas' }) + ev({ tipo: 'resposta', texto: 'Resposta pra: ' + opts.body.pergunta }), error: null };
  };
})();
""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(COBRANCAS, ensure_ascii=False))
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
        p.add_init_script('window.__assistenteRecados = true')
        chamadas = lambda: p.evaluate('window.__chamadas || []')

        # 1) o balão em várias telas
        vistos = []
        for t in ['index.html', 'dp-admissoes.html', 'clientes/index.html', 'fiscal-obrigacoes.html']:
            p.goto(base + t); p.wait_for_selector('.as-lancador', timeout=5000)
            vistos.append((t, p.evaluate("() => document.querySelectorAll('.as-raiz').length"), p.inner_text('.as-status-txt')))
        ok(all(n == 1 for _, n, _ in vistos) and not erros, f'um balão só em cada tela, sem erro de JavaScript ({[(t, n) for t, n, _ in vistos]}, {erros[:1]})')
        ok(vistos[1][2] == 'Vê tudo do sistema · Admissões' and vistos[2][2] == 'Vê tudo do sistema · Clientes', f'a frase de status diz a tela ({[s for _, _, s in vistos]})')
        # a primeira tela do dia já mostrou a saudação; as outras não repetem
        p.goto(base + 'agenda.html'); p.wait_for_selector('.as-lancador', timeout=5000); p.wait_for_timeout(300)
        p.click('.as-lancador'); p.wait_for_timeout(250)
        ex = p.eval_on_selector_all('.as-msgs .as-chip', 'bs => bs.map(b => b.textContent)')
        ok(ex == ['O que tenho pra hoje?', 'O que tenho esta semana?', 'O que está atrasado, por pessoa?'] and 'Eu vejo tudo do sistema' in p.inner_text('.as-msgs'), f'na Agenda, as perguntas prontas da Agenda ({ex})')
        p.click('.as-lancador'); p.wait_for_timeout(150)

        # 2) os recados do dia (o 1º, a saudação, já saiu no index; agora o de Boletos)
        p.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('mr_assistente_dia:')) localStorage.removeItem(k); }")
        p.goto(base + 'index.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=5000)
        sauda = p.inner_text('.as-recado-txt')
        ok(re.match(r'(Bom dia|Boa tarde|Boa noite), Samuel!', sauda) is not None and 'O que tenho pra hoje?' in p.inner_text('.as-recado .as-chips'), f'a saudação do dia, com a agenda de quem entrou ({sauda[:70]})')
        p.click('.as-recado-x')
        p.goto(base + 'financeiro-boletos.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=5000)
        dica = p.inner_text('.as-recado-txt')
        ok(re.search(r'Boletos de \w+: 1 boleto a emitir, 1 vence nos próximos 7 dias\.', dica) is not None, f'o recado do dia de Boletos, contado do banco ({dica[:90]})')
        p.click('.as-recado-x'); p.reload(); p.wait_for_timeout(2600)
        ok(p.is_hidden('.as-recado'), 'voltando à mesma tela no mesmo dia, o recado não repete')

        # 3) a conversa acompanha de tela em tela
        p.click('.as-lancador'); p.wait_for_timeout(200)
        antes = len(chamadas())
        p.fill('.as-entrada textarea', 'Quais boletos estão em aberto?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_function(f'() => (window.__chamadas || []).length === {antes + 1}', timeout=4000)
        p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado') && !document.querySelector('.as-pal')", timeout=6000)
        corpo = chamadas()[-1]['body']
        ok(chamadas()[-1]['nome'] == 'assistente' and corpo['contexto'] == {'pagina': {'caminho': 'financeiro-boletos.html', 'nome': 'Boletos', 'setor': 'financeiro'}},
           f'a pergunta vai pra função do assistente com a tela de onde saiu ({corpo["contexto"]})')
        p.goto(base + 'dp-admissoes.html'); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000)
        ok('Resposta pra: Quais boletos estão em aberto?' in p.inner_text('.as-msgs'), 'trocando de tela, o painel continua aberto com a conversa')
        antes = len(chamadas())
        p.fill('.as-entrada textarea', 'E as admissões?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_function(f'() => (window.__chamadas || []).length === {antes + 1}', timeout=4000)
        c2 = chamadas()[-1]['body']
        ok(c2['contexto']['pagina']['caminho'] == 'dp-admissoes.html' and [h['pergunta'] for h in c2['historico']] == ['Quais boletos estão em aberto?'],
           'na outra tela, a pergunta leva a tela nova e o histórico da conversa')
        p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)

        # 4) trocou de tela no meio da resposta: a tela nova retoma pelo id da pergunta
        p.evaluate('window.__demora = 8000')
        antes = len(chamadas())
        p.fill('.as-entrada textarea', 'Pergunta demorada?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_function(f'() => (window.__chamadas || []).length === {antes + 1}', timeout=4000)
        pedido = chamadas()[-1]['body']['pedido']
        p.goto(base + 'agenda.html'); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_timeout(400)
        retomando = p.evaluate("() => ({ ocupado: document.querySelector('.as-raiz').classList.contains('as-ocupado'), lendo: (document.querySelector('.as-lendo') || {}).textContent })")
        ok(retomando['ocupado'] and retomando['lendo'] == 'Terminando a resposta…', f'na tela nova, a pergunta ainda no ar: "digitando…" ({retomando})')
        p.evaluate('id => window.__mockDb.assistente_chat.push({ id, situacao: "ok", resposta: "A resposta chegou na tela nova.", fontes: { reforma: false } })', pedido)
        p.wait_for_function("() => document.querySelector('.as-msgs').innerText.includes('A resposta chegou na tela nova.')", timeout=8000)
        ok(not p.evaluate("() => document.querySelector('.as-raiz').classList.contains('as-ocupado')"), 'a resposta chega pela linha do histórico (o id da pergunta) e o assistente libera')
        # a pergunta que não chegou a sair: volta pra caixa (a demora vale por tela: põe de novo nesta)
        p.evaluate('window.__demora = 8000')
        antes = len(chamadas())
        p.fill('.as-entrada textarea', 'Esta não chega?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_function(f'() => (window.__chamadas || []).length === {antes + 1}', timeout=4000)
        p.goto(base + 'index.html'); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000)
        p.wait_for_function("() => document.querySelector('.as-msgs').innerText.includes('A página mudou antes de a pergunta chegar')", timeout=15000)
        ok(p.input_value('.as-entrada textarea') == 'Esta não chega?', 'pergunta que não chegou: o aviso e a pergunta de volta na caixa')
        p.evaluate('window.__demora = 0')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 5) a ficha da empresa
        p.goto(base + 'clientes/editar.html?id=' + EMPRESA); p.wait_for_selector('.as-lancador', timeout=5000)
        p.wait_for_selector('.as-recado:not([hidden])', timeout=5000)
        ok('Quer um resumo de PADARIA DO TESTE LTDA?' in p.inner_text('.as-recado'), 'na ficha da empresa, o recado oferece o resumo dela')
        antes = len(chamadas())
        p.click('.as-recado .as-chip')
        p.wait_for_function(f'() => (window.__chamadas || []).length === {antes + 1}', timeout=4000)
        c3 = chamadas()[-1]['body']
        ok(c3['pergunta'] == 'Me resume esta empresa' and c3['contexto'].get('cliente_id') == EMPRESA and c3['contexto']['pagina']['caminho'] == 'clientes/editar.html',
           f'a pergunta vai com a empresa aberta ({c3["contexto"]})')
        ok(p.inner_text('.as-ctx') == 'Sobre a empresa aberta: PADARIA DO TESTE LTDA' and 'Sobre PADARIA DO TESTE LTDA' in p.inner_text('.as-msgs'),
           f'a faixa e a nota da conversa dizem qual empresa ({p.inner_text(".as-ctx")})')
        p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 6) a carinha viva
        p.goto(base + 'agenda.html'); p.wait_for_selector('.as-lancador', timeout=5000); p.wait_for_timeout(300)
        p.mouse.move(100, 100); p.wait_for_timeout(100); p.mouse.move(120, 110); p.wait_for_timeout(250)
        olhar = p.evaluate("() => document.querySelector('.as-lancador .as-mira').style.transform")
        ok(bool(re.match(r'translate\(-\d', olhar or '')), f'os olhos olham pro mouse (em cima, à esquerda: {olhar})')
        p.evaluate("() => window.dispatchEvent(new CustomEvent('mr:feito', { detail: { n: 1 } }))"); p.wait_for_timeout(60)
        cls = p.get_attribute('.as-raiz', 'class')
        ok('as-pulo' in cls and 'as-sorrindo' in cls, 'concluiu uma tarefa: a carinha sorri e pula')
        p.evaluate("() => window.dispatchEvent(new CustomEvent('mr:feito', { detail: { n: 4 } }))"); p.wait_for_timeout(200)
        ok(p.is_visible('.as-recado') and 'Já são 5 concluídas hoje' in p.inner_text('.as-recado'), 'a cada 5 no dia, um recadinho')
        p.click('.as-recado-x')
        p.evaluate("() => document.body.insertAdjacentHTML('beforeend', '<div id=\"janelaTeste\" style=\"position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:60\"><button>Fechar</button></div>')")
        p.mouse.click(300, 300); p.wait_for_timeout(1100)
        ok('as-sob-janela' in p.get_attribute('.as-raiz', 'class'), 'com uma janela aberta, o balão fica discreto')
        p.evaluate("() => document.getElementById('janelaTeste').remove()"); p.mouse.click(300, 300); p.wait_for_timeout(1100)
        ok('as-sob-janela' not in p.get_attribute('.as-raiz', 'class'), 'fechou a janela, o balão volta ao normal')

        # 7) telas públicas
        for t in ['admissao.html', 'rescisao.html']:
            p.goto(base + t); p.wait_for_timeout(1200)
            ok(p.evaluate("() => !document.querySelector('.as-raiz')"), 'nada de assistente na tela pública ' + t)

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
