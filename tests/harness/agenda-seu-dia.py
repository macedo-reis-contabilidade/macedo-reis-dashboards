"""
A abertura da Agenda, os dias da semana e a coluna "Seu dia" (24/11/2026, a Agenda nova, a "Direção A" que o Samuel
aprovou; a coluna vem de 20/10/2026, no lugar do Radar do escritório e do Resumo do dia) — sem login e sem banco (o mock
do conferir.py; as tarefas e as notícias inventadas entram por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/agenda-seu-dia.py

Confere:
  1. a abertura: o dia em número grande, o dia da semana e o mês; a saudação com o nome e o que falta hoje (as tarefas
     abertas e as rotinas, a mesma conta da coluna); o título lido pelo leitor de tela é a data por extenso;
  2. os dias da semana (de segunda a sexta, e o sábado ou o domingo quando é ele o aberto): quantas abertas cada um tem
     (com o "Ambos", sem as concluídas), o dia que passou com tudo feito no prazo "zerado", o que ficou aberto
     "atrasada", o sem nada "livre"; hoje marcado; clicar num dia abre o dia;
  3. "Seu dia": o anel com as feitas do dia (tarefas e rotinas), os dias zerados da semana, as rotinas; as atrasadas da
     pessoa — com as de "Ambos", sem as concluídas e sem as dos outros —, "desde" a mais antiga e as 3 mais antigas;
     clicar numa abre o detalhe;
  4. "Revisar com o assistente" abre a revisão do assistente com as mesmas atrasadas (o evento mr:revisar-atrasadas);
     sem o assistente na tela, a Agenda abre a lista das atrasadas;
  5. os filtros: com o setor Fiscal, as contas dos dias e do anel só com o fiscal (as atrasadas seguem todas da
     pessoa); com a Thalia, as dela e a revisão dela; o setor IRPF com tudo feito: o "Dia zerado";
  6. "Em destaque" (as notícias): as importantes antes das que vale saber, as mais novas primeiro, até 3, sem a de pouco
     efeito, a antiga, a descartada e a repetida; quantos clientes cada uma alcança; o link pra notícia no feed; a
     Vitória (DP) só com as do DP; a Adaini sem nenhuma do setor dela: o aviso; o título com HTML como texto;
  7. no celular (390 e 360 px): a coluna vem depois da lista, as rotinas entram na lista, os dias da semana cabem (a
     palavra que não cabe sai e fica o número), e nada passa da largura da tela;
e nenhum erro de JavaScript, nem o código dos títulos inventados rodando. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

AGORA = datetime.datetime.now(datetime.timezone.utc)
def iso(**delta): return (AGORA - datetime.timedelta(**delta)).isoformat().replace('+00:00', 'Z')
HOJE = datetime.date.today()
SEG = HOJE - datetime.timedelta(days=HOJE.weekday())
# os dias da tira: de segunda a sexta da semana do dia aberto, e o sábado ou o domingo quando é ele
SEMANA_DIAS = [SEG + datetime.timedelta(days=i) for i in range(5)] + ([HOJE] if HOJE.weekday() >= 5 else [])
ONTEM = HOJE - datetime.timedelta(days=1)
SEMANA_EXTENSO = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
def longo(d): return f'{SEMANA_EXTENSO[d.weekday()]}, {d.day} de {MESES[d.month - 1]}'

XSS_T = '<img src=x onerror="window.__xss=1">Tarefa com HTML (teste)'
XSS_C = '<img src=x onerror="window.__xss=2">CLIENTE COM HTML LTDA'
XSS_N = '<img src=x onerror="window.__xss=3">FGTS Digital muda (teste)'
XSS_A = '<img src=x onerror="window.__xss=4">Atrasada com HTML (teste)'

FONTES = [{'id': 'fa1', 'nome': 'Receita Federal (teste)', 'tipo': 'oficial', 'site': 'https://r.exemplo', 'url': 'https://r.exemplo/rss', 'ativo': True},
          {'id': 'fa2', 'nome': 'Portal Contábil (teste)', 'tipo': 'imprensa', 'site': 'https://p.exemplo', 'url': 'https://p.exemplo/rss', 'ativo': True}]
def N(i, fonte, titulo, relevancia, setores, horas, clientes=0, situacao='triada', grupo=None):
    return {'id': i, 'fonte_id': fonte, 'url': 'https://noticia.exemplo/' + i, 'titulo': titulo, 'publicada_em': iso(hours=horas), 'coletada_em': iso(hours=horas),
            'triada_em': iso(hours=horas), 'situacao': situacao, 'relevancia': relevancia if situacao == 'triada' else None, 'setores': setores,
            'por_que': 'x', 'clientes': ['c%d' % k for k in range(clientes)], 'grupo': grupo}
NOTICIAS = [
    N('na1', 'fa1', 'eSocial muda o leiaute (teste)', 'alta', ['dp'], 2, clientes=3),
    N('na2', 'fa1', 'Prazo do PGDAS muda (teste)', 'alta', ['fiscal'], 5, clientes=1),
    N('na3', 'fa2', 'Nota técnica nova (teste)', 'media', ['fiscal'], 1),
    N('na4', 'fa2', XSS_N, 'media', ['dp'], 0.5, clientes=2),
    N('na5', 'fa2', 'Dicas de contabilidade (teste)', 'baixa', ['contabil'], 1),
    N('na6', 'fa1', 'Antiga: regra do FGTS (teste)', 'alta', ['fiscal'], 24 * 8),
    N('na7', 'fa2', 'Evento de contabilidade (teste)', None, [], 3, situacao='descartada'),
    N('na8', 'fa2', 'Portal: eSocial tem leiaute novo (teste)', 'media', ['dp'], 3, clientes=3, grupo='na1'),
]
# as tarefas: d(n) é o dia de hoje mais n (o fuso do navegador, como a tela)
SEMEAR = """
(() => {
  const F = %s, N = %s, XT = %s, XC = %s, XA = %s;
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const T = (id, titulo, setor, resp, prazo, prio, extra = {}) => ({ id, titulo, setor, responsavel: resp, prazo, status: 'pendente', prioridade: prio, cliente_id: null,
    proposta_id: null, hora: null, transicao_id: null, posicao: 500, clientes: extra.cli ? { nome_principal: extra.cli, documento: '00000000000000' } : null,
    concluida_em: null, concluida_por: null, ...extra });
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.noticias_fontes = F.map(x => ({ ...x })); v.noticias = N.map(x => ({ ...x })); v.noticias_visto = [];
    v.tarefas.push(
      T('sdB', XT, 'comercial', 'Samuel', d(0), 'media', { cli: XC }),
      T('sdN', 'Fiscal de hoje (teste)', 'fiscal', 'Samuel', d(0), 'media'),
      T('sdA', 'Conferir DCTFWeb (teste)', 'fiscal', 'Samuel', d(1), 'alta', { cli: 'EMPRESA EXEMPLO LTDA' }),
      T('sdC', 'Separar extratos (teste)', 'contabil', 'Samuel', d(1), 'media'),
      T('sdG', 'Reunião de sócios (teste)', 'gestao', 'Ambos', d(2), 'media'),
      T('sdH', 'Apuração da Thalia (teste)', 'fiscal', 'Thalia', d(1), 'media'),
      T('sdI', 'Já feita (teste)', 'fiscal', 'Samuel', d(2), 'media', { status: 'concluida', concluida_em: d(0) + 'T10:00:00Z' }),
      T('sdJ', 'Guia do mês (teste)', 'fiscal', 'Samuel', d(3), 'media'),
      T('sdK', XA, 'gestao', 'Ambos', d(-2), 'media'),
      T('sdL', 'Atrasada da Thalia (teste)', 'fiscal', 'Thalia', d(-2), 'alta'),
      T('sdM', 'Atrasada já feita (teste)', 'fiscal', 'Samuel', d(-4), 'media', { status: 'concluida', concluida_em: d(-1) + 'T12:00:00Z' }),
      T('sdP', 'Feita no dia (teste)', 'fiscal', 'Samuel', d(-1), 'media', { status: 'concluida', concluida_em: d(-1) + 'T12:00:00Z' })
    );
  } });
})();
""" % (json.dumps(FONTES, ensure_ascii=False), json.dumps(NOTICIAS, ensure_ascii=False),
       json.dumps(XSS_T, ensure_ascii=False), json.dumps(XSS_C, ensure_ascii=False), json.dumps(XSS_A, ensure_ascii=False))

# a conta independente, direto do banco falso: as tarefas da pessoa (com o "Ambos" pros sócios) num dia, ou as abertas
# antes de hoje
CONTAR = """([pessoa, setor, dia, antes]) => { const norm = s => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  const loc = iso => { const x = new Date(iso); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const h = new Date(), hoje = loc(h);
  const socio = ['samuel', 'diego'].includes(norm(pessoa));
  const ts = window.__mockDb.tarefas.filter(t => t.prazo && (antes ? t.prazo < hoje && t.status !== 'concluida' : t.prazo === dia)
    && (!pessoa || norm(t.responsavel) === norm(pessoa) || (socio && norm(t.responsavel) === 'ambos')) && (!setor || t.setor === setor));
  const abertas = ts.filter(t => t.status !== 'concluida');
  return { ids: ts.map(t => t.id).sort(), total: ts.length, abertas: abertas.length, feitas: ts.length - abertas.length,
           noPrazo: ts.length > 0 && !abertas.length && ts.every(t => t.concluida_em && loc(t.concluida_em) <= dia),
           prazos: abertas.map(t => t.prazo).sort() }; }"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

ERROS = []
def nova_pagina(b, email=None, largura=1600, altura=1000):
    p = b.new_page(viewport={'width': largura, 'height': altura})
    p.on('pageerror', lambda e: ERROS.append(str(e)))
    p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
    p.add_init_script(SEMEAR)
    if email: p.add_init_script("window.__mockEmail = %s;" % json.dumps(email))
    return p

def abrir_agenda(p, base):
    p.goto(base + 'agenda.html')
    p.wait_for_selector('#sdDia .sd-anel', timeout=8000)
    p.wait_for_selector('#agSemana .ag-wk', timeout=8000)
    p.wait_for_function("() => { const b = document.getElementById('sdNoticias'); return b && b.textContent && !/Carregando/.test(b.textContent); }", timeout=8000)

def tira(p):
    return p.eval_on_selector_all('#agSemana .ag-wk', """xs => xs.map(x => ({ dia: x.dataset.sddia, num: x.querySelector('.ag-wk-c b') ? x.querySelector('.ag-wk-c b').textContent : null,
      pal: x.querySelector('.ag-wk-p').textContent, cls: x.className, aperta: x.getAttribute('aria-pressed'), hoje: x.getAttribute('aria-current'),
      rot: x.getAttribute('aria-label') }))""")

def conferir_tira(p, pessoa, setor, msg):
    """cada dia da tira contra a conta do banco falso"""
    ts = tira(p)
    ok([t['dia'] for t in ts] == [d.isoformat() for d in SEMANA_DIAS], f'{msg}: os dias ({[t["dia"] for t in ts]})')
    erradas = []
    for t in ts:
        c = p.evaluate(CONTAR, [pessoa, setor, t['dia'], False])
        passado, ehHoje = t['dia'] < HOJE.isoformat(), t['dia'] == HOJE.isoformat()
        if c['abertas']:
            pal = ('atrasada' if c['abertas'] == 1 else 'atrasadas') if passado else ('aberta' if c['abertas'] == 1 else 'abertas')
            certo = t['num'] == str(c['abertas']) and t['pal'] == pal
        elif ehHoje: certo = t['num'] is None   # hoje: "zerado", "só rotinas", "feito" ou "livre" (pelas rotinas)
        elif c['total']: certo = t['num'] is None and t['pal'] == ('zerado' if passado and c['noPrazo'] else 'feito')
        else: certo = t['num'] is None and t['pal'] == ('–' if passado else 'livre')
        if not certo: erradas.append((t['dia'], t['num'], t['pal'], c))
    ok(not erradas, f'{msg}: quantas abertas em cada dia, e o que passou' + (f' — errados: {erradas}' if erradas else ''))

def rotinas_do_dia(p):
    return p.evaluate("() => ({ n: document.querySelectorAll('#sdRotinas .sd-rot').length, feitas: document.querySelectorAll('#sdRotinas .sd-rot.on').length })")

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. A abertura')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        ok(not p.query_selector('#agRadarBox, .ag-lateral, #agResumo, #resumoPainel, #sdProximos'), '1. sem o Radar, sem o Resumo do dia e sem os "Próximos dias" (viraram os dias da semana, no alto)')
        ok(p.input_value('#fResp') == 'Samuel', '1. a Agenda abre no filtro do Samuel')
        ok(p.text_content('#agNum') == str(HOJE.day) and p.text_content('#agDow') == SEMANA_EXTENSO[HOJE.weekday()]
           and p.text_content('#agMesAno') == f'{MESES[HOJE.month - 1]} de {HOJE.year}',
           f'1. o dia em número grande, o dia da semana e o mês ({p.text_content("#agNum")}, {p.text_content("#agDow")}, {p.text_content("#agMesAno")})')
        ok(p.text_content('#agPeriodo') == longo(HOJE), f'1. o leitor de tela lê a data por extenso ("{p.text_content("#agPeriodo")}")')
        hora = p.evaluate('() => new Date().getHours()')
        oi = ('Bom dia' if hora < 12 else 'Boa tarde' if hora < 18 else 'Boa noite') + ', Samuel.'
        ok(p.text_content('#agFrase .ag-oi') == oi, f'1. a saudação com o nome ("{p.text_content("#agFrase .ag-oi")}")')
        c = p.evaluate(CONTAR, ['Samuel', '', HOJE.isoformat(), False])
        r = rotinas_do_dia(p)
        falta = r['n'] - r['feitas']
        frase = ('Falta 1 tarefa' if c['abertas'] == 1 else f'Faltam {c["abertas"]} tarefas') + ('' if not falta else ' e 1 rotina' if falta == 1 else f' e {falta} rotinas') + ' hoje.'
        txt = ' '.join(p.text_content('#agFrase').split())
        ok(txt == oi + ' ' + frase, f'1. "{txt}" — o que falta hoje, a mesma conta da coluna ({frase})')

        print('2. Os dias da semana')
        conferir_tira(p, 'Samuel', '', '2. o Samuel')
        ts = tira(p)
        do_dia = next((t for t in ts if t['dia'] == HOJE.isoformat()), None)
        ok(do_dia and do_dia['aperta'] == 'true' and do_dia['hoje'] == 'date' and 'hoje' in do_dia['cls'] and sum(t['aperta'] == 'true' for t in ts) == 1,
           '2. hoje marcado (e é o dia aberto)')
        ok(all(t['rot'] and t['rot'].endswith(': ' + (t['num'] + ' ' + t['pal'] if t['num'] else ('nada marcado' if t['pal'] == '–' else t['pal']))) for t in ts),
           '2. cada dia diz o que tem pro leitor de tela')
        if ONTEM in SEMANA_DIAS:
            ontem = next(t for t in ts if t['dia'] == ONTEM.isoformat())
            ok('zerado' in ontem['cls'] and ontem['pal'] == 'zerado', f'2. ontem, com tudo feito no dia: "zerado" ({ontem["pal"]})')
            ok(p.evaluate("() => document.querySelectorAll('#sdDia .sd-dot.on').length") >= 1 and 'zerado' in p.text_content('#sdDia .sd-zerados'),
               f'2. e o "Seu dia" conta o dia zerado ("{p.text_content("#sdDia .sd-zerados")}")')
        else:
            ok(True, '2. (ontem não é desta semana: sem a checagem do dia zerado)')
        outro = next(t for t in ts if t['dia'] != HOJE.isoformat())
        p.click(f'#agSemana .ag-wk[data-sddia="{outro["dia"]}"]')
        dia = datetime.date.fromisoformat(outro['dia'])
        p.wait_for_function('t => document.getElementById("agPeriodo").textContent === t', arg=longo(dia), timeout=6000)
        ok(p.get_attribute(f'#agSemana .ag-wk[data-sddia="{outro["dia"]}"]', 'aria-pressed') == 'true', f'2. clicar num dia abre o dia ({longo(dia)})')
        p.click('#agHoje')
        p.wait_for_function('t => document.getElementById("agPeriodo").textContent === t', arg=longo(HOJE), timeout=6000)
        ok(True, '2. e o "Hoje" volta pra hoje')

        print('3. Seu dia')
        r = rotinas_do_dia(p)
        total, feitas = c['total'] + r['n'], c['feitas'] + r['feitas']
        pct = round(feitas / total * 100) if total else 0
        ok(p.text_content('#sdDia .sd-anel-n') == f'{feitas} de {total}' and p.get_attribute('#sdDia .sd-anel', 'aria-valuenow') == str(pct),
           f'3. o anel: {p.text_content("#sdDia .sd-anel-n")}, {p.get_attribute("#sdDia .sd-anel", "aria-valuenow")}% (esperado {feitas} de {total}, {pct}%)')
        ok(p.text_content('#sdDia .sd-anel-d') == ('tarefas e rotinas feitas hoje' if r['n'] else 'tarefas feitas hoje'), f'3. "{p.text_content("#sdDia .sd-anel-d")}"')
        ok(p.evaluate("() => document.querySelectorAll('#sdDia .sd-dot').length") == 5, '3. os 5 dias úteis da semana, pros dias zerados')
        if HOJE.weekday() < 5:
            ok(r['n'] == 2 and r['feitas'] == 1 and p.is_visible('#sdRotinas') and p.text_content('#sdRotinas .ag-cont') == '1 de 2',
               f'3. as rotinas do Samuel: 1 de 2 ({r})')
        else:
            ok(p.is_hidden('#sdRotinas'), '3. no fim de semana, sem rotina')
        atr = p.evaluate(CONTAR, ['Samuel', '', None, True])
        ok(atr['ids'] == ['sdK', 't10', 't11'], f'3. as atrasadas do Samuel no banco falso: as dele e a de "Ambos", sem a concluída e sem a da Thalia ({atr["ids"]})')
        antiga = atr['prazos'][0]
        dd = antiga[8:10] + '/' + antiga[5:7] + ('' if antiga[:4] == str(HOJE.year) else '/' + antiga[:4])
        txt = ' '.join(p.inner_text('#sdAtras .sd-atras').split())
        ok(txt.startswith(f'{atr["abertas"]} atrasadas suas desde {dd}') and txt.endswith('de todos os setores'), f'3. "{txt}" (3 atrasadas, desde {dd})')
        lista = p.eval_on_selector_all('#sdAtras .sd-atr', 'xs => xs.map(x => x.dataset.sdtask)')
        ok(lista == ['t11', 't10', 'sdK'], f'3. as 3 mais antigas primeiro ({lista})')
        ok(XSS_A in p.inner_text('#sdAtras') and not p.query_selector('#agSeuDia img'), '3. o título com HTML como texto')
        ok(p.text_content('#sdVerAtras') == 'Ver as 3', '3. e o "Ver as 3"')
        p.click('#sdAtras [data-sdtask="t10"]')
        p.wait_for_selector('#detOverlay.is-open', timeout=4000)
        ok(p.input_value('#dTituloInp') == 'Renovar alvará', '3. clicar na atrasada abre o detalhe dela')
        p.click('#detClose')
        p.click('#sdVerAtras')
        p.wait_for_selector('#agFocoLimpar', timeout=4000)
        ok('is-active' in (p.get_attribute('#agFoco [data-foco="atrasadas"]', 'class') or ''), '3. "Ver as 3" abre a lista das atrasadas')
        p.click('#agFocoLimpar')
        p.wait_for_selector('#sdDia .sd-anel', timeout=4000)

        print('4. Revisar com o assistente')
        p.wait_for_selector('.as-lancador', timeout=6000)
        p.evaluate("() => window.addEventListener('mr:revisar-atrasadas', e => { window.__pedido = { pessoa: e.detail.pessoa, atendido: e.detail.atendido }; })")
        p.click('#sdRevisar')
        p.wait_for_selector('.as-cartao-revisao .as-cartao-cont', timeout=6000)
        ok(p.evaluate('() => window.__pedido') == {'pessoa': 'Samuel', 'atendido': True}, '4. o pedido vai pro assistente, que atende (pessoa: Samuel)')
        ok(p.is_visible('.as-painel'), '4. o painel do assistente abre')
        cab = ' '.join(p.inner_text('.as-cartao-revisao .as-cartao-tit').split())
        ok(cab.startswith('Suas atrasadas: ' + str(atr['abertas'])), f'4. a revisão mostra as mesmas {atr["abertas"]} atrasadas ("{cab}")')
        p.close()

        # sem o assistente na tela (o módulo dele não carrega): ninguém atende o pedido
        p = nova_pagina(b)
        p.route('**/assets/js/assistente-escritorio.js', lambda r: r.abort())
        abrir_agenda(p, base)
        p.wait_for_timeout(600)
        p.click('#sdRevisar')
        p.wait_for_selector('#agFocoLimpar', timeout=4000)
        ok('is-active' in (p.get_attribute('.fa-focus-card[data-foco="atrasadas"]', 'class') or ''), '4. sem o assistente, a Agenda abre a lista das atrasadas')
        ok(p.is_hidden('.as-painel') if p.query_selector('.as-painel') else True, '4. e o painel do assistente não abre')
        p.close()

        print('5. Os filtros')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        p.select_option('#fSetor', 'fiscal')
        p.wait_for_timeout(250)
        conferir_tira(p, 'Samuel', 'fiscal', '5. com o setor Fiscal, só as fiscais em cada dia')
        ok(p.text_content('#sdDia .sd-anel-n') == '0 de 1' and p.text_content('#sdDia .sd-anel-d') == 'tarefas feitas hoje',
           f'5. e o anel só com a fiscal de hoje, sem as rotinas dos outros setores ("{p.text_content("#sdDia .sd-anel-n")}")')
        ok(' '.join(p.inner_text('#sdAtras .sd-atras').split()).startswith('3 atrasadas suas'), '5. as atrasadas da pessoa são todas as dela, de qualquer setor (as mesmas da revisão)')
        ok(' '.join(p.text_content('#agFrase').split()).endswith('Falta 1 tarefa hoje.'), f'5. a frase do alto com o filtro ("{p.text_content("#agFrase")}")')
        p.select_option('#fSetor', '')
        p.select_option('#fResp', 'Thalia')
        p.wait_for_timeout(250)
        conferir_tira(p, 'Thalia', '', '5. com a Thalia, as dela em cada dia')
        txt = ' '.join(p.inner_text('#sdAtras .sd-atras').split())
        ok(txt.startswith('1 atrasada da Thalia de '), f'5. "{txt}"')
        p.click('#sdRevisar')
        p.wait_for_selector('.as-cartao-revisao .as-cartao-cont', timeout=6000)
        cab = ' '.join(p.inner_text('.as-cartao-revisao .as-cartao-tit').split())
        ok(cab.startswith('Atrasadas de Thalia: 1'), f'5. a revisão é a da Thalia ("{cab}")')
        p.close()
        p = nova_pagina(b)
        abrir_agenda(p, base)
        p.select_option('#fSetor', 'irpf')
        p.wait_for_selector('#agConteudo .ag-zerado', timeout=6000)
        ok(p.text_content('#agConteudo .ag-zerado h2') == 'Dia zerado.' and p.text_content('#sdDia .sd-anel-n') == '1 de 1'
           and p.get_attribute('#sdDia .sd-anel', 'aria-valuenow') == '100', f'5. com o IRPF tudo feito: "Dia zerado", e o anel cheio ({p.text_content("#sdDia .sd-anel-n")})')
        hoje_t = next(t for t in tira(p) if t['dia'] == HOJE.isoformat())
        ok('zerado' in hoje_t['cls'] and hoje_t['pal'] == 'zerado', '5. e o dia de hoje "zerado" na tira')
        ok(' '.join(p.text_content('#agFrase').split()).startswith(oi + ' Dia zerado.'), f'5. a frase do alto: "{" ".join(p.text_content("#agFrase").split())}"')
        p.close()

        print('6. Em destaque')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        links = p.eval_on_selector_all('#sdNoticias .sd-nt', 'xs => xs.map(x => x.getAttribute("href"))')
        ok(links == ['noticias.html?n=na1', 'noticias.html?n=na2', 'noticias.html?n=na4'],
           f'6. o Samuel: as importantes antes, as mais novas primeiro, até 3, sem a de pouco efeito, a antiga, a descartada e a repetida ({links})')
        imp = p.text_content('#sdNoticias .sd-nt[href$="na1"] .m b')
        meta = ' '.join(p.text_content('#sdNoticias .sd-nt[href$="na1"] .m').split())
        ok(imp == 'Importante' and meta.startswith('ImportanteDP · Receita Federal (teste), ') and len(meta) > 45, f'6. a linha de cima: importância, setor, fonte e quando ("{meta}")')
        alc = [p.inner_text(f'#sdNoticias .sd-nt[href$="{i}"] .c') for i in ('na1', 'na2')]
        ok(alc == ['Alcança 3 clientes da carteira', 'Alcança 1 cliente da carteira'], f'6. quantos clientes cada uma alcança ({alc})')
        ok(p.get_attribute('#sdNoticias .sd-tit a', 'href') == 'noticias.html', '6. "Ver todas" abre o feed')
        ok(p.get_attribute('#sdNoticias .sd-nt[href$="na4"]', 'class') == 'sd-nt media' and XSS_N in p.inner_text('#sdNoticias .sd-nt[href$="na4"] .t'),
           '6. a que vale saber com a cor dela, e o título com HTML como texto')
        ok(XSS_T in p.inner_text('#agConteudo') and XSS_C in p.inner_text('#agConteudo'), '6. a tarefa e a empresa com HTML, na lista, como texto')
        ok(p.evaluate('() => window.__xss') is None and not p.query_selector('#agConteudo img'), '6. nenhum código dos títulos inventados rodou')
        p.close()
        p = nova_pagina(b, email='rh@macedoereis.com.br')
        abrir_agenda(p, base)
        links = p.eval_on_selector_all('#sdNoticias .sd-nt', 'xs => xs.map(x => x.getAttribute("href"))')
        ok(links == ['noticias.html?n=na1', 'noticias.html?n=na4'], f'6. a Vitória: só as do DP ({links})')
        ok(p.input_value('#fResp') == 'Vitória' and p.inner_text('#sdAtras .sd-atras').strip() == 'Nenhuma atrasada sua.', f'6. e as atrasadas dela: "{p.inner_text("#sdAtras .sd-atras").strip()}"')
        p.close()
        p = nova_pagina(b, email='contabil@macedoereis.com.br')
        abrir_agenda(p, base)
        vazio = p.inner_text('#sdNoticias .sd-vazio') if p.query_selector('#sdNoticias .sd-vazio') else ''
        ok(vazio == 'Nada importante pro seu setor nos últimos 7 dias.', f'6. a Adaini, sem nenhuma do contábil (a de pouco efeito não conta): "{vazio}"')
        p.close()

        print('7. No celular')
        for largura in (390, 360):
            p = nova_pagina(b, largura=largura, altura=844)
            abrir_agenda(p, base)
            m = p.evaluate("""() => { const col = document.querySelector('.ag-dia-col').getBoundingClientRect(), sd = document.getElementById('agSeuDia').getBoundingClientRect();
              const wk = [...document.querySelectorAll('#agSemana .ag-wk')].map(x => x.getBoundingClientRect());
              const corte = [...document.querySelectorAll('#agSemana .ag-wk-c')].filter(c => { const r = c.getBoundingClientRect();
                return [...c.children].some(f => { const q = f.getBoundingClientRect(); return q.top < r.bottom && (q.right > r.right + 0.5 || f.scrollWidth > f.clientWidth + 0.5); }); }).length;
              const rotCel = document.querySelector('.ag-rot-cel');
              return { depois: sd.top >= col.bottom - 1, largura: document.documentElement.scrollWidth, vw: window.innerWidth,
                       fixa: document.getElementById('agSeuDia').classList.contains('sd-fixa'), ultimo: Math.max(...wk.map(r => r.right)), corte,
                       rotCel: !!rotCel && getComputedStyle(rotCel).display !== 'none', sdRot: getComputedStyle(document.getElementById('sdRotinas')).display === 'none',
                       acoes: [...document.querySelectorAll('.ag-dia-col .ag-acoes')].every(a => getComputedStyle(a).display === 'none') }; }""")
            ok(m['depois'] and not m['fixa'], f'7. {largura} px: a coluna vem depois da lista (e não fica presa na tela)')
            ok(m['largura'] <= m['vw'], f'7. {largura} px: nada passa da largura da tela ({m["largura"]} de {m["vw"]} px)')
            ok(m['ultimo'] <= m['vw'] and m['corte'] == 0, f'7. {largura} px: os dias da semana cabem, sem palavra cortada (o último termina em {m["ultimo"]:.0f}; {m["corte"]} cortadas)')
            if HOJE.weekday() < 5:
                ok(m['rotCel'] and m['sdRot'], f'7. {largura} px: as rotinas entram na lista (e saem da coluna)')
            ok(m['acoes'], f'7. {largura} px: a linha sem os botões do lado (tocar na linha abre a tarefa)')
            p.close()

        b.close()
    srv.shutdown()
    for e in ERROS: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(ERROS)} falha(s).' if falhas or ERROS else '\nTudo certo.')
    sys.exit(1 if falhas or ERROS else 0)

if __name__ == '__main__':
    main()
