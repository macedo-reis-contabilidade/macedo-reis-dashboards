// O fim da escala 6x1 (assets/js/jornada-6x1.js, 09/11/2026): o padrão de cada grupo do Domínio, o que cada etapa
// da EC 141/2026 pede (42 h e 2 folgas em 16/12/2026; 40 h em 16/12/2027), o resumo da empresa e as contas do
// simulador (contratar, hora extra, reduzir). Os números são contas à mão, no comentário de cada caso.
// Rodar com: node tests/jornada-6x1.test.mjs
import {
  DATA_42, DATA_40, DECISAO_STF, DECRETO, PORTARIA, repousosDoMes, diaMaxDaEtapa, padraoDoGrupo, diagnostico, resumoDaEmpresa, limiteDaEtapa, salarioArt8, encargosDoRegime,
  custoMensal, salarioMedio, simular, fmtHoras, fmtReais, PROVISOES,
  informadoValido, precisaDosDias, informadoDe, chaveDaTurma, comOsDiasInformados, diasParaGravar
} from '../assets/js/jornada-6x1.js';
import { relatorioJornadaPdf, limpar } from '../assets/js/jornada-6x1-pdf.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome, JSON.stringify(obtido) === JSON.stringify(esperado), JSON.stringify(obtido) + ' (esperado ' + JSON.stringify(esperado) + ')');
const r2 = v => Math.round(v * 100) / 100;

// os grupos de uma empresa de mentira
const seis = { codigo: 1, jornada: 10, semana: 'TTTTTTF', min_semana: 2640, min_maior_dia: 440, horas_semana: 44, horas_mes: 220, controle: 1, categoria: 101, unidade: 5, empregados: 5, salarios: 10000 };
const compensado = { codigo: 1, jornada: 11, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 528, horas_semana: 44, horas_mes: 220, controle: 1, categoria: 101, unidade: 5, empregados: 3, salarios: 7500 };
const doze = { codigo: 1, jornada: 12, tipo: 4, tipo_escala: 1, semana: null, horas_semana: 42, horas_mes: 180, controle: 1, categoria: 101, unidade: 5, empregados: 2, salarios: 5000 };
const horista = { codigo: 1, jornada: 10, semana: 'TTTTTTF', min_semana: 2640, horas_semana: 44, horas_mes: 220, controle: 1, categoria: 101, unidade: 1, empregados: 2, salarios: 30 };
const semJornada = { codigo: 1, jornada: null, horas_semana: 44, horas_mes: 220, controle: 1, categoria: 101, empregados: 1, salarios: 2200 };
const parcial = { codigo: 1, jornada: 13, semana: 'TTTTTFF', min_semana: 1800, horas_semana: 30, controle: 1, categoria: 101, empregados: 1, salarios: 1500 };

console.log('As datas da EC 141/2026 (publicada em 16/10/2026):');
igual('as 42 h e as 2 folgas: 2 meses depois, 16/12/2026', DATA_42, '2026-12-16');
igual('as 40 h: 1 ano depois, 16/12/2027', DATA_40, '2027-12-16');
igual('o salário do art. 8º em 2026: 2,5 × R$ 8.475,55 = R$ 21.188,875 → R$ 21.188,88', salarioArt8(2026), 21188.88);
igual('ano sem teto cadastrado usa o mais recente', salarioArt8(2031), 21188.88);
// o STF (ADI 8.041, 12/11/2026, item I): sem convenção até 15/12/2026, 42 h em 5 dias de até 8h24 (8,4 h × 5 = 42)
igual('a decisão do STF está ligada, com as 8h24 até 15/12/2027', [DECISAO_STF.vale, DECISAO_STF.diaMax, DECISAO_STF.ate, DECISAO_STF.revisao], [true, 8.4, '2027-12-15', '2027-03-16']);
igual('o limite que dá pra usar em 5 dias: 42 h em 16/12/2026, com ou sem convenção (STF); 40 h em 2027', [limiteDaEtapa('e42'), limiteDaEtapa('e42', { cct: true }), limiteDaEtapa('e40', { cct: true })], [42, 42, 40]);
igual('o dia mais longo sem compensação: 8h24 em 2026 sem convenção, 8 h com ela e em 2027', [diaMaxDaEtapa('e42'), diaMaxDaEtapa('e42', { cct: true }), diaMaxDaEtapa('e40')], [8.4, 8, 8]);
DECISAO_STF.vale = false;
igual('se o Plenário não referendar: sem convenção, 40 h já em 16/12/2026, e 8 h por dia', [limiteDaEtapa('e42'), diaMaxDaEtapa('e42')], [40, 8]);
DECISAO_STF.vale = true;

console.log('O padrão de cada grupo:');
const p6 = padraoDoGrupo(seis);
igual('TTTTTTF é 6x1: 6 dias, 1 folga, 44 h, sem domingo', [p6.escala, p6.dias, p6.folgas, p6.horas, p6.domingo, p6.sabado], ['6x1', 6, 1, 44, false, true]);
const pc = padraoDoGrupo(compensado);
igual('TTTTTCF é 5x2 com o sábado compensado: 2 dias sem trabalho', [pc.escala, pc.dias, pc.folgas, pc.maiorDia], ['5x2c', 5, 2, 8.8]);
const p12 = padraoDoGrupo(doze);
igual('a 12x36: 3,5 dias e 3,5 folgas por semana', [p12.escala, p12.dias, p12.folgas], ['12x36', 3.5, 3.5]);
igual('sem jornada no Domínio', padraoDoGrupo(semJornada).escala, 'sem_jornada');
igual('a escala de ciclo (4 de 6 dias)', padraoDoGrupo({ ciclo_dias: 6, ciclo_trabalho: 4 }).dias, 4.67);
igual('o grupo digitado na tela', padraoDoGrupo({ manual: true, escala: '6x1', dias: 6, horas: 44 }).folgas, 1);
// o 12x36 digitado é gravado no plano só com o tipo_escala e, ao reabrir, ganha o "manual": tem de seguir 12x36
// (voltava como "sem jornada" e passava a contar como quem muda em 16/12/2027)
const doze36 = { tipo_escala: 1, horas_semana: 42, empregados: 2, salarios: null };
igual('o 12x36 digitado segue 12x36 depois de gravado e reaberto, e não entra em quem muda',
  [padraoDoGrupo(doze36).escala, padraoDoGrupo({ ...doze36, manual: true }).escala, diagnostico({ ...doze36, manual: true }, 'e40').precisa], ['12x36', '12x36', false]);
