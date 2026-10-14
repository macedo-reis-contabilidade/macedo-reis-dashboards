// ============================================================
// MACEDO & REIS — Reforma Tributária · Opção IBS/CBS 2027
// Motor de simulação dos dois regimes (por dentro × por fora)
// Módulo ES puro, sem DOM. Usado por fiscal-reforma.html e
// testado por tests/rt-motor.test.mjs (caso Drogaria Guerra e os
// exercícios do módulo Simuladores do curso — tolerância R$ 0,05
// por linha; o teste manda no motor).
// ============================================================

// LC 123/2006, art. 18 — Anexos I a V: faixas de RBT12,
// alíquota nominal e parcela a deduzir.
// Empate técnico: abaixo de max(0,3% da receita do semestre, R$ 1.000) a vantagem de apurar por fora não é recomendada
// (decisão do Samuel, 23/09/2026, piso baixado de R$ 3.000 pra R$ 1.000 em 27/09 — o de 3 mil punha empresa pequena em "empate" com 5% da receita de diferença; Drogaria Guerra, 0,46%, segue OPTE).
export const LIMIAR_EMPATE_PCT = 0.3;
export const LIMIAR_EMPATE_MIN = 1000;
// Margem da decisão (12/10/2026, módulo Simuladores do curso): quanto o crédito aproveitado pela carteira PJ pode mudar
// antes de a conclusão inverter, em % do custo a mais por fora; abaixo de 15%, "decisão apertada".
export const MARGEM_APERTADA_PCT = 15;
// ISS efetivo máximo dentro do DAS em 2027–2028: 5% da receita (Res. CGSN 140/2018, art. 21, III, red. Res. CGSN 190/2026).
export const ISS_TETO = 0.05;

// Partilha do DAS em 2027–2028, % do DAS por faixa (1ª a 6ª): Res. CGSN 140/2018, Anexos I a V, na redação da
// Res. CGSN 190/2026 (pp. 31–43), conferidos célula a célula em 02/10/2026 — a mesma tabela de
// rt_parametros.partilha_cbs_ibs.
//   CBS+IBS: aqui só converte a partilha quando o anexo muda em 2027 (indústria, Anexo II → I).
//   ICMS/ISS: a fatia que sai da base do débito por fora (LC 214, art. 12, §2º, V). Na 6ª faixa (acima do sublimite de
//   R$ 3,6 milhões) ICMS e ISS não estão no DAS — são pagos pelas regras normais.
export const PARTILHA_CBS_IBS_2027 = {
  'I':   [15.5,  15.5,  15.5,  15.5,  15.5,  34.02],
  'II':  [14,    14,    14,    14,    14,    25.22],
  'III': [15.6,  17.1,  16.6,  16.6,  15.6,  19.29],
  'IV':  [21.5,  25,    24,    23,    22,    24.7],
  'V':   [17.15, 17.15, 18.15, 19.15, 17.15, 19.78]
};
export const FATIA_ICMS_ISS_2027 = {
  'I':   [34,   34,   33.5, 33.5, 33.5, 0],   // ICMS
  'II':  [32,   32,   32,   32,   32,   0],   // ICMS (e IPI 7,50)
  'III': [33.5, 32,   32.5, 32.5, 33.5, 0],   // ISS
  'IV':  [44.5, 40,   40,   40,   40,   0],   // ISS
  'V':   [14,   17,   19,   21,   23.5, 0]    // ISS
};
const ANEXOS_ISS = ['III', 'IV', 'V'];

export const TAB_SIMPLES = {
  'I':   { lim: [180000, 360000, 720000, 1800000, 3600000, 4800000], aliq: [0.04,  0.073, 0.095, 0.107, 0.143, 0.19],  pd: [0, 5940, 13860, 22500, 87300, 378000] },
  'II':  { lim: [180000, 360000, 720000, 1800000, 3600000, 4800000], aliq: [0.045, 0.078, 0.10,  0.112, 0.147, 0.30],  pd: [0, 5940, 13860, 22500, 85500, 720000] },
  'III': { lim: [180000, 360000, 720000, 1800000, 3600000, 4800000], aliq: [0.06,  0.112, 0.135, 0.16,  0.21,  0.33],  pd: [0, 9360, 17640, 35640, 125640, 648000] },
  'IV':  { lim: [180000, 360000, 720000, 1800000, 3600000, 4800000], aliq: [0.045, 0.09,  0.102, 0.14,  0.22,  0.33],  pd: [0, 8100, 12420, 39780, 183780, 828000] },
  'V':   { lim: [180000, 360000, 720000, 1800000, 3600000, 4800000], aliq: [0.155, 0.18,  0.195, 0.205, 0.23,  0.305], pd: [0, 4500, 9900, 17100, 62100, 540000] }
};

