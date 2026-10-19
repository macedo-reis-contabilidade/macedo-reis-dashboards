// Precificação: o motor de honorários (assets/js/precificacao-motor.js, o cálculo da Simulação, num lugar só desde
// 19/10/2026) e a aba Carteira (assets/js/precificacao-carteira.js): as respostas que o sistema já sabe de cada cliente
// da casa (cadastro, sócios, obrigações, carteira, Reforma, regularizações, Fator R), o honorário de hoje (boleto, base,
// Conta Azul pelo nome), o que falta responder, as revisões e os meses da vigência. Parâmetros e empresas inventados.
// Rodar com: node tests/precificacao-carteira.test.mjs
import { indexarParams, calcularMotor, faturamentoAnual } from '../assets/js/precificacao-motor.js';
import { respostasDoSistema, regimesDasQuestoes, tipoSocietario, erpDaCarteira, honorarioDeHoje, nomeBase, nomesBatem, parcelasDeHonorario, parcelaDoCliente,
  faltamResponder, ultimaPorCliente, mesesDaVigencia, mesBR, diferenca, ehMei, rotuloSituacao, mesesLivres, reajustesDoMes, aplicarReajusteAgora } from '../assets/js/precificacao-carteira.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

// parâmetros inventados (os do escritório ficam no banco)
const PARAMS = [
  ['p01_x', '0', 80, 0, 1], ['p01_x', '200000', 160, 200000, 2], ['p01_x', '500000', 240, 500000, 3],
  ['p02_x', 'Simples Nacional', 1, null, 1], ['p02_x', 'Lucro Presumido', 1.5, null, 2], ['p02_x', 'Imune/Isenta (associação)', 1, null, 3],
  ['p03_x', 'Valor por sócio adicional (além do 1º)', 30, null, 1], ['p03_x', 'Valor por filial (mesmo município)', 200, null, 2],
  ['p03_x', 'Valor extra por filial em município/estado diferente', 100, null, 3], ['p03_x', 'Valor por atendimento fora do município-sede', 70, null, 4],
  ['p04_x', '0-50', 0, null, 1], ['p04_x', '51-150', 20, null, 2], ['p04_x', 'Adicional - escritório emite as notas fiscais', 90, null, 3],
  ['p05_x', 'Adicional - controle de estoque pelo escritório', 110, null, 1],
  ['p06_x', '51-150', 15, null, 1], ['p06_x', 'Valor por conta bancária adicional (além da 1ª)', 10, null, 2],
  ['p07_x', 'Não possui', 200, null, 1], ['p07_x', 'Possui sem integração contábil', 60, null, 2], ['p07_x', 'Possui integrado à contabilidade', -20, null, 3],
  ['p08_x', 'Valor por funcionário registrado', 12, null, 1], ['p08_x', 'Pró-labore por sócio recebendo', 25, null, 2],
  ['p09_x', 'Média', 40, null, 1], ['p10_x', 'Médio', 1.1, null, 1],
  ['p11_x', 'SPED Fiscal', 35, null, 1], ['p11_x', 'eSocial/EFD-Reinf', 30, null, 2], ['p11_x', 'Reforma Tributária (transição/apuração dual)', 120, null, 3],
  ['p11_x', 'Passivo tributário em aberto', 60, null, 4], ['p11_x', 'Valor por parcelamento ativo', 20, null, 5], ['p11_x', 'Fator R (monitoramento e planejamento)', 25, null, 6],
  ['p12_x', 'Multiplicador - setor de risco elevado (Sim)', 1.5, null, 1], ['p12_x', 'Multiplicador - setor sem risco elevado (Não)', 1, null, 2],
  ['p13_x', 'Regular', 0.1, null, 1], ['p13_x', 'Ótima', -0.1, null, 2],
  ['p15_x', 'Adicional - seguro de responsabilidade civil profissional', 5, null, 1], ['p15_x', 'Taxa única de organização inicial (migração desorganizada)', 300, null, 2],
  ['p15_x', 'Adicional - cliente sem responsável financeiro', 35, null, 3], ['p16_x', 'Arredondar honorário final para múltiplo de (R$)', 5, null, 1]
].map(([grupo, chave, valor, limite_inferior, ordem]) => ({ grupo, chave, valor, limite_inferior, ordem }));
const P = indexarParams(PARAMS);

