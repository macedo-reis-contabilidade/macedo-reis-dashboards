// As escalas que cabem depois do fim da 6x1 (assets/js/jornada-escalas.js, 21/11/2026): pra cada turma que precisa
// mudar, as opções de escala, a folga de cada um, quantos ficam em cada dia e o que cada uma exige. As contas são à
// mão, no comentário de cada caso; no fim, uma varredura por todas as semanas possíveis confere as garantias (2 folgas
// em toda semana, nunca 7 dias seguidos, as horas da semana e ninguém a mais nem a menos nas turmas).
// As turmas são inventadas (nada de cliente). Rodar com: node tests/jornada-escalas.test.mjs
import { DECISAO_STF } from '../assets/js/jornada-6x1.js';
import { DIAS, diasDoGrupo, diasPorExtenso, exigencia, escalasSugeridas, escalasDaEmpresa, garantias } from '../assets/js/jornada-escalas.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome, JSON.stringify(obtido) === JSON.stringify(esperado), JSON.stringify(obtido) + ' (esperado ' + JSON.stringify(esperado) + ')');

const base = { codigo: 1, controle: 1, categoria: 101, unidade: 5, horas_mes: 220 };
const seis = { ...base, semana: 'TTTTTTF', min_semana: 2640, min_maior_dia: 440, horas_semana: 44, empregados: 5 };
const compensado = { ...base, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 528, horas_semana: 44, empregados: 3 };
const fabrica = { ...base, semana: 'TTTTTCF', min_semana: 2640, min_maior_dia: 540, horas_semana: 44, empregados: 57 };
const restaurante = { ...base, semana: 'FTTTTTT', min_semana: 2640, min_maior_dia: 440, horas_semana: 44, empregados: 3 };
const todoDia = { ...base, semana: 'TTTTTTT', min_semana: 3402, min_maior_dia: 486, horas_semana: 44, empregados: 2 };
const parcial = { ...base, semana: 'TTTTTFF', min_semana: 1800, horas_semana: 30, empregados: 1 };
const doze = { ...base, tipo: 4, tipo_escala: 1, semana: null, horas_semana: 42, empregados: 2 };
const semJornada = { ...base, horas_semana: 44, empregados: 1 };
const op = (g, id, etapa = 'e42', opcoes = {}) => escalasSugeridas(g, etapa, opcoes).opcoes.find(o => o.id === id);
const ids = (g, etapa = 'e42', opcoes = {}) => escalasSugeridas(g, etapa, opcoes).opcoes.map(o => o.id);
const semanaDe = o => o.cobertura.nova;

console.log('Os dias da turma hoje:');
igual('TTTTTCF: 5 dias, de segunda a sexta (o sábado compensado não é dia de trabalho)', [diasDoGrupo(compensado).dias, diasDoGrupo(compensado).trabalha, diasDoGrupo(compensado).variavel], [5, [true, true, true, true, true, false, false], false]);
igual('FTTTTTT: 6 dias, com a segunda de folga e o domingo trabalhado', [diasDoGrupo(restaurante).dias, diasDoGrupo(restaurante).trabalha[0], diasDoGrupo(restaurante).trabalha[6]], [6, false, true]);
igual('TTTTTTT: os 7 dias, a folga de hoje roda', [diasDoGrupo(todoDia).dias, diasDoGrupo(todoDia).variavel], [7, true]);
igual('TTTTT-T: o sábado sem informação fica fora', diasDoGrupo({ semana: 'TTTTT-T' }).trabalha[5], false);
igual('o grupo digitado 6x1: de segunda a sábado', diasDoGrupo({ manual: true, dias: 6 }).trabalha, [true, true, true, true, true, true, false]);
igual('o digitado que trabalha no domingo: a folga roda', [diasDoGrupo({ manual: true, dias: 6, domingo: true }).variavel, diasDoGrupo({ manual: true, dias: 6, domingo: true }).dias], [true, 6]);
igual('sem a semana, sem dias', [diasDoGrupo(semJornada), diasDoGrupo(null), diasDoGrupo({ semana: 'FFFFFFF' })], [null, null, null]);
igual('os dias por extenso', ['TTTTTTF', 'FTTTTTT', 'TTTTTCF', 'TTTTT-T', 'TFTFTFF', 'TTFFFFF', 'TTTTTTT'].map(sem => diasPorExtenso(diasDoGrupo({ semana: sem }))),
  ['de segunda a sábado', 'de terça a domingo', 'de segunda a sexta', 'de domingo a sexta', 'segunda, quarta e sexta', 'segunda e terça', 'os 7 dias, com a folga em rodízio']);
igual('o digitado: os dias são suposição, e vem dito; o do Domínio, não', [escalasSugeridas({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }, 'e42').hoje, escalasSugeridas(seis, 'e42').hoje, escalasSugeridas(semJornada, 'e42').hoje,
  escalasSugeridas({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4, domingo: true }, 'e42').hoje],
  [{ texto: 'de segunda a sábado', suposto: true, porque: 'digitado', informado: false }, { texto: 'de segunda a sábado', suposto: false, porque: null, informado: false }, null, { texto: '6 dias por semana, com a folga em rodízio', suposto: false, porque: null, informado: false }]);
