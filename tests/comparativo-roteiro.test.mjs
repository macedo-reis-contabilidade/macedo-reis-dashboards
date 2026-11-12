// Teste do roteiro do comparativo tributário (assets/js/comparativo-roteiro.js): "Por onde começar" em fases e missões —
// o que falta e o que conferir, na ordem do que pesa na decisão, o próximo passo, as fases concluídas e o que cada uma
// conquistou, e o estudo provisório até as missões que decidem estarem cumpridas.
// Desde 11/11/2026, o caminho pelo comparativo escolhido (só o Presumido contra o Real: a receita e a presunção, o lucro
// do Real pela contabilidade, o resto da conta), os impedimentos do Simples pelo cadastro e a precisão do estudo. Também de
// 11/11/2026: a DRE até onde a contabilidade está feita (e não até o fim da receita) e a confirmação de quem cuida dela,
// que também chega pela pergunta do vigia (o "vai" do Samuel das 21h19: contabil.pergunta). E, com a versão 5 da ponte do
// Domínio (o "vai" das 22h13), o lucro que a ponte traz: a missão oferece o de hoje e reabre quando o do estudo ficou velho.
// Rodar com: node tests/comparativo-roteiro.test.mjs — dados inventados (o repositório é público).

import { roteiroDoEstudo, crescimentoMedido, FASES, FASES_GERAL, fasesDoObjetivo, fontesDoEstudo, ultimoMesFechado, AUTOMATICO, precisaoDoEstudo, NIVEL_DA_PRECISAO, PESO_DA_PRECISAO, LIMITE_PRESUMIDO,
  presuncaoDoEstudo, faixasDeMeses, sinaisDaContabilidade, confirmacaoDaContabilidade, lucroDoEstudo, perguntaDaContabilidade, ponteDoLucro, alertasDoResultado } from '../assets/js/comparativo-roteiro.js';
import { entradaDoSistema, premissasParaTestar, situacaoDoGrupo, presuncaoPeloCnae, periodoDaDre, lucroDaPonte, aplicarLucroDaPonte } from '../assets/js/comparativo-dados.js';
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
ok('no Simples, a receita chega pela ponte da Receita (o PGDAS) e pela do Domínio (a apuração)', fRec.auto === AUTOMATICO.receita && /ponte da Receita traz o PGDAS/.test(fRec.auto) && /a do Domínio, a apuração/.test(fRec.auto), fRec.auto);
ok('com os meses em dia, a receita fica "tem"', fonte(rodar(ent, ori, { ...base, hoje: '2026-08-25' }), 'simples', 'receita').estado === 'tem');
ok('os sócios: o contrato social na ficha, que as pontes não trazem', fonte(rF, 'simples', 'socios').estado === 'tem' && fonte(rF, 'simples', 'socios').ficha && fonte(rF, 'simples', 'socios').auto === AUTOMATICO.contrato);
ok('sem os sócios no cadastro, falta; sem cadastro, a linha não aparece', fonte(rodar(ent, ori, { ...base, socios: 0, hoje: '2026-11-01' }), 'simples', 'socios').estado === 'falta' && !fonte(rodar(ent, ori, { ...base, socios: null, hoje: '2026-11-01' }), 'simples', 'socios'));
const fGr = fonte(rF, 'simples', 'grupo');
ok('as outras empresas: somadas até o mês que todas têm, com os que faltam', fGr.estado === 'antigo' && /as 2 empresas somadas até jul\/26 — faltam ago\/26 e set\/26/.test(fGr.situacao), fGr.situacao);
ok('a outra sem a receita: falta, com o nome', /falta a receita de PADARIA INVENTADA/.test(fonte(rodar(ent, { ...ori, 'grupo.0.receita': { fonte: 'padrao' } }, { ...base, hoje: '2026-11-01' }), 'simples', 'grupo').situacao));
const fFolha = fonte(rF, 'numeros', 'folha');
ok('a folha: o resumo da folha do Domínio, que falta, pra soltar (lido com IA)', fFolha.estado === 'falta' && /Domínio Folha: o resumo da folha mês a mês/.test(fFolha.onde) && /, lido com IA\.$/.test(fFolha.onde) && !/Fator R/.test(fFolha.onde) && fFolha.relatorio === true && fFolha.campo === 'folha' && fFolha.auto === AUTOMATICO.ponte && /a ponte do Domínio traz todo dia/.test(AUTOMATICO.ponte), fFolha.onde);
ok('as compras: o Acompanhamento de Entradas, cumpridas pelo caso da Reforma', fonte(rF, 'numeros', 'compras').estado === 'tem' && /Acompanhamento de Entradas/.test(fonte(rF, 'numeros', 'compras').onde));
ok('o PGDAS: de jul/26; as pontes trazem a receita, o RBT12, o ST e o monofásico, e a alíquota efetiva segue pelo relatório', fonte(rF, 'numeros', 'pgdas').estado === 'tem' && /jul\/26/.test(fonte(rF, 'numeros', 'pgdas').situacao) && /o ST e o monofásico; a alíquota efetiva e a redução do ICMS seguem pelo relatório/.test(fonte(rF, 'numeros', 'pgdas').auto));
ok('as despesas: o balancete ou a DRE do Domínio Contabilidade', /balancete ou a DRE/.test(fonte(rF, 'numeros', 'despesas').onde) && ['falta', 'dispensa'].includes(fonte(rF, 'numeros', 'despesas').estado));
ok('o crédito de ICMS e o ICMS do restaurante, no padrão', fonte(rF, 'premissas', 'credito').estado === 'padrao' && /no padrão: 12% das compras/.test(fonte(rF, 'premissas', 'credito').situacao)
  && fonte(rF, 'premissas', 'icms').info === 'O ICMS das vendas e a opção do restaurante' && /o RDA, a base reduzida ou o crédito presumido/.test(fonte(rF, 'premissas', 'icms').onde));
ok('sem folha, sem a linha do RAT; o crescimento é conversa com o cliente', !fonte(rF, 'premissas', 'rat') && fonte(rF, 'premissas', 'crescimento').auto === AUTOMATICO.conversa);
ok('com a folha, o RAT no padrão pede o resumo da folha', fonte(rodar(ent3, o3, { ...base, hoje: '2026-11-01' }), 'premissas', 'rat').estado === 'padrao');
const fConv = fonte(rF, 'veredito', 'conversa');
ok('o veredito: a reunião, com as escolhas do restaurante e da Reforma', fConv.estado === 'conversa' && /a opção do ICMS do restaurante e o Simples por dentro ou por fora na Reforma/.test(fConv.onde), fConv.onde);
const fPres = fontesDoEstudo({ entrada: comPadroes({ atividades: [{ tipo: 'servico', receita: 900000 }], regimeAtual: 'presumido' }), origens: { 'atividades.0.receita': { fonte: 'digitado' } }, hoje: '2026-11-01' });
ok('no Presumido, a receita chega pela ponte do Domínio; digitada, sem o "até"', fPres.simples[0].auto === AUTOMATICO.ponte && fPres.simples[0].estado === 'tem' && fPres.simples[0].situacao === 'digitado');
ok('serviço: o ISS e nenhuma linha de ICMS nem de PGDAS', fPres.premissas.some(x => x.id === 'iss') && !fPres.premissas.some(x => x.id === 'icms' || x.id === 'credito') && !fPres.numeros.some(x => x.id === 'pgdas'));

console.log('=== o crescimento medido ===');
const g = crescimentoMedido(mesesDe(100000, 120000));
// ago–out/25 a 100.000 × 3 contra mai–jul/26 a 120.000 × 3: +20%
ok('os 3 últimos contra os 3 primeiros: +20%', g && Math.abs(g.pct - 20) < 1e-9 && g.ini[0] === '2025-08' && g.fim[1] === '2026-07', g);
ok('com menos de 9 meses, não mede', crescimentoMedido(mesesDe(1, 2).slice(0, 8)) === null);

