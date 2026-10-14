"""Teste das mudanças da Reforma vindas do Módulo 07 do curso (regimes diferenciados: −30%, −60% e alíquota zero) na ficha
(fiscal-reforma.html, 13/10/2026): as dicas novas dos campos "Mix: % redução 60%" e "Mix: % alíquota zero" e o aviso da
alínea d do art. 127 (sociedade com parte da receita em −30% e parte em outra faixa).
Sem login e sem banco: mesmo mock do conferir.py. Clientes e casos (inventados) entram no banco falso por uma armadilha em
window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.
(O título do −30% com o §2º, II, a alínea c e a academia está em reforma-modulo05.py; a dica do crédito das despesas, em
reforma-modulo06.py.)

    python tests/harness/reforma-modulo07.py

Confere:
  1. a dica do "Mix: % redução 60%" diz o que entra (Anexos VII, VIII e IX, medicamentos salvo a lista com zero, dispositivos,
     in natura, educação e saúde dos Anexos II e III, educação desportiva, Anexo X, comunicação institucional só a órgão
     público), que é só por fora, que o cliente PJ credita 40% do cheio e que, cabendo também a alíquota zero, vale a zero;
     o título traz os artigos (arts. 128 a 142, NBS 1.2205.12.00, art. 140, art. 7º-A);
  2. a dica do "Mix: % alíquota zero" diz o que entra (Anexo I, Anexo XV, saúde menstrual, medicamentos da lista e soros e
     vacinas, Anexos XII e XIII, carro a taxista ou pessoa com deficiência/TEA), que o zero pelo comprador (Anexos IV, V e VI
     e demais medicamentos a órgão público ou CEBAS) pede o "% das compras de mercadorias com crédito", que é só por fora e
     que o cliente não credita; o título traz a LC 227 (Anexo XIV revogado, R$ 100.000,00) e o CEBAS;
  3. o aviso da alínea d aparece ao digitar 80% em −30% e 20% na cheia (texto completo, com o §1º, II, d e o §3º), some com
     100% em −30%, não aparece com 0% em −30%, aparece com −30% + alíquota zero, e o Calcular o atualiza quando o mix foi
     trocado sem digitação (como fazem o Domínio e as notas) — sem impedir a conta;
  4. a simulação gravada com 80% em −30% e 20% na cheia abre com o aviso, e a gravada com 100% em −30% abre sem ele;
  5. puxar das notas de serviço (NFS-e) não apaga o −30% digitado (a nota de serviço não mostra a redução): o mix fica, a nota
     das notas diz por quê e a confiança da ficha marca o mix "a conferir"; sem redução na ficha, as notas preenchem o mix
     como sempre, sem aviso; e o mix que veio das notas é atualizado por notas novas no segundo "Aplicar" (clínica
     veterinária com serviço e venda de produto com redução);
  5b. clínica (8630) em que o −60% da lista do Anexo III vira o resultado: a ficha mostra o "Enquadramento a conferir na lei";
  6. a tela não dá erro de JavaScript.
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
    {'id': 'm7c1', 'nome_principal': 'ESCRITORIO CONTABIL DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000701', 'cnae_principal': '6920-6/01', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'm7c2', 'nome_principal': 'ADVOCACIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000702', 'cnae_principal': '6911-7/01', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 'm7c3', 'nome_principal': 'ENGENHARIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000703', 'cnae_principal': '7112-0/00', 'cidade': 'Gramado', 'status': 'ativo'},
    {'id': 'm7c4', 'nome_principal': 'CONTABILIDADE COM NFSE DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000704', 'cnae_principal': '6920-6/01', 'cidade': 'Taquara', 'status': 'ativo'},
    {'id': 'm7c5', 'nome_principal': 'SOFTWARE COM NFSE DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000705', 'cnae_principal': '6201-5/01', 'cidade': 'Parobé', 'status': 'ativo'},
    {'id': 'm7c6', 'nome_principal': 'CLINICA VETERINARIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000706', 'cnae_principal': '7500-1/00', 'cidade': 'Rolante', 'status': 'ativo'},
    {'id': 'm7c7', 'nome_principal': 'CLINICA MEDICA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000707', 'cnae_principal': '8630-5/03', 'cidade': 'Riozinho', 'status': 'ativo'},
]
def caso(n, cli, cnae, status='triado', dentro=None, fora=None, sim_obs=None):
    return {'id': 'm7k' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': cnae, 'segmento': 'servicos',
            'sinal_b2b': 2, 'sinal_entradas': 0, 'sinal_reducao': 1, 'sinal_aliquota': 1, 'score': 4, 'triagem': 'simular',
            'perfil_validado': False, 'decisao': 'pendente', 'status': status, 'comunicado_em': None, 'atualizado_em': '2026-10-10T10:00:00Z',
            'sim_custo_dentro': dentro, 'sim_custo_fora': fora, 'sim_obs': sim_obs, 'fundamento': None, 'obs': 'Triagem automática por CNAE (teste).'}
# entrada inventada de sociedade do art. 127 (Anexo III, ISS fixo), gravada com a procedência por campo como a ficha faz
def entrada(red30, cheia):
    return {'anexo': 'III', 'issFixo': True, 'rbt12': 1200000, 'aliqEfetivaInformada': None, 'receita': 100000, 'mixCheia': cheia, 'mixRed60': 0, 'mixRed40': 0,
            'pctComprasComCredito': None, 'mixRed30': red30, 'mixZero': 0, 'pctComprasMercadorias': 0, 'pctComprasDespesas': 10, 'pctDespesasComCredito': None,
            'pctImpostoEmbutido': 0, 'pctExcluidoST': 0, 'pctReceitaMonofasica': 0, 'partilha': 16.6, 'cbs': 9.2, 'ibs': 0.1, 'pctPJ': 50, 'creditoEstoqueMes': 0}
PROC = {'receita': {'fonte': 'manual'}, 'rbt12': {'fonte': 'manual'}, 'anexo': {'fonte': 'manual'}, 'pctMerc': {'fonte': 'manual'}, 'pctDesp': {'fonte': 'manual'},
        'pctPJ': {'fonte': 'manual'}, 'mix': {'fonte': 'manual'}, 'partilha': {'fonte': 'manual'}}
def gravada(red30, cheia):
    return json.dumps({'v': 1, 'input': entrada(red30, cheia), 'veredito': 'MANTENHA', 'frase': 'Texto do veredito (teste).', 'calculado_em': '2026-10-12', 'procedencia': PROC}, ensure_ascii=False)
CASOS = [caso(1, 'm7c1', '6920'),
         caso(2, 'm7c2', '6911', 'simulado', 50000, 60000, gravada(80, 20)),
         caso(3, 'm7c3', '7112', 'simulado', 50000, 58000, gravada(100, 0)),
         caso(4, 'm7c4', '6920'), caso(5, 'm7c5', '6201'), caso(6, 'm7c6', '7500'), caso(7, 'm7c7', '8630')]
# notas de serviço inventadas (o repositório é público): NFS-e não tem item com NCM
def nfse(id_, cli, valor):
    return {'id': id_, 'cliente_id': cli, 'status': 'autorizada', 'modelo': 'nfse', 'data_emissao': '2026-07-10', 'tipo': 'saida', 'finalidade': 1,
            'emit_doc': '10000000000700', 'emit_nome': 'TESTE', 'emit_uf': 'RS', 'emit_crt': 1, 'dest_doc': '33333333000133', 'dest_tipo': 'PJ',
            'dest_nome': 'CLIENTE ' + id_, 'dest_uf': 'RS', 'valor_total': valor, 'cfop_principal': None}
NOTAS = [nfse('s1', 'm7c4', 30000), nfse('s2', 'm7c4', 30000), nfse('s3', 'm7c4', 40000), nfse('s4', 'm7c5', 50000), nfse('s5', 'm7c5', 50000)]
# clínica veterinária: 60% em NFS-e e 40% em produto (NF-e) — metade com NCM de redução de 60%; a nota nova chega depois
def nfe(id_, cli, valor):
    return {**nfse(id_, cli, valor), 'modelo': '55', 'dest_tipo': 'PF', 'dest_doc': 'X' + id_, 'cfop_principal': '5102'}
def item(doc, cli, valor, ncm):
    return {'documento_id': doc, 'ncm': ncm, 'descricao': 'PRODUTO ' + doc, 'cfop': '5102', 'unidade': 'UN', 'quantidade': 1, 'valor_total': valor,
            'nf_documentos.cliente_id': cli, 'nf_documentos.status': 'autorizada', 'nf_documentos.data_emissao': '2026-07-10'}
NOTAS += [nfse('v1', 'm7c6', 60000), nfe('v2', 'm7c6', 20000), nfe('v3', 'm7c6', 20000)]
# o importador grava um item sem NCM em cada NFS-e (o serviço conta na alíquota cheia do mix)
ITENS = [{**item(d['id'], d['cliente_id'], d['valor_total'], None), 'cfop': None, 'descricao': 'SERVICO ' + d['id']} for d in NOTAS if d['modelo'] == 'nfse'] \
      + [item('v2', 'm7c6', 20000, '30049099'), item('v3', 'm7c6', 20000, '96190000')]
REGRAS = [{'ncm_prefixo': '3004', 'regime': 'reducao_60', 'descricao': 'medicamentos (teste)', 'ativo': True}]
NOVA = [[nfe('v4', 'm7c6', 10000)], [item('v4', 'm7c6', 10000, '96190000')]]
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
  const CLIENTES = %s, CASOS = %s, PARAMS = %s, NOTAS = %s, ITENS = %s, REGRAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
    v.nf_documentos = NOTAS; v.nf_itens = ITENS; v.rt_ncm_regras = REGRAS;
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS, NOTAS, ITENS, REGRAS))

AVISO = ('⚠ Na sociedade, pela leitura da alínea d (LC 214, art. 127, §1º, II, d — o requisito é da sociedade, não de cada serviço), atividade fora das '
         'habilitações dos sócios tira a redução de 30% de toda a receita, a conferir no regulamento: confira se a parte nas outras faixas é mesmo dessa '
         'empresa. Academia registrada no conselho não tem essa exigência (§3º).')

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1
br = lambda t: t.replace('\xa0', ' ')

# abre a ficha, preenche o que as notas não dão e puxa as notas da base pelo "Importar" → "Aplicar" (sem relatório do Domínio)
def puxar_nfse(p, nome, mix):
    p.click(f'#rtLista tr:has-text("{nome}")'); p.wait_for_timeout(500)
    p.select_option('#sAnexo', 'III'); p.wait_for_timeout(100)
    for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sPctMerc', '0'), ('#sPctDesp', '10'), ('#sPctEmb', '0'), ('#sPctST', '0'), ('#sPctMono', '0'),
                         ('#sEstoque', '0'), ('#sPartilha', '16,6')] + mix:
        p.fill(campo, valor)
    return aplicar(p)
def aplicar(p):
    p.click('#bImportarDom')
    p.wait_for_selector('#ovDom.on', timeout=5000)
    p.wait_for_function("() => /nota\\(s\\) autorizada/.test(document.getElementById('domNotas').textContent)", timeout=5000)
    p.click('#domAplicar')
    p.wait_for_selector('#bXmlInfo:not([hidden])', timeout=5000); p.wait_for_timeout(300)
    return [br(x) for x in p.eval_on_selector_all('#bXmlInfo [data-aviso-notas]', 'els => els.map(e => e.textContent)')]

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
        aviso_visivel = lambda: p.is_visible('#sMixAviso')

        p.click('#rtLista tr:has-text("ESCRITORIO CONTABIL DE TESTE LTDA")'); p.wait_for_timeout(500)

        # 1) a dica do −60%
        dica60 = br(p.inner_text('label:has(#sMixRed60) .hint:not(.xml-origem)'))
        tit60 = br(p.get_attribute('label:has(#sMixRed60)', 'title') or '')
        ok(dica60.startswith('só por fora') and 'Anexo VII' in dica60 and 'Anexo VIII' in dica60 and 'Anexo IX' in dica60 and 'in natura' in dica60,
           f'dica do −60%: só por fora, alimentos (VII), higiene e limpeza (VIII), insumos (IX) e in natura ({dica60[:60]}…)')
        ok('medicamentos (salvo os da lista com alíquota zero)' in dica60 and 'dispositivos médicos e de acessibilidade' in dica60,
           'dica do −60%: medicamentos salvo a lista com zero, dispositivos médicos e de acessibilidade')
        ok('Anexos II e III' in dica60 and 'educação desportiva' in dica60 and 'Anexo X' in dica60 and 'comunicação institucional só a órgão público' in dica60,
           'dica do −60%: educação e saúde (II e III), educação desportiva, Anexo X e comunicação institucional só a órgão público')
        ok('o cliente PJ credita 40% do cheio' in dica60 and 'vale a zero' in dica60, 'dica do −60%: o cliente PJ credita 40% do cheio; cabendo também a zero, vale a zero')
        ok('arts. 128 a 142' in tit60 and 'NBS 1.2205.12.00' in tit60 and 'art. 140' in tit60 and 'art. 7º-A' in tit60 and 'art. 137' in tit60,
           'título do −60%: arts. 128 a 142, a NBS da educação desportiva, o art. 140 (comprador privado paga cheio), o in natura e o art. 7º-A')

        # 2) a dica da alíquota zero
        dica0 = br(p.inner_text('label:has(#sMixZero) .hint:not(.xml-origem)'))
        tit0 = br(p.get_attribute('label:has(#sMixZero)', 'title') or '')
        ok(dica0.startswith('só por fora') and 'cesta básica (Anexo I)' in dica0 and 'hortícolas, frutas e ovos (Anexo XV)' in dica0,
           f'dica do zero: só por fora, cesta básica (Anexo I) e hortícolas, frutas e ovos (Anexo XV) ({dica0[:60]}…)')
        ok('absorvente, tampão, coletor e calcinha absorvente' in dica0 and 'soros e vacinas' in dica0 and 'Anexos XII e XIII' in dica0 and 'taxista' in dica0,
           'dica do zero: saúde menstrual, medicamentos da lista e soros e vacinas, Anexos XII e XIII, carro a taxista ou pessoa com deficiência/TEA')
        ok('zero só pelo comprador' in dica0 and 'Anexos IV, V e VI' in dica0 and 'preencha “% das compras de mercadorias com crédito”' in dica0,
           'dica do zero: o zero pelo comprador (Anexos IV, V e VI) pede o "% das compras de mercadorias com crédito"')
        ok(dica0.endswith('o cliente não credita'), 'dica do zero: o cliente não credita')
        ok('art. 146, na redação da LC 227' in tit0 and 'Anexo XIV não vale mais' in tit0 and 'R$ 100.000,00' in tit0 and 'CEBAS' in tit0 and 'as compras NÃO têm zero' in tit0,
           'título do zero: a LC 227 (medicamentos por lista, Anexo XIV revogado, carro até R$ 100.000,00), o CEBAS e as compras sem zero')

        # 3) o aviso da alínea d ao digitar
        ok(not aviso_visivel(), 'caso sem simulação: abre sem o aviso')
        p.fill('#sMixRed30', '80'); p.fill('#sMixCheia', '20'); p.wait_for_timeout(100)
        ok(aviso_visivel(), '80% em −30% + 20% na cheia: o aviso aparece')
        ok(br(p.inner_text('#sMixAviso')) == AVISO, 'o texto do aviso: a leitura da alínea d, toda a receita, a conferir no regulamento, conferir as outras faixas, academia do §3º')
        p.fill('#sMixCheia', '0'); p.fill('#sMixRed30', '100'); p.wait_for_timeout(100)
        ok(not aviso_visivel(), '100% em −30%: o aviso some')
        p.fill('#sMixRed30', '0'); p.fill('#sMixCheia', '80'); p.fill('#sMixRed60', '20'); p.wait_for_timeout(100)
        ok(not aviso_visivel(), '0% em −30% (80% cheia + 20% −60%): sem aviso')
        p.fill('#sMixRed30', '90'); p.fill('#sMixCheia', '0'); p.fill('#sMixRed60', '0'); p.fill('#sMixZero', '10'); p.wait_for_timeout(100)
        ok(aviso_visivel(), '90% em −30% + 10% em alíquota zero: a alíquota zero também conta como outra faixa')
        # o mix trocado sem digitação (como o Domínio e as notas fazem): o aviso fica velho até o Calcular
        p.evaluate("() => { document.getElementById('sMixZero').value = '0'; document.getElementById('sMixRed30').value = '100'; }")
        ok(aviso_visivel(), 'mix regravado sem evento: o aviso ainda está lá')
        p.select_option('#sAnexo', 'III'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sReceita', '100.000,00'), ('#sPctPJ', '50'), ('#sPctMerc', '0'), ('#sPctDesp', '10'),
                             ('#sPctEmb', '0'), ('#sPctST', '0'), ('#sPctMono', '0'), ('#sPartilha', '16,6'), ('#sEstoque', '0')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(300)
        ok(not aviso_visivel() and p.is_visible('#bSaida'), 'Calcular com 100% em −30%: o aviso some e a simulação sai')
        p.fill('#sMixRed30', '80'); p.fill('#sMixCheia', '20')
        p.click('#bCalcular'); p.wait_for_timeout(300)
        ok(aviso_visivel() and p.is_visible('#bSaida') and p.inner_text('#bMsg').strip() == '',
           'Calcular com 80% + 20%: o aviso fica e não impede a conta')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 4) simulação gravada: o aviso já vem ao abrir
        p.click('#rtLista tr:has-text("ADVOCACIA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(p.input_value('#sMixRed30') == '80' and p.input_value('#sMixCheia') == '20', 'a simulação gravada volta com 80% em −30% e 20% na cheia')
        ok(aviso_visivel(), 'gravada com 80% + 20%: abre com o aviso, sem digitar nada')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        p.click('#rtLista tr:has-text("ENGENHARIA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(p.input_value('#sMixRed30') == '100' and not aviso_visivel(), 'gravada com 100% em −30%: abre sem o aviso')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 5) puxar das NFS-e: a nota de serviço não mostra a redução — o −30% digitado fica, com o aviso
        avisos = puxar_nfse(p, 'CONTABILIDADE COM NFSE DE TESTE LTDA', [('#sMixCheia', '0'), ('#sMixRed60', '0'), ('#sMixRed40', '0'), ('#sMixZero', '0'), ('#sMixRed30', '100')])
        ok(p.input_value('#sMixRed30') == '100' and p.input_value('#sMixCheia') == '0', 'o −30% digitado continua depois de puxar as NFS-e (antes as notas punham tudo na cheia)')
        ok(any(a.startswith('⚠ As notas de serviço (NFS-e) não mostram a redução do serviço') and 'o mix ficou como estava na ficha' in a for a in avisos),
           f'a nota das notas diz por quê ({avisos})')
        ok(p.is_visible('#bSaida') and 'mix das vendas a conferir' in br(p.inner_text('#bSaida')), 'calculou, e a confiança da ficha marca o mix do serviço "a conferir"')
        ok(p.input_value('#sPctPJ') == '100', 'o % de PJ veio das notas, como sempre')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        avisos = puxar_nfse(p, 'SOFTWARE COM NFSE DE TESTE LTDA', [])
        ok(p.input_value('#sMixCheia') == '100' and not any('NFS-e' in a for a in avisos), 'sem redução na ficha: as notas preenchem o mix (tudo na cheia), sem aviso')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        # o mix que veio das notas: notas novas o atualizam no segundo Aplicar (antes o "veio das notas" era lido depois de o
        # Aplicar limpar as origens, e o mix ficava velho com o aviso de NFS-e)
        avisos = puxar_nfse(p, 'CLINICA VETERINARIA DE TESTE LTDA', [])
        ok(p.input_value('#sMixRed60') == '20' and not any('NFS-e' in a for a in avisos), f'1º Aplicar: o −60% do produto veio das notas (20%) ({p.input_value("#sMixRed60")})')
        p.evaluate("(nv) => { window.__mockDb.nf_documentos.push(...nv[0]); window.__mockDb.nf_itens.push(...nv[1]); }", NOVA)
        avisos = aplicar(p)
        ok(p.input_value('#sMixRed60') == '18,2' and not any('NFS-e' in a for a in avisos), f'2º Aplicar com uma nota nova: o mix das notas é atualizado (18,2%), sem o aviso de NFS-e ({p.input_value("#sMixRed60")}, {avisos})')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        # 5b) clínica: o −60% do Anexo III (lista da lei) vira o resultado — a ficha mostra o enquadramento a conferir
        p.click('#rtLista tr:has-text("CLINICA MEDICA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'III'); p.wait_for_timeout(100)
        for campo, valor in [('#sRbt12', '1.200.000,00'), ('#sReceita', '100.000,00'), ('#sPctPJ', '5'), ('#sPctMerc', '0'), ('#sPctDesp', '20'), ('#sPctEmb', '0'), ('#sPctST', '0'),
                             ('#sPctMono', '0'), ('#sEstoque', '0'), ('#sPartilha', '15,6'), ('#sMixCheia', '100'), ('#sMixRed60', '0'), ('#sMixRed40', '0'), ('#sMixRed30', '0'), ('#sMixZero', '0')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(300)
        saida = br(p.inner_text('#bSaida'))
        ok('Enquadramento a conferir na lei — muda o resultado' in saida and 'Anexo III' in saida and 'o resultado passa a ser “optar por fora”' in saida,
           'clínica: a ficha mostra o enquadramento a conferir na lei (Anexo III), com o efeito')
        p.click('#fiFechar'); p.wait_for_timeout(300)

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
