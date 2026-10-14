// Assistente de canto de tela (assets/js/assistente.js): os auxiliares puros — a resposta em HTML seguro (com as fontes
// de quem chama), a leitura dos eventos da função (texto, JSON e o Response em pedaços, com acento partido no meio),
// a frase de erro pelo código, o "perguntar" de uma Edge Function (inclusive a conexão caindo no meio), a conversa
// guardada na aba conferida campo a campo e a primeira frase do recado. O balão, o recado e o painel têm teste de tela em
// tests/harness/reforma-chat.py.
// Rodar com: node tests/assistente.test.mjs
import { escapeHtml, textoParaHtml, lerEventos, mensagemDoErro, perguntarFuncao, lerEstado, primeiraFrase } from '../assets/js/assistente.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

console.log('Texto → HTML:');
chk('escapa tudo', escapeHtml('<a href="x">\'&') === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
const h1 = textoParaHtml('Primeira **frase**.\n\n- item um\n- item dois\n1. passo\n### Título\nlinha <script>alert(1)</script>');
chk('parágrafo, negrito, lista, lista numerada e título em negrito', h1 === '<p>Primeira <b>frase</b>.</p><ul><li>item um</li><li>item dois</li></ul><ol><li>passo</li></ol><p><b>Título</b></p><p>linha &lt;script&gt;alert(1)&lt;/script&gt;</p>', h1);
const vistos = [];
const h2 = textoParaHtml('Veja [LEI-1, art. 2] e [nada aqui] e [<b>x</b>].', { fontes: d => { vistos.push(d); return d.startsWith('LEI-1') ? '<a class="fonte">LEI-1</a>' + d.slice(5) : null; } });
chk('as fontes de quem chama: o conteúdo do colchete chega escapado; null deixa como estava', h2 === '<p>Veja [<a class="fonte">LEI-1</a>, art. 2] e [nada aqui] e [&lt;b&gt;x&lt;/b&gt;].</p>' && vistos.includes('&lt;b&gt;x&lt;/b&gt;'), h2);
chk('sem "fontes", o colchete fica como está', textoParaHtml('[REGRA-X]') === '<p>[REGRA-X]</p>');

console.log('Eventos da função:');
const ev = o => 'data: ' + JSON.stringify(o) + '\n\n';
const corpoSse = ev({ tipo: 'etapa', texto: 'Lendo a ação — seção 2' }) + ev({ tipo: 'resposta', texto: 'Pronto: é isenção.', fontes: [{ codigo: 'A' }], cortada: true });
let lidos = [];
await lerEventos(corpoSse, e => lidos.push(e));
chk('texto inteiro dos eventos', lidos.length === 2 && lidos[0].tipo === 'etapa' && lidos[1].texto === 'Pronto: é isenção.' && lidos[1].cortada === true);
lidos = [];
const bytes = new TextEncoder().encode(corpoSse);
const emPedacos = new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 5) c.enqueue(bytes.slice(i, i + 5)); c.close(); } }));
await lerEventos(emPedacos, e => lidos.push(e));
chk('o Response em pedaços de 5 bytes (acento partido no meio)', lidos.length === 2 && lidos[0].texto === 'Lendo a ação — seção 2' && lidos[1].texto === 'Pronto: é isenção.', JSON.stringify(lidos));
lidos = [];
await lerEventos({ resposta: 'Sem fluxo.', fontes: [] }, e => lidos.push(e));
chk('JSON de quem não pediu fluxo', lidos.length === 1 && lidos[0].tipo === 'resposta' && lidos[0].texto === 'Sem fluxo.');
lidos = [];
await lerEventos('data: {quebrado\n\n' + ev({ tipo: 'etapa', texto: 'ok' }), e => lidos.push(e));
chk('linha quebrada é ignorada', lidos.length === 1 && lidos[0].texto === 'ok');

console.log('Erros:');
chk('a mensagem da função quando ela manda', await mensagemDoErro({ context: new Response(JSON.stringify({ erro: 'Você chegou ao limite.' }), { status: 429 }) }) === 'Você chegou ao limite.');
chk('401 sem texto: a sessão expirou', /Sua sessão expirou/.test(await mensagemDoErro({ context: new Response('', { status: 401 }) })));
chk('504 do gateway: demorou ou fora do ar', /demorou demais ou está fora do ar/.test(await mensagemDoErro({ context: new Response('<html>', { status: 504 }) })));
chk('outro código: diz qual', /código 418/.test(await mensagemDoErro({ context: new Response('', { status: 418 }) })));
chk('sem resposta nenhuma: confira a internet', /Confira a internet/.test(await mensagemDoErro({ message: 'Failed to fetch' })));

console.log('Perguntar a uma Edge Function:');
const pedidos = [];
const falso = resposta => ({ functions: { invoke: async (nome, o) => { pedidos.push({ nome, body: o.body }); return resposta; } } });
const etapas = [];
const r = await perguntarFuncao(falso({ data: corpoSse, error: null }), 'reforma-chat')({ pergunta: 'Isenta?', historico: [], conversa: 'c1', contexto: {} }, e => etapas.push(e));
chk('manda a pergunta com "fluxo", repassa as etapas e devolve texto, fontes e corte', pedidos[0].nome === 'reforma-chat' && pedidos[0].body.fluxo === true && pedidos[0].body.pergunta === 'Isenta?'
  && etapas.join() === 'Lendo a ação — seção 2' && r.texto === 'Pronto: é isenção.' && r.fontes.length === 1 && r.cortada === true);
