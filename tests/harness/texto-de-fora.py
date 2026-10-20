"""
Texto que vem de fora nunca vira HTML (16/10/2026) — sem login e sem banco (o mock do conferir.py, com dados inventados
semeados por uma armadilha em window.__mockDb, só neste teste).

    python tests/harness/texto-de-fora.py

O formulário público da proposta (proposta.html) grava direto em precificacoes, sem login: o nome da empresa, o contato e
quem preencheu vão do jeito que a pessoa digitou. O banco copia o nome pro título da tarefa ("Proposta externa recebida —
…"), a transição leva o nome e o contato, e o cliente criado pela transição nasce com esse nome. Se alguma tela montasse
esse texto como HTML, um "nome" com <img onerror=…> rodaria código no navegador de quem abrisse a tela, com o login dele.

Confere, com um nome e um contato que são HTML de propósito (e as aspas que fecham atributo):
  1. Precificação › Propostas: a linha mostra o nome, o contato e quem preencheu como texto;
     abrindo a proposta, o regime digitado (A10) no título das obrigações como texto; e a proposta MEI com as notas do plano e a
     quantidade de um serviço que fecham o atributo do campo: o campo guarda o texto inteiro;
  2. Comercial › Relatórios: o título da tarefa e a empresa como texto;
  3. Transição: o cartão da lista e a ficha (contato e a empresa vinculada) como texto;
  4. Carteira: o nome, o fantasia, o contato e o motivo da saída (no título) como texto;
  5. Clientes (base mestre) e Fiscal › Clientes: o nome e o fantasia como texto;
  6. a Agenda: a tarefa da proposta (atrasada e "aguardando") conta nas atrasadas do Samuel na coluna "Seu dia" — as
     abertas, inclusive as "aguardando" (20/10/2026: o Radar do escritório, que fazia essa conta, saiu) — e, na lista das
     atrasadas, o título e a empresa saem como texto;
e, em todas, que nenhum código rodou (window.__xss) e nenhum erro de JavaScript.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

NOME = '<img src=x onerror="window.__xss=(window.__xss||0)+1">PADARIA DO TESTE'
CONTATO = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">51900000009'
QUEM = '<b onmouseover="window.__xss=1">Fulano</b>'
CLI = {'id': 'cx1', 'nome_principal': NOME, 'nome_fantasia': CONTATO, 'documento': '10000000000199', 'tipo_pessoa': 'PJ', 'status': 'ativo',
       'cidade': 'Três Coroas', 'uf': 'RS', 'regime_tributario': 'Simples Nacional', 'drive_folder_url': None}
SEMEAR = """
(() => {
  const NOME = %s, CONTATO = %s, QUEM = %s, CLI = %s;
  const hoje = new Date(), d = n => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.clientes.push({ ...CLI });
    (v.precificacoes || (v.precificacoes = [])).push({ id: 'ppx', cliente_nome: NOME, contato: CONTATO, cliente_id: null, origem: 'externa', status: 'recebida',
      respostas: { A1: NOME }, resultado: null, honorario: null, taxa_unica: null, observacao: null, criado_por: QUEM, criado_em: d(0) + 'T10:00:00Z', atualizado_em: d(0) + 'T10:00:00Z' });
    v.precificacoes.push({ id: 'ppr', cliente_nome: 'OFICINA DO TESTE', contato: null, cliente_id: null, origem: 'externa', status: 'recebida',
      respostas: { A1: 'OFICINA DO TESTE', A4: 'Simples Nacional', A10: NOME }, resultado: null, honorario: null, taxa_unica: null, observacao: null, criado_por: 'x',
      criado_em: d(0) + 'T09:00:00Z', atualizado_em: d(0) + 'T09:00:00Z' });
    v.precificacoes.push({ id: 'ppm', cliente_nome: 'MEI DO TESTE', contato: null, cliente_id: null, origem: 'externa', status: 'recebida',
      respostas: { _tipo: 'mei', bases: [], marcados: ['nfs_plano', 'sq'], nfsInclusas: CONTATO, qtd: { sq: CONTATO } }, resultado: null, honorario: null, taxa_unica: null,
      observacao: null, criado_por: 'x', criado_em: d(0) + 'T08:00:00Z', atualizado_em: d(0) + 'T08:00:00Z' });
    v.mei_planos = v.mei_planos || []; v.mei_plano_servicos = v.mei_plano_servicos || [];
    (v.mei_servicos || (v.mei_servicos = [])).push({ id: 'nfs_plano', nome: 'Emissão de notas (até X/mês)', grupo: 'mensal', tipo: 'mensal', valor_avulso: 10, ordem: 1, ativo: true },
      { id: 'sq', nome: 'Guia avulsa', grupo: 'separado', tipo: 'quantidade', valor_avulso: 20, ordem: 2, ativo: true });
    v.tarefas.push({ id: 'tx9', titulo: 'Proposta externa recebida — ' + NOME, setor: 'comercial', responsavel: 'Samuel', prazo: d(-3), status: 'aguardando',
      prioridade: 'media', cliente_id: 'cx1', proposta_id: 'ppx', hora: null, transicao_id: null, posicao: 999, competencia: null, concluida_em: null, concluida_por: null,
      clientes: { nome_principal: NOME, documento: '10000000000199' } });
    (v.transicoes || (v.transicoes = [])).push({ id: 'trx', titulo: NOME, tipo: 'entrada', proposta_id: 'ppx', padrinho: null, inicio: d(-5), previsao_fim: d(85),
      tera_funcionarios: null, contato: CONTATO, observacao: null, status: 'em_andamento', concluida_em: null, criado_em: d(-5) + 'T10:00:00Z', transicao_empresas: [{ cliente_id: 'cx1' }] });
    (v.transicao_empresas || (v.transicao_empresas = [])).push({ transicao_id: 'trx', cliente_id: 'cx1', clientes: { nome_principal: NOME, cidade: CONTATO } });
    v.carteira_info.push({ cliente_id: 'cx1', entrada: '2026-01-05', saida: null, motivo_saida: null, segmento: 'COMÉRCIO', sistemas: null, contato: CONTATO, ramo: null,
      inadimplente_desde: '2026-09-10', clientes: { ...CLI } });
    v.carteira_info.push({ cliente_id: 'cx2', entrada: '2025-01-05', saida: '2026-08-31', motivo_saida: CONTATO, segmento: 'SERVIÇO', sistemas: null, contato: null, ramo: null,
      inadimplente_desde: null, clientes: { ...CLI, id: 'cx2', nome_principal: 'SAIU DE TESTE LTDA', nome_fantasia: null } });
  } });
})();
""" % (json.dumps(NOME), json.dumps(CONTATO), json.dumps(QUEM), json.dumps(CLI, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, pagina, erros, largura=1400):
    p = b.new_page(viewport={'width': largura, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{pagina}: {e}'))
    p.on('dialog', lambda d: d.accept())
    p.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()")
    p.add_init_script(SEMEAR)
    p.goto(base + pagina); p.wait_for_timeout(1500)
    return p

def sem_codigo(p, onde):
    p.mouse.move(5, 5); p.mouse.move(400, 300)   # passa por cima, pro onmouseover que escapasse
    ok(p.evaluate('window.__xss') is None, f'{onde}: nenhum código rodou')
    ok(p.locator('img[src="x"]').count() == 0, f'{onde}: nenhuma <img> nasceu do texto')

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. Precificação › Propostas')
        p = abrir(b, base, 'comercial-precificacao.html', erros)
        p.click('#prSeg button[data-v="props"]'); p.wait_for_timeout(700)
        linha = p.locator('tr.prop[data-pid="ppx"]')
        txt = linha.inner_text() if linha.count() else ''
        ok(NOME in txt and '51900000009' in txt and '<img src=x' in txt, '1. o nome e o contato aparecem como texto, com os sinais')
        ok('<b onmouseover' in txt, '1. quem preencheu aparece como texto')
        sem_codigo(p, '1')
        p.click('tr.prop[data-pid="ppr"] td:first-child')   # na célula do nome (o meio da linha cai no seletor da situação); p.wait_for_timeout(900)
        ob = p.evaluate("() => { const e = document.querySelector('#prObrigacoes h3'); return e ? e.textContent : ''; }")   # textContent: o título é em maiúsculas pelo CSS
        ok('Obrigações do regime — ' + NOME in ob, '1. abrindo a proposta: o regime digitado no título das obrigações como texto')
        sem_codigo(p, '1. proposta aberta'); p.close()
        p = abrir(b, base, 'comercial-precificacao.html', erros)
        p.click('#prSeg button[data-v="props"]'); p.wait_for_timeout(700)
        p.click('tr.prop[data-pid="ppm"] td:first-child')   # na célula do nome (o meio da linha cai no seletor da situação); p.wait_for_timeout(900)
        vx = p.evaluate("() => { const e = document.getElementById('meiX'); return e ? e.getAttribute('value') : null; }")
        vq = p.evaluate("() => { const e = document.querySelector('[data-qtd=\"sq\"]'); return e ? e.getAttribute('value') : null; }")
        ok(vx == CONTATO and vq == CONTATO, f'1. proposta MEI: os campos das notas do plano e da quantidade guardam o texto inteiro ({vx!r}, {vq!r})')
        sem_codigo(p, '1. MEI'); p.close()

        print('2. Comercial › Relatórios')
        p = abrir(b, base, 'comercial-relatorios.html', erros)
        txt = p.inner_text('body')
        ok('Proposta externa recebida — ' + NOME in txt, '2. o título da tarefa como texto')
        sem_codigo(p, '2'); p.close()

        print('3. Transição')
        p = abrir(b, base, 'comercial-transicao.html', erros)
        card = p.locator('.tr-card[data-id="trx"]')
        ok(card.count() == 1 and NOME in card.inner_text(), '3. o cartão da lista com o nome como texto')
        sem_codigo(p, '3. lista')
        card.click(); p.wait_for_timeout(900)
        meta = p.inner_text('#detMeta') if p.locator('#detMeta').count() else ''
        emp = p.inner_text('#detEmpresas') if p.locator('#detEmpresas').count() else ''
        ok('51900000009' in meta and '<img src=x' in meta, '3. a ficha: o contato como texto')
        ok(NOME in emp, '3. a ficha: a empresa vinculada como texto')
        sem_codigo(p, '3. ficha'); p.close()

        print('4. Carteira')
        p = abrir(b, base, 'comercial-carteira.html', erros)
        corpo = p.inner_text('#ctBody')
        ok(NOME in corpo, '4. o nome como texto')
        ok(CONTATO in corpo, '4. o fantasia e o contato como texto')
        p.check('#fSaidas'); p.wait_for_timeout(400)
        titulo_saida = p.evaluate("() => { const e = document.querySelector('[data-sai=\"cx2\"]'); return e ? e.getAttribute('title') : null; }")
        ok(titulo_saida == CONTATO, '4. com as saídas na lista, o motivo da saída inteiro dentro do título (as aspas não fecham o atributo)')
        sem_codigo(p, '4'); p.close()

        print('5. Clientes')
        for pagina in ('clientes/index.html', 'fiscal-clientes.html'):
            p = abrir(b, base, pagina, erros)
            corpo = p.inner_text('body')
            ok(NOME in corpo and CONTATO in corpo, f'5. {pagina}: o nome e o fantasia como texto')
            sem_codigo(p, f'5. {pagina}'); p.close()

        print('6. Agenda')
        p = abrir(b, base, 'agenda.html', erros, largura=1700)
        p.wait_for_selector('#sdDia .sd-atras', timeout=6000)
        minhas = p.evaluate("""() => { const h = new Date().toLocaleDateString('sv-SE');
          return window.__mockDb.tarefas.filter(t => t.status !== 'concluida' && t.prazo && t.prazo < h && ['samuel', 'ambos'].includes(String(t.responsavel).toLowerCase())).map(t => t.id); }""")
        txt = ' '.join(p.text_content('#sdDia .sd-atras').split())
        ok('tx9' in minhas and txt.startswith('%d atrasadas suas' % len(minhas)), f'6. "Seu dia": as atrasadas do Samuel contam a "aguardando" da proposta ({len(minhas)}: "{txt}")')
        p.click('.fa-focus-card[data-foco="atrasadas"]')
        p.wait_for_selector('[data-bstask="tx9"]', timeout=4000)
        cartao = p.text_content('[data-bstask="tx9"]')
        ok(('Proposta externa recebida — ' + NOME) in cartao and NOME in cartao.replace('Proposta externa recebida — ' + NOME, ''), '6. na lista das atrasadas, o título e a empresa como texto')
        sem_codigo(p, '6'); p.close()

        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
