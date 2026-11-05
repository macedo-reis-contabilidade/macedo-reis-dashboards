// A Folha de pagamento — os recibos que o escritório faz fora da folha do Domínio (assets/js/folha-recibos.js e
// assets/js/folha-recibos-pdf.js, 05/11/2026). As contas conferidas com os exemplos da planilha de recibos do DP (os
// valores, não os nomes: a planilha tem dado de cliente e não vem pro repositório). Dados inventados.
// Rodar com: node tests/folha-recibos.test.mjs
import { centavos, lerNumero, lerHoras, horasTexto, fmtValor, competenciaTexto, competenciaPadrao, mudarMes, diasNoMes,
  horasMes, horasDoMes, base, EVENTOS, TIPOS, periodoPadrao, diasDoSalario, diasDeDescanso, dsrSugerido, somaMeses, avos13,
  inicioAquisitivo, avosFerias, mesesDeFerias, jaPago, linhasIniciais, calcularRecibo, itensParaGravar, referenciaTexto,
  quantidadeTexto, lerQuantidade, problemaDoFuncionario, problemaDoRecibo, numeroPorExtenso, porExtenso, totaisDoMes,
  ordenarRecibos, ativoNoMes } from '../assets/js/folha-recibos.js';
import { recibosPdf, nomeDoArquivo } from '../assets/js/folha-recibos-pdf.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const quase = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log('Os números:');
chk('centavos sem erro de vírgula flutuante', centavos(1892.55) === 189255 && centavos(1.005) === 101 && centavos(0.1 + 0.2) === 30 && centavos(-2.5) === -250 && centavos(null) === 0);
chk('lerNumero: vírgula, ponto de milhar e vazio', lerNumero('1.234,56') === 1234.56 && lerNumero('8,37') === 8.37 && lerNumero('8.37') === 8.37
  && lerNumero('R$ 1.842,00') === 1842 && lerNumero('1.234.567') === 1234567 && lerNumero('') === null && Number.isNaN(lerNumero('abc')));
chk('lerHoras: 53:30, 53h30, 53h, 53,5 e 53.5', lerHoras('53:30') === 53.5 && lerHoras('53h30') === 53.5 && lerHoras('53h') === 53 && lerHoras('53,5') === 53.5
  && lerHoras('53.5') === 53.5 && quase(lerHoras('117:50'), 117 + 50 / 60) && lerHoras(' ') === null && Number.isNaN(lerHoras('1:5')) && Number.isNaN(lerHoras('8:75')));
chk('horasTexto: de volta em h:mm', horasTexto(117 + 50 / 60) === '117:50' && horasTexto(53.5) === '53:30' && horasTexto(7.333333) === '7:20' && horasTexto(0) === '0:00' && horasTexto(null) === '');
chk('o valor em reais', fmtValor(123456) === '1.234,56' && fmtValor(0) === '0,00' && fmtValor(5) === '0,05');

console.log('O mês:');
chk('a competência por extenso', competenciaTexto('2026-10') === 'Outubro de 2026' && competenciaTexto('2027-01') === 'Janeiro de 2027' && competenciaTexto('lixo') === '');
chk('a competência que a tela abre: a do mês passado até o dia 15', competenciaPadrao('2026-11-05') === '2026-10' && competenciaPadrao('2026-11-15') === '2026-10'
  && competenciaPadrao('2026-11-16') === '2026-11' && competenciaPadrao('2027-01-03') === '2026-12');
chk('o mês de antes e o de depois', mudarMes('2026-01', -1) === '2025-12' && mudarMes('2026-12', 1) === '2027-01' && diasNoMes('2028-02') === 29);

console.log('As horas do mês:');
chk('o mês comercial: 220 com 44 por semana, 200 com 40', horasMes(44) === 220 && horasMes(40) === 200);
chk('as horas do mês do calendário: 227,33 em outubro (a da planilha), 205,33 em fevereiro de 2026, 220 em novembro',
  horasDoMes('2026-10') === 227.33 && horasDoMes('2026-02') === 205.33 && horasDoMes('2026-11') === 220);
