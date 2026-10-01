"""Teste da Carteira de clientes (comercial-carteira.html) — a lista e a Análise que vão pro Diego.
Sem login e sem banco: mesmo mock do conferir.py, com a carteira inventada de tests/harness/supabase.mock.js
(13 ativos em 10 municípios, um MEI com o "CPF" no fim do nome oficial e outro com a raiz do "CNPJ" na frente).

    python tests/harness/carteira-analise.py

Confere, nos temas escuro e claro:
  1. a tela carrega sem erro de JavaScript;
  2. na lista, o MEI aparece sem o número no nome (o nome oficial fica no título do link);
  3. na Análise, "Por município" mostra TODOS os municípios — antes cortava nos 8 maiores e o de 1 cliente sumia
     (Parobé, 01/10/2026);
  4. o PDF pra impressão leva todos os municípios no resumo e o nome sem o número do MEI;
  5. o Excel leva o nome sem o número e o CNPJ formatado (00.000.000/0000-00).
O jsPDF e o SheetJS vêm de CDN e o teste não depende de internet: os dois entram como dublês que só anotam o que a
tela mandou escrever. Fotos em .harness/fotos/carteira-*.png. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, re, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

MUNICIPIOS = ['Três Coroas', 'Igrejinha', 'Gramado', 'Canela', 'Taquara', 'Rolante', 'Parobé', 'Nova Hartz', 'Sapiranga', 'Esteio']

# dublês do jsPDF e do SheetJS: anotam o que a tela manda escrever (o CDN fica fora do teste)
DUBLES = r"""
window.__pdfTextos = []; window.__pdfSalvo = null; window.__xls = { abas: [], salvo: null };
(() => {
  class Doc {
    constructor(){ this._fs = 10; }
    text(t){ window.__pdfTextos.push(String(t)); return this; }
    getTextWidth(t){ return String(t).length * this._fs * 0.5; }
    setFontSize(n){ this._fs = n; return this; }
    save(nome){ window.__pdfSalvo = nome; return this; }
  }
  for (const m of ['setFont', 'setTextColor', 'setDrawColor', 'setLineWidth', 'line', 'roundedRect', 'addPage'])
    Doc.prototype[m] = function () { return this; };
  Object.defineProperty(window, 'jspdf', { value: { jsPDF: Doc }, writable: false });
  const XLSX = {
    utils: {
      book_new: () => ({ abas: [] }),
      json_to_sheet: (linhas) => ({ __linhas: linhas }),
      aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
      book_append_sheet: (wb, ws, nome) => { window.__xls.abas.push({ nome, ...ws }); },
    },
    writeFile: (wb, nome) => { window.__xls.salvo = nome; },
  };
  Object.defineProperty(window, 'XLSX', { value: XLSX, writable: false });
})();
"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'\n[{tema}]')
            erros = []
            p = b.new_page(viewport={'width': 1500, 'height': 1000})
            p.on('pageerror', lambda e: erros.append(str(e)))
            # o CDN não entra no teste (os dublês ficam no lugar); o resto do site sobe normal
            p.route(re.compile(r'https://cdnjs\.cloudflare\.com/.*'), lambda r: r.fulfill(status=200, content_type='text/javascript', body='/* fora do teste */'))
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.add_init_script(DUBLES)
            p.goto(base + 'comercial-carteira.html'); p.wait_for_timeout(1500)

            # lista: nome do MEI sem o número; o oficial fica no título
            links = p.eval_on_selector_all('#ctBody td.ct-emp > a[href^="clientes/editar.html"]', 'els => els.map(a => ({ t: a.textContent.trim(), title: a.title }))')
            nomes = [l['t'] for l in links]
            ok(len(nomes) == 13, f'a lista mostra os 13 ativos (mostrou {len(nomes)})')
            ok('FULANO DE TESTE' in nomes, 'MEI com CPF no fim aparece como "FULANO DE TESTE"')
            ok('BELTRANA DE TESTE' in nomes, 'MEI com a raiz do CNPJ na frente aparece como "BELTRANA DE TESTE"')
            ok(not any(re.search(r'\d{11}|^\d{2}\.\d{3}\.\d{3}', n) for n in nomes), 'nenhum nome da lista leva CPF ou raiz de CNPJ')
            fulano = next((l for l in links if l['t'] == 'FULANO DE TESTE'), {})
            ok('FULANO DE TESTE 12345678901' in fulano.get('title', ''), 'o nome oficial fica no título do link')

            # Análise: todos os municípios
            p.click('#ctSeg button[data-v="ana"]'); p.wait_for_timeout(500)
            muns = p.eval_on_selector_all('#dMun .barra .bl', 'els => els.map(e => e.textContent.trim())')
            ok(sorted(muns) == sorted(MUNICIPIOS), f'"Por município" mostra os {len(MUNICIPIOS)} municípios (mostrou {len(muns)}: {", ".join(muns)})')
            ok('Parobé' in muns and 'Nova Hartz' in muns, 'município de 1 cliente aparece (Parobé, Nova Hartz)')
            # a barra é um <span>: sem display:block a largura não pega e todas apareciam vazias
            larg = p.eval_on_selector_all('#dMun .barra', 'els => els.map(e => [e.querySelector(".bf").getBoundingClientRect().width, e.querySelector(".bt").getBoundingClientRect().width])')
            ok(bool(larg) and abs(larg[0][0] - larg[0][1]) < 1.5 and all(0 < f < t + 1 for f, t in larg), 'as barras aparecem preenchidas (a maior ocupa a trilha toda)')
            p.screenshot(path=str(FOTOS / f'carteira-analise-{tema}.png'), full_page=True)

            # PDF: todos os municípios no resumo e o nome sem o número
            p.click('#btnPdfCart'); p.wait_for_timeout(400)
            textos = p.evaluate('window.__pdfTextos')
            salvo = p.evaluate('window.__pdfSalvo')
            ok(bool(salvo), f'o PDF foi gerado ({salvo})')
            # só o bloco "Por município" do resumo (a lista de clientes também escreve as cidades, linha a linha)
            i = textos.index('POR MUNICÍPIO') if 'POR MUNICÍPIO' in textos else -1
            j = textos.index('POR SEGMENTO', i + 1) if i >= 0 and 'POR SEGMENTO' in textos[i + 1:] else len(textos)
            bloco = textos[i + 1:j] if i >= 0 else []
            faltam = [m for m in MUNICIPIOS if m not in bloco]
            ok(i >= 0 and not faltam, 'o bloco "Por município" do PDF leva todos os municípios' + (f' — faltaram: {", ".join(faltam)}' if faltam else ''))
            ok(any(t == 'FULANO DE TESTE' for t in textos), 'a lista do PDF traz "FULANO DE TESTE"')
            ok(not any('12345678901' in t for t in textos), 'nenhuma linha do PDF leva o CPF do MEI')

            # Excel: nome sem o número e CNPJ formatado
            p.click('#btnXlsCart'); p.wait_for_timeout(400)
            xls = p.evaluate('window.__xls')
            ok(bool(xls.get('salvo')), f'o Excel foi gerado ({xls.get("salvo")})')
            linhas = (xls.get('abas') or [{}])[0].get('__linhas') or []
            empresas = [l.get('Empresa') for l in linhas]
            docs = [l.get('CNPJ/CPF') for l in linhas]
            ok(len(linhas) == 13, f'a aba da relação tem os 13 ativos ({len(linhas)})')
            ok('FULANO DE TESTE' in empresas and 'BELTRANA DE TESTE' in empresas, 'Empresa sai sem o número do MEI')
            ok(all(re.fullmatch(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', d or '') for d in docs), 'CNPJ sai formatado em todas as linhas')
            resumo = (xls.get('abas') or [{}, {}])[1].get('__aoa') or []
            ok(not any('12345678901' in str(c) for linha in resumo for c in linha), 'o resumo do Excel não leva o CPF do MEI')

            ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
            p.close()
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
