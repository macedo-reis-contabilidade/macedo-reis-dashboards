// ============================================================
// MACEDO & REIS — Chat da Reforma: as ferramentas que o modelo chama
// buscar_base e ler_material leem a base de materiais (busca.js); listar_casos, ver_caso e simular leem os casos da
// campanha e rodam o MESMO motor e a MESMA confiança da ficha (assets/js/rt-motor.js e rt-confianca.js) — o chat nunca
// faz conta própria. Nada aqui grava no banco: o "e se" do simular é só leitura.
// Cada ferramenta devolve texto (é o que o modelo lê). Puras: o servidor injeta a base, os casos e a ficha aberta.
// ============================================================

import { buscar, lerMaterial, normalizar } from './busca.js';
import { rotuloTipo } from './prompt.js';
import { simular as simularMotor, entradaComAliquotas } from '../../../assets/js/rt-motor.js';
import { avaliarConfianca, inferirProcedencia, contextoDoCaso, ROT_DECISAO } from '../../../assets/js/rt-confianca.js';
import { cnaeMaisCompleto } from '../../../assets/js/dominio-relatorios.js';

const TIPOS = ['norma', 'orientacao', 'nota_tecnica', 'aula', 'exercicio', 'planilha', 'perguntas', 'sintese', 'relatorio', 'artigo'];
const FILTROS = ['todos', 'simulados', 'nao_simulados', 'sem_conclusao', 'a_confirmar', 'por_fora', 'opte_se', 'por_dentro', 'empate', 'decididos', 'pendentes'];

// campos que o "e se" pode trocar (os da entrada do motor — rt-motor.js, simular)
export const CAMPOS = {
  receita: 'receita mensal (R$)', rbt12: 'RBT12 (R$)', aliqEfetivaInformada: 'alíquota efetiva do PGDAS (%)', partilha: 'partilha CBS/IBS do DAS (%)',
  pctExcluidoST: '% do DAS excluído hoje (ICMS-ST, ISS retido, monofásico)', pctReceitaMonofasica: '% da receita monofásica de PIS/COFINS hoje',
  pctPJ: '% da receita vendida a clientes PJ que aproveitam o crédito', pctComprasMercadorias: 'compras de mercadorias (% da receita)',
  pctComprasDespesas: 'despesas com crédito (% da receita)', pctComprasComCredito: '% das compras de mercadorias que credita à alíquota cheia (pelo NCM)',
  pctDespesasComCredito: 'crédito das despesas (% do cheio)', pctImpostoEmbutido: 'imposto embutido nas compras (% do valor das notas)',
  mixCheia: 'vendas à alíquota cheia (%)', mixRed60: 'vendas com redução de 60% (%)', mixRed40: 'vendas com redução de 40% — bares e restaurantes (%)',
  mixRed30: 'vendas com redução de 30% (%)', mixZero: 'vendas com alíquota zero (%)', cbs: 'CBS de 2027 (%)', ibs: 'IBS de 2027 (%)',
  creditoEstoqueMes: 'crédito de estoque por mês (R$)'
};
export const BOOLS = { ipiMantido: 'IPI mantido (Zona Franca) — indústria segue no Anexo II', issFixo: 'ISS fixo por profissional', precoFinalMantido: 'preço final igual ao de hoje (sensibilidade)', excluirIcmsIssDaBase: 'ICMS/ISS do DAS fora da base do débito (padrão: sim)' };
// de qual procedência é cada campo (a mesma chave da ficha, CAMPO_PROC): o número trocado no "e se" vira "informado"
const PROC_DO_CAMPO = { receita: 'receita', rbt12: 'rbt12', anexo: 'anexo', aliqEfetivaInformada: 'aliqEfetiva', partilha: 'partilha', pctExcluidoST: 'pctExcluidoST',
  pctReceitaMonofasica: 'pctReceitaMonofasica', pctComprasMercadorias: 'pctMerc', pctComprasDespesas: 'pctDesp', pctPJ: 'pctPJ', mixCheia: 'mix', mixRed60: 'mix',
  mixRed40: 'mix', mixRed30: 'mix', mixZero: 'mix', pctComprasComCredito: 'pctCred', pctDespesasComCredito: 'pctDespCred', pctImpostoEmbutido: 'pctEmb', creditoEstoqueMes: 'estoque' };
