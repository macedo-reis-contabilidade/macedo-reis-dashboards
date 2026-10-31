// O honorário adicional anual (31/10/2026): a lista empresa por empresa e a venda pro Conta Azul — as regras puras de
// assets/js/adicional-anual.js. Os nomes e os ids são de mentira (o repositório é público).
// Rodar com: node tests/adicional-anual.test.mjs
import {
  TIPO, CATEGORIA, ultimoDia, mesBR, maisUmMes, proximoDiaUtil, mesesNoAno, proporcional, numeroDaVenda, parcelaNormal,
  vencimentoSugerido, montarLista, resumoDaLista, modeloDaVenda, vendaParaApi, limparItem, extraDoAdicional, comExtra, semExtra,
  temExtra, tarefaDasNotas, MAX_POR_LOTE
} from '../assets/js/adicional-anual.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const U = n => '9a000000-0000-4000-8000-' + String(n).padStart(12, '0');

console.log('As contas de data e de valor:');
chk('o último dia da competência (a data da venda), com o fevereiro bissexto', ultimoDia('2026-10') === '2026-10-31' && ultimoDia('2026-02') === '2026-02-28' && ultimoDia('2028-02') === '2028-02-29' && ultimoDia('2026-11') === '2026-11-30');
chk('o mês por extenso curto', mesBR('2026-10') === '10/2026');
chk('o mesmo dia no mês seguinte: o 31 vira o último dia; dezembro vira janeiro', maisUmMes('2026-01-31') === '2026-02-28' && maisUmMes('2026-12-15') === '2027-01-15' && maisUmMes('2026-10-13') === '2026-11-13');
chk('o próximo dia útil: sábado, domingo e o feriado de 15/11 pulam', proximoDiaUtil('2026-11-14') === '2026-11-16' && proximoDiaUtil('2026-11-13') === '2026-11-13' && proximoDiaUtil('2026-12-25') === '2026-12-28');
chk('os meses do ano: com mensalidade em dezembro do ano anterior, 12; em março, 10; em setembro, 4; sem nada, 12',
  mesesNoAno('2025-12', 2026) === 12 && mesesNoAno('2026-01', 2026) === 12 && mesesNoAno('2026-03', 2026) === 10 && mesesNoAno('2026-09', 2026) === 4 && mesesNoAno(null, 2026) === 12);
chk('o proporcional ao centavo: 4/12 de 550, 8/12 de 1.000, 9/12 de 550', proporcional(550, 4) === 183.33 && proporcional(1000, 8) === 666.67 && proporcional(550, 9) === 412.5 && proporcional(580, 12) === 580);
chk('o número da venda e a parcela na descrição do Conta Azul', numeroDaVenda('2/3 - Venda 190419206 2/3') === 190419206 && numeroDaVenda('Venda 190421360 / NFS-e:1094 - RPS:1094') === 190421360 && numeroDaVenda('Venda') === null);

console.log('A parcela do Conta Azul, da API e do espelho, no mesmo formato:');
const daApi = parcelaNormal({ descricao: '1/3 - Venda 190419206 1/3', data_vencimento: '2027-08-11', data_competencia: '2025-10-31', total: 235.5,
  categorias: [{ id: U(900), nome: 'HONORÁRIO ADICIONAL ANUAL' }], cliente: { id: U(1), nome: 'LOJA DO PAULO LTDA' } });
chk('da API (cliente, categorias): a pessoa, a competência, o adicional, a parcela 1 de 3',
  daApi.pessoa === U(1) && daApi.competencia === '2025-10' && daApi.adicional && !daApi.mensal && daApi.valor === 235.5 && daApi.numero === 190419206 && J(daApi.parcela) === J({ n: 1, de: 3 }));
const doEspelho = parcelaNormal({ fornecedor_cliente_id: U(2), fornecedor_cliente_nome: 'MERCEARIA DA ANA', data_competencia: '2026-10-30', data_vencimento: '2026-11-10', total: '580.00',
  descricao: 'Venda 190421360 / NFS-e:1094 - RPS:1094', categorias: [{ nome: 'HONORÁRIOS MENSAIS' }] });
chk('do espelho (fornecedor_cliente_id, total em texto): a mensalidade', doEspelho.pessoa === U(2) && doEspelho.mensal && !doEspelho.mei && doEspelho.valor === 580 && doEspelho.vencimento === '2026-11-10');

