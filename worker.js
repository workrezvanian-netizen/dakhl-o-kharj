// Cloudflare Worker — بک‌اند «دخل و خرج»
// تحلیل هوشمند: ChatGPT (OpenAI) — مسیر اصلی
//
// الزامی:
//   wrangler secret put OPENAI_API_KEY
//   wrangler deploy
//
// کلید: https://platform.openai.com/api-keys

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

function extractContent(data) {
  if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) return "";
  return String(data.choices[0].message.content || "").trim();
}

async function callOpenAI(apiKey, model, prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      max_tokens: 800
    })
  });
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: res.ok, status: res.status, data, raw: text.slice(0, 400) };
}

async function handleAnalyze(request, env) {
  const openaiKey = env.OPENAI_API_KEY;
  if (!openaiKey) {
    return jsonResponse({
      error: "no_api_key",
      detail: "OPENAI_API_KEY تنظیم نشده. دستور: wrangler secret put OPENAI_API_KEY"
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const prompt = buildAnalysisPrompt(body);
  // مدل‌های ChatGPT — از ارزان/سریع به قوی‌تر
  const models = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];
  const attempts = [];

  for (const model of models) {
    try {
      const r = await callOpenAI(openaiKey, model, prompt);
      const content = extractContent(r.data);
      if (r.ok && content) {
        return jsonResponse({ summary: content, model, provider: "openai" });
      }
      // اگر مدل وجود نداشت (404) مدل بعدی را امتحان کن
      attempts.push({ model, status: r.status, detail: r.raw });
      if (r.status === 401 || r.status === 403) {
        // کلید نامعتبر — ادامه‌ندادن
        break;
      }
    } catch (e) {
      attempts.push({ model, detail: String((e && e.message) || e) });
    }
  }

  return jsonResponse({
    error: "ai_request_failed",
    detail: attempts.map((a) => `${a.model}: ${a.status || ""} ${a.detail || ""}`).join(" | ").slice(0, 500)
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
