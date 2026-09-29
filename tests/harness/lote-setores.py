"""
Teste de comportamento do lote nas telas de tarefas dos setores (assets/js/tarefas-engine.js):
"Registrar andamento" e "Concluir" pela janela do lote — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/lote-setores.py

Abre fiscal-tarefas.html nos temas escuro e claro e confere, no grupo inventado "Conferir notas de entrada"
(3 tarefas no supabase.mock.js, uma delas "em andamento"):
  1. marcar 2 tarefas do grupo -> a barra mostra "Concluir 2 tarefas" e "Registrar andamento";
  2. "Registrar andamento" com texto -> 2 linhas novas em tarefa_historico com o texto; o status das 2 NÃO muda;
  3. "Registrar andamento" com texto vazio -> nada gravado (e a janela avisa);
  4. "Concluir" com observação -> as 2 ficam 'concluida' e o histórico traz 'Tarefa concluída. ' + observação;
  5. "Cancelar" (e também o x e o clique fora) -> nada gravado.
Extras: concluir sem observação grava só 'Tarefa concluída.'; os cuidados do concluir continuam (quem outra pessoa
concluiu no meio não é sobrescrito); travas de tela e progresso "Registrando i de N…" durante o lote; nenhuma
janela do navegador (alert/confirm); societario-tarefas.html (item "processo") usa o gênero certo.
Fotos da barra e da janela em .harness/fotos/lote-<tema>-*.png. Termina com código 1 se alguma checagem falhar.
Pré-requisito (uma vez): pip install playwright  e  python -m playwright install chromium
"""
import sys, pathlib, traceback
sys.dont_write_bytecode = True   # o import do conferir.py não deixa __pycache__ no repositório
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, RAIZ, FOTOS

GRUPO_FISCAL = 'Conferir notas de entrada'           # t61 (pendente), t62 (em andamento), t63 (pendente)
GRUPO_RECAD = 'RECADASTRAMENTO SEFAZ RS - GERAIS'    # t51, t52 (prazo daqui a 13 dias)
GRUPO_SOC = 'Alteração contratual'                   # t64, t65 (societário: item "processo")
USUARIO = 'financeiro@macedoereis.com.br'            # e-mail do usuário falso do mock
OUTRA = 'outra.pessoa@macedoereis.com.br'
OBS_AND = 'Notas conferidas no portal; faltam 2 XML do fornecedor.'
OBS_CONC = 'Tudo lançado e cliente avisado.'
AVISO_VAZIO = 'Escreve o que aconteceu — é isso que vai pro histórico.'

falhas = []

def checa(cond, msg):
    print(('   ok    ' if cond else '   FALHA ') + msg)
    if not cond: falhas.append(msg)

def cenario(nome, fn, *a):
    try: fn(*a)
    except Exception as e:   # uma quebra no meio não esconde o resto do relatório
        checa(False, f'{nome}: parou com erro — {type(e).__name__}: {str(e).splitlines()[0][:200]}')
        traceback.print_exc(limit=1)

def historico(p):
    return p.evaluate('() => window.__mockDb.tarefa_historico.map(h => ({ tarefa_id: h.tarefa_id, descricao: h.descricao, autor: h.autor }))')

def estado(p, ids):
    return {t['id']: t for t in p.evaluate('ids => window.__mockDb.tarefas.filter(t => ids.includes(t.id)).map(t => ({ id: t.id, status: t.status, concluida_por: t.concluida_por }))', ids)}

def abrir_tela(p, base, tela):
    p.goto(base + tela)
    p.wait_for_selector('details.fa-grupo')
    p.click('.fa-focus-card[data-periodo="todas"]')   # não depende do dia do mês (o prazo "hoje" do mock pode cair no mês seguinte em UTC)

def grupo(p, titulo):
    g = p.locator(f'details.fa-grupo[data-titulo="{titulo}"]')
    g.wait_for()
    if not g.evaluate('d => d.open'): g.locator('.fa-grupo-nome').click()
    return g

def marcar(g, n):
    caixas = g.locator('input[data-sel]')
    ids = []
    for i in range(n):
        caixas.nth(i).check()
        ids.append(caixas.nth(i).get_attribute('data-sel'))
    return ids

