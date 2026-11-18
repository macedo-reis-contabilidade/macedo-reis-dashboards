// ============================================================
// MACEDO & REIS — Reforma Tributária · a simulação explicada
// O resultado do simulador (rt-motor.js) em palavras e em reais, pra ficha do caso (fiscal-reforma.html, bloco B):
// o veredito, para quem a empresa vende (o ponto em que a conta muda), os dois caminhos lado a lado, a conta passo a
// passo e o resumo pra copiar. Módulo ES puro, sem DOM: não faz conta nova — lê o que o motor devolve e roda o mesmo
// motor com outro % de clientes PJ pra achar onde o resultado vira. Testado por tests/rt-explicado.test.mjs.
//
// Os textos saem como texto puro (a tela escapa). Onde um trecho vai em negrito, a frase é uma lista de partes:
// 'texto' ou { b: 'texto em negrito' } — textoDe() junta tudo em texto corrido.
// ============================================================
import { simular, faixaDe, TAB_SIMPLES, REFERENCIA_CBS_2027, LIMIAR_EMPATE_PCT, LIMIAR_EMPATE_MIN } from './rt-motor.js';

// ---------- números ----------
const fBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const arred = v => { const r = Math.round((+v + Number.EPSILON) * 100) / 100; return r === 0 ? 0 : r; };   // sem "-R$ 0,00"
const num = (v, min, max) => (+v).toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
// "R$ 1.234,56", com o espaço que não quebra entre o R$ e o número (o resumo de copiar troca por espaço comum)
export const brl = v => fBRL.format(arred(v));
export const pct = (v, casas = 1) => num(v, 0, casas) + '%';     // 43,2% · 35%
export const pct2 = v => num(v, 2, 2) + '%';                     // 11,30%
// nas contas: de 2 a 4 casas, pra quem refizer a multiplicação chegar no mesmo valor (9,5276%)
export const pctF = v => num(v, 2, 4) + '%';
const fator = v => num(v, 0, 4);
// (escrito com o código do caractere, e não com ele: um espaço que não quebra solto no fonte não se vê, e um editor que o
// trocasse por espaço comum deixaria a troca sem efeito; o estreito, U+202F, entra junto por garantia)
export const semNbsp = t => String(t).replace(/[\u00a0\u202f]/g, ' ');
export const textoDe = partes => (Array.isArray(partes) ? partes : [partes]).map(x => typeof x === 'string' ? x : x.b).join('');

// dois percentuais lado a lado ("a conta muda em 43,1% · hoje: 43%"): com as casas que bastam pra não saírem iguais quando
// são diferentes — senão a tela diria "muda com 43% ou mais; hoje: 43%" num caso que ainda não virou
export function pctsDistintos(a, b) {
  for (let casas = 1; casas <= 4; casas++) {
    const ta = pct(a, casas), tb = pct(b, casas);
    if (ta !== tb || Math.abs(a - b) < 1e-9 || casas === 4) return [ta, tb];
  }
}

const ORD = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'];
const MEIO_CENTAVO = 0.005;

// ---------- o que cada resultado manda fazer ----------
// dentro = fica no DAS (inclusive o empate) · se = por fora custa mais, mas o crédito a mais dos clientes cobre · fora = vale por fora
export const tipoDoResultado = r => r.veredito.tipo === 'OPTE' ? 'fora' : r.veredito.tipo === 'OPTE_SE' ? 'se' : 'dentro';
export const NOME_ZONA = { dentro: 'fica no DAS', se: 'depende dos clientes', fora: 'vale por fora' };
const tipoEm = (ent, p) => tipoDoResultado(simular({ ...ent, pctPJ: p }));

// ============================================================
// zonasDaCarteira(ent) → o que a conta diz de 0 a 100% das vendas para clientes PJ que usam o crédito, com o resto da
// entrada como está: { faixas: [{ k, de, ate }], viradas: [{ em, de, para }] }. O ponto de cada virada é achado por
// bisseção no mesmo motor (é o ponto em que a decisão muda de verdade: no empate, é onde o crédito a mais dos clientes
// passa do limiar, não só onde ele alcança o custo a mais).
// ============================================================
export function zonasDaCarteira(ent) {
  const faixas = [], viradas = [];
  let ant = null;
  for (let p = 0; p <= 100; p++) {
    const k = tipoEm(ent, p);
    if (ant == null) faixas.push({ k, de: 0, ate: 100 });
    else if (k !== ant) {
      let a = p - 1, b = p;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (tipoEm(ent, m) === ant) a = m; else b = m; }
      faixas[faixas.length - 1].ate = b;
      faixas.push({ k, de: b, ate: 100 });
      viradas.push({ em: b, de: ant, para: k });
    }
    ant = k;
  }
  return { faixas, viradas };
}

// o que a régua diz, em uma frase (pro leitor de tela e pro resumo)
export function leituraDaRegua(zonas, pctPJ) {
  const partes = zonas.faixas.map((f, i) => 'De ' + pct(f.de) + ' a ' + pct(f.ate) + (i === 0 ? ' das vendas para empresas que usam o crédito' : '') + ': ' + NOME_ZONA[f.k] + '.');
  return partes.join(' ') + ' Hoje: ' + pct(+pctPJ || 0) + '.';
}