igual('nos 7 dias do Domínio, o nome da turma já diz (sem o "hoje")', [escalasSugeridas(todoDia, 'e42').rotulo, escalasSugeridas(todoDia, 'e42').hoje], ['7 dias com folga em rodízio', null]);
// o horário do Domínio sem as horas de cada dia (a entrada igual à saída: a ponte manda os dias sem os minutos) —
// no escritório, quase todos os grupos com os 7 dias são assim. Os dias de lá podem não ser os de verdade: as opções
// saem, como suposição, e o aviso é só do escritório (a tela mostra, o relatório não)
const semHoras7 = { ...todoDia, min_semana: null, min_maior_dia: null, empregados: 3 };
const semHoras6 = { ...base, semana: 'TTTTT-T', min_semana: null, min_maior_dia: null, horas_semana: 44, empregados: 3 };
igual('sem as horas no Domínio, os dias são suposição', [diasDoGrupo(semHoras7).suposto, diasDoGrupo(semHoras7).semHoras, diasDoGrupo(semHoras6).suposto, diasDoGrupo(seis).suposto, diasDoGrupo(seis).semHoras, diasDoGrupo({ manual: true, dias: 6 }).semHoras], [true, true, true, undefined, undefined, undefined]);
const e7 = escalasSugeridas(semHoras7, 'e42'), e6 = escalasSugeridas(semHoras6, 'e42');
igual('os 7 dias sem as horas: as opções do rodízio, com o aviso de que supõem os 7 dias', [e7.opcoes.map(o => o.id), e7.hoje, e7.aviso],
  [['rodizio_3', 'rodizio_2'], null, 'No Domínio o horário desta turma está sem as horas de cada dia: as opções supõem os dias que estão lá (os 7 dias, com a folga em rodízio). Confirme os dias com a empresa antes de combinar.']);
igual('6 dias e um sem horário, sem as horas: os dias de hoje saem como suposição, com o porquê', [e6.opcoes.map(o => o.id), e6.hoje, e6.aviso.includes('(de domingo a sexta)')],
  [['domingo_1_em_3', 'domingo_1_em_2', 'fecha_domingo'], { texto: 'de domingo a sexta', suposto: true, porque: 'sem_horas', informado: false }, true]);
igual('com as horas no Domínio, e no grupo digitado, sem aviso', [seis, compensado, restaurante, todoDia, { manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }].map(g => escalasSugeridas(g, 'e42').aviso), [null, null, null, null, null]);
igual('as opções são as mesmas do grupo com as horas (só muda o que se sabe de hoje)', JSON.stringify(e7.opcoes.map(o => [o.id, o.horario, o.turmas])), JSON.stringify(escalasSugeridas({ ...todoDia, empregados: 3, horas_semana: 44 }, 'e42').opcoes.map(o => [o.id, o.horario, o.turmas])));

console.log('O que cada escala exige:');
igual('8 h por dia: nada, pela Constituição', [exigencia(8, 'e42').nivel, exigencia(8, 'e42').base], ['nada', 'CF, art. 7º, XIII']);
const e84 = exigencia(8.4, 'e42');
chk('8h24 em 16/12/2026 sem convenção: nada, pelo STF, até 15/12/2027, com o aviso da cautelar', e84.nivel === 'nada' && e84.texto.includes('15/12/2027') && e84.base.includes('ADI 8.041') && e84.base.includes('item I') && e84.base.includes('pode ser revista'), e84.texto + ' | ' + e84.base);
const e84c = exigencia(8.4, 'e42', { cct: true });
chk('8h24 com a convenção marcada: vale pela convenção (EC 141, art. 7º), com o "confira a cláusula"', e84c.nivel === 'coletivo' && e84c.texto.includes('vale pela convenção') && e84c.texto.includes('Confira') && e84c.base === 'EC 141, art. 7º');
chk('8h48 em 16/12/2026: só com convenção ou acordo (passa das 8h24)', exigencia(8.8, 'e42').nivel === 'coletivo' && exigencia(8.8, 'e42').texto.includes('Passa das 8h24'));
chk('8h24 em 16/12/2027: só com convenção ou acordo (passa das 8h)', exigencia(8.4, 'e40').nivel === 'coletivo' && exigencia(8.4, 'e40').texto.includes('Passa das 8h por dia'));
DECISAO_STF.vale = false;
chk('se a cautelar do STF cair: 8h24 sem convenção passa a pedir convenção ou acordo', exigencia(8.4, 'e42').nivel === 'coletivo' && exigencia(8.4, 'e42').texto.includes('Passa das 8h por dia'));
DECISAO_STF.vale = true;

