"""
Teste do módulo Admissões do DP (dp-admissoes.html) e do link que a empresa preenche (admissao.html) — sem login e
sem banco (mesmo mock do conferir.py; dados inventados). O link público só fala com o banco por duas funções
(admissao_publica / admissao_responder); aqui quem responde é o teste, por window.__mockRpc.

    python tests/harness/admissoes.py

Confere, nos temas escuro e claro (o link público é sempre claro):
  1. primeira abertura: o formulário do PDF vai pro banco (16 itens; salário-família com o limite de 2026);
  2. nova admissão: pede empresa e responsável; grava com o código do link e a lista de documentos do formulário
     e abre a ficha já com o link;
  3. com admissões no banco: contagem por situação, "já começou" no início vencido, respostas da empresa na ficha
     (o que a empresa digita sai sempre como texto, nunca como HTML), documentos recebidos gravados e contados
     (salário família não entra na conta), situação mudada pela lista (registrada grava quando e quem);
  4. editor do formulário: pergunta nova gravada no modelo; pergunta sem texto não salva; a prévia abre o link
     no modo prévia, sem enviar nada;
  5. link público: desenha o formulário do modelo, barra os obrigatórios, envia as respostas (nome, data,
     declaração com o texto) e mostra a mensagem final; link incompleto, inválido, encerrado e já respondido
     (com "Preencher de novo").
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
TOKEN = '11111111-2222-4333-8444-555555555555'

def admissoes_teste():
    docs = lambda recebidos: [{'grupo': 'Documentos', 'item': i, 'condicional': False, 'recebido': n < recebidos} for n, i in enumerate(
        ['Exame Médico admissional (ASO)', 'RG, CPF e Título eleitoral', 'Endereço Completo', 'Carteira de trabalho (caso seja digital somente n° do PIS)'])] + [
        {'grupo': 'Documentos e informações para salário família', 'item': i, 'condicional': True, 'recebido': False}
        for i in ['Certidão de Nascimento do(a) filho(a) e CPF.', 'Atestado de frequência escolar ou Carteira de vacinação.']]
    cli1 = {'nome_principal': 'COMÉRCIO MODELO ME', 'nome_fantasia': None, 'documento': '00000000000000'}
    cli2 = {'nome_principal': 'EMPRESA EXEMPLO LTDA', 'nome_fantasia': 'EXEMPLO', 'documento': '11111111111111'}
    resp = [
        {'id': 'nome', 'rotulo': 'Nome completo do(a) funcionário(a)', 'tipo': 'texto', 'secao': '', 'valor': 'FULANA DE TESTE'},
        {'id': 'data_inicio', 'rotulo': 'Data de início', 'tipo': 'data', 'secao': '', 'valor': dia(3)},
        {'id': 'salario', 'rotulo': 'Salário mensal ou por hora', 'tipo': 'texto', 'secao': 'Informações importantes', 'valor': 'R$ 2.000,00 mensal'},
        {'id': 'funcao', 'rotulo': 'Função', 'tipo': 'texto', 'secao': 'Informações importantes', 'valor': '<img src=x onerror="window.__xss=1">Vendedora'},
        {'id': 'ciente_menor', 'rotulo': 'A empresa declara estar ciente', 'tipo': 'declaracao', 'secao': 'Empresa declara estar ciente que:', 'valor': 'Sim', 'texto': '* É proibido qualquer trabalho a menores de dezesseis anos'},
    ]
    base = lambda **k: {'token': TOKEN, 'respostas': None, 'observacoes': None, 'respondida_em': None, 'registrada_em': None,
                        'registrada_por': None, 'criado_por': 'rh@macedoereis.com.br', 'atualizado_em': None, **k}
    return [
        base(id='a1', cliente_id='c1', clientes=cli1, funcionario_nome='FULANA DE TESTE', data_inicio=dia(3), responsavel='Vitória',
             status='respondida', respostas=resp, respondida_em=dia(-1) + 'T13:00:00Z', documentos=docs(1), criado_em=dia(-3) + 'T12:00:00Z'),
        base(id='a2', cliente_id='c2', clientes=cli2, funcionario_nome=None, data_inicio=dia(-2), responsavel='Vitória',
             status='aguardando_empresa', documentos=docs(0), criado_em=dia(-5) + 'T12:00:00Z'),
        base(id='a3', cliente_id='c1', clientes=cli1, funcionario_nome='BELTRANO DE TESTE', data_inicio=dia(-20), responsavel='Edna',
             status='registrada', registrada_em=dia(-21) + 'T15:00:00Z', registrada_por='rh@macedoereis.com.br', documentos=docs(4), criado_em=dia(-30) + 'T12:00:00Z'),
        base(id='a4', cliente_id='c2', clientes=cli2, funcionario_nome='CICLANO DE TESTE', data_inicio=None, responsavel='Vitória',
             status='cancelada', documentos=docs(0), criado_em=dia(-40) + 'T12:00:00Z'),
    ]

def armadilha(modelo):
    return """(() => {
  const ADM = %s, MOD = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.admissoes = ADM; v.admissao_modelos = [{ id: 'm1', nome: 'Ficha de admissão', conteudo: MOD, ativo: true, atualizado_em: '2026-10-06T12:00:00Z', atualizado_por: 'rh@macedoereis.com.br' }];
  } });
})();""" % (json.dumps(admissoes_teste(), ensure_ascii=False), json.dumps(modelo, ensure_ascii=False))

INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def db(p, expr):
    return p.evaluate('() => ' + expr)

def modulo(b, base, tema, erros):
    print(f'[{tema}] 1–2. primeira abertura e nova admissão')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} módulo: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(INIT_TEMA % tema)
    p.goto(base + 'dp-admissoes.html'); p.wait_for_timeout(1500)
    mods = db(p, 'window.__mockDb.admissao_modelos')
    ok(len(mods) == 1 and mods[0]['ativo'] is True and len(mods[0]['conteudo']['blocos']) == 16, '1. o formulário do PDF foi gravado no banco (16 itens)')
    sf = next((x for x in mods[0]['conteudo']['blocos'] if x.get('condicional')), {})
    ok('1.980,38' in sf.get('texto', '') and '1.819,26' not in json.dumps(mods[0]['conteudo'], ensure_ascii=False), '1. salário-família com o limite de 2026 (R$ 1.980,38)')
    ok('Nenhuma admissão ainda' in p.inner_text('#adVazio'), '1. lista vazia explica o que fazer')
    modelo = mods[0]['conteudo']

    p.click('#btnNova'); p.wait_for_timeout(200)
    p.fill('#nvBusca', 'MODELO'); p.wait_for_timeout(600)
    p.locator('#nvRes button', has_text='COMÉRCIO MODELO ME').click(); p.wait_for_timeout(150)
    ok('COMÉRCIO MODELO ME' in p.inner_text('#nvEscolhida'), '2. empresa escolhida pela busca')
    p.click('#nvCriar'); p.wait_for_timeout(200)
    ok('responsável' in p.inner_text('#nvMsg') and not db(p, 'window.__mockDb.admissoes || []'), '2. sem responsável não cria')
    p.select_option('#nvResp', 'Vitória'); p.fill('#nvNome', 'FULANA DE TESTE'); p.fill('#nvInicio', dia(7))
    p.click('#nvCriar'); p.wait_for_timeout(700)
    ads = db(p, 'window.__mockDb.admissoes')
    a = ads[0] if ads else {}
    import re
    ok(len(ads) == 1 and a.get('status') == 'aguardando_empresa' and a.get('responsavel') == 'Vitória' and a.get('cliente_id') == 'c1'
       and a.get('funcionario_nome') == 'FULANA DE TESTE' and a.get('data_inicio') == dia(7), '2. admissão gravada (empresa, nome, início, responsável, aguardando a empresa)')
    ok(bool(re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', a.get('token', ''))), '2. com o código do link (UUID aleatório)')
    docs = a.get('documentos') or []
    ok(len(docs) == 6 and sum(1 for d in docs if d['condicional']) == 2 and not any(d['recebido'] for d in docs), '2. lista de documentos do formulário (4 + 2 do salário família)')
    ok(p.is_visible('#ovFicha') and p.input_value('#fiLink').endswith('admissao.html?t=' + a.get('token', '?')), '2. a ficha abre com o link da admissão')
    ok('Admissão criada' in p.inner_text('#fiMsg'), '2. recado de criada')
    p.screenshot(path=str(FOTOS / f'admissoes-nova-{tema}.png'))
    p.click('#fiFechar'); p.wait_for_timeout(200)
    ok(p.locator('#adLista tr').count() == 1 and p.inner_text('#fAbe') == '1' and p.inner_text('#fAgu') == '1', '2. aparece na lista (Abertas 1, Aguardando 1)')
    p.close()

    print(f'[{tema}] 3. admissões no banco: lista, ficha, documentos e situação')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} módulo 2: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(armadilha(modelo))
    p.goto(base + 'dp-admissoes.html'); p.wait_for_timeout(1500)
    ok(len(db(p, 'window.__mockDb.admissao_modelos')) == 1, '3. com modelo no banco, não grava outro')
    cont = [p.inner_text(s) for s in ('#fAbe', '#fAgu', '#fRes', '#fReg', '#fFei', '#fTod')]
    ok(cont == ['2', '1', '1', '0', '1', '4'], f'3. contagem por situação {cont}')
    ok(p.locator('#adLista tr').count() == 2, '3. "Abertas" mostra só as duas abertas')
    linha2 = p.locator('#adLista tr[data-id="a2"]')
    ok('já começou' in linha2.inner_text() and 'a definir' in linha2.inner_text(), '3. início vencido marcado "já começou"; sem nome, "a definir"')
    ok('1/4' in p.locator('#adLista tr[data-id="a1"]').inner_text(), '3. documentos contados sem o salário família (1/4)')
    p.screenshot(path=str(FOTOS / f'admissoes-lista-{tema}.png'))

    p.click('#adLista tr[data-id="a1"] td >> nth=0'); p.wait_for_timeout(500)
    txt = p.inner_text('#fiRespostas')
    ok('Salário mensal ou por hora' in txt and 'R$ 2.000,00 mensal' in txt and 'Respondido em' in txt, '3. ficha mostra as respostas da empresa')
    ok('<img src=x' in txt and p.evaluate('() => window.__xss === undefined') and p.locator('#fiRespostas img').count() == 0, '3. o que a empresa digitou sai como texto (sem HTML injetado)')
    ok(p.locator('#fiCopResp').count() == 1, '3. botão "Copiar respostas"')
    p.screenshot(path=str(FOTOS / f'admissoes-ficha-{tema}.png'), full_page=True)
    for i in range(1, 4): p.check(f'#fiDocs [data-doc="{i}"]')
    p.click('#fiSalvar'); p.wait_for_timeout(500)
    a1 = db(p, "window.__mockDb.admissoes.find(a => a.id === 'a1')")
    ok([d['recebido'] for d in a1['documentos']] == [True, True, True, True, False, False], '3. documentos recebidos gravados')
    ok(not p.is_visible('#ovFicha') and '4/4' in p.locator('#adLista tr[data-id="a1"]').inner_text(), '3. ficha fecha e a lista mostra 4/4')

    p.select_option('#adLista tr[data-id="a2"] select', 'em_registro'); p.wait_for_timeout(400)
    ok(db(p, "window.__mockDb.admissoes.find(a => a.id === 'a2').status") == 'em_registro' and p.inner_text('#fReg') == '1', '3. situação mudada pela lista (em registro)')
    p.select_option('#adLista tr[data-id="a1"] select', 'registrada'); p.wait_for_timeout(400)
    a1 = db(p, "window.__mockDb.admissoes.find(a => a.id === 'a1')")
    ok(a1['status'] == 'registrada' and a1.get('registrada_em') and a1.get('registrada_por') == 'financeiro@macedoereis.com.br', '3. registrada grava quando e quem')
    ok(p.locator('#adLista tr[data-id="a1"]').count() == 0 and p.inner_text('#fFei') == '2', '3. registrada sai das abertas e entra em Registradas')

    print(f'[{tema}] 4. editor do formulário e prévia')
    p.click('.ad-aba[data-aba="form"]'); p.wait_for_timeout(300)
    ok(p.locator('#edBlocos .ad-bl').count() == 16 and p.input_value('#edTitulo').startswith('Documentos e informações'), '4. editor mostra os 16 itens do formulário')
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    nova.locator('[data-k="rotulo"]').fill('Possui CNH?')
    nova.locator('[data-k="formato"]').select_option('escolha'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    ok(nova.locator('[data-k="opcoes"]').input_value() == 'Sim\nNão', '4. escolha nasce com Sim/Não')
    ok('Alterações não salvas' in p.inner_text('#edSujo'), '4. avisa que há alteração não salva')
    p.screenshot(path=str(FOTOS / f'admissoes-editor-{tema}.png'), full_page=True)
    p.click('#edSalvar'); p.wait_for_timeout(400)
    blocos = db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')
    ok(len(blocos) == 17 and blocos[-1]['rotulo'] == 'Possui CNH?' and blocos[-1]['formato'] == 'escolha' and len(blocos[-1]['opcoes']) == 2, '4. pergunta nova gravada no modelo')
    ok(db(p, 'window.__mockDb.admissao_modelos[0].atualizado_por') == 'financeiro@macedoereis.com.br', '4. grava quem alterou')
    n = len(dialogos)
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(150)
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('sem texto' in d for d in dialogos[n:]) and len(db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')) == 17, '4. pergunta sem texto não salva')
    with p.context.expect_page() as nova_aba:
        p.click('#edPrevia')
    pv = nova_aba.value
    pv.on('pageerror', lambda e: erros.append(f'{tema} prévia: {e}'))
    pv.wait_for_timeout(1500)
    ok(pv.locator('.previa').count() == 1 and 'Documentos e informações' in pv.inner_text('.cab h2'), '4. prévia abre o link no modo prévia')
    pv.click('#btnEnviar'); pv.wait_for_timeout(300)
    ok('obrigatórios' in pv.inner_text('#msgErro'), '4. na prévia os obrigatórios também são barrados')
    pv.close(); p.close()
    return modelo

def publico(b, base, modelo, erros):
    print('[link] 5. formulário que a empresa preenche')
    def pagina(resposta, rpc_envio='{ data: { ok: true }, error: null }', url=None):
        p = b.new_page(viewport={'width': 420, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'link: {e}'))
        p.add_init_script("""window.__rpcLog = [];
