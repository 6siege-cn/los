import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../cloud/relay/worker.js';

const endpoint = 'https://6siege-cnapi.icemoe.moe/api/relay-health';

test('relay health confirms both relay and upstream availability', async () => {
  let upstreamRequest;
  const response = await handleRequest(new Request(endpoint, {
    headers: {Origin: 'https://6siege-cn.github.io'}
  }), async (url, options) => {
    upstreamRequest = {url, options};
    return Response.json({ok: true, version: 3});
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://6siege-cn.github.io');
  assert.equal(upstreamRequest.url, 'https://six-siege-api.rainlef.workers.dev/api/health');
  assert.equal(upstreamRequest.options.redirect, 'error');
  assert.deepEqual(await response.json(), {
    ok: true,
    relay: 'ready',
    relayVersion: 1,
    upstream: 'ready',
    upstreamVersion: 3
  });
});

test('relay health permits direct browser navigation without an Origin header', async () => {
  const response = await handleRequest(new Request(endpoint), async () => Response.json({ok: true, version: 3}));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('relay health rejects unapproved browser origins', async () => {
  let called = false;
  const response = await handleRequest(new Request(endpoint, {
    headers: {Origin: 'https://example.com'}
  }), async () => {
    called = true;
    return Response.json({ok: true, version: 3});
  });

  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test('relay exposes no business endpoints during phase one', async () => {
  let called = false;
  const response = await handleRequest(new Request('https://6siege-cnapi.icemoe.moe/api/matches', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{}'
  }), async () => {
    called = true;
    return Response.json({ok: true});
  });

  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test('relay reports an unavailable upstream without leaking an exception', async () => {
  const response = await handleRequest(new Request(endpoint), async () => {
    throw new Error('private upstream failure');
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    ok: false,
    relay: 'ready',
    relayVersion: 1,
    upstream: 'unavailable',
    upstreamVersion: null
  });
});

test('relay health preflight only allows read-only phase-one methods', async () => {
  const response = await handleRequest(new Request(endpoint, {
    method: 'OPTIONS',
    headers: {Origin: 'https://6siege-cn.github.io'}
  }));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
});
