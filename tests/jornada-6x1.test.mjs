// O fim da escala 6x1 (assets/js/jornada-6x1.js, 09/11/2026): o padrão de cada grupo do Domínio, o que cada etapa
// da EC 141/2026 pede (42 h e 2 folgas em 16/12/2026; 40 h em 16/12/2027), o resumo da empresa e as contas do
// simulador (contratar, hora extra, reduzir). Os números são contas à mão, no comentário de cada caso.
// Rodar com: node tests/jornada-6x1.test.mjs
import {
  DATA_42, DATA_40, DECISAO_STF, diaMaxDaEtapa, padraoDoGrupo, diagnostico, resumoDaEmpresa, limiteDaEtapa, salarioArt8, encargosDoRegime,
  custoMensal, salarioMedio, simular, fmtHoras, fmtReais, PROVISOES
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
igual('domingo trabalhado aparece', padraoDoGrupo({ semana: 'TTTTFFT', horas_semana: 40 }).domingo, true);

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
const d12a = diagnostico(doze, 'e42'), d12b = diagnostico(doze, 'e40');
chk('a 12x36 cabe nas 42 h de 2026 e fica a conferir nas 40 h de 2027',
  !d12a.precisa && d12a.itens.some(i => i.texto.includes('cabe no limite')) && d12b.itens.some(i => i.tipo === 'conferir' && i.texto.includes('acima das 40 h')));
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
// a hora extra: 5 × (44 − 42) = 10 h por semana × 52 ÷ 12 = 43,33 h no mês; a hora = 2.000 ÷ 210; × 1,5; × 1,4 (as 2 folgas);
// × 1,1944 (13º e férias); × 1,08 (FGTS)
const esperado = r2(43.33 * (2000 / 210) * 1.5 * 1.4 * (1 + PROVISOES) * 1.08);
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
  ['O que diz a lei', 'referendo do Plenário', 'Como a empresa está hoje', 'até 16/12/2026', 'até 16/12/2027', 'As saídas', 'O que foi combinado', 'Os próximos passos'].every(t => tudo.includes(t)));
chk('a observação interna não sai no PDF', !tudo.includes('NUNCA NO PDF'));
chk('sem travessão nem reticências (a fonte do jsPDF não tem)', !/[—–…]/.test(tudo));
igual('limpar troca o travessão, as reticências e o ≥', limpar('a — b … ≥ c'), 'a - b ... >= c');

console.log('Os números na tela:');
igual('8,4 h → 8h24; 7,333 h → 7h20; 8 h → 8h', [fmtHoras(8.4), fmtHoras(7 + 1 / 3), fmtHoras(8)], ['8h24', '7h20', '8h']);
igual('R$ 1.234,5', fmtReais(1234.5), '1.234,50');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
