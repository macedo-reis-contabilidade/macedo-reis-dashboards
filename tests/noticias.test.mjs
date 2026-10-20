// O feed de notícias (supabase/functions/noticias, 20/10/2026): a leitura do RSS/Atom e da página, a carteira em texto e
// os critérios da IA virando clientes, a classificação da IA conferida, a coleta com um banco falso e o "pra mim" da tela
// (assets/js/noticias.js). Notícias e empresas inventadas. Rodar com: node tests/noticias.test.mjs
import { lerFeed, lerListaHtml, semTags, decodificar, dataIso, linkLimpo } from '../supabase/functions/noticias/rss.js';
import { textoDaPagina } from '../supabase/functions/noticias/pagina.js';
import { montarClientes, perfilDaCarteira, clientesDosCriterios, cnaeDe } from '../supabase/functions/noticias/perfil.js';
import { lerClassificacao, mensagemDaNoticia, montarSistema, criarChamador } from '../supabase/functions/noticias/triagem.js';
import { decodificarCorpo, feedsAnunciados, coletarFontes, triarPendentes, ehArquivo, melhorQue } from '../supabase/functions/noticias/coleta.js';
import { SOCIOS as SOCIOS_FUNCAO } from '../supabase/functions/noticias/servidor.js';
import { SOCIOS } from '../assets/js/equipe.js';
import * as tela from '../assets/js/noticias.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

