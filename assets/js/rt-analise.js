// ============================================================
// MACEDO & REIS — Reforma Tributária · gerador da análise técnica
// Monta o documento de apoio à decisão que vai à reunião com o
// cliente: de onde veio cada número, o que está medido, o que é
// presunção, o que faria a recomendação mudar.
//
// Módulo ES puro (devolve string HTML) — sem DOM, testável.
//
// VOCABULÁRIO — não misturar as duas coisas:
//   "por dentro"  = IBS/CBS recolhidos DENTRO do DAS
//   "por fora"    = IBS/CBS apurados pelo regime regular, fora do DAS
// Nos dois casos a empresa CONTINUA no Simples Nacional. Só muda o
// caminho do IBS/CBS; IRPJ, CSLL, CPP e o que restar de ICMS/ISS
// seguem no DAS. Nada aqui é sobre trocar de regime tributário.
// ============================================================

import { RT_PRAZO, janelaAberta as janelaAbertaEm } from './rt-prazos.js';
import { formatDocumento } from './utils.js';

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct1 = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// nunca arredondar cobertura/alíquota para cima a ponto de virar outra afirmação
const fmtData = v => v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—';
const pct2 = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); } catch (e) { return iso; } };
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtCnpj = d => d ? formatDocumento(d) : '—';   // CNPJ numérico ou alfanumérico (IN RFB 2.229/2024)

// Notas fiscais no padrão do IBS/CBS: para o optante do Simples, obrigatórias a partir de 01/01/2027, por dentro ou por
// fora (Ato Conjunto RFB/CGIBS nº 4/2026, art. 1º, § 1º) — "manter" não dispensa a adequação do emissor
const NOTA_DFE = ' Em qualquer caso, a partir de 01/01/2027 as notas fiscais passam a sair no novo padrão, com IBS e CBS (Ato Conjunto RFB/CGIBS nº 4/2026).';

const SELO = { alta: 's-forte', media: 's-media', baixa: 's-fraca' };
const selo = (nivel, texto) => '<span class="selo ' + SELO[nivel] + '">' + esc(texto || nivel) + '</span>';

// ---------- gráfico do repasse: onde o resultado vira ----------
function graficoRepasse(pontos, viraEm) {
  const larg = 800, zero = 100;
  const max = Math.max(...pontos.map(p => Math.abs(p.liquido))) || 1;
  const h = v => Math.abs(v) / max * 62;
  const passo = (larg - 120) / pontos.length;
  const barras = pontos.map((p, i) => {
    const x = 90 + i * passo, bw = Math.min(80, passo * 0.6);
    const ganha = p.liquido > 0, altura = h(p.liquido);
    return '<rect x="' + x.toFixed(0) + '" y="' + (ganha ? zero - altura : zero).toFixed(1) + '" width="' + bw.toFixed(0) + '" height="' + altura.toFixed(1) + '" fill="' + (ganha ? '#6FA987' : '#C97B7B') + '"/>'
      + '<text x="' + (x + bw / 2).toFixed(0) + '" y="' + (ganha ? zero - altura - 6 : zero + altura + 14).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="' + (ganha ? '#2E6B47' : '#8A3A3A') + '">'
      + (ganha ? '+' : '−') + Math.round(Math.abs(p.liquido) / 1000) + 'k</text>'
      + '<text x="' + (x + bw / 2).toFixed(0) + '" y="192" text-anchor="middle" font-size="10.5" fill="#4A525E">' + p.repasse + '%</text>';
  }).join('');
  const xVira = viraEm != null && viraEm >= 0 && viraEm <= 100 ? 90 + (viraEm / 100) * (larg - 120) : null;
  // barras: até 62px acima ou abaixo do zero (y=100); rótulo da barra negativa chega a y≈176, o eixo fica em 192
  return '<svg viewBox="0 0 ' + larg + ' 212" role="img" aria-label="Resultado no semestre conforme o percentual da CBS repassado ao cliente">'
    + '<line x1="60" y1="' + zero + '" x2="' + (larg - 20) + '" y2="' + zero + '" stroke="#8A93A6"/>'
    + '<text x="54" y="' + (zero + 4) + '" text-anchor="end" font-size="10" fill="#66707E">0</text>'
    + barras
    + (xVira != null ? '<line x1="' + xVira.toFixed(0) + '" y1="20" x2="' + xVira.toFixed(0) + '" y2="180" stroke="#D69A3C" stroke-dasharray="4 3"/>'
        + '<text x="' + (xVira + 6).toFixed(0) + '" y="28" font-size="10.5" fill="#8A5A18" font-weight="600">vira em ' + Math.round(viraEm) + '%</text>' : '')
    + '<text x="60" y="207" font-size="10" fill="#8A93A6">quanto da CBS é cobrada por fora do preço atual</text>'
    + '</svg>';
}

// ---------- caixa mensal pago ao fisco nos dois caminhos ----------
// Usa CAIXA (não o custo econômico): assim os blocos somam exatamente o total
// mostrado ao lado. A diferença entre os dois é a mesma dos dois critérios.
function graficoCaixa(m, dentroMes, foraMes) {
  const larg = 800, x0 = 150, larguraMax = larg - x0 - 130;
  const teto = Math.max(dentroMes, foraMes) || 1;
  const w = v => v / teto * larguraMax;
  const barra = (y, rotulo, segs, total, destaque) =>
    '<text x="' + (x0 - 12) + '" y="' + (y + 21) + '" text-anchor="end" font-size="11.5" fill="#4A525E" font-weight="600">' + rotulo + '</text>'
    + segs.reduce((acc, sg) => {
        const x = x0 + w(acc.off), largura = w(sg.valor);
        acc.html += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + largura.toFixed(1) + '" height="30" fill="' + sg.cor + '"/>'
          + (largura > 58 ? '<text x="' + (x + largura / 2).toFixed(1) + '" y="' + (y + 20) + '" text-anchor="middle" font-size="10.5" fill="#fff" font-weight="600">' + brl0(sg.valor) + '</text>' : '');
        acc.off += sg.valor; return acc;
      }, { html: '', off: 0 }).html
    + '<text x="' + (x0 + w(total) + 10).toFixed(1) + '" y="' + (y + 20) + '" font-size="12" fill="' + (destaque ? '#8A3A3A' : '#2E6B47') + '" font-weight="700">' + brl0(total) + '</text>';
  return '<svg viewBox="0 0 ' + larg + ' 130" role="img" aria-label="Composição do custo tributário mensal nos dois caminhos">'
    + barra(14, 'Por dentro', [{ valor: dentroMes, cor: '#5B82A6' }], dentroMes, false)
    + barra(62, 'Por fora', [{ valor: m.dasSobra, cor: '#5B82A6' }, { valor: Math.max(0, foraMes - m.dasSobra), cor: '#C97B7B' }], foraMes, true)
    + '<g font-size="10" fill="#4A525E">'
    + '<rect x="' + x0 + '" y="106" width="11" height="11" fill="#5B82A6"/><text x="' + (x0 + 17) + '" y="115">DAS do Simples</text>'
    + '<rect x="' + (x0 + 150) + '" y="106" width="11" height="11" fill="#C97B7B"/><text x="' + (x0 + 167) + '" y="115">IBS/CBS a recolher, já descontado o crédito das entradas</text>'
    + '<text x="' + x0 + '" y="128" font-size="10" fill="#8A93A6">caixa pago ao fisco por mês</text>'
    + '</g></svg>';
}

