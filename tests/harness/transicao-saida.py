"""
A saída na Transição e a cor de cada tipo (12/11/2026, pedido do Samuel: "quando for uma SAÍDA, categorias não fazem muito
sentido, acho que tem que ficar um diferencial de cores nessa tela também") — sem login e sem banco (o mock do
conferir.py, com as transições semeadas só neste teste; nomes inventados).

    python tests/harness/transicao-saida.py

Confere:
  1. a lista em seções: "Saindo" primeiro, só com a saída; "Chegando" com a entrada e o CNPJ novo, a mais urgente
     primeiro; as concluídas recolhidas no fim; cada cartão com a classe e o chip do tipo; a saída diz "aviso até dd/mm ·
     faltam N dias"; a entrada atrasada diz quanto passou, em alerta; e o Enter abre o cartão;
  2. a cor de cada tipo é outra (a borda do cartão), no tema escuro e no claro;
  3. a ficha da saída: as três etapas no lugar dos setores, cada tarefa na etapa certa (pela fase ou pelo título), com o
     setor no cartão; o alto diz "Faltam N dias" e o fim do aviso; o contato vira "documentos pra";
  4. Encerrar no escritório: as sete linhas, as ligadas marcadas, quantas na etapa, o link de cada tela (aba nova); a
     lista que não deu pra ler sai "não conferi" (nunca "nada ligado"); o que já está desligado, numa linha só;
  5. o "+ tarefa" de uma etapa cria a tarefa com a fase dela e o setor padrão; a janela da tarefa troca o setor (a
     tarefa vai junto) e sugere as fases da saída;
  6. o Editar da saída: "Início do aviso", "Fim do aviso" (grava a previsão) e "Quem recebe os documentos"; o fim antes
     do início não grava;
  7. a nova saída: os rótulos mudam com o tipo; a previsão nasce 30 dias depois do início; as tarefas do kit nascem com
     a fase da etapa;
  8. Concluir a saída: o botão diz "Concluir a saída"; a pergunta diz o que ainda está ligado; o cadastro não muda; a
     mensagem é "Saída concluída";
  9. a entrada segue com os setores, "Dia X" e "de 90", e a previsão de conclusão;
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

KIT_SAIDA = [
    {'id': 'ks1', 'tipo': 'saida', 'setor': 'societario', 'titulo': 'Distrato de prestação de serviços', 'responsavel_padrao': 'Samuel', 'prazo_dias': 5,
     'fase': 'Fechamento e boas-vindas', 'ordem': 13, 'ativo': True, 'so_com_funcionarios': False, 'agrupar_em': None},
    {'id': 'ks2', 'tipo': 'saida', 'setor': 'contabil', 'titulo': 'Balanço — enviar', 'responsavel_padrao': 'Adaini', 'prazo_dias': 7,
     'fase': 'Documentos e escritório anterior', 'ordem': 21, 'ativo': True, 'so_com_funcionarios': False, 'agrupar_em': None},
]
SEMEAR = """
(() => {
  const KIT = %s;
  const add = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
  window.__add = add;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const TR = (id, titulo, tipo, ini, fim, o = {}) => ({ id, titulo, tipo, inicio: add(ini), previsao_fim: fim == null ? null : add(fim), tera_funcionarios: null, contato: null,
      observacao: null, padrinho: null, proposta_id: null, status: 'em_andamento', concluida_em: null, criado_em: add(ini) + 'T12:00:00Z', transicao_empresas: [], ...o });
    v.transicoes = [
      TR('te2', 'ENTRADA NO PRAZO LTDA', 'entrada', -43, 47),
      TR('ts1', 'CLIENTE QUE SAI LTDA', 'saida', -11, 19, { tera_funcionarios: true, contato: 'contato@novoescritorio.test', transicao_empresas: [{ cliente_id: 'c1' }, { cliente_id: 'c2' }] }),
      TR('tc1', 'CNPJ NOVO DE TESTE', 'cnpj_novo', -72, 18),
      TR('te1', 'ENTRADA ATRASADA LTDA', 'entrada', -107, -17, { transicao_empresas: [{ cliente_id: 'c2' }] }),
      TR('tz1', 'CONCLUÍDA DE TESTE', 'entrada', -100, -10, { status: 'concluida', concluida_em: add(-5) + 'T12:00:00Z' }),
    ];
    v.transicao_empresas = [
      { transicao_id: 'ts1', cliente_id: 'c1', clientes: { nome_principal: 'COMÉRCIO MODELO ME', cidade: 'Três Coroas' } },
      { transicao_id: 'ts1', cliente_id: 'c2', clientes: { nome_principal: 'EMPRESA EXEMPLO LTDA', cidade: 'Igrejinha' } },
      { transicao_id: 'te1', cliente_id: 'c2', clientes: { nome_principal: 'EMPRESA EXEMPLO LTDA', cidade: 'Igrejinha' } },
    ];
    const X = (id, transicao_id, setor, titulo, fase, resp, prazo, o = {}) => ({ id, transicao_id, setor, titulo, fase, responsavel: resp, status: 'pendente', prazo: add(prazo),
      cliente_id: null, origem: 'transicao', tipo: 'tarefa', prioridade: 'media', posicao: 0, hora: null, proposta_id: null, concluida_em: null, concluida_por: null, ...o });
    v.tarefas.push(
      X('tt1', 'ts1', 'societario', 'Distrato de prestação de serviços', 'Primeiras entregas', 'Samuel', 1),
      X('tt2', 'ts1', 'contabil', 'Balancete — enviar', 'Documentos e escritório anterior', 'Adaini', 0),
      X('tt3', 'ts1', 'dp', 'Documentos e acessos pro novo escritório', 'Documentos e escritório anterior', 'Vitória', 0,
        { descricao: 'Marque cada item quando estiver resolvido.\\n☑ Extrato mensal da folha — enviar\\n☐ Todas as GFIPs — enviar' }),
      X('tt4', 'ts1', 'financeiro', 'Encerrar o contrato no Conta Azul', null, 'Samuel', 20),
      X('tt5', null, 'fiscal', 'DCTFWEB DE TESTE DEPOIS DO AVISO', null, 'Thalia', 30, { cliente_id: 'c1', origem: 'obrigacao' }),
      X('tt6', 'te1', 'fiscal', 'Cadastro no Domínio', 'Cadastros e sistemas', 'Thalia', -20),
    );
    v.carteira_info.push({ cliente_id: 'c1', entrada: '2022-03-03', saida: null, motivo_saida: null });
    v.cobrancas_config = [{ cliente_id: 'c1', ativo: true, valor_base: 1007.25 }, { cliente_id: 'c2', ativo: false, valor_base: 450.5 }];
    v.alvaras.push({ id: 'al1', cliente_id: 'c2', tipo: 'Alvará de Funcionamento', numero: '123', vencimento: add(120), status: 'vigente' });
    v.certificados_digitais = [{ id: 'cd1', cliente_id: 'c1', titular: 'COMÉRCIO MODELO ME', acompanhar: true, validade: add(200) }];
    v.transicao_kit = KIT;
  } });
})();
""" % json.dumps(KIT_SAIDA, ensure_ascii=False)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def banco(p, tabela):
    return p.evaluate(f"() => JSON.parse(JSON.stringify(window.__mockDb['{tabela}'] || []))")
def add(p, n):
    return p.evaluate(f'() => window.__add({n})')
def br(ymd):
    return ymd[8:10] + '/' + ymd[5:7] + '/' + ymd[0:4]

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros, dialogos, resposta = [], [], {'aceitar': True}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 1400, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        def ao_dialogo(d):
            dialogos.append(d.message)
            d.accept() if resposta['aceitar'] else d.dismiss()
        p.on('dialog', ao_dialogo)
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)

        print('1. A lista em seções')
        p.goto(base + 'comercial-transicao.html')
        p.wait_for_selector('#lista .tr-card', timeout=8000)
        secoes = p.eval_on_selector_all('#lista .tr-secao b', 'els => els.map(e => e.textContent.replace(/^› /, ""))')
        ok(secoes == ['Saindo', 'Chegando', 'Concluídas'], f'1. as seções na ordem ({secoes})')
        saindo = p.eval_on_selector_all('[data-secao="saindo"] .tr-card', 'els => els.map(e => e.dataset.id)')
        chegando = p.eval_on_selector_all('[data-secao="chegando"] .tr-card', 'els => els.map(e => e.dataset.id)')
        ok(saindo == ['ts1'] and chegando == ['te1', 'tc1', 'te2'], f'1. saindo só a saída; chegando, a mais urgente primeiro ({saindo}, {chegando})')
        ok(not p.is_visible('.tr-secao-conc .tr-card') and p.locator('.tr-secao-conc .tr-card').count() == 1, '1. as concluídas recolhidas no fim')
        cs = p.locator('.tr-card[data-id="ts1"]')
        fim = add(p, 19)
        ok('tipo-saida' in cs.get_attribute('class') and cs.locator('.tr-chip.tipo').inner_text() == 'Saída'
           and f'aviso até {br(fim)[:5]} · faltam 19 dias' in cs.inner_text(), f'1. a saída: a classe, o chip e o aviso ({cs.inner_text()!r})')
        ca = p.locator('.tr-card[data-id="te1"]')
        ok('dia 108 de 90 · 17 dias além da previsão' in ca.inner_text() and ca.locator('.tr-prazo.alerta').count() == 1, f'1. a entrada atrasada: quanto passou, em alerta ({ca.inner_text()!r})')
        ok('dia 44 de 90' in p.locator('.tr-card[data-id="te2"]').inner_text() and p.locator('.tr-card[data-id="te2"] .tr-prazo.alerta').count() == 0, '1. a entrada no prazo, sem alerta')
        ok('tipo-cnpj_novo' in p.locator('.tr-card[data-id="tc1"]').get_attribute('class'), '1. o CNPJ novo com a classe dele')

        print('2. Uma cor por tipo')
        def bordas():
            return p.evaluate("""() => Object.fromEntries(['te2', 'tc1', 'ts1'].map(id => [id, getComputedStyle(document.querySelector('.tr-card[data-id="' + id + '"]')).borderLeftColor]))""")
        escuro = bordas()
        ok(len(set(escuro.values())) == 3, f'2. três cores, no tema escuro ({escuro})')
        p.evaluate("() => document.documentElement.setAttribute('data-theme', 'light')")
        p.wait_for_timeout(400)   # a borda do cartão tem transição de 0,15 s
        claro = bordas()
        ok(len(set(claro.values())) == 3 and claro['ts1'] != escuro['ts1'], f'2. três cores no claro, e a da saída muda com o tema ({claro})')
        p.evaluate("() => document.documentElement.removeAttribute('data-theme')")

        print('3. A ficha da saída')
        cs.focus(); p.keyboard.press('Enter'); p.wait_for_timeout(900)
        ok(p.is_visible('#painelDetalhe') and 'tipo-saida' in (p.get_attribute('#painelDetalhe', 'class') or ''), '3. o Enter abre a ficha, na cor da saída')
        etapas = p.eval_on_selector_all('#raias .raia', 'els => els.map(e => e.dataset.etapa)')
        ok(etapas == ['formalizar', 'entregar', 'encerrar'], f'3. as três etapas no lugar dos setores ({etapas})')
        def na(etapa):
            return p.eval_on_selector_all(f'#raias .raia[data-etapa="{etapa}"] .tcard', 'els => els.map(e => e.dataset.tid)')
        ok(na('formalizar') == ['tt1'] and sorted(na('entregar')) == ['tt2', 'tt3'] and na('encerrar') == ['tt4'],
           f'3. cada tarefa na etapa certa, pela fase ou pelo título ({na("formalizar")}, {na("entregar")}, {na("encerrar")})')
        ok('Contábil' in p.inner_text('.tcard[data-tid="tt2"]') and 'DP' in p.inner_text('.tcard[data-tid="tt3"]') and '☑ 1/2' in p.inner_text('.tcard[data-tid="tt3"]'),
           '3. o setor e a lista no cartão')
        ok(p.inner_text('#detDias').strip() == 'Faltam 19 dias' and p.inner_text('#detPrev') == f'pro fim do aviso, em {br(fim)}', f'3. o alto: {p.inner_text("#detDias")!r} / {p.inner_text("#detPrev")!r}')
        meta = p.inner_text('#detMeta')
        ok('aviso desde' in meta and 'com funcionários' in meta and 'documentos pra: contato@novoescritorio.test' in meta, f'3. o contato vira "documentos pra" ({meta!r})')
        ok(not p.is_visible('#btnPedirDocs'), '3. sem o "Pedir documentos" (é da entrada)')

        print('4. Encerrar no escritório')
        p.wait_for_selector('.enc-item', timeout=5000)
        linhas = p.eval_on_selector_all('.enc-item', 'els => els.map(e => [e.dataset.enc, e.className.includes("ligado") ? "ligado" : e.className.includes(" ok") ? "ok" : "duvida", e.innerText])')
        estado = {c: e for c, e, _ in linhas}
        ok([c for c, _, _ in linhas] == ['carteira', 'cobranca', 'obrigacoes', 'recorrentes', 'tarefas', 'alvaras', 'certificados'], f'4. as sete linhas ({[c for c, _, _ in linhas]})')
        ok(all(e == 'ligado' for e in estado.values()), f'4. tudo ligado nesta saída ({estado})')
        texto = {c: t for c, _, t in linhas}
        ok('Sem a data de saída na Carteira' in texto['carteira'] and 'R$ 1.007,25' in texto['cobranca'] and '450,50' not in texto['cobranca']
           and '3 obrigações ligadas' in texto['obrigacoes'] and 'DCTFWEB DE TESTE DEPOIS DO AVISO' in texto['tarefas']
           and 'Alvará de Funcionamento' in texto['alvaras'] and 'COMÉRCIO MODELO ME' in texto['certificados'], f'4. o que cada linha diz ({texto})')
        ok('7 coisas ligadas' in p.inner_text('.raia[data-etapa="encerrar"] .raia-rotulo'), '4. quantas ligadas, na etapa')
        links = p.eval_on_selector_all('.enc-item a', 'els => els.map(e => [e.getAttribute("href"), e.target])')
        ok(links[0] == ['comercial-carteira.html', '_blank'] and ['dp-tarefas.html?aba=recorrentes', '_blank'] in links and all(t == '_blank' for _, t in links), f'4. o link de cada tela, em aba nova ({links})')
        # a cobrança que não deu pra ler: "não conferi", nunca "nada ligado"
        p.evaluate("() => { window.__mockErroTabela = { cobrancas_config: 'sem acesso' }; }")
        p.click('#btnVoltar'); p.wait_for_timeout(500); p.click('.tr-card[data-id="ts1"]'); p.wait_for_selector('.enc-item', timeout=5000); p.wait_for_timeout(300)
        cob = p.locator('.enc-item[data-enc="cobranca"]')
        ok('duvida' in cob.get_attribute('class') and 'Não deu pra conferir' in cob.inner_text(), f'4. a cobrança que não deu pra ler: "não conferi" ({cob.inner_text()!r})')
        p.evaluate("() => { window.__mockErroTabela = null; }")
        # o que já está desligado vai numa linha só
        p.evaluate("() => { window.__mockDb.alvaras = []; window.__mockDb.certificados_digitais = []; }")
        p.click('#btnVoltar'); p.wait_for_timeout(500); p.click('.tr-card[data-id="ts1"]'); p.wait_for_selector('.enc-item', timeout=5000); p.wait_for_timeout(300)
        abertas = p.eval_on_selector_all('.enc-item:not(.ok)', 'els => els.map(e => e.dataset.enc)')
        desl = p.inner_text('.enc-item[data-enc="desligado"]') if p.locator('.enc-item[data-enc="desligado"]').count() else ''
        ok(abertas == ['carteira', 'cobranca', 'obrigacoes', 'recorrentes', 'tarefas'] and 'Já desligado. Alvarás e Certificados digitais.' in desl
           and '5 coisas ligadas' in p.inner_text('.raia[data-etapa="encerrar"] .raia-rotulo'), f'4. o que já está desligado, numa linha só ({abertas}, {desl!r})')
        ok(p.get_attribute('.enc-item[data-enc="desligado"] span[title]', 'title') == 'Nenhum alvará no controle.', '4. e o texto de cada um no título')

        print('5. O "+ tarefa" de uma etapa e a janela da tarefa')
        antes = len(banco(p, 'tarefas'))
        p.click('.raia[data-etapa="encerrar"] [data-add]'); p.wait_for_timeout(700)
        nova = [t for t in banco(p, 'tarefas') if t.get('transicao_id') == 'ts1' and t.get('titulo') == 'Nova tarefa']
        ok(len(banco(p, 'tarefas')) == antes + 1 and len(nova) == 1 and nova[0]['fase'] == 'Encerrar no escritório' and nova[0]['setor'] == 'financeiro',
           f'5. nasce com a fase da etapa e o setor padrão ({nova})')
        ok(p.is_visible('#ovTarefa') and p.get_attribute('#edFase', 'list') == 'dlFasesSaida' and p.input_value('#edSetor') == 'financeiro', '5. a janela abre com as fases da saída e o setor')
        p.fill('#edTitulo', 'Desligar as obrigações fiscais'); p.select_option('#edSetor', 'fiscal'); p.fill('#edResp', 'Thalia')
        p.click('#edSalvar'); p.wait_for_timeout(600)
        gravada = next(t for t in banco(p, 'tarefas') if t['id'] == nova[0]['id'])
        ok(gravada['setor'] == 'fiscal' and gravada['titulo'] == 'Desligar as obrigações fiscais' and gravada['id'] in na('encerrar') and 'Fiscal' in p.inner_text(f'.tcard[data-tid="{gravada["id"]}"]'),
           '5. trocar o setor grava, e a tarefa segue na etapa, com o setor novo no cartão')

        print('6. O Editar da saída')
        p.click('#btnEditar'); p.wait_for_timeout(300)
        ok(p.inner_text('#edtInicioRot') == 'Início do aviso' and p.inner_text('#edtFimRot') == 'Fim do aviso' and p.input_value('#edtFim') == fim
           and p.inner_text('#edtContatoRot').startswith('Quem recebe os documentos'), '6. os rótulos da saída e o fim do aviso preenchido')
        p.fill('#edtFim', add(p, -30)); dialogos.clear(); p.click('#edtSalvar'); p.wait_for_timeout(400)
        tr = next(t for t in banco(p, 'transicoes') if t['id'] == 'ts1')
        ok(tr['previsao_fim'] == fim and any('não pode vir antes do início' in d for d in dialogos) and p.is_visible('#ovEditar'), f'6. o fim antes do início não grava ({dialogos})')
        novo_fim = add(p, 25)
        p.fill('#edtFim', novo_fim); p.click('#edtSalvar'); p.wait_for_timeout(1000)
        tr = next(t for t in banco(p, 'transicoes') if t['id'] == 'ts1')
        ok(tr['previsao_fim'] == novo_fim and p.inner_text('#detDias').strip() == 'Faltam 25 dias', f'6. o fim do aviso grava e o alto acompanha ({tr["previsao_fim"]}, {p.inner_text("#detDias")!r})')

        print('7. A nova saída')
        p.click('#btnVoltar'); p.wait_for_timeout(500)
        p.click('#btnNova'); p.wait_for_timeout(300)
        ok(p.inner_text('#nvInicioRot') == 'Início' and p.inner_text('#nvContatoRot') == 'Contato', '7. abre como entrada')
        p.select_option('#nvTipo', 'saida')
        ok(p.inner_text('#nvInicioRot').startswith('Início do aviso') and p.inner_text('#nvContatoRot').startswith('Quem recebe os documentos') and '30 dias depois' in p.inner_text('#nvDica'),
           '7. os rótulos mudam com o tipo')
        p.select_option('#nvTipo', 'entrada')
        ok(p.inner_text('#nvContatoRot') == 'Contato' and '30 dias' not in p.inner_text('#nvDica'), '7. e voltam')
        p.select_option('#nvTipo', 'saida'); p.fill('#nvTitulo', 'OUTRA QUE SAI LTDA'); p.fill('#nvInicio', add(p, 0)); p.select_option('#nvFunc', 'false')
        p.click('#nvCriar'); p.wait_for_timeout(1200)
        tr = next((t for t in banco(p, 'transicoes') if t.get('titulo') == 'OUTRA QUE SAI LTDA'), {})
        ok(tr.get('previsao_fim') == add(p, 30), f'7. a previsão nasce 30 dias depois do início ({tr.get("previsao_fim")})')
        kit = {t['titulo']: t.get('fase') for t in banco(p, 'tarefas') if t.get('transicao_id') == tr.get('id')}
        ok(kit == {'Distrato de prestação de serviços': 'Formalizar a saída', 'Balanço — enviar': 'Entregar ao novo escritório'}, f'7. as tarefas do kit com a fase da etapa ({kit})')
        ok(p.inner_text('#detDias').strip() == 'Faltam 30 dias', f'7. a ficha nova: {p.inner_text("#detDias")!r}')

        print('8. Concluir a saída')
        p.click('#btnVoltar'); p.wait_for_timeout(500); p.click('.tr-card[data-id="ts1"]'); p.wait_for_selector('.enc-item', timeout=5000); p.wait_for_timeout(300)
        ok(p.inner_text('#btnConcluir') == '🏁 Concluir a saída', f'8. o botão diz "Concluir a saída" ({p.inner_text("#btnConcluir")!r})')
        cadastro_antes = banco(p, 'clientes')
        dialogos.clear(); resposta['aceitar'] = False
        p.click('#btnConcluir'); p.wait_for_timeout(400)
        ok(dialogos and dialogos[0].startswith('Concluir esta saída?') and 'Ainda está ligado no escritório: carteira e cadastro, cobrança' in dialogos[0]
           and next(t for t in banco(p, 'transicoes') if t['id'] == 'ts1')['status'] == 'em_andamento', f'8. a pergunta diz o que está ligado, e Cancelar não conclui ({dialogos[:1]})')
        resposta['aceitar'] = True; dialogos.clear()
        p.click('#btnConcluir'); p.wait_for_timeout(900)
        ok(next(t for t in banco(p, 'transicoes') if t['id'] == 'ts1')['status'] == 'concluida' and banco(p, 'clientes') == cadastro_antes
           and p.inner_text('#detMsg') == '🏁 Saída concluída.' and len(dialogos) == 1, f'8. conclui sem mexer no cadastro nem perguntar a data da carteira ({p.inner_text("#detMsg")!r}, {dialogos})')

        print('9. A entrada segue como era')
        p.click('#btnVoltar'); p.wait_for_timeout(500); p.click('.tr-card[data-id="te1"]'); p.wait_for_timeout(900)
        raias = p.eval_on_selector_all('#raias .raia-rotulo b', 'els => els.map(e => e.textContent)')
        ok(raias == ['Societário', 'Fiscal', 'DP', 'Contábil', 'Comercial'] and p.locator('.enc').count() == 0, f'9. os setores, sem o quadro da saída ({raias})')
        ok(p.inner_text('#btnConcluir') == '🏁 Concluir transição', '9. o botão da entrada segue "Concluir transição"')
        ok(p.inner_text('#detDias').startswith('Dia 108') and 'de 90' in p.inner_text('#detDias') and p.inner_text('#detPrev').startswith('a previsão era')
           and 'alerta' in (p.get_attribute('#detPrev', 'class') or '') and 'tipo-entrada' in p.get_attribute('#painelDetalhe', 'class'), f'9. "Dia 108 de 90" e a previsão que passou ({p.inner_text("#detDias")!r}, {p.inner_text("#detPrev")!r})')
        p.click('.tcard[data-tid="tt6"]'); p.wait_for_timeout(300)
        ok(p.get_attribute('#edFase', 'list') == 'dlFases' and p.input_value('#edSetor') == 'fiscal', '9. a janela da tarefa da entrada com as fases de sempre')
        p.click('#edCancelar')
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    total = falhas + len(erros)
    print('\n' + ('tudo certo' if not total else f'{total} falha(s)'))
    sys.exit(1 if total else 0)

if __name__ == '__main__':
    main()
