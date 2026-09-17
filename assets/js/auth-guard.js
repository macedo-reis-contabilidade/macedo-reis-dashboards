// ============================================================
// MACEDO & REIS - Auth Guard
// Protege páginas exigindo sessão ativa do Supabase
// ============================================================

import { supabase } from './supabase.js';
import './autogrow.js'; // textareas crescem com o texto em todo o sistema
import './theme.js';    // tema claro/escuro (interruptor no topo, escolha por navegador)

document.documentElement.style.visibility = 'hidden';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/macedo-reis-dashboards/login.html?redirect=' + redirect;
  } else {
    document.documentElement.style.visibility = 'visible';
  }
})();