const MIX = ['mixCheia', 'mixRed60', 'mixRed40', 'mixRed30', 'mixZero'];

const caso = { type: 'string', description: 'nome (ou parte do nome) da empresa ou o id do caso; vazio = a ficha aberta na tela' };
export const DEFINICOES = [
  { name: 'buscar_base',
    description: 'Busca nas leituras completas dos materiais da base da Reforma (o texto integral de cada leitura, por seção). Devolve os trechos mais relevantes com o código do material, o tipo e a seção. Termos específicos (artigo, assunto, código do material) funcionam melhor.',
    input_schema: { type: 'object', properties: {
      consulta: { type: 'string', description: 'o que procurar, em português' },
      modulo: { type: 'string', description: 'opcional: parte do nome do módulo (ex.: "Módulo 05", "Imersão", "Atualizações", "Renda")' },
      tipo: { type: 'string', enum: TIPOS, description: 'opcional: só materiais deste tipo' },
      limite: { type: 'integer', minimum: 1, maximum: 10, description: 'quantos trechos (padrão 6)' } }, required: ['consulta'] } },
  { name: 'ler_material',
    description: 'Lê um material da base pelo código. Sem "secao", devolve o cabeçalho e o sumário das seções; com "secao" (o número do sumário ou parte do título), devolve o texto da seção e das seguintes, até cerca de 8 mil caracteres.',
    input_schema: { type: 'object', properties: { codigo: { type: 'string', description: 'código do material (ex.: M05-LC214-PARTE-GERAL)' }, secao: { type: 'string', description: 'número da seção no sumário ou parte do título' } }, required: ['codigo'] } },
  { name: 'listar_casos',
    description: 'Lista os casos da campanha da Reforma (empresas do Simples) com a situação de cada um: o resultado da simulação gravada (por dentro, por fora, opte se o comercial confirmar, empate técnico, sem conclusão; "a confirmar" quando depende de número a confirmar, com o que falta medir) ou a triagem por CNAE de quem ainda não foi simulado, a decisão gravada e o status. Em páginas (40 por página).',
    input_schema: { type: 'object', properties: { filtro: { type: 'string', enum: FILTROS, description: 'padrão: todos' }, busca: { type: 'string', description: 'parte do nome ou do CNAE' },
      pagina: { type: 'integer', minimum: 1, description: 'a página (padrão 1)' }, limite: { type: 'integer', minimum: 5, maximum: 80, description: 'casos por página (padrão 40)' } } } },
  { name: 'ver_caso',
    description: 'Mostra um caso da campanha: empresa, CNAE, decisão, status e fundamento gravados, a simulação gravada (os números usados, custo por dentro e por fora no 1º semestre de 2027, crédito que os clientes PJ aproveitam, resultado, margem da decisão, carteira de virada) e a confiança dos números (de onde veio cada um, o nível, se muda o resultado, a partir de quanto vira e o que falta medir). Com números calculados e não gravados na tela, mostra os dois.',
    input_schema: { type: 'object', properties: { caso } } },
  { name: 'simular',
    description: 'Roda o simulador do sistema (a mesma conta e a mesma confiança da ficha) num caso, com números trocados — o "e se" —, sem gravar nada. Devolve o resultado de antes e o novo, lado a lado. Os percentuais vão como a equipe digita (20 = 20%). Se trocar uma faixa do mix sem informar mixCheia, a cheia fica com o resto até 100%.',
    input_schema: { type: 'object', properties: { caso,
      alteracoes: { type: 'object', description: 'os números a trocar', properties: {
        ...Object.fromEntries(Object.entries(CAMPOS).map(([k, d]) => [k, { type: 'number', description: d }])),
        ...Object.fromEntries(Object.entries(BOOLS).map(([k, d]) => [k, { type: 'boolean', description: d }])),
        anexo: { type: 'string', enum: ['I', 'II', 'III', 'IV', 'V'], description: 'anexo do Simples no PGDAS (hoje)' } } } },
      required: ['alteracoes'] } }
];

