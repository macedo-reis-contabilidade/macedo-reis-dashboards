// Teste da confiança dos números da Reforma (assets/js/rt-confianca.js, 13/10/2026): de onde veio cada número, o nível,
// o motivo, a faixa do plausível — e a conclusão: firme, a confirmar ou SEM CONCLUSÃO.
// Rodar com: node tests/rt-confianca.test.mjs — casos sintéticos (números inventados, sem dado de cliente).
import { avaliarConfianca, inferirProcedencia, resumoConfianca } from '../assets/js/rt-confianca.js';
import { simular } from '../assets/js/rt-motor.js';

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.error('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const item = (av, chave) => av.itens.find(i => i.chave === chave) || {};

const meses = (ini, n) => { const out = []; let [a, m] = ini.split('-').map(Number); for (let i = 0; i < n; i++) { out.push(a + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; a++; } } return out; };
const M12 = meses('2025-09', 12);
// indústria do Anexo II (em 2027, Anexo I), ~R$ 108,5 mil por mês — os números da tela que originou o módulo
const BASE = { anexo: 'II', rbt12: 1300600, aliqEfetivaInformada: null, receita: 108504, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0,
  pctComprasComCredito: null, pctComprasMercadorias: 0, pctComprasDespesas: 0, pctDespesasComCredito: null, pctImpostoEmbutido: 0, pctExcluidoST: 0,
  pctReceitaMonofasica: 0, partilha: 14, cbs: 9.2, ibs: 0.1, pctPJ: 90, creditoEstoqueMes: 0 };
const INDUSTRIA = { tipo: 'industria', vendeMercadoria: true, podeReduzir: false };
const PROC_BASE = { receita: { fonte: 'faturamento', meses: M12 }, rbt12: { fonte: 'pgdas', meses: ['2026-09'] }, anexo: { fonte: 'pgdas', meses: ['2026-09'] }, partilha: { fonte: 'tabela' }, mix: { fonte: 'padrao' } };
const SET = { fonte: 'entradas', meses: ['2026-09'], receitaDe: ['PGDAS set/26'], mesesFaturamento: 12 };
const PJ_SET = { fonte: 'saidas', meses: ['2026-09'], porDocumento: true, regimeConsultado: true };

console.log('Compras não medidas e % de PJ deduzido (a tela que originou o módulo):');
{
  const av = avaliarConfianca(BASE, { ...PROC_BASE, pctMerc: { fonte: 'vazio' }, pctDesp: { fonte: 'vazio' }, pctPJ: { fonte: 'deduzido', perfil: 'industria' } }, INDUSTRIA);
  ok(av.decisao === 'manter', 'com 0% de compras, a conta dá "manter dentro do DAS"');
  ok(av.conclusao === 'sem_conclusao', 'mas não há conclusão: as compras não foram medidas e mudam o resultado');
  const c = item(av, 'compras');
  ok(c.nivel === 'nao_medido' && c.confianca === 'não medido' && c.muda && av.decisivos.includes(c), 'compras: não medido, muda o resultado, é o dado decisivo');
  ok(c.virada && c.virada.valor > 7 && c.virada.valor < 10 && /vira a partir de 8,\d% da receita/.test(c.efeito), 'e a análise diz a partir de quanto vira (~8%): ' + c.efeito);
  ok(av.faltam.some(f => /acompanhamento de entradas/.test(f)), 'o que falta: o acompanhamento de entradas');
  const pj = item(av, 'pj');
  ok(pj.nivel === 'nao_medido' && pj.selo === 'deduzido' && pj.confianca === 'deduzido, não medido' && /indústria vende essencialmente a empresas/.test(pj.motivo), 'PJ: deduzido pelo perfil, com o motivo');
  ok(item(av, 'receita').nivel === 'alta' && item(av, 'simples').nivel === 'alta' && item(av, 'simples').periodo === 'PGDAS de set/26', 'receita (12 meses) e PGDAS: confiança alta');
  ok(item(av, 'receita').periodo === 'set/25–ago/26, 12 meses', 'período da receita: ' + item(av, 'receita').periodo);
}

console.log('Compras e % de PJ medidos num mês só:');
{
  const proc = { ...PROC_BASE, pctMerc: SET, pctDesp: SET, pctPJ: PJ_SET };
  const av = avaliarConfianca({ ...BASE, pctComprasMercadorias: 40, pctComprasDespesas: 2, pctPJ: 85 }, proc, INDUSTRIA);
  ok(av.decisao === 'se', 'com 42% de compras e 85% de PJ: "opte, se o comercial confirmar"');
  ok(item(av, 'compras').nivel === 'baixa' && /um mês só \(set\/26\)/.test(item(av, 'compras').motivo) && /O faturamento cobre 12 meses/.test(item(av, 'compras').motivo), 'compras de um mês: confiança baixa, e diz que o faturamento cobre 12');
  ok(item(av, 'pj').nivel === 'baixa' && !item(av, 'compras').muda && !item(av, 'pj').muda, 'cada um, sozinho, não muda o resultado dentro do plausível');
  ok(av.conclusao === 'a_confirmar' && av.conjunto && /juntos, no pior caso/.test(av.conjunto.texto) && av.decisivos.length === 0, 'mas os dois juntos no pior caso, sim: a confirmar (não sem conclusão)');
  ok(av.faltam.length === 2, 'e o que falta são os outros meses de entradas e de saídas');
  const av2 = avaliarConfianca({ ...BASE, pctComprasMercadorias: 25, pctComprasDespesas: 2, pctPJ: 85 }, proc, INDUSTRIA);
  ok(av2.conclusao === 'sem_conclusao' && av2.decisivos.some(i => i.chave === 'pj') && item(av2, 'pj').virada.valor > 60, 'com 27% de compras, o % de PJ de um mês sozinho muda o resultado: sem conclusão');
  const r = resumoConfianca(av2);
  ok(r.conclusao === 'sem_conclusao' && r.decisivos[0] === 'Vendas a clientes que aproveitam o crédito' && r.niveis.pj === 'baixa' && r.niveis.receita === 'alta' && r.faltam.length >= 1, 'o resumo gravado com a simulação: conclusão, decisivos, níveis e o que falta');
}

console.log('Tudo medido no ano:');
{
  const proc = { ...PROC_BASE, pctMerc: { fonte: 'entradas', meses: M12, mesesFaturamento: 12, regimeFornecedores: true }, pctDesp: { fonte: 'entradas', meses: M12, mesesFaturamento: 12, regimeFornecedores: true },
    pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true } };
  const av = avaliarConfianca({ ...BASE, pctComprasMercadorias: 25, pctComprasDespesas: 2, pctPJ: 85 }, proc, INDUSTRIA);
  ok(av.conclusao === 'firme' && item(av, 'compras').nivel === 'alta' && item(av, 'pj').nivel === 'alta', 'compras e PJ de 12 meses (com o regime dos clientes): confiança alta, conclusão firme');
  ok(!item(av, 'compras').efeito && !item(av, 'pj').efeito, 'número de confiança alta não é testado');
  const semRegime = avaliarConfianca({ ...BASE, pctComprasMercadorias: 25, pctComprasDespesas: 2, pctPJ: 85 }, { ...proc, pctPJ: { ...proc.pctPJ, regimeConsultado: false } }, INDUSTRIA);
  ok(item(semRegime, 'pj').nivel === 'media' && /as do Simples não aproveitam o crédito/.test(item(semRegime, 'pj').motivo) && semRegime.conclusao === 'a_confirmar', 'sem a consulta do regime dos clientes: média, e a faixa desce — a confirmar');
  ok(semRegime.decisivos.length === 0, 'confiança média nunca deixa "sem conclusão"');
}

