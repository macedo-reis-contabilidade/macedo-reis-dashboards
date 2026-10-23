// ============================================================
// MACEDO & REIS - Cliente Supabase
// Usando legacy anon key (JWT) — compatibilidade máxima com Auth
// ============================================================

// supabase-js com a versão fixa. O "@2" sem versão pegava sempre a última publicada: em 15/10/2026, às 09:57, saiu a
// 2.118.0 e o sistema inteiro parou de carregar. Troca de versão só de propósito, testando antes.
// Primeiro o esm.sh; se ele falhar ou demorar mais de 10 s, o jsDelivr, com a mesma versão.
const VERSAO_SUPABASE = '2.117.3';
const FONTES_SUPABASE = [
  'https://esm.sh/@supabase/supabase-js@' + VERSAO_SUPABASE,
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@' + VERSAO_SUPABASE + '/+esm',
];
async function carregarSupabase() {
  let ultimoErro = null;
  for (const url of FONTES_SUPABASE) {
    try {
      return await Promise.race([
        import(url),
        new Promise((_, falhar) => setTimeout(() => falhar(new Error('tempo esgotado: ' + url)), 10000)),
      ]);
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro;
}
const { createClient } = await carregarSupabase();

const SUPABASE_URL = 'https://ltsujjgzlhaxosbeudgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0c3Vqamd6bGhheG9zYmV1ZGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTk1NDksImV4cCI6MjA5NDQzNTU0OX0.vShdPB7s30hsD6609909UrzjyQzFargV9R9BAk2rPhI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  // a conversa do assistente de canto guardada na aba (assets/js/assistente.js, "mr_assistente:<id>") não passa pra quem
  // entrar depois na mesma aba
  try { Object.keys(sessionStorage).filter(k => k.startsWith('mr_assistente:')).forEach(k => sessionStorage.removeItem(k)); } catch (e) { /* sem armazenamento */ }
  // e os atalhos do alto guardados na aba (assets/js/atalhos.js), que levam o endereço da pasta do Drive
  try { sessionStorage.removeItem('mr_atalhos'); } catch (e) { /* sem armazenamento */ }
  // esta tela sai por conta própria: o auth-guard.js não a manda de novo pro entrar com o aviso da sessão encerrada
  window.__mrSaindo = true;
  // "Sair" encerra a sessão só neste navegador (21/10/2026). O padrão do Supabase é encerrar em todos: o Sair num
  // computador derrubava as telas da mesma pessoa abertas nos outros, que seguiam abertas sem login — sem o chat e sem
  // os avisos (a tela da Adaini no escritório, depois de um Sair fora dele)
  await supabase.auth.signOut({ scope: 'local' });
  window.location.href = '/macedo-reis-dashboards/login.html';
}


// Busca paginada da tabela clientes: o PostgREST devolve no máximo 1000 linhas
// por chamada, e a base passou de 1000 registros — sem isso, o fim do alfabeto
// some silenciosamente das telas. Busca em lotes até o fim, preservando o shape { data, error }.
supabase.todosClientes = async function (cols, filtro) {
  const tudo = [];
  for (let i = 0; ; i += 1000) {
    let q = supabase.from('clientes').select(cols).order('nome_principal').range(i, i + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) return { data: tudo, error };
    tudo.push(...(data || []));
    if (!data || data.length < 1000) return { data: tudo, error: null };
  }
};

// Versão genérica pra qualquer tabela que cresce (itens de nota, documentos…): recebe
// uma função que monta a query (from + select + filtros + ORDER estável) e busca em
// lotes de 1000 até o fim. Ex.: supabase.todasLinhas(() => supabase.from('nf_itens').select('*').eq('documento_id', id).order('n_item'))
supabase.todasLinhas = async function (montar) {
  const tudo = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await montar().range(i, i + 999);
    if (error) return { data: tudo, error };
    tudo.push(...(data || []));
    if (!data || data.length < 1000) return { data: tudo, error: null };
  }
};
