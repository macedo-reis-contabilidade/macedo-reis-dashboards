// Teste do que o comparativo tributário tira do sistema (assets/js/comparativo-dados.js): o caso da Reforma, o Fator R,
// o PGDAS da Receita, o cadastro, os relatórios do Domínio, as premissas a testar, os prazos da escolha, a refeição no RS
// e as outras empresas dos mesmos sócios.
// Rodar com: node tests/comparativo-dados.test.mjs — dados inventados (o repositório é público).

import { entradaDoSistema, aplicarRelatorios, premissasParaTestar, prazosDaEscolha, exclusaoObrigatoria, ultimoDiaUtil, serieDosMeses, tipoPeloCnae, tipoPeloAnexo, regimeDoCadastro,
  ehRefeicaoRS, ehRdaRS, empresasDosSocios, receitaDaEmpresa, situacaoDoGrupo, serieDaEmpresa, foraDaSoma, avisoDaSoma, mesclarSerie,
  pareceFolha, cnpjsDoCabecalho, juntarFolha, folhaDoAno, aplicarFolha, mesesDaPonte, seriePonte, somaDaPonte } from '../assets/js/comparativo-dados.js';
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
console.log('=== a exclusão obrigatória (o limite) ===');
ok('o último dia útil: janeiro de 2027 é dia 29 (o 30 e o 31 caem no fim de semana)', ultimoDiaUtil(2027, 1) === '2027-01-29', ultimoDiaUtil(2027, 1));
ok('o último dia útil pula o Carnaval: fevereiro de 2028 é dia 25', ultimoDiaUtil(2028, 2) === '2028-02-25', ultimoDiaUtil(2028, 2));
const mesesAte = (mensal, ate = 8) => Array.from({ length: ate }, (_, i) => ({ competencia: '2026-' + String(i + 1).padStart(2, '0'), total: mensal }));
const sGrupo = situacaoDoGrupo(mesesAte(250000), [{ nome: 'OUTRA', serie: mesesAte(160000) }]);
const eGrupo = exclusaoObrigatoria(sGrupo);
ok('com as empresas dos sócios, passando em dezembro: comunicar até o último dia útil de janeiro, com efeito em 01/01/2027',
  sGrupo.passaEm === 'dezembro' && eGrupo.ate === '2027-01-29' && /com efeito em 01\/01\/2027/.test(eGrupo.texto) && /até 29\/01\/2027/.test(eGrupo.texto)
  && /art\. 30, §1º, II, e art\. 31, II/.test(eGrupo.texto) && /^A soma com as empresas dos sócios, no ritmo dos últimos 3 meses, passa do limite em dezembro: /.test(eGrupo.texto) && /art\. 36/.test(eGrupo.texto), eGrupo && eGrupo.texto);
const sSo = situacaoDoGrupo(mesesAte(450000), []);
const eSo = exclusaoObrigatoria(sSo);
ok('sozinha, com o excesso de até 20%: até o último dia útil de janeiro do ano seguinte (art. 30, §1º, IV, "b")',
  sSo.passaEm === 'novembro' && sSo.noAnoSeguinte && eSo.ate === '2027-01-29' && /IV, "b"/.test(eSo.texto) && /sem passar dos 20%/.test(eSo.texto), eSo && eSo.texto);
const s20 = situacaoDoGrupo(mesesAte(600000), []);
const e20 = exclusaoObrigatoria(s20);
ok('sozinha, acima dos 20% em outubro: com efeito em 01/11/2026, comunicada até 30/11/2026 (art. 30, §1º, IV, "a")',
  s20.passa20Em === 'outubro' && e20.ate === '2026-11-30' && /com efeito em 01\/11\/2026/.test(e20.texto) && /IV, "a"/.test(e20.texto), e20 && e20.texto);
ok('longe do limite, nada', exclusaoObrigatoria(situacaoDoGrupo(mesesAte(100000), [])) === null && exclusaoObrigatoria(null) === null);
const pObrig = prazosDaEscolha('2026-11-01', 'simples', 2027, sGrupo);
ok('nos prazos do Simples, a exclusão obrigatória vem primeiro', /Comunicar a exclusão/.test(pObrig[0].titulo) && pObrig.some(p => /31\/12\/2026/.test(p.texto)), pObrig.map(p => p.titulo));
ok('no Presumido, não há exclusão a comunicar', !prazosDaEscolha('2026-11-01', 'presumido', 2027, sGrupo).some(p => /Comunicar a exclusão/.test(p.titulo)));
const pr = p2.find(p => /Presumido ou Real/.test(p.titulo));
ok('o prazo da escolha: o Presumido e o Real trimestral no fim de abril; o Real anual, na estimativa de janeiro, no fim de fevereiro',
  /fim de abril/.test(pr.texto) && /Real anual, a estimativa de janeiro, que vence no fim de fevereiro/.test(pr.texto) && /art\. 3º, parágrafo único/.test(pr.texto), pr.texto);

