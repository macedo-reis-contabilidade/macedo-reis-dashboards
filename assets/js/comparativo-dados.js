// ============================================================
// MACEDO & REIS — Comparativo tributário: os números que o sistema já tem
// Módulo ES puro, sem DOM: monta a entrada do motor (comparativo-motor.js) com o que o sistema sabe da empresa —
// o cadastro, o caso da Reforma (os relatórios do Domínio e as notas que já foram lidos lá), o Fator R, o PGDAS que a
// ponte da Receita traz, o Domínio pela ponte (05/11/2026: a receita, as compras e a folha dos meses fechados; 11/11/2026,
// a versão 5: o resultado da contabilidade mês a mês — o lucro do Real até onde ela está feita, lucroDaPonte — e a venda
// pela situação tributária do PIS/Cofins, pisCofinsDaPonte) e os relatórios do Domínio soltos na tela — e diz de onde veio
// cada número (`origens`), como a procedência da Reforma: o que não veio de lugar nenhum é "padrão — confira". Testado por
// tests/comparativo-dados.test.mjs.
// ============================================================

import { TIPOS, ROTULO_REGIME, ehObjetivo, rotuloDoTipo } from './comparativo-motor.js';
import { digitosCnae } from './dominio-relatorios.js';
import { diaUtil, somaDias, fmtData } from './rescisao-datas.js';

const num = (v, def = 0) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const rotuloComp = c => c ? MES_CURTO[Number(String(c).slice(5, 7)) - 1] + '/' + String(c).slice(2, 4) : '';
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct1 = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const pct2 = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// ---------- de onde veio ----------
export const FONTES = {
  reforma: 'caso da Reforma',
  dominio: 'relatório do Domínio',
  ponte: 'Domínio (pela ponte)',
  fator_r: 'Fator R',
  pgdas: 'PGDAS (Receita)',
  cadastro: 'cadastro',
  padrao: 'padrão — confira',
  digitado: 'digitado',
  confirmado: 'conferido',
  gravado: 'estudo gravado'
};
// as fontes que vieram de um registro da empresa (o verde da tela)
export const DO_SISTEMA = ['reforma', 'dominio', 'ponte', 'fator_r', 'pgdas', 'cadastro'];
// texto: o que fica à vista, curto; dica: a explicação, ao passar o mouse
const origem = (fonte, texto, dica) => dica ? { fonte, texto: texto || FONTES[fonte], dica } : { fonte, texto: texto || FONTES[fonte] };

// ---------- o regime e a atividade ----------
export function regimeDoCadastro(r) {
  const t = String(r || '').toLowerCase();
  if (t.includes('simples')) return 'simples';
  if (t.includes('presumido')) return 'presumido';
  if (t.includes('real')) return 'real';
  if (t.includes('mei')) return 'mei';
  return t ? 'outro' : null;
}
// ---------- qual comparativo ----------
// Pedido do Samuel, 11/11/2026: a tela abre perguntando qual comparativo a equipe quer fazer, e o sistema sugere um. A
// empresa do regime geral (Presumido ou Real) e a que não pode optar pelo Simples (vedacoes: vedacoesDoSimples, de
// simples-vedacoes.js) comparam o Presumido com o Real; a do Simples, a do MEI e a sem regime, os três.
export function objetivoSugerido(regimeAtual, vedacoes = null) {
  if (vedacoes && vedacoes.vedado) return 'presumido_real';
  return doRegimeGeral(regimeAtual) ? 'presumido_real' : 'todos';
}
// a empresa do regime geral: hoje no Lucro Presumido ou no Lucro Real
export const doRegimeGeral = regimeAtual => regimeAtual === 'presumido' || regimeAtual === 'real';
// O Simples só entra no estudo quando faz parte dele: está no comparativo escolhido, ou é a situação da empresa hoje (a
// do Simples, a do MEI, a sem regime no cadastro). No Presumido contra o Real de uma empresa do regime geral, nada do
// Simples aparece — nem os impedimentos, nem o PGDAS, nem o anexo (pedido do Samuel, 11/11/2026: "se não estou querendo
// um comparativo que envolva o simples, não é de uma empresa do simples, pra que aparecer isso? precisamos ser
// objetivos com a ferramenta"). Sem comparativo escolhido (a pergunta ainda aberta), vale o regime de hoje
export const simplesNoEstudo = (objetivo, regimeAtual) => (objetivo === 'todos' ? true : !doRegimeGeral(regimeAtual));
// o porquê da sugestão, numa frase (a tela mostra na opção sugerida). Na empresa do regime geral, o motivo é o regime
// dela: o que o cadastro veda no Simples não entra (fica na opção com o Simples, numa linha)
export function porQueDoObjetivo(regimeAtual, vedacoes = null) {
  const hoje = ROTULO_REGIME[regimeAtual] ? 'A empresa está no ' + ROTULO_REGIME[regimeAtual] : null;
  if (doRegimeGeral(regimeAtual)) return hoje + ': a escolha de todo ano é entre o Presumido e o Real.';
  if (vedacoes && vedacoes.vedado) return (hoje ? hoje + ' e o' : 'O') + ' Simples está vedado pra ela.';
  if (regimeAtual === 'simples') return hoje + ': ficar ou sair é a pergunta.';
  return 'Sem o regime de hoje no cadastro, a conta mostra os três.';
}
export const objetivoValido = o => (ehObjetivo(o) ? o : null);

const POR_ANEXO = { I: 'comercio', II: 'industria', III: 'servico', IV: 'servico_iv', V: 'servico_r' };
export const tipoPeloAnexo = anexo => POR_ANEXO[String(anexo || '').trim().toUpperCase()] || null;
// pelo CNAE principal, só o grosso — o anexo certo depende da atividade de cada receita (LC 123, art. 18, §§4º a 5º-I):
// comércio (divisões 45 a 47), indústria (05 a 33), construção (41 a 43, Anexo IV), advocacia (6911, Anexo IV),
// contabilidade (6920, Anexo III) e as atividades intelectuais do fator r (TI, consultoria, engenharia e arquitetura,
// pesquisa, publicidade, saúde e veterinária — Anexo V ou III pelo fator r); o resto, Anexo III
const FATOR_R_DIVISOES = ['62', '63', '70', '71', '72', '73', '75', '86'];
export function tipoPeloCnae(cnae) {
  const d = digitosCnae(cnae);
  if (d.length < 4) return null;
  const div = d.slice(0, 2), cl = d.slice(0, 4);
  const n = Number(div);
  // a venda da produção rural própria, sem industrialização, vai com o comércio (Anexo I, presunção de 8%, ICMS)
  if ((n >= 45 && n <= 47) || (n >= 1 && n <= 3)) return 'comercio';
  if (n >= 5 && n <= 33) return 'industria';
  if (n >= 41 && n <= 43) return 'servico_iv';
  if (cl === '6911') return 'servico_iv';
  if (cl === '6920') return 'servico';
  if (FATOR_R_DIVISOES.includes(div)) return 'servico_r';
  return 'servico';
}

// ---------- a presunção do Presumido pela atividade ----------
// Pedido do Samuel, 11/11/2026 ("como temos acesso nas notas fiscais pela ponte da domínio, não ficaria mais fácil para o
// próprio sistema apurar essa informação?"): a regra geral sai das notas — a venda de mercadoria (comércio e indústria)
// presume 8% no IRPJ e 12% na CSLL, e o serviço, 32% nos dois (Lei 9.249/1995, art. 15, caput e §1º, III, e art. 20) —, e o
// Domínio já separa uma da outra, nota a nota. O que as notas não dizem são as atividades com outro percentual, que o CNAE
// principal acusa: a revenda de combustível pra consumo, 1,6% (art. 15, §1º, I; o GLP, SC Cosit 25/2023); o transporte de
// carga, 8%, e o de passageiros, 16% (§1º, II, "a"), os dois com 12% na CSLL; os serviços hospitalares e de auxílio
// diagnóstico e terapia, 8% e 12%, da sociedade empresária que segue as normas da Anvisa (§1º, III, "a"); a obra por
// empreitada com todos os materiais, 8% e 12%, e só com a mão de obra ou parte dos materiais, 32%; a venda de imóveis, 8% e
// 12% (art. 15, caput e §4º), e o aluguel de imóvel próprio, 32% (§1º, III, "c"); a holding, em que os lucros recebidos
// não entram na receita (art. 10). Conferido em 11/11/2026 no texto atualizado da Lei 9.249 (Câmara) e no Perguntas e
// Respostas da Pessoa Jurídica da Receita, o capítulo do Lucro Presumido (perguntas 015, 016 e 019); a CSLL de 12% do
// transporte e dos hospitalares sai do art. 20 (os 32% são só das atividades do inciso III do §1º do art. 15).
// `toda`: vale pra receita toda da empresa, sem condição (o sistema já põe na conta); senão, depende do que a equipe sabe
// da empresa (a parte do combustível, os requisitos do hospital, o contrato da obra): a missão pergunta.
const PRESUNCOES_ESPECIAIS = [
  { id: 'combustivel', nome: 'revenda de combustível', cnaes: ['4731800', '4784900'], irpj: 1.6, csll: 12, toda: false,
    regra: 'A revenda de combustível pra consumo (gasolina, diesel, etanol, gás natural, GLP) presume 1,6% no IRPJ e 12% na CSLL; o resto que a empresa vende (loja, lubrificante) presume 8% e 12%.',
    fazer: 'Separe a receita do combustível numa atividade e ponha 1,6 na presunção do IRPJ dela.',
    base: 'Lei 9.249/1995, art. 15, §1º, I; o GLP, SC Cosit 25/2023' },
  { id: 'carga', nome: 'transporte de carga', cnaes: ['49116', '49302', '5011401', '5012201', '50211', '51200'], irpj: 8, csll: 12, toda: true,
    regra: 'O transporte de carga presume 8% no IRPJ e 12% na CSLL, com nota de serviço ou com conhecimento de transporte.',
    base: 'Lei 9.249/1995, art. 15, §1º, II, "a", e art. 20' },
  { id: 'passageiros', nome: 'transporte de passageiros', cnaes: ['49124', '4921', '4922', '4923', '4924', '4929', '49507', '5011402', '5012202', '5022', '5091', '5099', '5111', '5112'], irpj: 16, csll: 12, toda: true,
    regra: 'O transporte de passageiros presume 16% no IRPJ e 12% na CSLL.',
    base: 'Lei 9.249/1995, art. 15, §1º, II, "a", e art. 20' },
  { id: 'hospitalar', nome: 'serviços hospitalares e de diagnóstico', cnaes: ['8610', '8640', '8630501', '8630502', '8630507'], irpj: 8, csll: 12, toda: false,
    regra: 'Os serviços hospitalares e de auxílio diagnóstico e terapia (exames, imagem, análises, endoscopia, quimioterapia, diálise) presumem 8% no IRPJ e 12% na CSLL quando a empresa é sociedade empresária e segue as normas da Anvisa; a consulta e a sociedade simples ficam em 32% nos dois.',
    fazer: 'Se a empresa cumpre os dois requisitos, ponha 8 e 12 na presunção dessa receita.',
    base: 'Lei 9.249/1995, art. 15, §1º, III, "a", e art. 20' },
  { id: 'imoveis', nome: 'atividade imobiliária', cnaes: ['41107', '6810201', '6810202', '6810203'], irpj: 8, csll: 12, toda: false,
    regra: 'A venda de imóveis (loteamento, incorporação, construção pra venda, compra e venda) presume 8% no IRPJ e 12% na CSLL; o aluguel de imóvel próprio, 32% nos dois. Nenhuma das duas paga ICMS nem ISS, e essa receita não passa pelas notas do Domínio.',
    fazer: 'Digite a receita de cada uma, com a presunção dela (8 e 12 na venda) e o ICMS ou o ISS em zero.',
    base: 'Lei 9.249/1995, art. 15, caput, §1º, III, "c", e §4º' },
  { id: 'construcao', nome: 'construção', divisoes: ['41', '42', '43'], irpj: 8, csll: 12, toda: false,
    regra: 'A obra por empreitada com todos os materiais por conta da empresa presume 8% no IRPJ e 12% na CSLL; só com a mão de obra, ou com parte dos materiais, 32% nos dois.',
    fazer: 'Veja nos contratos das obras: na receita das feitas com todos os materiais, ponha 8 e 12 na presunção.',
    base: 'IN RFB 1.700/2017, art. 33; Perguntas e Respostas da Receita, Lucro Presumido, pergunta 019' },
  { id: 'holding', nome: 'holding', cnaes: ['6461', '6462', '6463'], irpj: null, csll: null, toda: false,
    regra: 'Na holding, os lucros e dividendos recebidos e o resultado das participações não entram na receita do Presumido; o aluguel e os serviços presumem 32% nos dois; juros e ganhos entram inteiros na base, fora da presunção (e fora desta conta).',
    fazer: 'Deixe na receita só o que a holding fatura (aluguel, serviços).',
    base: 'Lei 9.249/1995, arts. 10 e 15; Lei 9.430/1996, art. 25' }
];
// a atividade com presunção própria pelo CNAE principal ({ id, nome, irpj, csll, toda, regra, fazer, base, cnae }), ou null
export function presuncaoPeloCnae(cnae) {
  const d = digitosCnae(cnae);
  if (d.length < 4) return null;
  // o código mais específico primeiro (a incorporação, 4110-7, é atividade imobiliária, não obra)
  const porCodigo = PRESUNCOES_ESPECIAIS.find(x => (x.cnaes || []).some(p => d.startsWith(p)));
  const x = porCodigo || PRESUNCOES_ESPECIAIS.find(y => (y.divisoes || []).includes(d.slice(0, 2)));
  if (!x) return null;
  const { cnaes, divisoes, ...resto } = x;
  return { ...resto, cnae: String(cnae || '').split(/\s+-\s+/)[0].trim() };
}