console.log('O vencimento sugerido:');
const hoje = '2026-10-31';
chk('com o boleto da competência (a emitir), o dele: o adicional vai no mesmo boleto', J(vencimentoSugerido({ boleto: '2026-11-10', mensal: '2026-11-11', hoje })) === J({ data: '2026-11-10', de: 'boleto' }));
chk('sem o boleto, o da mensalidade no Conta Azul', J(vencimentoSugerido({ mensal: '2026-11-10', hoje })) === J({ data: '2026-11-10', de: 'mensalidade' }));
chk('a mensalidade que venceu dentro do mês: o mesmo dia no mês seguinte', J(vencimentoSugerido({ mensal: '2026-10-13', hoje })) === J({ data: '2026-11-13', de: 'mensalidade_ajustada', antes: '2026-10-13' }));
chk('… e no dia útil (14/11/2026 é sábado; 15/11, domingo e feriado)', vencimentoSugerido({ mensal: '2026-10-14', hoje }).data === '2026-11-16');
chk('o boleto vencido não manda; sem nada, sem vencimento', vencimentoSugerido({ boleto: '2026-10-20', mensal: '2026-11-10', hoje }).data === '2026-11-10' && vencimentoSugerido({ hoje }).data === null);

console.log('A lista, empresa por empresa:');
const P = (pessoa, nome, comp, valor, cat, extra = {}) => parcelaNormal({ cliente: { id: pessoa, nome }, data_competencia: comp + '-28', data_vencimento: extra.venc || null, total: valor,
  descricao: extra.desc || 'Venda ' + (extra.numero || 190000000), categorias: [{ nome: cat }] });
const M = 'HONORÁRIOS MENSAIS', MEI = 'MEI - CONTRATOS', A = CATEGORIA;
const mensais = [
  // a que pagou o ano passado: mensalidade o ano todo, reajustada (530 → 580)
  P(U(1), 'LOJA DO PAULO LTDA', '2025-10', 530, M), P(U(1), 'LOJA DO PAULO LTDA', '2025-12', 530, M), P(U(1), 'LOJA DO PAULO LTDA', '2026-10', 580, M, { venc: '2026-11-10', numero: 190421360 }),
  // a nova: primeira mensalidade em setembro de 2026
  P(U(2), 'PADARIA NOVA LTDA', '2026-09', 550, M), P(U(2), 'PADARIA NOVA LTDA', '2026-10', 550, M, { venc: '2026-11-28' }),
  // a isenta: tinha mensalidade em outubro passado e não pagou
  P(U(3), 'OFICINA ISENTA LTDA', '2025-10', 400, M), P(U(3), 'OFICINA ISENTA LTDA', '2025-12', 400, M), P(U(3), 'OFICINA ISENTA LTDA', '2026-10', 450, M, { venc: '2026-11-10' }),
  // o MEI
  P(U(4), 'JOAO MEI', '2025-10', 75, MEI), P(U(4), 'JOAO MEI', '2026-10', 80, MEI, { venc: '2026-11-10' }),
  // a que era MEI no ano passado e agora é ME: o ano inteiro
  P(U(5), 'CAMILA ME LTDA', '2025-10', 150, MEI), P(U(5), 'CAMILA ME LTDA', '2025-12', 150, MEI), P(U(5), 'CAMILA ME LTDA', '2026-10', 550, M, { venc: '2026-11-10' }),
  // a que vence dentro do mês: o adicional vai pro mês seguinte
  P(U(6), 'ASSOCIACAO DO BAIRRO', '2025-10', 275, M), P(U(6), 'ASSOCIACAO DO BAIRRO', '2025-12', 275, M), P(U(6), 'ASSOCIACAO DO BAIRRO', '2026-10', 300, M, { venc: '2026-10-13' }),
  // as lançadas: pelo sistema e por fora
  P(U(7), 'LANCADA PELO SISTEMA LTDA', '2025-12', 500, M), P(U(7), 'LANCADA PELO SISTEMA LTDA', '2026-10', 500, M, { venc: '2026-11-10' }),
  P(U(8), 'LANCADA A MAO LTDA', '2025-12', 700, M), P(U(8), 'LANCADA A MAO LTDA', '2026-10', 700, M, { venc: '2026-11-10' }),
  // com boleto na grade
  P(U(9), 'COM BOLETO LTDA', '2025-10', 600, M), P(U(9), 'COM BOLETO LTDA', '2025-12', 600, M), P(U(9), 'COM BOLETO LTDA', '2026-10', 600, M, { venc: '2026-11-11' })
];
const adicionais = [
  P(U(1), 'LOJA DO PAULO LTDA', '2025-10', 530, A), P(U(1), 'LOJA DO PAULO LTDA', '2024-10', 510, A), P(U(1), 'LOJA DO PAULO LTDA', '2023-10', 255, A, { desc: '1/2 - Venda 1' }), P(U(1), 'LOJA DO PAULO LTDA', '2023-10', 255, A, { desc: '2/2 - Venda 1' }),
  P(U(6), 'ASSOCIACAO DO BAIRRO', '2025-10', 275, A),
  P(U(9), 'COM BOLETO LTDA', '2025-10', 600, A),
  // pagou no lote do ano passado e saiu: sem mensalidade agora
  P(U(10), 'SAIU DA CARTEIRA LTDA', '2025-10', 900, A),
  // pagou o proporcional ao sair no meio do ano: só no histórico, fora da lista
  P(U(11), 'SAIU EM SETEMBRO LTDA', '2025-09', 333.33, A),
  // lançada à mão nesta competência
  P(U(8), 'LANCADA A MAO LTDA', '2026-10', 700, A, { numero: 190421400 }),
  P(U(7), 'LANCADA PELO SISTEMA LTDA', '2025-10', 480, A)
];
const lancadas = [{ id: U(507), ca_cliente_id: U(7), cliente_nome: 'LANCADA PELO SISTEMA LTDA', valor: 500, vencimento: '2026-11-10', ca_venda_numero: 190421460, situacao: 'lancada', cliente_id: U(107) },
  { id: U(508), ca_cliente_id: U(12), cliente_nome: 'APAGADA LTDA', valor: 100, vencimento: '2026-11-10', situacao: 'excluida' }];
