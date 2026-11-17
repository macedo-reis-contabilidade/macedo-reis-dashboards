// Macedo & Reis — o formulário de admissão que a empresa preenche (admissao.html): as regras do que é obrigatório.
// 17/11/2026, pedido da Vitória: "sem esses documentos e informações o cliente não vai conseguir enviar a admissão".
// Puro e sem import: o link público carrega só isto, e o módulo Admissões (o editor do formulário e a ficha) usa as
// mesmas regras. O modelo (admissao_modelos.conteudo.blocos) ganhou duas marcas, as duas opcionais:
//   - na lista de documentos, anexo_obrigatorio: true = cada documento da lista tem o seu lugar de anexar, e sem um
//     arquivo em cada um o formulário não é enviado; o documento com "frente e verso" no nome pede os dois lados;
//   - na pergunta (e na declaração), so_se: { id, valor } = só aparece, e só é exigida, quando a resposta da pergunta
//     com esse id for esse valor (o prazo do contrato de experiência só com o tipo de contrato "Experiência").

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpo = s => String(s == null ? '' : s).trim();
const lista = v => (Array.isArray(v) ? v : []);

export const LIMITE_GRUPO = 100;                       // a função admissao-link guarda até 120 caracteres do grupo do arquivo
export const NOME_DO_LADO = { f: 'frente', v: 'verso' };
export const MESMO_ARQUIVO = 'No mesmo arquivo da frente';
// a empresa e quem preenche: fixos do link, fora do modelo
export const IDENT = [
  { k: 'empresa', rot: 'Empresa (razão social)', tipo: 'text' },
  { k: 'contato', rot: 'Seu nome', tipo: 'text' },
];

// o documento que pede os dois lados: "frente e verso" no nome (RG, CNH)
export const pedeFrenteEVerso = item => /\bfrente\s+e\s+(o\s+)?verso\b/.test(semAcento(item));
// a lista em que cada documento tem de ser anexado (a lista "só quando se aplica" nunca é exigida)
export const anexoObrigatorio = b => !!(b && b.tipo === 'documentos' && b.anexo_obrigatorio === true && !b.condicional);
export const itensDe = b => lista(b && b.itens).map(limpo).filter(Boolean);
export const opcoesDe = b => lista(b && b.opcoes).map(o => limpo(typeof o === 'string' ? o : o && o.texto)).filter(Boolean);
// o "grupo" que vai com cada arquivo: o documento (e o lado); a ficha da admissão acha o documento de volta por ele
export const grupoDoAnexo = (item, lado) => limpo(item).slice(0, LIMITE_GRUPO) + (NOME_DO_LADO[lado] ? ` (${NOME_DO_LADO[lado]})` : '');
export const itemDoGrupo = grupo => limpo(grupo).replace(/ \((frente|verso)\)$/, '');
export const arquivosDoItem = (arquivos, item) => {
  const alvo = limpo(item).slice(0, LIMITE_GRUPO);
  return alvo ? lista(arquivos).filter(x => x && x.status === 'ok' && itemDoGrupo(x.grupo) === alvo).length : 0;
};

// os lugares de anexar, na ordem da tela. Lista comum: um só, da lista inteira, opcional (a chave é o número do bloco).
// Lista com anexo obrigatório: um por documento ("2-0") ou dois no documento de frente e verso ("2-1-f" e "2-1-v").
export function vagasDeAnexo(blocos) {
  const vagas = [];
  lista(blocos).forEach((b, i) => {
    if (!b || b.tipo !== 'documentos') return;
    const titulo = limpo(b.titulo) || 'Documentos';
    if (!anexoObrigatorio(b)) { vagas.push({ chave: String(i), par: null, bloco: i, item: null, lado: null, obrigatoria: false, rotulo: titulo, grupo: titulo }); return; }
    itensDe(b).forEach((item, n) => {
      const par = `${i}-${n}`;
      if (pedeFrenteEVerso(item)) {
        ['f', 'v'].forEach(lado => vagas.push({ chave: `${par}-${lado}`, par, bloco: i, item: n, lado, obrigatoria: true, rotulo: `${item} (${NOME_DO_LADO[lado]})`, grupo: grupoDoAnexo(item, lado) }));
      } else vagas.push({ chave: par, par: null, bloco: i, item: n, lado: null, obrigatoria: true, rotulo: item, grupo: grupoDoAnexo(item) });
    });
  });
  return vagas;
}

