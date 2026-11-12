// Teste do que o comparativo tributário tira do sistema (assets/js/comparativo-dados.js): o caso da Reforma, o Fator R,
// o PGDAS da Receita, o cadastro, os relatórios do Domínio, as premissas a testar, os prazos da escolha, a refeição no RS
// e as outras empresas dos mesmos sócios.
// Rodar com: node tests/comparativo-dados.test.mjs — dados inventados (o repositório é público).

import { entradaDoSistema, aplicarRelatorios, premissasParaTestar, prazosDaEscolha, exclusaoObrigatoria, ultimoDiaUtil, serieDosMeses, tipoPeloCnae, tipoPeloAnexo, regimeDoCadastro,
  ehRefeicaoRS, ehRdaRS, empresasDosSocios, receitaDaEmpresa, situacaoDoGrupo, serieDaEmpresa, foraDaSoma, avisoDaSoma, mesclarSerie,
  pareceFolha, cnpjsDoCabecalho, juntarFolha, folhaDoAno, aplicarFolha, mesesDaPonte, seriePonte, somaDaPonte, objetivoSugerido, porQueDoObjetivo, objetivoValido, doRegimeGeral, simplesNoEstudo,
  presuncaoPeloCnae, periodoCurto, mesesDeAte, janelaDaReceita, periodoDaDre, dreSugerida,
  CAMPOS_PONTE, CAMPOS_PISCOFINS, CAMPOS_RESULTADO, pisCofinsDaPonte, cstVale, resultadoDaPonte, listaDoResultado, lucroDaPonte, aplicarLucroDaPonte, origemDoLucroDaPonte } from '../assets/js/comparativo-dados.js';
import { comparar, testarPremissas } from '../assets/js/comparativo-motor.js';

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
// 11/11/2026: a nota da folha fala só do INSS do Presumido e do Real (o fator r no Anexo V, o motor avisa com o Simples na
// comparação), e a origem da atividade pelo CNAE manda conferir, sem falar em anexo
ok('a nota da folha não fala do Simples', semNada.notas.some(n => n === 'A folha e o pró-labore não estão no sistema: sem eles, o INSS do Presumido e do Real sai zero.') && !semNada.notas.some(n => /fator r|Anexo|Simples/.test(n)), semNada.notas);
ok('a atividade pelo CNAE: a origem manda conferir, sem o anexo', semNada.origens['atividades.0.tipo'].fonte === 'cadastro' && semNada.origens['atividades.0.tipo'].texto === 'pelo CNAE do cadastro (6201-5/01) — confira', semNada.origens['atividades.0.tipo']);
ok('as notas só do Simples vêm à parte (aqui, nenhuma)', Array.isArray(semNada.notasSimples) && semNada.notasSimples.length === 0);

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
  ok('a nota do anexo é só do Simples: sai da lista quando ele não está na comparação', so3.notasSimples.length === 1 && /^Serviço no Anexo III no PGDAS/.test(so3.notasSimples[0]) && so3.notas.includes(so3.notasSimples[0]) && fr.notasSimples.length === 0);
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

