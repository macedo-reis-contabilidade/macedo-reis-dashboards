"""
A coluna "Seu dia" da Agenda (20/10/2026, pedido do Samuel: no lugar do Radar do escritório e do Resumo do dia) — sem
login e sem banco (o mock do conferir.py; as tarefas e as notícias inventadas entram por uma armadilha em
window.__mockDb, só neste teste).

    python tests/harness/agenda-seu-dia.py

Confere:
  1. o Samuel (sócio), hoje: sem Radar; "Seu dia" com as feitas do dia e as rotinas (a mesma conta da lista à esquerda) e
     a barra; as atrasadas dele — com as de "Ambos", sem as concluídas e sem as dos outros — e "desde" a mais antiga;
  2. "Revisar com o assistente" abre a revisão do assistente com as mesmas atrasadas (o evento mr:revisar-atrasadas); sem
     o assistente na tela, a Agenda abre a lista das atrasadas;
  3. "Próximos dias": os 5 dias úteis depois de hoje, quantas tarefas abertas cada um tem (com o "Ambos", sem as
     concluídas), a lista do primeiro com a prioridade na frente e o "e mais", o título e a empresa com HTML como texto;
     clicar numa tarefa abre o detalhe; clicar num dia abre o dia, e os próximos dias passam a ser os depois dele;
  4. os filtros: com o setor Fiscal, as contas dos dias e do "Seu dia" só com o fiscal; com a Thalia, as atrasadas dela
     ("da Thalia") e a revisão dela; o setor IRPF com tudo feito: "Dia zerado";
  5. "Notícias em destaque": as importantes antes das que vale saber, as mais novas primeiro, até 3, sem a de pouco
     efeito, a antiga, a descartada e a repetida; quantos clientes cada uma alcança; o link pra notícia no feed; a
     Vitória (DP) só com as do DP; a Adaini sem nenhuma do setor dela: o aviso; o título com HTML como texto;
  6. no celular (390 px), a coluna vem depois da lista e nada passa da largura da tela;
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
def util(k):
    d, n = HOJE, 0
    while n < k:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5: n += 1
    return d
DIAS = [util(k) for k in range(1, 6)]
SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

XSS_T = '<img src=x onerror="window.__xss=1">Tarefa com HTML (teste)'
XSS_C = '<img src=x onerror="window.__xss=2">CLIENTE COM HTML LTDA'
XSS_N = '<img src=x onerror="window.__xss=3">FGTS Digital muda (teste)'

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
SEMEAR = """
(() => {
  const F = %s, N = %s, DIAS = %s, XT = %s, XC = %s;
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const T = (id, titulo, setor, resp, prazo, prio, extra = {}) => ({ id, titulo, setor, responsavel: resp, prazo, status: 'pendente', prioridade: prio, cliente_id: null,
    proposta_id: null, hora: null, transicao_id: null, posicao: 500, clientes: extra.cli ? { nome_principal: extra.cli, documento: '00000000000000' } : null,
    concluida_em: null, concluida_por: null, ...extra });
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.noticias_fontes = F.map(x => ({ ...x })); v.noticias = N.map(x => ({ ...x })); v.noticias_visto = [];
    v.tarefas.push(
      T('sdB', XT, 'comercial', 'Samuel', DIAS[0], 'media', { cli: XC }),
      T('sdA', 'Conferir DCTFWeb (teste)', 'fiscal', 'Samuel', DIAS[0], 'alta', { cli: 'EMPRESA EXEMPLO LTDA' }),
      T('sdC', 'Separar extratos (teste)', 'contabil', 'Samuel', DIAS[0], 'media'),
      T('sdD', 'Conferir folha (teste)', 'dp', 'Samuel', DIAS[0], 'baixa'),
      T('sdE', 'Ligar pro cliente (teste)', 'comercial', 'Samuel', DIAS[0], 'media'),
      T('sdF', 'Arquivar contrato (teste)', 'societario', 'Samuel', DIAS[0], 'media'),
      T('sdG', 'Reunião de sócios (teste)', 'gestao', 'Ambos', DIAS[1], 'media'),
      T('sdH', 'Apuração da Thalia (teste)', 'fiscal', 'Thalia', DIAS[1], 'media'),
      T('sdI', 'Já feita (teste)', 'fiscal', 'Samuel', DIAS[2], 'media', { status: 'concluida', concluida_em: d(0) + 'T10:00:00Z' }),
      T('sdJ', 'Guia do mês (teste)', 'fiscal', 'Samuel', DIAS[3], 'media'),
      T('sdK', 'Pendência dos sócios (teste)', 'gestao', 'Ambos', d(-1), 'media'),
      T('sdL', 'Atrasada da Thalia (teste)', 'fiscal', 'Thalia', d(-2), 'alta'),
      T('sdM', 'Atrasada já feita (teste)', 'fiscal', 'Samuel', d(-4), 'media', { status: 'concluida', concluida_em: d(-1) + 'T10:00:00Z' }),
      T('sdN', 'Fiscal de hoje (teste)', 'fiscal', 'Samuel', d(0), 'media')
    );
  } });
})();
""" % (json.dumps(FONTES, ensure_ascii=False), json.dumps(NOTICIAS, ensure_ascii=False), json.dumps([x.isoformat() for x in DIAS]),
       json.dumps(XSS_T, ensure_ascii=False), json.dumps(XSS_C, ensure_ascii=False))

# a conta independente, direto do banco falso: abertas da pessoa (com o "Ambos" pros sócios) num dia ou antes de hoje
CONTAR = """([pessoa, setor, dia, antes]) => { const norm = s => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  const h = new Date(), hoje = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  const socio = ['samuel', 'diego'].includes(norm(pessoa));
  return window.__mockDb.tarefas.filter(t => t.status !== 'concluida' && t.prazo && (antes ? t.prazo < hoje : t.prazo === dia)
    && (!pessoa || norm(t.responsavel) === norm(pessoa) || (socio && norm(t.responsavel) === 'ambos')) && (!setor || t.setor === setor)); }"""

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
    p.wait_for_selector('#sdProximos .sd-dia', timeout=8000)
    p.wait_for_function("() => { const b = document.querySelector('#sdNoticias .sd-bloco'); return b && !/Carregando/.test(b.textContent); }", timeout=8000)

def dados_dias(p):
    return p.eval_on_selector_all('#sdProximos .sd-dia', 'xs => xs.map(x => ({ dia: x.dataset.sddia, n: x.querySelector("b").textContent, prox: x.classList.contains("prox"), rotulo: x.querySelector("small").textContent }))')

def conferir_dias(p, pessoa, setor, msg):
    dias = dados_dias(p)
    esperado = [str(len(p.evaluate(CONTAR, [pessoa, setor, d.isoformat(), False])) or '–') for d in DIAS]
    ok([x['n'] for x in dias] == esperado, f'{msg}: {[x["n"] for x in dias]} (esperado {esperado})')

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. O Samuel, hoje')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        ok(not p.query_selector('#agRadarBox, .ag-lateral, #agResumo, #resumoPainel'), '1. sem o Radar do escritório e sem o Resumo do dia')
        ok(p.input_value('#fResp') == 'Samuel', '1. a Agenda abre no filtro do Samuel')
        conta = p.evaluate("""() => { const col = document.querySelector('.ag-dia-col');
          const tarefas = col.querySelectorAll('.ag-card[data-taskid]').length, rotinas = col.querySelectorAll('.ag-card[data-rotcard]').length;
          const feitas = col.querySelectorAll('.ag-card.feita').length, rotFeitas = col.querySelectorAll('.ag-card.feita[data-rotcard]').length;
          return { total: tarefas + rotinas, feitas, rotinas, rotFeitas }; }""")
        linha = p.inner_text('#sdDia .sd-linha')
        esperado = f"{conta['feitas']} de {conta['total']} feitas · rotinas {conta['rotFeitas']} de {conta['rotinas']}"
        ok(' '.join(linha.split()) == esperado, f'1. "{linha}" — a mesma conta da lista ({esperado})')
        pct = round(conta['feitas'] / conta['total'] * 100)
        ok(p.get_attribute('#sdDia .sd-barra', 'aria-valuenow') == str(pct), f'1. a barra em {pct}%')
        atr = p.evaluate(CONTAR, ['Samuel', '', None, True])
        ids = sorted(t['id'] for t in atr)
        ok(ids == ['sdK', 't10', 't11'], f'1. as atrasadas do Samuel no banco falso: as dele e a de "Ambos", sem a concluída e sem a da Thalia ({ids})')
        antiga = min(t['prazo'] for t in atr)
        dd = antiga[8:10] + '/' + antiga[5:7] + ('' if antiga[:4] == str(HOJE.year) else '/' + antiga[:4])
        txt = ' '.join(p.inner_text('#sdDia .sd-atras').split())
        ok(txt.startswith(f'{len(atr)} atrasadas suas desde {dd}'), f'1. "{txt}" (3 atrasadas, desde {dd})')

        print('2. Revisar com o assistente')
        p.wait_for_selector('.as-lancador', timeout=6000)
        p.evaluate("() => window.addEventListener('mr:revisar-atrasadas', e => { window.__pedido = { pessoa: e.detail.pessoa, atendido: e.detail.atendido }; })")
        p.click('#sdRevisar')
        p.wait_for_selector('.as-cartao-revisao .as-cartao-cont', timeout=6000)
        ok(p.evaluate('() => window.__pedido') == {'pessoa': 'Samuel', 'atendido': True}, '2. o pedido vai pro assistente, que atende (pessoa: Samuel)')
        ok(p.is_visible('.as-painel'), '2. o painel do assistente abre')
        cab = ' '.join(p.inner_text('.as-cartao-revisao .as-cartao-tit').split())
        ok(cab.startswith('Suas atrasadas: ' + str(len(atr))), f'2. a revisão mostra as mesmas {len(atr)} atrasadas ("{cab}")')
        p.close()

        # sem o assistente na tela (o módulo dele não carrega): ninguém atende o pedido
        p = nova_pagina(b)
        p.route('**/assets/js/assistente-escritorio.js', lambda r: r.abort())
        abrir_agenda(p, base)
        p.wait_for_timeout(600)
        p.click('#sdRevisar')
        p.wait_for_selector('#agFocoLimpar', timeout=4000)
        ok(p.get_attribute('.fa-focus-card[data-foco="atrasadas"]', 'class').find('is-active') >= 0, '2. sem o assistente, a Agenda abre a lista das atrasadas')
        ok(p.is_hidden('.as-painel') if p.query_selector('.as-painel') else True, '2. e o painel do assistente não abre')
        p.close()

        print('3. Próximos dias')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        dias = dados_dias(p)
        ok([x['dia'] for x in dias] == [d.isoformat() for d in DIAS], f'3. os 5 dias úteis depois de hoje ({[x["dia"] for x in dias]})')
        rotulos = [d.strftime('%d') for d in DIAS]
        ok([x['rotulo'].split()[-1].zfill(2) for x in dias] == rotulos and dias[0]['prox'] and not any(x['prox'] for x in dias[1:]),
           '3. o dia da semana e o dia no alto de cada um; o primeiro em destaque')
        conferir_dias(p, 'Samuel', '', '3. quantas abertas em cada dia (com o "Ambos", sem a concluída nem a da Thalia)')
        tit = p.inner_text('#sdProximos .sd-lista-tit')
        amanha = DIAS[0] == HOJE + datetime.timedelta(days=1)
        esp_tit = 'Amanhã' if amanha else SEMANA[DIAS[0].weekday()].capitalize() + ', ' + DIAS[0].strftime('%d/%m')
        ok(tit == esp_tit, f'3. a lista do primeiro dia: "{tit}" (esperado "{esp_tit}")')
        do_dia = p.evaluate(CONTAR, ['Samuel', '', DIAS[0].isoformat(), False])
        itens = p.eval_on_selector_all('#sdProximos .sd-lista button', 'xs => xs.map(x => ({ id: x.dataset.sdtask, prio: x.className, texto: x.textContent }))')
        ok(len(itens) == min(5, len(do_dia)) and itens[0]['id'] == 'sdA' and itens[0]['prio'] == 'prio-alta', f'3. até 5, a de prioridade alta na frente ({[i["id"] for i in itens]})')
        mais = p.inner_text('#sdProximos .sd-mais') if p.query_selector('#sdProximos .sd-mais') else ''
        ok(mais == f'e mais {len(do_dia) - 5}', f'3. "{mais}" ({len(do_dia)} no dia)')
        com_html = next((i for i in itens if i['id'] == 'sdB'), None)
        ok(com_html is not None and XSS_T in com_html['texto'] and XSS_C in com_html['texto'] and not p.query_selector('#sdProximos img'),
           '3. o título e a empresa com HTML saem como texto')
        p.click('#sdProximos [data-sdtask="sdA"]')
        p.wait_for_selector('#detOverlay.is-open', timeout=4000)
        ok(p.input_value('#dTituloInp') == 'Conferir DCTFWeb (teste)', '3. clicar na tarefa abre o detalhe dela')
        p.click('#detClose')
        p.click(f'#sdProximos .sd-dia[data-sddia="{DIAS[2].isoformat()}"]')
        p.wait_for_function("d => document.querySelector('#sdProximos .sd-dia') && document.querySelector('#sdProximos .sd-dia').dataset.sddia > d", arg=DIAS[2].isoformat(), timeout=6000)
        periodo = p.text_content('#agPeriodo')
        longo = p.evaluate("s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); }", DIAS[2].isoformat())
        ok(periodo == longo, f'3. clicar num dia abre o dia ("{periodo}")')
        prox = p.get_attribute('#sdProximos .sd-dia', 'data-sddia')
        ok(prox == DIAS[3].isoformat(), f'3. e os próximos dias passam a ser os depois dele (começa em {prox})')
        p.close()

        print('4. Os filtros')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        p.select_option('#fSetor', 'fiscal')
        p.wait_for_timeout(200)
        conferir_dias(p, 'Samuel', 'fiscal', '4. com o setor Fiscal, só as fiscais em cada dia')
        linha = ' '.join(p.text_content('#sdDia').split())
        ok(' '.join(p.text_content('#sdDia .sd-linha').split()) == '0 de 1 feita', f'4. e o "Seu dia" só com a fiscal de hoje ("{linha}")')
        ok('3 atrasadas suas' in linha, '4. as atrasadas da pessoa são todas as dela, de qualquer setor (as mesmas da revisão)')
        p.select_option('#fSetor', '')
        p.select_option('#fResp', 'Thalia')
        p.wait_for_timeout(200)
        conferir_dias(p, 'Thalia', '', '4. com a Thalia, as dela em cada dia')
        txt = ' '.join(p.inner_text('#sdDia .sd-atras').split())
        ok(txt.startswith('1 atrasada da Thalia de '), f'4. "{txt}"')
        p.click('#sdRevisar')
        p.wait_for_selector('.as-cartao-revisao .as-cartao-cont', timeout=6000)
        cab = ' '.join(p.inner_text('.as-cartao-revisao .as-cartao-tit').split())
        ok(cab.startswith('Atrasadas de Thalia: 1'), f'4. a revisão é a da Thalia ("{cab}")')
        p.close()
        p = nova_pagina(b)
        abrir_agenda(p, base)
        p.select_option('#fSetor', 'irpf')
        p.wait_for_timeout(200)
        txt = ' '.join(p.inner_text('#sdDia').split())
        ok('1 de 1 feita' in txt and 'Dia zerado' in txt and 'cheia' in (p.get_attribute('#sdDia .sd-barra', 'class') or ''), f'4. com o IRPF tudo feito: "Dia zerado" ("{txt}")')
        p.close()

        print('5. Notícias em destaque')
        p = nova_pagina(b)
        abrir_agenda(p, base)
        links = p.eval_on_selector_all('#sdNoticias .sd-nt', 'xs => xs.map(x => x.getAttribute("href"))')
        ok(links == ['noticias.html?n=na1', 'noticias.html?n=na2', 'noticias.html?n=na4'],
           f'5. o Samuel: as importantes antes, as mais novas primeiro, até 3, sem a de pouco efeito, a antiga, a descartada e a repetida ({links})')
        meta = ' '.join(p.inner_text('#sdNoticias .sd-nt[href$="na1"] .m').split())
        ok(meta.startswith('Importante · DP · Receita Federal (teste), ') and len(meta) > 45, f'5. a linha de cima: importância, setor, fonte e quando ("{meta}")')
        alc = [p.inner_text(f'#sdNoticias .sd-nt[href$="{i}"] .c') for i in ('na1', 'na2')]
        ok(alc == ['Alcança 3 clientes da carteira', 'Alcança 1 cliente da carteira'], f'5. quantos clientes cada uma alcança ({alc})')
        ok(p.get_attribute('#sdNoticias .sd-tit a', 'href') == 'noticias.html', '5. "Ver todas" abre o feed')
        ok(p.get_attribute('#sdNoticias .sd-nt[href$="na4"]', 'class') == 'sd-nt media' and XSS_N in p.inner_text('#sdNoticias .sd-nt[href$="na4"] .t'),
           '5. a que vale saber com a cor dela, e o título com HTML como texto')
        ok(p.evaluate('() => window.__xss') is None and not p.query_selector('#agSeuDia img'), '5. nenhum código dos títulos inventados rodou')
        p.close()
        p = nova_pagina(b, email='rh@macedoereis.com.br')
        abrir_agenda(p, base)
        links = p.eval_on_selector_all('#sdNoticias .sd-nt', 'xs => xs.map(x => x.getAttribute("href"))')
        ok(links == ['noticias.html?n=na1', 'noticias.html?n=na4'], f'5. a Vitória: só as do DP ({links})')
        ok(p.input_value('#fResp') == 'Vitória' and 'Nenhuma atrasada sua.' in p.inner_text('#sdDia'), '5. e o "Seu dia" dela: nenhuma atrasada')
        p.close()
        p = nova_pagina(b, email='contabil@macedoereis.com.br')
        abrir_agenda(p, base)
        vazio = p.inner_text('#sdNoticias .sd-vazio') if p.query_selector('#sdNoticias .sd-vazio') else ''
        ok(vazio == 'Nada importante pro seu setor nos últimos 7 dias.', f'5. a Adaini, sem nenhuma do contábil (a de pouco efeito não conta): "{vazio}"')
        p.close()

        print('6. No celular')
        p = nova_pagina(b, largura=390, altura=844)
        abrir_agenda(p, base)
        m = p.evaluate("""() => { const col = document.querySelector('.ag-dia-col').getBoundingClientRect(), sd = document.getElementById('agSeuDia').getBoundingClientRect();
          return { depois: sd.top >= col.bottom - 1, largura: document.documentElement.scrollWidth, vw: window.innerWidth, fixa: document.getElementById('agSeuDia').classList.contains('sd-fixa') }; }""")
        ok(m['depois'] and not m['fixa'], '6. a coluna vem depois da lista (e não fica presa na tela)')
        ok(m['largura'] <= m['vw'], f'6. nada passa da largura da tela ({m["largura"]} de {m["vw"]} px)')
        p.close()

        b.close()
    srv.shutdown()
    for e in ERROS: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(ERROS)} falha(s).' if falhas or ERROS else '\nTudo certo.')
    sys.exit(1 if falhas or ERROS else 0)

if __name__ == '__main__':
    main()
