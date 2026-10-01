"""
Teste do "hoje" no fuso de Brasília (assets/js/utils.js: hojeLocal / dataLocal) — sem login e sem banco
(mesmo mock do conferir.py, dados inventados).

    python tests/harness/data-local.py

O navegador roda em America/Sao_Paulo com o relógio parado em 30/09/2026 22:30 — hora em que o UTC já está em
01/10 e o antigo new Date().toISOString().slice(0, 10) devolvia o dia seguinte. Confere, em 6 telas, que o "hoje"
gravado ou comparado é 2026-09-30:
  1. Precificação (comercial-precificacao.html, aba Propostas): a transição criada pela proposta fechada grava
     inicio 2026-09-30 e previsao_fim 2026-12-29 (+90 dias); as tarefas do kit nascem com prazo hoje e hoje+5;
  2. Transição (comercial-transicao.html): "+ Nova transição" sem data de início grava inicio 2026-09-30,
     previsao_fim 2026-12-29 e o kit com os mesmos prazos;
  3. Agenda (agenda.html): a "+ Tarefa" (assets/js/nova-tarefa.js) abre com prazo 2026-09-30 e grava esse prazo;
  4. Carteira (comercial-carteira.html): "+ Adicionar à carteira" já vem com a entrada 2026-09-30;
  5. Hub do Fiscal (fiscal.html): o selo "N hoje" conta as tarefas que vencem em 2026-09-30;
  6. Relatórios do Fiscal (fiscal-relatorios.html, assets/js/relatorios-setor.js): a tarefa que vence hoje está
     "Pendente", e não "Atrasada".
O mock calcula as datas dele em UTC; por isso as tarefas e o kit usados aqui entram com data explícita.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

BRT = datetime.timezone(datetime.timedelta(hours=-3))
AGORA = datetime.datetime(2026, 9, 30, 22, 30, tzinfo=BRT)   # 01/10 01:30 em UTC
HOJE, AMANHA_UTC, MAIS90, MAIS5 = '2026-09-30', '2026-10-01', '2026-12-29', '2026-10-05'
TAREFA_HOJE = 'TESTE VENCE HOJE (DATA LOCAL)'

# Antes do script da página: tema escuro, sem tour, dados com data explícita e um registro do que for inserido
# (em sessionStorage, que sobrevive à navegação — a Precificação abre a transição criada logo depois de gravar).
INIT = """
localStorage.setItem('mr_tema', 'escuro');
(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })();
(() => {
  const DIA = '%s';
  const guardar = (tab, linhas) => { const k = '__ins_' + tab; const v = JSON.parse(sessionStorage.getItem(k) || '[]');
    v.push(...linhas.map(x => JSON.parse(JSON.stringify(x)))); sessionStorage.setItem(k, JSON.stringify(v)); };
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    db.tarefas.push(
      { id:'tl1', titulo:'%s', setor:'fiscal', responsavel:'Thalia', prazo:DIA, status:'pendente', prioridade:'media', cliente_id:null,
        obrigacao_id:null, clientes:{ nome_principal:'EMPRESA EXEMPLO LTDA', documento:'00000000000000' }, posicao:1, concluida_em:null, concluida_por:null },
      { id:'tl2', titulo:'TESTE VENCE HOJE 2 (DATA LOCAL)', setor:'fiscal', responsavel:'Thalia', prazo:DIA, status:'pendente', prioridade:'media', cliente_id:null,
        obrigacao_id:null, clientes:null, posicao:2, concluida_em:null, concluida_por:null });
    db.transicao_kit = [
      { id:'k1', tipo:'entrada', setor:'fiscal', titulo:'KIT TESTE NO DIA', prazo_dias:0, fase:null, responsavel_padrao:null, ativo:true, ordem:1 },
      { id:'k2', tipo:'entrada', setor:'dp', titulo:'KIT TESTE EM 5 DIAS', prazo_dias:5, fase:null, responsavel_padrao:null, ativo:true, ordem:2 },
    ];
    for (const tab of ['transicoes', 'tarefas', 'carteira_info']) {
      const arr = db[tab] || (db[tab] = []); const push = arr.push;
      arr.push = function (...a) { guardar(tab, a); return push.apply(this, a); };
    }
  } });
})();
""" % (HOJE, TAREFA_HOJE)

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, pagina, erros):
    ctx = b.new_context(timezone_id='America/Sao_Paulo', viewport={'width': 1400, 'height': 900})
    p = ctx.new_page()
    p.clock.set_fixed_time(AGORA)
    p.on('pageerror', lambda e: erros.append(f'{pagina}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script(INIT)
    p.goto(base + pagina); p.wait_for_timeout(1500)
    return ctx, p

def inseridos(p, tab):
    return json.loads(p.evaluate(f"() => sessionStorage.getItem('__ins_{tab}') || '[]'"))

def kit_ok(p, transicao_id, rotulo):
    prazos = sorted(t['prazo'] for t in inseridos(p, 'tarefas') if t.get('transicao_id') == transicao_id)
    ok(prazos == [HOJE, MAIS5], f'{rotulo}: tarefas do kit com prazo hoje e hoje+5 (achou {prazos})')

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('[relógio] 30/09/2026 22:30 em America/Sao_Paulo')
        ctx, p = abrir(b, base, 'agenda.html', erros)
        utc, local = p.evaluate("() => [new Date().toISOString().slice(0, 10), new Date().toLocaleDateString('pt-BR')]")
        ok(utc == AMANHA_UTC and local == '30/09/2026', f'0. o UTC já está em {utc} e o calendário local em {local} — é a hora do erro')

        print('[agenda.html] + Tarefa (nova-tarefa.js)')
        p.click('#btnNovaAv'); p.wait_for_timeout(600)
        ok(p.input_value('#ntPrazo') == HOJE, f'3. a tarefa nova abre com prazo {p.input_value("#ntPrazo")}')
        p.fill('#ntTitulo', 'TESTE PRAZO DE HOJE (DATA LOCAL)'); p.click('#ntSalvar'); p.wait_for_timeout(800)
        nova = [t for t in inseridos(p, 'tarefas') if t.get('titulo') == 'TESTE PRAZO DE HOJE (DATA LOCAL)']
        ok(len(nova) == 1 and nova[0].get('prazo') == HOJE, f'3. e grava prazo {nova[0].get("prazo") if nova else "—"}')
        ctx.close()

        print('[comercial-precificacao.html] proposta fechada -> transição')
        ctx, p = abrir(b, base, 'comercial-precificacao.html', erros)
        p.click('#prSeg button[data-v="props"]'); p.wait_for_timeout(700)
        p.locator('tr.prop[data-pid="pp2"] [data-trans]').click(); p.wait_for_timeout(500)
        p.click('#tpConfirmar'); p.wait_for_timeout(1200)
        tr = [t for t in inseridos(p, 'transicoes') if t.get('proposta_id') == 'pp2']
        ok(len(tr) == 1 and tr[0].get('inicio') == HOJE, f'1. transição gravada com inicio {tr[0].get("inicio") if tr else "—"}')
        ok(len(tr) == 1 and tr[0].get('previsao_fim') == MAIS90, f'1. e previsao_fim {tr[0].get("previsao_fim") if tr else "—"} (+90 dias)')
        if tr: kit_ok(p, tr[0]['id'], '1')
        ctx.close()

        print('[comercial-transicao.html] + Nova transição')
        ctx, p = abrir(b, base, 'comercial-transicao.html', erros)
        p.click('#btnNova'); p.wait_for_timeout(400)
        p.fill('#nvTitulo', 'TESTE DATA LOCAL LTDA'); p.click('#nvCriar'); p.wait_for_timeout(1200)
        tr = [t for t in inseridos(p, 'transicoes') if t.get('titulo') == 'TESTE DATA LOCAL LTDA']
        ok(len(tr) == 1 and tr[0].get('inicio') == HOJE, f'2. sem data de início, grava inicio {tr[0].get("inicio") if tr else "—"}')
        ok(len(tr) == 1 and tr[0].get('previsao_fim') == MAIS90, f'2. e previsao_fim {tr[0].get("previsao_fim") if tr else "—"}')
        if tr: kit_ok(p, tr[0]['id'], '2')
        ctx.close()

        print('[comercial-carteira.html] + Adicionar à carteira')
        ctx, p = abrir(b, base, 'comercial-carteira.html', erros)
        p.click('#btnAdd'); p.wait_for_timeout(400)
        ok(p.input_value('#addEntrada') == HOJE, f'4. a entrada na carteira já vem {p.input_value("#addEntrada")}')
        ctx.close()

        print('[fiscal.html] selo "vence hoje" do card Tarefas')
        ctx, p = abrir(b, base, 'fiscal.html', erros)
        esperado = p.evaluate(f"() => window.__mockDb.tarefas.filter(t => t.setor === 'fiscal' && t.prazo === '{HOJE}' && t.status !== 'concluida' && t.obrigacao_id == null).length")
        do_utc = p.evaluate(f"() => window.__mockDb.tarefas.filter(t => t.setor === 'fiscal' && t.prazo === '{AMANHA_UTC}' && t.status !== 'concluida' && t.obrigacao_id == null).length")
        selo = p.locator('a[href="fiscal-tarefas.html"] .badge-hoje')
        texto = selo.inner_text().strip().lower() if selo.count() else '(sem selo)'
        ok(esperado != do_utc, f'5. (o banco falso tem {esperado} vencendo em 30/09 e {do_utc} em 01/10 — dá pra distinguir)')
        ok(texto == f'{esperado} hoje', f'5. o selo diz "{texto}" — as {esperado} que vencem em 30/09')
        ctx.close()

        print('[fiscal-relatorios.html] situação da tarefa que vence hoje')
        ctx, p = abrir(b, base, 'fiscal-relatorios.html', erros)
        linha = p.locator('#tbody tr', has_text=TAREFA_HOJE)
        sit = linha.locator('.sit').first.inner_text().strip() if linha.count() and linha.locator('.sit').count() else linha.inner_text() if linha.count() else '(não achei a linha)'
        ok('Pendente' in sit and 'Atrasada' not in sit, f'6. a tarefa de 30/09 aparece como "{sit}"')
        p.screenshot(path=str(FOTOS / 'data-local-relatorio.png'))
        ctx.close()

        b.close()
    srv.shutdown()
    print('\nErros de JavaScript:', 'nenhum' if not erros else '')
    for e in erros: print('  ', e)
    print('Resultado:', 'TUDO OK' if not falhas and not erros else f'{falhas} falha(s)' + (' e erros de JavaScript' if erros else ''))
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
