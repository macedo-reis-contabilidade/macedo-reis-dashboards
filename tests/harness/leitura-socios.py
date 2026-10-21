"""Teste da leitura do contrato com sócio que saiu (21/10/2026): a leitura (Edge Function extract-document) passou a trazer,
além de `socios` (quem é sócio DEPOIS do ato), `socios_retirantes` (quem saiu da sociedade no documento, com o porquê) —
o caso de uma alteração de saída em que um sócio vende todas as cotas pro outro e os dois aparecem qualificados no
preâmbulo. A leitura entra como dublê (window.__mockInvoke), com nomes e CPFs inventados (o repositório é público):
PEDRO VENDEDOR DE TESTE vende as cotas a VALTER COMPRADOR DE TESTE.

    python tests/harness/leitura-socios.py

Confere:
  1. o cadastro com extração (clientes/novo.html): o status conta só o comprador e diz quem ficou de fora ("Fora: …,
     que saiu da sociedade neste documento."), e ao cadastrar só o comprador vira sócio;
  2. a leitura antiga (os dois em socios, 50% + 100%): o status avisa que as participações somam 150%;
  3. o Registrar processo › "Ler o documento e comparar com o cadastro" (clientes/editar.html), com o vendedor no
     cadastro: ele não entra como "Sócio incluído", a remoção dele vem com o porquê ("saiu da sociedade — vendeu…"), com
     a caixa desmarcada como as outras, sem o aviso de "quadro completo"; a participação do comprador vai de 50 pra 100;
  4. sem o vendedor no cadastro: só a linha informativa "Saiu da sociedade neste documento: … — …", sem caixa;
  5. a leitura antiga no comparar: o aviso da soma (150%) antes do confirmar;
  e sem erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CNPJ = '11222333000181'   # o CNPJ de exemplo dos manuais; os CPFs são inválidos de propósito — nada de cliente
VENDEDOR = {'nome': 'PEDRO VENDEDOR DE TESTE', 'cpf': '111.222.333-44', 'participacao_percentual': 50, 'qualificacao': 'Sócio',
            'eh_administrador': False, 'rg': '2222222222 SSP-RS', 'data_nascimento': '1980-09-30', 'estado_civil': 'Casado',
            'nacionalidade': 'Brasileira', 'profissao': 'Empresário', 'endereco_residencial': 'Rua do Vendedor, 14, Centro, Três Coroas - RS, CEP 95660-000'}
COMPRADOR = {'nome': 'VALTER COMPRADOR DE TESTE', 'cpf': '555.666.777-88', 'participacao_percentual': 100, 'qualificacao': 'Sócio Administrador',
             'eh_administrador': True, 'rg': '3333333333 SSP-RS', 'data_nascimento': '2005-10-18', 'estado_civil': 'Solteiro',
             'nacionalidade': 'Brasileira', 'profissao': 'Empresário', 'endereco_residencial': 'Estrada do Comprador, 4250, Interior, Gramado - RS, CEP 95670-000'}
MOTIVO = 'vendeu todas as cotas a VALTER COMPRADOR DE TESTE'
BASE = {'tipo_pessoa': 'PJ', 'documento': CNPJ, 'nome_principal': 'INDUSTRIA DE TESTE LTDA', 'regime_tributario': 'Simples Nacional',
        'cep': '95660000', 'logradouro': 'Rua da Fábrica de Teste', 'numero': '924', 'bairro': 'Centro', 'cidade': 'Três Coroas', 'uf': 'RS',
        'confianca': 'alta', 'observacoes_extracao': None}
NOVA = {**BASE, 'socios': [COMPRADOR], 'socios_retirantes': [{'nome': VENDEDOR['nome'], 'cpf': VENDEDOR['cpf'], 'motivo': MOTIVO}]}
ANTIGA = {**BASE, 'socios': [VENDEDOR, COMPRADOR]}   # a leitura de antes: o vendedor do preâmbulo entrava como sócio

DUBLE = """
window.__mockInvoke = async (nome, opts) => {
  if (nome === 'extract-document') return { data: { data: window.__leitura === 'antiga' ? %s : %s, modo: 'cadastro' }, error: null };
  if (nome === 'registrar-processo-drive') return { data: { ok: true }, error: null };
  return { data: null, error: { message: 'função ' + nome + ' fora do teste' } };
};
""" % (json.dumps(ANTIGA, ensure_ascii=False), json.dumps(NOVA, ensure_ascii=False))
# as duas empresas do comparar: a primeira com os dois sócios no cadastro, a segunda só com o comprador
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const cli = (id, nome) => ({ id, nome_principal: nome, nome_fantasia: null, tipo_pessoa: 'PJ', documento: '%(cnpj)s', status: 'em_transicao',
      regime_tributario: 'Simples Nacional', cidade: 'Três Coroas', uf: 'RS', drive_folder_url: null, capital_social: 100000 });
    v.clientes.push(cli('cl-ls1', 'INDUSTRIA DE TESTE LTDA'), cli('cl-ls2', 'OUTRA INDUSTRIA DE TESTE LTDA'));
    const soc = (id, cliente_id, s, part) => ({ id, cliente_id, nome: s.nome, cpf: s.cpf.replace(/\\D/g, ''), participacao_percentual: part,
      qualificacao: s.qualificacao, eh_administrador: s.eh_administrador, rg: s.rg, data_nascimento: s.data_nascimento, estado_civil: s.estado_civil,
      nacionalidade: s.nacionalidade, profissao: s.profissao, endereco_residencial: s.endereco_residencial });
    v.socios = (v.socios || []).concat([soc('so-v1', 'cl-ls1', %(vendedor)s, 50), soc('so-c1', 'cl-ls1', %(comprador)s, 50), soc('so-c2', 'cl-ls2', %(comprador)s, 100)]);
  } });
})();
""" % {'cnpj': CNPJ, 'vendedor': json.dumps(VENDEDOR, ensure_ascii=False), 'comprador': json.dumps(COMPRADOR, ensure_ascii=False)}
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
PDF = {'name': 'alteracao-teste.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4\n% alteracao inventada\n'}

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        def pagina(leitura, semear=False):
            p = b.new_page(viewport={'width': 1400, 'height': 1000})
            p.on('pageerror', lambda e: erros.append(str(e)))
            # sem o pdf.js do CDN: a escolha do arquivo cai no "único anexo" (o PDF do teste é inventado)
            p.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
            p.add_init_script(TOUR); p.add_init_script(DUBLE)
            if semear: p.add_init_script(SEMEAR)
            p.add_init_script(f"window.__leitura = '{leitura}'")
            return p

        # 1) o cadastro com extração: só o comprador, e quem saiu no status
        p = pagina('nova')
        p.goto(base + 'clientes/novo.html'); p.wait_for_timeout(1200)
        p.set_input_files('#docFiles', files=[PDF])
        p.click('#btnExtrair')
        p.wait_for_function("document.getElementById('extraiStatus').textContent.includes('sócio')", timeout=5000)
        st = p.inner_text('#extraiStatus')
        ok('1 sócio(s) detectado(s)' in st and 'Fora: PEDRO VENDEDOR DE TESTE, que saiu da sociedade neste documento.' in st and '⚠' not in st,
           f'o cadastro: conta só o comprador e diz quem ficou de fora ({st!r})')
        p.click('#btnSalvar')
        p.wait_for_function("(window.__mockDb.socios || []).length >= 1", timeout=5000)
        p.wait_for_timeout(600)
        nomes = p.evaluate("(window.__mockDb.socios || []).map(s => s.nome)")
        ok(nomes == ['VALTER COMPRADOR DE TESTE'], f'ao cadastrar, só o comprador vira sócio ({nomes})')
        p.close()

        # 2) a leitura antiga no cadastro: o aviso da soma
        p = pagina('antiga')
        p.goto(base + 'clientes/novo.html'); p.wait_for_timeout(1200)
        p.set_input_files('#docFiles', files=[PDF])
        p.click('#btnExtrair')
        p.wait_for_function("document.getElementById('extraiStatus').textContent.includes('sócio')", timeout=5000)
        st = p.inner_text('#extraiStatus')
        ok('⚠ As participações lidas somam 150% — confira o quadro de sócios antes de aplicar.' in st and 'Fora:' not in st,
           f'a leitura antiga (os dois como sócios): o aviso de que as participações somam 150% ({st!r})')
        p.close()

        # o comparar do Registrar processo: anexa o PDF e lê
        def comparar(cid, leitura):
            p = pagina(leitura, semear=True)
            p.goto(base + f'clientes/editar.html?id={cid}')
            p.wait_for_selector('#formArea:not([hidden])', timeout=8000)
            p.click('#btnRegistrarProcesso')
            p.wait_for_selector('#procOverlay.is-open', timeout=3000)
            p.set_input_files('#procArquivos', files=[PDF])
            p.wait_for_function("!document.getElementById('atzLer').disabled", timeout=5000)
            p.click('#atzLer')
            p.wait_for_function("document.getElementById('atzDiffDoc').innerText.includes('Sócios')", timeout=8000)
            linhas = p.evaluate("""() => [...document.querySelectorAll('#atzDiffDoc tr')].map(tr => {
                const cb = tr.querySelector('input[type=checkbox]');
                return { texto: tr.innerText.replace(/\\s+/g, ' ').trim(), caixa: !!cb, marcada: !!(cb && cb.checked), tipo: cb ? cb.dataset.tipo || null : null };
              })""")
            return p, linhas, p.inner_text('#atzDiffDoc')

        # 3) o vendedor no cadastro: a remoção com o porquê, sem "Sócio incluído"
        p, linhas, painel = comparar('cl-ls1', 'nova')
        incluidos = [l for l in linhas if l['texto'].startswith('Sócio incluído')]
        remocao = [l for l in linhas if l['texto'].startswith('Sócio removido')]
        ok(not incluidos, f'quem saiu não entra como "Sócio incluído" ({incluidos})')
        ok(len(remocao) == 1 and 'PEDRO VENDEDOR DE TESTE' in remocao[0]['texto'] and 'saiu da sociedade — ' + MOTIVO in remocao[0]['texto']
           and remocao[0]['caixa'] and not remocao[0]['marcada'] and remocao[0]['tipo'] == 'removido',
           f'o vendedor do cadastro: a remoção com o porquê, com a caixa desmarcada como as outras ({remocao})')
        ok('pressupõe que o documento traz o quadro societário' not in painel, 'sem o aviso de "quadro completo" (a remoção vem do próprio documento)')
        part = [l for l in linhas if 'VALTER COMPRADOR DE TESTE — Participação' in l['texto']]
        ok(len(part) == 1 and part[0]['texto'].endswith('50 100'), f'a participação do comprador vai de 50 pra 100 ({part})')
        ok('somam' not in painel, 'a soma fecha 100%: sem aviso')
        p.close()

        # 4) sem o vendedor no cadastro: só a linha informativa
        p, linhas, painel = comparar('cl-ls2', 'nova')
        ok(not [l for l in linhas if 'PEDRO' in l['texto']], 'sem o vendedor no cadastro: nenhuma linha com caixa pra ele')
        ok('Saiu da sociedade neste documento: PEDRO VENDEDOR DE TESTE — ' + MOTIVO + '.' in painel and 'Quadro societário confere.' in painel,
           'a linha informativa de quem saiu, e o quadro do cadastro confere')
        p.close()

        # 5) a leitura antiga no comparar: o aviso da soma antes do confirmar
        p, linhas, painel = comparar('cl-ls2', 'antiga')
        aviso = p.evaluate("(() => { const a = document.querySelector('#atzDiffDoc .proc-warn'); return a ? a.innerText : ''; })()")
        ok('As participações lidas somam 150% — confira o quadro de sócios antes de aplicar.' in aviso, f'a leitura antiga: o aviso da soma no painel ({aviso!r})')
        p.close()

        ok(not erros, f'sem erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
