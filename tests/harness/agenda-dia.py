"""
A lista do dia da Agenda nova (24/11/2026, a "Direção A" que o Samuel aprovou) — sem login e sem banco (o mock do
conferir.py; as tarefas inventadas entram por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/agenda-dia.py

Confere:
  1. "Comece por aqui": a primeira pela prioridade (e pela ordem arrastada), com a etiqueta da prioridade, a lista da
     descrição (☐/☑) com o progresso, e marcar um item grava na descrição;
  2. "O resto do dia": os grupos Alta, Média e Baixa, nessa ordem, com quantas abertas cada um tem; as de mesmo título
     num grupo que abre e fecha ("3 empresas", "1 de 3"; os "Faturar:" juntos, com o serviço no lugar do título); o grupo
     grande abre recolhido e mostra 8, com o "Mostrar as outras";
  3. concluir pelo círculo: na hora, com o aviso e o "Desfazer" (que devolve a tarefa); a de um grupo também;
  4. "Passar pra amanhã": o prazo vai pro próximo dia útil, com a linha no histórico e o "Desfazer";
  5. a 💰 faturável e o grupo pedem a confirmação (a janela de concluir), sem concluir na hora;
  6. arrastar pra outra prioridade muda a prioridade, com o "Desfazer";
  7. "Feito hoje" abre recolhido, e a escolha fica no navegador; "Sem prazo definido" também;
  8. clicar na linha abre a tarefa; o título com HTML sai como texto;
  9. o dia zerado: a última do dia concluída aqui mostra o "Dia zerado", a carinha do assistente comemora uma vez só,
     e os botões levam ao dia seguinte e ao que foi feito;
e nenhum erro de JavaScript, nem o código dos títulos inventados rodando. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

HOJE = datetime.date.today()
XSS_T = '<img src=x onerror="window.__xss=1">Tarefa com HTML (teste)'
EMPRESAS = ['ALFA (teste) LTDA', 'BETA (teste) LTDA', 'GAMA (teste) LTDA', 'DELTA (teste) LTDA', 'ÉPSILON (teste) LTDA',
            'ZETA (teste) LTDA', 'ETA (teste) LTDA', 'TETA (teste) LTDA', 'IOTA (teste) LTDA', 'CAPA (teste) LTDA']

# o dia do Samuel (além das do mock: a t31 alta às 14h30, a t32 média e a t9 do IRPF, já feita)
SEMEAR = """
(() => {
  const XT = %s, EMP = %s, ZERAR = %s;
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const T = (id, titulo, setor, resp, prazo, prio, extra = {}) => ({ id, titulo, setor, responsavel: resp, prazo, status: 'pendente', prioridade: prio, cliente_id: extra.cli ? 'c-' + id : null,
    proposta_id: null, hora: null, transicao_id: null, posicao: 500, clientes: extra.cli ? { nome_principal: extra.cli, documento: '00000000000000' } : null,
    concluida_em: null, concluida_por: null, ...extra });
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.tarefas.push(
      T('l1', 'Criar a conta do escritório na plataforma (teste)', 'comercial', 'Samuel', d(0), 'alta', { posicao: 1, descricao: 'Passos:\\n☑ Cadastro\\n☑ Confirmar o e-mail\\n☐ Documentos da empresa\\n☐ Conta bancária' }),
      T('o1', 'SEDIF/DESTDA (teste)', 'fiscal', 'Samuel', d(0), 'media', { cli: 'COMÉRCIO MODELO ME' }),
      T('o2', 'SEDIF/DESTDA (teste)', 'fiscal', 'Samuel', d(0), 'media', { cli: 'EMPRESA EXEMPLO LTDA' }),
      T('o3', 'SEDIF/DESTDA (teste)', 'fiscal', 'Samuel', d(0), 'media', { cli: 'LOJA DE TESTE LTDA', status: 'concluida', concluida_em: new Date().toISOString(), concluida_por: 'financeiro@macedoereis.com.br' }),
      T('f1', 'Faturar: 1 emissão de nota fiscal — AGRO FICTÍCIA LTDA', 'financeiro', 'Samuel', d(0), 'media', { cli: 'AGRO FICTÍCIA LTDA', origem: 'faturamento' }),
      T('f2', 'Faturar: 1 recálculo de INSS — COMÉRCIO MODELO ME', 'financeiro', 'Samuel', d(0), 'media', { cli: 'COMÉRCIO MODELO ME', origem: 'faturamento' }),
      T('w1', 'Aguardar o retorno do cliente (teste)', 'societario', 'Samuel', d(0), 'baixa', { status: 'aguardando', cli: 'EMPRESA EXEMPLO LTDA' }),
      T('fz1', 'Emitir a guia cobrável (teste)', 'financeiro', 'Samuel', d(0), 'media', { cli: 'COMÉRCIO MODELO ME', faturavel: true }),
      T('xs1', XT, 'comercial', 'Samuel', d(0), 'media'),
      ...EMP.map((e, i) => T('rc' + i, 'Recadastramento (teste)', 'fiscal', 'Samuel', d(0), 'media', { cli: e }))
    );
    if (ZERAR) {
      // o dia quase zerado: tudo do Samuel feito, menos a t32, e as rotinas dele feitas hoje
      v.tarefas.forEach(t => { if (t.prazo === d(0) && ['samuel', 'ambos'].includes(String(t.responsavel).toLowerCase()) && t.id !== 't32' && t.status !== 'concluida') {
        t.status = 'concluida'; t.concluida_em = new Date().toISOString(); t.concluida_por = 'financeiro@macedoereis.com.br'; } });
      v.rotinas.forEach(r => { if (r.responsavel === 'Samuel') r.ultima_execucao = d(0); });
    }
  } });
})();
"""
def semear(zerar=False):
    return SEMEAR % (json.dumps(XSS_T, ensure_ascii=False), json.dumps(EMPRESAS, ensure_ascii=False), 'true' if zerar else 'false')

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

ERROS = []
def nova_pagina(b, zerar=False, largura=1600, altura=1100):
    p = b.new_page(viewport={'width': largura, 'height': altura})
    p.on('pageerror', lambda e: ERROS.append(str(e)))
    p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
    p.add_init_script(semear(zerar))
    p.add_init_script("""window.__eventos = []; ['mr:feito', 'mr:comemorar'].forEach(n => window.addEventListener(n, e => window.__eventos.push({ n, detail: e.detail })));""")
    return p

def abrir_agenda(p, base):
    p.goto(base + 'agenda.html')
    p.wait_for_selector('#sdDia .sd-anel', timeout=8000)

def tarefa(p, id):
    return p.evaluate("id => { const t = window.__mockDb.tarefas.find(x => x.id === id); return t ? { status: t.status, prazo: t.prazo, prioridade: t.prioridade, descricao: t.descricao || '', concluida_por: t.concluida_por } : null; }", id)

def toast(p):
    p.wait_for_selector('#agToast.on', timeout=5000)
    return ' '.join(p.text_content('#agToast span').split())

def desfazer(p):
    p.click('#agToastDesf')

def lote(p, titulo):
    """o grupo do resto do dia pelo título"""
    return p.evaluate("""t => { const l = [...document.querySelectorAll('#agResto .ag-lote')].find(x => x.querySelector('.ag-lote-cab .ag-card-titulo').textContent === t);
      if (!l) return null; const itens = l.querySelector('.ag-lote-itens');
      return { id: l.dataset.lote, aberto: l.classList.contains('aberto'), tag: l.querySelector('.ag-lote-cab .ag-tag').textContent,
               prog: (l.querySelector('.ag-lote-prog') || {}).textContent, expandido: l.querySelector('.ag-lote-t').getAttribute('aria-expanded'), escondidos: itens.hidden,
               itens: [...itens.querySelectorAll(':scope > .ag-item')].map(x => ({ id: x.dataset.taskid, t: x.querySelector('.ag-card-titulo').textContent, s: (x.querySelector('.ag-emp') || {}).textContent || '' })),
               mais: (itens.querySelector('.ag-mais') || {}).textContent || '' }; }""", titulo)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = nova_pagina(b)
        abrir_agenda(p, base)

        print('1. Comece por aqui')
        ok(p.text_content('.ag-sec-foco .ag-card-titulo') == 'Criar a conta do escritório na plataforma (teste)', f'1. a primeira pela prioridade e pela ordem ("{p.text_content(".ag-sec-foco .ag-card-titulo")}")')
        ok(p.text_content('.ag-sec-foco .ag-tag.t-prio') == 'Alta', '1. com a etiqueta da prioridade')
        subs = p.eval_on_selector_all('.ag-sec-foco .ag-sub', 'xs => xs.map(x => ({ t: x.textContent, on: x.classList.contains("on"), p: x.getAttribute("aria-pressed") }))')
        ok([s['t'] for s in subs] == ['Cadastro', 'Confirmar o e-mail', 'Documentos da empresa', 'Conta bancária'] and [s['on'] for s in subs] == [True, True, False, False]
           and [s['p'] for s in subs] == ['true', 'true', 'false', 'false'], f'1. a lista da descrição, com o que está feito ({subs})')
        ok(p.text_content('.ag-sec-foco .ag-ck-n') == '☑ 2/4', f'1. o progresso: "{p.text_content(".ag-sec-foco .ag-ck-n")}"')
        botoes = [' '.join(x.split()) for x in p.eval_on_selector_all('.ag-sec-foco .ag-foco-acoes .btn', 'xs => xs.map(x => x.textContent)')]
        ok(botoes[0] == 'Concluir' and botoes[1].startswith('Passar pra ') and botoes[2] == 'Abrir', f'1. os botões: {botoes}')
        p.click('.ag-sec-foco .ag-sub:has-text("Documentos da empresa")')
        p.wait_for_function("() => (window.__mockDb.tarefas.find(x => x.id === 'l1').descricao || '').includes('☑ Documentos da empresa')", timeout=5000)
        p.wait_for_function("() => document.querySelector('.ag-sec-foco .ag-ck-n').textContent === '☑ 3/4'", timeout=5000)
        ok('☐ Conta bancária' in tarefa(p, 'l1')['descricao'], '1. marcar um item grava na descrição (☑ Documentos da empresa, 3/4), e o resto fica')

        print('2. O resto do dia')
        grupos = p.eval_on_selector_all('#agResto .ag-grupo', 'xs => xs.map(x => [x.dataset.grupo, x.querySelector(".ag-grupo-n").textContent])')
        esperado = p.evaluate("""() => { const h = new Date(), hs = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
          const ab = window.__mockDb.tarefas.filter(t => t.prazo === hs && t.status !== 'concluida' && ['samuel', 'ambos'].includes(String(t.responsavel).toLowerCase()) && t.id !== 'l1');
          return ['alta', 'media', 'baixa'].map(pr => [pr, String(ab.filter(t => t.prioridade === pr).length)]).filter(x => x[1] !== '0'); }""")
        ok(grupos == esperado, f'2. os grupos por prioridade, nessa ordem, com quantas abertas ({grupos}; esperado {esperado})')
        ok(p.text_content('#agResto .ag-cont') == str(sum(int(n) for _, n in esperado)), f'2. e o total do resto do dia ({p.text_content("#agResto .ag-cont")})')
        s = lote(p, 'SEDIF/DESTDA (teste)')
        ok(s and s['tag'] == '3 empresas' and s['prog'] == '1 de 3' and s['aberto'] and s['expandido'] == 'true' and not s['escondidos']
           and [i['t'] for i in s['itens']] == ['COMÉRCIO MODELO ME', 'EMPRESA EXEMPLO LTDA'], f'2. as de mesmo título num grupo, aberto, só as que faltam, pela empresa ({s})')
        f = lote(p, 'Faturar')
        ok(f and f['tag'] == '2 empresas' and [(i['t'], i['s']) for i in f['itens']] == [('1 emissão de nota fiscal', 'AGRO FICTÍCIA LTDA'), ('1 recálculo de INSS', 'COMÉRCIO MODELO ME')],
           f'2. os "Faturar:" juntos, com o serviço e a empresa ({f and f["itens"]})')
        r = lote(p, 'Recadastramento (teste)')
        ok(r and r['tag'] == '10 empresas' and not r['aberto'] and r['escondidos'] and r['expandido'] == 'false', '2. o grupo grande abre recolhido')
        p.click(f'[data-lote-alternar="{r["id"]}"]')
        r = lote(p, 'Recadastramento (teste)')
        ok(r['aberto'] and not r['escondidos'] and len(r['itens']) == 8 and r['mais'] == 'Mostrar as outras 2', f'2. aberto, mostra 8 e o "{r["mais"]}"')
        p.click(f'[data-lote-mais="{r["id"]}"]')
        r = lote(p, 'Recadastramento (teste)')
        ok(r['aberto'] and len(r['itens']) == 10 and not r['mais'], '2. e todas, com o "Mostrar as outras"')
        p.click(f'[data-lote-alternar="{s["id"]}"]')
        s = lote(p, 'SEDIF/DESTDA (teste)')
        ok(not s['aberto'] and s['escondidos'] and s['expandido'] == 'false', '2. o grupo fecha')
        p.click(f'[data-lote-alternar="{s["id"]}"]')

        print('3. Concluir, com o "Desfazer"')
        antes = ' '.join(p.text_content('#agFrase').split())
        p.click('[data-concluir="t32"]')
        t = toast(p)
        ok(t == 'Concluída: Conferir boletos do dia' and p.is_visible('#agToastDesf'), f'3. o aviso: "{t}", com o "Desfazer"')
        ok(tarefa(p, 't32')['status'] == 'concluida' and tarefa(p, 't32')['concluida_por'] == 'financeiro@macedoereis.com.br', '3. concluída no banco, por quem entrou')
        ok(not p.query_selector('#agResto [data-taskid="t32"]') and p.query_selector('#agFeitoLista [data-taskid="t32"]'), '3. saiu do resto do dia e foi pro "Feito hoje"')
        depois = ' '.join(p.text_content('#agFrase').split())
        ok(depois != antes, f'3. a frase do alto acompanha ("{antes}" → "{depois}")')
        ok(any(e['n'] == 'mr:feito' and e['detail'] == {'n': 1} for e in p.evaluate('() => window.__eventos')), '3. o assistente fica sabendo (mr:feito)')
        desfazer(p)
        p.wait_for_function("() => document.querySelector('#agToast span') && document.querySelector('#agToast span').textContent === 'Voltou pra lista.'", timeout=5000)
        p.wait_for_selector('#agResto [data-taskid="t32"]', timeout=5000)
        ok(tarefa(p, 't32')['status'] == 'pendente' and tarefa(p, 't32')['concluida_por'] is None, '3. "Desfazer": voltou pra lista, e pendente no banco')
        p.click('[data-concluir="o1"]')
        t = toast(p)
        ok(t == 'Concluída: SEDIF/DESTDA (teste)' and lote(p, 'SEDIF/DESTDA (teste)')['prog'] == '2 de 3', f'3. a de um grupo também ("{t}", {lote(p, "SEDIF/DESTDA (teste)")["prog"]})')
        desfazer(p)
        p.wait_for_function("() => document.querySelector('#agToast span') && document.querySelector('#agToast span').textContent === 'Voltou pra lista.'", timeout=5000)

        print('4. Passar pra amanhã')
        p.click('[data-adiar="w1"]')
        t = toast(p)
        w = tarefa(p, 'w1')
        novo = datetime.date.fromisoformat(w['prazo'])
        ok(t.startswith('Passou pra ') and novo > HOJE and novo.weekday() < 5, f'4. o prazo foi pro próximo dia útil ({w["prazo"]}: "{t}")')
        ok(not p.query_selector('#agResto [data-taskid="w1"]'), '4. e saiu do dia')
        hist = p.evaluate("() => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === 'w1').map(h => h.descricao)")
        ok(any('pelo atalho da Agenda' in h for h in hist), f'4. a linha no histórico ({hist})')
        desfazer(p)
        p.wait_for_selector('#agResto [data-taskid="w1"]', timeout=5000)
        ok(tarefa(p, 'w1')['prazo'] == HOJE.isoformat(), '4. "Desfazer": voltou pra hoje')

        print('5. A confirmação')
        p.click('[data-concluir="fz1"]')
        p.wait_for_function("() => getComputedStyle(document.getElementById('loOverlay')).display !== 'none'", timeout=4000)
        ok(p.text_content('#loTitulo') == 'Concluir 1 tarefa' and tarefa(p, 'fz1')['status'] == 'pendente', '5. a 💰 faturável abre a janela de concluir, sem concluir na hora')
        p.click('#loCancelar')
        p.click(f'[data-lote-concluir="{f["id"]}"]')
        p.wait_for_function("() => getComputedStyle(document.getElementById('loOverlay')).display !== 'none'", timeout=4000)
        ok(p.text_content('#loTitulo') == 'Concluir 2 tarefas' and tarefa(p, 'f1')['status'] == 'pendente', '5. o grupo também ("Concluir 2 tarefas")')
        p.click('#loCancelar')

        print('6. Arrastar pra outra prioridade')
        p.evaluate("""() => { const src = document.querySelector('#agResto .ag-linha[data-taskid="t31"]'), alvo = document.querySelector('#agResto .ag-lista[data-prio="media"] > .ag-linha[data-taskid="t32"]');
          const dt = new DataTransfer(), r = alvo.getBoundingClientRect();
          src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
          alvo.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: r.top + 2 }));
          src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); }""")
        t = toast(p)
        ok(t == 'Prioridade média.' and tarefa(p, 't31')['prioridade'] == 'media', f'6. solta na Média: a prioridade muda ("{t}")')
        p.wait_for_selector('#agResto .ag-lista[data-prio="media"] [data-taskid="t31"]', timeout=4000)
        desfazer(p)
        p.wait_for_selector('#agResto .ag-lista[data-prio="alta"] [data-taskid="t31"]', timeout=5000)
        ok(tarefa(p, 't31')['prioridade'] == 'alta', '6. "Desfazer": voltou pra Alta')

        print('7. Feito hoje e Sem prazo')
        ok(p.text_content('#agFeitoBtn').strip() == 'Mostrar' and p.get_attribute('#agFeitoBtn', 'aria-expanded') == 'false' and p.is_hidden('#agFeitoLista'), '7. "Feito hoje" abre recolhido')
        p.click('#agFeitoBtn')
        ok(p.is_visible('#agFeitoLista [data-taskid="t9"]') and p.is_visible('#agFeitoLista [data-taskid="o3"]') and p.text_content('#agFeitoBtn').strip() == 'Esconder',
           '7. aberto, com as feitas do dia (a do IRPF e a do grupo)')
        ok(p.evaluate("() => localStorage.getItem('mr_agenda_feito')") == '1', '7. a escolha fica no navegador')
        ok(p.evaluate("() => !document.querySelector('#agSemPrazo details').open") and '1' in p.text_content('#agSemPrazo summary') and 'Sem prazo definido' in p.text_content('#agSemPrazo summary'),
           '7. "Sem prazo definido" recolhido, com quantas')
        p.click('#agSemPrazo summary')
        p.wait_for_selector('[data-sptask="t41"]', timeout=4000)
        ok(p.evaluate("() => localStorage.getItem('mr_agenda_semprazo')") == '1', '7. aberto, e a escolha fica no navegador')
        p.reload()
        p.wait_for_selector('#sdDia .sd-anel', timeout=8000)
        ok(p.is_visible('#agFeitoLista [data-taskid="t9"]') and p.evaluate("() => document.querySelector('#agSemPrazo details').open"), '7. recarregada a tela, os dois seguem abertos')

        print('8. Abrir e o texto de fora')
        p.click('#agResto .ag-card[data-taskid="t31"] .ag-card-titulo')
        p.wait_for_selector('#detOverlay.is-open', timeout=4000)
        ok(p.input_value('#dTituloInp').startswith('Enviar contrato de prestação'), '8. clicar na linha abre a tarefa')
        p.click('#detClose')
        ok(XSS_T in p.inner_text('#agResto') and not p.query_selector('#agConteudo img') and p.evaluate('() => window.__xss') is None, '8. o título com HTML como texto, sem rodar nada')
        p.close()

        print('9. O dia zerado')
        p = nova_pagina(b, zerar=True)
        abrir_agenda(p, base)
        p.wait_for_selector('.ag-sec-foco [data-concluir="t32"]', timeout=6000)
        p.click('.ag-sec-foco .ag-foco-acoes [data-concluir="t32"]')
        p.wait_for_selector('#agConteudo .ag-zerado', timeout=6000)
        ok(p.text_content('.ag-zerado h2') == 'Dia zerado.' and p.text_content('.ag-zerado p').startswith('Tudo o que era de hoje está feito.'), f'9. "Dia zerado." ("{p.text_content(".ag-zerado p")}")')
        com = [e for e in p.evaluate('() => window.__eventos') if e['n'] == 'mr:comemorar']
        ok(len(com) == 1 and com[0]['detail'].get('recado') is True, f'9. a carinha do assistente comemora ({com})')
        ok(' '.join(p.text_content('#agFrase').split()).split('. ', 1)[1].startswith('Dia zerado.'), f'9. e a frase do alto ("{" ".join(p.text_content("#agFrase").split())}")')
        ok('zerado' in (p.get_attribute(f'#agSemana .ag-wk[data-sddia="{HOJE.isoformat()}"]', 'class') or ''), '9. e o dia de hoje "zerado" na tira')
        desfazer(p)
        p.wait_for_selector('.ag-sec-foco [data-concluir="t32"]', timeout=6000)
        p.click('.ag-sec-foco .ag-foco-acoes [data-concluir="t32"]')
        p.wait_for_selector('#agConteudo .ag-zerado', timeout=6000)
        ok(len([e for e in p.evaluate('() => window.__eventos') if e['n'] == 'mr:comemorar']) == 1, '9. desfeito e zerado de novo: a comemoração é uma vez só por tela')
        p.wait_for_selector('.ag-zerado [data-sddia]', timeout=6000)
        p.click('#agVerFeito')
        ok(p.is_visible('#agFeitoLista [data-taskid="t32"]'), '9. "Ver o que foi feito" abre o "Feito hoje"')
        dia = p.get_attribute('.ag-zerado [data-sddia]', 'data-sddia')
        rot = ' '.join(p.text_content('.ag-zerado [data-sddia]').split())
        p.click('.ag-zerado [data-sddia]')
        p.wait_for_function('d => document.querySelector(`#agSemana .ag-wk[data-sddia="${d}"]`) && document.querySelector(`#agSemana .ag-wk[data-sddia="${d}"]`).getAttribute("aria-pressed") === "true"', arg=dia, timeout=6000)
        ok(dia > HOJE.isoformat() and datetime.date.fromisoformat(dia).weekday() < 5, f'9. "{rot}" abre o próximo dia útil ({dia})')
        p.close()

        b.close()
    srv.shutdown()
    for e in ERROS: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(ERROS)} falha(s).' if falhas or ERROS else '\nTudo certo.')
    sys.exit(1 if falhas or ERROS else 0)

if __name__ == '__main__':
    main()
