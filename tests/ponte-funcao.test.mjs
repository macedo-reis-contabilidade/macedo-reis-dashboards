// A função ponte (supabase/functions/ponte, 23/10/2026): a porta de entrada dos pacotes da ponte do PC do escritório.
// O pacote da Receita conferido campo a campo, o do Domínio (02/11/2026: o vazio que vira 0, o bloco do faltou que não
// apaga nada, a linha fora do contrato que fica de fora sozinha), a lista de empresas da carteira, a chave da ponte pela
// impressão digital e o commit fixado no index.ts. Dados inventados (CNPJ com o dígito verificador errado). Rodar com: node tests/ponte-funcao.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import { createHash } from 'node:crypto';
import { validarPacote, empresasDaCarteira, documento, hojeEmBrasilia, sha256Hex, iguais, LIMITES } from '../supabase/functions/ponte/receita.js';
import { criarServidor } from '../supabase/functions/ponte/servidor.js';
import { validarPacoteDominio, LIMITES_DOMINIO } from '../supabase/functions/ponte/dominio.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const raiz = fileURLToPath(new URL('../', import.meta.url));

const BOM = () => ({
  versao: 1, tipo: 'receita',
  rodada: { id: '9D0C5C56-1111-4A2B-9C3D-000000000001', inicio: '2026-11-21T08:30:00-03:00', fim: '2026-11-21T09:00:00-03:00',
    maquina: 'PC-PONTE', ponte: '0.2.0', ambiente: 'producao', chamadas_mes: 312, extra: 'some' },
  empresas: [{
    documento: '11.222.333/0001-00', nome: 'NÃO DEVIA IR', segredo: 'x',
    autorizacao: { situacao: 'ativa', valida_ate: '2027-03-31' },
    pgdas: { ano: 2026, meses: [{ competencia: '2026-09', transmitida_em: '2026-10-18T10:02:00-03:00', das_pago: false, pdf: 'JVBERi0x' }] },
    faturamento: { competencia: '2026-09', receita_mes: '84211.504', receita_12_meses: 912000 },
    caixa_postal: { mensagens: [{ id: 'M1', assunto: '  Termo de\nExclusão  ', enviada_em: '2026-11-20', origem: 'Estado', lida: false, texto: 'o corpo inteiro' }] },
    situacao_fiscal: { consultada_em: '2026-11-05', pendencias: [{ titulo: 'Pendência - Débito (SIEF) ' + '_'.repeat(87) }, { orgao: 'PGFN', titulo: 'Inscrição em Dívida Ativa' }] }
  }],
  faltou: [{ documento: '22333444000100', servico: 'situacao_fiscal', motivo: 'sem_autorizacao', detalhe: 'AcessoNegado' }]
});

console.log('O pacote da Receita:');
const v = validarPacote(BOM());
chk('o pacote do contrato passa', v.ok, v);
const e = v.ok && v.pacote.empresas[0];
chk('o CNPJ sai só com letras e dígitos', e && e.documento === '11222333000100');
chk('o que o contrato não prevê fica de fora (nome, PDF, texto da mensagem, campos a mais)',
  e && !('nome' in e) && !('segredo' in e) && !('pdf' in e.pgdas.meses[0]) && !('texto' in e.caixa_postal.mensagens[0]) && !('extra' in v.pacote.rodada));