// os 7 dias marcados no Domínio: a turma cobre a semana toda e a folga de cada um roda (não está lá)
const sete = { codigo: 1, jornada: 14, semana: 'TTTTTTT', min_semana: 3402, min_maior_dia: 486, horas_semana: 44, controle: 1, categoria: 101, unidade: 5, empregados: 2 };
chk('TTTTTTT: "7 dias com folga em rodízio", e o item das folgas diz que a folga de hoje não está no Domínio',
  padraoDoGrupo(sete).rotulo === '7 dias com folga em rodízio' && diagnostico(sete, 'e42').itens[0].texto.startsWith('No Domínio a turma aparece nos 7 dias: a folga de hoje roda e não está lá.'), diagnostico(sete, 'e42').itens[0].texto);
// a marca de 12x36 com horário de semana (existe no Domínio do escritório; a fila de 09/11/2026: "a semana vale"):
// a semana manda, a marca vai em `marcada` e vira um aviso só do escritório (antes, a turma saía como 12x36,
// "cabe no limite", e ficava fora de quem muda e sem escala sugerida)
const marcadaC = { ...compensado, jornada: 21, tipo: 2, tipo_escala: 1 };
const marcada6 = { ...seis, jornada: 22, tipo: 1, tipo_escala: 1, min_semana: 2460 };
const pm = padraoDoGrupo(marcadaC);
igual('TTTTTCF marcada 12x36 no Domínio: vale a semana (5x2 com o sábado compensado, 44 h), e a marca fica guardada', [pm.escala, pm.rotulo, pm.dias, pm.folgas, pm.horas, pm.marcada], ['5x2c', '5x2 com o sábado compensado', 5, 2, 44, '12x36']);
igual('TTTTTTF marcada 12x36: 6x1; marcada 24x72: 6x1 também', [padraoDoGrupo(marcada6).escala, padraoDoGrupo(marcada6).marcada, padraoDoGrupo({ ...seis, tipo_escala: 2 }).escala, padraoDoGrupo({ ...seis, tipo_escala: 2 }).marcada], ['6x1', '12x36', '6x1', '24x72']);
igual('sem a marca, o grupo não ganha o campo', ['marcada' in padraoDoGrupo(compensado), 'marcada' in padraoDoGrupo({ ...compensado, tipo_escala: 0 })], [false, false]);
igual('a marca sem semana, com a semana sem dia de trabalho ou ilegível segue 12x36 (e a de ciclo, 24x72)',
  [null, 'FFFFFFF', '-------', 'TTT'].map(semana => padraoDoGrupo({ tipo_escala: 1, semana }).escala).concat(padraoDoGrupo({ tipo_escala: 2, semana: null, ciclo_dias: 4, ciclo_trabalho: 1 }).escala), ['12x36', '12x36', '12x36', '12x36', '24x72']);
for (const etapa of ['e42', 'e40']) for (const cct of [false, true]) {
  const com = diagnostico(marcadaC, etapa, { cct }), sem = diagnostico(compensado, etapa, { cct });
  igual('o que muda é o do mesmo grupo sem a marca, mais o aviso do cadastro em primeiro (' + etapa + (cct ? ', com convenção' : '') + ')',
    [com.precisa, com.itens.slice(1).map(i => [i.tipo, i.texto]), com.itens[0].tipo, com.itens[0].interno, com.itens.filter(i => i.interno).length],
    [sem.precisa, sem.itens.map(i => [i.tipo, i.texto]), 'conferir', true, 1]);
}
chk('o aviso diz a marca, que a conta segue o horário e o que fazer no Domínio',
  /marcada como 12x36, mas o horário cadastrado é de semana: a conta segue o horário\. Se a turma trabalha mesmo em 12x36, acerte o horário da jornada no Domínio; se não, tire a marca\.$/.test(diagnostico(marcadaC, 'e42').itens[0].texto), diagnostico(marcadaC, 'e42').itens[0].texto);
igual('sem a marca, nenhum aviso do escritório', [seis, compensado, doze, parcial, semJornada].flatMap(g => diagnostico(g, 'e42').itens).filter(i => i.interno).length, 0);
const rm = resumoDaEmpresa([marcadaC, marcada6, doze]);
igual('no resumo da empresa: 5 no 6x1, 3 no 5x2 compensado e só os 2 de verdade na 12x36; 8 mudam em 16/12/2026', [rm.porEscala, rm.seis, rm.e42.pessoas, rm.e40.pessoas], [{ '5x2c': 3, '6x1': 5, '12x36': 2 }, 5, 8, 8]);
// o horário do Domínio sem as horas de cada dia (a entrada igual à saída: a ponte manda a semana sem os minutos):
// os dias de lá podem não ser os de verdade — o grupo segue lido pela semana, com o aviso só do escritório
const semHoras = { ...sete, min_semana: null, min_maior_dia: null };
igual('a semana sem os minutos: o grupo ganha `semHoras`; com os minutos, digitado ou sem a semana, não',
  [padraoDoGrupo(semHoras).semHoras, padraoDoGrupo(semHoras).escala, 'semHoras' in padraoDoGrupo(sete), 'semHoras' in padraoDoGrupo({ manual: true, escala: '6x1', dias: 6, horas: 44 }), 'semHoras' in padraoDoGrupo(semJornada), 'semHoras' in padraoDoGrupo(doze)], [true, '7x0', false, false, false, false]);
