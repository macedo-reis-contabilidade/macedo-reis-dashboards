// ============================================================
// MACEDO & REIS — Edge Function ponte: a porta de entrada dos pacotes da ponte do PC do escritório (23/10/2026)
// verify_jwt = true (regra 10): a ponte manda a chave anônima no Authorization e a chave da ponte no cabeçalho x-chave.
// A chave da ponte nasce no PC da ponte e nunca sai de lá: o sistema guarda só a impressão digital dela (SHA-256, em
// configuracoes_escritorio.ponte_chave_sha256, que só o servidor lê). Vazia = a ponte ainda não foi instalada: 503.
// Corpo:
//   { versao: 1, ping: true }                                 → 200, sem gravar (o "conferir" da ponte)
//   { versao: 1, tipo: 'receita', pedir: 'empresas' }        → os clientes de hoje da carteira que a ponte consulta
//   { versao: 1, tipo: 'receita', rodada, empresas, faltou } → o pacote da Receita, gravado pelo banco (receita_gravar);
//                                                              do ambiente de demonstração, nada é gravado; o bloco de
//                                                              uma empresa fora do contrato fica de fora sozinho e volta
//                                                              em `recusadas` (a rodada não trava por causa dele)
//   o pacote do Domínio (sem tipo)                            → 422: o recebimento dele ainda não foi ligado
// Respostas que a ponte entende (ponte/envio.py): 2xx foi · 4xx recusado (não repete) · 5xx tenta de novo.
// Puro: env, banco e relógio injetados (index.ts monta). Testes: tests/ponte-funcao.test.mjs.
// ============================================================
import { validarPacote, empresasDaCarteira, hojeEmBrasilia, sha256Hex, iguais, LIMITES } from './receita.js';

const CABECALHOS = { 'Content-Type': 'application/json' };
const resposta = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CABECALHOS });

async function empresasParaConsultar(db, agora) {
  const { data: k, error: e1 } = await db.from('carteira_info').select('cliente_id, entrada, saida').not('entrada', 'is', null);
  if (e1) throw e1;
  const ids = [...new Set((k || []).map(x => x.cliente_id).filter(Boolean))];
  const clientes = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('clientes').select('id, documento, regime_tributario').in('id', ids.slice(i, i + 100));
    if (error) throw error;
    clientes.push(...(data || []));
  }
  return empresasDaCarteira(k, clientes, hojeEmBrasilia(agora()));
}

export function criarServidor({ criarDb, agora = () => Date.now() }) {
  return async function atender(req) {
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
    const bruto = await req.text();
    if (bruto.length > LIMITES.corpo) return resposta({ erro: 'Pacote grande demais.' }, 413);
    const db = criarDb();
    // a chave da ponte: só a impressão digital fica no sistema
    const { data: cfg, error: eCfg } = await db.from('configuracoes_escritorio').select('valor').eq('chave', 'ponte_chave_sha256').maybeSingle();
    if (eCfg) { console.error('ponte: configuração', eCfg); return resposta({ erro: 'Não consegui ler a configuração agora. Tente de novo.' }, 500); }
    const esperada = String((cfg && cfg.valor) || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(esperada)) return resposta({ erro: 'A chave da ponte ainda não foi cadastrada no sistema.' }, 503);
    const chave = req.headers.get('x-chave') || '';
    if (!chave || !iguais(await sha256Hex(chave), esperada)) return resposta({ erro: 'Chave da ponte recusada.' }, 401);

    let corpo;
    try { corpo = JSON.parse(bruto); } catch { return resposta({ erro: 'O corpo não é um JSON.' }, 400); }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return resposta({ erro: 'O corpo não é um objeto.' }, 400);
    if (corpo.versao !== 1) return resposta({ erro: 'Versão do pacote desconhecida (esta função lê a 1).' }, 422);
    try {
      if (corpo.ping === true) return resposta({ ok: true, ponte: 'ok' });
      if (corpo.tipo === 'receita' && corpo.pedir === 'empresas') {
        return resposta({ empresas: await empresasParaConsultar(db, agora) });
      }
      if (corpo.tipo === 'receita') {
        const v = validarPacote(corpo);
        if (!v.ok) return resposta({ erro: 'Pacote da Receita recusado: ' + v.erro + ' (' + v.campo + ').' }, 422);
        // o que ficou de fora (um bloco de uma empresa fora do contrato) volta pra ponte anotar no log; o resto segue
        if (v.pacote.rodada.ambiente !== 'producao') {
          return resposta({ ok: true, gravado: false, motivo: 'Pacote do ambiente de demonstração: nada foi gravado.', recusadas: v.recusadas });
        }
        const { data, error } = await db.rpc('receita_gravar', { p: v.pacote });
        if (error) throw error;
        return resposta({ ok: true, gravado: true, ...(data || {}), recusadas: v.recusadas });
      }
      if (corpo.tipo == null && Array.isArray(corpo.mensal)) {
        return resposta({ erro: 'O recebimento do Domínio ainda não foi ligado no sistema.' }, 422);
      }
      return resposta({ erro: 'Nada pra fazer com este pacote.' }, 422);
    } catch (e) {
      console.error('ponte:', e);
      return resposta({ erro: 'Não gravei agora. A ponte tenta de novo.' }, 500);
    }
  };
}
