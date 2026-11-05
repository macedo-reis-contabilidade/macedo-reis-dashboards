"""
Folha de pagamento (DP, 05/11/2026, pedido do Samuel) — os recibos que o escritório faz fora da folha do Domínio. Sem
login e sem banco (o mock do conferir.py, com os funcionários e um recibo semeados só neste teste; nomes e números
inventados). O relógio fica parado em 05/11/2026, então a tela abre na competência de outubro. O jsPDF do CDN fica de
fora: entra um dublê que anota o que a tela manda escrever.

    python tests/harness/folha.py

Confere:
  1. sem empresa: os atalhos das empresas que já têm funcionário aqui; clicar abre a empresa, com o resumo do mês, quem
     trabalhou em outubro e quem ficou fora (saiu antes);
  2. o recibo novo de quem recebe por hora: as linhas da folha, a sugestão do descanso pelos domingos e feriados do período
     ("usar"), as horas em h:mm, os valores, o arredondamento, o total por extenso; gravar põe o recibo na lista;
  3. quem recebe por mês: os 30 dias, e o adiantamento do mês já pago entra sozinho como desconto;
  4. abrir o recibo gravado e mudar uma linha refaz a conta e grava; o aviso de recibo repetido e a confirmação;
  5. o que impede gravar: as horas ilegíveis e o recibo sem valor; fechar com mudança pergunta (o Esc também);
  6. o funcionário: sem o valor não grava; cadastrar, o nome repetido pergunta, editar; excluir só quem não tem recibo;
  7. o PDF: "Salvar e imprimir" de um recibo e "Imprimir os recibos" do mês, com o nome do arquivo;
  8. trocar de mês mostra quem trabalhou nele; o endereço (?cliente=&competencia=) abre direto;
  9. texto de fora entra como texto (o nome com <img onerror>);
 10. o card no DP: "N funcionários";
 11. a insalubridade: o grau no cadastro (com quanto dá no mês), a linha "Insalubridade 20%" que vem sozinha no recibo do
     mês pelos dias do período, a extra com o adicional, a base do recibo com o grau, gravar com a coluna, o PDF com a
     linha, e o grau só deste recibo ("mudar neste recibo": sem grau a linha sai, com 40% volta);
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
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
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.folha_funcionarios = [
      { id: 'f1', cliente_id: 'c1', nome: 'FUNCIONÁRIA DE TESTE', funcao: 'Auxiliar', admissao: '2026-10-19', saida: null, tipo_valor: 'hora', valor: 8.37, horas_semana: 44, observacao: null },
      { id: 'f2', cliente_id: 'c1', nome: 'MENSALISTA DE TESTE', funcao: null, admissao: '2026-08-07', saida: null, tipo_valor: 'mes', valor: 1842, horas_semana: 44, observacao: null },
      { id: 'f3', cliente_id: 'c1', nome: 'QUEM SAIU DE TESTE', funcao: null, admissao: '2026-06-01', saida: '2026-09-15', tipo_valor: 'hora', valor: 9, horas_semana: 44, observacao: null },
      { id: 'f9', cliente_id: 'c2', nome: '<img src=x onerror="window.__pego=1">', funcao: null, admissao: '2026-10-01', saida: null, tipo_valor: 'hora', valor: 10, horas_semana: 44, observacao: null },
    ];
    v.folha_recibos = [
      { id: 'ra', cliente_id: 'c1', funcionario_id: 'f2', nome: 'MENSALISTA DE TESTE', tipo: 'adiantamento', competencia: '2026-10', periodo_de: null, periodo_ate: null,
        tipo_valor: 'mes', valor: 1842, horas_semana: 44, itens: [{ ev: 'adiantamento_salarial', q: 40, desc: null, v: 73680 }], arredondar: true, arredondamento: 0.2, total: 737,
        pagamento: '2026-10-20', observacao: null, criado_em: '2026-10-20T12:00:00Z' },
    ];
  } });
})();
"""
DUBLE_PDF = r"""
window.__pdfTextos = []; window.__pdfSalvo = null; window.__pdfPaginas = 0;
(() => {
  class Doc {
    constructor(){ window.__pdfTextos = []; window.__pdfPaginas = 1; }
    text(t){ (Array.isArray(t) ? t : [t]).forEach(s => window.__pdfTextos.push(String(s))); return this; }
    splitTextToSize(t){ return [String(t)]; }
    addPage(){ window.__pdfPaginas++; return this; }
    save(nome){ window.__pdfSalvo = nome; return this; }
  }
  for (const m of ['rect', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setDrawColor', 'setLineWidth', 'setLineDashPattern'])
    Doc.prototype[m] = function () { return this; };
  Object.defineProperty(window, 'jspdf', { value: { jsPDF: Doc }, writable: false });
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def recibo(p, id_):
    return p.evaluate("id => { const r = window.__mockDb.folha_recibos.find(x => x.id === id); return r ? JSON.parse(JSON.stringify(r)) : null; }", id_)
def recibos_de(p, func):
    return p.evaluate("f => JSON.parse(JSON.stringify(window.__mockDb.folha_recibos.filter(x => x.funcionario_id === f)))", func)
def linha_ed(p, i):
    return p.locator(f'#rLinhas tr[data-i="{i}"]')

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    dialogos = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        resposta = {'aceitar': True}
        def no_dialogo(d):
            dialogos.append(d.message)
            d.accept() if resposta['aceitar'] else d.dismiss()
        p.on('dialog', no_dialogo)
        p.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())   # o CDN fica de fora: entra o dublê do jsPDF
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(DUBLE_PDF)
        p.clock.set_fixed_time('2026-11-05T12:00:00')

        print('1. A tela, sem empresa e com ela')
        p.goto(base + 'dp-folha.html')
        p.wait_for_selector('#atalhosEmp .fp-atalho', timeout=8000)
        ok(p.input_value('#competencia') == '2026-10', f'abre em outubro (dia 5 de novembro) ({p.input_value("#competencia")})')
        atalhos = p.inner_text('#atalhosEmp')
        ok('COMÉRCIO MODELO ME' in atalhos and '2 funcionários' in atalhos, f'os atalhos das empresas com funcionário (quem saiu não conta) ({atalhos!r})')
        p.click('#atalhosEmp .fp-atalho[data-id="c1"]')
        p.wait_for_selector('#lista .fp-func', timeout=5000)
        ok(p.inner_text('#empNome') == 'COMÉRCIO MODELO ME', 'abre a empresa')
        ids = p.eval_on_selector_all('#lista .fp-func', 'els => els.map(e => e.dataset.id)')
        ok(ids == ['f1', 'f2'], f'em outubro, quem trabalhou nele, pelo nome ({ids})')
        resumo = p.inner_text('#resumo')
        ok('2 funcionários em Outubro de 2026' in resumo and '1 recibo, total de R$ 737,00' in resumo, f'o resumo do mês ({resumo!r})')
        ok(p.is_visible('#fora') and p.inner_text('#foraTitulo').startswith('1 funcionário fora deste mês') and 'QUEM SAIU DE TESTE' in (p.text_content('#listaFora') or ''),
           f'quem saiu antes do mês fica em "fora deste mês" ({p.inner_text("#foraTitulo")!r})')
        ok('Adiantamento salarial' in p.inner_text('.fp-func[data-id="f2"]') and 'R$ 737,00' in p.inner_text('.fp-func[data-id="f2"]'), 'o recibo do mês aparece no funcionário')
        ok('cliente=c1' in p.url and 'competencia=2026-10' in p.url, f'o endereço guarda a empresa e o mês ({p.url})')

        print('2. O recibo novo de quem recebe por hora')
        p.select_option('.fp-func[data-id="f1"] select.fp-novo', 'mensal')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        evs = p.eval_on_selector_all('#rLinhas tr[data-i]', 'els => els.map(e => e.querySelector(".fp-ev").textContent)')
        ok(evs == ['Horas normais', 'Descanso remunerado', 'Horas extras 50%'], f'as linhas da folha ({evs})')
        ok(p.input_value('#rDe') == '2026-10-19' and p.input_value('#rAte') == '2026-10-31', 'o período: da admissão ao fim do mês')
        dica = linha_ed(p, 1).inner_text()
        ok('1 domingo de 19/10 a 31/10: 7:20' in dica, f'a sugestão do descanso ({dica!r})')
        p.fill('#rLinhas [data-q="0"]', '88:00')
        ok(linha_ed(p, 0).locator('td.fp-num').inner_text() == '736,56', 'as horas × a hora: 736,56')
        linha_ed(p, 1).locator('[data-usar]').click()
        ok(p.input_value('#rLinhas [data-q="1"]') == '7:20' and linha_ed(p, 1).locator('td.fp-num').inner_text() == '61,35', '"usar" põe o descanso: 7:20 = 61,35')
        p.fill('#rLinhas [data-q="2"]', '2')
        p.click('#rTitulo')   # sai do campo: as horas viram h:mm
        ok(p.input_value('#rLinhas [data-q="2"]') == '2:00' and linha_ed(p, 2).locator('td.fp-num').inner_text() == '25,11', 'a extra de 50%: 2:00 = 25,11')
        ok(p.inner_text('#rProv') == '823,02' and p.inner_text('#rArred') == '0,98' and p.inner_text('#rTotal') == 'R$ 824,00', f'os totais e o arredondamento ({p.inner_text("#rProv")}, {p.inner_text("#rArred")}, {p.inner_text("#rTotal")})')
        ok(p.inner_text('#rExtenso') == '(oitocentos e vinte e quatro reais)', 'o total por extenso')
        p.click('#rSalvar')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        r = recibos_de(p, 'f1')
        ok(len(r) == 1 and r[0]['total'] == 824 and r[0]['arredondamento'] == 0.98 and r[0]['periodo_de'] == '2026-10-19' and r[0]['tipo'] == 'mensal' and r[0]['nome'] == 'FUNCIONÁRIA DE TESTE',
           f'grava o recibo com o total, o arredondamento e o período ({r and {k: r[0][k] for k in ("total", "arredondamento", "periodo_de")}})')
        ok(r and [(i['ev'], i['v']) for i in r[0]['itens']] == [('horas', 73656), ('dsr', 6135), ('he50', 2511)], f'as linhas com o valor de cada uma ({r and r[0]["itens"]})')
        ok('Folha mensal' in p.inner_text('.fp-func[data-id="f1"]') and 'R$ 824,00' in p.inner_text('.fp-func[data-id="f1"]'), 'o recibo aparece na lista')
        ok('2 recibos, total de R$ 1.561,00' in p.inner_text('#resumo'), f'o resumo do mês soma ({p.inner_text("#resumo")!r})')

        print('3. Quem recebe por mês: o adiantamento do mês entra sozinho')
        p.select_option('.fp-func[data-id="f2"] select.fp-novo', 'mensal')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        evs = p.eval_on_selector_all('#rLinhas tr[data-i]', 'els => els.map(e => e.querySelector(".fp-ev").textContent)')
        ok(evs == ['Salário', 'Horas extras 50%', 'Faltas', 'Adiantamento'], f'as linhas de quem recebe por mês ({evs})')
        ok(p.input_value('#rLinhas [data-q="0"]') == '30' and p.input_value('#rLinhas [data-q="3"]') == '737,00', 'os 30 dias e o adiantamento de 737,00')
        ok('Recibo de adiantamento de Outubro de 2026: R$ 737,00' in linha_ed(p, 3).inner_text(), 'de onde veio o adiantamento')
        ok(p.inner_text('#rTotal') == 'R$ 1.105,00', f'1.842,00 menos 737,00 ({p.inner_text("#rTotal")})')
        p.click('#rSalvarImprimir')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        salvo = p.evaluate('() => window.__pdfSalvo')
        textos = ' | '.join(p.evaluate('() => window.__pdfTextos'))
        ok(salvo == 'Recibo MENSALISTA DE TESTE Folha mensal 2026-10.pdf', f'"Salvar e imprimir" gera o PDF do recibo ({salvo!r})')
        ok('COMÉRCIO MODELO ME' in textos and 'MENSALISTA DE TESTE' in textos and 'Salário: R$ 1.842,00' in textos and 'Valor líquido   R$ 1.105,00' in textos and 'mil cento e cinco reais' in textos,
           'o PDF: a empresa, o funcionário, o salário, o líquido e o extenso')

        print('4. Abrir, mudar e o recibo repetido')
        id_f1 = recibos_de(p, 'f1')[0]['id']
        p.click(f'.fp-chip[data-id="{id_f1}"]')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        ok(p.input_value('#rLinhas [data-q="0"]') == '88:00' and p.input_value('#rLinhas [data-q="2"]') == '2:00', 'o recibo gravado volta com as horas')
        ok(not p.is_hidden('#rExcluir'), 'o gravado tem "Excluir"')
        p.fill('#rLinhas [data-q="2"]', '3:00')
        ok(p.inner_text('#rTotal') == 'R$ 836,00', f'mudar a extra refaz a conta ({p.inner_text("#rTotal")})')
        p.click('#rSalvar')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        ok(recibo(p, id_f1)['total'] == 836 and len(recibos_de(p, 'f1')) == 1, 'grava no mesmo recibo')
        p.select_option('.fp-func[data-id="f1"] select.fp-novo', 'mensal')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        ok('Já tem folha mensal de Outubro de 2026 pra FUNCIONÁRIA DE TESTE: R$ 836,00.' in p.inner_text('#rAviso'), f'o aviso do repetido ({p.inner_text("#rAviso")!r})')
        p.fill('#rLinhas [data-q="0"]', '10')
        resposta['aceitar'] = False
        p.click('#rSalvar')
        p.wait_for_timeout(200)
        ok(any('Fazer outro mesmo assim' in d for d in dialogos) and len(recibos_de(p, 'f1')) == 1 and p.is_visible('#ovRec'), 'o repetido pergunta antes, e "não" não grava')

        print('5. O que impede gravar e o fechar com mudança')
        p.fill('#rLinhas [data-q="0"]', '8:75')
        p.click('#rSalvar')
        ok(p.inner_text('#rErro') == 'Confira "Horas normais": as horas vão como 8:30 ou 8,5.', f'as horas ilegíveis ({p.inner_text("#rErro")!r})')
        p.fill('#rLinhas [data-q="0"]', '')
        p.click('#rSalvar')
        ok(p.inner_text('#rErro').startswith('O recibo está sem valor'), f'o recibo sem valor ({p.inner_text("#rErro")!r})')
        dialogos.clear()
        p.keyboard.press('Escape')
        p.wait_for_timeout(150)
        ok(any('Fechar sem salvar' in d for d in dialogos) and p.is_visible('#ovRec'), 'o Esc com mudança pergunta, e "não" fica')
        resposta['aceitar'] = True
        p.click('#rCancelar')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        ok(len(recibos_de(p, 'f1')) == 1, 'fechar sem salvar não grava')

        print('6. O funcionário')
        p.click('#btnNovoFunc'); p.wait_for_selector('#ovFunc.is-open', timeout=3000)
        p.fill('#fNome', 'novo de teste')
        p.click('#fSalvar')
        ok(p.inner_text('#fErro') == 'Informe o valor da hora.', f'sem o valor não grava ({p.inner_text("#fErro")!r})')
        p.select_option('#fTipoValor', 'mes')
        ok(p.inner_text('#fValorRot') == 'Salário do mês (R$) *', 'por mês, o campo pede o salário')
        p.select_option('#fTipoValor', 'hora')
        p.fill('#fValor', '10,50'); p.fill('#fAdmissao', '2026-10-26')
        p.click('#fSalvar')
        p.wait_for_selector('#ovFunc:not(.is-open)', state='attached', timeout=3000)
        novo = p.evaluate("() => window.__mockDb.folha_funcionarios.find(f => f.nome === 'novo de teste')")
        ok(novo and novo['valor'] == 10.5 and novo['cliente_id'] == 'c1' and novo['horas_semana'] == 44, f'cadastra com o valor e as 44 horas ({novo})')
        ok('novo de teste' in p.inner_text('#lista') and 'R$ 10,50 por hora' in p.inner_text('#lista'), 'aparece na lista do mês')
        dialogos.clear()
        p.click('#btnNovoFunc'); p.wait_for_selector('#ovFunc.is-open', timeout=3000)
        p.fill('#fNome', 'Funcionária de Teste'); p.fill('#fValor', '9')
        resposta['aceitar'] = False
        p.click('#fSalvar'); p.wait_for_timeout(150)
        ok(any('Já tem um funcionário com esse nome' in d for d in dialogos) and p.is_visible('#ovFunc'), 'o nome repetido (sem acento e maiúscula) pergunta')
        resposta['aceitar'] = True
        p.click('#fCancelar')
        p.click('.fp-nome[data-id="f1"]'); p.wait_for_selector('#ovFunc.is-open', timeout=3000)
        ok(p.is_hidden('#fExcluir') and 'Outubro de 2026 · Folha mensal' in p.inner_text('#fHist'), 'quem tem recibo: sem "Excluir", com os recibos dele')
        p.fill('#fFuncao', 'Auxiliar de produção')
        p.click('#fSalvar'); p.wait_for_selector('#ovFunc:not(.is-open)', state='attached', timeout=3000)
        ok(p.evaluate("() => window.__mockDb.folha_funcionarios.find(f => f.id === 'f1').funcao") == 'Auxiliar de produção', 'editar grava')
        id_novo = novo['id']
        p.click(f'.fp-nome[data-id="{id_novo}"]'); p.wait_for_selector('#ovFunc.is-open', timeout=3000)
        ok(not p.is_hidden('#fExcluir'), 'quem não tem recibo pode ser excluído')
        p.click('#fExcluir'); p.wait_for_selector('#ovFunc:not(.is-open)', state='attached', timeout=3000)
        ok(p.evaluate(f"() => !window.__mockDb.folha_funcionarios.some(f => f.id === '{id_novo}')") and 'novo de teste' not in p.inner_text('#lista'), 'excluído')

        print('7. Imprimir os recibos do mês')
        rot = p.inner_text('#btnImprimirMes')
        ok(rot == 'Imprimir os 3 recibos de outubro', f'o botão diz quantos ({rot!r})')
        p.click('#btnImprimirMes')
        salvo = p.evaluate('() => window.__pdfSalvo')
        textos = p.evaluate('() => window.__pdfTextos')
        ok(salvo == 'Recibos COMERCIO MODELO ME 2026-10.pdf' and p.evaluate('() => window.__pdfPaginas') == 2, f'o PDF do mês: três recibos, duas páginas ({salvo!r})')
        nomes = [t for t in textos if t in ('FUNCIONÁRIA DE TESTE', 'MENSALISTA DE TESTE')]
        ok(nomes[:1] == ['FUNCIONÁRIA DE TESTE'] and 'Adiantamento salarial' in textos, f'pelo nome, o adiantamento antes da folha ({nomes[:4]})')
        p.check('#duasVias'); p.click('#btnImprimirMes')
        ok(p.evaluate('() => window.__pdfPaginas') == 3 and 'Via do funcionário' in p.evaluate('() => window.__pdfTextos'), 'duas vias: seis recibos, três páginas')
        p.uncheck('#duasVias')

        print('8. Os meses e o endereço')
        p.click('#mesAntes')
        ok(p.input_value('#competencia') == '2026-09', 'o mês anterior')
        ids = p.eval_on_selector_all('#lista .fp-func', 'els => els.map(e => e.dataset.id)')
        ok(ids == ['f2', 'f3'], f'em setembro: quem estava, e quem saiu no meio dele ({ids})')
        ok('nenhum recibo em Setembro de 2026 ainda' in p.inner_text('#resumo') and p.is_disabled('#btnImprimirMes'), 'sem recibo no mês, nada a imprimir')
        p.goto(base + 'dp-folha.html?cliente=c1&competencia=2026-10')
        p.wait_for_selector('#lista .fp-func', timeout=5000)
        ok(p.inner_text('#empNome') == 'COMÉRCIO MODELO ME' and p.input_value('#competencia') == '2026-10', 'o endereço abre a empresa e o mês')

        print('9. Texto de fora')
        p.fill('#busca', 'EMPRESA EXEMPLO')
        p.click('#sugestoes button[data-id="c2"]')
        p.wait_for_selector('#lista .fp-func', timeout=5000)
        ok(p.evaluate('() => window.__pego') is None and p.locator('#lista img').count() == 0 and '<img src=x' in p.inner_text('#lista'), 'o nome com <img onerror> aparece como texto')

        print('10. O card no DP')
        p.goto(base + 'dp.html')
        p.wait_for_function("() => { const el = document.querySelector('.card-status[data-mod=\"dp-folha.html\"]'); return el && el.textContent !== '·'; }", timeout=5000)
        badge = p.text_content('.card-status[data-mod="dp-folha.html"]')
        ok(badge == '3 funcionários', f'o card da Folha de pagamento ({badge!r})')

        print('11. A insalubridade')
        p.goto(base + 'dp-folha.html?cliente=c1&competencia=2026-10')
        p.wait_for_selector('#lista .fp-func', timeout=5000)
        p.click('#btnNovoFunc'); p.wait_for_selector('#ovFunc.is-open', timeout=3000)
        ok(p.input_value('#fInsal') == '0' and 'vem sozinha no recibo do mês' in p.inner_text('#fInsalDica'), f'o funcionário novo começa sem insalubridade ({p.inner_text("#fInsalDica")!r})')
        p.fill('#fNome', 'INSALUBRE DE TESTE'); p.select_option('#fTipoValor', 'mes'); p.fill('#fValor', '1.800,00'); p.fill('#fAdmissao', '2026-10-19')
        p.select_option('#fInsal', '20')
        dica = p.inner_text('#fInsalDica')
        ok('20% de R$ 1.621,00 (o salário mínimo de 2026) = R$ 324,20 por mês' in dica, f'o grau diz quanto dá no mês ({dica!r})')
        p.click('#fSalvar'); p.wait_for_selector('#ovFunc:not(.is-open)', state='attached', timeout=3000)
        f4 = p.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.folha_funcionarios.find(f => f.nome === 'INSALUBRE DE TESTE')))")
        ok(f4 and f4['insalubridade'] == 20 and f4['valor'] == 1800, f'grava o grau no cadastro ({f4 and f4.get("insalubridade")})')
        ok('insalubridade 20%' in p.inner_text(f'.fp-func[data-id="{f4["id"]}"]'), 'a lista mostra o grau')
        p.select_option(f'.fp-func[data-id="{f4["id"]}"] select.fp-novo', 'mensal')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        evs = p.eval_on_selector_all('#rLinhas tr[data-i]', 'els => els.map(e => e.querySelector(".fp-ev").textContent)')
        ok(evs == ['Salário', 'Insalubridade 20%', 'Horas extras 50%', 'Faltas'], f'a linha da insalubridade vem sozinha, logo depois do salário ({evs})')
        ok(p.input_value('#rLinhas [data-q="0"]') == '13' and p.input_value('#rLinhas [data-q="1"]') == '13', 'os 13 dias do período nas duas')
        ok(linha_ed(p, 0).locator('td.fp-num').inner_text() == '780,00' and linha_ed(p, 1).locator('td.fp-num').inner_text() == '140,49', 'o salário (780,00) e a insalubridade de 13 dias (324,20 × 13 ÷ 30 = 140,49)')
        ok('Dias do período: 13 · 20% do salário mínimo (R$ 1.621,00)' in linha_ed(p, 1).inner_text(), f'de onde vem a insalubridade ({linha_ed(p, 1).inner_text()!r})')
        ok('insalubridade 20%' in p.inner_text('#rBaseTxt'), f'a base do recibo mostra o grau ({p.inner_text("#rBaseTxt")!r})')
        p.fill('#rLinhas [data-q="2"]', '2'); p.click('#rTitulo')
        ok(linha_ed(p, 2).locator('td.fp-num').inner_text() == '28,97', f'a extra com o adicional: (1.800 + 324,20) ÷ 220 × 1,5 × 2 = 28,97 ({linha_ed(p, 2).locator("td.fp-num").inner_text()})')
        ok(p.inner_text('#rProv') == '949,46' and p.inner_text('#rTotal') == 'R$ 950,00', f'os totais ({p.inner_text("#rProv")}, {p.inner_text("#rTotal")})')
        opcoes = p.eval_on_selector_all('#rAdd option', 'els => els.map(e => e.value)')
        ok(opcoes.index('insalubridade') == opcoes.index('salario') + 1, 'a insalubridade também está em "+ Pôr outro evento…", logo depois do salário')
        p.click('#rSalvarImprimir')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        r4 = recibos_de(p, f4['id'])
        ok(len(r4) == 1 and r4[0]['insalubridade'] == 20 and [(i['ev'], i['v']) for i in r4[0]['itens']] == [('salario', 78000), ('insalubridade', 14049), ('he50', 2897)] and r4[0]['total'] == 950,
           f'grava o grau e as linhas com o valor de cada uma ({r4 and (r4[0].get("insalubridade"), r4[0]["itens"])})')
        textos = ' | '.join(p.evaluate('() => window.__pdfTextos'))
        ok('Insalubridade 20%' in textos and '13 dias' in textos and '140,49' in textos and '28,97' in textos, 'o PDF tem a linha "Insalubridade 20%" com os 13 dias')
        p.click(f'.fp-chip[data-id="{r4[0]["id"]}"]')
        p.wait_for_selector('#ovRec.is-open', timeout=3000)
        p.click('#rBaseMudar')
        ok(p.input_value('#rInsal') == '20', 'o recibo gravado volta com o grau dele')
        p.select_option('#rInsal', '0')
        evs = p.eval_on_selector_all('#rLinhas tr[data-i]', 'els => els.map(e => e.querySelector(".fp-ev").textContent)')
        ok('Insalubridade' not in ' '.join(evs) and linha_ed(p, 1).locator('td.fp-num').inner_text() == '24,55', f'sem grau neste recibo, a linha sai e a extra fica sem o adicional ({evs}, {linha_ed(p, 1).locator("td.fp-num").inner_text()})')
        p.select_option('#rInsal', '40')
        evs = p.eval_on_selector_all('#rLinhas tr[data-i]', 'els => els.map(e => e.querySelector(".fp-ev").textContent)')
        ok(evs[:2] == ['Salário', 'Insalubridade 40%'] and linha_ed(p, 1).locator('td.fp-num').inner_text() == '280,97', f'com 40%, a linha volta depois do salário (648,40 × 13 ÷ 30 = 280,97) ({evs}, {linha_ed(p, 1).locator("td.fp-num").inner_text()})')
        p.click('#rCancelar')
        p.wait_for_selector('#ovRec:not(.is-open)', state='attached', timeout=3000)
        ok(recibos_de(p, f4['id'])[0]['insalubridade'] == 20, 'cancelar não muda o recibo gravado')

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
