// Os modelos de IA que as funções chamam e o que vai pra IA (28/10/2026). A Anthropic aposenta modelos: depois da data,
// a API responde que o modelo não existe e a tela que depende dele para. A Análise fiscal ficou assim de 15/06 a 28/10/2026
// (o claude-sonnet-4-20250514 foi aposentado e ninguém viu). Este teste confere que nenhuma função chama modelo aposentado
// (ou que se aposenta em menos de um mês da data da lista) e que a Análise fiscal não manda credenciais nem documentos
// pessoais pra IA. Rodar com: node tests/modelos-ia.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const raiz = fileURLToPath(new URL('../', import.meta.url));
const pasta = raiz + 'supabase/functions/';
const ler = p => readFileSync(raiz + p, 'utf8').replace(/\r\n/g, '\n');

// Da página de aposentadorias da Anthropic (platform.claude.com/docs/en/about-claude/model-deprecations, lida em
// 28/10/2026). Modelo novo aposentado entra aqui; o de "aposenta em" vira falha um mês antes da data.
const APOSENTADOS = ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus', 'claude-3-haiku', 'claude-3-sonnet'];
const APOSENTA_EM = { 'claude-sonnet-4-5-20250929': '2026-11-30' };
const hoje = new Date().toISOString().slice(0, 10);
const umMesAntes = d => new Date(Date.parse(d + 'T00:00:00Z') - 31 * 86400000).toISOString().slice(0, 10);

const usados = [];
for (const f of readdirSync(pasta)) {
  let arqs = [];
  try { arqs = readdirSync(pasta + f).filter(a => /\.(ts|js)$/.test(a)); } catch (e) { continue; }
  for (const a of arqs) {
    const s = ler('supabase/functions/' + f + '/' + a);
    for (const m of s.matchAll(/["'](claude-[a-z0-9.-]+)["']/g)) usados.push({ onde: f + '/' + a, modelo: m[1] });
  }
}
chk('as funções chamam algum modelo (a lista foi lida)', usados.length >= 4, usados.length);
const velhos = usados.filter(u => APOSENTADOS.some(v => u.modelo.startsWith(v)));
chk('nenhuma função chama modelo aposentado', !velhos.length, velhos.map(v => v.onde + ': ' + v.modelo).join(', '));
const quase = usados.filter(u => APOSENTA_EM[u.modelo] && hoje >= umMesAntes(APOSENTA_EM[u.modelo]));
chk('nenhuma função chama modelo que se aposenta em menos de um mês', !quase.length, quase.map(v => v.onde + ': ' + v.modelo + ' (' + APOSENTA_EM[v.modelo] + ')').join(', '));

// A Análise fiscal: a tela pede ao banco só o cadastro da empresa e a função tira o que nunca vai pra IA
const tela = ler('fiscal-analise.html');
const sel = /from\('clientes'\)\s*\.select\('([^']*)'\)/.exec(tela);
chk('a Análise fiscal lê do cadastro só as colunas da empresa (sem select de tudo)', sel && sel[1] !== '*' && !/credenciais|\brg\b|data_nascimento/.test(sel[1]), sel && sel[1]);
const fn = ler('supabase/functions/analise-fiscal/index.ts');
const nunca = /const NUNCA_PRA_IA = \[([^\]]*)\]/.exec(fn);
chk('a função da Análise fiscal tira as credenciais e os documentos pessoais antes de chamar a IA',
  nunca && ['credenciais', 'rg', 'data_nascimento'].every(k => nunca[1].includes('"' + k + '"')) && /semSensiveis\(await req\.json\(\)\)/.test(fn));
{
  // a regra da limpeza, rodada aqui (a mesma função do arquivo, sem os tipos do TypeScript)
  const corpo = /function semSensiveis\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(fn);
  const lista = nunca ? JSON.parse('[' + nunca[1] + ']') : [];
  const semSensiveis = corpo ? new Function('NUNCA_PRA_IA', 'entrada', corpo[1].replace(/ as Record<string, unknown>/g, '')).bind(null, lista) : null;
  const saida = semSensiveis ? semSensiveis({ cliente_id: 'x', cnpj: '1', credenciais: 'senha', dados_cadastrais_completos: { nome_principal: 'A', credenciais: 'senha', rg: '9', cidade: 'Três Coroas' } }) : null;
  chk('a limpeza tira as credenciais do pedido e do cadastro e deixa o resto',
    saida && !('credenciais' in saida) && !('credenciais' in saida.dados_cadastrais_completos) && !('rg' in saida.dados_cadastrais_completos)
      && saida.dados_cadastrais_completos.cidade === 'Três Coroas' && saida.cliente_id === 'x' && saida.cnpj === '1', JSON.stringify(saida));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
