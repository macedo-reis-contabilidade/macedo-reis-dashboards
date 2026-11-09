// =====================================================================
// MACEDO & REIS — O fim da escala 6x1 (EC 141/2026): as regras e as contas da tela "Escala 6x1" do DP
// (dp-jornada.html, 09/11/2026, pedido do Diego e da Vitória). Puro: sem banco nem tela.
//
// A base legal, no texto oficial (a Câmara, conferido em 09/11/2026):
// - CF, art. 7º, XIII, na redação da EC 141: "duração do trabalho normal não superior a 8 (oito) horas diárias e
//   40 (quarenta) horas semanais, facultada a compensação de horários e a redução da jornada, mediante acordo ou
//   convenção coletiva de trabalho";
// - XV: "repouso semanal remunerado de 2 (dois) dias, um dos quais preferencialmente aos domingos" — em vigor 2 meses
//   depois da publicação (EC 141, art. 10, I): 16/12/2026;
// - § 2º: convenção ou acordo coletivo pode fazer a média de 2 folgas no mês, com pelo menos 1 dentro de uma semana;
// - § 3º: lei pode criar regimes diferenciados, dentro desses limites;
// - EC 141, art. 6º: no máximo 42 h a partir de 16/12/2026 (I) e 40 h um ano depois, em 16/12/2027 (II);
// - art. 7º: até 16/12/2027, convenção ou acordo coletivo pode ampliar a duração diária pra distribuir as 42 h;
// - art. 2º: sem redução de salário, nominal, proporcional ou de outra espécie, nos contratos em vigor;
// - art. 3º: em 16/12/2026, as cláusulas coletivas de jornada e repouso contrárias à emenda perdem a eficácia;
// - art. 4º: a jornada que já é de 40 h ou menos não é reduzida (as 2 folgas valem);
// - art. 5º: lei complementar pode trazer transição pro MEI, a ME e a EPP (não havia, em 09/11/2026);
// - art. 8º: diploma de nível superior e salário a partir de 2,5 vezes o teto do RGPS: fora do controle de jornada,
//   salvo opção do empregador ou norma coletiva (as 2 folgas valem).
// O que é leitura, não texto (dito assim na tela e no relatório): o divisor 210 nas 42 h (220 × 42 ÷ 44); a hora do
// horista reajustada pra não perder no mês; as 8 h por dia sem convenção ou acordo coletivo; o reflexo da hora extra
// habitual nas 2 folgas; a 12x36 (média de 42 h) depois de 16/12/2027.
// =====================================================================

export const EMENDA = {
  numero: '141/2026',
  publicada: '2026-10-16',
  fonte: 'https://www2.camara.leg.br/legin/fed/emecon/2026/emendaconstitucional-141-16-outubro-2026-800062-publicacaooriginal-181622-pl.html'
};
export const DATA_42 = '2026-12-16';   // EC 141, art. 6º, I, e art. 10, I: 2 meses depois da publicação
export const DATA_40 = '2027-12-16';   // art. 6º, II: 1 ano depois
export const ETAPAS = {
  e42: { id: 'e42', desde: DATA_42, horas: 42, folgas: 2, divisor: 210, rotulo: '16/12/2026: 42 h e 2 folgas' },
  e40: { id: 'e40', desde: DATA_40, horas: 40, folgas: 2, divisor: 200, rotulo: '16/12/2027: 40 h' }
};

// o teto do RGPS de cada ano (2026: Portaria Interministerial MPS/MF de janeiro; R$ 8.475,55) e o salário do art. 8º
export const TETO_RGPS = { 2026: 8475.55 };
export function salarioArt8(ano) {
  const anos = Object.keys(TETO_RGPS).map(Number).sort((a, b) => a - b);
  const usa = anos.filter(a => a <= ano).pop() || anos[0];
  return Math.ceil(TETO_RGPS[usa] * 2.5 * 100) / 100;
}

export const ROTULOS = {
  '6x1': '6x1', '5x2': '5x2', '5x2c': '5x2 com o sábado compensado', '12x36': '12x36', '24x72': '24x72',
  escala: 'Escala (outra)', turno: 'Turno variável', sem_jornada: 'Sem jornada no Domínio'
};
const rotuloDe = e => ROTULOS[e] || e;

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const arred = (v, c = 2) => Math.round(v * 10 ** c) / 10 ** c;