console.log('O motor:');
chk('os parâmetros por grupo, na ordem', P.p01.map(x => x.valor).join() === '80,160,240' && P.p11.length === 6);
chk('o faturamento anual: o mensal × 12, senão o anual antigo, senão a projeção', faturamentoAnual({ A2M: 30000 }) === 360000 && faturamentoAnual({ A2: 500000 }) === 500000
  && faturamentoAnual({ A2N: 1000 }) === 12000 && faturamentoAnual({}) === 0);
const R1 = { A2M: 30000, A10: 'Lucro Presumido', A5: 3, A8: 1, A9: 'Sim', A7: 'Sim', B1: '51-150', B8: 'Não possui', B6: 3, B7: '51-150', B4: 'Sim', B5: 'O escritório contábil',
  C1: 10, C5: 'Sim', C6: 2, C4: 'Média', C9: 'Médio', D1: 'Sim', D6: 'Sim', D10: 'Sim', D11: 'Sim', D12: 2, A11B: 'Não', D13: 'Sim', E2: 'Regular', E4: 'Sim',
  B3: 'O escritório contábil', E1: 'Não possui', ajuste_honorario: -25 };
const c1 = calcularMotor(R1, P);
// estrutura: 160 × 1,5 = 240 + sócios 2×30 + filial 200 + fora 100 + sede 70 = 670 · operacional: 20 + 110 + 15 + 2×10 + 200 = 365
// folha: (10×12 + 40 + 2×25) × 1,1 = 231 · obrigações: (35 + 30 + 120 + 60 + 2×20) × 1,5 = 427,5 · soma 1693,5 × 1,1 = 1862,85
// + seguro 5 + notas 90 + sem financeiro 35 = 1992,85 → múltiplo de 5: 1995 − 25 = 1970
chk('o cálculo inteiro (estrutura, volume, folha, obrigações, qualidade, adicionais, arredondamento e ajuste)', c1.honorario === 1970 && Math.abs(c1.bruto - 1992.85) < 1e-9 && c1.taxaUnica === 0,
  JSON.stringify({ h: c1.honorario, b: c1.bruto }));
chk('as linhas do painel, com os subtotais', c1.linhas.filter(l => l.sub).map(l => l.label + ' ' + Math.round(l.valor * 100) / 100).join(' | ') === 'Subtotal estrutura 670 | Subtotal operacional 365 | Subtotal folha 231 | Subtotal obrigações 427.5'
  && c1.linhas.some(l => l.label === 'Ajuste comercial' && l.valor === -25), c1.linhas.map(l => l.label).join(' | '));
chk('a taxa única: migração com a escrituração desorganizada', calcularMotor({ A12: 'Sim', A13: 'Desorganizada/inexistente' }, P).taxaUnica === 300 && calcularMotor({ A12: 'Não', A13: 'Não se aplica' }, P).taxaUnica === 0);
chk('sem resposta nenhuma: a menor faixa, o regime 1×', calcularMotor({}, P).honorario === 80);

console.log('O que o sistema já sabe do cliente:');
const REG = regimesDasQuestoes([{ questao_id: 'D14', regimes: ['Simples Nacional'] }, { questao_id: 'D6', regimes: ['Simples Nacional', 'Lucro Presumido'] },
  { questao_id: 'D15', regimes: ['Simples Nacional', 'Lucro Presumido'] }, { questao_id: 'D1', regimes: ['Lucro Presumido'] }, { questao_id: 'D2', regimes: ['Lucro Presumido'] },
  { questao_id: 'D4', regimes: ['Lucro Presumido'] }, { questao_id: 'D8', regimes: ['Lucro Presumido'] }, { questao_id: 'D9', regimes: ['Lucro Presumido'] },
  { questao_id: 'D17', regimes: ['Simples Nacional', 'Lucro Presumido'] }, { questao_id: 'D18', regimes: ['Simples Nacional', 'Lucro Presumido'] }, { questao_id: null, regimes: ['x'] }]);
chk('os regimes de cada pergunta (precificacao_obrigacoes)', REG.get('D14').has('Simples Nacional') && !REG.get('D1').has('Simples Nacional') && !REG.has(null));
chk('o tipo societário pela natureza jurídica', tipoSocietario('Sociedade Empresária Limitada') === 'LTDA' && tipoSocietario('206-2 - Sociedade Empresária Limitada') === 'LTDA' && tipoSocietario('2062') === 'LTDA'
  && tipoSocietario('Empresário (Individual)') === 'EI' && tipoSocietario('2135') === 'EI' && tipoSocietario('Associação Privada') === 'Associação' && tipoSocietario('Entidade Sindical') === 'Associação'
  && tipoSocietario('Sociedade Anônima Fechada') === 'S/A' && tipoSocietario('Sociedade Unipessoal de Advocacia') === 'Outro' && tipoSocietario(null) === null && tipoSocietario('qualquer', 'MEI') === 'MEI');
