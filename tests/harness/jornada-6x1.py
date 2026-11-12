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
  4. gravar o plano: a linha em jornada_planos, com a simulação, e a situação na lista;
  5. o relatório pra empresa (PDF): as seções, sem a observação interna;
  6. a empresa sem jornada no Domínio: digitar o grupo, simular e gravar (os grupos ficam no plano);
  7. o texto de fora entra como texto (o nome com <img onerror>);
  8. o card no DP: "1 empresa em 6x1";
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
  } });
})();
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
        ok('NOTA INTERNA DE TESTE' not in textos, 'a observação interna fica fora do PDF')
        p.click('#fechar')
        ok('Definido com a empresa' in p.inner_text('#lista tr[data-id="j1"]'), 'a situação na lista')

        print('6. A empresa sem jornada no Domínio')
        p.click('#lista tr[data-id="j2"]'); p.wait_for_selector('#gIncluir', timeout=3000)
        ok('1. O retrato' in p.inner_text('.j6-passo.is-agora'), 'o guia começa pelo retrato')
        p.select_option('#gEscala', '6x1'); p.fill('#gHoras', '44'); p.fill('#gPessoas', '4'); p.fill('#gSalario', '2000')
        p.click('#gIncluir'); p.wait_for_timeout(200)
        saidas = p.inner_text('.j6-saidas')
        ok('1 pessoa' in saidas and '3.244,11' in saidas, f'o simulador com o grupo digitado (fora do Simples: R$ 3.244,11 por pessoa) ({saidas!r})')
        p.click('#pGravar'); p.wait_for_timeout(500)
        pl = plano(p, 'j2')
        ok(pl and len(pl['simulacao']['grupos']) == 1 and pl['simulacao']['grupos'][0]['escala'] == '6x1', f'os grupos ficam no plano ({pl and pl["simulacao"]})')
        p.click('#fechar')
        ok('(digitado)' in p.inner_text('#lista tr[data-id="j2"]') and '4 em 6x1' in p.inner_text('#lista tr[data-id="j2"]'), 'a lista mostra o grupo digitado')

        print('7. Texto de fora')
        ok(p.evaluate('window.__pego') is None and '<img' in p.inner_text('#lista tr[data-id="j3"]'), 'o nome com <img onerror> entra como texto')

        print('8. O card no DP')
        p.goto(base + 'dp.html'); p.wait_for_timeout(1500)
        card = p.locator('a.dashboard-card[href="dp-jornada.html"]')
        ok(card.count() == 1 and 'Escala 6x1' in card.inner_text() and '1 empresa em 6x1' in card.inner_text().lower(), f'o card ({card.inner_text() if card.count() else None!r})')
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
