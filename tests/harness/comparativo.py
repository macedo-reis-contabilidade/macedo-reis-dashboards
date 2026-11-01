"""
Comparativo tributário (Fiscal, 01/11/2026, pedido do Samuel) — sem login e sem banco (o mock do conferir.py, com os
dados semeados só neste teste; nomes e números inventados). O relógio fica parado em 01/11/2026, meio-dia.

    python tests/harness/comparativo.py

Confere:
  1. a busca acha a empresa pelo nome (o nome com <img onerror> entra como texto);
  2. a empresa com caso na Reforma: o regime de hoje, a receita (receita mensal do caso × 12) e as compras com a origem
     em verde, o crédito de ICMS e as outras despesas em amarelo (padrão); o resultado — o Simples mais barato, o DAS dos
     12 meses de R$ 105.900,00 (Anexo I, 4ª faixa), a conferência com o PGDAS e o prazo pra sair do Simples até
     31/12/2026; o detalhe por tributo; sem a folha, o resultado é "Provisório", a fase 1 já vem concluída e a missão do
     próximo passo é a folha, na fase 2;
  3. mudar um número: a origem vira "digitado", a conta refaz e o estudo grava sozinho (cliente, os números e o resumo);
     abrir a empresa de novo traz o estudo gravado;
  4. outra atividade: entra com o ISS, soma na receita e sai no ✕; trocar o tipo pra serviço do fator r troca o ICMS
     pelo ISS;
  5. a empresa só com o Fator R: a folha e o pró-labore dele, a receita pedindo pra digitar; com a receita, o Simples
     no Anexo III (fator r de 31,6%) e o Presumido dos 12 meses;
  6. simular sem cadastro;
  7. "Por onde começar" em fases e missões, a refeição no RS e as empresas dos mesmos sócios: o restaurante do RS com
     12% e a base a 60% (padrão), a redução de 40% no DAS e o ST lidos do PGDAS do caso; a outra empresa do sócio (pelo
     CPF) com a receita dela e a soma perto do limite — a fase 1 abre com a missão da soma, com o mês em que passa;
     "Conferido" fecha a fase 1 (o aviso, com o alerta do limite, e a carinha comemora) e a tela segue pra fase 2, com a
     folha; "Digitar a folha" põe o cursor nela e a folha digitada cumpre a missão; a fase 4 vista antes da hora diz o que
     falta; sem a outra empresa, a missão vira extra; cumpridas as missões, "Pronto pra apresentar", o aviso final e o
     veredito; o resultado fica "Provisório" enquanto falta o que decide;
  8. o card no Fiscal: "1 estudo";
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
    const mesesDe = (ate, ini, fim) => { const out = []; for (let i = 0; i < 12; i++) { const d = new Date(2025, 7 + i, 1); const c = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); out.push({ competencia: c, total: c >= '2026-01' ? fim : ini, saidas: c >= '2026-01' ? fim : ini, servicos: 0, outros: 0 }); } return out; };
    v.clientes.push(
      { id: 'c5', nome_principal: 'RESTAURANTE EXEMPLO LTDA', nome_fantasia: null, documento: '44444444444444', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '5620-1/04', cidade: 'Três Coroas', uf: 'RS' },
      { id: 'c6', nome_principal: 'PADARIA IRMA LTDA', nome_fantasia: null, documento: '55555555555555', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '1091-1/02', cidade: 'Igrejinha', uf: 'RS' });
    v.socios = [{ id: 's1', cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '11122233344' }, { id: 's2', cliente_id: 'c5', nome: 'BELTRANA DE TAL', cpf: '55566677788' },
                { id: 's3', cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344' }];
    v.rt_casos.push(
      { id: 'rc5', cliente_id: 'c5', anexo: 'I', rbt12: 2405000, receita_mensal: 200416.67, atualizado_em: '2026-10-01T12:00:00Z', sim_obs: JSON.stringify({ v: 1,
        input: { anexo: 'I', receita: 200416.67, pctComprasMercadorias: 45, mixCheia: 8, mixRed40: 92, mixRed60: 0, mixRed30: 0, mixZero: 0, pctReceitaMonofasica: 8 },
        fontes: { mixCheia: 'seções do PGDAS 07/2026: revenda com ST (bebidas) — alíquota cheia por fora', pctExcluidoST: 'do Domínio: PGDAS 2026-07: 14% a menos (receita com ST/monofásico e redução de 40% na base do ICMS)' },
        dominio: { meses: mesesDe('2026-07', 180000, 215000), pgdas: { competencia: '2026-07', aliquotaEfetiva: 9.05, dasTotal: 19457.5 } } }) },
      { id: 'rc6', cliente_id: 'c6', anexo: 'II', rbt12: 2165000, receita_mensal: 180416.67, atualizado_em: '2026-10-01T12:00:00Z', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'II' },
        dominio: { meses: mesesDe('2026-07', 160000, 195000) } }) });
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
        frase = p.evaluate("() => { const f = document.querySelector('.ct-frase').cloneNode(true); f.querySelectorAll('.ct-prov-tag, .ct-pronto-tag').forEach(x => x.remove()); return f.textContent; }")
        ok(frase.startswith('Em 2027, o Simples Nacional sai mais barato') and 'É o regime de hoje' in frase, f'a frase da decisão ({frase[:90]}…)')
        ok(p.locator('.ct-frase .ct-prov-tag').count() == 1 and 'a folha e o pró-labore' in p.inner_text('#resultado'), 'sem a folha, o resultado é "Provisório" e diz o que falta')
        ok(not p.is_hidden('#roteiro') and p.locator('#trilha li').count() == 4 and p.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita',
           'por onde começar: as 4 fases, a 1ª já concluída (a receita veio do caso)')
        ok('Os números da empresa' in p.inner_text('#trilha li[aria-current="step"]'), 'a fase de agora é a 2, os números da empresa')
        ok('A folha e o pró-labore' in p.inner_text('#fase .ct-m.ct-prox') and 'próximo passo' in p.inner_text('#fase .ct-m.ct-prox'), 'a missão do próximo passo: a folha')
        ok(p.get_attribute('#fase .ct-m[data-id="compras"]', 'data-estado') == 'feita' and 'veio do caso da Reforma' in p.inner_text('#fase .ct-m[data-id="compras"]'),
           'a missão das compras, cumprida pelo caso da Reforma')
        ok('Missões:' in p.inner_text('#placar') and 'Provisório' in p.inner_text('#placar'), 'o placar: as missões cumpridas e o estudo provisório')
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

        print('7. Por onde começar: a refeição no RS e as empresas dos mesmos sócios')
        escolher(p, 'restaurante', 'RESTAURANTE EXEMPLO LTDA')
        p.wait_for_selector('#grupoSocios', timeout=5000)
        val = lambda sel: p.input_value(sel)
        fonte = lambda campo: p.get_attribute('.ct-orig[data-orig="' + campo + '"]', 'data-fonte')
        ok(val('#f_atividades_0_aliqIcms') == '12' and fonte('atividades.0.aliqIcms') == 'padrao', f'refeição no RS: 12%, padrão a conferir ({val("#f_atividades_0_aliqIcms")!r})')
        ok(val('#f_atividades_0_redIcms') == '40' and fonte('atividades.0.redIcms') == 'padrao', 'a base a 60% no regime geral (padrão)')
        ok(val('#f_atividades_0_redIcmsSimples') == '40' and fonte('atividades.0.redIcmsSimples') == 'reforma', 'a redução de 40% no DAS, lida do PGDAS do caso (verde)')
        ok(val('#f_atividades_0_pctST') == '8' and fonte('atividades.0.pctST') == 'reforma', 'a revenda com ST (as bebidas), lida do PGDAS do caso')
        g = p.inner_text('#grupoSocios')
        ok('PADARIA IRMA LTDA' in g and 'sócio em comum: FULANO DE TAL' in g, 'a outra empresa do sócio, achada pelo CPF')
        ok(val('#f_grupo_0_receita') == '2.165.000,00' and fonte('grupo.0.receita') == 'reforma', f'a receita dela, do caso da Reforma ({val("#f_grupo_0_receita")!r})')
        ok('R$ 4.570.000,00' in texto(p, '#grupoSocios') and 'passa do limite em dezembro' in g, 'a soma dos 12 meses e o mês em que o ano passa do limite')
        p.evaluate("() => { window.__festa = []; window.addEventListener('mr:comemorar', e => window.__festa.push(e.detail)); }")
        ok('Ela pode ficar no Simples?' in p.inner_text('#trilha li[aria-current="step"]'), 'a fase de agora é a 1: pode ficar no Simples?')
        prox = texto(p, '#fase .ct-m.ct-prox')
        ok('A receita somada com as empresas dos sócios' in prox and 'R$ 4.570.000' in prox and 'em dezembro' in prox and '01/01/2027' in prox,
           'a missão do próximo passo: a soma com a outra empresa e a saída em 01/01/2027')
        ok('Provisório' in p.inner_text('#placar'), 'o estudo é provisório')
        p.click('#fase .ct-m.ct-prox [data-conferir]')
        p.wait_for_function("() => !document.getElementById('banner').hidden", timeout=3000)
        ban = texto(p, '#banner')
        ok('Fase 1 concluída' in ban and 'passa do limite em dezembro' in ban and 'ct-alerta' in (p.get_attribute('#banner', 'class') or ''),
           f'"Conferido": a fase 1 fecha, com o aviso do limite ({ban[:80]}…)')
        ok(p.evaluate("() => window.__festa.length") == 1, 'a carinha do assistente comemora (o evento mr:comemorar)')
        ok(p.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita' and 'A folha e o pró-labore' in p.inner_text('#fase .ct-m.ct-prox'),
           'passou de fase: a tela segue pra fase 2 e o próximo passo é a folha')
        p.click('#fase .ct-m.ct-prox [data-ir]')
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'f_folha', '"Digitar a folha" põe o cursor na folha')
        p.fill('#f_folha', '480000')
        p.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"folha\"]'); return (m && m.dataset.estado === 'feita') || document.querySelector('#trilha li:nth-child(2)').dataset.estado === 'feita'; }", timeout=3000)
        p.click('#trilha button[data-fase="1"]')
        ok(p.get_attribute('#fase .ct-m[data-id="folha"]', 'data-estado') == 'feita' and 'digitado' in p.inner_text('#fase .ct-m[data-id="folha"]'), 'a folha digitada cumpre a missão (marcada como digitada)')
        p.click('#trilha button[data-fase="3"]')
        ok('Faltam' in p.inner_text('#fase') and p.get_attribute('#trilha button[data-fase="3"]', 'aria-pressed') == 'true', 'a fase 4, vista antes da hora, diz o que falta')
        p.click('#grupoSocios button[data-acao="tirar-grupo"]')
        p.wait_for_function("() => !document.getElementById('grupoSocios')", timeout=3000)
        p.wait_for_timeout(500)   # a conta refaz um instante depois
        p.click('#trilha button[data-fase="0"]')
        p.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"limite\"]'); return m && /As empresas dos sócios/.test(m.textContent); }", timeout=3000)
        lim = p.inner_text('#fase .ct-m[data-id="limite"]')
        ok('ficou fora da soma' in lim and p.get_attribute('#fase .ct-m[data-id="limite"]', 'data-estado') == 'feita',
           'sem a outra empresa: longe do limite, a missão vira extra e diz que a empresa achada ficou fora da soma')
        # jogar até o fim: cumprir as missões abertas (o "está certo") até o estudo ficar pronto
        for _ in range(14):
            if 'Pronto pra apresentar' in p.inner_text('#placar'): break
            feito = p.evaluate("""() => {
              const b = document.querySelector('#fase .ct-m[data-estado="aberta"] [data-conferir]');
              if (b) { b.click(); return 'conferiu'; }
              const atual = document.querySelector('#trilha li[aria-current="step"] button');
              if (atual && atual.getAttribute('aria-pressed') !== 'true') { atual.click(); return 'fase'; }
              return null; }""")
            if not feito: break
            p.wait_for_timeout(350)
        ok('Pronto pra apresentar' in p.inner_text('#placar') and p.locator('.ct-frase .ct-pronto-tag').count() == 1, 'cumpridas as missões, o estudo fica "Pronto pra apresentar"')
        ok('Estudo pronto pra apresentar' in texto(p, '#banner') and p.evaluate("() => window.__festa.some(d => d.recado)"), 'o aviso final, e a carinha dá o recado')
        ok('Ver o resultado' in p.inner_text('#fase') and 'sai mais barato' in p.inner_text('#fase .ct-veredito'), 'o veredito, na fase 4')

        print('8. O card no Fiscal')
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