// ============================================================
// vereditoEmPalavras(r, ent, zonas, { conclusao }) → { chave, titulo, porque (partes), nota, depois, curto, tags, … }
//   chave: dentro | se | fora | semconc (a cor e a marca do título)
//   conclusao: a da confiança dos números (rt-confianca.js) — 'sem_conclusao' tira a recomendação: o título vira
//   "Sem conclusão" e a conta fica em `provisorio`, só pra referência; 'a_confirmar' vira etiqueta
// ============================================================
export function vereditoEmPalavras(r, ent, zonas, opcoes = {}) {
  const v = r.veredito, s = r.semestre, dif = s.diferenca, abs = Math.abs(dif);
  const pj = +ent.pctPJ || 0;
  const ganhoCarteira = s.creditoClienteFora - s.creditoClienteDentro;
  const vira = zonas && zonas.viradas.length ? zonas.viradas[0] : null;
  const [txtVira, txtHoje] = vira ? pctsDistintos(vira.em, pj) : ['', pct(pj)];
  const o = { chave: tipoDoResultado(r), titulo: '', porque: [], nota: '', depois: '', curto: '', tags: [], semConclusao: false, provisorio: null,
    hoje: txtHoje, vira: vira ? { em: vira.em, texto: txtVira } : null };
  // com crédito sobrando por fora (o das compras e o de estoque passam do imposto das vendas), o que a empresa paga e o
  // custo dela são números diferentes: aí a frase fala do custo, que já conta o crédito que sobra (é o do veredito)
  const sobra = r.meses.reduce((a, x) => a + Math.max(0, r.mes.creditoEntradas + x.estoque - r.mes.debitoFora), 0) > MEIO_CENTAVO;
  const zero = +ent.mixZero > 0, bar = +ent.mixRed40 > 0;
  const motivoPerda = bar && zero ? 'a alimentação preparada no bar ou restaurante e a venda com alíquota zero não dão crédito a quem compra'
    : bar ? 'a alimentação preparada no bar ou restaurante não dá crédito a quem compra (LC 214, art. 276)'
    : 'venda com alíquota zero não dá crédito a quem compra';
  if (v.tipo === 'OPTE') {
    o.titulo = 'Vale pagar por fora';
    o.porque = ['Com a CBS e o IBS por fora, o custo da empresa cai ', { b: brl(abs) }, ' de janeiro a junho de 2027, perto de ' + brl(abs / 6) + ' por mês.'];
    // economia abaixo do limiar do empate: só não é empate porque o crédito a mais dos clientes passa dele — é ele que decide
    if (abs < v.limiarEmpate) o.nota = 'A economia da empresa é pequena, abaixo dos ' + brl(v.limiarEmpate) + ' que o escritório considera para mudar de regime. O que pesa é o crédito dos clientes empresa: eles descontam ' + brl(v.ganhoAproveitado) + ' a mais no semestre.';
    // o crédito dos clientes é o que eles descontam de verdade: o das notas vezes a parte vendida a empresas que usam o crédito
    else if (pj > 0 && v.ganhoAproveitado > MEIO_CENTAVO) o.nota = 'E os clientes empresa passam a descontar mais crédito: ' + brl(s.aproveitadoFora / 6) + ' por mês, contra ' + brl(s.aproveitadoDentro / 6) + ' por dentro.';
    else if (pj > 0 && v.ganhoAproveitado < -MEIO_CENTAVO) o.nota = 'Mas os clientes empresa passam a descontar menos crédito: ' + brl(s.aproveitadoFora / 6) + ' por mês, contra ' + brl(s.aproveitadoDentro / 6) + ' por dentro, porque ' + motivoPerda + '.';
    o.depois = vira && vira.de === 'dentro' ? 'Com menos de ' + txtVira + ' das vendas para empresas que usam o crédito, o resultado é ficar no DAS. Hoje: ' + txtHoje + '.'
      : 'Vale por fora com qualquer parte das vendas para empresas.';
    o.curto = brl(abs) + ' a menos no semestre';
  } else if (v.tipo === 'OPTE_SE') {
    o.titulo = 'Depende dos clientes';
    const clientes = [' os clientes empresa descontam ', { b: brl(v.ganhoAproveitado) + ' a mais' }, ' de crédito.'];
    o.porque = (sobra
      ? (abs < MEIO_CENTAVO ? ['Por fora o custo da empresa fica ', { b: 'o mesmo' }, ' de janeiro a junho de 2027, já contando o crédito que sobra, e']
        : ['Por fora o custo da empresa fica ', { b: brl(dif) + ' maior' }, ' de janeiro a junho de 2027, já contando o crédito que sobra, mas'])
      : (abs < MEIO_CENTAVO ? ['Por fora a empresa paga ', { b: 'o mesmo' }, ' de janeiro a junho de 2027, e']
        : ['Por fora a empresa paga ', { b: brl(dif) + ' a mais' }, ' de janeiro a junho de 2027, mas'])).concat(clientes);
    o.nota = 'Vale a pena se esse crédito voltar para a empresa em preço, prazo ou fidelidade do cliente: é o comercial que confirma.';
    o.depois = vira && vira.de === 'dentro' ? 'Com menos de ' + txtVira + ' das vendas para empresas que usam o crédito, o melhor é ficar no DAS. Hoje: ' + txtHoje + '.'
      : 'Depende dos clientes com qualquer parte das vendas para empresas.';
    o.curto = 'por fora custa ' + brl(dif) + ' a mais; os clientes ganham ' + brl(v.ganhoAproveitado);
  } else {
    if (abs < MEIO_CENTAVO) {
      o.titulo = 'Empate: fique no DAS';
      o.porque = ['Os dois caminhos saem pelo ', { b: 'mesmo custo' }, ' de janeiro a junho de 2027. Sem ganho, a empresa fica como está.'];
      o.curto = 'os dois caminhos custam o mesmo';
    } else if (v.empate && dif < 0) {
      o.titulo = 'Empate: fique no DAS';
      o.porque = ['Por fora o custo seria só ', { b: brl(abs) + ' menor' }, ' no semestre. É menos que ' + brl(v.limiarEmpate) + ', a diferença mínima que o escritório considera para mudar de regime.'];
      o.curto = 'por fora daria só ' + brl(abs) + ' a menos no semestre';
    } else {
      o.titulo = 'Fique no DAS';
      o.porque = ['Pagar a CBS e o IBS por fora custaria ', { b: brl(dif) + ' a mais' }, ' de janeiro a junho de 2027, perto de ' + brl(dif / 6) + ' por mês.'
        + (v.empate ? ' A diferença é pequena: fica abaixo de ' + brl(v.limiarEmpate) + ' no semestre.' : '')];
      o.curto = 'por fora custa ' + brl(dif) + ' a mais no semestre';
    }
    if (vira) o.depois = 'A conta muda se ' + txtVira + ' ou mais das vendas forem para empresas que usam o crédito. Hoje: ' + txtHoje + '.';
    else if (bar) o.depois = 'Vender mais para empresas não muda a conta: a alimentação preparada no bar ou restaurante não dá crédito a quem compra (LC 214, art. 276).';
    else if (ganhoCarteira <= MEIO_CENTAVO) o.depois = 'Vender mais para empresas não muda a conta: por fora o cliente não leva mais crédito do que por dentro.';
    else o.depois = 'Nem com todas as vendas para empresas a conta muda.';
  }
  if (v.apertada) o.tags.push('Decisão apertada: perto do ponto em que a conta muda');
  if (opcoes.conclusao === 'a_confirmar') o.tags.push('A confirmar');
  if (opcoes.conclusao === 'sem_conclusao') {
    // o dado que decide não tem base: a tela não recomenda — a conta fica só de referência
    return { ...o, semConclusao: true, provisorio: { chave: o.chave, titulo: o.titulo, porque: o.porque, nota: o.nota },
      chave: 'semconc', titulo: 'Sem conclusão', porque: ['Os dados de hoje não sustentam uma decisão.'], nota: '', tags: [], curto: 'faltam dados para decidir' };
  }
  return o;
}

