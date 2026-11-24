"""Precificação › MEI › "Planos pro WhatsApp" (24/11/2026, pedido do Samuel): as duas imagens dos planos do MEI pro
cliente (a primeira com os planos e o recomendado, a segunda com tudo o que cada um inclui) e a mensagem pronta
(comercial-precificacao.html, assets/js/mei-planos.js e assets/js/mei-planos-imagem.js). Sem login e sem banco: o mock do
conferir.py, com um catálogo de planos inventado semeado em window.__mockDb.

    python tests/harness/precificacao-mei-whats.py

Confere:
  1. o link direto ?aba=mei abre nos planos;
  2. sem plano marcado, a janela recomenda o mais simples: as duas imagens com 1080 px de largura, a altura pelo que
     cada uma tem, e a mensagem com o primeiro nome do cliente, quem fala e o plano;
  3. copiar a mensagem e a imagem; baixar a imagem (o nome do arquivo com o cliente);
  4. o plano marcado na tela é o recomendado (a mensagem e o aviso mudam); as notas inclusas do campo entram;
  5. Esc fecha a janela; nada é gravado no banco;
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
SEMEAR = """
(() => {
  const X = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.precificacao_questoes = X.QUESTOES; v.precificacao_parametros = []; v.precificacao_obrigacoes = [];
    v.mei_planos = X.PLANOS; v.mei_servicos = X.SERVICOS; v.mei_plano_servicos = X.COMP.map(([p, s]) => ({ plano_id: p, servico_id: s }));
    v.precificacoes = [];
  } });
})();
""" % json.dumps({'QUESTOES': QUESTOES, 'PLANOS': PLANOS, 'SERVICOS': SERVICOS, 'COMP': COMP}, ensure_ascii=False)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

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

IMGS_PRONTAS = "() => ['pmImg1','pmImg2'].every(id => { const i = document.getElementById(id); return i && i.complete && i.naturalWidth > 0; })"

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
        ok(espera(p, "() => getComputedStyle(document.getElementById('ovPlanosMei')).display === 'flex'"), 'a janela abre')
        ok(espera(p, IMGS_PRONTAS), 'as duas imagens ficam prontas')
        tam = p.evaluate("() => ['pmImg1','pmImg2'].map(id => [document.getElementById(id).naturalWidth, document.getElementById(id).naturalHeight])")
        ok(tam[0][0] == 1080 and tam[1][0] == 1080 and tam[0][1] > 1300 and tam[1][1] > 1200, 'as duas com 1080 px de largura, do tamanho do que têm → ' + str(tam))
        ok('MEI BÁSICO, o mais simples' in txt('#pmRecomenda'), 'o aviso diz o recomendado e o porquê → ' + txt('#pmRecomenda'))
        msg = p.input_value('#pmMsg')
        ok(msg.startswith('Oi, Fulana! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.') and 'eu recomendo o MEI BÁSICO, de R$ 200,00 por mês' in msg,
           'a mensagem: o primeiro nome, quem fala e o plano')
        ok('Todos já incluem a guia do DAS todo mês, a declaração anual e o acompanhamento na Receita Federal.' in msg, 'o que todos os planos têm')
        ok('Pronto' in txt('#pmStatus'), 'o aviso de pronto')

        print('3. Copiar e baixar')
        p.fill('#pmMsg', msg + '\nAbraço!')
        p.click('#pmCopiarMsg')
        ok(espera(p, "() => document.getElementById('pmStatus').textContent.includes('Mensagem copiada')"), 'copiar a mensagem avisa')
        ok(p.evaluate('navigator.clipboard.readText()').endswith('Abraço!'), 'copia a mensagem como foi editada')
        p.click('[data-pm-copiar="0"]')
        ok(espera(p, "() => /Imagem 1 copiada|não deixou copiar/.test(document.getElementById('pmStatus').textContent)"), 'copiar a imagem responde → ' + txt('#pmStatus'))
        with p.expect_download() as d:
            p.click('[data-pm-baixar="1"]')
        ok(d.value.suggested_filename == 'Planos MEI - Fulana (2 de 2).png', 'baixar a imagem: o nome com o cliente → ' + d.value.suggested_filename)

        print('4. O plano marcado é o recomendado')
        p.click('#pmFechar')
        ok(espera(p, "() => getComputedStyle(document.getElementById('ovPlanosMei')).display === 'none'"), 'fechar pelo ×')
        p.click('#meiCards [data-base="basico"]')
        p.fill('#meiX', '4')
        p.click('#meiCards [data-base="equipe"]')
        p.click('#meiWhats')
        ok(espera(p, IMGS_PRONTAS), 'as imagens de novo')
        msg = p.input_value('#pmMsg')
        ok('o que está marcado na tela' in txt('#pmRecomenda') and 'MEI BÁSICO + MEI EQUIPE' in txt('#pmRecomenda'), 'o aviso: os marcados → ' + txt('#pmRecomenda'))
        ok('eu recomendo o MEI BÁSICO (R$ 200,00) e o MEI EQUIPE (R$ 300,00): R$ 500,00 por mês, juntos.' in msg, 'a mensagem: os dois e a soma')

        print('5. Esc fecha; nada gravado')
        p.keyboard.press('Escape')
        ok(espera(p, "() => getComputedStyle(document.getElementById('ovPlanosMei')).display === 'none'"), 'Esc fecha a janela')
        ok(p.evaluate('() => window.__mockDb.precificacoes.length') == 0, 'nada vai pras propostas')

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ' → ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