chk('o id da rodada em minúscula', v.ok && v.pacote.rodada.id === '9d0c5c56-1111-4a2b-9c3d-000000000001');
chk('dinheiro com centavos', e && e.faturamento.receita_mes === 84211.5 && e.faturamento.receita_12_meses === 912000);
chk('texto numa linha, sem espaço sobrando', e && e.caixa_postal.mensagens[0].assunto === 'Termo de Exclusão');
chk('pendência sem órgão é da Receita', e && e.situacao_fiscal.pendencias[0].orgao === 'Receita' && e.situacao_fiscal.pendencias[1].orgao === 'PGFN');
chk('o título da pendência sem os traços que o relatório põe até a margem', e && e.situacao_fiscal.pendencias[0].titulo === 'Pendência - Débito (SIEF)', e && e.situacao_fiscal.pendencias[0]);
chk('pendência que é só traço é pendência sem título', !!(() => { const p = BOM(); p.empresas[0].situacao_fiscal.pendencias = [{ titulo: '____' }]; const r = validarPacote(p); return r.ok && !('situacao_fiscal' in (r.pacote.empresas[0] || {})) && r.recusadas.length === 1 ? r : null; })());
chk('o que faltou vem com o motivo', v.ok && v.pacote.faltou[0].motivo === 'sem_autorizacao' && v.pacote.faltou[0].detalhe === 'AcessoNegado');
chk('o pacote do contrato não tem recusa', v.ok && Array.isArray(v.recusadas) && v.recusadas.length === 0);
// o que é da rodada recusa o pacote inteiro (422)
const recusa = (mudar, campo) => { const p = BOM(); mudar(p); const r = validarPacote(p); return !r.ok && (!campo || r.campo === campo) ? r : null; };
chk('versão desconhecida recusa o pacote', !!recusa(p => { p.versao = 2; }, 'versao'));
chk('rodada sem uuid recusa o pacote', !!recusa(p => { p.rodada.id = 'abc'; }, 'rodada.id'));
chk('data e hora da rodada sem fuso recusa o pacote', !!recusa(p => { p.rodada.inicio = '2026-11-21 08:30'; }, 'rodada.inicio'));
chk('lista de empresas longa demais recusa o pacote', !!recusa(p => { p.empresas = Array.from({ length: LIMITES.empresas + 1 }, () => ({ documento: '11222333000100' })); }, 'empresas'));
chk('o faltou que não é lista recusa o pacote', !!recusa(p => { p.faltou = 'nada'; }, 'faltou'));
// dentro de uma empresa, o bloco fora do contrato fica de fora sozinho: os outros blocos e as outras empresas seguem, e ele
// vai pro faltou com 'erro' e pras recusadas (uma data esquisita numa empresa não trava a rodada inteira todo dia)
const DOC = '11222333000100';
const deFora = (mudar, servico, campo) => {
  const p = BOM(); p.empresas.push({ documento: '22333444000100', autorizacao: { situacao: 'sem' } }); mudar(p);
  const r = validarPacote(p);
  if (!r.ok) return null;
  const emp = r.pacote.empresas.find(x => x.documento === DOC);
  const rec = r.recusadas.filter(x => x.documento === DOC);
  const fal = r.pacote.faltou.filter(x => x.motivo === 'erro');
  const outrosBlocos = ['autorizacao', 'pgdas', 'faturamento', 'caixa_postal', 'situacao_fiscal'].filter(s => s !== servico).every(s => emp && s in emp);
  const ok = emp && !(servico in emp) && outrosBlocos && rec.length === 1 && rec[0].campo === campo && fal.length === 1 && fal[0].documento === DOC
    && fal[0].servico === servico && fal[0].detalhe.startsWith('fora do contrato: ' + campo.slice('empresas[0].'.length))
    && r.pacote.empresas.some(x => x.documento === '22333444000100' && x.autorizacao.situacao === 'sem');
  return ok ? r : null;
};
chk('competência fora do formato: só o PGDAS da empresa fica de fora', !!deFora(p => { p.empresas[0].pgdas.meses[0].competencia = '2026-13'; }, 'pgdas', 'empresas[0].pgdas.meses[0].competencia'));
chk('data que não existe: só a autorização fica de fora', !!deFora(p => { p.empresas[0].autorizacao.valida_ate = '2027-02-30'; }, 'autorizacao', 'empresas[0].autorizacao.valida_ate'));
chk('data e hora sem fuso: só o PGDAS fica de fora', !!deFora(p => { p.empresas[0].pgdas.meses[0].transmitida_em = '2026-10-18 10:02'; }, 'pgdas', 'empresas[0].pgdas.meses[0].transmitida_em'));
chk('receita negativa ou texto no lugar do número: só o faturamento fica de fora',
  !!deFora(p => { p.empresas[0].faturamento.receita_mes = -1; }, 'faturamento', 'empresas[0].faturamento.receita_mes')
  && !!deFora(p => { p.empresas[0].faturamento.receita_12_meses = 'muito'; }, 'faturamento', 'empresas[0].faturamento.receita_12_meses'));
