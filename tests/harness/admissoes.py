"""
Teste do módulo Admissões do DP (dp-admissoes.html) e do link que a empresa preenche (admissao.html) — sem login e
sem banco (mesmo mock do conferir.py; dados inventados). O link é o mesmo pra todas as empresas, como o forms da
precificação, e só fala com o sistema pela Edge Function admissao-link (formulário, envio e anexos pro Drive); aqui quem
responde é o teste, por window.__mockInvoke.

    python tests/harness/admissoes.py

Confere, nos temas escuro e claro (o link público é sempre claro):
  1. primeira abertura: o formulário do PDF vai pro banco (16 itens; salário-família com o limite de 2026); a caixa do
     link mostra o endereço do formulário, copia e abre o WhatsApp com a mensagem e o link;
  2. com admissões no banco: contagem por situação, "já começou" no início vencido, empresa que não bateu com o
     cadastro marcada "não vinculada", respostas da empresa na ficha (o que a empresa digita sai sempre como texto,
     nunca como HTML), quem enviou com o WhatsApp, a pasta e os arquivos no Drive (o que não chegou, marcado),
     documentos recebidos gravados e contados (salário família não entra na conta), vincular a empresa pela busca,
     situação mudada pela lista (registrada grava quando e quem);
  3. editor do formulário: sem quem recebe na agenda não salva; pergunta nova gravada no modelo; pergunta sem texto
     não salva; a prévia abre o link no modo prévia, sem enviar nada;
  4. link público: campos da empresa no topo, formulário do modelo, anexos e o e-mail em cada lista de documentos,
     obrigatórios barrados, CNPJ com dígito errado barrado, envio com empresa/CNPJ/contato, as respostas (nome, data,
     declaração) e os anexos (cada um aberto no Drive e mandado em partes de 2 MB), mensagem final com a contagem e
     "Enviar outro funcionário" mantendo a empresa; CNPJ fora do cadastro, anexo que não sobe, formulário
     indisponível e "muitos envios" avisados.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime, re
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
CNPJ_OK = '11222333000181'          # CNPJ de exemplo com dígito verificador certo (inventado)

def admissoes_teste():
    docs = lambda recebidos: [{'grupo': 'Documentos', 'item': i, 'condicional': False, 'recebido': n < recebidos} for n, i in enumerate(
        ['Exame Médico admissional (ASO)', 'RG, CPF e Título eleitoral', 'Endereço Completo', 'Carteira de trabalho (caso seja digital somente n° do PIS)'])] + [
        {'grupo': 'Documentos e informações para salário família', 'item': i, 'condicional': True, 'recebido': False}
        for i in ['Certidão de Nascimento do(a) filho(a) e CPF.', 'Atestado de frequência escolar ou Carteira de vacinação.']]
    cli1 = {'nome_principal': 'COMÉRCIO MODELO ME', 'nome_fantasia': None, 'documento': '00000000000000'}
    resp = [
        {'id': 'nome', 'rotulo': 'Nome completo do(a) funcionário(a)', 'tipo': 'texto', 'secao': '', 'valor': 'FULANA DE TESTE'},
        {'id': 'data_inicio', 'rotulo': 'Data de início', 'tipo': 'data', 'secao': '', 'valor': dia(3)},
        {'id': 'salario', 'rotulo': 'Salário mensal ou por hora', 'tipo': 'texto', 'secao': 'Informações importantes', 'valor': 'R$ 2.000,00 mensal'},
        {'id': 'funcao', 'rotulo': 'Função', 'tipo': 'texto', 'secao': 'Informações importantes', 'valor': '<img src=x onerror="window.__xss=1">Vendedora'},
        {'id': 'ciente_menor', 'rotulo': 'A empresa declara estar ciente', 'tipo': 'declaracao', 'secao': 'Empresa declara estar ciente que:', 'valor': 'Sim', 'texto': '* É proibido qualquer trabalho a menores de dezesseis anos'},
    ]
    base = lambda **k: {'origem': 'externa', 'drive_pasta_url': None, 'arquivos': [], 'respostas': None, 'observacoes': None, 'registrada_em': None, 'registrada_por': None,
                        'empresa_nome': None, 'empresa_documento': None, 'contato_nome': None, 'contato_whatsapp': None, 'clientes': None,
                        'criado_por': 'formulário da empresa', 'atualizado_em': None, **k}
    return [
        base(id='a1', cliente_id='c1', clientes=cli1, empresa_nome='Comércio Modelo', empresa_documento='00000000000000',
             contato_nome='CONTATO DE TESTE', contato_whatsapp='(51) 99999-0000', funcionario_nome='FULANA DE TESTE', data_inicio=dia(3),
             responsavel='Vitória', status='respondida', respostas=resp, documentos=docs(1), criado_em=dia(-1) + 'T13:00:00Z',
             drive_pasta_url='https://drive.google.com/drive/folders/PASTA1',
             arquivos=[{'nome': 'rg-frente.jpg', 'tamanho': 2400000, 'tipo': 'image/jpeg', 'grupo': 'Documentos', 'status': 'ok', 'drive_id': 'ARQ1'},
                       {'nome': 'aso.pdf', 'tamanho': 90000, 'tipo': 'application/pdf', 'grupo': 'Documentos', 'status': 'erro'}]),
        base(id='a2', cliente_id=None, empresa_nome='PADARIA NOVA DE TESTE LTDA', empresa_documento='22222222000122',
             contato_nome='OUTRO CONTATO', contato_whatsapp='51988887777', funcionario_nome='SICRANO DE TESTE', data_inicio=dia(-2),
             responsavel='Vitória', status='respondida', respostas=resp[:2], documentos=docs(0), criado_em=dia(-4) + 'T12:00:00Z'),
        base(id='a3', cliente_id='c1', clientes=cli1, funcionario_nome='BELTRANO DE TESTE', data_inicio=dia(-20), responsavel='Edna',
             status='registrada', registrada_em=dia(-21) + 'T15:00:00Z', registrada_por='rh@macedoereis.com.br', documentos=docs(4), criado_em=dia(-30) + 'T12:00:00Z'),
        base(id='a4', cliente_id='c1', clientes=cli1, funcionario_nome='CICLANO DE TESTE', data_inicio=None, responsavel='Vitória',
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
    p.goto(base + 'dp-admissoes.html'); p.wait_for_timeout(1500)
    mods = db(p, 'window.__mockDb.admissao_modelos')
    ok(len(mods) == 1 and mods[0]['ativo'] is True and len(mods[0]['conteudo']['blocos']) == 16, '1. o formulário do PDF foi gravado no banco (16 itens)')
    sf = next((x for x in mods[0]['conteudo']['blocos'] if x.get('condicional')), {})
    ok('1.980,38' in sf.get('texto', '') and '1.819,26' not in json.dumps(mods[0]['conteudo'], ensure_ascii=False), '1. salário-família com o limite de 2026 (R$ 1.980,38)')
    ok('Mande o link' in p.inner_text('#adVazio'), '1. lista vazia explica o que fazer')
    url = p.input_value('#lkUrl')
    ok(url.endswith('/admissao.html') and '?' not in url, '1. a caixa mostra o link único do formulário')
    ok('falta escolher quem recebe' in p.inner_text('#lkResp'), '1. avisa que falta escolher quem recebe na agenda')
    p.click('#lkCopiar'); p.wait_for_timeout(200)
    ok('Link copiado' in p.inner_text('#lkMsg'), '1. copiar o link')
    p.click('#lkZap'); p.wait_for_timeout(200)
    ab = db(p, 'window.__abertos')
    ok(len(ab) == 1 and ab[0].startswith('https://wa.me/?text=') and 'admissao.html' in ab[0] and '%7Blink%7D' not in ab[0], '1. WhatsApp abre com a mensagem e o link')
    ok(p.get_attribute('#lkAbrir', 'href') == 'admissao.html', '1. "Abrir o formulário" leva ao link')
    modelo = mods[0]['conteudo']
    p.screenshot(path=str(FOTOS / f'admissoes-vazio-{tema}.png'))
    p.close()

    print(f'[{tema}] 2. admissões no banco: lista, ficha, vínculo, documentos e situação')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} módulo 2: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(armadilha({**modelo, 'responsavel': 'Vitória'}))
    p.goto(base + 'dp-admissoes.html'); p.wait_for_timeout(1500)
    ok(len(db(p, 'window.__mockDb.admissao_modelos')) == 1, '2. com modelo no banco, não grava outro')
    ok('Vitória' in p.inner_text('#lkResp'), '2. a caixa do link diz de quem é a agenda')
    cont = [p.inner_text(s) for s in ('#fAbe', '#fRec', '#fReg', '#fFei', '#fCan', '#fTod')]
    ok(cont == ['2', '2', '0', '1', '1', '4'], f'2. contagem por situação {cont}')
    ok(p.locator('#adLista tr').count() == 2, '2. "Abertas" mostra só as duas abertas')
    l2 = p.locator('#adLista tr[data-id="a2"]').inner_text()
    ok('já começou' in l2 and 'PADARIA NOVA DE TESTE LTDA' in l2 and 'não vinculada' in l2, '2. início vencido "já começou"; empresa fora do cadastro "não vinculada"')
    ok('1/4' in p.locator('#adLista tr[data-id="a1"]').inner_text(), '2. documentos contados sem o salário família (1/4)')
    p.screenshot(path=str(FOTOS / f'admissoes-lista-{tema}.png'))

    p.click('#adLista tr[data-id="a1"] td >> nth=0'); p.wait_for_timeout(500)
    txt = p.inner_text('#fiRespostas')
    ok('Salário mensal ou por hora' in txt and 'R$ 2.000,00 mensal' in txt, '2. ficha mostra as respostas da empresa')
    ok('<img src=x' in txt and p.evaluate('() => window.__xss === undefined') and p.locator('#fiRespostas img').count() == 0, '2. o que a empresa digitou sai como texto (sem HTML injetado)')
    env = p.inner_text('#fiEnvio')
    ok('CONTATO DE TESTE' in env and '(51) 99999-0000' in env and p.get_attribute('#fiEnvio a', 'href') == 'https://wa.me/5551999990000', '2. quem enviou, com o WhatsApp e o atalho da conversa')
    ok('Vinculada a' in p.inner_text('#fiVinc') and 'COMÉRCIO MODELO ME' in p.inner_text('#fiVinc'), '2. empresa vinculada pelo CNPJ')
    arq = p.inner_text('#fiArquivos')
    ok(p.get_attribute('#fiArquivos a >> nth=0', 'href') == 'https://drive.google.com/drive/folders/PASTA1' and 'rg-frente.jpg' in arq
       and p.get_attribute('#fiArquivos a >> nth=1', 'href') == 'https://drive.google.com/file/d/ARQ1/view' and 'não chegou' in arq, '2. pasta e arquivos no Drive, com o que não chegou marcado')
    p.screenshot(path=str(FOTOS / f'admissoes-ficha-{tema}.png'))
    for i in range(1, 4): p.check(f'#fiDocs [data-doc="{i}"]')
    p.click('#fiSalvar'); p.wait_for_timeout(500)
    a1 = db(p, "window.__mockDb.admissoes.find(a => a.id === 'a1')")
    ok([d['recebido'] for d in a1['documentos']] == [True, True, True, True, False, False], '2. documentos recebidos gravados')
    ok(not p.is_visible('#ovFicha') and '4/4' in p.locator('#adLista tr[data-id="a1"]').inner_text(), '2. ficha fecha e a lista mostra 4/4')

    p.click('#adLista tr[data-id="a2"] td >> nth=0'); p.wait_for_timeout(500)
    ok('Não encontrada no cadastro' in p.inner_text('#fiVinc') and 'PADARIA NOVA DE TESTE LTDA' in p.inner_text('#fiVinc'), '2. ficha avisa que a empresa não está vinculada')
    p.fill('#fiBusca', 'EXEMPLO'); p.wait_for_timeout(600)
    p.locator('#fiRes button', has_text='EMPRESA EXEMPLO LTDA').click(); p.wait_for_timeout(200)
    ok('EMPRESA EXEMPLO LTDA' in p.inner_text('#fiVinc') and 'salve' in p.inner_text('#fiVinc'), '2. empresa escolhida na busca (falta salvar)')
    p.click('#fiSalvar'); p.wait_for_timeout(500)
    ok(db(p, "window.__mockDb.admissoes.find(a => a.id === 'a2').cliente_id") == 'c2', '2. vínculo gravado')
    l2 = p.locator('#adLista tr[data-id="a2"]').inner_text()
    ok('EMPRESA EXEMPLO LTDA' in l2 and 'não vinculada' not in l2, '2. a lista mostra a empresa do cadastro')

    p.select_option('#adLista tr[data-id="a2"] select', 'em_registro'); p.wait_for_timeout(400)
    ok(db(p, "window.__mockDb.admissoes.find(a => a.id === 'a2').status") == 'em_registro' and p.inner_text('#fReg') == '1', '2. situação mudada pela lista (em registro)')
    p.select_option('#adLista tr[data-id="a1"] select', 'registrada'); p.wait_for_timeout(400)
    a1 = db(p, "window.__mockDb.admissoes.find(a => a.id === 'a1')")
    ok(a1['status'] == 'registrada' and a1.get('registrada_em') and a1.get('registrada_por') == 'financeiro@macedoereis.com.br', '2. registrada grava quando e quem')
    ok(p.locator('#adLista tr[data-id="a1"]').count() == 0 and p.inner_text('#fFei') == '2', '2. registrada sai das abertas e entra em Registradas')
    p.close()

    print(f'[{tema}] 3. editor do formulário e prévia')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} editor: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(armadilha(modelo))
    p.goto(base + 'dp-admissoes.html'); p.wait_for_timeout(1500)
    p.click('.ad-aba[data-aba="form"]'); p.wait_for_timeout(300)
    ok(p.locator('#edBlocos .ad-bl').count() == 16 and p.input_value('#edTitulo').startswith('Documentos e informações'), '3. editor mostra os 16 itens do formulário')
    ok('Empresa (razão social), CNPJ' in p.inner_text('#secForm'), '3. editor mostra os campos fixos da empresa')
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    nova.locator('[data-k="rotulo"]').fill('Possui CNH?')
    nova.locator('[data-k="formato"]').select_option('escolha'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    ok(nova.locator('[data-k="opcoes"]').input_value() == 'Sim\nNão', '3. escolha nasce com Sim/Não')
    ok('Alterações não salvas' in p.inner_text('#edSujo'), '3. avisa que há alteração não salva')
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('quem recebe' in d for d in dialogos) and len(db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')) == 16, '3. sem quem recebe na agenda não salva')
    p.select_option('#edResp', 'Vitória')
    ok(p.input_value('#edEmail') == 'rh@macedoereis.com.br', '3. e-mail dos documentos no editor')
    p.screenshot(path=str(FOTOS / f'admissoes-editor-{tema}.png'), full_page=True)
    p.click('#edSalvar'); p.wait_for_timeout(400)
    c = db(p, 'window.__mockDb.admissao_modelos[0].conteudo')
    ok(len(c['blocos']) == 17 and c['blocos'][-1]['rotulo'] == 'Possui CNH?' and c['blocos'][-1]['formato'] == 'escolha' and c.get('responsavel') == 'Vitória', '3. pergunta nova e quem recebe gravados no modelo')
    ok(db(p, 'window.__mockDb.admissao_modelos[0].atualizado_por') == 'financeiro@macedoereis.com.br', '3. grava quem alterou')
    p.click('.ad-aba[data-aba="lista"]'); p.wait_for_timeout(200)
    ok('Vitória' in p.inner_text('#lkResp'), '3. a caixa do link já mostra quem recebe')
    p.click('.ad-aba[data-aba="form"]'); p.wait_for_timeout(200)
    n = len(dialogos)
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(150)
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('sem texto' in d for d in dialogos[n:]) and len(db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')) == 17, '3. pergunta sem texto não salva')
    with p.context.expect_page() as nova_aba:
        p.click('#edPrevia')
    pv = nova_aba.value
    pv.on('pageerror', lambda e: erros.append(f'{tema} prévia: {e}'))
    pv.wait_for_timeout(1500)
    ok(pv.locator('.previa').count() == 1 and 'Documentos e informações' in pv.inner_text('.cab h2') and pv.locator('#id_empresa').count() == 1, '3. prévia abre o link no modo prévia, com os campos da empresa')
    pv.click('#btnEnviar'); pv.wait_for_timeout(300)
    ok('obrigatórios' in pv.inner_text('#msgErro'), '3. na prévia os obrigatórios também são barrados')
    pv.close(); p.close()
    return modelo

def publico(b, base, modelo, erros):
    print('[link] 4. formulário que a empresa preenche')
    # dublê da Edge Function admissao-link: anota as chamadas; "falhaParte" faz o Drive recusar o anexo com esse nome
    def pagina(formulario, enviar='{ ok: true, id: "11111111-2222-4333-8444-555555555555", chave: "CHAVE", drive: true, email: "rh@macedoereis.com.br" }', falha_parte=''):
        p = b.new_page(viewport={'width': 420, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'link: {e}'))
        p.add_init_script("""window.__log = []; window.__arquivoAtual = {};
