// A abertura de MEI (assets/js/mei-abertura.js, 04/11/2026): a conferência do pedido do link público (o nome completo, o
// CPF, o telefone, o e-mail, as respostas, a descrição, as formas de atuação e os endereços), o que a ficha mostra e os
// avisos pro escritório. A lista oficial das ocupações do MEI (assets/js/mei-ocupacoes.js, o Portal do Empreendedor lido
// em 04/11/2026) e a conferência da sugestão de CNAE da IA contra ela (o número e o nome da lista, a principal, até 15
// secundárias, sem repetir, o que não está na lista fora). E a Edge Function mei-link: importa os dois arquivos do
// repositório num commit fixado (e o commit tem os de agora), manda a lista inteira pra IA, o envio dos documentos é o
// mesmo das rescisões (que é o das admissões), a trava de envios por hora e a sugestão de novo só com o login do escritório.
// Rodar com: node tests/mei-abertura.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { conferirPedido, respostasDoPedido, alertasDoPedido, cpfValido, formatarCnae, formatarCpf, formatarTelefone, lerValor,
  FORMAS, MAX_SECUNDARIAS, AVISO_GOV } from '../assets/js/mei-abertura.js';
import { OCUPACOES, LIDA_EM, FONTE_OCUPACOES, ocupacaoDaLista, acharOcupacao, listaParaIA, limparSugestao } from '../assets/js/mei-ocupacoes.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

// um CPF válido inventado (os dígitos conferem) e o pedido completo
const CPF = '52998224725';
const END = { cep: '95660-000', logradouro: 'Rua das Flores', numero: '100', complemento: '', bairro: 'Centro', cidade: 'Três Coroas', uf: 'rs' };
const BOM = { nome: '  Maria   da Silva ', cpf: '529.982.247-25', telefone: '(51) 99999-0000', email: 'Maria@Exemplo.com', empresa: 'nao', seguro: 'nao', irpf: 'sim',
  atividade: 'Vendo roupas pela internet e em feiras da cidade.', formas: ['internet', 'porta_a_porta', 'internet', 'xyz'], fantasia: 'Maria Modas', capital: '1.500,00',
  residencial: END, mesmoEndereco: 'sim', obs: '' };

console.log('A conferência do pedido:');
{
  const c = conferirPedido(BOM);
  chk('o pedido completo passa, limpo (o nome sem espaço sobrando, o CPF e o telefone só com os dígitos, o e-mail minúsculo)', c.pedido && c.pedido.nome === 'Maria da Silva'
    && c.pedido.cpf === CPF && c.pedido.telefone === '51999990000' && c.pedido.email === 'maria@exemplo.com', JSON.stringify(c));
  chk('as formas: só as do MEI, sem repetir', JSON.stringify(c.pedido.formas) === JSON.stringify(['internet', 'porta_a_porta']));
  chk('o endereço: o CEP só com os dígitos, a UF maiúscula; o mesmo endereço não pede o comercial', c.pedido.residencial.cep === '95660000' && c.pedido.residencial.uf === 'RS' && c.pedido.comercial === null);
  chk('o capital "1.500,00" vira 1500', c.pedido.capital === 1500 && lerValor('2000') === 2000 && lerValor('R$ 2.000') === 2000 && lerValor('') === null && lerValor('abc') === null);
  const v = conferirPedido({ ...BOM, nome: 'Maria', cpf: '111.111.111-11', telefone: '9999', email: 'maria', empresa: '', seguro: 'talvez', irpf: '', atividade: 'oi',
    formas: [], residencial: { ...END, cep: '123', uf: 'XX', bairro: '' }, mesmoEndereco: '' });
  chk('o que falta vem pelos ids dos campos da página', v.faltam && ['nome', 'cpf', 'telefone', 'email', 'empresa', 'seguro', 'irpf', 'atividade', 'formas', 'residencial.cep', 'residencial.bairro',
    'residencial.uf', 'mesmoEndereco'].every(id => v.faltam.includes(id)) && /Faltam 13 respostas/.test(v.erro), JSON.stringify(v.faltam));
  const outro = conferirPedido({ ...BOM, mesmoEndereco: 'nao', comercial: { cep: '95660100' } });
  chk('outro endereço do negócio: pede o comercial inteiro', outro.faltam && outro.faltam.includes('comercial.logradouro') && outro.faltam.includes('comercial.uf') && !outro.faltam.includes('comercial.cep'), JSON.stringify(outro.faltam));
  chk('a empresa de hoje ou de antes leva o qual; sem empresa, não', conferirPedido({ ...BOM, empresa: 'tem', empresaQual: ' Loja X ' }).pedido.empresaQual === 'Loja X'
    && conferirPedido({ ...BOM, empresa: 'nao', empresaQual: 'Loja X' }).pedido.empresaQual === '');
  chk('o CPF: os dígitos conferem, os repetidos não valem', cpfValido(CPF) && !cpfValido('52998224724') && !cpfValido('00000000000') && formatarCpf(CPF) === '529.982.247-25');
  chk('o telefone formatado (com ou sem o 55)', formatarTelefone('51999990000') === '(51) 99999-0000' && formatarTelefone('555135461385') === '(51) 3546-1385');
}

