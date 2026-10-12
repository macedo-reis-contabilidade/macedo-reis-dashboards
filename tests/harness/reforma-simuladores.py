"""Teste das mudanças da Reforma vindas do módulo Simuladores do curso (fiscal-reforma.html, 12/10/2026):
indústria no Anexo I em 2027, o resultado "opte, se o comercial confirmar" com a margem da decisão, o ICMS/ISS do DAS fora
da base do débito por fora e o crédito das despesas por tipo.
Sem login e sem banco: mesmo mock do conferir.py. Casos, clientes e a tabela de partilha (inventados ou da norma) entram no
banco falso por uma armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-simuladores.py

Confere:
  1. a lista mostra "Simulado: opte, se confirmar" (com a margem no título) e o filtro traz só esses casos;
  2. na ficha de um caso com o PGDAS no Anexo II, aparece "IPI mantido", o anexo avisa que 2027 é no Anexo I e a partilha
     automática mostra a do Anexo I; o ISS fixo só aparece nos anexos de serviço;
  3. calculando o exercício da indústria (PGDAS no Anexo II, 85% de clientes PJ): "OPTE, SE O COMERCIAL CONFIRMAR", em
     âmbar, com os números do curso no Anexo I, a linha da base cheia e o DAS de 2027 no Anexo I; marcando IPI mantido,
     a conta volta ao Anexo II;
  4. a consultoria (Anexo V) sai "MANTENHA" com o selo "decisão apertada"; o crédito das despesas muda o custo por fora;
  5. gravar guarda o resultado, a margem e o anexo de 2027; a lista passa a mostrar o resultado novo;
  6. "Refazer simulações" leva um caso gravado como "por dentro" a "opte, se o comercial confirmar"; em quem já decidiu
     "por dentro", o fundamento automático não vira o texto do resultado novo — o resumo pede revisão;
  7. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CLIENTES = [
    {'id': 'rs1', 'nome_principal': 'INDÚSTRIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000401', 'cnae_principal': '1531-9/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'rs2', 'nome_principal': 'CONSULTORIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000402', 'cnae_principal': '7020-4/00', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 'rs3', 'nome_principal': 'FÁBRICA ANTIGA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000403', 'cnae_principal': '1531-9/02', 'cidade': 'Parobé', 'status': 'ativo'},
    {'id': 'rs4', 'nome_principal': 'ATELIÊ ÂMBAR DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000404', 'cnae_principal': '1531-9/02', 'cidade': 'Taquara', 'status': 'ativo'},
    {'id': 'rs5', 'nome_principal': 'FÁBRICA DECIDIDA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000405', 'cnae_principal': '1531-9/02', 'cidade': 'Rolante', 'status': 'ativo'},
]
def caso(n, cli, segmento, dentro=None, fora=None, sim_obs=None, status='triado'):
    return {'id': 'rsc' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '1531', 'segmento': segmento,
            'sinal_b2b': 2, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 3, 'triagem': 'simular',
            'perfil_validado': False, 'decisao': 'pendente', 'status': status, 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
            'sim_custo_dentro': dentro, 'sim_custo_fora': fora, 'sim_obs': sim_obs, 'obs': 'Triagem automática por CNAE (teste).'}
# exercício 4 do curso (indústria), como sai de um PGDAS de 2026 no Anexo II
ENT_IND = {'anexo': 'II', 'rbt12': 2400000, 'receita': 200000, 'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0,
           'pctComprasMercadorias': 60, 'pctComprasDespesas': 5, 'pctImpostoEmbutido': 18, 'pctExcluidoST': 0, 'partilha': 14,
           'cbs': 9.2, 'ibs': 0.1, 'pctPJ': 85, 'creditoEstoqueMes': 0}
FRASE_ANTIGA = 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 193.132,80 dentro do Simples…'
CASOS = [
    caso(1, 'rs1', 'industria'),
    caso(2, 'rs2', 'servicos'),
    # gravado antes de 12/10/2026 no Anexo II, como "por dentro": o Refazer leva ao Anexo I e ao resultado condicional
    caso(3, 'rs3', 'industria', 193132.80, 226539.00, json.dumps({'v': 1, 'input': ENT_IND, 'veredito': 'MANTENHA', 'frase': FRASE_ANTIGA, 'calculado_em': '2026-10-03'}, ensure_ascii=False), 'simulado'),
    # já gravado com o resultado novo: a lista mostra o chip âmbar com a margem no título
    caso(4, 'rs4', 'industria', 187432.80, 215731.47, json.dumps({'v': 1, 'input': {**ENT_IND, 'anexo': 'I', 'partilha': 15.5}, 'veredito': 'OPTE_SE',
         'frase': 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 215.731,47 pelo regime regular…', 'margem': 163.67, 'apertada': False,
         'virada': 32.24, 'anexo2027': 'I', 'calculado_em': '2026-10-12'}, ensure_ascii=False), 'simulado'),
    # decidido "por dentro" com a frase automática antiga: o resultado novo é por fora (condicional) — o fundamento não muda
    caso(5, 'rs5', 'industria', 193132.80, 226539.00, json.dumps({'v': 1, 'input': ENT_IND, 'veredito': 'MANTENHA', 'frase': FRASE_ANTIGA, 'calculado_em': '2026-10-03'}, ensure_ascii=False), 'decidido'),
]
CASOS[2]['fundamento'] = FRASE_ANTIGA
CASOS[4]['fundamento'] = FRASE_ANTIGA; CASOS[4]['decisao'] = 'por_dentro'
# tabela de partilha de 2027–2028 (Res. CGSN 190/2026) — a mesma de rt_parametros
def faixas(pcts):
    lims = [180000, 360000, 720000, 1800000, 3600000, 4800000]
    return [{'ate': l, 'cbs': p, 'ibs': 0, 'pct': p} for l, p in zip(lims, pcts)]
PARAMS = [
    {'chave': 'aliq_ref_2027', 'valor': {'cbs': 9.3, 'ibs': 0.1, 'cbs_aplicada': 9.2}},
    {'chave': 'partilha_cbs_ibs', 'valor': {'anexos': {
        'I': faixas([15.5, 15.5, 15.5, 15.5, 15.5, 34.02]), 'II': faixas([14, 14, 14, 14, 14, 25.22]), 'III': faixas([15.6, 17.1, 16.6, 16.6, 15.6, 19.29]),
        'IV': faixas([21.5, 25, 24, 23, 22, 24.7]), 'V': faixas([17.15, 17.15, 18.15, 19.15, 17.15, 19.78])}}},
]
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, PARAMS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
  } });
})();
""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(CASOS, ensure_ascii=False), json.dumps(PARAMS, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def linhas(p):
    return p.eval_on_selector_all('#rtLista tr', """trs => trs.map(tr => {
      const chip = tr.querySelector('td:nth-child(6) .rt-chip');
      return { nome: tr.querySelector('td:nth-child(2) b').textContent.trim(), chip: chip ? chip.textContent.trim() : '', classe: chip ? chip.className : '', titulo: chip ? chip.title : '' };
    })""")
br = lambda t: t.replace('\xa0', ' ')

def preencher(p, campos):
    for campo, valor in campos:
        p.fill(campo, valor)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        p = b.new_page(viewport={'width': 1500, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1500)

        # 1) lista e filtro
        por_nome = {l['nome']: l for l in linhas(p)}
        am = por_nome.get('ATELIÊ ÂMBAR DE TESTE LTDA', {})
        ok(am.get('chip') == 'Simulado: opte, se confirmar' and 't-ambar' in am.get('classe', ''), f'resultado condicional mostra "Simulado: opte, se confirmar" em âmbar ({am.get("chip")})')
        ok('margem da decisão 163,7%' in am.get('titulo', ''), 'a margem da decisão vai no título do chip')
        p.select_option('#rtFtri', 'sim_condicional'); p.wait_for_timeout(200)
        ok(sorted(l['nome'] for l in linhas(p)) == ['ATELIÊ ÂMBAR DE TESTE LTDA'], 'filtro "Simulado: opte, se confirmar"')
        p.select_option('#rtFtri', ''); p.wait_for_timeout(200)

        # 2) ficha da indústria: campos do anexo
        p.click('#rtLista tr:has-text("INDÚSTRIA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'II'); p.wait_for_timeout(100)
        ok(p.is_visible('#sIpiBox') and not p.is_visible('#sIssFixoBox'), 'Anexo II: aparece "IPI mantido"; o ISS fixo não')
        ok('Anexo I' in p.inner_text('#sAnexoHint'), f'o anexo avisa que 2027 é no Anexo I ({p.inner_text("#sAnexoHint")})')
        preencher(p, [('#sRbt12', '2.400.000,00'), ('#sReceita', '200.000,00'), ('#sMixCheia', '100'), ('#sMixRed60', '0'), ('#sMixRed40', '0'),
                      ('#sMixRed30', '0'), ('#sMixZero', '0'), ('#sPctMerc', '60'), ('#sPctDesp', '5'), ('#sPctEmb', '18'), ('#sPctST', '0'),
                      ('#sPctMono', '0'), ('#sPctPJ', '85'), ('#sEstoque', '0')])
        p.fill('#sPartilha', ''); p.select_option('#sAnexo', 'I'); p.select_option('#sAnexo', 'II'); p.wait_for_timeout(100)
        ok(p.input_value('#sPartilha') == '14' and '15,5%' in p.inner_text('#sPartilhaHint'), f'partilha automática do Anexo II com a do Anexo I de 2027 na dica ({p.input_value("#sPartilha")} · {p.inner_text("#sPartilhaHint")})')

        # 3) o exercício da indústria
        p.click('#bCalcular'); p.wait_for_timeout(300)
        verd = br(p.inner_text('#bVeredito'))
        ok(verd.startswith('OPTE, SE O COMERCIAL CONFIRMAR.'), 'veredito "OPTE, SE O COMERCIAL CONFIRMAR."')
        ok('ambar' in p.get_attribute('#bVeredito', 'class'), 'veredito em âmbar')
        ok('ambar' in p.get_attribute('#bRetratos .rt-ret:nth-child(2)', 'class'), 'o retrato "por fora" fica em âmbar')
        ret = br(p.inner_text('#bRetratos'))
        ok('R$ 187.432,80' in ret and 'R$ 215.731,47' in ret, 'custos do curso no Anexo I: R$ 187.432,80 por dentro e R$ 215.731,47 por fora')
        ok('margem da decisão: 163,7%' in verd and '32,2%' in verd, 'a frase traz a carteira de virada e a margem')
        ok('Com o ICMS do DAS' in verd and 'na base do débito por fora' in verd, 'mostra a conta com a base cheia (sem a exclusão do ICMS)')
        ok('DAS por dentro em 2027' in verd and 'Anexo I' in verd, 'avisa o DAS de 2027 no Anexo I')
        p.check('#sIpiMantido'); p.wait_for_timeout(100)
        ok('o de hoje' in p.inner_text('#sAnexoHint'), 'com IPI mantido o anexo de 2027 é o II')
        p.click('#bCalcular'); p.wait_for_timeout(300)
        ok('R$ 193.132,80' in br(p.inner_text('#bRetratos')), 'IPI mantido: custo por dentro no Anexo II (R$ 193.132,80)')
        p.uncheck('#sIpiMantido'); p.click('#bCalcular'); p.wait_for_timeout(300)

        # 5) gravar
        p.click('#bGravar'); p.wait_for_timeout(600)
        rc1 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'rsc1')")
        obs1 = json.loads(rc1.get('sim_obs') or '{}')
        ok(obs1.get('veredito') == 'OPTE_SE' and abs((obs1.get('margem') or 0) - 163.67) < 0.01 and obs1.get('anexo2027') == 'I' and obs1.get('input', {}).get('anexo') == 'II',
           f'gravou o resultado, a margem e o anexo de 2027 (veredito {obs1.get("veredito")}, margem {obs1.get("margem")}, anexo2027 {obs1.get("anexo2027")})')
        ok('ipiMantido' not in obs1.get('input', {}), 'sem IPI mantido, o campo não vai pra entrada')
        ok(p.inner_text('#fiTriagem').strip() == 'Simulado: opte, se confirmar', 'a ficha mostra o chip novo')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        ok({l['nome']: l for l in linhas(p)}.get('INDÚSTRIA DE TESTE LTDA', {}).get('chip') == 'Simulado: opte, se confirmar', 'a lista mostra o resultado gravado')

        # 4) consultoria: decisão apertada; crédito das despesas
        p.click('#rtLista tr:has-text("CONSULTORIA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'V'); p.wait_for_timeout(100)
        ok(p.is_visible('#sIssFixoBox') and not p.is_visible('#sIpiBox'), 'Anexo V: aparece o ISS fixo; o IPI mantido não')
        preencher(p, [('#sRbt12', '900.000,00'), ('#sReceita', '75.000,00'), ('#sMixCheia', '100'), ('#sMixRed60', '0'), ('#sMixRed40', '0'),
                      ('#sMixRed30', '0'), ('#sMixZero', '0'), ('#sPctMerc', '0'), ('#sPctDesp', '13,333333'), ('#sPctEmb', '5'), ('#sPctST', '0'),
                      ('#sPctMono', '0'), ('#sPartilha', '19,15'), ('#sPctPJ', '70'), ('#sEstoque', '0')])
        p.click('#bCalcular'); p.wait_for_timeout(300)
        verd = br(p.inner_text('#bVeredito'))
        ok(verd.startswith('MANTENHA a apuração no Simples.') and p.is_visible('#bVeredito .apertada'), 'consultoria: MANTENHA com o selo "decisão apertada"')
        ok('R$ 107.886,79' in br(p.inner_text('#bRetratos')), 'custo por fora do curso, com o ISS do DAS fora da base (R$ 107.886,79)')
        p.fill('#sPctDespCred', '70'); p.click('#bCalcular'); p.wait_for_timeout(300)
        ret70 = br(p.inner_text('#bRetratos'))
        # 10.000 de serviço com ISS de 5% embutido: o fornecedor destaca 618,45 em vez de 883,50 por mês — por dentro a empresa
        # paga 265,05 a menos de IBS/CBS embutido (× 6 = 1.590,30); por fora credita o mesmo que paga, e o custo não muda
        ok('R$ 87.410,70' in ret70 and 'R$ 107.886,79' in ret70, 'crédito das despesas a 70%: o custo por dentro cai R$ 1.590,30 no semestre (R$ 87.410,70); o por fora fica igual')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 6) refazer
        p.once('dialog', lambda d: d.accept())
        p.click('#btnRefazer')
        p.wait_for_selector('#ovRefazer.on', timeout=5000)
        resumo = p.inner_text('#refazerResumo')
        print('  · resumo: ' + ' | '.join(l for l in resumo.splitlines() if l.strip()))
        ok('FÁBRICA ANTIGA DE TESTE LTDA: por dentro → opte, se o comercial confirmar' in resumo, 'o Refazer leva o caso do Anexo II a "opte, se o comercial confirmar"')
        rc3 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'rsc3')")
        obs3 = json.loads(rc3.get('sim_obs') or '{}')
        ok(obs3.get('veredito') == 'OPTE_SE' and obs3.get('anexo2027') == 'I' and abs(float(rc3.get('sim_custo_dentro') or 0) - 187432.80) < 0.01,
           f'gravado no Anexo I de 2027 (custo por dentro {rc3.get("sim_custo_dentro")})')
        fund3 = br(str(rc3.get('fundamento', '')))
        ok(fund3.startswith('A simulação do primeiro semestre de 2027 indica custo tributário de R$ 215.731,47 pelo regime regular'), 'o fundamento automático foi trocado pela frase nova (' + fund3[:90] + '…)')
        ok('FÁBRICA DECIDIDA DE TESTE LTDA: decidido por dentro, resultado novo opte, se o comercial confirmar' in resumo, 'decisão gravada diferente do resultado novo aparece no resumo pra revisar')
        rc5 = p.evaluate("window.__mockDb.rt_casos.find(c => c.id === 'rsc5')")
        ok(rc5.get('fundamento') == FRASE_ANTIGA and json.loads(rc5['sim_obs']).get('veredito') == 'OPTE_SE', 'o fundamento de quem decidiu por dentro fica como estava; o resultado é regravado')
        p.click('#refazerFechar'); p.wait_for_timeout(200)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
