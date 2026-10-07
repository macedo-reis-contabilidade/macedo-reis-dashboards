"""
Teste do arquivo de boletos do Inter na grade de boletos (financeiro-boletos.html + assets/js/cnab-inter.js) — sem
login e sem banco (mesmo mock do conferir.py; dados inventados, inclusive a conta).

    python tests/harness/boletos-inter.py

Confere:
  1. primeira vez: pede a conta do Inter (com o dígito) e o nome no arquivo; conta que não fecha é barrada; guardada
     em configuracoes_escritorio.inter_cnab, a janela mostra o resumo e o próximo número de arquivo;
  2. a lista: só as cobranças "A emitir" da competência, valor com os extras, "pagável até" o fim do mês; sem endereço,
     sem CEP, CNPJ com letras e vencimento que já passou ficam barrados (sem caixa de marcar), com "abrir cadastro"
     quando o problema é do cadastro;
  3. gerar: o arquivo baixado tem o nome CI400_001_0000001.REM e as posições certas (conta, controle, seu número
     dia+mês+ano+nº, valor, dias de pagamento, mensagem, CRLF); número do arquivo, sequência do seu número e o
     arquivo gerado ficam guardados; o boleto mostra "já foi no arquivo nº 1";
  4. "Marcar como Emitido" muda a situação no banco e na grade, e o boleto sai da lista;
  5. segundo arquivo no mesmo dia: número 2, seu número continua a sequência do dia;
  6. reabrindo: a conta já vem guardada e o próximo número é o 3; Esc fecha a janela;
  7. primeiro uso sem clicar em Guardar: marcar libera o botão com o aviso, sem conta não gera e diz o que falta,
     com a conta digitada gera e guarda a conta.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime, calendar
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
br = lambda iso: iso[8:10] + '/' + iso[5:7] + '/' + iso[0:4]
mes = hoje.strftime('%Y-%m')
V1, V2 = dia(5), dia(10)

def fim_do_mes(iso):
    y, m, d = map(int, iso.split('-'))
    ultimo = calendar.monthrange(y, m)[1]
    dias = min(60, max(1, ultimo - d))
    return (datetime.date(y, m, d) + datetime.timedelta(days=dias)).isoformat(), dias

ID1 = 'aaaaaaaa-1111-2222-3333-444444444444'
ID2 = 'bbbbbbbb-1111-2222-3333-444444444444'
end = lambda **k: {'logradouro': 'Rua de Teste', 'numero': '10', 'complemento': None, 'bairro': 'Centro', 'cidade': 'Três Coroas', 'uf': 'RS', 'cep': '95660-000', **k}
CLIENTES = [
    {'id': 'k1', 'nome_principal': 'EMPRESA EXEMPLO DE TESTE LTDA', 'documento': '11.222.333/0001-81', **end()},
    {'id': 'k2', 'nome_principal': 'COMÉRCIO MODELO DE TESTE ME', 'documento': '22.333.444/0001-90', **end(logradouro='Avenida Principal', numero='200', complemento='Sala 3')},
    {'id': 'k3', 'nome_principal': 'LOJA SEM ENDEREÇO DE TESTE LTDA', 'documento': '33.444.555/0001-00', **end(logradouro=None, numero=None, cep=None)},
    {'id': 'k4', 'nome_principal': 'NOVA ALFANUMÉRICA DE TESTE LTDA', 'documento': '12.ABC.345/01DE-35', **end()},
    {'id': 'k5', 'nome_principal': 'VENCIDA DE TESTE LTDA', 'documento': '44.555.666/0001-11', **end()},
    {'id': 'k6', 'nome_principal': 'JÁ EMITIDA DE TESTE LTDA', 'documento': '55.666.777/0001-22', **end()},
]
cob = lambda id, cli, valor, venc, status='a_emitir', obs=None, extras=None: {
    'id': id, 'cliente_id': cli, 'competencia': mes, 'valor': valor, 'vencimento': venc, 'canal': 'whatsapp', 'contato_envio': None,
    'destino': '51900000000', 'responsavel': None, 'observacao': obs, 'status': status, 'itens_extras': extras or [], 'created_at': dia(-3) + 'T12:00:00Z'}
COBRANCAS = [
    cob(ID1, 'k1', 450, V1, obs='Honorários de teste'),
    cob(ID2, 'k2', 300, V2, extras=[{'faturavel_id': 'f1', 'descricao': 'ALTERAÇÃO DE TESTE', 'valor': 125.5}]),
    cob('cccccccc-1111-2222-3333-444444444444', 'k3', 300, V1),
    cob('dddddddd-1111-2222-3333-444444444444', 'k4', 300, V1),
    cob('eeeeeeee-1111-2222-3333-444444444444', 'k5', 300, dia(-1)),
    cob('ffffffff-1111-2222-3333-444444444444', 'k6', 300, V1, status='emitido'),
]
ARMADILHA = """(() => {
  const CLI = %s, COB = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes = CLI; v.cobrancas_mensais = COB; v.cobrancas_config = []; v.configuracoes_escritorio = []; v.carteira_info = [];
  } });
})();""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(COBRANCAS, ensure_ascii=False))
INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def db(p, expr):
    return p.evaluate('() => ' + expr)