// ============================================================
// quadroDosCaminhos(r, ent) → os dois caminhos em reais, no semestre: o que a empresa paga (o caixa: DAS e, por fora, a
// CBS e o IBS a recolher) e o crédito dos clientes — `notas` é o que vai nas notas de todas as vendas, `aproveitado` é o
// que os clientes empresa descontam de verdade (o das notas × o % de clientes PJ). `sobra` é o crédito que passa do imposto
// das vendas e fica pra abater depois: diferença de custo do motor = diferença de caixa − sobra.
// ============================================================
export function quadroDosCaminhos(r, ent) {
  const m = r.mes, s = r.semestre, soma = f => r.meses.reduce((a, x) => a + f(x), 0);
  const estoque = soma(x => x.estoque);
  return {
    dentro: { das: m.das2027 * 6, cbsIbs: m.parcelaCbsIbs * 6, total: s.caixaDentro, notas: s.creditoClienteDentro, aproveitado: s.aproveitadoDentro },
    fora: { das: m.dasSobra * 6, debito: m.debitoFora * 6, credito: m.creditoEntradas * 6, estoque, aRecolher: soma(x => x.aRecolher),
      total: s.caixaFora, notas: s.creditoClienteFora, aproveitado: s.aproveitadoFora, sobra: soma(x => Math.max(0, m.creditoEntradas + x.estoque - m.debitoFora)) },
    pctPJ: +(ent && ent.pctPJ) || 0,
    diferenca: s.diferenca,
    mesesIguais: !(estoque > MEIO_CENTAVO)     // com crédito de estoque, janeiro é diferente dos outros: "por mês" vira média
  };
}