const dsh = diagnostico(semHoras, 'e42');
igual('o que muda é o do mesmo grupo com as horas, mais o aviso do cadastro em primeiro', [dsh.precisa, dsh.itens.map(i => i.tipo), dsh.itens[0].interno, dsh.itens.slice(1).some(i => i.interno)], [true, ['conferir', ...diagnostico({ ...sete, min_maior_dia: null }, 'e42').itens.map(i => i.tipo)], true, false]);
chk('o aviso diz que os dias de lá podem não ser os de verdade e o que fazer', /^No Domínio o horário desta jornada está sem as horas de cada dia \(a entrada igual à saída\): os dias de trabalho de lá podem não ser os de verdade\. Confirme os dias e os horários com a empresa/.test(dsh.itens[0].texto), dsh.itens[0].texto);
// o dia compensado que não é o sábado (de terça a sábado, com a segunda compensada)
igual('o rótulo do dia compensado: o sábado, quando é ele; senão, "dia compensado"', ['TTTTTCF', 'CTTTTTF', 'TTCTTTF', 'TCFTTTT', 'TTTTTCC'].map(semana => padraoDoGrupo({ semana, min_semana: 2640, horas_semana: 44 }).rotulo),
  ['5x2 com o sábado compensado', '5x2 com dia compensado', '5x2 com dia compensado', '5x2 com dia compensado', '5x2 com dia compensado']);
igual('domingo trabalhado aparece', padraoDoGrupo({ semana: 'TTTTFFT', horas_semana: 40 }).domingo, true);

console.log('Os dias que o escritório informa, quando o Domínio não os tem (21/11/2026):');
// informado = { semana: T nos dias em que a turma trabalha, de segunda a domingo; dias: quantos dias cada pessoa trabalha, de 1 a 6 }
igual('o informado válido: só T e F, de 1 a 6 dias por pessoa e nunca mais dias por pessoa que os marcados',
  [{ semana: 'TTTTTTF', dias: 6 }, { semana: 'TTTTTTT', dias: 6 }, { semana: 'TTTTTFF', dias: 1 }, { semana: 'TTTTTTT', dias: 7 }, { semana: 'TTTTTCF', dias: 5 },
   { semana: 'TTTTFFF', dias: 5 }, { semana: 'TTTTTTF', dias: '6' }, { semana: 'TTTTTT', dias: 6 }, null, { semana: 'FFFFFFF', dias: 0 }].map(informadoValido),
  [true, true, true, false, false, false, false, false, false, false]);
const marcador7 = { ...sete, jornada: 22, min_semana: null, min_maior_dia: null, empregados: 3 };
const marcador6 = { ...seis, jornada: 23, semana: 'TTTTT-T', min_semana: null, min_maior_dia: null };
const digitado6 = { manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 };
igual('quem precisa que o escritório informe os dias: o horário sem as horas, os 7 dias, sem a semana, a semana sem dia de trabalho e o digitado',
  [marcador7, marcador6, sete, semJornada, { ...seis, semana: 'FFFFFFF' }, digitado6].map(precisaDosDias), [true, true, true, true, true, true]);
igual('não precisa: o Domínio com os dias, a 12x36 (do Domínio ou digitada), a escala de ciclo, o turno, quem está fora do controle e a marcada 12x36 com horário',
  [seis, compensado, parcial, doze, { tipo_escala: 1, horas_semana: 42, empregados: 2, manual: true }, { ciclo_dias: 6, ciclo_trabalho: 4, empregados: 1 }, { tipo: 3, empregados: 1 },
   { ...marcador7, controle: 2 }, { ...compensado, tipo_escala: 1 }].map(precisaDosDias), [false, false, false, false, false, false, false, false, false]);
igual('a chave da turma do Domínio: a jornada; sem ela, os campos do grupo; o digitado não tem chave',
  [chaveDaTurma(marcador7), chaveDaTurma({ ...semJornada, forma: 1 }), chaveDaTurma(digitado6)], ['1:22', '1:-:44/1/1/101/', null]);

const segASab = { semana: 'TTTTTTF', dias: 6 };
const pi = padraoDoGrupo({ ...marcador7, informado: segASab });
igual('os 7 dias sem as horas, informados de segunda a sábado: 6x1, 1 folga, sem domingo, 44 h do contrato, e o que faltava no Domínio',
  [pi.escala, pi.rotulo, pi.dias, pi.folgas, pi.domingo, pi.sabado, pi.horas, pi.informado, pi.faltava, 'semHoras' in pi], ['6x1', '6x1', 6, 1, false, true, 44, true, 'sem_horas', false]);
igual('com mais dias marcados que os de cada pessoa, a folga roda: "6x1 com a folga em rodízio", "5x2 com as folgas em rodízio"',
  [padraoDoGrupo({ ...marcador7, informado: { semana: 'TTTTTTT', dias: 6 } }).rotulo, padraoDoGrupo({ ...marcador7, informado: { semana: 'TTTTTTT', dias: 5 } }).rotulo,
   padraoDoGrupo({ ...marcador7, informado: { semana: 'TTTTTTF', dias: 5 } }).rotulo, padraoDoGrupo({ ...marcador7, informado: { semana: 'TTTTTTT', dias: 6 } }).domingo],
  ['6x1 com a folga em rodízio', '5x2 com as folgas em rodízio', '5x2 com a folga em rodízio', true]);