console.log('=== qual comparativo: as fases de cada caminho (11/11/2026) ===');
{
  ok('só o Presumido contra o Real: a receita e a presunção, o lucro do Real, o resto da conta e o veredito', FASES_GERAL.map(f => f.id).join() === 'presuncao,lucro,premissas,veredito' && fasesDoObjetivo('presumido_real') === FASES_GERAL
    && FASES_GERAL.map(f => f.titulo).join(' · ') === 'A receita e a presunção · O lucro do Real · O resto da conta · O veredito');
  ok('com o Simples: a empresa do regime geral lê "pode entrar"; a do Simples, "pode ficar"', fasesDoObjetivo('todos', 'presumido')[0].titulo === 'Ela pode entrar no Simples?' && fasesDoObjetivo('todos', 'real')[0].titulo === 'Ela pode entrar no Simples?'
    && fasesDoObjetivo('todos', 'simples')[0].titulo === 'Ela pode ficar no Simples?' && fasesDoObjetivo('todos')[0].titulo === 'Ela pode ficar no Simples?' && /os impedimentos do cadastro/.test(FASES[0].objetivo));
  ok('o limite do Presumido: R$ 78 milhões', LIMITE_PRESUMIDO === 78000000);

  // a conta por caminho, como o estudo faz (os regimes do comparativo e as premissas dele)
  const comP = e => ({ ...comPadroes(e), lucroContabil: null, ajustesLalur: 0, ...Object.fromEntries(Object.entries(e).filter(([k]) => k === 'lucroContabil' || k === 'ajustesLalur')) });
  function rodarC(entrada, origens, extra = {}) {
    const regs = entrada.objetivo === 'presumido_real' ? ['presumido', 'real'] : ['simples', 'presumido', 'real'];
    // o lucro da DRE de só uma parte dos 12 meses vai a eles pelo fator do período (o contaDoEstudo faz igual)
    const dre = entrada.lucroContabil != null ? periodoDaDre(extra.serie, entrada) : null;
    const eM = { ...entrada, regimes: regs, lucroFator: dre ? dre.fator : 1 };
    const c = comparar(eM), t = testarPremissas(eM, premissasParaTestar(entrada, origens, regs));
    return roteiroDoEstudo({ entrada, origens, comparacao: c, testes: t, ...extra });
  }
  // comércio do Presumido, R$ 1 milhão, compras de R$ 500 mil, sem folha nem pró-labore (o Domínio, pela ponte, diz)
  const ORI = { 'atividades.0.receita': { fonte: 'ponte' }, 'atividades.0.tipo': { fonte: 'cadastro' }, compras: { fonte: 'ponte' }, folha: { fonte: 'ponte' }, proLabore: { fonte: 'ponte' } };
  const G = comP({ atividades: [{ tipo: 'comercio', receita: 1000000 }], compras: 500000, regimeAtual: 'presumido', objetivo: 'presumido_real' });
  const serie = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); return { competencia: d.toISOString().slice(0, 7), total: 1000000 / 12 }; });
  const base = { serie, hoje: '2026-11-11' };

  console.log('=== só o Presumido contra o Real: sem o lucro da contabilidade ===');
  const g0 = rodarC(G, ORI, { ...base, contabil: { faz: true, feitaAte: '2026-07' } });
  ok('o caminho do estudo e as quatro fases dele', g0.objetivo === 'presumido_real' && g0.fases.map(f => f.id).join() === 'presuncao,lucro,premissas,veredito');
  ok('nenhuma missão do Simples: sem o limite, os impedimentos, as empresas dos sócios e o PGDAS', !['limite', 'vedacoes', 'pgdas'].some(id => missao(g0, id)));
  const pres = missao(g0, 'presuncao');
  // sem as notas no sistema (o roteiro sem a medida da atividade): a atividade veio do CNAE, e a missão diz o que fazer
  ok('a presunção sem as notas: pelo CNAE do cadastro, aberta, com o que a conta usou e o que fazer', pres.fase === 'presuncao' && pres.estado === 'aberta' && pres.peso === 'importa' && pres.conferir.join() === 'atividades.0.tipo' && pres.conferirRotulo === 'Está certa'
    && pres.campo === 'atividades.0.tipo' && pres.irRotulo === 'Ver a atividade'
    && /^O sistema não tem as notas desta empresa: a atividade veio do CNAE do cadastro\. A conta usou: Comércio \(revenda de mercadorias\), 8% no IRPJ e 12% na CSLL sobre R\$\s1\.000\.000\. Venda de mercadoria presume 8% no IRPJ e 12% na CSLL; serviço, 32% nos dois\. Se a empresa tem as duas receitas, separe cada uma numa atividade; se é isso mesmo, clique em Está certa\.$/.test(pres.texto), pres.texto);
  // 11/11/2026: só o Presumido contra o Real, o serviço é "Serviços" — o anexo e o fator r são do Simples e não aparecem
  // em nenhuma missão, fase ou fonte do caminho
  const gServ = rodarC(comP({ atividades: [{ tipo: 'servico_r', receita: 600000 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' }), ORI, base);
  ok('o serviço do fator r no Presumido × Real: a missão diz "Serviços", 32%', / A conta usou: Serviços, 32% no IRPJ e 32% na CSLL sobre R\$\s600\.000\./.test(missao(gServ, 'presuncao').texto), missao(gServ, 'presuncao').texto);
  ok('nada do Simples no caminho do Presumido × Real (nem o anexo, nem o fator r, nem o DAS, nem o PGDAS)', [g0, gServ].every(r => !/Anexo [IV]|fator r|\bDAS\b|PGDAS|Simples Nacional|no Simples|do Simples\b(?! bem)/.test(JSON.stringify(r).replace(/fornecedor do Simples/g, ''))),
    (JSON.stringify(gServ).replace(/fornecedor do Simples/g, '').match(/.{60}(Anexo [IV]|fator r|\bDAS\b|PGDAS|Simples Nacional|no Simples|do Simples).{60}/) || [''])[0]);
  const luc = missao(g0, 'lucro');
  ok('o lucro da contabilidade falta e decide: digitar o da DRE ou seguir com a estimativa', luc.fase === 'lucro' && luc.estado === 'aberta' && luc.falta && luc.peso === 'decide' && luc.campo === 'lucroContabil' && luc.irRotulo === 'Digitar o lucro da DRE'
    && luc.conferir.join() === 'lucroContabil' && luc.conferirRotulo === 'Seguir com a estimativa');
  // o empate: IRPJ e CSLL do Presumido 22.800 = 24% × 95.000; a estimativa de 2027: 1.000.000 − 500.000 − 110.000 − 44.070 = 345.930
  // 11/11/2026, 20h11: a contabilidade feita até julho não trava mais o estudo — a missão pede a DRE até julho
  ok('o texto: a DRE até onde a contabilidade está feita (julho: 10 dos 12 meses), a estimativa e o empate', /^Falta o lucro da DRE, antes do IRPJ e da CSLL\. Pelo Controle das contabilidades, ela está feita até jul\/26: use a DRE de out\/25 a jul\/26 \(10 dos 12 meses da receita\): ago\/26 e set\/26 entram pela margem desses 10\. Sem ele, a conta estima o lucro do Real \(a receita menos as compras, a folha e as despesas\): R\$\s345\.930 em 2027\./.test(luc.texto)
    && /O Real empata com o Presumido com lucro de R\$\s95\.000 antes do IR \(9,5% da receita\): abaixo disso, o Real sai mais barato\.$/.test(luc.texto) && !/ainda não fecha/.test(luc.texto), luc.texto);
  ok('a folha zerada pelo Domínio (a ponte leu e deu zero) não é dado que falta', missao(g0, 'folha').estado === 'feita' && missao(g0, 'folha').como === 'veio do Domínio pela ponte' && /^Pelo Domínio, a empresa não tem folha nem pró-labore calculados nos 12 meses\./.test(missao(g0, 'folha').texto));
  ok('sem a ponte dizer, a folha zerada segue faltando', missao(rodarC(G, { ...ORI, folha: { fonte: 'padrao' }, proLabore: { fonte: 'padrao' } }, base), 'folha').estado === 'aberta');
  const pc = missao(g0, 'piscofins');
  // PIS/Cofins do Presumido em 2026: 3,65% × (1.000.000 − 170.000) = 30.295
  ok('o PIS/Cofins das vendas, no resto da conta: no padrão, a conferir, só pesa em 2026', pc.fase === 'premissas' && pc.estado === 'aberta' && pc.peso === 'importa' && pc.conferirRotulo === 'Toda a venda paga' && pc.conferir.join() === 'atividades.0.pctAliqZero' && pc.campo === 'atividades.0.pctAliqZero'
    && /^No padrão, toda a venda paga PIS\/Cofins: em 2026, R\$\s30\.295 no Presumido \(3,65%, cumulativo\); no Real, 9,25% menos os créditos\. Se o produto tem alíquota zero \(a Lei 10\.925\/2004, art\. 1º: óleos vegetais, arroz, feijão, carnes, leite, higiene…\), informe a parte das vendas com alíquota zero\./.test(pc.texto)
    && /As da Cesta Básica Nacional \(LC 214, Anexos I e XV\) seguem com zero; as outras pagam 10% da alíquota desde abril de 2026 \(LC 224\/2025\)\. Só pesa em 2026: em 2027 a CBS toma o lugar, igual nos dois regimes\.$/.test(pc.texto)
    && /^só a conta de 2026: com alíquota zero nas vendas, o Presumido fica até R\$\s30\.295 mais barato$/.test(pc.efeito), pc.texto + ' | ' + pc.efeito);
  // com a alíquota zero informada (um óleo vegetal: 100%, fora da Cesta Básica Nacional), a missão fica cumprida e o PIS/Cofins
  // do Presumido de 2026 fica nos 10% da alíquota de abril a dezembro (LC 224): 0,365% × 830.000 × 9/12 = 2.272,125
  const gZ = rodarC({ ...G, atividades: [{ ...G.atividades[0], pctAliqZero: 100 }] }, { ...ORI, 'atividades.0.pctAliqZero': { fonte: 'digitado' } }, base), pcZ = missao(gZ, 'piscofins');
  ok('com a alíquota zero informada em 100%, fora da cesta básica: cumprida, digitada, com os 10% da alíquota desde abril (LC 224)', pcZ.estado === 'feita' && pcZ.como === 'digitado' && !pcZ.conferir
    && /^R\$\s1\.000\.000 das vendas com alíquota zero: em 2026, R\$\s2\.272 no Presumido\. Desde abril de 2026 a alíquota zero de fora da Cesta Básica Nacional \(LC 214, Anexos I e XV\) paga 10% da alíquota: 0,365% no Presumido e 0,925% no Real, menos os créditos \(LC 224\/2025\)\. Se os produtos são da Cesta Básica Nacional, marque na atividade: seguem com zero\. Só pesa em 2026/.test(pcZ.texto), pcZ.texto);
  // da Cesta Básica Nacional (o arroz, o feijão…): segue com zero
  const gC = rodarC({ ...G, atividades: [{ ...G.atividades[0], pctAliqZero: 100, aliqZeroCesta: true }] }, { ...ORI, 'atividades.0.pctAliqZero': { fonte: 'digitado' } }, base), pcC = missao(gC, 'piscofins');
  ok('da Cesta Básica Nacional, em 100%: sem PIS/Cofins a pagar no Presumido nem no Real', pcC.estado === 'feita'
    && /^R\$\s1\.000\.000 das vendas com alíquota zero: em 2026, sem PIS\/Cofins a pagar no Presumido nem no Real \(no Real, o crédito do que foi comprado com PIS\/Cofins fica e pode ser ressarcido: fora da conta\)\. Só pesa em 2026/.test(pcC.texto), pcC.texto);
  // com parte monofásica (30%) vinda do sistema e a alíquota zero no padrão: aberta, e o botão diz "Sem venda com alíquota zero"
  const gM = rodarC({ ...G, atividades: [{ ...G.atividades[0], pctMonofasico: 30 }] }, { ...ORI, 'atividades.0.pctMonofasico': { fonte: 'ponte' } }, base), pcM = missao(gM, 'piscofins');
  ok('com a revenda monofásica do sistema e a alíquota zero no padrão: aberta, com o monofásico já fora', pcM.estado === 'aberta' && pcM.conferirRotulo === 'Sem venda com alíquota zero'
    && /^No padrão, sem venda com alíquota zero \(R\$\s300\.000 de revenda monofásica já fora\): em 2026, R\$\s21\.20[67] no Presumido/.test(pcM.texto), pcM.texto);
  ok('as compras vão pro resto da conta (o crédito), cumpridas pela ponte', missao(g0, 'compras').fase === 'premissas' && missao(g0, 'compras').estado === 'feita');
  ok('provisório: faltam o lucro e a confirmação da contabilidade, que decidem; o próximo passo é a presunção, da fase de agora', g0.provisorio && g0.decidem === 2 && g0.faseAtual === 0 && g0.proximo.id === 'presuncao' && !g0.pronto);
  ok('a estimativa que não serve: as compras e as despesas passam da receita', /As compras, as despesas com nota e a folha passam da receita: a empresa formou estoque, investiu ou teve prejuízo, e a estimativa não serve pra decidir\./.test(
    missao(rodarC({ ...G, compras: 900000, despesasCredito: 300000 }, { ...ORI, despesasCredito: { fonte: 'ponte' } }, base), 'lucro').texto));
  ok('sem o Controle das contabilidades, a missão não fala dele e pede a DRE dos 12 meses; fora do escritório, diz', !/Controle das contabilidades/.test(missao(rodarC(G, ORI, base), 'lucro').texto)
    && /^Falta o lucro da DRE de out\/25 a set\/26, antes do IRPJ e da CSLL\. Sem ele/.test(missao(rodarC(G, ORI, base), 'lucro').texto)
    && /antes do IRPJ e da CSLL\. O escritório não faz a contabilidade dela: o lucro vem do contador de lá ou do cliente\. Sem ele/.test(missao(rodarC(G, ORI, { ...base, contabil: { faz: false, feitaAte: null } }), 'lucro').texto));

  console.log('=== seguir com a estimativa ===');
  const gE = rodarC(G, { ...ORI, lucroContabil: { fonte: 'confirmado' } }, base);
  ok('a missão fica cumprida "pela estimativa", e a fase 2 fecha com o alerta', missao(gE, 'lucro').estado === 'feita' && missao(gE, 'lucro').como === 'pela estimativa' && gE.fases[1].concluida && gE.fases[1].alerta === true
    && /^No Real, lucro de R\$\s345\.930 em 2027, pela estimativa: IRPJ e CSLL de R\$\s93\.616\.$/.test(gE.fases[1].conquista), gE.fases[1].conquista);

  console.log('=== com o lucro da contabilidade ===');
  const oriL = { ...ORI, lucroContabil: { fonte: 'digitado' } };
  // com a confirmação de quem cuida da contabilidade (até setembro): sem ela, o estudo segue provisório (abaixo)
  const oriLC = { ...oriL, lucroConfirmado: { fonte: 'confirmado', ate: '2026-09', nome: 'Samuel', em: '2026-11-11' } };
  const gL = rodarC({ ...G, lucroContabil: 100000 }, oriLC, { ...base, contabil: { faz: true, feitaAte: '2026-09' } });
  const lucL = missao(gL, 'lucro');
  // a troca de 2027: os tributos de hoje (PIS/Cofins 30.295 + ICMS 110.000) menos os do Real (ICMS 110.000 + CBS/IBS 44.070) = −13.775
  ok('cumprida, com a DRE, o lucro do Real e a troca dos tributos', lucL.estado === 'feita' && lucL.como === 'digitado' && lucL.peso === 'decide'
    && /^Lucro de R\$\s100\.000 na DRE de out\/25 a set\/26\. No Real de 2027, lucro de R\$\s86\.225 antes do IR: o da DRE menos R\$\s13\.775 da troca dos tributos de hoje pelos do Real\./.test(lucL.texto)
    && /Pelo Controle das contabilidades, ela está feita até set\/26\.$/.test(lucL.texto), lucL.texto);
  ok('a fase 2 fecha: lucro de R$ 86.225 pela contabilidade, IRPJ e CSLL de R$ 20.694 (24%)', gL.fases[1].concluida && !gL.fases[1].alerta && gL.fases[1].conquista === 'No Real, lucro de ' + gL.fases[1].conquista.match(/R\$\s86\.225/)[0] + ' em 2027, pela contabilidade: IRPJ e CSLL de ' + gL.fases[1].conquista.match(/R\$\s20\.694/)[0] + '.', gL.fases[1].conquista);
  ok('as adições e as exclusões: extra, no padrão (zero), com o "Sem ajustes"', missao(gL, 'ajustes').peso === 'detalhe' && missao(gL, 'ajustes').estado === 'aberta' && missao(gL, 'ajustes').conferirRotulo === 'Sem ajustes' && missao(gL, 'ajustes').campo === 'ajustesLalur');
  ok('com a DRE, a folha vira extra: o INSS é igual nos dois e a DRE já traz a folha', missao(gL, 'folha').peso === 'detalhe' && /O INSS é igual no Presumido e no Real, e a DRE já traz a folha: não muda a diferença entre os dois\.$/.test(missao(gL, 'folha').texto));
  ok('com a DRE, o PIS/Cofins de hoje entra no lucro do Real (é o que a DRE descontou)', /mas o PIS\/Cofins de hoje entra no lucro do Real: é o que a DRE descontou\.$/.test(missao(gL, 'piscofins').texto) && missao(gL, 'piscofins').peso === 'importa');
  ok('sem missão que decide aberta: quase lá, não provisório', !gL.provisorio && !gL.pronto);
  // a DRE em R$ 115.000: lucro do Real de 101.225 (acima do empate de 95.000: Presumido); sem PIS/Cofins nas vendas, 70.930: Real
  const gV = rodarC({ ...G, lucroContabil: 115000 }, oriL, base);
  ok('quando a alíquota zero vira o resultado, a missão decide e diz pra qual regime', missao(gV, 'piscofins').peso === 'decide' && /Com alíquota zero em toda a venda, o mais barato passa a ser o Lucro Real\.$/.test(missao(gV, 'piscofins').texto)
    && missao(gV, 'piscofins').efeito === 'com alíquota zero em toda a venda, o mais barato passa a ser o Lucro Real' && gV.provisorio && !missao(gV, 'premissa:atividades.0.pctAliqZero') && !missao(gV, 'premissa:atividades.0.pctMonofasico'), missao(gV, 'piscofins').texto);
  ok('prejuízo na DRE: a missão diz prejuízo', /^Prejuízo de R\$\s50\.000 na DRE de out\/25 a set\/26\./.test(missao(rodarC({ ...G, lucroContabil: -50000 }, oriL, base), 'lucro').texto));

  console.log('=== o estudo pronto, só Presumido × Real ===');
  const tudo = { ...oriLC, ajustesLalur: { fonte: 'confirmado' }, 'atividades.0.tipo': { fonte: 'confirmado' }, 'atividades.0.pctAliqZero': { fonte: 'confirmado' }, crescimentoReceita: { fonte: 'confirmado' },
    aliqCreditoIcms: { fonte: 'confirmado' }, 'atividades.0.aliqIcms': { fonte: 'confirmado' }, pctComprasSimples: { fonte: 'confirmado' } };
  const gP = rodarC({ ...G, lucroContabil: 100000 }, tudo, base);
  ok('pronto pra apresentar, com as quatro fases fechadas', gP.pronto && !gP.provisorio && gP.faseAtual === 3 && gP.fases.every(f => f.concluida) && gP.proximo === null);
  // IRPJ 15% × 8% × 1.000.000 = 12.000; CSLL 9% × 12% × 1.000.000 = 10.800
  ok('a fase 1 conquistou: o IRPJ e a CSLL do Presumido de 2027, R$ 22.800 (2,28% da receita)', /^No Presumido, o IRPJ e a CSLL de 2027 dão R\$\s22\.800 \(2,28% da receita\)\.$/.test(gP.fases[0].conquista), gP.fases[0].conquista);
  ok('o veredito é a frase da decisão: o Real, R$ 2.106 a menos que o Presumido', gP.fases[3].conquista === fraseDaDecisao(comparar({ ...G, lucroContabil: 100000, regimes: ['presumido', 'real'] })) && /Lucro Real sai mais barato/.test(gP.fases[3].conquista) && /R\$\s2\.106,00 a menos que o Lucro Presumido/.test(gP.fases[3].conquista));
  ok('acima de R$ 78 milhões: a fase 1 avisa que o Real é obrigatório no ano seguinte', (() => { const r = rodarC({ ...G, atividades: [{ ...G.atividades[0], receita: 80000000 }], compras: 40000000, lucroContabil: 100000 }, tudo, base);
    return r.fases[0].alerta === true && /^A receita passa de R\$ 78 milhões: no ano seguinte a empresa é obrigada ao Lucro Real \(Lei 9\.718, arts\. 13 e 14\)\.$/.test(r.fases[0].conquista); })());

  console.log('=== as fontes de cada fase, só Presumido × Real ===');
  const fo = fontesDoEstudo({ entrada: G, origens: ORI, comparacao: comparar({ ...G, regimes: ['presumido', 'real'] }), serie, hoje: '2026-11-11', objetivo: 'presumido_real', contabil: { faz: true, feitaAte: '2026-07' } });
  ok('as fontes por fase do caminho', Object.keys(fo).join() === 'presuncao,lucro,premissas,veredito' && fo.presuncao.map(x => x.id).join() === 'receita,atividade' && fo.lucro.map(x => x.id).join() === 'dre,ctbconf,folha'
    && fo.premissas.map(x => x.id).join() === 'compras,credito,icms,piscofins,crescimento' && fo.veredito.map(x => x.id).join() === 'conversa', Object.entries(fo).map(([k, l]) => k + ':' + l.map(x => x.id)));
  const dre = fo.lucro[0];
  ok('a DRE: falta, no Domínio Contabilidade, até onde a contabilidade está feita (os outros meses pela margem) — e a ponte ainda não leu o resultado desta empresa', dre.estado === 'falta' && dre.campo === 'lucroContabil'
    && dre.onde === 'Domínio Contabilidade: a DRE (ou o balancete) de out/25 a jul/26, até onde a contabilidade está feita — o resultado antes do IRPJ e da CSLL. Ago/26 e set/26 entram pela margem dos outros meses. Pelo Controle das contabilidades, ela está feita até jul/26.'
    && dre.auto === 'A ponte do Domínio ainda não leu o resultado da contabilidade desta empresa: por enquanto, digite o lucro da DRE.' && dre.auto === AUTOMATICO.semResultado, dre);
  ok('a confirmação da contabilidade: falta, com quem confirmar e até que mês', fo.lucro[1].estado === 'falta' && fo.lucro[1].situacao === 'falta confirmar' && fo.lucro[1].onde === 'Quem faz a contabilidade dela: se o resultado até jul/26 é confiável.'
    && fo.lucro[1].auto === 'Nenhum sistema tem: é a palavra de quem fecha a contabilidade.', fo.lucro[1]);
  ok('a atividade sem as notas: pelo CNAE do cadastro, e a linha diz onde resolver', fo.presuncao[1].estado === 'padrao' && fo.presuncao[1].situacao === 'sem notas no sistema: pelo CNAE do cadastro'
    && fo.presuncao[1].onde === 'O sistema não tem as notas desta empresa: a atividade veio do CNAE do cadastro. A regra e o que fazer estão na missão abaixo.'
    && fo.presuncao[1].auto === 'Com a empresa no Domínio, a ponte traz essa divisão pelas notas, todo dia.', fo.presuncao[1]);
  ok('a folha zerada pela ponte: "sem folha nem pró-labore no Domínio"', fo.lucro[2].id === 'folha' && fo.lucro[2].estado === 'tem' && fo.lucro[2].situacao === 'sem folha nem pró-labore no Domínio');
  ok('o veredito: a reunião, com o Real trimestral ou anual e a distribuição de lucros', /a projeção do lucro e as escolhas — o Real trimestral ou anual e a distribuição de lucros aos sócios\.$/.test(fo.veredito[0].onde), fo.veredito[0].onde);
  const foL = fontesDoEstudo({ entrada: { ...G, lucroContabil: 100000 }, origens: oriL, comparacao: comparar({ ...G, lucroContabil: 100000, regimes: ['presumido', 'real'] }), serie, hoje: '2026-11-11', objetivo: 'presumido_real', contabil: { faz: true, feitaAte: '2026-07' } });
  ok('com a DRE dos 12 meses digitada e a contabilidade atrás: a linha diz que ela vai além do que está feito, e as adições e exclusões no padrão', foL.lucro[0].estado === 'antigo'
    && foL.lucro[0].situacao === 'digitado: a DRE de out/25 a set/26, além do que a contabilidade tem feito (jul/26)' && foL.lucro.map(x => x.id).join() === 'dre,ctbconf,lalur,folha' && foL.lucro[2].estado === 'padrao', foL.lucro[0]);

  console.log('=== a atividade e a presunção pelas notas do Domínio (11/11/2026) ===');
  {
    // Pedido do Samuel: "não ficou claro o que preciso fazer, como temos acesso nas notas fiscais pela ponte da domínio, não
    // ficaria mais fácil para o próprio sistema apurar essa informação?" — com a divisão medida nas notas, a missão vem
    // cumprida sozinha; aberta, só com o que a nota não diz, e dizendo o que fazer
    const notas = (merc, serv, x = {}) => ({ divisao: { fonte: 'ponte', de: '2025-10', ate: '2026-09', n: 12, mercadorias: merc, servicos: serv }, especial: null, lida: true, ...x });
    const comNotas = rodarC(G, ORI, { ...base, atividade: notas(1000000, 0) }), mN = missao(comNotas, 'presuncao');
    ok('100% de mercadoria nas notas: a missão vem cumprida, sem ninguém conferir, e diz de onde saiu', mN.estado === 'feita' && mN.como === 'apurado pelas notas do Domínio'
      && /^Nas notas do Domínio de out\/25 a set\/26, toda a receita é venda de mercadoria\. A conta usou: Comércio \(revenda de mercadorias\), 8% no IRPJ e 12% na CSLL sobre R\$\s1\.000\.000\.$/.test(mN.texto), mN.texto);
    ok('a origem gravada como "pelo CNAE — confira" não segura a missão: vale a medida de hoje', ORI['atividades.0.tipo'].fonte === 'cadastro' && comNotas.fases[0].concluida && comNotas.proximo.id !== 'presuncao');
    const fN = comNotas.fases[0].fontes.find(x => x.id === 'atividade');
    ok('a fonte da fase: tem, apurado pelas notas, com o período e a ponte de todo dia', fN.estado === 'tem' && fN.situacao === 'apurado pelas notas do Domínio, de out/25 a set/26'
      && fN.onde === 'As notas de saída e de serviço do Domínio: toda a receita é venda de mercadoria. Venda de mercadoria presume 8% no IRPJ e 12% na CSLL; serviço, 32% nos dois.' && fN.auto === AUTOMATICO.ponte, fN);
    ok('a precisão: a presunção já está na conta, pelas notas', precisaoDoEstudo(comNotas).tem.some(x => x.id === 'presuncao' && x.como === 'apurado pelas notas do Domínio') && !precisaoDoEstudo(comNotas).falta.some(x => x.id === 'presuncao'));
    // serviço com um resto de mercadoria (R$ 400 em R$ 1 milhão): as duas linhas, e as notas dizem as partes
    const Gm = comP({ atividades: [{ tipo: 'comercio', receita: 400 }, { tipo: 'servico_r', receita: 999600 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' });
    const mM = missao(rodarC(Gm, { ...ORI, 'atividades.1.tipo': { fonte: 'cadastro' }, 'atividades.1.receita': { fonte: 'ponte' } }, { ...base, atividade: notas(400, 999600) }), 'presuncao');
    ok('serviço e um resto de mercadoria: as partes das notas e a presunção de cada linha', mM.estado === 'feita'
      && /^Nas notas do Domínio de out\/25 a set\/26, 99,96% é de serviço e 0,04% é venda de mercadoria\. A conta usou: Comércio \(revenda de mercadorias\), 8% no IRPJ e 12% na CSLL sobre R\$\s400; Serviços, 32% no IRPJ e 32% na CSLL sobre R\$\s999\.600\.$/.test(mM.texto), mM.texto);
    ok('a medida do caso da Reforma (o faturamento do Domínio) e a de menos de 12 meses', (() => {
      const m = missao(rodarC(G, ORI, { ...base, atividade: { divisao: { fonte: 'reforma', de: '2026-05', ate: '2026-09', n: 5, mercadorias: 10, servicos: 0 } } }), 'presuncao');
      return m.estado === 'feita' && m.como === 'apurado pelo faturamento do Domínio' && /^No faturamento do Domínio de mai\/26 a set\/26 \(5 meses\), toda a receita é venda de mercadoria\./.test(m.texto); })());
    // o estudo que não bate com as notas (a receita de serviço posta à mão): aberta, dizendo as duas divisões
    const Gd = comP({ atividades: [{ tipo: 'comercio', receita: 600000 }, { tipo: 'servico', receita: 200000 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' });
    const oriD = { ...ORI, 'atividades.0.tipo': { fonte: 'ponte' }, 'atividades.1.receita': { fonte: 'digitado' } };
    const rD = rodarC(Gd, oriD, { ...base, atividade: notas(1000000, 0) }), mD = missao(rD, 'presuncao');
    ok('o estudo não bate com as notas: aberta, com as duas divisões e o que fazer', mD.estado === 'aberta' && mD.peso === 'importa' && mD.conferirRotulo === 'Está certa' && mD.conferir.join() === 'atividades.0.tipo,atividades.1.tipo'
      && /^Nas notas do Domínio de out\/25 a set\/26, toda a receita é venda de mercadoria; no estudo, 75% é venda de mercadoria e 25% é de serviço\. A conta usou: /.test(mD.texto)
      && / Acerte a receita de cada atividade pra ficar como as notas; se o estudo é que está certo, clique em Está certa\.$/.test(mD.texto), mD.texto);
    ok('a fonte, quando não bate: "o estudo não bate com as notas do Domínio"', rD.fases[0].fontes.find(x => x.id === 'atividade').situacao === 'o estudo não bate com as notas do Domínio'
      && /no estudo, 75% é venda de mercadoria e 25% é de serviço\. Acerte na missão abaixo\.$/.test(rD.fases[0].fontes.find(x => x.id === 'atividade').onde));
    ok('"Está certa" (a origem de cada atividade conferida) fecha a missão', missao(rodarC(Gd, { ...oriD, 'atividades.0.tipo': { fonte: 'confirmado' }, 'atividades.1.tipo': { fonte: 'confirmado' } }, { ...base, atividade: notas(1000000, 0) }), 'presuncao').como === 'conferido');
    ok('a atividade que a equipe escolheu (digitada, ou do relatório solto) vale como está, mesmo sem bater', ['digitado', 'dominio'].every(f => { const m = missao(rodarC(Gd, { ...oriD, 'atividades.0.tipo': { fonte: f }, 'atividades.1.tipo': { fonte: f } }, { ...base, atividade: notas(1000000, 0) }), 'presuncao');
      return m.estado === 'feita' && m.como === (f === 'digitado' ? 'digitado' : 'veio do relatório do Domínio') && /^A conta usou: /.test(m.texto); }));
    ok('até 1 ponto de diferença, bate', presuncaoDoEstudo({ entrada: Gd, origens: oriD, atividade: notas(755000, 245000) }).caso === 'notas' && presuncaoDoEstudo({ entrada: Gd, origens: oriD, atividade: notas(770000, 230000) }).caso === 'diverge');
    // o Domínio lido e sem nota (a ponte leu a empresa): a frase muda, e não promete o que a ponte já faz
    const mZ = missao(rodarC(G, ORI, { ...base, atividade: { divisao: null, especial: null, lida: true } }), 'presuncao');
    ok('a ponte leu e o Domínio não tem nota: a missão e a fonte dizem isso', /^O Domínio não tem nota de saída nem de serviço desta empresa nos meses fechados: a atividade veio do CNAE do cadastro\./.test(mZ.texto)
      && (() => { const f = rodarC(G, ORI, { ...base, atividade: { divisao: null, especial: null, lida: true } }).fases[0].fontes.find(x => x.id === 'atividade'); return f.situacao === 'sem nota no Domínio: pelo CNAE do cadastro' && f.auto === null; })(), mZ.texto);

    // a presunção própria do CNAE: a nota não diz, e a missão decide — com a regra e o que fazer
    const obra = presuncaoPeloCnae('4120-4/00 - Construção de edifícios');
    const Go = comP({ atividades: [{ tipo: 'servico_iv', receita: 960000 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' });
    const rO = rodarC(Go, ORI, { ...base, atividade: notas(0, 960000, { especial: obra }) }), mO = missao(rO, 'presuncao');
    ok('a construtora: a missão fica aberta e decide, com a regra da obra, o que a conta usou e o que fazer', mO.estado === 'aberta' && mO.peso === 'decide' && mO.campo === 'atividades.0.presIrpj' && mO.irRotulo === 'Ver a presunção' && mO.conferirRotulo === 'Está certa'
      && /^O CNAE da empresa é de construção \(4120-4\/00\)\. A obra por empreitada com todos os materiais por conta da empresa presume 8% no IRPJ e 12% na CSLL; só com a mão de obra, ou com parte dos materiais, 32% nos dois\. A conta usou: Serviços, 32% no IRPJ e 32% na CSLL sobre R\$\s960\.000\. Veja nos contratos das obras: na receita das feitas com todos os materiais, ponha 8 e 12 na presunção\. Se a conta já está como deve, clique em Está certa\.$/.test(mO.texto)
      && rO.provisorio && mO.efeito === 'a presunção própria da atividade (construção) muda o IRPJ e a CSLL do Presumido', mO.texto);
    const fO = rO.fases[0].fontes.find(x => x.id === 'atividade');
    ok('a fonte da construtora: falta conferir a presunção, e aponta a missão (sem repetir a regra)', fO.estado === 'padrao' && fO.situacao === 'CNAE de construção: falta conferir a presunção'
      && fO.onde === 'Em construção, a presunção depende do que as notas do Domínio não dizem. A regra e o que fazer estão na missão abaixo.' && fO.auto === null, fO);
    ok('a presunção digitada na atividade resolve (volta a valer o que as notas dizem)', (() => { const m = missao(rodarC({ ...Go, atividades: [{ ...Go.atividades[0], presIrpj: 8, presCsll: 12 }] }, { ...ORI, 'atividades.0.presIrpj': { fonte: 'digitado' } }, { ...base, atividade: notas(0, 960000, { especial: obra }) }), 'presuncao');
      return m.estado === 'feita' && m.como === 'apurado pelas notas do Domínio' && / A conta usou: Serviços, 8% no IRPJ e 12% na CSLL sobre /.test(m.texto); })());
    ok('"Está certa" também resolve', missao(rodarC(Go, { ...ORI, 'atividades.0.tipo': { fonte: 'confirmado' } }, { ...base, atividade: notas(0, 960000, { especial: obra }) }), 'presuncao').como === 'conferido');
    // o transporte vale pra receita toda: o sistema já põe na conta, e a missão vem cumprida pelo CNAE
    const passag = presuncaoPeloCnae('4929-9/01');
    const Gp = comP({ atividades: [{ tipo: 'servico', receita: 480000, presIrpj: 16, presCsll: 12 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' });
    const mP = missao(rodarC(Gp, ORI, { ...base, atividade: notas(0, 480000, { especial: passag }) }), 'presuncao');
    ok('o transporte de passageiros com 16 e 12 na conta: cumprida pelo CNAE', mP.estado === 'feita' && mP.como === 'pelo CNAE: transporte de passageiros'
      && /^O transporte de passageiros presume 16% no IRPJ e 12% na CSLL\. A conta usou: Serviços, 16% no IRPJ e 12% na CSLL sobre R\$\s480\.000\.$/.test(mP.texto), mP.texto);
    const mP2 = missao(rodarC({ ...Gp, atividades: [{ tipo: 'servico', receita: 480000 }] }, ORI, { ...base, atividade: notas(0, 480000, { especial: passag }) }), 'presuncao');
    ok('o estudo gravado antes, ainda com 32%: aberta, mandando pôr 16 e 12', mP2.estado === 'aberta' && mP2.peso === 'decide' && / Ponha 16 e 12 na presunção da atividade\. Se a conta já está como deve, clique em Está certa\.$/.test(mP2.texto), mP2.texto);
    // só serviço e até R$ 120 mil no ano: a dica dos 16% do IRPJ (Lei 9.250/1995, art. 40)
    const Gs = comP({ atividades: [{ tipo: 'servico', receita: 96000 }], compras: 0, regimeAtual: 'presumido', objetivo: 'presumido_real' });
    ok('serviço de até R$ 120 mil no ano: a missão lembra os 16% do IRPJ; acima disso, com mercadoria ou já com 16, não', / Só com serviço e até R\$ 120 mil de receita no ano, a empresa pode presumir 16% no IRPJ, se não for de profissão regulamentada \(Lei 9\.250\/1995, art\. 40\): se for o caso, ponha 16 na presunção do IRPJ\.$/.test(missao(rodarC(Gs, ORI, { ...base, atividade: notas(0, 96000) }), 'presuncao').texto)
      && !/120 mil/.test(missao(rodarC({ ...Gs, atividades: [{ tipo: 'servico', receita: 120001 }] }, ORI, { ...base, atividade: notas(0, 1) }), 'presuncao').texto)
      && !/120 mil/.test(missao(rodarC({ ...Gs, atividades: [{ tipo: 'servico', receita: 96000, presIrpj: 16 }] }, ORI, { ...base, atividade: notas(0, 1) }), 'presuncao').texto)
      && !/120 mil/.test(mN.texto));
    ok('nada do Simples nessas missões e fontes (nem anexo, nem DAS, nem PGDAS)', [comNotas, rD, rO].every(r => !/Anexo [IV]|[Aa]nexo do|fator r|\bDAS\b|PGDAS|Simples/.test(JSON.stringify([missao(r, 'presuncao'), r.fases[0].fontes.find(x => x.id === 'atividade')]))));

    // com o Simples na comparação: a presunção só vira missão com a presunção própria do CNAE (a coluna do Presumido)
    const To = { ...Go, objetivo: 'todos', regimeAtual: 'simples' };
    const tO = rodarC(To, ORI, { ...base, socios: 2, atividade: notas(0, 960000, { especial: obra }) }), mTO = missao(tO, 'presuncao');
    ok('a construtora do Simples comparando os três: "A presunção do Presumido", nos números da empresa, com a marca da missão', mTO && mTO.fase === 'numeros' && mTO.titulo === 'A presunção do Presumido' && mTO.estado === 'aberta' && mTO.peso === 'importa'
      && mTO.conferir.join() === 'presuncao' && /^O CNAE da empresa é de construção/.test(mTO.texto), mTO);
    ok('"Está certa" ali marca a missão, sem mexer na origem da atividade', missao(rodarC(To, { ...ORI, presuncao: { fonte: 'confirmado' } }, { ...base, socios: 2, atividade: notas(0, 960000, { especial: obra }) }), 'presuncao').estado === 'feita');
    ok('sem presunção própria, o caminho com o Simples segue sem a missão (e sem a fonte)', !missao(rodarC({ ...G, objetivo: 'todos' }, ORI, { ...base, socios: 2, atividade: notas(1000000, 0) }), 'presuncao')
      && !rodarC({ ...G, objetivo: 'todos' }, ORI, { ...base, socios: 2, atividade: notas(1000000, 0) }).fases.flatMap(f => f.fontes).some(x => x.id === 'atividade'));
  }

  console.log('=== os impedimentos do Simples, no caminho com o Simples ===');
  const T = { ...G, objetivo: 'todos' };
  const imp = { vedado: true, impedimentos: [{ tipo: 'cnae', texto: 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária)', base: 'Res. CGSN 140/2018, art. 8º, §1º, I, e Anexo VI', remedio: 'Basta constar no CNPJ pra impedir a opção. Se a empresa não exerce a atividade, tirar o CNAE por alteração resolve.' },
    { tipo: 'socio_pj', texto: 'Pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital)', base: 'LC 123, art. 3º, §4º, I' }], conferir: [], semDado: [], secundarios: 2, comSocios: true };
  const tV = rodarC(T, ORI, { ...base, vedacoes: imp, socios: 2 });
  const mv = missao(tV, 'vedacoes');
  ok('com impedimento: a missão decide, aberta, na fase 1 ("pode entrar"), e o estudo é provisório', mv.fase === 'simples' && mv.estado === 'aberta' && mv.peso === 'decide' && tV.provisorio && tV.fases[0].titulo === 'Ela pode entrar no Simples?' && tV.proximo.id === 'vedacoes');
  ok('o texto: vedado hoje, cada impedimento com a base, o remédio e a conta como simulação', /^O Simples está vedado hoje\. CNAE secundário impeditivo: 7820-5\/00 \(Locação de mão-de-obra temporária\) \(Res\. CGSN 140\/2018, art\. 8º, §1º, I, e Anexo VI\); Pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA \(50% do capital\) \(LC 123, art\. 3º, §4º, I\)\./.test(mv.texto)
    && /tirar o CNAE por alteração resolve\. A conta do Simples vale como simulação: só serve se a empresa tirar os impedimentos\.$/.test(mv.texto) && mv.conferirRotulo === 'Vai tirar os impedimentos' && mv.conferir.join() === 'vedacoes', mv.texto);
  const tV2 = rodarC(T, { ...ORI, vedacoes: { fonte: 'confirmado' } }, { ...base, vedacoes: imp, socios: 2 });
  ok('"vai tirar os impedimentos": a missão fecha como simulação, e a fase 1 conquista com o alerta', missao(tV2, 'vedacoes').estado === 'feita' && missao(tV2, 'vedacoes').como === 'simulação: a empresa vai tirar os impedimentos' && tV2.fases[0].concluida && tV2.fases[0].alerta === true
    && tV2.fases[0].conquista === 'O Simples está vedado hoje pelo cadastro: a conta dele vale como simulação, se a empresa tirar os impedimentos.', tV2.fases[0].conquista);
  const conf = { vedado: false, impedimentos: [], conferir: [{ tipo: 'debito', texto: 'O relatório de situação fiscal de 03/11/2026 tem 2 pendências na Receita ou na PGFN. Débito sem exigibilidade suspensa impede a opção', base: 'LC 123, art. 17, V' }], semDado: [], secundarios: 0, comSocios: true };
  const tC = rodarC(T, ORI, { ...base, vedacoes: conf, socios: 2 });
  ok('só com o que conferir (as pendências na Receita): a missão importa, com o "Conferido" e o que o sistema não confere', missao(tC, 'vedacoes').peso === 'importa' && missao(tC, 'vedacoes').estado === 'aberta' && missao(tC, 'vedacoes').conferirRotulo === 'Conferido'
    && /^Pelo cadastro, nada veda o Simples, mas há o que conferir: O relatório de situação fiscal de 03\/11\/2026 tem 2 pendências/.test(missao(tC, 'vedacoes').texto) && /O sistema não confere: sócio domiciliado no exterior/.test(missao(tC, 'vedacoes').texto) && !tC.provisorio);
  const limpo = { vedado: false, impedimentos: [], conferir: [], semDado: [], secundarios: 2, comSocios: true };
  const tL = rodarC(T, ORI, { ...base, vedacoes: limpo, socios: 2 });
  ok('sem nada: extra cumprida pelo sistema, dizendo o que o cadastro deixou conferir', missao(tL, 'vedacoes').peso === 'detalhe' && missao(tL, 'vedacoes').estado === 'feita' && missao(tL, 'vedacoes').como === 'o sistema olhou o cadastro'
    && /^Pelo cadastro, nada veda o Simples: o CNAE principal e os 2 secundários, a natureza jurídica e os sócios\. O sistema não confere: /.test(missao(tL, 'vedacoes').texto) && tL.fases[0].conquista === 'O Simples é uma opção em 2027 e 2028.', missao(tL, 'vedacoes').texto);
  const tS = rodarC(T, ORI, { ...base, vedacoes: { ...limpo, semDado: ['os sócios'], secundarios: 0, comSocios: false }, socios: 0 });
  ok('com dado faltando no cadastro: a extra fica aberta, com o que faltou e o "Conferido"', missao(tS, 'vedacoes').estado === 'aberta' && missao(tS, 'vedacoes').peso === 'detalhe' && missao(tS, 'vedacoes').conferir.join() === 'vedacoes'
    && /^Pelo cadastro, nada veda o Simples: o CNAE principal \(sem secundário no cadastro\) e a natureza jurídica\. Faltou no cadastro pra conferir: os sócios\./.test(missao(tS, 'vedacoes').texto) && tS.fases[0].concluida, missao(tS, 'vedacoes').texto);
  ok('sem as vedações (empresa sem cadastro), sem a missão', !missao(rodarC(T, ORI, { ...base, socios: null }), 'vedacoes'));
  ok('no caminho com o Simples, o lucro da contabilidade também entra (missão cumprida, com a DRE)', (() => { const m = missao(rodarC({ ...T, lucroContabil: 100000 }, oriL, { ...base, vedacoes: limpo, socios: 2 }), 'lucro');
    return m.estado === 'feita' && m.como === 'digitado' && /^Lucro de R\$\s100\.000 na DRE de out\/25 a set\/26: no Real de 2027, R\$\s86\.225 antes do IR, com os tributos de hoje trocados pelos do Real\.$/.test(m.texto); })());

  // com o Simples na comparação, as vendas com alíquota zero de PIS/Cofins não têm missão própria: sem a DRE, ficam entre
  // os outros padrões (só mexem no Presumido e no Real de 2026); com a DRE em R$ 115.000 na empresa do Presumido, viram o
  // resultado entre o Presumido e o Real (o PIS/Cofins de hoje entra no lucro do Real) e ganham a missão da premissa
  const tZ = rodarC(T, ORI, base), resto = missao(tZ, 'resto');
  ok('com o Simples: sem missão do PIS/Cofins das vendas; a alíquota zero entra nos outros padrões, com o nome', !missao(tZ, 'piscofins') && resto && resto.conferir.includes('atividades.0.pctAliqZero')
    && /as vendas com alíquota zero de PIS\/Cofins/.test(resto.texto) && !missao(tZ, 'premissa:atividades.0.pctAliqZero'), resto && resto.texto);
  ok('conferida, sai dos outros padrões', !(missao(rodarC(T, { ...ORI, 'atividades.0.pctAliqZero': { fonte: 'confirmado' } }, base), 'resto').conferir || []).includes('atividades.0.pctAliqZero'));
  // a empresa do Presumido acima do limite do Simples (R$ 6 milhões, compras de R$ 3 milhões), com a DRE em R$ 650.000:
  // os tributos de hoje que não são IR: ICMS 660.000 + PIS/Cofins 3,65% × 4.980.000 = 181.770 → 841.770; os do Real de 2027:
  // ICMS 660.000 + CBS/IBS 11,3% × (4.980.000 − 2.640.000) = 264.420 → 924.420; a troca: −82.650 → lucro de 567.350, acima
  // do empate (Presumido). Com toda a venda em alíquota zero, a DRE não descontou PIS/Cofins: a troca vai a −264.420 e o
  // lucro, a 385.580 — o Real passa a ser o mais barato
  const E6 = { ...T, atividades: [{ ...T.atividades[0], receita: 6000000, pctAliqZero: 0 }], compras: 3000000, lucroContabil: 650000 };
  const c6 = comparar({ ...E6, regimes: ['simples', 'presumido', 'real'] });
  const t6 = rodarC(E6, { ...ORI, lucroContabil: { fonte: 'digitado' } }, base), pz = missao(t6, 'premissa:atividades.0.pctAliqZero');
  ok('a conta à mão: lucro do Real de 2027 em R$ 567.350, e o Presumido mais barato (o Simples fora do limite)', Math.abs(c6.anos[1].real.lucro - 567350) < 0.01 && c6.decisao.melhor === 'presumido' && !c6.anos[1].simples.disponivel, { lucro: c6.anos[1].real.lucro, melhor: c6.decisao.melhor });
  ok('com a DRE na empresa do Presumido que compara os três: a alíquota zero vira o mais barato e ganha a missão que decide (fora dos outros padrões)',
    pz && pz.peso === 'decide' && pz.estado === 'aberta' && /^Está no padrão \(0%\)\. Com 100%, o mais barato passa a ser o Lucro Real\.$/.test(pz.texto) && pz.conferir.join() === 'atividades.0.pctAliqZero'
    && !((missao(t6, 'resto') || {}).conferir || []).includes('atividades.0.pctAliqZero') && t6.provisorio, pz && pz.texto);

  console.log('=== o lucro até onde a contabilidade está feita, e a confirmação de quem cuida dela (11/11/2026, 20h11) ===');
  {
    ok('os meses em faixas: um, dois, seguidos e misturados', faixasDeMeses(['2026-02']) === 'fev/26' && faixasDeMeses(['2025-12', '2025-11']) === 'nov/25 e dez/25'
      && faixasDeMeses(['2026-01', '2026-02', '2026-03', '2026-04']) === 'jan/26 a abr/26' && faixasDeMeses(['2025-10', '2026-01', '2026-02', '2026-03', '2026-07', '2026-03', 'x']) === 'out/25, jan/26 a mar/26 e jul/26'
      && faixasDeMeses(['2025-12', '2026-01', '2026-02']) === 'dez/25 a fev/26' && faixasDeMeses([]) === '');
    // a contabilidade da empresa, como o estudo lê (contabilDoEstudo): feita até julho, quem cuida, e o que o Domínio mostra
    const mesesC = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const prob = { '2025-11': [{ tipo: 'folha', valor: 1518 }], '2025-12': [{ tipo: 'folha', valor: 1518 }], '2026-01': [{ tipo: 'transitoria', valor: 2225.17 }], '2026-02': [{ tipo: 'caixa', valor: null }, { tipo: 'transitoria', valor: 7756.83 }],
      '2026-03': [{ tipo: 'transitoria', valor: 17950 }], '2026-04': [{ tipo: 'transitoria', valor: 51082 }], '2026-05': [{ tipo: 'transitoria', valor: 54531 }], '2026-06': [{ tipo: 'transitoria', valor: 63838 }], '2026-07': [{ tipo: 'transitoria', valor: 75170.81 }],
      '2026-08': [{ tipo: 'folha', valor: 1621 }, { tipo: 'transitoria', valor: 75170.81 }, { tipo: 'banco', valor: null }], '2026-09': [{ tipo: 'folha', valor: 1621 }, { tipo: 'transitoria', valor: 75170.81 }, { tipo: 'banco', valor: null }] };
    const ctb = { faz: true, feitaAte: '2026-07', responsavel: 'Adaini', bancoAte: '2026-06-11', meses: mesesC.map(c => ({ competencia: c, estado: c <= '2026-07' ? 'feita' : 'afazer', problemas: prob[c] || [] })) };
    const s = sinaisDaContabilidade(ctb, '2025-10', '2026-07');
    ok('o que o Domínio mostra de outubro a julho: por tipo, com os meses, o saldo do último e o banco mais atrasado', s.lidos === 10 && s.comProblema === 9 && s.naoFeitos.length === 0
      && s.itens.length === 4 && /^conta transitória ou a classificar com saldo de jan\/26 a jul\/26 \(R\$\s75\.171 em jul\/26\)$/.test(s.itens[0]) && s.itens[1] === 'a folha não entrou na contabilidade em nov/25 e dez/25'
      && s.itens[2] === 'o caixa fechou o mês negativo em fev/26' && s.itens[3] === 'a conta de banco mais atrasada está lançada até 11/06/2026', s);
    const s9 = sinaisDaContabilidade(ctb, '2025-10', '2026-09');
    ok('até setembro: os dois meses que o Controle não dá como feitos, e o banco sem lançamento neles', s9.naoFeitos.join() === '2026-08,2026-09' && s9.itens.includes('o banco ficou sem lançamento em ago/26 e set/26')
      && s9.itens.includes('a folha não entrou na contabilidade em nov/25, dez/25, ago/26 e set/26'), s9);
    ok('o banco lançado até o fim do período não é sinal; sem o Controle, fora do escritório ou sem o período, nada', !sinaisDaContabilidade({ ...ctb, bancoAte: '2026-07-31' }, '2025-10', '2026-07').itens.some(x => /banco/.test(x))
      && sinaisDaContabilidade(null, '2025-10', '2026-07') === null && sinaisDaContabilidade({ faz: false }, '2025-10', '2026-07') === null && sinaisDaContabilidade(ctb, null, null) === null
      && sinaisDaContabilidade({ faz: true, feitaAte: '2026-07', meses: [] }, '2025-10', '2026-07').lidos === 0);
    ok('a confirmação vale até o mês confirmado (e sem a marca, não existe)', confirmacaoDaContabilidade({ lucroConfirmado: { fonte: 'confirmado', ate: '2026-07', nome: 'Samuel', em: '2026-11-11' } }, '2026-07').vale === true
      && confirmacaoDaContabilidade({ lucroConfirmado: { fonte: 'confirmado', ate: '2026-07' } }, '2026-09').vale === false && confirmacaoDaContabilidade({ lucroConfirmado: { fonte: 'confirmado', ate: '2026-09' } }, '2026-07').vale === true
      && confirmacaoDaContabilidade({}, '2026-07') === null && confirmacaoDaContabilidade({ lucroConfirmado: { fonte: 'digitado' } }, '2026-07') === null);

    // sem o lucro: o estudo pede a DRE até julho, e a confirmação já mostra o que olhar
    const cx = { ...base, contabil: ctb };
    const L0 = lucroDoEstudo({ entrada: G, origens: ORI, serie, contabil: ctb });
    ok('o lucro do estudo, sem a DRE: a pedida vai de outubro a julho, e é com quem cuida da contabilidade que se confirma', L0.dre === null && L0.sug.ate === '2026-07' && L0.sug.meses === 10 && L0.de === '2025-10' && L0.ate === '2026-07'
      && L0.quem === 'quem cuida da contabilidade dela (Adaini)' && L0.conf === null && L0.sinais.comProblema === 9, L0);
    const h0 = rodarC(G, ORI, cx), c0 = missao(h0, 'contabil');
    ok('a missão da confirmação: aberta, decide, com o botão e o que o Domínio mostra', c0 && c0.fase === 'lucro' && c0.estado === 'aberta' && c0.peso === 'decide' && c0.confirmar.ate === '2026-07' && c0.confirmarRotulo === 'Confirmado com a contabilidade' && !c0.desfazer
      && /^Antes de apresentar, confirme com quem cuida da contabilidade dela \(Adaini\) se o resultado até jul\/26 é confiável: os meses conciliados e fechados, sem lançamento por fazer\. O que o Domínio mostra de out\/25 a jul\/26: conta transitória ou a classificar com saldo de jan\/26 a jul\/26 \(R\$\s75\.171 em jul\/26\); a folha não entrou na contabilidade em nov\/25 e dez\/25; o caixa fechou o mês negativo em fev\/26; a conta de banco mais atrasada está lançada até 11\/06\/2026\.$/.test(c0.texto)
      && c0.efeito === 'o lucro errado troca o resultado entre o Presumido e o Real', c0 && c0.texto);
    ok('a ordem na fase: o lucro, a confirmação e a folha', h0.fases[1].missoes.map(m => m.id).join() === 'lucro,contabil,folha', h0.fases[1].missoes.map(m => m.id));
    ok('quem segue com a estimativa não tem o que confirmar', !missao(rodarC(G, { ...ORI, lucroContabil: { fonte: 'confirmado' } }, cx), 'contabil'));
    ok('sem problema no Domínio, a missão diz; sem a leitura dele, não fala do Domínio', / O Domínio não aponta problema de out\/25 a jul\/26\.$/.test(missao(rodarC(G, ORI, { ...base, contabil: { ...ctb, bancoAte: null, meses: ctb.meses.map(m => ({ ...m, problemas: [] })) } }), 'contabil').texto)
      && !/Domínio/.test(missao(rodarC(G, ORI, { ...base, contabil: { faz: true, feitaAte: '2026-07', responsavel: 'Adaini' } }), 'contabil').texto));

    // a DRE de outubro a julho digitada: R$ 80.000 em 10 dos 12 meses (a receita é igual nos 12: fator 1,2)
    const eP = { ...G, lucroContabil: 80000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 1000000 * 10 / 12 };
    const hP = rodarC(eP, oriL, cx), lP = missao(hP, 'lucro'), cP = missao(hP, 'contabil');
    // 80.000 × 1,2 = 96.000; a troca de 2027 é a mesma (−13.775): 82.225 no Real
    ok('com a DRE até julho: os 10 dos 12 meses, os dois que faltam pela mesma margem e o lucro do Real', lP.estado === 'feita' && lP.como === 'digitado'
      && /^Lucro de R\$\s80\.000 na DRE de out\/25 a jul\/26 \(10 dos 12 meses da receita\): com ago\/26 e set\/26 pela mesma margem, lucro de R\$\s96\.000 nos 12 meses\. No Real de 2027, lucro de R\$\s82\.225 antes do IR: o da DRE menos R\$\s13\.775 da troca dos tributos de hoje pelos do Real\./.test(lP.texto)
      && /Pelo Controle das contabilidades, ela está feita até jul\/26\.$/.test(lP.texto), lP.texto);
    ok('sem a confirmação, o estudo segue provisório e a fase 2 não fecha', hP.provisorio && !hP.fases[1].concluida && cP.estado === 'aberta' && cP.peso === 'decide' && hP.fases[1].missoes.map(m => m.id).join() === 'lucro,contabil,ajustes,folha', hP.fases[1].missoes.map(m => m.id));
    const hC = rodarC(eP, { ...oriL, lucroConfirmado: { fonte: 'confirmado', ate: '2026-07', por: 'financeiro@macedoereis.com.br', nome: 'Samuel', em: '2026-11-11' } }, cx), cC = missao(hC, 'contabil');
    ok('confirmada: cumprida, com quem e quando, e o Desfazer', cC.estado === 'feita' && cC.como === 'confirmado por Samuel em 11/11/2026' && cC.confirmar === null && cC.desfazer === true && cC.desfazerRotulo === 'Desfazer a confirmação'
      && /^Samuel confirmou com quem cuida da contabilidade dela \(Adaini\) que o resultado até jul\/26 é confiável, em 11\/11\/2026\. O que o Domínio mostra de out\/25 a jul\/26: /.test(cC.texto), cC.texto);
    ok('com a confirmação, a fase 2 fecha e o lucro deixa de segurar o estudo', hC.fases[1].concluida && !hC.passos.some(p => p.estado !== 'feito' && p.peso === 'decide' && ['lucro', 'contabil'].includes(p.id))
      && /^No Real, lucro de R\$\s82\.225 em 2027, pela contabilidade: /.test(hC.fases[1].conquista), hC.fases[1].conquista);
    // a contabilidade andou até setembro e a DRE foi trocada pela dos 12 meses: a confirmação de julho não cobre
    const hN = rodarC({ ...G, lucroContabil: 100000, lucroDe: '2025-10', lucroAte: '2026-09' }, { ...oriL, lucroConfirmado: { fonte: 'confirmado', ate: '2026-07', nome: 'Samuel', em: '2026-11-11' } }, { ...base, contabil: { ...ctb, feitaAte: '2026-09' } });
    ok('a DRE passou do mês confirmado: a confirmação reabre, dizendo até onde ela foi', missao(hN, 'contabil').estado === 'aberta' && / A confirmação de 11\/11\/2026 foi até jul\/26, e a DRE agora vai até set\/26: confirme de novo\.$/.test(missao(hN, 'contabil').texto), missao(hN, 'contabil').texto);
    // a DRE dos 12 meses com a contabilidade feita só até julho: a missão do lucro e a da confirmação dizem
    const hA = rodarC({ ...G, lucroContabil: 100000 }, oriL, cx);
    ok('a DRE além do que o Controle dá como feito: as duas missões dizem', /Pelo Controle das contabilidades, ela está feita só até jul\/26: a DRE usada vai além disso\.$/.test(missao(hA, 'lucro').texto)
      && / Pelo Controle das contabilidades, ago\/26 e set\/26 ainda não estão feitos\.$/.test(missao(hA, 'contabil').texto) && missao(hA, 'contabil').confirmar.ate === '2026-09', missao(hA, 'contabil').texto);
    // a contabilidade andou e a DRE ficou pra trás: a missão do lucro manda atualizar
    ok('a contabilidade andou até setembro e a DRE ficou em julho: atualizar', / A contabilidade já está feita até set\/26: atualize o lucro com a DRE até lá\.$/.test(missao(rodarC(eP, oriL, { ...base, contabil: { ...ctb, feitaAte: '2026-09' } }), 'lucro').texto));
    // a contabilidade parada antes dos meses da receita: não há DRE a pedir
    const hZ = rodarC(G, ORI, { ...base, contabil: { faz: true, feitaAte: '2024-12', responsavel: 'Adaini', meses: [] } });
    ok('a contabilidade feita só até dez/24: nenhum dos meses da receita, e sem a missão da confirmação', /^Falta o lucro da DRE, antes do IRPJ e da CSLL\. Pelo Controle das contabilidades, ela está feita até dez\/24: nenhum dos meses da receita \(out\/25 a set\/26\)\. Sem ele, a conta estima/.test(missao(hZ, 'lucro').texto)
      && !missao(hZ, 'contabil') && /nenhum mês está feito: nenhum dos meses da receita/.test(missao(rodarC(G, ORI, { ...base, contabil: { faz: true, feitaAte: null, meses: [] } }), 'lucro').texto), missao(hZ, 'lucro').texto);
    // a contabilidade feita até dezembro: só 3 dos 12 meses da receita — a missão pede, e avisa que é pouco
    const hD = rodarC(G, ORI, { ...base, contabil: { ...ctb, feitaAte: '2025-12' } });
    ok('a contabilidade feita até dez/25: a DRE de 3 dos 12 meses, com o aviso de que é pouco', /use a DRE de out\/25 a dez\/25 \(3 dos 12 meses da receita\): os outros 9 entram pela margem desses 3\. São só 3 dos 12 meses: a margem deles pode não valer pro ano\. Sem ele, a conta estima/.test(missao(hD, 'lucro').texto)
      && missao(hD, 'contabil').confirmar.ate === '2025-12', missao(hD, 'lucro').texto);
    const hD2 = rodarC({ ...G, lucroContabil: 20000, lucroDe: '2025-10', lucroAte: '2025-12', lucroReceita: 250000 }, oriL, { ...base, contabil: { ...ctb, feitaAte: '2025-12' } });
    ok('com a DRE de 3 meses: os outros 9 pela mesma margem (R$ 80.000 nos 12 meses), com o mesmo aviso', /^Lucro de R\$\s20\.000 na DRE de out\/25 a dez\/25 \(3 dos 12 meses da receita\): com os outros 9 pela mesma margem, lucro de R\$\s80\.000 nos 12 meses\. São só 3 dos 12 meses: a margem deles pode não valer pro ano\. No Real de 2027/.test(missao(hD2, 'lucro').texto), missao(hD2, 'lucro').texto);
    ok('com 6 meses ou mais, sem o aviso', !/São só/.test(missao(h0, 'lucro').texto) && !/São só/.test(lP.texto));
    ok('fora do escritório: a confirmação é com o contador de lá', /^Antes de apresentar, confirme com o contador que faz a contabilidade dela se o resultado até set\/26 é confiável/.test(missao(rodarC({ ...G, lucroContabil: 100000 }, oriL, { ...base, contabil: { faz: false, feitaAte: null } }), 'contabil').texto)
      && /^Antes de apresentar, confirme com quem faz a contabilidade dela se o resultado até set\/26 é confiável/.test(missao(rodarC({ ...G, lucroContabil: 100000 }, oriL, base), 'contabil').texto));
    ok('no caminho com o Simples, a confirmação pesa, sem decidir', (() => { const m = missao(rodarC({ ...T, lucroContabil: 100000 }, oriL, { ...base, vedacoes: limpo, socios: 2, contabil: ctb }), 'contabil'); return m && m.peso === 'importa' && m.estado === 'aberta' && m.fase === 'numeros'; })());
    // as fontes da fase, com a DRE até julho
    const foP = fontesDoEstudo({ entrada: eP, origens: oriL, comparacao: comparar({ ...eP, regimes: ['presumido', 'real'], lucroFator: 1.2 }), serie, hoje: '2026-11-11', objetivo: 'presumido_real', contabil: ctb });
    ok('as fontes: a DRE de 10 de 12 meses ("faltam meses") e a confirmação com os meses que o Domínio aponta', foP.lucro[0].estado === 'antigo' && foP.lucro[0].situacao === 'digitado: a DRE de out/25 a jul/26 (10 de 12 meses)'
      && foP.lucro[1].id === 'ctbconf' && foP.lucro[1].onde === 'Quem cuida da contabilidade dela (Adaini): se o resultado até jul/26 é confiável. O Domínio aponta 9 de 10 meses com problema (na missão abaixo).', foP.lucro.slice(0, 2));

    // ---------- a pergunta do vigia (11/11/2026, 21h19: "Pra agora vai") ----------
    // o que a função comparativo_confirmacao do banco devolve, contra o mês até onde a contabilidade é usada
    const PG = { id: 'p1', ate: '2026-07', situacao: 'aberta', sim: false, para: 'Adaini', para_email: 'contabil@macedoereis.com.br', pedida_por: 'Samuel', criada_em: '2026-11-12T00:30:00+00:00', resposta: null, resposta_texto: null, respondida_em: null };
    const pgA = perguntaDaContabilidade(PG, '2026-07');
    ok('a pergunta aberta: o estado, quem recebe, quem pediu e o dia em Brasília (00h30 UTC do dia 12 é dia 11)', pgA.estado === 'aberta' && pgA.cobre === true && pgA.para === 'Adaini' && pgA.pedidaPor === 'Samuel' && pgA.em === '2026-11-11' && pgA.respondidaEm === null && pgA.ate === '2026-07', pgA);
    ok('a pergunta até um mês antes do usado não cobre; sem mês usado, cobre', perguntaDaContabilidade(PG, '2026-09').cobre === false && perguntaDaContabilidade({ ...PG, ate: '2026-09' }, '2026-07').cobre === true && perguntaDaContabilidade(PG, null).cobre === true);
    const SIM = { ...PG, situacao: 'respondida', sim: true, resposta: 'Sim, pode usar até jul/26', respondida_em: '2026-11-12T13:05:00+00:00' };
    const NAO = { ...PG, situacao: 'respondida', sim: false, resposta: 'Ainda não: falta acertar (digo o quê)', resposta_texto: '  falta o extrato\n de julho ', respondida_em: '2026-11-12T13:05:00+00:00' };
    ok('respondida: o sim, o não com o texto numa linha, e só o texto', perguntaDaContabilidade(SIM, '2026-07').estado === 'sim' && perguntaDaContabilidade(SIM, '2026-07').respondidaEm === '2026-11-12'
      && perguntaDaContabilidade(NAO, '2026-07').estado === 'nao' && perguntaDaContabilidade(NAO, '2026-07').texto === 'falta o extrato de julho'
      && perguntaDaContabilidade({ ...NAO, resposta: null }, '2026-07').resposta === null);
    ok('o que não é pergunta: nada, lista, sem id, sem mês, cancelada', [null, undefined, [], [PG], 'x', {}, { ...PG, id: null }, { ...PG, ate: 'jul/26' }, { ...PG, situacao: 'cancelada' }].every(x => perguntaDaContabilidade(x, '2026-07') === null));
    const comPg = pg => ({ ...base, contabil: { ...ctb, pergunta: pg } });
    // sem pergunta: a missão oferece perguntar, com o que o Domínio mostra pra ir junto
    ok('sem pergunta: a missão oferece a pergunta pra quem cuida, com os sinais do Domínio', c0.perguntar && c0.perguntar.ate === '2026-07' && c0.perguntar.para === 'Adaini' && c0.perguntarRotulo === 'Perguntar pra Adaini'
      && /^conta transitória ou a classificar com saldo de jan\/26 a jul\/26 \(R\$\s75\.171 em jul\/26\); a folha não entrou na contabilidade em nov\/25 e dez\/25; o caixa fechou o mês negativo em fev\/26; a conta de banco mais atrasada está lançada até 11\/06\/2026$/.test(c0.perguntar.sinais), c0.perguntar);
    ok('sem problema no Domínio, a pergunta vai sem os sinais; sem responsável no Controle, não há a quem perguntar', missao(rodarC(G, ORI, { ...base, contabil: { ...ctb, bancoAte: null, meses: ctb.meses.map(m => ({ ...m, problemas: [] })) } }), 'contabil').perguntar.sinais === null
      && missao(rodarC(G, ORI, { ...base, contabil: { ...ctb, responsavel: null } }), 'contabil').perguntar === null && missao(rodarC({ ...G, lucroContabil: 100000 }, oriL, base), 'contabil').perguntar === null
      && missao(rodarC({ ...G, lucroContabil: 100000 }, oriL, { ...base, contabil: { faz: false, feitaAte: null, responsavel: 'Adaini', pergunta: SIM } }), 'contabil').perguntar === null);
    // a pergunta aberta: a missão segue aberta, diz onde ela está e não oferece de novo (o clique de quem falou com ela segue valendo)
    const hQ = rodarC(eP, oriL, comPg(PG)), cQ = missao(hQ, 'contabil');
    ok('a pergunta no vigia, sem resposta: a missão diz desde quando, sem o botão de perguntar, e o estudo segue provisório', cQ.estado === 'aberta' && cQ.perguntar === null && cQ.confirmar.ate === '2026-07' && hQ.provisorio && !hQ.fases[1].concluida
      && / A pergunta está no vigia de Adaini desde 11\/11\/2026, sem resposta\.$/.test(cQ.texto), cQ.texto);
    // a resposta "sim" até o mês usado: confirma sozinha, sem clique, e não se desfaz por aqui (é a resposta dela)
    const hS = rodarC(eP, oriL, comPg(SIM)), cS = missao(hS, 'contabil');
    ok('o sim de quem cuida: a missão cumprida pelo vigia, sem o Desfazer, e a fase 2 fecha', cS.estado === 'feita' && cS.como === 'confirmado por Adaini em 12/11/2026, pelo vigia' && cS.desfazer === false && cS.confirmar === null && cS.perguntar === null
      && /^Adaini respondeu em 12\/11\/2026 que o resultado até jul\/26 é confiável \(a pergunta do vigia, feita por Samuel\)\. O que o Domínio mostra de out\/25 a jul\/26: /.test(cS.texto) && hS.fases[1].concluida, cS.texto);
    const LS = lucroDoEstudo({ entrada: eP, origens: oriL, serie, contabil: { ...ctb, pergunta: SIM } });
    ok('o lucro do estudo: confirmado pela pergunta (e não pela marca do estudo)', LS.confirmado === true && LS.pelaPergunta === true && LS.conf === null && LS.perg.estado === 'sim', [LS.confirmado, LS.pelaPergunta]);
    // a marca do estudo vem antes: com as duas, vale a de quem clicou (e o Desfazer é dela)
    const cM = missao(rodarC(eP, { ...oriL, lucroConfirmado: { fonte: 'confirmado', ate: '2026-07', nome: 'Samuel', em: '2026-11-11' } }, comPg(SIM)), 'contabil');
    ok('com a marca do estudo e o sim da pergunta, vale a marca (com o Desfazer)', cM.estado === 'feita' && cM.como === 'confirmado por Samuel em 11/11/2026' && cM.desfazer === true);
    // o "ainda não", com o que ela escreveu: aberta, com a resposta à vista, e dá pra perguntar de novo
    const cN = missao(rodarC(eP, oriL, comPg(NAO)), 'contabil');
    ok('o "ainda não": a missão mostra a resposta e o que ela escreveu, e oferece perguntar de novo', cN.estado === 'aberta' && cN.perguntar && cN.perguntarRotulo === 'Perguntar pra Adaini de novo'
      && / Adaini respondeu em 12\/11\/2026: "Ainda não: falta acertar \(digo o quê\)"\. Escreveu: "falta o extrato de julho"\.$/.test(cN.texto), cN.texto);
    ok('só o texto, sem opção: a resposta é o texto', / Adaini respondeu em 12\/11\/2026: "pode até maio"\.$/.test(missao(rodarC(eP, oriL, comPg({ ...NAO, resposta: null, resposta_texto: 'pode até maio' })), 'contabil').texto));
    // o sim até junho com a DRE até julho: não cobre — a missão diz e oferece perguntar de novo
    const cJ = missao(rodarC(eP, oriL, comPg({ ...SIM, ate: '2026-06', resposta: 'Sim, pode usar até jun/26' })), 'contabil');
    ok('o sim até um mês antes do usado não confirma: diz até onde foi e oferece perguntar de novo', cJ.estado === 'aberta' && cJ.perguntar && cJ.perguntar.ate === '2026-07' && / Adaini confirmou em 12\/11\/2026 só até jun\/26, e a DRE vai até jul\/26\.$/.test(cJ.texto), cJ.texto);
    // a pergunta aberta até junho com a DRE até julho: diz o mês dela e oferece perguntar até julho
    const cK = missao(rodarC(eP, oriL, comPg({ ...PG, ate: '2026-06' })), 'contabil');
    ok('a pergunta aberta de um mês antes: diz até onde ela vai e oferece a do mês usado', cK.perguntar && cK.perguntar.ate === '2026-07' && / A pergunta está no vigia de Adaini desde 11\/11\/2026, até jun\/26, sem resposta\.$/.test(cK.texto), cK.texto);
    // as fontes da fase acompanham
    const foDe = pg => fontesDoEstudo({ entrada: eP, origens: oriL, comparacao: comparar({ ...eP, regimes: ['presumido', 'real'], lucroFator: 1.2 }), serie, hoje: '2026-11-12', objetivo: 'presumido_real', contabil: { ...ctb, pergunta: pg } }).lucro.find(x => x.id === 'ctbconf');
    ok('as fontes: perguntado e sem resposta, confirmado pelo vigia, respondido sem confirmar', foDe(PG).estado === 'falta' && foDe(PG).situacao === 'perguntado a Adaini em 11/11/2026, sem resposta'
      && foDe(SIM).estado === 'tem' && foDe(SIM).situacao === 'confirmado por Adaini em 12/11/2026, pelo vigia' && foDe(NAO).estado === 'falta' && foDe(NAO).situacao === 'Adaini respondeu em 12/11/2026 e não confirmou'
      && foDe(null).situacao === 'falta confirmar', [foDe(PG).situacao, foDe(SIM).situacao, foDe(NAO).situacao]);
  }

  console.log('=== o lucro que a ponte do Domínio traz (11/11/2026, a versão 5): a missão oferece o de hoje ===');
  {
    // o resultado do Domínio: R$ 5.000 por mês, de outubro a setembro; a contabilidade feita até julho (10 meses: R$ 50.000;
    // a receita desses meses é 10/12 da do ano: nos 12 meses, R$ 60.000)
    const comps = serie.map(x => x.competencia);
    const res = (extra = {}) => comps.map(c => ({ competencia: c, lancamentos: 30, resultado: 5000, ircs: 0, financeiras: 0, ...(extra[c] || {}) }));
    const ctb = { faz: true, feitaAte: '2026-07', responsavel: 'Adaini', meses: [] };
    const cx = (r, k = ctb) => ({ ...base, contabil: k, resultadoPonte: r });
    ok('sem o resultado da ponte: nada lido, nada a oferecer', (() => { const P = ponteDoLucro({ entrada: G, origens: ORI, serie, contabil: ctb, resultadoPonte: null });
      return P.lido === false && P.hoje === null && P.oferta === null && P.reabre === false && ponteDoLucro({ entrada: G, origens: ORI, serie, contabil: ctb, resultadoPonte: [] }).lido === false; })());
    // 1) o estudo sem o lucro: a missão oferece o do Domínio
    const P0 = ponteDoLucro({ entrada: G, origens: ORI, serie, contabil: ctb, resultadoPonte: res() });
    ok('o estudo sem o lucro: o Domínio tem R$ 50.000 de outubro a julho, e a oferta é usar', P0.lido && P0.hoje.lucro === 50000 && P0.oferta.motivo === 'usar' && P0.oferta.rotulo === 'Usar o do Domínio' && P0.oferta.ate === '2026-07' && P0.reabre === false, P0);
    const m0 = missao(rodarC(G, ORI, cx(res())), 'lucro');
    ok('a missão do lucro, aberta: diz o que o Domínio tem e tem o botão dele, junto do digitar e do seguir com a estimativa', m0.estado === 'aberta' && m0.usarPonte.ate === '2026-07' && m0.usarPonteRotulo === 'Usar o do Domínio'
      && m0.campo === 'lucroContabil' && m0.conferirRotulo === 'Seguir com a estimativa' && / O Domínio tem o resultado de out\/25 a jul\/26 \(10 dos 12 meses da receita\): lucro de R\$\s50\.000\.$/.test(m0.texto), m0.texto);
    ok('o prejuízo do Domínio sai como prejuízo', / O Domínio tem o resultado de out\/25 a jul\/26 \(10 dos 12 meses da receita\): prejuízo de R\$\s30\.000\.$/.test(missao(rodarC(G, ORI, cx(res().map(x => ({ ...x, resultado: -3000 })))), 'lucro').texto));
    // 2) o lucro da ponte no estudo: a missão cumprida, sem botão
    const eP = { ...G }, oP = { ...ORI };
    aplicarLucroDaPonte(eP, oP, lucroDaPonte(serie, ctb, res()));
    const mP = missao(rodarC(eP, oP, cx(res())), 'lucro');
    ok('com o lucro da ponte: cumprida ("veio do Domínio pela ponte"), levado aos 12 meses, sem botão', mP.estado === 'feita' && mP.como === 'veio do Domínio pela ponte' && mP.usarPonte === null
      && /^Lucro de R\$\s50\.000 na DRE de out\/25 a jul\/26 \(10 dos 12 meses da receita\): com ago\/26 e set\/26 pela mesma margem, lucro de R\$\s60\.000 nos 12 meses\./.test(mP.texto) && !/Pelo Domínio|O Domínio mudou/.test(mP.texto), mP.texto);
    ok('a confirmação de quem cuida segue aberta: o número veio do sistema, a palavra é dela', missao(rodarC(eP, oP, cx(res())), 'contabil').estado === 'aberta' && rodarC(eP, oP, cx(res())).provisorio === true);
    // 3) a contabilidade andou (o Controle agora diz agosto): a missão oferece atualizar
    const k8 = { ...ctb, feitaAte: '2026-08' };
    const P8 = ponteDoLucro({ entrada: eP, origens: oP, serie, contabil: k8, resultadoPonte: res(), dre: periodoDaDre(serie, eP) });
    const m8 = missao(rodarC(eP, oP, cx(res(), k8)), 'lucro');
    ok('a contabilidade andou até agosto: a missão segue cumprida e oferece "Atualizar pelo Domínio" até lá', P8.oferta.motivo === 'andou' && P8.oferta.lucro === 55000 && P8.reabre === false && m8.estado === 'feita' && m8.usarPonte.ate === '2026-08'
      && m8.usarPonteRotulo === 'Atualizar pelo Domínio' && / A contabilidade já está feita até ago\/26: atualize o lucro com a DRE até lá\. Pelo Domínio, de out\/25 a ago\/26: lucro de R\$\s55\.000\.$/.test(m8.texto), m8.texto);
    // 4) o mesmo período, e o Domínio já mostra outro número (entrou lançamento em março): a missão reabre
    const mudou = res({ '2026-03': { resultado: 9000 } });
    const PM = ponteDoLucro({ entrada: eP, origens: oP, serie, contabil: ctb, resultadoPonte: mudou, dre: periodoDaDre(serie, eP) });
    const rM = rodarC(eP, oP, cx(mudou)), mM = missao(rM, 'lucro');
    ok('o Domínio mudou no mesmo período: a missão reabre (decide), com o número de hoje e o "Atualizar pelo Domínio"', PM.oferta.motivo === 'mudou' && PM.oferta.lucro === 54000 && PM.reabre === true && mM.estado === 'aberta' && mM.peso === 'decide'
      && mM.usarPonte.ate === '2026-07' && mM.usarPonteRotulo === 'Atualizar pelo Domínio' && / O Domínio mudou desde que o lucro entrou no estudo: de out\/25 a jul\/26, hoje ele mostra lucro de R\$\s54\.000\.$/.test(mM.texto)
      && mM.efeito === 'o lucro do estudo já não é o que o Domínio mostra: o IRPJ e a CSLL do Real saem dele' && rM.provisorio === true, mM.texto);
    ok('o mês que mudou fica depois do período do estudo: nada a atualizar', ponteDoLucro({ entrada: eP, origens: oP, serie, contabil: ctb, resultadoPonte: res({ '2026-09': { resultado: 1 } }), dre: periodoDaDre(serie, eP) }).oferta === null);
    // 5) o lucro digitado (R$ 45.000, de outubro a julho) e o Domínio com outro: cumprida, com o do Domínio pra comparar
    const eD = { ...G, lucroContabil: 45000, lucroDe: '2025-10', lucroAte: '2026-07' }, oD = { ...ORI, lucroContabil: { fonte: 'digitado' } };
    const mD = missao(rodarC(eD, oD, cx(res())), 'lucro');
    ok('o lucro digitado diferente do Domínio: a missão cumprida mostra o do Domínio e oferece usar', mD.estado === 'feita' && mD.como === 'digitado' && mD.usarPonte.ate === '2026-07' && mD.usarPonteRotulo === 'Usar o do Domínio'
      && / Pelo Domínio, o resultado de out\/25 a jul\/26 é lucro de R\$\s50\.000\.$/.test(mD.texto), mD.texto);
    ok('o lucro digitado igual ao do Domínio, no mesmo período: nada a oferecer', missao(rodarC({ ...eD, lucroContabil: 50000 }, oD, cx(res())), 'lucro').usarPonte === null);
    // 6) quem escolheu seguir com a estimativa: a missão cumprida oferece o do Domínio (não troca sozinha)
    const mE = missao(rodarC(G, { ...ORI, lucroContabil: { fonte: 'confirmado' } }, cx(res())), 'lucro');
    ok('seguindo com a estimativa: cumprida ("pela estimativa"), com o do Domínio à mão', mE.estado === 'feita' && mE.como === 'pela estimativa' && mE.usarPonte.ate === '2026-07' && / O Domínio tem o resultado de out\/25 a jul\/26/.test(mE.texto), mE.texto);
    // 7) o Controle dá junho e julho como feitos e o Domínio não tem lançamento em conta de resultado neles
    const semLanc = res({ '2026-06': { lancamentos: 0, resultado: null }, '2026-07': { lancamentos: 0, resultado: null } });
    const mS = missao(rodarC(G, ORI, cx(semLanc)), 'lucro');
    ok('meses feitos no Controle e sem lançamento de resultado no Domínio: sem oferta, e a missão diz quais', mS.usarPonte === null && mS.estado === 'aberta'
      && / O Domínio não tem lançamento em conta de resultado em jun\/26 e jul\/26, que o Controle das contabilidades dá como feitos: o resultado desses meses não está lá, e a ponte não traz o lucro\.$/.test(mS.texto), mS.texto);
    ok('um mês só: no singular', / em jul\/26, que o Controle das contabilidades dá como feito: o resultado desse mês não está lá/.test(missao(rodarC(G, ORI, cx(res({ '2026-07': { lancamentos: 0, resultado: null } }))), 'lucro').texto));
    // 8) a ponte sem um mês do período
    ok('a ponte sem o resultado de um mês do período: diz qual, sem oferta', (() => { const m = missao(rodarC(G, ORI, cx(res().filter(x => x.competencia !== '2026-02'))), 'lucro');
      return m.usarPonte === null && / A ponte do Domínio ainda não tem o resultado em fev\/26: o lucro não vem dela\.$/.test(m.texto); })());
    // 9) sem o Controle dizer até onde: a ponte leu, mas não há o que oferecer (o mês se escolhe na tela)
    ok('sem o Controle das contabilidades: lido, sem oferta e sem frase', (() => { const r = rodarC(G, ORI, { ...base, contabil: null, resultadoPonte: res() }), m = missao(r, 'lucro');
      return m.usarPonte === null && !/Domínio (tem|não tem)|ponte do Domínio/.test(m.texto); })());
    // as fontes da fase: com a ponte, o lucro é automático
    const fo2 = (e, o, r) => fontesDoEstudo({ entrada: e, origens: o, comparacao: comparar({ ...e, regimes: ['presumido', 'real'], lucroFator: e.lucroContabil != null ? 1.2 : 1 }), serie, hoje: '2026-11-12', objetivo: 'presumido_real', contabil: ctb, resultadoPonte: r });
    ok('as fontes: com o resultado pela ponte, a linha do lucro diz que é automático (e, sem ele, que a ponte ainda não leu)', fo2(eP, oP, res()).lucro[0].auto === AUTOMATICO.resultado && fo2(eP, oP, res()).lucro[0].situacao === 'veio do Domínio pela ponte: a DRE de out/25 a jul/26 (10 de 12 meses)'
      && fo2(G, ORI, null).lucro[0].auto === AUTOMATICO.semResultado && /Controle das contabilidades dá a contabilidade como feita/.test(AUTOMATICO.resultado), fo2(eP, oP, res()).lucro[0]);
    // a linha do PIS/Cofins: medido pelo CST das notas é automático; no padrão, diz quando a ponte traz
    const pcDe = o => fo2(G, o, null).premissas.find(x => x.id === 'piscofins');
    ok('as fontes do PIS/Cofins: pelo CST das notas, automático; no padrão, a ponte traz quando as notas têm o CST', pcDe({ ...ORI, 'atividades.0.pctAliqZero': { fonte: 'ponte', cst: true } }).auto === AUTOMATICO.ponte
      && pcDe({ ...ORI, 'atividades.0.pctAliqZero': { fonte: 'ponte', cst: true } }).estado === 'tem' && pcDe(ORI).auto === AUTOMATICO.cst && pcDe(ORI).estado === 'padrao', pcDe(ORI));
    ok('a missão do PIS/Cofins com a alíquota zero medida nas notas: cumprida pela ponte', (() => { const m = missao(rodarC({ ...G, atividades: [{ ...G.atividades[0], pctAliqZero: 0 }] }, { ...ORI, 'atividades.0.pctAliqZero': { fonte: 'ponte', cst: true } }, base), 'piscofins');
      return m.estado === 'feita' && m.como === 'veio do Domínio pela ponte'; })());
    // com o Simples na comparação: a missão "O lucro do Real" também oferece o do Domínio
    const T = comP({ atividades: [{ tipo: 'comercio', receita: 1000000 }], compras: 500000, regimeAtual: 'simples', objetivo: 'todos' });
    const mT = missao(rodarC(T, ORI, cx(res())), 'lucro');
    ok('com o Simples na comparação: a missão do lucro do Real tem o botão e a frase do Domínio', mT && mT.usarPonte && mT.usarPonte.ate === '2026-07' && mT.usarPonteRotulo === 'Usar o do Domínio' && / O Domínio tem o resultado de out\/25 a jul\/26 \(10 dos 12 meses da receita\): lucro de R\$\s50\.000\.$/.test(mT.texto), mT && mT.texto);
    const eT = { ...T }, oT = { ...ORI };
    aplicarLucroDaPonte(eT, oT, lucroDaPonte(serie, ctb, res()));
    ok('e, com o lucro da ponte no estudo, ela vem cumprida pela ponte', (() => { const m = missao(rodarC(eT, oT, cx(res())), 'lucro'); return m.estado === 'feita' && m.como === 'veio do Domínio pela ponte' && m.usarPonte === null; })());

    // ---------- os alertas do resultado, na confirmação de quem cuida da contabilidade ----------
    // (a) o mês em que o resultado passa da receita do mês: dezembro com prejuízo de R$ 200.000 (a receita do mês é R$ 83.333)
    const dez = res({ '2025-12': { resultado: -200000 } });
    ok('o lucro da ponte diz os meses atípicos: o resultado que passa da receita do mês e de metade da receita média', (() => { const a = lucroDaPonte(serie, ctb, dez).atipicos;
      return a.length === 1 && a[0].competencia === '2025-12' && a[0].resultado === -200000 && Math.abs(a[0].receita - 1000000 / 12) < 0.01 && lucroDaPonte(serie, ctb, res()).atipicos.length === 0; })());
    ok('o mês sem receita com o prejuízo pequeno do mês parado não é atípico; com o prejuízo do tamanho de um ano, é', (() => {
      const semJan = serie.filter(x => x.competencia !== '2026-01');
      return lucroDaPonte(semJan, ctb, res({ '2026-01': { resultado: -3000 } })).atipicos.length === 0 && lucroDaPonte(semJan, ctb, res({ '2026-01': { resultado: -90000 } })).atipicos.map(x => x.competencia).join() === '2026-01'; })());
    const eDz = { ...G }, oDz = { ...ORI };
    aplicarLucroDaPonte(eDz, oDz, lucroDaPonte(serie, ctb, dez));
    const cDz = missao(rodarC(eDz, oDz, cx(dez)), 'contabil');
    ok('a confirmação mostra o mês atípico, e ele vai na pergunta do vigia', / No resultado do Domínio, dez\/25 \(prejuízo de R\$\s200\.000\) passa da receita do mês: parece lançamento do ano inteiro de uma vez \(o custo das mercadorias, a depreciação\), que distorce um período que não é o ano fechado\./.test(cDz.texto)
      && /o resultado de dez\/25 \(prejuízo de R\$\s200\.000\) passa da receita do mês/.test(cDz.perguntar.sinais), cDz.texto);
    ok('sem o lucro ainda (a DRE pedida até julho), a confirmação já mostra o mês atípico do período', / No resultado do Domínio, dez\/25 \(prejuízo de R\$\s200\.000\) passa da receita do mês/.test(missao(rodarC(G, { ...ORI, lucroContabil: { fonte: 'padrao' } }, cx(dez)), 'contabil').texto));
    ok('o resultado sem mês atípico não ganha a frase', !/No resultado do Domínio/.test(missao(rodarC(eP, oP, cx(res())), 'contabil').texto));
    // (b) o lucro da contabilidade acima do que as notas e a folha deixam: R$ 600.000 de lucro numa empresa de R$ 1 milhão
    // de receita e R$ 500 mil de compras — só fecha com estoque formado, ou com compra sem o custo lançado
    const eAlto = { ...G, lucroContabil: 600000, lucroDe: '2025-10', lucroAte: '2026-09' }, oAlto = { ...ORI, lucroContabil: { fonte: 'digitado' } };
    const rAlto = rodarC(eAlto, oAlto, cx(null)), cAlto = missao(rAlto, 'contabil');
    ok('o lucro acima do que as notas e a folha deixam: a confirmação diz os dois números e pergunta do estoque', /Pela contabilidade, o lucro no Real dá R\$\s[\d.]+ nos 12 meses; pelas notas e pela folha do sistema \(a receita menos as compras, as despesas com nota, a folha e os tributos\), daria no máximo R\$\s[\d.]+\. Só fecha se a empresa formou estoque no período, ou se parte das compras ficou sem o custo lançado: pergunte como o custo das vendas \(o estoque\) é lançado\./.test(cAlto.texto)
      && /o lucro da contabilidade no Real \(R\$\s[\d.]+ nos 12 meses\) passa do que as notas e a folha do sistema deixam \(R\$\s[\d.]+\): o custo das vendas \(o estoque\) está lançado mês a mês\?/.test(cAlto.perguntar.sinais), cAlto.texto);
    ok('o lucro dentro do que as notas deixam (R$ 50.000): sem o alerta', !/Pela contabilidade, o lucro no Real dá/.test(cDz.texto) && !/Pela contabilidade, o lucro no Real dá/.test(missao(rodarC(eD, oD, cx(res())), 'contabil').texto));
    ok('a empresa sem compras (serviço) com o lucro acima da receita menos a folha: o alerta fala da folha e das despesas, não do estoque', (() => {
      const S = comP({ atividades: [{ tipo: 'servico', receita: 1000000 }], folha: 400000, regimeAtual: 'presumido', objetivo: 'presumido_real', lucroContabil: 900000 });
      const m = missao(rodarC(S, { ...ORI, lucroContabil: { fonte: 'digitado' } }, { ...base, contabil: ctb }), 'contabil');
      return /Só fecha se a folha ou outra despesa do sistema não entrou na contabilidade\./.test(m.texto) && !/estoque/.test(m.texto) && /: a folha e as despesas entraram\?/.test(m.perguntar.sinais); })());
    ok('os alertas, soltos: sem o lucro e sem mês atípico, nenhum; a lista tem o texto da missão e o curto da pergunta', alertasDoResultado({ L: { atipicos: [] }, comparacao: null, entrada: G }).length === 0 && alertasDoResultado().length === 0
      && alertasDoResultado({ L: { atipicos: [{ competencia: '2025-12', resultado: 90000, receita: 100 }, { competencia: '2026-01', resultado: -5, receita: 0 }] } })[0].curto === 'o resultado de dez/25 (lucro de R$\u00a090.000) e jan/26 (prejuízo de R$\u00a05) passam da receita do mês');
  }

  console.log('=== a precisão do estudo ===');
  const p0 = precisaoDoEstudo(g0);
  ok('provisório: falta o que pode virar — o que decide primeiro, com o efeito de cada item', p0.nivel === 'provisorio' && p0.falta.map(x => x.id + ':' + x.peso).join() === 'lucro:decide,contabil:decide,presuncao:importa,piscofins:importa,crescimento:importa,resto:detalhe'
    && p0.falta[0].falta === true && p0.falta[0].efeito === 'é o número que decide entre o Presumido e o Real: o IRPJ e a CSLL do Real saem dele' && p0.falta.every(x => x.efeito && x.titulo && x.curto), p0.falta);
  ok('o que já está na conta, e como chegou', p0.tem.map(x => x.id).join() === 'receita,folha,compras' && p0.tem.every(x => x.como === 'veio do Domínio pela ponte') && p0.doSistema.join() === 'a receita,as compras,a folha,o pró-labore', [p0.tem, p0.doSistema]);
  ok('quase: falta só o que não vira o resultado', precisaoDoEstudo(gL).nivel === 'quase' && precisaoDoEstudo(gL).falta.every(x => x.peso !== 'decide') && precisaoDoEstudo(gL).tem.some(x => x.id === 'lucro' && x.como === 'digitado'));
  ok('pronto: nada falta', precisaoDoEstudo(gP).nivel === 'pronto' && precisaoDoEstudo(gP).falta.length === 0 && precisaoDoEstudo(gP).tem.length === 10);
  ok('com o Simples vedado: o impedimento é o primeiro que falta', precisaoDoEstudo(tV).falta[0].id === 'vedacoes' && precisaoDoEstudo(tV).falta[0].efeito === 'com impedimento, o Simples não é opção: a conta dele é só simulação');
  ok('os nomes do nível e do peso, pra tela e pro assistente', Object.keys(NIVEL_DA_PRECISAO).join() === 'pronto,quase,provisorio' && Object.keys(PESO_DA_PRECISAO).join() === 'decide,importa,detalhe' && PESO_DA_PRECISAO.decide === 'decide o resultado');
  ok('sem o roteiro: provisório e vazio', (() => { const p = precisaoDoEstudo(null); return p.nivel === 'provisorio' && !p.tem.length && !p.falta.length; })());

  console.log('=== o crescimento medido perto de zero ===');
  ok('a receita que ficou no nível: sem "0% acima"', /a receita ficou no nível da de out\/25 a dez\/25\./.test(missao(g0, 'crescimento').texto), missao(g0, 'crescimento').texto);
}

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