// ---------- o padrão de cada grupo ----------
// g: a linha de dominio_jornadas (semana, tipo, tipo_escala, ciclo_dias, ciclo_trabalho, min_semana, min_maior_dia,
// horas_semana, …) ou um grupo digitado na tela ({ manual: true, escala, dias, horas, domingo }).
export function padraoDoGrupo(g) {
  const horasContrato = num(g.horas_semana);
  const horasJornada = num(g.min_semana) != null ? arred(num(g.min_semana) / 60, 2) : null;
  const base = {
    horas: horasContrato != null && horasContrato > 0 ? horasContrato : horasJornada,
    horasJornada,
    maiorDia: num(g.min_maior_dia) != null ? arred(num(g.min_maior_dia) / 60, 2) : null,
    domingo: null, sabado: null
  };
  if (g.manual) {
    const dias = num(g.dias);
    return { ...base, escala: g.escala || (dias ? dias + 'x' + (7 - dias) : 'sem_jornada'), rotulo: rotuloDe(g.escala || (dias ? dias + 'x' + (7 - dias) : 'sem_jornada')),
      horas: num(g.horas) != null ? num(g.horas) : base.horas, dias, folgas: dias != null ? 7 - dias : null,
      domingo: g.domingo === true, sabado: g.sabado === true, manual: true };
  }
  const te = num(g.tipo_escala);
  if (te === 1 || te === 2) {
    const escala = te === 1 ? '12x36' : '24x72';
    const dias = te === 1 ? 3.5 : 1.75;
    return { ...base, escala, rotulo: rotuloDe(escala), dias, folgas: arred(7 - dias, 2), horas: base.horas != null ? base.horas : 42 };
  }
  const cic = num(g.ciclo_dias), trab = num(g.ciclo_trabalho);
  if (!g.semana && cic && trab != null) {
    const dias = arred(7 * trab / cic, 2);
    return { ...base, escala: 'escala', rotulo: rotuloDe('escala') + ' (' + trab + ' de ' + cic + ' dias)', dias, folgas: arred(7 - dias, 2) };
  }
  if (typeof g.semana === 'string' && /^[TCF-]{7}$/.test(g.semana)) {
    const s = g.semana;
    const t = [...s].filter(c => c === 'T').length;
    const c = [...s].filter(x => x === 'C').length;
    const escala = (t === 5 && c > 0) ? '5x2c' : (t === 6 ? '6x1' : (t === 5 ? '5x2' : t + 'x' + (7 - t)));
    return { ...base, escala, rotulo: rotuloDe(escala), dias: t, folgas: 7 - t, domingo: s[6] === 'T', sabado: s[5] === 'T' };
  }
  if (num(g.tipo) === 3) return { ...base, escala: 'turno', rotulo: rotuloDe('turno'), dias: null, folgas: null };
  return { ...base, escala: 'sem_jornada', rotulo: rotuloDe('sem_jornada'), dias: null, folgas: null };
}

// ---------- o que muda em cada etapa ----------
// O limite de horas que a empresa consegue usar em 5 dias: com convenção ou acordo coletivo que deixe passar das
// 8 h por dia, as 42 h; sem, 8 h × 5 = 40 h já em 16/12/2026 (a leitura mais segura do art. 7º, XIII, e do art. 7º da EC).
export function limiteDaEtapa(etapa, { cct = false } = {}) {
  const e = ETAPAS[etapa];
  if (!e) throw new Error('etapa: e42 ou e40');
  return etapa === 'e42' && !cct ? 40 : e.horas;
}

