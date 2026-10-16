"""
O kit da transição e a lista na descrição da tarefa (16/10/2026) — sem login e sem banco (o mock do conferir.py, com o kit
de entrada do DP semeado por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/kit-transicao.py

Confere:
  1. Transição › Nova transição sem saber se terá funcionários: o DP ganha "Cadastro no Domínio", "Vínculo das rotinas",
     a tarefa "Documentos e acessos do escritório anterior" com a lista dos 8 documentos que não dependem de funcionário e
     "Confirmar se a empresa terá funcionários" — sem o "Cadastro no FGTS Digital"; o cartão mostra "☑ 0/8";
  2. Editar › "Terá funcionários" = Sim: entra o FGTS Digital, a lista ganha os 5 documentos de funcionários (13) e a
     confirmação se conclui (com a linha no histórico);
  3. a janela da tarefa da lista mostra as caixas; marcar uma grava a descrição na hora e o cartão vira "☑ 1/13";
  4. Precificação › Iniciar transição de uma proposta que diz 0 funcionários: a transição nasce "sem funcionários", sem o
     FGTS Digital nem a confirmação, e com a lista dos 8;
  5. a Agenda: o cartão da tarefa com lista mostra o progresso, a janela mostra as caixas e marcar grava (e o cartão muda);
  6. as tarefas do DP (tarefas-engine.js): a janela mostra as caixas e marcar grava;
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

DOC, F, C = 'Documentos e acessos do escritório anterior', 'Documentos e escritório anterior', 'Cadastros e sistemas'
def K(ordem, titulo, prazo, fase, func=False, grupo=None):
    return {'id': 'k%d' % ordem, 'tipo': 'entrada', 'setor': 'dp', 'titulo': titulo, 'responsavel_padrao': 'Vitória', 'prazo_dias': prazo, 'fase': fase,
            'ordem': ordem, 'ativo': True, 'so_com_funcionarios': func, 'agrupar_em': grupo}
KIT = [K(40, 'Cadastro no Domínio', 5, C), K(41, 'Cadastro no FGTS Digital', 7, C, True), K(42, 'Vínculo das rotinas de DP no sistema', 5, C),
       K(43, 'Extrato mensal da folha desde a abertura até o mês de fechamento', 12, F, False, DOC), K(44, 'Login e senha do seguro-desemprego (Empregador Web)', 10, F, True, DOC),
       K(45, 'Ficha dos empregados com quadro de horários', 12, F, True, DOC), K(46, 'Relatório de férias com detalhamento', 12, F, True, DOC),
       K(47, 'Relatório de validados do eSocial', 12, F, False, DOC), K(48, 'Relatório de contribuintes', 12, F, False, DOC),
       K(49, 'FGTS em aberto/ativo ou pago de somente um funcionário — verificar', 12, F, True, DOC), K(50, 'Todas as GFIPs', 15, F, False, DOC),
       K(51, 'Cópia da DIRF entregue', 15, F, False, DOC), K(52, 'Cópia da RAIS', 15, F, False, DOC),
       K(53, 'Vínculo da empresa com clínica (medicina do trabalho) — verificar', 12, F, True, DOC), K(54, 'Informes de rendimentos', 15, F, False, DOC),
       K(55, 'Informações complementares que facilitem a transição', 15, F, False, DOC)]
LISTA = 'Marque cada item quando estiver resolvido.\n☑ Contrato social\n☐ Cartão CNPJ\n☐ Alvará'
SEMEAR = """
(() => {
  const KIT = %s, LISTA = %s;
  const hoje = new Date().toLocaleDateString('sv-SE');
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.transicao_kit = KIT.map(k => ({ ...k }));
    (v.precificacoes || (v.precificacoes = [])).push({ id: 'pp9', cliente_nome: 'PADARIA SEM FUNCIONÁRIOS LTDA', contato: null, cliente_id: null, origem: 'interna', status: 'apresentada',
      respostas: { A1: 'PADARIA SEM FUNCIONÁRIOS LTDA', C1: '0' }, resultado: null, honorario: 500, taxa_unica: null, observacao: null, criado_por: 'financeiro@macedoereis.com.br',
      criado_em: hoje + 'T09:00:00Z', atualizado_em: hoje + 'T09:00:00Z' });
    v.tarefas.push({ id: 'tl1', titulo: 'Juntar documentos da abertura', setor: 'dp', responsavel: 'Samuel', prazo: hoje, status: 'pendente', prioridade: 'media',
      descricao: LISTA, cliente_id: null, proposta_id: null, hora: null, transicao_id: null, posicao: 1, competencia: null, clientes: null, concluida_em: null, concluida_por: null });
  } });
})();
""" % (json.dumps(KIT, ensure_ascii=False), json.dumps(LISTA, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, pagina, erros, largura=1400):
    p = b.new_page(viewport={'width': largura, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{pagina}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
    p.add_init_script(SEMEAR)
    p.goto(base + pagina); p.wait_for_timeout(1500)
    return p

def tarefas_da(p, tid):
    return p.evaluate("tid => window.__mockDb.tarefas.filter(t => t.transicao_id === tid).map(t => ({ id: t.id, titulo: t.titulo, setor: t.setor, status: t.status, descricao: t.descricao || '' }))", tid)

def itens(desc):
    return [l[2:] for l in (desc or '').split('\n') if l[:1] in ('☐', '☑')]

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. Nova transição sem saber se terá funcionários')
        p = abrir(b, base, 'comercial-transicao.html', erros)
        p.click('#btnNova'); p.wait_for_timeout(300)
        p.fill('#nvTitulo', 'LOJA DO KIT LTDA'); p.select_option('#nvTipo', 'entrada'); p.select_option('#nvFunc', '')
        p.click('#nvCriar'); p.wait_for_timeout(1200)
        tid = p.evaluate("() => (window.__mockDb.transicoes.find(t => t.titulo === 'LOJA DO KIT LTDA') || {}).id")
        ts = tarefas_da(p, tid)
        titulos = [t['titulo'] for t in ts]
        ok(sorted(titulos) == sorted(['Cadastro no Domínio', 'Vínculo das rotinas de DP no sistema', DOC, 'Confirmar se a empresa terá funcionários']), f'1. o DP: as soltas, a lista e a confirmação, sem o FGTS Digital ({titulos})')
        lista = next((t for t in ts if t['titulo'] == DOC), {})
        ok(len(itens(lista.get('descricao'))) == 8 and 'Relatório de férias com detalhamento' not in itens(lista.get('descricao')), '1. a lista com os 8 documentos que não dependem de funcionário')
        card = p.locator(f'.tcard[data-tid="{lista.get("id")}"]')
        ok(card.count() == 1 and '☑ 0/8' in card.inner_text(), '1. o cartão mostra "☑ 0/8"')

        print('2. Marcou "Terá funcionários" = Sim')
        p.click('#btnEditar'); p.wait_for_timeout(300)
        p.select_option('#edtFunc', 'true'); p.click('#edtSalvar'); p.wait_for_timeout(1500)
        ts = tarefas_da(p, tid)
        titulos = [t['titulo'] for t in ts]
        ok('Cadastro no FGTS Digital' in titulos and titulos.count(DOC) == 1, f'2. entra o FGTS Digital, sem lista repetida ({titulos})')
        lista = next((t for t in ts if t['titulo'] == DOC), {})
        ok(len(itens(lista.get('descricao'))) == 13 and itens(lista.get('descricao'))[-1] == 'Vínculo da empresa com clínica (medicina do trabalho) — verificar', '2. a lista ganhou os 5 de funcionários (13)')
        conf = next((t for t in ts if t['titulo'] == 'Confirmar se a empresa terá funcionários'), {})
        hist = p.evaluate("id => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === id).map(h => h.descricao)", conf.get('id'))
        ok(conf.get('status') == 'concluida' and any('marcada com funcionários' in h for h in hist), f'2. a confirmação se concluiu, com a linha no histórico ({hist})')
        ok('☑ 0/13' in p.locator(f'.tcard[data-tid="{lista.get("id")}"]').inner_text(), '2. o cartão mostra "☑ 0/13"')

        print('3. A janela da tarefa da lista')
        p.click(f'.tcard[data-tid="{lista.get("id")}"]'); p.wait_for_timeout(400)
        caixas = p.locator('#edChecklist input[type="checkbox"]')
        ok(p.is_visible('#edChecklist') and caixas.count() == 13, f'3. as 13 caixas embaixo da descrição ({caixas.count()})')
        caixas.nth(0).check(); p.wait_for_timeout(500)
        desc = p.evaluate("id => window.__mockDb.tarefas.find(t => t.id === id).descricao", lista.get('id'))
        ok(itens(desc)[0] == 'Extrato mensal da folha desde a abertura até o mês de fechamento' and desc.split('\n')[1].startswith('☑'), '3. marcar grava a descrição na hora (☑ no item)')
        ok('gravado' in p.inner_text('#edChecklist') and 'Lista · 1 de 13' in p.inner_text('#edChecklist'), '3. a lista diz "gravado" e "1 de 13"')
        ok(p.evaluate("() => document.activeElement && document.activeElement.type === 'checkbox'"), '3. o foco fica na caixa (a lista não é redesenhada)')
        p.click('#edCancelar'); p.wait_for_timeout(300)
        ok('☑ 1/13' in p.locator(f'.tcard[data-tid="{lista.get("id")}"]').inner_text(), '3. o cartão vira "☑ 1/13"')
        p.close()

        print('4. Precificação › Iniciar transição de quem não tem funcionários')
        p = abrir(b, base, 'comercial-precificacao.html', erros)
        p.click('#prSeg button[data-v="props"]'); p.wait_for_timeout(700)
        p.select_option('.st-sel[data-st="pp9"]', 'fechada'); p.wait_for_timeout(900)
        p.select_option('#tpTipo', 'entrada')
        p.click('#tpConfirmar')
        p.wait_for_function("() => /Transição criada/.test(document.getElementById('tpMsg').textContent)", timeout=5000)
        tr = p.evaluate("() => window.__mockDb.transicoes.find(t => t.proposta_id === 'pp9')")
        ok(tr and tr['tera_funcionarios'] is False, f'4. a transição nasce "sem funcionários" pela proposta ({tr and tr.get("tera_funcionarios")})')
        ts = tarefas_da(p, tr['id']) if tr else []
        titulos = [t['titulo'] for t in ts]
        lista = next((t for t in ts if t['titulo'] == DOC), {})
        ok('Cadastro no FGTS Digital' not in titulos and 'Confirmar se a empresa terá funcionários' not in titulos and len(itens(lista.get('descricao'))) == 8,
           f'4. sem o FGTS Digital e sem a confirmação, com a lista dos 8 ({titulos})')
        p.close()

        print('5. Agenda')
        p = abrir(b, base, 'agenda.html', erros, largura=1500)
        card = p.locator('.ag-card', has_text='Juntar documentos da abertura').first
        ok(card.count() == 1 and '☑ 1/3' in card.inner_text(), '5. o cartão mostra "☑ 1/3"')
        card.click(); p.wait_for_timeout(900)
        caixas = p.locator('#dChecklist input[type="checkbox"]')
        ok(p.is_visible('#dChecklist') and caixas.count() == 3 and caixas.nth(0).is_checked() and not caixas.nth(1).is_checked(), '5. a janela mostra as 3 caixas, a primeira marcada')
        caixas.nth(1).check(); p.wait_for_timeout(500)
        desc = p.evaluate("() => window.__mockDb.tarefas.find(t => t.id === 'tl1').descricao")
        ok(desc == LISTA.replace('☐ Cartão CNPJ', '☑ Cartão CNPJ'), '5. marcar grava a descrição na hora')
        ok(p.input_value('#dDescricao') == desc, '5. o campo da descrição acompanha (o Salvar grava o mesmo texto)')
        p.fill('#dDescricao', desc + '\n☐ Inscrição estadual'); p.wait_for_timeout(200)
        ok(p.locator('#dChecklist input[type="checkbox"]').count() == 4, '5. digitar um ☐ novo no campo põe a caixa na lista')
        p.keyboard.press('Escape'); p.wait_for_timeout(400)
        p.close()

        print('6. Tarefas do DP')
        p = abrir(b, base, 'dp-tarefas.html', erros)
        p.evaluate("() => document.querySelectorAll('details.fa-grupo').forEach(d => d.open = true)"); p.wait_for_timeout(200)
        linha = p.locator('tr.fa-row-proc[data-id="tl1"]')
        ok(linha.count() == 1 and '☑ 1/3' in linha.inner_text(), '6. a linha mostra "☑ 1/3"')
        linha.locator('td').nth(2).click(); p.wait_for_timeout(700)
        caixas = p.locator('#dChecklist input[type="checkbox"]')
        ok(caixas.count() == 3, f'6. a janela mostra as 3 caixas ({caixas.count()})')
        caixas.nth(2).check(); p.wait_for_timeout(500)
        desc = p.evaluate("() => window.__mockDb.tarefas.find(t => t.id === 'tl1').descricao")
        ok(desc.endswith('☑ Alvará'), '6. marcar grava a descrição na hora')
        p.close()

        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
