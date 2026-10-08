import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const worker = await readFile(new URL('../src/offline-worker.js', import.meta.url), 'utf8');
function browserCache() {
  const scope = 'https://example.com/chef/';
  const fixtures = new Map([
    [scope, '<html>chef app</html>'],
    [scope + 'index.html', '<html>chef app</html>'],
    [scope + 'assets/app.js', 'menu and recipe logic'],
    [scope + 'assets/app.css', 'mobile layout'],
    [scope + 'belkovy-shef.html', '<html>self-contained app</html>']
  ]);
  const cacheStore = new Map();
  const handlers = {};
  let offline = false, skipped = false, claimed = false;
  const key = request => typeof request === 'string' ? request : request.url;
  const fetch = async request => {
    if (offline) throw new Error('No connection');
    const body = fixtures.get(key(request));
    if (!body) return new Response('Not found', { status: 404 });
    return new Response(body);
  };
  const caches = {
    async open(name) {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const data = cacheStore.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Precache failed');
            data.set(url, response);
          }
        },
        async match(request) { return data.get(key(request))?.clone(); },
        async put(request, response) { data.set(key(request), response.clone()); }
      };
    },
    async keys() { return [...cacheStore.keys()]; },
    async delete(name) { return cacheStore.delete(name); }
  };
  vm.runInNewContext(`const APP_CACHE = 'belkovy-chef-app-current';\nconst APP_FILES = ${JSON.stringify([...fixtures.keys()].map(url => './' + url.slice(scope.length)))};\n${worker}`, {
    URL, Response, caches, fetch,
    self: {
      registration: { scope }, location: { origin: 'https://example.com' },
      addEventListener(name, handler) { handlers[name] = handler; },
      async skipWaiting() { skipped = true; },
      clients: { async claim() { claimed = true; } }
    }
  });
  return {
    caches, scope,
    disconnect() { offline = true; },
    get skipped() { return skipped; },
    get claimed() { return claimed; },
    async lifecycle(name) {
      let task;
      handlers[name]({ waitUntil(promise) { task = promise; } });
      await task;
    },
    request(url, mode = 'cors', method = 'GET') {
      let task;
      handlers.fetch({ request: { url, mode, method }, respondWith(promise) { task = promise; } });
      return task;
    }
  };
}

test('installed app, scripts, layout and downloadable file remain available offline in a subdirectory', async () => {
  const browser = browserCache();
  await browser.lifecycle('install');
  await browser.lifecycle('activate');
  assert.equal(browser.skipped, true);
  assert.equal(browser.claimed, true);
  browser.disconnect();
  assert.equal(await (await browser.request(browser.scope, 'navigate')).text(), '<html>chef app</html>');
  assert.equal(await (await browser.request(browser.scope + 'assets/app.js')).text(), 'menu and recipe logic');
  assert.equal(await (await browser.request(browser.scope + 'assets/app.css')).text(), 'mobile layout');
  assert.equal(await (await browser.request(browser.scope + 'belkovy-shef.html', 'navigate')).text(), '<html>self-contained app</html>');
});

test('API, foreign origins and uploads bypass cache; activation only removes obsolete app caches', async () => {
  const browser = browserCache();
  await browser.caches.open('belkovy-chef-app-old');
  await browser.caches.open('unrelated-site-cache');
  await browser.lifecycle('install');
  await browser.lifecycle('activate');
  assert.deepEqual((await browser.caches.keys()).sort(), ['belkovy-chef-app-current', 'unrelated-site-cache']);
  assert.equal(browser.request('https://example.com/api/assistant/status'), undefined);
  assert.equal(browser.request(browser.scope + 'api/assistant/status'), undefined);
  assert.equal(browser.request('https://other.example.com/assets/app.js'), undefined);
  assert.equal(browser.request(browser.scope + 'api/food-photo', 'cors', 'POST'), undefined);
});

test('failed first download does not activate an incomplete offline version', async () => {
  const browser = browserCache();
  browser.disconnect();
  await assert.rejects(browser.lifecycle('install'), /No connection/);
  assert.equal(browser.skipped, false);
  assert.equal(browser.claimed, false);
});