const bMes = base({ tipo_valor: 'mes', valor: 1842, horas_semana: 44, competencia: '2026-10' });
chk('quem recebe por mês: a hora é o salário ÷ 220', quase(bMes.vh, 1842 / 220) && bMes.salarioMes === 1842 && bMes.salarioDoMes === 1842);
const bHora = base({ tipo_valor: 'hora', valor: 10, horas_semana: 44, competencia: '2026-10' });
chk('quem recebe por hora: o salário do mês comercial (220 h) e o do calendário (227,33 h)', bHora.vh === 10 && quase(bHora.salarioMes, 2200) && quase(bHora.salarioDoMes, 2273.3));

console.log('Os exemplos da planilha de recibos:');
const recibo = (o) => ({ tipo_valor: 'hora', valor: 10, horas_semana: 44, competencia: '2026-10', arredondar: true, ...o });
let c = calcularRecibo(recibo({ valor: 11.5, itens: [{ ev: 'horas', q: 53.5 }, { ev: 'dsr', q: 0 }, { ev: 'he50', q: 0 }, { ev: 'atestado', q: 0 }, { ev: 'adiantamento', q: 0 }] }));
chk('folha mensal: 53,5 h × 11,50 = 615,25, arredondamento 0,75, total 616,00', c.proventos === 61525 && c.arredondamento === 75 && c.total === 61600, c);
c = calcularRecibo(recibo({ valor: 10, itens: [{ ev: 'adiantamento_salarial', q: 40 }] }));
chk('adiantamento: 10 × 227,33 × 40% = 909,32, arredondamento 0,68, total 910,00', c.proventos === 90932 && c.arredondamento === 68 && c.total === 91000, c);
c = calcularRecibo(recibo({ valor: 11.47, arredondar: false, itens: [{ ev: 'ferias', q: 9 }] }));
chk('férias: 11,47 × 220 ÷ 12 × 9 = 1.892,55, mais 1/3 = 630,85, total 2.523,40', c.linhas[0].v === 189255 && c.linhas[1].ev === 'terco' && c.linhas[1].v === 63085 && c.total === 252340, c.linhas);
c = calcularRecibo(recibo({ valor: 11.5, arredondar: false, itens: [{ ev: 'decimo1', q: 11 }] }));
chk('13º, 1ª parcela: a metade de 11,50 × 220 ÷ 12 × 11', c.total === centavos(11.5 * 220 / 12 * 11 / 2), c.total);
c = calcularRecibo(recibo({ valor: 11, arredondar: false, itens: [{ ev: 'horas', q: 50 }, { ev: 'dsr', q: 14.67 }, { ev: 'aviso', q: 30 }, { ev: 'decimo_aviso', q: 1 }, { ev: 'ferias_aviso', q: 1 },
  { ev: 'decimo', q: 2 }, { ev: 'ferias', q: 2 }, { ev: 'adiantamento', q: 307 }] }));
const sal = 11 * 220;
chk('rescisão: o aviso de 30 dias é o salário do mês (220 h), os avos e o 1/3 de todas as férias juntas',
  c.linhas.find(l => l.ev === 'aviso').v === centavos(sal) && c.linhas.find(l => l.ev === 'terco').v === Math.round((centavos(sal / 12) + centavos(sal / 12 * 2)) / 3)
  && c.descontos === 30700, c.linhas);
chk('o 1/3 entra logo depois da última linha de férias', c.linhas.map(l => l.ev).join(',') === 'horas,dsr,aviso,decimo_aviso,ferias_aviso,decimo,ferias,terco,adiantamento', c.linhas.map(l => l.ev));

console.log('Mais contas:');
c = calcularRecibo({ tipo_valor: 'mes', valor: 1842, horas_semana: 44, competencia: '2026-10', arredondar: true, itens: [{ ev: 'salario', q: 30 }, { ev: 'he50', q: 2 }, { ev: 'he100', q: 1 }, { ev: 'faltas', q: 9 }] });
chk('por mês: 30 dias = o salário, a extra de 50% e a de 100% sobre a hora, a falta em horas', c.linhas[0].v === 184200 && c.linhas[1].v === centavos(1842 / 220 * 1.5 * 2)
  && c.linhas[2].v === centavos(1842 / 220 * 2) && c.linhas[3].v === centavos(1842 / 220 * 9) && c.linhas[3].nat === 'D', c.linhas);
