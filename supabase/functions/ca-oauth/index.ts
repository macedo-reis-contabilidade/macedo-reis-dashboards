import { createClient } from 'npm:@supabase/supabase-js@2';

// ca-oauth — porta da conexão Conta Azul dos Relatórios Vivos (OAuth do app de produção).
// verify_jwt = false de propósito: quem chega aqui é o navegador voltando do login do Conta Azul, sem sessão nossa.
//
// v3 (01/10/2026, auditoria de segurança):
//  • a volta do Conta Azul só é aceita quando o `state` confere com a chave guardada em
//    configuracoes_escritorio ('ca_oauth_state') — ninguém de fora consegue trocar a conta conectada;
//  • link de reconexão: .../ca-oauth?iniciar=<chave> → confere a chave e manda pro login do Conta Azul já com o
//    state certo (o client_id sai do cofre de secrets, nunca do link);
//  • respostas em texto puro: o Supabase reescreve text/html pra text/plain nos GET, então o HTML de antes
//    aparecia como código. Texto puro também tira qualquer chance de injeção pelo parâmetro `error`.

const REDIRECT_URI = 'https://ltsujjgzlhaxosbeudgg.supabase.co/functions/v1/ca-oauth';
const AUTORIZACAO = 'https://auth.contaazul.com/oauth2/authorize';
const ESCOPO = 'openid profile aws.cognito.signin.user.admin';

function resposta(titulo: string, corpo: string, ok: boolean): Response {
  const texto = `${titulo}\n\n${corpo}\n\n— Macedo & Reis · Relatórios Vivos\n`;
  return new Response(texto, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres acertou)
function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const erro = url.searchParams.get('error');
  const state = url.searchParams.get('state') ?? '';
  const iniciar = url.searchParams.get('iniciar');

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const chaveGuardada = async (): Promise<string> => {
    const { data } = await sb.from('configuracoes_escritorio').select('valor').eq('chave', 'ca_oauth_state').maybeSingle();
    const v = String(data?.valor ?? '').trim();
    return v.length >= 32 ? v : '';
  };

  if (erro) {
    return resposta('Autorização negada', `O Conta Azul retornou: ${erro.slice(0, 200)}. Feche esta aba e tente de novo pelo link de reconexão.`, false);
  }

  if (iniciar !== null) {
    const chave = await chaveGuardada();
    if (!iguais(iniciar, chave)) {
      return resposta('Link de reconexão inválido', 'Este link não abre a conexão com o Conta Azul. Peça o link de reconexão atualizado ao Claude.', false);
    }
    const cid = Deno.env.get('CA_CLIENT_ID');
    if (!cid) return resposta('Cofre incompleto', 'CA_CLIENT_ID não encontrado nos secrets do projeto.', false);
    const destino = `${AUTORIZACAO}?${new URLSearchParams({ response_type: 'code', client_id: cid, redirect_uri: REDIRECT_URI, state: chave, scope: ESCOPO })}`;
    return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
  }

  if (!code) {
    return resposta('Porta da conexão Conta Azul', 'Esta é a porta de entrada da conexão dos Relatórios Vivos. Nada acontece por aqui sem o link de reconexão.', false);
  }

  const chave = await chaveGuardada();
  if (!iguais(state, chave)) {
    console.warn('ca-oauth: volta recusada (state não confere)');
    return resposta('Autorização recusada', 'Esta volta do Conta Azul não saiu do link de reconexão do escritório, então nada foi gravado e a conexão atual continua como estava.', false);
  }

  const cid = Deno.env.get('CA_CLIENT_ID');
  const csec = Deno.env.get('CA_CLIENT_SECRET');
  if (!cid || !csec) {
    return resposta('Cofre incompleto', 'CA_CLIENT_ID e/ou CA_CLIENT_SECRET não encontrados nos secrets do projeto.', false);
  }

  const basic = btoa(`${cid}:${csec}`);
  const resp = await fetch('https://auth.contaazul.com/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
  });

  if (!resp.ok) {
    const detalhe = await resp.text();
    console.error('Troca de token falhou:', resp.status, detalhe);
    return resposta('Troca de token falhou', `O Conta Azul respondeu ${resp.status}. O código de autorização vale 3 minutos e é de uso único — abra o link de reconexão de novo e tente outra vez.`, false);
  }

  const tok = await resp.json();
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();

  const { error: dbErr } = await sb.from('ca_tokens').upsert({
    id: 1,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: expiresAt,
    token_type: tok.token_type ?? 'Bearer',
    atualizado_em: new Date().toISOString(),
  });

  if (dbErr) {
    console.error('Gravação do token falhou:', dbErr);
    return resposta('Gravação falhou', `Recebi os tokens do Conta Azul, mas não consegui guardá-los: ${dbErr.message}`, false);
  }

  return resposta('✅ Conta Azul conectada', 'A ponte dos Relatórios Vivos está de pé. Pode fechar esta aba — daqui em diante a renovação e a sincronização acontecem sozinhas.', true);
});
