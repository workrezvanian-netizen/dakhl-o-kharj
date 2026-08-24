// Cloudflare Worker — بک‌اند همگام‌سازی «دخل و خرج»
// نیازمند یک KV Namespace با نام DNK_KV که به این Worker باند شده باشه.
// تحلیل هوش مصنوعی با Groq API کار می‌کنه (رایگان، بدون کارت بانکی، سازگار با فرمت OpenAI).
// باید یک Secret به اسم GROQ_API_KEY به این Worker اضافه بشه:
//   wrangler secret put GROQ_API_KEY
// کلید API رو از https://console.groq.com/keys می‌تونی رایگان بسازی.

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

  return `تو یک دستیار مالی شخصی، بامزه و خودمونی هستی که فارسی محاوره‌ای صحبت می‌کنه (نه رسمی).
بر اساس اطلاعات زیر، یک تحلیل کوتاه (حداکثر ۵-۶ جمله) از وضعیت مالی «این ماه» کاربر بنویس.

قوانین:
- لحن باحال، دوستانه و کمی طنز داشته باش؛ از ۲-۳ ایموجی مناسب استفاده کن.
- توهین‌آمیز یا سرزنش‌گر نباش، فقط بامزه و همدلانه.
- حتماً این ماه رو با ماه قبل مقایسه کن (بیشتر خرج کرده یا کمتر، درآمدش چطور بوده).
- به دسته‌ای که بیشترین خرج توش بوده اشاره کن.
- در پایان یک جمله‌ی کوتاه انگیزشی یا نکته‌ی طنزآمیز درباره‌ی ماه بعد بگو.
- فقط متن تحلیل رو بنویس، بدون مقدمه یا عنوان اضافه. حتماً فقط به فارسی بنویس.

اطلاعات این ماه:
- درآمد: ${fmtToman(tm.totalIncome)}
- مخارج: ${fmtToman(tm.totalExpense)}
- مانده: ${fmtToman((tm.totalIncome || 0) - (tm.totalExpense || 0))}
- ریز مخارج بر اساس دسته: ${topCats || "ثبت نشده"}

اطلاعات ماه قبل:
- درآمد: ${fmtToman(lm.totalIncome)}
- مخارج: ${fmtToman(lm.totalExpense)}`;
}

async function handleAnalyze(request, env) {
  if (!env.GROQ_API_KEY) {
    return jsonResponse({ error: "no_groq_key" }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const prompt = buildAnalysisPrompt(body);
  const GROQ_MODEL = "openai/gpt-oss-120b";

  let aiRes;
  try {
    aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      })
    });
  } catch (e) {
    return jsonResponse({ error: "ai_request_failed", detail: String((e && e.message) || e) }, 502);
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => "");
    return jsonResponse({ error: "ai_request_failed", detail: errText.slice(0, 300) }, 502);
  }

  const data = await aiRes.json().catch(() => null);
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || "").trim()
    : "";

  if (!text) {
    return jsonResponse({ error: "empty_response" }, 502);
  }

  return jsonResponse({ summary: text });
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


