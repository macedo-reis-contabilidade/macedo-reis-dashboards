// ============================================================
// MACEDO & REIS - Cliente Supabase
// Usando legacy anon key (JWT) — compatibilidade máxima com Auth
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ltsujjgzlhaxosbeudgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0c3Vqamd6bGhheG9zYmV1ZGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTk1NDksImV4cCI6MjA5NDQzNTU0OX0.vShdPB7s30hsD6609909UrzjyQzFargV9R9BAk2rPhI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
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
