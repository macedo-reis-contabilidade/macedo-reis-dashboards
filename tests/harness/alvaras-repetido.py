"""
O alvará repetido (Societário › Alvarás, 12/11/2026, pedido da Adaini: "impedir de gravar dois alvarás para a mesma empresa
com o mesmo número") — sem login e sem banco (o mock do conferir.py, com os alvarás semeados só neste teste; nomes e
números inventados).

    python tests/harness/alvaras-repetido.py

Confere:
  1. a lista com um alvará já em dobro: o aviso em cima, a marca "Repetido" nos dois (e só neles), "Ver os repetidos"
     mostra os dois e "Ver todos" volta;
  2. "+ Novo alvará" com a empresa, o tipo e o número de um que já existe (digitado de outro jeito): o aviso aparece
     enquanto se preenche, o Cadastrar não grava, e "Abrir o que já existe" abre o alvará;
  3. o mesmo número em outro tipo de alvará: só avisa; o Cadastrar pergunta — Cancelar não grava, OK grava;
  4. outro número: sem aviso, grava;
  5. o mesmo alvará cadastrado por outra pessoa enquanto a janela estava aberta (está no banco e não na tela): o
     Cadastrar confere no banco e não grava;
  6. a janela de um alvará que já está em dobro: o aviso com "Abrir o outro"; Salvar sem trocar o número grava (o que
     já estava em dobro segue editável); trocar o número por um que a empresa já tem no mesmo tipo não grava, nem pelo
     Salvar nem pelo Renovar; trocar por um livre grava e o par deixa de estar em dobro;
  7. excluir a cópia: o aviso e a marca somem;
  8. texto de fora entra como texto (o tipo com <img onerror> no aviso);
  9. dois alvarás em dobro: o aviso diz 2 (os alvarás, não as linhas);
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

FUNC, SANIT, AVCB = 'Alvará de Funcionamento', 'Alvará Sanitário (Vigilância Sanitária)', 'Alvará do Corpo de Bombeiros (AVCB)'
PERIGO = '<img src=x onerror="window.__pego=1">'
# c1: o Funcionamento 219270 em dobro (a1 e a2) e um Sanitário; c2: um AVCB e um tipo "perigoso" com número
SEMEAR = """
(() => {
  let db;
  const A = (id, cliente_id, nome, tipo, numero, venc, o = {}) => ({ id, cliente_id, tipo, numero, orgao: 'Prefeitura de Teste', cidade: 'Cidade de Teste', responsavel: 'Adaini',
    vencimento: venc, recorrencia: 'nenhuma', link_drive: null, observacoes: null, status: 'vigente', created_at: '2026-08-01T12:00:00Z', clientes: { nome_principal: nome }, ...o });
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.alvaras = [
      A('a1', 'c1', 'COMÉRCIO MODELO ME', %(FUNC)s, '219270', '2027-11-18'),
      A('a2', 'c1', 'COMÉRCIO MODELO ME', %(FUNC)s, '219.270', '2027-11-18', { created_at: '2026-10-29T12:00:00Z' }),
      A('a3', 'c1', 'COMÉRCIO MODELO ME', %(SANIT)s, '77/2026', '2027-06-30'),
      A('a4', 'c2', 'EMPRESA EXEMPLO LTDA', %(AVCB)s, 'A00035634AA001', '2030-09-16'),
      A('a5', 'c2', 'EMPRESA EXEMPLO LTDA', %(PERIGO)s, 'X-9', '2027-01-10'),
      A('a6', 'c2', 'EMPRESA EXEMPLO LTDA', %(FUNC)s, null, '2027-03-01'),
    ];
    v.alvara_historico = [];
    // o cenário 9 acrescenta cópias que sobrevivem ao recarregar a página (o recarregar refaz este banco)
    try { JSON.parse(sessionStorage.getItem('alv_extra') || '[]').forEach(e => v.alvaras.push({ ...v.alvaras.find(a => a.id === e.de), id: e.id, numero: e.numero })); } catch (e) {}
  } });
})();
""" % {k: __import__('json').dumps(v, ensure_ascii=False) for k, v in (('FUNC', FUNC), ('SANIT', SANIT), ('AVCB', AVCB), ('PERIGO', PERIGO))}
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def banco(p):
    return p.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.alvaras))")
def ids(p):
    return p.eval_on_selector_all('#lista .alv-card', 'els => els.map(e => e.dataset.id)')
def repetidos_na_tela(p):
    return sorted(p.eval_on_selector_all('#lista .alv-card', "els => els.filter(e => e.querySelector('.pill-rep')).map(e => e.dataset.id)"))
def novo(p, cliente, tipo, numero, resp='Adaini'):
    p.click('#btnNovo'); p.wait_for_timeout(200)
    p.select_option('#nCliente', cliente); p.select_option('#nTipo', tipo); p.fill('#nNumero', numero); p.select_option('#nResp', resp)
    p.wait_for_timeout(150)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros, dialogos, resposta = [], [], {'aceitar': True}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 1400, 'height': 1000})
        p.on('pageerror', lambda e: erros.append(str(e)))
        def ao_dialogo(d):
            dialogos.append(d.message)
            d.accept() if resposta['aceitar'] else d.dismiss()
        p.on('dialog', ao_dialogo)
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)

        print('1. A lista com um alvará em dobro')
        p.goto(base + 'societario-alvaras.html')
        p.wait_for_selector('#lista .alv-card', timeout=8000)
        aviso = p.inner_text('#avisoRep')
        ok(p.is_visible('#avisoRep') and 'Um alvará está cadastrado mais de uma vez' in aviso and 'Ver os repetidos' in aviso, f'1. o aviso em cima da lista ({aviso!r})')
        ok(repetidos_na_tela(p) == ['a1', 'a2'], f'1. a marca "Repetido" nos dois, e só neles ({repetidos_na_tela(p)})')
        ok(len(ids(p)) == 6, f'1. a lista inteira segue na tela ({len(ids(p))})')
        p.click('#btnVerRep'); p.wait_for_timeout(200)
        ok(sorted(ids(p)) == ['a1', 'a2'] and 'Ver todos' in p.inner_text('#avisoRep') and p.locator('.fa-focus-card.is-active').count() == 0, f'1. "Ver os repetidos": só os dois ({ids(p)})')
        p.click('#btnVerRep'); p.wait_for_timeout(200)
        ok(len(ids(p)) == 6 and p.get_attribute('.fa-focus-card.is-active', 'data-f') == 'todos', '1. "Ver todos" volta pra lista inteira')
        p.click('#btnVerRep'); p.click('.fa-focus-card[data-f="vigentes"]'); p.wait_for_timeout(200)
        ok(len(ids(p)) == 6 and 'Ver os repetidos' in p.inner_text('#avisoRep'), '1. clicar num filtro do alto sai dos repetidos')
        p.click('.fa-focus-card[data-f="todos"]')

        print('2. Novo alvará igual a um que já existe')
        novo(p, 'c2', AVCB, ' a-000.356/34 AA 001 ')
        txt = p.inner_text('#nRepetido')
        ok(p.is_visible('#nRepetido') and 'Esta empresa já tem este alvará' in txt and 'A00035634AA001, vence em 16/09/2030' in txt and 'alv-repetido-igual' in p.get_attribute('#nRepetido', 'class'),
           f'2. o aviso aparece enquanto se preenche ({txt!r})')
        antes = len(banco(p)); dialogos.clear()
        p.click('#nSalvar'); p.wait_for_timeout(500)
        ok(len(banco(p)) == antes and p.locator('#ovNovo.is-open').count() == 1 and not dialogos, '2. o Cadastrar não grava, e a janela segue aberta')
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'nNumero', '2. o foco vai pro número')
        p.click('#nRepetido [data-abrir-alv]'); p.wait_for_timeout(500)
        ok(p.locator('#ovNovo.is-open').count() == 0 and p.locator('#ovDet.is-open').count() == 1 and p.input_value('#dNumero') == 'A00035634AA001' and 'EMPRESA EXEMPLO' in p.inner_text('#dEmpresa'),
           '2. "Abrir o que já existe" abre o alvará')
        ok(not p.is_visible('#dRepetido'), '2. o alvará que não está em dobro abre sem aviso')
        p.click('#dClose')
        p.click('#btnNovo'); p.wait_for_timeout(200)
        ok(not p.is_visible('#nRepetido') and p.input_value('#nNumero') == '', '2. a janela do novo volta limpa, sem o aviso')
        p.click('#nCancelar')

        print('3. O mesmo número em outro tipo de alvará')
        novo(p, 'c2', SANIT, 'A00035634AA001')
        txt = p.inner_text('#nRepetido')
        ok(p.is_visible('#nRepetido') and 'já tem este número em outro alvará' in txt and 'alv-repetido-outro' in p.get_attribute('#nRepetido', 'class'), f'3. só avisa ({txt!r})')
        antes = len(banco(p)); dialogos.clear(); resposta['aceitar'] = False
        p.click('#nSalvar'); p.wait_for_timeout(500)
        ok(len(dialogos) == 1 and 'em outro alvará' in dialogos[0] and len(banco(p)) == antes, f'3. o Cadastrar pergunta, e Cancelar não grava ({dialogos})')
        dialogos.clear(); resposta['aceitar'] = True
        p.click('#nSalvar'); p.wait_for_timeout(700)
        novos = [a for a in banco(p) if a['tipo'] == SANIT and a['cliente_id'] == 'c2']
        ok(len(dialogos) == 1 and len(novos) == 1 and novos[0]['numero'] == 'A00035634AA001' and p.locator('#ovNovo.is-open').count() == 0, '3. com o OK, grava')
        ok(repetidos_na_tela(p) == ['a1', 'a2'], '3. tipo diferente não ganha a marca "Repetido"')

        print('4. Outro número')
        novo(p, 'c2', AVCB, 'B777')
        ok(not p.is_visible('#nRepetido'), '4. sem aviso')
        antes = len(banco(p)); dialogos.clear()
        p.click('#nSalvar'); p.wait_for_timeout(700)
        ok(len(banco(p)) == antes + 1 and not dialogos, '4. grava sem perguntar')
        novo(p, 'c2', FUNC, '')
        antes = len(banco(p))
        p.click('#nSalvar'); p.wait_for_timeout(700)
        ok(len(banco(p)) == antes + 1 and not p.is_visible('#nRepetido'), '4. sem número também grava (a empresa já tinha outro sem número)')

        print('5. Cadastrado por outra pessoa com a janela aberta')
        novo(p, 'c1', SANIT, '500/2026')
        ok(not p.is_visible('#nRepetido'), '5. na tela, o número está livre')
        p.evaluate("""t => { window.__mockDb.alvaras.push({ id: 'fora1', cliente_id: 'c1', tipo: t, numero: '0500-2026', orgao: null, cidade: null, responsavel: 'Adaini', vencimento: '2027-02-02',
          recorrencia: 'nenhuma', link_drive: null, observacoes: null, status: 'vigente', created_at: '2026-11-12T12:00:00Z', clientes: { nome_principal: 'COMÉRCIO MODELO ME' } }); }""", SANIT)
        antes = len(banco(p))
        p.click('#nSalvar'); p.wait_for_timeout(600)
        ok(len(banco(p)) == antes and p.is_visible('#nRepetido') and '0500-2026' in p.inner_text('#nRepetido'), f'5. o Cadastrar confere no banco e não grava ({p.inner_text("#nRepetido")!r})')
        p.click('#nRepetido [data-abrir-alv]'); p.wait_for_timeout(700)
        ok(p.locator('#ovDet.is-open').count() == 1 and p.input_value('#dNumero') == '0500-2026', '5. "Abrir o que já existe" recarrega a lista e abre o alvará')
        p.click('#dClose')

        print('6. A janela de um alvará que já está em dobro')
        p.click('.alv-card[data-id="a2"]'); p.wait_for_timeout(500)
        txt = p.inner_text('#dRepetido')
        ok(p.is_visible('#dRepetido') and 'cadastrado mais de uma vez' in txt and 'Abrir o outro' in txt and 'nº 219270' in txt, f'6. o aviso com "Abrir o outro" ({txt!r})')
        p.fill('#dObs', 'conferido'); p.click('#dSalvar'); p.wait_for_timeout(600)
        a2 = next(a for a in banco(p) if a['id'] == 'a2')
        ok(a2['observacoes'] == 'conferido' and a2['numero'] == '219.270', '6. Salvar sem trocar o número grava (o que já estava em dobro segue editável)')
        p.fill('#dNumero', '77-2026'); p.wait_for_timeout(150)
        ok('já tem este número em outro alvará' in p.inner_text('#dRepetido'), '6. o número do Sanitário da mesma empresa: só avisa (outro tipo)')
        p.fill('#dNumero', '0219270'); p.wait_for_timeout(150)
        ok('cadastrado mais de uma vez' in p.inner_text('#dRepetido'), '6. de volta ao número de sempre (com zero na frente): o aviso do que já estava')
        # um terceiro Funcionamento da c1, com outro número, pra tentar trocar pro número do par
        p.click('#dClose')
        novo(p, 'c1', FUNC, '300300'); p.click('#nSalvar'); p.wait_for_timeout(700)
        a_novo = next(a for a in banco(p) if a['numero'] == '300300')
        p.click(f'.alv-card[data-id="{a_novo["id"]}"]'); p.wait_for_timeout(500)
        ok(not p.is_visible('#dRepetido'), '6. o alvará novo abre sem aviso')
        p.fill('#dNumero', '219270'); p.wait_for_timeout(150)
        txt = p.inner_text('#dRepetido')
        ok('Esta empresa já tem este alvará' in txt and 'Não dá pra gravar o mesmo duas vezes' in txt, f'6. trocar pro número de outro do mesmo tipo: avisa ({txt!r})')
        p.click('#dSalvar'); p.wait_for_timeout(500)
        ok(next(a for a in banco(p) if a['id'] == a_novo['id'])['numero'] == '300300', '6. o Salvar não grava')
        p.fill('#dVenc', '2029-01-01'); dialogos.clear()
        p.click('#dRenovar'); p.wait_for_timeout(500)
        linha = next(a for a in banco(p) if a['id'] == a_novo['id'])
        ok(linha['numero'] == '300300' and linha['vencimento'] != '2029-01-01', '6. o Renovar também não grava')
        p.fill('#dNumero', '300301'); p.wait_for_timeout(150)
        ok(not p.is_visible('#dRepetido'), '6. um número livre: sem aviso')
        p.click('#dRenovar'); p.wait_for_timeout(700)
        linha = next(a for a in banco(p) if a['id'] == a_novo['id'])
        ok(linha['numero'] == '300301' and linha['vencimento'] == '2029-01-01', '6. e o Renovar grava')
        p.click('#dClose')
        # o par: trocar o número da cópia por um livre desfaz o dobro
        p.click('.alv-card[data-id="a2"]'); p.wait_for_timeout(500)
        p.fill('#dNumero', '219271'); p.click('#dSalvar'); p.wait_for_timeout(700)
        ok(next(a for a in banco(p) if a['id'] == 'a2')['numero'] == '219271' and repetidos_na_tela(p) == [] and not p.is_visible('#avisoRep'),
           f"6. a cópia com outro número: o par deixa de estar em dobro, e o aviso da lista some (banco {next(a for a in banco(p) if a['id'] == 'a2')['numero']!r}, marcados {repetidos_na_tela(p)}, aviso {p.is_visible('#avisoRep')}, {p.inner_text('#avisoRep')!r}, dRepetido {p.inner_text('#dRepetido')!r})")
        p.fill('#dNumero', '219270'); p.wait_for_timeout(150)
        p.click('#dSalvar'); p.wait_for_timeout(500)
        ok(next(a for a in banco(p) if a['id'] == 'a2')['numero'] == '219271', '6. e voltar pro número do outro já não grava')
        p.click('#dClose')

        print('7. Excluir a cópia')
        p.evaluate("() => { window.__mockDb.alvaras.find(a => a.id === 'a2').numero = '219.270'; }")
        p.reload(); p.wait_for_selector('#lista .alv-card', timeout=8000)
        ok(repetidos_na_tela(p) == ['a1', 'a2'] and p.is_visible('#avisoRep'), '7. (o par está em dobro de novo)')
        p.click('#btnVerRep'); p.wait_for_timeout(200)
        p.click('.alv-card[data-id="a2"]'); p.wait_for_timeout(500)
        resposta['aceitar'] = True
        p.click('#dExcluir'); p.wait_for_timeout(700)
        ok(not any(a['id'] == 'a2' for a in banco(p)) and not p.is_visible('#avisoRep') and repetidos_na_tela(p) == [] and len(ids(p)) == len(banco(p)),
           f"7. excluída a cópia, o aviso e a marca somem e a lista volta inteira (a2 no banco {any(a['id'] == 'a2' for a in banco(p))}, aviso {p.is_visible('#avisoRep')}, marcados {repetidos_na_tela(p)}, tela {len(ids(p))}, banco {len(banco(p))}, dialogos {dialogos[-2:]})")

        print('8. Texto de fora')
        novo(p, 'c2', FUNC, 'Y-1')
        ok(not p.is_visible('#nRepetido'), '8. (um número que a empresa não tem: sem aviso)')
        p.fill('#nNumero', 'X-9'); p.wait_for_timeout(150)
        txt = p.inner_text('#nRepetido')
        ok(p.is_visible('#nRepetido') and '<img src=x' in txt and p.locator('#nRepetido img').count() == 0 and p.evaluate('() => window.__pego') is None, f'8. o tipo com <img onerror> entra como texto ({txt!r})')
        p.click('#nCancelar')

        print('9. Dois alvarás em dobro')
        p.evaluate("""() => sessionStorage.setItem('alv_extra', JSON.stringify([{ de: 'a1', id: 'a7', numero: '219-270' }, { de: 'a4', id: 'a8', numero: 'a-00035634-aa-001' }]))""")
        p.reload(); p.wait_for_selector('#lista .alv-card', timeout=8000)
        aviso = p.inner_text('#avisoRep')
        ok('2 alvarás estão cadastrados mais de uma vez' in aviso and repetidos_na_tela(p) == ['a1', 'a2', 'a4', 'a7', 'a8'], f'9. o aviso conta os alvarás, não as linhas: o 219270 três vezes e o AVCB duas ({aviso!r}, {repetidos_na_tela(p)})')
        p.evaluate("() => sessionStorage.removeItem('alv_extra')")
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    total = falhas + len(erros)
    print('\n' + ('tudo certo' if not total else f'{total} falha(s)'))
    sys.exit(1 if total else 0)

if __name__ == '__main__':
    main()
