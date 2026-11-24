"""Os planos do MEI pro WhatsApp (24/11/2026, pedidos do Samuel): as imagens dos planos do MEI pro cliente (a primeira com
os planos e o recomendado, as outras com tudo o que cada um inclui, nenhuma com mais de 1600 px de altura) e a mensagem
pronta, numa janela só (assets/js/mei-planos-janela.js) aberta em duas telas: a aba MEI da Precificação
(comercial-precificacao.html) e o produto "Planos do MEI" da Vitrine de serviços (comercial-servicos.html). Sem login e
sem banco: o mock do conferir.py, com um catálogo de planos inventado semeado em window.__mockDb.

    python tests/harness/precificacao-mei-whats.py

Confere:
  1. o link direto ?aba=mei abre nos planos;
  2. sem plano marcado, a janela recomenda o mais simples: as imagens com 1080 px de largura e no máximo 1600 de altura,
     e a mensagem com o primeiro nome do cliente, quem fala, o plano e quantas imagens;
  3. copiar a mensagem e a imagem; baixar uma imagem e todas (o nome do arquivo com o cliente);
  4. o plano marcado na tela é o recomendado, e na janela dá pra mudar (os botões dos planos); as notas do plano vêm do
     campo da tela;
  5. Esc fecha a janela; nada é gravado no banco;
  6. na Vitrine: o botão no cartão do produto (e só nele) abre a janela, não a ficha; os planos lidos do banco; o nome do
     cliente muda a mensagem; a lista grande vai em mais de uma imagem; o compartilhar manda todas com a mensagem;
  7. na ficha do produto, o "Material pro cliente" abre a janela por cima da ficha; Esc fecha a janela e a ficha fica;
  8. a leitura dos planos que falha avisa em português, sem o erro do banco;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

QUESTOES = [{'id': 'A1', 'bloco': 'A. DADOS GERAIS', 'tipo': 'texto', 'pergunta': 'Nome da empresa / cliente', 'opcoes': None, 'ajuda': '', 'externa': False, 'ativo': True, 'ordem': 1},
    {'id': 'A4', 'bloco': 'A. DADOS GERAIS', 'tipo': 'select', 'pergunta': 'Tipo societário', 'opcoes': ['MEI', 'LTDA'], 'ajuda': '', 'externa': False, 'ativo': True, 'ordem': 2}]
PLANOS = [{'id': 'cresce', 'nome': 'MEI CRESCE MAIS', 'slogan': 'Pra quem quer mais acompanhamento', 'valor_mensal': 300, 'ativo': True, 'ordem': 1},
    {'id': 'basico', 'nome': 'MEI BÁSICO', 'slogan': 'O essencial do mês', 'valor_mensal': 200, 'ativo': True, 'ordem': 2},
    {'id': 'equipe', 'nome': 'MEI EQUIPE', 'slogan': 'Pra quem tem funcionário', 'valor_mensal': 300, 'ativo': True, 'ordem': 3}]
def S(id, nome, grupo, ordem, **o):
    return {'id': id, 'nome': nome, 'grupo': grupo, 'tipo': o.get('tipo', 'incluso'), 'valor_avulso': o.get('valor'), 'ativo': True, 'ordem': ordem}
SERVICOS = [S('das', 'Envio da guia mensal (DAS)', 'mensal', 1), S('nfs_plano', 'Emissão de NFs inclusas no plano (até X/mês)', 'mensal', 2),
    S('reuniao', 'Reunião do mês', 'mensal', 3), S('folha', 'Folha do mês', 'mensal', 4), S('sitfiscal', 'Acompanhamento na Receita', 'semestral', 5),
    S('dasn', 'Declaração Anual do MEI', 'anual', 6), S('hist', 'Histórico de notas/faturamento/produtos/fornecedores/clientes', 'anual', 7),
    S('baixa', 'Baixa do MEI', 'demanda', 8), S('nf_avulsa', 'Notas além do plano', 'separado', 9, tipo='quantidade', valor=4)]
COMP = [('basico', s) for s in ('das', 'nfs_plano', 'sitfiscal', 'dasn', 'hist', 'baixa')] + [('cresce', s) for s in ('das', 'reuniao', 'sitfiscal', 'dasn', 'baixa')] \
    + [('equipe', s) for s in ('das', 'folha', 'sitfiscal', 'dasn', 'baixa')]
# a lista grande (a da Vitrine): 30 serviços com nomes longos, pra lista não caber numa imagem só
GRANDES = [S('g%02d' % i, 'Serviço inventado número %d, com um nome comprido que ocupa duas linhas na lista' % i, ['mensal', 'semestral', 'anual', 'demanda'][i % 4], 10 + i) for i in range(30)]
COMP_GRANDE = COMP + [(['basico', 'cresce', 'equipe'][i % 3], 'g%02d' % i) for i in range(30)]
def V(id, slug, nome, **o):
    base = {'id': id, 'slug': slug, 'nome': nome, 'resumo': 'Inventado, só pro teste.', 'publico': None, 'modelo': 'pago', 'preco': 200, 'preco_obs': None, 'situacao': 'preparo',
            'motivo': None, 'janela_ate': None, 'parar_em': None, 'parar_criterio': None, 'link_pagina': None, 'link_prototipo': 'comercial-precificacao.html?aba=mei', 'quem_assina': None,
            'responsavel': 'Samuel', 'regua': {}, 'origem': None, 'observacao': None, 'ordem': 0, 'no_ar_desde': None, 'encerrado_em': None, 'criado_por': 'Claude',
            'criado_em': '2026-11-24T12:00:00+00:00', 'atualizado_por': 'Claude', 'atualizado_em': '2026-11-24T12:00:00+00:00'}
    base.update(o); return base
VITRINE = [V('sMei', 'planos-mei', 'Planos do MEI'), V('sOutro', 'outro-servico', 'Outro serviço inventado', link_prototipo=None, situacao='ideia')]
SEMEAR = """
(() => {
  const X = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const grande = !!window.__catalogoGrande;
    v.precificacao_questoes = X.QUESTOES; v.precificacao_parametros = []; v.precificacao_obrigacoes = [];
    v.mei_planos = X.PLANOS; v.mei_servicos = grande ? X.SERVICOS.concat(X.GRANDES) : X.SERVICOS;
    v.mei_plano_servicos = (grande ? X.COMP_GRANDE : X.COMP).map(([p, s]) => ({ plano_id: p, servico_id: s }));
    v.precificacoes = []; v.servicos_digitais = X.VITRINE.map(s => ({ ...s })); v.servicos_vendas = [];
  } });
})();
""" % json.dumps({'QUESTOES': QUESTOES, 'PLANOS': PLANOS, 'SERVICOS': SERVICOS, 'COMP': COMP, 'GRANDES': GRANDES, 'COMP_GRANDE': COMP_GRANDE, 'VITRINE': VITRINE}, ensure_ascii=False)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
# o compartilhar do sistema (o Chromium de teste, no Linux, não tem): guarda o que mandaria
COMPARTILHAR = """(() => {
  Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: function (d) { return !!(d && d.files && d.files.length); } });
  Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async function (d) { window.__compartilhado = { n: d.files.length, nomes: d.files.map(f => f.name), tipos: d.files.map(f => f.type), texto: d.text || '' }; } });
})()"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def espera(p, js, ms=8000):
    try:
        p.wait_for_function(js, timeout=ms); return True
    except Exception:
        return False

