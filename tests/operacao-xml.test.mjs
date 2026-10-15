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

// TABELA DE NCM CONFERIDA NOS ANEXOS DA LC 214 (15/10/2026): a cópia de rt_ncm_regras depois da checagem no texto oficial
// (o teste não lê o banco — mudou a tabela, muda aqui). A lei usa subposição de 5 dígitos (0407.2, 0709.5, 1902.1, 2101.1,
// 9021.3) e de 7 (0210.99.1); vence sempre o prefixo mais longo, e a regra mais específica registra a exceção, inclusive
// com a alíquota cheia (o foie gras dentro das aves, as nozes dentro das frutas, o 9021.39.91 dentro das próteses)
console.log('\nTabela de NCM conferida nos anexos da LC 214 (prefixo de 2 a 8 dígitos, vence o mais longo):');
const TABELA_15_10 = new Map([
  ['0101', 'reducao_60'], ['0102', 'reducao_60'], ['0103', 'reducao_60'], ['0104', 'reducao_60'], ['0105', 'reducao_60'], ['0201', 'zero'],
  ['0202', 'zero'], ['0203', 'zero'], ['0204', 'zero'], ['0206', 'zero'], ['0207', 'zero'], ['02074300', 'cheia'],
  ['02075300', 'cheia'], ['020910', 'zero'], ['02099000', 'zero'], ['02101', 'zero'], ['02102000', 'zero'], ['0210991', 'zero'],
  ['02109920', 'zero'], ['0302', 'zero'], ['03021', 'reducao_60'], ['03023', 'reducao_60'], ['03025100', 'reducao_60'], ['03025200', 'reducao_60'],
  ['03025300', 'reducao_60'], ['03029', 'reducao_60'], ['0303', 'zero'], ['03031', 'reducao_60'], ['03034', 'reducao_60'], ['03036300', 'reducao_60'],
  ['03036400', 'reducao_60'], ['03036500', 'reducao_60'], ['03039', 'reducao_60'], ['0304', 'zero'], ['03061', 'reducao_60'], ['030611', 'cheia'],
  ['03061500', 'cheia'], ['03063', 'reducao_60'], ['03063100', 'cheia'], ['03063400', 'cheia'], ['03063910', 'cheia'], ['03073100', 'reducao_60'],
  ['03073200', 'reducao_60'], ['03074200', 'reducao_60'], ['030743', 'reducao_60'], ['03075100', 'reducao_60'], ['03075200', 'reducao_60'], ['03079100', 'reducao_60'],
  ['03079200', 'reducao_60'], ['04011010', 'zero'], ['04011090', 'zero'], ['04012010', 'zero'], ['04012090', 'zero'], ['04014010', 'zero'],
  ['04015010', 'zero'], ['04021010', 'zero'], ['04021090', 'zero'], ['04022110', 'zero'], ['04022120', 'zero'], ['04022910', 'zero'],
  ['04022920', 'zero'], ['0403', 'reducao_60'], ['040510', 'zero'], ['04061010', 'zero'], ['04061090', 'zero'], ['04062000', 'zero'],
  ['04069010', 'zero'], ['04069020', 'zero'], ['04069030', 'zero'], ['04071', 'reducao_60'], ['04072', 'zero'], ['0409', 'reducao_60'],
  ['06', 'zero'], ['07', 'zero'], ['07095', 'reducao_60'], ['0711', 'cheia'], ['0712', 'reducao_60'], ['0713', 'reducao_60'],
  ['07133319', 'zero'], ['07133329', 'zero'], ['07133399', 'zero'], ['07133590', 'zero'], ['08', 'reducao_60'], ['08011', 'zero'],
  ['0802', 'cheia'], ['0803', 'zero'], ['0804', 'zero'], ['0805', 'zero'], ['0806', 'zero'], ['080620', 'reducao_60'],
  ['0807', 'zero'], ['0808', 'zero'], ['0809', 'zero'], ['0810', 'zero'], ['0811', 'zero'], ['0812', 'cheia'],
  ['0814', 'cheia'], ['0901', 'zero'], ['0903', 'zero'], ['10', 'reducao_60'], ['1001', 'reducao_60'], ['100590', 'reducao_60'],
  ['1006', 'reducao_60'], ['100620', 'zero'], ['100630', 'zero'], ['10064000', 'zero'], ['1101', 'reducao_60'], ['11010010', 'zero'],
  ['1102', 'reducao_60'], ['110220', 'zero'], ['1103', 'reducao_60'], ['11031300', 'zero'], ['110320', 'cheia'], ['1104', 'reducao_60'],
  ['110412', 'zero'], ['11041900', 'zero'], ['11042200', 'zero'], ['11042300', 'zero'], ['110430', 'cheia'], ['1105', 'reducao_60'],
  ['1106', 'reducao_60'], ['110620', 'zero'], ['110812', 'reducao_60'], ['1201', 'reducao_60'], ['1202', 'reducao_60'], ['1203', 'reducao_60'],
  ['1204', 'reducao_60'], ['1205', 'reducao_60'], ['1206', 'reducao_60'], ['1207', 'reducao_60'], ['1208', 'reducao_60'], ['150790', 'reducao_60'],
  ['1508', 'reducao_60'], ['1511', 'reducao_60'], ['1512', 'reducao_60'], ['1513', 'reducao_60'], ['15132120', 'zero'], ['1514', 'reducao_60'],
  ['1515', 'reducao_60'], ['151710', 'zero'], ['17011400', 'zero'], ['17019900', 'zero'], ['190110', 'zero'], ['19012010', 'cheia'],
  ['19012090', 'cheia'], ['190211', 'zero'], ['190219', 'zero'], ['190220', 'reducao_60'], ['190230', 'reducao_60'], ['19030000', 'zero'],
  ['19059010', 'reducao_60'], ['19059090', 'cheia'], ['2002', 'reducao_60'], ['2009', 'reducao_60'], ['21011', 'zero'], ['230990', 'reducao_60'],
  ['25010020', 'zero'], ['25010090', 'zero'], ['300242', 'reducao_60'], ['3003', 'reducao_60'], ['3004', 'reducao_60'], ['30069110', 'reducao_60'],
  ['31', 'reducao_60'], ['330610', 'reducao_60'], ['34011190', 'reducao_60'], ['34011900', 'reducao_60'], ['3808', 'reducao_60'], ['38089419', 'reducao_60'],
  ['40151', 'reducao_60'], ['481810', 'reducao_60'], ['87131000', 'zero'], ['87139000', 'zero'], ['87142000', 'zero'], ['9018', 'reducao_60'],
  ['90181100', 'zero'], ['901812', 'zero'], ['90181300', 'zero'], ['90181980', 'zero'], ['901820', 'zero'], ['90192040', 'zero'],
  ['9021', 'cheia'], ['902110', 'zero'], ['90212900', 'reducao_60'], ['90213', 'zero'], ['90213991', 'cheia'], ['90213999', 'cheia'],
  ['90214000', 'zero'], ['90215000', 'reducao_60'], ['902190', 'reducao_60'], ['90219092', 'zero'], ['9025', 'zero'], ['960321', 'reducao_60'],
  ['9619', 'reducao_60']
].map(([p, r]) => [p, { regime: r, descricao: 'regra ' + p }]));
ok(TABELA_15_10.size === 193, 'a cópia tem as 193 regras ativas da tabela nova');
const reg = (ncm, desc) => regimeDoNcm(ncm, TABELA_15_10, desc).regime;
const caso = (ncm, desc, esperado, msg) => { const r = reg(ncm, desc); ok(r === esperado, msg + ' (' + ncm + (desc ? ' «' + desc + '»' : '') + ' → ' + r + ')'); };

