// =====================================================================
// MACEDO & REIS — As escalas que cabem depois do fim da 6x1 (dp-jornada.html, 21/11/2026, pedido do Samuel: "teremos
// que sugerir escalas para quem precisar"). Puro: sem banco nem tela. Pra cada turma que precisa mudar, duas ou três
// escalas que cabem no limite da data (42 h em 16/12/2026, 40 h em 16/12/2027), com a folga de cada um, as horas por
// dia e quantos ficam em cada dia de trabalho, contra hoje. É ponto de partida pra conversa com a empresa: a turma
// vem do Domínio somada (sem nome), então as pessoas saem como "Turma A" ou "Pessoa 1".
//
// As regras que as escalas respeitam (as da emenda estão em jornada-6x1.js):
// - 2 dias de repouso em toda semana, de segunda a domingo (CF, art. 7º, XV, na redação da EC 141/2026);
// - nunca 7 dias seguidos de trabalho (TST, OJ 410 da SDI-1: o repouso depois do sétimo dia consecutivo viola o
//   art. 7º, XV, e se paga em dobro) — o teste confere cada escala, inclusive na virada do ciclo;
// - o dia de trabalho: 8 h; em 16/12/2026, sem convenção nem acordo coletivo, até 8h24 (STF, ADI 8.041 e 8.042, item
//   I, enquanto a cautelar valer); acima disso, só com convenção ou acordo coletivo (EC 141, art. 7º; CF, art. 7º, XIII);
// - o domingo de quem trabalha no domingo: no comércio, o repouso coincide com o domingo "pelo menos uma vez no
//   período máximo de três semanas" (Lei 10.101/2000, art. 6º, parágrafo único, na redação da Lei 11.603/2007); pras
//   mulheres, "escala de revezamento quinzenal, que favoreça o repouso dominical" (CLT, art. 386), que a convenção
//   não pode reduzir (TST, noticiado em 08/07/2026). Conferidos em 21/11/2026 em cópias da lei e nas notícias dos
//   tribunais; os rodízios daqui dão 1 domingo a cada 3 ou a cada 2 semanas.
// - o intervalo: o dia de até 6 h tem 15 minutos, e o de mais de 6 h, 1 hora no mínimo (CLT, art. 71, caput e § 1º):
//   quando os mesmos 36 h de 6 dias de 6 h passam a 5 dias de 7h12, a opção avisa.
// O que as escalas NÃO sabem: os horários de entrada e de saída, o movimento de cada dia e o que a convenção da
// categoria diz. Por isso cada opção diz o que exige e manda conferir.
// =====================================================================
import { DECISAO_STF, diagnostico, limiteDaEtapa, diaMaxDaEtapa, fmtHoras } from './jornada-6x1.js';

export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const DIAS_NOME = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const SEG = 0, TER = 1, QUA = 2, QUI = 3, SEX = 4, SAB = 5, DOM = 6;

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const arred = (v, c = 4) => Math.round(v * 10 ** c) / 10 ** c;
const dataBr = iso => String(iso).slice(0, 10).split('-').reverse().join('/');
const gente = n => n + ' ' + (n === 1 ? 'pessoa' : 'pessoas');
// 0,4 h → "24 minutos"; 2 h → "2h"
const fmtTempo = h => h < 1 ? Math.round(h * 60) + ' minutos' : fmtHoras(h);
const emDia = i => (i === SAB || i === DOM ? 'no ' : 'na ') + DIAS_NOME[i];
const juntar = itens => itens.length <= 1 ? itens.join('') : itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
const semana = folgas => Array.from({ length: 7 }, (_, d) => !folgas.includes(d));
// n pessoas em até k turmas, o mais igual que der (as primeiras ficam com quem sobra)
const repartir = (n, k) => { const q = Math.min(n, k); return Array.from({ length: q }, (_, i) => Math.floor(n / q) + (i < n % q ? 1 : 0)); };

