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

import { lerRelatorio, detectarTipo, grupoDoCfop, resumirEntradas, consolidar, numBR, classificarCliente, resumirVendas, lerPlanilha, detectarTipoPlanilha, grupoSaida, cnpjsParaConsultar, perfilAtividade, cnaeMaisCompleto, conferirRbt12, rotuloMeses, digitosCnae, ramoComReducao, ramoComZero, reducaoServicoPorCnae } from '../assets/js/dominio-relatorios.js';
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

console.log('\nSaídas por CFOP: retorno de industrialização não é receita:');
ok(grupoSaida('5124') === 'receita' && grupoSaida('5102') === 'receita' && grupoSaida('5405') === 'receita' && grupoSaida('5933') === 'receita' && grupoSaida('7101') === 'receita', 'venda, industrialização, ST, serviço e exportação são receita');
ok(grupoSaida('5902') === 'remessa' && grupoSaida('5920') === 'remessa' && grupoSaida('5152') === 'transferencia' && grupoSaida('5202') === 'devolucao' && grupoSaida('5551') === 'ativo', 'retorno, vasilhame, transferência, devolução e ativo não são');
const XLS_IND = [
  ['14 - INDUSTRIA TESTE LTDA'], ['CNPJ:', '11.222.333/0001-44'], ['Período:', '01/01/2026 até 31/01/2026'],
  ['', '', '', '', 'ACOMPANHAMENTO DE SAÍDAS'],
  ['Código', 'Data Emissão', 'Data', 'Nota', 'Série', 'Espécie', 'Código', 'Cliente', 'CNPJ/CPF/CEI/CAEPF', 'Insc. Est.', 'CFOP', 'AC.', 'UF', 'Valor Contábil'],
  ['1', 46023, 46023, '10', '1', 55, 9, 'CALCADOS CONTRATANTE LTDA', '55666777000188', '', 5902, 35, 'RS', 40000],
  ['2', 46023, 46023, '10', '1', 55, 9, 'CALCADOS CONTRATANTE LTDA', '55666777000188', '', 5124, 35, 'RS', 9000],
  ['Total Geral', '', '', '', '', '', '', '', '', '', '', '', '', 49000]
];
const xi = lerPlanilha(XLS_IND);
ok(xi.conferido === true && xi.vendas.length === 2, 'planilha de industrialização lida inteira (bate com o Total Geral)');
const ci = consolidar([xi], null);
perto(ci.campos.receita, 9000, 0.005, 'receita = só o 5124 (o 5902 é retorno do material do cliente)');
ok(ci.avisos.some(a => /Fora da receita.*5902/.test(a)), 'avisa o que ficou fora da receita, com o CFOP');