igual('o que faltava: os 7 dias com as horas, a jornada sem a semana e o digitado (que fica digitado, com as horas dele)',
  [padraoDoGrupo({ ...sete, informado: segASab }).faltava, padraoDoGrupo({ ...semJornada, informado: { semana: 'TTTTTFF', dias: 5 } }).faltava,
   padraoDoGrupo({ ...digitado6, informado: { semana: 'FTTTTTT', dias: 6 } }).faltava, padraoDoGrupo({ ...digitado6, informado: { semana: 'FTTTTTT', dias: 6 } }).manual,
   padraoDoGrupo({ ...digitado6, informado: { semana: 'FTTTTTT', dias: 6 } }).horas, padraoDoGrupo({ ...digitado6, informado: { semana: 'FTTTTTT', dias: 6 } }).domingo],
  ['sete_dias', 'sem_semana', 'digitado', true, 44, true]);
igual('o informado inválido, ou de quem não precisa (o Domínio com os dias, a 12x36 digitada), não conta',
  [padraoDoGrupo({ ...marcador7, informado: { semana: 'TTTTTTT', dias: 7 } }).escala, padraoDoGrupo({ ...seis, informado: { semana: 'TTTTTFF', dias: 5 } }).escala,
   padraoDoGrupo({ tipo_escala: 1, horas_semana: 42, empregados: 2, manual: true, informado: segASab }).escala, informadoDe({ ...seis, informado: segASab })],
  ['7x0', '6x1', '12x36', null]);
// acertado o horário no Domínio (as horas de cada dia, sem os 7 dias), os dias informados deixam de valer: vale o de lá
igual('acertado o Domínio, os dias informados deixam de valer', padraoDoGrupo({ ...marcador7, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 528, informado: segASab }).escala, '5x2c');

const di = diagnostico({ ...marcador7, informado: segASab }, 'e42');
igual('o que muda com os dias informados: o aviso do escritório, as folgas (1 hoje), as horas e o divisor; precisa mudar',
  [di.precisa, di.itens.map(i => i.tipo), di.itens[0].interno, di.itens.filter(i => i.interno).length], [true, ['conferir', 'folgas', 'horas', 'salario'], true, 1]);
igual('o aviso diz o que faltava no Domínio e quando a conta volta a usar o de lá',
  di.itens[0].texto, 'Os dias desta turma são os informados aqui: no Domínio o horário da jornada está sem as horas de cada dia. Acertado o horário da jornada no Domínio, a conta volta a usar o de lá.');
chk('nos 7 dias com as horas, o aviso não diz que volta (a folga de cada um o Domínio não guarda)', diagnostico({ ...sete, informado: { semana: 'TTTTTTT', dias: 6 } }, 'e42').itens[0].texto
  === 'Os dias desta turma são os informados aqui: no Domínio a jornada tem os 7 dias, sem a folga de cada um.');
igual('o digitado com os dias informados não tem aviso do escritório; o que muda é o mesmo de antes', [diagnostico({ ...digitado6, informado: { semana: 'TTTTTTF', dias: 6 } }, 'e42').itens.filter(i => i.interno).length,
  diagnostico({ ...digitado6, informado: { semana: 'TTTTTTF', dias: 6 } }, 'e42').itens.map(i => i.tipo)], [0, diagnostico(digitado6, 'e42').itens.map(i => i.tipo)]);
igual('a jornada sem a semana, informada: sai o "confirmar com a empresa quantos dias trabalha"', diagnostico({ ...semJornada, informado: { semana: 'TTTTTFF', dias: 5 } }, 'e42').itens.map(i => i.tipo), ['conferir', 'horas', 'salario']);

const plano = { '1:22': segASab, '1:-:44/1/1/101/': { semana: 'TTTTTFF', dias: 5 }, '1:10': { semana: 'TTTTTFF', dias: 5 }, '1:99': segASab, '1:23': { semana: 'TTTTTTT', dias: 7 } };
const comDias = comOsDiasInformados([seis, marcador7, marcador6, { ...semJornada, forma: 1 }, digitado6], plano);
igual('os dias do plano entram só nas turmas que precisam e com o informado válido; o digitado fica como está',
  comDias.map(g => g.informado ? g.informado.semana + '/' + g.informado.dias : null), [null, 'TTTTTTF/6', null, 'TTTTTFF/5', null]);
chk('comOsDiasInformados não mexe nos grupos de entrada', !('informado' in marcador7) && comDias[1] !== marcador7);
igual('o que gravar no plano: só as chaves das turmas de agora que precisam, com o informado válido',
  diasParaGravar([seis, marcador7, marcador6, { ...semJornada, forma: 1 }, digitado6], plano), { '1:22': segASab, '1:-:44/1/1/101/': { semana: 'TTTTTFF', dias: 5 } });
igual('dias do plano que não são um objeto não quebram', [comOsDiasInformados([marcador7], null)[0].informado, comOsDiasInformados([marcador7], [segASab])[0].informado, diasParaGravar([marcador7], 'x')], [undefined, undefined, {}]);
const rAntes = resumoDaEmpresa([marcador7, semJornada]), rDepois = resumoDaEmpresa(comOsDiasInformados([marcador7, { ...semJornada, forma: 1 }], plano));
igual('no resumo da empresa: os 3 dos 7 dias viram 6x1, e a jornada sem a semana deixa de estar "a conferir"',
  [rAntes.porEscala, rAntes.e42.semDados, rDepois.porEscala, rDepois.seis, rDepois.e42.semDados, rDepois.e42.pessoas], [{ '7x0': 3, sem_jornada: 1 }, 1, { '6x1': 3, '5x2': 1 }, 3, 0, 4]);


