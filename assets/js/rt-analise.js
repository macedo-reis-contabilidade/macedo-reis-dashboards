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

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct1 = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); } catch (e) { return iso; } };
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtCnpj = d => { const s = String(d || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : (d || '—'); };

const SELO = { alta: 's-forte', media: 's-media', baixa: 's-fraca' };
const selo = (nivel, texto) => '<span class="selo ' + SELO[nivel] + '">' + esc(texto || nivel) + '</span>';

// ---------- gráfico de barras empilhadas: faturamento mês a mês ----------
function graficoFaturamento(meses) {
  if (!meses || !meses.length) return '';
  const larg = 800, alt = 250, base = 200, topo = 20;
  const max = Math.max(...meses.map(m => m.total || 0));
  const teto = Math.ceil(max / 50000) * 50000 || 1;
  const y = v => base - (v / teto) * (base - topo);
  const passo = (larg - 70) / meses.length;
  const bw = Math.min(58, passo * 0.6);
  const barras = meses.map((m, i) => {
    const x = 60 + i * passo + (passo - bw) / 2;
    const ys = y(m.servicos || 0), ym = y((m.servicos || 0) + (m.saidas || 0));
    return '<rect x="' + x.toFixed(1) + '" y="' + ys.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - ys).toFixed(1) + '" fill="#5B82A6"/>'
      + '<rect x="' + x.toFixed(1) + '" y="' + ym.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (ys - ym).toFixed(1) + '" fill="#A9C4DA"/>'
      + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (ym - 5).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#66707E">' + Math.round((m.total || 0) / 1000) + 'k</text>'
      + '<text x="' + (x + bw / 2).toFixed(1) + '" y="215" text-anchor="middle" font-size="10" fill="#4A525E">' + MES_ABREV[Number(String(m.competencia).slice(5, 7)) - 1] + '</text>';
  }).join('');
  const guias = [0, 0.5, 1].map(f => {
    const v = teto * f;
    return '<line x1="60" y1="' + y(v).toFixed(1) + '" x2="' + (larg - 20) + '" y2="' + y(v).toFixed(1) + '" stroke="' + (f ? '#EDF1F5' : '#C9D2DC') + '"/>'
      + '<text x="54" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#66707E">' + (v ? Math.round(v / 1000) + ' mil' : '0') + '</text>';
  }).join('');
  return '<svg viewBox="0 0 ' + larg + ' ' + alt + '" role="img" aria-label="Faturamento mensal separado entre serviços e mercadorias">'
    + guias + '<line x1="60" y1="' + topo + '" x2="60" y2="' + base + '" stroke="#C9D2DC"/>' + barras
    + '<rect x="' + (larg - 200) + '" y="232" width="11" height="11" fill="#5B82A6"/><text x="' + (larg - 183) + '" y="241" font-size="10" fill="#4A525E">serviços</text>'
    + '<rect x="' + (larg - 118) + '" y="232" width="11" height="11" fill="#A9C4DA"/><text x="' + (larg - 101) + '" y="241" font-size="10" fill="#4A525E">mercadorias</text>'
    + '</svg>';
}

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
      + '<text x="' + (x + bw / 2).toFixed(0) + '" y="176" text-anchor="middle" font-size="10.5" fill="#4A525E">' + p.repasse + '%</text>';
  }).join('');
  const xVira = viraEm != null && viraEm >= 0 && viraEm <= 100 ? 90 + (viraEm / 100) * (larg - 120) : null;
  return '<svg viewBox="0 0 ' + larg + ' 190" role="img" aria-label="Resultado no semestre conforme o percentual da CBS repassado ao cliente">'
    + '<line x1="60" y1="' + zero + '" x2="' + (larg - 20) + '" y2="' + zero + '" stroke="#8A93A6"/>'
    + '<text x="54" y="' + (zero + 4) + '" text-anchor="end" font-size="10" fill="#66707E">0</text>'
    + barras
    + (xVira != null ? '<line x1="' + xVira.toFixed(0) + '" y1="20" x2="' + xVira.toFixed(0) + '" y2="165" stroke="#D69A3C" stroke-dasharray="4 3"/>'
        + '<text x="' + (xVira + 6).toFixed(0) + '" y="28" font-size="10.5" fill="#8A5A18" font-weight="600">vira em ' + Math.round(viraEm) + '%</text>' : '')
    + '<text x="60" y="186" font-size="10" fill="#8A93A6">quanto da CBS é cobrada por fora do preço atual</text>'
    + '</svg>';
}

