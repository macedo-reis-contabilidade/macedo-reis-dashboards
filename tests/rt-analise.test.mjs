// Teste da análise técnica da Reforma: o texto certo pro perfil certo (varejo PF, prestador B2B) e o empate técnico.
// Rodar com: node tests/rt-analise.test.mjs — casos sintéticos, sem dado de cliente.
import fs from 'fs';
import { simular } from '../assets/js/rt-motor.js';
import { gerarAnalise } from '../assets/js/rt-analise.js';
const page = fs.readFileSync(new URL('../fiscal-reforma.html', import.meta.url), 'utf8');
const i = page.indexOf('    function montarDadosAnalise('); const j = page.indexOf("\n    $('dGerar').onclick");
const src = page.slice(i, j);
import { perfilAtividade, ramoComReducao, conferirRbt12, CREDITO_FORNECEDOR_SIMPLES } from '../assets/js/dominio-relatorios.js';
import { RT_PRAZO, janelaAberta as janelaAbertaEm } from '../assets/js/rt-prazos.js';
const montarDadosAnalise = new Function('simular', 'ANO_XML', 'location', 'perfilAtividade', 'ramoComReducao', 'conferirRbt12', 'RT_PRAZO', 'janelaAbertaEm', 'CREDITO_FORNECEDOR_SIMPLES', src + '\nreturn montarDadosAnalise;')(simular, 2026, { href: 'http://x/' }, perfilAtividade, ramoComReducao, conferirRbt12, RT_PRAZO, janelaAbertaEm, CREDITO_FORNECEDOR_SIMPLES);
// data fixa dentro da janela (até 30/10/2026, Res. CGSN 194/2026): o teste não pode depender do relógio de quem roda
// (os casos que testam a janela fechada fixam globalThis.__HOJE_ISO__ antes de chamar)
function caso(nome, ent, dom, xml, cnae, hojeISO = globalThis.__HOJE_ISO__ || '2026-09-29') {
  const sim = simular(ent);
  const antes = globalThis.__HOJE_ISO__;
  globalThis.__HOJE_ISO__ = hojeISO;
  const d = montarDadosAnalise({ id: 1, cnae_base: cnae || null }, { nome_principal: nome, documento: '00000000000000' }, ent, sim, dom, xml);
  if (antes === undefined) delete globalThis.__HOJE_ISO__; else globalThis.__HOJE_ISO__ = antes;
  d.hojeISO = hojeISO;
  const html = gerarAnalise(d);
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { sim, d, txt, args: [nome, ent, dom, xml, cnae] };
}
// 1) Varejo PF em empate técnico: 2,6% PJ pelas saídas XLS, sem XML, alíquota do PGDAS com 8,5% do DAS excluído.
//    Compras em 82% da receita (eram 83,29%): com a exclusão aplicada uma vez só (02/10/2026) a vantagem de
//    por fora passou do limiar e o caso deixava de ser empate — o teste é do texto do empate, não desses números
const vn = caso('VAREJO TESTE', { anexo:'I', rbt12:2484930.98, receita:205256.49, mixCheia:100, pctComprasMercadorias:82, pctComprasDespesas:2.35, pctImpostoEmbutido:0, pctExcluidoST:8.5, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.6, aliqEfetivaInformada:9.87 },
  { faturamento: { total: 1642051.92, servicos: 0, saidas: 1642051.92 }, periodoRotulo: 'jan/26–ago/26', pgdas: { competencia: '2026-08', dasTotal: 22003.93, cbsNoDas: 3718, aliquotaEfetiva: 9.87 }, vendas: { total: 1642051.92, mercadorias: 1642051.92, servicos: 0, st: 0, pctPJ: 2.6, pj: 42693, pf: 60000, consumidor: 1539358, nPJ: 31, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null, '4789-0/04');
let falhas = 0;
const chk = (rot, ok) => { if (!ok) falhas++; console.log((ok ? '  ✓ ' : '  ✗ ') + rot); };
console.log('Varejo PF:'); chk('veredito MANTENHA/empate', vn.sim.veredito.tipo === 'MANTENHA' && vn.sim.veredito.empate);
chk('recomendação de empate', /empate técnico, não formalizar/i.test(vn.txt));
chk('seção 2 pelo Domínio (pessoa física)', /pessoa física ou consumidor não identificado/.test(vn.txt));
chk('sem "hora técnica"', !/hora técnica/.test(vn.txt));
chk('sem ISS retido', !/ISS retido/.test(vn.txt));
chk('sem "Serviço não consta"', !/Serviço não consta/.test(vn.txt));
chk('sem "multiplicar o crédito"', !/multiplicar o crédito/.test(vn.txt));
chk('sem repasse que inverte', !/A variável que inverte/.test(vn.txt));
chk('pergunta de fornecedores', /fornecedores/.test(vn.txt));
chk('mix a conferir', /assumido integralmente cheio/.test(vn.txt) && /Não usamos as notas fiscais de venda/.test(vn.txt));
// 2) Prestador B2B (regra antiga preservada)
const pb = caso('SERVIÇOS TESTE', { anexo:'III', rbt12:1200000, receita:100000, mixCheia:100, pctComprasMercadorias:5, pctComprasDespesas:5, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:95 },
  { faturamento: { total: 800000, servicos: 800000, saidas: 0 }, periodoRotulo: 'jan/26–ago/26' }, null);
console.log('Prestador B2B:'); chk('veredito ' + pb.sim.veredito.tipo, true);
chk('repasse ainda é a variável', /A variável que inverte|repasse/i.test(pb.txt));
chk('hora técnica presente', /hora técnica/.test(pb.txt));
chk('ISS presente', /ISS retido/.test(pb.txt));
// 4) Varejo com entradas acima da receita (caso "compras = vendas"): tendência a confirmar, sem contradição
const vr = caso('MOVEIS TESTE', { anexo:'I', rbt12:1133527.31, receita:59311.38, mixCheia:100, pctComprasMercadorias:100, pctComprasDespesas:4, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.2, aliqEfetivaInformada:8.72 },
  { faturamento: { total: 474491.04, servicos: 0, saidas: 474491.04 }, periodoRotulo: 'jan/26–ago/26', vendas: { total: 482844.13, mercadorias: 482844.13, servicos: 0, st: 0, pctPJ: 2.2, pj: 10622, pf: 0, consumidor: 472222, nPJ: 5, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null);
console.log('Varejo com compras ≥ vendas:'); chk('veredito OPTE (' + vr.sim.veredito.tipo + ')', vr.sim.veredito.tipo === 'OPTE');
chk('recomendação vira "tendência — a confirmar"', /Tendência: .*a confirmar/.test(vr.txt));
chk('alerta de compras × vendas', /compra quase o mesmo/.test(vr.txt));
chk('aponta o que inverte (crédito 20% menor)', /crédito das entradas 20% menor/.test(vr.txt));
chk('sem "Nenhuma incerteza técnica isolada derruba"', !/Nenhuma incerteza técnica isolada derruba/.test(vr.txt));
chk('seção 10 sem "nenhum deles inverte"', !/nenhum deles inverte/.test(vr.txt));
chk('linha "Base creditável" marca que muda', /Sim — com menos crédito de entrada/.test(vr.txt));
chk('dica do cancelamento de 03/11 a 20/12', /cancelá-la de 03\/11 a 20\/12\/2026/.test(vr.txt));
// 01/10/2026: pela Res. CGSN 194/2026 a janela vai até 30/10 — a análise não pode dizer que fechou (dizia, até 02/10)
const vrO = caso(...vr.args, '2026-10-01');
chk('01/10: janela ainda aberta, prazo 30/10/2026', /formalizada até 30\/10\/2026/.test(vrO.txt) && !/fechou/.test(vrO.txt));
// o mesmo varejo gerado depois da janela (31/10/2026): o prazo vira "fechou" e some a dica de cancelar
const vrF = caso(...vr.args, '2026-10-31');
chk('janela fechada: prazo diz que fechou em 30/10', /fechou em 30\/10\/2026/.test(vrF.txt));
chk('janela fechada: sem a dica de cancelar de 03/11 a 20/12', !/cancelá-la de 03\/11 a 20\/12\/2026/.test(vrF.txt));
// 5) caso limpo continua firme (prestador B2B sem alertas)
chk('caso sem dado suspeito não vira "a confirmar" (' + pb.d.alertas.length + ' alerta)', pb.d.aConfirmar === false && !/Tendência:/.test(pb.txt));

// resumo no topo, em linguagem simples, coerente com a recomendação
chk('resumo: empate diz "Manter como está"', /EMPATE TÉCNICO Manter como está/.test(vn.txt.replace(/·/g, '')) || /Manter como está/.test(vn.txt));
chk('resumo: compras ≥ vendas vira "TENDÊNCIA — A CONFIRMAR"', /TENDÊNCIA — A CONFIRMAR/.test(vr.txt));
chk('sem a conta errada de média × 12 contra o RBT12', !/× 12|no ano\) é/.test(vr.txt));

// 6) Restaurante sem notas: mix não medido vira "dado que faltou", com a direção do erro
const rs = caso('HAMBURGUERIA TESTE', { anexo:'I', rbt12:872624.42, receita:72478.81, mixCheia:100, pctComprasMercadorias:49.5, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:3.4, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.4, aliqEfetivaInformada:7.85 },
  { faturamento: { total: 579830, servicos: 0, saidas: 579830 }, periodoRotulo: 'jan/26–ago/26' }, null, '5611-2/01');
console.log('Restaurante sem notas:');
chk('veredito segue MANTENHA', rs.sim.veredito.tipo === 'MANTENHA');
chk('aponta o desconto de 40% que faltou medir, em linguagem simples', /a comida paga o imposto novo com desconto de 40%/.test(rs.txt) && /Para um cálculo mais preciso/.test(rs.txt));
chk('diz que a recomendação não muda', /a recomendação não muda/.test(rs.txt));
{ const perg = rs.txt.slice(rs.txt.indexOf('O que levantar'), rs.txt.indexOf('O que falta para fechar'));
  chk('lancheria: perguntas de restaurante, sem cesta básica nem insumos agropecuários', /iFood/.test(perg) && !/cesta básica|insumos agropecuários|linhas de produto/.test(perg)); }

// 7) Transportadora de carga (CT-e nas saídas, CNAE 4930, Anexo III): nada de mix, redução ou "produtos"
const tr = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null, '4930-2/02');
console.log('Transporte de cargas:');
chk('perfil = transporte de cargas', tr.d.perfil.tipo === 'transporte' && !tr.d.perfil.vendeMercadoria);
chk('sem aviso de notas de venda', !/Não usamos as notas fiscais de venda/.test(tr.txt));
chk('sem "insumos agropecuários, cesta básica"', !/cesta básica/.test(tr.txt));
chk('faturamento rotulado como fretes (CT-e)', /fretes \(CT-e\)/.test(tr.txt));
chk('fonte da alíquota: frete sem redução na LC 214', /Transporte de cargas não tem redução na LC 214/.test(tr.txt));
chk('pergunta sobre o frete, não sobre hora técnica', /Como o frete é cobrado/.test(tr.txt) && !/hora técnica/.test(tr.txt));
chk('sem ISS retido (frete é ICMS)', !/ISS retido/.test(tr.txt));
chk('resumo não diz "não compensa" quando o crédito dos clientes supera o custo', !/não compensa o custo/.test(tr.txt) && /conversa comercial/.test(tr.txt));

// 8) Janela e B2B com crédito dos clientes maior que o custo: registrar agora, decidir até 20/12 — nunca "conversar até 30/10"
globalThis.__HOJE_ISO__ = '2026-09-28';
const b2b = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela aberta, crédito dos clientes > custo:');
chk('decisão: registrar até 30/10 e decidir até 20/12', /Registrar a opção até 30\/10 — e decidir até 20\/12/.test(b2b.txt));
chk('nada de "conversa ... antes de 30/10"', !/antes de 30\/10/.test(b2b.txt));
globalThis.__HOJE_ISO__ = '2026-10-31';
const b2bOut = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela fechada (31/10):');
chk('prazo diz que fechou em 30/10 e aponta março/2027', /fechou em 30\/10\/2026/.test(b2bOut.txt) && /março\/2027/.test(b2bOut.txt));
chk('decisão: manter por ora e reavaliar em março/2027', /Manter por ora — e reavaliar em março\/2027/.test(b2bOut.txt));
chk('sem "formalizar até 30/10"', !/formalizar a opção até 30\/10|formalizar até 30\/10|até 30\/10\/2026;/.test(b2bOut.txt.replace(/\s+/g, ' ')) && !/Registrar a opção até 30\/10/.test(b2bOut.txt));
delete globalThis.__HOJE_ISO__;

// 3) Drogaria Guerra (referência)
const g = simular({ anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:33.5, partilha:15.5, cbs:9.3, ibs:0, pctPJ:10, creditoEstoqueMes:1541.67 });
console.log('Referência:'); chk('Guerra continua OPTE (' + g.veredito.tipo + ')', g.veredito.tipo === 'OPTE');

// 4) Correções de 03/10/2026 (base do curso): crédito de estoque, fornecedor do Simples, bar e restaurante, notas em 2027
const ga = caso('DROGARIA TESTE', { anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:49, pctReceitaMonofasica:100, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:10, creditoEstoqueMes:1541.67 }, null, null, '4771-7/01');
console.log('Crédito de estoque (art. 381, provável, não garantido):');
chk('sem o estoque a conclusão inverte → alerta', ga.d.alertas.some(a => /crédito de estoque/.test(a.texto)));
chk('recomendação vira tendência a confirmar', /Tendência/.test(ga.d.recomendacao.titulo) || /TENDÊNCIA/.test(ga.txt));
chk('linha de sensibilidade do estoque', ga.d.sensibilidade.some(x => /estoque/.test(x.nome) && /^Sim/.test(x.muda)));
chk('DAS de 2027 acima do de hoje, com a explicação do monofásico', /exclusão do PIS\/COFINS monofásico acaba em 2027/.test(ga.txt));
chk('alíquota: referência menos 0,1 ponto (ADCT)', /menos 0,1 ponto, como manda o ADCT/.test(ga.txt));
chk('linha de sensibilidade do preço final mantido', ga.d.sensibilidade.some(x => /Preço final igual/.test(x.nome)));
const fs1 = caso('VAREJO SEM CONSULTA', { anexo:'I', rbt12:1200000, receita:100000, mixCheia:100, pctComprasMercadorias:89, pctComprasDespesas:1, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:3, aliqEfetivaInformada:8.86 }, null, null, '4754-7/01');
console.log('Fornecedor do Simples (regime não consultado):');
chk('veredito OPTE (' + fs1.sim.veredito.tipo + ')', fs1.sim.veredito.tipo === 'OPTE');
const alF = fs1.d.alertas.find(a => /regime dos fornecedores não foi consultado/.test(a.texto));
chk('alerta com o limite de compras do Simples e a base legal', !!alF && /se \d+% ou mais das compras/.test(alF.texto) && /LC 123, art\. 23, §1º-A/.test(alF.texto));
chk('o teste de 20% não repete "fornecedores do Simples"', !fs1.d.alertas.some(a => /20% menor \(fornecedores do Simples/.test(a.texto)));
const rest = caso('RESTAURANTE TESTE', { anexo:'I', rbt12:1200000, receita:100000, mixCheia:20, mixRed40:80, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:10, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:5 },
  null, { pctPJ: 5, nNotas: 900, periodoRotulo: 'jan–ago/2026', cobertura: 100, clientes: [] }, '5611-2/01');
console.log('Bar e restaurante (art. 276):');
chk('ponto central: bebida em lata/garrafa e alcoólica geram crédito', /bebida em lata ou garrafa e a alcoólica/.test(rest.txt));
chk('sem "adquirente de alimentação e bebidas não pode"', !/adquirente de alimentação e bebidas não pode/.test(rest.txt));
chk('crédito do cliente só da parte cheia', Math.abs(rest.sim.semestre.creditoClienteFora - 6 * rest.sim.mes.debitoCreditavel) < 0.01 && rest.sim.mes.debitoCreditavel < rest.sim.mes.debitoFora);
console.log('Notas no padrão IBS/CBS em 2027:');
chk('manter também avisa das notas a partir de 01/01/2027', /Mantendo, não é preciso fazer nada quanto à opção/.test(rest.txt) && /Ato Conjunto RFB\/CGIBS nº 4\/2026/.test(rest.txt));

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
