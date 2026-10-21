// Os sócios que a leitura do contrato traz (assets/js/leitura-socios.js, 21/10/2026): quem saiu da sociedade no documento
// (socios_retirantes) fica fora dos sócios — o caso de uma alteração de saída em que um sócio vende todas as cotas pro
// outro, com os dois qualificados no preâmbulo (nomes e CPFs inventados: o repositório é público) —, a mesma pessoa pelo
// CPF ou, sem CPF, pelo nome sem acento, a conferência da soma das participações e as frases da tela.
// Rodar com: node tests/leitura-socios.test.mjs
import { retirantesDe, mesmaPessoa, retiranteQueE, sociosQueFicam, percentual, avisoDaSoma, textoDosRetirantes, linhaDoRetirante } from '../assets/js/leitura-socios.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

const VENDEDOR = { nome: 'PEDRO VENDEDOR DE TESTE', cpf: '111.222.333-44', participacao_percentual: 50, eh_administrador: false };
const COMPRADOR = { nome: 'VALTER COMPRADOR DE TESTE', cpf: '55566677788', participacao_percentual: 100, eh_administrador: true };

console.log('Quem saiu da sociedade:');
const leituraNova = { socios: [COMPRADOR], socios_retirantes: [{ nome: ' PEDRO VENDEDOR DE TESTE ', cpf: '111.222.333-44', motivo: 'vendeu todas as cotas a VALTER COMPRADOR DE TESTE.' }] };
const r = retirantesDe(leituraNova);
chk('o retirante com o nome limpo, o CPF só com dígitos e o motivo sem o ponto final', r.length === 1 && r[0].nome === 'PEDRO VENDEDOR DE TESTE' && r[0].cpf === '11122233344'
  && r[0].motivo === 'vendeu todas as cotas a VALTER COMPRADOR DE TESTE', JSON.stringify(r));
chk('sem o campo (leitura antiga) ou com linha sem nome: lista vazia ou sem ela', retirantesDe({ socios: [COMPRADOR] }).length === 0 && retirantesDe(null).length === 0
  && retirantesDe({ socios_retirantes: [{ nome: '  ' }, null, { cpf: '1' }] }).length === 0);

console.log('Os sócios que ficam:');
chk('o caso da alteração de saída: a leitura certa traz só o comprador, e ele fica', JSON.stringify(sociosQueFicam(leituraNova).map(s => s.nome)) === '["VALTER COMPRADOR DE TESTE"]');
// a leitura que ainda põe o vendedor nas duas listas (o modelo, por engano): ele sai dos sócios
const nasDuas = { socios: [VENDEDOR, COMPRADOR], socios_retirantes: [{ nome: 'PEDRO VENDEDOR DE TESTE', cpf: '11122233344', motivo: 'vendeu as cotas' }] };
chk('o vendedor que vem também em socios fica de fora (o CPF com e sem máscara é a mesma pessoa)', JSON.stringify(sociosQueFicam(nasDuas).map(s => s.nome)) === '["VALTER COMPRADOR DE TESTE"]');
const semCpf = { socios: [{ nome: 'João da Silva Teste', cpf: null, participacao_percentual: 30 }, { nome: 'MARIA TESTE', participacao_percentual: 70 }],
  socios_retirantes: [{ nome: 'JOAO DA SILVA TESTE', cpf: null, motivo: 'retirou-se da sociedade' }] };
chk('sem CPF, pelo nome sem acento e sem maiúscula', JSON.stringify(sociosQueFicam(semCpf).map(s => s.nome)) === '["MARIA TESTE"]');
chk('CPFs diferentes com o mesmo nome não são a mesma pessoa (homônimo fica)', !mesmaPessoa({ nome: 'ANA TESTE', cpf: '12345678901' }, { nome: 'Ana Teste', cpf: '98765432100' })
  && mesmaPessoa({ nome: 'ANA TESTE', cpf: '123.456.789-01' }, { nome: 'outro nome', cpf: '12345678901' }));
chk('sem retirantes, os sócios da leitura (com nome) seguem iguais', sociosQueFicam({ socios: [VENDEDOR, COMPRADOR, { nome: '' }] }).length === 2 && sociosQueFicam({}).length === 0);
chk('o retirante que é a pessoa do cadastro (pelo CPF dele)', retiranteQueE({ nome: 'Pedro Vendedor de Teste', cpf: '11122233344' }, r) === r[0]
  && retiranteQueE(COMPRADOR, r) === null);

console.log('A soma das participações:');
chk('a participação como número: 50, "50", "33,33", "50%"; o resto, nada', percentual(50) === 50 && percentual('50') === 50 && percentual('33,33') === 33.33
  && percentual('50%') === 50 && percentual('vinte') === null && percentual('') === null && percentual(null) === null);
chk('o caso certo (só o comprador, 100%): sem aviso', avisoDaSoma(sociosQueFicam(leituraNova)) === '');
chk('a leitura antiga, com os dois (50% + 100% = 150%): o aviso pra conferir', avisoDaSoma([VENDEDOR, COMPRADOR]) === 'As participações lidas somam 150% — confira o quadro de sócios antes de aplicar.',
  avisoDaSoma([VENDEDOR, COMPRADOR]));
chk('33,33 + 33,33 + 33,34 = 100: sem aviso; 33,33 × 3 = 99,99: dentro da folga', avisoDaSoma([{ nome: 'A', participacao_percentual: '33,33' }, { nome: 'B', participacao_percentual: '33,33' },
  { nome: 'C', participacao_percentual: '33,34' }]) === '' && avisoDaSoma([{ nome: 'A', participacao_percentual: 33.33 }, { nome: 'B', participacao_percentual: 33.33 }, { nome: 'C', participacao_percentual: 33.33 }]) === '');
chk('abaixo de 99,5 com todos com participação: avisa (com vírgula); com um sem participação, não dá pra saber', avisoDaSoma([{ nome: 'A', participacao_percentual: 50 }, { nome: 'B', participacao_percentual: '30,5' }])
  === 'As participações lidas somam 80,5% — confira o quadro de sócios antes de aplicar.' && avisoDaSoma([{ nome: 'A', participacao_percentual: 50 }, { nome: 'B', participacao_percentual: null }]) === '');
chk('as que vieram com número já passam de 100,5: avisa mesmo com um sem participação', avisoDaSoma([{ nome: 'A', participacao_percentual: 80 }, { nome: 'B', participacao_percentual: 40 }, { nome: 'C' }]).includes('120%'));
chk('ninguém com participação (o quadro da Receita): sem aviso', avisoDaSoma([{ nome: 'A', participacao_percentual: null }, { nome: 'B' }]) === '' && avisoDaSoma([]) === '' && avisoDaSoma(null) === '');

console.log('As frases da tela:');
chk('um que saiu', textoDosRetirantes(r) === 'Fora: PEDRO VENDEDOR DE TESTE, que saiu da sociedade neste documento.');
chk('dois ou mais que saíram', textoDosRetirantes([{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }]) === 'Fora: A, B e C, que saíram da sociedade neste documento.' && textoDosRetirantes([]) === '' && textoDosRetirantes(null) === '');
chk('a linha de quem saiu e não está no cadastro, com e sem o motivo', linhaDoRetirante(r[0]) === 'Saiu da sociedade neste documento: PEDRO VENDEDOR DE TESTE — vendeu todas as cotas a VALTER COMPRADOR DE TESTE'
  && linhaDoRetirante({ nome: 'X', motivo: null }) === 'Saiu da sociedade neste documento: X');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
