"""
Teste de quem saiu da equipe (05/11/2026, pedido do Samuel: "inativar o usuário da Deize no sistema, pra não aparecer
mais ela como opção de vincular rotinas") — sem login e sem banco (o mock do conferir.py), com dados inventados: uma
tarefa fiscal já concluída com a responsável "Deize" e um vínculo de obrigação, desligado, com ela.

    python tests/harness/quem-saiu.py

Confere:
  1. as tarefas do Fiscal: o filtro "Todos os responsáveis", montado com os nomes gravados nas tarefas, não traz quem saiu
     (a tarefa concluída dela segue na lista, com o nome); os campos de texto do responsável (nova tarefa, recorrente,
     rotina e a tarefa aberta) sugerem só a equipe de hoje e "Ambos", sem o autocomplete do navegador (que lembrava dela);
  2. Obrigações fiscais: no "+ Vincular cliente" (e no religar do vínculo desligado que era dela), na lista de quem cuida
     e nas sugestões do "Renomear em lote", ela não aparece; religar não vem com ela escolhida;
  3. as Tarefas recorrentes do Fiscal: "+ Vincular empresas" lista só a equipe.
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
    v.tarefas.push({ id: 't-deize', titulo: 'Emitir NFS-e (teste)', setor: 'fiscal', responsavel: 'Deize', prazo: '2026-10-30', status: 'concluida',
      prioridade: 'media', cliente_id: null, proposta_id: null, hora: null, concluida_em: '2026-10-30T15:00:00Z', concluida_por: 'atendimento@macedoereis.com.br' });
    if (!v.clientes.some(c => c.id === 'c3')) v.clientes.push({ id: 'c3', nome_principal: 'LOJA DE TESTE LTDA', documento: '22222222222222', status: 'ativo', tipo_pessoa: 'PJ' });
    const v3 = v.cliente_obrigacoes.find(x => x.id === 'v3');
    if (v3) Object.assign(v3, { responsavel: 'Deize', ativo: false });
  } });
})();
"""
EQUIPE = ['Thalia', 'Vitória', 'Adaini', 'Samuel', 'Diego', 'Edna']

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
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.on('dialog', lambda d: d.accept())
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)

        print('1. As tarefas do Fiscal')
        p.goto(base + 'fiscal-tarefas.html'); p.wait_for_timeout(1500)
        opcoes = p.evaluate("() => [...document.querySelectorAll('#filterResp option')].map(o => o.value).filter(Boolean)")
        ok('Deize' not in opcoes and 'Thalia' in opcoes, f'o filtro de responsáveis não traz quem saiu ({opcoes})')
        p.select_option('#filterStatus', 'concluida'); p.click('.fa-focus-card[data-periodo="todas"]'); p.wait_for_timeout(300)
        ok('Emitir NFS-e (teste)' in p.inner_text('#grupos'), 'a tarefa concluída dela segue na lista')
        campos = p.evaluate("""() => ['fResponsavel', 'qResp', 'rResp', 'dResp'].map(id => { const e = document.getElementById(id);
          return e ? [id, e.tagName, e.getAttribute('list'), e.getAttribute('autocomplete')] : [id, null]; })""")
        ok(all(c[1] == 'INPUT' and c[2] == 'teRespLista' and c[3] == 'off' for c in campos), f'os campos do responsável sugerem a lista da equipe, sem o autocomplete do navegador ({campos})')
        sugestoes = p.evaluate("() => [...document.querySelectorAll('#teRespLista option')].map(o => o.value)")
        ok(sugestoes == EQUIPE + ['Ambos'], f'as sugestões: a equipe de hoje e "Ambos" ({sugestoes})')

        print('2. Obrigações fiscais')
        p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_timeout(1500)
        lista = p.evaluate("() => [...document.querySelectorAll('#respList option')].map(o => o.value)")
        ok('Deize' not in lista, f'as sugestões do "Renomear em lote" não trazem quem saiu ({lista})')
        ok(p.get_attribute('#renPara', 'autocomplete') == 'off' and p.get_attribute('#utResp', 'autocomplete') == 'off', 'sem o autocomplete do navegador nos campos com a lista')
        p.click('#segFiltro button[data-f="todos"]'); p.wait_for_timeout(300)
        p.click('.obr-head[data-rid="o1"]'); p.wait_for_timeout(300)
        p.click('[data-add-rid="o1"]'); p.wait_for_selector('#vincLista .vm-item', timeout=5000)
        p.locator('#vincLista .vm-item', has_text='LOJA DE TESTE LTDA').click(); p.wait_for_timeout(300)
        quem = p.evaluate("() => [...document.querySelectorAll('#vincResp option')].map(o => o.value).filter(Boolean)")
        ok('Deize' not in quem and quem[:6] == ['Thalia', 'Adaini', 'Vitória', 'Samuel', 'Diego', 'Edna'], f'religar o vínculo que era dela: quem cuida, sem ela ({quem})')
        ok(p.input_value('#vincResp') == '', 'e não vem com ela escolhida: falta dizer quem assume')

        print('3. As Tarefas recorrentes do Fiscal')
        p.goto(base + 'fiscal-regras.html'); p.wait_for_timeout(1500)
        resp = p.evaluate("() => [...document.querySelectorAll('#ovResp option')].map(o => o.value).filter(Boolean)")
        ok(resp and 'Deize' not in resp, f'"+ Vincular empresas" lista só a equipe ({resp})')
        p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + ' | '.join(erros[:3]) if erros else ''))
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
