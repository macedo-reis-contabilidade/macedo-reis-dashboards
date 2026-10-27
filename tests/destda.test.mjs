// A Conferência SEDIF/DeSTDA (assets/js/destda.js, 27/10/2026): a nota de fora do RS a 4% (o diferencial de alíquota), a
// ração pet dos estados da regra (o ICMS-ST na entrada), a leitura dos estados e o mês. Dados inventados (CNPJ com o
// dígito errado, nada de cliente). Rodar com: node tests/destda.test.mjs
import { lerUfs, ncmDaRegra, ncmFormatado, ehQuatro, regraDoItem, notaDeFora, conferirEmpresa, mesAnterior, limitesDoMes,
  rotuloDoMes, situacaoDaEmpresa, difalDaNota, ALIQUOTA_INTERNA_RS, UFS } from '../assets/js/destda.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const EMPRESA = '11222333000100', FORNECEDOR = '44555666000100';
const RACAO = { id: 'r1', nome: 'Ração pet', ncm: '23091000', ufs: ['SC', 'BA', 'GO', 'RN', 'RO', 'SP'], ativo: true };
const nota = (id, o = {}) => ({ id, tipo: 'entrada', status: 'autorizada', emit_uf: 'SC', emit_doc: FORNECEDOR, dest_doc: EMPRESA,
  data_emissao: '2026-09-10', numero: '100', emit_nome: 'FORNECEDOR TESTE SA', ...o });
const item = (n, o = {}) => ({ n_item: n, ncm: '85163100', descricao: 'SECADOR', valor_total: 1000, icms_base: 1000, icms_aliquota: 4, icms_valor: 40,
  icms_st_valor: 0, ...o });

console.log('Os estados da regra:');
chk('lê separado por vírgula, ponto e vírgula ou espaço, em maiúscula e sem repetir', JSON.stringify(lerUfs('sc, ba; GO rn  sc')) === JSON.stringify({ ufs: ['SC', 'BA', 'GO', 'RN'], invalidas: [] }));
chk('o que não é estado volta à parte', JSON.stringify(lerUfs('SP, XX, sao paulo').invalidas) === JSON.stringify(['XX', 'SAO', 'PAULO']));
chk('vazio = nenhum', lerUfs('').ufs.length === 0 && lerUfs(null).ufs.length === 0);
chk('as 27 UFs', UFS.length === 27 && UFS.includes('DF') && UFS.includes('RS'));

console.log('O NCM:');
chk('o NCM da regra vai de 2 a 8 dígitos, sem os pontos', ncmDaRegra('2309.10.00') === '23091000' && ncmDaRegra('23') === '23' && ncmDaRegra('2') === null && ncmDaRegra('230910001') === null);
chk('formatado com os pontos', ncmFormatado('23091000') === '2309.10.00' && ncmFormatado('2309') === '2309' && ncmFormatado('230910') === '2309.10');

console.log('A alíquota de 4%:');
chk('4, "4.00" e "4.0000" são 4%', ehQuatro(4) && ehQuatro('4.00') && ehQuatro('4.0000'));
chk('12%, vazio e nulo não', !ehQuatro(12) && !ehQuatro('') && !ehQuatro(null) && !ehQuatro(undefined) && !ehQuatro(4.01));

console.log('A regra de ST do item:');
chk('ração pet de SP entra', regraDoItem(item(1, { ncm: '23091000' }), 'SP', [RACAO]) === RACAO);
chk('de um estado fora da lista, não', regraDoItem(item(1, { ncm: '23091000' }), 'PR', [RACAO]) === null);
chk('outro NCM do capítulo 23, não', regraDoItem(item(1, { ncm: '23099010' }), 'SP', [RACAO]) === null);
chk('a regra desligada não vale', regraDoItem(item(1, { ncm: '23091000' }), 'SP', [{ ...RACAO, ativo: false }]) === null);
const LARGA = { id: 'r2', nome: 'Capítulo 23', ncm: '23', ufs: ['SP'], ativo: true };
chk('com duas regras que servem, a mais específica', regraDoItem(item(1, { ncm: '23091000' }), 'SP', [LARGA, RACAO]) === RACAO && regraDoItem(item(1, { ncm: '23099010' }), 'SP', [LARGA, RACAO]) === LARGA);
chk('item sem NCM, nada', regraDoItem(item(1, { ncm: null }), 'SP', [RACAO]) === null);

console.log('A nota que entra na conferência:');
chk('compra de SC da empresa: entra', notaDeFora(nota('a'), EMPRESA));
chk('compra do RS: não', !notaDeFora(nota('a', { emit_uf: 'RS' }), EMPRESA));
chk('cancelada: não', !notaDeFora(nota('a', { status: 'cancelada' }), EMPRESA));
chk('saída: não', !notaDeFora(nota('a', { tipo: 'saida' }), EMPRESA));
chk('a nota de entrada que a própria empresa emite (o retorno do depósito): não', !notaDeFora(nota('a', { emit_doc: EMPRESA, emit_uf: 'SP' }), EMPRESA));
chk('a empresa não é a destinatária: não', !notaDeFora(nota('a', { dest_doc: '99888777000100' }), EMPRESA));
chk('sem a UF do fornecedor: não', !notaDeFora(nota('a', { emit_uf: '' }), EMPRESA));

