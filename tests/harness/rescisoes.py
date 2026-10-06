"""
Teste do módulo Rescisões do DP (dp-rescisoes.html) e do link que a empresa preenche (rescisao.html) — sem login e
sem banco (mesmo mock do conferir.py; dados inventados). O link é o mesmo pra todas as empresas, como nas admissões,
e só fala com o sistema pela Edge Function rescisao-link; aqui quem responde é o teste, por window.__mockInvoke.

    python tests/harness/rescisoes.py

Confere, nos temas escuro e claro (o link público é sempre claro):
  1. primeira abertura: os textos do formulário vão pro banco; a caixa do link mostra o endereço, copia e abre o
     WhatsApp com a mensagem e o link; lista vazia explica o que fazer;
  2. com rescisões no banco: contagem por situação, "venceu" no pagamento vencido, empresa que não bateu com o cadastro
     marcada "não vinculada", o caso na lista, respostas da empresa na ficha como texto (nunca HTML), datas da ficha
     pela mesma conta do link, caso mudado na ficha regrava as datas, vincular a empresa pela busca, situação mudada
     pela lista (concluída grava quando e quem);
  3. aba do formulário: perguntas fixas listadas, sem quem recebe não salva, textos e quem recebe gravados, prévia;
  4. agenda: a tarefa da rescisão leva pro módulo;
  5. link público: os "se" (pedido de demissão → cumpre o aviso ou imediato; demissão pela empresa → data e aviso;
     contrato de experiência → admissão, prazo e último dia, com o fim do período e a indenização do art. 479), as
     datas na hora (antecipando o 10º dia em domingo/feriado), prazo vencido avisado, obrigatórios barrados, envio só
     com o ramo respondido, mensagem final com a data do pagamento, "Enviar outra rescisão" mantendo a empresa;
     formulário indisponível e "muitos envios" avisados.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

hoje = datetime.date.today()
dia = lambda n: (hoje + datetime.timedelta(days=n)).isoformat()

def rescisoes_teste():
    cli1 = {'nome_principal': 'COMÉRCIO MODELO ME', 'nome_fantasia': None, 'documento': '00000000000000'}
    resp1 = [
        {'id': 'funcionario', 'rotulo': 'Nome completo do(a) funcionário(a)', 'valor': 'FULANA DE TESTE'},
        {'id': 'tipo', 'rotulo': 'É pedido de demissão do funcionário ou demissão por parte da empresa?', 'valor': 'Pedido de demissão do funcionário'},
        {'id': 'aviso', 'rotulo': 'Vai cumprir os 30 dias de aviso prévio ou quer fazer o desligamento imediato?', 'valor': 'Vai cumprir os 30 dias de aviso prévio'},
        {'id': 'data', 'rotulo': 'Quando foi o pedido de demissão?', 'tipo': 'data', 'valor': '2026-10-06'},
        {'id': 'obs', 'rotulo': 'Observações', 'valor': '<img src=x onerror="window.__xss=1">Vai trabalhar normalmente'},
    ]
    base = lambda **k: {'origem': 'externa', 'respostas': [], 'observacoes': None, 'concluida_em': None, 'concluida_por': None, 'data_admissao': None, 'prazo_experiencia': None, 'iniciativa': None,
                        'empresa_nome': None, 'contato_nome': None, 'clientes': None, 'desconta_aviso': None,
                        'criado_por': 'formulário da empresa', 'atualizado_em': None, **k}
    return [
        base(id='r1', cliente_id='c1', clientes=cli1, empresa_nome='Comércio Modelo', contato_nome='CONTATO DE TESTE', funcionario_nome='FULANA DE TESTE',
             tipo='pedido', aviso='trabalhado', data_base='2026-10-06', inicio_aviso='2026-10-07', ultimo_dia='2026-11-05', data_acerto='2026-11-13',
             responsavel='Vitória', status='recebida', respostas=resp1, criado_em=dia(-1) + 'T13:00:00Z'),
        base(id='r2', cliente_id=None, empresa_nome='PADARIA NOVA DE TESTE LTDA', contato_nome='OUTRO CONTATO', funcionario_nome='SICRANO DE TESTE',
             tipo='dispensa', aviso='indenizado', data_base=dia(-11), inicio_aviso=None, ultimo_dia=dia(-11), data_acerto=dia(-1),
             responsavel='Vitória', status='recebida', criado_em=dia(-12) + 'T12:00:00Z'),
        base(id='r3', cliente_id='c1', clientes=cli1, funcionario_nome='BELTRANO DE TESTE', tipo='dispensa', aviso='trabalhado', data_base=dia(-60),
             inicio_aviso=dia(-59), ultimo_dia=dia(-30), data_acerto=dia(-20), responsavel='Edna', status='concluida',
             concluida_em=dia(-21) + 'T15:00:00Z', concluida_por='rh@macedoereis.com.br', criado_em=dia(-61) + 'T12:00:00Z'),
        base(id='r4', cliente_id='c1', clientes=cli1, funcionario_nome='CICLANO DE TESTE', tipo='pedido', aviso='imediato', desconta_aviso=True,
             data_base=dia(-40), ultimo_dia=dia(-40), data_acerto=dia(-30), responsavel='Vitória', status='cancelada', criado_em=dia(-41) + 'T12:00:00Z'),
        base(id='r5', cliente_id='c1', clientes=cli1, funcionario_nome='MARIA EXPERIÊNCIA DE TESTE', tipo='experiencia', aviso=None,
             data_admissao='2026-09-01', prazo_experiencia='45+45', iniciativa='empresa', data_base='2026-10-15', inicio_aviso=None, ultimo_dia='2026-10-15', data_acerto=dia(30),
             responsavel='Vitória', status='em_andamento', criado_em=dia(-2) + 'T12:00:00Z'),
    ]

def armadilha(modelo, tarefas=False):
    extra = """v.tarefas.push({ id: 't900', titulo: 'Rescisão: FULANA DE TESTE — COMÉRCIO MODELO ME · pagar até 13/11', setor: 'dp', responsavel: 'Samuel',
      prazo: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(),
      status: 'pendente', prioridade: 'alta', cliente_id: 'c1', proposta_id: null, hora: null, transicao_id: null, posicao: 5, origem: 'rescisao',
      rescisao_id: 'r1', admissao_id: null, clientes: { nome_principal: 'COMÉRCIO MODELO ME', documento: '00000000000000' }, concluida_em: null, concluida_por: null });""" if tarefas else ''
    return """(() => {
  const RES = %s, MOD = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.rescisoes = RES; v.rescisao_modelos = [{ id: 'm1', conteudo: MOD, ativo: true, atualizado_em: '2026-10-06T12:00:00Z', atualizado_por: 'rh@macedoereis.com.br' }];
    %s
  } });
})();""" % (json.dumps(rescisoes_teste(), ensure_ascii=False), json.dumps(modelo, ensure_ascii=False), extra)

INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
INIT_ABRIR = "window.__abertos = []; window.open = (u) => { window.__abertos.push(String(u)); return null; };"

def db(p, expr):
    return p.evaluate('() => ' + expr)

def modulo(b, base, tema, erros):
    print(f'[{tema}] 1. primeira abertura e o link do formulário')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} módulo: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(INIT_ABRIR)
    p.goto(base + 'dp-rescisoes.html'); p.wait_for_timeout(1500)
    mods = db(p, 'window.__mockDb.rescisao_modelos')
    ok(len(mods) == 1 and mods[0]['ativo'] is True and mods[0]['conteudo']['titulo'].startswith('Informações para a rescisão'), '1. os textos do formulário foram gravados no banco')
    ok('Mande o link' in p.inner_text('#rsVazio'), '1. lista vazia explica o que fazer')
    url = p.input_value('#lkUrl')
    ok(url.endswith('/rescisao.html') and '?' not in url, '1. a caixa mostra o link único do formulário')
    ok('falta escolher quem recebe' in p.inner_text('#lkResp'), '1. avisa que falta escolher quem recebe na agenda')
    p.click('#lkCopiar'); p.wait_for_timeout(200)
    ok('Link copiado' in p.inner_text('#lkMsg'), '1. copiar o link')
    p.click('#lkZap'); p.wait_for_timeout(200)
    ab = db(p, 'window.__abertos')
    ok(len(ab) == 1 and ab[0].startswith('https://wa.me/?text=') and 'rescisao.html' in ab[0] and '%7Blink%7D' not in ab[0], '1. WhatsApp abre com a mensagem e o link')
    ok(p.get_attribute('#lkAbrir', 'href') == 'rescisao.html', '1. "Abrir o formulário" leva ao link')
    modelo = mods[0]['conteudo']
    p.close()

    print(f'[{tema}] 2. rescisões no banco: lista, ficha, datas, vínculo e situação')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} módulo 2: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(armadilha({**modelo, 'responsavel': 'Vitória'}))
    p.goto(base + 'dp-rescisoes.html'); p.wait_for_timeout(1500)
    ok(len(db(p, 'window.__mockDb.rescisao_modelos')) == 1, '2. com textos no banco, não grava outros')
    ok('Vitória' in p.inner_text('#lkResp'), '2. a caixa do link diz de quem é a agenda')
    cont = [p.inner_text(s) for s in ('#fAbe', '#fRec', '#fAnd', '#fCon', '#fCan', '#fTod')]
    ok(cont == ['3', '2', '1', '1', '1', '5'], f'2. contagem por situação {cont}')
    ok(p.locator('#rsLista tr').count() == 3, '2. "Abertas" mostra só as três abertas')
    ok(p.locator('#rsLista tr').first.get_attribute('data-id') == 'r2', '2. a de pagamento mais perto vem primeiro')
    l2 = p.locator('#rsLista tr[data-id="r2"]').inner_text()
    ok('venceu' in l2 and 'PADARIA NOVA DE TESTE LTDA' in l2 and 'não vinculada' in l2 and 'aviso indenizado' in l2,
       '2. pagamento vencido "venceu"; empresa fora do cadastro "não vinculada"; o caso na lista')
    l1 = p.locator('#rsLista tr[data-id="r1"]').inner_text()
    ok('13/11/2026' in l1 and 'Pedido de demissão · cumpre o aviso' in l1, '2. data do pagamento e caso da r1')
    ok('Contrato de experiência · 45 + 45 dias' in p.locator('#rsLista tr[data-id="r5"]').inner_text(), '2. contrato de experiência na lista, com o prazo')
    p.screenshot(path=str(FOTOS / f'rescisoes-lista-{tema}.png'))

    p.click('#rsLista tr[data-id="r1"] td >> nth=0'); p.wait_for_timeout(500)
    txt = p.inner_text('#fiRespostas')
    ok('Quando foi o pedido de demissão?' in txt and '06/10/2026' in txt, '2. ficha mostra as respostas da empresa (data em dd/mm/aaaa)')
    ok('<img src=x' in txt and p.evaluate('() => window.__xss === undefined') and p.locator('#fiRespostas img').count() == 0, '2. o que a empresa digitou sai como texto (sem HTML injetado)')
    ok('CONTATO DE TESTE' in p.inner_text('#fiEnvio') and 'COMÉRCIO MODELO ME' in p.inner_text('#fiVinc'), '2. quem enviou e a empresa vinculada')
    dt = p.inner_text('#fiDatas')
    ok('07/10/2026' in dt and '05/11/2026' in dt and '13/11/2026' in dt and '15/11/2026' in dt, '2. datas da ficha: aviso 07/10 a 05/11, pagamento 13/11 (15/11 é domingo e feriado)')
    ok(p.input_value('#fiTipo') == 'pedido' and p.input_value('#fiAviso') == 'trabalhado' and p.input_value('#fiData') == '2026-10-06'
       and not p.is_visible('#fiDescWrap') and 'pedido' in p.inner_text('#fiDataRot').lower(), '2. caso preenchido na ficha (desconto escondido)')
    p.screenshot(path=str(FOTOS / f'rescisoes-ficha-{tema}.png'), full_page=True)
    p.select_option('#fiAviso', 'imediato'); p.wait_for_timeout(100)
    ok(p.is_visible('#fiDescWrap') and 'Último dia' in p.inner_text('#fiDataRot'), '2. desligamento imediato pede o desconto e o último dia')
    p.click('#fiSalvar'); p.wait_for_timeout(300)
    ok('desconta' in p.inner_text('#fiMsg') and db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r1').aviso") == 'trabalhado', '2. sem dizer o desconto não salva')
    p.select_option('#fiDesc', 'nao'); p.fill('#fiData', '2026-10-07'); p.wait_for_timeout(100)
    ok('16/10/2026' in p.inner_text('#fiDatas') and '17/10/2026' in p.inner_text('#fiDatas'), '2. datas refeitas na hora (10º dia no sábado 17/10 → 16/10)')
    p.click('#fiSalvar'); p.wait_for_timeout(400)
    r1 = db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r1')")
    ok(r1['aviso'] == 'imediato' and r1['desconta_aviso'] is False and r1['data_base'] == '2026-10-07' and r1['inicio_aviso'] is None
       and r1['ultimo_dia'] == '2026-10-07' and r1['data_acerto'] == '2026-10-16', '2. caso e datas regravados')
    ok(not p.is_visible('#ovFicha') and '16/10/2026' in p.locator('#rsLista tr[data-id="r1"]').inner_text(), '2. ficha fecha e a lista mostra a nova data')

    p.click('#rsLista tr[data-id="r2"] td >> nth=0'); p.wait_for_timeout(500)
    ok('Não encontrada no cadastro' in p.inner_text('#fiVinc') and 'PADARIA NOVA DE TESTE LTDA' in p.inner_text('#fiVinc'), '2. ficha avisa que a empresa não está vinculada')
    ok('Projeção do aviso' in p.inner_text('#fiDatas') and 'não a data' in p.inner_text('#fiDatas'), '2. indenizado: projeção do aviso e a nota do proporcional')
    p.fill('#fiBusca', 'EXEMPLO'); p.wait_for_timeout(600)
    p.locator('#fiRes button', has_text='EMPRESA EXEMPLO LTDA').click(); p.wait_for_timeout(200)
    ok('EMPRESA EXEMPLO LTDA' in p.inner_text('#fiVinc') and 'salve' in p.inner_text('#fiVinc'), '2. empresa escolhida na busca (falta salvar)')
    p.click('#fiSalvar'); p.wait_for_timeout(500)
    ok(db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r2').cliente_id") == 'c2', '2. vínculo gravado')
    l2 = p.locator('#rsLista tr[data-id="r2"]').inner_text()
    ok('EMPRESA EXEMPLO LTDA' in l2 and 'não vinculada' not in l2, '2. a lista mostra a empresa do cadastro')

    p.click('#rsLista tr[data-id="r5"] td >> nth=0'); p.wait_for_timeout(500)
    ok(p.is_visible('#fiAdmWrap') and p.is_visible('#fiPrazoWrap') and p.is_visible('#fiIniWrap') and not p.is_visible('#fiAvisoWrap') and not p.is_visible('#fiDescWrap')
       and p.input_value('#fiAdm') == '2026-09-01' and p.input_value('#fiPrazo') == '45+45' and p.input_value('#fiIni') == 'empresa' and 'Último dia' in p.inner_text('#fiDataRot'),
       '2. experiência: ficha com quem encerra, admissão e prazo (sem aviso nem desconto)')
    dt = p.inner_text('#fiDatas')
    ok('Fim do 1º período (45 dias)' in dt and '15/10/2026' in dt and '29/11/2026' in dt and '45º dia de contrato' in dt and '23/10/2026' in dt
       and 'último dia do 1º período' in dt, '2. experiência: fim do 1º período e da prorrogação; 15/10 é o fim do 1º período; pagar até 23/10')
    p.select_option('#fiPrazo', '30+60'); p.wait_for_timeout(100)
    dt = p.inner_text('#fiDatas')
    ok('30/09/2026' in dt and '45 dias que faltariam' in dt and 'art. 479' in dt and '40% do FGTS' in dt, '2. trocando o prazo pra 30+60: 15/10 fica antes do fim (faltam 45 dias)')
    p.fill('#fiData', '2026-08-20'); p.wait_for_timeout(100)
    ok('depois da admissão' in p.inner_text('#fiDatas'), '2. último dia antes da admissão: pede pra completar o caso')
    p.fill('#fiData', '2026-10-15'); p.wait_for_timeout(100)
    p.click('#fiSalvar'); p.wait_for_timeout(400)
    r5 = db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r5')")
    ok(r5['prazo_experiencia'] == '30+60' and r5['data_admissao'] == '2026-09-01' and r5['aviso'] is None and r5['data_base'] == '2026-10-15'
       and r5['ultimo_dia'] == '2026-10-15' and r5['data_acerto'] == '2026-10-23', '2. experiência regravada (prazo, admissão e datas)')
    ok('Contrato de experiência · 30 + 60 dias' in p.locator('#rsLista tr[data-id="r5"]').inner_text(), '2. a lista mostra o prazo novo')
    p.click('#rsLista tr[data-id="r5"] td >> nth=0'); p.wait_for_timeout(500)
    p.select_option('#fiIni', 'empregado'); p.wait_for_timeout(100)
    dt = p.inner_text('#fiDatas')
    ok(p.is_visible('#fiDescWrap') and 'art. 480' in p.inner_text('#fiDescRot') and 'art. 480' in dt and 'Não há multa de 40%' in dt,
       '2. a pedido do funcionário, antes do fim: pede o desconto do art. 480 e explica (sem 40% do FGTS)')
    p.click('#fiSalvar'); p.wait_for_timeout(300)
    ok('art. 480' in p.inner_text('#fiMsg') and db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r5').iniciativa") == 'empresa', '2. sem dizer o desconto do art. 480 não salva')
    p.select_option('#fiDesc', 'nao'); p.click('#fiSalvar'); p.wait_for_timeout(400)
    r5 = db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r5')")
    ok(r5['iniciativa'] == 'empregado' and r5['desconta_aviso'] is False, '2. quem encerra e o desconto gravados')
    ok('a pedido do funcionário (sem desconto)' in p.locator('#rsLista tr[data-id="r5"]').inner_text(), '2. a lista mostra que foi a pedido do funcionário')

    p.select_option('#rsLista tr[data-id="r2"] select', 'em_andamento'); p.wait_for_timeout(400)
    ok(db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r2').status") == 'em_andamento' and p.inner_text('#fAnd') == '2', '2. situação mudada pela lista (em andamento)')
    p.select_option('#rsLista tr[data-id="r1"] select', 'concluida'); p.wait_for_timeout(400)
    r1 = db(p, "window.__mockDb.rescisoes.find(r => r.id === 'r1')")
    ok(r1['status'] == 'concluida' and r1.get('concluida_em') and r1.get('concluida_por') == 'financeiro@macedoereis.com.br', '2. concluída grava quando e quem')
    ok(p.locator('#rsLista tr[data-id="r1"]').count() == 0 and p.inner_text('#fCon') == '2', '2. concluída sai das abertas e entra em Concluídas')
    p.close()

    print(f'[{tema}] 3. textos do formulário e prévia')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} editor: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(armadilha(modelo))
    p.goto(base + 'dp-rescisoes.html'); p.wait_for_timeout(1500)
    p.click('.rs-aba[data-aba="form"]'); p.wait_for_timeout(300)
    perg = p.inner_text('#edPerguntas')
    ok('Se pedido de demissão' in perg and 'Se demissão por parte da empresa' in perg and 'Se contrato de experiência' in perg and '45 + 45 dias' in perg
       and 'Quando foi o pedido de demissão?' in perg and 'último dia de trabalho' in perg.lower(),
       '3. perguntas fixas listadas, com os "se"')
    p.fill('#edFinal', 'Recebido! O DP já vai preparar a rescisão.')
    ok('Alterações não salvas' in p.inner_text('#edSujo'), '3. avisa que há alteração não salva')
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('quem recebe' in d for d in dialogos) and db(p, 'window.__mockDb.rescisao_modelos[0].conteudo.final') != 'Recebido! O DP já vai preparar a rescisão.', '3. sem quem recebe na agenda não salva')
    p.select_option('#edResp', 'Vitória')
    p.screenshot(path=str(FOTOS / f'rescisoes-editor-{tema}.png'), full_page=True)
    p.click('#edSalvar'); p.wait_for_timeout(400)
    c = db(p, 'window.__mockDb.rescisao_modelos[0].conteudo')
    ok(c.get('final') == 'Recebido! O DP já vai preparar a rescisão.' and c.get('responsavel') == 'Vitória', '3. textos e quem recebe gravados')
    ok(db(p, 'window.__mockDb.rescisao_modelos[0].atualizado_por') == 'financeiro@macedoereis.com.br', '3. grava quem alterou')
    p.click('.rs-aba[data-aba="lista"]'); p.wait_for_timeout(200)
    ok('Vitória' in p.inner_text('#lkResp'), '3. a caixa do link já mostra quem recebe')
    p.click('.rs-aba[data-aba="form"]'); p.wait_for_timeout(200)
    with p.context.expect_page() as nova_aba:
        p.click('#edPrevia')
    pv = nova_aba.value
    pv.on('pageerror', lambda e: erros.append(f'{tema} prévia: {e}'))
    pv.wait_for_timeout(1500)
    ok(pv.locator('.previa').count() == 1 and 'Informações para a rescisão' in pv.inner_text('.cab h2') and pv.locator('#id_funcionario').count() == 1, '3. prévia abre o link no modo prévia')
    pv.click('#btnEnviar'); pv.wait_for_timeout(300)
    ok('Faltam' in pv.inner_text('#msgErro'), '3. na prévia os obrigatórios também são barrados')
    pv.close(); p.close()
    return {**modelo, 'final': 'Recebido! O DP já vai preparar a rescisão.', 'responsavel': 'Vitória'}

def agenda(b, base, modelo, erros):
    print('[escuro] 4. a tarefa da rescisão na agenda')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'agenda: {e}'))
    p.add_init_script(INIT_TEMA % 'escuro')
    p.add_init_script(armadilha(modelo, tarefas=True))
    p.goto(base + 'agenda.html'); p.wait_for_timeout(1800)
    card = p.locator('.ag-card[data-taskid="t900"]')
    ok(card.count() == 1, '4. a tarefa aparece na agenda do dia')
    if card.count():
        card.first.click(); p.wait_for_timeout(700)
        ok(p.is_visible('#dResWrap') and p.get_attribute('#dResLink', 'href') == 'dp-rescisoes.html?rescisao=r1' and not p.is_visible('#dAdmWrap'),
           '4. o detalhe leva pra rescisão no módulo')
    p.close()
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'deep-link: {e}'))
    p.add_init_script(INIT_TEMA % 'escuro')
    p.add_init_script(armadilha(modelo))
    p.goto(base + 'dp-rescisoes.html?rescisao=r1'); p.wait_for_timeout(1500)
    ok(p.is_visible('#ovFicha') and p.inner_text('#fiTitulo') == 'FULANA DE TESTE', '4. o link da agenda abre a ficha da rescisão')
    p.close()

def publico(b, base, modelo, erros):
    print('[link] 5. formulário que a empresa preenche')
    form = json.dumps({k: modelo[k] for k in ('titulo', 'introducao', 'final', 'rodape', 'email')}, ensure_ascii=False)
    def pagina(formulario, enviar='{ ok: true, id: "11111111-2222-4333-8444-555555555555", email: "rh@macedoereis.com.br", datas: { inicioAviso: null, ultimoDia: "2026-10-02", limite: "2026-10-09" } }'):
        p = b.new_page(viewport={'width': 420, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'link: {e}'))
        p.add_init_script("""window.__log = [];
