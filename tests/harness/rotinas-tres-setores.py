"""Teste das telas de Tarefas recorrentes do Fiscal, do Comercial e do Societário, que em 01/10/2026
viraram páginas finas do módulo único (assets/js/rotinas-setor.js) — sem login e sem banco
(mesmo mock do conferir.py, dados inventados: rotinas rm3 [fiscal], rm4 [comercial] e rm5 [societário]).

    python tests/harness/rotinas-tres-setores.py

Confere, nos temas escuro e claro, pras três telas:
  1. a tela carrega sem erro de JavaScript e mostra a rotina do próprio setor;
  2. não mostra rotina de nenhum outro setor (nem as do DP e do Contábil, nem as dos outros dois);
  3. o caminho (breadcrumb) aponta pro hub do setor;
  4. a lista de responsável começa por quem a fila de 01/10 mandou (Fiscal: Thalia; Comercial: Samuel;
     Societário: Adaini);
  5. "+ Rotina" cria a rotina no setor certo;
  6. vincular uma empresa grava em tarefas_recorrentes com o setor certo e o responsável escolhido.
E nos três hubs:
  7. o card "Tarefas recorrentes" existe e aponta pra página do setor — no Fiscal, com o texto que manda as
     obrigações continuarem em Obrigações.
Fotos em .harness/fotos/tres-setores-*.png. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

# setor, nome na tela, hub, rotina inventada do setor, 1º responsável da lista, cliente e dia do vínculo
SETORES = [
    ('fiscal',     'Fiscal',     'fiscal.html',     'rm3', 'RECADASTRAMENTO ESTADUAL (TESTE)',   'Thalia', 'c1', 'com', 12, 'Adaini',  'VISTORIA DO CORPO DE BOMBEIROS (TESTE)'),
    ('comercial',  'Comercial',  'comercial.html',  'rm4', 'LIGAÇÃO DE RELACIONAMENTO (TESTE)',  'Samuel', 'c2', 'emp', 18, 'Diego',   'PESQUISA DE SATISFAÇÃO (TESTE)'),
    ('societario', 'Societário', 'societario.html', 'rm5', 'RENOVAÇÃO DE ALVARÁ (TESTE)',        'Adaini', 'c1', 'com', 25, 'Samuel',  'ATUALIZAÇÃO DE CONTRATO SOCIAL (TESTE)'),
]
# o card do Fiscal avisa que obrigação continua em Obrigações; os outros dois usam o texto do Contábil
CARD_FISCAL = 'As obrigações continuam em Obrigações.'

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
            for setor, nome, hub, modelo, rotina, primeiro, cliente, busca, dia, resp, nova_rotina in SETORES:
                print(f'[{tema}] {nome} — {setor}-regras.html')
                p, _ = abrir(b, base, tema, f'{setor}-regras.html', erros, respostas=[nova_rotina])
                itens = p.locator('.rv-item').all_inner_texts()
                ok(any(rotina in t for t in itens), f'1. a rotina do {nome} aparece na lista')
                outras = p.evaluate(f"() => window.__mockDb.rotinas_modelo.filter(r => r.setor !== '{setor}').map(r => r.nome)")
                ok(not any(o in t for t in itens for o in outras), '2. nenhuma rotina de outro setor')
                ok(p.locator(f'.breadcrumb a[href="{hub}"]').inner_text().strip() == nome, f'3. caminho aponta pro hub do {nome}')
                ok(p.evaluate("() => [...document.querySelectorAll('#ovResp option')].map(o => o.textContent)[1]") == primeiro,
                   f'4. a lista de responsável começa pelo {primeiro}')
                p.screenshot(path=str(FOTOS / f'tres-setores-{setor}-{tema}.png'))

                p.click('#rvNova'); p.wait_for_timeout(700)
                criada = p.evaluate(f"() => window.__mockDb.rotinas_modelo.find(r => r.nome === {nova_rotina!r})")
                ok(bool(criada) and criada['setor'] == setor, f"5. \"+ Rotina\" cria no setor '{setor}'")

                p.locator('.rv-item', has_text=rotina).click(); p.wait_for_timeout(400)
                vincular(p, busca, cliente, dia, resp)
                novo = p.evaluate(f"() => window.__mockDb.tarefas_recorrentes.find(v => v.cliente_id === '{cliente}' && v.modelo_id === '{modelo}')")
                ok(bool(novo) and novo['setor'] == setor and novo['titulo'] == rotina and novo['dia_vencimento'] == dia
                   and novo['responsavel'] == resp and novo['origem'] == 'rotina',
                   f"6. vínculo gravado: setor {setor}, a rotina, dia {dia}, {resp}")
                p.close()

            for setor, nome, hub, *_ in SETORES:
                print(f'[{tema}] hub do {nome}')
                p, _ = abrir(b, base, tema, hub, erros)
                card = p.locator(f'a.dashboard-card[href="{setor}-regras.html"]')
                ok(card.count() == 1 and 'Tarefas recorrentes' in card.inner_text(), f'7. card "Tarefas recorrentes" no hub do {nome}')
                if setor == 'fiscal':
                    ok(CARD_FISCAL in card.inner_text(), '7. no Fiscal, o card manda as obrigações pra Obrigações')
                p.screenshot(path=str(FOTOS / f'tres-setores-hub-{setor}-{tema}.png'))
                p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
