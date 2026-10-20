"""
Teste do "Mudar o prazo de várias de uma vez" na Agenda (20/10/2026, pedido da Thalia: as SEDIF/DESTDA de hoje pro dia
23 sem abrir uma a uma) — sem login e sem banco (mesmo mock do conferir.py), entrando como a Thalia.

    python tests/harness/agenda-prazo-lote.py

Semeadas aqui, com prazo hoje: três "SEDIF TESTE" abertas da Thalia (uma em andamento), uma concluída, uma da Vitória
e uma tarefa de admissão da Thalia. Confere:
  1. lote em "Vencem hoje": o "📅 Mudar prazo" fica apagado sem nada marcado; marcadas as 3 SEDIF e a da admissão, a
     janela diz os títulos, o prazo atual e de quem, lista as 4 marcadas e começa no prazo de hoje (nada a mudar: o botão
     apagado, "4 já estão nesse dia");
  2. sábado e feriado avisam; o dia útil mostra o dia da semana; desmarcar uma e "Desmarcar todas" mexem no botão;
  3. mudar com observação: as 3 SEDIF ganham o prazo novo e a linha no histórico (com a observação); a da admissão
     fica de fora e a janela diz onde mudar; a lista se refaz e a seleção some;
  4. "Desfazer": voltam pro prazo de antes, com a linha no histórico; Esc fecha a janela;
  5. editor da tarefa (visão Dia): a SEDIF mostra "Mudar o prazo das 3 iguais a esta" (com o filtro da Thalia; sem
     filtro, 4 — a da Vitória entra); a tarefa sem iguais não mostra; a data escolhida no editor vem pra janela; mudar
     acompanha o campo do editor, e o "Salvar alterações" depois não volta o prazo;
  6. a busca também tem o "📅 Mudar prazo", e a janela com vários títulos diz o título em cada linha.
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
H = HOJE.isoformat()
BR = lambda iso: '/'.join(reversed(iso.split('-')))
SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
dia_sem = lambda iso: SEMANA[datetime.date.fromisoformat(iso).weekday()] + ', ' + BR(iso)
_s = HOJE + datetime.timedelta(days=1)
while _s.weekday() != 5: _s += datetime.timedelta(days=1)
SABADO = _s.isoformat()

def tarefa(i, titulo, nome, resp, status='pendente', **extra):
    t = {'id': i, 'titulo': titulo, 'setor': 'fiscal', 'cliente_id': 'c-' + i, 'clientes': {'nome_principal': nome, 'documento': '00000000000000'},
         'responsavel': resp, 'prazo': H, 'status': status, 'prioridade': 'media', 'origem': 'recorrente', 'obrigacao_id': 'o9',
         'competencia': H[:7], 'descricao': None, 'hora': None, 'posicao': 0, 'proposta_id': None, 'transicao_id': None,
         'concluida_em': None, 'concluida_por': None}
    t.update(extra)
    return t
TAREFAS = [
    tarefa('s1', 'SEDIF TESTE', 'COMÉRCIO MODELO ME', 'Thalia'),
    tarefa('s2', 'SEDIF TESTE', 'EMPRESA EXEMPLO LTDA', 'Thalia'),
    tarefa('s3', 'SEDIF TESTE', 'LOJA DE TESTE LTDA', 'Thalia', 'em_andamento'),
    tarefa('s4', 'SEDIF TESTE', 'AGRO FICTÍCIA LTDA', 'Thalia', 'concluida'),
    tarefa('s5', 'SEDIF TESTE', 'OUTRA EMPRESA LTDA', 'Vitória'),
    tarefa('a1', 'Registrar admissão — Fulano', 'COMÉRCIO MODELO ME', 'Thalia', setor='dp', origem='externa', obrigacao_id=None, admissao_id='adm1'),
]
SEMEAR = """
(() => {
  window.__mockEmail = 'fiscal@macedoereis.com.br';
  const TAREFAS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) { db = v; v.tarefas.push(...TAREFAS); } });
})();
""" % json.dumps(TAREFAS, ensure_ascii=False)
# dias úteis sem feriado (a mesma lista da tela, rescisao-datas.js) e um feriado em dia de semana, contados na página
DATAS = """async () => {
  const { feriado } = await import('./assets/js/rescisao-datas.js');
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const uteis = [], hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  let fer = null;
  for (let k = 3; k < 400 && (uteis.length < 2 || !fer); k++) {
    const x = new Date(hoje); x.setDate(hoje.getDate() + k);
    const s = iso(x), semana = x.getDay() !== 0 && x.getDay() !== 6;
    if (semana && !feriado(s) && uteis.length < 2) uteis.push(s);
    if (semana && feriado(s) && !fer) fer = [s, feriado(s)];
  }
  return { uteis, fer };
}"""

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
            p = b.new_page(viewport={'width': 1400, 'height': 950})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            dialogos = []
            p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.add_init_script(SEMEAR)
            tarefa_ = lambda i: p.evaluate('id => window.__mockDb.tarefas.find(t => t.id === id)', i)
            hist = lambda i: p.evaluate('id => window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === id).map(h => h.descricao)', i)
            aberta = lambda: p.evaluate("() => document.getElementById('lpOverlay').classList.contains('is-open')")
            p.goto(base + 'agenda.html'); p.wait_for_timeout(1500)
            datas = p.evaluate(DATAS)
            NOVO, NOVO2 = datas['uteis']
            FER, FER_NOME = datas['fer']
            ok(p.input_value('#fResp') == 'Thalia', 'antes: entrou como a Thalia, com o filtro dela')

            # 1. o lote em "Vencem hoje"
            p.click('.fa-focus-card[data-foco="hoje"]'); p.wait_for_selector('#agLotePrazo', timeout=5000)
            bt = p.locator('#agLotePrazo')
            ok(bt.inner_text() == '📅 Mudar prazo' and bt.is_disabled(), '1. o "📅 Mudar prazo" está na barra do lote, apagado sem nada marcado')
            for i in ('s1', 's2', 's3', 'a1'): p.check(f'.ag-lote-ck[data-lote="{i}"]')
            ok(not bt.is_disabled() and not p.evaluate("() => document.getElementById('detOverlay').classList.contains('is-open')"), '1. marcadas 4: o botão acende (marcar não abre o editor)')
            bt.click(); p.wait_for_selector('#lpOverlay.is-open', timeout=5000)
            corpo = p.inner_text('#lpCorpo')
            ok(p.inner_text('#lpTitulo') == 'Mudar o prazo de 4 tarefas' and 'SEDIF TESTE (3), Registrar admissão — Fulano (1)' in corpo
               and f'prazo atual: {BR(H)} · de Thalia' in corpo, f'1. a janela diz os títulos, o prazo atual e de quem ({corpo[:160]!r})')
            ok(p.eval_on_selector_all('#lpLista input', 'cs => cs.map(c => c.checked)') == [True] * 4 and 'COMÉRCIO MODELO ME · SEDIF TESTE' in corpo,
               '1. as 4 marcadas na lista, com o título em cada linha (são dois títulos)')
            ok(p.input_value('#lpData') == H and p.is_disabled('#lpAplicar') and p.inner_text('#lpAplicar') == 'Mudar os prazos'
               and p.inner_text('#lpDia').endswith('· 4 já estão nesse dia'), f'1. começa no prazo de hoje: nada a mudar ({p.inner_text("#lpDia")!r})')

            # 2. sábado, feriado, dia útil; desmarcar
            p.fill('#lpData', SABADO)
            ok('cai no fim de semana' in p.inner_text('#lpDia') and not p.is_disabled('#lpAplicar'), '2. o sábado avisa ("cai no fim de semana")')
            p.fill('#lpData', FER)
            ok(f'— feriado: {FER_NOME}' in p.inner_text('#lpDia'), f'2. o feriado avisa ({p.inner_text("#lpDia")!r})')
            p.fill('#lpData', NOVO)
            ok(p.inner_text('#lpDia') == dia_sem(NOVO) and p.inner_text('#lpAplicar') == 'Mudar 4 prazos', f'2. o dia útil mostra o dia da semana ({p.inner_text("#lpDia")!r})')
            p.locator('#lpLista input').nth(2).uncheck()
            ok(p.inner_text('#lpAplicar') == 'Mudar 3 prazos', '2. desmarcar uma: o botão acompanha')
            p.click('#lpTodas')
            ok(p.is_disabled('#lpAplicar') and p.inner_text('#lpTodas') == 'Marcar todas', '2. "Desmarcar todas": nada a mudar, o botão vira "Marcar todas"')
            p.click('#lpTodas')
            ok(p.inner_text('#lpAplicar') == 'Mudar 4 prazos', '2. "Marcar todas" volta as 4')

            # 3. mudar, com observação
            p.fill('#lpObs', 'Prorrogado pela SEFAZ')
            p.click('#lpAplicar'); p.wait_for_selector('#lpDesfazer', timeout=5000); p.wait_for_timeout(600)
            ok([tarefa_(i)['prazo'] for i in ('s1', 's2', 's3')] == [NOVO] * 3 and tarefa_('a1')['prazo'] == H and tarefa_('s4')['prazo'] == H,
               '3. as 3 SEDIF ganham o prazo novo; a da admissão e a concluída ficam')
            linha = f'Prazo alterado de {BR(H)} para {BR(NOVO)} — pelo lote da Agenda. Prorrogado pela SEFAZ'
            ok(hist('s1') == [linha] and hist('s3') == [linha] and hist('a1') == [], f'3. a linha no histórico, com a observação ({hist("s1")})')
            corpo = p.inner_text('#lpCorpo')
            ok(corpo.startswith(f'✓ 3 prazos mudados pra {dia_sem(NOVO)}.') and '1 ficou de fora: o prazo da admissão vem da ficha (mude em Admissões)' in corpo
               and p.inner_text('#lpCancelar') == 'Fechar' and not p.is_visible('#lpAplicar'), f'3. a janela diz o que fez e o que ficou de fora ({corpo!r})')
            ok(p.locator('[data-bstask="s1"]').count() == 0 and p.locator('[data-bstask="a1"]').count() == 1
               and not p.is_checked('.ag-lote-ck[data-lote="a1"]'), '3. a lista de hoje se refez (as SEDIF saíram) e a seleção sumiu')

            # 4. desfazer; Esc fecha
            p.click('#lpDesfazer'); p.wait_for_function("() => document.getElementById('lpCorpo').innerText.startsWith('↺')", timeout=5000)
            ok([tarefa_(i)['prazo'] for i in ('s1', 's2', 's3')] == [H] * 3 and p.inner_text('#lpCorpo').startswith('↺ Desfeito: 3 voltaram pro prazo de antes.'),
               '4. "Desfazer": as 3 voltam pro prazo de antes')
            ok(hist('s1')[-1] == f'Prazo alterado de {BR(NOVO)} para {BR(H)} — alteração desfeita no lote da Agenda.', f'4. com a linha no histórico ({hist("s1")[-1:]})')
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
            ok(not aberta(), '4. Esc fecha a janela')
            p.wait_for_timeout(500)
            ok(p.locator('[data-bstask="s1"]').count() == 1, '4. as SEDIF voltaram pra lista de hoje')

            # 5. as iguais no editor da tarefa (visão Dia)
            p.click('#agFocoLimpar'); p.wait_for_selector('.ag-card[data-taskid="s1"]', timeout=5000)
            p.click('.ag-card[data-taskid="s1"] .ag-card-titulo'); p.wait_for_selector('#dIrmas[style*="block"]', timeout=5000)
            ok(p.inner_text('#dIrmasLink') == '📅 Mudar o prazo das 3 iguais a esta de uma vez' and p.inner_text('#dIrmasNota') == f'· mesmo título, prazo {BR(H)}',
               f'5. a SEDIF mostra as 3 iguais da Thalia ({p.inner_text("#dIrmasLink")!r})')
            p.click('#detClose'); p.select_option('#fResp', ''); p.wait_for_timeout(500)
            p.click('.ag-card[data-taskid="s1"] .ag-card-titulo'); p.wait_for_selector('#dIrmas[style*="block"]', timeout=5000)
            ok(p.inner_text('#dIrmasLink') == '📅 Mudar o prazo das 4 iguais a esta de uma vez', '5. sem o filtro, 4 (a da Vitória entra; a concluída, não)')
            p.click('#detClose'); p.select_option('#fResp', 'Thalia'); p.wait_for_timeout(500)
            p.click('.ag-card[data-taskid="a1"] .ag-card-titulo'); p.wait_for_selector('#detOverlay.is-open', timeout=5000); p.wait_for_timeout(500)
            ok(not p.is_visible('#dIrmas'), '5. a tarefa sem iguais não mostra o atalho')
            p.click('#detClose')
            p.click('.ag-card[data-taskid="s2"] .ag-card-titulo'); p.wait_for_selector('#dIrmas[style*="block"]', timeout=5000)
            p.fill('#dPrazo', NOVO2)
            p.click('#dIrmasLink'); p.wait_for_selector('#lpOverlay.is-open', timeout=5000)
            corpo = p.inner_text('#lpCorpo')
            ok(p.input_value('#lpData') == NOVO2 and p.inner_text('#lpTitulo') == 'Mudar o prazo de 3 tarefas' and 'SEDIF TESTE' in corpo
               and 'EMPRESA EXEMPLO LTDA · SEDIF' not in corpo and 'OUTRA EMPRESA' not in corpo,
               '5. a janela vem com a data escolhida no editor e as 3 (um título só: sem o título em cada linha)')
            ok('Só estas tarefas: o dia da obrigação' in corpo, '5. avisa que o dia da obrigação nos próximos meses não muda')
            p.click('#lpAplicar'); p.wait_for_selector('#lpDesfazer', timeout=5000); p.wait_for_timeout(500)
            ok([tarefa_(i)['prazo'] for i in ('s1', 's2', 's3')] == [NOVO2] * 3 and tarefa_('s5')['prazo'] == H, '5. as 3 mudam; a da Vitória (fora do filtro) fica')
            ok(p.input_value('#dPrazo') == NOVO2, '5. o campo do prazo no editor acompanha')
            p.click('#lpCancelar'); p.wait_for_timeout(300)
            ok(not aberta() and p.evaluate("() => document.getElementById('detOverlay').classList.contains('is-open')"), '5. "Fechar" volta pro editor, que segue aberto')
            p.wait_for_selector('#dIrmas[style*="block"]', timeout=5000)
            ok(p.inner_text('#dIrmasNota') == f'· mesmo título, prazo {BR(NOVO2)}', '5. o atalho do editor já fala do prazo novo')
            p.click('#dSalvar'); p.wait_for_timeout(800)
            ok(tarefa_('s2')['prazo'] == NOVO2, '5. o "Salvar alterações" depois não volta o prazo')

            # 6. a busca também tem o botão
            p.fill('#agBusca', 'teste'); p.wait_for_selector('#agBuscaNota', timeout=5000); p.wait_for_timeout(300)
            p.check('#agLoteTodas'); p.click('#agLotePrazo'); p.wait_for_selector('#lpOverlay.is-open', timeout=5000)
            n = p.locator('#lpLista input').count()
            ok(n > 4 and ' · ' in p.inner_text('#lpLista') and p.inner_text('#lpTitulo') == f'Mudar o prazo de {n} tarefas', f'6. a busca: o "Selecionar todas" leva as {n} abertas pra janela')
            p.click('#lpCancelar'); p.wait_for_timeout(200)
            ok(not aberta() and [tarefa_(i)['prazo'] for i in ('s1', 's2')] == [NOVO2] * 2, '6. "Cancelar" fecha sem mudar nada')
            ok(not dialogos, f'nenhum aviso de erro ({dialogos})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