window.__mockInvoke = async (nome, opts) => {
  const h = opts.headers || {};
  if (h['x-acao'] === 'parte') {
    window.__log.push(['parte', h['x-i'], Number(h['x-inicio']), opts.body.size, Number(h['x-total'])]);
    const nomeArq = window.__arquivoAtual[h['x-i']];
    if (nomeArq && nomeArq === %s) return { data: { error: 'O Drive recusou o arquivo.' }, error: null };
    return { data: { ok: true }, error: null };
  }
  const b = opts.body || {};
  window.__log.push([b.acao, JSON.parse(JSON.stringify(b))]);
  if (b.acao === 'formulario') return { data: %s, error: null };
  if (b.acao === 'enviar') return { data: %s, error: null };
  if (b.acao === 'arquivo') { window.__arquivoAtual[String(b.i)] = b.nome; return { data: { ok: true }, error: null }; }
  if (b.acao === 'concluir') return { data: { ok: true }, error: null };
  return { data: null, error: { message: 'ação ' + b.acao } };
};""" % (json.dumps(falha_parte), formulario, enviar))
        p.goto(base + 'admissao.html'); p.wait_for_timeout(1200)
        return p
    def log(p, acao=None):
        return [x for x in p.evaluate('() => window.__log') if acao is None or x[0] == acao]
    def preencher(p, doc='11.222.333/0001-81'):
        p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_documento', doc); p.fill('#id_contato', 'Contato de Teste'); p.fill('#id_whatsapp', '51999990000')
        p.fill('input[name="q0"]', 'FULANA DE TESTE'); p.fill('input[name="q1"]', dia(10))
        for i, v in ((4, 'R$ 2.000,00 mensal'), (5, 'Vendedora'), (6, '08h às 12h e 13h às 18h'), (7, '1 hora')): p.fill(f'input[name="q{i}"]', v)
        for i, v in ((8, 'Experiência'), (11, 'Ensino Médio completo'), (12, 'Parda'), (13, 'Não'), (14, 'Solteiro(a)')): p.check(f'input[name="q{i}"][value="{v}"]')
        p.check('input[name="q15"]')

    publicado = {**{k: modelo[k] for k in ('titulo', 'introducao', 'blocos', 'final', 'rodape')}, 'email': 'rh@macedoereis.com.br'}
    form = json.dumps(publicado, ensure_ascii=False)
    p = pagina(form)
    ok(p.inner_text('.cab h2') == modelo['titulo'], '4. título do modelo')
    ok(all(p.locator(f'#id_{k}').count() == 1 for k in ('empresa', 'documento', 'contato', 'whatsapp')), '4. campos da empresa e do contato no topo')
    ok(p.locator('.campo').count() == 16 and p.locator('.op').count() == 2 + 7 + 5 + 2 + 4, '4. perguntas e opções do PDF desenhadas')
    ok('1.980,38' in p.inner_text('#app') and 'Exame Médico admissional (ASO)' in p.inner_text('#app'), '4. documentos e salário família na tela')
    ok(p.locator('input[type=file][data-anexo]').count() == 2 and p.locator('.anexo-email', has_text='rh@macedoereis.com.br').count() == 2,
       '4. anexar arquivos e o e-mail rh@ nas duas listas de documentos')
    p.set_input_files('input[data-anexo="2"]', [
        {'name': 'rg-frente.jpg', 'mimeType': 'image/jpeg', 'buffer': b'\xff' * (3 * 1024 * 1024)},
        {'name': 'ctps.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF' + b'0' * 5000}])
    p.set_input_files('input[data-anexo="9"]', [{'name': 'certidao.png', 'mimeType': 'image/png', 'buffer': b'\x89PNG' + b'1' * 900}])
    ok(p.locator('#anx2 .anexo-item').count() == 2 and p.locator('#anx9 .anexo-item').count() == 1 and '3 MB' in p.inner_text('#anx2'), '4. anexos listados com o tamanho')
    p.locator('#anx2 [data-tira="2:1"]').click(); p.wait_for_timeout(100)
    ok(p.locator('#anx2 .anexo-item').count() == 1, '4. tirar um anexo')
    p.set_input_files('input[data-anexo="2"]', [{'name': 'ctps.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF' + b'0' * 5000}])
    p.screenshot(path=str(FOTOS / 'admissoes-link-claro.png'), full_page=True)
    p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok(p.locator('.campo.falta').count() == 16 and 'Faltam 16' in p.inner_text('#msgErro'), '4. obrigatórios barrados (16)')
    ok(not log(p, 'enviar'), '4. nada enviado com obrigatório vazio')
    preencher(p, doc='11.222.333/0001-82')
    ok(p.input_value('#id_whatsapp') == '(51) 99999-0000', '4. WhatsApp com máscara')
    p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok(p.locator('.campo.falta').count() == 1 and p.locator('.campo.falta[data-id="documento"]').count() == 1, '4. CNPJ com dígito errado barrado')
    p.fill('#id_documento', '11.222.333/0001-81')
    p.click('#btnEnviar'); p.wait_for_timeout(1500)
    env = log(p, 'enviar'); a = env[0][1] if env else {}
    r = {x['id']: x for x in a.get('respostas', [])}
    ok(len(env) == 1 and a.get('empresa') == 'Comércio Modelo' and a.get('documento') == CNPJ_OK and a.get('contato') == 'Contato de Teste'
       and a.get('whatsapp') == '(51) 99999-0000', '4. envia empresa, CNPJ (sem pontuação) e contato')
    ok(len(r) == 12 and r.get('nome', {}).get('valor') == 'FULANA DE TESTE' and r.get('data_inicio', {}).get('valor') == dia(10)
       and r.get('tipo_contrato', {}).get('valor') == 'Experiência', '4. envia as 12 respostas com o valor certo')
    ok(r.get('ciente_menor', {}).get('valor') == 'Sim' and 'menores de dezesseis' in r.get('ciente_menor', {}).get('texto', ''), '4. declaração vai com o texto declarado')
    ok([(x['nome'], x['grupo']) for x in a.get('arquivos', [])] == [('rg-frente.jpg', 'Documentos'), ('ctps.pdf', 'Documentos'), ('certidao.png', 'Documentos e informações para salário família')]
       and a['arquivos'][0]['tamanho'] == 3 * 1024 * 1024, '4. avisa os 3 anexos (nome, tamanho e lista de documentos)')
    arqs = log(p, 'arquivo'); partes = log(p, 'parte')
    ok([x[1]['nome'] for x in arqs] == ['rg-frente.jpg', 'ctps.pdf', 'certidao.png'] and all(x[1]['chave'] == 'CHAVE' for x in arqs), '4. abre cada anexo no Drive com a chave do envio')
    ok([(x[1], x[2], x[3]) for x in partes] == [('0', 0, 2 * 1024 * 1024), ('0', 2 * 1024 * 1024, 1024 * 1024), ('1', 0, 5004), ('2', 0, 904)],
       '4. anexo de 3 MB sobe em 2 partes (2 MB + 1 MB); os pequenos, numa só')
    ok(len(log(p, 'concluir')) == 1, '4. fecha o envio no fim')
    txt = p.inner_text('#app')
    ok('Informações recebidas' in txt and '3 arquivos enviados' in txt and modelo['final'][:30] in txt, '4. mensagem final com a contagem dos anexos')
    p.screenshot(path=str(FOTOS / 'admissoes-link-enviado-claro.png'), full_page=True)
    p.click('#btnOutro'); p.wait_for_timeout(300)
    ok(p.input_value('#id_empresa') == 'Comércio Modelo' and p.input_value('#id_documento') == CNPJ_OK and p.input_value('input[name="q0"]') == ''
       and p.locator('.anexo-item').count() == 0, '4. "Enviar outro funcionário" mantém a empresa e limpa o resto (anexos também)')
    p.close()

    p = pagina(form, enviar='{ error: "NAO_CLIENTE", mensagem: "Não encontramos esse CNPJ/CPF entre as empresas atendidas pelo escritório." }')
    preencher(p); p.click('#btnEnviar'); p.wait_for_timeout(500)
    ok(p.locator('.campo.falta[data-id="documento"]').count() == 1 and 'Não encontramos esse CNPJ' in p.inner_text('.campo[data-id="documento"]')
       and p.locator('#btnEnviar').count() == 1, '4. CNPJ fora do cadastro: avisa no campo e mantém o formulário'); p.close()

    p = pagina(form, falha_parte='aso.pdf')
    p.set_input_files('input[data-anexo="2"]', [{'name': 'aso.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF' + b'0' * 800},
                                                 {'name': 'rg.jpg', 'mimeType': 'image/jpeg', 'buffer': b'\xff' * 700}])
    preencher(p); p.click('#btnEnviar'); p.wait_for_timeout(1000)
    txt = p.inner_text('#app')
    ok('1 arquivo enviado' in txt and 'Não conseguimos enviar: aso.pdf' in txt and 'rh@macedoereis.com.br' in txt, '4. anexo que não sobe: avisa qual e pede por e-mail'); p.close()

    p = pagina('{ error: "Formulário indisponível." }')
    ok('Formulário indisponível' in p.inner_text('#app'), '4. sem formulário no banco, avisa'); p.close()
    p = pagina(form, enviar='{ error: "Muitos envios agora — tente de novo mais tarde." }')
    preencher(p, doc='12345678901'); p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok('Muitos envios agora' in p.inner_text('#msgErro') and p.locator('#btnEnviar').count() == 1, '4. CPF aceito; "muitos envios" avisado sem perder o preenchido'); p.close()

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
