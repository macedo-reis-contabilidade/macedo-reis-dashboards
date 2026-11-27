// A função ponte (supabase/functions/ponte, 23/10/2026): a porta de entrada dos pacotes da ponte do PC do escritório.
// O pacote da Receita conferido campo a campo, o do Domínio (02/11/2026: o vazio que vira 0, o bloco do faltou que não
// apaga nada, a linha fora do contrato que fica de fora sozinha), a lista de empresas da carteira, a chave da ponte pela
// impressão digital e o commit fixado no index.ts. Dados inventados (CNPJ com o dígito verificador errado). Rodar com: node tests/ponte-funcao.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import { createHash } from 'node:crypto';
import { validarPacote, empresasDaCarteira, documento, hojeEmBrasilia, sha256Hex, iguais, LIMITES, VIAS } from '../supabase/functions/ponte/receita.js';
import { criarServidor } from '../supabase/functions/ponte/servidor.js';
import { validarPacoteDominio, LIMITES_DOMINIO, BLOCOS_DA_VERSAO, BLOCOS_DOMINIO, BLOCOS_DA_5 } from '../supabase/functions/ponte/dominio.js';
import { validarPacoteNotas, empresasAutorizadas, destinosDaConfig, dvDaChave, pareceCpf, semCpf, LIMITES_NOTAS, SEM_DESTINO, SEM_AUTORIZACAO, DESTINO_FORA } from '../supabase/functions/ponte/notas.js';
import { validarPacoteEntradas, janelaDasEntradas, empresasDasEntradas, notasParaGravar, clientesParaVarrer, clientesDaSedif, LIMITES_ENTRADAS, SEM_SEDIF } from '../supabase/functions/ponte/entradas.js';
import { validarPacoteSedif, notasDaEmpresa, docNorm, avulsa, LIMITES_SEDIF, NAO_E_DA_EMPRESA } from '../supabase/functions/ponte/sedif.js';

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

console.log('Os pagamentos (PAGTOWEB, 19/11/2026):');
{
  const PAG = () => ({ ...BOM(), empresas: [{ documento: DOC, pagamentos: { de: '2025-01-01', ate: '2026-11-24', extra: 'x', documentos: [
    { numero: ' 07202500000000001 ', tipo_codigo: 'DAS', tipo: 'Documento de Arrecadação\ndo Simples Nacional', periodo_apuracao: '2025-09-01',
      arrecadado_em: '2025-10-14', vencimento: '2025-10-20', receita_codigo: '3333', receita: 'DAS', referencia: null,
      valor_total: '1234.564', principal: 1234.56, multa: 0, juros: 0, saldo: 0, cpf: '12345678901',
      partes: [{ receita_codigo: '1001', receita: 'IRPJ', periodo_apuracao: '2025-09-01', vencimento: '2025-10-20', valor_total: 100.5, principal: 100.5, nome: 'x' }] },
    { numero: '07202500000000002', arrecadado_em: '2025-12-03', valor_total: 1300.1, principal: 1250, multa: 25, juros: 25.1 }] } }],
    faltou: [{ documento: '22333444000100', servico: 'pagamentos', motivo: 'sem_autorizacao' }] });
  const r = validarPacote(PAG()), pg = r.ok && r.pacote.empresas[0] && r.pacote.empresas[0].pagamentos;
  chk('o bloco dos pagamentos do contrato passa, com a janela e as guias', !!pg && pg.de === '2025-01-01' && pg.ate === '2026-11-24' && pg.documentos.length === 2 && r.recusadas.length === 0, r);
  const d0 = pg && pg.documentos[0];
  chk('a guia sai só com o que o contrato prevê (o número sem espaço, o texto numa linha, o dinheiro com centavos)',
    d0 && d0.numero === '07202500000000001' && d0.tipo === 'Documento de Arrecadação do Simples Nacional' && d0.valor_total === 1234.56
    && !('cpf' in d0) && !('extra' in pg) && d0.partes.length === 1 && !('nome' in d0.partes[0]) && d0.partes[0].valor_total === 100.5, d0);
  chk('o que não veio na guia fica null (nunca um zero inventado)', pg && pg.documentos[1].tipo === null && pg.documentos[1].saldo === null
    && pg.documentos[1].periodo_apuracao === null && Array.isArray(pg.documentos[1].partes) && pg.documentos[1].partes.length === 0, pg && pg.documentos[1]);
  chk('a recusa da consulta de pagamentos vai pro faltou como sem autorização (o banco não tira a autorização da empresa por ela)',
    r.ok && r.pacote.faltou.some(f => f.servico === 'pagamentos' && f.motivo === 'sem_autorizacao'), r);
  const p2 = PAG(); p2.empresas[0].pagamentos.documentos.push({ ...p2.empresas[0].pagamentos.documentos[1], valor_total: 1 });
  const r2 = validarPacote(p2);
  chk('a mesma guia duas vezes (de duas páginas): fica a primeira', r2.ok && r2.pacote.empresas[0].pagamentos.documentos.length === 2
    && r2.pacote.empresas[0].pagamentos.documentos[1].valor_total === 1300.1, r2);
  const r3 = validarPacote({ ...BOM(), empresas: [{ documento: DOC, pagamentos: { de: '2026-10-01', ate: '2026-11-24', documentos: [] } }], faltou: [] });
  chk('a janela sem nenhuma guia é "nada pago na janela": vai, com a lista vazia', r3.ok && r3.pacote.empresas.length === 1
    && r3.pacote.empresas[0].pagamentos.documentos.length === 0, r3);
  const foraPag = (mudar, campo) => {
    const p = PAG(); p.empresas[0].autorizacao = { situacao: 'ativa', valida_ate: '2027-03-31' }; mudar(p.empresas[0].pagamentos);
    const x = validarPacote(p);
    const emp = x.ok && x.pacote.empresas[0];
    return emp && !('pagamentos' in emp) && 'autorizacao' in emp && x.recusadas.length === 1 && x.recusadas[0].campo === campo
      && x.pacote.faltou.some(f => f.servico === 'pagamentos' && f.motivo === 'erro' && f.documento === DOC) ? x : null;
  };
  chk('sem a janela, ou com o começo depois do fim: só os pagamentos da empresa ficam de fora',
    !!foraPag(b => { delete b.de; }, 'empresas[0].pagamentos.de') && !!foraPag(b => { b.ate = null; }, 'empresas[0].pagamentos.ate')
    && !!foraPag(b => { b.de = '2026-12-01'; }, 'empresas[0].pagamentos.de'));
  chk('guia sem número, sem o dia do pagamento ou sem o valor: os pagamentos da empresa ficam de fora',
    !!foraPag(b => { b.documentos[0].numero = '  '; }, 'empresas[0].pagamentos.documentos[0].numero')
    && !!foraPag(b => { b.documentos[1].arrecadado_em = '03/12/2025'; }, 'empresas[0].pagamentos.documentos[1].arrecadado_em')
    && !!foraPag(b => { delete b.documentos[1].valor_total; }, 'empresas[0].pagamentos.documentos[1].valor_total'));
  chk('valor negativo, data que não existe ou guias demais: os pagamentos da empresa ficam de fora',
    !!foraPag(b => { b.documentos[0].juros = -1; }, 'empresas[0].pagamentos.documentos[0].juros')
    && !!foraPag(b => { b.documentos[0].partes[0].vencimento = '2025-02-30'; }, 'empresas[0].pagamentos.documentos[0].partes[0].vencimento')
    && !!foraPag(b => { b.documentos = Array.from({ length: LIMITES.pagamentos + 1 }, (_, i) => ({ numero: 'N' + i, arrecadado_em: '2026-01-01', valor_total: 1 })); }, 'empresas[0].pagamentos.documentos'));
}

