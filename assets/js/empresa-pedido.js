// ============================================================================
// MACEDO & REIS — O formulário da constituição de CNPJ e da transformação do MEI em ME (24/11/2026, pedido do Samuel:
// "cria um forms com link pra eu enviar pro cliente poder preencher as informações e anexar os documentos, se nao ele tem
// que enviar pra mim por email ou whats e dificulta mais (tanto pra transformação quanto para constituição)").
// O link público é um só (empresa.html), com o produto no endereço: ?t=constituicao ou ?t=transformacao. As perguntas são
// a documentação dos dois produtos (a lista do Samuel, DOCUMENTOS de societario-produtos.js): os dados da empresa e de cada
// sócio, com o documento de cada sócio anexado — sem o documento de algum sócio, o envio não sai.
// Desde 26/11/2026, a alteração de empresa (?t=alteracao, o pedido do Samuel: "acredito que nesse produto seja
// interessante eu poder marcar em algum local o que vou pedir ou não, pois um o outro documento pode ser que tenhamos e
// outros não"): o que muda (ALTERACOES) vai no endereço (&m=…) e, quando o escritório não pede tudo, o que ele já tem
// (&n=…; paramsDaSelecao e selecaoDoEndereco), e o formulário pergunta só o resto (ITENS); sem o &m, o cliente marca o que
// muda. Na mesma tarde, a revisão do Samuel: na alteração, de quem preenche só o nome ("não precisa o completo, telefone e
// email nao faz sentido por nesse caso"), sem a razão social e o CNPJ da empresa (o escritório sabe de quem é: a tarefa e
// a pasta levam o nome de quem preencheu) e sem o documento do imóvel; e, nos três, o sócio casado ganha onde anexar a
// certidão de casamento (opcional: sem ela, a tarefa avisa).
// Aqui ficam as perguntas, a conferência do pedido, o resumo da tarefa, o texto das respostas que vai pro Drive e o nome de
// cada anexo. Um arquivo só pro link e pra Edge Function empresa-link, que importa este do repositório num commit fixado
// (tests/empresa-pedido.test.mjs confere). Puro, sem DOM e sem banco.
// ============================================================================
import { cpfValido, soDigitos, UFS, CAMPOS_ENDERECO, formatarCpf, formatarTelefone, enderecoEmLinha, lerValor } from './mei-abertura.js';
import { cnpjValido, normalizarDocumento, formatCNPJ } from './utils.js';

export { UFS, CAMPOS_ENDERECO };

// os produtos: o título do link e o da tarefa
export const TIPOS = {
  constituicao: { titulo: 'Abertura de empresa', tarefa: 'Constituição de CNPJ',
    intro: 'Preencha os dados da empresa e de cada sócio e anexe o documento de cada um. Leva uns 10 minutos. Com tudo em mãos, a gente começa a abertura e fala com você pelo WhatsApp.' },
  transformacao: { titulo: 'Transformação do MEI em ME', tarefa: 'Transformação do MEI em ME',
    intro: 'Preencha os dados da empresa e de cada sócio e anexe o documento de cada um. Leva uns 10 minutos. Com tudo em mãos, a gente começa a transformação e fala com você pelo WhatsApp.' },
  alteracao: { titulo: 'Alteração de empresa', tarefa: 'Alteração de empresa',
    intro: 'Preencha o que vai mudar na empresa e anexe o que for pedido. Leva uns 5 minutos. Com tudo em mãos, a gente começa a alteração e fala com você pelo WhatsApp.' }
};
export const tipoDe = t => (Object.prototype.hasOwnProperty.call(TIPOS, t) ? t : null);