// os casos da lei
caso('1005.90.10', null, 'reducao_60', 'milho em grão: redução de 60% (Anexo VII, item 15), não é cesta básica');
caso('1104.19.00', null, 'zero', 'o milho do Anexo I é o grão trabalhado (item 12)');
caso('1507.90.11', null, 'reducao_60', 'óleo de soja refinado: redução de 60% (Anexo VII, item 8)');
caso('1507.10.00', null, 'cheia', 'óleo de soja em bruto: alíquota cheia (fora do item 8)');
caso('1509.20.00', null, 'cheia', 'azeite (15.09): alíquota cheia, fora do Anexo VII');
caso('1513.21.20', null, 'zero', 'óleo de babaçu: o único óleo com alíquota zero (Anexo I, item 9)');
caso('0811.90.00', null, 'zero', 'fruta congelada sem açúcar (08.11): alíquota zero (Anexo XV, item 3)');
caso('9021.10.10', null, 'zero', 'artigo ortopédico (9021.10): alíquota zero (Anexo XII)');
caso('9021.10.20', null, 'zero', 'artigo para fratura (9021.10): alíquota zero (Anexo XII)');
caso('9021.31.10', null, 'zero', 'prótese articular (9021.3, prefixo de 5 dígitos): alíquota zero (Anexo XII, item 5)');
caso('9021.39.30', null, 'zero', 'outra prótese do 9021.39: alíquota zero');
caso('9021.39.91', null, 'cheia', 'exceção do item 5 (9021.39.91): alíquota cheia');
caso('9021.39.99', null, 'cheia', 'exceção do item 5 (9021.39.99): alíquota cheia');
caso('9021.21.10', null, 'cheia', 'dente artificial (9021.21): alíquota cheia, fora dos anexos');
caso('9021.29.00', null, 'reducao_60', '9021.29.00: redução de 60% (Anexo IV)');
caso('9021.40.00', null, 'zero', 'aparelho de audição (9021.40.00): alíquota zero (Anexo XIII, item 4)');
caso('9021.90.92', null, 'zero', 'parte de aparelho de audição (9021.90.92): alíquota zero (Anexo XIII, item 5)');
caso('9021.50.00', null, 'reducao_60', 'marcapasso (9021.50.00): redução de 60% (Anexo IV)');
caso('9021.90.12', null, 'reducao_60', 'stent (9021.90): redução de 60% (Anexo IV)');
caso('0709.51.00', null, 'reducao_60', 'cogumelo fresco (0709.5): redução de 60%, o Anexo XV exclui cogumelos e trufas');
caso('0709.60.00', null, 'zero', 'pimentão (07.09, fora do 0709.5): alíquota zero (Anexo XV, item 2)');
caso('0712.39.00', null, 'reducao_60', 'cogumelo seco (07.12): redução de 60%');
caso('0602.90.90', null, 'zero', 'planta e muda (06.02): alíquota zero (Anexo XV, item 4)');
caso('0603.11.00', null, 'zero', 'flor cortada (06.03): alíquota zero (Anexo XV, item 4)');
caso('1905.90.90', 'PAO FRANCES KG', 'zero', 'pão francês (1905.90.90, pela descrição): alíquota zero (Anexo I, item 16)');
caso('19059090', 'Pão Francês 50g', 'zero', 'pão francês com acento');
caso('19059090', 'CACETINHO', 'zero', 'cacetinho é o pão francês');
caso('1905.90.10', 'PAO DE FORMA TRADICIONAL 500G', 'reducao_60', 'pão de forma (1905.90.10): redução de 60% (Anexo VII, item 12)');
caso('19059090', 'BOLO DE CHOCOLATE', 'cheia', 'bolo do código do pão francês: alíquota cheia');
caso('19059090', 'DORITOS NACHO 183G', 'cheia', 'salgadinho do 1905.90.90: alíquota cheia');
caso('19059090', 'TORRADA DE PAO FRANCES', 'cheia', 'torrada não é o pão francês');
caso('19059090', null, 'cheia', 'sem descrição, o 1905.90.90 segue a tabela');
caso('19012090', 'PRE MISTURA PAO FRANCES 5KG', 'zero', 'pré-mistura do pão francês (1901.20.90): alíquota zero');
caso('19012090', 'MISTURA PARA BOLO CHOCOLATE', 'cheia', 'mistura para bolo: alíquota cheia');
caso('1902.11.00', null, 'zero', 'massa sem recheio, com ovos (1902.11): alíquota zero (Anexo I, item 15)');
caso('1902.19.00', null, 'zero', 'outra massa sem recheio (1902.19): alíquota zero');
caso('1902.20.00', null, 'reducao_60', 'massa recheada (1902.20): redução de 60% (Anexo VII, item 9)');
caso('9019.20.40', null, 'zero', 'respirador (9019.20.40): alíquota zero (Anexo XII, item 13)');
caso('9019.10.00', null, 'cheia', 'outro aparelho da 90.19: alíquota cheia');
caso('1108.14.00', null, 'cheia', 'fécula de mandioca (1108.14): alíquota cheia, nenhum anexo');
caso('1108.12.00', null, 'reducao_60', 'amido de milho (1108.12.00): redução de 60% (Anexo VII, item 7)');
caso('2106.90.90', 'PIZZA GRANDE', 'cheia', 'pizza (2106.90.90): alíquota cheia');
caso('1102.90.00', 'FARINHA DE AVEIA 500G', 'zero', 'farinha de aveia (1102.90.00, pela descrição): alíquota zero (Anexo I, item 18)');
caso('1102.90.00', 'FARINHA DE ARROZ', 'reducao_60', 'farinha de arroz do mesmo código: redução de 60% (Anexo VII, item 4)');