// itens: { tipo: 'folgas' | 'horas' | 'diaria' | 'salario' | 'fora' | 'conferir', texto, base }
export function diagnostico(g, etapa, { cct = false, art8 = null } = {}) {
  const p = padraoDoGrupo(g);
  const e = ETAPAS[etapa];
  const itens = [];
  const n = num(g.empregados) || 0;
  const controle = num(g.controle), categoria = num(g.categoria);
  const limite = limiteDaEtapa(etapa, { cct });
  const foraDoControle = [2, 3, 6].includes(controle);
  const superiorTeto = num(g.superior_teto) || 0;
  const escalaLonga = p.escala === '12x36' || p.escala === '24x72';   // a média da semana conta, no item das escalas

  // as 2 folgas valem pra todo mundo a partir de 16/12/2026
  if (p.folgas != null && p.folgas < 2) {
    itens.push({ tipo: 'folgas', texto: 'Hoje folga ' + fmtNum(p.folgas) + ' dia por semana; a partir de 16/12/2026 são 2 (um, de preferência, no domingo).',
      base: 'CF, art. 7º, XV (EC 141, art. 10, I). Com convenção ou acordo coletivo, a média de 2 no mês, com pelo menos 1 por semana (art. 7º, § 2º).' });
  } else if (p.folgas == null) {
    itens.push({ tipo: 'conferir', texto: 'Sem a semana no Domínio: confirmar com a empresa quantos dias trabalha (a partir de 16/12/2026, 2 folgas por semana).',
      base: 'CF, art. 7º, XV' });
  }
  // as horas
  if (foraDoControle) {
    itens.push({ tipo: 'conferir', texto: 'Fora do controle de jornada pela CLT, art. 62 (externo, cargo de gestão ou teletrabalho): a emenda não fala desse caso; as 2 folgas valem.',
      base: 'CLT, art. 62; CF, art. 7º, XV' });
  } else if (!escalaLonga && p.horas != null && p.horas > limite) {
    const corte = arred(p.horas - limite, 2);
    itens.push({ tipo: 'horas', texto: 'Contrato de ' + fmtNum(p.horas) + ' h por semana: precisa cair pra ' + limite + ' h (' + fmtNum(corte) + ' h a menos por semana por pessoa), sem reduzir o salário.',
      base: (etapa === 'e42' ? 'EC 141, art. 6º, I' : 'EC 141, art. 6º, II') + ', e art. 2º (sem redução de salário)'
        + (etapa === 'e42' && !cct ? '. As 42 h em 5 dias pedem 8h24 por dia, e passar das 8 h só com convenção ou acordo coletivo (art. 7º da EC): sem ele, 40 h.' : '') });
  } else if (p.horas != null && p.horas <= 40 && etapa === 'e42') {
    itens.push({ tipo: 'horas', texto: 'Já em ' + fmtNum(p.horas) + ' h por semana: não reduz (as 2 folgas valem).', base: 'EC 141, art. 4º', ok: true });
  }
  // o dia mais longo
  if (p.maiorDia != null && p.maiorDia > 8 && !escalaLonga && !foraDoControle) {
    itens.push({ tipo: 'diaria', texto: 'O dia mais longo tem ' + fmtHoras(p.maiorDia) + ': passar das 8 h só com compensação por acordo ou convenção coletiva.',
      base: 'CF, art. 7º, XIII; EC 141, art. 7º (até 16/12/2027, pra distribuir as 42 h)' });
  }
  // o salário-hora
  if (num(g.unidade) === 1 || num(g.forma) === 2) {
    const fator = arred(44 / e.horas, 4);
    itens.push({ tipo: 'salario', texto: 'Recebe por hora: pra não perder no mês, a hora sobe ' + fmtNum(arred((fator - 1) * 100, 2)) + '% (44 ÷ ' + e.horas + ').',
      base: 'EC 141, art. 2º (sem redução nominal, proporcional ou de outra espécie) — leitura' });
  } else if (!escalaLonga && p.horas != null && p.horas > e.horas) {
    itens.push({ tipo: 'salario', texto: 'O salário do mês não muda; o divisor da hora vai de 220 pra ' + e.divisor + ' (a hora extra fica ' + fmtNum(arred((220 / e.divisor - 1) * 100, 2)) + '% mais cara).',
      base: etapa === 'e42' ? 'EC 141, art. 2º; o 210 é leitura (220 × 42 ÷ 44)' : 'EC 141, art. 2º; TST, Súmula 431 (40 h, divisor 200)' });
  }
  // as escalas especiais
  if (p.escala === '12x36' || p.escala === '24x72') {
    itens.push({ tipo: 'conferir', texto: etapa === 'e42'
      ? 'A ' + p.escala + ' dá a média de 42 h por semana: cabe no limite de 16/12/2026.'
      : 'A ' + p.escala + ' dá a média de 42 h: acima das 40 h de 16/12/2027. Depende de lei (art. 7º, § 3º) ou da negociação coletiva; a PEC das jornadas especiais ainda não foi apresentada.',
      base: 'CLT, art. 59-A; CF, art. 7º, § 3º' });
  }
  if (categoria === 111 || num(g.forma) === 3) {
    itens.push({ tipo: 'conferir', texto: 'Intermitente: as 2 folgas e o limite valem nos períodos de convocação.', base: 'CLT, art. 452-A — leitura' });
  }
  if (superiorTeto > 0) {
    itens.push({ tipo: 'fora', texto: superiorTeto + ' com diploma de nível superior e salário a partir de R$ ' + fmtReais(art8 || salarioArt8(Number(DATA_42.slice(0, 4)))) + ': fora do controle de jornada, salvo opção do empregador ou norma coletiva (as 2 folgas valem).',
      base: 'EC 141, art. 8º' });
  }
  const precisa = itens.some(i => (i.tipo === 'folgas' || i.tipo === 'horas' || i.tipo === 'diaria') && !i.ok);
  return { padrao: p, empregados: n, limite, precisa, itens };
}