const clientes = new Map([[U(7), { id: U(107), nome: 'LANCADA PELO SISTEMA LTDA' }], [U(9), { id: U(109), nome: 'COM BOLETO LTDA' }], [U(1), { id: U(101), nome: 'LOJA DO PAULO LTDA' }]]);
const boletos = new Map([[U(109), { id: U(209), vencimento: '2026-11-09', status: 'a_emitir', itens_extras: [] }],
  [U(107), { id: U(207), vencimento: '2026-11-10', status: 'a_emitir', itens_extras: [{ adicional_id: U(507), descricao: 'Honorário adicional anual', valor: 500 }] }],
  [U(101), { id: U(201), vencimento: '2026-11-10', status: 'pago', itens_extras: [] }]]);
const { itens, anos, resumo } = montarLista({ competencia: '2026-10', hoje, mensais, adicionais, lancadas, clientes, boletos });
const de = p => itens.find(i => i.pessoa === p);
chk('os anos do histórico: os três anteriores', J(anos) === J([2023, 2024, 2025]));
const paulo = de(U(1));
chk('pagou o ano passado: marcada, a mensalidade de agora (o reajuste entra sozinho), o ano inteiro',
  paulo.grupo === 'sugerida' && paulo.marcada && paulo.valor === 580 && paulo.meses === 12 && paulo.vencimento === '2026-11-10' && paulo.vencimento_de === 'mensalidade', J(paulo));