// ============================================================
// gerarAnalise(dados) → HTML completo do documento
// dados: { cliente, caso, sim, entrada, dominio, xml, logoUrl, hoje }
// ============================================================
export function gerarAnalise(d, opts = {}) {
  const versaoCliente = opts.versao === 'cliente';
  const { cliente, caso, sim, entrada: e, dominio, xml } = d;
  const hoje = d.hoje || new Date().toLocaleDateString('pt-BR');
  const s = sim.semestre, m = sim.mes;
  const receita = e.receita;
  const optar = sim.veredito ? sim.veredito.tipo === 'OPTE' : s.custoFora < s.custoDentro;
  const empate = !!(sim.veredito && sim.veredito.empate) && s.diferenca < 0;

  // --- repasse: a CBS cobrada por fora do preço sai do bolso do cliente (que credita) ---
  const pontos = [0, 25, 50, 75, 100].map(r => ({ repasse: r, liquido: -(s.custoFora - m.debitoFora * (r / 100) * 6 - s.custoDentro) }));
  const viraEm = m.debitoFora > 0 ? (s.diferenca / 6) / m.debitoFora * 100 : null;

  const partes = [];
  const P = h => partes.push(h);

  // ---------- capa ----------
  P('<header class="cab"><img src="' + d.logoUrl + '" alt="Macedo &amp; Reis"><div class="esc"><strong>Macedo &amp; Reis Contabilidade</strong><span>CRC/RS 006418/O</span><span>Três Coroas – RS</span></div></header><hr class="reg">');
  P('<h1>IBS/CBS em 2027: por dentro ou por fora do DAS</h1>');
  P('<p class="sub">' + (versaoCliente ? 'Análise de apoio à decisão' : 'Análise técnica de apoio à decisão') + ' — <b>' + esc(cliente.nome_principal) + '</b> · CNPJ ' + fmtCnpj(cliente.documento)
    + (cliente.cidade ? ' · ' + esc(cliente.cidade) : '') + (caso.cnae_base ? ' · CNAE ' + esc(caso.cnae_base) : '')
    + ' · ' + hoje + '</p>');
  {
    const sb = d.sobre || {};
    const ano = x => x ? String(x).slice(0, 4) : null;
    const partes2 = [];
    const caixa = t => t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b(ltda|me|epp|sa)\b/g, m => m.toUpperCase()) : t;
    const ativ = sb.ramo ? caixa(String(sb.ramo).replace(/\.$/, '')) : (d.perfil ? d.perfil.rotulo : null);
    if (sb.fantasia) sb.fantasia = caixa(sb.fantasia).replace(/(^|\s)\S/g, m => m.toUpperCase());
    if (ativ) partes2.push(ativ.charAt(0).toUpperCase() + ativ.slice(1) + (sb.cidade ? ', em ' + sb.cidade + (sb.uf ? '/' + sb.uf : '') : ''));
    else if (sb.cidade) partes2.push('Empresa de ' + sb.cidade + (sb.uf ? '/' + sb.uf : ''));
    if (ano(sb.abertura)) partes2.push('aberta em ' + ano(sb.abertura));
    if (ano(sb.clienteDesde)) partes2.push('cliente do escritório desde ' + ano(sb.clienteDesde));
    // (27/09/2026) linha de apresentação removida a pedido do Samuel — o relatório vai direto à decisão
  }

  // "hoje" no fuso de quem gera (Brasília): toISOString() é UTC e, depois das 21h, já devolvia o dia seguinte —
  // em 30/09/2026, último dia da opção, a análise dizia que a janela tinha fechado (achado do Claude Code em 30/09)
  const agora = new Date();
  const hojeISO = d.hojeISO || agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
  // prazos em assets/js/rt-prazos.js (Res. CGSN 194/2026 levou a opção a 30/10 e o cancelamento a 03/11–20/12)
  const janelaAberta = janelaAbertaEm(hojeISO);
  if (!versaoCliente) P('<div class="dados"><b>Prazo:</b> ' + (janelaAberta
      ? 'a opção deve ser formalizada até <b>' + RT_PRAZO.opcao + '</b> e pode ser <b>cancelada ' + RT_PRAZO.cancelamento + '</b>, sem produzir efeito — o cancelamento é irretratável (' + RT_PRAZO.norma + '). Quem não opta até ' + RT_PRAZO.opcaoDM + ' só tem nova janela em <b>' + RT_PRAZO.proxima + '</b>, com efeito a partir de <b>' + RT_PRAZO.proximaEfeito + '</b>.'
      : 'a janela da opção com efeito em janeiro/2027 fechou em ' + RT_PRAZO.opcao + ' (quem optou pode cancelar ' + RT_PRAZO.cancelamento + '). A próxima é em <b>' + RT_PRAZO.proxima + '</b>, com efeito a partir de <b>' + RT_PRAZO.proximaEfeito + '</b> (' + RT_PRAZO.norma + ') — esta análise serve de base para ela.')
    + (dominio || xml ? '<br><b>Base desta análise:</b> ' + [
        dominio && dominio.faturamento ? 'relatório de faturamento ' + dominio.periodoRotulo : null,
        dominio && dominio.pgdas ? 'apuração do Simples (PGDAS ' + esc(dominio.pgdas.competencia) + ')' : null,
        dominio && dominio.entradas ? 'acompanhamento de entradas' : null,
        xml && xml.nNotas ? xml.nNotas + ' notas fiscais eletrônicas (emitidas e recebidas) de ' + esc(xml.periodoRotulo || '') : null
      ].filter(Boolean).join(', ') + '.' : '') + '</div>');

  // ---------- EM RESUMO (27/09/2026): a decisão em linguagem simples, antes de qualquer tabela ----------
  {
    const dif = Math.abs(s.diferenca), pctRec = dif / ((d.entrada && d.entrada.receita || 0) * 6) * 100;
    const foraMaisBarato = s.diferenca < 0;
    const alertasVis = (d.alertas || []).filter(a => !(versaoCliente && a.interno));
    const internos = (d.alertas || []).filter(a => a.interno);
    const aConf = alertasVis.length > 0 && !empate;
    if (versaoCliente && internos.length) partes.unshift('<div class="so-escritorio"><b>Antes de mandar pro cliente</b> (esta faixa não sai na impressão): ' + internos.map(a => esc(a.texto.replace(/<[^>]+>/g, ''))).join(' · ') + '</div>');
    const dec = (d.recomendacao && d.recomendacao.decisao) || (optar ? 'optar' : 'manter');
    const decisao = { manter: 'Manter como está', optar: 'Recolher o IBS/CBS por fora do DAS', optar_marco: 'Recolher o IBS/CBS por fora do DAS a partir de julho/2027',
      formalizar: 'Registrar a opção até ' + RT_PRAZO.opcaoDM + ' — e decidir até ' + RT_PRAZO.cancelaAteDM, manter_reavaliar: 'Manter por ora — e reavaliar em março/2027' }[dec] || 'Manter como está';
    const selo = aConf ? 'TENDÊNCIA — A CONFIRMAR' : empate ? 'RECOMENDAÇÃO · EMPATE TÉCNICO' : 'RECOMENDAÇÃO';
    const oQue = dec === 'formalizar'
      ? 'Registrar a opção não muda nada ainda: ' + RT_PRAZO.cancelamento + ' dá pra cancelar sem efeito nenhum. Serve pra não perder a chance enquanto você vê com os seus principais clientes se faz sentido.'
      : dec === 'optar' || dec === 'optar_marco'
      ? 'A empresa continua no Simples, mas passa a pagar o IBS e a CBS numa apuração separada, descontando o que pagou nas compras.'
      : 'A empresa continua pagando tudo numa guia só, o DAS do Simples, como hoje.';
    let porque;
    if (empate) porque = 'Os dois caminhos custam praticamente o mesmo: a diferença é de ' + brl0(dif) + ' no semestre (' + pct2(pctRec) + '% do faturamento). Quando dá empate, mudar só traz trabalho e risco.';
    else if (optar) porque = 'Pagar por fora sai ' + brl0(dif) + ' mais barato no primeiro semestre de 2027 (' + pct2(pctRec) + '% do faturamento)' + (d.consumidor ? ', porque a empresa desconta o imposto das compras e paga só sobre a margem.' : ', e os clientes empresa passam a aproveitar ' + brl0(s.aproveitadoFora) + ' de crédito do imposto.');
    else {
      const ganhoCli = s.aproveitadoFora - s.aproveitadoDentro;
      porque = 'Continuar no DAS sai ' + brl0(dif) + ' mais barato no primeiro semestre de 2027 (' + pct2(pctRec) + '% do faturamento).'
        + (d.consumidor ? ' A maioria das vendas é para pessoa física, que não aproveita o imposto destacado — então não há ganho para o cliente.'
          : ganhoCli > dif ? ' Mas os seus clientes empresa aproveitariam ' + brl0(ganhoCli) + ' a mais de crédito se você recolhesse por fora — mais do que o seu custo a mais' + (d.sobre && d.sobre.clientes ? '' : ' (contando todos os clientes empresa; os do Simples não aproveitam, então o ganho real deles é menor)') + '. Só vale a pena se eles pagarem parte desse imposto no preço — ' + (janelaAberta ? 'e há tempo pra ver isso: registrando a opção até ' + RT_PRAZO.opcaoDM + ', dá pra cancelar ' + RT_PRAZO.cancelamento + ' sem efeito nenhum se não fizer sentido.' : 'há tempo até a janela de março/2027 pra ver isso com eles.')
          : ' O crédito a mais que os clientes empresa aproveitariam (' + brl0(Math.max(0, ganhoCli)) + ') não cobre esse custo.');
    }
    const maxV = Math.max(s.custoDentro, s.custoFora) || 1;
    const barra = (rot, v, win) => '<div class="rs-b"><span class="rs-bl">' + rot + '</span><span class="rs-bt"><span class="rs-bf' + (win ? ' win' : '') + '" style="width:' + (v / maxV * 100).toFixed(1) + '%"></span></span><b>' + brl0(v) + '</b></div>';
    P('<div class="resumo' + (aConf ? ' conf' : '') + '"><div class="rs-selo">' + selo + '</div>'
      + '<div class="rs-dec">' + decisao + '</div>'
      + '<p class="rs-oq">' + oQue + '</p>'
      + '<div class="rs-barras"><div class="rs-cap">Custo com impostos no 1º semestre de 2027</div>'
      + (dec === 'formalizar' || dec === 'manter_reavaliar'
          ? barra('Por dentro do DAS', s.custoDentro, false) + barra('Por fora do DAS', s.custoFora, false) + '<div class="rs-cap" style="margin-top:4px;text-transform:none;letter-spacing:0">Com o preço de hoje, por dentro sai mais barato; por fora só compensa com parte do imposto no preço.</div></div>'
          : barra('Por dentro do DAS' + (optar ? '' : ' ✓'), s.custoDentro, !optar) + barra('Por fora do DAS' + (optar ? ' ✓' : ''), s.custoFora, optar) + '<div class="rs-cap" style="margin-top:4px;text-transform:none;letter-spacing:0">✓ recomendado' + (empate ? ' — a diferença está dentro da margem de incerteza' : '') + '</div></div>')
      + '<p><b>Por quê:</b> ' + porque + '</p>'
      + (alertasVis.length ? '<p style="margin-bottom:4px"><b>' + (aConf ? 'Antes de decidir, precisamos confirmar:' : 'Pontos de atenção:') + '</b></p><ul class="rs-al">' + alertasVis.map(a => '<li>' + a.texto + '</li>').join('') + '</ul>' : '')
      + (d.observacoes && d.observacoes.length ? '<p style="margin-bottom:4px"><b>Para um cálculo mais preciso:</b></p><ul class="rs-al">' + d.observacoes.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '')
      + ({ optar: '<p class="rs-pz">Próximo passo: formalizar a opção até <b>' + RT_PRAZO.opcao + '</b>. Dá pra cancelar <b>' + RT_PRAZO.cancelamento + '</b> sem efeito.</p>',
           formalizar: '<p class="rs-pz">Próximo passo: registrar a opção até <b>' + RT_PRAZO.opcao + '</b>; decidir até <b>' + RT_PRAZO.cancelaAte + '</b> (cancelar ' + RT_PRAZO.cancelamento + ', se não fizer sentido).</p>',
           optar_marco: '<p class="rs-pz">Próximo passo: formalizar a opção na janela de <b>março/2027</b>; vale a partir de julho/2027.</p>',
           manter_reavaliar: '<p class="rs-pz">Próximo passo: nenhum quanto à opção. Reavaliar antes da janela de <b>março/2027</b>.' + NOTA_DFE + '</p>' }[dec]
         || '<p class="rs-pz">Mantendo, não é preciso fazer nada quanto à opção. Se o quadro mudar, há nova janela em março/2027.' + NOTA_DFE + '</p>')
      + '</div>');
  }

  if (versaoCliente) {
    const base = dominio || xml ? [
        dominio && dominio.faturamento ? 'faturamento ' + dominio.periodoRotulo : null,
        dominio && dominio.pgdas ? 'PGDAS ' + esc(dominio.pgdas.competencia) : null,
        dominio && dominio.entradas ? 'entradas' : null,
        xml && xml.nNotas ? xml.nNotas + ' notas fiscais' : null
      ].filter(Boolean).join(', ') : null;
    P('<p class="numlinha"><b>Faturamento médio:</b> ' + brl0(receita) + '/mês'
      + (!d.consumidor ? ' · <b>Crédito que seus clientes empresa aproveitariam no semestre:</b> ' + brl0(s.aproveitadoDentro) + ' mantendo, ' + brl0(s.aproveitadoFora) + ' por fora' : '') + '</p>');
    if (d.perguntas && d.perguntas.length) P('<h2>Para conversarmos</h2><ol class="perg">' + d.perguntas.slice(0, 3).map(q => '<li>' + q + '</li>').join('') + '</ol>');
    P('<div class="rodape">Elaborado em ' + hoje + ' pela Macedo &amp; Reis Contabilidade' + (base ? ', com ' + base : '') + ' e as alíquotas de referência de 2027 (CBS pendente de resolução do Senado). A empresa continua no Simples em qualquer caso; a escolha é só a forma de recolher IBS e CBS. Valores estimados; a decisão é do contribuinte. A análise técnica completa fica à disposição no escritório. Base legal: LC 214/2025 · LC 123/2006 · Resoluções CGSN 186/2026 e 194/2026.</div>');
    return montarHtml();
  }

  // ---------- 1. retrato ----------
  P('<h2>1. O que a empresa é, pelos números</h2>');
  {
    const sb = d.sobre || {};
    const linhas = [];
    if (sb.ramo || sb.segmento) linhas.push(['Ramo (carteira)', esc([sb.segmento, sb.ramo].filter(Boolean).join(' — ')), 'cadastro do escritório']);
    if (sb.cnaesSecundarios) linhas.push(['Atividades secundárias', esc(String(sb.cnaesSecundarios).slice(0, 220)), 'cadastro (CNPJ)']);
    if (sb.fornecedores) linhas.push(['Fornecedores do Simples/MEI', pct1(sb.fornecedores.simplesPct) + '% das compras consultadas' + (sb.fornecedores.maiores && sb.fornecedores.maiores.length ? ' — maiores: ' + sb.fornecedores.maiores.slice(0, 3).map(f => esc(f.nome)).join(', ') : ''), 'Receita Federal (CNPJs das entradas)']);
    if (sb.clientes) linhas.push(['Clientes empresa do regime regular', pct1(sb.clientes.regularPct) + '% das vendas a empresas — os do Simples não aproveitam o crédito', 'Receita Federal (CNPJs das saídas)']);
    if (linhas.length) P('<table><thead><tr><th>Sobre o cliente</th><th>O que sabemos</th><th>Fonte</th></tr></thead><tbody>' + linhas.map(l => '<tr><td>' + l[0] + '</td><td>' + l[1] + '</td><td>' + l[2] + '</td></tr>').join('') + '</tbody></table>');
    if (sb.reunioes && sb.reunioes.length) {
      P('<p class="fonte" style="margin-top:6px">Reuniões registradas com o cliente (uso interno):</p><ul class="fonte" style="font-style:normal">' + sb.reunioes.map(r => {
        const disc = (r.reuniao_pautas || []).filter(p => p.discussao).map(p => p.titulo + ': ' + String(p.discussao).replace(/<[^>]+>/g, ' ').slice(0, 160)).slice(0, 2);
        return '<li><b>' + fmtData(r.data_reuniao) + '</b> — ' + esc(r.titulo || 'reunião') + (disc.length ? ' · ' + esc(disc.join(' · ')) : (r.observacoes ? ' · ' + esc(String(r.observacoes).slice(0, 160)) : '')) + '</li>';
      }).join('') + '</ul>');
    }
  }
  const pctServ = dominio && dominio.faturamento ? dominio.faturamento.servicos / dominio.faturamento.total * 100 : null;
  if (pctServ != null && pctServ >= 60) {
    P('<p>A empresa fatura <b>' + pct1(pctServ) + '% em serviço</b> e ' + pct1(100 - pctServ) + '% em mercadoria. O custo de uma prestadora de serviço é mão de obra, e <b>folha de pagamento não gera crédito de IBS/CBS</b> — é isso que define toda a conta adiante.</p>');
  }
  P('<table><thead><tr><th>Indicador</th><th class="num">Valor</th><th>Fonte</th></tr></thead><tbody>'
    + (dominio && dominio.faturamento ? '<tr><td>Faturamento ' + dominio.periodoRotulo + '</td><td class="num">' + brl(dominio.faturamento.total) + '</td><td>' + esc(dominio.fonteFaturamento || 'Relatório de faturamento (Domínio)') + '</td></tr>'
      + '<tr><td>— serviços</td><td class="num">' + brl(dominio.faturamento.servicos) + ' · ' + pct1(pctServ) + '%</td><td>idem</td></tr>'
      + '<tr><td>— ' + (d.perfil && d.perfil.tipo === 'transporte' ? 'fretes (CT-e)' : d.perfil && !d.perfil.vendeMercadoria && d.perfil.tipo !== 'servico' ? esc(d.perfil.rotulo) : 'mercadorias') + '</td><td class="num">' + brl(dominio.faturamento.saidas) + ' · ' + pct1(100 - pctServ) + '%</td><td>idem</td></tr>' : '')
      + (d.perfil ? '<tr><td>Atividade</td><td class="num">' + esc(d.perfil.rotulo) + '</td><td>' + esc(d.perfil.fonte || '') + '</td></tr>' : '')
    + '<tr><td>Receita mensal usada na simulação</td><td class="num">' + brl(receita) + '</td><td>' + esc(d.origemReceita || 'informado na ficha') + '</td></tr>'
    + '<tr><td>RBT12</td><td class="num">' + brl(e.rbt12) + '</td><td>' + (dominio && dominio.pgdas ? 'PGDAS ' + esc(dominio.pgdas.competencia) : 'ficha') + '</td></tr>'
    + '<tr><td>' + (sim.fatores && sim.fatores.aliqFonte === 'informada' ? 'Alíquota efetiva real (DAS ÷ receita, todos os anexos) · Anexo predominante' : 'Anexo predominante e sua alíquota efetiva pela tabela') + '</td><td class="num">' + pct2(sim.aliqEfetiva * 100) + '% · Anexo ' + esc(e.anexo) + (sim.fatores && sim.fatores.aliqFonte === 'informada' && sim.fatores.aliqTabela != null ? ' (tabela: ' + pct2(sim.fatores.aliqTabela * 100) + '%)' : '') + '</td><td>' + (sim.fatores && sim.fatores.aliqFonte === 'informada' ? 'PGDAS' + (dominio && dominio.pgdas ? ' ' + esc(dominio.pgdas.competencia) : '') : 'LC 123, art. 18') + '</td></tr>'
    + (dominio && dominio.dasMedio ? (dominio.nPgdas > 1
        ? '<tr><td>DAS médio pago</td><td class="num">' + brl(dominio.dasMedio) + '/mês</td><td>média das ' + dominio.nPgdas + ' apurações do Simples</td></tr>'
        : '<tr><td>DAS apurado em ' + esc(String((dominio.pgdas && dominio.pgdas.competencia) || '').replace(/^(\d{4})-(\d{2})$/, '$2/$1')) + '</td><td class="num">' + brl(dominio.dasMedio) + '</td><td>PGDAS' + (dominio.pgdas && dominio.pgdas.rpa ? ' — sobre receita de ' + brl(dominio.pgdas.rpa) + ' naquele mês' : '') + '</td></tr>')
        : '<tr><td>DAS na simulação</td><td class="num">' + brl(m.dasHoje) + '/mês</td><td>calculado sobre o Anexo ' + esc(e.anexo) + '</td></tr>')
    + (xml && xml.pctPJ != null ? '<tr><td>Vendas para CNPJ</td><td class="num">' + pct1(xml.pctPJ) + '%</td><td>XML das notas emitidas</td></tr>' : '')
    + '<tr class="tot"><td>Entradas que geram crédito</td><td class="num">' + (dominio && dominio.entradas ? brl(dominio.entradas.grupos.filter(g => g.incluido).reduce((a, g) => a + g.valor, 0)) + ' no período' : brl(receita * (e.pctComprasMercadorias + e.pctComprasDespesas) / 100) + '/mês') + ' · ' + pct1(e.pctComprasMercadorias + e.pctComprasDespesas) + '% da receita</td><td>' + (dominio && dominio.entradas ? 'Acompanhamento de entradas' : 'ficha') + '</td></tr>'
    + '</tbody></table>');

  // ---------- 2. clientes ----------
  const barRestaurante = (e.mixRed40 || 0) > 0;
  const vendeAConsumidor = !!d.consumidor;
  if (xml && (vendeAConsumidor || barRestaurante)) {
    // empresa que vende a consumidor final (ou bar/restaurante): ninguém credita — a decisão é só a conta própria
    P('<h2>2. Para quem a empresa vende — e por que isso simplifica a conta</h2>');
    P('<p>Medido em <b>' + esc(xml.periodoRotulo) + '</b>' + (xml.cobertura != null ? ', período em que as notas eletrônicas cobrem <b>' + (xml.cobertura >= 99.995 ? '100%' : pct2(xml.cobertura) + '%') + '</b> do faturamento declarado' : '') + ': <b>' + pct1(100 - (xml.pctPJ || 0)) + '% das vendas vão para consumidor final</b>'
      + (xml.pctPJ >= 0.05 ? ' e ' + pct1(xml.pctPJ) + '% para CNPJ' : '') + '.</p>');
    P('<div class="cx chave"><h4>O ponto central</h4>'
      + '<p>Consumidor final não credita imposto — hoje nem em 2027. ' + (barRestaurante ? 'E para bar e restaurante a lei fecha a porta também para o cliente pessoa jurídica na parte principal: <b>o adquirente não se apropria de crédito de IBS/CBS sobre a alimentação e a bebida preparadas na casa</b>, que têm a redução de 40% (LC 214/2025, arts. 275 e 276). Só a bebida em lata ou garrafa e a alcoólica, que ficam fora desse regime e pagam a alíquota cheia, geram crédito a quem compra. ' : '')
      + 'Logo, apurar <b>por fora</b> não devolve crédito relevante a ninguém — a única coisa que a opção muda é a conta da própria empresa.</p>'
      + '<p style="margin-bottom:0">Isso tira da mesa a variável que costuma decidir esse tipo de caso (o quanto o cliente pressiona por crédito). Aqui a decisão é aritmética: o que a empresa paga por dentro contra o que pagaria por fora, e só.</p></div>');
  } else if (!xml && d.consumidor && dominio && dominio.vendas && dominio.vendas.total > 0) {
    const v = dominio.vendas;
    const pf = (v.pf || 0) + (v.consumidor || 0);
    P('<h2>2. Para quem a empresa vende — e por que isso simplifica a conta</h2>');
    P('<p>Pelo ' + esc(v.fonte || 'acompanhamento de saídas do Domínio') + ': de ' + brl(v.total) + ' vendidos, <b>' + pct1(pf / v.total * 100) + '% foram para pessoa física ou consumidor não identificado</b> e ' + pct1((v.pj || 0) / v.total * 100) + '% para ' + (v.nPJ || 0) + ' CNPJ(s).</p>');
    P('<div class="cx chave"><h4>O ponto central</h4>'
      + '<p>Pessoa física não credita imposto — nem hoje, nem em 2027. Apurar <b>por fora</b> não devolve crédito a quase ninguém: a carteira PJ aproveitaria ' + brl0(s.aproveitadoFora) + ' no semestre (contra ' + brl0(s.aproveitadoDentro) + ' por dentro).</p>'
      + '<p style="margin-bottom:0">Por isso a decisão aqui é só a conta da própria empresa: o que ela paga por dentro contra o que pagaria por fora.</p></div>');
  } else if (xml && xml.clientes && xml.clientes.length) {
    P('<h2>2. Para quem a empresa vende — e por que isso decide a conta</h2>');
    P('<p>Medido em <b>' + esc(xml.periodoRotulo) + '</b>' + (xml.cobertura != null ? ', período em que as notas eletrônicas cobrem <b>' + (xml.cobertura >= 99.995 ? '100%' : pct2(xml.cobertura) + '%') + '</b> do faturamento declarado' : '') + '. A empresa atendeu <b>' + xml.nClientes + ' grupos econômicos</b>; os dez maiores concentram <b>' + pct1(xml.top10) + '% da receita</b>'
      + (xml.top20 != null ? ' e os vinte maiores, <b>' + pct1(xml.top20) + '%</b>' : '') + '.</p>'
      + (xml.avisoCobertura ? '<p class="fonte">' + esc(xml.avisoCobertura) + '</p>' : ''));
    P('<table><thead><tr><th>Cliente</th><th>UF</th><th class="num">Faturado</th><th class="num">% da receita</th><th class="num">Acumulado</th></tr></thead><tbody>'
      + xml.clientes.slice(0, 10).map(c => '<tr><td>' + esc(c.nome) + (c.cnpjs > 1 ? ' <span class="fonte">(' + c.cnpjs + ' CNPJs)</span>' : '') + '</td><td>' + esc(c.uf || '—') + '</td><td class="num">' + brl(c.valor) + '</td><td class="num">' + pct1(c.pct) + '%</td><td class="num">' + pct1(c.acum) + '%</td></tr>').join('')
      + (xml.nClientes > 10 ? '<tr class="tot"><td colspan="2">Demais ' + (xml.nClientes - 10) + ' grupos econômicos</td><td class="num">' + brl(xml.totalVendas - xml.clientes.slice(0, 10).reduce((a, c) => a + c.valor, 0)) + '</td><td class="num">' + pct1(100 - xml.top10) + '%</td><td class="num">100%</td></tr>' : '')
      + '</tbody></table>');
    P('<p class="fonte">Fonte: XML das notas fiscais emitidas em ' + esc(xml.periodoRotulo) + ', agrupadas por raiz de CNPJ (filial não conta como cliente novo). Total de vendas identificadas: ' + brl(xml.totalVendas) + '.</p>');
    // 1,65% de PIS + 7,6% de COFINS no regime não cumulativo
    const creditoHojePct = 9.25, creditoDentroPct = m.debitoFora > 0 ? m.parcelaCbsIbs / receita * 100 : 0;
    P('<div class="cx chave"><h4>O ponto central</h4>'
      + '<p>O cliente que apura PIS/COFINS pelo <b>regime não cumulativo</b> (lucro real) credita hoje <b>' + pct2(creditoHojePct) + '%</b> (1,65% de PIS + 7,6% de COFINS) sobre o que compra desta empresa, ainda que ela seja do Simples — é o que declara o Ato Declaratório Interpretativo RFB nº 15/2007. Em 2027, se a apuração ficar <b>por dentro</b>, o crédito cai para <b>' + pct1(creditoDentroPct) + '%</b>: só a parcela de CBS embutida no DAS.</p>'
      + '<p style="margin-bottom:0">Para esses clientes é uma perda de cerca de <b>' + Math.round(creditoHojePct - creditoDentroPct) + ' pontos de crédito</b>, sem que a empresa mude nada e sem que ela ganhe nada com isso. <span class="fonte">Cliente no lucro presumido apura PIS/COFINS pelo regime cumulativo e não credita nem hoje — para ele a mudança é indiferente. Quantos clientes estão em cada situação é o levantamento nº 2 do item 10.</span></p></div>');
  }

  // ---------- 3. entradas ----------
  if (dominio && dominio.entradas && dominio.entradas.grupos) {
    const g = dominio.entradas.grupos, totalRel = g.reduce((a, x) => a + x.valor, 0);
    const fora = g.filter(x => !x.credita), dentro = g.filter(x => x.credita);
    P('<h2>3. Para onde vai o dinheiro das entradas</h2>');
    if (fora.length && fora.reduce((a, x) => a + x.valor, 0) / totalRel > 0.5) {
      P('<p>O acompanhamento de entradas soma <b>' + brl(totalRel) + '</b> em ' + g.reduce((a, x) => a + x.notas, 0) + ' lançamentos — o que, à primeira vista, sugere uma empresa com enorme volume de compras. <b>Não é o caso.</b> Separando por natureza da operação:</p>');
    } else {
      P('<p>O acompanhamento de entradas, separado por natureza da operação:</p>');
    }
    P('<table><thead><tr><th>Natureza da operação</th><th class="num">Lanç.</th><th class="num">Valor</th><th class="num">% do relatório</th><th>Gera crédito?</th></tr></thead><tbody>'
      + g.map(x => '<tr><td><b>' + esc(x.rotulo) + '</b>' + (x.detalhe ? '<br><span class="fonte">' + esc(x.detalhe) + '</span>' : '') + '</td>'
        + '<td class="num">' + x.notas + '</td><td class="num">' + brl(x.valor) + '</td><td class="num">' + pct1(x.valor / totalRel * 100) + '%</td>'
        + '<td>' + (x.grupo === 'outras' ? 'A conferir — não considerado' : x.incluido ? 'Sim' : x.credita ? 'Sim — não considerado' : 'Não — não é compra') + '</td></tr>').join('')
      + '<tr class="tot"><td colspan="2">Base creditável considerada</td><td class="num">' + brl(dentro.filter(x => x.incluido).reduce((a, x) => a + x.valor, 0)) + '</td><td class="num">' + pct1(e.pctComprasMercadorias + e.pctComprasDespesas) + '% da receita</td><td>—</td></tr>'
      + '</tbody></table>');
    const duvida = g.find(x => x.grupo === 'outras' && x.valor > 0 && !x.incluido);
    if (duvida) {
      P('<div class="cx alerta"><h4>Conferir antes de fechar</h4><p style="margin:0">Os <b>' + brl(duvida.valor) + ' em CFOP x949</b> ("outra entrada não especificada") estão <b>fora</b> do cálculo.'
        + (duvida.detalhe ? ' Os maiores — ' + esc(duvida.detalhe) + ' — têm cara de industrialização ou retorno lançado no CFOP errado, não de despesa.' : '')
        + ' Se parte deles for compra de verdade, a base creditável sobe. <b>Ação: abrir as notas e reclassificar.</b></p></div>');
    }
  }

  // ---------- 4. simulação ----------
  P('<h2>4. A simulação: os dois caminhos no primeiro semestre de 2027</h2>');
  P('<p>Alíquotas de 2027: <b>CBS ' + pct1(e.cbs) + '%</b> (a referência, ainda pendente de Resolução do Senado, menos 0,1 ponto, como manda o ADCT, art. 127, parágrafo único) e <b>IBS ' + pct1(e.ibs) + '%</b> (0,05% estadual + 0,05% municipal). Cenário: o IBS/CBS por fora é calculado sobre a receita de hoje e a empresa o <b>absorve</b>, sem repassar ao cliente — se o preço final ficar igual ao de hoje, com o imposto dentro dele, veja a seção 6.</p>');
  if ((m.das2027 || 0) - (m.dasHoje || 0) > 0.005) P('<p class="fonte">O DAS por dentro de 2027 (' + brl(m.das2027) + '/mês) é maior que o de hoje (' + brl(m.dasHoje) + '): a exclusão do PIS/COFINS monofásico acaba em 2027 e a CBS alcança essa receita (Res. CGSN 140/2018, art. 25, §6º, na redação da Res. CGSN 190/2026). A exclusão do ICMS-ST e do ISS retido continua.</p>');
  P('<div class="duas">'
    + '<div class="ret' + (optar ? '' : ' win') + '"><h4>Por dentro — IBS/CBS no DAS' + (empate ? ' · recomendado (empate técnico)' : '') + '</h4>'
      + '<div class="rw"><span>Custo tributário do semestre</span><b>' + brl(s.custoDentro) + '</b></div>'
      + '<div class="rw"><span>Caixa pago ao fisco</span><b>' + brl(s.caixaDentro) + '</b></div>'
      + '<div class="rw"><span>Crédito que o cliente leva</span><b>' + brl(s.creditoClienteDentro) + '</b></div>'
      + '<div class="rw"><span>Aproveitado pela carteira PJ</span><b>' + brl(s.aproveitadoDentro) + '</b></div></div>'
    + '<div class="ret' + (optar ? ' win' : '') + '"><h4>Por fora — regime regular</h4>'
      + '<div class="rw"><span>Custo tributário do semestre</span><b>' + brl(s.custoFora) + '</b></div>'
      + '<div class="rw"><span>Caixa pago ao fisco</span><b>' + brl(s.caixaFora) + '</b></div>'
      + '<div class="rw"><span>Crédito que o cliente leva</span><b>' + brl(s.creditoClienteFora) + '</b></div>'
      + '<div class="rw"><span>Aproveitado pela carteira PJ</span><b>' + brl(s.aproveitadoFora) + '</b></div>'
      + '<div class="rw tot"><span>Diferença (fora − dentro)</span><b>' + brl(s.diferenca) + '</b></div></div></div>');

  if (dominio && dominio.anexosOutros && dominio.dasMedio) {
    const desvio = (m.dasHoje - dominio.dasMedio) * 6;
    P('<p class="fonte">Ressalva de método: a simulação aplica o Anexo ' + esc(e.anexo) + ' a toda a receita, mas parte dela é tributada em outro anexo ('
      + esc(dominio.anexosOutros) + '). Isso ' + (desvio >= 0 ? 'superestima' : 'subestima') + ' o DAS por dentro em cerca de ' + brl0(Math.abs(desvio))
      + ' no semestre — ' + pct1(Math.abs(desvio) / Math.abs(s.diferenca) * 100) + '% da diferença apurada, sem alterar a conclusão.</p>');
  }
  P('<h3>De onde vem a diferença, mês a mês</h3>');
  P(graficoCaixa(m, s.caixaDentro / 6, s.caixaFora / 6));
  P('<table><thead><tr><th>Componente</th><th class="num">Por dentro</th><th class="num">Por fora</th></tr></thead><tbody>'
    + '<tr><td>DAS do Simples</td><td class="num">' + brl(m.das2027 != null ? m.das2027 : m.dasHoje) + '</td><td class="num">' + brl(m.dasSobra) + ' <span class="fonte">(sai a fatia de CBS)</span></td></tr>'
    + '<tr><td>IBS/CBS sobre as vendas</td><td class="num">—</td><td class="num">' + brl(m.debitoFora) + '</td></tr>'
    + '<tr><td>(−) crédito das entradas</td><td class="num">—</td><td class="num">− ' + brl(m.creditoEntradas) + '</td></tr>'
    + '<tr class="tot"><td>Custo do mês</td><td class="num">' + brl(s.custoDentro / 6) + '</td><td class="num">' + brl(s.custoFora / 6) + '</td></tr>'
    + '<tr><td colspan="3" style="border:none;padding-top:10px;"><b>Diferença: ' + brl0(Math.abs(s.diferenca) / 6) + ' por mês — ' + pct1(Math.abs(s.diferenca) / 6 / receita * 100) + '% da receita mensal.</b></td></tr>'
    + '</tbody></table>');
  const fat = sim.fatores || { mix: sim.fatorMix, compras: sim.fatorMix, comprasMedido: false };
  const aliqVendas = (e.cbs + e.ibs) * fat.mix, aliqCompras = (e.cbs + e.ibs) * fat.compras;
  const mixTxt = [];
  if ((e.mixRed40 || 0) > 0) mixTxt.push(pct1(e.mixRed40) + '% com redução de 40% (alimentação preparada por bar/restaurante, LC 214 art. 275)');
  if ((e.mixRed60 || 0) > 0) mixTxt.push(pct1(e.mixRed60) + '% com redução de 60%');
  if ((e.mixRed30 || 0) > 0) mixTxt.push(pct1(e.mixRed30) + '% com redução de 30%');
  if ((e.mixZero || 0) > 0) mixTxt.push(pct1(e.mixZero) + '% em alíquota zero');
  if (empate) {
    P('<div class="cx chave"><h4>Empate técnico</h4><p style="margin:0">Por fora a conta sai <b>' + brl0(Math.abs(s.diferenca)) + ' menor no semestre — ' + pct2(Math.abs(s.diferenca) / (receita * 6) * 100) + '% da receita</b>, abaixo do limiar de ' + brl0(sim.veredito.limiarEmpate) + ' que o escritório adota pra recomendar a mudança. '
      + 'A vantagem vem de a empresa creditar IBS/CBS sobre entradas que somam ' + pct1(e.pctComprasMercadorias + (e.pctComprasDespesas || 0)) + '% da receita, pagando só sobre a margem — e supõe crédito cheio em <b>todas</b> essas entradas. Se parte delas vier de fornecedor do Simples ou tiver o crédito glosado, a diferença some. Com essa margem, não vale trocar a apuração.</p></div>');
  } else if (!optar) {
    P('<p>O motivo é aritmético: <b>por fora a empresa debita ' + pct1(aliqVendas) + '% sobre o que fatura' + (mixTxt.length ? ' (' + pct1(e.cbs + e.ibs) + '% de referência, com ' + mixTxt.join(', ') + ')' : '') + ' e credita ' + (fat.compras < 0.5 ? 'pouco' : 'menos') + ' na entrada</b>: compra ' + pct1(e.pctComprasMercadorias + e.pctComprasDespesas) + '% do que fatura'
      + (fat.comprasMedido ? ', e só ' + pct1(fat.compras * 100) + '% dessas compras carregam IBS/CBS pra creditar — o resto é cesta básica, alíquota zero (medido pelo NCM das notas de entrada)' : '') + '. O regime regular favorece quem compra muito e compra tributado.</p>');
  } else if (mixTxt.length || fat.comprasMedido) {
    P('<p class="fonte">Por fora: ' + pct1(aliqVendas) + '% sobre as vendas (' + pct1(e.cbs + e.ibs) + '% de referência' + (mixTxt.length ? ', com ' + mixTxt.join(', ') : '') + ')' + (fat.comprasMedido ? '; crédito sobre ' + pct1(fat.compras * 100) + '% das compras de mercadorias, pelo NCM das entradas' : '') + '.</p>');
  }

  // ---------- 5. repasse ----------
  if (d.consumidor) {
    P('<h2>5. Repasse ao consumidor não muda a conta</h2>');
    P('<p>Numa empresa que vende a outras empresas, a variável decisiva é o repasse: o cliente credita a CBS destacada e fica neutro. Aqui não há isso. O consumidor não credita nada, então destacar CBS na nota é <b>reajuste de preço puro</b> — e o mesmo reajuste pode ser feito com a apuração por dentro, sem mudar de regime. Não existe percentual de repasse que inverta a conclusão.</p>');
  } else {
  P('<h2>5. A variável que inverte a conclusão</h2>');
  P('<p>Tudo acima supõe que a empresa absorve o imposto. Mas a CBS é tributo <b>por fora</b>: a prática do mercado é destacá-la na nota, como faz qualquer empresa do regime regular. Se a empresa repassar a CBS ao cliente — que a credita integralmente e fica neutro —, o resultado se desloca:</p>');
  P(graficoRepasse(pontos, viraEm));
  P('<p class="fonte">Resultado no semestre jan–jun/2027 conforme a parcela da CBS cobrada por fora do preço atual. Cálculo sobre a simulação do item 4.</p>');
  if (viraEm != null && viraEm > 0 && viraEm < 100) {
    P('<div class="cx chave"><h4>Em uma frase</h4><p style="margin:0">A pergunta da reunião <b>não é</b> "por dentro ou por fora custa menos". É: <b>a empresa consegue faturar com a CBS destacada, como faz o regime regular?</b> Se conseguir repassar ao menos <b>' + Math.round(viraEm) + '%</b>, apurar por fora passa a ser mais barato <i>e</i> devolve ao cliente o crédito que ele vai perder. Se não conseguir, manter no DAS economiza ' + brl0(Math.abs(s.diferenca)) + ' no semestre.</p></div>');
  }
  }

  // ---------- 6. sensibilidade ----------
  if (d.sensibilidade && d.sensibilidade.length) {
    P('<h2>6. O que faria a recomendação mudar</h2>');
    P('<table><thead><tr><th>Variável</th><th>Hoje</th><th>Efeito no semestre</th><th>Muda a conclusão?</th></tr></thead><tbody>'
      + d.sensibilidade.map(x => '<tr><td><b>' + esc(x.nome) + '</b></td><td>' + esc(x.hoje) + '</td><td>' + esc(x.efeito) + '</td><td>' + esc(x.muda) + '</td></tr>').join('')
      + '</tbody></table>');
    P('<p>' + esc(d.sensibilidadeNota || '') + '</p>');
  }

  // ---------- 7. fontes ----------
  P('<h2>7. De onde vem cada número</h2>');
  P('<table><thead><tr><th>Informação</th><th>Origem</th><th>Confiabilidade</th></tr></thead><tbody>'
    + (d.fontes || []).map(f => '<tr><td>' + esc(f.o_que) + '</td><td>' + esc(f.origem) + '</td><td>' + selo(f.nivel, f.rotulo) + (f.ressalva ? ' <span class="fonte">' + esc(f.ressalva) + '</span>' : '') + '</td></tr>').join('')
    + '</tbody></table>');

  // ---------- 8. recomendação ----------
  P('<h2>8. Recomendação</h2>');
  P('<div class="cx"><h4>' + esc(d.recomendacao.titulo) + '</h4>' + d.recomendacao.corpo + '</div>');

  // ---------- 9. perguntas ----------
  if (d.perguntas && d.perguntas.length) {
    P('<h2>9. O que levantar com o cliente na reunião</h2><ol>' + d.perguntas.map(p => '<li>' + p + '</li>').join('') + '</ol>');
  }

  // ---------- 10. pendências ----------
  if (d.pendencias && d.pendencias.length) {
    P('<h2>10. O que falta para fechar o caso</h2>');
    P('<p>' + esc(d.pendenciasNota || (d.consumidor ? 'Em ordem de valor — nenhum deles inverte a recomendação; servem para afinar o número.' : 'Em ordem de valor para a decisão — o item 1 é o único que pode inverter a recomendação.')) + '</p>');
    P('<table><thead><tr><th style="width:26px">#</th><th>O que falta</th><th>Por que importa</th><th>Onde se obtém</th><th>Quem</th><th>Peso</th></tr></thead><tbody>'
      + d.pendencias.map((p, i) => '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(p.o_que) + '</b></td><td>' + esc(p.porque) + '</td><td>' + esc(p.onde) + '</td><td>' + esc(p.quem) + '</td><td>' + selo(p.nivel, p.peso) + '</td></tr>').join('')
      + '</tbody></table>');
  }

  P('<div class="rodape">Documento de apoio à decisão, elaborado em ' + hoje + ' pela Macedo &amp; Reis Contabilidade. '
    + 'A empresa permanece no Simples Nacional em qualquer das hipóteses analisadas; discute-se exclusivamente a forma de recolhimento do IBS e da CBS em 2027. '
    + 'Simulação baseada nas alíquotas de referência de 2027 (CBS pendente de Resolução do Senado). Valores estimativos: a decisão pela opção é do contribuinte.<br>'
    + 'Base legal: LC 214/2025 · LC 123/2006, art. 18 · Resolução CGSN 140/2018 · Resoluções CGSN 186/2026 e 194/2026.</div>');

  return montarHtml();
  function montarHtml() {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + (versaoCliente ? 'IBS/CBS 2027 — ' : 'Análise IBS/CBS 2027 — ') + esc(cliente.nome_principal) + '</title><style>' + CSS + '</style></head><body class="' + (versaoCliente ? 'v-cli' : 'v-tec') + '">'
    + '<div class="toolbar-print"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>'
    + '<div class="folha">' + partes.join('') + '</div></body></html>';
  }
}

