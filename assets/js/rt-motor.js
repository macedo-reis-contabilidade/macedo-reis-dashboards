// ============================================================
// MACEDO & REIS — Reforma Tributária · Opção IBS/CBS 2027
// Motor de simulação dos dois regimes (por dentro × por fora)
// Módulo ES puro, sem DOM. Usado por fiscal-reforma.html e
// testado por tests/rt-motor.test.mjs (caso Drogaria Guerra —
// tolerância R$ 0,05 por linha; o teste manda no motor).
// ============================================================

// LC 123/2006, art. 18 — Anexos I a V: faixas de RBT12,
// alíquota nominal e parcela a deduzir.
// Empate técnico: abaixo de max(0,3% da receita do semestre, R$ 1.000) a vantagem de apurar por fora não é recomendada
// (decisão do Samuel, 23/09/2026, piso baixado de R$ 3.000 pra R$ 1.000 em 27/09 — o de 3 mil punha empresa pequena em "empate" com 5% da receita de diferença; Drogaria Guerra, 0,46%, segue OPTE).
export const LIMIAR_EMPATE_PCT = 0.3;
export const LIMIAR_EMPATE_MIN = 1000;

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

const num = (v, def) => {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// simular(input) → resultado do semestre jan–jun/2027 nos dois regimes.
// Percentuais entram como a equipe digita (20 = 20%). Campos:
//   anexo 'I'..'V' · rbt12 · receita (mensal)
//   mixCheia / mixRed60 / mixRed40 / mixRed30 / mixZero  (% da receita — somam 100)
//     mixRed40: bares e restaurantes, alimentação preparada no local (LC 214 art. 275) — só vale por fora
//   pctComprasComCredito (opcional, % 0–100): quanto das compras de mercadorias credita à alíquota cheia,
//     medido pelo NCM das entradas (cesta básica = zero). Se ausente, as compras seguem o mix das vendas.
//   pctComprasMercadorias  (% da receita: compras que seguem o mix de vendas)
//   pctComprasDespesas     (% da receita: compras creditadas à alíquota cheia; default 0)
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
//   precoFinalMantido (opcional, só pra sensibilidade): o preço final — com o imposto — fica igual ao de hoje, na
//     venda e na compra; o IBS/CBS sai de dentro do preço, e débito e créditos dividem por (1 + alíquota). O padrão
//     segue o método do curso (Dominando Simples): imposto calculado sobre a receita de hoje.
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
  for (const [rotulo, v] of [['% compras de mercadorias', pctMerc], ['% compras de despesas', pctDesp], ['% imposto embutido nas compras', pctEmb], ['% do DAS excluído por ST/ISS', pctST], ['% clientes PJ', pctPJ], ['% da receita monofásica de PIS/COFINS', pctMono]]) {
    if (v < 0 || v > 100) throw new Error(rotulo + ' precisa estar entre 0 e 100 (informado: ' + v + ').');
  }
  if (estoqueMes < 0) throw new Error('O crédito de estoque mensal não pode ser negativo.');

  const avisos = [];
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
  // preço final mantido (só sensibilidade): o imposto sai de dentro do preço — débito e créditos ÷ (1 + alíquota)
  const fatorPreco = input.precoFinalMantido ? 1 / (1 + aliqRef) : 1;
  // crédito das compras: pelo NCM das entradas quando medido; senão, o mix das vendas (revenda)
  const pctCred = input.pctComprasComCredito == null || input.pctComprasComCredito === '' ? null : num(input.pctComprasComCredito, NaN);
  if (pctCred != null && (!Number.isFinite(pctCred) || pctCred < 0 || pctCred > 100)) throw new Error('% das compras com crédito precisa estar entre 0 e 100.');
  const fatorCompras = pctCred != null ? pctCred / 100 : fatorMix;

  // --- mês (os 6 meses são iguais; só o crédito de estoque varia) ---
  // Exclusão de ST/monofásico/ICMS aplicada UMA vez. Pela tabela, o DAS de hoje sai do DAS cheio menos a exclusão.
  // Pela alíquota informada (PGDAS: DAS apurado ÷ receita), a exclusão JÁ está dentro dela — ela é o DAS de hoje, e o
  // DAS cheio (base da partilha) é reconstituído. Até 02/10/2026 a exclusão era descontada de novo sobre a informada:
  // num ateliê de calçados com 32% excluído, o DAS de hoje saía 4,45% da receita contra os 6,54% pagos de verdade.
  const dasHoje = aeInf != null ? receita * ae : receita * ae * (1 - pctST / 100);
  const dasCheio = aeInf != null ? (pctST < 100 ? dasHoje / (1 - pctST / 100) : receita * (aeTabela ?? ae)) : receita * ae;
  // MONOFÁSICO (03/10/2026): o % excluído de hoje mistura ICMS-ST e ISS retido — que seguem fora do DAS em 2027 — com
  // PIS/COFINS monofásico, que acaba. A fatia de PIS/COFINS de 2026 é a mesma de CBS+IBS de 2027 (a partilha), então a
  // parte monofásica excluída hoje = % da receita monofásica × partilha, sobre o DAS cheio. Sem isso, numa farmácia o
  // DAS por dentro de 2027 saía igual ao de hoje, sem a CBS que passa a incidir sobre os medicamentos.
  const exclMonoInformada = (pctMono / 100) * (partilha / 100);
  const exclMono = Math.min(exclMonoInformada, pctST / 100);
  if (exclMonoInformada - exclMono > 0.0005) {
    const p2 = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    avisos.push('Receita monofásica de ' + p2(pctMono) + '% com partilha de ' + p2(partilha) + '% dá ' + p2(exclMonoInformada * 100) + '% do DAS de PIS/COFINS excluído hoje — mais que o % excluído informado (' + p2(pctST) + '%). Considerado só o excluído; confira os dois campos.');
  }
  const das2027 = dasHoje + dasCheio * exclMono;     // DAS por dentro em 2027 (sem a exclusão do monofásico)
  // A parcela CBS/IBS incide sobre o DAS cheio: a exclusão de ST/ISS retido
  // tira ICMS/ISS do DAS, não os novos tributos (validado pelo caso-teste).
  let parcelaCbsIbs = dasCheio * (partilha / 100);
  if (parcelaCbsIbs > das2027) {
    parcelaCbsIbs = das2027;
    avisos.push('Partilha CBS/IBS maior que o DAS de 2027 depois da exclusão de ST — parcela limitada a esse DAS.');
  }
  const dasSobra = das2027 - parcelaCbsIbs;
  const debitoFora = receita * aliqRef * fatorMix * fatorPreco;
  // Crédito que o cliente PJ pode tomar por fora: a alimentação preparada em bar/restaurante (redução de 40%, LC 214
  // art. 275) não gera crédito ao adquirente (art. 276); bebida em lata ou garrafa e bebida alcoólica, à alíquota cheia
  // (CST 000, fora do regime específico), geram. Até 03/10/2026 o crédito do cliente contava o débito inteiro.
  const debitoCreditavel = receita * aliqRef * (fatorMix - 0.60 * mixRed40 / 100) * fatorPreco;
  const comprasMerc = receita * pctMerc / 100;
  const comprasDesp = receita * pctDesp / 100;
  const baseMerc = comprasMerc * (1 - pctEmb / 100);
  const baseDesp = comprasDesp * (1 - pctEmb / 100);
  // Mercadorias revendidas carregam o mesmo mix das vendas (o fornecedor
  // destaca a alíquota do produto); despesas creditam à alíquota cheia.
  const creditoEntradas = (baseMerc * aliqRef * fatorCompras + baseDesp * aliqRef) * fatorPreco;

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
  const fatores = { mix: fatorMix, compras: fatorCompras, comprasMedido: pctCred != null, aliqFonte, aliqTabela: aeTabela,
    monofasico: { pctReceita: pctMono, exclusao: exclMono }, precoFinalMantido: !!input.precoFinalMantido };
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
  // EMPATE TÉCNICO (23/09/2026): vantagem de "por fora" menor que o limiar não justifica a mudança —
  // fica dentro da incerteza das premissas (crédito cheio sobre todas as entradas, fornecedores do regime
  // regular, crédito condicionado ao pagamento do fornecedor) e do custo de apurar IBS/CBS fora do DAS.
  // Só vale se o ganho de crédito da carteira PJ também for pequeno (senão o motivo é o cliente, não o custo).
  const limiarEmpate = Math.max(LIMIAR_EMPATE_PCT / 100 * receita * 6, LIMIAR_EMPATE_MIN);
  const economiaFora = -semestre.diferenca;
  const ganhoAproveitado = semestre.aproveitadoFora - semestre.aproveitadoDentro;
  const empate = Math.abs(semestre.diferenca) < limiarEmpate && ganhoAproveitado < limiarEmpate;
  let veredito;
  if (economiaFora > 0 && empate) {
    const pct2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    veredito = {
      tipo: 'MANTENHA', empate: true, limiarEmpate,
      pontoEquilibrioPJ: null,
      frase: 'Empate técnico: pelo regime regular o custo do primeiro semestre de 2027 seria ' + brl(economiaFora) +
        ' menor (' + pct2(economiaFora / (receita * 6) * 100) + '% da receita), abaixo do limiar de ' + brl(limiarEmpate) +
        ' que justifica a mudança. Essa margem é menor que a incerteza das premissas — crédito cheio sobre todas as entradas, ' +
        'fornecedores do regime regular — e que o custo de apurar IBS/CBS fora do DAS; e a carteira PJ ganharia só ' + brl(Math.max(0, ganhoAproveitado)) +
        ' de crédito aproveitado. Mantém-se a apuração dentro do Simples.'
    };
  } else if (semestre.custoFora < semestre.custoDentro) {
    veredito = {
      tipo: 'OPTE', empate: false, limiarEmpate,
      pontoEquilibrioPJ: null,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoFora) +
        ' pelo regime regular contra ' + brl(semestre.custoDentro) + ' dentro do Simples — economia estimada de ' +
        brl(-semestre.diferenca) + ' no semestre' + (semestre.creditoClienteFora > semestre.creditoClienteDentro
          ? ', além de os clientes PJ passarem a aproveitar ' + brl(semestre.creditoClienteFora) + ' de crédito (contra ' + brl(semestre.creditoClienteDentro) + ' por dentro).'
          : '. A carteira PJ não ganha crédito com a mudança' + (mixRed40 > 0 ? ': a alimentação preparada no bar ou restaurante não gera crédito ao adquirente (LC 214, art. 276).' : '.'))
    };
  } else {
    const ganhoCarteira = semestre.creditoClienteFora - semestre.creditoClienteDentro;
    let pe = null;
    if (ganhoCarteira > 0) pe = semestre.diferenca / (ganhoCarteira / 100);
    const pct = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    let complemento = '';
    // bar e restaurante: o adquirente não credita a alimentação preparada (LC 214 art. 276); a parte à alíquota cheia
    // (bebida em lata ou garrafa, alcoólica) credita — o ponto de equilíbrio já sai só dela
    const notaBar = mixRed40 > 0 ? ' Só conta a parte vendida à alíquota cheia (bebida em lata ou garrafa, bebida alcoólica): a alimentação preparada no bar ou restaurante não gera crédito ao adquirente (LC 214, art. 276).' : '';
    if (pe != null && pe <= 100) {
      complemento = (pe > pctPJ
        ? ' A carteira PJ levaria ' + brl(ganhoCarteira) + ' a mais de crédito por fora; a opção passaria a compensar se ao menos ' +
          pct(pe) + '% da receita viesse de clientes PJ que aproveitam o crédito (informado hoje: ' + pct(pctPJ) + '%).'
        : ' A carteira PJ levaria ' + brl(ganhoCarteira) + ' a mais de crédito por fora — com os ' + pct(pctPJ) +
          '% de clientes PJ informados, esse ganho já supera a diferença de custo; pesar o custo próprio contra o ganho dos clientes antes de decidir.') + notaBar;
    } else if (mixRed40 > 0) {
      complemento = ' O adquirente não credita a alimentação preparada no bar ou restaurante (LC 214, art. 276); só a parte vendida à alíquota cheia (bebida em lata ou garrafa, bebida alcoólica) gera crédito ao cliente PJ — e nem com toda a receita vindo de clientes PJ isso inverteria o resultado: a decisão é de custo próprio.';
    }
    veredito = {
      tipo: 'MANTENHA', empate, limiarEmpate,
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
    mes: { dasCheio, dasHoje, das2027, exclMono, parcelaCbsIbs, dasSobra, debitoFora, debitoCreditavel, comprasMerc, comprasDesp, creditoEntradas, aRecolherSemEstoque: Math.max(0, debitoFora - creditoEntradas) },
    meses,
    semestre,
    veredito,
    avisos
  };
}
