// Chat da Reforma ("Perguntar à base"): a busca na base, as ferramentas (com o motor e a confiança da ficha), o laço com o
// modelo (respostas roteirizadas, sem rede), o servidor da Edge Function (login, limite, avaliação, histórico, etapas em
// fluxo) e a trava do commit: a função importa o código do repositório pelo jsDelivr num commit fixado — se um dos arquivos
// mudou depois dele, o teste avisa pra fixar o commit novo e reimplantar.
// Dados todos inventados (o repositório é público): nada de material de curso nem de cliente.
// Rodar com: node tests/reforma-chat.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizar, radical, tokens, secoesDe, criarIndice, buscar, lerMaterial } from '../supabase/functions/reforma-chat/busca.js';
import { montarSistema, preambulo, INSTRUCOES } from '../supabase/functions/reforma-chat/prompt.js';
import { DEFINICOES, criarFerramentas, aplicarAlteracoes, acharCaso, situacaoDoCaso, descreverEtapa } from '../supabase/functions/reforma-chat/ferramentas.js';
import { responder, criarChamador, comCache, fontesDaResposta } from '../supabase/functions/reforma-chat/agente.js';
import { criarServidor, limparTela, limparHistorico, hojeBR, LIMITE_DIA } from '../supabase/functions/reforma-chat/servidor.js';
import { simular, aliquotas2027, entradaComAliquotas } from '../assets/js/rt-motor.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const NB = String.fromCharCode(160);
const br = s => String(s).split(NB).join(' ');

// ---------------- base inventada ----------------
const MATERIAIS = [
  { codigo: 'TST-LEI', modulo: 'Módulo Teste A', titulo: 'Lei de teste', tipo: 'norma', oficial: true, autor: null, data_ref: '2025-01-16', ordem: 1,
    leitura: '# Lei de teste\n\n## Art. 12 — base de cálculo\nA base de cálculo não inclui o imposto estadual nem o municipal.\n\n## Art. 47 — créditos\nO adquirente apropria os créditos do imposto destacado na nota do fornecedor, quando o débito do fornecedor é extinto.\n\n## Art. 157 — isenção\nO transporte público coletivo de passageiros é isento; isenção não é alíquota zero.' },
  { codigo: 'TST-AULA', modulo: 'Módulo Teste B', titulo: 'Aula de teste sobre o Simples', tipo: 'aula', oficial: false, autor: 'Professor de teste', data_ref: '2026-05-19', ordem: 1,
    leitura: '# Aula\n\n## Crédito de quem compra do Simples\nQuem compra de fornecedor optante pelo Simples, por dentro, credita só o que foi pago no DAS.\n\n## Prazos\nA aula dizia 30/09/2026 (superado).\n\n## Tabela longa\n' + Array.from({ length: 120 }, (_, i) => '| linha ' + (i + 1) + ' | fornecedores e créditos de teste |').join('\n') },
  { codigo: 'TST-SINTESE', modulo: 'Módulo Teste B', titulo: 'Síntese de teste', tipo: 'sintese', oficial: false, autor: null, data_ref: '2026-10-14', ordem: 0,
    leitura: '# Síntese de teste\n\n## Decisões\nNada a decidir.\n\n## A conferir\n- O vencimento do imposto municipal.' }
];
const REGRAS = [{ codigo: 'TST-REGRA', titulo: 'Regra de teste', dispositivo: 'Lei de teste, art. 47', regra: 'O crédito depende da extinção do débito do fornecedor.', aplica_a: 'todos', efeito: 'nenhum', fonte: 'TST-LEI', verificado_em: '2026-10-14' }];
const VINCULOS = [{ regra_codigo: 'TST-REGRA', material_codigo: 'TST-LEI', onde: 'art. 47', ordem: 0 }];

console.log('Busca na base:');
chk('sem acento e minúsculo', normalizar('Crédito ISENÇÃO §2º') === 'credito isencao §2º');
chk('crédito e créditos, isenção e isenções, fornecedor e fornecedores, alíquota e alíquotas: o mesmo radical',
  radical('creditos') === radical('credito') && radical('isencoes') === radical('isencao') && radical('fornecedores') === radical('fornecedor') && radical('aliquotas') === radical('aliquota'));
