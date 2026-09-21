// ============================================================
// MACEDO & REIS — Leitor mínimo de XLS (BIFF8) para as planilhas da Domínio
// Por que existe: a Domínio grava o .xls fora do padrão (despeja centenas de
// milhares de registros BLANK ANTES do BOF da planilha e aponta o BOUNDSHEET
// pra esse lixo). SheetJS e xlrd seguem o ponteiro e devolvem a aba vazia.
// Este leitor varre o fluxo "Workbook" do começo ao fim, guarda o SST e
// lê as células da(s) planilha(s) que aparecerem depois de cada BOF.
// Devolve uma matriz de linhas (arrays de string/número) — o mesmo formato
// que o lerPlanilha de dominio-relatorios.js espera.
//
// Cobre: SST (com CONTINUE), LABELSST, LABEL, NUMBER, RK, MULRK, BOOLERR.
// Ignora: fórmulas (só o resultado numérico não é lido), estilos, mesclagens.
// ============================================================

// ---------- OLE2 (CFB): acha e junta o fluxo "Workbook" ----------
function fluxoWorkbook(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  if (dv.getUint32(0, true) !== 0xE011CFD0) throw new Error('não é um arquivo XLS (falta a assinatura OLE2)');
  const sectorShift = dv.getUint16(30, true), miniShift = dv.getUint16(32, true);
  const S = 1 << sectorShift, MS = 1 << miniShift;
  const nFat = dv.getUint32(44, true), dirStart = dv.getUint32(48, true);
  const miniCutoff = dv.getUint32(56, true), miniFatStart = dv.getUint32(60, true), nMiniFat = dv.getUint32(64, true);
  const difStart = dv.getUint32(68, true), nDif = dv.getUint32(72, true);
  const sec = n => 512 + n * S;
  // FAT: 109 entradas no cabeçalho + DIFAT
  const fatSecs = [];
  for (let i = 0; i < 109 && i < nFat; i++) fatSecs.push(dv.getUint32(76 + i * 4, true));
  let d = difStart;
  for (let k = 0; k < nDif && d < 0xFFFFFFFE; k++) {
    const base = sec(d);
    for (let i = 0; i < S / 4 - 1 && fatSecs.length < nFat; i++) fatSecs.push(dv.getUint32(base + i * 4, true));
    d = dv.getUint32(base + S - 4, true);
  }
  const fat = new Uint32Array(fatSecs.length * (S / 4));
  fatSecs.forEach((fs, i) => { const base = sec(fs); for (let j = 0; j < S / 4; j++) fat[i * (S / 4) + j] = dv.getUint32(base + j * 4, true); });
  const cadeia = (start, tabela) => { const out = []; let s = start; let guard = 0; while (s < 0xFFFFFFFE && guard++ < 50_000_000) { out.push(s); s = tabela[s]; } return out; };
  const lerFluxo = (start, tamanho) => {
    const secs = cadeia(start, fat); const out = new Uint8Array(tamanho); let p = 0;
    for (const s of secs) { if (p >= tamanho) break; const n = Math.min(S, tamanho - p); out.set(u8.subarray(sec(s), sec(s) + n), p); p += n; }
    return out;
  };
  // diretório: entradas de 128 bytes
  const dirSecs = cadeia(dirStart, fat);
  let root = null, alvo = null;
  for (const s of dirSecs) {
    for (let e = 0; e < S / 128; e++) {
      const off = sec(s) + e * 128;
      const nLen = dv.getUint16(off + 64, true); if (!nLen) continue;
      let nome = ''; for (let i = 0; i < nLen - 2; i += 2) nome += String.fromCharCode(dv.getUint16(off + i, true));
      const tipo = u8[off + 66], start = dv.getUint32(off + 116, true), size = dv.getUint32(off + 120, true);
      if (tipo === 5) root = { start, size };
      if (tipo === 2 && (nome === 'Workbook' || nome === 'Book')) alvo = { start, size };
    }
  }
  if (!alvo) throw new Error('o XLS não tem o fluxo "Workbook"');
  if (alvo.size >= miniCutoff) return lerFluxo(alvo.start, alvo.size);
  // fluxo pequeno: mora no mini-stream da raiz
  const mini = lerFluxo(root.start, root.size);
  const miniFat = new Uint32Array(nMiniFat * (S / 4));
  cadeia(miniFatStart, fat).forEach((fs, i) => { const base = sec(fs); for (let j = 0; j < S / 4; j++) miniFat[i * (S / 4) + j] = dv.getUint32(base + j * 4, true); });
  const out = new Uint8Array(alvo.size); let p = 0;
  for (const s of cadeia(alvo.start, miniFat)) { if (p >= alvo.size) break; const n = Math.min(MS, alvo.size - p); out.set(mini.subarray(s * MS, s * MS + n), p); p += n; }
  return out;
}