// ---------- os dias da turma hoje ----------
// trabalha: os 7 dias, de segunda a domingo; variavel: a turma cobre os 7 dias (ou trabalha no domingo sem dizer a
// folga), então a folga de hoje roda e não está no Domínio; suposto: os dias não são certos, e isso vem dito — o
// grupo digitado na tela, que só pergunta a escala e se trabalha no domingo (os dias contam a partir da segunda), e,
// com `semHoras`, o horário do Domínio sem as horas de cada dia (a ponte manda os dias sem os minutos).
export function diasDoGrupo(g) {
  if (!g) return null;
  if (g.manual) {
    const d = num(g.dias);
    if (!d || d < 1 || d > 7 || !Number.isInteger(d)) return null;
    if (g.domingo === true) return { trabalha: Array(7).fill(true), dias: d, variavel: true };
    return { trabalha: Array.from({ length: 7 }, (_, i) => i < d), dias: d, variavel: d === 7, suposto: d < 7 };
  }
  if (typeof g.semana === 'string' && /^[TCF-]{7}$/.test(g.semana)) {
    const trabalha = [...g.semana].map(c => c === 'T');
    const dias = trabalha.filter(Boolean).length;
    if (!dias) return null;
    return { trabalha, dias, variavel: dias === 7, ...(num(g.min_semana) == null ? { suposto: true, semHoras: true } : {}) };
  }
  return null;
}

// "de segunda a sábado", "de terça a domingo", "segunda, quarta e sexta": os dias de trabalho de hoje, por extenso
export function diasPorExtenso(dg) {
  if (!dg) return null;
  if (dg.variavel) return dg.dias === 7 ? 'os 7 dias, com a folga em rodízio' : dg.dias + ' dias por semana, com a folga em rodízio';
  const dias = dg.trabalha.map((x, d) => x ? d : -1).filter(d => d >= 0);
  // um bloco só de dias seguidos (a semana dá a volta: de sexta a terça)
  const comecos = dias.filter(d => !dg.trabalha[(d + 6) % 7]);
  if (dias.length >= 3 && comecos.length === 1) return 'de ' + DIAS_NOME[comecos[0]] + ' a ' + DIAS_NOME[(comecos[0] + dias.length - 1) % 7];
  return juntar(dias.map(d => DIAS_NOME[d]));
}

// ---------- o que cada escala exige ----------
// maiorDia: o dia mais longo da escala, em horas
export function exigencia(maiorDia, etapa, { cct = false } = {}) {
  const diaMax = diaMaxDaEtapa(etapa, { cct });
  if (maiorDia <= 8 + 1e-6) return { nivel: 'nada', texto: 'Cabe nas 8 horas por dia: não pede convenção nem acordo coletivo.', base: 'CF, art. 7º, XIII' };
  if (maiorDia <= diaMax + 1e-6) {
    return { nivel: 'nada', texto: 'Até ' + fmtHoras(DECISAO_STF.diaMax) + ' por dia sem convenção nem acordo coletivo, e sem hora extra nos 24 minutos, até ' + dataBr(DECISAO_STF.ate) + '.',
      base: 'STF, ' + DECISAO_STF.processo + ', ' + dataBr(DECISAO_STF.data) + ', item I (cautelar: pode ser revista)' };
  }
  if (cct && etapa === 'e42') {
    return { nivel: 'coletivo', texto: 'Passa das 8 horas por dia: vale pela convenção ou pelo acordo coletivo da categoria, até 16/12/2027. Confira a cláusula.', base: 'EC 141, art. 7º' };
  }
  return { nivel: 'coletivo', texto: 'Passa das ' + fmtHoras(diaMax) + ' por dia: só com convenção ou acordo coletivo.',
    base: etapa === 'e42' ? 'EC 141, art. 7º; CF, art. 7º, XIII' : 'CF, art. 7º, XIII (compensação de horários)' };
}

