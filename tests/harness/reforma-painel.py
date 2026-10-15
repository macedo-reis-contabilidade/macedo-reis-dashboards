"""Teste do topo da tela da Reforma Tributária (fiscal-reforma.html, 15/10/2026): o painel da campanha (prazo, decisões e
simulações) e a faixa das etapas, no lugar do resumo de cinco números e das sete caixas, que repetiam números.
Sem login e sem banco: mesmo mock do conferir.py. Os casos e clientes (inventados) entram no banco falso por uma
armadilha em window.__mockDb, só nesta página — o supabase.mock.js compartilhado não muda.

    python tests/harness/reforma-painel.py

Confere:
  1. os números do painel com 12 casos inventados: dias até o prazo (em âmbar), quantos sem decisão, a barra (decididos ÷
     total, role="progressbar" com os aria-value*), a legenda (decididos, por fora e por dentro — contados, não subtraídos),
     as simulações gravadas (a mesma conta da lista: sem os custos gravados não conta) e, delas, sem conclusão, a confirmar
     e firmes (a simulação antiga, sem a confiança gravada, é firme);
  2. as etapas: o número de cada uma, a etapa com zero mais apagada (mas na tela), "Todos" escolhido com aria-pressed e o
     "›" só de desenho (aria-hidden); o resumo antigo (#rtResumo) não existe mais;
  3. clicar numa etapa filtra a lista e passa o destaque e o aria-pressed;
  4. "N sem conclusão" aplica o filtro "Simulado: sem conclusão" com a etapa "Todos" (vindo de outra etapa: o caso decidido
     sem conclusão aparece), a lista fica só com os sem conclusão, a página rola até a lista (abaixo da barra do topo, que é
     fixa) e o foco vai pro filtro; depois, a etapa continua filtrando;
  5. foco visível no teclado (Tab do botão "sem conclusão" para a primeira etapa, e de volta);
  6. o prazo muda de cor: vermelho com 5 dias ou menos (e "1 dia" no singular), cor de texto com mais de 30; sem nenhuma
     simulação sem conclusão, o botão fica desligado;
  7. no celular (390 px): o painel em uma coluna, as etapas em grade de 2 ou 3 colunas sem o "›", nada do topo passando
     da tela;
  8. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

def obs(veredito, conclusao=None):
    j = {'v': 1, 'input': {'anexo': 'I', 'receita': 80000}, 'veredito': veredito, 'frase': 'Texto do veredito (teste).', 'calculado_em': '2026-10-14'}
    if conclusao == 'sem_conclusao':
        j['confianca'] = {'conclusao': 'sem_conclusao', 'decisivos': ['% das compras de mercadorias'], 'aConfirmar': [], 'faltam': ['as notas de compra']}
    elif conclusao == 'a_confirmar':
        j['confianca'] = {'conclusao': 'a_confirmar', 'decisivos': [], 'aConfirmar': ['% de clientes PJ'], 'faltam': ['as saídas com o CNPJ']}
    elif conclusao == 'firme':
        j['confianca'] = {'conclusao': 'firme', 'decisivos': [], 'aConfirmar': [], 'faltam': []}
    return json.dumps(j, ensure_ascii=False)

NOMES = ['ALFA', 'BETA', 'GAMA', 'DELTA', 'ÉPSILON', 'ZETA', 'ETA', 'TETA', 'IOTA', 'CAPA', 'LAMBDA', 'MI']
def nome(i): return NOMES[i - 1] + ' PAINEL DE TESTE LTDA'
CLIENTES = [{'id': 'px%d' % i, 'nome_principal': nome(i), 'nome_fantasia': None, 'documento': '1000000000%04d' % (300 + i),
             'cnae_principal': '4712-1/00', 'cidade': 'Três Coroas', 'status': 'ativo'} for i in range(1, 13)]

def caso(i, status, decisao='pendente', sim=None, conclusao=None, custos=True, comunicado=None):
    c = {'id': 'pc%d' % i, 'cliente_id': 'px%d' % i, 'campanha': 'opcao_2027', 'prazo_opcao': None, 'cnae_base': '4712', 'segmento': 'comercio',
         'sinal_b2b': 1, 'sinal_entradas': 1, 'sinal_reducao': 0, 'sinal_aliquota': 1, 'triagem': 'simular',
         'perfil_validado': status != 'triado', 'decisao': decisao, 'status': status, 'comunicado_em': comunicado,
         'sim_custo_dentro': None, 'sim_custo_fora': None, 'sim_obs': None, 'obs': 'Teste do painel.'}
    if sim:
        c['sim_obs'] = obs(sim, conclusao)
        if custos: c['sim_custo_dentro'], c['sim_custo_fora'] = (50000, 42000) if sim == 'OPTE' else (42000, 50000)
    return c

HOJE = datetime.date.today()
def casos(prazo_dias=15, sem_conclusao=True):
    sc = 'sem_conclusao' if sem_conclusao else 'firme'
    lista = [
        caso(1, 'triado'),
        caso(2, 'triado'),
        caso(3, 'triado', decisao=None),                                   # decisão vazia conta como sem decisão
        caso(4, 'triado', sim='MANTENHA', conclusao=sc, custos=False),     # sem os custos gravados: não é simulação gravada
        caso(5, 'simulado', sim='OPTE', conclusao=sc),
        caso(6, 'simulado', sim='MANTENHA', conclusao=sc),
        caso(7, 'simulado', sim='OPTE', conclusao='a_confirmar'),
        caso(8, 'simulado', sim='MANTENHA'),                               # simulação antiga, sem a confiança: firme
        caso(9, 'decidido', decisao='por_fora', sim='OPTE', conclusao='firme'),
        caso(10, 'decidido', decisao='por_fora', sim='OPTE', conclusao=sc),
        caso(11, 'decidido', decisao='por_dentro'),
        caso(12, 'comunicado', decisao='por_dentro', sim='MANTENHA', conclusao='a_confirmar', comunicado=HOJE.isoformat()),
    ]
    prazo = (HOJE + datetime.timedelta(days=prazo_dias)).isoformat()
    for c in lista: c['prazo_opcao'] = prazo
    return lista, prazo

def semear(lista):
    return """
