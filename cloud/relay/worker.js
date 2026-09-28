const ALLOWED_ORIGIN = 'https://6siege-cn.github.io';
const UPSTREAM_HEALTH_URL = 'https://six-siege-api.rainlef.workers.dev/api/health';

function responseHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    ...(origin === ALLOWED_ORIGIN ? {'Access-Control-Allow-Origin': ALLOWED_ORIGIN} : {})
  };
}

function json(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...responseHeaders(request), ...extraHeaders}
  });
}

export async function handleRequest(request, fetchImpl = globalThis.fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  if (url.pathname !== '/api/relay-health') {
    return json(request, {error: '接口尚未开放'}, 404);
  }

  if (origin && origin !== ALLOWED_ORIGIN) {
    return json(request, {error: '来源不允许'}, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...responseHeaders(request),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600'
      }
    });
  }

  if (request.method !== 'GET') {
    return json(request, {error: '请求方式不允许'}, 405, {Allow: 'GET, OPTIONS'});
  }

  try {
    const upstream = await fetchImpl(UPSTREAM_HEALTH_URL, {
      method: 'GET',
      headers: {'Accept': 'application/json'},
      redirect: 'error'
    });
    const result = await upstream.json().catch(() => null);
    const healthy = upstream.ok && result?.ok === true;

    return json(request, {
      ok: healthy,
      relay: 'ready',
      relayVersion: 1,
      upstream: healthy ? 'ready' : 'unavailable',
      upstreamVersion: healthy && Number.isInteger(result?.version) ? result.version : null
    }, healthy ? 200 : 502);
  } catch {
    return json(request, {
      ok: false,
      relay: 'ready',
      relayVersion: 1,
      upstream: 'unavailable',
      upstreamVersion: null
    }, 502);
  }
}

export default {
  fetch(request) {
    return handleRequest(request);
  }
};
