// Teste da conta do INSS da empresa que o Comparativo tributário mostra embaixo dos campos da folha
// (assets/js/comparativo-folha.js). Rodar com: node tests/comparativo-folha.test.mjs
// O que a linha diz tem de ser o que o motor calcula: cada caso confere o texto e, depois, os mesmos números contra o
// calcularAno de comparativo-motor.js (o Presumido e o Real).

import { contaDoInss, textoDoInss, textoCorrido } from '../assets/js/comparativo-folha.js';
import { calcularAno, PARTE_DO_13 } from '../assets/js/comparativo-motor.js';

let falhas = 0, total = 0;
function verdade(nome, cond, extra) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome + (!cond && extra != null ? '\n        ' + extra : ''));
}
const perto = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;
const txt = (e, o) => textoCorrido(textoDoInss(e, o));
// os mesmos termos que o teste de tela procura (tests/harness/comparativo.py, DO_SIMPLES)
const falaDoSimples = t => /simples|fator r\b|sublimite/i.test(t) || /\bDAS\b|PGDAS|Anexo (I|II|III|IV|V)\b|[Aa]nexo do\b/.test(t);

console.log('=== o padrão: 20% fixo + RAT 2% + terceiros 5,8% ===');
{
  const t = txt({});
  verdade('a conta inteira, com os 20%', t.startsWith('No Presumido e no Real, o INSS da empresa é 20% fixo + RAT 2% + terceiros 5,8% = 27,8% da folha, e 20% do pró-labore.'), t);
  verdade('os 20% não têm campo e entram sempre, com a lei', t.includes('Os 20% não têm campo: entram sempre (Lei 8.212, art. 22, I e III).'), t);
  verdade('o FAP de 1 não aparece', !t.includes('FAP'), t);
  verdade('sem o Simples no estudo, nada do Simples', !falaDoSimples(t), t);
  const b = textoDoInss({}).find(p => typeof p !== 'string');
  verdade('o negrito é a conta', b && b.b === '20% fixo + RAT 2% + terceiros 5,8% = 27,8% da folha', JSON.stringify(b));
}

console.log('=== o caso da Thalia: o RAT de 3% dá 28,8% ===');
{
  const t = txt({ rat: 3, fap: 1, terceiros: 5.8 });
  verdade('20% fixo + RAT 3% + terceiros 5,8% = 28,8% da folha', t.includes('20% fixo + RAT 3% + terceiros 5,8% = 28,8% da folha'), t);
  // o campo da tela grava o número como digitado (3) ou como texto vindo do estudo ('3')
  verdade('o RAT gravado como texto também', txt({ rat: '3' }).includes('= 28,8% da folha'));
}

console.log('=== o FAP multiplica o RAT ===');
{
  const t = txt({ rat: 3, fap: 1.5 });
  verdade('RAT 3% × FAP 1,5 = 30,3% da folha', t.includes('20% fixo + RAT 3% × FAP 1,5 + terceiros 5,8% = 30,3% da folha'), t);
  const t2 = txt({ rat: 3, fap: 1.0832 });
  verdade('o FAP com 4 casas (como sai publicado)', t2.includes('RAT 3% × FAP 1,0832') && t2.includes('= 29,05% da folha'), t2);
}

console.log('=== os limites são os do motor ===');
{
  const c = contaDoInss({ rat: 5, fap: 3, terceiros: 12 });
  verdade('o RAT vai até 3, o FAP até 2 e os terceiros até 10', c.rat === 3 && c.fap === 2 && c.terceiros === 10, JSON.stringify(c));
  const v = contaDoInss({ rat: '', fap: '', terceiros: '' });
  verdade('em branco, os padrões (2, 1 e 5,8)', v.rat === 2 && v.fap === 1 && v.terceiros === 5.8, JSON.stringify(v));
  const z = contaDoInss({ rat: 0, fap: 0, terceiros: 0 });
  verdade('o FAP zerado vira 0,5, como no motor', z.rat === 0 && z.fap === 0.5 && z.terceiros === 0 && z.anos[0].folha === 20, JSON.stringify(z));
}

console.log('=== com o Simples no estudo ===');
{
  const t = txt({ atividades: [{ tipo: 'comercio', receita: 1000000 }] }, { comSimples: true });
  verdade('no Simples, o INSS da empresa está no DAS', t.endsWith(' No Simples, o INSS da empresa está no DAS.'), t);
  const iv = txt({ atividades: [{ tipo: 'servico_iv', receita: 500000 }] }, { comSimples: true });
  verdade('o Anexo IV: os 20% e o RAT por fora do DAS, sem os terceiros', iv.endsWith('No Simples, o INSS da empresa está no DAS; no Anexo IV, os 20% e o RAT vão por fora do DAS, sem os terceiros.'), iv);
  const ivSem = txt({ atividades: [{ tipo: 'servico_iv', receita: 0 }] }, { comSimples: true });
  verdade('a atividade do Anexo IV sem receita não conta', !ivSem.includes('Anexo IV'), ivSem);
  const ivFr = txt({ atividades: [{ tipo: 'servico_r', anexo: 'IV', fatorR: true, receita: 500000 }] }, { comSimples: true });
  verdade('o anexo IV pelo fator r não conta (o fator r escolhe o III ou o V)', !ivFr.includes('Anexo IV'), ivFr);
  const ivMao = txt({ atividades: [{ tipo: 'servico', anexo: 'iv', receita: 500000 }] }, { comSimples: true });
  verdade('o Anexo IV escolhido na atividade conta', ivMao.includes('no Anexo IV, os 20% e o RAT'), ivMao);
  verdade('sem o Simples no estudo, o Anexo IV também fica fora', !falaDoSimples(txt({ atividades: [{ tipo: 'servico_iv', receita: 500000 }] })));
}

