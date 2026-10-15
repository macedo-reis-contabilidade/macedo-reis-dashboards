// ============================================================
// MACEDO & REIS — Reforma Tributária · confiança dos números (13/10/2026)
// Para cada número que entra na simulação: de onde veio, em que período foi medido, quanto dá pra confiar nele e por
// que não é verdade absoluta. E a pergunta que decide: dentro do que é plausível para esse número, o resultado muda?
//   · dado da empresa com confiança baixa (ou não medido) que muda o resultado → SEM CONCLUSÃO: o sistema não recomenda
//     e diz o que falta levantar;
//   · dado com confiança média que muda o resultado → A CONFIRMAR;
//   · premissa da lei (alíquota da CBS, crédito de estoque, enquadramento) → aparece na tabela com o efeito; a conclusão
//     segue a regra de sempre da análise (tendência a confirmar).
// Origem: um cliente recém-chegado (13/10/2026) — entradas e saídas só de setembro, faturamento até agosto: a ficha calculou com
// 0% de compras e 90% de PJ deduzido e mostrou "MANTENHA" como se os números fossem medidos.
// A procedência de cada campo vem da importação (consolidar, em dominio-relatorios.js, e as notas) e vai gravada com a
// simulação; nas simulações gravadas antes disso, é deduzida do resumo do Domínio (inferirProcedencia).
// Usado pela ficha (fiscal-reforma.html), pela análise técnica e pelo relatório do cliente (rt-analise.js).
// Módulo ES puro, sem DOM — testes em tests/rt-confianca.test.mjs.
// ============================================================

import { simular } from './rt-motor.js';
import { rotuloMeses, listaMeses, perfilAtividade, cnaeMaisCompleto, reducaoServicoPorCnae, ramoComZero, ramoComReducao } from './dominio-relatorios.js';

const p1 = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brl0 = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nMeses = n => n + (n === 1 ? ' mês' : ' meses');
const p2 = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const limita = v => Math.max(0, Math.min(100, v));

// o que cada resultado manda fazer — o mesmo critério da ficha (decisaoDe)
export const decisaoDe = r => r.veredito.tipo === 'OPTE' ? 'fora' : r.veredito.tipo === 'OPTE_SE' ? 'se' : 'manter';
export const ROT_DECISAO = { fora: 'optar por fora', se: 'opte, se o comercial confirmar', manter: 'manter dentro do DAS' };
export const SELO_NIVEL = { alta: 'alta', media: 'média', baixa: 'baixa', nao_medido: 'não medido' };

// nível pelo número de meses medidos: um ano é o ideal; menos de 3 meses é amostra
function nivelPorMeses(n) { return n == null ? 'media' : n >= 6 ? 'alta' : n >= 3 ? 'media' : 'baixa'; }
const ORDEM = { alta: 0, media: 1, baixa: 2, nao_medido: 3 };
const pior = (a, b) => ORDEM[a] >= ORDEM[b] ? a : b;
const nMed = pc => pc && pc.meses && pc.meses.length ? pc.meses.length : null;
const periodoDe = pc => {
  if (pc && pc.meses && pc.meses.length) { const r = rotuloMeses(pc.meses); return /\(\d+ meses\)$/.test(r) ? r.replace(/ \((\d+ meses)\)$/, ', $1') : r + ', ' + nMeses(pc.meses.length); }
  return pc && pc.periodo ? pc.periodo : '—';
};

// simulação gravada antes de 13/10/2026, número sem resumo do Domínio que explique de onde veio
const ORIGEM_LEGADO = 'Simulação anterior — origem não registrada';
// os meses entre parênteses numa frase que já diz quantos são: "set/25–ago/26" (seguidos), "set/25–out/25 e jun/26–ago/26"
// (em trechos) — nunca "set/25–ago/26 (11 meses)" dentro de "Medido em 11 meses (…)"
const faixaMeses = l => listaMeses(l || []);

// O RELATÓRIO DO CLIENTE (13/10/2026): o que falta, nas palavras do cliente — o nome do relatório do Domínio, a planilha
// XLS e a consulta de CNPJ são do escritório. A simulação antiga também: pro cliente é "levantamento anterior"
const FALTA_CLIENTE = {
  'o relatório de faturamento dos últimos 12 meses': 'o faturamento dos últimos 12 meses',
  'o PGDAS do último mês': 'a apuração do Simples (PGDAS) do último mês',
  'o relatório de entradas do mesmo período do faturamento': 'as notas de compra (entradas) do mesmo período do faturamento',
  'as entradas dos outros meses do faturamento (acompanhamento de entradas ou XML de entrada)': 'as notas de compra (entradas) dos outros meses',
  'o acompanhamento de entradas (Domínio) do período do faturamento': 'as notas de compra (entradas) do período',
  'a confirmação dos meses sem nota de entrada': 'a confirmação dos meses em que a empresa não teve compra',
  'as saídas dos outros meses (acompanhamento de saídas em XLS ou notas de venda)': 'as vendas dos outros meses',
  'as saídas dos outros meses': 'as vendas dos outros meses',
  'o regime tributário dos maiores clientes (consulta de CNPJ)': 'quais dos maiores clientes empresa são do Simples',
  'o acompanhamento de saídas em XLS (traz o CNPJ dos clientes) ou as notas de venda (XML)': 'a relação das vendas com o CNPJ de cada cliente (ou as notas de venda)',
  'o acompanhamento de saídas em XLS (traz o CNPJ dos clientes)': 'a relação das vendas com o CNPJ de cada cliente',
  'as notas de venda (XML ou ZIP) pra medir pelo NCM': 'as notas de venda (pra ver quais produtos têm redução)',
  'as notas de venda (XML ou ZIP)': 'as notas de venda',
  'a revisão do NCM das compras nos maiores fornecedores': 'a revisão da classificação (NCM) das compras dos maiores fornecedores',
  'o enquadramento do transporte de passageiros (urbano, metropolitano, intermunicipal ou interestadual)': 'como é o transporte de passageiros: linha aberta ao público, com itinerário e tarifa fixados pelo poder público (dentro da cidade, entre cidades vizinhas ou na região metropolitana), linha entre cidades ou fretamento',
  'o enquadramento do transporte de passageiros (linha regular sob autorização, permissão ou concessão · urbano, semiurbano, metropolitano, intermunicipal ou interestadual)': 'como é o transporte de passageiros: linha aberta ao público, com itinerário e tarifa fixados pelo poder público (dentro da cidade, entre cidades vizinhas ou na região metropolitana), linha entre cidades ou fretamento',
  'o alcance do art. 286 da LC 214 no fretamento intermunicipal': 'como a lei se aplica ao fretamento entre cidades',
  'os requisitos do art. 127 da LC 214 (contrato social e registro dos sócios no conselho)': 'o contrato social e o registro dos sócios no conselho profissional (CRC, OAB, CREA, CRMV…)',
  'o registro no conselho de educação física e o enquadramento da aula na NBS 1.2205.12.00': 'o registro da empresa no conselho de educação física (CREF) e a descrição das aulas',
  'o enquadramento do serviço na lista de redução da LC 214 (NBS)': 'a relação dos serviços que a empresa presta (pra conferir na lista de serviços com redução)',
  'as notas de compra (XML de entrada) dos fornecedores do regime normal': 'as notas de compra (os arquivos XML das notas fiscais de entrada)',
  'as notas de compra (XML de entrada) dos outros meses': 'as notas de compra dos outros meses (os arquivos XML das notas fiscais de entrada)',
  'o imposto embutido no serviço tomado (o ISS da nota) — informe na ficha o % de todas as compras': 'o ISS das notas dos serviços que a empresa contrata'
};
// o que falta, nas palavras do cliente (o comunicado lê o resumo gravado, que nas simulações gravadas antes desta tradução
// só tem o texto do escritório)
export const faltaParaCliente = t => FALTA_CLIENTE[t] || t;
const FONTE_LEGADO_CLIENTE = 'Levantamento anterior do escritório';
const MOTIVO_LEGADO_CLIENTE = 'Número de um levantamento anterior do escritório, que vamos confirmar com os relatórios atualizados.';

const PERFIL_PJ = {
  industria: { texto: 'indústria vende essencialmente a empresas', de: 30, ate: 100 },
  refeicao_empresas: { texto: 'refeições preparadas para empresas (CNAE 5620-1/01)', de: 30, ate: 100 },
  industrializacao: { texto: 'industrialização por encomenda é sempre para empresa', de: 50, ate: 100 },
  alimentacao: { texto: 'bar e restaurante vende a consumidor final', de: 0, ate: 30 },
  varejo: { texto: 'varejo vende a consumidor final', de: 0, ate: 30 }
};

// ---------- itens ----------
// cada item: { chave, rotulo, valor, fonte, periodo, nivel, motivo, falta, categoria ('dado' | 'premissa'),
//              variantes: [{ rotulo, ent, valor }] (o plausível a testar), bissecao: { atual, ent(v), fmt(v) } }

