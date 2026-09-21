import { createReader } from './painel.mjs';

// O mesmo leitor utilizado no localhost, executado na hospedagem online.
export function createHandler(env, options = {}) {
  let read;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // O painel já publica estes totais agregados. Nenhum segredo é retornado.
    res.setHeader('Access-Control-Allow-Origin', 'https://henriqueferreira-ofc.github.io');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Método não permitido' }));
      return;
    }
    try {
      if (!env.PAINEL_APPS_SCRIPT_URL || !env.PAINEL_SYNC_KEY) throw new Error('Conexão ausente');
      read ||= createReader({ endpoint: env.PAINEL_APPS_SCRIPT_URL, key: env.PAINEL_SYNC_KEY, ...options });
      res.end(JSON.stringify(await read()));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Não foi possível atualizar os dados da planilha.' }));
    }
  };
}
