// A conta do INSS da empresa embaixo dos campos da folha do Comparativo tributário (27/11/2026). A dúvida da Thalia, no
// estudo de uma pizzaria: "não está considerando na folha os 20% do patronal? puxou só 8,8, mas o correto é 28,8%". A
// conta sempre teve os 20% (a CPP, Lei 8.212, art. 22, I e III): os campos da tela são só o RAT, o FAP, os terceiros e a
// CPRB, e quem somava os campos chegava a 8,8%. A linha diz a conta inteira, com os números que o motor usa: o RAT de 0 a
// 3%, o FAP de 0,5 a 2, os terceiros de 0 a 10% e a transição da desoneração (normalizar e inssRegular, em
// comparativo-motor.js; tests/comparativo-folha.test.mjs confere uma contra a outra).
// (O RAT das guias do Domínio já vem com o FAP e, acima de 3%, o motor o corta em 3: na carteira de 27/11/2026, nenhuma
// empresa do Presumido ou do Real passa de 3%.)
// Só a página importa este arquivo, o assistente do escritório não: mudou, não há commit a fixar.
import { CPP, CPP_PRO_LABORE, CPRB_TRANSICAO, ANOS, TIPOS, ANEXOS } from './comparativo-motor.js';

const num = (v, def) => {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const pct = (v, d = 2) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const lista = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);

// a parte da CPP e a da CPRB no ano: a mesma regra do inssRegular
const transicao = (cprb, ano) => (cprb ? CPRB_TRANSICAO[ano] || (ano < 2025 ? { cpp: 0, cprb: 1 } : { cpp: 1, cprb: 0 }) : { cpp: 1, cprb: 0 });

// os números da conta, em pontos percentuais: por ano do estudo, a parte fixa, o total sobre a folha, o do pró-labore e
// a CPRB sobre a receita (na transição, o 13º fica fora da parte fixa e só na CPRB)
export function contaDoInss(entrada) {
  const e = entrada || {};
  const rat = entre(num(e.rat, 2), 0, 3), fap = entre(num(e.fap, 1), 0.5, 2), terceiros = entre(num(e.terceiros, 5.8), 0, 10);
  const cprb = num(e.cprb, 0) > 0 ? entre(num(e.cprb, 0), 0, 10) : null;
  const anoBase = ANOS.includes(num(e.anoBase, 2026)) ? num(e.anoBase, 2026) : 2026;
  const anos = ANOS.filter(a => a >= anoBase).map(ano => {
    const t = transicao(cprb, ano);
    const fixo = CPP * t.cpp * 100;
    return { ano, fixo, folha: fixo + rat * fap + terceiros, proLabore: CPP_PRO_LABORE * (cprb ? t.cpp : 1) * 100, cprb: cprb ? cprb * t.cprb : 0 };
  });
  return { rat, fap, terceiros, cprb, ratComFap: rat * fap, anos };
}

// tem atividade do Anexo IV no Simples (a CPP fora do DAS): o anexo e o fator r como o normalizar lê
function temAnexoIV(e) {
  return ((e && e.atividades) || []).some(a => {
    if (!a || !(num(a.receita, 0) > 0)) return false;
    const t = TIPOS[a.tipo] || TIPOS.comercio;
    const anexo = ANEXOS.includes(String(a.anexo || '').toUpperCase()) ? String(a.anexo).toUpperCase() : t.anexo;
    const fatorR = a.fatorR != null ? !!a.fatorR : t.fatorR;
    return anexo === 'IV' && !fatorR;
  });
}

// "20% fixo + RAT 2% + terceiros 5,8%" (o FAP só quando não é 1)
const parcelas = (fixo, c) => pct(fixo) + '% fixo + RAT ' + pct(c.rat) + '%' + (c.fap !== 1 ? ' × FAP ' + pct(c.fap, 4) : '') + ' + terceiros ' + pct(c.terceiros) + '%';

// O texto da linha, em partes: 'texto' ou { b: 'negrito' } (a tela escapa). comSimples: o Simples faz parte do estudo
// (simplesNoEstudo) — sem ele, nada do Simples no texto
export function textoDoInss(entrada, { comSimples = false } = {}) {
  const c = contaDoInss(entrada);
  const [a0, ...resto] = c.anos;
  const partes = [];
  if (!c.cprb) {
    partes.push('No Presumido e no Real, o INSS da empresa é ', { b: parcelas(a0.fixo, c) + ' = ' + pct(a0.folha) + '% da folha' },
      ', e ' + pct(a0.proLabore) + '% do pró-labore. Os 20% não têm campo: entram sempre (Lei 8.212, art. 22, I e III).');
  } else {
    const comCprb = c.anos.filter(x => x.cprb > 0), semCprb = c.anos.find(x => !(x.cprb > 0));
    partes.push('No Presumido e no Real, com a desoneração da folha (a CPRB de ' + pct(c.cprb) + '% da receita, Lei 14.973/2024), o INSS da empresa é ',
      { b: parcelas(a0.fixo, c) + ' = ' + pct(a0.folha) + '% da folha em ' + a0.ano },
      (resto.length ? ', ' + lista(resto.map(x => pct(x.folha) + '% em ' + x.ano + ' (' + pct(x.fixo) + '% fixo)')) : '') +
      '; no pró-labore, ' + lista(c.anos.map(x => pct(x.proLabore) + '%')) + '. ' +
      (comCprb.length ? 'A CPRB é de ' + lista(comCprb.map((x, i) => pct(x.cprb) + (i ? '% em ' : '% da receita em ') + x.ano)) + (semCprb ? ', e acaba em ' + semCprb.ano : '') + '; o 13º fica só nela.' : 'A CPRB já acabou.') +
      ' A parte fixa não tem campo: entra sempre (Lei 8.212, art. 22, I e III).');
  }
  if (comSimples) partes.push(' No Simples, o INSS da empresa está no DAS' + (temAnexoIV(entrada) ? '; no Anexo IV, os 20% e o RAT vão por fora do DAS, sem os terceiros' : '') + '.');
  return partes.filter(p => p !== '');
}

// o texto corrido (pros testes e pra quem não precisa do negrito)
export const textoCorrido = partes => partes.map(p => (typeof p === 'string' ? p : p.b)).join('');