function itemReceita(ent, pc) {
  pc = pc || {};
  const base = { chave: 'receita', rotulo: 'Receita mensal', curto: 'receita', valor: brl0(ent.receita) + '/mês', categoria: 'dado', periodo: periodoDe(pc) };
  const n = nMed(pc);
  let it;
  if (pc.fonte === 'faturamento' || pc.fonte === 'saidas' || pc.fonte === 'notas') {
    const nivel = nivelPorMeses(n);
    const fonte = pc.fonte === 'faturamento' ? 'Relatório de faturamento (Domínio)' : pc.fonte === 'saidas' ? 'Acompanhamento de saídas' + (pc.servicos ? ' e de serviços' : '') + ' (Domínio)' : 'Notas fiscais emitidas (XML)';
    it = { ...base, fonte, nivel,
      motivo: (n == null ? 'Média do período do relatório' : nivel === 'alta' ? 'Média de ' + nMeses(n) : 'Média de ' + nMeses(n) + ' só: um mês fora do normal pesa na média')
        + (pc.fonte === 'saidas' && !pc.servicos ? '; só as saídas de mercadoria — se houver serviço, a receita está incompleta' : '') + '. É o histórico: 2027 pode ser diferente.',
      falta: nivel === 'alta' ? null : 'o relatório de faturamento dos últimos 12 meses' };
  } else if (pc.fonte === 'pgdas') {
    it = { ...base, fonte: 'Apuração do Simples (PGDAS)', nivel: 'baixa', motivo: 'Receita de um mês só (a do PGDAS), não uma média: um mês fora do normal vira a receita do ano.', falta: 'o relatório de faturamento dos últimos 12 meses' };
  } else {
    it = { ...base, fonte: pc.legado ? ORIGEM_LEGADO : 'Informada, sem relatório', nivel: 'media',
      motivo: pc.legado ? 'A origem da receita não ficou registrada na simulação.' : 'Valor informado, sem relatório que comprove.', falta: 'o relatório de faturamento dos últimos 12 meses' };
  }
  const f = it.nivel === 'baixa' ? 0.3 : it.nivel === 'media' ? 0.2 : 0;
  if (f && ent.receita > 0) {
    const r = v => ({ ...ent, receita: v });
    it.variantes = [{ rotulo: brl0(ent.receita * (1 - f)) + '/mês', ent: r(ent.receita * (1 - f)), valor: ent.receita * (1 - f) },
                    { rotulo: brl0(ent.receita * (1 + f)) + '/mês', ent: r(ent.receita * (1 + f)), valor: ent.receita * (1 + f) }];
    it.bissecao = { atual: ent.receita, ent: r, fmt: v => brl0(v) + '/mês' };
  }
  return it;
}

function itemSimples(ent, proc) {
  const pg = ['rbt12', 'anexo'].map(k => proc[k]).find(x => x && x.fonte === 'pgdas');
  const manuais = { rbt12: 'RBT12', anexo: 'anexo', aliqEfetiva: 'alíquota efetiva', partilha: 'partilha CBS/IBS', pctExcluidoST: '% excluído do DAS', pctReceitaMonofasica: '% monofásico' };
  const digitados = Object.keys(manuais).filter(k => proc[k] && proc[k].fonte === 'manual').map(k => manuais[k]);
  const semFonte = ['rbt12', 'anexo'].filter(k => !proc[k] || proc[k].fonte === 'vazio' || proc[k].fonte === 'manual');
  const nivel = pg && !digitados.length ? 'alta' : 'media';
  const legado = !pg && ['rbt12', 'anexo'].some(k => proc[k] && proc[k].legado);
  return { chave: 'simples', rotulo: 'Apuração do Simples de hoje (RBT12, anexo, alíquota, partilha)', curto: 'apuração do Simples', categoria: 'dado',
    valor: 'RBT12 ' + brl0(ent.rbt12) + ' · Anexo ' + (ent.anexo || '—'),
    fonte: pg ? 'Apuração do Simples (PGDAS)' : legado ? ORIGEM_LEGADO : 'Informada, sem o PGDAS', periodo: pg && pg.meses ? 'PGDAS de ' + rotuloMeses(pg.meses) : '—', nivel,
    motivo: nivel === 'alta' ? 'Declarado na apuração do Simples.' : (legado ? 'Sem o PGDAS no resumo da simulação, a origem não ficou registrada' : digitados.length ? 'Informado sem relatório: ' + digitados.join(', ') : semFonte.length ? 'Sem o PGDAS anexado' : 'Parte informada sem relatório') + ' — conferir com o PGDAS.',
    falta: nivel === 'alta' ? null : 'o PGDAS do último mês' };
}

function itemCompras(ent, proc, ctx) {
  const pm = proc.pctMerc || {}, pd = proc.pctDesp || {};
  const m0 = +ent.pctComprasMercadorias || 0, d0 = +ent.pctComprasDespesas || 0, t0 = m0 + d0;
  const it = { chave: 'compras', rotulo: 'Compras com crédito (% da receita)', curto: 'compras com crédito', categoria: 'dado',
    valor: p1(m0) + '% mercadorias + ' + p1(d0) + '% despesas = ' + p1(t0) + '%', periodo: periodoDe(pm) };
  // a fonte mais forte das duas (medida > informada > vazia): o "vazio" de uma não apaga o informado na outra
  const FORCA = { entradas: 3, notas: 3, manual: 2, vazio: 0 };
  const forte = (FORCA[pd.fonte] || 0) > (FORCA[pm.fonte] || 0) ? pd : pm;
  const f = forte.fonte;
  const pmx = forte;
  it.periodo = periodoDe(pmx);
  const nM = nMed(pmx);
  let faixa = null;
  if (f === 'entradas' || f === 'notas') {
    it.fonte = (f === 'entradas' ? 'Acompanhamento de entradas (Domínio)' : 'Notas fiscais de entrada (XML)')
      + (pmx.receitaDe && pmx.receitaDe.length ? ' ÷ receita do mesmo período (' + pmx.receitaDe.join(', ') + ')' : '')
      + ([pm, pd].some(x => x.fonte === 'manual') ? '; parte informada sem relatório' : '');
    if (pmx.legado) {
      it.nivel = 'media';
      it.motivo = 'O período das compras usadas na conta não ficou registrado: se o relatório de entradas cobria menos meses que o faturamento, o % saiu menor que o real.';
      it.motivoCliente = 'Número de um levantamento anterior do escritório: se as compras de algum mês ficaram de fora, o % real é maior — vamos confirmar com os relatórios atualizados.';
      it.falta = 'o relatório de entradas do mesmo período do faturamento';
    } else {
      it.nivel = nivelPorMeses(nM);
      const rot = pmx.meses && pmx.meses.length ? faixaMeses(pmx.meses) : '';
      it.motivo = it.nivel === 'baixa'
        ? 'Medido em ' + (nM === 1 ? 'um mês só' : 'dois meses') + ' (' + rot + '): uma compra grande, ou um mês sem compra, muda muito o %.' + (pmx.mesesFaturamento > nM ? ' O faturamento cobre ' + nMeses(pmx.mesesFaturamento) + ' — faltam as entradas dos outros meses.' : '')
        : it.nivel === 'media' ? 'Medido em ' + nMeses(nM) + ' (' + rot + '): menos que um ano — sazonalidade e estoque pesam.'
        : 'Medido em ' + nMeses(nM) + ' (' + rot + ').';
      it.falta = it.nivel === 'alta' ? null : 'as entradas dos outros meses do faturamento (acompanhamento de entradas ou XML de entrada)';
    }
    if (!pmx.regimeFornecedores && t0 > 0) it.motivo += ' Regime dos fornecedores não consultado: fornecedor do Simples dá só parte do crédito.';
    // legado: o erro possível é um só — entradas de menos meses que o faturamento deixam o % MENOR que o real; a faixa só sobe
    if (pmx.legado) faixa = { de: t0, ate: limita(Math.max(t0 * 1.5, t0 + 5)) };
    else if (it.nivel !== 'alta') faixa = it.nivel === 'baixa' ? { fd: 0.5, fa: 1.5, pts: 5 } : { fd: 0.75, fa: 1.25, pts: 3 };
    // MESES EM DÚVIDA (consolidar): o relatório cobre meses sem nota nenhuma, sem as saídas pra dizer se a escrita existia —
    // ficaram fora; se foram meses sem compra, o % é outro (menor): no máximo média, e a faixa vai até ele
    if (!pmx.legado && pmx.mesesIncertos && pmx.mesesIncertos.length && pmx.pctSeZero != null && pmx.pctSeZero < t0 - 0.05) {
      it.nivel = pior(it.nivel, 'media');
      it.motivo += ' O relatório também cobre ' + (pmx.mesesIncertos.length === 1 ? 'um mês' : nMeses(pmx.mesesIncertos.length)) + ' sem nota nenhuma (' + faixaMeses(pmx.mesesIncertos) + '), que ' + (pmx.mesesIncertos.length === 1 ? 'ficou' : 'ficaram') + ' fora: se ' + (pmx.mesesIncertos.length === 1 ? 'foi mês' : 'foram meses') + ' sem compra, o % seria ' + p1(pmx.pctSeZero) + '%.';
      it.falta = it.falta || 'a confirmação dos meses sem nota de entrada';
      const fx = faixa || { fd: 0.75, fa: 1.25, pts: 3 };
      faixa = { de: limita(Math.min(pmx.pctSeZero, fx.de != null ? fx.de : Math.min(t0 * fx.fd, t0 - fx.pts))), ate: fx.ate != null ? fx.ate : limita(Math.max(t0 * fx.fa, t0 + fx.pts)) };
    }
    // uma parte medida e a outra informada à mão (ex.: mercadorias do relatório, despesas digitadas): no máximo média
    const parteManual = [[pm, m0, 'mercadorias'], [pd, d0, 'despesas']].filter(([x, v]) => x.fonte === 'manual' && v > 0).map(x => x[2]);
    if (parteManual.length) {
      it.nivel = pior(it.nivel, 'media');
      it.motivo += ' As ' + parteManual.join(' e as ') + ' foram informadas sem relatório.';
      it.falta = it.falta || 'o acompanhamento de entradas (Domínio) do período do faturamento';
      if (!faixa) faixa = { fd: 0.75, fa: 1.25, pts: 3 };
    }
  } else if (f === 'manual') {
    it.fonte = pmx.legado ? ORIGEM_LEGADO : 'Informado, sem relatório'; it.nivel = 'media';
    it.motivo = pmx.legado ? 'A origem das compras não ficou registrada na simulação.' : 'Valor informado, sem relatório que comprove.';
    it.falta = 'o acompanhamento de entradas (Domínio) do período do faturamento';
    faixa = { fd: 0.75, fa: 1.25, pts: 3 };
  } else {
    it.fonte = 'Não medido'; it.nivel = 'nao_medido'; it.periodo = '—';
    it.motivo = 'Sem o relatório de entradas, a conta considera ' + p1(t0) + '% de compras' + (t0 === 0 ? ' — nenhum crédito na entrada, o que deixa o "por fora" mais caro do que pode ser.' : '.');
    it.falta = 'o acompanhamento de entradas (Domínio) do período do faturamento';
    faixa = { de: 0, ate: ctx.vendeMercadoria ? 60 : 20 };
  }
  if (faixa) {
    // muda o total e reparte entre mercadorias e despesas na proporção de hoje (sem compra hoje: mercadoria se vende
    // mercadoria, despesa se é serviço)
    const repartir = t => t0 > 0 ? { pctComprasMercadorias: t * m0 / t0, pctComprasDespesas: t * d0 / t0 }
      : ctx.vendeMercadoria ? { pctComprasMercadorias: t, pctComprasDespesas: 0 } : { pctComprasMercadorias: 0, pctComprasDespesas: t };
    const e = t => ({ ...ent, ...repartir(t) });
    const lo = faixa.de != null ? faixa.de : limita(Math.min(t0 * faixa.fd, t0 - faixa.pts));
    const hi = faixa.ate != null ? faixa.ate : limita(Math.max(t0 * faixa.fa, t0 + faixa.pts));
    it.variantes = [lo, hi].filter((v, i, a) => Math.abs(v - t0) > 0.05 && a.indexOf(v) === i).map(v => ({ rotulo: p1(v) + '% da receita', ent: e(v), valor: v }));
    it.bissecao = { atual: t0, ent: e, fmt: v => p1(v) + '% da receita' };
  }
  return it;
}

