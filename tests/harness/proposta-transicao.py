"""
Teste da passagem proposta fechada -> transição (comercial-precificacao.html, aba Propostas) — sem login e sem banco
(mesmo mock do conferir.py, dados inventados: pp1 apresentada, pp2 fechada sem transição, pp3 fechada com a transição tx1).

    python tests/harness/proposta-transicao.py

Confere, nos temas escuro e claro:
  1. a fechada sem transição mostra o botão "🚀 Iniciar transição"; a que já tem transição mostra "Ver transição →",
     que abre direto nela (?transicao=); a apresentada não mostra nenhum dos dois;
  2. mudar o status pra "fechada" grava o status e já abre a janela da transição, perguntando ("Agora não");
  3. "Agora não" fecha sem criar nada, e a linha fica com o botão "🚀 Iniciar transição";
  4. mudar o status de quem já tem transição (ou pra outro status que não "fechada") não abre a janela;
  5. o botão "🚀 Iniciar transição" abre a mesma janela, no modo normal ("Cancelar");
  6. "Criar transição" grava a transição ligada à proposta e abre direto nela (?transicao=<id novo>);
  7. clicar em "Ver transição →" abre a transição, sem abrir a proposta no questionário.
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

def abrir(b, base, tema, erros):
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
    p.goto(base + 'comercial-precificacao.html'); p.wait_for_timeout(1500)
    p.click('#prSeg button[data-v="props"]'); p.wait_for_timeout(700)
    return p

def linha(p, pid):
    return p.locator(f'tr.prop[data-pid="{pid}"]')

def janela_aberta(p):
    return p.evaluate("() => document.getElementById('ovTransProp').style.display === 'flex'")

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}] Propostas')
            p = abrir(b, base, tema, erros)
            ok(linha(p, 'pp2').locator('[data-trans]').inner_text().strip() == '🚀 Iniciar transição', '1. fechada sem transição: botão "🚀 Iniciar transição"')
            ver = linha(p, 'pp3').locator('a[data-vertrans]')
            ok(ver.count() == 1 and 'Ver transição' in ver.inner_text() and ver.get_attribute('href') == 'comercial-transicao.html?transicao=tx1',
               '1. fechada com transição: "Ver transição →" abrindo direto nela')
            ok(linha(p, 'pp3').locator('[data-trans]').count() == 0, '1. e sem o botão de iniciar (não duplica)')
            ok(linha(p, 'pp1').locator('[data-trans], [data-vertrans]').count() == 0, '1. apresentada: nenhum dos dois')
            p.screenshot(path=str(FOTOS / f'propostas-transicao-{tema}.png'))

            p.select_option('.st-sel[data-st="pp1"]', 'fechada'); p.wait_for_timeout(800)
            st = p.evaluate("() => window.__mockDb.precificacoes.find(x => x.id === 'pp1').status")
            ok(st == 'fechada', '2. status gravado como fechada')
            ok(janela_aberta(p), '2. a janela da transição abriu sozinha')
            ok('iniciar a transição?' in p.inner_text('#tpTitulo') and 'PADARIA FICTÍCIA LTDA' in p.inner_text('#tpNome')
               and p.inner_text('#tpCancelar').strip() == 'Agora não', '2. pergunta com o nome da proposta e "Agora não"')
            p.screenshot(path=str(FOTOS / f'propostas-transicao-janela-{tema}.png'))
            antes = p.evaluate("() => window.__mockDb.transicoes.length")
            p.click('#tpCancelar'); p.wait_for_timeout(300)
            ok(not janela_aberta(p) and p.evaluate("() => window.__mockDb.transicoes.length") == antes, '3. "Agora não" fecha sem criar nada')
            ok(linha(p, 'pp1').locator('[data-trans]').count() == 1, '3. a linha ficou com o botão "🚀 Iniciar transição"')

            p.select_option('.st-sel[data-st="pp3"]', 'apresentada'); p.wait_for_timeout(700)
            ok(not janela_aberta(p), '4. mudar pra outro status não abre a janela')
            p.select_option('.st-sel[data-st="pp3"]', 'fechada'); p.wait_for_timeout(700)
            ok(not janela_aberta(p), '4. voltar pra fechada quem já tem transição não abre a janela')

            linha(p, 'pp2').locator('[data-trans]').click(); p.wait_for_timeout(500)
            ok(janela_aberta(p) and p.inner_text('#tpTitulo').strip() == '🚀 Iniciar transição' and p.inner_text('#tpCancelar').strip() == 'Cancelar'
               and p.inner_text('#tpMsg').strip() == '', '5. o botão abre a mesma janela, no modo normal')
            ok(p.evaluate("() => document.getElementById('vForm').style.display") == 'none', '5. e não abre a proposta no questionário')
            p.click('#tpConfirmar'); p.wait_for_timeout(500)
            nova = p.evaluate("() => window.__mockDb.transicoes.find(t => t.proposta_id === 'pp2')")
            ok(bool(nova) and nova['tipo'] == 'entrada' and nova['titulo'] == 'OFICINA MODELO LTDA', '6. transição gravada, ligada à proposta')
            try:
                p.wait_for_url('**/comercial-transicao.html?transicao=*', timeout=5000)
                ok(bool(nova) and p.url.endswith('?transicao=' + nova['id']), '6. e abre direto na transição criada')
            except Exception:
                ok(False, '6. e abre direto na transição criada (não navegou)')
            p.close()

            p = abrir(b, base, tema, erros)
            linha(p, 'pp3').locator('a[data-vertrans]').click()
            try:
                p.wait_for_url('**/comercial-transicao.html?transicao=tx1', timeout=5000)
                ok(True, '7. "Ver transição →" abre a transição')
            except Exception:
                ok(False, '7. "Ver transição →" abre a transição (não navegou)')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
