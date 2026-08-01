// Cloudflare Worker — بک‌اند همگام‌سازی «دخل و خرج»
// نیازمند یک KV Namespace با نام DNK_KV که به این Worker باند شده باشه.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
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