// ---------- a refeição no RS ----------
// Receita Estadual do RS ("bares e restaurantes", regime geral fora do RDA e Simples): a refeição feita no estabelecimento,
// pronta pra consumo e vendida direto ao consumidor paga 12% (RICMS-RS, Livro I, art. 27, V, e Apêndice I, Seção II, item
// XII), com a opção da base reduzida a 60% (art. 23, VI) e o crédito das compras na mesma proporção (art. 33, IV) — ou do
// crédito presumido (art. 32, IV), fora da conta; no Simples, a mesma base reduzida na receita de refeição, no DAS (LC 123,
// art. 18, §20). Vale pros bares e restaurantes (5611-2/02 é o código antigo dos bares) e pro CNAE 5620-1/04 (preparo pra
// consumo domiciliar). Bebida revendida e o que não é refeição têm a alíquota deles. Conferido nas orientações da Receita
// Estadual por um agente separado em 01/11/2026 (o texto do RICMS não abriu). As refeições coletivas pra empresas
// (5620-1/01) e as cantinas (5620-1/03) podem ter a base a 60% (o art. 23, VI fala em "empresas preparadoras de refeições
// coletivas"), mas a alíquota de 12% não está confirmada pra elas: ficam com uma nota pra conferir.
// O RDA dos bares e restaurantes (art. 38-A; o motor, RDA_RS) é só do grupo 56.1 da CNAE, no Presumido e no Real.
const CNAE_REFEICAO_RS = ['5611201', '5611202', '5611203', '5611204', '5611205', '5620104'];
const CNAE_REFEICAO_A_CONFERIR = { '5620101': 'refeições pra empresas', '5620103': 'cantina' };
export const ALIQ_REFEICAO_RS = 12, RED_REFEICAO_RS = 40;
const ehRS = uf => !uf || String(uf).trim().toUpperCase() === 'RS';
export const ehRefeicaoRS = (cnae, uf) => CNAE_REFEICAO_RS.includes(digitosCnae(cnae).slice(0, 7)) && ehRS(uf);
export const ehRdaRS = (cnae, uf) => digitosCnae(cnae).startsWith('561') && ehRS(uf);

// o que o PGDAS lido na Reforma mostrou: a redução do ICMS (o "percentual de redução") e a revenda com ST. O caso guarda o
// resumo (`dominio.pgdas`) e, nos montados à mão, os textos de `fontes` — lidos aqui só no que está escrito.
const numBR = t => num(String(t || '').replace(/\./g, '').replace(',', '.'));
function doPgdasDoCaso(sim) {
  const pg = (sim && sim.dominio && sim.dominio.pgdas) || {};
  const fontes = (sim && sim.fontes) || {};
  const inp = (sim && sim.input) || {};
  let red = num(pg.reducaoIcms) > 0 ? num(pg.reducaoIcms) : null;
  if (red == null) {
    for (const t of Object.values(fontes)) {
      const m = /redu[çc][ãa]o de ([\d.,]+)\s*% na base do ICMS/i.exec(String(t || ''));
      if (m && numBR(m[1]) > 0) { red = numBR(m[1]); break; }
    }
  }
  let st = num(pg.pctST) > 0 ? num(pg.pctST) : null;
  if (st == null && /revenda com ST/i.test(String(fontes.mixCheia || '')) && num(inp.mixCheia) > 0 && num(inp.mixCheia) < 100) st = num(inp.mixCheia);
  return { red, st, competencia: pg.competencia || null };
}
const lerSim = caso => { try { return caso && caso.sim_obs ? (typeof caso.sim_obs === 'string' ? JSON.parse(caso.sim_obs) : caso.sim_obs) : null; } catch (e) { return null; } };

// ---------- a receita de 12 meses ----------
// meses: [{ competencia 'AAAA-MM', saidas?, servicos?, total }] — os 12 últimos com receita; com menos de 12, anualiza.
// O motor lê os 12 meses na ordem do calendário (jan a dez: os trimestres do Presumido e o limite da LC 224), então
// cada mês vai pro lugar do seu mês.
export function serieDosMeses(meses) {
  const ult = (meses || []).filter(m => m && /^\d{4}-\d{2}$/.test(m.competencia) && num(m.total) > 0)
    .sort((a, b) => a.competencia < b.competencia ? -1 : 1).slice(-12);
  if (!ult.length) return null;
  const n = ult.length, fator = 12 / n;
  const soma = k => ult.reduce((s, m) => s + num(m[k]), 0);
  const total = soma('total'), saidas = soma('saidas'), servicos = soma('servicos');
  let calendario = null;
  if (n === 12) {
    calendario = Array(12).fill(0);
    ult.forEach(m => { calendario[Number(m.competencia.slice(5, 7)) - 1] += num(m.total); });
  }
  return { n, de: ult[0].competencia, ate: ult[n - 1].competencia, receita: total * fator, mercadorias: saidas * fator, servicos: servicos * fator, meses: calendario };
}
// o período de uma medida, sem o "anualizado": "nov/25 a out/26" ou "jun/26 a out/26 (5 meses)"
export const periodoCurto = s => rotuloComp(s.de) + ' a ' + rotuloComp(s.ate) + (s.n && s.n < 12 ? ' (' + s.n + (s.n === 1 ? ' mês)' : ' meses)') : '');
const periodo = s => s.n === 12 ? rotuloComp(s.de) + ' a ' + rotuloComp(s.ate) : rotuloComp(s.de) + ' a ' + rotuloComp(s.ate) + ' (' + s.n + (s.n === 1 ? ' mês' : ' meses') + ', anualizado)';

// ---------- o Domínio pela ponte (05/11/2026, a versão 2 da ponte) ----------
// linhas: as de dominio_mensal da empresa, só os meses fechados (quem chama corta: carregarEstudo). Dois códigos com o
// mesmo documento no mesmo mês ficam com o maior de cada número, como na ficha da empresa. Null = o Domínio não disse
// (o bloco não foi lido, a folha de empresa inativa lá, a apuração do Simples de quem não apura): nunca vira zero.
// Desde 11/11/2026 (a versão 5 da ponte), a venda pela situação tributária do PIS/Cofins (o CST do item da nota): 01 a 03
// tributada, 04 monofásica, 05 substituição tributária, 06 alíquota zero, 07 isenta, 08 sem incidência, 09 suspensa, as
// outras e a sem CST (no Simples o item não tem o CST: a venda cai toda em pc_sem_cst)
export const CAMPOS_PISCOFINS = ['pc_tributada', 'pc_monofasica', 'pc_st', 'pc_aliquota_zero', 'pc_isenta', 'pc_sem_incidencia', 'pc_suspensa', 'pc_outras', 'pc_sem_cst'];
export const CAMPOS_PONTE = ['receita_bruta', 'receita_mercadorias', 'receita_servicos', 'receita_simples', 'receita_st', 'receita_monofasica', 'receita_exportacao',
  'receita_anexo_1', 'receita_anexo_2', 'receita_anexo_3', 'receita_anexo_4', 'receita_anexo_5', 'compras', 'servicos_tomados', 'ativo_e_consumo',
  'salarios', 'decimo_terceiro', 'pro_labore_valor', 'base_inss', 'inss_rat', 'inss_terceiros', ...CAMPOS_PISCOFINS];
