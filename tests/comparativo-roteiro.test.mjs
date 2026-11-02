// Teste do roteiro do comparativo tributário (assets/js/comparativo-roteiro.js): "Por onde começar" em fases e missões —
// o que falta e o que conferir, na ordem do que pesa na decisão, o próximo passo, as fases concluídas e o que cada uma
// conquistou, e o estudo provisório até as missões que decidem estarem cumpridas.
// Rodar com: node tests/comparativo-roteiro.test.mjs — dados inventados (o repositório é público).

import { roteiroDoEstudo, crescimentoMedido, FASES, fontesDoEstudo, ultimoMesFechado, AUTOMATICO } from '../assets/js/comparativo-roteiro.js';
import { entradaDoSistema, premissasParaTestar, situacaoDoGrupo } from '../assets/js/comparativo-dados.js';
import { comparar, testarPremissas, fraseDaDecisao } from '../assets/js/comparativo-motor.js';

let falhas = 0, total = 0;
function ok(nome, cond, extra) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome + (cond || extra == null ? '' : '  → ' + JSON.stringify(extra).slice(0, 400)));
}
const ids = r => r.passos.filter(p => p.estado !== 'feito').map(p => p.id);
const missao = (r, id) => r.fases.flatMap(f => f.missoes).find(m => m.id === id);
// a tela: os padrões que ela põe na entrada
const comPadroes = e => ({ compras: 0, aliqCreditoIcms: 12, pctComprasSimples: 0, despesasCredito: 0, outrasDespesas: 0, folha: 0, proLabore: 0, rat: 2, fap: 1, terceiros: 5.8, crescimentoReceita: 0, crescimentoFolha: 0, ...e,
  atividades: e.atividades.map(a => ({ aliqIcms: 17, aliqIss: 3, pctST: 0, pctMonofasico: 0, redIcms: 0, redIcmsSimples: 0, ...a })) });
function rodar(entrada, origens, extra = {}) {
  let c = null, t = [];
  try { c = comparar(entrada); t = testarPremissas(entrada, premissasParaTestar(entrada, origens)); } catch (e) { c = null; }
  return roteiroDoEstudo({ entrada, origens, comparacao: c, testes: t, ...extra });
}

console.log('=== as fases ===');
ok('quatro fases, na ordem: Simples, números, premissas, veredito', FASES.map(f => f.id).join() === 'simples,numeros,premissas,veredito');

console.log('=== sem a receita ===');
const r0 = rodar(comPadroes({ atividades: [{ tipo: 'comercio', receita: 0 }] }), { 'atividades.0.receita': { fonte: 'padrao' } });
ok('o primeiro passo é a receita, que falta e decide', r0.proximo && r0.proximo.id === 'receita' && r0.proximo.estado === 'falta' && r0.proximo.peso === 'decide');
ok('a missão da receita: soltar o faturamento ou digitar', r0.proximo.relatorio === 'o faturamento' && r0.proximo.campo === 'atividades.0.receita');
ok('sem a receita, o estudo é provisório e fica na fase 1', r0.provisorio && r0.faseAtual === 0 && !r0.pronto);

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
const base = { situacao: sit, serie: sis.serie, socios: 2, conferencia: sis.conferencia };
const r1 = rodar(ent, ori, base);
const lim = missao(r1, 'limite');
ok('a fase de agora é a 1 e o próximo passo é a soma com a outra empresa', r1.faseAtual === 0 && r1.proximo && r1.proximo.id === 'limite' && r1.proximo.peso === 'decide', ids(r1));
ok('com a soma, o mês em que passa e a data de saída', /R\$\s4\.570\.000/.test(lim.texto) && /passa do limite em dezembro/.test(lim.texto) && /01\/01\/2027/.test(lim.texto), lim.texto);
ok('vai pra lista das empresas e tem o "Conferido"', lim.campo === 'grupo.0.receita' && lim.conferir.join() === 'grupo');
ok('a receita, cumprida pelo sistema', missao(r1, 'receita').estado === 'feita' && /caso da Reforma/.test(missao(r1, 'receita').como));
const folha = missao(r1, 'folha');
ok('a folha falta e decide (fase 2), com o resumo da folha pra soltar', folha.fase === 'numeros' && folha.estado === 'aberta' && folha.falta && folha.peso === 'decide' && folha.conferir.join() === 'folha,proLabore' && folha.relatorio === 'o resumo da folha');
ok('a folha do resumo do Domínio cumpre a missão', missao(rodar({ ...ent, folha: 130000, proLabore: 60000 }, { ...ori, folha: { fonte: 'dominio', texto: 'resumo da folha do Domínio de set/25 a ago/26' }, proLabore: { fonte: 'dominio' } }, base), 'folha').estado === 'feita'
  && missao(rodar({ ...ent, folha: 130000, proLabore: 60000 }, { ...ori, folha: { fonte: 'dominio' }, proLabore: { fonte: 'dominio' } }, base), 'folha').como === 'veio do relatório do Domínio');
