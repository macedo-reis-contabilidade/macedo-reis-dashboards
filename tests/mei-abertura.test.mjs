// A abertura de MEI (assets/js/mei-abertura.js, 04/11/2026): a conferência do pedido do link público (o nome completo, o
// CPF, o telefone, o e-mail, as respostas, a descrição, as formas de atuação e os endereços), o que a ficha mostra, os
// avisos pro escritório e a conferência da sugestão de CNAE da IA (o formato, a principal, até 15 secundárias, sem
// repetir). E a Edge Function mei-link: leva uma cópia idêntica do arquivo, o envio dos documentos é o mesmo das
// rescisões (que é o das admissões), a trava de envios por hora e a sugestão de novo só com o login do escritório.
// Rodar com: node tests/mei-abertura.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { conferirPedido, respostasDoPedido, alertasDoPedido, limparSugestao, cpfValido, formatarCnae, formatarCpf, formatarTelefone, lerValor,
  FORMAS, MAX_SECUNDARIAS, AVISO_GOV } from '../assets/js/mei-abertura.js';

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

console.log('A sugestão de CNAE (o que a IA devolve, conferido):');
{
  chk('o CNAE: 7 dígitos no formato da subclasse; o resto não', formatarCnae('4781400') === '4781-4/00' && formatarCnae('4781-4/00') === '4781-4/00' && formatarCnae('478140') === null);
  const s = limparSugestao({ pode_ser_mei: true, principal: { cnae: '4781400', ocupacao: 'Comerciante de artigos do vestuário e acessórios', porque: 'vende roupas' },
    secundarios: [{ cnae: '4781-4/00', ocupacao: 'Comerciante de artigos do vestuário e acessórios' }, { cnae: 'xx', ocupacao: 'sem código' }, { cnae: '4782201', ocupacao: 'Comerciante de calçados' },
      ...Array.from({ length: 20 }, (_, i) => ({ cnae: String(1000000 + i), ocupacao: 'Ocupação ' + i }))], alertas: ['  confira o alvará  ', ''], resumo: 'Comércio de roupas.' });
  chk('a principal no formato; a repetida e a sem código saem; até 15 secundárias', s.principal.cnae === '4781-4/00' && s.secundarios.length === MAX_SECUNDARIAS && s.secundarios[0].cnae === '4782-2/01'
    && !s.secundarios.some(x => x.ocupacao === 'sem código'), JSON.stringify(s.secundarios.slice(0, 2)));
  chk('os alertas limpos, o resumo', JSON.stringify(s.alertas) === JSON.stringify(['confira o alvará']) && s.resumo === 'Comércio de roupas.');
  const nao = limparSugestao({ pode_ser_mei: false, principal: { cnae: '8630501', ocupacao: 'Médico' }, secundarios: [], alertas: ['Profissão regulamentada.'], resumo: 'Não cabe no MEI.' });
  chk('não cabe no MEI: sem principal nem secundárias, com o alerta', nao.pode_ser_mei === false && nao.principal === null && !nao.secundarios.length && nao.alertas.length === 1);
  chk('sem principal válida: não cabe; resposta fora do formato: null', limparSugestao({ pode_ser_mei: true, principal: { cnae: '1', ocupacao: 'x' } }).pode_ser_mei === false && limparSugestao(null) === null && limparSugestao('x') === null);
}

console.log('A Edge Function mei-link:');
{
  const copia = readFileSync(raiz + 'supabase/functions/mei-link/mei-abertura.js', 'utf8');
  chk('leva uma cópia idêntica de assets/js/mei-abertura.js (mudou um, copie no outro)', copia === readFileSync(raiz + 'assets/js/mei-abertura.js', 'utf8'));
  const fn = readFileSync(raiz + 'supabase/functions/mei-link/index.ts', 'utf8');
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
  chk('a sugestão não segura a resposta pra pessoa (segue depois, no waitUntil)', /waitUntil\(depois\)/.test(fn));
  chk('as formas de atuação têm o nome do Portal do Empreendedor', FORMAS.every(f => f.length === 3 && f[2]));
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
