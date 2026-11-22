"""
Escala 6x1 (DP, 09/11/2026, pedido do Diego e da Vitória) — o fim da escala 6x1 pela EC 141/2026. Sem login e sem
banco (o mock do conferir.py, com três empresas inventadas e a jornada delas semeada só neste teste). O relógio fica
parado em 09/11/2026. O jsPDF do CDN fica de fora: entra um dublê que anota o que a tela manda escrever.

    python tests/harness/jornada-6x1.py

Confere:
  1. as datas (16/12/2026 e 16/12/2027, com os dias que faltam) e os números dos filtros;
  2. a lista pela urgência: a empresa em 6x1 primeiro, com quantos mudam, as horas e os dias-pessoa a menos;
  3. a ficha: o guia (o retrato, o simulador, o plano), os grupos do Domínio, o que muda nas duas datas, o simulador
     (contratar, hora extra, reduzir) e trocar a data refaz a conta;
  3b. as escalas que cabem (21/11/2026): as turmas que mudam, as opções de cada uma na data do simulador, a grade
     (quem folga em cada dia, quantos ficam e hoje), o "Pôr na escolha do plano" (entra, troca a da mesma turma, junta
     a da outra, não repete e não passa das 300 letras), a convenção marcada e o que está digitado no plano seguindo
     na tela quando ela se redesenha; e (22/11/2026) uma opção por linha, sem vazio ao lado, com a grade à esquerda e
     os dias alinhados de uma opção pra outra, e no celular uma embaixo da outra;
  4. gravar o plano: a linha em jornada_planos, com a simulação, e a situação na lista;
  5. o relatório pra empresa (PDF): as seções, com as escalas, sem a observação interna;
  6. a empresa sem jornada no Domínio: digitar o grupo, simular e gravar (os grupos ficam no plano), as escalas do
     grupo digitado (os dias são suposição, e vem dito) e o 12x36 digitado, que segue 12x36 depois de gravado;
  7. o texto de fora entra como texto (o nome com <img onerror>, e a escala digitada com HTML);
  8. o card no DP: "1 empresa em 6x1";
  9. o cadastro da jornada no Domínio (21/11/2026): a jornada marcada 12x36 com horário de semana segue o horário
     (entra em quem muda e ganha as escalas), o horário sem as horas de cada dia sai como suposição, e os dois
     avisos ficam na tela (o retrato, o que muda, as escalas) e fora do relatório da empresa;
  10. os dias que o escritório informa (21/11/2026), quando o Domínio não os tem: o "Informar os dias" na linha da
     turma (os dias marcados e quantos cada pessoa trabalha, com a prévia), o que muda, as escalas e o relatório com
     esses dias, o plano gravado com eles, a lista acompanhando, o "Voltar aos dias do Domínio", o Esc que fecha só
     os dias, o grupo digitado com os dias informados e o card do DP contando com eles;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
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
    const cli = (id, nome, regime) => ({ id, nome_principal: nome, nome_fantasia: null, regime_tributario: regime, cidade: 'Três Coroas', tipo_pessoa: 'PJ', status: 'ativo', documento: '9999999999' + id.slice(1).padStart(4, '0') });
    v.clientes = [...(v.clientes || []), cli('j1', 'RESTAURANTE DE TESTE LTDA', 'Simples Nacional'), cli('j2', 'LOJA SEM JORNADA DE TESTE LTDA', 'Lucro Presumido'),
      cli('j3', '<img src=x onerror="window.__pego=1"> ESCRITÓRIO DE TESTE LTDA', 'Simples Nacional')];
    v.carteira_info = [...(v.carteira_info || []).filter(c => !['j1', 'j2', 'j3'].includes(c.cliente_id)),
      { cliente_id: 'j1', entrada: '2020-01-01', saida: null }, { cliente_id: 'j2', entrada: '2021-01-01', saida: null }, { cliente_id: 'j3', entrada: '2022-01-01', saida: null }];
    const g = (cliente_id, extra) => ({ codigo: 1, cliente_id, jornada: 10, tipo: 1, tipo_escala: 0, horas_mes: 220, forma: 1, controle: 1, categoria: 101, unidade: 5, afastados: 0, compensa_sabado: 0, superior: 0, superior_teto: 0, dados_ate: '2026-11-09', ...extra });
    v.dominio_jornadas = [
      g('j1', { semana: 'TTTTTTF', min_semana: 2640, min_maior_dia: 440, horas_semana: 44, empregados: 5, salarios: 10000 }),
      g('j1', { jornada: 11, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 528, horas_semana: 44, empregados: 3, salarios: 7500, compensa_sabado: 3 }),
      g('j3', { semana: 'TTTTTFF', min_semana: 2400, min_maior_dia: 480, horas_semana: 40, empregados: 2, salarios: 6000 }),
    ];
    v.dominio_mensal = [...(v.dominio_mensal || []), { cliente_id: 'j2', codigo: 2, competencia: '2026-10', funcionarios_ativos: 4 }];
    v.jornada_planos = [];
    if (typeof window.__j6Extra === 'function') window.__j6Extra(v, g, cli);
  } });
})();
"""
# a quarta empresa, só no cenário 9 (não muda as contas dos outros): uma jornada marcada 12x36 no Domínio com horário
# de semana, e uma com o horário sem as horas de cada dia (a ponte manda a semana sem os minutos)
EXTRA = """
window.__j6Extra = (v, g, cli) => {
  v.clientes.push(cli('j4', 'POUSADA DE TESTE LTDA', 'Simples Nacional'));
  v.carteira_info.push({ cliente_id: 'j4', entrada: '2023-01-01', saida: null });
  v.dominio_jornadas.push(
    g('j4', { codigo: 4, jornada: 21, tipo: 2, tipo_escala: 1, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 540, horas_semana: 44, empregados: 4, salarios: 9000 }),
    g('j4', { codigo: 4, jornada: 22, semana: 'TTTTTTT', min_semana: null, min_maior_dia: null, horas_semana: 44, empregados: 3, salarios: 6600 }));
  // o plano da j4 com os dias da jornada 22 informados (só no teste do card do DP)
  if (window.__j6PlanoJ4) v.jornada_planos.push({ cliente_id: 'j4', situacao: 'a_conversar', simulacao: { etapa: 'e42', dias: { '4:22': { semana: 'TTTTTTF', dias: 6 } } } });
};
"""
DUBLE_PDF = r"""
window.__pdfTextos = []; window.__pdfSalvo = null;
(() => {
  class Doc {
    constructor(){ window.__pdfTextos = []; }
    text(t){ (Array.isArray(t) ? t : [t]).forEach(s => window.__pdfTextos.push(String(s))); return this; }
    splitTextToSize(t){ return [String(t)]; }
    addPage(){ return this; }
    save(nome){ window.__pdfSalvo = nome; return this; }
  }
  for (const m of ['line', 'setFont', 'setFontSize', 'setTextColor', 'setDrawColor']) Doc.prototype[m] = function () { return this; };
  Object.defineProperty(window, 'jspdf', { value: { jsPDF: Doc }, writable: false });
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def plano(p, cid):
    return p.evaluate("id => { const r = window.__mockDb.jornada_planos.find(x => x.cliente_id === id); return r ? JSON.parse(JSON.stringify(r)) : null; }", cid)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.on('dialog', lambda d: d.accept())
        p.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(DUBLE_PDF)
        p.clock.set_fixed_time('2026-11-09T12:00:00')

        print('1. As datas e os filtros')
        p.goto(base + 'dp-jornada.html')
        p.wait_for_selector('#lista tr[data-id]', timeout=8000)
        datas = p.inner_text('#datas')
        ok('16/12/2026' in datas and 'faltam 37 dias' in datas and '16/12/2027' in datas, f'as duas datas e os dias que faltam ({datas!r})')
        nums = {b_: p.inner_text(f'#focos [data-foco="{b_}"] .fc-num') for b_ in ('seis', 'horas', 'sem', 'plano', 'todas')}
        ok(nums == {'seis': '1', 'horas': '1', 'sem': '1', 'plano': '0', 'todas': '3'}, f'os filtros ({nums})')

        print('2. A lista pela urgência')
        ids = p.eval_on_selector_all('#lista tr[data-id]', 'els => els.map(e => e.dataset.id)')
        ok(ids[0] == 'j1', f'a empresa em 6x1 primeiro ({ids})')
        linha = p.inner_text('#lista tr[data-id="j1"]')
        ok('5 em 6x1' in linha and '3 em 5x2 com o sábado compensado' in linha and '8 mudam' in linha and '16 h/semana a menos' in linha and '5 dia(s)-pessoa a menos' in linha,
           f'quantos mudam, as horas e os dias-pessoa ({linha!r})')
        ok('nada a mudar' in p.inner_text('#lista tr[data-id="j3"]'), 'a de 40 h em 5 dias: nada a mudar')

        print('3. A ficha')
        p.click('#lista tr[data-id="j1"]')
        p.wait_for_selector('#fichaTitulo', timeout=3000)
        ok(p.inner_text('#fichaTitulo') == 'RESTAURANTE DE TESTE LTDA', 'abre a empresa')
        ok(p.locator('.j6-passo.is-agora').count() == 1 and '2. O simulador' in p.inner_text('.j6-passo.is-agora'), 'o guia: o retrato feito, o simulador agora')
        ok(p.locator('.j6-tab tbody tr').count() == 2, 'os dois grupos do Domínio')
        muda = p.inner_text('.j6-etapas')
        ok('16/12/2026: 42 h e 2 folgas' in muda and 'precisa cair pra 42 h' in muda and 'O dia mais longo tem 8h48: passar das 8h24' in muda and 'ADI 8.041' in muda, 'o que muda em 16/12/2026 (sem convenção, as 8h24 do STF)')
        saidas = p.inner_text('.j6-saidas')
        ok('1 pessoa' in saidas and 'R$' in saidas and '69,33 h/mês' in saidas and '16 h/semana' in saidas, f'o simulador ({saidas!r})')
        p.check('#sCct'); p.wait_for_timeout(200)
        ok('16 h/semana' in p.inner_text('.j6-saidas'), 'com a convenção, as mesmas 16 h a menos (2 por pessoa)')
        p.uncheck('#sCct'); p.wait_for_timeout(200)
        p.select_option('#sEtapa', 'e40'); p.wait_for_timeout(200)
        ok('32 h/semana' in p.inner_text('.j6-saidas') and p.input_value('#sEtapa') == 'e40', 'trocar a data refaz a conta')

        print('3b. As escalas que cabem')
        limpo = lambda t: ' '.join(t.split())
        sec = limpo(p.inner_text('#secEscalas'))
        ok('a partir de 16/12/2027' in sec and '5 dias de 8h · 40 h por semana' in sec and 'Cabe nas 8 horas por dia' in sec, 'na data de 16/12/2027: 5 dias de 8 h, 40 h por semana, cabendo nas 8 horas')
        p.select_option('#sEtapa', 'e42'); p.wait_for_timeout(200)
        turmas = p.eval_on_selector_all('#secEscalas .j6-turma', "els => els.map(e => [e.querySelector('h4').innerText.replace(/\\s+/g, ' ').trim(), [...e.querySelectorAll('.j6-opcao')].map(o => o.dataset.opcao)])")
        ok(turmas == [['6x1 · 5 pessoas jornada 10 · hoje, 44 h por semana, de segunda a sábado', ['seg_a_sex', 'folga_na_semana', 'sabado_alternado']],
                      ['5x2 com o sábado compensado · 3 pessoas jornada 11 · hoje, 44 h por semana, de segunda a sexta', ['mesmos_dias', 'dia_curto']]],
           f'as duas turmas que mudam em 16/12/2026, com as opções de cada uma ({turmas})')
        LER_GRADE = "t => [...t.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.classList.contains('f') ? 'folga' : c.classList.contains('t') ? 'T' : c.innerText.trim()))"
        grade = p.eval_on_selector('#secEscalas .j6-opcao[data-opcao="folga_na_semana"] .j6-grade', LER_GRADE)
        ok(len(grade) == 7 and grade[0] == ['Pessoa 1', 'folga', 'T', 'T', 'T', 'T', 'T', 'folga'] and grade[4] == ['Pessoa 5', 'T', 'T', 'T', 'T', 'folga', 'T', 'folga']
           and grade[5] == ['Ficam', '4', '4', '4', '4', '4', '5', '—'] and grade[6] == ['Hoje', '5', '5', '5', '5', '5', '5', '—'],
           f'a folga no meio da semana: uma folga pra cada um, ficam 4 de segunda a sexta e 5 no sábado, contra 5 hoje ({grade[5:]})')
        grade = p.eval_on_selector('#secEscalas .j6-opcao[data-opcao="sabado_alternado"] .j6-grade', LER_GRADE)
        ok([g for g in grade if g[0] in ('Semana 1', 'Semana 2', 'Ficam')] == [['Semana 1'], ['Ficam', '3', '5', '5', '5', '5', '2', '—'], ['Semana 2'], ['Ficam', '2', '5', '5', '5', '5', '3', '—']]
           and grade[1] == ['Turma A (3)', 'T', 'T', 'T', 'T', 'T', 'folga', 'folga'], f'o sábado sim, sábado não: as duas semanas, 3 e 2 trocando ({grade})')
        cartao = limpo(p.inner_text('#secEscalas .j6-opcao[data-opcao="seg_a_sex"]'))
        ok('5 dias de 8h24 · 42 h por semana' in cartao and 'Até 8h24 por dia sem convenção nem acordo coletivo' in cartao and 'ADI 8.041' in cartao and 'Toda semana com 2 folgas e no máximo 5 dias seguidos de trabalho.' in cartao
           and 'A turma deixa de trabalhar no sábado.' in cartao, 'cada opção diz o horário, as garantias e o que exige (as 8h24 do STF)')
        ok('Passa das 8h24 por dia: só com convenção ou acordo coletivo.' in p.inner_text('#secEscalas .j6-opcao[data-opcao="dia_curto"]'), 'a de 4 dias de 8h48 e 1 de 6h48 pede convenção ou acordo')
        gerais = p.inner_text('#secEscalas .j6-gerais')
        ok(all(t in gerais for t in ['CLT, art. 71, § 2º', 'Em 16/12/2027 o limite cai pra 40 horas', 'item IV', 'TST, OJ 410 da SDI-1']) and 'Lei 10.101/2000' not in gerais,
           'as notas das turmas embaixo, uma vez: o intervalo, 2027, a convenção e os dias seguidos (sem a do domingo: ninguém trabalha no domingo)')
        # 22/11/2026: uma opção por linha, sem vazio ao lado (em duas colunas, a terceira opção ficava sozinha); larga, a
        # grade à esquerda e o resto à direita, com os dias de uma opção embaixo dos da outra; no celular, uma embaixo da outra
        LAYOUT = """() => [...document.querySelectorAll('#secEscalas .j6-opcoes')].map(box => {
          const r = box.getBoundingClientRect();
          return [...box.querySelectorAll(':scope > .j6-opcao')].map(c => {
            const q = c.getBoundingClientRect(), g = c.querySelector('.j6-op-grade').getBoundingClientRect(), f = c.querySelector('.j6-op-info').getBoundingClientRect();
            const rola = c.querySelector('.j6-rola');
            return { cheia: Math.abs(q.width - r.width) < 1 && Math.abs(q.left - r.left) < 1, lado: g.right <= f.left, embaixo: g.bottom <= f.top,
                     seg: Math.round(c.querySelectorAll('.j6-grade thead th')[1].getBoundingClientRect().left), rola: rola.scrollWidth > rola.clientWidth + 1 };
          });
        })"""
        lay = p.evaluate(LAYOUT)
        ok([len(t) for t in lay] == [3, 2] and all(o['cheia'] and o['lado'] and not o['rola'] for t in lay for o in t) and all(len({o['seg'] for o in t}) == 1 for t in lay),
           f'uma opção por linha, sem vazio ao lado: a grade à esquerda e o resto à direita, os dias de uma opção embaixo dos da outra ({lay})')
        p.set_viewport_size({'width': 400, 'height': 900}); p.wait_for_timeout(200)
        lay = p.evaluate(LAYOUT)
        ok(all(o['cheia'] and o['embaixo'] and not o['rola'] for t in lay for o in t) and p.evaluate("() => { const e = document.querySelector('#painel'); return e.scrollWidth <= e.clientWidth + 1; }"),
           f'no celular, a grade em cima e o resto embaixo, sem rolar de lado ({lay})')
        p.set_viewport_size({'width': 1400, 'height': 900}); p.wait_for_timeout(200)
        eco = lambda op: p.inner_text(f'#secEscalas .j6-opcao[data-opcao="{op}"] .j6-eco')
        p.click('#secEscalas .j6-opcao[data-opcao="seg_a_sex"] [data-escolha]')
        ok(p.input_value('#pEscolha') == '6x1 (5 pessoas): segunda a sexta, 5 dias de 8h24' and 'Falta gravar o plano' in eco('seg_a_sex'), f'"Pôr na escolha do plano" escreve a opção na escolha ({p.input_value("#pEscolha")!r})')
        p.click('#secEscalas .j6-opcao[data-opcao="sabado_alternado"] [data-escolha]')
        ok(p.input_value('#pEscolha') == '6x1 (5 pessoas): sábado sim, sábado não, 5 dias de 8h24' and 'Trocada' in eco('sabado_alternado') and eco('seg_a_sex') == '', 'outra opção da mesma turma troca a de antes')
        p.click('#secEscalas .j6-opcao[data-opcao="mesmos_dias"] [data-escolha]')
        juntas = '6x1 (5 pessoas): sábado sim, sábado não, 5 dias de 8h24; 5x2 com o sábado compensado (3 pessoas): os mesmos dias de hoje, com o dia mais curto, 5 dias de 8h24'
        ok(p.input_value('#pEscolha') == juntas, f'a da outra turma entra junto ({p.input_value("#pEscolha")!r})')
        p.click('#secEscalas .j6-opcao[data-opcao="mesmos_dias"] [data-escolha]')
        ok(p.input_value('#pEscolha') == juntas and 'Já está' in eco('mesmos_dias'), 'a mesma opção de novo não repete')
        p.fill('#pObs', 'RASCUNHO DE TESTE')
        p.check('#sCct'); p.wait_for_timeout(200)
        ok('vale pela convenção' in p.inner_text('#secEscalas .j6-opcao[data-opcao="seg_a_sex"]') and p.input_value('#pEscolha') == juntas and p.input_value('#pObs') == 'RASCUNHO DE TESTE',
           'com a convenção marcada, as 8h24 valem por ela, e o que estava digitado no plano segue na tela')
        p.uncheck('#sCct'); p.wait_for_timeout(200)
        p.fill('#pEscolha', 'x' * 280)
        p.click('#secEscalas .j6-opcao[data-opcao="seg_a_sex"] [data-escolha]')
        ok(p.input_value('#pEscolha') == 'x' * 280 and 'Não coube' in eco('seg_a_sex'), 'o que passa das 300 letras não entra, e a tela diz')
        p.select_option('#sEtapa', 'e40'); p.wait_for_timeout(200)

        print('4. Gravar o plano')
        p.select_option('#pSituacao', 'definido')
        p.select_option('#pResp', 'Vitória')
        p.fill('#pEscolha', '5x2 de segunda a sexta, 8 h por dia')
        p.fill('#pObs', 'NOTA INTERNA DE TESTE')
        p.click('#pGravar'); p.wait_for_timeout(500)
        pl = plano(p, 'j1')
        ok(pl and pl['situacao'] == 'definido' and pl['responsavel'] == 'Vitória' and pl['simulacao']['etapa'] == 'e40' and pl['simulacao']['grupos'] == [] and pl['simulacao']['salario'] is None,
           f'a linha em jornada_planos ({pl})')
        ok('Plano gravado' in p.inner_text('#pMsg') and '✓ O plano' in p.inner_text('.j6-passos'), 'o aviso e o guia com o plano feito')

        print('5. O relatório pra empresa')
        p.click('#pPdf'); p.wait_for_timeout(300)
        nome = p.evaluate('window.__pdfSalvo'); textos = ' '.join(p.evaluate('window.__pdfTextos'))
        ok(nome == 'Escala 6x1 - RESTAURANTE DE TESTE LTDA.pdf', f'o arquivo ({nome})')
        ok(all(t in textos for t in ['O que diz a lei', 'Como a empresa está hoje', 'O que foi combinado', '5x2 de segunda a sexta', 'Os próximos passos']), 'as seções e a escolha')
        ok(all(t in textos for t in ['As escalas que cabem a partir de 16/12/2027', '6x1 (5 pessoas): hoje, de segunda a sábado', 'Opção 1: Segunda a sexta', '5 dias de 8h, 40 horas por semana.', 'Turma A (3 pessoas)', 'Ficam',
                                     '(as opções acima são o ponto de partida)']), 'as escalas que cabem, na data do simulador, com a grade de cada opção')
        ok('NOTA INTERNA DE TESTE' not in textos, 'a observação interna fica fora do PDF')
        p.click('#fechar')
        ok('Definido com a empresa' in p.inner_text('#lista tr[data-id="j1"]'), 'a situação na lista')

        print('6. A empresa sem jornada no Domínio')
        p.click('#lista tr[data-id="j2"]'); p.wait_for_selector('#gIncluir', timeout=3000)
        ok('1. O retrato' in p.inner_text('.j6-passo.is-agora'), 'o guia começa pelo retrato')
        p.select_option('#gEscala', '6x1'); p.fill('#gHoras', '44'); p.fill('#gPessoas', '4'); p.fill('#gSalario', '2000')
        p.click('#gIncluir'); p.wait_for_timeout(200)
        ok('Grupo incluído' in p.inner_text('#pMsg'), 'o aviso de que o grupo entrou e falta gravar')
        saidas = p.inner_text('.j6-saidas')
        ok('1 pessoa' in saidas and '3.244,11' in saidas, f'o simulador com o grupo digitado (fora do Simples: R$ 3.244,11 por pessoa) ({saidas!r})')
        sec = ' '.join(p.inner_text('#secEscalas').split())
        ok('6x1 · 4 pessoas' in sec and 'de segunda a sábado (suposição: o grupo foi digitado sem os dias)' in sec and p.locator('#secEscalas .j6-opcao').count() == 3,
           'as escalas do grupo digitado: três opções, com os dias de hoje ditos como suposição')
        p.click('#pGravar'); p.wait_for_timeout(500)
        pl = plano(p, 'j2')
        ok(pl and len(pl['simulacao']['grupos']) == 1 and pl['simulacao']['grupos'][0]['escala'] == '6x1', f'os grupos ficam no plano ({pl and pl["simulacao"]})')
        p.select_option('#gEscala', '12x36'); p.fill('#gHoras', '42'); p.fill('#gPessoas', '2'); p.fill('#gSalario', '')
        p.click('#gIncluir'); p.wait_for_timeout(200)
        p.select_option('#sEtapa', 'e40'); p.wait_for_timeout(200)
        p.click('#pGravar'); p.wait_for_timeout(500)
        pl = plano(p, 'j2')
        retrato = p.eval_on_selector_all('.j6-tab tbody tr', 'els => els.map(e => e.children[0].innerText.trim())')
        ok(pl and len(pl['simulacao']['grupos']) == 2 and pl['simulacao']['grupos'][1].get('tipo_escala') == 1 and retrato == ['6x1', '12x36']
           and p.locator('#secEscalas .j6-turma').count() == 1, f'o 12x36 digitado segue 12x36 depois de gravado, e não entra nas turmas que mudam em 16/12/2027 ({retrato})')
        p.click('#fechar')
        ok('(digitado)' in p.inner_text('#lista tr[data-id="j2"]') and '4 em 6x1' in p.inner_text('#lista tr[data-id="j2"]') and '2 em 12x36' in p.inner_text('#lista tr[data-id="j2"]'), 'a lista mostra os grupos digitados')

        print('7. Texto de fora')
        ok(p.evaluate('window.__pego') is None and '<img' in p.inner_text('#lista tr[data-id="j3"]'), 'o nome com <img onerror> entra como texto')
        # a escala de um grupo digitado vem do plano gravado (um JSON do banco): com HTML dentro, entra como texto
        p.click('#lista tr[data-id="j2"]'); p.wait_for_selector('#gIncluir', timeout=3000)
        p.evaluate('''() => { const s = document.querySelector('#gEscala'), o = document.createElement('option'); o.value = '<img src=x onerror="window.__pego2=1">'; o.textContent = 'x'; s.append(o); s.value = o.value; }''')
        p.fill('#gHoras', '44'); p.fill('#gPessoas', '1'); p.click('#gIncluir'); p.wait_for_timeout(300)
        ok(p.evaluate('window.__pego2') is None and '<img' in p.inner_text('#secEscalas') and '<img' in p.inner_text('.j6-tab') and p.locator('#painel img').count() == 0,
           'a escala digitada com HTML entra como texto no retrato e nas escalas')
        p.click('#fechar')

        print('8. O card no DP')
        p.goto(base + 'dp.html'); p.wait_for_timeout(1500)
        card = p.locator('a.dashboard-card[href="dp-jornada.html"]')
        ok(card.count() == 1 and 'Escala 6x1' in card.inner_text() and '1 empresa em 6x1' in card.inner_text().lower(), f'o card ({card.inner_text() if card.count() else None!r})')

        print('9. O cadastro da jornada no Domínio')
        q = cx.new_page()
        q.on('pageerror', lambda e: erros.append(str(e)))
        q.route('**/cdnjs.cloudflare.com/**', lambda r: r.abort())
        q.add_init_script(TOUR); q.add_init_script(EXTRA); q.add_init_script(SEMEAR); q.add_init_script(DUBLE_PDF)
        q.clock.set_fixed_time('2026-11-09T12:00:00')
        q.goto(base + 'dp-jornada.html')
        q.wait_for_selector('#lista tr[data-id="j4"]', timeout=8000)
        linha = q.inner_text('#lista tr[data-id="j4"]')
        ok('4 em 5x2 com o sábado compensado' in linha and '3 em 7 dias com folga em rodízio' in linha and '7 mudam' in linha and '12x36' not in linha,
           f'na lista, a marcada 12x36 com horário de semana conta pelo horário, e as duas turmas mudam ({linha!r})')
        q.click('#lista tr[data-id="j4"]'); q.wait_for_selector('#fichaTitulo', timeout=3000)
        retrato = q.eval_on_selector_all('.j6-tab tbody tr', "els => els.map(e => e.children[0].innerText.replace(/\\s+/g, ' ').trim())")
        ok(retrato == ['5x2 com o sábado compensado · jornada 21 · marcada 12x36 no Domínio', '7 dias com folga em rodízio · jornada 22 · horário sem as horas no Domínio: dias a confirmar'],
           f'o retrato diz o que o cadastro tem de estranho ({retrato})')
        muda = limpo(q.inner_text('.j6-etapas'))
        ok(muda.count('No Domínio a jornada está marcada como 12x36, mas o horário cadastrado é de semana: a conta segue o horário.') == 2
           and muda.count('No Domínio o horário desta jornada está sem as horas de cada dia (a entrada igual à saída)') == 2 and 'precisa cair pra 42 h' in muda
           and 'A 12x36 dá a média' not in muda, 'o que muda, nas duas datas: os dois avisos do cadastro, e a turma marcada lida pelo horário (44 h pra 42 h)')
        turmas = q.eval_on_selector_all('#secEscalas .j6-turma', "els => els.map(e => [e.querySelector('h4').innerText.replace(/\\s+/g, ' ').trim(), [...e.querySelectorAll('.j6-opcao')].map(o => o.dataset.opcao), (e.querySelector('.j6-aviso > span') || {}).innerText || ''])")
        ok(len(turmas) == 2 and turmas[0] == ['5x2 com o sábado compensado · 4 pessoas jornada 21 · hoje, 44 h por semana, de segunda a sexta', ['mesmos_dias', 'dia_curto'], '']
           and turmas[1][:2] == ['7 dias com folga em rodízio · 3 pessoas jornada 22 · hoje, 44 h por semana', ['rodizio_3', 'rodizio_2']]
           and turmas[1][2] == 'No Domínio o horário desta turma está sem as horas de cada dia: as opções supõem os dias que estão lá (os 7 dias, com a folga em rodízio). Confirme os dias com a empresa antes de combinar.',
           f'as escalas das duas turmas, e o aviso de que as do horário sem as horas são suposição ({turmas})')
        q.click('#pPdf'); q.wait_for_timeout(300)
        textos = ' '.join(q.evaluate('window.__pdfTextos'))
        ok(all(t in textos for t in ['5x2 com o sábado compensado (4 pessoas)', 'precisa cair pra 42 h', '7 dias com folga em rodízio (3 pessoas)', 'Os 7 dias cobertos, com as folgas em rodízio de 3 semanas'])
           and not any(t in textos for t in ['marcada como 12x36', 'sem as horas de cada dia', 'Aviso do escritório', 'as opções supõem', 'tire a marca']),
           'o relatório da empresa segue o horário e não leva os avisos do cadastro')

        print('10. Os dias que o escritório informa')
        LER_RETRATO = "els => els.map(e => e.children[0].innerText.replace(/\\s+/g, ' ').trim())"
        ok(q.inner_text('#secEscalas .j6-turma:nth-child(2) .j6-aviso [data-dias]') == 'Informar os dias' and q.locator('#secEscalas .j6-turma:nth-child(1) [data-dias]').count() == 0
           and q.inner_text('.j6-tab [data-dias="1"]') == 'Informar os dias' and q.locator('.j6-tab [data-dias="0"]').count() == 0,
           'o "Informar os dias" só na turma que o Domínio não diz os dias (no retrato e no aviso das escalas)')
        ok('os dias que o Domínio não tem, informe na linha da turma' in q.inner_text('.j6-passos'), 'o guia diz pra informar os dias')
        q.click('#secEscalas .j6-turma:nth-child(2) .j6-aviso [data-dias]'); q.wait_for_timeout(200)
        lidos = lambda: q.eval_on_selector_all('#diasEd [data-dia]', "els => els.map(e => e.getAttribute('aria-pressed') === 'true' ? 'T' : 'F').join('')")
        ok(q.locator('#diasEd').count() == 1 and lidos() == 'TTTTTTT' and q.input_value('#dPorPessoa') == '6' and q.inner_text('#dFica') == 'Fica: 6x1 com a folga em rodízio, nos 7 dias.'
           and ' '.join(q.inner_text('#diasTit').split()) == 'Os dias da turma 7 dias com folga em rodízio · jornada 22 · 3 pessoas'
           and q.get_attribute('.j6-tab [data-dias="1"]', 'aria-expanded') == 'true' and q.evaluate("document.activeElement && document.activeElement.dataset.dia") == '0',
           f'o botão das escalas abre os dias no retrato: os 7 do Domínio, 6 por pessoa, com a prévia ({lidos()!r}, {q.inner_text("#dFica")!r})')
        q.click('#diasEd [data-dia="6"]')
        ok(q.inner_text('#dFica') == 'Fica: 6x1, de segunda a sábado.', f'sem o domingo: 6x1 de segunda a sábado ({q.inner_text("#dFica")!r})')
        for k in range(6): q.click(f'#diasEd [data-dia="{k}"]')
        ok(q.inner_text('#dFica') == 'Marque pelo menos um dia.' and q.is_disabled('#dUsar'), 'sem nenhum dia marcado, não dá pra usar')
        for k in range(4): q.click(f'#diasEd [data-dia="{k}"]')
        quatro = [q.input_value('#dPorPessoa'), q.eval_on_selector('#dPorPessoa option[value="5"]', 'o => o.disabled'), q.inner_text('#dFica')]
        ok(quatro == ['4', True, 'Fica: 4x3, de segunda a quinta.'], f'com 4 dias marcados, cada pessoa vai até 4 (o que passa vira 4) ({quatro})')
        for k in (4, 5): q.click(f'#diasEd [data-dia="{k}"]')
        q.select_option('#dPorPessoa', '6')
        q.keyboard.press('Escape'); q.wait_for_timeout(200)
        ok(q.locator('#diasEd').count() == 0 and not q.locator('#ov').is_hidden() and q.evaluate("document.activeElement && document.activeElement.dataset.dias") == '1',
           'o Esc dentro dos dias fecha só eles (a ficha fica, e o foco volta ao botão)')
        q.click('.j6-tab [data-dias="1"]'); q.wait_for_timeout(200)
        q.click('#diasEd [data-dia="6"]'); q.click('#dUsar'); q.wait_for_timeout(200)
        retrato = q.eval_on_selector_all('.j6-tab tbody tr', LER_RETRATO)
        ok(retrato == ['5x2 com o sábado compensado · jornada 21 · marcada 12x36 no Domínio', '6x1 · jornada 22 · dias informados aqui'] and q.inner_text('.j6-tab [data-dias="1"]') == 'Mudar os dias'
           and 'Grave o plano pra guardar' in q.inner_text('#rMsg') and 'os dias que o Domínio não tem' not in q.inner_text('.j6-passos'),
           f'usados os dias: o retrato diz "dias informados aqui", e o guia não pede mais ({retrato})')
        muda = limpo(q.inner_text('.j6-etapas'))
        ok(muda.count('Os dias desta turma são os informados aqui: no Domínio o horário da jornada está sem as horas de cada dia. Acertado o horário da jornada no Domínio, a conta volta a usar o de lá.') == 2
           and 'sem as horas de cada dia (a entrada igual à saída)' not in muda and 'Hoje folga 1 dia por semana' in muda, 'o que muda usa os dias informados, com o aviso do escritório')
        turmas = q.eval_on_selector_all('#secEscalas .j6-turma', "els => els.map(e => [e.querySelector('h4').innerText.replace(/\\s+/g, ' ').trim(), [...e.querySelectorAll('.j6-opcao')].map(o => o.dataset.opcao), (e.querySelector('.j6-informar') || {}).innerText || ''])")
        ok(turmas[1][0] == '6x1 · 3 pessoas jornada 22 · hoje, 44 h por semana, de segunda a sábado' and turmas[1][1] == ['seg_a_sex', 'folga_na_semana', 'sabado_alternado']
           and ' '.join(turmas[1][2].split()) == 'Os dias são os informados aqui. Mudar os dias' and q.locator('#secEscalas .j6-turma:nth-child(2) .j6-aviso').count() == 0,
           f'as escalas da turma com os dias informados: as de segunda a sábado, sem o aviso de suposição ({turmas[1]})')
        q.click('#pPdf'); q.wait_for_timeout(300)
        textos = ' '.join(q.evaluate('window.__pdfTextos'))
        ok('Pelo Domínio, em 09/11/2026; os dias de 1 turma, pelo que a empresa informou.' in textos and '6x1 (3 pessoas): hoje, de segunda a sábado (pelo que a empresa informou)' in textos
           and not any(t in textos for t in ['informados aqui', 'Aviso do escritório', 'sem as horas de cada dia']), 'o relatório diz que os dias vieram da empresa, sem o aviso do escritório')
        q.click('#pGravar'); q.wait_for_timeout(500)
        pl = plano(q, 'j4')
        ok(pl and pl['simulacao'].get('dias') == {'4:22': {'semana': 'TTTTTTF', 'dias': 6}} and pl['simulacao']['grupos'] == [], f'o plano guarda os dias pela jornada ({pl and pl["simulacao"]})')
        q.click('#fechar')
        linha = q.inner_text('#lista tr[data-id="j4"]')
        ok('3 em 6x1' in linha and '4 em 5x2 com o sábado compensado' in linha and '7 mudam' in linha, f'a lista acompanha os dias gravados ({linha!r})')
        q.click('#lista tr[data-id="j4"]'); q.wait_for_selector('#fichaTitulo', timeout=3000)
        ok(q.eval_on_selector_all('.j6-tab tbody tr', LER_RETRATO)[1] == '6x1 · jornada 22 · dias informados aqui', 'reaberta a ficha, os dias informados seguem')
        q.click('.j6-tab [data-dias="1"]'); q.wait_for_timeout(200)
        ok(lidos() == 'TTTTTTF' and q.input_value('#dPorPessoa') == '6' and q.inner_text('#dTirar') == 'Voltar aos dias do Domínio', 'o "Mudar os dias" abre com os informados e o "Voltar aos dias do Domínio"')
        q.click('#dTirar'); q.wait_for_timeout(200)
        ok(q.eval_on_selector_all('.j6-tab tbody tr', LER_RETRATO)[1] == '7 dias com folga em rodízio · jornada 22 · horário sem as horas no Domínio: dias a confirmar'
           and 'vale de novo o que o Domínio diz' in q.inner_text('#rMsg'), 'voltando aos dias do Domínio, a turma volta a ser a do Domínio')
        q.click('#fechar')
        # o grupo digitado (a empresa sem a jornada no Domínio): os dias dele ficam nele mesmo
        q.click('#lista tr[data-id="j2"]'); q.wait_for_selector('#gIncluir', timeout=3000)
        q.select_option('#gEscala', '6x1'); q.fill('#gHoras', '44'); q.fill('#gPessoas', '4'); q.click('#gIncluir'); q.wait_for_timeout(200)
        q.click('.j6-tab [data-dias="0"]'); q.wait_for_timeout(200)
        ok(lidos() == 'TTTTTTF' and q.input_value('#dPorPessoa') == '6' and q.locator('#dTirar').count() == 0, 'no digitado, os dias de partida são os da suposição (de segunda a sábado)')
        q.click('#diasEd [data-dia="0"]'); q.click('#diasEd [data-dia="6"]')
        ok(q.inner_text('#dFica') == 'Fica: 6x1, de terça a domingo.', 'de terça a domingo')
        q.click('#dUsar'); q.wait_for_timeout(200)
        sec = limpo(q.inner_text('#secEscalas'))
        ids = q.eval_on_selector_all('#secEscalas .j6-opcao', 'els => els.map(e => e.dataset.opcao)')
        ok('hoje, 44 h por semana, de terça a domingo' in sec and 'suposição' not in sec and ids == ['domingo_1_em_3', 'domingo_1_em_2', 'fecha_domingo'],
           f'as escalas do digitado com os dias informados: as de quem trabalha no domingo, sem a suposição ({ids})')
        q.click('#pGravar'); q.wait_for_timeout(500)
        pl = plano(q, 'j2')
        ok(pl and pl['simulacao']['grupos'][0].get('informado') == {'semana': 'FTTTTTT', 'dias': 6} and 'dias' not in pl['simulacao'], f'o digitado guarda os dias nele mesmo ({pl and pl["simulacao"]})')
        q.click('#fechar')
        q.close()
        # o card do DP conta a empresa com os dias informados no plano (a jornada 22 da j4, de segunda a sábado: 6x1)
        r = cx.new_page()
        r.on('pageerror', lambda e: erros.append(str(e)))
        r.route('**/cdnjs.cloudflare.com/**', lambda x: x.abort())
        r.add_init_script(TOUR); r.add_init_script('window.__j6PlanoJ4 = true'); r.add_init_script(EXTRA); r.add_init_script(SEMEAR)
        r.goto(base + 'dp.html'); r.wait_for_timeout(1500)
        card = r.locator('a.dashboard-card[href="dp-jornada.html"]').inner_text().lower()
        ok('2 empresas em 6x1' in card, f'o card do DP conta a j4 pelos dias informados no plano ({card!r})')
        r.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