c = calcularRecibo(recibo({ valor: 8.5, itens: [{ ev: 'horas', q: 8 }], arredondar: true }));
chk('o total já redondo não ganha arredondamento', c.total === 6800 && c.arredondamento === 0);
c = calcularRecibo(recibo({ valor: 8.37, itens: [{ ev: 'horas', q: 10 }], arredondar: false }));
chk('sem arredondar, o total exato', c.total === 8370 && c.arredondamento === 0);
c = calcularRecibo(recibo({ valor: 10, itens: [{ ev: 'horas', q: 10 }, { ev: 'adiantamento', q: 150 }] }));
chk('desconto maior que os proventos: o líquido negativo, sem arredondamento', c.liquido === -5000 && c.arredondamento === 0 && c.total === -5000);
c = calcularRecibo(recibo({ valor: 10, itens: [{ ev: 'outras', q: 50, desc: '  Prêmio de produção  ' }, { ev: 'desconto', q: 20, desc: 'Vale' }, { ev: 'inexistente', q: 5 }] }));
chk('as linhas em reais com a descrição digitada; o evento que não existe fica de fora', c.linhas.length === 2 && c.linhas[0].rotulo === 'Prêmio de produção' && c.linhas[1].rotulo === 'Vale' && c.total === 3000, c.linhas);
c = calcularRecibo(recibo({ valor: 10, itens: [{ ev: 'horas', q: null }, { ev: 'he50', q: '' }, { ev: 'dsr', q: NaN }] }));
chk('linha em branco ou ilegível vale zero (o aviso é do problemaDoRecibo)', c.proventos === 0 && c.linhas.length === 3);
const g = itensParaGravar(calcularRecibo(recibo({ valor: 11.47, arredondar: false, itens: [{ ev: 'ferias', q: 9 }, { ev: 'he50', q: null }, { ev: 'faltas', q: 0 }] })));
chk('o que vai pro banco: as linhas com quantidade ou valor, com o valor de cada uma (o 1/3 também)',
  JSON.stringify(g) === JSON.stringify([{ ev: 'ferias', q: 9, desc: null, v: 189255 }, { ev: 'terco', q: null, desc: null, v: 63085 }, { ev: 'faltas', q: 0, desc: null, v: 0 }]), g);

console.log('O período e o descanso:');
const func = { id: 'f1', nome: 'FUNCIONÁRIA DE TESTE', tipo_valor: 'hora', valor: 8.37, horas_semana: 44, admissao: '2026-10-19', saida: null };
chk('o período: da admissão ao fim do mês', JSON.stringify(periodoPadrao(func, '2026-10')) === JSON.stringify({ de: '2026-10-19', ate: '2026-10-31', vazio: false }));
chk('o período: até a saída; quem saiu antes do mês fica vazio', periodoPadrao({ admissao: '2026-08-01', saida: '2026-10-09' }, '2026-10').ate === '2026-10-09'
  && periodoPadrao({ admissao: '2026-08-01', saida: '2026-09-30' }, '2026-10').vazio === true && periodoPadrao({ admissao: '2026-11-03' }, '2026-10').vazio === true);
chk('os dias do salário: o mês inteiro conta 30, um pedaço, os dias do calendário', diasDoSalario('2026-10-01', '2026-10-31', '2026-10') === 30
  && diasDoSalario('2026-02-01', '2026-02-28', '2026-02') === 30 && diasDoSalario('2026-10-19', '2026-10-31', '2026-10') === 13 && diasDoSalario('2026-10-02', '2026-10-31', '2026-10') === 30);
const out = diasDeDescanso('2026-10-01', '2026-10-31');
chk('outubro de 2026: 4 domingos e o feriado de 12/10', out.domingos === 4 && out.feriados === 1 && out.total === 5, out);
chk('o descanso sugerido: 5 dias × 7:20 = 36:40; de 19 a 31/10, só o domingo 25', dsrSugerido('2026-10-01', '2026-10-31') === 36.67 && dsrSugerido('2026-10-19', '2026-10-31') === 7.33);
chk('o feriado no domingo conta uma vez (20/09/2026)', diasDeDescanso('2026-09-20', '2026-09-20').total === 1 && diasDeDescanso('2026-09-14', '2026-09-20').total === 1);
chk('período ao contrário ou sem data: nada', diasDeDescanso('2026-10-31', '2026-10-01').total === 0 && diasDeDescanso(null, '2026-10-01').total === 0);

