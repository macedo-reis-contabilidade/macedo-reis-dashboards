// O FGTS do 13º na rescisão de dezembro e de janeiro (27/11/2026, o "pode" do Samuel; a Nota Orientativa FGTS Digital
// nº 13/2026, do MTE, assinada em 19/11/2026, que troca a nº 11/2025). Desde 28/10/2026 o FGTS Digital antecipa sozinho:
// na rescisão com o fim do contrato em dezembro, ou em janeiro com o pagamento até 20/01, o FGTS do 13º vence junto com as
// verbas rescisórias, na guia rescisória, no mesmo prazo (10 dias do fim do contrato), e não em 20/01. E, em dezembro, o
// 13º adiantado acima do proporcional (quem recebeu a 1ª parcela e sai antes do fim do ano): o excesso descontado na
// rescisão vai na rubrica de desconto com a incidência de FGTS 11 (mensal), não a 12 (13º), senão o FGTS Digital cobra a
// mais. A ficha da rescisão (dp-rescisoes.html) mostra o aviso; a regra pura fica aqui (sem import: tests/rescisao-fgts13.test.mjs).
export const NOTA_FGTS13 = 'Nota Orientativa FGTS Digital nº 13/2026 (MTE, 19/11/2026)';

const dia = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s == null ? '' : s)); return m ? { a: +m[1], m: +m[2], d: +m[3], iso: m[0] } : null; };
const br = x => String(x.d).padStart(2, '0') + '/' + String(x.m).padStart(2, '0') + '/' + x.a;

/** O aviso do FGTS do 13º de uma rescisão: null quando não vale, ou { mes: 'dezembro' | 'janeiro', pagamento, linhas }.
 *  r: { ultimo_dia: 'AAAA-MM-DD', data_acerto: 'AAAA-MM-DD' (o pagamento até, já em dia útil), status } */
export function fgts13NaRescisao(r) {
  if (!r || r.status === 'cancelada') return null;
  const fim = dia(r.ultimo_dia), pag = dia(r.data_acerto);
  if (!fim) return null;
  let mes = null;
  if (fim.m === 12) mes = 'dezembro';
  // em janeiro, só com o pagamento até 20/01 daquele ano (depois disso, o FGTS do 13º já venceu em 20/01, sozinho)
  else if (fim.m === 1 && pag && pag.a === fim.a && pag.m === 1 && pag.d <= 20) mes = 'janeiro';
  if (!mes) return null;
  const ate = pag ? ' (até ' + br(pag) + ')' : '';
  const linhas = ['O FGTS do 13º vai junto: nesta rescisão de ' + mes + ', ele vence com as verbas rescisórias, na guia rescisória do FGTS Digital, no mesmo prazo do pagamento' + ate + ', e não em 20/01. Confira a guia do FGTS Digital antes do pagamento.'];
  if (mes === 'dezembro') linhas.push('Se o funcionário recebeu a 1ª parcela do 13º acima do proporcional, o excesso descontado na rescisão vai na rubrica de desconto com a incidência de FGTS 11 (mensal), não a 12 (13º): senão o FGTS Digital cobra a mais.');
  linhas.push(NOTA_FGTS13 + '.');
  return { mes, pagamento: pag ? pag.iso : null, linhas };
}
