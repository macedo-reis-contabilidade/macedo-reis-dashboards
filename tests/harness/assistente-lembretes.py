"""Teste dos lembretes do assistente do escritório (04/11/2026, pedido do Samuel: "me avisa hoje às 11h"): a resposta traz
a proposta e o cartão embaixo dela mostra o lembrete preenchido (o texto, pra quem, o dia e a hora de Brasília, se repete),
cria com o login de quem está na tela e oferece o "Desfazer"; e o cartão dos lembretes que vão chegar, cada um com
"Cancelar". A Edge Function "assistente" entra como dublê, por window.__mockInvoke (devolve a proposta conforme a
pergunta); a função tem teste próprio em tests/assistente-funcao.test.mjs e as regras, em tests/tarefas-acoes.test.mjs; o
disparo (o banco manda pela conversa Avisos do sistema, de minuto em minuto) foi conferido no banco numa transação desfeita.
Sem login e sem banco: mesmo mock do conferir.py (quem está na tela é o Samuel, financeiro@); os dados (inventados) entram
por uma armadilha em window.__mockDb.

    python tests/harness/assistente-lembretes.py

Confere:
  1. o cartão do lembrete: os campos já preenchidos (o texto, pra quem — a Edna, sem login, fora da lista —, o dia e a hora
     de Brasília, se repete) e a prévia de quando chega; a hora que já passou avisa e não grava; criar (a linha no banco, com
     o id da tela), o "Desfazer" (cancela) e o estado depois de recarregar;
  2. o lembrete sobre a tarefa: os minutos antes da hora dela no lugar do dia e da hora, sem a repetição; criar grava a
     tarefa, a antecedência e a hora de chegar;
  3. o cartão dos lembretes que vão chegar: só os pendentes, na ordem da hora de chegar (o da tarefa pela hora dela), quem
     criou e pra quem; "Cancelar" e "Desfazer"; o texto que veio de fora aparece como texto;
  4. o botão "Ver os lembretes" do lembrete que chega no chat: agenda.html?lembretes=1 abre o cartão, e sai do endereço.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

BR = datetime.timezone(datetime.timedelta(hours=-3))
AGORA = datetime.datetime.now(BR).replace(second=0, microsecond=0)
def iso(dt): return dt.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
EM_2H = AGORA + datetime.timedelta(hours=2)
AMANHA_9 = (AGORA + datetime.timedelta(days=1)).replace(hour=9, minute=0)
DEPOIS_10 = (AGORA + datetime.timedelta(days=2)).replace(hour=10, minute=30)
TAREFA_DIA = (AGORA + datetime.timedelta(days=1)).date().isoformat()
EU = 'financeiro@macedoereis.com.br'
TAREFAS = [{'id': 'tl-1', 'titulo': 'REUNIÃO COM O CLIENTE (TESTE)', 'setor': 'comercial', 'responsavel': 'Samuel', 'prazo': TAREFA_DIA, 'hora': '15:00:00', 'status': 'pendente',
            'prioridade': 'media', 'cliente_id': None, 'clientes': None, 'faturavel': False, 'posicao': 0, 'concluida_em': None, 'concluida_por': None, 'proposta_id': None, 'transicao_id': None}]
LEMBRETES = [
    # o que a Thalia criou pro Samuel, depois de amanhã
    {'id': 'lb-1', 'para': EU, 'texto': 'Assinar a procuração <img src=x onerror="window.__xss=1">', 'quando': iso(DEPOIS_10), 'repeticao': 'uma_vez', 'tarefa_id': None,
     'antecedencia_min': None, 'situacao': 'pendente', 'criado_por': 'fiscal@macedoereis.com.br', 'tarefas': None},
    # o que o Samuel criou pra Vitória, todo dia útil, amanhã às 9h
    {'id': 'lb-2', 'para': 'rh@macedoereis.com.br', 'texto': 'Conferir o ponto', 'quando': iso(AMANHA_9), 'repeticao': 'dias_uteis', 'tarefa_id': None,
     'antecedencia_min': None, 'situacao': 'pendente', 'criado_por': EU, 'tarefas': None},
    # o da tarefa (amanhã às 15h, 30 minutos antes = 14h30): a ordem é pela hora de chegar
    {'id': 'lb-3', 'para': EU, 'texto': 'Preparar a reunião', 'quando': iso(AGORA + datetime.timedelta(days=5)), 'repeticao': 'uma_vez', 'tarefa_id': 'tl-1',
     'antecedencia_min': 30, 'situacao': 'pendente', 'criado_por': EU, 'tarefas': {'titulo': 'REUNIÃO COM O CLIENTE (TESTE)', 'prazo': TAREFA_DIA, 'hora': '15:00:00', 'status': 'pendente'}},
    # o que já chegou: fora da lista
    {'id': 'lb-4', 'para': EU, 'texto': 'Já chegou', 'quando': iso(AGORA - datetime.timedelta(hours=1)), 'repeticao': 'uma_vez', 'tarefa_id': None,
     'antecedencia_min': None, 'situacao': 'enviado', 'criado_por': EU, 'tarefas': None}]
ACOES = {
    'Me lembra daqui a 2 horas de ligar pro contador': {'tipo': 'criar_lembrete', 'lembrete': {'texto': 'Ligar pro contador anterior', 'para': {'email': EU, 'nome': 'Samuel'},
        'quando': iso(EM_2H), 'repeticao': 'uma_vez', 'tarefa': None, 'antecedencia_min': None}},
    'Lembra a Vitória toda semana': {'tipo': 'criar_lembrete', 'lembrete': {'texto': 'Mandar o relatório da folha', 'para': {'email': 'rh@macedoereis.com.br', 'nome': 'Vitória'},
        'quando': iso(AMANHA_9), 'repeticao': 'semanal', 'tarefa': None, 'antecedencia_min': None}},
    'Me avisa 15 minutos antes da reunião': {'tipo': 'criar_lembrete', 'lembrete': {'texto': 'Reunião com o cliente', 'para': {'email': EU, 'nome': 'Samuel'},
        'quando': iso(datetime.datetime.fromisoformat(TAREFA_DIA + 'T14:45:00-03:00')), 'repeticao': 'uma_vez',
        'tarefa': {'id': 'tl-1', 'titulo': 'REUNIÃO COM O CLIENTE (TESTE)', 'prazo': TAREFA_DIA, 'hora': '15:00'}, 'antecedencia_min': 15}},
    'Quais lembretes eu tenho?': {'tipo': 'lembretes'}}
SEMEAR = """
(() => {
  const TAREFAS = %s, LEMBRETES = %s, ACOES = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.tarefas.push(...TAREFAS); v.lembretes = LEMBRETES; v.assistente_chat = [];
  } });
  // o que o banco preenche sozinho no lembrete novo (a situação e quem criou)
  const antes = window.__mockAntesDeInserir;
  window.__mockAntesDeInserir = (t, r) => { if (t === 'lembretes') { r.situacao = r.situacao || 'pendente'; r.criado_por = r.criado_por || 'financeiro@macedoereis.com.br'; } if (antes) antes(t, r); };
  window.__mockInvoke = async (nome, opts) => {
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    const acao = ACOES[opts.body.pergunta] || null;
    return { data: ev({ tipo: 'resposta', texto: 'Separei: confira no cartão.', ...(acao ? { acao } : {}) }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (TAREFAS, LEMBRETES, ACOES))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        lembrete = lambda i: p.evaluate('id => window.__mockDb.lembretes.find(l => l.id === id)', i)
        novos = lambda: p.evaluate("() => window.__mockDb.lembretes.filter(l => !String(l.id).startsWith('lb-'))")
        def perguntar(texto):
            p.fill('.as-entrada textarea', texto); p.press('.as-entrada textarea', 'Enter')
            p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado')", timeout=6000)
        ultimo = '.as-lista .as-msg.ia:last-child .as-cartao'

        # 1) o cartão do lembrete
        print('1. O cartão do lembrete')
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=5000)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        perguntar('Me lembra daqui a 2 horas de ligar pro contador')
        p.wait_for_selector(ultimo + ' .as-cartao-campos', timeout=5000)
        vals = p.eval_on_selector_all(ultimo + ' .as-cartao-campo input, ' + ultimo + ' .as-cartao-campo select', 'es => es.map(e => e.value)')
        ok(vals == ['Ligar pro contador anterior', EU, EM_2H.date().isoformat(), EM_2H.strftime('%H:%M'), 'uma_vez'], f'os campos já preenchidos, na hora de Brasília ({vals})')
        pessoas = p.eval_on_selector_all(ultimo + ' select >> nth=0', 'ss => [...ss[0].options].map(o => o.textContent)')
        ok('Samuel (você)' in pessoas and 'Vitória' in pessoas and 'Edna' not in pessoas, f'pra quem: a equipe com login, sem a Edna ({pessoas})')
        p.screenshot(path=str(FOTOS / 'assistente-lembrete.png'))
        previa = p.inner_text(ultimo + ' .as-cartao-sub[aria-live]')
        ok(previa.startswith('Chega ') and EM_2H.strftime('%H:%M') in previa and 'Avisos do sistema' in previa, f'a prévia diz quando chega e onde ({previa!r})')
        passado = AGORA - datetime.timedelta(hours=1)
        p.fill(ultimo + ' input[type=date]', passado.date().isoformat()); p.fill(ultimo + ' input[type=time]', passado.strftime('%H:%M'))
        ok('já passou' in p.inner_text(ultimo + ' .as-cartao-sub[aria-live]'), 'a hora que já passou: a prévia avisa')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_timeout(400)
        erro = p.inner_text(ultimo + ' .as-cartao-erro')
        ok('já passou' in erro and not novos(), f'e criar não grava ({erro!r})')
        mais3 = AGORA + datetime.timedelta(hours=3)
        p.fill(ultimo + ' input[type=date]', mais3.date().isoformat()); p.fill(ultimo + ' input[type=time]', mais3.strftime('%H:%M'))
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ls = novos()
        ok(len(ls) == 1 and ls[0]['para'] == EU and ls[0]['texto'] == 'Ligar pro contador anterior' and ls[0]['quando'] == iso(mais3) and ls[0]['repeticao'] == 'uma_vez'
           and len(str(ls[0]['id'])) == 36 and ls[0].get('tarefa_id') is None, f'criou: o texto, pra quem, a hora certa e o id da tela ({ls})')
        feito = p.inner_text(ultimo)
        ok(feito.startswith('✓ Lembrete criado.') and mais3.strftime('%H:%M') in feito and p.is_visible(ultimo + ' .as-botao-link'), f'o cartão diz quando chega e oferece "Desfazer" ({feito!r})')
        p.click(ultimo + ' .as-botao-link'); p.wait_for_function(f"() => document.querySelector('{ultimo}').innerText.startsWith('↺ Desfeito')", timeout=5000)
        ok(novos()[0]['situacao'] == 'cancelado', 'desfazer: o lembrete fica cancelado (não chega)')
        p.reload(); p.wait_for_selector('.as-painel:not([hidden])', timeout=5000); p.wait_for_selector('.as-cartao', timeout=5000)
        ok(p.inner_text('.as-cartao').startswith('↺ Desfeito') and not p.query_selector('.as-cartao .as-botao-pri'), 'recarregou: o cartão volta como ficou, sem os botões')
        perguntar('Lembra a Vitória toda semana'); p.wait_for_selector(ultimo + ' .as-cartao-campos', timeout=5000)
        vals = p.eval_on_selector_all(ultimo + ' .as-cartao-campo select', 'es => es.map(e => e.value)')
        ok(vals == ['rh@macedoereis.com.br', 'semanal'] and 'toda semana' in p.inner_text(ultimo + ' .as-cartao-sub[aria-live]'), f'pra outra pessoa, toda semana ({vals})')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ult = novos()[-1]
        ok(ult['para'] == 'rh@macedoereis.com.br' and ult['repeticao'] == 'semanal' and ', pra Vitória' in p.inner_text(ultimo), f'criou pra Vitória, toda semana ({ult})')

        # 2) o lembrete sobre a tarefa
        print('2. O lembrete sobre a tarefa')
        perguntar('Me avisa 15 minutos antes da reunião'); p.wait_for_selector(ultimo + ' .as-cartao-campos', timeout=5000)
        card = p.inner_text(ultimo)
        ok('Minutos antes da hora da tarefa' in card and 'Sobre a tarefa: REUNIÃO COM O CLIENTE (TESTE)' in card and not p.query_selector(ultimo + ' input[type=time]')
           and 'Repete' not in card, f'os minutos antes no lugar do dia e da hora, sem a repetição ({card[:200]!r})')
        ok('14:45' in p.inner_text(ultimo + ' .as-cartao-sub[aria-live]'), 'a prévia: a hora da tarefa menos 15 minutos')
        p.fill(ultimo + ' input[type=number]', '30')
        ok('14:30' in p.inner_text(ultimo + ' .as-cartao-sub[aria-live]'), 'mudou os minutos: a prévia acompanha')
        p.click(ultimo + ' .as-botao-pri'); p.wait_for_selector(ultimo + ' .as-cartao-ok', timeout=5000)
        ult = novos()[-1]
        ok(ult['tarefa_id'] == 'tl-1' and ult['antecedencia_min'] == 30 and ult['repeticao'] == 'uma_vez' and ult['quando'] == iso(datetime.datetime.fromisoformat(TAREFA_DIA + 'T14:30:00-03:00')),
           f'gravou a tarefa, a antecedência e a hora de chegar ({ult})')

        # 3) o cartão dos lembretes que vão chegar
        print('3. Os lembretes que vão chegar')
        p.evaluate("() => { window.__mockDb.lembretes = window.__mockDb.lembretes.filter(l => String(l.id).startsWith('lb-')); }")
        perguntar('Quais lembretes eu tenho?'); p.wait_for_selector(ultimo + ' .as-cartao-lista', timeout=5000)
        itens = p.eval_on_selector_all(ultimo + ' .as-cartao-lista li', 'ls => ls.map(l => l.innerText)')
        ok(len(itens) == 3 and 'Conferir o ponto' in itens[0] and 'Preparar a reunião' in itens[1] and 'Assinar a procuração' in itens[2] and not any('Já chegou' in i for i in itens),
           f'só os pendentes, na ordem da hora de chegar ({[i[:50] for i in itens]})')
        ok('pra Vitória' in itens[0] and 'todo dia útil' in itens[0] and 'de Thalia' in itens[2] and 'tarefa: REUNIÃO COM O CLIENTE' in itens[1] and '14:30' in itens[1],
           'pra quem, de quem, a repetição e a tarefa (pela hora dela)')
        ok('<img' in itens[2] and p.evaluate('window.__xss') is None, 'o texto que veio de fora aparece como texto')
        p.screenshot(path=str(FOTOS / 'assistente-lembretes.png'))
        p.click(ultimo + ' .as-cartao-lista li:nth-child(1) .as-botao-link'); p.wait_for_timeout(600)
        ok(lembrete('lb-2')['situacao'] == 'cancelado' and 'Cancelado.' in p.inner_text(ultimo + ' .as-cartao-lista li:nth-child(1)'), 'cancelar: sai do que vai chegar, com o "Desfazer" na linha')
        p.click(ultimo + ' .as-cartao-lista li:nth-child(1) .as-botao-link'); p.wait_for_timeout(600)
        ok(lembrete('lb-2')['situacao'] == 'pendente' and 'Cancelar' in p.inner_text(ultimo + ' .as-cartao-lista li:nth-child(1)'), 'desfazer: volta a valer')

        # 4) o botão do chat: agenda.html?lembretes=1
        print('4. O botão "Ver os lembretes" do chat')
        p.goto(base + 'agenda.html?lembretes=1'); p.wait_for_selector('.as-painel:not([hidden]) .as-cartao .as-cartao-lista', timeout=6000)
        ok('lembretes=1' not in p.url and 'Conferir o ponto' in p.inner_text('.as-lista .as-msg.ia:last-child .as-cartao'), f'abre o cartão dos lembretes e sai do endereço ({p.url})')
        ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
        b.close()
    srv.shutdown()
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
