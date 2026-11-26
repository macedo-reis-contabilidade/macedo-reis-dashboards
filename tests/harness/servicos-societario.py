"""Os produtos do societário pro WhatsApp (24/11/2026): a "Transformação do MEI em ME", a "Constituição de CNPJ" (a
abertura de empresa) e, desde 26/11/2026, a "Alteração de empresa" da Vitrine de serviços (comercial-servicos.html) abrem a mesma janela
(assets/js/societario-produtos-janela.js), com o título e o rótulo do produto, as três imagens (o passo a passo e a
documentação, sem valores, e o orçamento à parte) e a mensagem pronta. A janela é a mesma base da dos planos do MEI
(assets/js/janela-whats.js). Os valores de sempre do orçamento vêm do banco (a aba Parâmetros da Precificação,
precificacao_parametros, cada produto no grupo dele), nunca do código. Sem login e sem banco: o mock do conferir.py, com a
vitrine e os valores inventados semeados em window.__mockDb.

    python tests/harness/servicos-societario.py

Confere:
  1. o botão no cartão do produto abre a janela, não a ficha, com o título do produto;
  2. as três imagens com 1080 px de largura e no máximo 1600 de altura, os valores de sempre (do banco) e a data de hoje
     nos campos;
  3. a data do orçamento: 24/11/2026 vale até 31/12/2026, no resumo e na mensagem;
  4. o nome do cliente muda a mensagem e o nome do arquivo do orçamento, e as imagens se refazem;
  5. o à vista acima do a prazo avisa em vermelho e no aviso de baixo;
  6. copiar a mensagem e a imagem, baixar o orçamento e todas, e compartilhar as três com a mensagem;
  7. na ficha do produto, o "Material pro cliente" abre a janela por cima da ficha; Esc fecha a janela e a ficha fica;
  8. os planos do MEI seguem com a janela deles, e nada é gravado;
  9. a leitura dos valores de sempre que falha: os campos vazios, o porquê no resumo, as imagens saem e digitar os valores
     libera o orçamento;
 10. a constituição de CNPJ: o botão dela, o título "Abertura de empresa", os valores do grupo dela, a mensagem sem MEI e
     o nome dos arquivos;
 11. a alteração de empresa: o que muda e o que pedir (nada marcado, a janela pede pra marcar; o endereço na mesma cidade
     e o de outra cidade não vão juntos; desmarcar o que o escritório já tem), o link com a seleção, a mensagem com o que
     muda, o preço digitado (não há valor de sempre), o nome dos arquivos e o formulário na ficha;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
from zoneinfo import ZoneInfo
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

PLANOS = [{'id': 'basico', 'nome': 'MEI BÁSICO', 'slogan': 'O essencial do mês', 'valor_mensal': 200, 'ativo': True, 'ordem': 1}]
SERVICOS = [{'id': 'das', 'nome': 'Envio da guia mensal (DAS)', 'grupo': 'mensal', 'tipo': 'incluso', 'valor_avulso': None, 'ativo': True, 'ordem': 1},
            {'id': 'dasn', 'nome': 'Declaração Anual do MEI', 'grupo': 'anual', 'tipo': 'incluso', 'valor_avulso': None, 'ativo': True, 'ordem': 2}]
COMP = [('basico', 'das'), ('basico', 'dasn')]
def V(id, slug, nome, **o):
    base = {'id': id, 'slug': slug, 'nome': nome, 'resumo': 'Inventado, só pro teste.', 'publico': None, 'modelo': 'pago', 'preco': 200, 'preco_obs': None, 'situacao': 'preparo',
            'motivo': None, 'janela_ate': None, 'parar_em': None, 'parar_criterio': None, 'link_pagina': None, 'link_prototipo': None, 'quem_assina': None,
            'responsavel': 'Samuel', 'regua': {}, 'origem': None, 'observacao': None, 'ordem': 0, 'no_ar_desde': None, 'encerrado_em': None, 'criado_por': 'Claude',
            'criado_em': '2026-11-24T12:00:00+00:00', 'atualizado_por': 'Claude', 'atualizado_em': '2026-11-24T12:00:00+00:00'}
    base.update(o); return base
VITRINE = [V('sMei', 'planos-mei', 'Planos do MEI'), V('sTransf', 'transformacao-mei', 'Transformação do MEI em ME', preco=1000, ordem=1),
           V('sConst', 'constituicao-cnpj', 'Constituição de CNPJ', preco=1100, ordem=2),
           V('sAlt', 'alteracao-empresa', 'Alteração de empresa', preco=None, ordem=3),
           V('sOutro', 'outro-servico', 'Outro serviço inventado', situacao='ideia')]
# os valores de sempre do orçamento (inventados), como a aba Parâmetros da Precificação grava; a linha de outro grupo fica fora
PARAMETROS = [{'id': 901, 'grupo': 'transformacao_mei', 'chave': 'Valor à vista', 'valor': 1000, 'limite_inferior': None, 'ordem': 1},
              {'id': 902, 'grupo': 'transformacao_mei', 'chave': 'Entrada do a prazo', 'valor': 700, 'limite_inferior': None, 'ordem': 2},
              {'id': 903, 'grupo': 'transformacao_mei', 'chave': 'Parcela do a prazo, em 30 dias', 'valor': 500, 'limite_inferior': None, 'ordem': 3},
              {'id': 905, 'grupo': 'constituicao_cnpj', 'chave': 'Valor à vista', 'valor': 1100, 'limite_inferior': None, 'ordem': 1},
              {'id': 906, 'grupo': 'constituicao_cnpj', 'chave': 'Entrada do a prazo', 'valor': 800, 'limite_inferior': None, 'ordem': 2},
              {'id': 907, 'grupo': 'constituicao_cnpj', 'chave': 'Parcela do a prazo, em 30 dias', 'valor': 400, 'limite_inferior': None, 'ordem': 3},
              {'id': 904, 'grupo': 'p01', 'chave': 'Valor à vista', 'valor': 9, 'limite_inferior': None, 'ordem': 1}]
SEMEAR = """
(() => {
  const X = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.mei_planos = X.PLANOS; v.mei_servicos = X.SERVICOS;
    v.mei_plano_servicos = X.COMP.map(([p, s]) => ({ plano_id: p, servico_id: s }));
    v.servicos_digitais = X.VITRINE.map(s => ({ ...s })); v.servicos_vendas = [];
    v.precificacao_parametros = X.PARAMETROS.map(r => ({ ...r }));
  } });
})();
""" % json.dumps({'PLANOS': PLANOS, 'SERVICOS': SERVICOS, 'COMP': COMP, 'VITRINE': VITRINE, 'PARAMETROS': PARAMETROS}, ensure_ascii=False)
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

ABERTA = "() => { const o = document.getElementById('ovProdutoSocietario'); return !!o && getComputedStyle(o).display === 'flex'; }"
FECHADA = "() => { const o = document.getElementById('ovProdutoSocietario'); return !o || getComputedStyle(o).display === 'none'; }"
PRONTAS = "() => { const i = [...document.querySelectorAll('#spImagens img')]; return i.length === 3 && i.every(x => x.complete && x.naturalWidth > 0) && /^(Pronto|As imagens)/.test(document.getElementById('spStatus').textContent); }"
TAMANHOS = "() => [...document.querySelectorAll('#spImagens img')].map(i => [i.naturalWidth, i.naturalHeight])"
FICHA_ABERTA = "() => document.getElementById('ovServico').classList.contains('is-open')"

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    hoje = datetime.datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 950}, accept_downloads=True)
        cx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base.rstrip('/'))
        erros = []
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(COMPARTILHAR)
        txt = lambda sel: p.inner_text(sel).replace('\xa0', ' ')
        val = lambda sel: p.input_value(sel).replace('\xa0', ' ')

        print('1. O botão no cartão do produto')
        p.goto(base + 'comercial-servicos.html')
        ok(espera(p, "() => document.querySelectorAll('#vitrine .sv-card').length === 5"), 'a vitrine com os cinco serviços')
        ok(p.evaluate("() => [...document.querySelectorAll('[data-material]')].map(b => b.closest('.sv-card').dataset.slug).sort().join(',')") == 'alteracao-empresa,constituicao-cnpj,planos-mei,transformacao-mei',
           'o botão do material nos quatro produtos que têm, e só neles')
        ok(txt('[data-material="transformacao-mei"]') == '📲 Transformação pro WhatsApp', 'o botão: "Transformação pro WhatsApp"')
        p.click('[data-material="transformacao-mei"]')
        ok(espera(p, ABERTA), 'o botão abre a janela')
        ok(not p.evaluate(FICHA_ABERTA), 'e não a ficha')
        ok(txt('#spTitulo') == 'Transformação do MEI em ME pro WhatsApp' and txt('#spClienteRotulo') == 'Cliente (o titular do MEI)', 'o título e o rótulo do produto')

        print('2. As três imagens e os campos')
        ok(espera(p, PRONTAS, 12000), 'as três imagens ficam prontas')
        tam = p.evaluate(TAMANHOS)
        # com a letra do sistema (Google Fonts) as três cabem em 1080 x 1600; sem ela, a de reserva quebra mais linhas e a que
        # passa de 1600 é reduzida por inteiro até caber (um pouco mais estreita, nunca cortada)
        ok(len(tam) == 3 and all(1000 <= w <= 1080 and 900 < h <= 1600 for w, h in tam), 'todas com até 1080 px de largura e no máximo 1600 de altura → ' + str(tam))
        ok(p.evaluate("() => [...document.querySelectorAll('#spImagens figcaption span')].map(s => s.textContent).join(' | ')")
           == '1 · o passo a passo | 2 · a documentação | 3 · o orçamento (vai à parte)', 'a legenda de cada imagem')
        ok(val('#spAVista') == '1.000,00' and val('#spEntrada') == '700,00' and val('#spParcela') == '500,00', 'os valores de sempre, do banco, nos campos')
        ok(p.input_value('#spData') == hoje, 'a data de hoje (Brasília) → ' + p.input_value('#spData'))
        ok(txt('#spResumo').startswith('A prazo: R$ 1.200,00 (entrada de R$ 700,00 + R$ 500,00 em 30 dias). À vista: R$ 1.000,00, R$ 200,00 a menos.'),
           'o resumo: o a prazo somado e o desconto → ' + txt('#spResumo'))
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'spCliente', 'o foco no cliente')

        print('3. A data do orçamento e a validade')
        p.fill('#spData', '2026-11-24')
        ok(espera(p, "() => document.getElementById('spMsg').value.includes('(vale até 31/12/2026).')"), 'de 24/11/2026, a mensagem diz que vale até 31/12/2026')
        ok(txt('#spResumo').endswith('Vale até 31/12/2026, o último dia útil do mês seguinte.'), 'o resumo também → ' + txt('#spResumo'))
        ok(espera(p, PRONTAS), 'e as imagens se refazem')

        print('4. O cliente')
        p.fill('#spCliente', 'Fulano Beltrano da Silva')
        ok(espera(p, "() => document.getElementById('spMsg').value.startsWith('Oi, Fulano! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.')"),
           'o primeiro nome na mensagem, com quem manda')
        ok(espera(p, PRONTAS), 'e as imagens se refazem')
        msg = p.input_value('#spMsg')
        ok('Na 1ª imagem, o passo a passo' in msg and 'Na 2ª, a documentação que vamos precisar.' in msg and 'E, em separado, o orçamento' in msg,
           'a mensagem diz o que vai em cada imagem')
        linhas = msg.split('\n')
        ok(base + 'empresa.html?t=transformacao' in linhas and 'Quando quiser seguir, é só preencher este formulário' in msg
           and linhas.index(base + 'empresa.html?t=transformacao') < linhas.index('Qualquer dúvida, me chama por aqui!'),
           'a mensagem leva o link do formulário da transformação, antes da despedida')

        print('5. O à vista acima do a prazo')
        p.fill('#spAVista', '1.500,00')
        ok(espera(p, "() => document.getElementById('spResumo').textContent === 'O à vista está maior que o a prazo.'"), 'o resumo avisa')
        ok(p.evaluate("() => document.getElementById('spResumo').style.color") == 'var(--err)', 'em vermelho')
        ok(espera(p, "() => document.getElementById('spStatus').textContent.includes('confira os valores do orçamento')"), 'e o aviso de baixo pede pra conferir')
        p.fill('#spAVista', '1.000,00')
        ok(espera(p, "() => document.getElementById('spResumo').textContent.startsWith('A prazo: R$')") and espera(p, PRONTAS), 'o valor certo volta o resumo e as imagens')

        print('6. Copiar, baixar e compartilhar')
        p.click('#spCopiarMsg')
        ok(espera(p, "() => document.getElementById('spStatus').textContent.includes('Mensagem copiada')"), 'copiar a mensagem avisa')
        ok(p.evaluate('navigator.clipboard.readText()').startswith('Oi, Fulano!'), 'copia a mensagem')
        p.click('[data-sp-copiar="0"]')
        ok(espera(p, "() => /Imagem 1 copiada|não deixou copiar/.test(document.getElementById('spStatus').textContent)"), 'copiar a imagem responde → ' + txt('#spStatus'))
        if 'Imagem 1 copiada' in txt('#spStatus'):
            ok(txt('[data-sp-copiar="0"]') == '✓ Copiada' and 'Depois, a 2.' in txt('#spStatus'), 'a imagem copiada fica marcada, e o aviso diz a próxima')
        with p.expect_download() as d:
            p.click('[data-sp-baixar="2"]')
        ok(d.value.suggested_filename == 'Orçamento - Transformação do MEI em ME - Fulano.png', 'baixar o orçamento: o nome com o cliente → ' + d.value.suggested_filename)
        baixados = []
        p.on('download', lambda x: baixados.append(x.suggested_filename))
        p.click('#spBaixarTodas')
        espera(p, "() => document.getElementById('spStatus').textContent.includes('baixadas')", 5000)
        p.wait_for_timeout(800)
        ok(baixados == ['Transformação do MEI em ME (1 de 2).png', 'Transformação do MEI em ME (2 de 2).png', 'Orçamento - Transformação do MEI em ME - Fulano.png'],
           'baixar todas: as três, na ordem → ' + str(baixados))
        ok(p.evaluate("() => getComputedStyle(document.getElementById('spCompartilhar')).display") != 'none', 'com o compartilhar do sistema, o botão aparece')
        p.click('#spCompartilhar')
        ok(espera(p, '() => !!window.__compartilhado'), 'compartilhar manda')
        c = p.evaluate('() => window.__compartilhado')
        ok(c['n'] == 3 and c['nomes'][2] == 'Orçamento - Transformação do MEI em ME - Fulano.png' and set(c['tipos']) == {'image/png'} and c['texto'].startswith('Oi, Fulano!'),
           'as três imagens, na ordem, com a mensagem → ' + str(c['nomes']))
        p.click('#spFechar')
        ok(espera(p, FECHADA), 'fechar pelo ×')

        print('7. Na ficha do produto')
        p.click('#vitrine .sv-card[data-slug="transformacao-mei"] .sv-nome')
        ok(espera(p, FICHA_ABERTA), 'o nome abre a ficha')
        ok(p.is_visible('#sMaterial') and 'Material pro cliente' in txt('#sMaterial') and txt('#sMaterialBtn') == '📲 Transformação pro WhatsApp', 'a ficha tem o material pro cliente')
        form = base + 'empresa.html?t=transformacao'
        ok(p.is_visible('#sMaterialForm') and txt('#sFormLink') == form and p.get_attribute('#sFormAbrir', 'href') == form
           and p.get_attribute('#sFormAbrir', 'target') == '_blank', 'e o formulário do cliente, com o link e o "Ver o formulário"')
        p.click('#sFormCopiar')
        ok(espera(p, "() => document.getElementById('sFormStatus').textContent.includes('Link copiado')") and p.evaluate('navigator.clipboard.readText()') == form,
           '"Copiar o link" copia o endereço do formulário')
        p.click('#sMaterialBtn')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'o botão da ficha abre a janela')
        ok(p.input_value('#spCliente') == '' and p.input_value('#spData') == hoje, 'a janela abre de novo limpa, com a data de hoje')
        ok(p.evaluate("() => +getComputedStyle(document.getElementById('ovProdutoSocietario')).zIndex > +getComputedStyle(document.getElementById('ovServico')).zIndex"), 'por cima da ficha')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA) and p.evaluate(FICHA_ABERTA), 'Esc fecha a janela e a ficha fica')
        p.keyboard.press('Escape')
        ok(espera(p, "() => !document.getElementById('ovServico').classList.contains('is-open')"), 'Esc de novo fecha a ficha')

        print('8. Os planos do MEI seguem com a janela deles; nada gravado')
        p.click('[data-material="planos-mei"]')
        ok(espera(p, "() => { const o = document.getElementById('ovPlanosMei'); return !!o && getComputedStyle(o).display === 'flex'; }"), 'o botão dos planos abre a janela dos planos')
        ok(espera(p, "() => document.querySelectorAll('#pmImagens img').length >= 2 && /^Pronto/.test(document.getElementById('pmStatus').textContent)", 12000), 'com as imagens dos planos')
        ok(p.evaluate(FECHADA), 'a da transformação segue fechada')
        p.keyboard.press('Escape')
        ok(espera(p, "() => getComputedStyle(document.getElementById('ovPlanosMei')).display === 'none'"), 'Esc fecha')
        ok(p.evaluate('() => window.__mockDb.servicos_vendas.length') == 0 and p.evaluate('() => window.__mockDb.servicos_digitais.length') == 5, 'nada gravado')
        p.click('#vitrine .sv-card[data-slug="planos-mei"] .sv-nome')
        ok(espera(p, FICHA_ABERTA) and p.is_visible('#sMaterial') and not p.is_visible('#sMaterialForm'), 'a ficha dos planos do MEI não tem o formulário')
        p.keyboard.press('Escape')
        ok(espera(p, "() => !document.getElementById('ovServico').classList.contains('is-open')"), 'Esc fecha a ficha')

        print('9. A leitura dos valores de sempre que falha')
        p.evaluate("() => { window.__mockErroTabela = { precificacao_parametros: 'permission denied for table precificacao_parametros' }; }")
        p.click('[data-material="transformacao-mei"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'a janela abre e as três imagens saem do mesmo jeito')
        ok(val('#spAVista') == '' and val('#spEntrada') == '' and val('#spParcela') == '', 'os campos dos valores vazios')
        ok(txt('#spResumo').startswith('Não deu pra ler os valores de sempre agora: digite os do orçamento. Falta o valor à vista.')
           and p.evaluate("() => document.getElementById('spResumo').style.color") == 'var(--err)', 'o resumo diz o porquê, em vermelho → ' + txt('#spResumo'))
        ok('confira os valores do orçamento' in txt('#spStatus'), 'e o aviso de baixo pede pra conferir')
        ok('permission denied' not in p.inner_text('#ovProdutoSocietario'), 'sem o erro do banco na tela')
        p.fill('#spAVista', '1.000,00'); p.fill('#spEntrada', '700'); p.fill('#spParcela', '500,00')
        ok(espera(p, "() => document.getElementById('spResumo').textContent.replace(/\\u00a0/g, ' ').startsWith('A prazo: R$ 1.200,00')")
           and espera(p, "() => /^Pronto/.test(document.getElementById('spStatus').textContent)", 12000), 'digitar os valores libera o orçamento → ' + txt('#spStatus'))
        p.evaluate("() => { window.__mockErroTabela = null; }")
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')

        print('10. A constituição de CNPJ')
        ok(txt('[data-material="constituicao-cnpj"]') == '📲 Constituição pro WhatsApp', 'o botão: "Constituição pro WhatsApp"')
        p.click('[data-material="constituicao-cnpj"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000), 'abre a mesma janela, com as três imagens')
        ok(txt('#spTitulo') == 'Abertura de empresa pro WhatsApp' and txt('#spClienteRotulo') == 'Cliente', 'o título e o rótulo da abertura')
        ok(val('#spAVista') == '1.100,00' and val('#spEntrada') == '800,00' and val('#spParcela') == '400,00', 'os valores de sempre do grupo dela, não os da transformação')
        ok(txt('#spResumo').startswith('A prazo: R$ 1.200,00 (entrada de R$ 800,00 + R$ 400,00 em 30 dias). À vista: R$ 1.100,00, R$ 100,00 a menos.'), 'o resumo → ' + txt('#spResumo'))
        tam = p.evaluate(TAMANHOS)
        ok(len(tam) == 3 and all(1000 <= w <= 1080 and 900 < h <= 1600 for w, h in tam), 'as três com até 1080 px de largura e no máximo 1600 de altura → ' + str(tam))
        p.fill('#spCliente', 'Beltrana Fulana')
        ok(espera(p, "() => document.getElementById('spMsg').value.startsWith('Oi, Beltrana!')"), 'o cliente muda a mensagem')
        ok(espera(p, PRONTAS), 'e as imagens se refazem')
        msg = p.input_value('#spMsg')
        ok('Segue como funciona, na prática, a abertura da empresa:' in msg and ' MEI' not in msg, 'a mensagem fala da abertura da empresa, sem MEI')
        ok(base + 'empresa.html?t=constituicao' in msg.split('\n') and 'transformacao' not in msg, 'com o link do formulário da abertura, não o da transformação')
        # o ouvinte do 6 segue ligado e põe em "baixados" (o nome é lido na hora): a lista é zerada aqui
        del baixados[:]
        p.click('#spBaixarTodas')
        espera(p, "() => document.getElementById('spStatus').textContent.includes('baixadas')", 5000)
        p.wait_for_timeout(800)
        ok(baixados == ['Abertura de empresa (1 de 2).png', 'Abertura de empresa (2 de 2).png', 'Orçamento - Abertura de empresa - Beltrana.png'],
           'os nomes dos arquivos da abertura → ' + str(baixados))
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')
        p.click('[data-material="transformacao-mei"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS, 12000) and txt('#spTitulo') == 'Transformação do MEI em ME pro WhatsApp' and val('#spAVista') == '1.000,00'
           and p.input_value('#spCliente') == '', 'a transformação de novo: o título, os valores e o cliente dela, sem sobra da abertura')
        ok(not p.is_visible('#spAlt'), 'e sem as listas da alteração')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')

        print('11. A alteração de empresa: o que muda e o que pedir')
        PRONTAS_ALT = "() => { const i = [...document.querySelectorAll('#spImagens img')]; return i.length === 3 && i.every(x => x.complete && x.naturalWidth > 0) && /^(Pronto|As imagens|Marque o que muda)/.test(document.getElementById('spStatus').textContent); }"
        MARCADAS = "() => [...document.querySelectorAll('#spMuda [data-sp-alt]:checked')].map(c => c.dataset.spAlt).join(',')"
        ITENS = "() => [...document.querySelectorAll('#spPedir [data-sp-item]')].map(c => c.dataset.spItem + (c.checked ? '' : '-')).join(',')"
        ok(txt('[data-material="alteracao-empresa"]') == '📲 Alteração pro WhatsApp', 'o botão: "Alteração pro WhatsApp"')
        p.click('[data-material="alteracao-empresa"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS_ALT, 12000), 'abre a mesma janela, com as três imagens')
        ok(txt('#spTitulo') == 'Alteração de empresa pro WhatsApp' and txt('#spClienteRotulo') == 'Cliente', 'o título e o rótulo da alteração')
        ok(p.is_visible('#spAlt') and p.evaluate("() => document.querySelectorAll('#spMuda [data-sp-alt]').length") == 9 and p.evaluate(MARCADAS) == '',
           'as 9 coisas que podem mudar, nenhuma marcada')
        ok('Marque o que muda' in txt('#spPedir') and txt('#spStatus').startswith('Marque o que muda'), 'sem nada marcado, a janela pede pra marcar → ' + txt('#spStatus'))
        ok(val('#spAVista') == '' and val('#spEntrada') == '' and val('#spParcela') == '', 'sem valor de sempre: os campos vazios')
        ok(txt('#spResumo').startswith('O preço da alteração depende do que muda: digite os valores deste orçamento.'), 'o resumo diz por quê → ' + txt('#spResumo'))
        msg = p.input_value('#spMsg')
        ok(base + 'empresa.html?t=alteracao' in msg.split('\n') and 'O que muda' not in msg, 'sem nada marcado, o link sem a seleção: o cliente marca')
        # o caso: o nome fantasia, a natureza jurídica, o endereço na mesma cidade e o e-mail e o telefone
        for a in ['fantasia', 'natureza', 'endereco', 'contato']:
            p.check(f'#spMuda [data-sp-alt="{a}"]')
        ok(p.evaluate(MARCADAS) == 'fantasia,natureza,endereco,contato', 'as quatro marcadas → ' + p.evaluate(MARCADAS))
        ok(p.evaluate(ITENS) == 'fantasia,endereco,area,horario,imovel,contato,doc,civil,profissao,residencia,gov', 'o que pedir: os itens do que muda, todos marcados → ' + p.evaluate(ITENS))
        p.check('#spMuda [data-sp-alt="cidade"]')
        ok(p.evaluate(MARCADAS) == 'fantasia,natureza,cidade,contato', 'outra cidade tira o endereço na mesma cidade')
        p.check('#spMuda [data-sp-alt="endereco"]')
        ok(p.evaluate(MARCADAS) == 'fantasia,natureza,endereco,contato', 'e o contrário')
        p.uncheck('#spPedir [data-sp-item="doc"]'); p.uncheck('#spPedir [data-sp-item="residencia"]')
        ok(p.evaluate(ITENS) == 'fantasia,endereco,area,horario,imovel,contato,doc-,civil,profissao,residencia-,gov', 'desmarcar o que o escritório já tem')
        link = base + 'empresa.html?t=alteracao&m=fantasia,natureza,endereco,contato&n=doc,residencia'
        ok(espera(p, "() => document.getElementById('spMsg').value.split('\\n').includes(%s)" % json.dumps(link)), 'o link leva o que muda e o que o escritório já tem')
        msg = p.input_value('#spMsg')
        ok('Segue como funciona, na prática, a alteração da sua empresa:\nO que muda: o nome fantasia, a natureza jurídica, o endereço (na mesma cidade) e os contatos (e-mail e telefone).' in msg
           and '(leva uns 5 minutos)' in msg, 'a mensagem diz o que muda e que leva uns 5 minutos')
        ok(espera(p, "() => document.getElementById('spStatus').textContent.startsWith('As imagens estão prontas, mas confira os valores')", 12000), 'sem os valores, as imagens saem e o aviso pede pra conferir')
        p.fill('#spCliente', 'Beltrano Fulano'); p.fill('#spAVista', '900,00'); p.fill('#spEntrada', '500'); p.fill('#spParcela', '500,00')
        ok(espera(p, "() => document.getElementById('spResumo').textContent.replace(/\\u00a0/g, ' ').startsWith('A prazo: R$ 1.000,00 (entrada de R$ 500,00 + R$ 500,00 em 30 dias). À vista: R$ 900,00')")
           and espera(p, "() => /^Pronto/.test(document.getElementById('spStatus').textContent)", 12000), 'com o preço digitado, o resumo e o pronto → ' + txt('#spStatus'))
        tam = p.evaluate(TAMANHOS)
        ok(len(tam) == 3 and all(850 <= w <= 1080 and 400 < h <= 1600 for w, h in tam), 'as três com até 1080 px de largura e no máximo 1600 de altura → ' + str(tam))
        del baixados[:]
        p.click('#spBaixarTodas')
        espera(p, "() => document.getElementById('spStatus').textContent.includes('baixadas')", 5000)
        p.wait_for_timeout(800)
        ok(baixados == ['Alteração de empresa (1 de 2).png', 'Alteração de empresa (2 de 2).png', 'Orçamento - Alteração de empresa - Beltrano.png'],
           'os nomes dos arquivos da alteração → ' + str(baixados))
        p.uncheck('#spMuda [data-sp-alt="natureza"]')
        ok(p.evaluate(ITENS) == 'fantasia,endereco,area,horario,imovel,contato', 'sem a natureza jurídica, saem os itens dos sócios')
        link2 = base + 'empresa.html?t=alteracao&m=fantasia,endereco,contato'
        ok(espera(p, "() => document.getElementById('spMsg').value.split('\\n').includes(%s)" % json.dumps(link2)), 'e o link muda junto → ' + p.input_value('#spMsg').split('\n')[-3])
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')
        p.click('[data-material="alteracao-empresa"]')
        ok(espera(p, ABERTA) and espera(p, PRONTAS_ALT, 12000) and p.evaluate(MARCADAS) == '' and p.input_value('#spCliente') == '', 'abre de novo limpa, sem nada marcado')
        p.keyboard.press('Escape')
        ok(espera(p, FECHADA), 'Esc fecha')
        p.click('#vitrine .sv-card[data-slug="alteracao-empresa"] .sv-nome')
        ok(espera(p, FICHA_ABERTA) and txt('#sMaterialBtn') == '📲 Alteração pro WhatsApp' and txt('#sFormLink') == base + 'empresa.html?t=alteracao'
           and 'pergunta ao cliente o que muda' in txt('#sFormTexto'), 'na ficha, o material e o formulário de quem marca o que muda')
        p.keyboard.press('Escape')
        ok(espera(p, "() => !document.getElementById('ovServico').classList.contains('is-open')"), 'Esc fecha a ficha')

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ' → ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