console.log('A turma de segunda a sexta com o sábado compensado (44 h, 8h48 por dia, 3 pessoas):');
igual('duas opções: o dia mais curto e um dia bem mais curto', ids(compensado), ['mesmos_dias', 'dia_curto']);
const m = op(compensado, 'mesmos_dias');
// 42 h ÷ 5 dias = 8,4 h = 8h24; 44 − 42 = 2 h por semana, 2 ÷ 5 = 0,4 h = 24 minutos por dia
igual('42 h em 5 dias de 8h24, sem pedir convenção', [m.horasSemana, m.dias, m.horasDia, m.horario, m.exige.nivel], [42, 5, 8.4, '5 dias de 8h24', 'nada']);
igual('ninguém a menos em dia nenhum: 3 de segunda a sexta', semanaDe(m), [[3, 3, 3, 3, 3, 0, 0]]);
chk('a nota diz 2h por semana e 24 minutos por dia', m.notas[0].texto.includes('Saem 2h por semana') && m.notas[0].texto.includes('24 minutos por dia'), m.notas[0].texto);
const c = op(compensado, 'dia_curto');
// 4 dias de 8h48 = 35,2 h; 42 − 35,2 = 6,8 h = 6h48
igual('4 dias de 8h48 e 1 de 6h48: só com convenção ou acordo', [c.horasDia, c.diaCurto, c.horario, c.exige.nivel], [8.8, 6.8, '4 dias de 8h48 e 1 de 6h48', 'coletivo']);
// em 16/12/2027: 40 ÷ 5 = 8 h; 40 − 35,2 = 4,8 h = 4h48
igual('em 16/12/2027: 5 dias de 8h, ou 4 de 8h48 e 1 de 4h48', [op(compensado, 'mesmos_dias', 'e40').horario, op(compensado, 'dia_curto', 'e40').horario, op(compensado, 'mesmos_dias', 'e40').exige.nivel], ['5 dias de 8h', '4 dias de 8h48 e 1 de 4h48', 'nada']);
// a fábrica: 4 × 9 h = 36; 42 − 36 = 6 h
igual('a fábrica de 4 dias de 9h e a sexta de 8h: 4 dias de 9h e 1 de 6h', op(fabrica, 'dia_curto').horario, '4 dias de 9h e 1 de 6h');
// "bem mais curto" só quando o dia curto fica 2 horas ou mais abaixo dos outros (5 dias de 8h30 viram 4 de 8h30 e 1 de 8h)
const meiaHora = { ...base, semana: 'TTTTTCF', min_semana: 2550, min_maior_dia: 510, horas_semana: 44, empregados: 2 };
igual('o título do dia curto: "bem mais curto" com 2 horas ou mais de diferença; senão, "o corte num dia só"',
  [op(fabrica, 'dia_curto').titulo, op(compensado, 'dia_curto').titulo, op(meiaHora, 'dia_curto').titulo, op(meiaHora, 'dia_curto').horario],
  ['Os mesmos dias de hoje, com um dia bem mais curto', 'Os mesmos dias de hoje, com um dia bem mais curto', 'Os mesmos dias de hoje, com o corte num dia só', '4 dias de 8h30 e 1 de 8h']);
// o dia compensado que não é o sábado: de terça a sábado, com a segunda compensada
const tercaASabado = { ...base, semana: 'CTTTTTF', min_semana: 2250, min_maior_dia: 510, horas_semana: 37.5, empregados: 1 };
igual('CTTTTTF: "5x2 com dia compensado", de terça a sábado', [escalasSugeridas(tercaASabado, 'e42').rotulo, escalasSugeridas(tercaASabado, 'e42').hoje.texto, ids(tercaASabado)], ['5x2 com dia compensado', 'de terça a sábado', ['mesmos_dias']]);
igual('a turma grande fica numa linha só: Todos, 57', [op(fabrica, 'mesmos_dias').turmas.length, op(fabrica, 'mesmos_dias').turmas[0].nome, op(fabrica, 'mesmos_dias').turmas[0].pessoas], [1, 'Todos', 57]);
// 4 dias de 9h40 = 38,67 h; 42 − 38,67 = 3,33 h: menos de 4 h não vira dia de trabalho
igual('o dia curto com menos de 4 h não é oferecido', ids({ ...compensado, min_maior_dia: 580 }), ['mesmos_dias']);

console.log('A turma que só está aqui pelo dia mais longo (as horas da semana já cabem):');
// 4 dias de 9h e a sexta de 4h = 40 h: as horas cabem nas 42; o dia de 9h passa das 8h24. Por igual: 40 ÷ 5 = 8 h
const longa = { ...base, semana: 'TTTTTFF', min_semana: 2400, min_maior_dia: 540, horas_semana: 40, empregados: 4 };
const lg = escalasSugeridas(longa, 'e42');
igual('40 h com o dia de 9h: as mesmas horas divididas por igual, 5 dias de 8h, sem pedir nada', [lg.precisa, lg.opcoes.map(o => [o.id, o.titulo, o.horario, o.exige.nivel])],
  [true, [['mesmos_dias', 'Os mesmos dias de hoje, com as horas divididas por igual', '5 dias de 8h', 'nada']]]);
chk('a nota diz que o dia de 9h passa a 8h, e que manter como está pede convenção', lg.opcoes[0].notas[0].texto.includes('o dia mais longo de hoje (9h) passa a 8h') && lg.opcoes[0].notas[0].texto.includes('só com convenção ou acordo coletivo'), lg.opcoes[0].notas[0].texto);
// 4 dias de 10h = 40 h: os mesmos dias pedem convenção; em 5 dias, 8 h
const quatro = { ...base, semana: 'TTTTFFF', min_semana: 2400, min_maior_dia: 600, horas_semana: 40, empregados: 2 };
igual('4 dias de 10h: como está pede convenção; as mesmas horas em 5 dias, não', escalasSugeridas(quatro, 'e42').opcoes.map(o => [o.id, o.titulo, o.horario, o.exige.nivel]),
  [['mesmos_dias', 'Os mesmos dias e as mesmas horas de hoje', '4 dias de 10h', 'coletivo'], ['cinco_dias', 'As mesmas horas em 5 dias, de segunda a sexta', '5 dias de 8h', 'nada']]);

