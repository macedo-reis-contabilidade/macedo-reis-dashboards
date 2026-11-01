"""
Comparativo tributário (Fiscal, 01/11/2026, pedido do Samuel) — sem login e sem banco (o mock do conferir.py, com os
dados semeados só neste teste; nomes e números inventados). O relógio fica parado em 01/11/2026, meio-dia.

    python tests/harness/comparativo.py

Confere:
  1. a busca acha a empresa pelo nome (o nome com <img onerror> entra como texto);
  2. a empresa com caso na Reforma: o regime de hoje, a receita (receita mensal do caso × 12) e as compras com a origem
     em verde, o crédito de ICMS e as outras despesas em amarelo (padrão); o resultado — o Simples mais barato, o DAS dos
     12 meses de R$ 105.900,00 (Anexo I, 4ª faixa), a conferência com o PGDAS e o prazo pra sair do Simples até
     31/12/2026; o detalhe por tributo;
  3. mudar um número: a origem vira "digitado", a conta refaz e o estudo grava sozinho (cliente, os números e o resumo);
     abrir a empresa de novo traz o estudo gravado;
  4. outra atividade: entra com o ISS, soma na receita e sai no ✕; trocar o tipo pra serviço do fator r troca o ICMS
     pelo ISS;
  5. a empresa só com o Fator R: a folha e o pró-labore dele, a receita pedindo pra digitar; com a receita, o Simples
     no Anexo III (fator r de 31,6%) e o Presumido dos 12 meses;
  6. simular sem cadastro;
  7. o card no Fiscal: "1 estudo";
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

SIM_OBS = json.dumps({ 'v': 1, 'input': { 'anexo': 'I', 'receita': 100000, 'rbt12': 1200000, 'pctComprasMercadorias': 60, 'pctComprasDespesas': 0,
  'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0 },
  'dominio': { 'pgdas': { 'competencia': '2026-08', 'aliquotaEfetiva': 8.83, 'dasTotal': 8830 } } })
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.clientes = [
      { id: 'c1', nome_principal: 'COMÉRCIO MODELO ME', nome_fantasia: 'MODELO', documento: '00000000000000', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', cidade: 'Três Coroas', uf: 'RS' },
      { id: 'c2', nome_principal: 'EMPRESA EXEMPLO LTDA', nome_fantasia: null, documento: '11111111111111', status: 'ativo', regime_tributario: 'Lucro Presumido', cnae_principal: '6201-5/01', cidade: 'Igrejinha', uf: 'RS' },
      { id: 'c3', nome_principal: 'OUTRA EMPRESA DE TESTE LTDA', nome_fantasia: null, documento: '22222222222222', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', cidade: 'Gramado', uf: 'RS' },
      { id: 'c9', nome_principal: '<img src=x onerror="window.__pego=1">', nome_fantasia: null, documento: '33333333333333', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: null, cidade: null, uf: null },
    ];
    v.carteira_info = (v.carteira_info || []).concat([{ cliente_id: 'c1', saida: null }, { cliente_id: 'c2', saida: null }]);
    v.rt_parametros = [{ chave: 'aliq_ref_2027', valor: { cbs: 11.3 } }];
    v.rt_casos = [{ id: 'rc1', cliente_id: 'c1', anexo: 'I', rbt12: 1200000, receita_mensal: 100000, sim_obs: SIM_OBS_JSON, atualizado_em: '2026-10-01T12:00:00Z' }];
    v.fr_empresas = [{ id: 'fe2', cliente_id: 'c2', nome: 'EMPRESA EXEMPLO LTDA', ativo: true }];
    v.fr_lancamentos = Array.from({ length: 12 }, (_, i) => ({ id: 'fl' + i, empresa_id: 'fe2', competencia: (i < 2 ? '2025-' + (11 + i) : '2026-' + String(i - 1).padStart(2, '0')) + '-01', folha_salarios: 10000, folha_outros: 0, prolabore: 5000 }));
    v.comparativos = [{ id: 'est3', cliente_id: 'c3', nome: null, entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 500000 }] }, origens: {} }, resultado: null, atualizado_em: '2026-10-30T12:00:00Z', atualizado_por: 'fiscal@macedoereis.com.br' }];
  } });
})();
""".replace('SIM_OBS_JSON', json.dumps(SIM_OBS))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def celula(p, regime, coluna):
    # a célula do regime (linha) e do ano (coluna 1 = os 12 meses)
    v = p.evaluate("""([reg, col]) => { const tr = [...document.querySelectorAll('#resultado table.ct:not(.ct-mini) tr')].find(t => t.cells[0] && t.cells[0].textContent.startsWith(reg)); return tr ? tr.cells[col].innerText : null; }""", [regime, coluna])
    return v.replace('\xa0', ' ') if v else v

