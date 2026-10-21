// ============================================================
// MACEDO & REIS — Os sócios que a leitura do contrato traz (21/10/2026)
// A leitura (Edge Function extract-document, modo cadastro) devolve `socios` — quem é sócio DEPOIS do ato, com a
// participação da distribuição final — e `socios_retirantes` — quem saiu da sociedade no documento (vendeu ou cedeu
// todas as cotas, retirou-se, faleceu), `{ nome, cpf, motivo }`. Caso da Ind Perin (21/10/2026): a alteração de saída
// qualificava os dois sócios no preâmbulo, e a leitura punha como sócio quem tinha vendido todas as cotas no próprio ato.
// Regras puras, sem o Supabase: o cadastro com extração (clientes/novo.html) e o "Ler o documento e comparar com o
// cadastro" do Registrar processo (clientes/editar.html) usam as mesmas; teste no node em tests/leitura-socios.test.mjs.
// ============================================================

const digitos = v => String(v ?? '').replace(/\D/g, '');
const nomeNormal = v => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const temNome = s => !!s && String(s.nome ?? '').trim() !== '';

// quem saiu da sociedade no documento: { nome, cpf (só dígitos), motivo }, sem as linhas sem nome
export function retirantesDe(d) {
  const lista = d && Array.isArray(d.socios_retirantes) ? d.socios_retirantes : [];
  return lista.filter(temNome).map(r => ({
    nome: String(r.nome).trim(),
    cpf: digitos(r.cpf) || null,
    motivo: String(r.motivo ?? '').replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, '') || null,
  }));
}

// a mesma pessoa: pelo CPF (só os dígitos) quando os dois têm; sem o CPF de um dos lados, pelo nome sem acento
export function mesmaPessoa(a, b) {
  const ca = digitos(a && a.cpf), cb = digitos(b && b.cpf);
  if (ca && cb) return ca === cb;
  const na = nomeNormal(a && a.nome), nb = nomeNormal(b && b.nome);
  return !!na && na === nb;
}

// o retirante que é essa pessoa, ou null
export const retiranteQueE = (pessoa, retirantes) => (retirantes || []).find(r => mesmaPessoa(pessoa, r)) || null;

// os sócios que ficam: os da leitura sem quem saiu — a leitura antiga (ou o modelo, por engano) pode pôr a mesma pessoa
// nas duas listas, e quem saiu nunca entra como sócio
export function sociosQueFicam(d) {
  const retirantes = retirantesDe(d);
  const lista = d && Array.isArray(d.socios) ? d.socios.filter(temNome) : [];
  return lista.filter(s => !retiranteQueE(s, retirantes));
}

// a participação como número: 50, "50", "33,33", "50%"; o que não é número, null
export function percentual(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[%\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const fmtPct = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// a conferência da soma das participações lidas: passou de 100,5% (as que vieram com número já passam) ou, com todos os
// sócios com participação, ficou abaixo de 99,5% → o aviso; senão, ''. Não bloqueia: só pede pra conferir
export function avisoDaSoma(socios) {
  const lista = (socios || []).filter(temNome);
  const numeros = lista.map(s => percentual(s.participacao_percentual)).filter(p => p != null);
  if (!numeros.length) return '';
  const soma = Math.round(numeros.reduce((a, b) => a + b, 0) * 100) / 100;
  const todos = numeros.length === lista.length;
  if (soma > 100.5 || (todos && soma < 99.5)) return 'As participações lidas somam ' + fmtPct(soma) + '% — confira o quadro de sócios antes de aplicar.';
  return '';
}

// a frase de quem ficou de fora (o status do cadastro com extração): "Fora: A, que saiu da sociedade neste documento."
export function textoDosRetirantes(retirantes) {
  const nomes = (retirantes || []).map(r => r && String(r.nome ?? '').trim()).filter(Boolean);
  if (!nomes.length) return '';
  const juntos = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  return 'Fora: ' + juntos + (nomes.length === 1 ? ', que saiu' : ', que saíram') + ' da sociedade neste documento.';
}

// a linha de quem saiu e não está no cadastro: "Saiu da sociedade neste documento: NOME — motivo"
export const linhaDoRetirante = r => 'Saiu da sociedade neste documento: ' + r.nome + (r.motivo ? ' — ' + r.motivo : '');
