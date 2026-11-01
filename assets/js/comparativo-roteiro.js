// ============================================================
// MACEDO & REIS — Comparativo tributário: o roteiro do estudo, em fases e missões
// Módulo ES puro, sem DOM. Diz por onde começar quando a empresa abre: o que falta e o que conferir, em fases — pode ficar
// no Simples, os números da empresa, as premissas, o veredito —, cada uma com as suas missões (pôr o relatório que falta,
// preencher um número, conferir um padrão), com o próximo passo na frente. Pedidos do Samuel, 01/11/2026: "uma espécie de
// guia do que fazer primeiro, do próximo passo, do que falta — se não a gente abre uma empresa e dá aquele choque de um
// monte de informação" e "tem que ser quase como um jogo, onde se passa de fases, se cumpre missões ao pôr o relatório
// necessário ou preencher alguma info". Enquanto falta uma missão que pode virar a decisão, o estudo é provisório.
// Testado por tests/comparativo-roteiro.test.mjs.
// ============================================================

import { LIMITE_SIMPLES, SUBLIMITE, ROTULO_REGIME, TIPOS, fraseDaDecisao } from './comparativo-motor.js';
import { DO_SISTEMA } from './comparativo-dados.js';

const num = (v, def = 0) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct0 = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
const pct = (v, d = 1) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloComp = c => c ? MES_CURTO[Number(String(c).slice(5, 7)) - 1] + '/' + String(c).slice(2, 4) : '';
const maiuscula = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const juntar = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l.join('');
const pegar = (o, caminho) => String(caminho).split('.').reduce((x, k) => x == null ? x : x[k], o);

// o nome de cada campo no roteiro
const NOMES = {
  aliqCreditoIcms: 'o crédito de ICMS das compras', pctComprasSimples: 'as compras de fornecedor do Simples',
  rat: 'o RAT', fap: 'o FAP', terceiros: 'terceiros (sistema S)', crescimentoReceita: 'o crescimento da receita',
  outrasDespesas: 'as outras despesas', difalSimples: 'o ICMS pago fora do DAS',
  aliqIcms: 'o ICMS das vendas', redIcms: 'a redução da base do ICMS no regime geral', redIcmsSimples: 'a redução do ICMS no DAS',
  aliqIss: 'o ISS'
};
const nomeDoCampo = c => NOMES[c] || NOMES[String(c).split('.').pop()] || c;
// como a missão foi cumprida, pela origem do número
const COMO = { reforma: 'veio do caso da Reforma', dominio: 'veio do relatório do Domínio', pgdas: 'veio do PGDAS da Receita', fator_r: 'veio do Fator R',
  cadastro: 'veio do cadastro', digitado: 'digitado', confirmado: 'conferido', gravado: 'do estudo gravado' };

// ---------- o crescimento que o sistema mediu ----------
// os 3 últimos meses da série contra os 3 primeiros (de até 12): quanto a receita andou no período
export function crescimentoMedido(serie) {
  const s = (serie || []).filter(m => m && num(m.total) > 0).slice(-12);
  if (s.length < 9) return null;
  const a = s.slice(0, 3), b = s.slice(-3);
  const ini = a.reduce((t, m) => t + num(m.total), 0), fim = b.reduce((t, m) => t + num(m.total), 0);
  return ini > 0 ? { pct: (fim / ini - 1) * 100, ini: [a[0].competencia, a[2].competencia], fim: [b[0].competencia, b[2].competencia] } : null;
}

// ---------- as fases ----------
export const FASES = [
  { id: 'simples', titulo: 'Ela pode ficar no Simples?', objetivo: 'A receita, o limite de R$ 4,8 milhões e as empresas dos sócios: o Simples é uma opção em 2027 e 2028?' },
  { id: 'numeros', titulo: 'Os números da empresa', objetivo: 'A conta com os números de verdade: a folha, as compras, o PGDAS e as despesas.' },
  { id: 'premissas', titulo: 'As premissas', objetivo: 'O que ficou no padrão e pode virar o resultado: o ICMS, o crédito, o crescimento.' },
  { id: 'veredito', titulo: 'O veredito', objetivo: 'Com as missões que decidem cumpridas, o regime mais barato e quanto.' }
];

