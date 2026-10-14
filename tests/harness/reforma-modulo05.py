"""Teste das mudanças da Reforma vindas do Módulo 05 do curso (a LC 214 no texto da lei) na ficha (fiscal-reforma.html,
12/10/2026): os requisitos do art. 127 no campo da redução de 30% e o aviso de venda ao exterior e para a Zona Franca ao
puxar as notas.
Sem login e sem banco: mesmo mock do conferir.py. Clientes, casos e notas (inventados) entram no banco falso por uma
armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-modulo05.py

Confere:
  1. o campo "Mix: % redução 30%" mostra que a redução é só das profissões do art. 127 e, na sociedade, só com os cinco
     requisitos do §1º, II (dica e título); desde o Módulo 07 (13/10/2026), o título diz "profissões diferentes, todas do
     rol, cada um atuando na sua habilitação" (§2º, II), "não é sócia de outra pessoa jurídica" (alínea c), que atividade
     fora das habilitações tira a redução de toda a receita (alínea d) e que a academia pode ter o −60% da educação
     desportiva (NBS 1.2205.12.00, art. 141, I);
  2. numa empresa com exportação (CFOP 7.101), venda à Zona Franca (CFOP 6.109) e venda a comercial exportadora (CFOP
     6.501), "Importar" → "Aplicar" preenche a ficha pelas notas, calcula e deixa na nota das notas um aviso por tipo, com
     o valor e o artigo da LC 214; o aviso continua lá depois do cálculo e a mensagem manda ler o aviso;
  3. numa empresa só com venda interna, nenhum aviso — e a mensagem é a de sempre;
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
    {'id': 'm5c1', 'nome_principal': 'EXPORTADORA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000501', 'cnae_principal': '1531-9/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'm5c2', 'nome_principal': 'VAREJO INTERNO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000502', 'cnae_principal': '4782-2/01', 'cidade': 'Igrejinha', 'status': 'ativo'},
]
def caso(n, cli):
    return {'id': 'm5k' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '1531', 'segmento': 'industria',
            'sinal_b2b': 2, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 3, 'triagem': 'simular',
            'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
            'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Triagem automática por CNAE (teste).'}
CASOS = [caso(1, 'm5c1'), caso(2, 'm5c2')]

# notas inventadas (o repositório é público): o item leva as chaves do filtro do documento embutido (!inner) achatadas,
# como o mock compara coluna a coluna
def nota(id_, cli, cfop, valor, dest_tipo='PJ', dest_uf='SP', modelo='55'):
    return {'id': id_, 'cliente_id': cli, 'status': 'autorizada', 'modelo': modelo, 'data_emissao': '2026-07-10', 'tipo': 'saida', 'finalidade': 1,
            'emit_doc': '10000000000501', 'emit_nome': 'TESTE', 'emit_uf': 'RS', 'emit_crt': 1, 'dest_doc': '33333333000133' if dest_tipo == 'PJ' else 'X1',
            'dest_tipo': dest_tipo, 'dest_nome': 'CLIENTE ' + id_, 'dest_uf': dest_uf, 'valor_total': valor, 'cfop_principal': cfop}
def item(doc, cli, cfop, valor, ncm='64039990'):
    return {'documento_id': doc, 'ncm': ncm, 'descricao': 'CALCADO ' + doc, 'cfop': cfop, 'unidade': 'PR', 'quantidade': 10, 'valor_total': valor,
            'nf_documentos.cliente_id': cli, 'nf_documentos.status': 'autorizada', 'nf_documentos.data_emissao': '2026-07-10'}
NOTAS = [
    nota('n1', 'm5c1', '5101', 60000), nota('n2', 'm5c1', '7101', 25000, 'EX', 'EX'), nota('n3', 'm5c1', '6109', 10000, 'PJ', 'AM'),
    nota('n4', 'm5c1', '6501', 5000),
    nota('n5', 'm5c2', '5102', 40000), nota('n6', 'm5c2', '6102', 10000, 'PJ', 'SC'),
]
ITENS = [
    item('n1', 'm5c1', '5101', 60000), item('n2', 'm5c1', '7101', 25000), item('n3', 'm5c1', '6109', 10000), item('n4', 'm5c1', '6501', 5000),
    item('n5', 'm5c2', '5102', 40000), item('n6', 'm5c2', '6102', 10000),
]
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
  const CLIENTES = %s, CASOS = %s, PARAMS = %s, NOTAS = %s, ITENS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
    v.nf_documentos = NOTAS; v.nf_itens = ITENS; v.rt_ncm_regras = [];
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS, NOTAS, ITENS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

def abrir_e_puxar(p, nome):
    p.click(f'#rtLista tr:has-text("{nome}")'); p.wait_for_timeout(500)
    p.select_option('#sAnexo', 'I'); p.wait_for_timeout(100)
    for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sPctEmb', '0'), ('#sPctST', '0'), ('#sPctMono', '0'), ('#sEstoque', '0'), ('#sPartilha', '15,5')]:
        p.fill(campo, valor)
    p.click('#bImportarDom')
    p.wait_for_selector('#ovDom.on', timeout=5000)
    p.wait_for_function("() => /nota\\(s\\) autorizada/.test(document.getElementById('domNotas').textContent)", timeout=5000)
    p.click('#domAplicar')
    p.wait_for_selector('#bXmlInfo:not([hidden])', timeout=5000); p.wait_for_timeout(300)

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

        # 1) a redução de 30% com os requisitos do art. 127
        p.click('#rtLista tr:has-text("EXPORTADORA DE TESTE LTDA")'); p.wait_for_timeout(500)
        dica = br(p.inner_text('#sMixRed30Box .hint'))
        titulo = p.get_attribute('#sMixRed30Box', 'title') or ''
        ok('art. 127' in dica and '5 requisitos' in dica and 'nenhum sócio PJ' in dica and 'serviço feito pelos sócios' in dica,
           f'dica do −30%: profissão do art. 127 e os 5 requisitos da sociedade ({dica[:80]}…)')
        ok('§1º, II' in titulo and 'contabilistas' in titulo and 'advogados' in titulo and 'não é sócia de outra pessoa jurídica' in titulo and '(§3º)' in titulo,
           'o título traz as 18 profissões, os cinco requisitos do §1º, II, o §2º e a academia do §3º')
        # Módulo 07 (13/10/2026): o §2º, II, sem ambiguidade; a alínea c como a lei diz; a alínea d em toda a receita; a academia e o −60%
        ok('sócios de profissões diferentes, todas do rol, cada um atuando na sua habilitação' in titulo and 'profissões diferentes do rol' not in titulo,
           'o título diz "profissões diferentes, todas do rol, cada um atuando na sua habilitação" (§2º, II), sem a frase ambígua')
        ok('outra empresa' not in titulo and 'tira a redução de toda a receita' in titulo,
           'alínea c como a lei ("outra pessoa jurídica") e a alínea d tirando a redução de toda a receita')
        ok('NBS 1.2205.12.00' in titulo and 'art. 141, I' in titulo and 'vale a maior redução' in titulo,
           'a academia pode ter o −60% da educação desportiva (NBS 1.2205.12.00, art. 141, I) — vale a maior, a conferir')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 2) exportação, Zona Franca e comercial exportadora nas notas
        abrir_e_puxar(p, 'EXPORTADORA DE TESTE LTDA')
        info = br(p.inner_text('#bXmlInfo'))
        avisos = [br(t) for t in p.eval_on_selector_all('#bXmlInfo [data-aviso-notas]', 'els => els.map(e => e.textContent)')]
        ok(len(avisos) == 3, f'três avisos: exportação, Zona Franca e comercial exportadora ({len(avisos)})')
        ok(any(a.startswith('⚠ Venda ao exterior (CFOP 7.101): R$ 25.000,00 em 1 nota, 25% das vendas.') and 'LC 214, art. 79' in a for a in avisos),
           'exportação: valor, peso nas vendas e o art. 79 (imune, com crédito)')
        ok(any('Zona Franca de Manaus ou Área de Livre Comércio (CFOP 6.109): R$ 10.000,00' in a and 'arts. 445 e 463' in a for a in avisos),
           'Zona Franca: valor e os arts. 445 e 463 (alíquota zero)')
        ok(any('fim específico de exportação (CFOP 6.501): R$ 5.000,00' in a and 'art. 82' in a for a in avisos),
           'comercial exportadora: valor e o art. 82 (suspensão)')
        ok(p.is_visible('#bSaida') and 'leia o aviso das notas' in p.inner_text('#bMsg'),
           f'calculou e a mensagem manda ler o aviso ({p.inner_text("#bMsg")})')
        ok(p.input_value('#sMixCheia') == '100' and p.input_value('#sMixZero') == '0', 'o mix veio das notas: tudo na cheia (o simulador ainda não separa)')
        p.click('#bCalcular'); p.wait_for_timeout(300)
        ok(len(p.query_selector_all('#bXmlInfo [data-aviso-notas]')) == 3 and 'Nada foi gravado' in info,
           'recalculando, os avisos continuam na nota das notas')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 3) só venda interna: nenhum aviso
        abrir_e_puxar(p, 'VAREJO INTERNO DE TESTE LTDA')
        ok(not p.query_selector_all('#bXmlInfo [data-aviso-notas]'), 'só venda interna: nenhum aviso')
        ok(p.inner_text('#bMsg').startswith('✓ Campos preenchidos e simulação calculada'), f'mensagem de sempre ({p.inner_text("#bMsg")})')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