def linha(p, id):
    return p.locator(f'#inBody tr[data-linha="{id}"]')

def baixar(p):
    with p.expect_download() as dl:
        p.click('#inGerar')
    d = dl.value
    return d.suggested_filename, open(d.path(), 'rb').read().decode('ascii')

def seu_numero(seq):
    return f'{hoje.day}{hoje.month}{str(hoje.year)[2:]}{seq}'

def fluxo(b, base, tema, erros):
    print(f'[{tema}] 1. primeira vez: a conta do Inter')
    p = b.new_page(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script(ARMADILHA)
    p.goto(base + 'financeiro-boletos.html'); p.wait_for_timeout(1500)
    p.click('#btnInter'); p.wait_for_timeout(500)
    ok(p.locator('#inConta').is_visible() and p.input_value('#inNome') == 'MACEDO E REIS CONTABILIDADE', '1. pede a conta, com o nome do escritório sugerido')
    ok(p.locator('#inGerar').is_disabled(), '1. sem conta, não gera')
    p.fill('#inConta', '7'); p.click('#inSalvarConta'); p.wait_for_timeout(200)
    ok('com o dígito' in p.inner_text('#inMsg') and db(p, 'window.__mockDb.configuracoes_escritorio.length') == 0, '1. conta que não fecha é barrada')
    p.fill('#inConta', '1234567-8'); p.fill('#inNome', 'Macedo e Reis Contabilidade'); p.click('#inSalvarConta'); p.wait_for_timeout(300)
    cfg = db(p, "window.__mockDb.configuracoes_escritorio.find(c => c.chave === 'inter_cnab')")
    v = json.loads(cfg['valor']) if cfg else {}
    ok(v.get('conta') == '1234567' and v.get('dv') == '8' and v.get('nome') == 'MACEDO E REIS CONTABILIDADE' and v.get('remessa') == 0, '1. conta guardada nas configurações do escritório')
    resumo = p.inner_text('#inContaResumo')
    ok('0001 / 1234567-8' in resumo and 'próximo arquivo nº 1' in resumo, '1. resumo da conta e próximo número de arquivo')
    p.screenshot(path=str(FOTOS / f'{tema}-boletos-inter.png'))

    print(f'[{tema}] 2. a lista do arquivo')
    ok(p.locator('#inBody tr[data-linha]').count() == 5, '2. só as 5 cobranças "A emitir" (a já emitida fica de fora)')
    l1, l2 = linha(p, ID1), linha(p, ID2)
    fim1, dias1 = fim_do_mes(V1)
    ok('pronto' in l1.inner_text() and br(V1) in l1.inner_text() and br(fim1) in l1.inner_text() and 'R$ 450,00' in l1.inner_text(), '2. pronto, com vencimento e "pagável até" o fim do mês')
    ok('R$ 425,50' in l2.inner_text(), '2. valor do boleto soma os extras')
    l3 = linha(p, 'cccccccc-1111-2222-3333-444444444444')
    ok('sem endereço no cadastro' in l3.inner_text() and 'CEP faltando' in l3.inner_text() and l3.locator('input').is_disabled(), '2. sem endereço e sem CEP: barrado')
    ok(l3.locator('a').get_attribute('href') == 'clientes/editar.html?id=k3', '2. "abrir cadastro" leva ao cliente')
    ok('CNPJ com letras' in linha(p, 'dddddddd-1111-2222-3333-444444444444').inner_text(), '2. CNPJ com letras: barrado')
    l5 = linha(p, 'eeeeeeee-1111-2222-3333-444444444444')
    ok('vencimento já passou' in l5.inner_text() and l5.locator('a').count() == 0, '2. vencimento que já passou: barrado, sem link de cadastro')
    ok('3 com pendência' in p.inner_text('#inResumo'), '2. contagem das pendências')

    print(f'[{tema}] 3. gerar o arquivo')
    l1.locator('input').check(); p.wait_for_timeout(100)
    ok(p.inner_text('#inGerar') == 'Gerar arquivo · 1 boleto(s) · R$ 450,00' and not p.locator('#inGerar').is_disabled(), '3. botão mostra o que vai no arquivo')
    nome, txt = baixar(p); p.wait_for_timeout(300)
    ls = txt.split('\r\n')
    ok(nome == 'CI400_001_0000001.REM', '3. nome do arquivo: ' + nome)
    ok(txt.endswith('\r\n') and len(ls) == 4 and ls[3] == '' and all(len(x) == 400 for x in ls[:3]), '3. header, 1 boleto e trailer, 400 posições, CRLF')
    h, d1, t = ls[0], ls[1], ls[2]
    ok(h[110:117] == '0000001' and h[46:76].strip() == 'MACEDO E REIS CONTABILIDADE' and h[94:100] == hoje.strftime('%d%m%y'), '3. header com número do arquivo, nome e data')
    ok(d1[20:23] == '112' and d1[23:27] == '0001' and d1[27:36] == '001234567' and d1[36] == '8', '3. carteira, agência, conta e dígito')
    ok(d1[37:62] == 'AAAAAAAA11112222333344444', '3. número de controle = id da cobrança')
    ok(d1[110:120].strip() == seu_numero(1), '3. seu número dia+mês+ano+1: ' + d1[110:120].strip())
    ok(d1[120:126] == V1[8:10] + V1[5:7] + V1[2:4] and d1[126:139] == '0000000045000' and d1[139:141] == f'{dias1:02d}', '3. vencimento, valor e dias de pagamento')
    ok(d1[222:236] == '11222333000181' and d1[236:276].strip() == 'EMPRESA EXEMPLO DE TESTE LTDA' and d1[276:314].strip() == 'RUA DE TESTE 10 - CENTRO' and d1[314:316] == 'RS' and d1[316:324] == '95660000', '3. pagador: CNPJ, nome, endereço, UF e CEP')
    ok(d1[324:394].strip() == 'HONORARIOS DE TESTE', '3. observação vai como mensagem, sem acento')
    ok(t[0] == '9' and t[1:7] == '000001', '3. trailer com a quantidade')
    v = json.loads(db(p, "window.__mockDb.configuracoes_escritorio.find(c => c.chave === 'inter_cnab').valor"))
    ok(v['remessa'] == 1 and v['seq_dia'] == hoje.isoformat() and v['seq'] == 1 and v['arquivos'][-1]['ids'] == [ID1], '3. número do arquivo, sequência do dia e o arquivo gerado guardados')
    ok('CI400_001_0000001.REM baixado' in p.inner_text('#inBody') and 'Cobrança via arquivo' in p.inner_text('#inBody'), '3. diz onde importar no Inter')
    ok('já foi no arquivo nº 1' in linha(p, ID1).inner_text(), '3. o boleto avisa que já foi no arquivo nº 1')
    ok(db(p, f"window.__mockDb.cobrancas_mensais.find(c => c.id === '{ID1}').status") == 'a_emitir', '3. gerar não muda a situação sozinho')

    print(f'[{tema}] 4. marcar como emitido')
    p.click('#inEmitidos'); p.wait_for_timeout(300)
    ok(db(p, f"window.__mockDb.cobrancas_mensais.find(c => c.id === '{ID1}').status") == 'emitido', '4. situação Emitido no banco')
    ok(linha(p, ID1).count() == 0 and 'Marcados como Emitido' in p.inner_text('#inBody'), '4. o boleto sai da lista do arquivo')
    ok(p.locator('select.st-emitido').count() == 2, '4. a grade mostra Emitido (o já emitido e o novo)')

    print(f'[{tema}] 5. segundo arquivo no mesmo dia')
    linha(p, ID2).locator('input').check(); p.wait_for_timeout(100)
    nome2, txt2 = baixar(p); p.wait_for_timeout(300)
    d2 = txt2.split('\r\n')[1]
    ok(nome2 == 'CI400_001_0000002.REM' and txt2.split('\r\n')[0][110:117] == '0000002', '5. arquivo nº 2')
    ok(d2[110:120].strip() == seu_numero(2), '5. seu número continua a sequência do dia: ' + d2[110:120].strip())
    ok(d2[126:139] == '0000000042550' and d2[276:314].strip() == 'AV PRINCIPAL 200 SALA 3 - CENTRO', '5. valor com os extras e avenida abreviada')
    p.click('#inFechar'); p.wait_for_timeout(200)

    print(f'[{tema}] 6. reabrindo')
    p.click('#btnInter'); p.wait_for_timeout(500)
    ok(p.locator('#inConta').count() == 0 and 'próximo arquivo nº 3' in p.inner_text('#inContaResumo'), '6. conta guardada e próximo número 3')
    ok('já foi no arquivo nº 2' in linha(p, ID2).inner_text(), '6. o boleto do 2º arquivo avisa')
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    ok(not p.locator('#ovInter').is_visible(), '6. Esc fecha a janela')
    p.close()

def gerar_sem_guardar(b, base, erros):
    print('[claro] 7. primeiro uso: marcar e gerar sem clicar em Guardar')
    p = b.new_page(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    p.on('pageerror', lambda e: erros.append(f'gerar sem guardar: {e}'))
    baixados = []
    p.on('download', lambda d: baixados.append(d.suggested_filename))
    p.add_init_script(INIT_TEMA % 'claro')
    p.add_init_script(ARMADILHA)
    p.goto(base + 'financeiro-boletos.html'); p.wait_for_timeout(1500)
    p.click('#btnInter'); p.wait_for_timeout(500)
    linha(p, ID1).locator('input').check(); p.wait_for_timeout(100)
    ok(not p.locator('#inGerar').is_disabled() and 'conta digitada' in p.inner_text('#inMsg'), '7. com boleto marcado o botão libera e avisa que a conta digitada é guardada ao gerar')
    p.click('#inGerar'); p.wait_for_timeout(400)
    ok('com o dígito' in p.inner_text('#inMsg') and not baixados and db(p, 'window.__mockDb.configuracoes_escritorio.length') == 0, '7. sem conta digitada, não gera e diz o que falta')
    p.fill('#inConta', '1234567-8')
    nome, txt = baixar(p); p.wait_for_timeout(300)
    v = json.loads(db(p, "window.__mockDb.configuracoes_escritorio.find(c => c.chave === 'inter_cnab').valor"))
    ok(nome == 'CI400_001_0000001.REM' and txt.split('\r\n')[1][27:37] == '0012345678', '7. gerou o arquivo com a conta digitada')
    ok(v['conta'] == '1234567' and v['dv'] == '8' and v['remessa'] == 1 and v['arquivos'][-1]['ids'] == [ID1], '7. a conta e o arquivo ficaram guardados')
    ok('CI400_001_0000001.REM baixado' in p.inner_text('#inBody') and '0001 / 1234567-8' in p.inner_text('#inContaResumo'), '7. janela mostra o arquivo baixado e a conta guardada')
    p.close()

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            fluxo(b, base, tema, erros)
        gerar_sem_guardar(b, base, erros)
        b.close()
    srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:5])))
    print(('\nOK' if not falhas else f'\n{falhas} FALHA(S)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
