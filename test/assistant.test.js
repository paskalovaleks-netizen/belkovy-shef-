import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAssistantHandler } from '../server/assistant.js';
import { defaultProfile } from '../src/planner.js';
async function withServer(options, callback) {
  const server = createServer(createAssistantHandler(options));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('missing AI credentials are explicit while status stays accessible', async () => {
  await withServer({ apiKey: '' }, async base => {
    assert.deepEqual(await (await fetch(base + '/api/assistant/status')).json(), { available: false });
    const response = await fetch(base + '/api/assistant', { method: 'POST' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /форм/);
  });
});
test('AI settings are validated before applying them and credentials never enter the response', async () => {
  let called = false;
  await withServer({ apiKey: 'test-key', fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ message: 'Учёл пожелания.', profile: { ...defaultProfile, liked: 'курица', protein: 140 } }) } }] }) };
  } }, async base => {
    const response = await fetch(base + '/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Люблю курицу, хочу 140 г белка', profile: defaultProfile }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.profile.protein, 140);
    assert.equal(result.profile.liked, 'курица');
    assert.ok(!JSON.stringify(result).includes('test-key'));
    assert.ok(called);
  });
});
test('invalid requests and cross-origin requests are rejected without contacting AI', async () => {
  await withServer({ apiKey: 'test-key', fetchImpl: async () => { throw new Error('Unexpected upstream call'); } }, async base => {
    const headers = { 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/assistant', { method: 'POST', headers, body: '{}' })).status, 400);
    assert.equal((await fetch(base + '/api/assistant', { method: 'POST', headers: { ...headers, Origin: 'https://unrelated.example' }, body: '{}' })).status, 403);
  });
});