console.log('O que muda em 16/12/2026 (sem convenção: as 8h24 do STF):');
const d6 = diagnostico(seis, 'e42');
igual('6x1 de 44 h: as folgas, as horas (até 42 h) e o divisor; precisa mudar', [d6.precisa, d6.itens.map(i => i.tipo)], [true, ['folgas', 'horas', 'salario']]);
chk('o texto das horas diz 2 h a menos por pessoa e a base cita o STF', d6.itens[1].texto.includes('2 h a menos') && d6.itens[1].base.includes('ADI 8.041') && d6.itens[1].base.includes('referendo'));
chk('a base das folgas diz que o STF tirou as travas', d6.itens[0].base.includes('travas'));
// o dia de 8h24 cabe: 5 dias de 504 min (2.520 min = 42 h) não pedem compensação em 2026; em 2027 (40 h), sim
const oito24 = { ...seis, semana: 'TTTTTFF', min_semana: 2520, min_maior_dia: 504, horas_semana: 42 };
igual('5 × 8h24 = 42 h: nada a mudar em 16/12/2026 (STF, item I)', diagnostico(oito24, 'e42').precisa, false);
chk('o mesmo em 16/12/2027: 2 h a menos e o dia de 8h24 acima das 8 h', (() => { const d = diagnostico(oito24, 'e40'); return d.precisa && d.itens.some(i => i.tipo === 'diaria' && i.texto.includes('8h24')); })());
const dc = diagnostico(compensado, 'e42');
igual('5x2 com sábado compensado: as horas e o dia de 8h48 (acima das 8h24); as folgas já estão', dc.itens.map(i => i.tipo), ['horas', 'diaria', 'salario']);
const dcc = diagnostico(compensado, 'e42', { cct: true });
chk('com convenção, o limite é 42 h (2 h a menos)', dcc.itens[0].texto.includes('42 h') && dcc.itens[0].texto.includes('2 h a menos'));
const dp = diagnostico(parcial, 'e42');
igual('30 h em 5 dias: não reduz e já tem as 2 folgas (EC 141, art. 4º); não precisa mudar', [dp.precisa, dp.itens.map(i => i.tipo)], [false, ['horas']]);
const dh = diagnostico(horista, 'e42');
chk('o horista: a hora sobe 4,76% (44 ÷ 42) pra não perder no mês', dh.itens.some(i => i.tipo === 'salario' && i.texto.includes('4,76%')));
chk('o horista pela Portaria MTE 2.041 (art. 10, §§ 4º e 5º): manter a média do mês dos 12 meses antes de 16/12/2026',
  dh.itens.some(i => i.tipo === 'salario' && i.base.includes('Portaria MTE 2.041/2026, art. 10, §§ 4º e 5º') && i.texto.includes('média dos 12 meses')));
// a portaria: número, dia e o DOU; os repousos do mês no regime compensatório = ⌈2 × dias ÷ 7⌉: 60/7 = 8,57 → 9; 62/7 = 8,86 → 9; 56/7 = 8
igual('a portaria: o número, o dia e o DOU', [PORTARIA.numero, PORTARIA.data, PORTARIA.fonte.includes('in.gov.br')], ['2.041/2026', '2026-11-19', true]);
igual('os repousos do mês no regime compensatório (art. 4º, § 4º): 30, 31 e 28 dias', [repousosDoMes(30), repousosDoMes(31), repousosDoMes(28)], [9, 9, 8]);
chk('as folgas: o regime compensatório da portaria na base (1 a cada 6 dias seguidos)',
  diagnostico(seis, 'e42').itens.some(i => i.tipo === 'folgas' && i.base.includes('art. 4º, §§ 3º e 4º') && i.base.includes('6 dias seguidos')));
const d12a = diagnostico(doze, 'e42'), d12b = diagnostico(doze, 'e40');
chk('a 12x36 cabe nas 42 h de 2026 e fica a conferir nas 40 h de 2027',
  !d12a.precisa && d12a.itens.some(i => i.texto.includes('cabe no limite')) && d12b.itens.some(i => i.tipo === 'conferir' && i.texto.includes('acima das 40 h')));
// o Decreto 13.173, de 19/11/2026 (DOU, edição extra): o divisor 210/200 (art. 5º), a 12x36 (art. 3º) e o turno (art. 2º)
igual('o decreto: o número, o dia e o texto no Planalto', [DECRETO.numero, DECRETO.data, DECRETO.fonte.includes('planalto.gov.br') && DECRETO.fonte.endsWith('d13173.htm')], ['13.173/2026', '2026-11-19', true]);
// 220 ÷ 210 − 1 = 4,76% nas 42 h; 220 ÷ 200 − 1 = 10% nas 40 h
const sal42 = d6.itens.find(i => i.tipo === 'salario'), sal40 = diagnostico(seis, 'e40').itens.find(i => i.tipo === 'salario');
chk('o divisor 210 vem do decreto (art. 5º, I), não é mais leitura; a hora extra fica 4,76% mais cara',
  sal42.base.includes('Decreto 13.173/2026, art. 5º, I') && !sal42.base.includes('leitura') && sal42.texto.includes('210') && sal42.texto.includes('4,76%'), sal42.base);
