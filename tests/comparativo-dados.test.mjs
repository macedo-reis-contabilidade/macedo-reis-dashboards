// Teste do que o comparativo tributário tira do sistema (assets/js/comparativo-dados.js): o caso da Reforma, o Fator R,
// o PGDAS da Receita, o cadastro, os relatórios do Domínio, as premissas a testar e os prazos da escolha.
// Rodar com: node tests/comparativo-dados.test.mjs — dados inventados (o repositório é público).

import { entradaDoSistema, aplicarRelatorios, premissasParaTestar, prazosDaEscolha, serieDosMeses, tipoPeloCnae, tipoPeloAnexo, regimeDoCadastro } from '../assets/js/comparativo-dados.js';
import { comparar } from '../assets/js/comparativo-motor.js';

let falhas = 0, total = 0;
function ok(nome, cond, extra) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome + (cond || extra == null ? '' : '  → ' + JSON.stringify(extra)));
}
const perto = (a, b, tol = 0.01) => a != null && Math.abs(a - b) <= tol;

console.log('=== o regime e a atividade ===');
ok('Simples Nacional → simples', regimeDoCadastro('Simples Nacional') === 'simples');
ok('Lucro Presumido → presumido', regimeDoCadastro('Lucro Presumido') === 'presumido');
ok('MEI → mei', regimeDoCadastro('MEI') === 'mei');
ok('Anexo II → indústria', tipoPeloAnexo('II') === 'industria');
ok('Anexo V → serviço do fator r', tipoPeloAnexo('v') === 'servico_r');
ok('CNAE 4711-3/02 → comércio', tipoPeloCnae('4711-3/02') === 'comercio');
ok('CNAE 1531-9/01 (calçados) → indústria', tipoPeloCnae('1531-9/01') === 'industria');
ok('CNAE 6201-5/01 (TI) → fator r', tipoPeloCnae('6201-5/01') === 'servico_r');
ok('CNAE 6920-6/01 (contabilidade) → Anexo III', tipoPeloCnae('6920-6/01') === 'servico');
ok('CNAE 4120-4/00 (construção) → Anexo IV', tipoPeloCnae('4120-4/00') === 'servico_iv');
ok('CNAE de 6 dígitos ganha o zero (121101 → 0121-1/01, produção rural → com o comércio)', tipoPeloCnae('121101') === 'comercio');

console.log('=== a série de 12 meses ===');
const meses12 = Array.from({ length: 12 }, (_, i) => ({ competencia: (i < 4 ? '2025-' : '2026-') + String(i < 4 ? i + 9 : i - 3).padStart(2, '0'), saidas: 80000, servicos: 20000, total: 100000 + i * 1000 }));
const s12 = serieDosMeses(meses12);
ok('12 meses: soma sem anualizar', perto(s12.receita, 1266000));
ok('12 meses: cada mês no lugar do calendário (set/25 vai pra setembro)', s12.meses && s12.meses[8] === 100000 && s12.meses[0] === 104000, s12.meses);
const s8 = serieDosMeses(meses12.slice(4));
ok('8 meses: anualiza (× 12 ÷ 8)', perto(s8.receita, (meses12.slice(4).reduce((s, m) => s + m.total, 0)) * 1.5));
ok('8 meses: sem a forma do ano', s8.meses === null);

console.log('=== o caso da Reforma, o Fator R e o cadastro ===');
const simObs = JSON.stringify({ v: 1, input: { anexo: 'I', receita: 100000, rbt12: 1200000, pctComprasMercadorias: 70, pctComprasDespesas: 3, pctReceitaMonofasica: 10, mixCheia: 80, mixRed60: 20, mixRed40: 0, mixRed30: 0, mixZero: 0 },
  dominio: { meses: meses12.slice(4), vendas: { mercadorias: 640000, st: 160000, total: 800000 }, pgdas: { competencia: '2026-08', aliquotaEfetiva: 8.4, dasTotal: 9000 } } });
const fr = Array.from({ length: 6 }, (_, i) => ({ competencia: '2026-0' + (i + 3) + '-01', folha_salarios: 10000, folha_outros: 1000, prolabore: 3000 }));
const r = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, caso: { anexo: 'I', sim_obs: simObs }, fatorR: fr });
ok('regime de hoje do cadastro', r.entrada.regimeAtual === 'simples');
ok('duas atividades: comércio e serviço (o faturamento tem os dois)', r.entrada.atividades.length === 2 && r.entrada.atividades[0].tipo === 'comercio' && r.entrada.atividades[1].tipo === 'servico', r.entrada.atividades);
const rec = r.entrada.atividades.reduce((s, a) => s + a.receita, 0);
ok('receita: 8 meses do faturamento anualizados', perto(rec, s8.receita));
ok('a origem da receita diz o período e que anualizou', /anualizado/.test(r.origens['atividades.0.receita'].texto) && r.origens['atividades.0.receita'].fonte === 'reforma');
ok('ST da saídas: 160.000 de 640.000 = 25%', perto(r.entrada.atividades[0].pctST, 25));
ok('monofásico do caso', r.entrada.atividades[0].pctMonofasico === 10);
ok('compras = 70% da receita', perto(r.entrada.compras, 0.7 * rec));
ok('despesas com crédito = 3% da receita', perto(r.entrada.despesasCredito, 0.03 * rec));
ok('mix da Reforma do caso', r.entrada.mix && r.entrada.mix.red60 === 20);
ok('folha do Fator R anualizada (11.000 × 12)', perto(r.entrada.folha, 132000) && perto(r.entrada.proLabore, 36000));
ok('a conferência do PGDAS vem junto', r.conferencia && r.conferencia.aliquota === 8.4 && r.conferencia.competencia === '2026-08');
ok('crédito de ICMS e outras despesas ficam no padrão', r.origens.aliqCreditoIcms.fonte === 'padrao' && r.origens.outrasDespesas.fonte === 'padrao');
ok('a entrada roda no motor', (() => { try { return !!comparar({ ...r.entrada, outrasDespesas: 100000 }).decisao; } catch (e) { return false; } })());