console.log('\nRegime de fornecedores e clientes (Receita) e deduções pelo perfil:');
{
  const ENT = { tipo: 'entradas', cnpj: '11222333000144', lancamentos: [
    { competencia: '2026-01', grupo: 'mercadoria', documento: '10000000000100', fornecedor: 'DISTRIBUIDORA REGULAR', valor: 6000 },
    { competencia: '2026-01', grupo: 'mercadoria', documento: '20000000000100', fornecedor: 'FABRICA DO SIMPLES', valor: 4000 } ] };
  const SAI = { tipo: 'saidas', cnpj: '11222333000144', vendas: [
    { tipo: 'saidas', competencia: '2026-01', documento: '30000000000100', classe: 'pj', classePorDocumento: true, valor: 8000, grupo: 'receita', cfop: '5102' },
    { tipo: 'saidas', competencia: '2026-01', documento: '40000000000100', classe: 'pj', classePorDocumento: true, valor: 2000, grupo: 'receita', cfop: '5102' } ] };
  const q = cnpjsParaConsultar([ENT, SAI]);
  ok(q.fornecedores.length === 2 && q.clientes.length === 2 && q.fornecedores[0] === '10000000000100', 'lista os maiores fornecedores e clientes por CNPJ');
  const regimes = new Map([['10000000000100', { simples: false }], ['20000000000100', { simples: true }], ['30000000000100', { simples: false }], ['40000000000100', { simples: true }]]);
  const sem = consolidar([ENT, SAI], null), com = consolidar([ENT, SAI], null, { regimes });
  perto(sem.campos.pctMerc, 100, 0.01, 'sem regimes: compras 100% da receita');
  perto(com.campos.pctMerc, 100 * (1 - 0.4 * 0.85), 0.01, 'com regimes: 40% das compras do Simples creditam só 15% → 66%');
  perto(com.campos.pctPJ, 80, 0.01, 'clientes: só os 80% vendidos a empresas do regime regular aproveitam o crédito');
  ok(com.avisos.some(a => /Regime dos fornecedores/.test(a)) && com.avisos.some(a => /Regime dos clientes/.test(a)), 'avisa os dois ajustes');
  const semVenda = consolidar([{ tipo: 'faturamento', meses: [{ competencia: '2026-01', total: 50000, saidas: 50000, servicos: 0 }] }], null, { perfil: perfilAtividade({ cnae: '5611-2/01', anexo: 'I' }) });
  ok(semVenda.campos.pctPJ === 0 && semVenda.campos.pctPJDeduzido, 'restaurante sem CNPJ de clientes: deduz consumidor final');
  const ind = consolidar([{ tipo: 'faturamento', meses: [{ competencia: '2026-01', total: 150000, saidas: 150000, servicos: 0 }] }], null, { perfil: perfilAtividade({ cnae: '1531-9/01', anexo: 'II' }) });
  ok(ind.campos.pctPJ === 90 && /indústria vende essencialmente a empresas/.test(ind.origem.pctPJ), 'fábrica de calçados sem CNPJ de clientes: deduz venda a empresas (a confirmar)');
  // refeições para empresas (CNAE 5620-1/01, 13/10/2026): cliente empresa por definição — nunca "consumidor final"
  const fatSo = [{ tipo: 'faturamento', meses: [{ competencia: '2026-01', total: 100000, saidas: 100000, servicos: 0 }] }];
  const coz = consolidar(fatSo, null, { perfil: perfilAtividade({ cnae: '5620-1/01', anexo: 'I' }) });
  ok(coz.campos.pctPJ === 90 && coz.campos.pctPJDeduzido && /CNAE 5620-1\/01/.test(coz.origem.pctPJ) && /regime dos clientes/.test(coz.origem.pctPJ), 'refeições para empresas sem CNPJ de clientes: deduz venda a empresas (90%, a confirmar com o regime dos clientes)');
  const domicilio = consolidar(fatSo, null, { perfil: perfilAtividade({ cnae: '5620-1/04', anexo: 'I' }) });
  ok(domicilio.campos.pctPJ === 0 && /bar e restaurante/.test(domicilio.origem.pctPJ), 'refeições para consumo domiciliar (5620-1/04, pizzaria de entrega): segue consumidor final');
}

console.log('\nRefeições para empresas e o CNAE mais completo:');
{
  const p1 = perfilAtividade({ cnae: '5620-1/01', anexo: 'I' }), p4 = perfilAtividade({ cnae: '5620-1/04', anexo: 'I' }), p0 = perfilAtividade({ cnae: '5620', anexo: 'I' });
  ok(p1.tipo === 'alimentacao' && p1.refeicaoEmpresas && p1.rotulo === 'refeições para empresas', '5620-1/01: alimentação, marcada como refeições para empresas');
  ok(p4.tipo === 'alimentacao' && !p4.refeicaoEmpresas && p4.rotulo === 'bar e restaurante', '5620-1/04: alimentação comum (bar e restaurante)');
  ok(!p0.refeicaoEmpresas, 'só com 4 dígitos (5620) não dá pra saber a subclasse: não marca');
  ok(!perfilAtividade({ cnae: '5620-1/01', natureza: { servico: 100 } }).refeicaoEmpresas, 'se as saídas mostram serviço, o perfil é de serviço e não marca');
  const cad = '5620-1/01 - Fornecimento de alimentos preparados preponderantemente para empresas';
  ok(cnaeMaisCompleto('5620', cad) === cad, 'caso com 4 dígitos e cadastro completo: vale o cadastro');
  ok(cnaeMaisCompleto('5620-1/01', '5620-1/01') === '5620-1/01', 'os dois iguais: vale o do caso');
  ok(cnaeMaisCompleto('5611', '5620-1/04') === '5611', 'caso e cadastro divergem: vale o do caso, como sempre');
  ok(cnaeMaisCompleto(null, cad) === cad && cnaeMaisCompleto('5620', null) === '5620' && cnaeMaisCompleto(null, null) === '', 'sem um dos dois, vale o outro');
}

