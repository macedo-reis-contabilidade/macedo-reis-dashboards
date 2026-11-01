// ============================================================
// MACEDO & REIS — Comparativo tributário: o roteiro do estudo
// Módulo ES puro, sem DOM. Diz por onde começar quando a empresa abre: o que falta e o que conferir, na ordem do que pesa
// na decisão, com o próximo passo na frente (pedido do Samuel, 01/11/2026: "uma espécie de guia do que fazer primeiro, do
// próximo passo, do que falta — se não a gente abre uma empresa e dá aquele choque de um monte de informação").
// Enquanto falta algo que pode virar a decisão, o estudo é provisório. Testado por tests/comparativo-roteiro.test.mjs.
// ============================================================

import { LIMITE_SIMPLES, SUBLIMITE, ROTULO_REGIME, TIPOS } from './comparativo-motor.js';
import { DO_SISTEMA } from './comparativo-dados.js';

const num = (v, def = 0) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct0 = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
const pct = (v, d = 1) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloComp = c => c ? MES_CURTO[Number(String(c).slice(5, 7)) - 1] + '/' + String(c).slice(2, 4) : '';
const maiuscula = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// o nome de cada campo no roteiro
const NOMES = {
  aliqCreditoIcms: 'o crédito de ICMS das compras', pctComprasSimples: 'as compras de fornecedor do Simples',
  rat: 'o RAT', fap: 'o FAP', terceiros: 'terceiros (sistema S)', crescimentoReceita: 'o crescimento da receita',
  outrasDespesas: 'as outras despesas', difalSimples: 'o ICMS pago fora do DAS',
  aliqIcms: 'o ICMS das vendas', redIcms: 'a redução da base do ICMS no regime geral', redIcmsSimples: 'a redução do ICMS no DAS',
  aliqIss: 'o ISS'
};
const nomeDoCampo = c => NOMES[c] || NOMES[String(c).split('.').pop()] || c;

// ---------- o crescimento que o sistema mediu ----------
// os 3 últimos meses da série contra os 3 primeiros (de até 12): quanto a receita andou no período
export function crescimentoMedido(serie) {
  const s = (serie || []).filter(m => m && num(m.total) > 0).slice(-12);
  if (s.length < 9) return null;
  const a = s.slice(0, 3), b = s.slice(-3);
  const ini = a.reduce((t, m) => t + num(m.total), 0), fim = b.reduce((t, m) => t + num(m.total), 0);
  return ini > 0 ? { pct: (fim / ini - 1) * 100, ini: [a[0].competencia, a[2].competencia], fim: [b[0].competencia, b[2].competencia] } : null;
}

