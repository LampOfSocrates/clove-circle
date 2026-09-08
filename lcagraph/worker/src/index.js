/* LCA Graph beta proxy.

   The static site cannot hold a secret, so this Worker is the only place the OpenRouter
   key lives. It refuses every request that does not carry a valid beta code, caps usage
   per code and per day, and forwards the prompt to OpenRouter.

   Routes (all JSON):
     GET  /            status, no secrets
     POST /verify      { code }             -> { ok, name, remainingToday }
     POST /chat        { prompt }           -> { text, model, usage }   (hello world)
     POST /draft       { description, data, functionalUnit, fix? }
                                            -> { doc, model, usage, attempt }
                       fix = { doc, errors: [..] } asks the model to repair a previous draft.
   Every POST must carry the code in the X-Beta-Code header (or body.code for /verify).

   Beta codes live in KV as  code:<code>  ->  { "name": "...", "expires": "2026-12-31", "dailyCap": 40 }
   A BETA_MASTER_CODE secret, if set, is accepted too, so the first hello world needs no KV row. */

import { SYSTEM_PROMPT } from './prompt.generated.js';

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

async function bump(code, env, cost) {
  if (!env.BETA) return;
  const d = today();
  const month = d.slice(0, 7);
  const u = await usage(code, env);
  const ttl = 2 * 86400;
  const writes = [
    env.BETA.put('use:' + code + ':' + d, String(u.code + 1), { expirationTtl: ttl }),
    env.BETA.put('use:_all:' + d, String(u.global + 1), { expirationTtl: ttl })
  ];
  if (typeof cost === 'number' && cost > 0) {
    // Running spend in USD, per code and overall, kept for 400 days so a monthly bill can be read back.
    const [c, g] = await Promise.all([env.BETA.get('spend:' + code + ':' + month), env.BETA.get('spend:_all:' + month)]);
    writes.push(env.BETA.put('spend:' + code + ':' + month, String((Number(c) || 0) + cost), { expirationTtl: 400 * 86400 }));
    writes.push(env.BETA.put('spend:_all:' + month, String((Number(g) || 0) + cost), { expirationTtl: 400 * 86400 }));
  }
  await Promise.all(writes);
}

/* Monthly spend ceiling in USD, checked before every model call. */
async function overBudget(env) {
  if (!env.BETA) return false;
  const cap = Number(env.MONTHLY_BUDGET_USD);
  if (!(cap > 0)) return false;
  const g = await env.BETA.get('spend:_all:' + today().slice(0, 7));
  return (Number(g) || 0) >= cap;
}

async function authorise(request, env, bodyCode) {
  const code = request.headers.get('X-Beta-Code') || bodyCode || '';
  const entry = await lookupCode(code, env);
  if (!entry) return { error: json({ ok: false, error: 'Invalid or expired access code.' }, 403) };
  const u = await usage(code, env);
  const globalCap = Number(env.DAILY_CAP_GLOBAL) || 200;
  if (u.code >= entry.dailyCap) return { error: json({ ok: false, error: 'Daily limit for this code reached. Try again tomorrow.' }, 429) };
  if (u.global >= globalCap) return { error: json({ ok: false, error: 'The beta service is at capacity for today.' }, 429) };
  if (await overBudget(env)) return { error: json({ ok: false, error: 'The beta service has reached its budget for this month.' }, 429) };
  return { code, entry, remaining: entry.dailyCap - u.code };
}

/* Cost controls, all from wrangler.jsonc vars:
   - one model per route (MODEL_CHAT, MODEL_DRAFT, MODEL_REPAIR), with MODEL as the fallback;
   - MODEL_FALLBACKS: comma-separated models tried in order if the first is unavailable;
   - MAX_PRICE_PROMPT / MAX_PRICE_COMPLETION: ceiling in $ per million tokens; OpenRouter
     refuses any provider above it, so a typo can never route to a premium model;
   - providers sorted by price for the chosen model. */
function modelFor(route, env) {
  const key = 'MODEL_' + route.toUpperCase();
  return env[key] || env.MODEL || 'openai/gpt-4.1-mini';
}

async function callOpenRouter(messages, env, opts) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set on this Worker.');
  const body = { model: (opts && opts.model) || env.MODEL || 'openai/gpt-4.1-mini', messages, max_tokens: (opts && opts.maxTokens) || 2000, usage: { include: true } };
  const fallbacks = (env.MODEL_FALLBACKS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fallbacks.length) body.models = [body.model].concat(fallbacks.filter((m) => m !== body.model));
  const provider = { sort: 'price' };
  const maxP = Number(env.MAX_PRICE_PROMPT), maxC = Number(env.MAX_PRICE_COMPLETION);
  if (!(opts && opts.noCeiling) && (maxP > 0 || maxC > 0)) provider.max_price = { prompt: maxP > 0 ? maxP : undefined, completion: maxC > 0 ? maxC : undefined };
  body.provider = provider;
  if (opts && opts.json) body.response_format = { type: 'json_object' };
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clovecircle.com',
      'X-Title': 'Clove Circle LCA Graph beta'
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || ('OpenRouter returned HTTP ' + r.status);
    throw new Error(msg);
  }
  return {
    text: data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '',
    model: data.model || body.model,
    usage: data.usage || null,
    cost: data.usage && typeof data.usage.cost === 'number' ? data.usage.cost : null
  };
}

