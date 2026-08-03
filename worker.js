// Cloudflare Worker — بک‌اند همگام‌سازی «دخل و خرج»
// نیازمند یک KV Namespace با نام DNK_KV که به این Worker باند شده باشه.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function fmtToman(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}

function buildAnalysisPrompt(body) {
  const cur = body.thisMonth || {};
  const prev = body.lastMonth || {};
  const monthName = body.monthName || "این ماه";
  const prevMonthName = body.prevMonthName || "ماه قبل";

  const catLines = Object.entries(cur.byCategory || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amt]) => `- ${name}: ${fmtToman(amt)} تومان`)
    .join("\n") || "- ثبت نشده";

  const sourceLines = Object.entries(cur.bySource || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => `- ${name}: ${fmtToman(amt)} تومان`)
    .join("\n") || "- ثبت نشده";

  return `
دیتای ${monthName}:
- درآمد کل: ${fmtToman(cur.income)} تومان
- مخارج کل: ${fmtToman(cur.expense)} تومان
- مانده: ${fmtToman(cur.balance)} تومان
- بزرگ‌ترین دسته‌های خرج:
${catLines}
- منابع درآمد:
${sourceLines}

دیتای ${prevMonthName} (برای مقایسه):
- درآمد کل: ${fmtToman(prev.income)} تومان
- مخارج کل: ${fmtToman(prev.expense)} تومان
- مانده: ${fmtToman(prev.balance)} تومان

یه خلاصه‌ی کوتاه (حداکثر ۵-۶ جمله) بنویس که:
۱. وضعیت کلیِ ${monthName} رو در یکی-دو جمله بگه
۲. دخل و خرج رو با ${prevMonthName} مقایسه کنه (بیشتر شده یا کمتر؟ چقدر؟)
۳. به بزرگ‌ترین دسته‌ی خرج اشاره کنه
۴. اگه مانده مثبت بود تشویق کن، اگه منفی بود بدون سرزنش و محترمانه هشدار بده
۵. یه لحن گرم، صمیمی و کمی بامزه داشته باش با یکی-دو ایموجیِ مناسب
`.trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/analyze" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid json" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const prompt = buildAnalysisPrompt(body);
      try {
        const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
          messages: [
            {
              role: "system",
              content:
                "تو یه دستیار مالیِ فارسی‌زبان، صمیمی و کمی بامزه‌ای که خلاصه‌ی ماهانه‌ی دخل‌وخرج کاربر رو می‌نویسی. " +
                "لحنت گرم و دوستانه‌ست، نه رسمی و خشک. از طنز ملایم و ایموجیِ مناسب استفاده کن، ولی سرزنش‌کننده نباش. " +
                "فقط و فقط متنِ فارسیِ خلاصه رو بنویس؛ بدون مقدمه، بدون عنوان، بدون به‌کاربردن انگلیسی."
            },
            { role: "user", content: prompt }
          ]
        });
        return new Response(JSON.stringify({ text: result.response || "" }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "AI request failed" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname !== "/data") {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    const code = url.searchParams.get("code");
    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "invalid code" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const key = `data:${code}`;

    if (request.method === "GET") {
      const stored = await env.DNK_KV.get(key);
      if (!stored) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
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
        return new Response(JSON.stringify({ error: "invalid json" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
      body.updatedAt = Date.now();
      await env.DNK_KV.put(key, JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }
};
