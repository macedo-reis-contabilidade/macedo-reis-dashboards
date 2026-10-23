"""
A Receita na ficha da empresa (23/10/2026) — sem login e sem banco (o mock do conferir.py, com os dados da ponte semeados
só neste teste; empresas e mensagens inventadas).

    python tests/harness/receita-ficha.py

Confere:
  1. a empresa que a ponte já consultou: a seção "Receita" aparece com a autorização, a situação fiscal, o PGDAS dos
     meses (transmitido, DAS pago ou não), o faturamento da declaração e a Caixa Postal;
  2. o que vem de fora entra como texto (o assunto com <img onerror> não vira imagem nem roda código);
  3. a empresa que a ponte ainda não consultou: sem a seção;
e nenhum erro de JavaScript. Tira a foto da seção em .harness/receita-ficha.png, pra conferir o visual.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, SITE

DADOS = {
    'receita_empresas': [{'cliente_id': 'c1', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-03-31', 'autorizacao_em': '2026-10-21T12:00:00Z',
                          'pgdas_em': '2026-10-21T12:00:00Z', 'situacao_fiscal_em': '2026-10-05',
                          'pendencias': [{'orgao': 'Receita', 'titulo': 'Pendência - Débito (SIEF)'}, {'orgao': 'PGFN', 'titulo': 'Inscrição em Dívida Ativa'}]}],
    'receita_pgdas': [
        {'cliente_id': 'c1', 'competencia': '2026-09', 'transmitida_em': '2026-10-18T13:02:00Z', 'das_pago': False, 'receita_mes': 84211.5, 'receita_12_meses': 912000},
        {'cliente_id': 'c1', 'competencia': '2026-08', 'transmitida_em': '2026-09-15T13:00:00Z', 'das_pago': True, 'receita_mes': None, 'receita_12_meses': None}],
    'receita_mensagens': [
        {'cliente_id': 'c1', 'assunto': 'Termo de Exclusão do Simples Nacional', 'enviada_em': '2026-10-20', 'origem': 'Estado', 'lida': False, 'recebida_em': '2026-10-21T12:00:00Z'},
        {'cliente_id': 'c1', 'assunto': '<img src=x onerror="window.__xss=1">', 'enviada_em': '2026-10-19', 'origem': 'Receita', 'lida': True, 'recebida_em': '2026-10-20T12:00:00Z'}],
}
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const extra = %s;
    Object.keys(extra).forEach(k => { v[k] = (v[k] || []).concat(extra[k]); });
    (v.clientes || []).forEach(c => { c.tipo_pessoa = 'PJ'; c.regime_tributario = c.regime_tributario || 'Simples Nacional'; });
  } });
})();
""" % json.dumps(DADOS)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

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
        cx = b.new_context(viewport={'width': 1400, 'height': 1000}, timezone_id='America/Sao_Paulo')
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)

        print('1. A empresa que a ponte já consultou')
        p.goto(base + 'clientes/editar.html?id=c1')
        p.wait_for_selector('#sectionReceita:not([hidden])', timeout=8000)
        t = p.inner_text('#receitaConteudo')
        ok('O escritório tem a autorização de acesso até 31/03/2027.' in t, 'a autorização do escritório, com a data')
        ok('2 pendências (relatório de 05/10/2026)' in t and 'Receita, Pendência - Débito (SIEF)' in t and 'PGFN, Inscrição em Dívida Ativa' in t, 'a situação fiscal: as pendências, com o órgão e o dia do relatório')
        ok('09/2026: transmitido em 18/10/2026 · DAS não pago' in t and '08/2026: transmitido em 15/09/2026 · DAS pago' in t, 'o PGDAS de cada mês, o mais recente primeiro')
        ok('Receita bruta de 09/2026: R$ 84.211,50 · nos 12 meses anteriores: R$ 912.000,00' in t, 'o faturamento da declaração, em reais')
        ok('20/10/2026 · Termo de Exclusão do Simples Nacional (Estado) · não lida' in t, 'a Caixa Postal: a data, o assunto, de onde veio e se foi lida')
        ok('Só consulta: nada é transmitido.' in t and 'a última vez em 21/10/2026' in t, 'o rodapé: de onde veio e quando')
        p.locator('#sectionReceita').screenshot(path=str(SITE.parent / 'receita-ficha.png'))

        print('2. O que vem de fora entra como texto')
        ok(p.locator('#receitaConteudo img').count() == 0 and '<img src=x onerror=' in t, 'o assunto com <img onerror> aparece como texto')
        ok(p.evaluate('() => window.__xss === undefined'), 'e não roda código')

        print('3. A empresa que a ponte ainda não consultou')
        p.goto(base + 'clientes/editar.html?id=c2')
        p.wait_for_function("() => document.getElementById('sectionPJ') && !document.getElementById('sectionPJ').hidden", timeout=8000)
        p.wait_for_timeout(600)
        ok(p.is_hidden('#sectionReceita'), 'sem a seção da Receita')

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
