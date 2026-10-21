// ============================================================
// MACEDO & REIS — a conferência do quadro de sócios da leitura de contrato (extract-document, modo cadastro; v29,
// 21/10/2026). O modelo pode errar; a regra não: quem está em socios_retirantes (saiu da sociedade no próprio ato —
// vendeu ou cedeu todas as cotas, retirou-se) sai de socios, e, com todas as participações lidas, a soma fora de 99,5 a
// 100,5 vira aviso em observacoes_extracao e a confiança alta cai pra "media". Puro: a função (servidor.ts) e o teste no
// node (tests/extract-document.test.mjs) usam o mesmo.
// ============================================================
export const soDigitos = s => String(s ?? '').replace(/\D/g, '');
export const nomeChave = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  .replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

// a mesma pessoa: pelo CPF quando os dois têm; pelo nome (sem acento) quando falta o CPF de um dos dois — o homônimo com
// outro CPF não é a mesma pessoa
export function mesmaPessoa(a, b) {
  const ca = soDigitos(a && a.cpf), cb = soDigitos(b && b.cpf);
  if (ca.length === 11 && cb.length === 11) return ca === cb;
  const na = nomeChave(a && a.nome), nb = nomeChave(b && b.nome);
  return !!na && na === nb;
}

export function conferirQuadro(d) {
  if (!d || typeof d !== 'object') return d;
  const avisos = [];
  const saiu = Array.isArray(d.socios_retirantes) ? d.socios_retirantes.filter(r => r && (r.nome || r.cpf)) : [];
  // quem a leitura pôs na lista de sócios mas marcou como de saída (participação zero ou "sócio retirante", "excluído",
  // "falecido" — o que a leitura antiga fazia com quem vendeu todas as cotas) vai pra lista de quem saiu
  if (Array.isArray(d.socios)) {
    d.socios.forEach(s => {
      if (!s) return;
      const zero = typeof s.participacao_percentual === 'number' && s.participacao_percentual <= 0;
      const marca = /RETIRANT|EXCLUID|FALECID/.test(nomeChave(s.qualificacao));
      if ((zero || marca) && !saiu.some(r => mesmaPessoa(r, s))) saiu.push({ nome: s.nome || null, cpf: s.cpf || null, motivo: String(s.qualificacao || '').trim() || 'participação zero depois do ato' });
    });
  }
  d.socios_retirantes = saiu.length ? saiu : null;
  if (Array.isArray(d.socios) && saiu.length) {
    const antes = d.socios.length;
    d.socios = d.socios.filter(s => !saiu.some(r => mesmaPessoa(r, s)));
    if (d.socios.length < antes) avisos.push('Quem saiu da sociedade no documento foi tirado da lista de sócios.');
  }
  if (Array.isArray(d.socios) && d.socios.length) {
    const ps = d.socios.map(s => (s && typeof s.participacao_percentual === 'number' ? s.participacao_percentual : null));
    if (ps.every(p => p !== null)) {
      const soma = Math.round(ps.reduce((a, b) => a + b, 0) * 100) / 100;
      if (soma < 99.5 || soma > 100.5) {
        avisos.push('As participações lidas somam ' + String(soma).replace('.', ',') + '% — confira o quadro de sócios.');
        if (d.confianca === 'alta') d.confianca = 'media';
      }
    }
  }
  if (avisos.length) d.observacoes_extracao = [d.observacoes_extracao, ...avisos].filter(Boolean).join(' ');
  return d;
}
