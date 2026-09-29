"""
Teste do responsável obrigatório nos vínculos de Obrigações fiscais (fiscal-obrigacoes.html) — sem login e sem
banco (mesmo mock do conferir.py). Caso que originou: vínculo da Vila Rocha salvo sem responsável (29/09/2026).

    python tests/harness/obrigacoes-responsavel.py

Nos temas escuro e claro, com os dados inventados do supabase.mock.js (obrigações o1/o2, vínculos v1/v2/v3,
tarefas t71–t73), confere:
  1. vínculo ATIVO sem responsável (v1) aparece como "⚠ definir responsável"; o INATIVO (v3) segue "—";
  2. clicar em "definir responsável" abre a lista da equipe; escolher "Thalia" grava no vínculo e leva junto a
     tarefa aberta sem dono (t71) — a aberta repassada à mão pra Adaini (t72) e a concluída (t73) ficam como estão;
     aparece o aviso "1 tarefa aberta foi junto";
  3. Esc na lista não grava nada;
  4. "Vincular" com o responsável em branco não grava (avisa); escolhido, grava com ele.
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

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}]')
            p = b.new_page(viewport={'width': 1400, 'height': 900})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            dialogos = []
            p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_timeout(1500)
            db = lambda js: p.evaluate(js)
            p.click('#segFiltro button[data-f="todos"]'); p.wait_for_timeout(300)
            p.click('.obr-head[data-rid="o1"]'); p.wait_for_timeout(300)
            r1 = p.locator('.obr-cli[data-vid="v1"] .dt-edit[data-edit="resp"]')
            r3 = p.locator('.obr-cli[data-vid="v3"] .dt-edit[data-edit="resp"]')
            ok('definir responsável' in r1.inner_text(), '1. vínculo ativo sem responsável: "⚠ definir responsável"')
            ok(r3.inner_text().strip() == '—', '1. vínculo inativo sem responsável: segue "—"')
            p.locator('.obr-item[data-rid="o1"]').screenshot(path=str(FOTOS / f'obr-{tema}-1-sem-responsavel.png'))
            # 2. definir pela lista da equipe
            r1.click(); p.wait_for_timeout(200)
            sel = p.locator('.obr-cli[data-vid="v1"] select.input-inline')
            ok(sel.count() == 1, '2. clicar abre a lista (select)')
            opcoes = sel.locator('option').all_inner_texts()
            ok(all(n in opcoes for n in ('Thalia', 'Adaini', 'Vitória', 'Samuel', 'Diego', 'Edna')), '2. a lista tem a equipe: ' + ', '.join(opcoes[1:]))
            # (sem foto aqui: com a lista nativa aberta o navegador de teste não fotografa)
            sel.select_option('Thalia'); p.wait_for_timeout(800)
            v1 = db("() => window.__mockDb.cliente_obrigacoes.find(v => v.id === 'v1').responsavel")
            t = db("() => Object.fromEntries(window.__mockDb.tarefas.filter(x => ['t71','t72','t73'].includes(x.id)).map(x => [x.id, x.responsavel]))")
            ok(v1 == 'Thalia', '2. vínculo gravado com Thalia')
            ok(t.get('t71') == 'Thalia', '2. tarefa aberta sem dono (t71) foi junto → Thalia')
            ok(t.get('t72') == 'Adaini', '2. tarefa aberta repassada à mão (t72) ficou com Adaini')
            ok(t.get('t73') is None, '2. tarefa concluída (t73) não foi mexida')
            aviso = p.locator('.obr-cli[data-vid="v1"] .chip.c-verde').all_inner_texts()
            ok(any('1 tarefa aberta foi junto' in a for a in aviso), '2. aviso "1 tarefa aberta foi junto" na linha')
            ok(p.locator('.obr-cli[data-vid="v1"] .dt-edit[data-edit="resp"]').inner_text().strip() == 'Thalia', '2. a linha passa a mostrar Thalia')
            p.locator('.obr-item[data-rid="o1"]').screenshot(path=str(FOTOS / f'obr-{tema}-3-definido.png'))
            # 3. Esc não grava
            p.locator('.obr-cli[data-vid="v2"] .dt-edit[data-edit="resp"]').click(); p.wait_for_timeout(200)
            p.keyboard.press('Escape'); p.wait_for_timeout(200)   # 1º Esc fecha a lista do navegador
            p.keyboard.press('Escape'); p.wait_for_timeout(400)   # 2º Esc cancela a edição
            ok(p.locator('.obr-cli[data-vid="v2"] select').count() == 0, '3. Esc sai da edição')
            ok(db("() => window.__mockDb.cliente_obrigacoes.find(v => v.id === 'v2').responsavel") == 'Thalia', '3. Esc: nada gravado')
            # 4. vincular exige responsável
            p.click('.obr-head[data-rid="o2"]'); p.wait_for_timeout(300)
            p.click('[data-add-rid="o2"]'); p.wait_for_timeout(500)
            p.click('#vincLista .vm-item[data-id="c1"]'); p.wait_for_timeout(300)
            antes = db("() => window.__mockDb.cliente_obrigacoes.length")
            p.locator('.fa-modal', has=p.locator('#vincResp')).screenshot(path=str(FOTOS / f'obr-{tema}-4-vincular.png'))
            p.click('#vincSalvar'); p.wait_for_timeout(400)
            ok(db("() => window.__mockDb.cliente_obrigacoes.length") == antes, '4. Vincular sem responsável: nada gravado')
            ok(any('Escolha o responsável' in d for d in dialogos), '4. e avisa pra escolher o responsável')
            p.select_option('#vincResp', 'Adaini'); p.click('#vincSalvar'); p.wait_for_timeout(600)
            novo = db("() => window.__mockDb.cliente_obrigacoes.find(v => v.obrigacao_id === 'o2' && v.cliente_id === 'c1')")
            ok(bool(novo) and novo.get('responsavel') == 'Adaini', '4. Vincular com responsável: gravado com Adaini')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
