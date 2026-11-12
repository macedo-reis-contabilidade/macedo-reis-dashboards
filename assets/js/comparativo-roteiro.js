// ============================================================
// MACEDO & REIS — Comparativo tributário: o roteiro do estudo, em fases e missões
// Módulo ES puro, sem DOM. Diz por onde começar quando a empresa abre: o que falta e o que conferir, em fases — pode ficar
// no Simples, os números da empresa, as premissas, o veredito —, cada uma com as suas missões (pôr o relatório que falta,
// preencher um número, conferir um padrão), com o próximo passo na frente. Pedidos do Samuel, 01/11/2026: "uma espécie de
// guia do que fazer primeiro, do próximo passo, do que falta — se não a gente abre uma empresa e dá aquele choque de um
// monte de informação" e "tem que ser quase como um jogo, onde se passa de fases, se cumpre missões ao pôr o relatório
// necessário ou preencher alguma info". Enquanto falta uma missão que pode virar a decisão, o estudo é provisório.
// Desde 11/11/2026 (pedido do Samuel, com a primeira empresa do regime geral: "quando selecionar uma empresa, o sistema não
// deveria começar 'perguntando' qual comparativo gostaríamos de fazer? a partir da escolha o sistema iria para determinado
// caminho"), o caminho depende do comparativo escolhido (o objetivo): com o Simples, as fases de sempre — pode ficar (ou
// entrar) no Simples, os números, as premissas, o veredito —, agora com os impedimentos do cadastro (simples-vedacoes.js);
// só o Presumido contra o Real, a receita e a presunção, o lucro do Real (o da contabilidade), o resto da conta e o
// veredito. E a precisão do estudo (precisaoDoEstudo): o que já está na conta e o que falta, com o efeito de cada item —
// "mostrando o comparativo com o que se tem mas deixando evidenciado o que se falta pra ser mais preciso".
// Também de 11/11/2026 (20h11, o Samuel na missão do lucro: "a ponte da Domínio deveria puxar essa informação até a data
// que supostamente a contabilidade está feita" e "eu ainda confirmaria com a Adaini se é confiável usar esse número até
// essa data"): a DRE que o estudo pede vai até onde a contabilidade está feita, e não até o fim da receita (lucroDoEstudo),
// e a confirmação de quem cuida da contabilidade é uma missão que decide, com o que o Domínio mostra daqueles meses.
// Com a versão 5 da ponte do Domínio (11/11/2026, o "vai" das 22h13), o resultado da contabilidade chega mês a mês: a
// missão do lucro diz o que o Domínio tem hoje e oferece o número (ponteDoLucro: "Usar o do Domínio", "Atualizar pelo
// Domínio"), e reabre quando o lucro do estudo veio da ponte e o Domínio já mostra outro no mesmo período.
// Testado por tests/comparativo-roteiro.test.mjs.
// ============================================================

import { LIMITE_SIMPLES, SUBLIMITE, ROTULO_REGIME, TIPOS, ehObjetivo, ehServico, fraseDaDecisao, rotuloDoTipo } from './comparativo-motor.js';
import { DO_SISTEMA, periodoCurto, periodoDaDre, dreSugerida, janelaDaReceita, mesesDeAte, lucroDaPonte } from './comparativo-dados.js';
import { NAO_CONFERE, oQueConferiu } from './simples-vedacoes.js';

// o Presumido só é opção com receita bruta de até R$ 78 milhões no ano anterior (Lei 9.718/1998, art. 13, na redação da
// Lei 12.814/2013); acima disso, Lucro Real (art. 14, I)
export const LIMITE_PRESUMIDO = 78000000;
const objetivoDe = (objetivo, entrada) => (ehObjetivo(objetivo) ? objetivo : ehObjetivo(entrada && entrada.objetivo) ? entrada.objetivo : 'todos');
const informado = v => v != null && v !== '' && Number.isFinite(Number(v));

const num = (v, def = 0) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct0 = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
const pct = (v, d = 1) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloComp = c => c ? MES_CURTO[Number(String(c).slice(5, 7)) - 1] + '/' + String(c).slice(2, 4) : '';
const maiuscula = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const juntar = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l.join('');
const pegar = (o, caminho) => String(caminho).split('.').reduce((x, k) => x == null ? x : x[k], o);

// o nome de cada campo no roteiro
const NOMES = {
  aliqCreditoIcms: 'o crédito de ICMS das compras', pctComprasSimples: 'as compras de fornecedor do Simples',
  rat: 'o RAT', fap: 'o FAP', terceiros: 'terceiros (sistema S)', crescimentoReceita: 'o crescimento da receita',
  outrasDespesas: 'as outras despesas', difalSimples: 'o ICMS pago fora do DAS',
  aliqIcms: 'o ICMS das vendas', redIcms: 'a redução da base do ICMS no regime geral', redIcmsSimples: 'a redução do ICMS no DAS',
  aliqIss: 'o ISS', pctMonofasico: 'a revenda monofásica', pctAliqZero: 'as vendas com alíquota zero de PIS/Cofins', ajustesLalur: 'as adições e exclusões'
};
const nomeDoCampo = c => NOMES[c] || NOMES[String(c).split('.').pop()] || c;
// como a missão foi cumprida, pela origem do número
const COMO = { reforma: 'veio do caso da Reforma', dominio: 'veio do relatório do Domínio', ponte: 'veio do Domínio pela ponte', pgdas: 'veio do PGDAS da Receita', fator_r: 'veio do Fator R',
  cadastro: 'veio do cadastro', digitado: 'digitado', confirmado: 'conferido', gravado: 'do estudo gravado' };

// ---------- o crescimento que o sistema mediu ----------
// os 3 últimos meses da série contra os 3 primeiros (de até 12): quanto a receita andou no período
export function crescimentoMedido(serie) {
  const s = (serie || []).filter(m => m && num(m.total) > 0).slice(-12);
  if (s.length < 9) return null;
  const a = s.slice(0, 3), b = s.slice(-3);
  const ini = a.reduce((t, m) => t + num(m.total), 0), fim = b.reduce((t, m) => t + num(m.total), 0);
  return ini > 0 ? { pct: (fim / ini - 1) * 100, ini: [a[0].competencia, a[2].competencia], fim: [b[0].competencia, b[2].competencia] } : null;
}

// ---------- a atividade e a presunção ----------
// Pedido do Samuel, 11/11/2026 (o item "A atividade de cada receita" mandava conferir sem dizer o quê: "não ficou claro o
// que preciso fazer, como temos acesso nas notas fiscais pela ponte da domínio, não ficaria mais fácil para o próprio
// sistema apurar essa informação?"): quem diz a presunção é a nota — a venda de mercadoria presume 8% no IRPJ e 12% na
// CSLL, e o serviço, 32% nos dois —, e o Domínio separa uma da outra. Com a divisão medida (atividade.divisao, de
// entradaDoSistema: as notas pela ponte, ou o faturamento do caso da Reforma) batendo com o estudo, a missão vem cumprida,
// sem ninguém conferir nada. Sobra pra equipe só o que a nota não diz, e a missão fala o que fazer: a atividade com
// presunção própria pelo CNAE (atividade.especial, de presuncaoPeloCnae: combustível, transporte, hospital, obra,
// imóveis, holding), o estudo que não bate com as notas e a empresa sem nota no sistema.
// Volta { caso, feita, como, com, ks, partes, div, doDominio, descr, doEstudo, esp, pequeno, lida, semNotas, fonteTipo }: caso = 'conferida' | 'especial'
// (a conferir) | 'especial_ok' (o transporte, que o sistema já pôs na conta) | 'notas' | 'origem' (digitada, do relatório
// solto, do anexo apurado) | 'diverge' | 'sem_notas'
const descreverDivisao = pm => (pm >= 99.995 ? 'toda a receita é venda de mercadoria' : pm <= 0.005 ? 'toda a receita é de serviço'
  : pm >= 50 ? pct(pm, 2) + '% é venda de mercadoria e ' + pct(100 - pm, 2) + '% é de serviço' : pct(100 - pm, 2) + '% é de serviço e ' + pct(pm, 2) + '% é venda de mercadoria');
export function presuncaoDoEstudo({ entrada = {}, origens = {}, atividade = null } = {}) {
  const e = entrada || {}, o = origens || {};
  const fonte = k => (o[k] && o[k].fonte) || 'padrao';
  const com = (e.atividades || []).map((a, i) => ({ a, i })).filter(x => x.a && TIPOS[x.a.tipo] && num(x.a.receita) > 0);
  const receita = com.reduce((t, x) => t + num(x.a.receita), 0);
  const ks = com.map(x => 'atividades.' + x.i + '.tipo');
  const pres = x => ({ irpj: num(x.a.presIrpj, TIPOS[x.a.tipo].presIrpj), csll: num(x.a.presCsll, TIPOS[x.a.tipo].presCsll) });
  const partes = com.map(x => rotuloDoTipo(x.a.tipo, false) + ', ' + pct(pres(x).irpj) + '% no IRPJ e ' + pct(pres(x).csll) + '% na CSLL sobre ' + brl(x.a.receita));
  const at = atividade || {};
  const div = at.divisao && num(at.divisao.mercadorias) + num(at.divisao.servicos) > 0 ? at.divisao : null;
  const esp = at.especial || null;
  // a parte de mercadoria nas notas e no estudo (o serviço é o resto): batem com até 1 ponto de diferença
  const pmNotas = div ? num(div.mercadorias) / (num(div.mercadorias) + num(div.servicos)) * 100 : null;
  const pmEstudo = receita > 0 ? com.filter(x => !ehServico(x.a.tipo)).reduce((t, x) => t + num(x.a.receita), 0) / receita * 100 : null;
  const bate = pmNotas != null && pmEstudo != null && Math.abs(pmNotas - pmEstudo) <= 1;
  // "Está certa": a origem de cada atividade conferida (o caminho do Presumido × Real) ou a marca da missão (com o Simples)
  const conferida = fonte('presuncao') === 'confirmado' || (ks.length > 0 && ks.every(k => fonte(k) === 'confirmado'));
  const digitada = com.some(x => ['presIrpj', 'presCsll'].some(c => fonte('atividades.' + x.i + '.' + c) === 'digitado'));
  const igual = !!esp && esp.toda && com.every(x => pres(x).irpj === esp.irpj && pres(x).csll === esp.csll);
  const porOrigem = ks.length > 0 && ks.every(k => !['padrao', 'cadastro'].includes(fonte(k)));
  // a atividade que a equipe escolheu (digitada, ou do relatório solto na tela) vale como está; a que veio do sistema e
  // não bate com as notas (a receita de uma atividade foi trocada à mão) pede pra conferir
  const daEquipe = ks.length > 0 && ks.every(k => ['digitado', 'dominio'].includes(fonte(k)));
  const caso = !com.length ? 'sem_notas' : conferida ? 'conferida' : esp && igual ? 'especial_ok' : esp && !digitada ? 'especial'
    : bate ? 'notas' : daEquipe ? 'origem' : div ? 'diverge' : porOrigem ? 'origem' : 'sem_notas';
  const doDominio = div ? (div.fonte === 'ponte' ? 'nas notas do Domínio de ' : 'no faturamento do Domínio de ') + periodoCurto(div) : '';
  const como = { conferida: 'conferido', especial_ok: esp ? 'pelo CNAE: ' + esp.nome : null, notas: div && div.fonte === 'ponte' ? 'apurado pelas notas do Domínio' : 'apurado pelo faturamento do Domínio',
    origem: ks.length ? (digitada ? 'digitado' : COMO[fonte(ks[0])] || 'feito') : null }[caso] || null;
  // só serviço e até R$ 120 mil no ano: a presunção do IRPJ pode ser de 16% (Lei 9.250/1995, art. 40; IN RFB 1.700/2017,
  // art. 33, §7º) — fora a profissão regulamentada, o hospital e o transporte
  const pequeno = !esp && com.length > 0 && receita <= 120000 && com.every(x => ehServico(x.a.tipo) && pres(x).irpj === 32);
  // sem a divisão medida: a ponte leu a empresa e o Domínio não tem nota dela nos meses fechados, ou a empresa não está lá
  const lida = !!at.lida;
  const semNotas = lida ? 'O Domínio não tem nota de saída nem de serviço desta empresa nos meses fechados' : 'O sistema não tem as notas desta empresa';
  return { caso, feita: ['conferida', 'especial_ok', 'notas', 'origem'].includes(caso), como, com, ks, partes, div, doDominio, lida, semNotas,
    descr: pmNotas != null ? descreverDivisao(pmNotas) : '', doEstudo: pmEstudo != null ? descreverDivisao(pmEstudo) : '', esp, pequeno, fonteTipo: ks.length ? fonte(ks[0]) : 'padrao' };
}
const REGRA_DA_PRESUNCAO = 'Venda de mercadoria presume 8% no IRPJ e 12% na CSLL; serviço, 32% nos dois.';
const DICA_DO_PEQUENO = ' Só com serviço e até R$ 120 mil de receita no ano, a empresa pode presumir 16% no IRPJ, se não for de profissão regulamentada (Lei 9.250/1995, art. 40): se for o caso, ponha 16 na presunção do IRPJ.';