console.log('=== a refeição no RS e o PGDAS do caso ===');
ok('5620-1/04 no RS é refeição', ehRefeicaoRS('5620-1/04', 'RS'));
ok('restaurante sem UF no cadastro conta como RS', ehRefeicaoRS('5611-2/01', null));
ok('em SC não', !ehRefeicaoRS('5620-1/04', 'SC'));
ok('mercado não', !ehRefeicaoRS('4711-3/02', 'RS'));
const mesesRest = Array.from({ length: 12 }, (_, i) => { const d = new Date(2025, 7 + i, 1); const c = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); const v = c >= '2026-01' ? 215000 : 180000; return { competencia: c, total: v, saidas: v, servicos: 0 }; });
const simRest = JSON.stringify({ v: 1, input: { anexo: 'I', mixCheia: 8, mixRed40: 92, mixRed60: 0, mixRed30: 0, mixZero: 0, pctReceitaMonofasica: 8, pctComprasMercadorias: 45 },
  fontes: { mixCheia: 'seções do PGDAS 07/2026: revenda com ST (bebidas) — alíquota cheia por fora', pctExcluidoST: 'PGDAS 2026-07: 14% a menos (receita com ST/monofásico e redução de 40% na base do ICMS)' },
  dominio: { meses: mesesRest, pgdas: { competencia: '2026-07', aliquotaEfetiva: 9, dasTotal: 19000 } } });
const rest = entradaDoSistema({ cliente: { nome_principal: 'RESTAURANTE INVENTADO', regime_tributario: 'Simples Nacional', cnae_principal: '5620-1/04', uf: 'RS' }, caso: { anexo: 'I', sim_obs: simRest } });
const ar = rest.entrada.atividades[0];
ok('refeição no RS: 12% e a base a 60% no regime geral, no padrão', ar.aliqIcms === 12 && ar.redIcms === 40 && rest.origens['atividades.0.aliqIcms'].fonte === 'padrao' && rest.origens['atividades.0.redIcms'].fonte === 'padrao', ar);
ok('a redução de 40% no DAS, lida do PGDAS do caso (verde)', ar.redIcmsSimples === 40 && rest.origens['atividades.0.redIcmsSimples'].fonte === 'reforma' && /jul\/26/.test(rest.origens['atividades.0.redIcmsSimples'].texto), rest.origens['atividades.0.redIcmsSimples']);
ok('a revenda com ST: a do PGDAS do caso (8%)', ar.pctST === 8 && rest.origens['atividades.0.pctST'].fonte === 'reforma');
ok('a série datada da empresa vem junto', Array.isArray(rest.serie) && rest.serie.length === 12 && rest.serie[0].competencia === '2025-08');
const restSem = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '5611-2/01', uf: 'RS' }, caso: { anexo: 'I', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'I' }, dominio: { meses: mesesRest } }) } });
ok('restaurante sem o PGDAS: os 40% no DAS ficam no padrão', restSem.entrada.atividades[0].redIcmsSimples === 40 && restSem.origens['atividades.0.redIcmsSimples'].fonte === 'padrao');
const merc = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', uf: 'RS' }, caso: { anexo: 'I', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'I' }, dominio: { meses: mesesRest, pgdas: { competencia: '2026-07', reducaoIcms: 25 } } }) } });
ok('outro benefício no PGDAS (25%): vale no DAS, não no regime geral, com a nota', merc.entrada.atividades[0].redIcmsSimples === 25 && !merc.entrada.atividades[0].redIcms && merc.notas.some(n => /25% de redução do ICMS/.test(n)));
const apRed = aplicarRelatorios({ atividades: [{ tipo: 'comercio', receita: 1000000 }] }, {}, { sim: { competencia: '2026-09', reducaoIcms: 40, aliquotaEfetiva: 8 } });
ok('o PGDAS solto na tela traz a redução', apRed.entrada.atividades[0].redIcmsSimples === 40 && apRed.origens['atividades.0.redIcmsSimples'].fonte === 'dominio');
const psRest = premissasParaTestar(rest.entrada, rest.origens);
ok('restaurante: testa a base cheia no regime geral e o ICMS a 17%', psRest.some(p => p.campo === 'atividades.0.redIcms' && p.valores[0] === 0) && psRest.some(p => p.campo === 'atividades.0.aliqIcms' && p.valores[0] === 17));
ok('a redução medida no PGDAS não é testada', !psRest.some(p => p.campo === 'atividades.0.redIcmsSimples'));

