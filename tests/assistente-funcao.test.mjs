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
import { criarDrive, filtrarArquivos, palavrasDe, pastaDaUrl } from '../supabase/functions/assistente/drive.js';

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
chk('o financeiro do escritório marcado como só dos sócios', ['ca_parcelas', 'ca_categorias', 'ca_baixas', 'vw_ca_realizado'].every(t => TABELAS[t] && TABELAS[t].socios === true));
chk('o pago num mês sai do realizado: o pago da parcela é o acumulado, no mês do último pagamento (29/10/2026)',
  /use vw_ca_realizado/.test(TABELAS.ca_parcelas.desc) && /ÚLTIMO pagamento/.test(TABELAS.ca_parcelas.notas.mes_pagamento)
  && /some valor com mes = o primeiro dia do mês/.test(TABELAS.vw_ca_realizado.desc) && TABELAS.vw_ca_realizado.pk === 'id,dia,origem,valor');
chk('as revisões de honorário só dos sócios, sem as respostas do questionário e o cálculo do motor', TABELAS.revisoes_honorario.socios === true
  && !['respostas', 'resultado'].some(c => TABELAS.revisoes_honorario.cols.includes(c)));
chk('as notícias do feed: sem os critérios, o trecho e o custo da triagem; setores e clientes como listas', TABELAS.noticias && !['criterios', 'trecho', 'tokens_entrada', 'erro', 'modelo'].some(c => TABELAS.noticias.cols.includes(c))
  && JSON.stringify(TABELAS.noticias.arrays) === '["setores","clientes"]' && TABELAS.noticias.empresas === 'clientes' && !TABELAS.noticias_fontes.cols.includes('filtro'));
chk('o prompt: as notícias (triadas, a principal do grupo, a leitura da IA a conferir) e as revisões só dos sócios',
  /as que valem são as triadas \(situacao = triada\)/.test(INSTRUCOES) && /consultar noticias com clientes contem o id dela/.test(INSTRUCOES) && /são a leitura da IA do feed/.test(INSTRUCOES)
  && /as revisões de honorário são só dos sócios/.test(INSTRUCOES));
chk('o dicionário do prompt lista as tabelas e não tem credenciais', Object.keys(TABELAS).every(t => dicionario().includes('## ' + t + ' ')) && !/credenciais/.test(dicionario()));
chk('as definições: as seis de ler e as onze propostas, consultar só com as tabelas da lista', DEFINICOES.map(d => d.name).join() === 'buscar_empresa,ver_empresa,agenda,consultar,perguntar_reforma,buscar_arquivos,propor_concluir_tarefas,propor_alterar_tarefas,propor_registrar_historico,propor_marcar_pago,propor_criar_tarefa,propor_enviar_mensagem,propor_revisao_atrasadas,propor_ver_vigia,propor_incluir_reforma,propor_por_na_competencia,propor_ajustar_obrigacoes'
  && JSON.stringify(DEFINICOES.find(d => d.name === 'consultar').input_schema.properties.tabela.enum) === JSON.stringify(Object.keys(TABELAS)));