/* Strip markdown fences and anything before the first { or after the last }. */
function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) throw new Error('The model did not return a JSON object.');
  return JSON.parse(t.slice(a, b + 1));
}

function draftMessages(body) {
  const parts = [];
  parts.push('PROCESS DESCRIPTION' + '\n' + (body.description || '').trim());
  if (body.functionalUnit) parts.push('FUNCTIONAL UNIT' + '\n' + String(body.functionalUnit).trim());
  if (body.data) parts.push('DATA SUPPLIED BY THE USER (use these numbers; cite them in source)' + '\n' + String(body.data).trim());
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  // The flowsheet image, when present, is the authority on units and streams.
  const text = parts.join('\n' + '\n');
  const userContent = body.image
    ? [{ type: 'text', text: 'FLOWSHEET: the attached image is the process flowsheet. Read every box as a unit operation and every arrow as a stream, keep the labels as written, and treat it as authoritative for units and streams. Then draft the full model.' + '\n' + '\n' + text },
       { type: 'image_url', image_url: { url: body.image } }]
    : text;
  if (body.fix && body.fix.doc) {
    messages.push({ role: 'user', content: userContent });
    messages.push({ role: 'assistant', content: JSON.stringify(body.fix.doc) });
    messages.push({ role: 'user', content:
      'The compiler rejected that document. Fix every problem below and return the complete corrected JSON document only.' + '\n' + '\n' +
      (body.fix.errors || []).map((e) => '- ' + e).join('\n') });
  } else {
    messages.push({ role: 'user', content: Array.isArray(userContent)
      ? [userContent[0], userContent[1], { type: 'text', text: 'Return the complete PML JSON document now.' }]
      : text + '\n' + '\n' + 'Return the complete PML JSON document now.' });
  }
  return messages;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'lcagraph-beta', kv: !!env.BETA, keyConfigured: !!env.OPENROUTER_API_KEY,
        models: { chat: modelFor('chat', env), draft: modelFor('draft', env), repair: modelFor('repair', env), escalate: env.MODEL_ESCALATE || null, escalateAfter: Number(env.ESCALATE_AFTER) || 3, fallbacks: env.MODEL_FALLBACKS || '' },
        maxPricePerMillion: { prompt: env.MAX_PRICE_PROMPT || null, completion: env.MAX_PRICE_COMPLETION || null },
        monthlyBudgetUsd: env.MONTHLY_BUDGET_USD || null }, 200, cors);
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
        ], env, { model: modelFor('chat', env), maxTokens: 1000 });
        await bump(auth.code, env, out.cost);
        return json({ ok: true, ...out, remainingToday: auth.remaining - 1 }, 200, cors);
      } catch (e) {
        return json({ ok: false, error: e.message }, 502, cors);
      }
    }

    if (url.pathname === '/draft') {
      const auth = await authorise(request, env, null);
      if (auth.error) return new Response(auth.error.body, { status: auth.error.status, headers: { ...JSON_HEADERS, ...cors } });
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const hasImage = typeof body.image === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(body.image);
      if (!hasImage && description.length < 20) return json({ ok: false, error: 'Upload a flowsheet image or describe the process in a sentence or two.' }, 400, cors);
      if (body.image && !hasImage) return json({ ok: false, error: 'image must be a PNG, JPEG or WebP data URL.' }, 400, cors);
      const maxImage = Number(env.DRAFT_MAX_IMAGE_CHARS) || 2500000;
      if (hasImage && body.image.length > maxImage) return json({ ok: false, error: 'The image is too large after encoding; use a smaller picture.' }, 413, cors);
      const max = Number(env.DRAFT_MAX_CHARS) || 60000;
      const size = description.length + String(body.data || '').length + JSON.stringify(body.fix || '').length;
      if (size > max) return json({ ok: false, error: 'The request is larger than ' + max + ' characters. Trim the data.' }, 413, cors);
      try {
        // Cheap model first; from ESCALATE_AFTER onwards a stronger model takes over the
        // repair, since a cheap model that has failed twice rarely converges on its own.
        const attempt = Number(body.attempt) || 1;
        const escalateAfter = Number(env.ESCALATE_AFTER) || 3;
        const escalate = !!env.MODEL_ESCALATE && attempt >= escalateAfter;
        const route = escalate ? 'escalate' : (body.fix && body.fix.doc ? 'repair' : 'draft');
        const out = await callOpenRouter(draftMessages(body), env, { model: modelFor(route, env), json: true, maxTokens: Number(env.DRAFT_MAX_TOKENS) || 12000, noCeiling: escalate });
        await bump(auth.code, env, out.cost);
        let doc;
        try { doc = extractJson(out.text); }
        catch (e) { return json({ ok: false, error: e.message, raw: String(out.text).slice(0, 2000), model: out.model, usage: out.usage }, 502, cors); }
        return json({ ok: true, doc, model: out.model, usage: out.usage, remainingToday: auth.remaining - 1 }, 200, cors);
      } catch (e) {
        return json({ ok: false, error: e.message }, 502, cors);
      }
    }

    return json({ ok: false, error: 'Not found.' }, 404, cors);
  }
};