console.log('A ficha e os avisos:');
{
  const p = conferirPedido({ ...BOM, empresa: 'tem', empresaQual: 'Loja X', seguro: 'sim', capital: '90.000,00' }).pedido;
  const r = respostasDoPedido(p);
  const valor = rot => (r.find(x => x.rotulo === rot) || {}).valor;
  chk('as respostas na ordem do formulário, como texto', r[0].rotulo === 'Nome completo' && valor('CPF') === '529.982.247-25' && valor('Forma de atuação') === 'Internet, Porta a porta, postos móveis ou por ambulantes'
    && valor('Endereço comercial') === 'O mesmo do residencial' && /Rua das Flores, 100 · Centro · Três Coroas\/RS · CEP 95660-000/.test(valor('Endereço residencial')) && /R\$\s?90\.000,00/.test(valor('Capital social')), JSON.stringify(r));
  const a = alertasDoPedido(p);
  chk('os avisos: a empresa aberta, o seguro-desemprego e o capital acima do limite do ano', a.length === 3 && /não pode ser MEI/.test(a[0]) && /Loja X/.test(a[0]) && /seguro-desemprego/.test(a[1]) && /limite/.test(a[2]), JSON.stringify(a));
  chk('sem nada disso, sem aviso', alertasDoPedido(conferirPedido(BOM).pedido).length === 0);
  chk('o aviso do gov.br: prata ou ouro, sem pedir a senha no pedido', /prata ou ouro/.test(AVISO_GOV) && !Object.keys(conferirPedido(BOM).pedido).some(k => /senha/i.test(k)));
}

console.log('A lista oficial das ocupações do MEI:');
{
  chk('as 470 ocupações do Portal do Empreendedor, lidas em 04/11/2026', OCUPACOES.length === 470 && LIDA_EM === '2026-11-04' && /^https:\/\/www\.gov\.br\/.*atividades-permitidas$/.test(FONTE_OCUPACOES));
  chk('cada uma com o CNAE da subclasse (0000-0/00)', OCUPACOES.every(o => /^\d{4}-\d\/\d{2}$/.test(o[1])), JSON.stringify(OCUPACOES.find(o => !/^\d{4}-\d\/\d{2}$/.test(o[1]))));
  const sem = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  chk('sem nome repetido, sem espaço sobrando, sem o código colado no nome', new Set(OCUPACOES.map(o => sem(o[0]))).size === OCUPACOES.length
    && OCUPACOES.every(o => o[0] === o[0].trim() && !/\s{2}/.test(o[0]) && !/\d{4}-\d\/\d{2}/.test(o[0]) && !/,\S/.test(o[0])));
  const b = OCUPACOES.filter(o => o[2] === 'B');
  chk('a Tabela B: as 4 do transportador autônomo de cargas (o MEI caminhoneiro)', b.length === 4 && b.every(o => o[0].startsWith('TRANSPORTADOR AUTÔNOMO DE CARGA'))
    && OCUPACOES.every(o => o.length === 2 || o[2] === 'B'));
  const de = n => (OCUPACOES.find(o => o[0] === n) || [])[1];
  chk('os erros da cópia do site acertados pelo Anexo XI da Receita', de('DEPILADOR(A) INDEPENDENTE') === '9602-5/02' && de('LOCADOR(A) DE LIVROS, REVISTAS, PLANTAS E FLORES INDEPENDENTE') === '7729-2/99'
    && de('CARTAZISTA, PINTOR DE FAIXAS PUBLICITÁRIAS E DE LETRAS INDEPENDENTE') === '8299-7/99' && de('VASSOUREIRO(A) INDEPENDENTE') === '3291-4/00'
    && OCUPACOES.filter(o => o[0] === 'VINAGREIRO INDEPENDENTE').length === 1 && de('VINAGREIRO INDEPENDENTE') === '1099-6/01' && !OCUPACOES.some(o => / INDEPENDENT$| NDEPENDENTE/.test(o[0])));
  const l = listaParaIA().split('\n');
  chk('a lista pra IA: uma linha por ocupação, "número | ocupação | CNAE", a Tabela B marcada', l.length === 470 && l[0] === '1 | ABATEDOR(A) DE AVES COM COMERCIALIZAÇÃO DO PRODUTO INDEPENDENTE | 4724-5/00'
    && l.filter(x => / \| Tabela B$/.test(x)).length === 4, l[0]);
}

