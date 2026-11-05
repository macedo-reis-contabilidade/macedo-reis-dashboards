"""
Teste da conferência dos boletos com o Conta Azul (financeiro-boletos.html + assets/js/boletos-conta-azul-tela.js +
assets/js/boletos-conta-azul.js, 05/11/2026, pedido do Samuel: "o que deve aparecer no sistema dos boletos é 1.520,00, soma
de tudo que vence de serviços dessa empresa em novembro") — sem login, sem banco e sem Conta Azul: a função ca-vendas é um
dublê em window.__mockInvoke (empresas e valores inventados).

    python tests/harness/boletos-conta-azul.py

Confere:
  1. o botão só aparece pros sócios; o campo do valor mostra o total (a mensalidade e o adicional), com o aviso dos
     extras e a mensalidade embaixo;
  2. a janela: o Conta Azul "renovando" na primeira chamada (avisa e tenta de novo); o resumo; os grupos (sobem, descem,
     muda a composição); marcadas, salvo a que pede conferência (o total que cai mais de 30%); o que já estava no boleto;
     a sem nada lá, a já emitida, a empresa sem boleto aqui e a pessoa sem empresa; o nome com HTML vem como texto;
  3. "Aplicar": o valor e os extras de cada marcada no banco (a desmarcada fica), a grade com os totais novos, e a
     conferência de novo mostra que batem; "Desfazer" volta tudo;
  4. na grade: o aviso abre a lista (a mensalidade e cada extra); "Tirar do boleto" tira o item do Conta Azul (fica
     riscado, não soma) e "Voltar pro boleto" o põe de volta;
  5. digitar o total: a mensalidade é o total menos os extras; o total menor que os extras não grava e volta;
  6. gerar um mês novo abre a conferência sozinha.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
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

NOMES = {'k1': 'ADEGA DE TESTE LTDA', 'k2': 'AGRO DE TESTE LTDA', 'k3': 'GOLDEN DE TESTE LTDA', 'k4': 'MEI DE TESTE 12345678',
         'k5': 'SEM CONTA AZUL LTDA', 'k6': 'JA EMITIDA LTDA', 'k7': 'IGUAL DE TESTE LTDA', 'k8': 'ZZ <img src=x onerror="window.__xss=1"> LTDA',
         'k9': 'FORA DA GRADE LTDA'}
CLIENTES = [{'id': k, 'nome_principal': n, 'documento': '1%013d' % i} for i, (k, n) in enumerate(NOMES.items())]
BASES = [{'id': 'g' + k, 'cliente_id': k, 'valor_base': 100, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True}
         for k in ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8']]
def cob(k, valor, status='a_emitir', extras=None, venc='2026-11-10'):
    return {'id': 'm' + k, 'cliente_id': k, 'competencia': '2026-10', 'valor': valor, 'vencimento': venc, 'canal': 'whatsapp', 'contato_envio': '',
            'destino': '', 'responsavel': '', 'observacao': None, 'status': status, 'itens_extras': extras or [], 'created_at': '2026-11-01T12:00:00Z'}
adic = lambda valor, venda: {'adicional_id': 'L' + venda, 'descricao': 'Honorário adicional anual (venda %s)' % venda, 'valor': valor}
OUTUBRO = [cob('k1', 660, extras=[adic(660, '190421461')]), cob('k2', 905), cob('k3', 320, extras=[adic(300, '190421487')]), cob('k4', 175, venc='2026-11-16'),
           cob('k5', 450), cob('k6', 500, status='emitido'), cob('k7', 300), cob('k8', 100)]
M, X, A = ['HONORÁRIOS MENSAIS'], ['SERVIÇOS EXTRAS'], ['HONORÁRIO ADICIONAL ANUAL']
def it(k, pid, valor, cats, comp, desc='Venda 190421000', venc='2026-11-10'):
    return {'cliente_id': k, 'cliente_nome': NOMES[k], 'parcela_id': pid, 'valor': valor, 'categorias': cats, 'competencia': comp, 'vencimento': venc, 'descricao': desc}
ITENS = [it('k1', 'p1m', 660, M, '2026-10-31', 'Venda 190421415 / NFS-e:1110 - RPS:1110'), it('k1', 'p1x', 200, X, '2026-10-15', '1/4 - Venda 190421319'),
         it('k1', 'p1a', 660, A, '2026-10-31', 'Venda 190421461'),
         it('k2', 'p2m', 825, M, '2026-10-31'), it('k2', 'p2x', 80, X, '2026-10-05', 'Venda 190421336'),
         it('k3', 'p3m', 300, M, '2026-10-31'), it('k3', 'p3a', 300, A, '2026-10-31', 'Venda 190421487'),
         it('k4', 'p4m', 87.95, ['MEI - CONTRATOS'], '2026-10-31', venc='2026-11-15'),
         it('k6', 'p6m', 500, M, '2026-10-31'), it('k6', 'p6x', 40, X, '2026-10-20'),
         it('k7', 'p7m', 300, M, '2026-10-31'),
         it('k8', 'p8m', 100, M, '2026-10-31'), it('k8', 'p8x', 50, X, '2026-10-20', 'Venda <b>190421999</b>'),
         it('k9', 'p9m', 700, M, '2026-10-31')]
ARMADILHA = """(() => {
  const CLI = %s, BAS = %s, COB = %s, ITENS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes = CLI; v.cobrancas_config = BAS; v.cobrancas_mensais = COB; v.configuracoes_escritorio = []; v.carteira_info = []; v.revisoes_honorario = []; v.ca_vendas_lancadas = [];
  } });
  // o dublê da função ca-vendas: a primeira conferência volta "renovando"; depois, o que vence nos meses pedidos
  window.__chamadas = [];
  window.__renovando = 1;
  window.__mockInvoke = async (nome, op) => {
    const body = (op && op.body) || {};
    window.__chamadas.push({ nome, ...body });
    if (nome !== 'ca-vendas' || body.modo !== 'boletos') return { data: null, error: { message: 'fora do teste' } };
    if (window.__renovando > 0) {
      window.__renovando--;
      return { data: null, error: { context: { status: 503, json: async () => ({ erro: 'A conexão com o Conta Azul está sendo renovada.', renovando: true }) } } };
    }
    const meses = body.meses || [];
    return { data: { meses, itens: ITENS.filter(i => meses.includes(i.vencimento.slice(0, 7))), soltas: meses.includes('2026-11') ? [{ nome: 'PESSOA SOLTA', valor: 90, itens: 2 }] : [] }, error: null };
  };
})();""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(BASES), json.dumps(OUTUBRO, ensure_ascii=False), json.dumps(ITENS, ensure_ascii=False))
INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def db(p, expr):
    return p.evaluate('() => ' + expr)