console.log('=== qual comparativo: a sugestão do sistema (11/11/2026) ===');
{
  const vedado = { vedado: true, impedimentos: [{ texto: 'x', base: 'y' }] }, livre = { vedado: false, impedimentos: [] };
  ok('a empresa do Presumido ou do Real: só os dois', objetivoSugerido('presumido') === 'presumido_real' && objetivoSugerido('real', livre) === 'presumido_real');
  ok('a do Simples, a do MEI e a sem regime no cadastro: os três', objetivoSugerido('simples') === 'todos' && objetivoSugerido('mei', livre) === 'todos' && objetivoSugerido(null) === 'todos');
  ok('com o Simples vedado pelo cadastro, só os dois — mesmo sem o regime', objetivoSugerido('simples', vedado) === 'presumido_real' && objetivoSugerido(null, vedado) === 'presumido_real');
  ok('o porquê: o regime de hoje', porQueDoObjetivo('presumido') === 'A empresa está no Lucro Presumido: a escolha de todo ano é entre o Presumido e o Real.' && porQueDoObjetivo('simples') === 'A empresa está no Simples Nacional: ficar ou sair é a pergunta.');
  ok('o porquê: o Simples vedado, na empresa do Simples e na sem regime', porQueDoObjetivo('simples', vedado) === 'A empresa está no Simples Nacional e o Simples está vedado pra ela.' && porQueDoObjetivo(null, vedado) === 'O Simples está vedado pra ela.');
  // pedido do Samuel, 11/11/2026: "se não estou querendo um comparativo que envolva o simples, não é de uma empresa do
  // simples, pra que aparecer isso?" — na empresa do regime geral, o motivo da sugestão é o regime dela, não o Simples
  ok('o porquê na empresa do regime geral: o regime dela, mesmo com o Simples vedado', porQueDoObjetivo('presumido', vedado) === 'A empresa está no Lucro Presumido: a escolha de todo ano é entre o Presumido e o Real.'
    && porQueDoObjetivo('real', vedado) === 'A empresa está no Lucro Real: a escolha de todo ano é entre o Presumido e o Real.' && !/Simples/.test(porQueDoObjetivo('presumido', vedado)));
  ok('a empresa do regime geral: Presumido ou Real', doRegimeGeral('presumido') && doRegimeGeral('real') && !doRegimeGeral('simples') && !doRegimeGeral('mei') && !doRegimeGeral(null) && !doRegimeGeral(undefined));
  ok('o Simples no estudo: com ele no comparativo, sempre', simplesNoEstudo('todos', 'presumido') && simplesNoEstudo('todos', 'real') && simplesNoEstudo('todos', 'simples') && simplesNoEstudo('todos', null));
  ok('só o Presumido contra o Real: o Simples só é assunto se for o regime de hoje (ou sem regime)', !simplesNoEstudo('presumido_real', 'presumido') && !simplesNoEstudo('presumido_real', 'real')
    && simplesNoEstudo('presumido_real', 'simples') && simplesNoEstudo('presumido_real', 'mei') && simplesNoEstudo('presumido_real', null));
  ok('com a pergunta ainda aberta, vale o regime de hoje', !simplesNoEstudo(null, 'presumido') && !simplesNoEstudo(undefined, 'real') && simplesNoEstudo(null, 'simples') && simplesNoEstudo(null, null));
  ok('o porquê sem o regime no cadastro', porQueDoObjetivo(null) === 'Sem o regime de hoje no cadastro, a conta mostra os três.');
  ok('só os dois comparativos valem', objetivoValido('todos') === 'todos' && objetivoValido('presumido_real') === 'presumido_real' && objetivoValido('simples') === null && objetivoValido(null) === null && objetivoValido('__proto__') === null);

  // os prazos por comparativo
  const pG = prazosDaEscolha('2026-11-11', 'presumido', 2027, null, { objetivo: 'presumido_real' });
  ok('Presumido × Real: sem o prazo de entrar no Simples, e a escolha que vale pro ano inteiro', pG.length === 1 && pG[0].titulo === 'Presumido ou Real em 2027'
    && /A escolha vale pro ano inteiro: não dá pra trocar no meio de 2027 \(Lei 9\.718, art\. 13, §1º; Lei 9\.430, art\. 3º\)\.$/.test(pG[0].texto), pG);
  const pT = prazosDaEscolha('2026-11-11', 'presumido', 2027, null, { objetivo: 'todos' });
  ok('com o Simples: a janela de entrada (a de 2027 fechou em 30/09/2026) e o Presumido ou Real sem a frase do ano inteiro', pT.length === 2 && pT[0].titulo === 'Entrar no Simples' && /A janela de 2027 fechou em 30\/09\/2026/.test(pT[0].texto)
    && !/vale pro ano inteiro/.test(pT[1].texto), pT);
  ok('com o Simples vedado: antes, tirar os impedimentos', /Antes, a empresa precisa tirar os impedimentos do cadastro\.$/.test(prazosDaEscolha('2026-11-11', 'presumido', 2027, null, { objetivo: 'todos', vedado: true })[0].texto)
    && /Antes, a empresa precisa tirar os impedimentos do cadastro\.$/.test(prazosDaEscolha('2026-08-11', 'real', 2027, null, { vedado: true })[0].texto));
  ok('sem as opções, como antes (com o Simples)', prazosDaEscolha('2026-11-11', 'presumido', 2027).length === 2);
  const pS = prazosDaEscolha('2026-11-11', 'simples', 2027, null, { objetivo: 'presumido_real' });
  ok('a do Simples que compara só o Presumido com o Real: o prazo de sair fica, o do IBS/CBS por fora sai', pS.some(x => x.titulo === 'Sair do Simples em 2027') && !pS.some(x => /IBS\/CBS por fora/.test(x.titulo)) && pS.some(x => x.titulo === 'Presumido ou Real em 2027'));

  // as premissas a testar por comparativo
  const eG = { atividades: [{ tipo: 'comercio', receita: 1000000, aliqIcms: 17, pctMonofasico: 0, redIcmsSimples: 40 }], compras: 500000, aliqCreditoIcms: 12, regimeAtual: 'presumido' };
  const eS = { ...eG, regimeAtual: 'simples' };
  const tT = premissasParaTestar(eS, {}), tG = premissasParaTestar(eG, {}, ['presumido', 'real']);
  ok('a do Simples que compara os três: a redução do ICMS no DAS vale teste, a alíquota zero de PIS/Cofins não (no Simples ela paga no DAS)', tT.some(t => t.campo === 'atividades.0.redIcmsSimples')
    && !tT.some(t => /pctAliqZero|pctMonofasico/.test(t.campo)) && premissasParaTestar(eS, {}, ['simples', 'presumido', 'real']).length === tT.length, tT.map(t => t.campo));
  const tP = premissasParaTestar(eG, {});
  ok('a do Presumido que compara os três: a alíquota zero vale teste (o PIS/Cofins de hoje entra no lucro do Real pela DRE), com o que mexe no DAS', tP.some(t => t.campo === 'atividades.0.pctAliqZero')
    && tP.some(t => t.campo === 'atividades.0.redIcmsSimples') && tP.length === tT.length + 1, tP.map(t => t.campo));
  ok('a do Simples que compara só o Presumido com o Real: a alíquota zero também vale teste', premissasParaTestar(eS, {}, ['presumido', 'real']).some(t => t.campo === 'atividades.0.pctAliqZero'));
  const zero = tG.find(t => t.campo === 'atividades.0.pctAliqZero');
  ok('Presumido × Real: sem o que só mexe no DAS, e com as vendas com alíquota zero de PIS/Cofins (100%), com o que conferir', !tG.some(t => /redIcmsSimples|pctMonofasico/.test(t.campo)) && zero && zero.valores.join() === '100'
    && zero.rotulo === 'as vendas com alíquota zero de PIS/Cofins' && /confira se o produto tem alíquota zero \(a Lei 10\.925\/2004: óleos vegetais, arroz, carnes, leite, higiene…\) ou é monofásico\.$/.test(zero.confira), tG.map(t => t.campo));
  // com duas atividades, o teste diz de qual é: com o Simples na comparação, o serviço leva o anexo; sem ele, é "serviços"
  const eDuas = { ...eG, atividades: [eG.atividades[0], { tipo: 'servico_r', receita: 200000, aliqIss: 3 }] };
  const issG = premissasParaTestar(eDuas, {}, ['presumido', 'real']).find(t => t.campo === 'atividades.1.aliqIss'), issT = premissasParaTestar(eDuas, {}).find(t => t.campo === 'atividades.1.aliqIss');
  ok('o nome da atividade no teste do ISS: "serviços" no Presumido × Real, com o anexo quando o Simples está na comparação', issG && issG.rotulo === 'o ISS (serviços)' && issT && issT.rotulo === 'o ISS (serviços do fator r (anexo v ou iii))'
    && !premissasParaTestar(eDuas, {}, ['presumido', 'real']).some(t => /anexo|fator r/i.test(t.rotulo) || /\bDAS\b/.test(t.rotulo)), premissasParaTestar(eDuas, {}, ['presumido', 'real']).map(t => t.rotulo));
  const comAtiv = a => ({ ...eG, atividades: [{ ...eG.atividades[0], ...a }] });
  ok('informada, já com parte em alíquota zero ou com toda a venda monofásica, a alíquota zero não entra no teste; com parte monofásica, entra',
    !premissasParaTestar(eG, { 'atividades.0.pctAliqZero': { fonte: 'confirmado' } }, ['presumido', 'real']).some(t => /pctAliqZero/.test(t.campo))
    && !premissasParaTestar(comAtiv({ pctAliqZero: 30 }), {}, ['presumido', 'real']).some(t => /pctAliqZero/.test(t.campo))
    && !premissasParaTestar(comAtiv({ pctMonofasico: 100 }), {}, ['presumido', 'real']).some(t => /pctAliqZero/.test(t.campo))
    && premissasParaTestar(comAtiv({ pctMonofasico: 30 }), {}, ['presumido', 'real']).some(t => /pctAliqZero/.test(t.campo)));
  // o teste com o lucro da contabilidade: a DRE já descontou o PIS/Cofins de hoje (30.295). Com a DRE em R$ 115.000, o lucro
  // do Real de 2027 é 115.000 + 140.295 − 154.070 = 101.225 (acima do empate de 95.000: Presumido); com alíquota zero em
  // toda a venda (fora da Cesta Básica Nacional: 10% da alíquota de abril a dezembro, LC 224 — 0,365% × 830.000 × 9/12 =
  // 2.272,125), os tributos de hoje caem pra 112.272,125 e o lucro, pra 115.000 + 112.272,125 − 154.070 = 73.202,125
  // (abaixo do empate: Real) — a premissa vira o resultado
  const e115 = { ...eG, lucroContabil: 115000, regimes: ['presumido', 'real'] };
  const c115 = comparar(e115);
  ok('a conta à mão: com a DRE em R$ 115.000, lucro do Real de 2027 em R$ 101.225 e o Presumido mais barato', perto(c115.anos[1].real.lucro, 101225) && c115.decisao.melhor === 'presumido');
  const v115 = testarPremissas(e115, premissasParaTestar(e115, {}, ['presumido', 'real'])).find(t => /pctAliqZero/.test(t.campo));
  ok('com alíquota zero em toda a venda, o lucro do Real cai pra R$ 73.202,13 e o mais barato vira o Real', v115.muda && v115.variantes[0].melhor === 'real' && perto(v115.variantes[0].totais.real, 110000 + 44070 + 0.24 * 73202.125, 0.02), v115.variantes);

  // o que o sistema diz do lucro da contabilidade e das vendas sem PIS/Cofins ao abrir a empresa
  const sisG = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '4711-3/02', uf: 'RS' } });
  ok('o lucro da contabilidade falta no sistema (a DRE), e as vendas com alíquota zero de PIS/Cofins ficam no padrão a conferir', sisG.origens.lucroContabil.fonte === 'padrao' && /^falta no sistema: a DRE$/.test(sisG.origens.lucroContabil.texto)
    && sisG.origens['atividades.0.pctAliqZero'].fonte === 'padrao' && /nenhuma — confira/.test(sisG.origens['atividades.0.pctAliqZero'].texto) && /Lei 10\.925\/2004/.test(sisG.origens['atividades.0.pctAliqZero'].dica)
    && /No Simples, paga no DAS/.test(sisG.origens['atividades.0.pctAliqZero'].dica) && /as da Cesta Básica Nacional \(LC 214, Anexos I e XV\) seguem com zero; as outras pagam 10% da alíquota desde abril de 2026 \(LC 224\/2025\)/.test(sisG.origens['atividades.0.pctAliqZero'].dica) && sisG.origens.ajustesLalur.fonte === 'padrao', sisG.origens['atividades.0.pctAliqZero']);
}