// as linhas de cada caminho, por mês (o semestre ÷ 6) ou no semestre; `semConclusao` tira o "menor custo"
export function linhasDosCaminhos(q, periodo = 'mes', opcoes = {}) {
  const f = periodo === 'mes' ? 1 / 6 : 1;
  const sufixo = periodo === 'mes' ? (q.mesesIguais ? 'por mês' : 'por mês, em média') : 'no semestre';
  const d = q.dentro, o = q.fora, maior = Math.max(d.total, o.total, 0.01);
  const linhasFora = [{ rotulo: 'DAS sem a CBS e o IBS', valor: brl(o.das * f) }, { rotulo: 'CBS e IBS das vendas', valor: brl(o.debito * f) },
    { rotulo: 'Crédito das compras', valor: '− ' + brl(o.credito * f) }];
  if (o.estoque > MEIO_CENTAVO) linhasFora.push({ rotulo: 'Crédito de estoque', valor: '− ' + brl(o.estoque * f) });
  linhasFora.push({ rotulo: 'CBS e IBS a pagar', valor: brl(o.aRecolher * f), leve: true });
  const selos = { dentro: null, fora: null };
  if (!opcoes.semConclusao && Math.abs(q.diferenca) > MEIO_CENTAVO) selos[q.diferenca > 0 ? 'dentro' : 'fora'] = { tipo: 'ok', texto: 'menor custo' };
  const gc = o.aproveitado - d.aproveitado;
  if (Math.abs(gc) > MEIO_CENTAVO) { const lado = gc > 0 ? 'fora' : 'dentro'; if (!selos[lado]) selos[lado] = { tipo: 'cli', texto: 'mais crédito ao cliente' }; }
  // o que a empresa paga a mais ou a menos por fora; com crédito sobrando, a frase fecha com o saldo — que é a diferença do veredito
  const dc = (o.total - d.total) * f, sobra = o.sobra * f, dif = q.diferenca * f;
  let diferenca = Math.abs(dc) < MEIO_CENTAVO ? 'Os dois caminhos saem pelo mesmo valor ' + sufixo + '.'
    : 'Por fora a empresa paga ' + brl(Math.abs(dc)) + (dc > 0 ? ' a mais ' : ' a menos ') + sufixo + '.';
  if (sobra > MEIO_CENTAVO) {
    diferenca = (Math.abs(dc) < MEIO_CENTAVO ? 'Os dois caminhos saem pelo mesmo valor ' + sufixo : 'Por fora a empresa paga ' + brl(Math.abs(dc)) + (dc > 0 ? ' a mais ' : ' a menos ') + sufixo)
      + ' e fica com ' + brl(sobra) + ' de crédito para abater depois. Contando esse crédito, '
      + (Math.abs(dif) < MEIO_CENTAVO ? 'os dois caminhos empatam.' : 'o caminho por fora sai ' + brl(Math.abs(dif)) + (dif < 0 ? ' mais barato.' : ' mais caro.'));
  }
  return {
    sufixo,
    // o crédito que os clientes empresa descontam: o das notas de todas as vendas × a parte vendida a quem usa o crédito
    rotuloCliente: q.pctPJ > 0 ? 'Crédito dos clientes empresa (' + pct(q.pctPJ) + ' das vendas)' : 'Crédito dos clientes empresa (hoje, sem vendas para empresas)',
    dentro: { linhas: [{ rotulo: 'DAS', valor: brl(d.das * f) }, { rotulo: 'dos quais CBS e IBS', valor: brl(d.cbsIbs * f), leve: true }],
      total: brl(d.total * f), cliente: brl(d.aproveitado * f), largura: d.total / maior * 100, selo: selos.dentro },
    fora: { linhas: linhasFora, total: brl(o.total * f), cliente: brl(o.aproveitado * f), largura: o.total / maior * 100, selo: selos.fora },
    diferenca
  };
}