chk('das_pago que não é true/false/null: só o PGDAS fica de fora', !!deFora(p => { p.empresas[0].pgdas.meses[0].das_pago = 'sim'; }, 'pgdas', 'empresas[0].pgdas.meses[0].das_pago'));
chk('autorização com situação inventada: só ela fica de fora', !!deFora(p => { p.empresas[0].autorizacao.situacao = 'talvez'; }, 'autorizacao', 'empresas[0].autorizacao.situacao'));
chk('mensagem sem id ou sem assunto: só a Caixa Postal fica de fora',
  !!deFora(p => { p.empresas[0].caixa_postal.mensagens[0].id = ' '; }, 'caixa_postal', 'empresas[0].caixa_postal.mensagens[0].id')
  && !!deFora(p => { p.empresas[0].caixa_postal.mensagens[0].assunto = ''; }, 'caixa_postal', 'empresas[0].caixa_postal.mensagens[0].assunto'));
chk('mensagens demais numa empresa: só a Caixa Postal dela fica de fora',
  !!deFora(p => { p.empresas[0].caixa_postal.mensagens = Array.from({ length: LIMITES.mensagens + 1 }, (_, i) => ({ id: 'M' + i, assunto: 'x' })); }, 'caixa_postal', 'empresas[0].caixa_postal.mensagens'));
chk('situação fiscal sem a data da consulta: só ela fica de fora', !!deFora(p => { delete p.empresas[0].situacao_fiscal.consultada_em; }, 'situacao_fiscal', 'empresas[0].situacao_fiscal.consultada_em'));
{
  const p = BOM(); p.empresas.unshift({ documento: '123', autorizacao: { situacao: 'ativa' } }, 'não é empresa');
  const r = validarPacote(p);
  chk('CNPJ inválido ou empresa que não é objeto: ela fica de fora inteira, as outras seguem', r.ok && r.pacote.empresas.length === 1 && r.pacote.empresas[0].documento === DOC
    && r.recusadas.length === 2 && r.recusadas[0].campo === 'empresas[0].documento' && r.recusadas[1].campo === 'empresas[1]' && !r.pacote.faltou.some(x => x.motivo === 'erro'), r);
}
{
  const p = BOM(); p.faltou.push({ documento: DOC, servico: 'tudo', motivo: 'erro' }, { documento: DOC, servico: 'pgdas', motivo: 'preguica' });
  const r = validarPacote(p);
  chk('item do faltou com motivo ou serviço desconhecido: ele fica de fora, o resto segue', r.ok && r.pacote.faltou.length === 1 && r.pacote.faltou[0].motivo === 'sem_autorizacao'
    && r.recusadas.map(x => x.campo).join() === 'faltou[1].servico,faltou[2].motivo' && r.pacote.empresas.length === 1, r);
}
chk('empresa sem bloco nenhum passa (só o CNPJ)', validarPacote({ ...BOM(), empresas: [{ documento: '11222333000100' }] }).ok);
{
  // o que a ponte não conseguiu ler do PDF não pode virar dado: a situação fiscal sem as pendências não é "sem pendência",
  // e o faturamento sem os valores não apaga o que o mês tinha
  const p = BOM(); p.faltou = [];
  p.empresas[0].situacao_fiscal.pendencias = null; p.empresas[0].faturamento.receita_12_meses = null;
  const r = validarPacote(p), emp = r.ok && r.pacote.empresas[0];
  chk('situação fiscal ilegível (pendências nulas): não vira "sem pendência" — o bloco não é gravado', emp && !('situacao_fiscal' in emp) && 'autorizacao' in emp, r);
  chk('faturamento sem um dos valores: não é gravado (não apaga o que o mês tinha)', emp && !('faturamento' in emp), r);
  chk('e os dois vão pro faltou como a conferir, sem recusa', r.ok && r.recusadas.length === 0
    && ['faturamento', 'situacao_fiscal'].every(s => r.pacote.faltou.some(f => f.servico === s && f.motivo === 'a_conferir' && f.documento === DOC)), r);
  const p2 = BOM(); p2.faltou = [{ documento: DOC, servico: 'situacao_fiscal', motivo: 'a_conferir' }]; p2.empresas[0].situacao_fiscal.pendencias = null;
  const r2 = validarPacote(p2);
  chk('o a conferir que a ponte já mandou não se repete', r2.ok && r2.pacote.faltou.filter(f => f.servico === 'situacao_fiscal').length === 1, r2);
  const p3 = BOM(); p3.empresas[0].situacao_fiscal.pendencias = [];
  const r3 = validarPacote(p3);
  chk('a lista vazia, essa sim, é "sem pendência"', r3.ok && Array.isArray(r3.pacote.empresas[0].situacao_fiscal.pendencias) && r3.pacote.empresas[0].situacao_fiscal.pendencias.length === 0, r3);
  const r4 = validarPacote({ ...BOM(), empresas: [{ documento: DOC, situacao_fiscal: { consultada_em: '2026-11-05', pendencias: null } }], faltou: [] });
  chk('a empresa que ficou sem nada a gravar não vai (não cria a linha vazia dela)', r4.ok && r4.pacote.empresas.length === 0 && r4.pacote.faltou.length === 1, r4);
}