console.log('=== o RAT e terceiros pelas guias do Domínio (a ponte), na empresa do Presumido ou do Real ===');
{
  // 12 meses: folha de R$ 10.000, base do INSS dos empregados de R$ 10.000, RAT de R$ 150 (1,5% com o FAP) e terceiros de R$ 580 (5,8%)
  const guia = (extra = {}) => Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); return { codigo: 1, competencia: d.toISOString().slice(0, 7), receita_bruta: 100000, receita_mercadorias: 100000, receita_servicos: 0,
    salarios: 10000, decimo_terceiro: 0, pro_labore_valor: 3000, base_inss: 10000, inss_rat: 150, inss_terceiros: 580, ...extra }; });
  const g = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Presumido', cnae_principal: '4711-3/02', uf: 'RS' }, dominio: guia() });
  ok('no Presumido: o RAT (1,5%, já com o FAP) e terceiros (5,8%) das guias, com a origem da ponte', g.entrada.rat === 1.5 && g.entrada.fap === 1 && g.entrada.terceiros === 5.8 && g.origens.rat.fonte === 'ponte' && g.origens.terceiros.fonte === 'ponte' && g.origens.fap.fonte === 'ponte'
    && g.origens.rat.texto === 'Domínio, pela ponte: RAT com o FAP de 1,5% nas guias de out/25 a set/26' && g.origens.terceiros.texto === 'Domínio, pela ponte: 5,8% nas guias de out/25 a set/26', [g.entrada.rat, g.entrada.terceiros, g.origens.rat]);
  ok('com o RAT da ponte, ele não vai pro teste das premissas', !premissasParaTestar({ ...g.entrada, folha: 120000 }, g.origens).some(t => t.campo === 'rat') && premissasParaTestar({ ...g.entrada, folha: 120000 }, { ...g.origens, rat: { fonte: 'padrao' } }).some(t => t.campo === 'rat'));
  const s = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', uf: 'RS' }, dominio: guia({ inss_rat: 0, inss_terceiros: 0, receita_simples: 100000 }) });
  ok('no Simples a guia não tem o RAT (a CPP está no DAS): fica o padrão', s.entrada.rat === undefined && s.origens.rat.fonte === 'padrao' && s.origens.terceiros.fonte === 'padrao');
  ok('guia com RAT zerado, fora da faixa ou sem a base: fica o padrão', entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real' }, dominio: guia({ inss_rat: 0 }) }).origens.rat.fonte === 'padrao'
    && entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real' }, dominio: guia({ inss_rat: 900 }) }).origens.rat.fonte === 'padrao' && entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real' }, dominio: guia({ base_inss: 0 }) }).origens.rat.fonte === 'padrao'
    && entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real' }, dominio: guia({ base_inss: null, inss_rat: null, inss_terceiros: null }) }).origens.rat.fonte === 'padrao');
  ok('no Real, com o RAT de 3%', entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real' }, dominio: guia({ inss_rat: 300 }) }).entrada.rat === 3);
}

