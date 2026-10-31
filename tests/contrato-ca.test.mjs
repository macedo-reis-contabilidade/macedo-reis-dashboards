// Testes de assets/js/contrato-ca.js — o contrato da mensalidade no Conta Azul (31/10/2026): o padrão dos contratos de
// setembro de 2026, o que o sistema sugere (o valor, o dia, o início), o pedido limpo e o corpo do cadastro e do contrato.
import {
  DIA_EMISSAO, DIAS_ATE_O_FIM, primeiroVencimento, fimDoContrato, inicioDoContrato, contratoSugerido, limparPedido,
  enderecoDaEmpresa, pessoaParaApi, vendedorDoSocio, contratoParaApi, resumoDoContrato, mesBR
} from '../assets/js/contrato-ca.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const ID = '9b000000-0000-4000-8000-000000000001';

console.log('As datas do contrato:');
chk('a venda no dia 31 e o fim 335 dias depois do início (o padrão dos de setembro)', DIA_EMISSAO === 31 && DIAS_ATE_O_FIM === 335);
chk('os de setembro de 2026 acabam em 02/08/2027; os de outubro, em 01/09/2027', fimDoContrato('2026-09') === '2027-08-02' && fimDoContrato('2026-10') === '2027-09-01');
chk('a primeira mensalidade vence no mês seguinte ao do início, no dia do contrato', primeiroVencimento('2026-10', 10) === '2026-11-10' && primeiroVencimento('2026-10', 15) === '2026-11-15');
chk('na virada do ano', primeiroVencimento('2026-12', 25) === '2027-01-25');
chk('o dia 31 em fevereiro vira o último dia do mês', primeiroVencimento('2027-01', 31) === '2027-02-28' && primeiroVencimento('2027-12', 31) === '2028-01-31');
chk('o mês por escrito', mesBR('2026-10') === '10/2026');

console.log('O mês de início:');
chk('o da entrada na carteira', inicioDoContrato('2026-10-01', '2026-10-31') === '2026-10');
chk('nunca antes do mês passado (o Conta Azul emitiria de uma vez os meses pra trás)', inicioDoContrato('2026-07-01', '2026-10-31') === '2026-09');
chk('nem depois do mês que vem', inicioDoContrato('2027-03-01', '2026-10-31') === '2026-11');
chk('sem a entrada, o mês de hoje', inicioDoContrato(null, '2026-10-31') === '2026-10' && inicioDoContrato('', '2026-10-31') === '2026-10');
chk('na virada do ano: dezembro em janeiro vale', inicioDoContrato('2026-12-15', '2027-01-05') === '2026-12' && inicioDoContrato('2026-11-15', '2027-01-05') === '2026-12');

console.log('O que o sistema sugere:');
{
  const cad = { documento: '30.303.030/0001-30' };
  const s = contratoSugerido({ cadastro: cad, base: { valor_base: 1500, dia_vencimento: 10, ativo: true }, proposta: null, entrada: '2026-10-01', hoje: '2026-10-31' });
  chk('a base de cobrança: o valor, o dia, a conta do Inter; a partir da entrada',
    J(s) === J({ valor: 1500, dia: 10, inicio: '2026-10', primeiro_vencimento: '2026-11-10', data_fim: '2027-09-01', conta: 'inter', de: { valor: 'base', dia: 'base', inicio: 'carteira' }, faltam: [] }), J(s));
  const p = contratoSugerido({ cadastro: cad, base: { valor_base: 450, dia_vencimento: 15, ativo: true }, proposta: { honorario: 750 }, entrada: '2026-10-01', hoje: '2026-10-31' });
  chk('a proposta fechada vale mais que a base (o valor); o dia segue o da base', p.valor === 750 && p.de.valor === 'proposta' && p.dia === 15);
  const sem = contratoSugerido({ cadastro: { documento: '' }, base: null, proposta: null, entrada: null, hoje: '2026-10-31' });
  chk('sem nada: falta o valor e o documento; o dia 10 e o mês de hoje', sem.valor === null && sem.faltam.length === 2 && sem.dia === 10 && sem.de.dia === 'padrao' && sem.inicio === '2026-10' && sem.de.inicio === 'hoje', J(sem));
  const inativa = contratoSugerido({ cadastro: cad, base: { valor_base: 500, dia_vencimento: 40, ativo: false }, entrada: '2026-10-01', hoje: '2026-10-31' });
  chk('a base parada: a conta é a do modelo; o dia fora de 1 a 31 vira 10', inativa.conta === 'modelo' && inativa.dia === 10 && inativa.de.dia === 'padrao');
  chk('o CPF também serve', contratoSugerido({ cadastro: { documento: '123.456.789-09' }, base: { valor_base: 100, dia_vencimento: 5, ativo: true }, hoje: '2026-10-31' }).faltam.length === 0);
}