console.log('A lista de empresas pra ponte:');
const carteira = [{ cliente_id: 'a', entrada: '2025-01-01', saida: null }, { cliente_id: 'b', entrada: '2025-01-01', saida: '2026-01-31' },
  { cliente_id: 'c', entrada: '2025-01-01', saida: '2026-12-31' }, { cliente_id: 'd', entrada: null, saida: null }, { cliente_id: 'e', entrada: '2025-01-01', saida: null },
  { cliente_id: 'f', entrada: '2025-01-01', saida: null }, { cliente_id: 'g', entrada: '2025-01-01', saida: null }];
const clientes = [{ id: 'a', documento: '11222333000100', regime_tributario: 'Simples Nacional' }, { id: 'b', documento: '22333444000100', regime_tributario: 'MEI' },
  { id: 'c', documento: '33444555000100', regime_tributario: 'Lucro Presumido' }, { id: 'd', documento: '44555666000100', regime_tributario: 'Lucro Real' },
  { id: 'e', documento: '12345678901', regime_tributario: 'Simples Nacional' }, { id: 'f', documento: '55666777000100', regime_tributario: 'Imune' },
  { id: 'g', documento: '11222333000100', regime_tributario: 'Simples Nacional' }];
const lst = empresasDaCarteira(carteira, clientes, '2026-10-23');
chk('só os clientes de hoje, com CNPJ e regime do Integra, sem repetir', JSON.stringify(lst) === JSON.stringify([{ documento: '11222333000100', regime: 'simples' }, { documento: '33444555000100', regime: 'presumido' }]), lst);
chk('o documento com letras (CNPJ alfanumérico) vale, em maiúscula', documento('12.abc.345/0001-0x') === '12ABC34500010X' && documento('123') === null);
chk('o dia em Brasília', hojeEmBrasilia(Date.parse('2026-10-24T02:30:00Z')) === '2026-10-23' && hojeEmBrasilia(Date.parse('2026-10-24T03:30:00Z')) === '2026-10-24');

console.log('A chave da ponte:');
const h = await sha256Hex('segredo');
chk('a impressão digital é o SHA-256 em hexadecimal', h === createHash('sha256').update('segredo').digest('hex'));
chk('comparação: igual só quando é igual', iguais(h, h) && !iguais(h, h.slice(0, 63) + '0') && !iguais('', '') && !iguais(h, h + '0'));

console.log('O pacote do Domínio:');
// como a ponte do PC manda (ponte/pacote.py): números de verdade, null onde a consulta não trouxe linha
function DOMINIO() {
  const vazio = { funcionarios_ativos: null, admissoes: null, desligamentos: null, afastados: null, pro_labore: null,
    notas_saida: null, valor_saidas: null, notas_entrada: null, valor_entradas: null, lancamentos: null, ultimo_lancamento: null };
  return {
    versao: 1,
    rodada: { id: '7B1E0C2A-2222-4A2B-9C3D-000000000002', inicio: '2026-11-03T07:00:02-03:00', fim: '2026-11-03T07:01:10-03:00',
      dados_ate: '2026-11-03', maquina: 'PC-PONTE', ponte: '0.2.0', extra: 'some' },
    empresas: [
      { codigo: 10, documento: '11.222.333/0001-00', nome: '  EMPRESA  ATIVA ', ativa: true, segredo: 'x' },
      { codigo: 11, documento: '99888777000166', nome: 'INATIVA', ativa: false },
      { codigo: 12, documento: '123456789012', nome: 'CEI', ativa: true },
      { codigo: 10, documento: '00000000000000', nome: 'REPETIDA', ativa: false }
    ],
    mensal: [
      { codigo: 10, competencia: '2026-10', ...vazio, funcionarios_ativos: 7, admissoes: 1, pro_labore: 2, notas_saida: 120,
        valor_saidas: 84211.504, notas_entrada: 40, valor_entradas: 30000, lancamentos: 310, ultimo_lancamento: '2026-10-31', salario: 9999 },
      { codigo: 10, competencia: '2026-11', ...vazio },
      { codigo: 11, competencia: '2026-10', ...vazio },
      { codigo: 12, competencia: '2026-10', ...vazio, notas_saida: 3, valor_saidas: 900 },
      { codigo: 12, competencia: '2026-11', ...vazio },
      { codigo: 99, competencia: '2026-10', ...vazio }
    ],
    faltou: []
  };
}
const vd = validarPacoteDominio(DOMINIO());
chk('o pacote do contrato passa', vd.ok, vd);
const pd = vd.ok && vd.pacote;
const lin = (c, m) => pd.mensal.find(l => l.codigo === c && l.competencia === m);
chk('as empresas pelo código, a repetida fica de fora (fica a primeira)', pd && pd.empresas.length === 3 && pd.empresas[0].nome === 'EMPRESA ATIVA' && pd.empresas[0].ativa === true);
chk('o documento sai só com letras e dígitos; o CEI (12) também entra', pd && pd.empresas[0].documento === '11222333000100' && pd.empresas[2].documento === '123456789012');
chk('o que o contrato não prevê fica de fora (campos a mais da rodada, da empresa e da linha)',
  pd && !('extra' in pd.rodada) && !('segredo' in pd.empresas[0]) && !('salario' in lin(10, '2026-10')));
