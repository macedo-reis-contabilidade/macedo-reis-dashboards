// ============================================================
// MACEDO & REIS — Leitura dos relatórios da Domínio (PDF)
// Módulo ES puro, sem DOM: recebe as linhas já extraídas do PDF
// e devolve os números. Layout da Domínio é fixo, então aqui não
// entra IA — o que sai daqui bate centavo com o papel.
// Testado por tests/dominio-relatorios.test.mjs.
//
// Relatórios cobertos:
//   · RELATÓRIO DE FATURAMENTO      (saídas × serviços, mês a mês)
//   · SIMPLES NACIONAL (PGDAS)      (RPA, RBT12, anexos e partilha por tributo)
//   · ACOMPANHAMENTO DE ENTRADAS    (um lançamento por linha, com CFOP)
// ============================================================

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = s => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();
const dig = s => String(s == null ? '' : s).replace(/\D/g, '');
// "1.034.942,41" → 1034942.41 · devolve null se não for número
export function numBR(s) {
  const t = String(s == null ? '' : s).trim();
  if (!/\d/.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const RX_VALOR = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const valores = l => (String(l).match(RX_VALOR) || []).map(numBR);
const RX_DOC = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/;

// ---------- CFOP: o que credita, o que não é compra ----------
// Sufixo do CFOP (os 3 últimos dígitos); o 1º dígito é só a origem (1 estado, 2 outro, 3 exterior).
const SUF = {
  mercadoria: ['101','102','111','113','116','117','118','120','121','122','124','125','126','128','401','403','406','407'],
  despesa:    ['251','252','253','254','255','256','257','301','302','303','304','305','306','351','352','353','354','355','356','360','551','552','553','554','555','556','557','601','602','603','604','605','651','652','653'],
  devolucao:  ['201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','410','411','412','413','414','415','503','504','505']
};
export const GRUPOS = {
  mercadoria:      { rotulo: 'Mercadorias e insumos',        credita: 'mercadoria', padrao: true,  nota: 'seguem o mix de alíquotas das vendas' },
  despesa:         { rotulo: 'Energia, frete, ativo e consumo', credita: 'despesa', padrao: true,  nota: 'creditam à alíquota cheia' },
  // x949 é o balaio da Domínio: combustível legítimo convive com industrialização lançada errada.
  // Fica DESLIGADO por padrão — crédito a mais empurra o veredito para "opte", que é a decisão de risco.
  outras:          { rotulo: 'Outras entradas (CFOP x949)',   credita: 'despesa',   padrao: false, nota: 'combustível costuma cair aqui, mas também sobra industrialização lançada errada — marque só se conferir' },
  devolucao:       { rotulo: 'Devoluções de venda',           credita: null,        padrao: false, nota: 'volta de mercadoria vendida — não é compra' },
  nao_operacional: { rotulo: 'Remessas e retornos (CFOP 9xx)', credita: null,       padrao: false, nota: 'material de terceiro entrando para conserto/industrialização — não é compra' },
  indefinido:      { rotulo: 'CFOP não classificado',         credita: null,        padrao: false, nota: 'confira caso a caso' }
};
export function grupoDoCfop(cfop) {
  const d = dig(cfop);
  if (d.length !== 4) return 'indefinido';
  const s = d.slice(1);
  if (SUF.mercadoria.includes(s)) return 'mercadoria';
  if (SUF.devolucao.includes(s)) return 'devolucao';
  if (s === '949') return 'outras';
  if (SUF.despesa.includes(s)) return 'despesa';
  if (s[0] === '9') return 'nao_operacional';
  return 'indefinido';
}

// ---------- identificação ----------
export function detectarTipo(paginas) {
  const cabeca = norm((paginas[0] || []).slice(0, 14).join(' | '));
  if (cabeca.includes('RELATORIO DE FATURAMENTO')) return 'faturamento';
  if (cabeca.includes('ACOMPANHAMENTO DE ENTRADAS')) return 'entradas';
  if (cabeca.includes('SIMPLES NACIONAL')) return 'simples';
  return null;
}
function cabecalho(paginas) {
  const linhas = (paginas[0] || []).slice(0, 16);
  const alvo = l => norm(l);
  const doc = linhas.map(l => (l.match(/CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1]).find(Boolean) || null;
  let empresa = null;
  for (const l of linhas) {
    const m = l.match(/Empresa:\s*(.+?)(?:\s{2,}(?:P[áa]gina|Emiss[ãa]o|CNPJ)|$)/i);
    if (m) { empresa = m[1].trim(); break; }
    const m2 = l.match(/^\s*\d+\s*-\s*(.+?)(?:\s{2,}(?:P[áa]gina|Emiss[ãa]o)|$)/);
    if (m2 && alvo(m2[1]).length > 4) { empresa = m2[1].trim(); break; }
  }
  const per = linhas.map(l => (l.match(/Per[íi]odo:\s*(.+?)(?:\s{2,}|$)/i) || [])[1]).find(Boolean) || null;
  return { empresa, cnpj: doc ? dig(doc) : null, periodo: per ? per.trim() : null };
}

// ---------- 1) RELATÓRIO DE FATURAMENTO ----------
// "Janeiro  2026  13.960,00  88.374,29  0,00  102.334,29"
export function lerFaturamento(paginas) {
  const base = cabecalho(paginas);
  const meses = [];
  let totais = null;
  for (const linha of paginas.flat()) {
    const m = linha.match(/^\s*([A-Za-zçÇÃãÂâÉé]+)\s+(\d{4})\s+(.+)$/);
    if (m) {
      const idx = MESES.findIndex(x => semAcento(x) === semAcento(m[1]).toLowerCase());
      const v = valores(m[3]);
      if (idx >= 0 && v.length >= 4) {
        meses.push({ competencia: m[2] + '-' + String(idx + 1).padStart(2, '0'), saidas: v[0], servicos: v[1], outros: v[2], total: v[3] });
        continue;
      }
    }
    if (/^\s*Totais\b/i.test(linha)) { const v = valores(linha); if (v.length >= 4) totais = { saidas: v[0], servicos: v[1], outros: v[2], total: v[3] }; }
  }
  if (!meses.length) throw new Error('não encontrei os meses no relatório de faturamento');
  meses.sort((a, b) => a.competencia < b.competencia ? -1 : 1);
  const soma = k => meses.reduce((a, x) => a + (x[k] || 0), 0);
  const conferido = totais ? Math.abs(soma('total') - totais.total) <= 0.05 : null;
  return { tipo: 'faturamento', ...base, meses, totais: totais || { saidas: soma('saidas'), servicos: soma('servicos'), outros: soma('outros'), total: soma('total') }, conferido };
}

// ---------- 2) SIMPLES NACIONAL (PGDAS) ----------
// Um PDF por período. Cada anexo traz "Receita Tributada Total / Alíquota / Simples Nacional Total",
// a linha "Partilha:" com os tributos e a linha "Valor:" com o que cabe a cada um.
export function lerSimples(paginas) {
  const base = cabecalho(paginas);
  const linhas = paginas.flat();
  const acha = rx => { for (const l of linhas) { const m = l.match(rx); if (m) return m; } return null; };
  const periodo = (acha(/Per[íi]odo:\s*(\d{2})\/(\d{4})/) || []).slice(1);
  const competencia = periodo.length === 2 ? periodo[1] + '-' + periodo[0] : null;
  const umValor = rx => { const m = acha(rx); return m ? numBR(m[1]) : null; };
  const rpa = umValor(/Regime de Compet[êe]ncia\s+([\d.]+,\d{2})/);
  const rbt12 = umValor(/\(RBT12\)\s+([\d.]+,\d{2})/);
  const rbaCorrente = umValor(/corrente \(RBA\)\s+([\d.]+,\d{2})/);
  const faixa = (acha(/Faixa de Enquadramento:\s*(.+?)(?:\s{2,}|$)/) || [])[1] || null;

  const anexos = [];
  let atual = null, tributos = null;
  for (const l of linhas) {
    let m = l.match(/^\s*Anexo:\s*Anexo\s+([IVX]+)\s*-\s*(.+?)\s*$/);
    if (m) { atual = { anexo: m[1], descricao: m[2].trim(), receita: null, aliquota: null, das: null, partilha: {} }; anexos.push(atual); tributos = null; continue; }
    if (!atual) continue;
    m = l.match(/Receita Tributada Total:\s*([\d.]+,\d{2})\s*Al[íi]quota:\s*([\d.,]+)\s+Simples Nacional Total:\s*([\d.]+,\d{2})/);
    if (m) { atual.receita = numBR(m[1]); atual.aliquota = numBR(m[2]); atual.das = numBR(m[3]); continue; }
    m = l.match(/^\s*Partilha:\s*(.+)$/);
    if (m) { tributos = m[1].trim().split(/\s{2,}/).map(t => t.trim()).filter(Boolean); continue; }
    m = l.match(/^\s*Valor:\s*(.+)$/);
    if (m && tributos) {
      const v = valores(m[1]);
      tributos.forEach((t, i) => { if (v[i] != null) atual.partilha[t] = v[i]; });
      tributos = null;
    }
  }
  if (!anexos.length) throw new Error('não encontrei os anexos na apuração do Simples');

  const dasTotal = anexos.reduce((a, x) => a + (x.das || 0), 0);
  const porTributo = {};
  anexos.forEach(a => Object.entries(a.partilha).forEach(([t, v]) => { porTributo[t] = (porTributo[t] || 0) + v; }));
  // CBS entra no lugar de PIS/COFINS; em 2027 ICMS/ISS seguem no DAS (IBS só a alíquota-teste de 0,1%).
  const cbsNoDas = (porTributo['PIS'] || 0) + (porTributo['COFINS'] || 0);
  const ibsNoDas = (porTributo['ICMS'] || 0) + (porTributo['ISS'] || 0);
  const receitaTributada = anexos.reduce((a, x) => a + (x.receita || 0), 0);

  // histórico do RBT12 que vem na 2ª página ("Receita Bruta Acumulada": MM/AAAA + valor)
  const historico = [];
  for (const l of linhas) {
    const m = l.match(/^\s*(\d{2})\/(\d{4})\s+([\d.]+,\d{2})/);
    if (m) historico.push({ competencia: m[2] + '-' + m[1], receita: numBR(m[3]) });
  }

  const predominante = anexos.slice().sort((a, b) => (b.receita || 0) - (a.receita || 0))[0];
  return {
    tipo: 'simples', ...base, competencia, rpa, rbt12, rbaCorrente, faixa, anexos, dasTotal, receitaTributada,
    porTributo, cbsNoDas, ibsNoDas,
    partilhaCbsPct: dasTotal > 0 ? cbsNoDas / dasTotal * 100 : null,
    partilhaIbsPct: dasTotal > 0 ? ibsNoDas / dasTotal * 100 : null,
    aliquotaEfetiva: receitaTributada > 0 ? dasTotal / receitaTributada * 100 : null,
    anexoPredominante: predominante ? predominante.anexo : null,
    historico
  };
}

// ---------- 3) ACOMPANHAMENTO DE ENTRADAS ----------
// "16220  05/01/2026  05/01/2026  64504349  890  42  1049  FORNECEDOR00.000.000/0000-00  IE  1-102  67 RS  1.600,00 ICMS  0,00 …"
// Âncora pela direita (CFOP + AC + UF + valor contábil): o começo da linha varia de página pra página.
const RX_LANC = /(\d)-(\d{3})\s+(\d+)\s+([A-Z]{2})\s+(-?[\d.]+,\d{2})/;
export function lerEntradas(paginas) {
  const base = cabecalho(paginas);
  const lancamentos = [];
  let totalGeral = null;
  const todas = paginas.flat();
  for (let i = 0; i < todas.length; i++) {
    const linha = todas[i];
    if (/Total Fornecedor/i.test(linha)) continue;
    if (/Total Geral/i.test(linha)) {
      // a Domínio quebra o rótulo e o valor em duas linhas
      const v = valores(linha).concat(valores(todas[i + 1] || ''));
      if (v.length) totalGeral = v[0];
      continue;
    }
    const datas = linha.match(/(\d{2}\/\d{2}\/\d{4})/g);
    const alvo = linha.match(RX_LANC);
    if (!datas || !alvo) continue;
    const doc = (linha.match(RX_DOC) || [])[1] || null;
    const antes = linha.slice(0, alvo.index);
    // nome: o que sobra entre o código do fornecedor e o documento, sem a inscrição estadual colada
    let nome = doc ? antes.slice(0, antes.indexOf(doc)) : antes;
    nome = nome.replace(/^.*?\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+/, '').replace(/^\s*\S+\s+\S+\s+\S+\s+\S+\s+/, '');
    nome = nome.replace(/\s{2,}/g, ' ').replace(/\d{6,}\s*$/, '').trim();
    const [, o, s, ac, uf, val] = alvo;
    const data = datas[0];
    lancamentos.push({
      data, competencia: data.slice(6, 10) + '-' + data.slice(3, 5),
      fornecedor: nome || null, documento: doc ? dig(doc) : null,
      cfop: o + s, ac, uf, valor: numBR(val), grupo: grupoDoCfop(o + s)
    });
  }
  if (!lancamentos.length) throw new Error('não encontrei lançamentos no acompanhamento de entradas');
  const soma = lancamentos.reduce((a, x) => a + (x.valor || 0), 0);
  return { tipo: 'entradas', ...base, lancamentos, totalGeral, conferido: totalGeral != null ? Math.abs(soma - totalGeral) <= 0.05 : null, soma };
}

export function lerRelatorio(paginas) {
  const tipo = detectarTipo(paginas);
  if (tipo === 'faturamento') return lerFaturamento(paginas);
  if (tipo === 'simples') return lerSimples(paginas);
  if (tipo === 'entradas') return lerEntradas(paginas);
  throw new Error('não reconheci o relatório (esperado: Faturamento, Simples Nacional ou Acompanhamento de Entradas da Domínio)');
}

// ---------- resumo das entradas por grupo de CFOP ----------
export function resumirEntradas(ent, competencias) {
  const dentro = l => !competencias || !competencias.length || competencias.includes(l.competencia);
  const grupos = {};
  ent.lancamentos.filter(dentro).forEach(l => {
    const g = grupos[l.grupo] || (grupos[l.grupo] = { grupo: l.grupo, ...GRUPOS[l.grupo], valor: 0, notas: 0, cfops: {} });
    g.valor += l.valor || 0; g.notas++;
    g.cfops[l.cfop] = (g.cfops[l.cfop] || 0) + (l.valor || 0);
  });
  // quem são os maiores do grupo: é o que deixa decidir o x949 em cinco segundos
  const porForn = {};
  ent.lancamentos.filter(dentro).forEach(l => {
    const k = l.grupo + '|' + (l.documento || l.fornecedor || '?');
    const f = porForn[k] || (porForn[k] = { grupo: l.grupo, nome: l.fornecedor || '(sem nome)', valor: 0, notas: 0 });
    f.valor += l.valor || 0; f.notas++;
  });
  Object.values(porForn).forEach(f => { const g = grupos[f.grupo]; if (g) (g.fornecedores = g.fornecedores || []).push(f); });
  Object.values(grupos).forEach(g => { g.fornecedores = (g.fornecedores || []).sort((a, b) => b.valor - a.valor).slice(0, 5); });
  const ordem = ['mercadoria', 'despesa', 'outras', 'devolucao', 'nao_operacional', 'indefinido'];
  return ordem.filter(k => grupos[k]).map(k => grupos[k]);
}

// ---------- consolidação para a ficha da Reforma ----------
// rels: relatórios lidos · incluir: { grupo: bool } vindo dos checkboxes da prévia
export function consolidar(rels, incluir) {
  const fat = rels.filter(r => r.tipo === 'faturamento').pop() || null;
  const sims = rels.filter(r => r.tipo === 'simples').sort((a, b) => (a.competencia || '') < (b.competencia || '') ? -1 : 1);
  const sim = sims[sims.length - 1] || null;
  const ent = rels.filter(r => r.tipo === 'entradas').pop() || null;
  const campos = {}, origem = {}, avisos = [];

  // empresas diferentes no mesmo lote é erro de operação, não de leitura
  const docs = [...new Set(rels.map(r => r.cnpj).filter(Boolean))];
  if (docs.length > 1) avisos.push('Os relatórios são de CNPJs diferentes (' + docs.join(' · ') + ') — importe um cliente por vez.');

  // receita mensal: média dos meses com faturamento
  let competencias = [];
  if (fat) {
    const comFat = fat.meses.filter(m => (m.total || 0) > 0);
    competencias = comFat.map(m => m.competencia);
    if (comFat.length) {
      campos.receita = fat.totais.total / comFat.length;
      const pctServ = fat.totais.total ? fat.totais.servicos / fat.totais.total * 100 : 0;
      origem.receita = 'faturamento Domínio: ' + brl(fat.totais.total) + ' ÷ ' + comFat.length + ' mês(es)'
        + (pctServ > 0 ? ' · ' + pct(pctServ) + '% serviço' : '');
    }
  } else if (sim) {
    const h = sim.historico.filter(x => x.receita > 0);
    if (sim.rpa) { campos.receita = sim.rpa; origem.receita = 'PGDAS ' + sim.competencia + ': receita do período'; }
    if (h.length >= 12) avisos.push('Sem o relatório de faturamento, a receita vem de um mês só — suba o faturamento do ano para a média.');
  }

  if (sim) {
    campos.anexo = sim.anexoPredominante;
    const outros = sim.anexos.filter(a => a.anexo !== sim.anexoPredominante && (a.receita || 0) > 0);
    origem.anexo = 'PGDAS ' + sim.competencia + ': Anexo ' + sim.anexoPredominante
      + ' com ' + brl(sim.anexos.find(a => a.anexo === sim.anexoPredominante).receita)
      + (outros.length ? ' (também ' + outros.map(a => 'Anexo ' + a.anexo + ' ' + brl(a.receita)).join(', ') + ')' : '');
    if (outros.length) avisos.push('A empresa tem receita em mais de um anexo — o simulador trabalha com um só; foi usado o predominante (Anexo ' + sim.anexoPredominante + ').');
    campos.rbt12 = sim.rbt12;
    origem.rbt12 = 'PGDAS ' + sim.competencia;
    if (sim.partilhaCbsPct != null) {
      campos.partilha = sim.partilhaCbsPct;
      origem.partilha = 'PGDAS ' + sim.competencia + ': PIS + COFINS = ' + brl(sim.cbsNoDas) + ' de ' + brl(sim.dasTotal) + ' do DAS';
    }
    if (sim.aliquotaEfetiva != null) origem.aliquotaEfetiva = pct(sim.aliquotaEfetiva) + '% no PGDAS ' + sim.competencia;
  }

  if (ent && campos.receita) {
    const base = competencias.length ? competencias : [...new Set(ent.lancamentos.map(l => l.competencia))];
    const receitaBase = fat
      ? fat.meses.filter(m => base.includes(m.competencia)).reduce((a, m) => a + (m.total || 0), 0)
      : campos.receita * base.length;
    const res = resumirEntradas(ent, base);
    const somaSe = tipo => res.filter(g => (incluir ? incluir[g.grupo] : g.padrao) && g.credita === tipo).reduce((a, g) => a + g.valor, 0);
    const merc = somaSe('mercadoria'), desp = somaSe('despesa');
    if (receitaBase > 0) {
      campos.pctMerc = Math.min(100, merc / receitaBase * 100);
      campos.pctDesp = Math.min(100, desp / receitaBase * 100);
      origem.pctMerc = 'entradas Domínio: ' + brl(merc) + ' ÷ ' + brl(receitaBase) + ' de receita';
      origem.pctDesp = 'entradas Domínio: ' + brl(desp) + ' ÷ receita do período';
    }
    const fora = res.filter(g => g.credita === null && g.valor > 0);
    if (fora.length) avisos.push('Fora do cálculo, por não serem compra: ' + fora.map(g => g.rotulo.toLowerCase() + ' ' + brl(g.valor)).join(' · ') + '.');
    const mesesEnt = [...new Set(ent.lancamentos.map(l => l.competencia))];
    const faltando = base.filter(c => !mesesEnt.includes(c));
    if (faltando.length) avisos.push('O relatório de entradas não cobre ' + faltando.length + ' mês(es) do faturamento (' + faltando.join(', ') + ') — o % de compras fica subestimado.');
  } else if (!ent) {
    avisos.push('Sem o relatório de entradas o % de compras não é calculado — é ele que decide o crédito no regime regular.');
  }

  return { campos, origem, avisos, fat, sim, ent, competencias };
}

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