// ---------- a alteração de empresa: o que muda e o que pedir (26/11/2026) ----------
// o que pode mudar, na ordem da tela: o rótulo (a caixa de marcar), o curto (as frases: o orçamento, a mensagem e a tarefa)
// e o que se pede ao cliente (os ITENS); o endereço na mesma cidade e o de outra cidade não vão juntos (sai)
export const ALTERACOES = [
  { id: 'nome', rotulo: 'Nome empresarial (razão social)', curto: 'o nome empresarial', pedir: ['razao'] },
  { id: 'fantasia', rotulo: 'Nome fantasia (inclusão ou troca)', curto: 'o nome fantasia', pedir: ['fantasia'] },
  { id: 'natureza', rotulo: 'Natureza jurídica (ex.: de empresário individual para sociedade limitada)', curto: 'a natureza jurídica', pedir: ['doc', 'civil', 'profissao', 'residencia', 'gov'] },
  { id: 'endereco', rotulo: 'Endereço, na mesma cidade', curto: 'o endereço (na mesma cidade)', pedir: ['endereco', 'area', 'horario'], sai: 'cidade' },
  { id: 'cidade', rotulo: 'Endereço, para outra cidade', curto: 'o endereço (para outra cidade)', pedir: ['endereco', 'area', 'horario'], sai: 'endereco' },
  { id: 'atividades', rotulo: 'Atividades (CNAE)', curto: 'as atividades', pedir: ['atividades'] },
  { id: 'capital', rotulo: 'Capital social', curto: 'o capital social', pedir: ['capital'] },
  { id: 'socios', rotulo: 'Sócios (entrada, saída ou participação)', curto: 'o quadro de sócios', pedir: ['doc', 'civil', 'profissao', 'residencia', 'gov'] },
  { id: 'contato', rotulo: 'E-mail e telefone', curto: 'os contatos (e-mail e telefone)', pedir: ['contato'] }
];
// o estado civil de cada sócio, como a documentação diz (a da alteração e a dos outros dois produtos, em
// societario-produtos.js): a certidão de casamento se anexa no formulário, sem ser obrigatória
export const CIVIL = 'Estado civil e, se for casado, o regime de bens e a certidão de casamento';
// o que se pede: o texto da documentação (a imagem, a janela e o formulário) e de quem é (da empresa ou de cada sócio);
// a ordem daqui é a da lista
export const ITENS = {
  razao: { de: 'empresa', t: 'Nome empresarial novo: duas opções' },
  fantasia: { de: 'empresa', t: 'Nome fantasia novo' },
  endereco: { de: 'empresa', t: 'Endereço novo, completo' },
  area: { de: 'empresa', t: 'Área total da edificação e área utilizada, no endereço novo' },
  horario: { de: 'empresa', t: 'Horários e dias de funcionamento' },
  atividades: { de: 'empresa', t: 'Descrição de todas as atividades, como vão ficar' },
  capital: { de: 'empresa', t: 'Capital social novo' },
  contato: { de: 'empresa', t: 'Telefone e e-mail novos' },
  doc: { de: 'socio', t: 'CNH ou identidade', anexo: true },
  civil: { de: 'socio', t: CIVIL },
  profissao: { de: 'socio', t: 'Profissão' },
  residencia: { de: 'socio', t: 'Endereço completo' },
  gov: { de: 'socio', t: 'Conta gov.br nível prata ou ouro', nota: 'O nível aparece no app gov.br, em "Nível da conta". Não pedimos a sua senha.' }
};
const ALT = new Map(ALTERACOES.map(a => [a.id, a]));
const listaDe = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
// os itens que as alterações pedem, na ordem de ITENS
export const itensDe = ids => Object.keys(ITENS).filter(i => (ids || []).some(id => ALT.has(id) && ALT.get(id).pedir.includes(i)));
// a seleção: as alterações marcadas (conferidas, sem repetir, na ordem de ALTERACOES; das duas do endereço, fica a
// primeira) e o que pedir (os itens delas que vieram; sem a lista — null —, todos). Vem do endereço do link ("a,b") ou de
// uma lista
export function selecao(alteracoes, pedir = null) {
  const marcadas = [];
  for (const id of listaDe(alteracoes)) {
    const a = ALT.get(id);
    if (!a || marcadas.includes(id) || (a.sai && marcadas.includes(a.sai))) continue;
    marcadas.push(id);
  }
  const ids = ALTERACOES.map(a => a.id).filter(id => marcadas.includes(id));
  const todos = itensDe(ids);
  if (pedir == null) return { alteracoes: ids, pedir: todos };
  const quer = new Set(listaDe(pedir));
  return { alteracoes: ids, pedir: todos.filter(i => quer.has(i)) };
}
// o endereço do link: "m=…" (o que muda) e, quando o escritório não pede tudo, "&n=…" (o que não pedir, que ele já tem);
// sem alteração, nada
export function paramsDaSelecao(sel) {
  const s = selecao(sel && sel.alteracoes, sel && sel.pedir != null ? sel.pedir : null);
  if (!s.alteracoes.length) return '';
  const fora = itensDe(s.alteracoes).filter(i => !s.pedir.includes(i));
  return 'm=' + s.alteracoes.join(',') + (fora.length ? '&n=' + fora.join(',') : '');
}
// a seleção que o link traz (o m e o n do endereço)
export function selecaoDoEndereco(m, n) {
  const s = selecao(m, null);
  const fora = new Set(listaDe(n));
  return { alteracoes: s.alteracoes, pedir: s.pedir.filter(i => !fora.has(i)) };
}
// "o nome fantasia, a natureza jurídica e o endereço (na mesma cidade)"
export function emFrase(partes) {
  const l = (partes || []).filter(Boolean);
  return l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : (l[0] || '');
}
export const oQueMuda = ids => emFrase(listaDe(ids).filter(id => ALT.has(id)).map(id => ALT.get(id).curto));
// pede os dados de cada sócio: quando muda a natureza jurídica ou o quadro de sócios
export const comSocios = ids => (ids || []).some(id => id === 'natureza' || id === 'socios');
export const AVISO_GOV_ALT = 'Quem administra a empresa precisa da conta gov.br nível prata ou ouro para assinar a alteração.';