// ---------- o roteiro ----------
// entrada e origens: as da tela · comparacao: comparar() (null se a conta não roda) · testes: testarPremissas()
// situacao: situacaoDoGrupo() (o ano-calendário pelos números do sistema) · serie: a receita datada da empresa
// Volta { passos, provisorio, decidem, proximo, doSistema }. Cada passo: { id, titulo, texto, estado ('falta' | 'conferir'
// | 'feito'), peso ('decide' | 'importa' | 'detalhe'), curto (o nome na frase do resultado), campo (pra onde ir), irRotulo,
// conferir (os campos que o "está certo" marca), conferirRotulo }.
export function roteiroDoEstudo({ entrada = {}, origens = {}, comparacao = null, testes = [], situacao = null, serie = null } = {}) {
  const e = entrada || {}, o = origens || {};
  const fonte = k => (o[k] && o[k].fonte) || 'padrao';
  const padrao = k => fonte(k) === 'padrao';
  const conferido = k => fonte(k) === 'confirmado';
  const ats = (e.atividades || []).filter(a => a && TIPOS[a.tipo]);
  const receita = ats.reduce((t, a) => t + num(a.receita), 0);
  const c = comparacao;
  const d = c && c.decisao;
  const rDec = c && d ? c.anos.find(r => r.ano === d.ano) : null;
  const passos = [];
  const add = p => passos.push({ estado: 'conferir', peso: 'importa', campo: null, conferir: null, ...p });

  // 1. a receita: sem ela não há conta
  const recPadrao = ats.length === 0 || receita <= 0 || ats.some((a, i) => padrao('atividades.' + i + '.receita') && !(num(a.receita) > 0));
  if (recPadrao) {
    add({ id: 'receita', titulo: 'A receita dos 12 meses', curto: 'a receita', texto: 'Sem ela não há conta. Digite ou solte o faturamento do Domínio na caixa dos relatórios.', estado: 'falta', peso: 'decide', campo: 'atividades.0.receita', irRotulo: 'Digitar a receita' });
  }

  // 2. pode ficar no Simples? — o grupo (sócios em comum) e o limite da própria empresa
  const grupo = (e.grupo || []).filter(g => g && num(g.receita) > 0);
  const soma12 = receita + grupo.reduce((t, g) => t + num(g.receita), 0);
  const fora = c ? c.anos.filter(r => r.simples && r.simples.disponivel === false) : [];
  if (receita > 0 && (grupo.length || soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE || fora.length)) {
    const partes = [];
    if (grupo.length) partes.push('Os sócios também têm ' + grupo.map(g => g.nome).join(' e ') + '. O limite de R$ 4,8 milhões vale pra soma: nos 12 meses, ' + brl(soma12) + ' (' + pct0(soma12 / LIMITE_SIMPLES * 100) + '% do limite).');
    else if (soma12 >= 0.8 * LIMITE_SIMPLES) partes.push('A receita dos 12 meses é ' + brl(receita) + ', ' + pct0(receita / LIMITE_SIMPLES * 100) + '% do limite de R$ 4,8 milhões.');
    if (situacao && situacao.meses > 0) {
      const ate = rotuloComp(situacao.ate);
      let t = 'Em ' + situacao.ano + ', até ' + ate + ', ' + (grupo.length ? 'as empresas somam ' : 'a receita é de ') + brl(situacao.acumulado) + '.';
      if (situacao.jaPassou) t += ' Passou do limite em ' + situacao.passaEm + ': a exclusão vale a partir de ' + situacao.saiEm + '.';
      else if (situacao.passaEm) t += ' No ritmo dos últimos 3 meses (' + brl(situacao.ritmo) + ' por mês), passa do limite em ' + situacao.passaEm + (grupo.length ? ' e as empresas saem' : ' e a empresa sai') + ' do Simples em ' + situacao.saiEm + '.';
      else if (situacao.restantes > 0) t += ' Faltam ' + brl(situacao.faltam) + ' pro limite, ' + brl(situacao.porMesAteOLimite) + ' por mês até dezembro; o ritmo dos últimos 3 meses é ' + brl(situacao.ritmo) + ' por mês.';
      partes.push(t);
    }
    if (receita >= 0.85 * SUBLIMITE) partes.push('Sozinha, a receita está perto do sublimite de R$ 3,6 milhões: acima dele no ano, o ICMS e o ISS saem do DAS (a conta já faz isso).');
    const juntar = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l.join('');
    if (fora.length) partes.push('Na conta, o Simples fica fora ' + juntar(fora.map(r => r.k === 0 ? 'nos 12 meses' : 'em ' + r.ano)) + ': ' + fora[0].simples.motivo);
    partes.push(situacao ? 'Confira os meses mais recentes no Domínio: eles decidem.' : 'Confira a receita das outras empresas.');
    const perto = soma12 >= 0.85 * LIMITE_SIMPLES || (situacao && situacao.passaEm) || fora.length;
    add({ id: 'limite', titulo: 'Ela pode ficar no Simples?', curto: 'o limite do Simples', texto: partes.join(' '),
      estado: conferido('grupo') ? 'feito' : 'conferir', peso: perto ? 'decide' : 'importa',
      campo: grupo.length ? 'grupo.0.receita' : 'crescimentoReceita', irRotulo: grupo.length ? 'Ver as empresas' : 'Ver a projeção',
      conferir: ['grupo'], conferirRotulo: 'Conferido' });
  }

  // 3. a folha e o pró-labore
  const semFolha = !(num(e.folha) + num(e.proLabore) > 0);
  if (receita > 0 && semFolha && !(conferido('folha') || fonte('folha') === 'digitado')) {
    add({ id: 'folha', titulo: 'A folha e o pró-labore', curto: 'a folha e o pró-labore', texto: 'Faltam. Sem eles, o INSS patronal do Presumido e do Real sai zero — cerca de 28% da folha e 20% do pró-labore — e esses regimes parecem mais baratos do que são.' +
      (ats.some(a => a.tipo === 'servico_r') ? ' No Simples, o serviço do fator r fica no Anexo V sem folha.' : '') + ' É o número que mais falta: preencha antes de conferir o resto.',
      estado: 'falta', peso: 'decide', campo: 'folha', irRotulo: 'Digitar a folha', conferir: ['folha', 'proLabore'], conferirRotulo: 'Não tem folha nem pró-labore' });
  }

  // 4. as premissas no padrão que viram o resultado (sem a folha, a virada pro Presumido ou pro Real ainda não diz muito:
  // a folha os encarece)
  const ROT = r => ROTULO_REGIME[r] || r;
  const faltaFolha = semFolha && !conferido('folha') && fonte('folha') !== 'digitado';
  (testes || []).filter(t => t.muda).forEach(t => {
    const v = t.variantes.filter(x => x.melhor !== t.melhorBase);
    const un = !t.unidade ? '' : t.unidade.startsWith('%') ? t.unidade : ' ' + t.unidade;
    const atual = pegar(e, t.campo);
    const pelaFolha = faltaFolha && v.every(x => x.melhor === 'presumido' || x.melhor === 'real');
    add({ id: 'premissa:' + t.campo, titulo: maiuscula(t.rotulo), curto: t.rotulo,
      texto: 'Está no padrão' + (atual != null ? ' (' + pct(atual, 2) + un + ')' : '') + '. Com ' + v.map(x => pct(x.valor, 2) + un + ', o mais barato passa a ser o ' + ROT(x.melhor)).join('; com ') + '.' +
        (pelaFolha ? ' Sem a folha na conta, isso ainda não diz muito: confira depois dela.' : ''),
      estado: 'conferir', peso: pelaFolha ? 'importa' : 'decide', campo: t.campo, irRotulo: 'Ir ao campo', conferir: [t.campo], conferirRotulo: 'Está certo' });
  });

  // 5. o lucro do Real: as despesas sem nota
  if (rDec && d && d.real && padrao('outrasDespesas') && !(num(e.outrasDespesas) > 0)) {
    const alvo = d.melhor === 'real' ? d.segundo : d.melhor;
    const emp = alvo && d.real.empate[alvo];
    if (emp && !emp.nunca) {
      const margem = emp.margem != null ? emp.margem * 100 : 0;
      const decide = d.melhor === 'real' || margem >= 5;
      add({ id: 'lucro', titulo: 'O lucro do Real', curto: 'o lucro do Real',
        texto: 'O Real empata com o ' + ROT(alvo) + ' com lucro de ' + brl(emp.lucro) + ' antes do IR (' + pct(margem) + '% da receita); a conta usou ' + brl(d.real.lucro) +
          (faltaFolha ? ', sem a folha e' : ',') + ' sem as despesas sem nota (aluguel de pessoa física, aplicativo de entrega, gás, manutenção, contador). ' + (decide ? 'Se o lucro de verdade ficar abaixo do empate, o Real sai mais barato.' : 'Só um lucro bem baixo faria o Real ganhar.'),
        estado: 'conferir', peso: decide ? 'decide' : 'detalhe', campo: 'outrasDespesas', irRotulo: 'Digitar as despesas', conferir: ['outrasDespesas'], conferirRotulo: 'Não tem outras despesas' });
    }
  }

  // 6. a projeção
  if (receita > 0 && padrao('crescimentoReceita')) {
    const g = crescimentoMedido(serie);
    const pertoDoLimite = soma12 >= 0.8 * LIMITE_SIMPLES || receita >= 0.85 * SUBLIMITE;
    add({ id: 'crescimento', titulo: 'O crescimento', curto: 'o crescimento',
      texto: 'Sem crescimento, 2027 e 2028 repetem os 12 meses.' + (g ? ' Pelos números do sistema, de ' + rotuloComp(g.fim[0]) + ' a ' + rotuloComp(g.fim[1]) + ' a receita veio ' + pct(Math.abs(g.pct), 0) + '% ' + (g.pct >= 0 ? 'acima' : 'abaixo') + ' da de ' + rotuloComp(g.ini[0]) + ' a ' + rotuloComp(g.ini[1]) + '.' : '') +
        (pertoDoLimite ? ' Perto do limite, o crescimento decide quando ela sai do Simples.' : ''),
      estado: 'conferir', peso: pertoDoLimite ? 'decide' : 'importa', campo: 'crescimentoReceita', irRotulo: 'Ir à projeção', conferir: ['crescimentoReceita', 'crescimentoFolha'], conferirRotulo: 'Sem crescimento está certo' });
  }

  // 7. o resto no padrão, que não vira o resultado
  const jaNoRoteiro = new Set(passos.flatMap(p => p.conferir || []));
  const resto = [];
  const ver = k => { if (padrao(k) && !jaNoRoteiro.has(k) && !resto.includes(k)) resto.push(k); };
  ats.forEach((a, i) => {
    const t = TIPOS[a.tipo];
    if (!(num(a.receita) > 0)) return;
    if ((a.tributo || t.tributo) === 'icms') { ver('atividades.' + i + '.aliqIcms'); if (num(a.redIcms) > 0) ver('atividades.' + i + '.redIcms'); if (num(a.redIcmsSimples) > 0) ver('atividades.' + i + '.redIcmsSimples'); }
    else ver('atividades.' + i + '.aliqIss');
  });
  if (num(e.compras) > 0) { if (ats.some(a => (a.tributo || TIPOS[a.tipo].tributo) === 'icms')) ver('aliqCreditoIcms'); ver('pctComprasSimples'); }
  if (!semFolha) { ver('rat'); ver('terceiros'); }
  if (resto.length) {
    add({ id: 'resto', titulo: 'Conferir quando der', curto: 'os padrões', texto: 'Estão no padrão e não viram o resultado: ' + resto.map(nomeDoCampo).join(', ') + '.',
      estado: 'conferir', peso: 'detalhe', campo: resto[0], irRotulo: 'Ir ao primeiro', conferir: resto, conferirRotulo: 'Estão certos' });
  }

  // a ordem: o que falta e o que decide primeiro; a ordem acima desempata
  const PESO = { decide: 0, importa: 1, detalhe: 2 }, ESTADO = { falta: 0, conferir: 0, feito: 1 };
  const ordem = passos.map((p, i) => ({ p, i })).sort((a, b) => (ESTADO[a.p.estado] - ESTADO[b.p.estado]) || (PESO[a.p.peso] - PESO[b.p.peso]) || (a.i - b.i)).map(x => x.p);
  const pendentes = ordem.filter(p => p.estado !== 'feito');
  const decidem = pendentes.filter(p => p.peso === 'decide');
  // o que veio do sistema (o verde da tela)
  const doSistema = [];
  const marca = (k, nome) => { if (DO_SISTEMA.includes(fonte(k)) && !doSistema.includes(nome)) doSistema.push(nome); };
  ats.forEach((a, i) => { marca('atividades.' + i + '.receita', 'a receita'); marca('atividades.' + i + '.pctST', 'o ST'); marca('atividades.' + i + '.pctMonofasico', 'o monofásico'); marca('atividades.' + i + '.redIcmsSimples', 'a redução do ICMS no DAS'); });
  marca('compras', 'as compras'); marca('despesasCredito', 'as despesas com crédito'); marca('folha', 'a folha'); marca('proLabore', 'o pró-labore'); marca('mix', 'as alíquotas da Reforma');
  (e.grupo || []).forEach((g, i) => marca('grupo.' + i + '.receita', 'a receita de ' + g.nome));
  return { passos: ordem, provisorio: decidem.length > 0, decidem: decidem.length, pendentes: pendentes.length, proximo: pendentes[0] || null, doSistema };
}

const pegar = (o, caminho) => String(caminho).split('.').reduce((x, k) => x == null ? x : x[k], o);
