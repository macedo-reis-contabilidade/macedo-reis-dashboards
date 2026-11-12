"""
Comparativo tributário (Fiscal, 01/11/2026, pedido do Samuel) — sem login e sem banco (o mock do conferir.py, com os
dados semeados só neste teste; nomes e números inventados). O relógio fica parado em 01/11/2026, meio-dia.

    python tests/harness/comparativo.py

Confere:
  1. a busca acha a empresa pelo nome (o nome com <img onerror> entra como texto);
  2. a empresa com caso na Reforma: o regime de hoje, a receita (receita mensal do caso × 12) e as compras com a origem
     em verde, o crédito de ICMS e as outras despesas em amarelo (padrão); o resultado — o Simples mais barato, o DAS dos
     12 meses de R$ 105.900,00 (Anexo I, 4ª faixa), a conferência com o PGDAS e o prazo pra sair do Simples até
     31/12/2026; o detalhe por tributo; sem a folha, o resultado é "Provisório", a fase 1 já vem concluída e a missão do
     próximo passo é a folha, na fase 2;
  3. mudar um número: a origem vira "digitado", a conta refaz e o estudo grava sozinho (cliente, os números e o resumo);
     abrir a empresa de novo traz o estudo gravado;
  4. outra atividade: entra com o ISS, soma na receita e sai no ✕; trocar o tipo pra serviço do fator r troca o ICMS
     pelo ISS;
  5. a empresa só com o Fator R: a folha e o pró-labore dele, a receita pedindo pra digitar; com a receita, o Simples
     no Anexo III (fator r de 31,6%) e o Presumido dos 12 meses;
  6. simular sem cadastro;
  7. "Por onde começar" em fases e missões, a refeição no RS e as empresas dos mesmos sócios: o restaurante do RS com
     12% e a base a 60% (padrão), a redução de 40% no DAS e o ST lidos do PGDAS do caso; a outra empresa do sócio (pelo
     CPF) com a receita dela e a soma perto do limite — a fase 1 abre com a missão da soma, com o mês em que passa;
     "Conferido" fecha a fase 1 (o aviso, com o alerta do limite, e a carinha comemora) e a tela segue pra fase 2, com a
     folha; "Digitar a folha" põe o cursor nela e a folha digitada cumpre a missão; a fase 4 vista antes da hora diz o que
     falta; sem a outra empresa, a missão vira extra; cumpridas as missões, "Pronto pra apresentar", o aviso final e o
     veredito; o resultado fica "Provisório" enquanto falta o que decide;
  8. o card no Fiscal: "1 estudo";
  9. o assistente do escritório: a faixa "Sobre o estudo aberto", as perguntas prontas do estudo e a pergunta que vai com
     a empresa e o estudo (comparativo_id), depois da gravação que estava marcada (o número mudado já gravado);
 10. o resumo da folha do Domínio solto na tela (o pdf.js e a leitura com IA, dublês): vai pra função extract-document no
     modo fator_r, a folha e o pró-labore dos 12 meses entram com a origem verde e o período, a missão da folha fica
     cumprida, o estudo grava só os totais do mês; o resumo de outra empresa (pelo CNPJ) não entra nem vai pra leitura;
     a leitura que falha deixa os números como estavam;
 11. qual comparativo (11/11/2026, pedido do Samuel): escolhida a empresa, a tela pergunta qual comparativo fazer e só
     depois mostra o estudo (em todos os casos acima a escolha vem primeiro); a empresa do Presumido com pessoa jurídica
     entre os sócios e CNAE secundário impeditivo — o "Presumido × Real" sugerido pelo regime dela, e o que o cadastro
     veda no Simples numa linha só, na opção com o Simples; escolhido, nada do Simples na tela (nem os impedimentos, nem
     o PGDAS, nem o anexo das atividades) e o caminho dele: as fases (a receita e a presunção, o lucro do Real, o resto
     da conta), a tabela sem o Simples, sem as empresas dos sócios nem os prazos do Simples, o lucro da contabilidade pra
     digitar (a missão que decide, com a contabilidade feita até jul/26), a precisão do estudo no resultado e o estudo
     gravado com o comparativo; o lucro digitado cumpre a missão e a conta diz "o da contabilidade"; "Trocar" pra os três
     regimes: o Simples volta como simulação, com o aviso, a lista dos impedimentos (o nome com HTML entra como texto) e
     a missão deles;
 12. o Simples só aparece quando faz parte do estudo (11/11/2026, pedido do Samuel: "se não estou querendo um comparativo
     que envolva o simples, não é de uma empresa do simples, pra que aparecer isso?"): a empresa de serviço do Presumido
     com o Presumido × Real — a atividade é "Serviços" (sem o anexo nem o fator r, na lista e na missão) e a tela não
     fala do Simples; trocado o regime de hoje pra Simples na tela, a nota e o PGDAS voltam; a empresa do Simples que
     compara só o Presumido com o Real vê que o Simples ficou fora; e a do Presumido com o Simples vedado, com o regime
     trocado pra Simples, vê a lista dos impedimentos;
 13. a atividade e a presunção, o sistema apura pelas notas do Domínio (11/11/2026, pedido do Samuel: "não ficou claro o que
     preciso fazer, como temos acesso nas notas fiscais pela ponte da domínio, não ficaria mais fácil para o próprio
     sistema apurar essa informação?"): o estudo gravado antes com a atividade "pelo CNAE do cadastro — confira o anexo"
     abre com a origem de hoje (as notas) e a fase 1 concluída; a receita de serviço posta à mão, que as notas não têm,
     abre a missão com as duas divisões e o "Está certa"; a construtora (a nota não diz se a obra é com todos os
     materiais) tem a missão aberta, que decide, com a regra e o "Ver a presunção", e a presunção digitada a fecha; a
     empresa sem nota no sistema lê por que a tela pergunta e o que fazer;
 15. o lucro da contabilidade pela ponte do Domínio (11/11/2026, a versão 5 da ponte; o pedido do Samuel: "a ponte da
     domínio deveria puxar essa informação até a data que supostamente a contabilidade está feita"): a indústria do
     Presumido abre com o lucro preenchido até o mês do Controle das contabilidades, com a origem, a missão cumprida pela
     ponte e a confirmação de quem cuida ainda aberta; a alíquota zero vem do CST das notas; o mês da DRE trocado no
     seletor leva o número junto, e o mês sem lançamento em conta de resultado não entra; o lucro digitado por cima
     mostra o do Domínio com o "Usar o do Domínio"; o estudo gravado sem lucro ganha o da ponte e grava de novo; o que
     escolheu seguir com a estimativa fica com ela; e o lucro da ponte que ficou velho reabre a missão, com o
     "Atualizar pelo Domínio";
e nenhum erro de JavaScript. No 7, também o aviso do limite no resultado: a conta põe o Simples em 2027, mas o ano de 2026
passa do limite.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

SIM_OBS = json.dumps({ 'v': 1, 'input': { 'anexo': 'I', 'receita': 100000, 'rbt12': 1200000, 'pctComprasMercadorias': 60, 'pctComprasDespesas': 0,
  'mixCheia': 100, 'mixRed60': 0, 'mixRed40': 0, 'mixRed30': 0, 'mixZero': 0 },
  'dominio': { 'pgdas': { 'competencia': '2026-08', 'aliquotaEfetiva': 8.83, 'dasTotal': 8830 } } })
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.clientes = [
      { id: 'c1', nome_principal: 'COMÉRCIO MODELO ME', nome_fantasia: 'MODELO', documento: '00000000000000', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', cidade: 'Três Coroas', uf: 'RS' },
      { id: 'c2', nome_principal: 'EMPRESA EXEMPLO LTDA', nome_fantasia: null, documento: '11111111111111', status: 'ativo', regime_tributario: 'Lucro Presumido', cnae_principal: '6201-5/01', cidade: 'Igrejinha', uf: 'RS' },
      { id: 'c3', nome_principal: 'OUTRA EMPRESA DE TESTE LTDA', nome_fantasia: null, documento: '22222222222222', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', cidade: 'Gramado', uf: 'RS' },
      { id: 'c9', nome_principal: '<img src=x onerror="window.__pego=1">', nome_fantasia: null, documento: '33333333333333', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: null, cidade: null, uf: null },
    ];
    v.carteira_info = (v.carteira_info || []).concat([{ cliente_id: 'c1', saida: null }, { cliente_id: 'c2', saida: null }]);
    v.rt_parametros = [{ chave: 'aliq_ref_2027', valor: { cbs: 11.3 } }];
    v.rt_casos = [{ id: 'rc1', cliente_id: 'c1', anexo: 'I', rbt12: 1200000, receita_mensal: 100000, sim_obs: SIM_OBS_JSON, atualizado_em: '2026-10-01T12:00:00Z' }];
    v.fr_empresas = [{ id: 'fe2', cliente_id: 'c2', nome: 'EMPRESA EXEMPLO LTDA', ativo: true }];
    v.fr_lancamentos = Array.from({ length: 12 }, (_, i) => ({ id: 'fl' + i, empresa_id: 'fe2', competencia: (i < 2 ? '2025-' + (11 + i) : '2026-' + String(i - 1).padStart(2, '0')) + '-01', folha_salarios: 10000, folha_outros: 0, prolabore: 5000 }));
    const mesesDe = (ate, ini, fim) => { const out = []; for (let i = 0; i < 12; i++) { const d = new Date(2025, 7 + i, 1); const c = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); out.push({ competencia: c, total: c >= '2026-01' ? fim : ini, saidas: c >= '2026-01' ? fim : ini, servicos: 0, outros: 0 }); } return out; };
    v.clientes.push(
      { id: 'c5', nome_principal: 'RESTAURANTE EXEMPLO LTDA', nome_fantasia: null, documento: '44444444444444', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '5620-1/04', cidade: 'Três Coroas', uf: 'RS' },
      { id: 'c6', nome_principal: 'PADARIA IRMA LTDA', nome_fantasia: null, documento: '55555555555555', status: 'ativo', regime_tributario: 'Simples Nacional', cnae_principal: '1091-1/02', cidade: 'Igrejinha', uf: 'RS' });
    v.socios = [{ id: 's1', cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '11122233344' }, { id: 's2', cliente_id: 'c5', nome: 'BELTRANA DE TAL', cpf: '55566677788' },
                { id: 's3', cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344' }];
    v.rt_casos.push(
      { id: 'rc5', cliente_id: 'c5', anexo: 'I', rbt12: 2405000, receita_mensal: 200416.67, atualizado_em: '2026-10-01T12:00:00Z', sim_obs: JSON.stringify({ v: 1,
        input: { anexo: 'I', receita: 200416.67, pctComprasMercadorias: 45, mixCheia: 8, mixRed40: 92, mixRed60: 0, mixRed30: 0, mixZero: 0, pctReceitaMonofasica: 8 },
        fontes: { mixCheia: 'seções do PGDAS 07/2026: revenda com ST (bebidas) — alíquota cheia por fora', pctExcluidoST: 'do Domínio: PGDAS 2026-07: 14% a menos (receita com ST/monofásico e redução de 40% na base do ICMS)' },
        dominio: { meses: mesesDe('2026-07', 180000, 215000), pgdas: { competencia: '2026-07', aliquotaEfetiva: 9.05, dasTotal: 19457.5 } } }) },
      { id: 'rc6', cliente_id: 'c6', anexo: 'II', rbt12: 2165000, receita_mensal: 180416.67, atualizado_em: '2026-10-01T12:00:00Z', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'II' },
        dominio: { meses: mesesDe('2026-07', 160000, 195000) } }) });
    v.clientes.push({ id: 'c7', nome_principal: 'INDUSTRIA DE TESTE LTDA', nome_fantasia: null, documento: '77777777777777', status: 'ativo', regime_tributario: 'Lucro Presumido',
      cnae_principal: '1091-1/02 - Fabricação de produtos de padaria e confeitaria com predominância de produção própria', cidade: 'Igrejinha', uf: 'RS', natureza_juridica: '2062',
      cnaes_secundarios: ['4637-1/04 - Comércio atacadista de pães, bolos, biscoitos e similares', '7820-5/00 - Locação de mão-de-obra temporária'] });
    v.carteira_info.push({ cliente_id: 'c7', saida: null });
    v.socios.push({ id: 's7', cliente_id: 'c7', nome: 'SOCIA DE TESTE', cpf: '99988877766', participacao_percentual: 50 },
      { id: 's8', cliente_id: 'c7', nome: 'HOLDING <b>TESTE</b> LTDA', cpf: '12.345.678/0001-99', participacao_percentual: 50 });
    v.dominio_mensal = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); const c = d.toISOString().slice(0, 7);
      return { codigo: 700, cliente_id: 'c7', competencia: c, receita_bruta: 50000, receita_mercadorias: 50000, receita_servicos: 0, receita_simples: null, compras: 30000, servicos_tomados: 2000, ativo_e_consumo: 0,
        salarios: 0, decimo_terceiro: 0, pro_labore_valor: 1621 }; });
    v.contabil_empresas = [{ cliente_id: 'c7', faz: true, inicio: '2025-01', fim: null, responsavel: 'Adaini' }];
    // o andamento da contabilidade no Domínio (a versão 3 da ponte): de maio a julho de 2026, uma conta transitória com saldo
    v.dominio_mensal.forEach(l => Object.assign(l, { notas_saida: 10, notas_entrada: 5, lanc_fiscal: 15, lanc_folha: 1, folha_lancada: 1621, receita_lancada: 50000, caixa_negativo: 0,
      transitorias: l.competencia >= '2026-05' ? 1 : 0, transitorias_valor: l.competencia >= '2026-05' ? 9000 : 0 }));
    v.dominio_andamento = [{ codigo: 700, cliente_id: 'c7', banco_contas: 2, banco_ate: '2026-06-11', banco_ultimo: '2026-07-31' }];
    v.contabil_meses = Array.from({ length: 19 }, (_, i) => { const d = new Date(Date.UTC(2025, i, 1)); return { cliente_id: 'c7', competencia: d.toISOString().slice(0, 7), situacao: 'feita', feita_em: '2026-08-10' }; });
    v.comparativos = [{ id: 'est3', cliente_id: 'c3', nome: null, entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 500000 }] }, origens: {} }, resultado: null, atualizado_em: '2026-10-30T12:00:00Z', atualizado_por: 'fiscal@macedoereis.com.br' }];
    // o cenário 13 (a presunção pelas notas do Domínio): a construtora do Presumido, só com nota de serviço; a loja do Presumido
    // com o estudo gravado antes (a atividade "pelo CNAE do cadastro — confira o anexo"); e a loja sem nota nenhuma no sistema
    v.clientes.push(
      { id: 'c10', nome_principal: 'CONSTRUTORA FICTICIA LTDA', nome_fantasia: null, documento: '10101010101010', status: 'ativo', regime_tributario: 'Lucro Presumido', cnae_principal: '4120-4/00 - Construção de edifícios', cidade: 'Igrejinha', uf: 'RS' },
      { id: 'c11', nome_principal: 'MOVEIS FICTICIOS LTDA', nome_fantasia: null, documento: '12121212121212', status: 'ativo', regime_tributario: 'Lucro Presumido', cnae_principal: '4754-7/01 - Comércio varejista de móveis', cidade: 'Igrejinha', uf: 'RS' },
      { id: 'c12', nome_principal: 'LOJA FICTICIA LTDA', nome_fantasia: null, documento: '13131313131313', status: 'ativo', regime_tributario: 'Lucro Presumido', cnae_principal: '4754-7/01 - Comércio varejista de móveis', cidade: 'Igrejinha', uf: 'RS' });
    const ponteDe = (id, codigo, merc, serv) => Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1));
      return { codigo, cliente_id: id, competencia: d.toISOString().slice(0, 7), receita_bruta: merc + serv, receita_mercadorias: merc, receita_servicos: serv, receita_simples: null, compras: 20000, servicos_tomados: 0, ativo_e_consumo: 0,
        salarios: 0, decimo_terceiro: 0, pro_labore_valor: 0 }; });
    v.dominio_mensal.push(...ponteDe('c10', 1000, 0, 80000), ...ponteDe('c11', 1100, 70000, 0));
    // o cenário 15 (a versão 5 da ponte do Domínio): o resultado da contabilidade mês a mês (R$ 3.000) e a venda pelo CST do
    // PIS/Cofins (60% com alíquota zero) na indústria c7 — só com a marca window.__ponteV5 ({ linhas: o que muda num mês,
    // estudo: o estudo já gravado })
    if (window.__ponteV5) {
      const o = window.__ponteV5 === true ? {} : window.__ponteV5;
      v.dominio_mensal.filter(l => l.cliente_id === 'c7').forEach(l => Object.assign(l, { resultado_antes_ir: 3000, irpj_csll_lancados: 500, receitas_financeiras: 0, lanc_resultado: 12,
        pc_tributada: 20000, pc_monofasica: 0, pc_st: 0, pc_aliquota_zero: 30000, pc_isenta: 0, pc_sem_incidencia: 0, pc_suspensa: 0, pc_outras: 0, pc_sem_cst: 0 }, (o.linhas || {})[l.competencia] || {}));
      if (o.estudo) v.comparativos.push({ id: 'est7', cliente_id: 'c7', nome: null, resultado: null, atualizado_em: '2026-10-31T12:00:00Z', atualizado_por: 'financeiro@macedoereis.com.br',
        entrada: { v: 1, entrada: { objetivo: 'presumido_real', regimeAtual: 'presumido', atividades: [{ tipo: 'industria', receita: 600000 }], compras: 360000, grupo: [], ...(o.estudo.entrada || {}) }, origens: o.estudo.origens || {} } });
    }
    // (o estudo antigo só entra no cenário 13, que marca window.__estudoAntigo: os outros contam os estudos gravados)
    if (window.__estudoAntigo) v.comparativos.push({ id: 'est11', cliente_id: 'c11', nome: null, resultado: null, atualizado_em: '2026-11-11T21:21:00Z', atualizado_por: 'financeiro@macedoereis.com.br',
      entrada: { v: 1, entrada: { objetivo: 'presumido_real', regimeAtual: 'presumido', atividades: [{ tipo: 'comercio', receita: 840000 }], compras: 240000, grupo: [] },
        origens: { 'atividades.0.receita': { fonte: 'ponte', texto: 'Domínio, pela ponte: o faturamento de out/25 a set/26' }, 'atividades.0.tipo': { fonte: 'cadastro', texto: 'pelo CNAE do cadastro (4754-7/01 - Comércio varejista de móveis) — confira o anexo' },
          compras: { fonte: 'ponte', texto: 'Domínio, pela ponte: compras' }, folha: { fonte: 'ponte', texto: 'Domínio, pela ponte: sem empregados na folha' }, proLabore: { fonte: 'ponte', texto: 'Domínio, pela ponte: sem pró-labore na folha' } } } });
  } });
})();
""".replace('SIM_OBS_JSON', json.dumps(SIM_OBS))
DO_SIMPLES = r"""
() => {
  // (o módulo Fator R, de onde a folha pode ter vindo, é a origem do número — não o fator r do Simples)
  const acha = t => { const x = t.replace(/fornecedor do Simples/g, '').replace(/\bFator R\b/g, ''); return /simples|fator r\b|sublimite/i.test(x) || /\bDAS\b|PGDAS|Anexo (I|II|III|IV|V)\b|[Aa]nexo do\b|confira o anexo/.test(x); };
  const visivel = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.hidden) return false; const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  // o crédito das compras de fornecedor do Simples é assunto de qualquer regime (fala do fornecedor, não da empresa)
  const doFornecedor = el => !!el.closest('[data-orig="aliqCreditoIcms"], [data-orig="pctComprasSimples"]');
  const out = [];
  const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!el || /^(SCRIPT|STYLE)$/.test(el.tagName)) continue;
    if (el.closest('#regimeAtual') || doFornecedor(el)) continue;   // a lista do regime de hoje e os campos do fornecedor
    const txt = t.nodeValue.replace(/\s+/g, ' ').trim();
    if (txt && acha(txt) && visivel(el)) out.push(txt.slice(0, 120));
  }
  for (const el of document.querySelectorAll('main [title], main [placeholder], main [aria-label]')) {
    const txt = [el.getAttribute('title'), el.getAttribute('placeholder'), el.getAttribute('aria-label')].filter(Boolean).join(' · ');
    if (txt && acha(txt) && visivel(el) && !doFornecedor(el)) out.push('[dica] ' + txt.slice(0, 120));
  }
  return out;
}
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def celula(p, regime, coluna):
    # a célula do regime (linha) e do ano (coluna 1 = os 12 meses)
    v = p.evaluate("""([reg, col]) => { const tr = [...document.querySelectorAll('#resultado table.ct:not(.ct-mini) tr')].find(t => t.cells[0] && t.cells[0].textContent.startsWith(reg)); return tr ? tr.cells[col].innerText : null; }""", [regime, coluna])
    return v.replace('\xa0', ' ') if v else v

def texto(p, sel):
    # o "R$" da moeda vem com espaço inquebrável
    return p.inner_text(sel).replace('\xa0', ' ')

def comparativo(p, objetivo):
    # a pergunta "qual comparativo": aberta (a empresa sem estudo gravado), a escolha; já escolhido, nada a fazer
    p.wait_for_selector('#pergunta:not([hidden])', timeout=5000)
    if objetivo and p.locator('#pergunta .ct-opcao').count():
        p.click(f'#pergunta .ct-opcao[data-objetivo="{objetivo}"]')
        p.wait_for_selector('#trocarObjetivo', timeout=3000)

def escolher(p, texto, nome, objetivo=None):
    p.fill('#busca', '')
    p.type('#busca', texto)
    p.wait_for_selector('#sugestoes button', timeout=3000)
    p.locator('#sugestoes button', has_text=nome).first.click()
    p.wait_for_function("n => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === n", arg=nome, timeout=5000)
    comparativo(p, objetivo)

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1440, 'height': 900})
        cx.route('**/cdnjs.cloudflare.com/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        p.clock.set_fixed_time('2026-11-01T12:00:00')

        print('1. A busca')
        p.goto(base + 'fiscal-comparativo.html')
        p.wait_for_selector('#busca', timeout=8000)
        p.type('#busca', 'img src')
        p.wait_for_selector('#sugestoes button', timeout=3000)
        ok('<img src=x' in p.inner_text('#sugestoes') and p.evaluate('() => window.__pego') is None, 'o nome com <img onerror> aparece como texto')
        escolher(p, 'modelo', 'COMÉRCIO MODELO ME')
        ops = p.eval_on_selector_all('#pergunta .ct-opcao', 'bs => bs.map(b => [b.dataset.objetivo, !!b.querySelector(".ct-sugerido")])')
        ok('Qual comparativo você quer fazer?' in p.inner_text('#pergunta') and ops == [['presumido_real', False], ['todos', True]],
           f'escolhida a empresa, a tela pergunta qual comparativo; pra a do Simples, o sugerido são os três regimes ({ops})')
        ok(p.is_hidden('#grade') and p.is_hidden('#roteiro') and p.is_hidden('#caixaRelatorios') and 'nada veda o Simples' in p.inner_text('#pergunta'),
           'antes da escolha, sem o roteiro, os números e o resultado; pelo cadastro, nada veda o Simples')
        comparativo(p, 'todos')
        ok(p.inner_text('#objetivoAtual') == 'Simples × Presumido × Real' and not p.is_hidden('#grade') and not p.is_hidden('#caixaRelatorios'), 'escolhido, o comparativo fica dito, com o "Trocar", e o estudo aparece')

        print('2. O que o sistema sabe e o resultado')
        p.wait_for_selector('#resultado table.ct', timeout=5000)
        ok(p.input_value('#regimeAtual') == 'simples', 'o regime de hoje vem do cadastro')
        ok('caso da Reforma' in p.inner_text('#escolhida') and 'sem folha no Fator R' in p.inner_text('#escolhida'), 'as fontes: o caso da Reforma e sem folha no Fator R')
        ok(p.input_value('#f_atividades_0_receita') == '1.200.000,00', f'a receita: a mensal do caso × 12 ({p.input_value("#f_atividades_0_receita")})')
        t = p.get_attribute('.ct-orig[data-orig="atividades.0.receita"]', 'data-fonte')
        ok(t == 'reforma', f'a origem da receita em verde (caso da Reforma) ({t})')
        ok(p.input_value('#f_compras') == '720.000,00', 'as compras: 60% da receita, do caso')
        ok(p.get_attribute('.ct-orig[data-orig="aliqCreditoIcms"]', 'data-fonte') == 'padrao' and p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'padrao',
           'o crédito de ICMS e as outras despesas ficam no padrão (amarelo)')
        frase = p.evaluate("() => { const f = document.querySelector('.ct-frase').cloneNode(true); f.querySelectorAll('.ct-prov-tag, .ct-pronto-tag').forEach(x => x.remove()); return f.textContent; }")
        ok(frase.startswith('Em 2027, o Simples Nacional sai mais barato') and 'É o regime de hoje' in frase, f'a frase da decisão ({frase[:90]}…)')
        ok(p.locator('.ct-frase .ct-prov-tag').count() == 1 and 'a folha e o pró-labore' in p.inner_text('#resultado'), 'sem a folha, o resultado é "Provisório" e diz o que falta')
        pr = texto(p, '#precisao')
        ok('Precisão do estudo: falta o que pode virar o resultado' in pr and p.get_attribute('#precisao li[data-id="folha"]', 'data-peso') == 'decide' and 'decide o resultado' in p.inner_text('#precisao li[data-id="folha"]')
           and 'Já está na conta: a receita dos 12 meses (veio do caso da Reforma)' in pr,
           'a precisão do estudo: o que falta (a folha decide, com o efeito) e o que já está na conta, com a origem (' + pr.replace('\n', ' | ')[:400] + ')')
        p.click('#trilha button[data-fase="0"]')
        mv = texto(p, '#fase .ct-m[data-id="vedacoes"]')
        ok(p.get_attribute('#fase .ct-m[data-id="vedacoes"]', 'data-estado') == 'aberta' and 'Pelo cadastro, nada veda o Simples: o CNAE principal (sem secundário no cadastro).' in mv
           and 'Faltou no cadastro pra conferir: os sócios e a natureza jurídica.' in mv and 'O sistema não confere: sócio domiciliado no exterior' in mv and 'Extras' in p.inner_text('#fase'),
           f'na fase 1, a missão dos impedimentos do Simples (extra): o que o cadastro deixou conferir, o que faltou e o que o sistema não confere ({mv[:100]}…)')
        p.click('#trilha button[data-fase="1"]')
        ok(not p.is_hidden('#roteiro') and p.locator('#trilha li').count() == 4 and p.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita',
           'por onde começar: as 4 fases, a 1ª já concluída (a receita veio do caso)')
        ok('Os números da empresa' in p.inner_text('#trilha li[aria-current="step"]'), 'a fase de agora é a 2, os números da empresa')
        ok('A folha e o pró-labore' in p.inner_text('#fase .ct-m.ct-prox') and 'próximo passo' in p.inner_text('#fase .ct-m.ct-prox'), 'a missão do próximo passo: a folha')
        ok(p.get_attribute('#fase .ct-m[data-id="compras"]', 'data-estado') == 'feita' and 'veio do caso da Reforma' in p.inner_text('#fase .ct-m[data-id="compras"]'),
           'a missão das compras, cumprida pelo caso da Reforma')
        ok('Missões:' in p.inner_text('#placar') and 'Provisório' in p.inner_text('#placar'), 'o placar: as missões cumpridas e o estudo provisório')
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 105.900,00'), f'o DAS dos 12 meses: Anexo I, 4ª faixa ({celula(p, "Simples Nacional", 1)!r})')
        ok('mais barato' in celula(p, 'Simples Nacional', 2) and '(hoje)' in p.inner_text('#resultado table.ct'), 'o mais barato de 2027 marcado e o regime de hoje')
        ok('no PGDAS de ago/26 a alíquota efetiva foi 8,83%' in p.inner_text('#resultado'), 'a conferência com o PGDAS do caso')
        ok('até 31/12/2026' in p.inner_text('#resultado') and 'Res. CGSN 190' in p.inner_text('#resultado'), 'o prazo pra sair do Simples em 2027')
        p.click('details.ct-det > summary')
        ok('ICMS' in p.inner_text('details.ct-det') and 'Lucro antes do IR' in p.inner_text('details.ct-det'), 'o detalhe por tributo, com o lucro do Real')
        ok('crédito de ICMS das compras' in p.inner_text('#resultado'), 'o crédito de ICMS (padrão) é testado em "O que muda o resultado"')

        print('3. Mudar um número e gravar')
        antes = celula(p, 'Lucro Real', 2)
        p.fill('#f_outrasDespesas', '300000')
        p.wait_for_function("a => { const tr = [...document.querySelectorAll('#resultado table.ct:not(.ct-mini) tr')].find(t => t.cells[0] && t.cells[0].textContent.startsWith('Lucro Real')); return tr && tr.cells[2].innerText.replace(/\u00a0/g, ' ') !== a; }", arg=antes, timeout=3000)
        ok(p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'digitado', 'a origem vira "digitado"')
        ok(celula(p, 'Lucro Real', 2) != antes, 'o Real muda com as outras despesas')
        p.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c1')", timeout=5000)
        linha = p.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.comparativos.find(r => r.cliente_id === 'c1')))")
        ok(linha['entrada']['entrada']['outrasDespesas'] == 300000 and linha['resultado']['melhor'] and linha['atualizado_por'], f'o estudo gravou os números e o resumo ({linha["resultado"]["melhor"]})')
        p.wait_for_function("() => /Gravado às/.test(document.getElementById('gravado').textContent)", timeout=3000)
        ok(True, 'o aviso "Gravado às"')
        ok(linha['entrada']['entrada'].get('objetivo') == 'todos' and linha['resultado'].get('regimes') == ['simples', 'presumido', 'real'], 'o comparativo escolhido fica gravado com o estudo')
        escolher(p, 'exemplo', 'EMPRESA EXEMPLO LTDA')
        escolher(p, 'modelo', 'COMÉRCIO MODELO ME')
        p.wait_for_selector('#f_outrasDespesas', timeout=3000)
        ok(p.locator('#pergunta .ct-opcao').count() == 0 and p.inner_text('#objetivoAtual') == 'Simples × Presumido × Real', 'com o estudo gravado, a tela não pergunta de novo')
        ok(p.input_value('#f_outrasDespesas') == '300.000,00' and 'Estudo gravado em' in p.inner_text('#gravado'), 'abrir de novo traz o estudo gravado')
        ok(p.get_attribute('.ct-orig[data-orig="outrasDespesas"]', 'data-fonte') == 'digitado', 'com a origem de cada número')

        print('4. Atividades')
        p.click('button[data-acao="mais"]')
        p.wait_for_selector('#f_atividades_1_receita', timeout=2000)
        ok(p.locator('#f_atividades_1_aliqIss').count() == 1, 'a atividade nova é serviço, com o ISS')
        p.fill('#f_atividades_1_receita', '100000')
        ok('R$ 1.300.000,00' in texto(p, '#totalRec'), 'a receita soma as duas')
        p.click('.ct-ativ[data-i="1"] button[data-acao="tirar"]')
        ok(p.locator('.ct-ativ').count() == 1 and 'R$ 1.200.000,00' in texto(p, '#totalRec'), 'o ✕ tira a atividade')
        p.select_option('#f_atividades_0_tipo', 'servico_r')
        p.wait_for_selector('#f_atividades_0_aliqIss', timeout=2000)
        ok(p.locator('#f_atividades_0_aliqIcms').count() == 0, 'serviço do fator r: o ISS no lugar do ICMS')
        p.select_option('#f_atividades_0_tipo', 'comercio')

        print('5. Só com o Fator R')
        escolher(p, 'exemplo', 'EMPRESA EXEMPLO LTDA')
        sug = p.inner_text('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        ok('sugerido' in sug and 'A empresa está no Lucro Presumido' in sug, f'pra empresa do Presumido, o sugerido é o Presumido × Real ({sug[:80]!r})')
        comparativo(p, 'todos')
        p.wait_for_selector('#f_folha', timeout=3000)
        ok('Ela pode entrar no Simples?' in p.inner_text('#trilha'), 'a empresa do regime geral com os três regimes: a fase 1 pergunta se ela pode entrar no Simples')
        ok(p.input_value('#f_folha') == '120.000,00' and p.input_value('#f_proLabore') == '60.000,00', 'a folha e o pró-labore do Fator R (12 meses)')
        ok(p.get_attribute('.ct-orig[data-orig="folha"]', 'data-fonte') == 'fator_r', 'a origem da folha: Fator R')
        ok('Informe a receita' in p.inner_text('#resultado'), 'sem receita, a tela pede a receita')
        p.fill('#f_atividades_0_receita', '600000')
        p.wait_for_selector('#resultado table.ct', timeout=3000)
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 63.360,00'), f'Simples: fator r de 31,6%, Anexo III, 3ª faixa ({celula(p, "Simples Nacional", 1)!r})')
        ok(celula(p, 'Lucro Presumido', 1).startswith('R$ 131.340,00'), f'Presumido dos 12 meses ({celula(p, "Lucro Presumido", 1)!r})')
        ok('A janela de 2027 fechou em 30/09/2026' in p.inner_text('#resultado'), 'quem está no Presumido: a janela do Simples de 2027 fechou')
        p.click('details.ct-det > summary')
        ok('31,6%' in p.inner_text('details.ct-det'), 'o fator r no detalhe')

        print('6. Sem cadastro')
        p.evaluate("() => { window.prompt = () => 'PROSPECT TESTE'; }")
        p.click('#semCadastro')
        p.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'PROSPECT TESTE'", timeout=3000)
        ok('sem cadastro no sistema' in p.inner_text('#escolhida') and p.input_value('#regimeAtual') == '', 'a empresa sem cadastro, sem regime de hoje')
        ok('o sistema não confere os impedimentos do Simples' in p.inner_text('#pergunta'), 'sem cadastro, a pergunta diz que os impedimentos do Simples não são conferidos')
        comparativo(p, 'todos')
        p.fill('#f_atividades_0_receita', '1200000')
        p.wait_for_selector('#resultado table.ct', timeout=3000)
        ok(celula(p, 'Simples Nacional', 1).startswith('R$ 105.900,00'), 'a conta roda sem cadastro')

        print('7. Por onde começar: a refeição no RS e as empresas dos mesmos sócios')
        escolher(p, 'restaurante', 'RESTAURANTE EXEMPLO LTDA', 'todos')
        p.wait_for_selector('#grupoSocios', timeout=5000)
        val = lambda sel: p.input_value(sel)
        fonte = lambda campo: p.get_attribute('.ct-orig[data-orig="' + campo + '"]', 'data-fonte')
        ok(val('#f_atividades_0_aliqIcms') == '12' and fonte('atividades.0.aliqIcms') == 'padrao', f'refeição no RS: 12%, padrão a conferir ({val("#f_atividades_0_aliqIcms")!r})')
        ok(val('#f_atividades_0_redIcms') == '40' and fonte('atividades.0.redIcms') == 'padrao', 'a base a 60% no regime geral (padrão)')
        ok(val('#f_atividades_0_redIcmsSimples') == '40' and fonte('atividades.0.redIcmsSimples') == 'reforma', 'a redução de 40% no DAS, lida do PGDAS do caso (verde)')
        ok(val('#f_atividades_0_pctST') == '8' and fonte('atividades.0.pctST') == 'reforma', 'a revenda com ST (as bebidas), lida do PGDAS do caso')
        g = p.inner_text('#grupoSocios')
        ok('PADARIA IRMA LTDA' in g and 'sócio em comum: FULANO DE TAL' in g, 'a outra empresa do sócio, achada pelo CPF')
        ok(val('#f_grupo_0_receita') == '2.165.000,00' and fonte('grupo.0.receita') == 'reforma', f'a receita dela, do caso da Reforma ({val("#f_grupo_0_receita")!r})')
        ok('R$ 4.570.000,00' in texto(p, '#grupoSocios') and 'passa do limite em dezembro' in g, 'a soma dos 12 meses e o mês em que o ano passa do limite')
        al = texto(p, '#alertaLimite') if p.locator('#alertaLimite').count() else ''
        ok('passa do limite de R$ 4,8 milhões em dezembro' in al and '01/01/2027' in al and 'a escolha é entre o Presumido e o Real' in al,
           f'no resultado, o aviso: a conta põe o Simples em 2027, mas o ano de 2026 passa do limite ({al[:90]}…)')
        prz = texto(p, '.ct-prazos')
        ok('Comunicar a exclusão do Simples' in prz and 'até 29/01/2027' in prz and 'com efeito em 01/01/2027' in prz,
           f'nos prazos, a exclusão obrigatória: comunicar até o último dia útil de janeiro ({prz[:120]}…)')
        p.evaluate("() => { window.__festa = []; window.addEventListener('mr:comemorar', e => window.__festa.push(e.detail)); }")
        ok('Ela pode ficar no Simples?' in p.inner_text('#trilha li[aria-current="step"]'), 'a fase de agora é a 1: pode ficar no Simples?')
        fts = texto(p, '#fase .ct-usar')
        ok('O que usar nesta fase' in fts and 'Relatório de Faturamento' in fts and 'até jul/26 — faltam ago/26 e set/26' in fts
           and p.get_attribute('#fase .ct-usar-item[data-id="receita"]', 'data-estado') == 'antigo',
           'fase 1, o que usar: o faturamento do Domínio, até jul/26, com os meses que faltam até o último fechado')
        ok('2 sócios no cadastro' in fts and 'as 2 empresas somadas até jul/26' in fts and 'Automático: a ponte da Receita traz o PGDAS' in fts,
           'os sócios, as empresas somadas e o que chega sozinho pela ponte da Receita')
        ok(p.locator('#fase .ct-usar > .ct-m-acoes [data-relatorio]').count() == 1 and p.locator('#fase .ct-usar-item[data-id="socios"] a').count() == 0,
           'com a receita a atualizar, o "Soltar os relatórios do Domínio" embaixo; os sócios, que já estão, sem o link da ficha')
        p.click('#fase .ct-usar > .ct-m-acoes [data-relatorio]')
        ok('ct-chama' in (p.get_attribute('#drop', 'class') or ''), 'o "Soltar os relatórios" acende a caixa dos relatórios')
        prox = texto(p, '#fase .ct-m.ct-prox')
        ok('A receita somada com as empresas dos sócios' in prox and 'R$ 4.570.000' in prox and 'em dezembro' in prox and '01/01/2027' in prox,
           'a missão do próximo passo: a soma com a outra empresa e a saída em 01/01/2027')
        ok('Provisório' in p.inner_text('#placar'), 'o estudo é provisório')
        p.click('#fase .ct-m.ct-prox [data-conferir]')
        p.wait_for_function("() => !document.getElementById('banner').hidden", timeout=3000)
        ban = texto(p, '#banner')
        ok('Fase 1 concluída' in ban and 'passa do limite em dezembro' in ban and 'ct-alerta' in (p.get_attribute('#banner', 'class') or ''),
           f'"Conferido": a fase 1 fecha, com o aviso do limite ({ban[:80]}…)')
        ok(p.evaluate("() => window.__festa.length") == 1, 'a carinha do assistente comemora (o evento mr:comemorar)')
        ok(p.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita' and 'A folha e o pró-labore' in p.inner_text('#fase .ct-m.ct-prox'),
           'passou de fase: a tela segue pra fase 2 e o próximo passo é a folha')
        ok(p.get_attribute('#fase .ct-usar-item[data-id="folha"]', 'data-estado') == 'falta' and 'Domínio Folha: o resumo da folha' in texto(p, '#fase .ct-usar-item[data-id="folha"]'),
           'fase 2, o que usar: o resumo da folha do Domínio, que falta')
        ok('Automático: a ponte do Domínio traz todo dia' in texto(p, '#fase .ct-usar-item[data-id="folha"]'), 'a folha chega pela ponte do Domínio')
        p.click('#fase .ct-m.ct-prox [data-ir]')
        ok(p.evaluate("() => document.activeElement && document.activeElement.id") == 'f_folha', '"Digitar a folha" põe o cursor na folha')
        p.fill('#f_folha', '480000')
        p.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"folha\"]'); return (m && m.dataset.estado === 'feita') || document.querySelector('#trilha li:nth-child(2)').dataset.estado === 'feita'; }", timeout=3000)
        p.click('#trilha button[data-fase="1"]')
        ok(p.get_attribute('#fase .ct-m[data-id="folha"]', 'data-estado') == 'feita' and 'digitado' in p.inner_text('#fase .ct-m[data-id="folha"]'), 'a folha digitada cumpre a missão (marcada como digitada)')
        p.click('#trilha button[data-fase="3"]')
        ok('Faltam' in p.inner_text('#fase') and p.get_attribute('#trilha button[data-fase="3"]', 'aria-pressed') == 'true', 'a fase 4, vista antes da hora, diz o que falta')
        p.click('#grupoSocios button[data-acao="tirar-grupo"]')
        p.wait_for_function("() => !document.getElementById('grupoSocios')", timeout=3000)
        p.wait_for_timeout(500)   # a conta refaz um instante depois
        p.click('#trilha button[data-fase="0"]')
        p.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"limite\"]'); return m && /As empresas dos sócios/.test(m.textContent); }", timeout=3000)
        lim = p.inner_text('#fase .ct-m[data-id="limite"]')
        ok('ficou fora da soma' in lim and p.get_attribute('#fase .ct-m[data-id="limite"]', 'data-estado') == 'feita',
           'sem a outra empresa: longe do limite, a missão vira extra e diz que a empresa achada ficou fora da soma')
        # jogar até o fim: cumprir as missões abertas (o "está certo") até o estudo ficar pronto
        for _ in range(14):
            if 'Pronto pra apresentar' in p.inner_text('#placar'): break
            feito = p.evaluate("""() => {
              const b = document.querySelector('#fase .ct-m[data-estado="aberta"] [data-conferir]');
              if (b) { b.click(); return 'conferiu'; }
              const atual = document.querySelector('#trilha li[aria-current="step"] button');
              if (atual && atual.getAttribute('aria-pressed') !== 'true') { atual.click(); return 'fase'; }
              return null; }""")
            if not feito: break
            p.wait_for_timeout(350)
        ok('Pronto pra apresentar' in p.inner_text('#placar') and p.locator('.ct-frase .ct-pronto-tag').count() == 1, 'cumpridas as missões, o estudo fica "Pronto pra apresentar"')
        ok('Estudo pronto pra apresentar' in texto(p, '#banner') and p.evaluate("() => window.__festa.some(d => d.recado)"), 'o aviso final, e a carinha dá o recado')
        ok('Ver o resultado' in p.inner_text('#fase') and 'sai mais barato' in p.inner_text('#fase .ct-veredito'), 'o veredito, na fase 4')

        print('8. O card no Fiscal')
        p2 = cx.new_page()
        p2.on('pageerror', lambda e: erros.append('fiscal: ' + str(e)))
        p2.add_init_script(TOUR); p2.add_init_script(SEMEAR)
        p2.goto(base + 'fiscal.html')
        p2.wait_for_function("() => { const b = document.querySelector('.card-status[data-mod=\"fiscal-comparativo.html\"]'); return b && !b.classList.contains('st-load'); }", timeout=5000)
        selo = p2.text_content('.card-status[data-mod="fiscal-comparativo.html"]')
        ok(selo == '1 estudo', f'o card: "1 estudo" ({selo!r})')

        print('9. O assistente do escritório: "esta empresa" é a do estudo aberto')
        p3 = cx.new_page()
        p3.on('pageerror', lambda e: erros.append('assistente: ' + str(e)))
        p3.add_init_script(TOUR); p3.add_init_script(SEMEAR)
        # a função do assistente de mentira: guarda o corpo e o estudo gravado na hora da pergunta
        p3.add_init_script("""(() => { window.__chamadas = []; window.__mockInvoke = async (nome, opts) => {
          const est = (window.__mockDb.comparativos || []).find(r => r.cliente_id === 'c5');
          window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})), folhaGravada: est ? est.entrada.entrada.folha : null });
          const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
          return { data: ev({ tipo: 'resposta', texto: 'Resposta pra: ' + opts.body.pergunta }), error: null }; }; })()""")
        p3.goto(base + 'fiscal-comparativo.html?cliente=c5')
        p3.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'RESTAURANTE EXEMPLO LTDA'", timeout=8000)
        comparativo(p3, 'todos')
        p3.wait_for_selector('.as-lancador', timeout=5000)
        p3.click('.as-lancador'); p3.wait_for_selector('.as-painel:not([hidden])', timeout=3000)
        ok(p3.inner_text('.as-ctx') == 'Sobre o estudo aberto: RESTAURANTE EXEMPLO LTDA', f'a faixa do assistente diz qual estudo ({p3.inner_text(".as-ctx")!r})')
        chips = p3.eval_on_selector_all('.as-msgs .as-chip', 'bs => bs.map(b => b.textContent)')
        ok('E se a folha for R$ 30 mil por mês?' in chips, f'as perguntas prontas do estudo ({chips})')
        # muda um número e pergunta logo: a gravação marcada vai antes, e a pergunta leva o estudo gravado
        p3.fill('#f_folha', '240000')
        p3.fill('.as-entrada textarea', 'Por que este regime sai mais barato?'); p3.press('.as-entrada textarea', 'Enter')
        p3.wait_for_function("() => (window.__chamadas || []).length === 1", timeout=5000)
        ch = p3.evaluate('window.__chamadas[0]')
        est = p3.evaluate("() => (window.__mockDb.comparativos.find(r => r.cliente_id === 'c5') || {}).id")
        ctx = ch['body']['contexto']
        ok(ch['nome'] == 'assistente' and ctx.get('cliente_id') == 'c5' and est and ctx.get('comparativo_id') == est and ctx['pagina']['caminho'] == 'fiscal-comparativo.html',
           f'a pergunta vai com a empresa e o estudo ({ctx})')
        ok(ch['folhaGravada'] == 240000, f'o número mudado já estava gravado quando a pergunta saiu ({ch["folhaGravada"]!r})')

        print('10. O resumo da folha do Domínio solto na tela')
        p4 = cx.new_page()
        p4.on('pageerror', lambda e: erros.append('folha: ' + str(e)))
        p4.add_init_script(TOUR); p4.add_init_script(SEMEAR)
        # o pdf.js de mentira (as linhas de window.__pdfLinhas) e a leitura com IA de mentira: 14 meses inventados, com o 13º
        # em dezembro; guarda as chamadas
        p4.add_init_script(r'''(() => {
          window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({
            items: (window.__pdfLinhas || []).map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 20, 800 - i * 14], width: s.length * 4 })) }) }) }) }) };
          window.__leituras = [];
          window.__mockInvoke = async (nome, opts) => {
            window.__leituras.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
            if (window.__leituraFalha) return { data: null, error: { message: 'Edge Function returned a non-2xx status code' } };
            const meses = [];
            for (let i = 0; i < 14; i++) { const d = new Date(Date.UTC(2025, 7 + i, 1)); const c = d.toISOString().slice(0, 7);
              meses.push({ competencia: c, folha_salarios: 10000, prolabore: 5000, inss_patronal: null, fgts: 800, folha_outros: c.endsWith('-12') ? 10000 : null }); }
            return { data: { data: { tipo: 'folha', empresa: 'COMÉRCIO MODELO ME', meses, meses_caixa: null, confianca: 'alta', avisos: ['folha pelo resumo por competência'] }, modo: 'fator_r' }, error: null };
          };
        })()''')
        p4.goto(base + 'fiscal-comparativo.html?cliente=c1')
        p4.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'COMÉRCIO MODELO ME'", timeout=8000)
        comparativo(p4, 'todos')
        p4.wait_for_selector('#resultado table.ct', timeout=5000)
        mf = '#fase .ct-m[data-id="folha"]'
        ok(p4.get_attribute(mf, 'data-estado') == 'aberta' and p4.locator(mf + ' [data-relatorio]').inner_text() == 'Soltar o resumo da folha',
           'a missão da folha, aberta, com o "Soltar o resumo da folha"')
        folha_pdf = ['COMÉRCIO MODELO ME  Página: 0001', 'CNPJ: 00.000.000/0000-00  Competência: 09/2026', 'RESUMO DA FOLHA', 'Código  Descrição  Proventos  Descontos',
                     '001  Salário  10.000,00', '005  Pró-Labore  5.000,00', '210  INSS  1.100,00', 'Base FGTS  10.000,00  FGTS  800,00', 'Total de Proventos  15.000,00  Líquido  13.600,00']
        p4.evaluate('l => { window.__pdfLinhas = l; }', folha_pdf)
        p4.set_input_files('#arquivos', files=[{ 'name': 'resumo-folha.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 resumo inventado' }])
        p4.wait_for_function("() => [...document.querySelectorAll('#lidos .ct-chip')].some(c => /resumo da folha · 12 meses/.test(c.textContent))", timeout=8000)
        lei = p4.evaluate('window.__leituras')
        doc = lei[0]['body']['documents'][0] if lei and lei[0]['body'].get('documents') else {}
        import base64 as _b64
        ok(len(lei) == 1 and lei[0]['nome'] == 'extract-document' and lei[0]['body']['modo'] == 'fator_r' and doc.get('media_type') == 'application/pdf'
           and doc.get('filename') == 'resumo-folha.pdf' and _b64.b64decode(doc.get('data', '')) == b'%PDF-1.4 resumo inventado',
           'o resumo vai pra leitura do Fator R (extract-document, modo fator_r), com o PDF')
        chip = p4.locator('#lidos .ct-chip', has_text='resumo da folha').first
        ok('(out/25 a set/26)' in chip.inner_text() and 'folha pelo resumo por competência' in (chip.get_attribute('title') or ''),
           f'o chip diz os meses usados e a leitura vai no título ({chip.inner_text()!r})')
        p4.wait_for_function("() => document.getElementById('f_folha').value === '130.000,00'", timeout=3000)
        ok(p4.input_value('#f_folha') == '130.000,00' and p4.input_value('#f_proLabore') == '60.000,00',
           f'a folha (salários + o 13º) e o pró-labore dos 12 meses ({p4.input_value("#f_folha")} e {p4.input_value("#f_proLabore")})')
        o_f = p4.locator('.ct-orig[data-orig="folha"]')
        ok(o_f.get_attribute('data-fonte') == 'dominio' and 'resumo da folha do Domínio de out/25 a set/26' in (o_f.inner_text() + ' ' + (o_f.get_attribute('title') or '')),
           'a origem da folha em verde: o resumo da folha do Domínio, com o período')
        p4.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"folha\"]'); return (m && m.dataset.estado === 'feita') || document.querySelector('#trilha li:nth-child(2)').dataset.estado === 'feita'; }", timeout=3000)
        p4.click('#trilha button[data-fase="1"]')
        ok(p4.get_attribute(mf, 'data-estado') == 'feita' and 'veio do relatório do Domínio' in p4.inner_text(mf), 'a missão da folha cumprida: veio do relatório do Domínio')
        p4.wait_for_function("() => { const r = (window.__mockDb.comparativos || []).find(x => x.cliente_id === 'c1'); return r && r.entrada && r.entrada.folhaRel; }", timeout=5000)
        gr = p4.evaluate("() => (window.__mockDb.comparativos || []).find(x => x.cliente_id === 'c1').entrada")
        fr = gr.get('folhaRel') or []
        ok(len(fr) == 14 and all(set(x.keys()) <= {'competencia', 'folha_salarios', 'prolabore', 'folha_outros'} for x in fr) and gr['entrada']['folha'] == 130000,
           f'o estudo grava só os totais do mês, sem o FGTS nem nome ({sorted(fr[0].keys()) if fr else None})')
        # o resumo de outra empresa: não entra nem vai pra leitura
        p4.evaluate('l => { window.__pdfLinhas = l; }', [x.replace('00.000.000/0000-00', '99.999.999/0001-99') for x in folha_pdf])
        p4.set_input_files('#arquivos', files=[{ 'name': 'folha-outra.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 outra' }])
        p4.wait_for_function("() => [...document.querySelectorAll('#lidos .ct-chip')].some(c => /folha-outra\\.pdf/.test(c.textContent))", timeout=5000)
        ch2 = p4.locator('#lidos .ct-chip', has_text='folha-outra.pdf').inner_text().replace('\xa0', ' ')
        ok('resumo da folha de outra empresa (CNPJ 99.999.999/0001-99)' in ch2 and p4.evaluate('window.__leituras.length') == 1,
           f'o resumo de outra empresa não entra nem vai pra leitura ({ch2!r})')
        # a leitura que falha: os números ficam como estavam
        p4.evaluate('l => { window.__pdfLinhas = l; window.__leituraFalha = true; }', folha_pdf)
        p4.set_input_files('#arquivos', files=[{ 'name': 'folha-falha.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 falha' }])
        p4.wait_for_function("() => [...document.querySelectorAll('#lidos .ct-chip')].some(c => /folha-falha\\.pdf/.test(c.textContent))", timeout=5000)
        ch3 = p4.locator('#lidos .ct-chip', has_text='folha-falha.pdf')
        ok('a leitura da folha não deu certo' in ch3.inner_text() and 'ct-err' in (ch3.get_attribute('class') or '') and p4.input_value('#f_folha') == '130.000,00',
           'a leitura que falha avisa e deixa a folha como estava')

        print('11. Qual comparativo: a empresa do regime geral com o Simples vedado')
        p5 = cx.new_page()
        p5.on('pageerror', lambda e: erros.append('comparativo: ' + str(e)))
        p5.add_init_script(TOUR); p5.add_init_script(SEMEAR)
        p5.clock.set_fixed_time('2026-11-01T12:00:00')
        p5.goto(base + 'fiscal-comparativo.html?cliente=c7')
        p5.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'INDUSTRIA DE TESTE LTDA'", timeout=8000)
        p5.wait_for_selector('#pergunta .ct-opcao', timeout=5000)
        # pedido do Samuel, 11/11/2026 (18h25): "escolhi o comparativo presumido x real, então por que a primeira informação é
        # sobre vedação do Simples? … se não estou querendo um comparativo que envolva o simples, não é de uma empresa do
        # simples, pra que aparecer isso? precisamos ser objetivos com a ferramenta" — na empresa do regime geral, o motivo
        # da sugestão é o regime dela, o que o cadastro diz do Simples é uma linha na opção com ele, e no Presumido × Real
        # nada do Simples aparece
        sug = texto(p5, '#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        ok('sugerido' in sug and 'A empresa está no Lucro Presumido: a escolha de todo ano é entre o Presumido e o Real.' in sug and 'Simples' not in sug, f'o sugerido é o Presumido × Real, e o porquê é o regime dela, sem o Simples ({sug[-70:]!r})')
        outra = texto(p5, '#pergunta .ct-opcao[data-objetivo="todos"]')
        ok('Hoje o cadastro veda o Simples pra ela (2 impedimentos): ele entra como simulação.' in outra, f'o que o cadastro diz do Simples: uma linha, na opção com o Simples ({outra[-90:]!r})')
        perg = p5.inner_text('#pergunta')
        ok(p5.locator('#vedado').count() == 0 and 'CNAE secundário impeditivo' not in perg and 'HOLDING' not in perg and 'O sistema não confere' not in perg,
           'na pergunta, a empresa do regime geral não vê a lista dos impedimentos')
        ok('12.345.678' not in p5.inner_text('body') and '12345678000199' not in p5.content(), 'o documento do sócio não vai pra tela')
        ok(p5.is_hidden('#grade') and p5.is_hidden('#roteiro'), 'antes da escolha, só a pergunta')
        p5.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        p5.wait_for_selector('#resultado table.ct', timeout=5000)
        perg = ' '.join(p5.inner_text('#pergunta').split())
        ok(p5.inner_text('#objetivoAtual') == 'Presumido × Real' and p5.locator('#vedado').count() == 0 and perg == 'Qual comparativo Comparativo: Presumido × Real Trocar',
           f'escolhido o Presumido × Real: só o comparativo e o "Trocar", sem a vedação do Simples ({perg!r})')
        # a tela inteira: do Simples, só a opção do regime de hoje e o campo das compras de fornecedor do Simples
        p5.evaluate("() => document.querySelectorAll('main details').forEach(d => { d.dataset.era = d.open ? '1' : ''; d.open = true; })")
        achados = p5.evaluate(DO_SIMPLES)
        p5.evaluate("() => document.querySelectorAll('main details').forEach(d => { d.open = d.dataset.era === '1'; })")
        ok(achados == [], f'no Presumido × Real da empresa do Presumido, nada do Simples na tela — nem o PGDAS, o anexo, o DAS ou o fator r ({achados[:4]})')
        ok('PGDAS' not in p5.inner_text('#dropAjuda') and 'Faturamento, acompanhamento de entradas' in p5.inner_text('#dropAjuda'), 'a caixa dos relatórios não pede o PGDAS')
        tipos = p5.eval_on_selector_all('#f_atividades_0_tipo option', 'os => os.map(o => o.value + "=" + o.textContent + (o.selected ? "*" : ""))')
        ok(tipos == ['comercio=Comércio (revenda de mercadorias)', 'industria=Indústria*', 'servico=Serviços'], f'as atividades: comércio, indústria e serviços, sem os anexos do Simples ({tipos})')
        ot = texto(p5, '.ct-orig[data-orig="atividades.0.tipo"]')
        ok(ot == 'Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é venda de mercadoria' and p5.get_attribute('.ct-orig[data-orig="atividades.0.tipo"]', 'data-fonte') == 'ponte',
           f'a origem da atividade: o sistema apurou pelas notas do Domínio, sem mandar conferir e sem falar em anexo ({ot!r})')
        trilha = p5.eval_on_selector_all('#trilha .ct-tr-t', 'els => els.map(e => e.textContent)')
        ok(trilha == ['A receita e a presunção', 'O lucro do Real', 'O resto da conta', 'O veredito'], f'o caminho do Presumido × Real ({trilha})')
        ok(celula(p5, 'Simples Nacional', 1) is None and celula(p5, 'Lucro Presumido', 1).startswith('R$') and celula(p5, 'Lucro Real', 1).startswith('R$'), 'a tabela só com o Presumido e o Real')
        res = texto(p5, '#resultado')
        ok('só diferem no IRPJ e na CSLL' in res and 'Entrar no Simples' not in res and 'A escolha vale pro ano inteiro' in res and 'Real empata com o Simples' not in res,
           'o resultado: em 2027 só o IRPJ e a CSLL diferem, sem os prazos nem o empate do Simples')
        ok(p5.locator('#grupoSocios').count() == 0 and p5.locator('#f_difalSimples').count() == 0 and p5.locator('button[data-acao="mais-grupo"]').count() == 0
           and p5.locator('#f_lucroContabil').count() == 1 and p5.locator('#f_atividades_0_pctAliqZero').count() == 1 and p5.locator('#f_atividades_0_pctMonofasico').count() == 0,
           'os campos do caminho: sem as empresas dos sócios e o ICMS fora do DAS; com o lucro da contabilidade e as vendas com alíquota zero de PIS/Cofins (a revenda monofásica é só do comércio)')
        ok('Vendas com alíquota zero de PIS/Cofins' in p5.inner_text('#grade') and p5.get_attribute('.ct-orig[data-orig="atividades.0.pctAliqZero"]', 'data-fonte') == 'padrao',
           'o campo das vendas com alíquota zero de PIS/Cofins, no padrão (nenhuma), a conferir')
        ok(p5.input_value('#f_atividades_0_receita') == '600.000,00' and p5.get_attribute('.ct-orig[data-orig="atividades.0.receita"]', 'data-fonte') == 'ponte'
           and p5.input_value('#f_compras') == '360.000,00' and 'contabilidade feita até jul/26' in p5.inner_text('#escolhida'),
           'os números do Domínio pela ponte (a receita e as compras) e a contabilidade feita até jul/26')
        fontes = p5.inner_text('#escolhida')
        ok('Domínio pela ponte (12 meses fechados)' in fontes and 'sem caso na Reforma' not in fontes and 'sem folha no Fator R' not in fontes and 'sem PGDAS da Receita' not in fontes,
           'na empresa do Presumido, as fontes não dizem a falta do que é só do Simples (a Reforma, o Fator R, o PGDAS)')
        # 11/11/2026, 20h11 (o Samuel: "a ponte deveria puxar essa informação até a data que a contabilidade está feita"): a DRE
        # vai até onde a contabilidade está feita, e o mês se escolhe ao lado do lucro (já no mês do Controle das contabilidades)
        aj = texto(p5, '#ajudaLucro')
        ok('até o mês escolhido' in aj and 'use a DRE até onde ela está feita: a conta leva o lucro aos 12 meses pela margem dos meses que ela tem' in aj and '(de out/25 a set/26)' in aj,
           f'o campo do lucro explica a DRE até onde a contabilidade está feita ({aj[:70]}…)')
        meses_dre = p5.eval_on_selector_all('#f_lucroAte option', 'os => os.map(o => o.value + (o.selected ? "*" : ""))')
        ok(len(meses_dre) == 12 and meses_dre[0] == '2025-10' and meses_dre[9] == '2026-07*' and meses_dre[11] == '2026-09' and 'A DRE vai de out/25 até' in texto(p5, 'label[for="f_lucroAte"]')
           and texto(p5, '#origLucroAte') == 'pelo Controle das contabilidades, feita até jul/26' and 'jul/26 (10 de 12 meses)' in texto(p5, '#f_lucroAte option[value="2026-07"]'),
           f'o seletor do mês da DRE: os 12 meses da receita, já em jul/26, até onde a contabilidade está feita ({meses_dre[9:]})')
        # a fase 1 já abre concluída: a receita e a atividade (a presunção) vieram do Domínio, e a tela vai direto pro lucro
        ok(p5.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita' and p5.get_attribute('#trilha li:nth-child(2)', 'data-estado') == 'atual'
           and 'O lucro da contabilidade' in p5.inner_text('#fase .ct-m.ct-prox'), 'a fase 1 abre concluída (a receita e a presunção pelo Domínio): o próximo passo é o lucro da contabilidade')
        p5.click('#trilha button[data-fase="0"]')
        mp = texto(p5, '#fase .ct-m[data-id="presuncao"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="presuncao"]', 'data-estado') == 'feita' and 'apurado pelas notas do Domínio' in mp
           and 'Nas notas do Domínio de out/25 a set/26, toda a receita é venda de mercadoria. A conta usou: Indústria, 8% no IRPJ e 12% na CSLL sobre R$ 600.000.' in mp
           and p5.locator('#fase .ct-m[data-id="presuncao"] .ct-m-acoes').count() == 0, f'fase 1: a presunção vem cumprida pelas notas do Domínio, sem nada pra conferir ({mp[:110]}…)')
        fa = texto(p5, '#fase .ct-usar-item[data-id="atividade"]')
        ok(p5.get_attribute('#fase .ct-usar-item[data-id="atividade"]', 'data-estado') == 'tem' and 'apurado pelas notas do Domínio, de out/25 a set/26' in fa
           and 'toda a receita é venda de mercadoria. Venda de mercadoria presume 8% no IRPJ e 12% na CSLL; serviço, 32% nos dois.' in fa and 'confira' not in fa.lower(),
           f'o que usar: a atividade de cada receita, apurada pelas notas, sem "confira" ({fa[:110]}…)')
        ok('No Presumido, o IRPJ e a CSLL de 2027 dão R$ 13.680' in texto(p5, '#fase .ct-conquista'), 'a fase 1 diz o que conquistou: o IRPJ e a CSLL do Presumido')
        p5.click('#trilha button[data-fase="1"]')
        pr = texto(p5, '#precisao')
        ok(p5.get_attribute('#precisao li[data-id="lucro"]', 'data-peso') == 'decide' and 'O lucro da contabilidade' in pr and 'o IRPJ e a CSLL do Real saem dele' in pr
           and 'a receita dos 12 meses (veio do Domínio pela ponte)' in pr and 'a atividade e a presunção (apurado pelas notas do Domínio)' in pr and p5.locator('#precisao li[data-id="presuncao"]').count() == 0,
           f'a precisão: falta o lucro da contabilidade, que decide; a presunção já está na conta ({pr[:90]}…)')
        ml = texto(p5, '#fase .ct-m[data-id="lucro"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="lucro"]', 'data-estado') == 'aberta' and 'Falta o lucro da DRE' in ml and 'O Real empata com o Presumido com lucro de R$ 57.000' in ml
           and 'feita até jul/26: use a DRE de out/25 a jul/26 (10 dos 12 meses da receita): ago/26 e set/26 entram pela margem desses 10.' in ml and 'ainda não fecha' not in ml
           and 'Digitar o lucro da DRE' in ml and 'Seguir com a estimativa' in ml,
           f'fase 2: o lucro da contabilidade falta e decide, e a missão pede a DRE até onde a contabilidade está feita ({ml[:90]}…)')
        fd = texto(p5, '#fase .ct-usar-item[data-id="dre"]')
        ok('Domínio Contabilidade: a DRE (ou o balancete) de out/25 a jul/26, até onde a contabilidade está feita' in fd and 'Ago/26 e set/26 entram pela margem dos outros meses.' in fd
           and p5.get_attribute('#fase .ct-usar-item[data-id="dre"]', 'data-estado') == 'falta', 'o que usar: a DRE do Domínio até onde a contabilidade está feita, com os meses que faltam pela margem')
        # a confirmação de quem cuida da contabilidade já aparece, com o que o Domínio mostra daqueles meses
        mc = texto(p5, '#fase .ct-m[data-id="contabil"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="contabil"]', 'data-estado') == 'aberta' and 'confirme com quem cuida da contabilidade dela (Adaini) se o resultado até jul/26 é confiável' in mc
           and 'O que o Domínio mostra de out/25 a jul/26: conta transitória ou a classificar com saldo de mai/26 a jul/26 (R$ 9.000 em jul/26); a conta de banco mais atrasada está lançada até 11/06/2026.' in mc
           and 'Confirmado com a contabilidade' in mc, f'a missão da confirmação: com quem confirmar, até que mês e o que o Domínio mostra ({mc[:110]}…)')
        fc = texto(p5, '#fase .ct-usar-item[data-id="ctbconf"]')
        ok(p5.get_attribute('#fase .ct-usar-item[data-id="ctbconf"]', 'data-estado') == 'falta' and 'falta confirmar' in fc and 'O Domínio aponta 3 de 10 meses com problema' in fc, f'o que usar: a confirmação da contabilidade ({fc[:90]}…)')
        ok(p5.locator('#precisao li[data-id="contabil"]').count() == 1 and p5.get_attribute('#precisao li[data-id="contabil"]', 'data-peso') == 'decide', 'a precisão: a confirmação da contabilidade também falta, e decide')
        p5.click('#fase .ct-m[data-id="lucro"] [data-ir]')
        ok(p5.evaluate("() => document.activeElement && document.activeElement.id") == 'f_lucroContabil', '"Digitar o lucro da DRE" põe o cursor no campo')
        p5.fill('#f_lucroContabil', '40000')
        p5.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"lucro\"]'); return m && m.dataset.estado === 'feita'; }", timeout=3000)
        ml = texto(p5, '#fase .ct-m[data-id="lucro"]')
        # R$ 40.000 em 10 dos 12 meses (a receita é igual em todos: fator 1,2) → R$ 48.000 nos 12 meses
        ok('Lucro de R$ 40.000 na DRE de out/25 a jul/26 (10 dos 12 meses da receita): com ago/26 e set/26 pela mesma margem, lucro de R$ 48.000 nos 12 meses.' in ml
           and 'da troca dos tributos de hoje pelos do Real' in ml and 'digitado' in ml, f'o lucro digitado vale até jul/26 e vai aos 12 meses pela margem ({ml[:130]}…)')
        ok(p5.get_attribute('#trilha li:nth-child(2)', 'data-estado') == 'atual' and 'Provisório' in texto(p5, '#placar') and p5.get_attribute('#fase .ct-m[data-id="contabil"]', 'data-estado') == 'aberta',
           'com o lucro e sem a confirmação de quem cuida da contabilidade, a fase 2 não fecha e o estudo segue provisório')
        p5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.entrada.lucroContabil === 40000 && r.entrada.entrada.lucroAte === '2026-07')", timeout=5000)
        ge = p5.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.comparativos.find(r => r.cliente_id === 'c7').entrada.entrada))")
        ok(ge['lucroDe'] == '2025-10' and ge['lucroAte'] == '2026-07' and abs(ge['lucroReceita'] - 500000) < 0.01, f'o estudo grava o período da DRE e a receita dele ({ge.get("lucroDe")} a {ge.get("lucroAte")}, {ge.get("lucroReceita")})')
        # o mês da DRE se troca no seletor: até set/26 (os 12 meses), o lucro entra como veio, e a tela avisa que passa do que está feito
        p5.select_option('#f_lucroAte', '2026-09')
        p5.wait_for_function("() => /na DRE de out\\/25 a set\\/26\\./.test(document.querySelector('#fase .ct-m[data-id=\"lucro\"]').textContent)", timeout=3000)
        ml9 = texto(p5, '#fase .ct-m[data-id="lucro"]')
        ok('Lucro de R$ 40.000 na DRE de out/25 a set/26.' in ml9 and 'nos 12 meses' not in ml9 and 'ela está feita só até jul/26: a DRE usada vai além disso.' in ml9
           and 'ago/26 e set/26 ainda não estão feitos.' in texto(p5, '#fase .ct-m[data-id="contabil"]'), f'a DRE até set/26: os 12 meses, com o aviso de que passa do que o Controle dá como feito ({ml9[:70]}…)')
        p5.select_option('#f_lucroAte', '2026-07')
        p5.wait_for_function("() => /na DRE de out\\/25 a jul\\/26 /.test(document.querySelector('#fase .ct-m[data-id=\"lucro\"]').textContent)", timeout=3000)
        # a confirmação: um clique, com quem marcou e o dia; fecha a fase 2 — e dá pra desfazer
        p5.click('#fase .ct-m[data-id="contabil"] [data-confirmar-contabil]')
        p5.wait_for_function("() => document.querySelector('#trilha li:nth-child(2)').dataset.estado === 'feita'", timeout=3000)
        ok('Fase 2 concluída' in texto(p5, '#banner') and 'pela contabilidade' in texto(p5, '#banner'), f'com o lucro e a confirmação, a fase 2 fecha ({texto(p5, "#banner")[:100]})')
        p5.click('#trilha button[data-fase="1"]')
        mc = texto(p5, '#fase .ct-m[data-id="contabil"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="contabil"]', 'data-estado') == 'feita' and 'confirmou com quem cuida da contabilidade dela (Adaini) que o resultado até jul/26 é confiável, em ' in mc
           and 'Desfazer a confirmação' in mc and p5.get_attribute('#fase .ct-usar-item[data-id="ctbconf"]', 'data-estado') == 'tem', f'a confirmação cumprida diz quem confirmou e quando, com o Desfazer ({mc[:120]}…)')
        p5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.origens.lucroConfirmado && r.entrada.origens.lucroConfirmado.ate === '2026-07')", timeout=5000)
        oc = p5.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.comparativos.find(r => r.cliente_id === 'c7').entrada.origens.lucroConfirmado))")
        ok(oc['fonte'] == 'confirmado' and oc['ate'] == '2026-07' and len(oc['em']) == 10 and oc['por'], f'e o estudo grava a confirmação: até que mês, quem e o dia ({oc})')
        p5.click('#fase .ct-m[data-id="contabil"] [data-desconfirmar-contabil]')
        p5.wait_for_function("() => document.querySelector('#fase .ct-m[data-id=\"contabil\"]').dataset.estado === 'aberta'", timeout=3000)
        ok(p5.get_attribute('#trilha li:nth-child(2)', 'data-estado') == 'atual' and 'Confirmado com a contabilidade' in texto(p5, '#fase .ct-m[data-id="contabil"]'), '"Desfazer a confirmação" reabre a missão e a fase')
        p5.click('#fase .ct-m[data-id="contabil"] [data-confirmar-contabil]')
        p5.wait_for_function("() => document.querySelector('#trilha li:nth-child(2)').dataset.estado === 'feita'", timeout=3000)
        p5.click('#trilha button[data-fase="1"]')
        p5.click('details.ct-det > summary')
        ok('Lucro antes do IR (o da contabilidade, com os tributos trocados)' in p5.inner_text('details.ct-det'), 'no detalhe por tributo, o lucro do Real é o da contabilidade')
        p5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.entrada.lucroContabil === 40000)", timeout=5000)
        gr = p5.evaluate("() => JSON.parse(JSON.stringify(window.__mockDb.comparativos.find(r => r.cliente_id === 'c7')))")
        ok(gr['entrada']['entrada']['objetivo'] == 'presumido_real' and gr['resultado']['regimes'] == ['presumido', 'real'] and gr['resultado']['totais']['2027']['simples'] is None,
           'o estudo grava o comparativo escolhido, o lucro e o resumo só com os dois regimes')
        p5.fill('#f_lucroContabil', '')
        p5.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"lucro\"]'); return m && m.dataset.estado === 'aberta'; }", timeout=3000)
        ok(p5.get_attribute('.ct-orig[data-orig="lucroContabil"]', 'data-fonte') == 'padrao', 'o lucro apagado volta à estimativa (a origem volta ao padrão)')
        p5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.entrada.lucroContabil == null && !('lucroAte' in r.entrada.entrada) && !('lucroReceita' in r.entrada.entrada))", timeout=5000)
        ok(True, 'e o período da DRE sai junto com o lucro')
        # o resto da conta: as vendas com alíquota zero de PIS/Cofins (a cesta básica da Lei 10.925/2004)
        p5.click('#trilha button[data-fase="2"]')
        mp = texto(p5, '#fase .ct-m[data-id="piscofins"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="piscofins"]', 'data-estado') == 'aberta' and 'No padrão, toda a venda paga PIS/Cofins' in mp and 'informe a parte das vendas com alíquota zero' in mp
           and 'Toda a venda paga' in mp and 'Só pesa em 2026' in mp, f'fase 3: o PIS/Cofins das vendas, no padrão, a conferir ({mp[:90]}…)')
        pres26 = celula(p5, 'Lucro Presumido', 1)
        p5.fill('#f_atividades_0_pctAliqZero', '100')
        p5.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"piscofins\"]'); return m && m.dataset.estado === 'feita'; }", timeout=3000)
        mp = texto(p5, '#fase .ct-m[data-id="piscofins"]')
        # PIS/Cofins do Presumido de 2026: 0,365% × (600.000 − 17% × 600.000) × 9/12 = 1.363,28 (os 10% da alíquota, de abril a dezembro)
        ok('R$ 600.000 das vendas com alíquota zero: em 2026, R$ 1.363 no Presumido' in mp and 'paga 10% da alíquota: 0,365% no Presumido e 0,925% no Real' in mp and 'LC 224/2025' in mp and 'digitado' in mp
           and celula(p5, 'Lucro Presumido', 1) != pres26 and p5.get_attribute('.ct-orig[data-orig="atividades.0.pctAliqZero"]', 'data-fonte') == 'digitado',
           f'com toda a venda em alíquota zero, fora da cesta básica: a missão cumprida, com os 10% da alíquota desde abril de 2026 (LC 224), e o total dos 12 meses menor ({pres26} → {celula(p5, "Lucro Presumido", 1)})')
        ok('Vendas sem PIS/Cofins (a revenda monofásica e a venda com alíquota zero)' in p5.inner_text('#resultado') and 'No Simples, a alíquota zero de PIS/Cofins não vale' not in p5.inner_text('#resultado')
           and 'Alíquota zero de PIS/Cofins fora da Cesta Básica Nacional: desde 01/04/2026' in p5.inner_text('#resultado'),
           'os avisos: o que a conta supõe do crédito e os 10% da LC 224 (sem o do Simples, que não está na comparação)')
        lc = celula(p5, 'Lucro Presumido', 1)
        p5.check('#f_atividades_0_aliqZeroCesta')
        p5.wait_for_function("() => /sem PIS\\/Cofins a pagar no Presumido nem no Real/.test(document.querySelector('#fase .ct-m[data-id=\"piscofins\"]').textContent)", timeout=3000)
        ok(celula(p5, 'Lucro Presumido', 1) != lc and 'Alíquota zero de PIS/Cofins fora da Cesta Básica Nacional' not in p5.inner_text('#resultado'),
           f'marcada a Cesta Básica Nacional: a alíquota zero segue, sem PIS/Cofins a pagar em 2026, e o aviso da LC 224 some ({lc} → {celula(p5, "Lucro Presumido", 1)})')
        p5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.entrada.atividades[0].aliqZeroCesta === true && r.entrada.entrada.atividades[0].pctAliqZero === 100)", timeout=5000)
        ok(True, 'e o estudo grava as duas coisas (a parte com alíquota zero e a marca da cesta básica)')
        # trocar pra os três regimes: o Simples volta como simulação
        p5.click('#trocarObjetivo')
        p5.wait_for_selector('#pergunta .ct-opcao', timeout=3000)
        ok(p5.get_attribute('#pergunta .ct-opcao[data-objetivo="presumido_real"]', 'aria-pressed') == 'true', '"Trocar" abre a pergunta de novo, com o de agora marcado')
        p5.click('#pergunta .ct-opcao[data-objetivo="todos"]')
        p5.wait_for_function("() => [...document.querySelectorAll('#resultado table.ct:not(.ct-mini) tr')].some(t => t.cells[0] && t.cells[0].textContent.startsWith('Simples Nacional'))", timeout=5000)
        av = texto(p5, '#alertaVedado') if p5.locator('#alertaVedado').count() else ''
        ok('O Simples está vedado hoje pelo cadastro' in av and 'a linha dele vale como simulação' in av and 'Ela pode entrar no Simples?' in p5.inner_text('#trilha'),
           f'com os três regimes: o Simples entra como simulação, com o aviso ({av[:80]}…)')
        ok('Sem o Simples, o mais barato em 2027 é o Lucro ' in av and p5.evaluate("() => document.querySelector('#resultado').firstElementChild.id") == 'alertaVedado' and 'HOLDING <b>TESTE</b> LTDA' in av and p5.locator('#alertaVedado b').count() == 0,
           'o aviso vem antes da frase do mais barato e diz o mais barato sem o Simples (o nome com HTML, como texto)')
        # com o Simples no comparativo, os impedimentos aparecem em lista, com a base e o remédio
        ved = texto(p5, '#vedado')
        ok('O Simples entra como simulação.' in texto(p5, '#pergunta .ct-escolha') and 'O Simples está vedado pra ela hoje.' in ved and 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária)' in ved and 'Anexo VI' in ved
           and 'tirar o CNAE por alteração resolve' in ved and 'Pessoa jurídica no quadro de sócios: HOLDING <b>TESTE</b> LTDA (50% do capital)' in ved and 'LC 123, art. 3º, §4º, I' in ved,
           f'com os três regimes, os impedimentos em lista: o CNAE secundário (com o remédio) e a pessoa jurídica entre os sócios ({ved[:80]}…)')
        ok(p5.locator('#vedado b').count() == 1 and '4637-1/04' not in ved and '12.345.678' not in p5.inner_text('body') and '12345678000199' not in p5.content(),
           'o nome do sócio com HTML entra como texto, o CNAE permitido não aparece e o documento do sócio não vai pra tela')
        ok('Simples Nacional (PGDAS)' in p5.inner_text('#dropAjuda'), 'e a caixa dos relatórios volta a pedir o PGDAS')
        tipos3 = p5.eval_on_selector_all('#f_atividades_0_tipo option', 'os => os.map(o => o.textContent)')
        ok(tipos3 == ['Comércio (revenda de mercadorias)', 'Indústria', 'Serviços do Anexo III', 'Serviços do fator r (Anexo V ou III)', 'Serviços do Anexo IV'], f'e as atividades voltam com os anexos ({tipos3})')
        ot3 = texto(p5, '.ct-orig[data-orig="atividades.0.tipo"]')
        ok(ot3.startswith('Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é venda de mercadoria · o anexo, pelo CNAE do cadastro (1091-1/02') and ot3.endswith(': confira'),
           f'com o Simples no estudo, a origem da atividade diz o que as notas não dizem: o anexo, pelo CNAE, a conferir ({ot3[-70:]!r})')
        p5.click('#trilha button[data-fase="0"]')
        mv = texto(p5, '#fase .ct-m[data-id="vedacoes"]')
        ok(p5.get_attribute('#fase .ct-m[data-id="vedacoes"]', 'data-estado') == 'aberta' and 'O Simples está vedado hoje.' in mv and 'Vai tirar os impedimentos' in mv and 'Entrar no Simples' in texto(p5, '.ct-prazos')
           and 'Antes, a empresa precisa tirar os impedimentos do cadastro.' in texto(p5, '.ct-prazos'),
           'a missão dos impedimentos, aberta, e o prazo do Simples com a ressalva')
        ok(p5.locator('#f_lucroContabil').count() == 1 and p5.locator('button[data-acao="mais-grupo"]').count() == 1, 'e os campos do Simples voltam, com o lucro da contabilidade junto')
        ok(p5.input_value('#f_atividades_0_pctAliqZero') == '100' and p5.is_checked('#f_atividades_0_aliqZeroCesta') and 'No Simples, a alíquota zero de PIS/Cofins não vale (LC 123, art. 24, §1º)' in p5.inner_text('#resultado'),
           'com o Simples na comparação, a alíquota zero informada e a marca ficam, e a tela avisa que no Simples ela paga no DAS')

        print('12. O Simples só aparece quando faz parte do estudo')
        def nova(cliente, nome):
            q = cx.new_page()
            q.on('pageerror', lambda e: erros.append('comparativo: ' + str(e)))
            q.add_init_script(TOUR); q.add_init_script(SEMEAR)
            q.clock.set_fixed_time('2026-11-01T12:00:00')
            q.goto(base + 'fiscal-comparativo.html?cliente=' + cliente)
            q.wait_for_function("n => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === n", arg=nome, timeout=8000)
            q.wait_for_selector('#pergunta .ct-opcao', timeout=5000)
            return q
        def varrer(q):
            q.evaluate("() => document.querySelectorAll('main details').forEach(d => { d.dataset.era = d.open ? '1' : ''; d.open = true; })")
            achados = q.evaluate(DO_SIMPLES)
            q.evaluate("() => document.querySelectorAll('main details').forEach(d => { d.open = d.dataset.era === '1'; })")
            return achados
        linha_da_pergunta = lambda q: ' '.join(q.inner_text('#pergunta').split())
        # a empresa de serviço do Presumido (o CNAE é do fator r), só o Presumido contra o Real
        p6 = nova('c2', 'EMPRESA EXEMPLO LTDA')
        outra = texto(p6, '#pergunta .ct-opcao[data-objetivo="todos"]')
        ok('Pelo cadastro, nada veda o Simples' in outra and p6.locator('#vedado').count() == 0 and 'O sistema não confere' not in p6.inner_text('#pergunta'),
           f'a do regime geral sem impedimento: a linha de que nada veda, na opção com o Simples ({outra[-80:]!r})')
        p6.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        p6.wait_for_selector('#f_atividades_0_receita', timeout=3000)
        p6.fill('#f_atividades_0_receita', '600000')
        p6.wait_for_selector('#resultado table.ct', timeout=5000)
        tipos = p6.eval_on_selector_all('#f_atividades_0_tipo option', 'os => os.map(o => o.value + "=" + o.textContent + (o.selected ? "*" : ""))')
        ok(tipos == ['comercio=Comércio (revenda de mercadorias)', 'industria=Indústria', 'servico_r=Serviços*'], f'a atividade é "Serviços": o tipo de serviço fica guardado, sem o anexo nem o fator r na lista ({tipos})')
        p6.click('#trilha button[data-fase="0"]')
        mp = texto(p6, '#fase .ct-m[data-id="presuncao"]')
        ok('A conta usou: Serviços, 32% no IRPJ e 32% na CSLL sobre R$ 600.000' in mp, f'a missão da presunção diz "Serviços", 32% ({mp[:90]}…)')
        achados = varrer(p6)
        ok(achados == [] and linha_da_pergunta(p6) == 'Qual comparativo Comparativo: Presumido × Real Trocar', f'e a tela não fala do Simples, do anexo, do DAS nem do fator r ({achados[:4]})')
        # outra atividade: o teste das premissas diz "serviços", sem o anexo
        p6.click('button[data-acao="mais"]'); p6.wait_for_selector('#f_atividades_1_receita', timeout=2000)
        p6.select_option('#f_atividades_1_tipo', 'comercio'); p6.wait_for_selector('#f_atividades_1_aliqIcms', timeout=2000)
        p6.fill('#f_atividades_1_receita', '100000')
        p6.wait_for_function("() => /o ISS \\(serviços\\)/.test(document.querySelector('#resultado').textContent)", timeout=4000)
        ok(varrer(p6) == [], 'com duas atividades, os testes das premissas dizem "serviços", sem o anexo')
        # o regime de hoje trocado pra Simples na tela: o Simples passa a fazer parte do estudo
        p6.select_option('#regimeAtual', 'simples')
        p6.wait_for_function("() => /O Simples ficou fora desta comparação/.test(document.querySelector('#pergunta').textContent)", timeout=3000)
        ok('O Simples ficou fora desta comparação: pelo cadastro, nada o veda.' in linha_da_pergunta(p6) and 'Simples Nacional (PGDAS)' in p6.inner_text('#dropAjuda'),
           'trocado o regime de hoje pra Simples: a nota de que ele ficou fora e o PGDAS na caixa dos relatórios')
        p6.select_option('#regimeAtual', 'presumido')
        p6.wait_for_function("() => !/Simples/.test(document.querySelector('#pergunta').textContent)", timeout=3000)
        ok(linha_da_pergunta(p6) == 'Qual comparativo Comparativo: Presumido × Real Trocar' and 'PGDAS' not in p6.inner_text('#dropAjuda'), 'de volta ao Presumido, o Simples sai da tela de novo')
        p6.close()
        # a empresa do Simples que compara só o Presumido com o Real: o Simples é o regime dela, e a tela diz que ficou fora
        p7 = nova('c1', 'COMÉRCIO MODELO ME')
        todos = texto(p7, '#pergunta .ct-opcao[data-objetivo="todos"]')
        ok('sugerido' in todos and 'A empresa está no Simples Nacional: ficar ou sair é a pergunta.' in todos and 'Pelo cadastro, nada veda o Simples' in todos and p7.locator('#vedado').count() == 0,
           f'a do Simples: os três sugeridos, com o porquê e a linha de que nada veda ({todos[-90:]!r})')
        p7.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        p7.wait_for_selector('#trocarObjetivo', timeout=3000)
        ok('O Simples ficou fora desta comparação: pelo cadastro, nada o veda.' in linha_da_pergunta(p7) and 'Simples Nacional (PGDAS)' in p7.inner_text('#dropAjuda'),
           'escolhido o Presumido × Real: a tela diz que o Simples ficou fora, e a caixa segue lendo o PGDAS')
        p7.close()
        # a do Presumido com o Simples vedado: com o regime de hoje trocado pra Simples, a lista dos impedimentos aparece
        p8 = nova('c7', 'INDUSTRIA DE TESTE LTDA')
        p8.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        p8.wait_for_selector('#trocarObjetivo', timeout=3000)
        ok(p8.locator('#vedado').count() == 0, 'no Presumido × Real da empresa do Presumido, sem a lista dos impedimentos')
        p8.select_option('#regimeAtual', 'simples')
        p8.wait_for_selector('#vedado', timeout=3000)
        ok('O Simples está vedado pra ela hoje.' in texto(p8, '#vedado') and 'CNAE secundário impeditivo: 7820-5/00' in texto(p8, '#vedado'), 'com o regime de hoje no Simples, os impedimentos passam a ser assunto: a lista aparece')
        p8.click('#trocarObjetivo')
        p8.wait_for_selector('#pergunta .ct-opcao', timeout=3000)
        sug = texto(p8, '#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        ok('A empresa está no Simples Nacional e o Simples está vedado pra ela.' in sug and p8.locator('#vedado').count() == 1, 'e, na pergunta, o Simples vedado é o motivo da sugestão, com a lista')
        p8.close()

        print('13. A atividade e a presunção: o sistema apura pelas notas do Domínio')
        # pedido do Samuel, 11/11/2026 (19h12): "não ficou claro o que preciso fazer, como temos acesso nas notas fiscais pela
        # ponte da domínio, não ficaria mais fácil para o próprio sistema apurar essa informação?"
        # (a) o estudo gravado antes, com a atividade "pelo CNAE do cadastro — confira o anexo": abre com a origem de hoje
        p9 = cx.new_page()
        p9.on('pageerror', lambda e: erros.append('comparativo: ' + str(e)))
        p9.add_init_script('window.__estudoAntigo = true'); p9.add_init_script(TOUR); p9.add_init_script(SEMEAR)
        p9.clock.set_fixed_time('2026-11-01T12:00:00')
        p9.goto(base + 'fiscal-comparativo.html?cliente=c11')
        p9.wait_for_selector('#resultado table.ct', timeout=8000)
        ot = texto(p9, '.ct-orig[data-orig="atividades.0.tipo"]')
        ok(ot == 'Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é venda de mercadoria', f'o estudo gravado com "pelo CNAE — confira o anexo" abre com a origem de hoje: as notas do Domínio ({ot!r})')
        ok(p9.get_attribute('#trilha li:nth-child(1)', 'data-estado') == 'feita', 'e a fase 1 abre concluída, sem ninguém conferir a atividade')
        p9.click('#trilha button[data-fase="0"]')
        mp = texto(p9, '#fase .ct-m[data-id="presuncao"]')
        ok(p9.get_attribute('#fase .ct-m[data-id="presuncao"]', 'data-estado') == 'feita' and 'apurado pelas notas do Domínio' in mp and 'toda a receita é venda de mercadoria' in mp
           and 'Comércio (revenda de mercadorias), 8% no IRPJ e 12% na CSLL sobre R$ 840.000' in mp, f'a missão da presunção, cumprida pelas notas ({mp[:100]}…)')
        ok(varrer(p9) == [], 'e nada do Simples na tela (a origem antiga falava em anexo)')
        # a receita de serviço posta à mão, que as notas não têm: a missão abre dizendo as duas divisões e o que fazer
        p9.click('button[data-acao="mais"]'); p9.wait_for_selector('#f_atividades_1_receita', timeout=2000)
        p9.fill('#f_atividades_1_receita', '280000')
        p9.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"presuncao\"]'); return m && m.dataset.estado === 'aberta'; }", timeout=4000)
        mp = texto(p9, '#fase .ct-m[data-id="presuncao"]')
        ok('toda a receita é venda de mercadoria; no estudo, 75% é venda de mercadoria e 25% é de serviço' in mp and 'Acerte a receita de cada atividade pra ficar como as notas; se o estudo é que está certo, clique em Está certa.' in mp
           and 'o estudo não bate com as notas do Domínio' in texto(p9, '#fase .ct-usar-item[data-id="atividade"]'), f'a receita de serviço que as notas não têm: a missão abre e diz o que fazer ({mp[:120]}…)')
        p9.click('#fase .ct-m[data-id="presuncao"] [data-conferir]')
        p9.wait_for_function("() => document.querySelector('#trilha li:nth-child(1)').dataset.estado === 'feita'", timeout=3000)
        p9.click('#trilha button[data-fase="0"]')
        ok(p9.get_attribute('#fase .ct-m[data-id="presuncao"]', 'data-estado') == 'feita' and 'conferido' in texto(p9, '#fase .ct-m[data-id="presuncao"]') and texto(p9, '.ct-orig[data-orig="atividades.0.tipo"]') == 'conferido',
           '"Está certa" fecha a missão e a fase, e a origem da atividade passa a "conferido"')
        p9.close()
        # (b) a construtora: a nota não diz se a obra é com todos os materiais — a missão decide, com a regra e o que fazer
        pa = nova('c10', 'CONSTRUTORA FICTICIA LTDA')
        pa.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        pa.wait_for_selector('#resultado table.ct', timeout=5000)
        mp = texto(pa, '#fase .ct-m[data-id="presuncao"]')
        ok(pa.get_attribute('#fase .ct-m[data-id="presuncao"]', 'data-estado') == 'aberta' and 'próximo passo' in mp and 'O CNAE da empresa é de construção (4120-4/00).' in mp
           and 'A obra por empreitada com todos os materiais por conta da empresa presume 8% no IRPJ e 12% na CSLL; só com a mão de obra, ou com parte dos materiais, 32% nos dois.' in mp
           and 'A conta usou: Serviços, 32% no IRPJ e 32% na CSLL sobre R$ 960.000.' in mp and 'Ver a presunção' in mp and 'Está certa' in mp, f'a construtora: a missão da presunção aberta, com a regra da obra e o que fazer ({mp[:110]}…)')
        fa = texto(pa, '#fase .ct-usar-item[data-id="atividade"]')
        ok(pa.get_attribute('#fase .ct-usar-item[data-id="atividade"]', 'data-estado') == 'padrao' and 'CNAE de construção: falta conferir a presunção' in fa and 'a presunção depende do que as notas do Domínio não dizem. A regra e o que fazer estão na missão abaixo.' in fa,
           f'o que usar: a linha diz o que falta e onde resolver ({fa[:90]}…)')
        ok('Provisório' in texto(pa, '#placar') and 'a presunção' in texto(pa, '#resultado'), 'e o resultado fica provisório: a presunção pode virar a conta')
        ok(texto(pa, '.ct-orig[data-orig="atividades.0.tipo"]') == 'Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é de serviço', 'a origem da atividade: serviço, pelas notas')
        pa.click('#fase .ct-m[data-id="presuncao"] [data-ir]')
        ok(pa.evaluate("() => document.activeElement && document.activeElement.id") == 'f_atividades_0_presIrpj' and pa.evaluate("() => document.getElementById('f_atividades_0_presIrpj').closest('details').open"),
           '"Ver a presunção" abre o ajuste da atividade e põe o cursor na presunção do IRPJ')
        pa.fill('#f_atividades_0_presIrpj', '8'); pa.fill('#f_atividades_0_presCsll', '12')
        pa.wait_for_function("() => document.querySelector('#trilha li:nth-child(1)').dataset.estado === 'feita'", timeout=4000)
        pa.click('#trilha button[data-fase="0"]')
        mp = texto(pa, '#fase .ct-m[data-id="presuncao"]')
        ok('A conta usou: Serviços, 8% no IRPJ e 12% na CSLL sobre R$ 960.000.' in mp and pa.get_attribute('#fase .ct-m[data-id="presuncao"]', 'data-estado') == 'feita', f'a presunção digitada (8 e 12) fecha a missão ({mp[:110]}…)')
        ok(varrer(pa) == [], 'e nada do Simples na tela da construtora do Presumido')
        pa.close()
        # (c) a empresa sem nota nenhuma no sistema: a missão diz por que pergunta e o que fazer
        pb = nova('c12', 'LOJA FICTICIA LTDA')
        pb.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
        pb.wait_for_selector('#f_atividades_0_receita', timeout=3000)
        pb.fill('#f_atividades_0_receita', '900000')
        pb.wait_for_selector('#resultado table.ct', timeout=5000)
        pb.click('#trilha button[data-fase="0"]')
        mp = texto(pb, '#fase .ct-m[data-id="presuncao"]')
        ok('O sistema não tem as notas desta empresa: a atividade veio do CNAE do cadastro.' in mp and 'Se a empresa tem as duas receitas, separe cada uma numa atividade; se é isso mesmo, clique em Está certa.' in mp,
           f'sem nota no sistema: a missão diz por que pergunta e o que fazer ({mp[:110]}…)')
        fa = texto(pb, '#fase .ct-usar-item[data-id="atividade"]')
        ok('sem notas no sistema: pelo CNAE do cadastro' in fa and 'A regra e o que fazer estão na missão abaixo.' in fa and 'Com a empresa no Domínio, a ponte traz essa divisão pelas notas, todo dia.' in fa, f'e o que usar aponta a missão ({fa[:90]}…)')
        pb.close()

        print('14. A pergunta da confirmação vai pro vigia de quem cuida da contabilidade')
        # o "vai" do Samuel, 11/11/2026 (21h19): a missão manda a pergunta pela função do banco (comparativo_pedir_confirmacao),
        # com o que o Domínio mostra, e o estado dela volta pela comparativo_confirmacao ao abrir a empresa
        RPC = """
        window.__rpc = { feitas: [], pergunta: null, erro: null };
        window.__mockRpc = (nome, args) => {
          window.__rpc.feitas.push({ nome, args });
          if (nome === 'comparativo_confirmacao') return { data: window.__rpc.pergunta, error: null };
          if (nome === 'comparativo_pedir_confirmacao') {
            if (window.__rpc.erro) return { data: null, error: window.__rpc.erro };
            window.__rpc.pergunta = { id: 'p-1', ate: args.p_ate, situacao: 'aberta', sim: false, para: 'Adaini', para_email: 'contabil@macedoereis.com.br', pedida_por: 'Samuel',
              criada_em: '2026-11-01T15:00:00+00:00', resposta: null, resposta_texto: null, respondida_em: null };
            return { data: { id: 'p-1', nova: true, para: 'Adaini' }, error: null };
          }
          return { data: [], error: null };
        };"""
        def abrir_com(antes):
            q = cx.new_page()
            q.on('pageerror', lambda e: erros.append('comparativo: ' + str(e)))
            q.add_init_script(antes); q.add_init_script(TOUR); q.add_init_script(SEMEAR)
            q.clock.set_fixed_time('2026-11-01T12:00:00')
            q.goto(base + 'fiscal-comparativo.html?cliente=c7')
            q.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'INDUSTRIA DE TESTE LTDA'", timeout=8000)
            q.wait_for_selector('#pergunta .ct-opcao', timeout=5000)
            q.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
            q.wait_for_selector('#resultado table.ct', timeout=5000)
            q.click('#trilha button[data-fase="1"]')
            return q
        MC = '#fase .ct-m[data-id="contabil"]'
        pq = abrir_com(RPC)
        lidas = pq.evaluate("() => window.__rpc.feitas.filter(x => /^comparativo_/.test(x.nome)).map(x => x.nome + ':' + x.args.p_cliente)")
        ok(lidas == ['comparativo_confirmacao:c7'], f'ao abrir a empresa, a tela lê o estado da pergunta pela função do banco ({lidas})')
        bt = pq.locator(MC + ' [data-perguntar-contabil]')
        ok(bt.count() == 1 and bt.inner_text() == 'Perguntar pra Adaini' and bt.get_attribute('data-perguntar-contabil') == '2026-07' and pq.locator(MC + ' [data-confirmar-contabil]').count() == 1,
           'a missão da confirmação oferece a pergunta pra quem cuida da contabilidade, ao lado do "Confirmado com a contabilidade"')
        # a recusa do banco aparece na missão, com a frase dele; o erro técnico vira a frase da casa — e o botão segue lá
        pq.evaluate("() => { window.__rpc.erro = { code: 'P0001', message: 'O Controle das contabilidades não diz quem cuida desta empresa.' }; }")
        bt.click()
        pq.wait_for_function("() => /não diz quem cuida desta empresa/.test(document.querySelector('#fase .ct-m[data-id=\"contabil\"]').textContent)", timeout=4000)
        av = pq.locator(MC + ' p[role="status"]')
        ok(av.count() == 1 and 'var(--err)' in (av.get_attribute('style') or '') and pq.locator(MC + ' [data-perguntar-contabil]').count() == 1 and pq.get_attribute(MC, 'data-estado') == 'aberta',
           f'a recusa do banco aparece na missão, em vermelho, e a pergunta segue disponível ({av.inner_text()[:70]})')
        pq.evaluate("() => { window.__rpc.erro = { code: 'PGRST202', message: 'Could not find the function public.comparativo_pedir_confirmacao' }; }")
        pq.click(MC + ' [data-perguntar-contabil]')
        pq.wait_for_function("() => /Não deu pra enviar a pergunta agora\\./.test(document.querySelector('#fase .ct-m[data-id=\"contabil\"]').textContent)", timeout=4000)
        ok('Could not find' not in texto(pq, MC), 'o erro técnico do banco não vai pra tela: vira "Não deu pra enviar a pergunta agora."')
        # a pergunta enviada: a missão diz onde ela está, o botão de perguntar sai e o clique de quem falou com ela segue valendo
        pq.evaluate("() => { window.__rpc.erro = null; }")
        pq.click(MC + ' [data-perguntar-contabil]')
        pq.wait_for_function("() => /A pergunta está no vigia de Adaini desde 01\\/11\\/2026, sem resposta\\./.test(document.querySelector('#fase .ct-m[data-id=\"contabil\"]').textContent)", timeout=4000)
        mc = texto(pq, MC)
        ok('Pergunta enviada: aparece no vigia de Adaini, com o que o Domínio mostra. A resposta volta pra esta missão.' in mc and pq.locator(MC + ' [data-perguntar-contabil]').count() == 0
           and pq.locator(MC + ' [data-confirmar-contabil]').count() == 1 and pq.get_attribute(MC, 'data-estado') == 'aberta' and 'var(--err)' not in (pq.locator(MC + ' p[role="status"]').get_attribute('style') or ''),
           f'enviada: a missão diz que a pergunta está no vigia dela, sem resposta, e segue aberta ({mc[-150:]})')
        ped = pq.evaluate("() => window.__rpc.feitas.filter(x => x.nome === 'comparativo_pedir_confirmacao').pop().args")
        ok(ped['p_cliente'] == 'c7' and ped['p_ate'] == '2026-07' and 'conta transitória ou a classificar com saldo de mai/26 a jul/26' in ped['p_sinais'] and 'lançada até 11/06/2026' in ped['p_sinais'],
           f'o pedido leva a empresa, o mês e o que o Domínio mostra ({ped["p_sinais"][:70]}…)')
        ok(pq.evaluate("() => !!(document.activeElement && document.activeElement.closest('#fase .ct-m[data-id=\"contabil\"]'))"), 'e o foco fica na missão')
        fc = texto(pq, '#fase .ct-usar-item[data-id="ctbconf"]')
        ok(pq.get_attribute('#fase .ct-usar-item[data-id="ctbconf"]', 'data-estado') == 'falta' and 'perguntado a Adaini em 01/11/2026, sem resposta' in fc and 'Provisório' in texto(pq, '#placar'),
           'o que usar: perguntado, sem resposta — e o estudo segue provisório')
        # a resposta "sim" de quem cuida: ao abrir a empresa de novo, a missão vem cumprida pelo vigia, sem o Desfazer
        def reabrir(q):
            q.fill('#busca', 'INDUSTRIA DE TESTE')
            q.click('#sugestoes button[data-id="c7"]')
        pq.evaluate("() => { Object.assign(window.__rpc.pergunta, { situacao: 'respondida', sim: true, resposta: 'Sim, pode usar até jul/26', respondida_em: '2026-11-02T13:00:00+00:00' }); }")
        reabrir(pq)
        pq.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"contabil\"]'); return m && m.dataset.estado === 'feita'; }", timeout=6000)
        mc = texto(pq, MC)
        ok('confirmado por Adaini em 02/11/2026, pelo vigia' in mc and 'Adaini respondeu em 02/11/2026 que o resultado até jul/26 é confiável (a pergunta do vigia, feita por Samuel).' in mc
           and pq.locator(MC + ' button').count() == 0 and 'Pergunta enviada' not in mc and pq.get_attribute('#fase .ct-usar-item[data-id="ctbconf"]', 'data-estado') == 'tem',
           f'o sim de quem cuida: a missão cumprida pelo vigia, sem botão nenhum (a resposta é dela) ({mc[:120]}…)')
        ok(pq.evaluate("() => { const r = (window.__mockDb.comparativos || []).find(x => x.cliente_id === 'c7'); return !!r && !(r.entrada.origens || {}).lucroConfirmado; }"),
           'a resposta dela não vira marca no estudo: vale enquanto a pergunta disser que sim')
        # o "ainda não", com o que ela escreveu (o texto do banco entra escapado), e a pergunta de novo
        pq.evaluate("() => { Object.assign(window.__rpc.pergunta, { sim: false, resposta: 'Ainda não: falta acertar (digo o quê)', resposta_texto: 'falta o extrato <b>de julho</b>' }); }")
        reabrir(pq)
        pq.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"contabil\"]'); return m && m.dataset.estado === 'aberta' && /Escreveu/.test(m.textContent); }", timeout=6000)
        mc = texto(pq, MC)
        ok('Adaini respondeu em 02/11/2026: "Ainda não: falta acertar (digo o quê)". Escreveu: "falta o extrato <b>de julho</b>".' in mc and pq.locator(MC + ' .ct-m-txt b').count() == 0
           and pq.locator(MC + ' [data-perguntar-contabil]').inner_text() == 'Perguntar pra Adaini de novo' and pq.locator(MC + ' [data-confirmar-contabil]').count() == 1,
           f'o "ainda não": a resposta e o que ela escreveu, escapado, com o "Perguntar pra Adaini de novo" ({mc[-170:]})')
        pq.close()
        # quem cuida da contabilidade não pergunta a si mesma: sem o botão, confirma direto
        pr = abrir_com('window.__mockEmail = "contabil@macedoereis.com.br";' + RPC)
        ok(pr.locator(MC + ' [data-perguntar-contabil]').count() == 0 and pr.locator(MC + ' [data-confirmar-contabil]').count() == 1, 'com a própria Adaini na tela, a missão não oferece a pergunta: ela confirma direto')
        pr.close()
        # sem as funções no banco (a resposta vazia do banco falso): a tela segue como antes, com a pergunta disponível
        ps = abrir_com('window.__semRpc = true;')
        ok(ps.get_attribute(MC, 'data-estado') == 'aberta' and ps.locator(MC + ' [data-perguntar-contabil]').count() == 1 and 'A pergunta está no vigia' not in texto(ps, MC), 'sem pergunta nenhuma no banco, a missão segue aberta, como antes')
        ps.close()

        print('15. O lucro da contabilidade pela ponte do Domínio (a versão 5)')
        # o "vai" do Samuel das 22h13 de 11/11/2026: o resultado da contabilidade chega mês a mês, e o lucro do Real entra
        # sozinho até onde o Controle das contabilidades dá a contabilidade como feita (julho de 2026)
        ML, LU = '#fase .ct-m[data-id="lucro"]', '.ct-orig[data-orig="lucroContabil"]'
        def abrir_v5(marca, gravado=False):
            q = cx.new_page()
            q.on('pageerror', lambda e: erros.append('ponte v5: ' + str(e)))
            q.add_init_script('window.__ponteV5 = ' + json.dumps(marca) + ';'); q.add_init_script(TOUR); q.add_init_script(SEMEAR)
            q.clock.set_fixed_time('2026-11-01T12:00:00')
            q.goto(base + 'fiscal-comparativo.html?cliente=c7')
            q.wait_for_function("() => document.querySelector('#escolhida h3') && document.querySelector('#escolhida h3').textContent === 'INDUSTRIA DE TESTE LTDA'", timeout=8000)
            if not gravado:
                q.wait_for_selector('#pergunta .ct-opcao', timeout=5000)
                q.click('#pergunta .ct-opcao[data-objetivo="presumido_real"]')
            q.wait_for_selector('#resultado table.ct', timeout=5000)
            q.click('#trilha button[data-fase="1"]')
            q.wait_for_selector(ML, timeout=3000)
            return q
        valor = lambda q: q.input_value('#f_lucroContabil').replace('\xa0', ' ')
        q5 = abrir_v5(True)
        ok(valor(q5) == '30.000,00' and q5.get_attribute(LU, 'data-fonte') == 'ponte' and texto(q5, LU) == 'Domínio, pela ponte: o resultado da contabilidade de out/25 a jul/26'
           and q5.input_value('#f_lucroAte') == '2026-07', f'o lucro vem preenchido pela ponte, até o mês do Controle: {valor(q5)} ({texto(q5, LU)})')
        ml = texto(q5, ML)
        ok(q5.get_attribute(ML, 'data-estado') == 'feita' and 'veio do Domínio pela ponte' in ml and 'Lucro de R$ 30.000 na DRE de out/25 a jul/26 (10 dos 12 meses da receita): com ago/26 e set/26 pela mesma margem, lucro de R$ 36.000 nos 12 meses.' in ml
           and q5.locator(ML + ' button').count() == 0, f'a missão do lucro vem cumprida pela ponte, sem botão ({ml[:110]}…)')
        ok(q5.get_attribute('#fase .ct-m[data-id="contabil"]', 'data-estado') == 'aberta' and 'Provisório' in texto(q5, '#placar'), 'a confirmação de quem cuida da contabilidade segue aberta: o estudo fica provisório')
        fd = texto(q5, '#fase .ct-usar-item[data-id="dre"]')
        ok('Automático: a ponte do Domínio traz o resultado de cada mês' in fd and 'veio do Domínio pela ponte: a DRE de out/25 a jul/26 (10 de 12 meses)' in fd, f'o que usar: o lucro é automático pela ponte ({fd[:90]}…)')
        ok(q5.input_value('#f_atividades_0_pctAliqZero') == '60' and q5.get_attribute('.ct-orig[data-orig="atividades.0.pctAliqZero"]', 'data-fonte') == 'ponte'
           and 'com alíquota zero de PIS/Cofins nas notas de out/25 a set/26' in texto(q5, '.ct-orig[data-orig="atividades.0.pctAliqZero"]'), 'a venda com alíquota zero vem do CST das notas (60%), com a origem')
        q5.click('#trilha button[data-fase="2"]')
        ok(q5.get_attribute('#fase .ct-m[data-id="piscofins"]', 'data-estado') == 'feita' and 'veio do Domínio pela ponte' in texto(q5, '#fase .ct-m[data-id="piscofins"]'), 'e a missão do PIS/Cofins das vendas vem cumprida pela ponte')
        q5.click('#trilha button[data-fase="1"]')
        # o mês da DRE no seletor: com o lucro da ponte, o número acompanha (até set/26, os 12 meses: R$ 36.000)
        q5.select_option('#f_lucroAte', '2026-09')
        q5.wait_for_function("() => /na DRE de out\\/25 a set\\/26\\./.test(document.querySelector('#fase .ct-m[data-id=\"lucro\"]').textContent)", timeout=3000)
        ok(valor(q5) == '36.000,00' and texto(q5, LU) == 'Domínio, pela ponte: o resultado da contabilidade de out/25 a set/26' and q5.input_value('#f_lucroAte') == '2026-09'
           and 'ela está feita só até jul/26: a DRE usada vai além disso.' in texto(q5, ML), f'trocado o mês pra set/26, o lucro da ponte vai junto: {valor(q5)}, com o aviso de que passa do Controle')
        q5.select_option('#f_lucroAte', '2026-07')
        q5.wait_for_function("() => document.querySelector('#f_lucroContabil').value.replace(/\\s/g, ' ') === '30.000,00'", timeout=3000)
        # o estudo grava o lucro, o período e a origem
        q5.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.cliente_id === 'c7' && r.entrada.entrada.lucroContabil === 30000 && r.entrada.entrada.lucroAte === '2026-07' && r.entrada.origens.lucroContabil.fonte === 'ponte')", timeout=5000)
        ok(True, 'o estudo grava o lucro da ponte, com o período e a origem')
        # digitado por cima: a missão segue cumprida, mostra o do Domínio e oferece usar; o clique traz de volta
        q5.fill('#f_lucroContabil', '45000')
        q5.wait_for_function("() => !!document.querySelector('#fase .ct-m[data-id=\"lucro\"] [data-usar-ponte]')", timeout=3000)
        ml = texto(q5, ML); bt = q5.locator(ML + ' [data-usar-ponte]')
        ok(q5.get_attribute(ML, 'data-estado') == 'feita' and 'Pelo Domínio, o resultado de out/25 a jul/26 é lucro de R$ 30.000.' in ml and bt.inner_text() == 'Usar o do Domínio' and bt.get_attribute('data-usar-ponte') == '2026-07'
           and q5.get_attribute(LU, 'data-fonte') == 'digitado', f'o lucro digitado por cima: a missão mostra o do Domínio, com o "Usar o do Domínio" ({ml[-90:]})')
        bt.click()
        q5.wait_for_function("() => document.querySelector('#f_lucroContabil').value.replace(/\\s/g, ' ') === '30.000,00'", timeout=3000)
        ok(q5.get_attribute(LU, 'data-fonte') == 'ponte' and q5.locator(ML + ' [data-usar-ponte]').count() == 0 and q5.get_attribute(ML, 'data-estado') == 'feita', '"Usar o do Domínio" traz o lucro da ponte de volta, e o botão sai')
        q5.close()
        # o mês com receita e sem lançamento em conta de resultado no Domínio: não entra (nunca lucro zero)
        qs = abrir_v5({ 'linhas': { '2026-09': { 'lanc_resultado': 0, 'resultado_antes_ir': None } } })
        ok(valor(qs) == '30.000,00', 'com setembro sem lançamento de resultado, o lucro até julho entra igual')
        qs.select_option('#f_lucroAte', '2026-09')
        qs.wait_for_function("() => /O Domínio não tem o resultado até set\\/26/.test(document.querySelector('#origLucroAte').textContent)", timeout=3000)
        ok(valor(qs) == '30.000,00' and qs.input_value('#f_lucroAte') == '2026-07' and 'set/26 sem lançamento em conta de resultado' in texto(qs, '#origLucroAte') and 'Pra usar outra DRE, digite o lucro.' in texto(qs, '#origLucroAte'),
           f'o mês sem lançamento não entra: o período fica em jul/26 e a tela diz por quê ({texto(qs, "#origLucroAte")[:80]}…)')
        qs.close()
        qj = abrir_v5({ 'linhas': { '2026-07': { 'lanc_resultado': 0, 'resultado_antes_ir': None } } })
        mj = texto(qj, ML)
        ok(valor(qj) == '' and qj.get_attribute(ML, 'data-estado') == 'aberta' and 'O Domínio não tem lançamento em conta de resultado em jul/26, que o Controle das contabilidades dá como feito' in mj
           and qj.locator(ML + ' [data-usar-ponte]').count() == 0, f'julho feito no Controle e sem lançamento de resultado: o lucro não entra, e a missão diz o mês ({mj[-120:]})')
        qj.close()
        # o estudo gravado sem o lucro: ganha o da ponte ao abrir, e grava de novo
        qg = abrir_v5({ 'estudo': {} }, gravado=True)
        ok(valor(qg) == '30.000,00' and qg.get_attribute(LU, 'data-fonte') == 'ponte' and qg.get_attribute(ML, 'data-estado') == 'feita', 'o estudo gravado sem o lucro abre com o da ponte')
        qg.wait_for_function("() => (window.__mockDb.comparativos || []).some(r => r.id === 'est7' && r.entrada.entrada.lucroContabil === 30000 && r.entrada.origens.lucroContabil.fonte === 'ponte' && r.entrada.entrada.atividades[0].pctAliqZero === 60)", timeout=6000)
        ok(True, 'e grava de novo sozinho, com o lucro e a alíquota zero da ponte')
        qg.close()
        # quem escolheu seguir com a estimativa fica com ela: a missão oferece o do Domínio
        qe = abrir_v5({ 'estudo': { 'origens': { 'lucroContabil': { 'fonte': 'confirmado', 'texto': 'conferido' } } } }, gravado=True)
        me = texto(qe, ML)
        ok(valor(qe) == '' and qe.get_attribute(ML, 'data-estado') == 'feita' and 'pela estimativa' in me and 'O Domínio tem o resultado de out/25 a jul/26 (10 dos 12 meses da receita): lucro de R$ 30.000.' in me
           and qe.locator(ML + ' [data-usar-ponte]').inner_text() == 'Usar o do Domínio', f'seguindo com a estimativa, nada troca sozinho: a missão mostra o do Domínio e oferece ({me[-100:]})')
        qe.click(ML + ' [data-usar-ponte]')
        qe.wait_for_function("() => document.querySelector('#f_lucroContabil').value.replace(/\\s/g, ' ') === '30.000,00'", timeout=3000)
        ok('veio do Domínio pela ponte' in texto(qe, ML) and qe.evaluate("() => !!(document.activeElement && (document.activeElement.closest('#fase .ct-m[data-id=\"lucro\"]') || document.activeElement.id === 'f_lucroContabil'))"),
           'e o clique põe o lucro da ponte no estudo')
        qe.close()
        # o lucro que veio da ponte num dia e hoje o Domínio mostra outro no mesmo período: a missão reabre
        qv = abrir_v5({ 'estudo': { 'entrada': { 'lucroContabil': 25000, 'lucroDe': '2025-10', 'lucroAte': '2026-07', 'lucroReceita': 500000 },
            'origens': { 'lucroContabil': { 'fonte': 'ponte', 'texto': 'Domínio, pela ponte: o resultado da contabilidade de out/25 a jul/26' } } } }, gravado=True)
        mv = texto(qv, ML)
        ok(valor(qv) == '25.000,00' and qv.get_attribute(ML, 'data-estado') == 'aberta' and 'O Domínio mudou desde que o lucro entrou no estudo: de out/25 a jul/26, hoje ele mostra lucro de R$ 30.000.' in mv
           and qv.locator(ML + ' [data-usar-ponte]').inner_text() == 'Atualizar pelo Domínio', f'o lucro da ponte que ficou velho não troca sozinho: a missão reabre com o "Atualizar pelo Domínio" ({mv[-110:]})')
        qv.click(ML + ' [data-usar-ponte]')
        qv.wait_for_function("() => { const m = document.querySelector('#fase .ct-m[data-id=\"lucro\"]'); return m && m.dataset.estado === 'feita'; }", timeout=3000)
        ok(valor(qv) == '30.000,00' and qv.locator(ML + ' [data-usar-ponte]').count() == 0, '"Atualizar pelo Domínio" põe o número de hoje e a missão fecha de novo')
        qv.close()

        ok(not erros, 'nenhum erro de JavaScript' + ('' if not erros else ': ' + ' | '.join(erros[:3])))
        b.close()
    srv.shutdown()
    print('\n' + ('tudo certo' if not falhas else f'{falhas} falha(s)'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