export const AVISO_GOV = 'Cada sócio precisa da conta gov.br nível prata ou ouro para assinar o Contrato Social.';
export const AVISO_GOV_AJUDA = 'O nível aparece no app gov.br, em "Nível da conta". Não pedimos a senha.';
export const ESTADOS_CIVIS = [['solteiro', 'Solteiro(a)'], ['casado', 'Casado(a)'], ['uniao_estavel', 'Em união estável'], ['divorciado', 'Divorciado(a)'],
  ['separado', 'Separado(a) judicialmente'], ['viuvo', 'Viúvo(a)']];
export const REGIMES = [['comunhao_parcial', 'Comunhão parcial de bens'], ['comunhao_universal', 'Comunhão universal de bens'],
  ['separacao_total', 'Separação total de bens'], ['participacao_aquestos', 'Participação final nos aquestos'], ['nao_sei', 'Não sei']];
export const GOVBR = [['sim', 'Sim, prata ou ouro'], ['bronze', 'Tenho, mas é bronze'], ['nao', 'Não tenho ou não sei']];
export const SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']];
export const MAX_SOCIOS = 10;
// os anexos: os limites das admissões, das rescisões e do MEI (25 MB cada, 20 arquivos, 100 MB no total)
export const MAX_ARQ = 25 * 1024 * 1024, MAX_QTD = 20, MAX_TOTAL = 100 * 1024 * 1024;
// o grupo de cada anexo: o documento do sócio N ("socio-0", "socio-1"…), a certidão de casamento do sócio N casado
// ("certidao-0"…) ou os outros documentos
export const OUTROS = 'outros';
export const grupoDoSocio = i => 'socio-' + i;
export const grupoDaCertidao = i => 'certidao-' + i;
// os grupos das certidões que o pedido aceita: as dos sócios casados
const certidoesDe = socios => socios.map((s, i) => (s.estadoCivil === 'casado' ? grupoDaCertidao(i) : null)).filter(Boolean);
// depois dos anexos conferidos, cada sócio casado diz se a certidão veio (o texto do Drive e o aviso da tarefa)
const marcarCertidoes = (socios, lista) => socios.forEach((s, i) => { if (s.estadoCivil === 'casado') s.certidao = lista.some(a => a.grupo === grupoDaCertidao(i)); });

export const PERGUNTAS = {
  'contato.nome': 'Seu nome completo', 'contato.telefone': 'Seu telefone (WhatsApp)', 'contato.email': 'Seu e-mail',
  cnpjMei: 'CNPJ do MEI', razao1: 'Nome empresarial (razão social): 1ª opção', razao2: 'Nome empresarial (razão social): 2ª opção',
  fantasia: 'Nome fantasia (opcional)', atividades: 'Descrição de todas as atividades da empresa', capital: 'Capital social (R$)',
  funcionamento: 'Horários e dias de funcionamento', areaTotal: 'Área total da edificação (m²)', areaUtilizada: 'Área utilizada pela empresa (m²)',
  empresaTelefone: 'Telefone da empresa', empresaEmail: 'E-mail da empresa', endereco: 'Endereço completo da empresa',
  'socio.nome': 'Nome completo', 'socio.cpf': 'CPF', 'socio.estadoCivil': 'Estado civil', 'socio.regime': 'Regime de bens',
  'socio.profissao': 'Profissão', 'socio.endereco': 'Endereço completo', 'socio.participacao': 'Participação no capital (%)',
  'socio.administra': 'Vai administrar a empresa?', 'socio.govbr': 'Tem a conta gov.br nível prata ou ouro?',
  'socio.documento': 'CNH ou identidade (frente e verso, ou o PDF da CNH digital)', 'socio.certidao': 'Certidão de casamento (opcional)',
  outros: 'Outros documentos (opcional)', obs: 'Alguma observação? (opcional)'
};
// as perguntas da alteração que são outras (o resto é das PERGUNTAS)
export const PERGUNTAS_ALT = {
  'contato.nome': 'Seu nome', alteracoes: 'O que vai mudar na empresa?',
  razao1: 'Nome empresarial novo: 1ª opção', razao2: 'Nome empresarial novo: 2ª opção', fantasia: 'Nome fantasia novo',
  atividades: 'Descrição de todas as atividades, como vão ficar', capital: 'Capital social novo (R$)',
  empresaTelefone: 'Telefone novo da empresa', empresaEmail: 'E-mail novo da empresa', endereco: 'Endereço novo da empresa'
};

const texto = (v, n) => [...String(v == null ? '' : v).replace(/\s+/g, ' ').trim()].slice(0, n).join('').trim();
const textoLongo = (v, n) => [...String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()].slice(0, n).join('').trim();
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e);
const nomeCompleto = n => n.split(' ').filter(x => x.length > 1).length >= 2;
const um = (v, ops) => (ops.some(([o]) => o === v) ? v : '');
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
// a área e a participação: "120", "120,5", "1.200" → número (ou null)
const numero = v => lerValor(typeof v === 'number' ? String(v).replace('.', ',') : v);