// ============================================================
// passosDaConta(r, ent) → { passos: [{ titulo, formula (partes), nota, tabela?, prova }], fecho }
// A conta do motor, na ordem em que se explica a um cliente. `prova` são os pares [o que a fórmula escrita dá, o que o
// motor devolveu]: o teste confere que toda igualdade mostrada fecha, em qualquer ramo (alíquota do PGDAS, indústria,
// exclusão de ST, crédito maior que o débito…).
// ============================================================
export function passosDaConta(r, ent) {
  const m = r.mes, F = r.fatores, s = r.semestre, q = quadroDosCaminhos(r, ent);
  const anexo = F.anexo, a27 = F.anexo2027, tab = TAB_SIMPLES[anexo], fx = faixaDe(+ent.rbt12);
  const receita = +ent.receita, rbt12 = +ent.rbt12, aliqRefPct = r.aliqRef * 100, trib = F.icmsIss.tributo;
  const pctST = +ent.pctExcluidoST || 0, pctMono = +ent.pctReceitaMonofasica || 0, pctEmb = +ent.pctImpostoEmbutido || 0, pj = +ent.pctPJ || 0;
  const passos = [];
  const passo = (titulo, formula, nota, extra = {}) => passos.push({ titulo, formula, nota, prova: [], ...extra });

  // 1. a alíquota do Simples
  if (F.aliqFonte === 'informada') {
    passo('A alíquota do Simples', ['Informada, do PGDAS: ', { b: pctF(r.aliqEfetiva * 100) }],
      'Pela tabela do Anexo ' + anexo + ' daria ' + pctF(F.aliqTabela * 100) + '.'
        + (pctST > 0 ? ' A do PGDAS já vem sem a parte excluída hoje (' + pct(pctST) + ' do DAS).' : ''));
  } else {
    passo('A alíquota do Simples', ['(' + brl(rbt12) + ' × ' + pct2(tab.aliq[fx] * 100) + ' − ' + brl(tab.pd[fx]) + ') ÷ ' + brl(rbt12) + ' = ', { b: pctF(r.aliqEfetiva * 100) }],
      'Anexo ' + anexo + ', ' + ORD[fx] + ' faixa (LC 123/2006, art. 18).',
      { prova: [[(rbt12 * tab.aliq[fx] - tab.pd[fx]) / rbt12, r.aliqEfetiva]] });
  }
  const p1 = passos[0];
  if (F.mudouAnexo) p1.nota += ' Em 2027 a indústria passa para o Anexo ' + a27 + ', com alíquota de ' + pctF(F.aliqEfetiva2027 * 100) + ' (LC 123, art. 18, § 5º, na redação da LC 214).';
  const t27 = TAB_SIMPLES[a27];
  p1.tabela = { anexo: a27, linhas: t27.lim.map((lim, i) => ({ faixa: ORD[i], ate: brl(lim), aliquota: pct2(t27.aliq[i] * 100), deduzir: brl(t27.pd[i]), aqui: i === fx })) };

  // 2. o DAS de 2027 com tudo por dentro
  const direto = !F.mudouAnexo && F.aliqFonte === 'tabela' && !(pctST > 0) && !(pctMono > 0);
  const motivos = [];
  if (F.mudouAnexo) motivos.push('a indústria passa ao Anexo ' + a27);
  if (m.exclMono > 0) motivos.push('acaba a exclusão do PIS/Cofins monofásico');
  const contraHoje = Math.abs(m.das2027 - m.dasHoje) > MEIO_CENTAVO && motivos.length ? ' Hoje o DAS é de ' + brl(m.dasHoje) + ': muda porque ' + motivos.join(' e ') + '.' : '';
  if (direto) {
    passo('O DAS do mês em 2027, com tudo por dentro', [brl(receita) + ' × ' + pctF(r.aliqEfetiva * 100) + ' = ', { b: brl(m.das2027) }],
      'O faturamento do mês vezes a alíquota.', { prova: [[receita * r.aliqEfetiva, m.das2027]] });
  } else {
    const igual = Math.abs(m.dasCheio - m.das2027) <= MEIO_CENTAVO;
    const entram = [F.aliqFonte === 'informada' ? 'a alíquota do PGDAS' : '', F.mudouAnexo ? 'a indústria no Anexo ' + a27 : '',
      pctST > 0 ? pct(pctST) + ' do DAS excluído hoje (ICMS-ST, ISS retido, monofásico)' : '', pctMono > 0 ? 'o PIS/Cofins monofásico, que deixa de ser excluído em 2027' : ''].filter(Boolean);
    passo('O DAS do mês em 2027, com tudo por dentro',
      igual ? [brl(receita) + ' × ' + pctF(m.dasCheio / receita * 100) + ' = ', { b: brl(m.das2027) }]
        : [brl(receita) + ' × ' + pctF(m.dasCheio / receita * 100) + ' = ' + brl(m.dasCheio) + ' de DAS cheio · com a exclusão que continua em 2027: ', { b: brl(m.das2027) }],
      (entram.length ? 'Entram na conta: ' + entram.join('; ') + '.' : 'O faturamento do mês vezes a alíquota.') + contraHoje,
      { prova: [[receita * (m.dasCheio / receita), m.dasCheio]] });
  }

  // 3. a parte do DAS que é CBS e IBS
  const pelaPartilha = m.dasCheio * F.partilha2027 / 100, limitada = pelaPartilha - m.parcelaCbsIbs > MEIO_CENTAVO;
  passo('A parte desse DAS que é CBS e IBS',
    [brl(m.dasCheio) + ' × ' + pctF(F.partilha2027) + ' = ' + (limitada ? brl(pelaPartilha) + ' · limitada ao DAS de 2027: ' : ''), { b: brl(m.parcelaCbsIbs) }],
    'É o que sai do DAS se a empresa for por fora, e é o crédito que o cliente empresa desconta enquanto ela fica por dentro (Res. CGSN 140/2018, na redação da Res. CGSN 190/2026).'
      + (Math.abs(m.dasCheio - m.das2027) > MEIO_CENTAVO ? ' A partilha é sobre o DAS cheio: a exclusão de ST tira ICMS ou ISS, não a CBS e o IBS.' : ''),
    { prova: [[Math.min(pelaPartilha, m.das2027), m.parcelaCbsIbs]] });

  // 4. o DAS por fora
  passo('O DAS por fora', [brl(m.das2027) + ' − ' + brl(m.parcelaCbsIbs) + ' = ', { b: brl(m.dasSobra) }],
    'Continua com os outros tributos do Simples.', { prova: [[m.das2027 - m.parcelaCbsIbs, m.dasSobra]] });

  // 5. a base da CBS e do IBS por fora
  if (m.exclusaoBase > MEIO_CENTAVO) {
    passo('A base da CBS e do IBS por fora', [brl(receita) + ' − ' + brl(m.exclusaoBase) + ' = ', { b: brl(m.baseDebito) }],
      'De 2026 a 2032 o ' + trib + ' não entra na base da CBS e do IBS (LC 214, art. 12, § 2º, V). Sai o ' + trib + ' que continua no DAS.',
      { prova: [[receita - m.exclusaoBase, m.baseDebito]] });
  } else {
    passo('A base da CBS e do IBS por fora', [{ b: brl(m.baseDebito) }],
      !F.icmsIss.aplicada ? 'Base cheia: a conta foi feita sem tirar o ' + trib + ' do DAS.'
        : F.icmsIss.issFixo ? 'Com ISS fixo por profissional não há ISS no DAS para tirar.'
        : fx === 5 ? 'Nessa faixa o ' + trib + ' é pago fora do DAS, pelas regras normais. Ele também sai da base, mas esta conta não tem esse valor: o imposto por fora real fica um pouco menor.'
        : 'Não há ' + trib + ' próprio no DAS para tirar da base.',
      { prova: [[receita, m.baseDebito]] });
  }

  // 6. a CBS e o IBS das vendas
  const fatorVendas = F.precoFinalMantido ? (m.baseDebito > 0 ? m.debitoFora / (m.baseDebito * r.aliqRef) : F.mix) : F.mix;
  const comMix = Math.abs(fatorVendas - 1) > 0.00005;
  passo('A CBS e o IBS das vendas', [brl(m.baseDebito) + ' × ' + pct2(aliqRefPct) + (comMix ? ' × ' + fator(fatorVendas) : '') + ' = ', { b: brl(m.debitoFora) }],
    'CBS de ' + pct2(+ent.cbs) + ' mais IBS de ' + pct2(+ent.ibs) + '.' + (comMix ? ' O ' + fator(fatorVendas) + ' é a média das reduções do que a empresa vende.' : ''),
    { prova: [[m.baseDebito * r.aliqRef * fatorVendas, m.debitoFora]] });

  // 7. o crédito das compras
  const semEmb = 1 - pctEmb / 100, txtEmb = pctEmb > 0 ? ' × ' + fator(semEmb) : '';
  const fc = F.comprasMedido ? F.compras : F.mix;
  const partes = [];
  if (m.comprasMerc > MEIO_CENTAVO) partes.push(brl(m.comprasMerc) + txtEmb + ' × ' + pct2(aliqRefPct) + (Math.abs(fc - 1) > 0.00005 ? ' × ' + fator(fc) : ''));
  if (m.comprasDesp > MEIO_CENTAVO) partes.push(brl(m.comprasDesp) + txtEmb + ' × ' + pct2(aliqRefPct) + (Math.abs(F.despesas - 1) > 0.00005 ? ' × ' + fator(F.despesas) : ''));
  if (F.precoFinalMantido) {
    passo('O crédito das compras', [{ b: brl(m.creditoEntradas) }], 'O imposto que veio nas notas de compra e de despesa.');
  } else {
    passo('O crédito das compras', partes.length ? [partes.join(' + ') + ' = ', { b: brl(m.creditoEntradas) }] : [{ b: brl(0) }],
      partes.length ? 'O imposto que veio nas notas de compra e de despesa.' + (txtEmb ? ' O ' + fator(semEmb) + ' tira o ICMS e o IPI de dentro do valor da compra.' : '')
          + (m.comprasMerc > MEIO_CENTAVO && F.comprasMedido && Math.abs(fc - 1) > 0.00005 ? ' O ' + fator(fc) + ' é a parte das compras de mercadorias que dá crédito.' : '')
          + (m.comprasMerc > MEIO_CENTAVO && !F.comprasMedido && comMix ? ' As mercadorias seguem as mesmas reduções das vendas.' : '')
          + (m.comprasDesp > MEIO_CENTAVO && Math.abs(F.despesas - 1) > 0.00005 ? ' As despesas dão ' + pct(F.despesas * 100) + ' do crédito cheio.' : '')
        : 'Sem compras nem despesas com crédito na ficha.',
      { prova: [[m.comprasMerc * semEmb * r.aliqRef * fc + m.comprasDesp * semEmb * r.aliqRef * F.despesas, m.creditoEntradas]] });
  }

  // 8. a CBS e o IBS a pagar por fora
  const estoqueMes = +ent.creditoEstoqueMes || 0;
  const notaEstoque = estoqueMes > 0 ? 'De fevereiro em diante entra o crédito de estoque de ' + brl(estoqueMes) + ' por mês.' : '';
  if (m.debitoFora - m.creditoEntradas >= 0) {
    passo('A CBS e o IBS a pagar por fora', [brl(m.debitoFora) + ' − ' + brl(m.creditoEntradas) + ' = ', { b: brl(m.aRecolherSemEstoque) }], notaEstoque,
      { prova: [[m.debitoFora - m.creditoEntradas, m.aRecolherSemEstoque]] });
  } else {
    passo('A CBS e o IBS a pagar por fora', [brl(m.debitoFora) + ' − ' + brl(m.creditoEntradas) + ': o crédito é maior. ', { b: 'Nada a pagar' }, ', e sobram ' + brl(m.creditoEntradas - m.debitoFora) + ' de crédito no mês.'],
      ('A sobra fica para abater depois. ' + notaEstoque).trim(), { prova: [[0, m.aRecolherSemEstoque]] });
  }

  // 9. os seis meses
  const txtDif = Math.abs(s.diferenca) < MEIO_CENTAVO ? 'nenhuma' : brl(Math.abs(s.diferenca)) + (s.diferenca > 0 ? ' a mais por fora' : ' a menos por fora');
  passo('Os seis meses lado a lado',
    ['Por dentro: ' + brl(q.dentro.total) + ' · Por fora: ' + brl(q.fora.total) + (q.fora.sobra > MEIO_CENTAVO ? ' · Crédito que sobra: ' + brl(q.fora.sobra) : '') + ' · Diferença: ', { b: txtDif }],
    (q.mesesIguais ? 'Seis meses iguais ao mês da ficha.' : 'Seis meses com o faturamento do mês da ficha; o crédito de estoque entra de fevereiro a junho.')
      + (q.fora.sobra > MEIO_CENTAVO ? ' O crédito que sobra conta a favor do caminho por fora.' : '')
      + ' Diferença menor que ' + brl(r.veredito.limiarEmpate) + ' no semestre é empate, a não ser que os clientes empresa ganhem mais do que isso em crédito.'
      + (Math.abs(s.diferenca) < r.veredito.limiarEmpate && !r.veredito.empate && Math.abs(s.diferenca) >= MEIO_CENTAVO
        ? ' Aqui a diferença é menor, mas eles descontam ' + brl(r.veredito.ganhoAproveitado) + ' a mais: não é empate.' : ''),
    { prova: [[q.fora.total - q.dentro.total - q.fora.sobra, s.diferenca]] });

  // 10. o crédito de quem compra da empresa: o que vai nas notas de todas as vendas e, dele, o que os clientes empresa descontam
  const ga = r.veredito.ganhoAproveitado;
  const notaBar = +ent.mixRed40 > 0 ? ' A alimentação preparada no bar ou restaurante não dá crédito a quem compra (LC 214, art. 276): por isso o crédito por fora é menor que o imposto das vendas.' : '';
  if (pj > 0) {
    passo('O crédito de quem compra da empresa',
      ['Por dentro: ' + brl(m.parcelaCbsIbs) + ' × ' + pct(pj, 4) + ' = ' + brl(m.parcelaCbsIbs * pj / 100) + ' por mês · Por fora: ' + brl(m.debitoCreditavel) + ' × ' + pct(pj, 4) + ' = ', { b: brl(m.debitoCreditavel * pj / 100) + ' por mês' }],
      'O crédito que vai nas notas de todas as vendas, vezes a parte vendida para empresas que usam o crédito. No semestre, elas descontam ' + brl(Math.abs(ga)) + (ga >= 0 ? ' a mais' : ' a menos') + ' se a empresa for por fora.' + notaBar,
      { prova: [[m.parcelaCbsIbs * pj / 100 * 6, s.aproveitadoDentro], [m.debitoCreditavel * pj / 100 * 6, s.aproveitadoFora], [(m.debitoCreditavel - m.parcelaCbsIbs) * pj / 100 * 6, ga]] });
  } else {
    passo('O crédito de quem compra da empresa', ['Nas notas de todas as vendas: ' + brl(m.parcelaCbsIbs) + ' por mês por dentro · ', { b: brl(m.debitoCreditavel) + ' por mês por fora' }],
      'Hoje a ficha não tem vendas para empresas que usam o crédito: ninguém desconta esse valor.' + notaBar,
      { prova: [[m.parcelaCbsIbs * 6, s.creditoClienteDentro], [m.debitoCreditavel * 6, s.creditoClienteFora]] });
  }

  const fecho = 'No detalhe técnico a comparação aparece como custo tributário, que soma o imposto que vem dentro das compras: ' + brl(s.custoDentro) + ' por dentro e '
    + brl(s.custoFora) + ' por fora no semestre. A diferença é a mesma. Os percentuais aparecem arredondados; a conta usa todas as casas.';
  return { passos, fecho };
}

