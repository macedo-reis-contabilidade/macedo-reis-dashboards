// ============================================================
// MACEDO & REIS - Auto-crescimento de textareas (todo o sistema)
// Carregado pelo auth-guard: em vez de barra de rolagem interna, o campo
// acompanha o texto — ao abrir a página, ao digitar e quando uma ficha
// preenche o valor por código. O min-height do CSS (ou o rows) é o piso.
// Opt-out pontual: <textarea data-no-autogrow>.
// ============================================================

const MARCADOS = new WeakSet();

function ajustar(ta) {
  if (!(ta instanceof HTMLTextAreaElement) || ta.dataset.noAutogrow !== undefined) return;
  if (!ta.isConnected || ta.offsetParent === null) return; // invisível: mede quando aparecer
  if (!MARCADOS.has(ta)) { MARCADOS.add(ta); ta.style.overflowY = 'hidden'; ta.dataset.autogrow = '1'; }
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight + 2) + 'px';
}

function ajustarTodos() {
  document.querySelectorAll('textarea').forEach(ajustar);
}

// digitação
document.addEventListener('input', e => { if (e.target instanceof HTMLTextAreaElement) ajustar(e.target); });

// valor preenchido por código (ficha que abre com dados) não dispara 'input'
const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
if (desc && desc.set) {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); const ta = this; requestAnimationFrame(() => ajustar(ta)); },
    configurable: true
  });
}

// textareas novos ou que ficaram visíveis (modais, overlays, abas) — ignora as
// mutações que o próprio ajuste provoca nos textareas, senão vira laço
let agendado = false;
const mo = new MutationObserver(muts => {
  if (agendado) return;
  for (const m of muts) {
    if (m.target instanceof HTMLTextAreaElement) continue;
    if (m.type === 'childList' ? m.addedNodes.length > 0 : true) { agendado = true; break; }
  }
  if (agendado) requestAnimationFrame(() => { agendado = false; ajustarTodos(); });
});
mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });

document.addEventListener('DOMContentLoaded', ajustarTodos);
window.addEventListener('load', ajustarTodos);
window.addEventListener('resize', ajustarTodos);
