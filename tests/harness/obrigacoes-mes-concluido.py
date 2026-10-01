"""
Teste de Obrigações fiscais (fiscal-obrigacoes.html) com o filtro "Pendentes do mês": obrigação com o mês todo concluído
(ou sem vínculo ativo) não pode sumir da lista — sumia inteira e levava junto o "+ Vincular cliente" (PGDAS, relato da
Thalia em 30/09/2026). Sem login e sem banco (mesmo mock do conferir.py, dados inventados: o1 com 2 pendentes, o2 sem
vínculo, o3 "PGDAS TESTE MENSAL" com o único cliente já concluído no mês).

    python tests/harness/obrigacoes-mes-concluido.py

Confere, nos temas escuro e claro:
  1. Pendentes do mês: as três obrigações aparecem — a com pendência primeiro, as zeradas depois do título
     "Sem pendência no mês"; a PGDAS com "✓ mês concluído" e "0 de 1 no mês";
  2. abrir a PGDAS mostra "Tudo concluído no mês" e o "+ Vincular cliente", que abre a janela de vínculo;
  3. vincular um cliente novo grava o vínculo, e a PGDAS volta pro grupo de cima com "1 de 2 no mês";
  4. a busca acha a obrigação zerada;
  5. Todos: continua como antes (sem o título do grupo, sem o chip);
  6. Por cliente: o cliente sem nada pendente também não some (fica no grupo "Sem pendência no mês").
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

# ordem dos blocos na lista: id de cada .obr-item e 'GRUPO' no título "Sem pendência no mês"
ORDEM = "() => [...document.querySelectorAll('#listaObr > .obr-item, #listaObr > [data-grupo]')].map(e => e.dataset.grupo ? 'GRUPO' : e.dataset.rid)"

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}] Obrigações fiscais')
            p = b.new_page(viewport={'width': 1400, 'height': 900})
            p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
            p.on('dialog', lambda d: d.accept())
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_timeout(1500)

            ordem = p.evaluate(ORDEM)
            ok(ordem == ['o1', 'GRUPO', 'o2', 'o3'], f'1. pendente primeiro, zeradas depois do título (ordem: {ordem})')
            ok('Sem pendência no mês · 2 obrigações' in p.locator('#listaObr [data-grupo]').text_content(), '1. título "Sem pendência no mês · 2 obrigações"')
            cab = p.inner_text('.obr-item[data-rid="o3"] .obr-head')
            ok('PGDAS TESTE MENSAL' in cab and '✓ mês concluído' in cab and '0 de 1 no mês' in cab, '1. PGDAS com "✓ mês concluído" e "0 de 1 no mês"')
            ok('mês concluído' not in p.inner_text('.obr-item[data-rid="o2"] .obr-head'), '1. a sem vínculo não ganha o chip de concluído')
            p.screenshot(path=str(FOTOS / f'obrigacoes-mes-concluido-{tema}.png'))

            p.click('.obr-item[data-rid="o3"] .obr-head'); p.wait_for_timeout(200)
            corpo = p.inner_text('.obr-item[data-rid="o3"] .obr-corpo')
            ok('Tudo concluído no mês' in corpo and p.locator('[data-add-rid="o3"]').is_visible(), '2. aberta: "Tudo concluído no mês" + "+ Vincular cliente"')
            p.click('[data-add-rid="o3"]'); p.wait_for_timeout(500)
            ok(p.evaluate("() => document.getElementById('vincOverlay').classList.contains('is-open')")
               and 'PGDAS TESTE MENSAL' in p.inner_text('#vincTitulo'), '2. abre a janela "Vincular cliente — PGDAS TESTE MENSAL"')

            p.click('#vincLista .vm-item[data-id="c1"]'); p.wait_for_timeout(200)
            p.select_option('#vincResp', 'Thalia'); p.click('#vincSalvar'); p.wait_for_timeout(600)
            novo = p.evaluate("() => window.__mockDb.cliente_obrigacoes.find(v => v.obrigacao_id === 'o3' && v.cliente_id === 'c1')")
            ok(bool(novo) and novo['responsavel'] == 'Thalia' and novo['ativo'] is True, '3. vínculo novo gravado (PGDAS + cliente novo, Thalia)')
            ordem = p.evaluate(ORDEM)
            ok(ordem.index('o3') < ordem.index('GRUPO') and '1 de 2 no mês' in p.inner_text('.obr-item[data-rid="o3"] .obr-head'),
               f'3. PGDAS volta pro grupo de cima com "1 de 2 no mês" (ordem: {ordem})')

            p.fill('#busca', 'pgdas'); p.wait_for_timeout(300)
            ok(p.locator('.obr-item[data-rid="o3"]').count() == 1, '4. a busca acha a PGDAS')
            p.fill('#busca', 'dctf'); p.wait_for_timeout(300)
            ok(p.locator('.obr-item[data-rid="o2"]').count() == 1, '4. a busca acha a obrigação zerada sem vínculo')
            p.fill('#busca', ''); p.wait_for_timeout(300)

            p.click('#segFiltro button[data-f="todos"]'); p.wait_for_timeout(300)
            ok(p.locator('#listaObr [data-grupo]').count() == 0 and 'mês concluído' not in p.inner_text('#listaObr')
               and p.evaluate(ORDEM) == ['o1', 'o2', 'o3'], '5. Todos: como antes, na ordem de sempre, sem grupo nem chip')

            p.click('#segVisao button[data-v="cliente"]'); p.click('#segFiltro button[data-f="pendentes"]'); p.wait_for_timeout(400)
            ordem = p.evaluate(ORDEM)
            ok(ordem[-2:] == ['GRUPO', 'c3'] and p.locator('[data-add-cid="c3"]').count() == 1,
               f'6. Por cliente: o cliente sem pendência fica no grupo, com "+ Adicionar obrigação" (ordem: {ordem})')
            p.screenshot(path=str(FOTOS / f'obrigacoes-mes-concluido-cliente-{tema}.png'))
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
