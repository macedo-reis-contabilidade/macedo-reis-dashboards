"""
Consultorias (Comercial, 25/11/2026, pedido do Samuel com a Thalia) — sem login e sem banco (o mock do conferir.py, com as
consultorias, as sessões, as tarefas de montar e a pauta semeadas só neste teste; nomes inventados). O que os gatilhos do
banco fazem (a tarefa de montar nasce com a sessão, anda com ela e sai quando ela é cancelada) o teste faz nos ganchos do
mock. O relógio fica parado em 25/11/2026, meio-dia.

    python tests/harness/consultorias.py

Confere:
  1. a lista: as ativas e as encerradas, o card com a empresa, quem monta e a próxima sessão com o dia de montar;
  2. a consultoria: as sessões em ordem, o feriado e a que já passou marcados, a pauta e a montagem de cada uma (o link da
     tarefa na Agenda), o texto de fora como texto;
  3. colar as datas: a prévia (o ano que não virou, a repetida, a linha sem data) e as sessões com a tarefa de montar;
  4. a situação e o remarcar na lista (a tarefa anda junto);
  5. a sessão: os horários da pauta, a abertura que grava sozinha e empurra os horários, abrir o arquivo, um assunto novo
     com arquivo, desistir de um assunto com arquivo (o arquivo sai da pasta), tirar um arquivo de um assunto (sai da pasta
     só depois de salvar), a ordem pelas setas, as anotações durante a sessão (grava sozinho, anda pro próximo, Esc fecha),
     o PDF (sem o que é só do escritório, com a imagem, o texto de fora escapado) e tirar um assunto da pauta;
  6. copiar a pauta da sessão anterior (sem as anotações e os arquivos, com a abertura);
  7. a sessão cancelada fica só pra consulta; o voltar do navegador volta à consultoria;
  8. a consultoria nova, com a primeira sessão;
  9. o card no Comercial ("1 ativa": a tela nova lê o banco falso do começo);
 10. no celular (400 px), a sessão e a consultoria sem rolar de lado;
e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, re
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

SEMEAR = r"""
(() => {
  let db, seqT = 0, seqP = 0;
  const menos = (iso, n) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
  const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.consultorias = [
      { id: 'k1', cliente_id: 'c1', nome: 'LOJA EXEMPLO', contatos: '<b>Fulano</b> e Beltrana', responsavel: 'Thalia', antecedencia_dias: 6,
        hora_inicio: '09:30:00', hora_fim: '11:30:00', situacao: 'ativa', observacao: 'Duas sessões por mês', atualizado_em: null, atualizado_por: null },
      { id: 'k2', cliente_id: null, nome: 'LOJA ANTIGA', contatos: null, responsavel: 'Thalia', antecedencia_dias: 6,
        hora_inicio: null, hora_fim: null, situacao: 'encerrada', observacao: null, atualizado_em: null, atualizado_por: null }
    ];
    const ses = (id, data, tarefa) => ({ id, consultoria_id: 'k1', data, hora_inicio: null, hora_fim: null, situacao: 'prevista', abertura: null,
      abertura_min: null, anotacoes: null, tarefa_id: tarefa, atualizado_em: null, atualizado_por: null });
    v.consultoria_sessoes = [ses('cs1', '2026-12-07', 'tc1'), ses('cs2', '2026-12-21', 'tc2'), ses('cs3', '2027-02-08', 'tc3'), ses('cs4', '2026-11-23', null)];
    const tar = (id, data) => ({ id, titulo: 'Consultoria LOJA EXEMPLO: montar a sessão de ' + ddmm(data), setor: 'comercial', responsavel: 'Thalia',
      prazo: menos(data, 6), status: 'pendente', prioridade: 'alta', origem: 'consultoria', cliente_id: 'c1', concluida_em: null, concluida_por: null });
    v.tarefas = (v.tarefas || []).concat([tar('tc1', '2026-12-07'), tar('tc2', '2026-12-21'), tar('tc3', '2027-02-08')]);
    v.consultoria_pautas = [
      { id: 'p1', sessao_id: 'cs1', titulo: 'Resultado do mês', descricao: 'DRE e caixa', minutos: 30, interno: false, ordem: 1, discussao: null,
        anexos: [{ caminho: 'cs1/u1-DRE.pdf', nome: 'DRE.pdf', tamanho: 12345, tipo: 'application/pdf' },
                 { caminho: 'cs1/u2-grafico.png', nome: 'grafico.png', tamanho: 2000, tipo: 'image/png' }], criado_em: '2026-11-20T10:00:00Z' },
      { id: 'p2', sessao_id: 'cs1', titulo: 'Conversa interna', descricao: null, minutos: 15, interno: true, ordem: 2, discussao: 'nota só nossa', anexos: [], criado_em: '2026-11-20T10:01:00Z' },
      { id: 'p3', sessao_id: 'cs1', titulo: '<img src=x onerror="window.__pego=1">', descricao: null, minutos: null, interno: false, ordem: 3, discussao: null, anexos: [], criado_em: '2026-11-20T10:02:00Z' }
    ];
    v.__arquivos = Object.assign(v.__arquivos || {}, {
      'consultorias/cs1/u1-DRE.pdf': { tamanho: 12345, tipo: 'application/pdf' }, 'consultorias/cs1/u2-grafico.png': { tamanho: 2000, tipo: 'image/png' }
    });
  } });
  // o que os gatilhos do banco fazem: a tarefa de montar nasce com a sessão prevista (de hoje em diante), anda com a data e
  // sai quando a sessão é cancelada; o "quem e quando" e a ordem de criação da pauta
  window.__mockAntesDeInserir = (tabela, r) => {
    if (tabela === 'consultorias') { r.situacao = r.situacao || 'ativa'; r.atualizado_em = new Date().toISOString(); }
    if (tabela === 'consultoria_pautas') { r.criado_em = new Date(Date.now() + (++seqP) * 1000).toISOString(); r.anexos = r.anexos || []; r.interno = !!r.interno; r.ordem = r.ordem || 0; r.discussao = r.discussao || null; }
    if (tabela === 'consultoria_sessoes') {
      r.situacao = r.situacao || 'prevista';
      ['hora_inicio', 'hora_fim', 'abertura', 'abertura_min', 'anotacoes', 'tarefa_id'].forEach(k => { if (!(k in r)) r[k] = null; });
      const c = db.consultorias.find(x => x.id === r.consultoria_id);
      if (r.situacao === 'prevista' && r.data >= '2026-11-25') {
        const t = { id: 'tn' + (++seqT), titulo: 'Consultoria ' + c.nome + ': montar a sessão de ' + ddmm(r.data), setor: 'comercial', responsavel: c.responsavel,
          prazo: menos(r.data, c.antecedencia_dias), status: 'pendente', prioridade: 'alta', origem: 'consultoria', cliente_id: c.cliente_id, concluida_em: null };
        db.tarefas.push(t); r.tarefa_id = t.id;
      }
    }
  };
  window.__mockAntesDeMudar = (tabela, r, era, patch) => {
    if (tabela !== 'consultoria_sessoes') return;
    const c = db.consultorias.find(x => x.id === r.consultoria_id);
    const t = r.tarefa_id && db.tarefas.find(x => x.id === r.tarefa_id);
    if ('data' in patch && t && patch.data !== era.data) { t.prazo = menos(patch.data, c.antecedencia_dias); t.titulo = 'Consultoria ' + c.nome + ': montar a sessão de ' + ddmm(patch.data); }
    if ('situacao' in patch && patch.situacao !== era.situacao && t) {
      t.status = 'concluida'; t.concluida_em = '2026-11-25T15:00:00Z';
      if (patch.situacao === 'cancelada') { t.titulo = 'Cancelada: ' + t.titulo; r.tarefa_id = null; }
    }
  };
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
# o arquivo abre numa aba nova (guardado em __abertos); o PDF é uma janela em branco onde a tela escreve (guardado em __pdf)
JANELAS = """(() => { window.__abertos = []; window.__pdf = null;
  window.open = (u) => { if (u) { window.__abertos.push(String(u)); return null; }
    const doc = { _h: '', open() { this._h = ''; }, write(h) { this._h += h; window.__pdf = this._h; }, close() {} };
    return { document: doc }; }; })()"""

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def tabela(p, t):
    return p.evaluate("t => JSON.parse(JSON.stringify(window.__mockDb[t] || []))", t)
