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
    vigiarSessao(session.user && session.user.email);
    // o assistente do escritório: o mesmo balão em todas as telas com login (sem ele, a tela segue igual)
    import('./assistente-escritorio.js').then(m => m.iniciarAssistente({ email: session.user && session.user.email })).catch(() => {});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarTrocaDeSenha); else ligarTrocaDeSenha();
  }
})();

// a tela que perde o login com ela aberta (21/10/2026): o "Sair" em outra aba deste navegador, a sessão que não renova
// mais (encerrada em outro lugar, a senha trocada em outro computador). Antes ela seguia aberta, parecendo normal, mas
// sem o chat, os avisos e o bipe — o caso da tela da Adaini, que passou a manhã assim. Agora volta pro entrar, com o
// aviso de que a sessão terminou, e de lá pra cá; outra pessoa entrou neste navegador: a tela recarrega com ela
function vigiarSessao(email) {
  const eu = String(email || '').toLowerCase();
  try {
    supabase.auth.onAuthStateChange((evento, sessao) => {
      if (window.__mrSaindo) return;   // o "Sair" desta tela (signOut, em supabase.js) já leva pro entrar
      if (evento === 'SIGNED_OUT') {
        const u = new URL(LOGIN);
        u.searchParams.set('saiu', '1');
        u.searchParams.set('redirect', aqui());
        window.location.replace(u.href);
        return;
      }
      const quem = String((sessao && sessao.user && sessao.user.email) || '').toLowerCase();
      if (quem && eu && quem !== eu) window.location.reload();
    });
  } catch (e) { /* sem o aviso da sessão, a tela segue como antes */ }
}

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
