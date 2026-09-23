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
//   · ACOMPANHAMENTO DE SAÍDAS      (vendas de mercadoria: cliente, CFOP, valor)
//   · ACOMPANHAMENTO DE SERVIÇOS    (notas de serviço: cliente, valor)
//     — os dois últimos dão receita por mês, % de vendas para PJ e a parcela com ST (CFOP x405).
//       O relatório não traz CNPJ do cliente: PJ é reconhecida pelo nome (LTDA, ME, MUNICÍPIO…),
//       e a lista fica visível na prévia pra conferência.
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

import { aliqEfetiva } from './rt-motor.js';

// ---------- identificação ----------
export function detectarTipo(paginas) {
  const cabeca = norm((paginas[0] || []).slice(0, 14).join(' | '));
  if (cabeca.includes('RELATORIO DE FATURAMENTO')) return 'faturamento';
  if (cabeca.includes('DEMONSTRATIVO MENSAL')) return 'demonstrativo';
  if (cabeca.includes('ACOMPANHAMENTO DE ENTRADAS')) return 'entradas';
  if (cabeca.includes('ACOMPANHAMENTO DE SAIDAS')) return 'saidas';
  if (cabeca.includes('ACOMPANHAMENTO DE SERVICOS')) return 'servicos';
  if (cabeca.includes('SIMPLES NACIONAL')) return 'simples';
  return null;
}
function cabecalho(paginas) {
  const linhas = (paginas[0] || []).slice(0, 16);
  const alvo = l => norm(l);
  const doc = linhas.map(l => (l.match(/CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1]).find(Boolean) || null;
  let empresa = null;
  // acompanhamentos de saídas/serviços abrem com "NOME DA EMPRESA  Página:  0001", sem rótulo
  const m0 = (linhas[0] || '').match(/^[ \t]*([A-ZÀ-Ú0-9].*?)  +P[áa]gina/);
  if (m0 && !/^(CNPJ|Empresa|Per[íi]odo|Insc)[^:]{0,12}:/i.test(m0[1])) empresa = m0[1].replace(/^\d+\s*-\s*/, '').trim();
  for (const l of linhas) {
    if (empresa) break;
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
// `layout`: 'faturamento' (Saídas · Serviços · Outros · Total) ou 'demonstrativo'
// (Demonstrativo Mensal: Entradas · Saídas · Serviços · colunas em UFIR). Os dois viram o
// mesmo objeto: um mês por linha com saídas, serviços e total — o resto do sistema não distingue.
export function lerFaturamento(paginas, layout = 'faturamento') {
  const base = cabecalho(paginas);
  const meses = [];
  let totais = null;
  const demo = layout === 'demonstrativo';
  for (const linha of paginas.flat()) {
    const m = linha.match(/^\s*([A-Za-zçÇÃãÂâÉé]+)\s+(\d{4})\s+(.+)$/);
    if (m) {
      const idx = MESES.findIndex(x => semAcento(x) === semAcento(m[1]).toLowerCase());
      const v = valores(m[3]);
      if (idx >= 0 && !demo && v.length >= 4) {
        meses.push({ competencia: m[2] + '-' + String(idx + 1).padStart(2, '0'), saidas: v[0], servicos: v[1], outros: v[2], total: v[3] });
        continue;
      }
      if (idx >= 0 && demo && v.length >= 3) {
        meses.push({ competencia: m[2] + '-' + String(idx + 1).padStart(2, '0'), saidas: v[1], servicos: v[2], outros: 0, total: v[1] + v[2], entradas: v[0] });
        continue;
      }
    }
    if (/^\s*Totais\b/i.test(linha)) {
      const v = valores(linha);
      if (!demo && v.length >= 4) totais = { saidas: v[0], servicos: v[1], outros: v[2], total: v[3] };
      if (demo && v.length >= 3) totais = { saidas: v[1], servicos: v[2], outros: 0, total: v[1] + v[2], entradas: v[0] };
    }
  }
  if (!meses.length) throw new Error('não encontrei os meses no relatório de faturamento');
  meses.sort((a, b) => a.competencia < b.competencia ? -1 : 1);
  const soma = k => meses.reduce((a, x) => a + (x[k] || 0), 0);
  const conferido = totais ? Math.abs(soma('total') - totais.total) <= 0.05 : null;
  return { tipo: 'faturamento', layout, ...base, meses, totais: totais || { saidas: soma('saidas'), servicos: soma('servicos'), outros: soma('outros'), total: soma('total') }, conferido };
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
    m = l.match(/^\s*Percentual de Redu[çc][aã]o:\s*([\d.,]+)/);
    if (m) { atual.reducao = numBR(m[1]); continue; }
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
  // o mesmo anexo pode vir em mais de uma seção (ex.: revenda sem ST e revenda com ST/monofásico);
  // para o simulador o anexo é um só — soma as seções e guarda cada uma em `secoes`
  const porAnexo = new Map();
  anexos.forEach(a => {
    const g = porAnexo.get(a.anexo) || { anexo: a.anexo, descricao: a.descricao, receita: 0, das: 0, aliquota: null, partilha: {}, secoes: [] };
    g.receita += a.receita || 0; g.das += a.das || 0;
    Object.entries(a.partilha).forEach(([t, v]) => { g.partilha[t] = (g.partilha[t] || 0) + v; });
    g.secoes.push({ receita: a.receita, aliquota: a.aliquota, das: a.das, partilha: a.partilha, reducao: a.reducao || null });
    if (a.reducao) g.reducao = a.reducao;
    porAnexo.set(a.anexo, g);
  });
  const anexosAgregados = [...porAnexo.values()].map(g => ({ ...g, aliquota: g.receita ? g.das / g.receita * 100 : null }));
  anexos.length = 0; anexosAgregados.forEach(g => anexos.push(g));

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
    reducaoIcms: (anexos.find(a => a.reducao) || {}).reducao || null,
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


// ---------- 4) ACOMPANHAMENTO DE SAÍDAS / DE SERVIÇOS ----------
// Saídas:   "14  23/01/2026  6  1  36  2745  NOME DO CLIENTE  5-102  35  RS  250,00  ICMS  0,00 …"
//           (código, data, nota, série, espécie, código do cliente, nome, CFOP, AC, UF, valor contábil…)
// Serviços: "1  23/04/2026  1  84  2655  NOME DO CLIENTE  55  RS  250,00  0,00 …"  (sem CFOP; série pode vir vazia)
// Depois da data vêm até 4 números (nota, série, espécie, código do cliente); o nome é o que sobra
// até a âncora da direita (CFOP + AC + UF + valor nas saídas; AC + UF + valor nos serviços).
const RX_SAIDA = /(\d)-(\d{3})\s+(\d+)\s+([A-Z]{2})\s+(-?[\d.]+,\d{2})/;
const RX_SERV = /(\d{1,3})\s+([A-Z]{2})\s+(-?[\d.]+,\d{2})/;   // o AC pode vir colado ao nome ("…BENEFICENCIA55 RS")
const CONSUMIDOR = ['AO CONSUMIDOR', 'CONSUMIDOR', 'CONSUMIDOR FINAL', 'CLIENTES DIVERSOS', 'CLIENTE DIVERSOS', 'DIVERSOS', 'VENDA A CONSUMIDOR', 'NAO IDENTIFICADO'];
const PJ_TOKENS = ['LTDA', 'LTDA.', 'S/A', 'S.A', 'S.A.', 'SA', 'ME', 'EPP', 'EIRELI', 'MEI', 'CIA', 'CIA.', '&', 'COML', 'COM', 'COMERCIO', 'COMERCIAL', 'IND', 'INDUSTRIA', 'INDUSTRIAL',
  'MUNICIPIO', 'PREFEITURA', 'ESTADO', 'UNIAO', 'FUNDACAO', 'ASSOCIACAO', 'ASSOC', 'CONSELHO', 'INSTITUICAO', 'INSTITUTO', 'INST', 'CIRCULO', 'ESCOLA', 'EMEF', 'EMEI', 'EMEIF', 'COLEGIO',
  'ACADEMIA', 'CHURRASCARIA', 'HAMBURGUERIA', 'RESTAURANTE', 'PIZZARIA', 'LANCHERIA', 'PADARIA', 'CAFE', 'HOTEL', 'POUSADA', 'IGREJA', 'PAROQUIA', 'SINDICATO', 'COOPERATIVA', 'COOP',
  'CONDOMINIO', 'CLINICA', 'HOSPITAL', 'FARMACIA', 'SUPERMERCADO', 'MERCADO', 'LOJA', 'LOJAS', 'TRANSPORTES', 'TRANSP', 'SERVICOS', 'PARTICIPACOES', 'EMPREENDIMENTOS', 'TECNOLOGIA',
  'CONSTRUTORA', 'CONSTRUCOES', 'MECANICA', 'GRAFICA', 'DISTRIBUIDORA', 'CALCADOS', 'ESQUADRIAS', 'ARTEFATOS', 'FABRICACAO', 'CONFECCOES', 'MOVEIS', 'IMOVEIS', 'AGROPECUARIA', 'AGRO',
  'VETERINARIA', 'ODONTOLOGIA', 'CONTABILIDADE', 'ADVOCACIA', 'ADVOGADOS', 'ENGENHARIA', 'ARQUITETURA', 'AUTOMOTIVA', 'AUTO', 'POSTO', 'CENTRO', 'GRUPO', 'HOLDING', 'EMPRESA', 'SOCIEDADE',
  'ORGANIZACAO', 'ENTIDADE', 'CAMARA', 'SECRETARIA', 'DEPARTAMENTO', 'ASSISTENCIA', 'BENEFICENCIA', 'BENEFICIENCIA', 'TEMPLO', 'GONPA', 'MOSTEIRO', 'CONGREGACAO', 'MISSAO', 'LTD', 'INC', 'CORP'];
export function classificarCliente(nome) {
  const n = norm(nome).replace(/[.,]/g, m => m === '.' ? '.' : ' ');
  if (!n) return 'consumidor';
  if (CONSUMIDOR.some(c => n === c || n.startsWith(c + ' '))) return 'consumidor';
  const toks = n.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (toks.some(t => PJ_TOKENS.includes(t))) return 'pj';
  if (/\bS\/?A\b|\bLTDA\b|\bM\.?E\b|\bE\.?P\.?P\b/.test(n)) return 'pj';
  return 'pf';
}
export function lerVendas(paginas, tipo) {
  const base = cabecalho(paginas);
  const vendas = [];
  let totalGeral = null;
  const todas = paginas.flat();
  for (let i = 0; i < todas.length; i++) {
    const linha = todas[i];
    if (/Total (CFOP|Acumulador|Cliente)/i.test(linha)) continue;
    if (/Total Geral/i.test(linha)) {
      const v = valores(linha).concat(valores(todas[i + 1] || ''));
      if (v.length) totalGeral = v[0];
      continue;
    }
    const dm = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dm) continue;
    const alvo = tipo === 'saidas' ? linha.match(RX_SAIDA) : linha.match(RX_SERV);
    if (!alvo || alvo.index <= dm.index) continue;
    // entre a data e a âncora: nota, [série], espécie, código do cliente (números), depois o nome
    let meio = linha.slice(dm.index + dm[0].length, alvo.index).trim();
    const cabeca = [];
    while (cabeca.length < 4) {
      const m = meio.match(/^(\d+)(?:\s+|$)/);
      if (!m) break;
      cabeca.push(m[1]); meio = meio.slice(m[0].length);
    }
    const nome = meio.replace(/\s{2,}/g, ' ').trim();
    if (!nome) continue;
    const data = dm[1];
    const especie = cabeca.length >= 2 ? cabeca[cabeca.length - 2] : null;
    const cfop = tipo === 'saidas' ? alvo[1] + alvo[2] : null;
    const valor = numBR(tipo === 'saidas' ? alvo[5] : alvo[3]);
    vendas.push({
      tipo, data, competencia: data.slice(6, 10) + '-' + data.slice(3, 5),
      nota: cabeca[0] || null, especie, cliente: nome, classe: classificarCliente(nome),
      cfop, st: cfop ? cfop.slice(1) === '405' : false, valor
    });
  }
  if (!vendas.length) throw new Error('não encontrei notas no acompanhamento de ' + (tipo === 'saidas' ? 'saídas' : 'serviços'));
  const soma = vendas.reduce((a, x) => a + (x.valor || 0), 0);
  return { tipo, ...base, vendas, totalGeral, conferido: totalGeral != null ? Math.abs(soma - totalGeral) <= 0.05 : null, soma };
}

// ---------- resumo das vendas (saídas + serviços) por tipo de cliente ----------
export function resumirVendas(vendas, competencias) {
  const dentro = v => !competencias || !competencias.length || competencias.includes(v.competencia);
  const vs = vendas.filter(dentro);
  const total = vs.reduce((a, v) => a + (v.valor || 0), 0);
  const porDoc = vs.length ? vs.filter(v => v.classePorDocumento).length / vs.length >= 0.99 : false;
  const classes = { pj: { rotulo: porDoc ? 'Pessoa jurídica (CNPJ)' : 'Pessoa jurídica (pelo nome)', valor: 0, notas: 0, nomes: {} }, pf: { rotulo: porDoc ? 'Pessoa física (CPF)' : 'Pessoa física (pelo nome)', valor: 0, notas: 0, nomes: {} }, consumidor: { rotulo: 'Consumidor não identificado', valor: 0, notas: 0, nomes: {} } };
  vs.forEach(v => { const c = classes[v.classe]; c.valor += v.valor || 0; c.notas++; c.nomes[v.cliente] = (c.nomes[v.cliente] || 0) + (v.valor || 0); });
  Object.values(classes).forEach(c => { c.top = Object.entries(c.nomes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, valor]) => ({ nome, valor })); c.nClientes = Object.keys(c.nomes).length; delete c.nomes; });
  const mercadorias = vs.filter(v => v.tipo === 'saidas').reduce((a, v) => a + (v.valor || 0), 0);
  const servicos = vs.filter(v => v.tipo === 'servicos').reduce((a, v) => a + (v.valor || 0), 0);
  const st = vs.filter(v => v.st).reduce((a, v) => a + (v.valor || 0), 0);
  const porMes = {};
  vs.forEach(v => { const m = porMes[v.competencia] || (porMes[v.competencia] = { competencia: v.competencia, saidas: 0, servicos: 0, total: 0 }); m[v.tipo] += v.valor || 0; m.total += v.valor || 0; });
  return { total, mercadorias, servicos, st, pctPJ: total ? classes.pj.valor / total * 100 : null, classes, meses: Object.values(porMes).sort((a, b) => a.competencia < b.competencia ? -1 : 1) };
}

// ---------- 5) PLANILHA (XLS/XLSX/CSV exportado da Domínio) ----------
// Mesmos relatórios, em colunas: sem regex, sem coluna colada. `linhas` é a matriz da planilha
// (uma linha = um array de células, já como texto ou número). O cabeçalho da empresa vem nas
// primeiras linhas ("416 - EMPRESA", "CNPJ: …", "Período: …"), o título do relatório numa célula
// solta e a linha de nomes de coluna logo abaixo. A planilha traz o CNPJ/CPF do cliente, que o PDF
// não traz — por isso o % de PJ fica exato aqui (14 dígitos = PJ, 11 = PF, zeros/vazio = consumidor).
const celTxt = c => c == null ? '' : (typeof c === 'number' ? String(c) : String(c)).trim();
// data: texto "dd/mm/aaaa" ou número de série do Excel (o XLS da Domínio grava a data como número)
const dataCel = c => {
  if (c == null || c === '') return null;
  if (typeof c === 'number') { if (c < 20000 || c > 80000) return null; const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); }
  return String(c).match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || null;
};
const celNum = c => c == null || c === '' ? null : (typeof c === 'number' ? c : numBR(String(c)));
const acha = (cab, ...nomes) => { const n = cab.map(x => norm(x)); for (const nome of nomes) { const i = n.findIndex(x => x === norm(nome)); if (i >= 0) return i; } for (const nome of nomes) { const i = n.findIndex(x => x.startsWith(norm(nome))); if (i >= 0) return i; } return -1; };
export function detectarTipoPlanilha(linhas) {
  const cab = norm(linhas.slice(0, 12).map(l => (l || []).map(celTxt).join(' ')).join(' | '));
  if (cab.includes('RELATORIO DE FATURAMENTO')) return 'faturamento';
  if (cab.includes('DEMONSTRATIVO MENSAL')) return 'demonstrativo';
  if (cab.includes('ACOMPANHAMENTO DE ENTRADAS')) return 'entradas';
  if (cab.includes('ACOMPANHAMENTO DE SAIDAS')) return 'saidas';
  if (cab.includes('ACOMPANHAMENTO DE SERVICOS')) return 'servicos';
  return null;
}
function cabecalhoPlanilha(linhas) {
  const txt = linhas.slice(0, 10).map(l => (l || []).map(celTxt).filter(Boolean).join('  '));
  const paginas = [txt];
  return cabecalho(paginas);
}
export function lerPlanilha(linhas) {
  const tipo = detectarTipoPlanilha(linhas);
  if (!tipo) throw new Error('não reconheci a planilha (esperado: Relatório de Faturamento, Demonstrativo Mensal, Acompanhamento de Entradas, de Saídas ou de Serviços exportado da Domínio)');
  if (tipo === 'faturamento' || tipo === 'demonstrativo') {
    // mesma leitura do PDF: junta as células com dois espaços e usa o leitor de texto
    return lerFaturamento([linhas.map(l => (l || []).map(celTxt).filter(Boolean).join('  '))], tipo);
  }
  const base = cabecalhoPlanilha(linhas);
  // linha de colunas: tem "Cliente"/"Fornecedor" e "Valor Contábil"
  const iCab = linhas.findIndex(l => { const n = (l || []).map(norm); return n.some(x => x.startsWith('VALOR CONTABIL')) && n.some(x => x === 'CLIENTE' || x === 'FORNECEDOR'); });
  if (iCab < 0) throw new Error('não achei a linha de colunas (Cliente/Fornecedor + Valor Contábil) na planilha');
  const cab = linhas[iCab].map(celTxt);
  const col = {
    data: acha(cab, 'Data Entrada', 'Data Saída', 'Data Saida', 'Data Emissão', 'Data Emissao', 'Data'),
    nota: acha(cab, 'Nota'), especie: acha(cab, 'Espécie', 'Especie'),
    nome: acha(cab, 'Cliente', 'Fornecedor'), doc: acha(cab, 'CNPJ/CPF', 'CNPJ'),
    cfop: acha(cab, 'CFOP'), ac: acha(cab, 'AC.', 'AC'), uf: acha(cab, 'UF'), valor: acha(cab, 'Valor Contábil', 'Valor Contabil')
  };
  if (col.nome < 0 || col.valor < 0) throw new Error('a planilha não tem as colunas esperadas (Cliente/Fornecedor e Valor Contábil)');
  const itens = []; let totalGeral = null;
  for (let i = iCab + 1; i < linhas.length; i++) {
    const l = linhas[i] || []; const txt = l.map(celTxt);
    const junto = txt.join(' ');
    if (/Total Geral/i.test(junto)) { const v = l.map(celNum).filter(x => x != null && x !== 0); totalGeral = v.length ? v[0] : (totalGeral ?? 0); if (!v.length) { const prox = (linhas[i + 1] || []).map(celNum).filter(x => x != null); if (prox.length) totalGeral = prox[0]; } continue; }
    if (/Total (CFOP|Acumulador|Fornecedor|Cliente)/i.test(junto)) continue;
    const data = dataCel(l[col.data]);
    const valor = celNum(l[col.valor]);
    const nome = txt[col.nome];
    if (!data || valor == null || !nome) continue;
    const doc = col.doc >= 0 ? dig(txt[col.doc]) : '';
    const cfopTxt = col.cfop >= 0 ? dig(txt[col.cfop]) : '';
    const cfop = cfopTxt.length === 4 ? cfopTxt : null;
    const competencia = data.slice(6, 10) + '-' + data.slice(3, 5);
    if (tipo === 'entradas') {
      itens.push({ data, competencia, fornecedor: nome, documento: doc || null, cfop, ac: txt[col.ac] || null, uf: txt[col.uf] || null, valor, grupo: grupoDoCfop(cfop) });
    } else {
      const docLimpo = doc.replace(/^0+$/, '');
      const classe = docLimpo.length === 14 ? 'pj' : docLimpo.length === 11 ? 'pf' : (doc && !docLimpo ? 'consumidor' : classificarCliente(nome));
      itens.push({ tipo, data, competencia, nota: txt[col.nota] || null, especie: txt[col.especie] || null, cliente: nome, documento: docLimpo || null, classe, classePorDocumento: docLimpo.length === 14 || docLimpo.length === 11 || (!!doc && !docLimpo), cfop, st: cfop ? cfop.slice(1) === '405' : false, valor });
    }
  }
  if (!itens.length) throw new Error('não encontrei lançamentos na planilha de ' + tipo);
  const soma = itens.reduce((a, x) => a + (x.valor || 0), 0);
  const conferido = totalGeral != null && totalGeral !== 0 ? Math.abs(soma - totalGeral) <= 0.05 : null;
  if (tipo === 'entradas') return { tipo, ...base, lancamentos: itens, totalGeral, conferido, soma, fonte: 'planilha' };
  return { tipo, ...base, vendas: itens, totalGeral, conferido, soma, fonte: 'planilha', porDocumento: itens.filter(v => v.classePorDocumento).length / itens.length };
}

