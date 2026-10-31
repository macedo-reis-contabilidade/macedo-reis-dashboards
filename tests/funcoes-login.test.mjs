// Quem pode chamar as Edge Functions (24/10/2026). O verify_jwt sozinho deixa passar a chave anônima, que é pública (está
// nas páginas e neste repositório): a função interna que não confere o login de quem chama atende qualquer um na
// internet — com o Drive do escritório, a chave da IA e o banco com a chave de servidor. Este teste confere que cada
// função do supabase/functions ou é uma das abertas de propósito (com a trava dela) ou começa pela conferência
// `quemChama` (só quem entrou com e-mail do escritório, ou o servidor), igual em todas, antes de ler o pedido — e que ela
// funciona. Rodar com: node tests/funcoes-login.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const raiz = fileURLToPath(new URL('../', import.meta.url));
const pasta = raiz + 'supabase/functions/';
// as quebras de linha do Windows (CRLF, o git do PC do escritório) viram LF: o recorte da quemChama procura '\n}\n'
const ler = (f, a) => readFileSync(pasta + f + '/' + a, 'utf8').replace(/\r\n/g, '\n');
const arquivos = f => readdirSync(pasta + f).filter(a => /\.(ts|js)$/.test(a));
const tudo = f => arquivos(f).map(a => ler(f, a)).join('\n');