// "só aparece quando": a condição da pergunta ou da declaração (nula quando não tem, ou veio pela metade)
export const condicaoDe = b => {
  const c = b && (b.tipo === 'pergunta' || b.tipo === 'declaracao') ? b.so_se : null;
  if (!c || typeof c !== 'object') return null;
  const id = limpo(c.id), valor = limpo(c.valor);
  return id && valor ? { id, valor } : null;
};
const donoDoId = bl => {
  const dono = new Map();
  bl.forEach((b, i) => { if (b && b.tipo === 'pergunta' && limpo(b.id) && !dono.has(limpo(b.id))) dono.set(limpo(b.id), i); });
  return dono;
};

// quais blocos aparecem, dadas as respostas de agora (valores: { número do bloco: resposta }). A condição quebrada
// (a pergunta de que depende não existe mais, ou a opção saiu da lista) deixa a pergunta à vista: melhor perguntar
// a mais do que esconder uma obrigatória. Quem depende de uma pergunta escondida fica escondido junto.
export function blocosVisiveis(blocos, valores = {}) {
  const bl = lista(blocos), dono = donoDoId(bl), visto = new Map();
  const ve = (i, caminho) => {
    if (visto.has(i)) return visto.get(i);
    let r = true;
    const c = condicaoDe(bl[i]);
    const j = c ? dono.get(c.id) : undefined;
    if (c && j !== undefined && j !== i && !caminho.includes(j)) {
      const de = bl[j];
      if (de.formato !== 'escolha' || opcoesDe(de).includes(c.valor)) r = ve(j, [...caminho, i]) && limpo(valores[j]) === c.valor;
    }
    visto.set(i, r);
    return r;
  };
  return bl.map((_, i) => ve(i, []));
}

// O que falta pra poder enviar, na ordem da tela. estado: { ident: { empresa, contato }, valores: { bloco: resposta },
// marcados: { bloco: true }, anexos: { chave da vaga: quantos arquivos }, mesmo: { par: true } } — "mesmo" é a caixa
// "a frente e o verso estão no mesmo arquivo", que dispensa o verso (a frente continua exigida).
export function pendencias(modelo, estado = {}) {
  const bl = lista(modelo && modelo.blocos);
  const { ident = {}, valores = {}, marcados = {}, anexos = {}, mesmo = {} } = estado || {};
  const faltam = [];
  IDENT.forEach(c => { if (!limpo(ident[c.k])) faltam.push({ tipo: 'ident', chave: c.k, bloco: null, rotulo: c.rot, acao: 'preencher' }); });
  const ve = blocosVisiveis(bl, valores), vagas = vagasDeAnexo(bl);
  bl.forEach((b, i) => {
    if (!b) return;
    if (b.tipo === 'documentos') {
      vagas.filter(v => v.bloco === i && v.obrigatoria).forEach(v => {
        if (Number(anexos[v.chave]) > 0) return;
        if (v.lado === 'v' && mesmo[v.par]) return;
        faltam.push({ tipo: 'anexo', chave: v.chave, bloco: i, rotulo: v.rotulo, acao: 'anexar' });
      });
      return;
    }
    if (!ve[i] || !b.obrigatoria) return;
    if (b.tipo === 'pergunta' && !limpo(valores[i])) faltam.push({ tipo: 'pergunta', chave: 'q' + i, bloco: i, rotulo: limpo(b.rotulo) || 'Pergunta', acao: b.formato === 'escolha' ? 'escolher' : 'preencher' });
    if (b.tipo === 'declaracao' && !marcados[i]) faltam.push({ tipo: 'declaracao', chave: 'q' + i, bloco: i, rotulo: limpo(b.rotulo) || 'Ciente', acao: 'marcar' });
  });
  return faltam;
}

