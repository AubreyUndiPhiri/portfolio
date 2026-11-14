/**
 * Undi agent proxy — Cloudflare Worker.
 * Keeps the GitHub token server-side and forwards chat-completion requests
 * (with tool definitions) to the free GitHub Models inference API.
 *
 * Secrets / vars (see wrangler.toml):
 *   GITHUB_TOKEN     (secret)  fine-grained PAT with "Models: read" permission
 *   ALLOWED_ORIGINS  (var)     comma-separated list of site origins
 *   MODEL            (var)     primary model id, e.g. openai/gpt-4.1-mini
 *   FALLBACK_MODEL   (var)     used if the primary fails, e.g. openai/gpt-4o-mini
 */
const ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MAX_BODY = 80_000;
const MAX_MESSAGES = 40;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const hits = new Map(); // best-effort per-isolate rate limiting

function cors(origin, allowed) {
  const ok = allowed.includes(origin) || allowed.includes("*");
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

function sanitize(body) {
  if (!body || !Array.isArray(body.messages)) throw new Error("messages[] required");
  const roles = new Set(["system", "user", "assistant", "tool"]);
  const messages = body.messages.slice(-MAX_MESSAGES).filter(m => roles.has(m?.role)).map(m => {
    const out = { role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 20_000) : "" };
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) out.tool_calls = m.tool_calls.slice(0, 8);
    if (m.role === "tool") out.tool_call_id = String(m.tool_call_id || "");
    return out;
  });
  // A trimmed window must not start with orphaned tool results.
  while (messages.length && messages[0].role === "tool") messages.shift();
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 16) : undefined;
  return { messages, tools };
}

async function complete(env, model, payload) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model, temperature: 0.4, max_tokens: 700, ...payload, ...(payload.tools ? { tool_choice: "auto" } : {}) }),
  });
}

export default {
  async fetch(request, env) {
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET") return json({ ok: true, service: "undi-agent-proxy", model: env.MODEL }, 200, headers);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
    if (allowed.length && !allowed.includes("*") && !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403, headers);
    if (!env.GITHUB_TOKEN) return json({ error: "Proxy not configured (GITHUB_TOKEN missing)" }, 500, headers);

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    if (limited(ip)) return json({ error: "Too many requests — try again in a few minutes." }, 429, headers);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "Request too large" }, 413, headers);

    let payload;
    try { payload = sanitize(JSON.parse(raw)); } catch (e) { return json({ error: String(e.message || e) }, 400, headers); }

    const models = [env.MODEL || "openai/gpt-4.1-mini", env.FALLBACK_MODEL || "openai/gpt-4o-mini"];
    let last;
    for (const model of models) {
      const res = await complete(env, model, payload);
      if (res.ok) {
        const data = await res.json();
        return json({ model, choices: data.choices, usage: data.usage }, 200, headers);
      }
      last = { status: res.status, detail: (await res.text()).slice(0, 400) };
      if (res.status === 401 || res.status === 403) break; // token problem — retrying won't help
    }
    return json({ error: "Model request failed", ...last }, 502, headers);
  },
};
