"""
Teste da ordem da pauta nas Reuniões (18/11/2026, pedido do Samuel: "preciso poder redefinir a ordem das pautas, o sistema
atualmente organiza de forma aleatória" — os setores saíam sempre na ordem fixa, Fiscal, DP… Comercial, e dentro do setor na
ordem em que as pautas entraram) — sem login e sem banco (mesmo mock do conferir.py).

    python tests/harness/reunioes-ordem.py

Com uma reunião inventada (uma pauta do Comercial criada primeiro, duas do Fiscal, uma do DP e uma do Financeiro, todas sem
ordem, como as do banco hoje), confere:
  1. a reunião em que ninguém mexeu fica como sempre foi (os setores na ordem fixa, o Comercial por último) e os horários
     saem nessa ordem; o "Mudar a ordem" aparece;
  2. o modo "Mudar a ordem": as setas no lugar do "Editar", a dica, o "Concluir";
  3. as setas do setor: o Comercial sobe três vezes e vira o primeiro, o foco fica na seta (e passa pra outra na ponta),
     a ordem vai pro banco de 1 em diante e os horários se refazem;
  4. a seta da pauta: dentro do setor;
  5. arrastar: o setor pelo nome, a pauta dentro do setor, e a pauta não passa pra outro setor;
  6. "Concluir": o "Editar" volta e o clique na pauta abre as anotações;
  7. sair e abrir de novo: a ordem vem do banco; o PDF sai na mesma ordem, só com o que vai pro cliente;
  8. a pauta nova entra no fim do setor dela (ou num setor novo, no fim) e a que muda de setor vai pro fim do setor novo;
  9. a gravação que falha avisa e a pauta volta ao que está gravado;
 10. no celular (390 px), o modo de ordem não estoura a largura.
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
  // o PDF abre numa janela nova: aqui o HTML fica guardado em window.__pdf
  window.open = () => ({ document: { write: h => { window.__pdf = h; }, close() {} } });
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const hoje = new Date().toISOString().slice(0, 10);
    v.reunioes = [{ id: 'r1', cliente_id: null, participante: 'PROSPECT DE TESTE', data_reuniao: hoje, hora: '13:45:00', status: 'em_preparacao',
      titulo: 'Abertura de empresa (teste)', introducao: null, introducao_minutos: null, tarefa_id: null, created_at: hoje + 'T10:00:00Z' }];
    const p = (id, setor, titulo, minutos, i, extra) => Object.assign({ id, reuniao_id: 'r1', setor, titulo, descricao: null, ordem: 0, minutos,
      imprescindivel: true, apresentadores: 'SAMUEL', visivel_cliente: false, imagens: [], anexos: [], discussao: null,
      created_at: hoje + 'T10:0' + i + ':00Z' }, extra || {});
    v.reuniao_pautas = [
      p('pc', 'comercial', 'Entender objetivos', 15, 0),
      p('pf1', 'fiscal', 'Tributação', 15, 1),
      p('pd', 'dp', 'Pró-labore e INSS', 15, 2, { visivel_cliente: true }),
      p('pfi', 'financeiro', 'Custos', 15, 3),
      p('pf2', 'fiscal', 'Fator R', 10, 4, { visivel_cliente: true }),
    ];
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
            p = b.new_page(viewport={'width': 1400, 'height': 1000})
            p.on('pageerror', lambda e, t=tema: erros.append(f'{t}: {e}'))
            dialogos = []
            p.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.add_init_script(SEMEAR)
            db = lambda js: p.evaluate(js)
            setores = lambda: p.evaluate("() => [...document.querySelectorAll('#pautas .pauta-grupo')].map(g => g.dataset.setor)")
            itens = lambda s: p.evaluate("s => [...document.querySelectorAll('#pautas .pauta-grupo[data-setor=\"' + s + '\"] .pauta-item')].map(i => i.dataset.id)", s)
            ordens = lambda: p.evaluate("() => Object.fromEntries(window.__mockDb.reuniao_pautas.map(x => [x.id, x.ordem]))")
            hora = lambda pid: p.inner_text(f'.pauta-item[data-id="{pid}"] .pauta-chip.hora')
            seta = lambda rot: p.locator(f'[aria-label="{rot}"]')

            p.goto(base + 'comercial-reunioes.html?reuniao=r1'); p.wait_for_selector('#pautas .pauta-grupo', timeout=8000); p.wait_for_timeout(300)

            # 1. a reunião em que ninguém mexeu
            ok(setores() == ['fiscal', 'dp', 'financeiro', 'comercial'] and itens('fiscal') == ['pf1', 'pf2'],
               f'1. sem ordem, como sempre foi: os setores na ordem fixa ({setores()})')
            ok(hora('pf1') == '13h45 – 14h00' and hora('pc') == '14h40 – 14h55', f'1. os horários nessa ordem ({hora("pf1")}, {hora("pc")})')
            ok(p.is_visible('#btnOrdem') and p.inner_text('#btnOrdem') == 'Mudar a ordem' and not p.is_visible('#ordemDica'), '1. o "Mudar a ordem" aparece, a dica não')
            ok(p.locator('.rn-seta').count() == 0 and p.locator('[data-edit]').count() == 5, '1. sem setas, com o "Editar"')

            # 2. o modo "Mudar a ordem"
            p.click('#btnOrdem'); p.wait_for_timeout(200)
            ok(p.inner_text('#btnOrdem') == 'Concluir' and p.get_attribute('#btnOrdem', 'aria-pressed') == 'true' and p.is_visible('#ordemDica'),
               '2. o botão vira "Concluir", com a dica')
            ok(p.locator('.rn-seta').count() == 18 and p.locator('[data-edit]').count() == 0, f'2. as setas no lugar do "Editar" ({p.locator(".rn-seta").count()})')
            ok(seta('Subir o setor Fiscal').is_disabled() and seta('Descer o setor Comercial').is_disabled() and seta('Subir a pauta Tributação').is_disabled(),
               '2. a seta da ponta vem desligada')

            # 3. as setas do setor
            seta('Subir o setor Comercial').click(); p.wait_for_timeout(150)
            foco = p.evaluate("() => document.activeElement && document.activeElement.getAttribute('aria-label')")
            ok(setores() == ['fiscal', 'dp', 'comercial', 'financeiro'] and foco == 'Subir o setor Comercial', f'3. o Comercial sobe um lugar e o foco fica na seta ({foco})')
            seta('Subir o setor Comercial').click(); p.wait_for_timeout(150)
            seta('Subir o setor Comercial').click(); p.wait_for_timeout(400)
            foco = p.evaluate("() => document.activeElement && document.activeElement.getAttribute('aria-label')")
            ok(setores() == ['comercial', 'fiscal', 'dp', 'financeiro'] and foco == 'Descer o setor Comercial', f'3. o Comercial vira o primeiro, o foco passa pra outra seta ({setores()}, {foco})')
            ok(ordens() == {'pc': 1, 'pf1': 2, 'pf2': 3, 'pd': 4, 'pfi': 5}, f'3. a ordem no banco, de 1 em diante ({ordens()})')
            ok(hora('pc') == '13h45 – 14h00' and hora('pd') == '14h25 – 14h40', f'3. os horários se refazem ({hora("pc")}, {hora("pd")})')
            ok('ordem salva' in p.inner_text('#ordemStatus'), f'3. "ordem salva" ({p.inner_text("#ordemStatus")!r})')

            # 4. a seta da pauta: dentro do setor
            seta('Descer a pauta Tributação').click(); p.wait_for_timeout(300)
            ok(itens('fiscal') == ['pf2', 'pf1'] and ordens()['pf2'] == 2 and ordens()['pf1'] == 3, f'4. a pauta desce dentro do setor ({itens("fiscal")})')
            ok(seta('Descer a pauta Tributação').is_disabled() and seta('Subir a pauta Fator R').is_disabled(), '4. as pontas do setor se acertam')

            # 5. arrastar
            p.drag_and_drop('.pauta-grupo[data-setor="dp"] .pauta-grupo-head', '.pauta-grupo[data-setor="fiscal"] .pauta-grupo-head', target_position={'x': 30, 'y': 4})
            p.wait_for_timeout(300)
            ok(setores() == ['comercial', 'dp', 'fiscal', 'financeiro'] and ordens() == {'pc': 1, 'pd': 2, 'pf2': 3, 'pf1': 4, 'pfi': 5},
               f'5. o setor arrastado pelo nome ({setores()}, {ordens()})')
            p.drag_and_drop('.pauta-item[data-id="pf1"]', '.pauta-item[data-id="pf2"]', target_position={'x': 30, 'y': 4})
            p.wait_for_timeout(300)
            ok(itens('fiscal') == ['pf1', 'pf2'] and ordens()['pf1'] == 3 and ordens()['pf2'] == 4, f'5. a pauta arrastada dentro do setor ({itens("fiscal")})')
            antes = ordens()
            p.drag_and_drop('.pauta-item[data-id="pfi"]', '.pauta-item[data-id="pc"]', target_position={'x': 30, 'y': 4})
            p.wait_for_timeout(300)
            ok(setores() == ['comercial', 'dp', 'fiscal', 'financeiro'] and ordens() == antes and not p.locator('.rn-solta-antes, .rn-solta-depois, .rn-arrastando').count(),
               '5. a pauta não passa pra outro setor, e as marcas do arrastar somem')

            # 6. "Concluir"
            p.click('#btnOrdem'); p.wait_for_timeout(200)
            ok(p.inner_text('#btnOrdem') == 'Mudar a ordem' and p.locator('.rn-seta').count() == 0 and p.locator('[data-edit]').count() == 5 and not p.is_visible('#ordemDica'),
               '6. "Concluir": o "Editar" volta, as setas saem')
            p.click('.pauta-item[data-id="pc"] .pauta-item-tit'); p.wait_for_timeout(300)
            ok(p.evaluate("() => document.getElementById('ovDiscussao').style.display") == 'flex', '6. o clique na pauta abre as anotações de novo')
            p.click('#dscFechar'); p.wait_for_timeout(300)

            # 7. sair, abrir de novo e o PDF
            p.click('#btnVoltar'); p.wait_for_timeout(200)
            p.click('.rn-card[data-id="r1"]'); p.wait_for_selector('#pautas .pauta-grupo', timeout=5000); p.wait_for_timeout(300)
            ok(setores() == ['comercial', 'dp', 'fiscal', 'financeiro'] and itens('fiscal') == ['pf1', 'pf2'] and p.inner_text('#btnOrdem') == 'Mudar a ordem',
               f'7. aberta de novo, a ordem vem do banco ({setores()})')
            p.click('#btnPDF'); p.wait_for_timeout(300)
            pdf = p.evaluate("() => window.__pdf || ''")
            ok(pdf and pdf.find('Departamento Pessoal') < pdf.find('>Fiscal<') and pdf.find('Departamento Pessoal') > 0 and 'Entender objetivos' not in pdf and 'Custos' not in pdf,
               '7. o PDF na ordem da tela, só com o que vai pro cliente')

            # 8. a pauta nova e a que muda de setor
            def nova(setor, titulo):
                p.click('#btnNovaPauta'); p.wait_for_timeout(200)
                p.select_option('#pSetor', setor); p.fill('#pTitulo', titulo); p.fill('#pMinutos', '10')
                p.click('#mpSalvar'); p.wait_for_timeout(400)
            nova('societario', 'Contrato social (teste)')
            nova('fiscal', 'Notas fiscais (teste)')
            idsoc = p.evaluate("() => window.__mockDb.reuniao_pautas.find(x => x.titulo === 'Contrato social (teste)').id")
            idnf = p.evaluate("() => window.__mockDb.reuniao_pautas.find(x => x.titulo === 'Notas fiscais (teste)').id")
            ok(setores() == ['comercial', 'dp', 'fiscal', 'financeiro', 'societario'] and itens('fiscal') == ['pf1', 'pf2', idnf] and itens('societario') == [idsoc],
               f'8. a pauta nova entra no fim do setor dela, ou num setor novo no fim ({setores()})')
            p.click('[data-edit="pd"]'); p.wait_for_timeout(200)
            p.select_option('#pSetor', 'financeiro'); p.click('#mpSalvar'); p.wait_for_timeout(400)
            pd = p.evaluate("() => window.__mockDb.reuniao_pautas.find(x => x.id === 'pd')")
            ok(setores() == ['comercial', 'fiscal', 'financeiro', 'societario'] and itens('financeiro') == ['pfi', 'pd'] and pd['setor'] == 'financeiro' and pd['ordem'] == 0,
               f'8. a que muda de setor vai pro fim do setor novo ({setores()}, {itens("financeiro")}, ordem {pd["ordem"]})')
            p.click('#btnOrdem'); p.wait_for_timeout(200)
            seta('Subir o setor Societário').click(); p.wait_for_timeout(400)
            o = ordens()
            ok(setores() == ['comercial', 'fiscal', 'societario', 'financeiro'] and sorted(o.values()) == list(range(1, 8)) and o[idsoc] == 5 and o['pd'] == 7,
               f'8. ao mexer de novo, todas ganham a ordem, de 1 em diante ({o})')

            # 9. a gravação que falha
            p.evaluate("() => { window.__mockErroTabela = { reuniao_pautas: 'falhou' }; }")
            seta('Subir o setor Societário').click(); p.wait_for_timeout(500)
            ok('Não deu pra gravar a ordem' in p.inner_text('#ordemStatus'), f'9. a falha aparece ({p.inner_text("#ordemStatus")!r})')
            p.evaluate("() => { window.__mockErroTabela = null; }")
            p.click('#btnVoltar'); p.wait_for_timeout(200)
            p.click('.rn-card[data-id="r1"]'); p.wait_for_selector('#pautas .pauta-grupo', timeout=5000); p.wait_for_timeout(300)
            ok(setores() == ['comercial', 'fiscal', 'societario', 'financeiro'], f'9. a pauta fica com o que está gravado ({setores()})')

            # 10. no celular
            p.set_viewport_size({'width': 390, 'height': 900}); p.click('#btnOrdem'); p.wait_for_timeout(300)
            larg = p.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
            ok(larg[0] <= larg[1] + 1, f'10. no celular, sem rolagem de lado ({larg})')
            if tema == 'escuro':
                pasta = pathlib.Path(__file__).resolve().parents[2] / '.harness' / 'fotos'; pasta.mkdir(parents=True, exist_ok=True)
                p.screenshot(path=str(pasta / 'reunioes-ordem-celular.png'), full_page=True)
                p.set_viewport_size({'width': 1400, 'height': 1000}); p.wait_for_timeout(200)
                p.screenshot(path=str(pasta / 'reunioes-ordem.png'), full_page=True)
            ok(not [d for d in dialogos if 'ordem' not in d], f'nenhum aviso inesperado ({dialogos})')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