// ============================================================
// gerarAnalise(dados) → HTML completo do documento
// dados: { cliente, caso, sim, entrada, dominio, xml, logoUrl, hoje }
// ============================================================
export function gerarAnalise(d) {
  const { cliente, caso, sim, entrada: e, dominio, xml } = d;
  const hoje = d.hoje || new Date().toLocaleDateString('pt-BR');
  const s = sim.semestre, m = sim.mes;
  const receita = e.receita;
  const optar = s.custoFora < s.custoDentro;

  // --- repasse: a CBS cobrada por fora do preço sai do bolso do cliente (que credita) ---
  const pontos = [0, 25, 50, 75, 100].map(r => ({ repasse: r, liquido: -(s.custoFora - m.debitoFora * (r / 100) * 6 - s.custoDentro) }));
  const viraEm = m.debitoFora > 0 ? (s.diferenca / 6) / m.debitoFora * 100 : null;

  const partes = [];
  const P = h => partes.push(h);

  // ---------- capa ----------
  P('<header class="cab"><img src="' + d.logoUrl + '" alt="Macedo &amp; Reis"><div class="esc"><strong>Macedo &amp; Reis Contabilidade</strong><span>CRC/RS 006418/O</span><span>Três Coroas – RS</span></div></header><hr class="reg">');
  P('<h1>IBS/CBS em 2027: por dentro ou por fora do DAS</h1>');
  P('<p class="sub">Análise técnica de apoio à decisão — <b>' + esc(cliente.nome_principal) + '</b> · CNPJ ' + fmtCnpj(cliente.documento)
    + (cliente.cidade ? ' · ' + esc(cliente.cidade) : '') + (caso.cnae_base ? ' · CNAE ' + esc(caso.cnae_base) : '')
    + ' · Documento interno, ' + hoje + '</p>');

  P('<div class="cx"><h4>O que está em jogo — e o que não está</h4>'
    + '<p>A empresa <b>permanece no Simples Nacional</b> nas duas hipóteses. Não se discute aqui troca de regime tributário: IRPJ, CSLL, CPP e o que restar de ICMS/ISS continuam sendo recolhidos no DAS de qualquer forma.</p>'
    + '<p style="margin-bottom:0">A única escolha é <b>por onde o IBS e a CBS serão recolhidos em 2027</b>:</p>'
    + '<ul style="margin-top:6px;margin-bottom:0"><li><b>Por dentro</b> — embutidos no DAS, como hoje. O cliente da empresa credita apenas a parcela de CBS contida no DAS.</li>'
    + '<li><b>Por fora</b> — apurados pelo regime regular, fora do DAS, com direito a crédito nas entradas e crédito integral para o cliente. O DAS diminui na mesma proporção.</li></ul></div>');

  P('<div class="dados"><b>Prazo:</b> a opção deve ser formalizada até <b>30/09/2026</b> e pode ser <b>cancelada até 30/11/2026</b> sem produzir efeito (Resolução CGSN 186/2026). Quem não opta em setembro só tem nova janela em <b>março/2027</b>, com efeito a partir de <b>julho/2027</b>.'
    + (dominio || xml ? '<br><b>Base desta análise:</b> ' + [
        dominio && dominio.faturamento ? 'relatório de faturamento ' + dominio.periodoRotulo : null,
        dominio && dominio.pgdas ? 'apuração do Simples (PGDAS ' + esc(dominio.pgdas.competencia) + ')' : null,
        dominio && dominio.entradas ? 'acompanhamento de entradas' : null,
        xml && xml.nNotas ? xml.nNotas + ' notas fiscais eletrônicas emitidas' : null
      ].filter(Boolean).join(', ') + '.' : '') + '</div>');

  // ---------- 1. retrato ----------
  P('<h2>1. O que a empresa é, pelos números</h2>');
  const pctServ = dominio && dominio.faturamento ? dominio.faturamento.servicos / dominio.faturamento.total * 100 : null;
  if (pctServ != null && pctServ >= 60) {
    P('<p>A empresa fatura <b>' + pct1(pctServ) + '% em serviço</b> e ' + pct1(100 - pctServ) + '% em mercadoria. O custo de uma prestadora de serviço é mão de obra, e <b>folha de pagamento não gera crédito de IBS/CBS</b> — é isso que define toda a conta adiante.</p>');
  }
  P('<table><thead><tr><th>Indicador</th><th class="num">Valor</th><th>Fonte</th></tr></thead><tbody>'
    + (dominio && dominio.faturamento ? '<tr><td>Faturamento ' + dominio.periodoRotulo + '</td><td class="num">' + brl(dominio.faturamento.total) + '</td><td>Relatório de faturamento (Domínio)</td></tr>'
      + '<tr><td>— serviços</td><td class="num">' + brl(dominio.faturamento.servicos) + ' · ' + pct1(pctServ) + '%</td><td>idem</td></tr>'
      + '<tr><td>— mercadorias</td><td class="num">' + brl(dominio.faturamento.saidas) + ' · ' + pct1(100 - pctServ) + '%</td><td>idem</td></tr>' : '')
    + '<tr><td>Receita mensal usada na simulação</td><td class="num">' + brl(receita) + '</td><td>' + esc(d.origemReceita || 'informado na ficha') + '</td></tr>'
    + '<tr><td>RBT12</td><td class="num">' + brl(e.rbt12) + '</td><td>' + (dominio && dominio.pgdas ? 'PGDAS ' + esc(dominio.pgdas.competencia) : 'ficha') + '</td></tr>'
    + '<tr><td>Anexo e alíquota efetiva do Simples</td><td class="num">Anexo ' + esc(e.anexo) + ' · ' + pct1(sim.aliqEfetiva * 100) + '%</td><td>' + (dominio && dominio.pgdas ? 'PGDAS ' + esc(dominio.pgdas.competencia) : 'LC 123, art. 18') + '</td></tr>'
    + '<tr><td>DAS médio</td><td class="num">' + brl(m.dasHoje) + '/mês</td><td>calculado</td></tr>'
    + (xml && xml.pctPJ != null ? '<tr><td>Vendas para CNPJ</td><td class="num">' + pct1(xml.pctPJ) + '%</td><td>XML das notas emitidas</td></tr>' : '')
    + '<tr class="tot"><td>Entradas que geram crédito</td><td class="num">' + brl(receita * (e.pctComprasMercadorias + e.pctComprasDespesas) / 100) + '/mês · ' + pct1(e.pctComprasMercadorias + e.pctComprasDespesas) + '% da receita</td><td>' + (dominio && dominio.entradas ? 'Acompanhamento de entradas' : 'ficha') + '</td></tr>'
    + '</tbody></table>');

  if (dominio && dominio.faturamento && dominio.meses && dominio.meses.length > 1) {
    P('<h3>Faturamento mês a mês — serviço e mercadoria</h3>');
    P(graficoFaturamento(dominio.meses));
    P('<p class="fonte">Fonte: Relatório de Faturamento (Domínio), ' + dominio.periodoRotulo + '. Cada mês confere com a receita declarada no PGDAS do mesmo período.</p>');
  }

  // ---------- 2. clientes ----------
  if (xml && xml.clientes && xml.clientes.length) {
    P('<h2>2. Para quem a empresa vende — e por que isso decide a conta</h2>');
    P('<p>A empresa atendeu <b>' + xml.nClientes + ' grupos econômicos</b> no período. Os dez maiores concentram <b>' + pct1(xml.top10) + '% da receita</b>'
      + (xml.top20 != null ? '; os vinte maiores, <b>' + pct1(xml.top20) + '%</b>' : '') + '.</p>');
    P('<table><thead><tr><th>Cliente</th><th>UF</th><th class="num">Faturado</th><th class="num">% da receita</th><th class="num">Acumulado</th></tr></thead><tbody>'
      + xml.clientes.slice(0, 10).map(c => '<tr><td>' + esc(c.nome) + (c.cnpjs > 1 ? ' <span class="fonte">(' + c.cnpjs + ' CNPJs)</span>' : '') + '</td><td>' + esc(c.uf || '—') + '</td><td class="num">' + brl(c.valor) + '</td><td class="num">' + pct1(c.pct) + '%</td><td class="num">' + pct1(c.acum) + '%</td></tr>').join('')
      + (xml.nClientes > 10 ? '<tr class="tot"><td colspan="2">Demais ' + (xml.nClientes - 10) + ' grupos econômicos</td><td class="num">' + brl(xml.totalVendas - xml.clientes.slice(0, 10).reduce((a, c) => a + c.valor, 0)) + '</td><td class="num">' + pct1(100 - xml.top10) + '%</td><td class="num">100%</td></tr>' : '')
      + '</tbody></table>');
    P('<p class="fonte">Fonte: XML das notas fiscais emitidas, agrupadas por raiz de CNPJ. Total de vendas identificadas: ' + brl(xml.totalVendas) + '.</p>');
    const creditoHojePct = 9.25, creditoDentroPct = m.debitoFora > 0 ? m.parcelaCbsIbs / receita * 100 : 0;
    P('<div class="cx chave"><h4>O ponto central</h4><p style="margin:0">Hoje esses clientes creditam <b>PIS/COFINS de ' + pct1(creditoHojePct) + '%</b> sobre o que compram desta empresa. Em 2027, se a apuração ficar <b>por dentro</b>, o crédito que eles levam cai para <b>' + pct1(creditoDentroPct) + '%</b> — só a parcela de CBS embutida no DAS. É uma perda de cerca de <b>' + Math.round(creditoHojePct - creditoDentroPct) + ' pontos de crédito para o cliente</b>, sem que a empresa mude nada e sem que ela ganhe nada com isso.</p></div>');
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
        + '<td>' + (x.incluido ? 'Sim' : x.credita ? 'Sim — não considerado' : 'Não — não é compra') + '</td></tr>').join('')
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
  P('<p>Alíquotas de referência de 2027: <b>CBS ' + pct1(e.cbs) + '%</b> (pendente de Resolução do Senado) e <b>IBS ' + pct1(e.ibs) + '%</b> (alíquota-teste). Cenário: preço de venda inalterado, isto é, a empresa <b>absorve</b> a CBS.</p>');
  P('<div class="duas">'
    + '<div class="ret' + (optar ? '' : ' win') + '"><h4>Por dentro — IBS/CBS no DAS</h4>'
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

  P('<h3>De onde vem a diferença, mês a mês</h3>');
  P('<table><thead><tr><th>Componente</th><th class="num">Por dentro</th><th class="num">Por fora</th></tr></thead><tbody>'
    + '<tr><td>DAS do Simples</td><td class="num">' + brl(m.dasHoje) + '</td><td class="num">' + brl(m.dasSobra) + ' <span class="fonte">(sai a fatia de CBS)</span></td></tr>'
    + '<tr><td>IBS/CBS sobre as vendas</td><td class="num">—</td><td class="num">' + brl(m.debitoFora) + '</td></tr>'
    + '<tr><td>(−) crédito das entradas</td><td class="num">—</td><td class="num">− ' + brl(m.creditoEntradas) + '</td></tr>'
    + '<tr class="tot"><td>Custo do mês</td><td class="num">' + brl(s.custoDentro / 6) + '</td><td class="num">' + brl(s.custoFora / 6) + '</td></tr>'
    + '<tr><td colspan="3" style="border:none;padding-top:10px;"><b>Diferença: ' + brl0(Math.abs(s.diferenca) / 6) + ' por mês — ' + pct1(Math.abs(s.diferenca) / 6 / receita * 100) + '% da receita mensal.</b></td></tr>'
    + '</tbody></table>');
  if (!optar) {
    P('<p>O motivo é aritmético: <b>por fora a empresa debita ' + pct1(e.cbs + e.ibs) + '% sobre tudo o que fatura e credita pouco na entrada</b>, porque compra só ' + pct1(e.pctComprasMercadorias + e.pctComprasDespesas) + '% do que fatura. O regime regular favorece quem compra muito.</p>');
  }

  // ---------- 5. repasse ----------
  P('<h2>5. A variável que inverte a conclusão</h2>');
  P('<p>Tudo acima pressupõe preço inalterado. Mas a CBS é tributo <b>por fora</b>: a prática do mercado é destacá-la na nota, como faz qualquer empresa do regime regular. Se a empresa repassar a CBS ao cliente — que a credita integralmente e fica neutro —, o resultado se desloca:</p>');
  P(graficoRepasse(pontos, viraEm));
  P('<p class="fonte">Resultado no semestre jan–jun/2027 conforme a parcela da CBS cobrada por fora do preço atual. Cálculo sobre a simulação do item 4.</p>');
  if (viraEm != null && viraEm > 0 && viraEm < 100) {
    P('<div class="cx chave"><h4>Em uma frase</h4><p style="margin:0">A pergunta da reunião <b>não é</b> "por dentro ou por fora custa menos". É: <b>a empresa consegue faturar com a CBS destacada, como faz o regime regular?</b> Se conseguir repassar ao menos <b>' + Math.round(viraEm) + '%</b>, apurar por fora passa a ser mais barato <i>e</i> devolve ao cliente o crédito que ele vai perder. Se não conseguir, manter no DAS economiza ' + brl0(Math.abs(s.diferenca)) + ' no semestre.</p></div>');
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

  if (d.sinais && d.sinais.length) {
    P('<h3>Conferência da triagem inicial</h3>');
    P('<p>A triagem automática classificou a empresa a partir <b>apenas do CNAE</b>, antes de existir qualquer dado próprio. Confrontados os quatro sinais com os números medidos:</p>');
    P('<table><thead><tr><th>Sinal</th><th>Triagem por CNAE</th><th>Medido</th><th></th></tr></thead><tbody>'
      + d.sinais.map(x => '<tr><td>' + esc(x.nome) + '</td><td>' + (x.ok ? esc(x.cnae) : '<b>' + esc(x.cnae) + '</b>') + '</td><td>' + (x.ok ? esc(x.medido) : '<b>' + esc(x.medido) + '</b>') + '</td><td>'
        + '<span class="selo ' + (x.ok ? 's-conf">confirma' : 's-err">corrigir → ' + esc(x.correto)) + '</span></td></tr>').join('')
      + '</tbody></table>');
    if (d.scoreNota) P('<p>' + d.scoreNota + '</p>');
  }

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
    P('<p>Em ordem de valor para a decisão — o item 1 é o único que pode inverter a recomendação.</p>');
    P('<table><thead><tr><th style="width:26px">#</th><th>O que falta</th><th>Por que importa</th><th>Onde se obtém</th><th>Quem</th><th>Peso</th></tr></thead><tbody>'
      + d.pendencias.map((p, i) => '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(p.o_que) + '</b></td><td>' + esc(p.porque) + '</td><td>' + esc(p.onde) + '</td><td>' + esc(p.quem) + '</td><td>' + selo(p.nivel, p.peso) + '</td></tr>').join('')
      + '</tbody></table>');
  }

  P('<div class="rodape">Documento interno de apoio à decisão, elaborado em ' + hoje + ' pela Macedo &amp; Reis Contabilidade. '
    + 'A empresa permanece no Simples Nacional em qualquer das hipóteses analisadas; discute-se exclusivamente a forma de recolhimento do IBS e da CBS em 2027. '
    + 'Simulação baseada nas alíquotas de referência de 2027 (CBS pendente de Resolução do Senado). Valores estimativos: a decisão pela opção é do contribuinte.<br>'
    + 'Base legal: LC 214/2025 · LC 123/2006, art. 18 · Resolução CGSN 140/2018 · Resolução CGSN 186/2026.</div>');

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Análise IBS/CBS 2027 — ' + esc(cliente.nome_principal) + '</title><style>' + CSS + '</style></head><body>'
    + '<div class="toolbar-print"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>'
    + '<div class="folha">' + partes.join('') + '</div></body></html>';
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
@media print{ body{padding:0;background:#fff;} .folha{box-shadow:none;padding:0;max-width:none;} .toolbar-print{display:none;} h2{page-break-after:avoid;} table,.cx,.duas,svg{page-break-inside:avoid;} }`;