function itemPJ(ent, proc, ctx) {
  const pc = proc.pctPJ || {};
  const v0 = +ent.pctPJ || 0;
  const it = { chave: 'pj', rotulo: 'Vendas a clientes que aproveitam o crédito', curto: 'vendas a clientes que aproveitam o crédito', categoria: 'dado', valor: p1(v0) + '% da receita', periodo: periodoDe(pc) };
  let lo = null, hi = null;
  if (pc.fonte === 'saidas' || pc.fonte === 'notas') {
    const n = nMed(pc);
    it.fonte = pc.fonte === 'saidas' ? 'Acompanhamento de saídas (Domínio)' : 'Notas fiscais de venda (XML)';
    let nivel = pc.legado && n == null ? (pc.cobertura != null && pc.cobertura >= 90 ? 'alta' : 'media') : nivelPorMeses(n);
    const ress = [];
    if (nivel === 'baixa') ress.push('Medido nas vendas de ' + (n === 1 ? 'um mês só' : 'dois meses') + ': um pedido grande, ou um cliente que não comprou no mês, muda o %.');
    else if (nivel === 'media' && n != null) ress.push('Medido em ' + nMeses(n) + ', menos que um ano.');
    if (pc.fonte === 'saidas' && pc.porDocumento === false) { nivel = pior(nivel, 'media'); ress.push('Cliente empresa reconhecido pelo nome (o relatório em PDF não traz o CNPJ).'); }
    if (!pc.regimeConsultado && v0 > 0) { nivel = pior(nivel, 'media'); ress.push('Conta todas as empresas; as do Simples não aproveitam o crédito — o % de quem aproveita pode ser menor.'); }
    it.nivel = nivel;
    it.motivo = ress.length ? ress.join(' ') : 'Medido em ' + (n != null ? nMeses(n) : 'todo o período') + ', pelo CNPJ dos clientes, com o regime de cada um consultado.';
    it.falta = nivel === 'baixa' ? 'as saídas dos outros meses (acompanhamento de saídas em XLS ou notas de venda)' : !pc.regimeConsultado ? 'o regime tributário dos maiores clientes (consulta de CNPJ)' : nivel === 'media' ? 'as saídas dos outros meses' : null;
    // a faixa do plausível: a amostra (poucos meses) e o reconhecimento pelo nome mexem pros dois lados; o regime não
    // consultado só pra baixo (cliente do Simples não aproveita o crédito)
    const amostra = n == null ? (pc.legado && pc.cobertura != null && pc.cobertura >= 90 ? 0 : Math.max(5, v0 * 0.15)) : n >= 6 ? 0 : n >= 3 ? Math.max(5, v0 * 0.15) : Math.max(10, v0 * 0.25);
    const nome = pc.fonte === 'saidas' && pc.porDocumento === false ? Math.max(5, v0 * 0.15) : 0;
    const d = Math.max(amostra, nome);
    lo = limita(v0 - d); hi = limita(v0 + d);
    if (!pc.regimeConsultado) lo = Math.min(lo, limita(v0 * 0.6));
  } else if (pc.fonte === 'deduzido') {
    const pf = PERFIL_PJ[pc.perfil] || { texto: String(pc.texto || 'pelo tipo de atividade').replace(/^deduzido:\s*/, '').replace(/\s*—.*$/, ''), de: Math.max(0, v0 - 50), ate: Math.min(100, v0 + 50) };
    it.fonte = 'Deduzido pelo tipo de atividade'; it.nivel = 'nao_medido'; it.selo = 'deduzido'; it.periodo = '—';
    it.motivo = 'Não medido: o sistema supôs ' + p1(v0) + '% porque ' + pf.texto + '. Não há a lista de clientes com CNPJ.';
    it.falta = 'o acompanhamento de saídas em XLS (traz o CNPJ dos clientes) ou as notas de venda (XML)';
    lo = pf.de; hi = pf.ate;
  } else if (pc.fonte === 'manual') {
    it.fonte = pc.legado ? ORIGEM_LEGADO : 'Informado, sem relatório'; it.nivel = 'media';
    it.motivo = pc.legado ? 'Não ficou registrado se o % veio das saídas, das notas de venda ou foi informado na ficha.' : 'Valor informado, sem relatório que comprove.';
    it.falta = 'o acompanhamento de saídas em XLS (traz o CNPJ dos clientes)';
    lo = limita(v0 - Math.max(10, v0 * 0.2)); hi = limita(v0 + Math.max(10, v0 * 0.2));
  } else {
    it.fonte = 'Não informado'; it.nivel = 'nao_medido'; it.periodo = '—';
    it.motivo = 'Ninguém mediu nem informou: a conta considera ' + p1(v0) + '%.';
    it.falta = 'o acompanhamento de saídas em XLS (traz o CNPJ dos clientes) ou as notas de venda (XML)';
    lo = 0; hi = 100;
  }
  if (lo != null) {
    const e = v => ({ ...ent, pctPJ: v });
    it.variantes = [lo, hi].filter((v, i, a) => Math.abs(v - v0) > 0.05 && a.indexOf(v) === i).map(v => ({ rotulo: p1(v) + '% da receita', ent: e(v), valor: v }));
    it.bissecao = { atual: v0, ent: e, fmt: v => p1(v) + '% da receita' };
  }
  return it;
}

function textoMix(ent) {
  const partes = [];
  if ((ent.mixCheia || 0) > 0) partes.push(p1(ent.mixCheia) + '% cheia');
  if ((ent.mixRed60 || 0) > 0) partes.push(p1(ent.mixRed60) + '% com −60%');
  if ((ent.mixRed40 || 0) > 0) partes.push(p1(ent.mixRed40) + '% com −40%');
  if ((ent.mixRed30 || 0) > 0) partes.push(p1(ent.mixRed30) + '% com −30%');
  if ((ent.mixZero || 0) > 0) partes.push(p1(ent.mixZero) + '% alíquota zero');
  return partes.join(' · ') || '—';
}

// o mix inteiro numa faixa só (o resto zerado) — as variantes do enquadramento
const SEM_MIX = { mixCheia: 0, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0 };
const mixSo = (faixa, extra) => ({ ...SEM_MIX, [faixa]: 100, ...(extra || {}) });
const ehSo = (ent, faixa) => (+ent[faixa] || 0) >= 99;

// SERVIÇO COM REDUÇÃO (13/10/2026, Módulo 07): o texto de cada candidato — a ficha usa no aviso da importação, a confiança
// no motivo. rs vem de reducaoServicoPorCnae (dominio-relatorios.js)
export function textoReducaoServico(rs) {
  if (!rs) return '';
  if (rs.tipo === 'profissao') return 'Serviço de ' + rs.quem + ': tem redução de 30% por fora se a sociedade cumprir os cinco requisitos do art. 127 da LC 214 — sócios habilitados e fiscalizados pelo conselho, nenhum sócio pessoa jurídica, não ser sócia de outra pessoa jurídica, nada fora das habilitações dos sócios e o serviço prestado pelos sócios.';
  if (rs.tipo === 'desporto') return (rs.ramo === 'academia' ? 'Academia' : 'Ensino de esportes') + ': tem redução de 30% por fora se a pessoa jurídica for registrada no conselho de educação física (LC 214, art. 127, §3º — sem os requisitos da sociedade), e de 60% se a aula for a educação desportiva da NBS 1.2205.12.00 (art. 141, I) — vale a maior.';
  if (rs.tipo === 'agro') return rs.ramo === 'veterinária'
    ? 'Veterinária: o atendimento a animais de produção tem redução de 60% por fora, sem os requisitos da sociedade (serviços veterinários para produção animal, ' + String(rs.anexo).split(' (')[0] + ', item 24, art. 138); o de animais de estimação tem 30% só se a sociedade cumprir os requisitos do art. 127 — vale a maior.'
    : 'Serviço de ' + rs.ramo + ': os serviços agronômicos e de técnico agrícola da lista do ' + String(rs.anexo).split(' (')[0] + ' (itens 22 e 23, art. 138) têm redução de 60% por fora, sem os requisitos da sociedade; fora da lista, 30% se a sociedade cumprir os requisitos do art. 127 — vale a maior.';
  return 'Serviço de ' + rs.ramo + ': tem redução de 60% por fora se estiver na lista do ' + rs.anexo + ' — confira cada serviço na lista, por código da NBS.';
}
const FALTA_SERVICO = {
  profissao: ['os requisitos do art. 127 da LC 214 (contrato social e registro dos sócios no conselho)', 'o contrato social e o registro dos sócios no conselho profissional (CRC, OAB, CREA, CRMV…)'],
  desporto: ['o registro no conselho de educação física e o enquadramento da aula na NBS 1.2205.12.00', 'o registro da empresa no conselho de educação física (CREF) e a descrição das aulas'],
  anexo: ['o enquadramento do serviço na lista de redução da LC 214 (NBS)', 'a relação dos serviços que a empresa presta (pra conferir na lista de serviços com redução)']
};
// agronomia e veterinária (15/10/2026, checagem oficial): o −60% do Anexo IX sem os requisitos da sociedade e o −30% do
// art. 127 com eles — vale a maior
const FALTA_AGRO = {
  agronomia: ['o enquadramento dos serviços no Anexo IX da LC 214 (serviços agronômicos, NBS 1.1410.90.00) e, fora dele, os requisitos do art. 127', 'a relação dos serviços que a empresa presta e o contrato social, com o registro dos sócios no conselho (CREA)'],
  'veterinária': ['quanto da receita é atendimento a animais de produção (Anexo IX da LC 214, item 24) e, no resto, os requisitos do art. 127', 'quanto do faturamento vem do atendimento a animais de produção (gado, aves, suínos) e quanto de animais de estimação, e o contrato social, com o registro dos sócios no conselho (CRMV)']
};
const FALTA_PASSAGEIROS = 'o enquadramento do transporte de passageiros (linha regular sob autorização, permissão ou concessão · urbano, semiurbano, metropolitano, intermunicipal ou interestadual)';