console.log('=== as outras empresas dos mesmos sócios ===');
const meus = [{ nome: 'Fulano de Tal', cpf: '111.222.333-44' }, { nome: 'Beltrana Souza', cpf: null }];
const outros = [{ cliente_id: 'x', nome: 'FULANO DE TAL', cpf: '11122233344' }, { cliente_id: 'x', nome: 'BELTRANA SOUZA', cpf: null }, { cliente_id: 'y', nome: 'Ciclano', cpf: '99999999999' },
  { cliente_id: 'z', nome: 'Fulano de Tal', cpf: '00000000000' }, { cliente_id: 'eu', nome: 'Fulano de Tal', cpf: '11122233344' }];
const emp = empresasDosSocios(meus, outros, 'eu');
ok('casa pelo CPF (com ou sem pontos) e, sem CPF, pelo nome', emp.length === 1 && emp[0].cliente_id === 'x' && emp[0].socios.join('|') === 'Fulano de Tal|Beltrana Souza', emp);
ok('o homônimo com outro CPF não entra, nem a própria empresa', !emp.some(e => e.cliente_id === 'z' || e.cliente_id === 'eu'));
const cli = { id: 'x', nome_principal: 'PADARIA INVENTADA LTDA', nome_fantasia: 'PÃO BOM' };
const rPg = receitaDaEmpresa({ cliente: cli, caso: { sim_obs: JSON.stringify({ dominio: { meses: mesesRest } }) }, pgdas: mesesRest.map(m => ({ competencia: m.competencia, receita_mes: 100000 })) });
ok('a receita da outra: o PGDAS da Receita na frente do caso', perto(rPg.receita, 1200000) && rPg.origem.fonte === 'pgdas' && rPg.nome === 'PADARIA INVENTADA LTDA (PÃO BOM)', rPg);
const rCaso = receitaDaEmpresa({ cliente: cli, caso: { sim_obs: JSON.stringify({ dominio: { meses: mesesRest } }) } });
ok('sem PGDAS: o faturamento do caso', perto(rCaso.receita, 5 * 180000 + 7 * 215000) && rCaso.origem.fonte === 'reforma' && rCaso.serie.length === 12);
ok('só a receita mensal do caso: × 12, sem série', receitaDaEmpresa({ cliente: cli, caso: { receita_mensal: 50000 } }).receita === 600000);
ok('nada no sistema: zero, pra digitar', receitaDaEmpresa({ cliente: cli }).receita === 0 && receitaDaEmpresa({ cliente: cli }).origem.fonte === 'padrao');
const serieOutra = mesesRest.map(m => ({ competencia: m.competencia, total: m.competencia >= '2026-01' ? 195000 : 160000 }));
const sit = situacaoDoGrupo(serieDaEmpresa({ caso: { sim_obs: simRest } }).serie, [{ nome: 'OUTRA', serie: serieOutra }]);
// 2026 até julho: 7 × (215.000 + 195.000) = 2.870.000; ritmo 410.000 por mês → ago 3.280.000 … nov 4.510.000, dez 4.920.000
ok('o ano até julho: 2.870.000 somadas', sit && perto(sit.acumulado, 2870000) && sit.meses === 7 && sit.ate === '2026-07', sit);
ok('o ritmo dos últimos 3 meses: 410.000', perto(sit.ritmo, 410000));
ok('nesse ritmo, passa em dezembro e sai em 01/01/2027', sit.passaEm === 'dezembro' && sit.saiEm === '01/01/2027' && !sit.jaPassou);
ok('faltam 1.930.000 — 386.000 por mês até dezembro', perto(sit.faltam, 1930000) && perto(sit.porMesAteOLimite, 386000));
const seis = Array.from({ length: 6 }, (_, i) => ({ competencia: '2026-0' + (i + 1), total: 450000 }));
const sit2 = situacaoDoGrupo(seis, [{ nome: 'OUTRA', serie: seis }]);
ok('já passou: em junho (5,4 milhões até lá), fora a partir de 01/07/2026', sit2.jaPassou && sit2.passaEm === 'junho' && sit2.saiEm === '01/07/2026', sit2);
ok('a empresa sozinha também tem o ano', situacaoDoGrupo(seis, []).porEmpresa.length === 1);
ok('sem a série de uma, não há como somar o ano', situacaoDoGrupo(seis, [{ nome: 'OUTRA', serie: [] }]) === null);