chk('palavra vazia sai, número fica (art. 47, 2027)', JSON.stringify(tokens('O crédito do art. 47 em 2027')) === JSON.stringify([radical('credito'), 'art', '47', '2027']), JSON.stringify(tokens('O crédito do art. 47 em 2027')));
const ss = secoesDe(MATERIAIS[1].leitura);
chk('seções pelo título, com o caminho', ss.some(s => s.secao === 'Aula › Crédito de quem compra do Simples'), ss.map(s => s.secao).join(' | '));
chk('seção longa vira partes de até ~3.500 caracteres, com "parte k de n"', ss.filter(s => /Tabela longa \(parte \d+ de \d+\)/.test(s.secao)).length >= 2 && ss.every(s => s.texto.length <= 3600));
const ind = criarIndice(MATERIAIS);
const r1 = buscar(ind, 'crédito de quem compra de fornecedor do Simples');
chk('acha o trecho certo primeiro', r1[0] && r1[0].codigo === 'TST-AULA' && /Crédito de quem compra/.test(r1[0].secao), r1[0] && r1[0].secao);
chk('no máximo 2 trechos do mesmo material', Object.values(r1.reduce((a, r) => { a[r.codigo] = (a[r.codigo] || 0) + 1; return a; }, {})).every(n => n <= 2));
chk('sem acento na consulta também acha', (buscar(ind, 'isencao transporte publico')[0] || {}).codigo === 'TST-LEI');
chk('o código do material na consulta puxa o material', (buscar(ind, 'TST-SINTESE decisões')[0] || {}).codigo === 'TST-SINTESE');
chk('filtro por módulo e por tipo', buscar(ind, 'crédito', { modulo: 'teste a' }).every(r => r.codigo === 'TST-LEI') && buscar(ind, 'crédito', { tipo: 'aula' }).every(r => r.codigo === 'TST-AULA'));
chk('consulta vazia não traz nada', buscar(ind, 'de o a').length === 0);
chk('o recorte mostra a linha com os termos', /isento/.test((buscar(ind, 'transporte coletivo isento')[0] || {}).trecho || ''));
const lm0 = lerMaterial(MATERIAIS[0]);
chk('ler sem seção: cabeçalho e sumário numerado', /^TST-LEI — Lei de teste/.test(lm0) && /2\. Lei de teste › Art\. 12 — base de cálculo/.test(lm0) && /norma \(oficial\)/.test(lm0), lm0.slice(0, 200));
chk('ler a seção pelo número e pelo título', /extinto/.test(lerMaterial(MATERIAIS[0], '3')) && /isento/.test(lerMaterial(MATERIAIS[0], 'isenção')));
chk('seção que não existe: avisa e mostra o sumário', /não encontrada/.test(lerMaterial(MATERIAIS[0], 'art. 999')));
const lmL = lerMaterial(MATERIAIS[1], '4', 3000);
chk('leitura longa: corta no limite e diz onde continua', /\(continua: secao \d+/.test(lmL));

console.log('O que o modelo recebe fixo:');
const sis = montarSistema({ materiais: MATERIAIS, regras: REGRAS, vinculos: VINCULOS });
chk('dois blocos; o cache só no último', sis.length === 2 && !sis[0].cache_control && sis[1].cache_control && sis[1].cache_control.type === 'ephemeral');
chk('índice com código, tipo, data e título', sis[1].text.includes('TST-LEI · norma oficial · 2025-01-16 · Lei de teste') && sis[1].text.includes('TST-AULA · aula · 2026-05-19 · Aula de teste sobre o Simples'));
chk('Base legal inteira, com os materiais de cada regra', sis[1].text.includes('[regra TST-REGRA] Regra de teste') && sis[1].text.includes('Materiais: TST-LEI (art. 47)'));
chk('só as sínteses vão inteiras (a leitura completa é pelas ferramentas)', sis[1].text.includes('=== TST-SINTESE') && !sis[1].text.includes('Quem compra de fornecedor optante'));
chk('nada que muda de uma pergunta pra outra no fixo (a data de hoje, a ficha)', !/Hoje:|Ficha aberta/.test(sis[0].text + sis[1].text));
chk('instruções: só a base, fonte em toda afirmação, números só pelo simulador, curso fora do texto pro cliente',
  /só da base/.test(INSTRUCOES) && /FONTE EM TODA AFIRMAÇÃO/.test(INSTRUCOES) && /Nunca calcule de cabeça/.test(INSTRUCOES) && /não escreva texto para o cliente com conteúdo do curso/.test(INSTRUCOES));
const pre = preambulo({ hoje: '14/10/2026', caso: 'LOJA DE TESTE UM LTDA', telaNaoGravada: true });
chk('a data e a ficha aberta vão na mensagem do usuário', /Hoje: 14\/10\/2026/.test(pre) && /Ficha aberta: LOJA DE TESTE UM LTDA/.test(pre) && /não gravados/.test(pre));

// ---------------- casos inventados ----------------
const MESES = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const ENT = { anexo: 'I', rbt12: 600000, receita: 50000, aliqEfetivaInformada: null, partilha: 15.5, cbs: 9.3, ibs: 0.1, pctPJ: 10, pctComprasMercadorias: 60, pctComprasDespesas: 2,
  pctComprasComCredito: null, pctDespesasComCredito: null, pctImpostoEmbutido: 0, pctExcluidoST: 0, pctReceitaMonofasica: 0, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0, creditoEstoqueMes: 0 };
const PROC = { receita: { fonte: 'faturamento', meses: MESES }, rbt12: { fonte: 'pgdas', meses: ['2026-08'] }, anexo: { fonte: 'pgdas', meses: ['2026-08'] }, aliqEfetiva: { fonte: 'pgdas', meses: ['2026-08'] },
  partilha: { fonte: 'pgdas', meses: ['2026-08'] }, pctExcluidoST: { fonte: 'pgdas', meses: ['2026-08'] }, pctMerc: { fonte: 'entradas', meses: MESES, receitaDe: ['faturamento'] },
  pctDesp: { fonte: 'entradas', meses: MESES, receitaDe: ['faturamento'] }, pctPJ: { fonte: 'saidas', meses: MESES, porDocumento: true, regimeConsultado: true }, mix: { fonte: 'padrao' } };
const params = aliquotas2027({ cbs: 9.3, ibs: 0.1, cbs_aplicada: 9.2 });
const r0 = simular(entradaComAliquotas(ENT, params));
const obs = JSON.stringify({ input: ENT, veredito: r0.veredito.tipo, frase: r0.veredito.frase, calculado_em: '2026-10-14', procedencia: PROC, confianca: { conclusao: 'firme' } });
const CASOS = [
  { id: '11111111-1111-4111-8111-111111111111', cliente_id: 'aaaaaaaa-0000-4000-8000-000000000001', cnae_base: '4754', segmento: 'comercio', triagem: 'simular', score: 3, decisao: 'pendente', status: 'simulado', fundamento: null, comunicado_em: null, prazo_opcao: '2026-10-30',
    sim_custo_dentro: r0.semestre.custoDentro, sim_custo_fora: r0.semestre.custoFora, sim_obs: obs, cliente: { nome_principal: 'LOJA DE TESTE UM LTDA', nome_fantasia: null, cnae_principal: '4754-7/01', cidade: 'Três Coroas' } },
  { id: '22222222-2222-4222-8222-222222222222', cliente_id: 'aaaaaaaa-0000-4000-8000-000000000002', cnae_base: '4754', segmento: 'comercio', triagem: 'simular', score: 3, decisao: 'por_fora', status: 'decidido', fundamento: 'Texto do fundamento.', comunicado_em: null, prazo_opcao: '2026-10-30',
    sim_custo_dentro: 10, sim_custo_fora: 9, sim_obs: JSON.stringify({ input: ENT, veredito: 'OPTE', confianca: { conclusao: 'sem_conclusao', decisivos: ['Imposto embutido nas compras'] } }), cliente: { nome_principal: 'LOJA DE TESTE DOIS LTDA', nome_fantasia: 'LOJINHA', cnae_principal: '4754-7/01', cidade: 'Igrejinha' } },
  { id: '33333333-3333-4333-8333-333333333333', cliente_id: 'aaaaaaaa-0000-4000-8000-000000000003', cnae_base: '6920', segmento: 'servico', triagem: 'tende_por_dentro', score: 1, decisao: 'pendente', status: 'triado', fundamento: null, comunicado_em: null, prazo_opcao: '2026-10-30',
    sim_custo_dentro: null, sim_custo_fora: null, sim_obs: null, cliente: { nome_principal: 'ESCRITORIO DE TESTE TRES LTDA', nome_fantasia: null, cnae_principal: '6920-6/01', cidade: 'Parobé' } }
];
const base = { indice: ind, porCodigo: new Map(MATERIAIS.map(m => [m.codigo, m])) };

console.log('Ferramentas:');
chk('cinco ferramentas, com esquema', DEFINICOES.map(d => d.name).join(',') === 'buscar_base,ler_material,listar_casos,ver_caso,simular' && DEFINICOES.every(d => d.input_schema && d.input_schema.type === 'object'));
chk('situação na lista: o mesmo critério da ficha', situacaoDoCaso(CASOS[1]).r === 'sem_conclusao' && situacaoDoCaso(CASOS[2]).simulado === false && /triagem por CNAE: tende por dentro/.test(situacaoDoCaso(CASOS[2]).rotulo));
chk('acha o caso pelo nome, sem LTDA, pela fantasia e pelo id', acharCaso(CASOS, 'loja de teste um ltda').caso === CASOS[0] && acharCaso(CASOS, 'lojinha').caso === CASOS[1] && acharCaso(CASOS, CASOS[2].id).caso === CASOS[2]);
chk('nome que bate em dois: pede qual', /Mais de um caso/.test(acharCaso(CASOS, 'loja de teste').erro || ''));
chk('sem nome e sem ficha aberta: pede o nome', /Nenhuma ficha aberta/.test(acharCaso(CASOS, '', null).erro || ''));
const fe = criarFerramentas({ base, carregarCasos: async () => CASOS, params, contexto: { caso_id: CASOS[0].id } });
const bb = await fe.buscar_base({ consulta: 'isenção do transporte' });
chk('buscar_base: código, tipo, material e seção', /\[1\] TST-LEI · norma · Lei de teste/.test(bb) && /seção \d+: Lei de teste › Art\. 157/.test(bb), bb.slice(0, 160));
chk('ler_material: código que não existe avisa', /não existe na base/.test(await fe.ler_material({ codigo: 'XX-NADA' })));
const lc = await fe.listar_casos({});
chk('listar_casos: resumo e um caso por linha', /^3 casos na campanha/.test(lc) && lc.split('\n').filter(l => l.startsWith('- ')).length === 3 && /LOJINHA/.test(lc), lc.split('\n')[0]);
chk('listar_casos: filtro "sem conclusão" e busca', (await fe.listar_casos({ filtro: 'sem_conclusao' })).split('\n').filter(l => l.startsWith('- ')).length === 1 && /ESCRITORIO/.test(await fe.listar_casos({ busca: 'escritorio' })));
const vc = br(await fe.ver_caso({}));
chk('ver_caso sem nome: a ficha aberta', /^Caso: LOJA DE TESTE UM LTDA · CNAE 4754-7\/01/.test(vc), vc.slice(0, 80));
chk('ver_caso: entradas, semestre, resultado e a confiança', /SIMULAÇÃO GRAVADA/.test(vc) && /receita R\$ 50\.000,00\/mês/.test(vc) && /custo por dentro R\$ /.test(vc) && /Resultado do simulador:/.test(vc) && /Confiança dos números:/.test(vc));
chk('ver_caso: a mesma conta da ficha (custo por fora do motor)', vc.includes(br(r0.semestre.custoFora.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))));
chk('ver_caso: caso sem simulação diz como simular', /Sem simulação gravada/.test(await fe.ver_caso({ caso: 'escritorio de teste' })));
const sim = br(await fe.simular({ alteracoes: { pctImpostoEmbutido: 18 } }));
const r18 = simular({ ...entradaComAliquotas(ENT, params), pctImpostoEmbutido: 18 });
chk('simular: antes e depois, sem gravar, com o número trocado', /^E SE em LOJA DE TESTE UM LTDA/.test(sim) && /nada foi gravado/.test(sim) && /imposto embutido nas compras \(% do valor das notas\): 0% → 18%/.test(sim) && /ANTES/.test(sim) && /DEPOIS/.test(sim), sim.slice(0, 200));
chk('simular: o depois é a conta do motor com o número trocado', sim.includes(br(r18.semestre.custoFora.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))));
chk('simular: o número trocado vale como informado na confiança', /Imposto embutido nas compras: 18,0% do valor das notas de compra — média/.test(sim), (sim.match(/Imposto embutido[^\n]*/) || [''])[0].slice(0, 120));
chk('simular: campo desconhecido, % acima de 100 e mix que não fecha são recusados',
  /campo desconhecido: foo/.test(await fe.simular({ alteracoes: { foo: 1 } })) && /acima de 100%/.test(await fe.simular({ alteracoes: { pctPJ: 120 } })) && /tem de dar 100%/.test(await fe.simular({ alteracoes: { mixCheia: 50, mixZero: 10 } })));
