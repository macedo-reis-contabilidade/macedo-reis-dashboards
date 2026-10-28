// A Conferência SEDIF/DeSTDA (assets/js/destda.js, 27/10/2026): a nota de fora do RS a 4% (o diferencial de alíquota), a
// ração pet dos estados da regra (o ICMS-ST na entrada), a leitura dos estados e o mês. Dados inventados (CNPJ com o
// dígito errado, nada de cliente). Rodar com: node tests/destda.test.mjs
import { lerUfs, ncmDaRegra, ncmFormatado, ehQuatro, regraDoItem, notaDeFora, conferirEmpresa, mesAnterior, limitesDoMes,
  rotuloDoMes, situacaoDaEmpresa, difalDaNota, stDaNota, stRetido, stSemBase, agruparNotas, nomeTem, lerNomes, classificarItem,
  ALIQUOTA_INTERNA_RS, UFS } from '../assets/js/destda.js';

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
chk('o diferencial: as notas de fora a 4%, por data e número (a do RS, a cancelada e a ração a 4% de GO, que vai só pro ST, não)',
  c.diferencial.map(x => x.doc.id).join(',') === 'n1', c.diferencial.map(x => x.doc.id));
chk('na nota, só os itens a 4%, em ordem', c.diferencial[0].itens.map(i => i.n_item).join(',') === '1,2');
chk('os totais do diferencial, com o DIFAL (13% de 1.500)', JSON.stringify(c.totais.diferencial) === JSON.stringify({ notas: 1, itens: 2, valor: 1500, base: 1500, icms: 60, difal: 195 }), c.totais.diferencial);
chk('o DIFAL da nota: 13% da base dos itens a 4% (o item a 12% fica fora)', c.diferencial[0].difal === 195 && c.diferencial.length === 1, c.diferencial.map(x => x.difal));
chk('o ST: a ração de SP (mesmo a 12%) e a de GO', c.st.map(x => x.doc.id).join(',') === 'n3,n4' && c.st[0].itens.length === 1 && c.st[0].itens[0].regra === RACAO);
chk('o ST a recolher de cada nota: a de SP, 17% de 500 − 60 = 25; a de GO, com o ST retido pelo fornecedor, nada', c.st[0].recolher === 25 && c.st[1].recolher === 0, c.st.map(x => x.recolher));
chk('os totais do ST, com a base e o ICMS da conta, o que o fornecedor reteve, quantos itens sem retenção e o a recolher',
  JSON.stringify(c.totais.st) === JSON.stringify({ notas: 2, itens: 2, valor: 700, base: 500, icms: 60, retido: 35.5, semRetencao: 1, recolher: 25, semBase: 0, conferir: 0, fora: 0 }), c.totais.st);
const porNota = x => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !['doc', 'itens'].includes(k))));
chk('o totalizador por nota do diferencial: o valor, a base e o ICMS dos itens a 4% da nota e o DIFAL dela',
  porNota(c.diferencial[0]) === JSON.stringify({ difal: 195, valor: 1500, base: 1500, icms: 60 }), porNota(c.diferencial[0]));
chk('o totalizador por nota do ST: a de SP com a base e o ICMS da conta; a de GO, retida, sem base na conta e com o retido',
  porNota(c.st[0]) === JSON.stringify({ recolher: 25, valor: 500, base: 500, icms: 60, retido: 0 })
  && porNota(c.st[1]) === JSON.stringify({ recolher: 0, valor: 200, base: 0, icms: 0, retido: 35.5 }), [porNota(c.st[0]), porNota(c.st[1])]);
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

console.log('O ICMS-ST da ração:');
const PETS = [{ icms_base: 566.05, icms_valor: 67.93 }, { icms_base: 1900.27, icms_valor: 228.03 }, { icms_base: 398.66, icms_valor: 47.84 }];
chk('a nota de ração que a Thalia calculou (27/10/2026): três rações de SC a 12%, base 2.864,98 × 17% − ICMS 343,80 → ST 143,25, sem MVA',
  stDaNota(PETS) === 143.25);
