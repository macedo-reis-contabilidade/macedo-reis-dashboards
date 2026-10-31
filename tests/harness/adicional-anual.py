"""
Teste da janela "Honorário adicional anual" da tela Boletos (financeiro-boletos.html + assets/js/adicional-anual-tela.js,
31/10/2026) — sem login, sem banco e sem Conta Azul: a função ca-vendas é um dublê em window.__mockInvoke (empresas,
números e contas inventados).

    python tests/harness/adicional-anual.py

Confere, no tema escuro:
  1. o botão só aparece pros sócios (a Thalia não vê); a janela abre na competência de outubro (a tela em 11/2026 →
     10/2026); o Conta Azul "renovando" na primeira chamada: a janela avisa e tenta de novo sozinha;
  2. a lista: os números por grupo, os três anos (o valor, "isento", "MEI"), a mensalidade, os meses (4/12 em destaque),
     o vencimento e a conta de cada uma (a do Inter pelo boleto), o boleto; o nome com HTML vem como texto;
  3. o total das marcadas acompanha o desmarcar e o valor mudado; os filtros por grupo e a busca;
  4. "Lançar a primeira pra conferir": uma venda só, a linha lançada com o número, sem a tarefa ainda;
  5. "Lançar as marcadas": a confirmação, de 20 em 20 (com as travas no meio), a recusada com o motivo na linha, a do
     boleto emitido com o porquê; a tarefa da Thalia (fiscal, alta, prazo no próximo dia útil) com todas as vendas do
     sistema — a primeira também —, o nome com HTML como texto, e o histórico;
  6. "Pôr no boleto a que falta";
  7. "Desfazer as lançadas agora": a exclusão, a que o Conta Azul não excluiu fica, a lista de volta, e a tarefa perde
     as linhas das excluídas (a que ficou continua);
  8. lançar de novo: as vendas entram na tarefa que já estava aberta (sem tarefa nova, sem repetir);
  9. fechar com mudança marcada pergunta; Esc fecha e o foco volta ao botão.
No tema claro: sem a venda modelo, o aviso e o lançar travado. Fotos em .harness/fotos/.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

TITULO_TAREFA = 'Emitir as NFS-e do honorário adicional anual (10/2026)'
INIT_TEMA = "localStorage.setItem('mr_tema', '%s'); (() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

# o dublê da função ca-vendas: a lista (prever) monta-se de uma base inventada e do que já foi lançado; lançar, pôr no
# boleto e desfazer mexem nesse estado
DUBLE = r"""(() => {
  const P = n => '9a000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const INTER = 'c0000000-0000-4000-8000-000000000001', SICREDI = 'c0000000-0000-4000-8000-000000000002';
  const conta = (id, de) => ({ id, nome: id === INTER ? 'BANCO INTER - CONTA CORRENTE' : 'SICREDI CONTA CORRENTE', de });
  const hist = (a, b, c) => ({ 2023: a, 2024: b, 2025: c });
  const base = [];
  for (let n = 1; n <= 22; n++) {
    base.push({ pessoa: P(n), nome: 'EMPRESA TESTE ' + String(n).padStart(2, '0') + ' LTDA', grupo: 'sugerida', marcada: true, valor: 500 + n,
      historico: hist({ valor: 400 + n, parcelas: 1 }, { valor: 450 + n, parcelas: 1 }, { valor: 480 + n, parcelas: 1 }),
      mensal: { valor: 500 + n, vencimento: '2026-11-10', numeros: [1000 + n], mei: false }, meses: 12,
      cliente_id: 'k' + n, cliente_nome: 'EMPRESA TESTE ' + String(n).padStart(2, '0') + ' LTDA',
      vencimento: n === 3 ? '2026-11-09' : '2026-11-10', vencimento_de: n === 3 ? 'boleto' : 'mensalidade',
      boleto: n === 3 ? { id: 'b3', vencimento: '2026-11-09', status: 'a_emitir' } : n === 4 ? { id: 'b4', vencimento: '2026-11-10', status: 'emitido' } : null,
      conta: n === 3 || n === 4 ? conta(INTER, 'boleto') : conta(SICREDI, 'ano_anterior'), motivo: 'Pagou em 2025. A mensalidade de 10/2026.' });
  }
  base.push({ pessoa: P(30), nome: 'ZZ <img src=x onerror="window.__xss=1"> LTDA', grupo: 'sugerida', marcada: true, valor: 300,
    historico: hist(null, null, { valor: 290, parcelas: 1 }), mensal: { valor: 300, vencimento: '2026-11-10', numeros: [2], mei: false }, meses: 12,
    cliente_id: null, cliente_nome: null, vencimento: '2026-11-10', vencimento_de: 'mensalidade', boleto: null, conta: conta(SICREDI, 'modelo'), motivo: 'Pagou em 2025.' });
  base.push({ pessoa: P(40), nome: 'PADARIA NOVA DE TESTE LTDA', grupo: 'nova', marcada: true, valor: 183.33,
    historico: hist(null, null, null), mensal: { valor: 550, vencimento: '2026-10-28', numeros: [3], mei: false }, meses: 4, primeira: '2026-09',
    cliente_id: 'k40', cliente_nome: 'PADARIA NOVA DE TESTE LTDA', vencimento: '2026-11-30', vencimento_de: 'mensalidade_ajustada', vencimento_antes: '2026-10-28',
    boleto: null, conta: conta(SICREDI, 'modelo'), motivo: 'Primeira mensalidade em 09/2026: 4/12.' });
  base.push({ pessoa: P(50), nome: 'OFICINA ISENTA DE TESTE LTDA', grupo: 'isenta', marcada: false, valor: 450,
    historico: hist({ isento: true, mei: false, mensal: 400 }, { isento: true, mei: false, mensal: 420 }, { isento: true, mei: false, mensal: 440 }),
    mensal: { valor: 450, vencimento: '2026-11-10', numeros: [4], mei: false }, meses: 12, cliente_id: 'k50', cliente_nome: 'OFICINA ISENTA DE TESTE LTDA',
    vencimento: '2026-11-10', vencimento_de: 'mensalidade', boleto: null, conta: conta(SICREDI, 'modelo'), motivo: 'Tinha mensalidade em 10/2025 e não pagou o adicional: isenta?' });
  base.push({ pessoa: P(60), nome: 'MEI DE TESTE', grupo: 'mei', marcada: false, valor: 90,
    historico: hist({ isento: false, mei: true, mensal: 80 }, null, null), mensal: { valor: 90, vencimento: '2026-11-10', numeros: [5], mei: true }, meses: 12,
    cliente_id: null, cliente_nome: null, vencimento: '2026-11-10', vencimento_de: 'mensalidade', boleto: null, conta: conta(SICREDI, 'modelo'), motivo: 'Contrato MEI: não paga o adicional.' });
  base.push({ pessoa: P(70), nome: 'SAIU NO MEIO DO ANO DE TESTE LTDA', grupo: 'sem_mensal', marcada: false, valor: null,
    historico: hist(null, null, { valor: 610, parcelas: 1 }), mensal: null, meses: 12, cliente_id: null, cliente_nome: null,
    vencimento: null, vencimento_de: null, boleto: null, conta: conta(SICREDI, 'ano_anterior'), motivo: 'Pagou em 2025, mas não tem mensalidade de 10/2026 no Conta Azul.' });

  const est = { lancadas: new Map(), chamadas: [], renovando: 1, numero: 190421459, seq: 0, atraso: 0, semModelo: false, recusar: new Set([P(5)]), naoExclui: new Set([P(2)]) };
  window.__ca = est;
  const copia = v => JSON.parse(JSON.stringify(v));
  const prever = () => {
    const itens = base.map(b => {
      const l = est.lancadas.get(b.pessoa);
      if (!l) return copia(b);
      return { ...copia(b), grupo: 'lancada', marcada: false, valor: l.valor, vencimento: l.vencimento,
        lancada: { id: l.id, situacao: 'lancada', de: 'sistema', numero: l.numero, no_boleto: l.no_boleto }, motivo: 'Lançada pelo sistema.' };
    });
    return { competencia: '2026-10', data_venda: '2026-10-31', hoje: '2026-10-31', anos: [2023, 2024, 2025], itens, resumo: {},
      avisos: est.semModelo ? ['Não achei no Conta Azul uma venda do adicional de anos anteriores pra copiar o serviço e a conta: lance a primeira à mão.'] : [],
      boletos: 2, contas: [{ id: INTER, nome: 'BANCO INTER - CONTA CORRENTE' }, { id: SICREDI, nome: 'SICREDI CONTA CORRENTE' }],
      modelo: est.semModelo ? null : { numero: 190419259, data: '2025-10-31', cliente: 'CLIENTE MODELO DE TESTE', servico: 'HONORÁRIO ADICIONAL ANUAL', vendedor: 'Contador', conta: 'BANCO INTER - CONTA CORRENTE' } };
  };
  const espera = () => new Promise(r => setTimeout(r, est.atraso));
  window.__mockInvoke = async (nome, op) => {
    const body = (op && op.body) || {};
    est.chamadas.push(copia({ nome, ...body }));
    if (nome !== 'ca-vendas') return { data: null, error: { message: 'função ' + nome + ' fora do teste' } };
    if (est.renovando > 0) { est.renovando--; return { data: null, error: { context: new Response(JSON.stringify({ erro: 'A conexão com o Conta Azul está sendo renovada. Tento de novo em instantes.', renovando: true }), { status: 503 }) } }; }
    await espera();
    if (body.modo === 'prever') return { data: prever(), error: null };
    if (body.modo === 'lancar') {
      const resultados = body.itens.map(it => {
        if (est.recusar.has(it.pessoa)) return { pessoa: it.pessoa, ok: false, erro: 'o Conta Azul não aceitou: Cliente bloqueado para vendas' };
        if (est.lancadas.has(it.pessoa)) return { pessoa: it.pessoa, ok: false, erro: 'já lançada (ou em lançamento agora)' };
        const b = base.find(x => x.pessoa === it.pessoa);
        const boleto = !body.boleto ? null
          : !b.cliente_id ? { posto: false, motivo: 'a empresa não foi achada no cadastro (pelo CNPJ nem pelo nome)' }
          : !b.boleto ? { posto: false, motivo: 'sem boleto de 10/2026 em Boletos' }
          : b.boleto.status !== 'a_emitir' ? { posto: false, motivo: 'o boleto de 10/2026 já está emitido: o adicional não entrou' }
          : { posto: false, motivo: 'o boleto mudou de situação agora: tente de novo' };
        const l = { id: 'l' + (++est.seq), numero: est.numero++, valor: it.valor, vencimento: it.vencimento, conta: it.conta, no_boleto: false };
        est.lancadas.set(it.pessoa, l);
        return { pessoa: it.pessoa, ok: true, id: l.id, numero: l.numero, valor: it.valor, vencimento: it.vencimento, nome: it.nome, cliente_id: b.cliente_id, boleto };
      });
      return { data: { resultados, modelo: body.modelo }, error: null };
    }
    if (body.modo === 'boleto') {
      const resultados = [];
      for (const [pessoa, l] of est.lancadas) {
        const b = base.find(x => x.pessoa === pessoa);
        if (b.boleto && b.boleto.status === 'a_emitir') { const ja = l.no_boleto; l.no_boleto = true; resultados.push({ id: l.id, nome: b.nome, numero: l.numero, posto: true, ...(ja ? { ja: true } : {}) }); }
      }
      return { data: { resultados }, error: null };
    }
    if (body.modo === 'desfazer') {
      const excluidas = [], ficaram = [];
      for (const [pessoa, l] of [...est.lancadas]) {
        if (!body.ids.includes(l.id)) continue;
        const b = base.find(x => x.pessoa === pessoa);
        if (est.naoExclui.has(pessoa)) { ficaram.push({ id: l.id, nome: b.nome, numero: l.numero, motivo: 'o Conta Azul não excluiu (tem nota emitida ou valor recebido?)' }); continue; }
        est.lancadas.delete(pessoa);
        excluidas.push({ id: l.id, nome: b.nome, numero: l.numero, boleto: l.no_boleto ? 'saiu do boleto' : null });
      }
      return { data: { excluidas, ficaram }, error: null };
    }
    return { data: null, error: { context: new Response(JSON.stringify({ erro: 'Modo desconhecido.' }), { status: 400 }) } };
  };
})();"""


def ca(p, expr):
    return p.evaluate('() => ' + expr)

def tarefas(p):
    return ca(p, f"window.__mockDb.tarefas.filter(t => t.titulo === {json.dumps(TITULO_TAREFA)})")

def linha(p, n):
    return p.locator(f'#aaBody tr[data-pessoa="9a000000-0000-4000-8000-{n:012d}"]')

def esperar_msg(p, trecho, ms=8000):
    p.wait_for_function('t => (document.querySelector("#aaMsg") || {}).textContent && document.querySelector("#aaMsg").textContent.includes(t)', arg=trecho, timeout=ms)

def abrir(b, base, tema, erros, email=None, sem_modelo=False):
    p = b.new_page(viewport={'width': 1440, 'height': 950})
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    p.add_init_script("window.confirm = m => { (window.__perguntas ||= []).push(String(m)); return !window.__recusarDialogo; };")
    p.add_init_script(INIT_TEMA % tema)
    p.add_init_script('window.__adicionalEsperaMs = 300;' + (f'window.__mockEmail = {json.dumps(email)};' if email else ''))
    p.add_init_script(DUBLE)
    if sem_modelo:
        p.add_init_script('window.__ca.semModelo = true; window.__ca.renovando = 0;')
    p.goto(base + 'financeiro-boletos.html?competencia=2026-11')
    p.wait_for_function('() => document.getElementById("comp").value === "2026-11"')
    p.wait_for_timeout(300)
    return p

def fluxo(b, base, erros):
    tema = 'escuro'
    print('[escuro] 1. quem vê e a abertura')
    t = abrir(b, base, tema, erros, email='fiscal@macedoereis.com.br')
    ok(not t.locator('#btnAdicional').is_visible(), '1. a Thalia não vê o botão (só os sócios)')
    t.close()
    p = abrir(b, base, tema, erros)
    ok(p.locator('#btnAdicional').is_visible(), '1. o sócio vê o botão "Honorário adicional anual"')
    p.click('#btnAdicional')
    p.wait_for_selector('#aaOv')
    ok(p.inner_text('#aaTitulo') == 'Honorário adicional anual de 10/2026', '1. a tela em 11/2026 abre a competência 10/2026: ' + p.inner_text('#aaTitulo'))
    p.wait_for_function('() => /renovando a conexão/.test(document.querySelector("#aaBody").textContent)', timeout=5000)
    ok(True, '1. o Conta Azul renovando: a janela avisa e espera')
    p.wait_for_selector('#aaBody table.bo tbody tr[data-pessoa]', timeout=8000)
    prev = [c for c in ca(p, 'window.__ca.chamadas') if c.get('modo') == 'prever']
    ok(len(prev) == 2 and prev[0]['competencia'] == '2026-10', '1. tentou de novo sozinha e leu a lista (2 chamadas)')

    print('[escuro] 2. a lista')
    cards = {x['f']: x['n'] for x in p.eval_on_selector_all('#aaBody [data-filtro]', 'els => els.map(e => ({ f: e.dataset.filtro, n: e.querySelector(".fc-num").textContent }))')}
    ok(cards == {'todas': '27', 'sugerida': '23', 'nova': '1', 'isenta': '1', 'sem_mensal': '1', 'mei': '1', 'lancada': '0'}, '2. os números por grupo: ' + json.dumps(cards))
    l1 = linha(p, 1).inner_text()
    ok('R$ 401,00' in l1 and 'R$ 451,00' in l1 and 'R$ 481,00' in l1 and 'R$ 501,00' in l1 and '12/12' in l1, '2. os três anos, a mensalidade e os meses')
    ok(linha(p, 1).locator('[data-f="valor"]').input_value() == '501' and linha(p, 1).locator('[data-f="venc"]').input_value() == '2026-11-10', '2. o valor e o vencimento editáveis, já preenchidos')
    ok(linha(p, 3).locator('select[data-f="conta"]').input_value() == 'c0000000-0000-4000-8000-000000000001' and 'a do boleto (Inter)' in linha(p, 3).inner_text()
       and 'a emitir · 09/11' in linha(p, 3).inner_text(), '2. com o boleto a emitir: a conta do Inter e o vencimento do boleto')
    ok(linha(p, 1).locator('select[data-f="conta"]').input_value() == 'c0000000-0000-4000-8000-000000000002' and 'a do ano passado' in l1, '2. sem boleto: a conta do ano passado')
    l50 = linha(p, 50)
    ok(l50.inner_text().count('isento') == 3 and not l50.locator('[data-marcar]').is_checked(), '2. a isenta: "isento" nos três anos, desmarcada')
    l40 = linha(p, 40)
    ok('4/12' in l40.inner_text() and 'a de outubro venceu 28/10' in l40.inner_text() and l40.locator('[data-f="valor"]').input_value() == '183.33', '2. a nova: 4/12, o proporcional e o vencimento ajustado com o porquê')
    ok('MEI' in linha(p, 60).inner_text() and not linha(p, 60).locator('[data-marcar]').is_checked(), '2. o contrato MEI desmarcado')
    ok(linha(p, 70).locator('[data-f="valor"]').input_value() == '', '2. sem mensalidade: sem valor (tem de digitar)')
    l30 = linha(p, 30)
    ok('<img' in l30.inner_text() and l30.locator('img').count() == 0 and ca(p, 'window.__xss') is None and 'sem cadastro' in l30.inner_text(), '2. o nome com HTML vem como texto; sem cadastro avisa')
    ok('copiando a venda 190419259' in p.inner_text('#aaBody') and 'HONORÁRIO ADICIONAL ANUAL' in p.inner_text('#aaBody'), '2. diz a venda modelo e o serviço')
    p.screenshot(path=str(FOTOS / f'{tema}-adicional-anual.png'))

    print('[escuro] 3. o total, os filtros e a busca')
    total = sum(500 + n for n in range(1, 23)) + 300 + 183.33
    br = lambda v: f'{v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    ok(p.inner_text('#aaTot') == f'24 empresas · R$ {br(total)}', '3. o total das marcadas: ' + p.inner_text('#aaTot'))
    linha(p, 22).locator('[data-marcar]').uncheck()
    ok(p.inner_text('#aaTot') == f'23 empresas · R$ {br(total - 522)}', '3. desmarcar tira do total')
    linha(p, 21).locator('[data-f="valor"]').fill('600')
    ok(p.inner_text('#aaTot') == f'23 empresas · R$ {br(total - 522 - 521 + 600)}' and p.inner_text('#aaLancar') == 'Lançar 23 marcadas no Conta Azul', '3. o valor mudado entra no total e no botão')
    p.click('#aaBody [data-filtro="nova"]')
    ok(p.locator('#aaBody tr[data-pessoa]').count() == 1 and linha(p, 40).count() == 1 and p.get_attribute('#aaBody [data-filtro="nova"]', 'aria-pressed') == 'true', '3. o filtro das novas')
    p.click('#aaBody [data-filtro="todas"]')
    p.fill('#aaBusca', 'teste 07')
    ok(p.locator('#aaBody tr[data-pessoa]').count() == 1 and linha(p, 7).count() == 1 and p.evaluate('document.activeElement.id') == 'aaBusca', '3. a busca, sem perder o cursor')
    p.fill('#aaBusca', '')
    ok(p.locator('#aaBody tr[data-pessoa]').count() == 27 and p.inner_text('#aaTot').startswith('23 empresas'), '3. sem busca, todas de volta, as marcações mantidas')

    print('[escuro] 4. a primeira pra conferir')
    p.click('#aaPrimeira')
    esperar_msg(p, 'Confira no Conta Azul')
    lancar = [c for c in ca(p, 'window.__ca.chamadas') if c.get('modo') == 'lancar']
    ok(len(lancar) == 1 and len(lancar[0]['itens']) == 1 and lancar[0]['itens'][0]['pessoa'].endswith('000000000001') and lancar[0]['modelo'] == 190419259
       and lancar[0]['boleto'] is True and lancar[0]['itens'][0]['conta'] == 'c0000000-0000-4000-8000-000000000002', '4. uma venda só (a primeira pelo nome), com a modelo, o boleto e a conta')
    ok('✓ venda 190421459' in linha(p, 1).inner_text() and linha(p, 1).locator('[data-marcar]').is_disabled(), '4. a linha lançada, com o número da venda')
    ok('Lançada a venda 190421459 de EMPRESA TESTE 01 LTDA' in p.inner_text('#aaMsg') and len(tarefas(p)) == 0, '4. o aviso, e a tarefa ainda não')
    ok(p.locator('#aaPrimeira').count() == 0 and p.inner_text('#aaDesfazer') == 'Desfazer a lançada agora', '4. some o "primeira", aparece o desfazer')

    print('[escuro] 5. as marcadas')
    ca(p, 'window.__ca.atraso = 500')
    p.click('#aaLancar')
    p.wait_for_function('() => /Lançando 20 de 22/.test(document.querySelector("#aaMsg").textContent)', timeout=4000)
    ok(p.locator('#aaFechar').is_disabled() and p.locator('#aaLancar').is_disabled(), '5. no meio do lançamento: a janela travada')
    esperar_msg(p, 'tarefa da Thalia', 12000)
    ca(p, 'window.__ca.atraso = 0')
    lancar = [c for c in ca(p, 'window.__ca.chamadas') if c.get('modo') == 'lancar']
    ok([len(c['itens']) for c in lancar] == [1, 20, 2], '5. de 20 em 20: ' + json.dumps([len(c['itens']) for c in lancar]))
    ok(any(i['pessoa'].endswith('000000000021') and i['valor'] == 600 for c in lancar for i in c['itens']), '5. o valor mudado foi o lançado')
    ok(not any(i['pessoa'].endswith('000000000022') for c in lancar for i in c['itens']), '5. a desmarcada não foi')
    msg = p.inner_text('#aaMsg')
    ok('✓ 21 vendas lançadas no Conta Azul. 1 não foi: o motivo está na linha.' in msg, '5. o resumo: ' + msg)
    ok('Cliente bloqueado para vendas' in linha(p, 5).inner_text() and linha(p, 5).locator('[data-marcar]').is_checked(), '5. a recusada com o motivo, ainda marcada')
    ok('já está emitido' in linha(p, 4).inner_text() and 'fora do boleto' in linha(p, 4).inner_text(), '5. a do boleto emitido: lançada, fora do boleto, com o porquê')
    ts = tarefas(p)
    ok(len(ts) == 1 and ts[0]['setor'] == 'fiscal' and ts[0]['responsavel'] == 'Thalia' and ts[0]['prioridade'] == 'alta' and ts[0]['status'] == 'pendente', '5. a tarefa da Thalia: fiscal, alta, pendente')
    desc = ts[0]['descricao'] if ts else ''
    prazo = ts[0]['prazo'] if ts else ''
    d = datetime.date.fromisoformat(prazo) if prazo else None
    ok(d and d > datetime.date.today() and d.weekday() < 5 and prazo != '2026-11-02', '5. o prazo no próximo dia útil (não o feriado de Finados): ' + str(prazo))
    ok(desc.count('☐ ') == 22 and '☐ EMPRESA TESTE 01 LTDA — venda 190421459 — R$ 501,00' in desc and 'EMPRESA TESTE 05' not in desc and 'R$ 600,00' in desc,
       '5. a lista: as 22 vendas do sistema, a primeira também, sem a recusada')
    ok('Criei a tarefa da Thalia pra emitir as NFS-e (22 vendas).' in msg, '5. o aviso da tarefa')
    hist = ca(p, f"window.__mockDb.tarefa_historico.filter(h => h.tarefa_id === {json.dumps(ts[0]['id'] if ts else '')})")
    ok(len(hist) == 1 and hist[0]['autor'] == 'Samuel', '5. o histórico da tarefa, por quem lançou')
    ok(p.inner_text('#aaBody [data-filtro="lancada"] .fc-num') == '22', '5. o número das lançadas acompanha')
    p.screenshot(path=str(FOTOS / f'{tema}-adicional-anual-lancadas.png'))

    print('[escuro] 6. pôr no boleto a que falta')
    ok(p.inner_text('#aaPorBoleto') == 'Pôr no boleto a que falta', '6. o botão, pela empresa do boleto a emitir que ficou de fora')
    p.click('#aaPorBoleto')
    esperar_msg(p, 'entrou no boleto')
    ok('✓ 1 adicional entrou no boleto.' in p.inner_text('#aaMsg') and 'no boleto' in linha(p, 3).inner_text() and p.locator('#aaPorBoleto').count() == 0, '6. entrou, e a linha mostra')

    print('[escuro] 7. desfazer')
    ok(p.inner_text('#aaDesfazer') == 'Desfazer as 22 lançadas agora', '7. o desfazer conta as desta janela')
    p.click('#aaDesfazer')
    esperar_msg(p, 'excluídas do Conta Azul')
    des = [c for c in ca(p, 'window.__ca.chamadas') if c.get('modo') == 'desfazer']
    ok(len(des) == 1 and len(des[0]['ids']) == 22, '7. pediu a exclusão das 22')
    msg = p.inner_text('#aaMsg')
    ok('✓ 21 vendas excluídas do Conta Azul.' in msg and 'Ficaram: EMPRESA TESTE 02 LTDA (o Conta Azul não excluiu' in msg, '7. o resumo, com a que ficou: ' + msg)
    ok('✓ venda' in linha(p, 2).inner_text() and linha(p, 1).locator('[data-marcar]').is_checked() and not linha(p, 1).locator('[data-marcar]').is_disabled(), '7. a lista de volta: a que ficou lançada, as outras pra lançar')
    ts = tarefas(p)
    desc = ts[0]['descricao'] if ts else ''
    ok(len(ts) == 1 and desc.count('☐ ') == 1 and 'EMPRESA TESTE 02 LTDA' in desc, '7. a tarefa ficou só com a venda que não saiu')
    ok(p.inner_text('#aaDesfazer') == 'Desfazer a lançada agora', '7. o desfazer agora conta só a que ficou')

    print('[escuro] 8. lançar de novo: a mesma tarefa')
    ca(p, 'window.__ca.recusar.clear()')
    p.click('#aaLancar')
    esperar_msg(p, 'tarefa da Thalia que já estava aberta', 12000)
    ts = tarefas(p)
    desc = ts[0]['descricao'] if ts else ''
    ok(len(ts) == 1 and desc.count('☐ ') == 24 and desc.count('EMPRESA TESTE 02 LTDA') == 1, '8. as 23 novas entraram na tarefa aberta, sem repetir: ' + str(desc.count('☐ ')))
    ok('23 vendas entraram na tarefa da Thalia que já estava aberta.' in p.inner_text('#aaMsg'), '8. o aviso')

    print('[escuro] 9. fechar')
    linha(p, 50).locator('[data-marcar]').check()
    linha(p, 50).locator('[data-f="valor"]').fill('200')
    ca(p, 'window.__recusarDialogo = true')
    p.keyboard.press('Escape')
    p.wait_for_timeout(300)
    perguntas = ca(p, 'window.__perguntas || []')
    ok(perguntas and 'Fechar sem lançar' in perguntas[-1] and p.locator('#aaOv').count() == 1, '9. com mudança e empresa marcada: pergunta, e "não" deixa aberta')
    ca(p, 'window.__recusarDialogo = false')
    p.keyboard.press('Escape')
    p.wait_for_timeout(300)
    ok(p.locator('#aaOv').count() == 0 and p.evaluate('document.activeElement.id') == 'btnAdicional', '9. Esc fecha e o foco volta ao botão')
    p.close()

def sem_modelo(b, base, erros):
    print('[claro] sem a venda modelo')
    p = abrir(b, base, 'claro', erros, sem_modelo=True)
    p.click('#btnAdicional')
    p.wait_for_selector('#aaBody table.bo tbody tr[data-pessoa]', timeout=8000)
    ok('lance a primeira à mão' in p.inner_text('#aaBody') and p.locator('#aaLancar').is_disabled() and p.locator('#aaPrimeira').count() == 0, 'sem modelo: o aviso e o lançar travado')
    linha(p, 22).locator('[data-marcar]').uncheck()
    ok(p.locator('#aaLancar').is_disabled(), 'mexer na lista não destrava')
    p.screenshot(path=str(FOTOS / 'claro-adicional-anual.png'))
    p.close()

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            try:
                fluxo(b, base, erros)
                sem_modelo(b, base, erros)
            finally:
                b.close()
    finally:
        srv.shutdown()
    ok(not erros, 'sem erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:3])))
    print(('\n%d falha(s).' % falhas) if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
