// Cloudflare Worker — بک‌اند «دخل و خرج»
// تحلیل: Workers AI داخلی (بدون کلید خارجی)
// مسیر اصلی توصیه شده در اپ: کلید کاربر روی دستگاه (تنظیمات)

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
  return `تو یک مشاور مالی خودمونی برای اپ «دخل و خرج» هستی.
۴ تا ۷ جمله فارسی، دوستانه، با یک نکته عملی برای ماه بعد. بدون مقدمه.

این ماه: درآمد ${fmtToman(tm.totalIncome)}، مخارج ${fmtToman(tm.totalExpense)}، مانده ${fmtToman((tm.totalIncome || 0) - (tm.totalExpense || 0))}
دسته‌ها: ${topCats || "ثبت نشده"}
ماه قبل: درآمد ${fmtToman(lm.totalIncome)}، مخارج ${fmtToman(lm.totalExpense)}`;
}

function extractContent(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (data.response) return String(data.response).trim();
  if (data.result) return String(data.result).trim();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return String(data.choices[0].message.content || "").trim();
  }
  return "";
}

async function handleAnalyze(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ error: "invalid json" }, 400);
  }
  const prompt = buildAnalysisPrompt(body);

  if (!env.AI) {
    return jsonResponse({
      error: "no_api_key",
      detail: "Workers AI فعال نیست. در اپ از تنظیمات کلید Groq را روی دستگاه ذخیره کن."
    }, 500);
  }

  const models = [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/meta/llama-3.2-3b-instruct",
    "@cf/qwen/qwen1.5-7b-chat-awq"
  ];
  const attempts = [];
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "Reply in Persian only. Be concise." },
          { role: "user", content: prompt }
        ],
        max_tokens: 700,
        temperature: 0.7
      });
      const text = extractContent(result);
      if (text) return jsonResponse({ summary: text, model, provider: "cloudflare-ai" });
      attempts.push(model + ":empty");
    } catch (e) {
      attempts.push(model + ":" + String((e && e.message) || e).slice(0, 80));
    }
  }
  return jsonResponse({
    error: "ai_request_failed",
    detail: "Workers AI failed. " + attempts.join(" | ") + " — در اپ کلید Groq را در تنظیمات ذخیره کن."
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
      if (!stored) return jsonResponse({ error: "not found" }, 404);
      return new Response(stored, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch (e) {
        return jsonResponse({ error: "invalid json" }, 400);
      }
      body.updatedAt = Date.now();
      await env.DNK_KV.put(key, JSON.stringify(body));
      return jsonResponse({ ok: true });
    }
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }
};