function endereco(e, campo, faltam) {
  const x = e && typeof e === 'object' ? e : {};
  const end = { cep: soDigitos(x.cep).slice(0, 8), logradouro: texto(x.logradouro, 160), numero: texto(x.numero, 20), complemento: texto(x.complemento, 80),
    bairro: texto(x.bairro, 100), cidade: texto(x.cidade, 100), uf: texto(x.uf, 2).toUpperCase() };
  if (end.cep.length !== 8) faltam.push(campo + '.cep');
  ['logradouro', 'numero', 'bairro', 'cidade'].forEach(k => { if (!end[k]) faltam.push(campo + '.' + k); });
  if (!UFS.includes(end.uf)) faltam.push(campo + '.uf');
  return end;
}

// os anexos como a página manda: [{ nome, tamanho, tipo, grupo }] → { lista, erro }; extras: os grupos a mais que o
// pedido aceita (as certidões de casamento dos sócios casados)
export function conferirAnexos(arquivos, nSocios, extras = []) {
  const lista = (Array.isArray(arquivos) ? arquivos : []).map(a => ({
    nome: texto(a && a.nome, 180), tamanho: Number(a && a.tamanho) || 0, tipo: texto(a && a.tipo, 120) || 'application/octet-stream',
    grupo: texto(a && a.grupo, 20) }));
  const grupos = new Set([OUTROS, ...extras, ...Array.from({ length: nSocios }, (_, i) => grupoDoSocio(i))]);
  if (lista.length > MAX_QTD) return { lista, erro: `No máximo ${MAX_QTD} arquivos por envio.` };
  const total = lista.reduce((s, a) => s + a.tamanho, 0);
  if (lista.some(a => !(a.tamanho > 0) || a.tamanho > MAX_ARQ) || total > MAX_TOTAL) return { lista, erro: 'Arquivo grande demais: até 25 MB cada e 100 MB no total.' };
  if (lista.some(a => !a.nome || !grupos.has(a.grupo))) return { lista, erro: 'Arquivo inválido.' };
  return { lista, erro: null };
}

// os sócios como chegaram → os conferidos (até 10; sem nenhum, um vazio). De cada um, o nome e o CPF sempre; o resto, o que
// foi pedido (pede: { civil, profissao, residencia, gov }); com mais de um, a participação de cada um (a soma dá 100%) e
// quem administra (pelo menos um)
function conferirSocios(lista, faltam, pede) {
  const brutos = (Array.isArray(lista) ? lista : []).slice(0, MAX_SOCIOS);
  if (!brutos.length) brutos.push({});
  const varios = brutos.length > 1;
  const cpfs = new Set();
  const socios = brutos.map((s0, i) => {
    const s = s0 && typeof s0 === 'object' ? s0 : {};
    const id = k => `socios.${i}.${k}`;
    const x = {
      nome: texto(s.nome, 160), cpf: soDigitos(s.cpf).slice(0, 11), estadoCivil: pede.civil ? um(s.estadoCivil, ESTADOS_CIVIS) : '', regime: '',
      profissao: pede.profissao ? texto(s.profissao, 120) : '', govbr: pede.gov ? um(s.govbr, GOVBR) : '',
      participacao: varios ? numero(s.participacao) : 100, administra: varios ? um(s.administra, SIM_NAO) : 'sim'
    };
    if (!nomeCompleto(x.nome)) faltam.push(id('nome'));
    if (!cpfValido(x.cpf) || cpfs.has(x.cpf)) faltam.push(id('cpf'));
    cpfs.add(x.cpf);
    if (pede.civil && !x.estadoCivil) faltam.push(id('estadoCivil'));
    if (x.estadoCivil === 'casado') { x.regime = um(s.regime, REGIMES); if (!x.regime) faltam.push(id('regime')); }
    if (pede.profissao && [...x.profissao].length < 2) faltam.push(id('profissao'));
    x.endereco = pede.residencia ? endereco(s.endereco, id('endereco'), faltam) : null;
    if (pede.gov && !x.govbr) faltam.push(id('govbr'));
    if (varios && !(x.participacao > 0 && x.participacao <= 100)) faltam.push(id('participacao'));
    if (varios && !x.administra) faltam.push(id('administra'));
    return x;
  });
  if (varios && socios.every(x => x.participacao > 0)) {
    const soma = socios.reduce((t, x) => t + x.participacao, 0);
    if (Math.abs(soma - 100) > 0.01) faltam.push('socios.participacao');
  }
  if (varios && socios.every(x => x.administra) && !socios.some(x => x.administra === 'sim')) faltam.push('socios.administra');
  return socios;
}
const TODOS_DO_SOCIO = { civil: true, profissao: true, residencia: true, gov: true };

