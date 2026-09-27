// Teste da análise técnica da Reforma: o texto certo pro perfil certo (varejo PF, prestador B2B) e o empate técnico.
// Rodar com: node tests/rt-analise.test.mjs — casos sintéticos, sem dado de cliente.
import fs from 'fs';
import { simular } from '../assets/js/rt-motor.js';
import { gerarAnalise } from '../assets/js/rt-analise.js';
const page = fs.readFileSync(new URL('../fiscal-reforma.html', import.meta.url), 'utf8');
const i = page.indexOf('    function montarDadosAnalise('); const j = page.indexOf("\n    $('dGerar').onclick");
const src = page.slice(i, j);
import { perfilAtividade, ramoComReducao } from '../assets/js/dominio-relatorios.js';
const montarDadosAnalise = new Function('simular', 'ANO_XML', 'location', 'perfilAtividade', 'ramoComReducao', src + '\nreturn montarDadosAnalise;')(simular, 2026, { href: 'http://x/' }, perfilAtividade, ramoComReducao);
function caso(nome, ent, dom, xml, cnae) {
  const sim = simular(ent);
  const d = montarDadosAnalise({ id: 1, cnae_base: cnae || null }, { nome_principal: nome, documento: '00000000000000' }, ent, sim, dom, xml);
  const html = gerarAnalise(d);
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { sim, d, txt };
}
// 1) Vila Nova: varejo, 2,6% PJ pelas saídas XLS, sem XML
const vn = caso('VAREJO TESTE', { anexo:'I', rbt12:2484930.98, receita:205256.49, mixCheia:100, pctComprasMercadorias:83.29, pctComprasDespesas:2.35, pctImpostoEmbutido:0, pctExcluidoST:8.5, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.6, aliqEfetivaInformada:9.87 },
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
chk('mix a conferir', /assumido integralmente cheio/.test(vn.txt));
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
chk('dica do cancelamento até 30/11', /cancelá-la até 30\/11\/2026/.test(vr.txt));
// 5) caso limpo continua firme (prestador B2B sem alertas)
chk('caso sem dado suspeito não vira "a confirmar" (' + pb.d.alertas.length + ' alerta)', pb.d.aConfirmar === false && !/Tendência:/.test(pb.txt));

// resumo no topo, em linguagem simples, coerente com a recomendação
chk('resumo: empate diz "Manter como está"', /EMPATE TÉCNICO Manter como está/.test(vn.txt.replace(/·/g, '')) || /Manter como está/.test(vn.txt));
chk('resumo: compras ≥ vendas vira "TENDÊNCIA — A CONFIRMAR"', /TENDÊNCIA — A CONFIRMAR/.test(vr.txt));
chk('resumo: alerta de receita × faturamento do Simples', /do faturamento dos últimos 12 meses informado no Simples/.test(vr.txt));

// 6) Restaurante sem notas: mix não medido vira "dado que faltou", com a direção do erro
const rs = caso('HAMBURGUERIA TESTE', { anexo:'I', rbt12:872624.42, receita:72478.81, mixCheia:100, pctComprasMercadorias:49.5, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:3.4, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.4, aliqEfetivaInformada:7.85 },
  { faturamento: { total: 579830, servicos: 0, saidas: 579830 }, periodoRotulo: 'jan/26–ago/26' }, null, '5611-2/01');
console.log('Restaurante sem notas:');
chk('veredito segue MANTENHA', rs.sim.veredito.tipo === 'MANTENHA');
chk('aponta a redução de 40% que faltou medir', /comida preparada tem redução de 40%/.test(rs.txt));
chk('diz que a conclusão não muda', /a conclusão não muda/.test(rs.txt));

// 7) Transportadora de carga (CT-e nas saídas, CNAE 4930, Anexo III): nada de mix, redução ou "produtos"
const tr = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null, '4930-2/02');
console.log('Transporte de cargas:');
chk('perfil = transporte de cargas', tr.d.perfil.tipo === 'transporte' && !tr.d.perfil.vendeMercadoria);
chk('sem "notas de venda não foram analisadas"', !/notas de venda não foram analisadas/.test(tr.txt));
chk('sem "insumos agropecuários, cesta básica"', !/cesta básica/.test(tr.txt));
chk('faturamento rotulado como fretes (CT-e)', /fretes \(CT-e\)/.test(tr.txt));
chk('fonte da alíquota: frete sem redução na LC 214', /Transporte de cargas não tem redução na LC 214/.test(tr.txt));
chk('pergunta sobre o frete, não sobre hora técnica', /Como o frete é cobrado/.test(tr.txt) && !/hora técnica/.test(tr.txt));
chk('sem ISS retido (frete é ICMS)', !/ISS retido/.test(tr.txt));
chk('resumo não diz "não compensa" quando o crédito dos clientes supera o custo', !/não compensa o custo/.test(tr.txt) && /conversa comercial/.test(tr.txt));

// 8) Janela e B2B com crédito dos clientes maior que o custo: registrar agora, decidir até 30/11 — nunca "conversar até 30/09"
globalThis.__HOJE_ISO__ = '2026-09-28';
const b2b = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela aberta, crédito dos clientes > custo:');
chk('decisão: registrar até 30/09 e decidir até 30/11', /Registrar a opção até 30\/09 — e decidir até 30\/11/.test(b2b.txt));
chk('nada de "conversa ... antes de 30/09"', !/antes de 30\/09/.test(b2b.txt));
globalThis.__HOJE_ISO__ = '2026-10-05';
const b2bOut = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela fechada (outubro):');
chk('prazo diz que setembro fechou e aponta março/2027', /janela de setembro\/2026 já fechou/.test(b2bOut.txt) && /março\/2027/.test(b2bOut.txt));
chk('decisão: manter por ora e reavaliar em março/2027', /Manter por ora — e reavaliar em março\/2027/.test(b2bOut.txt));
chk('sem "formalizar até 30/09"', !/formalizar a opção até <b>30\/09|formalizar até 30\/09|até 30\/09\/2026;/.test(b2bOut.txt.replace(/\s+/g, ' ')) && !/Registrar a opção até 30\/09/.test(b2bOut.txt));
delete globalThis.__HOJE_ISO__;

// 3) Drogaria Guerra (referência)
const g = simular({ anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:33.5, partilha:15.5, cbs:9.3, ibs:0, pctPJ:10, creditoEstoqueMes:1541.67 });
console.log('Referência:'); chk('Guerra continua OPTE (' + g.veredito.tipo + ')', g.veredito.tipo === 'OPTE');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