chk('o id da rodada em minúscula', pd && pd.rodada.id === '7b1e0c2a-2222-4a2b-9c3d-000000000002');
chk('dinheiro com centavos', pd && lin(10, '2026-10').valor_saidas === 84211.5);
chk('sem nota nem lançamento no mês = 0 (o bloco foi lido inteiro); o último lançamento segue vazio',
  pd && lin(10, '2026-11').notas_saida === 0 && lin(10, '2026-11').valor_entradas === 0 && lin(10, '2026-11').lancamentos === 0 && lin(10, '2026-11').ultimo_lancamento === null);
chk('a folha vazia da empresa ativa = 0; da inativa fica null (o Domínio não diz)',
  pd && lin(10, '2026-11').funcionarios_ativos === 0 && lin(12, '2026-10').pro_labore === 0 && lin(11, '2026-10').funcionarios_ativos === null && lin(11, '2026-10').notas_saida === 0);
chk('os blocos lidos inteiros vão pro banco (o do faltou não apaga o que já estava gravado)', pd && pd.blocos_ok.folha && pd.blocos_ok.fiscal && pd.blocos_ok.contabil);
chk('a linha de empresa que não está na lista fica de fora e volta em recusadas', vd.ok && vd.linhas_recusadas === 1 && vd.recusadas[0].codigo === 99 && !lin(99, '2026-10'));
{
  const p = DOMINIO(); p.faltou = [{ bloco: 'fiscal', motivo: 'erro na consulta' }];
  const r2 = validarPacoteDominio(p);
  chk('bloco no faltou: os campos dele saem null em todas as linhas, e o banco não troca o que já tinha',
    r2.ok && r2.pacote.blocos_ok.fiscal === false && r2.pacote.mensal.every(l => l.notas_saida === null && l.valor_saidas === null)
    && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10').funcionarios_ativos === 7, r2);
}
{
  const p = DOMINIO();
  p.mensal.push({ codigo: 12, competencia: '2026-09', notas_saida: -1 });
  p.mensal.push({ codigo: 12, competencia: '2026-08', notas_saida: '5' });
  p.mensal.push({ codigo: 12, competencia: '2023-01' });
  p.mensal.push({ codigo: 12, competencia: '2026-12' });
  p.mensal.push({ codigo: 12, competencia: '2026-07', ultimo_lancamento: '2026-08-01' });
  p.mensal.push({ codigo: 10, competencia: '2026-10' });
  const r2 = validarPacoteDominio(p);
  chk('cada linha fora do contrato fica de fora sozinha (contagem negativa ou texto, mês fora da janela ou depois de dados_ate, lançamento fora do mês, repetida)',
    r2.ok && r2.linhas_recusadas === 7 && r2.pacote.mensal.length === 5 && r2.recusadas.some(x => /mensal\[\d+\]\.notas_saida/.test(x.campo)), r2);
}
const recusaD = (mudar, campo) => { const p = DOMINIO(); mudar(p); const r2 = validarPacoteDominio(p); return !r2.ok && (!campo || r2.campo === campo) ? r2 : null; };
chk('rodada sem uuid recusa o pacote', !!recusaD(p => { p.rodada.id = 'abc'; }, 'rodada.id'));
chk('rodada sem dados_ate recusa o pacote', !!recusaD(p => { delete p.rodada.dados_ate; }, 'rodada.dados_ate'));
chk('data e hora da rodada sem fuso recusa o pacote', !!recusaD(p => { p.rodada.fim = '2026-11-03 07:01'; }, 'rodada.fim'));
chk('sem empresas recusa o pacote', !!recusaD(p => { p.empresas = []; }, 'empresas'));
chk('empresa com código que não é inteiro recusa o pacote', !!recusaD(p => { p.empresas[1].codigo = '11'; }, 'empresas[1].codigo'));
chk('ativa que não é verdadeiro ou falso recusa o pacote', !!recusaD(p => { p.empresas[1].ativa = 'A'; }, 'empresas[1].ativa'));
chk('bloco desconhecido no faltou recusa o pacote', !!recusaD(p => { p.faltou = [{ bloco: 'estoque', motivo: 'x' }]; }, 'faltou[0].bloco'));
chk('mensal que não é lista recusa o pacote', !!recusaD(p => { p.mensal = {}; }, 'mensal'));
chk('lista do mês longa demais recusa o pacote', !!recusaD(p => { p.mensal = { length: LIMITES_DOMINIO.mensal + 1 }; p.mensal = Array.from(p.mensal, () => ({})); }, 'mensal'));

console.log('A porta de entrada:');
function fakeDb({ hash = h, cfgErro = null, rpcErro = null } = {}) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      const filtros = [];
      const api = {
        select() { return api; },
        eq(c, x) { filtros.push(['eq', c, x]); return api; },
        not(c, op, x) { filtros.push(['not', c, op, x]); return api; },
        in(c, x) { filtros.push(['in', c, x]); return api; },
        async maybeSingle() {
          if (tabela === 'configuracoes_escritorio') return cfgErro ? { data: null, error: cfgErro } : { data: hash == null ? null : { valor: hash }, error: null };
          return { data: null, error: null };
        },
        then(ok, erro) {
          let data = [];
          if (tabela === 'carteira_info') data = carteira.filter(k => k.entrada != null);
          if (tabela === 'clientes') { const ids = (filtros.find(f => f[0] === 'in') || [])[2] || []; data = clientes.filter(c => ids.includes(c.id)); }
          return Promise.resolve({ data, error: null }).then(ok, erro);
        }
      };
      return api;
    },
    async rpc(nome, args) { chamadas.push({ nome, args }); return rpcErro ? { data: null, error: rpcErro } : { data: { empresas: 1, sem_cadastro: 0 }, error: null }; }
  };
}
const pedir = async (db, corpo, chave = 'segredo', metodo = 'POST') => {
  const atender = criarServidor({ criarDb: () => db, agora: () => Date.parse('2026-10-23T15:00:00-03:00') });
  const r = await atender(new Request('http://local/ponte', { method: metodo, headers: chave == null ? {} : { 'x-chave': chave },
    body: metodo === 'POST' ? (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) : undefined }));
  return { status: r.status, corpo: await r.json() };
};
let r = await pedir(fakeDb({ hash: '' }), { versao: 1, ping: true });
chk('sem a impressão digital cadastrada: 503, sem gravar nada', r.status === 503 && /ainda não foi cadastrada/.test(r.corpo.erro), r);
r = await pedir(fakeDb(), { versao: 1, ping: true }, null);
chk('sem a chave: 401', r.status === 401, r);
r = await pedir(fakeDb(), { versao: 1, ping: true }, 'outra');
chk('chave errada: 401 (a ponte guarda os pendentes e não repete)', r.status === 401 && r.corpo.erro === 'Chave da ponte recusada.', r);
r = await pedir(fakeDb(), { versao: 1, ping: true });
chk('chave certa + ping: 200', r.status === 200 && r.corpo.ok === true, r);
r = await pedir(fakeDb(), 'isto não é json');
chk('corpo que não é JSON: 400', r.status === 400, r);
r = await pedir(fakeDb(), {}, 'segredo', 'GET');
chk('GET: 405', r.status === 405, r);
r = await pedir(fakeDb(), { versao: 1, tipo: 'receita', pedir: 'empresas' });
chk('a lista de empresas: os clientes de hoje da carteira', r.status === 200 && r.corpo.empresas.length === 2 && r.corpo.empresas[0].regime === 'simples', r);
let db = fakeDb();
r = await pedir(db, BOM());
chk('o pacote da Receita vai pro banco já conferido (sem o que sobra)', r.status === 200 && r.corpo.gravado === true && db.chamadas.length === 1
  && db.chamadas[0].nome === 'receita_gravar' && !('nome' in db.chamadas[0].args.p.empresas[0]) && db.chamadas[0].args.p.empresas[0].documento === '11222333000100', r);