console.log('\nCNAE sem o zero da frente, ramos com alíquota zero, serviço com redução e passageiros (Módulo 07):');
{
  // a consulta à Receita mandava a subclasse como número: 0121-1/01 chegava 121101 (divisão 12 = fumo)
  ok(digitosCnae('121101 - Horticultura, exceto morango') === '0121101' && digitosCnae('0121-1/01') === '0121101' && digitosCnae(121101) === '0121101', '6 dígitos ganham o zero da frente: 121101 → 0121101');
  ok(digitosCnae('4711-3/02 - Supermercados 24 horas') === '4711302' && digitosCnae('5620') === '5620' && digitosCnae(null) === '', 'a descrição não entra nos dígitos; 4 dígitos ficam como estão; vazio, vazio');
  const hort = perfilAtividade({ cnae: '121101 - Horticultura, exceto morango' });
  ok(hort.tipo === 'agro' && hort.vendeMercadoria, 'horticultura gravada sem o zero: produção agropecuária (antes, indústria)');
  ok(ramoComReducao('121101 - Horticultura, exceto morango') && ramoComZero('121101') === 'hortifruti', 'e é ramo com redução, com alíquota zero (hortifrúti)');
  ok(cnaeMaisCompleto('0121', '121101 - Horticultura, exceto morango') === '121101 - Horticultura, exceto morango', 'caso com 0121 e cadastro sem o zero: vale o cadastro, mais completo');
  ok(ramoComZero('4711-3/02') === 'mercado' && ramoComZero('4712-1/00') === 'mercado' && ramoComZero('4724-5/00') === 'hortifruti' && ramoComZero('4633-8/01') === 'hortifruti', 'mercado e minimercado; hortifrúti no varejo e no atacado');
  ok(ramoComZero('4771-7/01') === null && ramoComZero('4744-0/01') === null && ramoComZero('') === null, 'farmácia e material de construção: sem o teste de alíquota zero');
  // serviço com redução pelo CNAE (LC 214, art. 127 — profissões, −30%; Anexos II, III e X — −60%; academia, os dois)
  const cont = reducaoServicoPorCnae('6920-6/01 - Atividades de contabilidade');
  ok(cont && cont.tipo === 'profissao' && cont.faixas.join() === 'mixRed30' && /contabilistas \(art\. 127, VII\)/.test(cont.quem), 'contabilidade: profissão do art. 127, −30%');
  ok(reducaoServicoPorCnae('6911-7/01').tipo === 'profissao' && reducaoServicoPorCnae('6911-7/02') === null, 'advocacia sim; cartório (6911-7/02) não');
  const clin = reducaoServicoPorCnae('8630-5/03');
  ok(clin && clin.tipo === 'anexo' && clin.faixas.join() === 'mixRed60' && /Anexo III/.test(clin.anexo), 'clínica: −60% pelo Anexo III');
  ok(reducaoServicoPorCnae('8513-9/00').tipo === 'anexo' && /Anexo II/.test(reducaoServicoPorCnae('8513-9/00').anexo), 'escola: −60% pelo Anexo II');
  const acad = reducaoServicoPorCnae('9313-1/00');
  ok(acad && acad.tipo === 'desporto' && acad.faixas.join() === 'mixRed30,mixRed60' && acad.ramo === 'academia', 'academia: −30% (registrada no conselho) e −60% (educação desportiva) — vale a maior');
  ok(reducaoServicoPorCnae('8591-1/00').tipo === 'desporto' && reducaoServicoPorCnae('8591-1/00').ramo === 'ensino de esportes', 'ensino de esportes (8591) é desporto, não o −60% da educação');
  ok(reducaoServicoPorCnae('7490-1/04') === null && reducaoServicoPorCnae('6201-5/01') === null && reducaoServicoPorCnae('') === null, 'intermediação e software: sem redução de serviço');
  // passageiros: linha regular (4921, 4922, 4912) × fretamento, táxi e escolar (4923, 4924, 4929) — pelo CNAE, mesmo com NFS-e
  const urb = perfilAtividade({ cnae: '4921-3/01', natureza: { servico: 100 } });
  ok(urb.tipo === 'servico' && urb.passageiros && !urb.passageirosOutros, 'ônibus urbano que fatura com NFS-e: serviço pelas saídas, mas passageiros pelo CNAE');
  const fret = perfilAtividade({ cnae: '4929-9/01' });
  ok(fret.tipo === 'transporte' && !fret.passageiros && fret.passageirosOutros && fret.rotulo === 'transporte de passageiros (fretamento, táxi ou escolar)', 'fretamento: não é "transporte de cargas"');
  ok(perfilAtividade({ cnae: '4930-2/02' }).rotulo === 'transporte de cargas' && perfilAtividade({ cnae: '4922-1/01' }).rotulo === 'transporte de passageiros', 'carga e linha intermunicipal com os rótulos certos');
  // revisão: trem e metrô (zero do art. 285, I), fretamento entre cidades (−40% do art. 286 a conferir), rótulo com NFS-e
  ok(perfilAtividade({ cnae: '4912-4/02' }).trilhos && !perfilAtividade({ cnae: '4921-3/01' }).trilhos, 'trem e metrô (4912) marcados como trilhos; ônibus não');
  ok(perfilAtividade({ cnae: '4929-9/02' }).fretamentoIntermunicipal && perfilAtividade({ cnae: '4929-9/04' }).fretamentoIntermunicipal && perfilAtividade({ cnae: '4929' }).fretamentoIntermunicipal
    && !perfilAtividade({ cnae: '4929-9/01' }).fretamentoIntermunicipal && !perfilAtividade({ cnae: '4929-9/03' }).fretamentoIntermunicipal && !perfilAtividade({ cnae: '4923-0/01' }).fretamentoIntermunicipal,
    'fretamento entre cidades (9/02, 9/04 e só "4929") a conferir; municipal (9/01, 9/03) e táxi não');
  ok(urb.rotulo === 'transporte de passageiros' && perfilAtividade({ cnae: '4929-9/01', natureza: { servico: 100 } }).rotulo === 'transporte de passageiros (fretamento, táxi ou escolar)', 'com NFS-e, o rótulo continua o do transporte de passageiros');
  ok(reducaoServicoPorCnae('7490-1/03').tipo === 'profissao' && /XVIII/.test(reducaoServicoPorCnae('7490-1/03').quem), 'agronomia e consultoria agropecuária (7490-1/03): agrônomos e técnicos agrícolas');
  ok(reducaoServicoPorCnae('7119-7/02') === null && reducaoServicoPorCnae('7119-7/01').tipo === 'profissao', 'estudos geológicos fora (geólogo não está no rol); topografia dentro');
  ok(reducaoServicoPorCnae('8230-0/02') === null && reducaoServicoPorCnae('8230-0/01').tipo === 'anexo', 'casa de festas fora; organização de feiras e eventos dentro');
}

