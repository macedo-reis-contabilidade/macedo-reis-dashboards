"""
Teste do "Mudar o prazo do mês" nas Obrigações fiscais (20/10/2026, pedido da Thalia: "alterar a data de uma rotina de um
determinado mês, sem precisar alterar uma a uma") — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/obrigacoes-prazo-mes.py

Com os dados inventados do supabase.mock.js e, semeadas aqui, três tarefas da obrigação o1 no mês da tela (duas abertas,
de COMÉRCIO MODELO e EMPRESA EXEMPLO, e uma concluída), confere:
  1. o cartão da o1 tem o "📅 Mudar o prazo de MM/AAAA"; o da o2 (que não vence no mês) não tem;
  2. a janela: quantas abertas, o prazo de hoje e a concluída que fica; as abertas marcadas; o botão diz quantas;
  3. a data no fim de semana avisa; o dia útil mostra o dia da semana; desmarcar uma, o botão acompanha;
  4. mudar: as abertas ganham o prazo novo, com a linha no histórico; a concluída e o dia dos vínculos ficam;
  5. "Desfazer": voltam ao prazo de antes, com a linha no histórico; Esc fecha a janela.
Nos temas escuro e claro. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
MES = HOJE.strftime('%Y-%m')
PRAZO = MES + '-10'
# o prazo novo: um dia útil do fim do mês; e um sábado do mês, pro aviso
_d = HOJE.replace(day=25)
while _d.weekday() >= 5: _d -= datetime.timedelta(days=1)
NOVO = _d.isoformat()
_s = HOJE.replace(day=1)
while _s.weekday() != 5: _s += datetime.timedelta(days=1)
SABADO = _s.isoformat()
BR = lambda iso: '/'.join(reversed(iso.split('-')))
SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
def tarefa(i, cli, nome, status='pendente'):
    return {'id': i, 'titulo': 'EFD TESTE MENSAL', 'setor': 'fiscal', 'cliente_id': cli, 'clientes': {'nome_principal': nome}, 'responsavel': 'Thalia',
            'prazo': PRAZO, 'status': status, 'prioridade': 'media', 'origem': 'recorrente', 'obrigacao_id': 'o1', 'competencia': MES,
            'competencia_fiscal': BR(MES + '-01')[3:], 'descricao': None, 'hora': None, 'posicao': 0, 'concluida_em': None, 'concluida_por': None}
TAREFAS = [tarefa('tp1', 'c1', 'COMÉRCIO MODELO ME'), tarefa('tp2', 'c2', 'EMPRESA EXEMPLO LTDA'), tarefa('tp3', 'c3', 'LOJA DE TESTE LTDA', 'concluida')]
SEMEAR = """
(() => {
  const TAREFAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const o1 = v.obrigacoes_fiscais.find(o => o.id === 'o1'); if (o1) o1.meses_vencimento = [1,2,3,4,5,6,7,8,9,10,11,12];
    v.tarefas.push(...TAREFAS);
  } });
})();
""" % json.dumps(TAREFAS, ensure_ascii=False)

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
            tarefa_ = lambda i: p.evaluate('id => window.__mockDb.tarefas.find(t => t.id === id)', i)
            hist = lambda i: p.evaluate('id => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === id).map(h => h.descricao)', i)
            p.goto(base + 'fiscal-obrigacoes.html'); p.wait_for_timeout(1500)

            # 1. o botão no cartão da obrigação que vence no mês
            p.click('.obr-head[data-rid="o1"]'); p.click('.obr-head[data-rid="o2"]'); p.wait_for_timeout(300)
            bt = p.locator('[data-prazo-rid="o1"]')
            ok(bt.count() == 1 and bt.inner_text() == '📅 Mudar o prazo de ' + HOJE.strftime('%m/%Y'), '1. o cartão da o1 tem o "📅 Mudar o prazo de ' + HOJE.strftime('%m/%Y') + '"')
            ok(p.locator('[data-prazo-rid="o2"]').count() == 0, '1. o da o2 (não vence no mês) não tem')

            # 2. a janela
            bt.click(); p.wait_for_selector('#przLista', timeout=5000)
            corpo = p.inner_text('#przCorpo')
            ok(p.inner_text('#przTitulo') == 'Prazo de ' + HOJE.strftime('%m/%Y') + ' — EFD TESTE MENSAL'
               and '2 tarefas abertas · prazo de hoje: ' + BR(PRAZO) + ' · 1 concluída fica como está' in corpo, f'2. o título, quantas abertas, o prazo de hoje e a concluída que fica ({corpo[:120]!r})')
            ok(p.eval_on_selector_all('#przLista input', 'cs => cs.map(c => c.checked)') == [True, True] and 'COMÉRCIO MODELO ME' in corpo and 'LOJA DE TESTE' not in corpo,
               '2. as duas abertas na lista, marcadas (a concluída fora)')
            ok(p.inner_text('#przAplicar') == 'Mudar 2 prazos' and p.input_value('#przData') == PRAZO, '2. o botão diz quantas; a data começa no prazo de hoje')

            # 3. fim de semana avisa; desmarcar acompanha
            p.fill('#przData', SABADO)
            ok('cai no fim de semana' in p.inner_text('#przDia'), '3. a data num sábado avisa ("cai no fim de semana")')
            p.fill('#przData', NOVO)
            dia = p.inner_text('#przDia')
            ok(dia == SEMANA[_d.weekday()] + ', ' + BR(NOVO), f'3. o dia útil mostra o dia da semana ({dia!r})')
            p.locator('#przLista input').nth(1).uncheck()
            ok(p.inner_text('#przAplicar') == 'Mudar 1 prazo', '3. desmarcar uma: o botão acompanha')
            p.locator('#przLista input').nth(1).check()

            # 4. mudar
            p.click('#przAplicar'); p.wait_for_selector('#przDesfazer', timeout=5000)
            t1, t2, t3 = tarefa_('tp1'), tarefa_('tp2'), tarefa_('tp3')
            ok(t1['prazo'] == NOVO and t2['prazo'] == NOVO and t3['prazo'] == PRAZO, '4. as abertas ganham o prazo novo; a concluída fica')
            esperado = 'Prazo alterado de ' + BR(PRAZO) + ' para ' + BR(NOVO) + ' — pelo módulo Obrigações (prazo do mês).'
            ok(hist('tp1') == [esperado] and hist('tp2') == [esperado] and hist('tp3') == [], f'4. a linha no histórico de cada uma ({hist("tp1")})')
            ok(p.inner_text('#przCorpo').startswith('✓ 2 prazos mudados pra ' + SEMANA[_d.weekday()] + ', ' + BR(NOVO) + '.') and p.inner_text('#przFechar') == 'Fechar'
               and not p.is_visible('#przAplicar'), '4. a janela diz o que fez, com "Desfazer" e "Fechar"')
            vs = p.evaluate("() => window.__mockDb.cliente_obrigacoes.filter(v => v.obrigacao_id === 'o1').map(v => v.dia_prazo_override)")
            ok(all(x is None for x in vs), '4. o dia dos vínculos não muda (só o mês)')

            # 5. desfazer; Esc fecha
            p.click('#przDesfazer'); p.wait_for_function("() => document.getElementById('przCorpo').innerText.startsWith('↺')", timeout=5000)
            ok(tarefa_('tp1')['prazo'] == PRAZO and tarefa_('tp2')['prazo'] == PRAZO and p.inner_text('#przCorpo').startswith('↺ Desfeito: 2 voltaram pro prazo de antes.'),
               '5. "Desfazer": as duas voltam ao prazo de antes')
            ok(hist('tp1')[-1] == 'Prazo alterado de ' + BR(NOVO) + ' para ' + BR(PRAZO) + ' — alteração desfeita no módulo Obrigações (prazo do mês).', f'5. com a linha no histórico ({hist("tp1")[-1:]})')
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
            ok(not p.locator('#przOverlay').evaluate('el => el.classList.contains("is-open")'), '5. Esc fecha a janela')
            ok(not dialogos, f'nenhum aviso de erro ({dialogos})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