// a CBS da conta é a da referência que o TCU calculou (menos 0,1 ponto)? Mesma regra da confiança (rt-confianca.js)
const cbsDoTcu = ent => Math.abs(+ent.cbs - Math.round((REFERENCIA_CBS_2027.valor - 0.1) * 100) / 100) < MEIO_CENTAVO;

// o que a conta supõe, em frases
export function premissasDaConta(r, ent) {
  const R = REFERENCIA_CBS_2027, itens = [];
  itens.push(cbsDoTcu(ent)
    ? 'CBS de ' + pct2(+ent.cbs) + ' e IBS de ' + pct2(+ent.ibs) + ' em 2027. A alíquota de referência de ' + pct(R.valor) + ' foi ' + R.origem + (R.fixada ? '.' : '; falta a confirmação: ' + R.pendente + '.')
    : 'CBS de ' + pct2(+ent.cbs) + ' e IBS de ' + pct2(+ent.ibs) + ', como está na ficha. A referência ' + R.origem + ' é de ' + pct(R.valor) + '.');
  itens.push(r.fatores.precoFinalMantido
    ? 'O preço final fica igual ao de hoje: a CBS e o IBS saem de dentro do preço, na venda e na compra.'
    : 'O imposto é calculado sobre o faturamento de hoje: a conta não supõe aumento de preço.');
  itens.push(r.fatores.icmsIss.aplicada
    ? 'Por fora, o ICMS ou o ISS que continua no DAS sai da base da CBS e do IBS (LC 214, art. 12, § 2º, V). Para o optante do Simples ainda não há norma específica que diga como medir o ICMS.'
    : 'Por fora, a CBS e o IBS foram calculados sobre o faturamento cheio, sem tirar o ICMS ou o ISS do DAS.');
  itens.push('As compras dão crédito pelos percentuais da ficha. Nota de fornecedor do Simples que ficou por dentro dá bem menos crédito.');
  itens.push((+ent.creditoEstoqueMes || 0) > 0 ? 'Conta os seis primeiros meses de 2027 com o faturamento do mês da ficha, e o crédito de estoque de fevereiro em diante (provável, não garantido).'
    : 'Conta os seis primeiros meses de 2027, todos iguais ao mês da ficha.');
  itens.push('Diferença abaixo de ' + pct(LIMIAR_EMPATE_PCT) + ' do faturamento do semestre, com mínimo de ' + brl(LIMIAR_EMPATE_MIN) + ', é empate e a empresa fica no DAS, a não ser que os clientes empresa ganhem mais do que isso em crédito.');
  return itens;
}

