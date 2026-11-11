// ============================================================
// MACEDO & REIS — As vedações ao Simples Nacional que o cadastro mostra
// Módulo ES puro, sem DOM e sem import. Pergunta do Samuel, 11/11/2026, com o estudo da primeira empresa do regime geral
// no Comparativo tributário: "o comparativo leva em conta se a empresa possui CNAE impeditivo para dizer 'pode ser do
// Simples'?" — não levava: olhava só a receita, o limite e as empresas dos sócios, e dizia "o Simples é uma opção" de uma
// empresa com sócia pessoa jurídica e dois CNAEs secundários impeditivos.
//
// O que confere, pelo cadastro:
//   · o CNAE principal e os secundários contra o Anexo VI (impeditivos) e o Anexo VII (os que abrangem atividade
//     impeditiva e permitida) da Resolução CGSN nº 140/2018 — a opção olha todos os CNAEs informados no CNPJ, não só o
//     principal (art. 8º, §1º);
//   · pessoa jurídica no quadro de sócios (LC 123/2006, art. 3º, §4º, I);
//   · a natureza jurídica, pelo código ou pelo nome, que é como a consulta do CNPJ grava no cadastro (sociedade por
//     ações, cooperativa, filial de empresa estrangeira — art. 3º, §4º, II, VI e X; e a que não é sociedade empresária,
//     sociedade simples nem empresário, como a associação: fora do conceito de ME e EPP do art. 3º, caput);
//   · as pendências do relatório de situação fiscal que a ponte da Receita trouxe (débito sem exigibilidade suspensa
//     impede a opção — art. 17, V): ficam "a conferir", porque o relatório não diz se a exigibilidade está suspensa.
// O que NÃO confere (o cadastro não tem): NAO_CONFERE, dito na tela.
//
// AS LISTAS (conferidas em 11/11/2026): os 101 códigos do Anexo VI e os 22 do Anexo VII, iguais em duas cópias — o texto
// consolidado da Res. CGSN 140/2018 na LegisWeb (com as alterações até a Res. CGSN 190/2026) e a tabela da Lefisc. O
// Anexo VII está com as Res. CGSN 150/2019 (saíram 6201-5/01, 6202-3/00 e 6203-1/00) e 156/2020 (entrou 4635-4/99). O
// site de normas da Receita (Sijut) não abriu pela ferramenta de leitura: a conferência no texto oficial fica pendente.
// Mudou a lista (resolução nova do CGSN): troque aqui e a data. Testado por tests/simples-vedacoes.test.mjs.
// ============================================================

export const LISTAS_CONFERIDAS_EM = '2026-11-11';

// Anexo VI — códigos previstos na CNAE impeditivos ao Simples Nacional
const ANEXO_VI = [
  '1220-4/01', '1220-4/02', '1220-4/03', '2092-4/01', '2550-1/01', '2550-1/02', '2910-7/01', '3091-1/01', '3511-5/01', '3511-5/02',
  '3512-3/00', '3513-1/00', '3514-0/00', '4110-7/00', '4636-2/02', '4912-4/01', '4922-1/01', '4922-1/02', '5310-5/01', '6410-7/00',
  '6421-2/00', '6422-1/00', '6423-9/00', '6424-7/01', '6424-7/02', '6424-7/03', '6424-7/04', '6431-0/00', '6432-8/00', '6433-6/00',
  '6434-4/00', '6435-2/01', '6435-2/02', '6435-2/03', '6436-1/00', '6437-9/00', '6438-7/01', '6438-7/99', '6440-9/00', '6450-6/00',
  '6461-1/00', '6462-0/00', '6463-8/00', '6470-1/01', '6470-1/02', '6470-1/03', '6491-3/00', '6492-1/00', '6499-9/01', '6499-9/02',
  '6499-9/03', '6499-9/04', '6499-9/05', '6499-9/99', '6511-1/01', '6511-1/02', '6512-0/00', '6520-1/00', '6530-8/00', '6541-3/00',
  '6542-1/00', '6611-8/01', '6611-8/02', '6611-8/03', '6611-8/04', '6612-6/01', '6612-6/02', '6612-6/03', '6612-6/04', '6612-6/05',
  '6619-3/01', '6619-3/03', '6619-3/04', '6810-2/02', '6810-2/03', '6911-7/02', '6912-5/00', '7820-5/00', '7830-2/00', '8112-5/00',
  '8299-7/04', '8411-6/00', '8412-4/00', '8413-2/00', '8421-3/00', '8422-1/00', '8423-0/00', '8424-8/00', '8425-6/00', '8430-2/00',
  '8550-3/01', '9411-1/00', '9412-0/01', '9412-0/99', '9420-1/00', '9430-8/00', '9491-0/00', '9492-8/00', '9493-6/00', '9499-5/00',
  '9900-8/00'
];
// Anexo VII — códigos que abrangem concomitantemente atividade impeditiva e permitida
const ANEXO_VII = [
  '1113-5/02', '4635-4/02', '4635-4/03', '4635-4/99', '4684-2/99', '4924-8/00', '4929-9/02', '4929-9/04', '4929-9/99', '4950-7/00',
  '5011-4/02', '5091-2/02', '5099-8/01', '5099-8/99', '5111-1/00', '5112-9/01', '5112-9/99', '5229-0/01', '5229-0/99', '6619-3/02',
  '6619-3/99', '8299-7/99'
];
const so = s => String(s).replace(/\D/g, '');
export const CNAES_IMPEDITIVOS = new Set(ANEXO_VI.map(so));
export const CNAES_AMBIGUOS = new Set(ANEXO_VII.map(so));