// o maior número de dias seguidos de trabalho de uma turma, contando a virada do ciclo
function diasSeguidos(semanas) {
  const linha = semanas.flat();
  if (linha.every(Boolean)) return Infinity;
  let maior = 0, agora = 0;
  for (const dia of [...linha, ...linha]) { agora = dia ? agora + 1 : 0; if (agora > maior) maior = agora; }
  return maior;
}

// ---------- uma opção ----------
// def.turmas: [{ pessoas, trabalha: [ [7 dias] por semana do ciclo ] }]; def.dias: os dias de trabalho por semana;
// def.horasDia: o dia mais longo; def.diaCurto: o dia mais curto, quando houver; def.fecha: a própria opção já diz
// que um dia fica sem a turma.
function opcao(ctx, def) {
  const { p, n, dg, etapa, cct, alvo } = ctx;
  const brutas = (def.turmas || []).filter(t => t.pessoas > 0);
  const umaCada = brutas.length > 1 && brutas.every(t => t.pessoas === 1);
  const turmas = brutas.map((t, i) => ({
    nome: brutas.length === 1 ? (t.pessoas === 1 ? 'A pessoa' : 'Todos') : umaCada ? 'Pessoa ' + (i + 1) : 'Turma ' + String.fromCharCode(65 + i),
    pessoas: t.pessoas,
    trabalha: t.trabalha,
    folgas: t.trabalha.map(s => s.map((x, d) => x ? -1 : d).filter(d => d >= 0))
  }));
  const ciclo = turmas.length ? turmas[0].trabalha.length : 1;
  const hoje = dg.variavel ? null : dg.trabalha.map(x => x ? n : 0);
  const nova = turmas.length ? Array.from({ length: ciclo }, (_, w) => Array.from({ length: 7 }, (_, d) => turmas.reduce((s, t) => s + (t.trabalha[w][d] ? t.pessoas : 0), 0))) : null;
  // os dias que entram na conta de quem fica: os de trabalho de hoje ou da escala nova
  const dias = [];
  if (nova) for (let d = 0; d < 7; d++) {
    const col = nova.map(s => s[d]);
    if ((hoje && hoje[d] > 0) || col.some(v => v > 0)) dias.push({ dia: d, hoje: hoje ? hoje[d] : null, min: Math.min(...col), max: Math.max(...col) });
  }
  const trabalhaDomingo = turmas.some(t => t.trabalha.some(s => s[DOM]));
  const domingosDeFolga = turmas.length ? Math.min(...turmas.map(t => t.trabalha.filter(s => !s[DOM]).length)) : 0;
  const seguidos = turmas.length ? Math.max(...turmas.map(t => diasSeguidos(t.trabalha))) : null;
  const folgasNaSemana = turmas.length ? Math.min(...turmas.flatMap(t => t.folgas.map(f => f.length))) : null;
  const horario = def.diaCurto != null
    ? (def.dias - 1) + ' dias de ' + fmtHoras(def.horasDia) + ' e 1 de ' + fmtHoras(def.diaCurto)
    : def.dias + ' dias de ' + fmtHoras(def.horasDia);
  const notas = [...(def.notas || [])];
  // o dia de hoje não passa das 6 h e o novo passa: o intervalo mínimo muda
  if (ctx.diaHoje != null && ctx.diaHoje <= 6 + 1e-6 && def.horasDia > 6 + 1e-6) {
    notas.push({ texto: 'O dia passa das 6 horas (hoje, ' + fmtHoras(ctx.diaHoje) + '): o intervalo mínimo deixa de ser de 15 minutos e passa a 1 hora.', base: 'CLT, art. 71, caput e § 1º' });
  }
  const vazios = def.fecha ? [] : dias.filter(x => x.min === 0 && (x.hoje == null || x.hoje > 0)).map(x => x.dia);
  // hoje só a turma de 1 pessoa chega aqui (com 2 ou mais, os rodízios não deixam dia vazio: o teste confere)
  if (vazios.length) {
    notas.push({ texto: (n === 1
        ? 'Com 1 pessoa só na turma, os dias de folga dela ficam sem ninguém: nesses dias'
        : 'Há dia sem ninguém desta turma (' + juntar(vazios.map(d => DIAS_NOME[d])) + '): nesses dias')
      + ' a empresa fecha, o dono cobre ou entra mais gente. O simulador diz quanto custa contratar.', base: '' });
  }
  return {
    id: def.id, titulo: def.titulo, horario, dias: def.dias, horasDia: def.horasDia, diaCurto: def.diaCurto != null ? def.diaCurto : null, horasSemana: alvo,
    ciclo, turmas, semGrade: !turmas.length,
    cobertura: { hoje, nova, dias },
    seguidos, folgasNaSemana,
    domingo: trabalhaDomingo ? { folga: domingosDeFolga, em: ciclo } : null,
    exige: exigencia(def.horasDia, etapa, { cct }),
    notas,
    resumo: p.rotulo + ' (' + gente(n) + '): ' + def.titulo.charAt(0).toLowerCase() + def.titulo.slice(1) + ', ' + horario
  };
}