// as exceções e os prefixos de 5 e 7 dígitos
caso('0407.21.00', null, 'zero', 'ovo de galinha (0407.2): alíquota zero (Anexo XV, item 1)');
caso('0407.11.00', null, 'reducao_60', 'ovo fertilizado (0407.1): redução de 60% (Anexo IX, item 16)');
caso('0407.90.00', null, 'cheia', 'outros ovos (0407.90): alíquota cheia');
caso('0210.99.11', null, 'zero', 'carne de ave salgada (0210.99.1, prefixo de 7 dígitos): alíquota zero');
caso('0210.12.00', null, 'zero', 'bacon (0210.1): alíquota zero');
caso('0210.20.00', null, 'zero', 'charque (0210.20.00): alíquota zero');
caso('0207.43.00', null, 'cheia', 'foie gras (0207.43.00): a exceção vence a regra das aves');
caso('0207.14.00', null, 'zero', 'pedaço de frango (02.07): alíquota zero');
caso('0802.32.00', null, 'cheia', 'nozes (08.02): alíquota cheia dentro do capítulo 8');
caso('0801.22.00', null, 'reducao_60', 'castanha-do-pará (0801.2): redução de 60%');
caso('0801.11.00', null, 'zero', 'coco (0801.1): alíquota zero');
caso('0806.20.00', null, 'reducao_60', 'uva-passa (0806.20): redução de 60%');
caso('0806.10.00', null, 'zero', 'uva fresca (08.06): alíquota zero');
caso('0713.33.19', null, 'zero', 'feijão do Anexo I (0713.33.19): alíquota zero');
caso('0713.40.90', null, 'reducao_60', 'lentilha (07.13): redução de 60%');
caso('2101.11.10', null, 'zero', 'café solúvel (2101.1): alíquota zero');
caso('1903.00.00', null, 'zero', 'tapioca (1903.00.00): alíquota zero');
caso('3401.19.00', null, 'reducao_60', 'sabão em barra (3401.19.00): redução de 60%');
caso('3401.11.90', null, 'reducao_60', 'sabonete (3401.11.90): redução de 60%');
caso('3401.11.10', null, 'cheia', 'outro código do 3401.11: alíquota cheia');
caso('0306.17.10', null, 'reducao_60', 'camarão congelado (0306.1): redução de 60%');
caso('0306.11.00', null, 'cheia', 'lagosta congelada (0306.11): alíquota cheia');
caso('0307.43.10', null, 'reducao_60', 'lula congelada (0307.43): redução de 60%');
caso('0302.14.00', null, 'reducao_60', 'salmão fresco (0302.1): fora da alíquota zero');
caso('0302.89.90', null, 'zero', 'outro peixe fresco (03.02): alíquota zero');
caso('9025.11.10', null, 'zero', 'termômetro (90.25): alíquota zero (Anexo XII, item 12)');
caso('0402.99.00', null, 'cheia', 'leite condensado (0402.99): alíquota cheia');
caso('0402.21.10', null, 'zero', 'leite em pó integral (0402.21.10): alíquota zero');
caso('0401.50.21', null, 'cheia', 'creme de leite (0401.50, fora do 0401.50.10): alíquota cheia');
caso('0406.40.00', null, 'cheia', 'gorgonzola (0406.40): alíquota cheia');
caso('0406.10.10', null, 'zero', 'mozarela (0406.10.10): alíquota zero');
caso('2309.10.00', null, 'cheia', 'ração de cão e gato (2309.10): alíquota cheia');
caso('2309.90.10', null, 'reducao_60', 'ração de criação (2309.90): redução de 60%');
caso('1006.10.92', null, 'reducao_60', 'arroz com casca (1006.10): redução de 60%');
caso('1006.30.21', null, 'zero', 'arroz branco (1006.30): alíquota zero');
caso('1701.14.00', null, 'zero', 'açúcar (1701.14.00): alíquota zero');
caso('1701.13.00', null, 'cheia', 'outro açúcar da 17.01: alíquota cheia');
caso('8713.90.00', null, 'zero', 'cadeira de rodas (8713.90.00): alíquota zero (Anexo XIII)');
caso('96190000', 'ABSORVENTE NOTURNO C/ABAS 8UN', 'zero', 'com a tabela nova, o absorvente continua com alíquota zero (art. 147)');
caso('96190000', 'FRALDA INFANTIL G 30UN', 'reducao_60', 'e a fralda, com a redução de 60%');
ok(regimeDoNcm('0802.32.00', TABELA_15_10).descricao === 'regra 0802', 'a regra que vence é a mais específica (0802, não 08)');