// os dígitos do código (o cadastro guarda "1091-1/02 - Fabricação de produtos de padaria…"; com 6 dígitos, falta o zero da frente)
export function codigoCnae(cnae) {
  let d = so(String(cnae || '').split(/\s+-\s+/)[0]);
  if (d.length === 6) d = '0' + d;
  return d.length === 7 ? d : '';
}
const formatado = d => d.slice(0, 4) + '-' + d.slice(4, 5) + '/' + d.slice(5);
// o código formatado e o nome da atividade, como o cadastro escreve
const rotuloCnae = cnae => {
  const d = codigoCnae(cnae), nome = String(cnae || '').split(/\s+-\s+/).slice(1).join(' - ').trim();
  return formatado(d) + (nome ? ' (' + nome + ')' : '');
};
export const cnaeImpeditivo = cnae => CNAES_IMPEDITIVOS.has(codigoCnae(cnae));
export const cnaeAmbiguo = cnae => CNAES_AMBIGUOS.has(codigoCnae(cnae));

// a natureza jurídica que tira a empresa do Simples. O cadastro guarda o código da tabela da CONCLA ("2062",
// "206-2 - Sociedade Empresária Limitada") ou só o nome, que é o que a consulta do CNPJ traz ("Sociedade Anônima
// Fechada"): vale o código e, sem ele, o nome (sem acento e sem maiúscula)
const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const NATUREZAS = [
  { cod: '2046', nome: /sociedade anonima aberta/, texto: 'sociedade anônima aberta', base: 'LC 123, art. 3º, §4º, X' },
  { cod: '2054', nome: /sociedade anonima fechada/, texto: 'sociedade anônima fechada', base: 'LC 123, art. 3º, §4º, X' },
  { cod: '2097', nome: /comandita por acoes/, texto: 'sociedade em comandita por ações', base: 'LC 123, art. 3º, §4º, X' },
  { cod: '2143', nome: /^cooperativa$/, texto: 'cooperativa', nota: 'só a cooperativa de consumo pode optar', base: 'LC 123, art. 3º, §4º, VI' },
  { cod: '2178', nome: /estabelecimento, no brasil, de sociedade estrangeira/, texto: 'estabelecimento, no Brasil, de sociedade estrangeira', base: 'LC 123, art. 3º, §4º, II' },
  { cod: '2011', nome: /empresa publica/, texto: 'empresa pública', base: 'LC 123, art. 17, III' },
  { cod: '2038', nome: /sociedade de economia mista/, texto: 'sociedade de economia mista', base: 'LC 123, art. 3º, §4º, X, e art. 17, III' }
];
// a que não é sociedade empresária, sociedade simples nem empresário: a administração pública (os códigos 1xx-x) e as
// entidades sem fins lucrativos (3xx-x: associação, fundação, sindicato, igreja, condomínio, cartório)
const FORA_DO_CONCEITO = /associacao|fundacao|entidade sindical|organizacao religiosa|condominio|cartorio|servico notarial|partido politico|autarquia|orgao publico/;
const BASE_CONCEITO = 'LC 123, art. 3º, caput';
// o código (4 dígitos) no começo do texto, e o nome sem ele
function lerNatureza(valor) {
  const t = String(valor == null ? '' : valor).trim();
  const m = /^(\d{3})-?(\d)(?!\d)\s*(?:-\s*)?(.*)$/.exec(t);
  return m ? { cod: m[1] + m[2], nome: m[3].trim() } : { cod: '', nome: t };
}
// "Natureza jurídica 205-4 (Sociedade Anônima Fechada)", "Natureza jurídica 205-4: sociedade anônima fechada" (só o código
// no cadastro) ou "Natureza jurídica: Sociedade Anônima Fechada" (só o nome)
const rotuloNatureza = (n, nome) => 'Natureza jurídica' + (n.cod ? ' ' + n.cod.slice(0, 3) + '-' + n.cod.slice(3) + (n.nome ? ' (' + n.nome + ')' : nome ? ': ' + nome : '') : ': ' + n.nome);