// ---------- os casos ----------
// nos rodízios, os dias do meio da semana são só um jeito: a empresa troca pelos dias de menos movimento
const OUTROS_DIAS = ' As folgas do meio da semana podem cair em outros dias, mantidas as 2 por semana e sem passar de 6 dias seguidos de trabalho.';
// a turma já trabalha até 5 dias: mudam só as horas
function casoMesmosDias(ctx) {
  const { p, n, dg, etapa, cct, alvo } = ctx;
  const D = dg.dias, hd = arred(alvo / D);
  const turmas = dg.variavel ? [] : [{ pessoas: n, trabalha: [dg.trabalha] }];
  const corte = p.horas != null ? arred(p.horas - alvo, 2) : 0;
  const presenca = dg.variavel ? 'A folga segue em rodízio, como hoje.' : 'Ninguém a menos em dia nenhum.';
  const longo = p.maiorDia;
  // sem corte de horas, a turma só está aqui pelo dia mais longo: as mesmas horas, divididas por igual
  const iguala = !(corte > 0) && longo != null && longo > hd + 0.05;
  const ops = [opcao(ctx, {
    id: 'mesmos_dias', dias: D, horasDia: hd, turmas,
    titulo: corte > 0 ? 'Os mesmos dias de hoje, com o dia mais curto' : iguala ? 'Os mesmos dias de hoje, com as horas divididas por igual' : 'Os mesmos dias e as mesmas horas de hoje',
    notas: [{ texto: presenca + (corte > 0 ? ' Saem ' + fmtTempo(corte) + ' por semana de cada pessoa: ' + fmtTempo(arred(corte / D)) + ' por dia, na entrada ou na saída.'
      : iguala ? ' As horas da semana não mudam: o dia mais longo de hoje (' + fmtHoras(longo) + ') passa a ' + fmtHoras(hd) + '. Manter os dias como estão, só com convenção ou acordo coletivo.'
      : ' As horas da semana não mudam: o que pesa é o tamanho do dia.'), base: '' }]
  })];
  // o desenho que muita empresa já usa: os dias longos e um dia mais curto (a sexta, em geral)
  if (!dg.variavel && D >= 2 && corte > 0 && longo != null && longo > hd + 0.05) {
    const curto = arred(alvo - (D - 1) * longo);
    if (curto >= 4 && curto < longo - 0.05) {
      ops.push(opcao(ctx, { id: 'dia_curto', titulo: 'Os mesmos dias de hoje, ' + (longo - curto >= 2 - 1e-9 ? 'com um dia bem mais curto' : 'com o corte num dia só'), dias: D, horasDia: longo, diaCurto: curto, turmas,
        notas: [{ texto: 'Os dias longos ficam do tamanho do mais longo de hoje (' + fmtHoras(longo) + ') e todo o corte vai pra um dia só (a sexta, em geral).', base: '' }] }));
    }
  }
  // menos de 5 dias com o dia acima do limite: as mesmas horas em 5 dias, de segunda a sexta
  if (!dg.variavel && D < 5 && hd > diaMaxDaEtapa(etapa, { cct }) + 1e-6 && !dg.trabalha[SAB] && !dg.trabalha[DOM]) {
    ops.push(opcao(ctx, { id: 'cinco_dias', titulo: 'As mesmas horas em 5 dias, de segunda a sexta', dias: 5, horasDia: arred(alvo / 5),
      turmas: [{ pessoas: n, trabalha: [semana([SAB, DOM])] }],
      notas: [{ texto: 'O dia fica menor e a turma passa a vir os 5 dias.', base: '' }] }));
  }
  return ops;
}

