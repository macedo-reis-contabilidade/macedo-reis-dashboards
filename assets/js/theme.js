// ============================================================
// MACEDO & REIS - Tema claro / escuro
// Escolha por navegador (localStorage 'mr_tema'); padrão: escuro.
// Importado pelo auth-guard, então roda em todas as telas antes de
// a página aparecer (sem piscar) e injeta o interruptor no topo.
// ============================================================
const CHAVE = 'mr_tema';
const root = document.documentElement;

function temaAtual(){
  try { return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'; } catch { return 'escuro'; }
}
function aplicar(tema){
  if (tema === 'claro') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
  root.style.colorScheme = tema === 'claro' ? 'light' : 'dark';
  document.querySelectorAll('.tema-btn').forEach(b => {
    b.textContent = tema === 'claro' ? '🌙' : '☀️';
    b.title = tema === 'claro' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
    b.setAttribute('aria-label', b.title);
  });
}
export function alternarTema(){
  const novo = temaAtual() === 'claro' ? 'escuro' : 'claro';
  try { localStorage.setItem(CHAVE, novo); } catch {}
  aplicar(novo);
}

aplicar(temaAtual());

function injetar(){
  const acoes = document.querySelector('.topbar-actions');
  if (!acoes || acoes.querySelector('.tema-btn')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tema-btn';
  b.addEventListener('click', alternarTema);
  acoes.prepend(b);
  aplicar(temaAtual());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injetar); else injetar();
