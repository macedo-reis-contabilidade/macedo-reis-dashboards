// ============================================================
// MACEDO & REIS - Auth Guard
// Protege páginas exigindo sessão ativa do Supabase
// Incluir como primeiro script nas páginas protegidas
// ============================================================

import { supabase } from './supabase.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Redireciona pro login preservando o destino
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/macedo-reis-dashboards/login.html?redirect=${redirect}`;
  } else {
    // Exibe a página depois de validar sessão
    document.documentElement.style.visibility = 'visible';
  }
})();

// Esconde o conteúdo até a validação terminar (evita flash de página protegida)
document.documentElement.style.visibility = 'hidden';