chk('simular: caso sem simulação não roda', /ainda não tem simulação/.test(await fe.simular({ caso: 'escritorio de teste', alteracoes: { pctPJ: 50 } })));
const al = aplicarAlteracoes(ENT, { mixZero: 40, mixRed60: 30 });
chk('mix trocado sem a cheia: a cheia fica com o resto até 100%', al.erros.length === 0 && al.novo.mixCheia === 30 && al.trocados.join() === 'mixZero,mixRed60');
chk('número em texto com vírgula vira número', aplicarAlteracoes(ENT, { pctPJ: '12,5' }).novo.pctPJ === 12.5);
const feTela = criarFerramentas({ base, carregarCasos: async () => CASOS, params, contexto: { caso_id: CASOS[0].id, tela: { caso_id: CASOS[0].id, input: { ...ENT, cbs: 9.2, pctPJ: 80 }, procedencia: PROC } } });
const vt = await feTela.ver_caso({});
chk('ver_caso com números na tela: mostra a gravada e a da tela', /SIMULAÇÃO GRAVADA/.test(vt) && /NA TELA AGORA \(calculada e ainda não gravada\)/.test(vt) && /clientes PJ 80%/.test(vt));
chk('simular com a ficha calculada parte da tela', /base: simulação da tela, não gravada/.test(await feTela.simular({ alteracoes: { pctImpostoEmbutido: 5 } })));
chk('etapas legíveis pra tela', descreverEtapa('buscar_base', { consulta: 'art. 47' }) === 'Buscando na base: "art. 47"' && descreverEtapa('ver_caso', {}) === 'Abrindo o caso da ficha'
  && /^Rodando o simulador: pctPJ = 50/.test(descreverEtapa('simular', { alteracoes: { pctPJ: 50 } })));

