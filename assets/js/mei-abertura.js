// ============================================================
// MACEDO & REIS — Abertura de MEI (04/11/2026, pedido do Samuel): o link público (mei.html) pra quem quer abrir o CNPJ
// como Microempreendedor Individual responder e mandar os documentos, e a ficha no Societário (societario-mei.html).
// Aqui ficam as perguntas, a conferência do pedido, o que a ficha mostra e os avisos pro escritório — um arquivo só pro
// link, pra ficha e pra Edge Function mei-link, que leva uma cópia idêntica (tests/mei-abertura.test.mjs confere). As
// perguntas são as do folder "MEI: como funciona?" do escritório. A senha do gov.br não é pedida (decisão do Samuel): o
// link só avisa que a abertura precisa da conta gov.br nível prata ou ouro. A sugestão de CNAE é só pro escritório (a
// pessoa não vê), sai só das ocupações da lista oficial do MEI (./mei-ocupacoes.js) e é uma sugestão: quem decide é quem
// abre, no Portal do Empreendedor.
// ============================================================

export const AVISO_GOV = 'Necessário ter acesso ao gov.br com a conta nível prata ou ouro para poder abrir o CNPJ.';
export const AVISO_GOV_AJUDA = 'O nível aparece no app gov.br, em "Nível da conta". Não pedimos a sua senha.';
export const LIMITE_ANO = 81000;   // a receita bruta do MEI por ano (o folder do escritório)
export const MAX_SECUNDARIAS = 15; // além da principal: o MEI tem até 15 ocupações secundárias

// as formas de atuação do MEI: [id, como a pessoa entende, como o Portal do Empreendedor chama]
export const FORMAS = [
  ['estabelecimento_fixo', 'Em um local fixo meu (loja, salão, oficina, escritório)', 'Estabelecimento fixo'],
  ['internet', 'Pela internet', 'Internet'],
  ['fora_de_loja', 'Em local fixo fora de loja (na casa do cliente, em empresas, em eventos)', 'Em local fixo fora de loja'],
  ['porta_a_porta', 'Porta a porta, em feiras ou como ambulante', 'Porta a porta, postos móveis ou por ambulantes'],
  ['televenda', 'Por telefone (televenda)', 'Televenda'],
  ['correio', 'Pelos Correios', 'Correio'],
  ['maquinas', 'Em máquinas automáticas', 'Máquinas automáticas']
];
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO',
  'RR', 'SC', 'SP', 'SE', 'TO'];

