// ============================================================
// MACEDO & REIS - Auth Guard
// Protege páginas exigindo sessão ativa do Supabase
// ============================================================

import { supabase } from './supabase.js';
import './autogrow.js'; // textareas crescem com o texto em todo o sistema
import './theme.js';    // tema claro/escuro (interruptor no topo, escolha por navegador)
import './janelas.js';  // Esc fecha a janela aberta que está por cima

document.documentElement.style.visibility = 'hidden';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/macedo-reis-dashboards/login.html?redirect=' + redirect;
  } else {
    document.documentElement.style.visibility = 'visible';
    // o assistente do escritório: o mesmo balão em todas as telas com login (sem ele, a tela segue igual)
    import('./assistente-escritorio.js').then(m => m.iniciarAssistente({ email: session.user && session.user.email })).catch(() => {});
  }
})();