chk('a ração de cavalo (2309.90.10, a da nota da Thalia) não é ração pet: fora da regra', regraDoItem(item(1, { ncm: '23099010' }), 'SC', [RACAO]) === null);
const daThalia = conferirEmpresa([nota('t', { emit_uf: 'SC' })], new Map([['t', [
  item(1, { ncm: '23099010', descricao: 'RACAO CAVALO', icms_aliquota: 12, icms_base: 5134.12, icms_valor: 616.09, valor_total: 13097.25 }),
  ...PETS.map((p, k) => item(k + 2, { ncm: '23091000', icms_aliquota: 12, valor_total: p.icms_base, ...p }))]]]), [RACAO], EMPRESA);
chk('a nota inteira: só as três rações pet no ST, 143,25 a recolher; nada no diferencial', daThalia.st[0].itens.length === 3 && daThalia.st[0].recolher === 143.25
  && daThalia.totais.st.recolher === 143.25 && daThalia.diferencial.length === 0, daThalia.totais.st);
chk('o totalizador da nota da Thalia: base 2.864,98 e ICMS 343,80 (a soma das três rações, sem somar à mão)',
  daThalia.st[0].base === 2864.98 && daThalia.st[0].icms === 343.8, [daThalia.st[0].base, daThalia.st[0].icms]);
chk('o item com o ST retido pelo fornecedor fica fora da conta', stRetido({ icms_st_valor: 5 }) && stDaNota([{ icms_base: 100, icms_valor: 12, icms_st_valor: 5 }]) === 0
  && stDaNota([{ icms_base: 100, icms_valor: 12, icms_st_valor: 5 }, { icms_base: 100, icms_valor: 12 }]) === 5);
const semBase = conferirEmpresa([nota('b', { emit_uf: 'SP' })], new Map([['b', [item(1, { ncm: '23091000', icms_aliquota: null, icms_base: null, icms_valor: 0, valor_total: 300 })]]]), [RACAO], EMPRESA);
chk('o item sem a base do ICMS (fornecedor do Simples) fica fora da conta e é contado pra conferir', stSemBase({ icms_base: null })
  && semBase.st[0].recolher === 0 && semBase.totais.st.semBase === 1 && semBase.semAliquota.length === 0);
chk('ICMS destacado acima dos 17%: nada a recolher, sem valor negativo', stDaNota([{ icms_base: 100, icms_valor: 20 }]) === 0);
const pet4 = conferirEmpresa([nota('p', { emit_uf: 'SP' })], new Map([['p', [item(1, { ncm: '23091000', icms_aliquota: 4, icms_base: 1000, icms_valor: 40, valor_total: 1000 })]]]), [RACAO], EMPRESA);
chk('a ração pet a 4% de SP vai só pro ST (17% de 1.000 − 40 = 130), sem o DIFAL em dobro', pet4.diferencial.length === 0 && pet4.st[0].recolher === 130);

console.log('Agrupar as notas por data e por fornecedor (pedido do Samuel):');
const ag = conferirEmpresa([
  nota('a1', { numero: '10', data_emissao: '2026-09-12', emit_nome: 'ZETA SA', emit_doc: '77000000000100' }),
  nota('a2', { numero: '11', data_emissao: '2026-09-05', emit_nome: 'ALFA SA', emit_doc: '88000000000100' }),
  nota('a3', { numero: '12', data_emissao: '2026-09-12', emit_nome: 'ALFA SA', emit_doc: '88.000.000/0001-00' }),
  nota('a4', { numero: '13', data_emissao: '2026-09-20', emit_nome: 'ÁGUA SEM CNPJ', emit_doc: null })
], new Map([['a1', [item(1, { icms_base: 0.05, valor_total: 0.05, icms_valor: 0 })]], ['a2', [item(1, { icms_base: 0.05, valor_total: 0.05, icms_valor: 0 }), item(2)]],
  ['a3', [item(1, { icms_base: 100.10, valor_total: 100.10, icms_valor: 4 })]], ['a4', [item(1, { icms_base: 200, valor_total: 200, icms_valor: 8 })]]]), [], EMPRESA);
const porData = agruparNotas(ag.diferencial, 'data');
chk('por data: na ordem das datas, as notas do mesmo dia juntas', JSON.stringify(porData.map(gr => [gr.chave, gr.notas.map(x => x.doc.numero)]))
  === JSON.stringify([['2026-09-05', ['11']], ['2026-09-12', ['10', '12']], ['2026-09-20', ['13']]]), porData.map(gr => [gr.chave, gr.notas.map(x => x.doc.numero)]));
