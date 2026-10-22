// ============================================================
// MACEDO & REIS — Certificados digitais dos clientes (Societário › Certificados digitais, 22/10/2026, pedido do Samuel)
// O escritório não emite nem agenda o certificado: avisa o cliente antes de vencer, pra ele renovar a tempo (o certificado
// vencido trava o trabalho do escritório também). Quando avisar é a mesma regra do vigia (certificado_vencendo, em
// vigia_regras_societario), que manda o recado pra Deize:
//   - a 30 dias ou menos do vencimento, sem aviso nessa janela;
//   - a 7 dias ou menos, sem aviso depois dos 7 dias (o primeiro aviso não bastou: o certificado não foi renovado);
//   - vencido há até 30 dias, sem aviso depois do vencimento (depois disso, só a lista mostra).
// Renovou: a validade nova recomeça a conta. A certificadora é obrigatória no cadastro (abaixo).
// Testes no node: tests/certificados.test.mjs.
// ============================================================

export const AVISO_DIAS = 30;
export const SEGUNDO_AVISO_DIAS = 7;
export const VENCIDO_DIAS = 30;

const dia = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
};
const iso = ms => new Date(ms).toISOString().slice(0, 10);

/** Dias de uma data ('AAAA-MM-DD') até outra: positivo quando a segunda vem depois. */
export const diasEntre = (de, ate) => Math.round((dia(ate) - dia(de)) / 864e5);
/** A data somada de n dias ('AAAA-MM-DD'). */
export const somaDias = (data, n) => iso(dia(data) + n * 864e5);
/** dd/mm/aaaa */
export const fmtData = data => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };

