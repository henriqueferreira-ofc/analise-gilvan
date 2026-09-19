import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createReader } from '../server/painel.mjs';

const code = await readFile(new URL('../integracao/Planilha.gs', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(code, context);
const aggregate = sheets => JSON.parse(JSON.stringify(context.aggregateSheets(sheets)));
const headers = ['Carimbo de data/hora', 'NOME', 'CARGO MINISTÉRIAL', 'DEPARTAMENTO', 'POLÍTICA', 'EVANGÉLICO'];
const source = [{name: 'Setor 1', rows: [headers, ['data', 'Pessoa privada', 'Membro', 'UMADEB', 'SIM', 'SIM']]}];
test('novas abas, aba vazia e novo cadastro entram na leitura seguinte', () => {
  const before = aggregate(source);
  assert.equal(before.churches.length, 1);
  const after = aggregate([...source, {name: 'SEDE', rows: [headers]}, {name: 'Cidade nova', rows: [headers, ['data', 'Privado', 'PASTOR', 'UDVADEB', 'SIM, NÃO', 'NÃO']]}]);
  assert.equal(after.churches.length, 3);
  assert.equal(after.churches.filter(c => c.responses > 0).length, 2);
  assert.equal(after.churches.reduce((n,c) => n+c.responses, 0), 2);
  assert.equal(after.politics.Sim, 1);
  assert.equal(after.cargo.Pastor, 1);
  assert.ok(!JSON.stringify(after).includes('Privado'));
  assert.ok(!JSON.stringify(before).includes('Pessoa privada'));
});
test('ignora abas auxiliares e aceita cabeçalho após título', () => {
  const result = aggregate([{name:'Auxiliar', rows:[['Observações']]}, {name:'Setor', rows:[['Título'], headers]}]);
  assert.deepEqual(result.churches, [{name:'Setor', responses:0}]);
});
test('conexão compartilha consulta, renova cache e não mascara falhas', async () => {
  let clock = 10000, calls = 0, fail = false;
  const reader = createReader({ endpoint:'https://script.google.com/macros/s/test/exec', key:'test-key', now:()=>clock,
    fetchImpl:async (url, options) => { calls++; assert.equal(JSON.parse(options.body).key, 'test-key'); if(fail) throw Error('offline'); return {ok:true,json:async()=>aggregate(source)}; },
  });
  const [a,b] = await Promise.all([reader(),reader()]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.equal(a.live,true);
  assert.ok(!JSON.stringify(a).includes('test-key'));
  await reader(); assert.equal(calls,1);
  clock += 5001; await reader(); assert.equal(calls,2);
  clock += 5001; fail = true; await assert.rejects(reader());
  fail = false; assert.equal((await reader()).live,true);
});
test('sem autorização informa cópia importada e nunca ao vivo', async () => {
  const reader = createReader({snapshotPath:new URL('../public/dados-painel.json', import.meta.url)});
  const result = await reader(); assert.equal(result.live,false); assert.equal(result.churches.length,19);
});
test('Apps Script bloqueia leitura sem chave', () => {
  const responses=[];
  const sandbox=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'private-key'})},ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({setMimeType:()=>{responses.push(JSON.parse(value));}})}});
  vm.runInContext(code,sandbox);
  sandbox.doGet(); sandbox.doPost({postData:{contents:'{"key":"wrong"}'}});
  assert.equal(responses.length,2); assert.ok(responses.every(r=>r.error==='Acesso não autorizado'));
});