console.log('\nRBT12 × relatórios, mês com mês:');
{
  const mes = (c, t) => ({ competencia: c, total: t });
  const novos = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'].map(c => mes(c, 106000));
  const a = conferirRbt12(novos, '2026-08', 745735);
  ok(a && a.alerta === false && a.meses === 7, 'empresa que começou em 2026: 7 meses somando ~o RBT12 não dispara nada');
  const b = conferirRbt12(novos, '2026-08', 500000);
  ok(b && b.alerta === true && /não foi declarada no Simples/.test(b.texto), 'relatórios com mais receita que o RBT12 inteiro: alerta de receita fora do Simples');
  const doze = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'].map(c => mes(c, 50000));
  ok(conferirRbt12(doze, '2026-08', 1000000).alerta === true, 'cobrindo os 12 meses e somando 60% do RBT12: falta receita');
  ok(conferirRbt12(doze, '2026-08', 600000).alerta === false, 'cobrindo os 12 meses e batendo: nada');
}

// ---------- período de cada relatório (13/10/2026) ----------
// Cliente recém-chegado: entradas e saídas só do primeiro mês feito pelo escritório (set/26), faturamento dos 12 meses de
// antes (set/25 a ago/26) e o PGDAS de set/26. Antes as compras de set/26 ficavam fora da conta (0% de compras) e o % de
// PJ caía no deduzido pelo perfil, sem aviso; com o faturamento até set/26, as compras de um mês eram divididas pela
// receita de doze (1/12 do % real).
console.log('\nPeríodo das entradas e das saídas diferente do faturamento:');
{
  const meses = (ini, n) => { const out = []; let [a, m] = ini.split('-').map(Number); for (let i = 0; i < n; i++) { out.push(a + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; a++; } } return out; };
  const fatDe = ini => ({ tipo: 'faturamento', meses: meses(ini, 12).map(c => ({ competencia: c, total: 108500, saidas: 108500, servicos: 0 })) });
  const pgdas = { tipo: 'simples', competencia: '2026-09', rpa: 110000, rbt12: 1302000, anexoPredominante: 'II', aliquotaEfetiva: 8.2, receitaTributada: 110000, dasTotal: 9020,
    partilhaCbsPct: 14, cbsNoDas: 1262.8, anexos: [{ anexo: 'II', receita: 110000, das: 9020, secoes: [{}] }], historico: meses('2025-09', 12).map(c => ({ competencia: c, receita: 108500 })) };
  const lanc = (c, grupo, cfop, valor, i) => ({ competencia: c, grupo, cfop, documento: '1' + String(i).padStart(13, '0'), fornecedor: 'FORNECEDOR ' + i, valor });
  const ent = { tipo: 'entradas', lancamentos: [...Array.from({ length: 11 }, (_, i) => lanc('2026-09', 'mercadoria', '1101', 4000, i)), ...Array.from({ length: 5 }, (_, i) => lanc('2026-09', 'despesa', '1353', 440, 20 + i))] };
  const venda = (valor, i, pj) => ({ tipo: 'saidas', competencia: '2026-09', documento: pj ? '2' + String(i).padStart(13, '0') : '3' + String(i).padStart(10, '0'), cliente: 'CLIENTE ' + i, classe: pj ? 'pj' : 'pf', classePorDocumento: true, valor, grupo: 'receita', cfop: '5101' });
  const sai = { tipo: 'saidas', fonte: 'planilha', vendas: [...Array.from({ length: 11 }, (_, i) => venda(8500, i, true)), venda(5000, 90, false), venda(5000, 91, false), venda(6500, 92, false)] };
  const perfil = perfilAtividade({ cnae: '3299-0/99', anexo: 'II' });

  const a = consolidar([fatDe('2025-09'), pgdas, ent, sai], null, { perfil });
  perto(a.campos.receita, 108500, 0.005, 'a receita média continua a dos 12 meses do faturamento');
  perto(a.campos.pctMerc, 44000 / 110000 * 100, 0.0001, 'faturamento até ago/26: compras de set/26 ÷ receita de set/26 do PGDAS (não zero)');
  perto(a.campos.pctDesp, 2200 / 110000 * 100, 0.0001, 'despesas também sobre a receita do mesmo mês');
  ok(/set\/26 \(1 mês\)/.test(a.origem.pctMerc) && /PGDAS set\/26/.test(a.origem.pctMerc), 'a origem diz o mês das compras e de onde veio a receita: ' + a.origem.pctMerc);
  ok(a.procedencia.pctMerc.fonte === 'entradas' && a.procedencia.pctMerc.meses.join() === '2026-09' && a.procedencia.pctMerc.mesesFaturamento === 12 && a.procedencia.pctMerc.receitaDe[0] === 'PGDAS set/26', 'procedência das compras: entradas de set/26, contra 12 meses de faturamento');
  perto(a.campos.pctPJ, 93500 / 110000 * 100, 0.0001, '% de PJ medido nas saídas de set/26 (não o deduzido pelo perfil)');
  ok(!a.campos.pctPJDeduzido && a.procedencia.pctPJ.fonte === 'saidas' && a.procedencia.pctPJ.meses.join() === '2026-09' && a.procedencia.pctPJ.porDocumento === true, 'procedência do % de PJ: saídas de set/26, pelo CNPJ');
  ok(a.mesesEntradas.join() === '2026-09' && a.mesesVendas.join() === '2026-09', 'os meses das entradas e das saídas vão junto (a prévia e a análise usam os mesmos)');
  ok(a.procedencia.receita.fonte === 'faturamento' && a.procedencia.receita.meses.length === 12 && a.procedencia.rbt12.fonte === 'pgdas', 'procedência da receita (12 meses) e do RBT12 (PGDAS)');
  ok(a.avisos.some(t => /^Compras medidas em set\/26 \(1 mês\), contra 12 meses do faturamento/.test(t) && /confiança baixa/.test(t)), 'avisa que as compras são de 1 mês contra 12 do faturamento');
  ok(a.avisos.some(t => /^O % de vendas para PJ foi medido nas saídas de set\/26 \(1 mês\)/.test(t)), 'avisa que o % de PJ é das saídas de 1 mês');
  ok(!a.avisos.some(t => /subestimado|não cobre/.test(t)), 'sem o aviso antigo de "subestimado"');
  ok(!a.avisos.some(t => /não batem/.test(t)), 'sem comparar saídas de 1 mês com faturamento de 12 (não há mês em comum)');

  const b = consolidar([fatDe('2025-10'), pgdas, ent, sai], null, { perfil });
  perto(b.campos.pctMerc, 44000 / 108500 * 100, 0.0001, 'faturamento até set/26: compras de set/26 ÷ receita de set/26 do faturamento (não ÷ 12 meses)');
  ok(b.procedencia.pctMerc.receitaDe.join() === 'faturamento', 'a receita do mês veio do faturamento');
  ok(b.avisos.some(t => /^Nos meses em que os dois relatórios existem \(set\/26\)/.test(t)), 'saídas × faturamento comparados só no mês em comum (set/26)');

  // entradas de um mês sem receita em relatório nenhum: ficam fora, com aviso — o % não é inventado
  const entOut = { tipo: 'entradas', lancamentos: [lanc('2026-10', 'mercadoria', '1101', 5000, 1)] };
  const c = consolidar([fatDe('2025-09'), entOut], null, { perfil });
  ok(c.campos.pctMerc === undefined && c.procedencia.pctMerc === undefined, 'entradas de out/26 sem receita do mesmo mês: o % de compras não é calculado');
  ok(c.avisos.some(t => /^As entradas de out\/26 ficaram fora do % de compras/.test(t)), 'e o aviso diz quais meses e por quê');

  // a receita do mês pode vir do histórico do RBT12 que vem no PGDAS
  const entMar = { tipo: 'entradas', lancamentos: [lanc('2026-03', 'mercadoria', '1101', 54250, 1)] };
  const d = consolidar([pgdas, entMar], null, { perfil });
  perto(d.campos.pctMerc, 50, 0.0001, 'entradas de mar/26 ÷ receita de mar/26 do histórico do RBT12 no PGDAS');
  ok(/histórico do RBT12 no PGDAS set\/26/.test(d.origem.pctMerc), 'e a origem diz isso');

  // sem as saídas, o % de PJ é deduzido — e a procedência marca
  const e = consolidar([fatDe('2025-09'), pgdas, ent], null, { perfil });
  ok(e.campos.pctPJ === 90 && e.procedencia.pctPJ.fonte === 'deduzido' && e.procedencia.pctPJ.perfil === 'industria', 'sem as saídas: % de PJ deduzido, com a procedência "deduzido" (indústria)');

  ok(rotuloMeses(['2026-03', '2026-01', '2026-02']) === 'jan/26–mar/26' && rotuloMeses(['2026-01', '2026-03']) === 'jan/26–mar/26 (2 meses)' && rotuloMeses(['2025-12', '2026-01']) === 'dez/25–jan/26' && rotuloMeses([]) === '', 'rótulo dos meses: contínuo, com buraco e virando o ano');
}

