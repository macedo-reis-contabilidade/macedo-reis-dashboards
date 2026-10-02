"""Teste do cadastro de cliente por documento (clientes/novo.html) — os sócios nascem com os dados que o kit usa.
Sem login e sem banco: mesmo mock do conferir.py. A leitura do contrato (Edge Function extract-document) é um dublê
que devolve uma extração inventada, com três sócios inventados:
  • FULANA — qualificação completa (RG, nascimento, estado civil, nacionalidade, profissão, endereço residencial);
  • CICRANO — sem RG, sem endereço e sem nacionalidade; nascimento em dd/mm/aaaa e participação "30%";
  • BELTRANO — nascimento impossível (31/02) e participação ilegível.

    python tests/harness/cadastro-socios.py

Confere:
  1. depois da leitura, o aviso diz quantos sócios vieram e o que o kit de boas-vindas vai pedir de cada um;
  2. ao cadastrar, o sócio é gravado COM RG, nascimento, estado civil, nacionalidade, profissão e endereço
     residencial — antes só iam nome, CPF, participação e qualificação, e o kit nascia com "faltam: RG, endereço
     residencial, estado civil, nascimento" (corrigido em 02/10/2026);
  3. campo que a leitura não trouxe fica de fora (a nacionalidade vazia não apaga o padrão do banco), a data em
     dd/mm/aaaa vira aaaa-mm-dd, e data impossível ou participação ilegível ficam vazias em vez de derrubar a
     gravação de todos os sócios;
  4. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CNPJ = '11222333000181'   # o CNPJ de exemplo dos manuais (o cadastro exige dígitos válidos); os CPFs abaixo são inválidos de propósito — nada de cliente
EXTRACAO = {
    'tipo_pessoa': 'PJ', 'documento': CNPJ, 'nome_principal': 'EMPRESA TESTE DO KIT LTDA',
    'regime_tributario': 'Simples Nacional', 'cep': '95660000', 'logradouro': 'Rua de Teste', 'numero': '100',
    'bairro': 'Centro', 'cidade': 'Três Coroas', 'uf': 'RS',
    'socios': [
        {'nome': 'FULANA DE TESTE', 'cpf': '123.456.789-00', 'participacao_percentual': 50, 'qualificacao': 'Sócia Administradora',
         'eh_administrador': True, 'rg': '1234567890 SSP-RS', 'data_nascimento': '1990-05-17', 'estado_civil': 'Solteira',
         'nacionalidade': 'Brasileira', 'profissao': 'Empresária',
         'endereco_residencial': 'Rua de Teste, 100, Centro, Três Coroas - RS, CEP 95660-000'},
        {'nome': 'CICRANO DE TESTE', 'cpf': '98765432199', 'participacao_percentual': '30%', 'qualificacao': 'Sócio',
         'eh_administrador': False, 'rg': None, 'data_nascimento': '17/05/1985', 'estado_civil': 'Casado',
         'nacionalidade': None, 'profissao': 'Comerciante', 'endereco_residencial': None},
        {'nome': 'BELTRANO DE TESTE', 'cpf': '11122233300', 'participacao_percentual': 'vinte', 'qualificacao': 'Sócio',
         'eh_administrador': False, 'rg': '9876543210 SSP-RS', 'data_nascimento': '1980-02-31', 'estado_civil': 'Divorciado',
         'nacionalidade': 'Brasileiro', 'profissao': None, 'endereco_residencial': 'Avenida de Teste, 50, Centro, Igrejinha - RS, CEP 95650-000'},
    ],
    'confianca': 'alta', 'observacoes_extracao': None,
}

DUBLE = """
window.__invocacoes = [];
window.__mockInvoke = async (nome, opts) => {
  const corpo = Object.assign({}, (opts && opts.body) || {}); delete corpo.documents;
  window.__invocacoes.push({ nome, corpo });
  if (nome === 'extract-document') return { data: { data: %s, modo: 'cadastro' }, error: null };
  if (nome === 'registrar-processo-drive') return { data: { ok: true }, error: null };
  return { data: null, error: { message: 'função ' + nome + ' fora do teste' } };
};
""" % json.dumps(EXTRACAO, ensure_ascii=False)

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
        p = b.new_page(viewport={'width': 1400, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(DUBLE)
        p.goto(base + 'clientes/novo.html'); p.wait_for_timeout(1200)

        # 1. leitura do contrato (dublê) e o aviso do que o kit vai pedir
        p.set_input_files('#docFiles', files=[{'name': 'contrato-teste.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4\n% contrato inventado\n'}])
        p.click('#btnExtrair')
        p.wait_for_function("document.getElementById('extraiStatus').textContent.includes('sócio')", timeout=5000)
        status = p.inner_text('#extraiStatus')
        print('  · aviso: ' + status)
        ok('3 sócio(s) detectado(s)' in status, 'o aviso conta os 3 sócios')
        ok('RG, endereço residencial de CICRANO DE TESTE' in status, 'o aviso diz que faltou RG e endereço do CICRANO')
        ok('nascimento de BELTRANO DE TESTE' in status, 'o aviso diz que faltou o nascimento do BELTRANO (data impossível não conta)')
        ok('FULANA' not in status, 'a FULANA, completa, não aparece no aviso')
        ok(p.input_value('#nome_principal') == 'EMPRESA TESTE DO KIT LTDA', 'a razão social veio da leitura')

        # 2. cadastrar e conferir o que foi gravado em socios
        p.click('#btnSalvar')
        p.wait_for_function("(window.__mockDb.socios || []).length >= 3", timeout=5000)
        p.wait_for_timeout(600)
        db = p.evaluate("({ clientes: window.__mockDb.clientes, socios: window.__mockDb.socios })")
        cli = next((c for c in db['clientes'] if c.get('documento') == CNPJ), None)
        ok(cli is not None, 'o cliente foi cadastrado')
        socs = {s['nome']: s for s in db['socios'] if cli and s.get('cliente_id') == cli['id']}
        ok(set(socs) == {'FULANA DE TESTE', 'CICRANO DE TESTE', 'BELTRANO DE TESTE'}, f'os 3 sócios foram gravados ({", ".join(socs) or "nenhum"})')

        f = socs.get('FULANA DE TESTE', {})
        esperado = {'rg': '1234567890 SSP-RS', 'data_nascimento': '1990-05-17', 'estado_civil': 'Solteira', 'nacionalidade': 'Brasileira',
                    'profissao': 'Empresária', 'endereco_residencial': 'Rua de Teste, 100, Centro, Três Coroas - RS, CEP 95660-000'}
        difere = {k: f.get(k) for k, v in esperado.items() if f.get(k) != v}
        ok(not difere, 'FULANA gravada com RG, nascimento, estado civil, nacionalidade, profissão e endereço' + (f' — diferente: {difere}' if difere else ''))
        ok(f.get('cpf') == '12345678900' and f.get('participacao_percentual') == 50 and f.get('eh_administrador') is True,
           'FULANA mantém CPF só com dígitos, 50% e administradora')

        c = socs.get('CICRANO DE TESTE', {})
        ok(c.get('data_nascimento') == '1985-05-17', f'nascimento em dd/mm/aaaa vira aaaa-mm-dd ({c.get("data_nascimento")})')
        ok(c.get('participacao_percentual') == 30, f'participação "30%" vira 30 ({c.get("participacao_percentual")})')
        ok('rg' not in c and 'endereco_residencial' not in c, 'RG e endereço que não vieram ficam de fora')
        ok('nacionalidade' not in c, 'nacionalidade vazia fica de fora (vale o padrão do banco)')
        ok(c.get('estado_civil') == 'Casado' and c.get('profissao') == 'Comerciante', 'estado civil e profissão do CICRANO gravados')

        bt = socs.get('BELTRANO DE TESTE', {})
        ok('data_nascimento' not in bt, 'data impossível (31/02) fica de fora em vez de derrubar a gravação')
        ok(bt.get('participacao_percentual') is None, 'participação ilegível fica vazia')
        ok(bt.get('rg') == '9876543210 SSP-RS' and bt.get('endereco_residencial', '').startswith('Avenida de Teste'), 'RG e endereço do BELTRANO gravados')

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