// ---------- o que usar em cada fase ----------
// Pedido do Samuel, 01/11/2026: "o bom seria se a cada fase você indicasse qual informação ou relatório seria ideal de ser
// usado, apesar que conseguindo integrar dominio e receita federal pelo integra o sistema passaria a ter informações sobre
// tudo". Cada fase diz a informação que pede, onde buscar hoje (o relatório do Domínio que a tela lê, o contrato social, a
// conversa com o cliente), como ela está na empresa aberta (e até que mês, quando vem do sistema) e o que vai chegar sozinho
// quando as pontes estiverem ligadas — a da Receita, pelo Integra Contador, e a do Domínio (dominio/plano-integracao.md e
// integra-contador/plano.md, no Projeto). Os nomes dos relatórios são os que a tela reconhece (dominio-relatorios.js) e os
// que o Fator R lê. Desde 05/11/2026 as duas pontes estão ligadas: a do Domínio traz a receita, as compras e a folha
// (a versão 2) e a da Receita, o PGDAS das empresas com procuração; o resto ainda segue pelo relatório.
export const AUTOMATICO = {
  receita: 'Automático: a ponte da Receita traz o PGDAS de cada mês (das empresas com procuração), e a do Domínio, a apuração.',
  ponte: 'Automático: a ponte do Domínio traz todo dia, até o último mês fechado.',
  dominio: 'A ponte do Domínio ainda não traz este número: pelo relatório.',
  // a versão 5 da ponte (11/11/2026): o resultado da contabilidade mês a mês e a venda pelo CST do PIS/Cofins
  resultado: 'Automático: a ponte do Domínio traz o resultado de cada mês, e o lucro entra até onde o Controle das contabilidades dá a contabilidade como feita.',
  semResultado: 'A ponte do Domínio ainda não leu o resultado da contabilidade desta empresa: por enquanto, digite o lucro da DRE.',
  cst: 'A ponte do Domínio traz quando os itens das notas têm a situação tributária do PIS/Cofins (o CST); sem ela, pelo relatório.',
  contrato: 'As pontes não trazem: está no contrato.',
  conversa: 'Nenhum sistema tem: é conversa com o cliente.'
};
export const ESTADO_FONTE = { tem: 'tem', antigo: 'faltam meses', falta: 'falta', padrao: 'no padrão', dispensa: 'não muda a decisão', conversa: 'na reunião' };
// o último mês fechado: o do PGDAS que já venceu (dia 20) — até o dia 20, o de dois meses atrás. hoje: 'AAAA-MM-DD'
export function ultimoMesFechado(hoje) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(hoje || ''));
  if (!m) return null;
  let a = +m[1], mes = +m[2] - (+m[3] > 20 ? 1 : 2);
  while (mes < 1) { mes += 12; a -= 1; }
  return a + '-' + String(mes).padStart(2, '0');
}
// os meses depois de `ate` até o `fechado` (os que faltam), no máximo 12
function mesesDepois(ate, fechado) {
  const out = [];
  if (!ate || !fechado || ate >= fechado) return out;
  let a = +ate.slice(0, 4), m = +ate.slice(5, 7);
  while (out.length < 12) {
    m += 1; if (m > 12) { m = 1; a += 1; }
    const c = a + '-' + String(m).padStart(2, '0');
    if (c > fechado) break;
    out.push(c);
  }
  return out;
}
const faltamMeses = l => (l.length === 1 ? 'falta ' : 'faltam ') + juntar(l.map(rotuloComp));
// ---------- o lucro da contabilidade: até onde ela está feita, o que o Domínio mostra e a confirmação ----------
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const ultimoDiaDoMes = c => c + '-' + String(new Date(Date.UTC(+c.slice(0, 4), +c.slice(5, 7), 0)).getUTCDate()).padStart(2, '0');
// os meses em faixas: "fev/26" · "nov/25 e dez/25" · "jan/26 a jul/26" · "out/25, jan/26 a mar/26 e jul/26"
export function faixasDeMeses(lista) {
  const ord = [...new Set((lista || []).map(String).filter(c => /^\d{4}-\d{2}$/.test(c)))].sort();
  const seguinte = c => { const a = +c.slice(0, 4), m = +c.slice(5, 7); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
  const grupos = [];
  ord.forEach(c => { const g = grupos[grupos.length - 1]; if (g && seguinte(g[g.length - 1]) === c) g.push(c); else grupos.push([c]); });
  return juntar(grupos.flatMap(g => (g.length < 3 ? g.map(rotuloComp) : [rotuloComp(g[0]) + ' a ' + rotuloComp(g[g.length - 1])])));
}
// "em fev/26" · "em nov/25 e dez/25" · "de jan/26 a jul/26"
const quandoFoi = lista => { const f = faixasDeMeses(lista); return (/^\S+ a \S+$/.test(f) ? 'de ' : 'em ') + f; };
// O que o Domínio mostra da contabilidade nos meses de `de` a `ate` (contabil.meses, de contabilDoEstudo: os problemas
// fortes do Controle das contabilidades), juntos por tipo e com os meses, e a conta de banco mais atrasada quando para
// antes do fim do período. Volta { lidos, comProblema, itens: [texto], naoFeitos: [competencia] } — lidos: os meses do
// período que o Domínio leu; naoFeitos: os do período que o Controle não dá como feitos. Null sem o Controle ou o período.
const ORDEM_DOS_SINAIS = ['transitoria', 'fiscal', 'folha', 'receita', 'folha_difere', 'caixa', 'banco'];
const TEXTO_DO_SINAL = { fiscal: 'a escrita fiscal não entrou na contabilidade', folha: 'a folha não entrou na contabilidade', receita: 'a receita lançada é diferente do faturamento',
  folha_difere: 'a folha lançada é diferente da calculada', caixa: 'o caixa fechou o mês negativo', banco: 'o banco ficou sem lançamento' };
export function sinaisDaContabilidade(contabil, de, ate) {
  if (!contabil || contabil.faz === false || !de || !ate) return null;
  const meses = (contabil.meses || []).filter(m => m && m.competencia >= de && m.competencia <= ate);
  const por = new Map();
  meses.forEach(m => (m.problemas || []).forEach(p => { const l = por.get(p.tipo) || []; l.push({ c: m.competencia, valor: p.valor }); por.set(p.tipo, l); }));
  const itens = [];
  ORDEM_DOS_SINAIS.forEach(tipo => {
    const l = por.get(tipo);
    if (!l) return;
    const cs = l.map(x => x.c), ult = l[l.length - 1];
    if (tipo === 'transitoria') itens.push('conta transitória ou a classificar com saldo ' + quandoFoi(cs) + (num(ult.valor) > 0 ? ' (' + brl(ult.valor) + ' em ' + rotuloComp(ult.c) + ')' : ''));
    else itens.push(TEXTO_DO_SINAL[tipo] + ' ' + quandoFoi(cs));
  });
  const banco = contabil.bancoAte ? String(contabil.bancoAte).slice(0, 10) : null;
  if (banco && banco < ultimoDiaDoMes(ate)) itens.push('a conta de banco mais atrasada está lançada até ' + dataBR(banco));
  return { lidos: meses.length, comProblema: meses.filter(m => (m.problemas || []).length).length, itens,
    naoFeitos: mesesDeAte(de, ate).filter(c => !contabil.feitaAte || c > contabil.feitaAte) };
}
// com menos de metade dos meses da receita na DRE, a margem deles pode não valer pro ano (a sazonalidade, o mês atípico)
const POUCOS_MESES = 6;
const poucosMeses = (meses, total) => (meses > 0 && meses < POUCOS_MESES && total > meses ? ' São só ' + meses + ' dos ' + total + ' meses: a margem deles pode não valer pro ano.' : '');
// A confirmação gravada no estudo (origens.lucroConfirmado: { fonte: 'confirmado', ate, por, nome, em }): é da
// contabilidade até um mês, não de um número — vale enquanto a DRE usada (ou a pedida) não passa dele.
// Volta { vale, ate, nome, em } ou null
export function confirmacaoDaContabilidade(origens, ate) {
  const oc = origens && origens.lucroConfirmado;
  if (!oc || oc.fonte !== 'confirmado') return null;
  return { vale: !ate || !oc.ate || String(oc.ate) >= String(ate), ate: oc.ate || null, nome: oc.nome || null, em: oc.em || null };
}
// o dia ('AAAA-MM-DD', em Brasília) de um instante do banco ("2026-11-12T00:23:42+00:00"): UTC−3, sem horário de verão
const diaEmBrasilia = iso => {
  const s = String(iso || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t - 3 * 3600e3).toISOString().slice(0, 10) : null;
};
// A pergunta da confirmação no vigia de quem cuida da contabilidade (11/11/2026, o "vai" do Samuel) — o que a função
// comparativo_confirmacao do banco devolve ({ id, ate, situacao, resposta, resposta_texto, sim, respondida_em, para,
// pedida_por, criada_em }), lida contra o mês até onde a contabilidade é usada. Volta null sem pergunta, ou { estado:
// 'aberta' | 'sim' | 'nao', cobre (a pergunta vai até o mês usado, ou além), ate, para, pedidaPor, em (o dia em que foi
// feita), respondidaEm, resposta (a opção escolhida), texto (o que quem respondeu escreveu) }
export function perguntaDaContabilidade(pergunta, ate) {
  const p = pergunta && typeof pergunta === 'object' && !Array.isArray(pergunta) ? pergunta : null;
  if (!p || !p.id || !/^\d{4}-\d{2}$/.test(String(p.ate || '')) || !['aberta', 'respondida'].includes(p.situacao)) return null;
  const txt = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim() || null;
  return { estado: p.situacao === 'aberta' ? 'aberta' : p.sim === true ? 'sim' : 'nao', cobre: !ate || String(p.ate) >= String(ate), ate: String(p.ate),
    para: txt(p.para), pedidaPor: txt(p.pedida_por), em: diaEmBrasilia(p.criada_em), respondidaEm: diaEmBrasilia(p.respondida_em),
    resposta: txt(p.resposta), texto: txt(p.resposta_texto) };
}
// Tudo do lucro da contabilidade num lugar só, pra missão, pra linha do "O que usar" e pra tela: jan (a janela da receita),
// sug (a DRE que o estudo pede: até onde a contabilidade está feita), dre (o período da DRE informada e o fator que a leva
// aos 12 meses; null sem o lucro), ate (o mês até onde vai a contabilidade usada: o da DRE, senão o da pedida), sinais (o
// que o Domínio mostra até lá), conf (a confirmação marcada no estudo), perg (a pergunta do vigia: contabil.pergunta),
// confirmado (uma das duas vale: a marcada no estudo, ou o "sim" de quem cuida até o mês usado — pelaPergunta) e quem
// (com quem confirmar). Com o resultado da contabilidade pela ponte do Domínio (resultadoPonte), `ponte`: o que ela tem
// hoje contra o lucro do estudo (ponteDoLucro)
// O lucro que a ponte do Domínio tem hoje contra o do estudo. Volta { lido (a ponte leu o resultado de algum mês), hoje
// (lucroDaPonte até onde o Controle dá a contabilidade como feita: com o número, com o que falta, ou null), oferta (o que
// a missão oferece: { de, ate, meses, lucro, rotulo, motivo } — 'usar': o estudo está sem o lucro; 'andou': o lucro veio
// da ponte e a contabilidade já vai além; 'mudou': veio da ponte e o Domínio mostra outro número no mesmo período;
// 'comparar': o lucro foi digitado e o Domínio tem outro — ou null) e reabre (o caso 'mudou': o número do estudo já não é
// o do Domínio) }
export function ponteDoLucro({ entrada = {}, origens = {}, serie = null, contabil = null, resultadoPonte = null, dre = null } = {}) {
  const lido = !!(resultadoPonte && (resultadoPonte.size || resultadoPonte.length));
  if (!lido) return { lido: false, hoje: null, oferta: null, reabre: false };
  const e = entrada || {};
  const hoje = lucroDaPonte(serie, contabil, resultadoPonte);
  const temHoje = !!(hoje && hoje.lucro != null);
  const v = num(e.lucroContabil);
  const igual = lp => !!(lp && lp.lucro != null && dre && lp.de === dre.de && lp.ate === dre.ate && Math.abs(lp.lucro - v) < 0.005);
  let oferta = null, reabre = false;
  if (!informado(e.lucroContabil)) { if (temHoje) oferta = { ...hoje, motivo: 'usar', rotulo: 'Usar o do Domínio' }; }
  else if (origens && origens.lucroContabil && origens.lucroContabil.fonte === 'ponte') {
    // o mesmo período do estudo, relido hoje: só quando a DRE começa no primeiro mês da receita (é assim que a ponte soma)
    const doPeriodo = dre && dre.janela && dre.de === dre.janela.de && dre.ate <= dre.janela.ate ? lucroDaPonte(serie, contabil, resultadoPonte, dre.ate) : null;
    if (temHoje && dre && hoje.ate > dre.ate) oferta = { ...hoje, motivo: 'andou', rotulo: 'Atualizar pelo Domínio' };
    else if (doPeriodo && doPeriodo.lucro != null && !igual(doPeriodo)) { oferta = { ...doPeriodo, motivo: 'mudou', rotulo: 'Atualizar pelo Domínio' }; reabre = true; }
  } else if (temHoje && !igual(hoje)) oferta = { ...hoje, motivo: 'comparar', rotulo: 'Usar o do Domínio' };
  return { lido, hoje, oferta, reabre };
}
const lucroOuPrejuizo = x => (x < 0 ? 'prejuízo de ' + brl(-x) : 'lucro de ' + brl(x));
// a frase da missão do lucro sobre o que o Domínio tem, e o botão que ela oferece ({ usarPonte: { ate }, usarPonteRotulo })
function daPonteNaMissao(P, total) {
  if (!P || !P.lido) return { frase: '', campos: {} };
  const o = P.oferta, h = P.hoje;
  const per = x => 'de ' + rotuloComp(x.de) + ' a ' + rotuloComp(x.ate);
  const quantos = x => (total && x.meses < total ? ' (' + x.meses + ' dos ' + total + ' meses da receita)' : '');
  if (o) {
    const frase = o.motivo === 'usar' ? ' O Domínio tem o resultado ' + per(o) + quantos(o) + ': ' + lucroOuPrejuizo(o.lucro) + '.'
      : o.motivo === 'andou' ? ' Pelo Domínio, ' + per(o) + ': ' + lucroOuPrejuizo(o.lucro) + '.'
      : o.motivo === 'mudou' ? ' O Domínio mudou desde que o lucro entrou no estudo: ' + per(o) + ', hoje ele mostra ' + lucroOuPrejuizo(o.lucro) + '.'
      : ' Pelo Domínio, o resultado ' + per(o) + ' é ' + lucroOuPrejuizo(o.lucro) + '.';
    return { frase, campos: { usarPonte: { ate: o.ate }, usarPonteRotulo: o.rotulo } };
  }
  if (h && h.falta === 'sem_lancamento') return { frase: ' O Domínio não tem lançamento em conta de resultado ' + quandoFoi(h.quais) + ', que o Controle das contabilidades dá como '
    + (h.quais.length === 1 ? 'feito' : 'feitos') + ': o resultado ' + (h.quais.length === 1 ? 'desse mês' : 'desses meses') + ' não está lá, e a ponte não traz o lucro.', campos: {} };
  if (h && h.falta === 'nao_lido') return { frase: ' A ponte do Domínio ainda não tem o resultado ' + quandoFoi(h.quais) + ': o lucro não vem dela.', campos: {} };
  return { frase: '', campos: {} };
}
export function lucroDoEstudo({ entrada = {}, origens = {}, serie = null, contabil = null, resultadoPonte = null } = {}) {
  const e = entrada || {};
  const jan = janelaDaReceita(serie);
  const sug = dreSugerida(serie, contabil);
  const dre = informado(e.lucroContabil) ? periodoDaDre(serie, e) : null;
  const de = dre ? dre.de : sug && !sug.antes ? sug.de : null;
  const ate = dre ? dre.ate : sug && !sug.antes ? sug.ate : null;
  const resp = contabil && contabil.faz !== false && contabil.responsavel ? String(contabil.responsavel) : null;
  const quem = resp ? 'quem cuida da contabilidade dela (' + resp + ')' : contabil && contabil.faz === false ? 'o contador que faz a contabilidade dela' : 'quem faz a contabilidade dela';
  const conf = confirmacaoDaContabilidade(origens, ate);
  const perg = contabil && contabil.faz !== false ? perguntaDaContabilidade(contabil.pergunta, ate) : null;
  const manual = !!(conf && conf.vale), pelaPergunta = !manual && !!(perg && perg.estado === 'sim' && perg.cobre);
  // o resultado do Domínio no período usado, mês a mês: os meses em que ele passa da receita do mês (atipicos)
  const doPeriodo = ate && jan && de === jan.de && resultadoPonte ? lucroDaPonte(serie, contabil, resultadoPonte, ate) : null;
  return { jan, sug, dre, de, ate, sinais: sinaisDaContabilidade(contabil, de, ate), conf, perg, confirmado: manual || pelaPergunta, pelaPergunta, quem, responsavel: resp,
    ponte: ponteDoLucro({ entrada: e, origens, serie, contabil, resultadoPonte, dre }), atipicos: (doPeriodo && doPeriodo.atipicos) || [] };
}
// Dois sinais de que o resultado da contabilidade pode não valer como o lucro do período — pra confirmação de quem cuida
// dela (12/11/2026, com o resultado mês a mês pela ponte): o mês em que o resultado passa da receita do mês (o lançamento
// do ano inteiro de uma vez: o custo das mercadorias, a depreciação) e o lucro da contabilidade acima do que as notas e a
// folha do sistema deixam (no Real, nos 12 meses: a receita menos as compras, as despesas com nota, a folha e os tributos —
// só fecha com estoque formado no período, ou com compra que ficou sem o custo lançado). Volta [{ curto, texto }]: o
// curto vai na pergunta do vigia, o texto na missão.
export function alertasDoResultado({ L = null, comparacao = null, entrada = {} } = {}) {
  const out = [];
  const at = (L && L.atipicos) || [];
  if (at.length) {
    const lista = juntar(at.map(x => rotuloComp(x.competencia) + ' (' + lucroOuPrejuizo(x.resultado) + ')'));
    out.push({ curto: 'o resultado de ' + lista + (at.length === 1 ? ' passa' : ' passam') + ' da receita do mês',
      texto: 'No resultado do Domínio, ' + lista + (at.length === 1 ? ' passa' : ' passam') + ' da receita do mês: parece lançamento do ano inteiro de uma vez (o custo das mercadorias, a depreciação), que distorce um período que não é o ano fechado.' });
  }
  const r0 = comparacao && comparacao.anos && comparacao.anos[0];
  const real = r0 && r0.real;
  if (real && real.disponivel && real.lucroInformado && real.lucroEstimado != null && real.lucro - real.lucroEstimado > Math.max(5000, 0.02 * num(r0.receita))) {
    const comCompras = num(entrada && entrada.compras) > 0;
    const teto = real.lucroEstimado < 0 ? 'prejuízo de ' + brl(-real.lucroEstimado) : brl(real.lucroEstimado);
    out.push({ curto: 'o lucro da contabilidade no Real (' + brl(real.lucro) + ' nos 12 meses) passa do que as notas e a folha do sistema deixam (' + teto + ')' + (comCompras ? ': o custo das vendas (o estoque) está lançado mês a mês?' : ': a folha e as despesas entraram?'),
      texto: 'Pela contabilidade, o lucro no Real dá ' + brl(real.lucro) + ' nos 12 meses; pelas notas e pela folha do sistema (a receita menos as compras, as despesas com nota, a folha e os tributos), daria no máximo ' + teto + '. '
        + (comCompras ? 'Só fecha se a empresa formou estoque no período, ou se parte das compras ficou sem o custo lançado: pergunte como o custo das vendas (o estoque) é lançado.' : 'Só fecha se a folha ou outra despesa do sistema não entrou na contabilidade.') });
  }
  return out;
}
// A missão da confirmação: aberta até alguém marcar "Confirmado com a contabilidade" (a tela grava quem e quando), ou até
// quem cuida da contabilidade responder que sim à pergunta do vigia. Aberta, oferece a pergunta (perguntar: { ate, para,
// sinais }): a tela manda pela função do banco, e a resposta volta por contabil.pergunta. alertas: os do resultado
// (alertasDoResultado), que vão no texto e, pelo curto, na pergunta.
function missaoDaConfirmacao(L, peso, alertas = []) {
  const { dre, de, ate, conf, perg, sinais, quem, responsavel, pelaPergunta } = L;
  const feita = !!L.confirmado;
  const per = de && ate ? 'de ' + rotuloComp(de) + ' a ' + rotuloComp(ate) : '';
  const doDominio = !sinais || !sinais.lidos ? '' : sinais.itens.length ? ' O que o Domínio mostra ' + per + ': ' + sinais.itens.join('; ') + '.' : ' O Domínio não aponta problema ' + per + '.';
  const naoFeitos = sinais && sinais.naoFeitos.length && dre ? ' Pelo Controle das contabilidades, ' + faixasDeMeses(sinais.naoFeitos) + (sinais.naoFeitos.length === 1 ? ' ainda não está feito.' : ' ainda não estão feitos.') : '';
  const alertasTxt = (alertas || []).map(a => ' ' + a.texto).join('');
  // o que vai na pergunta do vigia: o que o Domínio mostra dos meses e os alertas do resultado
  const paraPergunta = [...(sinais && sinais.lidos ? sinais.itens : []), ...(alertas || []).map(a => a.curto)];
  const mudou = conf && !conf.vale ? ' A confirmação de ' + dataBR(conf.em) + ' foi até ' + rotuloComp(conf.ate) + ', e a DRE agora vai até ' + rotuloComp(ate) + ': confirme de novo.' : '';
  const ela = (perg && perg.para) || responsavel || 'Quem cuida da contabilidade';
  const quando = d => (d ? ' em ' + dataBR(d) : '');
  // onde a pergunta do vigia está: sem resposta, confirmada só até um mês antes do usado, ou respondida que não
  const daPergunta = !perg || feita ? ''
    : perg.estado === 'aberta' ? ' A pergunta está no vigia de ' + ela + (perg.em ? ' desde ' + dataBR(perg.em) : '') + (perg.cobre ? '' : ', até ' + rotuloComp(perg.ate)) + ', sem resposta.'
    : perg.estado === 'sim' ? ' ' + ela + ' confirmou' + quando(perg.respondidaEm) + ' só até ' + rotuloComp(perg.ate) + ', e a DRE vai até ' + rotuloComp(ate) + '.'
    : ' ' + ela + ' respondeu' + quando(perg.respondidaEm) + ': "' + (perg.resposta || perg.texto || 'sem confirmar') + '".' + (perg.resposta && perg.texto ? ' Escreveu: "' + perg.texto + '".' : '');
  // a pergunta só não é oferecida com uma aberta até o mês usado (ela já está no vigia de quem cuida)
  const podePerguntar = !feita && !!responsavel && !!ate && !(perg && perg.estado === 'aberta' && perg.cobre);
  return { id: 'contabil', titulo: 'A confirmação da contabilidade', curto: 'a confirmação da contabilidade', peso,
    estado: feita ? 'feita' : 'aberta',
    como: !feita ? null : pelaPergunta ? 'confirmado por ' + ela + quando(perg.respondidaEm) + ', pelo vigia' : 'confirmado' + (conf.nome ? ' por ' + conf.nome : '') + (conf.em ? ' em ' + dataBR(conf.em) : ''),
    texto: pelaPergunta ? ela + ' respondeu' + quando(perg.respondidaEm) + ' que o resultado até ' + rotuloComp(perg.ate) + ' é confiável (a pergunta do vigia' + (perg.pedidaPor ? ', feita por ' + perg.pedidaPor : '') + ').' + doDominio + alertasTxt
      : feita ? (conf.nome || 'A equipe') + ' confirmou com ' + quem + ' que o resultado' + (conf.ate ? ' até ' + rotuloComp(conf.ate) : '') + ' é confiável' + (conf.em ? ', em ' + dataBR(conf.em) : '') + '.' + doDominio + alertasTxt
      : 'Antes de apresentar, confirme com ' + quem + ' se o resultado' + (ate ? ' até ' + rotuloComp(ate) : '') + ' é confiável: os meses conciliados e fechados, sem lançamento por fazer.' + doDominio + alertasTxt + naoFeitos + mudou + daPergunta,
    efeito: 'o lucro errado troca o resultado entre o Presumido e o Real',
    perguntar: podePerguntar ? { ate, para: responsavel, sinais: paraPergunta.length ? paraPergunta.join('; ') : null } : null,
    perguntarRotulo: 'Perguntar pra ' + (responsavel || 'quem cuida') + (perg ? ' de novo' : ''),
    confirmar: feita ? null : { ate: ate || null }, confirmarRotulo: 'Confirmado com a contabilidade', desfazer: feita && !pelaPergunta, desfazerRotulo: 'Desfazer a confirmação' };
}

// Volta { simples, numeros, premissas, veredito }: as linhas de cada fase — { id, info, onde, auto, estado (tem | antigo |
// falta | padrao | dispensa | conversa), rotuloEstado, situacao, relatorio (a tela lê o relatório), campo (onde digitar),
// ficha (o contrato vai na ficha da empresa) }
// objetivo: o comparativo escolhido — 'presumido_real' devolve { presuncao, lucro, premissas, veredito }
// contabil: o Controle das contabilidades da empresa ({ faz, feitaAte 'AAAA-MM' } ou null), pro lucro da contabilidade
// atividade: o que o sistema apurou da atividade ({ divisao, especial }: as notas e o CNAE — presuncaoDoEstudo)
// resultadoPonte: o resultado da contabilidade mês a mês pela ponte do Domínio (a versão 5), pro lucro
export function fontesDoEstudo({ entrada = {}, origens = {}, comparacao = null, situacao = null, serie = null, socios = null, conferencia = null, hoje = null, objetivo = null, contabil = null, atividade = null,
  resultadoPonte = null } = {}) {
  const e = entrada || {}, o = origens || {};
  const geral = objetivoDe(objetivo, e) === 'presumido_real';
  const F1 = geral ? 'presuncao' : 'simples', F2 = geral ? 'lucro' : 'numeros';
  const fonte = k => (o[k] && o[k].fonte) || 'padrao';
  const padrao = k => fonte(k) === 'padrao';
  const conferido = k => fonte(k) === 'confirmado';
  const como = k => COMO[fonte(k)] || 'feito';
  const ats = (e.atividades || []).filter(a => a && TIPOS[a.tipo]);
  const tributo = a => a.tributo || TIPOS[a.tipo].tributo;
  const comRec = ats.map((a, i) => ({ a, i })).filter(x => num(x.a.receita) > 0);
  const receita = comRec.reduce((t, x) => t + num(x.a.receita), 0);
  const temIcms = comRec.some(x => tributo(x.a) === 'icms');
  const temIss = comRec.some(x => tributo(x.a) === 'iss');
  const restaurante = !!e.rda || comRec.some(x => tributo(x.a) === 'icms' && num(x.a.redIcms) > 0);
  const simples = e.regimeAtual === 'simples';
  const fechado = ultimoMesFechado(hoje);
  const grupo = (e.grupo || []).map((g, i) => ({ g, i })).filter(x => x.g && num(x.g.receita) > 0);
  const out = geral ? { presuncao: [], lucro: [], premissas: [], veredito: [] } : { simples: [], numeros: [], premissas: [], veredito: [] };
  const add = (fase, x) => { const l = { estado: 'tem', situacao: '', auto: null, ...x }; l.rotuloEstado = ESTADO_FONTE[l.estado]; out[fase].push(l); };

  // ===== fase 1: a receita (e, com o Simples, os sócios e as outras empresas deles) =====
  {
    const ks = comRec.map(x => 'atividades.' + x.i + '.receita');
    let estado = 'tem', sit = 'falta';
    if (!(receita > 0) || ks.some(padrao)) estado = 'falta';
    else {
      const ate = DO_SISTEMA.includes(fonte(ks[0])) && serie && serie.length ? serie[serie.length - 1].competencia : null;
      const faltam = mesesDepois(ate, fechado);
      if (faltam.length) estado = 'antigo';
      sit = como(ks[0]) + (ate ? ', até ' + rotuloComp(ate) : '') + (faltam.length ? ' — ' + faltamMeses(faltam) : '');
    }
    add(F1, { id: 'receita', info: 'A receita dos últimos 12 meses', estado, situacao: sit, relatorio: true,
      onde: 'Domínio Escrita Fiscal: o Relatório de Faturamento ou o Demonstrativo Mensal, até o último mês fechado.',
      auto: simples ? AUTOMATICO.receita : AUTOMATICO.ponte });
  }
  if (geral && receita > 0) {
    // a atividade de cada receita faz a presunção: o sistema apura pelas notas do Domínio (venda de mercadoria × serviço);
    // a linha só pede alguma coisa quando sobra o que a nota não diz, e aí diz o quê (a ação fica na missão, logo abaixo)
    const p = presuncaoDoEstudo({ entrada: e, origens: o, atividade });
    const item = {
      notas: { estado: 'tem', situacao: p.como + (p.div ? ', de ' + periodoCurto(p.div) : ''),
        onde: 'As notas de saída e de serviço do Domínio: ' + p.descr + '. ' + REGRA_DA_PRESUNCAO, auto: p.div && p.div.fonte === 'ponte' ? AUTOMATICO.ponte : null },
      origem: { estado: 'tem', situacao: p.como, onde: 'As notas de saída e de serviço do Domínio. ' + REGRA_DA_PRESUNCAO, auto: AUTOMATICO.ponte },
      conferida: { estado: 'tem', situacao: 'conferido', onde: 'As notas de saída e de serviço do Domínio. ' + REGRA_DA_PRESUNCAO, auto: AUTOMATICO.ponte },
      especial_ok: { estado: 'tem', situacao: p.como, onde: p.esp ? p.esp.regra : '', auto: null },
      especial: { estado: 'padrao', situacao: p.esp ? 'CNAE de ' + p.esp.nome + ': falta conferir a presunção' : '',
        onde: p.esp ? 'Em ' + p.esp.nome + ', a presunção depende do que as notas do Domínio não dizem. A regra e o que fazer estão na missão abaixo.' : '', auto: null },
      diverge: { estado: 'padrao', situacao: 'o estudo não bate com as notas do Domínio',
        onde: maiuscula(p.doDominio) + ', ' + p.descr + '; no estudo, ' + p.doEstudo + '. Acerte na missão abaixo.', auto: null },
      sem_notas: { estado: 'padrao', situacao: (p.lida ? 'sem nota no Domínio' : 'sem notas no sistema') + (p.fonteTipo === 'cadastro' ? ': pelo CNAE do cadastro' : ': no padrão'),
        onde: p.semNotas + (p.fonteTipo === 'cadastro' ? ': a atividade veio do CNAE do cadastro' : '') + '. A regra e o que fazer estão na missão abaixo.',
        auto: p.lida ? null : 'Com a empresa no Domínio, a ponte traz essa divisão pelas notas, todo dia.' }
    }[p.caso];
    add(F1, { id: 'atividade', info: 'A atividade de cada receita (a presunção)', campo: p.ks[0], ...item });
  }
  if (!geral && socios != null) {
    add('simples', { id: 'socios', info: 'Os sócios e a participação de cada um', estado: socios > 0 ? 'tem' : 'falta', ficha: true,
      situacao: socios > 0 ? socios + (socios === 1 ? ' sócio no cadastro' : ' sócios no cadastro') : 'o cadastro não tem os sócios',
      onde: 'O contrato social ou a última alteração, lido na ficha da empresa ("Ler o documento"), com o CPF e a participação.',
      auto: AUTOMATICO.contrato });
  }
  if (!geral && grupo.length) {
    const ks = grupo.map(x => 'grupo.' + x.i + '.receita');
    let estado = ks.some(padrao) ? 'falta' : 'tem';
    let sit = estado === 'falta' ? 'falta a receita de ' + juntar(grupo.filter(x => padrao('grupo.' + x.i + '.receita')).map(x => x.g.nome || 'uma delas')) : como(ks[0]);
    if (estado === 'tem' && situacao && situacao.ate) {
      const faltam = mesesDepois(situacao.ate, fechado);
      sit = 'as ' + (grupo.length + 1) + ' empresas somadas até ' + rotuloComp(situacao.ate) + (faltam.length ? ' — ' + faltamMeses(faltam) : '');
      if (faltam.length) estado = 'antigo';
    }
    add('simples', { id: 'grupo', info: 'A receita das outras empresas dos sócios', estado, situacao: sit,
      onde: 'O faturamento de cada uma até o mesmo mês: o relatório do Domínio na ficha da Reforma dela, ou o total dos 12 meses digitado aqui.',
      auto: 'Automático pelas pontes: as do Simples pela Receita e pelo Domínio, as outras pelo Domínio.' });
  }

  // ===== fase 2: os números da empresa (no Presumido × Real: o lucro da contabilidade) =====
  if (geral) {
    const lucroInf = informado(e.lucroContabil);
    // a DRE vai até onde a contabilidade está feita (o Controle das contabilidades): o que falta dos 12 meses da receita
    // entra pela margem dos meses feitos (lucroDoEstudo)
    const L = lucroDoEstudo({ entrada: e, origens: o, serie, contabil, resultadoPonte });
    const feitaAte = contabil && contabil.faz !== false ? contabil.feitaAte || null : null;
    const p = L.dre || (L.sug && !L.sug.antes ? L.sug : null);      // o período: o da DRE informada, senão o da pedida
    const total = L.jan ? L.jan.meses.length : 12;
    const parcial = !!(p && p.faltam && p.faltam.length);
    const perTxt = p ? 'de ' + rotuloComp(p.de) + ' a ' + rotuloComp(p.ate) : 'dos mesmos 12 meses da receita';
    const ctb = !contabil ? '' : contabil.faz === false ? ' O escritório não faz a contabilidade dela (Controle das contabilidades).'
      : L.sug && L.sug.antes ? ' Pelo Controle das contabilidades, ' + (feitaAte ? 'ela está feita até ' + rotuloComp(feitaAte) : 'nenhum mês está feito') + ': nenhum dos meses da receita.'
      : feitaAte ? ' Pelo Controle das contabilidades, ela está feita até ' + rotuloComp(feitaAte) + '.' : '';
    // a DRE informada que passa do que o Controle dá como feito: o número está na conta, mas não é o de meses fechados
    const alem = !!(L.dre && feitaAte && L.dre.ate > feitaAte);
    add(F2, { id: 'dre', info: 'O lucro da contabilidade', estado: lucroInf ? (parcial || alem ? 'antigo' : 'tem') : 'falta', campo: 'lucroContabil',
      situacao: lucroInf ? como('lucroContabil') + (L.dre ? ': a DRE ' + perTxt + (parcial ? ' (' + L.dre.meses + ' de ' + total + ' meses)' : '') + (alem ? ', além do que a contabilidade tem feito (' + rotuloComp(feitaAte) + ')' : '') : '') : 'falta',
      onde: 'Domínio Contabilidade: a DRE (ou o balancete) ' + perTxt + (parcial ? ', até onde a contabilidade está feita' : '') + ' — o resultado antes do IRPJ e da CSLL.'
        + (parcial ? ' ' + (p.faltam.length > 3 ? 'Os outros ' + p.faltam.length + ' meses' : maiuscula(juntar(p.faltam.map(rotuloComp)))) + (p.faltam.length === 1 ? ' entra' : ' entram') + ' pela margem ' + (p.faltam.length > 3 ? 'desses' : 'dos outros meses') + '.' : '') + ctb,
      auto: L.ponte.lido ? AUTOMATICO.resultado : AUTOMATICO.semResultado });
    // a confirmação de quem cuida da contabilidade: com o lucro na conta, ou enquanto ele é pedido
    if (L.ate && (lucroInf || !conferido('lucroContabil'))) {
      const ok = !!L.confirmado, pg = L.perg, ela = (pg && pg.para) || L.responsavel || 'quem cuida';
      add(F2, { id: 'ctbconf', info: 'A confirmação da contabilidade', estado: ok ? 'tem' : 'falta',
        situacao: L.pelaPergunta ? 'confirmado por ' + ela + (pg.respondidaEm ? ' em ' + dataBR(pg.respondidaEm) : '') + ', pelo vigia'
          : ok ? 'confirmado' + (L.conf.nome ? ' por ' + L.conf.nome : '') + (L.conf.em ? ' em ' + dataBR(L.conf.em) : '')
          : pg && pg.estado === 'aberta' && pg.cobre ? 'perguntado a ' + ela + (pg.em ? ' em ' + dataBR(pg.em) : '') + ', sem resposta'
          : pg && pg.estado === 'nao' ? ela + ' respondeu' + (pg.respondidaEm ? ' em ' + dataBR(pg.respondidaEm) : '') + ' e não confirmou'
          : 'falta confirmar',
        onde: maiuscula(L.quem) + ': se o resultado até ' + rotuloComp(L.ate) + ' é confiável' + (L.sinais && L.sinais.itens.length ? '. O Domínio aponta ' + L.sinais.comProblema + ' de ' + L.sinais.lidos + ' meses com problema (na missão abaixo)' : '') + '.',
        auto: 'Nenhum sistema tem: é a palavra de quem fecha a contabilidade.' });
    }
    if (lucroInf) add(F2, { id: 'lalur', info: 'As adições e as exclusões do lucro real', estado: padrao('ajustesLalur') ? 'padrao' : 'tem', campo: 'ajustesLalur',
      situacao: padrao('ajustesLalur') ? 'no padrão: sem ajustes' : como('ajustesLalur'),
      onde: 'A DRE e o razão: as despesas indedutíveis (multas, brindes, doações) e as receitas que não são tributadas. Se a empresa já foi do Real, o LALUR da última ECF.',
      auto: 'Nenhum sistema tem: é análise da contabilidade.' });
  }
  const semFolha = !(num(e.folha) + num(e.proLabore) > 0);
  // a ponte do Domínio leu a folha e o pró-labore e os dois deram zero: a empresa não tem (não é dado que falta)
  const zeroPelaPonte = semFolha && fonte('folha') === 'ponte' && fonte('proLabore') === 'ponte';
  const folhaOk = (!semFolha && !padrao('folha')) || conferido('folha') || fonte('folha') === 'digitado' || zeroPelaPonte;
  add(F2, { id: 'folha', info: 'A folha e o pró-labore dos 12 meses', estado: folhaOk ? 'tem' : 'falta', campo: 'folha', relatorio: true,
    situacao: folhaOk ? (zeroPelaPonte ? 'sem folha nem pró-labore no Domínio' : semFolha ? 'sem folha nem pró-labore' : como('folha')) : 'falta',
    onde: 'Domínio Folha: o resumo da folha mês a mês dos 12 meses (salários, 13º, férias e pró-labore), lido com IA.',
    auto: AUTOMATICO.ponte });
  if (receita > 0) {
    const comprasOk = !padrao('compras') && (num(e.compras) > 0 || conferido('compras') || fonte('compras') === 'digitado');
    add(geral ? 'premissas' : 'numeros', { id: 'compras', info: 'As compras de mercadorias e insumos', estado: comprasOk ? 'tem' : 'falta', relatorio: true,
      situacao: comprasOk ? como('compras') : 'falta',
      onde: 'Domínio Escrita Fiscal: o Acompanhamento de Entradas dos mesmos 12 meses.',
      auto: AUTOMATICO.ponte });
  }
  if (simples && receita > 0 && !geral) {
    const pgOk = !!(conferencia && num(conferencia.aliquota) > 0);
    add('numeros', { id: 'pgdas', info: 'O PGDAS mais recente', estado: pgOk ? 'tem' : 'falta', relatorio: true,
      situacao: pgOk ? (COMO[conferencia.fonte] || 'veio do sistema') + (conferencia.competencia ? ', de ' + rotuloComp(conferencia.competencia) : '') : 'falta',
      onde: 'Domínio Escrita Fiscal: o Simples Nacional do último mês (a apuração do PGDAS), que mostra o ST, o monofásico e a redução do ICMS.',
      auto: 'As pontes trazem a receita, o RBT12, o ST e o monofásico; a alíquota efetiva e a redução do ICMS seguem pelo relatório.' });
  }
  const d = comparacao && comparacao.decisao;
  if (!geral && d && d.real) {
    const alvo = d.melhor === 'real' ? d.segundo : d.melhor;
    const emp = alvo && d.real.empate[alvo];
    const despOk = !padrao('outrasDespesas') || num(e.outrasDespesas) > 0 || informado(e.lucroContabil);
    const estado = despOk ? 'tem' : emp && emp.nunca ? 'dispensa' : 'falta';
    add('numeros', { id: 'despesas', info: 'As outras despesas (fazem o lucro do Real)', estado, campo: 'outrasDespesas',
      situacao: informado(e.lucroContabil) ? 'o lucro veio da contabilidade' : despOk ? como('outrasDespesas') : estado === 'dispensa' ? 'nem com lucro zero o Real ganha' : 'falta',
      onde: 'Domínio Contabilidade: o balancete ou a DRE dos 12 meses (as despesas além das compras e da folha); as sem nota, com o cliente.',
      auto: resultadoPonte && (resultadoPonte.size || resultadoPonte.length) ? 'A ponte do Domínio traz o resultado da contabilidade (o lucro do Real) até onde ela está feita; as despesas sem nota seguem com o cliente.'
        : 'A ponte do Domínio ainda não traz as despesas; as sem nota seguem com o cliente.' });
  }

  // ===== fase 3: as premissas =====
  if (temIcms && num(e.compras) > 0) {
    add('premissas', { id: 'credito', info: 'O crédito de ICMS das compras', estado: padrao('aliqCreditoIcms') ? 'padrao' : 'tem', campo: 'aliqCreditoIcms',
      situacao: padrao('aliqCreditoIcms') ? 'no padrão: ' + pct(num(e.aliqCreditoIcms, 12), 2) + '% das compras' : como('aliqCreditoIcms'),
      onde: 'Domínio Escrita Fiscal: a apuração do ICMS (o crédito das entradas) ou as notas de entrada em XML.',
      auto: AUTOMATICO.dominio });
  }
  if (temIcms) {
    const ks = comRec.filter(x => tributo(x.a) === 'icms').map(x => 'atividades.' + x.i + '.aliqIcms');
    const noPadrao = ks.filter(padrao);
    add('premissas', { id: 'icms', info: restaurante ? 'O ICMS das vendas e a opção do restaurante' : 'O ICMS das vendas: a alíquota, o ST e as reduções',
      estado: noPadrao.length ? 'padrao' : 'tem', campo: ks[0], situacao: noPadrao.length ? 'no padrão' : como(ks[0]),
      onde: 'Domínio Escrita Fiscal: o Acompanhamento de Saídas (as vendas com ST, CFOP x401 a x405) e a apuração do ICMS' +
        (restaurante ? '; a opção do restaurante no regime geral (o RDA, a base reduzida ou o crédito presumido), na apuração ou com o cliente.' : '.'),
      auto: AUTOMATICO.dominio });
  }
  if (geral && temIcms && comparacao && comparacao.anos[0] && comparacao.anos[0].ano < 2027) {
    // as vendas com alíquota zero (a cesta básica) ficam no padrão até alguém conferir; a revenda monofásica vem do sistema
    const ks = comRec.filter(x => tributo(x.a) === 'icms').map(x => 'atividades.' + x.i + '.pctAliqZero');
    const noPadrao = ks.filter(padrao);
    add('premissas', { id: 'piscofins', info: 'O PIS/Cofins das vendas' + (informado(e.lucroContabil) ? '' : ' (só 2026)'), estado: noPadrao.length ? 'padrao' : 'tem', campo: ks[0],
      situacao: noPadrao.length ? 'no padrão: sem venda com alíquota zero' : como(ks[0]),
      onde: 'Domínio Escrita Fiscal: a apuração do PIS/Cofins, com as receitas por situação tributária (tributada, alíquota zero, monofásica).',
      auto: ks.length && ks.every(k => fonte(k) === 'ponte') ? AUTOMATICO.ponte : AUTOMATICO.cst });
  }
  if (temIss) {
    const ks = comRec.filter(x => tributo(x.a) === 'iss').map(x => 'atividades.' + x.i + '.aliqIss');
    const noPadrao = ks.filter(padrao);
    add('premissas', { id: 'iss', info: 'O ISS da atividade', estado: noPadrao.length ? 'padrao' : 'tem', campo: ks[0],
      situacao: noPadrao.length ? 'no padrão' : como(ks[0]),
      onde: 'A alíquota do município, nas notas de serviço (o Acompanhamento de Serviços do Domínio).',
      auto: AUTOMATICO.dominio });
  }
  if (!semFolha) {
    add('premissas', { id: 'rat', info: 'O RAT, o FAP e terceiros', estado: padrao('rat') ? 'padrao' : 'tem', campo: 'rat',
      situacao: padrao('rat') ? 'no padrão: RAT 2%, FAP 1 e terceiros 5,8%' : como('rat'),
      onde: 'Domínio Folha: o resumo da folha ou a guia da DCTFWeb do último mês.',
      // na empresa do Presumido ou do Real, a ponte traz das guias; no Simples a guia não tem (a CPP está no DAS)
      auto: fonte('rat') === 'ponte' ? AUTOMATICO.ponte : simples ? 'No Simples a guia não tem o RAT nem terceiros (a CPP está no DAS): pelo CNAE e pelo FAP da empresa.' : AUTOMATICO.ponte.replace('traz todo dia', 'traz das guias') });
  }
  if (receita > 0) {
    add('premissas', { id: 'crescimento', info: 'O crescimento', estado: padrao('crescimentoReceita') ? 'padrao' : 'tem', campo: 'crescimentoReceita',
      situacao: padrao('crescimentoReceita') ? 'no padrão: sem crescimento' : como('crescimentoReceita'),
      onde: 'A conversa com o cliente (contratar, abrir loja, ganhar ou perder um cliente grande); o sistema mostra o ritmo dos últimos meses.',
      auto: AUTOMATICO.conversa });
  }

  // ===== fase 4: o veredito =====
  const escolhas = [restaurante ? 'a opção do ICMS do restaurante' : null, geral ? 'o Real trimestral ou anual' : 'o Simples por dentro ou por fora na Reforma',
    geral ? 'a distribuição de lucros aos sócios' : null,
    receita * (1 + num(e.crescimentoReceita) / 100) > 5000000 ? 'a liminar contra o aumento do Presumido (LC 224)' : null].filter(Boolean);
  add('veredito', { id: 'conversa', info: 'As escolhas e os planos do cliente', estado: 'conversa', situacao: 'na reunião',
    onde: 'A reunião: a projeção' + (geral ? ' do lucro' : ', as despesas sem nota') + ' e as escolhas — ' + juntar(escolhas) + '.',
    auto: AUTOMATICO.conversa });
  return out;
}

// ---------- as fases ----------
// com o Simples na comparação (o objetivo 'todos'); a empresa do regime geral lê "pode entrar" no lugar de "pode ficar"
export const FASES = [
  { id: 'simples', titulo: 'Ela pode ficar no Simples?', objetivo: 'A receita, o limite de R$ 4,8 milhões, as empresas dos sócios e os impedimentos do cadastro: o Simples é uma opção em 2027 e 2028?' },
  { id: 'numeros', titulo: 'Os números da empresa', objetivo: 'A conta com os números de verdade: a folha, as compras, o PGDAS e as despesas.' },
  { id: 'premissas', titulo: 'As premissas', objetivo: 'O que ficou no padrão e pode virar o resultado: o ICMS, o crédito, o crescimento.' },
  { id: 'veredito', titulo: 'O veredito', objetivo: 'Com as missões que decidem cumpridas, o regime mais barato e quanto.' }
];
// só o Presumido contra o Real (o objetivo 'presumido_real'): de um lado a receita e a presunção, do outro o lucro da
// contabilidade; o resto da conta é igual nos dois (ICMS, ISS, INSS e, de 2027 em diante, a CBS e o IBS) ou só pesa em 2026
export const FASES_GERAL = [
  { id: 'presuncao', titulo: 'A receita e a presunção', objetivo: 'A receita dos 12 meses e a atividade de cada uma: é o que faz o IRPJ e a CSLL do Presumido.' },
  { id: 'lucro', titulo: 'O lucro do Real', objetivo: 'O lucro da contabilidade (a DRE até onde ela está feita), a confirmação de quem cuida dela e os ajustes: é o que faz o IRPJ e a CSLL do Real.' },
  { id: 'premissas', titulo: 'O resto da conta', objetivo: 'O PIS/Cofins de 2026 (cumulativo no Presumido, com crédito no Real) e o que é igual nos dois regimes: ICMS, ISS, INSS e, de 2027 em diante, a CBS e o IBS.' },
  { id: 'veredito', titulo: 'O veredito', objetivo: 'Com as missões que decidem cumpridas, o regime mais barato e quanto.' }
];
export function fasesDoObjetivo(objetivo, regimeAtual = null) {
  if (objetivo === 'presumido_real') return FASES_GERAL;
  const entrar = regimeAtual === 'presumido' || regimeAtual === 'real';
  return FASES.map((f, i) => (i === 0 && entrar ? { ...f, titulo: 'Ela pode entrar no Simples?' } : f));
}

// a missão "A atividade e a presunção", pelo que presuncaoDoEstudo achou: cumprida sozinha quando as notas dizem; aberta só
// com o que sobra pra equipe, dizendo o que fazer
function missaoDaPresuncao(p, titulo) {
  const usou = 'A conta usou: ' + p.partes.join('; ') + '.';
  const base = { id: 'presuncao', titulo, curto: 'a presunção', peso: 'importa', estado: p.feita ? 'feita' : 'aberta', como: p.como,
    efeito: 'serviço presume 32% e venda de mercadoria, 8%: a atividade errada muda o IRPJ e a CSLL do Presumido',
    campo: p.ks[0], irRotulo: 'Ver a atividade', conferir: p.ks, conferirRotulo: 'Está certa' };
  const esp = p.esp;
  if (p.caso === 'notas') return { ...base, texto: maiuscula(p.doDominio) + ', ' + p.descr + '. ' + usou + (p.pequeno ? DICA_DO_PEQUENO : '') };
  if (p.caso === 'especial_ok') return { ...base, texto: esp.regra + ' ' + usou };
  if (p.caso === 'especial') {
    const i0 = p.com.length ? p.com[0].i : 0;
    return { ...base, peso: 'decide', campo: 'atividades.' + i0 + '.presIrpj', irRotulo: 'Ver a presunção',
      efeito: 'a presunção própria da atividade (' + esp.nome + ') muda o IRPJ e a CSLL do Presumido',
      texto: 'O CNAE da empresa é de ' + esp.nome + (esp.cnae ? ' (' + esp.cnae + ')' : '') + '. ' + esp.regra + ' ' + usou + ' '
        + (esp.toda ? 'Ponha ' + pct(esp.irpj) + ' e ' + pct(esp.csll) + ' na presunção da atividade.' : esp.fazer) + ' Se a conta já está como deve, clique em Está certa.' };
  }
  if (p.caso === 'diverge') return { ...base, texto: maiuscula(p.doDominio) + ', ' + p.descr + '; no estudo, ' + p.doEstudo + '. ' + usou
    + ' Acerte a receita de cada atividade pra ficar como as notas; se o estudo é que está certo, clique em Está certa.' };
  if (p.caso === 'sem_notas') return { ...base, texto: p.semNotas + (p.fonteTipo === 'cadastro' ? ': a atividade veio do CNAE do cadastro' : '') + '. ' + usou + ' ' + REGRA_DA_PRESUNCAO
    + ' Se a empresa tem as duas receitas, separe cada uma numa atividade; se é isso mesmo, clique em Está certa.' + (p.pequeno ? DICA_DO_PEQUENO : '') };
  // conferida, ou a atividade que a equipe digitou, o relatório solto ou a apuração trouxe
  return { ...base, texto: usou + (p.pequeno ? DICA_DO_PEQUENO : '') };
}

// ---------- o roteiro ----------
// entrada e origens: as da tela · comparacao: comparar() (null se a conta não roda) · testes: testarPremissas()
// situacao: situacaoDoGrupo() (o ano-calendário pelos números do sistema) · serie: a receita datada da empresa
// socios: quantos sócios o cadastro tem (null = sem cadastro ou não lido) · achadas: quantas empresas dos sócios o sistema
// achou (a tela pode tirar da soma) · grupoFora: as que o sistema achou e a regra deixa fora da soma ([{ nome, motivo }])
// · conferencia: o PGDAS lido ({ fonte, … } ou null) · hoje: 'AAAA-MM-DD' (o último mês fechado, pro "até quando" das fontes)
// · objetivo: o comparativo escolhido ('todos' ou 'presumido_real'; sem ele, o da entrada, senão 'todos') · vedacoes: as do
//   Simples pelo cadastro (vedacoesDoSimples; null = não conferido) · contabil: o Controle das contabilidades ({ faz, feitaAte })
// Cada fase leva as fontes dela (fontesDoEstudo): o que usar, onde buscar e o que vai chegar sozinho.
// Volta { fases, passos, provisorio, decidem, pendentes, proximo, faseAtual, pronto, feitas, total, extras, doSistema }.
// Cada missão: { id, fase, titulo, curto (o nome na frase do resultado), texto, estado ('feita' | 'aberta'), falta (o
// número não existe — senão é conferir), peso ('decide' | 'importa' | 'detalhe' — a extra), como (cumprida como), campo
// (pra onde ir) e irRotulo, relatorio (o relatório do Domínio que cumpre a missão), conferir (os campos que o "está certo"
// marca) e conferirRotulo, acao ('mais-grupo') e acaoRotulo }. `passos` são as missões com o estado antigo (falta |
// conferir | feito), na ordem: o que falta e decide primeiro.
export function roteiroDoEstudo({ entrada = {}, origens = {}, comparacao = null, testes = [], situacao = null, serie = null, socios = null, achadas = 0, grupoFora = [], conferencia = null, hoje = null, objetivo = null, vedacoes = null, contabil = null,
  atividade = null, resultadoPonte = null } = {}) {
  const e = entrada || {}, o = origens || {};
  const obj = objetivoDe(objetivo, e);
  const geral = obj === 'presumido_real';
  const fonte = k => (o[k] && o[k].fonte) || 'padrao';
  const padrao = k => fonte(k) === 'padrao';
  const conferido = k => fonte(k) === 'confirmado';
  const como = k => COMO[fonte(k)] || 'feito';
  const ats = (e.atividades || []).filter(a => a && TIPOS[a.tipo]);
  const receita = ats.reduce((t, a) => t + num(a.receita), 0);
  const temIcms = ats.some(a => (a.tributo || TIPOS[a.tipo].tributo) === 'icms');
  const c = comparacao;
  const d = c && c.decisao;
  const rDec = c && d ? c.anos.find(r => r.ano === d.ano) : null;
  const ROT = r => ROTULO_REGIME[r] || r;
  const missoes = [];
  // usarPonte: a missão do lucro oferece o resultado que a ponte do Domínio tem hoje ({ ate }: até que mês)
  const add = m => missoes.push({ estado: 'aberta', falta: false, peso: 'importa', campo: null, conferir: null, relatorio: null, acao: null, como: null, efeito: '', usarPonte: null, ...m });
  // as fases do caminho: com o Simples, simples · numeros · premissas; só Presumido × Real, presuncao · lucro · premissas
  const F1 = geral ? 'presuncao' : 'simples', F2 = geral ? 'lucro' : 'numeros';
  const lucroInf = informado(e.lucroContabil);

  // ===== fase 1: a receita =====
  const recOk = receita > 0 && !ats.some((a, i) => padrao('atividades.' + i + '.receita') && !(num(a.receita) > 0));
  add({ id: 'receita', fase: F1, titulo: 'A receita dos 12 meses', curto: 'a receita', peso: 'decide',
    estado: recOk ? 'feita' : 'aberta', falta: !recOk, como: recOk ? como('atividades.0.receita') : null,
    texto: recOk ? brl(receita) + ' nos 12 meses.' : 'Sem ela não há conta. Solte o faturamento do Domínio ou digite os 12 meses.',
    efeito: 'sem a receita não há conta',
    campo: 'atividades.0.receita', irRotulo: 'Digitar a receita', relatorio: 'o faturamento' });

  const grupo = (e.grupo || []).filter(g => g && num(g.receita) > 0);
  const soma12 = receita + grupo.reduce((t, g) => t + num(g.receita), 0);
  const fora = c && !geral ? c.anos.filter(r => r.simples && r.simples.disponivel === false && !r.simples.fora) : [];
  const perto = receita > 0 && (soma12 >= 0.85 * LIMITE_SIMPLES || !!(situacao && situacao.passaEm) || fora.length > 0);
  const impedimentos = (vedacoes && vedacoes.impedimentos) || [];

  if (geral) {
    // ===== fase 1 (Presumido × Real): a atividade de cada receita faz a presunção =====
    if (receita > 0) add({ fase: F1, ...missaoDaPresuncao(presuncaoDoEstudo({ entrada: e, origens: o, atividade }), 'A atividade e a presunção') });
  } else {
    // ===== fase 1 (com o Simples): os impedimentos do cadastro, o limite e as empresas dos sócios =====
    if (vedacoes) {
      const conf = vedacoes.conferir || [], sem = vedacoes.semDado || [];
      const lista = l => l.map(i => i.texto + ' (' + i.base + ')').join('; ');
      const remedios = [...new Set(impedimentos.map(i => i.remedio).filter(Boolean))].join(' ');
      const semTxt = sem.length ? ' Faltou no cadastro pra conferir: ' + juntar(sem) + '.' : '';
      const naoConfere = ' O sistema não confere: ' + NAO_CONFERE.join('; ') + '.';
      if (impedimentos.length) {
        add({ id: 'vedacoes', fase: F1, titulo: 'Os impedimentos do Simples', curto: 'os impedimentos do Simples', peso: 'decide',
          estado: conferido('vedacoes') ? 'feita' : 'aberta', como: 'simulação: a empresa vai tirar os impedimentos',
          texto: 'O Simples está vedado hoje. ' + lista(impedimentos) + '.' + (remedios ? ' ' + remedios : '') + (conf.length ? ' A conferir: ' + lista(conf) + '.' : '')
            + ' A conta do Simples vale como simulação: só serve se a empresa tirar os impedimentos.' + semTxt,
          efeito: 'com impedimento, o Simples não é opção: a conta dele é só simulação',
          conferir: ['vedacoes'], conferirRotulo: 'Vai tirar os impedimentos' });
      } else if (conf.length) {
        add({ id: 'vedacoes', fase: F1, titulo: 'Os impedimentos do Simples', curto: 'os impedimentos do Simples', peso: 'importa',
          estado: conferido('vedacoes') ? 'feita' : 'aberta', como: 'conferido',
          texto: 'Pelo cadastro, nada veda o Simples, mas há o que conferir: ' + lista(conf) + '.' + semTxt + naoConfere,
          efeito: 'se confirmar, o Simples deixa de ser opção', conferir: ['vedacoes'], conferirRotulo: 'Conferido' });
      } else {
        add({ id: 'vedacoes', fase: F1, titulo: 'Os impedimentos do Simples', curto: 'os impedimentos do Simples', peso: 'detalhe',
          estado: sem.length && !conferido('vedacoes') ? 'aberta' : 'feita', como: conferido('vedacoes') ? 'conferido' : 'o sistema olhou o cadastro',
          texto: (oQueConferiu(vedacoes) ? 'Pelo cadastro, nada veda o Simples: ' + oQueConferiu(vedacoes) + '.' : 'O cadastro não tem o que conferir das vedações do Simples.') + semTxt + naoConfere,
          efeito: 'com impedimento, o Simples não é opção', conferir: sem.length ? ['vedacoes'] : null, conferirRotulo: 'Conferido' });
      }
    }
    if (receita > 0 && (grupo.length || soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE || fora.length)) {
      const partes = [];
      if (grupo.length) partes.push('Os sócios também têm ' + juntar(grupo.map(g => g.nome)) + '. O limite de R$ 4,8 milhões vale pra soma: nos 12 meses, ' + brl(soma12) + ' (' + pct0(soma12 / LIMITE_SIMPLES * 100) + '% do limite).');
      else if (soma12 >= 0.8 * LIMITE_SIMPLES) partes.push('A receita dos 12 meses é ' + brl(receita) + ', ' + pct0(receita / LIMITE_SIMPLES * 100) + '% do limite de R$ 4,8 milhões.');
      if (situacao && situacao.meses > 0) {
        let t = 'Em ' + situacao.ano + ', até ' + rotuloComp(situacao.ate) + ', ' + (grupo.length ? 'as empresas somam ' : 'a receita é de ') + brl(situacao.acumulado) + '.';
        const tolerancia = situacao.noAnoSeguinte ? ' (sozinha, o excesso de até 20% só tira do Simples no ano seguinte)' : '';
        if (situacao.jaPassou) t += ' Passou do limite em ' + situacao.passaEm + ': a exclusão vale a partir de ' + situacao.saiEm + tolerancia + '.';
        else if (situacao.passaEm) t += ' No ritmo dos últimos 3 meses (' + brl(situacao.ritmo) + ' por mês), passa do limite em ' + situacao.passaEm + (grupo.length ? ' e as empresas saem' : ' e a empresa sai') + ' do Simples em ' + situacao.saiEm + tolerancia + '.';
        else if (situacao.restantes > 0) t += ' Faltam ' + brl(situacao.faltam) + ' pro limite, ' + brl(situacao.porMesAteOLimite) + ' por mês até dezembro; o ritmo dos últimos 3 meses é ' + brl(situacao.ritmo) + ' por mês.';
        partes.push(t);
      }
      if (receita >= 0.85 * SUBLIMITE) partes.push('Sozinha, a receita está perto do sublimite de R$ 3,6 milhões: acima dele no ano, o ICMS e o ISS saem do DAS (a conta já faz isso).');
      (grupoFora || []).forEach(g => partes.push(g.nome + ' é dos mesmos sócios, mas fica fora da soma: ' + g.motivo + '.'));
      if (fora.length) partes.push('Na conta, o Simples fica fora ' + juntar(fora.map(r => r.k === 0 ? 'nos 12 meses' : 'em ' + r.ano)) + ': ' + fora[0].simples.motivo);
      partes.push(situacao ? 'Confira os meses mais recentes no Domínio: eles decidem.' : 'Confira a receita das outras empresas.');
      add({ id: 'limite', fase: F1, titulo: grupo.length ? 'A receita somada com as empresas dos sócios' : 'O limite do Simples', curto: 'o limite do Simples',
        texto: partes.join(' '), peso: perto ? 'decide' : 'importa', estado: conferido('grupo') ? 'feita' : 'aberta', como: 'conferido',
        efeito: 'acima do limite, o Simples deixa de ser opção',
        campo: grupo.length ? 'grupo.0.receita' : 'crescimentoReceita', irRotulo: grupo.length ? 'Ver as empresas' : 'Ver a projeção',
        conferir: ['grupo'], conferirRotulo: 'Conferido' });
    } else if (receita > 0) {
      // longe do limite: as empresas dos sócios ficam como extra — o sistema já olhou o cadastro, ou o cadastro não tem os sócios
      // (a empresa que o sistema achou e a tela tirou da soma fica dita)
      const semSocios = !(num(socios) > 0);
      const tirada = num(achadas) > 0 && !grupo.length;
      const pelaRegra = (grupoFora || []).length > 0 && !grupo.length && !tirada;
      const feita = !semSocios || tirada || conferido('grupo');
      add({ id: 'limite', fase: F1, titulo: 'As empresas dos sócios', curto: 'as empresas dos sócios', peso: 'detalhe',
        estado: feita ? 'feita' : 'aberta', como: conferido('grupo') ? 'conferido' : tirada ? 'tirada da soma' : 'o sistema olhou o cadastro',
        texto: pelaRegra
          ? grupoFora.map(g => g.nome + ' é dos mesmos sócios, mas fica fora da soma: ' + g.motivo + '.').join(' ')
          : tirada
          ? 'A empresa dos sócios que o sistema achou ficou fora da soma. Se ela ainda for dos sócios, ponha de volta: o limite de R$ 4,8 milhões vale pra soma.'
          : semSocios
          ? 'O cadastro não tem os sócios desta empresa. Se eles tiverem outra empresa, o limite de R$ 4,8 milhões vale pra soma — longe dele, só pesa se a outra for grande.'
          : 'Nenhuma outra empresa dos sócios no cadastro. Se eles tiverem empresa fora do escritório, ponha aqui: o limite vale pra soma.',
        efeito: 'a receita das empresas dos sócios soma no limite do Simples',
        acao: 'mais-grupo', acaoRotulo: '+ Empresa dos mesmos sócios', conferir: semSocios ? ['grupo'] : null, conferirRotulo: 'Não têm outra empresa' });
    }
  }

  // ===== fase 2: os números da empresa (no Presumido × Real: o lucro do Real) =====
  const semFolha = !(num(e.folha) + num(e.proLabore) > 0);
  // a ponte do Domínio leu a folha e o pró-labore e os dois deram zero: a empresa não tem (não é dado que falta)
  const zeroPelaPonte = semFolha && fonte('folha') === 'ponte' && fonte('proLabore') === 'ponte';
  const folhaOk = (!semFolha && !padrao('folha')) || conferido('folha') || fonte('folha') === 'digitado' || zeroPelaPonte;
  const faltaFolha = !folhaOk;
  const custos = num(e.compras) + num(e.despesasCredito) + num(e.folha) * 1.08 + num(e.proLabore) + num(e.outrasDespesas);
  // com o Simples na comparação, a presunção só vira missão quando a atividade tem presunção própria pelo CNAE (o
  // transporte, o hospital, a obra, o combustível): a coluna do Presumido depende dela, e a nota não diz
  if (!geral && receita > 0 && atividade && atividade.especial) {
    const p = presuncaoDoEstudo({ entrada: e, origens: o, atividade });
    if (p.caso === 'especial' || p.feita) add({ fase: F2, ...missaoDaPresuncao(p, 'A presunção do Presumido'), peso: 'importa', conferir: ['presuncao'] });
  }
  if (geral) {
    const emp = d && d.real ? d.real.empate.presumido : null;
    const empTxt = !emp ? '' : emp.nunca ? ' Nem com lucro zero o Real fica abaixo do Presumido.'
      : ' O Real empata com o Presumido com lucro de ' + brl(emp.lucro) + ' antes do IR (' + pct(emp.margem * 100) + '% da receita): abaixo disso, o Real sai mais barato.';
    // os meses da receita, a DRE que o estudo pede (até onde a contabilidade está feita, pelo Controle das contabilidades) e
    // a que ele tem; o que falta dos 12 meses entra pela margem dos meses feitos (lucroDoEstudo)
    const L = lucroDoEstudo({ entrada: e, origens: o, serie, contabil, resultadoPonte });
    // o que a ponte do Domínio tem hoje do resultado: a frase e o botão da missão (usar, atualizar)
    const dp = daPonteNaMissao(L.ponte, L.jan ? L.jan.meses.length : 0);
    const feitaAte = contabil && contabil.faz !== false ? contabil.feitaAte || null : null;
    const foraDaqui = contabil && contabil.faz === false ? ' O escritório não faz a contabilidade dela: o lucro vem do contador de lá ou do cliente.' : '';
    const lucroOuPrej = x => (x < 0 ? 'prejuízo de ' + brl(-x) : 'lucro de ' + brl(x));
    if (lucroInf) {
      const dre = L.dre;
      const per = dre ? 'de ' + rotuloComp(dre.de) + ' a ' + rotuloComp(dre.ate) : 'dos 12 meses';
      const parcial = !!(dre && Math.abs(dre.fator - 1) > 0.0005);
      const v = num(e.lucroContabil);
      // a DRE de só uma parte dos meses da receita: os que faltam entram pela margem dos que ela tem
      const parteTxt = !parcial ? '' : dre.janela && dre.faltam.length ? ' (' + dre.meses + ' dos ' + dre.janela.meses + ' meses da receita): com ' + (dre.faltam.length > 3 ? 'os outros ' + dre.faltam.length : juntar(dre.faltam.map(rotuloComp))) + ' pela mesma margem, ' + lucroOuPrej(v * dre.fator) + ' nos 12 meses'
        : ': pela receita, ' + lucroOuPrej(v * dre.fator) + ' nos 12 meses';
      const ctbTxt = foraDaqui || (!feitaAte || !dre ? '' : dre.ate > feitaAte ? ' Pelo Controle das contabilidades, ela está feita só até ' + rotuloComp(feitaAte) + ': a DRE usada vai além disso.'
        : dre.faltam.length && feitaAte > dre.ate ? ' A contabilidade já está feita até ' + rotuloComp(feitaAte) + ': atualize o lucro com a DRE até lá.'
        : ' Pelo Controle das contabilidades, ela está feita até ' + rotuloComp(feitaAte) + '.');
      const lr = d && d.real ? d.real.lucro : null;
      // a troca: os tributos de hoje que a DRE descontou (o PIS/Cofins do Presumido, o DAS do Simples) saem e entram os do Real
      const troca = rDec && rDec.real.disponivel ? rDec.real.trocaTributos : null;
      const trocaTxt = troca == null ? ', sem a troca dos tributos (falta o regime de hoje)' : Math.abs(troca) < 0.5 ? ', sem diferença de tributos entre hoje e o Real'
        : ': o da DRE ' + (troca > 0 ? 'mais ' : 'menos ') + brl(Math.abs(troca)) + ' da troca dos tributos de hoje pelos do Real';
      // o lucro que veio da ponte e já não é o que o Domínio mostra no mesmo período: a missão reabre, pra atualizar
      add({ id: 'lucro', fase: F2, titulo: 'O lucro da contabilidade', curto: 'o lucro da contabilidade', peso: 'decide', estado: L.ponte.reabre ? 'aberta' : 'feita', como: como('lucroContabil'),
        texto: maiuscula(lucroOuPrej(v)) + ' na DRE ' + per + parteTxt + '.' + (parcial && dre.janela ? poucosMeses(dre.meses, dre.janela.meses) : '')
          + (lr != null ? ' No Real de ' + d.ano + ', ' + lucroOuPrej(lr) + ' antes do IR' + trocaTxt + '.' : '') + empTxt + ctbTxt + dp.frase,
        efeito: L.ponte.reabre ? 'o lucro do estudo já não é o que o Domínio mostra: o IRPJ e a CSLL do Real saem dele' : 'o IRPJ e a CSLL do Real saem dele', ...dp.campos });
      // quem cuida da contabilidade confirma que o resultado até ali é confiável: sem isso, o estudo segue provisório
      add({ fase: F2, ...missaoDaConfirmacao(L, 'decide', alertasDoResultado({ L, comparacao: c, entrada: e })) });
      const ajOk = !padrao('ajustesLalur');
      add({ id: 'ajustes', fase: F2, titulo: 'As adições e as exclusões', curto: 'as adições e exclusões', peso: 'detalhe', estado: ajOk ? 'feita' : 'aberta', como: ajOk ? como('ajustesLalur') : null,
        texto: ajOk ? (num(e.ajustesLalur) ? brl(e.ajustesLalur) + ' de adições menos exclusões.' : 'Sem ajustes no lucro real.')
          : 'No padrão, zero. Despesa indedutível (multa, brinde, doação) soma no lucro real; receita que não é tributada tira.',
        efeito: 'cada R$ 1.000 de adição põe de R$ 240 a R$ 340 no IRPJ e na CSLL do Real',
        campo: 'ajustesLalur', irRotulo: 'Digitar os ajustes', conferir: ajOk ? null : ['ajustesLalur'], conferirRotulo: 'Sem ajustes' });
    } else {
      // sem o lucro da DRE: a estimativa, as outras despesas que a refinam ou o "seguir com a estimativa"
      const naoServe = receita > 0 && custos > receita;
      const seguiu = conferido('lucroContabil') || (!padrao('outrasDespesas') && !naoServe);
      const est = d && d.real ? d.real.lucro : null;
      const sug = L.sug;
      const feitaTxt = feitaAte ? ' Pelo Controle das contabilidades, ela está feita até ' + rotuloComp(feitaAte) + '.' : '';
      // o que pedir: a DRE até onde a contabilidade está feita (e não até o fim da receita, que ainda não fecha)
      const pede = !sug ? 'Falta o lucro da DRE dos 12 meses, antes do IRPJ e da CSLL.'
        : sug.antes ? 'Falta o lucro da DRE, antes do IRPJ e da CSLL. Pelo Controle das contabilidades, ' + (feitaAte ? 'ela está feita até ' + rotuloComp(feitaAte) : 'nenhum mês está feito')
          + ': nenhum dos meses da receita (' + rotuloComp(sug.de) + ' a ' + rotuloComp(sug.faltam[sug.faltam.length - 1]) + ').'
        : sug.faltam.length ? 'Falta o lucro da DRE, antes do IRPJ e da CSLL. Pelo Controle das contabilidades, ela está feita até ' + rotuloComp(feitaAte) + ': use a DRE de ' + rotuloComp(sug.de) + ' a ' + rotuloComp(sug.ate)
          + ' (' + sug.meses + ' dos ' + sug.total + ' meses da receita): ' + (sug.faltam.length > 3 ? 'os outros ' + sug.faltam.length : juntar(sug.faltam.map(rotuloComp))) + (sug.faltam.length === 1 ? ' entra' : ' entram')
          + ' pela margem ' + (sug.meses === 1 ? 'desse mês' : 'desses ' + sug.meses) + '.' + poucosMeses(sug.meses, sug.total)
        : 'Falta o lucro da DRE de ' + rotuloComp(sug.de) + ' a ' + rotuloComp(sug.ate) + ', antes do IRPJ e da CSLL.' + feitaTxt;
      add({ id: 'lucro', fase: F2, titulo: 'O lucro da contabilidade', curto: 'o lucro da contabilidade', peso: 'decide',
        estado: seguiu ? 'feita' : 'aberta', falta: !seguiu, como: seguiu ? (conferido('lucroContabil') ? 'pela estimativa' : 'estimado, com as outras despesas') : null,
        texto: (seguiu ? 'A conta segue com o lucro estimado' : pede + foraDaqui + ' Sem ele, a conta estima o lucro do Real')
          + ' (a receita menos as compras, a folha e as despesas)' + (est != null ? ': ' + (est < 0 ? 'prejuízo de ' + brl(-est) : brl(est)) + ' em ' + d.ano + '.' : '.')
          + (naoServe ? ' As compras, as despesas com nota e a folha passam da receita: a empresa formou estoque, investiu ou teve prejuízo, e a estimativa não serve pra decidir.' : '')
          + empTxt + (seguiu ? foraDaqui || feitaTxt : '') + dp.frase,
        efeito: 'é o número que decide entre o Presumido e o Real: o IRPJ e a CSLL do Real saem dele',
        campo: 'lucroContabil', irRotulo: 'Digitar o lucro da DRE', conferir: seguiu ? null : ['lucroContabil'], conferirRotulo: 'Seguir com a estimativa', ...dp.campos });
      // enquanto o lucro é pedido, a confirmação já tem o que olhar (o que o Domínio mostra até onde a contabilidade vai)
      if (!seguiu && L.ate) add({ fase: F2, ...missaoDaConfirmacao(L, 'decide', alertasDoResultado({ L, comparacao: c, entrada: e })) });
    }
  }
  add({ id: 'folha', fase: F2, titulo: 'A folha e o pró-labore', curto: 'a folha e o pró-labore', peso: geral && lucroInf ? 'detalhe' : 'decide',
    estado: folhaOk ? 'feita' : 'aberta', falta: !folhaOk, como: folhaOk ? (zeroPelaPonte ? 'veio do Domínio pela ponte' : semFolha ? 'sem folha nem pró-labore' : como('folha')) : null,
    texto: folhaOk
      ? (zeroPelaPonte ? 'Pelo Domínio, a empresa não tem folha nem pró-labore calculados nos 12 meses.' : semFolha ? 'A empresa não tem folha nem pró-labore.' : 'Folha de ' + brl(e.folha) + ' e pró-labore de ' + brl(e.proLabore) + ' nos 12 meses.')
        + (geral && lucroInf ? ' O INSS é igual no Presumido e no Real, e a DRE já traz a folha: não muda a diferença entre os dois.' : '')
      : geral && lucroInf ? 'Faltam. O INSS patronal (cerca de 28% da folha e 20% do pró-labore) é igual no Presumido e no Real: sem eles, os dois totais saem menores, e a diferença entre eles fica.'
      : 'Faltam. Sem eles, o INSS patronal (cerca de 28% da folha e 20% do pró-labore) sai zero: o Presumido parece mais barato do que é e, no Real, o lucro sai maior do que é.' +
        (!geral && ats.some(a => a.tipo === 'servico_r') ? ' No Simples, o serviço do fator r fica no Anexo V sem folha.' : '') + ' É o número que mais falta.',
    efeito: geral && lucroInf ? 'o INSS é igual nos dois regimes: muda os totais, não a diferença' : 'sem ela o INSS patronal sai zero e o lucro estimado do Real, maior',
    campo: 'folha', irRotulo: 'Digitar a folha', relatorio: 'o resumo da folha', conferir: folhaOk ? null : ['folha', 'proLabore'], conferirRotulo: 'Não tem folha nem pró-labore' });

  if (receita > 0) {
    const comprasOk = !padrao('compras') && (num(e.compras) > 0 || conferido('compras') || fonte('compras') === 'digitado');
    add({ id: 'compras', fase: geral ? 'premissas' : F2, titulo: 'As compras', curto: 'as compras', peso: temIcms ? 'importa' : 'detalhe',
      estado: comprasOk ? 'feita' : 'aberta', falta: !comprasOk, como: comprasOk ? como('compras') : null,
      texto: comprasOk ? brl(e.compras) + ' em mercadorias e insumos nos 12 meses.'
        : geral ? 'Sem as compras, o crédito de ICMS, o de PIS/Cofins do Real (2026) e o de CBS/IBS (2027)' + (lucroInf ? '' : ' e o lucro estimado do Real') + ' saem errados. Solte o acompanhamento de entradas do Domínio ou digite.'
        : 'Sem as compras, o lucro do Real e o crédito de ICMS e de CBS/IBS saem errados. Solte o acompanhamento de entradas do Domínio ou digite.',
      efeito: 'fazem o crédito de ICMS, de PIS/Cofins e de CBS/IBS' + (lucroInf ? '' : ' e o lucro estimado do Real'),
      campo: 'compras', irRotulo: 'Digitar as compras', relatorio: 'as entradas', conferir: comprasOk ? null : ['compras'], conferirRotulo: 'Não tem compras' });
  }
  if (!geral && receita > 0 && e.regimeAtual === 'simples') {
    const pgOk = !!(conferencia && num(conferencia.aliquota) > 0);
    add({ id: 'pgdas', fase: F2, titulo: 'O PGDAS', curto: 'o PGDAS', peso: 'importa',
      estado: pgOk ? 'feita' : 'aberta', falta: !pgOk, como: pgOk ? (COMO[conferencia.fonte] || 'veio do sistema') : null,
      texto: pgOk ? 'O de ' + rotuloComp(conferencia.competencia) + ' confere a conta do Simples: alíquota efetiva de ' + pct(conferencia.aliquota, 2) + '%.'
        : 'O PGDAS confere a conta do Simples e mostra o ST, o monofásico e as reduções do ICMS. Solte o do último mês.',
      efeito: 'confere a conta do Simples e mostra o ST, o monofásico e a redução do ICMS',
      relatorio: 'o PGDAS' });
  }
  if (!geral && rDec && d && d.real) {
    const alvo = d.melhor === 'real' ? d.segundo : d.melhor;
    const emp = alvo && d.real.empate[alvo];
    const despOk = !padrao('outrasDespesas') || num(e.outrasDespesas) > 0;
    const L = lucroDoEstudo({ entrada: e, origens: o, serie, contabil, resultadoPonte });
    // o que a ponte do Domínio tem hoje do resultado: a frase e o botão da missão (usar, atualizar)
    const dp = daPonteNaMissao(L.ponte, L.jan ? L.jan.meses.length : 0);
    if (lucroInf) {
      const parcial = !!(L.dre && Math.abs(L.dre.fator - 1) > 0.0005);
      const per = L.dre ? 'de ' + rotuloComp(L.dre.de) + ' a ' + rotuloComp(L.dre.ate) + (parcial ? ', levada aos 12 meses pela receita' : '') : 'dos 12 meses';
      add({ id: 'lucro', fase: F2, titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: 'importa', estado: L.ponte.reabre ? 'aberta' : 'feita', como: como('lucroContabil'),
        texto: (num(e.lucroContabil) < 0 ? 'Prejuízo de ' + brl(-num(e.lucroContabil)) : 'Lucro de ' + brl(e.lucroContabil)) + ' na DRE ' + per + ': no Real de ' + d.ano + ', ' + brl(d.real.lucro) + ' antes do IR, com os tributos de hoje trocados pelos do Real.' + dp.frase,
        efeito: 'o IRPJ e a CSLL do Real saem dele', ...dp.campos });
      add({ fase: F2, ...missaoDaConfirmacao(L, 'importa', alertasDoResultado({ L, comparacao: c, entrada: e })) });
    } else if (despOk) {
      add({ id: 'lucro', fase: F2, titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: 'importa', estado: 'feita', como: como('outrasDespesas'),
        texto: 'Outras despesas de ' + brl(e.outrasDespesas) + ': a conta usou lucro de ' + brl(d.real.lucro) + ' antes do IR.' + dp.frase, efeito: 'o lucro abaixo do empate faz o Real ganhar', ...dp.campos });
    } else if (emp && emp.nunca) {
      add({ id: 'lucro', fase: F2, titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: 'detalhe', estado: 'feita', como: 'a conta mostrou',
        texto: 'Nem com lucro zero o Real fica abaixo do ' + ROT(alvo) + ': as despesas sem nota não mudam a decisão.' + dp.frase, efeito: 'não muda a decisão', ...dp.campos });
    } else if (emp) {
      const margem = emp.margem != null ? emp.margem * 100 : 0;
      const decide = d.melhor === 'real' || margem >= 5;
      add({ id: 'lucro', fase: F2, titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: decide ? 'decide' : 'detalhe',
        texto: 'O Real empata com o ' + ROT(alvo) + ' com lucro de ' + brl(emp.lucro) + ' antes do IR (' + pct(margem) + '% da receita); a conta usou ' + brl(d.real.lucro) +
          (faltaFolha ? ', sem a folha e' : ',') + ' sem as despesas sem nota (aluguel de pessoa física, aplicativo de entrega, gás, manutenção, contador). ' + (decide ? 'Se o lucro de verdade ficar abaixo do empate, o Real sai mais barato.' : 'Só um lucro bem baixo faria o Real ganhar.') + dp.frase,
        efeito: 'o lucro abaixo do empate faz o Real ganhar: o da DRE é o número certo',
        campo: 'outrasDespesas', irRotulo: 'Digitar as despesas', conferir: ['outrasDespesas'], conferirRotulo: 'Não tem outras despesas', ...dp.campos });
    }
  }

  // ===== fase 3: as premissas =====
  // no Presumido × Real, o PIS/Cofins das vendas (só a conta de 2026): monofásico ou alíquota zero tira o tributo
  if (geral && temIcms && c && c.anos[0] && c.anos[0].ano < 2027) {
    const com = ats.map((a, i) => ({ a, i })).filter(x => num(x.a.receita) > 0 && (x.a.tributo || TIPOS[x.a.tipo].tributo) === 'icms');
    // a venda com alíquota zero (pctAliqZero) é a que fica no padrão até alguém conferir; a revenda monofásica vem do sistema
    const ks = com.map(x => 'atividades.' + x.i + '.pctAliqZero');
    const noPadrao = ks.filter(padrao);
    const b0 = c.anos[0];
    const pc = b0.presumido.disponivel ? (b0.presumido.itens || []).filter(i => i.tributo === 'PIS' || i.tributo === 'Cofins').reduce((t, i) => t + i.valor, 0) : 0;
    const sem = com.reduce((t, x) => t + num(x.a.receita) * Math.min(100, num(x.a.pctMonofasico) + num(x.a.pctAliqZero)) / 100, 0);
    // a parte com alíquota zero que a LC 224 alcança (fora da Cesta Básica Nacional): 10% da alíquota desde abril de 2026
    const lc224 = b0.ano === 2026 ? com.reduce((t, x) => t + (x.a.aliqZeroCesta ? 0 : num(x.a.receita) * Math.max(0, Math.min(100, num(x.a.pctMonofasico) + num(x.a.pctAliqZero)) - num(x.a.pctMonofasico)) / 100), 0) : 0;
    const mono = com.reduce((t, x) => t + num(x.a.receita) * Math.min(100, num(x.a.pctMonofasico)) / 100, 0);
    const quais = !(mono > 0.005) ? 'com alíquota zero' : sem - mono > 0.005 ? 'monofásicas ou com alíquota zero' : 'de revenda monofásica';
    // com o lucro da contabilidade, o PIS/Cofins também mexe no lucro do Real (a DRE descontou o de hoje): o teste diz se vira
    const vira = (testes || []).filter(t => /\.pctAliqZero$/.test(t.campo) && t.muda).flatMap(t => t.variantes.filter(x => x.melhor !== t.melhorBase));
    add({ id: 'piscofins', fase: 'premissas', titulo: 'O PIS/Cofins das vendas', curto: 'o PIS/Cofins das vendas', peso: vira.length ? 'decide' : 'importa',
      estado: noPadrao.length ? 'aberta' : 'feita', como: noPadrao.length ? null : como(ks[0]),
      texto: (noPadrao.length ? (sem > 0 ? 'No padrão, sem venda com alíquota zero (' + brl(sem) + ' de revenda monofásica já fora)' : 'No padrão, toda a venda paga PIS/Cofins') : sem > 0 ? brl(sem) + ' das vendas ' + quais : 'Toda a venda paga PIS/Cofins')
        + (!(pc > 0.005) ? ': em ' + b0.ano + ', sem PIS/Cofins a pagar no Presumido nem no Real (no Real, o crédito do que foi comprado com PIS/Cofins fica e pode ser ressarcido: fora da conta).'
          : lc224 > 0 ? ': em ' + b0.ano + ', ' + brl(pc) + ' no Presumido. Desde abril de 2026 a alíquota zero de fora da Cesta Básica Nacional (LC 214, Anexos I e XV) paga 10% da alíquota: 0,365% no Presumido e 0,925% no Real, menos os créditos (LC 224/2025). Se os produtos são da Cesta Básica Nacional, marque na atividade: seguem com zero.'
          : ': em ' + b0.ano + ', ' + brl(pc) + ' no Presumido (3,65%, cumulativo); no Real, 9,25% menos os créditos.')
        + (noPadrao.length ? ' Se o produto tem alíquota zero (a Lei 10.925/2004, art. 1º: óleos vegetais, arroz, feijão, carnes, leite, higiene…), informe a parte das vendas com alíquota zero. As da Cesta Básica Nacional (LC 214, Anexos I e XV) seguem com zero; as outras pagam 10% da alíquota desde abril de 2026 (LC 224/2025).' : '')
        + (lucroInf ? ' Em 2027 a CBS toma o lugar, igual nos dois regimes, mas o PIS/Cofins de hoje entra no lucro do Real: é o que a DRE descontou.' : ' Só pesa em ' + b0.ano + ': em 2027 a CBS toma o lugar, igual nos dois regimes.')
        + (vira.length ? ' Com alíquota zero em toda a venda, o mais barato passa a ser o ' + ROT(vira[0].melhor) + '.' : ''),
      irRotulo: 'Ir ao campo',
      efeito: vira.length ? 'com alíquota zero em toda a venda, o mais barato passa a ser o ' + ROT(vira[0].melhor)
        : lucroInf ? 'muda a conta de ' + b0.ano + ' e o lucro do Real (o PIS/Cofins que a DRE descontou)' : 'só a conta de ' + b0.ano + ': com alíquota zero nas vendas, o Presumido fica até ' + brl(pc) + ' mais barato',
      campo: ks[0], conferir: noPadrao.length ? noPadrao : null, conferirRotulo: sem > 0 ? 'Sem venda com alíquota zero' : 'Toda a venda paga' });
  }
  // as que ficaram no padrão e viram o resultado (sem a folha, a virada pro Presumido ainda não diz muito: o INSS da folha o
  // encarece; no Real, a folha abate o lucro e o IR a menos passa o INSS a mais — a virada pro Real fica de pé)
  const testadas = new Set();
  (testes || []).filter(t => t.muda).forEach(t => {
    testadas.add(t.campo);
    if (geral && /\.pctAliqZero$/.test(t.campo)) return;   // já está na missão do PIS/Cofins das vendas
    const v = t.variantes.filter(x => x.melhor !== t.melhorBase);
    const un = !t.unidade ? '' : t.unidade.startsWith('%') ? t.unidade : ' ' + t.unidade;
    const atual = pegar(e, t.campo);
    const pelaFolha = faltaFolha && v.every(x => x.melhor === 'presumido');
    add({ id: 'premissa:' + t.campo, fase: 'premissas', titulo: maiuscula(t.rotulo), curto: t.rotulo, peso: pelaFolha ? 'importa' : 'decide',
      texto: 'Está no padrão' + (atual != null ? ' (' + pct(atual, 2) + un + ')' : '') + '. Com ' + v.map(x => pct(x.valor, 2) + un + ', o mais barato passa a ser o ' + ROT(x.melhor)).join('; com ') + '.' +
        (pelaFolha ? ' Sem a folha na conta, isso ainda não diz muito: o INSS dela encarece o Presumido. Confira depois dela.' : ''),
      efeito: 'está no padrão e, com outro valor, o mais barato muda',
      campo: t.campo, irRotulo: 'Ir ao campo', conferir: [t.campo], conferirRotulo: 'Está certo' });
  });
  if (receita > 0) {
    const g = crescimentoMedido(serie);
    const pertoDoLimite = !geral && (soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE);
    const crescOk = !padrao('crescimentoReceita');
    add({ id: 'crescimento', fase: 'premissas', titulo: 'O crescimento', curto: 'o crescimento', peso: pertoDoLimite ? 'decide' : 'importa',
      estado: crescOk ? 'feita' : 'aberta', como: crescOk ? como('crescimentoReceita') : null,
      texto: crescOk ? (num(e.crescimentoReceita) ? pct(e.crescimentoReceita) + '% ao ano nas projeções.' : 'Sem crescimento: 2027 e 2028 repetem os 12 meses.')
        : 'Sem crescimento, 2027 e 2028 repetem os 12 meses.' + (g ? ' Pelos números do sistema, de ' + rotuloComp(g.fim[0]) + ' a ' + rotuloComp(g.fim[1]) + ' a receita '
            + (Math.abs(g.pct) < 0.5 ? 'ficou no nível' : 'veio ' + pct(Math.abs(g.pct), 0) + '% ' + (g.pct >= 0 ? 'acima' : 'abaixo')) + ' da de ' + rotuloComp(g.ini[0]) + ' a ' + rotuloComp(g.ini[1]) + '.' : '') +
          (pertoDoLimite ? ' Perto do limite, o crescimento decide quando ela sai do Simples.' : ''),
      efeito: pertoDoLimite ? 'perto do limite, decide quando ela sai do Simples' : 'muda as contas de 2027 e 2028',
      campo: 'crescimentoReceita', irRotulo: 'Ir à projeção', conferir: crescOk ? null : ['crescimentoReceita', 'crescimentoFolha'], conferirRotulo: 'Sem crescimento está certo' });
  }
  // o resto que pesa na conta: os padrões que não viram o resultado, juntos numa extra
  const jaNoRoteiro = new Set(missoes.flatMap(m => m.conferir || []).concat([...testadas]));
  const relevantes = [];
  const ver = k => { if (!jaNoRoteiro.has(k) && !relevantes.includes(k)) relevantes.push(k); };
  ats.forEach((a, i) => {
    if (!(num(a.receita) > 0)) return;
    if ((a.tributo || TIPOS[a.tipo].tributo) === 'icms') {
      ver('atividades.' + i + '.aliqIcms'); if (num(a.redIcms) > 0 || !padrao('atividades.' + i + '.redIcms')) ver('atividades.' + i + '.redIcms'); if (!geral && num(a.redIcmsSimples) > 0) ver('atividades.' + i + '.redIcmsSimples');
      // com o Simples na comparação, as vendas com alíquota zero de PIS/Cofins só mexem no Presumido e no Real de 2026 (no
      // Presumido × Real elas têm a missão delas)
      if (!geral && c && c.anos[0] && c.anos[0].ano < 2027) ver('atividades.' + i + '.pctAliqZero');
    } else ver('atividades.' + i + '.aliqIss');
  });
  if (num(e.compras) > 0) { if (temIcms) ver('aliqCreditoIcms'); ver('pctComprasSimples'); }
  if (!semFolha) { ver('rat'); ver('terceiros'); }
  const noPadrao = relevantes.filter(padrao);
  if (relevantes.length) {
    add({ id: 'resto', fase: 'premissas', titulo: 'Os outros padrões', curto: 'os padrões', peso: 'detalhe',
      estado: noPadrao.length ? 'aberta' : 'feita', como: noPadrao.length ? null : 'conferidos',
      texto: noPadrao.length ? 'Estão no padrão e não viram o resultado: ' + noPadrao.map(nomeDoCampo).join(', ') + '.' : 'Nada mais no padrão.',
      efeito: 'estão no padrão e não viram o resultado',
      campo: noPadrao[0] || null, irRotulo: 'Ir ao primeiro', conferir: noPadrao.length ? noPadrao : null, conferirRotulo: 'Estão certos' });
  }

  // ===== as fases, o progresso e o veredito =====
  const conta = m => m.peso !== 'detalhe';
  const fontes = fontesDoEstudo({ entrada, origens, comparacao, situacao, serie, socios, conferencia, hoje, objetivo: obj, contabil, atividade, resultadoPonte });
  const fases = fasesDoObjetivo(obj, e.regimeAtual).map(f => {
    const ms = missoes.filter(m => m.fase === f.id);
    const valem = ms.filter(conta);
    return { ...f, missoes: ms, fontes: fontes[f.id] || [], feitas: valem.filter(m => m.estado === 'feita').length, total: valem.length,
      extras: ms.filter(m => !conta(m)).length, extrasFeitas: ms.filter(m => !conta(m) && m.estado === 'feita').length,
      concluida: valem.every(m => m.estado === 'feita') };
  });
  const [f1, f2, f3, f4] = fases;
  f4.concluida = !!c && f1.concluida && f2.concluida && f3.concluida;
  // o que cada fase concluída conquistou
  if (geral) {
    if (f1.concluida && rDec && rDec.presumido.disponivel) {
      const ir = rDec.presumido.irpj + rDec.presumido.csll;
      if (receita > LIMITE_PRESUMIDO) { f1.conquista = 'A receita passa de R$ 78 milhões: no ano seguinte a empresa é obrigada ao Lucro Real (Lei 9.718, arts. 13 e 14).'; f1.alerta = true; }
      else f1.conquista = 'No Presumido, o IRPJ e a CSLL de ' + rDec.ano + ' dão ' + brl(ir) + ' (' + pct(rDec.receita > 0 ? ir / rDec.receita * 100 : 0, 2) + '% da receita).';
    }
    if (f2.concluida && rDec && rDec.real.disponivel) {
      const lr = rDec.real.lucro;
      f2.conquista = 'No Real, ' + (lr < 0 ? 'prejuízo de ' + brl(-lr) : 'lucro de ' + brl(lr)) + ' em ' + rDec.ano + (lucroInf ? ', pela contabilidade' : ', pela estimativa') + ': IRPJ e CSLL de ' + brl(rDec.real.irpj + rDec.real.csll) + '.';
      if (!lucroInf) f2.alerta = true;
    }
    if (f3.concluida) f3.conquista = 'Nada do que ficou no padrão vira o resultado.';
  } else {
    if (f1.concluida) {
      if (fora.length) { f1.conquista = 'O Simples fica fora ' + juntar(fora.map(r => r.k === 0 ? 'nos 12 meses' : 'em ' + r.ano)) + '.'; f1.alerta = true; }
      else if (impedimentos.length) { f1.conquista = 'O Simples está vedado hoje pelo cadastro: a conta dele vale como simulação, se a empresa tirar os impedimentos.'; f1.alerta = true; }
      else if (situacao && situacao.passaEm) { f1.conquista = 'No ritmo de hoje, ' + (grupo.length ? 'a soma' : 'a receita') + ' passa do limite em ' + situacao.passaEm + ': saída do Simples em ' + situacao.saiEm + '.'; f1.alerta = true; }
      else f1.conquista = 'O Simples é uma opção em 2027 e 2028' + (grupo.length ? ', com a soma das empresas em ' + pct0(soma12 / LIMITE_SIMPLES * 100) + '% do limite' : '') + '.';
    }
    if (f2.concluida) f2.conquista = 'A conta já usa os números da empresa.';
    if (f3.concluida) f3.conquista = 'Nada do que ficou no padrão vira o resultado.';
  }
  if (f4.concluida) f4.conquista = fraseDaDecisao(c);
  // a fase de agora: a primeira que não está concluída (com as três primeiras feitas, o veredito)
  const iAberta = fases.findIndex(f => !f.concluida);
  const faseAtual = iAberta === -1 ? 3 : iAberta;

  // a lista antiga (o estado de cada passo e a ordem: o que falta e decide primeiro)
  const PESO = { decide: 0, importa: 1, detalhe: 2 };
  const ordemFase = Object.fromEntries(fases.map((f, i) => [f.id, i]));
  const passos = missoes.map((m, i) => ({ m, i })).sort((a, b) =>
    ((a.m.estado === 'feita') - (b.m.estado === 'feita')) || (PESO[a.m.peso] - PESO[b.m.peso]) || (ordemFase[a.m.fase] - ordemFase[b.m.fase]) || (a.i - b.i))
    .map(({ m }) => ({ ...m, estado: m.estado === 'feita' ? 'feito' : (m.falta ? 'falta' : 'conferir') }));
  const pendentes = passos.filter(p => p.estado !== 'feito');
  const decidem = pendentes.filter(p => p.peso === 'decide');
  const valem = missoes.filter(conta), extras = missoes.filter(m => !conta(m));
  // o que veio do sistema (o verde da tela)
  const doSistema = [];
  const marca = (k, nome) => { if (DO_SISTEMA.includes(fonte(k)) && !doSistema.includes(nome)) doSistema.push(nome); };
  ats.forEach((a, i) => { marca('atividades.' + i + '.receita', 'a receita'); marca('atividades.' + i + '.pctST', 'o ST'); marca('atividades.' + i + '.pctMonofasico', 'o monofásico'); marca('atividades.' + i + '.redIcmsSimples', 'a redução do ICMS no DAS'); });
  marca('compras', 'as compras'); marca('despesasCredito', 'as despesas com crédito'); marca('folha', 'a folha'); marca('proLabore', 'o pró-labore'); marca('mix', 'as alíquotas da Reforma');
  (e.grupo || []).forEach((g, i) => marca('grupo.' + i + '.receita', 'a receita de ' + g.nome));
  // o próximo passo: a primeira missão aberta da fase de agora (as que decidem antes); sem nenhuma lá, a primeira de todas
  const proximo = pendentes.find(p => p.fase === (fases[faseAtual] || {}).id) || pendentes[0] || null;
  return {
    objetivo: obj, fases, faseAtual, passos, pendentes: pendentes.length, proximo,
    provisorio: decidem.length > 0, decidem: decidem.length, pronto: f4.concluida,
    feitas: valem.filter(m => m.estado === 'feita').length, total: valem.length,
    extras: extras.length, extrasFeitas: extras.filter(m => m.estado === 'feita').length, doSistema
  };
}

// ---------- a precisão do estudo ----------
// Pedido do Samuel, 11/11/2026: "mostrando o comparativo com o que se tem mas deixando evidenciado o que se falta pra ser
// mais preciso". Do roteiro: o que já está na conta (e como chegou), o que falta — o que decide primeiro —, com o efeito de
// cada item, e o nível: 'pronto' (as missões que decidem e as que importam cumpridas), 'quase' (falta o que não vira o
// resultado) ou 'provisorio' (falta o que pode virar).
export const NIVEL_DA_PRECISAO = { pronto: 'tudo o que decide e pesa está na conta', quase: 'falta só o que não vira o resultado', provisorio: 'falta o que pode virar o resultado' };
export const PESO_DA_PRECISAO = { decide: 'decide o resultado', importa: 'pesa na conta', detalhe: 'detalhe' };
export function precisaoDoEstudo(rot) {
  if (!rot || !rot.fases) return { nivel: 'provisorio', tem: [], falta: [], doSistema: [] };
  const PESO = { decide: 0, importa: 1, detalhe: 2 };
  const ms = rot.fases.flatMap(f => f.missoes);
  const falta = ms.filter(m => m.estado !== 'feita').map((m, i) => ({ m, i })).sort((a, b) => (PESO[a.m.peso] - PESO[b.m.peso]) || (a.i - b.i))
    .map(({ m }) => ({ id: m.id, titulo: m.titulo, curto: m.curto || m.titulo, peso: m.peso, falta: !!m.falta, efeito: m.efeito || '' }));
  const tem = ms.filter(m => m.estado === 'feita').map(m => ({ id: m.id, titulo: m.titulo, como: m.como || 'feito' }));
  return { nivel: rot.pronto ? 'pronto' : rot.provisorio ? 'provisorio' : 'quase', tem, falta, doSistema: rot.doSistema || [] };
}
