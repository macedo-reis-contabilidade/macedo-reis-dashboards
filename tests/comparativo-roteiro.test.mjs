// Teste do roteiro do comparativo tributário (assets/js/comparativo-roteiro.js): "Por onde começar" em fases e missões —
// o que falta e o que conferir, na ordem do que pesa na decisão, o próximo passo, as fases concluídas e o que cada uma
// conquistou, e o estudo provisório até as missões que decidem estarem cumpridas.
// Desde 11/11/2026, o caminho pelo comparativo escolhido (só o Presumido contra o Real: a receita e a presunção, o lucro
// do Real pela contabilidade, o resto da conta), os impedimentos do Simples pelo cadastro e a precisão do estudo.
// Rodar com: node tests/comparativo-roteiro.test.mjs — dados inventados (o repositório é público).

import { roteiroDoEstudo, crescimentoMedido, FASES, FASES_GERAL, fasesDoObjetivo, fontesDoEstudo, ultimoMesFechado, AUTOMATICO, precisaoDoEstudo, NIVEL_DA_PRECISAO, PESO_DA_PRECISAO, LIMITE_PRESUMIDO } from '../assets/js/comparativo-roteiro.js';
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
ok('no Simples, a receita chega pela ponte da Receita (o PGDAS) e pela do Domínio (a apuração)', fRec.auto === AUTOMATICO.receita && /ponte da Receita traz o PGDAS/.test(fRec.auto) && /a do Domínio, a apuração/.test(fRec.auto), fRec.auto);
ok('com os meses em dia, a receita fica "tem"', fonte(rodar(ent, ori, { ...base, hoje: '2026-08-25' }), 'simples', 'receita').estado === 'tem');
ok('os sócios: o contrato social na ficha, que as pontes não trazem', fonte(rF, 'simples', 'socios').estado === 'tem' && fonte(rF, 'simples', 'socios').ficha && fonte(rF, 'simples', 'socios').auto === AUTOMATICO.contrato);
ok('sem os sócios no cadastro, falta; sem cadastro, a linha não aparece', fonte(rodar(ent, ori, { ...base, socios: 0, hoje: '2026-11-01' }), 'simples', 'socios').estado === 'falta' && !fonte(rodar(ent, ori, { ...base, socios: null, hoje: '2026-11-01' }), 'simples', 'socios'));
const fGr = fonte(rF, 'simples', 'grupo');
ok('as outras empresas: somadas até o mês que todas têm, com os que faltam', fGr.estado === 'antigo' && /as 2 empresas somadas até jul\/26 — faltam ago\/26 e set\/26/.test(fGr.situacao), fGr.situacao);
ok('a outra sem a receita: falta, com o nome', /falta a receita de PADARIA INVENTADA/.test(fonte(rodar(ent, { ...ori, 'grupo.0.receita': { fonte: 'padrao' } }, { ...base, hoje: '2026-11-01' }), 'simples', 'grupo').situacao));
const fFolha = fonte(rF, 'numeros', 'folha');
ok('a folha: o resumo da folha do Domínio, que falta, pra soltar (lido com IA, como no Fator R)', fFolha.estado === 'falta' && /Domínio Folha: o resumo da folha mês a mês/.test(fFolha.onde) && /lido com IA como no Fator R/.test(fFolha.onde) && fFolha.relatorio === true && fFolha.campo === 'folha' && fFolha.auto === AUTOMATICO.ponte && /a ponte do Domínio traz todo dia/.test(AUTOMATICO.ponte), fFolha.onde);
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
    const c = comparar({ ...entrada, regimes: regs }), t = testarPremissas({ ...entrada, regimes: regs }, premissasParaTestar(entrada, origens, regs));
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
  ok('a presunção: pelo CNAE do cadastro, a conferir, com o que a conta usou', pres.fase === 'presuncao' && pres.estado === 'aberta' && pres.peso === 'importa' && pres.conferir.join() === 'atividades.0.tipo' && pres.conferirRotulo === 'Está certa'
    && /^A conta usou: Comércio \(revenda de mercadorias\), 8% no IRPJ e 12% na CSLL sobre R\$\s1\.000\.000\. A atividade veio do CNAE do cadastro/.test(pres.texto), pres.texto);
  const luc = missao(g0, 'lucro');
  ok('o lucro da contabilidade falta e decide: digitar o da DRE ou seguir com a estimativa', luc.fase === 'lucro' && luc.estado === 'aberta' && luc.falta && luc.peso === 'decide' && luc.campo === 'lucroContabil' && luc.irRotulo === 'Digitar o lucro da DRE'
    && luc.conferir.join() === 'lucroContabil' && luc.conferirRotulo === 'Seguir com a estimativa');
  // o empate: IRPJ e CSLL do Presumido 22.800 = 24% × 95.000; a estimativa de 2027: 1.000.000 − 500.000 − 110.000 − 44.070 = 345.930
  ok('o texto: os meses da DRE, a estimativa, o empate e a contabilidade feita até julho (a DRE até setembro ainda não fecha)', /^Falta o lucro da DRE de out\/25 a set\/26, antes do IRPJ e da CSLL\. Sem ele, a conta estima o lucro do Real \(a receita menos as compras, a folha e as despesas\): R\$\s345\.930 em 2027\./.test(luc.texto)
    && /O Real empata com o Presumido com lucro de R\$\s95\.000 antes do IR \(9,5% da receita\): abaixo disso, o Real sai mais barato\./.test(luc.texto)
    && /Pelo Controle das contabilidades, ela está feita até jul\/26: a DRE até set\/26 ainda não fecha\.$/.test(luc.texto), luc.texto);
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
  ok('provisório: falta o lucro, que decide; o próximo passo é a presunção, da fase de agora', g0.provisorio && g0.decidem === 1 && g0.faseAtual === 0 && g0.proximo.id === 'presuncao' && !g0.pronto);
  ok('a estimativa que não serve: as compras e as despesas passam da receita', /As compras, as despesas com nota e a folha passam da receita: a empresa formou estoque, investiu ou teve prejuízo, e a estimativa não serve pra decidir\./.test(
    missao(rodarC({ ...G, compras: 900000, despesasCredito: 300000 }, { ...ORI, despesasCredito: { fonte: 'ponte' } }, base), 'lucro').texto));
  ok('sem o Controle das contabilidades, a missão não fala dele; fora do escritório, diz', !/Controle das contabilidades/.test(missao(rodarC(G, ORI, base), 'lucro').texto)
    && /O escritório não faz a contabilidade dela: o lucro vem do contador de lá ou do cliente\.$/.test(missao(rodarC(G, ORI, { ...base, contabil: { faz: false, feitaAte: null } }), 'lucro').texto));

  console.log('=== seguir com a estimativa ===');
  const gE = rodarC(G, { ...ORI, lucroContabil: { fonte: 'confirmado' } }, base);
  ok('a missão fica cumprida "pela estimativa", e a fase 2 fecha com o alerta', missao(gE, 'lucro').estado === 'feita' && missao(gE, 'lucro').como === 'pela estimativa' && gE.fases[1].concluida && gE.fases[1].alerta === true
    && /^No Real, lucro de R\$\s345\.930 em 2027, pela estimativa: IRPJ e CSLL de R\$\s93\.616\.$/.test(gE.fases[1].conquista), gE.fases[1].conquista);

  console.log('=== com o lucro da contabilidade ===');
  const oriL = { ...ORI, lucroContabil: { fonte: 'digitado' } };
  const gL = rodarC({ ...G, lucroContabil: 100000 }, oriL, { ...base, contabil: { faz: true, feitaAte: '2026-09' } });
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
  const tudo = { ...oriL, ajustesLalur: { fonte: 'confirmado' }, 'atividades.0.tipo': { fonte: 'confirmado' }, 'atividades.0.pctAliqZero': { fonte: 'confirmado' }, crescimentoReceita: { fonte: 'confirmado' },
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
  ok('as fontes por fase do caminho', Object.keys(fo).join() === 'presuncao,lucro,premissas,veredito' && fo.presuncao.map(x => x.id).join() === 'receita,atividade' && fo.lucro.map(x => x.id).join() === 'dre,folha'
    && fo.premissas.map(x => x.id).join() === 'compras,credito,icms,piscofins,crescimento' && fo.veredito.map(x => x.id).join() === 'conversa', Object.entries(fo).map(([k, l]) => k + ':' + l.map(x => x.id)));
  const dre = fo.lucro[0];
  ok('a DRE: falta, no Domínio Contabilidade, com os meses que faltam da contabilidade — e a ponte ainda não traz', dre.estado === 'falta' && dre.campo === 'lucroContabil' && /^Domínio Contabilidade: a DRE \(ou o balancete\) dos mesmos 12 meses da receita/.test(dre.onde)
    && /Pelo Controle das contabilidades, ela está feita até jul\/26: faltam ago\/26 e set\/26 pra DRE dos 12 meses fechar\.$/.test(dre.onde) && /A ponte do Domínio ainda não traz o resultado da contabilidade: digite o lucro da DRE\./.test(dre.auto), dre);
  ok('a atividade: pelo CNAE do cadastro, a conferir', fo.presuncao[1].estado === 'padrao' && fo.presuncao[1].situacao === 'pelo CNAE do cadastro: confira');
  ok('a folha zerada pela ponte: "sem folha nem pró-labore no Domínio"', fo.lucro[1].estado === 'tem' && fo.lucro[1].situacao === 'sem folha nem pró-labore no Domínio');
  ok('o veredito: a reunião, com o Real trimestral ou anual e a distribuição de lucros', /a projeção do lucro e as escolhas — o Real trimestral ou anual e a distribuição de lucros aos sócios\.$/.test(fo.veredito[0].onde), fo.veredito[0].onde);
  const foL = fontesDoEstudo({ entrada: { ...G, lucroContabil: 100000 }, origens: oriL, comparacao: comparar({ ...G, lucroContabil: 100000, regimes: ['presumido', 'real'] }), serie, hoje: '2026-11-11', objetivo: 'presumido_real', contabil: { faz: true, feitaAte: '2026-07' } });
  ok('com a DRE digitada e a contabilidade atrás: "faltam meses", e as adições e exclusões no padrão', foL.lucro[0].estado === 'antigo' && /a contabilidade vai até jul\/26/.test(foL.lucro[0].situacao) && foL.lucro[1].id === 'lalur' && foL.lucro[1].estado === 'padrao');

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
    return m.estado === 'feita' && m.como === 'digitado' && /^Lucro de R\$\s100\.000 na DRE dos 12 meses: no Real de 2027, R\$\s86\.225 antes do IR, com os tributos de hoje trocados pelos do Real\.$/.test(m.texto); })());

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

  console.log('=== a precisão do estudo ===');
  const p0 = precisaoDoEstudo(g0);
  ok('provisório: falta o que pode virar — o que decide primeiro, com o efeito de cada item', p0.nivel === 'provisorio' && p0.falta.map(x => x.id + ':' + x.peso).join() === 'lucro:decide,presuncao:importa,piscofins:importa,crescimento:importa,resto:detalhe'
    && p0.falta[0].falta === true && p0.falta[0].efeito === 'é o número que decide entre o Presumido e o Real: o IRPJ e a CSLL do Real saem dele' && p0.falta.every(x => x.efeito && x.titulo && x.curto), p0.falta);
  ok('o que já está na conta, e como chegou', p0.tem.map(x => x.id).join() === 'receita,folha,compras' && p0.tem.every(x => x.como === 'veio do Domínio pela ponte') && p0.doSistema.join() === 'a receita,as compras,a folha,o pró-labore', [p0.tem, p0.doSistema]);
  ok('quase: falta só o que não vira o resultado', precisaoDoEstudo(gL).nivel === 'quase' && precisaoDoEstudo(gL).falta.every(x => x.peso !== 'decide') && precisaoDoEstudo(gL).tem.some(x => x.id === 'lucro' && x.como === 'digitado'));
  ok('pronto: nada falta', precisaoDoEstudo(gP).nivel === 'pronto' && precisaoDoEstudo(gP).falta.length === 0 && precisaoDoEstudo(gP).tem.length === 9);
  ok('com o Simples vedado: o impedimento é o primeiro que falta', precisaoDoEstudo(tV).falta[0].id === 'vedacoes' && precisaoDoEstudo(tV).falta[0].efeito === 'com impedimento, o Simples não é opção: a conta dele é só simulação');
  ok('os nomes do nível e do peso, pra tela e pro assistente', Object.keys(NIVEL_DA_PRECISAO).join() === 'pronto,quase,provisorio' && Object.keys(PESO_DA_PRECISAO).join() === 'decide,importa,detalhe' && PESO_DA_PRECISAO.decide === 'decide o resultado');
  ok('sem o roteiro: provisório e vazio', (() => { const p = precisaoDoEstudo(null); return p.nivel === 'provisorio' && !p.tem.length && !p.falta.length; })());

  console.log('=== o crescimento medido perto de zero ===');
  ok('a receita que ficou no nível: sem "0% acima"', /a receita ficou no nível da de out\/25 a dez\/25\./.test(missao(g0, 'crescimento').texto), missao(g0, 'crescimento').texto);
}

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