console.log('=== a atividade pelas notas do Domínio e a presunção própria do CNAE (11/11/2026) ===');
{
  // Pedido do Samuel: "como temos acesso nas notas fiscais pela ponte da domínio, não ficaria mais fácil para o próprio
  // sistema apurar essa informação?" — a venda de mercadoria × serviço sai das notas; o que elas não dizem, o CNAE acusa
  const comps = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const dom = (merc, serv, x = {}) => comps.map(c => ({ codigo: 7, competencia: c, receita_bruta: merc + serv, receita_mercadorias: merc, receita_servicos: serv, receita_simples: null,
    compras: 20000, servicos_tomados: 0, ativo_e_consumo: 0, salarios: 0, decimo_terceiro: 0, pro_labore_valor: 0, ...x }));
  const PRES = 'Lucro Presumido';
  const ind = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '1099-6/99 - Fabricação de outros produtos alimentícios', uf: 'RS' }, dominio: dom(50000, 0) });
  ok('a divisão medida nas notas: de onde veio, o período e as partes', ind.divisao && ind.divisao.fonte === 'ponte' && ind.divisao.de === '2025-10' && ind.divisao.ate === '2026-09' && ind.divisao.n === 12
    && ind.divisao.mercadorias === 600000 && ind.divisao.servicos === 0 && ind.lida === true && ind.especial === null, ind.divisao);
  const oInd = ind.origens['atividades.0.tipo'];
  ok('a indústria com 100% de mercadoria nas notas: a origem da atividade é a ponte, sem mandar conferir', ind.entrada.atividades.length === 1 && ind.entrada.atividades[0].tipo === 'industria' && oInd.fonte === 'ponte'
    && oInd.texto === 'Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é venda de mercadoria' && !/confira/.test(oInd.texto) && /comércio ou indústria, pelo CNAE do cadastro \(1099-6\/99 - Fabricação/.test(oInd.dica), oInd);
  ok('o anexo, que as notas não dizem, fica à parte (só pra quando o Simples está no estudo)', oInd.simples === 'o anexo, pelo CNAE do cadastro (1099-6/99 - Fabricação de outros produtos alimentícios): confira'
    && !/[Aa]nexo|Simples/.test(oInd.texto + oInd.dica), oInd.simples);
  const mis = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '8020-0/01', uf: 'RS' }, dominio: dom(14, 36000) });
  ok('serviço com um resto de mercadoria: cada linha com a parte dela nas notas', mis.entrada.atividades.length === 2 && mis.origens['atividades.0.tipo'].texto === 'Domínio, pela ponte: 0,04% da receita das notas de out/25 a set/26 é venda de mercadoria'
    && mis.origens['atividades.1.tipo'].texto === 'Domínio, pela ponte: 99,96% da receita das notas de out/25 a set/26 é de serviço' && mis.origens['atividades.0.tipo'].simples === 'o anexo está no padrão: confira',
    [mis.origens['atividades.0.tipo'], mis.origens['atividades.1.tipo']]);
  const sem = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '4754-7/01 - Comércio varejista de móveis', uf: 'RS' } });
  ok('sem a ponte: sem medida, a atividade pelo CNAE do cadastro, com a dica do que conferir', sem.divisao === null && sem.lida === false && sem.origens['atividades.0.tipo'].fonte === 'cadastro'
    && sem.origens['atividades.0.tipo'].texto === 'pelo CNAE do cadastro (4754-7/01 - Comércio varejista de móveis) — confira' && /venda de mercadoria \(no Presumido, presume 8% no IRPJ e 12% na CSLL\) ou serviço \(32% nos dois\)/.test(sem.origens['atividades.0.tipo'].dica));
  const zerada = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '6462-0/00', uf: 'RS' }, dominio: dom(0, 0) });
  ok('a ponte leu e o Domínio não tem nota: sem medida, mas lida', zerada.divisao === null && zerada.lida === true && zerada.especial.id === 'holding');
  // o Simples com a apuração no Domínio: o anexo apurado segue sendo a origem; a divisão é medida do mesmo jeito
  const simp = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4754-7/01', uf: 'RS' },
    dominio: dom(50000, 0, { receita_simples: 50000, receita_anexo_1: 50000, receita_anexo_2: 0, receita_anexo_3: 0, receita_anexo_4: 0, receita_anexo_5: 0 }) });
  ok('com a apuração do Simples, a origem é o anexo apurado (sem a parte "confira o anexo")', simp.origens['atividades.0.tipo'].texto === 'Domínio, pela ponte: Anexo I na apuração do Simples' && !simp.origens['atividades.0.tipo'].simples && simp.divisao.fonte === 'ponte');
  ok('o período curto: sem o "anualizado"; com menos de 12 meses, diz quantos', periodoCurto({ de: '2025-10', ate: '2026-09', n: 12 }) === 'out/25 a set/26' && periodoCurto({ de: '2026-05', ate: '2026-09', n: 5 }) === 'mai/26 a set/26 (5 meses)'
    && periodoCurto({ de: '2026-09', ate: '2026-09', n: 1 }) === 'set/26 a set/26 (1 mês)');
  // o relatório solto na tela que separa as saídas dos serviços também diz a atividade
  const mesesRel = comps.map(c => ({ competencia: c, saidas: 70000, servicos: 30000, total: 100000 }));
  const rel = aplicarRelatorios(sem.entrada, sem.origens, { resVen: { meses: mesesRel }, campos: {} });
  ok('o relatório de saídas e serviços solto na tela: cada linha com a atividade dita por ele', rel.entrada.atividades.length === 2 && rel.origens['atividades.0.tipo'].fonte === 'dominio'
    && rel.origens['atividades.0.tipo'].texto === 'venda de mercadoria, pelas saídas e serviços do Domínio de out/25 a set/26' && /^serviço, pelas saídas e serviços do Domínio/.test(rel.origens['atividades.1.tipo'].texto), rel.origens['atividades.0.tipo']);

  // a presunção própria pelo CNAE principal (Lei 9.249/1995, arts. 15 e 20)
  const P = c => presuncaoPeloCnae(c);
  ok('comércio, indústria e serviço comuns: sem presunção própria', [null, '', '47', '4754-7/01', '1042-2/00', '8020-0/01', '6920-6/01', '0161-0/03', '4732-6/00', '8630-5/03', '8650-0/02', '6821-8/01'].every(c => P(c) === null));
  ok('a revenda de combustível (o posto e o GLP): 1,6% e 12%, só na parte do combustível', ['4731-8/00', '4784-9/00 - Comércio varejista de GLP'].every(c => P(c).id === 'combustivel' && P(c).irpj === 1.6 && P(c).csll === 12 && P(c).toda === false)
    && /SC Cosit 25\/2023/.test(P('4784-9/00').base) && P('4784-9/00 - Comércio varejista de GLP').cnae === '4784-9/00');
  ok('o transporte de carga: 8% e 12%, na receita toda', ['4930-2/02', '4911-6/00', '5011-4/01', '5012-2/01', '5021-1/02', '5120-0/00'].every(c => P(c).id === 'carga' && P(c).irpj === 8 && P(c).csll === 12 && P(c).toda === true));
  ok('o transporte de passageiros: 16% e 12%, na receita toda', ['4929-9/01', '4921-3/01', '4922-1/02', '4923-0/01', '4924-8/00', '4912-4/03', '4950-7/00', '5011-4/02', '5012-2/02', '5022-0/01', '5091-2/01', '5099-8/01', '5111-1/00', '5112-9/01']
    .every(c => P(c).id === 'passageiros' && P(c).irpj === 16 && P(c).csll === 12 && P(c).toda === true));
  ok('o hospital e o diagnóstico: 8% e 12% com os requisitos (a conferir); a consulta fica de fora', ['8610-1/01', '8640-2/02', '8630-5/01', '8630-5/02', '8630-5/07'].every(c => P(c).id === 'hospitalar' && P(c).irpj === 8 && P(c).csll === 12 && !P(c).toda)
    && /sociedade empresária e segue as normas da Anvisa/.test(P('8610-1/01').regra));
  ok('a construção (41 a 43): 8% e 12% com todos os materiais; a incorporação é atividade imobiliária', ['4120-4/00', '4211-1/01', '4321-5/00', '4399-1/03'].every(c => P(c).id === 'construcao' && !P(c).toda) && P('4110-7/00').id === 'imoveis');
  ok('os imóveis próprios e a holding', ['6810-2/01', '6810-2/02', '6810-2/03'].every(c => P(c).id === 'imoveis') && ['6461-1/00', '6462-0/00', '6463-8/00'].every(c => P(c).id === 'holding' && P(c).irpj === null));
  ok('toda regra diz o que é, a base legal e, quando depende da empresa, o que fazer', ['4731-8/00', '4930-2/02', '4929-9/01', '8610-1/01', '4120-4/00', '6810-2/01', '6462-0/00'].every(c => { const x = P(c); return x.nome && x.regra && x.base && (x.toda || x.fazer) && !('cnaes' in x) && !('divisoes' in x); }));
  // o transporte entra na conta sozinho: o de passageiros em toda linha; o de carga, só na que não é 8% e 12%
  const pass = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '4929-9/01', uf: 'RS' }, dominio: dom(0, 40000) });
  ok('o transporte de passageiros: 16 e 12 na atividade, com a origem pelo CNAE e a base na dica', pass.especial.id === 'passageiros' && pass.entrada.atividades[0].presIrpj === 16 && pass.entrada.atividades[0].presCsll === 12
    && pass.origens['atividades.0.presIrpj'].fonte === 'cadastro' && pass.origens['atividades.0.presIrpj'].texto === 'pelo CNAE: transporte de passageiros' && /Lei 9\.249\/1995, art\. 15, §1º, II/.test(pass.origens['atividades.0.presCsll'].dica), pass.origens['atividades.0.presIrpj']);
  const cargaServ = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '4930-2/02', uf: 'RS' }, dominio: dom(30000, 10000) });
  ok('o transporte de carga: o conhecimento (mercadoria) já é 8 e 12; a nota de serviço passa a ser', cargaServ.entrada.atividades[0].presIrpj === undefined && !cargaServ.origens['atividades.0.presIrpj']
    && cargaServ.entrada.atividades[1].presIrpj === 8 && cargaServ.entrada.atividades[1].presCsll === 12 && cargaServ.origens['atividades.1.presIrpj'].texto === 'pelo CNAE: transporte de carga');
  const obra = entradaDoSistema({ cliente: { regime_tributario: PRES, cnae_principal: '4120-4/00', uf: 'RS' }, dominio: dom(0, 80000) });
  ok('a obra depende do contrato: o sistema não troca a presunção sozinho', obra.especial.id === 'construcao' && obra.entrada.atividades[0].presIrpj === undefined && !obra.origens['atividades.0.presIrpj']);
}