console.log('De quem é a procuração (a lista vias):');
{
  const COM = extra => ({ ...BOM(), ...extra });
  let r = validarPacote(COM({ vias: [{ documento: '11.222.333/0001-00', via: 'procurador', nome: 'x' }, { documento: '22333444000100', via: 'escritorio' }] }));
  chk('a lista do contrato passa, só com o documento e a via', r.ok && JSON.stringify(r.pacote.vias) === JSON.stringify([{ documento: '11222333000100', via: 'procurador' }, { documento: '22333444000100', via: 'escritorio' }])
    && r.recusadas.length === 0, r);
  chk('o pacote sem a lista (a ponte de antes) passa, e sai sem ela', v.ok && !('vias' in v.pacote) && validarPacote(COM({ vias: null })).ok && !('vias' in validarPacote(COM({ vias: [] })).pacote));
  r = validarPacote(COM({ vias: [{ documento: '123', via: 'procurador' }, { documento: DOC, via: 'diego' }, 'texto', null, { documento: DOC, via: 'escritorio' }, { documento: DOC, via: 'procurador' }] }));
  chk('o item fora do contrato fica de fora sozinho (o resto do pacote segue), e o documento repetido fica com o primeiro',
    r.ok && JSON.stringify(r.pacote.vias) === JSON.stringify([{ documento: DOC, via: 'escritorio' }]) && r.pacote.empresas.length === 1
    && JSON.stringify(r.recusadas.map(x => x.campo)) === JSON.stringify(['vias[0].documento', 'vias[1].via', 'vias[2]', 'vias[3]']), r);
  r = validarPacote(COM({ vias: [{ documento: '123', via: 'procurador' }] }));
  chk('sem nenhum item bom, o pacote sai sem a lista', r.ok && !('vias' in r.pacote) && r.recusadas.length === 1);
  chk('a lista que não é lista, ou longa demais, recusa o pacote', !!recusa(p => { p.vias = 'todas'; }, 'vias')
    && !!recusa(p => { p.vias = Array.from({ length: LIMITES.empresas + 1 }, () => ({ documento: DOC, via: 'escritorio' })); }, 'vias'));
  chk('só as duas vias do contrato', JSON.stringify(VIAS) === JSON.stringify(['escritorio', 'procurador']));
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

console.log('O pacote do Domínio, versão 2 (05/11/2026: o faturamento, as compras e a folha em reais):');
// a versão 2: a 10 (ativa) com tudo em 2026-10 e nada em 2026-11; a 11 (inativa) sem nada; a 12 (ativa) só com notas
function DOMINIO2() {
  const p = DOMINIO();
  p.versao = 2;
  const l = p.mensal.find(x => x.codigo === 10 && x.competencia === '2026-10');
  Object.assign(l, {
    receita_bruta: 80211.504, receita_mercadorias: 80711.5, receita_servicos: 0, devolucoes: 500, receita_simples: 92000,
    receita_simples_propria: 80211.5, receita_st: 30000, receita_monofasica: 0, receita_exportacao: 0, receita_anexo_1: 92000,
    receita_anexo_2: 0, receita_anexo_3: 0, receita_anexo_4: 0, receita_anexo_5: 0, rbt12: 1020000, meses_rbt12: 12,
    compras: 45000, compras_st: 15000, servicos_tomados: 1200, ativo_e_consumo: 300, devolucoes_de_venda: 500, outras_entradas: 4003.1,
    salarios: 14800, ferias: 0, rescisoes: 0, decimo_terceiro: 0, pro_labore_valor: 6000, base_inss: 14100, base_fgts: 14100,
    fgts: 1128, inss_empresa: 0, inss_rat: 0, inss_terceiros: 0, salario_do_fulano: 1234.56
  });
  return p;
}
const v2 = validarPacoteDominio(DOMINIO2());
chk('o pacote da versão 2 passa, com a versão no que vai pro banco', v2.ok && v2.pacote.versao === 2, v2);
const p2 = v2.ok && v2.pacote;
const lin2 = (c, m) => p2.mensal.find(l => l.codigo === c && l.competencia === m);
chk('os seis blocos lidos vão pro banco', p2 && ['folha', 'fiscal', 'contabil', 'faturamento', 'compras', 'folha_valores'].every(b => p2.blocos_ok[b] === true), p2 && p2.blocos_ok);
chk('o faturamento, as compras e a folha em reais chegam, com centavos; o meses_rbt12 inteiro; o campo a mais fica de fora',
  p2 && lin2(10, '2026-10').receita_bruta === 80211.5 && lin2(10, '2026-10').receita_simples === 92000 && lin2(10, '2026-10').meses_rbt12 === 12
  && lin2(10, '2026-10').compras_st === 15000 && lin2(10, '2026-10').fgts === 1128 && !('salario_do_fulano' in lin2(10, '2026-10')));
chk('sem nota no mês: a receita pelas notas e as compras = 0 em toda empresa; o que é da apuração do Simples segue null',
  p2 && lin2(10, '2026-11').receita_bruta === 0 && lin2(10, '2026-11').devolucoes === 0 && lin2(10, '2026-11').compras === 0
  && lin2(10, '2026-11').receita_simples === null && lin2(10, '2026-11').rbt12 === null && lin2(10, '2026-11').meses_rbt12 === null
  && lin2(11, '2026-10').receita_bruta === 0 && lin2(11, '2026-10').outras_entradas === 0);
chk('a folha em reais vazia: 0 na empresa ativa, null na inativa (como a folha)',
  p2 && lin2(10, '2026-11').salarios === 0 && lin2(12, '2026-10').pro_labore_valor === 0 && lin2(12, '2026-10').inss_terceiros === 0
  && lin2(11, '2026-10').salarios === null && lin2(11, '2026-10').fgts === null);
{
  const p = DOMINIO2(); p.faltou = [{ bloco: 'faturamento', motivo: 'erro na consulta' }];
  const r2 = validarPacoteDominio(p);
  chk('bloco novo no faltou: só ele sai null e fica falso pro banco (os outros entram)',
    r2.ok && r2.pacote.blocos_ok.faturamento === false && r2.pacote.blocos_ok.compras === true
    && r2.pacote.mensal.every(l => l.receita_bruta === null && l.rbt12 === null)
    && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10').compras === 45000, r2);
}
{
  const p = DOMINIO2(); p.versao = 1;
  const r2 = validarPacoteDominio(p);
  chk('a versão 1 (a ponte antiga): os três blocos novos não foram lidos — saem null e falsos pro banco, mesmo que venham',
    r2.ok && r2.pacote.versao === 1 && r2.pacote.blocos_ok.faturamento === false && r2.pacote.blocos_ok.compras === false
    && r2.pacote.blocos_ok.folha_valores === false && r2.pacote.blocos_ok.fiscal === true
    && r2.pacote.mensal.every(l => l.receita_bruta === null && l.compras === null && l.salarios === null), r2);
}
chk('na versão 1, bloco novo no faltou recusa o pacote (ela não tem esse bloco)', !!recusaD(p => { p.faltou = [{ bloco: 'compras', motivo: 'x' }]; }, 'faltou[0].bloco'));
chk('versão 6 recusa o pacote', !!recusaD(p => { p.versao = 6; }, 'versao'));
{
  const p = DOMINIO2();
  p.mensal.push({ codigo: 12, competencia: '2026-09', meses_rbt12: 2.5 });
  p.mensal.push({ codigo: 12, competencia: '2026-08', receita_bruta: '100' });
  p.mensal.push({ codigo: 12, competencia: '2026-07', salarios: 1e14 });
  p.mensal.push({ codigo: 12, competencia: '2026-06', meses_rbt12: 13 });
  const r2 = validarPacoteDominio(p);
  chk('a linha com valor fora do contrato num bloco novo fica de fora sozinha (meses que não é inteiro ou passa de 12, receita em texto, valor absurdo)',
    r2.ok && r2.linhas_recusadas === 5 && r2.recusadas.filter(x => /meses_rbt12/.test(x.campo)).length === 2 && r2.recusadas.some(x => /receita_bruta/.test(x.campo))
    && r2.recusadas.some(x => /salarios/.test(x.campo)), r2);
}
{
  const p = DOMINIO2();
  p.mensal.find(x => x.codigo === 12 && x.competencia === '2026-10').receita_bruta = -350.25;
  const r2 = validarPacoteDominio(p);
  chk('receita bruta negativa (mais devolução que venda no mês) entra como veio',
    r2.ok && r2.pacote.mensal.find(l => l.codigo === 12 && l.competencia === '2026-10').receita_bruta === -350.25, r2);
}

console.log('O pacote do Domínio, versão 3 (05/11/2026: o andamento das contabilidades):');
// a versão 3: a 10 com os lançamentos por origem, os cruzamentos e os saldos em 2026-10 (nada em 2026-11); a foto do dia
// da 10 e da 11; o encerramento de 2024 e 2025 da 10
function DOMINIO3() {
  const p = DOMINIO2();
  p.versao = 3;
  Object.assign(p.mensal.find(x => x.codigo === 10 && x.competencia === '2026-10'), {
    lanc_normais: 4, lanc_extrato: 25, lanc_fiscal: 340, lanc_folha: 15, lanc_apuracao: 3, lanc_outros: 1,
    incluido_ate: '2026-11-03', receita_lancada: 80211.504, folha_lancada: 20800, encargos_lancados: 1128,
    caixa_negativo: 0, contra_natureza: 2, sem_natureza: 0, transitorias: 1, transitorias_valor: 350.75, usuario: 'FULANO'
  });
  p.andamento = [
    { codigo: 10, banco_contas: 2, banco_ate: '2026-08-31', banco_ultimo: '2026-09-30', banco_ultimo_geral: '2026-09-30',
      caixa_ate: '2026-10-31', caixa_contador_ate: '2026-09-15', extrato_contas: 1, extrato_ate: '2026-09-30', extrato_pendentes: 3,
      conciliadas: 1, conciliado_ate: '2026-08-31', fechamento_em: '2025-12-31', nome_banco: 'BANCO DO FULANO' },
    { codigo: 11, banco_contas: 0, banco_ate: null, banco_ultimo: null, banco_ultimo_geral: '2023-05-31', caixa_ate: null,
      caixa_contador_ate: null, extrato_contas: 0, extrato_ate: null, extrato_pendentes: 0, conciliadas: 0, conciliado_ate: null, fechamento_em: null }
  ];
  p.encerramento = [
    { codigo: 10, ano: 2024, zerado_em: '2024-12-31', zeramentos: 1, zerado_incluido_em: '2025-03-15', lancados_depois: 0, lancamentos_do_ano: 4000 },
    { codigo: 10, ano: 2025, zerado_em: null, zeramentos: 0, zerado_incluido_em: null, lancados_depois: null, lancamentos_do_ano: 4300 }
  ];
  return p;
}
const v3 = validarPacoteDominio(DOMINIO3());
chk('o pacote da versão 3 passa, com a versão no que vai pro banco', v3.ok && v3.pacote.versao === 3, v3);
const p3 = v3.ok && v3.pacote;
const lin3 = (c, m) => p3.mensal.find(l => l.codigo === c && l.competencia === m);
chk('os blocos da versão 3 lidos vão pro banco: os três do mês, a foto do dia e o encerramento',
  p3 && ['origens', 'cruzamentos', 'saldos', 'andamento', 'encerramento'].every(b => p3.blocos_ok[b] === true) && p3.blocos_ok.faturamento === true, p3 && p3.blocos_ok);
chk('os lançamentos por origem, os cruzamentos (com centavos) e os saldos chegam; o campo a mais (o usuário) fica de fora',
  p3 && lin3(10, '2026-10').lanc_fiscal === 340 && lin3(10, '2026-10').incluido_ate === '2026-11-03' && lin3(10, '2026-10').receita_lancada === 80211.5
  && lin3(10, '2026-10').transitorias_valor === 350.75 && lin3(10, '2026-10').contra_natureza === 2 && !('usuario' in lin3(10, '2026-10')));
chk('o incluido_ate pode ser depois do mês da linha (a integração entra no mês seguinte)', p3 && lin3(10, '2026-10').incluido_ate > '2026-10-31');
chk('sem lançamento no mês: as origens, os cruzamentos e os saldos = 0 em toda empresa; o incluido_ate segue null',
  p3 && lin3(10, '2026-11').lanc_fiscal === 0 && lin3(10, '2026-11').receita_lancada === 0 && lin3(10, '2026-11').caixa_negativo === 0
  && lin3(10, '2026-11').transitorias_valor === 0 && lin3(10, '2026-11').incluido_ate === null && lin3(11, '2026-10').folha_lancada === 0);
chk('a foto do dia: uma por empresa, com os campos do contrato (o nome do banco fica de fora)',
  p3 && p3.andamento.length === 2 && p3.andamento[0].banco_ate === '2026-08-31' && p3.andamento[0].extrato_pendentes === 3
  && p3.andamento[0].fechamento_em === '2025-12-31' && !('nome_banco' in p3.andamento[0]) && p3.andamento[1].banco_ultimo_geral === '2023-05-31');
chk('o encerramento por empresa e ano; sem zeramento, null (nunca 0)',
  p3 && p3.encerramento.length === 2 && p3.encerramento[0].zerado_em === '2024-12-31' && p3.encerramento[1].zerado_em === null
  && p3.encerramento[1].lancados_depois === null && p3.encerramento[1].lancamentos_do_ano === 4300);
{
  const p = DOMINIO3();
  p.andamento.push({ codigo: 99, banco_contas: 1 });                                   // empresa fora da lista
  p.andamento.push({ codigo: 10, banco_contas: 5 });                                   // repetida
  p.andamento.push({ codigo: 12, banco_ate: '31/08/2026' });                           // data fora do formato
  p.andamento.push({ codigo: 12, fechamento_em: '1899-12-30' });                       // data de lixo
  p.encerramento.push({ codigo: 12, ano: 2019, zerado_em: '2019-12-31' });             // ano velho demais
  p.encerramento.push({ codigo: 12, ano: 2025, zerado_em: '2024-12-31' });             // zeramento fora do ano
  p.encerramento.push({ codigo: 10, ano: 2025, zerado_em: null });                     // repetido
  p.mensal.push({ codigo: 12, competencia: '2026-09', incluido_ate: '2030-01-01' });   // o dia em que entrou, no futuro
  p.mensal.push({ codigo: 12, competencia: '2026-08', lanc_fiscal: -1 });
  const r2 = validarPacoteDominio(p);
  chk('o item da foto ou do encerramento fora do contrato fica de fora sozinho (fora da lista, repetido, data errada, ano velho, zeramento fora do ano), e a linha do mês também',
    // 10 = os 9 daqui e a linha da empresa 99 que o pacote de base já traz
    r2.ok && r2.pacote.andamento.length === 2 && r2.pacote.encerramento.length === 2 && r2.linhas_recusadas === 10
    && r2.recusadas.some(x => x.campo === 'andamento[4].banco_ate') && r2.recusadas.some(x => x.campo === 'encerramento[3].zerado_em')
    && r2.recusadas.some(x => /incluido_ate/.test(x.campo)), r2);
}
{
  const p = DOMINIO3(); p.faltou = [{ bloco: 'andamento', motivo: 'erro na consulta' }, { bloco: 'saldos', motivo: 'consulta a conferir' }];
  const r2 = validarPacoteDominio(p);
  chk('a foto e os saldos no faltou: a foto vai vazia e falsa (o banco não apaga a que tinha), os saldos saem null; o resto entra',
    r2.ok && r2.pacote.blocos_ok.andamento === false && r2.pacote.andamento.length === 0 && r2.pacote.blocos_ok.saldos === false
    && r2.pacote.mensal.every(l => l.caixa_negativo === null) && r2.pacote.blocos_ok.encerramento === true && r2.pacote.encerramento.length === 2, r2);
}
{
  const p = DOMINIO3(); p.versao = 2;
  const r2 = validarPacoteDominio(p);
  chk('a versão 2 (a ponte de antes): o andamento não foi lido — os campos novos saem null, as listas vazias, tudo falso pro banco',
    r2.ok && r2.pacote.blocos_ok.origens === false && r2.pacote.blocos_ok.andamento === false && r2.pacote.blocos_ok.encerramento === false
    && r2.pacote.andamento.length === 0 && r2.pacote.encerramento.length === 0 && r2.pacote.mensal.every(l => l.lanc_fiscal === null && l.receita_lancada === null)
    && r2.pacote.blocos_ok.faturamento === true, r2);
}
chk('na versão 2, bloco da versão 3 no faltou recusa o pacote', !!recusaD(p => { p.versao = 2; p.faltou = [{ bloco: 'andamento', motivo: 'x' }]; }, 'faltou[0].bloco'));
chk('a foto que não é lista recusa o pacote', !!recusaD(p => { p.versao = 3; p.andamento = {}; }, 'andamento'));

console.log('O pacote do Domínio, versão 4 (09/11/2026: a jornada dos funcionários, somada por empresa e jornada):');
// a versão 4: a 10 com uma 6x1 de 44 h (2 grupos: mensalista e horista), uma 5x2 com o sábado compensado e uma 12x36;
// a 12 com um grupo sem jornada no Domínio
function DOMINIO4() {
  const p = DOMINIO3();
  p.versao = 4;
  const g = (x) => ({ tipo: 1, tipo_escala: 0, semana: 'TTTTTTF', min_semana: 2640, min_maior_dia: 440, ciclo_dias: null, ciclo_trabalho: null,
    horas_semana: 44, horas_mes: 220, forma: 1, controle: 1, categoria: 101, unidade: 5, empregados: 3, afastados: 0, compensa_sabado: 0,
    superior: 0, superior_teto: 0, salarios: 6300, ...x });
  p.jornadas = [
    g({ codigo: 10, jornada: 7, nome: 'FULANO DE TAL', cpf: '12345678909' }),
    g({ codigo: 10, jornada: 7, unidade: 1, empregados: 1, salarios: 9.5, forma: 2 }),
    g({ codigo: 10, jornada: 8, semana: 'TTTTTCF', compensa_sabado: 4, empregados: 4, salarios: 8800.004 }),
    g({ codigo: 10, jornada: 9, tipo: 2, tipo_escala: 1, semana: null, ciclo_dias: 2, ciclo_trabalho: 1, min_semana: 2520, min_maior_dia: 660, horas_semana: 36, horas_mes: 180, empregados: 2, afastados: 1, salarios: 4400 }),
    g({ codigo: 12, jornada: null, tipo: null, tipo_escala: null, semana: null, min_semana: null, min_maior_dia: null, empregados: 1, salarios: 1700 })
  ];
  return p;
}
const v4 = validarPacoteDominio(DOMINIO4());
chk('o pacote da versão 4 passa, com a jornada marcada como lida', v4.ok && v4.pacote.versao === 4 && v4.pacote.blocos_ok.jornadas === true && v4.pacote.jornadas.length === 5, v4.ok ? v4.pacote.blocos_ok : v4);
const j4 = v4.ok && v4.pacote.jornadas;
chk('o grupo sai só com os campos do contrato: o nome e o CPF que a fonte devolvesse ficam de fora',
  j4 && !('nome' in j4[0]) && !('cpf' in j4[0]) && Object.keys(j4[0]).length === 21 && j4[0].semana === 'TTTTTTF' && j4[0].empregados === 3);
chk('o mesmo código de jornada com outra unidade do salário é outro grupo; o dinheiro com centavos; a escala sem a semana',
  j4 && j4[1].unidade === 1 && j4[1].salarios === 9.5 && j4[2].salarios === 8800 && j4[3].semana === null && j4[3].ciclo_dias === 2 && j4[3].afastados === 1);
chk('o grupo sem jornada no Domínio entra (a jornada nula)', j4 && j4[4].codigo === 12 && j4[4].jornada === null && j4[4].min_semana === null);
chk('na versão 3, a jornada não foi lida: a lista vai vazia e a marca falsa, mesmo que venha',
  v3.ok && v3.pacote.blocos_ok.jornadas === false && v3.pacote.jornadas.length === 0
  && (() => { const p = DOMINIO4(); p.versao = 3; const r2 = validarPacoteDominio(p); return r2.ok && r2.pacote.jornadas.length === 0 && r2.pacote.blocos_ok.jornadas === false; })());
{
  const p = DOMINIO4(); p.faltou = [{ bloco: 'jornadas', motivo: 'consulta a conferir' }];
  const r2 = validarPacoteDominio(p);
  chk('a jornada no faltou: a lista vazia e a marca falsa (o banco fica com a foto que tinha); o resto entra',
    r2.ok && r2.pacote.blocos_ok.jornadas === false && r2.pacote.jornadas.length === 0 && r2.pacote.blocos_ok.andamento === true, r2);
}
chk('na versão 3, a jornada no faltou recusa o pacote (ela não tem esse bloco)', !!recusaD(p => { p.versao = 3; p.faltou = [{ bloco: 'jornadas', motivo: 'x' }]; }, 'faltou[0].bloco'));
{
  const p = DOMINIO4();
  const base = p.jornadas[0];
  p.jornadas.push({ ...base });                                          // o mesmo grupo de novo
  p.jornadas.push({ ...base, codigo: 99 });                              // empresa fora da lista
  p.jornadas.push({ ...base, jornada: 20, semana: 'TTTTTT' });           // semana que não são 7 dias
  p.jornadas.push({ ...base, jornada: 21, semana: 'TTTXTTF' });          // letra fora do contrato
  p.jornadas.push({ ...base, jornada: 22, empregados: 0 });              // grupo sem empregados
  p.jornadas.push({ ...base, jornada: 23, afastados: 4 });               // mais afastados que empregados
  p.jornadas.push({ ...base, jornada: 24, categoria: 701 });             // contribuinte individual, não é empregado
  p.jornadas.push({ ...base, jornada: 25, superior: 1, superior_teto: 2 });
  p.jornadas.push({ ...base, jornada: 26, min_semana: 20000 });
  p.jornadas.push({ ...base, jornada: 27, ciclo_dias: 2, ciclo_trabalho: 3 });
  p.jornadas.push({ ...base, jornada: 28, salarios: -1 });
  p.jornadas.push({ ...base, jornada: 29, horas_semana: '44' });
  const r2 = validarPacoteDominio(p);
  // 13 = os 12 daqui e a linha do mês da empresa 99 que o pacote de base já traz
  chk('o grupo fora do contrato fica de fora sozinho (repetido, fora da lista, semana errada, sem empregados, contagens acima do grupo, categoria, minutos, ciclo, salário negativo, horas em texto)',
    r2.ok && r2.pacote.jornadas.length === 5 && r2.linhas_recusadas === 13 && r2.recusadas.some(x => x.campo === 'jornadas[7].semana')
    && r2.recusadas.some(x => x.campo === 'jornadas[11].categoria') && r2.recusadas.some(x => x.campo === 'jornadas[16].horas_semana'), r2);
}
chk('a jornada que não é lista recusa o pacote', !!recusaD(p => { Object.assign(p, DOMINIO4()); p.jornadas = {}; }, 'jornadas'));

console.log('O pacote do Domínio, versão 5 (11/11/2026: o que o Comparativo tributário apura pelas notas e pela contabilidade):');
// a versão 5: a 10 (ativa) em 2026-10 com as vendas pelo CFOP, o ICMS, o ISS, o PIS/Cofins com a apuração, a presunção com
// a apuração do trimestre e o resultado (prejuízo); nada em 2026-11; a 11 (inativa) sem nada; a 12 só com as notas
function DOMINIO5() {
  const p = DOMINIO4();
  p.versao = 5;
  Object.assign(p.mensal.find(x => x.codigo === 10 && x.competencia === '2026-10'), {
    venda_producao: 0, venda_revenda: 80711.504, venda_combustivel: 0, industrializacao_encomenda: 0, transporte: 0, transporte_357: 0,
    energia_comunicacao: 0, outras_saidas: 0, saidas_no_estado: 70711.5, saidas_outro_estado: 10000, saidas_exterior: 0,
    base_icms_saidas: 50000, icms_saidas: 8500, icms_st_saidas: 0, ipi_saidas: 0,
    base_icms_compras: 45000, icms_compras: 5400, ipi_compras: 112.35, icms_despesas: 216,
    serv_anexo_iv: 0, base_iss: 0, iss_devido: 0, iss_retido: 0,
    pc_tributada: 60000, pc_monofasica: 0, pc_st: 0, pc_aliquota_zero: 20711.5, pc_isenta: 0, pc_sem_incidencia: 0, pc_suspensa: 0,
    pc_outras: 0, pc_sem_cst: 0, base_pis_cofins: 60000, pis_apurado: 390, cofins_apurada: 1800, creditos_pis_cofins: 0, pis_cofins_a_recolher: 2190,
    receita_irpj_1_6: 0, receita_irpj_8: 80211.5, receita_irpj_16: 0, receita_irpj_32: 0, receita_irpj_outros: 0,
    receita_csll_12: 80211.5, receita_csll_32: 0, receita_csll_outros: 0, apuracao_trimestral: 1, demais_receitas: 0,
    base_irpj: 19250.76, irpj_apurado: 2887.61, base_csll: 28876.14, csll_apurada: 2598.85,
    resultado_antes_ir: -4321.994, irpj_csll_lancados: 0, receitas_financeiras: 35.4, lanc_resultado: 391,
    cliente: 'FULANO COMPRADOR', conta: 'LUCROS DO SOCIO'
  });
  return p;
}
const v5 = validarPacoteDominio(DOMINIO5());
chk('o pacote da versão 5 passa, com a versão no que vai pro banco', v5.ok && v5.pacote.versao === 5, v5);
const p5 = v5.ok && v5.pacote;
const lin5 = (c, m) => p5.mensal.find(l => l.codigo === c && l.competencia === m);
chk('os seis blocos da versão 5 lidos vão pro banco, com os de antes e as fotos',
  p5 && BLOCOS_DA_5.every(b => p5.blocos_ok[b] === true) && p5.blocos_ok.saldos === true && p5.blocos_ok.jornadas === true
  && BLOCOS_DA_5.join(',') === 'saidas_cfop,entradas_icms,servicos_iss,piscofins,presumido,resultado', p5 && p5.blocos_ok);
chk('os 55 campos novos: 15 das vendas, 4 das entradas, 4 dos serviços, 14 do PIS/Cofins, 14 da presunção e 4 do resultado',
  BLOCOS_DA_5.map(b => BLOCOS_DOMINIO[b].length).join(',') === '15,4,4,14,14,4' && p5 && Object.keys(lin5(10, '2026-10')).length === 2 + 59 + 55);
chk('as vendas pelo CFOP, o ICMS, o PIS/Cofins e a presunção chegam, com centavos; o campo a mais (o cliente, a conta) fica de fora',
  p5 && lin5(10, '2026-10').venda_revenda === 80711.5 && lin5(10, '2026-10').saidas_outro_estado === 10000 && lin5(10, '2026-10').icms_saidas === 8500
  && lin5(10, '2026-10').ipi_compras === 112.35 && lin5(10, '2026-10').pc_aliquota_zero === 20711.5 && lin5(10, '2026-10').cofins_apurada === 1800
  && lin5(10, '2026-10').receita_irpj_8 === 80211.5 && lin5(10, '2026-10').csll_apurada === 2598.85
  && !('cliente' in lin5(10, '2026-10')) && !('conta' in lin5(10, '2026-10')));
chk('o resultado negativo (prejuízo) entra como veio, com centavos; a contagem dos lançamentos, inteira',
  p5 && lin5(10, '2026-10').resultado_antes_ir === -4321.99 && lin5(10, '2026-10').lanc_resultado === 391 && lin5(10, '2026-10').receitas_financeiras === 35.4);
chk('a apuração por trimestre: o 1 da ponte sai verdadeiro (e o 0, falso)',
  p5 && lin5(10, '2026-10').apuracao_trimestral === true
  && (() => { const p = DOMINIO5(); p.mensal.find(x => x.codigo === 10 && x.competencia === '2026-10').apuracao_trimestral = 0;
    const r2 = validarPacoteDominio(p); return r2.ok && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10').apuracao_trimestral === false; })());
chk('sem nota no mês: as vendas, as entradas, os serviços, as pc_ e as receita_ por presunção = 0 em toda empresa (também na inativa)',
  p5 && [lin5(10, '2026-11'), lin5(11, '2026-10'), lin5(12, '2026-11')].every(l => l.venda_revenda === 0 && l.saidas_exterior === 0 && l.icms_saidas === 0
    && l.icms_compras === 0 && l.icms_despesas === 0 && l.iss_devido === 0 && l.serv_anexo_iv === 0 && l.pc_tributada === 0 && l.pc_sem_cst === 0
    && l.receita_irpj_8 === 0 && l.receita_csll_outros === 0));
chk('o que é da apuração (do PIS/Cofins, do IRPJ e da CSLL) segue null em quem não apura — nunca um 0 inventado',
  p5 && [lin5(10, '2026-11'), lin5(11, '2026-10'), lin5(12, '2026-10')].every(l => l.base_pis_cofins === null && l.pis_apurado === null && l.cofins_apurada === null
    && l.creditos_pis_cofins === null && l.pis_cofins_a_recolher === null && l.apuracao_trimestral === null && l.demais_receitas === null
    && l.base_irpj === null && l.irpj_apurado === null && l.base_csll === null && l.csll_apurada === null));
chk('sem lançamento em conta de resultado: a contagem é 0 (a contabilidade do mês não foi feita) e o resultado segue null — nunca lucro zero',
  p5 && [lin5(10, '2026-11'), lin5(11, '2026-10'), lin5(12, '2026-10')].every(l => l.lanc_resultado === 0 && l.resultado_antes_ir === null
    && l.irpj_csll_lancados === null && l.receitas_financeiras === null));
{
  const p = DOMINIO5(); p.faltou = [{ bloco: 'resultado', motivo: 'erro na consulta' }, { bloco: 'piscofins', motivo: 'consulta a conferir' }];
  const r2 = validarPacoteDominio(p);
  chk('bloco da versão 5 no faltou: só ele sai null e fica falso pro banco (o banco não troca o que tinha); os outros entram',
    r2.ok && r2.pacote.blocos_ok.resultado === false && r2.pacote.blocos_ok.piscofins === false && r2.pacote.blocos_ok.presumido === true
    && r2.pacote.blocos_ok.saidas_cfop === true && r2.pacote.mensal.every(l => l.lanc_resultado === null && l.resultado_antes_ir === null && l.pc_tributada === null)
    && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10').receita_irpj_8 === 80211.5
    && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-11').venda_revenda === 0, r2);
}
{
  const p = DOMINIO5(); p.versao = 4;
  const r2 = validarPacoteDominio(p);
  chk('a versão 4 (a ponte de antes): os seis blocos novos não foram lidos — saem null e falsos pro banco, mesmo que venham; os dela entram',
    r2.ok && r2.pacote.versao === 4 && BLOCOS_DA_5.every(b => r2.pacote.blocos_ok[b] === false) && r2.pacote.blocos_ok.saldos === true
    && r2.pacote.blocos_ok.jornadas === true && r2.pacote.jornadas.length === 5
    && r2.pacote.mensal.every(l => BLOCOS_DA_5.every(b => BLOCOS_DOMINIO[b].every(c => l[c] === null)))
    && r2.pacote.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10').lanc_fiscal === 340, r2);
  const p3v = DOMINIO5(); p3v.versao = 3;
  const r3 = validarPacoteDominio(p3v);
  chk('e a versão 3 também: nem os blocos da 5 nem a jornada',
    r3.ok && BLOCOS_DA_5.every(b => r3.pacote.blocos_ok[b] === false) && r3.pacote.blocos_ok.jornadas === false && r3.pacote.blocos_ok.saldos === true
    && BLOCOS_DA_VERSAO[3].length === 11 && BLOCOS_DA_VERSAO[4].length === 12 && BLOCOS_DA_VERSAO[5].length === 18, r3.ok ? r3.pacote.blocos_ok : r3);
}
chk('na versão 4, bloco da versão 5 no faltou recusa o pacote (ela não tem esse bloco)', !!recusaD(p => { Object.assign(p, DOMINIO4()); p.faltou = [{ bloco: 'resultado', motivo: 'x' }]; }, 'faltou[0].bloco'));
chk('o faltou com os 18 blocos da versão 5 cabe (o limite é ' + LIMITES_DOMINIO.faltou + ')',
  (() => { const p = DOMINIO5(); p.faltou = BLOCOS_DA_VERSAO[5].map(b => ({ bloco: b, motivo: 'consulta a conferir' })); const r2 = validarPacoteDominio(p);
    return r2.ok && Object.values(r2.pacote.blocos_ok).every(x => x === false); })());
{
  const p = DOMINIO5();
  p.mensal.push({ codigo: 12, competencia: '2026-09', apuracao_trimestral: 'S' });
  p.mensal.push({ codigo: 12, competencia: '2026-08', lanc_resultado: -1 });
  p.mensal.push({ codigo: 12, competencia: '2026-07', lanc_resultado: 2.5 });
  p.mensal.push({ codigo: 12, competencia: '2026-06', pc_tributada: '10' });
  p.mensal.push({ codigo: 12, competencia: '2026-05', resultado_antes_ir: -1e14 });
  p.mensal.push({ codigo: 12, competencia: '2026-04', apuracao_trimestral: 2 });
  const r2 = validarPacoteDominio(p);
  // 7 = as 6 daqui e a linha da empresa 99 que o pacote de base já traz
  chk('a linha com valor fora do contrato num bloco da versão 5 fica de fora sozinha (o sim ou não em texto ou 2, a contagem negativa ou quebrada, o valor em texto ou absurdo)',
    r2.ok && r2.linhas_recusadas === 7 && r2.recusadas.filter(x => /apuracao_trimestral/.test(x.campo)).length === 2
    && r2.recusadas.filter(x => /lanc_resultado/.test(x.campo)).length === 2 && r2.recusadas.some(x => /pc_tributada/.test(x.campo))
    && r2.recusadas.some(x => /resultado_antes_ir/.test(x.campo)), r2);
}
{
  // a linha compacta, como a ponte 0.5.0 manda: só o código, a competência e os campos com valor
  const p = DOMINIO5();
  p.mensal = p.mensal.map(l => Object.fromEntries(Object.entries(l).filter(([k, v]) => v != null)));
  p.mensal.push({ codigo: 12, competencia: '2026-09', venda_revenda: 1500.5, lanc_resultado: 3, resultado_antes_ir: 210.1 });
  p.mensal.push({ codigo: 12, competencia: '2026-08' });
  const r2 = validarPacoteDominio(p);
  const cheio = validarPacoteDominio(DOMINIO5());
  const a = r2.ok && r2.pacote.mensal.find(l => l.codigo === 12 && l.competencia === '2026-09'), b = r2.ok && r2.pacote.mensal.find(l => l.codigo === 12 && l.competencia === '2026-08');
  chk('a linha compacta (sem os campos em branco) é lida igual à por extenso: o campo que falta é null, e o vazio do bloco lido vira 0',
    r2.ok && r2.linhas_recusadas === 1 && JSON.stringify(r2.pacote.mensal.slice(0, cheio.pacote.mensal.length)) === JSON.stringify(cheio.pacote.mensal)
    && a.venda_revenda === 1500.5 && a.venda_producao === 0 && a.lanc_resultado === 3 && a.resultado_antes_ir === 210.1 && a.pis_apurado === null && a.notas_saida === 0
    && Object.keys(b).length === 116 && b.lanc_resultado === 0 && b.resultado_antes_ir === null && b.venda_revenda === 0 && b.funcionarios_ativos === 0, r2.ok ? { a, b } : r2);
}
{
  // os dois lados do contrato juntos: o pacote que a ponte do PC monta (ponte/pacote.py, com o Domínio de mentira e os
  // 14 meses da tarefa) passa aqui inteiro, sem nenhuma linha nem item recusado
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const py = process.platform === 'win32' ? 'py' : 'python3';
  // (o --saida é por extenso; o que a ponte manda é o compacto, pacote.corpo — os dois têm que dar no mesmo)
  const args = (process.platform === 'win32' ? ['-3'] : []).concat(['-c', 'import sys, json; sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); from ponte import pacote; from ponte.fonte_falsa import FonteFalsa; p = pacote.montar(FonteFalsa(), 14, lambda m, n="info": None); print(json.dumps({"extenso": p, "compacto": pacote.corpo(p).decode("utf-8")}))', raiz]);
  const saidaPc = JSON.parse(execFileSync(py, args, { encoding: 'utf8' }));
  const doPc = saidaPc.extenso, compacto = JSON.parse(saidaPc.compacto);
  const vp = validarPacoteDominio(doPc);
  chk('o pacote da ponte do PC (a versão ' + doPc.versao + ', 14 meses do Domínio de mentira) passa inteiro: nenhuma linha nem item recusado',
    vp.ok && vp.pacote.versao === doPc.versao && vp.linhas_recusadas === 0 && vp.pacote.mensal.length === doPc.mensal.length
    && vp.pacote.andamento.length === doPc.andamento.length && vp.pacote.encerramento.length === doPc.encerramento.length
    && vp.pacote.jornadas.length === (doPc.jornadas || []).length
    && BLOCOS_DA_VERSAO[doPc.versao].every(b => vp.pacote.blocos_ok[b] === true), vp.ok ? { recusadas: vp.recusadas, blocos_ok: vp.pacote.blocos_ok } : vp);
  const vc = validarPacoteDominio(compacto);
  chk('a ponte do PC manda a versão 5, na forma compacta: toda empresa e mês com a sua linha, nenhum campo em branco nela, e bem menor que o por extenso',
    doPc.versao === 5 && compacto.versao === 5 && compacto.mensal.length === doPc.mensal.length
    && compacto.mensal.every(l => Object.values(l).every(v => v != null) && 'codigo' in l && 'competencia' in l)
    && compacto.mensal.some(l => Object.keys(l).length === 2) && saidaPc.compacto.length < JSON.stringify(doPc).length * 0.6,
    { extenso: JSON.stringify(doPc).length, compacto: saidaPc.compacto.length });
  chk('e o compacto, conferido aqui, dá o mesmo pacote que o por extenso (o que vai pro banco não muda)',
    vc.ok && vp.ok && vc.linhas_recusadas === 0 && JSON.stringify(vc.pacote) === JSON.stringify(vp.pacote), vc.ok ? vc.recusadas : vc);
  const l104 = vp.ok && vp.pacote.mensal.filter(l => l.codigo === 104).pop(), l101 = vp.ok && vp.pacote.mensal.filter(l => l.codigo === 101).pop();
  chk('do Domínio de mentira: a 104 (do Presumido) com a apuração do trimestre e sem resultado (0 lançamentos, o resultado null); a 101 (do Simples) com o lucro e sem apuração',
    l104 && l104.apuracao_trimestral === true && l104.base_irpj === 17280 && l104.pis_apurado === 117 && l104.iss_devido === 540 && l104.lanc_resultado === 0
    && l104.resultado_antes_ir === null && l104.venda_revenda === 0
    && l101.apuracao_trimestral === null && l101.base_irpj === null && l101.lanc_resultado > 0 && l101.resultado_antes_ir > 0 && l101.pc_sem_cst > 0
    && vp.pacote.mensal.some(l => l.codigo === 102 && l.resultado_antes_ir === -420.15), { l104, l101 });
}

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
        update(x) { chamadas.push({ nome: 'update:' + tabela, args: x, filtros }); return api; },
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
chk('sem a lista de quem é a procuração (a ponte de antes), o banco recebe o pacote sem ela', !('vias' in db.chamadas[0].args.p));
db = fakeDb();
r = await pedir(db, { ...BOM(), vias: [{ documento: '11.222.333/0001-00', via: 'procurador' }, { documento: '22333444000100', via: 'outra' }] });
chk('de quem é a procuração vai pro banco conferida, e o item fora do contrato volta nas recusadas', r.status === 200 && r.corpo.gravado === true
  && JSON.stringify(db.chamadas[0].args.p.vias) === JSON.stringify([{ documento: '11222333000100', via: 'procurador' }])
  && r.corpo.recusadas.length === 1 && r.corpo.recusadas[0].campo === 'vias[1].via', r);
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
db = fakeDb();
r = await pedir(db, DOMINIO2());
chk('o pacote do Domínio da versão 2 também vai pro banco, com os blocos novos',
  r.status === 200 && r.corpo.gravado === true && db.chamadas.length === 1 && db.chamadas[0].args.p.versao === 2
  && db.chamadas[0].args.p.blocos_ok.faturamento === true && db.chamadas[0].args.p.mensal.some(l => l.receita_bruta === 80211.5), r);
db = fakeDb();
r = await pedir(db, DOMINIO5());
{
  const g = db.chamadas[0] && db.chamadas[0].args.p, l10 = g && g.mensal.find(l => l.codigo === 10 && l.competencia === '2026-10'), l11 = g && g.mensal.find(l => l.codigo === 11);
  chk('o pacote do Domínio da versão 5 vai pro banco com os seis blocos novos marcados e os valores (o prejuízo, a apuração por trimestre)',
    r.status === 200 && r.corpo.gravado === true && db.chamadas.filter(c => c.nome === 'dominio_gravar').length === 1 && g.versao === 5
    && BLOCOS_DA_5.every(b => g.blocos_ok[b] === true) && l10.resultado_antes_ir === -4321.99 && l10.apuracao_trimestral === true && l10.pc_aliquota_zero === 20711.5, r);
  chk('a linha vai pro banco só com os campos que têm valor (o banco lê o que falta como null): o 0 fica, o null não vai',
    g && g.mensal.every(l => Object.values(l).every(v => v != null)) && l11.venda_revenda === 0 && l11.lanc_resultado === 0
    && !('resultado_antes_ir' in l11) && !('pis_apurado' in l11) && !('funcionarios_ativos' in l11) && 'codigo' in l11 && 'competencia' in l11
    && Object.keys(l10).length > Object.keys(l11).length, g && { l11 });
}
r = await pedir(fakeDb(), { ...DOMINIO5(), versao: 6 });
chk('a versão 6 do pacote do Domínio recusa (422): esta função lê até a 5', r.status === 422 && /da 1 à 5/.test(r.corpo.erro), r);
r = await pedir(fakeDb(), { ...BOM(), versao: 2 });
chk('a versão 2 é só do pacote do Domínio: a da Receita recusa (422)', r.status === 422 && /Versão do pacote/.test(r.corpo.erro), r);
r = await pedir(fakeDb(), { versao: 2, ping: true });
chk('o ping na versão 2 também recusa (só o pacote do Domínio tem a 2)', r.status === 422, r);
r = await pedir(fakeDb(), { versao: 1, rodada: { id: 'x' }, empresas: [], mensal: [] });
chk('o pacote do Domínio fora do contrato: 422 com o campo', r.status === 422 && /Domínio/.test(r.corpo.erro) && /rodada\.id/.test(r.corpo.erro), r);
r = await pedir(fakeDb({ rpcErro: { message: 'falhou' } }), BOM());
chk('o banco falhou: 500 (a ponte tenta de novo e guarda nos pendentes)', r.status === 500, r);
r = await pedir(fakeDb(), 'x'.repeat(LIMITES.corpo + 1));
chk('pacote grande demais: 413', r.status === 413, r);
chk('o limite do corpo: 16 MB (o pacote do Domínio da versão 2 passou dos 5 em 05/11/2026)', LIMITES.corpo === 16 * 1024 * 1024);
{
  // o pacote do Domínio grande vai pro banco em partes de LINHAS_POR_PARTE linhas (05/11/2026)
  const p = DOMINIO2();
  const vazio = Object.fromEntries(Object.keys(p.mensal[0]).filter(k => !['codigo', 'competencia'].includes(k)).map(k => [k, null]));
  delete vazio.salario; delete vazio.salario_do_fulano;
  p.empresas = Array.from({ length: 150 }, (_, i) => ({ codigo: 1000 + i, documento: String(11222333000100 + i).padStart(14, '0'), nome: 'EMPRESA ' + i, ativa: true }));
  p.mensal = [];
  p.empresas.forEach(e => { for (let m = 0; m < 12; m++) p.mensal.push({ codigo: e.codigo, competencia: '2025-' + String(m + 1).padStart(2, '0'), ...vazio, notas_saida: 1, receita_bruta: 10 }); });
  const dbP = fakeDb();
  dbP.rpc = async (nome, args) => { dbP.chamadas.push({ nome, args }); return { data: { empresas: args.p.empresas.length, ligadas: args.p.empresas.length ? 100 : 0, sem_cadastro: args.p.empresas.length ? 50 : 0, linhas: args.p.mensal.length }, error: null }; };
  const rp = await pedir(dbP, p);
  const rpcs = dbP.chamadas.filter(c => c.nome === 'dominio_gravar'), upd = dbP.chamadas.find(c => c.nome === 'update:dominio_rodadas');
  chk('1.800 linhas: 3 partes de até 800, a primeira com as empresas, as outras sem; a rodada fica com o total; a resposta soma',
    rp.status === 200 && rpcs.length === 3 && rpcs[0].args.p.empresas.length === 150 && rpcs[1].args.p.empresas.length === 0 && rpcs[2].args.p.mensal.length === 200
    && rpcs.every(c => c.args.p.rodada.id === p.rodada.id.toLowerCase() || c.args.p.rodada.id === p.rodada.id) && rpcs.every(c => c.args.p.blocos_ok.faturamento === true)
    && upd && upd.args.linhas === 1800 && rp.corpo.linhas === 1800 && rp.corpo.empresas === 150 && rp.corpo.ligadas === 100 && rp.corpo.partes === 3, { status: rp.status, corpo: rp.corpo, n: rpcs.length });
  const dbE = fakeDb();
  let n = 0;
  dbE.rpc = async (nome, args) => { n++; return n === 2 ? { data: null, error: { message: 'falhou no meio' } } : { data: { empresas: 1, linhas: args.p.mensal.length }, error: null }; };
  const re = await pedir(dbE, p);
  chk('uma parte que falha: 500 (a ponte manda de novo; o banco troca pelos mesmos números)', re.status === 500 && n === 2, re);
  // a versão 3: a foto do dia e o encerramento só na primeira parte; nas outras, vazios e falsos (o banco apaga da foto a
  // empresa que não veio, e uma parte sem a foto não pode parecer uma foto vazia)
  p.versao = 3;
  p.andamento = p.empresas.map(e => ({ codigo: e.codigo, banco_contas: 1, banco_ate: '2025-11-30' }));
  p.encerramento = p.empresas.slice(0, 10).map(e => ({ codigo: e.codigo, ano: 2025, zerado_em: '2025-12-31', zeramentos: 1, lancamentos_do_ano: 9 }));
  const db3 = fakeDb();
  db3.rpc = async (nome, args) => { db3.chamadas.push({ nome, args }); return { data: { empresas: args.p.empresas.length, linhas: args.p.mensal.length, andamento: args.p.blocos_ok.andamento ? args.p.andamento.length : 0, encerramento: args.p.blocos_ok.encerramento ? args.p.encerramento.length : 0 }, error: null }; };
  const r3 = await pedir(db3, p);
  const c3 = db3.chamadas.filter(c => c.nome === 'dominio_gravar');
  chk('a versão 3 em partes: a foto e o encerramento só na primeira; nas outras, vazios e com as marcas falsas; a resposta diz quantos',
    r3.status === 200 && c3.length === 3 && c3[0].args.p.andamento.length === 150 && c3[0].args.p.blocos_ok.andamento === true
    && c3[0].args.p.encerramento.length === 10 && c3.slice(1).every(c => c.args.p.andamento.length === 0 && c.args.p.encerramento.length === 0
      && c.args.p.blocos_ok.andamento === false && c.args.p.blocos_ok.encerramento === false && c.args.p.blocos_ok.saldos === true)
    && r3.corpo.andamento === 150 && r3.corpo.encerramento === 10, { status: r3.status, corpo: r3.corpo });
  chk('a versão 3 não chama a gravação da jornada', !db3.chamadas.some(c => c.nome === 'dominio_gravar_jornadas'));
  // a versão 4: a jornada não vai nas partes; depois delas, a foto inteira vai pra dominio_gravar_jornadas
  p.versao = 4;
  p.jornadas = p.empresas.slice(0, 40).map((e, i) => ({ codigo: e.codigo, jornada: i + 1, tipo: 1, tipo_escala: 0, semana: 'TTTTTTF', min_semana: 2640,
    min_maior_dia: 440, horas_semana: 44, horas_mes: 220, forma: 1, controle: 1, categoria: 101, unidade: 5, empregados: 2, afastados: 0,
    compensa_sabado: 0, superior: 0, superior_teto: 0, salarios: 3600 }));
  const db4 = fakeDb();
  db4.rpc = async (nome, args) => { db4.chamadas.push({ nome, args }); return nome === 'dominio_gravar_jornadas' ? { data: { jornadas: args.p.jornadas.length, ligadas: 30 }, error: null } : { data: { empresas: args.p.empresas.length, linhas: args.p.mensal.length }, error: null }; };
  const r4 = await pedir(db4, p);
  const nomes4 = db4.chamadas.filter(c => !c.nome.startsWith('update:')).map(c => c.nome);
  const gj = db4.chamadas.find(c => c.nome === 'dominio_gravar_jornadas');
  chk('a versão 4: as 3 partes sem a jornada; depois, a foto inteira numa chamada só, com a rodada; a resposta diz quantos grupos',
    r4.status === 200 && nomes4.join(',') === 'dominio_gravar,dominio_gravar,dominio_gravar,dominio_gravar_jornadas'
    && db4.chamadas.filter(c => c.nome === 'dominio_gravar').every(c => !('jornadas' in c.args.p))
    && gj.args.p.jornadas.length === 40 && gj.args.p.rodada.dados_ate === p.rodada.dados_ate && !('empresas' in gj.args.p) && r4.corpo.jornadas === 40,
    { status: r4.status, corpo: r4.corpo, nomes4 });
  const dbJ = fakeDb();
  dbJ.rpc = async (nome, args) => nome === 'dominio_gravar_jornadas' ? { data: null, error: { message: 'a função não existe' } } : { data: { empresas: args.p.empresas.length, linhas: args.p.mensal.length }, error: null };
  const rJ = await pedir(dbJ, p);
  chk('a jornada que não grava não derruba a rodada: 200, os números do mês gravados, o aviso na resposta',
    rJ.status === 200 && rJ.corpo.gravado === true && rJ.corpo.linhas === 1800 && /jornada/.test(rJ.corpo.jornadas_erro || ''), rJ);
  const p4v = { ...p, jornadas: [] };
  const db4v = fakeDb();
  db4v.rpc = async (nome, args) => { db4v.chamadas.push({ nome, args }); return { data: { empresas: args.p.empresas.length, linhas: args.p.mensal.length }, error: null }; };
  await pedir(db4v, p4v);
  const p4f = { ...p, faltou: [{ bloco: 'jornadas', motivo: 'erro na consulta' }] };
  await pedir(db4v, p4f);
  chk('a jornada vazia, ou no faltou, não troca a foto (a função da jornada nem é chamada)', !db4v.chamadas.some(c => c.nome === 'dominio_gravar_jornadas'));
}

console.log('As notas de entrada das empresas autorizadas (03/11/2026):');
{
  const EMP = '11222333000100', FORN = '44555666000100';   // inventados, com o dígito verificador errado de propósito
  const chaveCom = (numero, cnpj = FORN, serie = 1) => {
    const base = '43' + '2609' + cnpj + '55' + String(serie).padStart(3, '0') + String(numero).padStart(9, '0') + '1' + '00001234';
    return base + dvDaChave(base);
  };
  const DO_XML = n => {   // a nota cujos itens vieram do XML: a unidade tributável junto; o XML em si não viaja
    n.origem = 'xml';
    n.xml = 'PG5mZVByb2M+PC9uZmVQcm9jPg==';
    Object.assign(n.itens[0], { ean_trib: '7890000000017', unidade_trib: 'UN', quantidade_trib: 100, valor_unitario_trib: 10, ipi: 52.5 });
  };
  const NOTA = (numero, mudar) => {
    const n = {
      chave: chaveCom(numero), modelo: '55', numero: String(numero), serie: '001', emissao: '2026-09-15', entrada: '2026-09-16',
      emitente: { cnpj: FORN, nome: '  FORNECEDOR\nEXEMPLO LTDA ', uf: 'sc' }, destinatario: { cnpj: '11.222.333/0001-00' },
      totais: { produtos: 1000, desconto: 0, frete: 50, ipi: 52.5, icms_st: 0, total: 1102.5 }, origem: 'dominio',
      itens: [{ n: 1, codigo: 'ABC-10', codigo_produto: '123', ean: '7890000000000', descricao: 'PARAFUSO SEXTAVADO 1/4 X 2', ncm: '7318.15.00',
        cfop: '1102', unidade: 'CX', quantidade: 10, valor_unitario: 100, valor_total: 1000, desconto: 0, ipi: null, icms_st: 0, extra: 'some' }],
      xml: null, sobra: 'x'
    };
    if (mudar) mudar(n);
    return n;
  };
  const PACOTE = mudar => {
    const p = { versao: 1, tipo: 'notas', rodada: { id: '9D0C5C56-1111-4A2B-9C3D-000000000002', inicio: '2026-11-04T07:05:00-03:00', maquina: 'PC-PONTE', ponte: '0.3.0' },
      empresa: { codigo: 901, documento: EMP },
      notas: [NOTA(1234), NOTA(1235, n => { DO_XML(n); n.entrada = '2026-09-17'; }), NOTA(1236, n => { n.emissao = '2025-09-19'; n.entrada = '2025-09-20'; })] };
    if (mudar) mudar(p);
    return p;
  };
  const vn = validarPacoteNotas(PACOTE());
  chk('o pacote do contrato passa, sem recusa', vn.ok && vn.pacote.notas.length === 3 && vn.recusadas.length === 0, vn);
  const n0 = vn.ok && vn.pacote.notas[0], i0 = n0 && n0.itens[0];
  chk('o que o contrato não prevê fica de fora, e o texto numa linha', n0 && !('sobra' in n0) && !('extra' in i0) && n0.emitente.nome === 'FORNECEDOR EXEMPLO LTDA' && n0.emitente.uf === 'SC', n0);
  {
    const p = PACOTE(); p.notas[0].emitente.nome = 'FULANO DE TAL 123.456.789-09 ME';
    const r2 = validarPacoteNotas(p);
    const nm = r2.ok && r2.pacote.notas[0].emitente.nome;
    chk('o nome do fornecedor sai sem o CPF que o MEI antigo tem no nome (o CNPJ basta pra comparar)', nm === 'FULANO DE TAL ME', r2);
  }
  chk('o CPF sai do nome com ou sem pontuação, e o resto do nome (o CNPJ da empresa no nome do MEI novo) fica',
    semCpf('JOAO 12345678909') === 'JOAO' && semCpf('57.453.038 DIONES') === '57.453.038 DIONES' && semCpf('12345678909') === null && semCpf(null) === null);
  chk('o destinatário é a empresa do pacote, só com letras e dígitos; o número e a série sem os zeros da frente',
    n0 && n0.destinatario.cnpj === EMP && n0.numero === '1234' && n0.serie === '1');
  chk('o NCM só com os dígitos, e o IPI do item que a Domínio não guardou segue nulo', i0 && i0.ncm === '73181500' && i0.ipi === null && i0.cfop === '1102');
  chk('o código do produto no cadastro do cliente não vai (o destino não usa)', i0 && !('codigo_produto' in i0));
  {
    const nx = vn.ok && vn.pacote.notas[1], ix = nx && nx.itens[0];
    chk('a nota com os itens do XML: origem "xml", sem o XML (ele não viaja) e com a unidade tributável',
      nx && nx.origem === 'xml' && !('xml' in nx) && ix.ean_trib === '7890000000017' && ix.unidade_trib === 'UN' && ix.quantidade_trib === 100 && ix.valor_unitario_trib === 10 && ix.ipi === 52.5, nx);
    chk('sem o XML, a unidade tributável vai nula', i0 && i0.ean_trib === null && i0.unidade_trib === null && i0.quantidade_trib === null && i0.valor_unitario_trib === null);
  }
  const recusaN = (mudar, campo) => { const r2 = validarPacoteNotas(PACOTE(mudar)); return !r2.ok && r2.campo === campo ? r2 : null; };
  chk('versão desconhecida recusa o pacote', !!recusaN(p => { p.versao = 2; }, 'versao'));
  chk('outro tipo recusa o pacote', !!recusaN(p => { p.tipo = 'receita'; }, 'tipo'));
  chk('rodada sem uuid recusa o pacote', !!recusaN(p => { p.rodada.id = 'x'; }, 'rodada.id'));
  chk('o código da empresa que não é inteiro recusa o pacote', !!recusaN(p => { p.empresa.codigo = '901'; }, 'empresa.codigo'));
  chk('pacote sem nota é recusado', !!recusaN(p => { p.notas = []; }, 'notas'));
  chk('notas demais num pacote: recusado', !!recusaN(p => { p.notas = Array.from({ length: LIMITES_NOTAS.notas + 1 }, (_, k) => NOTA(k + 1)); }, 'notas'));
  // a nota fora do contrato fica de fora sozinha
  const deForaN = (mudar, campo) => {
    const r2 = validarPacoteNotas(PACOTE(p => mudar(p.notas[0], p)));
    return r2.ok && r2.pacote.notas.length === 2 && r2.recusadas.length === 1 && r2.recusadas[0].campo === campo ? r2 : null;
  };
  chk('a chave com o dígito verificador errado fica de fora', !!deForaN(n => { n.chave = n.chave.slice(0, 43) + ((+n.chave[43] + 1) % 10); }, 'notas[0].chave'));
  chk('o número que não é o da chave fica de fora', !!deForaN(n => { n.numero = '999'; }, 'notas[0].numero'));
  chk('o CNPJ do emitente que não é o da chave fica de fora', !!deForaN(n => { n.emitente.cnpj = '55666777000100'; }, 'notas[0].emitente.cnpj'));
  chk('a nota de emitente pessoa física (o CPF na chave) fica de fora', !!deForaN(n => { n.chave = chaveCom(1234, '00012345678909'); n.emitente.cnpj = '00012345678909'; }, 'notas[0].emitente.cnpj'));
  chk('a nota de outra empresa fica de fora', !!deForaN(n => { n.destinatario.cnpj = '22333444000100'; }, 'notas[0].destinatario.cnpj'));
  chk('o CFOP do fornecedor no lugar do da entrada fica de fora', !!deForaN(n => { n.itens[0].cfop = '5102'; }, 'notas[0].itens[0].cfop'));
  chk('o item sem o CFOP fica de fora', !!deForaN(n => { n.itens[0].cfop = null; }, 'notas[0].itens[0].cfop'));
  chk('o item sem descrição fica de fora', !!deForaN(n => { n.itens[0].descricao = '  '; }, 'notas[0].itens[0].descricao'));
  chk('o item com a quantidade zero fica de fora', !!deForaN(n => { n.itens[0].quantidade = 0; }, 'notas[0].itens[0].quantidade'));
  chk('a nota sem nenhum item de compra (só devolução) fica de fora', !!deForaN(n => { n.itens[0].cfop = '1202'; }, 'notas[0].itens'));
  {
    const r2 = validarPacoteNotas(PACOTE(p => { p.notas[0].itens.push({ ...p.notas[0].itens[0], n: 2, cfop: '1910' }, { ...p.notas[0].itens[0], n: 3, cfop: '2102' }); }));
    const it = r2.ok && r2.pacote.notas[0].itens;
    chk('só vão os itens com CFOP de compra: a bonificação sai e entra na conta dos de fora', r2.ok && r2.recusadas.length === 0 && it.length === 2
      && it.map(x => x.cfop).join() === '1102,2102' && r2.itensFora === 1, r2);
  }
  chk('a nota sem itens fica de fora', !!deForaN(n => { n.itens = []; }, 'notas[0].itens'));
  chk('o item sem o valor total fica de fora', !!deForaN(n => { n.itens[0].valor_total = null; }, 'notas[0].itens[0].valor_total'));
  {
    const r2 = validarPacoteNotas(PACOTE(p => { p.notas.push(NOTA(1234)); }));
    chk('a mesma nota duas vezes no pacote: a segunda fica de fora', r2.ok && r2.pacote.notas.length === 3 && r2.recusadas.length === 1 && /repetida/.test(r2.recusadas[0].erro), r2);
  }
  {
    const r2 = validarPacoteNotas(PACOTE(p => { p.notas[0].itens[0].ean = 'SEM GTIN'; p.notas[0].itens[0].ncm = '0'; }));
    chk('o EAN "SEM GTIN" e o NCM que não é NCM viram nulo, sem recusar a nota', r2.ok && r2.recusadas.length === 0 && r2.pacote.notas[0].itens[0].ean === null && r2.pacote.notas[0].itens[0].ncm === null, r2);
  }
  chk('o CPF com zeros na frente parece CPF; o CNPJ, não', pareceCpf('00012345678909') && !pareceCpf(FORN) && !pareceCpf(EMP));
  chk('o CNPJ que começa com 000 e termina num CPF válido segue CNPJ (o do Banco do Brasil)', !pareceCpf('00000000000191'));
  {
    const comp = [
      { cliente_id: 'a', destino: 'um', escopo: 'nfe_entrada', notas_desde: '2025-10-01', revogado_em: null },
      { cliente_id: 'a', destino: 'dois', escopo: 'nfe_entrada', notas_desde: '2025-06-01', revogado_em: '2026-12-01' },
      { cliente_id: 'b', destino: 'um', escopo: 'nfe_entrada', notas_desde: '2025-10-01', revogado_em: '2026-11-04' },
      { cliente_id: 'c', destino: 'um', escopo: 'outro', notas_desde: '2025-10-01', revogado_em: null },
      { cliente_id: 'd', destino: 'um', escopo: 'nfe_entrada', notas_desde: '2026-01-01', revogado_em: null }
    ];
    const emp = [{ codigo: 902, cliente_id: 'a' }, { codigo: 901, cliente_id: 'a' }, { codigo: 903, cliente_id: 'b' }, { codigo: 904, cliente_id: 'c' }, { codigo: 905, cliente_id: 'd' }];
    const cli = [{ id: 'a', documento: '11.222.333/0001-00' }, { id: 'b', documento: '22333444000100' }, { id: 'c', documento: '33444555000100' }, { id: 'd', documento: '44555666000100' }];
    const um = { um: { url: 'https://destino.exemplo/um', chave: 'k'.repeat(40) } };
    const lista2 = empresasAutorizadas(comp, emp, cli, '2026-11-04', um);
    chk('as autorizadas: as ativas hoje (a revogada hoje fica de fora, a revogação marcada pra depois não), pelos dois códigos, com a menor data',
      JSON.stringify(lista2.map(x => [x.codigo, x.documento, x.desde])) === JSON.stringify([[901, EMP, '2025-06-01'], [902, EMP, '2025-06-01'], [905, '44555666000100', '2026-01-01']]), lista2);
    chk('pronta só quando o destino de cada autorização dela está configurado', lista2[0].pronta === false && lista2[1].pronta === false && lista2[2].pronta === true, lista2);
  }
  {
    const d = destinosDaConfig(JSON.stringify({ bom: { url: 'https://destino.exemplo/notas', chave: 'k'.repeat(40) }, http: { url: 'http://destino.exemplo', chave: 'k'.repeat(40) },
      curta: { url: 'https://destino.exemplo', chave: 'curta' } }));
    chk('o destino só com https e chave de 32 caracteres ou mais', Object.keys(d).join(',') === 'bom', d);
    chk('a configuração que não é JSON não tem destino', Object.keys(destinosDaConfig('{x')).length === 0);
  }

  // a porta de entrada, com um banco e um destino de mentira
  const SERVIDOR_AGORA = () => Date.parse('2026-11-04T07:10:00-03:00');
  function dbNotas({ destinos = null, docCadastro = EMP, revogado = null } = {}) {
    const t = {
      configuracoes_escritorio: [{ chave: 'ponte_chave_sha256', valor: h }, ...(destinos ? [{ chave: 'compartilhamentos_destinos', valor: JSON.stringify(destinos) }] : [])],
      compartilhamentos: [{ id: 'comp-1', cliente_id: 'a', destino: 'parceiro', escopo: 'nfe_entrada', notas_desde: '2025-10-01', revogado_em: revogado }],
      dominio_empresas: [{ codigo: 901, cliente_id: 'a' }],
      clientes: [{ id: 'a', documento: docCadastro }],
      compartilhamentos_envios: []
    };
    return {
      envios: t.compartilhamentos_envios,
      from(tabela) {
        const filtros = [];
        let modo = 'select', dados = null;
        const linhas = () => (t[tabela] || []).filter(l => filtros.every(([op, c, x]) => (op === 'eq' ? l[c] === x : x.includes(l[c]))));
        const api = {
          select() { return api; },
          eq(c, x) { filtros.push(['eq', c, x]); return api; },
          in(c, x) { filtros.push(['in', c, x]); return api; },
          not() { return api; },
          insert(obj) { modo = 'insert'; dados = obj; return api; },
          update(obj) { modo = 'update'; dados = obj; return api; },
          async maybeSingle() { return { data: linhas()[0] || null, error: null }; },
          async single() {
            if (modo === 'insert') { const linha = { id: 'env-' + (t[tabela].length + 1), ...dados }; t[tabela].push(linha); return { data: { id: linha.id }, error: null }; }
            return { data: linhas()[0] || null, error: null };
          },
          then(ok, erro) {
            if (modo === 'update') { linhas().forEach(l => Object.assign(l, dados)); return Promise.resolve({ data: null, error: null }).then(ok, erro); }
            return Promise.resolve({ data: linhas(), error: null }).then(ok, erro);
          }
        };
        return api;
      },
      async rpc() { return { data: null, error: { message: 'as notas não são gravadas' } }; }
    };
  }
  const DESTINOS = { parceiro: { url: 'https://destino.exemplo/notas', chave: 'k'.repeat(40) } };
  const pedirN = async (db, corpo, enviar) => {
    const atender = criarServidor({ criarDb: () => db, agora: SERVIDOR_AGORA, enviar });
    const r2 = await atender(new Request('http://local/ponte', { method: 'POST', headers: { 'x-chave': 'segredo' }, body: JSON.stringify(corpo) }));
    return { status: r2.status, corpo: await r2.json() };
  };
  const enviadas = [];
  const destinoOk = (corpoResp = { gravadas: 1, atualizadas: 1, repetidas: 0, itens_ignorados: 0, recusadas: [] }, status = 200) => async (url, init) => {
    enviadas.push({ url, init, corpo: JSON.parse(init.body) });
    return new Response(JSON.stringify(corpoResp), { status });
  };
  let rn = await pedirN(dbNotas(), { versao: 1, tipo: 'notas', pedir: 'autorizadas' }, destinoOk());
  chk('a lista das autorizadas, pelo código do Domínio — sem o destino, ainda não pronta',
    rn.status === 200 && JSON.stringify(rn.corpo.empresas) === JSON.stringify([{ codigo: 901, documento: EMP, desde: '2025-10-01', pronta: false }]), rn);
  rn = await pedirN(dbNotas({ destinos: DESTINOS }), { versao: 1, tipo: 'notas', pedir: 'autorizadas' }, destinoOk());
  chk('com o destino configurado, pronta', rn.status === 200 && rn.corpo.empresas[0].pronta === true, rn);
  rn = await pedirN(dbNotas({ revogado: '2026-11-04' }), { versao: 1, tipo: 'notas', pedir: 'autorizadas' }, destinoOk());
  chk('revogada hoje: a lista vem vazia', rn.status === 200 && rn.corpo.empresas.length === 0, rn);
  rn = await pedirN(dbNotas({ destinos: DESTINOS }), PACOTE(p => { p.empresa.codigo = 999; }), destinoOk());
  chk('empresa que não está na lista: 403 (a ponte não repete)', rn.status === 403 && rn.corpo.erro === SEM_AUTORIZACAO && enviadas.length === 0, rn);
  rn = await pedirN(dbNotas({ destinos: DESTINOS, docCadastro: '99888777000100' }), PACOTE(), destinoOk());
  chk('o documento do cadastro diferente do pacote: 403', rn.status === 403 && enviadas.length === 0, rn);
  rn = await pedirN(dbNotas({ destinos: DESTINOS, revogado: '2026-11-04' }), PACOTE(), destinoOk());
  chk('autorização revogada: 403', rn.status === 403 && enviadas.length === 0, rn);
  let dbn = dbNotas();
  rn = await pedirN(dbn, PACOTE(), destinoOk());
  chk('sem o destino configurado: 503, sem mandar nem registrar nada (a ponte tenta na próxima rodada)', rn.status === 503 && rn.corpo.erro === SEM_DESTINO && enviadas.length === 0 && dbn.envios.length === 0, rn);
  rn = await pedirN(dbNotas({ destinos: DESTINOS }), PACOTE(p => { p.tipo = 'notas'; p.rodada.id = 'x'; }), destinoOk());
  chk('pacote fora do contrato: 422 com o campo', rn.status === 422 && /rodada\.id/.test(rn.corpo.erro), rn);
  dbn = dbNotas({ destinos: DESTINOS });
  rn = await pedirN(dbn, PACOTE(), destinoOk());
  const ida = enviadas[0];
  chk('com o destino: 200, e vão só as de entrada a partir da data da autorização', rn.status === 200 && rn.corpo.ok && rn.corpo.notas === 3 && rn.corpo.mandadas === 2
    && ida && ida.corpo.notas.length === 2 && ida.corpo.notas.every(n => n.entrada >= '2025-10-01'), rn);
  chk('o destino recebe a chave dele, sem seguir redirecionamento, e o id do envio', ida && ida.url === 'https://destino.exemplo/notas' && ida.init.headers['x-chave'] === 'k'.repeat(40)
    && ida.init.redirect === 'manual' && ida.corpo.versao === 1 && ida.corpo.envio === 'env-1');
  chk('o destino não recebe o XML nem o código do produto do cliente', ida && ida.corpo.notas.every(n => !('xml' in n) && n.itens.every(i => !('codigo_produto' in i))));
  chk('o envio fica registrado: o período, quantas notas, itens e com os itens do XML, e o que o destino respondeu',
    dbn.envios.length === 1 && dbn.envios[0].situacao === 'ok' && dbn.envios[0].notas === 2 && dbn.envios[0].itens === 2 && dbn.envios[0].com_xml === 1
    && dbn.envios[0].de === '2026-09-16' && dbn.envios[0].ate === '2026-09-17' && dbn.envios[0].gravadas === 1 && dbn.envios[0].http_status === 200 && !!dbn.envios[0].concluido_em
    && JSON.stringify(dbn.envios[0].resposta) === JSON.stringify({ atualizadas: 1, itens_ignorados: 0 }), dbn.envios);
  chk('nada das notas é gravado no banco', !dbn.envios.some(x => 'itens_lista' in x || 'xml' in x));
  chk('a resposta diz quantos itens ficaram de fora por não serem de compra', rn.corpo.itens_fora === 0, rn);
  dbn = dbNotas({ destinos: DESTINOS });
  rn = await pedirN(dbn, PACOTE(), destinoOk({ erro: 'fora' }, 500));
  chk('o destino fora: 502 (a ponte manda de novo na próxima rodada) e o envio registrado com o erro',
    rn.status === 502 && rn.corpo.erro === DESTINO_FORA && dbn.envios[0].situacao === 'erro' && dbn.envios[0].http_status === 500 && /500/.test(dbn.envios[0].erro), dbn.envios);
  dbn = dbNotas({ destinos: DESTINOS });
  rn = await pedirN(dbn, PACOTE(), async () => { throw new TypeError('rede'); });
  chk('sem falar com o destino: 502, registrado', rn.status === 502 && dbn.envios[0].situacao === 'erro' && /não consegui/.test(dbn.envios[0].erro), dbn.envios);
  dbn = dbNotas({ destinos: DESTINOS });
  rn = await pedirN(dbn, PACOTE(), destinoOk({ gravadas: 1, repetidas: 0, recusadas: [{ chave: chaveCom(1234), motivo: 'sem itens que comparar' }] }));
  chk('o que o destino recusou volta pra ponte, com o motivo', rn.status === 200 && rn.corpo.recusadas.length === 1 && rn.corpo.recusadas[0].campo === 'destino'
    && rn.corpo.recusadas[0].erro === 'sem itens que comparar' && dbn.envios[0].recusadas.length === 1, rn);
}

console.log('O relatório de situação fiscal no Drive (09/11/2026):');
{
  const { validarRelatorio, nomeDoRelatorio, pastaFiscal, pastaSituacao, idDaPasta, nomeNormal, LIMITES_RELATORIO, SEM_PASTA, SEM_CADASTRO,
    SEM_DRIVE, DRIVE_FORA } = await import('../supabase/functions/ponte/relatorio.js');
  const { criarDrive, ErroDrive } = await import('../supabase/functions/ponte/drive.js');
  const PDF = '%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n';
  const b64 = s => Buffer.from(s, 'latin1').toString('base64');
  const REL = (extra = {}) => ({ versao: 1, tipo: 'receita', relatorio: 'situacao_fiscal', documento: '11.222.333/0001-00', emitido_em: '2026-11-03',
    ambiente: 'producao', pdf: b64(PDF), ...extra });
  const HOJE = '2026-11-09';
  const vr = validarRelatorio(REL(), HOJE);
  chk('o pedido do relatório passa: o CNPJ só com dígitos, o PDF em bytes', vr.ok && vr.relatorio.documento === '11222333000100'
    && vr.relatorio.bytes instanceof Uint8Array && Buffer.from(vr.relatorio.bytes).toString('latin1') === PDF && vr.relatorio.teste === false, vr);
  const recusaR = (extra, campo) => { const r = validarRelatorio(REL(extra), HOJE); return !r.ok && r.campo === campo ? r : null; };
  chk('versão, tipo e relatório desconhecidos recusam', !!recusaR({ versao: 2 }, 'versao') && !!recusaR({ tipo: 'dominio' }, 'tipo') && !!recusaR({ relatorio: 'declaracao' }, 'relatorio'));
  chk('o relatório é de um CNPJ (o CPF e o documento torto recusam)', !!recusaR({ documento: '12345678909' }, 'documento') && !!recusaR({ documento: '123' }, 'documento'));
  chk('o dia: de verdade, não depois de hoje, até 400 dias atrás', !!recusaR({ emitido_em: '2026-02-30' }, 'emitido_em') && !!recusaR({ emitido_em: '03/11/2026' }, 'emitido_em')
    && !!recusaR({ emitido_em: '2026-11-10' }, 'emitido_em') && !!recusaR({ emitido_em: '2025-09-01' }, 'emitido_em') && validarRelatorio(REL({ emitido_em: HOJE }), HOJE).ok);
  chk('sem o ambiente, recusa', !!recusaR({ ambiente: '' }, 'ambiente'));
  chk('o PDF: em base64 e começando com %PDF- (o resto recusa)', !!recusaR({ pdf: 'não é base64!' }, 'pdf') && !!recusaR({ pdf: b64('<html>oi</html>') }, 'pdf')
    && !!recusaR({ pdf: null }, 'pdf') && !!recusaR({ pdf: '' }, 'pdf') && validarRelatorio(REL({ pdf: b64(PDF).replace(/=+$/, '') }), HOJE).ok);
  chk('PDF de mais de 10 MB recusa (antes de decodificar)', !!recusaR({ pdf: 'A'.repeat(Math.ceil(LIMITES_RELATORIO.pdf / 3) * 4 + 8) }, 'pdf'));
  chk('o teste: true passa adiante', validarRelatorio(REL({ teste: true }), HOJE).relatorio.teste === true);
  chk('o nome do arquivo leva o dia na ordem do nome', nomeDoRelatorio('2026-11-03') === 'Relatório de situação fiscal 2026-11-03.pdf');
  const F = (id, name) => ({ id: id.padEnd(12, '0'), name });
  chk('a pasta do fiscal: FISCAL de nome exato primeiro (sem maiúscula vale), depois a numerada ou a SETOR FISCAL; FISCAL ANTIGO, não',
    pastaFiscal([F('a', 'SETOR FISCAL'), F('b', 'fiscal')]).name === 'fiscal' && pastaFiscal([F('a', '01 - Fiscal'), F('b', 'CONTÁBIL')]).name === '01 - Fiscal'
    && pastaFiscal([F('a', 'Setor Fiscal')]).name === 'Setor Fiscal' && pastaFiscal([F('a', 'FISCAL ANTIGO'), F('b', 'DOCUMENTOS FISCAIS')]) === null
    && pastaFiscal([{ id: "x' or name contains '", name: 'FISCAL' }]) === null && pastaFiscal(null) === null);
  chk('a pasta dos relatórios: SITUAÇÃO FISCAL, com ou sem acento', pastaSituacao([F('a', 'Situacao fiscal')]).name === 'Situacao fiscal'
    && pastaSituacao([F('a', 'RELATÓRIOS DE SITUAÇÃO FISCAL')]) !== null && pastaSituacao([F('a', 'SITUAÇÃO')]) === null && nomeNormal(' Situação  Fiscal ') === 'SITUACAO FISCAL');
  chk('a pasta da empresa: o id do cadastro, senão o do endereço', idDaPasta({ drive_folder_id: 'PASTA1234567' }) === 'PASTA1234567'
    && idDaPasta({ drive_folder_id: '', drive_folder_url: 'https://drive.google.com/drive/folders/PASTA7654321?usp=sharing' }) === 'PASTA7654321'
    && idDaPasta({ drive_folder_url: 'https://drive.google.com/' }) === null && idDaPasta(null) === null);

  // um Google de mentira: o token, os metadados, a lista das pastas, criar pasta e subir arquivo
  function googleFalso({ falhas = {} } = {}) {
    const g = { itens: new Map(), pedidos: [], tokens: 0, subidos: [], criadas: [], seq: 0 };
    g.add = (id, name, pai, pasta = true, trashed = false) => { g.itens.set(id, { id, name, parents: pai ? [pai] : [], mimeType: pasta ? 'application/vnd.google-apps.folder' : 'application/pdf', trashed }); return id; };
    const novoId = p => p + String(++g.seq).padStart(9, '0');
    const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
    g.fetch = async (url, init = {}) => {
      const u = new URL(url), metodo = init.method || 'GET';
      const tipo = u.host === 'oauth2.googleapis.com' ? 'token' : u.pathname.startsWith('/upload/') ? 'subir' : metodo === 'POST' ? 'criar' : /\/files\/[^/]+$/.test(u.pathname) ? 'meta' : 'listar';
      g.pedidos.push({ tipo, url, init });
      if (falhas[tipo] && falhas[tipo].length) { const st = falhas[tipo].shift(); if (st === 'rede') throw new TypeError('fetch failed'); return json({ error: 'x' }, st); }
      if (tipo === 'token') { g.tokens++; return json({ access_token: 'tok-' + g.tokens, expires_in: 3600 }); }
      if (tipo !== 'token' && (init.headers || {}).Authorization !== 'Bearer tok-' + g.tokens) return json({ error: 'sem token' }, 401);
      if (tipo === 'meta') { const it = g.itens.get(u.pathname.split('/').pop()); return it ? json({ id: it.id, mimeType: it.mimeType, trashed: it.trashed }) : json({ error: 'nf' }, 404); }
      if (tipo === 'listar') {
        const q = u.searchParams.get('q'), pai = /^'([^']+)' in parents/.exec(q)[1], pastas = / mimeType = /.test(q);
        return json({ files: [...g.itens.values()].filter(i => i.parents.includes(pai) && !i.trashed && (i.mimeType === 'application/vnd.google-apps.folder') === pastas).map(i => ({ id: i.id, name: i.name })) });
      }
      if (tipo === 'criar') { const b = JSON.parse(init.body); const id = g.add(novoId('PASTA'), b.name, b.parents[0]); g.criadas.push(b.name); return json({ id }); }
      const corpo = Buffer.from(init.body).toString('latin1');
      const meta = JSON.parse(/\r\n\r\n(\{[^\r]*\})\r\n/.exec(Buffer.from(init.body).toString('utf8'))[1]);
      const conteudo = corpo.split('Content-Type: application/pdf\r\n\r\n')[1].split('\r\n--')[0];
      const id = g.add(novoId('ARQ'), meta.name, meta.parents[0], false);
      g.subidos.push({ id, nome: meta.name, pai: meta.parents[0], conteudo, tipo: init.headers['Content-Type'] });
      return json({ id });
    };
    return g;
  }
  const ENV = { GOOGLE_OAUTH_CLIENT_ID: 'id-teste', GOOGLE_OAUTH_CLIENT_SECRET: 'segredo-teste', GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-teste' };
  const nada = async () => {};
  {
    const g = googleFalso({ falhas: { listar: [503] } });
    const raizG = g.add('RAIZ00000001', 'EMPRESA TESTE', null);
    g.add('FISC00000001', 'FISCAL', raizG); g.add('LIXO00000001', 'SITUAÇÃO FISCAL', 'FISC00000001', true, true);
    g.add('ARQV00000001', 'um arquivo.pdf', null, false); g.add('APAG00000001', 'APAGADA', null, true, true);
    const d = criarDrive({ fetch: g.fetch, env: k => ENV[k], esperar: nada });
    chk('o Drive configurado só com os três segredos', d.configurado() && !criarDrive({ env: () => null }).configurado());
    const g403 = googleFalso({ falhas: { meta: [403] } }); g403.add('RAIZ00000009', 'DE OUTRO DONO', null);
    chk('a pasta que abre; a que não existe, a de outro dono (403), a da lixeira, o arquivo e o id torto, não', await d.pastaAbre(raizG)
      && !(await d.pastaAbre('NAOEXISTE001')) && !(await d.pastaAbre('ARQV00000001')) && !(await d.pastaAbre('APAG00000001')) && !(await d.pastaAbre("x' or 1=1"))
      && !(await criarDrive({ fetch: g403.fetch, env: k => ENV[k], esperar: nada }).pastaAbre('RAIZ00000009')));
    const filhas = await d.filhas(raizG);
    chk('as subpastas, com o 503 passageiro tentado de novo', filhas.length === 1 && filhas[0].name === 'FISCAL' && g.pedidos.filter(p => p.tipo === 'listar').length === 2, filhas);
    chk('a pasta na lixeira não conta', (await d.filhas('FISC00000001')).length === 0);
    chk('o token é pedido uma vez só (vale uma hora)', g.tokens === 1);
    const idP = await d.criarPasta('SITUAÇÃO FISCAL', 'FISC00000001');
    const idA = await d.subir(idP, 'Relatório de situação fiscal 2026-11-03.pdf', new Uint8Array(Buffer.from(PDF, 'latin1')));
    chk('cria a pasta e sobe o PDF nela, com o nome e o conteúdo', g.criadas[0] === 'SITUAÇÃO FISCAL' && g.subidos.length === 1 && g.subidos[0].id === idA
      && g.subidos[0].pai === idP && g.subidos[0].nome === 'Relatório de situação fiscal 2026-11-03.pdf' && g.subidos[0].conteudo === PDF
      && /^multipart\/related; boundary=/.test(g.subidos[0].tipo), g.subidos);
    chk('os arquivos de uma pasta (não as subpastas)', (await d.arquivos(idP)).map(a => a.id).join() === idA && (await d.arquivos(raizG)).length === 0);
    let erro = null;
    try { await d.filhas("FISC' or name contains 'x"); } catch (e) { erro = e; }
    chk('id que não é do Drive nem chega na consulta', erro instanceof ErroDrive);
  }
  {
    const g = googleFalso({ falhas: { listar: [503, 503, 503] } });
    g.add('RAIZ00000001', 'EMPRESA', null);
    const d = criarDrive({ fetch: g.fetch, env: k => ENV[k], esperar: nada });
    let erro = null;
    try { await d.filhas('RAIZ00000001'); } catch (e) { erro = e; }
    chk('três 503 seguidos: o erro do Drive (a função responde 502)', erro instanceof ErroDrive && g.pedidos.filter(p => p.tipo === 'listar').length === 3);
    const g2 = googleFalso({ falhas: { token: [400] } });
    const d2 = criarDrive({ fetch: g2.fetch, env: k => ENV[k], esperar: nada });
    erro = null;
    try { await d2.pastaAbre('RAIZ00000001'); } catch (e) { erro = e; }
    chk('a autorização recusada pelo Google é erro do Drive, com o status', erro instanceof ErroDrive && /400/.test(erro.message));
  }

  // a rota, com o banco e o Google de mentira
  function dbRel({ clientes: cs = [], receita = [], erroUpsert = null } = {}) {
    const db = { upserts: [], filtros: [], receita: receita.map(x => ({ ...x })) };
    db.from = tabela => {
      const f = [];
      const api = {
        select() { return api; }, ilike(c, x) { f.push(['ilike', c, x]); return api; }, order() { return api; }, limit() { return api; },
        eq(c, x) { f.push(['eq', c, x]); return api; },
        async maybeSingle() {
          if (tabela === 'configuracoes_escritorio') return { data: { valor: h }, error: null };
          if (tabela === 'receita_empresas') return { data: db.receita.find(x => x.cliente_id === f.find(y => y[0] === 'eq')[2]) || null, error: null };
          return { data: null, error: null };
        },
        upsert(linha, op) { db.upserts.push({ tabela, linha, op }); if (!erroUpsert) { const i = db.receita.findIndex(x => x.cliente_id === linha.cliente_id); if (i >= 0) Object.assign(db.receita[i], linha); else db.receita.push({ ...linha }); } return Promise.resolve({ error: erroUpsert }); },
        then(ok, erro) {
          db.filtros.push([tabela, ...f]);
          let data = [];
          if (tabela === 'clientes') { const doc = (f.find(y => y[0] === 'ilike') || [])[2]; data = cs.filter(c => String(c.documento).toUpperCase() === String(doc).toUpperCase()).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 1); }
          return Promise.resolve({ data, error: null }).then(ok, erro);
        }
      };
      return api;
    };
    return db;
  }
  const CLI = [{ id: 'c2', documento: '11222333000100', drive_folder_id: 'RAIZ00000002' }, { id: 'c1', documento: '11222333000100', drive_folder_id: 'RAIZ00000001' },
    { id: 'c3', documento: '22333444000100', drive_folder_id: null, drive_folder_url: null }, { id: 'c4', documento: '33444555000100', drive_folder_id: 'SUMIU0000001' }];
  const pedirRel = async (db, g, corpo, env = ENV) => {
    const atender = criarServidor({ criarDb: () => db, agora: () => Date.parse('2026-11-09T11:00:00-03:00'), env: k => env[k], google: g.fetch, esperar: nada });
    const res = await atender(new Request('http://local/ponte', { method: 'POST', headers: { 'x-chave': 'segredo' }, body: JSON.stringify(corpo) }));
    return { status: res.status, corpo: await res.json() };
  };
  const montar = () => { const g = googleFalso(); g.add('RAIZ00000001', 'EMPRESA TESTE', null); g.add('FISC00000001', 'Fiscal', 'RAIZ00000001'); g.add('RAIZ00000002', 'OUTRA', null); return g; };
  let g = montar(), dbr = dbRel({ clientes: CLI, receita: [{ cliente_id: 'c1', situacao_fiscal_em: '2026-11-03' }] });
  let rr = await pedirRel(dbr, g, REL());
  const sub = g.subidos[0];
  chk('o relatório vai pra pasta da empresa ligada como o receita_gravar liga (a de menor id), em FISCAL › SITUAÇÃO FISCAL',
    rr.status === 200 && rr.corpo.gravado === true && rr.corpo.novo === true && rr.corpo.ficha === true && sub && g.itens.get(sub.pai).name === 'SITUAÇÃO FISCAL'
    && g.itens.get(sub.pai).parents[0] === 'FISC00000001' && g.criadas.join() === 'SITUAÇÃO FISCAL' && sub.conteudo === PDF, { rr, sub, criadas: g.criadas });
  chk('a ficha fica com o dia, o id e o link do Drive', dbr.upserts.length === 1 && dbr.upserts[0].tabela === 'receita_empresas' && dbr.upserts[0].op.onConflict === 'cliente_id'
    && dbr.upserts[0].linha.cliente_id === 'c1' && dbr.upserts[0].linha.situacao_fiscal_pdf_em === '2026-11-03' && dbr.upserts[0].linha.situacao_fiscal_pdf_id === sub.id
    && dbr.upserts[0].linha.situacao_fiscal_pdf_url === 'https://drive.google.com/file/d/' + sub.id + '/view' && rr.corpo.link === dbr.upserts[0].linha.situacao_fiscal_pdf_url, dbr.upserts);
  chk('o banco lê a empresa pelo documento, sem maiúscula e minúscula (o ilike do receita_gravar)', dbr.filtros.some(x => x[0] === 'clientes' && x[1][0] === 'ilike' && x[1][2] === '11222333000100'));
  rr = await pedirRel(dbr, g, REL());
  chk('mandado de novo (o banco tinha falhado): acha o que já subiu, não sobe outro nem cria pasta', rr.status === 200 && rr.corpo.novo === false && g.subidos.length === 1
    && g.criadas.length === 1 && rr.corpo.link.endsWith(sub.id + '/view'), rr);
  rr = await pedirRel(dbr, g, REL({ emitido_em: '2026-10-05' }));
  chk('o relatório mais velho que o da ficha vai pro Drive, e a ficha fica com o mais novo', rr.status === 200 && rr.corpo.gravado === true && rr.corpo.ficha === false
    && g.subidos.length === 2 && dbr.receita[0].situacao_fiscal_pdf_em === '2026-11-03' && dbr.upserts.length === 2, rr);
  g = montar(); g.itens.delete('FISC00000001'); dbr = dbRel({ clientes: CLI });
  rr = await pedirRel(dbr, g, REL());
  chk('sem a pasta FISCAL, cria as duas (FISCAL e SITUAÇÃO FISCAL); sem a linha da empresa, ela nasce', rr.status === 200 && g.criadas.join() === 'FISCAL,SITUAÇÃO FISCAL'
    && dbr.receita.length === 1 && dbr.receita[0].cliente_id === 'c1', { rr, criadas: g.criadas });
  g = montar(); dbr = dbRel({ clientes: CLI });
  rr = await pedirRel(dbr, g, REL({ teste: true }));
  chk('com teste: true, só diz o que faria: nenhuma pasta criada, nada subido, nada no banco', rr.status === 200 && rr.corpo.teste === true && rr.corpo.gravado === false
    && rr.corpo.fiscal === 'Fiscal' && rr.corpo.situacao === null && rr.corpo.arquivo === 'subiria' && rr.corpo.cria.join() === 'SITUAÇÃO FISCAL'
    && !g.criadas.length && !g.subidos.length && !dbr.upserts.length, rr);
  g = montar(); dbr = dbRel({ clientes: CLI });
  rr = await pedirRel(dbr, g, REL({ documento: '22333444000100' }));
  chk('sem a pasta no cadastro: 200, nada gravado, com o porquê (a ponte manda de novo depois)', rr.status === 200 && rr.corpo.gravado === false && rr.corpo.motivo === SEM_PASTA
    && !g.pedidos.some(p => p.tipo !== 'token') && !dbr.upserts.length, rr);
  rr = await pedirRel(dbr, g, REL({ documento: '33444555000100' }));
  chk('a pasta do cadastro que não abre (apagada, sem acesso): o mesmo', rr.status === 200 && rr.corpo.gravado === false && rr.corpo.motivo === SEM_PASTA && !g.subidos.length, rr);
  rr = await pedirRel(dbr, g, REL({ documento: '44555666000100' }));
  chk('a empresa fora do cadastro: 422 (a ponte não manda de novo)', rr.status === 422 && rr.corpo.erro === SEM_CADASTRO, rr);
  g = montar(); dbr = dbRel({ clientes: CLI });
  rr = await pedirRel(dbr, g, REL({ ambiente: 'demonstracao' }));
  chk('do ambiente de demonstração: 200, nada no Drive nem no banco', rr.status === 200 && rr.corpo.gravado === false && !g.pedidos.length && !dbr.upserts.length
    && !dbr.filtros.some(x => x[0] === 'clientes'), rr);
  rr = await pedirRel(dbr, g, REL(), {});
  chk('sem os segredos do Google: 503 (a ponte manda de novo depois)', rr.status === 503 && rr.corpo.erro === SEM_DRIVE && !g.pedidos.length, rr);
  g = googleFalso({ falhas: { meta: [503, 503, 503] } }); g.add('RAIZ00000001', 'EMPRESA', null);
  rr = await pedirRel(dbRel({ clientes: CLI }), g, REL());
  chk('o Drive fora: 502, sem detalhe do Google na resposta', rr.status === 502 && rr.corpo.erro === DRIVE_FORA, rr);
  g = montar();
  rr = await pedirRel(dbRel({ clientes: CLI, erroUpsert: { message: 'caiu' } }), g, REL());
  chk('o banco falhou depois de subir: 500 (a ponte manda de novo e acha o arquivo)', rr.status === 500 && g.subidos.length === 1, rr);
  rr = await pedirRel(dbRel({ clientes: CLI }), montar(), REL({ pdf: b64('isto não é pdf') }));
  chk('o pedido fora do contrato: 422 com o campo', rr.status === 422 && /\(pdf\)/.test(rr.corpo.erro), rr);
}

console.log('A data de entrada das notas de compra de fora do RS (26/11/2026):');
{
  const FORN = '44555666000100';   // inventado, com o dígito verificador errado de propósito
  const chaveDe = (numero, { uf = '42', aamm = '2609', cnpj = FORN, modelo = '55' } = {}) => {
    const base = uf + aamm + cnpj + modelo + '001' + String(numero).padStart(9, '0') + '1' + '00004321';
    return base + dvDaChave(base);
  };
  const HOJE = '2026-11-26';
  chk('a janela: o mês de hoje e os dois antes', JSON.stringify(janelaDasEntradas(HOJE)) === JSON.stringify({ desde: '2026-09-01', ate: HOJE })
    && janelaDasEntradas('2026-01-15').desde === '2025-11-01' && janelaDasEntradas('2026-03-31').desde === '2026-01-01', janelaDasEntradas('2026-01-15'));
  chk('as empresas: os códigos do Domínio ligados ao cadastro, sem repetir, em ordem',
    JSON.stringify(empresasDasEntradas([{ codigo: 12, cliente_id: 'a' }, { codigo: 5, cliente_id: 'b' }, { codigo: 12, cliente_id: 'a' }, { codigo: 7, cliente_id: null }, { codigo: '8', cliente_id: 'c' }]))
      === JSON.stringify([{ codigo: 5 }, { codigo: 12 }]));
  const CPF_NA_CHAVE = '000' + '52998224725';   // um CPF de exemplo com os dígitos certos, no lugar do CNPJ
  chk('o CPF de exemplo é reconhecido como CPF', pareceCpf(CPF_NA_CHAVE));
  const PAC = mudar => {
    const p = { versao: 1, tipo: 'entradas', rodada: { id: '9D0C5C56-1111-4A2B-9C3D-000000000026', inicio: '2026-11-26T07:20:00-03:00', maquina: 'PC-PONTE', ponte: '0.6.0', extra: 'x' },
      empresas: [
        { codigo: 901, notas: [{ chave: chaveDe(1), entrada: '2026-10-01', fornecedor: 'NÃO DEVIA IR' }, { chave: chaveDe(2, { aamm: '2610' }), entrada: '2026-10-03' }] },
        { codigo: 904, notas: [{ chave: chaveDe(3, { cnpj: 'AB12CD34EF5601' }).toLowerCase(), entrada: '2026-09-30' }] }
      ] };
    if (mudar) mudar(p);
    return p;
  };
  const ve = validarPacoteEntradas(PAC(), HOJE);
  chk('o pacote do contrato passa, sem recusa', ve.ok && ve.recusadas.length === 0 && ve.pacote.empresas.length === 2 && ve.pacote.empresas[0].notas.length === 2, ve);
  chk('só a chave e a data: o resto fica de fora; a rodada sem o que o contrato não prevê, o id em minúscula',
    ve.ok && JSON.stringify(ve.pacote.empresas[0].notas[0]) === JSON.stringify({ chave: chaveDe(1), entrada: '2026-10-01' })
      && !('extra' in ve.pacote.rodada) && ve.pacote.rodada.id === '9d0c5c56-1111-4a2b-9c3d-000000000026', ve.ok && ve.pacote);
  chk('a chave com letras (o CNPJ alfanumérico) em maiúscula', ve.ok && ve.pacote.empresas[1].notas[0].chave === chaveDe(3, { cnpj: 'AB12CD34EF5601' }));
  const naNota = (mudar, campo, erro) => {
    const r = validarPacoteEntradas(PAC(p => mudar(p.empresas[0].notas[0], p)), HOJE);
    const rec = r.ok && r.recusadas.find(x => x.campo === campo);
    return r.ok && rec && (!erro || erro.test(rec.erro)) && r.pacote.empresas[0].notas.length === 1 && r.pacote.empresas[1].notas.length === 1 && rec.codigo === 901 ? r : null;
  };
  chk('a nota do RS fica de fora sozinha', !!naNota(n => { n.chave = chaveDe(1, { uf: '43' }); }, 'empresas[0].notas[0].chave', /do RS/));
  chk('a NFC-e (modelo 65) fica de fora', !!naNota(n => { n.chave = chaveDe(1, { modelo: '65' }); }, 'empresas[0].notas[0].chave', /modelo 55/));
  chk('a chave com o dígito verificador errado fica de fora', !!naNota(n => { n.chave = n.chave.slice(0, 43) + ((Number(n.chave[43]) + 1) % 10); }, 'empresas[0].notas[0].chave', /inválida/));
  chk('a nota de emitente pessoa física (o CPF na chave) não vai', !!naNota(n => { n.chave = chaveDe(1, { cnpj: CPF_NA_CHAVE }); }, 'empresas[0].notas[0].chave', /pessoa física/));
  chk('a entrada antes do mês da emissão fica de fora', !!naNota(n => { n.entrada = '2026-08-31'; }, 'empresas[0].notas[0].entrada', /antes do mês da emissão/));
  chk('a data que não existe fica de fora', !!naNota(n => { n.entrada = '2026-09-31'; }, 'empresas[0].notas[0].entrada', /não existe/));
  chk('depois de hoje fica de fora', !!naNota(n => { n.entrada = '2026-11-27'; }, 'empresas[0].notas[0].entrada', /janela/));
  chk('antes da janela, com o mês de folga, fica de fora', !!naNota(n => { n.chave = chaveDe(1, { aamm: '2607' }); n.entrada = '2026-07-31'; }, 'empresas[0].notas[0].entrada', /janela/));
  {
    const r = validarPacoteEntradas(PAC(p => { p.empresas[0].notas[0].chave = chaveDe(1, { aamm: '2608' }); p.empresas[0].notas[0].entrada = '2026-08-03'; }), HOJE);
    chk('o mês de folga: a ponte que pediu a janela antes da virada do mês não perde as notas', r.ok && r.recusadas.length === 0, r);
  }
  chk('a nota repetida na empresa: a segunda fica de fora', !!(() => {
    const r = validarPacoteEntradas(PAC(p => { p.empresas[0].notas.push({ chave: chaveDe(1), entrada: '2026-10-02' }); }), HOJE);
    return r.ok && r.pacote.empresas[0].notas.length === 2 && r.pacote.empresas[0].notas[0].entrada === '2026-10-01'
      && r.recusadas.length === 1 && /repetida/.test(r.recusadas[0].erro) ? r : null;
  })());
  chk('a empresa repetida, ou sem a lista, fica de fora sozinha', !!(() => {
    const r = validarPacoteEntradas(PAC(p => { p.empresas.push({ codigo: 901, notas: [] }, { codigo: 905, notas: 'x' }, { codigo: 'x', notas: [] }); }), HOJE);
    return r.ok && r.pacote.empresas.length === 2 && r.recusadas.length === 3 && r.recusadas.map(x => x.codigo).join() === '901,905,' ? r : null;
  })());
  const doPacote = (mudar, campo) => { const r = validarPacoteEntradas(PAC(mudar), HOJE); return !r.ok && r.campo === campo ? r : null; };
  chk('o que é do pacote recusa o pacote inteiro (a versão, a rodada, a lista, notas demais)',
    !!doPacote(p => { p.versao = 2; }, 'versao') && !!doPacote(p => { p.rodada.id = 'abc'; }, 'rodada.id') && !!doPacote(p => { p.rodada.inicio = '2026-11-26 07:20'; }, 'rodada.inicio')
      && !!doPacote(p => { p.empresas = {}; }, 'empresas')
      && !!doPacote(p => { p.empresas[0].notas = Array.from({ length: LIMITES_ENTRADAS.notas }, (_, i) => ({ chave: chaveDe(i + 10), entrada: '2026-10-01' })); }, 'empresas'));
  {
    const g = notasParaGravar(ve.pacote, [{ codigo: 901, cliente_id: 'a' }, { codigo: 902, cliente_id: 'b' }]);
    chk('pro banco: cada nota com o cliente do código; a empresa fora da lista fica de fora, com o porquê',
      g.notas.length === 2 && g.notas.every(n => n.cliente_id === 'a') && g.recusadas.length === 1 && g.recusadas[0].codigo === 904 && g.recusadas[0].erro === SEM_SEDIF, g);
  }
  {
    // a varredura da lista da Domínio (26/11/2026): só o cliente com todos os códigos dele no pacote e sem nota recusada
    const emp = [{ codigo: 901, cliente_id: 'a' }, { codigo: 904, cliente_id: 'a' }, { codigo: 905, cliente_id: 'b' }, { codigo: 906, cliente_id: 'c' }, { codigo: 907, cliente_id: null }];
    const pac = { empresas: [{ codigo: 901, notas: [] }, { codigo: 904, notas: [] }, { codigo: 905, notas: [] }] };
    chk('varre o cliente com todos os códigos no pacote; o que não veio (o 906, sem nota ou com erro na leitura) fica como estava',
      JSON.stringify(clientesParaVarrer(pac, emp, [])) === JSON.stringify(['a', 'b']), clientesParaVarrer(pac, emp, []));
    chk('o cliente com um código fora do pacote não é varrido (a lista do outro código não veio)',
      JSON.stringify(clientesParaVarrer({ empresas: [{ codigo: 901, notas: [] }, { codigo: 905, notas: [] }] }, emp, [])) === JSON.stringify(['b']));
    chk('o cliente com nota recusada não é varrido (a recusada pode estar na Domínio)',
      JSON.stringify(clientesParaVarrer(pac, emp, [{ codigo: 904, chave: 'X', campo: 'c', erro: 'e' }, { codigo: null }])) === JSON.stringify(['b']));
  }

  // a porta de entrada, com um banco de mentira
  const AGORA_E = () => Date.parse('2026-11-26T07:30:00-03:00');
  // as do Simples da carteira de hoje (27/11/2026, pedido da Thalia: "todas do simples"): s1 e s4 entram (a s4 sai da
  // carteira depois de hoje); a s2 saiu, a m1 é MEI, a p1 é pessoa física, a s3 não tem a entrada na carteira e a s5 não
  // tem o código do Domínio — ficam fora; a "a", vinculada e do Simples, não repete
  const CARTEIRA_E = [{ cliente_id: 'a', entrada: '2024-01-01', saida: null }, { cliente_id: 's1', entrada: '2025-01-01', saida: null },
    { cliente_id: 's2', entrada: '2025-01-01', saida: '2026-10-31' }, { cliente_id: 'm1', entrada: '2025-01-01', saida: null },
    { cliente_id: 'p1', entrada: '2025-01-01', saida: null }, { cliente_id: 's3', entrada: null, saida: null },
    { cliente_id: 's4', entrada: '2025-01-01', saida: '2026-12-31' }, { cliente_id: 's5', entrada: '2025-01-01', saida: null }];
  const SIMPLES = (id, o = {}) => ({ id, regime_tributario: 'Simples Nacional', tipo_pessoa: 'PJ', ...o });
  const CLIENTES_E = [SIMPLES('a'), SIMPLES('s1'), SIMPLES('s2'), SIMPLES('m1', { regime_tributario: 'MEI' }), SIMPLES('p1', { tipo_pessoa: 'PF' }),
    SIMPLES('s3'), SIMPLES('s4'), SIMPLES('s5')];
  function dbEntradas({ rpcErro = null, semDestda = false, listaErro = null, comCarteira = false } = {}) {
    const t = {
      configuracoes_escritorio: [{ chave: 'ponte_chave_sha256', valor: h }],
      obrigacoes_fiscais: semDestda ? [{ id: 'o2', nome: 'PGDAS' }] : [{ id: 'o1', nome: 'SEDIF/DESTDA - SIMPLES NACIONAL' }, { id: 'o2', nome: 'PGDAS' }],
      cliente_obrigacoes: [{ cliente_id: 'a', obrigacao_id: 'o1', ativo: true }, { cliente_id: 'b', obrigacao_id: 'o1', ativo: false }, { cliente_id: 'c', obrigacao_id: 'o2', ativo: true }],
      dominio_empresas: [{ codigo: 901, cliente_id: 'a' }, { codigo: 902, cliente_id: 'b' }, { codigo: 903, cliente_id: 'c' }, { codigo: 904, cliente_id: 'a' }]
        .concat(comCarteira ? [{ codigo: 905, cliente_id: 's1' }, { codigo: 906, cliente_id: 's2' }, { codigo: 907, cliente_id: 'm1' }, { codigo: 908, cliente_id: 'p1' },
          { codigo: 909, cliente_id: 's3' }, { codigo: 910, cliente_id: 's4' }] : []),
      ...(comCarteira ? { carteira_info: CARTEIRA_E, clientes: CLIENTES_E } : {})
    };
    const chamadas = [];
    return {
      chamadas,
      from(tabela) {
        const filtros = [];
        const linhas = () => (t[tabela] || []).filter(l => filtros.every(([op, c, x]) => (op === 'eq' ? l[c] === x : op === 'in' ? x.includes(l[c])
          : new RegExp(x.replace(/%/g, '.*'), 'i').test(String(l[c] || '')))));
        const api = {
          select() { return api; },
          eq(c, x) { filtros.push(['eq', c, x]); return api; },
          in(c, x) { filtros.push(['in', c, x]); return api; },
          ilike(c, x) { filtros.push(['ilike', c, x]); return api; },
          async maybeSingle() { return { data: linhas()[0] || null, error: null }; },
          then(ok, erro) { return Promise.resolve({ data: linhas(), error: null }).then(ok, erro); }
        };
        return api;
      },
      async rpc(nome, args) {
        chamadas.push({ nome, args });
        if (rpcErro) return { data: null, error: rpcErro };
        const n = args.p.notas.length;
        if (nome === 'nf_entradas_dominio_gravar') {
          if (listaErro) return { data: null, error: listaErro };
          return { data: { listadas: n, novas: n, mudaram: 0, sairam: args.p.varrer ? 2 : 0 }, error: null };
        }
        return { data: { recebidas: n, achadas: Math.max(0, n - 1), atualizadas: Math.max(0, n - 2) }, error: null };
      }
    };
  }
  const daLista = dbe => dbe.chamadas.filter(c => c.nome === 'nf_entradas_dominio_gravar');
  const pedirE = async (db, corpo) => {
    const atender = criarServidor({ criarDb: () => db, agora: AGORA_E });
    const r2 = await atender(new Request('http://local/ponte', { method: 'POST', headers: { 'x-chave': 'segredo' }, body: JSON.stringify(corpo) }));
    return { status: r2.status, corpo: await r2.json() };
  };
  let re = await pedirE(dbEntradas(), { versao: 1, tipo: 'entradas', pedir: 'empresas' });
  chk('a lista: só as empresas com o vínculo ativo da SEDIF/DeSTDA, pelo código do Domínio, e a janela',
    re.status === 200 && JSON.stringify(re.corpo) === JSON.stringify({ empresas: [{ codigo: 901 }, { codigo: 904 }], desde: '2026-09-01', ate: HOJE }), re);
  re = await pedirE(dbEntradas({ semDestda: true }), { versao: 1, tipo: 'entradas', pedir: 'empresas' });
  chk('sem a obrigação no catálogo, a lista vem vazia', re.status === 200 && re.corpo.empresas.length === 0, re);
  console.log('As do Simples da carteira de hoje (27/11/2026, pedido da Thalia: "todas do simples"):');
  chk('a regra: as vinculadas e as do Simples (PJ) da carteira de hoje, sem repetir, em ordem',
    JSON.stringify(clientesDaSedif(['a', 'a', null], CARTEIRA_E, CLIENTES_E, HOJE)) === JSON.stringify(['a', 's1', 's4', 's5']));
  chk('a saída de hoje já não conta; a de amanhã, conta',
    JSON.stringify(clientesDaSedif([], [{ cliente_id: 'x', entrada: '2025-01-01', saida: HOJE }, { cliente_id: 'y', entrada: '2025-01-01', saida: '2026-11-27' }],
      [SIMPLES('x'), SIMPLES('y')], HOJE)) === JSON.stringify(['y']));
  chk('sem carteira nem cadastro, só as vinculadas', JSON.stringify(clientesDaSedif(['b', 'a'], null, null, HOJE)) === JSON.stringify(['a', 'b']));
  re = await pedirE(dbEntradas({ comCarteira: true }), { versao: 1, tipo: 'entradas', pedir: 'empresas' });
  chk('a lista vai com as do Simples da carteira, pelo código do Domínio (a sem código fica de fora)',
    re.status === 200 && JSON.stringify(re.corpo.empresas) === JSON.stringify([{ codigo: 901 }, { codigo: 904 }, { codigo: 905 }, { codigo: 910 }]), re);
  re = await pedirE(dbEntradas({ comCarteira: true, semDestda: true }), { versao: 1, tipo: 'entradas', pedir: 'empresas' });
  chk('sem a obrigação no catálogo, ficam as do Simples da carteira',
    re.status === 200 && JSON.stringify(re.corpo.empresas) === JSON.stringify([{ codigo: 901 }, { codigo: 904 }, { codigo: 905 }, { codigo: 910 }]), re);
  {
    const dbc = dbEntradas({ comCarteira: true });
    const rc = await pedirE(dbc, PAC(p => { p.empresas.push({ codigo: 905, notas: [{ chave: chaveDe(11), entrada: '2026-10-05' }] }, { codigo: 906, notas: [{ chave: chaveDe(12), entrada: '2026-10-05' }] }); }));
    chk('as notas da do Simples da carteira são gravadas; a da que saiu volta em recusadas',
      rc.status === 200 && dbc.chamadas[0].args.p.notas.some(n => n.cliente_id === 's1') && !dbc.chamadas[0].args.p.notas.some(n => n.cliente_id === 's2')
        && rc.corpo.recusadas.some(x => x.codigo === 906 && x.erro === SEM_SEDIF), rc);
  }
  let dbe = dbEntradas();
  re = await pedirE(dbe, PAC(p => { p.empresas.push({ codigo: 903, notas: [{ chave: chaveDe(7), entrada: '2026-10-05' }] }); p.empresas[0].notas.push({ chave: chaveDe(8, { uf: '43' }), entrada: '2026-10-05' }); }));
  chk('o pacote: grava as notas das empresas da lista, pelo cliente; a de fora da lista e a nota do RS voltam em recusadas',
    re.status === 200 && re.corpo.ok && re.corpo.gravado && re.corpo.notas === 3 && re.corpo.empresas === 3
      && dbe.chamadas[0].nome === 'nf_gravar_entradas' && dbe.chamadas[0].args.p.notas.every(n => n.cliente_id === 'a' && Object.keys(n).join() === 'cliente_id,chave,entrada')
      && re.corpo.total_recusadas === 2 && re.corpo.recusadas.some(x => x.codigo === 903 && x.erro === SEM_SEDIF) && re.corpo.recusadas.some(x => /do RS/.test(x.erro))
      && re.corpo.recebidas === 3 && re.corpo.achadas === 2 && re.corpo.atualizadas === 1, re);
  chk('e guarda a lista da Domínio, as mesmas notas, com o início da rodada; sem varrer (a empresa com nota recusada)',
    dbe.chamadas.length === 2 && daLista(dbe).length === 1 && daLista(dbe)[0].args.p.visto === '2026-11-26T07:20:00-03:00'
      && JSON.stringify(daLista(dbe)[0].args.p.notas) === JSON.stringify(dbe.chamadas[0].args.p.notas) && !('varrer' in daLista(dbe)[0].args.p)
      && JSON.stringify(re.corpo.lista) === JSON.stringify({ listadas: 3, novas: 3, mudaram: 0, sairam: 0 }), { chamadas: dbe.chamadas.map(c => c.nome), lista: re.corpo.lista });
  dbe = dbEntradas();
  re = await pedirE(dbe, PAC());
  chk('o pacote com a empresa inteira (os dois códigos do cliente, sem recusa): depois da lista, varre o cliente na janela',
    re.status === 200 && daLista(dbe).length === 2 && JSON.stringify(daLista(dbe)[1].args.p) === JSON.stringify({ visto: '2026-11-26T07:20:00-03:00', notas: [],
      varrer: { clientes: ['a'], desde: '2026-09-01', ate: HOJE } }) && JSON.stringify(re.corpo.lista) === JSON.stringify({ listadas: 3, novas: 3, mudaram: 0, sairam: 2 }),
    { chamadas: dbe.chamadas.map(c => [c.nome, c.args.p]), lista: re.corpo.lista });
  dbe = dbEntradas();
  re = await pedirE(dbe, PAC(p => { p.empresas.pop(); }));
  chk('sem o outro código do cliente no pacote, não varre', re.status === 200 && daLista(dbe).length === 1 && !daLista(dbe).some(c => c.args.p.varrer), dbe.chamadas.map(c => c.nome));
  dbe = dbEntradas({ listaErro: { message: 'relation does not exist' } });
  re = await pedirE(dbe, PAC());
  chk('a lista que não grava não muda as datas: 200, com o lista_erro em português e sem o erro do banco',
    re.status === 200 && re.corpo.ok && re.corpo.recebidas === 3 && !('lista' in re.corpo) && /lista das notas da Domínio/.test(re.corpo.lista_erro) && !/relation/.test(JSON.stringify(re.corpo)), re);
  dbe = dbEntradas();
  re = await pedirE(dbe, PAC(p => { p.empresas = [{ codigo: 901, notas: Array.from({ length: 4500 }, (_, i) => ({ chave: chaveDe(1000 + i), entrada: '2026-10-01' })) }]; }));
  chk('em partes de ' + LIMITES_ENTRADAS.porVez + ', com os totais somados (as datas e a lista)',
    re.status === 200 && dbe.chamadas.filter(c => c.nome === 'nf_gravar_entradas').map(c => c.args.p.notas.length).join() === '2000,2000,500'
      && daLista(dbe).map(c => c.args.p.notas.length).join() === '2000,2000,500' && re.corpo.recebidas === 4500 && re.corpo.achadas === 4497 && re.corpo.lista.listadas === 4500,
    { status: re.status, partes: dbe.chamadas.map(c => c.nome + ':' + c.args.p.notas.length), corpo: re.corpo });
  re = await pedirE(dbEntradas({ rpcErro: { message: 'caiu' } }), PAC());
  chk('o banco falhou nas datas: 500 (a ponte manda de novo)', re.status === 500, re);
  re = await pedirE(dbEntradas(), PAC(p => { p.rodada.id = 'x'; }));
  chk('o pacote fora do contrato: 422 com o campo', re.status === 422 && /rodada\.id/.test(re.corpo.erro), re);
  re = await pedirE(dbEntradas(), PAC(p => { p.versao = 2; }));
  chk('a versão 2 é só do pacote do Domínio: 422', re.status === 422 && /Versão do pacote/.test(re.corpo.erro), re);
}

console.log('As notas de entrada das empresas da SEDIF/DeSTDA, do XML que a Domínio guarda (26/11/2026):');
{
  const FORN = '44555666000100';   // inventado, com o dígito verificador errado de propósito
  const EMPRESA = '22333444000100';
  const chaveDe = (numero, { uf = '42', aamm = '2610', cnpj = FORN, modelo = '55', serie = '001' } = {}) => {
    const base = uf + aamm + cnpj + modelo + serie + String(numero).padStart(9, '0') + '1' + '00004321';
    return base + dvDaChave(base);
  };
  const HOJE = '2026-11-26';
  const FISCO = '99888777000100';   // inventado: o CNPJ do Fisco que vai na chave da NF-e avulsa
  const ITEM = (n, mudar) => {
    const i = { n_item: n, codigo: 'A' + n, descricao: '  SECADOR  ', ncm: '85163100', cest: null, cfop: '6102', unidade: 'UN',
      quantidade: 10, valor_unitario: 100, valor_total: 1000, desconto: 0, icms_origem: '1', icms_cst: '00', csosn: null,
      pis_cst: '01', cofins_cst: '01', icms_valor: 40, icms_st_valor: 0, ipi_valor: 7.5, pis_valor: 6.5, cofins_valor: 30,
      icms_base: 1000, icms_aliquota: 4, icms_st_base: null, ean: 'NÃO DEVIA IR' };
    if (mudar) mudar(i);
    return i;
  };
  const NOTA = (numero, mudar) => {
    const n = { chave: chaveDe(numero), entrada: '2026-10-02', xml: '<nfeProc>NÃO DEVIA IR</nfeProc>',
      doc: { modelo: '55', serie: '1', numero: String(numero), data_emissao: '2026-09-30', tp_nf: 1, finalidade: 1,
        natureza_operacao: 'VENDA', emit_doc: FORN, emit_nome: 'FORNECEDOR', emit_uf: 'sc', emit_municipio: 'JOINVILLE',
        emit_ie: '123', emit_crt: 3, dest_doc: EMPRESA, dest_tipo: 'PJ', dest_nome: 'CLIENTE', dest_uf: 'RS',
        dest_municipio: 'TRES COROAS', dest_ie: '456', dest_ind_ie: 1, valor_total: 1007.5, valor_produtos: 1000,
        valor_desconto: 0, valor_frete: 0, icms: 40, icms_st: 0, ipi: 7.5, pis: 6.5, cofins: 30, cfop_principal: '6102',
        status: 'autorizada', segredo: 'x' },
      itens: [ITEM(1), ITEM(2, i => { i.icms_aliquota = 12; i.icms_st_base = 700; i.icms_st_valor = 59; })] };
    n.chave = chaveDe(numero, { aamm: '2609' });
    if (mudar) mudar(n);
    return n;
  };
  const PAC = mudar => {
    const p = { versao: 1, tipo: 'sedif', rodada: { id: '9D0C5C56-1111-4A2B-9C3D-000000000027', inicio: '2026-11-26T07:25:00-03:00', maquina: 'PC-PONTE', ponte: '0.7.0', extra: 'x' },
      empresa: { codigo: 901, nome: 'NÃO DEVIA IR' }, notas: [NOTA(1), NOTA(2, n => { n.chave = chaveDe(2, { cnpj: 'AB12CD34EF5601' }); n.doc.emit_doc = 'AB.12C.D34/EF56-01'; })] };
    if (mudar) mudar(p);
    return p;
  };
  const vs = validarPacoteSedif(PAC(), HOJE);
  chk('o pacote do contrato passa, sem recusa', vs.ok && vs.recusadas.length === 0 && vs.pacote.notas.length === 2, vs.ok ? vs.recusadas : vs);
  const n0 = vs.ok && vs.pacote.notas[0];
  chk('só os campos da nf_documentos e da nf_itens: o XML, o EAN e o que o contrato não prevê ficam de fora',
    n0 && JSON.stringify(Object.keys(n0)) === JSON.stringify(['chave', 'entrada', 'doc', 'itens']) && !('segredo' in n0.doc)
      && !('ean' in n0.itens[0]) && Object.keys(n0.itens[0]).length === 24 && Object.keys(n0.doc).length === 31
      && !('extra' in vs.pacote.rodada) && !('nome' in vs.pacote.empresa), n0 && { doc: Object.keys(n0.doc).length, item: Object.keys(n0.itens[0]) });
  chk('o texto como o importador guarda (sem as pontas), a UF em maiúscula, o CNPJ com letras normalizado como o do sistema',
    n0 && n0.itens[0].descricao === 'SECADOR' && n0.doc.emit_uf === 'SC' && vs.pacote.notas[1].doc.emit_doc === 'AB12CD34EF5601', n0 && n0.itens[0]);
  chk('o nulo segue nulo (a alíquota do Simples, a base da ST) e o valor que falta vira 0, como no importador',
    !!(() => { const r = validarPacoteSedif(PAC(p => { p.notas[0].itens[0].icms_aliquota = null; delete p.notas[0].itens[0].desconto; delete p.notas[0].doc.valor_frete; }), HOJE);
      const i = r.ok && r.pacote.notas[0].itens[0]; return i && i.icms_aliquota === null && i.desconto === 0 && r.pacote.notas[0].doc.valor_frete === 0 ? r : null; })());
  const naNota = (mudar, campo, erro) => {
    const r = validarPacoteSedif(PAC(p => mudar(p.notas[0], p)), HOJE);
    const rec = r.ok && r.recusadas.find(x => x.campo === campo);
    return r.ok && rec && (!erro || erro.test(rec.erro)) && r.pacote.notas.length === 1 && rec.codigo === 901 ? r : null;
  };
  chk('a chave com o dígito verificador errado fica de fora sozinha', !!naNota(n => { n.chave = n.chave.slice(0, 43) + ((Number(n.chave[43]) + 1) % 10); }, 'notas[0].chave', /inválida/));
  chk('a NFC-e (modelo 65) fica de fora', !!naNota(n => { n.chave = chaveDe(1, { aamm: '2609', modelo: '65' }); }, 'notas[0].chave', /modelo 55/));
  chk('a nota de emitente pessoa física (o CPF na chave) não vai', !!naNota(n => { n.chave = chaveDe(1, { aamm: '2609', cnpj: '000' + '52998224725' }); }, 'notas[0].chave', /pessoa física/));
  chk('o emitente com CPF no XML não vai', !!naNota(n => { n.doc.emit_doc = '529.982.247-25'; }, 'notas[0].doc.emit_doc', /pessoa física/));
  chk('o emitente do XML que não é o da chave fica de fora', !!naNota(n => { n.doc.emit_doc = '11222333000181'; }, 'notas[0].doc.emit_doc', /não é o da chave/));
  chk('a NF-e avulsa (série 890 a 899) vai: a chave leva o CNPJ do Fisco e o XML, o vendedor',
    !!(() => { const r = validarPacoteSedif(PAC(p => { p.notas[0].chave = chaveDe(1, { aamm: '2609', cnpj: FISCO, serie: '890' }); p.notas[0].doc.serie = '890'; }), HOJE);
      return r.ok && r.recusadas.length === 0 && r.pacote.notas[0].doc.emit_doc === FORN ? r : null; })()
      && avulsa(chaveDe(1, { serie: '899' })) && !avulsa(chaveDe(1, { serie: '889' })) && !avulsa(chaveDe(1, { serie: '900' })) && !avulsa(null));
  chk('a avulsa de vendedor pessoa física (o CPF no XML) não vai', !!naNota(n => { n.chave = chaveDe(1, { aamm: '2609', cnpj: FISCO, serie: '891' }); n.doc.emit_doc = '529.982.247-25'; }, 'notas[0].doc.emit_doc', /pessoa física/));
  chk('a nota de crédito e a de débito da Reforma (finalidade 5 e 6) vão; a 7 fica de fora',
    !!(() => { const r = validarPacoteSedif(PAC(p => { p.notas[0].doc.finalidade = 6; p.notas[1].doc.finalidade = 5; }), HOJE);
      return r.ok && r.recusadas.length === 0 && r.pacote.notas[0].doc.finalidade === 6 ? r : null; })()
      && !!naNota(n => { n.doc.finalidade = 7; }, 'notas[0].doc.finalidade', /fora dos valores/));
  chk('a nota do RS também vai (a conferência sabe por ela quem teve nota no mês)',
    !!(() => { const r = validarPacoteSedif(PAC(p => { p.notas[0].chave = chaveDe(1, { uf: '43', aamm: '2609' }); p.notas[0].doc.emit_uf = 'RS'; }), HOJE); return r.ok && r.recusadas.length === 0 ? r : null; })());
  chk('a entrada antes do mês da emissão fica de fora', !!naNota(n => { n.entrada = '2026-08-31'; }, 'notas[0].entrada', /antes do mês da emissão/));
  chk('a entrada depois de hoje fica de fora', !!naNota(n => { n.entrada = '2026-11-27'; }, 'notas[0].entrada', /janela/));
  chk('a nota sem itens fica de fora', !!naNota(n => { n.itens = []; }, 'notas[0].itens', /sem os itens/));
  chk('o item repetido na nota fica de fora (com a nota)', !!naNota(n => { n.itens[1].n_item = 1; }, 'notas[0].itens[1].n_item', /repetido/));
  chk('o NCM com letra fica de fora', !!naNota(n => { n.itens[0].ncm = '8516A100'; }, 'notas[0].itens[0].ncm', /só dígitos/));
  chk('o número que vem como texto fica de fora', !!naNota(n => { n.itens[0].valor_total = '1000'; }, 'notas[0].itens[0].valor_total', /número/));
  chk('o texto que vem como número fica de fora', !!naNota(n => { n.itens[0].descricao = 12; }, 'notas[0].itens[0].descricao', /texto/));
  chk('a situação fora das três fica de fora', !!naNota(n => { n.doc.status = 'rejeitada'; }, 'notas[0].doc.status', /autorizada/));
  chk('a UF que não existe fica de fora', !!naNota(n => { n.doc.emit_uf = 'XX'; }, 'notas[0].doc.emit_uf', /UF/));
  chk('o destinatário sem documento fica de fora', !!naNota(n => { n.doc.dest_doc = null; }, 'notas[0].doc.dest_doc', /destinatário/));
  chk('a nota repetida no pacote: a segunda fica de fora', !!(() => {
    const r = validarPacoteSedif(PAC(p => { p.notas.push(NOTA(1)); }), HOJE);
    return r.ok && r.pacote.notas.length === 2 && r.recusadas.length === 1 && /repetida/.test(r.recusadas[0].erro) ? r : null;
  })());
  const doPacote = (mudar, campo) => { const r = validarPacoteSedif(PAC(mudar), HOJE); return !r.ok && r.campo === campo ? r : null; };
  chk('o que é do pacote recusa o pacote inteiro (a versão, o tipo, a rodada, a empresa, a lista, notas demais)',
    !!doPacote(p => { p.versao = 2; }, 'versao') && !!doPacote(p => { p.tipo = 'notas'; }, 'tipo') && !!doPacote(p => { p.rodada.id = 'abc'; }, 'rodada.id')
      && !!doPacote(p => { p.empresa.codigo = '901'; }, 'empresa.codigo') && !!doPacote(p => { p.notas = {}; }, 'notas')
      && !!doPacote(p => { p.notas = Array.from({ length: LIMITES_SEDIF.notas + 1 }, (_, i) => NOTA(i + 10)); }, 'notas'));
  {
    const g = notasDaEmpresa(vs.pacote, '22.333.444/0001-00');
    chk('as notas de entrada da empresa: o destinatário é o documento do cadastro (com a pontuação, ou sem)', g.notas.length === 2 && g.recusadas.length === 0, g);
    const g2 = notasDaEmpresa(validarPacoteSedif(PAC(p => { p.notas[0].doc.dest_doc = '11222333000181'; p.notas[1].doc.dest_doc = FORN; }), HOJE).pacote, EMPRESA);
    chk('a nota de outro destinatário, ou emitida pela própria empresa, volta em recusadas',
      g2.notas.length === 0 && g2.recusadas.length === 2 && g2.recusadas.every(x => x.erro === NAO_E_DA_EMPRESA && x.codigo === 901), g2);
    const g3 = notasDaEmpresa(vs.pacote, null);
    chk('sem o documento no cadastro, nada vai', g3.notas.length === 0 && g3.recusadas.length === 2, g3);
    chk('o documento como o sistema guarda (o normalizarDocumento)', docNorm('22.333.444/0001-00') === EMPRESA && docNorm('ab.12c.d34/ef56-01') === 'AB12CD34EF5601' && docNorm('529.982.247-25') === '52998224725');
  }

  // a porta de entrada, com um banco de mentira
  const AGORA_S = () => Date.parse('2026-11-26T07:30:00-03:00');
  function dbSedif({ rpcErro = null, semCadastro = false } = {}) {
    const t = {
      configuracoes_escritorio: [{ chave: 'ponte_chave_sha256', valor: h }],
      obrigacoes_fiscais: [{ id: 'o1', nome: 'SEDIF/DESTDA - SIMPLES NACIONAL' }],
      cliente_obrigacoes: [{ cliente_id: 'a', obrigacao_id: 'o1', ativo: true }, { cliente_id: 'b', obrigacao_id: 'o1', ativo: false }],
      dominio_empresas: [{ codigo: 901, cliente_id: 'a' }, { codigo: 902, cliente_id: 'b' }],
      clientes: semCadastro ? [] : [{ id: 'a', documento: '22.333.444/0001-00' }, { id: 'b', documento: '99888777000100' }]
    };
    const chamadas = [];
    return {
      chamadas,
      from(tabela) {
        const filtros = [];
        const linhas = () => (t[tabela] || []).filter(l => filtros.every(([op, c, x]) => (op === 'eq' ? l[c] === x : op === 'in' ? x.includes(l[c])
          : new RegExp(x.replace(/%/g, '.*'), 'i').test(String(l[c] || '')))));
        const api = {
          select() { return api; },
          eq(c, x) { filtros.push(['eq', c, x]); return api; },
          in(c, x) { filtros.push(['in', c, x]); return api; },
          ilike(c, x) { filtros.push(['ilike', c, x]); return api; },
          async maybeSingle() { return { data: linhas()[0] || null, error: null }; },
          then(ok, erro) { return Promise.resolve({ data: linhas(), error: null }).then(ok, erro); }
        };
        return api;
      },
      async rpc(nome, args) {
        chamadas.push({ nome, args });
        if (rpcErro) return { data: null, error: rpcErro };
        const n = args.p.notas.length;
        return { data: { recebidas: n, novas: 1, ja_na_base: n - 1, itens: 2, itens_completados: 3, datas: n - 1, importacao_id: 'l1' }, error: null };
      }
    };
  }
  const pedirS = async (db, corpo) => {
    const atender = criarServidor({ criarDb: () => db, agora: AGORA_S });
    const r2 = await atender(new Request('http://local/ponte', { method: 'POST', headers: { 'x-chave': 'segredo' }, body: JSON.stringify(corpo) }));
    return { status: r2.status, corpo: await r2.json() };
  };
  let dbs = dbSedif();
  let rs = await pedirS(dbs, PAC(p => { p.notas.push(NOTA(3, n => { n.doc.dest_doc = '11222333000181'; }), NOTA(4, n => { n.chave = 'x'; })); }));
  chk('o pacote: grava as notas da empresa da lista, pelo cliente, como a importação; a de outro destinatário e a fora do contrato voltam em recusadas',
    rs.status === 200 && rs.corpo.ok && rs.corpo.gravado && rs.corpo.notas === 2 && dbs.chamadas.length === 1 && dbs.chamadas[0].nome === 'nf_gravar_notas_entrada'
      && dbs.chamadas[0].args.p.cliente_id === 'a' && dbs.chamadas[0].args.p.notas.length === 2
      && JSON.stringify(Object.keys(dbs.chamadas[0].args.p.notas[0])) === JSON.stringify(['chave', 'entrada', 'doc', 'itens'])
      && rs.corpo.recebidas === 2 && rs.corpo.novas === 1 && rs.corpo.ja_na_base === 1 && rs.corpo.itens_completados === 3 && rs.corpo.datas === 1
      && !('importacao_id' in rs.corpo) && rs.corpo.total_recusadas === 2
      && rs.corpo.recusadas.some(x => x.erro === NAO_E_DA_EMPRESA) && rs.corpo.recusadas.some(x => x.campo === 'notas[3].chave'), rs);
  rs = await pedirS(dbSedif(), PAC(p => { p.empresa.codigo = 902; }));
  chk('a empresa fora da lista da SEDIF/DeSTDA (o vínculo desligado): 422, nada gravado', rs.status === 422 && rs.corpo.erro === SEM_SEDIF, rs);
  dbs = dbSedif({ semCadastro: true });
  rs = await pedirS(dbs, PAC());
  chk('sem o documento no cadastro: nada vai pro banco, e as notas voltam em recusadas', rs.status === 200 && dbs.chamadas.length === 0 && rs.corpo.notas === 0 && rs.corpo.total_recusadas === 2, rs);
  rs = await pedirS(dbSedif({ rpcErro: { message: 'caiu' } }), PAC());
  chk('o banco falhou: 500 (a ponte manda de novo na próxima rodada)', rs.status === 500, rs);
  rs = await pedirS(dbSedif(), PAC(p => { p.rodada.id = 'x'; }));
  chk('o pacote fora do contrato: 422 com o campo', rs.status === 422 && /rodada\.id/.test(rs.corpo.erro), rs);
}

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
