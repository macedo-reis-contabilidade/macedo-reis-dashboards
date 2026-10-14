// CNAE vindo da Receita (BrasilAPI) no cadastro de clientes (13/10/2026): a API manda o código como número, e a subclasse
// 0121-1/01 chega 121101, sem o zero da frente. O cadastro gravava "121101 - Horticultura…" (só formatava com 7 dígitos).
// O formatador vive dentro dos módulos de clientes/index.html (lote "Puxar dados da Receita") e clientes/editar.html
// (botão "Receita Federal" da atualização cadastral): o teste lê a linha de cada um e roda os dois.
// Rodar com: node tests/cnae-receita.test.mjs — códigos de exemplo da tabela CNAE, nada de cliente.
import fs from 'fs';

let falhas = 0;
const ok = (cond, rotulo) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + rotulo); };

function formatador(arquivo, nome) {
  const src = fs.readFileSync(new URL('../' + arquivo, import.meta.url), 'utf8');
  const m = src.match(new RegExp('const ' + nome + ' = (c => \\{[^\\n]*\\});'));
  if (!m) throw new Error(nome + ' não encontrado em ' + arquivo);
  return new Function('return ' + m[1] + ';')();
}

for (const [arquivo, nome] of [['clientes/index.html', 'fmtCnaeCod'], ['clientes/editar.html', 'fmtCnae']]) {
  console.log(arquivo + ' · ' + nome + ':');
  const f = formatador(arquivo, nome);
  ok(f(121101) === '0121-1/01', 'número de 6 dígitos ganha o zero: 121101 → 0121-1/01');
  ok(f('121101') === '0121-1/01', 'texto de 6 dígitos também: "121101" → 0121-1/01');
  ok(f(4711302) === '4711-3/02', '7 dígitos como antes: 4711302 → 4711-3/02');
  ok(f('4711-3/02') === '4711-3/02', 'já formatado não muda: 4711-3/02');
  ok(f('0121-1/01') === '0121-1/01', 'já formatado com o zero não muda: 0121-1/01');
  ok(f(9999) === '9999', 'código fora do padrão (4 dígitos) sai como veio');
  ok(f(null) === '' && f(undefined) === '', 'vazio sai vazio');
}

// os CNAEs secundários da BrasilAPI vêm como [{ codigo: número, descricao }]: o mesmo formatador, item a item
{
  const f = formatador('clientes/index.html', 'fmtCnaeCod');
  const lista = [{ codigo: 121101, descricao: 'Horticultura, exceto morango' }, { codigo: 4711302, descricao: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados' }]
    .filter(x => x && x.codigo).map(x => `${f(x.codigo)}${x.descricao ? ' - ' + x.descricao : ''}`);
  ok(lista[0] === '0121-1/01 - Horticultura, exceto morango' && lista[1].startsWith('4711-3/02 - '), 'secundários: código com o zero + descrição');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
