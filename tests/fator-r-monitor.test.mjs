// O Fator R que o sistema acompanha sozinho (assets/js/fator-r-monitor.js, 08/11/2026): quem entra na lista (o CNAE
// e o Anexo V na apuração do Domínio), o FS12 ÷ RBT12 pela ponte e o aviso do anexo apurado diferente do fator.
// Rodar com: node tests/fator-r-monitor.test.mjs
import { cnaeDoFatorR, digitosDoCnae, fatorDoPA, juntarPorMes, motivosDaEmpresa, linhaDaEmpresa, ultimoMesFechado, proximoPA, faixaDoFator, mesAntes } from '../assets/js/fator-r-monitor.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome, obtido === esperado, JSON.stringify(obtido) + ' (esperado ' + JSON.stringify(esperado) + ')');
const perto = (nome, a, b) => chk(nome, a != null && Math.abs(a - b) < 1e-9, a + ' (esperado ' + b + ')');

console.log('O CNAE:');
igual('os dígitos do texto do cadastro', digitosDoCnae('7319-0/03 - Marketing direto'), '7319003');
igual('o CNAE de 6 dígitos ganha o zero da frente', digitosDoCnae('111301'), '0111301');
chk('publicidade é do fator r', !!cnaeDoFatorR('7319-0/03 - Marketing direto'));
chk('TI é do fator r', !!cnaeDoFatorR('6201-5/01 - Desenvolvimento de programas'));
chk('a saúde é do fator r', !!cnaeDoFatorR('8690-9/01 - Práticas integrativas'));
chk('a contabilidade não (Anexo III de sempre)', !cnaeDoFatorR('6920-6/01 - Atividades de contabilidade'));
chk('o comércio não', !cnaeDoFatorR('4772-5/00 - Comércio varejista de cosméticos'));
chk('sem CNAE, não', !cnaeDoFatorR(null));

console.log('O mês fechado:');
igual('até o dia 20, o de dois meses atrás', ultimoMesFechado('2026-11-08'), '2026-09');
igual('depois do dia 20, o mês passado', ultimoMesFechado('2026-11-21'), '2026-10');
igual('o PA mais novo é o seguinte', proximoPA('2026-11-08'), '2026-10');
igual('mês antes, virando o ano', mesAntes('2026-01', 1), '2025-12');

// 12 meses de 10/2025 a 09/2026: receita de 10 mil e folha de 2.500 (salário 2.000 + pró-labore 300 + FGTS 200)
const linhas = [];
for (let k = 1; k <= 12; k++) linhas.push({ competencia: mesAntes('2026-10', k), receita_simples: 10000, salarios: 2000, pro_labore_valor: 300, fgts: 200, receita_anexo_3: 10000 });
console.log('A conta:');
const meses = juntarPorMes(linhas);
const r = fatorDoPA(meses, '2026-10', null);
perto('FS12 = 12 × 2.500', r.fs12, 30000);
perto('RBT12 pela ponte = 12 × 10 mil', r.rbt12, 120000);
igual('a fonte do RBT12', r.fonteRbt, 'ponte');
perto('fator r = 25%', r.fator, 0.25);
igual('abaixo de 28%, Anexo V', r.anexo, 'V');
const r2 = fatorDoPA(meses, '2026-10', 100000);
perto('o RBT12 do PGDAS vale sobre a soma da ponte', r2.fator, 0.30);
igual('com 30%, Anexo III', r2.anexo, 'III');
const curto = juntarPorMes(linhas.slice(0, 6));
const r3 = fatorDoPA(curto, '2026-10', 60000);
igual('com 6 meses de folha, conta os lidos', r3.lidos, 6);
perto('e usa a média × 12', r3.fs12, 30000);
igual('sem RBT12 de lado nenhum, sem fator', fatorDoPA(curto, '2026-10', null).fator, null);
chk('o mesmo documento em dois códigos: o maior', juntarPorMes([{ competencia: '2026-01', salarios: 100 }, { competencia: '2026-01', salarios: 300 }]).get('2026-01').salarios === 300);
igual('a faixa: 29% no fio', faixaDoFator(0.29), 'fio');
igual('a faixa: 26% perto', faixaDoFator(0.26), 'perto');

console.log('Quem entra:');
const comps = [...meses.keys()].sort();
igual('o CNAE principal do fator r entra', motivosDaEmpresa({ cnae_principal: '7311-4/00 - Agências de publicidade' }, meses, comps).length >= 1, true);
igual('o Anexo III sozinho, sem o CNAE, não entra', motivosDaEmpresa({ cnae_principal: '6920-6/01 - Contabilidade' }, meses, comps).length, 0);
const comV = juntarPorMes(linhas.map(l => ({ ...l, receita_anexo_3: 0, receita_anexo_5: 10000 })));
chk('a receita no Anexo V entra, com qualquer CNAE', motivosDaEmpresa({ cnae_principal: '4772-5/00 - Comércio' }, comV, comps).some(m => m.tipo === 'anexo'));
igual('o CNAE secundário sem o Anexo V não entra', motivosDaEmpresa({ cnae_principal: '6920-6/01 - Contabilidade', cnaes_secundarios: ['7020-4/00 - Consultoria'] }, meses, comps).length, 0);

console.log('A linha da tela:');
// o 09/2026 com o RBT12 da apuração e a receita no Anexo III: o fator do PA dá V (25%)
const l = linhaDaEmpresa({ cliente: { cnae_principal: '7319-0/03 - Marketing direto' }, linhas: linhas.map(x => x.competencia === '2026-09' ? { ...x, rbt12: 120000 } : x), pgdas: [], hoje: '2026-11-08' });
igual('o PA mostrado é o 10/2026', l.ultimo.competencia, '2026-10');
chk('apurado no III com o fator no V: avisa', l.avisos.some(a => a.includes('Apurado no Anexo III')), l.avisos.join(' / '));
igual('nada da empresa sem o fator r', linhaDaEmpresa({ cliente: { cnae_principal: '4711-3/02 - Supermercado' }, linhas: [], pgdas: [], hoje: '2026-11-08' }), null);

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