const erroDe = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };
chk('evento de erro vira exceção com a frase da função', await erroDe(() => perguntarFuncao(falso({ data: ev({ tipo: 'erro', texto: 'O serviço está cheio.' }), error: null }), 'f')({})) === 'O serviço está cheio.');
chk('sem resposta no fim: avisa', /não devolveu resposta/.test(await erroDe(() => perguntarFuncao(falso({ data: ev({ tipo: 'etapa', texto: 'x' }), error: null }), 'f')({}))));
chk('erro do supabase-js: a frase pelo código', /Sua sessão expirou/.test(await erroDe(() => perguntarFuncao(falso({ data: null, error: { context: new Response('', { status: 401 }) } }), 'f')({}))));
const rede = await erroDe(() => perguntarFuncao({ functions: { invoke: async () => { throw new Error('Failed to fetch'); } } }, 'f')({}));
chk('falha de rede: em português, sem o detalhe técnico', /^Não consegui falar com o assistente\. Confira a internet/.test(rede) && !/fetch/i.test(rede), rede);
// o Response que quebra no meio: depois de mandar o que já tinha, a leitura dá erro
const quebrado = texto => { const b = new TextEncoder().encode(texto); let n = 0;
  return new Response(new ReadableStream({ pull(c) { if (n++ === 0) c.enqueue(b); else c.error(new TypeError('network error')); } })); };
const caiu = await erroDe(() => perguntarFuncao(falso({ data: quebrado(ev({ tipo: 'etapa', texto: 'Lendo' })), error: null }), 'f')({}));
chk('a conexão cai no meio, antes da resposta: avisa em português', caiu === 'A conexão caiu no meio da resposta. Tente de novo.', caiu);
const r2 = await perguntarFuncao(falso({ data: quebrado(ev({ tipo: 'resposta', texto: 'Chegou inteira.', fontes: [] })), error: null }), 'f')({});
chk('a conexão cai depois da resposta: a resposta vale', r2.texto === 'Chegou inteira.');
chk('a conexão cai depois de um evento de erro: a frase da função', await erroDe(() => perguntarFuncao(falso({ data: quebrado(ev({ tipo: 'erro', texto: 'Limite do dia.' })), error: null }), 'f')({})) === 'Limite do dia.');

console.log('Conversa guardada na aba:');
const valido = { v: 1, conversa: '6f1c2b0e-1d2a-4c3b-8e9f-0a1b2c3d4e5f', aberto: true, largo: false, naoLidas: 2, recadoVisto: true, recadoContextoVisto: false,
  msgs: [{ tipo: 'nota', texto: 'Sobre a ficha de X', em: '2026-10-14T12:00:00Z', ctxId: 'k1' }, { tipo: 'eu', texto: 'Pergunta?', em: '2026-10-14T12:00:00Z', ctxId: 'k1' },
    { tipo: 'ia', texto: 'Resposta.', etapas: ['Lendo A'], em: '2026-10-14T12:00:05Z', ctxId: 'k1' }],
  historico: [{ pergunta: 'Pergunta?', resposta: 'Resposta.', ctxId: 'k1' }] };
const lido = lerEstado(JSON.stringify(valido));
// comparação sem depender da ordem das chaves
const canon = x => Array.isArray(x) ? '[' + x.map(canon).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}' : JSON.stringify(x);
chk('a guardada no formato volta igual', canon(lido) === canon({ ...valido, msgs: valido.msgs.map(m => ({ ...m, etapas: m.etapas || [] })) }), JSON.stringify(lido));
chk('fora do formato (JSON quebrado, lista, sem versão, versão antiga): começa do zero',
  [null, '', '{quebrado', '[1,2]', '"texto"', '{"msgs":[]}', '{"v":2,"msgs":[]}'].every(t => lerEstado(t) === null));
const sujo = lerEstado(JSON.stringify({ v: 1, conversa: 7, msgs: [null, 5, { tipo: 'eu', texto: 9 }, { tipo: 'outro', texto: 'x' }, { tipo: 'ia', texto: 'ok', etapas: 'x', ctxId: { a: 1 } }],
  historico: { a: 1 }, naoLidas: 'abc', aberto: 'sim' }));
chk('campos estranhos são descartados um a um (a tela segue com o que presta)', sujo && sujo.msgs.length === 1 && sujo.msgs[0].texto === 'ok' && sujo.msgs[0].etapas.length === 0
  && sujo.msgs[0].ctxId === null && sujo.historico.length === 0 && sujo.naoLidas === 0 && sujo.aberto === false && sujo.conversa === null, JSON.stringify(sujo));
chk('msgs e historico que não são lista viram lista vazia', (() => { const e = lerEstado('{"v":1,"msgs":"x","historico":"y"}'); return e && e.msgs.length === 0 && e.historico.length === 0; })());

console.log('Primeira frase (recado "Respondi" e leitor de tela):');
const f1 = primeiraFrase('Não: é **isenção**, não alíquota zero [TST-LEI, art. 157] · [regra X]. Depois.');
chk('sem as fontes, o separador entre elas e o espaço antes do ponto', f1 === 'Não: é isenção, não alíquota zero.', f1);
const fCurta = primeiraFrase('Sim [regra A; B-1, art. 2]. Depois vem mais.');
chk('frase curta demais leva a seguinte junto', fCurta === 'Sim. Depois vem mais.', fCurta);
const f2 = primeiraFrase('A opção vale para 2027 inteiro [regra PRAZO]. O cancelamento segue outra regra.');
chk('a primeira frase inteira, sem o colchete', f2 === 'A opção vale para 2027 inteiro.', f2);
const f3 = primeiraFrase('x'.repeat(300));
chk('texto sem ponto: corta com reticências', f3.length === 138 && f3.endsWith('…'), f3.length);

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