export const PERGUNTAS = {
  nome: { rotulo: 'Nome completo' },
  cpf: { rotulo: 'CPF' },
  telefone: { rotulo: 'Telefone (WhatsApp)', ajuda: 'Com o DDD.' },
  email: { rotulo: 'E-mail' },
  empresa: { rotulo: 'Você tem ou já teve empresa no seu nome?',
    opcoes: [['nao', 'Não, nunca tive'], ['teve', 'Já tive, mas está fechada'], ['tem', 'Tenho uma empresa aberta hoje']] },
  empresaQual: { rotulo: 'Qual empresa?', ajuda: 'O nome ou o CNPJ, se souber.' },
  seguro: { rotulo: 'Você está recebendo seguro-desemprego?', opcoes: [['nao', 'Não'], ['sim', 'Sim']] },
  irpf: { rotulo: 'Você declarou Imposto de Renda nos últimos 2 anos?', opcoes: [['sim', 'Sim'], ['nao', 'Não']] },
  atividade: { rotulo: 'O que a empresa vai fazer?',
    ajuda: 'Conte com as suas palavras o que você vai vender ou que serviço vai prestar. Ex.: "vendo roupas pela internet e em feiras", "faço manicure e pedicure na casa das clientes".' },
  formas: { rotulo: 'Como você vai trabalhar?', ajuda: 'Marque todas que valem.' },
  fantasia: { rotulo: 'Nome fantasia (opcional)', ajuda: 'O nome do seu negócio, se já tiver um.' },
  capital: { rotulo: 'Capital social (opcional)', ajuda: 'Quanto você vai investir pra começar, em reais. Se não souber, deixe em branco.' },
  residencial: { rotulo: 'Seu endereço (residencial)' },
  mesmoEndereco: { rotulo: 'O negócio funciona nesse mesmo endereço?', opcoes: [['sim', 'Sim'], ['nao', 'Não, funciona em outro endereço']] },
  comercial: { rotulo: 'Endereço do negócio (comercial)' },
  arquivos: { rotulo: 'Documentos', ajuda: 'RG ou CNH (frente e verso) e, se tiver à mão, um comprovante de endereço. Pode ser foto do celular.' },
  obs: { rotulo: 'Alguma observação?', ajuda: 'Opcional.' }
};
export const CAMPOS_ENDERECO = [['cep', 'CEP'], ['logradouro', 'Rua'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'],
  ['cidade', 'Cidade'], ['uf', 'Estado (UF)']];

// as situações da ficha (societario-mei.html); a tarefa da agenda acompanha (o banco: mei_sincronizar_tarefa)
export const SITUACOES = [['recebida', 'Recebida'], ['em_andamento', 'Em andamento'], ['aberta', 'Aberta (CNPJ emitido)'], ['cancelada', 'Cancelada']];
export const rotuloSituacao = s => (SITUACOES.find(([v]) => v === s) || [null, s || '—'])[1];

export const soDigitos = v => String(v == null ? '' : v).replace(/\D+/g, '');
const texto = (v, n) => [...String(v == null ? '' : v).replace(/\s+/g, ' ').trim()].slice(0, n).join('').trim();
const textoLongo = (v, n) => [...String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()].slice(0, n).join('').trim();

export function cpfValido(c) {
  const d = soDigitos(c);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export const formatarCpf = c => { const d = soDigitos(c); return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : String(c || ''); };
export const formatarCep = c => { const d = soDigitos(c); return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : String(c || ''); };
export const formatarTelefone = t => {
  const d = soDigitos(t).replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : d.length === 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : String(t || '');
};
// o capital: "1.500,00", "1500", "R$ 2.000" → número (ou null)
export function lerValor(v) {
  const s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}(\D|$))/g, ''));
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n * 100) / 100 : null;
}

function endereco(e = {}, campo, faltam) {
  const x = e && typeof e === 'object' ? e : {};
  const end = { cep: soDigitos(x.cep).slice(0, 8), logradouro: texto(x.logradouro, 160), numero: texto(x.numero, 20), complemento: texto(x.complemento, 80),
    bairro: texto(x.bairro, 100), cidade: texto(x.cidade, 100), uf: texto(x.uf, 2).toUpperCase() };
  if (end.cep.length !== 8) faltam.push(campo + '.cep');
  ['logradouro', 'numero', 'bairro', 'cidade'].forEach(k => { if (!end[k]) faltam.push(campo + '.' + k); });
  if (!UFS.includes(end.uf)) faltam.push(campo + '.uf');
  return end;
}

// o pedido como chegou → { pedido } (conferido e limpo) ou { faltam: [ids dos campos], erro }. Os ids são os da página
// (os do endereço: "residencial.cep", "comercial.bairro"…), e o erro, a frase pra quem não está vendo a página.
export function conferirPedido(b = {}) {
  const faltam = [];
  const um = (v, ops) => (ops.some(([o]) => o === v) ? v : '');
  const p = {
    nome: texto(b.nome, 160), cpf: soDigitos(b.cpf).slice(0, 11), telefone: soDigitos(b.telefone).slice(0, 13), email: texto(b.email, 160).toLowerCase(),
    empresa: um(b.empresa, PERGUNTAS.empresa.opcoes), empresaQual: '', seguro: um(b.seguro, PERGUNTAS.seguro.opcoes), irpf: um(b.irpf, PERGUNTAS.irpf.opcoes),
    atividade: textoLongo(b.atividade, 2000), formas: [...new Set((Array.isArray(b.formas) ? b.formas : []).filter(f => FORMAS.some(([id]) => id === f)))],
    fantasia: texto(b.fantasia, 120), capital: lerValor(b.capital), mesmoEndereco: um(b.mesmoEndereco, PERGUNTAS.mesmoEndereco.opcoes), obs: textoLongo(b.obs, 2000)
  };
  if (p.nome.split(' ').filter(x => x.length > 1).length < 2) faltam.push('nome');
  if (!cpfValido(p.cpf)) faltam.push('cpf');
  if (p.telefone.length < 10) faltam.push('telefone');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(p.email)) faltam.push('email');
  if (!p.empresa) faltam.push('empresa');
  if (p.empresa === 'tem' || p.empresa === 'teve') p.empresaQual = texto(b.empresaQual, 160);
  if (!p.seguro) faltam.push('seguro');
  if (!p.irpf) faltam.push('irpf');
  if ([...p.atividade].length < 10) faltam.push('atividade');
  if (!p.formas.length) faltam.push('formas');
  p.residencial = endereco(b.residencial, 'residencial', faltam);
  if (!p.mesmoEndereco) faltam.push('mesmoEndereco');
  p.comercial = p.mesmoEndereco === 'nao' ? endereco(b.comercial, 'comercial', faltam) : null;
  if (faltam.length) return { faltam, erro: faltam.length === 1 ? 'Falta 1 resposta.' : 'Faltam ' + faltam.length + ' respostas.' };
  return { pedido: p };
}

