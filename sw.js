const CACHE_NAME = "dakhl-o-kharj-v52";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./installments.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/watermark-nelin.png",
  "./sounds/coin.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API/sync calls - always go to network
  if (url.pathname.startsWith("/data") || url.hostname.includes("workers.dev")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

// ---------------------------------------------------------------------
// یادآوریِ پوشِ تب «اقساط» (پورت‌شده از سرویس‌ورکرِ اپِ یادآور اقساط)
// این تب یه ورکرِ Cloudflare جداگانه (aghsat2) داره که مستقل از ورکر اصلیِ
// «دخل و خرج» کرون یادآوری می‌فرسته؛ همین یه سرویس‌ورکر برای هر دو کافیه.
// ---------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = { title: "یادآوری قسط", body: "یه قسط نزدیکه سررسیدشه." };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    /* payload متنی ساده بود، از پیش‌فرض استفاده می‌شه */
  }

  const options = {
    body: data.body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    dir: "rtl",
    lang: "fa",
    data: { installmentId: data.installmentId || null },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