// de segunda a sábado, com o domingo de folga: a 6x1 clássica
function casoSegundaASabado(ctx) {
  const { n, alvo } = ctx;
  const hd = arred(alvo / 5);
  const vagas = Array(6).fill(0);
  for (let i = 0; i < n; i++) vagas[i % 6]++;
  const a = Math.ceil(n / 2), b = n - a;
  return [
    opcao(ctx, { id: 'seg_a_sex', titulo: 'Segunda a sexta', dias: 5, horasDia: hd, fecha: true,
      turmas: [{ pessoas: n, trabalha: [semana([SAB, DOM])] }],
      notas: [{ texto: 'A turma deixa de trabalhar no sábado.', base: '' }] }),
    opcao(ctx, { id: 'folga_na_semana', titulo: 'Segunda a sábado, com uma folga pra cada um no meio da semana', dias: 5, horasDia: hd,
      turmas: [SEG, TER, QUA, QUI, SEX, SAB].map((dia, i) => ({ pessoas: vagas[i], trabalha: [semana([dia, DOM])] })),
      notas: [{ texto: 'O dia da folga de cada um pode ser fixo ou trocar entre as pessoas a cada semana.', base: '' }] }),
    opcao(ctx, { id: 'sabado_alternado', titulo: 'Sábado sim, sábado não', dias: 5, horasDia: hd,
      turmas: [{ pessoas: a, trabalha: [semana([SAB, DOM]), semana([SEG, DOM])] }, { pessoas: b, trabalha: [semana([SEG, DOM]), semana([SAB, DOM])] }],
      notas: [{ texto: 'Quem trabalha no sábado folga na segunda. A cada duas semanas, a pessoa emenda sábado, domingo e segunda de folga.', base: '' }] })
  ];
}

// 6 dias com o domingo trabalhado e uma folga fixa na semana (o restaurante que fecha na segunda, por exemplo)
function casoComDomingo(ctx) {
  const { n, dg, alvo } = ctx;
  const c = dg.trabalha.findIndex(x => !x);
  const hd = arred(alvo / 5);
  // os dias mais perto da folga fixa, fora o domingo: é neles que a segunda folga cai quando não é no domingo
  const [a, b] = [1, -1, 2, -2, 3, -3].map(k => (c + k + 7) % 7).filter(d => d !== DOM && d !== c);
  const rodizio = seq => repartir(n, seq.length).map((q, j) => ({ pessoas: q, trabalha: seq.map((_, w) => semana([c, seq[(w + j) % seq.length]])) }));
  return [
    opcao(ctx, { id: 'domingo_1_em_3', titulo: 'Folga fixa ' + emDia(c) + ', com 1 domingo de folga a cada 3 semanas', dias: 5, horasDia: hd, turmas: rodizio([DOM, a, b]),
      notas: [{ texto: 'A segunda folga roda: numa semana cai no domingo, nas outras duas ' + emDia(a) + ' e ' + emDia(b) + '. Com mulheres na turma, use o rodízio de 2 semanas.' + OUTROS_DIAS, base: '' }] }),
    opcao(ctx, { id: 'domingo_1_em_2', titulo: 'Folga fixa ' + emDia(c) + ', com 1 domingo de folga a cada 2 semanas', dias: 5, horasDia: hd, turmas: rodizio([DOM, a]),
      notas: [{ texto: 'A segunda folga roda: numa semana cai no domingo, na outra ' + emDia(a) + '.' + OUTROS_DIAS, base: '' }] }),
    opcao(ctx, { id: 'fecha_domingo', titulo: 'Folga no domingo e ' + emDia(c) + ', pra todos', dias: 5, horasDia: hd, fecha: true,
      turmas: [{ pessoas: n, trabalha: [semana([c, DOM])] }],
      notas: [{ texto: 'A turma deixa de trabalhar no domingo, que é a folga que a Constituição prefere.', base: 'CF, art. 7º, XV' }] })
  ];
}

