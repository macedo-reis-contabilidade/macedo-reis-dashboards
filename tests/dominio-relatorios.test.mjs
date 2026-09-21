// Teste do leitor de relatórios da Domínio.
// Rodar com: node tests/dominio-relatorios.test.mjs
//
// As fixtures são SINTÉTICAS e reproduzem o layout do PDF depois de passar
// pelo extrator de texto (uma string por linha, colunas separadas por 2+
// espaços). Empresa, fornecedores e documentos são inventados — este
// repositório é público e não recebe dado de cliente.
//
// O caso de referência foi calibrado contra três relatórios reais lidos
// lado a lado com o papel (faturamento, 8 apurações do Simples e um
// acompanhamento de entradas de 686 lançamentos): totais fechando ao
// centavo e alíquota efetiva batendo com a do PGDAS na quarta casa.

import { lerRelatorio, detectarTipo, grupoDoCfop, resumirEntradas, consolidar, numBR, classificarCliente, resumirVendas, lerPlanilha, detectarTipoPlanilha } from '../assets/js/dominio-relatorios.js';
import { aliqEfetiva } from '../assets/js/rt-motor.js';

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.error('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const perto = (a, b, tol, msg) => ok(a != null && Math.abs(a - b) <= tol, msg + ' (esperado ' + b + ', obtido ' + a + ')');

// ---------- fixtures ----------
const FATURAMENTO = [[
  'RELATÓRIO DE FATURAMENTO  Emissão:  10/09/2026',
  'Empresa:  EMPRESA TESTE INDUSTRIA LTDA',
  'Endereço:  RUA UM, 100',
  'Cidade:  TRES COROAS  CEP.:  95660-000',
  'CNPJ:  11.222.333/0001-44',
  'Insc.Est.:  1234567890',
  'Período:  01/01/2026  a  31/03/2026',
  'M Ê S  ANO  Saídas R$  Servicos R$  Outros R$  Total R$',
  'Janeiro  2026  10.000,00  90.000,00  0,00  100.000,00',
  'Fevereiro  2026  20.000,00  80.000,00  0,00  100.000,00',
  'Março  2026  30.000,00  70.000,00  0,00  100.000,00',
  'Totais  60.000,00  240.000,00  0,00  300.000,00'
]];

const SIMPLES = [[
  'Empresa:  EMPRESA TESTE INDUSTRIA LTDA  Página:  0001',
  'CNPJ:  11.222.333/0001-44  Emissão:  10/09/2026',
  'Início das atividades:  09/06/2003',
  'Período:  03/2026',
  'SIMPLES NACIONAL',
  'Total de Receitas Brutas (R$)  Mercado Interno  Mercado Externo  Total',
  'Receita Bruta do período de Apuração (RPA) -',
  'Regime de Competência  100.000,00  0,00  100.000,00',
  'Receita bruta acumulada nos doze meses anteriores',
  'ao período de apuração (RBT12)  1.200.000,00  0,00  1.200.000,00',
  'Faixa de Enquadramento:  720.000,01 a 1.800.000,00  0,00 a 180.000,00',
  'Receita bruta acumulada no ano-calendário',
  'corrente (RBA)  300.000,00  0,00  300.000,00',
  'Estabelecimento:  1  EMPRESA TESTE INDUSTRIA LTDA  CNPJ:  11.222.333/0001-44',
  'Anexo:  Anexo I - Comércio',
  'Seção:  Seção I - Receitas decorrentes da revenda de mercadorias',
  'Tabela:  Tabela 1 - Sem substituição tributária',
  'Receita Tributada Total:  30.000,00 Alíquota:  9,0000000000000  Simples Nacional Total:  2.700,00',
  'Partilha:  IRPJ  CSLL  COFINS  PIS  INSS/CPP  ICMS',
  'Situação:  Tributado  Tributado  Tributado  Tributado  Tributado  Tributado',
  'Base de Cálculo:  30.000,00  30.000,00  30.000,00  30.000,00  30.000,00  30.000,00',
  'Alíquota:  0,500000000  0,300000000  1,200000000  0,260000000  4,000000000  2,740000000',
  'Valor:  150,00  90,00  360,00  78,00  1.200,00  822,00',
  'Anexo:  Anexo III - Locação de Bens Móveis e Prestação de Serviços',
  'Seção:  Seção III - Receitas Decorrentes de Locação de Bens Móveis',
  'Tabela:  Tabela 2 - Não sujeitos ao fator "r"',
  'Receita Tributada Total:  70.000,00 Alíquota:  13,0000000000000  Simples Nacional Total:  9.100,00',
  'Partilha:  IRPJ  CSLL  COFINS  PIS  INSS/CPP  ISS',
  'Situação:  Tributado  Tributado  Tributado  Tributado  Tributado  Tributado',
  'Base de Cálculo:  70.000,00  70.000,00  70.000,00  70.000,00  70.000,00  70.000,00',
  'Alíquota:  0,550000000  0,480000000  1,880000000  0,410000000  5,980000000  3,700000000',
  'Valor:  385,00  336,00  1.316,00  287,00  4.186,00  2.590,00',
  'Simples Nacional a recolher:  11.800,00'
], [
  'Período:  03/2026',
  'SIMPLES NACIONAL - ANEXO',
  'Receita Bruta Acumulada:',
  'Período Receita Bruta, Exceto Exportação de Mercadorias Receita Bruta Exportação de Mercadorias',
  '03/2025  100.000,00  0,00',
  '04/2025  100.000,00  0,00',
  'Total:  1.200.000,00  0,00'
]];

// linhas do acompanhamento como o extrator entrega: nome e CNPJ colados,
// CFOP no formato "1-102", depois AC, UF e o valor contábil
const L = (cod, data, nota, forn, doc, ie, cfop, ac, uf, val) =>
  `${cod}  ${data}  ${data}  ${nota}  1  36  99  ${forn}${doc}  ${ie}  ${cfop}  ${ac} ${uf}  ${val} ICMS  0,00  0,00  0,00  0,00  0,00  0,00  ${val}`;
const ENTRADAS = [[
  '1 - EMPRESA TESTE INDUSTRIA LTDA  Página:  0001',
  'CNPJ:  11.222.333/0001-44  Emissão:  10/09/2026',
  'Insc Est.:  1234567890  Hora:  16:32',
  'Período:  01/01/2026 até 31/03/2026',
  'ACOMPANHAMENTO DE ENTRADAS',
  'Código  Data Emissão  Data Entrada  Nota  Série  Espécie  Código  Fornecedor  CNPJ/CPF/CEI/CAEPF  Insc. Est.  CFOP  AC. UF  Valor Contábil  Tipo',
  L('10001', '05/01/2026', '111', 'FORNECEDOR PECAS LTDA', '22.333.444/0001-55', '0860000001', '1-102', '67', 'RS', '10.000,00'),
  L('10002', '06/01/2026', '112', 'FORNECEDOR PECAS LTDA', '22.333.444/0001-55', '0860000001', '1-403', '67', 'RS', '2.000,00'),
  // o extrator às vezes cola o "1" da coluna de controle no código do lançamento
  '1' + L('10003', '10/02/2026', '113', 'TRANSPORTADORA X LTDA', '33.444.555/0001-66', '0860000002', '1-353', '56', 'RS', '1.000,00'),
  L('10004', '11/02/2026', '114', 'POSTO COMBUSTIVEL LTDA', '44.555.666/0001-77', '0860000003', '1-949', '67', 'RS', '500,00'),
  L('10005', '12/03/2026', '115', 'CLIENTE INDUSTRIA SA', '55.666.777/0001-88', '0860000004', '1-915', '33', 'RS', '80.000,00'),
  L('10006', '13/03/2026', '116', 'CLIENTE INDUSTRIA SA', '55.666.777/0001-88', '0860000004', '2-916', '34', 'SC', '20.000,00'),
  L('10007', '14/03/2026', '117', 'COMPRADOR QUE DEVOLVEU LTDA', '66.777.888/0001-99', '0860000005', '1-202', '67', 'RS', '3.000,00'),
  'Total Fornecedor',
  '3.000,00 ICMS  0,00  0,00  0,00  0,00  0,00  3.000,00',
  '1Total Geral',
  '116.500,00 ICMS  0,00  0,00  0,00  0,00  0,00  116.500,00'
]];

// ---------- 1) identificação e leitura ----------
console.log('Identificação:');
ok(detectarTipo(FATURAMENTO) === 'faturamento', 'reconhece o relatório de faturamento');
ok(detectarTipo(SIMPLES) === 'simples', 'reconhece a apuração do Simples');
ok(detectarTipo(ENTRADAS) === 'entradas', 'reconhece o acompanhamento de entradas');
ok(detectarTipo([['QUALQUER OUTRO PAPEL']]) === null, 'não chuta tipo em papel desconhecido');

console.log('\nFaturamento:');
const fat = lerRelatorio(FATURAMENTO);
ok(fat.cnpj === '11222333000144', 'pega o CNPJ do cabeçalho');
ok(fat.meses.length === 3, 'lê os 3 meses');
ok(fat.meses[2].competencia === '2026-03', 'março vira 2026-03 (acento no nome do mês)');
perto(fat.totais.total, 300000, 0.005, 'total do período');
perto(fat.totais.servicos, 240000, 0.005, 'serviços separados das saídas');
ok(fat.conferido === true, 'soma dos meses fecha com a linha de Totais');

console.log('\nSimples Nacional:');
const sim = lerRelatorio(SIMPLES);
ok(sim.competencia === '2026-03', 'competência da apuração');
perto(sim.rpa, 100000, 0.005, 'receita do período');
perto(sim.rbt12, 1200000, 0.005, 'RBT12');
ok(sim.anexos.length === 2, 'lê os dois anexos');
ok(sim.anexoPredominante === 'III', 'anexo predominante é o de maior receita');
perto(sim.dasTotal, 11800, 0.005, 'DAS somando os anexos');
perto(sim.aliquotaEfetiva, 11.8, 0.005, 'alíquota efetiva = DAS ÷ receita tributada');
// CBS entra no lugar de PIS+COFINS: (360+78) + (1316+287) = 2041 de 11800
perto(sim.cbsNoDas, 2041, 0.005, 'parcela de PIS+COFINS no DAS');
perto(sim.partilhaCbsPct, 2041 / 11800 * 100, 0.005, 'partilha CBS em % do DAS');
// IBS entra no lugar de ICMS+ISS: 822 + 2590 = 3412
perto(sim.ibsNoDas, 3412, 0.005, 'parcela de ICMS+ISS no DAS');
ok(sim.historico.length === 2, 'lê o histórico de receita bruta acumulada');

console.log('\nEntradas:');
const ent = lerRelatorio(ENTRADAS);
ok(ent.lancamentos.length === 7, 'lê os 7 lançamentos (inclusive o com "1" colado no código)');
perto(ent.soma, 116500, 0.005, 'soma dos lançamentos');
perto(ent.totalGeral, 116500, 0.005, 'Total Geral (rótulo e valor em linhas separadas)');
ok(ent.conferido === true, 'soma fecha com o Total Geral');
const l3 = ent.lancamentos[2];
ok(l3.cfop === '1353' && l3.competencia === '2026-02', 'CFOP e competência do lançamento com código colado');
ok(l3.documento === '33444555000166', 'documento do fornecedor separado do nome');
ok(/TRANSPORTADORA X/.test(l3.fornecedor || ''), 'nome do fornecedor sem o documento colado: ' + l3.fornecedor);

console.log('\nClassificação de CFOP:');
ok(grupoDoCfop('1102') === 'mercadoria', '1102 é compra de mercadoria');
ok(grupoDoCfop('2403') === 'mercadoria', '2403 é compra para revenda com ST');
ok(grupoDoCfop('1353') === 'despesa', '1353 (frete) credita à alíquota cheia');
ok(grupoDoCfop('1949') === 'outras', '1949 fica no balaio, para conferência');
ok(grupoDoCfop('1915') === 'nao_operacional', '1915 (retorno de conserto) não é compra');
ok(grupoDoCfop('2916') === 'nao_operacional', '2916 (retorno de industrialização) não é compra');
ok(grupoDoCfop('1202') === 'devolucao', '1202 é devolução de venda');
ok(grupoDoCfop('xx') === 'indefinido', 'CFOP inválido não vira compra por engano');

const res = resumirEntradas(ent);
const g = k => res.find(x => x.grupo === k) || { valor: 0 };
perto(g('mercadoria').valor, 12000, 0.005, 'grupo mercadoria');
perto(g('despesa').valor, 1000, 0.005, 'grupo despesa');
perto(g('outras').valor, 500, 0.005, 'grupo x949');
perto(g('nao_operacional').valor, 100000, 0.005, 'remessas/retornos somados à parte');
perto(g('devolucao').valor, 3000, 0.005, 'devolução separada');

console.log('\nConsolidação para a ficha:');
const c = consolidar([fat, sim, ent]);
perto(c.campos.receita, 100000, 0.005, 'receita mensal = total ÷ meses com faturamento');
ok(c.campos.anexo === 'III', 'anexo predominante vai para a ficha');
perto(c.campos.rbt12, 1200000, 0.005, 'RBT12 vai para a ficha');
// a partilha vai para o motor medida sobre o DAS PELA TABELA do anexo (é sobre ele que a parcela
// CBS/IBS é aplicada); a proporção sobre o DAS apurado fica ao lado, para conferência
perto(c.campos.partilhaSobreDasApurado, 2041 / 11800 * 100, 0.005, 'partilha sobre o DAS apurado, calculada e não digitada');
perto(c.campos.partilha, 2041 / (100000 * aliqEfetiva('III', 1200000)) * 100, 0.005, 'partilha sobre o DAS pela tabela do anexo');
perto(c.campos.pctExcluidoST, Math.max(0, 1 - 11800 / (100000 * aliqEfetiva('III', 1200000))) * 100, 0.005, '% do DAS excluído = 1 − DAS apurado ÷ DAS pela tabela');
perto(c.campos.pctMerc, 12000 / 300000 * 100, 0.005, '% compras de mercadorias sobre a receita do período');
perto(c.campos.pctDesp, 1000 / 300000 * 100, 0.005, '% despesas sem o x949 (desligado por padrão)');
ok(c.avisos.some(a => /remessas e retornos/i.test(a)), 'avisa o que ficou fora por não ser compra');
ok(c.avisos.some(a => /mais de um anexo/i.test(a)), 'avisa receita em mais de um anexo');

const cOutras = consolidar([fat, sim, ent], { mercadoria: true, despesa: true, outras: true });
perto(cOutras.campos.pctDesp, 1500 / 300000 * 100, 0.005, 'marcar o x949 na prévia soma ele às despesas');

console.log('\nSem o relatório de entradas:');
const cSemEnt = consolidar([fat, sim]);
ok(cSemEnt.campos.pctMerc === undefined, 'não inventa % de compras sem o relatório');
ok(cSemEnt.avisos.some(a => /entradas/i.test(a)), 'cobra o relatório de entradas');

console.log('\nCNPJs diferentes no mesmo lote:');
const cMisto = consolidar([fat, { ...sim, cnpj: '99999999000199' }]);
ok(cMisto.avisos.some(a => /CNPJs diferentes/i.test(a)), 'acusa lote com mais de uma empresa');

console.log('\nAcompanhamento de saídas e de serviços (sintéticos, layout do pdf.js):');
// saídas: colunas Código  Data  Nota  Série  Espécie  Código  Cliente  CFOP  AC.  UF  Valor…; o "1" de controle às vezes cola na frente,
// e o CFOP às vezes cola no nome quando o nome é comprido
const SAIDAS = [[
  'EMPRESA TESTE COMERCIO LTDA  Página:  0001',
  'CNPJ:  11.222.333/0001-44  Emissão:  21/09/2026',
  'Insc Est.:  Hora:  15:11',
  'Período:  01/01/2026 até 28/02/2026',
  'ACOMPANHAMENTO DE SAÍDAS',
  'Código  Data  Nota  Série  Espécie  Código  Cliente  CFOP  AC.  UF  Valor Contábil  Tipo  Base Cálculo  Alíq.  Valor  Isentas  Outras',
  '14  23/01/2026  6  1  36  2745  MARIA DA SILVA  5-102  35  RS  250,00  ICMS  0,00  0,00  0,00  0,00  250,00',
  '1  19  09/01/2026  1  1  45  2747  AO CONSUMIDOR  5-102  35  RS  100,00  ICMS  0,00  0,00  0,00  0,00  100,00',
  '20  20/01/2026  2  1  36  2748  FABRICA DE CALCADOS TESTE LTDA5-102  35  RS  1.000,00  ICMS  0,00  0,00  0,00  0,00  1.000,00',
  '21  05/02/2026  3  1  36  2749  MUNICIPIO DE TESTE  5-102  35  RS  650,00  ICMS  0,00  0,00  0,00  0,00  650,00',
  'Total CFOP',
  '2.000,00  ICMS  0,00  0,00  0,00  2.000,00',
  '22  10/02/2026  4  1  36  2750  COML BEBIDAS TESTE LTDA  5-405  36  RS  3.000,00  ICMS  0,00  0,00  0,00  0,00  3.000,00',
  'Total CFOP',
  '3.000,00  ICMS  0,00  0,00  0,00  3.000,00',
  'Total Geral',
  '5.000,00  ICMS  0,00  0,00  0,00  5.000,00'
]];
const SERVICOS = [[
  'EMPRESA TESTE COMERCIO LTDA  Página:  0001',
  'CNPJ:  11.222.333/0001-44  Emissão:  21/09/2026',
  'Período:  01/01/2026 até 28/02/2026',
  'ACOMPANHAMENTO DE SERVIÇOS',
  'Código  Data  Nota  Série  Espécie  Código Cliente  AC. UF  Valor Contábil Tipo  Base Cálculo  Alíq.  Valor  Isentas  Outras',
  '1  23/02/2026  1  84  2655 ASSOCIACAO DE TESTE DE BENEFICENCIA55 RS  500,00  0,00  0,00  0,00  0,00  0,00',   // AC colado no nome, série vazia
  '1  2  25/02/2026  2  84  2770 JOAO DE TESTE  55 RS  500,00  0,00  0,00  0,00  0,00  0,00',
  'Total Acumulador',
  '1.000,00  0,00  0,00  0,00  0,00',
  'Total Geral',
  '1.000,00  0,00  0,00  0,00  0,00'
]];
ok(detectarTipo(SAIDAS) === 'saidas' && detectarTipo(SERVICOS) === 'servicos', 'reconhece os dois acompanhamentos');
const sai = lerRelatorio(SAIDAS), serv = lerRelatorio(SERVICOS);
ok(sai.empresa === 'EMPRESA TESTE COMERCIO LTDA' && sai.cnpj === '11222333000144', 'cabeçalho sem rótulo "Empresa:" ainda dá nome e CNPJ');
ok(sai.vendas.length === 5 && serv.vendas.length === 2, 'uma linha por nota, ignorando os totais por CFOP/acumulador');
perto(sai.soma, 5000, 0.005, 'soma das saídas'); ok(sai.conferido === true, 'saídas batem com o Total Geral');
perto(serv.soma, 1000, 0.005, 'soma dos serviços'); ok(serv.conferido === true, 'serviços batem com o Total Geral');
ok(sai.vendas[2].cliente === 'FABRICA DE CALCADOS TESTE LTDA' && sai.vendas[2].cfop === '5102', 'CFOP colado no nome não entra no nome');
ok(serv.vendas[0].cliente === 'ASSOCIACAO DE TESTE DE BENEFICENCIA' && serv.vendas[0].valor === 500, 'AC colado no nome não entra no nome (serviços)');
ok(sai.vendas[1].classe === 'consumidor' && sai.vendas[0].classe === 'pf' && sai.vendas[2].classe === 'pj' && sai.vendas[3].classe === 'pj', 'consumidor, PF e PJ pelo nome');
ok(classificarCliente('ELISANGELA R FREY & CIA LTDA') === 'pj' && classificarCliente('CHAGDUD GONPA BRASIL') === 'pj' && classificarCliente('ANA CARINA DEBARBA') === 'pf', 'tokens de PJ');
ok(sai.vendas[4].st === true && sai.vendas[0].st === false, 'CFOP x405 marca ST');
const rv = resumirVendas([...sai.vendas, ...serv.vendas], null);
perto(rv.pctPJ, (1000 + 650 + 3000 + 500) / 6000 * 100, 0.005, '% PJ = valor com nome de PJ ÷ total (saídas + serviços)');
perto(rv.st, 3000, 0.005, 'valor com ST');
const cVen = consolidar([sai, serv], null);
perto(cVen.campos.receita, 6000 / 2, 0.005, 'sem faturamento, receita = média mensal das saídas + serviços');
perto(cVen.campos.pctPJ, rv.pctPJ, 0.005, 'pctPJ vai pros campos');
ok(/PJ foi reconhecida pelo nome/.test(cVen.avisos.join(' ')), 'avisa que PJ é pelo nome');
const cVenSim = consolidar([sai, serv, { ...sim, competencia: '2026-02', rpa: 4000 }], null);
ok(cVenSim.avisos.some(a => /PGDAS traz/.test(a)), 'cruza o mês do PGDAS com saídas + serviços e acusa diferença');

console.log('\nPlanilha XLS da Domínio (matriz sintética, mesmo layout do export):');
const XLS_SAIDAS = [
  ['416 - EMPRESA TESTE COMERCIO LTDA'],
  ['CNPJ:', '11.222.333/0001-44'],
  ['Insc Est.:', '1234567890'],
  ['Período:', '01/01/2016 até 31/08/2026'],
  ['', '', '', '', '', '', '', '', 'ACOMPANHAMENTO DE SAÍDAS'],
  ['Código', 'Data Emissão', 'Data', 'Nota', 'Série', 'Espécie', 'Código', 'Cliente', 'CNPJ/CPF/CEI/CAEPF', 'Insc. Est.', 'CFOP', 'AC.', 'UF', 'Valor Contábil', 'Tipo', 'Base Cálculo', 'Alíq.'],
  ['3521', '02/08/2024', '02/08/2024', '82', '', '36', '7', 'CONDOMINIO TESTE', '50400850000148', '', '5-102', '35', 'RS', '271,68', '', '0,00', '0,00'],
  [3522, 45506, 45506, '83', '', 36, 8, 'MARIA DE TESTE', '12345678901', '', 5102, 35, 'RS', 1115.7, '', 0, 0],      // como o XLS real grava: data em número de série, CFOP e valor numéricos, CPF
  ['3536', '01/08/2024', '01/08/2024', '42640', '', '45', '1', 'CLIENTES DIVERSOS', '00000000000000', '', '5-102', '35', 'RS', '17,00', '', '0,00', '0,00'],
  ['3537', '01/08/2024', '01/08/2024', '42641', '', '45', '1', 'JOSE SEM DOCUMENTO LTDA', '', '', '5-405', '36', 'RS', '100,00', '', '0,00', '0,00'],   // sem documento: cai no nome
  ['Total CFOP', '', '', '', '', '', '', '', '', '', '', '', '', '1.404,38'],
  ['Total Geral', '', '', '', '', '', '', '', '', '', '', '', '', '1.504,38']
];
ok(detectarTipoPlanilha(XLS_SAIDAS) === 'saidas', 'reconhece a planilha de saídas pelo título numa célula solta');
const xs = lerPlanilha(XLS_SAIDAS);
ok(xs.empresa === 'EMPRESA TESTE COMERCIO LTDA' && xs.cnpj === '11222333000144', 'cabeçalho "416 - EMPRESA" e CNPJ');
ok(xs.vendas.length === 4, 'uma venda por linha, sem os totais');
perto(xs.soma, 1504.38, 0.005, 'soma (texto "271,68" e número 1115.7 misturados)'); ok(xs.conferido === true, 'bate com o Total Geral');
ok(xs.vendas[0].classe === 'pj' && xs.vendas[0].classePorDocumento, 'CNPJ de 14 dígitos = PJ pelo documento');
ok(xs.vendas[1].classe === 'pf' && xs.vendas[1].classePorDocumento, 'CPF de 11 dígitos = PF pelo documento');
ok(xs.vendas[1].data === '02/08/2024' && xs.vendas[1].competencia === '2024-08' && xs.vendas[1].cfop === '5102', 'data em número de série do Excel (45506 = 02/08/2024) e CFOP numérico');
ok(xs.vendas[2].classe === 'consumidor' && xs.vendas[2].classePorDocumento, 'documento zerado = consumidor');
ok(xs.vendas[3].classe === 'pj' && !xs.vendas[3].classePorDocumento, 'sem documento cai na leitura pelo nome');
ok(xs.vendas[3].st === true && xs.vendas[3].cfop === '5405', 'CFOP "5-405" vira 5405 com ST');
const XLS_ENT = [
  ['416 - EMPRESA TESTE COMERCIO LTDA'], ['CNPJ:', '11.222.333/0001-44'], ['Período:', '01/01/2026 até 31/03/2026'],
  ['', '', '', '', 'ACOMPANHAMENTO DE ENTRADAS'],
  ['Código', 'Data Emissão', 'Data Entrada', 'Nota', 'Série', 'Espécie', 'Código', 'Fornecedor', 'CNPJ/CPF/CEI/CAEPF', 'Insc. Est.', 'CFOP', 'AC.', 'UF', 'Valor Contábil', 'Tipo'],
  ['1', '05/01/2026', '06/01/2026', '111', '1', '55', '9', 'FORNECEDOR PECAS LTDA', '22.333.444/0001-55', '', '1-102', '67', 'RS', '10.000,00', 'ICMS'],
  ['2', '11/02/2026', '11/02/2026', '114', '1', '55', '9', 'POSTO COMBUSTIVEL LTDA', '44.555.666/0001-77', '', '1-949', '67', 'RS', '500,00', 'ICMS'],
  ['Total Geral', '', '', '', '', '', '', '', '', '', '', '', '', '10.500,00']
];
const xe = lerPlanilha(XLS_ENT);
ok(xe.tipo === 'entradas' && xe.lancamentos.length === 2 && xe.lancamentos[0].competencia === '2026-01' && xe.lancamentos[0].grupo === 'mercadoria' && xe.lancamentos[1].grupo === 'outras', 'entradas em planilha: data de entrada, CFOP e grupo');
ok(xe.conferido === true && xe.lancamentos[0].documento === '22333444000155', 'entradas batem com o Total Geral; CNPJ do fornecedor sem pontuação');
const cX = consolidar([xs], null);
ok(/com CNPJ/.test(cX.origem.pctPJ) === false && cX.avisos.some(a => /Parte das notas veio sem CNPJ/.test(a)), 'com uma venda sem documento, avisa que parte foi pelo nome');
const cX2 = consolidar([{ ...xs, vendas: xs.vendas.slice(0, 3) }], null);
ok(/com CNPJ/.test(cX2.origem.pctPJ) && !cX2.avisos.some(a => /pelo nome/.test(a)), 'com documento em todas, % PJ é pelo CNPJ e sem aviso de nome');

console.log('\nNúmeros no formato brasileiro:');
ok(numBR('1.034.942,41') === 1034942.41, 'milhar com ponto e decimal com vírgula');
ok(numBR('0,00') === 0, 'zero');
ok(numBR('') === null, 'vazio não vira zero');
ok(numBR('ICMS') === null, 'texto não vira número');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