window.__mockInvoke = async (nome, opts) => {
  const b = opts.body || {};
  window.__log.push([nome, JSON.parse(JSON.stringify(b))]);
  if (b.acao === 'formulario') return { data: %s, error: null };
  if (b.acao === 'enviar') return { data: %s, error: null };
  return { data: null, error: { message: 'ação ' + b.acao } };
};""" % (formulario, enviar))
        p.goto(base + 'rescisao.html'); p.wait_for_timeout(1200)
        return p
    envios = lambda p: [x for x in p.evaluate('() => window.__log') if x[1].get('acao') == 'enviar']
    vis = lambda p, sel: p.is_visible(sel)

    p = pagina(form)
    ok(p.inner_text('.cab h2') == modelo['titulo'] and modelo['introducao'][:30] in p.inner_text('.cab'), '5. título e introdução dos textos do módulo')
    ok(all(p.locator(f'#id_{k}').count() == 1 for k in ('empresa', 'contato', 'funcionario')) and p.locator('#id_documento').count() == 0
       and p.locator('#id_whatsapp').count() == 0, '5. empresa, quem preenche e funcionário (sem CNPJ e sem WhatsApp)')
    ok(vis(p, 'input[name="tipo"][value="experiencia"]') and not vis(p, '#blPedido') and not vis(p, '#blDispensa') and not vis(p, '#blExperiencia') and not vis(p, '#datas'),
       '5. de início só a primeira pergunta; os "se" e as datas escondidos')
    p.click('#btnEnviar'); p.wait_for_timeout(300)
    ok(p.locator('.campo.falta').count() == 4 and 'Faltam 4' in p.inner_text('#msgErro') and not envios(p), '5. obrigatórios barrados (empresa, seu nome, funcionário e o caso)')

    p.check('input[name="tipo"][value="pedido"]'); p.wait_for_timeout(100)
    ok(vis(p, '#blPedido') and not vis(p, '#blDispensa') and not vis(p, '#blCumpre') and not vis(p, '#blImediato'), '5. pedido de demissão: pergunta se cumpre o aviso')
    p.check('input[name="avisoPedido"][value="trabalhado"]'); p.wait_for_timeout(100)
    ok(vis(p, '#id_dataPedido') and not vis(p, '#blImediato'), '5. cumpre o aviso: pergunta quando foi o pedido')
    p.fill('#id_dataPedido', '2026-10-06'); p.wait_for_timeout(150)
    dt = p.inner_text('#datas')
    ok(vis(p, '#datas') and '07/10/2026' in dt and '05/11/2026' in dt and '13/11/2026' in dt and 'sexta-feira' in dt and '15/11/2026' in dt and 'dia útil anterior' in dt,
       '5. datas na hora: aviso 07/10 a 05/11, pagamento até 13/11 (15/11 domingo e feriado)')
    ok('art. 477' in dt and 'feriado na cidade' in dt and '12.506' not in dt, '5. notas da CLT e do feriado municipal (sem a do proporcional no pedido)')
    p.screenshot(path=str(FOTOS / 'rescisoes-link-pedido-claro.png'), full_page=True)
    p.check('input[name="avisoPedido"][value="imediato"]'); p.wait_for_timeout(100)
    ok(vis(p, '#blImediato') and not vis(p, '#blCumpre') and not vis(p, '#datas'), '5. imediato: pergunta o desconto e o último dia (datas somem até ter a data)')
    p.fill('#id_ultimoDia', '2026-10-07'); p.wait_for_timeout(150)
    ok('16/10/2026' in p.inner_text('#datas') and 'sábado' in p.inner_text('#datas'), '5. imediato: pagamento até 16/10 (10º dia no sábado)')
    p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato de Teste'); p.fill('#id_funcionario', 'FULANA DE TESTE')
    p.click('#btnEnviar'); p.wait_for_timeout(300)
    ok(p.locator('.campo.falta').count() == 1 and p.locator('.campo.falta[data-id="desconto"]').count() == 1 and not envios(p), '5. sem dizer o desconto não envia')

    p.check('input[name="tipo"][value="dispensa"]'); p.wait_for_timeout(100)
    ok(vis(p, '#blDispensa') and not vis(p, '#blPedido') and not vis(p, '#datas'), '5. demissão pela empresa: data da comunicação e o aviso')
    p.fill('#id_dataComunicacao', '2026-10-02'); p.check('input[name="avisoDispensa"][value="indenizado"]'); p.wait_for_timeout(150)
    dt = p.inner_text('#datas')
    ok('Último dia de trabalho (dia da comunicação)' in dt and '02/10/2026' in dt and '09/10/2026' in dt and '12/10/2026' in dt and '12.506' in dt,
       '5. indenizado: pagamento até 09/10 (12/10 é feriado) e a nota do proporcional')
    p.fill('#id_obs', 'Funcionário já foi avisado.')
    p.screenshot(path=str(FOTOS / 'rescisoes-link-dispensa-claro.png'), full_page=True)
    p.click('#btnEnviar'); p.wait_for_timeout(1200)
    env = envios(p); a = env[0][1] if env else {}
    ok(len(env) == 1 and env[0][0] == 'rescisao-link' and a.get('empresa') == 'Comércio Modelo' and a.get('contato') == 'Contato de Teste'
       and a.get('funcionario') == 'FULANA DE TESTE', '5. envia pela função rescisao-link, com a empresa, quem preencheu e o funcionário')
    ok(a.get('tipo') == 'dispensa' and a.get('aviso') == 'indenizado' and a.get('data') == '2026-10-02' and a.get('obs') == 'Funcionário já foi avisado.'
       and 'desconta' not in a, '5. envia só o ramo respondido (sem o desconto do pedido)')
    txt = p.inner_text('#app')
    ok('Informações recebidas' in txt and modelo['final'] in txt and 'Pagamento da rescisão até 09/10/2026 (sexta-feira)' in txt, '5. mensagem final com a data do pagamento')
    p.screenshot(path=str(FOTOS / 'rescisoes-link-enviado-claro.png'), full_page=True)
    p.click('#btnOutro'); p.wait_for_timeout(300)
    ok(p.input_value('#id_empresa') == 'Comércio Modelo' and p.input_value('#id_contato') == 'Contato de Teste' and p.input_value('#id_funcionario') == ''
       and not vis(p, '#blDispensa') and p.locator('input[name="tipo"]:checked').count() == 0, '5. "Enviar outra rescisão" mantém a empresa e limpa o resto')
    p.check('input[name="tipo"][value="pedido"]'); p.check('input[name="avisoPedido"][value="imediato"]'); p.wait_for_timeout(100)
    ok(vis(p, '#blImediato') and vis(p, '#id_ultimoDia'), '5. no segundo envio os "se" continuam funcionando')
    p.fill('#id_funcionario', 'SICRANO DE TESTE'); p.check('input[name="desconto"][value="sim"]'); p.fill('#id_ultimoDia', '2026-10-07')
    p.click('#btnEnviar'); p.wait_for_timeout(1000)
    env = envios(p); a = env[-1][1] if env else {}
    ok(len(env) == 2 and a.get('tipo') == 'pedido' and a.get('aviso') == 'imediato' and a.get('desconta') is True and a.get('data') == '2026-10-07', '5. pedido imediato vai com o desconto')
    p.close()

    p = pagina(form, enviar='{ ok: true, id: "11111111-2222-4333-8444-555555555556", email: "rh@macedoereis.com.br", datas: { inicioAviso: null, ultimoDia: "2026-10-15", limite: "2026-10-23" } }')
    p.check('input[name="tipo"][value="experiencia"]'); p.wait_for_timeout(100)
    ok(vis(p, '#blExperiencia') and not vis(p, '#blPedido') and not vis(p, '#blDispensa') and vis(p, 'input[name="iniciativa"][value="empregado"]') and vis(p, '#id_admissao')
       and vis(p, 'input[name="prazoExperiencia"][value="45+45"]') and vis(p, '#id_dataDesligamento') and not vis(p, '#blDescExp'),
       '5. contrato de experiência: quem encerra, admissão, prazo e o último dia')
    p.fill('#id_admissao', '2026-09-01'); p.check('input[name="prazoExperiencia"][value="45+45"]'); p.fill('#id_dataDesligamento', '2026-10-15'); p.wait_for_timeout(150)
    ok(not vis(p, '#datas'), '5. sem dizer quem encerra, as datas esperam')
    p.check('input[name="iniciativa"][value="empresa"]'); p.wait_for_timeout(150)
    dt = p.inner_text('#datas')
    ok('Fim do 1º período (45 dias)' in dt and '15/10/2026' in dt and 'Fim da prorrogação (90 dias)' in dt and '29/11/2026' in dt and '45º dia de contrato' in dt
       and '23/10/2026' in dt and 'último dia do 1º período' in dt, '5. experiência no 45º dia: fim do 1º período, sem indenização; pagar até 23/10 (25/10 é domingo)')
    p.screenshot(path=str(FOTOS / 'rescisoes-link-experiencia-claro.png'), full_page=True)
    p.fill('#id_dataDesligamento', '2026-10-10'); p.wait_for_timeout(150)
    dt = p.inner_text('#datas')
    ok('5 dias que faltariam' in dt and 'art. 479' in dt and '40% do FGTS' in dt and 'Encerrando em 15/10/2026' in dt, '5. antes do fim: metade dos 5 dias que faltam (art. 479) + 40% do FGTS, e a data sem indenização')
    p.fill('#id_dataDesligamento', '2026-12-05'); p.wait_for_timeout(150)
    ok('Passou de 90 dias' in p.inner_text('#datas') and 'Demissão por parte da empresa' in p.inner_text('#datas'), '5. mais de 90 dias: avisa que virou prazo indeterminado')
    p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato de Teste'); p.fill('#id_funcionario', 'MARIA DE TESTE')
    p.fill('#id_dataDesligamento', '2026-08-20'); p.click('#btnEnviar'); p.wait_for_timeout(300)
    ok(p.locator('.campo.falta[data-id="dataDesligamento"]').count() == 1 and 'antes da admissão' in p.inner_text('.campo[data-id="dataDesligamento"]') and not envios(p),
       '5. encerramento antes da admissão: barrado com o motivo')
    p.fill('#id_dataDesligamento', '2026-10-15'); p.click('#btnEnviar'); p.wait_for_timeout(1000)
    env = envios(p); a = env[0][1] if env else {}
    ok(len(env) == 1 and a.get('tipo') == 'experiencia' and a.get('iniciativa') == 'empresa' and a.get('admissao') == '2026-09-01' and a.get('prazo') == '45+45'
       and a.get('data') == '2026-10-15' and 'aviso' not in a and 'desconta' not in a, '5. envia a experiência com quem encerra, admissão, prazo e o último dia (sem aviso)')
    ok('Pagamento da rescisão até 23/10/2026 (sexta-feira)' in p.inner_text('#app'), '5. mensagem final com a data do pagamento da experiência')
    p.close()

    p = pagina(form)
    p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato de Teste'); p.fill('#id_funcionario', 'JOÃO DE TESTE')
    p.check('input[name="tipo"][value="experiencia"]'); p.check('input[name="iniciativa"][value="empregado"]')
    p.fill('#id_admissao', '2026-09-01'); p.check('input[name="prazoExperiencia"][value="45+45"]'); p.fill('#id_dataDesligamento', '2026-10-10'); p.wait_for_timeout(150)
    dt = p.inner_text('#datas')
    ok(vis(p, '#blDescExp') and 'art. 480' in dt and '5 dias' in dt and 'Não há multa de 40%' in dt and '20/10/2026' in dt,
       '5. a pedido do funcionário, antes do fim: indenização do art. 480 (até metade dos 5 dias), sem 40% do FGTS; pergunta o desconto')
    p.screenshot(path=str(FOTOS / 'rescisoes-link-experiencia-funcionario-claro.png'), full_page=True)
    p.click('#btnEnviar'); p.wait_for_timeout(300)
    ok(p.locator('.campo.falta').count() == 1 and p.locator('.campo.falta[data-id="descontoExperiencia"]').count() == 1 and not envios(p), '5. sem dizer o desconto do art. 480 não envia')
    p.fill('#id_dataDesligamento', '2026-10-15'); p.wait_for_timeout(150)
    ok(not vis(p, '#blDescExp') and 'sem indenização' in p.inner_text('#datas'), '5. saindo no fim do período: sem indenização e sem a pergunta do desconto')
    p.fill('#id_dataDesligamento', '2026-12-05'); p.wait_for_timeout(150)
    ok('Pedido de demissão do funcionário' in p.inner_text('#datas'), '5. a pedido do funcionário com mais de 90 dias: marcar pedido de demissão')
    p.fill('#id_dataDesligamento', '2026-10-10'); p.check('input[name="descontoExperiencia"][value="sim"]'); p.click('#btnEnviar'); p.wait_for_timeout(1000)
    env = envios(p); a = env[0][1] if env else {}
    ok(len(env) == 1 and a.get('iniciativa') == 'empregado' and a.get('desconta') is True and a.get('data') == '2026-10-10', '5. envia a pedido do funcionário, com o desconto do art. 480')
    p.close()

    p = pagina(form)
    p.check('input[name="tipo"][value="dispensa"]'); p.fill('#id_dataComunicacao', '2025-01-10'); p.check('input[name="avisoDispensa"][value="trabalhado"]'); p.wait_for_timeout(150)
    ok('já passou' in p.inner_text('#datas') and 'tempo de casa' in p.inner_text('#datas'), '5. prazo vencido avisado; trabalhado com a nota do tempo de casa')
    p.close()

    p = pagina('{ error: "Formulário indisponível." }')
    ok('Formulário indisponível' in p.inner_text('#app'), '5. sem formulário no banco, avisa'); p.close()
    p = pagina(form, enviar='{ error: "Muitos envios agora — tente de novo mais tarde." }')
    p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato'); p.fill('#id_funcionario', 'FULANA')
    p.check('input[name="tipo"][value="pedido"]'); p.check('input[name="avisoPedido"][value="trabalhado"]'); p.fill('#id_dataPedido', '2026-10-06')
    p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok('Muitos envios agora' in p.inner_text('#msgErro') and p.locator('#btnEnviar').count() == 1 and p.input_value('#id_dataPedido') == '2026-10-06',
       '5. "muitos envios" avisado sem perder o preenchido'); p.close()

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        modelo = None
        for tema in ('escuro', 'claro'):
            modelo = modulo(b, base, tema, erros)
        agenda(b, base, modelo, erros)
        publico(b, base, modelo, erros)
        b.close()
    srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:5])))
    print(('\nOK' if not falhas else f'\n{falhas} FALHA(S)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