const dia12 = porData[1].total;
chk('o subtotal do dia soma o DIFAL de cada nota (já arredondado), em centavos: 0,01 + 13,01 = 13,02', dia12.notas === 2 && dia12.itens === 2
  && dia12.difal === 13.02 && dia12.base === 100.15 && dia12.icms === 4 && dia12.valor === 100.15 && !('recolher' in dia12), dia12);
const porForn = agruparNotas(ag.diferencial, 'fornecedor');
chk('por fornecedor: o mesmo CNPJ com e sem pontuação é um fornecedor só, na ordem do nome; sem CNPJ, pelo nome', JSON.stringify(porForn.map(gr => [gr.doc.emit_nome, gr.notas.map(x => x.doc.numero)]))
  === JSON.stringify([['ÁGUA SEM CNPJ', ['13']], ['ALFA SA', ['11', '12']], ['ZETA SA', ['10']]]), porForn.map(gr => [gr.doc.emit_nome, gr.notas.map(x => x.doc.numero)]));
chk('o subtotal do fornecedor: 3 itens, o DIFAL de 130,01 + 13,01', porForn[1].total.itens === 3 && porForn[1].total.difal === 143.02, porForn[1].total);
const stAg = agruparNotas(conferirEmpresa([nota('s1', { emit_uf: 'SP' }), nota('s2', { emit_uf: 'SP', numero: '101' })],
  new Map([['s1', [item(1, { ncm: '23091000', icms_aliquota: 12, icms_base: 500, icms_valor: 60 })]], ['s2', [item(1, { ncm: '23091000', icms_aliquota: 12, icms_base: 250, icms_valor: 30, icms_st_valor: 7.5 })]]]),
  [RACAO], EMPRESA).st, 'fornecedor');
chk('no ST, o subtotal leva o retido e o a recolher', stAg.length === 1 && stAg[0].total.recolher === 25 && stAg[0].total.retido === 7.5 && !('difal' in stAg[0].total), stAg[0] && stAg[0].total);
chk('sem notas, nenhum grupo', agruparNotas([], 'data').length === 0 && agruparNotas(null, 'fornecedor').length === 0);

console.log('Os nomes: a ração de cão e gato com o NCM 2309.90.10 (pedido da Thalia e do Samuel, 28/10/2026):');
const PET = { ...RACAO, nomes_entram: ['CÃO', 'CÃES', 'GATO', 'CAT', 'GRAN NATURE', 'G. N.', 'SOFT C.'], nomes_fora: ['CAVALO', 'EQUINO', 'EQUIMIL', 'BEZERRO', 'TERNERON', 'PEIXE', 'PÁSSARO'] };
chk('a palavra no começo de uma palavra do nome: o plural e o acento entram', nomeTem('RACAO GATOS ADULTOS', 'GATO') && nomeTem('RAÇÃO CÃES 15KG', 'CAES') && nomeTem('RACAO CAES', 'CÃES'));
chk('a palavra de até 3 letras, só inteira: CAT não pega CATARINENSE; CÃO não pega CAOS', !nomeTem('RACAO CATARINENSE BOVINOS', 'CAT') && nomeTem('PREMIUM CAT 10KG', 'CAT') && !nomeTem('CAOS', 'CÃO'));
chk('o trecho em sequência, sem a pontuação: GRAN NATURE, G. N. e SOFT C.', nomeTem('GRAN NATURE ADULTOS 15 KG', 'GRAN NATURE') && nomeTem('G. N. ADULTO XTREME SUP. PREM. 15 KG', 'G. N.')
  && nomeTem('SOFT C. PREMIUM FRANGO E ARROZ 10,1 KG', 'SOFT C.') && !nomeTem('GRAN PLUS NATURE', 'GRAN NATURE') && !nomeTem('500 G NUTRI', 'G. N.'));
chk('a lista digitada: vírgula, ponto e vírgula ou linha, sem repetir (maiúscula e acento não contam), em maiúsculas como os nomes das notas',
  JSON.stringify(lerNomes('cão, gato; GRAN NATURE\nG. N.,  CAO , Gato,,')) === JSON.stringify(['CÃO', 'GATO', 'GRAN NATURE', 'G. N.']), lerNomes('cão, gato; GRAN NATURE\nG. N.,  CAO , Gato,,'));