console.log('Os meses de 13º e de férias:');
chk('somar meses guarda o dia (ou o último do mês)', somaMeses('2026-08-07', 2) === '2026-10-07' && somaMeses('2026-01-31', 1) === '2026-02-28' && somaMeses('2026-11-15', 3) === '2027-02-15');
chk('13º: o mês com 15 dias ou mais conta', avos13('2026-08-07', '2026-11-30') === 4 && avos13('2026-08-20', '2026-11-30') === 3 && avos13('2025-03-01', '2026-12-31') === 12
  && avos13('2026-10-19', '2026-10-31') === 0 && avos13('2026-10-17', '2026-10-31') === 1 && avos13(null, '2026-06-30') === 6);
chk('o período aquisitivo em curso', inicioAquisitivo('2025-03-10', '2026-11-05') === '2026-03-10' && inicioAquisitivo('2026-08-07', '2026-10-06') === '2026-08-07' && inicioAquisitivo('2024-03-10', '2026-03-10') === '2026-03-10');
chk('férias proporcionais: os meses do período, com a fração de 15 dias', avosFerias('2026-08-07', '2026-10-06') === 2 && avosFerias('2026-08-07', '2026-10-21') === 3
  && avosFerias('2026-08-07', '2026-10-20') === 2 && avosFerias('2025-12-01', '2026-11-30') === 12 && avosFerias('2026-10-19', '2026-10-31') === 0);
chk('os meses de férias sugeridos: 12 com um ano de casa, antes os meses desde a admissão', mesesDeFerias('2025-10-01', '2026-11-30') === 12 && mesesDeFerias('2026-01-10', '2026-10-31') === 10 && mesesDeFerias(null, '2026-10-31') === 0);

console.log('O que já foi pago e o recibo novo:');
const recs = [
  { id: 'a1', funcionario_id: 'f1', tipo: 'adiantamento', competencia: '2026-10', total: 910 },
  { id: 'a2', funcionario_id: 'f1', tipo: 'adiantamento', competencia: '2026-09', total: 900 },
  { id: 'd1', funcionario_id: 'f1', tipo: 'decimo1', competencia: '2026-11', total: 250.5 },
  { id: 'x1', funcionario_id: 'f2', tipo: 'adiantamento', competencia: '2026-10', total: 500 },
];
const pago = jaPago(recs, 'f1', '2026-10');
chk('o adiantamento do mês e a 1ª parcela do 13º do ano, só do funcionário', pago.adiantamento === 91000 && pago.decimoPago === 25050 && pago.decimoPagoEm === '2026-11', pago);
chk('o próprio recibo não conta (ao editar o adiantamento)', jaPago(recs, 'f1', '2026-10', 'a1').adiantamento === 0);
let ini = linhasIniciais('mensal', func, '2026-10', pago);
chk('folha mensal por hora: horas e descanso em branco, a extra, e o adiantamento do mês já pago',
  JSON.stringify(ini) === JSON.stringify([{ ev: 'horas', q: null }, { ev: 'dsr', q: null }, { ev: 'he50', q: null }, { ev: 'adiantamento', q: 910 }]), ini);
ini = linhasIniciais('mensal', { ...func, tipo_valor: 'mes', valor: 1842 }, '2026-10', {});
chk('folha mensal por mês: os dias do período (13), a extra e as faltas', JSON.stringify(ini) === JSON.stringify([{ ev: 'salario', q: 13 }, { ev: 'he50', q: null }, { ev: 'faltas', q: null }]), ini);
chk('adiantamento: 40%', JSON.stringify(linhasIniciais('adiantamento', func, '2026-10')) === JSON.stringify([{ ev: 'adiantamento_salarial', q: 40 }]));
const antigo = { ...func, admissao: '2026-01-10' };
chk('férias: os meses pela admissão', JSON.stringify(linhasIniciais('ferias', antigo, '2026-10')) === JSON.stringify([{ ev: 'ferias', q: 10 }]));
chk('13º, 1ª parcela: os meses até o fim do mês', JSON.stringify(linhasIniciais('decimo1', { ...func, admissao: '2026-08-07' }, '2026-11')) === JSON.stringify([{ ev: 'decimo1', q: 4 }]));
ini = linhasIniciais('decimo2', { ...func, admissao: '2026-08-07' }, '2026-12', jaPago(recs, 'f1', '2026-12'));
chk('13º, 2ª parcela: os meses até dezembro e a 1ª parcela descontada', JSON.stringify(ini) === JSON.stringify([{ ev: 'decimo', q: 5 }, { ev: 'decimo_pago', q: 250.5 }]), ini);
ini = linhasIniciais('rescisao', { ...func, admissao: '2026-08-07', saida: '2026-10-21' }, '2026-10', pago);
chk('rescisão: saldo, descanso, aviso, os meses de 13º e de férias até a saída e o adiantamento',
  JSON.stringify(ini) === JSON.stringify([{ ev: 'horas', q: null }, { ev: 'dsr', q: null }, { ev: 'aviso', q: null }, { ev: 'decimo', q: 3 }, { ev: 'ferias', q: 3 }, { ev: 'adiantamento', q: 910 }]), ini);