console.log('=== o lucro da contabilidade até onde ela está feita (11/11/2026, 20h11) ===');
{
  // a receita de out/25 a set/26, mês a mês (R$ 600.000 no total); a contabilidade está feita até jul/26
  const comps = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const valores = [10000, 40000, 50000, 20000, 30000, 60000, 70000, 40000, 110000, 50000, 70000, 50000];
  const serie = comps.map((c, i) => ({ competencia: c, total: valores[i] }));
  ok('os meses do calendário de um a outro, os dois dentro', mesesDeAte('2025-11', '2026-02').join() === '2025-11,2025-12,2026-01,2026-02' && mesesDeAte('2026-07', '2026-07').join() === '2026-07'
    && mesesDeAte('2026-08', '2026-07').length === 0 && mesesDeAte('x', '2026-07').length === 0 && mesesDeAte('2020-01', '2030-12').length === 60);
  const j = janelaDaReceita(serie);
  ok('a janela da receita: de outubro a setembro, 12 meses, R$ 600.000', j.de === '2025-10' && j.ate === '2026-09' && j.meses.length === 12 && perto(j.receita, 600000) && perto(j.anual, 600000) && j.porMes.get('2026-06') === 110000);
  ok('sem a série, sem a janela', janelaDaReceita(null) === null && janelaDaReceita([]) === null && janelaDaReceita([{ competencia: '2026-01', total: 0 }]) === null);
  // a série com mais de 12 meses: só os 12 do calendário até o último
  ok('a série mais longa: os 12 meses até o último', (() => { const x = janelaDaReceita([{ competencia: '2025-08', total: 9 }, { competencia: '2025-09', total: 9 }, ...serie]); return x.de === '2025-10' && x.meses.length === 12 && perto(x.receita, 600000); })());
  // a empresa nova (5 meses): a receita vai a 12 meses
  const nova = serie.slice(7);
  ok('a empresa de 5 meses: a receita levada a 12', (() => { const x = janelaDaReceita(nova); return x.de === '2026-05' && x.meses.length === 5 && perto(x.receita, 320000) && perto(x.anual, 768000); })());

  // a DRE que o estudo pede: até onde a contabilidade está feita, dentro da janela
  const s = dreSugerida(serie, { faz: true, feitaAte: '2026-07' });
  ok('a DRE a pedir: de outubro a julho, 10 dos 12 meses, faltando agosto e setembro', s.de === '2025-10' && s.ate === '2026-07' && s.meses === 10 && s.total === 12 && s.faltam.join() === '2026-08,2026-09' && s.antes === false, s);
  ok('a contabilidade em dia (ou adiantada): a DRE dos 12 meses', dreSugerida(serie, { faz: true, feitaAte: '2026-09' }).ate === '2026-09' && dreSugerida(serie, { faz: true, feitaAte: '2026-10' }).faltam.length === 0);
  ok('a contabilidade parada antes da janela (ou sem mês feito): nenhum mês da receita', (() => { const a = dreSugerida(serie, { faz: true, feitaAte: '2025-09' }), b = dreSugerida(serie, { faz: true, feitaAte: null });
    return a.antes && a.ate === null && a.meses === 0 && a.faltam.length === 12 && b.antes; })());
  ok('sem o Controle, ou com a contabilidade fora do escritório: a janela inteira; sem a série, nada', dreSugerida(serie, null).ate === '2026-09' && dreSugerida(serie, { faz: false, feitaAte: null }).ate === '2026-09' && dreSugerida(null, { faz: true, feitaAte: '2026-07' }) === null);

  // o período da DRE do estudo e o fator que leva o lucro aos 12 meses: a receita dos 12 ÷ a dos meses da DRE
  // de outubro a julho, R$ 480.000 dos R$ 600.000: fator 1,25
  const p = periodoDaDre(serie, { lucroContabil: 40000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 1 });
  ok('a DRE de outubro a julho: 10 meses, R$ 480.000 de receita, fator 1,25 (a receita de hoje, não a guardada)', p.de === '2025-10' && p.ate === '2026-07' && p.meses === 10 && perto(p.receita, 480000) && perto(p.fator, 1.25, 1e-9)
    && p.completo === false && p.faltam.join() === '2026-08,2026-09' && p.janela.meses === 12 && p.guardada === false, p);
  const p12 = periodoDaDre(serie, { lucroContabil: 40000 });
  ok('sem o período, a DRE é a dos 12 meses: fator 1', p12.de === '2025-10' && p12.ate === '2026-09' && p12.fator === 1 && p12.completo === true && p12.faltam.length === 0);
  ok('o período virado (de depois do até) vale como sem período', periodoDaDre(serie, { lucroDe: '2026-09', lucroAte: '2026-01' }).fator === 1);
  // a janela andou um mês (a receita agora vai de nov/25 a out/26): o período guardado saiu dela, e vale a receita guardada
  const serie2 = [...serie.slice(1), { competencia: '2026-10', total: 60000 }];
  const pg = periodoDaDre(serie2, { lucroContabil: 40000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 480000 });
  ok('o período que saiu da janela: a receita guardada com o lucro, e a margem dela na receita de hoje (650.000 ÷ 480.000)', pg.guardada === true && perto(pg.receita, 480000) && perto(pg.fator, 650000 / 480000, 1e-9) && pg.faltam.join() === '2026-08,2026-09,2026-10', pg);
  ok('fora da janela e sem a receita guardada: pelo tempo (12 ÷ os meses da DRE)', perto(periodoDaDre(serie2, { lucroDe: '2025-10', lucroAte: '2026-07' }).fator, 1.2, 1e-9));
  // a empresa nova: a DRE dos 5 meses vai a 12 pela receita anualizada (768.000 ÷ 320.000 = 2,4)
  ok('a empresa de 5 meses: a DRE deles vai a 12 meses (fator 2,4)', perto(periodoDaDre(nova, { lucroContabil: 1 }).fator, 2.4, 1e-9) && periodoDaDre(nova, { lucroContabil: 1 }).completo === true);
  // o "e se" do assistente: o número já é o dos 12 meses
  ok('o lucro marcado como dos 12 meses (o "e se"): fator 1, mesmo na empresa nova', periodoDaDre(nova, { lucroContabil: 1, lucroAnual: true }).fator === 1 && periodoDaDre(serie, { lucroAnual: true, lucroDe: '2025-10', lucroAte: '2026-07' }).fator === 1);
  // sem a série (o estudo digitado à mão): só com o período e a receita que o estudo guardou
  ok('sem a série: sem o período, nada; com ele e a receita guardada, a margem na receita do estudo', periodoDaDre(null, { lucroContabil: 1 }) === null
    && perto(periodoDaDre(null, { lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 480000, atividades: [{ receita: 600000 }] }).fator, 1.25, 1e-9)
    && periodoDaDre(null, { lucroDe: '2025-10', lucroAte: '2026-07' }).fator === 1);
  // os meses sem receita no período: o fator vai pelo tempo
  ok('a DRE de um mês sem receita no sistema: sem a margem, vai pelo tempo (12 ÷ 1)', (() => { const x = periodoDaDre([{ competencia: '2025-12', total: 100 }, { competencia: '2026-02', total: 100 }], { lucroDe: '2026-01', lucroAte: '2026-01' });
    return x.fator === 12 && x.meses === 1 && x.receita === null && x.guardada === false; })());
}

