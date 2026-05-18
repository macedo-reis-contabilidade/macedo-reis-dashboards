// ============================================================
// MACEDO & REIS - Auth Guard
// Protege páginas exigindo sessão ativa do Supabase
// ============================================================

import { supabase } from './supabase.js';

document.documentElement.style.visibility = 'hidden';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = '/macedo-reis-dashboards/login.html?redirect=' + redirect;
  } else {
    document.documentElement.style.visibility = 'visible';
  }
})();
