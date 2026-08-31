// Cloudflare Worker — همگام‌سازی + تحلیل (llm7 رایگان + Workers AI)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function fmtToman(n) {
  return Math.round(Math.abs(n || 0)).toLocaleString("en-US") + " تومان";
}

function buildPrompt(body) {
  const tm = body.thisMonth || {};
  const lm = body.lastMonth || {};
  const cats = (tm.categories || []).slice(0, 5)
    .map((c) => `${c.name}: ${fmtToman(c.amount)}`).join("، ");
  return `مشاور مالی فارسی باش. ۴ تا ۷ جمله کوتاه. یک نکته عملی بگو. بدون مقدمه.
این ماه: درآمد ${fmtToman(tm.totalIncome)}، مخارج ${fmtToman(tm.totalExpense)}، مانده ${fmtToman((tm.totalIncome||0)-(tm.totalExpense||0))}
دسته‌ها: ${cats || "—"}
ماه قبل: درآمد ${fmtToman(lm.totalIncome)}، مخارج ${fmtToman(lm.totalExpense)}`;
}

function extract(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (data.response) return String(data.response).trim();
  if (data.result) return String(data.result).trim();
  if (data.choices?.[0]?.message?.content) return String(data.choices[0].message.content).trim();
  return "";
}

async function viaLlm7(prompt) {
  const models = ["gpt-oss", "codestral-latest", "minimax-m2.7"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Reply only in Persian. Be concise." },
            { role: "user", content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const text = extract(data);
      if (text) return { summary: text, model, provider: "llm7" };
    } catch (_) {}
  }
  return null;
}

async function viaWorkersAI(env, prompt) {
  if (!env.AI) return null;
  const models = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.2-3b-instruct"];
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "Reply in Persian only." },
          { role: "user", content: prompt }
        ],
        max_tokens: 600
      });
      const text = extract(result);
      if (text) return { summary: text, model, provider: "cloudflare-ai" };
    } catch (_) {}
  }
  return null;
}

async function handleAnalyze(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "invalid json" }, 400); }
  const prompt = buildPrompt(body);

  const a = await viaLlm7(prompt);
  if (a) return jsonResponse(a);

  const b = await viaWorkersAI(env, prompt);
  if (b) return jsonResponse(b);

  return jsonResponse({ error: "ai_request_failed" }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (url.pathname === "/analyze" && request.method === "POST") return handleAnalyze(request, env);
    if (url.pathname !== "/data") return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    const code = url.searchParams.get("code");
    if (!code || !/^\d{6}$/.test(code)) return jsonResponse({ error: "invalid code" }, 400);
    const key = `data:${code}`;
    if (request.method === "GET") {
      const stored = await env.DNK_KV.get(key);
      if (!stored) return jsonResponse({ error: "not found" }, 404);
      return new Response(stored, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return jsonResponse({ error: "invalid json" }, 400); }
      body.updatedAt = Date.now();
      await env.DNK_KV.put(key, JSON.stringify(body));
      return jsonResponse({ ok: true });
    }
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }
};