function itemMixServico(ent, pc, rs, it, cheio) {
  // as profissões do art. 127, o desporto, a agronomia e a veterinária: os requisitos são da empresa (contrato social,
  // conselho, quanto é animal de produção) — dado; a lista de NBS dos Anexos II, III, IX e X é da lei — premissa (como o
  // enquadramento da refeição por contrato, art. 273)
  it.categoria = rs.tipo === 'anexo' ? 'premissa' : 'dado';
  it.periodo = '—';
  const comReducao = rs.faixas.some(f => (+ent[f] || 0) > 0);
  const informado = pc.fonte === 'manual' && !pc.legado;
  if (informado || pc.legado) {
    it.fonte = pc.legado ? ORIGEM_LEGADO : 'Informado, sem relatório'; it.nivel = 'media';
  } else {
    // padrão (tudo cheio, ninguém conferiu) ou das notas — a nota de serviço não mostra a redução do serviço
    it.fonte = pc.fonte === 'notas' ? 'Notas de venda — a nota de serviço não mostra a redução' : rs.tipo === 'profissao' ? 'Assumido tudo à alíquota cheia — os requisitos do art. 127 não foram conferidos' : 'Assumido tudo à alíquota cheia — enquadramento a conferir';
    it.nivel = 'baixa';
  }
  it.selo = 'a conferir';
  it.motivo = textoReducaoServico(rs) + (cheio ? ' A conta considera tudo à alíquota cheia.' : comReducao ? ' A conta usa a redução informada.' : ' A conta usa o mix informado.');
  const vet = rs.tipo === 'agro' && rs.ramo === 'veterinária';
  it.motivoCliente = (rs.tipo === 'anexo' ? 'Serviço de ' + rs.ramo + ' pode ter redução de 60% por fora, conforme a lista da lei' : rs.tipo === 'desporto' ? 'A aula de esporte pode ter redução de 30% ou de 60% por fora, conforme o registro no conselho e a lista da lei'
    : vet ? 'Serviço veterinário pode ter redução de 60% por fora no atendimento a animais de produção e de 30% no de animais de estimação, se a sociedade cumprir os requisitos da lei'
    : rs.tipo === 'agro' ? 'Serviço agronômico pode ter redução de 60% por fora, conforme a lista da lei, ou de 30%, se a sociedade cumprir os requisitos da lei'
    : 'Serviço de profissão regulamentada pode ter redução de 30% por fora, se a sociedade cumprir os requisitos da lei') + ' — ainda não conferido.';
  [it.falta, it.faltaCliente] = rs.tipo === 'agro' ? (FALTA_AGRO[rs.ramo] || FALTA_AGRO.agronomia) : FALTA_SERVICO[rs.tipo];
  // o plausível: tudo cheio (sem os requisitos, ou o serviço fora da lista) e cada redução possível na receita toda —
  // menos o que já está na conta. Na academia, o −30% depende do registro no conselho (dado da empresa) e o −60%, de a aula
  // ser a educação desportiva da NBS 1.2205.12.00 (questão da lei): se só o −60% muda o resultado, o item vira premissa
  const rot = f => f === 'mixRed30'
    ? (rs.tipo === 'desporto' ? 'toda a receita com −30% (academia registrada no conselho, art. 127, §3º)' : 'toda a receita com −30% (se a sociedade cumprir os requisitos do art. 127)')
    : (rs.tipo === 'desporto' ? 'toda a receita com −60% (aula na NBS 1.2205.12.00, art. 141, I)' : vet ? 'toda a receita com −60% (atendimento a animais de produção, Anexo IX, art. 138)' : 'toda a receita com −60% (se o serviço estiver no ' + String(rs.anexo || 'anexo').split(' (')[0] + ')');
  const rotCli = f => f === 'mixRed30'
    ? (rs.tipo === 'desporto' ? 'desconto de 30% em toda a receita (empresa registrada no conselho de educação física)' : 'desconto de 30% em toda a receita (se a sociedade cumprir os requisitos da lei)')
    : (rs.tipo === 'desporto' ? 'desconto de 60% em toda a receita (se a aula estiver na lista da lei)' : vet ? 'desconto de 60% em toda a receita (atendimento a animais de produção)' : 'desconto de 60% em toda a receita (se o serviço estiver na lista da lei)');
  const cand = [];
  if (!cheio) cand.push({ rotulo: rs.tipo === 'profissao' ? 'tudo à alíquota cheia (se a sociedade não cumprir os requisitos do art. 127)' : rs.tipo === 'desporto' ? 'tudo à alíquota cheia (sem o registro no conselho e fora da educação desportiva)'
      : vet ? 'tudo à alíquota cheia (animais de estimação, sem os requisitos do art. 127)' : rs.tipo === 'agro' ? 'tudo à alíquota cheia (fora da lista do Anexo IX e sem os requisitos do art. 127)' : 'tudo à alíquota cheia (se o serviço não estiver na lista)',
    rotuloCliente: rs.tipo === 'profissao' ? 'o imposto cheio em toda a receita (se a sociedade não cumprir os requisitos da lei)' : rs.tipo === 'desporto' ? 'o imposto cheio em toda a receita (sem o registro no conselho)'
      : vet ? 'o imposto cheio em toda a receita (animais de estimação, sem os requisitos da sociedade)' : rs.tipo === 'agro' ? 'o imposto cheio em toda a receita (fora da lista da lei e sem os requisitos da sociedade)' : 'o imposto cheio em toda a receita (se o serviço não estiver na lista da lei)',
    ent: { ...ent, ...mixSo('mixCheia') } });
  // o −60% que é questão da lei (a aula de academia na NBS, o serviço agronômico na lista do Anexo IX) é premissa; o da
  // veterinária depende de quanto é animal de produção — dado da empresa
  const premissa = f => f === 'mixRed60' && (rs.tipo === 'desporto' || (rs.tipo === 'agro' && !!rs.premissa60));
  rs.faixas.filter(f => !ehSo(ent, f)).forEach(f => cand.push({ rotulo: rot(f), rotuloCliente: rotCli(f), premissa: premissa(f), ent: { ...ent, ...mixSo(f) } }));
  it.variantes = cand;
  return it;
}

function itemMixPassageiros(ent, pc, it, cheio, ctx) {
  // TRANSPORTE COLETIVO DE PASSAGEIROS (13/10/2026, revisto com o Módulo 07): isenção no rodoviário e metroviário urbano,
  // semiurbano e metropolitano sob autorização, permissão ou concessão (LC 214, art. 157) — e isenção não é alíquota zero:
  // anula o crédito das compras (CF, art. 156-A, §7º); −40% no intermunicipal e interestadual (art. 286) e no aéreo
  // regional (art. 287); zero no ferroviário e hidroviário urbano e metropolitano (art. 285, I). Por dentro, a parcela de
  // CBS/IBS do DAS segue a tabela. Pelo CNAE, mesmo quando a empresa fatura com nota de serviço
  // digitado na ficha (inclusive tudo cheio, de quem conferiu que não é linha regular): média; simulação anterior: média,
  // origem não registrada; o padrão, sem ninguém conferir: não medido
  if (pc.fonte === 'manual' && !pc.legado) { it.fonte = 'Informado, sem relatório'; it.nivel = 'media'; }
  else if (pc.legado) { it.fonte = ORIGEM_LEGADO; it.nivel = 'media'; }
  else { it.fonte = 'Assumido tudo à alíquota cheia — enquadramento a conferir'; it.nivel = 'nao_medido'; }
  it.selo = 'a conferir'; it.periodo = '—';
  // a isenção na ficha é "alíquota zero" com o crédito das despesas zerado; zero com o crédito mantido é outra coisa (art. 285)
  const isentoNaFicha = ehSo(ent, 'mixZero') && ent.pctDespesasComCredito != null && ent.pctDespesasComCredito !== '' && +ent.pctDespesasComCredito === 0;
  if (isentoNaFicha) { it.valor = 'isento pelo art. 157 — sem débito e sem o crédito das compras'; it.valorCliente = 'isento — sem imposto na venda e sem crédito nas compras'; }
  it.motivo = 'Transporte coletivo de passageiros tem tratamento próprio: isenção no rodoviário e metroviário urbano, semiurbano e metropolitano, aberto ao público e sob autorização, permissão ou concessão do poder público (LC 214, art. 157 — isenção não é alíquota zero: o crédito das compras é anulado), −40% no intermunicipal e interestadual (art. 286) e no aéreo regional (art. 287), alíquota zero no ferroviário e hidroviário urbano, semiurbano e metropolitano (art. 285, I) — os arts. 285 a 287 pelo sumário da lei, com o texto a conferir. ' + (cheio ? 'A conta considera tudo à alíquota cheia.' : 'A conta usa o enquadramento informado.')
    + (ehSo(ent, 'mixZero') && !isentoNaFicha ? ' Atenção: a conta usa alíquota zero com o crédito das compras mantido — se for a isenção do art. 157, zere na ficha o crédito das despesas e o % das compras de mercadorias com crédito.' : '');
  it.motivoCliente = 'O transporte de passageiros pode ser isento por fora (linha aberta ao público, autorizada pelo poder público, dentro da cidade, entre cidades vizinhas ou na região metropolitana) ou ter redução de 40% (linhas entre cidades, fora disso) — ainda não conferido.';
  it.falta = FALTA_PASSAGEIROS;
  // isenção na ficha: as variantes fora dela voltam ao crédito padrão (o zero do crédito das compras e das despesas é da isenção)
  const semIsencao = isentoNaFicha ? { pctComprasComCredito: null, pctDespesasComCredito: null } : {};
  const isento = { ...mixSo('mixZero'), pctComprasComCredito: 0, pctDespesasComCredito: 0 };
  const cand = [];
  if (!cheio) cand.push({ rotulo: 'tudo à alíquota cheia (sem linha regular sob autorização, permissão ou concessão)', rotuloCliente: 'o imposto cheio em todo o transporte (se não for linha regular autorizada pelo poder público)', ent: { ...ent, ...semIsencao, ...mixSo('mixCheia') } });
  if (!ehSo(ent, 'mixRed40')) cand.push({ rotulo: 'todo o transporte com −40% (intermunicipal ou interestadual, art. 286)', rotuloCliente: 'desconto de 40% em todo o transporte (linhas entre cidades)', ent: { ...ent, ...semIsencao, ...mixSo('mixRed40') } });
  if (!isentoNaFicha) cand.push({ rotulo: 'isenção do transporte público urbano, semiurbano ou metropolitano (sem débito e sem crédito das compras, art. 157)', rotuloCliente: 'isenção do transporte público dentro da cidade, entre cidades vizinhas ou na região metropolitana (sem imposto na venda e sem crédito nas compras)', ent: { ...ent, ...isento } });
  // trem e metrô: o zero do ferroviário urbano, semiurbano e metropolitano (art. 285, I) prevalece sobre a isenção (art. 7º-A)
  // e mantém o crédito das compras
  if (ctx && ctx.trilhos && !(ehSo(ent, 'mixZero') && !isentoNaFicha)) cand.push({ rotulo: 'alíquota zero do ferroviário urbano, semiurbano ou metropolitano, com o crédito das compras (art. 285, I — prevalece sobre a isenção, art. 7º-A)', rotuloCliente: 'alíquota zero do trem urbano ou metropolitano, com o crédito das compras', ent: { ...ent, ...semIsencao, ...mixSo('mixZero') } });
  it.variantes = cand;
  return it;
}