ok('o texto da folha: o Presumido parece mais barato e, no Real, o lucro sai maior', /Presumido parece mais barato/.test(folha.texto) && /no Real, o lucro sai maior/.test(folha.texto));
ok('as compras e o PGDAS, cumpridos pelo caso da Reforma', missao(r1, 'compras').estado === 'feita' && missao(r1, 'pgdas').estado === 'feita' && /9%/.test(missao(r1, 'pgdas').texto));
ok('o estudo é provisório', r1.provisorio && r1.decidem >= 2 && !r1.pronto);
const cres = missao(r1, 'crescimento');
ok('perto do limite, o crescimento decide e traz o medido', cres.fase === 'premissas' && cres.peso === 'decide' && /19%/.test(cres.texto), cres.texto);
const prem = r1.passos.filter(p => p.id.startsWith('premissa:') && /passa a ser o Lucro Presumido/.test(p.texto));
ok('sem a folha, a virada pro Presumido não decide (o INSS da folha o encarece) e diz por quê', prem.length > 0 && prem.every(p => p.peso === 'importa' && /Sem a folha na conta/.test(p.texto)), prem.map(p => p.id));
ok('o progresso: as missões cumpridas de quantas valem', r1.total > r1.feitas && r1.feitas >= 3, { feitas: r1.feitas, total: r1.total });
ok('o que veio do sistema', ['a receita', 'o ST', 'o monofásico', 'a redução do ICMS no DAS', 'as compras', 'a receita de PADARIA INVENTADA'].every(x => r1.doSistema.includes(x)), r1.doSistema);
ok('a ordem: as que faltam e decidem antes, as cumpridas por último', (() => { const P = { decide: 0, importa: 1, detalhe: 2 }; const ps = r1.passos.filter(p => p.estado !== 'feito'); return ps.every((p, i) => i === 0 || P[ps[i - 1].peso] <= P[p.peso]) && r1.passos.slice(-1)[0].estado === 'feito'; })());

