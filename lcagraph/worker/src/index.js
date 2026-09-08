/* LCA Graph beta proxy.

   The static site cannot hold a secret, so this Worker is the only place the OpenRouter
   key lives. It refuses every request that does not carry a valid beta code, caps usage
   per code and per day, and forwards the prompt to OpenRouter.

   Routes (all JSON):
     GET  /            status, no secrets
     POST /verify      { code }             -> { ok, name, remainingToday }
     POST /chat        { prompt }           -> { text, model, usage }   (hello world)
   Every POST must carry the code in the X-Beta-Code header (or body.code for /verify).

   Beta codes live in KV as  code:<code>  ->  { "name": "...", "expires": "2026-12-31", "dailyCap": 40 }
   A BETA_MASTER_CODE secret, if set, is accepted too, so the first hello world needs no KV row. */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Beta-Code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { ...JSON_HEADERS, ...(extra || {}) } });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* Constant-time string compare so a master code cannot be guessed by timing. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* Resolve a code to an entry, or null. */
async function lookupCode(code, env) {
  if (!code || code.length < 6 || code.length > 80) return null;
  if (env.BETA_MASTER_CODE && safeEqual(code, env.BETA_MASTER_CODE)) {
    return { name: 'master', dailyCap: Number(env.DAILY_CAP_PER_CODE) || 40, master: true };
  }
  if (!env.BETA) return null;
  const raw = await env.BETA.get('code:' + code);
  if (!raw) return null;
  let entry;
  try { entry = JSON.parse(raw); } catch (e) { return null; }
  if (entry.expires && entry.expires < today()) return null;
  if (entry.disabled) return null;
  return { name: entry.name || 'unnamed', dailyCap: Number(entry.dailyCap) || Number(env.DAILY_CAP_PER_CODE) || 40 };
}

/* Usage counters in KV: use:<code>:<date> and use:_all:<date>, expiring after two days. */
async function usage(code, env) {
  if (!env.BETA) return { code: 0, global: 0 };
  const d = today();
  const [c, g] = await Promise.all([env.BETA.get('use:' + code + ':' + d), env.BETA.get('use:_all:' + d)]);
  return { code: Number(c) || 0, global: Number(g) || 0 };
}

async function bump(code, env) {
  if (!env.BETA) return;
  const d = today();
  const u = await usage(code, env);
  const ttl = 2 * 86400;
  await Promise.all([
    env.BETA.put('use:' + code + ':' + d, String(u.code + 1), { expirationTtl: ttl }),
    env.BETA.put('use:_all:' + d, String(u.global + 1), { expirationTtl: ttl })
  ]);
}

async function authorise(request, env, bodyCode) {
  const code = request.headers.get('X-Beta-Code') || bodyCode || '';
  const entry = await lookupCode(code, env);
  if (!entry) return { error: json({ ok: false, error: 'Invalid or expired access code.' }, 403) };
  const u = await usage(code, env);
  const globalCap = Number(env.DAILY_CAP_GLOBAL) || 200;
  if (u.code >= entry.dailyCap) return { error: json({ ok: false, error: 'Daily limit for this code reached. Try again tomorrow.' }, 429) };
  if (u.global >= globalCap) return { error: json({ ok: false, error: 'The beta service is at capacity for today.' }, 429) };
  return { code, entry, remaining: entry.dailyCap - u.code };
}

async function callOpenRouter(messages, env) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set on this Worker.');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clovecircle.com',
      'X-Title': 'Clove Circle LCA Graph beta'
    },
    body: JSON.stringify({ model: env.MODEL || 'anthropic/claude-sonnet-4', messages, max_tokens: 2000 })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || ('OpenRouter returned HTTP ' + r.status);
    throw new Error(msg);
  }
  return {
    text: data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '',
    model: data.model || env.MODEL,
    usage: data.usage || null
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'lcagraph-beta', model: env.MODEL, kv: !!env.BETA, keyConfigured: !!env.OPENROUTER_API_KEY }, 200, cors);
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, cors);

    let body = {};
    try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Body must be JSON.' }, 400, cors); }

    if (url.pathname === '/verify') {
      const auth = await authorise(request, env, body.code);
      if (auth.error) return new Response(auth.error.body, { status: auth.error.status, headers: { ...JSON_HEADERS, ...cors } });
      return json({ ok: true, name: auth.entry.name, remainingToday: auth.remaining }, 200, cors);
    }

    if (url.pathname === '/chat') {
      const auth = await authorise(request, env, null);
      if (auth.error) return new Response(auth.error.body, { status: auth.error.status, headers: { ...JSON_HEADERS, ...cors } });
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const max = Number(env.MAX_PROMPT_CHARS) || 20000;
      if (!prompt) return json({ ok: false, error: 'prompt is required.' }, 400, cors);
      if (prompt.length > max) return json({ ok: false, error: 'prompt is longer than ' + max + ' characters.' }, 413, cors);
      try {
        const out = await callOpenRouter([
          { role: 'system', content: 'You are the assistant inside Clove Circle LCA Graph, a life cycle assessment tool. Answer briefly.' },
          { role: 'user', content: prompt }
        ], env);
        await bump(auth.code, env);
        return json({ ok: true, ...out, remainingToday: auth.remaining - 1 }, 200, cors);
      } catch (e) {
        return json({ ok: false, error: e.message }, 502, cors);
      }
    }

    return json({ ok: false, error: 'Not found.' }, 404, cors);
  }
};
