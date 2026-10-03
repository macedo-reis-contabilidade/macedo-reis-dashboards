"""Teste da lista da Reforma Tributária (fiscal-reforma.html): depois de gravada a simulação, o que aparece é o
resultado da conta — não mais a triagem por CNAE, que é a hipótese de antes da conta.
Sem login e sem banco: mesmo mock do conferir.py. Os casos e clientes (inventados) entram no banco falso por uma
armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-situacao.py

Confere:
  1. caso com triagem "Candidato por fora" e simulação que deu por dentro mostra "Simulado: por dentro", com a
     triagem antiga no título do chip (era o que confundia: a lista dizia "por fora" e a conta, "por dentro" — 02/10/2026);
  2. simulação que deu por fora mostra "Simulado: por fora"; empate técnico mostra "Simulado: empate" (pela frase,
     nas simulações antigas, e pela marca "empate" nas gravadas desde 02/10);
  3. caso ainda sem simulação continua mostrando a triagem;
  4. o filtro usa o mesmo valor que aparece: "Candidato por fora" não traz mais o caso já simulado;
  5. a ficha do caso mostra no topo o mesmo chip da lista;
  6. o simulador usa a CBS de 2027 (referência − 0,1), sobe o DAS por dentro com o fim do monofásico e mostra o
     resultado sem o crédito de estoque (03/10/2026);
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

def obs(veredito, frase, **extra):
    return json.dumps({'v': 1, 'input': {'anexo': 'II', 'receita': 100000}, 'veredito': veredito, 'frase': frase, 'calculado_em': '2026-09-27', **extra}, ensure_ascii=False)

CLIENTES = [
    {'id': 'rx1', 'nome_principal': 'ATELIÊ DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000201', 'cnae_principal': '1531-9/02', 'cidade': 'Três Coroas', 'status': 'ativo'},
    {'id': 'rx2', 'nome_principal': 'COMÉRCIO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000202', 'cnae_principal': '4789-0/04', 'cidade': 'Igrejinha', 'status': 'ativo'},
    {'id': 'rx3', 'nome_principal': 'MERCADO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000203', 'cnae_principal': '4712-1/00', 'cidade': 'Taquara', 'status': 'ativo'},
    {'id': 'rx4', 'nome_principal': 'OFICINA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000204', 'cnae_principal': '1531-9/02', 'cidade': 'Parobé', 'status': 'ativo'},
    {'id': 'rx5', 'nome_principal': 'PADARIA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000205', 'cnae_principal': '1091-1/02', 'cidade': 'Rolante', 'status': 'ativo'},
    {'id': 'rx6', 'nome_principal': 'QUITANDA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000206', 'cnae_principal': '4724-5/00', 'cidade': 'Gramado', 'status': 'ativo'},
]
def caso(n, cli, triagem, score, dentro=None, fora=None, sim_obs=None, status='simulado'):
    return {'id': 'rc' + str(n), 'cliente_id': cli, 'campanha': 'opcao_2027', 'prazo_opcao': '2026-09-30', 'cnae_base': '1531', 'segmento': 'industria',
            # sinais que somam o score (5 = 2+2+0+1 · 3 = 2+1+0+0 · 1 = 1+0+0+0)
            'sinal_b2b': 2 if score >= 3 else 1, 'sinal_entradas': 2 if score >= 5 else (1 if score >= 3 else 0), 'sinal_reducao': 0,
            'sinal_aliquota': 1 if score >= 5 else 0, 'score': score, 'triagem': triagem,
            'perfil_validado': False, 'decisao': 'pendente', 'status': status, 'comunicado_em': None,
            'sim_custo_dentro': dentro, 'sim_custo_fora': fora, 'sim_obs': sim_obs, 'obs': 'Triagem automática por CNAE (teste).'}
CASOS = [
    caso(1, 'rx1', 'candidato_por_fora', 5, 48300, 102350, obs('MANTENHA', 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 48.300,00 dentro do Simples…')),
    caso(2, 'rx2', 'simular', 3, 60000, 55000, obs('OPTE', 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 55.000,00 pelo regime regular…')),
    caso(3, 'rx3', 'simular', 3, 220600, 218100, obs('MANTENHA', 'Empate técnico: pelo regime regular o custo do primeiro semestre de 2027 seria R$ 2.500,00 menor…')),
    caso(4, 'rx4', 'candidato_por_fora', 5, status='triado'),
    caso(5, 'rx5', 'tende_por_dentro', 1, status='triado'),
    caso(6, 'rx6', 'simular', 3, 34150, 33100, obs('MANTENHA', 'Texto qualquer do veredito', empate=True)),
]
# simulação gravada antes de 03/10/2026: CBS de referência cheia (9,30) com IBS 0,10 — a tela lê como a CBS de 2027 (9,20)
CASOS[1]['sim_obs'] = json.dumps({'v': 1, 'input': {'anexo': 'II', 'receita': 100000, 'cbs': 9.3, 'ibs': 0.1}, 'veredito': 'OPTE',
    'frase': 'A simulação do primeiro semestre de 2027 indica custo tributário de R$ 55.000,00 pelo regime regular…', 'calculado_em': '2026-09-27'}, ensure_ascii=False)
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS);
  } });
})();
""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(CASOS, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def linhas(p):
    return p.eval_on_selector_all('#rtLista tr', """trs => trs.map(tr => {
      const chip = tr.querySelector('td:nth-child(6) .rt-chip');
      return { nome: tr.querySelector('td:nth-child(2) b').textContent.trim(), chip: chip ? chip.textContent.trim() : '', titulo: chip ? chip.title : '' };
    })""")

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

        por_nome = {l['nome']: l for l in linhas(p)}
        ok(len(por_nome) == 6, f'a lista mostra os 6 casos ({len(por_nome)})')
        at = por_nome.get('ATELIÊ DE TESTE LTDA', {})
        ok(at.get('chip') == 'Simulado: por dentro', f'candidato por fora que a conta deu por dentro mostra "Simulado: por dentro" ({at.get("chip")})')
        ok('Candidato por fora' in at.get('titulo', ''), 'a triagem antiga fica no título do chip')
        ok(por_nome.get('COMÉRCIO DE TESTE LTDA', {}).get('chip') == 'Simulado: por fora', 'simulação que deu por fora mostra "Simulado: por fora"')
        ok(por_nome.get('MERCADO DE TESTE LTDA', {}).get('chip') == 'Simulado: empate', 'empate técnico (pela frase, simulação antiga) mostra "Simulado: empate"')
        ok(por_nome.get('QUITANDA DE TESTE LTDA', {}).get('chip') == 'Simulado: empate', 'empate técnico (pela marca gravada desde 02/10) mostra "Simulado: empate"')
        ok(por_nome.get('OFICINA DE TESTE LTDA', {}).get('chip') == 'Candidato por fora', 'caso sem simulação continua com a triagem')
        ok(por_nome.get('PADARIA DE TESTE LTDA', {}).get('chip') == 'Tende por dentro', 'triagem "Tende por dentro" sem simulação continua igual')

        # filtro: o mesmo valor que aparece
        def filtrar(v):
            p.select_option('#rtFtri', v); p.wait_for_timeout(200)
            return sorted(l['nome'] for l in linhas(p))
        ok(filtrar('candidato_por_fora') == ['OFICINA DE TESTE LTDA'], 'filtro "Candidato por fora" não traz mais o caso já simulado')
        ok(filtrar('sim_por_dentro') == ['ATELIÊ DE TESTE LTDA'], 'filtro "Simulado: por dentro"')
        ok(filtrar('sim_por_fora') == ['COMÉRCIO DE TESTE LTDA'], 'filtro "Simulado: por fora"')
        ok(filtrar('sim_empate') == ['MERCADO DE TESTE LTDA', 'QUITANDA DE TESTE LTDA'], 'filtro "Simulado: empate"')
        ok(len(filtrar('')) == 6, 'sem filtro, os 6 de volta')

        # ficha: o topo mostra o mesmo chip da lista
        p.click('#rtLista tr:has-text("ATELIÊ DE TESTE LTDA")'); p.wait_for_timeout(500)
        topo = p.inner_text('#fiTriagem').strip()
        ok(topo == 'Simulado: por dentro', f'a ficha mostra no topo o mesmo chip da lista ({topo})')

        # simulador (03/10/2026): CBS de 2027 = referência − 0,1; receita monofásica; resultado sem o crédito de estoque
        p.click('#fiFechar'); p.wait_for_timeout(300)
        p.click('#rtLista tr:has-text("OFICINA DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(p.input_value('#sCbs') == '9,2' and p.input_value('#sIbs') == '0,1', f'CBS de 2027 = 9,2 e IBS 0,1 ({p.input_value("#sCbs")} + {p.input_value("#sIbs")})')
        p.select_option('#sAnexo', 'I')
        for campo, valor in [('#sRbt12', '1.800.000,00'), ('#sReceita', '150.000,00'), ('#sMixCheia', '20'), ('#sMixRed60', '70'), ('#sMixRed40', '0'), ('#sMixRed30', '0'),
                             ('#sMixZero', '10'), ('#sPctMerc', '60'), ('#sPctDesp', '5,333333'), ('#sPctEmb', '18'), ('#sPctST', '49'), ('#sPctMono', '100'),
                             ('#sPartilha', '15,5'), ('#sPctPJ', '10'), ('#sEstoque', '1.541,67')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(300)
        verd = p.inner_text('#bVeredito')
        ok('Sem o crédito de estoque' in verd and 'A conclusão depende do crédito de estoque' in verd, 'o veredito mostra o resultado sem o crédito de estoque, e que a conclusão depende dele')
        ok('DAS por dentro em 2027' in verd, 'o veredito avisa que o DAS por dentro de 2027 sobe com o fim da exclusão do monofásico')
        jan = p.inner_text('#bMeses tbody tr:first-child td:nth-child(2)').replace('\xa0', ' ')
        ok(jan == 'R$ 9.426,38', f'DAS por dentro de janeiro/2027 = R$ 9.426,38, o do caso do curso ({jan})')
        p.click('#fiFechar'); p.wait_for_timeout(300)
        p.click('#rtLista tr:has-text("COMÉRCIO DE TESTE LTDA")'); p.wait_for_timeout(500)
        ok(p.input_value('#sCbs') == '9,2', f'simulação antiga (CBS 9,30 + IBS 0,10) abre com a CBS de 2027 = 9,2 ({p.input_value("#sCbs")})')

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