function itemMixFretamento(ent, it, cheio, ctx) {
  // FRETAMENTO, TÁXI E ESCOLAR (13/10/2026, revisto na revisão do Módulo 07): não são transporte público coletivo (LC 214,
  // art. 157, parágrafo único, I) — sem a isenção. Dentro do município, táxi e escolar: alíquota cheia. O fretamento entre
  // cidades pode estar no −40% do transporte coletivo intermunicipal e interestadual (art. 286) — o texto dos arts. 284 a 287
  // não está na base: premissa da lei, testada nos dois sentidos
  it.periodo = '—';
  if (ctx.fretamentoIntermunicipal) {
    it.categoria = 'premissa'; it.fonte = 'Lei (LC 214) — a conferir'; it.nivel = 'media'; it.selo = 'a conferir';
    it.motivo = 'Fretamento não é transporte público coletivo (LC 214, art. 157, parágrafo único, I: aberto a todos, com itinerário e preço fixados pelo poder público): não tem a isenção. Se o −40% do transporte coletivo intermunicipal e interestadual (art. 286) alcança o fretamento entre cidades, está a conferir — o texto do artigo não está na nossa base. ' + (cheio ? 'A conta considera tudo à alíquota cheia.' : 'A conta usa o mix informado.');
    it.motivoCliente = 'O fretamento entre cidades pode ter redução de 40% por fora, conforme a aplicação da lei ao fretamento — ainda a conferir.';
    it.falta = 'o alcance do art. 286 da LC 214 no fretamento intermunicipal';
    const cand = [];
    if (!cheio) cand.push({ rotulo: 'tudo à alíquota cheia (se o −40% do art. 286 não alcançar o fretamento)', rotuloCliente: 'o imposto cheio em todo o fretamento', ent: { ...ent, ...mixSo('mixCheia') } });
    if (!ehSo(ent, 'mixRed40')) cand.push({ rotulo: 'todo o fretamento com −40% (se o art. 286 o alcançar)', rotuloCliente: 'desconto de 40% em todo o fretamento', ent: { ...ent, ...mixSo('mixRed40') } });
    it.variantes = cand;
  } else {
    it.fonte = 'Lei (LC 214)'; it.nivel = 'alta'; it.selo = 'alta (norma)';
    it.motivo = 'Fretamento dentro do município, táxi e transporte escolar não são transporte público coletivo (LC 214, art. 157, parágrafo único, I: aberto a todos, com itinerário e preço fixados pelo poder público) e não estão nas reduções do transporte coletivo intermunicipal e interestadual: alíquota cheia.';
  }
  return it;
}

// o mix alternativo de quem vende mercadoria sem as notas: restaurante (a comida a −40%), mercado (cesta básica e hortifrúti a
// zero, mais −60%), hortifrúti (quase tudo zero) e os demais (metade a −60%)
function variantesRamo(ent, ctx) {
  if (ctx.tipo === 'alimentacao') return [{ rotulo: '90% da venda como comida preparada (−40%)', ent: { ...ent, ...SEM_MIX, mixCheia: 10, mixRed40: 90 } }];
  if (ctx.ramoZero === 'hortifruti') return [{ rotulo: '90% da venda com alíquota zero (hortícolas, frutas e ovos do Anexo XV)', ent: { ...ent, ...SEM_MIX, mixCheia: 10, mixZero: 90 } }];
  const metade = { rotulo: 'metade das vendas com redução de 60%', ent: { ...ent, ...SEM_MIX, mixCheia: 50, mixRed60: 50 } };
  // (a divisão do mercado é a do minimercado de um exercício do curso — o texto que sai na análise não cita o material)
  if (ctx.ramoZero === 'mercado') return [metade, { rotulo: '40% da venda com alíquota zero (cesta básica, hortifrúti e ovos) e 30% com −60%', ent: { ...ent, ...SEM_MIX, mixCheia: 30, mixRed60: 30, mixZero: 40 } }];
  return [metade];
}

function itemMix(ent, proc, ctx) {
  const pc = proc.mix || {};
  const it = { chave: 'mix', rotulo: 'Mix de alíquotas das vendas', curto: 'mix das vendas', categoria: 'dado', valor: textoMix(ent), periodo: periodoDe(pc) };
  const cheio = (+ent.mixCheia || 0) >= 99;
  if (ctx.refeicaoEmpresas) {
    // o enquadramento da refeição por contrato (LC 214, art. 273) é questão da lei: a análise roda o contrário
    it.categoria = 'premissa'; it.fonte = pc.fonte === 'notas' ? 'Notas fiscais de venda (XML)' : 'Conforme o enquadramento informado na ficha';
    it.nivel = 'baixa'; it.selo = 'a conferir';
    it.motivo = 'Refeição fornecida a empresas por contrato pode ficar dentro ou fora do regime de bares (LC 214, art. 273, a conferir): dentro, −40% e o cliente não credita; fora, alíquota cheia e o cliente credita.';
    it.falta = 'o enquadramento da refeição por contrato (LC 214, art. 273)';
    return it;
  }
  // serviço com redução pelo CNAE e transporte de passageiros: o enquadramento vem antes das notas — a nota de serviço não
  // mostra a redução, e o "cheio pela lei" só vale pra serviço fora do rol (13/10/2026, Módulo 07)
  if (ctx.reducaoServico && !ctx.vendeMercadoria) return itemMixServico(ent, pc, ctx.reducaoServico, it, cheio);
  if (ctx.passageiros) return itemMixPassageiros(ent, pc, it, cheio, ctx);
  if (ctx.passageirosOutros && (ctx.fretamentoIntermunicipal || cheio)) return itemMixFretamento(ent, it, cheio, ctx);
  if (pc.fonte === 'notas') {
    const n = nMed(pc);
    it.fonte = 'NCM das notas de venda (XML)'; it.nivel = n != null && n < 3 ? 'media' : 'alta';
    it.motivo = it.nivel === 'alta' ? 'Pelo NCM de cada item vendido.' : 'Pelo NCM das notas de ' + (n === 1 ? 'um mês só' : 'dois meses') + '.';
    it.falta = it.nivel === 'alta' ? null : 'as notas de venda dos outros meses';
  } else if (pc.fonte === 'manual' || (!pc.fonte && !cheio)) {
    it.fonte = pc.legado ? ORIGEM_LEGADO : 'Informado, sem relatório'; it.nivel = 'media';
    it.motivo = pc.legado ? 'Não ficou registrado se a divisão veio das notas de venda ou foi informada na ficha.' : 'Sem as notas de venda que comprovem a divisão.';
    it.falta = 'as notas de venda (XML ou ZIP)';
    // tudo à alíquota cheia, informado, num ramo com produtos de redução: o mesmo teste do não medido (confiança média)
    if (cheio && ctx.podeReduzir) it.variantes = variantesRamo(ent, ctx);
  } else if (ctx.tipo === 'servico' || ctx.tipo === 'transporte') {
    it.fonte = 'Lei (LC 214)'; it.nivel = 'alta'; it.selo = 'alta (norma)'; it.periodo = '—';
    it.motivo = ctx.tipo === 'servico' ? 'Serviço que não consta dos anexos de redução da LC 214: alíquota cheia.'
      : ctx.passageirosOutros ? 'Fretamento, táxi e transporte escolar não são transporte público coletivo (LC 214, art. 157): alíquota cheia — no fretamento intermunicipal, se entra nos −40% do art. 286, a conferir.'
      : 'Transporte de cargas não tem redução na LC 214.';
  } else if (ctx.podeReduzir) {
    // simulação anterior com tudo à alíquota cheia: pode ter vindo das notas (que mediram 100% cheia) ou ser o padrão de
    // quem não tinha as notas — não ficou registrado; fica "média" (a confirmar), não "não medido"
    if (pc.legado) {
      it.fonte = ORIGEM_LEGADO; it.nivel = 'media'; it.periodo = '—';
      it.motivo = 'Tudo à alíquota cheia, e não ficou registrado se o mix veio das notas de venda ou se é o padrão de quem não tinha as notas.';
    } else {
      it.fonte = 'Não medido — assumido tudo à alíquota cheia'; it.nivel = 'nao_medido'; it.periodo = '—';
      it.motivo = ctx.tipo === 'alimentacao'
        ? 'Sem as notas de venda (NFC-e), tudo foi considerado sem desconto; em restaurante a comida preparada tem −40% e só a bebida em lata ou garrafa e a alcoólica pagam cheio.'
        : ctx.ramoZero === 'mercado' ? 'Sem as notas de venda, tudo foi considerado sem desconto; no mercado, a cesta básica, o hortifrúti e os ovos têm alíquota zero e outros alimentos e produtos de limpeza têm −60% — baixariam o débito por fora.'
        : ctx.ramoZero === 'hortifruti' ? 'Sem as notas de venda, tudo foi considerado sem desconto; hortícolas, frutas e ovos têm alíquota zero (LC 214, art. 148, Anexo XV).'
        : 'Sem as notas de venda, tudo foi considerado sem desconto; produtos com redução (alimentos, insumos agropecuários, medicamentos) baixariam o débito por fora.';
    }
    it.falta = 'as notas de venda (XML ou ZIP) pra medir pelo NCM';
    it.variantes = variantesRamo(ent, ctx);
  } else {
    it.fonte = 'Assumido pelo ramo'; it.nivel = 'media'; it.periodo = '—';
    it.motivo = 'Tudo à alíquota cheia: os produtos do ramo não estão nos anexos de redução da LC 214 — sem as notas de venda, não dá pra descartar item com redução.';
    it.falta = 'as notas de venda (XML ou ZIP)';
  }
  return it;
}