console.log('Premissas da lei não decidem a conclusão:');
{
  const drog = { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10, pctComprasMercadorias: 60, pctComprasDespesas: 5.33, pctImpostoEmbutido: 18,
    pctExcluidoST: 49, pctReceitaMonofasica: 100, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 10, creditoEstoqueMes: 1541.67 };
  const pr = { receita: { fonte: 'faturamento', meses: M12 }, rbt12: { fonte: 'pgdas', meses: ['2026-08'] }, anexo: { fonte: 'pgdas', meses: ['2026-08'] },
    pctMerc: { fonte: 'entradas', meses: M12, regimeFornecedores: true }, pctDesp: { fonte: 'entradas', meses: M12, regimeFornecedores: true },
    pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true }, mix: { fonte: 'notas', meses: M12 }, pctEmb: { fonte: 'manual' }, estoque: { fonte: 'manual' } };
  const av = avaliarConfianca(drog, pr, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: true });
  const est = item(av, 'estoque');
  ok(est.categoria === 'premissa' && est.muda && av.premissas.includes(est), 'crédito de estoque (provável, não garantido): premissa que muda o resultado');
  ok(av.conclusao === 'firme' && !av.decisivos.length, 'a premissa aparece, mas não tira a conclusão (a análise trata como tendência a confirmar)');
  ok(item(av, 'cbs').categoria === 'premissa' && item(av, 'cbs').selo === 'estimativa' && /9,21%/.test(item(av, 'cbs').efeito || item(av, 'cbs').motivo), 'alíquota da CBS: estimativa, com as projeções em circulação');
  ok(item(av, 'mix').nivel === 'alta' && /NCM de cada item/.test(item(av, 'mix').motivo), 'mix pelas notas de 12 meses: confiança alta');
}

console.log('Mix não medido:');
{
  const rest = { anexo: 'I', rbt12: 872624, receita: 72479, mixCheia: 100, pctComprasMercadorias: 49.5, pctComprasDespesas: 0, pctImpostoEmbutido: 0, pctExcluidoST: 3.4, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 2.4 };
  const av = avaliarConfianca(rest, { receita: { fonte: 'faturamento', meses: M12 }, mix: { fonte: 'padrao' } }, { tipo: 'alimentacao', vendeMercadoria: true, podeReduzir: true });
  const mx = item(av, 'mix');
  ok(mx.nivel === 'nao_medido' && /NFC-e/.test(mx.motivo) && /comida preparada \(−40%\)/.test(mx.efeito), 'restaurante sem as NFC-e: mix não medido, testado com a comida a −40%');
  const coz = avaliarConfianca(rest, { mix: { fonte: 'padrao' } }, { tipo: 'alimentacao', vendeMercadoria: true, podeReduzir: true, refeicaoEmpresas: true });
  ok(item(coz, 'mix').categoria === 'premissa' && /art\. 273/.test(item(coz, 'mix').motivo) && !coz.decisivos.some(i => i.chave === 'mix'), 'refeição para empresas: o enquadramento (art. 273) é premissa da lei, não dado faltando');
  const serv = avaliarConfianca({ ...rest, anexo: 'III' }, { mix: { fonte: 'padrao' } }, { tipo: 'servico', vendeMercadoria: false, podeReduzir: false });
  ok(item(serv, 'mix').nivel === 'alta' && item(serv, 'mix').selo === 'alta (norma)', 'serviço fora dos anexos de redução: alíquota cheia pela lei, confiança alta');
}

