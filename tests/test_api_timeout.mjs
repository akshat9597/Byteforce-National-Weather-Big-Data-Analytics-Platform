import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from '../frontend/node_modules/typescript/lib/typescript.js';
const source = readFileSync(new URL('../frontend/services/api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { api, ApiError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const abortable = (signal) => new Promise((_, reject) => {
  const fail = () => reject(new DOMException('Aborted', 'AbortError'));
  if (signal.aborted) fail();
  else signal.addEventListener('abort', fail, { once: true });
});
test('stalled requests terminate with an actionable message', async (t) => {
  t.mock.method(globalThis, 'fetch', (_, options) => abortable(options.signal));
  await assert.rejects(api('/auth/me', { timeoutMs: 20 }), e => e instanceof ApiError && /taking longer/.test(e.message));
});
test('timeout covers a stalled response body too', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, options) => ({ ok: true, status: 200, json: () => abortable(options.signal) }));
  await assert.rejects(api('/reports', { timeoutMs: 20 }), /taking longer/);
});
test('caller cancellation is retained', async (t) => {
  t.mock.method(globalThis, 'fetch', (_, options) => abortable(options.signal));
  const controller = new AbortController();
  const request = api('/auth/me', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /cancelled/);
});
test('successful requests retain cookies and return JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/me');
    assert.equal(options.credentials, 'include');
    assert.equal(options.timeoutMs, undefined);
    return new Response(JSON.stringify({ role: 'Viewer' }));
  });
  assert.deepEqual(await api('/auth/me'), { role: 'Viewer' });
});
test('rate limit status and Retry-After survive', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({detail:'Wait before resending.'}), {status:429,headers:{'Retry-After':'45'}}));
  await assert.rejects(api('/auth/send-otp'), e => e.status === 429 && e.retryAfter === 45);
});