chk('nas 40 h, o 200 do art. 5º, II (10% mais cara) e o divisor mais favorável fica',
  sal40.base.includes('art. 5º, II') && sal40.base.includes('mais favorável') && sal40.texto.includes('10%'), sal40.base);
const doze40 = d12b.itens.find(i => i.tipo === 'conferir');
chk('a 12x36 nas 40 h: compensar ou pagar hora extra pela convenção (Decreto, art. 3º); nas 42 h, sem o decreto na base',
  doze40.texto.includes('compensar') && doze40.base.includes('Decreto 13.173/2026, art. 3º') && !d12a.itens.find(i => i.tipo === 'conferir').base.includes('Decreto') && doze40.base.includes('Portaria MTE 2.041/2026, art. 8º'));
const dturno = diagnostico({ tipo: 3, empregados: 2, horas_semana: 44 }, 'e42');
chk('o turno variável: a conferir se é turno ininterrupto (6 h por dia, Decreto, art. 2º)',
  dturno.itens.some(i => i.tipo === 'conferir' && i.texto.includes('6 h por dia') && i.base.includes('art. 2º')));
const ds = diagnostico(semJornada, 'e42');
chk('sem a semana no Domínio: a conferir com a empresa', ds.itens[0].tipo === 'conferir');
const dext = diagnostico({ ...seis, controle: 2 }, 'e42');
chk('o externo (art. 62): a conferir, com as folgas', dext.itens.some(i => i.tipo === 'conferir' && i.texto.includes('art. 62')) && dext.itens.some(i => i.tipo === 'folgas'));
const d8 = diagnostico({ ...seis, superior_teto: 1 }, 'e42');
chk('o art. 8º aparece com o salário de 2026', d8.itens.some(i => i.tipo === 'fora' && i.texto.includes('21.188,88')));

console.log('O resumo da empresa:');
const grupos = [seis, compensado, doze, semJornada];
const r = resumoDaEmpresa(grupos);
igual('11 empregados: 5 em 6x1, 3 no sábado compensado, 2 na 12x36, 1 sem jornada', [r.empregados, r.seis, r.porEscala['5x2c'], r.porEscala['12x36'], r.porEscala.sem_jornada], [11, 5, 3, 2, 1]);
// 16/12/2026 sem convenção (as 8h24 do STF): as horas que faltam = 5 × (44 − 42) + 3 × (44 − 42) + 1 × (44 − 42) = 18;
// a 12x36 fica de fora; a presença que falta = 5 × (6 − 5) = 5 dias-pessoa; contratar = ⌈18 ÷ 42⌉ = 1 e ⌈5 ÷ 5⌉ = 1
igual('16/12/2026: 18 h por semana, 5 dias-pessoa, 1 pessoa por cada conta', [r.e42.horasPerdidas, r.e42.presencaPerdida, r.e42.contratarPorHoras, r.e42.contratarPorPresenca], [18, 5, 1, 1]);
// em 16/12/2027: 9 × (44 − 40) = 36; ⌈36 ÷ 40⌉ = 1
igual('16/12/2027: 36 h por semana', r.e40.horasPerdidas, 36);
igual('quem precisa mudar em 16/12/2026: os 5 da 6x1, os 3 do compensado e o sem jornada (o contrato é de 44 h); a 12x36 não', [r.e42.pessoas, r.e42.semDados], [9, 1]);
const rc = resumoDaEmpresa(grupos, { cct: true });
// com convenção: 5 × 2 + 3 × 2 + 1 × 2 = 18 h; ⌈18 ÷ 42⌉ = 1
igual('com convenção, 16/12/2026: 18 h por semana', [rc.e42.horasPerdidas, rc.e42.contratarPorHoras], [18, 1]);

console.log('O custo:');
igual('Simples: o salário, as provisões (1/12 + 1/12 × 4/3) e o FGTS — R$ 2.000 → R$ 2.580,00', custoMensal(2000, encargosDoRegime('Simples Nacional')), 2580);
igual('fora do Simples: × 1,1944 × 1,358 — R$ 2.000 → R$ 3.244,11', custoMensal(2000, encargosDoRegime('Lucro Presumido')), 3244.11);
igual('Anexo IV: 20% + RAT 2% fora do DAS', encargosDoRegime('Simples Nacional', { anexoIV: true }).inss, 0.22);
igual('o salário médio dos grupos (o horista vira mês pelas horas do contrato): (10.000 + 30 × 220) ÷ 7', salarioMedio([seis, horista]), r2((10000 + 30 * 220) / 7));

console.log('O simulador (só a 6x1, Simples, sem convenção, 16/12/2026):');
const s = simular([seis], 'e42', { regime: 'Simples Nacional' });
igual('contratar: 1 pessoa de R$ 2.000 → R$ 2.580,00 por mês', [s.contratar.pessoas, s.porPessoa, s.contratar.mes], [1, 2580, 2580]);
// a hora extra: 5 × (44 − 42) = 10 h por semana × 52 ÷ 12 = 43,33 h no mês; a hora = 2.000 ÷ 210; × 1,5; × 7/6 (o reflexo
// de 1/6 nos 2 repousos, Portaria MTE 2.041/2026, art. 11, § 7º); × 1,1944 (13º e férias); × 1,08 (FGTS)
// à mão: 43,33 × 9,5238 = 412,67; × 1,5 = 619,00; × 7/6 = 722,17; × 1,19444 = 862,59; × 1,08 = 931,60 (931,595…)
const esperado = r2(43.33 * (2000 / 210) * 1.5 * (7 / 6) * (1 + PROVISOES) * 1.08);
igual('a conta à mão da hora extra com o reflexo de 1/6', esperado, 931.6);
igual('hora extra: 43,33 h no mês → R$ ' + fmtReais(esperado), [s.horaExtra.horasMes, s.horaExtra.mes], [43.33, esperado]);
igual('reduzir: 10 h por semana e 5 dias-pessoa a menos', [s.reduzir.horasSemana, s.reduzir.presenca], [10, 5]);
igual('pelas horas só (sem contar a presença), a mesma 1 pessoa', simular([seis], 'e42', { regime: 'Simples', presenca: false }).contratar.pessoas, 1);
igual('o salário digitado na tela troca o de referência', simular([seis], 'e42', { regime: 'Simples', salario: 2500 }).porPessoa, 3225);
igual('o grupo pequeno sem o salário (decisão de 11/11/2026): o de referência é a média da empresa', simular([{ ...seis, empregados: 2, salarios: null }, parcial], 'e42', { regime: 'Simples' }).salario, 1500);
igual('sem salário em grupo nenhum, fica sem (o DP digita)', simular([{ ...seis, empregados: 2, salarios: null }], 'e42', { regime: 'Simples' }).salario, null);

