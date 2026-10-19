// ============================================================
// MACEDO & REIS — O motor de honorários da Precificação (comercial-precificacao.html)
// O cálculo que a tela faz ao vivo, a partir das respostas do questionário (precificacao_questoes) e dos parâmetros
// (precificacao_parametros, calibráveis na aba Parâmetros): a base pelo faturamento anual × o regime, sócios e filiais,
// o volume (notas, estoque, lançamentos, contas, ERP), a folha × o risco trabalhista, as obrigações × o setor de risco,
// o ajuste pela qualidade dos documentos e os adicionais — arredondado. Um lugar só pra Simulação e pra aba Carteira
// (19/10/2026: o piso de cada cliente da casa com o que o sistema já sabe). Puro: testes em tests/precificacao-carteira.test.mjs.
// ============================================================

// os parâmetros por grupo (os 3 primeiros caracteres: p01, p02…), na ordem
export function indexarParams(params) {
  const P = {};
  (params || []).forEach(p => {
    const g = String(p.grupo || '').slice(0, 3);
    (P[g] = P[g] || []).push(p);
  });
  for (const g in P) P[g].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return P;
}

// faturamento anual: desde 25/09/2026 o formulário pergunta a média MENSAL (A2M); A2 (anual) só nas precificações antigas;
// empresa em constituição responde a projeção mensal (A2N). As faixas de preço continuam anuais
export function faturamentoAnual(respostas) {
  const num = id => Number((respostas || {})[id]) || 0;
  return num('A2M') * 12 || num('A2') || num('A2N') * 12;
}