console.log('=== o resultado da contabilidade pela ponte do Domínio (11/11/2026, a versão 5): o lucro até onde ela está feita ===');
{
  // a receita de out/25 a set/26 (R$ 600.000); o resultado do Domínio mês a mês — novembro com prejuízo, e o IRPJ e a CSLL
  // lançados à parte; a contabilidade feita até jul/26
  const comps = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const valores = [10000, 40000, 50000, 20000, 30000, 60000, 70000, 40000, 110000, 50000, 70000, 50000];
  const serie = comps.map((c, i) => ({ competencia: c, total: valores[i] }));
  const res = [1500.10, -2300.55, 4200, 900.45, 2100, 6100, 7300, 3800, 9900, 4500, 2500, 1200];
  const linhas = comps.map((c, i) => ({ codigo: 7, competencia: c, resultado_antes_ir: res[i], irpj_csll_lancados: 100, receitas_financeiras: 10, lanc_resultado: 20 + i }));
  const ctb = { faz: true, feitaAte: '2026-07' };
  ok('os campos do resultado e os do PIS/Cofins (os nove do CST entram nos da ponte)', CAMPOS_RESULTADO.join() === 'resultado_antes_ir,irpj_csll_lancados,receitas_financeiras,lanc_resultado'
    && CAMPOS_PISCOFINS.length === 9 && CAMPOS_PISCOFINS.every(c => CAMPOS_PONTE.includes(c)) && !CAMPOS_RESULTADO.some(c => CAMPOS_PONTE.includes(c)));
  const m = resultadoDaPonte(linhas);
  ok('o resultado mês a mês: os 12 meses, com o prejuízo de novembro', m.size === 12 && m.get('2025-11').resultado === -2300.55 && m.get('2025-11').lancamentos === 21 && m.get('2025-10').ircs === 100 && m.get('2025-10').financeiras === 10);
  ok('o mês que a ponte não leu (lanc_resultado nulo) fica de fora; o sem lançamento entra com o resultado nulo, nunca zero', (() => {
    const x = resultadoDaPonte([{ competencia: '2026-01', lanc_resultado: null, resultado_antes_ir: 5 }, { competencia: '2026-02', lanc_resultado: 0, resultado_antes_ir: null }, { competencia: 'x', lanc_resultado: 3 }, null]);
    return x.size === 1 && x.get('2026-02').lancamentos === 0 && x.get('2026-02').resultado === null; })());
  ok('dois códigos do Domínio na mesma empresa: fica o que tem mais lançamentos em conta de resultado (o resultado tem sinal)', (() => {
    const x = resultadoDaPonte([{ codigo: 1, competencia: '2026-03', lanc_resultado: 2, resultado_antes_ir: 9000 }, { codigo: 2, competencia: '2026-03', lanc_resultado: 40, resultado_antes_ir: -500 }, { codigo: 3, competencia: '2026-03', lanc_resultado: 0, resultado_antes_ir: null }]);
    return x.size === 1 && x.get('2026-03').resultado === -500 && x.get('2026-03').lancamentos === 40; })());
  const lista = listaDoResultado([...linhas].reverse());
  ok('a lista que o estudo guarda: os meses em ordem, só o resultado (sem o código do Domínio)', lista.length === 12 && lista[0].competencia === '2025-10' && lista[11].competencia === '2026-09' && Object.keys(lista[0]).join() === 'competencia,lancamentos,resultado,ircs,financeiras');

  // de outubro a julho: 1500,10 − 2300,55 + 4200 + 900,45 + 2100 + 6100 + 7300 + 3800 + 9900 + 4500 = 38.000,00
  const lp = lucroDaPonte(serie, ctb, linhas);
  ok('o lucro até onde o Controle dá a contabilidade como feita: de outubro a julho, R$ 38.000,00 em 10 meses, com a receita deles (R$ 480.000)', lp.de === '2025-10' && lp.ate === '2026-07' && lp.meses === 10 && lp.lucro === 38000 && lp.receita === 480000
    && lp.ircs === 1000 && lp.financeiras === 100 && lp.lancamentos === 245 && lp.falta === undefined, lp);
  ok('aceita as linhas, o mapa e a lista do estudo: o mesmo número', lucroDaPonte(serie, ctb, m).lucro === 38000 && lucroDaPonte(serie, ctb, lista).lucro === 38000);
  ok('com o mês escolhido: até setembro (os 12 meses, R$ 41.700,00) ou até dezembro (R$ 3.399,55), sem depender do Controle', lucroDaPonte(serie, ctb, lista, '2026-09').lucro === 41700 && lucroDaPonte(serie, null, lista, '2025-12').lucro === 3399.55
    && lucroDaPonte(serie, null, lista, '2025-12').meses === 3 && lucroDaPonte(serie, null, lista, '2025-12').receita === 100000);
  ok('o mês escolhido fora dos meses da receita: nada (não cai no mês do Controle)', lucroDaPonte(serie, ctb, lista, '2026-10') === null && lucroDaPonte(serie, ctb, lista, '2025-09') === null && lucroDaPonte(serie, ctb, lista, 'x') === null);
  ok('sem o Controle, com a contabilidade fora do escritório, parada antes da receita ou sem mês feito: o sistema não sabe até onde ir', lucroDaPonte(serie, null, lista) === null && lucroDaPonte(serie, { faz: false, feitaAte: null }, lista) === null
    && lucroDaPonte(serie, { faz: true, feitaAte: '2025-09' }, lista) === null && lucroDaPonte(serie, { faz: true, feitaAte: null }, lista) === null);
  ok('sem a série, ou sem nenhum mês lido pela ponte: nada', lucroDaPonte(null, ctb, lista) === null && lucroDaPonte(serie, ctb, []) === null && lucroDaPonte(serie, ctb, null) === null
    && lucroDaPonte(serie, ctb, linhas.map(l => ({ ...l, lanc_resultado: null }))) === null);
  ok('a contabilidade adiantada no Controle: a DRE vai só até o fim da receita', lucroDaPonte(serie, { faz: true, feitaAte: '2026-12' }, lista).ate === '2026-09');
  // a ponte sem o resultado de um mês do período
  const semMarco = lucroDaPonte(serie, ctb, linhas.filter(l => l.competencia !== '2026-03'));
  ok('um mês do período que a ponte não leu: sem o número, e diz qual', semMarco.lucro === undefined && semMarco.falta === 'nao_lido' && semMarco.quais.join() === '2026-03' && semMarco.ate === '2026-07', semMarco);
  ok('o mês com lançamento e sem o número também é "não lido"', lucroDaPonte(serie, ctb, linhas.map(l => (l.competencia === '2026-01' ? { ...l, resultado_antes_ir: null } : l))).falta === 'nao_lido');
  // o Controle dá o mês como feito, a empresa faturou e o Domínio não tem lançamento em conta de resultado: nunca lucro zero
  const semLanc = lucroDaPonte(serie, ctb, linhas.map(l => (['2026-06', '2026-07'].includes(l.competencia) ? { ...l, lanc_resultado: 0, resultado_antes_ir: null } : l)));
  ok('o mês com receita e sem lançamento em conta de resultado: a contabilidade dele não está no Domínio (nunca lucro zero)', semLanc.lucro === undefined && semLanc.falta === 'sem_lancamento' && semLanc.quais.join() === '2026-06,2026-07', semLanc);
  ok('o mês sem lançamento depois do mês do Controle não atrapalha', lucroDaPonte(serie, ctb, linhas.map(l => (l.competencia === '2026-09' ? { ...l, lanc_resultado: 0, resultado_antes_ir: null } : l))).lucro === 38000);
  // o mês sem receita e sem lançamento conta como zero (a empresa parada no mês)
  const serieFuro = serie.filter(x => x.competencia !== '2026-02');
  const furo = lucroDaPonte(serieFuro, ctb, linhas.map(l => (l.competencia === '2026-02' ? { ...l, lanc_resultado: 0, resultado_antes_ir: null } : l)));
  ok('o mês sem receita e sem lançamento: zero no resultado, e o lucro sai dos outros (R$ 35.900,00)', furo.lucro === 35900 && furo.meses === 10 && furo.receita === 450000, furo);

  // o lucro da ponte no estudo: o número, o período, a receita dos meses e a origem
  const e = { lucroAnual: true, atividades: [] }, o = {};
  ok('pôr no estudo: o lucro, de quando a quando, a receita desses meses e a origem da ponte (o "anual" sai)', aplicarLucroDaPonte(e, o, lp) === true && e.lucroContabil === 38000 && e.lucroDe === '2025-10' && e.lucroAte === '2026-07' && e.lucroReceita === 480000
    && !('lucroAnual' in e) && o.lucroContabil.fonte === 'ponte' && o.lucroContabil.texto === 'Domínio, pela ponte: o resultado da contabilidade de out/25 a jul/26' && o.lucroContabil.de === '2025-10' && o.lucroContabil.ate === '2026-07'
    && /antes do IRPJ e da CSLL e sem o zeramento do exercício \(245 lançamentos\)$/.test(o.lucroContabil.dica), [e, o]);
  ok('o período com a margem: o lucro da ponte vai aos 12 meses pela receita (fator 1,25)', (() => { const p = periodoDaDre(serie, e); return p.de === '2025-10' && p.ate === '2026-07' && perto(p.fator, 1.25, 1e-9) && p.guardada === false; })());
  ok('sem o número (falta o mês, sem lançamento, nada): não põe e não mexe no estudo', (() => { const e2 = { lucroContabil: 5 }, o2 = {};
    return aplicarLucroDaPonte(e2, o2, semLanc) === false && aplicarLucroDaPonte(e2, o2, semMarco) === false && aplicarLucroDaPonte(e2, o2, null) === false && e2.lucroContabil === 5 && !o2.lucroContabil; })());
  ok('o prejuízo entra com o sinal', (() => { const e2 = {}, o2 = {}; return aplicarLucroDaPonte(e2, o2, lucroDaPonte(serie, null, lista, '2025-11')) && e2.lucroContabil === -800.45 && e2.lucroReceita === 50000; })());
  ok('a origem sem a contagem dos lançamentos não inventa o número', !/lançamentos/.test(origemDoLucroDaPonte({ de: '2025-10', ate: '2026-07' }).dica));
}