// IMPOSTO EMBUTIDO NAS COMPRAS (14/10/2026, Imersão da Reforma): o fornecedor do regime normal destaca o IBS/CBS sobre o
// valor sem o ICMS (LC 214, art. 12, §2º, V) e sem o IPI (inciso II) — o ICMS próprio está dentro do preço, o IPI vem por
// cima do produto e o ICMS-ST, também por cima, fica fora pela regra de cálculo da NF-e (NT 2025.002, UB16-10, a confirmar
// na orientação normativa); nada disso entra no crédito de quem compra. Com o campo em 0, a conta credita sobre o valor
// cheio da nota e pende para o "por fora": nas 34 simulações da campanha, todas em 0, com 18% os 8 casos que davam OPTE
// mudavam de lado. Medido nas notas de compra (operacao-xml.js, ponte.pctImpostoEmbutido): alta com 3 meses ou mais e as
// notas cobrindo 80% ou mais das compras com nota; média com menos meses ou cobertura de 50% a 80%; baixa abaixo de 50% (o
// resto é serviço tomado, com o ISS, que as notas importadas não trazem) — testada ±4 pontos e, com o resto a ~3% de ISS,
// o % misturado. Informado na ficha, ou simulação antiga com o campo preenchido: média, testada ±5 pontos. Não medido:
// testa 12% e 18% (só despesas, sem mercadoria: 5% e 12%) e diz a partir de quanto o resultado vira
const EMB_NAO_MEDIDO_MERC = [12, 18], EMB_NAO_MEDIDO_DESP = [5, 12];
const limitaEmb = v => Math.max(0, Math.min(40, v));
function itemEmbutido(ent, pc) {
  const m0 = +ent.pctComprasMercadorias || 0, d0 = +ent.pctComprasDespesas || 0;
  if (!(m0 + d0 > 0)) return null;            // sem compras, o campo não pesa
  pc = pc || {};
  const v0 = +ent.pctImpostoEmbutido || 0;
  const it = { chave: 'embutido', rotulo: 'Imposto embutido nas compras', curto: 'imposto embutido nas compras', categoria: 'dado',
    valor: p1(v0) + '% do valor das notas de compra', periodo: periodoDe(pc) };
  let alvo = null;
  if (pc.fonte === 'notas') {
    const n = nMed(pc);
    // cobertura: quanto das compras com nota (fornecedor do regime normal + serviço tomado) as notas medidas são
    const cob = pc.cobertura != null && isFinite(+pc.cobertura) ? +pc.cobertura : 100;
    it.fonte = 'Notas fiscais de compra (XML), fornecedores do regime normal'; it.fonteCliente = 'Suas notas fiscais de compra';
    it.nivel = cob < 50 ? 'baixa' : cob < 80 || (n != null && n < 3) ? 'media' : 'alta';
    const partes = ['ICMS, ICMS-ST e IPI destacados ÷ valor das notas' + (pc.notas ? ' (' + pc.notas + (pc.notas === 1 ? ' nota' : ' notas') + ')' : '') + '.'];
    if (cob < 99.95) partes.push('As notas medidas são ' + p1(cob) + '% das compras com nota: o resto é serviço tomado, e o ISS dele não vem nas notas importadas' + (cob < 80 ? ' — o % de todas as compras pode ser menor.' : '.'));
    if (n != null && n < 3) partes.push('Só ' + (n === 1 ? 'um mês' : 'dois meses') + ' de notas: uma compra grande muda o %.');
    partes.push('Fora da medida também: o fornecedor do Simples (o crédito dele é outro, só a parcela do DAS) e o ICMS do combustível (monofásico), que não vem nos campos importados.');
    it.motivo = partes.join(' ');
    it.motivoCliente = 'Medido nas suas notas de compra: o ICMS, o ICMS-ST e o IPI que vêm nelas não entram no crédito do imposto novo.'
      + (cob < 80 ? ' Mas as notas medidas são só parte das compras: nas de serviço, o imposto que vem no preço é outro (o ISS).' : '');
    it.falta = it.nivel === 'alta' ? null : cob < 80 ? 'o imposto embutido no serviço tomado (o ISS da nota) — informe na ficha o % de todas as compras' : 'as notas de compra (XML de entrada) dos outros meses';
    // fora do "alta": ±4 pontos e, se a cobertura é parcial, o % misturado com o resto (serviço) a ~3% de ISS
    if (it.nivel !== 'alta') alvo = [limitaEmb(Math.min(v0 - 4, (v0 * cob + 3 * (100 - cob)) / 100)), limitaEmb(v0 + 4)];
  } else if (pc.fonte === 'manual' || (!pc.fonte && v0 > 0)) {
    // digitado na ficha (inclusive o 0), ou simulação antiga com o campo preenchido (legado)
    it.fonte = pc.legado ? ORIGEM_LEGADO : 'Informado, sem as notas de compra'; it.nivel = 'media';
    if (!pc.legado) it.fonteCliente = 'Estimativa do escritório';
    it.motivo = pc.legado ? 'Não ficou registrado se o % veio das notas de compra ou foi informado na ficha.' : 'Estimativa informada na ficha, sem as notas de compra que comprovem.';
    if (!pc.legado) it.motivoCliente = 'Estimativa do escritório, sem as notas de compra que comprovem: o imposto de hoje que vem no preço das compras não entra no crédito do imposto novo.';
    it.falta = 'as notas de compra (XML de entrada) dos fornecedores do regime normal';
    alvo = [limitaEmb(v0 - 5), limitaEmb(v0 + 5)];
  } else {
    it.fonte = 'Não medido'; it.nivel = 'nao_medido'; it.periodo = '—';
    it.motivo = 'Sem as notas de compra, a conta considera ' + p1(v0) + '%: credita o IBS/CBS sobre o valor cheio das notas — mas o fornecedor destaca sobre o valor sem o ICMS, o IPI e, no serviço, o ISS (LC 214, art. 12, §2º, II e V), e o ICMS-ST vem por cima do produto (fora pela regra de cálculo da NF-e, a confirmar); a conta fica mais favorável ao “por fora” do que é.';
    it.motivoCliente = 'Sem as suas notas de compra, a conta considerou que todo o valor das compras gera crédito do imposto novo. Mas o fornecedor calcula o imposto novo sem o ICMS que vem no preço — o crédito real é menor, e a conta por fora fica pior.';
    it.falta = 'as notas de compra (XML de entrada) dos fornecedores do regime normal';
    alvo = m0 > 0 ? EMB_NAO_MEDIDO_MERC : EMB_NAO_MEDIDO_DESP;
  }
  if (alvo) {
    const e = v => ({ ...ent, pctImpostoEmbutido: v });
    it.variantes = alvo.filter((v, i, a) => Math.abs(v - v0) > 0.05 && a.indexOf(v) === i)
      .map(v => ({ rotulo: p1(v) + '% do valor das notas', rotuloCliente: p1(v) + '% de imposto embutido no valor das compras', ent: e(v), valor: v }));
    it.bissecao = { atual: v0, ent: e, fmt: v => p1(v) + '% do valor das notas' };
  }
  return it;
}