// calcularMotor(respostas, P) → { linhas: [{ label, valor, sub }], honorario, bruto, taxaUnica }
export function calcularMotor(respostas, P) {
  const r = respostas || {};
  const linhas = [];
  const L = (label, valor, sub) => linhas.push({ label, valor, sub: !!sub });
  const pv = (g, chave) => { const it = (P[g] || []).find(x => x.chave === chave); return it ? Number(it.valor) : 0; };
  const pFaixa = (g, faixa) => pv(g, String(faixa));
  const num = id => Number(r[id]) || 0;
  const sim = id => r[id] === 'Sim';
  const R = id => r[id] ?? '';
  const baseFaturamento = anual => { let base = 0; (P['p01'] || []).forEach(it => { if (Number(anual || 0) >= Number(it.limite_inferior ?? it.chave)) base = Number(it.valor); }); return base; };

  const base = baseFaturamento(faturamentoAnual(r));
  const multReg = pv('p02', R('A10')) || 1;
  const baseAj = base * multReg;
  const socios = Math.max(0, num('A5') - 1) * pv('p03', 'Valor por sócio adicional (além do 1º)');
  const filiais = num('A8') * pv('p03', 'Valor por filial (mesmo município)');
  const filiaisFora = R('A9') === 'Sim' ? num('A8') * pv('p03', 'Valor extra por filial em município/estado diferente') : 0;
  const forasede = sim('A7') ? pv('p03', 'Valor por atendimento fora do município-sede') : 0;
  L('Base (faturamento) × regime ' + (multReg + '×'), baseAj);
  if (socios) L('Sócios adicionais', socios);
  if (filiais) L('Filiais (mesmo município)', filiais);
  if (filiaisFora) L('Filiais (outro município/UF)', filiaisFora);
  if (forasede) L('Atendimento fora da sede', forasede);
  const sub1 = baseAj + socios + filiais + filiaisFora + forasede;
  L('Subtotal estrutura', sub1, true);

  const nfE = pFaixa('p04', R('B1'));
  const nfR = pFaixa('p04', R('B2'));
  const estoque = (sim('B4') && R('B5') === 'O escritório contábil') ? pv('p05', 'Adicional - controle de estoque pelo escritório') : 0;
  const lanc = pFaixa('p06', R('B7'));
  const contas = Math.max(0, num('B6') - 1) * pv('p06', 'Valor por conta bancária adicional (além da 1ª)');
  const erp = pv('p07', R('B8'));
  if (nfE) L('NF emitidas', nfE);
  if (nfR) L('NF recebidas', nfR);
  if (estoque) L('Estoque pelo escritório', estoque);
  if (lanc) L('Lançamentos bancários', lanc);
  if (contas) L('Contas bancárias adicionais', contas);
  if (erp) L('ERP', erp);
  const sub2 = nfE + nfR + estoque + lanc + contas + erp;
  L('Subtotal operacional', sub2, true);

  const folhaItens = num('C1') * pv('p08', 'Valor por funcionário registrado')
    + num('C2') * pv('p08', 'Valor por funcionário a registrar (setup)')
    + num('C3') * pv('p08', 'Valor por funcionário afastado')
    + pFaixa('p09', R('C4'))
    + (sim('C5') ? num('C6') * pv('p08', 'Pró-labore por sócio recebendo') : 0)
    + num('C7') * pv('p08', 'Valor por terceirizado com retenção')
    + (sim('C8') ? pv('p08', 'Adicional insalubridade/periculosidade/noturno') : 0);
  const multTrab = pv('p10', R('C9')) || 1;
  const sub3 = folhaItens * multTrab;
  if (folhaItens) L('Folha (itens)', folhaItens);
  if (multTrab !== 1) L('× risco trabalhista ' + multTrab + '×', sub3 - folhaItens);
  L('Subtotal folha', sub3, true);

  const OB = [['D1', 'SPED Fiscal'], ['D2', 'SPED Contribuições'], ['D3', 'ECD'], ['D4', 'ECF'], ['D5', 'DCTF'],
    ['D6', 'eSocial/EFD-Reinf'], ['D7', 'RAIS/CAGED'], ['D8', 'GIA/ICMS'], ['D9', 'ISS'],
    ['D10', 'Reforma Tributária (transição/apuração dual)'], ['D11', 'Passivo tributário em aberto'],
    ['A11B', 'Fator R (monitoramento e planejamento)']];
  let obr = 0;
  OB.forEach(([id, chave]) => { if (sim(id)) { const v = pv('p11', chave); obr += v; if (v) L(chave, v); } });
  const parc = num('D12') * pv('p11', 'Valor por parcelamento ativo');
  if (parc) { obr += parc; L('Parcelamentos ativos', parc); }
  const multFiscal = R('D13') === 'Sim' ? pv('p12', 'Multiplicador - setor de risco elevado (Sim)') : pv('p12', 'Multiplicador - setor sem risco elevado (Não)') || 1;
  const sub4 = obr * (multFiscal || 1);
  if ((multFiscal || 1) !== 1) L('× setor de risco ' + multFiscal + '×', sub4 - obr);
  L('Subtotal obrigações', sub4, true);

  const subGeral = sub1 + sub2 + sub3 + sub4;
  const ajQual = pv('p13', R('E2')) || 0;
  const aposQual = subGeral * (1 + ajQual);
  const seguro = sim('E4') ? pv('p15', 'Adicional - seguro de responsabilidade civil profissional') : 0;
  if (ajQual) L('Ajuste qualidade docs (' + (ajQual > 0 ? '+' : '') + (ajQual * 100) + '%)', aposQual - subGeral);
  if (seguro) L('Seguro RC profissional', seguro);
  const terce = R('D20') === 'Sim' ? num('D21') : 0;
  if (terce) L('Terceirização de serviço (informado)', terce);
  const emiteNF = R('B3') === 'O escritório contábil' ? pv('p04', 'Adicional - escritório emite as notas fiscais') : 0;
  if (emiteNF) L('Emissão de notas fiscais pelo escritório', emiteNF);
  const semFin = R('E1') === 'Não possui' ? pv('p15', 'Adicional - cliente sem responsável financeiro') : 0;
  if (semFin) L('Cliente sem responsável financeiro', semFin);

  const bruto = aposQual + seguro + terce + emiteNF + semFin;
  const passo = pv('p16', 'Arredondar honorário final para múltiplo de (R$)') || 10;
  let honorario = Math.round(bruto / passo) * passo;
  const ajusteHon = Number(r['ajuste_honorario'] || 0);
  if (ajusteHon) { L('Ajuste comercial', ajusteHon); honorario += ajusteHon; }
  const taxaUnica = (R('A12') === 'Sim' && R('A13') === 'Desorganizada/inexistente')
    ? pv('p15', 'Taxa única de organização inicial (migração desorganizada)') : 0;

  return { linhas, honorario, bruto, taxaUnica };
}
