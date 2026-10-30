"""Teste dos cadastros do assistente do escritório (30/10/2026, pedido do Samuel: "as vezes acho que o assistente ta um pouco
limitado nas ações, preciso que esse tipo de coisa ele possa fazer") — os cartões de assets/js/assistente-acoes.js com as
regras de assets/js/tarefas-acoes.js: incluir empresa na campanha da Reforma, pôr empresa num mês dos boletos e ajustar as
obrigações das empresas em lote. A Edge Function "assistente" entra como dublê, por window.__mockInvoke (devolve a proposta
conforme a pergunta); a função tem teste próprio em tests/assistente-funcao.test.mjs e as regras, em tests/tarefas-acoes.test.mjs.
Sem login e sem banco: mesmo mock do conferir.py (quem está na tela é o Samuel, financeiro@); os dados (inventados) entram
por uma armadilha em window.__mockDb.

    python tests/harness/assistente-cadastros.py

Confere:
  1. na tela Reforma Tributária: o cartão lista as empresas sem caso (o CNPJ, o regime de hoje marcado quando não é o
     Simples, se está na carteira) e diz a que já está; a observação que a IA preparou vem no campo; incluir grava os
     casos (triado, pendente, o CNAE, a observação com quem pediu) e a lista da tela recarrega sozinha; desfazer tira;
     com uma empresa só, o "Abrir o caso" abre a ficha dela; recarregar a página mantém o estado do cartão;
  2. na tela Boletos: o valor copiado da cobrança mais recente e o vencimento no mês seguinte, no dia útil; a empresa sem
     nada pede o valor (e avisa que ganha a base); pôr grava "a emitir", cria a base de quem não tinha e a grade do mês
     recarrega; desfazer tira as duas coisas;
  3. na tela Obrigações fiscais: passar a obrigação pra Deize — a desligada fica de fora; grava, as tarefas abertas que
     estavam com quem cuidava vão junto (a concluída fica), com o histórico, e a tela recarrega; desfazer volta; o dia do
     prazo daqui pra frente; desligar e desfazer (liga de novo).
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
D = lambda n: (HOJE + datetime.timedelta(days=n)).isoformat()
COMP = HOJE.strftime('%Y-%m')
ANT = (HOJE.replace(day=1) - datetime.timedelta(days=1)).strftime('%Y-%m')
MES_BR = COMP[5:7] + '/' + COMP[:4]
E1, E2, E4 = ('9b1b2c3d-0000-4000-8000-0000000000f1', '9b1b2c3d-0000-4000-8000-0000000000f2', '9b1b2c3d-0000-4000-8000-0000000000f4')
CLIENTES = [{'id': E1, 'nome_principal': 'MERCADO DO TESTE LTDA', 'nome_fantasia': 'MERCADINHO', 'documento': '63552438000100', 'status': 'ativo', 'tipo_pessoa': 'PJ',
             'regime_tributario': 'Lucro Real', 'cnae_principal': '4711-3/02 - Supermercados', 'cidade': 'Três Coroas'},
            {'id': E2, 'nome_principal': 'OFICINA DO TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000353', 'status': 'ativo', 'tipo_pessoa': 'PJ',
             'regime_tributario': 'Simples Nacional', 'cnae_principal': '4520-0/01', 'cidade': 'Igrejinha'},
            {'id': E4, 'nome_principal': 'ESCRITORIO DO TESTE LTDA', 'nome_fantasia': 'CONTABILIDADE DE TESTE', 'documento': '19208576000177', 'status': 'ativo', 'tipo_pessoa': 'PJ',
             'regime_tributario': 'Simples Nacional', 'cnae_principal': '6920-6/01', 'cidade': 'Três Coroas'}]
CASOS = [{'id': 'yc-2', 'cliente_id': E2, 'campanha': 'Opção IBS/CBS 2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '4520-0/01', 'segmento': None, 'triagem': 'simular', 'score': 3,
          'sinal_b2b': 1, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 1, 'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None,
          'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Entrou na campanha pela carteira (teste).', 'atualizado_em': '2026-10-01T12:00:00.000Z'}]
COBRANCAS = [{'id': 'yb-1', 'cliente_id': E1, 'competencia': ANT, 'valor': 450, 'vencimento': COMP + '-10', 'status': 'pago', 'canal': 'whatsapp', 'contato_envio': 'Fulano',
              'destino': '5551999990000', 'responsavel': 'Samuel', 'observacao': '', 'itens_extras': []},
             {'id': 'yb-2', 'cliente_id': E2, 'competencia': COMP, 'valor': 300, 'vencimento': D(20), 'status': 'enviado', 'canal': 'whatsapp', 'contato_envio': '', 'destino': '',
              'responsavel': '', 'observacao': '', 'itens_extras': []}]
BASES = [{'id': 'yg-1', 'cliente_id': E1, 'valor_base': 450, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': 'Fulano', 'destino': '5551999990000', 'responsavel': 'Samuel', 'ativo': True},
         {'id': 'yg-2', 'cliente_id': E2, 'valor_base': 300, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True}]
def T(i, cli, resp, status='pendente'):
    return {'id': 'yt-' + i, 'titulo': 'EFD TESTE MENSAL', 'setor': 'fiscal', 'responsavel': resp, 'prazo': D(5), 'status': status, 'prioridade': 'media', 'cliente_id': cli,
            'clientes': None, 'faturavel': False, 'hora': None, 'posicao': 0, 'concluida_em': None, 'concluida_por': None, 'proposta_id': None, 'transicao_id': None,
            'obrigacao_id': 'o1', 'origem': 'recorrente', 'competencia': COMP}
TAREFAS = [T('1', 'c2', 'Thalia'), T('2', 'c2', 'Thalia', 'concluida'), T('3', 'c1', None)]
ACOES = {
    'Inclui na Reforma o mercado, a oficina e o escritório': {'tipo': 'incluir_reforma', 'ids': [E1, E2, E4], 'observacao': 'vai pro Simples Nacional em 2027'},
    'Inclui só o mercado na Reforma': {'tipo': 'incluir_reforma', 'ids': [E1]},
    'Põe nos boletos do mês': {'tipo': 'por_na_competencia', 'competencia': COMP, 'ids': [E1, E2, E4]},
    'Passa a EFD pra Deize': {'tipo': 'ajustar_obrigacoes', 'ids': ['v1', 'v2', 'v3'], 'mudar': {'responsavel': 'Deize'}},
    'Muda o dia da EFD da Exemplo pra 30': {'tipo': 'ajustar_obrigacoes', 'ids': ['v2'], 'mudar': {'dia': 30}},
    'Desliga a EFD do Modelo': {'tipo': 'ajustar_obrigacoes', 'ids': ['v1'], 'mudar': {'desligar': True}}}
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, COBRANCAS = %s, BASES = %s, TAREFAS = %s, ACOES = %s, E1 = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); v.rt_casos = CASOS; v.cobrancas_mensais = COBRANCAS; v.cobrancas_config = BASES; v.tarefas.push(...TAREFAS);
    v.assistente_chat = []; v.tarefa_historico = v.tarefa_historico || [];
    v.carteira_info = (v.carteira_info || []).concat([{ cliente_id: E1, entrada: '2026-01-01', saida: null }]);
  } });
  window.__mudou = [];
  ['mr:reforma-mudou', 'mr:boletos-mudaram', 'mr:obrigacoes-mudaram', 'mr:tarefas-mudaram'].forEach(n => addEventListener(n, () => window.__mudou.push(n)));
  window.__mockInvoke = async (nome, opts) => {
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    const acao = ACOES[opts.body.pergunta] || null;
    return { data: ev({ tipo: 'etapa', texto: 'Separando pra você confirmar' }) + ev({ tipo: 'resposta', texto: 'Separei: confirme no cartão.', ...(acao ? { acao } : {}) }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, COBRANCAS, BASES, TAREFAS, ACOES, E1))
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
        db = lambda js, *a: p.evaluate(js, *a)
        def perguntar(texto):
            if not p.is_visible('.as-entrada textarea'): p.click('.as-lancador'); p.wait_for_timeout(200)
            p.fill('.as-entrada textarea', texto); p.press('.as-entrada textarea', 'Enter')
            p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)
        ultimo = '.as-lista .as-msg.ia:last-child .as-cartao'
        espera_texto = lambda sel, comeco: p.wait_for_function("([s, c]) => { const e = document.querySelector(s); return e && e.innerText.startsWith(c); }", arg=[sel, comeco], timeout=6000)

        # 1) a campanha da Reforma, na tela dela
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_selector('#rtLista tr[data-id]', timeout=8000); p.wait_for_selector('.as-lancador', timeout=5000)
        linhas = lambda: p.eval_on_selector_all('#rtLista tr[data-id]', 'ts => ts.map(t => t.dataset.id)')
        ok(linhas() == ['yc-2'], f'antes: a lista da Reforma tem só a oficina ({linhas()})')
        perguntar('Inclui na Reforma o mercado, a oficina e o escritório')
        p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=6000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Incluir 2 empresas na campanha da Reforma?') and 'MERCADO DO TESTE LTDA' in card and 'ESCRITORIO DO TESTE LTDA' in card
           and 'Já está na campanha: OFICINA DO TESTE LTDA.' in card, f'o cartão: as duas sem caso, e a que já está à parte ({card[:200]!r})')
        ok('MERCADINHO · 63.552.438/0001-00 · na carteira desde 01/01/2026' in card and 'CONTABILIDADE DE TESTE · 19.208.576/0001-77 · fora da carteira' in card,
           'cada uma com a fantasia, o CNPJ e se está na carteira')
        tags = p.eval_on_selector_all(ultimo + ' .as-tag', 'ts => ts.map(t => t.innerText)')
        ok(tags == ['hoje: Lucro Real'], f'o regime de hoje marcado só na que não é do Simples ({tags})')
        ok(p.input_value(ultimo + ' textarea') == 'vai pro Simples Nacional em 2027', 'a observação que a IA preparou vem no campo')
        p.fill(ultimo + ' textarea', 'vão pro Simples Nacional em 2027')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=6000)
        casos = db('() => window.__mockDb.rt_casos.filter(c => c.id !== "yc-2")')
        hoje_br = HOJE.strftime('%d/%m/%Y')
        ok(len(casos) == 2 and sorted(c['cliente_id'] for c in casos) == sorted([E1, E4]) and all(c['status'] == 'triado' and c['decisao'] == 'pendente' for c in casos)
           and all(c['obs'] == f'Entrou na campanha pelo assistente do escritório em {hoje_br}, a pedido de Samuel: vão pro Simples Nacional em 2027.' for c in casos)
           and next(c for c in casos if c['cliente_id'] == E1)['cnae_base'] == '4711-3/02', f'incluiu: triado, pendente, o CNAE e a observação editada ({[(c.get("cnae_base"), c.get("obs")) for c in casos]})')
        p.wait_for_function("() => document.querySelectorAll('#rtLista tr[data-id]').length === 3", timeout=6000)
        ok(len(linhas()) == 3 and 'mr:reforma-mudou' in db('window.__mudou'), 'a lista da Reforma recarrega sozinha, com as duas novas')
        ok(p.inner_text(ultimo).startswith('✓ 2 empresas incluídas na campanha da Reforma.') and p.inner_text(ultimo + ' a.as-botao') == 'Abrir a Reforma', 'o cartão diz o que fez, com "Abrir a Reforma" e "Desfazer"')
        p.click(ultimo + ' button.as-botao-link'); espera_texto(ultimo, '↺ Desfeito')
        ok(db('() => window.__mockDb.rt_casos.map(c => c.id)') == ['yc-2'] and p.inner_text(ultimo).startswith('↺ Desfeito: 2 empresas saíram da campanha.'), 'desfazer: os casos saem')
        p.wait_for_function("() => document.querySelectorAll('#rtLista tr[data-id]').length === 1", timeout=6000)
        ok(linhas() == ['yc-2'], 'e a lista volta a só a oficina')
        perguntar('Inclui só o mercado na Reforma'); p.wait_for_selector(ultimo + ' .as-botao-pri', timeout=6000)
        ok(p.input_value(ultimo + ' textarea') == '', 'sem observação da IA, o campo vem vazio')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' a.as-botao', timeout=6000)
        novo = db('() => window.__mockDb.rt_casos.find(c => c.id !== "yc-2")')
        ok(novo['obs'] == f'Entrou na campanha pelo assistente do escritório em {hoje_br}, a pedido de Samuel.', f'sem observação, a frase sem o porquê ({novo["obs"]!r})')
        ok(p.inner_text(ultimo + ' a.as-botao') == 'Abrir o caso' and p.get_attribute(ultimo + ' a.as-botao', 'href').endswith('fiscal-reforma.html#caso-' + novo['id']), 'uma empresa só: "Abrir o caso", com o link da ficha')
        p.click(ultimo + ' a.as-botao'); p.wait_for_function("() => (document.getElementById('fiNome') || {}).textContent === 'MERCADO DO TESTE LTDA'", timeout=6000)
        ok(True, 'o "Abrir o caso" abre a ficha do mercado')
        p.goto(base + 'fiscal-reforma.html#caso-' + novo['id']); p.wait_for_function("() => (document.getElementById('fiNome') || {}).textContent === 'MERCADO DO TESTE LTDA'", timeout=8000)
        ok(True, 'vindo de outra tela, o link do caso abre a ficha depois de carregar a lista')
        p.wait_for_selector('.as-cartao', timeout=6000)
        ok(p.inner_text('.as-lista .as-msg.ia:last-child .as-cartao').startswith('✓ 1 empresa incluída na campanha da Reforma.'), 'recarregou: o cartão volta no estado em que ficou')

        # 2) pôr no mês dos boletos
        p.goto(base + 'financeiro-boletos.html'); p.wait_for_selector('tr select.st', timeout=8000)
        grade = lambda: p.eval_on_selector_all('#tbody tr', 'ts => ts.length')
        ok(grade() == 1, f'antes: a grade de {MES_BR} tem só a oficina ({grade()})')
        venc = p.evaluate("async c => (await import(new URL('assets/js/tarefas-acoes.js', location.href).href)).vencimentoDaCompetencia(c, 10)", COMP)
        perguntar('Põe nos boletos do mês'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=6000)
        card = p.inner_text(ultimo)
        ok(card.startswith(f'Pôr 2 empresas nos boletos de {MES_BR}?') and f'Já está em {MES_BR}: OFICINA DO TESTE LTDA.' in card, f'o cartão: as duas que faltam, e a que já está ({card[:160]!r})')
        valores = p.eval_on_selector_all(ultimo + ' input[type="text"]', 'es => es.map(e => e.value)')
        datas = p.eval_on_selector_all(ultimo + ' input[type="date"]', 'es => es.map(e => e.value)')
        ok(valores == ['450,00', ''] and datas == [venc, venc], f'o valor copiado da cobrança mais recente; o vencimento no mês seguinte, no dia útil ({valores}, {datas}, {venc})')
        ok(f'copiado de {ANT[5:7]}/{ANT[:4]}' in card and 'sem cobrança anterior nem base: preencha o valor' in card and 'Sem base de cobrança: ganha a base' in card, 'de onde veio cada valor, e o aviso de quem ganha a base')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_timeout(200)
        ok(p.inner_text(ultimo + ' .as-cartao-erro') == 'Preencha o valor de ESCRITORIO DO TESTE LTDA.' and db('() => window.__mockDb.cobrancas_mensais.length') == 2, 'sem o valor, não grava e diz de quem falta')
        p.fill(ultimo + ' input[type="text"] >> nth=1', '1.234,50')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=6000)
        novos = db(f'() => window.__mockDb.cobrancas_mensais.filter(b => b.competencia === "{COMP}" && b.id !== "yb-2")')
        n1 = next((x for x in novos if x['cliente_id'] == E1), {}); n4 = next((x for x in novos if x['cliente_id'] == E4), {})
        ok(len(novos) == 2 and n1.get('valor') == 450 and n1.get('status') == 'a_emitir' and n1.get('contato_envio') == 'Fulano' and n1.get('vencimento') == venc
           and n4.get('valor') == 1234.5 and n4.get('status') == 'a_emitir', f'pôs as duas "a emitir", com o valor, o vencimento e os dados de envio ({[(x.get("valor"), x.get("status")) for x in novos]})')
        base4 = db(f'() => window.__mockDb.cobrancas_config.find(c => c.cliente_id === "{E4}")')
        ok(bool(base4) and base4['valor_base'] == 1234.5 and base4['dia_vencimento'] == int(venc[8:10]) and base4['ativo'] is True, 'a empresa sem base ganhou a base de cobrança (os próximos meses geram)')
        p.wait_for_function("() => document.querySelectorAll('#tbody tr').length === 3", timeout=6000)
        ok(grade() == 3, 'a grade do mês recarrega sozinha, com as duas novas')
        ok(p.inner_text(ultimo).startswith(f'✓ 2 boletos postos em {MES_BR}, a emitir.') and 'ganhou a base' in p.inner_text(ultimo)
           and p.get_attribute(ultimo + ' a.as-botao', 'href').endswith('financeiro-boletos.html?competencia=' + COMP), 'o cartão diz o que fez, com "Abrir Boletos" no mês')
        p.click(ultimo + ' button.as-botao-link'); espera_texto(ultimo, '↺ Desfeito')
        ok(db(f'() => window.__mockDb.cobrancas_mensais.filter(b => b.competencia === "{COMP}").map(b => b.id)') == ['yb-2']
           and not db(f'() => window.__mockDb.cobrancas_config.some(c => c.cliente_id === "{E4}")'), 'desfazer: os boletos saem, e a base que nasceu ali também')
        p.wait_for_function("() => document.querySelectorAll('#tbody tr').length === 1", timeout=6000)
        ok(grade() == 1, 'e a grade volta')
        p.goto(base + 'financeiro-boletos.html?competencia=' + ANT); p.wait_for_selector('tr select.st', timeout=8000)
        ok(p.input_value('#comp') == ANT and grade() == 1, 'o link com ?competencia= abre a tela naquele mês')

        # 3) as obrigações das empresas, em lote
        p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_selector('#segFiltro button[data-f="todos"]', timeout=8000); p.wait_for_timeout(600)
        if p.is_visible('.as-acao[data-a="fechar"]'): p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(200)   # o painel aberto cobre a tela
        p.click('#segFiltro button[data-f="todos"]'); p.wait_for_timeout(300)
        p.click('.obr-head[data-rid="o1"]'); p.wait_for_timeout(300)
        resp_tela = lambda vid: p.inner_text(f'.obr-cli[data-vid="{vid}"] .dt-edit[data-edit="resp"]')
        ok(resp_tela('v2') == 'Thalia', 'antes: a EFD da EMPRESA EXEMPLO está com a Thalia')
        # as tarefas abertas da EFD que vão junto: as do COMÉRCIO MODELO sem ninguém e as da EXEMPLO com a Thalia (as nossas e as do mock)
        juntas = db("() => window.__mockDb.tarefas.filter(x => x.obrigacao_id === 'o1' && x.status !== 'concluida' && ((x.cliente_id === 'c1' && x.responsavel == null) || (x.cliente_id === 'c2' && x.responsavel === 'Thalia'))).map(x => x.id)")
        perguntar('Passa a EFD pra Deize'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=6000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Mudar EFD TESTE MENSAL em 2 empresas?') and 'COMÉRCIO MODELO ME' in card and 'quem cuida: ninguém → Deize' in card and 'quem cuida: Thalia → Deize' in card
           and '1 outra já está assim (ou foi desligada).' in card and 'vão junto pra Deize' in card, f'o cartão: as duas ligadas com o antes e o depois; a desligada fica de fora ({card[:260]!r})')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=6000)
        v = lambda i: db('i => window.__mockDb.cliente_obrigacoes.find(x => x.id === i)', i)
        t = lambda i: db('i => window.__mockDb.tarefas.find(x => x.id === i)', i)
        ok(v('v1')['responsavel'] == 'Deize' and v('v2')['responsavel'] == 'Deize' and v('v3')['responsavel'] is None, 'gravou: as duas ligadas com a Deize; a desligada como estava')
        ok(t('yt-1')['responsavel'] == 'Deize' and t('yt-3')['responsavel'] == 'Deize' and t('yt-2')['responsavel'] == 'Thalia', 'as tarefas abertas vão junto (a que estava com a Thalia e a sem ninguém); a concluída fica')
        hist = db('() => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === "yt-1").map(h => h.descricao)')
        ok(hist == ['Responsável trocado na obrigação: Thalia → Deize — pelo assistente do escritório.'], f'a linha no histórico da tarefa ({hist})')
        p.wait_for_function("() => (document.querySelector('.obr-cli[data-vid=\"v2\"] .dt-edit[data-edit=\"resp\"]') || {}).innerText === 'Deize'", timeout=6000)
        ok(True, 'a tela Obrigações fiscais recarrega sozinha (a EMPRESA EXEMPLO com a Deize)')
        txt = p.inner_text(ultimo)
        ok(txt.startswith('✓ Mudou em 2 empresas.') and f'{len(juntas)} tarefas abertas foram junto pra Deize.' in txt and len(juntas) >= 2
           and all(t(i)['responsavel'] == 'Deize' for i in juntas), f'o cartão diz o que fez e quantas tarefas foram junto ({txt!r}, {juntas})')
        p.click(ultimo + ' button.as-botao-link'); espera_texto(ultimo, '↺ Desfeito')
        ok(v('v1')['responsavel'] is None and v('v2')['responsavel'] == 'Thalia' and t('yt-1')['responsavel'] == 'Thalia' and t('yt-3')['responsavel'] is None,
           'desfazer: os vínculos e as tarefas voltam a quem estava')
        txt = p.inner_text(ultimo)
        ok(txt.startswith(f'↺ Desfeito: 2 empresas voltaram a como estava, com {len(juntas)} tarefas.'), f'o cartão diz o que voltou ({txt!r})')
        perguntar('Muda o dia da EFD da Exemplo pra 30'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=6000)
        ok('dia do prazo: 10 → 30' in p.inner_text(ultimo) and 'as já criadas ficam com o prazo delas' in p.inner_text(ultimo), 'o dia: o antes e o depois, e o aviso das tarefas já criadas')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=6000)
        ok(v('v2')['dia_prazo_override'] == 30 and t('yt-1')['prazo'] == D(5), 'gravou o dia próprio da empresa; a tarefa já criada fica com o prazo dela')
        perguntar('Desliga a EFD do Modelo'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=6000)
        ok(p.inner_text(ultimo).startswith('Desligar EFD TESTE MENSAL em 1 empresa?') and 'desligar' in p.inner_text(ultimo), 'desligar: o cartão pergunta')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=6000)
        ok(v('v1')['ativo'] is False and t('yt-3')['status'] == 'pendente' and p.inner_text(ultimo).startswith('✓ Desligada em 1 empresa.'), 'desligou; a tarefa aberta fica')
        p.click(ultimo + ' button.as-botao-link'); espera_texto(ultimo, '↺ Desfeito')
        ok(v('v1')['ativo'] is True, 'desfazer: ligada de novo')
        ok(not erros, f'sem erro de JavaScript na tela ({erros[:3]})')
        b.close()
    srv.shutdown()
    print()
    print('Tudo certo.' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
