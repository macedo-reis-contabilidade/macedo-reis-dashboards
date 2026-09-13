// Importação de notas fiscais eletrônicas (NF-e, NFC-e, NFS-e nacional e ABRASF) para a base.
// Módulo compartilhado: o importador (fiscal-xml.html), a ficha da Reforma e o lote da
// campanha usam este mesmo código — o comportamento é um só, aconteça onde acontecer.
//
// Precisa de DOMParser (navegador) e, para ZIP, de JSZip carregado na página (window.JSZip).

export const dig = s => String(s == null ? '' : s).replace(/\D/g, '');
const num = v => { const n = Number(String(v == null ? '' : v).trim()); return isFinite(n) ? n : 0; };

// ---------- parse ----------
const byName = (el, name) => el ? el.getElementsByTagNameNS('*', name) : [];
const first = (el, name) => byName(el, name)[0] || null;
const txt = (el, name) => { const n = first(el, name); return n ? (n.textContent || '').trim() : null; };
const childByLocal = (el, name) => el ? [...el.children].find(c => c.localName === name) || null : null;

// devolve { kind:'nfe', doc, itens } | { kind:'nfse', lista:[{ doc, itens }] } | { kind:'evento', modelo, chave, cancel, homologado, tpEvento, cStat } | { kind:'ignorado', motivo }
export function parseXml(texto, nome){
  const dom = new DOMParser().parseFromString(texto, 'application/xml');
  if (dom.getElementsByTagName('parsererror').length) throw new Error('XML mal formado');
  const root = dom.documentElement; const rl = root.localName;
  if (rl === 'procEventoNFe' || rl === 'evento' || rl === 'retEnvEvento') {
    // evento da NFS-e nacional (cancelamento etc.) identifica a nota por chNFSe
    if (first(dom, 'chNFSe')) return parseEventoNfseNacional(dom);
    // o pedido (<evento>) não prova nada: só vale com o retorno da SEFAZ homologando (135/136/155)
    const ev = first(dom, 'evento'), ret = first(dom, 'retEvento');
    const inf = first(ev || dom, 'infEvento');
    const cStatEv = txt(first(ret || (rl === 'retEnvEvento' ? dom : null), 'infEvento'), 'cStat');
    const tpEvento = txt(inf, 'tpEvento');
    return { kind: 'evento', modelo: 'nfe', chave: txt(inf, 'chNFe'), tpEvento, cancel: tpEvento === '110111', cStat: cStatEv, homologado: ['135', '136', '155'].includes(cStatEv) };
  }
  if (rl === 'pedRegEvento') return { kind: 'ignorado', motivo: 'pedido de evento de NFS-e ainda sem processamento (baixe o evento processado)' };
  if (first(dom, 'infNFSe')) return parseNfseNacional(dom, nome);
  if (rl === 'DPS' || first(dom, 'infDPS')) return { kind: 'ignorado', motivo: 'DPS (declaração de serviço) sem a NFS-e gerada — baixe o XML da NFS-e no portal' };
  if (/^(NfseCancelamento|CancelarNfseResposta|CancelarNfseResultado|CancelamentoNfse)$/i.test(rl)) return parseCancelAbrasf(dom);
  if (first(dom, 'InfNfse') || first(dom, 'infNfse')) return parseNfseAbrasf(dom, nome);
  const infNFe = first(dom, 'infNFe');
  if (!infNFe) {
    if (/nfse|Nfse|NFS-e|ConsultarNfse|CompNfse/i.test(rl)) return { kind: 'ignorado', motivo: 'NFS-e em layout que não reconheço (' + rl + ')' };
    if (/^cte|CTe/i.test(rl) || first(dom, 'infCte')) return { kind: 'ignorado', motivo: 'CT-e' };
    if (/^mdfe|MDFe/i.test(rl) || first(dom, 'infMDFe')) return { kind: 'ignorado', motivo: 'MDF-e' };
    return { kind: 'ignorado', motivo: 'XML não reconhecido (' + rl + ')' };
  }
  const chave = String(infNFe.getAttribute('Id') || '').replace(/^NFe/i, '').trim();
  if (!/^\d{44}$/.test(chave)) throw new Error('chave de acesso inválida');
  const ide = childByLocal(infNFe, 'ide'), emit = childByLocal(infNFe, 'emit'), dest = childByLocal(infNFe, 'dest');
  const tot = first(childByLocal(infNFe, 'total'), 'ICMSTot');
  const dh = txt(ide, 'dhEmi') || txt(ide, 'dEmi') || '';
  const data = dh.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('data de emissão ausente');
  // protocolo: 100/150 autorizada; 101/135/151 cancelada; 110/301/302/303 denegada; qualquer outro
  // cStat é rejeição (a nota não existe na SEFAZ) → ignorada. Sem protNFe: aceita como autorizada (XML sem protocolo).
  const prot = first(dom, 'protNFe');
  const cStat = txt(prot, 'cStat');
  let status = 'autorizada';
  if (prot && cStat) {
    if (['101', '135', '151'].includes(cStat)) status = 'cancelada';
    else if (['110', '301', '302', '303'].includes(cStat)) status = 'denegada';
    else if (!['100', '150'].includes(cStat)) return { kind: 'ignorado', motivo: 'NF-e não autorizada pela SEFAZ (cStat ' + cStat + ')' };
  }
  const enderEmit = childByLocal(emit, 'enderEmit'), enderDest = childByLocal(dest, 'enderDest');
  let dest_tipo = 'PF', dest_doc = null;
  if (dest) {
    if (txt(dest, 'CNPJ')) { dest_tipo = 'PJ'; dest_doc = dig(txt(dest, 'CNPJ')); }
    else if (txt(dest, 'CPF')) { dest_tipo = 'PF'; dest_doc = dig(txt(dest, 'CPF')); }
    else if (txt(dest, 'idEstrangeiro') != null) { dest_tipo = 'EX'; dest_doc = txt(dest, 'idEstrangeiro') || null; }
  }
  const itens = [];
  [...byName(infNFe, 'det')].forEach(det => {
    const prod = childByLocal(det, 'prod'), imp = childByLocal(det, 'imposto');
    const icms = first(imp, 'ICMS'), pis = first(imp, 'PIS'), cofins = first(imp, 'COFINS'), ipi = first(imp, 'IPI');
    itens.push({
      n_item: Number(det.getAttribute('nItem')) || itens.length + 1,
      codigo: txt(prod, 'cProd'), descricao: txt(prod, 'xProd'), ncm: dig(txt(prod, 'NCM')) || null, cest: dig(txt(prod, 'CEST')) || null,
      cfop: dig(txt(prod, 'CFOP')) || null, unidade: txt(prod, 'uCom'), quantidade: num(txt(prod, 'qCom')), valor_unitario: num(txt(prod, 'vUnCom')),
      valor_total: num(txt(prod, 'vProd')), desconto: num(txt(prod, 'vDesc')),
      icms_origem: txt(icms, 'orig'), icms_cst: txt(icms, 'CST'), csosn: txt(icms, 'CSOSN'),
      pis_cst: txt(pis, 'CST'), cofins_cst: txt(cofins, 'CST'),
      icms_valor: num(txt(icms, 'vICMS')), icms_st_valor: num(txt(icms, 'vICMSST')), ipi_valor: num(txt(ipi, 'vIPI')),
      pis_valor: num(txt(pis, 'vPIS')), cofins_valor: num(txt(cofins, 'vCOFINS'))
    });
  });
  const principal = itens.reduce((m, i) => (!m || i.valor_total > m.valor_total) ? i : m, null);
  const doc = {
    chave, modelo: txt(ide, 'mod') || '55', serie: txt(ide, 'serie'), numero: txt(ide, 'nNF'), data_emissao: data,
    tp_nf: txt(ide, 'tpNF') != null ? Number(txt(ide, 'tpNF')) : null, finalidade: txt(ide, 'finNFe') != null ? Number(txt(ide, 'finNFe')) : null,
    natureza_operacao: txt(ide, 'natOp'),
    emit_doc: dig(txt(emit, 'CNPJ') || txt(emit, 'CPF')) || null, emit_nome: txt(emit, 'xNome'), emit_uf: txt(enderEmit, 'UF'), emit_municipio: txt(enderEmit, 'xMun'),
    emit_ie: txt(emit, 'IE'), emit_crt: txt(emit, 'CRT') != null ? Number(txt(emit, 'CRT')) : null,
    dest_doc, dest_tipo, dest_nome: txt(dest, 'xNome'), dest_uf: txt(enderDest, 'UF'), dest_municipio: txt(enderDest, 'xMun'),
    dest_ie: txt(dest, 'IE'), dest_ind_ie: txt(dest, 'indIEDest') != null ? Number(txt(dest, 'indIEDest')) : null,
    valor_total: num(txt(tot, 'vNF')), valor_produtos: num(txt(tot, 'vProd')), valor_desconto: num(txt(tot, 'vDesc')), valor_frete: num(txt(tot, 'vFrete')),
    icms: num(txt(tot, 'vICMS')), icms_st: num(txt(tot, 'vST')), ipi: num(txt(tot, 'vIPI')), pis: num(txt(tot, 'vPIS')), cofins: num(txt(tot, 'vCOFINS')),
    cfop_principal: principal ? principal.cfop : null, status, xml_nome: nome
  };
  return { kind: 'nfe', doc, itens };
}

