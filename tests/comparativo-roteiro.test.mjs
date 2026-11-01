// Teste do roteiro do comparativo tributário (assets/js/comparativo-roteiro.js): "Por onde começar" — o que falta e o que
// conferir, na ordem do que pesa na decisão, o próximo passo e o estudo provisório.
// Rodar com: node tests/comparativo-roteiro.test.mjs — dados inventados (o repositório é público).

import { roteiroDoEstudo, crescimentoMedido } from '../assets/js/comparativo-roteiro.js';
import { entradaDoSistema, premissasParaTestar, situacaoDoGrupo } from '../assets/js/comparativo-dados.js';
import { comparar, testarPremissas } from '../assets/js/comparativo-motor.js';

let falhas = 0, total = 0;
function ok(nome, cond, extra) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome + (cond || extra == null ? '' : '  → ' + JSON.stringify(extra).slice(0, 400)));
}
const ids = r => r.passos.filter(p => p.estado !== 'feito').map(p => p.id);
// a tela: os padrões que ela põe na entrada
const comPadroes = e => ({ compras: 0, aliqCreditoIcms: 12, pctComprasSimples: 0, despesasCredito: 0, outrasDespesas: 0, folha: 0, proLabore: 0, rat: 2, fap: 1, terceiros: 5.8, crescimentoReceita: 0, crescimentoFolha: 0, ...e,
  atividades: e.atividades.map(a => ({ aliqIcms: 17, aliqIss: 3, pctST: 0, pctMonofasico: 0, redIcms: 0, redIcmsSimples: 0, ...a })) });
function rodar(entrada, origens, extra = {}) {
  let c = null, t = [];
  try { c = comparar(entrada); t = testarPremissas(entrada, premissasParaTestar(entrada, origens)); } catch (e) { c = null; }
  return roteiroDoEstudo({ entrada, origens, comparacao: c, testes: t, ...extra });
}

console.log('=== sem a receita ===');
const r0 = rodar(comPadroes({ atividades: [{ tipo: 'comercio', receita: 0 }] }), { 'atividades.0.receita': { fonte: 'padrao' } });
ok('o primeiro passo é a receita, que falta e decide', r0.proximo && r0.proximo.id === 'receita' && r0.proximo.estado === 'falta' && r0.proximo.peso === 'decide');
ok('sem a receita, o estudo é provisório', r0.provisorio);

console.log('=== o restaurante perto do limite, com a outra empresa do sócio ===');
const mesesDe = (ini, fim) => Array.from({ length: 12 }, (_, i) => { const d = new Date(2025, 7 + i, 1); const c = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); const v = c >= '2026-01' ? fim : ini; return { competencia: c, total: v, saidas: v, servicos: 0 }; });
const simRest = JSON.stringify({ v: 1, input: { anexo: 'I', mixCheia: 8, mixRed40: 92, mixRed60: 0, mixRed30: 0, mixZero: 0, pctReceitaMonofasica: 8, pctComprasMercadorias: 45 },
  fontes: { mixCheia: 'seções do PGDAS 07/2026: revenda com ST (bebidas)', pctExcluidoST: 'PGDAS 2026-07: redução de 40% na base do ICMS' },
  dominio: { meses: mesesDe(180000, 215000), pgdas: { competencia: '2026-07', aliquotaEfetiva: 9, dasTotal: 19000 } } });
const sis = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '5620-1/04', uf: 'RS' }, caso: { anexo: 'I', sim_obs: simRest } });
const outra = mesesDe(160000, 195000);
const cal = Array(12).fill(0); outra.forEach(m => { cal[Number(m.competencia.slice(5, 7)) - 1] += m.total; });
const ent = comPadroes({ ...sis.entrada, grupo: [{ nome: 'PADARIA INVENTADA', receita: outra.reduce((s, m) => s + m.total, 0), meses: cal }] });
const ori = { ...sis.origens, 'grupo.0.receita': { fonte: 'reforma' } };
const sit = situacaoDoGrupo(sis.serie, [{ nome: 'PADARIA INVENTADA', serie: outra }]);
const r1 = rodar(ent, ori, { situacao: sit, serie: sis.serie });
const lim = r1.passos.find(p => p.id === 'limite');
ok('o primeiro passo: pode ficar no Simples?', r1.proximo && r1.proximo.id === 'limite' && r1.proximo.peso === 'decide', ids(r1));
ok('com a soma, o mês em que passa e a data de saída', /R\$\s4\.570\.000/.test(lim.texto) && /passa do limite em dezembro/.test(lim.texto) && /01\/01\/2027/.test(lim.texto), lim.texto);
ok('vai pra lista das empresas e tem o "Conferido"', lim.campo === 'grupo.0.receita' && lim.conferir.join() === 'grupo');
const folha = r1.passos.find(p => p.id === 'folha');
ok('a folha falta e decide', folha && folha.estado === 'falta' && folha.peso === 'decide' && folha.campo === 'folha' && folha.conferir.join() === 'folha,proLabore');
ok('o estudo é provisório', r1.provisorio && r1.decidem >= 2);
const cres = r1.passos.find(p => p.id === 'crescimento');
ok('perto do limite, o crescimento decide e traz o medido', cres && cres.peso === 'decide' && /19%/.test(cres.texto), cres && cres.texto);
const prem = r1.passos.filter(p => p.id.startsWith('premissa:') && /Presumido|Real/.test(p.texto));
ok('sem a folha, a virada pro Presumido ou pro Real não decide (e diz por quê)', prem.every(p => p.peso === 'importa' && /Sem a folha na conta/.test(p.texto)), prem.map(p => p.id));
ok('o que veio do sistema', ['a receita', 'o ST', 'o monofásico', 'a redução do ICMS no DAS', 'as compras', 'a receita de PADARIA INVENTADA'].every(x => r1.doSistema.includes(x)), r1.doSistema);
ok('a ordem: o que decide antes do que importa, e o detalhe por último', (() => { const P = { decide: 0, importa: 1, detalhe: 2 }; const ps = r1.passos.filter(p => p.estado !== 'feito'); return ps.every((p, i) => i === 0 || P[ps[i - 1].peso] <= P[p.peso]); })());