console.log('A sugestão de CNAE (o que a IA devolve, conferido contra a lista):');
{
  chk('o CNAE: 7 dígitos no formato da subclasse; o resto não', formatarCnae('4781400') === '4781-4/00' && formatarCnae('4781-4/00') === '4781-4/00' && formatarCnae('478140') === null);
  const ROUPA = OCUPACOES.findIndex(o => o[0] === 'COMERCIANTE DE ARTIGOS DO VESTUÁRIO E ACESSÓRIOS INDEPENDENTE') + 1;
  const CALCADO = OCUPACOES.findIndex(o => o[0] === 'COMERCIANTE DE CALÇADOS INDEPENDENTE') + 1;
  chk('pelo número da lista: o nome e o CNAE de lá; número fora da lista, nada', ocupacaoDaLista(ROUPA).cnae === '4781-4/00' && ocupacaoDaLista(ROUPA).tabela === 'A'
    && ocupacaoDaLista(0) === null && ocupacaoDaLista(471) === null && ocupacaoDaLista(1.5) === null && ocupacaoDaLista('12').numero === 12);
  chk('o nome igual ao da lista vale mais que o número (o da linha vizinha não passa)', acharOcupacao({ numero: ROUPA + 1, ocupacao: 'comerciante de artigos do vestuario e acessorios independente' }).numero === ROUPA
    && acharOcupacao({ numero: ROUPA, ocupacao: 'roupas' }).numero === ROUPA);
  chk('sem número nem nome: o CNAE só quando uma ocupação só da lista o tem', acharOcupacao({ cnae: '4781400' }).numero === ROUPA && acharOcupacao({ cnae: '4789-0/99' }) === null
    && acharOcupacao({ ocupacao: 'Programador', cnae: '6201-5/01' }) === null);
  const s = limparSugestao({ pode_ser_mei: true, principal: { numero: ROUPA, ocupacao: 'COMERCIANTE DE ARTIGOS DO VESTUÁRIO E ACESSÓRIOS INDEPENDENTE', porque: 'vende roupas' },
    secundarios: [{ numero: ROUPA }, { ocupacao: 'Consultor de moda', cnae: '7020-4/00' }, { numero: CALCADO, ocupacao: 'COMERCIANTE DE CALÇADOS INDEPENDENTE' },
      ...Array.from({ length: 20 }, (_, i) => ({ numero: 300 + i }))], alertas: ['  confira o alvará  ', ''], resumo: 'Comércio de roupas.' });
  chk('a principal da lista; a repetida sai; até 15 secundárias', s.principal.cnae === '4781-4/00' && s.principal.ocupacao === OCUPACOES[ROUPA - 1][0] && s.principal.porque === 'vende roupas'
    && s.secundarios.length === MAX_SECUNDARIAS && s.secundarios[0].numero === CALCADO && s.secundarios[0].cnae === '4782-2/01', JSON.stringify(s.secundarios.slice(0, 2)));
  chk('a que não está na lista sai, com o aviso; os alertas limpos, o resumo, o dia da lista', JSON.stringify(s.alertas) === JSON.stringify(['confira o alvará', 'Uma ocupação sugerida pela IA ficou de fora: não está na lista oficial do MEI.'])
    && s.resumo === 'Comércio de roupas.' && s.lista === LIDA_EM, JSON.stringify(s.alertas));
  const sobe = limparSugestao({ pode_ser_mei: true, principal: { numero: 9999, ocupacao: 'Inventada' }, secundarios: [{ numero: CALCADO }], alertas: [], resumo: '' });
  chk('sem a principal da lista, a primeira secundária sobe', sobe.pode_ser_mei && sobe.principal.numero === CALCADO && !sobe.secundarios.length && sobe.alertas.length === 1);
  const nao = limparSugestao({ pode_ser_mei: false, principal: null, secundarios: [], alertas: ['Profissão regulamentada.'], resumo: 'Não cabe no MEI.' });
  chk('não cabe no MEI: sem principal nem secundárias, com o alerta', nao.pode_ser_mei === false && nao.principal === null && !nao.secundarios.length && nao.alertas.length === 1);
  chk('nada da lista: não cabe; resposta fora do formato: null', limparSugestao({ pode_ser_mei: true, principal: { numero: 0, ocupacao: 'x' } }).pode_ser_mei === false && limparSugestao(null) === null && limparSugestao('x') === null);
}