chk('… o histórico dos três anos, com o parcelado de 2023 somado', J(paulo.historico) === J({ 2023: { valor: 510, parcelas: 2 }, 2024: { valor: 510, parcelas: 1 }, 2025: { valor: 530, parcelas: 1 } }), J(paulo.historico));
chk('… o boleto pago não dá o vencimento (não recebe o extra)', paulo.boleto && paulo.boleto.status === 'pago' && paulo.vencimento_de === 'mensalidade');
const nova = de(U(2));
chk('a nova: marcada, proporcional pela primeira mensalidade do ano (setembro: 4/12)', nova.grupo === 'nova' && nova.marcada && nova.meses === 4 && nova.valor === 183.33 && /09\/2026: 4\/12/.test(nova.motivo), J(nova));
const isenta = de(U(3));
chk('a isenta: tinha mensalidade em 10/2025 e não pagou — desmarcada, com o valor pronto se marcar', isenta.grupo === 'isenta' && !isenta.marcada && isenta.valor === 450 && isenta.historico[2025].isento && isenta.historico[2025].mensal === 400, J(isenta));
const mei = de(U(4));
chk('o contrato MEI: desmarcado, no grupo dele', mei.grupo === 'mei' && !mei.marcada && mei.historico[2025].mei && !mei.historico[2025].isento);
const camila = de(U(5));
chk('era MEI no ano passado e agora é ME: nova, o ano inteiro (tinha mensalidade em dezembro)', camila.grupo === 'nova' && camila.marcada && camila.meses === 12 && camila.valor === 550, J(camila));
const assoc = de(U(6));
chk('a mensalidade que venceu dentro do mês: o adicional vence no mesmo dia do mês seguinte', assoc.grupo === 'sugerida' && assoc.vencimento === '2026-11-13' && assoc.vencimento_de === 'mensalidade_ajustada' && assoc.vencimento_antes === '2026-10-13');
const sis = de(U(7));
chk('lançada pelo sistema: no grupo das lançadas, com o número e o extra já no boleto', sis.grupo === 'lancada' && !sis.marcada && sis.lancada.de === 'sistema' && sis.lancada.numero === 190421460 && sis.lancada.no_boleto && sis.valor === 500, J(sis));
const mao = de(U(8));
chk('lançada à mão no Conta Azul: também lançada (não lança de novo)', mao.grupo === 'lancada' && mao.lancada.de === 'conta_azul' && mao.lancada.numero === 190421400 && !mao.lancada.no_boleto);
const bol = de(U(9));
chk('com o boleto da competência a emitir: o vencimento é o do boleto', bol.grupo === 'sugerida' && bol.vencimento === '2026-11-09' && bol.vencimento_de === 'boleto' && bol.boleto.id === U(209) && bol.cliente_id === U(109));
const saiu = de(U(10));
chk('pagou no lote do ano passado e não tem mensalidade agora: desmarcada, com o valor do ano passado', saiu.grupo === 'sem_mensal' && !saiu.marcada && saiu.valor === 900);
chk('quem só pagou o proporcional ao sair no meio do ano fica fora da lista; a excluída também', !de(U(11)) && !de(U(12)));
chk('a ordem: os grupos (pagaram, novas, isentas, sem mensalidade, MEI, lançadas) e o nome',
  J(itens.map(i => i.grupo)) === J(['sugerida', 'sugerida', 'sugerida', 'nova', 'nova', 'isenta', 'sem_mensal', 'mei', 'lancada', 'lancada']), J(itens.map(i => i.grupo + ':' + i.nome)));
chk('o resumo: as marcadas e o total delas (580 + 300 + 600 + 183,33 + 550)', resumo.marcadas === 5 && resumo.valor === 2213.33 && resumo.grupos.lancada === 2 && resumo.grupos.isenta === 1 && resumo.total === 10, J(resumo));
chk('o resumo ignora a marcada sem valor', resumoDaLista([{ grupo: 'nova', marcada: true, valor: null }, { grupo: 'nova', marcada: true, valor: 10 }]).valor === 10);
let deuErro = false;
try { montarLista({ competencia: '10/2026', hoje }); } catch (e) { deuErro = true; }
chk('competência fora do formato: erro', deuErro);

console.log('A venda modelo e a venda pra API:');
const detalhe = { cliente: { uuid: U(1), nome: 'LOJA DO PAULO LTDA' }, vendedor: { id: U(301), nome: 'Contador' },
  venda: { id: U(401), numero: 190419223, data_compromisso: '2025-10-31', id_categoria: U(900), id_centro_custo: null,
    condicao_pagamento: { tipo_pagamento: null, id_conta_financeira: U(302), opcao_condicao_pagamento: '1x', parcelas: [{ valor: 530, data_vencimento: '2025-11-11' }] } } };
const itensVenda = { itens: [{ id: U(402), id_item: U(303), nome: 'HONORÁRIO ADICIONAL ANUAL', tipo: 'SERVICO', quantidade: 1, valor: 530 }] };
const modelo = modeloDaVenda(detalhe, itensVenda);
chk('a modelo: a categoria, o serviço (o id do item, não o da linha), a conta e o vendedor', J(modelo) === J({ numero: 190419223, data: '2025-10-31', cliente: 'LOJA DO PAULO LTDA', id_categoria: U(900), id_centro_custo: null,
  id_vendedor: U(301), vendedor: 'Contador', id_conta_financeira: U(302), tipo_pagamento: null, id_servico: U(303), servico: 'HONORÁRIO ADICIONAL ANUAL' }), J(modelo));
chk('sem a categoria, ou com mais de um serviço, ou com produto: não serve de modelo',
  modeloDaVenda({ ...detalhe, venda: { ...detalhe.venda, id_categoria: null } }, itensVenda) === null
  && modeloDaVenda(detalhe, { itens: [...itensVenda.itens, { ...itensVenda.itens[0], id_item: U(304) }] }) === null
  && modeloDaVenda(detalhe, { itens: [{ ...itensVenda.itens[0], tipo: 'PRODUTO' }] }) === null);
