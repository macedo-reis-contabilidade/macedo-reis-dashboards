// ============================================================
// MACEDO & REIS — Edge Function ponte: o Drive (09/11/2026), pro relatório de situação fiscal (relatorio.js)
// A mesma autorização do "Registrar processo" e do arquivar-guia (os segredos GOOGLE_OAUTH_CLIENT_ID,
// GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN do projeto: a conta dona do Drive do escritório). Só o que o
// relatório precisa: conferir a pasta da empresa, listar as subpastas e os arquivos de uma pasta, criar uma pasta e
// subir um PDF. Nunca apaga nem move nada. Os 429 e 5xx passageiros do Google tentam de novo (até 3 vezes).
// Puro: fetch, env e a espera injetados — testes em tests/ponte-funcao.test.mjs, com um Google de mentira.
// ============================================================
import { ID_DRIVE } from './relatorio.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PASTA = 'application/vnd.google-apps.folder';
const TODOS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

/** O erro do Drive (o Google fora, a autorização recusada): a função responde 502 e a ponte manda de novo depois. */
export class ErroDrive extends Error {}

// criarDrive({ fetch, env, agora, esperar }) → { configurado, pastaAbre, filhas, arquivos, criarPasta, subir }
export function criarDrive({ fetch: f = (u, i) => fetch(u, i), env = () => null, agora = () => Date.now(),
  esperar = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let token = null, vale = 0;
  const segredo = k => { try { return env(k) || ''; } catch { return ''; } };
  const configurado = () => !!(segredo('GOOGLE_OAUTH_CLIENT_ID') && segredo('GOOGLE_OAUTH_CLIENT_SECRET') && segredo('GOOGLE_OAUTH_REFRESH_TOKEN'));

  async function chamar(url, init, prazo = 20000) {
    for (let t = 1; ; t++) {
      let r;
      try {
        r = await f(url, { ...init, signal: AbortSignal.timeout(prazo) });
      } catch (e) {
        if (t >= 3) throw new ErroDrive('o Drive não respondeu (' + ((e && e.name) || 'rede') + ')');
        await esperar(1000 * 2 ** (t - 1));
        continue;
      }
      if (r.ok || ![429, 500, 502, 503, 504].includes(r.status) || t >= 3) return r;
      await esperar(1000 * 2 ** (t - 1));
    }
  }
  async function acesso() {
    if (token && agora() < vale) return token;
    const r = await chamar(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: segredo('GOOGLE_OAUTH_CLIENT_ID'), client_secret: segredo('GOOGLE_OAUTH_CLIENT_SECRET'),
        refresh_token: segredo('GOOGLE_OAUTH_REFRESH_TOKEN'), grant_type: 'refresh_token' }).toString() }, 15000);
    if (!r.ok) throw new ErroDrive('o Google recusou a autorização do Drive (' + r.status + ')');
    const j = await r.json().catch(() => null);
    if (!j || !j.access_token) throw new ErroDrive('o Google não devolveu o acesso ao Drive');
    token = j.access_token;
    vale = agora() + Math.max(60, (Number(j.expires_in) || 3600) - 120) * 1000;
    return token;
  }
  const cab = async (extra = {}) => ({ Authorization: 'Bearer ' + (await acesso()), ...extra });
  const conferirId = id => { if (!ID_DRIVE.test(String(id || ''))) throw new ErroDrive('id do Drive inválido'); return id; };

  /** A pasta existe, é uma pasta e não está na lixeira. Sem acesso a ela (404, 403): false. */
  async function pastaAbre(id) {
    if (!ID_DRIVE.test(String(id || ''))) return false;
    const r = await chamar(API + '/' + id + '?fields=id,mimeType,trashed&supportsAllDrives=true', { headers: await cab() });
    if (r.status === 404 || r.status === 403) return false;
    if (!r.ok) throw new ErroDrive('o Drive não abriu a pasta (' + r.status + ')');
    const j = await r.json().catch(() => null);
    return !!(j && j.mimeType === PASTA && !j.trashed);
  }
  async function listar(pai, pastas) {
    const q = "'" + conferirId(pai) + "' in parents and trashed = false and mimeType " + (pastas ? '=' : '!=') + " '" + PASTA + "'";
    const out = [];
    let pagina = null;
    for (let i = 0; i < 5; i++) {
      const u = API + '?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('nextPageToken,files(id,name)')
        + '&pageSize=200&' + TODOS + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
      const r = await chamar(u, { headers: await cab() });
      if (!r.ok) throw new ErroDrive('o Drive não listou a pasta (' + r.status + ')');
      const j = await r.json().catch(() => null);
      out.push(...((j && j.files) || []).filter(x => x && x.id && x.name != null).map(x => ({ id: String(x.id), name: String(x.name) })));
      pagina = j && j.nextPageToken;
      if (!pagina) break;
    }
    return out;
  }
  /** As subpastas de uma pasta: [{ id, name }]. */
  const filhas = pai => listar(pai, true);
  /** Os arquivos (não as pastas) de uma pasta: [{ id, name }]. */
  const arquivos = pai => listar(pai, false);
  /** Cria a pasta e devolve o id. */
  async function criarPasta(nome, pai) {
    const r = await chamar(API + '?fields=id&supportsAllDrives=true', { method: 'POST',
      headers: await cab({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [conferirId(pai)] }) });
    if (!r.ok) throw new ErroDrive('o Drive não criou a pasta (' + r.status + ')');
    const j = await r.json().catch(() => null);
    if (!j || !ID_DRIVE.test(String(j.id || ''))) throw new ErroDrive('o Drive não devolveu a pasta criada');
    return j.id;
  }
  /** Sobe o PDF (bytes: Uint8Array) e devolve o id do arquivo. */
  async function subir(pai, nome, bytes) {
    const fronteira = 'mr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const meta = JSON.stringify({ name: nome, parents: [conferirId(pai)], mimeType: 'application/pdf' });
    const antes = new TextEncoder().encode('--' + fronteira + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta
      + '\r\n--' + fronteira + '\r\nContent-Type: application/pdf\r\n\r\n');
    const depois = new TextEncoder().encode('\r\n--' + fronteira + '--');
    const corpo = new Uint8Array(antes.length + bytes.length + depois.length);
    corpo.set(antes, 0); corpo.set(bytes, antes.length); corpo.set(depois, antes.length + bytes.length);
    const r = await chamar(UPLOAD + '?uploadType=multipart&fields=id&supportsAllDrives=true', { method: 'POST',
      headers: await cab({ 'Content-Type': 'multipart/related; boundary=' + fronteira }), body: corpo }, 60000);
    if (!r.ok) throw new ErroDrive('o Drive não recebeu o arquivo (' + r.status + ')');
    const j = await r.json().catch(() => null);
    if (!j || !ID_DRIVE.test(String(j.id || ''))) throw new ErroDrive('o Drive não devolveu o arquivo');
    return j.id;
  }
  return { configurado, pastaAbre, filhas, arquivos, criarPasta, subir };
}