def janela(p):
    return {
        'aberta': p.locator('#loteOverlay').evaluate('o => o.classList.contains("is-open")'),
        'titulo': p.inner_text('#loteTitulo').strip(),
        'rotulo': p.inner_text('#loteLabel').strip(),
        'botao': p.inner_text('#loteConfirmar').strip(),
    }

def confirmar_e_esperar(p, texto_resumo):
    p.evaluate('() => document.querySelectorAll(".fa-lote-resumo").forEach(e => e.remove())')
    p.click('#loteConfirmar')
    p.wait_for_selector(f'.fa-lote-resumo:has-text("{texto_resumo}")')
    return p.inner_text('.fa-lote-resumo').strip()

def fiscal_itens(p, base, tema):
    print(f'\n[{tema}] fiscal-tarefas.html — grupo "{GRUPO_FISCAL}"')
    abrir_tela(p, base, 'fiscal-tarefas.html')
    g = grupo(p, GRUPO_FISCAL)
    todos = [c.get_attribute('data-sel') for c in g.locator('input[data-sel]').all()]
    checa(len(todos) == 3, f'o grupo tem 3 tarefas abertas com caixa (achou {len(todos)})')
    antes = estado(p, todos)

    # 1. marcar 2 -> dois botões na barra
    ids = marcar(g, 2); outra = [i for i in todos if i not in ids]
    barra = g.locator('[data-lote]')
    checa(barra.is_visible(), '1. marcar 2 mostra a barra de lote')
    checa(barra.locator('[data-lote-ok]').inner_text().strip() == 'Concluir 2 tarefas', '1. botão "Concluir 2 tarefas" na barra')
    checa(barra.locator('[data-lote-and]').inner_text().strip() == 'Registrar andamento', '1. botão "Registrar andamento" na barra')
    checa('O lote não gera cobrança à parte' in barra.inner_text(), '1. o aviso de cobrança à parte continua na barra')
    g.screenshot(path=str(FOTOS / f'lote-{tema}-barra.png'))

    # 2. registrar andamento com texto
    h0 = historico(p)
    barra.locator('[data-lote-and]').click()
    j = janela(p)
    checa(j['aberta'], '2. "Registrar andamento" abre a janela (sem confirm do navegador)')
    checa(j['titulo'] == 'Registrar andamento em 2 tarefas', f'2. título "{j["titulo"]}"')
    checa(j['rotulo'] == 'O que aconteceu — vai pro histórico de cada uma', f'2. rótulo "{j["rotulo"]}"')
    checa(j['botao'] == 'Registrar em 2', f'2. botão "{j["botao"]}"')
    p.fill('#loteObs', OBS_AND)
    p.screenshot(path=str(FOTOS / f'lote-{tema}-janela-andamento.png'))
    resumo = confirmar_e_esperar(p, 'Andamento registrado')
    checa(resumo == '✓ Andamento registrado em 2 tarefas.', f'2. resumo "{resumo}"')
    novos = historico(p)[len(h0):]
    esperado = OBS_AND + ' (registrado em lote, 2 tarefas)'
    checa(len(novos) == 2, f'2. {len(novos)} linha(s) nova(s) em tarefa_historico (esperado 2)')
    checa(sorted(h['tarefa_id'] for h in novos) == sorted(ids), '2. uma linha para cada tarefa marcada (e nenhuma na não marcada)')
    checa(all(h['descricao'] == esperado for h in novos), f'2. texto do histórico = "{esperado}"')
    checa(all(h['autor'] == USUARIO for h in novos), '2. autor = usuário logado')
    depois = estado(p, todos)
    checa(all(depois[i]['status'] == antes[i]['status'] for i in todos),
          '2. status NÃO mudou, tarefa por tarefa (' + ', '.join(f'{i}: {antes[i]["status"]} -> {depois[i]["status"]}' for i in todos) + ')')
    g = p.locator(f'details.fa-grupo[data-titulo="{GRUPO_FISCAL}"]')
    checa(g.locator('input[data-sel]:checked').count() == 0 and g.locator('[data-lote]').is_hidden(), '2. depois de gravar, a seleção é limpa e a lista recarrega')
    p.screenshot(path=str(FOTOS / f'lote-{tema}-resumo-andamento.png'))

    # 3. registrar andamento vazio (e só espaços) -> nada gravado, a janela avisa
    ids = marcar(g, 2)
    h0 = historico(p)
    g.locator('[data-lote-and]').click()
    p.fill('#loteObs', '   ')
    p.click('#loteConfirmar')
    aviso = p.locator('#loteMsg')
    checa(janela(p)['aberta'], '3. texto vazio: a janela continua aberta')
    checa(aviso.is_visible() and aviso.inner_text().strip() == AVISO_VAZIO, f'3. aviso "{AVISO_VAZIO}"')
    p.screenshot(path=str(FOTOS / f'lote-{tema}-janela-vazio.png'))
    checa(len(historico(p)) == len(h0), '3. texto vazio: nada gravado em tarefa_historico')
    p.click('#loteCancelar')

    # 5. cancelar / x / clique fora -> nada gravado
    h0 = historico(p)
    g.locator('[data-lote-ok]').click()
    j = janela(p)
    checa(j['aberta'] and j['titulo'] == 'Concluir 2 tarefas', f'5. "Concluir" abre a janela: "{j["titulo"]}"')
    checa(j['rotulo'] == 'Observação (opcional) — vai pro histórico de cada uma', f'5. rótulo "{j["rotulo"]}"')
    checa(j['botao'] == 'Concluir 2', f'5. botão "{j["botao"]}"')
    p.fill('#loteObs', OBS_CONC)
    p.screenshot(path=str(FOTOS / f'lote-{tema}-janela-concluir.png'))
    p.click('#loteCancelar')
    checa(not janela(p)['aberta'], '5. "Cancelar" fecha a janela')
    g.locator('[data-lote-ok]').click(); p.fill('#loteObs', OBS_CONC)
    p.mouse.click(10, 500)   # fora da caixa (no fundo escurecido, abaixo do topo)
    checa(not janela(p)['aberta'], '5. clique fora fecha a janela')
    g.locator('[data-lote-and]').click(); p.fill('#loteObs', OBS_AND)
    p.click('#loteClose')
    checa(not janela(p)['aberta'], '5. o x fecha a janela')
    checa(len(historico(p)) == len(h0), '5. Cancelar / fora / x: nada gravado em tarefa_historico')
    d5 = estado(p, todos)
    checa(all(d5[i]['status'] == antes[i]['status'] for i in todos), '5. Cancelar / fora / x: nenhum status mudou')
    checa(g.locator('input[data-sel]:checked').count() == 2, '5. a seleção continua marcada depois de cancelar')
    g.locator('[data-lote-ok]').dblclick()   # o 2º clique cai no fundo da janela recém-aberta: não pode fechar
    checa(janela(p)['aberta'], '5. duplo clique no botão da barra deixa a janela aberta')
    p.click('#loteCancelar')

    # 4. concluir com observação
    h0 = historico(p)
    g.locator('[data-lote-ok]').click()
    p.fill('#loteObs', OBS_CONC)
    resumo = confirmar_e_esperar(p, 'concluídas')
    checa(resumo == '✓ 2 tarefas concluídas.', f'4. resumo "{resumo}"')
    st = estado(p, todos)
    checa(all(st[i]['status'] == 'concluida' and st[i]['concluida_por'] == USUARIO for i in ids), '4. as 2 marcadas ficaram concluídas no banco (concluida_por = usuário)')
    checa(all(st[i]['status'] == antes[i]['status'] for i in outra), '4. a não marcada continua como estava')
    novos = historico(p)[len(h0):]
    esperado = 'Tarefa concluída. ' + OBS_CONC
    checa(len(novos) == 2 and sorted(h['tarefa_id'] for h in novos) == sorted(ids), f'4. 2 linhas no histórico, uma por tarefa concluída (achou {len(novos)})')
    checa(all(h['descricao'] == esperado for h in novos), f'4. texto do histórico = "{esperado}"')

    # extra: concluir sem observação grava só o texto padrão
    g = p.locator(f'details.fa-grupo[data-titulo="{GRUPO_FISCAL}"]')
    h0 = historico(p)
    marcar(g, 1)
    g.locator('[data-lote-ok]').click()
    j = janela(p)
    checa(j['titulo'] == 'Concluir 1 tarefa' and j['botao'] == 'Concluir 1', f'extra. 1 marcada: "{j["titulo"]}" / "{j["botao"]}"')
    confirmar_e_esperar(p, 'concluída')
    novos = historico(p)[len(h0):]
    checa(len(novos) == 1 and novos[0]['descricao'] == 'Tarefa concluída.' and novos[0]['tarefa_id'] == outra[0], f'extra. concluir sem observação grava só "Tarefa concluída." (achou {[h["descricao"] for h in novos]})')

