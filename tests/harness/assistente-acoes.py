"""Teste das ações do assistente do escritório (assets/js/assistente-acoes.js + tarefas-acoes.js, 14/10/2026): a resposta
traz a proposta ("acao") e o cartão embaixo dela pede a confirmação — concluir tarefas, marcar boletos como pagos, criar
tarefa —, grava com o login de quem está na tela e oferece o "Desfazer"; e a revisão das atrasadas, o assistente
perguntando, grupo por grupo, o que já foi feito (pela saudação do dia e pelo recado da Agenda). A Edge Function
"assistente" entra como dublê, por window.__mockInvoke (devolve a proposta conforme a pergunta); a função tem teste próprio
em tests/assistente-funcao.test.mjs e as regras de gravar, em tests/tarefas-acoes.test.mjs.
Sem login e sem banco: mesmo mock do conferir.py (quem está na tela é o Samuel, financeiro@); os dados (inventados) entram
por uma armadilha em window.__mockDb.

    python tests/harness/assistente-acoes.py

Confere:
  1. concluir: a lista lida do banco (só as abertas, com empresa, prazo e quem; a cobrável marcada), desmarcar uma, concluir
     (status, quem, histórico, a carinha comemora, as telas avisadas), desfazer, e o estado do cartão depois de recarregar;
  2. na Agenda, a tarefa concluída pelo cartão passa pra "Concluídas" sem recarregar a página;
  3. marcar pago na tela Boletos: a grade troca a situação na hora; desfazer volta; "Agora não" deixa como estava;
  4. criar: o formulário curto já preenchido (título, responsável, prazo, prioridade, setor, descrição, empresa), criar
     (tarefa avulsa da empresa, com histórico), desfazer (apaga);
  5. a revisão das atrasadas pela saudação do dia: só as de quem entrou (com as de "Ambos"), o grupo que mais se repete
     primeiro, "Todas feitas", "Escolher quais", desfazer a última, "Ainda não", as avulsas no fim e "Começar de novo";
  6. o recado da Agenda pergunta pelas atrasadas; a revisão proposta pela IA aparece embaixo da resposta;
  7. o "Remarcar" da revisão (16/10/2026): hoje, o próximo dia útil ou outra data, "Voltar", desfazer (o grupo volta) e as
     marcadas, com a tarefa da admissão de fora (o prazo dela vem da ficha);
  8. o cartão de alterar: passar pra outra pessoa e mudar a prioridade, com o antes e o depois e o que fica de fora (a
     concluída, a que já está assim, a da admissão), desmarcar, gravar com o histórico, desfazer; remarcar; recarregar;
  9. o cartão dos arquivos (16/10/2026): o nome é o link (só endereço do Drive, numa aba nova; o resto sai sem link), a
     pasta, a data, o tamanho ou o tipo do Google, o "e mais" e a pasta da empresa embaixo; nada achado e sem pasta no
     cadastro; recarregar.
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
D = lambda n: (HOJE + datetime.timedelta(days=n)).isoformat()
COMP = HOJE.strftime('%Y-%m')
EU = 'financeiro@macedoereis.com.br'
E1, E2, E3 = ('9a1b2c3d-0000-4000-8000-0000000000e1', '9a1b2c3d-0000-4000-8000-0000000000e2', '9a1b2c3d-0000-4000-8000-0000000000e3')
CLIENTES = [{'id': E1, 'nome_principal': 'PADARIA DO TESTE LTDA', 'documento': '10000000000272', 'status': 'ativo'},
            {'id': E2, 'nome_principal': 'OFICINA DE TESTE LTDA', 'documento': '10000000000353', 'status': 'ativo'},
            {'id': E3, 'nome_principal': 'MERCADO DE TESTE LTDA', 'documento': '10000000000434', 'status': 'ativo'}]
NOMES = {c['id']: c['nome_principal'] for c in CLIENTES}
def T(i, titulo, resp, prazo, cli=None, **extra):
    t = {'id': 'xa-' + i, 'titulo': titulo, 'setor': 'fiscal', 'responsavel': resp, 'prazo': prazo, 'status': 'pendente', 'prioridade': 'media', 'cliente_id': cli,
         'clientes': {'nome_principal': NOMES[cli], 'documento': '0'} if cli else None, 'faturavel': False, 'hora': None, 'posicao': 0, 'concluida_em': None, 'concluida_por': None,
         'proposta_id': None, 'transicao_id': None}
    t.update(extra); return t
TAREFAS = [
    # as que a IA propõe concluir (uma já concluída, uma cobrável)
    T('c1', 'EFD CONTRIBUIÇÕES (TESTE)', 'Samuel', D(3), E1), T('c2', 'EFD CONTRIBUIÇÕES (TESTE)', 'Samuel', D(5), E2, faturavel=True),
    T('c3', 'EFD CONTRIBUIÇÕES (TESTE)', 'Samuel', D(-9), E3, status='concluida', concluida_por='outra@macedoereis.com.br', concluida_em=D(-8) + 'T12:00:00Z'),
    # a da agenda de hoje
    T('h1', 'CONFERIR EXTRATO (TESTE DO CARTÃO)', 'Samuel', D(0), E1),
    # a revisão: PGDAS x3 e GIA x2 do Samuel, uma de "Ambos", e uma PGDAS da Thalia (que não é dele)
    T('p1', 'PGDAS (REVISÃO)', 'Samuel', D(-40), E1), T('p2', 'PGDAS (REVISÃO)', 'SAMUEL', D(-12), E2), T('p3', 'PGDAS (REVISÃO)', 'Samuel', D(-12), E3),
    T('g1', 'GIA (REVISÃO)', 'Samuel', D(-20), E1), T('g2', 'GIA (REVISÃO)', 'Samuel', D(-6), E2),
    T('a1', 'ASSINAR CONTRATO (REVISÃO)', 'Ambos', D(-4)), T('o1', 'PGDAS (REVISÃO)', 'Thalia', D(-12), E1),
    # na revisão, uma do Samuel que é da admissão: o "Remarcar" deixa de fora (o banco refaz o prazo dela pela ficha)
    T('ad2', 'ADMISSÃO DE BELTRANO (REVISÃO)', 'Samuel', D(-3), E2, admissao_id='adm-2'),
    # o cartão de alterar (prazo, responsável, prioridade): da Thalia, uma já do jeito pedido e uma da admissão
    T('r1', 'DCTFWEB (ALTERAR)', 'Thalia', D(-2), E1, origem='recorrente', obrigacao_id='ob-1'), T('r2', 'DCTFWEB (ALTERAR)', 'THALIA', D(-1), E2, prioridade='baixa'),
    T('r3', 'DCTFWEB (ALTERAR)', 'Vitória', D(-1), E3, prioridade='alta'), T('ad1', 'ADMISSÃO DE FULANA (ALTERAR)', 'Thalia', D(-1), E1, admissao_id='adm-1')]
COBRANCAS = [{'id': 'xb-1', 'cliente_id': E1, 'competencia': COMP, 'valor': 450, 'vencimento': D(5), 'status': 'enviado', 'canal': 'whatsapp', 'destino': '', 'observacao': '', 'itens_extras': []},
             {'id': 'xb-2', 'cliente_id': E2, 'competencia': COMP, 'valor': 300.5, 'vencimento': D(5), 'status': 'a_emitir', 'canal': 'whatsapp', 'destino': '', 'observacao': '', 'itens_extras': []},
             {'id': 'xb-3', 'cliente_id': E3, 'competencia': COMP, 'valor': 200, 'vencimento': D(5), 'status': 'pago', 'canal': 'whatsapp', 'destino': '', 'observacao': '', 'itens_extras': []}]
ACOES = {
    'Conclui as EFD da semana': {'tipo': 'concluir_tarefas', 'ids': ['xa-c1', 'xa-c2', 'xa-c3']},
    'Conclui o extrato de hoje': {'tipo': 'concluir_tarefas', 'ids': ['xa-h1']},
    'Os boletos foram pagos': {'tipo': 'marcar_pago', 'ids': ['xb-1', 'xb-2', 'xb-3']},
    'De novo os boletos': {'tipo': 'marcar_pago', 'ids': ['xb-1', 'xb-2']},
    'Cria uma tarefa pra Vitória': {'tipo': 'criar_tarefa', 'tarefa': {'titulo': 'Ligar pra padaria sobre a admissão', 'responsavel': 'Vitória', 'prazo': D(1), 'setor': 'dp',
                                    'prioridade': 'alta', 'descricao': 'Confirmar a data de início.', 'empresa': {'id': E1, 'nome': 'PADARIA DO TESTE LTDA'}}},
    'Revisa as minhas atrasadas': {'tipo': 'revisar_atrasadas', 'pessoa': 'Samuel'},
    'Passa as DCTFWEB pra Vitória e deixa urgente': {'tipo': 'alterar_tarefas', 'ids': ['xa-r1', 'xa-r2', 'xa-r3', 'xa-ad1', 'xa-c3'], 'mudar': {'responsavel': 'Vitória', 'prioridade': 'alta'}},
    'Remarca a DCTFWEB pra amanhã': {'tipo': 'alterar_tarefas', 'ids': ['xa-r1'], 'mudar': {'prazo': D(1)}},
    'Acha o contrato da padaria': {'tipo': 'arquivos', 'empresa': 'PADARIA DO TESTE LTDA', 'cliente_id': E1, 'pasta': 'https://drive.google.com/drive/folders/PASTA_DA_PADARIA_1',
        'termo': 'contrato', 'total': 23, 'itens': [
            {'nome': 'Contrato Social.pdf', 'pasta': 'PROCESSOS / ABERTURA', 'modificado': '2026-03-01T15:00:00Z', 'tamanho': 1258291, 'link': 'https://drive.google.com/file/d/ARQ_CONTRATO_1/view', 'tipo': 'application/pdf'},
            {'nome': 'Contrato de honorários', 'pasta': '', 'modificado': '2026-02-10T15:00:00Z', 'tamanho': None, 'link': 'https://docs.google.com/document/d/DOC_HONORARIOS_1/edit', 'tipo': 'application/vnd.google-apps.document'},
            {'nome': 'Contrato antigo.pdf', 'pasta': 'PROCESSOS', 'modificado': '2025-05-02T15:00:00Z', 'tamanho': 2048, 'link': 'javascript:alert(1)', 'tipo': 'application/pdf'}]},
    'Acha a procuração da oficina': {'tipo': 'arquivos', 'empresa': 'OFICINA DE TESTE LTDA', 'cliente_id': E2, 'pasta': None, 'termo': 'procuração', 'total': 0, 'itens': []}}
SEMEAR = """
(() => {
  const CLIENTES = %s, TAREFAS = %s, COBRANCAS = %s, ACOES = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); v.tarefas.push(...TAREFAS); v.cobrancas_mensais = COBRANCAS; v.assistente_chat = [];
    v.cobrancas_config = []; v.carteira_info = v.carteira_info || [];
  } });
  window.__chamadas = []; window.__feitos = []; window.__mudou = [];
  addEventListener('mr:feito', e => window.__feitos.push(e.detail.n));
  addEventListener('mr:tarefas-mudaram', e => window.__mudou.push('tarefas:' + e.detail.ids.length));
  addEventListener('mr:boletos-mudaram', e => window.__mudou.push('boletos:' + e.detail.mudancas.length));
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    const acao = ACOES[opts.body.pergunta] || null;
    return { data: ev({ tipo: 'etapa', texto: 'Separando pra você confirmar' }) + ev({ tipo: 'resposta', texto: 'Separei: confirme no cartão.', ...(acao ? { acao } : {}) }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, TAREFAS, COBRANCAS, ACOES))
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
        tarefa = lambda i: p.evaluate('id => window.__mockDb.tarefas.find(t => t.id === id)', i)
        boleto = lambda i: p.evaluate('id => window.__mockDb.cobrancas_mensais.find(t => t.id === id)', i)
        hist = lambda i: p.evaluate('id => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === id).map(h => h.descricao)', i)
        def perguntar(texto):
            p.fill('.as-entrada textarea', texto); p.press('.as-entrada textarea', 'Enter')
            p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)
        ultimo = '.as-lista .as-msg.ia:last-child .as-cartao'

        # 1) concluir
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=5000)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        perguntar('Conclui as EFD da semana')
        p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Concluir 2 tarefas?') and '1 outra já estava concluída.' in card and 'PADARIA DO TESTE LTDA · prazo' in card and 'Samuel' in card, f'concluir: a lista lida do banco, só as abertas ({card[:160]!r})')
        ok(p.inner_text(ultimo + ' .as-tag') == 'cobrável' and p.inner_text(ultimo + ' .as-botao-pri') == 'Concluir 2', 'a cobrável vem marcada; o botão diz quantas')
        p.uncheck(ultimo + ' input[data-id="xa-c2"]')
        ok(p.inner_text(ultimo + ' .as-botao-pri') == 'Concluir 1', 'desmarcar uma: o botão acompanha')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        c1, c2 = tarefa('xa-c1'), tarefa('xa-c2')
        ok(c1['status'] == 'concluida' and c1['concluida_por'] == EU and c1['concluida_em'] and c2['status'] == 'pendente', 'concluiu só a marcada, com quem e quando')
        ok(hist('xa-c1') == ['Tarefa concluída pelo assistente do escritório.'] and tarefa('xa-c3')['concluida_por'] == 'outra@macedoereis.com.br', 'a linha no histórico; a já concluída por outra pessoa fica como estava')
        ok(p.inner_text(ultimo).startswith('✓ 1 tarefa concluída.') and p.is_visible(ultimo + ' .as-botao-link'), 'o cartão diz o que fez e oferece "Desfazer"')
        ok(p.evaluate('window.__feitos') == [1] and 'tarefas:1' in p.evaluate('window.__mudou'), 'a carinha comemora e as telas são avisadas (mr:feito, mr:tarefas-mudaram)')
        p.click(ultimo + ' .as-botao-link'); p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        c1 = tarefa('xa-c1')
        ok(c1['status'] == 'pendente' and c1['concluida_por'] is None and hist('xa-c1')[-1] == 'Conclusão desfeita no assistente do escritório.', 'desfazer: volta a pendente, sem quem e quando, com a linha no histórico')
        p.reload(); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_selector('.as-cartao', timeout=5000)
        ok(p.inner_text('.as-cartao').startswith('↺ Desfeito: 1 tarefa reaberta.') and not p.query_selector('.as-cartao .as-botao-pri'), 'recarregou: o cartão volta no estado em que ficou, sem os botões')

        # 2) na Agenda, a concluída pelo cartão vai pra "Concluídas" sem recarregar
        p.goto(base + 'agenda.html'); p.wait_for_selector('.ag-card[data-taskid="xa-h1"]', timeout=6000)
        ok(not p.query_selector('.ag-card.feita[data-taskid="xa-h1"]'), 'na Agenda, a tarefa de hoje está pendente')
        perguntar('Conclui o extrato de hoje'); p.wait_for_selector(ultimo + ' .as-botao-pri', timeout=5000)
        p.click(ultimo + ' .as-botao-pri')
        p.wait_for_selector('.ag-card.feita[data-taskid="xa-h1"]', timeout=6000)
        ok(True, 'concluída pelo cartão, a Agenda se atualiza sozinha (vai pra "Concluídas")')

        # 3) marcar pago na tela Boletos
        p.goto(base + 'financeiro-boletos.html'); p.wait_for_selector('tr select.st', timeout=6000)
        perguntar('Os boletos foram pagos'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Marcar 2 boletos como pago?') and 'OFICINA DE TESTE LTDA' in card and 'a emitir' in card and 'MERCADO DE TESTE' not in card, f'pago: só os em aberto, com competência, valor e situação ({card[:150]!r})')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ok(boleto('xb-1')['status'] == 'pago' and boleto('xb-2')['status'] == 'pago', 'os dois marcados como pagos')
        grade = p.eval_on_selector_all('tr select.st', 'ss => ss.map(s => s.value)')
        ok(grade.count('pago') == 3, f'a grade troca a situação na hora ({grade})')
        p.click(ultimo + ' .as-botao-link'); p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        grade = p.eval_on_selector_all('tr select.st', 'ss => ss.map(s => s.value)')
        ok(boleto('xb-1')['status'] == 'enviado' and boleto('xb-2')['status'] == 'a_emitir' and sorted(grade) == ['a_emitir', 'enviado', 'pago'], f'desfazer: cada um volta pra situação de antes, na grade também ({grade})')
        perguntar('De novo os boletos'); p.wait_for_selector(ultimo + ' .as-botao-pri', timeout=5000)
        p.click(ultimo + ' .as-botao:not(.as-botao-pri)'); p.wait_for_timeout(200)
        ok(p.inner_text(ultimo) == 'Deixei como estava.' and boleto('xb-1')['status'] == 'enviado', '"Agora não": nada muda')

        # 4) criar
        p.goto(base + 'index.html'); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000)
        perguntar('Cria uma tarefa pra Vitória'); p.wait_for_selector(ultimo + ' .as-cartao-campos', timeout=5000)
        campos = p.eval_on_selector_all(ultimo + ' .as-cartao-campo input, ' + ultimo + ' .as-cartao-campo select, ' + ultimo + ' .as-cartao-campo textarea', 'es => es.map(e => e.value)')
        ok(campos == ['Ligar pra padaria sobre a admissão', 'Vitória', D(1), 'alta', 'dp', 'Confirmar a data de início.'] and 'Empresa: PADARIA DO TESTE LTDA' in p.inner_text(ultimo),
           f'criar: o formulário curto já preenchido, com a empresa ({campos})')
        p.fill(ultimo + ' .as-cartao-campo input[type="text"]', 'Ligar pra padaria (data de início)')
        n0 = p.evaluate('window.__mockDb.tarefas.length')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        nova = p.evaluate('() => window.__mockDb.tarefas.at(-1)')
        ok(p.evaluate('window.__mockDb.tarefas.length') == n0 + 1 and nova['titulo'] == 'Ligar pra padaria (data de início)' and nova['responsavel'] == 'Vitória' and nova['prazo'] == D(1)
           and nova['prioridade'] == 'alta' and nova['setor'] == 'dp' and nova['cliente_id'] == E1 and nova['origem'] == 'avulsa' and nova['status'] == 'pendente' and nova['descricao'] == 'Confirmar a data de início.',
           f'criou a tarefa avulsa da empresa com o que estava no formulário ({ {k: nova.get(k) for k in ("titulo", "responsavel", "prazo", "setor", "origem")} })')
        ok(hist(nova['id']) == ['Tarefa cadastrada pelo assistente do escritório.'] and 'Ligar pra padaria (data de início) · Vitória · prazo' in p.inner_text(ultimo), 'histórico e o resumo no cartão')
        p.click(ultimo + ' .as-botao-link'); p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        ok(p.evaluate('id => !window.__mockDb.tarefas.some(t => t.id === id)', nova['id']), 'desfazer a criação apaga a tarefa')
        p.click('.as-acao[data-a="nova"]'); p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 5) a revisão das atrasadas pela saudação do dia
        p.add_init_script('window.__assistenteRecados = true')
        p.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('mr_assistente_dia:')) localStorage.removeItem(k); }")
        p.goto(base + 'index.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=5000)
        ok('Alguma delas já foi feita?' in p.inner_text('.as-recado-txt') and p.inner_text('.as-recado .as-chip-acao') == 'Revisar as atrasadas', 'a saudação do dia pergunta pelas atrasadas, com o botão "Revisar as atrasadas"')
        p.click('.as-recado .as-chip-acao'); p.wait_for_selector('.as-painel:not([hidden]) .as-cartao-grupo', timeout=6000)
        rev = '.as-cartao-revisao'
        texto = p.inner_text(rev)
        # do Samuel: p1-p3, g1, g2, a1 (Ambos) e as duas do mock (Renovar alvará, Cobrar honorários)
        n = p.evaluate("""() => window.__mockDb.tarefas.filter(t => t.status !== 'concluida' && t.prazo && t.prazo < new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
          && ['samuel', 'ambos'].includes(String(t.responsavel || '').toLowerCase())).length""")
        ok(texto.startswith('Suas atrasadas: ' + str(n)) and 'PGDAS (REVISÃO) · 3' in texto and 'Já foram feitas?' in texto, f'a revisão: as de quem entrou (com "Ambos"), o grupo que mais se repete primeiro ({texto[:120]!r})')
        ok(re.search(r'prazos de \d\d/\d\d/\d{4} a \d\d/\d\d/\d{4} · PADARIA DO TESTE LTDA, OFICINA DE TESTE LTDA e mais 1', texto) is not None, 'o grupo diz os prazos e as empresas')
        p.click(rev + ' .as-botao-pri'); p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('GIA (REVISÃO) · 2')", timeout=6000)
        ok(all(tarefa(i)['status'] == 'concluida' for i in ('xa-p1', 'xa-p2', 'xa-p3')) and tarefa('xa-o1')['status'] == 'pendente', '"Todas feitas": concluiu as 3 dele; a da Thalia não')
        ok(hist('xa-p1') == ['Tarefa concluída na revisão das atrasadas (assistente do escritório).'] and '✓ PGDAS (REVISÃO): 3 concluídas.' in p.inner_text(rev)
           and '3 concluídas nesta revisão.' in p.inner_text(rev), 'o histórico, a linha do que fez e a conta da revisão')
        p.click(rev + ' .as-cartao-grupo .as-botao:not(.as-botao-pri)')   # Escolher quais
        p.wait_for_selector(rev + ' .as-cartao-grupo input[type="checkbox"]', timeout=3000)
        ok(p.eval_on_selector_all(rev + ' .as-cartao-grupo input[type="checkbox"]', 'cs => cs.map(c => c.checked)') == [False, False], '"Escolher quais": a lista, sem nada marcado')
        p.check(rev + ' input[data-id="xa-g1"]')
        p.click(rev + ' .as-cartao-grupo .as-botao-pri'); p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('As outras atrasadas')", timeout=6000)
        ok(tarefa('xa-g1')['status'] == 'concluida' and tarefa('xa-g2')['status'] == 'pendente', 'concluiu só a marcada; o grupo sai da revisão (a outra ainda não foi feita)')
        p.click(rev + ' .as-cartao-feito .as-botao-link')   # desfazer a última
        p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('GIA (REVISÃO) · 2')", timeout=6000)
        ok(tarefa('xa-g1')['status'] == 'pendente' and 'conclusão desfeita' in p.inner_text(rev), 'desfazer a última: a tarefa volta e o grupo volta pra revisão')
        p.click(rev + ' .as-cartao-grupo .as-botao:has-text("Ainda não")')
        p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('As outras atrasadas')", timeout=6000)
        avulsas = p.inner_text(rev + ' .as-cartao-grupo')
        ok(all(x in avulsas for x in ('ASSINAR CONTRATO (REVISÃO)', 'Renovar alvará', 'Cobrar honorários atrasados', 'Marque as que já foram feitas (ou as que quer remarcar):')),
           f'as avulsas juntas no fim (com a de "Ambos"), pra marcar o que já foi feito ({avulsas[:140]!r})')
        p.click(rev + ' .as-cartao-grupo .as-botao:has-text("Pular estas")')
        p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('Passamos por todas')", timeout=6000)
        ok(p.is_visible(rev + ' .as-botao:has-text("Começar de novo")'), 'no fim: passamos por todas, com "Começar de novo"')
        p.click(rev + ' .as-botao:has-text("Começar de novo")')
        p.wait_for_function("() => document.querySelector('.as-cartao-revisao').innerText.includes('GIA (REVISÃO) · 2')", timeout=6000)
        ok(True, '"Começar de novo" volta aos grupos que ficaram')
        p.click(rev + ' .as-botao:has-text("Parar a revisão")'); p.wait_for_timeout(200)
        ok(p.inner_text(rev).startswith('Revisão parada — 3 tarefas concluídas nela.') and p.is_visible(rev + ' .as-botao:has-text("Continuar a revisão")'), '"Parar a revisão" e "Continuar"')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 6) o recado da Agenda pergunta pelas atrasadas; a revisão proposta pela IA
        p.evaluate("() => { const ks = Object.keys(localStorage).filter(k => k.startsWith('mr_assistente_dia:') && !k.endsWith(':saudacao')); ks.forEach(k => localStorage.removeItem(k)); }")
        p.goto(base + 'agenda.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=6000)
        ok(re.search(r'Você tem \d+ tarefas? atrasadas?\. Alguma já foi feita\?', p.inner_text('.as-recado-txt')) is not None and p.inner_text('.as-recado .as-chip-acao') == 'Revisar as atrasadas',
           f'na Agenda, o recado pergunta pelas atrasadas ({p.inner_text(".as-recado-txt")!r})')
        p.click('.as-recado-x'); p.click('.as-lancador'); p.wait_for_timeout(200)
        perguntar('Revisa as minhas atrasadas'); p.wait_for_selector(ultimo + '.as-cartao-revisao .as-cartao-grupo', timeout=6000)
        ok('Suas atrasadas' in p.inner_text(ultimo), 'a revisão proposta pela IA aparece embaixo da resposta')

        # 7) o "Remarcar" da revisão (16/10/2026): hoje, o próximo dia útil ou outra data; "Voltar"; desfazer; as marcadas,
        # com a da admissão de fora
        br = lambda iso: '/'.join(reversed(iso.split('-')))
        semana = lambda iso: ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][datetime.date.fromisoformat(iso).weekday()] + ', ' + br(iso)
        rv = ultimo + '.as-cartao-revisao'
        rvjs = ".as-lista .as-msg.ia:last-child .as-cartao.as-cartao-revisao"
        prox = HOJE + datetime.timedelta(days=1)
        while prox.weekday() >= 5: prox += datetime.timedelta(days=1)
        rot = 'Amanhã' if (prox - HOJE).days == 1 else ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][prox.weekday()] + ', ' + prox.strftime('%d/%m')
        # (a Agenda abriu de novo: o banco de mentira voltou ao começo, com o PGDAS em aberto)
        ok('PGDAS (REVISÃO) · 3' in p.inner_text(rv), 'a revisão pela IA começa pelo grupo que mais se repete')
        p.click(rv + ' .as-cartao-grupo .as-botao:text-is("Remarcar")'); p.wait_for_selector(rv + ' .as-cartao-grupo input[type="date"]', timeout=3000)
        grupo = p.inner_text(rv + ' .as-cartao-grupo')
        ok('Remarcar as 3 pra quando?' in grupo and p.is_visible(rv + ' .as-botao:text-is("Hoje")') and p.is_visible(rv + f' .as-botao:text-is("{rot}")')
           and p.get_attribute(rv + ' input[type="date"]', 'min') == HOJE.isoformat(), f'"Remarcar": hoje, {rot} (o próximo dia útil) ou outra data ({grupo[:140]!r})')
        p.click(rv + ' .as-botao:text-is("Voltar")'); p.wait_for_selector(rv + ' .as-cartao-pergunta:text-is("Já foram feitas?")', timeout=3000)
        ok(True, '"Voltar" volta pra pergunta')
        p.click(rv + ' .as-cartao-grupo .as-botao:text-is("Remarcar")'); p.click(rv + ' .as-botao:text-is("Hoje")')
        p.wait_for_function(f"() => document.querySelector('{rvjs}').innerText.includes('GIA (REVISÃO) · 2')", timeout=6000)
        texto = p.inner_text(rv)
        ok(all(tarefa(i)['prazo'] == HOJE.isoformat() for i in ('xa-p1', 'xa-p2', 'xa-p3')) and '✓ PGDAS (REVISÃO): 3 remarcadas pra ' + br(HOJE.isoformat()) + '.' in texto
           and '3 remarcadas nesta revisão.' in texto and tarefa('xa-o1')['prazo'] == D(-12), f'"Hoje": as 3 dele remarcadas pra hoje (a da Thalia não); o grupo sai e vem o próximo ({texto[:160]!r})')
        ok(hist('xa-p1')[-1] == 'Prazo alterado de ' + br(D(-40)) + ' para ' + br(HOJE.isoformat()) + ' — pelo assistente do escritório (revisão das atrasadas).', f'o histórico ({hist("xa-p1")[-1:]})')
        p.click(rv + ' .as-cartao-feito .as-botao-link')
        p.wait_for_function(f"() => document.querySelector('{rvjs}').innerText.includes('PGDAS (REVISÃO) · 3')", timeout=6000)
        ok(tarefa('xa-p1')['prazo'] == D(-40) and tarefa('xa-p2')['prazo'] == D(-12) and tarefa('xa-p3')['prazo'] == D(-12) and 'remarcação desfeita' in p.inner_text(rv),
           'desfazer: cada prazo volta ao de antes e o grupo volta pra revisão')
        p.click(rv + ' .as-cartao-grupo .as-botao:text-is("Ainda não")')
        p.wait_for_function(f"() => document.querySelector('{rvjs}').innerText.includes('GIA (REVISÃO) · 2')", timeout=6000)
        p.click(rv + ' .as-cartao-grupo .as-botao:text-is("Ainda não")')
        p.wait_for_function(f"() => document.querySelector('{rvjs}').innerText.includes('As outras atrasadas')", timeout=6000)
        ok(p.is_disabled(rv + ' .as-botao:text-is("Remarcar as marcadas")'), 'nas avulsas, "Remarcar as marcadas" só depois de marcar')
        p.check(rv + ' input[data-id="xa-a1"]'); p.check(rv + ' input[data-id="xa-ad2"]')
        p.click(rv + ' .as-botao:text-is("Remarcar as marcadas")'); p.wait_for_selector(rv + ' input[type="date"]', timeout=3000)
        ok('Remarcar as 2 pra quando?' in p.inner_text(rv + ' .as-cartao-grupo'), 'as marcadas: a pergunta da data')
        p.fill(rv + ' input[type="date"]', D(7)); p.click(rv + ' .as-botao:text-is("Remarcar")')
        p.wait_for_function(f"() => document.querySelector('{rvjs}').innerText.includes('Avulsas: 1 remarcada')", timeout=6000)
        texto = p.inner_text(rv)
        ok(tarefa('xa-a1')['prazo'] == D(7) and tarefa('xa-ad2')['prazo'] == D(-3) and '✓ Avulsas: 1 remarcada pra ' + br(D(7)) + '.' in texto
           and '1 ficou como estava: o prazo vem da ficha de origem (tela Admissões).' in texto, f'outra data: a de "Ambos" remarcada; a da admissão fica ({texto[:220]!r})')

        # 8) o cartão de alterar: passar pra Vitória e deixar urgente (o antes e o depois), desfazer; remarcar
        perguntar('Passa as DCTFWEB pra Vitória e deixa urgente'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Alterar 2 tarefas?') and 'responsável → Vitória · prioridade → alta' in card
           and '1 já foi concluída. 1 já está assim. 1 é de admissão e fica de fora: o prazo e o responsável dela vêm da ficha (tela Admissões).' in card,
           f'alterar: o título, o que muda e o que fica de fora — a concluída, a que já está assim, a da admissão ({card[:300]!r})')
        ok('Thalia → Vitória · prioridade média → alta' in card and 'THALIA → Vitória · prioridade baixa → alta' in card and p.inner_text(ultimo + ' .as-botao-pri') == 'Alterar 2',
           'cada tarefa com o antes e o depois; o botão diz quantas')
        ok('1 vem de obrigação fiscal: a próxima nasce com o responsável da obrigação — pra ficar de vez, troque em Obrigações fiscais.' in card,
           'a que nasce de obrigação fiscal: o aviso de que a próxima vem com o responsável de lá')
        p.uncheck(ultimo + ' input[data-id="xa-r2"]')
        ok(p.inner_text(ultimo + ' .as-botao-pri') == 'Alterar 1', 'desmarcar uma: o botão acompanha')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        r1, r2 = tarefa('xa-r1'), tarefa('xa-r2')
        ok(r1['responsavel'] == 'Vitória' and r1['prioridade'] == 'alta' and r2['responsavel'] == 'THALIA' and r2['prioridade'] == 'baixa' and tarefa('xa-ad1')['responsavel'] == 'Thalia',
           'mudou só a marcada; a da admissão ficou como estava')
        ok(hist('xa-r1') == ['Responsável alterado de Thalia para Vitória; prioridade alterada de média para alta — pelo assistente do escritório.']
           and p.inner_text(ultimo).startswith('✓ 1 tarefa alterada (responsável → Vitória · prioridade → alta).') and p.evaluate('window.__mudou')[-1] == 'tarefas:1',
           f'o histórico, o cartão e as telas avisadas ({hist("xa-r1")})')
        p.click(ultimo + ' .as-botao-link'); p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        r1 = tarefa('xa-r1')
        ok(r1['responsavel'] == 'Thalia' and r1['prioridade'] == 'media' and p.inner_text(ultimo).startswith('↺ Desfeito: 1 tarefa voltou como era.')
           and hist('xa-r1')[-1] == 'Responsável alterado de Vitória para Thalia; prioridade alterada de alta para média — alteração desfeita no assistente do escritório.',
           f'desfazer: volta ao que era, com a linha no histórico ({hist("xa-r1")[-1:]})')
        perguntar('Remarca a DCTFWEB pra amanhã'); p.wait_for_selector(ultimo + ' .as-botao-pri', timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Remarcar 1 tarefa pra ' + semana(D(1)) + '?') and 'prazo ' + br(D(-2)) + ' → ' + br(D(1)) in card and p.inner_text(ultimo + ' .as-botao-pri') == 'Remarcar 1',
           f'remarcar: o título com a data nova; o prazo de antes → o novo ({card[:160]!r})')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ok(tarefa('xa-r1')['prazo'] == D(1) and p.inner_text(ultimo).startswith('✓ 1 tarefa remarcada pra ' + semana(D(1)) + '.')
           and hist('xa-r1')[-1] == 'Prazo alterado de ' + br(D(-2)) + ' para ' + br(D(1)) + ' — pelo assistente do escritório.', 'remarcou, com o histórico')
        p.reload(); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ok(p.inner_text(ultimo).startswith('✓ 1 tarefa remarcada') and p.is_visible(ultimo + ' .as-botao-link'), 'recarregou: o cartão volta como ficou, com o "Desfazer"')

        # 9) o cartão dos arquivos: só mostra (o nome é o link pro Drive, numa aba nova); a pasta da empresa embaixo
        perguntar('Acha o contrato da padaria'); p.wait_for_selector(ultimo + ' .as-arquivos', timeout=5000)
        card = p.inner_text(ultimo)
        ok(card.startswith('Arquivos de PADARIA DO TESTE LTDA com “contrato”: 23'), f'arquivos: o título com a empresa, as palavras e quantos ({card[:90]!r})')
        links = p.eval_on_selector_all(ultimo + ' a.as-arquivo', 'as => as.map(a => [a.querySelector("b").textContent, a.href, a.target, a.rel, a.querySelector("small").textContent])')
        ok(links == [['Contrato Social.pdf', 'https://drive.google.com/file/d/ARQ_CONTRATO_1/view', '_blank', 'noopener noreferrer', 'PROCESSOS / ABERTURA · 01/03/2026 · 1,2 MB'],
                     ['Contrato de honorários', 'https://docs.google.com/document/d/DOC_HONORARIOS_1/edit', '_blank', 'noopener noreferrer', 'pasta da empresa · 10/02/2026 · Documento Google']],
           f'o nome é o link (aba nova), com a pasta, a data e o tamanho ou o tipo ({links})')
        sem = p.eval_on_selector_all(ultimo + ' .as-arquivo-sem', 'as => as.map(a => a.innerText)')
        ok(sem == ['Contrato antigo.pdf\nPROCESSOS · 02/05/2025 · 2 KB · sem link'] and not p.query_selector(ultimo + ' a[href^="javascript"]'), f'endereço que não é do Drive sai sem link ({sem})')
        pasta = p.eval_on_selector(ultimo + ' .as-cartao-rodape a', 'a => [a.textContent, a.href, a.target]')
        ok('E mais 20 arquivos: diga mais palavras do nome pra afinar.' in card and pasta == ['Abrir a pasta da empresa no Drive', 'https://drive.google.com/drive/folders/PASTA_DA_PADARIA_1', '_blank'],
           f'o "e mais" e a pasta da empresa embaixo ({pasta})')
        perguntar('Acha a procuração da oficina'); p.wait_for_selector(ultimo + ' .as-cartao-pergunta', timeout=5000)
        card = p.inner_text(ultimo)
        ok('Nada com “procuração” nos arquivos de OFICINA DE TESTE LTDA. Tente outras palavras do nome do arquivo.' in card and 'não tem a pasta do Drive no cadastro' in card
           and not p.query_selector(ultimo + ' a'), f'nada achado e sem pasta no cadastro: diz, sem link ({card[:200]!r})')
        p.reload(); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_selector('.as-arquivos', timeout=5000)
        ok(len(p.query_selector_all('.as-lista a.as-arquivo')) == 2 and 'Nada com “procuração”' in p.inner_text(ultimo), 'recarregou: os dois cartões voltam como estavam')

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