console.log('A conferência da empresa:');
const docs = [
  nota('n3', { numero: '300', data_emissao: '2026-09-20', emit_uf: 'SP' }),
  nota('n1', { numero: '100', data_emissao: '2026-09-05' }),
  nota('n2', { numero: '200', data_emissao: '2026-09-05', emit_uf: 'RS' }),
  nota('n4', { numero: '400', data_emissao: '2026-09-25', emit_uf: 'GO' }),
  nota('n5', { numero: '500', data_emissao: '2026-09-26', status: 'cancelada' })
];
const itens = new Map([
  ['n1', [item(2, { valor_total: 500, icms_base: 500, icms_valor: 20 }), item(1), item(3, { icms_aliquota: 12, icms_valor: 120 })]],
  ['n2', [item(1)]],
  ['n3', [item(1, { ncm: '23091000', icms_aliquota: 12, icms_valor: 60, valor_total: 500, icms_base: 500 }), item(2, { icms_aliquota: null, icms_base: null, icms_valor: 0, valor_total: 30 })]],
  ['n4', [item(1, { ncm: '23091000', icms_aliquota: 4, icms_valor: 8, valor_total: 200, icms_base: 200, icms_st_valor: 35.5 })]],
  ['n5', [item(1)]]
]);
const c = conferirEmpresa(docs, itens, [RACAO], EMPRESA);
chk('o diferencial: as notas de fora a 4%, por data e número (a do RS e a cancelada não)', c.diferencial.map(x => x.doc.id).join(',') === 'n1,n4', c.diferencial.map(x => x.doc.id));
chk('na nota, só os itens a 4%, em ordem', c.diferencial[0].itens.map(i => i.n_item).join(',') === '1,2');
chk('os totais do diferencial, com o DIFAL (13% de 1.700)', JSON.stringify(c.totais.diferencial) === JSON.stringify({ notas: 2, itens: 3, valor: 1700, base: 1700, icms: 68, difal: 221 }), c.totais.diferencial);
chk('o DIFAL de cada nota: 13% da base dos itens a 4% (o item a 12% fica fora)', c.diferencial[0].difal === 195 && c.diferencial[1].difal === 26, c.diferencial.map(x => x.difal));
chk('o ST: a ração de SP (mesmo a 12%) e a de GO', c.st.map(x => x.doc.id).join(',') === 'n3,n4' && c.st[0].itens.length === 1 && c.st[0].itens[0].regra === RACAO);
chk('os totais do ST, com o que o fornecedor reteve e quantos itens sem retenção', JSON.stringify(c.totais.st) === JSON.stringify({ notas: 2, itens: 2, valor: 700, retido: 35.5, semRetencao: 1 }), c.totais.st);
chk('sem regra nenhuma, o ST fica vazio', conferirEmpresa(docs, itens, [], EMPRESA).st.length === 0);
chk('nenhuma nota sem a alíquota aqui', c.semAliquota.length === 0);
const antiga = conferirEmpresa([nota('v')], new Map([['v', [item(1, { icms_aliquota: null, icms_base: null, icms_valor: 40 })]]]), [RACAO], EMPRESA);
chk('a nota importada antes de 27/10 (ICMS destacado sem a alíquota) é apontada pra importar de novo, e a empresa fica "a conferir"',
  antiga.semAliquota.map(d => d.id).join(',') === 'v' && antiga.diferencial.length === 0 && situacaoDaEmpresa(antiga, true) === 'a_conferir');
chk('o item sem ICMS nenhum (fornecedor do Simples) não é nota incompleta', conferirEmpresa([nota('s')], new Map([['s', [item(1, { icms_aliquota: null, icms_base: null, icms_valor: 0 })]]]), [], EMPRESA).semAliquota.length === 0);
chk('os centavos somam certo', conferirEmpresa([nota('x')], new Map([['x', [item(1, { valor_total: 0.1, icms_base: 0.1, icms_valor: 0.1 }), item(2, { valor_total: 0.2, icms_base: 0.2, icms_valor: 0.2 })]]]), [], EMPRESA).totais.diferencial.valor === 0.3);

console.log('O DIFAL:');
chk('a nota que a Thalia calculou (27/10/2026): base 18.038,16 a 4%, sem o IPI → DIFAL 2.344,96 (17% − 4%)',
  ALIQUOTA_INTERNA_RS === 17 && difalDaNota([{ icms_base: 18038.16, icms_aliquota: 4 }]) === 2344.96);
chk('a base de vários itens soma antes de arredondar: na nota inteira (2 × 0,10 → 0,03; item a item daria 0,02)', difalDaNota([{ icms_base: 0.1 }, { icms_base: 0.1 }]) === 0.03);
chk('meio centavo arredonda pra cima (0,50 × 13% = 0,065 → 0,07)', difalDaNota([{ icms_base: 0.5 }]) === 0.07);
chk('sem a base, zero', difalDaNota([{ icms_base: null }]) === 0 && difalDaNota([]) === 0 && difalDaNota(null) === 0);
chk('outra alíquota interna, outra diferença (25% − 4% = 21%)', difalDaNota([{ icms_base: 1000 }], 25) === 210);

console.log('A situação e o mês:');
chk('sem notas no mês, com algo a conferir, nada', situacaoDaEmpresa(c, false) === 'sem_notas' && situacaoDaEmpresa(c, true) === 'a_conferir'
  && situacaoDaEmpresa(conferirEmpresa([], new Map(), [], EMPRESA), true) === 'nada');
chk('o mês anterior (em janeiro, dezembro do ano anterior)', mesAnterior('2026-10-27') === '2026-09' && mesAnterior('2027-01-05') === '2026-12' && mesAnterior('') === null);
chk('os limites do mês, com o fevereiro bissexto', JSON.stringify(limitesDoMes('2028-02')) === JSON.stringify({ de: '2028-02-01', ate: '2028-02-29' })
  && limitesDoMes('2026-09').ate === '2026-09-30' && limitesDoMes('2026-13') === null);
chk('o rótulo do mês', rotuloDoMes('2026-09') === '09/2026' && rotuloDoMes('x') === '');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