console.log('O RSS e o Atom:');
{
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Fonte</title>
    <item><title><![CDATA[STF decide sobre a contribuição &amp; o Funrural]]></title><link>https://exemplo.gov.br/noticias/funrural</link>
      <pubDate>Mon, 19 Oct 2026 22:10:00 -0300</pubDate><description>&lt;p&gt;O plenário &lt;b&gt;decidiu&lt;/b&gt; que a cobrança&amp;nbsp;é…&lt;/p&gt;</description></item>
    <item><title>Sem link</title></item>
    <item><title>Relativo</title><link>/noticias/relativo</link><dc:date>2026-10-18T10:00:00Z</dc:date></item>
    <item><title>Repetido</title><link>https://exemplo.gov.br/noticias/funrural</link></item>
  </channel></rss>`;
  const f = lerFeed(rss, { base: 'https://exemplo.gov.br/' });
  chk('RSS 2.0: os itens com título e link (sem o sem-link e o repetido)', f.tipo === 'rss' && f.itens.length === 2, JSON.stringify(f.itens.map(i => i.titulo)));
  chk('o CDATA e a entidade no título', f.itens[0].titulo === 'STF decide sobre a contribuição & o Funrural', f.itens[0].titulo);
  chk('a data RFC 822 em ISO', f.itens[0].data === '2026-10-20T01:10:00.000Z', f.itens[0].data);
  chk('o HTML codificado da descrição vira texto', f.itens[0].trecho === 'O plenário decidiu que a cobrança é…'.replace(' ', ' '), JSON.stringify(f.itens[0].trecho));
  chk('o link relativo vira absoluto pela base, e o dc:date vale', f.itens[1].link === 'https://exemplo.gov.br/noticias/relativo' && f.itens[1].data === '2026-10-18T10:00:00.000Z');
  const rdf = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel rdf:about="https://www.gov.br/x/RSS"><title>Notícias</title></channel>
    <item rdf:about="https://www.gov.br/x/noticias/2026/outubro/prazo-da-dctfweb"><title>Prazo da DCTFWeb muda</title><description>A Receita alterou…</description><dc:date>2026-10-19T15:30:00-03:00</dc:date></item>
  </rdf:RDF>`;
  const g = lerFeed(rdf);
  chk('RSS 1.0 (o dos portais gov.br): o link pelo rdf:about', g.tipo === 'rdf' && g.itens[0].link === 'https://www.gov.br/x/noticias/2026/outubro/prazo-da-dctfweb' && g.itens[0].data === '2026-10-19T18:30:00.000Z', JSON.stringify(g.itens[0]));
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title><entry><title type="html">Nova regra do eSocial</title>
    <link rel="self" href="https://a.com/self"/><link rel="alternate" href="https://a.com/esocial"/><updated>2026-10-17T12:00:00Z</updated><summary>Resumo.</summary></entry></feed>`;
  const a = lerFeed(atom);
  chk('Atom: o link alternate, a data e o resumo', a.tipo === 'atom' && a.itens[0].link === 'https://a.com/esocial' && a.itens[0].data === '2026-10-17T12:00:00.000Z' && a.itens[0].trecho === 'Resumo.', JSON.stringify(a.itens[0]));
  chk('o que não é RSS: nenhum item', lerFeed('<html><body>oi</body></html>').tipo === null);
  chk('link só http(s)', linkLimpo('javascript:alert(1)') === null && linkLimpo('ftp://x.com/a') === null && linkLimpo('https://x.com/a') === 'https://x.com/a');
  chk('entidades numéricas e nomeadas', decodificar('&#231;&#xE3;o &ccedil; &lt;b&gt;') === 'ção ç <b>');
  chk('sem marcas, sem script', semTags('<p>Um<script>alert(1)</script> <b>dois</b></p><p>três</p>') === 'Um dois\ntrês');
  chk('data brasileira (dd/mm/aaaa hh:mm) no fuso de Brasília', dataIso('19/10/2026 22:10') === '2026-10-20T01:10:00.000Z', dataIso('19/10/2026 22:10'));
  const lista = lerListaHtml('<a href="/noticias/stf-funrural_519899.html">STF reconhece inconstitucionalidade de cobrança do Funrural</a><a href="/cotacoes">Cotações</a><a href="/noticias/x_1.html">Curta</a>',
    { base: 'https://www.agro.exemplo/', padrao: '/noticias/.+_\\d+\\.html$' });
  chk('página sem RSS: os links de notícia pelo padrão (o curto e o de fora do padrão ficam de fora)', lista.length === 1 && lista[0].link === 'https://www.agro.exemplo/noticias/stf-funrural_519899.html', JSON.stringify(lista));
  const avisos = lerListaHtml('<a href="/19-10-2026-atencao-aos-emissores-de-contranota-de-produtor-rural">19/10/2026 - Aten&ccedil;&atilde;o aos emissores de contranota de produtor rural</a><a href="/icms">ICMS</a>',
    { base: 'https://receita.exemplo.rs.gov.br/inicial', padrao: '^https://receita\\.exemplo\\.rs\\.gov\\.br/\\d{2}-\\d{2}-\\d{4}-' });
  chk('o aviso que começa com a data: a data vira a do item, o título sem ela, as entidades decodificadas', avisos.length === 1 && avisos[0].titulo === 'Atenção aos emissores de contranota de produtor rural'
    && avisos[0].data === '2026-10-19T15:00:00.000Z', JSON.stringify(avisos));
}

console.log('A página da notícia:');
{
  const html = `<html><head><title>Notícia - Portal</title><meta property="og:title" content="STF decide sobre o Funrural"><meta name="description" content="Decisão do plenário.">
    <meta property="article:published_time" content="2026-10-19T20:00:00-03:00"><script>var x = "<p>não</p>"</script><style>p{}</style></head>
    <body><nav><p>Menu menu menu menu menu menu menu menu menu menu menu</p></nav><article><h1>STF decide</h1>
    <p>O Supremo Tribunal Federal decidiu nesta segunda-feira que a contribuição ao Funrural do empregador rural pessoa física…</p>
    <p>Compartilhe</p><p>A decisão vale para os processos em andamento e alcança as empresas que compram a produção rural.</p></article>
    <footer><p>Rodapé rodapé rodapé rodapé rodapé rodapé rodapé rodapé rodapé</p></footer></body></html>`;
  const p = textoDaPagina(html);
  chk('o título pelo og:title, a descrição e a data', p.titulo === 'STF decide sobre o Funrural' && p.descricao === 'Decisão do plenário.' && p.data === '2026-10-19T23:00:00.000Z', JSON.stringify([p.titulo, p.descricao, p.data]));
  chk('os parágrafos do <article>, sem menu, script, rodapé e o "Compartilhe"', p.texto.startsWith('O Supremo Tribunal Federal') && p.texto.includes('compram a produção rural') && !/Menu|Rodapé|Compartilhe|não/.test(p.texto), JSON.stringify(p.texto));
  chk('o texto longo é cortado', textoDaPagina('<body><p>' + 'palavra '.repeat(2000) + '</p></body>', { max: 500 }).texto.length <= 501);
  // o portal com "leia também" e "mais lidas" em volta do texto (o que confundia a leitura da Contábeis e da Fenacon)
  const rel = n => '<article class="card"><h3><a href="/x' + n + '">Notícia relacionada número ' + n + ' sobre outro assunto qualquer</a></h3><p>Resumo curto da relacionada ' + n + '.</p></article>';
  const portal = '<body><div class="lista">' + [1, 2, 3, 4, 5, 6].map(rel).join('') + '</div>' + '<div style="x">' + 'x'.repeat(3500) + '</div>'
    + '<div class="materia"><h2>Repouso semanal</h2><p>A Emenda Constitucional 141 prevê dois dias de repouso remunerado por semana, sem redução de salário.</p>'
    + '<div class="anuncio">' + 'a'.repeat(800) + '</div><p>A jornada máxima cai para 40 horas semanais, com implementação gradual prevista no texto.</p>'
    + '<p>Os acordos coletivos terão regras próprias de transição para os contratos em vigor.</p></div>'
    + '<ul class="mais-lidas">' + [1, 2, 3].map(n => '<li><a href="/m' + n + '">Mais lida número ' + n + ' do portal de notícias</a></li>').join('') + '</ul></body>';
  const pp = textoDaPagina(portal);
  chk('o maior bloco de parágrafos é a notícia (sem as relacionadas e as mais lidas)', pp.texto.startsWith('A Emenda Constitucional 141') && pp.texto.includes('acordos coletivos') && !/relacionada|Mais lida/.test(pp.texto), JSON.stringify(pp.texto));
}

console.log('A carteira e os critérios:');
const CARTEIRA = montarClientes({
  clientes: [
    { id: 'a', nome_principal: 'PADARIA TESTE LTDA', regime_tributario: 'Simples Nacional', cidade: 'Três Coroas', uf: 'RS', cnae_principal: '1091-1/02 - Fabricação de produtos de panificação', cnaes_secundarios: ['4721-1/02 - Padaria e confeitaria com predominância de revenda'], natureza_juridica: 'Sociedade Empresária Limitada' },
    { id: 'b', nome_principal: 'RESTAURANTE TESTE', regime_tributario: 'Simples Nacional', cidade: 'Gramado', uf: 'RS', cnae_principal: '5611-2/01 - Restaurantes e similares', cnaes_secundarios: [], natureza_juridica: 'Empresário (Individual)' },
    { id: 'c', nome_principal: 'FULANO MEI', regime_tributario: 'MEI', cidade: 'Igrejinha', uf: 'RS', cnae_principal: '9602-5/01 - Cabeleireiros, manicure e pedicure', cnaes_secundarios: null, natureza_juridica: 'Empresário (Individual)' },
    { id: 'd', nome_principal: 'SITIO TESTE', regime_tributario: 'Lucro Presumido', cidade: 'Três Coroas', uf: 'RS', cnae_principal: '0151-2/01 - Criação de bovinos para corte', cnaes_secundarios: ['1011-2/01 - Frigorífico - abate de bovinos'], natureza_juridica: 'Sociedade Empresária Limitada' }
  ],
  obrigacoes: [{ cliente_id: 'a', nome: 'SEDIF/DESTDA - SIMPLES NACIONAL' }, { cliente_id: 'a', nome: 'PGDAS' }, { cliente_id: 'b', nome: 'PGDAS' }, { cliente_id: 'd', nome: 'EFD REINF - MENSAL' }],
  rotinasDp: [{ cliente_id: 'a', nome: '13° SALÁRIO 1° PARCELA (NOVEMBRO)' }, { cliente_id: 'b', nome: 'CÁLCULO PRÓ LABORE, ENVIO ESOCIAL E EMISSÃO GUIA' }]
});
{
  chk('o CNAE com a descrição: código e rótulo', JSON.stringify(cnaeDe('1091-1/02 - Fabricação de produtos de panificação')) === JSON.stringify({ codigo: '1091102', rotulo: '1091-1/02 Fabricação de produtos de panificação' }));
  chk('folha (13º) e pró-labore pelas tarefas recorrentes do DP', CARTEIRA[0].funcionarios && !CARTEIRA[0].prolabore && CARTEIRA[1].prolabore && !CARTEIRA[1].funcionarios);
  const perfil = perfilDaCarteira(CARTEIRA);
  chk('o retrato: regimes, cidades, folha, CNAE e obrigações, sem nome de cliente', perfil.includes('Simples Nacional 2') && perfil.includes('Três Coroas/RS 2') && perfil.includes('1 clientes com funcionários')
    && perfil.includes('- 5611-2/01 Restaurantes e similares: 1') && perfil.includes('1011-2/01 Frigorífico') && perfil.includes('- SEDIF/DESTDA - SIMPLES NACIONAL: 1') && !/PADARIA TESTE|FULANO/.test(perfil), perfil);
  const ids = c => clientesDosCriterios(c, CARTEIRA).join(',');
  chk('sem critério nenhum: ninguém', ids({}) === '' && ids(null) === '');
  chk('todos: a carteira inteira', ids({ todos: true }) === 'a,b,c,d');
  chk('regime', ids({ regimes: ['MEI'] }) === 'c' && ids({ todos: true, regimes: ['simples nacional'] }) === 'a,b');
  chk('CNAE pelo prefixo, no principal ou no secundário (o frigorífico do sítio)', ids({ cnaes: ['01', '1011'] }) === 'd' && ids({ cnaes: ['10'] }) === 'a,d' && ids({ cnaes: ['47211'] }) === 'a');
  chk('cidade sem acento e com a UF', ids({ cidades: ['Tres Coroas/RS'] }) === 'a,d');
  chk('obrigação por trecho do nome', ids({ obrigacoes: ['destda'] }) === 'a' && ids({ obrigacoes: ['PGDAS'] }) === 'a,b');
  chk('folha e pró-labore', ids({ com_funcionarios: true }) === 'a' && ids({ com_prolabore: true }) === 'b');
  chk('entre os critérios, todos ao mesmo tempo', ids({ regimes: ['Simples Nacional'], cidades: ['Gramado'] }) === 'b' && ids({ regimes: ['MEI'], obrigacoes: ['PGDAS'] }) === '');
  chk('natureza jurídica por trecho', ids({ naturezas: ['individual'] }) === 'b,c');
  chk('trecho curto demais de obrigação não vale (não casa com tudo)', ids({ obrigacoes: ['S'] }) === '');
}

console.log('A classificação da IA:');
{
  const resp = { content: [{ type: 'tool_use', name: 'classificar', input: { relevante: true, relevancia: 'alta', setores: ['fiscal', 'xpto', 'fiscal'], resumo: '  O STF decidiu…  ', por_que: 'Alcança 1 cliente.',
    acao: 'Avisar.', criterios: { cnaes: ['01', '10.11', 'abc'], regimes: ['Lucro Presumido'], com_funcionarios: 'sim' } } }], usage: { input_tokens: 10 } };
  const c = lerClassificacao(resp);
  chk('a classificação conferida: setor desconhecido e repetido saem, CNAE só dígitos, booleano só true', c.relevante && c.relevancia === 'alta' && JSON.stringify(c.setores) === '["fiscal"]'
    && JSON.stringify(c.criterios.cnaes) === '["01","1011"]' && c.criterios.com_funcionarios === false && c.resumo === 'O STF decidiu…', JSON.stringify(c));
  const d = lerClassificacao({ content: [{ type: 'tool_use', name: 'classificar', input: { relevante: false, relevancia: 'alta', setores: ['dp'], resumo: 'Agenda do ministro.', criterios: { todos: true } } }] });
  chk('descartada: sem relevância, setor, critério', !d.relevante && d.relevancia === null && !d.setores.length && d.criterios === null && d.resumo === 'Agenda do ministro.');
  let erro = null; try { lerClassificacao({ content: [{ type: 'text', text: 'oi' }] }); } catch (e) { erro = e; }
  chk('sem a ferramenta: erro (não grava nada inventado)', erro && erro.tipo === 'formato');
  const sis = montarSistema('PERFIL');
  chk('o sistema leva o retrato, com cache de 1 hora', sis.length === 1 && sis[0].text.endsWith('Retrato da carteira hoje:\nPERFIL') && sis[0].cache_control.ttl === '1h');
  const msg = mensagemDaNoticia({ titulo: 'T', fonte: 'STF', tipoFonte: 'tribunal', publicada_em: '2026-10-19T23:00:00Z', link: 'https://x', trecho: 'tr', pagina: { descricao: 'desc', texto: 'corpo' } });
  chk('a mensagem: fonte, data em dd/mm/aaaa, título, endereço, trecho, descrição e texto', msg === 'Fonte: STF (tribunal)\nPublicada: 19/10/2026\nTítulo: T\nEndereço: https://x\nTrecho do RSS: tr\nDescrição da página: desc\nTexto da página: corpo\n\nNotícias que já estão no feed: nenhuma.', msg);
  const msg2 = mensagemDaNoticia({ titulo: 'T', fonte: 'F', publicada_em: null, link: 'https://x' }, [{ titulo: 'Fim da escala 6x1', fonte: 'Fenacon', data: '2026-10-19T12:00:00Z' }, { titulo: 'Sem fonte', data: null }]);
  chk('a mensagem leva as que já estão no feed, numeradas (pra mesma_que)', msg2.endsWith('Notícias que já estão no feed (pra mesma_que):\n[1] Fim da escala 6x1 — Fenacon, 19/10/2026\n[2] Sem fonte, sem data'), msg2);
  const comMesma = q => lerClassificacao({ content: [{ type: 'tool_use', name: 'classificar', input: { relevante: true, relevancia: 'media', resumo: 'x', mesma_que: q } }] }, 2).mesma_que;
  chk('mesma_que: só o número de uma das que foram na mensagem', comMesma(2) === 2 && comMesma('1') === 1 && comMesma(3) === null && comMesma(0) === null && comMesma(1.5) === null && comMesma(undefined) === null);
  chk('descartada não entra em grupo', lerClassificacao({ content: [{ type: 'tool_use', name: 'classificar', input: { relevante: false, resumo: 'x', mesma_que: 1 } }] }, 2).mesma_que === null);
}

console.log('O chamador da API:');
{
  const pedidos = [];
  const respostas = [{ status: 404, body: 'not found' }, { status: 529, body: 'overloaded' }, { status: 200, body: { content: [] } }];
  const fake = async (url, op) => { pedidos.push(JSON.parse(op.body).model); const r = respostas.shift(); return { ok: r.status === 200, status: r.status, json: async () => r.body, text: async () => String(r.body), headers: { get: () => null } }; };
  const chamar = criarChamador({ fetch: fake, chave: 'k', modelos: ['m1', 'm2'], esperar: async () => {} });
  const j = await chamar({ max_tokens: 10 });
  chk('modelo que não existe passa pro próximo; sobrecarga espera e tenta de novo', JSON.stringify(pedidos) === '["m1","m2","m2"]' && j._modelo === 'm2', JSON.stringify(pedidos));
}

console.log('A coleta com um banco falso:');
// banco falso mínimo: o que a coleta usa do supabase-js (from/select/eq/in/lt/not/order/limit/upsert/update/maybeSingle)
function bancoFalso(tabelas) {
  const t = tabelas;
  const q = nome => {
    const st = { filtros: [], op: 'select', payload: null, opcoes: {}, head: false, count: null, lim: null };
    const linhas = () => (t[nome] = t[nome] || []);
    const passa = r => st.filtros.every(([op, c, v]) => op === 'eq' ? r[c] === v : op === 'in' ? v.includes(r[c]) : op === 'lt' ? (r[c] != null && r[c] < v)
      : op === 'gte' ? (r[c] != null && r[c] >= v) : op === 'is' ? (v === null ? r[c] == null : r[c] === v) : op === 'notnull' ? r[c] != null : true);
    const exec = () => {
      if (st.op === 'upsert') {
        const novos = [];
        for (const p of st.payload) { if (linhas().some(r => r[st.opcoes.onConflict] === p[st.opcoes.onConflict])) continue; const r = { id: 'n' + (linhas().length + 1), situacao: 'nova', tentativas: 0, ...p }; linhas().push(r); novos.push({ id: r.id }); }
        return { data: novos, error: null };
      }
      if (st.op === 'update') { const alvo = linhas().filter(passa); alvo.forEach(r => Object.assign(r, st.payload)); return { data: alvo.map(r => ({ id: r.id })), error: null }; }
      let rs = linhas().filter(passa);
      if (st.lim != null) rs = rs.slice(0, st.lim);
      return st.head ? { count: rs.length, data: null, error: null } : { data: rs.map(r => ({ ...r })), error: null, count: rs.length };
    };
    const b = {
      select(_c, o) { if (o && o.head) st.head = true; return b; },
      eq(c, v) { st.filtros.push(['eq', c, v]); return b; }, in(c, v) { st.filtros.push(['in', c, v]); return b; },
      lt(c, v) { st.filtros.push(['lt', c, v]); return b; }, not(c) { st.filtros.push(['notnull', c]); return b; },
      gte(c, v) { st.filtros.push(['gte', c, v]); return b; }, is(c, v) { st.filtros.push(['is', c, v]); return b; },
      order() { return b; }, limit(n) { st.lim = n; return b; },
      upsert(p, o) { st.op = 'upsert'; st.payload = p; st.opcoes = o || {}; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; },
      maybeSingle() { const r = exec(); return Promise.resolve({ data: (r.data || [])[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
    };
    return b;
  };
  return { from: q, tabelas: t };
}
{
  const agora = Date.parse('2026-10-20T03:00:00Z');
  const db = bancoFalso({
    noticias_fontes: [{ id: 'f1', nome: 'Fonte Um', url: 'https://um.exemplo/rss', tipo: 'oficial', formato: 'rss', ativo: true }, { id: 'f2', nome: 'Fonte Dois', url: 'https://dois.exemplo/rss', tipo: 'imprensa', formato: 'rss', ativo: true }],
    noticias: [{ id: 'n0', url: 'https://um.exemplo/ja-tinha', titulo: 'Já tinha', situacao: 'triada', tentativas: 1 }]
  });
  const RSS = `<rss><channel><item><title>Nova do DeSTDA</title><link>https://um.exemplo/destda</link><pubDate>Mon, 19 Oct 2026 10:00:00 -0300</pubDate></item>
    <item><title>Já tinha</title><link>https://um.exemplo/ja-tinha</link><pubDate>Mon, 19 Oct 2026 09:00:00 -0300</pubDate></item>
    <item><title>Velha demais</title><link>https://um.exemplo/velha</link><pubDate>Mon, 01 Sep 2026 09:00:00 -0300</pubDate></item></channel></rss>`;
  const resposta = (status, corpo, tipo = 'application/rss+xml') => ({ ok: status === 200, status, url: '', headers: { get: () => tipo }, arrayBuffer: async () => new TextEncoder().encode(corpo).buffer });
  const fetchFalso = async url => url === 'https://um.exemplo/rss' ? resposta(200, RSS) : url === 'https://dois.exemplo/rss' ? resposta(500, 'erro') : resposta(200, '<html><body><p>' + 'A Receita Estadual mudou o prazo do DeSTDA para as empresas do Simples. '.repeat(3) + '</p></body></html>', 'text/html; charset=utf-8');
  const r = await coletarFontes({ db, fetch: fetchFalso, agora: () => agora });
  chk('grava só a nova dos últimos 7 dias (a que já tinha e a velha ficam de fora)', r.novas === 1 && db.tabelas.noticias.length === 2 && db.tabelas.noticias[1].url === 'https://um.exemplo/destda', JSON.stringify(r));
  const f1 = db.tabelas.noticias_fontes[0], f2 = db.tabelas.noticias_fontes[1];
  // o filtro da fonte de muito volume: só o que bate entra
  db.tabelas.noticias_fontes[1].ativo = false;
  db.tabelas.noticias_fontes.push({ id: 'f3', nome: 'Agro', url: 'https://agro.exemplo/rss', tipo: 'imprensa', formato: 'rss', ativo: true, filtro: 'funrural|tribut' });
  const RSS3 = '<rss><channel><item><title>Cotação da soja sobe</title><link>https://agro.exemplo/soja</link><pubDate>Mon, 19 Oct 2026 10:00:00 -0300</pubDate></item>'
    + '<item><title>STF decide sobre o Funrural</title><link>https://agro.exemplo/funrural</link><pubDate>Mon, 19 Oct 2026 11:00:00 -0300</pubDate></item></channel></rss>';
  const rf = await coletarFontes({ db, fetch: async url => url === 'https://agro.exemplo/rss' ? resposta(200, RSS3) : fetchFalso(url), agora: () => agora });
  chk('fonte com filtro: só a do Funrural entra (a da soja nem vai pra triagem)', rf.novas === 1 && db.tabelas.noticias.some(n => n.url === 'https://agro.exemplo/funrural') && !db.tabelas.noticias.some(n => n.url === 'https://agro.exemplo/soja'), JSON.stringify(rf));
  db.tabelas.noticias = db.tabelas.noticias.filter(n => n.url !== 'https://agro.exemplo/funrural');
  // o RSS geral dos portais gov.br: os arquivos (imagem, PDF anexado, folha de estilo) e a agenda ficam de fora
  db.tabelas.noticias_fontes.push({ id: 'f4', nome: 'Ministério', url: 'https://gov.exemplo/RSS', tipo: 'oficial', formato: 'rss', ativo: true, filtro: '^(?!agenda d[eo] )' });
  const RSS4 = '<rss><channel>'
    + ['https://gov.exemplo/noticias/pec-da-jornada|Congresso promulga PEC da jornada de trabalho', 'https://gov.exemplo/imagens/esocial-full.png|esocial-full.png',
      'https://gov.exemplo/arquivos/curriculo|Cirruculo LUANA.pdf', 'https://gov.exemplo/doc/regras.html|regras.html', 'https://gov.exemplo/agenda/fulano|Agenda de Fulano de Tal para 20/10/2026']
      .map(x => '<item><title>' + x.split('|')[1] + '</title><link>' + x.split('|')[0] + '</link><pubDate>Mon, 19 Oct 2026 11:00:00 -0300</pubDate></item>').join('') + '</channel></rss>';
  const rg = await coletarFontes({ db, fetch: async url => url === 'https://gov.exemplo/RSS' ? resposta(200, RSS4) : fetchFalso(url), agora: () => agora });
  chk('RSS geral do gov.br: só a notícia (o arquivo pelo endereço ou pelo título, e a agenda pelo filtro, ficam de fora)',
    rg.novas === 1 && db.tabelas.noticias.some(n => n.url === 'https://gov.exemplo/noticias/pec-da-jornada') && !db.tabelas.noticias.some(n => /gov\.exemplo\/(imagens|arquivos|doc|agenda)/.test(n.url)), JSON.stringify(rg));
  chk('arquivo × página: o endereço .html da notícia continua notícia', !ehArquivo({ link: 'https://www.agro.exemplo/noticias/stf-funrural_519899.html', titulo: 'STF reconhece inconstitucionalidade do Funrural' })
    && ehArquivo({ link: 'https://x.gov.br/a/Relatorio.PDF', titulo: 'Relatório de Efetividade' }) && !ehArquivo({ link: 'https://x.gov.br/a/norma', titulo: 'Receita publica a norma sobre o arquivo do SPED em formato .txt e outras mudanças no leiaute' }));
  chk('o endereço do gov.br que termina em ".jpg/view" é arquivo; o PDF de norma (portaria) entra, o relatório em PDF não',
    ehArquivo({ link: 'https://www.gov.br/fazenda/pt-br/imagens/noticias/continuidade-infracional.jpg/view', titulo: 'Continuidade infracional no âmbito do CRSNSP.jpg' })
    && !ehArquivo({ link: 'https://www.gov.br/trabalho-e-emprego/pt-br/sst-portarias/portaria-mte-no-1-758-altera-a-nr-28.pdf/view', titulo: 'Portaria MTE nº 1.758 (Altera a NR-28).pdf' })
    && ehArquivo({ link: 'https://www.gov.br/trabalho-e-emprego/pt-br/pnmpo/relatorio-de-efetividade-pnmpo-2025.pdf/view', titulo: 'Relatório de Efetividade PNMPO 2025.pdf' }));
  db.tabelas.noticias = db.tabelas.noticias.filter(n => n.url !== 'https://gov.exemplo/noticias/pec-da-jornada');
  db.tabelas.noticias_fontes.pop();
  db.tabelas.noticias_fontes[1].ativo = true; db.tabelas.noticias_fontes.pop();
  chk('a fonte que respondeu fica com o "último ok"; a que falhou, com o erro', f1.ultimo_ok && f1.itens_ultima === 2 && !f1.ultimo_erro && f2.ultimo_erro === 'HTTP 500' && !f2.ultimo_ok, JSON.stringify([f1, f2]));
  // a triagem: a carteira do banco falso + a IA falsa
  Object.assign(db.tabelas, {
    carteira_info: [{ cliente_id: 'a', entrada: '2026-01-01', saida: null }, { cliente_id: 'b', entrada: '2026-01-01', saida: '2026-05-01' }],
    clientes: [{ id: 'a', nome_principal: 'PADARIA', regime_tributario: 'Simples Nacional', cidade: 'Três Coroas', cnae_principal: '1091-1/02 - Panificação' }, { id: 'b', nome_principal: 'SAIU', regime_tributario: 'Simples Nacional', cidade: 'Três Coroas' }],
    cliente_obrigacoes: [{ cliente_id: 'a', obrigacao_id: 'o1', ativo: true }], obrigacoes_fiscais: [{ id: 'o1', nome: 'SEDIF/DESTDA - SIMPLES NACIONAL' }], tarefas_recorrentes: [], rotinas_modelo: []
  });
  const vistos = [];
  const chamar = async corpo => { vistos.push(corpo); return { _modelo: 'm', usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: 'tool_use', name: 'classificar',
    input: { relevante: true, relevancia: 'alta', setores: ['fiscal'], resumo: 'Mudou o prazo do DeSTDA.', por_que: 'Os clientes com DeSTDA.', acao: 'Conferir o calendário.', criterios: { obrigacoes: ['DESTDA'] } } }] }; };
  const t = await triarPendentes({ db, fetch: fetchFalso, chamar, agora: () => agora, ate: agora + 120000 });
  const n = db.tabelas.noticias[1];
  chk('triada: a classificação gravada e os clientes pelo critério (só os da carteira de hoje)', t.triadas === 1 && n.situacao === 'triada' && n.relevancia === 'alta' && JSON.stringify(n.clientes) === '["a"]'
    && n.resumo === 'Mudou o prazo do DeSTDA.' && n.tentativas === 1 && n.triada_em && n.modelo === 'm' && n.tokens_entrada === 100, JSON.stringify(n));
  chk('a IA recebeu o retrato (sem nome de cliente) e o texto da página', vistos.length === 1 && vistos[0].system[0].text.includes('SEDIF/DESTDA') && !vistos[0].system[0].text.includes('PADARIA')
    && vistos[0].messages[0].content.includes('A Receita Estadual mudou o prazo do DeSTDA'), vistos[0] && vistos[0].messages[0].content.slice(0, 300));
  chk('a que já foi triada não volta pra IA', (await triarPendentes({ db, fetch: fetchFalso, chamar, agora: () => agora, ate: agora + 120000 })).triadas === 0 && vistos.length === 1);
  // erro da IA: volta pra fila com o erro, até 3 tentativas
  db.tabelas.noticias.push({ id: 'n9', url: 'https://um.exemplo/outra', titulo: 'Outra', situacao: 'nova', tentativas: 0, publicada_em: '2026-10-19T12:00:00Z' });
  const falha = async () => { throw new Error('API 500'); };
  const e1 = await triarPendentes({ db, fetch: fetchFalso, chamar: falha, agora: () => agora, ate: agora + 120000 });
  const n9 = db.tabelas.noticias.find(x => x.id === 'n9');
  chk('erro da IA: a notícia fica com o erro, pra tentar de novo', e1.erros === 1 && n9.situacao === 'erro' && n9.erro === 'API 500' && n9.tentativas === 1, JSON.stringify(n9));
  n9.tentativas = 3;
  chk('depois de 3 tentativas, sai da fila', (await triarPendentes({ db, fetch: fetchFalso, chamar: falha, agora: () => agora, ate: agora + 120000 })).erros === 0);
  // sem prazo: não começa outra
  n9.tentativas = 0;
  const semPrazo = await triarPendentes({ db, fetch: fetchFalso, chamar, agora: () => agora, ate: agora + 10000 });
  chk('sem prazo pra mais uma, fica pra próxima coleta', semPrazo.puladas === 1 && n9.situacao === 'erro');
  n9.tentativas = 3;

  // a mesma notícia em outra fonte: o grupo
  const principalDestda = db.tabelas.noticias.find(x => x.url === 'https://um.exemplo/destda');
  db.tabelas.noticias_fontes.push({ id: 'f5', nome: 'Imprensa', url: 'https://imp.exemplo/rss', tipo: 'imprensa', formato: 'rss', ativo: false });
  const nova = (id, titulo, fonte_id) => ({ id, url: 'https://imp.exemplo/' + id, titulo, fonte_id, situacao: 'nova', tentativas: 0, publicada_em: '2026-10-19T13:00:00Z' });
  // a IA falsa: a relevância pedida e o mesma_que pelo título da principal, procurado na lista numerada da mensagem
  const iaGrupo = (relevancia, titulo) => async corpo => {
    const m = titulo ? new RegExp('\\[(\\d+)\\] ' + titulo).exec(corpo.messages[0].content) : null;
    return { _modelo: 'm', usage: {}, content: [{ type: 'tool_use', name: 'classificar', input: { relevante: true, relevancia, setores: ['fiscal'], resumo: 'r', mesma_que: m ? Number(m[1]) : undefined } }] };
  };
  db.tabelas.noticias.push(nova('g1', 'DeSTDA tem novo prazo', 'f5'));
  const vistosG = [];
  const g = await triarPendentes({ db, fetch: fetchFalso, chamar: async c => { vistosG.push(c); return iaGrupo('media', 'Nova do DeSTDA')(c); }, agora: () => agora, ate: agora + 120000 });
  const g1 = db.tabelas.noticias.find(x => x.id === 'g1');
  chk('a mesma notícia de outra fonte, menos importante: entra no grupo da principal', g.agrupadas === 1 && g1.situacao === 'triada' && g1.grupo === principalDestda.id
    && vistosG[0].messages[0].content.includes('[1] Nova do DeSTDA — Fonte Um, 19/10/2026'), JSON.stringify({ g, g1, msg: vistosG[0] && vistosG[0].messages[0].content.slice(-200) }));
  // mais importante: vira a principal e leva o grupo; com a mesma importância, a da fonte oficial vira a principal e fica com o triada_em da antiga
  db.tabelas.noticias.push({ id: 'p1', url: 'https://imp.exemplo/p1', titulo: 'Projeto do MEI avança', fonte_id: 'f5', situacao: 'triada', relevancia: 'media', triada_em: new Date(agora - 3600e3).toISOString(), grupo: null },
    { id: 'd1', url: 'https://imp.exemplo/d1', titulo: 'Projeto do MEI avança (outra)', fonte_id: 'f5', situacao: 'triada', relevancia: 'media', triada_em: new Date(agora - 1800e3).toISOString(), grupo: 'p1' },
    nova('g2', 'MEI: projeto aprovado muda o limite', 'f5'));
  await triarPendentes({ db, fetch: fetchFalso, chamar: iaGrupo('alta', 'Projeto do MEI avança'), agora: () => agora, ate: agora + 120000 });
  const [p1, d1, g2] = ['p1', 'd1', 'g2'].map(id => db.tabelas.noticias.find(x => x.id === id));
  chk('mais importante: a nova vira a principal e leva o grupo (e conta como nova: o triada_em é o de agora)', g2.grupo === null && p1.grupo === 'g2' && d1.grupo === 'g2' && g2.triada_em === new Date(agora).toISOString(), JSON.stringify([p1, d1, g2]));
  db.tabelas.noticias.push({ id: 'p2', url: 'https://imp.exemplo/p2', titulo: 'Receita muda o MAT', fonte_id: 'f5', situacao: 'triada', relevancia: 'media', triada_em: '2026-10-19T20:00:00.000Z', grupo: null },
    { ...nova('g3', 'Receita Federal implanta o novo MAT', 'f1'), url: 'https://um.exemplo/g3' });
  await triarPendentes({ db, fetch: fetchFalso, chamar: iaGrupo('media', 'Receita muda o MAT'), agora: () => agora, ate: agora + 120000 });
  const [p2, g3] = ['p2', 'g3'].map(id => db.tabelas.noticias.find(x => x.id === id));
  chk('mesma importância, da fonte oficial: vira a principal sem voltar a ser "nova"', g3.grupo === null && p2.grupo === 'g3' && g3.triada_em === '2026-10-19T20:00:00.000Z', JSON.stringify([p2, g3]));
  chk('melhorQue: importância primeiro, depois a fonte oficial', melhorQue({ relevancia: 'alta', tipo: 'imprensa' }, { relevancia: 'media', tipo: 'oficial' }) === 'importancia'
    && melhorQue({ relevancia: 'media', tipo: 'imprensa' }, { relevancia: 'alta', tipo: 'imprensa' }) === null && melhorQue({ relevancia: 'media', tipo: 'oficial' }, { relevancia: 'media', tipo: 'oficial' }) === null);
}