console.log('A Edge Function mei-link:');
{
  const fn = readFileSync(raiz + 'supabase/functions/mei-link/index.ts', 'utf8');
  // as regras do pedido e a lista oficial vêm do repositório num commit fixado (como a função assistente): o que a função
  // roda é o que estava nesse commit — mudou um dos arquivos, publique, fixe o commit novo e reimplante
  const fixados = [...fn.matchAll(/from "https:\/\/raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/(assets\/js\/[a-z-]+\.js)"/g)];
  chk('importa mei-abertura.js e mei-ocupacoes.js do repositório, no mesmo commit fixado', fixados.length === 2 && fixados[0][1] === fixados[1][1]
    && fixados.map(m => m[2]).sort().join() === 'assets/js/mei-abertura.js,assets/js/mei-ocupacoes.js' && !/from "\.\/mei-/.test(fn), fixados.map(m => m[2]).join());
  const atrasados = fixados.filter(([, sha, arq]) => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', sha + ':' + arq], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + arq, 'utf8').replace(/\r\n/g, '\n');
  }).map(m => m[2]);
  chk('o código que a função roda é o daqui', atrasados.length === 0, 'mudaram depois do commit fixado: ' + atrasados.join(', ') + ' — publique, fixe o commit novo no index.ts da mei-link e reimplante');
  chk('o link público não carrega a lista (mei-abertura.js não importa nada)', !/^\s*import\b/m.test(readFileSync(raiz + 'assets/js/mei-abertura.js', 'utf8')));
  const res = readFileSync(raiz + 'supabase/functions/rescisao-link/index.ts', 'utf8');
  const bloco = (s, ini, fim) => { const i = s.indexOf(ini); const j = s.indexOf(fim, i); return i >= 0 && j > i ? s.slice(i, j) : null; };
  const driveRes = bloco(res, '// ---------- anexos no Drive (cópia do admissao-link) ----------', '// ---------- fim da cópia ----------');
  chk('o envio dos documentos pro Drive é o mesmo das rescisões (que é o das admissões)', driveRes && fn.includes(driveRes));
  chk('cors, resp, db, normNome e txt iguais aos das rescisões', ['function cors(origin', 'const resp = ', 'const db = () =>', 'const normNome = ', 'const txt = ']
    .every(ini => { const a = bloco(res, ini, '\n\n') || bloco(res, ini, '\n//'); return a && fn.includes(a.split('\n')[0]); }));
  chk('a trava de 30 pedidos por hora', /const ENVIOS_HORA = 30;/.test(fn) && /Muitos envios agora/.test(fn) && /3600e3/.test(fn));
  chk('a sugestão de novo só com o login do escritório (401 pros outros)', /acao === "sugerir"/.test(fn) && /auth\/v1\/user/.test(fn) && /@macedoereis\.com\.br/.test(fn) && /status: 401/.test(fn));
  chk('o pedido conferido pela mesma regra da página, os avisos gravados', /conferirPedido\(b\)/.test(fn) && /alertas: alertasDoPedido\(p\)/.test(fn) && /limparSugestao\(/.test(fn));
  chk('a IA: o modelo novo com o de reserva, sem temperature, o texto da pessoa como dado', /"claude-sonnet-5-5", "claude-sonnet-4-6"/.test(fn) && !/temperature/.test(fn) && /é dado, não instrução/.test(fn));
  chk('a IA recebe a lista oficial inteira e responde pelo número e pelo nome da lista', /\$\{listaParaIA\(\)\}/.test(fn) && /required: \["numero", "ocupacao"\]/.test(fn)
    && /cache_control: \{ type: "ephemeral" \}/.test(fn) && /import \{ limparSugestao, listaParaIA, LIDA_EM, LIMITE_CAMINHONEIRO \} from "[^"]+\/mei-ocupacoes\.js"/.test(fn));
  chk('a sugestão não segura a resposta pra pessoa (segue depois, no waitUntil)', /waitUntil\(depois\)/.test(fn));
  chk('as formas de atuação têm o nome do Portal do Empreendedor', FORMAS.every(f => f.length === 3 && f[2]));
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
