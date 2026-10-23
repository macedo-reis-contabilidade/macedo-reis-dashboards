// ============================================================
// MACEDO & REIS — A Receita na ficha da empresa (clientes/editar.html, 23/10/2026, pedido do Samuel)
// O que a ponte da Receita (Integra Contador, no PC do escritório) consultou desta empresa: a autorização de acesso do
// escritório, a situação fiscal (as pendências na Receita e na PGFN), o PGDAS dos últimos meses (transmitido, DAS pago,
// a receita do mês e a dos 12 meses) e as mensagens da Caixa Postal do e-CAC. Só consulta: nada é transmitido.
// A seção só aparece quando a ponte já consultou a empresa. Os avisos (sem autorização, PGDAS não transmitido, mensagem,
// pendência) são do vigia (vigia_regras_receita). Tudo do banco entra escapado (regra 2b).
// Puro, menos carregarReceita: testes em tests/receita-ficha.test.mjs e tests/harness/receita-ficha.py.
// ============================================================

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
const mesBR = c => { const m = /^(\d{4})-(\d{2})$/.exec(String(c || '')); return m ? m[2] + '/' + m[1] : String(c || ''); };
const dinheiro = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// o dia de um carimbo com hora, em Brasília
export function diaEmBrasilia(momento) {
  if (!momento) return null;
  const d = new Date(momento);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export const temDado = d => !!(d && (d.empresa || (d.pgdas && d.pgdas.length) || (d.mensagens && d.mensagens.length)));

/** O HTML da seção (já escapado), ou '' quando a ponte ainda não consultou a empresa. */
export function htmlDaReceita(d) {
  if (!temDado(d)) return '';
  const e = d.empresa || {};
  const linhas = [];
  const linha = (rotulo, html, cor) => linhas.push('<div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--border, rgba(127,127,127,.2));">'
    + '<div style="min-width:150px; font-weight:600;">' + esc(rotulo) + '</div><div style="flex:1;' + (cor ? ' color:' + cor + ';' : '') + '">' + html + '</div></div>');
  const VERMELHO = 'var(--danger, #c0392b)';

  if (e.autorizacao === 'ativa') {
    linha('Autorização', 'O escritório tem a autorização de acesso' + (e.autorizacao_ate ? ' até ' + esc(dataBR(e.autorizacao_ate)) : '') + '.');
  } else if (e.autorizacao === 'vencida' || e.autorizacao === 'sem') {
    linha('Autorização', (e.autorizacao === 'vencida' ? 'A autorização de acesso do escritório venceu.' : 'A Receita recusou a consulta: o escritório não tem a autorização de acesso desta empresa.')
      + ' Peça ao cliente pra autorizar o CNPJ do escritório (Portal de Serviços da Receita, Minhas Autorizações de Acesso) e aceite no e-CAC.', VERMELHO);
  }

  if (Array.isArray(e.pendencias)) {
    const quando = e.situacao_fiscal_em ? ' (relatório de ' + esc(dataBR(e.situacao_fiscal_em)) + ')' : '';
    if (!e.pendencias.length) linha('Situação fiscal', 'Sem pendência na Receita e na PGFN' + quando + '.');
    else linha('Situação fiscal', e.pendencias.length + (e.pendencias.length === 1 ? ' pendência' : ' pendências') + quando + ': '
      + e.pendencias.map(p => esc((p && p.orgao) || 'Receita') + ', ' + esc(p && p.titulo)).join(' · ') + '.', VERMELHO);
  }

  const pg = (d.pgdas || []).slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
  if (pg.length) {
    linha('PGDAS', pg.slice(0, 6).map(p => '<div>' + esc(mesBR(p.competencia)) + ': '
      + (p.transmitida_em ? 'transmitido em ' + esc(dataBR(diaEmBrasilia(p.transmitida_em))) : '<span style="color:' + VERMELHO + ';">sem transmissão</span>')
      + (p.das_pago === true ? ' · DAS pago' : p.das_pago === false ? ' · <span style="color:' + VERMELHO + ';">DAS não pago</span>' : '') + '</div>').join(''));
    const fat = pg.find(p => Number(p.receita_12_meses) > 0);
    if (fat) linha('Faturamento', 'Receita bruta de ' + esc(mesBR(fat.competencia)) + ': ' + esc(dinheiro(fat.receita_mes || 0))
      + ' · nos 12 meses anteriores: ' + esc(dinheiro(fat.receita_12_meses)) + ' (da declaração do PGDAS).');
  }

  const msgs = (d.mensagens || []).slice(0, 5);
  if (msgs.length) {
    linha('Caixa Postal', msgs.map(m => '<div>' + (m.enviada_em ? esc(dataBR(m.enviada_em)) + ' · ' : '') + esc(m && m.assunto)
      + (m.origem && m.origem !== 'Receita' ? ' (' + esc(m.origem) + ')' : '') + (m.lida === false ? ' · <b>não lida</b>' : '') + '</div>').join(''));
  }

  const consultas = [e.autorizacao_em, e.pgdas_em].map(diaEmBrasilia).filter(Boolean).sort();
  const ultima = consultas.length ? consultas[consultas.length - 1] : (e.situacao_fiscal_em || null);
  return linhas.join('') + '<div class="field-help" style="margin-top:10px;">Consultado pela ponte da Receita (Integra Contador, no PC do escritório)'
    + (ultima ? ', a última vez em ' + esc(dataBR(ultima)) : '') + '. Só consulta: nada é transmitido. O texto das mensagens fica no e-CAC.</div>';
}

/** Lê o que a ponte trouxe desta empresa. Erro na leitura: sem a seção (a ficha segue igual). */
export async function carregarReceita(supabase, clienteId) {
  try {
    const [e, p, m] = await Promise.all([
      supabase.from('receita_empresas').select('autorizacao, autorizacao_ate, autorizacao_em, pgdas_em, pendencias, situacao_fiscal_em').eq('cliente_id', clienteId).maybeSingle(),
      supabase.from('receita_pgdas').select('competencia, transmitida_em, das_pago, receita_mes, receita_12_meses').eq('cliente_id', clienteId).order('competencia', { ascending: false }).limit(12),
      supabase.from('receita_mensagens').select('assunto, enviada_em, origem, lida, recebida_em').eq('cliente_id', clienteId)
        .order('enviada_em', { ascending: false, nullsFirst: false }).order('recebida_em', { ascending: false }).limit(5)
    ]);
    if (e.error || p.error || m.error) return null;
    return { empresa: e.data || null, pgdas: p.data || [], mensagens: m.data || [] };
  } catch (err) {
    return null;
  }
}