console.log('=== passar de fase ===');
const r2 = rodar(ent, { ...ori, grupo: { fonte: 'confirmado' } }, base);
ok('"Conferido" na soma: a fase 1 fecha, com o alerta do limite', r2.fases[0].concluida && r2.fases[0].alerta && /passa do limite em dezembro/.test(r2.fases[0].conquista), r2.fases[0].conquista);
ok('a fase de agora vira a 2, e o próximo passo é a folha', r2.faseAtual === 1 && r2.proximo.id === 'folha', ids(r2));
const ent3 = { ...ent, folha: 480000, proLabore: 60000 };
const o3 = { ...ori, grupo: { fonte: 'confirmado' }, folha: { fonte: 'digitado' }, proLabore: { fonte: 'digitado' }, outrasDespesas: { fonte: 'confirmado' } };
const r3 = rodar(ent3, o3, base);
ok('com a folha (e as despesas conferidas), a fase 2 fecha', r3.fases[1].concluida && r3.fases[1].conquista && missao(r3, 'folha').estado === 'feita' && missao(r3, 'folha').como === 'digitado', r3.fases[1].missoes.map(m => m.id + ':' + m.estado));
ok('"Não tem folha" (conferido) também cumpre a missão', missao(rodar(ent, { ...ori, folha: { fonte: 'confirmado' }, proLabore: { fonte: 'confirmado' } }, base), 'folha').estado === 'feita');
// conferir o que sobrou nas premissas
const abertas3 = r3.fases[2].missoes.filter(m => m.estado === 'aberta');
const conf = Object.fromEntries(abertas3.flatMap(m => m.conferir || []).map(k => [k, { fonte: 'confirmado' }]));
const r4 = rodar(ent3, { ...o3, ...conf }, base);
ok('as premissas conferidas: a fase 3 fecha', r4.fases[2].concluida && /Nada do que ficou no padrão/.test(r4.fases[2].conquista), r4.fases[2].missoes.map(m => m.id + ':' + m.estado));
ok('as três fechadas: o veredito, pronto, com a frase da decisão', r4.pronto && r4.faseAtual === 3 && r4.fases[3].concluida && r4.fases[3].conquista === fraseDaDecisao(comparar(ent3)) && !r4.provisorio, r4.fases[3].conquista);
ok('pronto: todas as missões que valem cumpridas', r4.feitas === r4.total);

console.log('=== longe do limite: as empresas dos sócios ficam como extra ===');
const longe = comPadroes({ atividades: [{ tipo: 'comercio', receita: 1200000 }], compras: 800000, folha: 120000, proLabore: 36000, despesasCredito: 30000, regimeAtual: 'simples' });
const oLonge = { 'atividades.0.receita': { fonte: 'dominio' }, compras: { fonte: 'dominio' }, folha: { fonte: 'fator_r' }, proLabore: { fonte: 'fator_r' } };
const r5 = rodar(longe, oLonge, { socios: null });
const ext = missao(r5, 'limite');
ok('sem sócios no cadastro: a extra pede pra conferir, com o "+ Empresa dos mesmos sócios"', ext.peso === 'detalhe' && ext.estado === 'aberta' && ext.acao === 'mais-grupo' && ext.conferir.join() === 'grupo');
ok('com sócios no cadastro e nenhuma outra empresa: cumprida pelo sistema', missao(rodar(longe, oLonge, { socios: 2 }), 'limite').estado === 'feita');
ok('a extra não segura a fase 1', r5.fases[0].concluida);
const tirada = missao(rodar(longe, oLonge, { socios: 2, achadas: 1 }), 'limite');
ok('a empresa que o sistema achou e a tela tirou da soma: a extra diz isso', tirada.estado === 'feita' && tirada.como === 'tirada da soma' && /ficou fora da soma/.test(tirada.texto));
ok('longe do limite, o crescimento conta, mas não decide', missao(r5, 'crescimento').peso === 'importa');
ok('no Simples sem o PGDAS: a missão de soltar o PGDAS', missao(r5, 'pgdas') && missao(r5, 'pgdas').estado === 'aberta' && missao(r5, 'pgdas').relatorio === 'o PGDAS');
ok('o Real nem com lucro zero fica abaixo do Simples: a missão do lucro vem cumprida', missao(r5, 'lucro') && missao(r5, 'lucro').estado === 'feita' && /Nem com lucro zero/.test(missao(r5, 'lucro').texto));
ok('quem não é do Simples hoje não tem a missão do PGDAS', !missao(rodar({ ...longe, regimeAtual: 'presumido' }, oLonge), 'pgdas'));

