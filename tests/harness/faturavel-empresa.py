"""
Teste da tarefa 💰 faturável sem empresa (28/10/2026) — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/faturavel-empresa.py

Ao concluir uma tarefa faturável, o banco cria a cobrança em Faturáveis pela empresa da tarefa; sem empresa, o concluir
voltava com o erro do banco, em inglês, e a tarefa não concluía (22 e 23/10/2026: três tarefas que acabaram excluídas).
O banco falso faz o mesmo que o gatilho de verdade (o 23502, nada muda). Semeadas aqui, com prazo hoje, no setor Fiscal:
"SERVIÇO AVULSO TESTE" (faturável, sem empresa), "OUTRO SERVIÇO TESTE" (faturável, da COMÉRCIO MODELO ME) e
"TAREFA COMUM TESTE" (sem empresa, não faturável). Confere:
  1. Nova tarefa (Agenda): 💰 marcado e nenhuma empresa → a frase, nada gravado; desmarcado → cria (sem o 💰);
  2. editor da Agenda: Concluir a faturável sem empresa → a frase, a tarefa segue aberta;
  3. editor da Agenda: tirar a empresa da faturável e Salvar → a frase, a empresa fica;
  4. lote da Agenda: concluir a faturável sem empresa junto com outra → "Nenhuma foi concluída…", as duas seguem abertas;
  5. Tarefas do Fiscal: Concluir a faturável sem empresa → a frase com "na Agenda", a tarefa segue aberta.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

H = datetime.date.today().isoformat()
FRASE = 'Tarefa 💰 faturável precisa da empresa: ao concluir, a cobrança vai pra ela. Escolha a empresa ou desmarque o Faturável.'
FRASE_SETOR = FRASE + ' A empresa se escolhe no editor da tarefa, na Agenda.'
LOTE = 'Nenhuma foi concluída: uma das tarefas é 💰 faturável e não tem empresa. Abra ela, escolha a empresa (ou desmarque o Faturável) e conclua de novo.'

def tarefa(i, titulo, cli, faturavel):
    return {'id': i, 'titulo': titulo, 'setor': 'fiscal', 'cliente_id': 'c1' if cli else None,
            'clientes': {'nome_principal': 'COMÉRCIO MODELO ME', 'documento': '00000000000000'} if cli else None,
            'responsavel': 'Samuel', 'prazo': H, 'status': 'pendente', 'prioridade': 'media', 'origem': 'avulsa', 'faturavel': faturavel,
            'descricao': None, 'hora': None, 'posicao': 0, 'proposta_id': None, 'transicao_id': None, 'competencia': None,
            'concluida_em': None, 'concluida_por': None}
TAREFAS = [tarefa('fat1', 'SERVIÇO AVULSO TESTE', False, True), tarefa('fat2', 'OUTRO SERVIÇO TESTE', True, True),
           tarefa('com1', 'TAREFA COMUM TESTE', False, False)]
SEMEAR = """
(() => {
  const TAREFAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) { db = v; v.tarefas.push(...TAREFAS); } });
})();
""" % json.dumps(TAREFAS, ensure_ascii=False)

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 1400, 'height': 950})
        p.on('pageerror', lambda e: erros.append(str(e)))
        dialogos, consola = [], []
        p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
        p.on('console', lambda m: consola.append(m.text))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        t_ = lambda i: p.evaluate('id => window.__mockDb.tarefas.find(t => t.id === id)', i)

        # 1. Nova tarefa
        p.goto(base + 'agenda.html'); p.wait_for_selector('.ag-card[data-taskid="fat1"]', timeout=8000)
        p.click('#btnNovaAv'); p.wait_for_selector('#ntTitulo', state='visible', timeout=5000)
        p.fill('#ntTitulo', 'Serviço avulso sem empresa'); p.check('#ntFat')
        dialogos.clear(); p.click('#ntSalvar'); p.wait_for_timeout(500)
        criadas = p.evaluate("() => window.__mockDb.tarefas.filter(t => t.titulo === 'Serviço avulso sem empresa').length")
        ok(dialogos == [FRASE] and criadas == 0, f'1. 💰 sem empresa: a frase e nada gravado ({dialogos})')
        ok(p.is_visible('#ntTitulo') and p.input_value('#ntTitulo') == 'Serviço avulso sem empresa', '1. o formulário segue aberto, com o que foi digitado')
        p.uncheck('#ntFat'); consola.clear()
        with p.expect_navigation(timeout=8000):   # criada, a Agenda recarrega
            p.click('#ntSalvar')
        ins = [c for c in consola if c.startswith('MOCK INSERT tarefas') and 'Serviço avulso sem empresa' in c]
        ok(len(ins) == 1 and '"faturavel":false' in ins[0] and '"cliente_id":null' in ins[0], '1. sem o 💰, cria a tarefa interna, como antes')
        p.wait_for_selector('.ag-card[data-taskid="fat1"]', timeout=8000)

        # 2. editor: concluir a faturável sem empresa
        p.click('.ag-card[data-taskid="fat1"] .ag-card-titulo'); p.wait_for_selector('#detOverlay.is-open', timeout=5000)
        dialogos.clear(); p.click('#dBtnConcluir'); p.wait_for_timeout(400)
        ok(dialogos == [FRASE] and t_('fat1')['status'] == 'pendente', f'2. Concluir: a frase (sem o "Concluir esta tarefa?") e a tarefa segue aberta ({dialogos})')
        p.click('#detClose'); p.wait_for_timeout(300)

        # 3. editor: tirar a empresa da faturável e salvar
        p.click('.ag-card[data-taskid="fat2"] .ag-card-titulo'); p.wait_for_selector('#detOverlay.is-open', timeout=5000)
        p.click('#dCliTira'); dialogos.clear(); p.click('#dSalvar'); p.wait_for_timeout(500)
        ok(dialogos == [FRASE] and t_('fat2')['cliente_id'] == 'c1', f'3. Salvar sem a empresa: a frase e a empresa fica ({dialogos})')
        ok(p.evaluate("() => document.getElementById('detOverlay').classList.contains('is-open')"), '3. o editor segue aberto')
        p.click('#detClose'); p.wait_for_timeout(300)

        # 4. lote da Agenda
        p.click('.fa-focus-card[data-foco="hoje"]'); p.wait_for_selector('#agLoteConcluir', timeout=5000)
        p.check('.ag-lote-ck[data-lote="fat1"]'); p.check('.ag-lote-ck[data-lote="com1"]')
        p.click('#agLoteConcluir'); p.wait_for_selector('#loConfirmar', state='visible', timeout=5000)
        dialogos.clear(); p.click('#loConfirmar'); p.wait_for_timeout(600)
        ok(dialogos == [LOTE] and t_('fat1')['status'] == 'pendente' and t_('com1')['status'] == 'pendente',
           f'4. lote: "Nenhuma foi concluída…" e as duas seguem abertas ({dialogos})')
        ok(p.evaluate("() => window.__mockDb.tarefa_historico.filter(h => ['fat1','com1'].includes(h.tarefa_id)).length") == 0, '4. nada no histórico')

        # 5. Tarefas do Fiscal
        p.goto(base + 'fiscal-tarefas.html'); p.wait_for_selector('details.fa-grupo', timeout=8000)
        p.click('.fa-focus-card[data-periodo="todas"]')
        g = p.locator('details.fa-grupo[data-titulo="SERVIÇO AVULSO TESTE"]'); g.wait_for(timeout=5000)
        if not g.evaluate('d => d.open'): g.locator('.fa-grupo-nome').click()
        g.locator('tr[data-id="fat1"]').click(); p.wait_for_selector('#dBtnConcluir', state='visible', timeout=5000)
        dialogos.clear(); p.click('#dBtnConcluir'); p.wait_for_timeout(400)
        ok(dialogos == [FRASE_SETOR] and t_('fat1')['status'] == 'pendente', f'5. Fiscal: a frase com "na Agenda" e a tarefa segue aberta ({dialogos})')
        p.close(); b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
