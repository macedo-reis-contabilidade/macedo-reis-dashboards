// ============================================================
// MACEDO & REIS — o Drive pro assistente do escritório (16/10/2026)
// A busca de arquivos na pasta da empresa no Google Drive, com a mesma autorização do "Registrar processo"
// (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN, segredos do projeto): só LÊ — o
// nome, a pasta, a data, o tamanho e o link de cada arquivo, nunca o conteúdo, e só dentro da pasta que o cadastro da
// empresa aponta (clientes.drive_folder_url). Desce as subpastas em largura — as de um nível numa consulta só, até 40
// por vez —, sem as notas em XML (o volume do fiscal) e sem atalhos. A busca é por palavras no nome e no caminho, sem
// acento e sem maiúscula, o mês por extenso vale pelo número. Puro: fetch e env injetados — testes em
// tests/assistente-funcao.test.mjs.
// ============================================================

const API = 'https://www.googleapis.com/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PASTA = 'application/vnd.google-apps.folder';
const FORA = ['application/vnd.google-apps.shortcut', 'text/xml', 'application/xml'];
const POR_CONSULTA = 40;   // pastas por consulta ("'a' in parents or 'b' in parents ...")

export const ID_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;
// o id da pasta no endereço que o cadastro guarda (https://drive.google.com/drive/folders/<id>)
export const pastaDaUrl = url => { const m = /\/folders\/([A-Za-z0-9_-]{10,100})/.exec(String(url || '')); return m ? m[1] : null; };
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// as palavras da busca: sem acento; fora as miúdas ("de", "do", "a"…, mas não "das", que é a guia do Simples); o mês
// por extenso vale também pelo número e pela abreviação
const MIUDAS = new Set(['de', 'do', 'da', 'dos', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'pra', 'para', 'com', 'um', 'uma', 'arquivo', 'arquivos']);
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function palavrasDe(termo) {
  return semAcento(termo).split(/[^a-z0-9]+/).filter(p => p.length >= 2 && !MIUDAS.has(p)).slice(0, 8).map(p => {
    const m = MESES.indexOf(p);
    return m < 0 ? [p] : [p, p.slice(0, 3), String(m + 1).padStart(2, '0')];
  });
}

// o que achou: todas as palavras no nome ou no caminho (cada uma por qualquer das formas); primeiro quem tem mais palavras
// no nome, depois o mais recente; sem palavra, os mais recentes → { achados: [...até limite], total }
export function filtrarArquivos(arquivos, termo, { limite = 20 } = {}) {
  const ps = palavrasDe(termo);
  const lista = [];
  (Array.isArray(arquivos) ? arquivos : []).forEach(a => {
    const nome = semAcento(a && a.nome), alvo = nome + ' ' + semAcento(a && a.pasta);
    if (!ps.every(formas => formas.some(f => alvo.includes(f)))) return;
    lista.push({ a, noNome: ps.filter(formas => formas.some(f => nome.includes(f))).length });
  });
  lista.sort((x, y) => y.noNome - x.noNome || String(y.a.modificado || '').localeCompare(String(x.a.modificado || '')));
  return { achados: lista.slice(0, limite).map(x => x.a), total: lista.length };
}

// criarDrive({ fetch, env }) → { configurado(), arvore(raiz) }
export function criarDrive({ fetch: f = globalThis.fetch, env = () => null, agora = () => Date.now() } = {}) {
  let token = null, vale = 0;
  const segredo = k => { try { return env(k) || ''; } catch (e) { return ''; } };
  const configurado = () => !!(segredo('GOOGLE_OAUTH_CLIENT_ID') && segredo('GOOGLE_OAUTH_CLIENT_SECRET') && segredo('GOOGLE_OAUTH_REFRESH_TOKEN'));
  async function acesso() {
    if (token && agora() < vale) return token;
    const r = await f(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: segredo('GOOGLE_OAUTH_CLIENT_ID'), client_secret: segredo('GOOGLE_OAUTH_CLIENT_SECRET'),
        refresh_token: segredo('GOOGLE_OAUTH_REFRESH_TOKEN'), grant_type: 'refresh_token' }).toString(), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('o Google recusou a autorização do Drive (' + r.status + ')');
    const j = await r.json().catch(() => null);
    if (!j || !j.access_token) throw new Error('o Google não devolveu o acesso ao Drive');
    token = j.access_token;
    vale = agora() + Math.max(60, (Number(j.expires_in) || 3600) - 120) * 1000;
    return token;
  }
  async function listar(q, campos, paginas = 3) {
    const out = [];
    let pagina = null;
    for (let i = 0; i < paginas; i++) {
      const u = API + '?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('nextPageToken,files(' + campos + ')')
        + '&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true' + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
      const r = await f(u, { headers: { Authorization: 'Bearer ' + await acesso() }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('o Drive recusou a busca (' + r.status + ')');
      const j = await r.json().catch(() => ({}));
      out.push(...(Array.isArray(j.files) ? j.files : []));
      pagina = j.nextPageToken;
      if (!pagina) break;
    }
    return out;
  }
  const dosPais = ids => '(' + ids.map(id => "'" + id + "' in parents").join(' or ') + ')';
  // a pasta da empresa: as subpastas, nível por nível (o caminho de cada uma, "FISCAL / 2026"), e os arquivos delas
  // → { arquivos: [{ id, nome, tipo, modificado, tamanho, link, pasta }], pastas, cortada }
  async function arvore(raiz, { maxPastas = 200, maxProfundidade = 6, maxArquivos = 3000 } = {}) {
    if (!ID_DRIVE.test(String(raiz || ''))) throw new Error('pasta do Drive inválida');
    const caminho = new Map([[raiz, '']]);
    const pastas = [raiz];
    let nivel = [raiz];
    for (let d = 0; d < maxProfundidade && nivel.length && pastas.length < maxPastas; d++) {
      const prox = [];
      for (let i = 0; i < nivel.length; i += POR_CONSULTA) {
        const subs = await listar(dosPais(nivel.slice(i, i + POR_CONSULTA)) + " and mimeType = '" + PASTA + "' and trashed = false", 'id,name,parents');
        subs.forEach(s => {
          if (!s || !ID_DRIVE.test(String(s.id)) || caminho.has(s.id) || pastas.length >= maxPastas) return;
          const pai = (s.parents || []).find(p => caminho.has(p));
          caminho.set(s.id, (pai && caminho.get(pai) ? caminho.get(pai) + ' / ' : '') + String(s.name || ''));
          pastas.push(s.id);
          prox.push(s.id);
        });
      }
      nivel = prox;
    }
    const arquivos = [];
    for (let i = 0; i < pastas.length && arquivos.length < maxArquivos; i += POR_CONSULTA) {
      const fs = await listar(dosPais(pastas.slice(i, i + POR_CONSULTA)) + " and mimeType != '" + PASTA + "' and trashed = false"
        + FORA.map(m => " and mimeType != '" + m + "'").join(''), 'id,name,mimeType,modifiedTime,size,webViewLink,parents');
      fs.forEach(x => {
        if (!x || arquivos.length >= maxArquivos) return;
        const pai = (x.parents || []).find(p => caminho.has(p));
        arquivos.push({ id: String(x.id), nome: String(x.name || ''), tipo: x.mimeType || null, modificado: x.modifiedTime || null,
          tamanho: x.size != null && x.size !== '' ? Number(x.size) : null, link: x.webViewLink || null, pasta: pai ? caminho.get(pai) : '' });
      });
    }
    return { arquivos, pastas: pastas.length, cortada: pastas.length >= maxPastas || arquivos.length >= maxArquivos };
  }
  return { configurado, arvore };
}