ABERTA = "() => { const o = document.getElementById('ovPlanosMei'); return !!o && getComputedStyle(o).display === 'flex'; }"
FECHADA = "() => { const o = document.getElementById('ovPlanosMei'); return !o || getComputedStyle(o).display === 'none'; }"
PRONTAS = "() => { const i = [...document.querySelectorAll('#pmImagens img')]; return i.length >= 2 && i.every(x => x.complete && x.naturalWidth > 0) && /^Pronto/.test(document.getElementById('pmStatus').textContent); }"
TAMANHOS = "() => [...document.querySelectorAll('#pmImagens img')].map(i => [i.naturalWidth, i.naturalHeight])"

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 950}, accept_downloads=True)
        cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
        erros = []
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        txt = lambda sel: p.inner_text(sel).replace('\xa0', ' ')

        print('1. O link direto')
        p.goto(base + 'comercial-precificacao.html?aba=mei')
        ok(espera(p, "() => document.getElementById('vMei').style.display === 'block' && document.querySelectorAll('#meiCards .mei-card').length === 3"),
           'abre na aba MEI, com os três planos')
        ok(p.is_visible('#meiWhats') and 'Planos pro WhatsApp' in txt('#meiWhats'), 'o botão "Planos pro WhatsApp" no painel')

        print('2. Sem plano marcado: o mais simples')
        p.fill('#meiCliente', '12.345.678 FULANA DE TAL')
        p.click('#meiWhats')
        ok(espera(p, ABERTA), 'a janela abre')
        ok(espera(p, PRONTAS), 'as imagens ficam prontas')
        tam = p.evaluate(TAMANHOS)
        ok(len(tam) >= 2 and all(w == 1080 and 600 < h <= 1600 for w, h in tam), 'todas com 1080 px de largura e no máximo 1600 de altura → ' + str(tam))
        ok(p.input_value('#pmCliente') == '12.345.678 FULANA DE TAL', 'o cliente da tela vem pra janela')
        ok(p.evaluate("() => [...document.querySelectorAll('[data-pm-plano]')].map(b => b.dataset.pmPlano + ':' + b.getAttribute('aria-pressed')).join(',')") == 'basico:true,cresce:false,equipe:false',
           'os botões dos planos, do mais simples pro mais caro, com o mais simples escolhido')
        ok(txt('#pmRecomenda').startswith('Recomendado: MEI BÁSICO, o mais simples.'), 'o aviso diz o recomendado e o porquê → ' + txt('#pmRecomenda'))
        msg = p.input_value('#pmMsg')
        n = len(tam)
        ok(msg.startswith('Oi, Fulana! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.') and 'eu recomendo o MEI BÁSICO, de R$ 200,00 por mês' in msg,
           'a mensagem: o primeiro nome, quem fala e o plano')
        ok(('Te mandei duas imagens' if n == 2 else 'Te mandei') in msg, 'a mensagem diz quantas imagens')
        ok('Todos já incluem a guia do DAS todo mês, a declaração anual e o acompanhamento na Receita Federal.' in msg, 'o que todos os planos têm')
        ok(p.input_value('#pmNfs') == '2', 'as notas do plano: o padrão do folder, sem o campo da tela preenchido')
        ok(p.evaluate("() => getComputedStyle(document.getElementById('pmCompartilhar')).display") == 'none', 'sem o compartilhar do sistema, o botão não aparece')

        print('3. Copiar e baixar')
        p.fill('#pmMsg', msg + '\nAbraço!')
        p.click('#pmCopiarMsg')
        ok(espera(p, "() => document.getElementById('pmStatus').textContent.includes('Mensagem copiada')"), 'copiar a mensagem avisa')
        ok(p.evaluate('navigator.clipboard.readText()').endswith('Abraço!'), 'copia a mensagem como foi editada')
        p.click('[data-pm-copiar="0"]')
        ok(espera(p, "() => /Imagem 1 copiada|não deixou copiar/.test(document.getElementById('pmStatus').textContent)"), 'copiar a imagem responde → ' + txt('#pmStatus'))
        if 'Imagem 1 copiada' in txt('#pmStatus'):
            ok(txt('[data-pm-copiar="0"]') == '✓ Copiada' and 'Depois, a 2.' in txt('#pmStatus'), 'a imagem copiada fica marcada, e o aviso diz a próxima')
        with p.expect_download() as d:
            p.click('[data-pm-baixar="1"]')
        ok(d.value.suggested_filename == f'Planos MEI - Fulana (2 de {n}).png', 'baixar a imagem: o nome com o cliente → ' + d.value.suggested_filename)
        baixados = []
        p.on('download', lambda x: baixados.append(x.suggested_filename))
        p.click('#pmBaixarTodas')
        espera(p, "() => document.getElementById('pmStatus').textContent.includes('baixadas')", 5000)
        p.wait_for_timeout(600)
        ok(baixados and baixados[0] == f'Planos MEI - Fulana (1 de {n}).png' and f'{n} imagens baixadas' in txt('#pmStatus'),
           f'baixar todas: as {n}, na ordem → ' + str(baixados))

        print('4. O plano marcado é o recomendado; na janela dá pra mudar')
        p.click('#pmFechar')
        ok(espera(p, FECHADA), 'fechar pelo ×')
        p.click('#meiCards [data-base="basico"]')
        p.fill('#meiX', '4')
        p.click('#meiCards [data-base="equipe"]')
        p.click('#meiWhats')
        ok(espera(p, PRONTAS), 'as imagens de novo')
        ok(p.input_value('#pmNfs') == '4', 'as notas do plano vêm do campo da tela')
        msg = p.input_value('#pmMsg')
        ok(txt('#pmRecomenda').startswith('Recomendados: MEI BÁSICO + MEI EQUIPE, R$ 500,00 por mês, juntos.'), 'o aviso: os marcados na tela → ' + txt('#pmRecomenda'))
        ok('eu recomendo o MEI BÁSICO (R$ 200,00) e o MEI EQUIPE (R$ 300,00): R$ 500,00 por mês, juntos.' in msg, 'a mensagem: os dois e a soma')
        p.click('[data-pm-plano="basico"]')
        ok(espera(p, "() => document.getElementById('pmMsg').value.includes('eu recomendo o MEI EQUIPE, de R$ 300,00 por mês. Pra quem tem funcionário.')"),
           'tirar um plano na janela muda a recomendação e a mensagem')
        p.click('[data-pm-plano="equipe"]')
        ok(espera(p, "() => document.querySelector('[data-pm-plano=\"basico\"]').getAttribute('aria-pressed') === 'true' && document.getElementById('pmMsg').value.includes('MEI BÁSICO, de R$ 200,00')"),
           'sem nenhum escolhido, volta o mais simples')

        print('5. Esc fecha; nada gravado')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha a janela')
        ok(p.evaluate('() => window.__mockDb.precificacoes.length') == 0, 'nada vai pras propostas')
        p.close()

        print('6. Na Vitrine de serviços: o produto "Planos do MEI"')
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script('window.__catalogoGrande = true'); p.add_init_script(SEMEAR); p.add_init_script(COMPARTILHAR)
        p.goto(base + 'comercial-servicos.html')
        ok(espera(p, "() => document.querySelectorAll('#vitrine .sv-card').length === 2"), 'a vitrine com os dois serviços')
        ok(p.evaluate("() => [...document.querySelectorAll('[data-material]')].map(b => b.closest('.sv-card').dataset.slug).join(',')") == 'planos-mei',
           'o botão do material só no cartão do produto que tem')
        ok(txt('[data-material="planos-mei"]') == '📲 Planos pro WhatsApp', 'o botão: "Planos pro WhatsApp"')
        p.click('[data-material="planos-mei"]')
        ok(espera(p, ABERTA), 'o botão abre a janela')
        ok(not p.evaluate("() => document.getElementById('ovServico').classList.contains('is-open')"), 'e não a ficha')
        ok(espera(p, PRONTAS, 12000), 'as imagens ficam prontas, com os planos lidos do banco')
        ok(p.evaluate("() => document.querySelectorAll('[data-pm-plano]').length") == 3, 'os três planos do banco')
        tam = p.evaluate(TAMANHOS)
        ok(len(tam) >= 3 and all(w == 1080 and h <= 1600 for w, h in tam), 'a lista grande vai em mais de uma imagem, nenhuma acima de 1600 px → ' + str(tam))
        n = len(tam)
        msg = p.input_value('#pmMsg')
        ok(msg.startswith('Oi! Tudo bem? Aqui é o Samuel,'), 'sem cliente, a mensagem sem nome')
        ok('Te mandei ' in msg and 'imagens: na primeira, os planos; nas outras, tudo o que cada um inclui.' in msg, 'a mensagem diz quantas imagens → ' + msg.split('\n')[2])
        p.fill('#pmCliente', 'Beltrana Souza')
        ok(espera(p, "() => document.getElementById('pmMsg').value.startsWith('Oi, Beltrana!')"), 'o nome do cliente muda a mensagem')
        ok(espera(p, PRONTAS), 'e as imagens se refazem')
        ok(p.evaluate("() => getComputedStyle(document.getElementById('pmCompartilhar')).display") != 'none', 'com o compartilhar do sistema, o botão aparece')
        p.click('#pmCompartilhar')
        ok(espera(p, '() => !!window.__compartilhado'), 'compartilhar manda')
        c = p.evaluate('() => window.__compartilhado')
        ok(c['n'] == n and c['nomes'][0] == f'Planos MEI - Beltrana (1 de {n}).png' and set(c['tipos']) == {'image/png'} and c['texto'].startswith('Oi, Beltrana!'),
           'todas as imagens, na ordem, com a mensagem → ' + str(c['nomes'][:2]))
        p.click('#pmFechar')
        ok(espera(p, FECHADA), 'fechar pelo ×')

        print('7. Na ficha do produto')
        p.click('#vitrine .sv-card[data-slug="planos-mei"] .sv-nome')
        ok(espera(p, "() => document.getElementById('ovServico').classList.contains('is-open')"), 'o nome abre a ficha')
        ok(p.is_visible('#sMaterial') and 'Material pro cliente' in txt('#sMaterial') and txt('#sMaterialBtn') == '📲 Planos pro WhatsApp', 'a ficha tem o material pro cliente')
        p.click('#sMaterialBtn')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'o botão da ficha abre a janela')
        ok(p.evaluate("() => +getComputedStyle(document.getElementById('ovPlanosMei')).zIndex > +getComputedStyle(document.getElementById('ovServico')).zIndex"), 'por cima da ficha')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA) and p.evaluate("() => document.getElementById('ovServico').classList.contains('is-open')"), 'Esc fecha a janela e a ficha fica')
        p.keyboard.press('Escape')
        ok(espera(p, "() => !document.getElementById('ovServico').classList.contains('is-open')"), 'Esc de novo fecha a ficha')
        p.click('#vitrine .sv-card[data-slug="outro-servico"] .sv-nome')
        ok(espera(p, "() => document.getElementById('ovServico').classList.contains('is-open')") and not p.is_visible('#sMaterial'), 'o serviço sem material não mostra o bloco')
        p.keyboard.press('Escape')
        ok(p.evaluate("() => window.__mockDb.servicos_vendas.length") == 0 and p.evaluate("() => window.__mockDb.precificacoes.length") == 0, 'nada gravado')
        p.close()

        print('8. A leitura dos planos que falha')
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script("window.__mockErroTabela = { mei_servicos: 'permission denied for table mei_servicos' }")
        p.goto(base + 'comercial-servicos.html')
        espera(p, "() => document.querySelectorAll('#vitrine .sv-card').length === 2")
        p.click('[data-material="planos-mei"]')
        ok(espera(p, "() => document.getElementById('pmStatus').textContent.includes('Não deu pra ler os planos do MEI agora')"), 'avisa em português')
        ok('permission denied' not in p.evaluate('() => document.body.textContent') and p.evaluate("() => document.querySelectorAll('#pmImagens img').length") == 0,
           'sem o erro do banco e sem imagem')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')
        p.close()

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ' → ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
