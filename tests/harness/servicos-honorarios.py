"""Os honorários contábeis pro WhatsApp (24/11/2026): o produto "Honorários contábeis" da Vitrine de serviços
(comercial-servicos.html) abre a janela dele (assets/js/honorarios-contabeis-janela.js), com as duas imagens (o que está
incluso; como funciona e o que é cobrado à parte), sem valores nem o nome do cliente, e a mensagem pronta com o link do
questionário da proposta (proposta.html, ou ?perfil=nova pra empresa que vai abrir). A janela é a mesma base da dos
planos do MEI e dos produtos do societário (assets/js/janela-whats.js). Na ficha do produto, o "Formulário do cliente" é
o questionário da proposta; o da transformação segue o dela (empresa.html). Sem login e sem banco: o mock do conferir.py,
com a vitrine inventada semeada em window.__mockDb.

    python tests/harness/servicos-honorarios.py

Confere:
  1. o botão no cartão do produto abre a janela, não a ficha, com o título do produto;
  2. as duas imagens com até 1080 px de largura e no máximo 1600 de altura, com a legenda de cada uma;
  3. o cliente muda a mensagem (o primeiro nome), e o link do questionário vem antes da despedida;
  4. "Vai abrir" troca o link pelo da empresa nova (?perfil=nova) e a mensagem fala da futura empresa;
  5. copiar a mensagem, baixar todas (sem o nome do cliente nos arquivos) e compartilhar as duas com a mensagem;
  6. na ficha do produto, o material e o questionário da proposta, com o texto dele e o "Copiar o link"; a janela abre por
     cima da ficha, e Esc fecha a janela e a ficha fica;
  7. a ficha da transformação segue com o formulário dela (empresa.html), com o texto dela;
  8. a 400 px de largura, a janela cabe sem rolar de lado; nada gravado;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

def V(id, slug, nome, **o):
    base = {'id': id, 'slug': slug, 'nome': nome, 'resumo': 'Inventado, só pro teste.', 'publico': None, 'modelo': 'pago', 'preco': None, 'preco_obs': None, 'situacao': 'preparo',
            'motivo': None, 'janela_ate': None, 'parar_em': None, 'parar_criterio': None, 'link_pagina': None, 'link_prototipo': None, 'quem_assina': None,
            'responsavel': 'Samuel', 'regua': {}, 'origem': None, 'observacao': None, 'ordem': 0, 'no_ar_desde': None, 'encerrado_em': None, 'criado_por': 'Claude',
            'criado_em': '2026-11-24T12:00:00+00:00', 'atualizado_por': 'Claude', 'atualizado_em': '2026-11-24T12:00:00+00:00'}
    base.update(o); return base
VITRINE = [V('sHon', 'honorarios-contabeis', 'Honorários contábeis', preco_obs='sob medida: pela proposta'),
           V('sTransf', 'transformacao-mei', 'Transformação do MEI em ME', preco=1000, ordem=1),
           V('sOutro', 'outro-servico', 'Outro serviço inventado', situacao='ideia')]
SEMEAR = """
(() => {
  const X = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.servicos_digitais = X.VITRINE.map(s => ({ ...s })); v.servicos_vendas = [];
    v.precificacao_parametros = [];
  } });
})();
""" % json.dumps({'VITRINE': VITRINE}, ensure_ascii=False)
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

ABERTA = "() => { const o = document.getElementById('ovHonorarios'); return !!o && getComputedStyle(o).display === 'flex'; }"
FECHADA = "() => { const o = document.getElementById('ovHonorarios'); return !o || getComputedStyle(o).display === 'none'; }"
PRONTAS = "() => { const i = [...document.querySelectorAll('#hcImagens img')]; return i.length === 2 && i.every(x => x.complete && x.naturalWidth > 0) && /^Pronto/.test(document.getElementById('hcStatus').textContent); }"
TAMANHOS = "() => [...document.querySelectorAll('#hcImagens img')].map(i => [i.naturalWidth, i.naturalHeight])"
FICHA_ABERTA = "() => document.getElementById('ovServico').classList.contains('is-open')"
FICHA_FECHADA = "() => !document.getElementById('ovServico').classList.contains('is-open')"

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    proposta, nova = base + 'proposta.html', base + 'proposta.html?perfil=nova'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 950}, accept_downloads=True)
        cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
        erros = []
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(COMPARTILHAR)
        txt = lambda sel: p.inner_text(sel).replace('\xa0', ' ')

        print('1. O botão no cartão do produto')
        p.goto(base + 'comercial-servicos.html')
        ok(espera(p, "() => document.querySelectorAll('#vitrine .sv-card').length === 3"), 'a vitrine com os três serviços')
        ok(p.evaluate("() => [...document.querySelectorAll('[data-material]')].map(b => b.closest('.sv-card').dataset.slug).sort().join(',')") == 'honorarios-contabeis,transformacao-mei',
           'o botão do material nos dois produtos que têm, e só neles')
        ok(txt('[data-material="honorarios-contabeis"]') == '📲 Honorários pro WhatsApp', 'o botão: "Honorários pro WhatsApp"')
        p.click('[data-material="honorarios-contabeis"]')
        ok(espera(p, ABERTA), 'o botão abre a janela')
        ok(not p.evaluate(FICHA_ABERTA), 'e não a ficha')
        ok(txt('#hcTitulo') == 'Honorários contábeis pro WhatsApp', 'o título do produto')
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'hcCliente', 'o foco no cliente')

        print('2. As duas imagens')
        ok(espera(p, PRONTAS, 12000), 'as duas imagens ficam prontas')
        tam = p.evaluate(TAMANHOS)
        # com a letra do sistema (Google Fonts) cabem em 1080 x 1600; sem ela, a de reserva quebra mais linhas e a que passa de
        # 1600 é reduzida por inteiro até caber (um pouco mais estreita, nunca cortada)
        ok(len(tam) == 2 and all(1000 <= w <= 1080 and 900 < h <= 1600 for w, h in tam), 'as duas com até 1080 px de largura e no máximo 1600 de altura → ' + str(tam))
        ok(p.evaluate("() => [...document.querySelectorAll('#hcImagens figcaption span')].map(s => s.textContent).join(' | ')")
           == '1 · o que está incluso | 2 · como funciona e o que é à parte', 'a legenda de cada imagem')
        ok(p.input_value('#hcPerfil') == 'constituida' and p.evaluate("() => [...document.querySelectorAll('#hcPerfil option')].map(o => o.textContent).join(',')") == 'Já funciona,Vai abrir',
           'a empresa começa em "Já funciona"')
        msg = p.input_value('#hcMsg')
        ok(msg.startswith('Oi! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.'), 'sem cliente, a mensagem sem nome, com quem manda')

        print('3. O cliente e o link do questionário')
        p.fill('#hcCliente', 'Fulano Beltrano da Silva')
        ok(espera(p, "() => document.getElementById('hcMsg').value.startsWith('Oi, Fulano! Tudo bem?')"), 'o primeiro nome na mensagem')
        ok(espera(p, PRONTAS), 'e as imagens se refazem')
        msg = p.input_value('#hcMsg'); L = msg.split('\n')
        ok('Na 1ª imagem, o que está incluso. Na 2ª, como funciona e o que é cobrado à parte.' in msg and 'O valor dos honorários é sob medida' in msg, 'a mensagem diz o que vai em cada imagem e que o valor é sob medida')
        ok(proposta in L and L.index(proposta) < L.index('Qualquer dúvida, me chama por aqui!') and 'uns 5 minutos' in msg, 'o link do questionário da proposta, antes da despedida')
        ok('R$' not in msg, 'sem valor na mensagem')

        print('4. A empresa que vai abrir')
        p.select_option('#hcPerfil', 'nova')
        ok(espera(p, "() => document.getElementById('hcMsg').value.includes('proposta.html?perfil=nova')"), 'o link vira o da empresa nova')
        msg = p.input_value('#hcMsg')
        ok('da sua futura empresa' in msg and 'uns 4 minutos' in msg and nova in msg.split('\n') and proposta not in msg.split('\n'), 'a mensagem fala da futura empresa, só com o link dela')
        ok(espera(p, PRONTAS) and len(p.evaluate(TAMANHOS)) == 2, 'as imagens seguem duas')
        p.select_option('#hcPerfil', 'constituida')
        ok(espera(p, "() => !document.getElementById('hcMsg').value.includes('perfil=nova')"), 'voltar pra "Já funciona" volta o link')

        print('5. Copiar, baixar e compartilhar')
        espera(p, PRONTAS)
        p.click('#hcCopiarMsg')
        ok(espera(p, "() => document.getElementById('hcStatus').textContent.includes('Mensagem copiada')"), 'copiar a mensagem avisa')
        ok(p.evaluate('navigator.clipboard.readText()').startswith('Oi, Fulano!'), 'copia a mensagem')
        baixados = []
        p.on('download', lambda x: baixados.append(x.suggested_filename))
        p.click('#hcBaixarTodas')
        espera(p, "() => document.getElementById('hcStatus').textContent.includes('baixadas')", 5000)
        p.wait_for_timeout(600)
        ok(baixados == ['Honorários contábeis (1 de 2).png', 'Honorários contábeis (2 de 2).png'], 'baixar todas: as duas, na ordem, sem o nome do cliente → ' + str(baixados))
        p.click('#hcCompartilhar')
        ok(espera(p, '() => !!window.__compartilhado'), 'compartilhar manda')
        c = p.evaluate('() => window.__compartilhado')
        ok(c['n'] == 2 and set(c['tipos']) == {'image/png'} and c['texto'].startswith('Oi, Fulano!'), 'as duas imagens com a mensagem → ' + str(c['nomes']))
        p.click('#hcFechar')
        ok(espera(p, FECHADA), 'fechar pelo ×')

        print('6. Na ficha do produto')
        p.click('#vitrine .sv-card[data-slug="honorarios-contabeis"] .sv-nome')
        ok(espera(p, FICHA_ABERTA), 'o nome abre a ficha')
        ok(p.is_visible('#sMaterial') and txt('#sMaterialBtn') == '📲 Honorários pro WhatsApp', 'a ficha tem o material pro cliente')
        ok(p.is_visible('#sMaterialForm') and txt('#sFormLink') == proposta and p.get_attribute('#sFormAbrir', 'href') == proposta
           and txt('#sFormTexto').startswith('o questionário da proposta'), 'e o questionário da proposta como formulário do cliente, com o texto dele')
        p.click('#sFormCopiar')
        ok(espera(p, "() => document.getElementById('sFormStatus').textContent.includes('Link copiado')") and p.evaluate('navigator.clipboard.readText()') == proposta,
           '"Copiar o link" copia o endereço do questionário')
        p.click('#sMaterialBtn')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'o botão da ficha abre a janela')
        ok(p.input_value('#hcCliente') == '' and p.input_value('#hcPerfil') == 'constituida', 'a janela abre de novo limpa')
        ok(p.evaluate("() => +getComputedStyle(document.getElementById('ovHonorarios')).zIndex > +getComputedStyle(document.getElementById('ovServico')).zIndex"), 'por cima da ficha')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA) and p.evaluate(FICHA_ABERTA), 'Esc fecha a janela e a ficha fica')
        p.keyboard.press('Escape')
        ok(espera(p, FICHA_FECHADA), 'Esc de novo fecha a ficha')

        print('7. A transformação segue com o formulário dela')
        p.click('#vitrine .sv-card[data-slug="transformacao-mei"] .sv-nome')
        ok(espera(p, FICHA_ABERTA), 'a ficha da transformação abre')
        ok(txt('#sFormLink') == base + 'empresa.html?t=transformacao' and txt('#sFormTexto').startswith('as informações e os documentos vêm por aqui'),
           'com o formulário dela (empresa.html) e o texto dele → ' + txt('#sFormTexto'))
        p.keyboard.press('Escape')
        ok(espera(p, FICHA_FECHADA), 'Esc fecha a ficha')
        p.click('#vitrine .sv-card[data-slug="outro-servico"] .sv-nome')
        ok(espera(p, FICHA_ABERTA) and not p.is_visible('#sMaterial') and not p.is_visible('#sMaterialForm'), 'o serviço sem material não tem nem o material nem o formulário')
        p.keyboard.press('Escape')
        ok(espera(p, FICHA_FECHADA), 'Esc fecha a ficha')

        print('8. No celular, e nada gravado')
        p.set_viewport_size({'width': 400, 'height': 860})
        p.click('[data-material="honorarios-contabeis"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'a janela abre a 400 px')
        larg = p.evaluate("() => { const o = document.getElementById('ovHonorarios'); return [o.scrollWidth, o.clientWidth]; }")
        ok(larg[0] <= larg[1], 'a janela cabe sem rolar de lado → ' + str(larg))
        cli = p.evaluate("() => { const a = document.getElementById('hcCliente').getBoundingClientRect(), b = document.getElementById('hcPerfil').getBoundingClientRect(); return [a.right, b.right, b.top >= a.bottom - 1]; }")
        ok(cli[2], 'os dois campos um embaixo do outro')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')
        ok(p.evaluate('() => window.__mockDb.servicos_vendas.length') == 0 and p.evaluate('() => window.__mockDb.servicos_digitais.length') == 3, 'nada gravado')

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ' → ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
