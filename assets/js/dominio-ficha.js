// ============================================================
// MACEDO & REIS — O Domínio na ficha da empresa (clientes/editar.html, 02/11/2026, pedido do Samuel: "pode tocar tudo")
// O que a ponte do Domínio (no PC do escritório, todo dia às 7h) leu desta empresa no banco do Domínio Web: os últimos
// 6 meses da folha (os empregados ativos no fim do mês, as admissões, os desligamentos, os afastados, os sócios com o
// pró-labore calculado), das notas (quantas de saída e de entrada e o valor contábil) e dos lançamentos contábeis.
// Desde 05/11/2026 (a versão 2 da ponte), também em reais: o faturamento (a receita bruta pelos acumuladores de
// faturamento, menos as devoluções; e, de quem apura o Simples no Domínio, a apuração e o RBT12), as compras e a folha
// (os proventos dos empregados, o 13º, o pró-labore e os encargos da empresa), numa segunda tabela.
// Só os totais: nenhum dado de funcionário sai do Domínio. A seção só aparece com a empresa ligada ao Domínio (pelo
// CNPJ ou CPF do cadastro). A empresa com dois códigos no Domínio (o mesmo documento) fica com o maior de cada número,
// como na Carteira da Precificação e no assistente (textoDoDominio, em supabase/functions/assistente/ferramentas.js).
// Puro, menos carregarDominio: testes em tests/dominio-ficha.test.mjs e tests/harness/dominio-ficha.py.
// ============================================================

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
const mesBR = c => { const m = /^(\d{4})-(\d{2})$/.exec(String(c || '')); return m ? m[2] + '/' + m[1] : String(c || ''); };
const inteiro = v => Number(v).toLocaleString('pt-BR');
const dinheiro = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MESES_NA_FICHA = 6;
export const CAMPOS = ['funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore', 'notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas', 'lancamentos', 'ultimo_lancamento'];
// os valores da versão 2 da ponte que a ficha mostra (os outros ficam pro Comparativo e pro assistente)
export const CAMPOS_VALOR = ['receita_bruta', 'receita_simples', 'rbt12', 'meses_rbt12', 'compras', 'servicos_tomados', 'salarios', 'rescisoes', 'decimo_terceiro',
  'pro_labore_valor', 'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'];
const TODOS = [...CAMPOS, ...CAMPOS_VALOR];

/** O mês 'AAAA-MM' de n meses antes do dia 'AAAA-MM-DD'. */
export function mesAntes(iso, n) {
  const y = +String(iso).slice(0, 4), m = +String(iso).slice(5, 7) - 1 - n;
  return (y + Math.floor(m / 12)) + '-' + String((((m % 12) + 12) % 12) + 1).padStart(2, '0');
}

/** As linhas de dominio_mensal, uma por mês (dois códigos no mesmo mês: o maior de cada número), do mais recente pro mais antigo. */
export function juntarMeses(linhas) {
  const porMes = new Map();
  for (const l of linhas || []) {
    if (!l || !/^\d{4}-\d{2}$/.test(String(l.competencia || ''))) continue;
    const m = porMes.get(l.competencia) || { competencia: l.competencia };
    for (const c of TODOS) {
      const v = l[c];
      if (v == null) continue;
      if (c === 'ultimo_lancamento') { if (String(v) > String(m[c] || '')) m[c] = String(v); }
      else if (m[c] == null || +v > +m[c]) m[c] = +v;
    }
    porMes.set(l.competencia, m);
  }
  return [...porMes.values()].sort((a, b) => b.competencia.localeCompare(a.competencia));
}

export const temDado = d => !!(d && ((d.empresas && d.empresas.length) || (d.linhas && d.linhas.length)));

// a soma dos que vieram (null quando nenhum veio: o Domínio não disse)
const soma = (...vs) => (vs.some(v => v != null) ? vs.reduce((s, v) => s + (v == null ? 0 : +v), 0) : null);
/** A folha do mês: os proventos dos empregados (já com as férias e as rescisões) mais o 13º. */
export const folhaDoMes = m => soma(m.salarios, m.decimo_terceiro);
/** Os encargos da empresa no mês: o FGTS e o INSS dela (com o RAT e os terceiros). */
export const encargosDoMes = m => soma(m.fgts, m.inss_empresa, m.inss_rat, m.inss_terceiros);
const VALORES_DA_TABELA = ['receita_bruta', 'compras', 'servicos_tomados', 'salarios', 'decimo_terceiro', 'pro_labore_valor', 'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'];
/** Se algum mês tem um valor em reais (a versão 2 da ponte já leu a empresa). */
export const temValores = meses => (meses || []).some(m => VALORES_DA_TABELA.some(c => m[c] != null));

