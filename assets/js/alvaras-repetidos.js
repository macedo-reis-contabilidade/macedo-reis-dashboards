// ============================================================
// MACEDO & REIS — Alvará repetido (12/11/2026, pedido da Adaini): a mesma empresa não fica com dois alvarás de mesmo número.
// Regra pura (sem banco e sem tela), pra tela dos Alvarás (societario-alvaras.html) e pros testes
// (tests/alvaras-repetidos.test.mjs):
//  • o número se compara sem maiúscula, acento, ponto, traço, barra, espaço e sem os zeros da frente
//    ("AVCB 00123/2026" = "avcb-123-2026"; "0219270" = "219270");
//  • mesmo número e mesmo tipo, na mesma empresa: é o mesmo alvará, e a tela não grava o segundo;
//  • mesmo número em outro tipo (a prefeitura que põe a inscrição nos dois documentos): a tela pergunta antes de gravar.
// ============================================================
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** O número como se compara: só letras e dígitos, minúsculo, sem os zeros da frente. Vazio = sem número. */
export const chaveDoNumero = n => semAcento(n).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+(?=.)/, '');
/** O tipo como se compara: sem acento, maiúscula, espaço nem pontuação. */
export const chaveDoTipo = t => semAcento(t).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Os outros alvarás da mesma empresa com o mesmo número do alvo: { iguais: [mesmo tipo], outroTipo: [tipo diferente] }.
 *  lista = os alvarás ({ id, cliente_id, tipo, numero }); alvo = { id?, cliente_id, tipo, numero } — o id é o do próprio
 *  alvará, quando ele já existe (não conta a si mesmo). Sem número ou sem empresa, nada é repetido. */
export function repetidosDe(lista, alvo) {
  const numero = chaveDoNumero(alvo && alvo.numero), cliente = alvo && alvo.cliente_id;
  if (!numero || !cliente) return { iguais: [], outroTipo: [] };
  const tipo = chaveDoTipo(alvo.tipo);
  const mesmos = (lista || []).filter(a => a && a.cliente_id === cliente && a.id !== alvo.id && chaveDoNumero(a.numero) === numero);
  return { iguais: mesmos.filter(a => chaveDoTipo(a.tipo) === tipo), outroTipo: mesmos.filter(a => chaveDoTipo(a.tipo) !== tipo) };
}

/** Os alvarás que já estão em dobro na lista (mesma empresa, mesmo tipo e mesmo número): Map id → [os ids dos outros iguais]. */
export function emDobro(lista) {
  const grupos = new Map();
  (lista || []).forEach(a => {
    const numero = chaveDoNumero(a && a.numero);
    if (!numero || !a.cliente_id) return;
    const chave = a.cliente_id + '|' + chaveDoTipo(a.tipo) + '|' + numero;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(a.id);
  });
  const saida = new Map();
  grupos.forEach(ids => { if (ids.length > 1) ids.forEach(id => saida.set(id, ids.filter(x => x !== id))); });
  return saida;
}

const dataBR = ymd => { const p = String(ymd || '').slice(0, 10).split('-'); return p.length === 3 && p[0] ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
/** O alvará numa frase, pro aviso: "Alvará de Funcionamento nº 219270, vence em 18/11/2026". */
export function descreverAlvara(a) {
  if (!a) return '';
  const venc = dataBR(a.vencimento);
  return (String(a.tipo || '').trim() || 'Alvará') + (String(a.numero || '').trim() ? ' nº ' + String(a.numero).trim() : '') + (venc ? ', vence em ' + venc : ', sem vencimento');
}