chk('o sistema da carteira → o ERP: emissor, maquininha ou nada = não tem', ['-', '', null, 'EMISSOR PREFEITURA', 'EMISSOR SEFAZ/PREFEITURA', 'TEF MÁQUINA SICOOB', 'SAFEWEB'].every(s => erpDaCarteira(s) === 'Não possui')
  && ['BLING', 'CONTA AZUL', 'EMISSOR SEFAZ + SISTEMA DE TESTE'].every(s => erpDaCarteira(s) === 'Possui sem integração contábil'));
const SIMPLES = { id: 'c1', nome_principal: 'PADARIA DO TESTE LTDA', documento: '10000000000191', regime_tributario: 'Simples Nacional', natureza_juridica: 'Sociedade Empresária Limitada',
  cnae_principal: '1091-1/02', cidade: 'Cidade Teste', uf: 'RS', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cep: '95000-000' };
const s1 = respostasDoSistema({ cliente: SIMPLES, socios: 2, fatorR: true, regularizacoes: ['parcelado', 'sem_acordo'],
  obrigacoes: ['PGDAS', 'DEISS - CIDADE TESTE', 'SEDIF/DESTDA - SIMPLES NACIONAL', 'EFD REINF - MENSAL', 'EMISSÃO DA GUIA DE PARCELAMENTO - SIMPLES NACIONAL', 'ICMS - ANTECIPAÇÃO/SUBSTITUIÇÃO TRIBUTÁRIA - SIMPLES NAC.', 'NFS-E FULANO DE TESTE'],
  reforma: { receita_mensal: 35000.456, rbt12: 1, decisao: 'por_fora' }, carteira: { sistemas: 'EMISSOR PREFEITURA', ramo: 'PADARIA' }, hoje: { valor: 600, fonte: 'boletos' } }, { regimesDaQuestao: REG });
const r = s1.respostas, o = s1.origem;
chk('o cadastro: nome, CNPJ formatado, endereço, tipo, cidade, regime e o CNAE com o ramo da carteira', r.A1 === 'PADARIA DO TESTE LTDA' && r.A1B === '10.000.000/0001-91'
  && r.A1C === 'Rua A, 10 · Centro · Cidade Teste/RS · CEP 95000-000' && r.A4 === 'LTDA' && r.A6 === 'Cidade Teste' && r.A10 === 'Simples Nacional' && r.A11 === '1091-1/02 · PADARIA' && o.A10 === 'cadastro', JSON.stringify(r));
chk('o faturamento da ficha da Reforma (o mensal, nos centavos), os sócios, o Fator R e o honorário de hoje', r.A2M === 35000.46 && o.A2M === 'reforma' && r.A5 === 2 && o.A5 === 'socios'
  && r.A11B === 'Sim' && o.A11B === 'fatorR' && r.A12B === 600 && o.A12B === 'boletos' && r.A12 === 'Não' && r.A13 === 'Não se aplica');
chk('as obrigações: quem emite as notas (o escritório, pela NFS-e vinculada), DeSTDA, DEISS, EFD-Reinf, os parcelamentos e o setor de risco (ICMS-ST)',
  r.B3 === 'O escritório contábil' && r.D14 === 'Sim' && r.D15 === 'Sim' && r.D6 === 'Sim' && r.D12 === 1 && r.D13 === 'Sim' && o.D13 === 'obrigacoes', JSON.stringify(r));
