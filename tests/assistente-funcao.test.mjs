// Assistente do escritório — a função (supabase/functions/assistente): a lista branca (o que é lido e o que nunca é),
// a montagem das consultas, as ferramentas (buscar e ver empresa, consultar com contagem/soma/agrupamento, agenda com a
// regra das rotinas, a pergunta repassada à Reforma) e o servidor (login, limite contado antes, o id da pergunta vindo
// da tela, o fluxo de eventos, a pergunta que segue quando a tela fecha, o login de quem pergunta nas consultas, a
// avaliação sem login) e a trava do commit fixado. Sem rede: banco, Auth, Reforma e modelo são dublês.
// Rodar com: node tests/assistente-funcao.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABELAS, OPS, DEFINICOES, filtroUrl, montarConsulta, criarFerramentas, descreverEtapa, normalizarBusca } from '../supabase/functions/assistente/ferramentas.js';
import { montarSistema, preambulo, dicionario, INSTRUCOES, marcaOutroDia } from '../supabase/functions/assistente/prompt.js';
import { criarServidor, limparContexto, limparPagina, limparHistorico, diaBR, LIMITE_DIA } from '../supabase/functions/assistente/servidor.js';
import { responder, erroDoChat } from '../supabase/functions/reforma-chat/agente.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const erroDe = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const erroAsync = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };

console.log('A lista branca:');
const SENSIVEIS = { clientes: ['credenciais', 'rg', 'data_nascimento'], socios: ['cpf', 'rg', 'endereco_residencial', 'data_nascimento'],
  admissoes: ['respostas', 'token', 'envio_chave', 'envio_expira', 'contato_whatsapp'], rescisoes: ['respostas'] };
chk('o que nunca é lido: credenciais, documentos pessoais e as respostas dos formulários', Object.entries(SENSIVEIS).every(([t, cs]) => cs.every(c => !TABELAS[t].cols.includes(c))));
chk('tabelas fora: configurações, chats, tokens e o backup pessoal', ['configuracoes_escritorio', 'rt_chat', 'assistente_chat', 'ca_tokens', 'financeiro_backup', 'ca_sync_log'].every(t => !TABELAS[t]));
chk('as colunas que vêm sem pedir estão entre as lidas', Object.values(TABELAS).every(T => T.padrao.every(c => T.cols.includes(c))));
chk('o financeiro do escritório marcado como só dos sócios', TABELAS.ca_parcelas.socios === true && TABELAS.ca_categorias.socios === true);
chk('o dicionário do prompt lista as tabelas e não tem credenciais', Object.keys(TABELAS).every(t => dicionario().includes('## ' + t + ' ')) && !/credenciais/.test(dicionario()));
chk('as definições: as cinco de ler e as cinco propostas, consultar só com as tabelas da lista', DEFINICOES.map(d => d.name).join() === 'buscar_empresa,ver_empresa,agenda,consultar,perguntar_reforma,propor_concluir_tarefas,propor_marcar_pago,propor_criar_tarefa,propor_revisao_atrasadas,propor_ver_vigia'
  && JSON.stringify(DEFINICOES.find(d => d.name === 'consultar').input_schema.properties.tabela.enum) === JSON.stringify(Object.keys(TABELAS)));