console.log('A turma de segunda a sábado (a 6x1 clássica, 44 h, 5 pessoas):');
igual('três opções', ids(seis), ['seg_a_sex', 'folga_na_semana', 'sabado_alternado']);
const s1 = op(seis, 'seg_a_sex'), s2 = op(seis, 'folga_na_semana'), s3 = op(seis, 'sabado_alternado');
igual('segunda a sexta: o sábado fica sem a turma', semanaDe(s1), [[5, 5, 5, 5, 5, 0, 0]]);
chk('e a própria opção já diz isso (sem a nota do dia vazio)', s1.notas.some(n => n.texto.includes('deixa de trabalhar no sábado')) && !s1.notas.some(n => n.texto.includes('Há dia sem ninguém')));
// 5 pessoas, uma folga em cada dia de segunda a sexta: 4 em cada um desses dias e os 5 no sábado; 5 × 5 = 25 dias-pessoa
igual('a folga no meio da semana: 4 de segunda a sexta e 5 no sábado', [semanaDe(s2), s2.turmas.map(t => t.nome), s2.turmas.map(t => t.folgas[0])], [[[4, 4, 4, 4, 4, 5, 0]], ['Pessoa 1', 'Pessoa 2', 'Pessoa 3', 'Pessoa 4', 'Pessoa 5'], [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6]]]);
// sábado sim, sábado não: A (3) folga sábado na semana 1 e segunda na 2; B (2), o contrário
igual('sábado sim, sábado não: 3 e 2, trocando', [s3.turmas.map(t => [t.nome, t.pessoas]), semanaDe(s3)], [[['Turma A', 3], ['Turma B', 2]], [[3, 5, 5, 5, 5, 2, 0], [2, 5, 5, 5, 5, 3, 0]]]);
igual('em todas: 5 dias de 8h24, 2 folgas por semana e no máximo 5 dias seguidos', [s1, s2, s3].map(o => [o.horario, o.folgasNaSemana, o.seguidos]), [['5 dias de 8h24', 2, 5], ['5 dias de 8h24', 2, 5], ['5 dias de 8h24', 2, 5]]);
igual('ninguém trabalha no domingo: sem a nota do domingo na turma', [[s1, s2, s3].some(o => o.domingo), escalasSugeridas(seis, 'e42').notas.some(n => n.base.includes('10.101'))], [false, false]);
// 7 pessoas: a sétima cai de novo na segunda; segunda 5, de terça a sábado 6
igual('com 7 pessoas: 2 folgam na segunda e 1 em cada um dos outros dias', [op({ ...seis, empregados: 7 }, 'folga_na_semana').turmas.map(t => t.pessoas), semanaDe(op({ ...seis, empregados: 7 }, 'folga_na_semana'))], [[2, 1, 1, 1, 1, 1], [[5, 6, 6, 6, 6, 6, 0]]]);
const um = op({ ...seis, empregados: 1 }, 'folga_na_semana');
chk('com 1 pessoa: os dias de folga ficam sem ninguém, e a opção avisa', um.turmas[0].nome === 'A pessoa' && um.notas.some(n => n.texto.startsWith('Com 1 pessoa só na turma, os dias de folga dela ficam sem ninguém: nesses dias a empresa fecha')), JSON.stringify(um.notas));
chk('com 2 pessoas, a folga no meio da semana não deixa dia vazio (e não avisa)', (() => { const o = op({ ...seis, empregados: 2 }, 'folga_na_semana'); return semanaDe(o)[0].slice(0, 6).every(v => v >= 1) && !o.notas.some(n => n.texto.includes('sem ninguém')); })());
igual('1 pessoa no sábado alternado: uma linha só, com o sábado numa semana e a segunda na outra', (() => { const o = op({ ...seis, empregados: 1 }, 'sabado_alternado'); return [o.turmas.length, o.turmas[0].nome, o.turmas[0].folgas]; })(), [1, 'A pessoa', [[5, 6], [0, 6]]]);

console.log('A turma que trabalha no domingo e folga na segunda (o restaurante, 44 h, 3 pessoas):');
igual('três opções', ids(restaurante), ['domingo_1_em_3', 'domingo_1_em_2', 'fecha_domingo']);
const r3 = op(restaurante, 'domingo_1_em_3'), r2 = op(restaurante, 'domingo_1_em_2'), rf = op(restaurante, 'fecha_domingo');
// a segunda folga roda entre domingo, terça e quarta: em cada semana, 1 dos 3 folga em cada um desses dias
igual('rodízio de 3 semanas: 2 no domingo, na terça e na quarta, 3 de quinta a sábado, em toda semana', semanaDe(r3), [[0, 2, 2, 3, 3, 3, 2], [0, 2, 2, 3, 3, 3, 2], [0, 2, 2, 3, 3, 3, 2]]);
igual('cada um com 1 domingo de folga nas 3 semanas, no máximo 5 dias seguidos', [r3.turmas.map(t => t.trabalha.filter(sem => !sem[6]).length), r3.domingo, r3.seguidos, r3.ciclo], [[1, 1, 1], { folga: 1, em: 3 }, 5, 3]);
igual('a segunda fica fora da conta de quem fica (já era a folga de todos)', r3.cobertura.dias.map(x => DIAS[x.dia]), ['ter', 'qua', 'qui', 'sex', 'sáb', 'dom']);
// rodízio de 2 semanas com 3 pessoas: A (2) folga o domingo numa semana e B (1) na outra
igual('rodízio de 2 semanas: 1 ou 2 no domingo', [r2.turmas.map(t => t.pessoas), semanaDe(r2).map(sem => sem[6]), r2.domingo], [[2, 1], [1, 2], { folga: 1, em: 2 }]);
igual('fechar no domingo: ninguém no domingo', [semanaDe(rf)[0][6], rf.domingo], [0, null]);
chk('a turma leva, uma vez, a regra do domingo do comércio e a das mulheres (o TST dito como o TST)', (() => { const n = escalasSugeridas(restaurante, 'e42').notas.filter(x => x.base === 'Lei 10.101/2000, art. 6º, parágrafo único; CLT, art. 386');
  return n.length === 1 && n[0].texto.includes('1 a cada 3 semanas') && n[0].texto.includes('1 a cada 15 dias') && n[0].texto.includes('o TST entende') && ![r3, r2, rf].some(o => o.notas.some(x => x.base.includes('10.101'))); })());
