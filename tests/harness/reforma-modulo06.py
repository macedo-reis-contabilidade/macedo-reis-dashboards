"""Teste das mudanças da Reforma vindas do Módulo 06 do curso (regimes específicos e notas fiscais) na ficha
(fiscal-reforma.html, 13/10/2026): a dica do campo "Crédito das despesas (% do cheio)" com o aluguel de imóvel e com
VR, VA e plano de saúde dos empregados; e a análise de uma cozinha de refeições para empresas (CNAE 5620-1/01).
Sem login e sem banco: mesmo mock do conferir.py. Cliente e caso (inventados) entram no banco falso por uma armadilha em
window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.
(O CT-e e o MDF-e no importador estão em tests/harness/importar-xml.py; os textos da análise — refeição por contrato
nos bares, transporte e a fonte do crédito das despesas — em tests/rt-analise.test.mjs.)

    python tests/harness/reforma-modulo06.py

Confere:
  1. a dica do campo diz quanto credita o aluguel (30% se o locador for do regime regular; nada se for pessoa física não
     contribuinte) e que VR, VA e plano de saúde creditam só o débito do fornecedor, sem perder a linha do −30% — que,
     desde o Módulo 07 (13/10/2026), vale só com prestador do regime regular que cumpre os requisitos do art. 127
     (prestador do Simples por dentro dá só o IBS/CBS do DAS dele, cerca de 15% do cheio; serviço com −60% credita 40%);
  2. o título do campo cita os artigos (LC 214, art. 261, parágrafo único, e art. 57, §3º, IV, na redação da LC 227);
  3. numa cozinha de refeições para empresas — o caso só com 4 dígitos do CNAE (5620) e o cadastro com a subclasse
     5620-1/01 —, a ficha calcula "opte, se o comercial confirmar" e a análise sai como venda a empresas: atividade
     "refeições para empresas", a pergunta dos contratos de refeição, a pendência e a sensibilidade do enquadramento no
     regime de bares (LC 214, art. 273) e o alerta de que, no regime de bares, o resultado vira "manter"; nada de iFood
     nem dos textos de restaurante;
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

CLIENTES = [
    {'id': 'm6c1', 'nome_principal': 'RESTAURANTE DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000601', 'cnae_principal': '5611-2/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'm6c2', 'nome_principal': 'COZINHA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000602', 'cnae_principal': '5620-1/01 - Fornecimento de alimentos preparados preponderantemente para empresas', 'cidade': 'Três Coroas', 'status': 'ativo'},
]
CASOS = [{'id': 'm6k1', 'cliente_id': 'm6c1', 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '5611', 'segmento': 'alimentacao',
          'sinal_b2b': 0, 'sinal_entradas': 1, 'sinal_reducao': 1, 'sinal_aliquota': 0, 'score': 2, 'triagem': 'simular',
          'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
          'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Triagem automática por CNAE (teste).'},
         # o caso guarda só 4 dígitos do CNAE; a subclasse (5620-1/01) vem do cadastro
         {'id': 'm6k2', 'cliente_id': 'm6c2', 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '5620', 'segmento': 'servicos',
          'sinal_b2b': 0, 'sinal_entradas': 0, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 0, 'triagem': None,
          'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
          'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': None}]
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
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

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

        p.click('#rtLista tr:has-text("RESTAURANTE DE TESTE LTDA")'); p.wait_for_timeout(500)
        dica = br(p.inner_text('label:has(#sPctDespCred) .hint'))
        titulo = br(p.get_attribute('label:has(#sPctDespCred)', 'title') or '')
        ok('art. 127' in dica and '70%' in dica, f'a dica mantém o −30% das profissões (70% do cheio) ({dica[:70]}…)')
        # Módulo 07 (13/10/2026): os 70% só com prestador do regime regular que cumpre os requisitos; Simples por dentro e −60%
        ok('70% se o prestador for do regime regular e cumprir os requisitos do art. 127' in dica,
           'a dica condiciona os 70% ao prestador do regime regular que cumpre os requisitos do art. 127')
        ok('prestador do Simples por dentro: só o IBS/CBS do DAS dele (cerca de 15% do cheio)' in dica,
           'a dica diz que o prestador do Simples por dentro dá só o IBS/CBS do DAS dele (cerca de 15% do cheio)')
        ok('serviço com −60% (saúde, educação): 40%' in dica, 'a dica diz que serviço com −60% (saúde, educação) credita 40%')
        ok('aluguel de imóvel: 30% se o locador for do regime regular' in dica and 'nada se for pessoa física não contribuinte' in dica,
           'a dica diz quanto credita o aluguel: 30% (locador do regime regular) ou nada (pessoa física não contribuinte)')
        ok('VR, VA e plano de saúde: só o débito do fornecedor' in dica, 'a dica diz que VR, VA e plano de saúde creditam só o débito do fornecedor')
        ok('art. 261, parágrafo único' in titulo and 'redução de 70%' in titulo and 'art. 57, §3º, IV' in titulo and 'LC 227' in titulo,
           'o título cita a redução de 70% da locação (art. 261, parágrafo único) e o art. 57, §3º, IV, na redação da LC 227')
        ok('cumpre os requisitos do art. 127' in titulo and 'art. 47, §9º, II' in titulo and 'credita 40% do cheio' in titulo,
           'o título traz a condição dos 70%, o crédito limitado do Simples por dentro (art. 47, §9º, II) e os 40% do serviço com −60%')
        ok(p.get_attribute('#sPctDespCred', 'placeholder') == '100 = cheio', 'o campo continua com o mesmo id e o mesmo padrão')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # cozinha de refeições para empresas (CNAE 5620-1/01): análise de venda a empresas, com o enquadramento do art. 273
        p.click('#rtLista tr:has-text("COZINHA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'I'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sReceita', '100.000,00'), ('#sMixCheia', '100'), ('#sMixRed60', '0'), ('#sMixRed40', '0'),
                             ('#sMixRed30', '0'), ('#sMixZero', '0'), ('#sPctMerc', '40'), ('#sPctDesp', '0'), ('#sPctCred', '50'), ('#sPctEmb', '0'),
                             ('#sPctST', '0'), ('#sPctMono', '0'), ('#sPartilha', '15,5'), ('#sPctPJ', '90'), ('#sEstoque', '0')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(300)
        ok(br(p.inner_text('#bVeredito')).startswith('OPTE, SE O COMERCIAL CONFIRMAR.'), 'cozinha fora do regime de bares, 90% a empresas: "opte, se o comercial confirmar"')
        p.click('#bGravar'); p.wait_for_timeout(600)
        with p.expect_popup() as pop:
            p.click('#dAnalise')
        an = pop.value; an.wait_for_load_state(); an.wait_for_timeout(400)
        txt = br(an.inner_text('body'))
        ok('refeições para empresas' in txt, 'análise: a atividade sai como "refeições para empresas" (a subclasse veio do cadastro)')
        ok('contratos de refeição' in txt and 'Enquadramento da refeição por contrato (LC 214, art. 273)' in txt,
           'análise: a pergunta dos contratos de refeição e o enquadramento no regime de bares (art. 273)')
        ok('passa a ser “manter dentro do DAS”' in txt, 'análise: no regime de bares, o resultado vira "manter" — e a análise diz')
        ok('iFood' not in txt and 'Em restaurante' not in txt, 'análise: nada de iFood nem dos textos de restaurante')
        an.close()
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
