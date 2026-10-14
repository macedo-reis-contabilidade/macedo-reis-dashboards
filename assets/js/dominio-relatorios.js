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

import { normalizarDocumento, ehCnpj } from './utils.js';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = s => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();
const dig = s => String(s == null ? '' : s).replace(/\D/g, '');
// documento (CNPJ/CPF) sem pontuação — CNPJ alfanumérico (IN RFB 2.229/2024) mantém as letras
const docN = s => normalizarDocumento(s);
// "1.034.942,41" → 1034942.41 · devolve null se não for número
export function numBR(s) {
  const t = String(s == null ? '' : s).trim();
  if (!/\d/.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const RX_VALOR = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const valores = l => (String(l).match(RX_VALOR) || []).map(numBR);
// CNPJ (numérico ou alfanumérico: letras nas 12 primeiras posições) ou CPF, com a pontuação de sempre
const RX_DOC = /([0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/;

// ---------- CFOP: o que credita, o que não é compra ----------
// Sufixo do CFOP (os 3 últimos dígitos); o 1º dígito é só a origem (1 estado, 2 outro, 3 exterior).
const SUF = {
  mercadoria: ['101','102','111','113','116','117','118','120','121','122','124','125','126','128','401','403'],
  despesa:    ['251','252','253','254','255','256','257','301','302','303','304','305','306','351','352','353','354','355','356','360','406','407','551','552','553','554','555','556','557','601','602','603','604','605','651','652','653','933'],   // 406/407 ativo e consumo com ST; 933 serviço tomado (gera crédito em 2027)
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
  const doc = linhas.map(l => (l.match(/CNPJ:?\s*([0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2})/) || [])[1]).find(Boolean) || null;
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
  return { empresa, cnpj: doc ? docN(doc) : null, periodo: per ? per.trim() : null, ...periodoDoCabecalho(linhas) };
}
// o período declarado no cabeçalho em competências ("01/01/2026 até 31/03/2026", "01/01/2026  a  31/03/2026", "03/2026"
// → periodoDe '2026-01', periodoAte '2026-03'): diz quais meses o relatório cobre, inclusive os que não têm lançamento
function periodoDoCabecalho(linhas) {
  const l = linhas.find(x => /Per[íi]odo/i.test(x || ''));
  if (!l) return {};
  const t = l.slice(l.search(/Per[íi]odo/i)).split(/Emiss|Emitid|Data|Hora|P[áa]gina|Folha/i)[0];
  const ds = [...t.matchAll(/(?:\d{2}\/)?(\d{2})\/(\d{4})/g)].filter(m => +m[1] >= 1 && +m[1] <= 12).map(m => m[2] + '-' + m[1]);
  return ds.length ? { periodoDe: ds[0], periodoAte: ds[ds.length - 1] } : {};
}
// aritmética de competências 'AAAA-MM'
const idxMes = c => Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7)) - 1;
const deIdxMes = i => Math.floor(i / 12) + '-' + String(i % 12 + 1).padStart(2, '0');
const somaMeses = (c, n) => deIdxMes(idxMes(c) + n);
const difMeses = (a, b) => idxMes(b) - idxMes(a);
// competências de 'AAAA-MM' a 'AAAA-MM', inclusive
function competenciasEntre(de, ate) {
  const out = []; let [a, m] = de.split('-').map(Number); const [a2, m2] = ate.split('-').map(Number);
  while ((a < a2 || (a === a2 && m <= m2)) && out.length < 240) { out.push(a + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; a++; } }
  return out;
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
      fornecedor: nome || null, documento: doc ? docN(doc) : null,
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
// ---------- saídas: o que é receita e o que não é (25/09/2026) ----------
// Receita: venda (x101–x125, inclui industrialização por encomenda x124/x125), venda com ST (x401–x405),
// energia/comunicação/transporte (x251–x360), combustível (x651–x667), serviço com ISS (x933), exportação (7101–7127).
// Não é receita: remessas e retornos (x9xx, ex.: 5902 retorno da industrialização), transferências (x151–x159,
// x408/x409), devoluções de compra (x201–x212, x410–x413, x503, x553–x556, x660–x662), venda de ativo (x551).
export function grupoSaida(cfop) {
  if (!cfop) return 'receita';                                 // relatório de serviços: sem CFOP, é receita
  const n = parseInt(String(cfop).slice(1), 10), p = String(cfop)[0];
  if (p === '7') return n >= 101 && n <= 127 ? 'receita' : 'outras';
  if (n === 933) return 'receita';
  if ((n >= 101 && n <= 125) || (n >= 401 && n <= 405) || (n >= 251 && n <= 360) || (n >= 651 && n <= 667)) return 'receita';
  if (n >= 900 && n <= 999) return 'remessa';
  if ((n >= 151 && n <= 159) || n === 408 || n === 409) return 'transferencia';
  if ((n >= 201 && n <= 212) || (n >= 410 && n <= 413) || n === 503 || (n >= 553 && n <= 556) || (n >= 660 && n <= 662)) return 'devolucao';
  if (n >= 551 && n <= 552) return 'ativo';
  return 'outras';
}
const GRUPO_SAIDA_ROT = { remessa: 'remessas, retornos e outras saídas sem venda', transferencia: 'transferências entre estabelecimentos', devolucao: 'devoluções de compra', ativo: 'venda de ativo imobilizado', outras: 'outras saídas sem natureza de venda' };

// natureza da RECEITA pelo CFOP: separa venda de mercadoria de transporte, comunicação, energia e serviço
export function naturezaReceita(v) {
  if (v.tipo === 'servicos' || !v.cfop) return 'servico';
  const n = parseInt(String(v.cfop).slice(1), 10);
  if (n >= 351 && n <= 360) return 'transporte';
  if (n >= 301 && n <= 307) return 'comunicacao';
  if (n >= 251 && n <= 258) return 'energia';
  if (n === 933) return 'servico';
  return 'mercadoria';
}
// OS DÍGITOS DO CNAE (13/10/2026): só o código ("0121-1/01 - Horticultura…" → "0121101"; a descrição não entra) e, com 6
// dígitos, o zero da frente de volta — a consulta à Receita (BrasilAPI) manda o CNAE como número, e a subclasse 0121-1/01
// chegava "121101": o sistema lia divisão 12 (fumo) e o produtor de hortícolas virava comércio sem redução
export function digitosCnae(cnae) {
  const cod = String(cnae || '').split(/\s+-\s+/)[0];
  let d = cod.replace(/\D/g, '');
  if (d.length === 6) d = '0' + d;
  return d;
}
// Ramos que vendem produto com alíquota reduzida ou zero na LC 214 (alimentos/cesta básica, medicamentos, higiene,
// insumos agropecuários, dispositivos médicos e de acessibilidade, plantas). Nos outros (eletro, móveis, vestuário,
// construção, autopeças…) o mix cheio é o correto pela norma, não dado faltando. Pelo CNAE principal (7 dígitos ou prefixo).
// Módulo 07 (13/10/2026): entram material médico, odontológico e ortopédico (fabricação 3250-7/01 a 7/05, atacado 4645 e
// 4664, varejo 4773 — Anexos IV, V, XII e XIII), plantas e flores (4789-0/02), limpeza (4649-4/08, 4789-0/05 — Anexo VIII),
// café e soja em grão (4621, 4622 — in natura) e o atacado com predominância de alimentos (4691)
const RAMOS_COM_REDUCAO = ['01', '02', '03', '10', '3250701', '3250702', '3250703', '3250704', '3250705', '4621', '4622', '4623', '4631', '4632',
  '4633', '4634', '4637', '4639', '4644', '4645', '4646', '4649408', '4664', '4683', '4691', '4692',
  '4711', '4712', '4721', '4722', '4724', '4729', '4771', '4772', '4773', '4789002', '4789004', '4789005'];
export function ramoComReducao(cnae) {
  const d = digitosCnae(cnae);
  return !!d && RAMOS_COM_REDUCAO.some(p => d.startsWith(p));
}
// RAMOS COM ALÍQUOTA ZERO (13/10/2026, Módulo 07): no mercado, parte da venda é cesta básica (Anexo I) e hortifrúti e ovos
// (Anexo XV), com alíquota zero — testar só "metade com −60%" não pega a virada; no hortifrúti e no produtor de hortícolas,
// frutas e ovos, quase tudo é zero (LC 214, arts. 125 e 148)
export function ramoComZero(cnae) {
  const d = digitosCnae(cnae);
  if (/^(4711|4712)/.test(d)) return 'mercado';
  if (/^(4724|4633801|4633802|0121|0131|0132|0133|0155505)/.test(d)) return 'hortifruti';
  return null;
}
// SERVIÇO COM REDUÇÃO PELO CNAE (13/10/2026, Módulo 07): candidato, não enquadramento. Profissões do art. 127 da LC 214
// (−30% se a sociedade cumprir os requisitos do §1º, II — dado da empresa, no contrato social); serviços de educação e de
// saúde humana (−60% pela lista de NBS dos Anexos II e III, arts. 129 e 130), eventos e produções nacionais (Anexo X,
// art. 139) — as listas de NBS não estão na base; academia e escola de esporte (−30% sem os requisitos, se registrada no
// conselho, art. 127, §3º, e −60% se a aula for a educação desportiva da NBS 1.2205.12.00, art. 141, I — vale a maior)
const SERVICO_RED30 = [
  ['6911701', 'advocacia', 'advogados (art. 127, II)'],
  ['6920', 'contabilidade', 'contabilistas (art. 127, VII)'],
  ['7111', 'arquitetura', 'arquitetos e urbanistas (art. 127, III)'],
  ['7112', 'engenharia', 'engenheiros e agrônomos (art. 127, XI)'],
  // 7119-7: topografia, desenho técnico, perícia de segurança do trabalho e outras atividades técnicas — os estudos geológicos
  // (7119-7/02) ficam fora: geólogo não está no rol do art. 127
  ['7119701', 'serviços técnicos de engenharia', 'engenheiros, agrônomos e técnicos industriais (art. 127, XI e XVII)'],
  ['7119703', 'serviços técnicos de engenharia', 'engenheiros, agrônomos e técnicos industriais (art. 127, XI e XVII)'],
  ['7119704', 'serviços técnicos de engenharia', 'engenheiros, agrônomos e técnicos industriais (art. 127, XI e XVII)'],
  ['7119799', 'serviços técnicos de engenharia', 'engenheiros, agrônomos e técnicos industriais (art. 127, XI e XVII)'],
  ['7490103', 'agronomia', 'agrônomos e técnicos agrícolas (art. 127, XI e XVIII)'],
  ['7500', 'veterinária', 'médicos veterinários e zootecnistas (art. 127, XIII)'],
  ['7020', 'consultoria em gestão', 'administradores e economistas (art. 127, I e VIII), só com os sócios registrados no conselho']
];
const SERVICO_RED60 = [
  ['85', 'educação', 'Anexo II da LC 214 (serviços de educação, art. 129)'],
  ['86', 'saúde humana', 'Anexo III da LC 214 (serviços de saúde, art. 130)'],
  // (8230-0/02, casas de festas e eventos, fica fora: aluguel de salão e bufê não são produção de evento)
  ['8230001', 'eventos', 'Anexo X da LC 214 (feiras, congressos e eventos nacionais, art. 139)'],
  ['9001', 'espetáculos', 'Anexo X da LC 214 (espetáculos e shows nacionais, art. 139)'],
  ['5911', 'produção audiovisual', 'Anexo X da LC 214 (produção audiovisual nacional, art. 139)'],
  ['5912', 'pós-produção audiovisual', 'Anexo X da LC 214 (produção audiovisual nacional, art. 139)']
];
export function reducaoServicoPorCnae(cnae) {
  const d = digitosCnae(cnae);
  if (!d) return null;
  if (/^(9313|8591)/.test(d)) return { tipo: 'desporto', faixas: ['mixRed30', 'mixRed60'], ramo: d.startsWith('9313') ? 'academia' : 'ensino de esportes' };
  const r30 = SERVICO_RED30.find(([p]) => d.startsWith(p));
  if (r30) return { tipo: 'profissao', faixas: ['mixRed30'], ramo: r30[1], quem: r30[2] };
  const r60 = SERVICO_RED60.find(([p]) => d.startsWith(p));
  if (r60) return { tipo: 'anexo', faixas: ['mixRed60'], ramo: r60[1], anexo: r60[2] };
  return null;
}

// O CNAE do caso (rt_casos.cnae_base) às vezes tem só 4 dígitos; o do cadastro vem completo. Quando um é o começo do
// outro, vale o mais completo — a subclasse decide casos como 5620-1/01 (refeições para empresas) × 5620-1/04 (para
// consumo domiciliar). Se divergem, vale o do caso, como sempre.
export function cnaeMaisCompleto(base, cadastro) {
  const b = String(base || ''), c = String(cadastro || '');
  const db = digitosCnae(b), dc = digitosCnae(c);
  if (!db) return c;
  if (!dc) return b;
  return dc.length > db.length && dc.startsWith(db) ? c : b;
}

// PERFIL DE ATIVIDADE (27/09/2026): uma fonte só pra todo texto que depende do que a empresa faz.
// Ordem: o que as saídas mostram (CFOP) > CNAE do cadastro > anexo do Simples. Nunca um critério isolado.
// REFEIÇÕES PARA EMPRESAS (13/10/2026): o CNAE 5620-1/01 (alimentos preparados preponderantemente para empresas) segue
// "alimentação", mas vende a empresas por contrato — o fornecimento pode até ficar fora do regime de bares (LC 214,
// art. 273, a conferir). Marcado em refeicaoEmpresas, pra não cair nos textos e premissas de restaurante.
export function perfilAtividade({ natureza, cnae, anexo, restaurante } = {}) {
  const dg = digitosCnae(cnae);
  const div = parseInt(dg.slice(0, 2), 10);
  const cnae4 = dg.slice(0, 4);
  const cnae7 = dg.slice(0, 7);
  const tot = natureza ? Object.values(natureza).reduce((a, x) => a + (x || 0), 0) : 0;
  const maior = tot > 0 ? Object.entries(natureza).sort((a, b) => b[1] - a[1])[0] : null;
  const decisivo = maior && maior[1] / tot >= 0.6 ? maior[0] : null;
  let tipo, fonte;
  // 1) o que as saídas mostram, quando não é venda de mercadoria (transporte, serviço, comunicação, energia)
  if (decisivo && decisivo !== 'mercadoria') { tipo = decisivo; fonte = 'saídas por CFOP'; }
  // 2) CNAE específico: bar/restaurante e transporte têm regras próprias na LC 214
  else if (restaurante || div === 56) { tipo = 'alimentacao'; fonte = restaurante ? 'mix das notas' : 'CNAE'; }
  else if (div >= 49 && div <= 53) { tipo = 'transporte'; fonte = 'CNAE'; }
  // 3) saídas de mercadoria / anexo do Simples: mostram como a receita é de fato tributada
  else if (decisivo === 'mercadoria') { tipo = anexo === 'II' ? 'industria' : 'comercio'; fonte = 'saídas por CFOP'; }
  else if (anexo === 'I') { tipo = 'comercio'; fonte = 'anexo do Simples'; }
  else if (anexo === 'II') { tipo = 'industria'; fonte = 'anexo do Simples'; }
  else if (['III', 'IV', 'V'].includes(anexo)) { tipo = 'servico'; fonte = 'anexo do Simples'; }
  // 4) CNAE genérico, só sem nada melhor
  else if (div >= 45 && div <= 47) { tipo = 'comercio'; fonte = 'CNAE'; }
  else if (div >= 10 && div <= 32) { tipo = 'industria'; fonte = 'CNAE'; }
  else if (div >= 1 && div <= 3) { tipo = 'agro'; fonte = 'CNAE'; }
  else { tipo = 'servico'; fonte = 'CNAE'; }
  // TRANSPORTE DE PASSAGEIROS (13/10/2026, Módulo 07): linha regular de ônibus (4921, 4922) e trem ou metrô (4912) têm
  // tratamento próprio na LC 214 (isenção, alíquota zero ou −40%) — pelo CNAE, mesmo quando faturam com nota de serviço
  // (as saídas dizem "serviço"). Fretamento, táxi e escolar (4923, 4924, 4929) não são transporte público coletivo (art. 157):
  // alíquota cheia — e não "transporte de cargas", como o rótulo dizia
  const passageiros = ['4921', '4922', '4912'].includes(cnae4);
  const passageirosOutros = ['4923', '4924', '4929'].includes(cnae4);
  // trem e metrô (4912): o ferroviário urbano, semiurbano e metropolitano também tem alíquota zero (art. 285, I), que prevalece
  // sobre a isenção (art. 7º-A) — a confiança testa as duas. Fretamento entre cidades (4929 fora das subclasses municipais
  // 9/01 e 9/03): se o −40% do art. 286 o alcança, a conferir (o texto dos arts. 284 a 287 não está na base)
  const trilhos = cnae4 === '4912';
  const fretamentoIntermunicipal = cnae4 === '4929' && !['4929901', '4929903'].includes(cnae7);
  const refeicaoEmpresas = tipo === 'alimentacao' && cnae7 === '5620101';
  return {
    tipo, fonte, passageiros, passageirosOutros, trilhos, fretamentoIntermunicipal, refeicaoEmpresas,
    vendeMercadoria: ['comercio', 'industria', 'alimentacao', 'agro'].includes(tipo),
    // o transporte de passageiros que fatura com nota de serviço sai "serviço" pelas saídas, mas o rótulo é o do transporte
    rotulo: passageiros && tipo === 'servico' ? 'transporte de passageiros' : passageirosOutros && tipo === 'servico' ? 'transporte de passageiros (fretamento, táxi ou escolar)'
      : { transporte: passageiros ? 'transporte de passageiros' : passageirosOutros ? 'transporte de passageiros (fretamento, táxi ou escolar)' : 'transporte de cargas', comercio: 'comércio', industria: 'indústria', alimentacao: refeicaoEmpresas ? 'refeições para empresas' : 'bar e restaurante', agro: 'produção agropecuária', servico: 'prestação de serviços', comunicacao: 'comunicação', energia: 'energia' }[tipo] || tipo
  };
}

// maiores fornecedores com crédito e maiores clientes PJ, por CNPJ — pra consultar o regime de cada um
export function cnpjsParaConsultar(rels, n = 20) {
  const soma = (arr) => { const m = new Map(); arr.forEach(([d, v]) => m.set(d, (m.get(d) || 0) + v)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const ents = rels.filter(r => r.tipo === 'entradas').flatMap(r => r.lancamentos || []);
  const fornecedores = soma(ents.filter(l => ['mercadoria', 'despesa'].includes(l.grupo) && ehCnpj(l.documento)).map(l => [docN(l.documento), l.valor || 0])).slice(0, n);
  const vens = rels.filter(r => r.tipo === 'saidas' || r.tipo === 'servicos').flatMap(r => r.vendas || []);
  const clientes = soma(vens.filter(v => (v.grupo || 'receita') === 'receita' && ehCnpj(v.documento)).map(v => [docN(v.documento), v.valor || 0])).slice(0, n);
  return { fornecedores: fornecedores.map(x => x[0]), clientes: clientes.map(x => x[0]) };
}
// crédito de compra de fornecedor do Simples: só o IBS/CBS que ele recolheu dentro do DAS — estimado em 15% do crédito cheio;
// MEI: praticamente nenhum. (LC 214, art. 47, §9º, II; LC 123, art. 23, §1º-A — crédito limitado ao montante pago no Simples)
// Também usado pela análise técnica quando o regime dos fornecedores não foi consultado (fiscal-reforma.html).
export const CREDITO_FORNECEDOR_SIMPLES = 0.15;

export function conferirRbt12(meses, compPgdas, rbt12) {
  if (!meses || !meses.length || !compPgdas || !(rbt12 > 0)) return null;
  const [a, m] = String(compPgdas).split('-').map(Number);
  const janela = []; for (let k = 12; k >= 1; k--) { const d = new Date(a, m - 1 - k, 1); janela.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  const dentro = meses.filter(x => janela.includes(x.competencia));
  if (!dentro.length) return null;
  const soma = dentro.reduce((t, x) => t + (x.total || 0), 0);
  const brl2 = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const r = { meses: dentro.length, soma, rbt12, razao: soma / rbt12 * 100, alerta: false, texto: '' };
  if (soma > rbt12 * 1.1) { r.alerta = true; r.texto = 'Nos ' + dentro.length + ' meses que o RBT12 do PGDAS cobre, os relatórios somam ' + brl2(soma) + ' — mais que o RBT12 inteiro (' + brl2(rbt12) + '). Há receita nos relatórios que não foi declarada no Simples, ou o PGDAS é de outra competência. Confira antes de calcular.'; }
  else if (dentro.length === 12 && soma < rbt12 * 0.85) { r.alerta = true; r.texto = 'Nos 12 meses que o RBT12 cobre, os relatórios somam ' + brl2(soma) + ', ' + Math.round(soma / rbt12 * 100) + '% do RBT12 do PGDAS (' + brl2(rbt12) + ') — está faltando receita nos relatórios (serviços, filial: o RBT12 é da empresa inteira). Confira antes de calcular.'; }
  return r;
}

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
      cfop, st: cfop ? cfop.slice(1) === '405' : false, valor, grupo: grupoSaida(cfop)
    });
  }
  if (!vendas.length) throw new Error('não encontrei notas no acompanhamento de ' + (tipo === 'saidas' ? 'saídas' : 'serviços'));
  const soma = vendas.reduce((a, x) => a + (x.valor || 0), 0);
  return { tipo, ...base, vendas, totalGeral, conferido: totalGeral != null ? Math.abs(soma - totalGeral) <= 0.05 : null, soma };
}

// ---------- resumo das vendas (saídas + serviços) por tipo de cliente ----------
export function resumirVendas(vendas, competencias) {
  const dentro = v => !competencias || !competencias.length || competencias.includes(v.competencia);
  const noPeriodo = vendas.filter(dentro);
  const eReceita = v => (v.grupo || 'receita') === 'receita';
  const vs = noPeriodo.filter(eReceita);
  const fora = {};
  noPeriodo.filter(v => !eReceita(v)).forEach(v => { const f = fora[v.grupo] || (fora[v.grupo] = { rotulo: GRUPO_SAIDA_ROT[v.grupo] || v.grupo, valor: 0, notas: 0, cfops: {} }); f.valor += v.valor || 0; f.notas++; f.cfops[v.cfop] = (f.cfops[v.cfop] || 0) + (v.valor || 0); });
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
  const natureza = {}; vs.forEach(v => { const k = naturezaReceita(v); natureza[k] = (natureza[k] || 0) + (v.valor || 0); });
  return { total, mercadorias, servicos, st, pctPJ: total ? classes.pj.valor / total * 100 : null, classes, meses: Object.values(porMes).sort((a, b) => a.competencia < b.competencia ? -1 : 1), fora, natureza };
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
    const doc = col.doc >= 0 ? docN(txt[col.doc]) : '';
    const cfopTxt = col.cfop >= 0 ? dig(txt[col.cfop]) : '';
    const cfop = cfopTxt.length === 4 ? cfopTxt : null;
    const competencia = data.slice(6, 10) + '-' + data.slice(3, 5);
    if (tipo === 'entradas') {
      itens.push({ data, competencia, fornecedor: nome, documento: doc || null, cfop, ac: txt[col.ac] || null, uf: txt[col.uf] || null, valor, grupo: grupoDoCfop(cfop) });
    } else {
      const docLimpo = doc.replace(/^0+$/, '');
      const classe = docLimpo.length === 14 ? 'pj' : docLimpo.length === 11 ? 'pf' : (doc && !docLimpo ? 'consumidor' : classificarCliente(nome));
      itens.push({ tipo, data, competencia, nota: txt[col.nota] || null, especie: txt[col.especie] || null, cliente: nome, documento: docLimpo || null, classe, classePorDocumento: docLimpo.length === 14 || docLimpo.length === 11 || (!!doc && !docLimpo), cfop, st: cfop ? cfop.slice(1) === '405' : false, valor, grupo: tipo === 'servicos' ? 'receita' : grupoSaida(cfop) });
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
export function consolidar(rels, incluir, opcoes = {}) {
  const regimes = opcoes.regimes || null;   // Map cnpj → { simples, mei, razao, fonte }
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
  // PROCEDÊNCIA (13/10/2026): de onde veio cada campo, em que meses foi medido e o que pesa contra — vai com a simulação
  // e alimenta a confiança de cada número na ficha, na análise e no relatório (assets/js/rt-confianca.js)
  const proc = {};

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
      proc.receita = { fonte: 'faturamento', meses: competencias.slice(), texto: origem.receita };
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
      proc.receita = { fonte: 'saidas', meses: competencias.slice(), servicos: ven.tipos.includes('servicos'), texto: origem.receita };
      if (!ven.tipos.includes('servicos')) avisos.push('Só o acompanhamento de saídas: se a empresa também presta serviço, suba o acompanhamento de serviços — senão a receita fica só de mercadoria.');
      if (sim && sim.rpa && comRec.some(m => m.competencia === sim.competencia)) {
        const mes = comRec.find(m => m.competencia === sim.competencia);
        if (Math.abs(mes.total - sim.rpa) > 0.05) avisos.push('Em ' + sim.competencia + ' as saídas + serviços somam ' + brl(mes.total) + ' e o PGDAS traz ' + brl(sim.rpa) + ' de receita — diferença de ' + brl(mes.total - sim.rpa) + '; confira se falta relatório (serviços, outras saídas) ou se há receita fora dos acompanhamentos.');
      }
    }
  } else if (sim) {
    const h = sim.historico.filter(x => x.receita > 0);
    if (sim.rpa) { campos.receita = sim.rpa; origem.receita = 'PGDAS ' + sim.competencia + ': receita do período'; proc.receita = { fonte: 'pgdas', meses: [sim.competencia], texto: origem.receita }; }
    if (h.length >= 12) avisos.push('Sem o relatório de faturamento, a receita vem de um mês só — suba o faturamento do ano para a média.');
  }

  // % de vendas para PJ e parcela com ST, das saídas + serviços — medidos nas PRÓPRIAS saídas, nos últimos 12 meses com
  // venda delas (13/10/2026). O % é uma razão dentro das saídas: não precisa do período do faturamento. Antes valiam só os
  // meses do faturamento, e saídas de um mês fora dessa janela eram descartadas sem aviso — o % de PJ caía no deduzido
  // pelo perfil (cliente recém-chegado: saídas e entradas só de set/26, faturamento até ago/26)
  let resVen = null, mesesVen = [];
  if (ven) {
    mesesVen = [...new Set(ven.vendas.filter(v => (v.grupo || 'receita') === 'receita' && (v.valor || 0) > 0).map(v => v.competencia))].sort().slice(-12);
    resVen = resumirVendas(ven.vendas, mesesVen.length ? mesesVen : null);
    const foraV = Object.values(resVen.fora || {});
    if (foraV.length) avisos.push('Fora da receita, por não serem venda: ' + foraV.map(f => f.rotulo + ' ' + brl(f.valor) + ' (' + Object.keys(f.cfops).map(c => 'CFOP ' + c).join(', ') + ')').join('; ') + '.');
    if (resVen.total > 0) {
      campos.pctPJ = resVen.pctPJ;
      campos.pctPJTotal = resVen.pctPJ;
      if (regimes && regimes.size) {
        let vReg = 0, vSim = 0, vDesc = 0;
        ven.vendas.filter(v => (v.grupo || 'receita') === 'receita' && (!mesesVen.length || mesesVen.includes(v.competencia)) && ehCnpj(v.documento))
          .forEach(v => { const r = regimes.get(docN(v.documento)); const x = v.valor || 0; if (!r || r.simples == null) vDesc += x; else if (r.simples) vSim += x; else vReg += x; });
        if (vReg + vSim > 0) {
          const propReg = vReg / (vReg + vSim);
          const pjRegular = (vReg + vDesc * propReg) / resVen.total * 100;
          campos.clientesRegime = { regularPct: propReg * 100, pjRegularPct: pjRegular, cobertura: (vReg + vSim) / (vReg + vSim + vDesc) * 100 };
          campos.pctPJ = pjRegular;
          avisos.push('Regime dos clientes (Receita): das vendas a empresas consultadas, ' + pct(100 - propReg * 100) + '% são pra empresas do Simples, que não aproveitam o crédito — o % de clientes que creditam ficou em ' + pct(pjRegular) + '% (era ' + pct(resVen.pctPJ) + '% contando todas as PJ).');
        }
      }
      const porDoc = ven.vendas.length ? ven.vendas.filter(v => v.classePorDocumento).length / ven.vendas.length : 0;
      origem.pctPJ = (ven.tipos.includes('servicos') ? 'saídas + serviços' : 'saídas') + ' Domínio: ' + brl(resVen.classes.pj.valor) + ' para ' + resVen.classes.pj.nClientes + ' cliente(s) ' + (porDoc >= 0.99 ? 'com CNPJ' : 'com nome de PJ') + ' ÷ ' + brl(resVen.total)
        + (resVen.classes.consumidor.valor > 0 ? ' (' + brl(resVen.classes.consumidor.valor) + ' a consumidor não identificado)' : '');
      if (porDoc >= 0.99) resVen.porDocumento = true;
      else avisos.push((porDoc > 0 ? 'Parte das notas veio sem CNPJ/CPF do cliente: nessas, ' : 'O relatório em PDF não traz o CNPJ do cliente: ') + 'PJ foi reconhecida pelo nome (LTDA, ME, MUNICÍPIO, ESCOLA…). Confira a lista na prévia — quem estiver do lado errado muda o %. A planilha (XLS) da Domínio traz o CNPJ e resolve isso.');
      proc.pctPJ = { fonte: 'saidas', meses: mesesVen.slice(), porDocumento: porDoc >= 0.99, regimeConsultado: !!campos.clientesRegime, texto: origem.pctPJ };
      if (resVen.mercadorias > 0 && resVen.st > 0) {
        const pctSt = resVen.st / resVen.mercadorias * 100;
        origem.stVendas = 'saídas Domínio: ' + brl(resVen.st) + ' com CFOP x405 (ST) = ' + pct(pctSt) + '% das vendas de mercadoria';
        if (campos.pctExcluidoST != null && Math.abs(pctSt - campos.pctExcluidoST) > 15) avisos.push('Parcela com ST nas saídas (' + pct(pctSt) + '%) e % excluído do DAS pelo PGDAS (' + pct(campos.pctExcluidoST) + '%) estão longe um do outro — vale entender por quê antes de calcular.');
      }
      if (fat) {
        // só nos meses em que os dois relatórios existem: com períodos diferentes, comparar os totais não diz nada
        const comuns = mesesVen.filter(c => competencias.includes(c));
        const totFat = fat.meses.filter(m => comuns.includes(m.competencia)).reduce((a, m) => a + (m.total || 0), 0);
        const totVen = resVen.meses.filter(m => comuns.includes(m.competencia)).reduce((a, m) => a + (m.total || 0), 0);
        if (totFat > 0 && Math.abs(totFat - totVen) / totFat > 0.01) avisos.push('Nos meses em que os dois relatórios existem (' + rotuloMeses(comuns) + '), saídas + serviços (' + brl(totVen) + ') e faturamento (' + brl(totFat) + ') não batem — o % de PJ foi medido sobre o que está nos acompanhamentos.');
        if (mesesVen.some(c => !competencias.includes(c)) || mesesVen.length < competencias.length)
          avisos.push('O % de vendas para PJ foi medido nas saídas de ' + rotuloMeses(mesesVen) + ' (' + nMeses(mesesVen.length) + '); a receita média vem do faturamento de ' + rotuloMeses(competencias) + ' (' + nMeses(competencias.length) + ').'
            + (mesesVen.length <= 2 ? ' Com ' + (mesesVen.length === 1 ? 'um mês só' : 'dois meses') + ', o % pode não representar o ano — a análise mostra isso como confiança baixa.' : ''));
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
    // INDÚSTRIA EM 2027 (12/10/2026): o anexo da ficha continua o do PGDAS (é nele que alíquota, % excluído e partilha
    // foram medidos); o motor calcula 2027 no Anexo I (LC 123, art. 18, §5º, na redação do art. 517 da LC 214)
    if (sim.anexoPredominante === 'II') {
      origem.anexo += ' — em 2027, Anexo I';
      avisos.push('Indústria (Anexo II no PGDAS): em 2027 a atividade industrial passa ao Anexo I (LC 123, art. 18, §5º, na redação da LC 214) — o simulador já calcula 2027 no Anexo I. Produto com IPI mantido (Zona Franca de Manaus) segue no Anexo II: marque "IPI mantido" na ficha.');
    }
    campos.rbt12 = sim.rbt12;
    origem.rbt12 = 'PGDAS ' + sim.competencia;
    // o PGDAS é a apuração declarada: anexo, RBT12, alíquota, partilha e exclusões medidos nele
    ['anexo', 'rbt12', 'aliqEfetiva'].forEach(k => { if (campos[k] != null) proc[k] = { fonte: 'pgdas', meses: [sim.competencia], texto: origem[k] }; });
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
      proc.pctExcluidoST = { fonte: 'pgdas', meses: [sim.competencia], texto: origem.pctExcluidoST };
    }
    if (sim.partilhaCbsPct != null) {
      // partilha medida sobre o DAS PELA TABELA (é sobre ele que o motor aplica a parcela CBS/IBS).
      // Difere da proporção sobre o DAS apurado quando há exclusão de ST/ISS.
      const partilhaNominal = dasTabela > 0 ? sim.cbsNoDas / dasTabela * 100 : sim.partilhaCbsPct;
      campos.partilha = partilhaNominal;
      campos.partilhaSobreDasApurado = sim.partilhaCbsPct;
      origem.partilha = 'PGDAS ' + sim.competencia + ': PIS + COFINS = ' + brl(sim.cbsNoDas)
        + (dasTabela > 0 ? ' = ' + pct(partilhaNominal) + '% do DAS pela tabela (' + pct(sim.partilhaCbsPct) + '% do DAS apurado)' : ' de ' + brl(sim.dasTotal) + ' do DAS');
      proc.partilha = { fonte: 'pgdas', meses: [sim.competencia], texto: origem.partilha };
      if (sim.anexos.some(a => (a.secoes || []).length > 1)) avisos.push('Parte da receita é monofásica de PIS/COFINS hoje (sem PIS/COFINS no DAS). Em 2027 a CBS alcança essa parcela também: a partilha da tabela oficial de 2027 é a referência; o PGDAS serve de conferência.');
    }
    if (sim.aliquotaEfetiva != null) origem.aliquotaEfetiva = pct(sim.aliquotaEfetiva) + '% no PGDAS ' + sim.competencia;
  }

  // COMPRAS ÷ RECEITA DOS MESMOS MESES (13/10/2026): a receita de cada mês das entradas vem do faturamento; no mês que ele
  // não tem, da apuração do Simples (receita do período, ou o histórico do RBT12 que vem no PGDAS) ou das saídas +
  // serviços. Antes as compras dos meses que o relatório de entradas cobre eram divididas pela receita de TODOS os meses
  // do faturamento: entradas de 1 mês contra faturamento de 12 davam 1/12 do % real — e, com o mês das entradas fora da
  // janela do faturamento, zero, como se a empresa não comprasse nada (cliente recém-chegado: entradas e saídas só de set/26,
  // faturamento até ago/26). Mês de entrada sem receita conhecida fica fora da conta, com aviso.
  let mesesEnt = [], foraDoPeriodo = [], declarados = new Set();
  const receitaMes = new Map();   // competência → { valor, fonte }
  if (ent) {
    if (fat) fat.meses.forEach(m => { if ((m.total || 0) > 0) receitaMes.set(m.competencia, { valor: m.total, fonte: 'faturamento' }); });
    sims.forEach(s => {
      if (s.competencia && s.rpa > 0 && !receitaMes.has(s.competencia)) receitaMes.set(s.competencia, { valor: s.rpa, fonte: 'PGDAS ' + rotuloMeses([s.competencia]) });
      (s.historico || []).forEach(h => { if (h.receita > 0 && !receitaMes.has(h.competencia)) receitaMes.set(h.competencia, { valor: h.receita, fonte: 'histórico do RBT12 no PGDAS ' + rotuloMeses([s.competencia]) }); });
    });
    if (resVen) resVen.meses.forEach(m => { if (m.total > 0 && !receitaMes.has(m.competencia)) receitaMes.set(m.competencia, { valor: m.total, fonte: 'saídas' }); });
    // OS MESES QUE O RELATÓRIO DE ENTRADAS COBRE (13/10/2026): os que têm nota, os do meio entre a primeira e a última (o
    // relatório passou por eles: mês sem nota é compra zero e fica na conta) e, do período do cabeçalho, os meses com saída
    // lançada (a escrita existia). Sem o período no cabeçalho, contam os meses com saída lançada perto das notas (até 11
    // meses antes da primeira ou depois da última): quem exporta as entradas exporta o mesmo período das saídas.
    // Mês do cabeçalho sem nota de entrada nem de saída fica fora da conta — em cliente novo é o mês em que a escrita ainda
    // não era do escritório, não um mês sem compra —, mas A DÚVIDA FICA REGISTRADA: a procedência leva esses meses e o %
    // que daria se fossem compra zero, e a confiança testa os dois (rt-confianca.js)
    const mesesLanc = [...new Set(ent.lancamentos.map(l => l.competencia))].sort();
    const mesesSaida = new Set(ven ? ven.vendas.map(v => v.competencia) : []);
    const cobertos = new Set();
    ents.forEach(e => {
      const lc = [...new Set(e.lancamentos.map(l => l.competencia))].sort();
      if (lc.length) competenciasEntre(lc[0], lc[lc.length - 1]).forEach(c => cobertos.add(c));
      if (e.periodoDe && e.periodoAte && e.periodoDe <= e.periodoAte) competenciasEntre(e.periodoDe, e.periodoAte).forEach(c => { declarados.add(c); if (mesesSaida.has(c)) cobertos.add(c); });
      else if (lc.length) { const ini = somaMeses(lc[0], -11), fim = somaMeses(lc[lc.length - 1], 11); mesesSaida.forEach(c => { if (c >= ini && c <= fim) cobertos.add(c); }); }
    });
    mesesEnt = [...cobertos].filter(c => receitaMes.has(c)).sort().slice(-12);
    const semReceita = mesesLanc.filter(c => !receitaMes.has(c));
    if (semReceita.length) avisos.push('As entradas de ' + rotuloMeses(semReceita) + ' ficaram fora do % de compras: nenhum relatório traz a receita desse(s) mês(es) (faturamento, PGDAS ou saídas) — suba o faturamento ou o PGDAS do período.');
    // mês que o relatório de saídas cobre, com faturamento, mas sem nenhuma saída lançada: a escrita do mês não era do
    // escritório (cliente novo) — fica fora sem dúvida nenhuma
    const declSaida = new Set();
    vens.forEach(r => { if (r.periodoDe && r.periodoAte && r.periodoDe <= r.periodoAte) competenciasEntre(r.periodoDe, r.periodoAte).forEach(c => declSaida.add(c)); });
    const semEscrita = [...declarados].filter(c => !cobertos.has(c) && receitaMes.has(c) && declSaida.has(c) && !mesesSaida.has(c)).sort();
    if (semEscrita.length) avisos.push('O relatório de entradas vai de ' + rotuloMeses([...declarados]) + ', mas em ' + listaMeses(semEscrita) + ' não há nota de entrada nem de saída lançada, embora haja faturamento: a escrita ' + (semEscrita.length > 1 ? 'desses meses' : 'desse mês') + ' não era do escritório (cliente novo) — ' + (semEscrita.length > 1 ? 'ficaram' : 'ficou') + ' fora do % de compras.');
    // os meses da dúvida: do cabeçalho, sem nota nenhuma e sem as saídas do mês pra dizer se a escrita existia — os mais
    // perto dos medidos, até completar 12 com eles
    if (mesesEnt.length && mesesEnt.length < 12) {
      const ini = mesesEnt[0], fim = mesesEnt[mesesEnt.length - 1];
      const dist = c => c < ini ? difMeses(c, ini) : c > fim ? difMeses(fim, c) : 0;
      foraDoPeriodo = [...declarados].filter(c => !cobertos.has(c) && receitaMes.has(c) && !semEscrita.includes(c) && dist(c) <= 11)
        .sort((a, b) => dist(a) - dist(b) || (a < b ? 1 : -1)).slice(0, 12 - mesesEnt.length).sort();
    }
    if (!mesesLanc.length) avisos.push('O relatório de entradas não tem lançamentos — o % de compras não foi calculado.');
  } else {
    avisos.push('Sem o relatório de entradas o % de compras não é calculado — é ele que decide o crédito no regime regular.');
  }
  if (mesesEnt.length) {
    const base = mesesEnt;
    const receitaBase = base.reduce((a, c) => a + receitaMes.get(c).valor, 0);
    const fontesRec = [...new Set(base.map(c => receitaMes.get(c).fonte))];
    const res = resumirEntradas(ent, base);
    const somaSe = tipo => res.filter(g => (incluir ? incluir[g.grupo] : g.padrao) && g.credita === tipo).reduce((a, g) => a + g.valor, 0);
    let merc = somaSe('mercadoria'); let desp = somaSe('despesa');
    // devolução de compra (saídas x201–x212, x410–x413…): a mercadoria voltou pro fornecedor, o crédito também sai
    const devCompra = ven ? ven.vendas.filter(v => v.grupo === 'devolucao' && base.includes(v.competencia)).reduce((a, v) => a + (v.valor || 0), 0) : 0;
    if (devCompra > 0 && merc > 0) { merc = Math.max(0, merc - devCompra); avisos.push('Devoluções de compra nas saídas (' + brl(devCompra) + ') abatidas das compras com crédito.'); }
    let despAj = null;
    if (regimes && regimes.size) {
      // compras com crédito, por fornecedor, no período — quem é do Simples credita só uma fração
      const cred = ent.lancamentos.filter(l => base.includes(l.competencia) && ['mercadoria', 'despesa'].includes(l.grupo));
      let vSimples = 0, vMei = 0, vRegular = 0, vDesc = 0; const nomesS = {};
      cred.forEach(l => { const r = regimes.get(docN(l.documento)); const v = l.valor || 0;
        if (!r || r.simples == null) vDesc += v; else if (r.mei) vMei += v; else if (r.simples) { vSimples += v; nomesS[r.razao || l.fornecedor] = (nomesS[r.razao || l.fornecedor] || 0) + v; } else vRegular += v; });
      const conhecido = vSimples + vMei + vRegular, totalCred = conhecido + vDesc;
      if (conhecido > 0 && totalCred > 0) {
        const perdaConhecida = vSimples * (1 - CREDITO_FORNECEDOR_SIMPLES) + vMei;       // crédito que não vem
        // aplica ao total a proporção medida nos fornecedores consultados (os maiores — o resto segue a mesma mistura)
        const fator = Math.max(0, 1 - perdaConhecida / conhecido);
        merc = merc * fator; despAj = fator;
        campos.fornecedoresRegime = { simplesPct: (vSimples + vMei) / conhecido * 100, cobertura: conhecido / totalCred * 100, fator, maiores: Object.entries(nomesS).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => ({ nome: n, valor: v })) };
        avisos.push('Regime dos fornecedores (Receita): das compras com crédito consultadas (' + pct(conhecido / totalCred * 100) + '% do total), ' + pct((vSimples + vMei) / conhecido * 100) + '% vêm de empresas do Simples/MEI, que geram crédito reduzido — o % de compras foi ajustado.');
      }
    }
    if (receitaBase > 0) {
      if ((merc + desp) / receitaBase > 1) avisos.push('As compras com crédito (' + brl(merc + desp) + ') passam da receita do período (' + brl(receitaBase) + ') — o campo fica limitado a 100%. Confira estoque, período dos relatórios e se há entrada que não é compra.');
      if (despAj != null) desp = desp * despAj;
      campos.pctMerc = Math.min(100, merc / receitaBase * 100);
      campos.pctDesp = Math.min(100, desp / receitaBase * 100);
      const rotBase = rotuloMeses(base);
      const per = /\(\d+ meses\)$/.test(rotBase) ? rotBase : rotBase + ' (' + nMeses(base.length) + ')';
      origem.pctMerc = 'entradas Domínio de ' + per + ': ' + brl(merc) + ' ÷ ' + brl(receitaBase) + ' de receita no mesmo período (' + fontesRec.join(', ') + ')' + (campos.fornecedoresRegime ? ' — já descontado o crédito menor dos fornecedores do Simples (' + pct(campos.fornecedoresRegime.simplesPct) + '% das compras consultadas)' : '');
      origem.pctDesp = 'entradas Domínio de ' + per + ': ' + brl(desp) + ' ÷ receita do mesmo período';
      const pe = { fonte: 'entradas', meses: base.slice(), receitaDe: fontesRec, mesesFaturamento: competencias.length, regimeFornecedores: !!campos.fornecedoresRegime };
      // meses do cabeçalho sem nota nenhuma (nem de saída): fora da conta, com o % que daria se fossem compra zero — no
      // aviso e na procedência (a confiança testa os dois números)
      if (foraDoPeriodo.length) {
        const recFora = foraDoPeriodo.reduce((a, c) => a + receitaMes.get(c).valor, 0);
        const alt = Math.min(100, (merc + desp) / (receitaBase + recFora) * 100);
        pe.mesesIncertos = foraDoPeriodo.slice(); pe.pctSeZero = alt;
        avisos.push('O relatório de entradas vai de ' + rotuloMeses([...declarados]) + ', mas ' + listaMeses(foraDoPeriodo) + (foraDoPeriodo.length > 1 ? ' não têm' : ' não tem') + ' nenhuma nota de entrada nem de saída lançada: '
          + (foraDoPeriodo.length > 1 ? 'esses meses ficaram' : 'esse mês ficou') + ' fora do % de compras, porque não dá pra saber se a empresa não comprou nada ou se a escrita ainda não era do escritório (cliente novo). Se foram meses sem compra, o % seria ' + pct(alt) + '% (em vez de ' + pct(campos.pctMerc + campos.pctDesp) + '%) — a análise testa os dois. Subir as saídas do período resolve.');
      }
      proc.pctMerc = { ...pe, texto: origem.pctMerc };
      proc.pctDesp = { ...pe, texto: origem.pctDesp };
      // menos meses de entradas que de faturamento: o % é o desses meses — diz quais e de onde veio a receita
      if (competencias.length && base.length < competencias.length) avisos.push('Compras medidas em ' + per + ', contra ' + competencias.length + ' meses do faturamento: '
        + brl(merc + desp) + ' ÷ ' + brl(receitaBase) + ' de receita do mesmo período (' + fontesRec.join(', ') + ').'
        + (base.length < 6 ? ' Com menos meses, o % pode não representar o ano — estoque, compra grande, sazonalidade; a análise mostra isso como confiança ' + (base.length <= 2 ? 'baixa' : 'média') + '.' : ''));
    }
    const fora = res.filter(g => g.credita === null && g.valor > 0);
    if (fora.length) avisos.push('Fora do cálculo, por não serem compra: ' + fora.map(g => g.rotulo.toLowerCase() + ' ' + brl(g.valor)).join(' · ') + '.');
  }

  if (campos.pctPJ == null && opcoes.perfil) {
    const pf = opcoes.perfil;
    const industrializacao = ven && ven.vendas.some(v => /^[56]12[45]$/.test(String(v.cfop || '')));
    // refeições para empresas (CNAE 5620-1/01): o cliente é empresa por definição — nunca "consumidor final"
    let perfilPJ = null;
    if (pf.refeicaoEmpresas) { campos.pctPJ = 90; perfilPJ = 'refeicao_empresas'; origem.pctPJ = 'deduzido: CNAE 5620-1/01, refeições preparadas preponderantemente para empresas — confirme a carteira e o regime dos clientes (empresa do Simples não aproveita o crédito)'; }
    else if (pf.tipo === 'alimentacao' || (pf.tipo === 'comercio' && opcoes.varejo)) { campos.pctPJ = 0; perfilPJ = pf.tipo === 'alimentacao' ? 'alimentacao' : 'varejo'; origem.pctPJ = 'deduzido: ' + (pf.tipo === 'alimentacao' ? 'bar e restaurante' : 'varejo') + ' vende a consumidor final — confirme se houver venda relevante a empresas'; }
    else if (industrializacao) { campos.pctPJ = 100; perfilPJ = 'industrializacao'; origem.pctPJ = 'deduzido: industrialização por encomenda (CFOP x124/x125) é sempre para empresa'; }
    else if (pf.tipo === 'industria') { campos.pctPJ = 90; perfilPJ = 'industria'; origem.pctPJ = 'deduzido: indústria vende essencialmente a empresas — confirme importando as saídas em XLS (trazem o CNPJ do cliente)'; }
    // deduzido pelo perfil, não medido: a análise trata como confiança baixa (rt-confianca.js)
    if (perfilPJ) { campos.pctPJDeduzido = true; proc.pctPJ = { fonte: 'deduzido', perfil: perfilPJ, texto: origem.pctPJ }; }
  }
  // RBT12 × relatórios, MÊS COM MÊS (27/09/2026): o RBT12 é a soma dos 12 meses anteriores à competência do PGDAS.
  // Soma-se a receita dos relatórios nos meses dessa janela. Só há problema se os relatórios mostram MAIS receita que o
  // RBT12 inteiro (receita fora do Simples) — ou, quando cobrem os 12 meses, se ficam muito abaixo. Empresa que começou
  // a faturar há menos de um ano não dispara nada (nada de média × 12).
  const conf = conferirRbt12(fat ? fat.meses : resVen ? resVen.meses : null, sim && sim.competencia, campos.rbt12);
  if (conf) {
    campos.rbt12Conferencia = conf;
    if (conf.alerta) avisos.push(conf.texto);
  }
  // procedência dos campos e os meses em que compras e vendas foram medidos (podem não ser os do faturamento)
  return { campos, origem, avisos, fat, sim, ent, ven, resVen, competencias, procedencia: proc, mesesEntradas: mesesEnt, mesesVendas: mesesVen };
}

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// os meses em trechos seguidos — "set/25–out/25 e jun/26–ago/26", "set/25, out/25 e ago/26" —; com mais de 4 trechos,
// "9 meses entre set/25 e ago/26"
export function listaMeses(comps) {
  const l = [...new Set((comps || []).filter(Boolean))].sort();
  if (l.length < 2) return rotuloMeses(l);
  const trechos = [];
  l.forEach(c => { const t = trechos[trechos.length - 1]; if (t && difMeses(t[t.length - 1], c) === 1) t.push(c); else trechos.push([c]); });
  if (trechos.length === 1) return rotuloMeses(l);
  if (trechos.length > 4) return nMeses(l.length) + ' entre ' + rotuloMeses([l[0]]) + ' e ' + rotuloMeses([l[l.length - 1]]);
  const txt = trechos.map(t => t.length === 1 ? rotuloMeses(t) : rotuloMeses([t[0]]) + '–' + rotuloMeses([t[t.length - 1]]));
  return txt.slice(0, -1).join(', ') + ' e ' + txt[txt.length - 1];
}
// competências 'AAAA-MM' → "set/26", "jan/26–ago/26" ou, com buraco no meio, "jan/26–set/26 (3 meses)"
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nMeses = n => n + (n === 1 ? ' mês' : ' meses');
export function rotuloMeses(comps) {
  const l = [...new Set((comps || []).filter(Boolean))].sort();
  if (!l.length) return '';
  const r = c => MES_CURTO[Number(c.slice(5, 7)) - 1] + '/' + c.slice(2, 4);
  if (l.length === 1) return r(l[0]);
  const seguinte = c => { const [a, m] = c.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
  const continuo = l.every((c, i) => i === 0 || seguinte(l[i - 1]) === c);
  return r(l[0]) + '–' + r(l[l.length - 1]) + (continuo ? '' : ' (' + l.length + ' meses)');
}