console.log('=== a revisão de 01/11/2026: a saída sozinha, a regra da soma, o RDA e os CNAEs ===');
// sozinha, 450.000 por mês de janeiro a junho (2,7 milhões) e no ritmo: passa de 4,8 milhões em novembro (4,95) e fecha
// em 5,4 milhões — o excesso fica em até 20% (5,76): a saída vale no ano seguinte (LC 123, art. 3º, §9º-A)
const s1 = situacaoDoGrupo(seis, []);
ok('sozinha, excesso de até 20%: passa em novembro e sai em 01/01/2027', s1.passaEm === 'novembro' && s1.saiEm === '01/01/2027' && s1.noAnoSeguinte === true && s1.passa20Em === null, s1);
// sozinha, 600.000 por mês: passa de 4,8 em setembro (5,4) e de 5,76 em outubro (6,0) → sai em 01/11/2026
const seis600 = seis.map(m => ({ ...m, total: 600000 }));
const s2 = situacaoDoGrupo(seis600, []);
ok('sozinha, acima de 20%: sai no mês seguinte ao que passou de 5,76 milhões', s2.passaEm === 'setembro' && s2.passa20Em === 'outubro' && s2.saiEm === '01/11/2026' && s2.noAnoSeguinte === false, s2);
ok('com outra empresa dos sócios, sem a tolerância: o mês seguinte ao que a soma passa', sit2.saiEm === '01/07/2026' && sit2.noAnoSeguinte === false);
const outrosP = [{ cliente_id: 'x', nome: 'FULANO DE TAL', cpf: '11122233344', participacao_percentual: 5, eh_administrador: false },
  { cliente_id: 'x', nome: 'BELTRANA SOUZA', cpf: null, participacao_percentual: '8', eh_administrador: true }];
const empP = empresasDosSocios(meus, outrosP, 'eu');
ok('a participação (a maior dos sócios em comum) e se algum administra', empP[0].participacao === 8 && empP[0].administrador === true, empP);
ok('sem a participação no cadastro: nula', empresasDosSocios(meus, [{ cliente_id: 'x', nome: 'FULANO DE TAL', cpf: '11122233344' }], 'eu')[0].participacao === null);
ok('a outra ME ou EPP entra com qualquer participação (inciso III)', foraDaSoma({ participacao: 1, administrador: false }, 4000000) === null);
ok('a que não é ME nem EPP, com o sócio até 10% e sem administrar, fica fora', /não é ME nem EPP/.test(foraDaSoma({ participacao: 10, administrador: false }, 6000000) || ''));
ok('com mais de 10% (inciso IV) ou administrando (inciso V), entra', foraDaSoma({ participacao: 10.5, administrador: false }, 6000000) === null && foraDaSoma({ participacao: 2, administrador: true }, 6000000) === null);
ok('sem a participação: entra, com o aviso pra conferir', foraDaSoma({ participacao: null }, 6000000) === null && /participação não está no cadastro/.test(avisoDaSoma({ participacao: null }, 6000000, 'A GRANDE') || ''));
ok('ME ou EPP sem a participação: sem aviso', avisoDaSoma({ participacao: null }, 3000000) === null);
ok('5611-2/02 (o código antigo dos bares) é refeição', ehRefeicaoRS('5611-2/02', 'RS'));
ok('o RDA é do grupo 56.1, no RS', ehRdaRS('5611-2/01', 'RS') && ehRdaRS('5611-2/03', null) && !ehRdaRS('5620-1/04', 'RS') && !ehRdaRS('5611-2/01', 'SC'));
const bar = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '5611-2/01', uf: 'rs' }, caso: { anexo: 'I', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'I' }, dominio: { meses: mesesRest } }) } });
ok('restaurante (56.1): o RDA no "mais barato", no padrão, e a UF na entrada', bar.entrada.rda === 'melhor' && bar.origens.rda.fonte === 'padrao' && /38-A/.test(bar.origens.rda.dica) && bar.entrada.uf === 'RS', bar.entrada);
ok('5620-1/04 é refeição, mas não tem RDA — e a origem diz por quê', rest.entrada.rda == null && rest.entrada.atividades[0].aliqIcms === 12 && rest.origens.rda.fonte === 'cadastro' && /não é do grupo 56\.1/.test(rest.origens.rda.texto), rest.origens.rda);
const psBar = premissasParaTestar(bar.entrada, bar.origens);
ok('o RDA no padrão é testado (sem ele)', psBar.some(p => p.campo === 'rda' && p.valores[0] === null && p.nomes && p.nomes[null] === 'sem o RDA'));
ok('o RDA escolhido pela equipe não é testado', !premissasParaTestar(bar.entrada, { ...bar.origens, rda: { fonte: 'digitado' } }).some(p => p.campo === 'rda'));
const coletiva = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '5620-1/01', uf: 'RS' }, caso: { anexo: 'I', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'I' }, dominio: { meses: mesesRest } }) } });
ok('refeições pra empresas: 17% sem redução, com a nota pra conferir a base a 60%', coletiva.entrada.atividades[0].aliqIcms !== 12 && coletiva.notas.some(n => /refeições pra empresas/.test(n) && /art\. 23, VI/.test(n)) && coletiva.entrada.rda == null, coletiva.notas);