// a turma cobre os 7 dias (a folga de hoje roda e não está no Domínio)
function casoTodosOsDias(ctx) {
  const { n, alvo } = ctx;
  const hd = arred(alvo / 5);
  const rodizio = tipos => repartir(n, tipos.length).map((q, j) => ({ pessoas: q, trabalha: tipos.map((_, w) => semana(tipos[(w + j) % tipos.length])) }));
  return [
    opcao(ctx, { id: 'rodizio_3', titulo: 'Os 7 dias cobertos, com as folgas em rodízio de 3 semanas', dias: 5, horasDia: hd, turmas: rodizio([[SEG, DOM], [QUI, SEX], [TER, QUA]]),
      notas: [{ texto: 'Cada pessoa folga 1 domingo a cada 3 semanas, e ninguém folga no sábado. Com mulheres na turma, use o rodízio de 2 semanas.' + OUTROS_DIAS, base: '' }] }),
    opcao(ctx, { id: 'rodizio_2', titulo: 'Os 7 dias cobertos, com as folgas em rodízio de 2 semanas', dias: 5, horasDia: hd, turmas: rodizio([[SEG, DOM], [QUA, QUI]]),
      notas: [{ texto: 'Cada pessoa folga 1 domingo a cada 2 semanas, e ninguém folga na terça, na sexta nem no sábado.' + OUTROS_DIAS, base: '' }] })
  ];
}

