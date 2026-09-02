// ============================================================
// ca-sync — espelho do Conta Azul (ca_parcelas / ca_categorias)
// ATENÇÃO: este arquivo é a VERSÃO PROPOSTA (obra relatorios-vivos-acabamento).
// Ele NÃO foi implantado por aqui — o deploy é feito pelo Claude web via MCP.
// Base: código implantado v4 (lido do projeto em 02/09/2026) + realizado diário.
//
// O que mudou em relação à v4 implantada:
//   1. Passada de pagamentos POR DIA (marcarPagamentosDoDia/marcarDiasDePagamento):
//      a API do Conta Azul filtra por data_pagamento mas não devolve o campo —
//      o mesmo truque já usado no grão mês (mes_pagamento) agora grava também
//      ca_parcelas.data_pagamento, no grão dia.
//   2. No incremental, a janela diária cobre os últimos DIAS_REALIZADO dias
//      (pagamentos registrados com atraso maior entram pelo backfill).
//   3. Modo novo 'backfill_dias' (body: { modo: 'backfill_dias', dias_de, dias_ate,
//      máx. 31 dias por chamada — fatiar por mês }) para preencher o histórico.
//      O modo 'backfill' mensal NÃO preenche data_pagamento; só o backfill_dias.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api-v2.contaazul.com';
const TOKEN_URL = 'https://auth.contaazul.com/oauth2/token';
const PAGE = 500;
const VENC_LARGA_DE = '2024-01-01';
const VENC_LARGA_ATE = '2036-12-31';
const DIAS_REALIZADO = 10; // janela diária do incremental (dias pra trás, inclusive hoje)

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function spIso(d: Date): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 19);
}

function mesStr(d: Date): { ini: string; fim: string; ancora: string } {
  const a = d.getUTCFullYear(), m = d.getUTCMonth();
  const ini = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
  const fim = new Date(Date.UTC(a, m + 1, 0)).toISOString().slice(0, 10);
  return { ini, fim, ancora: ini };
}

async function tokenValido(): Promise<string> {
  const { data: t, error } = await sb.from('ca_tokens').select('*').eq('id', 1).single();
  if (error || !t) throw new Error('ca_tokens vazia — refazer a autorização OAuth');
  const faltam = new Date(t.expires_at).getTime() - Date.now();
  if (faltam > 5 * 60 * 1000) return t.access_token;

  const basic = btoa(`${Deno.env.get('CA_CLIENT_ID')}:${Deno.env.get('CA_CLIENT_SECRET')}`);
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
  });
  if (!resp.ok) throw new Error(`Refresh do token falhou: ${resp.status} ${await resp.text()}`);
  const tok = await resp.json();
  const upd: Record<string, unknown> = {
    id: 1,
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
    token_type: tok.token_type ?? 'Bearer',
    atualizado_em: new Date().toISOString()
  };
  if (tok.refresh_token) upd.refresh_token = tok.refresh_token;
  const { error: e2 } = await sb.from('ca_tokens').upsert(upd);
  if (e2) throw new Error('Falha ao gravar token renovado: ' + e2.message);
  return tok.access_token;
}

