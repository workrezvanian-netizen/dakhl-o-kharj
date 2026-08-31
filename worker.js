// Cloudflare Worker — بک‌اند همگام‌سازی «دخل و خرج»
// تحلیل هوش مصنوعی با OpenRouter (رایگان) / Groq / OpenAI
//
// Secrets:
//   wrangler secret put OPENROUTER_API_KEY   ← پیشنهادی (رایگان)
//   wrangler secret put GROQ_API_KEY         ← اختیاری
//   wrangler secret put OPENAI_API_KEY       ← اختیاری
//
// کلید OpenRouter: https://openrouter.ai/keys

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

function buildAnalysisPrompt(body) {
  const tm = body.thisMonth || {};
  const lm = body.lastMonth || {};
  const topCats = (tm.categories || []).slice(0, 5)
    .map((c) => `${c.name}: ${fmtToman(c.amount)}`)
    .join("، ");

  return `تو یک مشاور مالی خودمونی و دقیق برای اپلیکیشن «دخل و خرج» هستی.
با لحن دوستانه و کوتاه (۴ تا ۷ جمله) وضعیت مالی کاربر رو تحلیل کن.
قواعد:
- فقط فارسی بنویس.
- عددها رو با تومان بیان کن.
- یک نکته‌ی عملی و قابل‌اجرا برای ماه بعد بگو.
- بدون مقدمه یا عنوان اضافه.

اطلاعات این ماه:
- درآمد: ${fmtToman(tm.totalIncome)}
- مخارج: ${fmtToman(tm.totalExpense)}
- مانده: ${fmtToman((tm.totalIncome || 0) - (tm.totalExpense || 0))}
- ریز مخارج بر اساس دسته: ${topCats || "ثبت نشده"}

اطلاعات ماه قبل:
- درآمد: ${fmtToman(lm.totalIncome)}
- مخارج: ${fmtToman(lm.totalExpense)}`;
}

async function callChatCompletions(baseUrl, apiKey, model, prompt, extraHeaders) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(extraHeaders || {})
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a helpful Persian financial assistant. Always reply in Persian only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 700
    })
  });
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: res.ok, status: res.status, data, raw: text.slice(0, 400) };
}

function extractContent(data) {
  if (!data || !data.choices || !data.choices[0]) return "";
  const msg = data.choices[0].message;
  if (!msg) return "";
  return String(msg.content || "").trim();
}

async function handleAnalyze(request, env) {
  const openrouterKey = env.OPENROUTER_API_KEY || env.AI_API_KEY;
  const groqKey = env.GROQ_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  if (!openrouterKey && !groqKey && !openaiKey) {
    return jsonResponse({
      error: "no_api_key",
      detail: "هیچ کلید API تنظیم نشده. wrangler secret put OPENROUTER_API_KEY"
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const prompt = buildAnalysisPrompt(body);
  const attempts = [];

  // 1) OpenRouter — روتر رایگان + چند مدل رایگان پشتیبان
  if (openrouterKey) {
    const models = [
      "openrouter/free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen3-14b:free",
      "mistralai/mistral-small-3.1-24b-instruct:free"
    ];
    for (const model of models) {
      try {
        const r = await callChatCompletions(
          "https://openrouter.ai/api/v1",
          openrouterKey,
          model,
          prompt,
          {
            "HTTP-Referer": "https://dakhl-o-kharj.work-rezvanian.workers.dev",
            "X-Title": "Dakhl-o-Kharj"
          }
        );
        const content = extractContent(r.data);
        if (r.ok && content) {
          return jsonResponse({ summary: content, model });
        }
        attempts.push({ provider: "openrouter", model, status: r.status, detail: r.raw });
      } catch (e) {
        attempts.push({ provider: "openrouter", model, detail: String((e && e.message) || e) });
      }
    }
  }

  // 2) Groq
  if (groqKey) {
    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const model of models) {
      try {
        const r = await callChatCompletions(
          "https://api.groq.com/openai/v1",
          groqKey,
          model,
          prompt
        );
        const content = extractContent(r.data);
        if (r.ok && content) {
          return jsonResponse({ summary: content, model });
        }
        attempts.push({ provider: "groq", model, status: r.status, detail: r.raw });
      } catch (e) {
        attempts.push({ provider: "groq", model, detail: String((e && e.message) || e) });
      }
    }
  }

  // 3) OpenAI
  if (openaiKey) {
    try {
      const r = await callChatCompletions(
        "https://api.openai.com/v1",
        openaiKey,
        "gpt-4o-mini",
        prompt
      );
      const content = extractContent(r.data);
      if (r.ok && content) {
        return jsonResponse({ summary: content, model: "gpt-4o-mini" });
      }
      attempts.push({ provider: "openai", model: "gpt-4o-mini", status: r.status, detail: r.raw });
    } catch (e) {
      attempts.push({ provider: "openai", detail: String((e && e.message) || e) });
    }
  }

  return jsonResponse({
    error: "ai_request_failed",
    detail: attempts.length
      ? attempts.map((a) => `${a.provider}/${a.model || "?"}: ${a.status || ""} ${a.detail || ""}`).join(" | ").slice(0, 500)
      : "no_provider_responded"
  }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }

    if (url.pathname !== "/data") {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    const code = url.searchParams.get("code");
    if (!code || !/^\d{6}$/.test(code)) {
      return jsonResponse({ error: "invalid code" }, 400);
    }

    const key = `data:${code}`;

    if (request.method === "GET") {
      const stored = await env.DNK_KV.get(key);
      if (!stored) {
        return jsonResponse({ error: "not found" }, 404);
      }
      return new Response(stored, {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: "invalid json" }, 400);
      }
      body.updatedAt = Date.now();
      await env.DNK_KV.put(key, JSON.stringify(body));
      return jsonResponse({ ok: true });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }
};