chk('o prompt: a Reforma sozinha na rodada (a resposta dela vai direto, com as fontes); a tela pelo nome e a situação por extenso',
  /Chame sozinha na rodada/.test(INSTRUCOES) && /mantenha as fontes dele entre colchetes/.test(INSTRUCOES) && /não financeiro-boletos\.html/.test(INSTRUCOES) && /não em_transicao/.test(INSTRUCOES)
  && /a última linha dele \("Base da resposta: …"/.test(INSTRUCOES) && /não a escreva por conta própria/.test(INSTRUCOES));
chk('o prompt: a pergunta antiga de outro dia vem com a data, e o "amanhã" dela não é erro',
  /a pergunta antiga de outro dia vem com a data e a hora em que foi feita/.test(INSTRUCOES) && /não é erro e não precisa de desculpa/.test(INSTRUCOES));

console.log('Montagem das consultas:');
chk('coluna fora da lista: erro com as colunas que existem', /não é lida em clientes/.test(erroDe(() => filtroUrl('clientes', { coluna: 'credenciais', op: '=', valor: 'x' }))));
chk('tabela fora da lista: erro', /não é lida/.test(erroDe(() => montarConsulta({ tabela: 'configuracoes_escritorio' }))));
chk('pedir coluna sensível em "colunas": erro', /não são lidas em socios: cpf/.test(erroDe(() => montarConsulta({ tabela: 'socios', colunas: ['nome', 'cpf'] }))));
chk('"=" em nome de pessoa não diferencia maiúscula nem acento (Vit_ria pega Vitoria e VITÓRIA)', filtroUrl('tarefas', { coluna: 'responsavel', op: '=', valor: 'Vitória' }) === 'responsavel=ilike.Vit_ria');
chk('"!=" também pega o vazio (no banco, "diferente" deixaria de fora quem não tem valor)', decodeURIComponent(filtroUrl('tarefas', { coluna: 'status', op: '!=', valor: 'concluida' })) === 'and=(or(status.neq."concluida",status.is.null))'
  && decodeURIComponent(filtroUrl('tarefas', { coluna: 'responsavel', op: '!=', valor: 'Samuel' })) === 'and=(or(responsavel.not.ilike."Samuel",responsavel.is.null))');
chk('data sozinha em coluna de data e hora: o dia inteiro em Brasília', decodeURIComponent(filtroUrl('tarefas', { coluna: 'concluida_em', op: '=', valor: '2026-10-14' })) === 'concluida_em=gte.2026-10-14T00:00:00-03:00&concluida_em=lt.2026-10-15T00:00:00-03:00'
  && decodeURIComponent(filtroUrl('tarefas', { coluna: 'concluida_em', op: '<=', valor: '2026-10-31' })) === 'concluida_em=lt.2026-11-01T00:00:00-03:00');
chk('"em" com mais de 200 valores: erro, sem cortar calado', /lista longa demais/.test(erroDe(() => filtroUrl('clientes', { coluna: 'id', op: 'em', valor: Array.from({ length: 201 }, (_, i) => 'x' + i) }))));
chk('mais de 12 filtros: erro, sem descartar calado', /filtros demais/.test(erroDe(() => montarConsulta({ tabela: 'tarefas', filtros: Array.from({ length: 13 }, () => ({ coluna: 'status', op: '=', valor: 'pendente' })) }))));
chk('"carteira": os clientes da carteira hoje, só em carteira_info', montarConsulta({ tabela: 'carteira_info', carteira: true }, { hoje: '2026-10-14' }).filtros.join('&') === 'entrada=not.is.null&or=' + encodeURIComponent('(saida.is.null,saida.gt.2026-10-14)')
  && /só vale em carteira_info/.test(erroDe(() => montarConsulta({ tabela: 'clientes', carteira: true }, { hoje: '2026-10-14' }))));
chk('"empresa.<coluna>": o dado do cadastro, só das colunas lidas e em tabela com empresa', JSON.stringify(montarConsulta({ tabela: 'carteira_info', colunas: ['entrada', 'empresa.regime_tributario'] }).extras) === '["regime_tributario"]'
  && /não é lida no cadastro/.test(erroDe(() => montarConsulta({ tabela: 'carteira_info', colunas: ['empresa.credenciais'] }))) && /não tem empresa/.test(erroDe(() => montarConsulta({ tabela: 'convencoes', colunas: ['empresa.cidade'] }))));
chk('"=" no resto é igual exato', filtroUrl('tarefas', { coluna: 'status', op: '=', valor: 'pendente' }) === 'status=eq.pendente');
chk('"contem" e "comeca_com" sem curingas do usuário', filtroUrl('tarefas', { coluna: 'titulo', op: 'contem', valor: 'DCTF*%' }) === 'titulo=ilike.' + encodeURIComponent('*DCTF*')
  && filtroUrl('tarefas', { coluna: 'titulo', op: 'comeca_com', valor: 'Envio' }) === 'titulo=ilike.' + encodeURIComponent('Envio*'));
chk('"em": lista com aspas (vírgula no texto não quebra)', filtroUrl('tarefas', { coluna: 'status', op: 'em', valor: ['pendente', 'a,b'] }) === 'status=in.' + encodeURIComponent('("pendente","a,b")'));
chk('"vazio" e "preenchido"', filtroUrl('carteira_info', { coluna: 'saida', op: 'vazio' }) === 'saida=is.null' && filtroUrl('carteira_info', { coluna: 'saida', op: 'preenchido' }) === 'saida=not.is.null');
chk('coluna de tipo enumerado não aceita "contem"', /só aceita =, != ou "em"/.test(erroDe(() => filtroUrl('clientes', { coluna: 'status', op: 'contem', valor: 'at' }))));
chk('filtro sem valor: erro claro', /precisa de um valor/.test(erroDe(() => filtroUrl('tarefas', { coluna: 'prazo', op: '<' }))));
chk('booleano vira true/false', filtroUrl('cobrancas_config', { coluna: 'ativo', op: '=', valor: false }) === 'ativo=eq.false');
chk('as operações documentadas são as aceitas', OPS.every(op => { try { filtroUrl('tarefas', { coluna: 'prazo', op, valor: op === 'em' ? ['2026-10-14'] : '2026-10-14' }); return true; } catch (e) { return false; } }));

// ---------- as ferramentas, com um banco de mentira ----------
const ID_A = '11111111-1111-4111-8111-111111111111', ID_B = '22222222-2222-4222-8222-222222222222', CASO = '33333333-3333-4333-8333-333333333333';
const CLIENTES = [
  { id: ID_A, nome_principal: 'LOJA DA ESQUINA LTDA', nome_fantasia: 'ESQUINA', documento: '10000000000191', tipo_pessoa: 'PJ', regime_tributario: 'Simples Nacional', status: 'ativo', cidade: 'Três Coroas', uf: 'RS', porte_empresa: 'ME', cnae_principal: '4712-1/00' },
  { id: ID_B, nome_principal: 'ESQUINA DO PÃO LTDA', nome_fantasia: null, documento: '20000000000191', tipo_pessoa: 'PJ', regime_tributario: 'MEI', status: 'inativo', cidade: 'Igrejinha', uf: 'RS' }];
function bancoFalso({ tarefas = [], rotinas = [], extras = {} } = {}) {
  const log = [];
  const tabelas = { clientes: CLIENTES, carteira_info: [{ cliente_id: ID_A, entrada: '2025-01-10', saida: null, inadimplente_desde: '2026-09-01', segmento: 'COMÉRCIO' }],
    tarefas, rotinas, socios: [{ cliente_id: ID_A, nome: 'FULANO', participacao_percentual: 100, qualificacao: 'Sócio-Administrador', eh_administrador: true }],
    cobrancas_mensais: [{ competencia: '2026-10', valor: 450, vencimento: '2026-10-10', status: 'enviado', cliente_id: ID_A }, { competencia: '2026-10', valor: 300.5, vencimento: '2026-10-10', status: 'pago', cliente_id: ID_B }],
    rt_casos: [{ id: CASO, cliente_id: ID_A, triagem: 'simular', decisao: 'pendente', status: 'simulado', sim_custo_dentro: 1000, sim_custo_fora: 1200 }], ...extras };
  const banco = { async ler(caminho, op = {}) {
    log.push({ caminho, contar: !!op.contar });
    const [t, qs] = caminho.split('?');
    const q = new URLSearchParams(qs || '');
    let linhas = (tabelas[t] || []).slice();
    // os filtros que os testes usam (id, cliente_id, status, prazo, responsavel)
    for (const [k, v] of q.entries()) {
      if (['select', 'order', 'limit', 'offset', 'and', 'or'].includes(k)) continue;
      const [op2, ...resto] = v.split('.'); const val = resto.join('.');
      if (op2 === 'eq') linhas = linhas.filter(l => String(l[k]) === val);
      if (op2 === 'neq') linhas = linhas.filter(l => String(l[k]) !== val);
      if (op2 === 'in') { const ids = val.replace(/[()"]/g, '').split(','); linhas = linhas.filter(l => ids.includes(String(l[k]))); }
      if (op2 === 'lt') linhas = linhas.filter(l => String(l[k]) < val);
      if (op2 === 'lte') linhas = linhas.filter(l => String(l[k]) <= val);
      if (op2 === 'gte') linhas = linhas.filter(l => String(l[k]) >= val);
      if (op2 === 'ilike' && k !== 'nome_busca') {
        // como no banco: * é qualquer trecho e _ qualquer letra; sem maiúscula (e, aqui, sem acento)
        const rx = new RegExp('^' + normalizarBusca(val).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/_/g, '.') + '$');
        linhas = linhas.filter(l => rx.test(normalizarBusca(l[k])));
      }
    }
    if (q.get('or')) { const nomes = [...q.get('or').matchAll(/responsavel\.ilike\.([^,)]+)/g)].map(m => normalizarBusca(m[1])); linhas = linhas.filter(l => nomes.includes(normalizarBusca(l.responsavel))); }
    const offset = +(q.get('offset') || 0), limit = +(q.get('limit') || 1e9);
    return { linhas: linhas.slice(offset, offset + limit), total: op.contar ? linhas.length : null };
  } };
  return { banco, log };
}
{
  const { banco, log } = bancoFalso();
  const fs = criarFerramentas({ banco, hoje: '2026-10-14', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia', socio: false } });
  const r = await fs.consultar({ tabela: 'cobrancas_mensais', filtros: [{ coluna: 'competencia', op: '=', valor: '2026-10' }] });
  chk('consultar: o total e as linhas, com o nome da empresa ao lado do cliente_id', /2 linha\(s\)/.test(r) && /cliente_id: 1111.*empresa: LOJA DA ESQUINA LTDA/.test(r) && /empresa: ESQUINA DO PÃO LTDA/.test(r), r);
  const s = await fs.consultar({ tabela: 'cobrancas_mensais', filtros: [{ coluna: 'competencia', op: '=', valor: '2026-10' }], agrupar: 'status', somar: ['valor'] });
  chk('agrupar e somar: todas as linhas, por valor, com o total', /2 linha\(s\) com esses filtros · total: valor = 750.5/.test(s) && /- enviado: 1 · valor 450/.test(s) && /- pago: 1 · valor 300.5/.test(s), s);
  const g = await fs.consultar({ tabela: 'cobrancas_mensais', agrupar: 'cliente_id' });
  chk('agrupar por empresa: o nome no rótulo', /LOJA DA ESQUINA LTDA \(1111/.test(g), g);
  chk('financeiro do escritório pra quem não é sócio: sem acesso, sem consultar o banco', /só os sócios veem/.test(await fs.consultar({ tabela: 'ca_parcelas' })) && !log.some(x => x.caminho.startsWith('ca_parcelas')));
  chk('nenhuma consulta pede credenciais', !log.some(x => /credenciais/.test(x.caminho)));
}
{
  const { banco, log } = bancoFalso();
  const fs = criarFerramentas({ banco, hoje: '2026-10-14', usuario: { nome: 'Samuel', socio: true } });
  const b = await fs.buscar_empresa({ termo: 'Lója da Esquina Ltda' });
  const filtro = log.find(x => x.caminho.startsWith('clientes?') && x.caminho.includes('and='));
  chk('buscar_empresa: sem acento e sem as palavras de razão social, cada palavra no nome_busca', filtro && /and=/.test(filtro.caminho) && decodeURIComponent(filtro.caminho).includes('nome_busca.ilike.*loja*,nome_busca.ilike.*esquina*'), filtro && filtro.caminho);
  chk('buscar_empresa: a exata primeiro, com documento, regime e a carteira', b.indexOf('LOJA DA ESQUINA LTDA') < b.indexOf('ESQUINA DO PÃO') && /10\.000\.000\/0001-91/.test(b) && /na carteira desde 10\/01\/2025, inadimplente desde 01\/09\/2026/.test(b), b);
  const v = await fs.ver_empresa({ empresa: ID_A });
  chk('ver_empresa: cadastro, carteira, sócios, boletos e a Reforma num lugar só', /EMPRESA: LOJA DA ESQUINA LTDA/.test(v) && /INADIMPLENTE desde 01\/09\/2026/.test(v) && /Sócios: FULANO 100% \(Sócio-Administrador\), administrador/.test(v)
    && /2026-10: R\$\s?450,00, vence 10\/10\/2026, enviado/.test(v) && /caso simulado, decisão gravada: pendente, triagem simular, já simulado — o resultado da simulação e o porquê: perguntar_reforma/.test(v)
    && !/1\.000|1\.200/.test(v), v);
  chk('ver_empresa lê os sócios sem CPF/RG', log.filter(x => x.caminho.startsWith('socios?')).every(x => !/cpf|rg|endereco|nascimento/.test(x.caminho)));
  const amb = await fs.ver_empresa({ empresa: 'esquin' });
  chk('ver_empresa com nome de várias: pede pra escolher, com os ids', /Mais de uma empresa com "esquin"/.test(amb) && amb.includes(ID_B), amb);
  const ctx = criarFerramentas({ banco, hoje: '2026-10-14', contexto: { caso_id: CASO } });
  chk('ver_empresa sem nome usa a empresa da ficha da Reforma aberta', /EMPRESA: LOJA DA ESQUINA LTDA/.test(await ctx.ver_empresa({})));
  chk('ver_empresa sem nome e sem nada aberto: pede o nome', /Nenhuma empresa aberta/.test(await fs.ver_empresa({})));
}
{
  // consultar: agrupar por pessoa junta as grafias; empresa.<coluna> no agrupar e nas colunas; a saída cabe e diz de onde seguir
  const tarefas = [{ id: 'a1', responsavel: 'SAMUEL', status: 'pendente', cliente_id: ID_A }, { id: 'a2', responsavel: 'Samuel', status: 'pendente', cliente_id: ID_B },
    { id: 'a3', responsavel: 'Ambos', status: 'pendente', cliente_id: ID_A }, { id: 'a4', responsavel: 'Vitoria', status: 'pendente', cliente_id: ID_A },
    { id: 'a5', responsavel: 'VITÓRIA', status: 'pendente', cliente_id: ID_A }, { id: 'a6', responsavel: null, status: 'pendente', cliente_id: null }];
  const { banco } = bancoFalso({ tarefas });
  const fs = criarFerramentas({ banco, hoje: '2026-10-14', usuario: { nome: 'Samuel', socio: true } });
  const g = await fs.consultar({ tabela: 'tarefas', agrupar: 'responsavel' });
  chk('agrupar por responsável junta "SAMUEL" e "Samuel", "Vitoria" e "VITÓRIA"; "Ambos" é dos dois', /- Samuel: 2/.test(g) && /- Vitória: 2/.test(g) && /- Ambos \(Samuel e Diego\): 1/.test(g) && /- \(sem responsável\): 1/.test(g), g);
  const ge = await fs.consultar({ tabela: 'carteira_info', agrupar: 'empresa.regime_tributario' });
  chk('agrupar pelo cadastro da empresa (empresa.regime_tributario)', /Por empresa\.regime_tributario/.test(ge) && /- Simples Nacional: 1/.test(ge), ge);
  const ce = await fs.consultar({ tabela: 'tarefas', colunas: ['responsavel', 'empresa.cidade'] });
  chk('colunas do cadastro na linha (empresa.cidade)', /empresa: LOJA DA ESQUINA LTDA · empresa\.cidade: Três Coroas/.test(ce), ce);
  const muitas = Array.from({ length: 150 }, (_, i) => ({ id: 'm' + String(i).padStart(3, '0'), titulo: 'Tarefa ' + i + ' ' + 'x'.repeat(120), status: 'pendente', setor: 'fiscal', responsavel: 'Thalia' }));
  const fsm = criarFerramentas({ banco: bancoFalso({ tarefas: muitas }).banco, hoje: '2026-10-14', usuario: {} });
  const lm = await fsm.consultar({ tabela: 'tarefas', colunas: ['id', 'titulo'], limite: 200 });
  const prim = lm.split('\n')[0], seg = /a_partir_de (\d+)/.exec(prim);
  chk('saída grande: entram as linhas que cabem, e a primeira linha diz de onde seguir', lm.length < 13500 && seg && +seg[1] === lm.split('\n').length - 1 && /150 linha\(s\)/.test(prim), prim);
  const lm2 = await fsm.consultar({ tabela: 'tarefas', colunas: ['id', 'titulo'], limite: 200, a_partir_de: +seg[1] });
  chk('e a seguinte começa onde a anterior parou', lm2.includes('id: m' + String(+seg[1]).padStart(3, '0')) && lm2.split('\n')[0].includes('mostrando ' + (+seg[1] + 1) + '–'), lm2.split('\n')[0]);
}
{
  // 14/10/2026 é quarta; 17 e 18, fim de semana
  const tarefas = [
    { id: 't1', cliente_id: ID_A, setor: 'fiscal', titulo: 'DCTF', responsavel: 'SAMUEL', prazo: '2026-10-14', status: 'pendente', prioridade: 'baixa' },
    { id: 't2', cliente_id: null, setor: 'geral', titulo: 'Ligar pro banco', responsavel: 'Ambos', prazo: '2026-10-14', hora: '09:30:00', status: 'pendente', prioridade: 'alta' },
    { id: 't3', cliente_id: ID_B, setor: 'dp', titulo: 'Folha', responsavel: 'Vitória', prazo: '2026-10-14', status: 'pendente', prioridade: 'media' },
    { id: 't4', cliente_id: ID_A, setor: 'financeiro', titulo: 'Cobrar honorário', responsavel: 'Samuel', prazo: '2026-10-09', status: 'pendente', prioridade: 'alta' },
    { id: 't5', cliente_id: ID_A, setor: 'fiscal', titulo: 'Feita', responsavel: 'Samuel', prazo: '2026-10-14', status: 'concluida', prioridade: 'alta' }];
  const rotinas = [{ id: 'r1', setor: 'gestao', titulo: 'Conferir e-mails', responsavel: 'Samuel', periodicidade: 'diaria', ultima_execucao: '2026-10-14', ativo: true },
    { id: 'r2', setor: 'gestao', titulo: 'Backup', responsavel: 'SAMUEL', periodicidade: 'semanal', dia_semana: 5, ultima_execucao: null, ativo: true },
    { id: 'r3', setor: 'dp', titulo: 'Rotina da Vitória', responsavel: 'Vitória', periodicidade: 'diaria', ativo: true }];
  const { banco, log } = bancoFalso({ tarefas, rotinas });
  const fs = criarFerramentas({ banco, hoje: '2026-10-14', usuario: { nome: 'Samuel', socio: true } });
  const a = await fs.agenda({});
  const ordem = ['Ligar pro banco', 'DCTF'].map(t => a.indexOf(t));
  chk('agenda de quem pergunta: as dele e as de "Ambos", não as dos outros nem as concluídas', /Ligar pro banco/.test(a) && /DCTF/.test(a) && !/Folha/.test(a) && !/Feita/.test(a), a);
  chk('agenda: prioridade alta antes; hora e empresa na linha', ordem[0] < ordem[1] && /09:30 · Ligar pro banco/.test(a) && /DCTF · LOJA DA ESQUINA LTDA/.test(a), a);
  chk('agenda: as atrasadas com o prazo', /Atrasadas \(prazo antes de 14\/10\/2026\): 1/.test(a) && /prazo 09\/10\/2026 · Cobrar honorário/.test(a), a);
  chk('agenda: rotinas do dia dele (feita / a fazer), não as da Vitória', /rotina: Conferir e-mails · gestao · feita/.test(a) && !/Rotina da Vitória/.test(a) && !/Backup/.test(a), a);
  chk('agenda: o filtro de pessoa vai pro banco ("Ambos" junto pros sócios)', log.some(x => x.caminho.startsWith('tarefas?') && decodeURIComponent(x.caminho).includes('or=(responsavel.ilike.Samuel,responsavel.ilike.ambos)')));
  const sem = await fs.agenda({ de: '2026-10-14', ate: '2026-10-18', pessoa: 'Samuel', atrasadas: false });
  chk('agenda da semana: a rotina semanal na sexta; sábado e domingo sem rotina', /sexta, 16\/10\/2026: 0 tarefa\(s\), 2 rotina\(s\)/.test(sem) && /rotina: Backup · gestao · a fazer/.test(sem) && !/sábado/.test(sem) && !/Atrasadas/.test(sem), sem);
  chk('agenda de todos: com o responsável em cada linha', /Folha · ESQUINA DO PÃO LTDA · dp · Vitória/.test(await fs.agenda({ pessoa: 'todos' })));
  chk('agenda: período de mais de 31 dias não vai', /até 31 dias/.test(await fs.agenda({ de: '2026-10-01', ate: '2026-12-01' })));
  const fut = await fs.agenda({ de: '2026-10-19', ate: '2026-10-23' });
  chk('agenda de um período futuro: atrasada é o que venceu antes de hoje', /Atrasadas \(prazo antes de 14\/10\/2026\)/.test(fut) && log.some(x => x.caminho.includes('prazo=lt.2026-10-14')), fut.split('\n').slice(0, 2).join(' | '));
  const vi = await fs.agenda({ pessoa: 'vitoria' });
  chk('agenda: o nome sem acento vira o da equipe (Vitória), com o filtro que pega as duas grafias', /^Agenda de Vitória/.test(vi) && log.some(x => x.caminho.includes('responsavel=ilike.Vit_ria')), vi.split('\n')[0]);
  chk('agenda de nome fora da equipe: diz', /nome fora da equipe atual/.test(await fs.agenda({ pessoa: 'Luana' })));
}
{
  // muitas atrasadas: o resumo conta todas (lidas em páginas de mil), a lista mostra as primeiras
  const muitas = Array.from({ length: 1200 }, (_, i) => ({ id: 'x' + String(i).padStart(4, '0'), cliente_id: i % 3 ? ID_A : ID_B, setor: i % 2 ? 'fiscal' : 'dp',
    titulo: i === 1100 ? 'Urgente' : i % 4 ? 'EFD CONTRIBUIÇÕES' : 'Gia', responsavel: 'Thalia', prazo: i < 200 ? '2026-08-10' : '2026-10-01', status: i === 5 ? 'em_andamento' : 'pendente',
    prioridade: i === 1100 ? 'alta' : 'media' }));
  const { banco, log } = bancoFalso({ tarefas: muitas });
  const a = await criarFerramentas({ banco, hoje: '2026-10-14', usuario: { nome: 'Thalia' } }).agenda({});
  chk('agenda com muitas atrasadas: o total e o resumo de todas (mês, tarefa, empresa, setor), lidas em páginas de mil', /Atrasadas \(prazo antes de 14\/10\/2026\): 1200/.test(a) && /resumo de todas/.test(a)
    && /por mês do prazo: 08\/2026 200 · 10\/2026 1000/.test(a) && /por tarefa: EFD CONTRIBUIÇÕES 900 · Gia 299 · Urgente 1/.test(a) && /por empresa: LOJA DA ESQUINA LTDA 800 · ESQUINA DO PÃO LTDA 400/.test(a)
    && /por setor: dp 600 · fiscal 600/.test(a) && log.filter(x => x.caminho.includes('prazo=lt.2026-10-14')).length === 2, a.split('\n').slice(0, 8).join(' | '));
  const lista = (a.split('as 25 primeiras')[1] || '').split('\n');
  chk('a lista: as 25 primeiras, a de prioridade alta na frente, e quantas faltam', /prazo 01\/10\/2026 · Urgente/.test(lista[1]) && /… mais 1175 atrasadas/.test(a), lista[1]);
  chk('a situação por extenso, no resumo e na linha (em andamento, média)', /por situação: pendente 1199 · em andamento 1/.test(a) && /em andamento · prioridade média/.test(a) && !/em_andamento/.test(a));
}
{
  // ver_empresa: as contas de todas as tarefas abertas e a situação por extenso
  const tarefas = [
    { id: 'v1', cliente_id: ID_A, setor: 'fiscal', titulo: 'DCTF', responsavel: 'THALIA', prazo: '2026-10-01', status: 'pendente', prioridade: 'media' },
    { id: 'v2', cliente_id: ID_A, setor: 'fiscal', titulo: 'GIA', responsavel: 'Thalia', prazo: '2026-10-16', status: 'em_andamento', prioridade: 'alta' },
    { id: 'v3', cliente_id: ID_A, setor: 'dp', titulo: 'Folha', responsavel: 'Vitória', prazo: '2026-11-05', status: 'pendente' },
    { id: 'v4', cliente_id: ID_A, setor: 'societario', titulo: 'Alvará', responsavel: null, prazo: null, status: 'aguardando' },
    { id: 'v5', cliente_id: ID_A, setor: 'fiscal', titulo: 'Feita', responsavel: 'Thalia', prazo: '2026-10-01', status: 'concluida' }];
  const clientes = CLIENTES.map(c => (c.id === ID_A ? { ...c, status: 'em_transicao' } : c));
  const v = await criarFerramentas({ banco: bancoFalso({ tarefas, extras: { clientes } }).banco, hoje: '2026-10-14', usuario: {} }).ver_empresa({ empresa: ID_A });
  chk('ver_empresa: as contas de todas as tarefas abertas (atrasadas, da semana, depois, sem prazo, por setor e pessoa)',
    /Tarefas abertas: 4 — atrasadas 1 · vencem de hoje a 21\/10\/2026: 1 · depois: 1 · sem prazo: 1 · por setor: fiscal \(Thalia\) 2 · dp \(Vitória\) 1 · societario \(sem responsável\) 1/.test(v), v);
  chk('ver_empresa: a situação por extenso (em transição, em andamento)', /situação no cadastro: em transição/.test(v) && /em andamento · alta/.test(v) && !/em_transicao|em_andamento/.test(v), v);
}
{
  const perguntas = [];
  const fs = criarFerramentas({ banco: bancoFalso().banco, hoje: '2026-10-14', perguntarReforma: async p => { perguntas.push(p); return { texto: 'Sim, por fora [regra X].', cortada: false }; } });
  const r = await fs.perguntar_reforma({ pergunta: 'A LOJA pode optar por fora?' });
  chk('perguntar_reforma: a resposta dela vai direto (final), com a pergunta completa', r && r.final === true && r.texto === 'Sim, por fora [regra X].' && perguntas[0] === 'A LOJA pode optar por fora?');
  chk('perguntar_reforma: o texto pra quando não encerra (pedida junto com outra) pede pra manter as fontes e a linha "Base da resposta"', /mantenha as fontes dele entre colchetes/.test(r.comoTexto)
    && /Mantenha também a última linha dele \("Base da resposta: …"\) como veio/.test(r.comoTexto) && r.comoTexto.endsWith('\nSim, por fora [regra X].'), r.comoTexto);
  chk('a Reforma responde uma vez por pergunta', /já respondeu nesta pergunta/.test(await fs.perguntar_reforma({ pergunta: 'De novo?' })) && perguntas.length === 1);
  const fs2 = criarFerramentas({ banco: bancoFalso().banco, hoje: '2026-10-14', perguntarReforma: async () => ({ texto: 'Texto da Reforma.' }) });
  chk('perguntar_reforma pra cruzar com outros dados: volta como texto', /^Resposta do assistente da Reforma/.test(await fs2.perguntar_reforma({ pergunta: 'x', devolver_direto: false })));
  const fs3 = criarFerramentas({ banco: bancoFalso().banco, hoje: '2026-10-14', perguntarReforma: async () => ({ texto: 'Texto da Reforma.' }), deveFinalizar: () => true });
  const r3 = await fs3.perguntar_reforma({ pergunta: 'x', devolver_direto: false });
  chk('com o tempo acabando, a resposta da Reforma vai direto mesmo pra cruzar', r3 && r3.final === true && r3.texto === 'Texto da Reforma.');
}
console.log('As propostas (nada muda aqui: a tela mostra e a pessoa confirma):');
{
  const U = n => '7a000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const tarefas = [
    { id: U(1), cliente_id: ID_A, setor: 'fiscal', titulo: 'EFD CONTRIBUIÇÕES', responsavel: 'Thalia', prazo: '2026-09-15', status: 'pendente' },
    { id: U(2), cliente_id: ID_A, setor: 'fiscal', titulo: 'EFD CONTRIBUIÇÕES', responsavel: 'THALIA', prazo: '2026-10-14', status: 'pendente' },
    { id: U(3), cliente_id: ID_B, setor: 'fiscal', titulo: 'EFD CONTRIBUIÇÕES', responsavel: 'Thalia', prazo: '2026-09-15', status: 'concluida' },
    { id: U(4), cliente_id: ID_A, setor: 'fiscal', titulo: 'GIA', responsavel: 'Thalia', prazo: '2026-09-10', status: 'em_andamento' },
    { id: U(5), cliente_id: ID_A, setor: 'dp', titulo: 'Folha', responsavel: 'Vitória', prazo: '2026-09-05', status: 'pendente' }];
  const cobrancas_mensais = [
    { id: U(11), cliente_id: ID_A, competencia: '2026-09', valor: 450, vencimento: '2026-10-10', status: 'enviado' },
    { id: U(12), cliente_id: ID_A, competencia: '2026-09', valor: 450, vencimento: '2026-10-10', status: 'pago' },
    { id: U(13), cliente_id: ID_B, competencia: '2026-09', valor: 300, vencimento: '2026-10-10', status: 'emitido' },
    { id: U(14), cliente_id: ID_A, competencia: '2026-08', valor: 450, vencimento: '2026-09-10', status: 'enviado' }];
  const { banco, log } = bancoFalso({ tarefas, extras: { cobrancas_mensais } });
  const propostas = [];
  const nova = (usuario = { email: 'fiscal@macedoereis.com.br', nome: 'Thalia' }) => criarFerramentas({ banco, hoje: '2026-10-14', usuario, aoPropor: a => propostas.push(a) });
  const fs = nova();
  const c = await fs.propor_concluir_tarefas({ empresa: ID_A, titulo: 'efd', atrasadas: true });
  chk('concluir: só as abertas que batem (empresa, parte do título, atrasadas), com os ids; diz que nada foi concluído', propostas.length === 1 && propostas[0].tipo === 'concluir_tarefas'
    && JSON.stringify(propostas[0].ids) === JSON.stringify([U(1)]) && /a tela mostra 1 tarefa com o botão "Concluir"/.test(c) && /Nada foi concluído ainda/.test(c) && /LOJA DA ESQUINA LTDA · prazo 15\/09\/2026 · Thalia/.test(c), c);
  chk('uma proposta por pergunta', /Já há uma proposta nesta pergunta/.test(await fs.propor_marcar_pago({ empresas: [ID_A] })) && propostas.length === 1);
  const fs2 = nova();
  chk('concluir sem dizer quais: pede o critério e não propõe', /Diga quais tarefas/.test(await fs2.propor_concluir_tarefas({ atrasadas: true })) && propostas.length === 1);
  chk('concluir de alguém fora da equipe ou com ids que não são de tarefa: não propõe', /fora da equipe/.test(await fs2.propor_concluir_tarefas({ pessoa: 'Luana' }))
    && /não são de tarefas/.test(await fs2.propor_concluir_tarefas({ ids: ['x'] })) && propostas.length === 1);
  const pe = await fs2.propor_concluir_tarefas({ pessoa: 'thalia', setor: 'fiscal', prazo_ate: '2026-09-30' });
  chk('concluir pela pessoa (sem maiúscula), setor e prazo: GIA em andamento entra, a concluída não', propostas.length === 2 && JSON.stringify([...propostas[1].ids].sort()) === JSON.stringify([U(1), U(4)])
    && log.some(x => x.caminho.startsWith('tarefas?') && x.caminho.includes('responsavel=ilike.Thalia') && x.caminho.includes('prazo=lte.2026-09-30')), pe);
  const muitas = Array.from({ length: 301 }, (_, i) => ({ id: U(1000 + i), cliente_id: ID_A, setor: 'fiscal', titulo: 'PGDAS', responsavel: 'Thalia', prazo: '2026-09-20', status: 'pendente' }));
  const fsm = criarFerramentas({ banco: bancoFalso({ tarefas: muitas }).banco, hoje: '2026-10-14', usuario: { nome: 'Thalia' }, aoPropor: a => propostas.push(a) });
  chk('mais de 300: pede pra afinar e não propõe', /São 301 tarefas abertas/.test(await fsm.propor_concluir_tarefas({ titulo: 'PGDAS' })) && propostas.length === 2);
  const p = await nova().propor_marcar_pago({ empresas: ['LOJA DA ESQUINA LTDA'], competencia: '2026-09' });
  chk('marcar pago: só os em aberto da empresa e competência', propostas.length === 3 && propostas[2].tipo === 'marcar_pago' && JSON.stringify(propostas[2].ids) === JSON.stringify([U(11)])
    && /1 boleto com o botão "Marcar como pago"/.test(p) && /2026-09 · R\$\s?450,00 · vence 10\/10\/2026 · enviado/.test(p), p);
  chk('marcar pago: competência fora do formato não propõe', /'AAAA-MM'/.test(await nova().propor_marcar_pago({ empresas: [ID_A], competencia: '09/2026' })) && propostas.length === 3);
  const t = await nova().propor_criar_tarefa({ titulo: '  Ligar   pra   empresa ', responsavel: 'vitoria', prazo: '2026-10-15', setor: 'DP', prioridade: 'alta', empresa: 'LOJA DA ESQUINA LTDA', descricao: 'Sobre a admissão' });
  chk('criar: os campos arrumados (título, responsável da equipe, setor, empresa do cadastro)', propostas.length === 4 && JSON.stringify(propostas[3]) === JSON.stringify({ tipo: 'criar_tarefa',
    tarefa: { titulo: 'Ligar pra empresa', responsavel: 'Vitória', prazo: '2026-10-15', setor: 'dp', prioridade: 'alta', descricao: 'Sobre a admissão', empresa: { id: ID_A, nome: 'LOJA DA ESQUINA LTDA' } } })
    && /Nada foi criado ainda/.test(t), JSON.stringify(propostas[3]));
  chk('criar: responsável fora da equipe, prazo fora do formato e setor que não existe não propõem', /fora da equipe/.test(await nova().propor_criar_tarefa({ titulo: 'x', responsavel: 'Luana' }))
    && /AAAA-MM-DD/.test(await nova().propor_criar_tarefa({ titulo: 'x', prazo: '15/10' })) && /Setor:/.test(await nova().propor_criar_tarefa({ titulo: 'x', setor: 'compras' })) && propostas.length === 4);
  const r1 = await nova().propor_revisao_atrasadas({});
  chk('revisão: sem pessoa, as de quem pergunta', propostas.length === 5 && JSON.stringify(propostas[4]) === JSON.stringify({ tipo: 'revisar_atrasadas', pessoa: 'Thalia' }) && /revisão das 2 atrasadas de Thalia/.test(r1), r1);
  chk('revisão: de outra pessoa; sem atrasadas não propõe; sem saber de quem, pergunta', JSON.stringify((await nova().propor_revisao_atrasadas({ pessoa: 'vitória' }), propostas[5])) === JSON.stringify({ tipo: 'revisar_atrasadas', pessoa: 'Vitória' })
    && /não tem tarefa atrasada/.test(await nova().propor_revisao_atrasadas({ pessoa: 'Adaini' })) && /Diga de quem/.test(await nova({}).propor_revisao_atrasadas({})) && propostas.length === 6);
  chk('etapas das propostas, em português', descreverEtapa('propor_concluir_tarefas', {}) === 'Separando as tarefas pra você confirmar' && descreverEtapa('propor_revisao_atrasadas', {}) === 'Preparando a revisão das atrasadas'
    && descreverEtapa('propor_ver_vigia', {}) === 'Separando o que o vigia achou');
}
console.log('O vigia (o que o banco achou de desencontrado ou parado):');
{
  const V = n => '7b000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const vigia_achados = [
    { id: V(1), regra: 'cliente_sem_obrigacao', titulo: 'LOJA DA ESQUINA LTDA sem nenhuma obrigação fiscal cadastrada', detalhe: 'Cliente da carteira (Simples Nacional) sem obrigação ativa.', setor: 'fiscal', responsavel: 'Thalia', gravidade: 'media', so_socios: false, cliente_id: ID_A, situacao: 'aberto' },
    { id: V(2), regra: 'admissao_nao_registrada', titulo: 'Admissão de FULANA (LOJA DA ESQUINA LTDA) ainda não registrada', detalhe: 'Começou a trabalhar em 01/10/2026.', setor: 'dp', responsavel: 'Vitória', gravidade: 'alta', so_socios: false, cliente_id: ID_A, situacao: 'aberto' },
    { id: V(3), regra: 'cliente_sem_cobranca', titulo: 'LOJA DA ESQUINA LTDA está na carteira e não tem cobrança', detalhe: 'Conta Azul sem receita.', setor: 'financeiro', responsavel: 'Samuel', gravidade: 'media', so_socios: true, cliente_id: ID_A, situacao: 'aberto' },
    { id: V(4), regra: 'reforma_prazo', titulo: 'Opção do IBS/CBS por fora: faltam 15 dias', detalhe: 'Prazo 30/10/2026.', setor: 'fiscal', responsavel: 'Ambos', gravidade: 'media', so_socios: false, cliente_id: null, situacao: 'aberto' },
    { id: V(5), regra: 'tarefa_responsavel', titulo: 'Tarefa sem responsável: GIA', detalhe: 'prazo 10/10/2026', setor: 'fiscal', responsavel: 'Thalia', gravidade: 'baixa', so_socios: false, cliente_id: null, situacao: 'resolvido' }];
  const { banco, log } = bancoFalso({ extras: { vigia_achados } });
  const propostas = [];
  const nova = usuario => criarFerramentas({ banco, hoje: '2026-10-15', usuario, aoPropor: a => propostas.push(a) });
  const THALIA = { email: 'fiscal@macedoereis.com.br', nome: 'Thalia', socio: false }, SAMUEL = { email: 'financeiro@macedoereis.com.br', nome: 'Samuel', socio: true };
  const r1 = await nova(THALIA).propor_ver_vigia({});
  chk('vigia: sem pessoa, o cartão de quem pergunta (só as abertas dela), sem o que é dos sócios', JSON.stringify(propostas[0]) === JSON.stringify({ tipo: 'vigia', ver: 'meus', pessoa: 'Thalia' })
    && /1 achado aberto de Thalia/.test(r1) && log.some(x => x.caminho.startsWith('vigia_achados?') && x.caminho.includes('so_socios=eq.false') && x.caminho.includes('responsavel=ilike.Thalia')), r1);
  const r2 = await nova(SAMUEL).propor_ver_vigia({});
  const filtroSocio = log.filter(x => x.caminho.startsWith('vigia_achados?')).pop().caminho;
  chk('vigia: o sócio leva o "Ambos", o da Edna e o sem dono, e vê o do Conta Azul', JSON.stringify(propostas[1]) === JSON.stringify({ tipo: 'vigia', ver: 'meus', pessoa: 'Samuel' })
    && decodeURIComponent(filtroSocio).includes('responsavel.ilike.ambos,responsavel.ilike.edna,responsavel.is.null') && !filtroSocio.includes('so_socios') && /2 achados abertos de Samuel/.test(r2), r2);
  const r3 = await nova(THALIA).propor_ver_vigia({ pessoa: 'todos', setor: 'fiscal' });
  chk('vigia: de todos num setor', JSON.stringify(propostas[2]) === JSON.stringify({ tipo: 'vigia', ver: 'todos', setor: 'fiscal' }) && /2 achados abertos no setor fiscal/.test(r3), r3);
  chk('vigia: pessoa fora da equipe, setor que não existe e nada aberto não propõem', /fora da equipe/.test(await nova(THALIA).propor_ver_vigia({ pessoa: 'Luana' }))
    && /Setor:/.test(await nova(THALIA).propor_ver_vigia({ setor: 'compras' })) && /nada a mostrar/.test(await nova(THALIA).propor_ver_vigia({ pessoa: 'Adaini' })) && propostas.length === 3);
  const c = await nova(THALIA).consultar({ tabela: 'vigia_achados', filtros: [{ coluna: 'situacao', op: '=', valor: 'aberto' }] });
  chk('consultar o vigia: quem não é sócio não lê o que usa o Conta Azul (filtro fixo, mesmo sem login)', /3 linha\(s\)/.test(c) && !/não tem cobrança/.test(c), c);
  const v = await nova(SAMUEL).ver_empresa({ empresa: ID_A });
  chk('ver_empresa: o que o vigia achou dela, aberto, com o urgente marcado', /O vigia \(a conferir\): .*Admissão de FULANA .*\(URGENTE\)/.test(v) && /não tem cobrança/.test(v) && !/GIA/.test(v), v.split('\n').pop());
}
chk('etapas da tela: o que ele está fazendo, em português', descreverEtapa('consultar', { tabela: 'cobrancas_mensais' }) === 'Consultando os boletos' && descreverEtapa('agenda', { pessoa: 'Thalia' }) === 'Olhando a agenda de Thalia'
  && descreverEtapa('buscar_empresa', { termo: 'Loja' }) === 'Procurando "Loja" no cadastro' && descreverEtapa('perguntar_reforma', {}) === 'Perguntando à base da Reforma');

console.log('O laço do modelo com resposta pronta:');
{
  let chamadas = 0;
  const chamar = async () => { chamadas++; return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'u1', name: 'perguntar_reforma', input: { pergunta: 'p' } }], usage: { input_tokens: 5, output_tokens: 3 }, _modelo: 'm' }; };
  const etapas = [];
  const res = await responder({ chamar, sistema: [], definicoes: [], ferramentas: { perguntar_reforma: async () => ({ final: true, texto: 'Resposta da Reforma.', cortada: true }) },
    mensagem: 'oi', aoEtapa: e => etapas.push(e), descrever: n => 'etapa de ' + n });
  chk('a ferramenta com { final } encerra sem outra rodada; descrição própria da etapa', chamadas === 1 && res.final === true && res.texto === 'Resposta da Reforma.' && res.cortada === true && etapas[0] === 'etapa de perguntar_reforma');
  let n2 = 0, visto = null;
  const chamar2 = async c => { n2++; if (n2 === 1) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'a', name: 'perguntar_reforma', input: {} }, { type: 'tool_use', id: 'b', name: 'agenda', input: {} }], usage: {} };
    visto = c.messages.at(-1).content.map(x => x.content).join('|'); return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Juntei as duas.' }], usage: {} }; };
  const res2 = await responder({ chamar: chamar2, sistema: [], definicoes: [], ferramentas: { perguntar_reforma: async () => ({ final: true, texto: 'Parte da Reforma.' }), agenda: async () => 'Parte da agenda.' }, mensagem: 'oi' });
  chk('pedida junto com outra ferramenta, a resposta pronta volta como texto e o modelo junta tudo', n2 === 2 && !res2.final && res2.texto === 'Juntei as duas.' && visto === 'Parte da Reforma.|Parte da agenda.', visto);
  let n3 = 0, visto3 = null;
  const chamar3 = async c => { n3++; if (n3 === 1) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'a', name: 'perguntar_reforma', input: {} }, { type: 'tool_use', id: 'b', name: 'agenda', input: {} }], usage: {} };
    visto3 = c.messages.at(-1).content[0].content; return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: {} }; };
  await responder({ chamar: chamar3, sistema: [], definicoes: [], mensagem: 'oi',
    ferramentas: { perguntar_reforma: async () => ({ final: true, texto: 'R [regra X].', comoTexto: 'Mantenha as fontes:\nR [regra X].' }), agenda: async () => 'A.' } });
  chk('com o comoTexto, é ele que o modelo lê (o recado de manter as fontes)', visto3 === 'Mantenha as fontes:\nR [regra X].', visto3);
}

