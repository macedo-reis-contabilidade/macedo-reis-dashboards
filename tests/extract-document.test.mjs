// A leitura de documentos (Edge Function extract-document, supabase/functions/extract-document/): a conferência do quadro de
// sócios do modo cadastro (quadro.js, 21/10/2026 — a leitura de uma alteração com saída de sócio punha como sócio quem
// tinha vendido todas as cotas no próprio ato), o que o prompt pede e a trava do commit fixado. Nomes e CPFs inventados.
// Rodar com: node tests/extract-document.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { conferirQuadro, mesmaPessoa, nomeChave } from '../supabase/functions/extract-document/quadro.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const raiz = new URL('../', import.meta.url).pathname;
const nomes = d => (d.socios || []).map(s => s.nome).join(', ');

console.log('A conferência do quadro de sócios:');
// a leitura antiga: o sócio que vendeu tudo vinha em socios, com participação zero e "Sócio retirante"
let d = conferirQuadro({ socios: [
  { nome: 'ANA LIMA SOUZA', cpf: '11111111111', participacao_percentual: 100, eh_administrador: true },
  { nome: 'BRUNO COSTA', cpf: '22222222222', participacao_percentual: 0, qualificacao: 'Sócio retirante' }], socios_retirantes: null, confianca: 'alta', observacoes_extracao: null });
chk('quem a leitura marcou como de saída (participação zero, "Sócio retirante") vai pra lista de quem saiu', nomes(d) === 'ANA LIMA SOUZA'
  && d.socios_retirantes.length === 1 && d.socios_retirantes[0].nome === 'BRUNO COSTA' && d.socios_retirantes[0].motivo === 'Sócio retirante'
  && /tirado da lista de sócios/.test(d.observacoes_extracao) && d.confianca === 'alta', JSON.stringify(d));
d = conferirQuadro({ socios: [{ nome: 'ANA LIMA SOUZA', cpf: '11111111111', participacao_percentual: 100 }],
  socios_retirantes: [{ nome: 'BRUNO COSTA', cpf: '22222222222', motivo: 'vendeu todas as cotas a ANA LIMA SOUZA' }], confianca: 'alta', observacoes_extracao: null });
chk('a leitura certa passa como veio, sem aviso', nomes(d) === 'ANA LIMA SOUZA' && d.socios_retirantes[0].motivo === 'vendeu todas as cotas a ANA LIMA SOUZA' && d.observacoes_extracao === null);
d = conferirQuadro({ socios: [{ nome: 'ANA LIMA SOUZA', cpf: '111.111.111-11', participacao_percentual: 50 }, { nome: 'BRUNO COSTA', cpf: '22222222222', participacao_percentual: 50 }],
  socios_retirantes: [{ nome: 'Bruno Costa', cpf: '222.222.222-22', motivo: 'retirou-se da sociedade' }], confianca: 'alta' });
chk('quem saiu e veio também em socios sai de socios (o CPF com ou sem máscara); a soma que sobra fora de 100 avisa e a confiança cai',
  nomes(d) === 'ANA LIMA SOUZA' && /somam 50%/.test(d.observacoes_extracao) && d.confianca === 'media', JSON.stringify(d));
d = conferirQuadro({ socios: [{ nome: 'Carlos Silva', cpf: '44444444444', participacao_percentual: 100 }], socios_retirantes: [{ nome: 'CARLOS SILVA', cpf: '33333333333' }] });
chk('o homônimo com outro CPF não é quem saiu: fica', nomes(d) === 'Carlos Silva' && d.socios_retirantes.length === 1);
d = conferirQuadro({ socios: [{ nome: 'Joao da Silva', participacao_percentual: 40 }, { nome: 'MARIA PRADO', participacao_percentual: 60 }], socios_retirantes: [{ nome: 'JOÃO DA SILVA' }] });
chk('sem CPF, pelo nome sem acento', nomes(d) === 'MARIA PRADO');
d = conferirQuadro({ socios: [{ nome: 'A', participacao_percentual: 100 }, { nome: 'B', participacao_percentual: 50 }], confianca: 'alta', observacoes_extracao: 'Documento legível.' });
chk('a soma 150 avisa, junto da observação que já tinha', d.observacoes_extracao === 'Documento legível. As participações lidas somam 150% — confira o quadro de sócios.' && d.confianca === 'media');
d = conferirQuadro({ socios: [{ nome: 'A', participacao_percentual: 33.33 }, { nome: 'B', participacao_percentual: 33.33 }, { nome: 'C', participacao_percentual: 33.34 }], confianca: 'alta' });
chk('33,33 + 33,33 + 33,34 = 100: sem aviso', !d.observacoes_extracao && d.confianca === 'alta');
d = conferirQuadro({ socios: [{ nome: 'A', participacao_percentual: 70 }, { nome: 'B', participacao_percentual: null }], confianca: 'alta' });
chk('com participação que não veio, a soma não é conferida', !d.observacoes_extracao && d.confianca === 'alta');
d = conferirQuadro({ socios: [{ nome: 'A', participacao_percentual: 100 }], socios_retirantes: [] });
chk('lista de quem saiu vazia vira null; e o que não é objeto passa', d.socios_retirantes === null && conferirQuadro(null) === null && conferirQuadro('x') === 'x');
chk('a mesma pessoa: CPF manda quando os dois têm; nome sem acento quando falta', mesmaPessoa({ cpf: '1.1.1' + '11111111' }, { cpf: '11111111111' }) === true
  && mesmaPessoa({ nome: 'José', cpf: '11111111111' }, { nome: 'JOSE', cpf: '22222222222' }) === false && mesmaPessoa({ nome: 'José Ávila' }, { nome: 'JOSE AVILA', cpf: '1' }) === true
  && nomeChave(' Ana  d\'Ávila ') === 'ANA D AVILA');

console.log('O que a função pede e faz no cadastro:');
const srv = readFileSync(raiz + 'supabase/functions/extract-document/servidor.ts', 'utf8');
chk('o quadro de sócios é o de DEPOIS do ato (a consolidação), e o preâmbulo não é o quadro', /QUADRO DE SÓCIOS \(a regra mais importante\)/.test(srv) && /NUNCA copie o preâmbulo como quadro de sócios/.test(srv));
chk('quem saiu vai em socios_retirantes, que está no formato da resposta', /"socios_retirantes": \[/.test(srv) && /Essa pessoa NUNCA entra em "socios"/.test(srv));
chk('a conferência roda depois da leitura do cadastro', /import \{ conferirQuadro \} from "\.\/quadro\.js"/.test(srv) && /if \(modo === "cadastro"\) conferirQuadro\(parsed\)/.test(srv));
chk('aceita documento em texto', /doc\.media_type === "text\/plain"/.test(srv) && /source: \{ type: "text", media_type: "text\/plain"/.test(srv));

console.log('Commit fixado na função (o código cru do GitHub):');
const idx = readFileSync(raiz + 'supabase/functions/extract-document/index.ts', 'utf8');
const m = /raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/supabase\/functions\/extract-document\/servidor\.ts/.exec(idx);
chk('index.ts importa o servidor do repositório num commit fixado', !!m && /Deno\.serve\(atender\)/.test(idx));
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
const ARQS = importados('supabase/functions/extract-document/servidor.ts');
chk('a trava segue os imports: o servidor e a conferência', ARQS.includes('supabase/functions/extract-document/quadro.js'), ARQS.join(', '));
if (m) {
  const atrasados = ARQS.filter(a => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
  });
  chk('o código que a função roda é o daqui', atrasados.length === 0,
    'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função extract-document');
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