const cl = (descricao, ncm = '23099010', uf = 'SC', regras = [PET]) => classificarItem({ ncm, descricao }, uf, regras);
chk('o NCM da regra entra direto, sem olhar o nome', cl('EQUIMIL', '23091000').como === 'ncm');
chk('2309.90.10 com cão ou gato no nome: entra, dizendo a palavra', cl('RACAO CAES ADULTOS ZIGDOG CARNE PREMIUM').como === 'nome' && cl('RACAO CAES ADULTOS').palavra === 'CÃES'
  && cl('GRAN NATURE GATOS CASTRADOS SALMAO 10,1 KG').como === 'nome');
chk('pela marca: GRAN NATURE, G. N. e SOFT C. entram', ['GRAN NATURE ADULTOS 15 KG', 'G. N. ADULTO XTREME SUP. PREM. 15 KG', 'SOFT C. PREMIUM FRANGO E ARROZ 10,1 KG'].every(d => cl(d).como === 'nome'));
chk('cavalo e bezerro ficam fora, dizendo a palavra', cl('EQUIMIL WL SC/40KG').como === 'fora' && cl('EQUIMIL WL SC/40KG').palavra === 'EQUIMIL' && cl('TERNERON 10KG').como === 'fora');
chk('com as duas palavras, entra: o "sabor peixe" da ração de gato', cl('RACAO GATOS ADULTOS SABOR PEIXE').como === 'nome' && cl('RACAO PEIXES ORNAMENTAIS').como === 'fora');
chk('sem palavra de nenhuma lista: a conferir', cl('MARCA NOVA ADULTOS 15 KG').como === 'conferir' && cl('MARCA NOVA ADULTOS 15 KG').regra === PET);
chk('de estado fora da regra ou de outra posição do NCM: sem regra', cl('RACAO GATOS', '23099010', 'PR') === null && cl('RACAO GATOS', '23011000') === null
  && cl('RACAO GATOS', '') === null);
chk('a regra com o NCM de 4 dígitos pega a posição toda direto, sem os nomes', cl('EQUIMIL', '23099010', 'SC', [{ ...PET, ncm: '2309' }]).como === 'ncm');
const nm = conferirEmpresa([nota('p1', { numero: '601' }), nota('p2', { numero: '602', data_emissao: '2026-09-11' })], new Map([
  ['p1', [item(1, { ncm: '23099010', descricao: 'RACAO GATOS ADULTOS', icms_aliquota: 12, icms_base: 1000, icms_valor: 120, valor_total: 1000 }),
          item(2, { ncm: '23099010', descricao: 'EQUIMIL WL SC/40KG', icms_aliquota: 12, icms_base: 2000, icms_valor: 240, valor_total: 2000 }),
          item(3, { ncm: '23099010', descricao: 'MARCA NOVA ADULTOS 15 KG', icms_aliquota: 12, icms_base: 300, icms_valor: 36, valor_total: 300 })]],
  ['p2', [item(1, { ncm: '23099010', descricao: 'RACAO BEZERRO', icms_aliquota: 4, icms_base: 500, icms_valor: 20, valor_total: 500 }),
          item(2, { ncm: '23099010', descricao: 'MARCA NOVA FILHOTES', icms_aliquota: 4, icms_base: 100, icms_valor: 4, valor_total: 100 })]]
]), [PET], EMPRESA);
chk('na empresa: a de gato no ST (17% de 1.000 − 120 = 50), dizendo como entrou', nm.st.length === 1 && nm.st[0].itens.length === 1 && nm.st[0].recolher === 50
  && nm.st[0].itens[0].como === 'nome' && nm.st[0].itens[0].palavra === 'GATO', nm.st.map(x => [x.recolher, x.itens.map(i => i.como + ':' + i.palavra)]));
chk('a sem palavra fica a conferir, fora das duas contas, mesmo a 4%', nm.conferir.length === 2 && nm.conferir.map(x => x.itens.map(i => i.n_item).join()).join('|') === '3|2'
  && nm.totais.st.conferir === 2 && !nm.diferencial.some(x => x.itens.some(i => /MARCA NOVA/.test(i.descricao))), nm.conferir.map(x => x.itens.map(i => i.descricao)));