console.log('% de PJ e compras sem informação nenhuma:');
{
  const av = avaliarConfianca({ ...BASE, pctPJ: 0 }, { ...PROC_BASE, pctMerc: { fonte: 'vazio' }, pctDesp: { fonte: 'vazio' }, pctPJ: { fonte: 'vazio' } }, INDUSTRIA);
  ok(item(av, 'pj').nivel === 'nao_medido' && /Ninguém mediu nem informou/.test(item(av, 'pj').motivo), 'PJ vazio: não medido');
  ok(av.conclusao === 'sem_conclusao' && av.conjunto && av.conjunto.semConclusao && av.decisivos.length === 2, 'cada um sozinho não muda, mas os dois não medidos juntos mudam: sem conclusão (não "a confirmar")');
  const svc = avaliarConfianca({ ...BASE, anexo: 'III', pctPJ: 100 }, { ...PROC_BASE, pctMerc: { fonte: 'vazio' }, pctDesp: { fonte: 'vazio' }, pctPJ: PJ_SET }, { tipo: 'servico', vendeMercadoria: false, podeReduzir: false });
  ok(/Entre|Com 20,0% da receita/.test(item(svc, 'compras').efeito || ''), 'prestador de serviço: compras não medidas testadas até 20% da receita, não 60%');
}

console.log('Simulações gravadas antes (procedência deduzida do resumo do Domínio):');
{
  const fatMeses = meses('2026-01', 8).map(c => ({ competencia: c, total: 100000 }));
  const dom = { faturamento: { total: 800000, servicos: 0, saidas: 800000 }, periodoRotulo: 'jan/26–ago/26', meses: fatMeses, pgdas: { competencia: '2026-08' },
    entradas: { grupos: [] }, vendas: { total: 800000, pctPJ: 95, meses: fatMeses, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' }, clientesRegime: { regularPct: 100 } };
  const ent = { ...BASE, anexo: 'I', pctComprasMercadorias: 96, pctComprasDespesas: 0, pctPJ: 95 };
  const p = inferirProcedencia(ent, dom, null);
  ok(p.receita.fonte === 'faturamento' && p.receita.meses.length === 8 && p.rbt12.fonte === 'pgdas', 'receita do faturamento (8 meses) e RBT12 do PGDAS');
  ok(p.pctMerc.fonte === 'entradas' && p.pctMerc.legado === true && p.pctMerc.meses === null, 'compras do Domínio, com o período não registrado (legado)');
  ok(p.pctPJ.fonte === 'saidas' && p.pctPJ.porDocumento === true && p.pctPJ.regimeConsultado === true && p.pctPJ.meses.length === 8, '% de PJ das saídas, pelo CNPJ, com o regime consultado');
  const av = avaliarConfianca(ent, p, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: false });
  ok(item(av, 'compras').nivel === 'media' && /não ficou registrado/.test(item(av, 'compras').motivo), 'compras do legado: média, com o motivo');
  ok(!item(av, 'compras').muda && av.decisao === 'fora', 'legado só pode ter subestimado as compras: "optar por fora" não vira por isso');
  const semEnt = inferirProcedencia({ ...ent, pctComprasMercadorias: 0 }, { ...dom, entradas: null }, null);
  ok(semEnt.pctMerc.fonte === 'vazio', 'sem o relatório de entradas e com 0% de compras: vazio (não medido)');
  const domDed = { pctPJDeduzido: 'deduzido: indústria vende essencialmente a empresas — confirme' };
  const ded = inferirProcedencia({ ...ent, pctPJ: 90 }, domDed);
  ok(ded.pctPJ.fonte === 'deduzido' && ded.pctPJ.perfil === 'industria', 'o % de PJ deduzido (90% na ficha, o que o perfil deduz), com o perfil');
  // o resumo guardou "deduzido", mas a ficha tem outro % (as notas de venda sobrescreveram no "Aplicar", ou alguém digitou):
  // não é o deduzido — e não ficou registrado de onde veio (antes a ficha dizia "deduzido pelo perfil" e a análise, "notas")
  const trocado = inferirProcedencia(ent, domDed);
  const avT = avaliarConfianca(ent, trocado, INDUSTRIA);
  ok(trocado.pctPJ.fonte === 'manual' && trocado.pctPJ.legado && item(avT, 'pj').fonte === 'Simulação anterior — origem não registrada' && item(avT, 'pj').nivel === 'media',
    'resumo diz "deduzido" mas a ficha tem 95%: origem não registrada, confiança média');
  // as notas da base não entram na dedução: a ficha, o "Refazer simulações" e a análise deduzem o mesmo
  ok(JSON.stringify(inferirProcedencia(ent, domDed, { pctPJ: 85, nNotas: 900 })) === JSON.stringify(trocado), 'as notas de hoje não mudam a dedução da simulação antiga');
  const semMeses = inferirProcedencia(ent, { vendas: { pctPJ: 95, fonte: 'acompanhamento de saídas (Domínio), PJ pelo nome' } }, null);
  const avS = avaliarConfianca(ent, semMeses, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: false });
  ok(semMeses.pctPJ.meses === null && item(avS, 'pj').nivel === 'media', 'período desconhecido não é "confiança baixa" (era o caso de 0 meses)');
  ok(/pelo nome/.test(item(avS, 'pj').motivo), 'PJ reconhecido pelo nome: diz isso');
  // mix todo à alíquota cheia numa simulação antiga: pode ter vindo das notas ou ser o padrão — não ficou registrado (média);
  // na simulação nova, o padrão é "não medido"
  const rest = { ...ent, anexo: 'I', pctPJ: 2, mixCheia: 100 };
  const pL = inferirProcedencia(rest, { faturamento: dom.faturamento, meses: fatMeses });
  const avL = avaliarConfianca(rest, pL, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: true });
  ok(pL.mix.fonte === 'padrao' && pL.mix.legado && item(avL, 'mix').nivel === 'media' && /não ficou registrado se o mix veio das notas/.test(item(avL, 'mix').motivo), 'mix 100% cheio da simulação antiga: origem não registrada, média');
  const avN = avaliarConfianca(rest, { ...pL, mix: { fonte: 'padrao' } }, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: true });
  ok(item(avN, 'mix').nivel === 'nao_medido', 'o mesmo mix numa simulação nova (padrão, sem as notas): não medido');
  ok(inferirProcedencia(rest, null).receita.legado === true && item(avaliarConfianca(rest, inferirProcedencia(rest, null), INDUSTRIA), 'receita').fonte === 'Simulação anterior — origem não registrada', 'sem resumo do Domínio: receita de origem não registrada');
}