console.log('O relatório pra empresa (um jsPDF de mentira, que guarda os textos):');
class PdfFalso {
  constructor() { this.textos = []; this.paginas = 1; this.salvo = null; }
  setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} line() {}
  splitTextToSize(t) { return String(t).match(/.{1,95}(\s|$)/g) || [String(t)]; }
  text(t) { this.textos.push(String(t)); }
  addPage() { this.paginas++; }
}
const doc = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda', fantasia: 'Teste' }, grupos: [seis, compensado],
  opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: { escolha: '5x2 de segunda a sexta', situacao: 'definido', observacao: 'NUNCA NO PDF' }, hoje: '2026-11-09', dadosAte: '2026-11-09' });
const tudo = doc.textos.join(' ');
chk('as seções: a lei, o retrato, as duas datas, as saídas, a escolha e os próximos passos',
  ['O que diz a lei', 'referendo do Plenário', 'dividido por 210', 'Decreto 13.173/2026', 'Como a empresa está hoje', 'até 16/12/2026', 'até 16/12/2027', 'As saídas', 'O que foi combinado', 'Os próximos passos'].every(t => tudo.includes(t)));
chk('a observação interna não sai no PDF', !tudo.includes('NUNCA NO PDF'));
chk('sem travessão nem reticências (a fonte do jsPDF não tem)', !/[—–…]/.test(tudo));

console.log('As escalas que cabem, no relatório (21/11/2026):');
const junto = tudo.replace(/\s+/g, ' ');
chk('a seção, na data do simulador, com as duas turmas e os dias de hoje de cada uma',
  ['As escalas que cabem a partir de 16/12/2026', '6x1 (5 pessoas): hoje, de segunda a sábado', '5x2 com o sábado compensado (3 pessoas): hoje, de segunda a sexta'].every(t => junto.includes(t)), junto.slice(junto.indexOf('As escalas que cabem'), junto.indexOf('As escalas que cabem') + 400));
chk('as três opções da 6x1 e as duas do sábado compensado, com o horário de cada uma',
  ['Opção 1: Segunda a sexta', 'Opção 2: Segunda a sábado, com uma folga pra cada um no meio da semana', 'Opção 3: Sábado sim, sábado não', '5 dias de 8h24, 42 horas por semana.',
    'Opção 1: Os mesmos dias de hoje, com o dia mais curto', 'Opção 2: Os mesmos dias de hoje, com um dia bem mais curto', '4 dias de 8h48 e 1 de 6h48, 42 horas por semana.'].every(t => junto.includes(t)));
chk('o que as opções exigem: uma vez só quando é o mesmo nas três; em cada uma quando muda',
  junto.includes('até 15/12/2027. Vale pras 3 opções.') && junto.split('Vale pras').length === 2 && junto.includes('Passa das 8h24 por dia: só com convenção ou acordo coletivo.'));
chk('a grade: os dias no cabeçalho, as turmas, quantos ficam e hoje', ['Seg', 'Sáb', 'Dom', 'Todos', 'Pessoa 5', 'Turma A (3 pessoas)', 'Turma B (2 pessoas)', 'Semana 2', 'Ficam', 'Hoje'].every(t => doc.textos.includes(t)));
chk('as notas da turma no fim: o intervalo, 2027, a convenção e os dias seguidos; sem a do domingo (ninguém trabalha no domingo)',
  ['CLT, art. 71, § 2º', 'EC 141, art. 6º, II', 'TST, OJ 410 da SDI-1'].every(t => junto.includes(t)) && !junto.includes('Lei 10.101/2000'));
chk('os próximos passos apontam pras opções', junto.includes('Definir a escala nova de cada grupo (as opções acima são o ponto de partida)'));
// só a 6x1 de 5 pessoas: "Todos" folga sábado e domingo (2); cada uma das 5 folga 1 dia e o domingo (10); nas 2 semanas
// do sábado alternado, 2 turmas com 2 folgas cada (8) = 20 "folga" nas grades
const so6 = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [seis], opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: '2026-11-19' });
igual('as folgas das três grades da 6x1 de 5 pessoas: 2 + 10 + 8', so6.textos.filter(x => x === 'folga').length, 20);
// na de segunda a sexta: ficam 5 de segunda a sexta e 0 no sábado; o domingo fica fora da conta ("-"); hoje, 5 de segunda a sábado
const iFicam = so6.textos.indexOf('Ficam');
igual('quantos ficam e hoje, na opção de segunda a sexta', [so6.textos.slice(iFicam + 1, iFicam + 8), so6.textos.slice(iFicam + 9, iFicam + 16)], [['5', '5', '5', '5', '5', '0', '-'], ['5', '5', '5', '5', '5', '5', '-']]);
const em40 = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [seis, compensado], opcoes: { regime: 'Simples Nacional' }, etapa: 'e40', plano: {}, hoje: '2026-11-21', dadosAte: '2026-11-19' }).textos.join(' ').replace(/\s+/g, ' ');
chk('com a data de 16/12/2027 no simulador: 5 dias de 8h, 40 horas, cabendo nas 8 horas por dia',
  em40.includes('As escalas que cabem a partir de 16/12/2027') && em40.includes('5 dias de 8h, 40 horas por semana.') && em40.includes('Cabe nas 8 horas por dia: não pede convenção nem acordo coletivo. Vale pras 3 opções.'));