// a alteração: quem preenche (só o nome: o escritório sabe de quem é a empresa e fala com a pessoa pelo WhatsApp), o que
// muda e só o que foi pedido. O que muda e o que pedir vêm do corpo e são conferidos de novo aqui (selecao): pedir menos só
// tira perguntas
function conferirAlteracao(b) {
  const faltam = [];
  const sel = selecao(b.alteracoes, Array.isArray(b.pedir) ? b.pedir : null);
  const tem = i => sel.pedir.includes(i);
  const c = b.contato && typeof b.contato === 'object' ? b.contato : {};
  const p = {
    tipo: 'alteracao', alteracoes: sel.alteracoes, pedir: sel.pedir,
    contato: { nome: texto(c.nome, 160), telefone: '', email: '' },
    razao1: tem('razao') ? texto(b.razao1, 160) : '', razao2: tem('razao') ? texto(b.razao2, 160) : '', fantasia: tem('fantasia') ? texto(b.fantasia, 120) : '',
    atividades: tem('atividades') ? textoLongo(b.atividades, 3000) : '', capital: tem('capital') ? lerValor(b.capital) : null,
    funcionamento: tem('horario') ? textoLongo(b.funcionamento, 500) : '',
    areaTotal: tem('area') ? numero(b.areaTotal) : null, areaUtilizada: tem('area') ? numero(b.areaUtilizada) : null,
    empresaTelefone: tem('contato') ? soDigitos(b.empresaTelefone).slice(0, 13) : '', empresaEmail: tem('contato') ? texto(b.empresaEmail, 160).toLowerCase() : '',
    obs: textoLongo(b.obs, 2000)
  };
  if (!sel.alteracoes.length) faltam.push('alteracoes');
  if ([...p.contato.nome].length < 2) faltam.push('contato.nome');
  if (tem('razao') && [...p.razao1].length < 3) faltam.push('razao1');
  if (tem('razao') && ([...p.razao2].length < 3 || (p.razao1 && semAcento(p.razao2) === semAcento(p.razao1)))) faltam.push('razao2');
  if (tem('fantasia') && [...p.fantasia].length < 2) faltam.push('fantasia');
  if (tem('atividades') && [...p.atividades].length < 10) faltam.push('atividades');
  if (tem('capital') && !(p.capital > 0)) faltam.push('capital');
  if (tem('horario') && [...p.funcionamento].length < 5) faltam.push('funcionamento');
  if (tem('area') && !(p.areaTotal > 0)) faltam.push('areaTotal');
  if (tem('area') && (!(p.areaUtilizada > 0) || (p.areaTotal > 0 && p.areaUtilizada > p.areaTotal))) faltam.push('areaUtilizada');
  if (tem('contato') && p.empresaTelefone.length < 10) faltam.push('empresaTelefone');
  if (tem('contato') && !emailOk(p.empresaEmail)) faltam.push('empresaEmail');
  p.endereco = tem('endereco') ? endereco(b.endereco, 'endereco', faltam) : null;
  p.socios = comSocios(sel.alteracoes)
    ? conferirSocios(b.socios, faltam, { civil: tem('civil'), profissao: tem('profissao'), residencia: tem('residencia'), gov: tem('gov') }) : [];

  // o documento de cada sócio, quando pedido, é obrigatório; a certidão de casamento e os outros documentos, não
  const anexos = conferirAnexos(b.arquivos, p.socios.length, certidoesDe(p.socios));
  if (anexos.erro) return { faltam: ['arquivos'], erro: anexos.erro };
  if (tem('doc')) p.socios.forEach((_, i) => { if (!anexos.lista.some(a => a.grupo === grupoDoSocio(i))) faltam.push(`socios.${i}.documento`); });
  if (faltam.length) return { faltam, erro: faltam.length === 1 ? 'Falta 1 resposta.' : 'Faltam ' + faltam.length + ' respostas.' };
  marcarCertidoes(p.socios, anexos.lista);
  return { pedido: p, arquivos: anexos.lista };
}