console.log('=== conferir tira o passo ===');
const r2 = rodar(ent, { ...ori, grupo: { fonte: 'confirmado' } }, { situacao: sit, serie: sis.serie });
ok('"Conferido" no limite: o próximo é a folha', !ids(r2).includes('limite') && r2.proximo.id === 'folha', ids(r2));
const ent3 = { ...ent, folha: 480000, proLabore: 60000 };
const r3 = rodar(ent3, { ...ori, grupo: { fonte: 'confirmado' }, folha: { fonte: 'digitado' }, proLabore: { fonte: 'digitado' } }, { situacao: sit, serie: sis.serie });
ok('com a folha, o passo dela some', !ids(r3).includes('folha'), ids(r3));
ok('"Não tem folha" (conferido) também tira o passo', !ids(rodar(ent, { ...ori, folha: { fonte: 'confirmado' }, proLabore: { fonte: 'confirmado' } }, { situacao: sit, serie: sis.serie })).includes('folha'));
const resto = r3.passos.find(p => p.id === 'resto');
ok('o resto no padrão vai junto num passo só, "quando der"', resto && resto.peso === 'detalhe' && /o RAT/.test(resto.texto) && resto.conferir.includes('rat'), resto && resto.texto);
const conf = Object.fromEntries((resto ? resto.conferir : []).map(k => [k, { fonte: 'confirmado' }]));
ok('"Estão certos" tira o passo do resto', !ids(rodar(ent3, { ...ori, ...conf, grupo: { fonte: 'confirmado' }, folha: { fonte: 'digitado' }, proLabore: { fonte: 'digitado' } }, { situacao: sit, serie: sis.serie })).includes('resto'));

console.log('=== longe do limite e o lucro do Real ===');
const longe = comPadroes({ atividades: [{ tipo: 'comercio', receita: 1200000 }], compras: 800000, folha: 120000, proLabore: 36000, despesasCredito: 30000 });
const oLonge = { 'atividades.0.receita': { fonte: 'dominio' }, compras: { fonte: 'dominio' }, folha: { fonte: 'fator_r' }, proLabore: { fonte: 'fator_r' } };
const r4 = rodar(longe, oLonge);
ok('sem as outras empresas e longe do limite: não há o passo do limite', !ids(r4).includes('limite'));
ok('longe do limite, o crescimento muda o tamanho, não decide', (r4.passos.find(p => p.id === 'crescimento') || {}).peso === 'importa');
ok('o Real nem com lucro zero fica abaixo do Simples: sem o passo do lucro', !ids(r4).includes('lucro'));
// acima do limite (fora do Simples), entre o Presumido e o Real: o empate do comércio fica perto de 9,5% da receita
const grande = comPadroes({ atividades: [{ tipo: 'comercio', receita: 6000000 }], compras: 4000000, folha: 500000, proLabore: 60000, despesasCredito: 100000 });
const oGrande = { 'atividades.0.receita': { fonte: 'dominio' }, compras: { fonte: 'dominio' }, folha: { fonte: 'digitado' }, proLabore: { fonte: 'digitado' } };
const rg = rodar(grande, oGrande);
const lucro = rg.passos.find(p => p.id === 'lucro');
ok('o lucro do Real decide: o empate e o lucro que a conta usou', lucro && lucro.peso === 'decide' && /empata com o Lucro Presumido/.test(lucro.texto) && /a conta usou/.test(lucro.texto) && lucro.campo === 'outrasDespesas', lucro && lucro.texto);
ok('fora do Simples pelo limite, o passo do limite diz isso', /fica fora/.test((rg.passos.find(p => p.id === 'limite') || {}).texto || ''));
const r5 = rodar(grande, { ...oGrande, outrasDespesas: { fonte: 'digitado' } });
ok('com as outras despesas digitadas, o passo do lucro some', !ids(r5).includes('lucro'));

console.log('=== o crescimento medido ===');
const g = crescimentoMedido(mesesDe(100000, 120000));
// ago–out/25 a 100.000 × 3 contra mai–jul/26 a 120.000 × 3: +20%
ok('os 3 últimos contra os 3 primeiros: +20%', g && Math.abs(g.pct - 20) < 1e-9 && g.ini[0] === '2025-08' && g.fim[1] === '2026-07', g);
ok('com menos de 9 meses, não mede', crescimentoMedido(mesesDe(1, 2).slice(0, 8)) === null);

console.log('=== só detalhes pendentes: o resultado se sustenta ===');
const tudo = { ...oLonge, outrasDespesas: { fonte: 'digitado' }, crescimentoReceita: { fonte: 'confirmado' }, crescimentoFolha: { fonte: 'confirmado' }, aliqCreditoIcms: { fonte: 'confirmado' } };
const r6 = rodar(longe, tudo);
ok('sem nada que decida, não é provisório', !r6.provisorio && r6.decidem === 0, r6.passos.map(p => p.id + ':' + p.peso));

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