console.log('O servidor:');
const ENV = { SUPABASE_URL: 'https://banco.teste', SUPABASE_SERVICE_ROLE_KEY: 'servico', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'k' };
const AGORA = new Date('2026-10-14T15:00:00Z');
const PEDIDO = '44444444-4444-4444-8444-444444444444';
function servidorFalso({ contagem = 0, rodando = 0, reformaSse = null, avaliacao = null } = {}) {
  const log = [], linhas = [];
  const json = (x, h = {}, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const f = async (url, o = {}) => {
    const u = String(url), metodo = o.method || 'GET';
    log.push({ url: u, metodo, corpo: o.body ? JSON.parse(o.body) : null, headers: o.headers || {} });
    if (u.includes('/auth/v1/user')) {
      const t = (o.headers.Authorization || '').slice(7);
      return t === 'jwt-samuel' ? json({ email: 'Financeiro@macedoereis.com.br' }) : t === 'jwt-thalia' ? json({ email: 'fiscal@macedoereis.com.br' }) : t === 'jwt-fora' ? json({ email: 'x@gmail.com' }) : new Response('{}', { status: 401 });
    }
    if (u.includes('/rest/v1/assistente_chat') && metodo === 'POST') {
      const l = { ...JSON.parse(o.body), criado_em: '2026-10-14T15:00:00.1+00:00' };
      if (!l.id) l.id = '55555555-5555-4555-8555-555555555555';
      if (linhas.some(x => x.id === l.id)) return new Response('{"code":"23505"}', { status: 409 });
      linhas.push(l);
      return json([{ id: l.id, criado_em: l.criado_em }], {}, 201);
    }
    if (u.includes('/rest/v1/assistente_chat') && metodo === 'GET') {
      const n = u.includes('situacao=eq.rodando') ? rodando : contagem;
      return json([], { 'Content-Range': (n ? '0-0/' : '*/') + n });
    }
    if (u.includes('/rest/v1/assistente_chat') && metodo === 'PATCH' && JSON.parse(o.body).situacao === 'rodando') return json(avaliacao ? [avaliacao] : []);
    if (u.includes('/rest/v1/assistente_chat') && metodo === 'PATCH') {
      const id = new URL(u).searchParams.get('id').slice(3);
      const l = linhas.find(x => x.id === id) || (avaliacao && avaliacao.id === id ? avaliacao : null);
      if (l) Object.assign(l, JSON.parse(o.body));
      return new Response(null, { status: 204 });
    }
    if (u.includes('/rest/v1/rt_chat') && metodo === 'POST') return json([{ id: '66666666-6666-4666-8666-666666666666' }], {}, 201);
    if (u.includes('/functions/v1/reforma-chat')) {
      const corpo = JSON.parse(o.body);
      if (corpo.avaliacao) return json({ resposta: 'Resposta da Reforma (avaliação).' });
      const bytes = new TextEncoder().encode(reformaSse || ('data: ' + JSON.stringify({ tipo: 'etapa', texto: 'Lendo M07-RED60' }) + '\n\n' + 'data: ' + JSON.stringify({ tipo: 'resposta', texto: 'Por fora [regra X] — ação.', cortada: false }) + '\n\n'));
      return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 9) c.enqueue(bytes.slice(i, i + 9)); c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    if (u.includes('/rest/v1/clientes')) return json(CLIENTES.filter(c => u.includes(c.id) || !u.includes('id=eq.')));
    if (u.includes('/rest/v1/rt_casos')) return json([{ id: CASO, cliente_id: ID_A }]);
    if (u.includes('/rest/v1/cobrancas_mensais')) return json([{ competencia: '2026-10', valor: 450, status: 'enviado', cliente_id: ID_A }], { 'Content-Range': '0-0/1' });
    if (u.includes('/rest/v1/ca_parcelas')) return json([{ descricao: 'Honorários', total: 100 }], { 'Content-Range': '0-0/1' });
    if (u.includes('/rest/v1/tarefas')) return json([{ id: '7a000000-0000-4000-8000-000000000001' }], { 'Content-Range': '0-0/3' });
    return new Response('?', { status: 404 });
  };
  return { f, log, linhas };
}
const pedido = (corpo, jwt = 'jwt-samuel', extra = {}) => new Request('https://funcao.teste/assistente', { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), origin: 'https://site.teste', ...extra }, body: JSON.stringify(corpo) });
const final = texto => async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: texto }], usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'modelo-teste' });
const roteiro = passos => { let i = 0; return async corpo => { const p = passos[Math.min(i++, passos.length - 1)]; return typeof p === 'function' ? p(corpo) : p; }; };
const usarFerramenta = (name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'u' + name, name, input }], usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'modelo-teste' });
{
  const { f } = servidorFalso();
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: final('ok') });
  const op = await srv(new Request('https://funcao.teste/assistente', { method: 'OPTIONS', headers: { origin: 'https://site.teste' } }));
  chk('OPTIONS: CORS', op.status === 200 && op.headers.get('Access-Control-Allow-Origin') === 'https://site.teste');
  chk('sem login: 401; chave pública: 401', (await srv(pedido({ pergunta: 'oi' }, null))).status === 401 && (await srv(pedido({ pergunta: 'oi' }, 'anon'))).status === 401);
  chk('e-mail de fora do escritório: 403', (await srv(pedido({ pergunta: 'oi' }, 'jwt-fora'))).status === 403);
  chk('pergunta vazia: 400; grande demais: 413', (await srv(pedido({ pergunta: ' ' }))).status === 400 && (await srv(pedido({ pergunta: 'oi' }, 'jwt-samuel', { 'content-length': '300000' }))).status === 413);
}
{
  const { f, log, linhas } = servidorFalso();
  let corpoModelo = null;
  const chamar = roteiro([c => { corpoModelo = c; return usarFerramenta('consultar', { tabela: 'cobrancas_mensais' }); }, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Um boleto em aberto.' }], usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'modelo-teste' }]);
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar });
  const r = await srv(pedido({ pergunta: 'Quais boletos estão em aberto?', pedido: PEDIDO, conversa: PEDIDO, historico: [{ pergunta: 'a', resposta: 'b' }],
    contexto: { pagina: { caminho: 'financeiro-boletos.html', nome: 'Boletos', setor: 'financeiro' }, cliente_id: ID_A } }));
  const j = await r.json();
  chk('resposta sem fluxo (JSON)', r.status === 200 && j.resposta === 'Um boleto em aberto.', JSON.stringify(j));
  const aberta = log.find(x => x.metodo === 'POST' && x.url.includes('assistente_chat'));
  chk('a linha nasce com o id que a tela mandou, a página e a empresa aberta', aberta && aberta.corpo.id === PEDIDO && aberta.corpo.situacao === 'rodando' && aberta.corpo.pagina === 'financeiro-boletos.html' && aberta.corpo.cliente_id === ID_A);
  const msg = corpoModelo.messages[corpoModelo.messages.length - 1].content.map(b => b.text).join('');
  chk('o contexto da pergunta: o dia, quem pergunta (sócio), a tela e a empresa aberta', /Hoje: quarta-feira, 14\/10\/2026 \(semana de 12\/10\/2026 a 18\/10\/2026\)/.test(msg) && /Quem pergunta: Samuel \(financeiro@macedoereis.com.br\), sócio/.test(msg)
    && /Tela aberta: Boletos — financeiro-boletos.html \(setor financeiro\)/.test(msg) && /Empresa aberta na tela: LOJA DA ESQUINA LTDA/.test(msg) && /Quais boletos estão em aberto\?$/.test(msg), msg);
  chk('o histórico vai antes da pergunta; o sistema vai com cache de 1 hora', corpoModelo.messages[0].content === 'a' && corpoModelo.system[0].cache_control.ttl === '1h');
  const dados = log.filter(x => x.url.includes('/rest/v1/') && !x.url.includes('assistente_chat'));
  chk('os dados são lidos com o login de quem pergunta (as regras do banco valem)', dados.length > 0 && dados.every(x => x.headers.Authorization === 'Bearer jwt-samuel' && x.headers.apikey === 'anon'));
  chk('o histórico é gravado com a chave de servidor, com a resposta, os tokens e a etapa', log.filter(x => x.url.includes('assistente_chat')).every(x => x.headers.Authorization === 'Bearer servico')
    && linhas[0].situacao === 'ok' && linhas[0].resposta === 'Um boleto em aberto.' && linhas[0].tokens_saida === 10 && linhas[0].etapas[0].ferramenta === 'consultar');
}
{
  // a conversa que passou de um dia pro outro (a aba ficou aberta): a pergunta de outro dia vai com a data em que foi feita,
  // pro modelo não tomar o "amanhã" dela por erro (16/10/2026)
  const { f } = servidorFalso();
  let corpoModelo = null;
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: async c => { corpoModelo = c; return final('Hoje é 14/10/2026.')(); } });
  const r = await srv(pedido({ pergunta: 'Que dia é hoje?', historico: [
    { pergunta: 'Coloque essa tarefa para amanhã', resposta: 'Amanhã, 13/10/2026.', em: '2026-10-13T01:44:57Z' },
    { pergunta: 'E agora?', resposta: 'Nada.', em: '2026-10-14T13:10:00Z' },
    { pergunta: 'Sem hora', resposta: 'ok' }] }));
  const ms = corpoModelo ? corpoModelo.messages : [];
  chk('pergunta anterior de outro dia: vai com a data e a hora em que foi feita (Brasília); a do mesmo dia e a sem hora, como vieram',
    r.status === 200 && ms[0].content === '[Pergunta feita em segunda-feira, 12/10/2026, às 22:44] Coloque essa tarefa para amanhã' && ms[1].content === 'Amanhã, 13/10/2026.'
    && ms[2].content === 'E agora?' && ms[4].content === 'Sem hora', JSON.stringify(ms.slice(0, 5).map(m => m.content)));
}
{
  const { f } = servidorFalso({ contagem: LIMITE_DIA + 1 });
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: final('x') })(pedido({ pergunta: 'Mais uma?' }));
  chk('limite do dia: 429, com a mensagem pro usuário', r.status === 429 && /limite de 80 perguntas por dia/.test((await r.json()).erro));
  const { f: f2 } = servidorFalso({ rodando: 3 });
  chk('perguntas demais rodando: 429', (await criarServidor({ env: k => ENV[k], fetch: f2, agora: () => AGORA, chamar: final('x') })(pedido({ pergunta: 'E essa?' }))).status === 429);
  const { f: f3, linhas } = servidorFalso();
  const srv = criarServidor({ env: k => ENV[k], fetch: f3, agora: () => AGORA, chamar: final('x') });
  await srv(pedido({ pergunta: 'Uma', pedido: PEDIDO }));
  const rep = await srv(pedido({ pergunta: 'Uma', pedido: PEDIDO }));
  chk('o mesmo id de pergunta duas vezes: 409, sem rodar de novo', rep.status === 409 && linhas.length === 1);
}
{
  // fluxo: a pergunta da Reforma vai pro chat da Reforma com o login de quem pergunta; as etapas de lá aparecem aqui
  const { f, log, linhas } = servidorFalso();
  const trabalhos = [];
  const chamar = roteiro([usarFerramenta('perguntar_reforma', { pergunta: 'A LOJA DA ESQUINA pode optar por fora?' })]);
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar, aguardar: p => trabalhos.push(p) });
  const r = await srv(pedido({ pergunta: 'Ela pode optar por fora?', fluxo: true, pedido: PEDIDO,
    contexto: { pagina: { caminho: 'fiscal-reforma.html', nome: 'Reforma', setor: 'fiscal' }, caso_id: CASO, tela: { input: { anexo: 'I', receita: 1000 } } } }, 'jwt-thalia'));
  const txt = await r.text();
  const eventos = [...txt.matchAll(/data: (.*)\n\n/g)].map(m => JSON.parse(m[1]));
  chk('fluxo: a etapa nossa, a etapa da Reforma e a resposta dela, inteira', eventos.map(e => e.tipo).join() === 'etapa,etapa,resposta' && eventos[0].texto === 'Perguntando à base da Reforma'
    && eventos[1].texto === 'Lendo M07-RED60' && eventos[2].texto === 'Por fora [regra X] — ação.' && eventos[2].reforma === true, JSON.stringify(eventos));
  const ida = log.find(x => x.url.includes('/functions/v1/reforma-chat'));
  chk('o chat da Reforma recebe o login de quem pergunta, a ficha e o cálculo da tela', ida && ida.headers.Authorization === 'Bearer jwt-thalia' && ida.corpo.contexto.caso_id === CASO
    && ida.corpo.contexto.tela.input.receita === 1000 && ida.corpo.fluxo === true && ida.corpo.pergunta === 'A LOJA DA ESQUINA pode optar por fora?');
  chk('a pergunta segue no Edge Runtime (waitUntil) e a linha fecha com a resposta da Reforma', trabalhos.length === 1 && linhas[0].situacao === 'ok' && linhas[0].resposta === 'Por fora [regra X] — ação.' && linhas[0].fontes.reforma === true);
}
{
  // a proposta vai junto com a resposta (no evento e na linha do histórico); a função não grava nada nos dados
  const { f, log, linhas } = servidorFalso();
  const chamar = roteiro([usarFerramenta('propor_revisao_atrasadas', { pessoa: 'Thalia' }), { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Quer passar as 3 atrasadas a limpo?' }], usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'modelo-teste' }]);
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar, aguardar: p => p });
  const txt = await (await srv(pedido({ pergunta: 'Vamos ver as atrasadas da Thalia?', fluxo: true, pedido: PEDIDO }))).text();
  const ev = [...txt.matchAll(/data: (.*)\n\n/g)].map(m => JSON.parse(m[1])).find(e => e.tipo === 'resposta');
  chk('a proposta sai no evento da resposta e fica na linha (fontes.acao)', ev && JSON.stringify(ev.acao) === JSON.stringify({ tipo: 'revisar_atrasadas', pessoa: 'Thalia' })
    && JSON.stringify(linhas[0].fontes.acao) === JSON.stringify(ev.acao) && ev.texto === 'Quer passar as 3 atrasadas a limpo?', txt);
  chk('a função não grava nos dados: só lê (GET) fora do histórico', log.filter(x => x.url.includes('/rest/v1/') && !x.url.includes('assistente_chat')).every(x => x.metodo === 'GET'));
  const { f: f2 } = servidorFalso();
  const j = await (await criarServidor({ env: k => ENV[k], fetch: f2, agora: () => AGORA, chamar: final('Sem ação.') })(pedido({ pergunta: 'Oi' }))).json();
  chk('sem proposta, a resposta vai sem "acao"', j.resposta === 'Sem ação.' && !('acao' in j));
}
{
  // a tela fechou no meio (trocou de página): a pergunta segue e a resposta fica na linha
  const { f, linhas } = servidorFalso();
  const trabalhos = [];
  let solta;
  const chamar = async () => { await new Promise(r => { solta = r; }); return (await final('Chegou depois.')()); };
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar, aguardar: p => trabalhos.push(p) });
  const r = await srv(pedido({ pergunta: 'Demora?', fluxo: true, pedido: PEDIDO }));
  const leitor = r.body.getReader();
  await leitor.cancel();
  await new Promise(r2 => setTimeout(r2, 10));
  solta();
  await trabalhos[0];
  chk('trocou de tela no meio: a pergunta termina e a resposta fica no histórico', linhas[0].situacao === 'ok' && linhas[0].resposta === 'Chegou depois.');
}
{
  const { f, linhas } = servidorFalso();
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: async () => { throw erroDoChat('sobrecarga', 'API 529: {"request_id":"x"}'); } })(pedido({ pergunta: 'Cheio?', fluxo: true }));
  const txt = await r.text();
  chk('erro do modelo: evento de erro em português; o detalhe e o aviso ficam na linha', /"tipo":"erro","texto":"O serviço de IA está sobrecarregado agora/.test(txt) && !/request_id/.test(txt)
    && linhas[0].situacao === 'erro' && /API 529/.test(linhas[0].erro) && /sobrecarregado/.test(linhas[0].aviso));
}
{
  // avaliação sem login: a linha "pendente" do banco; dados com a chave de servidor; sem o financeiro dos sócios
  const linhaAv = { id: '77777777-7777-4777-8777-777777777777', usuario: 'avaliacao', situacao: 'rodando', pergunta: 'E o financeiro?', pagina: 'index.html', cliente_id: null, caso_id: CASO, conversa: null };
  const { f, log } = servidorFalso({ avaliacao: linhaAv });
  const chamar = roteiro([usarFerramenta('consultar', { tabela: 'ca_parcelas' }), usarFerramenta('perguntar_reforma', { pergunta: 'E a Reforma?' })]);
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar })(pedido({ avaliacao: linhaAv.id }, 'anon'));
  const j = await r.json();
  chk('avaliação: roda a linha do banco e responde', r.status === 200 && j.resposta === 'Resposta da Reforma (avaliação).' && j.reforma === true, JSON.stringify(j));
  chk('avaliação: dados com a chave de servidor, sem o financeiro dos sócios', !log.some(x => x.url.includes('ca_parcelas')) && log.filter(x => x.url.includes('/rest/v1/rt_casos')).every(x => x.headers.Authorization === 'Bearer servico'));
  chk('avaliação: a Reforma também como avaliação (linha pendente no histórico de lá)', log.some(x => x.metodo === 'POST' && x.url.includes('/rest/v1/rt_chat') && x.corpo.usuario === 'avaliacao' && x.corpo.situacao === 'pendente')
    && log.some(x => x.url.includes('/functions/v1/reforma-chat') && x.corpo.avaliacao === '66666666-6666-4666-8666-666666666666'));
  const { f: f2 } = servidorFalso({ avaliacao: null });
  chk('avaliação usada, velha ou inventada: 403', (await criarServidor({ env: k => ENV[k], fetch: f2, agora: () => AGORA, chamar: final('x') })(pedido({ avaliacao: linhaAv.id }, 'anon'))).status === 403);
}
chk('contexto: só o que a tela pode mandar', JSON.stringify(limparContexto({ pagina: { caminho: '../x.html' }, cliente_id: 'nao-uuid', caso_id: CASO, tela: { input: {} }, outro: 1 }))
  === JSON.stringify({ pagina: null, cliente_id: null, caso_id: CASO, tela: { input: {} } }));