// o que não muda: com prefixos de 2, 4, 6 e 8 dígitos (a tabela até 15/10/2026), a busca nova dá o mesmo que a antiga
const buscaAntiga = (ncm, regras) => {
  const d = String(ncm || '').replace(/\D/g, '');
  for (const len of [8, 6, 4, 2]) { if (d.length < len) continue; const r = regras.get(d.slice(0, len)); if (r) return r; }
  return { regime: 'cheia', descricao: null };
};
const TAB_ANTES = new Map([['07', 'zero'], ['0713', 'zero'], ['08', 'zero'], ['0811', 'reducao_60'], ['190590', 'zero'], ['1507', 'zero'],
  ['1509', 'reducao_60'], ['9021', 'reducao_60'], ['33049990', 'reducao_60']].map(([p, r]) => [p, { regime: r, descricao: 'antes ' + p }]));
const amostra = ['07020000', '07133319', '0713', '08119000', '08045020', '19059090', '19059010', '15079011', '15092000', '90211010',
  '33049990', '33049910', '1234', '0', ''];
ok(amostra.every(n => { const a = regimeDoNcm(n, TAB_ANTES), b = buscaAntiga(n, TAB_ANTES); return a.regime === b.regime && a.descricao === b.descricao; }),
  'com prefixos de 2, 4, 6 e 8 dígitos, a busca nova acha a mesma regra que a de antes');

