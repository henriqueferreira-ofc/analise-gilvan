import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/handler.mjs';

function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } };
}
const env = { PAINEL_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', PAINEL_SYNC_KEY: 'private-test-key' };
test('hospedagem consulta a fonte, permite Pages e nunca envia a chave', async () => {
  const handler = createHandler(env, { fetchImpl: async (_, options) => {
    assert.equal(JSON.parse(options.body).key, env.PAINEL_SYNC_KEY);
    return { ok: true, json: async () => ({ updatedAt: new Date().toISOString(), churches: [{name: 'Setor', responses: 252}] }) };
  } });
  const res = response();
  await handler({method: 'GET'}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.live, true);
  assert.equal(res.body.churches[0].responses, 252);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://henriqueferreira-ofc.github.io');
  assert.ok(!JSON.stringify(res).includes(env.PAINEL_SYNC_KEY));
});
test('hospedagem não retorna cópia antiga quando falta configuração ou Google falha', async () => {
  for (const handler of [createHandler({}), createHandler(env, {fetchImpl: async () => { throw new Error('private-test-key'); }})]) {
    const res = response();
    await handler({method: 'GET'}, res);
    assert.equal(res.statusCode, 503);
    assert.ok(res.body.error);
    assert.ok(!res.body.churches);
    assert.ok(!JSON.stringify(res).includes(env.PAINEL_SYNC_KEY));
  }
});
test('endpoint publicado não permite escrita', async () => {
  const res = response();
  await createHandler(env)({method: 'POST'}, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});
