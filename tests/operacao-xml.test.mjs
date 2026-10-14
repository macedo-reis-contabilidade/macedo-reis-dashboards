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

import { agregar, cfopOperacao, regimeDoNcm, avisosVendasEspeciais } from '../assets/js/operacao-xml.js';

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

// absorvente e fralda têm o mesmo NCM (9619.00.00): o absorvente tem alíquota zero (LC 214, art. 147),
// a fralda fica na redução de 60% da tabela — só a descrição do item separa os dois
console.log('\nAbsorvente × fralda (NCM 9619):');
const regras9619 = new Map([['9619', { regime: 'reducao_60', descricao: 'Fraldas' }]]);
ok(regimeDoNcm('9619.00.00', regras9619, 'ABSORVENTE NOTURNO C/ABAS 8UN').regime === 'zero', 'absorvente: alíquota zero');
ok(regimeDoNcm('96190000', regras9619, 'Tampão interno médio 10 un').regime === 'zero', 'tampão, com acento: alíquota zero');
ok(regimeDoNcm('96190000', regras9619, 'COLETOR MENSTRUAL TAM 1').regime === 'zero', 'coletor menstrual: alíquota zero');
ok(regimeDoNcm('96190000', regras9619, 'Calcinha absorvente P').regime === 'zero', 'calcinha absorvente: alíquota zero');
ok(regimeDoNcm('96190000', regras9619, 'FRALDA INFANTIL G 30UN').regime === 'reducao_60', 'fralda: segue a tabela (−60%)');
ok(regimeDoNcm('96190000', regras9619, 'FRALDA GERIATRICA ALTA ABSORVENCIA').regime === 'reducao_60', 'fralda que fala em absorção: segue a tabela');
ok(regimeDoNcm('96190000', regras9619, 'ABSORVENTE PARA SEIOS 30UN').regime === 'reducao_60', 'absorvente para seios: segue a tabela');
ok(regimeDoNcm('96190000', regras9619).regime === 'reducao_60', 'sem descrição: segue a tabela');
ok(regimeDoNcm('33049990', regras9619, 'PROTETOR SOLAR FPS 50').regime === 'cheia', 'fora do 9619, a descrição não muda nada');

const docV = { id: 'v9619', modelo: '65', data_emissao: '2026-07-11', tipo: 'saida', finalidade: 1, emit_doc: '11111111000111', emit_nome: 'FARMACIA TESTE',
  emit_uf: 'RS', emit_crt: 1, dest_doc: null, dest_tipo: 'PF', dest_nome: null, dest_uf: null, valor_total: 1000, cfop_principal: '5102' };
const itens9619 = [
  { documento_id: 'v9619', ncm: '96190000', descricao: 'ABSORVENTE NOTURNO C/8', cfop: '5102', unidade: 'UN', quantidade: 10, valor_total: 300 },
  { documento_id: 'v9619', ncm: '96190000', descricao: 'FRALDA INFANTIL G', cfop: '5102', unidade: 'PCT', quantidade: 5, valor_total: 700 }
];
const m9619 = agregar([docV], itens9619, regras9619, { ano: 2026, mesIni: 7, mesFim: 7 });
perto(m9619.ponte.mixZero, 30, 0.001, 'no mix das vendas, o absorvente vai pra alíquota zero');
perto(m9619.ponte.mixRed60, 70, 0.001, 'e a fralda fica na redução de 60%');

// Exportação e Zona Franca (12/10/2026, Módulo 05): a venda ao exterior é imune (LC 214, art. 79) e a de industrializado
// para a ZFM/ALC tem alíquota zero (arts. 445 e 463), mas entram pelo NCM — a ponte mede, a ficha avisa
console.log('\nExportação e Zona Franca (o simulador ainda não separa — a ficha avisa):');
const ex = (id, cfop, valor, extra = {}) => ({ id, modelo: '55', data_emissao: '2026-07-12', tipo: 'saida', finalidade: 1, emit_doc: '11111111000111',
  emit_nome: 'INDUSTRIA TESTE', emit_uf: 'RS', emit_crt: 1, dest_doc: '33333333000133', dest_tipo: 'PJ', dest_nome: 'CLIENTE', dest_uf: 'SP',
  valor_total: valor, cfop_principal: cfop, ...extra });
