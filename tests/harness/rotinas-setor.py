"""
Teste do módulo único de tarefas recorrentes por setor (assets/js/rotinas-setor.js) — sem login e sem banco
(mesmo mock do conferir.py, dados inventados: rotinas rm1 [dp] e rm2 [contabil], vínculos tr1/tr2, avulsa tr3).

    python tests/harness/rotinas-setor.py

Confere, nos temas escuro e claro:
  Contábil (contabil-regras.html)
    1. lista só as rotinas do Contábil (a do DP não aparece) + a avulsa "criada pela Nova tarefa";
    2. caminho da página aponta pro Contábil;
    3. vincular empresa grava em tarefas_recorrentes com setor 'contabil', a rotina, o título, dia e responsável;
       sem responsável não grava;
    4. "+ Rotina" cria a rotina no setor 'contabil';
    5. "transformar em rotina" (avulsa) cria a rotina no Contábil e passa o vínculo pra ela.
  DP (dp-regras.html)
    6. lista só a rotina do DP; vincular grava com setor 'dp'.
  Hub (contabil.html)
    7. tem o card "Tarefas recorrentes" apontando pra contabil-regras.html.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, tema, pagina, erros, respostas=None):
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} {pagina}: {e}'))
    dialogos = []
    def trata(d):
        dialogos.append(d.message)
        if d.type == 'prompt' and respostas: d.accept(respostas.pop(0))
        else: d.accept()
    p.on('dialog', trata)
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
    p.goto(base + pagina); p.wait_for_timeout(1500)
    return p, dialogos

def vincular(p, busca, cliente_id, dia, resp):
    p.click('#rvVinc'); p.wait_for_timeout(300)
    p.fill('#ovCli', busca); p.wait_for_timeout(700)
    p.click(f'#ovRes button[data-id="{cliente_id}"]'); p.wait_for_timeout(200)
    p.fill('#ovDia', str(dia))
    if resp: p.select_option('#ovResp', resp)
    p.click('#ovSalvar'); p.wait_for_timeout(700)

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}] Contábil')
            p, dialogos = abrir(b, base, tema, 'contabil-regras.html', erros, respostas=['BALANCETE (TESTE)'])
            itens = p.locator('.rv-item').all_inner_texts()
            ok(any('CONCILIAÇÃO BANCÁRIA (TESTE)' in t for t in itens), '1. rotina do Contábil na lista')
            ok(any('EMISSÃO DE EXTRATOS (TESTE)' in t and 'criada pela Nova tarefa' in t for t in itens), '1. avulsa "criada pela Nova tarefa" na lista')
            ok(not any('FOLHA DE PAGAMENTO' in t for t in itens), '1. a rotina do DP não aparece no Contábil')
            ok(p.locator('.breadcrumb a[href="contabil.html"]').inner_text().strip() == 'Contábil', '2. caminho aponta pro Contábil')
            p.locator('.rv-item', has_text='CONCILIAÇÃO BANCÁRIA (TESTE)').click(); p.wait_for_timeout(400)
            ok('dia 10 de cada mês' in p.inner_text('#rvPainel') and 'Adaini' in p.inner_text('#rvPainel'), '3. vínculo existente aparece (dia 10, Adaini)')
            p.screenshot(path=str(FOTOS / f'rotinas-contabil-{tema}.png'))
            antes = p.evaluate("() => window.__mockDb.tarefas_recorrentes.length")
            vincular(p, 'com', 'c1', 15, None)
            ok(p.evaluate("() => window.__mockDb.tarefas_recorrentes.length") == antes, '3. sem responsável: nada gravado')
            ok(any('Escolha o responsável' in d for d in dialogos), '3. e avisa pra escolher o responsável')
            p.select_option('#ovResp', 'Adaini'); p.click('#ovSalvar'); p.wait_for_timeout(700)
            novo = p.evaluate("() => window.__mockDb.tarefas_recorrentes.find(v => v.cliente_id === 'c1' && v.modelo_id === 'rm2')")
            ok(bool(novo) and novo['setor'] == 'contabil' and novo['titulo'] == 'CONCILIAÇÃO BANCÁRIA (TESTE)' and novo['dia_vencimento'] == 15
               and novo['responsavel'] == 'Adaini' and novo['origem'] == 'rotina' and novo['periodicidade'] == 'mensal',
               '3. vínculo gravado: setor contabil, rotina, título, dia 15, Adaini, mensal')
            p.click('#rvNova'); p.wait_for_timeout(600)
            nova = p.evaluate("() => window.__mockDb.rotinas_modelo.find(r => r.nome === 'BALANCETE (TESTE)')")
            ok(bool(nova) and nova['setor'] == 'contabil', '4. "+ Rotina" cria no setor contabil')
            p.locator('.rv-item', has_text='EMISSÃO DE EXTRATOS (TESTE)').click(); p.wait_for_timeout(400)
            ok(p.locator('#rvVinc').is_hidden() and p.locator('#rvConv').count() == 1, '5. avulsa: sem "+ Vincular", com "transformar em rotina"')
            p.click('#rvConv'); p.wait_for_timeout(700)
            conv = p.evaluate("() => { const r = window.__mockDb.rotinas_modelo.find(x => x.nome === 'EMISSÃO DE EXTRATOS (TESTE)'); const v = window.__mockDb.tarefas_recorrentes.find(x => x.id === 'tr3'); return { setor: r && r.setor, liga: !!(r && v && v.modelo_id === r.id) }; }")
            ok(conv['setor'] == 'contabil' and conv['liga'], '5. virou rotina do Contábil, com o vínculo passado pra ela')
            p.close()

            print(f'[{tema}] DP')
            p, _ = abrir(b, base, tema, 'dp-regras.html', erros)
            itens = p.locator('.rv-item').all_inner_texts()
            ok(any('FOLHA DE PAGAMENTO (TESTE)' in t for t in itens) and not any('CONCILIAÇÃO' in t or 'EXTRATOS' in t for t in itens), '6. DP lista só a rotina do DP')
            p.locator('.rv-item', has_text='FOLHA DE PAGAMENTO (TESTE)').click(); p.wait_for_timeout(400)
            vincular(p, 'emp', 'c2', 20, 'Vitória')
            novo = p.evaluate("() => window.__mockDb.tarefas_recorrentes.find(v => v.cliente_id === 'c2' && v.modelo_id === 'rm1')")
            ok(bool(novo) and novo['setor'] == 'dp' and novo['responsavel'] == 'Vitória', '6. vincular no DP grava com setor dp')
            p.close()

            print(f'[{tema}] Hub do Contábil')
            p, _ = abrir(b, base, tema, 'contabil.html', erros)
            card = p.locator('a.dashboard-card[href="contabil-regras.html"]')
            ok(card.count() == 1 and 'Tarefas recorrentes' in card.inner_text(), '7. card "Tarefas recorrentes" no hub do Contábil')
            p.screenshot(path=str(FOTOS / f'hub-contabil-{tema}.png'))
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