/** O HTML da seção (já escapado), ou '' quando a empresa não está ligada ao Domínio. `hoje` = 'AAAA-MM-DD'. */
export function htmlDoDominio(d, hoje) {
  if (!temDado(d)) return '';
  const emps = d.empresas || [];
  const meses = juntarMeses(d.linhas).slice(0, MESES_NA_FICHA);
  const mesHoje = String(hoje || '').slice(0, 7), mesPassado = hoje ? mesAntes(hoje, 1) : '';
  const MUDO = 'color:var(--text-muted); font-size:11px;';
  const parcial = c => c === mesHoje || c === mesPassado;
  const celMes = c => '<td>' + esc(mesBR(c)) + (parcial(c) ? '<div style="' + MUDO + '">em fechamento</div>' : '') + '</td>';

  const quem = emps.length
    ? emps.map(e => 'código ' + esc(e.codigo) + (e.ativa === false ? ' <span style="color:var(--warning, #b7791f);">(inativa no Domínio)</span>' : '')).join(' e ')
    : 'ligada pelo documento';
  const cab = '<div style="padding:4px 0 10px; font-size:13px;">Empresa no Domínio: ' + quem + '</div>';

  let corpo, valores = false;
  if (!meses.length) {
    corpo = '<div style="padding:8px 0;">Sem movimento no Domínio nos últimos ' + MESES_NA_FICHA + ' meses.</div>';
  } else {
    const n = v => (v == null ? '<span style="color:var(--text-muted);">—</span>' : esc(inteiro(v)));
    const notas = (q, v) => (q == null ? n(null) : n(q) + (q > 0 && v != null ? '<div style="' + MUDO + '">' + esc(dinheiro(v)) + '</div>' : ''));
    const linhas = meses.map(m => {
      const folha = m.funcionarios_ativos == null ? n(null)
        : n(m.funcionarios_ativos) + ((m.admissoes || m.desligamentos || m.afastados)
          ? '<div style="' + MUDO + '">' + [m.admissoes ? '+' + inteiro(m.admissoes) + ' adm.' : '', m.desligamentos ? '−' + inteiro(m.desligamentos) + ' desl.' : '',
            m.afastados ? inteiro(m.afastados) + ' afast.' : ''].filter(Boolean).join(' · ') + '</div>' : '');
      return '<tr>' + celMes(m.competencia)
        + '<td>' + folha + '</td><td>' + n(m.pro_labore) + '</td>'
        + '<td>' + notas(m.notas_saida, m.valor_saidas) + '</td><td>' + notas(m.notas_entrada, m.valor_entradas) + '</td>'
        + '<td>' + n(m.lancamentos) + (m.lancamentos > 0 && m.ultimo_lancamento ? '<div style="' + MUDO + '">até ' + esc(dataBR(m.ultimo_lancamento).slice(0, 5)) + '</div>' : '') + '</td></tr>';
    }).join('');
    corpo = '<div style="overflow-x:auto;"><table class="hist-tbl dm-qtd"><thead><tr><th>Mês</th><th>Empregados</th><th>Sócios com pró-labore</th>'
      + '<th>Notas de saída</th><th>Notas de entrada</th><th>Lançamentos</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';

    // a segunda tabela: os valores em reais (só depois que a versão 2 da ponte leu a empresa)
    valores = temValores(meses);
    if (valores) {
      const r = v => (v == null ? '<span style="color:var(--text-muted);">—</span>' : esc(dinheiro(v)));
      const sub = partes => (partes.filter(Boolean).length ? '<div style="' + MUDO + '">' + partes.filter(Boolean).join(' · ') + '</div>' : '');
      const linhasV = meses.map(m => {
        const doSimples = m.receita_simples != null && m.receita_bruta != null && Math.abs(m.receita_simples - m.receita_bruta) >= 1
          ? 'no Simples: ' + esc(dinheiro(m.receita_simples)) : '';
        const fol = folhaDoMes(m), enc = encargosDoMes(m), inss = soma(m.inss_empresa, m.inss_rat, m.inss_terceiros);
        return '<tr>' + celMes(m.competencia)
          + '<td>' + r(m.receita_bruta) + sub([doSimples]) + '</td>'
          + '<td>' + r(m.compras) + sub([m.servicos_tomados > 0 ? '+ serviços ' + esc(dinheiro(m.servicos_tomados)) : '']) + '</td>'
          + '<td>' + r(fol) + sub([m.decimo_terceiro > 0 ? 'com 13º ' + esc(dinheiro(m.decimo_terceiro)) : '', m.rescisoes > 0 ? 'rescisões ' + esc(dinheiro(m.rescisoes)) : '']) + '</td>'
          + '<td>' + r(m.pro_labore_valor) + '</td>'
          + '<td>' + r(enc) + sub(enc ? [m.fgts != null ? 'FGTS ' + esc(dinheiro(m.fgts)) : '', inss != null ? 'INSS ' + esc(dinheiro(inss)) : ''] : []) + '</td></tr>';
      }).join('');
      const comRbt = meses.find(m => m.rbt12 != null);
      const rbt = comRbt
        ? '<div style="font-size:13px; margin:2px 0 8px;">RBT12 de ' + esc(mesBR(comRbt.competencia)) + ' no Simples (a receita dos 12 meses anteriores, que dá a faixa): '
          + '<strong>' + esc(dinheiro(comRbt.rbt12)) + '</strong>'
          + (comRbt.meses_rbt12 != null && comRbt.meses_rbt12 < 12 ? ' <span style="' + MUDO + '">(com ' + esc(inteiro(comRbt.meses_rbt12)) + ' meses de atividade: a média × 12)</span>' : '')
          + '</div>'
        : '';
      corpo += '<div style="font-size:13px; font-weight:600; margin:16px 0 6px;">Em reais</div>' + rbt
        + '<div style="overflow-x:auto;"><table class="hist-tbl dm-valor"><thead><tr><th>Mês</th><th>Faturamento</th><th>Compras</th><th>Folha</th><th>Pró-labore</th>'
        + '<th>Encargos da folha</th></tr></thead><tbody>' + linhasV + '</tbody></table></div>';
    }
  }

  const lido = (d.linhas || []).map(l => l && l.atualizado_em).filter(Boolean).sort().pop();
  return cab + corpo + '<div class="field-help" style="margin-top:10px;">Lido do Domínio pela ponte do PC do escritório (todo dia às 7h)'
    + (lido ? ', a última vez em ' + esc(dataBR(diaEmBrasilia(lido))) : '') + '. Só os totais: nenhum dado de funcionário sai do Domínio. '
    + 'Empregados = os ativos no último dia do mês. O mês de hoje e o passado ainda estão em fechamento lá. '
    + 'O valor das notas é o valor contábil, não o faturamento '
    + (valores
      ? '(entram devolução, remessa e transferência). O faturamento é a receita bruta pelos acumuladores de faturamento do Domínio, menos as devoluções; '
        + '"no Simples" é a apuração do mês no Domínio, com as filiais, como no PGDAS (o declarado está na seção Receita). As compras são as de mercadoria e de insumos, '
        + 'pelo CFOP; a folha, os proventos dos empregados com as férias, as rescisões e o 13º; os encargos, o FGTS e o INSS da empresa, com o RAT e os terceiros.</div>'
      : '(o faturamento é o da declaração do PGDAS).</div>');
}

// o dia de um carimbo com hora, em Brasília
function diaEmBrasilia(momento) {
  const d = new Date(momento);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Lê o que a ponte trouxe desta empresa (os últimos 6 meses). Erro na leitura: sem a seção (a ficha segue igual). */
export async function carregarDominio(supabase, clienteId, hoje) {
  try {
    const [e, m] = await Promise.all([
      supabase.from('dominio_empresas').select('codigo, ativa').eq('cliente_id', clienteId).order('codigo'),
      supabase.from('dominio_mensal').select('codigo, competencia, ' + TODOS.join(', ') + ', atualizado_em').eq('cliente_id', clienteId)
        .gte('competencia', mesAntes(hoje, MESES_NA_FICHA - 1)).order('competencia', { ascending: false }).limit(60)
    ]);
    if (e.error || m.error) return null;
    return { empresas: e.data || [], linhas: m.data || [] };
  } catch (err) {
    return null;
  }
}