// ---------- BIFF8 ----------
const dec1 = new TextDecoder('latin1');
function lerSst(chunks, total) {
  // chunks: corpos do SST e dos CONTINUE que o seguem; strings podem atravessar a fronteira
  const strs = []; let ci = 0, pos = 8;   // pula cstTotal/cstUnique
  const dv = () => new DataView(chunks[ci].buffer, chunks[ci].byteOffset, chunks[ci].byteLength);
  const restante = () => chunks[ci].length - pos;
  const proximo = () => { ci++; pos = 0; return ci < chunks.length; };
  while (strs.length < total) {
    if (restante() <= 0 && !proximo()) break;
    if (restante() < 3) { if (!proximo()) break; }
    let v = dv();
    const cch = v.getUint16(pos, true); let flags = chunks[ci][pos + 2]; pos += 3;
    let hi = flags & 1; const rich = flags & 8, ext = flags & 4;
    let cRun = 0, cbExt = 0;
    if (rich) { cRun = v.getUint16(pos, true); pos += 2; }
    if (ext) { cbExt = v.getInt32(pos, true); pos += 4; }
    let s = '', lidos = 0;
    while (lidos < cch) {
      if (restante() <= 0) { if (!proximo()) break; hi = chunks[ci][pos] & 1; pos += 1; v = dv(); }
      const cabem = hi ? Math.floor(restante() / 2) : restante();
      const n = Math.min(cch - lidos, cabem);
      if (n <= 0) { if (!proximo()) break; hi = chunks[ci][pos] & 1; pos += 1; v = dv(); continue; }
      if (hi) { for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint16(pos + i * 2, true)); pos += n * 2; }
      else { s += dec1.decode(chunks[ci].subarray(pos, pos + n)); pos += n; }
      lidos += n;
    }
    let pular = cRun * 4 + cbExt;
    while (pular > 0) { const n = Math.min(pular, restante()); pos += n; pular -= n; if (pular > 0 && !proximo()) break; }
    strs.push(s);
  }
  return strs;
}
function rk(v) {
  const mult = v & 1, isInt = v & 2;
  let x;
  if (isInt) x = v >> 2;
  else { const b = new ArrayBuffer(8); const dv = new DataView(b); dv.setUint32(4, (v & 0xFFFFFFFC) >>> 0, true); dv.setUint32(0, 0, true); x = dv.getFloat64(0, true); }
  return mult ? x / 100 : x;
}

/** Lê um .xls e devolve { abas: [{ nome, linhas }] } — linhas = matriz esparsa preenchida com ''. */
export function lerXls(buf) {
  const wb = fluxoWorkbook(buf);
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  const nomes = []; let sst = null, sstChunks = null, sstTotal = 0;
  const abas = []; let atual = null;
  let i = 0;
  const cel = (r, c, val) => { const L = atual.cel; (L[r] || (L[r] = []))[c] = val; if (c > atual.maxc) atual.maxc = c; if (r > atual.maxr) atual.maxr = r; };
  while (i + 4 <= wb.length) {
    const rt = dv.getUint16(i, true), ln = dv.getUint16(i + 2, true); const b = i + 4;
    if (sstChunks && rt !== 0x3C) { sst = lerSst(sstChunks, sstTotal); sstChunks = null; }
    switch (rt) {
      case 0x85: { const nl = wb[b + 6], opt = wb[b + 7]; let nome = ''; for (let k = 0; k < nl; k++) nome += opt & 1 ? String.fromCharCode(dv.getUint16(b + 8 + k * 2, true)) : String.fromCharCode(wb[b + 8 + k]); nomes.push(nome); break; }
      case 0xFC: sstTotal = dv.getUint32(b + 4, true); sstChunks = [wb.subarray(b, b + ln)]; break;
      case 0x3C: if (sstChunks) sstChunks.push(wb.subarray(b, b + ln)); break;
      case 0x809: { const tipo = dv.getUint16(b + 2, true); if (tipo === 0x10) { atual = { nome: nomes[abas.length] || ('Planilha' + (abas.length + 1)), cel: [], maxr: -1, maxc: -1 }; abas.push(atual); } else atual = null; break; }
      case 0xFD: if (atual) { const r = dv.getUint16(b, true), c = dv.getUint16(b + 2, true), idx = dv.getUint32(b + 6, true); cel(r, c, sst && sst[idx] != null ? sst[idx] : ''); } break;
      case 0x204: if (atual) { const r = dv.getUint16(b, true), c = dv.getUint16(b + 2, true), cch = dv.getUint16(b + 6, true), fl = wb[b + 8]; let s = ''; if (fl & 1) { for (let k = 0; k < cch; k++) s += String.fromCharCode(dv.getUint16(b + 9 + k * 2, true)); } else s = dec1.decode(wb.subarray(b + 9, b + 9 + cch)); cel(r, c, s); } break;
      case 0x203: if (atual) cel(dv.getUint16(b, true), dv.getUint16(b + 2, true), dv.getFloat64(b + 6, true)); break;
      case 0x27E: if (atual) cel(dv.getUint16(b, true), dv.getUint16(b + 2, true), rk(dv.getInt32(b + 6, true))); break;
      case 0xBD: if (atual) { const r = dv.getUint16(b, true), c0 = dv.getUint16(b + 2, true); const n = (ln - 6) / 6; for (let k = 0; k < n; k++) cel(r, c0 + k, rk(dv.getInt32(b + 4 + k * 6 + 2, true))); } break;
      case 0x06: if (atual) { const r = dv.getUint16(b, true), c = dv.getUint16(b + 2, true); if (dv.getUint16(b + 12, true) !== 0xFFFF) cel(r, c, dv.getFloat64(b + 6, true)); } break;
      default: break;
    }
    i = b + ln;
  }
  return { abas: abas.map(a => ({ nome: a.nome, linhas: Array.from({ length: a.maxr + 1 }, (_, r) => { const L = a.cel[r] || []; const out = new Array(a.maxc + 1); for (let c = 0; c <= a.maxc; c++) out[c] = L[c] == null ? '' : L[c]; return out; }) })) };
}