console.log('\nMeses que o relatório de entradas cobre (mês sem nota é compra zero — se a escrita existia):');
{
  const meses = (ini, n) => { const out = []; let [a, m] = ini.split('-').map(Number); for (let i = 0; i < n; i++) { out.push(a + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; a++; } } return out; };
  const M12 = meses('2025-09', 12);
  const fat = { tipo: 'faturamento', meses: M12.map(c => ({ competencia: c, saidas: 0, servicos: 50000, outros: 0, total: 50000 })) };
  const lanc = c => ({ competencia: c, valor: 10000, grupo: 'despesa', cfop: '1933', fornecedor: 'FORNECEDOR', documento: null });
  // a empresa só comprou em 3 meses, e o relatório cobre o ano (cabeçalho de set/25 a ago/26)
  const ent = { tipo: 'entradas', periodoDe: '2025-09', periodoAte: '2026-08', lancamentos: ['2025-11', '2026-03', '2026-07'].map(lanc) };
  const a = consolidar([fat, ent], null, {});
  ok(a.mesesEntradas.length === 9 && a.mesesEntradas[0] === '2025-11' && a.mesesEntradas[8] === '2026-07', 'os meses do meio, sem nota, entram (compra zero): nov/25 a jul/26');
  perto(a.campos.pctDesp, 30000 / 450000 * 100, 0.0001, 'R$ 30 mil ÷ receita dos 9 meses (antes, só os 3 meses com nota: 20%)');
  ok(a.avisos.some(t => /set\/25–out\/25 e ago\/26 não têm nenhuma nota/.test(t) && /o % seria 5% \(em vez de 6,7%\)/.test(t)), 'os meses do cabeçalho antes da 1ª nota e depois da última ficam fora, com o % que daria se fossem compra zero');
  // e a dúvida vai na procedência: a confiança testa os dois números (rt-confianca.js)
  ok(a.procedencia.pctDesp.mesesIncertos.join() === '2025-09,2025-10,2026-08' && Math.abs(a.procedencia.pctDesp.pctSeZero - 5) < 0.0001, 'a procedência leva os meses em dúvida e o % se fossem compra zero (5%)');
  ok(!/\(9 meses\) \(9 meses\)/.test(a.origem.pctDesp), 'sem o "(N meses)" repetido na origem: ' + a.origem.pctDesp);
  // com as saídas do ano, a escrita existia nesses meses: compra zero de verdade — o ano todo entra
  const sai = { tipo: 'saidas', vendas: M12.map(c => ({ competencia: c, valor: 50000, grupo: 'receita', classe: 'pj', classePorDocumento: true, documento: '11222333000100', cfop: '5102' })) };
  const b = consolidar([fat, ent, sai], null, {});
  perto(b.campos.pctDesp, 5, 0.0001, 'com as saídas do ano: 12 meses, R$ 30 mil ÷ R$ 600 mil = 5%');
  ok(!b.avisos.some(t => /não têm nenhuma nota|Compras medidas em/.test(t)), 'e sem aviso de meses de fora');
  // cliente novo: relatório de entradas pedido de jan a set, com nota só de setembro, e saídas só de setembro — os meses
  // antes da escrita do escritório não são "compra zero"
  const ent3 = { tipo: 'entradas', periodoDe: '2026-01', periodoAte: '2026-09', lancamentos: [{ competencia: '2026-09', valor: 20000, grupo: 'mercadoria', cfop: '1102', fornecedor: 'Y', documento: null }] };
  const sai3 = { tipo: 'saidas', vendas: [{ competencia: '2026-09', valor: 52000, grupo: 'receita', classe: 'pj', classePorDocumento: true, documento: '11222333000100', cfop: '5102' }] };
  const pg3 = { tipo: 'simples', competencia: '2026-09', rpa: 52000, historico: [], anexos: [{ anexo: 'I', receita: 52000 }], anexoPredominante: 'I', rbt12: 600000 };
  const c = consolidar([fat, ent3, sai3, pg3], null, {});
  ok(c.mesesEntradas.join() === '2026-09', 'cliente novo: só setembro (o único mês com nota e com saída)');
  perto(c.campos.pctMerc, 20000 / 52000 * 100, 0.0001, 'compras de set ÷ receita de set (PGDAS), não ÷ 9 meses');
  ok(c.avisos.some(t => /jan\/26–ago\/26 não têm nenhuma nota/.test(t) && /o % seria 4,4%/.test(t)), 'e avisa dos meses do cabeçalho de fora, com o % alternativo');
  // com o período das saídas no cabeçalho (jan a set) e saída só em setembro: a escrita de jan a ago não era do escritório —
  // sem dúvida, fora da conta
  const c2 = consolidar([fat, ent3, { ...sai3, periodoDe: '2026-01', periodoAte: '2026-09' }, pg3], null, {});
  ok(c2.mesesEntradas.join() === '2026-09' && !c2.procedencia.pctMerc.mesesIncertos && c2.avisos.some(t => /a escrita desses meses não era do escritório/.test(t)), 'saídas do período sem lançamento nesses meses: a escrita não era do escritório (sem dúvida)');
  // sem o período no cabeçalho das entradas, as saídas do ano dizem que a escrita existia: o ano todo entra
  const entSemP = { tipo: 'entradas', lancamentos: ['2025-11', '2026-03', '2026-07'].map(lanc) };
  perto(consolidar([fat, entSemP, sai], null, {}).campos.pctDesp, 5, 0.0001, 'entradas sem período no cabeçalho + saídas do ano: 12 meses, 5%');
  // dois relatórios de entradas (um por semestre), sem saídas: os meses entre as notas dos dois ficam em dúvida
  const entA = { tipo: 'entradas', periodoDe: '2025-09', periodoAte: '2026-02', lancamentos: ['2025-10', '2025-12'].map(lanc) };
  const entB = { tipo: 'entradas', periodoDe: '2026-03', periodoAte: '2026-08', lancamentos: ['2026-04', '2026-06'].map(lanc) };
  const sem = consolidar([fat, entA, entB], null, {});
  ok(sem.mesesEntradas.length === 6 && sem.procedencia.pctDesp.mesesIncertos.length === 6 && Math.abs(sem.procedencia.pctDesp.pctSeZero - 40000 / 600000 * 100) < 0.0001, 'dois semestres sem saídas: 6 meses medidos, 6 em dúvida (o % se fossem compra zero vai junto)');
  ok(c.avisos.some(t => /^Compras medidas em set\/26 \(1 mês\)/.test(t) && /confiança baixa/.test(t)), 'compras de 1 mês: diz que é confiança baixa');
  // 8 meses de entradas contra 12 de faturamento: o aviso diz o período, mas não fala em confiança (8 meses é alta)
  const ent8 = { tipo: 'entradas', lancamentos: meses('2026-01', 8).map(lanc) };
  const d = consolidar([fat, ent8], null, {});
  ok(d.avisos.some(t => /^Compras medidas em jan\/26–ago\/26 \(8 meses\)/.test(t) && !/confiança/.test(t)), 'com 8 meses, o aviso não fala em confiança média (a análise dá alta)');
  // o período do cabeçalho, lido do relatório
  const fatP = lerRelatorio(FATURAMENTO), entP = lerRelatorio(ENTRADAS);
  const entEmi = lerRelatorio([ENTRADAS[0].map(l => /^Período/.test(l) ? 'Período:  01/02/2026  a  31/03/2026      Emissão: 05/10/2026' : l)]);
  ok(entP.periodoDe === '2026-01' && entP.periodoAte === '2026-03' && fatP.periodoDe === '2026-01' && fatP.periodoAte === '2026-03', 'período do cabeçalho em competências ("até" e "a"): ' + entP.periodoDe + ' a ' + entP.periodoAte);
  ok(entEmi.periodoDe === '2026-02' && entEmi.periodoAte === '2026-03', 'a data de emissão na mesma linha não entra no período: ' + entEmi.periodoDe + ' a ' + entEmi.periodoAte);
}

console.log('\nNúmeros no formato brasileiro:');
ok(numBR('1.034.942,41') === 1034942.41, 'milhar com ponto e decimal com vírgula');
ok(numBR('0,00') === 0, 'zero');
ok(numBR('') === null, 'vazio não vira zero');
ok(numBR('ICMS') === null, 'texto não vira número');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
