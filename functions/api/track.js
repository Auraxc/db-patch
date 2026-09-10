const EVENTS = new Set(['page_view', 'article_click', 'read_50', 'read_complete']);
const allowedHost = host => host === 'db-patch.com'
  || host === 'www.db-patch.com'
  || host === 'db-patch.pages.dev'
  || host.endsWith('.db-patch.pages.dev');
const response = status => new Response(null, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  },
});
const normalizePath = value => {
  if (typeof value !== 'string' || value.length > 512) return null;
  try {
    const url = new URL(value, 'https://db-patch.com');
    if (url.origin !== 'https://db-patch.com' || !url.pathname.startsWith('/')) return null;
    return url.pathname.replace(/\/{2,}/g, '/');
  } catch { return null; }
};
const shanghaiDay = (now = Date.now()) => new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function visitorDigest(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return [...bytes.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  let originURL;
  try { originURL = new URL(origin || ''); } catch { return response(403); }
  if (originURL.protocol !== 'https:' || !allowedHost(originURL.hostname) || fetchSite === 'cross-site') return response(403);
  if (!env.ANALYTICS_DB || !env.ANALYTICS_SALT) return response(503);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 2048) return response(413);

  let body;
  try { body = await request.json(); } catch { return response(400); }
  const event = typeof body?.event === 'string' ? body.event : '';
  const sourcePath = normalizePath(body?.path);
  const target = body?.target ? normalizePath(body.target) : '';
  if (!EVENTS.has(event) || !sourcePath || (event === 'article_click' && !target)) return response(400);
  // Article clicks deduplicate by destination across the whole site, not by the page where the click occurred.
  const path = event === 'article_click' ? target : sourcePath;

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return response(400);
  const day = shanghaiDay();
  const visitor = await visitorDigest(env.ANALYTICS_SALT, `${day}\n${ip}\n${event}\n${path}\n${target}`);
  await env.ANALYTICS_DB.prepare(`
    INSERT OR IGNORE INTO analytics_events
      (day, event, path, target, visitor_hash, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(day, event, path, target, visitor).run();
  return response(204);
}

export { normalizePath, shanghaiDay, visitorDigest };