chk('o prompt: a Reforma sozinha na rodada (a resposta dela vai direto, com as fontes); a tela pelo nome e a situação por extenso',
  /Chame sozinha na rodada/.test(INSTRUCOES) && /mantenha as fontes dele entre colchetes/.test(INSTRUCOES) && /não financeiro-boletos\.html/.test(INSTRUCOES) && /não em_transicao/.test(INSTRUCOES)
  && /a última linha dele \("Base da resposta: …"/.test(INSTRUCOES) && /não a escreva por conta própria/.test(INSTRUCOES));
chk('o prompt: remarcar, passar e mudar a prioridade com propor_alterar_tarefas; a tarefa da ficha de origem não muda por aqui; prazo não é mais "outra tela"',
  /remarcar, adiar ou antecipar tarefas, passar pra outra pessoa ou mudar a prioridade: propor_alterar_tarefas/.test(INSTRUCOES) && /O prazo e o responsável da tarefa de admissão, rescisão ou alvará não mudam por aqui/.test(INSTRUCOES)
  && !/ficha da empresa, prazos,/.test(INSTRUCOES) && /adiar rotina é na Agenda/.test(INSTRUCOES));
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
chk('coluna de lista: "=" e "contem" = a lista tem o valor; "em" = tem algum; != e vazio', decodeURIComponent(filtroUrl('noticias', { coluna: 'setores', op: 'contem', valor: 'dp' })) === 'setores=cs.{"dp"}'
  && decodeURIComponent(filtroUrl('noticias', { coluna: 'setores', op: '=', valor: 'fiscal' })) === 'setores=cs.{"fiscal"}'
  && decodeURIComponent(filtroUrl('noticias', { coluna: 'setores', op: 'em', valor: ['dp', 'fiscal'] })) === 'setores=ov.{"dp","fiscal"}'
  && decodeURIComponent(filtroUrl('noticias', { coluna: 'setores', op: '!=', valor: 'dp' })) === 'setores=not.cs.{"dp"}'
  && decodeURIComponent(filtroUrl('noticias', { coluna: 'clientes', op: 'vazio' })) === 'clientes=eq.{}'
  && /só aceita =, contem, !=, em, vazio e preenchido/.test(erroDe(() => filtroUrl('noticias', { coluna: 'setores', op: 'comeca_com', valor: 'd' }))));
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
      if (op2 === 'is' && val === 'null') linhas = linhas.filter(l => l[k] == null);
      if (op2 === 'cs') { const xs = val.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(x => x.replace(/^"|"$/g, '')); linhas = linhas.filter(l => Array.isArray(l[k]) && xs.every(x => l[k].map(String).includes(x))); }
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
console.log('As notícias do feed e a revisão do honorário (20/10/2026):');
{
  const FONTE = '44444444-4444-4444-8444-444444444444', N1 = '55555555-5555-4555-8555-555555555555', N2 = '66666666-6666-4666-8666-666666666666', N3 = '77777777-7777-4777-8777-777777777777';
  const noticias = [
    { id: N1, titulo: 'eSocial muda o leiaute (teste)', url: 'https://noticia.exemplo/1', fonte_id: FONTE, publicada_em: '2026-10-20T02:30:00Z', coletada_em: '2026-10-20T03:00:00Z', situacao: 'triada', relevancia: 'alta',
      setores: ['dp'], resumo: 'Resumo 1', acao: 'Conferir os eventos', clientes: [ID_A, ID_B], grupo: null },
    { id: N2, titulo: 'A mesma, de outra fonte (teste)', url: 'https://noticia.exemplo/2', fonte_id: FONTE, publicada_em: '2026-10-20T04:00:00Z', coletada_em: '2026-10-20T04:00:00Z', situacao: 'triada', relevancia: 'media',
      setores: ['dp'], resumo: 'Resumo 2', acao: null, clientes: [ID_A], grupo: N1 },
    { id: N3, titulo: 'Prazo do PGDAS (teste)', url: 'https://noticia.exemplo/3', fonte_id: FONTE, publicada_em: '2026-10-19T12:00:00Z', coletada_em: '2026-10-19T12:00:00Z', situacao: 'triada', relevancia: 'media',
      setores: ['fiscal'], resumo: 'Resumo 3', acao: null, clientes: [ID_B], grupo: null }];
  const revisoes = [{ cliente_id: ID_A, status: 'aceito', honorario_atual: 450, fonte_atual: 'boletos', honorario_sugerido: 640, honorario_novo: 600, vigencia: '2026-11',
    criado_em: '2026-10-19T12:00:00Z', atualizado_em: '2026-10-20T13:00:00Z', aplicado_em: null }];
  const { banco, log } = bancoFalso({ extras: { noticias, noticias_fontes: [{ id: FONTE, nome: 'Receita Federal (teste)' }], revisoes_honorario: revisoes } });
  const thalia = criarFerramentas({ banco, hoje: '2026-10-20', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia', socio: false } });
  const r = await thalia.consultar({ tabela: 'noticias', filtros: [{ coluna: 'situacao', op: '=', valor: 'triada' }, { coluna: 'grupo', op: 'vazio' }, { coluna: 'setores', op: 'contem', valor: 'dp' }] });
  chk('consultar as notícias: a principal do setor, com a fonte pelo nome e as empresas que ela alcança pelo nome (sem os ids)', /1 linha\(s\)/.test(r) && /fonte: Receita Federal \(teste\)/.test(r)
    && /clientes: 2 — LOJA DA ESQUINA LTDA, ESQUINA DO PÃO LTDA/.test(r) && !r.includes(ID_A) && !r.includes(FONTE) && !/A mesma, de outra fonte/.test(r), r);
  const v = await thalia.ver_empresa({ empresa: ID_A });
  chk('ver_empresa: as notícias que a alcançam (só a principal, com a data em Brasília, a importância, o setor, quantas empresas e o que fazer)', /Notícias do feed que a alcançam \(30 dias: 1; .*\): 19\/10\/2026 · Importante · DP · eSocial muda o leiaute \(teste\) \(alcança 2 empresas\) — o que fazer: Conferir os eventos/.test(v)
    && !/A mesma, de outra fonte/.test(v) && !/PGDAS/.test(v), v);
  chk('ver_empresa pra quem não é sócio: sem a revisão do honorário (nem consulta)', !/Revisão do honorário/.test(v) && !log.some(x => x.caminho.startsWith('revisoes_honorario')));
  chk('consultar as revisões pra quem não é sócio: sem acesso, sem consultar o banco', /só os sócios veem/.test(await thalia.consultar({ tabela: 'revisoes_honorario' })) && !log.some(x => x.caminho.startsWith('revisoes_honorario')));
  {
    const outras = [3, 40, 2].map((n, i) => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-00000000000' + i, titulo: 'Vale saber com ' + n + ' empresas (teste)', fonte_id: FONTE, publicada_em: '2026-10-1' + (5 + i) + 'T12:00:00Z',
      coletada_em: '2026-10-1' + (5 + i) + 'T12:00:00Z', situacao: 'triada', relevancia: 'media', setores: ['fiscal'], clientes: [ID_A, ...Array.from({ length: n - 1 }, (_, k) => 'bbbbbbbb-bbbb-4bbb-8bbb-' + String(k).padStart(12, '0'))], grupo: null }));
    const vo = await criarFerramentas({ banco: bancoFalso({ extras: { noticias: [...outras, noticias[0]] } }).banco, hoje: '2026-10-20', usuario: {} }).ver_empresa({ empresa: ID_A });
    const ordem = [...vo.matchAll(/(eSocial muda o leiaute|Vale saber com \d+ empresas)/g)].map(m => m[1]);
    chk('ver_empresa: a importante primeiro; nas que vale saber, a de menos empresas (a específica) antes da geral', JSON.stringify(ordem) === '["eSocial muda o leiaute","Vale saber com 2 empresas","Vale saber com 3 empresas","Vale saber com 40 empresas"]', JSON.stringify(ordem));
  }
  const samuel = criarFerramentas({ banco, hoje: '2026-10-20', usuario: { email: 'financeiro@macedoereis.com.br', nome: 'Samuel', socio: true } });
  const vs = await samuel.ver_empresa({ empresa: ID_A });
  chk('ver_empresa pro sócio: a revisão do honorário (o de hoje, o motor, o combinado, o mês e se já entrou no boleto)',
    /Revisão do honorário \(Precificação › Carteira\): aceito em 20\/10\/2026 · hoje R\$\s?450,00 · motor R\$\s?640,00 · combinado R\$\s?600,00 a partir de 11\/2026 · ainda não entrou no boleto/.test(vs), vs);
  const sem = await samuel.ver_empresa({ empresa: ID_B });
  chk('ver_empresa: cada empresa com as dela, a importante antes; a que alcança só ela, "só ela"; sem notícia nos 30 dias, diz "nenhuma"', /Notícias do feed que a alcançam \(30 dias: 2; .*\): 19\/10\/2026 · Importante · DP · eSocial .* \| 19\/10\/2026 · Vale saber · Fiscal · Prazo do PGDAS \(teste\) \(alcança só ela\)/.test(sem)
    && /Notícias do feed que a alcançam \(30 dias\): nenhuma\./.test(await criarFerramentas({ banco: bancoFalso({ extras: { noticias: [] } }).banco, hoje: '2026-10-20', usuario: {} }).ver_empresa({ empresa: ID_A })), sem);
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
    && descreverEtapa('propor_ver_vigia', {}) === 'Separando o que o vigia achou' && descreverEtapa('propor_alterar_tarefas', {}) === 'Separando o que muda pra você confirmar');
}
{
  // remarcar, passar pra outra pessoa e mudar a prioridade (16/10/2026)
  const U = n => '7c000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const tarefas = [
    { id: U(1), cliente_id: ID_A, setor: 'financeiro', titulo: 'Faturar: 2 EMISSÕES DE NOTAS FISCAIS — LOJA DA ESQUINA LTDA', responsavel: 'Samuel', prazo: '2026-10-13', status: 'pendente', prioridade: 'media' },
    { id: U(2), cliente_id: ID_A, setor: 'dp', titulo: 'Admissão de FULANA', responsavel: 'Vitória', prazo: '2026-10-10', status: 'pendente', prioridade: 'alta', admissao_id: 'a1' },
    { id: U(3), cliente_id: ID_A, setor: 'fiscal', titulo: 'EFD', responsavel: 'Thalia', prazo: '2026-10-10', status: 'pendente', prioridade: 'media', origem: 'recorrente', obrigacao_id: 'ob1' },
    { id: U(4), cliente_id: ID_A, setor: 'fiscal', titulo: 'EFD', responsavel: 'Thalia', prazo: '2026-10-14', status: 'pendente', prioridade: 'media', origem: 'recorrente' },
    { id: U(5), cliente_id: ID_B, setor: 'fiscal', titulo: 'EFD', responsavel: 'Thalia', prazo: '2026-10-09', status: 'concluida', prioridade: 'media' }];
  const propostas = [];
  const nova = () => criarFerramentas({ banco: bancoFalso({ tarefas }).banco, hoje: '2026-10-14', usuario: { email: 'financeiro@macedoereis.com.br', nome: 'Samuel', socio: true }, aoPropor: a => propostas.push(a) });
  const r1 = await nova().propor_alterar_tarefas({ titulo: 'Faturar: 2 EMISSÕES', pessoa: 'Samuel', atrasadas: true, novo_prazo: '2026-10-14' });
  chk('remarcar: a atrasada que bate, com o prazo novo; diz o antes e o depois e que nada mudou ainda', propostas.length === 1 && JSON.stringify(propostas[0]) === JSON.stringify({ tipo: 'alterar_tarefas', ids: [U(1)], mudar: { prazo: '2026-10-14' } })
    && /prazo 13\/10\/2026 → 14\/10\/2026/.test(r1) && /Nada mudou ainda/.test(r1) && /LOJA DA ESQUINA LTDA/.test(r1), r1);
  const r2 = await nova().propor_alterar_tarefas({ empresa: ID_A, novo_responsavel: 'vitoria', nova_prioridade: 'urgente' });
  chk('passar e deixar urgente: a da admissão fica de fora (vem da ficha), com a tela onde mudar', propostas.length === 2 && JSON.stringify([...propostas[1].ids].sort()) === JSON.stringify([U(1), U(3), U(4)].sort())
    && JSON.stringify(propostas[1].mudar) === JSON.stringify({ responsavel: 'Vitória', prioridade: 'alta' }) && /1 tarefa de admissão fica de fora/.test(r2) && /tela Admissões/.test(r2)
    && /Thalia → Vitória/.test(r2) && /prioridade média → alta/.test(r2), r2);
  chk('responsável novo na que nasce de obrigação e de tarefa recorrente: diz onde trocar de vez', /1 vem de obrigação fiscal: a próxima nasce com o responsável da obrigação — pra ficar com Vitória de vez, troque na tela Obrigações fiscais/.test(r2)
    && /1 vem de tarefa recorrente: a próxima nasce com o responsável de lá/.test(r2) && !/obrigação fiscal/.test(r1), r2);
  const r3 = await nova().propor_alterar_tarefas({ titulo: 'Admissão', novo_prazo: '2026-10-20' });
  chk('só a da admissão: não propõe e diz onde mudar', /fica de fora/.test(r3) && /Nada foi proposto/.test(r3) && propostas.length === 2, r3);
  await nova().propor_alterar_tarefas({ titulo: 'Admissão', nova_prioridade: 'baixa' });
  chk('só a prioridade: a da admissão entra (a ficha refaz só o prazo e o responsável)', propostas.length === 3 && JSON.stringify(propostas[2].ids) === JSON.stringify([U(2)]));
  propostas.pop();
  const r4 = await nova().propor_alterar_tarefas({ pessoa: 'Thalia', titulo: 'EFD', novo_prazo: '2026-10-14' });
  chk('a que já está com o prazo novo não entra; a concluída também não', propostas.length === 3 && JSON.stringify(propostas[2].ids) === JSON.stringify([U(3)]) && /1 tarefa já está assim/.test(r4), r4);
  chk('sem dizer o que muda, data que não existe, pessoa ou prioridade fora da lista, sem dizer quais: não propõe',
    /Diga o que muda/.test(await nova().propor_alterar_tarefas({ titulo: 'EFD' })) && /AAAA-MM-DD/.test(await nova().propor_alterar_tarefas({ titulo: 'EFD', novo_prazo: '2026-02-30' }))
    && /fora da equipe/.test(await nova().propor_alterar_tarefas({ titulo: 'EFD', novo_responsavel: 'Luana' })) && /alta, media ou baixa/.test(await nova().propor_alterar_tarefas({ titulo: 'EFD', nova_prioridade: 'máxima' }))
    && /Diga quais tarefas/.test(await nova().propor_alterar_tarefas({ novo_prazo: '2026-10-20' })) && propostas.length === 3);
  chk('prazo novo num sábado: a resposta avisa', /cai num sábado/.test(await nova().propor_alterar_tarefas({ titulo: 'EFD', pessoa: 'Thalia', novo_prazo: '2026-10-17' }))
    && !/cai num/.test(r1) && propostas.length === 4, '');
  propostas.pop();
  const r5 = await nova().propor_alterar_tarefas({ titulo: 'EFD', pessoa: 'Thalia', novo_responsavel: 'ambos' });
  chk('"Ambos" vale como responsável novo (Samuel e Diego)', propostas.length === 4 && propostas[3].mudar.responsavel === 'Ambos', r5);
  const fs = nova();
  await fs.propor_alterar_tarefas({ titulo: 'EFD', pessoa: 'Thalia', nova_prioridade: 'baixa' });
  chk('uma proposta por pergunta também aqui', /Já há uma proposta nesta pergunta/.test(await fs.propor_concluir_tarefas({ titulo: 'EFD' })) && propostas.length === 5);
  const r6 = await nova().propor_alterar_tarefas({ titulo: 'Faturar: 2 EMISSÕES', novo_prazo: '2026-10-16', mensagem: '  Cliente pediu\n prazo.  ' });
  chk('remarcar com a mensagem no histórico (20/10/2026): vai na proposta, numa linha, e a resposta diz', propostas.length === 6
    && JSON.stringify(propostas[5]) === JSON.stringify({ tipo: 'alterar_tarefas', ids: [U(1)], mudar: { prazo: '2026-10-16' }, mensagem: 'Cliente pediu prazo.' }) && /Com a mensagem no histórico de cada uma .*“Cliente pediu prazo\.”/.test(r6), r6);
}
{
  // a mensagem no histórico (20/10/2026, pedido da Thalia): junto da conclusão, ou sozinha (o "Registrar andamento" da Agenda)
  const U = n => '7d000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const tarefas = [
    { id: U(1), cliente_id: ID_A, setor: 'fiscal', titulo: 'PGDAS', responsavel: 'Thalia', prazo: '2026-10-01', status: 'pendente' },
    { id: U(2), cliente_id: ID_B, setor: 'fiscal', titulo: 'PGDAS', responsavel: 'Thalia', prazo: '2026-10-01', status: 'pendente' },
    { id: U(3), cliente_id: ID_A, setor: 'fiscal', titulo: 'PGDAS', responsavel: 'Thalia', prazo: '2026-09-01', status: 'concluida' }];
  const propostas = [];
  const nova = () => criarFerramentas({ banco: bancoFalso({ tarefas }).banco, hoje: '2026-10-20', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia' }, aoPropor: a => propostas.push(a) });
  const c = await nova().propor_concluir_tarefas({ empresa: ID_A, titulo: 'PGDAS', mensagem: 'DAS enviado por WhatsApp.' });
  chk('concluir com a mensagem: vai na proposta; a resposta diz que vai no histórico (e que nada foi concluído)', propostas.length === 1
    && JSON.stringify(propostas[0]) === JSON.stringify({ tipo: 'concluir_tarefas', ids: [U(1)], mensagem: 'DAS enviado por WhatsApp.' })
    && /“DAS enviado por WhatsApp\.”/.test(c) && /com a mensagem no histórico \(não diga que já foi\)/.test(c) && /Nada foi concluído ainda/.test(c), c);
  await nova().propor_concluir_tarefas({ empresa: ID_A, titulo: 'PGDAS', mensagem: '   ' });
  chk('mensagem em branco: a proposta vai sem ela', propostas.length === 2 && !('mensagem' in propostas[1]), JSON.stringify(propostas[1]));
  const r = await nova().propor_registrar_historico({ titulo: 'pgdas', atrasadas: true, mensagem: ' Aguardando o\nfaturamento ' });
  chk('registrar: as abertas que batem, com a mensagem numa linha; diz que nenhuma tarefa muda', propostas.length === 3
    && JSON.stringify(propostas[2]) === JSON.stringify({ tipo: 'registrar_historico', ids: [U(1), U(2)], mensagem: 'Aguardando o faturamento' })
    && /botão "Registrar"/.test(r) && /nenhuma tarefa muda/.test(r) && /A mensagem: “Aguardando o faturamento”/.test(r) && /LOJA DA ESQUINA LTDA · prazo 01\/10\/2026 · Thalia/.test(r), r);
  chk('registrar sem a mensagem, sem dizer quais ou sem tarefa aberta: não propõe', /Diga a mensagem/.test(await nova().propor_registrar_historico({ titulo: 'PGDAS' }))
    && /Diga quais tarefas/.test(await nova().propor_registrar_historico({ mensagem: 'x' })) && /Nenhuma tarefa aberta/.test(await nova().propor_registrar_historico({ titulo: 'GIA', mensagem: 'x' }))
    && propostas.length === 3);
  const fs = nova();
  await fs.propor_registrar_historico({ ids: [U(2)], mensagem: 'Cliente não mandou as notas.' });
  chk('uma proposta por pergunta', /Já há uma proposta nesta pergunta/.test(await fs.propor_concluir_tarefas({ ids: [U(2)] })) && propostas.length === 4);
  chk('a etapa e o prompt: junto da conclusão ou da mudança, a mensagem; sem mudar nada, o registrar; anotar uma tarefa nova é criar',
    descreverEtapa('propor_registrar_historico') === 'Preparando a mensagem pro histórico'
    && /junto da conclusão ou da mudança, vai em mensagem, na mesma proposta; sem concluir nem mudar nada, propor_registrar_historico/.test(INSTRUCOES)
    && /só com o que ela disse — sem inventar detalhe/.test(INSTRUCOES) && /Pediram pra criar uma tarefa nova \(anotar ou lembrar de fazer algo\): propor_criar_tarefa/.test(INSTRUCOES));
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
  chk('vigia: a resposta leva os grupos do cartão (o nome de cada regra), pra falar do que não leu sem supor',
    r3.includes('(Clientes sem obrigação fiscal: 1 · Prazo da opção da Reforma: 1)') && /sem supor de que empresa ou pessoa/.test(r3), r3);
  chk('vigia: pessoa fora da equipe, setor que não existe e nada aberto não propõem', /fora da equipe/.test(await nova(THALIA).propor_ver_vigia({ pessoa: 'Luana' }))
    && /Setor:/.test(await nova(THALIA).propor_ver_vigia({ setor: 'compras' })) && /nada a mostrar/.test(await nova(THALIA).propor_ver_vigia({ pessoa: 'Adaini' })) && propostas.length === 3);
  const c = await nova(THALIA).consultar({ tabela: 'vigia_achados', filtros: [{ coluna: 'situacao', op: '=', valor: 'aberto' }] });
  chk('consultar o vigia: quem não é sócio não lê o que usa o Conta Azul (filtro fixo, mesmo sem login)', /3 linha\(s\)/.test(c) && !/não tem cobrança/.test(c), c);
  chk('consultar o vigia: e a nota de que os só dos sócios ficaram de fora (não é "nenhum"); o sócio não leva a nota', /só os sócios veem\.$/.test(c)
    && !/só os sócios veem/.test(await nova(SAMUEL).consultar({ tabela: 'vigia_achados', filtros: [{ coluna: 'situacao', op: '=', valor: 'aberto' }] }))
    && !/só os sócios veem/.test(await nova(THALIA).consultar({ tabela: 'tarefas' })), c.split('\n').pop());
  chk('o cartão do vigia pra quem não é sócio: a mesma nota', /só os sócios veem\.$/.test(r1) && /só os sócios veem\.$/.test(r3) && !/só os sócios veem/.test(r2));
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

console.log('Os arquivos da empresa (o Drive, só leitura):');
{
  chk('a pasta pelo endereço do cadastro', pastaDaUrl('https://drive.google.com/drive/folders/1AbC_def-GHIjkl?usp=sharing') === '1AbC_def-GHIjkl' && pastaDaUrl('https://exemplo.com/x') === null && pastaDaUrl(null) === null);
  chk('as palavras: sem acento, sem as miúdas (o "das" fica), o mês também pelo número', JSON.stringify(palavrasDe('Guia do DAS de Setembro')) === JSON.stringify([['guia'], ['das'], ['setembro', 'set', '09']]));
  const A = (nome, pasta, modificado) => ({ nome, pasta, modificado, link: 'https://drive.google.com/file/d/' + nome.replace(/\W/g, '') });
  const lista = [A('Contrato Social.pdf', '', '2026-03-01T10:00:00Z'), A('DAS 09-2026.pdf', 'FISCAL / 2026', '2026-10-05T10:00:00Z'), A('RG.jpg', 'DOC SÓCIO', '2026-01-10T10:00:00Z'),
    A('Alteração contratual - contrato.pdf', 'PROCESSOS', '2026-06-01T10:00:00Z'), A('Planilha.xlsx', 'CONTÁBIL / contratos', '2026-09-01T10:00:00Z')];
  const nomes = r => r.achados.map(a => a.nome).join(' | ');
  chk('a busca: sem acento e sem maiúscula; o mês por extenso acha o número', nomes(filtrarArquivos(lista, 'CONTRATO social')) === 'Contrato Social.pdf' && nomes(filtrarArquivos(lista, 'das setembro 2026')) === 'DAS 09-2026.pdf');
  chk('a busca: o caminho conta (a pasta DOC SÓCIO)', nomes(filtrarArquivos(lista, 'socio')) === 'RG.jpg');
  chk('a busca: quem tem a palavra no nome vem antes de quem só tem na pasta', nomes(filtrarArquivos(lista, 'contrato')) === 'Alteração contratual - contrato.pdf | Contrato Social.pdf | Planilha.xlsx', nomes(filtrarArquivos(lista, 'contrato')));
  chk('sem palavra: os mais recentes, até o limite', nomes(filtrarArquivos(lista, '', { limite: 2 })) === 'DAS 09-2026.pdf | Planilha.xlsx' && filtrarArquivos(lista, '').total === 5);
  // o Drive falso: a raiz com 45 subpastas (2 consultas no segundo nível), uma delas com uma sub-subpasta, arquivos e um XML
  const PASTA = 'application/vnd.google-apps.folder';
  const R = 'RAIZ_DA_EMPRESA_1', sub = i => 'SUBPASTA_' + String(i).padStart(4, '0');
  const itens = [...Array.from({ length: 45 }, (_, i) => ({ id: sub(i), name: i === 0 ? 'FISCAL' : 'PASTA ' + i, mimeType: PASTA, parents: [R] })),
    { id: 'NETA_DA_RAIZ_1', name: '2026', mimeType: PASTA, parents: [sub(0)] },
    { id: 'ARQUIVO_RAIZ_1', name: 'Contrato Social.pdf', mimeType: 'application/pdf', parents: [R], modifiedTime: '2026-03-01T10:00:00Z', size: '1200', webViewLink: 'https://drive.google.com/file/d/ARQUIVO_RAIZ_1/view' },
    { id: 'ARQUIVO_NETA_1', name: 'DAS 09-2026.pdf', mimeType: 'application/pdf', parents: ['NETA_DA_RAIZ_1'], modifiedTime: '2026-10-05T10:00:00Z', webViewLink: 'https://drive.google.com/file/d/ARQUIVO_NETA_1/view' },
    { id: 'NOTA_XML_000001', name: 'NFe123.xml', mimeType: 'text/xml', parents: ['NETA_DA_RAIZ_1'] }];
  const pedidos = [];
  const fetchFalso = async (url, op = {}) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) { pedidos.push({ token: true, corpo: String(op.body) }); return { ok: true, json: async () => ({ access_token: 'acesso-1', expires_in: 3600 }) }; }
    const q = new URL(url).searchParams.get('q');
    const pais = [...q.matchAll(/'([^']+)' in parents/g)].map(m => m[1]);
    const soPastas = q.includes("mimeType = '" + PASTA + "'");
    pedidos.push({ q, pais: pais.length, auth: op.headers && op.headers.Authorization });
    const files = itens.filter(x => x.parents.some(p => pais.includes(p)) && (soPastas ? x.mimeType === PASTA : x.mimeType !== PASTA && !q.includes("mimeType != '" + x.mimeType + "'")));
    return { ok: true, json: async () => ({ files }) };
  };
  const env = k => ({ GOOGLE_OAUTH_CLIENT_ID: 'cliente', GOOGLE_OAUTH_CLIENT_SECRET: 'segredo', GOOGLE_OAUTH_REFRESH_TOKEN: 'renovar' })[k];
  const dr = criarDrive({ fetch: fetchFalso, env });
  const arv = await dr.arvore(R);
  const listas = pedidos.filter(p => !p.token);
  chk('o Drive: a autorização uma vez só (o token do "Registrar processo"), o acesso em cada consulta', pedidos.filter(p => p.token).length === 1 && /refresh_token=renovar/.test(pedidos[0].corpo)
    && listas.every(p => p.auth === 'Bearer acesso-1'), JSON.stringify(pedidos.slice(0, 2)));
  chk('o Drive: as subpastas nível por nível, até 40 por consulta', listas.every(p => p.pais <= 40) && listas.filter(p => p.q.includes("mimeType = '")).length === 4 && arv.pastas === 47,
    listas.map(p => p.pais + (p.q.includes("mimeType = '") ? 'p' : 'a')).join(','));
  chk('o Drive: os arquivos com o caminho da pasta, sem as notas em XML', arv.arquivos.map(a => a.nome + '@' + (a.pasta || 'raiz')).sort().join() === 'Contrato Social.pdf@raiz,DAS 09-2026.pdf@FISCAL / 2026'
    && arv.arquivos.find(a => a.nome === 'Contrato Social.pdf').tamanho === 1200, JSON.stringify(arv.arquivos));
  chk('o Drive: sem os segredos, não está configurado; pasta inválida não consulta', !criarDrive({ fetch: fetchFalso, env: () => null }).configurado() && dr.configurado()
    && /inválida/.test(await erroAsync(() => dr.arvore("x' or 1=1"))));

  // a ferramenta: a pasta do cadastro, as guias arquivadas e o cartão
  const CL = [{ ...CLIENTES[0], drive_folder_url: 'https://drive.google.com/drive/folders/' + R }, CLIENTES[1]];
  const OBR = '44444444-4444-4444-8444-444444444444';
  const { banco } = bancoFalso({ extras: { clientes: CL, obrigacoes_fiscais: [{ id: OBR, nome: 'PGDAS' }], vigia_achados: [{ regra: 'tarefa_sem_responsavel', situacao: 'aberto', so_socios: false, responsavel: 'Thalia', setor: 'fiscal' }],
    guias_arquivadas: [{ cliente_id: ID_A, obrigacao_id: OBR, competencia: '09-2026', nome_arquivo: 'PGDAS 09-2026 LOJA.pdf', drive_file_url: 'https://drive.google.com/file/d/GUIA1/view', criado_em: '2026-10-08T12:00:00Z' }] } });
  let raizPedida = null;
  const driveFalso = { configurado: () => true, arvore: async r => { raizPedida = r; return { arquivos: arv.arquivos, pastas: 47, cortada: false }; } };
  const propostas = [];
  const nova = (extra = {}) => criarFerramentas({ banco, hoje: '2026-10-16', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia', socio: false }, aoPropor: a => propostas.push(a), drive: driveFalso, ...extra });
  const t1 = await nova().buscar_arquivos({ empresa: 'Esquina', termo: 'setembro' });
  const c1 = propostas[0];
  chk('buscar arquivos: a pasta que o cadastro aponta; o arquivo do Drive e a guia arquivada, com a pasta e a data', raizPedida === R && /^Arquivos de LOJA DA ESQUINA LTDA \(ESQUINA\) com "setembro": 2 achados/.test(t1)
    && /DAS 09-2026\.pdf · FISCAL \/ 2026 · 05\/10\/2026\n/.test(t1) && /PGDAS 09-2026 LOJA\.pdf · Guias arquivadas \/ PGDAS \/ 09-2026 · 08\/10\/2026\n/.test(t1) && !/https?:/.test(t1.split('\n').slice(0, 3).join(' ')), t1);
  chk('buscar arquivos: o cartão com a empresa (e a fantasia), os links e a pasta dela', c1 && c1.tipo === 'arquivos' && c1.empresa === 'LOJA DA ESQUINA LTDA' && c1.fantasia === 'ESQUINA' && c1.itens.length === 2 && c1.total === 2
    && c1.itens.every(i => /^https:\/\/drive\.google\.com\//.test(i.link)) && c1.pasta === CL[0].drive_folder_url && c1.termo === 'setembro', JSON.stringify(c1));
  const t2 = await nova().buscar_arquivos({ empresa: ID_B });
  chk('buscar arquivos: sem a pasta no cadastro e sem guia, diz onde vincular e não mostra cartão', /não tem a pasta do Drive no cadastro/.test(t2) && propostas.length === 1, t2);
  const t3 = await nova({ drive: { configurado: () => true, arvore: async () => { throw new Error('o Drive recusou a busca (403)'); } } }).buscar_arquivos({ empresa: ID_A, termo: 'pgdas' });
  chk('buscar arquivos: o Drive fora do ar não derruba — as guias vêm e o aviso diz', /Não consegui ler o Drive agora \(o Drive recusou a busca \(403\)\)/.test(t3) && /PGDAS 09-2026 LOJA\.pdf/.test(t3) && propostas.length === 2, t3);
  // procurar de novo na mesma pergunta (outras palavras): o cartão é trocado e o Drive não é lido outra vez
  let leituras = 0;
  const fs4 = nova({ drive: { configurado: () => true, arvore: async () => { leituras++; return { arquivos: arv.arquivos, pastas: 47, cortada: false }; } } });
  const antes = propostas.length;
  const r4a = await fs4.buscar_arquivos({ empresa: ID_A, termo: 'procuração' });
  const r4b = await fs4.buscar_arquivos({ empresa: ID_A, termo: 'contrato' });
  chk('buscar arquivos: nada achado, tenta outras palavras — o último cartão vale e o Drive é lido uma vez', /nada encontrado/.test(r4a) && /Contrato Social\.pdf/.test(r4b) && leituras === 1
    && propostas.length === antes + 2 && propostas[propostas.length - 1].termo === 'contrato' && propostas[propostas.length - 1].itens.length === 1, r4a + ' || ' + r4b);
  // a guia enviada duas vezes (o mesmo nome): com a hora (de Brasília), pra dizer qual é a mais recente
  const { banco: b6 } = bancoFalso({ extras: { clientes: CL, obrigacoes_fiscais: [{ id: OBR, nome: 'PGDAS' }], guias_arquivadas: [
    { cliente_id: ID_A, obrigacao_id: OBR, competencia: '06-2026', nome_arquivo: 'PGDAS 06-2026.pdf', drive_file_url: 'https://drive.google.com/file/d/G2/view', criado_em: '2026-07-13T18:30:17Z' },
    { cliente_id: ID_A, obrigacao_id: OBR, competencia: '06-2026', nome_arquivo: 'PGDAS 06-2026.pdf', drive_file_url: 'https://drive.google.com/file/d/G1/view', criado_em: '2026-07-13T17:10:41Z' }] } });
  const t6 = await criarFerramentas({ banco: b6, hoje: '2026-10-16', usuario: {}, drive: { configurado: () => true, arvore: async () => ({ arquivos: [], pastas: 1, cortada: false }) } }).buscar_arquivos({ empresa: ID_A, termo: 'pgdas junho' });
  chk('buscar arquivos: o mesmo nome duas vezes vem com a hora', /PGDAS 06-2026\.pdf · Guias arquivadas \/ PGDAS \/ 06-2026 · 13\/07\/2026, 15h30\n- PGDAS 06-2026\.pdf · Guias arquivadas \/ PGDAS \/ 06-2026 · 13\/07\/2026, 14h10/.test(t6), t6);
  // a busca certeira não é trocada pelos "mais recentes" (nem pela que não achou nada) na mesma pergunta
  const fs7 = nova();
  const n7 = propostas.length;
  await fs7.buscar_arquivos({ empresa: ID_A, termo: 'contrato' });
  const r7b = await fs7.buscar_arquivos({ empresa: ID_A });
  const r7c = await fs7.buscar_arquivos({ empresa: ID_A, termo: 'procuração' });
  chk('buscar arquivos: o cartão fica com a busca que achou o pedido; os mais recentes e a busca vazia não o trocam', propostas.length === n7 + 1 && propostas[n7].termo === 'contrato'
    && /O cartão da tela continua com a busca anterior \("contrato"\), que achou o que foi pedido/.test(r7b) && /Esta busca não achou nada: o cartão da tela continua com a anterior \("contrato"\)/.test(r7c), r7b + ' || ' + r7c);
  const fs8 = nova();
  const n8 = propostas.length;
  await fs8.buscar_arquivos({ empresa: ID_A });
  const r8 = await fs8.buscar_arquivos({ empresa: ID_A, termo: 'procuração' });
  chk('buscar arquivos: depois dos mais recentes, a busca que não achou nada também não troca', propostas.length === n8 + 1 && propostas[n8].termo === null && /continua com a anterior \(os mais recentes\)/.test(r8), r8);
  const fs5 = nova();
  await fs5.propor_ver_vigia({});
  chk('buscar arquivos: com outra proposta já feita, uma por pergunta', /Já há uma proposta nesta pergunta/.test(await fs5.buscar_arquivos({ empresa: ID_A })) && descreverEtapa('buscar_arquivos', { empresa: 'Loja' }) === 'Procurando no Drive de Loja');
  chk('o prompt: arquivo de empresa pelo buscar_arquivos, sem colar link e sem inventar', /buscar_arquivos, com as palavras do nome do arquivo/.test(INSTRUCOES) && /sem colar link e sem inventar arquivo/.test(INSTRUCOES));

  // ---------- a mensagem no chat da equipe (19/10/2026): quem recebe, o texto e o link do Drive dos arquivos buscados ----------
  console.log('A mensagem no chat da equipe:');
  const props = [];
  const thalia = (extra = {}) => criarFerramentas({ banco, hoje: '2026-10-19', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia', socio: false }, aoPropor: a => props.push(a), drive: driveFalso, ...extra });
  const m1 = await thalia().propor_enviar_mensagem({ para: ['Vitória'], texto: '  Vitória, a admissão do Fulano chegou.  ' });
  chk('pra alguém da equipe: o e-mail dela (a conversa a dois), o texto aparado e nada enviado', JSON.stringify(props[0]) === JSON.stringify({ tipo: 'enviar_mensagem', para: [{ email: 'rh@macedoereis.com.br', nome: 'Vitória' }], texto: 'Vitória, a admissão do Fulano chegou.' })
    && /Nada foi enviado ainda/.test(m1) && /não diga que já foi/.test(m1), m1);
  await thalia().propor_enviar_mensagem({ para: ['vitoria', 'Escritório', 'grupo do Fiscal e DP', 'VITÓRIA'], texto: 'Reunião às 15h.' });
  chk('o nome sem acento, o grupo de todos e outro grupo pelo nome (sem o "grupo do"), sem repetir', JSON.stringify(props[1].para) === JSON.stringify([{ email: 'rh@macedoereis.com.br', nome: 'Vitória' }, { grupo: 'escritorio', nome: 'Escritório' }, { grupo: 'Fiscal e DP', nome: 'Fiscal e DP' }]), JSON.stringify(props[1].para));
  await thalia().propor_enviar_mensagem({ para: ['os sócios'], texto: 'Fechei a DCTFWeb.' });
  chk('"os sócios": Samuel e Diego, cada um na conversa a dois', JSON.stringify(props[2].para.map(p => p.email)) === '["financeiro@macedoereis.com.br","diego@macedoereis.com.br"]');
  const samuel = criarFerramentas({ banco, hoje: '2026-10-19', usuario: { email: 'financeiro@macedoereis.com.br', nome: 'Samuel', socio: true }, aoPropor: a => props.push(a) });
  await samuel.propor_enviar_mensagem({ para: ['ambos'], texto: 'Diego, olha a proposta.' });
  chk('"Ambos" pedido pelo Samuel: só o Diego (não vai pra ele mesmo)', JSON.stringify(props[3].para) === JSON.stringify([{ email: 'diego@macedoereis.com.br', nome: 'Diego' }]), JSON.stringify(props[3].para));
  const n0 = props.length;
  const edna = await thalia().propor_enviar_mensagem({ para: ['Edna'], texto: 'oi' });
  const eu = await thalia().propor_enviar_mensagem({ para: ['Thalia'], texto: 'oi' });
  const sem = await thalia().propor_enviar_mensagem({ para: [], texto: 'oi' });
  const vazio = await thalia().propor_enviar_mensagem({ para: ['Vitória'], texto: '   ' });
  const muitos = await thalia().propor_enviar_mensagem({ para: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], texto: 'oi' });
  chk('sem login (Edna), pra si mesma, sem destino, sem texto, destinos demais: nada proposto, o motivo dito', props.length === n0 && /Edna não tem login no sistema/.test(edna) && /não dá pra mandar pra você mesmo/.test(eu)
    && /Diga pra quem vai a mensagem/.test(sem) && /Escreva a mensagem/.test(vazio) && /Até 6 destinos/.test(muitos), [edna, eu, sem, vazio, muitos].join(' | '));
  const semBusca = await thalia().propor_enviar_mensagem({ para: ['Vitória'], texto: 'Segue o contrato.', arquivos: ['Contrato Social.pdf'] });
  chk('arquivo sem ter buscado: pede o buscar_arquivos antes', /chame buscar_arquivos antes/.test(semBusca) && props.length === n0, semBusca);
  // buscou o contrato e manda: a mensagem leva o link e toma o lugar do cartão dos arquivos
  const fsM = thalia();
  await fsM.buscar_arquivos({ empresa: ID_A, termo: 'contrato' });
  const nBusca = props.length;
  const naoAchou = await fsM.propor_enviar_mensagem({ para: ['Vitória'], texto: 'Segue.', arquivos: ['Procuração.pdf'] });
  chk('arquivo que a busca não trouxe: diz quais vieram e não propõe', /não veio nas buscas desta pergunta \(vieram: Contrato Social\.pdf\)/.test(naoAchou) && props.length === nBusca, naoAchou);
  const comArq = await fsM.propor_enviar_mensagem({ para: ['Vitória'], texto: 'Segue o contrato social da Esquina.', arquivos: ['contrato social.PDF'] });
  const pm = props[props.length - 1];
  chk('com o arquivo buscado: o link do Drive (o nome sem diferenciar maiúscula), a pasta, e a mensagem no lugar do cartão dos arquivos',
    props[nBusca - 1].tipo === 'arquivos' && pm.tipo === 'enviar_mensagem' && JSON.stringify(pm.arquivos) === JSON.stringify([{ nome: 'Contrato Social.pdf', link: 'https://drive.google.com/file/d/ARQUIVO_RAIZ_1/view', pasta: '' }])
    && /com o link do Drive de 1 arquivo \(Contrato Social\.pdf\)/.test(comArq), JSON.stringify(pm) + ' || ' + comArq);
  chk('depois da mensagem, outra busca na mesma pergunta já não troca o cartão (uma proposta por pergunta)', /Já há uma proposta nesta pergunta/.test(await fsM.buscar_arquivos({ empresa: ID_A, termo: 'das' })));
  // a guia arquivada com link de fora do Drive: não vai
  const { banco: bLink } = bancoFalso({ extras: { clientes: CL, obrigacoes_fiscais: [{ id: OBR, nome: 'PGDAS' }],
    guias_arquivadas: [{ cliente_id: ID_A, obrigacao_id: OBR, competencia: '09-2026', nome_arquivo: 'PGDAS 09-2026 LOJA.pdf', drive_file_url: 'http://exemplo.com/guia.pdf', criado_em: '2026-10-08T12:00:00Z' }] } });
  const fsL = criarFerramentas({ banco: bLink, hoje: '2026-10-19', usuario: { email: 'fiscal@macedoereis.com.br', nome: 'Thalia' }, aoPropor: a => props.push(a), drive: { configurado: () => true, arvore: async () => ({ arquivos: [], pastas: 1, cortada: false }) } });
  await fsL.buscar_arquivos({ empresa: ID_A, termo: 'pgdas' });
  const nL = props.length;
  const foraDrive = await fsL.propor_enviar_mensagem({ para: ['Vitória'], texto: 'Segue a guia.', arquivos: ['PGDAS 09-2026 LOJA.pdf'] });
  chk('o arquivo sem link do Google Drive: não vai, e diz', /não tem link do Drive/.test(foraDrive) && props.length === nL, foraDrive);
  const fsO = thalia();
  await fsO.propor_criar_tarefa({ titulo: 'Ligar pro cliente' });
  chk('com outra proposta já feita (a tarefa), a mensagem espera: uma por pergunta', /Já há uma proposta nesta pergunta/.test(await fsO.propor_enviar_mensagem({ para: ['Vitória'], texto: 'oi' })));
  chk('a etapa e o prompt: a mensagem sai em nome de quem pede, o arquivo pelo buscar_arquivos antes; mensagem pra cliente não', descreverEtapa('propor_enviar_mensagem') === 'Escrevendo a mensagem pra você conferir'
    && /propor_enviar_mensagem\. A mensagem sai em nome de quem pede/.test(INSTRUCOES) && /buscar_arquivos antes, e os nomes como vieram/.test(INSTRUCOES) && /mensagem pra cliente ou fora do chat da equipe/.test(INSTRUCOES));
}

console.log('Os cadastros (30/10/2026): incluir na Reforma, pôr num mês dos boletos, ajustar as obrigações:');
{
  // a campanha da Reforma: das parecidas, a da carteira; de empresa com filiais, a matriz; o escritório, fora da carteira
  const U = n => '7e000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const cli = (n, nome, fantasia, doc, regime, extra = {}) => ({ id: U(n), nome_principal: nome, nome_fantasia: fantasia, documento: doc, tipo_pessoa: 'PJ', regime_tributario: regime, status: 'ativo', cidade: 'Três Coroas', uf: 'RS', ...extra });
  const muller = [cli(1, 'MERCADO MULLER COMERCIO DE ALIMENTOS LTDA', 'MERCADO MULLER', '41723102000112', 'Lucro Real'), cli(2, 'MERCADO MULLER COMERCIO DE ALIMENTOS LTDA (FILIAL)', 'MERCADO MULLER FILIAL', '41723102000384', 'Lucro Presumido'),
    cli(3, 'COMERCIO DE ALIMENTOS SUPERMERCADO MULLER LTDA', 'MERCADO E ACOUGUE MULLER', '63552438000100', 'Lucro Real')];
  const raupp = [cli(11, 'J. RAUPP COMERCIO DE MOVEIS LTDA (MATRIZ)', 'MOVEIS RAUPP', '05586949000139', 'Lucro Presumido'), cli(12, 'J. RAUPP COMERCIO DE MOVEIS LTDA (FILIAL 1)', 'MOVEIS RAUPP', '05586949000210', 'Lucro Presumido'),
    cli(13, 'J. RAUPP COMERCIO DE MOVEIS LTDA (FILIAL 2)', 'REDLAR - MOVEIS RAUPP', '05586949000309', 'Lucro Presumido'), cli(14, 'MOVEIS RAUPP LTDA', null, '01921789000186', 'Lucro Presumido'),
    { ...cli(15, 'RICARDO PIRES GRAUPPE', null, '03733178084', null), tipo_pessoa: 'PF' }];
  const escritorio = [cli(21, 'DIEGO REIS CONTABILIDADE LTDA', 'MACEDO & REIS CONTABILIDADE', '19208576000177', 'Simples Nacional'),
    cli(22, 'DIEGO REIS CONTABILIDADE LTDA - FILIAL', 'MACEDO & REIS CONTABILIDADE', '19208576000258', 'Simples Nacional', { status: 'inativo' })];
  const carteira = [{ cliente_id: U(3), entrada: '2026-01-01', saida: null }, { cliente_id: U(11), entrada: '2026-03-01', saida: null }, { cliente_id: U(12), entrada: '2026-03-02', saida: null },
    { cliente_id: U(13), entrada: '2026-03-01', saida: null }, { cliente_id: U(14), entrada: '2026-03-01', saida: null }];
  const propostas = [];
  // o banco de mentira não filtra o nome_busca: cada busca vê só as empresas daquele teste
  const comCadastro = (clientes, extras = {}) => criarFerramentas({ banco: bancoFalso({ extras: { clientes, carteira_info: carteira, rt_casos: [{ id: 'cz', cliente_id: U(14), decisao: 'pendente', status: 'triado' }], ...extras } }).banco,
    hoje: '2026-10-30', usuario: { email: 'financeiro@macedoereis.com.br', nome: 'Samuel', socio: true }, aoPropor: a => propostas.push(a) });
  const r1 = await comCadastro(muller).propor_incluir_reforma({ empresas: ['Mercado Muller'], observacao: 'vai pro Simples Nacional em 2027' });
  chk('Reforma: "Mercado Muller" é a da carteira (o de nome exato está fora dela); o nome, o CNPJ, o regime de hoje e a carteira vão pro modelo', propostas.length === 1
    && JSON.stringify(propostas[0]) === JSON.stringify({ tipo: 'incluir_reforma', ids: [U(3)], observacao: 'vai pro Simples Nacional em 2027' })
    && /COMERCIO DE ALIMENTOS SUPERMERCADO MULLER LTDA \(MERCADO E ACOUGUE MULLER\) · 63\.552\.438\/0001-00 · hoje Lucro Real · na carteira desde 01\/01\/2026/.test(r1) && /Nada foi incluído ainda/.test(r1), r1);
  const r2 = await comCadastro(raupp).propor_incluir_reforma({ empresas: ['J Raupp'] });
  chk('Reforma: "J Raupp" — na carteira há a matriz, as filiais e outra empresa: fica a matriz (a opção é da empresa); a pessoa física não entra', propostas.length === 2
    && JSON.stringify(propostas[1].ids) === JSON.stringify([U(11)]) && /05\.586\.949\/0001-39/.test(r2), r2);
  const r3 = await comCadastro(escritorio).propor_incluir_reforma({ empresas: ['Macedo & Reis'] });
  chk('Reforma: o escritório (fora da carteira): a matriz ativa, dita fora da carteira', propostas.length === 3 && JSON.stringify(propostas[2].ids) === JSON.stringify([U(21)]) && /fora da carteira/.test(r3), r3);
  const r4 = await comCadastro(raupp).propor_incluir_reforma({ empresas: [U(14), U(11)] });
  chk('Reforma: a que já está na campanha fica de fora, dita à parte; a outra entra', propostas.length === 4 && JSON.stringify(propostas[3].ids) === JSON.stringify([U(11)]) && /Já está na campanha: MOVEIS RAUPP LTDA/.test(r4), r4);
  chk('Reforma: só a que já está: nada proposto; mais de 20, ou nenhuma: pede', /Já está na campanha.*Nada foi proposto/.test(await comCadastro(raupp).propor_incluir_reforma({ empresas: [U(14)] }))
    && /Até 20/.test(await comCadastro(raupp).propor_incluir_reforma({ empresas: Array.from({ length: 21 }, (_, i) => 'x' + i) })) && /Diga quais empresas/.test(await comCadastro(raupp).propor_incluir_reforma({})) && propostas.length === 4);
  const amb = await comCadastro([cli(31, 'PADARIA SOL LTDA', null, '11111111000111', 'Simples Nacional'), cli(32, 'PADARIA SOL NASCENTE LTDA', null, '22222222000122', 'Lucro Presumido')]).propor_incluir_reforma({ empresas: ['Padaria'] });
  chk('Reforma: duas empresas parecidas, nenhuma na carteira: a lista pra escolher, com o regime e a carteira', /Mais de uma empresa com "Padaria"/.test(amb) && /PADARIA SOL NASCENTE LTDA · 22\.222\.222\/0001-22 · Lucro Presumido · fora da carteira · id /.test(amb) && propostas.length === 4, amb);

  // os boletos: pôr num mês
  const cobr = [{ id: U(51), cliente_id: U(41), competencia: '2026-08', valor: 1535, vencimento: '2026-09-25', status: 'pago' }, { id: U(52), cliente_id: U(42), competencia: '2026-09', valor: 1535, vencimento: '2026-10-26', status: 'enviado' }];
  const bases = [{ cliente_id: U(41), valor_base: 1500, dia_vencimento: 25, ativo: true }, { cliente_id: U(43), valor_base: 900, dia_vencimento: 10, ativo: false }];
  const pizz = [cli(41, 'MASSA PIZZARIA LTDA', null, '33333333000133', 'Simples Nacional'), cli(42, 'PIZZARIA ARSENAL LTDA', null, '44444444000144', 'Simples Nacional'), cli(43, 'PIZZARIA SEM BASE LTDA', null, '55555555000155', 'Simples Nacional')];
  const b1 = await comCadastro(pizz, { cobrancas_mensais: cobr, cobrancas_config: bases }).propor_por_na_competencia({ empresas: [U(41), U(42), U(43)], competencia: '2026-09' });
  chk('boletos: as que faltam no mês, com o valor copiado do mais recente (ou da base) e o vencimento no dia útil; a que já está, à parte', propostas.length === 5
    && JSON.stringify(propostas[4]) === JSON.stringify({ tipo: 'por_na_competencia', competencia: '2026-09', ids: [U(41), U(43)] })
    && /MASSA PIZZARIA LTDA · R\$\s?1\.535,00 \(copiado de 08\/2026\) · vence 26\/10\/2026/.test(b1) && /PIZZARIA SEM BASE LTDA · R\$\s?900,00 \(da base de cobrança\) · vence 13\/10\/2026 · a base de cobrança dela está parada/.test(b1)
    && /PIZZARIA ARSENAL LTDA já está em 09\/2026 \(R\$\s?1\.535,00, enviado\)/.test(b1) && /Nada foi gravado ainda/.test(b1), b1);
  chk('boletos: competência fora do formato, ou todas já no mês: não propõe', /'AAAA-MM'/.test(await comCadastro(pizz).propor_por_na_competencia({ empresas: [U(41)], competencia: '09/2026' }))
    && /Nada foi proposto/.test(await comCadastro(pizz, { cobrancas_mensais: cobr }).propor_por_na_competencia({ empresas: [U(42)], competencia: '2026-09' })) && propostas.length === 5);

  // as obrigações: quem cuida, o dia, desligar
  const OB = n => '7f000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const catalogo = [{ id: OB(1), nome: 'SITUAÇÃO FISCAL - FEDERAL', dia_prazo: 20, ativo: true }, { id: OB(2), nome: 'SITUAÇÃO FISCAL - ESTADUAL', dia_prazo: 20, ativo: true },
    { id: OB(3), nome: 'NFS-E DJ INSTALAÇÕES', dia_prazo: 1, ativo: true }];
  const vinc = [{ id: OB(11), cliente_id: U(41), obrigacao_id: OB(1), responsavel: 'Thalia', dia_prazo_override: null, ativo: true },
    { id: OB(12), cliente_id: U(42), obrigacao_id: OB(1), responsavel: 'THALIA', dia_prazo_override: null, ativo: true },
    { id: OB(13), cliente_id: U(43), obrigacao_id: OB(1), responsavel: 'Deize', dia_prazo_override: null, ativo: true },
    { id: OB(14), cliente_id: U(41), obrigacao_id: OB(3), responsavel: 'Deize', dia_prazo_override: null, ativo: true }];
  const comObrig = () => comCadastro(pizz, { obrigacoes_fiscais: catalogo, cliente_obrigacoes: vinc });
  const o1 = await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['situação fiscal federal'], responsavel_atual: 'thalia', novo_responsavel: 'deize' });
  chk('obrigações: a de quem cuida hoje passa pra Deize (sem acento e sem maiúscula); as tarefas abertas vão junto, e o modelo sabe', propostas.length === 6
    && JSON.stringify(propostas[5]) === JSON.stringify({ tipo: 'ajustar_obrigacoes', ids: [OB(11), OB(12)], mudar: { responsavel: 'Deize' } })
    && /quem cuida: THALIA → Deize/.test(o1) && /tarefas abertas dessas obrigações que estavam com quem cuidava vão junto pra Deize/.test(o1) && /Nada mudou ainda/.test(o1), o1);
  const o2 = await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['NFS-E DJ INSTALAÇÕES'], novo_dia: 30 });
  chk('obrigações: o dia daqui pra frente (as já criadas ficam com o prazo delas)', propostas.length === 7 && JSON.stringify(propostas[6]) === JSON.stringify({ tipo: 'ajustar_obrigacoes', ids: [OB(14)], mudar: { dia: 30 } })
    && /dia 1 → 30/.test(o2) && /as já criadas ficam com o prazo delas/.test(o2), o2);
  const o3 = await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['SITUAÇÃO FISCAL - FEDERAL'], empresas: [U(43)], desligar: true });
  chk('obrigações: desligar numa empresa', propostas.length === 8 && JSON.stringify(propostas[7]) === JSON.stringify({ tipo: 'ajustar_obrigacoes', ids: [OB(13)], mudar: { desligar: true } }) && /desligar/.test(o3), o3);
  chk('obrigações: o nome que bate em duas pede o completo; desligar com outra mudança, pessoa fora da equipe e "já está assim" não propõem',
    /Mais de uma obrigação com "situação fiscal": SITUAÇÃO FISCAL - ESTADUAL; SITUAÇÃO FISCAL - FEDERAL/.test(await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['situação fiscal'], novo_dia: 5 }))
    && /Desligar vai sozinho/.test(await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['NFS-E DJ INSTALAÇÕES'], desligar: true, novo_dia: 5 }))
    && /fora da equipe/.test(await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['NFS-E DJ INSTALAÇÕES'], novo_responsavel: 'Luana' }))
    && /já está assim/.test(await comObrig().propor_ajustar_obrigacoes({ obrigacoes: ['NFS-E DJ INSTALAÇÕES'], novo_responsavel: 'Deize' })) && propostas.length === 8);
  chk('as etapas e o prompt dos cadastros', descreverEtapa('propor_incluir_reforma') === 'Separando as empresas pra campanha da Reforma' && descreverEtapa('propor_por_na_competencia') === 'Montando os boletos pra você conferir'
    && descreverEtapa('propor_ajustar_obrigacoes') === 'Separando as obrigações pra você confirmar' && /propor_incluir_reforma; o nome e o CNPJ de cada uma vão na resposta/.test(INSTRUCOES)
    && /propor_por_na_competencia/.test(INSTRUCOES) && /propor_ajustar_obrigacoes — o dia novo vale das próximas tarefas/.test(INSTRUCOES) && /incluir empresa na campanha da Reforma, pôr empresa num mês dos boletos/.test(INSTRUCOES));
}

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