// o pedido como chegou → { pedido } (conferido e limpo) ou { faltam: [ids dos campos], erro }. Os ids são os da página
// ("razao1", "endereco.cep", "socios.0.cpf", "socios.1.documento", "socios.participacao"…), e o erro, a frase pra quem
// não está vendo a página.
export function conferirPedido(b = {}) {
  const faltam = [];
  const tipo = tipoDe(b.tipo);
  if (!tipo) return { faltam: ['tipo'], erro: 'Formulário inválido.' };
  if (tipo === 'alteracao') return conferirAlteracao(b);
  const c = b.contato && typeof b.contato === 'object' ? b.contato : {};
  const p = {
    tipo,
    contato: { nome: texto(c.nome, 160), telefone: soDigitos(c.telefone).slice(0, 13), email: texto(c.email, 160).toLowerCase() },
    cnpjMei: tipo === 'transformacao' ? normalizarDocumento(b.cnpjMei).slice(0, 14) : '',
    razao1: texto(b.razao1, 160), razao2: texto(b.razao2, 160), fantasia: texto(b.fantasia, 120),
    atividades: textoLongo(b.atividades, 3000), capital: lerValor(b.capital), funcionamento: textoLongo(b.funcionamento, 500),
    areaTotal: numero(b.areaTotal), areaUtilizada: numero(b.areaUtilizada),
    empresaTelefone: soDigitos(b.empresaTelefone).slice(0, 13), empresaEmail: texto(b.empresaEmail, 160).toLowerCase(),
    obs: textoLongo(b.obs, 2000)
  };
  if (!nomeCompleto(p.contato.nome)) faltam.push('contato.nome');
  if (p.contato.telefone.length < 10) faltam.push('contato.telefone');
  if (!emailOk(p.contato.email)) faltam.push('contato.email');
  if (tipo === 'transformacao' && !cnpjValido(p.cnpjMei)) faltam.push('cnpjMei');
  if ([...p.razao1].length < 3) faltam.push('razao1');
  if ([...p.razao2].length < 3 || (p.razao1 && semAcento(p.razao2) === semAcento(p.razao1))) faltam.push('razao2');
  if ([...p.atividades].length < 10) faltam.push('atividades');
  if (!(p.capital > 0)) faltam.push('capital');
  if ([...p.funcionamento].length < 5) faltam.push('funcionamento');
  if (!(p.areaTotal > 0)) faltam.push('areaTotal');
  if (!(p.areaUtilizada > 0) || (p.areaTotal > 0 && p.areaUtilizada > p.areaTotal)) faltam.push('areaUtilizada');
  if (p.empresaTelefone.length < 10) faltam.push('empresaTelefone');
  if (!emailOk(p.empresaEmail)) faltam.push('empresaEmail');
  p.endereco = endereco(b.endereco, 'endereco', faltam);
  p.socios = conferirSocios(b.socios, faltam, TODOS_DO_SOCIO);

  // o documento de cada sócio é obrigatório; a certidão de casamento e os outros documentos, não
  const anexos = conferirAnexos(b.arquivos, p.socios.length, certidoesDe(p.socios));
  if (anexos.erro) return { faltam: ['arquivos'], erro: anexos.erro };
  p.socios.forEach((_, i) => { if (!anexos.lista.some(a => a.grupo === grupoDoSocio(i))) faltam.push(`socios.${i}.documento`); });
  if (faltam.length) return { faltam, erro: faltam.length === 1 ? 'Falta 1 resposta.' : 'Faltam ' + faltam.length + ' respostas.' };
  marcarCertidoes(p.socios, anexos.lista);
  return { pedido: p, arquivos: anexos.lista };
}

// os avisos pro escritório (na tarefa), pelo que a pessoa respondeu
export function alertasDoPedido(p = {}) {
  const a = [];
  (p.socios || []).forEach((s, i) => {
    const quem = s.nome || `Sócio ${i + 1}`;
    if (s.govbr === 'bronze') a.push(`${quem} tem a conta gov.br bronze: precisa subir pra prata ou ouro antes de assinar o Contrato Social.`);
    if (s.govbr === 'nao') a.push(`${quem} não tem a conta gov.br prata ou ouro (ou não sabe): confira antes de mandar o Contrato Social pra assinatura.`);
    // a certidão de casamento é opcional: o aviso diz quando ela não veio (com o regime que a pessoa não sabe, ela é o
    // jeito de saber); s.certidao só existe no pedido conferido
    if (s.estadoCivil === 'casado' && s.regime === 'nao_sei') {
      a.push(s.certidao === false ? `${quem} é casado(a), não sabe o regime de bens e não anexou a certidão de casamento: peça a certidão pelo WhatsApp.`
        : `${quem} é casado(a) e não sabe o regime de bens: confira na certidão de casamento.`);
    } else if (s.estadoCivil === 'casado' && s.certidao === false) a.push(`${quem} é casado(a) e não anexou a certidão de casamento: se precisar, peça pelo WhatsApp.`);
  });
  if (p.tipo === 'constituicao' && (p.socios || []).length === 1) a.push('Um sócio só: confira se é sociedade limitada unipessoal ou empresário individual.');
  return a;
}

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const m2 = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' m²';
const pct = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
const opcao = (lista, v) => (lista.find(([o]) => o === v) || [null, '—'])[1];
const civil = s => opcao(ESTADOS_CIVIS, s.estadoCivil) + (s.estadoCivil === 'casado' ? ', ' + opcao(REGIMES, s.regime).toLowerCase() : '');
// a linha da certidão de casamento, no sócio casado (no pedido conferido)
const certidao = s => (s.estadoCivil === 'casado' && typeof s.certidao === 'boolean' ? [`Certidão de casamento: ${s.certidao ? 'anexada' : 'não anexada'}`] : []);

// o que o escritório não pediu (desmarcou na janela da Vitrine, porque já tem): os textos dos itens
const naoPedidos = p => itensDe(p.alteracoes || []).filter(i => !(p.pedir || []).includes(i)).map(i => ITENS[i].t + (ITENS[i].de === 'socio' ? ' (do sócio)' : ''));
const cidadeUf = e => [e && e.cidade, e && e.uf].filter(Boolean).join('/');