chk('só as perguntas do regime: no Simples, nada de SPED Fiscal, GIA, ISS', !('D1' in r) && !('D8' in r) && !('D9' in r) && !('D2' in r) && !('D4' in r));
chk('a regularização sem acordo é passivo em aberto; a decisão "por fora" é a apuração dual; o sistema da carteira, o ERP', r.D11 === 'Sim' && o.D11 === 'regularizacoes' && r.D10 === 'Sim' && o.D10 === 'reforma' && r.B8 === 'Não possui' && o.B8 === 'carteira');
const LP = { ...SIMPLES, id: 'c2', regime_tributario: 'Lucro Presumido', cnae_principal: '4321-5/00', natureza_juridica: '2135' };
const s2 = respostasDoSistema({ cliente: LP, socios: 0, obrigacoes: ['EFD FISCAL ICMS/IPI', 'EFD CONTRIBUIÇÕES', 'ECF - ESCRITURAÇÃO CONTABIL FISCAL', 'MIT', 'DEISS - CIDADE TESTE'],
  regularizacoes: ['regularizado', 'parcelado'], reforma: { receita_mensal: 0, rbt12: 1200000, decisao: 'pendente' }, carteira: { sistemas: 'BLING' } }, { regimesDaQuestao: REG });
const r2 = s2.respostas;
chk('no Presumido: SPED Fiscal, Contribuições, ECF e ISS (pela DEISS) sim; GIA e EFD-Reinf não (o cliente tem obrigações vinculadas, essas não)',
  r2.D1 === 'Sim' && r2.D2 === 'Sim' && r2.D4 === 'Sim' && r2.D9 === 'Sim' && r2.D15 === 'Sim' && r2.D8 === 'Não' && r2.D6 === 'Não' && !('D14' in r2) && r2.D12 === 0, JSON.stringify(r2));
chk('o faturamento pelo RBT12 ÷ 12; sem sócios cadastrados, a pergunta fica; regularizado não é passivo; construção é setor de risco (pelo CNAE); a decisão pendente não responde a Reforma',
  r2.A2M === 100000 && !('A5' in r2) && r2.D11 === 'Não' && r2.D13 === 'Sim' && s2.origem.D13 === 'cadastro' && !('D10' in r2) && r2.B8 === 'Possui sem integração contábil' && r2.A4 === 'EI');
const s3 = respostasDoSistema({ cliente: { ...SIMPLES, cnae_principal: '8630-5/03', logradouro: null }, obrigacoes: [], carteira: {} }, { regimesDaQuestao: REG });
chk('sem obrigação vinculada: o bloco D e quem emite as notas ficam por responder; sem rua, sem endereço; saúde pelo CNAE (DMED)',
  !('D6' in s3.respostas) && !('D14' in s3.respostas) && !('B3' in s3.respostas) && !('D12' in s3.respostas) && !('A1C' in s3.respostas) && s3.respostas.D17 === 'Sim' && !('B8' in s3.respostas));
chk('MEI fica com a aba MEI', ehMei({ regime_tributario: 'MEI' }) && !ehMei({ regime_tributario: 'Simples Nacional' }) && !ehMei(null));
chk('o que falta responder: só as que mexem no preço, em branco e visíveis', JSON.stringify(faltamResponder({ A2M: 1, B8: 'x', C1: '' }, id => id.startsWith('A') || id === 'C1'))
  === JSON.stringify(['A5', 'A7', 'A8', 'A9', 'A10', 'A11B', 'C1']));

console.log('O honorário de hoje:');
chk('o boleto da última competência vem primeiro; sem ele, a base; sem os dois, o Conta Azul; sem nada, nada',
  JSON.stringify(honorarioDeHoje({ boleto: { valor: 650, competencia: '2026-10' }, base: 600, contaAzul: { total: 700 } })) === JSON.stringify({ valor: 650, fonte: 'boletos', competencia: '2026-10' })
  && honorarioDeHoje({ boleto: { valor: 0 }, base: 600 }).valor === 600 && honorarioDeHoje({ base: 0, contaAzul: { total: 700, data_vencimento: '2026-10-10' } }).fonte === 'conta_azul'
  && honorarioDeHoje({ contaAzul: { total: 700, data_vencimento: '2026-10-10' } }).competencia === '2026-10' && honorarioDeHoje({}) === null);
chk('o nome como o vigia compara: sem acento, pontuação, LTDA/ME/EPP e números', nomeBase('Padaria do Teste Ltda.') === 'PADARIA DO TESTE' && nomeBase('JOÃO DA SILVA 12345678900') === 'JOAO DA SILVA'
  && nomeBase('Oficina-Teste ME') === 'OFICINA TESTE' && nomeBase(null) === '');
chk('os nomes batem: iguais sem espaço, um começa com o outro, sobrenome igual com a inicial; diferentes não', nomesBatem('PADARIA DO TESTE', 'PADARIADOTESTE') && nomesBatem('MERCADO TESTE', 'MERCADO TESTE CENTRO')
  && nomesBatem('MARIA SOUZA', 'M SOUZA') && !nomesBatem('PADARIA A', 'PADARIA B') && !nomesBatem('ANA LIMA', 'BETO LIMA') && !nomesBatem('', 'X'));
