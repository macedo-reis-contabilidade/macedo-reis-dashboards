// Teste das agregações da operação por XML.
// Rodar com: node tests/operacao-xml.test.mjs
//
// O caso que motivou este teste: uma indústria compra por cinco filiais.
// Somando por documento, cada filial fica pequena e nenhuma entra no topo
// da lista — o grupo econômico, que é o cliente de verdade, desaparece do
// ranking. clientesRaiz precisa agrupar pela raiz do CNPJ sobre TODAS as
// vendas, nunca reagrupando um recorte do topo.
//
// Dados inventados: este repositório é público.

import { agregar, cfopOperacao } from '../assets/js/operacao-xml.js';

let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const perto = (a, b, t, m) => ok(a != null && Math.abs(a - b) <= t, m + ' (esperado ' + b + ', obtido ' + a + ')');

let seq = 0;
const nf = (dest_doc, nome, valor, cfop = '5102', extra = {}) => ({
  id: 'd' + (++seq), modelo: '55', data_emissao: '2026-07-10', tipo: 'saida', finalidade: 1,
  emit_doc: '11111111000111', emit_nome: 'EMPRESA TESTE', emit_uf: 'RS', emit_crt: 1,
  dest_doc, dest_tipo: dest_doc.length === 14 ? 'PJ' : 'PF', dest_nome: nome, dest_uf: 'RS',
  valor_total: valor, cfop_principal: cfop, ...extra
});
const nfse = (dest_doc, nome, valor) => ({ ...nf(dest_doc, nome, valor, null), modelo: 'nfse' });

// grupo com 5 filiais: R$ 25.000 no total, nenhuma passando de R$ 5.000
const docs = [
  nf('99888777000101', 'INDUSTRIA GRANDE FILIAL 1', 5000),
  nf('99888777000202', 'INDUSTRIA GRANDE FILIAL 2', 5000),
  nf('99888777000303', 'INDUSTRIA GRANDE FILIAL 3', 5000),
  nfse('99888777000404', 'INDUSTRIA GRANDE FILIAL 4', 5000),
  nfse('99888777000505', 'INDUSTRIA GRANDE FILIAL 5', 5000),
  // dezoito clientes de um CNPJ só, cada um maior que qualquer filial acima
  // raízes distintas: cada um é um grupo econômico diferente
  ...Array.from({ length: 18 }, (_, i) => nf(String(20000001 + i) + '000100', 'CLIENTE ' + (i + 1), 6000)),
  // não são venda: retorno de conserto e remessa
  nf('22222222000122', 'MANDOU CONSERTAR', 400000, '5916'),
  nf('22222222000122', 'MANDOU CONSERTAR', 100000, '5915')
];

const m = agregar(docs, [], new Map(), { ano: 2026, mesIni: 7, mesFim: 7 });

console.log('Vendas (retorno de conserto fica fora):');
perto(m.kpis.vendas, 25000 + 18 * 6000, 0.005, 'total de vendas');
ok(m.kpis.nVendas === 23, 'conta 23 notas de venda, não as 25 do período');

console.log('\nAgrupamento por raiz de CNPJ:');
const grupo = m.clientesRaiz.topo.find(g => /INDUSTRIA GRANDE/.test(g.nome));
ok(!!grupo, 'o grupo com 5 filiais aparece no ranking');
if (grupo) {
  perto(grupo.valor, 25000, 0.005, 'soma as 5 filiais (NF-e e NFS-e juntas)');
  ok(grupo.cnpjs === 5, 'conta os 5 CNPJs do grupo');
  ok(m.clientesRaiz.topo[0] === grupo, 'e por isso é o maior cliente — sozinha, nenhuma filial entraria');
}
// o ranking por documento continua existindo e continua vendo as filiais separadas
// é justamente isto que o agrupamento por raiz resolve: no ranking por documento,
// com 18 clientes de R$ 6.000 na frente, nenhuma filial de R$ 5.000 entra no top 15
const porDoc = m.clientes.topo.filter(c => /INDUSTRIA GRANDE/.test(c.nome));
ok(porDoc.length === 0, 'nenhuma filial entra no ranking por documento — reagrupar o topo perderia o grupo inteiro');
ok(m.clientesRaiz.distintos === 19, 'conta 19 grupos econômicos nas vendas (o de conserto não é venda)');

console.log('\nConcentração:');
const total = m.kpis.vendas;
const top10 = m.clientesRaiz.topo.slice(0, 10).reduce((a, g) => a + g.valor, 0);
perto(top10 / total * 100, (25000 + 9 * 6000) / total * 100, 0.05, 'top 10 sobre o total de vendas');

console.log('\nCFOP espelhado na entrada:');
ok(cfopOperacao({ tipo: 'entrada', cfop_principal: '5102' }) === '1102', 'entrada emitida pelo fornecedor: 5102 vira 1102');
ok(cfopOperacao({ tipo: 'entrada', cfop_principal: '6102' }) === '2102', '6102 vira 2102');
ok(cfopOperacao({ tipo: 'saida', cfop_principal: '5102' }) === '5102', 'saída não espelha');


console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