window.__mockRpc = (nome, args) => { window.__rpcLog.push([nome, JSON.parse(JSON.stringify(args))]);
  if (nome === 'admissao_publica') return %s;
  if (nome === 'admissao_responder') return %s;
  return { data: null, error: { message: 'rpc ' + nome } }; };""" % (resposta, rpc_envio))
        p.goto(url or (base + 'admissao.html?t=' + TOKEN)); p.wait_for_timeout(1200)
        return p

    aberto = json.dumps({'data': {'situacao': 'aberto', 'empresa': 'COMÉRCIO MODELO', 'funcionario': None, 'data_inicio': None, 'modelo': modelo}, 'error': None}, ensure_ascii=False)
    p = pagina(aberto)
    ok(p.inner_text('.cab h2') == modelo['titulo'] and 'COMÉRCIO MODELO' in p.inner_text('.cab'), '5. título do modelo e nome da empresa')
    ok(p.locator('.campo').count() == 12 and p.locator('.op').count() == 2 + 7 + 5 + 2 + 4, '5. perguntas e opções do PDF desenhadas')
    ok('1.980,38' in p.inner_text('#app') and 'Exame Médico admissional (ASO)' in p.inner_text('#app'), '5. documentos e salário família na tela')
    p.screenshot(path=str(FOTOS / 'admissoes-link-claro.png'), full_page=True)
    p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok(p.locator('.campo.falta').count() == 12 and 'Faltam 12' in p.inner_text('#msgErro'), '5. obrigatórios barrados (12)')
    ok(not any(x[0] == 'admissao_responder' for x in p.evaluate('() => window.__rpcLog')), '5. nada enviado com obrigatório vazio')
    p.fill('input[name="q0"]', 'FULANA DE TESTE'); p.fill('input[name="q1"]', dia(10))
    for i, v in ((4, 'R$ 2.000,00 mensal'), (5, 'Vendedora'), (6, '08h às 12h e 13h às 18h'), (7, '1 hora')): p.fill(f'input[name="q{i}"]', v)
    for i, v in ((8, 'Experiência'), (11, 'Ensino Médio completo'), (12, 'Parda'), (13, 'Não'), (14, 'Solteiro(a)')): p.check(f'input[name="q{i}"][value="{v}"]')
    ok(p.locator('.campo.falta').count() == 1, '5. campo preenchido perde a marca vermelha (só falta a declaração)')
    p.check('input[name="q15"]')
    p.click('#btnEnviar'); p.wait_for_timeout(500)
    env = [x for x in p.evaluate('() => window.__rpcLog') if x[0] == 'admissao_responder']
    r = {x['id']: x for x in (env[0][1]['p_respostas'] if env else [])}
    ok(len(env) == 1 and env[0][1]['p_token'] == TOKEN and len(r) == 12, '5. envia as 12 respostas com o código do link')
    ok(r.get('nome', {}).get('valor') == 'FULANA DE TESTE' and r.get('data_inicio', {}).get('valor') == dia(10) and r.get('tipo_contrato', {}).get('valor') == 'Experiência', '5. nome, início e escolhas com o valor certo')
    ok(r.get('ciente_menor', {}).get('valor') == 'Sim' and 'menores de dezesseis' in r.get('ciente_menor', {}).get('texto', ''), '5. declaração vai com o texto declarado')
    ok(r.get('salario', {}).get('secao') == 'Informações importantes', '5. cada resposta leva a seção')
    ok('Informações recebidas' in p.inner_text('#app') and modelo['final'][:30] in p.inner_text('#app'), '5. mensagem final do modelo')
    p.screenshot(path=str(FOTOS / 'admissoes-link-enviado-claro.png'), full_page=True)
    p.close()

    p = pagina(aberto, url=base + 'admissao.html?t=abc')
    ok('Link incompleto' in p.inner_text('#app') and not p.evaluate('() => window.__rpcLog.length'), '5. link incompleto nem consulta o banco'); p.close()
    p = pagina('{ data: { situacao: "invalido" }, error: null }')
    ok('Link inválido' in p.inner_text('#app'), '5. link inválido/cancelado'); p.close()
    p = pagina('{ data: { situacao: "encerrado" }, error: null }')
    ok('encerrado' in p.inner_text('#app') and p.locator('#btnEnviar').count() == 0, '5. link encerrado não mostra o formulário'); p.close()
    resp = json.dumps({'data': {'situacao': 'respondida', 'empresa': 'COMÉRCIO MODELO', 'respondida_em': '2026-10-05T13:30:00Z', 'modelo': modelo}, 'error': None}, ensure_ascii=False)
    p = pagina(resp)
    ok('Já recebemos' in p.inner_text('#app') and '05/10/2026 às 10:30' in p.inner_text('#app'), '5. já respondido mostra quando (horário de Brasília)')
    p.click('#btnDeNovo'); p.wait_for_timeout(300)
    ok(p.locator('#btnEnviar').count() == 1 and p.locator('.campo').count() == 12, '5. "Preencher de novo" abre o formulário em branco'); p.close()
    p = pagina(aberto, rpc_envio='{ data: null, error: { message: "link encerrado" } }')
    p.fill('input[name="q0"]', 'X'); p.fill('input[name="q1"]', dia(10))
    for i in (4, 5, 6, 7): p.fill(f'input[name="q{i}"]', 'x')
    for i, v in ((8, 'Indeterminado'), (11, 'Analfabeto'), (12, 'Branco'), (13, 'Sim'), (14, 'Casado(a)')): p.check(f'input[name="q{i}"][value="{v}"]')
    p.check('input[name="q15"]'); p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok('encerrado' in p.inner_text('#app'), '5. se o DP encerrou no meio do preenchimento, avisa em vez de dar erro técnico'); p.close()

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
        publico(b, base, modelo, erros)
        b.close()
    srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:5])))
    print(('\nOK' if not falhas else f'\n{falhas} FALHA(S)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
