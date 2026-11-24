// ============================================================================
// MACEDO & REIS — O formulário da constituição de CNPJ e da transformação do MEI em ME (24/11/2026, pedido do Samuel:
// "cria um forms com link pra eu enviar pro cliente poder preencher as informações e anexar os documentos, se nao ele tem
// que enviar pra mim por email ou whats e dificulta mais (tanto pra transformação quanto para constituição)").
// O link público é um só (empresa.html), com o produto no endereço: ?t=constituicao ou ?t=transformacao. As perguntas são
// a documentação dos dois produtos (a lista do Samuel, DOCUMENTOS de societario-produtos.js): os dados da empresa e de cada
// sócio, com o documento de cada sócio anexado — sem o documento de algum sócio, o envio não sai.
// Aqui ficam as perguntas, a conferência do pedido, o resumo da tarefa, o texto das respostas que vai pro Drive e o nome de
// cada anexo. Um arquivo só pro link e pra Edge Function empresa-link, que importa este do repositório num commit fixado
// (tests/empresa-pedido.test.mjs confere). Puro, sem DOM e sem banco.
// ============================================================================
import { cpfValido, soDigitos, UFS, CAMPOS_ENDERECO, formatarCpf, formatarTelefone, enderecoEmLinha, lerValor } from './mei-abertura.js';
import { cnpjValido, normalizarDocumento, formatCNPJ } from './utils.js';

export { UFS, CAMPOS_ENDERECO };

// os dois produtos: o título do link e o da tarefa
export const TIPOS = {
  constituicao: { titulo: 'Abertura de empresa', tarefa: 'Constituição de CNPJ',
    intro: 'Preencha os dados da empresa e de cada sócio e anexe o documento de cada um. Leva uns 10 minutos. Com tudo em mãos, a gente começa a abertura e fala com você pelo WhatsApp.' },
  transformacao: { titulo: 'Transformação do MEI em ME', tarefa: 'Transformação do MEI em ME',
    intro: 'Preencha os dados da empresa e de cada sócio e anexe o documento de cada um. Leva uns 10 minutos. Com tudo em mãos, a gente começa a transformação e fala com você pelo WhatsApp.' }
};
export const tipoDe = t => (Object.prototype.hasOwnProperty.call(TIPOS, t) ? t : null);

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
// o grupo de cada anexo: o documento do sócio N ("socio-0", "socio-1"…) ou os outros documentos
export const OUTROS = 'outros';
export const grupoDoSocio = i => 'socio-' + i;