// o mix das vendas de um minimercado, com a tabela de antes e a nova
const docMerc = { id: 'm1', modelo: '65', data_emissao: '2026-07-15', tipo: 'saida', finalidade: 1, emit_doc: '11111111000111', emit_nome: 'MERCADO TESTE',
  emit_uf: 'RS', emit_crt: 1, dest_doc: null, dest_tipo: 'PF', dest_nome: null, dest_uf: null, valor_total: 1000, cfop_principal: '5102' };
const itensMerc = [
  { documento_id: 'm1', ncm: '19059090', descricao: 'PAO FRANCES KG', cfop: '5102', valor_total: 300 },
  { documento_id: 'm1', ncm: '19059090', descricao: 'BOLO DE CENOURA', cfop: '5102', valor_total: 100 },
  { documento_id: 'm1', ncm: '15079011', descricao: 'OLEO DE SOJA 900ML', cfop: '5102', valor_total: 200 },
  { documento_id: 'm1', ncm: '15092000', descricao: 'AZEITE EXTRA VIRGEM 500ML', cfop: '5102', valor_total: 100 },
  { documento_id: 'm1', ncm: '07133319', descricao: 'FEIJAO PRETO 1KG', cfop: '5102', valor_total: 200 },
  { documento_id: 'm1', ncm: '07095100', descricao: 'COGUMELO PARIS BANDEJA', cfop: '5102', valor_total: 100 }
];
const mAntes = agregar([docMerc], itensMerc, TAB_ANTES, { ano: 2026, mesIni: 7, mesFim: 7 });
const mNova = agregar([docMerc], itensMerc, TABELA_15_10, { ano: 2026, mesIni: 7, mesFim: 7 });
perto(mAntes.ponte.mixZero, 90, 0.001, 'tabela de antes: 90% a zero (bolo, óleo de soja e cogumelo entravam como zero)');
perto(mAntes.ponte.mixRed60, 10, 0.001, 'tabela de antes: o azeite com redução de 60%');
perto(mNova.ponte.mixZero, 50, 0.001, 'tabela nova: zero só o pão francês e o feijão');
perto(mNova.ponte.mixRed60, 30, 0.001, 'tabela nova: óleo de soja e cogumelo com redução de 60%');
perto(mNova.ponte.mixCheia, 20, 0.001, 'tabela nova: bolo e azeite na alíquota cheia');


console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