export function lerRelatorio(paginas) {
  const tipo = detectarTipo(paginas);
  if (tipo === 'faturamento') return lerFaturamento(paginas, 'faturamento');
  if (tipo === 'demonstrativo') return lerFaturamento(paginas, 'demonstrativo');
  if (tipo === 'simples') return lerSimples(paginas);
  if (tipo === 'entradas') return lerEntradas(paginas);
  if (tipo === 'saidas' || tipo === 'servicos') return lerVendas(paginas, tipo);
  throw new Error('não reconheci o relatório (esperado: Relatório de Faturamento, Demonstrativo Mensal, Simples Nacional, Acompanhamento de Entradas, de Saídas ou de Serviços da Domínio)');
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
  // vários relatórios de faturamento (12 meses + mês corrente): junta por competência, o mais recente vence
  const fats = rels.filter(r => r.tipo === 'faturamento');
  let fat = null;
  if (fats.length) {
    const porComp = new Map();
    fats.forEach(f => f.meses.forEach(m => porComp.set(m.competencia, m)));
    const meses = [...porComp.values()].sort((a, b) => a.competencia < b.competencia ? -1 : 1);
    const soma = k => meses.reduce((a, x) => a + (x[k] || 0), 0);
    fat = { ...fats[fats.length - 1], meses, totais: { saidas: soma('saidas'), servicos: soma('servicos'), outros: soma('outros'), total: soma('total') }, combinados: fats.length };
  }
  const sims = rels.filter(r => r.tipo === 'simples').sort((a, b) => (a.competencia || '') < (b.competencia || '') ? -1 : 1);
  const sim = sims[sims.length - 1] || null;
  // idem para entradas: junta os lançamentos por competência, o relatório mais recente vence no mês repetido
  const ents = rels.filter(r => r.tipo === 'entradas');
  let ent = null;
  if (ents.length) {
    const porComp = new Map();
    ents.forEach(e => { const comps = [...new Set(e.lancamentos.map(l => l.competencia))]; comps.forEach(c => porComp.set(c, e.lancamentos.filter(l => l.competencia === c))); });
    ent = { ...ents[ents.length - 1], lancamentos: [...porComp.values()].flat(), combinados: ents.length };
  }
  // saídas + serviços: junta por competência (o relatório mais recente vence no mês repetido)
  const vens = rels.filter(r => r.tipo === 'saidas' || r.tipo === 'servicos');
  let ven = null;
  if (vens.length) {
    const porComp = new Map();
    vens.forEach(r => { const comps = [...new Set(r.vendas.map(v => v.competencia))]; comps.forEach(c => porComp.set(r.tipo + '|' + c, r.vendas.filter(v => v.competencia === c))); });
    ven = { vendas: [...porComp.values()].flat(), combinados: vens.length, tipos: [...new Set(vens.map(r => r.tipo))] };
  }
  const campos = {}, origem = {}, avisos = [];

  // empresas diferentes no mesmo lote é erro de operação, não de leitura
  const docs = [...new Set(rels.filter(r => !r.outraEmpresa).map(r => r.cnpj).filter(Boolean))];
  if (docs.length > 1) avisos.push('Os relatórios são de CNPJs diferentes (' + docs.join(' · ') + ') — importe um cliente por vez.');
  rels.filter(r => r.outraEmpresa).forEach(r => avisos.push('Exceção aceita: ' + ({ simples: 'PGDAS', faturamento: 'faturamento', entradas: 'entradas', saidas: 'saídas', servicos: 'serviços' }[r.tipo] || r.tipo) + ' do CNPJ ' + r.cnpj + (r.empresa ? ' (' + r.empresa + ')' : '') + ' usado nesta ficha por decisão manual.'));

  // receita mensal: média dos meses com faturamento
  let competencias = [];
  if (fat) {
    // últimos 12 meses com faturamento: mais que isso é história, menos é o que há
    const comFat = fat.meses.filter(m => (m.total || 0) > 0).slice(-12);
    competencias = comFat.map(m => m.competencia);
    if (comFat.length) {
      const totalBase = comFat.reduce((a, m) => a + m.total, 0);
      const servBase = comFat.reduce((a, m) => a + (m.servicos || 0), 0);
      campos.receita = totalBase / comFat.length;
      const pctServ = totalBase ? servBase / totalBase * 100 : 0;
      origem.receita = 'faturamento Domínio: ' + brl(totalBase) + ' ÷ ' + comFat.length + ' mês(es) (' + comFat[0].competencia.slice(5) + '/' + comFat[0].competencia.slice(2, 4) + ' a ' + comFat[comFat.length - 1].competencia.slice(5) + '/' + comFat[comFat.length - 1].competencia.slice(2, 4) + ')'
        + (pctServ > 0 ? ' · ' + pct(pctServ) + '% serviço' : '');
    }
  } else if (ven) {
    // sem o relatório de faturamento, saídas + serviços dão a receita por mês (até 12 meses)
    const rv = resumirVendas(ven.vendas, null);
    const comRec = rv.meses.filter(m => m.total > 0).slice(-12);
    competencias = comRec.map(m => m.competencia);
    if (comRec.length) {
      const totalBase = comRec.reduce((a, m) => a + m.total, 0), servBase = comRec.reduce((a, m) => a + m.servicos, 0);
      campos.receita = totalBase / comRec.length;
      const pctServ = totalBase ? servBase / totalBase * 100 : 0;
      origem.receita = (ven.tipos.includes('servicos') ? 'saídas + serviços' : 'saídas') + ' Domínio: ' + brl(totalBase) + ' ÷ ' + comRec.length + ' mês(es) (' + comRec[0].competencia.slice(5) + '/' + comRec[0].competencia.slice(2, 4) + ' a ' + comRec[comRec.length - 1].competencia.slice(5) + '/' + comRec[comRec.length - 1].competencia.slice(2, 4) + ')'
        + (pctServ > 0 ? ' · ' + pct(pctServ) + '% serviço' : '');
      if (!ven.tipos.includes('servicos')) avisos.push('Só o acompanhamento de saídas: se a empresa também presta serviço, suba o acompanhamento de serviços — senão a receita fica só de mercadoria.');
      if (sim && sim.rpa && comRec.some(m => m.competencia === sim.competencia)) {
        const mes = comRec.find(m => m.competencia === sim.competencia);
        if (Math.abs(mes.total - sim.rpa) > 0.05) avisos.push('Em ' + sim.competencia + ' as saídas + serviços somam ' + brl(mes.total) + ' e o PGDAS traz ' + brl(sim.rpa) + ' de receita — diferença de ' + brl(mes.total - sim.rpa) + '; confira se falta relatório (serviços, outras saídas) ou se há receita fora dos acompanhamentos.');
      }
    }
  } else if (sim) {
    const h = sim.historico.filter(x => x.receita > 0);
    if (sim.rpa) { campos.receita = sim.rpa; origem.receita = 'PGDAS ' + sim.competencia + ': receita do período'; }
    if (h.length >= 12) avisos.push('Sem o relatório de faturamento, a receita vem de um mês só — suba o faturamento do ano para a média.');
  }

  // % de vendas para PJ e parcela com ST, das saídas + serviços
  let resVen = null;
  if (ven) {
    resVen = resumirVendas(ven.vendas, competencias);
    if (resVen.total > 0) {
      campos.pctPJ = resVen.pctPJ;
      const porDoc = ven.vendas.length ? ven.vendas.filter(v => v.classePorDocumento).length / ven.vendas.length : 0;
      origem.pctPJ = (ven.tipos.includes('servicos') ? 'saídas + serviços' : 'saídas') + ' Domínio: ' + brl(resVen.classes.pj.valor) + ' para ' + resVen.classes.pj.nClientes + ' cliente(s) ' + (porDoc >= 0.99 ? 'com CNPJ' : 'com nome de PJ') + ' ÷ ' + brl(resVen.total)
        + (resVen.classes.consumidor.valor > 0 ? ' (' + brl(resVen.classes.consumidor.valor) + ' a consumidor não identificado)' : '');
      if (porDoc >= 0.99) resVen.porDocumento = true;
      else avisos.push((porDoc > 0 ? 'Parte das notas veio sem CNPJ/CPF do cliente: nessas, ' : 'O relatório em PDF não traz o CNPJ do cliente: ') + 'PJ foi reconhecida pelo nome (LTDA, ME, MUNICÍPIO, ESCOLA…). Confira a lista na prévia — quem estiver do lado errado muda o %. A planilha (XLS) da Domínio traz o CNPJ e resolve isso.');
      if (resVen.mercadorias > 0 && resVen.st > 0) {
        const pctSt = resVen.st / resVen.mercadorias * 100;
        origem.stVendas = 'saídas Domínio: ' + brl(resVen.st) + ' com CFOP x405 (ST) = ' + pct(pctSt) + '% das vendas de mercadoria';
        if (campos.pctExcluidoST != null && Math.abs(pctSt - campos.pctExcluidoST) > 15) avisos.push('Parcela com ST nas saídas (' + pct(pctSt) + '%) e % excluído do DAS pelo PGDAS (' + pct(campos.pctExcluidoST) + '%) estão longe um do outro — vale entender por quê antes de calcular.');
      }
      if (fat) {
        const mesesFat = fat.meses.filter(m => competencias.includes(m.competencia));
        const totFat = mesesFat.reduce((a, m) => a + (m.total || 0), 0);
        if (totFat > 0 && Math.abs(totFat - resVen.total) / totFat > 0.01) avisos.push('Saídas + serviços (' + brl(resVen.total) + ') e faturamento (' + brl(totFat) + ') não batem no período — o % de PJ foi medido sobre o que está nos acompanhamentos.');
      }
    }
  }

  if (sim) {
    campos.anexo = sim.anexoPredominante;
    const outros = sim.anexos.filter(a => a.anexo !== sim.anexoPredominante && (a.receita || 0) > 0);
    origem.anexo = 'PGDAS ' + sim.competencia + ': Anexo ' + sim.anexoPredominante
      + ' com ' + brl(sim.anexos.find(a => a.anexo === sim.anexoPredominante).receita)
      + (outros.length ? ' (também ' + outros.map(a => 'Anexo ' + a.anexo + ' ' + brl(a.receita)).join(', ') + ')' : '');
    if (sim.aliquotaEfetiva != null) {
      campos.aliqEfetiva = sim.aliquotaEfetiva;
      origem.aliqEfetiva = 'PGDAS ' + sim.competencia + ': DAS ÷ receita tributada' + (outros.length ? ', já misturando Anexo ' + sim.anexoPredominante + ' e ' + outros.map(a => 'Anexo ' + a.anexo).join(', ') : '') + ' — vale sobre a tabela';
    }
    if (outros.length) avisos.push('A empresa tem receita em mais de um anexo (' + sim.anexoPredominante + ' predominante' + outros.map(a => ', ' + a.anexo + ' ' + brl(a.receita)).join('') + '). '
      + (sim.aliquotaEfetiva != null ? 'O simulador usa a alíquota efetiva do PGDAS (' + pct(sim.aliquotaEfetiva) + '%), que já mistura os anexos; o Anexo fica só de referência.' : 'Sem alíquota efetiva no PGDAS, a tabela do Anexo predominante é usada — o DAS pode sair subestimado.'));
    campos.rbt12 = sim.rbt12;
    origem.rbt12 = 'PGDAS ' + sim.competencia;
    // DAS pela tabela do anexo × DAS realmente apurado: a diferença é ICMS-ST, monofásico,
    // ISS retido ou redução de base — o que a ficha chama de "% do DAS já excluído"
    let dasTabela = null;
    try { if (sim.rbt12 > 0 && sim.receitaTributada > 0) dasTabela = sim.receitaTributada * aliqEfetiva(sim.anexoPredominante, sim.rbt12); } catch (e) { dasTabela = null; }
    if (dasTabela > 0 && sim.dasTotal >= 0) {
      const excl = Math.max(0, 1 - sim.dasTotal / dasTabela) * 100;
      campos.pctExcluidoST = excl;
      const motivos = [];
      if (sim.anexos.some(a => (a.secoes || []).length > 1)) motivos.push('receita com ST/monofásico');
      if (sim.reducaoIcms) motivos.push('redução de ' + pct(sim.reducaoIcms) + '% na base do ICMS');
      origem.pctExcluidoST = 'PGDAS ' + sim.competencia + ': DAS apurado ' + brl(sim.dasTotal) + ' contra ' + brl(dasTabela) + ' pela tabela do Anexo ' + sim.anexoPredominante
        + (excl > 0.05 ? ' — ' + pct(excl) + '% a menos' + (motivos.length ? ' (' + motivos.join(' e ') + ')' : '') : ' — sem exclusão');
    }
    if (sim.partilhaCbsPct != null) {
      // partilha medida sobre o DAS PELA TABELA (é sobre ele que o motor aplica a parcela CBS/IBS).
      // Difere da proporção sobre o DAS apurado quando há exclusão de ST/ISS.
      const partilhaNominal = dasTabela > 0 ? sim.cbsNoDas / dasTabela * 100 : sim.partilhaCbsPct;
      campos.partilha = partilhaNominal;
      campos.partilhaSobreDasApurado = sim.partilhaCbsPct;
      origem.partilha = 'PGDAS ' + sim.competencia + ': PIS + COFINS = ' + brl(sim.cbsNoDas)
        + (dasTabela > 0 ? ' = ' + pct(partilhaNominal) + '% do DAS pela tabela (' + pct(sim.partilhaCbsPct) + '% do DAS apurado)' : ' de ' + brl(sim.dasTotal) + ' do DAS');
      if (sim.anexos.some(a => (a.secoes || []).length > 1)) avisos.push('Parte da receita é monofásica de PIS/COFINS hoje (sem PIS/COFINS no DAS). Em 2027 a CBS alcança essa parcela também: a partilha da tabela oficial de 2027 é a referência; o PGDAS serve de conferência.');
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

  return { campos, origem, avisos, fat, sim, ent, ven, resVen, competencias };
}

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
