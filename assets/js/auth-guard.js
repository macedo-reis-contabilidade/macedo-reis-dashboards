// ============================================================
// MACEDO & REIS - Auth Guard
// Protege páginas exigindo sessão ativa do Supabase
// ============================================================

import { supabase } from './supabase.js';
import { precisaTrocar } from './senha.js';
import './autogrow.js'; // textareas crescem com o texto em todo o sistema
import './theme.js';    // tema claro/escuro (interruptor no topo, escolha por navegador)
import './janelas.js';  // Esc fecha a janela aberta que está por cima

document.documentElement.style.visibility = 'hidden';

// a tela de entrar, a partir deste arquivo (vale no site e nos testes, que servem o site em outra pasta)
const LOGIN = new URL('../../login.html', import.meta.url);
const aqui = () => window.location.pathname + window.location.search;

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/macedo-reis-dashboards/login.html?redirect=' + redirect;
  } else if (precisaTrocar(session.user)) {
    // a conta ainda com a senha provisória (21/10/2026): primeiro a senha nova — a tela de entrar pede e volta pra cá
    const u = new URL(LOGIN);
    u.searchParams.set('redirect', aqui());
    window.location.replace(u.href);
  } else {
    document.documentElement.style.visibility = 'visible';
    // o assistente do escritório: o mesmo balão em todas as telas com login (sem ele, a tela segue igual)
    import('./assistente-escritorio.js').then(m => m.iniciarAssistente({ email: session.user && session.user.email })).catch(() => {});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarTrocaDeSenha); else ligarTrocaDeSenha();
  }
})();

// trocar a própria senha (21/10/2026): o nome de quem entrou, no alto da tela, abre a troca e volta pra esta tela
function ligarTrocaDeSenha() {
  const chip = document.querySelector('.topbar .user-chip');
  if (!chip || chip.hasAttribute('role')) return;
  const ir = () => {
    const u = new URL(LOGIN);
    u.searchParams.set('trocar', '1');
    u.searchParams.set('redirect', aqui());
    window.location.href = u.href;
  };
  chip.setAttribute('role', 'link');
  chip.tabIndex = 0;
  chip.title = 'Trocar minha senha';
  chip.addEventListener('click', ir);
  chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
}