const CSS = `body{font-family:"Segoe UI",Arial,sans-serif;color:#23272E;margin:0;padding:28px;background:#F4F6F8;font-size:13px;line-height:1.55;}
.folha{max-width:860px;margin:0 auto;background:#fff;padding:34px 38px 30px;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.cab{display:flex;align-items:center;gap:14px;} .cab img{width:52px;height:52px;object-fit:contain;}
.esc{display:flex;flex-direction:column;line-height:1.35;} .esc strong{font-size:15px;color:#3A5878;} .esc span{font-size:11px;color:#66707E;}
hr.reg{border:none;border-top:2px solid #5B82A6;margin:14px 0 20px;}
h1{font-size:20px;color:#3A5878;margin:0 0 2px;} .sub{color:#66707E;font-size:12.5px;margin:0 0 18px;}
h2{font-size:14.5px;color:#3A5878;margin:26px 0 8px;padding-bottom:5px;border-bottom:1px solid #E1E6EC;}
h3{font-size:12.5px;color:#3A5878;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em;}
p{margin:0 0 10px;}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;}
th{background:#3A5878;color:#fff;text-align:left;padding:6px 9px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;}
th.num{text-align:right;}
td{padding:6px 9px;border-bottom:1px solid #E1E6EC;vertical-align:top;}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
tr.tot td{font-weight:700;background:#F3F6F9;}
.dados{background:#F7F8FA;border-radius:6px;padding:12px 14px;margin:0 0 16px;font-size:12.5px;} .dados b{color:#3A5878;}
.selo{display:inline-block;border-radius:999px;padding:1px 9px;font-size:10.5px;font-weight:700;}
.s-forte{background:#E1F0E6;color:#2E6B47;} .s-media{background:#FDF0DC;color:#8A5A18;} .s-fraca{background:#FBE4E4;color:#A03A3A;}
.s-conf{background:#E1F0E6;color:#2E6B47;} .s-err{background:#FBE4E4;color:#A03A3A;}
.cx{border-left:4px solid #5B82A6;background:#F7F9FB;border-radius:6px;padding:12px 15px;margin:14px 0;}
.sobre{margin:-4px 0 14px;color:#3A5878;font-size:13.5px;}
.so-escritorio{background:#FBE4E4;border:1px solid #E7A5A5;color:#7A2323;border-radius:8px;padding:10px 14px;margin:0 0 16px;font-size:12.5px;}
@media print{ .so-escritorio{display:none;} }
.resumo{border:2px solid #2E6B47;border-radius:10px;padding:16px 18px;margin:4px 0 20px;background:#F5FBF7;break-inside:avoid;}
.resumo.conf{border-color:#D69A3C;background:#FFFBF3;}
.rs-selo{font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#2E6B47;} .resumo.conf .rs-selo{color:#8A5A18;}
.rs-dec{font-size:22px;font-weight:700;color:#1D2B36;margin:2px 0 6px;line-height:1.2;}
.rs-oq{margin:0 0 12px;color:#4A525E;}
.rs-barras{margin:0 0 12px;} .rs-cap{font-size:11px;color:#66707E;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
.rs-b{display:grid;grid-template-columns:130px 1fr 110px;gap:10px;align-items:center;font-size:12.5px;margin:4px 0;} .rs-b b{text-align:right;font-variant-numeric:tabular-nums;}
.rs-bt{height:14px;background:#EDF0F3;border-radius:7px;overflow:hidden;} .rs-bf{display:block;height:100%;background:#9AA7B6;border-radius:7px;} .rs-bf.win{background:#2E6B47;}
.rs-al{margin:0 0 8px;} .rs-pz{margin:8px 0 0;font-size:12px;color:#4A525E;}
.cx.alerta{border-left-color:#D69A3C;background:#FDF9F2;} .cx.chave{border-left-color:#2E6B47;background:#F2F9F4;}
.cx h4{margin:0 0 6px;font-size:13px;color:#3A5878;} .cx.alerta h4{color:#8A5A18;} .cx.chave h4{color:#2E6B47;}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.ret{border:1px solid #E1E6EC;border-radius:8px;padding:12px 14px;}
.ret.win{border-color:#9CC7AC;background:#F5FBF7;}
.ret h4{margin:0 0 8px;font-size:11px;color:#66707E;text-transform:uppercase;letter-spacing:.05em;}
.ret .rw{display:flex;justify-content:space-between;font-size:12.5px;padding:2px 0;color:#4A525E;}
.ret .rw b{font-variant-numeric:tabular-nums;color:#23272E;}
.ret .rw.tot{border-top:1px solid #E1E6EC;margin-top:6px;padding-top:6px;font-weight:700;}
.fonte{font-size:10.5px;color:#8A93A6;font-style:italic;}
ol,ul{margin:0 0 10px;padding-left:20px;} li{margin-bottom:5px;}
.rodape{margin-top:28px;padding-top:10px;border-top:1px solid #E1E6EC;font-size:10.5px;color:#8A93A6;}
.toolbar-print{position:fixed;top:10px;right:10px;} .toolbar-print button{padding:8px 14px;cursor:pointer;}
svg{display:block;max-width:100%;}
@page{margin:1.2cm;}
/* versão do cliente: uma folha A4 */
.v-cli .folha{padding:26px 34px 22px;} .v-cli h1{font-size:18px;} .v-cli .sub{margin:0 0 8px;font-size:11.5px;} .v-cli .sobre{margin:0 0 10px;font-size:12.5px;}
.v-cli .resumo{padding:12px 16px;margin:2px 0 12px;} .v-cli .rs-dec{font-size:19px;} .v-cli .resumo p, .v-cli .rs-al li{font-size:12px;line-height:1.45;} .v-cli .rs-al li{margin-bottom:3px;}
.v-cli .rs-barras{margin:0 0 8px;} .v-cli h2{margin:14px 0 6px;font-size:13.5px;} .v-cli .perg li{font-size:12px;margin-bottom:3px;}
.numlinha{font-size:12px;color:#4A525E;margin:0 0 4px;} .v-cli .rodape{margin-top:12px;font-size:9.5px;}
.v-cli .cab img{width:44px;height:44px;} .v-cli .cab{padding-bottom:10px;margin-bottom:12px;}
@media print{ .v-cli .folha{padding:0;} }
@media print{ body{padding:0;background:#fff;} .folha{box-shadow:none;padding:0;max-width:none;} .toolbar-print{display:none;}
  /* fluxo de livro: tabela pode quebrar entre páginas (cabeçalho repete), linha não; título fica com o que vem depois;
     só o que é pequeno e visual (caixas, cards, gráfico) é indivisível — assim cada página enche parelho */
  table{page-break-inside:auto;} thead{display:table-header-group;} tfoot{display:table-footer-group;}
  tr,.duas,svg,figure{page-break-inside:avoid;}
  .cx{page-break-inside:auto;} .cx h4{page-break-after:avoid;}
  h2,h3{page-break-after:avoid;page-break-inside:avoid;}
  p,li{orphans:3;widows:3;} }`;
