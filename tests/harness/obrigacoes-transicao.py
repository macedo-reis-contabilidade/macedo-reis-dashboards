"""
Teste da empresa em transição nas Obrigações fiscais (18/11/2026, pedido do Samuel: a Esmero, em transição, não
aparecia no "+ Vincular cliente" do PGDAS — a lista só trazia as empresas com o status "ativo") — sem login e sem banco
(mesmo mock do conferir.py, com o filtro das empresas ligado: window.__mockFiltrarClientes).

    python tests/harness/obrigacoes-transicao.py

Com os dados inventados do supabase.mock.js (a o3, PGDAS TESTE MENSAL, vencendo todo mês) e três empresas a mais — a
LOJA DE TESTE (ativa), a TRANSICAO MODELO (em transição) e a ANTIGA ENCERRADA (inativa) —, confere:
  1. o "+ Vincular cliente" da o3 traz a empresa em transição, com a etiqueta "em transição", e a ativa, sem ela; a
     inativa fica de fora;
  2. escolher a em transição: "Vincular", com a caixa "Criar já a tarefa do mês" como na ativa;
  3. vincular com Thalia: o vínculo entra ligado, a tarefa do mês nasce com ela e a empresa aparece no cartão da o3.
Nos temas escuro e claro. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

SEMEAR = """
(() => {
  window.__mockFiltrarClientes = true;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const o3 = v.obrigacoes_fiscais.find(o => o.id === 'o3'); if (o3) o3.meses_vencimento = [1,2,3,4,5,6,7,8,9,10,11,12];
    v.clientes.push(
      { id: 'c3', nome_principal: 'LOJA DE TESTE LTDA', documento: '22222222222222', status: 'ativo', tipo_pessoa: 'PJ' },
      { id: 'c4', nome_principal: 'TRANSICAO MODELO LTDA', documento: '33333333333333', status: 'em_transicao', tipo_pessoa: 'PJ' },
      { id: 'c5', nome_principal: 'ANTIGA ENCERRADA LTDA', documento: '44444444444444', status: 'inativo', tipo_pessoa: 'PJ' });
  } });
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
        for tema in ('escuro', 'claro'):
            print(f'[{tema}]')
            p = b.new_page(viewport={'width': 1400, 'height': 900})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            dialogos = []
            p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.add_init_script(SEMEAR)
            db = lambda js: p.evaluate(js)
            p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_timeout(1500)
            p.click('#segFiltro button[data-f="todos"]'); p.wait_for_timeout(300)
            p.click('.obr-head[data-rid="o3"]'); p.wait_for_timeout(300)

            # 1. a lista do "+ Vincular cliente"
            p.click('[data-add-rid="o3"]'); p.wait_for_selector('#vincLista .vm-item', timeout=5000)
            trans = p.locator('#vincLista .vm-item', has_text='TRANSICAO MODELO LTDA')
            loja = p.locator('#vincLista .vm-item', has_text='LOJA DE TESTE LTDA')
            ok(trans.count() == 1 and 'em transição' in trans.inner_text() and 'off' not in (trans.get_attribute('class') or ''),
               '1. a empresa em transição aparece, com a etiqueta "em transição", e dá pra escolher')
            ok(loja.count() == 1 and 'em transição' not in loja.inner_text(), '1. a ativa aparece, sem a etiqueta')
            ok(p.locator('#vincLista .vm-item', has_text='ANTIGA ENCERRADA LTDA').count() == 0, '1. a inativa fica de fora')

            # 2. a escolha
            trans.click(); p.wait_for_timeout(500)
            ok(p.inner_text('#vincSalvar') == 'Vincular' and 'TRANSICAO MODELO LTDA' in p.inner_text('#vincEscolha'),
               '2. escolhida, "Vincular", com o nome dela na escolha')
            ok(p.is_visible('#vincTarefaWrap') and p.is_checked('#vincTarefa'), '2. a caixa "Criar já a tarefa do mês" vem marcada, como na ativa')

            # 3. vincular com Thalia
            p.select_option('#vincResp', 'Thalia'); p.click('#vincSalvar'); p.wait_for_timeout(800)
            v = db("() => window.__mockDb.cliente_obrigacoes.filter(x => x.cliente_id === 'c4' && x.obrigacao_id === 'o3')")
            ok(len(v) == 1 and v[0].get('ativo') is True and v[0].get('responsavel') == 'Thalia', '3. o vínculo da empresa em transição entra ligado, com Thalia')
            t = db("() => window.__mockDb.tarefas.filter(x => x.obrigacao_id === 'o3' && x.cliente_id === 'c4')")
            ok(len(t) == 1 and t[0].get('responsavel') == 'Thalia' and t[0].get('status') == 'pendente',
               f'3. a tarefa do mês nasce com Thalia ({[(x.get("competencia"), x.get("responsavel"), x.get("prazo")) for x in t]})')
            ok(p.locator('.obr-cli', has_text='TRANSICAO MODELO LTDA').count() >= 1, '3. a empresa aparece no cartão da obrigação')
            ok(not dialogos, f'3. nenhum aviso de erro ({dialogos})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