const docsEx = [
  ex('e1', '5101', 4000),                                                            // venda interna comum
  ex('e2', '7101', 3000, { dest_doc: 'X123', dest_tipo: 'EX', dest_uf: 'EX' }),      // exportação direta
  ex('e3', '6109', 2000, { dest_uf: 'AM' }),                                         // venda à Zona Franca
  ex('e4', '6501', 500),                                                             // fim específico de exportação
  ex('e5', '5102', 300, { modelo: '65', dest_doc: 'P999', dest_tipo: 'EX', dest_uf: 'RS' }), // turista no balcão: venda interna
  { ...ex('e6', null, 200, { dest_doc: 'NIF77', dest_tipo: 'EX', dest_uf: 'EX' }), modelo: 'nfse' } // serviço a tomador no exterior
];
const itEx = [
  { documento_id: 'e1', ncm: '64039990', descricao: 'CALCADO', cfop: '5101', valor_total: 4000 },
  { documento_id: 'e2', ncm: '64039990', descricao: 'CALCADO EXPORT', cfop: '7101', valor_total: 2000 },
  { documento_id: 'e2', ncm: '64039990', descricao: 'CALCADO EXPORT 2', cfop: '7101', valor_total: 1000 },
  { documento_id: 'e3', ncm: '64039990', descricao: 'CALCADO ZFM', cfop: '6109', valor_total: 2000 },
  { documento_id: 'e4', ncm: '64039990', descricao: 'CALCADO TRADING', cfop: '6501', valor_total: 500 },
  { documento_id: 'e5', ncm: '64039990', descricao: 'CALCADO TURISTA', cfop: '5102', valor_total: 300 },
  { documento_id: 'e6', ncm: null, descricao: 'CONSULTORIA', cfop: null, valor_total: 200 }
];
const mEx = agregar(docsEx, itEx, new Map(), { ano: 2026, mesIni: 7, mesFim: 7 });
const esp = Object.fromEntries(mEx.ponte.vendasEspeciais.map(e => [e.tipo, e]));
perto(esp.exterior && esp.exterior.valor, 3000, 0.005, 'exportação (CFOP 7.101): R$ 3.000');
perto(esp.exterior && esp.exterior.pct, 30, 0.001, 'exportação: 30% das vendas (base do mix: itens vendidos)');
ok(esp.exterior && esp.exterior.notas === 1 && esp.exterior.cfops.join() === '7101', 'exportação: 1 nota, CFOP 7101');
perto(esp.zfm && esp.zfm.valor, 2000, 0.005, 'Zona Franca (CFOP 6.109): R$ 2.000');
perto(esp.fimExportacao && esp.fimExportacao.valor, 500, 0.005, 'fim específico de exportação (CFOP 6.501): R$ 500');
perto(esp.servicoExterior && esp.servicoExterior.valor, 200, 0.005, 'NFS-e com tomador no exterior: R$ 200');
ok(!Object.values(esp).some(e => e.cfops.includes('5102')), 'turista estrangeiro no balcão (CFOP 5.102) é venda interna: fora dos avisos');
ok(mEx.ponte.vendasEspeciais[0].tipo === 'exterior', 'do maior pro menor');
const av = avisosVendasEspeciais(mEx.ponte.vendasEspeciais).map(a => a.replace(/ /g, ' '));
ok(av.length === 4, 'quatro avisos, um por tipo');
ok(/^Venda ao exterior \(CFOP 7\.101\): R\$ 3\.000,00 em 1 nota, 30% das vendas\. É imune e mantém o crédito \(LC 214, art\. 79\)/.test(av[0]), 'aviso da exportação: ' + av[0].slice(0, 110));
ok(av.some(a => /^Venda para a Zona Franca de Manaus ou Área de Livre Comércio \(CFOP 6\.109\): R\$ 2\.000,00 em 1 nota, 20% das vendas.*arts\. 445 e 463/.test(a)), 'aviso da Zona Franca, com os arts. 445 e 463');
ok(av.some(a => /fim específico de exportação \(CFOP 6\.501\).*art\. 82/.test(a)), 'aviso da venda a comercial exportadora (art. 82)');
ok(av.some(a => /^Serviço para tomador no exterior \(NFS-e\): R\$ 200,00 em 1 nota, 2% das vendas.*arts\. 79 e 80/.test(a)), 'aviso do serviço ao exterior (arts. 79 e 80)');
ok(avisosVendasEspeciais(m9619.ponte.vendasEspeciais).length === 0 && m9619.ponte.vendasEspeciais.length === 0, 'sem exportação nem Zona Franca, nenhum aviso');