async function caGet(token: string, path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params);
  const resp = await fetch(`${API}${path}?${qs}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (resp.status === 429) { await new Promise(r => setTimeout(r, 1500)); return caGet(token, path, params); }
  if (!resp.ok) throw new Error(`${path} respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

function mapParcela(it: any, natureza: 'receita' | 'despesa') {
  return {
    id: it.id,
    natureza,
    descricao: it.descricao ?? null,
    data_vencimento: it.data_vencimento ?? null,
    data_competencia: it.data_competencia ?? null,
    status: it.status ?? null,
    status_traduzido: it.status_traduzido ?? null,
    total: it.total ?? null,
    pago: it.pago ?? null,
    nao_pago: it.nao_pago ?? null,
    fornecedor_cliente_id: it.fornecedor?.id ?? it.cliente?.id ?? null,
    fornecedor_cliente_nome: it.fornecedor?.nome ?? it.cliente?.nome ?? null,
    categorias: it.categorias ?? null,
    centros_custo: it.centros_custo ?? it.centros_de_custo ?? null,
    data_criacao: it.data_criacao ?? null,
    data_alteracao: it.data_alteracao ?? null,
    dados: it,
    sincronizado_em: new Date().toISOString()
  };
}

const PATHS = {
  receita: '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar',
  despesa: '/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar'
};

async function varrer(token: string, natureza: 'receita' | 'despesa', extra: Record<string, string>): Promise<number> {
  let pagina = 1, gravadas = 0;
  while (true) {
    const res = await caGet(token, PATHS[natureza], { pagina: String(pagina), tamanho_pagina: String(PAGE), ...extra });
    const itens = res.itens ?? [];
    if (itens.length) {
      const lote = itens.map((it: any) => mapParcela(it, natureza));
      for (let i = 0; i < lote.length; i += 500) {
        const { error } = await sb.from('ca_parcelas').upsert(lote.slice(i, i + 500));
        if (error) throw new Error(`Upsert ${natureza} falhou: ${error.message}`);
      }
      gravadas += itens.length;
    }
    if (itens.length < PAGE) break;
    pagina++;
    if (pagina > 200) throw new Error('Paginação estourou 200 páginas — abortando por segurança');
  }
  return gravadas;
}

// Passada mensal de pagamentos: zera a marca do mês e remarca com quem a API diz que foi pago nele
async function marcarPagamentosDoMes(token: string, natureza: 'receita' | 'despesa', mes: Date): Promise<number> {
  const { ini, fim, ancora } = mesStr(mes);
  const ids: string[] = [];
  let pagina = 1;
  while (true) {
    const res = await caGet(token, PATHS[natureza], {
      pagina: String(pagina), tamanho_pagina: String(PAGE),
      data_vencimento_de: VENC_LARGA_DE, data_vencimento_ate: VENC_LARGA_ATE,
      data_pagamento_de: ini, data_pagamento_ate: fim
    });
    const itens = res.itens ?? [];
    itens.forEach((it: any) => ids.push(it.id));
    if (itens.length < PAGE) break;
    pagina++;
    if (pagina > 100) throw new Error('Passada de pagamentos estourou 100 páginas');
  }
  const { error: eZera } = await sb.from('ca_parcelas').update({ mes_pagamento: null })
    .eq('natureza', natureza).eq('mes_pagamento', ancora);
  if (eZera) throw new Error('Zerar mes_pagamento falhou: ' + eZera.message);
  for (let i = 0; i < ids.length; i += 300) {
    const { error } = await sb.from('ca_parcelas').update({ mes_pagamento: ancora }).in('id', ids.slice(i, i + 300));
    if (error) throw new Error('Marcar mes_pagamento falhou: ' + error.message);
  }
  return ids.length;
}

// Passada DIÁRIA de pagamentos — a API filtra por data_pagamento mas não devolve
// o campo, então perguntamos dia a dia. Coleta os ids pagos num dia:
async function coletarIdsPagosNoDia(token: string, natureza: 'receita' | 'despesa', diaIso: string): Promise<string[]> {
  const ids: string[] = [];
  let pagina = 1;
  while (true) {
    const res = await caGet(token, PATHS[natureza], {
      pagina: String(pagina), tamanho_pagina: String(PAGE),
      data_vencimento_de: VENC_LARGA_DE, data_vencimento_ate: VENC_LARGA_ATE,
      data_pagamento_de: diaIso, data_pagamento_ate: diaIso
    });
    const itens = res.itens ?? [];
    itens.forEach((it: any) => ids.push(it.id));
    if (itens.length < PAGE) break;
    pagina++;
    if (pagina > 100) throw new Error('Passada diária de pagamentos estourou 100 páginas');
  }
  return ids;
}

// Janela [deIso, ateIso] (inclusive): COLETA tudo primeiro (nenhuma escrita antes
// de a API responder por inteiro — a mesma ordem segura da passada mensal), e só
// então zera a janela e remarca; falha de API no meio não deixa a janela vazia.
async function marcarDiasDePagamento(token: string, deIso: string, ateIso: string): Promise<number> {
  const lotes: { dia: string; ids: string[] }[] = [];
  const d = new Date(deIso + 'T00:00:00Z');
  const ate = new Date(ateIso + 'T00:00:00Z');
  while (d <= ate) {
    const dia = d.toISOString().slice(0, 10);
    for (const natureza of ['receita', 'despesa'] as const) {
      lotes.push({ dia, ids: await coletarIdsPagosNoDia(token, natureza, dia) });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  for (const natureza of ['receita', 'despesa'] as const) {
    const { error } = await sb.from('ca_parcelas').update({ data_pagamento: null })
      .eq('natureza', natureza).gte('data_pagamento', deIso).lte('data_pagamento', ateIso);
    if (error) throw new Error('Zerar data_pagamento falhou: ' + error.message);
  }
  let marcados = 0;
  for (const { dia, ids } of lotes) {
    for (let i = 0; i < ids.length; i += 300) {
      const { error } = await sb.from('ca_parcelas').update({ data_pagamento: dia }).in('id', ids.slice(i, i + 300));
      if (error) throw new Error('Marcar data_pagamento falhou: ' + error.message);
    }
    marcados += ids.length;
  }
  return marcados;
}

function mesesEntre(deIso: string, ateIso: string): Date[] {
  const out: Date[] = [];
  const de = new Date(deIso + 'T00:00:00Z'), ate = new Date(ateIso + 'T00:00:00Z');
  const d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1));
  const limite = new Date();
  while (d <= ate && d <= limite) { out.push(new Date(d)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}

async function sincronizarCategorias(token: string): Promise<number> {
  let pagina = 1, gravadas = 0;
  while (true) {
    let res: any;
    try {
      res = await caGet(token, '/v1/categorias', { pagina: String(pagina), tamanho_pagina: '200' });
    } catch (_e) {
      if (pagina === 1) { res = await caGet(token, '/v1/categorias', {}); } else throw _e;
    }
    const itens = Array.isArray(res) ? res : (res.itens ?? []);
    if (itens.length) {
      const lote = itens.map((c: any) => ({
        id: c.id,
        nome: c.nome ?? '(sem nome)',
        tipo: c.tipo ?? c.tipo_categoria ?? null,
        id_pai: c.id_pai ?? c.categoria_pai_id ?? null,
        ativo: c.ativo ?? true,
        dados: c,
        sincronizado_em: new Date().toISOString()
      }));
      const { error } = await sb.from('ca_categorias').upsert(lote);
      if (error) throw new Error('Upsert categorias falhou: ' + error.message);
      gravadas += itens.length;
    }
    if (Array.isArray(res) || itens.length < 200) break;
    pagina++;
    if (pagina > 50) break;
  }
  return gravadas;
}

Deno.serve(async (req) => {
  // Tranca (31/08/2026): só quem apresenta a chave de sincronização passa — os agendadores do banco a enviam no cabeçalho x-sync-key
  const { data: cfgKey } = await sb.from('configuracoes_escritorio').select('valor').eq('chave', 'ca_sync_key').single();
  const chaveRecebida = req.headers.get('x-sync-key') || '';
  if (!cfgKey?.valor || chaveRecebida !== cfgKey.valor) return json(401, { ok: false, motivo: 'não autorizado' });

  let body: any = {};
  try { body = await req.json(); } catch (_e) { /* corpo vazio = incremental */ }
  const modo: string = body.modo === 'backfill' ? 'backfill' : body.modo === 'backfill_dias' ? 'backfill_dias' : 'incremental';

  const { data: aberto } = await sb.from('ca_sync_log').select('id, iniciado_em').is('concluido_em', null)
    .gte('iniciado_em', new Date(Date.now() - 3 * 60 * 1000).toISOString()).limit(1);
  if (aberto && aberto.length) return json(409, { ok: false, motivo: 'sync em andamento' });
  if (modo === 'incremental') {
    const { data: ultimo } = await sb.from('ca_sync_log').select('concluido_em').eq('sucesso', true)
      .order('concluido_em', { ascending: false }).limit(1);
    if (ultimo?.[0]?.concluido_em && Date.now() - new Date(ultimo[0].concluido_em).getTime() < 2 * 60 * 1000) {
      return json(429, { ok: false, motivo: 'cooldown — último sync há menos de 2 min' });
    }
  }

  const { data: log, error: logErr } = await sb.from('ca_sync_log').insert({ tipo: modo }).select('id').single();
  if (logErr) return json(500, { ok: false, erro: 'log: ' + logErr.message });
  const logId = log.id;
  const t0 = Date.now();

  try {
    const token = await tokenValido();

    // backfill_dias: só a passada diária de pagamentos, numa janela limitada —
    // preenche data_pagamento do histórico em fatias (Claude web roda mês a mês).
    if (modo === 'backfill_dias') {
      const de = String(body.dias_de || '');
      const ate = String(body.dias_ate || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        throw new Error('backfill_dias exige dias_de e dias_ate (YYYY-MM-DD, de <= ate)');
      }
      const nDias = Math.round((new Date(ate + 'T00:00:00Z').getTime() - new Date(de + 'T00:00:00Z').getTime()) / 86400000) + 1;
      // 31 dias por chamada: mantém a execução dentro dos 3 minutos da tranca
      // anti-concorrência (o cron incremental de 10 em 10 min não entra junto).
      if (nDias > 31) throw new Error('backfill_dias limitado a 31 dias por chamada — fatie por mês');
      const pagamentosDia = await marcarDiasDePagamento(token, de, ate);
      await sb.from('ca_sync_log').update({
        concluido_em: new Date().toISOString(),
        janela_de: new Date(de + 'T00:00:00-03:00').toISOString(),
        janela_ate: new Date(ate + 'T23:59:59-03:00').toISOString(),
        parcelas_upsert: 0,
        categorias_upsert: 0,
        sucesso: true
      }).eq('id', logId);
      return json(200, { ok: true, modo, dias: nDias, pagamentosDia, ms: Date.now() - t0 });
    }

    const extra: Record<string, string> = {};
    let janelaDe: string | null = null, janelaAte: string | null = null;
    let mesesPagamento: Date[] = [];

    if (modo === 'backfill') {
      extra.data_vencimento_de = body.venc_de ?? '2025-01-01';
      extra.data_vencimento_ate = body.venc_ate ?? '2036-12-31';
      janelaDe = extra.data_vencimento_de; janelaAte = extra.data_vencimento_ate;
      mesesPagamento = mesesEntre(extra.data_vencimento_de, extra.data_vencimento_ate);
    } else {
      const { data: base } = await sb.from('ca_sync_log').select('iniciado_em').eq('sucesso', true)
        .order('iniciado_em', { ascending: false }).limit(1);
      const desde = base?.[0]?.iniciado_em ? new Date(new Date(base[0].iniciado_em).getTime() - 15 * 60 * 1000) : new Date(Date.now() - 24 * 3600 * 1000);
      extra.data_vencimento_de = VENC_LARGA_DE;
      extra.data_vencimento_ate = VENC_LARGA_ATE;
      extra.data_alteracao_de = spIso(desde);
      extra.data_alteracao_ate = spIso(new Date());
      janelaDe = extra.data_alteracao_de; janelaAte = extra.data_alteracao_ate;
      const agora = new Date();
      const anterior = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
      mesesPagamento = [anterior, agora];
    }

    const receitas = await varrer(token, 'receita', extra);
    const despesas = await varrer(token, 'despesa', extra);

    let pagamentosMarcados = 0;
    for (const mes of mesesPagamento) {
      pagamentosMarcados += await marcarPagamentosDoMes(token, 'receita', mes);
      pagamentosMarcados += await marcarPagamentosDoMes(token, 'despesa', mes);
    }

    // Realizado diário: SÓ no incremental, remarcando os últimos DIAS_REALIZADO
    // dias (datas no fuso de SP, como o resto do arquivo). O modo backfill mensal
    // NÃO roda esta passada — histórico de data_pagamento é papel do backfill_dias.
    let pagamentosDia = 0;
    // Calibração (Claude web, 02/09/2026): a passada diária roda UMA vez por hora
    // (na rodada do cron que cai no minuto < 10), não a cada 10 min — mesma janela
    // de DIAS_REALIZADO dias, custo de API ~480 chamadas/dia em vez de ~2.880.
    const rodaDiario = new Date().getUTCMinutes() < 10;
    if (modo === 'incremental' && rodaDiario) {
      const hojeSp = spIso(new Date()).slice(0, 10);
      const deSp = new Date(new Date(hojeSp + 'T00:00:00Z').getTime() - (DIAS_REALIZADO - 1) * 86400000).toISOString().slice(0, 10);
      pagamentosDia = await marcarDiasDePagamento(token, deSp, hojeSp);
      // Reconciliação grão dia × grão mês: se a passada mensal desmarcou o mês de
      // um pagamento antigo (estorno/mudança fora da janela diária), o dia órfão
      // não pode sobreviver contradizendo o mês.
      for (const natureza of ['receita', 'despesa'] as const) {
        const { error } = await sb.from('ca_parcelas').update({ data_pagamento: null })
          .eq('natureza', natureza).is('mes_pagamento', null).not('data_pagamento', 'is', null);
        if (error) throw new Error('Reconciliar data_pagamento falhou: ' + error.message);
      }
    }

    const categorias = modo === 'backfill' || Math.random() < 0.1 ? await sincronizarCategorias(token) : 0;

    await sb.from('ca_sync_log').update({
      concluido_em: new Date().toISOString(),
      janela_de: janelaDe ? new Date(janelaDe + (janelaDe.length === 10 ? 'T00:00:00-03:00' : '-03:00')).toISOString() : null,
      janela_ate: janelaAte ? new Date(janelaAte + (janelaAte.length === 10 ? 'T23:59:59-03:00' : '-03:00')).toISOString() : null,
      parcelas_upsert: receitas + despesas,
      categorias_upsert: categorias,
      sucesso: true
    }).eq('id', logId);

    return json(200, { ok: true, modo, receitas, despesas, pagamentosMarcados, pagamentosDia, categorias, ms: Date.now() - t0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('ca_sync_log').update({ concluido_em: new Date().toISOString(), sucesso: false, erro: msg }).eq('id', logId);
    return json(500, { ok: false, modo, erro: msg, ms: Date.now() - t0 });
  }
});
