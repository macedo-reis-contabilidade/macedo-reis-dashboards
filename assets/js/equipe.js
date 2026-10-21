// ============================================================
// MACEDO & REIS — A equipe: os nomes dos selects de responsável e quem é quem pelo e-mail do login
// Usado pelo assistente do escritório (assets/js/assistente-escritorio.js e a função assistente). Edna não tem login.
// Deize (atendimento@, desde 21/10/2026) atua em vários setores.
// ============================================================

export const EQUIPE = ['Thalia', 'Vitória', 'Adaini', 'Samuel', 'Diego', 'Edna', 'Deize'];
export const NOME_POR_EMAIL = {
  'fiscal@macedoereis.com.br': 'Thalia', 'rh@macedoereis.com.br': 'Vitória', 'contabil@macedoereis.com.br': 'Adaini',
  'financeiro@macedoereis.com.br': 'Samuel', 'diego@macedoereis.com.br': 'Diego', 'atendimento@macedoereis.com.br': 'Deize'
};
export const nomePorEmail = e => NOME_POR_EMAIL[String(e || '').toLowerCase()] || null;
// os sócios: "Ambos" nas tarefas é os dois; o financeiro do escritório (Conta Azul) é só deles
export const SOCIOS = ['financeiro@macedoereis.com.br', 'diego@macedoereis.com.br'];
