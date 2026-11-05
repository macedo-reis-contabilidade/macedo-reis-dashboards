"""Teste da abertura de MEI (04/11/2026, pedido do Samuel): o link público (mei.html), que só fala com a Edge Function
mei-link — aqui quem responde é o teste, por window.__mockInvoke —, e a ficha no Societário (societario-mei.html), com o
mock do banco (dados inventados). As regras puras e a função têm teste próprio em tests/mei-abertura.test.mjs.

    python tests/harness/mei.py

Confere:
  1. o link: o aviso do gov.br (prata ou ouro, sem pedir a senha), os blocos do formulário e nenhum campo de senha;
     enviar vazio marca o que falta (o nome completo, o CPF que não confere, o e-mail, as respostas, as formas, o endereço);
     os "se" (qual empresa; o endereço do negócio quando é outro) aparecem com a resposta;
  2. o envio: o pedido vai conferido (o CPF e o telefone só com os dígitos), os documentos sobem em partes depois, com a
     chave, e a tela de recebido diz quantos foram e lembra do gov.br; o que o Drive recusou, a página diz;
  3. a ficha: a lista (A fazer, com a sugestão e os alertas), o texto que veio de fora aparece como texto, a ficha com os
     avisos, a sugestão de CNAE (a principal, as secundárias, os alertas da IA), as respostas e os documentos com o link do
     Drive; "Sugerir de novo" chama a função com o login; "Copiar o link" do formulário;
  4. marcar como aberta com o CNPJ: grava a situação, o CNPJ e quem abriu; o CNPJ errado barra; ?mei=<id> abre a ficha;
  5. o hub do Societário tem o card, com os pedidos a fazer.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

ID = '11111111-2222-4333-8444-555555555555'
SUG = {'pode_ser_mei': True, 'principal': {'numero': 91, 'cnae': '4781-4/00', 'ocupacao': 'Comerciante de artigos do vestuário e acessórios', 'tabela': 'A', 'porque': 'vende roupas'},
       'secundarios': [{'numero': 108, 'cnae': '4782-2/01', 'ocupacao': 'Comerciante de calçados', 'tabela': 'A', 'porque': 'também sapatos'},
                       {'numero': 459, 'cnae': '4930-2/01', 'ocupacao': 'TRANSPORTADOR AUTÔNOMO DE CARGA - MUNICIPAL', 'tabela': 'B', 'porque': 'faz frete'}],
       'alertas': ['Confira se vende em feira com licença da prefeitura.'],
       'resumo': 'Comércio de roupas pela internet e em feiras.', 'modelo': 'claude-sonnet-5-5', 'em': '2026-11-04T14:00:00Z', 'lista': '2026-11-04'}
PEDIDO = {'nome': 'MARIA DE TESTE <b>X</b>', 'cpf': '52998224725', 'telefone': '51999990000', 'email': 'maria@exemplo.com', 'empresa': 'tem', 'empresaQual': 'Loja Antiga',
          'seguro': 'sim', 'irpf': 'sim', 'atividade': 'Vendo roupas <img src=x onerror="window.__xss=1"> pela internet', 'formas': ['internet', 'porta_a_porta'],
          'fantasia': '', 'capital': None, 'residencial': {'cep': '95660000', 'logradouro': 'Rua das Flores', 'numero': '100', 'complemento': '', 'bairro': 'Centro', 'cidade': 'Três Coroas', 'uf': 'RS'},
          'mesmoEndereco': 'sim', 'comercial': None, 'obs': ''}
ABERTURAS = [
    {'id': 'mei-1', 'criado_em': '2026-11-04T13:00:00Z', 'situacao': 'recebida', 'nome': PEDIDO['nome'], 'cpf': '52998224725', 'telefone': '51999990000', 'email': 'maria@exemplo.com',
     'pedido': PEDIDO, 'alertas': ['Tem empresa aberta no nome (Loja Antiga): quem é titular, sócio ou administrador de outra empresa não pode ser MEI. Confira antes de abrir.'],
     'atividade': PEDIDO['atividade'], 'cnaes_sugeridos': SUG, 'cnpj': None, 'drive_pasta_url': 'https://drive.google.com/drive/folders/PASTA_MEI_1',
     'arquivos': [{'nome': 'rg-frente.jpg', 'status': 'ok', 'drive_id': 'ARQUIVO_RG_FRENTE_1'}, {'nome': 'comprovante.pdf', 'status': 'erro'}], 'responsavel': 'Samuel',
     'tarefa_id': 'tm-1', 'observacoes': None, 'concluida_em': None, 'concluida_por': None},
    {'id': 'mei-2', 'criado_em': '2026-10-20T13:00:00Z', 'situacao': 'aberta', 'nome': 'JOAO DE TESTE', 'cpf': '11144477735', 'telefone': '51988887777', 'email': 'joao@exemplo.com',
     'pedido': {**PEDIDO, 'nome': 'JOAO DE TESTE', 'empresa': 'nao', 'seguro': 'nao', 'atividade': 'Conserto de bicicletas'}, 'alertas': [], 'atividade': 'Conserto de bicicletas',
     'cnaes_sugeridos': None, 'cnpj': '12.345.678/0001-90', 'drive_pasta_url': None, 'arquivos': [], 'responsavel': 'Samuel', 'tarefa_id': None, 'observacoes': 'ok',
     'concluida_em': '2026-10-22T13:00:00Z', 'concluida_por': 'financeiro@macedoereis.com.br'}]
SEMEAR = """
(() => { const A = %s; let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) { db = v; v.aberturas_mei = A; } });
  window.__log = [];
  window.__mockInvoke = async (nome, opts) => { window.__log.push([nome, JSON.parse(JSON.stringify(opts.body || {}))]);
    if (opts.body && opts.body.acao === 'sugerir') return { data: { ok: true, sugestao: { ...%s, resumo: 'Sugestão refeita.' } }, error: null };
    return { data: null, error: { message: 'ação' } }; };
})();
""" % (json.dumps(ABERTURAS, ensure_ascii=False), json.dumps(SUG, ensure_ascii=False))
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
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        # 1) e 2) o link público
        print('1. O link público')
        p = b.new_page(viewport={'width': 420, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'link: {e}'))
        p.add_init_script("""window.__log = []; window.__arquivoAtual = {};