// as abertas de propósito, cada uma com a trava que tem
const ABERTAS = {
  'admissao-link': ['o link público das admissões (sem login), com a trava de envios por hora', s => /hora/i.test(s)],
  'rescisao-link': ['o link público das rescisões (sem login), com a trava de envios por hora', s => /hora/i.test(s)],
  'ca-sync': ['o sincronismo do Conta Azul: a chave x-sync-key', s => /x-sync-key/.test(s)],
  'ca-consulta': ['a consulta ao Conta Azul: a chave x-sync-key', s => /x-sync-key/.test(s)],
  'ca-oauth': ['o retorno da autorização do Conta Azul: o state guardado no banco', s => /ca_oauth_state/.test(s)],
  'noticias': ['o feed: a chave do pg_cron ou um sócio logado', s => /x-chave/.test(s) && /auth\/v1\/user/.test(s)],
  'ponte': ['a ponte do PC do escritório: a impressão digital da chave dela', s => /x-chave/.test(s) && /ponte_chave_sha256/.test(s)],
  'assistente': ['o assistente: confere o login (e o domínio) por conta própria', s => /auth\/v1\/user/.test(s) && /@macedoereis\.com\.br/.test(s)],
  'reforma-chat': ['o chat da Reforma: confere o login (e o domínio) por conta própria', s => /auth\/v1\/user/.test(s) && /@macedoereis\.com\.br/.test(s)],
  // 31/10/2026: lança vendas no Conta Azul — só os sócios (o login conferido no Auth e a lista SOCIOS); a consulta também
  // com a chave do sincronismo (a do ca-sync, que só o servidor lê)
  'ca-vendas': ['as vendas no Conta Azul: confere o login (só os sócios) por conta própria', s => /auth\/v1\/user/.test(s) && /@macedoereis\.com\.br/.test(s) && /SOCIOS\.includes\(quem\)/.test(s) && /x-sync-key/.test(s)],
  // desligada em 24/10/2026: responde 410 pra todos e não pode voltar a ter Drive, banco ou segredo sem a conferência
  'create-drive-folder': ['desligada: responde 410 pra todos, sem Drive, banco nem segredo', s => /status: 410/.test(s) && !/googleapis|createClient|Deno\.env|fetch\(/.test(s)]
};

const funcoes = readdirSync(pasta).filter(f => statSync(pasta + f).isDirectory());
console.log('Cada função ou é aberta de propósito, com a trava dela, ou confere o login:');
const comGuarda = [];
for (const f of funcoes) {
  const s = tudo(f);
  if (ABERTAS[f]) {
    chk(f + ' — ' + ABERTAS[f][0], ABERTAS[f][1](s));
    continue;
  }
  const arq = arquivos(f).find(a => /async function quemChama\(/.test(ler(f, a)));
  if (!arq) { chk(f + ' — confere quem chama', false, 'sem a quemChama: qualquer um com a chave pública chamaria esta função'); continue; }
  const src = ler(f, arq);
  const chamada = src.indexOf('await quemChama(req)');
  const opcoes = src.search(/req\.method === ["']OPTIONS["']/);
  const corpo = src.search(/req\.json\(\)/);
  chk(f + ' — confere quem chama antes de ler o pedido (e depois do OPTIONS, que o navegador manda sem login)',
    chamada > 0 && opcoes >= 0 && opcoes < chamada && (corpo < 0 || chamada < corpo), `OPTIONS ${opcoes}, quemChama ${chamada}, req.json ${corpo}`);
  chk(f + ' — quem não passa recebe 401', /await quemChama\(req\)\)\)\s*(?:\{\s*)?return new Response\([^;]*status: 401/.test(src.replace(/\n/g, ' ')));
  comGuarda.push([f, src]);
}

console.log('A conferência é a mesma em todas:');
const extrair = s => { const i = s.indexOf('async function quemChama('); const j = s.indexOf('\n}\n', i); return s.slice(i, j + 2); };
const guardas = comGuarda.map(([f, s]) => [f, extrair(s)]);
chk('o mesmo texto nas ' + guardas.length + ' funções', guardas.length > 0 && guardas.every(([, g]) => g === guardas[0][1]),
  guardas.filter(([, g]) => g !== guardas[0][1]).map(([f]) => f).join(', '));

console.log('E funciona:');
const js = guardas[0][1].replace('(req: Request): Promise<string | null>', '(req)');
const ENV = { SUPABASE_URL: 'https://projeto.supabase.co', SUPABASE_ANON_KEY: 'chave-anonima', SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servidor' };
const montar = responder => {
  const pedidos = [];
  const fetchFalso = async (url, op) => { pedidos.push({ url, op }); return responder(url, op); };
  const quemChama = new Function('Deno', 'fetch', js + '\nreturn quemChama;')({ env: { get: k => ENV[k] } }, fetchFalso);
  return { quemChama, pedidos };
};
const req = auth => ({ headers: { get: k => (k.toLowerCase() === 'authorization' ? auth : null) } });
const resp = (status, corpo) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
{
  const { quemChama, pedidos } = montar(() => resp(200, { email: 'Fulana@MacedoEReis.com.br' }));
  chk('sem o cabeçalho: ninguém', (await quemChama(req(null))) === null && pedidos.length === 0);
  chk('quem entrou com e-mail do escritório passa (o e-mail em minúscula)', (await quemChama(req('Bearer token-da-fulana'))) === 'fulana@macedoereis.com.br');
  chk('a pergunta vai pro Auth do projeto, com a chave anônima e o token de quem chama',
    pedidos[0].url === 'https://projeto.supabase.co/auth/v1/user' && pedidos[0].op.headers.apikey === 'chave-anonima' && pedidos[0].op.headers.Authorization === 'Bearer token-da-fulana');
  chk('o "bearer" em minúscula também vale', (await quemChama(req('bearer token-da-fulana'))) === 'fulana@macedoereis.com.br');
  chk('a chave de servidor (o próprio sistema) passa sem perguntar ao Auth', (await quemChama(req('Bearer chave-de-servidor'))) === 'servidor' && pedidos.length === 2);
}
{
  const { quemChama } = montar(() => resp(403, { msg: 'invalid claim: missing sub claim' }));
  chk('a chave anônima (que é pública) não passa: o Auth não acha usuário', (await quemChama(req('Bearer chave-anonima'))) === null);
}
{
  const { quemChama } = montar(() => resp(200, { email: 'alguem@gmail.com' }));
  chk('login de fora do escritório não passa', (await quemChama(req('Bearer token-de-fora'))) === null);
}
{
  const { quemChama } = montar(() => resp(200, { email: 'alguem@macedoereis.com.br.golpe.com' }));
  chk('e-mail que só contém o domínio no meio não passa', (await quemChama(req('Bearer token-de-fora'))) === null);
}
{
  const { quemChama } = montar(() => { throw new Error('rede fora'); });
  chk('o Auth fora do ar: ninguém passa (não abre a porta)', (await quemChama(req('Bearer token-da-fulana'))) === null);
}
{
  const { quemChama } = montar(() => ({ ok: true, status: 200, json: async () => { throw new Error('não é JSON'); } }));
  chk('resposta estranha do Auth: ninguém passa', (await quemChama(req('Bearer token-da-fulana'))) === null);
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
