// Teste do que o comparativo tributário tira do sistema (assets/js/comparativo-dados.js): o caso da Reforma, o Fator R,
// o PGDAS da Receita, o cadastro, os relatórios do Domínio, as premissas a testar, os prazos da escolha, a refeição no RS
// e as outras empresas dos mesmos sócios.
// Rodar com: node tests/comparativo-dados.test.mjs — dados inventados (o repositório é público).

import { entradaDoSistema, aplicarRelatorios, premissasParaTestar, prazosDaEscolha, serieDosMeses, tipoPeloCnae, tipoPeloAnexo, regimeDoCadastro,
  ehRefeicaoRS, ehRdaRS, empresasDosSocios, receitaDaEmpresa, situacaoDoGrupo, serieDaEmpresa, foraDaSoma, avisoDaSoma, mesclarSerie } from '../assets/js/comparativo-dados.js';
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

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
