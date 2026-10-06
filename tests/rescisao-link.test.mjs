// Edge Function rescisao-link: o bloco "empresa pelo nome" é cópia do admissao-link (as duas Edge Functions sobem
// separadas, sem pasta compartilhada). Este teste garante que a regra continua igual nas duas — mudou numa, muda na outra.
// Rodar com: node tests/rescisao-link.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0;
const chk = (nome, cond) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome); };

// pedaços de código de nível de arquivo: cada um começa numa linha sem recuo (const/let/function/comentário/import)
function pedacos(arquivo) {
  const mapa = new Map();
  let atual = null;
  for (const linha of readFileSync(raiz + arquivo, 'utf8').split('\n')) {
    if (/^(const |let |async function |function |\/\/|import |Deno\.serve)/.test(linha)) {
      atual = linha.startsWith('//') ? null : [linha];
      if (atual) mapa.set(linha.match(/^(?:const|let|async function|function)\s+(\w+)/)?.[1] || linha, atual);
      continue;
    }
    if (atual) atual.push(linha);
  }
  return new Map([...mapa].map(([k, v]) => [k, v.join('\n').trimEnd()]));
}

const adm = pedacos('supabase/functions/admissao-link/index.ts');
const res = pedacos('supabase/functions/rescisao-link/index.ts');
console.log('Empresa pelo nome igual nas duas funções:');
for (const nome of ['normNome', 'limpaNome', 'txt', 'SUFIXOS', 'chaveNome', 'acharCliente']) {
  chk(nome, adm.has(nome) && res.has(nome) && adm.get(nome) === res.get(nome));
}

console.log('Segurança do link:');
const fonte = readFileSync(raiz + 'supabase/functions/rescisao-link/index.ts', 'utf8');
chk('grava com a chave de servidor só dentro da função', /SUPABASE_SERVICE_ROLE_KEY/.test(fonte));
chk('trava de envios por hora', /ENVIOS_HORA = 30/.test(fonte) && /Muitos envios/.test(fonte));
chk('não devolve dado do cadastro pra quem envia (sem cliente_id na resposta)', !/return \{ ok: true[^}]*cliente/.test(fonte));
const pagina = readFileSync(raiz + 'rescisao.html', 'utf8');
chk('rescisao.html fala só com a função (sem .from() do banco)', /functions\.invoke/.test(pagina) && !/supabase\.from\(/.test(pagina));
chk('rescisao.html não importa o auth-guard', !/auth-guard/.test(pagina));

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