console.log('=== o faturamento solto na tela entra na série ===');
const ms = mesclarSerie([{ competencia: '2026-07', total: 1 }, { competencia: '2026-08', total: 2 }], [{ competencia: '2026-09', total: 6, saidas: 6 }, { competencia: '2026-08', total: 5 }, { competencia: 'x', total: 9 }]);
ok('junta pelo mês, o relatório vale no mês que os dois têm, em ordem, só competência e total', JSON.stringify(ms) === '[{"competencia":"2026-07","total":1},{"competencia":"2026-08","total":5},{"competencia":"2026-09","total":6}]', ms);
ok('sem nada, nulo', mesclarSerie(null, []) === null);

console.log('=== o resumo da folha do Domínio ===');
// um resumo da folha inventado, como o pdf.js devolve as linhas (nomes e números de mentira)
const linhasFolha = ['EMPRESA DE TESTE LTDA  Página: 0001', 'CNPJ: 12.345.678/0001-90  Competência: 09/2026', 'RESUMO DA FOLHA', 'Código  Descrição  Proventos  Descontos',
  '001  Salário  10.000,00', '005  Pró-Labore  5.000,00', '210  INSS  1.100,00', '220  IRRF  300,00', 'Base FGTS  10.000,00  FGTS  800,00', 'Total de Proventos  15.000,00  Líquido  13.600,00'];