chk('a turma dos 7 dias e a que trabalha todo domingo também levam', [todoDia, { ...base, semana: 'TTTTFFT', horas_semana: 44, min_semana: 2640, empregados: 2 }, { manual: true, escala: '5x2', dias: 5, horas: 44, empregados: 3, domingo: true }]
  .every(g => escalasSugeridas(g, 'e42').notas.some(x => x.base.includes('10.101'))));
// a folga fixa na quarta: os dias mais perto são a quinta e a terça
const rq = op({ ...restaurante, semana: 'TTFTTTT' }, 'domingo_1_em_3');
chk('com a folga fixa na quarta: a outra roda entre domingo, quinta e terça, e nunca passa de 6 dias seguidos', rq.titulo.includes('na quarta') && rq.notas[0].texto.includes('na quinta e na terça') && rq.seguidos <= 6, rq.notas[0].texto + ' / ' + rq.seguidos);
// meio período: 30 h em 6 dias não reduz as horas, só ganha a folga: 30 ÷ 5 = 6 h por dia
igual('30 h em 6 dias: 5 dias de 6h, sem pedir nada', [op({ ...restaurante, horas_semana: 30, min_semana: 1800, min_maior_dia: 300 }, 'domingo_1_em_3').horario, op({ ...restaurante, horas_semana: 30 }, 'domingo_1_em_3').exige.base], ['5 dias de 6h', 'CF, art. 7º, XIII']);

console.log('O intervalo, quando o dia passa das 6 horas:');
// 36 h em 6 dias de 6 h (15 minutos de intervalo); em 5 dias, 36 ÷ 5 = 7,2 h = 7h12: passa das 6 h, e o intervalo mínimo vira 1 hora
const seisHoras = { ...base, semana: 'TTTTTTF', min_semana: 2160, min_maior_dia: 360, horas_semana: 36, empregados: 3 };
const o36 = op(seisHoras, 'seg_a_sex');
chk('36 h de 6 dias de 6h viram 5 dias de 7h12, e a opção avisa do intervalo de 1 hora (CLT, art. 71)', o36.horario === '5 dias de 7h12' && o36.exige.nivel === 'nada'
  && o36.notas.some(n => n.texto === 'O dia passa das 6 horas (hoje, 6h): o intervalo mínimo deixa de ser de 15 minutos e passa a 1 hora.' && n.base === 'CLT, art. 71, caput e § 1º'), JSON.stringify(o36.notas));
igual('nas três opções da turma', escalasSugeridas(seisHoras, 'e42').opcoes.map(o => o.notas.some(n => n.base.startsWith('CLT, art. 71, caput'))), [true, true, true]);
igual('quem já passa das 6 h hoje (44 h) e quem não passa nem depois (30 h em 6 dias: 5 dias de 6h) ficam sem o aviso',
  [op(seis, 'seg_a_sex'), op({ ...restaurante, horas_semana: 30, min_semana: 1800, min_maior_dia: 300 }, 'fecha_domingo')].map(o => o.notas.some(n => n.base.startsWith('CLT, art. 71, caput'))), [false, false]);
// o digitado não tem o dia mais longo: 36 h ÷ 6 dias = 6 h
chk('no grupo digitado, o dia de hoje sai das horas pelos dias', op({ manual: true, escala: '6x1', dias: 6, horas: 36, empregados: 2 }, 'seg_a_sex').notas.some(n => n.texto.includes('(hoje, 6h)')));

console.log('A turma que aparece nos 7 dias (a folga de hoje roda):');
igual('duas opções', ids(todoDia), ['rodizio_3', 'rodizio_2']);
const t3 = op(todoDia, 'rodizio_3'), t2 = op(todoDia, 'rodizio_2');
igual('sem o retrato de hoje (a folga não está no Domínio), com os 7 dias na conta de quem fica', [t3.cobertura.hoje, t3.cobertura.dias.length, t3.cobertura.dias.every(x => x.hoje === null)], [null, 7, true]);
igual('rodízio de 3 semanas: 2 folgas por semana, no máximo 5 dias seguidos, 1 domingo a cada 3, o sábado sempre cheio', [t3.folgasNaSemana, t3.seguidos, t3.domingo, semanaDe(t3).map(sem => sem[5])], [2, 5, { folga: 1, em: 3 }, [2, 2, 2]]);
igual('rodízio de 2 semanas: no máximo 5 dias seguidos, 1 domingo a cada 2', [t2.seguidos, t2.domingo], [5, { folga: 1, em: 2 }]);
// 2 pessoas no rodízio de 2 semanas: uma folga segunda e domingo, a outra quarta e quinta, e trocam; terça, sexta e sábado sempre com as 2
igual('no rodízio de 2 semanas ninguém folga na terça, na sexta nem no sábado', [semanaDe(t2), t2.notas[0].texto.includes('ninguém folga na terça, na sexta nem no sábado')], [[[1, 2, 1, 1, 2, 2, 1], [1, 2, 1, 1, 2, 2, 1]], true]);
chk('os rodízios dizem que os dias do meio da semana podem ser outros', [t3, t2, r3, r2].every(o => o.notas[0].texto.includes('podem cair em outros dias, mantidas as 2 por semana e sem passar de 6 dias seguidos')));
igual('o digitado 6x1 que trabalha no domingo cai no mesmo caso', ids({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4, domingo: true }), ['rodizio_3', 'rodizio_2']);