console.log('O pedido de criar:');
{
  const hoje = '2026-10-31';
  chk('o pedido certo', J(limparPedido({ cliente_id: ID, valor: '1500', dia: 10, inicio: '2026-10' }, { hoje })) === J({ cliente_id: ID, valor: 1500, dia: 10, inicio: '2026-10' }));
  chk('os centavos', limparPedido({ cliente_id: ID, valor: 183.333, dia: 10, inicio: '2026-10' }, { hoje }).valor === 183.33);
  chk('o id', /inválida/.test(limparPedido({ cliente_id: 'abc', valor: 10, dia: 10, inicio: '2026-10' }, { hoje }).erro) && /inválida/.test(limparPedido(null, { hoje }).erro));
  chk('o valor zero, negativo ou absurdo', /maior que zero/.test(limparPedido({ cliente_id: ID, valor: 0, dia: 10, inicio: '2026-10' }, { hoje }).erro)
    && /maior que zero/.test(limparPedido({ cliente_id: ID, valor: -5, dia: 10, inicio: '2026-10' }, { hoje }).erro)
    && /100\.000/.test(limparPedido({ cliente_id: ID, valor: 100001, dia: 10, inicio: '2026-10' }, { hoje }).erro));
  chk('o dia', /de 1 a 31/.test(limparPedido({ cliente_id: ID, valor: 10, dia: 0, inicio: '2026-10' }, { hoje }).erro) && /de 1 a 31/.test(limparPedido({ cliente_id: ID, valor: 10, dia: 10.5, inicio: '2026-10' }, { hoje }).erro));
  chk('o mês', /AAAA-MM/.test(limparPedido({ cliente_id: ID, valor: 10, dia: 10, inicio: '2026-13' }, { hoje }).erro)
    && /mês passado ao que vem/.test(limparPedido({ cliente_id: ID, valor: 10, dia: 10, inicio: '2026-08' }, { hoje }).erro)
    && /mês passado ao que vem/.test(limparPedido({ cliente_id: ID, valor: 10, dia: 10, inicio: '2026-12' }, { hoje }).erro)
    && !limparPedido({ cliente_id: ID, valor: 10, dia: 10, inicio: '2026-09' }, { hoje }).erro && !limparPedido({ cliente_id: ID, valor: 10, dia: 10, inicio: '2026-11' }, { hoje }).erro);
}

console.log('O endereço:');
{
  const receita = { cep: '95690-000', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '100', complemento: '', bairro: 'CENTRO', municipio: 'IGREJINHA', uf: 'RS' };
  const cad = { cep: '95660-000', logradouro: '  RUA   DE TESTE ', numero: '10', complemento: null, bairro: 'CENTRO', cidade: 'Três Coroas', uf: 'RS' };
  chk('o do cadastro, limpo (sem o vazio), com o país', J(enderecoDaEmpresa(cad, receita)) === J({ cep: '95660000', logradouro: 'RUA DE TESTE', numero: '10', bairro: 'CENTRO', cidade: 'Três Coroas', estado: 'RS', pais: 'Brasil' }));
  chk('sem endereço no cadastro: o da Receita, com a cidade do cadastro', J(enderecoDaEmpresa({ cidade: 'Igrejinha', uf: 'RS' }, receita))
    === J({ cep: '95690000', logradouro: 'RUA DAS FLORES', numero: '100', bairro: 'CENTRO', cidade: 'Igrejinha', estado: 'RS', pais: 'Brasil' }));
  chk('… e, sem a cidade no cadastro, a da Receita', enderecoDaEmpresa({}, receita).cidade === 'IGREJINHA');
  chk('sem nenhum: sem endereço', enderecoDaEmpresa({ cidade: 'Igrejinha' }, null) === null && enderecoDaEmpresa({}, { bairro: 'CENTRO' }) === null);
}

