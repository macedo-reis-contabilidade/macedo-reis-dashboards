// ============================================================
// MACEDO & REIS — Cada pessoa com a sua cor (13/11/2026, pedido do Samuel: "dar um pouco mais de alegria" ao sistema)
// Uma cor fixa pra cada pessoa da equipe, sempre a mesma em todo lugar: o avatar no chat, o responsável das tarefas na
// Agenda. Quem não está na lista (alguém novo, um nome digitado) ganha uma cor estável tirada do próprio nome, então
// ninguém fica cinza e a mesma pessoa tem sempre a mesma cor. "Ambos" (os dois sócios) não tem cor.
// As cores são pastéis feitos pro tema escuro; no claro, o CSS escurece a letra (.pessoa-chip e .ch-avatar em style.css).
// Pessoa nova na equipe: ponha a cor dela aqui (uma que ainda não esteja em uso).
// Teste: tests/cores-pessoas.test.mjs.
// ============================================================
import { nomePorEmail } from './equipe.js';

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const CORES = {
  samuel:  '#6CA6EA',   // azul
  diego:   '#4FC3B0',   // verde-água
  thalia:  '#F08FB8',   // rosa
  vitoria: '#A892EA',   // violeta
  adaini:  '#F2B77E',   // pêssego
  edna:    '#7CCB8E'    // verde
};
const OUTRAS = ['#8FB7E8', '#E6A67C', '#9FD08A', '#D99BD6', '#7FCFD6', '#E3C56B'];

// o primeiro nome, sem acento e em minúsculas, de um nome ("Vitória Souza") ou de um e-mail (rh@…)
export function chaveDaPessoa(quem) {
  const t = String(quem == null ? '' : quem).trim();
  if (!t) return '';
  const nome = t.includes('@') ? (nomePorEmail(t) || t.split('@')[0]) : t;
  return semAcento(nome).split(/[\s.]+/)[0] || '';
}

// a cor da pessoa (#RRGGBB) ou null (sem nome, ou "Ambos")
export function corDaPessoa(quem) {
  const k = chaveDaPessoa(quem);
  if (!k || k === 'ambos') return null;
  if (CORES[k]) return CORES[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return OUTRAS[h % OUTRAS.length];
}

// a inicial que vai na bolinha
export const inicialDaPessoa = quem => {
  const t = String(quem == null ? '' : quem).trim();
  const nome = t.includes('@') ? (nomePorEmail(t) || t) : t;
  const m = nome.match(/[\p{L}\p{N}]/u);   // só letra ou número: vai num atributo do HTML (data-i)
  return m ? m[0].toUpperCase() : '';
};