console.log('Quem não ganha opção, e por quê:');
const sp = escalasSugeridas(parcial, 'e42');
igual('30 h em 5 dias: nada a mudar', [sp.precisa, sp.opcoes.length, sp.motivo], [false, 0, 'Nada a mudar nesta data: a escala de hoje continua.']);
igual('a 12x36 cabe nas 42 h: nada a mudar', escalasSugeridas(doze, 'e42').opcoes.length, 0);
const ss = escalasSugeridas(semJornada, 'e42');
chk('sem a semana no Domínio: precisa mudar, mas a escala depende do que a empresa informar', ss.precisa && !ss.opcoes.length && ss.motivo.includes('Sem os dias da semana'));
chk('o externo (CLT, art. 62): as 2 folgas, caso a caso', escalasSugeridas({ ...seis, controle: 2 }, 'e42').motivo.includes('art. 62'));
igual('a empresa: só as turmas que precisam mudar', escalasDaEmpresa([seis, compensado, parcial, doze, semJornada], 'e42').map(x => [x.escalas.rotulo, x.escalas.opcoes.length]), [['6x1', 3], ['5x2 com o sábado compensado', 2], ['Sem jornada no Domínio', 0]]);
// a jornada marcada 12x36 no Domínio com horário de semana: vale a semana, e a turma ganha as mesmas opções
// do grupo sem a marca (antes saía como 12x36: "nada a mudar", sem escala nenhuma)
const semTurma = e => JSON.stringify({ ...e, rotulo: null });
for (const [nome, g] of [['TTTTTCF', compensado], ['TTTTTTF', seis], ['FTTTTTT', restaurante], ['TTTTTTT', todoDia]]) for (const etapa of ['e42', 'e40']) {
  const com = escalasSugeridas({ ...g, tipo_escala: 1 }, etapa), sem = escalasSugeridas(g, etapa);
  chk(nome + ' marcada 12x36, em ' + etapa + ': as mesmas opções do grupo sem a marca (' + sem.opcoes.length + ')', sem.opcoes.length > 0 && com.rotulo === sem.rotulo && semTurma(com) === semTurma(sem), com.opcoes.map(o => o.id).join());
}

console.log('Os grupos digitados na tela:');
igual('6x1 digitado: as três opções de segunda a sábado', ids({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }), ['seg_a_sex', 'folga_na_semana', 'sabado_alternado']);
igual('5x2 digitado de 44 h: o dia mais curto (sem o dia mais longo de hoje, não há o "dia bem mais curto")', ids({ manual: true, escala: '5x2', dias: 5, horas: 44, empregados: 2 }), ['mesmos_dias']);
// 4 dias: 42 ÷ 4 = 10,5 h por dia (só com convenção); em 5 dias, 8h24
const q = escalasSugeridas({ manual: true, escala: '4x3', dias: 4, horas: 44, empregados: 2 }, 'e42');
igual('4x3 de 44 h: os mesmos 4 dias pedem convenção; as mesmas horas em 5 dias, não', q.opcoes.map(o => [o.id, o.horario, o.exige.nivel]), [['mesmos_dias', '4 dias de 10h30', 'coletivo'], ['cinco_dias', '5 dias de 8h24', 'nada']]);
const v = escalasSugeridas({ manual: true, escala: '5x2', dias: 5, horas: 44, empregados: 3, domingo: true }, 'e42').opcoes[0];
igual('5 dias com o domingo no meio: muda só o tamanho do dia, sem grade', [v.id, v.semGrade, v.turmas, v.cobertura.nova, garantias(v), v.notas[0].texto.startsWith('A folga segue em rodízio, como hoje.')], ['mesmos_dias', true, [], null, '', true]);
igual('sem grade nenhuma, a nota dos dias seguidos não entra', escalasSugeridas({ manual: true, escala: '5x2', dias: 5, horas: 44, empregados: 3, domingo: true }, 'e42').notas.some(n => n.base.includes('OJ 410')), false);

console.log('Com a convenção marcada, em 16/12/2027 e sem a cautelar do STF:');
chk('com a convenção: as 8h24 valem por ela', op(seis, 'seg_a_sex', 'e42', { cct: true }).exige.texto.includes('vale pela convenção'));
igual('em 16/12/2027: 5 dias de 8h (40 h), sem pedir nada, e sem a nota de 2027', [op(seis, 'seg_a_sex', 'e40').horario, op(seis, 'seg_a_sex', 'e40').horasSemana, op(seis, 'seg_a_sex', 'e40').exige.nivel, escalasSugeridas(seis, 'e40').notas.some(n => n.texto.includes('16/12/2027'))], ['5 dias de 8h', 40, 'nada', false]);
chk('em 16/12/2026: o intervalo, a nota de 2027, a convenção e os dias seguidos (TST, OJ 410)', (() => { const n = escalasSugeridas(seis, 'e42').notas; return n.length === 4 && n[0].base === 'CLT, art. 71, § 2º' && n[1].texto.includes('16/12/2027') && n[2].base.includes('item IV') && n[3].base === 'TST, OJ 410 da SDI-1' && n[3].texto.includes('6 dias seguidos'); })());
DECISAO_STF.vale = false;
igual('sem a cautelar e sem convenção: 40 h já em 16/12/2026, 5 dias de 8h', [op(seis, 'seg_a_sex').horario, op(seis, 'seg_a_sex').horasSemana, op(seis, 'seg_a_sex').exige.nivel], ['5 dias de 8h', 40, 'nada']);
DECISAO_STF.vale = true;