console.log('=== a desoneração da folha (CPRB) ===');
{
  const t = txt({ cprb: 4.5 });
  verdade('a parte fixa de cada ano', t.includes('com a desoneração da folha (a CPRB de 4,5% da receita, Lei 14.973/2024), o INSS da empresa é 10% fixo + RAT 2% + terceiros 5,8% = 17,8% da folha em 2026, 22,8% em 2027 (15% fixo) e 27,8% em 2028 (20% fixo)'), t);
  verdade('o pró-labore acompanha', t.includes('; no pró-labore, 10%, 15% e 20%.'), t);
  verdade('a CPRB que fica e o 13º só nela', t.includes('A CPRB é de 2,7% da receita em 2026 e 1,8% em 2027, e acaba em 2028; o 13º fica só nela.'), t);
  verdade('a parte fixa não tem campo', t.includes('A parte fixa não tem campo: entra sempre (Lei 8.212, art. 22, I e III).'), t);
  verdade('sem o Simples no estudo, nada do Simples', !falaDoSimples(t), t);
  const b = txt({ cprb: 4.5, anoBase: 2027 });
  verdade('o estudo de 2027 em diante começa em 2027', b.includes('15% fixo + RAT 2% + terceiros 5,8% = 22,8% da folha em 2027, 27,8% em 2028 (20% fixo)') && b.includes('A CPRB é de 1,8% da receita em 2027, e acaba em 2028; o 13º fica só nela.'), b);
  verdade('a CPRB zerada não é desoneração', !txt({ cprb: 0 }).includes('CPRB'));
}

console.log('=== a linha diz o que o motor calcula ===');
{
  // sem a CPRB: (CPP + RAT + terceiros) ÷ folha e o pró-labore ÷ pró-labore, no Presumido e no Real, em todos os anos
  const casos = [
    { rat: 2, fap: 1, terceiros: 5.8 }, { rat: 3, fap: 1, terceiros: 5.8 }, { rat: 1, fap: 0.5, terceiros: 4.5 }, { rat: 3, fap: 2, terceiros: 5.8 },
    { rat: 3, fap: 1.0832, terceiros: 3.3 }, { rat: 5, fap: 3, terceiros: 12 }, { rat: 0, fap: 0, terceiros: 0 }, {}
  ];
  for (const k of casos) {
    const E = { atividades: [{ tipo: 'comercio', receita: 2000000 }], folha: 300000, proLabore: 60000, compras: 500000, ...k };
    const c = contaDoInss(E);
    for (const x of c.anos) {
      const r = calcularAno(E, x.ano);
      for (const g of ['presumido', 'real']) {
        const i = r[g].inss;
        verdade(g + ' ' + x.ano + ' ' + JSON.stringify(k) + ': ' + x.folha.toFixed(4) + '% da folha',
          perto((i.cpp + i.rat + i.terceiros) / E.folha * 100, x.folha) && perto(i.proLabore / E.proLabore * 100, x.proLabore) && i.cprb === 0,
          JSON.stringify(i));
      }
    }
  }
  // com a CPRB: a parte fixa é sobre a folha sem o 13º (estimado como o motor), a CPRB sobre a receita
  for (const k of [{ cprb: 4.5 }, { cprb: 1.5, rat: 3, fap: 1.2 }, { cprb: 2, anoBase: 2027 }]) {
    const E = { atividades: [{ tipo: 'industria', receita: 5000000 }], folha: 800000, proLabore: 120000, ...k };
    const c = contaDoInss(E);
    for (const x of c.anos) {
      const i = calcularAno(E, x.ano).presumido.inss;
      const decimo = x.fixo < 20 ? E.folha * PARTE_DO_13 : 0;
      verdade('CPRB ' + x.ano + ' ' + JSON.stringify(k) + ': ' + x.fixo + '% fixo, ' + x.proLabore + '% do pró-labore, ' + x.cprb.toFixed(2) + '% da receita',
        perto(i.cpp / (E.folha - decimo) * 100, x.fixo) && perto((i.rat + i.terceiros) / E.folha * 100, x.folha - x.fixo)
          && perto(i.proLabore / E.proLabore * 100, x.proLabore) && perto(i.cprb / 5000000 * 100, x.cprb),
        JSON.stringify(i));
    }
  }
}

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
