"""
Teste do vínculo desligado nas Obrigações (20/10/2026, caso da Pizzaria Arsenal no DEISS: o vínculo existia desligado,
não gerava tarefa, e o "+ Vincular cliente" dizia "já vinculado") — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/obrigacoes-religar.py

Com os dados inventados do supabase.mock.js (obrigação o1 mensal, vínculos v1/v2 ligados e v3 desligado — LOJA DE
TESTE LTDA) e, na ficha da empresa, um vínculo desligado da o3 pro c1, confere:
  1. tela Obrigações fiscais, "+ Vincular cliente" da o1: o desligado aparece "desligado · religar" (dá pra escolher); o
     ligado segue "já vinculado"; antes de escolher, sem o botão "Vincular";
  2. escolher o desligado: a escolha diz que vai religar, o botão vira "Religar" e vem a caixa "Criar já a tarefa de
     MM/AAAA" marcada, com a competência e o prazo;
  3. religar com Thalia: o mesmo vínculo volta a ligar com ela (sem repetir), a tarefa do mês nasce com ela e a linha
     deixa de aparecer desligada; abrindo de novo, ele é "já vinculado";
  4. vincular um cliente novo com a caixa desmarcada: o vínculo entra e nenhuma tarefa é criada;
  5. a ficha da empresa (Sugerir obrigações do regime): a desligada aparece sem marcar, "desligada, marque pra religar";
     marcada, volta a ligar com quem cuida, sem repetir o vínculo (antes a chave única derrubava o vincular inteiro).
Nos temas escuro e claro. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
MES = HOJE.strftime('%Y-%m')
# o banco de mentira: a o1 vence todo mês (como as do banco de verdade), a LOJA DE TESTE (c3) entra no cadastro, o c1
# vira PJ do Simples (a ficha só sugere obrigações pra PJ com regime) e ganha a o3 desligada
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const o1 = v.obrigacoes_fiscais.find(o => o.id === 'o1'); if (o1) o1.meses_vencimento = [1,2,3,4,5,6,7,8,9,10,11,12];
    if (!v.clientes.some(c => c.id === 'c3')) v.clientes.push({ id: 'c3', nome_principal: 'LOJA DE TESTE LTDA', documento: '22222222222222', status: 'ativo', tipo_pessoa: 'PJ' });
    const c1 = v.clientes.find(c => c.id === 'c1'); if (c1) Object.assign(c1, { tipo_pessoa: 'PJ', regime_tributario: 'Simples Nacional' });
    v.cliente_obrigacoes.push({ id: 'vx3', cliente_id: 'c1', obrigacao_id: 'o3', responsavel: null, dia_prazo_override: null, ativo: false, clientes: { nome_principal: 'COMÉRCIO MODELO ME' } });
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
            p.click('.obr-head[data-rid="o1"]'); p.wait_for_timeout(300)
            ok('inativo' in (p.get_attribute('.obr-cli[data-vid="v3"]', 'class') or ''), 'antes: o vínculo da LOJA DE TESTE (v3) está desligado')

            # 1. o "+ Vincular cliente" mostra o desligado pra religar
            p.click('[data-add-rid="o1"]'); p.wait_for_selector('#vincLista .vm-item', timeout=5000)
            loja = p.locator('#vincLista .vm-item', has_text='LOJA DE TESTE LTDA')
            emp = p.locator('#vincLista .vm-item', has_text='EMPRESA EXEMPLO LTDA')
            ok(loja.count() == 1 and 'desligado · religar' in loja.inner_text() and 'off' not in (loja.get_attribute('class') or ''), '1. o desligado aparece "desligado · religar", e dá pra escolher')
            ok('já vinculado' in emp.inner_text() and 'off' in (emp.get_attribute('class') or ''), '1. o ligado (v2) segue "já vinculado"')
            ok(not p.is_visible('#vincSalvar'), '1. antes de escolher, sem o botão "Vincular" (ele não fazia nada nesse passo)')

            # 2. a escolha diz que vai religar, com a caixa da tarefa do mês
            loja.click(); p.wait_for_selector('#vincTarefaWrap[style*="flex"]', timeout=5000)
            ok('estava desligado: vai ser religado' in p.inner_text('#vincEscolha') and p.inner_text('#vincSalvar') == 'Religar', '2. a escolha diz que vai religar; o botão é "Religar"')
            txt = p.inner_text('#vincTarefaTxt')
            ok(p.is_checked('#vincTarefa') and txt.startswith('Criar já a tarefa de ' + HOJE.strftime('%m/%Y') + ' (competência ') and 'prazo ' in txt,
               f'2. a caixa "Criar já a tarefa do mês" vem marcada, com a competência e o prazo ({txt!r})')

            # 3. religar com Thalia
            p.select_option('#vincResp', 'Thalia'); p.click('#vincSalvar'); p.wait_for_timeout(800)
            v3 = db("() => window.__mockDb.cliente_obrigacoes.find(v => v.id === 'v3')")
            ok(v3['ativo'] is True and v3['responsavel'] == 'Thalia', '3. o mesmo vínculo (v3) volta a ligar, com Thalia')
            ok(db("() => window.__mockDb.cliente_obrigacoes.filter(v => v.cliente_id === 'c3' && v.obrigacao_id === 'o1').length") == 1, '3. sem vínculo repetido')
            t = db("() => window.__mockDb.tarefas.filter(x => x.obrigacao_id === 'o1' && x.cliente_id === 'c3')")
            ok(len(t) == 1 and t[0]['responsavel'] == 'Thalia' and t[0]['competencia'] == MES and t[0]['status'] == 'pendente' and t[0]['origem'] == 'recorrente',
               f'3. a tarefa do mês nasce com Thalia ({[(x.get("competencia"), x.get("responsavel"), x.get("prazo")) for x in t]})')
            ok('inativo' not in (p.get_attribute('.obr-cli[data-vid="v3"]', 'class') or ''), '3. a linha deixa de aparecer desligada')
            ok(not dialogos, f'3. nenhum aviso de erro ({dialogos})')
            p.click('[data-add-rid="o1"]'); p.wait_for_selector('#vincLista .vm-item', timeout=5000)
            loja = p.locator('#vincLista .vm-item', has_text='LOJA DE TESTE LTDA')
            ok('já vinculado' in loja.inner_text() and 'off' in (loja.get_attribute('class') or ''), '3. abrindo de novo, ele é "já vinculado"')
            p.click('#vincVoltar'); p.wait_for_timeout(200)

            # 4. vincular um novo com a caixa desmarcada: o vínculo entra, sem tarefa
            p.click('.obr-head[data-rid="o2"]'); p.wait_for_timeout(300)
            p.click('[data-add-rid="o2"]'); p.wait_for_selector('#vincLista .vm-item', timeout=5000)
            p.click('#vincLista .vm-item[data-id="c3"]'); p.wait_for_timeout(500)
            ok(p.inner_text('#vincSalvar') == 'Vincular' and 'vai ser religado' not in p.inner_text('#vincEscolha'), '4. o cliente novo: "Vincular", sem o aviso de religar')
            tem_caixa = p.is_visible('#vincTarefaWrap')
            if tem_caixa: p.uncheck('#vincTarefa')
            n0 = db("() => window.__mockDb.tarefas.length")
            p.select_option('#vincResp', 'Adaini'); p.click('#vincSalvar'); p.wait_for_timeout(700)
            novo = db("() => window.__mockDb.cliente_obrigacoes.find(v => v.obrigacao_id === 'o2' && v.cliente_id === 'c3')")
            ok(bool(novo) and novo.get('ativo') and novo.get('responsavel') == 'Adaini' and db("() => window.__mockDb.tarefas.length") == n0,
               '4. o vínculo novo entra com Adaini, e nenhuma tarefa foi criada')

            # 5. a ficha da empresa: a obrigação desligada aparece sem marcar e, marcada, volta a ligar
            p.goto(base + 'clientes/editar.html?id=c1'); p.wait_for_selector('#btnObrigRegime', timeout=6000); p.wait_for_timeout(800)
            p.evaluate("() => { const s = document.getElementById('regime_tributario'); if (s) s.value = 'Simples Nacional'; }")
            p.click('#btnObrigRegime'); p.wait_for_selector('#voOverlay.is-open', timeout=5000)
            item = p.locator('#voLista .vo-item', has_text='PGDAS TESTE MENSAL')
            ok(item.count() == 1 and 'desligada, marque pra religar' in item.inner_text() and not item.locator('input').is_checked(),
               '5. a desligada (o3) aparece sem marcar, "desligada, marque pra religar"')
            for cx in p.locator('#voLista input:checked').all(): cx.uncheck()
            item.locator('input').check()
            p.select_option('#voResp', 'Thalia'); p.click('#voVincular'); p.wait_for_timeout(800)
            vx = db("() => window.__mockDb.cliente_obrigacoes.find(v => v.id === 'vx3')")
            msg = p.inner_text('#voMsg')
            ok(vx['ativo'] is True and vx['responsavel'] == 'Thalia' and db("() => window.__mockDb.cliente_obrigacoes.filter(v => v.cliente_id === 'c1' && v.obrigacao_id === 'o3').length") == 1,
               '5. marcada, volta a ligar com Thalia, sem repetir o vínculo')
            ok(msg.startswith('✓ 1 obrigação(ões) vinculada(s), 1 delas religada(s)'), f'5. a mensagem diz que religou ({msg!r})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