window.__mockInvoke = async (nome, opts) => {
  const h = opts.headers || {};
  if (h['x-acao'] === 'parte') {
    window.__log.push(['parte', { i: h['x-i'], inicio: Number(h['x-inicio']), tamanho: opts.body.size, total: Number(h['x-total']), chave: h['x-chave'], id: h['x-id'] }]);
    if (window.__arquivoAtual[h['x-i']] === 'ruim.pdf') return { data: { error: 'O Drive recusou o arquivo.' }, error: null };
    return { data: { ok: true }, error: null };
  }
  const b = opts.body || {};
  window.__log.push([nome, JSON.parse(JSON.stringify(b))]);
  if (b.acao === 'enviar') return { data: { ok: true, id: '%s', chave: 'chave-de-teste' }, error: null };
  if (b.acao === 'arquivo') { window.__arquivoAtual[String(b.i)] = b.nome; return { data: { ok: true }, error: null }; }
  if (b.acao === 'concluir') return { data: { ok: true }, error: null };
  return { data: null, error: { message: 'ação ' + b.acao } };
};""" % ID)
        p.goto(base + 'mei.html'); p.wait_for_timeout(1000)
        cab = p.inner_text('.cab')
        ok('prata ou ouro' in cab and 'Não pedimos a sua senha' in cab, f'o aviso do gov.br, sem pedir a senha ({cab[:120]!r})')
        ok(p.locator('input[type=password]').count() == 0 and all(p.locator(f'#id_{k}').count() == 1 for k in ('nome', 'cpf', 'telefone', 'email', 'atividade', 'residencial_cep')),
           'os campos do formulário, nenhum de senha')
        p.click('#btnEnviar'); p.wait_for_timeout(300)
        faltas = p.eval_on_selector_all('.campo.falta', 'cs => cs.map(c => c.dataset.id)')
        ok(all(k in faltas for k in ('nome', 'cpf', 'telefone', 'email', 'empresa', 'seguro', 'irpf', 'atividade', 'formas', 'residencial.cep', 'mesmoEndereco')) and 'Faltam' in p.inner_text('#msgErro')
           and not [x for x in p.evaluate('() => window.__log') if x[1].get('acao') == 'enviar'], f'enviar vazio: marca o que falta e não envia ({faltas})')
        p.fill('#id_nome', 'Maria'); p.fill('#id_cpf', '111.111.111-11'); p.fill('#id_telefone', '(51) 99999-0000'); p.fill('#id_email', 'maria@exemplo.com')
        p.click('#btnEnviar'); p.wait_for_timeout(200)
        faltas = p.eval_on_selector_all('.campo.falta', 'cs => cs.map(c => c.dataset.id)')
        ok('nome' in faltas and 'cpf' in faltas and 'telefone' not in faltas and 'Escreva o nome completo' in p.inner_text('.campo[data-id="nome"]') and 'Confira o CPF' in p.inner_text('.campo[data-id="cpf"]'),
           'o nome sem sobrenome e o CPF que não confere são marcados, com a frase de cada um')
        p.fill('#id_nome', 'Maria da Silva'); p.fill('#id_cpf', '529.982.247-25')
        ok(not p.is_visible('#blEmpresa'), 'o "qual empresa" começa escondido')
        p.check('input[name="empresa"][value="teve"]'); p.wait_for_timeout(100)
        ok(p.is_visible('#blEmpresa'), 'já teve empresa: pergunta qual')
        p.fill('#id_empresaQual', 'Loja Antiga')
        p.check('input[name="seguro"][value="nao"]'); p.check('input[name="irpf"][value="sim"]')
        p.fill('#id_atividade', 'Vendo roupas pela internet e em feiras')
        p.check('input[name="formas"][value="internet"]'); p.check('input[name="formas"][value="porta_a_porta"]')
        p.fill('#id_residencial_cep', '95660-000'); p.fill('#id_residencial_logradouro', 'Rua das Flores'); p.fill('#id_residencial_numero', '100')
        p.fill('#id_residencial_bairro', 'Centro'); p.fill('#id_residencial_cidade', 'Três Coroas')
        ok(p.input_value('#id_residencial_uf') == 'RS', 'o estado já vem no RS')
        p.check('input[name="mesmoEndereco"][value="nao"]'); p.wait_for_timeout(100)
        ok(p.is_visible('#blComercial'), 'o negócio em outro endereço: pede o endereço comercial')
        p.check('input[name="mesmoEndereco"][value="sim"]'); p.wait_for_timeout(100)
        ok(not p.is_visible('#blComercial'), 'no mesmo endereço: o comercial some')
        p.set_input_files('#id_arquivos', [{'name': 'rg.jpg', 'mimeType': 'image/jpeg', 'buffer': b'x' * (3 * 1024 * 1024)},
                                            {'name': 'ruim.pdf', 'mimeType': 'application/pdf', 'buffer': b'y' * 1000}])
        ok(p.locator('#anxLista .anexo-item').count() == 2, 'os dois documentos na lista')
        p.screenshot(path=str(FOTOS / 'mei-link-claro.png'), full_page=True)
        print('2. O envio')
        p.click('#btnEnviar'); p.wait_for_selector('.aviso', timeout=8000)
        env = [x[1] for x in p.evaluate('() => window.__log') if x[1].get('acao') == 'enviar']
        e = env[0] if env else {}
        ok(len(env) == 1 and e.get('nome') == 'Maria da Silva' and e.get('cpf') == '529.982.247-25' and e.get('empresa') == 'teve' and e.get('empresaQual') == 'Loja Antiga'
           and e.get('formas') == ['internet', 'porta_a_porta'] and e.get('residencial', {}).get('cidade') == 'Três Coroas' and len(e.get('arquivos', [])) == 2,
           f'o pedido vai com as respostas e a lista dos documentos ({json.dumps(e, ensure_ascii=False)[:300]})')
        partes = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'parte']
        ok(len([x for x in partes if x['i'] == '0']) == 2 and all(x['chave'] == 'chave-de-teste' and x['id'] == ID for x in partes), f'o documento de 3 MB sobe em 2 partes, com a chave ({len(partes)} partes)')
        ok([x[1] for x in p.evaluate('() => window.__log') if x[1].get('acao') == 'concluir'], 'o envio fecha no fim')
        fim = p.inner_text('.aviso')
        ok('Pedido recebido' in fim and '1 documento enviado' in fim and 'ruim.pdf' in fim and 'prata ou ouro' in fim, f'recebido: quantos foram, o que o Drive recusou, o lembrete do gov.br ({fim[:200]!r})')
        p.close()

        # 3) e 4) a ficha
        print('3. A ficha no Societário')
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'ficha: {e}'))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.goto(base + 'societario-mei.html'); p.wait_for_selector('.mm-card', timeout=6000)
        cards = p.eval_on_selector_all('.mm-card', 'cs => cs.map(c => c.innerText)')
        ok(len(cards) == 1 and 'MARIA DE TESTE <b>X</b>' in cards[0] and 'Recebida' in cards[0] and '4781-4/00' in cards[0] and '2 alertas' in cards[0], f'A fazer: o pedido recebido, com a sugestão e os alertas ({cards})')
        ok(p.evaluate('window.__xss') is None and p.locator('.mm-card b').count() == 0, 'o texto que veio de fora aparece como texto')
        ok(p.inner_text('#cAfazer') == '1' and p.inner_text('#cAberta') == '1' and p.inner_text('#cTodos') == '2', 'os números do alto')
        ok(p.inner_text('#linkForm').endswith('/mei.html'), 'o link do formulário aparece pra copiar')
        p.click('.mm-card'); p.wait_for_selector('#ovFicha.is-open', timeout=3000)
        ficha = p.inner_text('#ovFicha')
        ok('Antes de abrir' in ficha and 'não pode ser MEI' in ficha, 'a ficha: os avisos de antes de abrir')
        ok('4781-4/00' in ficha and 'Comerciante de artigos do vestuário' in ficha and 'principal' in ficha and '4782-2/01' in ficha and 'licença da prefeitura' in ficha and 'Portal do Empreendedor' in ficha,
           'a sugestão: a principal, a secundária, os alertas da IA e o "a conferir no Portal"')
        sug = p.inner_text('#fSugestao')
        ok(sug.count('Tabela B · MEI caminhoneiro') == 1 and 'lista oficial lida em 04/11/2026' in sug
           and p.get_attribute('.mm-sug a[href*="atividades-permitidas"]', 'href') == 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei/atividades-permitidas',
           'a ocupação da Tabela B marcada (o MEI caminhoneiro), o dia da lista oficial e o link dela')
        ok('Forma de atuação' in ficha and 'Internet, Porta a porta' in ficha and '529.982.247-25' in ficha and 'O mesmo do residencial' in ficha, 'as respostas como texto, com o CPF e o endereço')
        ok(p.get_attribute('#fDocs a[href*="ARQUIVO_RG_FRENTE_1"]', 'href') == 'https://drive.google.com/file/d/ARQUIVO_RG_FRENTE_1/view' and 'não chegou' in p.inner_text('#fDocs')
           and p.locator('#fDocs a[href*="PASTA_MEI_1"]').count() == 1, 'os documentos: o que chegou com o link do Drive, o que não chegou, a pasta')
        ok(p.get_attribute('#btnTarefa', 'href') == 'agenda.html?tarefa=tm-1', 'o link da tarefa na agenda')
        p.screenshot(path=str(FOTOS / 'mei-ficha.png'))
        p.click('#btnSugerir'); p.wait_for_function("() => document.querySelector('#fSugestao').innerText.includes('Sugestão refeita.')", timeout=5000)
        chamadas = [x for x in p.evaluate('() => window.__log') if x[0] == 'mei-link']
        ok(chamadas and chamadas[-1][1] == {'acao': 'sugerir', 'id': 'mei-1'}, '"Sugerir de novo" chama a função com o pedido (o login vai junto)')
        print('4. Marcar como aberta')
        p.select_option('#fSituacao', 'aberta'); p.fill('#fCnpj', '12.345')
        p.click('#btnSalvar'); p.wait_for_timeout(300)
        ok('Confira o CNPJ' in p.inner_text('#fErro'), 'o CNPJ errado barra')
        p.fill('#fCnpj', '55.666.777/0001-88'); p.fill('#fObs', 'Aberto no Portal.')
        p.click('#btnSalvar'); p.wait_for_timeout(500)
        a = p.evaluate("() => window.__mockDb.aberturas_mei.find(x => x.id === 'mei-1')")
        ok(a['situacao'] == 'aberta' and a['cnpj'] == '55.666.777/0001-88' and a['observacoes'] == 'Aberto no Portal.' and a['concluida_por'] == 'financeiro@macedoereis.com.br' and a['concluida_em'],
           f'aberta: grava a situação, o CNPJ, a observação e quem abriu ({ {k: a[k] for k in ("situacao", "cnpj", "concluida_por")} })')
        ok(p.inner_text('#cAfazer') == '0' and p.inner_text('#cAberta') == '2', 'os números acompanham')
        p.close()
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'ficha: {e}'))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.goto(base + 'societario-mei.html?mei=mei-2'); p.wait_for_selector('#ovFicha.is-open', timeout=6000)
        ok('JOAO DE TESTE' in p.inner_text('#fTitulo') and 'sendo preparada' in p.inner_text('#fSugestao'), '?mei= abre a ficha; sem a sugestão ainda, diz')
        p.close()

        # 5) o hub
        print('5. O hub do Societário')
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(f'hub: {e}'))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.goto(base + 'societario.html'); p.wait_for_timeout(1500)
        card = p.locator('a.dashboard-card[href="societario-mei.html"]')
        ok(card.count() == 1 and 'Aberturas de MEI' in card.inner_text() and '1 a fazer' in card.inner_text().lower(), f'o card, com os pedidos a fazer ({card.inner_text() if card.count() else ""!r})')
        p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