console.log('A frase das garantias e o resumo que vai pra escolha do plano:');
igual('segunda a sexta: 2 folgas e no máximo 5 dias seguidos', garantias(s1), 'Toda semana com 2 folgas e no máximo 5 dias seguidos de trabalho.');
igual('o rodízio com o domingo diz o domingo', garantias(r3), 'Toda semana com 2 folgas e no máximo 5 dias seguidos de trabalho; 1 domingo de folga a cada 3 semanas.');
igual('o resumo (curto: o campo da escolha tem 300 letras)', [s1.resumo, s3.resumo, r3.resumo], ['6x1 (5 pessoas): segunda a sexta, 5 dias de 8h24', '6x1 (5 pessoas): sábado sim, sábado não, 5 dias de 8h24',
  '6x1 (3 pessoas): folga fixa na segunda, com 1 domingo de folga a cada 3 semanas, 5 dias de 8h24']);

console.log('Os dias informados pelo escritório (21/11/2026):');
const marc7 = { ...todoDia, jornada: 22, min_semana: null, min_maior_dia: null, empregados: 3 };
const comInf = (g, semana, dias) => ({ ...g, informado: { semana, dias } });
igual('os dias informados mandam: de segunda a sábado, cada um 6', [diasDoGrupo(comInf(marc7, 'TTTTTTF', 6)).trabalha, diasDoGrupo(comInf(marc7, 'TTTTTTF', 6)).dias, diasDoGrupo(comInf(marc7, 'TTTTTTF', 6)).variavel, diasDoGrupo(comInf(marc7, 'TTTTTTF', 6)).informado, diasDoGrupo(comInf(marc7, 'TTTTTTF', 6)).suposto],
  [[true, true, true, true, true, true, false], 6, false, true, undefined]);
igual('por extenso, com a folga em rodízio entre os dias marcados',
  [['TTTTTTF', 6], ['TTTTTTT', 6], ['TTTTTTF', 5], ['TTTTTTT', 5], ['TFTFTTF', 3], ['FTTTTTT', 6]].map(([sem, d]) => diasPorExtenso(diasDoGrupo(comInf(marc7, sem, d)))),
  ['de segunda a sábado', '6 dias por semana, com a folga em rodízio', '5 dias por semana, de segunda a sábado, com a folga em rodízio', '5 dias por semana, com as folgas em rodízio',
   '3 dias por semana entre segunda, quarta, sexta e sábado, com a folga em rodízio', 'de terça a domingo']);
const e7i = escalasSugeridas(comInf(marc7, 'TTTTTTF', 6), 'e42');
igual('os 7 dias sem as horas, informados de segunda a sábado: as opções de segunda a sábado, sem o aviso, com os dias de hoje ditos',
  [e7i.rotulo, e7i.opcoes.map(o => o.id), e7i.aviso, e7i.hoje], ['6x1', ['seg_a_sex', 'folga_na_semana', 'sabado_alternado'], null, { texto: 'de segunda a sábado', suposto: false, porque: null, informado: true }]);
const e7r = escalasSugeridas(comInf(marc7, 'TTTTTTT', 6), 'e42');
igual('informados os 7 dias, cada um 6: o rodízio, com o rótulo e os dias de hoje', [e7r.rotulo, e7r.opcoes.map(o => o.id), e7r.hoje.texto], ['6x1 com a folga em rodízio', ['rodizio_3', 'rodizio_2'], '6 dias por semana, com a folga em rodízio']);
const e5r = escalasSugeridas(comInf(marc7, 'TTTTTTF', 5), 'e42');
igual('de segunda a sábado, cada um 5 (a folga roda): o dia mais curto, sem grade (a folga segue em rodízio)', [e5r.opcoes.map(o => [o.id, o.semGrade, o.horario]), e5r.opcoes[0].notas[0].texto.startsWith('A folga segue em rodízio, como hoje.')],
  [[['mesmos_dias', true, '5 dias de 8h24']], true]);
igual('a jornada sem a semana, informada de segunda a sexta: o dia mais curto, com a grade', ids(comInf(semJornada, 'TTTTTFF', 5)), ['mesmos_dias']);
igual('o digitado com os dias informados (de terça a domingo): as opções de quem trabalha no domingo, sem a suposição',
  [ids(comInf({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }, 'FTTTTTT', 6)), escalasSugeridas(comInf({ manual: true, escala: '6x1', dias: 6, horas: 44, empregados: 4 }, 'FTTTTTT', 6), 'e42').hoje],
  [['domingo_1_em_3', 'domingo_1_em_2', 'fecha_domingo'], { texto: 'de terça a domingo', suposto: false, porque: null, informado: true }]);