console.log('Os fracos juntos: só o menor grupo que muda o resultado:');
{
  // o caso de "medidos num mês só" num ramo com redução (mix não medido): compras e PJ no pior caso viram juntos; o mix
  // sozinho não muda e não é preciso pra virar — não pode entrar no grupo (antes entrava, e o caso ficava SEM CONCLUSÃO)
  const proc = { ...PROC_BASE, pctMerc: SET, pctDesp: SET, pctPJ: PJ_SET };
  const av = avaliarConfianca({ ...BASE, pctComprasMercadorias: 40, pctComprasDespesas: 2, pctPJ: 85 }, proc, { ...INDUSTRIA, podeReduzir: true });
  ok(item(av, 'mix').nivel === 'nao_medido' && !item(av, 'mix').muda, 'mix não medido, e sozinho não muda');
  ok(av.conclusao === 'a_confirmar' && av.conjunto && av.conjunto.itens.length === 2 && !av.conjunto.itens.includes(item(av, 'mix').rotulo) && !av.decisivos.length,
    'compras e PJ juntos mudam: a confirmar, sem arrastar o mix (' + (av.conjunto ? av.conjunto.itens.join(' + ') : '—') + ')');
  ok(av.faltam.length === 2 && !av.faltam.some(f => /notas de venda \(XML ou ZIP\) pra medir/.test(f)), 'o que falta é só o do grupo que vira');
}

console.log('Textos do efeito:');
{
  const drog = { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10, pctComprasMercadorias: 60, pctComprasDespesas: 5.33, pctImpostoEmbutido: 18,
    pctExcluidoST: 49, pctReceitaMonofasica: 100, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 10, creditoEstoqueMes: 1541.67 };
  const av = avaliarConfianca(drog, { receita: { fonte: 'faturamento', meses: M12 }, mix: { fonte: 'notas', meses: M12 } }, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: true });
  ok(/^Sem o crédito de estoque, o resultado/.test(item(av, 'estoque').efeito || '') && !/Com sem/.test(JSON.stringify(av.itens)), 'estoque: "Sem o crédito de estoque, …" (nunca "Com sem")');
  ok(/a referência de 8,8%/.test(item(av, 'cbs').efeito || ''), 'CBS: "a referência de 8,8%"');
  const man = avaliarConfianca({ ...BASE, pctPJ: 70 }, { ...PROC_BASE, pctPJ: { fonte: 'manual' } }, INDUSTRIA);
  ok(item(man, 'pj').fonte === 'Informado, sem relatório' && item(man, 'pj').nivel === 'media', 'PJ digitado na ficha: "Informado, sem relatório", média');
}