const venda = vendaParaApi({ modelo, pessoa: U(1), valor: 580, vencimento: '2026-11-10', numero: 190421459, dataVenda: '2026-10-31' });
chk('a venda: aprovada, no último dia da competência, 1x, com o serviço e a conta da modelo — sem centro de custo nem tipo de pagamento vazios',
  J(venda) === J({ id_cliente: U(1), numero: 190421459, situacao: 'APROVADO', data_venda: '2026-10-31', id_categoria: U(900), id_vendedor: U(301),
    itens: [{ id: U(303), quantidade: 1, valor: 580 }], condicao_pagamento: { id_conta_financeira: U(302), opcao_condicao_pagamento: '1x', parcelas: [{ data_vencimento: '2026-11-10', valor: 580 }] } }), J(venda));
chk('o valor vai ao centavo', vendaParaApi({ modelo, pessoa: U(1), valor: 183.333, vencimento: '2026-11-10', numero: 1, dataVenda: '2026-10-31' }).itens[0].valor === 183.33);

console.log('O item que a tela manda:');
chk('o item certo passa limpo', J(limparItem({ pessoa: U(1), valor: '580', vencimento: '2026-11-10', nome: '  LOJA   DO PAULO ', cliente_id: U(101) }, { hoje }))
  === J({ pessoa: U(1), valor: 580, vencimento: '2026-11-10', nome: 'LOJA DO PAULO', cliente_id: U(101) }));
chk('pessoa inválida, valor zero, acima do teto, vencimento passado ou inválido: o motivo',
  /inválida/.test(limparItem({ pessoa: 'x', valor: 1, vencimento: '2026-11-10' }, { hoje }).erro) && /maior que zero/.test(limparItem({ pessoa: U(1), valor: 0, vencimento: '2026-11-10' }, { hoje }).erro)
  && /100\.000/.test(limparItem({ pessoa: U(1), valor: 100000.01, vencimento: '2026-11-10' }, { hoje }).erro) && /já passou/.test(limparItem({ pessoa: U(1), valor: 1, vencimento: '2026-10-30' }, { hoje }).erro)
  && /inválido/.test(limparItem({ pessoa: U(1), valor: 1, vencimento: '2026-02-30' }, { hoje }).erro));
chk('a empresa do cadastro que não é id fica nula', limparItem({ pessoa: U(1), valor: 1, vencimento: hoje, cliente_id: 'abc' }, { hoje }).cliente_id === null);
chk('o lote: até 20 por chamada', MAX_POR_LOTE === 20 && TIPO === 'adicional_anual');

console.log('O item extra do boleto:');
const ex = extraDoAdicional({ id: U(507), valor: 500, ca_venda_numero: 190421460 });
chk('o extra: liga à venda lançada, com o número na descrição', J(ex) === J({ adicional_id: U(507), descricao: 'Honorário adicional anual (venda 190421460)', valor: 500 }));
const fat = { faturavel_id: U(600), descricao: 'Abertura de filial', valor: 300 };
chk('pôr não duplica e não mexe nos faturáveis; tirar só o do adicional', J(comExtra([fat, ex], ex)) === J([fat, ex]) && J(comExtra([fat], ex)) === J([fat, ex])
  && J(semExtra([fat, ex], U(507))) === J([fat]) && temExtra([fat, ex], U(507)) && !temExtra([fat], U(507)) && J(comExtra(null, ex)) === J([ex]));

console.log('A tarefa das NFS-e (a Thalia emite no Conta Azul):');
const t = tarefaDasNotas({ competencia: '2026-10', vendas: [{ nome: 'ZETA LTDA', numero: 2, valor: 1234.5 }, { nome: 'ALFA LTDA', numero: 1, valor: 580 }, { nome: 'SEM NUMERO', numero: null, valor: 1 }] });
chk('o título com a competência e uma linha ☐ por venda, pelo nome', t.titulo === 'Emitir as NFS-e do honorário adicional anual (10/2026)'
  && /\n☐ ALFA LTDA — venda 1 — R\$ 580,00\n☐ ZETA LTDA — venda 2 — R\$ 1\.234,50$/.test(t.descricao) && !/SEM NUMERO/.test(t.descricao) && /o mesmo de 2025/.test(t.descricao), t.descricao);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