console.log('=== o PIS/Cofins das vendas pelo CST das notas (a versão 5 da ponte) ===');
{
  // 12 meses de uma indústria do Presumido: R$ 100.000 por mês, tudo com CST — 70% com alíquota zero, 5% isenta, 25% tributada
  const mes = (i, extra = {}) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); return { codigo: 1, competencia: d.toISOString().slice(0, 7), receita_bruta: 100000, receita_mercadorias: 100000, receita_servicos: 0,
    pc_tributada: 25000, pc_monofasica: 0, pc_st: 0, pc_aliquota_zero: 70000, pc_isenta: 5000, pc_sem_incidencia: 0, pc_suspensa: 0, pc_outras: 0, pc_sem_cst: 0, ...extra }; };
  const doze = extra => Array.from({ length: 12 }, (_, i) => mes(i, extra));
  const pc = pisCofinsDaPonte(doze());
  ok('a medida: 12 meses, toda a venda classificada, R$ 900.000 com alíquota zero ou isenta', pc.n === 12 && pc.de === '2025-10' && pc.ate === '2026-09' && pc.total === 1200000 && pc.classificada === 1200000 && pc.zero === 900000 && pc.isenta === 60000
    && pc.mono === 0 && pc.fora === 0 && pc.mercadorias === 1200000 && cstVale(pc), pc);
  ok('sem o bloco (a ponte antiga), ou sem venda: nada', pisCofinsDaPonte([{ competencia: '2026-01', receita_bruta: 5 }]) === null && pisCofinsDaPonte(doze({ pc_tributada: 0, pc_aliquota_zero: 0, pc_isenta: 0 })) === null && pisCofinsDaPonte(null) === null && !cstVale(null));
  const ind = { regime_tributario: 'Lucro Presumido', cnae_principal: '1041-4/00', uf: 'RS' };
  const g = entradaDoSistema({ cliente: ind, dominio: doze() });
  const a0 = g.entrada.atividades[0], oz = g.origens['atividades.0.pctAliqZero'];
  ok('a indústria do Presumido: 75% das vendas com alíquota zero ou isentas, pelas notas (a origem da ponte, com a marca do CST)', a0.tipo === 'industria' && a0.pctAliqZero === 75 && oz.fonte === 'ponte' && oz.cst === true
    && oz.texto === 'Domínio, pela ponte: 75% das vendas de mercadoria com alíquota zero ou isentas de PIS/Cofins nas notas de out/25 a set/26' && /Cesta Básica Nacional/.test(oz.dica) && /LC 224\/2025/.test(oz.dica), [a0, oz]);
  ok('a marca da Cesta Básica segue com a equipe (a nota não diz) e a indústria não ganha monofásico', a0.aliqZeroCesta === undefined && a0.pctMonofasico === undefined && !g.origens['atividades.0.pctMonofasico']);
  // sem alíquota zero nas notas: o zero medido (não é mais "padrão a conferir")
  const semZero = entradaDoSistema({ cliente: ind, dominio: doze({ pc_tributada: 100000, pc_aliquota_zero: 0, pc_isenta: 0 }) });
  ok('toda a venda tributada: zero medido, e a origem diz que as notas não têm', semZero.entrada.atividades[0].pctAliqZero === 0 && semZero.origens['atividades.0.pctAliqZero'].fonte === 'ponte'
    && semZero.origens['atividades.0.pctAliqZero'].texto === 'Domínio, pela ponte: nenhuma venda com alíquota zero de PIS/Cofins nas notas de out/25 a set/26');
  // medido pelas notas, o zero não é mais premissa a testar; no padrão (a ponte antiga), é
  const testada = or => premissasParaTestar(semZero.entrada, or, ['presumido', 'real']).some(t => /pctAliqZero$/.test(t.campo));
  ok('medida pelas notas, a alíquota zero sai do teste das premissas (no padrão, entra)', !testada(semZero.origens) && testada({ ...semZero.origens, 'atividades.0.pctAliqZero': { fonte: 'padrao' } }));
  // o comércio do Real com a revenda monofásica (CST 04) e a com substituição tributária (CST 05)
  const com = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real', cnae_principal: '4711-3/02', uf: 'RS' }, dominio: doze({ pc_tributada: 60000, pc_monofasica: 30000, pc_st: 2500, pc_aliquota_zero: 7500, pc_isenta: 0 }) });
  const ac = com.entrada.atividades[0];
  ok('o comércio do Real: 32,5% de revenda monofásica ou com substituição tributária e 7,5% com alíquota zero, pelas notas', ac.tipo === 'comercio' && ac.pctMonofasico === 32.5 && ac.pctAliqZero === 7.5 && com.origens['atividades.0.pctMonofasico'].cst === true
    && com.origens['atividades.0.pctMonofasico'].texto === 'Domínio, pela ponte: 32,5% das vendas de mercadoria de revenda monofásica ou com substituição tributária de PIS/Cofins nas notas de out/25 a set/26'
    && com.origens['atividades.0.pctAliqZero'].texto === 'Domínio, pela ponte: 7,5% das vendas de mercadoria com alíquota zero de PIS/Cofins nas notas de out/25 a set/26', [ac, com.origens['atividades.0.pctMonofasico']]);
  ok('o comércio sem monofásico nas notas: zero medido', (() => { const x = entradaDoSistema({ cliente: { regime_tributario: 'Lucro Real', cnae_principal: '4711-3/02' }, dominio: doze({ pc_tributada: 100000, pc_aliquota_zero: 0, pc_isenta: 0 }) });
    return x.entrada.atividades[0].pctMonofasico === 0 && x.origens['atividades.0.pctMonofasico'].texto === 'Domínio, pela ponte: nenhuma revenda monofásica de PIS/Cofins nas notas de out/25 a set/26'; })());
  // a indústria com revenda monofásica: a conta não separa, e a nota avisa
  const indMono = entradaDoSistema({ cliente: ind, dominio: doze({ pc_tributada: 80000, pc_monofasica: 20000, pc_aliquota_zero: 0, pc_isenta: 0 }) });
  ok('a indústria com CST 04: o monofásico não entra na atividade, e a nota manda conferir', indMono.entrada.atividades[0].pctMonofasico === undefined
    && indMono.notas.some(n => /^As notas têm 20% das vendas de mercadoria como revenda monofásica ou com substituição tributária de PIS\/Cofins \(CST 04 e 05\), e a atividade está como indústria/.test(n)));
  // a exportação e a suspensão (CST 08 e 09): o comparativo não separa
  const exp = entradaDoSistema({ cliente: ind, dominio: doze({ pc_tributada: 60000, pc_aliquota_zero: 0, pc_isenta: 0, pc_sem_incidencia: 30000, pc_suspensa: 10000 }) });
  ok('a venda sem incidência ou com suspensão (a exportação): a nota diz os 40% e que a conta põe o PIS/Cofins nelas', exp.notas.some(n => /^As notas têm 40% das vendas sem incidência ou com suspensão de PIS\/Cofins \(CST 08 e 09/.test(n)) && exp.entrada.atividades[0].pctAliqZero === 0
    && !g.notas.some(n => /CST 08 e 09/.test(n)));
  // o Simples: o item não tem o CST (a venda cai toda em pc_sem_cst) — a medida não vale, e nada muda
  const simples = entradaDoSistema({ cliente: { regime_tributario: 'Simples Nacional', cnae_principal: '4711-3/02', uf: 'RS' }, dominio: doze({ receita_simples: 100000, pc_tributada: 0, pc_aliquota_zero: 0, pc_isenta: 0, pc_sem_cst: 100000 }) });
  ok('no Simples (a venda sem CST): a alíquota zero segue no padrão a conferir, sem falar do CST', simples.origens['atividades.0.pctAliqZero'].fonte === 'padrao' && simples.origens['atividades.0.pctAliqZero'].texto === 'padrão: nenhuma — confira'
    && simples.entrada.atividades[0].pctAliqZero === undefined && !cstVale(pisCofinsDaPonte(doze({ pc_tributada: 0, pc_aliquota_zero: 0, pc_isenta: 0, pc_sem_cst: 100000 }))));
  // o Presumido com a nota sem CST ou com CST 49/99 em boa parte da venda: segue a conferir, e a origem diz quanto tem CST
  const pouco = entradaDoSistema({ cliente: ind, dominio: doze({ pc_tributada: 40000, pc_aliquota_zero: 20000, pc_isenta: 0, pc_outras: 30000, pc_sem_cst: 10000 }) });
  ok('o Presumido com só 60% da venda com o CST: padrão a conferir, dizendo os 60%', pouco.origens['atividades.0.pctAliqZero'].fonte === 'padrao' && pouco.entrada.atividades[0].pctAliqZero === undefined
    && pouco.origens['atividades.0.pctAliqZero'].texto === 'padrão: nenhuma — confira (só 60% das vendas têm o CST do PIS/Cofins nas notas do Domínio)' && /Lei 10\.925/.test(pouco.origens['atividades.0.pctAliqZero'].dica));
  ok('com 95% ou mais da venda com o CST, a medida vale; com 94%, não', cstVale(pisCofinsDaPonte(doze({ pc_tributada: 25000, pc_aliquota_zero: 65000, pc_isenta: 5000, pc_sem_cst: 5000 })))
    && !cstVale(pisCofinsDaPonte(doze({ pc_tributada: 25000, pc_aliquota_zero: 64000, pc_isenta: 5000, pc_sem_cst: 6000 }))));
  // a empresa com mercadoria e serviço: a parte com alíquota zero é sobre a venda de mercadoria
  const misto = entradaDoSistema({ cliente: ind, dominio: doze({ receita_bruta: 100000, receita_mercadorias: 80000, receita_servicos: 20000, pc_tributada: 40000, pc_aliquota_zero: 60000, pc_isenta: 0 }) });
  ok('com serviço junto: os 60 mil com alíquota zero são 75% da venda de mercadoria (80 mil)', misto.entrada.atividades.find(a => a.tipo === 'industria').pctAliqZero === 75);
  // a ponte antiga (sem os campos do CST): tudo como antes
  const antiga = entradaDoSistema({ cliente: ind, dominio: doze().map(({ competencia, receita_bruta, receita_mercadorias, receita_servicos }) => ({ codigo: 1, competencia, receita_bruta, receita_mercadorias, receita_servicos })) });
  ok('sem a versão 5 da ponte: o padrão a conferir de antes', antiga.origens['atividades.0.pctAliqZero'].fonte === 'padrao' && antiga.origens['atividades.0.pctAliqZero'].texto === 'padrão: nenhuma — confira' && antiga.entrada.atividades[0].pctAliqZero === undefined);
}

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
