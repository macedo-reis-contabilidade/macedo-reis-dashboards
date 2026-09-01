// ============================================================
// MACEDO & REIS — Reforma Tributária · Opção IBS/CBS 2027
// Motor de simulação dos dois regimes (por dentro × por fora)
// Módulo ES puro, sem DOM. Usado por fiscal-reforma.html e
// testado por tests/rt-motor.test.mjs (caso Drogaria Guerra —
// tolerância R$ 0,05 por linha; o teste manda no motor).
// ============================================================

// LC 123/2006, art. 18 — Anexos I a V: faixas de RBT12,
// alíquota nominal e parcela a deduzir.
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
//   mixCheia / mixRed60 / mixRed30 / mixZero  (% da receita — somam 100)
//   pctComprasMercadorias  (% da receita: compras que seguem o mix de vendas)
//   pctComprasDespesas     (% da receita: compras creditadas à alíquota cheia; default 0)
//   pctImpostoEmbutido (default 0) · pctExcluidoST (default 0)
//   partilha (% do DAS que é CBS/IBS) · cbs · ibs (referência, %)
//   pctPJ (default 0) · creditoEstoqueMes (R$, entra do 2º mês — 5 parcelas)
export function simular(input) {
  const anexo = String(input.anexo || '').trim().toUpperCase();
  const rbt12 = num(input.rbt12, 0);
  const receita = num(input.receita, 0);
  if (!TAB_SIMPLES[anexo]) throw new Error('Anexo inválido: informe I a V.');
  if (!(rbt12 > 0) || rbt12 > 4800000) throw new Error('RBT12 fora das faixas do Simples (até 4.800.000).');
  if (!(receita > 0)) throw new Error('Informe a receita mensal.');

  const mixCheia = num(input.mixCheia, 0), mixRed60 = num(input.mixRed60, 0),
        mixRed30 = num(input.mixRed30, 0), mixZero = num(input.mixZero, 0);
  const somaMix = mixCheia + mixRed60 + mixRed30 + mixZero;
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

  const avisos = [];
  const ae = aliqEfetiva(anexo, rbt12);
  const aliqRef = (cbs + ibs) / 100;
  const fatorMix = (mixCheia + 0.40 * mixRed60 + 0.70 * mixRed30 + 0 * mixZero) / 100;

  // --- mês (os 6 meses são iguais; só o crédito de estoque varia) ---
  const dasCheio = receita * ae;
  const dasHoje = dasCheio * (1 - pctST / 100);
  // A parcela CBS/IBS incide sobre o DAS cheio: a exclusão de ST/ISS retido
  // tira ICMS/ISS do DAS, não os novos tributos (validado pelo caso-teste).
  let parcelaCbsIbs = dasCheio * (partilha / 100);
  if (parcelaCbsIbs > dasHoje) {
    parcelaCbsIbs = dasHoje;
    avisos.push('Partilha CBS/IBS maior que o DAS após exclusão de ST — parcela limitada ao DAS pago hoje.');
  }
  const dasSobra = dasHoje - parcelaCbsIbs;
  const debitoFora = receita * aliqRef * fatorMix;
  const comprasMerc = receita * pctMerc / 100;
  const comprasDesp = receita * pctDesp / 100;
  const baseMerc = comprasMerc * (1 - pctEmb / 100);
  const baseDesp = comprasDesp * (1 - pctEmb / 100);
  // Mercadorias revendidas carregam o mesmo mix das vendas (o fornecedor
  // destaca a alíquota do produto); despesas creditam à alíquota cheia.
  const creditoEntradas = baseMerc * aliqRef * fatorMix + baseDesp * aliqRef;

  const meses = [];
  for (let m = 1; m <= 6; m++) {
    const estoque = m >= 2 ? estoqueMes : 0;
    const aRecolher = Math.max(0, debitoFora - creditoEntradas - estoque);
    meses.push({
      n: m,
      estoque,
      aRecolher,
      caixaDentro: dasHoje,
      caixaFora: dasSobra + aRecolher,
      custoDentro: dasHoje + creditoEntradas,
      custoFora: dasSobra + debitoFora - estoque
    });
  }

  const soma = k => meses.reduce((a, x) => a + x[k], 0);
  const semestre = {
    custoDentro: soma('custoDentro'),
    custoFora: soma('custoFora'),
    caixaDentro: soma('caixaDentro'),
    caixaFora: soma('caixaFora'),
    creditoClienteDentro: 6 * parcelaCbsIbs,
    creditoClienteFora: 6 * debitoFora,
    aproveitadoDentro: 6 * parcelaCbsIbs * pctPJ / 100,
    aproveitadoFora: 6 * debitoFora * pctPJ / 100
  };
  semestre.diferenca = semestre.custoFora - semestre.custoDentro;

  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let veredito;
  if (semestre.custoFora < semestre.custoDentro) {
    veredito = {
      tipo: 'OPTE',
      pontoEquilibrioPJ: null,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoFora) +
        ' pelo regime regular contra ' + brl(semestre.custoDentro) + ' dentro do Simples — economia estimada de ' +
        brl(-semestre.diferenca) + ' no semestre, além de os clientes PJ passarem a aproveitar ' +
        brl(semestre.creditoClienteFora) + ' de crédito (contra ' + brl(semestre.creditoClienteDentro) + ' por dentro).'
    };
  } else {
    const ganhoCarteiraPorPct = (semestre.creditoClienteFora - semestre.creditoClienteDentro) / 100;
    let pe = null;
    if (ganhoCarteiraPorPct > 0) pe = semestre.diferenca / ganhoCarteiraPorPct;
    veredito = {
      tipo: 'MANTENHA',
      pontoEquilibrioPJ: pe != null && pe <= 100 ? pe : null,
      frase: 'A simulação do primeiro semestre de 2027 indica custo tributário de ' + brl(semestre.custoDentro) +
        ' dentro do Simples contra ' + brl(semestre.custoFora) + ' pelo regime regular — a permanência é ' +
        brl(semestre.diferenca) + ' mais econômica no semestre.' +
        (pe != null && pe <= 100
          ? ' A carteira PJ levaria ' + brl(semestre.creditoClienteFora - semestre.creditoClienteDentro) +
            ' a mais de crédito por fora; a opção passaria a compensar se ao menos ' + pe.toFixed(0) +
            '% da receita viesse de clientes PJ que aproveitam o crédito.'
          : '')
    };
  }

  return {
    aliqEfetiva: ae,
    aliqRef,
    fatorMix,
    mes: { dasCheio, dasHoje, parcelaCbsIbs, dasSobra, debitoFora, comprasMerc, comprasDesp, creditoEntradas, aRecolherSemEstoque: Math.max(0, debitoFora - creditoEntradas) },
    meses,
    semestre,
    veredito,
    avisos
  };
}