const PARC = [
  { natureza: 'receita', fornecedor_cliente_nome: 'Padaria do Teste Ltda', total: 580, data_vencimento: '2026-09-10', categorias: [{ nome: 'HONORÁRIOS MENSAIS' }] },
  { natureza: 'receita', fornecedor_cliente_nome: 'PADARIA DO TESTE', total: 600, data_vencimento: '2026-10-10', categorias: [{ nome: 'HONORÁRIOS MENSAIS' }] },
  { natureza: 'receita', fornecedor_cliente_nome: 'PADARIA DO TESTE', total: 600, data_vencimento: '2026-12-10', categorias: [{ nome: 'HONORÁRIOS MENSAIS' }] },
  { natureza: 'receita', fornecedor_cliente_nome: 'PADARIA DO TESTE', total: 215, data_vencimento: '2026-10-15', categorias: [{ nome: 'SERVIÇOS EXTRAS' }] },
  { natureza: 'despesa', fornecedor_cliente_nome: 'PADARIA DO TESTE', total: 50, data_vencimento: '2026-10-16', categorias: [{ nome: 'HONORÁRIOS MENSAIS' }] },
  { natureza: 'receita', fornecedor_cliente_nome: 'CHAVEIRO TESTE', total: 120, data_vencimento: '2026-10-05', categorias: [{ nome: 'MEI - CONTRATOS' }] }];
const prep = parcelasDeHonorario(PARC);
chk('as parcelas de honorário: receita das categorias de honorário (mensal e MEI), sem extras e despesas', prep.length === 4 && prep.every(p => p.base));
chk('a parcela do cliente: a mais recente até a data (a do futuro fica de fora), pelo nome ou pelo fantasia',
  parcelaDoCliente({ nome_principal: 'PADARIA DO TESTE LTDA' }, prep, '2026-10-24').total === 600 && parcelaDoCliente({ nome_principal: 'PADARIA DO TESTE LTDA' }, prep, '2026-10-24').data_vencimento === '2026-10-10'
  && parcelaDoCliente({ nome_principal: 'FULANO DE TAL 12345678900', nome_fantasia: 'Chaveiro Teste' }, prep, '2026-10-24').total === 120 && parcelaDoCliente({ nome_principal: 'OUTRA' }, prep) === null);

console.log('As revisões:');
const ult = ultimaPorCliente([{ cliente_id: 'a', id: 1, atualizado_em: '2026-10-01T10:00:00Z' }, { cliente_id: 'a', id: 2, atualizado_em: '2026-10-19T10:00:00Z' }, { cliente_id: 'b', id: 3, criado_em: '2026-10-02T10:00:00Z' }]);
chk('a última revisão de cada cliente', ult.get('a').id === 2 && ult.get('b').id === 3 && ult.size === 2);
const meses = mesesDaVigencia('2026-10-19');
chk('os meses da vigência: do mês de hoje até um ano depois', meses.length === 13 && meses[0] === '2026-10' && meses[3] === '2027-01' && meses[12] === '2027-10' && mesBR('2027-01') === '01/2027');
chk('a diferença do motor pra hoje; sem hoje, nada', Math.abs(diferenca(750, 600) - 0.25) < 1e-12 && diferenca(450, 600) === -0.25 && diferenca(500, 0) === null && diferenca(500, null) === null);
chk('a situação por extenso', rotuloSituacao('proposto') === 'Reajuste proposto' && rotuloSituacao('mantido') === 'Mantido');

console.log('O reajuste aceito entra no boleto:');
chk('os meses livres: não o que já tem boleto emitido, enviado ou pago', JSON.stringify(mesesLivres(['2026-10', '2026-11', '2026-12'], [{ competencia: '2026-10', status: 'enviado' }, { competencia: '2026-11', status: 'a_emitir' }]))
  === JSON.stringify([{ mes: '2026-10', livre: false }, { mes: '2026-11', livre: true }, { mes: '2026-12', livre: true }]));