db = fakeDb();
r = await pedir(db, { ...BOM(), rodada: { ...BOM().rodada, ambiente: 'demonstracao' } });
chk('do ambiente de demonstração: 200 e nada gravado', r.status === 200 && r.corpo.gravado === false && db.chamadas.length === 0 && Array.isArray(r.corpo.recusadas), r);
r = await pedir(fakeDb(), { ...BOM(), rodada: { ...BOM().rodada, id: 'x' } });
chk('rodada fora do contrato: 422 com o campo (a ponte não repete)', r.status === 422 && /rodada\.id/.test(r.corpo.erro), r);
db = fakeDb();
{
  const p = BOM(); p.empresas[0].pgdas.meses[0].transmitida_em = 'ontem'; p.empresas.push({ documento: '1' });
  r = await pedir(db, p);
  const g = db.chamadas[0] && db.chamadas[0].args.p;
  chk('empresa com um bloco fora do contrato: 200, o resto gravado, o bloco no faltou com "erro" e as recusadas na resposta',
    r.status === 200 && r.corpo.gravado === true && r.corpo.recusadas.length === 2 && g && g.empresas.length === 1 && !('pgdas' in g.empresas[0]) && 'faturamento' in g.empresas[0]
    && g.faltou.some(x => x.servico === 'pgdas' && x.motivo === 'erro' && x.documento === DOC), r);
}
db = fakeDb();
r = await pedir(db, DOMINIO());
chk('o pacote do Domínio vai pro banco já conferido (dominio_gravar), com o que ficou de fora na resposta',
  r.status === 200 && r.corpo.gravado === true && db.chamadas.length === 1 && db.chamadas[0].nome === 'dominio_gravar'
  && db.chamadas[0].args.p.mensal.length === 5 && db.chamadas[0].args.p.blocos_ok.fiscal === true && r.corpo.linhas_recusadas === 1, r);