console.log('Meses em dúvida, parte informada e transporte de passageiros:');
{
  // compra esporádica: o relatório cobre o ano, 7 meses medidos e 5 sem nota nenhuma (sem as saídas pra dizer se a escrita
  // existia) — se foram meses sem compra, o % é 5 e não 8,57: no máximo média, e a faixa vai até o 5
  const M7 = meses('2025-11', 7);
  const pe = { fonte: 'entradas', meses: M7, mesesFaturamento: 12, regimeFornecedores: true, mesesIncertos: ['2025-09', '2025-10', '2026-06', '2026-07', '2026-08'], pctSeZero: 5 };
  const ent = { ...BASE, anexo: 'III', rbt12: 1200000, receita: 100000, partilha: 15.6, pctComprasMercadorias: 0, pctComprasDespesas: 60000 / 700000 * 100, pctPJ: 90 };
  const av = avaliarConfianca(ent, { ...PROC_BASE, pctMerc: pe, pctDesp: pe, pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true } }, { tipo: 'servico', vendeMercadoria: false, podeReduzir: false });
  const c = item(av, 'compras');
  ok(c.nivel === 'media' && /set\/25–out\/25 e jun\/26–ago\/26/.test(c.motivo) && /o % seria 5,0%/.test(c.motivo), 'meses em dúvida: confiança média, e diz quais e o % se fossem compra zero');
  ok(c.muda && av.conclusao === 'a_confirmar' && /Com 5,0% da receita/.test(c.efeito), 'e testa o 5%: muda o resultado — a confirmar (' + c.efeito + ')');
  // mercadorias medidas no ano e despesas digitadas: o número não é todo medido — média, e testado
  const ano = { fonte: 'entradas', meses: M12, mesesFaturamento: 12, regimeFornecedores: true };
  const avP = avaliarConfianca({ ...BASE, pctComprasMercadorias: 3, pctComprasDespesas: 2, pctPJ: 85 }, { ...PROC_BASE, pctMerc: ano, pctDesp: { fonte: 'manual' }, pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true } }, INDUSTRIA);
  ok(item(avP, 'compras').nivel === 'media' && /despesas foram informadas sem relatório/.test(item(avP, 'compras').motivo) && item(avP, 'compras').efeito, 'parte medida e parte digitada: média, diz qual parte, e é testada');
  // transporte de passageiros: a redução depende do serviço (LC 214, arts. 157, 285 a 287) — não medido, testado com o −40% e
  // com a isenção (13/10/2026, Módulo 07: antes só o −40%)
  const pass = avaliarConfianca({ ...BASE, anexo: 'III', pctPJ: 10 }, { ...PROC_BASE, pctPJ: { fonte: 'manual' } }, { tipo: 'transporte', passageiros: true, vendeMercadoria: false, podeReduzir: false });
  const pm = item(pass, 'mix');
  ok(pm.nivel === 'nao_medido' && /art\. 286/.test(pm.motivo) && /art\. 157/.test(pm.motivo) && pm.resultados.length === 2 && pm.resultados.some(r => /−40%/.test(r.rotulo)) && pm.resultados.some(r => /isenção/.test(r.rotulo)),
    'transporte de passageiros: mix não medido, testado com o −40% e com a isenção (nunca "produtos do ramo")');
  // o relatório do cliente: o que falta, sem os nomes do escritório
  const nv = avaliarConfianca(BASE, { ...PROC_BASE, pctMerc: { fonte: 'vazio' }, pctDesp: { fonte: 'vazio' }, pctPJ: { fonte: 'deduzido', perfil: 'industria' } }, INDUSTRIA);
  ok(nv.faltamCliente.length === nv.faltam.length && !nv.faltamCliente.some(f => /Domínio|XLS|XML|acompanhamento|consulta de CNPJ/.test(f)), 'o que falta, pro cliente: ' + nv.faltamCliente.join('; '));
  const leg = avaliarConfianca({ ...BASE, pctPJ: 95 }, inferirProcedencia({ ...BASE, pctPJ: 95 }, null), INDUSTRIA);
  ok(item(leg, 'pj').fonteCliente === 'Levantamento anterior do escritório' && /levantamento anterior/.test(item(leg, 'pj').motivoCliente), 'simulação antiga: pro cliente, "levantamento anterior do escritório"');
}

// ---------- Módulo 07 (13/10/2026): serviço com redução, transporte de passageiros, mercado e hortifrúti ----------
const M12_ALTA = { ...PROC_BASE, pctMerc: { fonte: 'entradas', meses: M12, mesesFaturamento: 12, regimeFornecedores: true }, pctDesp: { fonte: 'entradas', meses: M12, mesesFaturamento: 12, regimeFornecedores: true },
  pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true } };
const SERVICO = { tipo: 'servico', vendeMercadoria: false, podeReduzir: false };
const SV = { anexo: 'III', rbt12: 1200000, receita: 100000, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0, pctComprasMercadorias: 0, pctComprasDespesas: 10, pctImpostoEmbutido: 0,
  pctExcluidoST: 0, partilha: 15.6, cbs: 9.2, ibs: 0.1, pctPJ: 80 };
const CONTAB = { tipo: 'profissao', faixas: ['mixRed30'], ramo: 'contabilidade', quem: 'contabilistas (art. 127, VII)' };