console.log('O cadastro no Conta Azul:');
{
  const pj = pessoaParaApi({ nome_principal: ' METALIZADORA  NOVA LTDA ', nome_fantasia: 'METAL NOVA', documento: '30.303.030/0001-30', email_principal: 'a@x.com.br; b@x.com.br', telefone_principal: '(51) 99999-0000', cep: '95660-000', logradouro: 'RUA A', cidade: 'Três Coroas', uf: 'RS' });
  chk('a empresa: razão social, Jurídica, o CNPJ só com os dígitos, o fantasia, os e-mails (também os da cobrança), o telefone, o endereço e o perfil Cliente',
    J(pj) === J({ nome: 'METALIZADORA NOVA LTDA', tipo_pessoa: 'Jurídica', cnpj: '30303030000130', nome_fantasia: 'METAL NOVA', email: 'a@x.com.br,b@x.com.br',
      contato_cobranca_faturamento: { emails: ['a@x.com.br', 'b@x.com.br'] }, telefone_comercial: '51999990000',
      enderecos: [{ cep: '95660000', logradouro: 'RUA A', cidade: 'Três Coroas', estado: 'RS', pais: 'Brasil' }], perfis: [{ tipo_perfil: 'Cliente' }] }), J(pj));
  const pf = pessoaParaApi({ nome_principal: 'FULANO DE TAL', nome_fantasia: '  ', documento: '123.456.789-09', email_principal: null, telefone_principal: '9999' });
  chk('a pessoa física: Física e o CPF; sem fantasia em branco, sem e-mail, sem telefone curto e sem endereço',
    J(pf) === J({ nome: 'FULANO DE TAL', tipo_pessoa: 'Física', cpf: '12345678909', perfis: [{ tipo_perfil: 'Cliente' }] }), J(pf));
}

console.log('O vendedor (o sócio que confirma):');
{
  const vend = [{ id: 'v1', nome: 'DIEGO REIS' }, { id: 'v2', nome: 'SAMUEL REIS' }, { id: 'v3', nome: 'Contador' }];
  chk('o Samuel pelo e-mail do financeiro', J(vendedorDoSocio(vend, 'financeiro@macedoereis.com.br')) === J({ id: 'v2', nome: 'SAMUEL REIS' }));
  chk('o Diego, também a pedido (pelo Claude)', vendedorDoSocio(vend, 'diego@macedoereis.com.br (pelo Claude)').id === 'v1');
  chk('o servidor e quem não é vendedor: nenhum', vendedorDoSocio(vend, 'servidor') === null && vendedorDoSocio(vend, 'fiscal@macedoereis.com.br') === null && vendedorDoSocio([], 'financeiro@macedoereis.com.br') === null);
}

console.log('O contrato no Conta Azul:');
{
  const modelo = { id_servico: 'srv', id_categoria: 'cat', dia_emissao_venda: 31 };
  const k = contratoParaApi({ pessoa: 'pes', valor: 1500.004, dia: 10, inicio: '2026-10', numero: 403, conta: 'inter', modelo, vendedor: 'v2' });
  chk('o corpo: o cliente, os termos (mensal, NUNCA, de 01/10/2026 a 01/09/2027, a venda no dia 31), o vencimento, a conta, o serviço com o valor, a categoria e o vendedor',
    J(k) === J({ id_cliente: 'pes', termos: { data_inicio: '2026-10-01', data_fim: '2027-09-01', dia_emissao_venda: 31, intervalo_frequencia: 1, numero: 403, tipo_expiracao: 'NUNCA', tipo_frequencia: 'MENSAL' },
      condicao_pagamento: { dia_vencimento: 10, primeira_data_vencimento: '2026-11-10', id_conta_financeira: 'inter' }, itens: [{ id: 'srv', quantidade: 1, valor: 1500 }], id_categoria: 'cat', id_vendedor: 'v2' }), J(k));
  const b = contratoParaApi({ pessoa: 'pes', valor: 750, dia: 15, inicio: '2026-10', numero: 404, modelo: { id_servico: 'srv', id_categoria: 'cat' }, tipoPagamento: 'BOLETO_BANCARIO' });
  chk('sem conta e sem vendedor, nada deles; a forma de pagamento só quando pedida; sem o dia da emissão no modelo, 31',
    J(b.condicao_pagamento) === J({ dia_vencimento: 15, primeira_data_vencimento: '2026-11-15', tipo_pagamento: 'BOLETO_BANCARIO' }) && !('id_vendedor' in b) && b.termos.dia_emissao_venda === 31, J(b));
}

console.log('O resumo:');
chk('o que vai ser criado, por escrito', resumoDoContrato({ valor: 1500, dia: 10, inicio: '2026-10' }) === 'R$ 1.500,00 por mês, vencendo dia 10, a partir de 10/2026 (a primeira em 10/11/2026)',
  resumoDoContrato({ valor: 1500, dia: 10, inicio: '2026-10' }));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