console.log('O corpo e os RSS anunciados:');
{
  const latin = new Uint8Array([0x3c, 0x61, 0x3e, 0xe7, 0xe3, 0x6f, 0x3c, 0x2f, 0x61, 0x3e]);   // <a>ção</a> em ISO-8859-1
  chk('o charset do cabeçalho (ISO-8859-1)', decodificarCorpo(latin, 'text/html; charset=ISO-8859-1') === '<a>ção</a>');
  chk('o charset da declaração XML', decodificarCorpo(new Uint8Array([...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?>'), 0xe7]), '') .endsWith('ç'));
  const anun = feedsAnunciados('<link rel="alternate" type="application/rss+xml" href="/feed/"><link rel="stylesheet" href="/a.css"><link type="application/atom+xml" rel="alternate" href="https://x.com/atom">', 'https://x.com/noticias');
  chk('os RSS que a página anuncia', JSON.stringify(anun) === '["https://x.com/feed/","https://x.com/atom"]', JSON.stringify(anun));
}

console.log('A tela (assets/js/noticias.js):');
{
  const T = '2026-10-20T12:00:00.000Z', agora = Date.parse(T);
  const n = (id, o = {}) => ({ id, situacao: 'triada', relevancia: 'alta', setores: ['fiscal'], titulo: 'Notícia ' + id, triada_em: '2026-10-20T10:00:00Z', publicada_em: '2026-10-19T10:00:00Z', clientes: [], ...o });
  chk('os sócios veem todos os setores; o DP, o fiscal e o contábil, o seu', tela.setoresDe('financeiro@macedoereis.com.br') === null && tela.setoresDe('DIEGO@macedoereis.com.br') === null
    && JSON.stringify(tela.setoresDe('rh@macedoereis.com.br')) === '["dp"]' && JSON.stringify(tela.setoresDe('fiscal@macedoereis.com.br')) === '["fiscal"]'
    && JSON.stringify(tela.setoresDe('contabil@macedoereis.com.br')) === '["contabil"]' && tela.setoresDe('novo@macedoereis.com.br') === null);
  chk('"pra mim": do meu setor, Importante ou Vale saber, triada', tela.paraMim(n(1), 'fiscal@macedoereis.com.br') && !tela.paraMim(n(1), 'rh@macedoereis.com.br')
    && tela.paraMim(n(1), 'diego@macedoereis.com.br') && !tela.paraMim(n(2, { relevancia: 'baixa' }), 'fiscal@macedoereis.com.br')
    && !tela.paraMim(n(3, { situacao: 'descartada' }), 'financeiro@macedoereis.com.br') && tela.paraMim(n(4, { setores: ['dp', 'fiscal'], relevancia: 'media' }), 'rh@macedoereis.com.br'));
  const lista = [n('a'), n('b', { triada_em: '2026-10-18T10:00:00Z' }), n('c', { setores: ['dp'] }), n('semana', { publicada_em: '2026-10-14T10:00:00Z' })];
  chk('novas: triadas depois do meu "visto"', JSON.stringify(tela.novasPraMim(lista, 'fiscal@macedoereis.com.br', '2026-10-19T00:00:00Z', agora).map(x => x.id)) === '["a"]'
    && tela.novasPraMim(lista, 'financeiro@macedoereis.com.br', '2026-10-17T00:00:00Z', agora).length === 3);
  chk('a publicada há mais de 3 dias não chega como nova (a semana que a primeira coleta trouxe)', !tela.novasPraMim(lista, 'financeiro@macedoereis.com.br', '2026-10-01T00:00:00Z', agora).some(x => x.id === 'semana'));
  chk('sem "visto" ainda: os últimos 3 dias', tela.vistoPadrao(agora) === '2026-10-17T12:00:00.000Z');
  const av = tela.paraAvisar([n('x'), n('velha', { publicada_em: '2026-10-10T10:00:00Z' }), n('media', { relevancia: 'media' }), n('ja', {})], 'fiscal@macedoereis.com.br', '2026-10-19T00:00:00Z', ['ja'], agora);
  chk('o recado: só a Importante nova e recente que esta máquina ainda não avisou', JSON.stringify(av.map(x => x.id)) === '["x"]', JSON.stringify(av.map(x => x.id)));
  const g = tela.agrupar([n('p', { publicada_em: '2026-10-19T12:00:00Z' }), n('d1', { grupo: 'p', publicada_em: '2026-10-19T15:00:00Z' }), n('d2', { grupo: 'd1' }), n('solta', { grupo: 'nao-veio' }), n('q', { publicada_em: '2026-10-18T10:00:00Z' })]);
  chk('o grupo: só a principal, com as outras em "também" (a corrente vai até a raiz; a que aponta pra fora fica sozinha)', JSON.stringify(g.map(x => x.id)) === '["p","solta","q"]'
    && JSON.stringify(g[0].tambem.map(x => x.id).sort()) === '["d1","d2"]' && !g[1].tambem.length, JSON.stringify(g.map(x => [x.id, x.tambem.map(t => t.id)])));
  const comGrupo = tela.cartaoHtml({ ...g[0], fonte: { nome: 'Receita' }, tambem: [{ ...g[0].tambem[0], url: 'https://contabeis.exemplo/x', fonte: { nome: 'Contábeis' } }, { id: 'z', url: 'javascript:x', fonte: { nome: 'Ruim' } }] });
  chk('"Também em": as outras fontes com link (só http/https)', comGrupo.includes('Também em: <a href="https://contabeis.exemplo/x"') && comGrupo.includes('>Contábeis</a>') && !comGrupo.includes('Ruim'));
  chk('o dia por extenso no separador', tela.rotuloDoDia(new Date(2026, 9, 16, 9).toISOString(), new Date(2026, 9, 20, 9)) === 'Sexta-feira, 16 de outubro'
    && tela.rotuloDoDia(new Date(2026, 9, 20, 1).toISOString(), new Date(2026, 9, 20, 9)) === 'Hoje' && tela.rotuloDoDia(new Date(2026, 9, 19, 23).toISOString(), new Date(2026, 9, 20, 9)) === 'Ontem');
  const html = tela.cartaoHtml(n('<i>', { titulo: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)', resumo: 'A & B', por_que: '<b>x</b>', clientes: ['k1', 'k2', 'k3'], fonte: { nome: 'Fonte <s>' } }), { agora: new Date(T) });
  chk('o cartão escapa o que vem de fora e não faz link que não é http(s)', !/<img|<b>x|<s>|<i>/.test(html) && html.includes('&lt;img src=x onerror=alert(1)&gt;') && !/href="javascript/.test(html) && html.includes('A &amp; B'));
  chk('o cartão diz quantos clientes a notícia alcança', html.includes('Alcança 3 clientes da carteira') && tela.cartaoHtml(n('u', { clientes: [] })).includes('Nenhum cliente em particular'));
  chk('o link da notícia abre em outra aba', tela.cartaoHtml(n('l', { url: 'https://www.gov.br/x' })).includes('href="https://www.gov.br/x" target="_blank" rel="noopener noreferrer"'));
  const hoje = new Date(2026, 9, 20, 15, 0);
  chk('a data curta: hoje com a hora, ontem, dd/mm e o ano quando é outro', tela.dataCurta(new Date(2026, 9, 20, 9, 5).toISOString(), hoje) === 'hoje, 09:05' && tela.dataCurta(new Date(2026, 9, 19, 23, 0).toISOString(), hoje) === 'ontem'
    && tela.dataCurta(new Date(2026, 9, 3, 8, 0).toISOString(), hoje) === '03/10' && tela.dataCurta(new Date(2025, 11, 31, 8, 0).toISOString(), hoje) === '31/12/2025');
  chk('a ordem: a publicação mais nova primeiro (sem data, a da coleta)', JSON.stringify(tela.ordenar([n('p1', { publicada_em: '2026-10-01T00:00:00Z' }), n('p2', { publicada_em: null, coletada_em: '2026-10-19T00:00:00Z' }), n('p3', { publicada_em: '2026-10-18T00:00:00Z' })]).map(x => x.id)) === '["p2","p3","p1"]');
}

console.log('A função:');
chk('os sócios da função são os de assets/js/equipe.js', JSON.stringify(SOCIOS_FUNCAO) === JSON.stringify(SOCIOS));
{
  const raiz = new URL('..', import.meta.url).pathname;
  const idx = readFileSync(raiz + 'supabase/functions/noticias/index.ts', 'utf8');
  const m = /raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/supabase\/functions\/noticias\/servidor\.js/.exec(idx);
  chk('index.ts importa o servidor do repositório num commit fixado', !!m);
  const vistos = new Set(), fila = ['supabase/functions/noticias/servidor.js'];
  while (fila.length) {
    const a = fila.shift();
    if (vistos.has(a)) continue;
    vistos.add(a);
    for (const im of readFileSync(raiz + a, 'utf8').matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) fila.push(posix.normalize(posix.join(posix.dirname(a), im[1])));
  }
  const ARQS = [...vistos];
  chk('a trava segue os imports da função', ['coleta.js', 'triagem.js', 'perfil.js', 'pagina.js', 'rss.js'].every(x => ARQS.includes('supabase/functions/noticias/' + x)), ARQS.join(', '));
  if (m) {
    const atrasados = ARQS.filter(a => {
      let noCommit = null;
      try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch { noCommit = null; }
      return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
    });
    chk('o código que a função roda é o daqui', atrasados.length === 0,
      'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função noticias');
  }
  const codigo = a => readFileSync(raiz + a, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  chk('a coleta não lê credenciais do cadastro', ARQS.every(a => !/credenciais/.test(codigo(a))));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