console.log('=== o lucro do Real, quando decide ===');
// acima do limite (fora do Simples), entre o Presumido e o Real: o empate do comércio fica perto de 9,5% da receita
const grande = comPadroes({ atividades: [{ tipo: 'comercio', receita: 6000000 }], compras: 4000000, folha: 500000, proLabore: 60000, despesasCredito: 100000 });
const oGrande = { 'atividades.0.receita': { fonte: 'dominio' }, compras: { fonte: 'dominio' }, folha: { fonte: 'digitado' }, proLabore: { fonte: 'digitado' } };
const rg = rodar(grande, oGrande);
const lucro = missao(rg, 'lucro');
ok('o lucro do Real decide: o empate e o lucro que a conta usou', lucro && lucro.estado === 'aberta' && lucro.peso === 'decide' && /empata com o Lucro Presumido/.test(lucro.texto) && lucro.campo === 'outrasDespesas', lucro && lucro.texto);
ok('fora do Simples pelo limite: a missão do limite diz isso', /fica fora/.test((missao(rg, 'limite') || {}).texto || ''));
ok('com as outras despesas digitadas, a missão do lucro é cumprida', missao(rodar({ ...grande, outrasDespesas: 300000 }, { ...oGrande, outrasDespesas: { fonte: 'digitado' } }), 'lucro').estado === 'feita');

console.log('=== o que usar em cada fase (pedido do Samuel, 01/11/2026) ===');
ok('o último mês fechado: até o dia 20, o de dois meses atrás; depois, o anterior', ultimoMesFechado('2026-11-01') === '2026-09' && ultimoMesFechado('2026-11-21') === '2026-10' && ultimoMesFechado('2026-01-10') === '2025-11' && ultimoMesFechado(null) === null);
const rF = rodar(ent, ori, { ...base, hoje: '2026-11-01' });
const fonte = (r, fase, id) => (r.fases.find(f => f.id === fase).fontes || []).find(x => x.id === id);
const fRec = fonte(rF, 'simples', 'receita');
ok('cada fase tem as suas fontes', rF.fases.every(f => Array.isArray(f.fontes) && f.fontes.length > 0), rF.fases.map(f => f.id + ':' + f.fontes.length));
ok('a receita: o relatório do Domínio, até jul/26, e os meses que faltam até o último fechado', fRec.estado === 'antigo' && /Relatório de Faturamento/.test(fRec.onde) && fRec.relatorio === true
  && /caso da Reforma, até jul\/26 — faltam ago\/26 e set\/26/.test(fRec.situacao), fRec.situacao);