def cobr(p, k, comp='2026-10'):
    return db(p, f"window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === '{k}' && c.competencia === '{comp}') || null")

def linha(p, nome):
    return p.locator('#tbody tr', has_text=nome).first

def abrir(b, base_url, tema, erros, email=None):
    p = b.new_page(viewport={'width': 1440, 'height': 950})
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script('window.__boletosEsperaMs = 300;' + (f'window.__mockEmail = {json.dumps(email)};' if email else ''))
    # o aviso do "renovando" fica 300 ms na tela: quem anota que ele apareceu é a página
    p.add_init_script("new MutationObserver(() => { const c = document.querySelector('#caBody'); if (c && /renovando a conexão/.test(c.textContent)) window.__viuRenovando = true; }).observe(document, { subtree: true, childList: true, characterData: true });")
    p.add_init_script(ARMADILHA)
    p.goto(base_url + 'financeiro-boletos.html?competencia=2026-10')
    p.wait_for_function('() => document.getElementById("comp").value === "2026-10" && document.querySelectorAll("#tbody tr").length >= 8', timeout=8000)
    p.wait_for_timeout(300)
    return p

def fluxo(b, base_url, tema, erros):
    print(f'[{tema}] 1. quem vê e o valor da grade')
    t = abrir(b, base_url, tema, erros, email='fiscal@macedoereis.com.br')
    ok(not t.locator('#btnContaAzul').is_visible(), '1. a Thalia não vê o botão (só os sócios)')
    t.close()
    p = abrir(b, base_url, tema, erros)
    ok(p.locator('#btnContaAzul').is_visible(), '1. o sócio vê "Conferir com o Conta Azul"')
    l1 = linha(p, 'ADEGA DE TESTE')
    ok(l1.locator('input[data-f="valor"]').input_value() == '1320', '1. o campo do valor mostra o total (660 + 660 do adicional): ' + l1.locator('input[data-f="valor"]').input_value())
    ok('+1 extra(s) · R$ 660,00' in l1.inner_text() and 'mensalidade R$ 660,00' in l1.inner_text(), '1. o aviso do extra e a mensalidade embaixo: ' + l1.inner_text().replace('\n', ' | ')[:120])

    print(f'[{tema}] 2. a janela')
    p.click('#btnContaAzul')
    p.wait_for_selector('#caOv')
    p.wait_for_function('() => /boletos:/.test((document.querySelector("#caBody") || {}).textContent || "")', timeout=10000)
    ok(db(p, 'window.__viuRenovando') is True and db(p, 'window.__chamadas.filter(c => c.modo === "boletos").length') == 2, '2. o "renovando": avisa e tenta de novo sozinha')
    ok(db(p, 'window.__chamadas[0].meses') == ['2026-11'], '2. pede o mês do vencimento dos boletos (11/2026)')
    corpo = p.inner_text('#caBody')
    ok('8 boletos: 1 igual ao Conta Azul, 2 sobem, 2 descem, 1 muda só a composição, 1 sem nada vencendo lá, 1 já emitido.' in corpo, '2. o resumo: ' + next((x for x in corpo.split('\n') if 'boletos:' in x), corpo[:200])[:200])
    adega = p.locator('.ca-linha', has_text='ADEGA DE TESTE')
    ok('hoje R$ 1.320,00' in adega.inner_text() and 'R$ 1.520,00' in adega.inner_text() and '+ R$ 200,00' in adega.inner_text(), '2. a Adega: 1.320,00 → 1.520,00 (+ 200,00)')
    ok('Serviços extras · 1/4 - Venda 190421319' in adega.inner_text() and '(já estava no boleto)' in adega.inner_text(), '2. o item novo e o adicional que já estava no boleto')
    marcadas = db(p, '[...document.querySelectorAll(".ca-marca")].filter(c => c.checked).map(c => c.dataset.id).sort()')
    ok(marcadas == ['mk1', 'mk2', 'mk3', 'mk8'], '2. marcadas: as que sobem, descem e mudam a composição, salvo a que cai mais de 30%: ' + json.dumps(marcadas))
    mei = p.locator('.ca-linha', has_text='MEI DE TESTE')
    ok('mais de 30%' in mei.inner_text() and not mei.locator('.ca-marca').is_checked(), '2. a que cai mais de 30% pede conferência e começa desmarcada')
    ok(p.locator('.ca-linha', has_text='AGRO DE TESTE').count() == 1 and 'o total fica' in p.locator('.ca-linha', has_text='AGRO DE TESTE').inner_text(), '2. a que só muda a composição: "o total fica"')
    ok(db(p, 'window.__xss') is None and 'ZZ <img' in p.inner_text('#caBody'), '2. o nome com HTML vem como texto')
    p.click('#caBody summary:has-text("Sem nada vencendo")')
    p.click('#caBody summary:has-text("Já emitidos")')
    p.click('#caBody summary:has-text("não tem boleto aqui")')
    corpo = p.inner_text('#caBody')
    ok('SEM CONTA AZUL LTDA' in corpo and 'JA EMITIDA LTDA — boleto R$ 500,00, Conta Azul R$ 540,00' in corpo, '2. a sem nada lá e a já emitida, com o valor de lá')
    ok('FORA DA GRADE LTDA — R$ 700,00' in corpo and 'PESSOA SOLTA — R$ 90,00' in corpo, '2. a empresa sem boleto aqui e a pessoa sem empresa no cadastro')
    p.screenshot(path=str(FOTOS / f'{tema}-boletos-conta-azul.png'))

    print(f'[{tema}] 3. aplicar e desfazer')
    p.click('#caAplicar')
    p.wait_for_function('() => /boletos atualizados/.test((document.querySelector("#caAviso") || {}).textContent || "")', timeout=8000)
    k1, k2, k3, k4, k8 = cobr(p, 'k1'), cobr(p, 'k2'), cobr(p, 'k3'), cobr(p, 'k4'), cobr(p, 'k8')
    ok(k1['valor'] == 660 and [x.get('ca_parcela_id') or x.get('adicional_id') for x in k1['itens_extras']] == ['L190421461', 'p1x'], '3. a Adega: a mensalidade 660, o adicional e a parcela de 200: ' + json.dumps(k1['itens_extras'], ensure_ascii=False)[:160])
    ok(k2['valor'] == 825 and len(k2['itens_extras']) == 1 and k2['itens_extras'][0]['valor'] == 80, '3. a composição: 825 de mensalidade e o extra de 80 à parte')
    ok(k3['valor'] == 300 and k4['valor'] == 175 and k8['valor'] == 100 and len(k8['itens_extras']) == 1, '3. a que desce aplicada; a desmarcada (cai mais de 30%) fica como estava')
    ok('4 boletos atualizados.' in p.inner_text('#caAviso') and '8 boletos: 5 iguais ao Conta Azul, 1 desce' in p.inner_text('#caBody'), '3. o aviso e a conferência de novo: agora batem')
    ok(linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]').input_value() == '1520' and '+2 extra(s) · R$ 860,00' in linha(p, 'ADEGA DE TESTE').inner_text(), '3. a grade com o total novo, sem ler o mês de novo')
    p.click('#caDesfazer')
    p.wait_for_function('() => /voltaram ao que era/.test((document.querySelector("#caAviso") || {}).textContent || "")', timeout=8000)
    k1, k2 = cobr(p, 'k1'), cobr(p, 'k2')
    ok(k1['valor'] == 660 and len(k1['itens_extras']) == 1 and k2['valor'] == 905 and k2['itens_extras'] == [], '3. "Desfazer" volta o valor e os extras de antes')
    ok(linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]').input_value() == '1320', '3. … e a grade também')
    p.click('#caAplicar')
    p.wait_for_function('() => /boletos atualizados/.test((document.querySelector("#caAviso") || {}).textContent || "")', timeout=8000)
    p.keyboard.press('Escape')
    p.wait_for_timeout(300)
    ok(p.locator('#caOv').count() == 0, '3. Esc fecha a janela')

    print(f'[{tema}] 4. tirar do boleto e voltar')
    l1 = linha(p, 'ADEGA DE TESTE')
    l1.locator('[data-extras]').click()
    sub = p.locator('.bo-extras-row')
    ok('Mensalidade' in sub.inner_text() and 'Serviços extras · 1/4 - Venda 190421319' in sub.inner_text() and sub.locator('.bo-tira').count() == 1, '4. o aviso abre a lista: a mensalidade e os extras; só o item do Conta Azul tem "Tirar"')
    sub.locator('.bo-tira').click()
    p.wait_for_function("() => (window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k1').itens_extras.find(x => x.ca_parcela_id === 'p1x') || {}).ignorado === true", timeout=5000)
    ok(linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]').input_value() == '1320' and p.locator('.bo-extras span.bo-fora').count() == 1, '4. "Tirar do boleto": não soma (1.320) e fica riscado')
    p.locator('.bo-tira').click()
    p.wait_for_function("() => !('ignorado' in (window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k1').itens_extras.find(x => x.ca_parcela_id === 'p1x') || {}))", timeout=5000)
    ok(linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]').input_value() == '1520', '4. "Voltar pro boleto": soma de novo (1.520)')

    print(f'[{tema}] 5. digitar o total')
    campo = linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]')
    campo.fill('1600'); campo.dispatch_event('change')
    p.wait_for_function("() => window.__mockDb.cobrancas_mensais.find(c => c.cliente_id === 'k1').valor === 740", timeout=5000)
    ok(cobr(p, 'k1')['valor'] == 740, '5. o total digitado (1.600): a mensalidade fica 740, os extras ficam como estão')
    campo = linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]')
    campo.fill('500'); campo.dispatch_event('change')
    p.wait_for_timeout(1200)
    ok(cobr(p, 'k1')['valor'] == 740 and linha(p, 'ADEGA DE TESTE').locator('input[data-f="valor"]').input_value() == '1600' and 'não pode ser menor que os extras' in p.inner_text('#msg'),
       '5. o total menor que os extras não grava e volta, com o aviso')

    print(f'[{tema}] 6. gerar um mês novo abre a conferência')
    p.fill('#comp', '2026-11'); p.dispatch_event('#comp', 'change')
    p.wait_for_timeout(500)
    p.click('#btnGerar')
    p.wait_for_selector('#caOv', timeout=8000)
    p.wait_for_function('() => /boletos:/.test((document.querySelector("#caBody") || {}).textContent || "")', timeout=8000)
    ok('Conferir com o Conta Azul · boletos de 11/2026' in p.inner_text('#caTitulo') and db(p, 'window.__chamadas.at(-1).meses') == ['2026-12'], '6. gerou 11/2026 e a conferência abriu sozinha (o que vence em 12/2026)')
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
