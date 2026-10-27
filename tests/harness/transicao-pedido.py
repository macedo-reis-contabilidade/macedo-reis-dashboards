"""
Pedir documentos ao cliente na transição (21/10/2026, pedido do Samuel) — sem login e sem banco (o mock do conferir.py,
com uma transição de CNPJ novo semeada só neste teste; a de entrada é a do mock). O relógio da tela fica parado em
21/10/2026 (quarta), o dia do pedido da Ind Perin.

    python tests/harness/transicao-pedido.py

Confere:
  1. a transição de entrada tem o "📨 Pedir documentos"; a janela abre com as datas padrão (fiscal e DP 23/10, contábil
     30/10, demais 23/11 — 20/11 é feriado), o dia da semana de cada uma e a mensagem padrão com elas;
  2. mudar uma data troca o dia da semana (com o aviso de feriado) e a mensagem;
  3. "Copiar mensagem" põe o texto na área de transferência e diz "Mensagem copiada." (a área de transferência do
     navegador é trocada por uma de mentira: a de verdade, no Windows, é a do PC inteiro, e o teste falhava nos PCs dos
     pedreiros quando outro programa mexia nela — 27/10/2026);
  4. o "Baixar o card (PDF)" aponta pro PDF, com o nome do download, e o PDF responde no servidor;
  5. Esc fecha a janela;
  6. a transição de CNPJ novo não tem o botão;
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.transicoes.push({ id: 'txn', titulo: 'ABERTURA TESTE LTDA', tipo: 'cnpj_novo', proposta_id: null, padrinho: null, inicio: '2026-10-15', previsao_fim: '2027-01-13',
      tera_funcionarios: null, contato: null, observacao: null, status: 'em_andamento', concluida_em: null, criado_em: '2026-10-15T12:00:00Z', transicao_empresas: [] });
  } });
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
# a área de transferência de mentira: guarda o que a tela copiou (a do Windows é a do PC inteiro)
COPIA = """
(() => {
  const area = { writeText: async t => { window.__copiado = String(t); }, readText: async () => window.__copiado ?? '' };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => area });
})();
"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(COPIA)
        p.clock.set_fixed_time('2026-10-21T12:00:00')

        print('1. A transição de entrada')
        p.goto(base + 'comercial-transicao.html?transicao=tx1')
        p.wait_for_selector('#painelDetalhe #detTitulo:not(:empty)', timeout=8000)
        ok(p.is_visible('#btnPedirDocs') and p.inner_text('#btnPedirDocs') == '📨 Pedir documentos', 'o botão "📨 Pedir documentos" na transição de entrada')
        p.click('#btnPedirDocs'); p.wait_for_selector('#ovPedido.aberto', timeout=3000)
        datas = [p.input_value(s) for s in ('#pdUrgente', '#pdContabil', '#pdDemais')]
        ok(datas == ['2026-10-23', '2026-10-30', '2026-11-23'], f'as datas padrão de um pedido em 21/10: 23/10, 30/10 e 23/11 (20/11 é feriado) ({datas})')
        dias = [p.inner_text(s) for s in ('#pdUrgenteDia', '#pdContabilDia', '#pdDemaisDia')]
        ok(dias == ['sexta-feira', 'sexta-feira', 'segunda-feira'], f'o dia da semana embaixo de cada data ({dias})')
        msg = p.input_value('#pdMensagem')
        ok(msg.startswith('OBS.: Os documentos solicitados abaixo possuem caráter de maior urgência')
           and 'Setor Fiscal - Enviar até dia 23/10/2026.' in msg and 'DP - Enviar até dia 23/10/2026.' in msg
           and 'Setor Contábil - Enviar até dia 30/10/2026.' in msg and 'encaminhados até 23/11/2026.' in msg
           and msg.endswith('Qualquer dúvida, ficamos à disposição.'), 'a mensagem padrão com as três datas')
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'pdCopiar', 'o foco no "Copiar mensagem"')

        print('2. Mudar uma data')
        p.fill('#pdDemais', '2026-11-20'); p.wait_for_timeout(150)
        dia = p.inner_text('#pdDemaisDia')
        ok(dia == 'sexta-feira · ⚠ feriado: Dia da Consciência Negra' and 'encaminhados até 20/11/2026.' in p.input_value('#pdMensagem'),
           f'a data no feriado: o aviso embaixo e a mensagem com a data nova ({dia!r})')
        p.fill('#pdUrgente', '2026-10-24'); p.wait_for_timeout(150)
        ok(p.inner_text('#pdUrgenteDia') == '⚠ sábado, fim de semana' and p.input_value('#pdMensagem').count('Enviar até dia 24/10/2026.') == 2,
           'o urgente num sábado: o aviso e as duas linhas (fiscal e DP) com a data nova')

        print('3. Copiar')
        p.click('#pdCopiar'); p.wait_for_timeout(200)
        copiado = p.evaluate('() => window.__copiado')
        ok(copiado == p.input_value('#pdMensagem') and 'encaminhados até 20/11/2026.' in copiado, 'a mensagem foi pra área de transferência, como está na caixa')
        ok(p.inner_text('#pdRetorno') == 'Mensagem copiada.' and p.get_attribute('#pdRetorno', 'aria-live') == 'polite', 'o retorno "Mensagem copiada." (lido pelo leitor de tela)')

        print('4. O card (PDF)')
        href, nome = p.get_attribute('#pdPdf', 'href'), p.get_attribute('#pdPdf', 'download')
        r = p.request.get(base + href)
        ok(href == 'assets/transicao/documentos-solicitados.pdf' and nome == 'Documentos solicitados - Macedo & Reis.pdf', f'o link do card e o nome do download ({href}, {nome})')
        ok(r.status == 200 and r.body()[:5] == b'%PDF-', f'o PDF responde ({r.status})')

        print('5. Esc fecha')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(p.evaluate("() => !document.getElementById('ovPedido').classList.contains('aberto')"), 'Esc fecha a janela')

        print('6. A transição de CNPJ novo')
        p.goto(base + 'comercial-transicao.html?transicao=txn')
        p.wait_for_function("() => document.getElementById('detTitulo').textContent === 'ABERTURA TESTE LTDA'", timeout=8000)
        ok(not p.is_visible('#btnPedirDocs') and p.is_visible('#btnEditar'), 'no CNPJ novo, sem o "Pedir documentos"')

        ok(not erros, f'sem erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
