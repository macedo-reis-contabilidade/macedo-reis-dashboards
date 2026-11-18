"""Teste da simulação explicada na ficha da Reforma (fiscal-reforma.html, bloco B, 17/11/2026, pedido do Samuel): o
resultado do "Calcular" sai em palavras e em reais — o veredito, para quem a empresa vende (o ponto em que a conta muda),
os dois caminhos lado a lado, a conta passo a passo e o resumo pra copiar —, e o detalhe técnico de sempre fica recolhido
logo abaixo. Os textos vêm de assets/js/rt-explicado.js (as contas dele estão em tests/rt-explicado.test.mjs).
Sem login e sem banco: mesmo mock do conferir.py. Casos, clientes e a tabela de partilha (inventados ou da norma) entram no
banco falso por uma armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-explicado.py

Confere, com o relógio em 17/11/2026:
  1. a loja com 35% de clientes PJ: "Fique no DAS" com a diferença em reais, a etiqueta "A confirmar" e o quadro do que
     pode mudar o resultado; o detalhe técnico recolhido;
  2. a régua de para quem a empresa vende: as duas faixas na proporção certa, o ponto em que a conta muda (o mesmo da
     confiança dos números), o "hoje" no % do campo — e o campo "% clientes PJ" não muda;
  3. os dois caminhos, por mês e no semestre, com os selos e a frase da diferença;
  4. "Como chegamos": recolhido; aberto, os dez passos, a tabela do anexo com a faixa marcada, o fecho com o custo
     tributário do detalhe técnico e o que a conta supõe;
  5. o detalhe técnico abre com o veredito e os retratos de antes, com os mesmos números; quem abre fica com ele aberto na
     ficha seguinte (a escolha fica no navegador), e fechar também fica;
  6. "Copiar resumo" copia o texto com a empresa, os dois caminhos e o resultado; sem a área de transferência, mostra o
     texto pra copiar à mão;
  7. outro % de clientes PJ e "Calcular": "Depende dos clientes", com a faixa hachurada; gravar segue igual;
  8. erro na conta esconde o resultado; outra ficha abre sem resultado e com a conta passo a passo recolhida;
  9. sem conclusão (o número que decide foi deduzido): "Sem conclusão", por que, o que falta e a conta só de referência,
     nenhum caminho com "menor custo", sem o "Copiar resumo" — e o texto que veio de relatório aparece como texto, nunca
     como HTML;
  10. a farmácia com crédito de estoque: "Vale pagar por fora" por pouco, com a nota de que quem decide é o crédito dos
      clientes, "por mês, em média" e o crédito de estoque no quadro do que pode mudar;
  11. o mercado com crédito sobrando: a frase fecha com o saldo, que é a diferença do veredito;
  12. as duas cores dos caminhos, nos temas escuro e claro, com 3:1 ou mais de contraste sobre o fundo do painel;
  13. na largura de celular, nada do painel passa da borda dele;
  14. o botão "Opção registrada no portal" só aparece na decisão por fora (o hidden dele perdia pro estilo do botão);
  15. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

XSS = '<img src=x onerror="window.__xss=1">'
CLIENTES = [
    {'id': 're1', 'nome_principal': 'LOJA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000801', 'cnae_principal': '4781-4/00', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 're2', 'nome_principal': 'FARMÁCIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000802', 'cnae_principal': '4771-7/01', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 're3', 'nome_principal': 'MERCADO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000803', 'cnae_principal': '4712-1/00', 'cidade': 'Parobé', 'status': 'ativo'},
    {'id': 're4', 'nome_principal': 'ATACADO DEDUZIDO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000804', 'cnae_principal': '4649-4/99', 'cidade': 'Taquara', 'status': 'ativo'},
    {'id': 're5', 'nome_principal': 'FÁBRICA POR FORA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000805', 'cnae_principal': '1531-9/02', 'cidade': 'Rolante', 'status': 'ativo'},
]
def caso(n, cli, segmento, **extra):
    return {'id': 'rek' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': None, 'segmento': segmento,
            'sinal_b2b': 1, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 2, 'triagem': 'simular', 'perfil_validado': False,
            'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-11-10T10:00:00Z',
            'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'fundamento': None, 'obs': 'Triagem automática por CNAE (teste).', **extra}
# SEM CONCLUSÃO: a loja com tudo medido em 12 meses, menos o % de clientes PJ — 40%, deduzido (perto dos 43% em que a conta
# muda). O texto da dedução vem "de relatório", com HTML de propósito: tem de aparecer como texto
M12 = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
ENT4 = {'anexo': 'I', 'rbt12': 600000, 'aliqEfetivaInformada': None, 'receita': 50000, 'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0,
        'pctComprasComCredito': 100, 'pctComprasMercadorias': 50, 'pctComprasDespesas': 0, 'pctDespesasComCredito': None, 'pctImpostoEmbutido': 0, 'pctExcluidoST': 0,
        'pctReceitaMonofasica': 0, 'partilha': 15.5, 'cbs': 11.2, 'ibs': 0.1, 'pctPJ': 40, 'creditoEstoqueMes': 0}
PROC4 = {'receita': {'fonte': 'faturamento', 'meses': M12, 'texto': 'do Domínio: faturamento'}, 'rbt12': {'fonte': 'pgdas', 'meses': ['2026-09'], 'texto': 'do Domínio: PGDAS 2026-09'},
         'anexo': {'fonte': 'pgdas', 'meses': ['2026-09']}, 'aliqEfetiva': {'fonte': 'vazio'}, 'partilha': {'fonte': 'tabela'},
         'pctMerc': {'fonte': 'entradas', 'meses': M12, 'texto': 'do Domínio: entradas'}, 'pctDesp': {'fonte': 'manual'}, 'pctCred': {'fonte': 'notas', 'meses': M12, 'texto': 'das notas'},
         'pctEmb': {'fonte': 'notas', 'meses': M12, 'notas': 240, 'cobertura': 100, 'texto': 'das notas'},
         'pctPJ': {'fonte': 'deduzido', 'perfil': 'inventado', 'texto': 'deduzido: o relatório ' + XSS + ' diz que vende a empresas — confirme'},
         'mix': {'fonte': 'notas', 'meses': M12, 'texto': 'das notas'}}
DOM4 = {'faturamento': {'total': 600000, 'servicos': 0, 'saidas': 600000}, 'periodoRotulo': 'out/25–set/26', 'meses': [{'competencia': c, 'total': 50000} for c in M12],
        'pgdas': {'competencia': '2026-09', 'dasTotal': 3595, 'cbsNoDas': 557.23, 'aliquotaEfetiva': 7.19}}
CASOS = [
    caso(1, 're1', 'comercio'),
    caso(2, 're2', 'comercio'),
    caso(3, 're3', 'comercio'),
    caso(4, 're4', 'comercio', status='simulado', sim_custo_dentro=38520.00, sim_custo_fora=51310.12,
         sim_obs=json.dumps({'v': 1, 'input': ENT4, 'veredito': 'MANTENHA', 'frase': 'A simulação…', 'calculado_em': '2026-11-10', 'procedencia': PROC4, 'dominio': DOM4}, ensure_ascii=False)),
    caso(5, 're5', 'industria', decisao='por_fora', status='decidido', fundamento='Decisão de teste.'),
]
def faixas(pcts):
    lims = [180000, 360000, 720000, 1800000, 3600000, 4800000]
    return [{'ate': l, 'cbs': p, 'ibs': 0, 'pct': p} for l, p in zip(lims, pcts)]
# só a tabela de partilha: a CBS de 2027 é a padrão da tela (a referência do TCU, 11,3 − 0,1)
PARAMS = [{'chave': 'partilha_cbs_ibs', 'valor': {'anexos': {
    'I': faixas([15.5, 15.5, 15.5, 15.5, 15.5, 34.02]), 'II': faixas([14, 14, 14, 14, 14, 25.22]), 'III': faixas([15.6, 17.1, 16.6, 16.6, 15.6, 19.29]),
    'IV': faixas([21.5, 25, 24, 23, 22, 24.7]), 'V': faixas([17.15, 17.15, 18.15, 19.15, 17.15, 19.78])}}}]
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, PARAMS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
  } });
})();
""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(CASOS, ensure_ascii=False), json.dumps(PARAMS, ensure_ascii=False))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: (t or '').replace('\xa0', ' ')
def txt(p, sel): return br(p.inner_text(sel)).strip()

def abrir(p, nome):
    p.click(f'#rtLista tr:has-text("{nome}")'); p.wait_for_selector('#ovFicha.on', timeout=5000); p.wait_for_timeout(300)
def preencher(p, anexo, campos):
    if anexo: p.select_option('#sAnexo', anexo); p.wait_for_timeout(100)
    for campo, valor in campos: p.fill(campo, valor)
def calcular(p):
    p.click('#bCalcular'); p.wait_for_timeout(350)
LOJA = [('#sRbt12', '600.000,00'), ('#sReceita', '50.000,00'), ('#sMixCheia', '100'), ('#sPctMerc', '50'), ('#sPctDesp', '0'), ('#sPctEmb', '0'), ('#sPctPJ', '35')]
FARMACIA = [('#sRbt12', '1.800.000,00'), ('#sReceita', '150.000,00'), ('#sMixCheia', '20'), ('#sMixRed60', '70'), ('#sMixZero', '10'), ('#sPctMerc', '60'), ('#sPctDesp', '5,333333'),
            ('#sPctEmb', '18'), ('#sPctST', '49'), ('#sPctMono', '100'), ('#sPctPJ', '10'), ('#sEstoque', '1.541,67')]
MERCADO = [('#sRbt12', '1.500.000,00'), ('#sReceita', '125.000,00'), ('#sMixCheia', '30'), ('#sMixZero', '70'), ('#sPctMerc', '85'), ('#sPctCred', '90'), ('#sPctEmb', '0'), ('#sPctPJ', '0')]

# as faixas da régua: o tipo e a largura de cada uma, em % da régua
ZONAS = """() => { const r = document.getElementById('rxZonas').getBoundingClientRect();
  return [...document.querySelectorAll('#rxZonas .rx-zona')].map(z => ({ k: z.className.replace('rx-zona', '').trim(), w: z.getBoundingClientRect().width / r.width * 100 })); }"""
POS = "(id) => { const r = document.getElementById('rxZonas').getBoundingClientRect(), e = document.getElementById(id).getBoundingClientRect(); return (e.left + e.width / 2 - r.left) / r.width * 100; }"
# contraste (WCAG) entre a cor de uma marca e o fundo do painel
CONTRASTE = """(sel) => { const cor = c => { const m = c.match(/[\\d.]+/g).map(Number); return m.slice(0, 3); };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const a = lum(cor(getComputedStyle(document.querySelector(sel)).backgroundColor)), b = lum(cor(getComputedStyle(document.getElementById('rxPainel')).backgroundColor));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }"""

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1500, 'height': 1000})
        cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.clock.set_fixed_time('2026-11-17T12:00:00')
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_selector('#rtLista tr', timeout=8000); p.wait_for_timeout(600)

        print('1. O veredito em palavras')
        abrir(p, 'LOJA DE TESTE LTDA')
        ok(not p.is_visible('#bSaida'), 'a ficha abre sem resultado na tela')
        preencher(p, 'I', LOJA); calcular(p)
        ok(p.is_visible('#rxPainel') and p.get_attribute('#rxPainel', 'data-chave') == 'dentro' and txt(p, '#rxTexto') == 'Fique no DAS', f'loja com 35% de clientes PJ: "Fique no DAS" ({txt(p, "#rxTexto")})')
        ok(txt(p, '#rxPorque') == 'Pagar a CBS e o IBS por fora custaria R$ 12.790,12 a mais de janeiro a junho de 2027, perto de R$ 2.131,69 por mês.' and txt(p, '#rxPorque b') == 'R$ 12.790,12 a mais',
           f'o porquê em reais, com a diferença em negrito ({txt(p, "#rxPorque")})')
        ok(p.eval_on_selector_all('#rxTags .rx-tag', 'ts => ts.map(t => t.textContent)') == ['A confirmar'], 'os números foram digitados, sem relatório: a etiqueta "A confirmar"')
        at = txt(p, '#rxAtencao')
        ok(p.is_visible('#rxAtencao') and at.startswith('O que pode mudar este resultado') and 'Vendas a clientes que aproveitam o crédito (35,0% da receita, confiança média): com 45,0% da receita, o resultado passa a ser “opte, se o comercial confirmar” — vira a partir de 43,0% da receita.' in at,
           'o quadro do que pode mudar o resultado traz o número, a confiança e o efeito, em uma frase')
        ok(not p.is_visible('#rxFalta') and p.is_visible('#rxCopiar'), 'com conclusão: sem o quadro vermelho e com o "Copiar resumo"')
        ok(p.evaluate("!document.getElementById('bDetalhe').open") and not p.is_visible('#bVeredito') and p.is_visible('#bDetalhe > summary'), 'o detalhe técnico fica recolhido, com a linha pra abrir')
        ok(p.is_visible('.rt-refs .ref[data-regra="PARTILHA-DAS-2027"]') and p.is_visible('#bNotaAliq'), 'a nota das alíquotas e os códigos da base legal seguem à vista')

        print('2. Para quem a empresa vende')
        zs = p.evaluate(ZONAS)
        ok([z['k'] for z in zs] == ['dentro', 'se'] and abs(zs[0]['w'] - 43.0) < 0.6 and abs(zs[1]['w'] - 57.0) < 0.6, f'duas faixas na proporção: fica no DAS até 43%, depois depende dos clientes ({[(z["k"], round(z["w"], 1)) for z in zs]})')
        ok(abs(p.evaluate(POS, 'rxPino') - 35) < 0.4 and p.is_visible('#rxVira') and abs(p.evaluate(POS, 'rxVira') - 43.0) < 0.4, f'o "hoje" em 35% e a marca da virada em 43% ({p.evaluate(POS, "rxPino"):.1f}% · {p.evaluate(POS, "rxVira"):.1f}%)')
        leg = p.eval_on_selector_all('#rxLegenda li', 'ls => ls.map(l => l.textContent.trim())')
        ok(leg == ['fica no DAS', 'depende dos clientes', 'a conta muda em 43%', 'hoje: 35% (o “% clientes PJ” da ficha)'], f'a legenda diz cada faixa, o ponto da virada e o hoje ({leg})')
        ok(txt(p, '#rxDepois') == 'A conta muda se 43% ou mais das vendas forem para empresas que usam o crédito. Hoje: 35%.', f'a frase da régua ({txt(p, "#rxDepois")})')
        ok(p.get_attribute('#rxRegua', 'role') == 'img' and p.get_attribute('#rxRegua', 'aria-label') == 'De 0% a 43% das vendas para empresas que usam o crédito: fica no DAS. De 43% a 100%: depende dos clientes. Hoje: 35%.', 'a régua é lida em uma frase pelo leitor de tela')
        ok(p.input_value('#sPctPJ') == '35', 'a régua só mostra: o campo "% clientes PJ" segue em 35')

        print('3. Os dois caminhos')
        ok(txt(p, '#rxLinhasDentro .rx-total') .replace('\n', ' ') == 'Paga por mês R$ 3.595,00' and txt(p, '#rxLinhasFora .rx-total').replace('\n', ' ') == 'Paga por mês R$ 5.726,69', 'por mês: R$ 3.595,00 por dentro e R$ 5.726,69 por fora')
        ok(p.eval_on_selector_all('#rxLinhasFora > .rx-linha .r', 'rs => rs.map(r => r.textContent)') == ['DAS sem a CBS e o IBS', 'CBS e IBS das vendas', 'Crédito das compras', 'CBS e IBS a pagar'], 'por fora: o DAS que sobra, o imposto das vendas, o crédito das compras e o que fica a pagar')
        ok(txt(p, '#rxSeloDentro') == 'menor custo' and 'ok' in p.get_attribute('#rxSeloDentro', 'class') and txt(p, '#rxSeloFora') == 'mais crédito ao cliente', 'o selo do menor custo por dentro e o do crédito ao cliente por fora')
        cli = [txt(p, '#rxLinhasDentro .rx-cliente').replace('\n', ' '), txt(p, '#rxLinhasFora .rx-cliente').replace('\n', ' ')]
        ok(cli == ['Crédito dos clientes empresa (35% das vendas) R$ 195,03', 'Crédito dos clientes empresa (35% das vendas) R$ 1.929,87'], f'o crédito que os clientes empresa descontam: o das notas vezes os 35% vendidos a empresas ({cli})')
        larg = p.evaluate("() => ['rxLinhasDentro', 'rxLinhasFora'].map(id => { const m = document.querySelector('#' + id + ' .rx-medida'); return m.getBoundingClientRect().width / m.parentElement.getBoundingClientRect().width * 100; })")
        ok(abs(larg[1] - 100) < 0.5 and abs(larg[0] - 3595 / 5726.69 * 100) < 0.8, f'a barra de cada caminho na proporção do que se paga ({larg[0]:.1f}% e {larg[1]:.1f}%)')
        ok(txt(p, '#rxDif') == 'Por fora a empresa paga R$ 2.131,69 a mais por mês.', f'a frase da diferença ({txt(p, "#rxDif")})')
        p.click('#rxPerSem'); p.wait_for_timeout(100)
        ok(txt(p, '#rxLinhasDentro .rx-total').replace('\n', ' ') == 'Paga no semestre R$ 21.570,00' and txt(p, '#rxLinhasFora .rx-total').replace('\n', ' ') == 'Paga no semestre R$ 34.360,12'
           and txt(p, '#rxDif') == 'Por fora a empresa paga R$ 12.790,12 a mais no semestre.' and p.get_attribute('#rxPerSem', 'aria-pressed') == 'true' and p.get_attribute('#rxPerMes', 'aria-pressed') == 'false',
           '"no semestre" troca os valores e a frase, sem refazer a conta')
        p.click('#rxPerMes'); p.wait_for_timeout(100)

        print('4. Como chegamos')
        ok(p.evaluate("!document.getElementById('rxConta').open") and not p.is_visible('#rxPassos'), 'a conta passo a passo começa recolhida')
        p.click('#rxConta > summary'); p.wait_for_timeout(150)
        titulos = p.eval_on_selector_all('#rxPassos > li .rx-passo-t', 'ts => ts.map(t => t.textContent)')
        ok(len(titulos) == 10 and titulos[0] == 'A alíquota do Simples' and titulos[9] == 'O crédito de quem compra da empresa', f'aberta, os dez passos ({len(titulos)})')
        ok(txt(p, '#rxPassos > li:nth-child(10) .rx-formula') == 'Por dentro: R$ 557,23 × 35% = R$ 195,03 por mês · Por fora: R$ 5.513,91 × 35% = R$ 1.929,87 por mês', 'o passo 10 mostra a conta do crédito dos clientes')
        formulas = [br(f) for f in p.eval_on_selector_all('#rxPassos > li .rx-formula', 'fs => fs.map(f => f.textContent)')]
        ok(formulas[0] == '(R$ 600.000,00 × 9,50% − R$ 13.860,00) ÷ R$ 600.000,00 = 7,19%' and formulas[1] == 'R$ 50.000,00 × 7,19% = R$ 3.595,00' and formulas[6] == 'R$ 25.000,00 × 11,30% = R$ 2.825,00',
           f'as contas escritas: a alíquota, o DAS e o crédito das compras ({formulas[0]})')
        p.click('#rxPassos > li:first-child .rx-tabela > summary'); p.wait_for_timeout(100)
        ok(p.eval_on_selector_all('#rxPassos .rx-tab tbody tr', 'trs => trs.length') == 6 and txt(p, '#rxPassos .rx-tab tr.aqui td:first-child') == '3ª', 'a tabela do Anexo I, com a 3ª faixa marcada')
        fecho = txt(p, '#rxFecho')
        ok('R$ 38.520,00 por dentro e R$ 51.310,12 por fora no semestre' in fecho, 'o fecho liga a conta ao custo tributário do detalhe técnico')
        ok(p.eval_on_selector_all('#rxPremissas li', 'ls => ls.length') == 6 and txt(p, '#rxPremissas li:first-child').startswith('CBS de 11,20% e IBS de 0,10% em 2027. A alíquota de referência de 11,3% foi calculada pelo TCU em 28/10/2026'),
           'e o que a conta supõe, com a referência da CBS')

        print('5. O detalhe técnico')
        p.click('#bDetalhe > summary'); p.wait_for_timeout(150)
        verd = txt(p, '#bVeredito'); ret = txt(p, '#bRetratos')
        ok(verd.startswith('MANTENHA a apuração no Simples.') and 'R$ 38.520,00' in ret and 'R$ 51.310,12' in ret and p.is_visible('#bMeses'), 'aberto, o veredito, os retratos e o mês a mês de antes, com os mesmos números')
        ok(p.evaluate("localStorage.getItem('mr_reforma_detalhe')") == '1', 'a escolha de deixar aberto fica no navegador')

        print('6. Copiar resumo')
        p.click('#rxCopiar'); p.wait_for_timeout(250)
        copiado = p.evaluate('navigator.clipboard.readText()')
        linhas = copiado.split('\n')
        ok(txt(p, '#rxCopiado') == '✓ Resumo copiado' and linhas[:3] == ['Simples em 2027: CBS e IBS por dentro ou por fora do DAS', 'LOJA DE TESTE LTDA', 'Macedo & Reis Contabilidade · simulação de 17/11/2026'],
           f'copiou: o assunto, a empresa e a data ({linhas[:3]})')
        ok('Tudo no DAS (por dentro): R$ 3.595,00 por mês · R$ 21.570,00 no semestre' in copiado and 'Resultado para janeiro a junho de 2027: Fique no DAS.' in copiado
           and 'A conta muda se 43% ou mais das vendas forem para empresas que usam o crédito. Hoje: 35%.' in copiado and '\xa0' not in copiado and '<' not in copiado
           and 'Crédito que os clientes empresa descontam (35% das vendas): R$ 195,03 por mês por dentro · R$ 1.929,87 por fora' in copiado,
           'com os dois caminhos em reais, o crédito dos clientes, o resultado e a frase da régua, em texto puro')
        ok('Este resultado ainda depende de confirmar: ' in copiado and copiado.strip().endswith('A decisão é da empresa.'), 'diz o que falta confirmar e fecha com "A decisão é da empresa."')
        p.evaluate("() => { navigator.clipboard.writeText = () => Promise.reject(new Error('sem permissão')); }")
        p.click('#rxCopiar'); p.wait_for_timeout(250)
        ok(p.is_visible('#rxCopiaManual') and p.input_value('#rxCopiaTexto') == copiado and txt(p, '#rxCopiado') == '', 'sem a área de transferência: o texto aparece pra copiar à mão')

        print('7. Outro % de clientes PJ, e gravar')
        p.fill('#sPctPJ', '60'); calcular(p)
        ok(txt(p, '#rxTexto') == 'Depende dos clientes' and p.get_attribute('#rxPainel', 'data-chave') == 'se' and abs(p.evaluate(POS, 'rxPino') - 60) < 0.4, 'com 60% de clientes PJ: "Depende dos clientes", com o hoje em 60%')
        ok('mas os clientes empresa descontam' in txt(p, '#rxPorque') and 'comercial que confirma' in txt(p, '#rxNota'), 'o porquê e a nota do comercial')
        ok(txt(p, '#rxDepois') == 'Com menos de 43% das vendas para empresas que usam o crédito, o melhor é ficar no DAS. Hoje: 60%.', f'a frase da régua pelo outro lado ({txt(p, "#rxDepois")})')
        ok(not p.is_visible('#rxCopiaManual') and txt(p, '#rxCopiado') == '' and p.evaluate("document.getElementById('rxConta').open"), 'o novo cálculo limpa o aviso de cópia e mantém a conta aberta')
        ok(txt(p, '#bVeredito').startswith('OPTE, SE O COMERCIAL CONFIRMAR.'), 'e o detalhe técnico, aberto, acompanha')
        p.click('#bGravar'); p.wait_for_timeout(600)
        g = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'rek1')")
        obs = json.loads(g.get('sim_obs') or '{}')
        ok(obs.get('veredito') == 'OPTE_SE' and obs.get('input', {}).get('pctPJ') == 60 and g.get('status') == 'simulado' and p.is_visible('#rxPainel'), 'gravar segue como antes, com o resultado na tela')

        print('8. Erro na conta e outra ficha')
        p.fill('#sRbt12', ''); calcular(p)
        ok(not p.is_visible('#bSaida') and 'RBT12' in txt(p, '#bMsg'), 'sem o RBT12: o resultado some e a mensagem diz o que falta')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        abrir(p, 'FARMÁCIA DE TESTE LTDA')
        ok(not p.is_visible('#bSaida') and p.evaluate("!document.getElementById('rxConta').open") and p.evaluate("document.getElementById('bDetalhe').open"),
           'outra ficha: sem resultado, a conta passo a passo recolhida e o detalhe técnico como a pessoa deixou (aberto)')

        print('10. Vale por fora por pouco, com crédito de estoque')
        preencher(p, 'I', FARMACIA); calcular(p)
        ok(txt(p, '#rxTexto') == 'Vale pagar por fora' and p.get_attribute('#rxPainel', 'data-chave') == 'fora' and 'o custo da empresa cai R$ 540,25' in txt(p, '#rxPorque'), f'farmácia: "Vale pagar por fora" ({txt(p, "#rxPorque")})')
        ok(txt(p, '#rxNota').startswith('A economia da empresa é pequena, abaixo dos R$ 2.700,00 que o escritório considera para mudar de regime. O que pesa é o crédito dos clientes empresa'), 'a nota diz que quem decide é o crédito dos clientes')
        ok([z['k'] for z in p.evaluate(ZONAS)] == ['dentro', 'fora'] and txt(p, '#rxDepois').startswith('Com menos de 7,6% das vendas para empresas que usam o crédito, o resultado é ficar no DAS. Hoje: 10%.'), 'a régua: fica no DAS até 7,6%, depois vale por fora')
        ok('Paga por mês, em média' in txt(p, '#rxLinhasFora .rx-total') and 'Crédito de estoque' in txt(p, '#rxLinhasFora') and txt(p, '#rxSeloFora') == 'menor custo', 'com crédito de estoque: "por mês, em média", a linha do estoque e o menor custo por fora')
        ok('Crédito de estoque (R$ 1.542/mês, provável): sem o crédito de estoque, o resultado passa a ser “manter dentro do DAS”.' in txt(p, '#rxAtencao'), 'e o crédito de estoque, que é provável, no quadro do que pode mudar o resultado')
        p.click('#rxConta > summary'); p.wait_for_timeout(150)
        ok('Aqui a diferença é menor, mas eles descontam' in txt(p, '#rxPassos > li:nth-child(9)'), 'o passo 9 explica por que não é empate')
        p.click('#bDetalhe > summary'); p.wait_for_timeout(150)
        ok(p.evaluate("localStorage.getItem('mr_reforma_detalhe')") == '0' and not p.is_visible('#bVeredito'), 'fechar o detalhe técnico também fica guardado')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        print('11. Crédito sobrando')
        abrir(p, 'MERCADO DE TESTE LTDA')
        ok(p.evaluate("!document.getElementById('bDetalhe').open"), 'na ficha seguinte, o detalhe técnico abre recolhido, como ficou')
        preencher(p, 'I', MERCADO); calcular(p)
        ok(txt(p, '#rxTexto') == 'Vale pagar por fora' and 'R$ 50.887,35' in txt(p, '#rxPorque'), f'mercado com muita compra: por fora ({txt(p, "#rxPorque")})')
        ok(txt(p, '#rxDif') == 'Por fora a empresa paga R$ 1.782,50 a menos por mês e fica com R$ 6.698,72 de crédito para abater depois. Contando esse crédito, o caminho por fora sai R$ 8.481,22 mais barato.',
           f'a frase fecha com o saldo: R$ 8.481,22 por mês, os R$ 50.887,35 do semestre ({txt(p, "#rxDif")})')
        ok([z['k'] for z in p.evaluate(ZONAS)] == ['fora'] and not p.is_visible('#rxVira') and abs(p.evaluate(POS, 'rxPino')) < 0.4, 'a régua é uma faixa só, sem ponto de virada, com o hoje em 0%')
        ok('Crédito dos clientes empresa (hoje, sem vendas para empresas)' in txt(p, '#rxLinhasFora .rx-cliente') and txt(p, '#rxSeloDentro') == '' and txt(p, '#rxNota') == '',
           'sem vendas para empresas: ninguém desconta crédito, e a tela não diz que o cliente ganha')
        p.click('#rxConta > summary'); p.wait_for_timeout(150)
        ok('o crédito é maior. Nada a pagar, e sobram' in txt(p, '#rxPassos > li:nth-child(8) .rx-formula'), 'o passo 8 diz que o crédito é maior e quanto sobra')

        print('12. As cores dos dois caminhos, nos dois temas')
        cores = p.evaluate("() => { const s = getComputedStyle(document.getElementById('rxPainel')); return [s.getPropertyValue('--rx-dentro').trim(), s.getPropertyValue('--rx-fora').trim()]; }")
        c1, c2 = p.evaluate(CONTRASTE, '#rxLinhasDentro .rx-medida'), p.evaluate(CONTRASTE, '#rxLinhasFora .rx-medida')
        ok(cores == ['#4F8AD0', '#BE8847'] and c1 >= 3 and c2 >= 3, f'tema escuro: azul {cores[0]} e bronze {cores[1]}, com {c1:.1f}:1 e {c2:.1f}:1 sobre o fundo do painel')
        p.evaluate("document.documentElement.setAttribute('data-theme', 'light')"); p.wait_for_timeout(100)
        cores = p.evaluate("() => { const s = getComputedStyle(document.getElementById('rxPainel')); return [s.getPropertyValue('--rx-dentro').trim(), s.getPropertyValue('--rx-fora').trim()]; }")
        c1, c2 = p.evaluate(CONTRASTE, '#rxLinhasDentro .rx-medida'), p.evaluate(CONTRASTE, '#rxLinhasFora .rx-medida')
        ok(cores == ['#3A70B4', '#B9792A'] and c1 >= 3 and c2 >= 3, f'tema claro: azul {cores[0]} e bronze {cores[1]}, com {c1:.1f}:1 e {c2:.1f}:1')
        p.evaluate("document.documentElement.removeAttribute('data-theme')")

        print('13. Na largura de celular')
        p.set_viewport_size({'width': 400, 'height': 800}); p.wait_for_timeout(200)
        fora_da_borda = p.evaluate("""() => { const pn = document.getElementById('rxPainel'), r = pn.getBoundingClientRect();
          // a tabela do anexo pode ser mais larga: rola dentro da caixa dela (.rx-rolagem), que é quem tem de caber
          const dentroDaRolagem = e => { const c = e.closest('.rx-rolagem'); return c && c !== e; };
          return [...pn.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && e.id !== 'rxPino' && !dentroDaRolagem(e) && (b.right > r.right + 1 || b.left < r.left - 1); }).map(e => e.className || e.tagName).slice(0, 5); }""")
        ok(fora_da_borda == [], f'nada do painel passa da borda dele ({fora_da_borda})')
        p.click('#rxPassos > li:first-child .rx-tabela > summary'); p.wait_for_timeout(100)
        rol = p.evaluate("() => { const c = document.querySelector('#rxPassos .rx-rolagem'), r = document.getElementById('rxPainel').getBoundingClientRect(), b = c.getBoundingClientRect(); return { cabe: b.right <= r.right + 1, rola: c.scrollWidth > c.clientWidth }; }")
        ok(rol['cabe'] and rol['rola'], f'a tabela do anexo, mais larga que a tela, rola dentro da caixa dela ({rol})')
        ok(p.evaluate("getComputedStyle(document.querySelector('.rx-acoes')).position") == 'static' and p.is_visible('#rxCopiar'), 'e o "Copiar resumo" desce pra linha de cima da conta')
        p.set_viewport_size({'width': 1500, 'height': 1000}); p.wait_for_timeout(200)
        ok(not p.is_visible('#dOpcao'), 'decisão pendente: sem o botão "Opção registrada no portal"')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        print('9. Sem conclusão')
        abrir(p, 'ATACADO DEDUZIDO DE TESTE LTDA')
        calcular(p)
        ok(txt(p, '#rxTexto') == 'Sem conclusão' and p.get_attribute('#rxPainel', 'data-chave') == 'semconc' and txt(p, '#rxPorque') == 'Os dados de hoje não sustentam uma decisão.', f'o % de clientes PJ foi deduzido e decide: "Sem conclusão" ({txt(p, "#rxTexto")})')
        falta = txt(p, '#rxFalta')
        ok(p.is_visible('#rxFalta') and falta.startswith('Por que não há conclusão') and 'a conta daria “manter dentro do DAS”, mas este número, sem base suficiente (deduzido, não medido), muda o resultado:' in falta
           and 'Vendas a clientes que aproveitam o crédito: 40,0% da receita, deduzido, não medido.' in falta, 'o quadro diz o que a conta daria e qual número não tem base')
        ok('Para concluir, falta: ' in falta and 'Conta provisória, só para referência (não é recomendação): Fique no DAS. Pagar a CBS e o IBS por fora custaria' in falta, 'o que falta pra concluir e a conta só de referência')
        ok(p.evaluate("window.__xss === undefined") and p.eval_on_selector_all('#rxPainel img', 'is => is.length') == 0 and XSS in falta, 'o texto que veio do relatório, com HTML, aparece como texto')
        ok(p.eval_on_selector_all('#rxPainel .rx-selo.ok', 'ss => ss.length') == 0 and not p.is_visible('#rxCopiar') and p.eval_on_selector_all('#rxTags .rx-tag', 'ts => ts.length') == 0,
           'nenhum caminho leva o "menor custo", e não há resumo pra copiar')
        ok(txt(p, '#rxDepois').startswith('Pela conta provisória: a conta muda se 43% ou mais das vendas forem para empresas que usam o crédito. Hoje: 40%.'), f'a frase da régua avisa que é a conta provisória ({txt(p, "#rxDepois")})')
        p.click('#bDetalhe > summary'); p.wait_for_timeout(150)
        ok('semconc' in (p.get_attribute('#bVeredito', 'class') or '') and txt(p, '#bVeredito').startswith('SEM CONCLUSÃO'), 'e o detalhe técnico diz o mesmo')
        p.click('#bDetalhe > summary'); p.wait_for_timeout(100)
        p.click('#fiFechar'); p.wait_for_timeout(300)

        print('14. O botão da opção registrada')
        abrir(p, 'FÁBRICA POR FORA DE TESTE LTDA')
        ok(p.is_visible('#dOpcao'), 'decisão por fora: o botão "Opção registrada no portal" aparece')
        p.click('#fiFechar'); p.wait_for_timeout(200)

        print('15. Sem erro')
        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close(); cx.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