// ---------- a empresa ----------
// grupos: as linhas de dominio_jornadas da empresa (ou os digitados). Devolve o retrato e o que cada etapa pede.
export function resumoDaEmpresa(grupos, { cct = false } = {}) {
  const linhas = (grupos || []).filter(g => (num(g.empregados) || 0) > 0);
  const total = linhas.reduce((s, g) => s + num(g.empregados), 0);
  const porEscala = {};
  for (const g of linhas) {
    const p = padraoDoGrupo(g);
    porEscala[p.escala] = (porEscala[p.escala] || 0) + num(g.empregados);
  }
  const etapa = id => {
    let pessoas = 0, horasPerdidas = 0, presencaPerdida = 0, semDados = 0;
    const limite = limiteDaEtapa(id, { cct });
    for (const g of linhas) {
      const n = num(g.empregados);
      const d = diagnostico(g, id, { cct });
      const p = d.padrao;
      if (d.precisa) pessoas += n;
      if (p.folgas == null && p.escala !== 'turno') semDados += n;
      if (![2, 3, 6].includes(num(g.controle)) && p.horas != null && p.horas > limite && !(p.escala === '12x36' || p.escala === '24x72')) {
        horasPerdidas += n * (p.horas - limite);
      }
      if (p.dias != null && p.dias > 5 && !(p.escala === '12x36' || p.escala === '24x72')) presencaPerdida += n * (p.dias - 5);
    }
    return {
      id, limite, pessoas, semDados,
      horasPerdidas: arred(horasPerdidas, 2),
      presencaPerdida: arred(presencaPerdida, 2),
      contratarPorHoras: horasPerdidas > 0 ? Math.ceil(arred(horasPerdidas / limite, 4)) : 0,
      contratarPorPresenca: presencaPerdida > 0 ? Math.ceil(arred(presencaPerdida / 5, 4)) : 0
    };
  };
  return { empregados: total, porEscala, seis: porEscala['6x1'] || 0, e42: etapa('e42'), e40: etapa('e40') };
}

// ---------- o custo ----------
// O custo do mês de uma pessoa: o salário, as provisões do 13º e das férias com o terço (1/12 + 1/12 × 4/3) e, sobre
// tudo, o FGTS (8%) e a contribuição patronal: no Simples (fora do Anexo IV) e no MEI, dentro do DAS; no Anexo IV,
// 20% + o RAT (2%); fora do Simples, 20% + o RAT (2%) + terceiros (5,8%). Sem vale-transporte, alimentação e os
// benefícios da convenção.
export const PROVISOES = 1 / 12 + (1 / 12) * (4 / 3);
export function encargosDoRegime(regime, { anexoIV = false } = {}) {
  const r = String(regime || '').toLowerCase();
  if (/mei/.test(r)) return { fgts: 0.08, inss: 0, rotulo: 'MEI (a CPP de 3% fica de fora)' };
  if (/simples/.test(r)) return anexoIV ? { fgts: 0.08, inss: 0.22, rotulo: 'Simples, Anexo IV (20% + RAT 2%)' } : { fgts: 0.08, inss: 0, rotulo: 'Simples (a contribuição patronal no DAS)' };
  return { fgts: 0.08, inss: 0.278, rotulo: 'Fora do Simples (20% + RAT 2% + terceiros 5,8%)' };
}
export function custoMensal(salario, encargos) {
  const s = num(salario);
  if (s == null) return null;
  return arred(s * (1 + PROVISOES) * (1 + encargos.fgts + encargos.inss), 2);
}