// Alíquota efetiva do Simples: (RBT12 × nominal − dedução) ÷ RBT12 (art. 18, §1º-A).
// Devolve fração (ex.: 0.0945) ou null se anexo/RBT12 inválidos.
export function aliqEfetiva(anexo, rbt12) {
  const t = TAB_SIMPLES[anexo];
  if (!t || !(rbt12 > 0)) return null;
  const f = t.lim.findIndex(L => rbt12 <= L);
  if (f === -1) return null;
  return (rbt12 * t.aliq[f] - t.pd[f]) / rbt12;
}

// Faixa do RBT12 (0 = 1ª … 5 = 6ª); -1 acima de R$ 4.800.000. Os limites são os mesmos nos cinco anexos.
export function faixaDe(rbt12) {
  return rbt12 > 0 ? TAB_SIMPLES['I'].lim.findIndex(L => rbt12 <= L) : -1;
}

// INDÚSTRIA EM 2027 (12/10/2026): a atividade industrial passa a ser tributada no Anexo I (LC 123, art. 18, §5º, na
// redação do art. 517 da LC 214, efeitos a partir de 01/01/2027); só a venda de produto industrializado sujeito ao IPI
// mantido (ADCT, art. 126, III, "a" — industrialização incentivada na Zona Franca de Manaus) segue no Anexo II.
// Recebe o anexo do PGDAS (2026) e devolve o de 2027.
export function anexo2027(anexo, ipiMantido) {
  const a = String(anexo || '').trim().toUpperCase();
  return a === 'II' && !ipiMantido ? 'I' : a;
}

