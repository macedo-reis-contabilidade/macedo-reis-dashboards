"""
Teste de excluir rotina nas Tarefas recorrentes (assets/js/rotinas-setor.js, tela do Contábil) — sem login e sem banco
(mesmo mock do conferir.py, dados inventados: rotina rm2 com o vínculo tr2 e as tarefas t84 pendente atrasada, t85
concluída e t86 em andamento; avulsa tr3 com t81 pendente atrasada, t82 pendente futura e t83 concluída).

    python tests/harness/rotinas-excluir.py

Regra do Samuel (30/09/2026): só exclui sem empresa vinculada — primeiro desvincula, depois exclui; nada de apagar
o histórico de tarefas concluídas. Confere, nos temas escuro e claro:
  1. rotina com empresa: "excluir rotina" não exclui e avisa pra desvincular antes;
  2. desvincular: tira as tarefas pendentes (inclusive a atrasada), mantém a concluída e a em andamento; a rotina
     fica na lista, com 0;
  3. sem empresa: "excluir rotina" exclui (sai da lista, ativo = false) e mostra o recado;
  4. "+ Rotina" com o nome de uma rotina excluída traz ela de volta (sem empresa), em vez de dizer que já existe;
  5. avulsa ("criada pela Nova tarefa"): "excluir rotina" avisa pra desvincular; desvincular a empresa tira ela
     da lista, com as pendentes, e mantém a concluída.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def tarefa(p, tid):
    return p.evaluate(f"() => window.__mockDb.tarefas.find(t => t.id === '{tid}') || null")

def rotina(p, nome):
    return p.evaluate(f"() => window.__mockDb.rotinas_modelo.filter(r => r.nome === {nome!r})")

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tema in ('escuro', 'claro'):
            print(f'[{tema}] Contábil — excluir rotina')
            p = b.new_page(viewport={'width': 1400, 'height': 900})
            p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
            dialogos, respostas = [], ['CONCILIAÇÃO BANCÁRIA (TESTE)']
            def trata(d):
                dialogos.append(d.message)
                if d.type == 'prompt' and respostas: d.accept(respostas.pop(0))
                else: d.accept()
            p.on('dialog', trata)
            p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
            p.goto(base + 'contabil-regras.html'); p.wait_for_timeout(1500)

            p.locator('.rv-item', has_text='CONCILIAÇÃO BANCÁRIA (TESTE)').click(); p.wait_for_timeout(300)
            p.click('#rvDel'); p.wait_for_timeout(400)
            ok(any('Desvincule todas' in d for d in dialogos) and rotina(p, 'CONCILIAÇÃO BANCÁRIA (TESTE)')[0]['ativo'] is True,
               '1. com empresa vinculada: não exclui e avisa pra desvincular antes')

            p.check('#rvTodas'); p.wait_for_timeout(200); p.click('#rvRem'); p.wait_for_timeout(700)
            v = p.evaluate("() => window.__mockDb.tarefas_recorrentes.find(x => x.id === 'tr2')")
            ok(v['ativo'] is False, '2. vínculo desligado')
            ok(tarefa(p, 't84') is None, '2. a pendente atrasada saiu da agenda')
            ok(tarefa(p, 't85') is not None and tarefa(p, 't86') is not None, '2. a concluída e a em andamento ficaram')
            item = p.locator('.rv-item', has_text='CONCILIAÇÃO BANCÁRIA (TESTE)')
            ok(item.count() == 1 and item.locator('.n').inner_text().strip() == '0', '2. a rotina fica na lista, com 0 empresas')

            n = len(dialogos)
            p.click('#rvDel'); p.wait_for_timeout(700)
            ok(any('Excluir a rotina' in d for d in dialogos[n:]) and rotina(p, 'CONCILIAÇÃO BANCÁRIA (TESTE)')[0]['ativo'] is False,
               '3. sem empresa: pergunta e exclui (ativo = false)')
            ok(p.locator('.rv-item', has_text='CONCILIAÇÃO BANCÁRIA (TESTE)').count() == 0 and 'excluída' in p.inner_text('#rvPainel'),
               '3. saiu da lista e o painel mostra o recado')
            ok(tarefa(p, 't85') is not None, '3. a tarefa concluída continua no histórico')
            p.screenshot(path=str(FOTOS / f'rotinas-excluida-{tema}.png'))

            n = len(dialogos)
            p.click('#rvNova'); p.wait_for_timeout(700)
            rs = rotina(p, 'CONCILIAÇÃO BANCÁRIA (TESTE)')
            ok(len(rs) == 1 and rs[0]['ativo'] is True and not any('Já existe' in d for d in dialogos[n:]),
               '4. "+ Rotina" com o nome da excluída traz ela de volta, sem duplicar')
            ok(p.locator('.rv-item.on', has_text='CONCILIAÇÃO BANCÁRIA (TESTE)').count() == 1
               and p.locator('.rv-item.on .n').inner_text().strip() == '0', '4. volta selecionada e sem as empresas de antes')

            p.locator('.rv-item', has_text='EMISSÃO DE EXTRATOS (TESTE)').click(); p.wait_for_timeout(300)
            p.screenshot(path=str(FOTOS / f'rotinas-avulsa-{tema}.png'))
            n = len(dialogos)
            p.click('#rvDel'); p.wait_for_timeout(400)
            ok(any('desvincule a empresa' in d for d in dialogos[n:]) and p.locator('.rv-item', has_text='EMISSÃO DE EXTRATOS (TESTE)').count() == 1,
               '5. avulsa: "excluir rotina" avisa pra desvincular')
            n = len(dialogos)
            p.check('#rvTodas'); p.wait_for_timeout(200); p.click('#rvRem'); p.wait_for_timeout(700)
            ok(any('sai da lista' in d for d in dialogos[n:]), '5. o aviso do Desvincular diz que ela sai da lista')
            ok(p.locator('.rv-item', has_text='EMISSÃO DE EXTRATOS (TESTE)').count() == 0 and 'removida da lista' in p.inner_text('#rvPainel'),
               '5. desvincular a empresa tira a avulsa da lista')
            ok(tarefa(p, 't81') is None and tarefa(p, 't82') is None and tarefa(p, 't83') is not None,
               '5. as pendentes (atrasada e futura) saíram; a concluída ficou')
            p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