// Imposto embutido nas compras (14/10/2026, Imersão da Reforma): o fornecedor do regime normal destaca o IBS/CBS sobre o valor
// sem o ICMS (LC 214, art. 12, §2º, V); o ICMS-ST e o IPI vêm por cima. A ponte mede ICMS + ICMS-ST + IPI ÷ valor das notas
// de compra de fornecedor do regime normal (CRT 3) — sem a NFS-e tomada e sem o fornecedor do Simples
console.log('\nImposto embutido nas compras (ICMS, ICMS-ST e IPI das notas de fornecedor do regime normal):');
const ent = (id, data, valor, extra = {}) => ({ id, modelo: '55', data_emissao: data, tipo: 'entrada', finalidade: 1, emit_doc: '44444444000144',
  emit_nome: 'FORNECEDOR TESTE', emit_uf: 'RS', emit_crt: 3, dest_doc: '11111111000111', dest_tipo: 'PJ', dest_nome: 'EMPRESA TESTE', dest_uf: 'RS',
  valor_total: valor, cfop_principal: '5102', icms: 0, icms_st: 0, ipi: 0, ...extra });
const docsEmb = [
  nf('55555555000155', 'CLIENTE', 20000, '5102', { data_emissao: '2026-06-10' }),
  ent('c1', '2026-06-05', 10000, { icms: 1530 }),                          // ICMS próprio de 17% sobre 9.000 de produto + 1.000 de IPI
  ent('c2', '2026-07-05', 5000, { icms: 600, icms_st: 400, ipi: 0 }),      // com substituição tributária
  ent('c3', '2026-07-06', 3000, { emit_crt: 1, icms: 0 }),                  // fornecedor do Simples: fora da medida
  { ...ent('c4', '2026-07-07', 2000), modelo: 'nfse', cfop_principal: null }, // serviço tomado: fora da medida
  ent('c5', '2026-07-08', 1000, { finalidade: 4, icms: 170 }),             // devolução: fora
  ent('c6', '2026-07-09', 800, { cfop_principal: '5915', icms: 136 })      // remessa pra conserto: não é compra
];
docsEmb[1].ipi = 1000;
const mEmb = agregar(docsEmb, [], new Map(), { ano: 2026, mesIni: 6, mesFim: 7 });
perto(mEmb.ponte.pctImpostoEmbutido, (1530 + 1000 + 600 + 400) / 15000 * 100, 0.001, 'ICMS + ICMS-ST + IPI ÷ valor das 2 notas de fornecedor do regime normal');
ok(mEmb.ponte.nComprasEmbutido === 2 && mEmb.ponte.mesesEmbutido.join() === '2026-06,2026-07', 'conta as 2 notas e os meses delas (jun e jul)');
perto(mEmb.ponte.coberturaEmbutido, 15000 / (15000 + 2000) * 100, 0.001, 'cobertura: as 2 notas são 88% das compras com nota (o resto é o serviço tomado; o fornecedor do Simples fica fora da conta)');
const mSoSimples = agregar([docsEmb[0], docsEmb[3], docsEmb[4]], [], new Map(), { ano: 2026, mesIni: 6, mesFim: 7 });
ok(mSoSimples.ponte.pctImpostoEmbutido === null && mSoSimples.ponte.nComprasEmbutido === 0, 'sem nota de fornecedor do regime normal: não mede (null) — a ficha não mexe no campo');
const mTexto = agregar([docsEmb[0], ent('c7', '2026-06-08', 2000, { icms: '340.00', ipi: null })], [], new Map(), { ano: 2026, mesIni: 6, mesFim: 7 });
perto(mTexto.ponte.pctImpostoEmbutido, 17, 0.001, 'valor do banco em texto ou nulo não quebra a conta');


console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
