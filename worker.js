// Cloudflare Worker — بک‌اند «دخل و خرج»
// تحلیل هوشمند:
//   1) Cloudflare Workers AI  (بدون کلید خارجی)
//   2) Groq                   (رایگان — پیشنهادی)
//   3) OpenAI ChatGPT         (اغلب از IP کلودفلر 403 می‌شود)
//
//   wrangler secret put GROQ_API_KEY      ← پیشنهادی
//   wrangler secret put OPENAI_API_KEY    ← اختیاری
//   wrangler deploy

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
با لحن دوستانه و کوتاه (۴ تا ۷ جمله) وضعیت مالی کاربر را تحلیل کن.
قواعد:
- فقط فارسی بنویس.
- عددها را با تومان بیان کن.
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

function extractChatContent(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (data.response && typeof data.response === "string") return data.response.trim();
  if (data.result && typeof data.result === "string") return data.result.trim();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return String(data.choices[0].message.content || "").trim();
  }
  return "";
}

async function callOpenAICompatible(baseUrl, apiKey, model, prompt) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a helpful Persian financial assistant for the app «دخل و خرج». Always reply in Persian only. Be concise and practical."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 700
    })
  });
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: res.ok, status: res.status, data, raw: text.slice(0, 300) };
}

async function handleAnalyze(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const prompt = buildAnalysisPrompt(body);
  const attempts = [];
  const groqKey = env.GROQ_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  // ── 1) Cloudflare Workers AI (از داخل Worker، بدون بلاک IP) ──
  if (env.AI) {
    const models = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/qwen/qwen1.5-7b-chat-awq"
    ];
    for (const model of models) {
      try {
        const result = await env.AI.run(model, {
          messages: [
            {
              role: "system",
              content: "You are a helpful Persian financial assistant. Always reply in Persian only. Be concise."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 700,
          temperature: 0.7
        });
        const content = extractChatContent(result);
        if (content) {
          return jsonResponse({ summary: content, model, provider: "cloudflare-ai" });
        }
        attempts.push({ provider: "cloudflare-ai", model, detail: "empty_response" });
      } catch (e) {
        attempts.push({
          provider: "cloudflare-ai",
          model,
          detail: String((e && e.message) || e).slice(0, 140)
        });
      }
    }
  } else {
    attempts.push({ provider: "cloudflare-ai", detail: "AI binding not configured" });
  }

  // ── 2) Groq (رایگان، معمولاً از Worker کار می‌کند) ──
  if (groqKey) {
    for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]) {
      try {
        const r = await callOpenAICompatible(
          "https://api.groq.com/openai/v1",
          groqKey,
          model,
          prompt
        );
        const content = extractChatContent(r.data);
        if (r.ok && content) {
          return jsonResponse({ summary: content, model, provider: "groq" });
        }
        attempts.push({ provider: "groq", model, status: r.status, detail: r.raw });
      } catch (e) {
        attempts.push({ provider: "groq", model, detail: String((e && e.message) || e) });
      }
    }
  }

  // ── 3) OpenAI — آخرین تلاش (اغلب از IP کلودفلر 403 می‌شود) ──
  if (openaiKey) {
    try {
      const r = await callOpenAICompatible(
        "https://api.openai.com/v1",
        openaiKey,
        "gpt-4o-mini",
        prompt
      );
      const content = extractChatContent(r.data);
      if (r.ok && content) {
        return jsonResponse({ summary: content, model: "gpt-4o-mini", provider: "openai" });
      }
      attempts.push({ provider: "openai", model: "gpt-4o-mini", status: r.status, detail: r.raw });
    } catch (e) {
      attempts.push({ provider: "openai", detail: String((e && e.message) || e) });
    }
  }

  const hasAnyKey = !!(groqKey || openaiKey || env.AI);
  if (!hasAnyKey) {
    return jsonResponse({
      error: "no_api_key",
      detail: "هیچ سرویس AI فعالی نیست. wrangler secret put GROQ_API_KEY و wrangler deploy"
    }, 500);
  }

  // اگر فقط OpenAI 403 داده و Groq نیست
  const onlyOpenAIBlocked =
    !groqKey &&
    attempts.some((a) => a.provider === "openai" && (a.status === 403 || /unsupported|unsupported_country|blocked/i.test(String(a.detail || ""))));

  return jsonResponse({
    error: onlyOpenAIBlocked ? "openai_blocked" : "ai_request_failed",
    detail: attempts
      .map((a) => `${a.provider}${a.model ? "/" + a.model : ""}: ${a.status || ""} ${a.detail || ""}`)
      .join(" | ")
      .slice(0, 550)
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
