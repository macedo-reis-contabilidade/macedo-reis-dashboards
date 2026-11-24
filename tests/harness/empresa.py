"""Teste do formulário da constituição de CNPJ e da transformação do MEI em ME (24/11/2026, pedido do Samuel): o link
público (empresa.html?t=constituicao ou ?t=transformacao), que só fala com a Edge Function empresa-link — aqui quem
responde é o teste, por window.__mockInvoke — e não tem login. As regras puras e a função têm teste próprio em
tests/empresa-pedido.test.mjs. Os dados são inventados.

    python tests/harness/empresa.py

Confere:
  1. a abertura de empresa: o título, o aviso do gov.br (prata ou ouro, sem pedir a senha), nenhum campo de senha, sem o
     CNPJ do MEI, sem o assistente e sem os atalhos; com um sócio, sem a participação e sem o "Tirar";
  2. enviar vazio marca o que falta (os seus dados, a empresa, o endereço, cada campo do sócio e o documento dele) e não
     envia; a 2ª razão social igual à 1ª e a área utilizada maior que a total são marcadas, com a frase de cada uma;
  3. os sócios: o 2º mostra a participação, quem administra e a soma (que avisa quando não dá 100%); casado pergunta o
     regime de bens; "Mora no endereço da empresa" esconde o endereço; tirar o sócio do meio renumera; o CEP preenche a
     rua, o bairro e a cidade; "O telefone e o e-mail da empresa são os meus" copia os dois; sem o documento de um sócio,
     o envio não sai; o nome do arquivo aparece como texto;
  4. o envio: o pedido vai com as respostas e os anexos na ordem dos sócios da tela (o documento do sócio que ficou em 2º
     vai como o do 2º); o documento de 3 MB sobe em 2 partes, com a chave; o envio fecha no fim; a tela de recebido diz
     quantos foram, o que não subiu e lembra do gov.br;
  5. a transformação: o título, o CNPJ do MEI (o errado é marcado) e o tipo no pedido;
  6. a função que recusa (a trava de envios por hora): a frase dela aparece e o botão volta;
  7. a tela do celular (400 px) não rola de lado; o ?t= desconhecido abre a abertura de empresa.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

ID = '22222222-3333-4444-8555-666666666666'
MOCK = """window.__log = []; window.__arquivos = [];
window.__mockInvoke = async (nome, opts) => {
  const h = opts.headers || {};
  if (h['x-acao'] === 'parte') {
    window.__log.push(['parte', { i: h['x-i'], inicio: Number(h['x-inicio']), tamanho: opts.body.size, total: Number(h['x-total']), chave: h['x-chave'], id: h['x-id'] }]);
    const a = window.__arquivos[Number(h['x-i'])] || {};
    if (a.nome === 'ruim.pdf') return { data: { error: 'O Drive recusou o arquivo.' }, error: null };
    return { data: { ok: true }, error: null };
  }
  const b = opts.body || {};
  window.__log.push([nome, JSON.parse(JSON.stringify(b))]);
  if (b.acao === 'enviar') {
    if (window.__recusar) return { data: { error: 'Muitos envios agora. Tente de novo em alguns minutos.' }, error: null };
    window.__arquivos = b.arquivos || [];
    return { data: { ok: true, id: '%s', chave: 'chave-de-teste' }, error: null };
  }
  if (b.acao === 'arquivo' || b.acao === 'concluir') return { data: { ok: true }, error: null };
  return { data: null, error: { message: 'ação ' + b.acao } };
};""" % ID
VIACEP = json.dumps({'cep': '95660-000', 'logradouro': 'Rua das Flores', 'complemento': '', 'bairro': 'Centro', 'localidade': 'Três Coroas', 'uf': 'RS'})

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def pagina(b, base, url, erros, largura=640):
    p = b.new_page(viewport={'width': largura, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{url}: {e}'))
    p.route('**/viacep.com.br/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=VIACEP))
    p.add_init_script(MOCK)
    p.goto(base + url); p.wait_for_selector('#btnEnviar', timeout=6000)
    return p

def faltas(p):
    return p.eval_on_selector_all('.campo.falta', 'cs => cs.map(c => c.dataset.id)')

def chamadas(p, acao):
    return [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'empresa-link' and x[1].get('acao') == acao]

def arquivo(nome, tamanho, tipo='application/pdf'):
    return {'name': nome, 'mimeType': tipo, 'buffer': b'x' * tamanho}

def empresa(p, transformacao=False):
    p.fill('#id_contato_nome', 'Ana Teste da Silva'); p.fill('#id_contato_telefone', '(51) 99999-0000'); p.fill('#id_contato_email', 'ana@exemplo.com')
    if transformacao: p.fill('#id_cnpjMei', '11.222.333/0001-81')
    p.fill('#id_razao1', 'Loja Exemplo Ltda'); p.fill('#id_razao2', 'Exemplo Modas Ltda')
    p.fill('#id_atividades', 'Loja de roupas femininas e acessórios'); p.fill('#id_capital', '10.000,00')
    p.fill('#id_funcionamento', 'Segunda a sexta, das 9h às 18h'); p.fill('#id_areaTotal', '120'); p.fill('#id_areaUtilizada', '80,5')
    p.fill('#id_endereco_cep', '95660-000')
    p.wait_for_function("() => document.getElementById('id_endereco_logradouro').value === 'Rua das Flores'", timeout=3000)
    p.fill('#id_endereco_numero', '100')
    p.check('#mesmoContato')

def socio(p, vaga, nome, cpf, civil='solteiro', mora=True, gov='sim'):
    p.fill(f'#id_socios_{vaga}_nome', nome); p.fill(f'#id_socios_{vaga}_cpf', cpf); p.fill(f'#id_socios_{vaga}_profissao', 'Comerciante')
    p.select_option(f'#id_socios_{vaga}_estadoCivil', civil)
    if mora: p.check(f'[data-mesmo="{vaga}"]')
    p.check(f'input[name="id_socios_{vaga}_govbr"][value="{gov}"]')

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. A abertura de empresa')
        p = pagina(b, base, 'empresa.html?t=constituicao', erros)
        cab = p.inner_text('.cab')
        ok(p.inner_text('.cab h2') == 'Abertura de empresa' and p.inner_text('#topoSub').startswith('Abertura de empresa') and p.title().startswith('Abertura de empresa'),
           'o título da abertura de empresa (na tela, no alto e na aba)')
        ok('prata ou ouro' in cab and 'Não pedimos a senha' in cab, f'o aviso do gov.br, sem pedir a senha ({cab[-160:]!r})')
        ok(p.locator('input[type=password]').count() == 0 and p.locator('#id_cnpjMei').count() == 0, 'nenhum campo de senha e nada do MEI')
        ok(p.evaluate("() => !document.querySelector('.as-raiz') && !document.querySelector('.tb-atalhos')"), 'sem o assistente e sem os atalhos (é a tela pública)')
        ok(not p.is_visible('#id_socios_0_participacao') and not p.is_visible('[data-tirar="0"]') and not p.is_visible('[data-regime="0"]'),
           'com um sócio: sem a participação, sem o "Tirar" e sem o regime de bens')

        print('2. Enviar vazio')
        p.click('#btnEnviar'); p.wait_for_timeout(300)
        f = faltas(p)
        esperadas = ['contato.nome', 'contato.telefone', 'contato.email', 'razao1', 'razao2', 'atividades', 'capital', 'funcionamento', 'areaTotal', 'areaUtilizada',
                     'empresaTelefone', 'empresaEmail', 'endereco.cep', 'endereco.logradouro', 'endereco.numero', 'endereco.bairro', 'endereco.cidade',
                     'socios.0.nome', 'socios.0.cpf', 'socios.0.estadoCivil', 'socios.0.profissao', 'socios.0.endereco.cep', 'socios.0.govbr', 'socios.0.documento']
        ok(all(k in f for k in esperadas) and 'Faltam' in p.inner_text('#msgErro') and not chamadas(p, 'enviar'),
           f'marca o que falta e não envia (faltou marcar: {[k for k in esperadas if k not in f]})')
        ok('Anexe a CNH ou a identidade deste sócio.' in p.inner_text('.campo[data-id="socios.0.documento"]'), 'o documento do sócio, com a frase dele')
        p.fill('#id_razao1', 'Loja Exemplo Ltda'); p.fill('#id_razao2', 'LOJA EXEMPLO LTDA'); p.fill('#id_areaTotal', '50'); p.fill('#id_areaUtilizada', '80')
        p.click('#btnEnviar'); p.wait_for_timeout(200)
        f = faltas(p)
        ok('razao2' in f and 'razao1' not in f and 'diferente da 1ª' in p.inner_text('.campo[data-id="razao2"]'), 'a 2ª razão social igual à 1ª (sem olhar maiúscula) é marcada')
        ok('areaUtilizada' in f and 'areaTotal' not in f and 'até a área total' in p.inner_text('.campo[data-id="areaUtilizada"]'), 'a área utilizada maior que a total é marcada')
        p.close()

        print('3. Os sócios')
        p = pagina(b, base, 'empresa.html?t=constituicao', erros)
        empresa(p)
        ok(p.input_value('#id_endereco_bairro') == 'Centro' and p.input_value('#id_endereco_cidade') == 'Três Coroas' and p.input_value('#id_endereco_uf') == 'RS',
           'o CEP preenche a rua, o bairro, a cidade e o estado')
        ok(p.input_value('#id_empresaTelefone') == '(51) 99999-0000' and p.input_value('#id_empresaEmail') == 'ana@exemplo.com', '"O telefone e o e-mail da empresa são os meus" copia os dois')
        socio(p, 0, 'Ana Teste da Silva', '529.982.247-25')
        ok(not p.is_visible('[data-end="0"]'), '"Mora no endereço da empresa" esconde o endereço residencial')
        p.click('#maisSocio'); p.click('#maisSocio'); p.wait_for_timeout(100)
        ok(p.locator('.socio').count() == 3 and p.is_visible('#id_socios_0_participacao') and p.is_visible('[data-tirar="0"]') and p.is_visible('#soma'),
           'com mais sócios: a participação, quem administra, o "Tirar" e a soma')
        socio(p, 1, 'Bruno Exemplo Souza', '111.444.777-35')
        socio(p, 2, 'Carla Exemplo Lima', '123.456.789-09', civil='casado', mora=False, gov='bronze')
        ok(p.is_visible('[data-regime="2"]') and not p.is_visible('[data-regime="1"]'), 'casado: pergunta o regime de bens')
        p.select_option('#id_socios_2_regime', 'nao_sei')
        p.fill('#id_socios_2_endereco_cep', '95660-000')
        p.wait_for_function("() => document.getElementById('id_socios_2_endereco_logradouro').value === 'Rua das Flores'", timeout=3000)
        p.fill('#id_socios_2_endereco_numero', '200')
        p.fill('#id_socios_0_participacao', '60'); p.fill('#id_socios_2_participacao', '30')
        p.check('input[name="id_socios_0_administra"][value="sim"]'); p.check('input[name="id_socios_2_administra"][value="nao"]')
        p.click('[data-tirar="1"]'); p.wait_for_timeout(100)
        cabs = p.eval_on_selector_all('.socio-cab b', 'bs => bs.map(x => x.innerText)')
        ok(p.locator('.socio').count() == 2 and cabs == ['Sócio 1', 'Sócio 2'] and p.input_value('#id_socios_2_nome') == 'Carla Exemplo Lima',
           f'tirar o sócio do meio renumera, e o que ficou segue com o que foi digitado ({cabs})')
        soma = p.locator('#soma')
        ok('90%' in soma.inner_text() and 'ruim' in (soma.get_attribute('class') or ''), f'a soma avisa quando não dá 100% ({soma.inner_text()!r})')
        p.fill('#id_socios_2_participacao', '40')
        ok('100%' in soma.inner_text() and 'ruim' not in (soma.get_attribute('class') or ''), 'com 100%, o aviso sai')
        p.click('#btnEnviar'); p.wait_for_timeout(200)
        f = faltas(p)
        ok(f == ['socios.0.documento', 'socios.2.documento'] and not chamadas(p, 'enviar'), f'sem o documento de cada sócio, o envio não sai ({f})')
        p.set_input_files('input[data-grupo="socio-0"]', [arquivo('cnh-ana.pdf', 3 * 1024 * 1024)])
        p.set_input_files('input[data-grupo="socio-2"]', [arquivo('<b>rg</b> carla.jpg', 2000, 'image/jpeg')])
        p.set_input_files('input[data-grupo="outros"]', [arquivo('ruim.pdf', 1000)])
        ok(p.locator('[data-lista="socio-2"] .anexo-item').count() == 1 and p.locator('.anexo-item b').count() == 0 and '<b>rg</b> carla.jpg' in p.inner_text('[data-lista="socio-2"]'),
           'o nome do arquivo aparece como texto')
        ok(p.inner_text('#msgErro') == '' and not faltas(p), 'anexados os documentos que faltavam, a frase de baixo sai')
        geo = p.evaluate("""() => { const ops = document.querySelector('.socio[data-vaga="0"] [data-varios] .ops').getBoundingClientRect();
          const m = document.querySelector('[data-mesmo="0"]').closest('.marca').getBoundingClientRect(); return m.top - ops.bottom; }""")
        ok(geo >= 6, f'"Mora no endereço da empresa" fica embaixo das opções de quem administra, sem encostar ({geo:.0f} px)')
        p.screenshot(path=str(FOTOS / 'empresa-link.png'), full_page=True)

        print('4. O envio')
        p.click('#btnEnviar'); p.wait_for_selector('.aviso', timeout=8000)
        env = chamadas(p, 'enviar')
        e = env[0] if env else {}
        ss = e.get('socios', [])
        ok(len(env) == 1 and e.get('tipo') == 'constituicao' and e.get('razao1') == 'Loja Exemplo Ltda' and e.get('empresaEmail') == 'ana@exemplo.com'
           and e.get('endereco', {}).get('cidade') == 'Três Coroas' and [s['nome'] for s in ss] == ['Ana Teste da Silva', 'Carla Exemplo Lima'],
           f'o pedido vai com as respostas e os dois sócios que ficaram ({json.dumps(e, ensure_ascii=False)[:260]})')
        ok(len(ss) == 2 and ss[0]['endereco'].get('logradouro') == 'Rua das Flores' and ss[0]['endereco'].get('numero') == '100' and ss[1]['endereco'].get('numero') == '200'
           and ss[1]['estadoCivil'] == 'casado' and ss[1]['regime'] == 'nao_sei' and ss[1]['govbr'] == 'bronze' and ss[0]['participacao'] == '60' and ss[1]['participacao'] == '40',
           'quem mora na empresa vai com o endereço dela; o outro, com o dele, o regime e a participação')
        grupos = [(a['nome'], a['grupo']) for a in e.get('arquivos', [])]
        ok(grupos == [('cnh-ana.pdf', 'socio-0'), ('<b>rg</b> carla.jpg', 'socio-1'), ('ruim.pdf', 'outros')],
           f'os anexos na ordem dos sócios da tela: o documento de quem ficou em 2º vai como o do 2º ({grupos})')
        partes = [x[1] for x in p.evaluate('() => window.__log') if x[0] == 'parte']
        ok(len([x for x in partes if x['i'] == '0']) == 2 and all(x['chave'] == 'chave-de-teste' and x['id'] == ID for x in partes)
           and [x['inicio'] for x in partes if x['i'] == '0'] == [0, 2 * 1024 * 1024], f'o documento de 3 MB sobe em 2 partes, com a chave ({len(partes)} partes)')
        arqs = chamadas(p, 'arquivo')
        ok(len(arqs) == 3 and all('nome' not in a and a.get('chave') == 'chave-de-teste' for a in arqs), 'cada anexo abre o envio só com o número dele (o nome a função já tem)')
        ok(len(chamadas(p, 'concluir')) == 1, 'o envio fecha no fim')
        fim = p.inner_text('.aviso')
        ok('Recebido!' in fim and '2 documentos enviados' in fim and 'Não conseguimos enviar: ruim.pdf' in fim and 'prata ou ouro' in fim,
           f'recebido: quantos foram, o que não subiu, o lembrete do gov.br ({fim[:220]!r})')
        p.close()

        print('5. A transformação do MEI em ME')
        p = pagina(b, base, 'empresa.html?t=transformacao', erros)
        ok(p.inner_text('.cab h2') == 'Transformação do MEI em ME' and p.locator('#id_cnpjMei').count() == 1 and 'transformação' in p.inner_text('.cab .intro'),
           'o título e o CNPJ do MEI')
        empresa(p, transformacao=True)
        p.fill('#id_cnpjMei', '11.222.333/0001-82')
        socio(p, 0, 'Ana Teste da Silva', '529.982.247-25')
        p.set_input_files('input[data-grupo="socio-0"]', [arquivo('cnh.pdf', 1500)])
        p.click('#btnEnviar'); p.wait_for_timeout(200)
        ok(faltas(p) == ['cnpjMei'] and 'Confira o CNPJ do MEI.' in p.inner_text('.campo[data-id="cnpjMei"]') and 'Falta 1 resposta' in p.inner_text('#msgErro'),
           'o CNPJ do MEI errado é marcado')
        p.fill('#id_cnpjMei', '11.222.333/0001-81')

        print('6. A função recusa')
        p.evaluate('() => { window.__recusar = true; }')
        p.click('#btnEnviar'); p.wait_for_timeout(500)
        ok('Muitos envios agora' in p.inner_text('#msgErro') and p.inner_text('#btnEnviar') == 'Enviar' and not p.is_disabled('#btnEnviar') and p.locator('.aviso').count() == 0,
           'a frase da função aparece e o botão volta')
        p.evaluate('() => { window.__recusar = false; }')
        p.click('#btnEnviar'); p.wait_for_selector('.aviso', timeout=8000)
        env = chamadas(p, 'enviar')
        ok(len(env) == 2 and env[-1].get('tipo') == 'transformacao' and env[-1].get('cnpjMei') == '11.222.333/0001-81' and '1 documento enviado' in p.inner_text('.aviso'),
           'na segunda vez vai, com o tipo e o CNPJ do MEI')
        p.close()

        print('7. O celular e o endereço sem o produto')
        p = pagina(b, base, 'empresa.html?t=outra-coisa', erros, largura=400)
        p.click('#maisSocio'); p.wait_for_timeout(100)
        largo = p.evaluate('() => document.documentElement.scrollWidth')
        ok(largo <= 400, f'a 400 px a tela não rola de lado ({largo} px)')
        # numa coluna só, cada pergunta embaixo da outra, com folga (a 2ª da linha não pode colar na de baixo)
        pior = p.evaluate("""() => { const r = [...document.querySelectorAll('.campo, .marca')].filter(c => c.offsetParent !== null).map(c => c.getBoundingClientRect());
          let pior = Infinity; for (let i = 1; i < r.length; i++) pior = Math.min(pior, r[i].top - r[i - 1].bottom); return pior; }""")
        ok(pior >= 8, f'a 400 px, uma pergunta embaixo da outra, sem encostar (a menor folga: {pior:.0f} px)')
        ok(p.inner_text('.cab h2') == 'Abertura de empresa' and p.locator('#id_cnpjMei').count() == 0, 'o ?t= desconhecido abre a abertura de empresa')
        p.screenshot(path=str(FOTOS / 'empresa-celular.png'), full_page=True)
        p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
