// ============================================================
// MACEDO & REIS — Janelas: Esc fecha a que está por cima
// Importado pelo auth-guard, igual ao theme.js: vale em toda tela com login.
//
// Não fecha na marra. Acha a janela aberta que está por cima e clica no
// fechar dela mesma (× ou "Cancelar") — assim cada tela faz a limpeza
// dela, exatamente como no clique do mouse (limpar caixas, soltar a
// tarefa em edição, etc.).
//
// "Janela" aqui é qualquer camada position:fixed que cobre a tela: as
// .fa-modal-overlay do motor de tarefas, o #rvOv das tarefas recorrentes,
// o #ntOverlay da Nova tarefa, as .ov / .rg-ov / .vo-overlay / .imp-overlay
// das outras telas e os modais soltos com style="position:fixed;inset:0".
// Como a conta é por estilo aplicado, e não por lista de nomes, janela
// nova entra sozinha — só precisa ter um botão de fechar dentro.
//
// Sem janela aberta, Esc não faz nada: as edições em linha que já usam
// Esc (ex.: responsável em Obrigações fiscais) continuam iguais.
// ============================================================

const FECHAR_SELETOR = ['[data-janela-fechar]', '.fa-modal-close', '.modal-close', '.imp-close'];
const SIMBOLO_X = /^[×✕✖]$/;
const FECHAR_TEXTO = ['fechar', 'cancelar'];

function visivel(el) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

// cobre a tela inteira, está visível e dá pra clicar: é uma janela aberta
function ehJanela(el) {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed' || cs.pointerEvents === 'none') return false;
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
}

function camada(el) {
  const z = parseInt(getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

function janelaDeCima() {
  const abertas = [...document.body.querySelectorAll('div, dialog, section, aside')].filter(ehJanela);
  if (!abertas.length) return null;
  // a de cima é a de maior z-index; empatou, vale a última que entrou na página
  return abertas.reduce((a, b) => (camada(b) >= camada(a) ? b : a));
}

function fecharJanela(janela) {
  for (const sel of FECHAR_SELETOR) {
    const b = janela.querySelector(sel);
    if (b && visivel(b)) { b.click(); return true; }
  }
  const botoes = [...janela.querySelectorAll('button, .btn-link, [role="button"]')].filter(visivel);
  // "✕ Fechar" conta como Fechar; o × sozinho conta como o × do cabeçalho
  const rotulo = b => (b.textContent || '').replace(/[×✕✖]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const b = botoes.find(x => SIMBOLO_X.test((x.textContent || '').trim()))
         || botoes.find(x => FECHAR_TEXTO.includes(rotulo(x)));
  if (b) { b.click(); return true; }
  return false;   // janela sem fechar próprio (ex.: o fundo do tour): não mexe
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return;
  const janela = janelaDeCima();
  if (janela && fecharJanela(janela)) e.preventDefault();
});