def linha(p, t, id_):
    return next((r for r in tabela(p, t) if r.get('id') == id_), None)
def arquivos(p):
    return p.evaluate("() => Object.keys(window.__mockDb.__arquivos || {})")
def ids(p, sel):
    return p.eval_on_selector_all(sel, 'els => els.map(e => e.dataset.id)')
def esperar(p, js, arg=None, ms=5000):
    p.wait_for_function(js, arg=arg, timeout=ms)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 900})
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.on('dialog', lambda d: d.accept())
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script(JANELAS)
        p.clock.set_fixed_time('2026-11-25T12:00:00')

        print('1. A lista')
        p.goto(base + 'comercial-consultorias.html')
        p.wait_for_selector('#lista .cs-card', timeout=8000)
        ok(p.inner_text('#nAtivas') == '1' and p.inner_text('#nEncerradas') == '1', 'uma ativa e uma encerrada')
        card = p.inner_text('.cs-card[data-id="k1"]')
        ok('LOJA EXEMPLO' in card and 'COMÉRCIO MODELO ME' in card and 'Monta: Thalia, 6 dias antes' in card
           and 'Próxima: segunda-feira, 07/12/2026 · 9h30 às 11h30 · montar em 01/12' in card and '0 de 4 sessões feitas' in card,
           f'o card: a empresa, quem monta, a próxima sessão e o dia de montar ({card!r})')
        p.click('.cs-filtro-btn[data-f="encerrada"]')
        ok(ids(p, '#lista .cs-card') == ['k2'], 'as encerradas')
        p.click('.cs-filtro-btn[data-f="ativa"]')

        print('2. A consultoria')
        p.click('.cs-card[data-id="k1"]')
        p.wait_for_selector('#fSessoes tr', timeout=5000)
        ok('?c=k1' in p.url and not p.is_visible('#vLista'), f'abre a consultoria no endereço ({p.url})')
        ok(ids(p, '#fSessoes tr') == ['cs4', 'cs1', 'cs2', 'cs3'], f'as sessões pela data ({ids(p, "#fSessoes tr")})')
        ok('já passou: marque como foi' in p.inner_text('tr[data-id="cs4"]') and 'feriado (Carnaval)' in p.inner_text('tr[data-id="cs3"]'),
           'a que já passou e a do feriado, marcadas')
        r1 = p.inner_text('tr[data-id="cs1"]')
        ok('3 assuntos · 45 min' in r1 and 'Montar em 01/12 (Thalia)' in r1 and p.get_attribute('tr[data-id="cs1"] a.cs-link', 'href') == 'agenda.html?tarefa=tc1',
           f'a pauta, a montagem e o link da tarefa na Agenda ({r1!r})')
        ok('vazia' in p.inner_text('tr[data-id="cs2"]'), 'a sessão sem pauta: "vazia"')
        ok('<b>Fulano</b> e Beltrana' in p.inner_text('#fDados') and p.locator('#fDados b').count() == 0, 'o texto de fora como texto')

        print('3. Colar as datas')
        p.click('#addSessoes summary')
        p.fill('#addTexto', 'Dezembro\n11/01/2027 9h30 às 11h30\n12/01/2026\n07/12/2026')
        esperar(p, "() => document.getElementById('addSalvar').textContent === 'Adicionar 2 sessões'")
        prev = p.inner_text('#addPrevia')
        ok('segunda-feira, 11/01/2027 · 9h30 às 11h30 · montar em 05/01' in prev and 'terça-feira, 12/01/2027' in prev
           and 'estava 12/01/2026: vai pro ano seguinte' in prev and '07/12/2026: já tem sessão nesse dia' in prev and '1 linha sem data ficou de fora.' in prev,
           f'a prévia: o ano que não virou, a repetida e a linha sem data ({prev!r})')
        p.click('#addSalvar')
        esperar(p, "() => document.querySelectorAll('#fSessoes tr').length === 6")
        novas = [s for s in tabela(p, 'consultoria_sessoes') if s['data'] in ('2027-01-11', '2027-01-12')]
        tars = {t['id']: t for t in tabela(p, 'tarefas')}
        ok(len(novas) == 2 and all(s['hora_inicio'] is None for s in novas)
           and sorted(tars[s['tarefa_id']]['prazo'] for s in novas) == ['2027-01-05', '2027-01-06'],
           f'duas sessões, o horário da consultoria fica em branco, cada uma com a tarefa de montar ({novas})')
        ok('2 sessões adicionadas: as tarefas de montar estão na Agenda de Thalia.' in p.inner_text('#aviso'), 'o aviso')

        print('4. A situação e o remarcar')
        p.select_option('tr[data-id="cs4"] .cs-sel-sit', 'realizada')
        esperar(p, "() => !document.querySelector('tr[data-id=\"cs4\"]').textContent.includes('já passou')")
        ok(linha(p, 'consultoria_sessoes', 'cs4')['situacao'] == 'realizada', 'a que já passou, marcada como realizada')
        p.click('tr[data-id="cs2"] .cs-btn-remarcar')
        p.wait_for_selector('#ovR.is-open', timeout=3000)
        p.fill('#rData', '2026-12-22')
        ok('A tarefa de montar vai pra 16/12/2026.' in p.inner_text('#rPrevia'), f'a prévia do remarcar ({p.inner_text("#rPrevia")!r})')
        p.click('#rSalvar')
        esperar(p, "() => document.querySelector('tr[data-id=\"cs2\"]').textContent.includes('Montar em 16/12')")
        ok(linha(p, 'consultoria_sessoes', 'cs2')['data'] == '2026-12-22' and linha(p, 'tarefas', 'tc2')['prazo'] == '2026-12-16', 'remarcada, e a tarefa foi junto')

        print('5. A sessão')
        p.click('tr[data-id="cs1"] .cs-btn-abrir')
        p.wait_for_selector('#sItens .cs-item', timeout=5000)
        ok('?c=k1&s=cs1' in p.url and p.inner_text('#sTitulo') == 'Segunda-feira, 07/12/2026' and p.inner_text('#sOnde') == 'LOJA EXEMPLO · sessão 2 de 6',
           f'a sessão no endereço, com o dia e o número ({p.inner_text("#sOnde")!r})')
        ok(ids(p, '#sItens .cs-item') == ['p1', 'p2', 'p3'], 'os assuntos em ordem')
        hora = lambda i: p.inner_text(f'.cs-item[data-id="{i}"] .cs-item-hora')
        ok(hora('p1').startswith('9h30 às 10h') and hora('p2').startswith('10h às 10h15') and 'sem tempo' in hora('p3'), f'os horários ({hora("p1")!r}, {hora("p2")!r})')
        ok(p.inner_text('#sTempo') == '· 45 min de 2h' and 'só do escritório' in p.inner_text('.cs-item[data-id="p2"]'), 'o tempo da pauta e o assunto só do escritório')
        ok(p.evaluate('() => window.__pego') is None and p.locator('#sItens img').count() == 0 and '<img src=x' in p.inner_text('.cs-item[data-id="p3"]'),
           'o título com <img onerror> aparece como texto')
        p.fill('#sAbertura', 'Objetivo: fechar o ano')
        esperar(p, "() => (window.__mockDb.consultoria_sessoes.find(s => s.id === 'cs1') || {}).abertura === 'Objetivo: fechar o ano'")
        p.fill('#sAbMin', '10'); p.press('#sAbMin', 'Tab')
        esperar(p, "() => (window.__mockDb.consultoria_sessoes.find(s => s.id === 'cs1') || {}).abertura_min === 10")
        esperar(p, "() => document.querySelector('.cs-item[data-id=\"p1\"] .cs-item-hora').textContent.startsWith('9h40 às 10h10')")
        ok(p.inner_text('#sAbFaixa') == '9h30 às 9h40' and 'gravado ✓' in p.inner_text('#sAbSalvo'), 'a abertura grava sozinha e empurra os horários')
        p.click('.cs-item[data-id="p1"] a[data-caminho="cs1/u1-DRE.pdf"]')
        esperar(p, "() => window.__abertos.length > 0")
        ok(p.evaluate('() => window.__abertos[0]').startswith('https://arquivos.teste/consultorias/cs1/u1-DRE.pdf'), 'o arquivo abre pelo link assinado')

        # um assunto novo, com arquivo
        p.click('#sNovo'); p.wait_for_selector('#ovP.is-open', timeout=3000)
        p.click('#pSalvar')
        ok(p.inner_text('#pErro') == 'Escreva o assunto.', 'sem o assunto, não grava')
        p.fill('#pAssunto', 'Metas para 2027'); p.fill('#pDetalhe', 'Linha 1'); p.fill('#pMin', '20')
        p.set_input_files('#pArquivo', files=[{'name': 'planilha.xlsx', 'mimeType': 'application/vnd.ms-excel', 'buffer': b'conteudo'}])
        p.wait_for_selector('#pAnexos li', timeout=3000)
        p.click('#pSalvar')
        p.wait_for_selector('#ovP:not(.is-open)', state='attached', timeout=3000)
        novo = next((x for x in tabela(p, 'consultoria_pautas') if x['titulo'] == 'Metas para 2027'), None)
        ok(novo and novo['sessao_id'] == 'cs1' and novo['ordem'] == 4 and novo['minutos'] == 20 and len(novo['anexos']) == 1
           and re.fullmatch(r'cs1/[0-9a-f-]{36}-planilha\.xlsx', novo['anexos'][0]['caminho'] or '') and ('consultorias/' + novo['anexos'][0]['caminho']) in arquivos(p),
           f'o assunto novo, no fim, com o arquivo na pasta ({novo})')
        p.wait_for_selector(f'.cs-item[data-id="{novo["id"]}"]', timeout=3000)
        ok(p.inner_text(f'.cs-item[data-id="{novo["id"]}"] .cs-item-hora').startswith('10h25 às 10h45'), 'o horário do assunto novo')
        # desistir de um assunto com arquivo: o arquivo sai da pasta
        antes = len(tabela(p, 'consultoria_pautas'))
        p.click('#sNovo'); p.wait_for_selector('#ovP.is-open', timeout=3000)
        p.fill('#pAssunto', 'Rascunho')
        p.set_input_files('#pArquivo', files=[{'name': 'rascunho.pdf', 'mimeType': 'application/pdf', 'buffer': b'x'}])
        p.wait_for_selector('#pAnexos li', timeout=3000)
        ok(any(a.endswith('-rascunho.pdf') for a in arquivos(p)), 'o arquivo subiu')
        p.click('#pCancelar')
        esperar(p, "() => !Object.keys(window.__mockDb.__arquivos).some(a => a.endsWith('-rascunho.pdf'))")
        ok(len(tabela(p, 'consultoria_pautas')) == antes, 'desistiu: o assunto não entra e o arquivo sai da pasta')
        # tirar um arquivo: sai da pasta só depois de salvar
        p.click('[data-editar="p1"]'); p.wait_for_selector('#ovP.is-open', timeout=3000)
        ok(p.locator('#pAnexos li').count() == 2 and p.input_value('#pAssunto') == 'Resultado do mês', 'a edição traz o assunto e os arquivos')
        p.click('#pAnexos [data-tirar="cs1/u1-DRE.pdf"]')
        ok('consultorias/cs1/u1-DRE.pdf' in arquivos(p), 'antes de salvar, o arquivo segue na pasta')
        p.click('#pSalvar')
        p.wait_for_selector('#ovP:not(.is-open)', state='attached', timeout=3000)
        esperar(p, "() => !('consultorias/cs1/u1-DRE.pdf' in window.__mockDb.__arquivos)")
        ok(len(linha(p, 'consultoria_pautas', 'p1')['anexos']) == 1, 'salvo: o arquivo sai do assunto e da pasta')
        # a ordem
        p.click('[data-descer="p1"]')
        esperar(p, "() => document.querySelector('#sItens .cs-item').dataset.id === 'p2'")
        ok(linha(p, 'consultoria_pautas', 'p1')['ordem'] == 2 and linha(p, 'consultoria_pautas', 'p2')['ordem'] == 1, 'a seta muda a ordem')

        print('5b. Durante a sessão')
        p.click('[data-anotar="p1"]'); p.wait_for_selector('#ovN.is-open', timeout=3000)
        ok(p.inner_text('#nOnde') == 'Assunto 2 de 4 · 9h55 às 10h25' and p.inner_text('#nTitulo') == 'Resultado do mês', f'o assunto e o horário ({p.inner_text("#nOnde")!r})')
        p.fill('#nTexto', 'Conversamos sobre o caixa')
        esperar(p, "() => (window.__mockDb.consultoria_pautas.find(x => x.id === 'p1') || {}).discussao === 'Conversamos sobre o caixa'")
        ok('gravado ✓' in p.inner_text('#nStatus'), 'as anotações gravam sozinhas')
        p.click('#nProximo')
        esperar(p, "() => document.getElementById('nOnde').textContent.startsWith('Assunto 3 de 4')")
        ok(p.inner_text('#nTitulo').startswith('<img src=x') and p.input_value('#nTexto') == '', 'o próximo assunto')
        p.keyboard.press('Escape')
        p.wait_for_selector('#ovN:not(.is-open)', state='attached', timeout=3000)
        ok('Anotações: Conversamos sobre o caixa' in p.inner_text('.cs-item[data-id="p1"]'), 'Esc fecha; o assunto mostra as anotações')

        print('5c. O PDF')
        p.click('#sPdf')
        esperar(p, "() => (window.__pdf || '').includes('</html>')")
        pdf = p.evaluate('() => window.__pdf')
        ok('<h1>Pauta e anotações da sessão</h1>' in pdf and 'Objetivo: fechar o ano' in pdf and 'Resultado do mês' in pdf and 'Conversamos sobre o caixa' in pdf
           and 'Metas para 2027' in pdf and 'sessão 2 de 6' in pdf and '9h55 às 10h25' in pdf, 'o PDF: o título, a abertura, os assuntos com os horários e as anotações')
        ok('Conversa interna' not in pdf and 'nota só nossa' not in pdf, 'o que é só do escritório fica fora do PDF')
        ok('<img class="pauta-img" src="data:image/svg+xml' in pdf and 'DRE.pdf' not in pdf, 'a imagem anexada vai no PDF; o arquivo, não')
        ok('&lt;img src=x' in pdf and '<img src=x' not in pdf and '&lt;b&gt;Fulano' in pdf and 'Empresa:</b> COMÉRCIO MODELO ME' in pdf, 'o texto de fora escapado no PDF')
        # tirar o assunto novo: as anotações e o arquivo saem junto
        p.click(f'[data-editar="{novo["id"]}"]'); p.wait_for_selector('#ovP.is-open', timeout=3000)
        p.click('#pTirar')
        p.wait_for_selector('#ovP:not(.is-open)', state='attached', timeout=3000)
        esperar(p, "id => !window.__mockDb.consultoria_pautas.some(x => x.id === id)", novo['id'])
        ok(('consultorias/' + novo['anexos'][0]['caminho']) not in arquivos(p) and p.locator('#sItens .cs-item').count() == 3, 'tirado da pauta, com o arquivo')

        print('6. Copiar a pauta da sessão anterior')
        p.click('#btnVoltarFicha')
        p.wait_for_selector('#vFicha:not([hidden]) #fSessoes tr', timeout=3000)
        ok('3 assuntos · 45 min' in p.inner_text('tr[data-id="cs1"]'), 'de volta à consultoria, com a pauta atualizada')
        p.click('tr[data-id="cs2"] .cs-btn-abrir')
        p.wait_for_selector('#sCopiar:not([hidden])', timeout=3000)
        ok(p.inner_text('#sCopiar') == 'Copiar a pauta de 07/12' and 'Pauta vazia' in p.inner_text('#sItens'), 'a pauta vazia oferece copiar a de 07/12')
        p.click('#sCopiar')
        p.wait_for_selector('#sItens .cs-item', timeout=3000)
        cop = sorted([x for x in tabela(p, 'consultoria_pautas') if x['sessao_id'] == 'cs2'], key=lambda x: x['ordem'])
        ok([x['titulo'] for x in cop] == ['Conversa interna', 'Resultado do mês', '<img src=x onerror="window.__pego=1">'] and all(not x.get('discussao') and x['anexos'] == [] for x in cop)
           and cop[0]['interno'] is True, f'copiou os assuntos na ordem, sem as anotações e os arquivos ({[x["titulo"] for x in cop]})')
        s2 = linha(p, 'consultoria_sessoes', 'cs2')
        ok(s2['abertura'] == 'Objetivo: fechar o ano' and s2['abertura_min'] == 10 and p.input_value('#sAbertura') == 'Objetivo: fechar o ano', 'a abertura veio junto')
        ok('3 assuntos copiados da sessão de 07/12/2026' in p.inner_text('#aviso') and p.is_hidden('#sCopiar'), 'o aviso; o botão some')

        print('7. A sessão cancelada e o voltar do navegador')
        p.select_option('#sSit', 'cancelada')
        p.wait_for_selector('#sCancelada:not([hidden])', timeout=3000)
        ok(linha(p, 'consultoria_sessoes', 'cs2')['situacao'] == 'cancelada' and p.is_hidden('#sNovo') and p.is_disabled('#sAbertura')
           and p.locator('[data-editar]').count() == 0 and p.is_hidden('#sRemarcar'), 'cancelada: só pra consulta')
        p.go_back()
        p.wait_for_selector('#vFicha:not([hidden])', timeout=3000)
        ok(p.is_hidden('#vSessao') and '?c=k1' in p.url and '&s=' not in p.url, 'o voltar do navegador volta à consultoria')

        print('8. A consultoria nova')
        p.click('#btnVoltar'); p.wait_for_selector('#vLista:not([hidden])', timeout=3000)
        p.click('#btnNova'); p.wait_for_selector('#ovC.is-open', timeout=3000)
        ok(p.input_value('#cResp') == 'Thalia' and p.input_value('#cDias') == '6' and p.is_hidden('#cSitCampo'), 'a nova: Thalia, 6 dias, sem a situação')
        p.fill('#cNome', 'CONSULTORIA NOVA'); p.select_option('#cCliente', 'c2'); p.fill('#cIni', '14:00'); p.fill('#cFim', '16:00')
        p.click('#cSalvar')
        p.wait_for_selector('#vFicha:not([hidden])', timeout=3000)
        nova = next((c for c in tabela(p, 'consultorias') if c['nome'] == 'CONSULTORIA NOVA'), None)
        ok(nova and nova['cliente_id'] == 'c2' and nova['antecedencia_dias'] == 6 and f'?c={nova["id"]}' in p.url and p.evaluate("() => document.getElementById('addSessoes').open"),
           'criada: a consultoria abre com o colar das datas aberto')
        p.fill('#addTexto', '14/12/2026')
        esperar(p, "() => document.getElementById('addSalvar').textContent === 'Adicionar 1 sessão'")
        p.click('#addSalvar')
        p.wait_for_selector('#fSessoes tr', timeout=3000)
        s_nova = next((s for s in tabela(p, 'consultoria_sessoes') if s['consultoria_id'] == nova['id']), None)
        t_nova = linha(p, 'tarefas', s_nova['tarefa_id']) if s_nova else None
        ok(t_nova and t_nova['prazo'] == '2026-12-08' and t_nova['responsavel'] == 'Thalia' and 'segunda-feira, 14/12/2026' in p.inner_text('#fSessoes')
           and '14h às 16h' in p.inner_text('#fSessoes'), 'a primeira sessão, com a tarefa de montar')

        print('9. O card no Comercial')
        p.goto(base + 'comercial.html')
        esperar(p, "() => { const el = document.querySelector('.card-status[data-mod=\"comercial-consultorias.html\"]'); return el && el.textContent !== '·'; }")
        selo = p.text_content('.card-status[data-mod="comercial-consultorias.html"]')
        ok(selo == '1 ativa', f'o card (a tela nova lê o banco falso do começo): "1 ativa" ({selo!r})')

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')

        print('10. No celular')
        cel = b.new_context(viewport={'width': 400, 'height': 860})
        m = cel.new_page()
        m.on('pageerror', lambda e: erros.append('celular: ' + str(e)))
        m.add_init_script(TOUR); m.add_init_script(SEMEAR); m.add_init_script(JANELAS)
        m.clock.set_fixed_time('2026-11-25T12:00:00')
        m.goto(base + 'comercial-consultorias.html?c=k1&s=cs1')
        m.wait_for_selector('#sItens .cs-item', timeout=8000)
        largo = lambda: m.evaluate('() => document.documentElement.scrollWidth - window.innerWidth')
        ok(largo() <= 0, f'a sessão sem rolar de lado ({largo()} px a mais)')
        m.click('#btnVoltarFicha'); m.wait_for_selector('#vFicha:not([hidden]) #fSessoes tr', timeout=3000)
        ok(largo() <= 0, f'a consultoria sem rolar de lado ({largo()} px a mais)')
        ok(not [e for e in erros if e.startswith('celular')], 'nenhum erro de JavaScript no celular')
        cel.close()
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