function itensComplementares(ent, proc, ctx = {}) {
  const out = [];
  // transporte de passageiros isento na ficha (13/10/2026): o crédito zerado das compras e das despesas é da isenção — o
  // enquadramento é testado no mix, não aqui
  const isentoPass = !!ctx.passageiros && ehSo(ent, 'mixZero') && ent.pctDespesasComCredito != null && ent.pctDespesasComCredito !== '' && +ent.pctDespesasComCredito === 0;
  const ISENCAO = { fonte: 'Isenção informada na ficha', periodo: '—', nivel: 'media', selo: 'conforme a isenção', falta: null,
    motivo: 'Zerado pela isenção do transporte público coletivo (LC 214, art. 157): a isenção anula o crédito das compras (CF, art. 156-A, §7º). O enquadramento é testado no mix das vendas.',
    motivoCliente: 'Sem crédito nas compras: a isenção do transporte público não dá crédito do imposto pago nas compras.' };
  if (isentoPass && ent.pctComprasComCredito != null && ent.pctComprasComCredito !== '' && +ent.pctComprasComCredito === 0) {
    out.push({ chave: 'credCompras', rotulo: 'Compras de mercadorias que dão crédito (pelo NCM)', curto: 'compras que dão crédito', categoria: 'dado', valor: '0,0% das compras', ...ISENCAO });
  } else if (ent.pctComprasComCredito != null && ent.pctComprasComCredito !== '') {
    const pc = proc.pctCred || {};
    const v0 = +ent.pctComprasComCredito;
    const e = v => ({ ...ent, pctComprasComCredito: v });
    const vs = [limita(v0 - 15), limita(v0 + 15)].filter((v, i, a) => Math.abs(v - v0) > 0.05 && a.indexOf(v) === i);
    out.push({ chave: 'credCompras', rotulo: 'Compras de mercadorias que dão crédito (pelo NCM)', curto: 'compras que dão crédito', categoria: 'dado', valor: p1(v0) + '% das compras',
      fonte: pc.fonte === 'notas' ? 'NCM das notas de entrada (XML)' : pc.legado ? ORIGEM_LEGADO : 'Informado, sem relatório', periodo: periodoDe(pc), nivel: 'media',
      motivo: pc.fonte === 'notas' ? 'Classificação por NCM (cesta básica = zero), sujeita a revisão item a item nos maiores fornecedores.' : pc.legado ? 'Não ficou registrado se o % veio do NCM das notas de entrada ou foi informado na ficha.' : 'Sem as notas de entrada que comprovem.',
      falta: 'a revisão do NCM das compras nos maiores fornecedores',
      variantes: vs.map(v => ({ rotulo: p1(v) + '% das compras', ent: e(v), valor: v })), bissecao: { atual: v0, ent: e, fmt: v => p1(v) + '% das compras' } });
  }
  if (isentoPass) {
    out.push({ chave: 'credDespesas', rotulo: 'Crédito das despesas (% do cheio)', categoria: 'dado', valor: '0,0% do cheio', ...ISENCAO });
  } else if (ent.pctDespesasComCredito != null && ent.pctDespesasComCredito !== '' && +ent.pctDespesasComCredito < 100) {
    out.push({ chave: 'credDespesas', rotulo: 'Crédito das despesas (% do cheio)', categoria: 'dado', valor: p1(ent.pctDespesasComCredito) + '% do cheio',
      fonte: 'Estimativa informada na ficha', periodo: '—', nivel: 'media', motivo: 'Estimativa de quem preencheu: o crédito é o IBS/CBS que cada fornecedor destaca (serviço com redução, aluguel, VR e VA creditam menos).', falta: null });
  }
  // o imposto embutido nas compras (14/10/2026): na isenção do transporte público o crédito das compras já é zero
  if (!isentoPass) { const emb = itemEmbutido(ent, proc.pctEmb); if (emb) out.push(emb); }
  if ((+ent.creditoEstoqueMes || 0) > 0) {
    out.push({ chave: 'estoque', rotulo: 'Crédito de estoque', categoria: 'premissa', valor: brl0(ent.creditoEstoqueMes) + '/mês',
      fonte: 'Estimativa informada na ficha', periodo: '—', nivel: 'media', selo: 'provável',
      motivo: 'Provável, não garantido: depende da regulamentação do inventário de 31/12/2026 (LC 214, art. 381).', falta: 'a regulamentação do crédito de estoque',
      variantes: [{ rotulo: 'sem o crédito de estoque', ent: { ...ent, creditoEstoqueMes: 0 } }] });
  }
  const cbs = +ent.cbs;
  if (cbs > 0) {
    out.push({ chave: 'cbs', rotulo: 'Alíquota da CBS em 2027', categoria: 'premissa', valor: p2(cbs) + '% (referência de ' + p2(cbs + 0.1) + '% menos 0,1 ponto)',
      fonte: 'Estimativa', periodo: '—', nivel: 'baixa', selo: 'estimativa',
      motivo: 'Ainda não fixada: cabe ao Senado defini-la para 2027, com base em cálculo do TCU (ADCT, art. 130), e pode sair depois do prazo da opção. A conta usa a referência menos 0,1 ponto (ADCT, art. 127, parágrafo único); em circulação há 8,8% (projeção do Ministério da Fazenda) e 9,21% (CGIBS, jul/2026).',
      falta: 'a alíquota oficial da CBS (Resolução do Senado)',
      variantes: [8.7, 9.11].filter(v => Math.abs(v - cbs) > 0.005).map(v => ({ rotulo: 'a referência de ' + p2(v + 0.1) + '% (CBS de ' + p2(v) + '%)', ent: { ...ent, cbs: v }, valor: v })) });
  }
  return out;
}

// ---------- teste da faixa plausível ----------
function testar(it, base) {
  it.muda = false; it.resultados = [];
  if (!it.variantes || !it.variantes.length) return;
  for (const v of it.variantes) {
    let r = null; try { r = simular(v.ent); } catch (e) { r = null; }
    if (!r) continue;
    it.resultados.push({ rotulo: v.rotulo, rotuloCliente: v.rotuloCliente, valor: v.valor, premissa: !!v.premissa, decisao: decisaoDe(r), diferenca: r.semestre.diferenca });
  }
  const vira = it.resultados.filter(x => x.decisao !== base);
  it.muda = vira.length > 0;
  if (it.muda && it.bissecao && vira[0].valor != null) {
    // ponto de virada entre o valor de hoje e o extremo que muda o resultado (o motor é monótono em cada variável)
    let a = it.bissecao.atual, b = vira[0].valor;
    for (let i = 0; i < 32; i++) {
      const m = (a + b) / 2;
      let d = null; try { d = decisaoDe(simular(it.bissecao.ent(m))); } catch (e) { break; }
      if (d === base) a = m; else b = m;
    }
    it.virada = { valor: b, texto: it.bissecao.fmt(b), decisao: vira[0].decisao };
  }
  // "Com 30% da receita, …" · "Sem o crédito de estoque, …" (a variante que já começa com "sem" não leva o "com")
  const com = r => /^sem /i.test(r) ? r.charAt(0).toUpperCase() + r.slice(1) : 'Com ' + r;
  // o texto com os rótulos do escritório e, quando a variante tem, com os do cliente (sem artigo de lei — 13/10/2026)
  const efeitoCom = rot => {
    const lista = it.resultados.map(rot);
    return it.muda
      ? com(rot(vira[0])) + ', o resultado passa a ser “' + ROT_DECISAO[vira[0].decisao] + '”' + (it.virada ? ' — vira a partir de ' + it.virada.texto : '') + '.'
      : lista.length === 2 ? 'Entre ' + lista[0] + ' e ' + lista[1] + ', o resultado continua “' + ROT_DECISAO[base] + '”.'
      : lista.length > 2 ? 'Nos ' + lista.length + ' cenários testados — ' + lista.join('; ') + ' —, o resultado continua “' + ROT_DECISAO[base] + '”.'
      : com(lista[0]) + ', o resultado continua “' + ROT_DECISAO[base] + '”.';
  };
  it.efeito = efeitoCom(x => x.rotulo);
  if (it.resultados.some(x => x.rotuloCliente)) it.efeitoCliente = efeitoCom(x => x.rotuloCliente || x.rotulo);
}

// ============================================================
// contextoDoCaso({ ent, cnaeCaso, cnaeCadastro, dominio }) → o ctx de avaliarConfianca: o perfil da atividade (o que é
// plausível pra cada número depende do que a empresa faz), pelo CNAE mais completo entre o do caso (rt_casos.cnae_base) e o
// do cadastro (clientes.cnae_principal) e pela natureza das vendas do resumo do Domínio gravado na simulação. A ficha, o
// "Refazer simulações" e o chat da Reforma montam o contexto por aqui (até 14/10/2026 ficava dentro da ficha).
// ============================================================
export function contextoDoCaso({ ent, cnaeCaso, cnaeCadastro, dominio } = {}) {
  const e = ent || {};
  const cnae = String(cnaeMaisCompleto(cnaeCaso, cnaeCadastro));
  const pf = perfilAtividade({ natureza: dominio && dominio.vendas && dominio.vendas.natureza, cnae, anexo: e.anexo, restaurante: (e.mixRed40 || 0) > 0 });
  return { tipo: pf.tipo, vendeMercadoria: pf.vendeMercadoria, refeicaoEmpresas: pf.refeicaoEmpresas, passageiros: pf.passageiros, passageirosOutros: pf.passageirosOutros,
    trilhos: pf.trilhos, fretamentoIntermunicipal: pf.fretamentoIntermunicipal, reducaoServico: reducaoServicoPorCnae(cnae), ramoZero: ramoComZero(cnae),
    podeReduzir: pf.vendeMercadoria && (pf.tipo === 'alimentacao' || ramoComReducao(cnaeCadastro || cnae)) };
}