console.log('Conversa com o modelo (roteirizada):');
const chamadas = [];
const roteiro = [
  { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Vou buscar.' }, { type: 'tool_use', id: 't1', name: 'buscar_base', input: { consulta: 'isenção transporte' } }], usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 } },
  { stop_reason: 'end_turn', content: [{ type: 'text', text: 'É isenção, não alíquota zero [TST-LEI, art. 157] · [regra TST-REGRA].' }], usage: { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 5200, cache_creation_input_tokens: 400 } }
];
const etapasVistas = [];
const res = await responder({ chamar: async c => { chamadas.push(JSON.parse(JSON.stringify(c))); return { ...roteiro[chamadas.length - 1], _modelo: 'modelo-teste' }; },
  sistema: sis, definicoes: DEFINICOES, ferramentas: fe, historico: [{ pergunta: 'Oi?', resposta: 'Olá.' }], mensagem: pre + 'Ônibus urbano tem alíquota zero?', aoEtapa: t => etapasVistas.push(t) });
chk('a ferramenta pedida roda e a resposta final volta', res.texto.startsWith('É isenção') && res.etapas.length === 1 && res.etapas[0].ferramenta === 'buscar_base' && etapasVistas[0] === 'Buscando na base: "isenção transporte"');
chk('o resultado da ferramenta vai de volta ao modelo', chamadas[1].messages.at(-1).content[0].type === 'tool_result' && /TST-LEI/.test(chamadas[1].messages.at(-1).content[0].content));
chk('histórico da conversa antes da pergunta', chamadas[0].messages[0].content === 'Oi?' && chamadas[0].messages[1].content === 'Olá.');
chk('cache na última mensagem de cada chamada (e só nela)', chamadas.every(c => JSON.stringify(c.messages.at(-1)).includes('cache_control') && !JSON.stringify(c.messages.slice(0, -1)).includes('cache_control')));
chk('o uso das duas chamadas somado; o modelo anotado', res.uso.entrada === 400 && res.uso.saida === 60 && res.uso.cacheLeitura === 10200 && res.uso.cacheEscrita === 400 && res.modelo === 'modelo-teste' && res.rodadas === 2);
const sempre = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'listar_casos', input: {} }], usage: {} };
const ch2 = [];
const res2 = await responder({ chamar: async c => { ch2.push(c); return c.tool_choice ? { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Final.' }], usage: {} } : sempre; },
  sistema: sis, definicoes: DEFINICOES, ferramentas: fe, mensagem: 'x', maxRodadas: 3 });
chk('na última rodada, sem ferramenta (tool_choice none) e responde com o que tem', res2.texto === 'Final.' && ch2.length === 3 && ch2[2].tool_choice && ch2[2].tool_choice.type === 'none' && !ch2[1].tool_choice);
chk('comCache não mexe nas mensagens originais', (() => { const m = [{ role: 'user', content: 'a' }]; comCache(m); return m[0].content === 'a'; })());
const fsr = fontesDaResposta('Veja [TST-LEI, art. 12; regra TST-REGRA] e [M99-INVENTADO, p. 3] e [nota solta].', new Set(['TST-LEI']), new Set(['TST-REGRA']));
chk('fontes citadas: material e regra; código que não existe vai à parte', fsr.fontes.map(f => f.tipo + ':' + f.codigo).join() === 'material:TST-LEI,regra:TST-REGRA' && fsr.desconhecidas.join() === 'M99-INVENTADO');
let tent = 0;
const chamador = criarChamador({ fetch: async (url, o) => { tent++; const m = JSON.parse(o.body).model; if (m === 'modelo-a') return new Response('{"type":"error"}', { status: 404 }); if (tent === 2) return new Response('sobrecarga', { status: 529 }); return new Response(JSON.stringify({ content: [], usage: {} }), { status: 200 }); },
  chave: 'k', modelos: ['modelo-a', 'modelo-b'], esperar: async () => {} });
const rc = await chamador({});
chk('modelo que a conta não tem: usa o próximo; sobrecarga: tenta de novo', rc._modelo === 'modelo-b' && tent === 3);

console.log('Servidor da função:');
const AGORA = new Date('2026-10-14T15:00:00Z');
function falsoBanco({ usuarioEmail = 'equipe@macedoereis.com.br', contagem = 0, reivindicada = null } = {}) {
  const log = [];
  const f = async (url, o = {}) => {
    const u = String(url); const metodo = o.method || 'GET';
    log.push({ url: u, metodo, corpo: o.body ? JSON.parse(o.body) : null, headers: o.headers || {} });
    const json = (x, h = {}) => new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json', ...h } });
    if (u.includes('/auth/v1/user')) return (o.headers.Authorization === 'Bearer jwt-bom') ? json({ email: usuarioEmail }) : new Response('{}', { status: 401 });
    if (u.includes('/rest/v1/rt_materiais')) return json(MATERIAIS);
    if (u.includes('/rest/v1/rt_regras')) return json(REGRAS);
    if (u.includes('/rest/v1/rt_regra_materiais')) return json(VINCULOS);
    if (u.includes('/rest/v1/rt_parametros')) return json([{ chave: 'aliq_ref_2027', valor: { cbs: 9.3, ibs: 0.1, cbs_aplicada: 9.2 } }]);
    if (u.includes('/rest/v1/rt_casos')) return json(CASOS.map(({ cliente, ...c }) => c));
    if (u.includes('/rest/v1/clientes')) return json(CASOS.map(c => ({ id: c.cliente_id, ...c.cliente })));
    if (u.includes('/rest/v1/rt_chat') && metodo === 'GET') return json([], { 'Content-Range': contagem ? '0-0/' + contagem : '*/0' });
    if (u.includes('/rest/v1/rt_chat') && metodo === 'PATCH' && o.body && JSON.parse(o.body).situacao === 'rodando') return json(reivindicada ? [reivindicada] : []);
    if (u.includes('/rest/v1/rt_chat')) return new Response(null, { status: 201 });
    return new Response('?', { status: 404 });
  };
  return { f, log };
}
const ENV = { SUPABASE_URL: 'https://banco.teste', SUPABASE_SERVICE_ROLE_KEY: 'servico', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'k' };
const chamarFinal = async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Resposta de teste [TST-LEI, art. 47].' }], usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'modelo-teste' });
const pedido = (corpo, jwt = 'jwt-bom') => new Request('https://funcao.teste/reforma-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), origin: 'https://site.teste' }, body: JSON.stringify(corpo) });
{
  const { f } = falsoBanco();
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarFinal });
  const op = await srv(new Request('https://funcao.teste/reforma-chat', { method: 'OPTIONS', headers: { origin: 'https://site.teste' } }));
  chk('OPTIONS: CORS', op.status === 200 && op.headers.get('Access-Control-Allow-Origin') === 'https://site.teste');
  chk('sem login: 401', (await srv(pedido({ pergunta: 'oi' }, null))).status === 401);
  chk('chave pública (sem usuário): 401', (await srv(pedido({ pergunta: 'oi' }, 'anon'))).status === 401);
  chk('pergunta vazia: 400', (await srv(pedido({ pergunta: '  ' }))).status === 400);
}
{
  const { f } = falsoBanco({ usuarioEmail: 'alguem@gmail.com' });
  chk('e-mail de fora do escritório: 403', (await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarFinal })(pedido({ pergunta: 'oi' }))).status === 403);
}
{
  const { f } = falsoBanco({ contagem: LIMITE_DIA });
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarFinal })(pedido({ pergunta: 'oi' }));
  chk('limite de perguntas do dia: 429 com o aviso', r.status === 429 && /limite de 60 perguntas por dia/.test((await r.json()).erro));
}
{
  const { f, log } = falsoBanco();
  const srv = criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarFinal });
  const r = await srv(pedido({ pergunta: 'Qual a regra do crédito?', conversa: '44444444-4444-4444-8444-444444444444', contexto: { caso_id: CASOS[0].id } }));
  const j = await r.json();
  chk('pergunta respondida (JSON), com as fontes', r.status === 200 && /Resposta de teste/.test(j.resposta) && j.fontes.length === 1 && j.fontes[0].codigo === 'TST-LEI');
  const g = log.find(x => x.url.endsWith('/rest/v1/rt_chat') && x.metodo === 'POST');
  chk('histórico gravado: quem, pergunta, resposta, caso, conversa, fontes, uso, modelo', g && g.corpo.usuario === 'equipe@macedoereis.com.br' && g.corpo.pergunta === 'Qual a regra do crédito?' && /Resposta de teste/.test(g.corpo.resposta)
    && g.corpo.caso_id === CASOS[0].id && g.corpo.conversa === '44444444-4444-4444-8444-444444444444' && g.corpo.fontes.citadas.length === 1 && g.corpo.tokens_entrada === 10 && g.corpo.modelo === 'modelo-teste' && g.corpo.situacao === 'ok');
  chk('lê o banco com a chave de servidor; o login, com a chave pública', log.filter(x => x.url.includes('/rest/v1/')).every(x => x.headers.Authorization === 'Bearer servico') && log.find(x => x.url.includes('/auth/v1/user')).headers.apikey === 'anon');
  chk('do cadastro do cliente, só nome, fantasia, CNAE e cidade (nunca credenciais)', log.filter(x => x.url.includes('/rest/v1/clientes')).every(x => /select=id,nome_principal,nome_fantasia,cnae_principal,cidade&/.test(x.url)));
  await srv(pedido({ pergunta: 'De novo?' }));
  chk('a base fica em memória (uma leitura pra duas perguntas)', log.filter(x => x.url.includes('/rest/v1/rt_materiais')).length === 1);
  const rf = await srv(pedido({ pergunta: 'Em fluxo?', fluxo: true }));
  const txt = await rf.text();
  chk('com "fluxo": text/event-stream com a resposta no fim', rf.headers.get('Content-Type') === 'text/event-stream' && /^data: \{"tipo":"resposta","texto":"Resposta de teste/m.test(txt));
}
{
  const { f, log } = falsoBanco();
  const vistas = [];
  const chamarComFerramenta = (() => { let n = 0; return async c => { vistas.push(c); return ++n === 1 ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'a', name: 'ver_caso', input: {} }], usage: {} } : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Pronto.' }], usage: {} }; }; })();
  const rf = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarComFerramenta })(pedido({ pergunta: 'Como está?', fluxo: true, contexto: { caso_id: CASOS[0].id } }));
  const txt = await rf.text();
  chk('em fluxo, as etapas chegam antes da resposta', txt.indexOf('"tipo":"etapa","texto":"Abrindo o caso da ficha"') >= 0 && txt.indexOf('"tipo":"etapa"') < txt.indexOf('"tipo":"resposta"'));
  const primeira = JSON.stringify(vistas[0].messages.at(-1));
  chk('a ficha aberta e a data entram na mensagem (não no fixo)', /Ficha aberta: LOJA DE TESTE UM LTDA/.test(primeira) && /Hoje: 14\/10\/2026/.test(primeira) && !/Ficha aberta/.test(JSON.stringify(vistas[0].system)));
  chk('o caso da ficha é lido do banco uma vez por pergunta', log.filter(x => x.url.includes('/rest/v1/rt_casos')).length === 1);
}
{
  const linha = { id: '55555555-5555-4555-8555-555555555555', usuario: 'avaliacao', pergunta: 'Pergunta da avaliação?', caso_id: null, conversa: null, situacao: 'rodando' };
  const { f, log } = falsoBanco({ reivindicada: linha });
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: chamarFinal })(pedido({ avaliacao: linha.id }, 'anon'));
  chk('avaliação: a linha criada pelo banco vale uma vez, sem login', r.status === 200 && /Resposta de teste/.test((await r.json()).resposta));
  const claim = log.find(x => x.metodo === 'PATCH' && x.corpo && x.corpo.situacao === 'rodando');
  chk('avaliação: só linha "avaliacao" pendente e recente', claim && /usuario=eq\.avaliacao&situacao=eq\.pendente&criado_em=gte\./.test(claim.url));
  const fim = log.find(x => x.metodo === 'PATCH' && x.url.endsWith('rt_chat?id=eq.' + linha.id));
  chk('avaliação: a resposta volta pra mesma linha', fim && fim.corpo.situacao === 'ok' && /Resposta de teste/.test(fim.corpo.resposta));
  const { f: f2 } = falsoBanco({ reivindicada: null });
  chk('avaliação com id usado, velho ou inventado: 403', (await criarServidor({ env: k => ENV[k], fetch: f2, agora: () => AGORA, chamar: chamarFinal })(pedido({ avaliacao: linha.id }, 'anon'))).status === 403);
}
{
  const { f, log } = falsoBanco();
  const r = await criarServidor({ env: k => ENV[k], fetch: f, agora: () => AGORA, chamar: async () => { throw new Error('API 500: fora'); } })(pedido({ pergunta: 'Quebra?' }));
  const g = log.find(x => x.url.endsWith('/rest/v1/rt_chat') && x.metodo === 'POST');
  chk('erro do modelo: avisa e grava o erro no histórico', r.status === 500 && /Não consegui responder agora/.test((await r.json()).erro) && g && g.corpo.situacao === 'erro' && /API 500/.test(g.corpo.erro));
}
chk('tela: só os campos da entrada do motor (o resto cai)', JSON.stringify(limparTela({ input: { anexo: 'i', receita: '1000', pctPJ: 10, malicioso: '<script>', issFixo: 1 } }, 'x').input) === JSON.stringify({ anexo: 'I', receita: 1000, pctPJ: 10, issFixo: true }));
chk('tela sem receita ou sem caso não vale', limparTela({ input: { anexo: 'I' } }, 'x') === null && limparTela({ input: { anexo: 'I', receita: 1 } }, null) === null);
chk('histórico: até 6 perguntas, texto cortado', limparHistorico(Array.from({ length: 9 }, (_, i) => ({ pergunta: 'p' + i, resposta: 'r'.repeat(7000) }))).length === 6 && limparHistorico([{ pergunta: 'a', resposta: 'r'.repeat(7000) }])[0].resposta.length === 6000);
chk('a data de hoje no fuso de Brasília', hojeBR(new Date('2026-10-15T02:30:00Z')) === '14/10/2026');