console.log('Serviço com redução pelo CNAE — profissões do art. 127, lista de NBS e academia:');
{
  // escritório de contabilidade, 80% de clientes PJ: tudo cheio dá "manter"; com o −30% da sociedade, "opte, se"
  const av = avaliarConfianca(SV, M12_ALTA, { ...SERVICO, reducaoServico: CONTAB });
  const mx = item(av, 'mix');
  ok(av.decisao === 'manter' && mx.categoria === 'dado' && mx.nivel === 'baixa' && mx.selo === 'a conferir' && /requisitos do art\. 127 não foram conferidos/.test(mx.fonte), 'contabilidade sem conferir os requisitos: tudo cheio, confiança baixa, "a conferir" (antes, "alta (norma)")');
  ok(mx.muda && /−30%/.test(mx.efeito) && /opte, se o comercial confirmar/.test(mx.efeito) && av.conclusao === 'sem_conclusao' && av.decisivos.includes(mx), 'com o −30% o resultado vira "opte, se": sem conclusão');
  ok(av.faltamCliente.some(f => /contrato social e o registro dos sócios no conselho/.test(f)) && !av.faltamCliente.some(f => /art\. 127/.test(f)), 'o que falta, pro cliente: o contrato social e o registro no conselho (sem o número do artigo)');
  // o −30% digitado na ficha: média, e testa o contrário (sem os requisitos, tudo cheio)
  const inf = avaliarConfianca({ ...SV, mixCheia: 0, mixRed30: 100 }, { ...M12_ALTA, mix: { fonte: 'manual' } }, { ...SERVICO, reducaoServico: CONTAB });
  const mi = item(inf, 'mix');
  ok(inf.decisao === 'se' && mi.nivel === 'media' && mi.resultados.length === 1 && /tudo à alíquota cheia \(se a sociedade não cumprir os requisitos/.test(mi.resultados[0].rotulo) && inf.conclusao === 'a_confirmar', 'com o −30% informado: média, testado sem os requisitos — a confirmar');
  // clínica: a lista de NBS do Anexo III é da lei — premissa, não tira a conclusão
  const CLIN = { tipo: 'anexo', faixas: ['mixRed60'], ramo: 'saúde humana', anexo: 'Anexo III da LC 214 (serviços de saúde, art. 130)' };
  const cl = avaliarConfianca({ ...SV, pctComprasDespesas: 20, pctPJ: 5 }, M12_ALTA, { ...SERVICO, reducaoServico: CLIN });
  const mc = item(cl, 'mix');
  ok(mc.categoria === 'premissa' && mc.muda && cl.premissas.includes(mc) && !cl.decisivos.includes(mc) && /Anexo III/.test(mc.motivo), 'clínica: o −60% do Anexo III muda o resultado, mas é premissa da lei (não decide a conclusão)');
  ok(cl.conclusao === 'firme' && /toda a receita com −60% \(se o serviço estiver no Anexo III da LC 214\)/.test(mc.resultados[0].rotulo), 'e o teste diz qual anexo');
  // academia: os dois — −30% (registrada no conselho, §3º) e −60% (educação desportiva, NBS 1.2205.12.00)
  const ACAD = { tipo: 'desporto', faixas: ['mixRed30', 'mixRed60'], ramo: 'academia' };
  const ac = avaliarConfianca({ ...SV, pctPJ: 5, pctComprasDespesas: 20 }, M12_ALTA, { ...SERVICO, reducaoServico: ACAD });
  const ma = item(ac, 'mix');
  ok(ma.resultados.length === 2 && /art\. 127, §3º/.test(ma.resultados[0].rotulo) && /NBS 1\.2205\.12\.00/.test(ma.resultados[1].rotulo) && /vale a maior/.test(ma.motivo), 'academia: testa o −30% e o −60% — vale a maior');
  // quem também vende mercadoria não entra aqui (o CNAE de serviço não decide o mix de quem vende produto)
  const vet = avaliarConfianca({ ...SV, anexo: 'I' }, M12_ALTA, { tipo: 'comercio', vendeMercadoria: true, podeReduzir: false, reducaoServico: { tipo: 'profissao', faixas: ['mixRed30'], ramo: 'veterinária', quem: 'médicos veterinários' } });
  ok(item(vet, 'mix').selo !== 'a conferir', 'empresa que vende mercadoria: o mix segue a regra do ramo, não a do serviço');
  // das notas: a nota de serviço não mostra a redução — continua baixa
  const nt = avaliarConfianca(SV, { ...M12_ALTA, mix: { fonte: 'notas', meses: M12 } }, { ...SERVICO, reducaoServico: CONTAB });
  ok(item(nt, 'mix').nivel === 'baixa' && /a nota de serviço não mostra a redução/.test(item(nt, 'mix').fonte), 'mix puxado das NFS-e: a nota não mostra a redução, confiança baixa');
  // serviço fora do rol continua alíquota cheia pela lei
  ok(item(avaliarConfianca(SV, M12_ALTA, SERVICO), 'mix').selo === 'alta (norma)', 'serviço sem redução pelo CNAE: alíquota cheia pela lei, como antes');
}

console.log('Transporte de passageiros — isenção do art. 157 e −40% do art. 286:');
{
  // ônibus urbano com permissão, o exemplo da leitura do Módulo 07: cheio dá "manter", −40% empata, isento dá "optar por fora"
  const onibus = { anexo: 'III', rbt12: 1800000, receita: 150000, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0, pctComprasMercadorias: 0, pctComprasDespesas: 35,
    pctImpostoEmbutido: 0, pctExcluidoST: 0, partilha: 16.6, cbs: 9.2, ibs: 0.1, pctPJ: 0 };
  // fatura com NFS-e: o perfil sai "serviço" pelas saídas, mas é passageiros pelo CNAE
  const av = avaliarConfianca(onibus, M12_ALTA, { tipo: 'servico', passageiros: true, vendeMercadoria: false, podeReduzir: false });
  const mx = item(av, 'mix');
  const r40 = mx.resultados.find(r => /−40%/.test(r.rotulo)), ris = mx.resultados.find(r => /isenção/.test(r.rotulo));
  ok(av.decisao === 'manter' && mx.nivel === 'nao_medido' && mx.selo === 'a conferir', 'ônibus que fatura com NFS-e: o mix é dos passageiros (não "serviço, alíquota cheia pela lei")');
  ok(r40 && r40.decisao === 'manter' && Math.abs(r40.diferenca - (-2309.15)) < 0.01, '−40%: ainda "manter" (empate), −R$ 2.309,15 no semestre');
  ok(ris && ris.decisao === 'fora' && Math.abs(ris.diferenca - (-20945.88)) < 0.01, 'isento: "optar por fora", −R$ 20.945,88 — sem o crédito das despesas (alíquota zero com crédito daria −R$ 50.240,88)');
  ok(av.conclusao === 'sem_conclusao' && av.faltamCliente.some(f => /linha aberta ao público, com itinerário e tarifa fixados pelo poder público/.test(f)) && !av.faltamCliente.some(f => /art\.|LC 214/.test(f)),
    'sem conclusão; pro cliente, falta saber se é linha aberta ao público com tarifa fixada pelo poder público (sem artigo de lei)');
  ok(/sob autorização, permissão ou concessão/.test(mx.motivo) && /urbano, semiurbano e metropolitano \(art\. 285, I\)/.test(mx.motivo), 'o motivo traz a "autorização" do art. 157 e o semiurbano do art. 285, I');
  ok(/art\. 157/.test(mx.efeito) && !/art\.|LC 214/.test(mx.efeitoCliente || 'art.'), 'o efeito do escritório cita o artigo; o do cliente, não');
  // isenção informada na ficha: média, testa o cheio e o −40%
  const isento = { ...onibus, mixCheia: 0, mixZero: 100, pctDespesasComCredito: 0 };
  const ai = avaliarConfianca(isento, { ...M12_ALTA, mix: { fonte: 'manual' } }, { tipo: 'servico', passageiros: true, vendeMercadoria: false, podeReduzir: false });
  const mi = item(ai, 'mix');
  ok(ai.decisao === 'fora' && mi.nivel === 'media' && mi.resultados.length === 2 && mi.resultados.some(r => /tudo à alíquota cheia/.test(r.rotulo)) && ai.conclusao === 'a_confirmar', 'isenção informada: média, testa o cheio e o −40% — a confirmar');
  // fretamento, táxi e escolar: não é transporte público coletivo — alíquota cheia, e não "transporte de cargas"
  const fr = avaliarConfianca(onibus, M12_ALTA, { tipo: 'transporte', passageirosOutros: true, vendeMercadoria: false, podeReduzir: false });
  ok(item(fr, 'mix').selo === 'alta (norma)' && /Fretamento dentro do município, táxi e transporte escolar/.test(item(fr, 'mix').motivo) && !/cargas/.test(item(fr, 'mix').motivo), 'fretamento municipal, táxi e escolar: alíquota cheia pela lei, com o motivo certo');
  ok(/cargas/.test(item(avaliarConfianca(onibus, M12_ALTA, { tipo: 'transporte', vendeMercadoria: false, podeReduzir: false }), 'mix').motivo), 'transporte de cargas continua "sem redução"');
}

console.log('Revisão do Módulo 07 — isenção na ficha, trem urbano, fretamento entre cidades e a aula de academia:');
{
  const onibus = { anexo: 'III', rbt12: 1800000, receita: 150000, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0, pctComprasMercadorias: 0, pctComprasDespesas: 60,
    pctImpostoEmbutido: 0, pctExcluidoST: 0, partilha: 16.6, cbs: 9.2, ibs: 0.1, pctPJ: 0 };
  const PASS = { tipo: 'servico', passageiros: true, vendeMercadoria: false, podeReduzir: false };
  // isenção na ficha: as variantes fora dela voltam ao crédito padrão — antes herdavam o crédito zerado da isenção
  const isento = { ...onibus, mixCheia: 0, mixZero: 100, pctDespesasComCredito: 0, pctComprasComCredito: 0 };
  const ai = avaliarConfianca(isento, { ...M12_ALTA, mix: { fonte: 'manual' } }, PASS);
  const r40 = item(ai, 'mix').resultados.find(r => /−40%/.test(r.rotulo));
  const certo = simular({ ...onibus, mixCheia: 0, mixRed40: 100 }).semestre.diferenca;
  ok(r40 && Math.abs(r40.diferenca - certo) < 0.01 && r40.decisao === 'fora', 'isento na ficha: o −40% é testado com o crédito das despesas (' + Math.round(certo) + ', "optar por fora") — antes, sem crédito, dava custo');
  const ai80 = avaliarConfianca({ ...isento, pctComprasDespesas: 80 }, { ...M12_ALTA, mix: { fonte: 'manual' } }, PASS);
  ok(ai80.conclusao === 'firme' && !item(ai80, 'mix').muda, 'com despesas de 80%, cheio e −40% também dão "optar por fora": conclusão firme (antes, "a confirmar" falso)');
  ok(item(ai, 'mix').valor === 'isento pelo art. 157 — sem débito e sem o crédito das compras' && item(ai, 'mix').valorCliente === 'isento — sem imposto na venda e sem crédito nas compras', 'o valor diz "isento" (e, pro cliente, sem o artigo)');
  ok(/Zerado pela isenção/.test(item(ai, 'credDespesas').motivo) && !item(ai, 'credDespesas').efeito && /Zerado pela isenção/.test(item(ai, 'credCompras').motivo) && !item(ai, 'credCompras').efeito,
    'crédito das despesas e das compras zerados pela isenção: o motivo é a isenção, sem faixa a testar');
  // alíquota zero com o crédito mantido (não é a isenção): a isenção é testada e o motivo avisa como lançar
  const zc = avaliarConfianca({ ...onibus, mixCheia: 0, mixZero: 100 }, { ...M12_ALTA, mix: { fonte: 'manual' } }, PASS);
  ok(item(zc, 'mix').resultados.some(r => /isenção/.test(r.rotulo)) && /zere na ficha o crédito das despesas e o % das compras de mercadorias com crédito/.test(item(zc, 'mix').motivo), 'zero com crédito: testa a isenção e diz que campos zerar');
  // trem e metrô: o zero do art. 285, I (com crédito) entra no teste; com despesas de 80% nenhum cenário vira — o texto cita os três
  const tr = avaliarConfianca({ ...onibus, pctComprasDespesas: 80 }, M12_ALTA, { ...PASS, tipo: 'transporte', trilhos: true });
  const mt = item(tr, 'mix');
  ok(mt.resultados.length === 3 && mt.resultados.some(r => /art\. 285, I/.test(r.rotulo)) && !mt.muda && /^Nos 3 cenários testados — /.test(mt.efeito), 'trem urbano: −40%, isenção e zero com crédito; nenhum vira — "Nos 3 cenários testados — …"');
  // fretamento entre cidades: o −40% do art. 286 é questão da lei — premissa, testada, não tira a conclusão
  const FRET = { tipo: 'transporte', passageirosOutros: true, fretamentoIntermunicipal: true, vendeMercadoria: false, podeReduzir: false };
  const fi = avaliarConfianca({ ...onibus, pctComprasDespesas: 50 }, M12_ALTA, FRET);
  const mf = item(fi, 'mix');
  ok(mf.categoria === 'premissa' && mf.selo === 'a conferir' && mf.muda && fi.premissas.includes(mf) && !fi.decisivos.includes(mf) && /art\. 286/.test(mf.motivo), 'fretamento entre cidades: o −40% muda o resultado, mas é premissa da lei (a conferir)');
  // academia: o −30% (registro no conselho) é dado; só o −60% (educação desportiva, lista da lei) mudando, vira premissa
  const ACAD = { tipo: 'desporto', faixas: ['mixRed30', 'mixRed60'], ramo: 'academia' };
  const ac = avaliarConfianca({ ...SV, pctPJ: 5, pctComprasDespesas: 20 }, M12_ALTA, { ...SERVICO, reducaoServico: ACAD });
  const ma = item(ac, 'mix');
  ok(ma.categoria === 'premissa' && ma.resultados.find(r => /−30%/.test(r.rotulo)).decisao === 'manter' && ma.resultados.find(r => /−60%/.test(r.rotulo)).decisao === 'fora' && ac.conclusao !== 'sem_conclusao',
    'academia: só o −60% (lista da lei) vira — premissa, sem "sem conclusão"');
  const ac2 = avaliarConfianca({ ...SV, pctPJ: 30, pctComprasDespesas: 40 }, M12_ALTA, { ...SERVICO, reducaoServico: ACAD });
  ok(item(ac2, 'mix').categoria === 'dado' && ac2.conclusao === 'sem_conclusao', 'academia em que o −30% (registro no conselho) também vira: dado da empresa — sem conclusão');
  // o texto da conta segue o mix: −60% informado numa contabilidade não é "tudo à alíquota cheia"
  const mx6 = avaliarConfianca({ ...SV, mixCheia: 80, mixRed60: 20 }, { ...M12_ALTA, mix: { fonte: 'manual' } }, { ...SERVICO, reducaoServico: CONTAB });
  ok(/A conta usa o mix informado\.$/.test(item(mx6, 'mix').motivo), 'mix informado sem o −30%: "A conta usa o mix informado." (antes, "tudo à alíquota cheia")');
}

console.log('Mercado e hortifrúti sem as notas de venda — a alíquota zero entra no teste:');
{
  // minimercado: com metade a −60% ainda é "manter"; com 40% a zero e 30% a −60% (o exercício do curso), "optar por fora"
  const mm = { anexo: 'I', rbt12: 900000, receita: 75000, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0, pctComprasMercadorias: 70, pctComprasDespesas: 3, pctImpostoEmbutido: 0,
    pctExcluidoST: 10, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 5 };
  const COM = { tipo: 'comercio', vendeMercadoria: true, podeReduzir: true };
  const av = avaliarConfianca(mm, M12_ALTA, { ...COM, ramoZero: 'mercado' });
  const mx = item(av, 'mix');
  ok(mx.nivel === 'nao_medido' && /cesta básica, o hortifrúti e os ovos têm alíquota zero/.test(mx.motivo), 'mercado sem as notas: não medido, e o motivo fala da alíquota zero');
  ok(mx.resultados.length === 2 && mx.resultados[0].decisao === 'manter' && mx.resultados[1].decisao === 'fora' && /40% da venda com alíquota zero/.test(mx.resultados[1].rotulo), 'metade a −60% não muda; 40% a zero e 30% a −60% muda');
  ok(av.conclusao === 'sem_conclusao' && av.decisivos.includes(mx), 'sem conclusão — antes, só com a metade a −60%, a conta ficava "manter" firme');
  const antes = avaliarConfianca(mm, M12_ALTA, COM);
  ok(antes.conclusao === 'firme' && item(antes, 'mix').resultados.length === 1, '(o mesmo caso sem o ramo de alíquota zero: só a metade a −60%, conclusão firme)');
  const hf = avaliarConfianca(mm, M12_ALTA, { ...COM, ramoZero: 'hortifruti' });
  ok(item(hf, 'mix').resultados.length === 1 && /90% da venda com alíquota zero/.test(item(hf, 'mix').resultados[0].rotulo) && /Anexo XV/.test(item(hf, 'mix').motivo), 'hortifrúti: testa 90% da venda a zero (Anexo XV), não "metade a −60%"');
}

console.log('O motor não é chamado com entrada inválida:');
{
  let erro = null;
  try { avaliarConfianca({ ...BASE, receita: 0 }, PROC_BASE, INDUSTRIA); } catch (e) { erro = e; }
  let erroMotor = null; try { simular({ ...BASE, receita: 0 }); } catch (e) { erroMotor = e; }
  ok(!!erro === !!erroMotor, 'sem receita a avaliação para como o motor (' + (erro ? erro.message : 'sem erro') + ')');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
