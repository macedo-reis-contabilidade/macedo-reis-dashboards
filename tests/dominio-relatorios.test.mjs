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

import { lerRelatorio, detectarTipo, grupoDoCfop, resumirEntradas, consolidar, numBR } from '../assets/js/dominio-relatorios.js';

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
perto(c.campos.partilha, 2041 / 11800 * 100, 0.005, 'partilha calculada, não digitada');
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

console.log('\nNúmeros no formato brasileiro:');
ok(numBR('1.034.942,41') === 1034942.41, 'milhar com ponto e decimal com vírgula');
ok(numBR('0,00') === 0, 'zero');
ok(numBR('') === null, 'vazio não vira zero');
ok(numBR('ICMS') === null, 'texto não vira número');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