chk('página: caminho de tela do sistema, nome sem marcação, setor da lista', JSON.stringify(limparPagina({ caminho: 'clientes/editar.html', nome: 'Ficha <b>x</b>\n', setor: 'hacker' }))
  === JSON.stringify({ caminho: 'clientes/editar.html', nome: 'Ficha b x /b', setor: null }));
chk('cálculo da tela só com a ficha da Reforma', limparContexto({ tela: { input: {} } }).tela === null);
chk('histórico: até 6, cortado', limparHistorico(Array.from({ length: 9 }, () => ({ pergunta: 'p', resposta: 'r'.repeat(7000) }))).length === 6);
chk('histórico: a hora de cada pergunta, só quando é uma data ISO', (() => {
  const h = limparHistorico([{ pergunta: 'p', resposta: 'r', em: '2026-10-14T22:44:57.123Z' }, { pergunta: 'p', resposta: 'r', em: 'ontem' }, { pergunta: 'p', resposta: 'r', em: 1760000000000 },
    { pergunta: 'p', resposta: 'r', em: '2026-13-45T99:99' }, { pergunta: 'p', resposta: 'r', em: '2026-10-14T22:44:57Z' + ' '.repeat(40) }]);
  return h.length === 5 && h[0].em === '2026-10-14T22:44:57.123Z' && h.slice(1).every(x => !('em' in x)); })());
