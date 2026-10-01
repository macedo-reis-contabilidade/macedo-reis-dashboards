import { createClient } from 'npm:@supabase/supabase-js@2';

// ============================================================
// ca-consulta — leitura avulsa do Conta Azul (pessoas e contratos) pras conferências do arquiteto.
// Criada em 01/10/2026 (conferência carteira × Conta Azul). SÓ LEITURA: não grava nada em lugar nenhum.
//  • verify_jwt = true (regra 10) e, além disso, exige a chave x-sync-key (a mesma do ca-sync, em
//    configuracoes_escritorio) — só o servidor, que conhece a chave, consegue chamar.
//  • NÃO renova o token do Conta Azul: usa o access_token que o ca-sync mantém (ele renova a cada 10 min).
//    Se o token estiver perto de vencer, recusa — assim nunca disputa a renovação com o ca-sync.
//  • Só aceita caminhos de leitura de /v1/pessoas, /v1/contratos e, desde 01/10 à tarde, a parcela por id
//    (/v1/financeiro/eventos-financeiros/parcelas/<id>) — pra conferir, uma a uma, se uma parcela do espelho
//    ca_parcelas ainda existe no Conta Azul.
// Modos (corpo JSON):
//  { modo: 'get', path, params }                       → uma chamada GET, resposta crua
//  { modo: 'todas', path, params, tamanho }            → percorre todas as páginas da lista, devolve os itens
//  { modo: 'detalhes', path_base: '/v1/pessoas', ids } → GET de cada id (4 de cada vez), devolve os itens
//                                                        (path_base também pode ser .../eventos-financeiros/parcelas)
//  { modo: 'receita', cnpjs }                          → dados públicos da Receita (BrasilAPI) de até 150 CNPJs, com o
//                                                        nome oficial do município (IBGE). Não usa o token do Conta Azul.
// ============================================================

const API = 'https://api-v2.contaazul.com';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const PERMITIDO = /^\/v1\/(pessoas|contratos)(\/[0-9a-fA-F-]{36})?$|^\/v1\/financeiro\/eventos-financeiros\/parcelas\/[0-9a-fA-F-]{36}$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function token(): Promise<string> {
  const { data: t, error } = await sb.from('ca_tokens').select('access_token, expires_at').eq('id', 1).single();
  if (error || !t) throw new Error('ca_tokens vazia');
  if (new Date(t.expires_at).getTime() - Date.now() < 3 * 60 * 1000) {
    throw new Error('token do Conta Azul perto de vencer — tente de novo em alguns minutos (o ca-sync renova)');
  }
  return t.access_token;
}

async function caGet(tk: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const r = await fetch(`${API}${path}${qs ? '?' + qs : ''}`, { headers: { Authorization: `Bearer ${tk}` } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 1500 * (tentativa + 1))); continue; }
    const txt = await r.text();
    if (!r.ok) throw new Error(`${path} respondeu ${r.status}: ${txt.slice(0, 300)}`);
    return txt ? JSON.parse(txt) : null;
  }
  throw new Error(`${path}: limite de requisições do Conta Azul`);
}

function itensDe(resp: any): any[] {
  if (Array.isArray(resp)) return resp;
  for (const k of ['items', 'itens', 'data', 'content']) if (Array.isArray(resp?.[k])) return resp[k];
  return [];
}