// ---------- formatação ----------
const fin = v => v != null && v !== '' && Number.isFinite(+v);
const brl = v => fin(v) ? (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const pct = v => fin(v) ? (+v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' : '—';
const dataBR = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
const TRI = { candidato_por_fora: 'triagem por CNAE: candidato por fora', simular: 'triagem por CNAE: simular', tende_por_dentro: 'triagem por CNAE: tende por dentro' };
const SIT = { por_dentro: 'por dentro', por_fora: 'por fora', opte_se: 'opte, se o comercial confirmar', empate: 'empate técnico (manter)', sem_conclusao: 'sem conclusão' };
const DEC = { pendente: 'pendente', por_dentro: 'decidido por dentro', por_fora: 'decidido por fora' };
const ROT_TIPO_VEREDITO = { OPTE: 'por fora', OPTE_SE: 'opte, se o comercial confirmar', MANTENHA: 'manter dentro do DAS' };
const ROT_CONCLUSAO = { firme: 'firme', a_confirmar: 'A CONFIRMAR', sem_conclusao: 'SEM CONCLUSÃO' };

export function nomeDoCaso(c) {
  const cl = c.cliente || {};
  return (cl.nome_principal || '—') + (cl.nome_fantasia && cl.nome_fantasia !== cl.nome_principal ? ' (' + cl.nome_fantasia + ')' : '');
}
export function lerSimulacao(c) { try { return JSON.parse(c.sim_obs || 'null'); } catch (e) { return null; } }

// a situação na lista: o mesmo critério da ficha (lerSim/resultadoSim em fiscal-reforma.html)
export function situacaoDoCaso(c) {
  if (c.sim_custo_dentro == null || c.sim_custo_fora == null) return { simulado: false, r: null, rotulo: TRI[c.triagem] || 'sem simulação' };
  const j = lerSimulacao(c);
  let r = null;
  if (j && j.confianca && j.confianca.conclusao === 'sem_conclusao') r = 'sem_conclusao';
  else if (j && j.veredito === 'OPTE') r = 'por_fora';
  else if (j && j.veredito === 'OPTE_SE') r = 'opte_se';
  else if (j && j.veredito === 'MANTENHA') r = (j.empate === true || /^Empate técnico/.test(j.frase || '')) ? 'empate' : 'por_dentro';
  if (!r) r = +c.sim_custo_fora < +c.sim_custo_dentro ? 'por_fora' : 'por_dentro';
  const aConfirmar = !!(j && j.confianca && j.confianca.conclusao === 'a_confirmar');
  return { simulado: true, r, aConfirmar, j, rotulo: 'simulado: ' + SIT[r] + (aConfirmar ? ' (a confirmar)' : '') };
}

const PALAVRAS_FORA = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'e', 'de', 'da', 'do', 'dos', 'das']);
export function acharCaso(casos, termo, fichaId) {
  const t = String(termo || '').trim();
  if (!t) {
    if (!fichaId) return { erro: 'Nenhuma ficha aberta na tela: diga o nome da empresa (ou use listar_casos).' };
    const c = casos.find(x => x.id === fichaId);
    return c ? { caso: c } : { erro: 'A ficha aberta não está entre os casos da campanha.' };
  }
  const porId = casos.find(x => x.id === t);
  if (porId) return { caso: porId };
  const ws = normalizar(t).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !PALAVRAS_FORA.has(w));
  if (!ws.length) return { erro: 'Diga o nome da empresa.' };
  const cands = casos.filter(c => { const n = ' ' + normalizar(nomeDoCaso(c)).replace(/[^a-z0-9]+/g, ' ') + ' '; return ws.every(w => n.includes(w)); });
  if (cands.length === 1) return { caso: cands[0] };
  if (!cands.length) return { erro: 'Nenhum caso da campanha com "' + t + '". Use listar_casos com "busca" pra achar o nome.' };
  const exato = cands.filter(c => normalizar(nomeDoCaso(c)).startsWith(normalizar(t)));
  if (exato.length === 1) return { caso: exato[0] };
  return { erro: 'Mais de um caso com "' + t + '": ' + cands.slice(0, 10).map(nomeDoCaso).join(' · ') + '. Diga qual.' };
}

function cnaeDoCaso(c) { return String(cnaeMaisCompleto(c.cnae_base, (c.cliente || {}).cnae_principal) || '—'); }
// só o código (a lista tem de caber: a descrição do cadastro chega a 250 caracteres)
const cnaeCurto = c => cnaeDoCaso(c).split(/\s+-\s+/)[0].trim() || '—';