def fiscal_cuidados(p, base, tema):
    print(f'\n[{tema}] fiscal-tarefas.html — travas, progresso e "já estava concluída" (grupo "{GRUPO_RECAD}")')
    abrir_tela(p, base, 'fiscal-tarefas.html')
    g = grupo(p, GRUPO_RECAD)
    ids = marcar(g, 2)
    # travas e progresso: cada consulta do mock leva 300ms; um observador marca se o botão vizinho ("Concluir")
    # volta a ficar clicável enquanto a barra antiga ainda está na tela (antes da recarga)
    p.evaluate('''t => {
        window.__mockDelay = 300; window.__reabriu = false;
        const ok = document.querySelector(`details.fa-grupo[data-titulo="${t}"] [data-lote-ok]`);
        new MutationObserver(() => { if (ok.isConnected && !ok.disabled) window.__reabriu = true; })
          .observe(ok, { attributes: true, attributeFilter: ['disabled'] });
    }''', GRUPO_RECAD)
    g.locator('[data-lote-and]').click()
    p.fill('#loteObs', 'Protocolo recebido.')
    p.evaluate('() => document.querySelectorAll(".fa-lote-resumo").forEach(e => e.remove())')
    p.click('#loteConfirmar')
    p.wait_for_selector(f'details.fa-grupo[data-titulo="{GRUPO_RECAD}"] [data-lote-and]:has-text("Registrando 1 de 2")')
    trav = p.evaluate('''t => {
        const g = document.querySelector(`details.fa-grupo[data-titulo="${t}"]`);
        const outros = [...document.querySelectorAll('details.fa-grupo')].filter(d => d !== g);
        return {
          busca: document.getElementById('searchInput').disabled,
          filtros: document.getElementById('filterStatus').disabled && document.getElementById('filterResp').disabled,
          foco: [...document.querySelectorAll('.fa-focus-card')].every(b => b.disabled),
          vizinho: g.querySelector('[data-lote-ok]').disabled,
          caixasOutros: outros.every(d => [...d.querySelectorAll('input.fa-chk')].every(c => c.disabled)),
        };
    }''', GRUPO_RECAD)
    checa(trav['busca'] and trav['filtros'] and trav['foco'], 'extra. durante o lote: busca, filtros e faixa de foco travados')
    checa(trav['vizinho'] and trav['caixasOutros'], 'extra. durante o lote: "Concluir" da mesma barra e as caixas dos outros grupos travados')
    p.wait_for_selector(f'details.fa-grupo[data-titulo="{GRUPO_RECAD}"] [data-lote-and]:has-text("Registrando 2 de 2")')
    checa(True, 'extra. progresso "Registrando 1 de 2…" e "Registrando 2 de 2…" na barra')
    p.wait_for_selector('.fa-lote-resumo:has-text("Andamento registrado")')
    checa(not p.evaluate('() => window.__reabriu'), 'extra. o botão vizinho só volta depois da recarga (não dá pra abrir outro lote no meio)')
    checa(not p.locator('#searchInput').is_disabled(), 'extra. no fim, a busca volta a funcionar')
    p.evaluate('() => { window.__mockDelay = 0; }')

    # "já estava concluída": outra pessoa conclui uma das marcadas entre abrir a janela e confirmar
    g = grupo(p, GRUPO_RECAD)
    ids = marcar(g, 2)
    h0 = historico(p)
    g.locator('[data-lote-ok]').click()
    p.fill('#loteObs', 'Recadastramento feito.')
    p.evaluate('([id, quem]) => Object.assign(window.__mockDb.tarefas.find(t => t.id === id), { status: "concluida", concluida_por: quem, concluida_em: new Date().toISOString() })', [ids[1], OUTRA])
    resumo = confirmar_e_esperar(p, 'já estava')
    checa('1 tarefa concluída.' in resumo and '1 já estava concluída por outra pessoa' in resumo, f'extra. resumo "{resumo}"')
    st = estado(p, ids)
    checa(st[ids[1]]['concluida_por'] == OUTRA, 'extra. a conclusão da outra pessoa não foi sobrescrita (concluida_por intacto)')
    novos = historico(p)[len(h0):]
    checa([h['tarefa_id'] for h in novos] == [ids[0]] and novos[0]['descricao'] == 'Tarefa concluída. Recadastramento feito.', 'extra. histórico só na que este lote concluiu')