console.log('Commit fixado na função (jsDelivr):');
const idx = readFileSync(raiz + 'supabase/functions/reforma-chat/index.ts', 'utf8');
const m = /cdn\.jsdelivr\.net\/gh\/macedo-reis-contabilidade\/macedo-reis-dashboards@([0-9a-f]{40})\/supabase\/functions\/reforma-chat\/servidor\.js/.exec(idx);
chk('index.ts importa o servidor do repositório num commit fixado', !!m);
const ARQS = ['supabase/functions/reforma-chat/servidor.js', 'supabase/functions/reforma-chat/agente.js', 'supabase/functions/reforma-chat/ferramentas.js', 'supabase/functions/reforma-chat/prompt.js',
  'supabase/functions/reforma-chat/busca.js', 'assets/js/rt-motor.js', 'assets/js/rt-confianca.js', 'assets/js/dominio-relatorios.js', 'assets/js/utils.js'];
if (m) {
  const atrasados = ARQS.filter(a => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
  });
  chk('o código que a função roda é o daqui (servidor, agente, ferramentas, prompt, busca e a conta da ficha)', atrasados.length === 0,
    'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função reforma-chat');
}
const fonteSrv = readFileSync(raiz + 'supabase/functions/reforma-chat/servidor.js', 'utf8');
chk('a função não lê credenciais do cadastro', !/credenciais/.test(fonteSrv) && !/credenciais/.test(readFileSync(raiz + 'supabase/functions/reforma-chat/ferramentas.js', 'utf8')));

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