export const enderecoEmLinha = e => (e ? [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join('/'),
  e.cep ? 'CEP ' + formatarCep(e.cep) : ''].filter(Boolean).join(' · ') : '');
const opcao = (pergunta, v) => ((PERGUNTAS[pergunta].opcoes || []).find(([o]) => o === v) || [null, '—'])[1];
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// a ficha: [{ rotulo, valor }] na ordem do formulário (o valor é texto: a página escapa)
export function respostasDoPedido(p = {}) {
  const formas = (p.formas || []).map(f => (FORMAS.find(([id]) => id === f) || [null, null, f])[2]).join(', ');
  return [
    ['Nome completo', p.nome], ['CPF', formatarCpf(p.cpf)], ['Telefone (WhatsApp)', formatarTelefone(p.telefone)], ['E-mail', p.email],
    ['Empresa no nome', opcao('empresa', p.empresa) + (p.empresaQual ? ' — ' + p.empresaQual : '')],
    ['Seguro-desemprego', opcao('seguro', p.seguro)], ['Imposto de Renda nos últimos 2 anos', opcao('irpf', p.irpf)],
    ['O que vai fazer', p.atividade], ['Forma de atuação', formas], ['Nome fantasia', p.fantasia || '—'],
    ['Capital social', p.capital == null ? '—' : brl(p.capital)], ['Endereço residencial', enderecoEmLinha(p.residencial)],
    ['Endereço comercial', p.mesmoEndereco === 'sim' ? 'O mesmo do residencial' : enderecoEmLinha(p.comercial)], ['Observação', p.obs || '—']
  ].map(([rotulo, valor]) => ({ rotulo, valor: valor == null || valor === '' ? '—' : String(valor) }));
}

// os avisos pro escritório (na ficha e na tarefa), pelo que a pessoa respondeu
export function alertasDoPedido(p = {}) {
  const a = [];
  if (p.empresa === 'tem') a.push('Tem empresa aberta no nome' + (p.empresaQual ? ' (' + p.empresaQual + ')' : '') + ': quem é titular, sócio ou administrador de outra empresa não pode ser MEI. Confira antes de abrir.');
  if (p.empresa === 'teve') a.push('Já teve empresa' + (p.empresaQual ? ' (' + p.empresaQual + ')' : '') + ': confira se está baixada — com outra empresa ativa no CPF, não dá pra ser MEI.');
  if (p.seguro === 'sim') a.push('Recebe seguro-desemprego: com o CNPJ aberto, o benefício pode ser suspenso. Combine com a pessoa antes de abrir.');
  if (p.capital != null && p.capital > LIMITE_ANO) a.push('O capital informado passa do limite de faturamento do MEI no ano (' + brl(LIMITE_ANO) + '): confira se o MEI é o enquadramento certo.');
  return a;
}

// o CNAE da subclasse: "4781-4/00" (aceita só os dígitos). A sugestão de CNAE da IA e a conferência dela, pela lista
// oficial das ocupações do MEI, ficam em ./mei-ocupacoes.js (o link público não carrega a lista).
export function formatarCnae(c) {
  const d = soDigitos(c);
  return d.length === 7 ? d.slice(0, 4) + '-' + d.slice(4, 5) + '/' + d.slice(5) : null;
}
