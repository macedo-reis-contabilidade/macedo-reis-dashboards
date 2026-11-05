"""
Teste do vencimento dos boletos no dia do contrato (financeiro-boletos.html + diaDoContrato de assets/js/tarefas-acoes.js,
31/10/2026, pedido do Samuel: "as datas deverão ser normais em novembro, vencimentos dia 10, 15 e 25") — sem login e sem
banco (dados inventados).

    python tests/harness/boletos-vencimento.py

Confere:
  1. gerar 10/2026 a partir de setembro, em que o dia 10 tinha saído em 09/10 (o 10 caiu no sábado) e o 25 em 26/10 (o 25
     caiu no domingo): sai no dia de cada empresa (a base), no próximo dia útil — 10/11, 16/11 (o 15 é domingo e feriado),
     25/11 e 23/11 (o 20 é feriado, Consciência Negra) —, sem herdar o dia mudado; o valor continua o de setembro;
  2. mudar a data na grade pra outro dia muda o dia da empresa nos próximos meses (a base), com o aviso; ir pro dia útil
     antes do dia de sempre que caiu em fim de semana ou feriado não muda; mudar a data de um mês que já tem outro depois
     não muda.
Nos temas escuro e claro. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

CLIENTES = [{'id': k, 'nome_principal': n, 'documento': d} for k, n, d in [
    ('k10', 'EMPRESA DO DIA DEZ LTDA', '11.222.333/0001-81'),
    ('k15', 'EMPRESA DO DIA QUINZE LTDA', '22.333.444/0001-90'),
    ('k20', 'EMPRESA DO DIA VINTE LTDA', '33.444.555/0001-00'),
    ('k25', 'EMPRESA DO DIA VINTE E CINCO LTDA', '44.555.666/0001-11')]]
base = lambda k, dia, valor: {'id': 'g' + k, 'cliente_id': k, 'valor_base': valor, 'dia_vencimento': dia, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True}
BASES = [base('k10', 10, 400), base('k15', 15, 500), base('k20', 20, 600), base('k25', 25, 700)]
cob = lambda k, comp, valor, venc: {'id': 'm' + k + comp, 'cliente_id': k, 'competencia': comp, 'valor': valor, 'vencimento': venc, 'canal': 'whatsapp', 'contato_envio': '',
    'destino': '', 'responsavel': '', 'observacao': None, 'status': 'enviado', 'itens_extras': [], 'created_at': '2026-10-01T12:00:00Z'}
# setembro, como saiu: o 10 em 09/10 (sexta, o 10 era sábado), o 15 em 15/10, o 20 em 20/10, o 25 em 26/10 (o 25 era domingo);
# os valores de setembro são os vivos (o da base é outro)
SETEMBRO = [cob('k10', '2026-09', 450, '2026-10-09'), cob('k15', '2026-09', 550, '2026-10-15'), cob('k20', '2026-09', 650, '2026-10-20'), cob('k25', '2026-09', 750, '2026-10-26')]
ARMADILHA = """(() => {
  const CLI = %s, BAS = %s, COB = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes = CLI; v.cobrancas_config = BAS; v.cobrancas_mensais = COB; v.configuracoes_escritorio = []; v.carteira_info = []; v.revisoes_honorario = [];
    // o honorário adicional anual de outubro já lançado no Conta Azul (31/10/2026): o da empresa do dia dez, fora do boleto
    v.ca_vendas_lancadas = [{ id: 'L10', tipo: 'adicional_anual', competencia: '2026-10', situacao: 'lancada', cobranca_id: null, cliente_id: 'k10', valor: 450, ca_venda_numero: 190421460 }];
  } });
  // o dublê da função ca-vendas: "pôr no boleto" põe o extra no boleto que acabou de nascer
  window.__chamadas = [];
  window.__mockInvoke = async (nome, op) => {
    const body = (op && op.body) || {};
    window.__chamadas.push({ nome, ...body });
    if (nome !== 'ca-vendas' || body.modo !== 'boleto') return { data: null, error: { message: 'fora do teste' } };
    const b = db.cobrancas_mensais.find(c => c.cliente_id === 'k10' && c.competencia === body.competencia);
    if (b) b.itens_extras = [{ adicional_id: 'L10', descricao: 'Honorário adicional anual (venda 190421460)', valor: 450 }];
    return { data: { resultados: [{ id: 'L10', posto: !!b }, { id: 'L99', posto: false, motivo: 'sem boleto de 10/2026 em Boletos' }] }, error: null };
  };
})();""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(BASES), json.dumps(SETEMBRO))
INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def db(p, expr):
    return p.evaluate('() => ' + expr)

def venc(p, k, comp):
    return db(p, f"(window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === '{k}' && c.competencia === '{comp}') || {{}}).vencimento")

def dia_base(p, k):
    return db(p, f"window.__mockDb.cobrancas_config.find(c => c.cliente_id === '{k}').dia_vencimento")

def linha(p, nome):
    return p.locator('#tbody tr', has_text=nome)

