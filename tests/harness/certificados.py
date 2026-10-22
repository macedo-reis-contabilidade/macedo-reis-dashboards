"""
Certificados digitais dos clientes (Societário, 22/10/2026, pedido do Samuel) — sem login e sem banco (o mock do
conferir.py, com os certificados semeados só neste teste; nomes e números inventados). O relógio fica parado em
22/10/2026, meio-dia.

    python tests/harness/certificados.py

Confere:
  1. a tela abre em "Avisar agora" (há o que avisar), com os números de cada filtro e só quem precisa de aviso na lista;
  2. "Avisar": a janela traz o WhatsApp da última cobrança e a mensagem pronta; "Abrir no WhatsApp" abre o wa.me com o
     número e o texto; "Marcar como avisado" grava quando e quem, e o certificado sai de "Avisar agora";
  3. o detalhe do vencido sem empresa: o aviso de vencido, ligar a empresa, "Renovado" sem trocar a validade não grava
     (e diz o que fazer), com a validade nova grava, limpa o aviso antigo e o certificado vai pra "Em dia";
  4. "+ Novo certificado": sem a validade, não grava; com ela, aparece na lista;
  5. o link do vigia (?c=…) abre o certificado; Esc fecha a janela;
  6. texto de fora entra como texto (o titular com <img onerror>);
  7. o card no Societário: "2 a avisar";
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

# 22/10/2026: a de 20 dias e a vencida há 5 precisam de aviso; a de 10 dias já foi avisada na janela; uma em dia; uma que
# ninguém acompanha mais; e uma com o titular "perigoso" (em dia), pra conferir o escape
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.certificados_digitais = [
      { id: 'k1', cliente_id: 'c1', titular: 'COMÉRCIO MODELO', tipo: 'A1', validade: '2026-11-11', acompanhar: true, avisado_em: null, avisado_por: null, observacao: 'Repassado a CertPar', atualizado_em: null },
      { id: 'k2', cliente_id: null, titular: 'OFICINA INVENTADA', tipo: 'A3', validade: '2026-10-17', acompanhar: true, avisado_em: null, avisado_por: null, observacao: null, atualizado_em: null },
      { id: 'k3', cliente_id: 'c2', titular: 'EMPRESA EXEMPLO', tipo: 'A1', validade: '2026-11-01', acompanhar: true, avisado_em: '2026-10-05T15:00:00Z', avisado_por: 'Deize', observacao: null, atualizado_em: null },
      { id: 'k4', cliente_id: 'c2', titular: 'EMPRESA EXEMPLO FILIAL', tipo: 'A1', validade: '2027-05-10', acompanhar: true, avisado_em: null, avisado_por: null, observacao: null, atualizado_em: null },
      { id: 'k5', cliente_id: null, titular: 'ANTIGO CLIENTE', tipo: 'A1', validade: '2026-10-25', acompanhar: false, avisado_em: null, avisado_por: null, observacao: null, atualizado_em: null },
      { id: 'k6', cliente_id: null, titular: '<img src=x onerror="window.__pego=1">', tipo: null, validade: '2027-08-01', acompanhar: true, avisado_em: null, avisado_por: null, observacao: null, atualizado_em: null },
    ];
    v.cobrancas_mensais = (v.cobrancas_mensais || []).concat([
      { id: 'cb1', cliente_id: 'c1', competencia: '2026-08', destino: '51 3333-0000', valor: 100 },
      { id: 'cb2', cliente_id: 'c1', competencia: '2026-09', destino: '(51) 99876-5432', valor: 100 },
    ]);
  } });
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
ABRIR = "(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(String(u)); return null; }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def numeros(p):
    return {f: p.inner_text(f'#{i}') for f, i in (('avisar', 'cAvisar'), ('vence30', 'cProx'), ('vencido', 'cVenc'), ('emdia', 'cEmDia'), ('parado', 'cParado'), ('todos', 'cTodos'))}

def ids_na_lista(p):
    return p.eval_on_selector_all('#lista .cd-card', 'els => els.map(e => e.dataset.id)')

def linha(p, id_):
    return p.evaluate("id => { const r = window.__mockDb.certificados_digitais.find(x => x.id === id); return r ? JSON.parse(JSON.stringify(r)) : null; }", id_)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(ABRIR)
        p.clock.set_fixed_time('2026-10-22T12:00:00')

        print('1. A tela')
        p.goto(base + 'societario-certificados.html')
        p.wait_for_selector('#lista .cd-card', timeout=8000)
        n = numeros(p)
        ok(n == {'avisar': '2', 'vence30': '2', 'vencido': '1', 'emdia': '2', 'parado': '1', 'todos': '5'}, f'os números de cada filtro ({n})')
        ok(p.get_attribute('.fa-focus-card[data-f="avisar"]', 'aria-pressed') == 'true', 'abre em "Avisar agora"')
        ok(ids_na_lista(p) == ['k2', 'k1'], f'só quem precisa de aviso, a que vence antes em cima ({ids_na_lista(p)})')
        k1 = p.inner_text('.cd-card[data-id="k1"]')
        ok('COMÉRCIO MODELO' in k1 and 'Avisar agora' in k1 and 'Vence em 20 dias' in k1 and 'Ainda não avisado' in k1 and 'Repassado a CertPar' in k1,
           'o card: titular, "Avisar agora", quanto falta, o aviso e a observação')
        ok('sem empresa vinculada' in p.inner_text('.cd-card[data-id="k2"]') and 'Venceu em 17/10/2026' in p.inner_text('.cd-card[data-id="k2"]'),
           'o vencido sem empresa: "sem empresa vinculada" e "Venceu em"')
        p.click('.fa-focus-card[data-f="todos"]')
        ok(set(ids_na_lista(p)) == {'k1', 'k2', 'k3', 'k4', 'k6'}, f'"Todos" = os acompanhados ({ids_na_lista(p)})')
        ok('Avisado em 05/10/2026 por Deize' in p.inner_text('.cd-card[data-id="k3"]'), 'o já avisado mostra quando e quem')

        print('2. Avisar o cliente')
        p.click('.cd-card[data-id="k1"] .cd-btn-avisar')
        p.wait_for_selector('#ovAviso.is-open', timeout=3000)
        p.wait_for_function("() => document.getElementById('aDestino').value !== ''", timeout=3000)
        ok(p.input_value('#aDestino') == '(51) 99876-5432', f'o WhatsApp da última cobrança ({p.input_value("#aDestino")!r})')
        msg = p.input_value('#aMsg')
        ok('certificado digital A1 de COMÉRCIO MODELO vence em 11/11/2026, daqui a 20 dias' in msg and msg.startswith('Olá!'), 'a mensagem pronta')
        p.fill('#aMsg', msg + ' Obrigado!')
        p.click('#aWhats')
        abertos = p.evaluate('() => window.__abertos')
        ok(len(abertos) == 1 and abertos[0].startswith('https://wa.me/5551998765432?text=') and 'Obrigado!' in abertos[0].replace('%20', ' ').replace('%21', '!'),
           f'"Abrir no WhatsApp" abre o wa.me com o número e o texto editado ({abertos[:1]})')
        p.click('#aMarcar')
        p.wait_for_selector('#ovAviso:not(.is-open)', state='attached', timeout=3000)
        r = linha(p, 'k1')
        ok(r and r['avisado_em'] and r['avisado_por'] == 'Samuel', f'"Marcar como avisado" grava quando e quem ({r and r.get("avisado_por")})')
        ok(numeros(p)['avisar'] == '1' and 'Avisado em 22/10/2026 por Samuel' in p.inner_text('.cd-card[data-id="k1"]'), 'saiu de "Avisar agora" e o card mostra o aviso')

        print('3. O vencido: ligar a empresa e renovar')
        p.click('.cd-card[data-id="k2"]')
        p.wait_for_selector('#ovDet.is-open', timeout=3000)
        ok('Venceu em 17/10/2026 (venceu há 5 dias). Hora de avisar o cliente.' in p.inner_text('#dBanner'), f'o aviso de vencido ({p.inner_text("#dBanner")!r})')
        p.select_option('#dCliente', 'c2')
        p.click('#dRenovado')
        ok('Troque a validade' in p.inner_text('#dErro') and linha(p, 'k2')['validade'] == '2026-10-17', 'Renovado sem trocar a validade não grava e diz o que fazer')
        p.fill('#dValidade', '2027-10-17')
        p.click('#dRenovado')
        p.wait_for_selector('#ovDet:not(.is-open)', state='attached', timeout=3000)
        r = linha(p, 'k2')
        ok(r['validade'] == '2027-10-17' and r['cliente_id'] == 'c2' and r['avisado_em'] is None and r['acompanhar'] is True, f'renovado: validade nova, empresa ligada, aviso limpo ({r})')
        p.click('.fa-focus-card[data-f="emdia"]')
        ok('k2' in ids_na_lista(p) and 'EMPRESA EXEMPLO LTDA' in p.inner_text('.cd-card[data-id="k2"]'), 'foi pra "Em dia", com a empresa')

        print('4. Novo certificado')
        p.click('#btnNovo'); p.wait_for_selector('#ovNovo.is-open', timeout=3000)
        p.fill('#nTitular', 'LOJA NOVA')
        p.click('#nSalvar')
        ok(p.inner_text('#nErro') == 'Informe a validade.', 'sem a validade, não grava')
        p.fill('#nValidade', '2027-03-15'); p.select_option('#nTipo', 'A3')
        p.click('#nSalvar')
        p.wait_for_selector('#ovNovo:not(.is-open)', state='attached', timeout=3000)
        nova = p.evaluate("() => window.__mockDb.certificados_digitais.find(x => x.titular === 'LOJA NOVA')")
        p.click('.fa-focus-card[data-f="todos"]')
        ok(nova and nova['tipo'] == 'A3' and nova['validade'] == '2027-03-15' and 'LOJA NOVA' in p.inner_text('#lista'), 'com ela, grava e aparece na lista')

        print('5. O link do vigia e o Esc')
        p.goto(base + 'societario-certificados.html?c=k3')
        p.wait_for_selector('#ovDet.is-open', timeout=5000)
        ok(p.input_value('#dTitular') == 'EMPRESA EXEMPLO' and 'Avisado em 05/10/2026 por Deize' in p.inner_text('#dAvisoInfo'), 'o ?c= abre o certificado')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(not p.is_visible('#ovDet'), 'Esc fecha a janela')

        print('6. Texto de fora')
        p.click('.fa-focus-card[data-f="todos"]')
        ok(p.evaluate('() => window.__pego') is None and p.locator('#lista img').count() == 0 and '<img src=x' in p.inner_text('.cd-card[data-id="k6"]'),
           'o titular com <img onerror> aparece como texto')

        print('7. O card no Societário')
        p.goto(base + 'societario.html')
        p.wait_for_function("() => { const el = document.querySelector('.card-status[data-mod=\"societario-certificados.html\"]'); return el && el.textContent !== '·'; }", timeout=5000)
        badge = p.text_content('.card-status[data-mod="societario-certificados.html"]')  # o texto (o selo mostra em caixa alta)
        ok(badge == '2 a avisar', f'o card dos certificados: "2 a avisar" ({badge!r})')

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