export function mesesDaPonte(linhas) {
  const por = new Map();
  (linhas || []).forEach(l => {
    if (!l || !/^\d{4}-\d{2}$/.test(String(l.competencia))) return;
    const m = por.get(l.competencia) || { competencia: l.competencia };
    CAMPOS_PONTE.forEach(c => { const v = l[c] == null ? null : Number(l[c]); if (v != null && Number.isFinite(v) && (m[c] == null || v > m[c])) m[c] = v; });
    por.set(l.competencia, m);
  });
  return [...por.values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
}
// a receita do mês pela ponte: a apuração do Simples (com as filiais, como no PGDAS), senão a receita bruta pelos
// acumuladores de faturamento do Domínio (menos as devoluções)
const receitaDaPonte = m => (m.receita_simples != null ? m.receita_simples : m.receita_bruta);
// a receita de 12 meses pela ponte: os 12 meses mais recentes com o número — o mês sem faturamento conta como zero (o
// bloco foi lido) —, a partir do primeiro com receita (a empresa mais nova anualiza). Como serieDosMeses, mais: npos (os
// meses com receita, pra comparar com o PGDAS), serie (os meses com receita, [{ competencia, total }]), simples (veio da
// apuração do Simples) e janela (os meses usados)
export function seriePonte(meses) {
  const com = (meses || []).filter(m => receitaDaPonte(m) != null).slice(-12);
  const i0 = com.findIndex(m => receitaDaPonte(m) > 0);
  if (i0 < 0) return null;
  const j = com.slice(i0), n = j.length, fator = 12 / n;
  const soma = f => j.reduce((s, m) => s + num(f(m)), 0);
  let calendario = null;
  if (n === 12) { calendario = Array(12).fill(0); j.forEach(m => { calendario[Number(m.competencia.slice(5, 7)) - 1] += num(receitaDaPonte(m)); }); }
  const serie = j.filter(m => receitaDaPonte(m) > 0).map(m => ({ competencia: m.competencia, total: num(receitaDaPonte(m)) }));
  return { n, npos: serie.length, de: j[0].competencia, ate: j[n - 1].competencia, receita: soma(receitaDaPonte) * fator,
    mercadorias: soma(m => m.receita_mercadorias) * fator, servicos: soma(m => m.receita_servicos) * fator, meses: calendario, serie,
    simples: j.every(m => m.receita_simples != null) ? 'todos' : j.some(m => m.receita_simples != null) ? 'parte' : null, janela: j };
}
// o que a receita da ponte é, pra origem: a apuração do Simples (todos os meses), o faturamento com a apuração nos meses
// em que a empresa estava no Simples (a que saiu ou entrou no meio da janela), ou o faturamento
const oQueDaPonte = s => (s.simples === 'todos' ? 'a receita da apuração do Simples' : s.simples === 'parte' ? 'o faturamento, com a apuração do Simples nos meses em que a empresa estava nele,' : 'o faturamento');
// a soma de 12 meses de uns campos pela ponte: os 12 meses mais recentes em que algum deles veio (os zeros contam),
// anualizada; com menos de 3 meses, null (pouco pra anualizar)
export function somaDaPonte(meses, campos) {
  const com = (meses || []).filter(m => campos.some(c => m[c] != null)).slice(-12);
  if (com.length < 3) return null;
  const soma = com.reduce((s, m) => s + campos.reduce((t, c) => t + num(m[c]), 0), 0) * 12 / com.length;
  return { soma, n: com.length, de: com[0].competencia, ate: com[com.length - 1].competencia };
}
// a receita de cada anexo na apuração do Simples (a janela da receita) e, sobre a receita de mercadoria dela, a parte
// com ICMS-ST e a monofásica de PIS/Cofins. Sem apuração do Simples, null
export function simplesDaPonte(janela) {
  const ms = (janela || []).filter(m => m.receita_simples != null);
  if (!ms.length) return null;
  const s = c => ms.reduce((t, m) => t + num(m[c]), 0);
  const anexos = { I: s('receita_anexo_1'), II: s('receita_anexo_2'), III: s('receita_anexo_3'), IV: s('receita_anexo_4'), V: s('receita_anexo_5') };
  const somaAnexos = anexos.I + anexos.II + anexos.III + anexos.IV + anexos.V;
  const merc = s('receita_mercadorias'), serv = s('receita_servicos');
  // a parte de mercadoria da apuração: pelos anexos (a mesma base, com as filiais); sem eles, pela divisão do faturamento
  const parte = somaAnexos > 0 ? (anexos.I + anexos.II) / somaAnexos : merc + serv > 0 ? merc / (merc + serv) : 0;
  const baseMerc = s('receita_simples') * parte;
  const pct = c => (baseMerc > 0 && ms.some(m => m[c] != null) ? Math.min(100, s(c) / baseMerc * 100) : null);
  return { anexos, somaAnexos, pctST: pct('receita_st'), pctMono: pct('receita_monofasica'), exportacao: s('receita_exportacao') };
}
// a venda pela situação tributária do PIS/Cofins (a versão 5 da ponte), nos meses em que a ponte leu o bloco (os 12 mais
// recentes dos que vieram). Volta { n, de, ate, total (toda a venda: mercadoria e serviço, antes das devoluções),
// classificada (a parte com CST de 01 a 09), zero (06 e 07: alíquota zero e isenta), isenta, mono (04 e 05: a revenda
// monofásica e a com substituição tributária), st, fora (08 e 09: sem incidência e com suspensão), mercadorias (a venda de
// mercadoria dos mesmos meses) } ou null sem o bloco ou sem venda. A medida só vale com quase toda a venda classificada
// (cstVale): no Simples o item não tem o CST, e a nota com CST 49 ou 99 não diz nada
export const CST_MINIMO = 0.95;
export function pisCofinsDaPonte(meses) {
  const com = (meses || []).filter(m => CAMPOS_PISCOFINS.some(c => m[c] != null)).slice(-12);
  if (!com.length) return null;
  const s = c => com.reduce((t, m) => t + num(m[c]), 0);
  const total = CAMPOS_PISCOFINS.reduce((t, c) => t + s(c), 0);
  if (!(total > 0)) return null;
  return { n: com.length, de: com[0].competencia, ate: com[com.length - 1].competencia, total, classificada: total - s('pc_sem_cst') - s('pc_outras'),
    zero: s('pc_aliquota_zero') + s('pc_isenta'), isenta: s('pc_isenta'), mono: s('pc_monofasica') + s('pc_st'), st: s('pc_st'),
    fora: s('pc_sem_incidencia') + s('pc_suspensa'), mercadorias: s('receita_mercadorias') };
}
export const cstVale = pc => !!pc && pc.total > 0 && pc.classificada / pc.total >= CST_MINIMO;

// as linhas de receita a partir do total e da divisão mercadoria × serviço
function linhas(receita, mercadorias, servicos, tipoMerc, tipoServ) {
  const out = [];
  const totalSplit = mercadorias + servicos;
  if (totalSplit > 0) {
    if (mercadorias > 0.005) out.push({ tipo: tipoMerc, receita: receita * mercadorias / totalSplit });
    if (servicos > 0.005) out.push({ tipo: tipoServ, receita: receita * servicos / totalSplit });
  }
  if (!out.length) out.push({ tipo: tipoMerc, receita });
  return out;
}

// ---------- o que o sistema sabe ----------
// cliente: a linha do cadastro · caso: a linha de rt_casos (com sim_obs) · fatorR: lançamentos do Fator R
// [{ competencia 'AAAA-MM-DD', folha_salarios, folha_outros, prolabore }] · pgdas: receita_pgdas [{ competencia, receita_mes }]
// · dominio: as linhas de dominio_mensal da empresa, só os meses fechados (o Domínio pela ponte, 05/11/2026)
export function entradaDoSistema({ cliente = null, caso = null, fatorR = [], pgdas = [], dominio = [] } = {}) {
  // notasSimples: as de `notas` que só interessam com o Simples na comparação (o anexo, o fator r) — só o Presumido contra
  // o Real não as mostra
  const origens = {}, notas = [], notasSimples = [];
  const sim = lerSim(caso);
  const inp = (sim && sim.input) || {};
  const dom = (sim && sim.dominio) || {};
  const mp = mesesDaPonte(dominio);
  const sPonte = seriePonte(mp);
  const smp = sPonte ? simplesDaPonte(sPonte.janela) : null;

  // o tipo da atividade: o anexo do PGDAS (o da Reforma) vale sobre o CNAE
  const anexoPgdas = inp.anexo || (caso && caso.anexo) || null;
  const tipoAnexo = tipoPeloAnexo(anexoPgdas);
  const tipoCnae = tipoPeloCnae(cliente && cliente.cnae_principal);
  let tipoMerc = 'comercio', tipoServ = 'servico';
  if (tipoAnexo) {
    if (tipoAnexo === 'comercio' || tipoAnexo === 'industria') tipoMerc = tipoAnexo; else tipoServ = tipoAnexo;
  }
  if (tipoCnae) {
    if ((tipoCnae === 'comercio' || tipoCnae === 'industria') && !(tipoAnexo === 'comercio' || tipoAnexo === 'industria')) tipoMerc = tipoCnae;
    if (!(tipoCnae === 'comercio' || tipoCnae === 'industria') && !tipoAnexo) tipoServ = tipoCnae;
  }
  // a apuração do Simples no Domínio (a ponte) diz o anexo de cada receita dos 12 meses: vale sobre o anexo do caso e o
  // CNAE (o serviço no Anexo III com o CNAE do fator r fica no fator r: o motor põe no III ou no V pela folha)
  const doAnexo = {};
  if (smp && smp.somaAnexos > 0) {
    const a = smp.anexos;
    if (a.I + a.II > 0) { tipoMerc = a.II > a.I ? 'industria' : 'comercio'; doAnexo[tipoMerc] = a.II > a.I ? 'II' : 'I'; }
    const s = [['servico', 'III', a.III], ['servico_iv', 'IV', a.IV], ['servico_r', 'V', a.V]].filter(x => x[2] > 0).sort((x, y) => y[2] - x[2])[0];
    if (s) { tipoServ = s[0] === 'servico' && tipoCnae === 'servico_r' ? 'servico_r' : s[0]; doAnexo[tipoServ] = s[1]; }
  }

  // a receita: o PGDAS da Receita (o declarado) ou o Domínio pela ponte — o que tem mais meses; empatados, o PGDAS —,
  // senão o faturamento do caso da Reforma ou a receita mensal dele. A divisão mercadoria × serviço: a da ponte, senão a
  // do caso
  const sPgdas = serieDosMeses((pgdas || []).map(p => ({ competencia: p.competencia, total: p.receita_mes })));
  const sDom = serieDosMeses(dom.meses || (dom.vendas && dom.vendas.meses) || []);
  let receita = 0, merc = 0, serv = 0, meses = null, textoRec = null, fonteRec = 'padrao', divisao = null;
  // a divisão mercadoria × serviço medida nas notas (a ponte) ou no faturamento do caso da Reforma: é ela que faz a presunção
  // do Presumido (8% e 12% na venda de mercadoria, 32% no serviço) — { fonte, de, ate, n, mercadorias, servicos }, ou null
  let medida = null;
  const medir = (fonte, s) => { if (s.mercadorias + s.servicos > 0) medida = { fonte, de: s.de, ate: s.ate, n: s.n, mercadorias: s.mercadorias, servicos: s.servicos }; };
  if (sDom) { receita = sDom.receita; merc = sDom.mercadorias; serv = sDom.servicos; meses = sDom.meses; fonteRec = 'reforma'; textoRec = 'caso da Reforma: faturamento do Domínio de ' + periodo(sDom); divisao = 'do faturamento do Domínio'; medir('reforma', sDom); }
  const pgdasVale = !!sPgdas && (!sPonte || sPgdas.n >= sPonte.npos);
  if (sPonte) {
    if (sPonte.mercadorias + sPonte.servicos > 0) { merc = sPonte.mercadorias; serv = sPonte.servicos; divisao = 'do Domínio, pela ponte'; medir('ponte', sPonte); }
    if (!pgdasVale) { receita = sPonte.receita; meses = sPonte.meses; fonteRec = 'ponte'; textoRec = 'Domínio, pela ponte: ' + oQueDaPonte(sPonte) + ' de ' + periodo(sPonte); }
  }
  if (pgdasVale) {
    receita = sPgdas.receita; meses = sPgdas.meses; fonteRec = 'pgdas'; textoRec = 'PGDAS na Receita, de ' + periodo(sPgdas) + (divisao ? ' (a divisão mercadoria × serviço é a ' + divisao + ')' : '');
  }
  if (!receita && num(inp.receita) > 0) { receita = num(inp.receita) * 12; fonteRec = 'reforma'; textoRec = 'caso da Reforma: receita mensal de ' + brl(num(inp.receita)) + ' × 12'; }
  if (!receita && caso && num(caso.receita_mensal) > 0) { receita = num(caso.receita_mensal) * 12; fonteRec = 'reforma'; textoRec = 'caso da Reforma: receita mensal × 12'; }
  // sem divisão medida, o anexo (ou o CNAE) diz se é mercadoria ou serviço
  if (!(merc + serv > 0)) {
    const ehMerc = tipoAnexo ? (tipoAnexo === 'comercio' || tipoAnexo === 'industria') : !tipoCnae || tipoCnae === 'comercio' || tipoCnae === 'industria';
    if (ehMerc) merc = 1; else serv = 1;
  }
  const atividades = linhas(receita, merc, serv, tipoMerc, tipoServ);
  const cnaeTxt = (cliente && cliente.cnae_principal) || '';
  // a atividade que saiu das notas: a parte da receita que é venda de mercadoria ou serviço, no período medido. O anexo do
  // Simples as notas não dizem: fica à parte (`simples`), só pra quando o Simples está no estudo
  const pelasNotas = a => {
    const ehMerc = TIPOS[a.tipo].tributo === 'icms', p = (ehMerc ? medida.mercadorias : medida.servicos) / (medida.mercadorias + medida.servicos) * 100;
    const o = origem(medida.fonte, (medida.fonte === 'ponte' ? 'Domínio, pela ponte: ' : 'caso da Reforma: ') + (p >= 99.995 ? 'toda a receita' : pct2(p) + '% da receita')
      + (medida.fonte === 'ponte' ? ' das notas de ' : ' do faturamento do Domínio de ') + periodoCurto(medida) + ' é ' + (ehMerc ? 'venda de mercadoria' : 'de serviço'),
      ehMerc ? 'as notas de saída e de serviço do Domínio separam a venda de mercadoria do serviço; comércio ou indústria, pelo CNAE do cadastro' + (cnaeTxt ? ' (' + cnaeTxt + ')' : '') + ' — a presunção é a mesma'
        : 'as notas de saída e de serviço do Domínio separam a venda de mercadoria do serviço');
    o.simples = tipoCnae && a.tipo === tipoCnae ? 'o anexo, pelo CNAE do cadastro (' + cnaeTxt + '): confira' : 'o anexo está no padrão: confira';
    return o;
  };
  atividades.forEach((a, i) => {
    origens['atividades.' + i + '.tipo'] = doAnexo[a.tipo] ? origem('ponte', 'Domínio, pela ponte: Anexo ' + doAnexo[a.tipo] + ' na apuração do Simples' + (a.tipo === 'servico_r' && doAnexo[a.tipo] === 'III' ? ' (o CNAE é do fator r)' : ''))
      : tipoAnexo && (a.tipo === tipoAnexo) ? origem('reforma', 'Anexo ' + anexoPgdas + ' do PGDAS (caso da Reforma)')
      : medida ? pelasNotas(a)
      : tipoCnae && a.tipo === tipoCnae ? origem('cadastro', 'pelo CNAE do cadastro (' + cnaeTxt + ') — confira', 'o sistema não tem as notas desta empresa: confira se a receita é venda de mercadoria (no Presumido, presume 8% no IRPJ e 12% na CSLL) ou serviço (32% nos dois)') : origem('padrao');
    origens['atividades.' + i + '.receita'] = receita > 0 ? origem(fonteRec, textoRec) : origem('padrao', 'falta no sistema: digite os 12 meses');
  });
  // a atividade com presunção própria pelo CNAE principal: a que vale pra receita toda (o transporte) já entra na conta
  const especial = presuncaoPeloCnae(cnaeTxt);
  if (especial && especial.toda) atividades.forEach((a, i) => {
    const t = TIPOS[a.tipo];
    if (t.presIrpj === especial.irpj && t.presCsll === especial.csll) return;
    a.presIrpj = especial.irpj; a.presCsll = especial.csll;
    ['presIrpj', 'presCsll'].forEach(k => { origens['atividades.' + i + '.' + k] = origem('cadastro', 'pelo CNAE: ' + especial.nome, especial.regra + ' (' + especial.base + ')'); });
  });
  // ST e monofásico (só nas mercadorias): a apuração do Simples no Domínio (a ponte), senão as saídas do Domínio e o
  // PGDAS do caso da Reforma
  const iMerc = atividades.findIndex(a => TIPOS[a.tipo].tributo === 'icms');
  let refeicao = false;
  if (iMerc >= 0) {
    const p = 'atividades.' + iMerc;
    const v = dom.vendas || null;
    const doPg = doPgdasDoCaso(sim);
    const quando = doPg.competencia ? 'PGDAS de ' + rotuloComp(doPg.competencia) : 'PGDAS';
    const perP = sPonte ? periodo(sPonte) : '';
    // a ponte vale quando mostra a venda com ST; quando mostra zero, as saídas do caso da Reforma (a venda com ST que
    // não foi separada na apuração ainda conta pro planejamento) e, sem elas, o zero da ponte
    if (smp && smp.pctST > 0) {
      atividades[iMerc].pctST = smp.pctST;
      origens[p + '.pctST'] = origem('ponte', 'Domínio, pela ponte: ' + pct1(smp.pctST) + '% das vendas de mercadoria com ICMS-ST na apuração do Simples, de ' + perP,
        'a receita da apuração com a partilha do ICMS zerada: o ICMS já foi pago por substituição na compra');
    } else if (v && num(v.mercadorias) > 0 && v.st != null) {
      atividades[iMerc].pctST = Math.min(100, num(v.st) / num(v.mercadorias) * 100);
      origens[p + '.pctST'] = origem('reforma', 'caso da Reforma: vendas com ST (CFOP x401 a x405) nas saídas do Domínio, ' + brl(v.st) + ' de ' + brl(v.mercadorias));
    } else if (doPg.st > 0) {
      atividades[iMerc].pctST = doPg.st;
      origens[p + '.pctST'] = origem('reforma', quando + ' (caso da Reforma): revenda com ST, ' + pct1(doPg.st) + '% da receita', 'a seção do PGDAS sem ICMS: o ICMS já foi pago por substituição na compra');
    } else if (smp && smp.pctST === 0) {
      atividades[iMerc].pctST = 0;
      origens[p + '.pctST'] = origem('ponte', 'Domínio, pela ponte: sem venda com ICMS-ST na apuração do Simples, de ' + perP);
    }
    if (smp && smp.pctMono != null && smp.pctMono > 0) {
      atividades[iMerc].pctMonofasico = smp.pctMono;
      origens[p + '.pctMonofasico'] = origem('ponte', 'Domínio, pela ponte: ' + pct1(smp.pctMono) + '% das vendas de mercadoria com PIS e Cofins monofásicos na apuração do Simples, de ' + perP);
    } else if (num(inp.pctReceitaMonofasica) > 0) {
      atividades[iMerc].pctMonofasico = num(inp.pctReceitaMonofasica);
      origens[p + '.pctMonofasico'] = origem('reforma', 'caso da Reforma: receita monofásica de PIS/Cofins');
    }
    refeicao = ehRefeicaoRS(cliente && cliente.cnae_principal, cliente && cliente.uf);
    if (refeicao) {
      Object.assign(atividades[iMerc], { aliqIcms: ALIQ_REFEICAO_RS, redIcms: RED_REFEICAO_RS, redIcmsSimples: RED_REFEICAO_RS });
      origens[p + '.aliqIcms'] = origem('padrao', 'refeição no RS: 12% — confira', 'RICMS-RS, Livro I, art. 27, V: a refeição feita na casa e vendida pronta ao consumidor; bebida e outras revendas têm a alíquota delas');
      origens[p + '.redIcms'] = origem('padrao', 'base a 60% — confira a opção da empresa', 'RICMS-RS, Livro I, art. 23, VI, com o crédito das compras na mesma proporção (art. 33, IV). A outra opção, o crédito presumido (art. 32, IV), fica fora da conta; sem redução nenhuma, digite 0');
      origens[p + '.redIcmsSimples'] = origem('padrao', '40% — confira no PGDAS', 'a base reduzida a 60% também vale no DAS, na receita de refeição (Receita Estadual do RS; RICMS-RS, Livro I, art. 23, VI, nota do Simples); no PGDAS é o "percentual de redução". Abaixo de R$ 360 mil em 12 meses, o Simples Gaúcho isenta o ICMS do DAS, e a redução fica sem efeito');
    } else {
      const conferir = cliente && ehRS(cliente.uf) ? CNAE_REFEICAO_A_CONFERIR[digitosCnae(cliente.cnae_principal).slice(0, 7)] : null;
      if (conferir) notas.push('CNAE de ' + conferir + ': no RS a base do ICMS pode ser reduzida a 60% (RICMS-RS, Livro I, art. 23, VI, que fala em "empresas preparadoras de refeições coletivas"), mas a alíquota de 12% da refeição não está confirmada pro caso. A conta usou 17% sem redução: confira e preencha a alíquota e as reduções.');
      origens[p + '.aliqIcms'] = origem('padrao', 'padrão: 17%, a interna do RS', 'venda pra outro estado é 12% (7% ou 4% em alguns casos) — confira');
    }
    if (doPg.red > 0) {
      atividades[iMerc].redIcmsSimples = doPg.red;
      origens[p + '.redIcmsSimples'] = origem('reforma', quando + ' (caso da Reforma): ' + pct1(doPg.red) + '% de redução', 'o "percentual de redução" do ICMS que a empresa declara no PGDAS');
      if (!refeicao) notas.push('O ' + quando + ' tem ' + pct1(doPg.red) + '% de redução do ICMS no DAS. No regime geral, a redução depende do benefício que a dá: se ele valer lá também, preencha a redução da base do ICMS no regime geral.');
    }
  }
  atividades.forEach((a, i) => { if (TIPOS[a.tipo].tributo === 'iss') origens['atividades.' + i + '.aliqIss'] = origem('padrao', 'padrão: 3% — confira', 'a alíquota do ISS da atividade no município'); });
  // a venda de mercadoria com alíquota zero de PIS/Cofins: nenhum sistema traz ainda (a apuração do PIS/Cofins do Domínio
  // diria) — padrão a conferir. A revenda monofásica vem da apuração do Simples (a ponte) ou do caso da Reforma
  atividades.forEach((a, i) => { if (TIPOS[a.tipo].tributo === 'icms') origens['atividades.' + i + '.pctAliqZero'] = origem('padrao', 'padrão: nenhuma — confira', 'a parte das vendas de mercadoria com alíquota zero de PIS/Cofins (a Lei 10.925/2004, art. 1º: óleos vegetais, arroz, feijão, carnes, leite, higiene…). No Presumido e no Real: as da Cesta Básica Nacional (LC 214, Anexos I e XV) seguem com zero; as outras pagam 10% da alíquota desde abril de 2026 (LC 224/2025). No Simples, paga no DAS. Só pesa na conta de 2026: em 2027 a CBS toma o lugar'); });
  atividades.forEach((a, i) => { if (a.tipo === 'industria') origens['atividades.' + i + '.aliqIpi'] = origem('padrao', 'padrão: zero — confira', 'o IPI a recolher no ano, em % da receita da indústria, já com os créditos; só 2026 — em 2027 ele vira zero'); });

  const e = { atividades, meses };
  if (cliente && cliente.uf) e.uf = String(cliente.uf).trim().toUpperCase();
  // o RDA dos bares e restaurantes (Presumido e Real): a conta usa o mais barato entre ele e o débito e crédito
  if (iMerc >= 0 && ehRdaRS(cliente && cliente.cnae_principal, cliente && cliente.uf)) {
    e.rda = 'melhor';
    origens.rda = origem('padrao', 'RDA: a conta usa o mais barato — confira', 'RICMS-RS, Livro I, art. 38-A (Dec. 55.458/2020; o Dec. 57.930/2024 o estendeu até 2028): 3,5% de todas as vendas de mercadoria, as com ST também, sem crédito, no Presumido e no Real. Exige a alimentação em 60% ou mais das vendas do ano anterior e nenhuma dívida ativa');
  } else if (refeicao) {
    // a refeição fora do grupo 56.1 (o 5620-1/04, a pizzaria de entrega): sem o RDA, e a tela diz por quê
    origens.rda = origem('cadastro', 'fora do RDA: o CNAE ' + (cliente.cnae_principal || '') + ' não é do grupo 56.1', 'o RDA dos bares e restaurantes (3,5% das vendas, sem crédito) é só pra CNAE do grupo 56.1 (RICMS-RS, Livro I, art. 38-A); com o CNAE principal de restaurante, ele vira opção');
  }
  // compras e despesas: o % da receita medido no caso da Reforma (entradas do Domínio ÷ receita dos mesmos meses)
  if (receita > 0 && inp.pctComprasMercadorias != null && inp.pctComprasMercadorias !== '') {
    e.compras = num(inp.pctComprasMercadorias) / 100 * receita;
    origens.compras = origem('reforma', 'caso da Reforma: compras de mercadorias e insumos = ' + pct1(inp.pctComprasMercadorias) + '% da receita');
  }
  if (receita > 0 && num(inp.pctComprasDespesas) > 0) {
    e.despesasCredito = num(inp.pctComprasDespesas) / 100 * receita;
    origens.despesasCredito = origem('reforma', 'caso da Reforma: energia, frete, ativo e consumo = ' + pct1(inp.pctComprasDespesas) + '% da receita');
  }
  if (num(inp.pctImpostoEmbutido) > 0) { e.pctImpostoEmbutido = num(inp.pctImpostoEmbutido); origens.pctImpostoEmbutido = origem('reforma', 'caso da Reforma: imposto embutido nas compras'); }
  if (inp.pctComprasComCredito != null && inp.pctComprasComCredito !== '') { e.pctComprasComCredito = num(inp.pctComprasComCredito); origens.pctComprasComCredito = origem('reforma', 'caso da Reforma: compras com crédito pelo NCM das notas'); }
  if (['mixCheia', 'mixRed60', 'mixRed40', 'mixRed30', 'mixZero'].some(k => inp[k] != null)) {
    e.mix = { cheia: num(inp.mixCheia), red60: num(inp.mixRed60), red40: num(inp.mixRed40), red30: num(inp.mixRed30), zero: num(inp.mixZero) };
    const soma = e.mix.cheia + e.mix.red60 + e.mix.red40 + e.mix.red30 + e.mix.zero;
    if (Math.abs(soma - 100) > 0.5) { delete e.mix; } else origens.mix = origem('reforma', 'caso da Reforma: alíquotas da Reforma nas vendas');
  }
  // as compras e as despesas com crédito pela ponte (os 12 meses fechados do Domínio, pelo CFOP): valem sobre o % do caso
  const cp = somaDaPonte(mp, ['compras']), dp = somaDaPonte(mp, ['servicos_tomados', 'ativo_e_consumo']);
  if (cp) {
    e.compras = cp.soma;
    origens.compras = origem('ponte', 'Domínio, pela ponte: compras de mercadorias e insumos de ' + periodo(cp), 'pelo CFOP das entradas: revenda, industrialização e as mesmas com ST; fora remessa, retorno, devolução e transferência');
  }
  if (dp) {
    e.despesasCredito = dp.soma;
    origens.despesasCredito = origem('ponte', 'Domínio, pela ponte: energia, comunicação, frete, serviços tomados e ativo e uso e consumo de ' + periodo(dp));
  }
  if (smp && smp.exportacao > 0) notas.push('A apuração do Simples no Domínio tem receita de exportação nos 12 meses (' + brl(smp.exportacao) + '): o comparativo não separa a exportação — confira.');
  if (!origens.compras) origens.compras = origem('padrao', 'falta no sistema', 'solte o acompanhamento de entradas do Domínio ou digite as compras dos 12 meses');
  origens.aliqCreditoIcms = origem('padrao', 'padrão: 12% — confira', 'fornecedor do RS no regime normal dá 17%, de outro estado 12%, do Simples bem menos');
  origens.outrasDespesas = origem('padrao', 'falta no sistema: fazem o lucro do Real', 'aluguel de pessoa física, sistemas, contador, manutenção — o resto dos custos do ano, sem compras nem folha');
  origens.lucroContabil = origem('padrao', 'falta no sistema: a DRE', 'o resultado da DRE antes do IRPJ e da CSLL, até onde a contabilidade está feita (prejuízo, com o sinal de menos). Sem ele, a conta estima o lucro do Real pelas compras, a folha e as despesas');
  origens.ajustesLalur = origem('padrao', 'padrão: sem ajustes', 'adições (despesa indedutível: multa, brinde, doação) menos exclusões (receita que não é tributada) do lucro real');

  // a folha: o Domínio pela ponte (os proventos dos empregados, com as férias, as rescisões e o 13º, e o pró-labore, dos
  // 12 meses fechados) quando tem pelo menos os meses do Fator R; senão o Fator R (os últimos 12 meses lançados); senão
  // em branco
  const fr = (fatorR || []).filter(l => l && l.competencia).sort((a, b) => a.competencia < b.competencia ? 1 : -1).slice(0, 12);
  const fp = somaDaPonte(mp, ['salarios', 'decimo_terceiro']), pp = somaDaPonte(mp, ['pro_labore_valor']);
  if (fp && fp.n >= fr.length) {
    e.folha = fp.soma;
    e.proLabore = pp ? pp.soma : 0;
    origens.folha = origem('ponte', 'Domínio, pela ponte: ' + (fp.soma > 0 ? 'salários, férias, rescisões e 13º' : 'sem empregados na folha') + ' de ' + periodo(fp), 'a soma dos proventos de todos os empregados no mês (nunca o de uma pessoa), mais o 13º');
    origens.proLabore = origem('ponte', 'Domínio, pela ponte: ' + (pp && pp.soma > 0 ? 'pró-labore de ' + periodo(pp) : 'sem pró-labore na folha' + (pp ? ' de ' + periodo(pp) : '')));
  } else if (fr.length) {
    const f = 12 / fr.length;
    e.folha = fr.reduce((s, l) => s + num(l.folha_salarios) + num(l.folha_outros), 0) * f;
    e.proLabore = fr.reduce((s, l) => s + num(l.prolabore), 0) * f;
    const per = rotuloComp(fr[fr.length - 1].competencia.slice(0, 7)) + ' a ' + rotuloComp(fr[0].competencia.slice(0, 7)) + (fr.length < 12 ? ', anualizado' : '');
    origens.folha = origem('fator_r', 'Fator R: salários, 13º e outros de ' + per);
    origens.proLabore = origem('fator_r', 'Fator R: pró-labore de ' + per);
  } else {
    origens.folha = origem('padrao', 'falta no sistema: digite', 'os salários dos 12 meses, com 13º e férias');
    origens.proLabore = origem('padrao', 'falta no sistema: digite');
    // (o serviço do fator r que cai no Anexo V sem a folha, o motor avisa, com o Simples na comparação)
    notas.push('A folha e o pró-labore não estão no sistema: sem eles, o INSS do Presumido e do Real sai zero.');
  }
  origens.rat = origem('padrao', 'padrão: 2% e FAP 1', 'o RAT vai de 1% a 3% pelo CNAE');
  origens.terceiros = origem('padrao', 'padrão: 5,8%', 'o de terceiros da maioria dos FPAS');
  // o RAT e terceiros que a folha recolheu (11/11/2026): na empresa do Presumido ou do Real, as guias do Domínio dizem — o
  // INSS do RAT (já com o FAP) e o de terceiros sobre a base do INSS dos empregados, nos 12 meses. No Simples a guia não tem
  // (a CPP está no DAS) e fica o padrão. Só o que parece RAT (até 6%: 3% com o FAP em 2) e terceiros (até 8%)
  const regimeHoje = cliente ? regimeDoCadastro(cliente.regime_tributario) : null;
  const bi = somaDaPonte(mp, ['base_inss']), ri = somaDaPonte(mp, ['inss_rat']), ti = somaDaPonte(mp, ['inss_terceiros']);
  if ((regimeHoje === 'presumido' || regimeHoje === 'real') && origens.folha.fonte === 'ponte' && bi && bi.soma > 0 && ri && ti) {
    const rat = Math.round(ri.soma / bi.soma * 10000) / 100, terc = Math.round(ti.soma / bi.soma * 10000) / 100;
    if (rat > 0 && rat <= 6 && terc >= 0 && terc <= 8) {
      e.rat = rat; e.fap = 1; e.terceiros = terc;
      origens.rat = origem('ponte', 'Domínio, pela ponte: RAT com o FAP de ' + pct2(rat) + '% nas guias de ' + periodo(bi), 'o INSS do RAT que a folha recolheu (já com o FAP) dividido pela base do INSS dos empregados');
      origens.fap = origem('ponte', 'já está no RAT das guias');
      origens.terceiros = origem('ponte', 'Domínio, pela ponte: ' + pct2(terc) + '% nas guias de ' + periodo(bi), 'o INSS de terceiros que a folha recolheu dividido pela base do INSS dos empregados');
    }
  }
  // o PIS/Cofins das vendas pelas notas (11/11/2026, a versão 5 da ponte): com o CST em quase toda a venda (a empresa do
  // Presumido ou do Real — no Simples o item não tem o CST), a parte com alíquota zero ou isenta e a revenda monofásica
  // ou com substituição tributária saem das notas, sobre a venda de mercadoria dos mesmos meses. A marca da Cesta Básica
  // Nacional segue com a equipe (a nota não diz); o que é sem incidência ou com suspensão (a exportação) fica dito
  const pc = pisCofinsDaPonte(sPonte ? sPonte.janela : mp);
  if (iMerc >= 0 && pc) {
    const p = 'atividades.' + iMerc, am = atividades[iMerc];
    const base = pc.mercadorias > 0 ? pc.mercadorias : pc.total;
    const parte = v => Math.round(Math.min(100, v / base * 100) * 100) / 100;
    if (cstVale(pc)) {
      const pz = parte(pc.zero), pm = parte(pc.mono), nasNotas = ' de PIS/Cofins nas notas de ' + periodoCurto(pc);
      am.pctAliqZero = pz;
      origens[p + '.pctAliqZero'] = { ...origem('ponte', pz > 0 ? 'Domínio, pela ponte: ' + pct1(pz) + '% das vendas de mercadoria com alíquota zero' + (pc.isenta > 0 ? ' ou isentas' : '') + nasNotas : 'Domínio, pela ponte: nenhuma venda com alíquota zero' + nasNotas,
        'pela situação tributária (o CST) do PIS em cada item das notas de saída: 06, alíquota zero, e 07, isenta. No Presumido e no Real: as da Cesta Básica Nacional (LC 214, Anexos I e XV) seguem com zero — marque na atividade —; as outras pagam 10% da alíquota desde abril de 2026 (LC 224/2025)'), cst: true };
      if (am.tipo === 'comercio') {
        am.pctMonofasico = pm;
        origens[p + '.pctMonofasico'] = { ...origem('ponte', pm > 0 ? 'Domínio, pela ponte: ' + pct1(pm) + '% das vendas de mercadoria de revenda monofásica' + (pc.st > 0 ? ' ou com substituição tributária' : '') + nasNotas : 'Domínio, pela ponte: nenhuma revenda monofásica' + nasNotas,
          'pela situação tributária (o CST) do PIS em cada item das notas de saída: 04, a revenda monofásica, e 05, a substituição tributária'), cst: true };
      } else if (pm > 0) notas.push('As notas têm ' + pct1(pm) + '% das vendas de mercadoria como revenda monofásica ou com substituição tributária de PIS/Cofins (CST 04 e 05), e a atividade está como indústria: a conta não separa essa revenda — confira.');
      const pf = pc.fora / pc.total * 100;
      if (pf >= 0.5) notas.push('As notas têm ' + pct1(pf) + '% das vendas sem incidência ou com suspensão de PIS/Cofins (CST 08 e 09: a exportação, a venda com suspensão): o comparativo não separa essas vendas e conta o PIS/Cofins nelas — confira.');
    } else if (regimeHoje === 'presumido' || regimeHoje === 'real') {
      // a ponte leu as notas e a maior parte da venda não tem o CST do PIS/Cofins (ou vem como "outras"): segue a conferir
      const antes = origens[p + '.pctAliqZero'];
      origens[p + '.pctAliqZero'] = origem('padrao', 'padrão: nenhuma — confira (só ' + pct1(pc.classificada / pc.total * 100) + '% das vendas têm o CST do PIS/Cofins nas notas do Domínio)', antes && antes.dica);
    }
  }

  e.regimeAtual = cliente ? ['simples', 'presumido', 'real'].includes(regimeDoCadastro(cliente.regime_tributario)) ? regimeDoCadastro(cliente.regime_tributario) : null : null;
  if (cliente && regimeDoCadastro(cliente.regime_tributario) === 'mei') notas.push('A empresa é MEI hoje: o comparativo é pra quando ela passar do limite do MEI (Simples como ME × Presumido × Real).');
  if ((tipoAnexo === 'servico' || doAnexo.servico === 'III') && (fr.length || fp)) {
    const n = 'Serviço no Anexo III no PGDAS: se a atividade é do fator r (vai pro Anexo V quando a folha não chega a 28% da receita), troque o tipo pra "Serviços do fator r".';
    notas.push(n); notasSimples.push(n);
  }
  // a conferência do Simples: a alíquota efetiva do último PGDAS lido na Reforma
  const pg = dom.pgdas || null;
  const conferencia = pg && num(pg.aliquotaEfetiva) > 0 ? { competencia: pg.competencia, aliquota: num(pg.aliquotaEfetiva), das: num(pg.dasTotal), fonte: 'reforma' } : null;
  const sd = serieDaEmpresa({ caso, pgdas, dominio: mp });
  // divisao: a medida da venda de mercadoria × serviço (as notas); especial: a presunção própria do CNAE principal; lida:
  // a ponte do Domínio leu a empresa (com ou sem nota nos meses fechados)
  return { entrada: e, origens, notas, notasSimples, conferencia, serie: sd ? sd.serie : null, ponte: sPonte ? { de: sPonte.de, ate: sPonte.ate, n: sPonte.n } : null,
    divisao: medida, especial, lida: mp.length > 0 };
}

// junta duas séries datadas ([{ competencia 'AAAA-MM', total }]) — a de b vale no mês que as duas têm —, em ordem. É o que a
// tela faz com o faturamento solto nela: os meses do relatório entram na série do sistema (o ano do limite, o crescimento
// medido e o "até quando" de cada fase passam a contar com eles), e a parte do relatório fica gravada no estudo (serieRel)
export function mesclarSerie(a, b) {
  const m = new Map();
  [...(a || []), ...(b || [])].forEach(x => { if (x && /^\d{4}-\d{2}$/.test(x.competencia) && num(x.total) > 0) m.set(x.competencia, { competencia: x.competencia, total: num(x.total) }); });
  const l = [...m.values()].sort((x, y) => (x.competencia < y.competencia ? -1 : 1));
  return l.length ? l : null;
}

// ---------- as outras empresas dos mesmos sócios ----------
// a série datada da receita: o PGDAS da Receita (o declarado) ou o Domínio pela ponte — o que tem mais meses dos 12;
// empatados, o PGDAS —, senão o faturamento do caso da Reforma — [{ competencia, total }]. dominio: as linhas de
// dominio_mensal da empresa (os meses fechados)
export function serieDaEmpresa({ caso = null, pgdas = [], dominio = [] } = {}) {
  const ok = m => m && /^\d{4}-\d{2}$/.test(m.competencia) && num(m.total) > 0;
  const ordem = l => l.sort((a, b) => a.competencia < b.competencia ? -1 : 1);
  const pg = ordem((pgdas || []).map(p => ({ competencia: p && p.competencia, total: num(p && p.receita_mes) })).filter(ok));
  const sp = seriePonte(mesesDaPonte(dominio));
  if (pg.length && (!sp || pg.slice(-12).length >= sp.npos)) return { fonte: 'pgdas', serie: pg };
  if (sp) return { fonte: 'ponte', serie: sp.serie, ponte: sp };
  const sim = lerSim(caso), dom = (sim && sim.dominio) || {};
  const ms = ordem((dom.meses || (dom.vendas && dom.vendas.meses) || []).map(m => ({ competencia: m && m.competencia, total: num(m && m.total) })).filter(ok));
  return ms.length ? { fonte: 'reforma', serie: ms } : null;
}
// a receita de 12 meses de uma empresa do grupo, como o motor lê ({ nome, receita, meses }), com a série e a origem
export function receitaDaEmpresa({ cliente = null, caso = null, pgdas = [], dominio = [] } = {}) {
  const nome = cliente ? (cliente.nome_principal || cliente.nome_fantasia || 'outra empresa') + (cliente.nome_fantasia && cliente.nome_principal && cliente.nome_fantasia !== cliente.nome_principal ? ' (' + cliente.nome_fantasia + ')' : '') : 'outra empresa';
  const sd = serieDaEmpresa({ caso, pgdas, dominio });
  if (sd && sd.fonte === 'ponte') {
    const sp = sd.ponte;
    return { nome, cliente_id: cliente ? cliente.id : null, receita: sp.receita, meses: sp.meses, serie: sd.serie,
      origem: origem('ponte', 'Domínio, pela ponte: ' + oQueDaPonte(sp) + ' de ' + periodo(sp)) };
  }
  const s = sd ? serieDosMeses(sd.serie) : null;
  if (s) return { nome, cliente_id: cliente ? cliente.id : null, receita: s.receita, meses: s.meses, serie: sd.serie,
    origem: origem(sd.fonte, (sd.fonte === 'pgdas' ? 'PGDAS na Receita, de ' : 'caso da Reforma: faturamento do Domínio de ') + periodo(s)) };
  if (caso && num(caso.receita_mensal) > 0) return { nome, cliente_id: cliente ? cliente.id : null, receita: num(caso.receita_mensal) * 12, meses: null, serie: null,
    origem: origem('reforma', 'caso da Reforma: receita mensal × 12') };
  return { nome, cliente_id: cliente ? cliente.id : null, receita: 0, meses: null, serie: null, origem: origem('padrao', 'falta no sistema: digite os 12 meses') };
}
// quem é sócio desta e de outra: socios (desta) e outros ([{ cliente_id, nome, cpf, participacao_percentual?,
// eh_administrador? }], das outras) — casa pelo CPF (só os dígitos); sem o CPF de um dos lados, pelo nome sem acento.
// Volta [{ cliente_id, socios: [nomes], participacao, administrador }], sem esta — participacao: a maior entre os sócios em
// comum, na outra (nula = não está no cadastro); administrador: algum deles administra a outra (LC 123, art. 3º, §4º, V).
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export function empresasDosSocios(socios, outros, clienteId) {
  const meus = (socios || []).filter(s => s && (s.nome || s.cpf)).map(s => ({ nome: s.nome, cpf: String(s.cpf || '').replace(/\D/g, ''), chave: semAcento(s.nome) }));
  const por = new Map();
  (outros || []).forEach(o => {
    if (!o || !o.cliente_id || o.cliente_id === clienteId) return;
    const cpf = String(o.cpf || '').replace(/\D/g, ''), chave = semAcento(o.nome);
    const m = meus.find(s => s.cpf && cpf ? s.cpf === cpf : (s.chave && s.chave === chave));
    if (!m) return;
    const g = por.get(o.cliente_id) || { cliente_id: o.cliente_id, socios: [], participacao: null, administrador: false };
    if (!g.socios.includes(m.nome)) g.socios.push(m.nome);
    const p = o.participacao_percentual == null || o.participacao_percentual === '' ? null : num(o.participacao_percentual, null);
    if (p != null && (g.participacao == null || p > g.participacao)) g.participacao = p;
    if (o.eh_administrador === true) g.administrador = true;
    por.set(o.cliente_id, g);
  });
  return [...por.values()];
}
// quem entra na soma do limite (LC 123, art. 3º, §4º): a outra ME ou EPP — optante ou não — com qualquer participação
// (inciso III); a que não é ME nem EPP (faturou mais de R$ 4,8 milhões nos 12 meses), só com o sócio acima de 10% (IV) ou
// administrando (V). Sem a participação no cadastro, ou sem a receita da outra, entra (a conta fica do lado seguro).
// Volta null (entra) ou o porquê de ficar fora.
export function foraDaSoma(empresa, receita12) {
  const e = empresa || {};
  if (!(num(receita12) > LIMITE_DO_SIMPLES)) return null;
  if (e.administrador || e.participacao == null || num(e.participacao) > 10) return null;
  return 'ela faturou ' + brl(receita12) + ' nos 12 meses (não é ME nem EPP) e o sócio em comum tem ' + pct1(e.participacao) + '% dela, sem administrar — só conta acima de 10% ou com o sócio administrador (LC 123, art. 3º, §4º, IV e V)';
}
const LIMITE_DO_SIMPLES = 4800000;
// a outra que faturou mais de R$ 4,8 milhões e entrou na soma sem a participação no cadastro: o aviso pra conferir
export function avisoDaSoma(empresa, receita12, nome) {
  const e = empresa || {};
  if (!(num(receita12) > LIMITE_DO_SIMPLES) || e.administrador || e.participacao != null) return null;
  return (nome || 'A outra empresa dos sócios') + ' faturou ' + brl(receita12) + ' nos 12 meses (não é ME nem EPP): ela só conta na soma do limite se o sócio em comum tiver mais de 10% dela ou a administrar (LC 123, art. 3º, §4º, IV e V). A participação não está no cadastro, e a conta somou — confira.';
}
// o ano-calendário pelos números do sistema: até o último mês que todas têm, a soma do ano, o ritmo dos últimos 3 meses e,
// nesse ritmo, o mês em que a soma passa do limite. Com as empresas dos sócios, a saída vem no mês seguinte, sem a
// tolerância (LC 123, art. 3º, §6º; Res. CGSN 140, art. 81, II, "c"); sozinha, o excesso de até 20% (R$ 5,76 milhões) só
// tira do Simples no ano seguinte, e acima disso, no mês seguinte ao que passou dos 20% (art. 3º, §§9º e 9º-A).
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function situacaoDoGrupo(serieEmpresa, outras, limite = 4800000) {
  const series = [{ nome: 'esta', serie: serieEmpresa || [] }, ...(outras || []).map(o => ({ nome: o.nome, serie: o.serie || [] }))];
  if (series.some(s => !s.serie.length)) return null;
  const ate = series.map(s => s.serie[s.serie.length - 1].competencia).sort()[0];
  const ano = ate.slice(0, 4), mesAte = Number(ate.slice(5, 7));
  const val = (s, c) => { const m = s.serie.find(x => x.competencia === c); return m ? num(m.total) : null; };
  const comp = (a, m) => a + '-' + String(m).padStart(2, '0');
  // os meses do ano até `ate` que todas têm
  const mesesAno = [];
  for (let m = 1; m <= mesAte; m++) { const c = comp(ano, m); if (series.every(s => val(s, c) != null)) mesesAno.push(c); }
  const porEmpresa = series.map(s => ({ nome: s.nome, ano: mesesAno.reduce((t, c) => t + val(s, c), 0) }));
  const acumulado = porEmpresa.reduce((t, p) => t + p.ano, 0);
  // os últimos 3 meses que todas têm (podem vir do ano anterior)
  const ult3 = [];
  for (let k = 0, a = Number(ano), m = mesAte; ult3.length < 3 && k < 24; k++) {
    const c = comp(a, m);
    if (series.every(s => val(s, c) != null)) ult3.push(c);
    m -= 1; if (m < 1) { m = 12; a -= 1; }
  }
  const ritmo = ult3.length ? ult3.reduce((t, c) => t + series.reduce((u, s) => u + val(s, c), 0), 0) / ult3.length : 0;
  const restantes = 12 - mesAte;
  // o mês em que a soma passou (já aconteceu) ou, no ritmo dos últimos 3 meses, passaria
  // o mês (1 a 12) em que a soma passa de um valor: já aconteceu ou, no ritmo dos últimos 3 meses, aconteceria
  const mesEmQuePassa = lim => {
    let acum = 0;
    for (const c of mesesAno) { acum += series.reduce((u, s) => u + val(s, c), 0); if (acum > lim) return { mes: Number(c.slice(5, 7)), ja: true }; }
    for (let j = 1; j <= restantes; j++) if (acumulado + ritmo * j > lim) return { mes: mesAte + j, ja: false };
    return null;
  };
  const p = mesEmQuePassa(limite);
  const passaEm = p ? p.mes : null, jaPassou = !!(p && p.ja);
  const sozinha = series.length === 1;
  const p20 = sozinha && p ? mesEmQuePassa(limite * 1.2) : null;
  const mesSeguinte = m => m === 12 ? '01/01/' + (Number(ano) + 1) : '01/' + String(m + 1).padStart(2, '0') + '/' + ano;
  const noAnoSeguinte = !!(sozinha && p && !p20);
  const saiEm = !passaEm ? null : noAnoSeguinte ? '01/01/' + (Number(ano) + 1) : mesSeguinte(sozinha ? p20.mes : passaEm);
  return {
    ano: Number(ano), ate, meses: mesesAno.length, acumulado, porEmpresa, ritmo, restantes, limite,
    projecao: acumulado + ritmo * restantes, faltam: Math.max(0, limite - acumulado),
    porMesAteOLimite: restantes > 0 ? Math.max(0, limite - acumulado) / restantes : null,
    passaEm: passaEm ? MES_LONGO[passaEm - 1] : null, jaPassou, saiEm, noAnoSeguinte,
    passa20Em: p20 ? MES_LONGO[p20.mes - 1] : null
  };
}

// ---------- os relatórios do Domínio soltos na tela ----------
// cons: o resultado de consolidar() (dominio-relatorios.js) — muda só o que os relatórios trazem, e marca a origem
export function aplicarRelatorios(entrada, origens, cons) {
  const e = JSON.parse(JSON.stringify(entrada || {}));
  const o = { ...(origens || {}) };
  if (!cons) return { entrada: e, origens: o, conferencia: null };
  const s = serieDosMeses(cons.fat ? cons.fat.meses : cons.resVen ? cons.resVen.meses : []);
  const tipoAnexo = tipoPeloAnexo(cons.campos && cons.campos.anexo);
  if (s) {
    const atuais = e.atividades && e.atividades.length ? e.atividades : [{ tipo: 'comercio', receita: 0 }];
    let tipoMerc = (atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms') || {}).tipo || 'comercio';
    let tipoServ = (atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'iss') || {}).tipo || 'servico';
    if (tipoAnexo === 'comercio' || tipoAnexo === 'industria') tipoMerc = tipoAnexo; else if (tipoAnexo) tipoServ = tipoAnexo;
    const novas = linhas(s.receita, s.mercadorias, s.servicos, tipoMerc, tipoServ);
    // o resto de cada linha (ST, ISS, presunção…) fica o que já estava na linha do mesmo tributo
    e.atividades = novas.map(n => ({ ...(atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === TIPOS[n.tipo].tributo) || {}), tipo: n.tipo, receita: n.receita }));
    e.meses = s.meses;
    Object.keys(o).filter(k => k.startsWith('atividades.')).forEach(k => { if (/\.(receita|tipo)$/.test(k)) delete o[k]; });
    const txt = (cons.fat ? 'faturamento' : 'saídas e serviços') + ' do Domínio de ' + periodo(s);
    // o relatório que separa a venda de mercadoria do serviço diz a atividade de cada linha (é o que faz a presunção)
    const medido = s.mercadorias + s.servicos > 0;
    e.atividades.forEach((a, i) => {
      o['atividades.' + i + '.receita'] = origem('dominio', txt);
      if (tipoAnexo && a.tipo === tipoAnexo) o['atividades.' + i + '.tipo'] = origem('dominio', 'Anexo ' + cons.campos.anexo + ' do PGDAS');
      else if (medido) o['atividades.' + i + '.tipo'] = origem('dominio', (TIPOS[a.tipo].tributo === 'icms' ? 'venda de mercadoria' : 'serviço') + (cons.fat ? ', pelo ' : ', pelas ') + txt);
    });
  }
  const receita = (e.atividades || []).reduce((t, a) => t + num(a.receita), 0);
  const v = cons.resVen;
  const iMerc = (e.atividades || []).findIndex(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms');
  if (v && iMerc >= 0 && num(v.mercadorias) > 0) {
    e.atividades[iMerc].pctST = Math.min(100, num(v.st) / num(v.mercadorias) * 100);
    o['atividades.' + iMerc + '.pctST'] = origem('dominio', 'saídas do Domínio: vendas com ST (CFOP x401 a x405), ' + brl(v.st) + ' de ' + brl(v.mercadorias));
  }
  const c = cons.campos || {};
  if (receita > 0 && c.pctMerc != null) { e.compras = c.pctMerc / 100 * receita; o.compras = origem('dominio', (cons.origem && cons.origem.pctMerc) || 'entradas do Domínio'); }
  if (receita > 0 && c.pctDesp != null) { e.despesasCredito = c.pctDesp / 100 * receita; o.despesasCredito = origem('dominio', (cons.origem && cons.origem.pctDesp) || 'entradas do Domínio'); }
  const sim = cons.sim;
  // o "percentual de redução" do ICMS no PGDAS solto na tela
  if (sim && num(sim.reducaoIcms) > 0 && iMerc >= 0) {
    e.atividades[iMerc].redIcmsSimples = num(sim.reducaoIcms);
    o['atividades.' + iMerc + '.redIcmsSimples'] = origem('dominio', 'PGDAS de ' + rotuloComp(sim.competencia) + ': ' + pct1(sim.reducaoIcms) + '% de redução', 'o "percentual de redução" do ICMS que a empresa declara no PGDAS');
  }
  const conferencia = sim && sim.aliquotaEfetiva != null ? { competencia: sim.competencia, aliquota: sim.aliquotaEfetiva, das: sim.dasTotal, fonte: 'dominio' } : null;
  return { entrada: e, origens: o, conferencia };
}

// ---------- o resumo da folha do Domínio (01/11/2026) ----------
// O Comparativo lê o resumo da folha com a leitura do Fator R: a função extract-document, no modo fator_r, devolve por
// competência os salários (brutos), o pró-labore, a CPP, o FGTS e os outros (13º em dezembro, autônomos). Daqui sai só o
// total do ano: nenhum nome nem valor de funcionário fica na tela ou no estudo.
const semAcentoMai = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// o relatório que o leitor dos relatórios fiscais não reconheceu parece uma folha: o título e as rubricas
export function pareceFolha(linhas) {
  const t = semAcentoMai((linhas || []).slice(0, 400).join(' | '));
  const titulo = /RESUMO (GERAL )?DA FOLHA|FOLHA DE PAGAMENTO|EXTRATO (MENSAL|DA FOLHA)|RESUMO MENSAL|RELACAO DE CALCULO|RESUMO DO CALCULO|FOLHA MENSAL/.test(t);
  const sinais = [/PRO[- ]?LABORE/, /\bFGTS\b/, /\bINSS\b/, /SALARIO/, /PROVENTOS/, /DESCONTOS/, /LIQUIDO/, /\bIRRF\b/].filter(r => r.test(t)).length;
  return (titulo && sinais >= 2) || sinais >= 5;
}
// os CNPJs do cabeçalho (as 16 primeiras linhas), sem a pontuação: pra conferir se o relatório é da empresa do estudo
export function cnpjsDoCabecalho(linhas) {
  const out = [];
  (linhas || []).slice(0, 16).forEach(l => (String(l).toUpperCase().match(/[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}/g) || [])
    .forEach(c => { const d = c.replace(/[.\/-]/g, ''); if (!out.includes(d)) out.push(d); }));
  return out;
}
const CAMPOS_FOLHA = ['folha_salarios', 'prolabore', 'folha_outros'];
const mesAntes = c => { const a = Number(c.slice(0, 4)), m = Number(c.slice(5, 7)); return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0'); };
// junta uma leitura às de antes, mês a mês e campo a campo: o campo que a leitura trouxe vale (o mesmo relatório solto duas
// vezes não soma em dobro; o resumo do pró-labore solto à parte completa o dos salários), e um zero não apaga um valor de
// antes. O que veio pelo mês do pagamento (meses_caixa) volta pra competência anterior. Só os três totais ficam.
export function juntarFolha(atual, dados) {
  const m = new Map((atual || []).filter(x => x && /^\d{4}-\d{2}$/.test(x.competencia)).map(x => [x.competencia, { ...x }]));
  const por = (lista, desloca) => (Array.isArray(lista) ? lista : []).forEach(x => {
    if (!x || !/^\d{4}-\d{2}$/.test(String(x.competencia || ''))) return;
    const c = desloca ? mesAntes(x.competencia) : x.competencia;
    const o = m.get(c) || { competencia: c };
    CAMPOS_FOLHA.forEach(k => {
      const v = x[k] == null || x[k] === '' ? NaN : Number(x[k]);
      if (!Number.isFinite(v) || v < 0) return;
      if (v === 0 && num(o[k]) > 0) return;
      o[k] = Math.round(v * 100) / 100;
    });
    if (CAMPOS_FOLHA.some(k => o[k] != null)) m.set(c, o);
  });
  por(dados && dados.meses, false);
  por(dados && dados.meses_caixa, true);
  const l = [...m.values()].map(x => Object.fromEntries([['competencia', x.competencia], ...CAMPOS_FOLHA.filter(k => x[k] != null).map(k => [k, x[k]])]))
    .sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  return l.length ? l : null;
}
// a folha (salários + outros) e o pró-labore do ano pelos meses lidos: os 12 meses que terminam no último mês da receita
// (ate; sem ele, no último mês lido); com menos de 12 e pelo menos 3, anualizado; com menos de 3, não usa
export function folhaDoAno(meses, ate = null) {
  const l = (meses || []).filter(x => x && /^\d{4}-\d{2}$/.test(x.competencia)).sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  if (!l.length) return { ok: false, motivo: 'a leitura não trouxe nenhum mês da folha' };
  const fim = ate && /^\d{4}-\d{2}$/.test(ate) ? ate : l[l.length - 1].competencia;
  let ini = fim;
  for (let i = 0; i < 11; i++) ini = mesAntes(ini);
  let usados = l.filter(x => x.competencia >= ini && x.competencia <= fim), foraDoPeriodo = false;
  if (!usados.length) { usados = l.slice(-12); foraDoPeriodo = true; }
  const n = usados.length;
  if (n < 3) return { ok: false, motivo: 'a leitura trouxe só ' + n + (n === 1 ? ' mês' : ' meses') + ' da folha' + (foraDoPeriodo ? '' : ' nos 12 meses da receita') + ': solte o resumo da folha mês a mês' };
  const soma = k => usados.reduce((t, x) => t + num(x[k]), 0);
  const f = 12 / n;
  return { ok: true, n, de: usados[0].competencia, ate: usados[n - 1].competencia, anualizado: n < 12, foraDoPeriodo,
    folha: Math.round((soma('folha_salarios') + soma('folha_outros')) * f * 100) / 100,
    proLabore: Math.round(soma('prolabore') * f * 100) / 100,
    temSalarios: usados.some(x => x.folha_salarios != null || x.folha_outros != null), temPro: usados.some(x => x.prolabore != null) };
}
// a folha e o pró-labore do resumo na entrada, com a origem (o relatório do Domínio) e as notas do que falta conferir
export function aplicarFolha(entrada, origens, r) {
  const e = JSON.parse(JSON.stringify(entrada || {}));
  const o = { ...(origens || {}) };
  const notas = [];
  if (!r || !r.ok) return { entrada: e, origens: o, notas };
  const per = rotuloComp(r.de) + ' a ' + rotuloComp(r.ate) + (r.anualizado ? ' (' + r.n + ' meses, anualizado)' : '');
  e.folha = r.folha;
  e.proLabore = r.proLabore;
  o.folha = origem('dominio', 'resumo da folha do Domínio de ' + per + (r.temSalarios ? '' : ': sem salários'), 'os salários brutos, as férias, o 13º e os autônomos de cada mês');
  o.proLabore = origem('dominio', 'resumo da folha do Domínio de ' + per + (r.temPro ? '' : ': sem pró-labore'));
  if (!r.temSalarios) notas.push('O resumo da folha não trouxe salários: a conta usou a folha zero. Se a empresa tem empregados, solte o resumo da folha deles também.');
  if (!r.temPro) notas.push('O resumo da folha não trouxe pró-labore: a conta usou zero. Se os sócios retiram pró-labore e ele é calculado à parte no Domínio, solte esse resumo também.');
  if (r.foraDoPeriodo) notas.push('O resumo da folha é de ' + per + ', fora dos 12 meses da receita: a conta usou os meses dele. Confira o período exportado.');
  return { entrada: e, origens: o, notas };
}

// ---------- as premissas que valem um teste ----------
// as que ficaram no padrão e mexem na conta: o motor refaz o ano da decisão com os valores de cada lado
export function premissasParaTestar(entrada, origens, regimes = null) {
  const e = entrada || {}, o = origens || {};
  // sem o Simples na comparação, o que só mexe no DAS não vale teste
  const comSimples = !Array.isArray(regimes) || regimes.includes('simples');
  const padrao = k => !o[k] || o[k].fonte === 'padrao';
  const geralHoje = e.regimeAtual === 'presumido' || e.regimeAtual === 'real';
  const out = [];
  const ats = e.atividades || [];
  const temIcms = ats.some(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms' && num(a.receita) > 0);
  if (temIcms && num(e.compras) > 0 && padrao('aliqCreditoIcms')) out.push({ campo: 'aliqCreditoIcms', valores: [7, 17], rotulo: 'o crédito de ICMS das compras', unidade: '%' });
  ats.forEach((a, i) => {
    const t = TIPOS[a.tipo];
    if (!t || !(num(a.receita) > 0)) return;
    // o nome da atividade: sem o Simples na comparação, o serviço não leva o anexo
    const qual = ats.length > 1 ? ' (' + rotuloDoTipo(a.tipo, comSimples).toLowerCase() + ')' : '';
    if (t.tributo === 'icms' && padrao('atividades.' + i + '.aliqIcms')) out.push({ campo: 'atividades.' + i + '.aliqIcms', valores: [num(a.aliqIcms, 17) === 12 ? 17 : 12], rotulo: 'o ICMS das vendas' + qual, unidade: '%' });
    if (t.tributo === 'icms' && num(a.redIcms) > 0 && padrao('atividades.' + i + '.redIcms')) out.push({ campo: 'atividades.' + i + '.redIcms', valores: [0], rotulo: 'a redução da base do ICMS no regime geral' + qual, unidade: '%' });
    if (comSimples && t.tributo === 'icms' && num(a.redIcmsSimples) > 0 && padrao('atividades.' + i + '.redIcmsSimples')) out.push({ campo: 'atividades.' + i + '.redIcmsSimples', valores: [0], rotulo: 'a redução do ICMS no DAS' + qual, unidade: '%' });
    // as vendas com alíquota zero de PIS/Cofins mudam o PIS/Cofins de 2026 do Presumido e do Real e o que a DRE descontou
    // (o lucro do Real, pela troca dos tributos): valem teste só no Presumido contra o Real e na empresa que hoje é do
    // Presumido ou do Real (no Simples, a alíquota zero não sai do DAS). O teste é com toda a venda sem PIS/Cofins
    if ((!comSimples || geralHoje) && t.tributo === 'icms' && padrao('atividades.' + i + '.pctAliqZero') && !(num(a.pctAliqZero) > 0) && num(a.pctMonofasico) < 100) out.push({ campo: 'atividades.' + i + '.pctAliqZero', valores: [100], rotulo: 'as vendas com alíquota zero de PIS/Cofins' + qual, unidade: '%',
      confira: 'A conta supõe que toda a venda paga PIS/Cofins — confira se o produto tem alíquota zero (a Lei 10.925/2004: óleos vegetais, arroz, carnes, leite, higiene…) ou é monofásico.' });
    if (t.tributo === 'iss' && padrao('atividades.' + i + '.aliqIss')) out.push({ campo: 'atividades.' + i + '.aliqIss', valores: [2, 5], rotulo: 'o ISS' + qual, unidade: '%' });
  });
  if (padrao('rat') && num(e.folha) > 0) out.push({ campo: 'rat', valores: [1, 3], rotulo: 'o RAT', unidade: '%' });
  if (temIcms && e.rda === 'melhor' && padrao('rda')) out.push({ campo: 'rda', valores: [null], rotulo: 'o ICMS do restaurante no Presumido e no Real', nomes: { null: 'sem o RDA' }, confira: 'A conta supõe que a empresa pode optar pelo RDA (alimentação em 60% ou mais das vendas, sem dívida ativa) — confira.' });
  if (num(e.compras) > 0 && padrao('pctComprasSimples')) out.push({ campo: 'pctComprasSimples', valores: [50], rotulo: 'as compras de fornecedor do Simples (crédito menor de CBS/IBS)', unidade: '% das compras' });
  return out;
}

// ---------- os prazos da escolha ----------
// hoje: 'AAAA-MM-DD' · ano: o ano da decisão. Entrada no Simples: 1º a 30/09 do ano anterior, com cancelamento até 30/11
// (LC 123, art. 16, na redação da LC 214; Res. CGSN 140, art. 6º, na redação da Res. CGSN 190/2026). Saída por opção:
// a qualquer tempo, com efeitos em 1º de janeiro do ano seguinte (Res. CGSN 140, art. 81, I, na redação da Res. 190,
// em vigor desde 01/01/2027; até 2026 a comunicação de dezembro já valia pra janeiro seguinte e a de janeiro, pro
// próprio ano). Presumido: a opção é o pagamento da 1ª quota do IRPJ do 1º trimestre (Lei 9.430, art. 26, §1º); Real
// anual: a estimativa de janeiro, paga até o fim de fevereiro (art. 3º, parágrafo único, e art. 6º); Real trimestral: o 1º trimestre.
// A exclusão obrigatória, pelo ano-calendário (situacao: situacaoDoGrupo): com as empresas dos sócios (a receita global é
// uma vedação, art. 3º, §4º), comunicar até o último dia útil do mês seguinte ao que a soma passou, com efeito no 1º dia
// desse mês (LC 123, art. 30, §1º, II, e art. 31, II); sozinha, com o excesso de até 20%, até o último dia útil de janeiro
// do ano seguinte, com efeito em 01/01 (art. 30, §1º, IV, "b"); acima dos 20%, até o último dia útil do mês seguinte ao que
// passou deles, com efeito nesse mês (art. 30, §1º, IV, "a"). Sem a comunicação, a multa do art. 36: 10% dos tributos do
// Simples do mês anterior ao efeito, no mínimo R$ 200. O último dia útil, pelos feriados de rescisao-datas.js.
export function ultimoDiaUtil(ano, mes) {
  let iso = new Date(Date.UTC(Number(ano), Number(mes), 0)).toISOString().slice(0, 10);
  while (!diaUtil(iso)) iso = somaDias(iso, -1);
  return iso;
}
export function exclusaoObrigatoria(situacao) {
  const s = situacao;
  if (!s || !s.passaEm) return null;
  const mesDe = nome => MES_LONGO.indexOf(nome) + 1;
  const seguinte = m => (m === 12 ? [s.ano + 1, 1] : [s.ano, m + 1]);
  const multa = ' Sem a comunicação, a multa é de 10% dos tributos do Simples do mês anterior ao efeito, no mínimo R$ 200 (art. 36).';
  const quando = s.jaPassou ? ' passou' : ', no ritmo dos últimos 3 meses, passa';
  if ((s.porEmpresa || []).length > 1) {
    const [a, m] = seguinte(mesDe(s.passaEm));
    return { titulo: 'Comunicar a exclusão do Simples', ate: ultimoDiaUtil(a, m),
      texto: 'A soma com as empresas dos sócios' + quando + ' do limite em ' + s.passaEm + ': a exclusão é obrigatória, com efeito em ' + s.saiEm
        + ', comunicada no Portal do Simples até ' + fmtData(ultimoDiaUtil(a, m)) + ' (LC 123, art. 30, §1º, II, e art. 31, II).' + multa };
  }
  if (s.noAnoSeguinte) {
    return { titulo: 'Comunicar a exclusão do Simples', ate: ultimoDiaUtil(s.ano + 1, 1),
      texto: 'A receita do ano' + quando + ' do limite em ' + s.passaEm + ', sem passar dos 20% a mais: a exclusão é obrigatória, com efeito em ' + s.saiEm
        + ', comunicada no Portal do Simples até ' + fmtData(ultimoDiaUtil(s.ano + 1, 1)) + ' (LC 123, art. 30, §1º, IV, "b").' + multa };
  }
  if (s.passa20Em) {
    const [a, m] = seguinte(mesDe(s.passa20Em));
    return { titulo: 'Comunicar a exclusão do Simples', ate: ultimoDiaUtil(a, m),
      texto: 'A receita do ano' + quando + ' dos 20% acima do limite (R$ 5,76 milhões) em ' + s.passa20Em
        + ': a exclusão é obrigatória, com efeito em ' + s.saiEm + ', comunicada no Portal do Simples até ' + fmtData(ultimoDiaUtil(a, m)) + ' (LC 123, art. 30, §1º, IV, "a").' + multa };
  }
  return null;
}
// opcoes: { objetivo ('presumido_real' tira os prazos do Simples de quem está no regime geral), vedado (o Simples vedado
// pelo cadastro: a entrada nele depende de tirar os impedimentos) }
export function prazosDaEscolha(hoje, regimeAtual, ano = 2027, situacao = null, opcoes = {}) {
  const h = String(hoje || '').slice(0, 10);
  const antes = (d) => h <= d;
  const out = [];
  const comSimples = opcoes.objetivo !== 'presumido_real';
  const impedida = opcoes.vedado ? ' Antes, a empresa precisa tirar os impedimentos do cadastro.' : '';
  if (regimeAtual === 'simples') {
    const obrig = exclusaoObrigatoria(situacao);
    if (obrig) out.push({ titulo: obrig.titulo, texto: obrig.texto });
    out.push(antes((ano - 1) + '-12-31')
      ? { titulo: 'Sair do Simples em ' + ano, texto: 'Comunicar a exclusão por opção no Portal do Simples até 31/12/' + (ano - 1) + ', com efeito em 01/01/' + ano + '. Em janeiro de ' + ano + ' a comunicação já vale só pra ' + (ano + 1) + ' (Res. CGSN 140, art. 81, I, na redação da Res. CGSN 190/2026).' }
      : { titulo: 'Sair do Simples', texto: 'A exclusão por opção comunicada agora vale a partir de 01/01 do ano seguinte (Res. CGSN 140, art. 81, I, na redação da Res. CGSN 190/2026).' });
    if (comSimples) out.push({ titulo: 'IBS/CBS por fora, sem sair do Simples', texto: 'Janelas em março (efeito em julho) e setembro (efeito em janeiro), na ficha da Reforma Tributária.' });
  } else if ((regimeAtual === 'presumido' || regimeAtual === 'real') && comSimples) {
    out.push(antes((ano - 1) + '-09-30')
      ? { titulo: 'Entrar no Simples em ' + ano, texto: 'A opção vai de 01 a 30/09/' + (ano - 1) + ', no Portal do Simples (LC 123, art. 16, na redação da LC 214).' + impedida }
      : { titulo: 'Entrar no Simples', texto: 'A janela de ' + ano + ' fechou em 30/09/' + (ano - 1) + '. A próxima é de 01 a 30/09/' + ano + ', pra ' + (ano + 1) + '.' + impedida });
  }
  if (regimeAtual !== 'mei') out.push({ titulo: 'Presumido ou Real em ' + ano, texto: 'A escolha se faz no primeiro pagamento do IRPJ de ' + ano + ': no Presumido e no Real trimestral, a quota do 1º trimestre, que vence no fim de abril (Lei 9.430, art. 26, §1º); no Real anual, a estimativa de janeiro, que vence no fim de fevereiro (Lei 9.430, art. 3º, parágrafo único).'
    + (comSimples ? '' : ' A escolha vale pro ano inteiro: não dá pra trocar no meio de ' + ano + ' (Lei 9.718, art. 13, §1º; Lei 9.430, art. 3º).') });
  return out;
}

// ---------- o lucro da contabilidade até onde ela está feita (11/11/2026) ----------
// O Samuel, com a primeira empresa do regime geral (a contabilidade feita até jul/26, a receita até set/26): "a ponte da
// Domínio deveria puxar essa informação até a data que supostamente a contabilidade está feita". A DRE dos 12 meses da
// receita só fecha com a contabilidade em dia; a que está dois meses atrás já tem o resultado de 10 dos 12. O lucro do
// estudo é o da DRE no período que a contabilidade tem (lucroDe a lucroAte), levado aos 12 meses pela receita: a margem
// dos meses feitos vale pros que faltam.
const RE_COMP = /^\d{4}-\d{2}$/;
const mesDepois = c => { const a = Number(c.slice(0, 4)), m = Number(c.slice(5, 7)); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
// os meses do calendário de `de` a `ate` ('AAAA-MM'), os dois dentro (no máximo 60)
export function mesesDeAte(de, ate) {
  const out = [];
  if (!RE_COMP.test(String(de || '')) || !RE_COMP.test(String(ate || '')) || de > ate) return out;
  for (let c = de; c <= ate && out.length < 60; c = mesDepois(c)) out.push(c);
  return out;
}
// a janela da receita do estudo, pela série do sistema ([{ competencia, total }], os meses com receita): os 12 meses do
// calendário até o último com receita, a partir do primeiro com receita. Volta { de, ate, meses, porMes, receita, anual }
// (anual: a receita levada a 12 meses quando a janela tem menos, a empresa nova), ou null sem a série
export function janelaDaReceita(serie) {
  const ult = (serie || []).filter(m => m && RE_COMP.test(String(m.competencia)) && num(m.total) > 0).sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  if (!ult.length) return null;
  const ate = ult[ult.length - 1].competencia;
  let ini = ate;
  for (let i = 0; i < 11; i++) ini = mesAntes(ini);
  const dentro = ult.filter(m => m.competencia >= ini);
  const de = dentro[0].competencia;
  const meses = mesesDeAte(de, ate);
  const porMes = new Map(dentro.map(m => [m.competencia, num(m.total)]));
  const receita = [...porMes.values()].reduce((s, v) => s + v, 0);
  return { de, ate, meses, porMes, receita, anual: receita * 12 / meses.length };
}
// o período da DRE do estudo e o fator que leva o lucro dela aos 12 meses da receita.
// entrada: lucroDe e lucroAte ('AAAA-MM': o período que o número cobre — sem eles, a DRE é a dos meses da janela),
// lucroReceita (a receita desses meses quando o lucro foi informado: vale quando o período já saiu da janela de hoje) e
// lucroAnual (o número já é o dos 12 meses: o "e se" do assistente).
// Volta { de, ate, meses, receita, fator, completo, faltam, janela: { de, ate, meses }, guardada } — fator: a receita dos
// 12 meses ÷ a receita dos meses da DRE (1 quando ela cobre os 12 meses da janela); faltam: os meses da janela depois da
// DRE; guardada: a receita do período é a que o estudo guardou. Null sem como saber o período (sem a série e sem ele).
export function periodoDaDre(serie, entrada = {}) {
  const e = entrada || {};
  const j = janelaDaReceita(serie);
  const mes = c => (RE_COMP.test(String(c || '')) ? String(c) : null);
  let de = mes(e.lucroDe), ate = mes(e.lucroAte);
  const guardadaRec = num(e.lucroReceita) > 0 ? num(e.lucroReceita) : null;
  if (!j) {
    if (e.lucroAnual || !de || !ate || de > ate) return null;
    const doze = (e.atividades || []).reduce((s, a) => s + num(a && a.receita), 0);
    return { de, ate, meses: mesesDeAte(de, ate).length, receita: guardadaRec, fator: guardadaRec && doze > 0 ? doze / guardadaRec : 1, completo: null, faltam: [], janela: null, guardada: true };
  }
  const janela = { de: j.de, ate: j.ate, meses: j.meses.length };
  if (e.lucroAnual) return { de: j.de, ate: j.ate, meses: j.meses.length, receita: j.receita, fator: 1, completo: true, faltam: [], janela, guardada: false, anual: true };
  if (!ate || (de && de > ate)) { de = j.de; ate = j.ate; }
  if (!de) de = j.de;
  const lista = mesesDeAte(de, ate);
  const dentro = de >= j.de && ate <= j.ate;
  const receita = dentro ? lista.reduce((s, c) => s + (j.porMes.get(c) || 0), 0) : guardadaRec;
  return { de, ate, meses: lista.length, receita: receita > 0 ? receita : null,
    fator: receita > 0 ? j.anual / receita : 12 / Math.max(1, lista.length),
    completo: de <= j.de && ate >= j.ate, faltam: ate < j.ate ? mesesDeAte(mesDepois(ate), j.ate) : [], janela, guardada: !dentro };
}
// a DRE que o estudo pede: do primeiro mês da janela até onde a contabilidade está feita (o Controle das contabilidades),
// dentro da janela — sem o Controle (ou com a contabilidade fora do escritório), a janela inteira. Volta { de, ate, meses,
// total, faltam, antes } (antes: a contabilidade para antes da janela, nenhum mês da receita está feito), ou null sem a série
export function dreSugerida(serie, contabil = null) {
  const j = janelaDaReceita(serie);
  if (!j) return null;
  const semControle = !contabil || contabil.faz === false;
  const feitaAte = !semControle && RE_COMP.test(String(contabil.feitaAte || '')) ? contabil.feitaAte : null;
  if (!semControle && (!feitaAte || feitaAte < j.de)) return { de: j.de, ate: null, meses: 0, total: j.meses.length, faltam: j.meses.slice(), antes: true };
  const ate = semControle || feitaAte >= j.ate ? j.ate : feitaAte;
  return { de: j.de, ate, meses: mesesDeAte(j.de, ate).length, total: j.meses.length, faltam: ate < j.ate ? mesesDeAte(mesDepois(ate), j.ate) : [], antes: false };
}

// ---------- o resultado da contabilidade pela ponte do Domínio (11/11/2026, a versão 5 do pacote) ----------
// O pedido do Samuel das 20h11: "a ponte da Domínio deveria puxar essa informação até a data que supostamente a
// contabilidade está feita". A ponte traz, por empresa e mês, o resultado antes do IRPJ e da CSLL (resultado_antes_ir: o
// que foi lançado nas contas de resultado, fora o zeramento; negativo = prejuízo), o IRPJ e a CSLL lançados à parte
// (irpj_csll_lancados), as receitas financeiras (dentro do resultado) e quantos lançamentos em conta de resultado o mês
// tem (lanc_resultado: 0 = a contabilidade do mês não está no Domínio — o resultado fica null, NUNCA lucro zero).
export const CAMPOS_RESULTADO = ['resultado_antes_ir', 'irpj_csll_lancados', 'receitas_financeiras', 'lanc_resultado'];
// as linhas de dominio_mensal → Map(competência → { competencia, lancamentos, resultado, ircs, financeiras }), só os meses
// em que a ponte leu o bloco (lanc_resultado não nulo). Dois códigos do Domínio ligados à mesma empresa: fica o que tem
// mais lançamentos em conta de resultado no mês (o resultado tem sinal: não é "o maior de cada número")
export function resultadoDaPonte(linhas) {
  const por = new Map();
  const v = x => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
  (linhas || []).forEach(l => {
    if (!l || !RE_COMP.test(String(l.competencia))) return;
    const n = v(l.lanc_resultado);
    if (n == null || n < 0) return;
    const antes = por.get(l.competencia);
    if (antes && antes.lancamentos >= n) return;
    por.set(l.competencia, { competencia: l.competencia, lancamentos: n, resultado: v(l.resultado_antes_ir), ircs: v(l.irpj_csll_lancados), financeiras: v(l.receitas_financeiras) });
  });
  return por;
}
// o resultado como o estudo guarda (a lista dos meses, em ordem) e de volta ao mapa: aceita o mapa, a lista ou as linhas
export const listaDoResultado = linhas => [...resultadoDaPonte(linhas).values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
const mapaDoResultado = r => (r instanceof Map ? r : Array.isArray(r) && r.length && r[0] && 'lancamentos' in r[0] ? new Map(r.map(x => [x.competencia, x])) : resultadoDaPonte(r));
// O lucro da contabilidade pela ponte, do primeiro mês da receita até `ate` — sem `ate`, até onde o Controle das
// contabilidades dá a contabilidade como feita (dreSugerida): sem o Controle o sistema não sabe em que mês parar, e o mês
// ainda em aberto no Domínio daria um resultado pela metade.
// Volta null (sem a série, sem nenhum mês lido pela ponte, ou sem `ate` e sem o Controle dizer até onde: a empresa fora
// dele, a contabilidade de fora do escritório, nenhum mês da receita feito), { de, ate, meses, falta: 'nao_lido', quais }
// (a ponte não tem o resultado de algum mês do período), { de, ate, meses, falta: 'sem_lancamento', quais } (o mês tem
// receita e nenhum lançamento em conta de resultado no Domínio: a contabilidade dele não está lá) ou { de, ate, meses,
// lucro (negativo = prejuízo), receita (a dos mesmos meses, que leva o lucro aos 12), ircs, financeiras, lancamentos,
// atipicos }. atipicos: os meses em que o resultado passa da receita do mês e de metade da receita média do período
// ([{ competencia, resultado, receita }]) — o lançamento do ano inteiro de uma vez (o custo das mercadorias, a
// depreciação), que distorce a soma de um período que não é o ano fechado
export function lucroDaPonte(serie, contabil, resultado, ate = null) {
  const res = mapaDoResultado(resultado);
  if (!res.size) return null;
  const j = janelaDaReceita(serie);
  if (!j) return null;
  let fim = RE_COMP.test(String(ate || '')) && ate >= j.de && ate <= j.ate ? String(ate) : null;
  if (!fim) {
    if (ate || !contabil || contabil.faz === false) return null;
    const sug = dreSugerida(serie, contabil);
    if (!sug || sug.antes || !sug.ate) return null;
    fim = sug.ate;
  }
  const meses = mesesDeAte(j.de, fim);
  const base = { de: j.de, ate: fim, meses: meses.length };
  const temReceita = c => (j.porMes.get(c) || 0) > 0;
  // o mês com lançamento em conta de resultado e sem o número não foi lido inteiro; o sem lançamento e sem receita é zero
  const naoLido = meses.filter(c => !res.has(c) || (res.get(c).lancamentos > 0 && res.get(c).resultado == null));
  if (naoLido.length) return { ...base, falta: 'nao_lido', quais: naoLido };
  const semLanc = meses.filter(c => res.get(c).lancamentos === 0 && temReceita(c));
  if (semLanc.length) return { ...base, falta: 'sem_lancamento', quais: semLanc };
  const soma = k => Math.round(meses.reduce((t, c) => t + num(res.get(c)[k]), 0) * 100) / 100;
  const receita = meses.reduce((t, c) => t + (j.porMes.get(c) || 0), 0);
  const media = receita / meses.length;
  const atipicos = meses.map(c => ({ competencia: c, resultado: num(res.get(c).resultado), receita: j.porMes.get(c) || 0 }))
    .filter(x => Math.abs(x.resultado) > x.receita && Math.abs(x.resultado) > 0.5 * media && media > 0);
  return { ...base, lucro: soma('resultado'), receita: receita > 0 ? receita : null, ircs: soma('ircs'), financeiras: soma('financeiras'),
    lancamentos: meses.reduce((t, c) => t + res.get(c).lancamentos, 0), atipicos };
}
// a origem do lucro que veio da ponte (o período vai junto, pra tela e pro assistente dizerem de quando é)
export const origemDoLucroDaPonte = lp => ({ ...origem('ponte', 'Domínio, pela ponte: o resultado da contabilidade de ' + rotuloComp(lp.de) + ' a ' + rotuloComp(lp.ate),
  'a soma do resultado de cada mês no Domínio: o que foi lançado nas contas de resultado, antes do IRPJ e da CSLL e sem o zeramento do exercício' + (lp.lancamentos ? ' (' + lp.lancamentos.toLocaleString('pt-BR') + ' lançamentos)' : '')), de: lp.de, ate: lp.ate });
// põe o lucro da ponte no estudo: o número, o período da DRE (lucroDe a lucroAte), a receita desses meses (é ela que
// leva o lucro aos 12 meses: periodoDaDre) e a origem. Volta true se pôs (o lucro da ponte tem de ter o número)
export function aplicarLucroDaPonte(entrada, origens, lp) {
  if (!entrada || !origens || !lp || lp.lucro == null || !Number.isFinite(Number(lp.lucro))) return false;
  entrada.lucroContabil = Number(lp.lucro); entrada.lucroDe = lp.de; entrada.lucroAte = lp.ate; entrada.lucroReceita = lp.receita > 0 ? lp.receita : null;
  delete entrada.lucroAnual;
  origens.lucroContabil = origemDoLucroDaPonte(lp);
  return true;
}
