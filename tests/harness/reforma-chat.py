"""Teste do assistente na tela da Reforma (fiscal-reforma.html + assets/js/assistente-escritorio.js + assistente.js,
14/10/2026): o assistente do escritório, o mesmo de todas as telas, com o que a Reforma registra (a ficha, o cálculo da
tela, as perguntas prontas, a regra abrindo a Base legal aqui). A Edge Function "assistente" entra como dublê, por
window.__mockInvoke: devolve as etapas e a resposta no mesmo formato da função de verdade (eventos "data: {...}"; numa das
perguntas, o próprio Response em pedaços, como o supabase-js devolve pra text/event-stream). A função tem teste próprio em
tests/assistente-funcao.test.mjs (e a da Reforma, em tests/reforma-chat.test.mjs); os auxiliares do balão, em
tests/assistente.test.mjs; o assistente nas outras telas (retomar a resposta, recados do dia, vida), em
tests/harness/assistente-escritorio.py.
Sem login e sem banco: mesmo mock do conferir.py. Clientes, casos, materiais e regras (inventados) entram no banco falso por
uma armadilha em window.__mockDb, só nesta página.

    python tests/harness/reforma-chat.py

Confere:
  1. o balão com a carinha no canto; na primeira tela do dia, a saudação com a agenda de quem entrou; na volta, o recado do
     dia da Reforma (casos sem decisão e o prazo), contado do banco; um recado por tela por dia, sem abrir o painel;
  2. o balão abre o painel: saudação com perguntas de exemplo, sem ficha; Enter envia — enquanto espera, o "digitando…"
     com a carinha lendo e os botões de enviar e de conversa nova travados; a resposta aparece aos poucos e fica com
     negrito, lista e as fontes clicáveis (material → Drive em outra aba; regra → Base legal por cima do painel, com o
     foco nela; código que não existe fica texto; tag no meio nunca vira HTML); embaixo, as consultas que ele fez; Esc com
     a Base legal por cima fecha a Base legal (o foco volta pra fonte), não o painel;
  3. a segunda pergunta leva a primeira como histórico; a conversa que já estava na tela não é redesenhada (a lista de
     consultas aberta continua aberta); o leitor de tela ouve a resposta; a resposta em fluxo de verdade (acento partido
     entre pedaços) sai igual; "[regras A e B]" vira dois links; endereço do Drive que não é do Google não vira link;
  4. resposta que chega com o painel fechado: selo no balão e recado "Respondi"; Esc no balão fecha o recado; abrir limpa
     o selo;
  5. "Conversa nova" esquece; recarregar a página mantém a conversa e o painel aberto;
  6. ficha aberta: recado sobre a empresa, a faixa "Sobre a ficha aberta" e as perguntas sobre ela; a nota "Sobre a ficha
     de …" entra na conversa quando a pergunta muda de contexto (e "Pergunta geral" na volta), sem encher a conversa;
     o histórico que vai é só o do mesmo contexto; pergunta pronta clicada devolve o foco à caixa; vai o caso e, depois de
     "Calcular", o retrato do cálculo (números, procedência e natureza das vendas); campo mudado sem calcular não entra;
     depois de "Gravar", só o caso; desmarcando, a pergunta vai sem ele; Esc no painel fecha o painel e deixa a ficha;
  7. erro da função (limite do dia) em vermelho, com a pergunta de volta na caixa; erro sem texto (401) em português;
  8. conversa guardada fora do formato (JSON quebrado, campos estranhos) não derruba a tela: começa do zero ou fica com o
     que presta;
  9. no celular, o painel ocupa a tela e não reabre sozinho ao recarregar;
 10. a tela não dá erro de JavaScript e nada do texto das respostas roda como código.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, re, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

CLIENTES = [{'id': 'chc1', 'nome_principal': 'LOJA DO CHAT DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000901', 'cnae_principal': '4754-7/01', 'cidade': 'Três Coroas', 'status': 'ativo'}]
ENT = {'anexo': 'I', 'rbt12': 600000, 'receita': 50000, 'aliqEfetivaInformada': None, 'partilha': 15.5, 'cbs': 9.2, 'ibs': 0.1, 'pctPJ': 10, 'pctComprasMercadorias': 60,
       'pctComprasDespesas': 2, 'pctComprasComCredito': None, 'pctDespesasComCredito': None, 'pctImpostoEmbutido': 12, 'pctExcluidoST': 0, 'pctReceitaMonofasica': 0,
       'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0, 'creditoEstoqueMes': 0}
CASOS = [{'id': 'chk1', 'cliente_id': 'chc1', 'campanha': 'opcao_2027', 'prazo_opcao': '2026-10-30', 'cnae_base': '4754', 'segmento': 'comercio',
          'sinal_b2b': 0, 'sinal_entradas': 2, 'sinal_reducao': 0, 'sinal_aliquota': 1, 'score': 3, 'triagem': 'simular', 'perfil_validado': False,
          'decisao': 'pendente', 'status': 'simulado', 'comunicado_em': None, 'atualizado_em': '2026-10-14T10:00:00Z', 'sim_custo_dentro': 20000, 'sim_custo_fora': 25000,
          'sim_obs': json.dumps({'input': ENT, 'veredito': 'MANTENHA', 'frase': 'Frase de teste.', 'calculado_em': '2026-10-14',
                                 'dominio': {'vendas': {'natureza': {'mercadoria': 45000, 'servico': 5000}}}}), 'fundamento': None, 'obs': 'teste'}]
MATERIAIS = [{'id': 'm1', 'codigo': 'TST-LEI', 'titulo': 'Lei de teste', 'tipo': 'norma', 'drive_url': 'https://drive.google.com/file/d/teste/view', 'ativo': True},
             {'id': 'm2', 'codigo': 'TST-AULA', 'titulo': 'Aula de teste', 'tipo': 'aula', 'drive_url': None, 'ativo': True},
             {'id': 'm3', 'codigo': 'TST-MAU', 'titulo': 'Material com endereço estranho', 'tipo': 'aula', 'drive_url': 'javascript:window.__xss=2', 'ativo': True}]
REGRAS = [{'id': 'r1', 'codigo': 'TST-REGRA', 'titulo': 'Regra de teste', 'dispositivo': 'art. 1º', 'regra': 'Texto da regra de teste.', 'aplica_a': 'todos', 'efeito': '—',
           'fonte': '—', 'verificado_em': '2026-10-14', 'ativo': True},
          {'id': 'r2', 'codigo': 'TST-OUTRA', 'titulo': 'Outra regra de teste', 'dispositivo': 'art. 2º', 'regra': 'Texto da outra regra.', 'aplica_a': 'todos', 'efeito': '—',
           'fonte': '—', 'verificado_em': '2026-10-14', 'ativo': True}]
def faixas(pcts):
    lims = [180000, 360000, 720000, 1800000, 3600000, 4800000]
    return [{'ate': l, 'cbs': p, 'ibs': 0, 'pct': p} for l, p in zip(lims, pcts)]
PARAMS = [{'chave': 'aliq_ref_2027', 'valor': {'cbs': 9.3, 'ibs': 0.1, 'cbs_aplicada': 9.2}},
          {'chave': 'partilha_cbs_ibs', 'valor': {'anexos': {'I': faixas([15.5, 15.5, 15.5, 15.5, 15.5, 34.02]), 'II': faixas([14, 14, 14, 14, 14, 25.22]),
           'III': faixas([15.6, 17.1, 16.6, 16.6, 15.6, 19.29]), 'IV': faixas([21.5, 25, 24, 23, 22, 24.7]), 'V': faixas([17.15, 17.15, 18.15, 19.15, 17.15, 19.78])}}}]
RESPOSTA = ('Não: é **isenção**, não alíquota zero [TST-LEI, art. 157] · [regra TST-REGRA].\n\n- primeiro ponto [TST-AULA, slide 3]\n- texto com <img src=x onerror="window.__xss=1"> no meio\n'
            '- código que não existe [M99-NADA, p. 1]')
RESPOSTA2 = 'Por fora, crédito só com destaque — sim [regras TST-REGRA e TST-OUTRA; TST-MAU, slide 2].'
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, PARAMS = %s, MATERIAIS = %s, REGRAS = %s, RESPOSTA = %s, RESPOSTA2 = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
    v.rt_materiais = MATERIAIS; v.rt_regras = REGRAS; v.rt_regra_materiais = []; v.nf_documentos = []; v.nf_itens = []; v.rt_ncm_regras = [];
  } });
  window.__chamadas = [];
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    await new Promise(r => setTimeout(r, window.__demora || 0));
    if (/limite/.test(opts.body.pergunta)) return { data: null, error: { message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ erro: 'Você chegou ao limite de 60 perguntas por dia. Amanhã libera de novo.' }), { status: 429 }) } };
    if (/sessão/.test(opts.body.pergunta)) return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: new Response('', { status: 401 }) } };
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    // como o supabase-js devolve text/event-stream: o próprio Response, lido em pedaços (aqui de 7 bytes, partindo acentos)
    if (/intermunicipal/.test(opts.body.pergunta)) {
      const bytes = new TextEncoder().encode(ev({ tipo: 'etapa', texto: 'Lendo a regra — ação' }) + ev({ tipo: 'resposta', texto: RESPOSTA2, fontes: [] }));
      const corpo = new ReadableStream({ start(ctrl) { for (let i = 0; i < bytes.length; i += 7) ctrl.enqueue(bytes.slice(i, i + 7)); ctrl.close(); } });
      return { data: new Response(corpo, { headers: { 'Content-Type': 'text/event-stream' } }), error: null };
    }
    return { data: ev({ tipo: 'etapa', texto: 'Buscando na base: "isenção"' }) + ev({ tipo: 'etapa', texto: 'Lendo TST-LEI' }) + ev({ tipo: 'resposta', texto: RESPOSTA, fontes: [] }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS, MATERIAIS, REGRAS, RESPOSTA, RESPOSTA2))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        p = b.new_page(viewport={'width': 1400, 'height': 950})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p.add_init_script(SEMEAR)
        p.add_init_script('window.__assistenteRecados = true')   # os recados do dia (o mock deixa quietos nos outros testes)
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1200)
        chamadas = lambda: p.evaluate('window.__chamadas')
        raiz = '.as-raiz'
        ultima = '.as-msgs .as-msg.ia:not(.as-saudacao):last-of-type'
        # espera a chamada seguinte à função e a resposta terminar de aparecer; devolve o corpo que foi
        def esperar_resposta(antes):
            p.wait_for_function(f'() => window.__chamadas.length === {antes + 1}', timeout=4000)
            p.wait_for_function("() => !document.querySelector('.as-raiz').classList.contains('as-ocupado') && !document.querySelector('.as-pal')", timeout=6000)
            p.wait_for_timeout(150)
            return chamadas()[-1]['body']
        def perguntar(texto):
            antes = len(chamadas())
            p.fill('.as-entrada textarea', texto); p.press('.as-entrada textarea', 'Enter')
            return esperar_resposta(antes)
        def ultima_ia():
            return p.evaluate("() => { const ms = [...document.querySelectorAll('.as-msgs .as-msg.ia:not(.as-saudacao)')]; const m = ms[ms.length - 1]; return m ? { html: m.querySelector('.as-resposta').innerHTML, texto: m.innerText, classe: m.className } : null; }")

        # 1) o balão e o recado
        ok(p.is_visible('.as-lancador') and p.is_hidden('.as-painel') and p.is_hidden('.as-recado'), 'o balão com a carinha no canto; painel e recado fechados')
        p.wait_for_selector('.as-recado:not([hidden])', timeout=4000)
        rc = p.eval_on_selector_all('.as-recado .as-chip', 'bs => bs.map(b => b.textContent)')
        txt = p.inner_text('.as-recado')
        ok('Samuel' in txt and 'O que tenho pra hoje?' in rc and p.is_hidden('.as-painel'), f'primeira tela do dia: a saudação com a agenda de quem entrou, sem abrir o painel ({txt[:60]})')
        p.click('.as-recado-x'); p.wait_for_timeout(150)
        ok(p.is_hidden('.as-recado'), 'o × fecha o recado')
        p.reload(); p.wait_for_selector('.as-recado:not([hidden])', timeout=4000)
        txt = p.inner_text('.as-recado')
        ok(re.search(r'1 caso da Reforma ainda sem decisão', txt) and 'Quais casos estão sem conclusão e o que falta em cada um?' in p.inner_text('.as-recado .as-chips'),
           f'na volta à tela, o recado do dia da Reforma, contado do banco ({txt[:90]})')
        p.click('.as-recado-x'); p.reload(); p.wait_for_timeout(3000)
        ok(p.is_hidden('.as-recado'), 'recarregando de novo, nada: um recado por tela por dia')

        # 2) abre, pergunta, digitando, resposta
        p.click('.as-lancador'); p.wait_for_selector('.as-painel:not([hidden])', timeout=3000)
        ok(p.get_attribute('.as-lancador', 'aria-expanded') == 'true' and p.is_hidden('.as-ctx'), 'o balão abre o painel; sem ficha, sem a faixa do caso')
        exemplos = p.eval_on_selector_all('.as-msgs .as-chip', 'bs => bs.map(b => b.textContent)')
        ok(len(exemplos) == 3 and any('fica por dentro' in e for e in exemplos) and 'Eu vejo tudo do sistema' in p.inner_text('.as-msgs') and 'Nesta tela, as perguntas da Reforma' in p.inner_text('.as-msgs'),
           f'saudação do assistente do escritório, com o recado da Reforma e 3 perguntas de exemplo da Reforma ({exemplos})')
        p.evaluate('window.__demora = 700')
        antes = len(chamadas())
        p.fill('.as-entrada textarea', 'Ônibus urbano tem alíquota zero?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_timeout(250)
        est = p.evaluate("() => ({ dig: !!document.querySelector('.as-digitando'), cls: document.querySelector('.as-raiz').className, travado: document.querySelector('.as-enviar').disabled, nova: document.querySelector('.as-acao[data-a=nova]').disabled, caixa: document.querySelector('.as-entrada textarea').value, status: document.querySelector('.as-status-txt').textContent })")
        ok(est['dig'] and 'as-pensando' in est['cls'] and 'as-ocupado' in est['cls'] and est['travado'] and est['nova'] and est['caixa'] == '' and 'Lendo' in est['status'],
           f'enquanto espera: "digitando…", a carinha lendo, enviar e "conversa nova" travados e a caixa limpa ({est["status"]})')
        corpo = esperar_resposta(antes)
        ok(chamadas()[-1]['nome'] == 'assistente' and corpo.get('pergunta') == 'Ônibus urbano tem alíquota zero?' and corpo.get('fluxo') is True and corpo.get('historico') == [] and corpo.get('contexto') == {'pagina': {'caminho': 'fiscal-reforma.html', 'nome': 'Reforma Tributária', 'setor': 'fiscal'}}
           and len(corpo.get('conversa') or '') == 36 and len(corpo.get('pedido') or '') == 36,
           f'vai pra função do assistente: a pergunta, a conversa, o id da pergunta, "fluxo", a tela, sem histórico e sem caso ({ {k: corpo.get(k) for k in ("fluxo", "historico", "contexto")} })')
        r1 = ultima_ia()
        ok(r1 and r1['html'].startswith('<p>Não: é <b>isenção</b>, não alíquota zero'), 'a resposta, com negrito, depois de aparecer aos poucos')
        lei = p.eval_on_selector('.as-msgs .as-msg.ia:not(.as-saudacao) a.fonte[href]', 'a => ({ t: a.textContent, href: a.getAttribute("href"), alvo: a.target, rel: a.rel, tit: a.title })')
        ok(lei['t'] == 'TST-LEI' and lei['href'] == 'https://drive.google.com/file/d/teste/view' and lei['alvo'] == '_blank' and 'noopener' in lei['rel'] and 'Lei de teste' in lei['tit'],
           f'o material citado abre o original no Drive, em outra aba ({lei})')
        regras1 = p.eval_on_selector_all('.as-msgs .as-msg.ia:not(.as-saudacao) a.fonte[data-regra]', 'as => as.map(a => a.textContent + "|" + a.dataset.regra + "|" + a.getAttribute("href").split("/").pop())')
        ok(regras1 == ['regra TST-REGRA|TST-REGRA|fiscal-reforma.html#regra-TST-REGRA'], f'a regra citada vira link pra Base legal (de outra tela, leva pra cá), que o Tab alcança ({regras1})')
        ok(p.eval_on_selector_all('.as-msgs .as-msg.ia:not(.as-saudacao) .as-resposta li', 'ls => ls.length') == 3
           and p.eval_on_selector_all('.as-msgs .as-msg.ia:not(.as-saudacao) .fonte', 'as => as.map(a => a.tagName + ":" + a.textContent)') == ['A:TST-LEI', 'A:regra TST-REGRA', 'SPAN:TST-AULA'],
           'a lista e a fonte dentro dela (o material sem link do Drive aparece como fonte, sem ser link)')
        ok('[M99-NADA, p. 1]' in r1['texto'] and '<img src=x' in r1['texto'] and p.eval_on_selector_all('.as-msgs img', 'is => is.length') == 0 and not p.evaluate('window.__xss'),
           'código que não existe fica texto; tag no meio da resposta sai como texto')
        ok('2 consultas' in r1['texto'], 'embaixo, quantas consultas ele fez')
        p.click('.as-msgs .as-consultas summary'); p.wait_for_timeout(100)
        cons = p.eval_on_selector_all('.as-msgs .as-consultas li', 'ls => ls.map(l => l.textContent)')
        ok(cons == ['Buscando na base: "isenção"', 'Lendo TST-LEI'], f'e quais, abrindo a lista ({cons})')
        p.click('.as-msgs a.fonte[data-regra]'); p.wait_for_selector('#ovBase.on', timeout=3000); p.wait_for_timeout(250)
        cima = p.evaluate("() => { const r = document.querySelector('.as-painel').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(el && el.closest('#ovBase')); }")
        foco = p.evaluate("() => { const a = document.activeElement; return a && a.matches('#baseLista .rt-regra.alvo') ? a.dataset.regra : (a && a.className); }")
        ok(cima and foco == 'TST-REGRA', f'a Base legal abre por cima do painel, com o foco na regra ({foco})')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        volta = p.evaluate("() => document.activeElement && document.activeElement.matches('.as-msgs a.fonte[data-regra]')")
        ok(not p.is_visible('#ovBase') and p.is_visible('.as-painel') and p.evaluate("() => document.getElementById('ovBase').style.zIndex === ''") and volta,
           'Esc fecha a Base legal (não o painel) e o foco volta pra fonte')
        p.click('.as-msgs a.fonte[data-regra]'); p.wait_for_selector('#ovBase.on', timeout=3000); p.wait_for_timeout(250)
        p.focus('.as-entrada textarea'); p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(not p.is_visible('#ovBase') and p.is_visible('.as-painel'), 'com o foco no painel e a Base legal por cima, Esc também fecha a de cima')

        # 3) histórico e resposta em fluxo de verdade
        p.evaluate('window.__demora = 0')
        p.evaluate("() => { document.querySelector('.as-lista .as-msg.ia:not(.as-saudacao)').__marca = 1; }")
        h = perguntar('E o intermunicipal?')
        ok(len(h['historico']) == 1 and h['historico'][0]['pergunta'] == 'Ônibus urbano tem alíquota zero?' and h['historico'][0]['resposta'].startswith('Não: é **isenção**') and h['conversa'] == corpo['conversa'],
           'a segunda pergunta leva a primeira (pergunta e resposta) e a mesma conversa')
        ficou = p.evaluate("() => { const m = document.querySelector('.as-lista .as-msg.ia:not(.as-saudacao)'); return !!m.__marca && m.querySelector('details').open; }")
        ok(ficou, 'a conversa que já estava na tela não é redesenhada: a lista de consultas aberta continua aberta')
        vivo = p.inner_text('.as-vivo')
        ok(vivo.startswith('Resposta: Por fora, crédito só com destaque') and p.get_attribute('.as-msgs', 'aria-live') is None,
           f'o leitor de tela ouve só a resposta nova, não a conversa inteira ({vivo[:50]})')
        r2 = ultima_ia()
        ok(r2 and 'Por fora, crédito só com destaque — sim' in r2['texto'] and '1 consulta' in r2['texto'], 'resposta em fluxo de verdade (Response lido em pedaços, acento partido): igual, com a consulta')
        regras2 = p.evaluate("() => { const ms = [...document.querySelectorAll('.as-msgs .as-msg.ia:not(.as-saudacao)')]; return [...ms[ms.length - 1].querySelectorAll('a.fonte[data-regra]')].map(a => a.textContent + '|' + a.dataset.regra); }")
        ok(regras2 == ['regra TST-REGRA|TST-REGRA', 'TST-OUTRA|TST-OUTRA'], f'"[regras A e B]": as duas regras viram link ({regras2})')
        mau = p.evaluate("() => [...document.querySelectorAll('.as-msgs .fonte')].filter(a => a.textContent === 'TST-MAU').map(a => a.tagName + ':' + a.getAttribute('href'))")
        ok(mau == ['SPAN:null'], f'endereço do Drive que não é do Google: a fonte aparece, sem link ({mau})')

        # 4) resposta com o painel fechado
        p.evaluate('window.__demora = 900')
        p.fill('.as-entrada textarea', 'Pergunta com o painel fechado?'); p.press('.as-entrada textarea', 'Enter'); p.wait_for_timeout(120)
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(1400)
        selo = p.evaluate("() => { const s = document.querySelector('.as-selo'); return s.hidden ? '' : s.textContent; }")
        ok(p.is_hidden('.as-painel') and selo == '1' and 'Respondi' in p.inner_text('.as-recado'), f'resposta com o painel fechado: selo no balão ({selo}) e o recado "Respondi"')
        ok('as-pensando' not in p.get_attribute(raiz, 'class'), 'a carinha para de ler quando a resposta chega')
        p.focus('.as-lancador'); p.keyboard.press('Escape'); p.wait_for_timeout(150)
        ok(p.is_hidden('.as-recado') and p.is_hidden('.as-painel') and not p.evaluate("() => document.querySelector('.as-selo').hidden"), 'Esc no balão fecha o recado (o selo fica)')
        p.click('.as-lancador'); p.wait_for_timeout(250)
        ok(p.evaluate("() => document.querySelector('.as-selo').hidden") and p.is_hidden('.as-recado') and 'Pergunta com o painel fechado?' in p.inner_text('.as-msgs'), 'abrindo, o selo some e a resposta está lá')
        p.evaluate('window.__demora = 0')

        # 5) conversa nova e a conversa guardada
        p.click('.as-acao[data-a="nova"]'); p.wait_for_timeout(200)
        ok(p.eval_on_selector_all('.as-msgs .as-msg', 'ms => ms.length') == 1 and 'Eu vejo tudo do sistema' in p.inner_text('.as-msgs'), '"Conversa nova" limpa (fica só a saudação)')
        n = perguntar('Do zero?')
        ok(n['historico'] == [] and n['conversa'] != corpo['conversa'], 'e a pergunta seguinte vai sem histórico, noutra conversa')
        p.reload(); p.wait_for_timeout(1500)
        ok(p.is_visible('.as-painel') and 'Do zero?' in p.inner_text('.as-msgs') and p.eval_on_selector_all('.as-msgs .as-msg', 'ms => ms.length') == 2,
           'recarregando a página, a conversa e o painel aberto continuam')
        ok(p.eval_on_selector_all('.as-msgs a.fonte[data-regra]', 'as => as.length') >= 1, 'e as fontes voltam como link')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 6) a ficha aberta
        p.click('#rtLista tr:has-text("LOJA DO CHAT DE TESTE LTDA")'); p.wait_for_selector('#ovFicha.on', timeout=3000); p.wait_for_timeout(400)
        ok(p.is_visible('.as-recado') and 'Quer entender o resultado de LOJA DO CHAT DE TESTE LTDA?' in p.inner_text('.as-recado'), 'abrindo a ficha: recado sobre a empresa')
        antes = len(chamadas())
        p.click('.as-recado .as-chip'); f1 = esperar_resposta(antes)
        ok(f1['pergunta'] == 'Por que esta empresa deu esse resultado?' and f1['contexto'].get('caso_id') == 'chk1' and f1['contexto'].get('tela') is None,
           f'a pergunta do recado abre o painel e vai com o caso, sem números da tela ({f1["contexto"]})')
        ok(p.is_visible('.as-ctx') and p.inner_text('.as-ctx b') == 'LOJA DO CHAT DE TESTE LTDA' and p.is_checked('.as-ctx input'), 'em cima, "Sobre a ficha aberta" com o nome, marcado')
        ok(p.eval_on_selector_all('.as-msgs .as-nota', 'ns => ns.map(n => n.textContent)') == ['Sobre a ficha de LOJA DO CHAT DE TESTE LTDA'] and f1['historico'] == [],
           'a conversa marca a troca para a ficha; o histórico de antes (sem ficha) não vai junto')
        seg = p.eval_on_selector_all('.as-msgs .as-chips-conversa .as-chip', 'bs => bs.map(b => b.textContent)')
        ok('O que falta medir e a partir de quanto o resultado vira?' in seg and 'Por que esta empresa deu esse resultado?' not in seg, f'depois da resposta, as perguntas seguintes sobre a empresa ({seg})')
        antes = len(chamadas())
        p.click('.as-msgs .as-chips-conversa .as-chip:has-text("O que falta medir")'); f2 = esperar_resposta(antes)
        ok([x['pergunta'] for x in f2['historico']] == ['Por que esta empresa deu esse resultado?'] and p.evaluate("() => document.activeElement === document.querySelector('.as-entrada textarea')"),
           'a pergunta pronta vai com o histórico da mesma ficha, e o foco volta pra caixa')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(100)
        p.click('#bCalcular'); p.wait_for_timeout(500)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        fa = perguntar('E agora?')
        tela = fa['contexto'].get('tela') or {}
        ok([x['pergunta'] for x in fa['historico']] == ['Por que esta empresa deu esse resultado?', 'O que falta medir e a partir de quanto o resultado vira?'],
           f'na mesma ficha, o histórico é o dela ({[x["pergunta"][:20] for x in fa["historico"]]})')
        ok((tela.get('input') or {}).get('receita') == 50000 and (tela.get('input') or {}).get('pctImpostoEmbutido') == 12 and isinstance(tela.get('procedencia'), dict),
           f'depois de "Calcular", vão os números da tela e a procedência (receita {(tela.get("input") or {}).get("receita")})')
        ok(tela.get('natureza') == {'mercadoria': 45000, 'servico': 5000}, f'e a natureza das vendas do Domínio da ficha ({tela.get("natureza")})')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(100)
        p.fill('#sPctPJ', '55'); p.dispatch_event('#sPctPJ', 'input'); p.wait_for_timeout(100)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        t3 = perguntar('E com o campo mudado?')['contexto'].get('tela') or {}
        ok((t3.get('input') or {}).get('pctPJ') == 10 and (t3.get('procedencia') or {}).get('pctPJ') == (tela.get('procedencia') or {}).get('pctPJ'),
           f'campo mudado sem "Calcular": vai o retrato do último cálculo (% PJ {(t3.get("input") or {}).get("pctPJ")})')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(100)
        p.click('#bGravar'); p.wait_for_function("() => /gravada/.test(document.querySelector('#bMsg').textContent)", timeout=4000)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        f4 = perguntar('E depois de gravar?')['contexto']
        ok(f4.get('caso_id') == 'chk1' and f4.get('tela') is None, f'depois de "Gravar", vai só o caso (o assistente lê a gravada) ({f4})')
        p.uncheck('.as-ctx input')
        sc = perguntar('Sem o caso?')
        ok(sc['contexto'] == {'pagina': {'caminho': 'fiscal-reforma.html', 'nome': 'Reforma Tributária', 'setor': 'fiscal'}} and [x['pergunta'] for x in sc['historico']] == ['Do zero?'], 'desmarcando o caso, a pergunta vai sem ele (só a tela), com o histórico de fora da ficha')
        notas = p.eval_on_selector_all('.as-msgs .as-nota', 'ns => ns.map(n => n.textContent)')
        ok(notas == ['Sobre a ficha de LOJA DO CHAT DE TESTE LTDA', 'Pergunta geral'], f'as notas marcam só as trocas de contexto ({notas})')
        p.check('.as-ctx input')
        p.focus('.as-entrada textarea'); p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(p.is_hidden('.as-painel') and p.is_visible('#ovFicha'), 'Esc no painel fecha o painel e deixa a ficha aberta')
        p.click('#fiFechar'); p.wait_for_timeout(200)
        p.click('.as-lancador'); p.wait_for_timeout(200)
        ok(p.is_hidden('.as-ctx'), 'fechando a ficha, a faixa do caso some')

        # 7) erros
        perguntar('teste de limite')
        err = ultima_ia()
        ok(err and 'erro' in err['classe'] and 'limite de 60 perguntas por dia' in err['texto'], f'erro da função: a mensagem dela em vermelho ({(err or {}).get("texto", "").split(chr(10))[0][:60]})')
        ok(p.input_value('.as-entrada textarea') == 'teste de limite' and not p.is_disabled('.as-enviar'), 'a pergunta volta pra caixa e o botão libera')
        perguntar('teste de sessão vencida')
        e401 = ultima_ia()
        ok(e401 and 'Sua sessão expirou' in e401['texto'] and 'non-2xx' not in e401['texto'], f'erro sem o texto da função (401): em português, pelo código ({(e401 or {}).get("texto", "").split(chr(10))[0][:60]})')

        ok(not p.evaluate('window.__xss'), 'nada do texto das respostas ou dos endereços rodou como código')
        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')

        # 8) conversa guardada fora do formato
        p2 = b.new_page(viewport={'width': 1400, 'height': 950}); erros2 = []
        p2.on('pageerror', lambda e: erros2.append(str(e)))
        p2.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p2.add_init_script(SEMEAR)
        p2.goto(base + 'fiscal-reforma.html'); p2.wait_for_timeout(800)
        for guardado in ['{quebrado', '[1,2,3]', '{"msgs":[{"tipo":"eu","texto":"versão sem v"}]}', '{"v":1,"msgs":"x","historico":{"a":1},"naoLidas":"abc","aberto":"sim"}']:
            p2.evaluate('t => sessionStorage.setItem("mr_assistente:escritorio", t)', guardado); p2.reload(); p2.wait_for_timeout(700)
            p2.click('.as-lancador'); p2.wait_for_timeout(150)
            vazio = p2.is_visible('.as-painel') and 'Eu vejo tudo do sistema' in p2.inner_text('.as-msgs')
            p2.click('.as-lancador'); p2.wait_for_timeout(100)
            ok(vazio and not erros2, f'guardado fora do formato ({guardado[:28]}): a tela sobe e o assistente começa do zero ({erros2[:1]})')
        p2.evaluate('t => sessionStorage.setItem("mr_assistente:escritorio", t)', json.dumps({'v': 1, 'msgs': [None, {'tipo': 'eu', 'texto': 5}, {'tipo': 'ia', 'texto': 'Resposta guardada.', 'etapas': 'x'}], 'historico': [{'pergunta': 1}]}))
        p2.reload(); p2.wait_for_timeout(700); p2.click('.as-lancador'); p2.wait_for_timeout(150)
        ok(p2.eval_on_selector_all('.as-msgs .as-msg', 'ms => ms.map(m => m.innerText.split(String.fromCharCode(10))[0])') == ['Resposta guardada.'] and not erros2,
           'mensagens estranhas no meio: fica com as que prestam')
        p2.close()

        # 9) no celular
        p3 = b.new_page(viewport={'width': 390, 'height': 800}); erros3 = []
        p3.on('pageerror', lambda e: erros3.append(str(e)))
        p3.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
        p3.add_init_script(SEMEAR)
        p3.goto(base + 'fiscal-reforma.html'); p3.wait_for_timeout(800)
        p3.click('.as-lancador'); p3.wait_for_timeout(250)
        cx = p3.eval_on_selector('.as-painel', 'e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }')
        ok(cx == [0, 0, 390, 800] and p3.is_hidden('.as-lancador') and p3.evaluate("() => document.documentElement.classList.contains('as-painel-aberto')")
           and p3.evaluate("() => document.activeElement !== document.querySelector('.as-entrada textarea')"),
           f'no celular, o painel ocupa a tela, o balão some e o teclado não sobe sozinho ({cx})')
        p3.reload(); p3.wait_for_timeout(800)
        ok(p3.is_hidden('.as-painel') and p3.is_visible('.as-lancador') and not p3.evaluate("() => document.documentElement.classList.contains('as-painel-aberto')") and not erros3,
           'recarregando no celular, o painel não reabre sozinho por cima da tela')
        p3.close()
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