export const PERGUNTAS = {
  'contato.nome': 'Seu nome completo', 'contato.telefone': 'Seu telefone (WhatsApp)', 'contato.email': 'Seu e-mail',
  cnpjMei: 'CNPJ do MEI', razao1: 'Nome empresarial (razão social): 1ª opção', razao2: 'Nome empresarial (razão social): 2ª opção',
  fantasia: 'Nome fantasia (opcional)', atividades: 'Descrição de todas as atividades da empresa', capital: 'Capital social (R$)',
  funcionamento: 'Horários e dias de funcionamento', areaTotal: 'Área total da edificação (m²)', areaUtilizada: 'Área utilizada pela empresa (m²)',
  empresaTelefone: 'Telefone da empresa', empresaEmail: 'E-mail da empresa', endereco: 'Endereço completo da empresa',
  'socio.nome': 'Nome completo', 'socio.cpf': 'CPF', 'socio.estadoCivil': 'Estado civil', 'socio.regime': 'Regime de bens',
  'socio.profissao': 'Profissão', 'socio.endereco': 'Endereço completo', 'socio.participacao': 'Participação no capital (%)',
  'socio.administra': 'Vai administrar a empresa?', 'socio.govbr': 'Tem a conta gov.br nível prata ou ouro?',
  'socio.documento': 'CNH ou identidade (frente e verso, ou o PDF da CNH digital)', outros: 'Outros documentos (opcional)', obs: 'Alguma observação? (opcional)'
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

// os anexos como a página manda: [{ nome, tamanho, tipo, grupo }] → { lista, erro }
export function conferirAnexos(arquivos, nSocios) {
  const lista = (Array.isArray(arquivos) ? arquivos : []).map(a => ({
    nome: texto(a && a.nome, 180), tamanho: Number(a && a.tamanho) || 0, tipo: texto(a && a.tipo, 120) || 'application/octet-stream',
    grupo: texto(a && a.grupo, 20) }));
  const grupos = new Set([OUTROS, ...Array.from({ length: nSocios }, (_, i) => grupoDoSocio(i))]);
  if (lista.length > MAX_QTD) return { lista, erro: `No máximo ${MAX_QTD} arquivos por envio.` };
  const total = lista.reduce((s, a) => s + a.tamanho, 0);
  if (lista.some(a => !(a.tamanho > 0) || a.tamanho > MAX_ARQ) || total > MAX_TOTAL) return { lista, erro: 'Arquivo grande demais: até 25 MB cada e 100 MB no total.' };
  if (lista.some(a => !a.nome || !grupos.has(a.grupo))) return { lista, erro: 'Arquivo inválido.' };
  return { lista, erro: null };
}

// o pedido como chegou → { pedido } (conferido e limpo) ou { faltam: [ids dos campos], erro }. Os ids são os da página
// ("razao1", "endereco.cep", "socios.0.cpf", "socios.1.documento", "socios.participacao"…), e o erro, a frase pra quem
// não está vendo a página.
export function conferirPedido(b = {}) {
  const faltam = [];
  const tipo = tipoDe(b.tipo);
  if (!tipo) return { faltam: ['tipo'], erro: 'Formulário inválido.' };
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

  const brutos = (Array.isArray(b.socios) ? b.socios : []).slice(0, MAX_SOCIOS);
  if (!brutos.length) brutos.push({});
  const varios = brutos.length > 1;
  const cpfs = new Set();
  p.socios = brutos.map((s0, i) => {
    const s = s0 && typeof s0 === 'object' ? s0 : {};
    const id = k => `socios.${i}.${k}`;
    const x = {
      nome: texto(s.nome, 160), cpf: soDigitos(s.cpf).slice(0, 11), estadoCivil: um(s.estadoCivil, ESTADOS_CIVIS), regime: '',
      profissao: texto(s.profissao, 120), govbr: um(s.govbr, GOVBR),
      participacao: varios ? numero(s.participacao) : 100, administra: varios ? um(s.administra, SIM_NAO) : 'sim'
    };
    if (!nomeCompleto(x.nome)) faltam.push(id('nome'));
    if (!cpfValido(x.cpf) || cpfs.has(x.cpf)) faltam.push(id('cpf'));
    cpfs.add(x.cpf);
    if (!x.estadoCivil) faltam.push(id('estadoCivil'));
    if (x.estadoCivil === 'casado') { x.regime = um(s.regime, REGIMES); if (!x.regime) faltam.push(id('regime')); }
    if ([...x.profissao].length < 2) faltam.push(id('profissao'));
    x.endereco = endereco(s.endereco, id('endereco'), faltam);
    if (!x.govbr) faltam.push(id('govbr'));
    if (varios && !(x.participacao > 0 && x.participacao <= 100)) faltam.push(id('participacao'));
    if (varios && !x.administra) faltam.push(id('administra'));
    return x;
  });
  if (varios && p.socios.every(x => x.participacao > 0)) {
    const soma = p.socios.reduce((t, x) => t + x.participacao, 0);
    if (Math.abs(soma - 100) > 0.01) faltam.push('socios.participacao');
  }
  if (varios && p.socios.every(x => x.administra) && !p.socios.some(x => x.administra === 'sim')) faltam.push('socios.administra');

  // o documento de cada sócio é obrigatório; os outros documentos, não
  const anexos = conferirAnexos(b.arquivos, p.socios.length);
  if (anexos.erro) return { faltam: ['arquivos'], erro: anexos.erro };
  p.socios.forEach((_, i) => { if (!anexos.lista.some(a => a.grupo === grupoDoSocio(i))) faltam.push(`socios.${i}.documento`); });
  if (faltam.length) return { faltam, erro: faltam.length === 1 ? 'Falta 1 resposta.' : 'Faltam ' + faltam.length + ' respostas.' };
  return { pedido: p, arquivos: anexos.lista };
}

// os avisos pro escritório (na tarefa), pelo que a pessoa respondeu
export function alertasDoPedido(p = {}) {
  const a = [];
  (p.socios || []).forEach((s, i) => {
    const quem = s.nome || `Sócio ${i + 1}`;
    if (s.govbr === 'bronze') a.push(`${quem} tem a conta gov.br bronze: precisa subir pra prata ou ouro antes de assinar o Contrato Social.`);
    if (s.govbr === 'nao') a.push(`${quem} não tem a conta gov.br prata ou ouro (ou não sabe): confira antes de mandar o Contrato Social pra assinatura.`);
    if (s.estadoCivil === 'casado' && s.regime === 'nao_sei') a.push(`${quem} é casado(a) e não sabe o regime de bens: confira na certidão de casamento.`);
  });
  if (p.tipo === 'constituicao' && (p.socios || []).length === 1) a.push('Um sócio só: confira se é sociedade limitada unipessoal ou empresário individual.');
  return a;
}

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const m2 = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' m²';
const pct = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
const opcao = (lista, v) => (lista.find(([o]) => o === v) || [null, '—'])[1];
const civil = s => opcao(ESTADOS_CIVIS, s.estadoCivil) + (s.estadoCivil === 'casado' ? ', ' + opcao(REGIMES, s.regime).toLowerCase() : '');

// o resumo da tarefa (a agenda, que a equipe toda vê): sem CPF e sem endereço dos sócios — o resto está no Drive
export function resumoDoPedido(p = {}) {
  const t = TIPOS[p.tipo] || TIPOS.constituicao;
  const c = p.contato || {};
  const linhas = [
    `${t.tarefa}: o formulário preenchido pelo link.`,
    `Quem preencheu: ${c.nome || '—'}` + (c.telefone ? ' · WhatsApp ' + formatarTelefone(c.telefone) : '') + (c.email ? ' · ' + c.email : '')
  ];
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
  L.push('QUEM PREENCHEU', `Nome: ${c.nome}`, `WhatsApp: ${formatarTelefone(c.telefone)}`, `E-mail: ${c.email}`, '');
  if (p.tipo === 'transformacao') L.push('O MEI', `CNPJ: ${formatCNPJ(p.cnpjMei)}`, '');
  L.push('A EMPRESA',
    `Nome empresarial (razão social), 1ª opção: ${p.razao1}`, `Nome empresarial (razão social), 2ª opção: ${p.razao2}`,
    `Nome fantasia: ${p.fantasia || '—'}`, `Endereço: ${enderecoEmLinha(e)}`,
    `Área total da edificação: ${p.areaTotal > 0 ? m2(p.areaTotal) : '—'}`, `Área utilizada: ${p.areaUtilizada > 0 ? m2(p.areaUtilizada) : '—'}`,
    `Horários e dias de funcionamento: ${p.funcionamento}`, `Capital social: ${p.capital > 0 ? brl(p.capital) : '—'}`,
    `Telefone: ${formatarTelefone(p.empresaTelefone)}`, `E-mail: ${p.empresaEmail}`, 'Atividades:', String(p.atividades || ''), '');
  (p.socios || []).forEach((s, i) => {
    L.push(`SÓCIO ${i + 1}`, `Nome: ${s.nome}`, `CPF: ${formatarCpf(s.cpf)}`, `Estado civil: ${civil(s)}`, `Profissão: ${s.profissao}`,
      `Endereço: ${enderecoEmLinha(s.endereco)}`, `Participação no capital: ${pct(s.participacao)}`, `Administra a empresa: ${s.administra === 'sim' ? 'Sim' : 'Não'}`,
      `Conta gov.br prata ou ouro: ${opcao(GOVBR, s.govbr)}`, '');
  });
  if (p.obs) L.push('OBSERVAÇÃO', p.obs, '');
  return L.filter((x, i) => !(x === '' && i === 1)).join('\n');
}

// o nome de cada anexo na pasta do Drive: "SÓCIO 1 - FULANO DE TAL - cnh.pdf" ou "OUTROS - contrato.pdf"
export function nomeDoAnexo(grupo, socios, nome) {
  const arq = String(nome || 'arquivo').replace(/[\u0000-\u001f\/\\]+/g, ' ').trim().slice(0, 120) || 'arquivo';
  const m = /^socio-(\d+)$/.exec(String(grupo || ''));
  if (!m) return 'OUTROS - ' + arq;
  const i = Number(m[1]);
  const quem = semAcento(((socios || [])[i] || {}).nome || '').slice(0, 60);
  return `SÓCIO ${i + 1}${quem ? ' - ' + quem : ''} - ${arq}`;
}

// a pasta do pedido no Drive: a 1ª opção de razão social, em maiúsculas (o padrão do Drive)
export const pastaDoPedido = p => (String((p && p.razao1) || '').toUpperCase().replace(/[\u0000-\u001f\/\\]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'PEDIDO');
