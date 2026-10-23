// ============================================================
// MACEDO & REIS — Os atalhos do alto das telas (23/10/2026, pedido do Samuel: diminuir o número de abas abertas)
// O Onvio, o Drive e o webmail, com o ícone de cada um, logo depois do "Macedo & Reis", em todas as telas com login:
// quem monta é o auth-guard.js, depois de conferir a sessão (as telas públicas — admissão, rescisão, proposta — e o
// login não o carregam). A lista fica no banco (configuracoes_escritorio, chave 'atalhos', lida pela policy
// configuracoes_ler), não aqui: o link do Drive leva o código da pasta, e este repositório é público. Cada item:
// { nome, url, icone } — o ícone é um arquivo de assets/atalhos/. Só endereço http(s); abre em aba nova. A última
// lista lida fica na aba do navegador (sessionStorage 'mr_atalhos', que o "Sair" apaga), pra trocar de tela sem os
// ícones piscarem. Estilos no style.css (.tb-atalhos). Testes: tests/atalhos.test.mjs e tests/harness/atalhos.py.
// ============================================================

export const CHAVE_CACHE = 'mr_atalhos';

const ehLink = u => {
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') && !!x.hostname; } catch (e) { return false; }
};

/** A lista guardada no banco (o texto JSON), só com os itens válidos: nome, endereço http(s) e o arquivo do ícone. */
export function lerAtalhos(valor) {
  let lista;
  try { lista = typeof valor === 'string' ? JSON.parse(valor) : valor; } catch (e) { return []; }
  if (!Array.isArray(lista)) return [];
  return lista
    .map(a => ({
      nome: String((a && a.nome) || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      url: String((a && a.url) || '').trim(),
      icone: String((a && a.icone) || '').trim()
    }))
    .filter(a => a.nome && ehLink(a.url) && /^[a-z0-9][a-z0-9_-]{0,40}\.(png|svg|webp)$/i.test(a.icone))
    .slice(0, 8);
}

/** Põe (ou troca) os atalhos na barra do alto, logo depois da marca. Lista vazia tira. Devolve o <nav> ou null. */
export function montarAtalhos(lista, doc = document) {
  const barra = doc.querySelector('.topbar');
  const marca = barra && barra.querySelector('.topbar-brand');
  if (!marca) return null;
  let nav = barra.querySelector('.tb-atalhos');
  if (!lista || !lista.length) { if (nav) nav.remove(); return null; }
  if (!nav) {
    nav = doc.createElement('nav');
    nav.className = 'tb-atalhos';
    nav.setAttribute('aria-label', 'Atalhos');
    marca.after(nav);
  }
  nav.replaceChildren(...lista.map(a => {
    const link = doc.createElement('a');
    link.className = 'tb-atalho';
    link.href = a.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = a.nome + ' (abre em nova aba)';
    const img = doc.createElement('img');
    img.src = new URL('../atalhos/' + a.icone, import.meta.url).href;
    img.alt = '';
    img.width = 26;
    img.height = 26;
    const nome = doc.createElement('span');
    nome.textContent = a.nome;
    link.append(img, nome);
    return link;
  }));
  return nav;
}

/** Lê a lista (primeiro a guardada na aba, depois a do banco) e monta. Erro aqui não derruba a tela. */
export async function iniciarAtalhos(supabase) {
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  let antes = null;
  try { antes = sessionStorage.getItem(CHAVE_CACHE); } catch (e) { /* sem armazenamento */ }
  if (antes) montarAtalhos(lerAtalhos(antes));
  try {
    const { data, error } = await supabase.from('configuracoes_escritorio').select('chave, valor').eq('chave', 'atalhos').maybeSingle();
    if (error) return;
    const valor = (data && data.valor) || '[]';
    if (valor === antes) return;
    montarAtalhos(lerAtalhos(valor));
    try { sessionStorage.setItem(CHAVE_CACHE, valor); } catch (e) { /* sem armazenamento */ }
  } catch (e) { /* sem os atalhos, a tela segue igual */ }
}
