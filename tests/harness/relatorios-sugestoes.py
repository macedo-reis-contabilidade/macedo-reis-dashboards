"""Teste dos módulos únicos de Relatórios (assets/js/relatorios-setor.js) e Sugestões de melhoria
(assets/js/sugestoes-setor.js) — sem login e sem banco (mesmo mock do conferir.py, dados inventados).

    python tests/harness/relatorios-sugestoes.py

Confere, nos temas escuro e claro:
  Relatórios — as 7 telas (comercial, contábil, DP, financeiro, fiscal, IRPF, societário)
    1. o nome do setor aparece no título, no caminho, no <h1> e no cabeçalho de impressão;
    2. a tabela traz só as tarefas do setor (nem uma linha a mais, nem título de outro setor);
    3. setor sem nada registrado mostra o texto do próprio setor ("no comercial", "no DP");
    4. filtrar por situação muda os contadores do topo.
  Sugestões de melhoria — as 3 telas (contábil, DP, fiscal)
    5. o nome do setor aparece no caminho e no <h1>;
    6. a lista traz só as sugestões do setor (pendentes em cima, concluídas recolhidas embaixo);
    7. gravar uma sugestão nova grava com o setor da tela;
    8. sem título/melhoria não grava e avisa.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

# setor -> (nome que aparece na tela, hub, nome no texto de lista vazia)
RELATORIOS = [
    ('comercial',  'Comercial',             'comercial.html',  'comercial'),
    ('contabil',   'Contábil',              'contabil.html',   'contábil'),
    ('dp',         'Departamento Pessoal',  'dp.html',         'DP'),
    ('financeiro', 'Financeiro',            'financeiro.html', 'financeiro'),
    ('fiscal',     'Fiscal',                'fiscal.html',     'fiscal'),
    ('irpf',       'IRPF',                  'irpf.html',       'IRPF'),
    ('societario', 'Societário',            'societario.html', 'societário'),
]
SUGESTOES = [
    ('contabil', 'Contábil',             'contabil.html'),
    ('dp',       'Departamento Pessoal', 'dp.html'),
    ('fiscal',   'Fiscal',               'fiscal.html'),
]

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, tema, pagina, erros):
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema} {pagina}: {e}'))
    dialogos = []
    p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
    p.goto(base + pagina); p.wait_for_timeout(1200)
    return p, dialogos

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            for setor, nome, hub, vazio in RELATORIOS:
                print(f'[{tema}] Relatórios · {nome}')
                p, _ = abrir(b, base, tema, f'{setor}-relatorios.html', erros)
                ok(nome in p.title(), '1. o nome do setor está no título da aba')
                ok(p.locator(f'.breadcrumb a[href="{hub}"]').inner_text().strip() == nome, '1. caminho aponta pro hub do setor')
                ok(p.locator('h1').inner_text().strip() == nome, '1. <h1> com o nome do setor')
                ok(p.locator('.print-title').text_content().strip() == f'Relatório — {nome}', '1. cabeçalho de impressão do setor')
                minhas = p.evaluate(f"() => window.__mockDb.tarefas.filter(t => t.setor === '{setor}')")
                outras = p.evaluate(f"() => window.__mockDb.tarefas.filter(t => t.setor !== '{setor}').map(t => t.titulo)")
                corpo = p.inner_text('#tbody')
                if minhas:
                    ok(p.locator('#tbody tr').count() == len(minhas), f'2. {len(minhas)} linha(s) — uma por tarefa do setor')
                    ok(all(t['titulo'] in corpo for t in minhas), '2. todas as tarefas do setor estão na tabela')
                    ok(not any(t in corpo for t in outras if t not in [x['titulo'] for x in minhas]), '2. nenhuma tarefa de outro setor')
                    ok(p.locator('#statTotal').inner_text() == str(len(minhas)), '4. contador "No filtro" bate com a lista')
                    p.select_option('#filterSituacao', 'concluida'); p.wait_for_timeout(300)
                    concl = len([t for t in minhas if t.get('concluida_em')])
                    ok(p.locator('#statTotal').inner_text() == str(concl), f'4. filtrar por "Concluída" deixa {concl}')
                    p.click('#btnLimpar'); p.wait_for_timeout(300)
                    ok(p.locator('#statTotal').inner_text() == str(len(minhas)), '4. "Limpar filtros" volta a lista inteira')
                else:
                    ok(f'Nada registrado ainda no {vazio}' in corpo, f'3. lista vazia diz "no {vazio}"')
                    ok(f'Conforme as tarefas do {vazio} forem concluídas' in corpo, f'3. e "do {vazio}" no corpo')
                p.screenshot(path=str(FOTOS / f'relatorios-{setor}-{tema}.png'))
                p.close()

            for setor, nome, hub in SUGESTOES:
                print(f'[{tema}] Sugestões · {nome}')
                p, dialogos = abrir(b, base, tema, f'{setor}-sugestoes.html', erros)
                ok(nome in p.title(), '5. o nome do setor está no título da aba')
                ok(p.locator(f'.breadcrumb a[href="{hub}"]').inner_text().strip() == nome, '5. caminho aponta pro hub do setor')
                ok(p.locator('h1').inner_text().strip() == nome, '5. <h1> com o nome do setor')
                minhas = p.evaluate(f"() => window.__mockDb.sugestoes.filter(s => s.setor === '{setor}')")
                outras = p.evaluate(f"() => window.__mockDb.sugestoes.filter(s => s.setor !== '{setor}').map(s => s.titulo)")
                pend = [s for s in minhas if s['status'] != 'concluida']
                feitas = [s for s in minhas if s['status'] == 'concluida']
                lista = p.inner_text('#lista')
                ok(p.locator('.sg-card').count() == len(pend) and all(s['titulo'] in lista for s in pend), f'6. {len(pend)} sugestão(ões) pendente(s) do setor')
                ok(p.locator('.sg-done').count() == len(feitas), f'6. {len(feitas)} concluída(s) recolhida(s)')
                ok(not any(t in lista for t in outras), '6. nenhuma sugestão de outro setor')

                antes = p.evaluate("() => window.__mockDb.sugestoes.length")
                p.click('#btnNova'); p.wait_for_timeout(300)
                p.click('#btnSalvar'); p.wait_for_timeout(400)
                ok(p.evaluate("() => window.__mockDb.sugestoes.length") == antes, '8. sem título/melhoria: nada gravado')
                ok(any('Preencha pelo menos o título' in d for d in dialogos), '8. e avisa o que falta')

                p.fill('#fTitulo', f'IDEIA NOVA DE TESTE ({setor})')
                p.fill('#fAutor', 'Diego')
                p.fill('#fMelhoria', 'Testar antes de entregar')
                p.click('#btnSalvar'); p.wait_for_timeout(600)
                nova = p.evaluate(f"() => window.__mockDb.sugestoes.find(s => s.titulo === 'IDEIA NOVA DE TESTE ({setor})')")
                ok(bool(nova) and nova['setor'] == setor and nova['autor'] == 'Diego' and nova['melhoria'] == 'Testar antes de entregar',
                   f"7. sugestão nova gravada com setor '{setor}', autor e melhoria")
                ok(p.locator('#modalOverlay.is-open').count() == 0 and f'IDEIA NOVA DE TESTE ({setor})' in p.inner_text('#lista'),
                   '7. a janela fecha e a sugestão aparece na lista')
                p.screenshot(path=str(FOTOS / f'sugestoes-{setor}-{tema}.png'))
                p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