chk('a que o nome tirou da regra segue como qualquer item: a de bezerro a 4% vai pro DIFAL (13% de 500 = 65); o cavalo, a 12%, em nenhuma',
  nm.diferencial.length === 1 && nm.diferencial[0].difal === 65 && nm.fora.length === 2 && nm.totais.st.fora === 2
  && nm.fora[0].itens[0].palavra === 'EQUIMIL', [nm.diferencial.map(x => x.difal), nm.fora.map(x => x.itens.map(i => i.palavra))]);
chk('a empresa só com item a conferir aparece na conferência', situacaoDaEmpresa(conferirEmpresa([nota('q')], new Map([['q', [item(1, { ncm: '23099010', descricao: 'MARCA NOVA', icms_aliquota: 12 })]]]), [PET], EMPRESA), true) === 'a_conferir');
// as três notas da Thalia (28/10/2026, valores das notas; nomes dos produtos, sem fornecedor): R$ 88,16 + 87,71 + 7,38 = 183,25
const tres = conferirEmpresa([nota('t1', { numero: '1' }), nota('t2', { numero: '2' }), nota('t3', { numero: '3' })], new Map([
  ['t1', [item(1, { ncm: '23099010', descricao: 'RACAO CAES ADULTOS ZIGDOG CARNE PREMIUM 21% - 25 KG', icms_aliquota: 12, icms_base: 987.84, icms_valor: 118.54 }),
          item(2, { ncm: '23099010', descricao: 'RACAO GATOS ADULTOS DUNKO CARNE E FRANGO 26% - 25 KG', icms_aliquota: 12, icms_base: 775.38, icms_valor: 93.05 })]],
  ['t2', [item(1, { ncm: '23099010', descricao: 'GRAN NATURE ADULTOS 15 KG', icms_aliquota: 12, icms_base: 415.5, icms_valor: 49.86 }),
          item(2, { ncm: '23099010', descricao: 'GRAN NATURE GATOS CASTRADOS SALMAO 10,1 KG', icms_aliquota: 12, icms_base: 424, icms_valor: 50.88 }),
          item(3, { ncm: '23099010', descricao: 'SOFT C. PREMIUM FRANGO E ARROZ 10,1 KG', icms_aliquota: 12, icms_base: 277.3, icms_valor: 33.28 }),
          item(4, { ncm: '23099010', descricao: 'G. N. ADULTO XTREME SUP. PREM. 15 KG', icms_aliquota: 12, icms_base: 637.5, icms_valor: 76.5 })]],
  ['t3', [item(1, { ncm: '23099010', descricao: 'GRAN NATURE ADULTOS 15 KG', cfop: '6910', icms_aliquota: 12, icms_base: 41.55, icms_valor: 4.99 }),
          item(2, { ncm: '23099010', descricao: 'GRAN NATURE GATOS CASTRADOS SALMAO 10,1 KG', cfop: '6910', icms_aliquota: 12, icms_base: 42.4, icms_valor: 5.09 }),
          item(3, { ncm: '23099010', descricao: 'G. N. ADULTO XTREME SUP. PREM. 15 KG', cfop: '6910', icms_aliquota: 12, icms_base: 63.75, icms_valor: 7.65 })]]
]), [PET], EMPRESA);
chk('as três notas da Thalia, com a bonificação: 88,16 + 87,71 + 7,38 = 183,25, tudo pelo nome', tres.st.map(x => x.recolher).join('|') === '88.16|87.71|7.38'
  && tres.totais.st.recolher === 183.25 && tres.conferir.length === 0, [tres.st.map(x => x.recolher), tres.totais.st.recolher]);

console.log('A situação e o mês:');
chk('sem notas no mês, com algo a conferir, nada', situacaoDaEmpresa(c, false) === 'sem_notas' && situacaoDaEmpresa(c, true) === 'a_conferir'
  && situacaoDaEmpresa(conferirEmpresa([], new Map(), [], EMPRESA), true) === 'nada');
chk('o mês anterior (em janeiro, dezembro do ano anterior)', mesAnterior('2026-10-27') === '2026-09' && mesAnterior('2027-01-05') === '2026-12' && mesAnterior('') === null);
chk('os limites do mês, com o fevereiro bissexto', JSON.stringify(limitesDoMes('2028-02')) === JSON.stringify({ de: '2028-02-01', ate: '2028-02-29' })
  && limitesDoMes('2026-09').ate === '2026-09-30' && limitesDoMes('2026-13') === null);
chk('o rótulo do mês', rotuloDoMes('2026-09') === '09/2026' && rotuloDoMes('x') === '');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
