// Teste da análise técnica da Reforma: o texto certo pro perfil certo (varejo PF, prestador B2B) e o empate técnico.
// Rodar com: node tests/rt-analise.test.mjs — casos sintéticos, sem dado de cliente.
import fs from 'fs';
import { simular } from '../assets/js/rt-motor.js';
import { gerarAnalise } from '../assets/js/rt-analise.js';
const page = fs.readFileSync(new URL('../fiscal-reforma.html', import.meta.url), 'utf8');
const i = page.indexOf('    function montarDadosAnalise('); const j = page.indexOf("\n    $('dGerar').onclick");
const src = page.slice(i, j);
const montarDadosAnalise = new Function('simular', 'ANO_XML', 'location', src + '\nreturn montarDadosAnalise;')(simular, 2026, { href: 'http://x/' });
function caso(nome, ent, dom, xml) {
  const sim = simular(ent);
  const d = montarDadosAnalise({ id: 1 }, { nome_principal: nome, documento: '00000000000000' }, ent, sim, dom, xml);
  const html = gerarAnalise(d);
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { sim, d, txt };
}
// 1) Vila Nova: varejo, 2,6% PJ pelas saídas XLS, sem XML
const vn = caso('VAREJO TESTE', { anexo:'I', rbt12:2484930.98, receita:205256.49, mixCheia:100, pctComprasMercadorias:83.29, pctComprasDespesas:2.35, pctImpostoEmbutido:0, pctExcluidoST:8.5, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.6, aliqEfetivaInformada:9.87 },
  { faturamento: { total: 1642051.92, servicos: 0, saidas: 1642051.92 }, periodoRotulo: 'jan/26–ago/26', pgdas: { competencia: '2026-08', dasTotal: 22003.93, cbsNoDas: 3718, aliquotaEfetiva: 9.87 }, vendas: { total: 1642051.92, mercadorias: 1642051.92, servicos: 0, st: 0, pctPJ: 2.6, pj: 42693, pf: 60000, consumidor: 1539358, nPJ: 31, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null);
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

// 3) Drogaria Guerra (referência)
const g = simular({ anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:33.5, partilha:15.5, cbs:9.3, ibs:0, pctPJ:10, creditoEstoqueMes:1541.67 });
console.log('Referência:'); chk('Guerra continua OPTE (' + g.veredito.tipo + ')', g.veredito.tipo === 'OPTE');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
