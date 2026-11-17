"""
Teste do módulo Admissões do DP (dp-admissoes.html) e do link que a empresa preenche (admissao.html) — sem login e
sem banco (mesmo mock do conferir.py; dados inventados). O link é o mesmo pra todas as empresas, como o forms da
precificação, e só fala com o sistema pela Edge Function admissao-link (formulário, envio e anexos pro Drive); aqui quem
responde é o teste, por window.__mockInvoke.

    python tests/harness/admissoes.py

Confere, nos temas escuro e claro (o link público é sempre claro):
  1. primeira abertura: o formulário do PDF vai pro banco (21 itens; salário-família com o limite de 2026; os documentos
     de anexo obrigatório e o prazo da experiência, que só aparece com o contrato de experiência); a caixa do link
     mostra o endereço do formulário, copia e abre o WhatsApp com a mensagem e o link;
  2. com admissões no banco: contagem por situação, "já começou" no início vencido, empresa que não bateu com o
     cadastro marcada "não vinculada", respostas da empresa na ficha (o que a empresa digita sai sempre como texto,
     nunca como HTML), quem enviou com o WhatsApp, a pasta e os arquivos no Drive (o que não chegou, marcado),
     documentos recebidos gravados e contados (salário família não entra na conta; o documento anexado no lugar dele
     diz quantos arquivos chegaram), vincular a empresa pela busca, situação mudada pela lista (registrada grava
     quando e quem);
  3. editor do formulário: sem quem recebe na agenda não salva; pergunta nova gravada no modelo; pergunta sem texto
     não salva; a lista de documentos com anexo obrigatório e a pergunta que só aparece com uma resposta de outra
     (gravada, e barrada quando a lista é "só quando se aplica"); a prévia abre o link no modo prévia, com o botão
     de enviar desligado e a lista do que falta, sem enviar nada;
  4. link público: campos da empresa no topo, formulário do modelo, anexos e o e-mail em cada lista de documentos,
     no topo só a empresa e quem preenche (sem CNPJ e sem WhatsApp); o aviso do que é obrigatório; o botão de enviar
     desligado até tudo estar preenchido e anexado (17/11/2026, pedido da Vitória), com a lista do que falta e cada
     item levando ao campo; um lugar de anexar por documento obrigatório, frente e verso separados e a caixa "no mesmo
     arquivo"; o prazo da experiência só com o contrato de experiência; envio com a empresa, quem preencheu, as
     respostas (nome, data, declaração) e os anexos (cada um aberto no Drive, com o documento dele, e mandado em partes
     de 2 MB), mensagem final com a contagem e "Enviar outro funcionário" mantendo a empresa; anexo que não sobe,
     formulário indisponível e "muitos envios" avisados; o formulário de antes (sem as marcas novas) segue enviando.
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
             arquivos=[{'nome': 'rg-frente.jpg', 'tamanho': 2400000, 'tipo': 'image/jpeg', 'grupo': 'RG, CPF e Título eleitoral (frente)', 'status': 'ok', 'drive_id': 'ARQ1'},
                       {'nome': 'aso.pdf', 'tamanho': 90000, 'tipo': 'application/pdf', 'grupo': 'Exame Médico admissional (ASO)', 'status': 'erro'}]),
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
    ok(len(mods) == 1 and mods[0]['ativo'] is True and len(mods[0]['conteudo']['blocos']) == 21, '1. o formulário do PDF foi gravado no banco (21 itens)')
    bl = mods[0]['conteudo']['blocos']
    ok(bl[2].get('anexo_obrigatorio') is True and bl[2]['itens'] == ['Exame médico admissional (ASO)', 'Documento com foto (RG ou CNH), frente e verso', 'Comprovante de endereço']
       and not bl[3].get('anexo_obrigatorio') and not bl[14].get('anexo_obrigatorio'), '1. exame, documento (frente e verso) e endereço na lista de anexo obrigatório; as outras listas, não')
    ok([b.get('id') for b in bl[7:10]] == ['horario', 'dias_trabalho', 'dias_folga'] and all(b.get('obrigatoria') for b in bl[7:10])
       and bl[12].get('so_se') == {'id': 'tipo_contrato', 'valor': 'Experiência'} and bl[13].get('so_se') == {'id': 'prazo_experiencia', 'valor': 'Outro prazo'},
       '1. horário, dias de trabalho e dias de folga obrigatórios; o prazo da experiência só com o contrato de experiência')
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
    ok('Vinculada a' in p.inner_text('#fiVinc') and 'COMÉRCIO MODELO ME' in p.inner_text('#fiVinc'), '2. empresa vinculada ao cadastro')
    arq = p.inner_text('#fiArquivos')
    ok(p.get_attribute('#fiArquivos a >> nth=0', 'href') == 'https://drive.google.com/drive/folders/PASTA1' and 'rg-frente.jpg' in arq
       and p.get_attribute('#fiArquivos a >> nth=1', 'href') == 'https://drive.google.com/file/d/ARQ1/view' and 'não chegou' in arq, '2. pasta e arquivos no Drive, com o que não chegou marcado')
    docs_txt = ' '.join(p.inner_text('#fiDocs').split())
    ok('RG, CPF e Título eleitoral · 📎 1 arquivo anexado' in docs_txt and docs_txt.count('📎') == 1, '2. o documento anexado no lugar dele diz quantos arquivos chegaram (o que não chegou não conta)')
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
    ok(p.locator('#edBlocos .ad-bl').count() == 21 and p.input_value('#edTitulo').startswith('Documentos e informações'), '3. editor mostra os 21 itens do formulário')
    ok('anexo obrigatório' in p.locator('#edBlocos .ad-bl').nth(2).inner_text() and 'anexo obrigatório' not in p.locator('#edBlocos .ad-bl').nth(3).inner_text()
       and 'só com a resposta "Experiência"' in p.locator('#edBlocos .ad-bl').nth(12).inner_text(), '3. o resumo de cada item diz o anexo obrigatório e de qual resposta a pergunta depende')
    p.locator('#edBlocos .ad-bl').nth(2).locator('.ad-bl-cab').click(); p.wait_for_timeout(150)
    ok(p.locator('#edBlocos .ad-bl').nth(2).locator('[data-k="anexo_obrigatorio"]').is_checked() and 'frente e verso' in p.locator('#edBlocos .ad-bl').nth(2).inner_text(),
       '3. a lista de documentos tem a caixa do anexo obrigatório, marcada, com a dica do frente e verso')
    p.locator('#edBlocos .ad-bl').nth(2).locator('.ad-bl-cab').click(); p.wait_for_timeout(150)
    p.locator('#edBlocos .ad-bl').nth(12).locator('.ad-bl-cab').click(); p.wait_for_timeout(150)
    prazo = p.locator('#edBlocos .ad-bl').nth(12)
    ok(prazo.locator('[data-k="so_se_id"]').input_value() == 'tipo_contrato' and prazo.locator('[data-k="so_se_valor"]').input_value() == 'Experiência'
       and prazo.locator('[data-k="so_se_valor"] option').count() == 2, '3. o prazo da experiência mostra de qual pergunta e de qual resposta depende')
    prazo.locator('.ad-bl-cab').click(); p.wait_for_timeout(150)
    ok('Empresa (razão social) e nome de quem preenche' in p.inner_text('#secForm'), '3. editor mostra os campos fixos (empresa e quem preenche)')
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    nova.locator('[data-k="rotulo"]').fill('Possui CNH?')
    nova.locator('[data-k="formato"]').select_option('escolha'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    ok(nova.locator('[data-k="opcoes"]').input_value() == 'Sim\nNão', '3. escolha nasce com Sim/Não')
    ok(nova.locator('[data-k="so_se_id"]').input_value() == '' and nova.locator('[data-k="so_se_valor"]').count() == 0
       and nova.locator('[data-k="so_se_id"] option').count() == 1 + 6, '3. pergunta nova aparece sempre; pode depender das 6 perguntas de escolha que vêm antes')
    nova.locator('[data-k="so_se_id"]').select_option('vale_transporte'); p.wait_for_timeout(200)
    nova = p.locator('#edBlocos .ad-bl').last
    ok(nova.locator('[data-k="so_se_valor"]').input_value() == 'Sim' and 'só com a resposta "Sim"' in nova.inner_text(), '3. escolhida a pergunta, nasce com a primeira resposta dela')
    nova.locator('[data-k="so_se_valor"]').select_option('Não'); p.wait_for_timeout(150)
    ok('Alterações não salvas' in p.inner_text('#edSujo'), '3. avisa que há alteração não salva')
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('quem recebe' in d for d in dialogos) and len(db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')) == 21, '3. sem quem recebe na agenda não salva')
    p.select_option('#edResp', 'Vitória')
    ok(p.input_value('#edEmail') == 'rh@macedoereis.com.br', '3. e-mail dos documentos no editor')
    p.screenshot(path=str(FOTOS / f'admissoes-editor-{tema}.png'), full_page=True)
    p.click('#edSalvar'); p.wait_for_timeout(400)
    c = db(p, 'window.__mockDb.admissao_modelos[0].conteudo')
    ok(len(c['blocos']) == 22 and c['blocos'][-1]['rotulo'] == 'Possui CNH?' and c['blocos'][-1]['formato'] == 'escolha' and c.get('responsavel') == 'Vitória', '3. pergunta nova e quem recebe gravados no modelo')
    ok(c['blocos'][-1].get('so_se') == {'id': 'vale_transporte', 'valor': 'Não'} and c['blocos'][2].get('anexo_obrigatorio') is True
       and c['blocos'][12].get('so_se') == {'id': 'tipo_contrato', 'valor': 'Experiência'}, '3. a condição da pergunta nova gravada; as marcas que já estavam no formulário ficam')
    ok(db(p, 'window.__mockDb.admissao_modelos[0].atualizado_por') == 'financeiro@macedoereis.com.br', '3. grava quem alterou')
    p.click('.ad-aba[data-aba="lista"]'); p.wait_for_timeout(200)
    ok('Vitória' in p.inner_text('#lkResp'), '3. a caixa do link já mostra quem recebe')
    p.click('.ad-aba[data-aba="form"]'); p.wait_for_timeout(200)
    n = len(dialogos)
    p.click('.ad-add [data-novo="pergunta"]'); p.wait_for_timeout(150)
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('sem texto' in d for d in dialogos[n:]) and len(db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos')) == 22, '3. pergunta sem texto não salva')
    p.locator('#edBlocos .ad-bl').last.locator('[data-acao="tira"]').click(); p.wait_for_timeout(150)
    n = len(dialogos)
    p.locator('#edBlocos .ad-bl').nth(14).locator('.ad-bl-cab').click(); p.wait_for_timeout(150)
    p.locator('#edBlocos .ad-bl').nth(14).locator('[data-k="anexo_obrigatorio"]').check()
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('só quando se aplica' in d and 'anexo obrigatório' in d for d in dialogos[n:]) and not db(p, 'window.__mockDb.admissao_modelos[0].conteudo.blocos[14].anexo_obrigatorio'),
       '3. lista "só quando se aplica" com anexo obrigatório não salva')
    p.locator('#edBlocos .ad-bl').nth(14).locator('[data-k="anexo_obrigatorio"]').uncheck()
    n = len(dialogos)
    p.locator('#edBlocos .ad-bl').nth(11).locator('[data-acao="desce"]').click(); p.wait_for_timeout(150)
    p.click('#edSalvar'); p.wait_for_timeout(300)
    ok(any('precisa vir depois de "Tipo de Contrato"' in d for d in dialogos[n:]), '3. a pergunta que depende de outra não salva acima dela')
    p.locator('#edBlocos .ad-bl').nth(12).locator('[data-acao="sobe"]').click(); p.wait_for_timeout(150)
    with p.context.expect_page() as nova_aba:
        p.click('#edPrevia')
    pv = nova_aba.value
    pv.on('pageerror', lambda e: erros.append(f'{tema} prévia: {e}'))
    pv.wait_for_timeout(1500)
    ok(pv.locator('.previa').count() == 1 and 'Documentos e informações' in pv.inner_text('.cab h2') and pv.locator('#id_empresa').count() == 1, '3. prévia abre o link no modo prévia, com os campos da empresa')
    ok(pv.is_disabled('#btnEnviar') and 'Faltam 20 itens' in pv.inner_text('#pendencias') and pv.locator('#obrigatorios').count() == 1,
       '3. na prévia o botão de enviar também fica desligado, com a lista do que falta')
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
    PDF = lambda n=800: b'%PDF' + b'0' * n
    def anexar(p, chave, *arqs):
        p.set_input_files(f'input[data-anexo="{chave}"]', [{'name': n, 'mimeType': m, 'buffer': c} for n, m, c in arqs])
    def preencher(p, contrato='Experiência', prazo='45 + 45 dias'):
        p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato de Teste')
        p.fill('input[name="q0"]', 'FULANA DE TESTE'); p.fill('input[name="q1"]', dia(10))
        for i, v in ((5, 'R$ 2.000,00 mensal'), (6, 'Vendedora'), (7, '08h às 12h e 13h às 18h'), (8, 'segunda a sexta'), (9, 'sábado e domingo'), (10, '1 hora')): p.fill(f'input[name="q{i}"]', v)
        for i, v in ((11, contrato), (16, 'Ensino Médio completo'), (17, 'Parda'), (18, 'Não'), (19, 'Solteiro(a)')): p.check(f'input[name="q{i}"][value="{v}"]')
        if contrato == 'Experiência' and prazo: p.check(f'input[name="q12"][value="{prazo}"]')
        p.check('input[name="q20"]')
    def anexar_obrigatorios(p):
        anexar(p, '2-0', ('aso.pdf', 'application/pdf', PDF()))
        anexar(p, '2-1-f', ('rg-frente.jpg', 'image/jpeg', b'\xff' * 700))
        anexar(p, '2-1-v', ('rg-verso.jpg', 'image/jpeg', b'\xff' * 600))
        anexar(p, '2-2', ('luz.pdf', 'application/pdf', PDF(500)))
    faltam = lambda p: [x.strip() for x in p.locator('#pendencias .pend-item').all_inner_texts()]
    forcar = lambda p: p.evaluate("() => document.getElementById('btnEnviar').click()")   # o clique que o botão desligado ignora

    publicado = {**{k: modelo[k] for k in ('titulo', 'introducao', 'blocos', 'final', 'rodape')}, 'email': 'rh@macedoereis.com.br'}
    form = json.dumps(publicado, ensure_ascii=False)
    p = pagina(form)
    ok(p.inner_text('.cab h2') == modelo['titulo'], '4. título do modelo')
    ok(p.locator('#id_empresa').count() == 1 and p.locator('#id_contato').count() == 1 and p.locator('#id_documento').count() == 0
       and p.locator('#id_whatsapp').count() == 0, '4. no topo só a empresa e quem preenche (sem CNPJ e sem WhatsApp)')
    ok(p.locator('.campo').count() == 18 and p.locator('.op').count() == 2 + 6 + 7 + 5 + 2 + 4, '4. perguntas e opções do PDF desenhadas')
    ok('1.980,38' in p.inner_text('#app') and 'Exame médico admissional (ASO)' in p.inner_text('#app'), '4. documentos e salário família na tela')
    ok(p.locator('input[type=file][data-anexo]').count() == 6 and p.locator('.anexo-email', has_text='rh@macedoereis.com.br').count() == 3,
       '4. um lugar de anexar por documento obrigatório (o de frente e verso, dois), um em cada lista comum; o e-mail rh@ nas três listas')
    topo = p.inner_text('#obrigatorios')
    ok('só é enviado completo' in topo and all(x in topo for x in ('Exame médico admissional (ASO)', 'Documento com foto (RG ou CNH), frente e verso', 'Comprovante de endereço',
       'Salário mensal ou por hora', 'Horário diário de trabalho', 'Dias de trabalho', 'Dias de folga', 'Tipo de Contrato', 'Grau de Instrução', 'Raça/cor', 'Estado Civil'))
       and 'Prazo do contrato' not in topo, '4. o aviso do alto diz o que tem de ser anexado e preenchido')
    ok(p.is_disabled('#btnEnviar') and 'Faltam 20 itens para liberar o envio' in p.inner_text('#pendencias') and len(faltam(p)) == 20, '4. formulário em branco: botão de enviar desligado e os 20 itens que faltam')
    f0 = faltam(p)
    ok(f0[0] == 'Preencher: Empresa (razão social)' and 'Anexar: Exame médico admissional (ASO)' in f0 and 'Anexar: Documento com foto (RG ou CNH), frente e verso (frente)' in f0
       and 'Anexar: Documento com foto (RG ou CNH), frente e verso (verso)' in f0 and 'Anexar: Comprovante de endereço' in f0 and 'Escolher: Raça/cor' in f0
       and 'Preencher: Dias de folga' in f0 and f0[-1] == 'Marcar: A empresa declara estar ciente', '4. a lista diz o que fazer em cada item, na ordem do formulário')
    forcar(p); p.wait_for_timeout(200)
    ok(not log(p, 'enviar'), '4. nada enviado com o botão desligado')
    ok(p.locator('.campo[data-i="12"]').is_hidden() and p.locator('.campo[data-i="13"]').is_hidden() and not any('Prazo' in x for x in f0), '4. o prazo da experiência não aparece antes de escolher o contrato')
    p.screenshot(path=str(FOTOS / 'admissoes-link-claro.png'), full_page=True)

    # o prazo da experiência: só com o contrato de experiência
    preencher(p, contrato='Indeterminado')
    ok(p.locator('.campo[data-i="12"]').is_hidden() and faltam(p) == ['Anexar: Exame médico admissional (ASO)', 'Anexar: Documento com foto (RG ou CNH), frente e verso (frente)',
       'Anexar: Documento com foto (RG ou CNH), frente e verso (verso)', 'Anexar: Comprovante de endereço'] and p.is_disabled('#btnEnviar'),
       '4. tudo escrito e nada anexado: faltam os 4 anexos e o botão segue desligado (contrato indeterminado não pede prazo)')
    p.check('input[name="q11"][value="Experiência"]'); p.wait_for_timeout(100)
    ok(p.locator('.campo[data-i="12"]').is_visible() and 'Escolher: Prazo do contrato de experiência' in faltam(p) and p.locator('.campo[data-i="13"]').is_hidden(), '4. com "Experiência", o prazo aparece e passa a faltar')
    p.check('input[name="q12"][value="Outro prazo"]'); p.wait_for_timeout(100)
    ok(p.locator('.campo[data-i="13"]').is_visible() and 'Preencher: Qual o prazo do contrato de experiência?' in faltam(p), '4. com "Outro prazo", falta dizer qual')
    p.check('input[name="q12"][value="45 + 45 dias"]'); p.wait_for_timeout(100)
    ok(p.locator('.campo[data-i="13"]').is_hidden() and len(faltam(p)) == 4, '4. com um prazo da lista, o "qual o prazo" some')

    # os anexos obrigatórios: um lugar por documento
    p.locator('#pendencias .pend-item', has_text='Comprovante de endereço').click(); p.wait_for_timeout(500)
    ok('falta' in p.get_attribute('[data-vaga="2-2"]', 'class') and p.inner_text('[data-st="2-2"]') == 'obrigatório', '4. clicar no item que falta leva ao lugar de anexar, marcado')
    anexar(p, '2-0', ('aso.pdf', 'application/pdf', PDF()))
    anexar(p, '2-1-f', ('rg-frente.jpg', 'image/jpeg', b'\xff' * (3 * 1024 * 1024)), ('sobra.pdf', 'application/pdf', PDF(5000)))
    ok(p.locator('[id="anx2-1-f"] .anexo-item').count() == 2 and '3 MB' in p.inner_text('[id="anx2-1-f"]') and p.inner_text('[data-st="2-0"]') == '✓ anexado'
       and 'feito' in p.get_attribute('[data-vaga="2-0"]', 'class'), '4. anexos listados com o tamanho; o lugar preenchido fica "✓ anexado"')
    p.locator('[id="anx2-1-f"] [data-tira="2-1-f:1"]').click(); p.wait_for_timeout(100)
    ok(p.locator('[id="anx2-1-f"] .anexo-item').count() == 1, '4. tirar um anexo')
    anexar(p, '2-2', ('luz.pdf', 'application/pdf', PDF(500)))
    ok('falta' not in p.get_attribute('[data-vaga="2-2"]', 'class') and faltam(p) == ['Anexar: Documento com foto (RG ou CNH), frente e verso (verso)'] and p.is_disabled('#btnEnviar')
       and 'Falta 1 item' in p.inner_text('#pendencias'), '4. só com a frente do documento não libera: falta o verso')
    p.check('input[data-mesmo="2-1"]'); p.wait_for_timeout(100)
    ok(p.is_enabled('#btnEnviar') and 'Tudo preenchido e anexado' in p.inner_text('#pendencias') and p.inner_text('[data-st="2-1-v"]') == 'no arquivo da frente'
       and p.locator('[data-vaga="2-1-v"] .anexo-btn').is_hidden(), '4. "a frente e o verso estão no mesmo arquivo" dispensa o verso e libera o envio')
    p.uncheck('input[data-mesmo="2-1"]'); p.wait_for_timeout(100)
    ok(p.is_disabled('#btnEnviar'), '4. desmarcou: o verso volta a faltar')
    anexar(p, '2-1-v', ('rg-verso.jpg', 'image/jpeg', b'\xff' * 600))
    ok(p.is_enabled('#btnEnviar') and p.is_disabled('input[data-mesmo="2-1"]'), '4. com o verso anexado, tudo certo (a caixa "no mesmo arquivo" não se aplica mais)')
    p.fill('input[name="q5"]', '   '); p.wait_for_timeout(100)
    ok(p.is_disabled('#btnEnviar') and faltam(p) == ['Preencher: Salário mensal ou por hora'], '4. apagou o salário: o botão desliga de novo')
    p.locator('#pendencias .pend-item').click(); p.wait_for_timeout(400)
    ok('falta' in p.get_attribute('.campo[data-i="5"]', 'class') and p.evaluate("() => document.activeElement && document.activeElement.name") == 'q5', '4. o item que falta leva ao campo, marcado em vermelho e com o cursor nele')
    p.fill('input[name="q5"]', 'R$ 2.000,00 mensal'); p.wait_for_timeout(100)
    ok('falta' not in (p.get_attribute('.campo[data-i="5"]', 'class') or '') and p.is_enabled('#btnEnviar'), '4. preenchido, a marca some e o botão liga')
    anexar(p, '3', ('ctps.pdf', 'application/pdf', PDF(5000)))
    anexar(p, '14', ('certidao.png', 'image/png', b'\x89PNG' + b'1' * 900))
    p.screenshot(path=str(FOTOS / 'admissoes-link-completo-claro.png'), full_page=True)
    p.click('#btnEnviar'); p.wait_for_timeout(1500)
    env = log(p, 'enviar'); a = env[0][1] if env else {}
    r = {x['id']: x for x in a.get('respostas', [])}
    ok(len(env) == 1 and a.get('empresa') == 'Comércio Modelo' and a.get('contato') == 'Contato de Teste' and 'documento' not in a
       and 'whatsapp' not in a, '4. envia a empresa e quem preencheu (sem CNPJ e sem WhatsApp)')
    ok(len(r) == 15 and r.get('nome', {}).get('valor') == 'FULANA DE TESTE' and r.get('data_inicio', {}).get('valor') == dia(10)
       and r.get('tipo_contrato', {}).get('valor') == 'Experiência' and r.get('prazo_experiencia', {}).get('valor') == '45 + 45 dias' and 'prazo_experiencia_outro' not in r
       and r.get('dias_trabalho', {}).get('valor') == 'segunda a sexta' and r.get('dias_folga', {}).get('valor') == 'sábado e domingo', '4. envia as 15 respostas com o valor certo (o "qual o prazo", escondido, não vai)')
    ok(r.get('ciente_menor', {}).get('valor') == 'Sim' and 'menores de dezesseis' in r.get('ciente_menor', {}).get('texto', ''), '4. declaração vai com o texto declarado')
    DOC = 'Documento com foto (RG ou CNH), frente e verso'
    ok([(x['nome'], x['grupo']) for x in a.get('arquivos', [])] == [('aso.pdf', 'Exame médico admissional (ASO)'), ('rg-frente.jpg', DOC + ' (frente)'), ('rg-verso.jpg', DOC + ' (verso)'),
       ('luz.pdf', 'Comprovante de endereço'), ('ctps.pdf', 'Outros documentos'), ('certidao.png', 'Documentos e informações para salário família')]
       and a['arquivos'][1]['tamanho'] == 3 * 1024 * 1024, '4. avisa os 6 anexos, cada um com o documento dele (nome, tamanho e de qual documento)')
    arqs = log(p, 'arquivo'); partes = log(p, 'parte')
    ok([x[1]['nome'] for x in arqs] == ['aso.pdf', 'rg-frente.jpg', 'rg-verso.jpg', 'luz.pdf', 'ctps.pdf', 'certidao.png'] and all(x[1]['chave'] == 'CHAVE' for x in arqs)
       and arqs[1][1]['grupo'] == DOC + ' (frente)', '4. abre cada anexo no Drive com a chave do envio')
    ok([(x[1], x[2], x[3]) for x in partes] == [('0', 0, 804), ('1', 0, 2 * 1024 * 1024), ('1', 2 * 1024 * 1024, 1024 * 1024), ('2', 0, 600), ('3', 0, 504), ('4', 0, 5004), ('5', 0, 904)],
       '4. anexo de 3 MB sobe em 2 partes (2 MB + 1 MB); os pequenos, numa só')
    ok(len(log(p, 'concluir')) == 1, '4. fecha o envio no fim')
    txt = p.inner_text('#app')
    ok('Informações recebidas' in txt and '6 arquivos enviados' in txt and modelo['final'][:30] in txt, '4. mensagem final com a contagem dos anexos')
    p.screenshot(path=str(FOTOS / 'admissoes-link-enviado-claro.png'), full_page=True)
    p.click('#btnOutro'); p.wait_for_timeout(300)
    ok(p.input_value('#id_empresa') == 'Comércio Modelo' and p.input_value('#id_contato') == 'Contato de Teste' and p.input_value('input[name="q0"]') == ''
       and p.locator('.anexo-item').count() == 0, '4. "Enviar outro funcionário" mantém a empresa e limpa o resto (anexos também)')
    ok(p.is_disabled('#btnEnviar') and len(faltam(p)) == 18, '4. no outro funcionário, o botão volta desligado (faltam 18: a empresa e quem preenche já estão)')

    # frente e verso no mesmo arquivo: o verso dispensado vai dito nas respostas
    preencher(p, contrato='Indeterminado')
    anexar(p, '2-0', ('aso2.pdf', 'application/pdf', PDF())); anexar(p, '2-1-f', ('cnh-digital.pdf', 'application/pdf', PDF(900))); anexar(p, '2-2', ('agua.pdf', 'application/pdf', PDF(300)))
    p.check('input[data-mesmo="2-1"]'); p.wait_for_timeout(100)
    p.click('#btnEnviar'); p.wait_for_timeout(1200)
    a = log(p, 'enviar')[-1][1]; r = {x['id']: x for x in a.get('respostas', [])}
    ok(len(log(p, 'enviar')) == 2 and r.get('anexo_2-1-v', {}).get('valor') == 'No mesmo arquivo da frente' and r['anexo_2-1-v']['rotulo'] == DOC + ' (verso)' and r['anexo_2-1-v']['secao'] == 'Documentos obrigatórios'
       and 'prazo_experiencia' not in r and [x['nome'] for x in a['arquivos']] == ['aso2.pdf', 'cnh-digital.pdf', 'agua.pdf'], '4. frente e verso no mesmo arquivo: envia, e as respostas dizem que o verso está no arquivo da frente')
    p.close()

    p = pagina(form, falha_parte='aso.pdf')
    preencher(p); anexar_obrigatorios(p); p.click('#btnEnviar'); p.wait_for_timeout(1000)
    txt = p.inner_text('#app')
    ok('3 arquivos enviados' in txt and 'Não conseguimos enviar: aso.pdf' in txt and 'rh@macedoereis.com.br' in txt, '4. anexo que não sobe: avisa qual e pede por e-mail'); p.close()

    p = pagina('{ error: "Formulário indisponível." }')
    ok('Formulário indisponível' in p.inner_text('#app'), '4. sem formulário no banco, avisa'); p.close()
    p = pagina(form, enviar='{ error: "Muitos envios agora — tente de novo mais tarde." }')
    preencher(p); anexar_obrigatorios(p); p.click('#btnEnviar'); p.wait_for_timeout(400)
    ok('Muitos envios agora' in p.inner_text('#msgErro') and p.locator('#btnEnviar').count() == 1 and p.is_enabled('#btnEnviar') and p.inner_text('#btnEnviar') == 'Enviar informações'
       and p.locator('.anexo-item').count() == 4, '4. "muitos envios" avisado sem perder o preenchido (o botão volta ligado)'); p.close()

    # arquivo grande demais num lugar obrigatório: não entra, e o aviso manda falar com o escritório
    p = pagina(form)
    anexar(p, '2-0', ('enorme.pdf', 'application/pdf', b'0' * (25 * 1024 * 1024 + 1)))
    ok(p.locator('[id="anx2-0"] .anexo-item').count() == 0 and 'enorme.pdf passa de 25 MB' in p.inner_text('[id="anxErr2-0"]') and 'fale com o escritório' in p.inner_text('[id="anxErr2-0"]')
       and p.inner_text('[data-st="2-0"]') == 'obrigatório', '4. arquivo acima de 25 MB não entra no lugar obrigatório (segue faltando)'); p.close()

    # o formulário de antes (sem as marcas novas) segue como era: uma lista, um lugar de anexar, e envia sem anexo
    antigo = {**publicado, 'blocos': [
        {'tipo': 'pergunta', 'id': 'nome', 'rotulo': 'Nome', 'formato': 'texto', 'obrigatoria': True},
        {'tipo': 'documentos', 'titulo': 'Documentos', 'texto': '', 'condicional': False, 'itens': ['RG, CPF e Título eleitoral', 'Endereço Completo'], 'nota': ''},
        {'tipo': 'pergunta', 'id': 'obs', 'rotulo': 'Observação', 'formato': 'texto_longo', 'obrigatoria': False}]}
    p = pagina(json.dumps(antigo, ensure_ascii=False))
    ok(p.locator('input[type=file][data-anexo]').count() == 1 and p.locator('.vaga').count() == 0 and p.is_disabled('#btnEnviar') and len(faltam(p)) == 3
       and 'Anexar' not in p.inner_text('#obrigatorios'), '4. formulário sem as marcas novas: uma lista de documentos, um lugar de anexar, nada de anexo obrigatório')
    p.fill('#id_empresa', 'Comércio Modelo'); p.fill('#id_contato', 'Contato'); p.fill('input[name="q0"]', 'FULANO'); p.wait_for_timeout(100)
    ok(p.is_enabled('#btnEnviar'), '4. nele, as perguntas obrigatórias bastam pra liberar o envio')
    p.click('#btnEnviar'); p.wait_for_timeout(800)
    a = (log(p, 'enviar') or [[None, {}]])[0][1]
    ok([x['id'] for x in a.get('respostas', [])] == ['nome', 'obs'] and a.get('arquivos') == [] and 'Informações recebidas' in p.inner_text('#app'), '4. e envia como antes, sem anexo'); p.close()

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