const semNada = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '6201-5/01' } });
ok('sem caso: uma linha do fator r pelo CNAE, sem receita', semNada.entrada.atividades.length === 1 && semNada.entrada.atividades[0].tipo === 'servico_r' && semNada.entrada.atividades[0].receita === 0);
ok('sem caso: a origem pede a receita', /digite/.test(semNada.origens['atividades.0.receita'].texto));
ok('sem folha: a nota avisa', semNada.notas.some(n => /folha/.test(n)));

const pg = Array.from({ length: 12 }, (_, i) => ({ competencia: '2026-' + String(i + 1).padStart(2, '0'), receita_mes: 50000 }));
const comPgdas = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, caso: { anexo: 'I', sim_obs: simObs }, pgdas: pg });
ok('o PGDAS da Receita manda na receita (600.000)', perto(comPgdas.entrada.atividades.reduce((s, a) => s + a.receita, 0), 600000));
ok('... e a divisão segue a do faturamento', comPgdas.entrada.atividades.length === 2 && /divisão/.test(comPgdas.origens['atividades.0.receita'].texto));

console.log('=== os relatórios do Domínio soltos na tela ===');
const cons = { fat: { meses: meses12 }, resVen: { mercadorias: 900000, st: 90000 }, campos: { anexo: 'I', pctMerc: 60, pctDesp: 5 }, origem: { pctMerc: 'entradas Domínio …' }, sim: { competencia: '2026-08', aliquotaEfetiva: 8.5, dasTotal: 9500 } };
const ap = aplicarRelatorios(r.entrada, r.origens, cons);
ok('a receita vem do faturamento de 12 meses', perto(ap.entrada.atividades.reduce((s, a) => s + a.receita, 0), 1266000) && ap.origens['atividades.0.receita'].fonte === 'dominio');
ok('a forma do ano vem junto', Array.isArray(ap.entrada.meses) && ap.entrada.meses.length === 12);
ok('o monofásico da linha fica', ap.entrada.atividades[0].pctMonofasico === 10);
ok('ST das saídas: 10%', perto(ap.entrada.atividades[0].pctST, 10));
ok('compras = 60% da nova receita', perto(ap.entrada.compras, 0.6 * 1266000));
ok('a conferência é a do PGDAS solto', ap.conferencia.aliquota === 8.5);

console.log('=== premissas a testar ===');
const ps = premissasParaTestar({ ...r.entrada, outrasDespesas: 1 }, r.origens);
ok('testa o crédito de ICMS (padrão, com compras)', ps.some(p => p.campo === 'aliqCreditoIcms'));
ok('testa o ICMS das vendas e o ISS', ps.some(p => p.campo === 'atividades.0.aliqIcms') && ps.some(p => p.campo === 'atividades.1.aliqIss'));
ok('testa o RAT (com folha)', ps.some(p => p.campo === 'rat'));
const ps2 = premissasParaTestar(r.entrada, { ...r.origens, aliqCreditoIcms: { fonte: 'digitado' } });
ok('o digitado não é testado', !ps2.some(p => p.campo === 'aliqCreditoIcms'));

console.log('=== prazos da escolha ===');
const p1 = prazosDaEscolha('2026-11-01', 'simples', 2027);
ok('Simples em 01/11/2026: sair até 31/12/2026', /31\/12\/2026/.test(p1[0].texto) && /2028/.test(p1[0].texto));
const p2 = prazosDaEscolha('2026-11-01', 'presumido', 2027);
ok('Presumido em 01/11/2026: a janela do Simples de 2027 fechou', /fechou em 30\/09\/2026/.test(p2[0].texto) && /2028/.test(p2[0].texto));
const p3 = prazosDaEscolha('2026-08-15', 'presumido', 2027);
ok('Presumido em agosto: a janela de setembro ainda vem', /01 a 30\/09\/2026/.test(p3[0].texto));
ok('sempre diz como escolher entre Presumido e Real', p2.some(p => /Presumido ou Real/.test(p.titulo)));

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
