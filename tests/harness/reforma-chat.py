"""Teste do chat da Reforma ("Perguntar à base", 14/10/2026) na tela (fiscal-reforma.html). A Edge Function reforma-chat entra
como dublê, por window.__mockInvoke: devolve as etapas e a resposta no mesmo formato da função de verdade (text/event-stream,
"data: {...}"). A busca, as ferramentas e o laço com o modelo têm teste próprio em tests/reforma-chat.test.mjs.
Sem login e sem banco: mesmo mock do conferir.py. Clientes, casos, materiais e regras (inventados) entram no banco falso por
uma armadilha em window.__mockDb, só nesta página.

    python tests/harness/reforma-chat.py

Confere:
  1. o botão "Perguntar à base" da lista abre o chat sem caso: boas-vindas com perguntas de exemplo (o clique preenche a caixa);
  2. Enter envia: a função recebe a pergunta, a conversa, "fluxo" e nenhum caso; a resposta aparece com negrito, lista e as
     fontes clicáveis — o material abre o original no Drive (nova aba), a regra abre a Base legal por cima do chat; texto da
     resposta nunca vira HTML (uma tag no meio sai como texto); embaixo, as consultas que o chat fez;
  3. a segunda pergunta leva a primeira como histórico; "Nova conversa" esquece;
  4. na ficha, "Perguntar sobre este caso" abre o chat com o caso (o nome aparece em cima) e a conversa começa de novo; depois
     de "Calcular", a pergunta leva os números da tela; desmarcando o caso, a pergunta vai sem ele;
  5. erro da função (limite do dia): a mensagem dela aparece em vermelho e a pergunta volta pra caixa;
  6. a tela não dá erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
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
          'sim_obs': json.dumps({'input': ENT, 'veredito': 'MANTENHA', 'frase': 'Frase de teste.', 'calculado_em': '2026-10-14'}), 'fundamento': None, 'obs': 'teste'}]
MATERIAIS = [{'id': 'm1', 'codigo': 'TST-LEI', 'titulo': 'Lei de teste', 'tipo': 'norma', 'drive_url': 'https://drive.google.com/file/d/teste/view', 'ativo': True},
             {'id': 'm2', 'codigo': 'TST-AULA', 'titulo': 'Aula de teste', 'tipo': 'aula', 'drive_url': None, 'ativo': True}]
REGRAS = [{'id': 'r1', 'codigo': 'TST-REGRA', 'titulo': 'Regra de teste', 'dispositivo': 'art. 1º', 'regra': 'Texto da regra de teste.', 'aplica_a': 'todos', 'efeito': '—',
           'fonte': '—', 'verificado_em': '2026-10-14', 'ativo': True}]
def faixas(pcts):
    lims = [180000, 360000, 720000, 1800000, 3600000, 4800000]
    return [{'ate': l, 'cbs': p, 'ibs': 0, 'pct': p} for l, p in zip(lims, pcts)]
PARAMS = [{'chave': 'aliq_ref_2027', 'valor': {'cbs': 9.3, 'ibs': 0.1, 'cbs_aplicada': 9.2}},
          {'chave': 'partilha_cbs_ibs', 'valor': {'anexos': {'I': faixas([15.5, 15.5, 15.5, 15.5, 15.5, 34.02]), 'II': faixas([14, 14, 14, 14, 14, 25.22]),
           'III': faixas([15.6, 17.1, 16.6, 16.6, 15.6, 19.29]), 'IV': faixas([21.5, 25, 24, 23, 22, 24.7]), 'V': faixas([17.15, 17.15, 18.15, 19.15, 17.15, 19.78])}}}]
RESPOSTA = ('Não: é **isenção**, não alíquota zero [TST-LEI, art. 157] · [regra TST-REGRA].\n\n- primeiro ponto [TST-AULA, slide 3]\n- texto com <img src=x onerror="window.__xss=1"> no meio\n'
            '- código que não existe [M99-NADA, p. 1]')
SEMEAR = """
(() => {
  const CLIENTES = %s, CASOS = %s, PARAMS = %s, MATERIAIS = %s, REGRAS = %s, RESPOSTA = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); (v.rt_casos || (v.rt_casos = [])).push(...CASOS); v.rt_parametros = PARAMS;
    v.rt_materiais = MATERIAIS; v.rt_regras = REGRAS; v.rt_regra_materiais = []; v.nf_documentos = []; v.nf_itens = []; v.rt_ncm_regras = [];
  } });
  window.__chamadas = [];
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    if (/limite/.test(opts.body.pergunta)) return { data: null, error: { message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ erro: 'Você chegou ao limite de 60 perguntas por dia. Amanhã libera de novo.' }), { status: 429 }) } };
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    return { data: ev({ tipo: 'etapa', texto: 'Buscando na base: "isenção"' }) + ev({ tipo: 'etapa', texto: 'Lendo TST-LEI' }) + ev({ tipo: 'resposta', texto: RESPOSTA, fontes: [] }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, CASOS, PARAMS, MATERIAIS, REGRAS, RESPOSTA))

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
        p.goto(base + 'fiscal-reforma.html'); p.wait_for_timeout(1500)
        chamadas = lambda: p.evaluate('window.__chamadas')

        # 1) abre pela lista, sem caso
        p.click('#btnChat'); p.wait_for_selector('#ovChat.on', timeout=3000)
        ok(p.is_hidden('#chatCtx'), 'aberto pela lista: sem caso (a barra do caso fica escondida)')
        exemplos = p.eval_on_selector_all('#chatMsgs .rt-chat-ex button', 'bs => bs.map(b => b.textContent)')
        ok(len(exemplos) == 3 and any('fica por dentro' in e for e in exemplos), f'boas-vindas com 3 perguntas de exemplo ({exemplos})')
        p.click('#chatMsgs .rt-chat-ex button >> nth=1')
        ok(p.input_value('#chatTexto') == exemplos[1], 'o exemplo clicado vai pra caixa')

        # 2) Enter envia; a resposta aparece com as fontes
        p.fill('#chatTexto', 'Ônibus urbano tem alíquota zero?')
        p.press('#chatTexto', 'Enter')
        p.wait_for_function("() => document.querySelectorAll('#chatMsgs .rt-chat-msg.ia').length >= 2 && !/escrevendo/.test(document.querySelector('#chatMsgs .rt-chat-msg.ia:last-child').textContent)", timeout=5000)
        c = chamadas()
        ok(len(c) == 1 and c[0]['nome'] == 'reforma-chat', 'Enter chama a função reforma-chat')
        corpo = c[0]['body']
        ok(corpo.get('pergunta') == 'Ônibus urbano tem alíquota zero?' and corpo.get('fluxo') is True and corpo.get('historico') == [] and corpo.get('contexto') == {} and len(corpo.get('conversa') or '') == 36,
           f'vai a pergunta, a conversa, "fluxo", sem histórico e sem caso ({ {k: corpo.get(k) for k in ("fluxo", "historico", "contexto")} })')
        ok(p.input_value('#chatTexto') == '', 'a caixa esvazia')
        ultima = '#chatMsgs .rt-chat-msg.ia:last-child'
        ok(p.inner_html(ultima).startswith('<p>Não: é <b>isenção</b>, não alíquota zero'), 'a resposta com negrito')
        lei = p.eval_on_selector(ultima + ' a.fonte[href]', 'a => ({ t: a.textContent, href: a.getAttribute("href"), alvo: a.target, rel: a.rel, tit: a.title })')
        ok(lei['t'] == 'TST-LEI' and lei['href'] == 'https://drive.google.com/file/d/teste/view' and lei['alvo'] == '_blank' and 'noopener' in lei['rel'] and 'Lei de teste' in lei['tit'],
           f'o material citado abre o original no Drive, em outra aba ({lei})')
        ok(p.eval_on_selector_all(ultima + ' a.fonte[data-regra]', 'as => as.map(a => a.textContent + "|" + a.dataset.regra)') == ['regra TST-REGRA|TST-REGRA'], 'a regra citada vira link pra Base legal')
        ok(p.eval_on_selector_all(ultima + ' li', 'ls => ls.length') == 3 and p.eval_on_selector_all(ultima + ' a.fonte', 'as => as.map(a => a.textContent)') == ['TST-LEI', 'regra TST-REGRA', 'TST-AULA'],
           'a lista e a fonte dentro dela (o material sem link do Drive aparece como fonte, sem endereço)')
        ok('[M99-NADA, p. 1]' in p.inner_text(ultima) and p.eval_on_selector_all(ultima + ' a.fonte', 'as => as.filter(a => a.textContent === "M99-NADA").length') == 0,
           'código que não existe na base fica como texto, sem link')
        ok(p.eval_on_selector_all(ultima + ' img', 'is => is.length') == 0 and '<img src=x' in p.inner_text(ultima) and not p.evaluate('window.__xss'),
           'tag no meio da resposta sai como texto (nunca vira HTML)')
        ok('2 consultas: Buscando na base: "isenção" · Lendo TST-LEI' in p.inner_text(ultima), 'embaixo, as consultas que o chat fez')
        p.click(ultima + ' a.fonte[data-regra]'); p.wait_for_selector('#ovBase.on', timeout=3000)
        sobre = p.evaluate("() => { const o = [...document.querySelectorAll('.rg-ov.on')]; return o.map(x => x.id); }")
        ok(sobre[-1] == 'ovBase' and 'ovChat' in sobre, f'a Base legal abre por cima do chat ({sobre})')
        p.click('#baseFechar'); p.wait_for_timeout(200)
        ok(p.is_visible('#ovChat'), 'fechando a Base legal, o chat continua lá')

        # 3) histórico e "Nova conversa"
        p.fill('#chatTexto', 'E o intermunicipal?'); p.click('#chatEnviar'); p.wait_for_function('() => window.__chamadas.length === 2', timeout=3000); p.wait_for_timeout(300)
        h = chamadas()[1]['body']
        ok(len(h['historico']) == 1 and h['historico'][0]['pergunta'] == 'Ônibus urbano tem alíquota zero?' and h['historico'][0]['resposta'].startswith('Não: é **isenção**')
           and h['conversa'] == corpo['conversa'], 'a segunda pergunta leva a primeira (pergunta e resposta) e a mesma conversa')
        p.click('#chatNova'); p.wait_for_timeout(200)
        ok(p.eval_on_selector_all('#chatMsgs .rt-chat-msg', 'ms => ms.length') == 1, '"Nova conversa" limpa a tela (fica só a boas-vindas)')
        p.fill('#chatTexto', 'Do zero?'); p.press('#chatTexto', 'Enter'); p.wait_for_function('() => window.__chamadas.length === 3', timeout=3000); p.wait_for_timeout(300)
        n = chamadas()[2]['body']
        ok(n['historico'] == [] and n['conversa'] != corpo['conversa'], 'e a pergunta seguinte vai sem histórico, noutra conversa')
        p.click('#chatFechar'); p.wait_for_timeout(200)

        # 4) pela ficha: com o caso e os números da tela
        p.click('#rtLista tr:has-text("LOJA DO CHAT DE TESTE LTDA")'); p.wait_for_selector('#ovFicha.on', timeout=3000); p.wait_for_timeout(300)
        p.click('#fiChat'); p.wait_for_selector('#ovChat.on', timeout=3000)
        ok(p.is_visible('#chatCtx') and p.inner_text('#chatFichaNome') == 'LOJA DO CHAT DE TESTE LTDA' and p.is_checked('#chatUsarFicha'), 'da ficha: o caso aparece em cima, marcado')
        ok(p.eval_on_selector_all('#chatMsgs .rt-chat-msg', 'ms => ms.length') == 1 and 'LOJA DO CHAT DE TESTE LTDA' in p.inner_text('#chatMsgs'), 'a conversa começa de novo, com exemplos sobre a empresa')
        p.fill('#chatTexto', 'Por que deu esse resultado?'); p.press('#chatTexto', 'Enter'); p.wait_for_function('() => window.__chamadas.length === 4', timeout=3000); p.wait_for_timeout(300)
        f1 = chamadas()[3]['body']['contexto']
        ok(f1.get('caso_id') == 'chk1' and f1.get('tela') is None, f'vai o caso; sem "Calcular", sem números da tela ({f1})')
        p.click('#chatFechar'); p.wait_for_timeout(200)
        p.click('#bCalcular'); p.wait_for_timeout(500)
        p.click('#fiChat'); p.wait_for_selector('#ovChat.on', timeout=3000)
        ok(p.eval_on_selector_all('#chatMsgs .rt-chat-msg', 'ms => ms.length') >= 3, 'reabrindo no mesmo caso, a conversa continua')
        p.fill('#chatTexto', 'E agora?'); p.press('#chatTexto', 'Enter'); p.wait_for_function('() => window.__chamadas.length === 5', timeout=3000); p.wait_for_timeout(300)
        f2 = chamadas()[4]['body']['contexto']
        tela = f2.get('tela') or {}
        ok(f2.get('caso_id') == 'chk1' and (tela.get('input') or {}).get('receita') == 50000 and (tela.get('input') or {}).get('pctImpostoEmbutido') == 12 and isinstance(tela.get('procedencia'), dict),
           f'depois de "Calcular", vão os números da tela e a procedência (receita {(tela.get("input") or {}).get("receita")})')
        p.uncheck('#chatUsarFicha')
        p.fill('#chatTexto', 'Sem o caso?'); p.press('#chatTexto', 'Enter'); p.wait_for_function('() => window.__chamadas.length === 6', timeout=3000); p.wait_for_timeout(300)
        ok(chamadas()[5]['body']['contexto'] == {}, 'desmarcando o caso, a pergunta vai sem ele')

        # 5) erro da função
        p.fill('#chatTexto', 'teste de limite'); p.press('#chatTexto', 'Enter'); p.wait_for_function('() => window.__chamadas.length === 7', timeout=3000); p.wait_for_timeout(400)
        err = p.eval_on_selector('#chatMsgs .rt-chat-msg.ia:last-child', 'd => ({ c: d.className, t: d.textContent })')
        ok('erro' in err['c'] and 'limite de 60 perguntas por dia' in err['t'], f'erro da função: a mensagem dela em vermelho ({err["t"][:60]})')
        ok(p.input_value('#chatTexto') == 'teste de limite' and not p.is_disabled('#chatEnviar'), 'a pergunta volta pra caixa e o botão libera')

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
