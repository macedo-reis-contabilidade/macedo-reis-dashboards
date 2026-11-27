// ============================================================
// MACEDO & REIS — Edge Function ponte: a data de entrada das notas de compra de fora do RS (26/11/2026)
// O caso da Thalia: a nota emitida em 30/09 que entrou na empresa em 01/10 a Domínio apura em outubro, e a Conferência
// SEDIF/DeSTDA (fiscal-destda.html) punha em setembro, pela emissão — o XML só traz a emissão. A ponte do PC lê da
// Domínio, das empresas da obrigação SEDIF/DeSTDA, a chave e a data de entrada (a do livro, `dent_ent`) de cada NF-e de
// compra de fora do RS, e manda; a função grava a data nas notas que já estão na base (nf_documentos, pela
// nf_gravar_entradas: só as de entrada, e só o que mudou) e, desde a noite do mesmo dia (o "vai" do Samuel), guarda a
// lista inteira (nf_entradas_dominio, pela nf_entradas_dominio_gravar): a Conferência mostra as que a Domínio tem e não
// estão na base. Só a chave e a data saem do PC — nada da nota, nem do fornecedor; a nota de emitente pessoa física (o
// CPF no lugar do CNPJ, na chave) não vai.
// O contrato: docs/FILA-CODE-2026-11-26-ENTRADAS.md.
//   { versao: 1, tipo: 'entradas', pedir: 'empresas' } → { empresas: [{ codigo }], desde, ate }: os códigos do Domínio
//       das empresas da conferência (o vínculo ativo da SEDIF/DeSTDA e, desde 27/11/2026, as do Simples da carteira de
//       hoje: clientesDaSedif) e a janela das datas de entrada a ler (o mês de hoje e os dois antes: a conferência é do
//       mês passado, e a nota que entrou nele pode ter sido emitida no fim do mês de antes)
//   { versao: 1, tipo: 'entradas', rodada: { id, inicio, maquina?, ponte? }, empresas: [{ codigo, notas: [{ chave, entrada }] }] }
// Recusa o pacote inteiro (422) só o que é do pacote (a rodada, a lista); a empresa fora da lista e a nota fora do
// contrato ficam de fora sozinhas e voltam em `recusadas` ({ codigo, chave, campo, erro }), pra ponte anotar no log.
// Sem import do resto da função além das conferências da chave (notas.js): testes no node em tests/ponte-funcao.test.mjs.
// ============================================================
import { chaveValida, pareceCpf } from './notas.js';

export const LIMITES_ENTRADAS = { empresas: 500, notas: 20000, porVez: 2000, recusadas: 50 };
// as datas de entrada que a função aceita: a janela que ela dá à ponte (MESES_DA_JANELA) e um mês de folga, pra ponte que
// pediu a lista antes da virada do mês e mandou depois
export const MESES_DA_JANELA = 2;
export const SEM_SEDIF = 'Empresa fora da conferência SEDIF/DeSTDA (ou sem a ligação com o cadastro).';
const UF_RS = '43';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class Recusa extends Error {}
const recusar = (campo, porque) => { const e = new Recusa(porque); e.campo = campo; throw e; };
const objeto = (v, campo) => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) recusar(campo, 'tem que ser um objeto');
  return v;
};
const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const momentoDe = (v, campo) => {
  const s = String(v == null ? '' : v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || Number.isNaN(Date.parse(s))) recusar(campo, 'data e hora fora do formato (com o fuso)');
  return s;
};
const diaValido = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
// o primeiro dia do mês `meses` antes do de `hoje` ('AAAA-MM-DD')
const primeiroDia = (hoje, meses) => {
  const [a, m] = String(hoje).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 - meses, 1)).toISOString().slice(0, 10);
};

/** A janela das datas de entrada que a ponte lê: do primeiro dia do mês `meses` antes do de hoje até hoje. */
export function janelaDasEntradas(hoje, meses = MESES_DA_JANELA) {
  return { desde: primeiroDia(hoje, meses), ate: hoje };
}

/** As empresas da Conferência SEDIF/DeSTDA (27/11/2026, pedido da Thalia: "todas do simples"): as do vínculo ativo da
 *  obrigação SEDIF/DeSTDA em Obrigações fiscais e todas as do Simples Nacional da carteira de hoje (PJ; o MEI não entrega
 *  a DeSTDA) — a carteira de hoje é a linha de carteira_info com a entrada e sem a saída, ou com a saída depois de hoje.
 *  A mesma regra da tela (empresasDaConferencia, assets/js/destda.js; tests/destda.test.mjs confere as duas).
 *  vinculadas: [cliente_id] · carteira: [{ cliente_id, entrada, saida }] · clientes: [{ id, regime_tributario,
 *  tipo_pessoa }] · hoje: 'AAAA-MM-DD' → [cliente_id], sem repetir, em ordem */