// o salário de referência dos grupos que mudam: a média do salário do mês (o de quem recebe por hora vira mês pelas
// horas do contrato)
export function salarioMedio(grupos) {
  let soma = 0, n = 0;
  for (const g of grupos || []) {
    const s = num(g.salarios), q = num(g.empregados);
    if (s == null || !q) continue;
    const mensal = (num(g.unidade) === 1) ? s * (num(g.horas_mes) || 220) : s;
    soma += mensal; n += q;
  }
  return n ? arred(soma / n, 2) : null;
}

// As saídas pra empresa, por mês, na etapa: contratar (pelas horas ou pela presença), pagar hora extra (as horas que
// faltam) ou reduzir (sem custo em dinheiro, com as horas a menos). opcoes: { regime, anexoIV, cct, salario (o de
// referência, se a tela quiser trocar), presenca (true: conta pela presença nos dias; false: pelas horas) }
export function simular(grupos, etapa, opcoes = {}) {
  const r = resumoDaEmpresa(grupos, { cct: !!opcoes.cct })[etapa];
  const enc = encargosDoRegime(opcoes.regime, { anexoIV: !!opcoes.anexoIV });
  const salario = num(opcoes.salario) != null ? num(opcoes.salario) : salarioMedio((grupos || []).filter(g => diagnostico(g, etapa, opcoes).precisa));
  const porPessoa = custoMensal(salario, enc);
  const pessoas = opcoes.presenca === false ? r.contratarPorHoras : Math.max(r.contratarPorHoras, r.contratarPorPresenca);
  const semanasNoMes = 52 / 12;
  const horasExtraMes = arred(r.horasPerdidas * semanasNoMes, 2);
  // a hora extra: o salário ÷ o divisor da etapa × 1,5; o reflexo da habitual no repouso (Súmula 172 do TST) na
  // proporção de 2 folgas pra 5 dias de trabalho (leitura: a súmula é de antes da EC); o 13º, as férias e os encargos
  const hora = salario != null ? salario / ETAPAS[etapa].divisor : null;
  const extra = hora != null ? arred(horasExtraMes * hora * 1.5 * (1 + 2 / 5) * (1 + PROVISOES) * (1 + enc.fgts + enc.inss), 2) : null;
  return {
    etapa, resumo: r, encargos: enc, salario, porPessoa,
    contratar: { pessoas, mes: porPessoa != null ? arred(pessoas * porPessoa, 2) : null },
    horaExtra: { horasMes: horasExtraMes, mes: extra },
    reduzir: { horasSemana: r.horasPerdidas, presenca: r.presencaPerdida }
  };
}

// ---------- os números na tela ----------
export function fmtNum(v) {
  const n = num(v);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
export function fmtReais(v) {
  const n = num(v);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtHoras(h) {
  const n = num(h);
  if (n == null) return '—';
  const min = Math.round(n * 60);
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh + 'h' + (mm ? String(mm).padStart(2, '0') : '');
}

// a situação do plano combinado com a empresa (jornada_planos.situacao)
export const SITUACOES = [
  ['a_conversar', 'A conversar'], ['conversando', 'Conversando'], ['definido', 'Definido com a empresa'],
  ['aplicado', 'Aplicado (aditivo e eSocial)'], ['nao_se_aplica', 'Não se aplica']
];
export const rotuloDaSituacao = s => (SITUACOES.find(x => x[0] === s) || [null, 'A conversar'])[1];
