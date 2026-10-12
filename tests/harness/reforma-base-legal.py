"""Teste da Base legal da Reforma (fiscal-reforma.html) com a base de materiais (12/10/2026): cada regra mostra de qual
material veio, com o link pro original no Drive, e os códigos da simulação na ficha abrem a regra.
Sem login e sem banco: mesmo mock do conferir.py. Regras, materiais e vínculos (inventados) entram no banco falso por uma
armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-base-legal.py

Confere:
  1. o botão Base legal lista as regras e, embaixo de cada uma, "De onde veio": os materiais na ordem do vínculo, com o
     tipo (norma, aula do curso…), o lugar (artigo, página, slide) e o link pro Drive abrindo em outra aba;
  2. material sem link aparece só com o título; material inativo e vínculo pra material inexistente não aparecem;
     regra sem vínculo aparece como antes, sem o bloco;
  3. na ficha, depois de calcular, clicar no código [PARTILHA-DAS-2027] abre a Base legal com essa regra destacada;
     abrir pelo botão de novo tira o destaque;
  4. os documentos (relatório do cliente e análise técnica) não usam a base de materiais — curso é de uso interno;
  5. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from conferir import montar_site, servir

CLIENTES = [{'id': 'rb1', 'nome_principal': 'OFICINA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000301',
             'cnae_principal': '4520-0/01', 'cidade': 'Três Coroas', 'status': 'ativo'}]
CASOS = [{'id': 'rbc1', 'cliente_id': 'rb1', 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '4520', 'segmento': 'servicos',
          'sinal_b2b': 2, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 0, 'score': 3, 'triagem': 'simular',
          'perfil_validado': False, 'decisao': 'pendente', 'status': 'triado', 'comunicado_em': None,
          'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Triagem automática por CNAE (teste).'}]
REGRAS = [
    {'codigo': 'CRED-CLIENTE', 'titulo': 'Crédito que o cliente PJ leva (teste)', 'dispositivo': 'Artigo de teste', 'regra': 'Texto da regra de teste.',
     'aplica_a': 'Todos', 'efeito': 'Efeito de teste', 'fonte': 'Fonte de teste', 'verificado_em': '2026-10-12', 'ativo': True},
    {'codigo': 'OPC-PADRAO', 'titulo': 'Padrão é por dentro (teste)', 'dispositivo': None, 'regra': 'Regra sem material.',
     'aplica_a': 'Todos', 'efeito': '—', 'fonte': None, 'verificado_em': None, 'ativo': True},
    {'codigo': 'PARTILHA-DAS-2027', 'titulo': 'Parcela do DAS (teste)', 'dispositivo': 'Anexos de teste', 'regra': 'Regra da partilha de teste.',
     'aplica_a': 'Todos', 'efeito': 'Partilha', 'fonte': 'Fonte de teste', 'verificado_em': '2026-10-12', 'ativo': True},
]
MATERIAIS = [
    {'codigo': 'T-NORMA', 'titulo': 'Resolução de teste', 'tipo': 'norma', 'oficial': True, 'drive_url': 'https://drive.google.com/file/d/TESTE-NORMA/view', 'ativo': True},
    {'codigo': 'T-AULA', 'titulo': 'Aula de teste', 'tipo': 'aula', 'oficial': False, 'drive_url': 'https://drive.google.com/file/d/TESTE-AULA/view', 'ativo': True},
    {'codigo': 'T-SEM-LINK', 'titulo': 'Leitura sem link', 'tipo': 'sintese', 'oficial': False, 'drive_url': None, 'ativo': True},
    {'codigo': 'T-INATIVO', 'titulo': 'Material inativo', 'tipo': 'aula', 'oficial': False, 'drive_url': 'https://drive.google.com/file/d/TESTE-INATIVO/view', 'ativo': False},
]
VINCULOS = [
    {'regra_codigo': 'CRED-CLIENTE', 'material_codigo': 'T-AULA', 'onde': 'slides 9 e 16', 'ordem': 2},
    {'regra_codigo': 'CRED-CLIENTE', 'material_codigo': 'T-NORMA', 'onde': 'art. 58, p. 10', 'ordem': 1},
    {'regra_codigo': 'CRED-CLIENTE', 'material_codigo': 'T-INATIVO', 'onde': 'não pode aparecer', 'ordem': 3},
    {'regra_codigo': 'CRED-CLIENTE', 'material_codigo': 'T-NAO-EXISTE', 'onde': 'não pode aparecer', 'ordem': 4},
    {'regra_codigo': 'PARTILHA-DAS-2027', 'material_codigo': 'T-SEM-LINK', 'onde': None, 'ordem': 1},
]
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, REGRAS = %s, MATERIAIS = %s, VINCULOS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS);
    v.rt_regras = REGRAS; v.rt_materiais = MATERIAIS; v.rt_regra_materiais = VINCULOS;
  } });
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, REGRAS, MATERIAIS, VINCULOS))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def regra(p, codigo):
    return p.evaluate("""cod => {
      const el = [...document.querySelectorAll('#baseLista .rt-regra')].find(e => e.dataset.regra === cod);
      if (!el) return null;
      const mats = el.querySelector('.mats');
      return { alvo: el.classList.contains('alvo'), texto: el.innerText,
               mats: mats ? mats.innerText : null,
               links: [...el.querySelectorAll('.mats a')].map(a => ({ href: a.getAttribute('href'), alvo: a.target, rel: a.rel, texto: a.textContent })) };
    }""", codigo)

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

        print('[1] Base legal pelo botão')
        p.click('#btnBase'); p.wait_for_selector('#ovBase.on', timeout=5000); p.wait_for_timeout(400)
        cc = regra(p, 'CRED-CLIENTE')
        ok(cc is not None and 'Texto da regra de teste.' in cc['texto'], 'a regra aparece com o texto')
        ok(cc and cc['mats'] and cc['mats'].startswith('De onde veio'), 'embaixo da regra, o bloco "De onde veio"')
        linhas = [l for l in (cc['mats'] or '').splitlines() if l.strip()][1:] if cc else []
        ok(len(linhas) == 2 and linhas[0].startswith('Resolução de teste') and linhas[1].startswith('Aula de teste'),
           f'os dois materiais ativos, na ordem do vínculo: {linhas}')
        ok(linhas and 'norma' in linhas[0] and 'art. 58, p. 10' in linhas[0], 'o tipo e o lugar (artigo, página) de cada material')
        ok(len(linhas) > 1 and 'aula do curso' in linhas[1] and 'slides 9 e 16' in linhas[1], 'aula do curso com os slides')
        hrefs = [l['href'] for l in (cc['links'] if cc else [])]
        ok(hrefs == ['https://drive.google.com/file/d/TESTE-NORMA/view', 'https://drive.google.com/file/d/TESTE-AULA/view'], f'os links do Drive: {hrefs}')
        ok(cc and all(l['alvo'] == '_blank' and 'noopener' in l['rel'] for l in cc['links']), 'os links abrem em outra aba (noopener)')

        print('[2] material sem link, inativo, inexistente e regra sem vínculo')
        ok(cc and 'Material inativo' not in cc['texto'] and 'não pode aparecer' not in cc['texto'], 'material inativo e vínculo pra material inexistente ficam de fora')
        pt = regra(p, 'PARTILHA-DAS-2027')
        ok(pt and pt['mats'] and 'Leitura sem link' in pt['mats'] and 'leitura do escritório' in pt['mats'] and not pt['links'],
           'material sem link aparece só com o título e o tipo')
        op = regra(p, 'OPC-PADRAO')
        ok(op is not None and op['mats'] is None and 'Regra sem material.' in op['texto'], 'regra sem vínculo aparece como antes, sem o bloco')
        p.click('#baseFechar'); p.wait_for_timeout(200)

        print('[3] código da simulação na ficha abre a regra')
        p.click('#rtLista tr:has-text("OFICINA DE TESTE LTDA")'); p.wait_for_timeout(500)
        p.select_option('#sAnexo', 'I')
        for campo, valor in [('#sRbt12', '1.800.000,00'), ('#sReceita', '150.000,00'), ('#sMixCheia', '100'), ('#sMixRed60', '0'), ('#sMixRed40', '0'),
                             ('#sMixRed30', '0'), ('#sMixZero', '0'), ('#sPctMerc', '60'), ('#sPctDesp', '5'), ('#sPctEmb', '18'), ('#sPctST', '0'),
                             ('#sPartilha', '15,5'), ('#sPctPJ', '10')]:
            p.fill(campo, valor)
        p.click('#bCalcular'); p.wait_for_timeout(300)
        refs = p.eval_on_selector_all('.rt-refs .ref', 'as => as.map(a => a.dataset.regra)')
        ok('PARTILHA-DAS-2027' in refs and len(refs) == 5, f'os códigos da simulação são clicáveis: {refs}')
        p.click('.rt-refs .ref[data-regra="PARTILHA-DAS-2027"]'); p.wait_for_selector('#ovBase.on', timeout=5000); p.wait_for_timeout(300)
        pt = regra(p, 'PARTILHA-DAS-2027'); cc = regra(p, 'CRED-CLIENTE')
        ok(pt and pt['alvo'] and cc and not cc['alvo'], 'abre a Base legal com a regra clicada destacada (só ela)')
        p.click('#baseFechar'); p.wait_for_timeout(200)
        p.click('.rt-refs .ref[data-regra="CRED-CLIENTE"]'); p.wait_for_timeout(300)
        pt = regra(p, 'PARTILHA-DAS-2027'); cc = regra(p, 'CRED-CLIENTE')
        ok(cc and cc['alvo'] and pt and not pt['alvo'], 'outro código: o destaque passa pra outra regra')
        p.click('#baseFechar'); p.wait_for_timeout(200)
        p.click('#fiFechar'); p.wait_for_timeout(200)
        p.click('#btnBase'); p.wait_for_timeout(300)
        ok(not any((regra(p, c) or {}).get('alvo') for c in ('CRED-CLIENTE', 'PARTILHA-DAS-2027', 'OPC-PADRAO')), 'pelo botão, sem destaque')
        p.click('#baseFechar'); p.wait_for_timeout(200)

        print('[4] documentos')
        analise = (AQUI.parent.parent / 'assets' / 'js' / 'rt-analise.js').read_text(encoding='utf-8')
        ok('rt_materiais' not in analise and 'drive_url' not in analise and 'drive.google' not in analise,
           'o relatório do cliente e a análise técnica não usam a base de materiais')

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