// ---------- o roteiro ----------
// entrada e origens: as da tela · comparacao: comparar() (null se a conta não roda) · testes: testarPremissas()
// situacao: situacaoDoGrupo() (o ano-calendário pelos números do sistema) · serie: a receita datada da empresa
// socios: quantos sócios o cadastro tem (null = sem cadastro ou não lido) · achadas: quantas empresas dos sócios o sistema
// achou (a tela pode tirar da soma) · grupoFora: as que o sistema achou e a regra deixa fora da soma ([{ nome, motivo }])
// · conferencia: o PGDAS lido ({ fonte, … } ou null)
// Volta { fases, passos, provisorio, decidem, pendentes, proximo, faseAtual, pronto, feitas, total, extras, doSistema }.
// Cada missão: { id, fase, titulo, curto (o nome na frase do resultado), texto, estado ('feita' | 'aberta'), falta (o
// número não existe — senão é conferir), peso ('decide' | 'importa' | 'detalhe' — a extra), como (cumprida como), campo
// (pra onde ir) e irRotulo, relatorio (o relatório do Domínio que cumpre a missão), conferir (os campos que o "está certo"
// marca) e conferirRotulo, acao ('mais-grupo') e acaoRotulo }. `passos` são as missões com o estado antigo (falta |
// conferir | feito), na ordem: o que falta e decide primeiro.
export function roteiroDoEstudo({ entrada = {}, origens = {}, comparacao = null, testes = [], situacao = null, serie = null, socios = null, achadas = 0, grupoFora = [], conferencia = null } = {}) {
  const e = entrada || {}, o = origens || {};
  const fonte = k => (o[k] && o[k].fonte) || 'padrao';
  const padrao = k => fonte(k) === 'padrao';
  const conferido = k => fonte(k) === 'confirmado';
  const como = k => COMO[fonte(k)] || 'feito';
  const ats = (e.atividades || []).filter(a => a && TIPOS[a.tipo]);
  const receita = ats.reduce((t, a) => t + num(a.receita), 0);
  const temIcms = ats.some(a => (a.tributo || TIPOS[a.tipo].tributo) === 'icms');
  const c = comparacao;
  const d = c && c.decisao;
  const rDec = c && d ? c.anos.find(r => r.ano === d.ano) : null;
  const ROT = r => ROTULO_REGIME[r] || r;
  const missoes = [];
  const add = m => missoes.push({ estado: 'aberta', falta: false, peso: 'importa', campo: null, conferir: null, relatorio: null, acao: null, como: null, ...m });

  // ===== fase 1: pode ficar no Simples? =====
  const recOk = receita > 0 && !ats.some((a, i) => padrao('atividades.' + i + '.receita') && !(num(a.receita) > 0));
  add({ id: 'receita', fase: 'simples', titulo: 'A receita dos 12 meses', curto: 'a receita', peso: 'decide',
    estado: recOk ? 'feita' : 'aberta', falta: !recOk, como: recOk ? como('atividades.0.receita') : null,
    texto: recOk ? brl(receita) + ' nos 12 meses.' : 'Sem ela não há conta. Solte o faturamento do Domínio ou digite os 12 meses.',
    campo: 'atividades.0.receita', irRotulo: 'Digitar a receita', relatorio: 'o faturamento' });

  const grupo = (e.grupo || []).filter(g => g && num(g.receita) > 0);
  const soma12 = receita + grupo.reduce((t, g) => t + num(g.receita), 0);
  const fora = c ? c.anos.filter(r => r.simples && r.simples.disponivel === false) : [];
  const perto = receita > 0 && (soma12 >= 0.85 * LIMITE_SIMPLES || !!(situacao && situacao.passaEm) || fora.length > 0);
  if (receita > 0 && (grupo.length || soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE || fora.length)) {
    const partes = [];
    if (grupo.length) partes.push('Os sócios também têm ' + juntar(grupo.map(g => g.nome)) + '. O limite de R$ 4,8 milhões vale pra soma: nos 12 meses, ' + brl(soma12) + ' (' + pct0(soma12 / LIMITE_SIMPLES * 100) + '% do limite).');
    else if (soma12 >= 0.8 * LIMITE_SIMPLES) partes.push('A receita dos 12 meses é ' + brl(receita) + ', ' + pct0(receita / LIMITE_SIMPLES * 100) + '% do limite de R$ 4,8 milhões.');
    if (situacao && situacao.meses > 0) {
      let t = 'Em ' + situacao.ano + ', até ' + rotuloComp(situacao.ate) + ', ' + (grupo.length ? 'as empresas somam ' : 'a receita é de ') + brl(situacao.acumulado) + '.';
      const tolerancia = situacao.noAnoSeguinte ? ' (sozinha, o excesso de até 20% só tira do Simples no ano seguinte)' : '';
      if (situacao.jaPassou) t += ' Passou do limite em ' + situacao.passaEm + ': a exclusão vale a partir de ' + situacao.saiEm + tolerancia + '.';
      else if (situacao.passaEm) t += ' No ritmo dos últimos 3 meses (' + brl(situacao.ritmo) + ' por mês), passa do limite em ' + situacao.passaEm + (grupo.length ? ' e as empresas saem' : ' e a empresa sai') + ' do Simples em ' + situacao.saiEm + tolerancia + '.';
      else if (situacao.restantes > 0) t += ' Faltam ' + brl(situacao.faltam) + ' pro limite, ' + brl(situacao.porMesAteOLimite) + ' por mês até dezembro; o ritmo dos últimos 3 meses é ' + brl(situacao.ritmo) + ' por mês.';
      partes.push(t);
    }
    if (receita >= 0.85 * SUBLIMITE) partes.push('Sozinha, a receita está perto do sublimite de R$ 3,6 milhões: acima dele no ano, o ICMS e o ISS saem do DAS (a conta já faz isso).');
    (grupoFora || []).forEach(g => partes.push(g.nome + ' é dos mesmos sócios, mas fica fora da soma: ' + g.motivo + '.'));
    if (fora.length) partes.push('Na conta, o Simples fica fora ' + juntar(fora.map(r => r.k === 0 ? 'nos 12 meses' : 'em ' + r.ano)) + ': ' + fora[0].simples.motivo);
    partes.push(situacao ? 'Confira os meses mais recentes no Domínio: eles decidem.' : 'Confira a receita das outras empresas.');
    add({ id: 'limite', fase: 'simples', titulo: grupo.length ? 'A receita somada com as empresas dos sócios' : 'O limite do Simples', curto: 'o limite do Simples',
      texto: partes.join(' '), peso: perto ? 'decide' : 'importa', estado: conferido('grupo') ? 'feita' : 'aberta', como: 'conferido',
      campo: grupo.length ? 'grupo.0.receita' : 'crescimentoReceita', irRotulo: grupo.length ? 'Ver as empresas' : 'Ver a projeção',
      conferir: ['grupo'], conferirRotulo: 'Conferido' });
  } else if (receita > 0) {
    // longe do limite: as empresas dos sócios ficam como extra — o sistema já olhou o cadastro, ou o cadastro não tem os sócios
    // (a empresa que o sistema achou e a tela tirou da soma fica dita)
    const semSocios = !(num(socios) > 0);
    const tirada = num(achadas) > 0 && !grupo.length;
    const pelaRegra = (grupoFora || []).length > 0 && !grupo.length && !tirada;
    const feita = !semSocios || tirada || conferido('grupo');
    add({ id: 'limite', fase: 'simples', titulo: 'As empresas dos sócios', curto: 'as empresas dos sócios', peso: 'detalhe',
      estado: feita ? 'feita' : 'aberta', como: conferido('grupo') ? 'conferido' : tirada ? 'tirada da soma' : 'o sistema olhou o cadastro',
      texto: pelaRegra
        ? grupoFora.map(g => g.nome + ' é dos mesmos sócios, mas fica fora da soma: ' + g.motivo + '.').join(' ')
        : tirada
        ? 'A empresa dos sócios que o sistema achou ficou fora da soma. Se ela ainda for dos sócios, ponha de volta: o limite de R$ 4,8 milhões vale pra soma.'
        : semSocios
        ? 'O cadastro não tem os sócios desta empresa. Se eles tiverem outra empresa, o limite de R$ 4,8 milhões vale pra soma — longe dele, só pesa se a outra for grande.'
        : 'Nenhuma outra empresa dos sócios no cadastro. Se eles tiverem empresa fora do escritório, ponha aqui: o limite vale pra soma.',
      acao: 'mais-grupo', acaoRotulo: '+ Empresa dos mesmos sócios', conferir: semSocios ? ['grupo'] : null, conferirRotulo: 'Não têm outra empresa' });
  }

  // ===== fase 2: os números da empresa =====
  const semFolha = !(num(e.folha) + num(e.proLabore) > 0);
  const folhaOk = (!semFolha && !padrao('folha')) || conferido('folha') || fonte('folha') === 'digitado';
  add({ id: 'folha', fase: 'numeros', titulo: 'A folha e o pró-labore', curto: 'a folha e o pró-labore', peso: 'decide',
    estado: folhaOk ? 'feita' : 'aberta', falta: !folhaOk, como: folhaOk ? (semFolha ? 'sem folha nem pró-labore' : como('folha')) : null,
    texto: folhaOk
      ? (semFolha ? 'A empresa não tem folha nem pró-labore.' : 'Folha de ' + brl(e.folha) + ' e pró-labore de ' + brl(e.proLabore) + ' nos 12 meses.')
      : 'Faltam. Sem eles, o INSS patronal (cerca de 28% da folha e 20% do pró-labore) sai zero: o Presumido parece mais barato do que é e, no Real, o lucro sai maior do que é.' +
        (ats.some(a => a.tipo === 'servico_r') ? ' No Simples, o serviço do fator r fica no Anexo V sem folha.' : '') + ' É o número que mais falta.',
    campo: 'folha', irRotulo: 'Digitar a folha', conferir: folhaOk ? null : ['folha', 'proLabore'], conferirRotulo: 'Não tem folha nem pró-labore' });
  const faltaFolha = !folhaOk;

  if (receita > 0) {
    const comprasOk = !padrao('compras') && (num(e.compras) > 0 || conferido('compras') || fonte('compras') === 'digitado');
    add({ id: 'compras', fase: 'numeros', titulo: 'As compras', curto: 'as compras', peso: temIcms ? 'importa' : 'detalhe',
      estado: comprasOk ? 'feita' : 'aberta', falta: !comprasOk, como: comprasOk ? como('compras') : null,
      texto: comprasOk ? brl(e.compras) + ' em mercadorias e insumos nos 12 meses.' : 'Sem as compras, o lucro do Real e o crédito de ICMS e de CBS/IBS saem errados. Solte o acompanhamento de entradas do Domínio ou digite.',
      campo: 'compras', irRotulo: 'Digitar as compras', relatorio: 'as entradas', conferir: comprasOk ? null : ['compras'], conferirRotulo: 'Não tem compras' });
  }
  if (receita > 0 && e.regimeAtual === 'simples') {
    const pgOk = !!(conferencia && num(conferencia.aliquota) > 0);
    add({ id: 'pgdas', fase: 'numeros', titulo: 'O PGDAS', curto: 'o PGDAS', peso: 'importa',
      estado: pgOk ? 'feita' : 'aberta', falta: !pgOk, como: pgOk ? (COMO[conferencia.fonte] || 'veio do sistema') : null,
      texto: pgOk ? 'O de ' + rotuloComp(conferencia.competencia) + ' confere a conta do Simples: alíquota efetiva de ' + pct(conferencia.aliquota, 2) + '%.'
        : 'O PGDAS confere a conta do Simples e mostra o ST, o monofásico e as reduções do ICMS. Solte o do último mês.',
      relatorio: 'o PGDAS' });
  }
  if (rDec && d && d.real) {
    const alvo = d.melhor === 'real' ? d.segundo : d.melhor;
    const emp = alvo && d.real.empate[alvo];
    const despOk = !padrao('outrasDespesas') || num(e.outrasDespesas) > 0;
    if (despOk) {
      add({ id: 'lucro', fase: 'numeros', titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: 'importa', estado: 'feita', como: como('outrasDespesas'),
        texto: 'Outras despesas de ' + brl(e.outrasDespesas) + ': a conta usou lucro de ' + brl(d.real.lucro) + ' antes do IR.' });
    } else if (emp && emp.nunca) {
      add({ id: 'lucro', fase: 'numeros', titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: 'detalhe', estado: 'feita', como: 'a conta mostrou',
        texto: 'Nem com lucro zero o Real fica abaixo do ' + ROT(alvo) + ': as despesas sem nota não mudam a decisão.' });
    } else if (emp) {
      const margem = emp.margem != null ? emp.margem * 100 : 0;
      const decide = d.melhor === 'real' || margem >= 5;
      add({ id: 'lucro', fase: 'numeros', titulo: 'O lucro do Real', curto: 'o lucro do Real', peso: decide ? 'decide' : 'detalhe',
        texto: 'O Real empata com o ' + ROT(alvo) + ' com lucro de ' + brl(emp.lucro) + ' antes do IR (' + pct(margem) + '% da receita); a conta usou ' + brl(d.real.lucro) +
          (faltaFolha ? ', sem a folha e' : ',') + ' sem as despesas sem nota (aluguel de pessoa física, aplicativo de entrega, gás, manutenção, contador). ' + (decide ? 'Se o lucro de verdade ficar abaixo do empate, o Real sai mais barato.' : 'Só um lucro bem baixo faria o Real ganhar.'),
        campo: 'outrasDespesas', irRotulo: 'Digitar as despesas', conferir: ['outrasDespesas'], conferirRotulo: 'Não tem outras despesas' });
    }
  }

  // ===== fase 3: as premissas =====
  // as que ficaram no padrão e viram o resultado (sem a folha, a virada pro Presumido ainda não diz muito: o INSS da folha o
  // encarece; no Real, a folha abate o lucro e o IR a menos passa o INSS a mais — a virada pro Real fica de pé)
  const testadas = new Set();
  (testes || []).filter(t => t.muda).forEach(t => {
    testadas.add(t.campo);
    const v = t.variantes.filter(x => x.melhor !== t.melhorBase);
    const un = !t.unidade ? '' : t.unidade.startsWith('%') ? t.unidade : ' ' + t.unidade;
    const atual = pegar(e, t.campo);
    const pelaFolha = faltaFolha && v.every(x => x.melhor === 'presumido');
    add({ id: 'premissa:' + t.campo, fase: 'premissas', titulo: maiuscula(t.rotulo), curto: t.rotulo, peso: pelaFolha ? 'importa' : 'decide',
      texto: 'Está no padrão' + (atual != null ? ' (' + pct(atual, 2) + un + ')' : '') + '. Com ' + v.map(x => pct(x.valor, 2) + un + ', o mais barato passa a ser o ' + ROT(x.melhor)).join('; com ') + '.' +
        (pelaFolha ? ' Sem a folha na conta, isso ainda não diz muito: o INSS dela encarece o Presumido. Confira depois dela.' : ''),
      campo: t.campo, irRotulo: 'Ir ao campo', conferir: [t.campo], conferirRotulo: 'Está certo' });
  });
  if (receita > 0) {
    const g = crescimentoMedido(serie);
    const pertoDoLimite = soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE;
    const crescOk = !padrao('crescimentoReceita');
    add({ id: 'crescimento', fase: 'premissas', titulo: 'O crescimento', curto: 'o crescimento', peso: pertoDoLimite ? 'decide' : 'importa',
      estado: crescOk ? 'feita' : 'aberta', como: crescOk ? como('crescimentoReceita') : null,
      texto: crescOk ? (num(e.crescimentoReceita) ? pct(e.crescimentoReceita) + '% ao ano nas projeções.' : 'Sem crescimento: 2027 e 2028 repetem os 12 meses.')
        : 'Sem crescimento, 2027 e 2028 repetem os 12 meses.' + (g ? ' Pelos números do sistema, de ' + rotuloComp(g.fim[0]) + ' a ' + rotuloComp(g.fim[1]) + ' a receita veio ' + pct(Math.abs(g.pct), 0) + '% ' + (g.pct >= 0 ? 'acima' : 'abaixo') + ' da de ' + rotuloComp(g.ini[0]) + ' a ' + rotuloComp(g.ini[1]) + '.' : '') +
          (pertoDoLimite ? ' Perto do limite, o crescimento decide quando ela sai do Simples.' : ''),
      campo: 'crescimentoReceita', irRotulo: 'Ir à projeção', conferir: crescOk ? null : ['crescimentoReceita', 'crescimentoFolha'], conferirRotulo: 'Sem crescimento está certo' });
  }
  // o resto que pesa na conta: os padrões que não viram o resultado, juntos numa extra
  const jaNoRoteiro = new Set(missoes.flatMap(m => m.conferir || []).concat([...testadas]));
  const relevantes = [];
  const ver = k => { if (!jaNoRoteiro.has(k) && !relevantes.includes(k)) relevantes.push(k); };
  ats.forEach((a, i) => {
    if (!(num(a.receita) > 0)) return;
    if ((a.tributo || TIPOS[a.tipo].tributo) === 'icms') { ver('atividades.' + i + '.aliqIcms'); if (num(a.redIcms) > 0 || !padrao('atividades.' + i + '.redIcms')) ver('atividades.' + i + '.redIcms'); if (num(a.redIcmsSimples) > 0) ver('atividades.' + i + '.redIcmsSimples'); }
    else ver('atividades.' + i + '.aliqIss');
  });
  if (num(e.compras) > 0) { if (temIcms) ver('aliqCreditoIcms'); ver('pctComprasSimples'); }
  if (!semFolha) { ver('rat'); ver('terceiros'); }
  const noPadrao = relevantes.filter(padrao);
  if (relevantes.length) {
    add({ id: 'resto', fase: 'premissas', titulo: 'Os outros padrões', curto: 'os padrões', peso: 'detalhe',
      estado: noPadrao.length ? 'aberta' : 'feita', como: noPadrao.length ? null : 'conferidos',
      texto: noPadrao.length ? 'Estão no padrão e não viram o resultado: ' + noPadrao.map(nomeDoCampo).join(', ') + '.' : 'Nada mais no padrão.',
      campo: noPadrao[0] || null, irRotulo: 'Ir ao primeiro', conferir: noPadrao.length ? noPadrao : null, conferirRotulo: 'Estão certos' });
  }

  // ===== as fases, o progresso e o veredito =====
  const conta = m => m.peso !== 'detalhe';
  const fases = FASES.map(f => {
    const ms = missoes.filter(m => m.fase === f.id);
    const valem = ms.filter(conta);
    return { ...f, missoes: ms, feitas: valem.filter(m => m.estado === 'feita').length, total: valem.length,
      extras: ms.filter(m => !conta(m)).length, extrasFeitas: ms.filter(m => !conta(m) && m.estado === 'feita').length,
      concluida: valem.every(m => m.estado === 'feita') };
  });
  const [f1, f2, f3, f4] = fases;
  f4.concluida = !!c && f1.concluida && f2.concluida && f3.concluida;
  // o que cada fase concluída conquistou
  if (f1.concluida) {
    if (fora.length) { f1.conquista = 'O Simples fica fora ' + juntar(fora.map(r => r.k === 0 ? 'nos 12 meses' : 'em ' + r.ano)) + '.'; f1.alerta = true; }
    else if (situacao && situacao.passaEm) { f1.conquista = 'No ritmo de hoje, ' + (grupo.length ? 'a soma' : 'a receita') + ' passa do limite em ' + situacao.passaEm + ': saída do Simples em ' + situacao.saiEm + '.'; f1.alerta = true; }
    else f1.conquista = 'O Simples é uma opção em 2027 e 2028' + (grupo.length ? ', com a soma das empresas em ' + pct0(soma12 / LIMITE_SIMPLES * 100) + '% do limite' : '') + '.';
  }
  if (f2.concluida) f2.conquista = 'A conta já usa os números da empresa.';
  if (f3.concluida) f3.conquista = 'Nada do que ficou no padrão vira o resultado.';
  if (f4.concluida) f4.conquista = fraseDaDecisao(c);
  // a fase de agora: a primeira que não está concluída (com as três primeiras feitas, o veredito)
  const iAberta = fases.findIndex(f => !f.concluida);
  const faseAtual = iAberta === -1 ? 3 : iAberta;

  // a lista antiga (o estado de cada passo e a ordem: o que falta e decide primeiro)
  const PESO = { decide: 0, importa: 1, detalhe: 2 };
  const ordemFase = Object.fromEntries(FASES.map((f, i) => [f.id, i]));
  const passos = missoes.map((m, i) => ({ m, i })).sort((a, b) =>
    ((a.m.estado === 'feita') - (b.m.estado === 'feita')) || (PESO[a.m.peso] - PESO[b.m.peso]) || (ordemFase[a.m.fase] - ordemFase[b.m.fase]) || (a.i - b.i))
    .map(({ m }) => ({ ...m, estado: m.estado === 'feita' ? 'feito' : (m.falta ? 'falta' : 'conferir') }));
  const pendentes = passos.filter(p => p.estado !== 'feito');
  const decidem = pendentes.filter(p => p.peso === 'decide');
  const valem = missoes.filter(conta), extras = missoes.filter(m => !conta(m));
  // o que veio do sistema (o verde da tela)
  const doSistema = [];
  const marca = (k, nome) => { if (DO_SISTEMA.includes(fonte(k)) && !doSistema.includes(nome)) doSistema.push(nome); };
  ats.forEach((a, i) => { marca('atividades.' + i + '.receita', 'a receita'); marca('atividades.' + i + '.pctST', 'o ST'); marca('atividades.' + i + '.pctMonofasico', 'o monofásico'); marca('atividades.' + i + '.redIcmsSimples', 'a redução do ICMS no DAS'); });
  marca('compras', 'as compras'); marca('despesasCredito', 'as despesas com crédito'); marca('folha', 'a folha'); marca('proLabore', 'o pró-labore'); marca('mix', 'as alíquotas da Reforma');
  (e.grupo || []).forEach((g, i) => marca('grupo.' + i + '.receita', 'a receita de ' + g.nome));
  // o próximo passo: a primeira missão aberta da fase de agora (as que decidem antes); sem nenhuma lá, a primeira de todas
  const proximo = pendentes.find(p => p.fase === (fases[faseAtual] || {}).id) || pendentes[0] || null;
  return {
    fases, faseAtual, passos, pendentes: pendentes.length, proximo,
    provisorio: decidem.length > 0, decidem: decidem.length, pronto: f4.concluida,
    feitas: valem.filter(m => m.estado === 'feita').length, total: valem.length,
    extras: extras.length, extrasFeitas: extras.filter(m => m.estado === 'feita').length, doSistema
  };
}