// ============================================================
// resumoParaCopiar({ r, ent, veredito, quadro, empresa, hoje, faltam }) → texto puro, pra colar no WhatsApp ou no e-mail.
// Sem conclusão não tem resumo (devolve ''): não há o que recomendar. `faltam`: o que falta confirmar, nas palavras do
// cliente (faltamCliente da confiança). `hoje` em dd/mm/aaaa.
// ============================================================
export function resumoParaCopiar({ r, ent, veredito, quadro, empresa, hoje, faltam } = {}) {
  if (!r || !veredito || veredito.semConclusao) return '';
  const q = quadro || quadroDosCaminhos(r, ent), R = REFERENCIA_CBS_2027, F = r.fatores;
  const receita = +ent.receita, compras = receita * ((+ent.pctComprasMercadorias || 0) + (+ent.pctComprasDespesas || 0)) / 100;
  const media = q.mesesIguais ? ' por mês' : ' por mês, em média';
  const L = [];
  L.push('Simples em 2027: CBS e IBS por dentro ou por fora do DAS');
  if (empresa) L.push(String(empresa).trim());
  L.push('Macedo & Reis Contabilidade' + (hoje ? ' · simulação de ' + hoje : ''));
  L.push('');
  L.push('Anexo ' + F.anexo + (F.mudouAnexo ? ' (Anexo ' + F.anexo2027 + ' em 2027)' : '') + ' · faturamento de 12 meses ' + brl(+ent.rbt12) + ' · mês ' + brl(receita));
  L.push('Compras e despesas com nota: ' + brl(compras) + ' por mês · vendas para empresas que usam o crédito: ' + (veredito.hoje || pct(+ent.pctPJ || 0)));
  L.push('');
  L.push('Tudo no DAS (por dentro): ' + brl(q.dentro.total / 6) + ' por mês · ' + brl(q.dentro.total) + ' no semestre');
  L.push('CBS e IBS por fora: DAS de ' + brl(q.fora.das / 6) + ' + CBS e IBS de ' + brl(q.fora.aRecolher / 6) + ' = ' + brl(q.fora.total / 6) + media + ' · ' + brl(q.fora.total) + ' no semestre');
  if (q.fora.sobra > MEIO_CENTAVO) L.push('Por fora ainda sobram ' + brl(q.fora.sobra) + ' de crédito no semestre, para abater depois.');
  if (q.pctPJ > 0) L.push('Crédito que os clientes empresa descontam (' + (veredito.hoje || pct(q.pctPJ)) + ' das vendas): ' + brl(q.dentro.aproveitado / 6) + ' por mês por dentro · ' + brl(q.fora.aproveitado / 6) + ' por fora');
  L.push('');
  L.push('Resultado para janeiro a junho de 2027: ' + veredito.titulo + '.');
  L.push(textoDe(veredito.porque));
  if (veredito.nota) L.push(veredito.nota);
  if (veredito.depois) L.push(veredito.depois);
  if (faltam && faltam.length) L.push('Este resultado ainda depende de confirmar: ' + faltam.join('; ') + '.');
  L.push('');
  L.push('Premissas: CBS de ' + pct2(+ent.cbs) + ' e IBS de ' + pct2(+ent.ibs) + (cbsDoTcu(ent) ? ' (referência de ' + pct(R.valor) + ', ' + R.rodape + ')' : '')
    + (F.precoFinalMantido ? '; preço final igual ao de hoje, com o imposto saindo de dentro dele' : '; imposto calculado sobre o faturamento de hoje')
    + '; seis meses com o faturamento do mês simulado.');
  L.push('Valores estimados, calculados com os dados informados. A decisão é da empresa.');
  return semNbsp(L.join('\n'));
}