def societario(p, base):
    print(f'\n[escuro] societario-tarefas.html — grupo "{GRUPO_SOC}" (item "processo")')
    abrir_tela(p, base, 'societario-tarefas.html')
    g = grupo(p, GRUPO_SOC)
    marcar(g, 2)
    checa(g.locator('[data-lote-ok]').inner_text().strip() == 'Concluir 2 processos', 'extra. barra: "Concluir 2 processos"')
    g.locator('[data-lote-and]').click()
    j = janela(p)
    checa(j['titulo'] == 'Registrar andamento em 2 processos' and j['rotulo'] == 'O que aconteceu — vai pro histórico de cada um', f'extra. janela: "{j["titulo"]}" / "{j["rotulo"]}"')
    h0 = historico(p)
    p.fill('#loteObs', 'Protocolado na Junta.')
    resumo = confirmar_e_esperar(p, 'Andamento registrado')
    checa(resumo == '✓ Andamento registrado em 2 processos.', f'extra. resumo "{resumo}"')
    novos = historico(p)[len(h0):]
    checa(len(novos) == 2 and all(h['descricao'] == 'Protocolado na Junta. (registrado em lote, 2 processos)' for h in novos), 'extra. histórico: "... (registrado em lote, 2 processos)"')
    g = grupo(p, GRUPO_SOC)
    marcar(g, 2)
    g.locator('[data-lote-ok]').click()
    p.fill('#loteObs', 'Registro deferido.')
    h0 = historico(p)
    resumo = confirmar_e_esperar(p, 'concluídos')
    # os 2 eram o grupo inteiro: concluídos, o grupo sai do filtro "A fazer" e o resumo vai pra cima da lista com o nome do grupo
    checa(resumo == GRUPO_SOC + ' — ✓ 2 processos concluídos.', f'extra. resumo "{resumo}"')
    novos = historico(p)[len(h0):]
    checa(len(novos) == 2 and all(h['descricao'] == 'Processo concluído. Registro deferido.' for h in novos), 'extra. histórico: "Processo concluído. Registro deferido."')

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros, dialogos = [], []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            for tema in ('escuro', 'claro'):
                p = b.new_page(viewport={'width': 1600, 'height': 900})
                p.set_default_timeout(8000)
                p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
                p.on('dialog', lambda d, t=tema: (dialogos.append(f'{t}: {d.type} "{d.message}"'), d.dismiss()))
                p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
                p.goto(base + 'index.html')
                p.evaluate(f"() => localStorage.setItem('mr_tema', '{tema}')")
                cenario(f'[{tema}] itens 1-5', fiscal_itens, p, base, tema)
                cenario(f'[{tema}] cuidados', fiscal_cuidados, p, base, tema)
                if tema == 'escuro': cenario('[escuro] societário', societario, p, base)
                p.close()
            b.close()
    finally:
        srv.shutdown()
        print()
        checa(not dialogos, 'nenhuma janela do navegador (alert/confirm) apareceu' + ('' if not dialogos else ': ' + '; '.join(dialogos)))
        print('\nErros de JavaScript:', 'nenhum' if not erros else '')
        for e in erros: print('  ', e)
        print('Fotos: ' + ', '.join(sorted(str(f.relative_to(RAIZ)) for f in FOTOS.glob('lote-*.png'))))
        print(f'\nResultado: {"TUDO OK" if not falhas and not erros else str(len(falhas)) + " falha(s)" + (" e erros de JavaScript" if erros else "")}')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