(() => {
  const CLIENTES = %s, CASOS = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS);
  } });
})();
""" % (json.dumps(CLIENTES, ensure_ascii=False), json.dumps(lista, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

# a cor que uma variável do tema dá nesta página (pra comparar com a cor calculada de um elemento)
COR = "v => { const s = document.createElement('span'); s.style.color = 'var(' + v + ')'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }"

def nomes_na_lista(p):
    return sorted(p.eval_on_selector_all('#rtLista tr td:nth-child(2) b', 'bs => bs.map(b => b.textContent.trim())'))

def texto(p, sel):
    return ' '.join(p.inner_text(sel).split())

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        def abrir(lista, viewport={'width': 1280, 'height': 600}):
            p = b.new_page(viewport=viewport)
            p.on('pageerror', lambda e: erros.append(str(e)))
            p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
            p.add_init_script(semear(lista))
            p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1500)
            return p
        cor = lambda p, v: p.evaluate('(' + COR + ')', v)
        cor_de = lambda p, sel: p.eval_on_selector(sel, 'e => getComputedStyle(e).color')

        lista, prazo = casos()
        p = abrir(lista)
        prazo_br = '/'.join(reversed(prazo.split('-')))

        # 1. o painel
        ok(texto(p, '#pnDias') == '15 dias', f'prazo: "15 dias" ({texto(p, "#pnDias")})')
        ok(cor_de(p, '#pnDias') == cor(p, '--warn'), 'com 15 dias, o prazo fica em âmbar (var(--warn))')
        ok(texto(p, '#pnPrazo') == f'até {prazo_br} · prazo da opção', f'embaixo, "até {prazo_br} · prazo da opção" ({texto(p, "#pnPrazo")})')
        ok(p.inner_text('#pnPend').strip() == '8', f'8 sem decisão — 12 casos menos 4 decididos; a decisão vazia conta como sem decisão ({p.inner_text("#pnPend")})')
        barra = p.eval_on_selector('#pnBarra', """e => ({ role: e.getAttribute('role'), min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax'),
            now: e.getAttribute('aria-valuenow'), rotulo: e.getAttribute('aria-label') || '',
            fracao: document.querySelector('#pnBarraVal').getBoundingClientRect().width / e.getBoundingClientRect().width })""")
        ok(barra['role'] == 'progressbar' and barra['min'] == '0' and barra['max'] == '12' and barra['now'] == '4' and barra['rotulo'],
           f'a barra é um progressbar com aria-valuemin 0, aria-valuemax 12, aria-valuenow 4 e rótulo ({barra})')
        ok(abs(barra['fracao'] - 4 / 12) < 0.01, f'a barra preenche 4 ÷ 12 ({barra["fracao"]:.3f})')
        ok(cor(p, '--ok') == p.eval_on_selector('#pnBarraVal', 'e => getComputedStyle(e).backgroundColor')
           and cor(p, '--fill-3').replace(' ', '') == p.eval_on_selector('#pnBarra', 'e => getComputedStyle(e).backgroundColor').replace(' ', ''),
           'a barra em var(--ok) sobre o trilho var(--fill-3)')
        leg = [p.inner_text(s).strip() for s in ('#pnDecididos', '#pnFora', '#pnDentro')]
        ok(leg == ['4 de 12 decididos', '2 por fora', '2 por dentro'], f'legenda: 4 de 12 decididos · 2 por fora · 2 por dentro ({leg})')
        ok(p.inner_text('#pnSim').strip() == '7' and texto(p, '#pnSimRot') == 'simulações gravadas',
           f'7 simulações gravadas — a sem os custos gravados não conta ({p.inner_text("#pnSim")} {texto(p, "#pnSimRot")})')
        sims = [texto(p, s) for s in ('#pnSemConc', '#pnAConf', '#pnFirmes')]
        ok(sims == ['3 sem conclusão', '2 a confirmar', '2 firmes'], f'delas: 3 sem conclusão, 2 a confirmar, 2 firmes ({sims})')
        ok(p.eval_on_selector('#pnSemConc', 'e => e.tagName') == 'BUTTON' and not p.eval_on_selector('#pnSemConc', 'e => e.disabled'), '"3 sem conclusão" é um botão ligado')
        ok(texto(p, '#pnSimLeg') == 'sem conclusão = faltam dados para decidir', 'a legenda curta do "sem conclusão"')
        ok(p.query_selector('#rtResumo') is None, 'o resumo antigo de cinco números saiu (nada de número repetido)')

        # 2. as etapas
        cont = {s: p.inner_text(s).strip() for s in ('#fTri', '#fVal', '#fSim', '#fDec', '#fCom', '#fOpc', '#fTod')}
        ok(list(cont.values()) == ['4', '0', '4', '3', '1', '0', '12'], f'etapas: Triado 4, Perfil validado 0, Simulado 4, Decidido 3, Comunicado 1, Opção registrada 0, Todos 12 ({cont})')
        et = p.eval_on_selector_all('#rtFunil .fa-focus-card', """bs => bs.map(b => ({ f: b.dataset.f, zero: b.classList.contains('is-zero'),
            ativo: b.classList.contains('is-active'), pressed: b.getAttribute('aria-pressed'), largura: b.getBoundingClientRect().width,
            num: getComputedStyle(b.querySelector('.fc-num')).color }))""")
        por_f = {e['f']: e for e in et}
        ok([e['f'] for e in et] == ['triado', 'validado', 'simulado', 'decidido', 'comunicado', 'opcao_registrada', 'todos'], 'as etapas na ordem do trabalho, com "Todos" no fim')
        ok(por_f['validado']['zero'] and por_f['opcao_registrada']['zero'] and not por_f['triado']['zero'] and not por_f['todos']['zero'],
           'as etapas com zero (Perfil validado, Opção registrada) ficam marcadas como vazias')
        ok(por_f['validado']['num'] == cor(p, '--text-dim') and por_f['triado']['num'] == cor(p, '--text') and por_f['validado']['largura'] > 40,
           'a etapa com zero fica mais apagada (var(--text-dim)), mas continua na tela')
        ok(por_f['todos']['ativo'] and por_f['todos']['pressed'] == 'true' and all(e['pressed'] == 'false' for e in et if e['f'] != 'todos'),
           '"Todos" começa escolhido, com aria-pressed; as outras com aria-pressed="false"')
        seps = p.eval_on_selector_all('#rtFunil .rt-et-sep', 'ss => ss.map(s => [s.textContent.trim(), s.getAttribute("aria-hidden")])')
        ok(len(seps) == 5 and all(s == ['›', 'true'] for s in seps), f'os 5 "›" entre as etapas são só desenho (aria-hidden) ({seps})')
        ok(p.eval_on_selector('#rtFunil', 'e => e.getAttribute("role") === "group" && !!e.getAttribute("aria-label")'), 'a faixa das etapas é um grupo com rótulo')
        ok(len(nomes_na_lista(p)) == 12, 'a lista começa com os 12')

        # 3. a etapa filtra
        p.click('#rtFunil [data-f="simulado"]'); p.wait_for_timeout(200)
        ok(nomes_na_lista(p) == sorted(nome(i) for i in (5, 6, 7, 8)), f'"Simulado" filtra a lista: os 4 simulados ({len(nomes_na_lista(p))})')
        est = p.eval_on_selector_all('#rtFunil .fa-focus-card', 'bs => Object.fromEntries(bs.map(b => [b.dataset.f, [b.classList.contains("is-active"), b.getAttribute("aria-pressed")]]))')
        ok(est['simulado'] == [True, 'true'] and est['todos'] == [False, 'false'], f'o destaque e o aria-pressed passam pra "Simulado" ({est["simulado"]}, todos {est["todos"]})')

        # 4. "sem conclusão": filtro da triagem, etapa "Todos", lista na tela, foco no filtro
        p.click('#pnSemConc'); p.wait_for_timeout(300)
        ok(p.input_value('#rtFtri') == 'sim_sem_conclusao', f'o filtro da triagem vira "Simulado: sem conclusão" ({p.input_value("#rtFtri")})')
        ok(nomes_na_lista(p) == sorted(nome(i) for i in (5, 6, 10)), f'a lista fica só com os 3 sem conclusão, inclusive o já decidido ({nomes_na_lista(p)})')
        chips = p.eval_on_selector_all('#rtLista tr td:nth-child(6) .rt-chip', 'cs => cs.map(c => c.textContent.trim())')
        ok(chips and all(c == 'Simulado: sem conclusão' for c in chips), f'todos com o chip "Simulado: sem conclusão" ({chips})')
        est = p.eval_on_selector_all('#rtFunil .fa-focus-card', 'bs => Object.fromEntries(bs.map(b => [b.dataset.f, [b.classList.contains("is-active"), b.getAttribute("aria-pressed")]]))')
        ok(est['todos'] == [True, 'true'] and est['simulado'] == [False, 'false'], f'a etapa volta a "Todos" ({est["todos"]}, simulado {est["simulado"]})')
        rol = p.evaluate("""() => { const f = document.querySelector('.rt-filtros').getBoundingClientRect(), t = document.querySelector('.topbar').getBoundingClientRect();
            return { y: scrollY, topo: f.top, barra: t.bottom, fim: f.bottom, altura: innerHeight }; }""")
        ok(rol['y'] > 0 and rol['topo'] >= rol['barra'] - 1 and rol['fim'] <= rol['altura'], f'a página rola até a lista: os filtros na tela, logo abaixo da barra do topo ({rol})')
        ok(p.evaluate('document.activeElement && document.activeElement.id') == 'rtFtri', 'o foco vai pro filtro aplicado')
        p.select_option('#rtFtri', ''); p.wait_for_timeout(200)
        p.click('#rtFunil [data-f="decidido"]'); p.wait_for_timeout(200)
        ok(nomes_na_lista(p) == sorted(nome(i) for i in (9, 10, 11)), f'depois, clicar numa etapa continua filtrando: "Decidido" traz os 3 decididos ({len(nomes_na_lista(p))})')
        p.click('#rtFunil [data-f="todos"]'); p.wait_for_timeout(200)
        ok(len(nomes_na_lista(p)) == 12, '"Todos" traz os 12 de volta')

        # 5. foco visível no teclado
        p.evaluate('() => scrollTo(0, 0)')
        p.focus('#pnSemConc'); p.keyboard.press('Tab'); p.wait_for_timeout(100)
        foco = p.evaluate("""() => { const e = document.activeElement, s = getComputedStyle(e);
            return { f: e.dataset.f || e.id, visivel: e.matches(':focus-visible'), estilo: s.outlineStyle, largura: parseFloat(s.outlineWidth) }; }""")
        ok(foco['f'] == 'triado' and foco['visivel'] and foco['estilo'] != 'none' and foco['largura'] >= 2, f'Tab do "sem conclusão" vai pra primeira etapa, com o contorno do foco ({foco})')
        p.keyboard.press('Shift+Tab'); p.wait_for_timeout(100)
        foco = p.evaluate("""() => { const e = document.activeElement, s = getComputedStyle(e);
            return { id: e.id, visivel: e.matches(':focus-visible'), estilo: s.outlineStyle, largura: parseFloat(s.outlineWidth) }; }""")
        ok(foco['id'] == 'pnSemConc' and foco['visivel'] and foco['estilo'] != 'none' and foco['largura'] >= 2, f'e de volta ao botão "sem conclusão", também com o contorno ({foco})')
        p.close()

        # 6. a cor do prazo e o botão sem nada sem conclusão
        p = abrir(casos(prazo_dias=5)[0])
        ok(texto(p, '#pnDias') == '5 dias' and cor_de(p, '#pnDias') == cor(p, '--err'), f'com 5 dias, o prazo fica vermelho (var(--err)) ({texto(p, "#pnDias")})')
        p.close()
        p = abrir(casos(prazo_dias=1)[0])
        ok(texto(p, '#pnDias') == '1 dia' and cor_de(p, '#pnDias') == cor(p, '--err'), f'com 1 dia, "1 dia" no singular e vermelho ({texto(p, "#pnDias")})')
        p.close()
        p = abrir(casos(prazo_dias=31, sem_conclusao=False)[0])
        ok(texto(p, '#pnDias') == '31 dias' and cor_de(p, '#pnDias') == cor(p, '--text'), f'com mais de 30 dias, o prazo fica na cor do texto ({texto(p, "#pnDias")})')
        ok(texto(p, '#pnSemConc') == '0 sem conclusão' and p.eval_on_selector('#pnSemConc', 'e => e.disabled'), 'sem nenhuma sem conclusão, "0 sem conclusão" fica desligado')
        ok(texto(p, '#pnFirmes') == '5 firmes', f'e as que eram sem conclusão contam como firmes ({texto(p, "#pnFirmes")})')
        p.close()

        # 7. celular
        p = abrir(lista, viewport={'width': 390, 'height': 844})
        cel = p.evaluate("""() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          const blocos = [...document.querySelectorAll('#rtPainel > .rt-pn')].map(e => e.getBoundingClientRect());
          const etapas = [...document.querySelectorAll('#rtFunil .rt-et-seq .fa-focus-card')].map(e => Math.round(e.getBoundingClientRect().left));
          const seps = [...document.querySelectorAll('#rtFunil .rt-et-sep')].every(e => getComputedStyle(e).display === 'none');
          const passa = [...document.querySelectorAll('#rtPainel, #rtPainel *, #rtFunil, #rtFunil *')].filter(e => e.getBoundingClientRect().right > 390.5).length;
          return { umaColuna: blocos.every(b => Math.abs(b.left - blocos[0].left) < 1) && blocos.every((b, i) => !i || b.top >= blocos[i - 1].bottom - 1),
                   colunas: new Set(etapas).size, seps, passa,
                   rolagem: ['#rtPainel', '#rtFunil'].every(s => { const e = document.querySelector(s); return e.scrollWidth <= e.clientWidth; }) };
        }""")
        ok(cel['umaColuna'], 'no celular, o painel empilha (uma coluna)')
        ok(cel['colunas'] in (2, 3) and cel['seps'], f'as etapas viram uma grade de {cel["colunas"]} colunas, sem o "›"')
        ok(cel['passa'] == 0 and cel['rolagem'], f'nada do painel nem das etapas passa dos 390 px ({cel["passa"]} elemento(s) passando)')
        p.close()

        ok(not erros, 'sem erro de JavaScript' + (f': {erros}' if erros else ''))
        b.close()
    srv.shutdown()
    print(f'\n{"Tudo certo." if not falhas else f"{falhas} checagem(ns) falharam."}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