// ---------- as escalas de uma turma ----------
// g: a linha de dominio_jornadas ou o grupo digitado na tela. Devolve { rotulo, pessoas, precisa, motivo, hoje, aviso,
// horasSemana, opcoes, notas }.
export function escalasSugeridas(g, etapa, { cct = false } = {}) {
  const d = diagnostico(g, etapa, { cct });
  const p = d.padrao, n = d.empregados;
  const dg = diasDoGrupo(g);
  // hoje: os dias de trabalho por extenso (suposto: os dias não são certos; porque: 'digitado' ou 'sem_horas'); nos
  // 7 dias do Domínio, o nome da turma já diz. aviso: só do escritório (a tela mostra, o relatório não) — o horário
  // do Domínio sem as horas de cada dia, em que as opções supõem os dias que estão lá
  const saida = { rotulo: p.rotulo, pessoas: n, etapa, precisa: d.precisa, motivo: null, opcoes: [], notas: [],
    hoje: dg && p.escala !== '7x0' ? { texto: diasPorExtenso(dg), suposto: !!dg.suposto, porque: dg.suposto ? (dg.semHoras ? 'sem_horas' : 'digitado') : null } : null,
    aviso: dg && dg.semHoras ? 'No Domínio o horário desta turma está sem as horas de cada dia: as opções supõem os dias que estão lá (' + diasPorExtenso(dg) + '). Confirme os dias com a empresa antes de combinar.' : null };
  if (!n) return { ...saida, motivo: 'Turma sem pessoas.' };
  if (!d.precisa) return { ...saida, motivo: 'Nada a mudar nesta data: a escala de hoje continua.' };
  if ([2, 3, 6].includes(num(g.controle))) return { ...saida, motivo: 'Fora do controle de jornada (CLT, art. 62): valem as 2 folgas por semana, combinadas caso a caso.' };
  if (!dg || ['12x36', '24x72', 'turno', 'escala', 'sem_jornada'].includes(p.escala)) {
    return { ...saida, motivo: 'Sem os dias da semana desta turma: a escala nova depende dos dias e dos horários que a empresa informar.' };
  }
  const limite = limiteDaEtapa(etapa, { cct });
  const alvo = arred(p.horas != null ? Math.min(p.horas, limite) : limite, 2);
  // o dia de trabalho de hoje: o mais longo do Domínio; sem ele, as horas pelos dias (os 7 dias marcados são 6 de trabalho)
  const diaHoje = p.maiorDia != null ? p.maiorDia : (p.horas != null && p.dias ? arred(p.horas / Math.min(p.dias, 6), 2) : null);
  const ctx = { g, p, n, dg, etapa, cct, alvo, diaHoje };
  let opcoes;
  if (dg.dias <= 5) opcoes = casoMesmosDias(ctx);
  else if (dg.variavel) opcoes = casoTodosOsDias(ctx);
  else if (!dg.trabalha[DOM]) opcoes = casoSegundaASabado(ctx);
  else opcoes = casoComDomingo(ctx);
  const notas = [{ texto: 'As horas são de trabalho: o intervalo de descanso e almoço fica fora da conta.', base: 'CLT, art. 71, § 2º' }];
  if (etapa === 'e42' && alvo > 40) notas.push({ texto: 'Em 16/12/2027 o limite cai pra 40 horas por semana: nas escalas de 5 dias, o dia passa a 8 horas.', base: 'EC 141, art. 6º, II' });
  notas.push({ texto: 'A convenção ou o acordo coletivo pode organizar as folgas de outro jeito, mantidas as 2 por semana.',
    base: DECISAO_STF.vale ? 'STF, ' + DECISAO_STF.processo + ', item IV' : 'CF, art. 7º, § 2º' });
  if (opcoes.some(o => !o.semGrade)) notas.push({ texto: 'Nenhuma opção passa de 6 dias seguidos de trabalho: a folga dada só depois do sétimo dia seguido se paga em dobro.', base: 'TST, OJ 410 da SDI-1' });
  if (dg.variavel || opcoes.some(o => o.domingo)) {
    notas.push({ texto: 'Pra quem trabalha no domingo, o domingo de folga: no comércio, pelo menos 1 a cada 3 semanas; pras mulheres, 1 a cada 15 dias, e o TST entende que a convenção não pode reduzir.',
      base: 'Lei 10.101/2000, art. 6º, parágrafo único; CLT, art. 386' });
  }
  return { ...saida, horasSemana: alvo, opcoes, notas };
}

// as turmas de uma empresa que precisam mudar na data, cada uma com as opções (ou o porquê de não ter)
export function escalasDaEmpresa(grupos, etapa, opcoes = {}) {
  return (grupos || []).filter(g => (num(g.empregados) || 0) > 0)
    .map(g => ({ grupo: g, escalas: escalasSugeridas(g, etapa, opcoes) }))
    .filter(x => x.escalas.precisa);
}

// ---------- a frase das garantias de uma opção (a tela e o PDF desenham a grade com turmas e cobertura) ----------
export function garantias(o) {
  if (o.seguidos == null || !Number.isFinite(o.seguidos)) return '';
  return 'Toda semana com ' + o.folgasNaSemana + ' folgas e no máximo ' + o.seguidos + ' dias seguidos de trabalho'
    + (o.domingo && o.domingo.em > 1 ? '; ' + o.domingo.folga + ' domingo de folga a cada ' + o.domingo.em + ' semanas' : '') + '.';
}