const num = (v, def) => {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// simular(input) → resultado do semestre jan–jun/2027 nos dois regimes.
// Percentuais entram como a equipe digita (20 = 20%). Campos:
//   anexo 'I'..'V' (o do PGDAS: alíquota informada, % excluído e partilha são medidos nele) · rbt12 · receita (mensal)
//   ipiMantido (opcional): produto com IPI mantido (Zona Franca de Manaus) — a indústria segue no Anexo II em 2027;
//     sem ele, o Anexo II do PGDAS vira Anexo I em 2027 (anexo2027) e a alíquota, o % excluído de ICMS e a partilha
//     são convertidos pras tabelas do Anexo I
//   mixCheia / mixRed60 / mixRed40 / mixRed30 / mixZero  (% da receita — somam 100)
//     mixRed40: bares e restaurantes, alimentação preparada no local (LC 214 art. 275) — só vale por fora
//   pctComprasComCredito (opcional, % 0–100): quanto das compras de mercadorias credita à alíquota cheia,
//     medido pelo NCM das entradas (cesta básica = zero). Se ausente, as compras seguem o mix das vendas.
//   pctComprasMercadorias  (% da receita: compras que seguem o mix de vendas)
//   pctComprasDespesas     (% da receita: despesas com crédito; default 0)
//   pctDespesasComCredito (opcional, % 0–100, default 100): o crédito das despesas em % do cheio — o crédito é o
//     IBS/CBS que o fornecedor destaca; serviço com redução de 30% (contabilidade, advocacia, engenharia — LC 214,
//     art. 127) credita 70%. Até 12/10/2026 toda despesa creditava cheio.
//   pctImpostoEmbutido (default 0) · pctExcluidoST (default 0): % do DAS excluído HOJE (ICMS-ST, ISS retido,
//     PIS/COFINS monofásico — tudo junto, como sai do PGDAS)
//   pctReceitaMonofasica (default 0): % da receita que hoje é monofásica de PIS/COFINS (medicamentos, perfumaria,
//     autopeças, bebidas frias…). Em 2027 essa exclusão acaba — a CBS alcança essa receita dentro do DAS (Res. CGSN
//     140/2018, art. 25, §6º, na redação da Res. CGSN 190/2026: a segregação passa a ser só da tributação concentrada
//     de IBS/CBS, ou seja, combustíveis). A exclusão do ICMS-ST e do ISS retido continua.
//   partilha (% do DAS que é CBS/IBS) · cbs · ibs (as de 2027, %: CBS = referência − 0,1 p.p., ADCT art. 127 p.ú.)
//   pctPJ (default 0) · creditoEstoqueMes (R$, entra do 2º mês — 5 parcelas)
//   aliqEfetivaInformada (%, opcional): alíquota real do PGDAS (DAS apurado ÷ receita, já sem o % excluído);
//     quando vem, vale sobre a tabela anexo+RBT12 e o pctExcluidoST serve só pra reconstituir o DAS cheio
//   excluirIcmsIssDaBase (default true): o ICMS/ISS do DAS sai da base do débito por fora (LC 214, art. 12, §2º, V —
//     o método do curso; para o optante, sem norma específica que confirme). false = base cheia, só pra sensibilidade.
//   issFixo (opcional): ISS em valor fixo por profissional (LC 123, art. 18, §22-A) — não há ISS do DAS a excluir
//   precoFinalMantido (opcional, só pra sensibilidade): o preço final — com o imposto — fica igual ao de hoje, na
//     venda e na compra; o IBS/CBS sai de dentro do preço: cada faixa do mix divide pela própria alíquota
//     (1 + alíquota × fator da faixa), e o % de compras medido e as despesas, que não dizem a faixa, pela cheia. O
//     padrão segue o método do curso (Dominando Simples): imposto calculado sobre a receita de hoje.
export function simular(input) {
  const anexo = String(input.anexo || '').trim().toUpperCase();
  const rbt12 = num(input.rbt12, 0);
  const receita = num(input.receita, 0);
  if (!TAB_SIMPLES[anexo]) throw new Error('Anexo inválido: informe I a V.');
  if (!(rbt12 > 0)) throw new Error('RBT12 não informado — vem da apuração do Simples (PGDAS); importe o relatório do Domínio ou digite.');
  if (rbt12 > 4800000) throw new Error('RBT12 de ' + rbt12.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' passa do limite do Simples (R$ 4.800.000) — confira o valor.');
  if (!(receita > 0)) throw new Error('Informe a receita mensal.');

  const mixCheia = num(input.mixCheia, 0), mixRed60 = num(input.mixRed60, 0), mixRed40 = num(input.mixRed40, 0),
        mixRed30 = num(input.mixRed30, 0), mixZero = num(input.mixZero, 0);
  const somaMix = mixCheia + mixRed60 + mixRed40 + mixRed30 + mixZero;
  if (Math.abs(somaMix - 100) > 0.5) throw new Error('O mix de receita precisa somar 100% (soma atual: ' + somaMix.toFixed(1) + '%).');

  const pctMerc = num(input.pctComprasMercadorias, 0);
  const pctDesp = num(input.pctComprasDespesas, 0);
  const pctEmb = num(input.pctImpostoEmbutido, 0);
  const pctST = num(input.pctExcluidoST, 0);
  const partilha = num(input.partilha, NaN);
  if (!Number.isFinite(partilha) || partilha < 0 || partilha > 100) throw new Error('Informe a partilha CBS/IBS (%) — leia no PGDAS enquanto a tabela oficial não é carregada.');
  const cbs = num(input.cbs, 0), ibs = num(input.ibs, 0);
  if (!(cbs + ibs > 0)) throw new Error('Informe as alíquotas de referência (CBS/IBS).');
  const pctPJ = num(input.pctPJ, 0);
  const estoqueMes = num(input.creditoEstoqueMes, 0);
  const pctMono = num(input.pctReceitaMonofasica, 0);
  const pctDespCred = input.pctDespesasComCredito == null || input.pctDespesasComCredito === '' ? 100 : num(input.pctDespesasComCredito, NaN);
  for (const [rotulo, v] of [['% compras de mercadorias', pctMerc], ['% compras de despesas', pctDesp], ['% imposto embutido nas compras', pctEmb], ['% do DAS excluído por ST/ISS', pctST], ['% clientes PJ', pctPJ], ['% da receita monofásica de PIS/COFINS', pctMono], ['% de crédito das despesas', pctDespCred]]) {
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error(rotulo + ' precisa estar entre 0 e 100 (informado: ' + v + ').');
  }
  if (estoqueMes < 0) throw new Error('O crédito de estoque mensal não pode ser negativo.');

  const avisos = [];
  const p2 = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  // alíquota efetiva: a informada (do PGDAS: DAS ÷ receita tributada, já misturando os anexos que houver)
  // vale sobre a da tabela; a tabela é a reserva quando não há PGDAS
  const aeInf = input.aliqEfetivaInformada == null || input.aliqEfetivaInformada === '' ? null : num(input.aliqEfetivaInformada, NaN);
  if (aeInf != null && (!Number.isFinite(aeInf) || aeInf <= 0 || aeInf > 35)) throw new Error('Alíquota efetiva informada precisa estar entre 0 e 35% (informado: ' + input.aliqEfetivaInformada + ').');
  const aeTabela = aliqEfetiva(anexo, rbt12);
  const ae = aeInf != null ? aeInf / 100 : aeTabela;
  const aliqFonte = aeInf != null ? 'informada' : 'tabela';
  // a informada já vem sem a parte excluída (ST, monofásico, ICMS…): a comparação com a tabela é pela alíquota cheia
  const aeInfCheia = aeInf != null && pctST < 100 ? aeInf / 100 / (1 - pctST / 100) : null;
  if (aeInfCheia != null && aeTabela != null && Math.abs(aeInfCheia - aeTabela) > 0.02) avisos.push('Alíquota efetiva informada (' + aeInf.toFixed(2) + '%' + (pctST > 0 ? ', ' + (aeInfCheia * 100).toFixed(2) + '% sem a exclusão de ' + pctST.toLocaleString('pt-BR') + '%' : '') + ') está mais de 2 pontos longe da tabela do Anexo ' + anexo + ' (' + (aeTabela * 100).toFixed(2) + '%) — normal se há receita em mais de um anexo; se não, confira o PGDAS.');
  const aliqRef = (cbs + ibs) / 100;
  const fatorMix = (mixCheia + 0.40 * mixRed60 + 0.60 * mixRed40 + 0.70 * mixRed30 + 0 * mixZero) / 100;
  // PREÇO FINAL MANTIDO (só sensibilidade): o imposto sai de dentro do preço. Cada faixa divide pela própria alíquota —
  // a venda a −60% por (1 + 3,72%), não por (1 + 9,30%) —, porque o IBS/CBS não integra a própria base (LC 214, art.
  // 12, §2º, I). Até 12/10/2026 tudo dividia pela cheia, e o débito dos itens com redução saía menor que o certo (5,1% a
  // menos no −60%, 2,6% no −30%). O % das compras medido pelo NCM e o crédito das despesas não dizem a faixa de cada
  // compra: esses seguem divididos pela alíquota cheia.
  const precoMantido = !!input.precoFinalMantido;
  const dentroDoPreco = f => precoMantido ? f / (1 + aliqRef * f) : f;
  const fatorMixPreco = (mixCheia * dentroDoPreco(1) + mixRed60 * dentroDoPreco(0.40) + mixRed40 * dentroDoPreco(0.60) + mixRed30 * dentroDoPreco(0.70)) / 100;
  const fatorCheioPreco = dentroDoPreco(1);
  // crédito das compras: pelo NCM das entradas quando medido; senão, o mix das vendas (revenda)
  const pctCred = input.pctComprasComCredito == null || input.pctComprasComCredito === '' ? null : num(input.pctComprasComCredito, NaN);
  if (pctCred != null && (!Number.isFinite(pctCred) || pctCred < 0 || pctCred > 100)) throw new Error('% das compras com crédito precisa estar entre 0 e 100.');
  const fatorCompras = pctCred != null ? pctCred / 100 : fatorMix;
  const fatorDespesas = pctDespCred / 100;

  // --- mês (os 6 meses são iguais; só o crédito de estoque varia) ---
  // Exclusão de ST/monofásico/ICMS aplicada UMA vez. Pela tabela, o DAS de hoje sai do DAS cheio menos a exclusão.
  // Pela alíquota informada (PGDAS: DAS apurado ÷ receita), a exclusão JÁ está dentro dela — ela é o DAS de hoje, e o
  // DAS cheio (base da partilha) é reconstituído. Até 02/10/2026 a exclusão era descontada de novo sobre a informada:
  // num ateliê de calçados com 32% excluído, o DAS de hoje saía 4,45% da receita contra os 6,54% pagos de verdade.
  const dasHoje = aeInf != null ? receita * ae : receita * ae * (1 - pctST / 100);
  const dasCheioMedido = aeInf != null ? (pctST < 100 ? dasHoje / (1 - pctST / 100) : receita * (aeTabela ?? ae)) : receita * ae;
  // MONOFÁSICO (03/10/2026): o % excluído de hoje mistura ICMS-ST e ISS retido — que seguem fora do DAS em 2027 — com
  // PIS/COFINS monofásico, que acaba. A fatia de PIS/COFINS de 2026 é a mesma de CBS+IBS de 2027 (a partilha), então a
  // parte monofásica excluída hoje = % da receita monofásica × partilha, sobre o DAS cheio. Sem isso, numa farmácia o
  // DAS por dentro de 2027 saía igual ao de hoje, sem a CBS que passa a incidir sobre os medicamentos.
  const exclMonoInformada = (pctMono / 100) * (partilha / 100);
  const exclMono = Math.min(exclMonoInformada, pctST / 100);
  if (exclMonoInformada - exclMono > 0.0005) {
    avisos.push('Receita monofásica de ' + p2(pctMono) + '% com partilha de ' + p2(partilha) + '% dá ' + p2(exclMonoInformada * 100) + '% do DAS de PIS/COFINS excluído hoje — mais que o % excluído informado (' + p2(pctST) + '%). Considerado só o excluído; confira os dois campos.');
  }
  // o que continua fora do DAS em 2027 (ICMS-ST, ICMS diferido, ISS retido), em fração do DAS cheio
  const stMedido = Math.max(0, pctST / 100 - exclMono);

  // --- 2027: o anexo pode mudar (indústria: II → I) ---
  const ipiMantido = !!input.ipiMantido;
  const anexoNovo = anexo2027(anexo, ipiMantido);
  const mudouAnexo = anexoNovo !== anexo;
  const fx = faixaDe(rbt12);
  let dasCheio, das2027, partilha2027 = partilha, st2027 = stMedido, aeTab2027 = aeTabela;
  if (!mudouAnexo) {
    dasCheio = dasCheioMedido;
    das2027 = dasHoje + dasCheio * exclMono;     // DAS por dentro em 2027 (sem a exclusão do monofásico)
  } else {
    // INDÚSTRIA NO ANEXO I (12/10/2026): a alíquota do PGDAS (Anexo II) vira a do Anexo I na mesma proporção da
    // tabela — o que a apuração tem de diferente da tabela (outro anexo na receita, proporcionalização) é preservado;
    // a parte do ICMS que hoje não entra no DAS (diferimento, ST) segue fora, agora sobre a fatia de ICMS do Anexo I;
    // a partilha CBS/IBS vai pra do Anexo I (15,50% nas faixas 1 a 5, contra 14,00% do II)
    aeTab2027 = aliqEfetiva(anexoNovo, rbt12);
    const desvio = aeTabela > 0 ? dasCheioMedido / (receita * aeTabela) : 1;
    dasCheio = receita * aeTab2027 * desvio;
    partilha2027 = partilha * PARTILHA_CBS_IBS_2027[anexoNovo][fx] / PARTILHA_CBS_IBS_2027[anexo][fx];
    const fatAntes = FATIA_ICMS_ISS_2027[anexo][fx] / 100, fatDepois = FATIA_ICMS_ISS_2027[anexoNovo][fx] / 100;
    st2027 = (fatAntes > 0 ? Math.min(1, stMedido / fatAntes) : 0) * fatDepois;
    das2027 = dasCheio * (1 - st2027);
    avisos.push('Indústria: em 2027 o Anexo ' + anexo + ' do PGDAS vira Anexo ' + anexoNovo + ' (LC 123, art. 18, §5º, na redação da LC 214) — DAS e partilha calculados no Anexo ' + anexoNovo + ' (alíquota ' + p2(dasCheio / receita * 100) + '%, partilha CBS/IBS ' + p2(partilha2027) + '%). Se o produto tem IPI mantido (Zona Franca de Manaus), marque "IPI mantido" e o Anexo II continua.');
  }
  // A parcela CBS/IBS incide sobre o DAS cheio: a exclusão de ST/ISS retido
  // tira ICMS/ISS do DAS, não os novos tributos (validado pelo caso-teste).
  let parcelaCbsIbs = dasCheio * (partilha2027 / 100);
  if (parcelaCbsIbs > das2027) {
    parcelaCbsIbs = das2027;
    avisos.push('Partilha CBS/IBS maior que o DAS de 2027 depois da exclusão de ST — parcela limitada a esse DAS.');
  }
  const dasSobra = das2027 - parcelaCbsIbs;

  // ICMS/ISS FORA DA BASE DO DÉBITO POR FORA (12/10/2026): de 2026 a 2032 o ICMS e o ISS não integram a base do IBS/CBS
  // (LC 214, art. 12, §2º, V). No optante, o que sai é o ICMS/ISS do DAS — alíquota efetiva × fatia do tributo na faixa —,
  // como fazem todas as ferramentas e exercícios do curso (módulo Simuladores: advocacia, consultoria e indústria batem
  // ao centavo assim). ICMS: só o que está no DAS (com ST ou diferimento não há ICMS próprio na operação). ISS: retido
  // ou não, até o teto de 5% da receita; com ISS fixo por profissional, nada. A exclusão vai proporcional às vendas
  // (o motor não sabe quais grupos do mix carregam o ICMS próprio). Antes, o débito por fora saía sobre a receita cheia.
  const fat2027 = fx >= 0 ? FATIA_ICMS_ISS_2027[anexoNovo][fx] / 100 : 0;
  const ehIss = ANEXOS_ISS.includes(anexoNovo);
  const issFixo = !!input.issFixo;
  const icmsIssMes = ehIss ? (issFixo ? 0 : Math.min(dasCheio * fat2027, receita * ISS_TETO)) : dasCheio * Math.max(0, fat2027 - st2027);
  const excluirIcmsIss = input.excluirIcmsIssDaBase !== false;
  const exclusaoBase = excluirIcmsIss ? icmsIssMes : 0;
  if (excluirIcmsIss && fx === 5) avisos.push('Acima do sublimite (R$ 3,6 milhões) o ICMS/ISS sai do DAS e é pago pelas regras normais: a exclusão dele da base do débito por fora (LC 214, art. 12, §2º, V) não entrou na conta — o débito por fora real sai menor que o mostrado.');
  const baseDebito = receita - exclusaoBase;
  const debitoFora = baseDebito * aliqRef * fatorMixPreco;
  // Crédito que o cliente PJ pode tomar por fora: a alimentação preparada em bar/restaurante (redução de 40%, LC 214
  // art. 275) não gera crédito ao adquirente (art. 276); bebida em lata ou garrafa e bebida alcoólica, à alíquota cheia
  // (CST 000, fora do regime específico), geram. Até 03/10/2026 o crédito do cliente contava o débito inteiro.
  const debitoCreditavel = baseDebito * aliqRef * (fatorMixPreco - mixRed40 / 100 * dentroDoPreco(0.60));
  const comprasMerc = receita * pctMerc / 100;
  const comprasDesp = receita * pctDesp / 100;
  const baseMerc = comprasMerc * (1 - pctEmb / 100);
  const baseDesp = comprasDesp * (1 - pctEmb / 100);
  // Mercadorias revendidas carregam o mesmo mix das vendas (o fornecedor destaca a alíquota do produto); despesas
  // creditam o que o fornecedor destaca — cheia, ou menos quando o serviço tem redução (pctDespesasComCredito).
  const creditoEntradas = baseMerc * aliqRef * (pctCred != null ? fatorCompras * fatorCheioPreco : fatorMixPreco)
    + baseDesp * aliqRef * fatorDespesas * fatorCheioPreco;

  const meses = [];
  for (let m = 1; m <= 6; m++) {
    const estoque = m >= 2 ? estoqueMes : 0;
    const aRecolher = Math.max(0, debitoFora - creditoEntradas - estoque);
    meses.push({
      n: m,
      estoque,
      aRecolher,
      caixaDentro: das2027,
      caixaFora: dasSobra + aRecolher,
      custoDentro: das2027 + creditoEntradas,
      custoFora: dasSobra + debitoFora - estoque
    });
  }

  const soma = k => meses.reduce((a, x) => a + x[k], 0);
  const fatores = { mix: fatorMix, compras: fatorCompras, comprasMedido: pctCred != null, despesas: fatorDespesas, aliqFonte, aliqTabela: aeTabela,
    monofasico: { pctReceita: pctMono, exclusao: exclMono }, precoFinalMantido: !!input.precoFinalMantido,
    anexo, anexo2027: anexoNovo, mudouAnexo, ipiMantido, aliqEfetiva2027: dasCheio / receita, aliqTabela2027: aeTab2027, partilha2027,
    icmsIss: { tributo: ehIss ? 'ISS' : 'ICMS', fatia: fat2027, mes: icmsIssMes, pctReceita: icmsIssMes / receita, excluido: exclusaoBase, aplicada: excluirIcmsIss, issFixo } };
  const semestre = {
    custoDentro: soma('custoDentro'),
    custoFora: soma('custoFora'),
    caixaDentro: soma('caixaDentro'),
    caixaFora: soma('caixaFora'),
    creditoClienteDentro: 6 * parcelaCbsIbs,
    creditoClienteFora: 6 * debitoCreditavel,
    aproveitadoDentro: 6 * parcelaCbsIbs * pctPJ / 100,
    aproveitadoFora: 6 * debitoCreditavel * pctPJ / 100
  };
  semestre.diferenca = semestre.custoFora - semestre.custoDentro;

  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  // EMPATE TÉCNICO (23/09/2026): vantagem de "por fora" menor que o limiar não justifica a mudança —
  // fica dentro da incerteza das premissas (crédito cheio sobre todas as entradas, fornecedores do regime
  // regular, crédito condicionado ao pagamento do fornecedor) e do custo de apurar IBS/CBS fora do DAS.
  // Só vale se o ganho de crédito da carteira PJ também for pequeno (senão o motivo é o cliente, não o custo).
  const limiarEmpate = Math.max(LIMIAR_EMPATE_PCT / 100 * receita * 6, LIMIAR_EMPATE_MIN);
  const economiaFora = -semestre.diferenca;
  const ganhoAproveitado = semestre.aproveitadoFora - semestre.aproveitadoDentro;
  const empate = Math.abs(semestre.diferenca) < limiarEmpate && ganhoAproveitado < limiarEmpate;
  // CARTEIRA DE VIRADA E MARGEM DA DECISÃO (12/10/2026, método do curso): com o custo maior por fora, a % de clientes PJ
  // que aproveitam o crédito a partir da qual o crédito a mais deles cobre o custo a mais; a margem diz quanto o crédito
  // aproveitado pode mudar antes de a conclusão inverter (|aproveitado a mais − custo a mais| ÷ custo a mais)
  const ganhoCarteira = semestre.creditoClienteFora - semestre.creditoClienteDentro;
  // arredondada a 6 casas: sem compras, custo a mais e crédito a mais saem iguais por construção e a virada é 100% exato
  const pe = semestre.diferenca > 0 && ganhoCarteira > 0 ? Math.round(semestre.diferenca / (ganhoCarteira / 100) * 1e6) / 1e6 : null;
  const margem = semestre.diferenca > 0 && !empate ? Math.abs(ganhoAproveitado - semestre.diferenca) / semestre.diferenca * 100 : null;
  const apertada = margem != null && margem < MARGEM_APERTADA_PCT;
  const txtMargem = margem != null ? 'margem da decisão: ' + pct(margem) + '%' + (apertada ? ', decisão apertada' : '') : '';
  // bar e restaurante: o adquirente não credita a alimentação preparada (LC 214 art. 276); a parte à alíquota cheia
  // (bebida em lata ou garrafa, alcoólica) credita — o ponto de equilíbrio já sai só dela
  const notaBar = mixRed40 > 0 ? ' Só conta a parte vendida à alíquota cheia (bebida em lata ou garrafa, bebida alcoólica): a alimentação preparada no bar ou restaurante não gera crédito ao adquirente (LC 214, art. 276).' : '';
  // CARTEIRA QUE PERDE CRÉDITO (13/10/2026): por dentro o cliente PJ credita o IBS/CBS que está no DAS; por fora, a venda
  // com alíquota zero (hortifrúti, cesta básica) não dá crédito nenhum a quem compra, e a alimentação preparada no bar ou
  // restaurante também não (art. 276) — o crédito da carteira pode CAIR com a mudança. Até 13/10/2026 a frase dizia só
  // "não ganha crédito" e escondia a perda; as de empate diziam "ganharia só R$ 0,00". Só texto: nenhuma conta muda.
  const motivosPerda = [];
  if (mixZero > 0) motivosPerda.push('venda com alíquota zero não dá crédito a quem compra');
  if (mixRed40 > 0) motivosPerda.push('a alimentação preparada no bar ou restaurante não gera crédito ao adquirente (LC 214, art. 276)');
  const txtMotivoPerda = motivosPerda.length ? ' — ' + motivosPerda.join(', e ') + '.' : '.';
  // "os clientes aproveitariam R$ X por fora, contra R$ Y por dentro" — cada frase passa a medida que já usava: a carteira
  // inteira (crédito que o cliente leva) ou só os % de PJ informados (crédito aproveitado)
  const txtPerdaCarteira = (fora, dentro) => 'os clientes aproveitariam ' + brl(fora) + ' por fora, contra ' + brl(dentro) + ' por dentro' + txtMotivoPerda;
  const base = { limiarEmpate, ganhoAproveitado, carteiraVirada: pe, margem, apertada };
  let veredito;
  if (economiaFora > 0 && empate) {
    const pct2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    veredito = {
      ...base, tipo: 'MANTENHA', empate: true,
      pontoEquilibrioPJ: null,
      frase: 'Empate técnico: pelo regime regular o custo do primeiro semestre de 2027 seria ' + brl(economiaFora) +
        ' menor (' + pct2(economiaFora / (receita * 6) * 100) + '% da receita), abaixo do limiar de ' + brl(limiarEmpate) +
        ' que justifica a mudança. Essa margem é menor que a incerteza das premissas — crédito cheio sobre todas as entradas, ' +
        'fornecedores do regime regular — e que o custo de apurar IBS/CBS fora do DAS; ' +
        (ganhoAproveitado < -0.005
          ? 'e a carteira PJ perderia ' + brl(-ganhoAproveitado) + ' de crédito aproveitado: ' + txtPerdaCarteira(semestre.aproveitadoFora, semestre.aproveitadoDentro)
          : 'e a carteira PJ ganharia só ' + brl(Math.max(0, ganhoAproveitado)) + ' de crédito aproveitado.') +
        ' Mantém-se a apuração dentro do Simples.'
    };
  } else if (semestre.custoFora < semestre.custoDentro) {
    veredito = {
      ...base, tipo: 'OPTE', empate: false,
      pontoEquilibrioPJ: null,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoFora) +
        ' pelo regime regular contra ' + brl(semestre.custoDentro) + ' dentro do Simples — economia estimada de ' +
        brl(-semestre.diferenca) + ' no semestre' + (ganhoCarteira > 0.005
          ? ', além de os clientes PJ passarem a aproveitar ' + brl(semestre.creditoClienteFora) + ' de crédito (contra ' + brl(semestre.creditoClienteDentro) + ' por dentro).'
          : ganhoCarteira < -0.005 && pctPJ > 0   // sem clientes PJ não há carteira que perca (13/10/2026)
          ? '. Mas a carteira PJ perde crédito: ' + txtPerdaCarteira(semestre.creditoClienteFora, semestre.creditoClienteDentro)
          : '. A carteira PJ não ganha crédito com a mudança' + (mixRed40 > 0 ? ': a alimentação preparada no bar ou restaurante não gera crédito ao adquirente (LC 214, art. 276).' : '.'))
    };
  } else if (!empate && ganhoAproveitado - semestre.diferenca > 0.005) {   // meio centavo: sem compras e com 100% de PJ os dois são iguais por construção
    // OPTE, SE O COMERCIAL CONFIRMAR (12/10/2026, terceiro resultado do curso): o custo próprio sobe por fora, mas o
    // crédito a mais que a carteira PJ aproveita supera a alta — a vantagem está no cliente, não no caixa da empresa;
    // só se realiza se esse crédito virar preço, prazo ou fidelização. Antes era um "MANTENHA" com a frase da carteira.
    veredito = {
      ...base, tipo: 'OPTE_SE', empate: false,
      pontoEquilibrioPJ: pe,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoFora) +
        ' pelo regime regular contra ' + brl(semestre.custoDentro) + ' dentro do Simples — ' + brl(semestre.diferenca) +
        ' a mais por fora. Mas a carteira PJ aproveitaria ' + brl(ganhoAproveitado) + ' a mais de crédito (com os ' + pct(pctPJ) +
        '% de clientes PJ informados), mais que essa alta: a opção compensa se esse crédito virar preço, prazo ou fidelização com os clientes — o comercial confirma. ' +
        (pe != null ? 'Abaixo de ' + pct(pe) + '% de clientes PJ que aproveitam o crédito a conclusão inverte (' + txtMargem + ').' : '') + notaBar
    };
  } else {
    let complemento = '';
    if (pe != null && Math.abs(pe - pctPJ) < 0.05) {
      // empate exato no conjunto (ex.: serviço sem compras, toda a receita de clientes PJ): o crédito a mais dos clientes é
      // o próprio custo a mais da empresa — ninguém ganha com a mudança
      complemento = ' O crédito a mais que a carteira PJ aproveitaria (' + brl(ganhoAproveitado) + ') é o mesmo que a empresa pagaria a mais: no conjunto, empresa e clientes ficam iguais — a mudança não traz ganho.' + notaBar;
    } else if (pe != null && pe <= 100 && empate && ganhoAproveitado > semestre.diferenca) {
      complemento = ' A carteira PJ aproveitaria ' + brl(ganhoAproveitado) + ' a mais de crédito, mais que a diferença, mas os dois valores ficam abaixo do limiar de ' + brl(limiarEmpate) + ' que justifica a mudança.' + notaBar;
    } else if (pe != null && pe < 100) {
      complemento = ' A carteira PJ levaria ' + brl(ganhoCarteira) + ' a mais de crédito por fora; a opção passaria a compensar se ao menos ' +
        pct(pe) + '% da receita viesse de clientes PJ que aproveitam o crédito (informado hoje: ' + pct(pctPJ) + '%' + (txtMargem ? '; ' + txtMargem : '') + ').' + notaBar;
    } else if (pe != null && pe === 100) {
      // serviço sem compras: o crédito a mais da carteira inteira é exatamente o custo a mais — no máximo empata
      complemento = ' A carteira PJ levaria ' + brl(ganhoCarteira) + ' a mais de crédito por fora — o mesmo que a empresa pagaria a mais: nem com toda a receita vinda de clientes PJ que aproveitam o crédito a opção compensaria, no máximo empataria (informado hoje: ' + pct(pctPJ) + '%' + (txtMargem ? '; ' + txtMargem : '') + ').' + notaBar;
    } else if (ganhoCarteira < -0.005 && pctPJ > 0) {
      // a carteira também perde crédito (venda com alíquota zero, bar e restaurante): não há % de clientes PJ que inverta —
      // e sem clientes PJ não há carteira que perca (a frase não aparece)
      complemento = ' E a carteira PJ ainda perderia crédito: ' + txtPerdaCarteira(semestre.creditoClienteFora, semestre.creditoClienteDentro)
        + ' Nem com toda a receita vindo de clientes PJ a mudança compensaria: a decisão é de custo próprio.';
    } else if (mixRed40 > 0) {
      complemento = ' O adquirente não credita a alimentação preparada no bar ou restaurante (LC 214, art. 276); só a parte vendida à alíquota cheia (bebida em lata ou garrafa, bebida alcoólica) gera crédito ao cliente PJ — e nem com toda a receita vindo de clientes PJ isso inverteria o resultado: a decisão é de custo próprio.';
    }
    veredito = {
      ...base, tipo: 'MANTENHA', empate,
      pontoEquilibrioPJ: pe != null && pe <= 100 ? pe : null,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoDentro) +
        ' dentro do Simples contra ' + brl(semestre.custoFora) + ' pelo regime regular — a permanência é ' +
        brl(semestre.diferenca) + ' mais econômica no semestre.' + complemento
    };
  }

  return {
    aliqEfetiva: ae,
    aliqRef,
    fatorMix,
    fatores,
    mes: { dasCheio, dasCheioMedido, dasHoje, das2027, exclMono, parcelaCbsIbs, dasSobra, icmsIssMes, exclusaoBase, baseDebito, debitoFora, debitoCreditavel, comprasMerc, comprasDesp, creditoEntradas, aRecolherSemEstoque: Math.max(0, debitoFora - creditoEntradas) },
    meses,
    semestre,
    veredito,
    avisos
  };
}