// os números da entrada, como a ficha mostra
function descreverEntrada(e) {
  const mix = MIX.filter(k => +e[k] > 0).map(k => ({ mixCheia: 'cheia', mixRed60: '−60%', mixRed40: '−40%', mixRed30: '−30%', mixZero: 'zero' }[k] + ' ' + pct(e[k]))).join(', ') || '—';
  return 'receita ' + brl(e.receita) + '/mês · RBT12 ' + brl(e.rbt12) + ' · Anexo ' + (e.anexo || '—') + (e.ipiMantido ? ' (IPI mantido)' : '') + (e.issFixo ? ' (ISS fixo)' : '')
    + (fin(e.aliqEfetivaInformada) ? ' · alíquota efetiva do PGDAS ' + pct(e.aliqEfetivaInformada) : '') + ' · partilha CBS/IBS ' + pct(e.partilha)
    + ' · % do DAS excluído hoje ' + pct(e.pctExcluidoST || 0) + ' · receita monofásica ' + pct(e.pctReceitaMonofasica || 0)
    + '\n  clientes PJ ' + pct(e.pctPJ || 0) + ' · compras de mercadorias ' + pct(e.pctComprasMercadorias || 0) + ' e despesas ' + pct(e.pctComprasDespesas || 0) + ' da receita'
    + ' · crédito das compras ' + (fin(e.pctComprasComCredito) ? pct(e.pctComprasComCredito) + ' à alíquota cheia (NCM)' : 'segue o mix das vendas')
    + (fin(e.pctDespesasComCredito) ? ' · crédito das despesas ' + pct(e.pctDespesasComCredito) + ' do cheio' : '')
    + ' · imposto embutido nas compras ' + pct(e.pctImpostoEmbutido || 0)
    + '\n  mix das vendas: ' + mix + ' · CBS ' + pct(e.cbs) + ' + IBS ' + pct(e.ibs) + (+e.creditoEstoqueMes > 0 ? ' · crédito de estoque ' + brl(e.creditoEstoqueMes) + '/mês' : '')
    + (e.precoFinalMantido ? ' · preço final mantido' : '') + (e.excluirIcmsIssDaBase === false ? ' · base cheia (ICMS/ISS dentro)' : '');
}

function descreverResultado(r) {
  const s = r.semestre, v = r.veredito;
  return 'Semestre jan–jun/2027: custo por dentro ' + brl(s.custoDentro) + ' · por fora ' + brl(s.custoFora) + ' (por fora ' + (s.diferenca >= 0 ? brl(s.diferenca) + ' mais caro' : brl(-s.diferenca) + ' mais barato') + ')'
    + '\n  crédito que vai aos clientes: por dentro ' + brl(s.creditoClienteDentro) + ', por fora ' + brl(s.creditoClienteFora) + ' · aproveitado pela carteira PJ: ' + brl(s.aproveitadoDentro) + ' → ' + brl(s.aproveitadoFora)
    + '\n  anexo em 2027: ' + (r.fatores && r.fatores.anexo2027 || '—')
    + '\nResultado do simulador: ' + (ROT_TIPO_VEREDITO[v.tipo] || v.tipo) + (v.empate ? ' (empate técnico)' : '')
    + (v.margem != null ? ' · margem da decisão ' + pct(v.margem) + (v.apertada ? ' (apertada)' : '') : '')
    + (v.carteiraVirada != null ? ' · carteira de virada ' + pct(v.carteiraVirada) : '')
    + '\n  ' + v.frase;
}

// o ponto de virada vai à parte do valor testado ("Com 97,2%, … — vira a partir de 84,5%": o que importa é o 84,5%)
const virada = it => it.virada && it.virada.texto ? ' PONTO DE VIRADA: ' + it.virada.texto + ' (daí em diante, "' + (ROT_DECISAO[it.virada.decisao] || it.virada.decisao) + '").' : '';
function descreverConfianca(av) {
  const linhas = av.itens.map(it => '  · ' + it.rotulo + ': ' + it.valor + ' — ' + (it.selo || it.nivel) + (it.categoria === 'premissa' ? ' (premissa da lei)' : '')
    + (it.fonte ? ' · fonte: ' + it.fonte : '') + (it.periodo && it.periodo !== '—' ? ' (' + it.periodo + ')' : '') + '. ' + (it.motivo || '') + (it.efeito ? ' ' + it.efeito : '')
    + virada(it) + (it.falta ? ' Falta: ' + it.falta + '.' : ''));
  return 'Confiança dos números: ' + (ROT_CONCLUSAO[av.conclusao] || av.conclusao)
    + (av.conclusao === 'sem_conclusao' ? ' (o simulador não escolhe lado: nenhum dos dois está sustentado até medir o que falta)' : '')
    + (av.decisivos.length ? ' — decide: ' + av.decisivos.map(it => it.rotulo + (it.virada && it.virada.texto ? ' (vira a partir de ' + it.virada.texto + ')' : '')).join(', ') : '')
    + (av.aConfirmar.length ? ' — a confirmar: ' + av.aConfirmar.map(it => it.rotulo).join(', ') : '')
    + (av.conjunto ? ' — ' + av.conjunto.texto : '')
    + (av.faltam.length ? '\n  O que falta: ' + av.faltam.join('; ') : '')
    + '\n' + linhas.join('\n');
}