export function clientesDaSedif(vinculadas, carteira, clientes, hoje) {
  const dia = s => String(s == null ? '' : s).slice(0, 10);
  const naCarteira = new Set((carteira || []).filter(k => k && k.cliente_id && k.entrada && (!k.saida || dia(k.saida) > dia(hoje)))
    .map(k => k.cliente_id));
  const doSimples = (clientes || []).filter(c => c && naCarteira.has(c.id) && c.regime_tributario === 'Simples Nacional' && c.tipo_pessoa === 'PJ')
    .map(c => c.id);
  return [...new Set([...(vinculadas || []).filter(Boolean), ...doSimples])].sort();
}

/** As empresas que a ponte lê: os códigos do Domínio ligados ao cadastro, sem repetir, em ordem.
 *  empresas: [{ codigo, cliente_id }] (as de dominio_empresas dos clientes da SEDIF/DeSTDA) */
export function empresasDasEntradas(empresas) {
  return [...new Set((empresas || []).filter(e => e && Number.isInteger(e.codigo) && e.cliente_id).map(e => e.codigo))]
    .sort((a, b) => a - b).map(codigo => ({ codigo }));
}

// uma nota: a chave da NF-e (o dígito verificador conferido) de um emitente de fora do RS que não é pessoa física, e a
// data de entrada de verdade, na janela, não antes do mês da emissão (o ano e o mês da chave)
function nota(n, onde, desde, hoje) {
  objeto(n, onde);
  const chave = String(n.chave == null ? '' : n.chave).trim().toUpperCase();
  if (!chaveValida(chave)) recusar(onde + '.chave', 'chave de acesso inválida (44 caracteres, com o dígito verificador)');
  if (chave.slice(20, 22) !== '55') recusar(onde + '.chave', 'só NF-e, modelo 55');
  if (chave.slice(0, 2) === UF_RS) recusar(onde + '.chave', 'nota do RS: a conferência é das de fora');
  if (pareceCpf(chave.slice(6, 20))) recusar(onde + '.chave', 'emitente pessoa física (CPF): a nota não vai');
  const entrada = String(n.entrada == null ? '' : n.entrada).trim();
  if (!diaValido(entrada)) recusar(onde + '.entrada', 'data fora do formato AAAA-MM-DD, ou que não existe');
  if (entrada < desde || entrada > hoje) recusar(onde + '.entrada', 'data de entrada fora da janela (' + desde + ' a ' + hoje + ')');
  if (entrada.slice(2, 4) + entrada.slice(5, 7) < chave.slice(2, 6)) recusar(onde + '.entrada', 'entrada antes do mês da emissão');
  return { chave, entrada };
}

/** O pacote das datas de entrada, conferido: { ok, pacote: { versao, tipo, rodada, empresas: [{ codigo, notas }] },
 *  recusadas } ou { ok: false, campo, erro }. hoje: 'AAAA-MM-DD' (em Brasília). */
