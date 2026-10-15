// ============================================================
// MACEDO & REIS — Chat da Reforma: de onde veio a resposta (a linha "Base da resposta", no fim de TODA resposta)
// Quem escreve a linha é o servidor, não o modelo: ela sai das fontes que a resposta cita (fontesDaResposta, em agente.js)
// e das ferramentas usadas. Material de curso (Prof. Fellipe Guerra) = todo código que não começa por "OF-"; os OF- são as
// fontes oficiais de fora dos cursos (módulo "Fontes oficiais (fora dos cursos)"), conferidas pelo escritório — a data é a
// leitura mais recente (rt_materiais.lido_em) entre as OF- citadas. A Base legal citada ([regra …]) e o simulador
// (listar_casos, ver_caso, simular) entram como acréscimo. Nada citado e nenhum caso consultado: a base não cobre a pergunta.
// Linha "Base da resposta" que o modelo escreva por conta própria sai: fica só a do servidor.
// Puro: testes em tests/reforma-chat.test.mjs.
// ============================================================

export const PREFIXO_OFICIAL = 'OF-';
export const FERRAMENTAS_DO_SIMULADOR = ['listar_casos', 'ver_caso', 'simular'];
const ROTULO = 'Base da resposta:';
const CURSO = 'materiais do curso do Prof. Fellipe Guerra';

export const ehOficial = codigo => String(codigo || '').trim().toUpperCase().startsWith(PREFIXO_OFICIAL);

// as categorias da resposta, nesta ordem e só as que valem: curso, oficial, regra, simulador (a ferramenta de caso que
// deu erro não conta: não trouxe nada)
export function categoriasDaBase({ fontes = [], etapas = [] } = {}) {
  const fs = (Array.isArray(fontes) ? fontes : []).filter(f => f && typeof f === 'object');
  const materiais = fs.filter(f => f.tipo === 'material');
  const cats = [];
  if (materiais.some(f => !ehOficial(f.codigo))) cats.push('curso');
  if (materiais.some(f => ehOficial(f.codigo))) cats.push('oficial');
  if (fs.some(f => f.tipo === 'regra')) cats.push('regra');
  if ((Array.isArray(etapas) ? etapas : []).some(e => e && FERRAMENTAS_DO_SIMULADOR.includes(e.ferramenta) && e.erro !== true)) cats.push('simulador');
  return cats;
}

// o dia de uma data do banco: data ("2026-10-15", ou data e hora sem fuso: o dia escrito) ou data e hora com fuso (o dia em
// Brasília, UTC−3) → "2026-10-15"; o que não é data → null
export function diaDaLeitura(v) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i.exec(String(v == null ? '' : v).trim());
  if (!m) return null;
  if (!m[3]) return m[1];
  const z = m[3].toUpperCase() === 'Z' ? 'Z' : m[3].length === 3 ? m[3] + ':00' : m[3].length === 5 ? m[3].slice(0, 3) + ':' + m[3].slice(3) : m[3];
  const t = Date.parse(m[1] + 'T' + m[2] + z);
  return Number.isFinite(t) ? new Date(t - 3 * 3600e3).toISOString().slice(0, 10) : m[1];
}

// a leitura mais recente entre as fontes oficiais citadas, em dd/mm/aaaa (null sem data). materiais: o Map código →
// material do servidor (base.porCodigo) ou a lista
export function dataDasOficiais(fontes, materiais) {
  const porCodigo = materiais instanceof Map ? materiais : new Map((Array.isArray(materiais) ? materiais : []).filter(Boolean).map(m => [m.codigo, m]));
  let max = null;
  (Array.isArray(fontes) ? fontes : []).forEach(f => {
    if (!f || f.tipo !== 'material' || !ehOficial(f.codigo)) return;
    const d = diaDaLeitura((porCodigo.get(f.codigo) || {}).lido_em);
    if (d && (!max || d > max)) max = d;
  });
  return max ? max.split('-').reverse().join('/') : null;
}

const emLista = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);

// ============================================================
// linhaDaBase({ fontes, etapas, materiais }) → a linha, uma só:
//   fontes: as citadas ([{ tipo: 'material'|'regra', codigo }], de fontesDaResposta) · etapas: as de responder (a ferramenta
//   de cada uma) · materiais: o Map código → material (com lido_em) ou a lista
// ============================================================
export function linhaDaBase({ fontes = [], etapas = [], materiais = [] } = {}) {
  const cats = categoriasDaBase({ fontes, etapas });
  const tem = c => cats.includes(c);
  const itens = [];
  let fora = '';
  if (tem('oficial')) {
    const data = dataDasOficiais(fontes, materiais);
    const em = data ? ' em ' + data : '';
    if (tem('curso')) itens.push(CURSO, 'fontes oficiais de fora do curso (conferidas pelo escritório' + em + ')');
    else { fora = 'fora dos materiais do curso — '; itens.push('fontes oficiais conferidas pelo escritório' + em); }
  } else if (tem('curso')) itens.push(CURSO);
  if (tem('regra')) itens.push('a Base legal do escritório');
  if (tem('simulador')) itens.push('o simulador do sistema');
  if (!itens.length) return ROTULO + ' nenhuma fonte da base (a base não cobre a pergunta).';
  return ROTULO + ' ' + fora + emLista(itens) + '.';
}

// o texto sem a linha "Base da resposta" que o modelo tenha escrito (com ou sem negrito); sem ela, o texto fica como veio
const LINHA_DO_MODELO = /^[ \t>*_]*Base da resposta[ \t]*[*_]*[ \t]*:/i;
export function semLinhaDaBase(texto) {
  const linhas = String(texto == null ? '' : texto).split('\n');
  const ficam = linhas.filter(l => !LINHA_DO_MODELO.test(l));
  return (ficam.length === linhas.length ? ficam.join('\n') : ficam.join('\n').replace(/\n{3,}/g, '\n\n')).trim();
}

// a linha no fim do texto, depois de uma linha em branco
export function comLinhaDaBase(texto, linha) {
  const corpo = semLinhaDaBase(texto);
  return corpo ? corpo + '\n\n' + linha : linha;
}