const semMudar = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [parcial], opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: null }).textos.join(' ').replace(/\s+/g, ' ');
chk('quem não muda nada não ganha a seção, e os próximos passos ficam como eram', !semMudar.includes('As escalas que cabem') && semMudar.includes('Definir a escala nova de cada grupo e assinar o aditivo'));
const digitada = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [{ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }, semJornada], opcoes: {}, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: null }).textos.join(' ').replace(/\s+/g, ' ');
chk('o grupo digitado sai sem os dias de hoje (são suposição), e a turma sem a semana diz o porquê de não ter opção',
  digitada.includes('6x1 (4 pessoas)') && !digitada.includes('6x1 (4 pessoas): hoje') && digitada.includes('Sem os dias da semana desta turma'));
chk('as escalas também saem sem travessão nem reticências', !/[—–…•]/.test(so6.textos.join(' ') + em40 + digitada));
// a jornada marcada 12x36 com horário de semana: o relatório segue o horário, e o aviso do cadastro fica no escritório
const comMarca = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [marcadaC], opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: '2026-11-19' }).textos.join(' ').replace(/\s+/g, ' ');
chk('a turma marcada 12x36 com horário de semana sai no relatório pelo horário, com o que muda e as escalas',
  comMarca.includes('5x2 com o sábado compensado (3 pessoas)') && comMarca.includes('precisa cair pra 42 h') && comMarca.includes('Opção 1: Os mesmos dias de hoje') && !comMarca.includes('12x36 (3 pessoas)'), comMarca.slice(0, 900));
chk('o aviso do cadastro no Domínio não sai no relatório da empresa', !/Domínio a jornada está marcada|tire a marca|Aviso do escritório/.test(comMarca));
// os dias informados pelo escritório: o relatório diz que vieram da empresa, sem o aviso do escritório
const comInformados = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: comOsDiasInformados([seis, { ...sete, jornada: 22, min_semana: null, min_maior_dia: null, empregados: 3 }], { '1:22': { semana: 'TTTTTTF', dias: 6 } }),
  opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: '2026-11-19' }).textos.join(' ').replace(/\s+/g, ' ');
chk('os dias informados: "Pelo Domínio, em 19/11/2026; os dias de 1 turma, pelo que a empresa informou." e a turma com as escalas de segunda a sábado',
  comInformados.includes('Pelo Domínio, em 19/11/2026; os dias de 1 turma, pelo que a empresa informou.') && (comInformados.match(/6x1 \(3 pessoas\): hoje, de segunda a sábado \(pelo que a empresa informou\)/g) || []).length === 1
  && comInformados.includes('6x1 (5 pessoas): hoje, de segunda a sábado') && !/informados aqui|Aviso do escritório|sem as horas de cada dia/.test(comInformados), comInformados.slice(0, 1400));
const digitadoInformado = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [{ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4, informado: { semana: 'FTTTTTT', dias: 6 } }],
  opcoes: {}, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: null }).textos.join(' ').replace(/\s+/g, ' ');
chk('o grupo digitado com os dias informados sai com os dias de hoje, sem repetir "pelo que a empresa informou" na turma', digitadoInformado.includes('6x1 (4 pessoas): hoje, de terça a domingo')
  && !digitadoInformado.includes('domingo (pelo que a empresa informou)') && digitadoInformado.includes('Pelo que a empresa informou.'), digitadoInformado.slice(0, 900));
const comSemHoras = relatorioJornadaPdf(PdfFalso, { empresa: { nome: 'Empresa Teste Ltda' }, grupos: [{ ...semHoras, empregados: 3 }, { ...seis, semana: 'TTTTT-T', min_semana: null, min_maior_dia: null }], opcoes: { regime: 'Simples Nacional' }, etapa: 'e42', plano: {}, hoje: '2026-11-21', dadosAte: '2026-11-19' }).textos.join(' ').replace(/\s+/g, ' ');
chk('o horário sem as horas: as escalas saem no relatório, sem o aviso do escritório e sem dar os dias de hoje como certos',
  comSemHoras.includes('7 dias com folga em rodízio (3 pessoas)') && comSemHoras.includes('Os 7 dias cobertos, com as folgas em rodízio de 3 semanas') && comSemHoras.includes('6x1 (5 pessoas)')
  && !/sem as horas de cada dia|Aviso do escritório|as opções supõem|hoje, de domingo a sexta/.test(comSemHoras), comSemHoras.slice(0, 1200));
igual('limpar troca o travessão, as reticências e o ≥', limpar('a — b … ≥ c'), 'a - b ... >= c');

console.log('Os números na tela:');
igual('8,4 h → 8h24; 7,333 h → 7h20; 8 h → 8h', [fmtHoras(8.4), fmtHoras(7 + 1 / 3), fmtHoras(8)], ['8h24', '7h20', '8h']);
igual('R$ 1.234,5', fmtReais(1234.5), '1.234,50');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