export const BASE_CNAE_IMPEDITIVO = 'Res. CGSN 140/2018, art. 8º, §1º, I, e Anexo VI';
export const BASE_CNAE_AMBIGUO = 'Res. CGSN 140/2018, art. 8º, §1º, II, e Anexo VII';
// o que o cadastro não deixa conferir: dito na tela, pra ninguém ler "sem impedimento" como "pode optar"
export const NAO_CONFERE = [
  'sócio domiciliado no exterior (LC 123, art. 17, II)',
  'participação da empresa no capital de outra (art. 3º, §4º, VII)',
  'cisão ou desmembramento nos últimos 5 anos (art. 3º, §4º, IX)',
  'cessão ou locação de mão de obra de fato, além do CNAE (art. 17, XII)',
  'débito com o Estado, o Município ou o INSS (art. 17, V)'
];

const pct = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

// cnaePrincipal e cnaesSecundarios: como o cadastro guarda (o código com o nome) · naturezaJuridica: o código
// socios: [{ nome, pj (o documento é um CNPJ), participacao }] — null = o cadastro não foi lido; o documento não entra aqui
// pendencias: as do relatório de situação fiscal ([{ orgao, titulo }]; null = a ponte da Receita não consultou) e o dia dele
// Volta { impedimentos, conferir, vedado, semDado, secundarios } — cada item: { tipo, texto, base, remedio? }
//   impedimentos: o que veda a opção hoje · conferir: o que pode vedar e o cadastro não decide
//   semDado: o que faltou no cadastro pra conferir ('o CNAE', 'os sócios', 'a natureza jurídica')
//   secundarios: quantos CNAEs secundários o cadastro tem (0 = nenhum no cadastro: ou a empresa não tem, ou não foram lidos)
//   comSocios: o cadastro tem sócios pra olhar (o empresário individual sem ninguém no quadro não é dado que falta)
export function vedacoesDoSimples({ cnaePrincipal = null, cnaesSecundarios = null, naturezaJuridica = null, socios = null, pendencias = null, pendenciasEm = null } = {}) {
  const impedimentos = [], conferir = [], semDado = [];
  const principal = codigoCnae(cnaePrincipal);
  if (!principal) semDado.push('o CNAE');
  const vistos = new Set();
  const olhar = (cnae, onde) => {
    const d = codigoCnae(cnae);
    if (!d || vistos.has(d)) return;
    vistos.add(d);
    if (CNAES_IMPEDITIVOS.has(d)) {
      impedimentos.push({ tipo: 'cnae', onde, codigo: formatado(d), texto: (onde === 'principal' ? 'CNAE principal impeditivo: ' : 'CNAE secundário impeditivo: ') + rotuloCnae(cnae), base: BASE_CNAE_IMPEDITIVO,
        ...(onde === 'secundario' ? { remedio: 'Basta constar no CNPJ pra impedir a opção. Se a empresa não exerce a atividade, tirar o CNAE por alteração resolve.' } : {}) });
    } else if (CNAES_AMBIGUOS.has(d)) {
      conferir.push({ tipo: 'cnae', onde, codigo: formatado(d), texto: (onde === 'principal' ? 'CNAE principal' : 'CNAE secundário') + ' que abrange atividade impeditiva e permitida: ' + rotuloCnae(cnae) + '. A opção pede a declaração de que a empresa só exerce a permitida', base: BASE_CNAE_AMBIGUO });
    }
  };
  olhar(cnaePrincipal, 'principal');
  const sec = (Array.isArray(cnaesSecundarios) ? cnaesSecundarios : []).filter(c => codigoCnae(c));
  sec.forEach(c => olhar(c, 'secundario'));

  const nat = lerNatureza(naturezaJuridica), nomeNat = semAcento(nat.nome);
  // o empresário individual não tem quadro de sócios: a lista vazia não é dado que falta
  const individual = nat.cod === '2135' || /empresario \(individual\)|empresario individual/.test(nomeNat);
  if (socios == null) { if (!individual) semDado.push('os sócios'); }
  else {
    if (!socios.length && !individual) semDado.push('os sócios');
    socios.filter(s => s && s.pj).forEach(s => impedimentos.push({ tipo: 'socio_pj',
      texto: 'Pessoa jurídica no quadro de sócios: ' + (s.nome || 'sem nome no cadastro') + (Number(s.participacao) > 0 ? ' (' + pct(s.participacao) + '% do capital)' : ''), base: 'LC 123, art. 3º, §4º, I' }));
  }

  if (!nat.cod && !nat.nome) semDado.push('a natureza jurídica');
  else {
    const vedada = NATUREZAS.find(x => (nat.cod ? x.cod === nat.cod : x.nome.test(nomeNat)));
    if (vedada) impedimentos.push({ tipo: 'natureza', texto: rotuloNatureza(nat, vedada.texto) + (vedada.nota ? ' — ' + vedada.nota : ''), base: vedada.base });
    else if (nat.cod ? /^[13]/.test(nat.cod) : FORA_DO_CONCEITO.test(nomeNat)) impedimentos.push({ tipo: 'natureza',
      texto: rotuloNatureza(nat) + ' — não é sociedade empresária, sociedade simples nem empresário, e fica fora do conceito de microempresa e de empresa de pequeno porte', base: BASE_CONCEITO });
  }

  const pend = Array.isArray(pendencias) ? pendencias.filter(Boolean) : [];
  if (pend.length) conferir.push({ tipo: 'debito', texto: 'O relatório de situação fiscal' + (dataBR(pendenciasEm) ? ' de ' + dataBR(pendenciasEm) : '') + ' tem ' + pend.length + (pend.length === 1 ? ' pendência' : ' pendências')
    + ' na Receita ou na PGFN. Débito sem exigibilidade suspensa impede a opção', base: 'LC 123, art. 17, V' });

  return { impedimentos, conferir, vedado: impedimentos.length > 0, semDado, secundarios: sec.length, comSocios: Array.isArray(socios) && socios.length > 0 };
}

