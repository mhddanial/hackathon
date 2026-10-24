// Offline synthetic configuration/auth middleware checks. Never load .env or call Auth.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const source = await readFile(new URL('../src/utils/supabase/middleware.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
function setup(url, key, user = null, refresh = false) {
  const calls = [], output = {};
  const sdk = { createServerClient: (url, key, options) => {
    calls.push({ url, key });
    return { auth: { getUser: async () => {
      if (refresh) options.cookies.setAll([{ name: 'synthetic-session', value: 'synthetic-cookie', options: { httpOnly: true, path: '/' } }]);
      return { data: { user } };
    } } };
  } };
  new Function('require', 'exports', 'process', code)(name => {
    if (name === '@supabase/ssr') return sdk;
    assert.equal(name, 'next/server'); return { NextResponse };
  }, output, { env: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } });
  return { calls, run: path => output.updateSession(new NextRequest(`http://127.0.0.1:3000${path}`)) };
}
await check('Malformed/missing configuration returns 503 before creating Auth clients', async () => {
  for (const url of [undefined, '', 'https://<project>.supabase.co', 'not-a-url', 'ftp://example.invalid', 'https://exa mple.invalid', 'https://user:synthetic-private@example.invalid', 'https://example.invalid?key=synthetic-private', 'https://example.invalid/#fragment']) {
    const s = setup(url, 'synthetic-private');
    const response = await s.run('/departure');
    assert.equal(response.status, 503); assert.equal(s.calls.length, 0);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-middleware-next'), null);
    const text = await response.text(); assert.match(text, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(text, /synthetic-private|<project>|user:/);
  }
});
await check('Missing public key also fails closed on login and protected routes', async () => {
  for (const path of ['/login', '/register', '/dashboard', '/departure']) {
    const s = setup('https://example.supabase.co', '  ');
    assert.equal((await s.run(path)).status, 503); assert.equal(s.calls.length, 0);
  }
});
await check('HTTP loopback and HTTPS configuration accept trimmed settings', async () => {
  for (const url of ['http://127.0.0.1:54321', 'https://example.supabase.co']) {
    const s = setup(` ${url} `, ' synthetic-public-key ');
    assert.equal((await s.run('/login')).status, 200);
    assert.deepEqual(s.calls, [{ url, key: 'synthetic-public-key' }]);
  }
});
await check('Configured signed-out dashboard routes retain login protection', async () => {
  const s = setup('http://127.0.0.1:54321', 'synthetic-public-key');
  for (const path of ['/dashboard', '/planner', '/schedules', '/oracle', '/departure']) {
    const response = await s.run(path);
    assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  }
});
await check('Configured signed-in users retain auth redirects and page access', async () => {
  const s = setup('http://127.0.0.1:54321', 'synthetic-public-key', { id: 'synthetic-user' });
  for (const path of ['/login', '/register']) {
    const response = await s.run(path);
    assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location')).pathname, '/dashboard');
  }
  assert.equal((await s.run('/departure')).status, 200);
});
await check('Configured refresh preserves session cookies in the returned response', async () => {
  const s = setup('http://127.0.0.1:54321', 'synthetic-public-key', { id: 'synthetic-user' }, true);
  const response = await s.run('/departure');
  assert.equal(response.status, 200); assert.equal(response.cookies.get('synthetic-session').value, 'synthetic-cookie');
});
console.log(JSON.stringify({ result: 'passed', checks_passed: checks.length, checks, scope: 'Offline synthetic middleware checks with real NextRequest/NextResponse and stubbed Auth; no .env, network or real login.' }));