// ---------- NFS-e ----------
const UF_IBGE = { 11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF' };
const ufDoIbge = c => UF_IBGE[dig(c).slice(0, 2)] || null;
const dataDe = s => { const d = String(s || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
const txtChild = (el, name) => { const n = childByLocal(el, name); return n ? (n.textContent || '').trim() : null; };
const ancestorByLocal = (el, name) => { let p = el ? el.parentNode : null; while (p && p.nodeType === 1) { if (p.localName === name) return p; p = p.parentNode; } return null; };
// CRT equivalente pro ranking de fornecedores (operacao-xml): 1 Simples · 3 normal · 4 MEI · null desconhecido
const crtDe = (simples, mei) => mei ? 4 : simples === true ? 1 : simples === false ? 3 : null;
const semNumeroZero = n => String(n || '').trim().replace(/^0+(?=\d)/, '');
// item único "serviço": a Reforma lê o mix por NCM (serviço não tem NCM → conta como alíquota cheia) e a receita pelo documento
const itemServico = (codigo, descricao, vServ, desconto, pisCst, vPis, vCofins) => ({
  n_item: 1, codigo: codigo || null, descricao: descricao || 'Serviço', ncm: null, cest: null, cfop: null,
  unidade: 'SV', quantidade: 1, valor_unitario: vServ, valor_total: vServ, desconto,
  icms_origem: null, icms_cst: null, csosn: null, pis_cst: pisCst || null, cofins_cst: pisCst || null,
  icms_valor: 0, icms_st_valor: 0, ipi_valor: 0, pis_valor: vPis, cofins_valor: vCofins
});

// NFS-e padrão nacional (Sistema Nacional NFS-e): <NFSe><infNFSe Id="NFS + 50 dígitos"> … <DPS><infDPS> prestador/tomador/serviço/valores
// valor_total = valor do serviço − desconto incondicional (receita bruta, como o vNF da NF-e); data = emissão da DPS
function parseNfseNacional(dom, nome){
  const lista = [];
  [...byName(dom, 'infNFSe')].forEach(inf => {
    const chave = String(inf.getAttribute('Id') || '').replace(/^NFS/i, '').trim();
    if (!/^\d{50}$/.test(chave)) throw new Error('chave da NFS-e inválida');
    const emit = childByLocal(inf, 'emit');
    const dps = first(inf, 'infDPS');
    const prest = childByLocal(dps, 'prest'), toma = childByLocal(dps, 'toma'), serv = childByLocal(dps, 'serv'), vDps = childByLocal(dps, 'valores');
    const data = dataDe(txt(dps, 'dhEmi')) || dataDe(txt(dps, 'dCompet')) || dataDe(txt(inf, 'dhProc'));
    if (!data) throw new Error('data de emissão ausente');
    const enderEmit = first(emit, 'enderNac');
    // tomador: CNPJ, CPF ou NIF (exterior); sem <toma> = não identificado (fica como PF, sem documento)
    let dest_tipo = 'PF', dest_doc = null, dest_uf = null;
    if (toma) {
      if (txt(toma, 'CNPJ')) { dest_tipo = 'PJ'; dest_doc = dig(txt(toma, 'CNPJ')); }
      else if (txt(toma, 'CPF')) { dest_tipo = 'PF'; dest_doc = dig(txt(toma, 'CPF')); }
      else if (txt(toma, 'NIF') != null || first(toma, 'cNaoNIF')) { dest_tipo = 'EX'; dest_doc = txt(toma, 'NIF') || null; }
      const endNac = first(toma, 'endNac');
      dest_uf = endNac ? ufDoIbge(txt(endNac, 'cMun')) : (first(toma, 'endExt') ? 'EX' : null);
    }
    const opSN = txt(first(prest, 'regTrib'), 'opSimpNac');   // 1 não optante · 2 MEI · 3 ME/EPP do Simples
    const vServ = num(txt(first(vDps, 'vServPrest'), 'vServ'));
    const descInc = num(txt(vDps, 'vDescIncond')), descCond = num(txt(vDps, 'vDescCond'));
    const pc = first(vDps, 'piscofins');
    const cServ = first(serv, 'cServ');
    const itens = [itemServico(txt(cServ, 'cTribNac'), txt(cServ, 'xDescServ'), vServ, descInc + descCond, txt(pc, 'CST'), num(txt(pc, 'vPis')), num(txt(pc, 'vCofins')))];
    const doc = {
      chave, modelo: 'nfse', serie: txt(dps, 'serie'), numero: txt(inf, 'nNFSe'), data_emissao: data,
      tp_nf: null, finalidade: null, natureza_operacao: txt(inf, 'xTribNac') || 'Serviço',
      emit_doc: dig(txt(emit, 'CNPJ') || txt(emit, 'CPF')) || null, emit_nome: txt(emit, 'xNome'),
      emit_uf: txt(enderEmit, 'UF') || ufDoIbge(txt(enderEmit, 'cMun')), emit_municipio: txt(inf, 'xLocEmi'),
      emit_ie: null, emit_crt: opSN ? crtDe(opSN === '3', opSN === '2') : null,
      dest_doc, dest_tipo, dest_nome: txt(toma, 'xNome'), dest_uf, dest_municipio: null, dest_ie: null, dest_ind_ie: null,
      valor_total: Math.max(0, vServ - descInc), valor_produtos: vServ, valor_desconto: descInc + descCond, valor_frete: 0,
      icms: 0, icms_st: 0, ipi: 0, pis: num(txt(pc, 'vPis')), cofins: num(txt(pc, 'vCofins')),
      cfop_principal: null, status: 'autorizada', xml_nome: nome
    };
    lista.push({ doc, itens });
  });
  if (!lista.length) throw new Error('NFS-e sem infNFSe');
  return { kind: 'nfse', lista };
}

// evento processado da NFS-e nacional: <evento><infEvento> dhProc … <pedRegEvento><infPedReg> chNFSe + <e101101/> (tipo)
const NFSE_EVT_CANCEL = new Set(['101101', '105102', '105105', '305101']);   // cancelamento · por substituição · deferido por análise fiscal · de ofício
function parseEventoNfseNacional(dom){
  const tipoEl = [...byName(dom, '*')].find(e => /^e\d{6}$/.test(e.localName));
  const tpEvento = tipoEl ? tipoEl.localName.slice(1) : null;
  const chave = dig(txt(dom, 'chNFSe'));
  const infEv = first(dom, 'infEvento');
  return { kind: 'evento', modelo: 'nfse', chave: /^\d{50}$/.test(chave) ? chave : null, tpEvento, cancel: NFSE_EVT_CANCEL.has(tpEvento), homologado: !!(txt(infEv, 'dhProc') || txt(infEv, 'nSeqEvento')), cStat: null };
}

// NFS-e municipal padrão ABRASF (1.0 e 2.x — Betha, GINFES, ISSNet e afins): <CompNfse><Nfse><InfNfse>…; pode vir uma lista
// (ConsultarNfseResposta) e o cancelamento ao lado da nota (NfseCancelamento). Chave = NFSE-<CNPJ do prestador>-<número>
function parseNfseAbrasf(dom, nome){
  const lista = [];
  const infs = [...byName(dom, 'InfNfse'), ...byName(dom, 'infNfse')];
  infs.forEach(inf => {
    const numero = semNumeroZero(txtChild(inf, 'Numero') || txt(inf, 'Numero'));
    const prest = first(inf, 'PrestadorServico') || first(inf, 'Prestador');
    const idPrest = first(prest, 'IdentificacaoPrestador') || prest;
    const emitDoc = dig(txt(idPrest, 'Cnpj') || txt(idPrest, 'Cpf') || txt(idPrest, 'CpfCnpj'));
    if (!numero || !(emitDoc.length === 14 || emitDoc.length === 11)) throw new Error('NFS-e sem número ou sem CNPJ/CPF do prestador');
    const data = dataDe(txtChild(inf, 'DataEmissao')) || dataDe(txt(inf, 'DataEmissao')) || dataDe(txt(inf, 'Competencia'));
    if (!data) throw new Error('data de emissão ausente');
    const toma = first(inf, 'TomadorServico') || first(inf, 'Tomador');
    const idToma = first(toma, 'IdentificacaoTomador') || toma;
    let dest_tipo = 'PF', dest_doc = null;
    if (idToma) {
      if (txt(idToma, 'Cnpj')) { dest_tipo = 'PJ'; dest_doc = dig(txt(idToma, 'Cnpj')); }
      else if (txt(idToma, 'Cpf')) { dest_tipo = 'PF'; dest_doc = dig(txt(idToma, 'Cpf')); }
    }
    const serv = first(inf, 'Servico');
    const val = first(serv, 'Valores') || first(inf, 'Valores');
    const vServ = num(txt(val, 'ValorServicos'));
    const descInc = num(txt(val, 'DescontoIncondicionado')), descCond = num(txt(val, 'DescontoCondicionado'));
    const comp = ancestorByLocal(inf, 'CompNfse');
    const cancelado = comp ? !!(first(comp, 'NfseCancelamento') || first(comp, 'CancelamentoNfse')) : (infs.length === 1 && !!(first(dom, 'NfseCancelamento') || first(dom, 'CancelamentoNfse')));
    const optSN = txt(inf, 'OptanteSimplesNacional');   // 1 sim · 2 não
    const enderPrest = first(prest, 'Endereco'), enderToma = first(toma, 'Endereco');
    const item = txt(serv, 'ItemListaServico');
    const itens = [itemServico(item, txt(serv, 'Discriminacao'), vServ, descInc + descCond, null, num(txt(val, 'ValorPis')), num(txt(val, 'ValorCofins')))];
    const doc = {
      chave: 'NFSE-' + emitDoc + '-' + numero, modelo: 'nfse', serie: null, numero, data_emissao: data,
      tp_nf: null, finalidade: null, natureza_operacao: item ? 'Serviço (item ' + item + ')' : 'Serviço',
      emit_doc: emitDoc, emit_nome: txt(prest, 'RazaoSocial'), emit_uf: txt(enderPrest, 'Uf') || ufDoIbge(txt(enderPrest, 'CodigoMunicipio')), emit_municipio: null,
      emit_ie: null, emit_crt: optSN ? crtDe(optSN === '1', false) : null,
      dest_doc, dest_tipo, dest_nome: txt(toma, 'RazaoSocial'), dest_uf: txt(enderToma, 'Uf') || ufDoIbge(txt(enderToma, 'CodigoMunicipio')), dest_municipio: null, dest_ie: null, dest_ind_ie: null,
      valor_total: Math.max(0, vServ - descInc), valor_produtos: vServ, valor_desconto: descInc + descCond, valor_frete: 0,
      icms: 0, icms_st: 0, ipi: 0, pis: num(txt(val, 'ValorPis')), cofins: num(txt(val, 'ValorCofins')),
      cfop_principal: null, status: cancelado ? 'cancelada' : 'autorizada', xml_nome: nome
    };
    lista.push({ doc, itens });
  });
  if (!lista.length) throw new Error('NFS-e sem InfNfse');
  return { kind: 'nfse', lista };
}

// cancelamento ABRASF avulso (NfseCancelamento / CancelarNfseResposta): identifica a nota por CNPJ do prestador + número
function parseCancelAbrasf(dom){
  const idn = first(dom, 'IdentificacaoNfse');
  const numero = semNumeroZero(txt(idn, 'Numero'));
  const cnpj = dig(txt(idn, 'Cnpj') || txt(idn, 'Cpf'));
  const ok = !!(first(dom, 'Confirmacao') || first(dom, 'DataHora') || first(dom, 'DataHoraCancelamento') || first(dom, 'Sucesso'));
  return { kind: 'evento', modelo: 'nfse', chave: numero && cnpj ? 'NFSE-' + cnpj + '-' + numero : null, tpEvento: 'cancelamento', cancel: true, homologado: ok, cStat: null };
}

// abre ZIPs (com subpastas e até 2 níveis de ZIP dentro de ZIP) e devolve [{ nome, texto }] só dos .xml;
// ZIP que não abre vira erro do lote (não derruba a importação); lixo do macOS (__MACOSX, ._x) é pulado
export async function expandirArquivos(files, erros, nivel = 0){
  const out = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      let zip;
      try { zip = await JSZip.loadAsync(f); }
      catch (e) { erros.push({ arquivo: f.name, motivo: 'ZIP não abriu (corrompido, com senha ou não é ZIP)' }); continue; }
      for (const e of Object.values(zip.files)) {
        if (e.dir) continue;
        const base = e.name.split('/').pop();
        if (/(^|\/)__MACOSX\//.test(e.name) || base.startsWith('._')) continue;
        if (/\.zip$/i.test(e.name)) {
          if (nivel >= 1) { erros.push({ arquivo: f.name + ' › ' + e.name, motivo: 'ZIP aninhado demais (só 2 níveis)' }); continue; }
          const sub = await expandirArquivos([new File([await e.async('blob')], e.name)], erros, nivel + 1);
          sub.forEach(s => out.push({ nome: f.name + ' › ' + s.nome, texto: s.texto }));
          continue;
        }
        if (!/\.xml$/i.test(e.name)) continue;
        out.push({ nome: f.name + ' › ' + e.name, texto: await e.async('string') });
      }
    } else {
      out.push({ nome: f.name, texto: await f.text() });
    }
  }
  return out;
}


// ---------- lote ----------
// Importa `arquivos` (File[] de .xml/.zip) para o cliente e devolve o relatório.
// Atômico: se falhar no meio, desfaz o que gravou e relança o erro (nada fica pela metade).
// `onProgresso(lidos, total, texto)` é opcional — a tela decide como mostrar.
export async function importarLote({ supabase, cliente, arquivos, usuario, onProgresso }) {
  const progresso = (n, m, t) => { if (onProgresso) onProgresso(n, m, t); };
  const cli = cliente;
  const docCli = dig(cli.documento);
  if (docCli.length !== 14 && docCli.length !== 11) throw new Error('cliente sem CNPJ/CPF no cadastro — a importação precisa do documento pra saber o que é venda e o que é compra');
  if (!arquivos || !arquivos.length) throw new Error('nenhum arquivo para importar');
  const ignorados = [], erros = [];
  const porChave = new Map();           // chave → { doc, itens } (dedupe dentro do lote)
  const cancelamentos = new Set();
  let duplicadasNoLote = 0;
  let lidos = 0, total = 0;
  let impId = null;
  try {
    progresso(0, 0, 'Abrindo arquivos…');
    const xmls = await expandirArquivos(arquivos, erros);
    total = xmls.length;
    if (!total) throw new Error('Nenhum .xml encontrado nos arquivos escolhidos.' + (erros.length ? ' ' + erros.map(e => e.arquivo + ': ' + e.motivo).join('; ') : ''));
    for (const x of xmls) {
      lidos++; progresso(lidos, total, lidos + ' de ' + total + ' arquivos lidos');
      try {
        const r = parseXml(x.texto, x.nome);
        if (r.kind === 'ignorado') { ignorados.push({ arquivo: x.nome, motivo: r.motivo }); continue; }
        if (r.kind === 'evento') {
          if (!r.cancel) ignorados.push({ arquivo: x.nome, motivo: 'evento (' + (r.tpEvento || '?') + ') que não é cancelamento' });
          else if (!r.chave || !r.homologado) ignorados.push({ arquivo: x.nome, motivo: r.modelo === 'nfse' ? 'cancelamento de NFS-e sem processamento ou sem identificação da nota' : 'cancelamento sem homologação da SEFAZ (cStat ' + (r.cStat || 'ausente') + ')' });
          else cancelamentos.add(r.chave);
          continue;
        }
        // NFS-e pode vir várias num arquivo só (lista da prefeitura); NF-e é sempre uma
        const lista = r.kind === 'nfse' ? r.lista : [r];
        for (const item of lista) {
          const d = item.doc;
          const rot = x.nome + (lista.length > 1 ? ' (nota ' + (d.numero || '?') + ')' : '');
          // emitida pelo cliente com tpNF 0 é nota de ENTRADA emitida por ele (importação, produtor rural, devolução recebida);
          // NFS-e: prestador = cliente → serviço prestado (saída); tomador = cliente → serviço tomado (entrada)
          if (d.emit_doc === docCli) d.tipo = d.tp_nf === 0 ? 'entrada' : 'saida';
          else if (d.dest_doc === docCli) d.tipo = 'entrada';
          else { ignorados.push({ arquivo: rot, motivo: 'XML de terceiro (nem emitente nem destinatário é o cliente)' }); continue; }
          if (porChave.has(d.chave)) { duplicadasNoLote++; continue; }
          porChave.set(d.chave, item);
        }
      } catch (e) { erros.push({ arquivo: x.nome, motivo: e.message || String(e) }); }
      if (lidos % 25 === 0) await new Promise(r => setTimeout(r, 0));   // deixa a tela respirar em lotes grandes
    }
    // cancelamento por evento no mesmo lote
    porChave.forEach(r => { if (cancelamentos.has(r.doc.chave)) r.doc.status = 'cancelada'; });

    // lote registrado primeiro (os documentos apontam pra ele)
    const { data: imp, error: eImp } = await supabase.from('nf_importacoes')
      .insert({ cliente_id: cli.id, usuario, arquivos: total, notas_novas: 0, notas_duplicadas: 0, ignorados: 0, erros: [] }).select('id').single();
    if (eImp) throw new Error('não consegui registrar o lote: ' + eImp.message);
    impId = imp.id;

    const docs = [...porChave.values()];
    let novas = 0, duplicadas = duplicadasNoLote, itensGravados = 0;
    const idPorChave = new Map();
    for (let i = 0; i < docs.length; i += 200) {
      const fatia = docs.slice(i, i + 200).map(r => ({ ...r.doc, cliente_id: cli.id, importacao_id: imp.id }));
      progresso(lidos, total, 'Gravando notas ' + Math.min(i + 200, docs.length) + ' de ' + docs.length + '…');
      const { data: ins, error } = await supabase.from('nf_documentos')
        .upsert(fatia, { onConflict: 'cliente_id,chave', ignoreDuplicates: true }).select('id, chave');
      if (error) throw new Error('falha ao gravar notas: ' + error.message);
      (ins || []).forEach(x => idPorChave.set(x.chave, x.id));
      novas += (ins || []).length; duplicadas += fatia.length - (ins || []).length;
    }
    // itens só das notas que entraram agora (duplicada não regrava itens)
    const itens = [];
    docs.forEach(r => { const id = idPorChave.get(r.doc.chave); if (id) r.itens.forEach(it => itens.push({ ...it, documento_id: id })); });
    for (let i = 0; i < itens.length; i += 500) {
      progresso(lidos, total, 'Gravando itens ' + Math.min(i + 500, itens.length) + ' de ' + itens.length + '…');
      const { error } = await supabase.from('nf_itens').upsert(itens.slice(i, i + 500), { onConflict: 'documento_id,n_item', ignoreDuplicates: true });
      if (error) throw new Error('falha ao gravar itens: ' + error.message);
      itensGravados += Math.min(500, itens.length - i);
    }
    // cancelamentos de chaves que já estavam na base (as que entraram agora já vieram canceladas;
    // as duplicadas do lote também caem aqui, porque a linha que vale é a da base)
    let canceladas = 0, naoAchadas = 0;
    const chavesCancel = [...cancelamentos].filter(ch => !idPorChave.has(ch));
    for (let i = 0; i < chavesCancel.length; i += 200) {
      const fatia = chavesCancel.slice(i, i + 200);
      const { data: ex, error: eEx } = await supabase.from('nf_documentos').select('chave, status').eq('cliente_id', cli.id).in('chave', fatia);
      if (eEx) throw new Error('falha ao conferir cancelamentos: ' + eEx.message);
      const achadas = (ex || []).map(x => x.chave);
      naoAchadas += fatia.length - achadas.length;
      const pendentes = (ex || []).filter(x => x.status !== 'cancelada').map(x => x.chave);
      if (!pendentes.length) continue;
      const { data: up, error } = await supabase.from('nf_documentos').update({ status: 'cancelada' })
        .eq('cliente_id', cli.id).in('chave', pendentes).select('id');
      if (error) throw new Error('falha ao aplicar cancelamentos: ' + error.message);
      canceladas += (up || []).length;
    }
    const cancelNoLote = docs.filter(r => cancelamentos.has(r.doc.chave) && idPorChave.has(r.doc.chave)).length;

    const detalhe = [...erros.map(e => ({ tipo: 'erro', ...e })), ...ignorados.map(e => ({ tipo: 'ignorado', ...e }))];
    await supabase.from('nf_importacoes').update({ notas_novas: novas, notas_duplicadas: duplicadas, ignorados: ignorados.length, erros: detalhe }).eq('id', imp.id);

    progresso(total, total, 'Concluído.');
    return { total, novas, duplicadas, ignorados, erros, itens: itensGravados, canceladas: canceladas + cancelNoLote, naoAchadas, saidas: docs.filter(r => r.doc.tipo === 'saida').length, entradas: docs.filter(r => r.doc.tipo === 'entrada').length, nfse: docs.filter(r => r.doc.modelo === 'nfse').length, importacao_id: imp.id };
  } catch (e) {
    // lote atômico: falhou no meio, nada fica pela metade (nota sem itens seria "duplicada" pra sempre)
    if (impId) {
      await supabase.from('nf_documentos').delete().eq('importacao_id', impId).eq('cliente_id', cli.id);
      await supabase.from('nf_importacoes').delete().eq('id', impId);
    }
    const err = new Error((e.message || String(e)) + (impId ? ' — o lote foi desfeito, nada ficou pela metade; tente de novo.' : ''));
    err.lidos = lidos; err.total = total;
    throw err;
  }
}