Deno.serve(async (req: Request) => {
  const { data: k } = await sb.from('configuracoes_escritorio').select('valor').eq('chave', 'ca_sync_key').single();
  const recebida = req.headers.get('x-sync-key') || '';
  if (!k?.valor || recebida !== k.valor) return json(401, { erro: 'chave inválida' });

  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }
  const modo = String(corpo.modo || '');

  try {
    if (modo === 'receita') {
      const brutos: unknown[] = Array.isArray(corpo.cnpjs) ? corpo.cnpjs : [];
      const cnpjs: string[] = [...new Set<string>(brutos.map((c) => String(c).replace(/\D/g, '')))]
        .filter((c: string) => c.length === 14).slice(0, 150);
      const itens: any[] = [];
      for (const c of cnpjs) {
        let j: any = null, status = 0;
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          try {
            const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + c, { headers: { 'User-Agent': 'macedo-reis-dashboards' } });
            status = r.status;
            if (r.ok) { j = await r.json(); break; }
            if (r.status === 404) break;
          } catch { status = -1; }
          await new Promise((res) => setTimeout(res, 1500 * (tentativa + 1)));
        }
        itens.push(j ? {
          cnpj: c, razao: j.razao_social ?? null, fantasia: j.nome_fantasia ?? null,
          situacao: j.descricao_situacao_cadastral ?? null, data_situacao: j.data_situacao_cadastral ?? null,
          municipio: j.municipio ?? null, uf: j.uf ?? null, ibge: j.codigo_municipio_ibge ?? null,
          simples: j.opcao_pelo_simples ?? null, mei: j.opcao_pelo_mei ?? null,
          data_exclusao_simples: j.data_exclusao_do_simples ?? null, cnae: j.cnae_fiscal ?? null,
          natureza: j.natureza_juridica ?? null, abertura: j.data_inicio_atividade ?? null,
        } : { cnpj: c, erro: status });
        await new Promise((res) => setTimeout(res, 300));
      }
      // nome oficial (com acento) dos municípios, pelo IBGE
      const ufs = [...new Set(itens.map((i) => i.uf).filter(Boolean))];
      const nomes: Record<string, string> = {};
      for (const uf of ufs) {
        try {
          const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
          if (r.ok) for (const m of await r.json()) nomes[String(m.id)] = m.nome;
        } catch { /* sem o nome oficial: fica o da Receita */ }
      }
      for (const i of itens) if (i.ibge && nomes[String(i.ibge)]) i.municipio_ibge = nomes[String(i.ibge)];
      return json(200, { recebidos: itens.length, itens });
    }

    const tk = await token();

    if (modo === 'get') {
      const path = String(corpo.path || '');
      if (!PERMITIDO.test(path)) return json(400, { erro: 'caminho não permitido' });
      return json(200, { resposta: await caGet(tk, path, corpo.params || {}) });
    }

    if (modo === 'todas') {
      const path = String(corpo.path || '');
      if (!PERMITIDO.test(path)) return json(400, { erro: 'caminho não permitido' });
      const tamanho = String(corpo.tamanho || 50);
      const itens: any[] = [];
      let total: number | null = null;
      for (let pagina = 1; pagina <= 200; pagina++) {
        const resp = await caGet(tk, path, { ...(corpo.params || {}), pagina: String(pagina), tamanho_pagina: tamanho });
        const lote = itensDe(resp);
        if (total === null) total = resp?.itens_totais ?? resp?.total ?? resp?.totalItems ?? null;
        itens.push(...lote);
        if (lote.length < Number(tamanho) || (total !== null && itens.length >= total)) break;
      }
      return json(200, { total_informado: total, recebidos: itens.length, itens });
    }

    if (modo === 'detalhes') {
      const base = String(corpo.path_base || '');
      const ids: string[] = Array.isArray(corpo.ids) ? corpo.ids.map(String) : [];
      if (!ids.length || ids.some((id) => !/^[0-9a-fA-F-]{36}$/.test(id) || !PERMITIDO.test(`${base}/${id}`))) return json(400, { erro: 'pedido não permitido' });
      const itens: any[] = [];
      const falhas: any[] = [];
      for (let i = 0; i < ids.length; i += 4) {
        const lote = ids.slice(i, i + 4);
        const res = await Promise.allSettled(lote.map((id) => caGet(tk, `${base}/${id}`)));
        res.forEach((r, j) => r.status === 'fulfilled'
          ? itens.push(r.value && typeof r.value === 'object' ? { id_pedido: lote[j], ...r.value } : { id_pedido: lote[j], resposta: r.value })
          : falhas.push({ id: lote[j], erro: String((r as PromiseRejectedResult).reason?.message || r) }));
      }
      return json(200, { recebidos: itens.length, falhas, itens });
    }

    return json(400, { erro: 'modo desconhecido' });
  } catch (e) {
    return json(500, { erro: String((e as Error)?.message || e) });
  }
});