/** O dia do aviso no fuso do navegador (o avisado_em é um carimbo com hora). */
export function diaDoAviso(avisadoEm) {
  if (!avisadoEm) return null;
  const d = new Date(avisadoEm);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** A situação na lista: 'parado' (não acompanha), 'vencido', 'vence30' (a 30 dias ou menos) ou 'emdia'. */
export function situacao(c, hoje) {
  if (!c) return 'emdia';
  if (c.acompanhar === false) return 'parado';
  const d = diasEntre(hoje, c.validade);
  if (Number.isNaN(d)) return 'emdia';
  if (d < 0) return 'vencido';
  if (d <= AVISO_DIAS) return 'vence30';
  return 'emdia';
}

/** Precisa avisar o cliente agora? '30', '7', 'vencido' ou null — a regra do vigia. */
export function etapaDoAviso(c, hoje) {
  if (!c || c.acompanhar === false || !c.validade) return null;
  const d = diasEntre(hoje, c.validade);
  if (Number.isNaN(d) || d > AVISO_DIAS || d < -VENCIDO_DIAS) return null;
  const av = diaDoAviso(c.avisado_em);
  if (d > SEGUNDO_AVISO_DIAS) return !av || av < somaDias(c.validade, -AVISO_DIAS) ? '30' : null;
  if (d >= 0) return !av || av < somaDias(c.validade, -SEGUNDO_AVISO_DIAS) ? '7' : null;
  return !av || av < c.validade ? 'vencido' : null;
}

/** Quanto falta, em palavras: "vence hoje", "vence em 12 dias", "venceu há 3 dias"… */
export function prazoEmPalavras(c, hoje) {
  const d = diasEntre(hoje, c && c.validade);
  if (Number.isNaN(d)) return '';
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  if (d > 1) return `vence em ${d} dias`;
  if (d === -1) return 'venceu ontem';
  return `venceu há ${-d} dias`;
}

/** A mensagem do aviso, pronta pra editar antes de mandar. */
export function mensagemDoAviso(c, hoje) {
  const tipo = c && c.tipo ? ' ' + c.tipo : '';
  const quem = String((c && c.titular) || '').trim();
  const data = fmtData(c && c.validade);
  const d = diasEntre(hoje, c && c.validade);
  const ola = 'Olá! Aqui é do escritório Macedo & Reis.';
  const fim = 'Qualquer dúvida, estamos à disposição.';
  if (d < 0) {
    return `${ola} O certificado digital${tipo} de ${quem} venceu em ${data}. Sem ele, a emissão de notas e o acesso aos `
      + `sistemas do governo ficam parados. Se já renovou, é só nos mandar o novo. ${fim}`;
  }
  const quando = d === 0 ? `vence hoje (${data})` : d === 1 ? `vence amanhã (${data})` : `vence em ${data}, daqui a ${d} dias`;
  return `${ola} O certificado digital${tipo} de ${quem} ${quando}. Ele é usado na emissão de notas e no acesso aos `
    + `sistemas do governo, então vale renovar antes dessa data. Depois de renovar, nos mande o novo, por favor. ${fim}`;
}

/** O número pro WhatsApp: só dígitos, com o 55 quando falta; null quando não parece um telefone. */
export function numeroWhats(texto) {
  const dig = String(texto || '').replace(/\D/g, '');
  if (dig.length < 10 || dig.length > 13) return null;
  return dig.length <= 11 ? '55' + dig : dig;
}

// ---------- a certificadora (22/10/2026, pedido da Adaini: obrigatória no cadastro) ----------
// A planilha importada não tinha a coluna: os certificados que vieram dela estão sem a certificadora, que é pedida quando
// o certificado é renovado (o Renovado é o cadastro do certificado novo). Só ligar a empresa, anotar ou deixar de
// acompanhar um desses não trava; e a certificadora informada não se apaga.

const chave = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const limpo = t => String(t || '').replace(/\s+/g, ' ').trim();

/** As certificadoras já usadas, pra sugerir ao digitar: cada uma uma vez (sem diferenciar maiúscula, acento e espaço),
 *  na grafia mais usada, em ordem alfabética. */
export function certificadorasDe(lista) {
  const porChave = new Map();
  (lista || []).forEach(c => {
    const nome = limpo(c && c.certificadora);
    if (!nome) return;
    const grafias = porChave.get(chave(nome)) || new Map();
    grafias.set(nome, (grafias.get(nome) || 0) + 1);
    porChave.set(chave(nome), grafias);
  });
  return [...porChave.values()]
    .map(g => [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0])
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** A certificadora digitada, na grafia de uma já usada quando é a mesma ("certisign" vira "Certisign"); '' se vazia. */
export function grafiaDaCertificadora(texto, conhecidas) {
  const nome = limpo(texto);
  if (!nome) return '';
  return (conhecidas || []).find(x => chave(x) === chave(nome)) || nome;
}

/** O primeiro campo obrigatório que falta no cadastro ({ campo, texto }) ou null: o titular, a certificadora e a validade.
 *  antes = o certificado como estava (na edição); renovando = o Renovado. */
export function faltaNoCadastro(c, { antes = null, renovando = false } = {}) {
  if (!limpo(c && c.titular)) return { campo: 'titular', texto: 'Informe o titular.' };
  const exige = !antes || renovando || !!limpo(antes.certificadora);
  if (exige && !limpo(c && c.certificadora)) {
    return { campo: 'certificadora', texto: renovando ? 'Informe a certificadora do certificado novo.' : 'Informe a certificadora.' };
  }
  if (!(c && c.validade)) return { campo: 'validade', texto: 'Informe a validade.' };
  return null;
}

/** A ordem da lista: quem precisa de aviso primeiro, depois pela validade (a que vence antes em cima). */
export function ordenar(lista, hoje) {
  const peso = c => (etapaDoAviso(c, hoje) ? 0 : 1);
  return [...(lista || [])].sort((a, b) => peso(a) - peso(b) || String(a.validade || '').localeCompare(String(b.validade || ''))
    || String(a.titular || '').localeCompare(String(b.titular || ''), 'pt-BR'));
}
