// Offline diagnostic checks: synthetic settings and injected fetch, no .env or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as nodeUrl from 'node:url';
import ts from 'typescript';

let environmentLoads = 0;
const moduleUrl = new URL('./diagnose-supabase-config.mjs', import.meta.url);
const source = await readFile(moduleUrl, 'utf8');
const compiled = ts.transpileModule(source.replaceAll('import.meta.url', 'moduleUrl'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction('require', 'exports', 'process', 'moduleUrl', compiled)(name => {
  if (name === '@next/env') return { default: { loadEnvConfig: () => { environmentLoads++; throw new Error('Environment files must not load'); } } };
  assert.equal(name, 'node:url'); return nodeUrl;
}, exports, { argv: ['node', 'synthetic-importer'] }, moduleUrl.href);
const { publicConfigStatus, authReachability } = exports;
assert.equal(environmentLoads, 0);

const env = { NEXT_PUBLIC_SUPABASE_URL: ' https://example.invalid ', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-key-never-print' };
let groups = 0;
async function check(name, run) { await run(); groups++; console.log(`PASS ${name}`); }
function privateOutput(result) {
  assert.doesNotMatch(JSON.stringify(result), /example\.invalid|synthetic-key|never-print/);
}

await check('Import does not load environment files; default configuration output remains three booleans', () => {
  assert.deepEqual(publicConfigStatus(env), { urlPresent: true, urlValid: true, keyPresent: true });
  privateOutput(publicConfigStatus(env));
});
await check('Invalid URLs skip fetch without exposing supplied values', async () => {
  for (const url of [undefined, '', 'https://<project>.supabase.co', 'ftp://example.invalid', 'https://user:never-print@example.invalid', 'https://example.invalid?key=never-print']) {
    const result = await authReachability({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }, () => assert.fail('Unexpected fetch'));
    assert.deepEqual(result, { checked: false, httpResponded: false, httpStatus: null, failure: 'INVALID_URL' });
    privateOutput(result);
  }
});
await check('Health probe is one bounded GET with no key, cookies, body or redirect following', async () => {
  let calls = 0, bodiesCancelled = 0;
  const result = await authReachability(env, async (url, options) => {
    calls++;
    assert.equal(url.href, 'https://example.invalid/auth/v1/health');
    assert.deepEqual(Object.keys(options).sort(), ['credentials', 'method', 'redirect', 'signal']);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    assert(options.signal instanceof AbortSignal);
    return { status: 200, body: { cancel: async () => { bodiesCancelled++; } } };
  });
  assert.equal(calls, 1); assert.equal(bodiesCancelled, 1);
  assert.deepEqual(result, { checked: true, httpResponded: true, httpStatus: 200, failure: null });
  privateOutput(result);
});
await check('HTTP errors are reported as responses, never as successful authentication', async () => {
  for (const status of [401, 403, 404, 503]) {
    const result = await authReachability(env, async () => ({ status }));
    assert.deepEqual(result, { checked: true, httpResponded: true, httpStatus: status, failure: null });
    assert.equal('loginVerified' in result, false); privateOutput(result);
  }
});
await check('DNS, refusal, connection, timeout and TLS failures have static redacted categories', async () => {
  for (const [code, expected] of [['ENOTFOUND', 'DNS_ERROR'], ['EAI_AGAIN', 'DNS_ERROR'], ['ECONNREFUSED', 'CONNECTION_REFUSED'], ['ECONNRESET', 'CONNECTION_ERROR'], ['UND_ERR_CONNECT_TIMEOUT', 'TIMEOUT'], ['ETIMEDOUT', 'TIMEOUT'], ['CERT_HAS_EXPIRED', 'TLS_ERROR']]) {
    const result = await authReachability(env, async () => { throw Object.assign(new Error('never-print'), { cause: { code } }); });
    assert.deepEqual(result, { checked: true, httpResponded: false, httpStatus: null, failure: expected }); privateOutput(result);
  }
});
await check('Aborts and unknown exceptions do not leak raw messages or response bodies', async () => {
  for (const [name, expected] of [['TimeoutError', 'TIMEOUT'], ['AbortError', 'TIMEOUT'], ['Error', 'NETWORK_OR_REDIRECT_ERROR']]) {
    const result = await authReachability(env, async () => { throw Object.assign(new Error('never-print'), { name }); });
    assert.equal(result.failure, expected); privateOutput(result);
  }
  const result = await authReachability(env, async () => ({ status: 200, body: { cancel: async () => { throw new Error('never-print'); } } }));
  assert.equal(result.httpStatus, 200); privateOutput(result);
});
console.log(`${groups} offline diagnostic groups passed; no real settings, network or sign-in used.`);