// o que o cadastro deixou conferir, numa frase: "o CNAE principal e os 2 secundários, a natureza jurídica e os sócios"
// (o que faltou no cadastro fica de fora: semDado). Sem CNAE secundário no cadastro, diz — a empresa pode não ter, ou o
// cadastro pode não ter sido completado com o cartão CNPJ
export function oQueConferiu(v) {
  const sem = (v && v.semDado) || [];
  const n = Number(v && v.secundarios) || 0;
  const cnae = n > 1 ? 'o CNAE principal e os ' + n + ' secundários' : n === 1 ? 'o CNAE principal e o secundário' : 'o CNAE principal (sem secundário no cadastro)';
  const olhou = [['o CNAE', cnae], ['a natureza jurídica', 'a natureza jurídica'], ['os sócios', 'os sócios']].filter(([k]) => !sem.includes(k) && (k !== 'os sócios' || (v && v.comSocios !== false))).map(([, t]) => t);
  return olhou.length > 1 ? olhou.slice(0, -1).join(', ') + ' e ' + olhou[olhou.length - 1] : olhou.join('');
}

// as vedações numa frase: "pessoa jurídica no quadro de sócios: X (50% do capital) (LC 123, art. 3º, §4º, I) · CNAE secundário…"
export function resumoDasVedacoes(v, { comBase = true } = {}) {
  const itens = (v && v.impedimentos) || [];
  // a primeira letra minúscula, menos na sigla ("CNAE secundário…")
  const minuscula = t => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
  return itens.map(i => minuscula(i.texto) + (comBase ? ' (' + i.base + ')' : '')).join(' · ');
}

// as vedações numa linha, pra opção com o Simples da pergunta "Qual comparativo" (a tela e o assistente): quantos
// impedimentos, ou que nada veda, com o que ficou a conferir. O detalhe (cada impedimento com a base e o remédio, e o que o
// sistema não confere) fica onde o Simples faz parte do estudo: a fase 1 do caminho com ele e o aviso do resultado
export function linhaDasVedacoes(v) {
  if (!v) return 'Sem cadastro, o sistema não confere os impedimentos do Simples.';
  const n = (v.impedimentos || []).length, c = (v.conferir || []).length, sem = v.semDado || [];
  if (v.vedado) return 'Hoje o cadastro veda o Simples pra ela (' + n + (n === 1 ? ' impedimento' : ' impedimentos') + '): ele entra como simulação.';
  const resto = [c ? c + (c === 1 ? ' ponto a conferir' : ' pontos a conferir') : '', sem.length ? 'faltou no cadastro: ' + sem.join(', ') : ''].filter(Boolean).join('; ');
  return (oQueConferiu(v) ? 'Pelo cadastro, nada veda o Simples' : 'O cadastro não tem o que conferir dos impedimentos do Simples') + (resto ? ' (' + resto + ')' : '') + '.';
}