// o resumo da tarefa (a agenda, que a equipe toda vê): sem CPF e sem endereço dos sócios — o resto está no Drive
export function resumoDoPedido(p = {}) {
  const t = TIPOS[p.tipo] || TIPOS.constituicao;
  const c = p.contato || {};
  const linhas = [
    `${t.tarefa}: o formulário preenchido pelo link.`,
    `Quem preencheu: ${c.nome || '—'}` + (c.telefone ? ' · WhatsApp ' + formatarTelefone(c.telefone) : '') + (c.email ? ' · ' + c.email : '')
  ];
  if (p.tipo === 'alteracao') {
    linhas.push('O que muda: ' + (oQueMuda(p.alteracoes) || '—'));
    if (p.razao1) linhas.push(`Razão social nova: 1ª opção ${p.razao1} · 2ª opção ${p.razao2}`);
    if (p.fantasia) linhas.push('Nome fantasia novo: ' + p.fantasia);
    if (p.endereco) linhas.push('Endereço novo em ' + (cidadeUf(p.endereco) || '—'));
    if (p.atividades) linhas.push('Atividades: ' + String(p.atividades).replace(/\s*\n\s*/g, ' · ').slice(0, 400));
    if (p.capital > 0) linhas.push('Capital social novo: ' + brl(p.capital));
    if (p.empresaTelefone || p.empresaEmail) linhas.push(`Telefone e e-mail novos: ${formatarTelefone(p.empresaTelefone)} · ${p.empresaEmail}`);
    const socios = p.socios || [];
    if (socios.length) linhas.push(`Sócios (${socios.length}): ` + socios.map(s => s.nome + (socios.length > 1 ? ` (${pct(s.participacao)}${s.administra === 'sim' ? ', administra' : ''})` : '')).join(' · '));
    const nao = naoPedidos(p);
    if (nao.length) linhas.push('Não pedido no formulário (o escritório já tem): ' + nao.join(' · '));
    return linhas.join('\n');
  }
  if (p.tipo === 'transformacao') linhas.push('CNPJ do MEI: ' + formatCNPJ(p.cnpjMei));
  linhas.push(`Razão social: 1ª opção ${p.razao1} · 2ª opção ${p.razao2}` + (p.fantasia ? ` · Nome fantasia: ${p.fantasia}` : ''));
  linhas.push('Atividades: ' + String(p.atividades || '').replace(/\s*\n\s*/g, ' · ').slice(0, 400));
  linhas.push(`Capital social: ${p.capital > 0 ? brl(p.capital) : '—'} · Cidade: ${[p.endereco && p.endereco.cidade, p.endereco && p.endereco.uf].filter(Boolean).join('/') || '—'}`);
  const socios = p.socios || [];
  linhas.push(`Sócios (${socios.length}): ` + socios.map(s => s.nome + (socios.length > 1 ? ` (${pct(s.participacao)}${s.administra === 'sim' ? ', administra' : ''})` : '')).join(' · '));
  return linhas.join('\n');
}