r = await pedir(fakeDb(), { versao: 1, rodada: { id: 'x' }, empresas: [], mensal: [] });
chk('o pacote do Domínio fora do contrato: 422 com o campo', r.status === 422 && /Domínio/.test(r.corpo.erro) && /rodada\.id/.test(r.corpo.erro), r);
r = await pedir(fakeDb({ rpcErro: { message: 'falhou' } }), BOM());
chk('o banco falhou: 500 (a ponte tenta de novo e guarda nos pendentes)', r.status === 500, r);
r = await pedir(fakeDb(), 'x'.repeat(LIMITES.corpo + 1));
chk('pacote grande demais: 413', r.status === 413, r);

console.log('O código que a função roda:');
{
  const idx = readFileSync(raiz + 'supabase/functions/ponte/index.ts', 'utf8');
  const m = /raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/supabase\/functions\/ponte\/servidor\.js/.exec(idx);
  chk('index.ts importa o servidor do repositório num commit fixado', !!m);
  const vistos = new Set(), fila = ['supabase/functions/ponte/servidor.js'];
  while (fila.length) {
    const a = fila.shift();
    if (vistos.has(a)) continue;
    vistos.add(a);
    for (const im of readFileSync(raiz + a, 'utf8').matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) fila.push(posix.normalize(posix.join(posix.dirname(a), im[1])));
  }
  const ARQS = [...vistos];
  chk('a trava segue os imports da função', ARQS.includes('supabase/functions/ponte/receita.js'), ARQS.join(', '));
  if (m) {
    const atrasados = ARQS.filter(a => {
      let noCommit = null;
      try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch { noCommit = null; }
      return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
    });
    chk('o código que a função roda é o daqui', atrasados.length === 0,
      'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função ponte');
  }
  const codigo = a => readFileSync(raiz + a, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  chk('a função não lê credenciais do cadastro', ARQS.every(a => !/credenciais/.test(codigo(a))));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