ok('o resumo da folha é reconhecido pelo título e as rubricas', pareceFolha(linhasFolha));
ok('sem o título, só com muitas rubricas', pareceFolha(['Salário 1', 'Pró-labore 2', 'FGTS 3', 'INSS 4', 'Líquido 5']) && !pareceFolha(['Salário 1', 'INSS 2']));
ok('o relatório fiscal não parece folha', !pareceFolha(['RELATORIO DE FATURAMENTO', 'Mês  Vendas  Serviços  Total', '01/2026  100,00  0,00  100,00']));
ok('os CNPJs do cabeçalho, sem a pontuação', JSON.stringify(cnpjsDoCabecalho(linhasFolha)) === '["12345678000190"]' && cnpjsDoCabecalho(['sem CNPJ']).length === 0);
const mesF = (c, extra = {}) => ({ competencia: c, folha_salarios: 10000, prolabore: 5000, fgts: 800, inss_patronal: null, folha_outros: c.endsWith('-12') ? 10000 : null, ...extra });
const lidaF = { meses: ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map(c => mesF(c)) };
const jF = juntarFolha(null, lidaF);
ok('junta só os três totais (salários, pró-labore e outros), em ordem', jF.length === 14 && jF[0].competencia === '2025-08' && !('fgts' in jF[0]) && jF.find(x => x.competencia === '2025-12').folha_outros === 10000, jF[0]);
const aF = folhaDoAno(jF, '2026-08');
ok('os 12 meses que terminam no último mês da receita: salários + 13º, e o pró-labore', aF.ok && aF.n === 12 && aF.de === '2025-09' && aF.ate === '2026-08' && aF.folha === 130000 && aF.proLabore === 60000 && !aF.anualizado, aF);
ok('sem a receita, os 12 últimos meses lidos', folhaDoAno(jF).ate === '2026-09');
ok('o mesmo resumo solto de novo não soma em dobro', folhaDoAno(juntarFolha(jF, lidaF), '2026-08').folha === 130000);
const jSo = juntarFolha(null, { meses: ['2026-07', '2026-08', '2026-09'].map(c => ({ competencia: c, folha_salarios: 8000, prolabore: null })) });
const jPro = juntarFolha(jSo, { meses: ['2026-07', '2026-08', '2026-09'].map(c => ({ competencia: c, folha_salarios: 0, prolabore: 3000 })) });
ok('o resumo do pró-labore solto à parte completa o dos salários, e o zero dele não apaga os salários', jPro.every(x => x.folha_salarios === 8000 && x.prolabore === 3000), jPro);
const aSo = folhaDoAno(jSo, '2026-09');
ok('com 3 meses, anualizado; sem pró-labore no resumo', aSo.ok && aSo.n === 3 && aSo.anualizado && aSo.folha === 96000 && aSo.proLabore === 0 && aSo.temSalarios && !aSo.temPro, aSo);
ok('com menos de 3 meses, não usa e diz por quê', !folhaDoAno(jSo.slice(0, 2), '2026-09').ok && /só 2 meses/.test(folhaDoAno(jSo.slice(0, 2), '2026-09').motivo));
ok('o que veio pelo mês do pagamento volta pra competência anterior', juntarFolha(null, { meses: [], meses_caixa: [{ competencia: '2026-01', folha_salarios: 7000 }] })[0].competencia === '2025-12');
const fora = folhaDoAno(juntarFolha(null, { meses: ['2025-01', '2025-02', '2025-03'].map(c => mesF(c)) }), '2026-08');
ok('o resumo de outro período: usa os meses dele e avisa', fora.ok && fora.foraDoPeriodo && fora.ate === '2025-03');
const apF = aplicarFolha({ folha: 0, proLabore: 0, atividades: [] }, { folha: { fonte: 'padrao' } }, aF);
ok('na entrada: a folha e o pró-labore, a origem no relatório do Domínio com o período', apF.entrada.folha === 130000 && apF.entrada.proLabore === 60000 && apF.origens.folha.fonte === 'dominio'
  && apF.origens.folha.texto === 'resumo da folha do Domínio de set/25 a ago/26' && apF.origens.proLabore.fonte === 'dominio' && !apF.notas.length, apF.origens);
const apSo = aplicarFolha({}, {}, aSo);
ok('sem pró-labore no resumo: zero, a origem diz, e a nota pede pra conferir', apSo.entrada.proLabore === 0 && /sem pró-labore/.test(apSo.origens.proLabore.texto) && /anualizado/.test(apSo.origens.folha.texto) && apSo.notas.some(n => /não trouxe pró-labore/.test(n)), apSo);
ok('leitura que não deu: a entrada fica como estava', aplicarFolha({ folha: 5 }, {}, { ok: false }).entrada.folha === 5);