def fluxo(b, base_url, tema, erros):
    print(f'[{tema}] 1. gerar outubro a partir de setembro')
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(ARMADILHA)
    p.goto(base_url + 'financeiro-boletos.html?competencia=2026-10')
    p.wait_for_function('() => document.getElementById("comp").value === "2026-10"')
    p.wait_for_timeout(400)
    p.click('#btnGerar')
    p.wait_for_function("() => (window.__mockDb.cobrancas_mensais || []).filter(c => c.competencia === '2026-10').length === 4", timeout=8000)
    p.wait_for_timeout(300)
    ok(venc(p, 'k10', '2026-10') == '2026-11-10', '1. o dia 10 sai em 10/11, não no dia 9 de setembro: ' + str(venc(p, 'k10', '2026-10')))
    ok(venc(p, 'k15', '2026-10') == '2026-11-16', '1. o dia 15 (domingo e feriado) sai em 16/11: ' + str(venc(p, 'k15', '2026-10')))
    ok(venc(p, 'k20', '2026-10') == '2026-11-23', '1. o dia 20 (feriado, sexta) sai em 23/11: ' + str(venc(p, 'k20', '2026-10')))
    ok(venc(p, 'k25', '2026-10') == '2026-11-25', '1. o dia 25 sai em 25/11, não no 26 de setembro: ' + str(venc(p, 'k25', '2026-10')))
    valores = db(p, "window.__mockDb.cobrancas_mensais.filter(c => c.competencia === '2026-10').map(c => c.cliente_id + ':' + c.valor).sort().join()")
    ok(valores == 'k10:450,k15:550,k20:650,k25:750', '1. os valores continuam os de setembro (vivos): ' + valores)
    ok(linha(p, 'DIA DEZ').locator('input[data-f="vencimento"]').input_value() == '2026-11-10', '1. a grade mostra o vencimento novo')
    chamadas = db(p, "window.__chamadas")
    extras = db(p, "(window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k10' && c.competencia === '2026-10') || {}).itens_extras")
    ok(chamadas[:1] == [{'nome': 'ca-vendas', 'modo': 'boleto', 'competencia': '2026-10'}] and extras and extras[0]['adicional_id'] == 'L10',
       '1. o honorário adicional anual já lançado entra sozinho no boleto que nasceu: ' + json.dumps(chamadas))
    # depois de gerar, a conferência com o Conta Azul abre sozinha pros sócios (05/11/2026; o teste dela é o
    # boletos-conta-azul.py): aqui, só fecha
    p.wait_for_selector('#caOv', timeout=8000)
    ok(db(p, "window.__chamadas.filter(c => c.modo === 'boletos').map(c => c.meses)") == [['2026-11']],
       '1. … e a conferência com o Conta Azul abre sozinha (o que vence em 11/2026)')
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    ok('1 com o honorário adicional anual no boleto' in p.inner_text('#msg') and 'não entrou' not in p.inner_text('#msg'), '1. o aviso diz quantos (quem paga por outro banco não é aviso): ' + p.inner_text('#msg'))
    p.screenshot(path=str(FOTOS / f'{tema}-boletos-vencimento.png'))

    print(f'[{tema}] 2. mudar a data na grade')
    linha(p, 'DIA DEZ').locator('input[data-f="vencimento"]').fill('2026-11-17')
    p.wait_for_function("() => window.__mockDb.cobrancas_config.find(c => c.cliente_id === 'k10').dia_vencimento === 17", timeout=5000)
    ok(dia_base(p, 'k10') == 17 and venc(p, 'k10', '2026-10') == '2026-11-17', '2. outro dia: o boleto e o dia da empresa nos próximos meses (17)')
    ok('passa a vencer no dia 17 também nos próximos meses' in p.inner_text('#msg'), '2. o aviso: ' + p.inner_text('#msg'))
    linha(p, 'DIA QUINZE').locator('input[data-f="vencimento"]').fill('2026-11-13')
    p.wait_for_function("() => (window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k15' && c.competencia === '2026-10') || {}).vencimento === '2026-11-13'", timeout=5000)
    p.wait_for_timeout(400)
    ok(dia_base(p, 'k15') == 15 and 'próximos meses' not in p.inner_text('#msg'), '2. o dia útil antes do 15 (domingo e feriado): o boleto muda, o dia da empresa fica 15')
    # um mês que já tem outro depois (setembro, com outubro gerado) não mexe no dia da empresa
    p.fill('#comp', '2026-09'); p.dispatch_event('#comp', 'change')
    p.wait_for_function("() => document.querySelectorAll('#tbody tr').length === 4", timeout=5000)
    p.wait_for_timeout(300)
    linha(p, 'VINTE E CINCO').locator('input[data-f="vencimento"]').fill('2026-10-28')
    p.wait_for_function("() => (window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k25' && c.competencia === '2026-09') || {}).vencimento === '2026-10-28'", timeout=5000)
    p.wait_for_timeout(400)
    ok(dia_base(p, 'k25') == 25, '2. mudar a data de setembro, com outubro já gerado, não muda o dia da empresa')
    p.close()

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base_url = f'http://127.0.0.1:{porta}/'
    erros = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            try:
                for tema in ('escuro', 'claro'):
                    fluxo(b, base_url, tema, erros)
            finally:
                b.close()
    finally:
        srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:3])))
    print(('\n%d falha(s).' % falhas) if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
