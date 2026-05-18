// ============================================================
// MACEDO & REIS - Cliente Supabase
// Configuração única reutilizada por todas as páginas
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ltsujjgzlhaxosbeudgg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EBZiUJpAMDRQUjevgJv99A_oZ7jQxnR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helpers de autenticação
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/macedo-reis-dashboards/login.html';
}