// ============================================================
// avaliarConfianca(ent, procedencia, ctx) → a tabela de confiança e a conclusão
//   ent: a entrada do motor (simular) · procedencia: { receita, rbt12, anexo, aliqEfetiva, partilha, pctExcluidoST,
//   pctReceitaMonofasica, pctMerc, pctDesp, pctPJ, mix, pctCred, pctEmb, … } cada um { fonte, meses, texto, … }
//   ctx: { tipo, vendeMercadoria, podeReduzir, refeicaoEmpresas, passageiros, passageirosOutros, trilhos, fretamentoIntermunicipal,
//   reducaoServico, ramoZero }
//   (perfil da atividade — dominio-relatorios.js), sim (opcional)
// ============================================================
export function avaliarConfianca(ent, procedencia, ctx = {}) {
  const proc = procedencia || {};
  const sim = ctx.sim || simular(ent);
  const base = decisaoDe(sim);
  const itens = [itemReceita(ent, proc.receita), itemSimples(ent, proc), itemCompras(ent, proc, ctx), itemPJ(ent, proc, ctx), itemMix(ent, proc, ctx), ...itensComplementares(ent, proc, ctx)];
  itens.forEach(it => {
    // o que o relatório do cliente mostra no lugar dos textos do escritório (rt-analise.js, versão do cliente)
    if (it.falta) it.faltaCliente = it.faltaCliente || FALTA_CLIENTE[it.falta] || it.falta;
    if (it.fonte === ORIGEM_LEGADO) { it.fonteCliente = FONTE_LEGADO_CLIENTE; it.motivoCliente = it.motivoCliente || MOTIVO_LEGADO_CLIENTE; }
    it.selo = it.selo || SELO_NIVEL[it.nivel];
    // o que se escreve no texto corrido: "confiança baixa", "não medido", "deduzido, não medido", "estimativa"
    it.confianca = it.nivel === 'nao_medido' ? (it.selo === 'deduzido' ? 'deduzido, não medido' : 'não medido')
      : String(it.selo).startsWith(SELO_NIVEL[it.nivel]) ? 'confiança ' + it.selo : it.selo;
    testar(it, base);
    // só a variante que depende da lei muda o resultado (a aula na educação desportiva, por exemplo): o número vira premissa —
    // a lei não tira a conclusão (13/10/2026)
    if (it.categoria === 'dado' && it.muda && it.resultados.filter(x => x.decisao !== base).every(x => x.premissa)) it.categoria = 'premissa';
  });
  const fraco = it => it.nivel === 'baixa' || it.nivel === 'nao_medido';
  const decisivos = itens.filter(it => it.categoria === 'dado' && it.muda && fraco(it));
  const aConfirmar = itens.filter(it => it.categoria === 'dado' && it.muda && !fraco(it));
  const premissas = itens.filter(it => it.categoria === 'premissa' && it.muda);
  // OS FRACOS JUNTOS: cada um, sozinho, não muda o resultado — mas dois números de confiança baixa no pior caso ao mesmo
  // tempo podem mudar. Procura o MENOR grupo que vira (2 números, depois 3, depois 4, cada um num dos extremos do
  // plausível): número que não é preciso pra virar não entra. Antes, toda combinação levava os 4 primeiros fracos, e um
  // "não medido" que nem mexia no resultado virava decisivo. No mesmo tamanho, os grupos com número não medido vêm primeiro
  let conjunto = null, doConjunto = [];
  const varsDado = it => (it.variantes || []).filter(v => !v.premissa);
  const soltos = itens.filter(it => it.categoria === 'dado' && fraco(it) && !it.muda && varsDado(it).length);
  if (!decisivos.length && soltos.length >= 2) {
    const delta = e => Object.fromEntries(Object.keys(e).filter(k => e[k] !== ent[k]).map(k => [k, e[k]]));
    const pool = soltos.slice(0, 6);
    const grupos = k => { const out = []; const rec = (i, acc) => { if (acc.length === k) { out.push(acc); return; } for (let j = i; j < pool.length; j++) rec(j + 1, acc.concat([pool[j]])); }; rec(0, []); return out; };
    const temNM = g => g.some(it => it.nivel === 'nao_medido') ? 1 : 0;
    for (let k = 2; k <= Math.min(4, pool.length) && !conjunto; k++) {
      for (const g of grupos(k).sort((a, b) => temNM(b) - temNM(a))) {
        let combos = [[]];
        g.forEach(it => { combos = combos.flatMap(c => varsDado(it).map(v => c.concat({ it, v, d: delta(v.ent) }))); });
        for (const c of combos) {
          let r = null; try { r = simular(Object.assign({}, ent, ...c.map(o => o.d))); } catch (e) { r = null; }
          if (r && decisaoDe(r) !== base) {
            doConjunto = g;
            conjunto = { decisao: decisaoDe(r), itens: g.map(it => it.rotulo),
              texto: 'Cada um sozinho não muda o resultado, mas juntos, no pior caso — ' + c.map(o => (o.it.curto || o.it.rotulo.toLowerCase()) + ' em ' + o.v.rotulo).join(' e ') + ' —, ele passa a ser “' + ROT_DECISAO[decisaoDe(r)] + '”.' };
            break;
          }
        }
        if (conjunto) break;
      }
    }
  }
  // o texto fica no item; as entradas testadas não vão adiante (pesam e não interessam a quem lê)
  itens.forEach(it => { delete it.variantes; delete it.bissecao; });
  // juntos, com número que nem foi medido no meio: não há conclusão (medido em poucos meses, os dois no pior caso ao
  // mesmo tempo é menos provável — fica a confirmar)
  if (conjunto && doConjunto.some(it => it.nivel === 'nao_medido')) {
    conjunto.semConclusao = true;
    doConjunto.forEach(it => decisivos.push(it));
  }
  const conclusao = decisivos.length ? 'sem_conclusao' : aConfirmar.length || conjunto ? 'a_confirmar' : 'firme';
  const deQuem = decisivos.concat(aConfirmar).concat(conjunto && !conjunto.semConclusao ? doConjunto : []);
  const faltam = [...new Set(deQuem.map(it => it.falta).filter(Boolean))];
  const faltamCliente = [...new Set(deQuem.map(it => it.faltaCliente).filter(Boolean))];
  return { decisao: base, rotuloDecisao: ROT_DECISAO[base], conclusao, itens, decisivos, aConfirmar, premissas, conjunto, faltam, faltamCliente,
    baixos: itens.filter(it => it.categoria === 'dado' && fraco(it)) };
}

// o que vai gravado com a simulação: dá pra lista e pro "refazer" saberem a conclusão sem refazer a conta toda
export function resumoConfianca(av) {
  return { conclusao: av.conclusao, decisao: av.decisao,
    decisivos: av.decisivos.map(it => it.rotulo), aConfirmar: av.aConfirmar.map(it => it.rotulo).concat(av.conjunto && !av.conjunto.semConclusao ? [av.conjunto.texto] : []), faltam: av.faltam,
    faltamCliente: av.faltamCliente, niveis: Object.fromEntries(av.itens.map(it => [it.chave, it.nivel])) };
}

// ============================================================
// inferirProcedencia(ent, dominio) — simulações gravadas antes de 13/10/2026, sem a procedência por campo: reconstrói o
// que dá a partir do resumo do Domínio guardado na simulação. O que não dá pra saber fica marcado como "legado" e aparece
// assim na ficha, na análise e no relatório ("simulação anterior — origem não registrada"). As notas da base NÃO entram:
// as de hoje podem não ser as que a simulação usou, e a ficha, o "Refazer simulações" e a análise têm de deduzir o mesmo
// ============================================================
export function inferirProcedencia(ent, dom) {
  const p = {};
  const comps = arr => arr && arr.length ? arr.filter(m => (m.total || 0) > 0).map(m => m.competencia).sort().slice(-12) : null;
  if (dom && dom.faturamento) p.receita = { fonte: 'faturamento', meses: dom.meses ? comps(dom.meses) : null, periodo: dom.periodoRotulo || null };
  else if (dom && dom.vendas && dom.vendas.meses) p.receita = { fonte: 'saidas', meses: comps(dom.vendas.meses), servicos: /servi/.test(dom.vendas.fonte || '') };
  else p.receita = { fonte: 'manual', legado: true };
  if (dom && dom.pgdas) ['rbt12', 'anexo', 'aliqEfetiva', 'partilha', 'pctExcluidoST'].forEach(k => { p[k] = { fonte: 'pgdas', meses: [dom.pgdas.competencia] }; });
  else ['rbt12', 'anexo'].forEach(k => { p[k] = { fonte: 'manual', legado: true }; });
  const t0 = (+ent.pctComprasMercadorias || 0) + (+ent.pctComprasDespesas || 0);
  if (dom && dom.entradas) { p.pctMerc = { fonte: 'entradas', meses: null, legado: true, regimeFornecedores: !!dom.fornecedoresRegime }; p.pctDesp = { ...p.pctMerc }; }
  else if (t0 > 0) { p.pctMerc = { fonte: 'manual', legado: true }; p.pctDesp = { fonte: 'manual', legado: true }; }
  else { p.pctMerc = { fonte: 'vazio' }; p.pctDesp = { fonte: 'vazio' }; }
  if (dom && dom.vendas && dom.vendas.pctPJ != null) p.pctPJ = { fonte: 'saidas', meses: comps(dom.vendas.meses), porDocumento: /CNPJ/.test(dom.vendas.fonte || ''), regimeConsultado: !!dom.clientesRegime };
  else if (dom && dom.pctPJDeduzido) {
    const t = String(dom.pctPJDeduzido);
    const perfil = /5620-1\/01/.test(t) ? 'refeicao_empresas' : /industrialização/.test(t) ? 'industrializacao' : /indústria/.test(t) ? 'industria' : /bar e restaurante/.test(t) ? 'alimentacao' : /varejo/.test(t) ? 'varejo' : null;
    // o % gravado é o que o perfil deduz? Se não é, alguém trocou depois (notas de venda, ou digitado) — e não ficou registrado
    const deduzido = { refeicao_empresas: 90, industria: 90, industrializacao: 100, alimentacao: 0, varejo: 0 }[perfil];
    p.pctPJ = deduzido != null && Math.abs((+ent.pctPJ || 0) - deduzido) < 0.05 ? { fonte: 'deduzido', texto: t, perfil } : { fonte: 'manual', legado: true };
  }
  else p.pctPJ = (+ent.pctPJ || 0) > 0 ? { fonte: 'manual', legado: true } : { fonte: 'vazio' };
  // tudo à alíquota cheia pode ser o padrão (sem as notas) ou o que as notas mediram; com redução, veio das notas ou foi digitado
  p.mix = (+ent.mixCheia || 0) >= 99 ? { fonte: 'padrao', legado: true } : { fonte: 'manual', legado: true };
  if (ent.pctComprasComCredito != null && ent.pctComprasComCredito !== '') p.pctCred = { fonte: 'manual', legado: true };
  // imposto embutido preenchido numa simulação antiga: veio das notas ou foi digitado, não ficou registrado. Em 0, é o campo
  // vazio — não medido (14/10/2026)
  if ((+ent.pctImpostoEmbutido || 0) > 0) p.pctEmb = { fonte: 'manual', legado: true };
  return p;
}
