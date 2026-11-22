"""
Serviços digitais do Comercial (comercial-servicos.html + assets/js/servicos-digitais.js, 15/11/2026, pedido do Samuel) —
sem login e sem banco (o mock do conferir.py, com os serviços e as vendas semeados só neste teste; tudo inventado). O
relógio fica parado em 16/11/2026 (segunda), 10h de Brasília. O que o banco de verdade grava sozinho (o número da venda,
o quem e o quando, o atualizado_em que muda a cada gravação) o teste imita pelos ganchos do banco falso.

    python tests/harness/servicos-digitais.py

Confere:
  1. o card no Comercial: "2 no ar";
  2. a vitrine: as seções na ordem (No ar, Em preparo, Em estudo, Ideias) e os de fora recolhidos; o cartão com o preço,
     a régua, o próximo passo, os links seguros e as vendas; o "Por onde começar"; a busca; o nome com HTML como texto;
  3. a ficha: "No ar" só com a régua fechada (diz o que falta e não grava); fechando a régua, grava, com o quem e o
     quando só no que mudou; o "Não" pede a nota; descartar pede o motivo; o grátis sem preço e sem os itens da venda
     paga; o endereço que não é seguro não grava; o serviço novo com o endereço curto tirado do nome; Esc fecha;
  4. a ficha que mudou por baixo: não grava por cima, avisa e mostra como ficou;
  5. as vendas: a lista, as pendências, o arrependimento, os filtros; registrar (só de serviço pago que está no ar ou já
     esteve; o documento conferido; o cliente do escritório pelo documento); confirmar o pagamento cria a tarefa das
     NFS-e da Thalia (fiscal, alta, no próximo dia útil) e a segunda venda entra na mesma; o dia no futuro não passa; o
     Desfazer volta a venda e tira a linha da tarefa; a NFS-e marca a linha; entregar, devolver (com o motivo) e
     cancelar; a venda que mudou por baixo não é gravada; a venda paga não muda de valor;
  6. os números por mês e o teste de parar; e (22/11/2026) o título de cada mês em cima do número (o .table thead th
     puxava pra esquerda), o total embaixo dele e, no celular, os números seguindo em tabela, com o mês em cima;
  7. os links diretos (?s=, ?aba=);
e nenhum erro de JavaScript. Tira as fotos da tela nos dois temas em .harness/fotos.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, RAIZ

CHAVES = ['pode_vender', 'pode_cobrar', 'carteira', 'regra_conferida', 'testado', 'identificacao', 'preco_escrito', 'termos', 'dados', 'pix', 'nfse', 'entrega', 'responsavel_tecnico', 'ok_samuel']
SO_PAGO = ['preco_escrito', 'termos', 'pix', 'nfse']
def regua(chaves, estado='ok'):
    return {k: {'estado': estado, 'nota': '', 'em': '2026-11-10T12:00:00+00:00', 'por': 'Diego'} for k in chaves}
def S(id, slug, nome, **o):
    base = {'id': id, 'slug': slug, 'nome': nome, 'resumo': None, 'publico': None, 'modelo': 'pago', 'preco': None, 'preco_obs': None, 'situacao': 'ideia', 'motivo': None,
            'janela_ate': None, 'parar_em': None, 'parar_criterio': None, 'link_pagina': None, 'link_prototipo': None, 'quem_assina': None, 'responsavel': 'Samuel', 'regua': {},
            'origem': None, 'observacao': None, 'ordem': 0, 'no_ar_desde': None, 'encerrado_em': None, 'criado_por': 'financeiro@macedoereis.com.br', 'criado_em': '2026-11-01T12:00:00+00:00',
            'atualizado_por': 'financeiro@macedoereis.com.br', 'atualizado_em': '2026-11-10T12:00:00+00:00'}
    base.update(o); return base
def V(id, numero, servico, nome, **o):
    base = {'id': id, 'numero': numero, 'servico_id': servico, 'cliente_id': None, 'comprador_nome': nome, 'comprador_documento': None, 'comprador_email': None, 'comprador_whatsapp': None,
            'comprador_cidade': None, 'comprador_uf': 'RS', 'valor': 97, 'origem': 'manual', 'termos_versao': None, 'termos_aceitos_em': None, 'pagamento': 'aguardando', 'pago_em': None,
            'pago_por': None, 'pix_id': None, 'devolvido_em': None, 'devolvido_por': None, 'devolucao_motivo': None, 'entregue_em': None, 'entregue_por': None, 'entrega_obs': None,
            'nfse_numero': None, 'nfse_em': None, 'nfse_por': None, 'tarefa_id': None, 'observacao': None, 'criado_por': 'financeiro@macedoereis.com.br',
            'criado_em': '2026-11-10T12:00:00+00:00', 'atualizado_por': 'financeiro@macedoereis.com.br', 'atualizado_em': '2026-11-10T12:00:00+00:00'}
    base.update(o); return base

XSS = '<img src=x onerror="window.__pego=1">'
SERVICOS = [
    S('sAr', 'planilha-no-ar', 'Planilha de teste no ar', resumo='Uma planilha inventada, só pro teste.', publico='Lojas de mentira', preco=97, preco_obs='por loja, uma vez', situacao='no_ar',
      janela_ate='2026-12-31', parar_em='2027-01-31', parar_criterio='menos de 5 vendas, encerra', link_pagina='https://exemplo.com.br/planilha', quem_assina='Escritório Exemplo Ltda',
      regua=regua(CHAVES), no_ar_desde='2026-10-15T12:00:00+00:00', ordem=1),
    S('sPrep', 'calculadora-em-preparo', 'Calculadora em preparo', resumo='Uma calculadora inventada.', preco=49.9, situacao='preparo', link_prototipo='https://exemplo.com.br/prototipo',
      regua=regua(['pode_vender', 'pode_cobrar', 'carteira'])),
    S('sEst', 'relatorio-em-estudo', 'Relatório em estudo', situacao='estudo'),
    S('sIdeia', 'ideia-perigosa', 'Ideia ' + XSS, resumo='Resumo ' + XSS, publico='Público ' + XSS, link_pagina='javascript:alert(1)', link_prototipo='https://exemplo.com.br/"onmouseover="x'),
    S('sGratis', 'gratis-no-ar', 'Serviço grátis no ar', modelo='gratis', situacao='no_ar', link_pagina='mei.html', quem_assina='Escritório Exemplo Ltda',
      regua={**regua([k for k in CHAVES if k not in SO_PAGO and k != 'pode_cobrar']), 'pode_cobrar': {'estado': 'nao', 'nota': 'a lei manda fazer de graça', 'em': '2026-11-10T12:00:00+00:00', 'por': 'Diego'}},
      no_ar_desde='2026-11-04T12:00:00+00:00', ordem=2),
    S('sDesc', 'ideia-descartada', 'Ideia descartada', situacao='descartado', motivo='Não pode vender'),
    S('sPaus', 'servico-pausado', 'Serviço pausado', preco=30, situacao='pausado', motivo='Esperando a lei', no_ar_desde='2026-09-01T12:00:00+00:00'),
]
VENDAS = [
    V('v1', 1, 'sAr', 'LOJA PAGA E ENTREGUE LTDA', comprador_documento='11222333000181', pagamento='pago', pago_em='2026-10-20T15:00:00+00:00', pago_por='financeiro@macedoereis.com.br',
      entregue_em='2026-10-20T16:00:00+00:00', entregue_por='financeiro@macedoereis.com.br', nfse_numero='55', nfse_em='2026-10-21', nfse_por='fiscal@macedoereis.com.br'),
    V('v2', 2, 'sAr', 'MERCADO AGUARDANDO ME'),
    V('v3', 3, 'sAr', 'FARMÁCIA <b>NEGRITO</b>', comprador_documento='52998224725', pagamento='pago', pago_em='2026-11-12T15:00:00+00:00', pago_por='financeiro@macedoereis.com.br', observacao='Obs ' + XSS),
    V('v4', 4, 'sAr', 'OFICINA DEVOLVIDA LTDA', pagamento='devolvido', pago_em='2026-11-05T15:00:00+00:00', pago_por='financeiro@macedoereis.com.br', devolvido_em='2026-11-07T15:00:00+00:00',
      devolvido_por='financeiro@macedoereis.com.br', devolucao_motivo='Arrependimento'),
]
SEMEAR = """
(() => {
  const SERVICOS = %s, VENDAS = %s;
  const EU = 'financeiro@macedoereis.com.br';
  let n = 0;
  // cada gravação com um carimbo novo, como o now() do banco
  const carimbo = () => '2026-11-16T13:00:00.' + String(++n).padStart(6, '0') + '+00:00';
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    // window.__vazio (o cenário 8): a vitrine sem nada
    v.servicos_digitais = window.__vazio ? [] : SERVICOS.map(s => ({ ...s }));
    v.servicos_vendas = window.__vazio ? [] : VENDAS.map(x => ({ ...x }));
    v.clientes = v.clientes.concat([{ id: 'cCasa', nome_principal: 'CLIENTE DA CASA LTDA', documento: '11444777000161', status: 'ativo' }]);
  } });
  // o gatilho servicos_quem, imitado: quem e quando, o número da venda e os carimbos do pagamento, da entrega e da nota
  window.__mockAntesDeInserir = (tabela, r) => {
    if (tabela === 'servicos_digitais') Object.assign(r, { modelo: 'pago', situacao: 'ideia', regua: {}, ordem: 0, ...r, no_ar_desde: null, encerrado_em: null, criado_por: EU, criado_em: carimbo(), atualizado_por: EU, atualizado_em: carimbo() });
    if (tabela === 'servicos_vendas') Object.assign(r, { origem: 'manual', pagamento: 'aguardando', tarefa_id: null, ...r, numero: Math.max(0, ...db.servicos_vendas.map(x => x.numero || 0)) + 1,
      pago_em: null, pago_por: null, entregue_em: null, entregue_por: null, nfse_numero: null, nfse_em: null, nfse_por: null, devolvido_em: null, devolvido_por: null, devolucao_motivo: null,
      criado_por: EU, criado_em: carimbo(), atualizado_por: EU, atualizado_em: carimbo() });
  };
  window.__mockAntesDeMudar = (tabela, r, era) => {
    if (tabela !== 'servicos_digitais' && tabela !== 'servicos_vendas') return;
    Object.assign(r, { criado_em: era.criado_em, criado_por: era.criado_por, atualizado_por: EU, atualizado_em: carimbo() });
    if (tabela === 'servicos_digitais') {
      r.no_ar_desde = era.no_ar_desde || (r.situacao === 'no_ar' ? carimbo() : null);
      r.encerrado_em = r.situacao === 'encerrado' ? (era.situacao === 'encerrado' ? era.encerrado_em : carimbo()) : null;
      return;
    }
    r.nfse_numero = String(r.nfse_numero == null ? '' : r.nfse_numero).trim() || null;
    const jaPaga = (era.pagamento === 'pago' || era.pagamento === 'devolvido') && era.pago_em;
    if (r.pagamento === 'pago') { if (jaPaga) { r.pago_em = era.pago_em; r.pago_por = era.pago_por; } else { r.pago_em = r.pago_em || new Date().toISOString(); r.pago_por = EU; } }
    else if (r.pagamento === 'devolvido') { r.pago_em = era.pago_em; r.pago_por = era.pago_por; }
    else { r.pago_em = null; r.pago_por = null; }
    if (r.pagamento === 'devolvido') { if (era.pagamento === 'devolvido' && era.devolvido_em) { r.devolvido_em = era.devolvido_em; r.devolvido_por = era.devolvido_por; } else { r.devolvido_em = r.devolvido_em || new Date().toISOString(); r.devolvido_por = EU; } }
    else { r.devolvido_em = null; r.devolvido_por = null; r.devolucao_motivo = null; }
    if (r.entregue_em) { if (era.entregue_em) { r.entregue_em = era.entregue_em; r.entregue_por = era.entregue_por; } else r.entregue_por = EU; } else r.entregue_por = null;
    if (r.nfse_numero) { if (era.nfse_numero) { r.nfse_por = era.nfse_por; r.nfse_em = r.nfse_em || era.nfse_em; } else { r.nfse_por = EU; r.nfse_em = r.nfse_em || '2026-11-16'; } }
    else { r.nfse_em = null; r.nfse_por = null; }
  };
})();
""" % (json.dumps(SERVICOS, ensure_ascii=False), json.dumps(VENDAS, ensure_ascii=False))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
TITULO = 'Emitir as NFS-e dos serviços digitais'

falhas = 0
# onde começa (a primeira coluna, de texto) ou termina (as outras, de número) o que está em cada coluna: o título, a
# primeira linha e o total
COLUNAS_NUMEROS = """() => {
  const t = document.querySelector('#numeros table');
  const borda = (c, i) => { const r = document.createRange(); r.selectNodeContents(c); const q = r.getBoundingClientRect(); return Math.round(i ? q.right : q.left); };
  const linha = tr => [...tr.cells].map(borda);
  return { cab: linha(t.tHead.rows[0]), corpo: linha(t.tBodies[0].rows[0]), total: linha(t.tFoot.rows[0]) };
}"""

def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def servico(p, slug): return p.evaluate("s => window.__mockDb.servicos_digitais.find(x => x.slug === s) || null", slug)
def venda(p, numero): return p.evaluate("n => window.__mockDb.servicos_vendas.find(x => x.numero === n) || null", numero)
def tarefas(p): return p.evaluate("t => window.__mockDb.tarefas.filter(x => x.titulo === t)", TITULO)
def texto(p, sel): return p.evaluate("s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; }", sel)
def aberto(p, id): return p.evaluate("i => document.getElementById(i).classList.contains('is-open')", id)
def visivel(p, sel): return p.evaluate("s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }", sel)
def aviso(p):
    p.wait_for_function("() => !document.getElementById('aviso').hidden", timeout=5000)
    return texto(p, '#aviso span')
def linha(p, numero): return f'.sv-venda[data-venda="{venda(p, numero)["id"]}"]'

def nova_pagina(b, erros, tema='escuro', largura=1500):
    p = b.new_page(viewport={'width': largura, 'height': 950})
    p.on('pageerror', lambda e: erros.append(str(e)))
    p.add_init_script(TOUR); p.add_init_script(SEMEAR)
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}')")
    p.clock.set_fixed_time('2026-11-16T13:00:00Z')
    return p

def abrir(p, base, consulta=''):
    p.goto(base + 'comercial-servicos.html' + consulta)
    p.wait_for_function("() => document.querySelector('#vitrine .sv-card, #vitrine .empty-state') && !document.getElementById('guiaCorpo').textContent.includes('Carregando')", timeout=8000)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    fotos = RAIZ / '.harness' / 'fotos'; fotos.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. O card no Comercial')
        p = nova_pagina(b, erros)
        p.goto(base + 'comercial.html')
        p.wait_for_function("() => { const e = document.querySelector('.card-status[data-mod=\"comercial-servicos.html\"]'); return e && !e.classList.contains('st-load'); }", timeout=6000)
        ok(texto(p, '.card-status[data-mod="comercial-servicos.html"]') == '2 no ar', '1. o card diz "2 no ar" → ' + str(texto(p, '.card-status[data-mod="comercial-servicos.html"]')))
        ok(p.evaluate("() => !!document.querySelector('a[href=\"comercial-servicos.html\"] h3') && document.querySelector('a[href=\"comercial-servicos.html\"] h3').textContent === 'Serviços digitais'"), '1. o card tem o nome e leva à tela')
        p.close()

        print('2. A vitrine')
        p = nova_pagina(b, erros)
        abrir(p, base)
        secoes = p.evaluate("() => [...document.querySelectorAll('#vitrine > .sv-secao')].map(s => [s.dataset.secao, s.querySelectorAll('.sv-card').length])")
        ok(secoes == [['no_ar', 2], ['preparo', 1], ['estudo', 1], ['ideia', 1]], f'2. as seções na ordem, com os cartões de cada uma → {secoes}')
        ok(p.evaluate("() => { const d = document.getElementById('secFora'); return !!d && !d.open && d.querySelectorAll('.sv-card').length === 2 && d.querySelector('summary').textContent.trim() === 'Pausados, encerrados e descartados (2)'; }"), '2. os pausados, encerrados e descartados ficam recolhidos')
        ok(texto(p, '#nVitrine') == '(5)', '2. a aba diz quantos estão na vitrine → ' + str(texto(p, '#nVitrine')))
        ar = '.sv-card[data-slug="planilha-no-ar"]'
        ok(texto(p, ar + ' .sv-pill-preco') == 'R$ 97,00' and texto(p, ar + ' .sv-preco-obs') == 'por loja, uma vez' and texto(p, ar + ' .sv-pill-sit') == 'No ar', '2. o cartão tem a situação, o preço e como se cobra')
        ok(texto(p, ar + ' .sv-regua-n') == 'Régua 14 de 14', '2. a régua fechada: 14 de 14 → ' + str(texto(p, ar + ' .sv-regua-n')))
        ok(texto(p, ar + ' .sv-passo') == 'Reavaliar em 31/01/2027 (76 dias): menos de 5 vendas, encerra · até aqui, 2 vendas, R$ 194,00.', '2. o próximo passo do serviço no ar: a data de reavaliar → ' + str(texto(p, ar + ' .sv-passo')))
        ok('Janela até 31/12/2026 (45 dias).' in texto(p, ar + ' .sv-meta') and 'Pra quem: Lojas de mentira' in texto(p, ar + ' .sv-meta'), '2. o "pra quem" e a janela de venda → ' + str(texto(p, ar + ' .sv-meta')))
        ok(texto(p, ar + ' .sv-vendas-n') == '2 vendas · R$ 194,00 · 1 aguardando o pagamento · 2 com pendência', '2. as vendas e a receita do serviço → ' + str(texto(p, ar + ' .sv-vendas-n')))
        link = p.evaluate("s => { const a = document.querySelector(s + ' a.sv-link'); return a ? [a.getAttribute('href'), a.target, a.rel, a.textContent] : null; }", ar)
        ok(link == ['https://exemplo.com.br/planilha', '_blank', 'noopener noreferrer', 'Abrir a página ↗'], f'2. o link da página abre em outra aba → {link}')
        prep = '.sv-card[data-slug="calculadora-em-preparo"]'
        ok(texto(p, prep + ' .sv-regua-n') == 'Régua 3 de 14' and texto(p, prep + ' .sv-passo') == 'Faltam 11 itens da régua. O próximo: A regra conferida no texto oficial.', '2. em preparo: quanto falta e o próximo → ' + str(texto(p, prep + ' .sv-passo')))
        ok(p.evaluate("s => [...document.querySelectorAll(s + ' a.sv-link')].map(a => a.textContent).join('|')", prep) == 'Abrir o protótipo ↗', '2. o link do protótipo')
        gr = '.sv-card[data-slug="gratis-no-ar"]'
        ok(texto(p, gr + ' .sv-pill-preco') == 'Grátis' and texto(p, gr + ' .sv-regua-n') == 'Régua 9 de 9' and texto(p, gr + ' .sv-passo') == 'No ar.', '2. o grátis: sem preço, a régua de 9 e sem cobrança de data → ' + str(texto(p, gr + ' .sv-regua-n')))
        ok(p.evaluate("s => document.querySelector(s + ' a.sv-link').getAttribute('href')", gr) == 'mei.html', '2. a tela do sistema vale como endereço da página')
        ok(texto(p, '.sv-card[data-slug="relatorio-em-estudo"] .sv-pill-preco') == 'Preço a definir', '2. sem preço: "Preço a definir"')
        ideia = '.sv-card[data-slug="ideia-perigosa"]'
        ok(p.evaluate("() => window.__pego === undefined && document.querySelectorAll('#vitrine img, #guia img').length === 0"), '2. o nome, o resumo e o público com HTML entram como texto')
        ok(texto(p, ideia + ' .sv-nome') == 'Ideia ' + XSS and p.evaluate("s => document.querySelectorAll(s + ' a.sv-link').length", ideia) == 0, '2. endereço que não é seguro (javascript:, aspas) não vira link')
        guia = p.evaluate("() => [...document.querySelectorAll('#guiaCorpo li')].map(li => li.textContent.trim())")
        ok(guia == ['Vendas: 1 esperando o pagamento, 1 paga sem entrega, 1 paga sem NFS-e.', 'Calculadora em preparo: Faltam 11 itens da régua. O próximo: A regra conferida no texto oficial.',
                    'Relatório em estudo (em estudo): Faltam 14 itens da régua. O próximo: O escritório pode vender este serviço.'], f'2. o "Por onde começar": as vendas, o preparo e o estudo → {guia}')
        p.fill('#busca', 'CALCULADORA'); p.wait_for_timeout(100)
        ok(p.evaluate("() => [...document.querySelectorAll('#vitrine .sv-card')].map(c => c.dataset.slug)") == ['calculadora-em-preparo'], '2. a busca acha pelo nome, sem maiúscula')
        p.fill('#busca', 'descartada'); p.wait_for_timeout(100)
        ok(p.evaluate("() => { const d = document.getElementById('secFora'); return !!d && d.open && d.querySelectorAll('.sv-card').length === 1; }"), '2. a busca abre os recolhidos quando acha lá')
        p.fill('#busca', 'nada disso existe'); p.wait_for_timeout(100)
        ok('Nenhum serviço com "nada disso existe".' in (texto(p, '#vitrine') or ''), '2. busca sem resultado diz')
        p.fill('#busca', ''); p.wait_for_timeout(100)
        p.screenshot(path=str(fotos / 'escuro-comercial-servicos.png'), full_page=True)

        print('3. A ficha do serviço e a régua')
        p.click(prep + ' .sv-nome'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        ok(texto(p, '#sTitulo') == 'Calculadora em preparo' and 's=calculadora-em-preparo' in p.url and p.evaluate("() => document.getElementById('sSlug').disabled"), '3. a ficha abre com o nome, o endereço curto travado e o link direto no endereço')
        ok(texto(p, '#sReguaConta') == '3 de 14' and p.evaluate("() => document.querySelectorAll('#sRegua .sv-item').length") == 14 and p.evaluate("() => document.querySelectorAll('#sRegua .sv-grupo').length") == 5, '3. a régua inteira, em 5 grupos, com a conta → ' + str(texto(p, '#sReguaConta')))
        ok(p.evaluate("() => { const i = document.querySelector('#sRegua [data-chave=\"pode_vender\"]'); return i.querySelector('.sv-item-estado').value === 'ok' && i.querySelector('.sv-item-quem').textContent === 'Marcado por Diego em 10/11/2026.' && i.querySelector('.sv-item-ajuda').textContent.includes('Base: Res. CFC 1.640/2021'); }"), '3. cada item com o estado, quem marcou, a ajuda e a base')
        ok(p.evaluate("() => [...document.querySelectorAll('#sRegua [data-chave=\"ok_samuel\"] option')].map(o => o.value).join(',') === 'pendente,ok,nao' && [...document.querySelectorAll('#sRegua [data-chave=\"testado\"] option')].map(o => o.value).join(',') === 'pendente,ok,nao,na'"), '3. "Não se aplica" só onde cabe')
        p.select_option('#sSituacao', 'no_ar')
        falta = texto(p, '#sFalta')
        ok(visivel(p, '#sFalta') and falta.startswith('Ainda não pode ir pro ar. Falta: A regra conferida no texto oficial · ') and falta.endswith('Quem assina · O endereço da página.'), f'3. escolhendo "No ar", a ficha diz o que falta → {falta}')
        p.click('#sSalvar'); p.wait_for_timeout(200)
        ok(aberto(p, 'ovServico') and (texto(p, '#sErro') or '').startswith('Ainda não pode ir pro ar. Falta: ') and servico(p, 'calculadora-em-preparo')['situacao'] == 'preparo', '3. sem a régua fechada, "No ar" não grava')
        for k in CHAVES: p.select_option(f'#sRegua [data-chave="{k}"] .sv-item-estado', 'ok')
        ok(texto(p, '#sReguaConta') == '14 de 14 · fechada' and 'Quem assina · O endereço da página.' == texto(p, '#sFalta').replace('Ainda não pode ir pro ar. Falta: ', ''), '3. régua fechada: faltam só os dois campos → ' + str(texto(p, '#sFalta')))
        p.fill('#sQuemAssina', 'Escritório Exemplo Ltda'); p.fill('#sLinkPagina', 'https://exemplo.com.br/calculadora')
        ok(not visivel(p, '#sFalta'), '3. com quem assina e a página, nada mais falta')
        p.click('#sSalvar'); p.wait_for_function("() => !document.getElementById('ovServico').classList.contains('is-open')", timeout=5000)
        s = servico(p, 'calculadora-em-preparo')
        ok(s['situacao'] == 'no_ar' and s['quem_assina'] == 'Escritório Exemplo Ltda' and s['link_pagina'] == 'https://exemplo.com.br/calculadora' and s['preco'] == 49.9 and s['slug'] == 'calculadora-em-preparo', '3. com a régua fechada, vai pro ar')
        ok(all(s['regua'][k]['estado'] == 'ok' for k in CHAVES) and s['regua']['pode_vender'] == {'estado': 'ok', 'nota': '', 'em': '2026-11-10T12:00:00+00:00', 'por': 'Diego'}
           and s['regua']['testado']['por'] == 'Samuel' and s['regua']['testado']['em'].startswith('2026-11-16T13:00:00'), '3. só o item que mudou ganha o quem e o quando de agora → ' + json.dumps(s['regua']['testado']))
        ok(aviso(p) == 'Serviço "Calculadora em preparo" salvo.' and 's=' not in p.url, '3. a tela confirma e o endereço volta ao normal → ' + str(aviso(p)))
        ok(p.evaluate("() => [...document.querySelectorAll('#vitrine > .sv-secao[data-secao=\"no_ar\"] .sv-card')].map(c => c.dataset.slug)") == ['calculadora-em-preparo', 'planilha-no-ar', 'gratis-no-ar'], '3. o cartão passa pra seção "No ar" (pela ordem e pelo nome)')

        est = '.sv-card[data-slug="relatorio-em-estudo"]'
        p.click(est + ' .sv-nome'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        nota = '#sRegua [data-chave="testado"] .sv-item-nota'
        umaLinha = p.evaluate("s => document.querySelector(s).clientHeight", nota)
        p.fill(nota, ('Nota comprida, pra ver a caixa crescer com o texto. ' * 7).strip())
        ok(p.evaluate("s => { const c = document.querySelector(s); return c.tagName === 'TEXTAREA' && c.scrollHeight <= c.clientHeight + 2; }", nota) and p.evaluate("s => document.querySelector(s).clientHeight", nota) > umaLinha * 1.8,
           '3. a nota comprida aparece inteira: a caixa cresce com o texto')
        p.fill(nota, ''); p.wait_for_timeout(50)
        ok(p.evaluate("s => document.querySelector(s).clientHeight", nota) == umaLinha, '3. e volta a uma linha quando esvazia')
        p.select_option('#sRegua [data-chave="carteira"] .sv-item-estado', 'nao')
        p.click('#sSalvar'); p.wait_for_timeout(200)
        ok(aberto(p, 'ovServico') and texto(p, '#sErro') == 'Diga o porquê na nota.' and p.evaluate("() => document.querySelector('#sRegua [data-chave=\"carteira\"] .sv-item-nota').getAttribute('aria-invalid') === 'true'"), '3. o "Não" sem a nota não grava → ' + str(texto(p, '#sErro')))
        p.fill('#sRegua [data-chave="carteira"] .sv-item-nota', 'Concorre com\n um cliente')      # a quebra de linha vira espaço: a nota é uma linha só
        p.fill('#sLinkPagina', 'javascript:alert(1)')
        p.click('#sSalvar'); p.wait_for_timeout(200)
        ok(aberto(p, 'ovServico') and 'Use um endereço que começa com https://' in (texto(p, '#sErro') or '') and servico(p, 'relatorio-em-estudo')['link_pagina'] is None, '3. endereço que não é seguro não grava')
        p.fill('#sLinkPagina', '')
        p.select_option('#sSituacao', 'descartado')
        ok(visivel(p, '#sMotivoCampo'), '3. descartar mostra o campo do motivo')
        p.click('#sSalvar'); p.wait_for_timeout(200)
        ok(aberto(p, 'ovServico') and texto(p, '#sErro') == 'Diga o motivo: por que descartou.', '3. descartar sem o motivo não grava → ' + str(texto(p, '#sErro')))
        p.fill('#sMotivo', 'Concorre com um cliente da carteira')
        p.click('#sSalvar'); p.wait_for_function("() => !document.getElementById('ovServico').classList.contains('is-open')", timeout=5000)
        s = servico(p, 'relatorio-em-estudo')
        ok(s['situacao'] == 'descartado' and s['motivo'] == 'Concorre com um cliente da carteira' and s['regua']['carteira']['estado'] == 'nao' and s['regua']['carteira']['nota'] == 'Concorre com um cliente' and list(s['regua'].keys()) == ['carteira'], '3. descartado com o motivo, e a régua só com o que foi marcado → ' + json.dumps(s['regua'], ensure_ascii=False))
        ok(p.evaluate("() => document.querySelectorAll('#secFora .sv-card').length") == 3 and p.evaluate("() => !document.querySelector('#vitrine > .sv-secao[data-secao=\"estudo\"]')"), '3. o descartado vai pros recolhidos, e a seção vazia some')

        p.click('#btnNovoServico'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        ok(texto(p, '#sTitulo') == 'Novo serviço' and not p.evaluate("() => document.getElementById('sSlug').disabled") and p.evaluate("() => document.getElementById('sSituacao').value") == 'ideia' and p.evaluate("() => document.getElementById('sResponsavel').value") == 'Samuel', '3. o serviço novo nasce como ideia, com quem entrou como responsável')
        p.fill('#sNome', 'Novo serviço de teste')
        ok(p.evaluate("() => document.getElementById('sSlug').value") == 'novo-servico-de-teste', '3. o endereço curto sai do nome')
        p.select_option('#sModelo', 'gratis')
        ok(not visivel(p, '#sPrecoCampo') and not visivel(p, '#sPrecoObsCampo') and p.evaluate("() => [...document.querySelectorAll('#sRegua .sv-item')].filter(i => !i.hidden).length") == 10
           and visivel(p, '#sRegua [data-chave="pode_cobrar"] .sv-item-info') and texto(p, '#sReguaConta') == '0 de 9', '3. no grátis somem o preço e os 4 itens da venda paga, e o "pode cobrar" só informa → ' + str(texto(p, '#sReguaConta')))
        p.click('#sSalvar'); p.wait_for_function("() => !document.getElementById('ovServico').classList.contains('is-open')", timeout=5000)
        s = servico(p, 'novo-servico-de-teste')
        ok(s is not None and s['modelo'] == 'gratis' and s['preco'] is None and s['situacao'] == 'ideia' and s['regua'] == {} and s['responsavel'] == 'Samuel' and s['criado_por'] == 'financeiro@macedoereis.com.br', '3. o serviço novo é gravado')
        ok(aviso(p) == 'Serviço "Novo serviço de teste" cadastrado.' and p.evaluate("() => !!document.querySelector('#vitrine > .sv-secao[data-secao=\"ideia\"] .sv-card[data-slug=\"novo-servico-de-teste\"]')"), '3. e aparece em Ideias')
        p.click('#btnNovoServico'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        p.fill('#sNome', 'Outro'); p.fill('#sSlug', 'Com Espaço')
        p.click('#sSalvar'); p.wait_for_timeout(200)
        ok(aberto(p, 'ovServico') and 'endereço curto' in (texto(p, '#sErro') or ''), '3. endereço curto fora do formato não grava')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(not aberto(p, 'ovServico') and servico(p, 'outro') is None, '3. Esc fecha a ficha sem gravar')

        print('4. A ficha que mudou por baixo')
        p.click(ar + ' .sv-nome'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        p.evaluate("() => { const s = window.__mockDb.servicos_digitais.find(x => x.slug === 'planilha-no-ar'); s.nome = 'Planilha renomeada por outra pessoa'; s.atualizado_por = 'diego@macedoereis.com.br'; s.atualizado_em = '2026-11-16T13:30:00+00:00'; }")
        p.fill('#sResumo', 'Mudança que não pode gravar por cima')
        p.click('#sSalvar'); p.wait_for_function("() => !document.getElementById('sMudou').hidden", timeout=5000)
        ok(aberto(p, 'ovServico') and 'foi alterado por Diego enquanto a ficha estava aberta. Nada foi gravado.' in texto(p, '#sMudou') and servico(p, 'planilha-no-ar')['resumo'] == 'Uma planilha inventada, só pro teste.', '4. a ficha não grava por cima do que outra pessoa salvou → ' + str(texto(p, '#sMudou')))
        p.click('#sRecarregar'); p.wait_for_timeout(200)
        ok(texto(p, '#sTitulo') == 'Planilha renomeada por outra pessoa' and p.evaluate("() => document.getElementById('sResumo').value") == 'Uma planilha inventada, só pro teste.' and not visivel(p, '#sMudou'), '4. "Ver como ficou" abre a ficha como está no banco')
        p.fill('#sResumo', 'Agora grava')
        p.click('#sSalvar'); p.wait_for_function("() => !document.getElementById('ovServico').classList.contains('is-open')", timeout=5000)
        ok(servico(p, 'planilha-no-ar')['resumo'] == 'Agora grava', '4. e a gravação seguinte passa')
        p.evaluate("() => { window.__mockDb.servicos_digitais.find(x => x.slug === 'planilha-no-ar').nome = 'Planilha de teste no ar'; }")
        p.close()

        print('5. As vendas')
        p = nova_pagina(b, erros)
        abrir(p, base, '?aba=vendas')
        ok(visivel(p, '#painelVendas') and not visivel(p, '#painelVitrine') and p.evaluate("() => document.getElementById('tabVendas').getAttribute('aria-selected')") == 'true', '5. o link direto abre a aba Vendas')
        ok(p.evaluate("() => [...document.querySelectorAll('#vendas .sv-venda .sv-venda-n')].map(e => e.textContent)") == ['Nº 4', 'Nº 3', 'Nº 2', 'Nº 1'] and texto(p, '#nVendas') == '(2 pendências)', '5. a lista, a mais nova em cima, e as pendências na aba → ' + str(texto(p, '#nVendas')))
        l3 = linha(p, 3)
        ok(p.evaluate("s => [...document.querySelectorAll(s + ' .sv-pill-pend')].map(e => e.textContent)", l3) == ['Entregar', 'Emitir a NFS-e'] and texto(p, l3 + ' .sv-venda-arr') == 'Arrependimento: os 7 dias contam da entrega.', '5. a venda paga sem entrega: as pendências e o arrependimento → ' + str(texto(p, l3 + ' .sv-venda-arr')))
        ok(texto(p, l3 + ' .sv-venda-nome') == 'FARMÁCIA <b>NEGRITO</b>' and texto(p, l3 + ' .sv-venda-doc') == '529.982.247-25' and p.evaluate("() => window.__pego === undefined && document.querySelectorAll('#vendas b, #vendas img').length === 0"), '5. o nome e a observação com HTML entram como texto, e o documento com a máscara')
        ok(texto(p, linha(p, 1) + ' .sv-pill-pag') == 'Paga em 20/10/2026' and 'Entregue em 20/10/2026 · NFS-e 55 de 21/10/2026 · Confirmada por Samuel' == texto(p, linha(p, 1) + ' .sv-venda-det') and p.evaluate("s => document.querySelectorAll(s + ' .sv-pill-pend').length", linha(p, 1)) == 0, '5. a venda em dia: paga, entregue e com a nota → ' + str(texto(p, linha(p, 1) + ' .sv-venda-det')))
        ok(texto(p, linha(p, 4) + ' .sv-pill-pag') == 'Devolvida em 07/11/2026' and 'Motivo: Arrependimento' in texto(p, linha(p, 4) + ' .sv-venda-det'), '5. a devolvida diz quando e por quê')
        botoes = lambda n: p.evaluate("s => [...document.querySelectorAll(s + ' [data-acao]')].map(b => b.dataset.acao)", linha(p, n))
        ok(botoes(2) == ['pagar', 'cancelar', 'editar'] and botoes(3) == ['entregar', 'nfse', 'devolver', 'editar'] and botoes(1) == ['devolver', 'editar'] and botoes(4) == ['editar'], f'5. cada venda com as ações do estado dela → {botoes(2)} {botoes(3)} {botoes(1)} {botoes(4)}')
        p.select_option('#fPagamento', 'pago')
        ok(p.evaluate("() => document.querySelectorAll('#vendas .sv-venda').length") == 2, '5. o filtro do pagamento')
        p.select_option('#fPagamento', ''); p.check('#fPendencia')
        ok(p.evaluate("() => [...document.querySelectorAll('#vendas .sv-venda .sv-venda-n')].map(e => e.textContent)") == ['Nº 3', 'Nº 2'], '5. "Só com pendência"')
        p.uncheck('#fPendencia')
        ok(p.evaluate("() => [...document.querySelectorAll('#fServico option')].map(o => o.textContent)") == ['Todos os serviços', 'Planilha de teste no ar', 'Serviço pausado'], '5. o filtro do serviço tem os que vendem e os que têm venda')

        p.click('#btnNovaVenda'); p.wait_for_function("() => document.getElementById('ovVenda').classList.contains('is-open')")
        opcoes = p.evaluate("() => ({ soltos: [...document.querySelectorAll('#vServico > option')].map(o => o.textContent), antes: [...document.querySelectorAll('#vServico optgroup option')].map(o => o.textContent), grupo: (document.querySelector('#vServico optgroup') || {}).label })")
        ok(opcoes == {'soltos': ['Escolha…', 'Planilha de teste no ar'], 'antes': ['Serviço pausado'], 'grupo': 'Fora do ar (venda de antes)'}, f'5. só vende o pago que está no ar ou que já esteve (nem o em preparo, nem o grátis) → {opcoes}')
        p.click('#vSalvar'); p.wait_for_timeout(150)
        ok(aberto(p, 'ovVenda') and 'Escolha o serviço.' in texto(p, '#vErro') and 'Diga o nome de quem comprou.' in texto(p, '#vErro'), '5. sem serviço e sem nome não registra → ' + str(texto(p, '#vErro')))
        p.select_option('#vServico', 'sAr')
        ok(p.evaluate("() => document.getElementById('vValor').value") == '97,00' and p.evaluate("() => document.getElementById('vUf').value") == 'RS', '5. o valor vem do preço do serviço')
        p.fill('#vNome', 'COMPRADOR NOVO LTDA'); p.fill('#vDoc', '11.444.777/0001-62'); p.fill('#vZap', '(51) 99999-8888'); p.fill('#vEmail', 'compras@exemplo.com.br'); p.fill('#vCidade', 'Cidade Exemplo')
        p.click('#vSalvar'); p.wait_for_timeout(150)
        ok(aberto(p, 'ovVenda') and texto(p, '#vErro') == 'CPF ou CNPJ inválido: confira os números.' and venda(p, 5) is None, '5. documento com o dígito errado não registra')
        p.fill('#vDoc', '11.444.777/0001-61'); p.wait_for_timeout(100)
        ok(visivel(p, '#vCliente') and texto(p, '#vCliente') == 'É cliente do escritório: CLIENTE DA CASA LTDA.', '5. o documento de um cliente do cadastro é reconhecido → ' + str(texto(p, '#vCliente')))
        p.click('#vSalvar'); p.wait_for_function("() => !document.getElementById('ovVenda').classList.contains('is-open')", timeout=5000)
        v5 = venda(p, 5)
        ok(v5 is not None and v5['servico_id'] == 'sAr' and v5['comprador_documento'] == '11444777000161' and v5['comprador_whatsapp'] == '5551999998888' and v5['comprador_email'] == 'compras@exemplo.com.br'
           and v5['valor'] == 97 and v5['pagamento'] == 'aguardando' and v5['origem'] == 'manual' and v5['cliente_id'] == 'cCasa' and v5['comprador_uf'] == 'RS', '5. a venda é registrada: aguardando, com o documento sem pontuação, o WhatsApp com o 55 e o cliente ligado → ' + json.dumps(v5, ensure_ascii=False)[:200])
        ok(aviso(p) == 'Venda nº 5 registrada. Falta confirmar o pagamento.' and p.evaluate("() => document.querySelector('#vendas .sv-venda .sv-venda-n').textContent") == 'Nº 5' and p.evaluate("s => !!document.querySelector(s + ' .sv-pill-cliente')", linha(p, 5)), '5. e aparece em cima da lista, com a marca de cliente do escritório')

        l5 = linha(p, 5)
        p.click(l5 + ' [data-acao="pagar"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        ok(texto(p, '#aTitulo') == 'Confirmar pagamento' and p.evaluate("() => document.getElementById('aData').value") == '2026-11-16' and p.evaluate("() => document.getElementById('aTarefa').checked") and visivel(p, '#aTarefaCampo') and visivel(p, '#aPixCampo')
           and texto(p, '#aQuem') == 'Venda nº 5 · Planilha de teste no ar · COMPRADOR NOVO LTDA · R$ 97,00', '5. confirmar pagamento: o dia de hoje, o Pix e a tarefa das NFS-e marcada → ' + str(texto(p, '#aQuem')))
        p.fill('#aData', '2026-11-17'); p.click('#aConfirmar'); p.wait_for_timeout(150)
        ok(aberto(p, 'ovAcao') and texto(p, '#aErro') == 'Escolha um dia até hoje.' and venda(p, 5)['pagamento'] == 'aguardando', '5. dia no futuro não passa')
        p.fill('#aData', '2026-11-16'); p.fill('#aPix', ' E123456 ')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v5 = venda(p, 5); ts = tarefas(p)
        ok(v5['pagamento'] == 'pago' and v5['pago_em'] == '2026-11-16T13:00:00.000Z' and v5['pix_id'] == 'E123456' and v5['pago_por'] == 'financeiro@macedoereis.com.br', '5. o pagamento fica gravado, com o dia e o Pix → ' + str(v5['pago_em']))
        LINHA5 = '☐ Venda nº 5 · Planilha de teste no ar · COMPRADOR NOVO LTDA (11.444.777/0001-61) · R$ 97,00 · paga em 16/11/2026'
        ok(len(ts) == 1 and ts[0]['setor'] == 'fiscal' and ts[0]['responsavel'] == 'Thalia' and ts[0]['prioridade'] == 'alta' and ts[0]['prazo'] == '2026-11-17' and ts[0]['status'] == 'pendente'
           and ts[0]['descricao'].split('\n')[1:] == [LINHA5] and ts[0]['descricao'].startswith('As vendas pagas dos serviços digitais'), '5. nasce a tarefa das NFS-e da Thalia (fiscal, alta, no próximo dia útil), com a linha da venda → ' + json.dumps(ts[0]['descricao'].split('\n')[1:], ensure_ascii=False))
        ok(v5['tarefa_id'] == ts[0]['id'] and p.evaluate("id => window.__mockDb.tarefa_historico.some(h => h.tarefa_id === id && h.autor === 'Samuel')", ts[0]['id']), '5. a venda guarda a tarefa, e a tarefa tem a linha no histórico')
        ok(aviso(p) == 'Pagamento da venda nº 5 confirmado · tarefa das NFS-e criada pra Thalia.' and visivel(p, '#btnDesfazer'), '5. a tela diz o que fez e oferece o Desfazer → ' + str(aviso(p)))

        p.click(linha(p, 2) + ' [data-acao="pagar"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        p.fill('#aData', '2026-11-13')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v2 = venda(p, 2); ts = tarefas(p)
        LINHA2 = '☐ Venda nº 2 · Planilha de teste no ar · MERCADO AGUARDANDO ME · R$ 97,00 · paga em 13/11/2026'
        ok(v2['pagamento'] == 'pago' and v2['pago_em'] == '2026-11-13T12:00:00-03:00', '5. o pagamento de outro dia fica no meio-dia daquele dia → ' + str(v2['pago_em']))
        ok(len(ts) == 1 and ts[0]['descricao'].split('\n')[1:] == [LINHA5, LINHA2] and v2['tarefa_id'] == ts[0]['id'], '5. a segunda venda entra na mesma tarefa, no fim da lista → ' + json.dumps(ts[0]['descricao'].split('\n')[1:], ensure_ascii=False))
        ok(aviso(p) == 'Pagamento da venda nº 2 confirmado · a venda entrou na tarefa das NFS-e da Thalia.', '5. e a tela diz que entrou na tarefa → ' + str(aviso(p)))
        p.click('#btnDesfazer'); p.wait_for_function("() => document.querySelector('#aviso span').textContent.startsWith('Desfeito')", timeout=5000)
        v2 = venda(p, 2); ts = tarefas(p)
        ok(v2['pagamento'] == 'aguardando' and v2['pago_em'] is None and v2['tarefa_id'] is None, '5. o Desfazer volta a venda a aguardar')
        ok(len(ts) == 1 and ts[0]['descricao'].split('\n')[1:] == [LINHA5], '5. e tira a linha dela da tarefa (a outra fica)')
        ok(aviso(p) == 'Desfeito: a venda nº 2 voltou ao que era.' and not visivel(p, '#btnDesfazer'), '5. e avisa')

        p.click(linha(p, 5) + ' [data-acao="nfse"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        ok(visivel(p, '#aNumeroCampo') and not visivel(p, '#aPixCampo') and not visivel(p, '#aTarefaCampo'), '5. informar a NFS-e pede o número')
        p.click('#aConfirmar'); p.wait_for_timeout(150)
        ok(aberto(p, 'ovAcao') and texto(p, '#aErro') == 'Diga o número da NFS-e.', '5. sem o número não grava')
        p.fill('#aNumero', ' 2026/45 ')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v5 = venda(p, 5); ts = tarefas(p)
        ok(v5['nfse_numero'] == '2026/45' and v5['nfse_em'] == '2026-11-16' and v5['nfse_por'] == 'financeiro@macedoereis.com.br', '5. a NFS-e fica na venda, com o dia')
        ok(ts[0]['descricao'].split('\n')[1:] == ['☑' + LINHA5[1:] + ' · NFS-e 2026/45'], '5. e a linha da venda na tarefa da Thalia é marcada → ' + json.dumps(ts[0]['descricao'].split('\n')[1:], ensure_ascii=False))
        ok(aviso(p) == 'NFS-e 2026/45 gravada na venda nº 5 · a linha da tarefa da Thalia foi marcada.' and p.evaluate("s => [...document.querySelectorAll(s + ' .sv-pill-pend')].map(e => e.textContent)", linha(p, 5)) == ['Entregar'], '5. sobra só a entrega como pendência → ' + str(aviso(p)))
        p.click('#btnDesfazer'); p.wait_for_function("() => document.querySelector('#aviso span').textContent.startsWith('Desfeito')", timeout=5000)
        v5 = venda(p, 5); ts = tarefas(p)
        ok(v5['nfse_numero'] is None and v5['nfse_em'] is None and ts[0]['descricao'].split('\n')[1:] == [LINHA5], '5. o Desfazer tira a nota e desmarca a linha')

        p.click(l3 + ' [data-acao="entregar"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        p.fill('#aObs', 'planilha por e-mail')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v3 = venda(p, 3)
        ok(v3['entregue_em'] == '2026-11-16T13:00:00.000Z' and v3['entrega_obs'] == 'planilha por e-mail' and v3['entregue_por'] == 'financeiro@macedoereis.com.br', '5. a entrega fica gravada, com o dia e como foi')
        ok(texto(p, l3 + ' .sv-venda-arr') == 'Dentro do prazo de arrependimento até 23/11/2026.' and p.evaluate("s => [...document.querySelectorAll(s + ' .sv-pill-pend')].map(e => e.textContent)", l3) == ['Emitir a NFS-e'], '5. com a entrega, o arrependimento passa a ter data → ' + str(texto(p, l3 + ' .sv-venda-arr')))
        p.click(l3 + ' [data-acao="devolver"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        ok('Dentro do prazo de arrependimento (CDC, art. 49)' in texto(p, '#aAviso') and 'O sistema só registra: o dinheiro volta pelo banco.' in texto(p, '#aAviso'), '5. devolver avisa do arrependimento e que o dinheiro volta pelo banco → ' + str(texto(p, '#aAviso')))
        p.click('#aConfirmar'); p.wait_for_timeout(150)
        ok(aberto(p, 'ovAcao') and texto(p, '#aErro') == 'Diga o motivo da devolução.' and venda(p, 3)['pagamento'] == 'pago', '5. devolver sem o motivo não grava')
        p.fill('#aMotivo', 'Comprou errado')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v3 = venda(p, 3)
        ok(v3['pagamento'] == 'devolvido' and v3['devolucao_motivo'] == 'Comprou errado' and v3['devolvido_em'] == '2026-11-16T13:00:00.000Z' and v3['pago_em'] == '2026-11-12T15:00:00+00:00', '5. a devolução fica gravada, e o pagamento de antes continua')
        ok(texto(p, l3 + ' .sv-pill-pag') == 'Devolvida em 16/11/2026' and botoes(3) == ['editar'] and texto(p, l3 + ' .sv-venda-arr') is None, '5. a devolvida não tem mais ação nem prazo correndo')

        p.click(linha(p, 2) + ' [data-acao="cancelar"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        ok(not visivel(p, '#aDataCampo') and visivel(p, '#aMotivoCampo') and 'nada se apaga' in texto(p, '#aAviso'), '5. cancelar não pede dia e diz que nada se apaga')
        p.fill('#aMotivo', 'desistiu')
        p.click('#aConfirmar'); p.wait_for_function("() => !document.getElementById('ovAcao').classList.contains('is-open')", timeout=5000)
        v2 = venda(p, 2)
        ok(v2['pagamento'] == 'cancelado' and v2['observacao'] == 'Cancelada em 16/11/2026: desistiu.' and len(p.evaluate("() => window.__mockDb.servicos_vendas")) == 5, '5. a venda cancelada fica na lista, com o motivo na observação → ' + str(v2['observacao']))
        p.click('#btnDesfazer'); p.wait_for_function("() => document.querySelector('#aviso span').textContent.startsWith('Desfeito')", timeout=5000)
        ok(venda(p, 2)['pagamento'] == 'aguardando' and venda(p, 2)['observacao'] is None, '5. o Desfazer do cancelamento volta a venda e a observação')

        p.evaluate("() => { const v = window.__mockDb.servicos_vendas.find(x => x.numero === 2); v.atualizado_em = '2026-11-16T13:40:00+00:00'; v.comprador_nome = 'MERCADO RENOMEADO POR OUTRA PESSOA'; }")
        p.click(linha(p, 2) + ' [data-acao="pagar"]'); p.wait_for_function("() => document.getElementById('ovAcao').classList.contains('is-open')")
        p.click('#aConfirmar'); p.wait_for_function("() => document.getElementById('aErro').textContent.length > 0", timeout=5000)
        ok(aberto(p, 'ovAcao') and texto(p, '#aErro').startswith('Esta venda mudou enquanto a janela estava aberta. Nada foi gravado') and venda(p, 2)['pagamento'] == 'aguardando' and len(tarefas(p)) == 1, '5. a venda que mudou por baixo não é gravada → ' + str(texto(p, '#aErro')))
        p.click('#aCancelar'); p.wait_for_timeout(150)
        ok(texto(p, linha(p, 2) + ' .sv-venda-nome') == 'MERCADO RENOMEADO POR OUTRA PESSOA', '5. e a lista mostra como ela ficou')

        p.click(linha(p, 1) + ' [data-acao="editar"]'); p.wait_for_function("() => document.getElementById('ovVenda').classList.contains('is-open')")
        ok(texto(p, '#vTitulo') == 'Venda nº 1' and p.evaluate("() => document.getElementById('vValor').disabled") and not visivel(p, '#vServicoCampo') and texto(p, '#vServicoFixo') == 'Planilha de teste no ar · Paga'
           and p.evaluate("() => document.getElementById('vDoc').value") == '11.222.333/0001-81', '5. editar a venda paga: o serviço e o valor não mudam → ' + str(texto(p, '#vServicoFixo')))
        p.fill('#vCidade', 'Outra Cidade')
        p.click('#vSalvar'); p.wait_for_function("() => !document.getElementById('ovVenda').classList.contains('is-open')", timeout=5000)
        ok(venda(p, 1)['comprador_cidade'] == 'Outra Cidade' and venda(p, 1)['valor'] == 97 and venda(p, 1)['pagamento'] == 'pago' and venda(p, 1)['pago_em'] == '2026-10-20T15:00:00+00:00', '5. os dados de quem comprou mudam, o valor e o pagamento ficam')
        p.screenshot(path=str(fotos / 'escuro-comercial-servicos-vendas.png'), full_page=True)

        print('6. Os números')
        p.click('#tabNumeros'); p.wait_for_timeout(150)
        ok(visivel(p, '#painelNumeros') and 'aba=numeros' in p.url, '6. a aba Números abre e fica no endereço')
        cab = p.evaluate("() => [...document.querySelectorAll('#numeros thead th')].map(t => t.textContent)")
        ok(cab == ['Serviço', 'out/26', 'nov/26', 'Total'], f'6. os meses do primeiro pagamento até hoje → {cab}')
        lin = p.evaluate("() => [...document.querySelectorAll('#numeros tbody tr')].map(tr => [...tr.children].map(c => c.textContent.trim()))")
        ok(lin == [['Planilha de teste no ar', '1 · R$ 97,00', '1 · R$ 97,00 · 2 devolvidas', '2 · R$ 194,00 · 2 devolvidas']], f'6. as vendas pagas por mês, com as devolvidas à parte → {lin}')
        ok(texto(p, '.sv-num-resumo') == 'No período: 2 vendas pagas, R$ 194,00 · 2 devolvidas. O mês é o do pagamento.', '6. o resumo do período → ' + str(texto(p, '.sv-num-resumo')))
        testes = p.evaluate("() => [...document.querySelectorAll('#numeros .sv-testes li')].map(li => li.textContent.trim())")
        ok(testes == ['Planilha de teste no ar: Reavaliar em 31/01/2027 (76 dias): menos de 5 vendas, encerra · até aqui, 2 vendas, R$ 194,00.'], f'6. o teste de parar dos serviços pagos no ar → {testes}')
        cols = p.evaluate(COLUNAS_NUMEROS)
        ok(cols['cab'] == cols['corpo'] == cols['total'] and len(cols['cab']) == 4, f'6. as colunas retas: o mês começa onde o nome e termina onde o número, e o total embaixo → {cols}')
        p.set_viewport_size({'width': 400, 'height': 950}); p.wait_for_timeout(150)
        cel = p.evaluate("() => ({ cab: getComputedStyle(document.querySelector('#numeros thead')).display, td: getComputedStyle(document.querySelector('#numeros tbody td')).display, larg: document.documentElement.scrollWidth })")
        cols = p.evaluate(COLUNAS_NUMEROS)
        ok(cel == {'cab': 'table-header-group', 'td': 'table-cell', 'larg': 400} and cols['cab'] == cols['corpo'] == cols['total'],
           f'6. no celular os números seguem em tabela (rolando de lado), com o mês em cima → {cel} {cols}')
        p.set_viewport_size({'width': 1500, 'height': 950}); p.wait_for_timeout(150)
        p.click('#numeros .sv-testes button'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        ok(texto(p, '#sTitulo') == 'Planilha de teste no ar', '6. o nome leva à ficha')
        p.keyboard.press('Escape'); p.wait_for_timeout(150)
        p.click('#tabVitrine'); p.wait_for_timeout(100)
        ok('aba=' not in p.url and visivel(p, '#painelVitrine'), '6. voltar pra Vitrine limpa o endereço')
        p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
        ok(visivel(p, '#painelVendas') and p.evaluate("() => document.activeElement.id") == 'tabVendas', '6. as setas andam pelas abas')
        p.close()

        print('7. Os links diretos, o guia e o tema claro')
        p = nova_pagina(b, erros, tema='claro')
        abrir(p, base, '?s=gratis-no-ar')
        p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')", timeout=5000)
        ok(texto(p, '#sTitulo') == 'Serviço grátis no ar' and p.evaluate("() => [...document.querySelectorAll('#sRegua .sv-item')].filter(i => !i.hidden).length") == 10 and texto(p, '#sReguaConta') == '9 de 9 · fechada'
           and 'no ar desde 04/11/2026' in texto(p, '#sMeta'), '7. ?s= abre a ficha do serviço → ' + str(texto(p, '#sMeta')))
        p.screenshot(path=str(fotos / 'claro-comercial-servicos-ficha.png'))
        p.click('#sClose'); p.wait_for_timeout(150)
        p.click('#guiaCorpo .sv-guia-item[data-aba="vendas"]'); p.wait_for_timeout(150)
        ok(visivel(p, '#painelVendas') and p.evaluate("() => document.getElementById('fPendencia').checked") and p.evaluate("() => document.querySelectorAll('#vendas .sv-venda').length") == 2, '7. o passo das vendas do guia abre a aba só com as pendências')
        p.click('#tabVitrine'); p.click('#guiaCorpo .sv-guia-item[data-servico="calculadora-em-preparo"]'); p.wait_for_function("() => document.getElementById('ovServico').classList.contains('is-open')")
        ok(texto(p, '#sTitulo') == 'Calculadora em preparo', '7. o passo do serviço em preparo abre a ficha dele')
        p.keyboard.press('Escape'); p.wait_for_timeout(150)
        p.screenshot(path=str(fotos / 'claro-comercial-servicos.png'), full_page=True)
        abrir(p, base, '?s=nao-existe&aba=lixo')
        ok(not aberto(p, 'ovServico') and visivel(p, '#painelVitrine'), '7. link de serviço que não existe e aba desconhecida: a vitrine, sem erro')
        p.close()

        print('8. Sem nada e com a leitura que falha')
        p = nova_pagina(b, erros)
        p.add_init_script("window.__vazio = true")
        p.goto(base + 'comercial-servicos.html')
        p.wait_for_function("() => !document.getElementById('guiaCorpo').textContent.includes('Carregando')", timeout=8000)
        ok('A vitrine está vazia' in texto(p, '#vitrine') and texto(p, '#guiaCorpo') == 'Comece cadastrando a primeira ideia em "+ Novo serviço".', '8. vitrine vazia: manda cadastrar a primeira ideia → ' + str(texto(p, '#guiaCorpo')))
        p.click('#tabVendas')
        ok('Nenhuma venda ainda' in texto(p, '#vendas'), '8. sem venda, a aba diz')
        p.click('#btnNovaVenda'); p.wait_for_function("() => document.getElementById('ovVenda').classList.contains('is-open')")
        ok(visivel(p, '#vSemServico') and p.evaluate("() => document.getElementById('vSalvar').disabled"), '8. sem serviço pago no ar, não dá pra registrar venda')
        p.click('#vCancelar'); p.click('#tabNumeros')
        ok('Ainda sem venda paga' in texto(p, '#numeros'), '8. sem venda paga, os números dizem')
        p.close()
        p = nova_pagina(b, erros)
        p.add_init_script("window.__mockErroTabela = { servicos_digitais: 'permission denied' }")
        p.goto(base + 'comercial-servicos.html')
        p.wait_for_function("() => !document.getElementById('guiaCorpo').textContent.includes('Carregando')", timeout=8000)
        ok(texto(p, '#guiaCorpo') == 'Não deu pra ler os serviços agora. Recarregue a página.' and 'permission denied' not in p.evaluate("() => document.body.textContent"), '8. a leitura que falha avisa em português, sem o erro do banco')
        p.goto(base + 'comercial.html')
        p.wait_for_function("() => { const e = document.querySelector('.card-status[data-mod=\"comercial-servicos.html\"]'); return e && !e.classList.contains('st-load'); }", timeout=6000)
        ok(texto(p, '.card-status[data-mod="comercial-servicos.html"]') == '—', '8. e o card do Comercial fica com o traço')
        p.close()
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