console.log('=== o Domínio pela ponte (05/11/2026, a versão 2) ===');
{
  // 12 meses fechados de out/25 a set/26, uma empresa do Presumido: mercadoria e serviço, compras, folha e pró-labore
  const comps = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const PL = (c, x = {}) => ({ codigo: 7, competencia: c, receita_bruta: 100000, receita_mercadorias: 80000, receita_servicos: 20000, receita_simples: null, receita_st: null,
    receita_monofasica: null, receita_exportacao: null, compras: 50000, servicos_tomados: 3000, ativo_e_consumo: 1000, salarios: 20000, decimo_terceiro: 0, pro_labore_valor: 5000, ...x });
  const dom = comps.map(c => PL(c, c === '2025-12' ? { decimo_terceiro: 20000 } : c === '2026-02' ? { receita_bruta: 0, receita_mercadorias: 0, receita_servicos: 0 } : {}));
  dom.push(PL('2026-03', { codigo: 9, receita_bruta: 1, compras: 999999 }));   // o mesmo documento noutro código: fica o maior
  const mp = mesesDaPonte(dom);
  ok('os meses da ponte: um por mês, em ordem; dois códigos: o maior de cada número', mp.length === 12 && mp[0].competencia === '2025-10' && mp[5].receita_bruta === 100000 && mp[5].compras === 999999, mp[5]);
  const sp = seriePonte(mp);
  ok('a receita de 12 meses pela ponte: o mês sem faturamento conta como zero (não anualiza)', sp.n === 12 && sp.npos === 11 && sp.receita === 1100000 && sp.meses && sp.meses[1] === 0 && !sp.simples, sp);
  ok('a soma de 12 meses: anualiza com menos; com menos de 3, nada', somaDaPonte(mp.slice(-6), ['compras']).soma === 600000 && somaDaPonte(mp.slice(-2), ['compras']) === null
    && somaDaPonte(mp, ['salarios', 'decimo_terceiro']).soma === 260000);
  const pres = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '4711-3/02', uf: 'RS' }, dominio: dom,
    fatorR: [{ competencia: '2026-09-01', folha_salarios: 1, folha_outros: 0, prolabore: 0 }] });
  const ativ = pres.entrada.atividades;
  ok('sem PGDAS: a receita do Domínio pela ponte, com a divisão mercadoria × serviço dele', ativ.length === 2 && perto(ativ[0].receita + ativ[1].receita, 1100000) && perto(ativ[0].receita, 880000)
    && pres.origens['atividades.0.receita'].fonte === 'ponte' && pres.origens['atividades.0.receita'].texto === 'Domínio, pela ponte: o faturamento de out/25 a set/26', pres.origens['atividades.0.receita']);
  ok('as compras e as despesas com crédito pela ponte (12 meses; o maior dos dois códigos no mês)', pres.entrada.compras === 11 * 50000 + 999999 && pres.entrada.despesasCredito === 48000
    && pres.origens.compras.fonte === 'ponte' && /compras de mercadorias e insumos de out\/25 a set\/26/.test(pres.origens.compras.texto) && /energia, comunicação, frete/.test(pres.origens.despesasCredito.texto), pres.origens.compras);
  ok('a folha e o pró-labore pela ponte, no lugar do Fator R com menos meses (os proventos com o 13º)', pres.entrada.folha === 260000 && pres.entrada.proLabore === 60000
    && pres.origens.folha.fonte === 'ponte' && /salários, férias, rescisões e 13º de out\/25 a set\/26/.test(pres.origens.folha.texto) && /pró-labore de out\/25/.test(pres.origens.proLabore.texto), pres.origens.folha);
  ok('a série da empresa (o limite, o crescimento): os meses com receita, pela ponte', pres.serie.length === 11 && pres.serie[0].competencia === '2025-10' && pres.ponte && pres.ponte.n === 12);
  const fr12 = comps.map(c => ({ competencia: c + '-01', folha_salarios: 30000, folha_outros: 0, prolabore: 7000 }));
  const comFr = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '4711-3/02' }, dominio: dom.slice(-6), fatorR: fr12 });
  ok('o Fator R com mais meses que a ponte fica', comFr.entrada.folha === 360000 && comFr.origens.folha.fonte === 'fator_r');
  // o Simples: o PGDAS com os mesmos 12 meses vale (o declarado); a divisão e o resto vêm da ponte
  const simp = dom.slice(0, 12).map(l => ({ ...l, receita_bruta: 100000, receita_simples: 120000, receita_anexo_1: 30000, receita_anexo_2: 66000, receita_anexo_3: 24000,
    receita_anexo_4: 0, receita_anexo_5: 0, receita_st: 19200, receita_monofasica: 9600, receita_exportacao: 0 }));
  const pg12 = comps.map(c => ({ competencia: c, receita_mes: 120000 }));
  const s1 = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, pgdas: pg12, dominio: simp });
  ok('PGDAS e ponte com os mesmos meses: o PGDAS vale; a divisão é a do Domínio pela ponte', s1.origens['atividades.0.receita'].fonte === 'pgdas'
    && /a divisão mercadoria × serviço é a do Domínio, pela ponte/.test(s1.origens['atividades.0.receita'].texto) && perto(s1.entrada.atividades[0].receita, 1440000 * 0.8), s1.origens['atividades.0.receita']);
  ok('o anexo de cada receita pela apuração do Simples: o II maior que o I é indústria; o III, serviço', s1.entrada.atividades[0].tipo === 'industria' && s1.entrada.atividades[1].tipo === 'servico'
    && s1.origens['atividades.0.tipo'].fonte === 'ponte' && s1.origens['atividades.0.tipo'].texto === 'Domínio, pela ponte: Anexo II na apuração do Simples', s1.origens['atividades.0.tipo']);
  ok('o ST e o monofásico sobre a receita de mercadoria da apuração (pelos anexos)', perto(s1.entrada.atividades[0].pctST, 20) && perto(s1.entrada.atividades[0].pctMonofasico, 10)
    && s1.origens['atividades.0.pctST'].fonte === 'ponte' && /20% das vendas de mercadoria com ICMS-ST na apuração do Simples/.test(s1.origens['atividades.0.pctST'].texto), [s1.entrada.atividades[0].pctST, s1.origens['atividades.0.pctST']]);
  const s2 = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, pgdas: pg12.slice(-6), dominio: simp });
  const saiu = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '4711-3/02' }, dominio: simp.map((l, i) => (i >= 9 ? { ...l, receita_simples: null, receita_bruta: 100000 } : l)) });
  ok('a empresa que saiu do Simples no meio da janela: o faturamento, com a apuração nos meses do Simples', /Domínio, pela ponte: o faturamento, com a apuração do Simples nos meses em que a empresa estava nele, de out\/25 a set\/26/.test(saiu.origens['atividades.0.receita'].texto)
    && perto(saiu.entrada.atividades.reduce((t, a) => t + a.receita, 0), 9 * 120000 + 3 * 100000), saiu.origens['atividades.0.receita']);
  ok('o PGDAS com menos meses que a ponte: a ponte vale, pela apuração do Simples', s2.origens['atividades.0.receita'].fonte === 'ponte' && /a receita da apuração do Simples de out\/25 a set\/26/.test(s2.origens['atividades.0.receita'].texto)
    && perto(s2.entrada.atividades.reduce((t, a) => t + a.receita, 0), 1440000));
  const fr = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '6201-5/01' }, dominio: simp.map(l => ({ ...l, receita_anexo_1: 0, receita_anexo_2: 0, receita_anexo_3: 120000, receita_mercadorias: 0, receita_servicos: 100000, receita_st: 0, receita_monofasica: 0 })) });
  ok('o serviço no Anexo III com o CNAE do fator r fica no fator r (o motor põe no III ou no V pela folha), sem a nota de trocar o tipo', fr.entrada.atividades.length === 1 && fr.entrada.atividades[0].tipo === 'servico_r'
    && /\(o CNAE é do fator r\)/.test(fr.origens['atividades.0.tipo'].texto) && !fr.notas.some(n => /Serviço no Anexo III/.test(n)), [fr.entrada.atividades, fr.origens['atividades.0.tipo']]);
  const so3 = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '8211-3/00' }, dominio: simp.map(l => ({ ...l, receita_anexo_1: 0, receita_anexo_2: 0, receita_anexo_3: 120000, receita_mercadorias: 0, receita_servicos: 100000, receita_st: 0, receita_monofasica: 0 })) });
  ok('o serviço no Anexo III com outro CNAE: serviço do III, com a nota de conferir o fator r', so3.entrada.atividades[0].tipo === 'servico' && so3.notas.some(n => /Serviço no Anexo III/.test(n)), so3.entrada.atividades);
  const semSt = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, dominio: simp.map(l => ({ ...l, receita_st: 0, receita_exportacao: 5000 })),
    caso: { anexo: 'I', sim_obs: JSON.stringify({ v: 1, input: { anexo: 'I' }, dominio: { vendas: { mercadorias: 100, st: 30, meses: [] } } }) } });
  ok('a ponte sem venda com ST: valem as saídas do caso da Reforma (a venda com ST não separada na apuração)', perto(semSt.entrada.atividades[0].pctST, 30) && semSt.origens['atividades.0.pctST'].fonte === 'reforma');
  ok('a exportação na apuração: a nota pede pra conferir', semSt.notas.some(n => /receita de exportação nos 12 meses/.test(n)));
  const semSt2 = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02' }, dominio: simp.map(l => ({ ...l, receita_st: 0 })) });
  ok('a ponte sem venda com ST e sem o caso: zero, dito', semSt2.entrada.atividades[0].pctST === 0 && /sem venda com ICMS-ST/.test(semSt2.origens['atividades.0.pctST'].texto));
  // as outras empresas dos sócios: a receita pela ponte quando não tem PGDAS
  const rp = receitaDaEmpresa({ cliente: { id: 'g1', nome_principal: 'OUTRA INVENTADA' }, dominio: dom });
  ok('a receita de outra empresa dos sócios pela ponte, com a série', rp.receita === 1100000 && rp.origem.fonte === 'ponte' && rp.serie.length === 11 && serieDaEmpresa({ dominio: dom }).fonte === 'ponte');
  ok('sem nada da ponte, como antes', serieDaEmpresa({ dominio: [] }) === null && entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido' }, dominio: [] }).ponte === null);
  const dDom = dom.map(l => ({ ...l, salarios: null, decimo_terceiro: null, pro_labore_valor: null }));
  ok('a folha que o Domínio não disse (a empresa inativa lá) não vira zero: segue o Fator R ou o padrão', entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido' }, dominio: dDom }).origens.folha.fonte === 'padrao');
}

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