// as respostas que vão no envio: só as perguntas que apareceram; o verso dispensado vai dito, pra ficha do DP mostrar
export function respostasDoEnvio(modelo, estado = {}) {
  const bl = lista(modelo && modelo.blocos);
  const { valores = {}, marcados = {}, anexos = {}, mesmo = {} } = estado || {};
  const ve = blocosVisiveis(bl, valores), vagas = vagasDeAnexo(bl);
  const respostas = [];
  let secao = '';
  bl.forEach((b, i) => {
    if (!b) return;
    if (b.tipo === 'secao') { secao = b.titulo || secao; return; }
    if (b.tipo === 'documentos') {
      secao = b.titulo || secao;
      vagas.filter(v => v.bloco === i && v.lado === 'v' && mesmo[v.par] && !(Number(anexos[v.chave]) > 0))
        .forEach(v => respostas.push({ id: 'anexo_' + v.chave, rotulo: v.rotulo, tipo: 'anexo', secao, valor: MESMO_ARQUIVO }));
      return;
    }
    if (!ve[i]) return;
    if (b.tipo === 'pergunta') respostas.push({ id: b.id, rotulo: b.rotulo, tipo: b.formato || 'texto', secao, valor: limpo(valores[i]) });
    if (b.tipo === 'declaracao') respostas.push({ id: b.id, rotulo: b.rotulo || 'Ciente', tipo: 'declaracao', secao: b.titulo || secao, valor: marcados[i] ? 'Sim' : 'Não', texto: b.texto || '' });
  });
  return respostas;
}

// o aviso do alto do formulário: o que tem de ser anexado e o que tem de ser preenchido (o que depende de outra
// resposta fica de fora da lista: aparece, já como obrigatório, quando for o caso)
export function obrigatoriosDoModelo(blocos) {
  const anexos = [], campos = [];
  lista(blocos).forEach(b => {
    if (!b) return;
    if (anexoObrigatorio(b)) anexos.push(...itensDe(b));
    else if (b.tipo === 'pergunta' && b.obrigatoria && !condicaoDe(b) && limpo(b.rotulo)) campos.push(limpo(b.rotulo));
  });
  return { anexos, campos: [...new Set(campos)] };
}

// o que impede salvar o formulário no editor ('' = nada): a condição pela metade, a pergunta de que ela depende que
// saiu, veio pra baixo ou perdeu a opção, e a lista "só quando se aplica" com anexo obrigatório
export function problemaDoModelo(blocos) {
  const bl = lista(blocos), dono = donoDoId(bl);
  for (const [i, b] of bl.entries()) {
    if (!b) continue;
    const onde = `(item ${i + 1})`;
    if (b.tipo === 'documentos' && b.anexo_obrigatorio && b.condicional) {
      return `"${limpo(b.titulo) || 'Documentos'}" não pode ser "só quando se aplica" e ter anexo obrigatório ao mesmo tempo ${onde}.`;
    }
    if (b.so_se == null || (b.tipo !== 'pergunta' && b.tipo !== 'declaracao')) continue;
    const nome = `"${limpo(b.rotulo) || 'Pergunta'}"`;
    const c = condicaoDe(b);
    if (!c) return `${nome}: escolha a resposta que faz a pergunta aparecer ${onde}.`;
    const j = dono.get(c.id);
    if (j === undefined) return `${nome} depende de uma pergunta que não está mais no formulário ${onde}.`;
    const de = bl[j], nomeDe = `"${limpo(de.rotulo) || 'Pergunta'}"`;
    if (j >= i) return `${nome} precisa vir depois de ${nomeDe}, a pergunta de que ela depende ${onde}.`;
    if (de.formato !== 'escolha') return `${nome} depende de ${nomeDe}, que precisa ser uma pergunta de escolha ${onde}.`;
    if (!opcoesDe(de).includes(c.valor)) return `${nome} aparece com a resposta "${c.valor}", que não está mais nas opções de ${nomeDe} ${onde}.`;
  }
  return '';
}