igual('o informado em quem não precisa (o Domínio com os dias) não muda nada', JSON.stringify(escalasSugeridas(comInf(seis, 'TTTTTFF', 5), 'e42')), JSON.stringify(escalasSugeridas(seis, 'e42')));
// a varredura dos dias informados: toda semana marcada (1 a 7 dias) e todo número de dias por pessoa que cabe nela
let vistasInf = 0; const errosInf = [];
for (let bits = 1; bits < 128; bits++) {
  const sem = Array.from({ length: 7 }, (_, d) => (bits >> d) & 1 ? 'T' : 'F').join('');
  const cobre = [...sem].filter(x => x === 'T').length;
  for (let d = 1; d <= Math.min(6, cobre); d++) for (const n of [1, 3, 7]) for (const etapa of ['e42', 'e40']) {
    const r = escalasSugeridas(comInf({ ...marc7, empregados: n }, sem, d), etapa);
    const onde = sem + '/' + d + ' n=' + n + ' ' + etapa + ': ';
    if (!r.precisa || !r.opcoes.length) { errosInf.push(onde + 'sem opção'); continue; }
    if (r.aviso || !(r.hoje === null || r.hoje.informado)) errosInf.push(onde + 'o aviso ou os dias de hoje');
    for (const o of r.opcoes) {
      vistasInf++;
      const horas = o.diaCurto != null ? (o.dias - 1) * o.horasDia + o.diaCurto : o.dias * o.horasDia;
      if (Math.abs(horas - o.horasSemana) > 0.01 || o.horasSemana !== (etapa === 'e42' ? 42 : 40)) errosInf.push(onde + o.id + ' as horas');
      for (const l of [o.titulo, o.horario, o.resumo, o.exige.texto, ...o.notas.map(x => x.texto)]) if (/undefined|NaN|null|Infinity/.test(l)) errosInf.push(onde + 'texto quebrado: ' + l);
      if (o.semGrade) continue;
      if (o.turmas.reduce((a, t) => a + t.pessoas, 0) !== n) errosInf.push(onde + o.id + ' as turmas');
      if (!(o.folgasNaSemana >= 2) || !(o.seguidos <= 6)) errosInf.push(onde + o.id + ' as folgas ou os dias seguidos');
      for (const t of o.turmas) for (const w of t.trabalha) if (w.filter(Boolean).length !== o.dias) errosInf.push(onde + o.id + ' os dias de trabalho');
    }
  }
}
chk(vistasInf + ' opções com os dias informados: as horas, as 2 folgas, os dias seguidos e as turmas', !errosInf.length && vistasInf > 2000, errosInf.slice(0, 5).join(' | ') + ' (' + errosInf.length + ' erro(s))');

console.log('A varredura: todas as semanas possíveis, de 1 a 12 pessoas, nas duas datas, com e sem convenção:');
let opcoesVistas = 0, erros = [];
for (let bits = 1; bits < 128; bits++) {
  const sem = Array.from({ length: 7 }, (_, d) => (bits >> d) & 1 ? 'T' : 'F').join('');
  const dias = [...sem].filter(x => x === 'T').length;
  for (const n of [1, 2, 3, 4, 5, 7, 12]) for (const etapa of ['e42', 'e40']) for (const cct of [false, true]) {
    const g = { ...base, semana: sem, horas_semana: 44, min_semana: 2640, min_maior_dia: Math.round(2640 / dias), empregados: n };
    const r = escalasSugeridas(g, etapa, { cct });
    if (!r.precisa) { erros.push(sem + ': 44 h devia precisar mudar'); continue; }
    if (!r.opcoes.length) erros.push(sem + ': sem opção');
    for (const o of r.opcoes) {
      opcoesVistas++;
      const onde = sem + ' n=' + n + ' ' + etapa + (cct ? ' cct ' : ' ') + o.id + ': ';
      const horas = o.diaCurto != null ? (o.dias - 1) * o.horasDia + o.diaCurto : o.dias * o.horasDia;
      if (Math.abs(horas - o.horasSemana) > 0.01) erros.push(onde + 'as horas da semana não fecham (' + horas + ' × ' + o.horasSemana + ')');
      if (o.horasSemana !== (etapa === 'e42' ? 42 : 40)) erros.push(onde + 'o limite da data');
      if (o.semGrade) continue;
      if (o.turmas.reduce((s, t) => s + t.pessoas, 0) !== n) erros.push(onde + 'as turmas não somam as pessoas');
      if (!(o.folgasNaSemana >= 2)) erros.push(onde + 'semana com menos de 2 folgas');
      if (!(o.seguidos <= 6)) erros.push(onde + o.seguidos + ' dias seguidos');
      for (const t of o.turmas) for (const s of t.trabalha) if (s.filter(Boolean).length !== o.dias) erros.push(onde + 'semana com ' + s.filter(Boolean).length + ' dias de trabalho');
      for (const s of o.cobertura.nova) if (s.reduce((a, b) => a + b, 0) !== n * o.dias) erros.push(onde + 'os dias-pessoa da semana não fecham');
      if (o.domingo && o.ciclo > 1 && o.domingo.folga < 1) erros.push(onde + 'rodízio sem domingo de folga');
      if (!['nada', 'coletivo'].includes(o.exige.nivel) || !o.exige.texto || !o.exige.base) erros.push(onde + 'sem o que exige');
      for (const l of [o.titulo, o.horario, o.resumo, garantias(o), o.exige.texto, ...o.notas.map(x => x.texto)]) if (/undefined|NaN|null|Infinity/.test(l)) erros.push(onde + 'texto quebrado: ' + l);
      if (!garantias(o)) erros.push(onde + 'sem a frase das garantias');
      // com 2 pessoas ou mais, nenhum dia de trabalho de hoje fica vazio, salvo nas opções que fecham um dia de propósito
      if (n >= 2 && !['seg_a_sex', 'fecha_domingo'].includes(o.id)) {
        if (o.cobertura.dias.some(x => (x.hoje == null || x.hoje > 0) && x.min < 1)) erros.push(onde + 'dia vazio');
        if (o.notas.some(x => x.texto.includes('sem ninguém'))) erros.push(onde + 'aviso de dia vazio sem dia vazio');
      }
      if (n === 1 && !['seg_a_sex', 'fecha_domingo', 'mesmos_dias', 'dia_curto', 'cinco_dias'].includes(o.id) && !o.notas.some(x => x.texto.startsWith('Com 1 pessoa só'))) erros.push(onde + '1 pessoa sem o aviso');
    }
  }
}
chk(opcoesVistas + ' opções conferidas: as horas, as 2 folgas, os dias seguidos, as turmas, os dias-pessoa e nenhum dia vazio com 2 pessoas ou mais', !erros.length && opcoesVistas > 5000, erros.slice(0, 5).join(' | ') + ' (' + erros.length + ' erro(s), ' + opcoesVistas + ' opções)');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