// as respostas inteiras, em texto, pro arquivo que vai pra pasta do Drive junto com os documentos
export function textoDasRespostas(p = {}, quando = '') {
  const t = TIPOS[p.tipo] || TIPOS.constituicao;
  const c = p.contato || {};
  const e = p.endereco || {};
  const L = [`${t.titulo.toUpperCase()}: AS RESPOSTAS DO FORMULÁRIO`, quando ? 'Recebido em ' + quando : '', ''];
  L.push('QUEM PREENCHEU', `Nome: ${c.nome}`);
  if (c.telefone) L.push(`WhatsApp: ${formatarTelefone(c.telefone)}`);
  if (c.email) L.push(`E-mail: ${c.email}`);
  L.push('');
  if (p.tipo === 'alteracao') {
    L.push('O QUE MUDA', ...(p.alteracoes || []).map(id => '- ' + ((ALTERACOES.find(a => a.id === id) || {}).rotulo || id)), '');
    if (p.razao1) L.push('NOME EMPRESARIAL NOVO', `1ª opção: ${p.razao1}`, `2ª opção: ${p.razao2}`, '');
    if (p.fantasia) L.push('NOME FANTASIA NOVO', p.fantasia, '');
    if (p.endereco || p.areaTotal > 0 || p.funcionamento) {
      L.push('O ENDEREÇO NOVO');
      if (p.endereco) L.push(`Endereço: ${enderecoEmLinha(p.endereco)}`);
      if (p.areaTotal > 0) L.push(`Área total da edificação: ${m2(p.areaTotal)}`, `Área utilizada: ${p.areaUtilizada > 0 ? m2(p.areaUtilizada) : '—'}`);
      if (p.funcionamento) L.push(`Horários e dias de funcionamento: ${p.funcionamento}`);
      L.push('');
    }
    if (p.atividades) L.push('AS ATIVIDADES, COMO VÃO FICAR', String(p.atividades), '');
    if (p.capital > 0) L.push('CAPITAL SOCIAL NOVO', brl(p.capital), '');
    if (p.empresaTelefone || p.empresaEmail) L.push('TELEFONE E E-MAIL NOVOS', `Telefone: ${formatarTelefone(p.empresaTelefone)}`, `E-mail: ${p.empresaEmail}`, '');
    (p.socios || []).forEach((s, i) => {
      L.push(`SÓCIO ${i + 1}`, `Nome: ${s.nome}`, `CPF: ${formatarCpf(s.cpf)}`);
      if (s.estadoCivil) L.push(`Estado civil: ${civil(s)}`, ...certidao(s));
      if (s.profissao) L.push(`Profissão: ${s.profissao}`);
      if (s.endereco) L.push(`Endereço: ${enderecoEmLinha(s.endereco)}`);
      if ((p.socios || []).length > 1) L.push(`Participação no capital: ${pct(s.participacao)}`, `Administra a empresa: ${s.administra === 'sim' ? 'Sim' : 'Não'}`);
      if (s.govbr) L.push(`Conta gov.br prata ou ouro: ${opcao(GOVBR, s.govbr)}`);
      L.push('');
    });
    const nao = naoPedidos(p);
    if (nao.length) L.push('NÃO PEDIDO NO FORMULÁRIO (O ESCRITÓRIO JÁ TEM)', ...nao.map(x => '- ' + x), '');
    if (p.obs) L.push('OBSERVAÇÃO', p.obs, '');
    return L.filter((x, i) => !(x === '' && i === 1)).join('\n');
  }
  if (p.tipo === 'transformacao') L.push('O MEI', `CNPJ: ${formatCNPJ(p.cnpjMei)}`, '');
  L.push('A EMPRESA',
    `Nome empresarial (razão social), 1ª opção: ${p.razao1}`, `Nome empresarial (razão social), 2ª opção: ${p.razao2}`,
    `Nome fantasia: ${p.fantasia || '—'}`, `Endereço: ${enderecoEmLinha(e)}`,
    `Área total da edificação: ${p.areaTotal > 0 ? m2(p.areaTotal) : '—'}`, `Área utilizada: ${p.areaUtilizada > 0 ? m2(p.areaUtilizada) : '—'}`,
    `Horários e dias de funcionamento: ${p.funcionamento}`, `Capital social: ${p.capital > 0 ? brl(p.capital) : '—'}`,
    `Telefone: ${formatarTelefone(p.empresaTelefone)}`, `E-mail: ${p.empresaEmail}`, 'Atividades:', String(p.atividades || ''), '');
  (p.socios || []).forEach((s, i) => {
    L.push(`SÓCIO ${i + 1}`, `Nome: ${s.nome}`, `CPF: ${formatarCpf(s.cpf)}`, `Estado civil: ${civil(s)}`, ...certidao(s), `Profissão: ${s.profissao}`,
      `Endereço: ${enderecoEmLinha(s.endereco)}`, `Participação no capital: ${pct(s.participacao)}`, `Administra a empresa: ${s.administra === 'sim' ? 'Sim' : 'Não'}`,
      `Conta gov.br prata ou ouro: ${opcao(GOVBR, s.govbr)}`, '');
  });
  if (p.obs) L.push('OBSERVAÇÃO', p.obs, '');
  return L.filter((x, i) => !(x === '' && i === 1)).join('\n');
}

// o nome de cada anexo na pasta do Drive: "SÓCIO 1 - FULANO DE TAL - cnh.pdf", "SÓCIO 2 - FULANA - CERTIDÃO DE CASAMENTO -
// certidao.pdf" ou "OUTROS - contrato.pdf"
export function nomeDoAnexo(grupo, socios, nome) {
  const arq = String(nome || 'arquivo').replace(/[\u0000-\u001f\/\\]+/g, ' ').trim().slice(0, 120) || 'arquivo';
  const m = /^(socio|certidao)-(\d+)$/.exec(String(grupo || ''));
  if (!m) return 'OUTROS - ' + arq;
  const i = Number(m[2]);
  const quem = semAcento(((socios || [])[i] || {}).nome || '').slice(0, 60);
  return `SÓCIO ${i + 1}${quem ? ' - ' + quem : ''}${m[1] === 'certidao' ? ' - CERTIDÃO DE CASAMENTO' : ''} - ${arq}`;
}

// a empresa do pedido (a coluna empresa e o título da tarefa): a 1ª opção de razão social; na alteração, nenhuma (o
// formulário não pergunta: o escritório sabe de quem é), e a tarefa leva o nome de quem preencheu
export const empresaDoPedido = p => String((p && p.tipo !== 'alteracao' && p.razao1) || '');
// a pasta do pedido no Drive, em maiúsculas (o padrão do Drive): a empresa; na alteração, "ALTERAÇÃO - " e o nome de quem
// preencheu
export const pastaDoPedido = p => {
  const alt = !!(p && p.tipo === 'alteracao');
  const base = alt ? ((p.contato || {}).nome || '') : empresaDoPedido(p);
  const nome = String(base).toUpperCase().replace(/[\u0000-\u001f\/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!nome) return 'PEDIDO';
  return ((alt ? 'ALTERAÇÃO - ' : '') + nome).slice(0, 150);
};