chk('todos os tipos têm o recibo novo', Object.keys(TIPOS).every(t => linhasIniciais(t, func, '2026-10').length > 0));

console.log('A referência e os campos:');
chk('a referência no recibo', referenciaTexto('h', 53.5) === '53:30' && referenciaTexto('meses', 9) === '9/12' && referenciaTexto('%', 40) === '40%'
  && referenciaTexto('dias', 1) === '1 dia' && referenciaTexto('dias', 13) === '13 dias' && referenciaTexto('R$', 50) === '' && referenciaTexto('h', null) === '');
chk('o campo do editor, ida e volta', quantidadeTexto('h', 59.5) === '59:30' && quantidadeTexto('R$', 910) === '910,00' && quantidadeTexto('meses', 9) === '9'
  && lerQuantidade('h', '59:30') === 59.5 && lerQuantidade('R$', '910,00') === 910 && lerQuantidade('%', '40') === 40);

console.log('O que impede gravar:');
chk('o funcionário: nome, valor, horas por semana e a saída', problemaDoFuncionario({ nome: ' ', valor: 10, horas_semana: 44 }).campo === 'nome'
  && problemaDoFuncionario({ nome: 'A', valor: 0, horas_semana: 44 }).texto === 'Informe o valor da hora.'
  && problemaDoFuncionario({ nome: 'A', tipo_valor: 'mes', valor: null, horas_semana: 44 }).texto === 'Informe o salário do mês.'
  && problemaDoFuncionario({ nome: 'A', valor: 10, horas_semana: 0 }).campo === 'horas_semana'
  && problemaDoFuncionario({ nome: 'A', valor: 10, horas_semana: 44, admissao: '2026-10-10', saida: '2026-10-01' }).campo === 'saida'
  && problemaDoFuncionario({ nome: 'A', valor: 10, horas_semana: 44 }) === null);
const prob = r => problemaDoRecibo(r, calcularRecibo(r));
chk('o recibo: horas ilegíveis, sem valor, descontos demais, período ao contrário',
  prob(recibo({ itens: [{ ev: 'horas', q: NaN }] })).texto === 'Confira "Horas normais": as horas vão como 8:30 ou 8,5.'
  && prob(recibo({ itens: [{ ev: 'horas', q: null }] })).texto.startsWith('O recibo está sem valor')
  && prob(recibo({ itens: [{ ev: 'horas', q: 1 }, { ev: 'adiantamento', q: 50 }] })).texto === 'Os descontos passam dos proventos.'
  && prob(recibo({ periodo_de: '2026-10-20', periodo_ate: '2026-10-01', itens: [{ ev: 'horas', q: 1 }] })).campo === 'periodo'
  && prob(recibo({ valor: 0, itens: [{ ev: 'horas', q: 10 }] })).campo === 'valor'
  && prob(recibo({ itens: [{ ev: 'horas', q: 800 }] })).texto.startsWith('Mais de 744 horas')
  && prob(recibo({ itens: [{ ev: 'horas', q: 10 }] })) === null);