function avaliar(ent, proc, c, dominio) {
  const r = simularMotor(ent);
  const av = avaliarConfianca(ent, proc, { ...contextoDoCaso({ ent, cnaeCaso: c.cnae_base, cnaeCadastro: (c.cliente || {}).cnae_principal, dominio }), sim: r });
  return { r, av };
}

// a entrada e a procedência de um caso: a da tela (ficha aberta com números calculados e não gravados — com a natureza
// das vendas do Domínio da tela, que pode ser de uma importação desta sessão) ou a gravada
function entradaDoCaso(c, params, tela) {
  if (tela && tela.caso_id === c.id && tela.input) return { ent: tela.input, proc: tela.procedencia || {}, origem: 'tela',
    dominio: tela.natureza ? { vendas: { natureza: tela.natureza } } : ((lerSimulacao(c) || {}).dominio || null) };
  const j = lerSimulacao(c);
  if (!j || !j.input) return null;
  const ent = entradaComAliquotas(j.input, params);
  return { ent, proc: j.procedencia || inferirProcedencia(ent, j.dominio), dominio: j.dominio || null, origem: 'gravada', j };
}

// o "e se": valida e aplica as trocas; o mix fecha em 100% com a cheia
export function aplicarAlteracoes(ent, alteracoes) {
  const a = alteracoes && typeof alteracoes === 'object' ? alteracoes : {};
  const novo = { ...ent }, trocados = [], erros = [];
  Object.entries(a).forEach(([k, v]) => {
    if (Object.hasOwn(CAMPOS, k)) {
      const n = Number(typeof v === 'string' && v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
      if (!Number.isFinite(n) || n < 0) { erros.push(k + ' inválido'); return; }
      if (k !== 'receita' && k !== 'rbt12' && k !== 'creditoEstoqueMes' && n > 100) { erros.push(k + ' acima de 100%'); return; }
      novo[k] = n; trocados.push(k);
    } else if (Object.hasOwn(BOOLS, k)) { novo[k] = !!v; trocados.push(k); }
    else if (k === 'anexo') { const an = String(v || '').trim().toUpperCase(); if (!['I', 'II', 'III', 'IV', 'V'].includes(an)) erros.push('anexo inválido'); else { novo.anexo = an; trocados.push(k); } }
    else erros.push('campo desconhecido: ' + k);
  });
  const mexeuMix = trocados.some(k => MIX.includes(k));
  if (mexeuMix && !trocados.includes('mixCheia')) novo.mixCheia = Math.max(0, Math.round((100 - MIX.slice(1).reduce((s, k) => s + (+novo[k] || 0), 0)) * 100) / 100);
  if (mexeuMix) { const soma = MIX.reduce((s, k) => s + (+novo[k] || 0), 0); if (Math.abs(soma - 100) > 0.05) erros.push('o mix soma ' + pct(soma) + ' (tem de dar 100%)'); }
  return { novo, trocados, erros };
}

// ============================================================
// criarFerramentas({ base, carregarCasos, params, contexto }) → { nome: async (entrada) => texto }
//   base: { indice, porCodigo } (servidor.js) · carregarCasos: async () => casos com o cliente · params: alíquotas de 2027
//   (aliquotas2027) · contexto: { caso_id da ficha aberta, tela: { caso_id, input, procedencia } }
// ============================================================
export function criarFerramentas({ base, carregarCasos, params, contexto = {} }) {
  const fichaId = contexto.caso_id || null;
  const tela = contexto.tela || null;
  return {
    async buscar_base({ consulta, modulo, tipo, limite } = {}) {
      const rs = buscar(base.indice, consulta, { modulo, tipo, limite });
      if (!rs.length) return 'Nada encontrado para "' + (consulta || '') + '"' + (modulo ? ' no módulo "' + modulo + '"' : '') + '. Tente outros termos (sinônimos, o artigo, o código do material).';
      return rs.map((r, i) => '[' + (i + 1) + '] ' + r.codigo + ' · ' + rotuloTipo(r.tipo) + ' · ' + r.material + '\n    seção ' + r.n + ': ' + r.secao + '\n' + r.trecho).join('\n\n');
    },
    async ler_material({ codigo, secao } = {}) {
      const cod = String(codigo || '').trim().toUpperCase();
      const m = base.porCodigo.get(cod);
      if (!m) return 'Material "' + (codigo || '') + '" não existe na base. Confira o código no índice.';
      return lerMaterial(m, secao);
    },
    async listar_casos({ filtro = 'todos', busca, pagina, limite } = {}) {
      const casos = await carregarCasos();
      const fl = FILTROS.includes(String(filtro)) ? String(filtro) : 'todos';
      const nb = busca ? normalizar(String(busca)) : null;
      const linhas = [];
      const cont = {}, contDec = {};
      casos.forEach(c => {
        const s = situacaoDoCaso(c);
        const chave = s.simulado ? s.r : 'nao_simulado';
        cont[chave] = (cont[chave] || 0) + 1;
        const ok = fl === 'todos' || (fl === 'simulados' && s.simulado) || (fl === 'nao_simulados' && !s.simulado)
          || (fl === 'a_confirmar' && s.aConfirmar) || (fl === 'decididos' && c.decisao && c.decisao !== 'pendente')
          || (fl === 'pendentes' && (!c.decisao || c.decisao === 'pendente')) || (s.simulado && s.r === fl);
        if (!ok) return;
        if (nb && !normalizar(nomeDoCaso(c) + ' ' + cnaeDoCaso(c)).includes(nb)) return;
        const v = s.j || {};
        const d = c.decisao && c.decisao !== 'pendente' ? c.decisao : 'pendente';
        contDec[d] = (contDec[d] || 0) + 1;
        const faltam = v.confianca && Array.isArray(v.confianca.faltam) ? v.confianca.faltam.filter(Boolean).map(String) : [];
        const falta = (s.r === 'sem_conclusao' || s.aConfirmar) && faltam.length ? ' · falta: ' + (faltam.join('; ').length > 140 ? faltam.join('; ').slice(0, 137) + '…' : faltam.join('; ')) : '';
        linhas.push('- ' + nomeDoCaso(c) + ' · CNAE ' + cnaeCurto(c) + ' · ' + s.rotulo + (v.margem != null ? ' (margem ' + pct(v.margem) + ')' : '')
          + ' · ' + (DEC[c.decisao] || c.decisao || 'pendente') + (c.comunicado_em ? ' · comunicado em ' + dataBR(c.comunicado_em) : '') + falta);
      });
      const resumo = casos.length + ' casos na campanha: ' + Object.entries(cont).map(([k, n]) => n + ' ' + (k === 'nao_simulado' ? 'não simulados' : SIT[k])).join(', ') + '.';
      if (!linhas.length) return resumo + '\nNenhum caso com esse filtro.';
      const por = Math.min(80, Math.max(5, Math.round(+limite) || 40));
      const paginas = Math.ceil(linhas.length / por);
      const pg = Math.min(paginas, Math.max(1, Math.round(+pagina) || 1));
      // as contas da lista filtrada vão prontas (o modelo erra somando nomes)
      const filtrada = fl !== 'todos' || nb;
      const decs = [['por_fora', 'decidido', 'por fora'], ['por_dentro', 'decidido', 'por dentro'], ['pendente', 'pendente', '']].filter(([k]) => contDec[k])
        .map(([k, r, l]) => contDec[k] + ' ' + r + (contDec[k] > 1 ? 's' : '') + (l ? ' ' + l : '')).join(', ');
      const cab = (filtrada ? 'Com esse filtro: ' + linhas.length + (linhas.length === 1 ? ' caso' : ' casos') + (decs ? ' (' + decs + ')' : '') + '.\n' : '')
        + (paginas > 1 ? 'Mostrando ' + ((pg - 1) * por + 1) + ' a ' + Math.min(linhas.length, pg * por) + ' de ' + linhas.length
        + ' (página ' + pg + ' de ' + paginas + (pg < paginas ? '; a seguinte: pagina ' + (pg + 1) : '') + ').\n' : '');
      return resumo + '\n' + cab + linhas.slice((pg - 1) * por, pg * por).join('\n');
    },
    async ver_caso({ caso: termo } = {}) {
      const casos = await carregarCasos();
      const { caso: c, erro } = acharCaso(casos, termo, fichaId);
      if (erro) return erro;
      const s = situacaoDoCaso(c);
      const dec = c.decisao && c.decisao !== 'pendente' ? c.decisao : null;
      let t = 'Caso: ' + nomeDoCaso(c) + ' · CNAE ' + cnaeDoCaso(c) + ((c.cliente || {}).cidade ? ' · ' + c.cliente.cidade : '')
        + '\nSituação na lista: ' + s.rotulo + ' · decisão gravada: ' + (DEC[c.decisao] || c.decisao || 'pendente') + ' · status: ' + (c.status || '—')
        + (c.comunicado_em ? ' · comunicado em ' + dataBR(c.comunicado_em) : ' · sem comunicado') + ' · prazo da opção: ' + dataBR(c.prazo_opcao)
        + (c.fundamento ? '\nFundamento gravado: ' + c.fundamento : '');
      // sem conclusão: nenhum lado está sustentado, nem o da decisão gravada; decisão gravada contra a simulação: revisar
      if (s.simulado && s.r === 'sem_conclusao') t += '\nSEM CONCLUSÃO: o simulador não escolhe lado — nem a simulação nem a decisão gravada' + (dec ? ' (' + DEC[dec] + ')' : '') + ' estão sustentadas até medir o que falta.';
      else if (s.simulado && dec && ((s.r === 'por_fora' && dec === 'por_dentro') || ((s.r === 'por_dentro' || s.r === 'empate') && dec === 'por_fora')))
        t += '\nDIVERGÊNCIA: a decisão gravada (' + DEC[dec] + ') é contrária ao resultado da simulação (' + SIT[s.r] + ') — revisar a decisão ou o fundamento.';
      const blocos = [];
      const grav = entradaDoCaso(c, params, null);
      if (grav) {
        const { r, av } = avaliar(grav.ent, grav.proc, c, grav.dominio);
        // a conta de hoje deu outro resultado que o gravado (o motor mudou depois da gravação): avisa
        const hoje = av.conclusao === 'sem_conclusao' ? 'sem_conclusao' : r.veredito.tipo === 'OPTE' ? 'por_fora' : r.veredito.tipo === 'OPTE_SE' ? 'opte_se'
          : (r.veredito.empate && r.semestre.diferenca < 0) ? 'empate' : 'por_dentro';
        const difere = s.simulado && s.r && hoje !== s.r;
        blocos.push('SIMULAÇÃO GRAVADA (calculada em ' + dataBR(grav.j && grav.j.calculado_em) + (difere ? '; recalculada hoje dá "' + SIT[hoje] + '", não "' + SIT[s.r] + '" como gravado — refaça a simulação na ficha' : '') + ')'
          + '\nEntradas: ' + descreverEntrada(grav.ent) + '\n' + descreverResultado(r) + '\n' + descreverConfianca(av));
      }
      if (tela && tela.caso_id === c.id && tela.input) {
        const tl = entradaDoCaso(c, params, tela);
        const { r, av } = avaliar(tl.ent, tl.proc, c, tl.dominio);
        blocos.push('NA TELA AGORA (calculada e ainda não gravada)\nEntradas: ' + descreverEntrada(tl.ent) + '\n' + descreverResultado(r) + '\n' + descreverConfianca(av));
      }
      if (!blocos.length) t += '\nSem simulação gravada: só a triagem por CNAE (' + (TRI[c.triagem] || '—') + ', score ' + (c.score ?? '—') + ', segmento ' + (c.segmento || '—') + '). Pra simular, importe os relatórios do Domínio na ficha.';
      return t + (blocos.length ? '\n\n' + blocos.join('\n\n') : '');
    },
    async simular({ caso: termo, alteracoes } = {}) {
      const casos = await carregarCasos();
      const { caso: c, erro } = acharCaso(casos, termo, fichaId);
      if (erro) return erro;
      const e0 = entradaDoCaso(c, params, tela);
      if (!e0) return nomeDoCaso(c) + ' ainda não tem simulação: não dá pra fazer o "e se". Importe os relatórios do Domínio na ficha e calcule.';
      const { novo, trocados, erros } = aplicarAlteracoes(e0.ent, alteracoes);
      if (erros.length) return 'Não simulei: ' + erros.join('; ') + '. Campos aceitos: ' + Object.keys(CAMPOS).concat(Object.keys(BOOLS), ['anexo']).join(', ') + '.';
      if (!trocados.length) return 'Nenhum número trocado: diga em "alteracoes" o que mudar.';
      const antes = avaliar(e0.ent, e0.proc, c, e0.dominio);
      // o número trocado é uma hipótese: na confiança, vale como "informado"
      const proc = { ...e0.proc };
      trocados.forEach(k => { const pk = PROC_DO_CAMPO[k]; if (pk) proc[pk] = { fonte: 'manual' }; });
      const depois = avaliar(novo, proc, c, e0.dominio);
      const mudou = antes.r.veredito.tipo !== depois.r.veredito.tipo || !!antes.r.veredito.empate !== !!depois.r.veredito.empate;
      return 'E SE em ' + nomeDoCaso(c) + ' (base: simulação ' + (e0.origem === 'tela' ? 'da tela, não gravada' : 'gravada') + '; nada foi gravado)'
        + '\nTrocado: ' + trocados.map(k => (CAMPOS[k] || BOOLS[k] || k) + ': ' + (k in BOOLS ? (novo[k] ? 'sim' : 'não') : k === 'anexo' ? novo.anexo : (k === 'receita' || k === 'rbt12' || k === 'creditoEstoqueMes' ? brl(e0.ent[k]) + ' → ' + brl(novo[k]) : pct(e0.ent[k] || 0) + ' → ' + pct(novo[k])))).join(' · ')
        + (trocados.some(k => MIX.includes(k)) && !trocados.includes('mixCheia') ? ' · (cheia ajustada para ' + pct(novo.mixCheia) + ')' : '')
        + '\n\nANTES\n' + descreverResultado(antes.r) + '\nConfiança: ' + (ROT_CONCLUSAO[antes.av.conclusao] || antes.av.conclusao)
        + '\n\nDEPOIS\n' + descreverResultado(depois.r) + '\n' + descreverConfianca(depois.av)
        + '\n\n' + (mudou ? 'O RESULTADO MUDA: de "' + (ROT_TIPO_VEREDITO[antes.r.veredito.tipo] || antes.r.veredito.tipo) + '" para "' + (ROT_TIPO_VEREDITO[depois.r.veredito.tipo] || depois.r.veredito.tipo) + '".' : 'O resultado não muda de lado (' + (ROT_DECISAO[depois.av.decisao] || '') + ').');
    }
  };
}

// a etapa que a tela mostra enquanto o chat trabalha (a entrada vem do modelo: tudo vira texto curto)
export function descreverEtapa(nome, e = {}) {
  const x = e && typeof e === 'object' ? e : {};
  const s = (v, n) => String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).slice(0, n);
  if (nome === 'buscar_base') return 'Buscando na base: "' + s(x.consulta, 80) + '"' + (x.modulo ? ' (' + s(x.modulo, 40) + ')' : '');
  if (nome === 'ler_material') return 'Lendo ' + (x.codigo ? s(x.codigo, 40) : 'o material') + (x.secao ? ', seção ' + s(x.secao, 60) : '');
  if (nome === 'listar_casos') return 'Listando os casos' + (x.filtro && x.filtro !== 'todos' ? ' (' + s(x.filtro, 30).replace(/_/g, ' ') + ')' : '') + (x.busca ? ': "' + s(x.busca, 40) + '"' : '')
    + (+x.pagina > 1 ? ', página ' + Math.round(+x.pagina) : '');
  if (nome === 'ver_caso') return 'Abrindo o caso' + (x.caso ? ' ' + s(x.caso, 60) : ' da ficha');
  if (nome === 'simular') return 'Rodando o simulador' + (x.caso ? ' em ' + s(x.caso, 50) : '')
    + (x.alteracoes && typeof x.alteracoes === 'object' ? ': ' + Object.entries(x.alteracoes).map(([k, v]) => k + ' = ' + s(v, 20)).join(', ').slice(0, 80) : '');
  return s(nome, 40);
}