chk('marca de outro dia: de um dia anterior, com o dia da semana, a data e a hora de Brasília; do mesmo dia, de um dia adiante ou sem hora, nada',
  marcaOutroDia('2026-10-15T01:44:57Z', '2026-10-16') === '[Pergunta feita em quarta-feira, 14/10/2026, às 22:44] '
  && marcaOutroDia('2026-10-16T12:00:00Z', '2026-10-16') === '' && marcaOutroDia('2026-10-17T12:00:00Z', '2026-10-16') === ''
  && marcaOutroDia('', '2026-10-16') === '' && marcaOutroDia(undefined, '2026-10-16') === '' && marcaOutroDia('x', '2026-10-16') === '', marcaOutroDia('2026-10-15T01:44:57Z', '2026-10-16'));
chk('o dia no fuso de Brasília', diaBR(new Date('2026-10-15T02:30:00Z')) === '2026-10-14');
chk('o preâmbulo sem tela nem pessoa (avaliação)', preambulo({ hoje: '2026-10-18' }) === '[Contexto do sistema] Hoje: domingo, 18/10/2026 (semana de 12/10/2026 a 18/10/2026).\n\n');

console.log('Commit fixado na função (o código cru do GitHub):');
const idx = readFileSync(raiz + 'supabase/functions/assistente/index.ts', 'utf8');
const m = /raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/supabase\/functions\/assistente\/servidor\.js/.exec(idx);
chk('index.ts importa o servidor do repositório num commit fixado, com o waitUntil', !!m && /EdgeRuntime\.waitUntil/.test(idx));
function importados(inicio) {
  const vistos = new Set(), fila = [inicio];
  while (fila.length) {
    const a = fila.shift();
    if (vistos.has(a)) continue;
    vistos.add(a);
    const fonte = readFileSync(raiz + a, 'utf8');
    for (const im of fonte.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) fila.push(posix.normalize(posix.join(posix.dirname(a), im[1])));
  }
  return [...vistos];
}
const ARQS = importados('supabase/functions/assistente/servidor.js');
chk('a trava segue os imports: o servidor, as ferramentas, o prompt, o laço da Reforma, as rotinas, a equipe e os eventos', ['supabase/functions/assistente/ferramentas.js', 'supabase/functions/assistente/prompt.js',
  'supabase/functions/reforma-chat/agente.js', 'assets/js/rotinas-dia.js', 'assets/js/equipe.js', 'assets/js/eventos-sse.js'].every(a => ARQS.includes(a)), ARQS.join(', '));
if (m) {
  const atrasados = ARQS.filter(a => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
  });
  chk('o código que a função roda é o daqui', atrasados.length === 0,
    'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função assistente');
}
const codigo = a => readFileSync(raiz + a, 'utf8').replace(/^\s*\/\/.*$/gm, '');
chk('as consultas da função não pedem credenciais nem o backup pessoal', ['supabase/functions/assistente/ferramentas.js', 'supabase/functions/assistente/servidor.js'].every(a => !/credenciais|financeiro_backup/.test(codigo(a))));

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