console.log('Por extenso:');
const ext = [[616, 'seiscentos e dezesseis reais'], [1, 'um real'], [0.5, 'cinquenta centavos'], [0.01, 'um centavo'], [100, 'cem reais'], [101, 'cento e um reais'],
  [1234.56, 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'], [1100, 'mil e cem reais'], [2020, 'dois mil e vinte reais'], [100000, 'cem mil reais'],
  [2523.4, 'dois mil quinhentos e vinte e três reais e quarenta centavos'], [1000000, 'um milhão de reais'], [2005000, 'dois milhões e cinco mil reais'],
  [1250000.5, 'um milhão duzentos e cinquenta mil reais e cinquenta centavos'], [910, 'novecentos e dez reais'], [0, 'zero reais'], [21, 'vinte e um reais'], [14, 'quatorze reais']];
ext.forEach(([v, t]) => chk('R$ ' + v + ' → ' + t, porExtenso(v) === t, porExtenso(v)));
chk('o número sozinho', numeroPorExtenso(0) === 'zero' && numeroPorExtenso(1000) === 'mil' && numeroPorExtenso(1001) === 'mil e um');

console.log('O mês na tela:');
const doMes = [
  { id: 'r1', funcionario_id: 'f1', nome: 'BRUNA TESTE', tipo: 'mensal', competencia: '2026-10', total: 885, criado_em: '2026-11-05T10:00:00Z' },
  { id: 'r2', funcionario_id: 'f1', nome: 'BRUNA TESTE', tipo: 'adiantamento', competencia: '2026-10', total: 300, criado_em: '2026-10-20T10:00:00Z' },
  { id: 'r3', funcionario_id: 'f2', nome: 'ANA TESTE', tipo: 'mensal', competencia: '2026-10', total: 500.5, criado_em: '2026-11-05T10:00:00Z' },
  { id: 'r4', funcionario_id: 'f2', nome: 'ANA TESTE', tipo: 'mensal', competencia: '2026-09', total: 700, criado_em: '2026-10-05T10:00:00Z' },
];
chk('os totais do mês', JSON.stringify(totaisDoMes(doMes, '2026-10')) === JSON.stringify({ quantos: 3, total: 168550 }));
chk('a ordem: pelo nome, e no mesmo nome o adiantamento antes da folha', ordenarRecibos(doMes.filter(r => r.competencia === '2026-10')).map(r => r.id).join() === 'r3,r2,r1');
chk('quem aparece no mês', ativoNoMes({ id: 'f1', admissao: '2026-10-19' }, '2026-10') && !ativoNoMes({ id: 'f9', admissao: '2026-11-03' }, '2026-10')
  && !ativoNoMes({ id: 'f9', saida: '2026-09-30' }, '2026-10') && ativoNoMes({ id: 'f2', saida: '2026-09-30' }, '2026-09') && ativoNoMes({ id: 'f2', saida: '2026-09-01' }, '2026-10', [{ funcionario_id: 'f2', competencia: '2026-10' }]));

console.log('O PDF (com um jsPDF de mentira que anota o que a tela manda escrever):');
class DocFalso {
  constructor() { this.paginas = 1; this.textos = []; this.cortes = 0; }
  text(t, x, y) { (Array.isArray(t) ? t : [t]).forEach(s => this.textos.push({ t: String(s), x, y, p: this.paginas })); return this; }
  splitTextToSize(t, w) { const out = []; let linha = ''; String(t).split(' ').forEach(p => { if ((linha + ' ' + p).length > w * 0.55) { out.push(linha.trim()); linha = p; } else linha += ' ' + p; }); out.push(linha.trim()); return out; }
  addPage() { this.paginas++; return this; }
  line(x1, y1, x2, y2) { if (y1 === 148.5 && y2 === 148.5) this.cortes++; return this; }
}
['rect', 'setFont', 'setFontSize', 'setTextColor', 'setDrawColor', 'setLineWidth', 'setLineDashPattern'].forEach(m => { DocFalso.prototype[m] = function () { return this; }; });
const calc = calcularRecibo(recibo({ valor: 8.37, competencia: '2026-10', itens: [{ ev: 'horas', q: 88 }, { ev: 'he50', q: 2 }, { ev: 'adiantamento', q: 300 }] }));
const salvo = { tipo: 'mensal', competencia: '2026-10', nome: 'Bruna Teste', periodo_de: '2026-10-19', periodo_ate: '2026-10-31', tipo_valor: 'hora', valor: 8.37,
  itens: itensParaGravar(calc), arredondamento: calc.arredondamento / 100, total: calc.total / 100, pagamento: '2026-11-06' };
const empresa = { nome: 'EMPRESA DE TESTE LTDA', documento: '11222333000181', cidade: 'Três Coroas' };
const um = { empresa, funcionario: { nome: 'Bruna Teste', funcao: 'Auxiliar', admissao: '2026-10-19' }, recibo: salvo };
let pdf = recibosPdf(DocFalso, [um]);
const texto = pdf.textos.map(x => x.t).join(' | ');
chk('o recibo: a empresa, o CNPJ, o tipo, a competência, o funcionário, a admissão, a função, o período e a hora',
  ['EMPRESA DE TESTE LTDA', 'CNPJ 11.222.333/0001-81', 'Folha mensal', 'Competência: Outubro de 2026', 'BRUNA TESTE', 'Admissão: 19/10/2026', 'Função: Auxiliar',
    'Período: 19/10/2026 a 31/10/2026', 'Valor da hora: R$ 8,37'].every(s => texto.includes(s)), texto);
chk('as linhas: o código, a descrição, a referência e o valor; o arredondamento; os totais e o líquido',
  ['Horas normais', '88:00', '736,56', 'Horas extras 50%', '2:00', '25,11', 'Adiantamento', '300,00', 'Arredondamento', '0,33', '762,00', 'Valor líquido   R$ 462,00'].every(s => texto.includes(s)), texto);
chk('o recebimento por extenso, a cidade com a data e o nome embaixo da assinatura',
  texto.includes('quatrocentos e sessenta e dois reais') && texto.includes('referente à folha mensal de outubro de 2026') && texto.includes('Três Coroas, 06/11/2026'), texto);
chk('um recibo, uma página, sem linha de corte', pdf.paginas === 1 && pdf.cortes === 0);
pdf = recibosPdf(DocFalso, [um, um, um]);
chk('três recibos: dois por página, a linha de corte entre eles', pdf.paginas === 2 && pdf.cortes === 1, { paginas: pdf.paginas, cortes: pdf.cortes });
const adi = calcularRecibo(recibo({ valor: 8.37, itens: [{ ev: 'adiantamento_salarial', q: 40 }] }));
pdf = recibosPdf(DocFalso, [{ empresa, funcionario: {}, recibo: { tipo: 'adiantamento', competencia: '2026-10', nome: 'Bruna Teste', tipo_valor: 'hora', valor: 8.37, horas_semana: 44,
  itens: itensParaGravar(adi), arredondamento: adi.arredondamento / 100, total: adi.total / 100 } }]);
const ta = pdf.textos.map(x => x.t).join(' | ');
chk('o adiantamento: o salário do mês por trás dos 40% (8,37 × 227,33 h) e "referente ao adiantamento"',
  ta.includes('Salário do mês: R$ 1.902,75 (227,33 h)') && ta.includes('40%') && ta.includes('761,10') && ta.includes('referente ao adiantamento salarial de outubro de 2026'), ta);
pdf = recibosPdf(DocFalso, [um], { vias: 2 });
const t2 = pdf.textos.map(x => x.t);
chk('duas vias: o mesmo recibo duas vezes na página, cada uma com o nome da via', pdf.paginas === 1 && pdf.cortes === 1 && t2.includes('Via do empregador') && t2.includes('Via do funcionário'));
pdf = recibosPdf(DocFalso, [{ empresa: { nome: 'EMPRESA — TESTE' }, funcionario: {}, recibo: { ...salvo, pagamento: null, tipo: 'decimo1', competencia: '2026-11', nome: 'Ana — Teste' } }]);
const t3 = pdf.textos.map(x => x.t).join(' | ');
chk('sem travessão (a fonte do PDF não tem), sem cidade e sem data: as linhas pra preencher; o 13º sem o período',
  !t3.includes('—') && t3.includes('EMPRESA - TESTE') && t3.includes('13º salário - 1ª parcela') && t3.includes('____/____/________') && !t3.includes('Período:')
  && t3.includes('referente à 1ª parcela do 13º salário de 2026'), t3);
chk('o nome do arquivo', nomeDoArquivo({ funcionario: 'Bruna Teste', recibo: salvo }) === 'Recibo Bruna Teste Folha mensal 2026-10.pdf'
  && nomeDoArquivo({ empresa: 'EMPRESA DE TESTE LTDA', recibo: { competencia: '2026-10' }, varios: true }) === 'Recibos EMPRESA DE TESTE LTDA 2026-10.pdf');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
