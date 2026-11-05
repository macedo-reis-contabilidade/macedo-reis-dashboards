// ============================================================
// MACEDO & REIS — A equipe: os nomes dos selects de responsável e quem é quem pelo e-mail do login
// Usado pelo assistente do escritório (assets/js/assistente-escritorio.js e a função assistente). Edna não tem login.
// A Deize (atendimento@, de 21/10 a 02/11/2026) saiu do escritório: fora da EQUIPE (os selects), e o nome pelo e-mail fica,
// pro histórico e pras conversas antigas.
// ============================================================

export const EQUIPE = ['Thalia', 'Vitória', 'Adaini', 'Samuel', 'Diego', 'Edna'];
export const NOME_POR_EMAIL = {
  'fiscal@macedoereis.com.br': 'Thalia', 'rh@macedoereis.com.br': 'Vitória', 'contabil@macedoereis.com.br': 'Adaini',
  'financeiro@macedoereis.com.br': 'Samuel', 'diego@macedoereis.com.br': 'Diego', 'atendimento@macedoereis.com.br': 'Deize'
};
export const nomePorEmail = e => NOME_POR_EMAIL[String(e || '').toLowerCase()] || null;
// quem saiu do escritório: tem o nome pelo e-mail (que fica, pro histórico) e não está na EQUIPE — hoje, a Deize. Nunca é
// opção de responsável, nem nos filtros e nas sugestões que as telas montam com os nomes gravados nas tarefas e nos
// vínculos (05/11/2026, pedido do Samuel: "pra não aparecer mais ela como opção"); quem sai depois entra aqui sozinho, ao
// sair da EQUIPE
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const SAIRAM = Object.values(NOME_POR_EMAIL).filter(n => !EQUIPE.includes(n));
export const saiuDaEquipe = n => !!n && SAIRAM.some(x => semAcento(x) === semAcento(n));
// os sócios: "Ambos" nas tarefas é os dois; o financeiro do escritório (Conta Azul) é só deles
export const SOCIOS = ['financeiro@macedoereis.com.br', 'diego@macedoereis.com.br'];