ok('no Simples, a receita vai chegar pela ponte da Receita (o PGDAS)', /ponte da Receita \(Integra Contador\)/.test(fRec.auto) && /PGDAS/.test(fRec.auto), fRec.auto);
ok('com os meses em dia, a receita fica "tem"', fonte(rodar(ent, ori, { ...base, hoje: '2026-08-25' }), 'simples', 'receita').estado === 'tem');
ok('os sócios: o contrato social na ficha, que as pontes não trazem', fonte(rF, 'simples', 'socios').estado === 'tem' && fonte(rF, 'simples', 'socios').ficha && fonte(rF, 'simples', 'socios').auto === AUTOMATICO.contrato);
ok('sem os sócios no cadastro, falta; sem cadastro, a linha não aparece', fonte(rodar(ent, ori, { ...base, socios: 0, hoje: '2026-11-01' }), 'simples', 'socios').estado === 'falta' && !fonte(rodar(ent, ori, { ...base, socios: null, hoje: '2026-11-01' }), 'simples', 'socios'));
const fGr = fonte(rF, 'simples', 'grupo');
ok('as outras empresas: somadas até o mês que todas têm, com os que faltam', fGr.estado === 'antigo' && /as 2 empresas somadas até jul\/26 — faltam ago\/26 e set\/26/.test(fGr.situacao), fGr.situacao);
ok('a outra sem a receita: falta, com o nome', /falta a receita de PADARIA INVENTADA/.test(fonte(rodar(ent, { ...ori, 'grupo.0.receita': { fonte: 'padrao' } }, { ...base, hoje: '2026-11-01' }), 'simples', 'grupo').situacao));
const fFolha = fonte(rF, 'numeros', 'folha');
ok('a folha: o resumo da folha do Domínio, que falta, pra soltar (lido com IA, como no Fator R)', fFolha.estado === 'falta' && /Domínio Folha: o resumo da folha mês a mês/.test(fFolha.onde) && /lido com IA como no Fator R/.test(fFolha.onde) && fFolha.relatorio === true && fFolha.campo === 'folha' && fFolha.auto === AUTOMATICO.dominio, fFolha.onde);
ok('as compras: o Acompanhamento de Entradas, cumpridas pelo caso da Reforma', fonte(rF, 'numeros', 'compras').estado === 'tem' && /Acompanhamento de Entradas/.test(fonte(rF, 'numeros', 'compras').onde));
ok('o PGDAS: de jul/26, e a Receita só vai trazer a receita e o RBT12', fonte(rF, 'numeros', 'pgdas').estado === 'tem' && /jul\/26/.test(fonte(rF, 'numeros', 'pgdas').situacao) && /ST, o monofásico e a redução seguem pelo relatório/.test(fonte(rF, 'numeros', 'pgdas').auto));
ok('as despesas: o balancete ou a DRE do Domínio Contabilidade', /balancete ou a DRE/.test(fonte(rF, 'numeros', 'despesas').onde) && ['falta', 'dispensa'].includes(fonte(rF, 'numeros', 'despesas').estado));
ok('o crédito de ICMS e o ICMS do restaurante, no padrão', fonte(rF, 'premissas', 'credito').estado === 'padrao' && /no padrão: 12% das compras/.test(fonte(rF, 'premissas', 'credito').situacao)
  && fonte(rF, 'premissas', 'icms').info === 'O ICMS das vendas e a opção do restaurante' && /o RDA, a base reduzida ou o crédito presumido/.test(fonte(rF, 'premissas', 'icms').onde));
ok('sem folha, sem a linha do RAT; o crescimento é conversa com o cliente', !fonte(rF, 'premissas', 'rat') && fonte(rF, 'premissas', 'crescimento').auto === AUTOMATICO.conversa);
ok('com a folha, o RAT no padrão pede o resumo da folha', fonte(rodar(ent3, o3, { ...base, hoje: '2026-11-01' }), 'premissas', 'rat').estado === 'padrao');
const fConv = fonte(rF, 'veredito', 'conversa');
ok('o veredito: a reunião, com as escolhas do restaurante e da Reforma', fConv.estado === 'conversa' && /a opção do ICMS do restaurante e o Simples por dentro ou por fora na Reforma/.test(fConv.onde), fConv.onde);
const fPres = fontesDoEstudo({ entrada: comPadroes({ atividades: [{ tipo: 'servico', receita: 900000 }], regimeAtual: 'presumido' }), origens: { 'atividades.0.receita': { fonte: 'digitado' } }, hoje: '2026-11-01' });
ok('no Presumido, a receita vai chegar pela ponte do Domínio; digitada, sem o "até"', fPres.simples[0].auto === AUTOMATICO.dominio && fPres.simples[0].estado === 'tem' && fPres.simples[0].situacao === 'digitado');
ok('serviço: o ISS e nenhuma linha de ICMS nem de PGDAS', fPres.premissas.some(x => x.id === 'iss') && !fPres.premissas.some(x => x.id === 'icms' || x.id === 'credito') && !fPres.numeros.some(x => x.id === 'pgdas'));

console.log('=== o crescimento medido ===');
const g = crescimentoMedido(mesesDe(100000, 120000));
// ago–out/25 a 100.000 × 3 contra mai–jul/26 a 120.000 × 3: +20%
ok('os 3 últimos contra os 3 primeiros: +20%', g && Math.abs(g.pct - 20) < 1e-9 && g.ini[0] === '2025-08' && g.fim[1] === '2026-07', g);
ok('com menos de 9 meses, não mede', crescimentoMedido(mesesDe(1, 2).slice(0, 8)) === null);

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