def texto(p, sel):
    # o "R$" da moeda vem com espaço inquebrável
    return p.inner_text(sel).replace('\xa0', ' ')

def escolher(p, texto, nome):
    p.fill('#busca', '')
    p.type('#busca', texto)
    p.wait_for_selector('#sugestoes button', timeout=3000)
    p.locator('#sugestoes button', has_text=nome).first.click()
    p.wait_for_function("n => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === n", arg=nome, timeout=5000)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1440, 'height': 900})
        cx.route('**/cdnjs.cloudflare.com/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.clock.set_fixed_time('2026-11-01T12:00:00')

        print('1. A busca')
        p.goto(base + 'fiscal-comparativo.html')
        p.wait_for_selector('#busca', timeout=8000)
        p.type('#busca', 'img src')
        p.wait_for_selector('#sugestoes button', timeout=3000)
        ok('<img src=x' in p.inner_text('#sugestoes') and p.evaluate('() => window.__pego') is None, 'o nome com <img onerror> aparece como texto')
        escolher(p, 'modelo', 'COMÉRCIO MODELO ME')

        print('2. O que o sistema sabe e o resultado')
        p.wait_for_selector('#resultado table.ct', timeout=5000)
        ok(p.input_value('#regimeAtual') == 'simples', 'o regime de hoje vem do cadastro')
        ok('caso da Reforma' in p.inner_text('#escolhida') and 'sem folha no Fator R' in p.inner_text('#escolhida'), 'as fontes: o caso da Reforma e sem folha no Fator R')
        ok(p.input_value('#f_atividades_0_receita') == '1.200.000,00', f'a receita: a mensal do caso × 12 ({p.input_value("#f_atividades_0_receita")})')
        t = p.get_attribute('.ct-orig[data-orig="atividades.0.receita"]', 'data-fonte')
        ok(t == 'reforma', f'a origem da receita em verde (caso da Reforma) ({t})')
        ok(p.input_value('#f_compras') == '720.000,00', 'as compras: 60% da receita, do caso')
        ok(p.get_attribute('.ct-orig[data-orig="aliqCreditoIcms"]', 'data-fonte') == 'padrao' and p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'padrao',
           'o crédito de ICMS e as outras despesas ficam no padrão (amarelo)')
        frase = p.inner_text('.ct-frase')
        ok(frase.startswith('Em 2027, o Simples Nacional sai mais barato') and 'É o regime de hoje' in frase, f'a frase da decisão ({frase[:90]}…)')
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 105.900,00'), f'o DAS dos 12 meses: Anexo I, 4ª faixa ({celula(p, "Simples Nacional", 1)!r})')
        ok('mais barato' in celula(p, 'Simples Nacional', 2) and '(hoje)' in p.inner_text('#resultado table.ct'), 'o mais barato de 2027 marcado e o regime de hoje')
        ok('no PGDAS de ago/26 a alíquota efetiva foi 8,83%' in p.inner_text('#resultado'), 'a conferência com o PGDAS do caso')
        ok('até 31/12/2026' in p.inner_text('#resultado') and 'Res. CGSN 190' in p.inner_text('#resultado'), 'o prazo pra sair do Simples em 2027')
        p.click('details.ct-det > summary')
        ok('ICMS' in p.inner_text('details.ct-det') and 'Lucro antes do IR' in p.inner_text('details.ct-det'), 'o detalhe por tributo, com o lucro do Real')
        ok('crédito de ICMS das compras' in p.inner_text('#resultado'), 'o crédito de ICMS (padrão) é testado em "O que muda o resultado"')

        print('3. Mudar um número e gravar')
        antes = celula(p, 'Lucro Real', 2)
        p.fill('#f_outrasDespesas', '300000')
        p.wait_for_function("a => { const tr = [...document.querySelectorAll('#resultado table.ct:not(.ct-mini) tr')].find(t => t.cells[0] && t.cells[0].textContent.startsWith('Lucro Real')); return tr && tr.cells[2].innerText.replace(/\u00a0/g, ' ') !== a; }", arg=antes, timeout=3000)
        ok(p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'digitado', 'a origem vira "digitado"')
        ok(celula(p, 'Lucro Real', 2) != antes, 'o Real muda com as outras despesas')
        p.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c1')", timeout=5000)
        linha = p.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.comparativos.find(r => r.cliente_id === 'c1')))")
        ok(linha['entrada']['entrada']['outrasDespesas'] == 300000 and linha['resultado']['melhor'] and linha['atualizado_por'], f'o estudo gravou os números e o resumo ({linha["resultado"]["melhor"]})')
        p.wait_for_function("() => /Gravado às/.test(document.getElementById('gravado').textContent)", timeout=3000)
        ok(True, 'o aviso "Gravado às"')
        escolher(p, 'exemplo', 'EMPRESA EXEMPLO LTDA')
        escolher(p, 'modelo', 'COMÉRCIO MODELO ME')
        p.wait_for_selector('#f_outrasDespesas', timeout=3000)
        ok(p.input_value('#f_outrasDespesas') == '300.000,00' and 'Estudo gravado em' in p.inner_text('#gravado'), 'abrir de novo traz o estudo gravado')
        ok(p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'digitado', 'com a origem de cada número')

        print('4. Atividades')
        p.click('button[data-acao="mais"]')
        p.wait_for_selector('#f_atividades_1_receita', timeout=2000)
        ok(p.locator('#f_atividades_1_aliqIss').count() == 1, 'a atividade nova é serviço, com o ISS')
        p.fill('#f_atividades_1_receita', '100000')
        ok('R$ 1.300.000,00' in texto(p, '#totalRec'), 'a receita soma as duas')
        p.click('.ct-ativ[data-i="1"] button[data-acao="tirar"]')
        ok(p.locator('.ct-ativ').count() == 1 and 'R$ 1.200.000,00' in texto(p, '#totalRec'), 'o ✕ tira a atividade')
        p.select_option('#f_atividades_0_tipo', 'servico_r')
        p.wait_for_selector('#f_atividades_0_aliqIss', timeout=2000)
        ok(p.locator('#f_atividades_0_aliqIcms').count() == 0, 'serviço do fator r: o ISS no lugar do ICMS')
        p.select_option('#f_atividades_0_tipo', 'comercio')

        print('5. Só com o Fator R')
        escolher(p, 'exemplo', 'EMPRESA EXEMPLO LTDA')
        p.wait_for_selector('#f_folha', timeout=3000)
        ok(p.input_value('#f_folha') == '120.000,00' and p.input_value('#f_proLabore') == '60.000,00', 'a folha e o pró-labore do Fator R (12 meses)')
        ok(p.get_attribute('.ct-orig[data-orig="folha"]', 'data-fonte') == 'fator_r', 'a origem da folha: Fator R')
        ok('Informe a receita' in p.inner_text('#resultado'), 'sem receita, a tela pede a receita')
        p.fill('#f_atividades_0_receita', '600000')
        p.wait_for_selector('#resultado table.ct', timeout=3000)
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 63.360,00'), f'Simples: fator r de 31,6%, Anexo III, 3ª faixa ({celula(p, "Simples Nacional", 1)!r})')
        ok(celula(p, 'Lucro Presumido', 1).startswith('R$ 131.340,00'), f'Presumido dos 12 meses ({celula(p, "Lucro Presumido", 1)!r})')
        ok('A janela de 2027 fechou em 30/09/2026' in p.inner_text('#resultado'), 'quem está no Presumido: a janela do Simples de 2027 fechou')
        p.click('details.ct-det > summary')
        ok('31,6%' in p.inner_text('details.ct-det'), 'o fator r no detalhe')

        print('6. Sem cadastro')
        p.evaluate("() => { window.prompt = () => 'PROSPECT TESTE'; }")
        p.click('#semCadastro')
        p.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'PROSPECT TESTE'", timeout=3000)
        ok('sem cadastro no sistema' in p.inner_text('#escolhida') and p.input_value('#regimeAtual') == '', 'a empresa sem cadastro, sem regime de hoje')
        p.fill('#f_atividades_0_receita', '1200000')
        p.wait_for_selector('#resultado table.ct', timeout=3000)
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 105.900,00'), 'a conta roda sem cadastro')

        print('7. O card no Fiscal')
        p2 = cx.new_page()
        p2.on('pageerror', lambda e: erros.append('fiscal: ' + str(e)))
        p2.add_init_script(TOUR); p2.add_init_script(SEMEAR)
        p2.goto(base + 'fiscal.html')
        p2.wait_for_function("() => { const b = document.querySelector('.card-status[data-mod=\"fiscal-comparativo.html\"]'); return b && !b.classList.contains('st-load'); }", timeout=5000)
        selo = p2.text_content('.card-status[data-mod="fiscal-comparativo.html"]')
        ok(selo == '1 estudo', f'o card: "1 estudo" ({selo!r})')

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('tudo certo' if not falhas else f'{falhas} falha(s)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