const RV = [
  { id: 'r1', cliente_id: 'a', status: 'aceito', honorario_novo: 700, vigencia: '2026-11', aplicado_em: null, atualizado_em: '2026-10-10' },
  { id: 'r2', cliente_id: 'a', status: 'aceito', honorario_novo: 720, vigencia: '2026-11', aplicado_em: null, atualizado_em: '2026-10-19' },
  { id: 'r3', cliente_id: 'b', status: 'aceito', honorario_novo: 400, vigencia: '2027-01', aplicado_em: null, atualizado_em: '2026-10-19' },
  { id: 'r4', cliente_id: 'c', status: 'aceito', honorario_novo: 300, vigencia: '2026-10', aplicado_em: '2026-10-05', atualizado_em: '2026-10-01' },
  { id: 'r5', cliente_id: 'd', status: 'proposto', honorario_novo: 300, vigencia: '2026-11', aplicado_em: null, atualizado_em: '2026-10-01' }];
const rm = reajustesDoMes(RV, '2026-11');
chk('os reajustes do mês gerado: aceitos, não aplicados, com a vigência até ele, o mais recente de cada cliente', rm.size === 1 && rm.get('a').id === 'r2' && reajustesDoMes(RV, '2027-02').size === 2);
function sbReajuste({ boletos = [], cfg = [] } = {}) {
  const log = [];
  const from = t => {
    const q = { f: [] };
    q.select = () => q; q.update = r => { q.u = r; return q; };
    q.eq = (k, v) => { q.f.push(['eq', k, v]); return q; }; q.gte = (k, v) => { q.f.push(['gte', k, v]); return q; }; q.in = (k, v) => { q.f.push(['in', k, v]); return q; }; q.is = (k, v) => { q.f.push(['is', k, v]); return q; };
    q.then = (ok, falha) => {
      const bate = l => q.f.every(([op, k, v]) => op === 'eq' ? l[k] === v : op === 'gte' ? String(l[k]) >= v : op === 'in' ? v.includes(l[k]) : op === 'is' ? (l[k] ?? null) === v : true);
      const linhas = t === 'cobrancas_mensais' ? boletos : t === 'cobrancas_config' ? cfg : [];
      if (q.u) { const alvo = linhas.filter(bate); alvo.forEach(l => Object.assign(l, q.u)); log.push([t, q.u, q.f, alvo.length]); return Promise.resolve({ data: null, error: null }).then(ok, falha); }
      return Promise.resolve({ data: linhas.filter(bate), error: null }).then(ok, falha);
    };
    return q;
  };
  return { sb: { from }, log };
}
{
  const boletos = [{ id: 'b1', cliente_id: 'a', competencia: '2026-10', status: 'a_emitir', valor: 600 }, { id: 'b2', cliente_id: 'a', competencia: '2026-11', status: 'a_emitir', valor: 600 },
    { id: 'b3', cliente_id: 'a', competencia: '2026-12', status: 'emitido', valor: 600 }, { id: 'b4', cliente_id: 'z', competencia: '2026-11', status: 'a_emitir', valor: 100 }];
  const cfg = [{ cliente_id: 'a', ativo: true, valor_base: 600 }];
  const { sb, log } = sbReajuste({ boletos, cfg });
  const r = await aplicarReajusteAgora(sb, { revisao: { id: 'r2', cliente_id: 'a', honorario_novo: 720, vigencia: '2026-11' }, email: 'socio@teste' });
  chk('aplicar agora: o boleto a emitir do mês (e dos seguintes) do cliente ganha o valor novo; o anterior, o emitido e o de outro cliente não',
    r.trocados === 1 && boletos.map(b => b.valor).join() === '600,720,600,100' && JSON.stringify(r.meses) === '["2026-11"]', JSON.stringify(r));
  chk('aplicado: a revisão marcada (quando e quem) e a base de cobrança com o valor novo', log.some(l => l[0] === 'revisoes_honorario' && l[1].aplicado_por === 'socio@teste' && !!l[1].aplicado_em && JSON.stringify(l[2]) === JSON.stringify([['eq', 'id', 'r2'], ['is', 'aplicado_em', null]])) && cfg[0].valor_base === 720, JSON.stringify(log));
  const { sb: sb2 } = sbReajuste({ boletos: [{ id: 'b9', cliente_id: 'a', competencia: '2026-11', status: 'enviado', valor: 600 }] });
  chk('sem boleto a emitir do mês: nada trocado agora (entra quando o mês for gerado)', (await aplicarReajusteAgora(sb2, { revisao: { id: 'r2', cliente_id: 'a', honorario_novo: 720, vigencia: '2026-11' } })).trocados === 0);
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
