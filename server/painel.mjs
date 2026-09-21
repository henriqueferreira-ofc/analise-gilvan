import { readFile } from 'node:fs/promises';

// Uma única consulta em voo é compartilhada por todas as páginas abertas.
export function createReader({ endpoint, key, snapshotPath, fetchImpl = fetch, now = Date.now }) {
  let pending;
  let cached;
  let cachedAt = 0;
  let fingerprint;
  let changedAt;
  if (endpoint) {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) {
      throw new Error('Configure PAINEL_APPS_SCRIPT_URL com a URL /exec do Google Apps Script.');
    }
    if (!key) throw new Error('Falta PAINEL_SYNC_KEY na configuração local.');
  }
  return async function read() {
    if (cached && now() - cachedAt < 5000) return cached;
    if (pending) return pending;
    pending = (async () => {
      let payload;
      if (endpoint) {
        const response = await fetchImpl(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }), redirect: 'follow', signal: AbortSignal.timeout(55000), cache: 'no-store',
        });
        if (!response.ok) throw new Error('A conexão com o Google falhou.');
        payload = await response.json();
        if (payload.error || !Array.isArray(payload.churches)) throw new Error('A planilha não autorizou a leitura ou retornou dados inválidos.');
      } else {
        payload = JSON.parse(await readFile(snapshotPath, 'utf8'));
      }
      const content = JSON.stringify([payload.churches, payload.cargo, payload.departments, payload.politics, payload.evangelical, payload.countingBasis]);
      if (content !== fingerprint) {
        fingerprint = content;
        changedAt = payload.updatedAt;
      }
      cached = { ...payload, updatedAt: changedAt, checkedAt: new Date(now()).toISOString(), live: Boolean(endpoint) };
      cachedAt = now();
      return cached;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

export function painelPlugin(env, root) {
  const read = createReader({ endpoint: env.PAINEL_APPS_SCRIPT_URL, key: env.PAINEL_SYNC_KEY, snapshotPath: `${root}/public/dados-painel.json` });
  const install = server => {
    server.middlewares.use('/api/painel', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.method !== 'GET') { res.statusCode = 405; res.end('{"error":"Método não permitido"}'); return; }
      try { res.end(JSON.stringify(await read())); }
      catch (error) {
        res.statusCode = error.name === 'TimeoutError' ? 504 : 502;
        res.end(JSON.stringify({ error: error.name === 'TimeoutError'
          ? 'O Google demorou para responder. Uma nova tentativa será feita automaticamente.'
          : 'Não foi possível consultar a planilha. Uma nova tentativa será feita automaticamente.' }));
      }
    });
  };
  return { name: 'painel-planilha', configureServer: install, configurePreviewServer: install };
}