export function validarPacoteEntradas(p, hoje) {
  try {
    objeto(p, 'pacote');
    if (p.versao !== 1) recusar('versao', 'versão do pacote desconhecida (esta função lê a 1)');
    if (p.tipo !== 'entradas') recusar('tipo', 'não é um pacote das datas de entrada');
    const r = objeto(p.rodada, 'rodada');
    if (!UUID.test(String(r.id || ''))) recusar('rodada.id', 'o id da rodada tem que ser um uuid');
    const rodada = { id: String(r.id).toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'), maquina: texto(r.maquina, 60), ponte: texto(r.ponte, 20) };
    if (!Array.isArray(p.empresas)) recusar('empresas', 'tem que ser uma lista');
    if (p.empresas.length > LIMITES_ENTRADAS.empresas) recusar('empresas', 'empresas demais num pacote (até ' + LIMITES_ENTRADAS.empresas + ')');
    const total = p.empresas.reduce((s, e) => s + (e && Array.isArray(e.notas) ? e.notas.length : 0), 0);
    if (total > LIMITES_ENTRADAS.notas) recusar('empresas', 'notas demais num pacote (até ' + LIMITES_ENTRADAS.notas + ')');
    const desde = primeiroDia(hoje, MESES_DA_JANELA + 1);
    const empresas = [], recusadas = [], codigos = new Set();
    p.empresas.forEach((e, i) => {
      const onde = 'empresas[' + i + ']';
      try {
        objeto(e, onde);
        if (!Number.isInteger(e.codigo) || e.codigo < 1 || e.codigo > 1e8) recusar(onde + '.codigo', 'o código da empresa no Domínio é um inteiro');
        if (codigos.has(e.codigo)) recusar(onde + '.codigo', 'empresa repetida no pacote');
        if (!Array.isArray(e.notas)) recusar(onde + '.notas', 'tem que ser uma lista');
        codigos.add(e.codigo);
      } catch (err) {
        if (!(err instanceof Recusa)) throw err;
        recusadas.push({ codigo: e && Number.isInteger(e.codigo) ? e.codigo : null, chave: null, campo: err.campo, erro: err.message });
        return;
      }
      const notas = [], vistas = new Set();
      e.notas.forEach((n, j) => {
        try {
          const x = nota(n, onde + '.notas[' + j + ']', desde, hoje);
          if (vistas.has(x.chave)) recusar(onde + '.notas[' + j + '].chave', 'nota repetida no pacote');
          vistas.add(x.chave);
          notas.push(x);
        } catch (err) {
          if (!(err instanceof Recusa)) throw err;
          const ch = n && typeof n === 'object' ? String(n.chave == null ? '' : n.chave).trim().toUpperCase() : '';
          recusadas.push({ codigo: e.codigo, chave: /^[0-9A-Z]{44}$/.test(ch) ? ch : null, campo: err.campo, erro: err.message });
        }
      });
      empresas.push({ codigo: e.codigo, notas });
    });
    return { ok: true, pacote: { versao: 1, tipo: 'entradas', rodada, empresas }, recusadas };
  } catch (err) {
    if (err instanceof Recusa) return { ok: false, campo: err.campo, erro: err.message };
    throw err;
  }
}

/** As empresas cuja lista da Domínio (nf_entradas_dominio, 26/11/2026) a função varre — o que a Domínio não listou mais
 *  na janela sai da lista: só o cliente com todos os códigos do Domínio dele no pacote (a ponte não manda a empresa que
 *  deu erro na leitura, nem a sem nota de fora do RS na janela: a lista dela fica como estava) e sem nota recusada (a
 *  recusada não chegou aqui, mas pode estar na Domínio).
 *  empresas: [{ codigo, cliente_id }] (as da SEDIF/DeSTDA) · recusadas: [{ codigo }] → [cliente_id] */
export function clientesParaVarrer(pacote, empresas, recusadas) {
  const noPacote = new Set(pacote.empresas.map(e => e.codigo));
  const comRecusa = new Set((recusadas || []).filter(r => r && Number.isInteger(r.codigo)).map(r => r.codigo));
  const codigos = new Map();
  (empresas || []).filter(e => e && Number.isInteger(e.codigo) && e.cliente_id).forEach(e => {
    if (!codigos.has(e.cliente_id)) codigos.set(e.cliente_id, []);
    codigos.get(e.cliente_id).push(e.codigo);
  });
  return [...codigos].filter(([, cs]) => cs.every(c => noPacote.has(c) && !comRecusa.has(c))).map(([cliente]) => cliente);
}

/** O que vai pro banco: cada nota com o cliente do código do Domínio (só as empresas da SEDIF/DeSTDA, ligadas ao
 *  cadastro); a empresa que não está na lista fica de fora, em `recusadas`.
 *  empresas: [{ codigo, cliente_id }] → { notas: [{ cliente_id, chave, entrada }], recusadas } */
export function notasParaGravar(pacote, empresas) {
  const porCodigo = new Map((empresas || []).filter(e => e && Number.isInteger(e.codigo) && e.cliente_id).map(e => [e.codigo, e.cliente_id]));
  const notas = [], recusadas = [];
  pacote.empresas.forEach((e, i) => {
    const cliente = porCodigo.get(e.codigo);
    if (!cliente) { recusadas.push({ codigo: e.codigo, chave: null, campo: 'empresas[' + i + '].codigo', erro: SEM_SEDIF }); return; }
    e.notas.forEach(n => notas.push({ cliente_id: cliente, chave: n.chave, entrada: n.entrada }));
  });
  return { notas, recusadas };
}
