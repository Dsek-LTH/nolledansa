const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync('lib/json-processing-response.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', compiled)(loaded.exports);
const { jsonProcessingResponse } = loaded.exports;

test('response starts before processing completes and sends heartbeats', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const response = jsonProcessingResponse(() => pending, () => 'error', 10);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), '\n');
  const heartbeat = await reader.read();
  assert.equal(new TextDecoder().decode(heartbeat.value), '\n');
  finish({ url: '/video.mp4' });
  let rest = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    rest += new TextDecoder().decode(chunk.value);
  }
  assert.deepEqual(JSON.parse(rest), { url: '/video.mp4' });
});
test('existing response.json clients can parse success and processing errors', async () => {
  assert.deepEqual(await jsonProcessingResponse(async () => ({ url: '/ok' }), () => 'error').json(), { url: '/ok' });
  const response = jsonProcessingResponse(async () => { throw new Error('failed'); }, e => e.message);
  assert.deepEqual(await response.json(), { error: 'failed' });
});
test('disconnect does not leave a heartbeat or write to a closed stream', async () => {
  let finish;
  const response = jsonProcessingResponse(() => new Promise(resolve => { finish = resolve; }), () => 'error', 10);
  await response.body.cancel();
  finish({ url: '/cancelled' });
  await new Promise(resolve => setImmediate(resolve));
});
