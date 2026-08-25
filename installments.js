// ===========================================================================
// تب «اقساط» — پورت‌شده از اپِ مستقلِ «دفترچه اقساط» (یادآور اقساط)
// همه‌چیز داخل یه IIFE جداست که فقط به عنصرهای همین تب (#tab-installments) دست می‌زنه؛
// دیتا/سینکِ اقساط کاملاً مستقل از استوریج و ورکرِ اصلیِ «دخل و خرج»‌ه (خودش به
// ورکر پوشِ جداگانه‌ی aghsat2 وصل می‌شه) تا هیچ تداخلی با بقیه‌ی اپ نداشته باشه.
// ===========================================================================
(function () {
"use strict";

// تبدیل شمسی <-> میلادی (الگوریتم استاندارد jalaali-js / Borkowski) + کمکی‌های سررسید
// همون منطقِ نسخه‌ی قبلیِ db.py (پایتون)، پورت‌شده به جاوااسکریپت.

function div(a, b) { return Math.trunc(a / b); }
function mod(a, b) { return a - Math.trunc(a / b) * b; }

const breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

function jalCal(jy) {
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0];
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("Invalid Jalaali year " + jy);
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }

const JALALI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

function pad2(n) { return String(n).padStart(2, "0"); }
function dateToISO(gy, gm, gd) { return `${gy}-${pad2(gm)}-${pad2(gd)}`; }
function isoToParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { gy: y, gm: m, gd: d };
}

function isoDiffDays(isoA, isoB) {
  const a = isoToParts(isoA), b = isoToParts(isoB);
  const da = Date.UTC(a.gy, a.gm - 1, a.gd);
  const db_ = Date.UTC(b.gy, b.gm - 1, b.gd);
  return Math.round((da - db_) / 86400000);
}

function formatJalali(iso) {
  const { gy, gm, gd } = isoToParts(iso);
  const j = toJalaali(gy, gm, gd);
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
}

function parseJalaliDate(text) {
  const cleaned = String(text).trim().replace(/\//g, "-");
  const parts = cleaned.split("-");
  if (parts.length !== 3) throw new Error("invalid format");
  const [jy, jm, jd] = parts.map(Number);
  const g = toGregorian(jy, jm, jd);
  return dateToISO(g.gy, g.gm, g.gd);
}

// سررسیدِ همین ماه شمسی (بدون رول به ماه بعد) — برای نمایش
function thisMonthDueDate(dueType, dueValue, todayIso) {
  if (dueType === "once") return dueValue;
  const { gy, gm, gd } = isoToParts(todayIso);
  const todayJ = toJalaali(gy, gm, gd);
  const day = parseInt(dueValue, 10);
  const g = toGregorian(todayJ.jy, todayJ.jm, day);
  return dateToISO(g.gy, g.gm, g.gd);
}

// سررسیدِ بعدی (رول‌خورده به ماه بعد اگه گذشته باشه) — فقط برای زمان‌بندیِ یادآوری
function nextDueDate(dueType, dueValue, todayIso) {
  if (dueType === "once") return dueValue;
  const { gy, gm, gd } = isoToParts(todayIso);
  const todayJ = toJalaali(gy, gm, gd);
  const day = parseInt(dueValue, 10);
  let { jy, jm } = todayJ;
  let g = toGregorian(jy, jm, day);
  let candidateIso = dateToISO(g.gy, g.gm, g.gd);
  if (isoDiffDays(candidateIso, todayIso) < 0) {
    jm += 1;
    if (jm > 12) { jm = 1; jy += 1; }
    g = toGregorian(jy, jm, day);
    candidateIso = dateToISO(g.gy, g.gm, g.gd);
  }
  return candidateIso;
}

function currentJalaliMonthBounds(todayIso) {
  const { gy, gm, gd } = isoToParts(todayIso);
  const todayJ = toJalaali(gy, gm, gd);
  const start = toGregorian(todayJ.jy, todayJ.jm, 1);
  let ny = todayJ.jy, nm = todayJ.jm + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  const next = toGregorian(ny, nm, 1);
  return {
    monthStart: dateToISO(start.gy, start.gm, start.gd),
    nextMonthStart: dateToISO(next.gy, next.gm, next.gd),
  };
}

function currentJalaliMonthName(todayIso) {
  const { gy, gm, gd } = isoToParts(todayIso);
  const j = toJalaali(gy, gm, gd);
  return JALALI_MONTH_NAMES[j.jm - 1];
}

const Jalaali = {
  toJalaali, toGregorian, dateToISO, isoToParts, isoDiffDays,
  formatJalali, parseJalaliDate, thisMonthDueDate, nextDueDate,
  currentJalaliMonthBounds, currentJalaliMonthName, JALALI_MONTH_NAMES,
};

// دفترچه اقساط — نسخه‌ی Cloudflare (بدون بک‌اند Flask)
// همه‌ی منطق اقساط اینجا سمت کلاینت اجرا می‌شه؛ فقط پوش/همگام‌سازی با Worker حرف می‌زنه.

// ⚠️ بعد از دیپلوی Worker (مرحله‌ی ۲ راهنما)، این آدرس رو با آدرس واقعیِ خودت عوض کن:
const PUSH_WORKER_URL = "https://aghsat2.work-rezvanian.workers.dev".replace(/\/+$/, "");

const REMINDER_DAYS_BEFORE = 3;
const STORAGE_KEY = "installments_v1";

// ---------------------------------------------------------------------
// شناسه‌ی دستگاه (جایگزین ساده‌ی لاگین، مخصوص استفاده‌ی شخصی روی یه گوشی)
// ---------------------------------------------------------------------

function getDeviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    localStorage.setItem("device_id", id);
  }
  return id;
}

// ---------------------------------------------------------------------
// دیتای محلی (جایگزین دیتابیس/Flask قبلی)
// ---------------------------------------------------------------------

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// اگه توی داشبورد دخل‌وخرج ماه دیگه‌ای مرور می‌شه (متغیر سراسری viewedMonth)،
// فهرست و جمع اقساط هم همون ماه رو نشون بده؛ وگرنه امروز واقعی.
// توجه: این فقط روی نمایش لیست/جمع تأثیر می‌ذاره، نه روی محاسبات واقعیِ یادآوری/پوش سمت سرور.
function viewAnchorIso() {
  if (typeof viewedMonth === "undefined" || typeof todayJalali !== "function") return todayIso();
  try {
    const t = todayJalali();
    if (viewedMonth.jy === t.jy && viewedMonth.jm === t.jm) return todayIso();
    const g = toGregorian(viewedMonth.jy, viewedMonth.jm, 1);
    return dateToISO(g.gy, g.gm, g.gd);
  } catch (e) {
    return todayIso();
  }
}
function isViewingCurrentInstallmentMonth() {
  if (typeof viewedMonth === "undefined" || typeof todayJalali !== "function") return true;
  const t = todayJalali();
  return viewedMonth.jy === t.jy && viewedMonth.jm === t.jm;
}

function loadRaw() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveRaw(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

// معادل installment_to_dict قبلی
function toDict(row, today) {
  const due = Jalaali.thisMonthDueDate(row.due_type, row.due_value, today);
  const daysLeft = Jalaali.isoDiffDays(due, today);
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    due_type: row.due_type,
    due_value: row.due_value,
    due_jalali: Jalaali.formatJalali(due),
    due_key: due,
    days_left: daysLeft,
    is_paid: row.paid_due_date === due,
    is_overdue: daysLeft < 0 && row.paid_due_date !== due,
    paid_count: row.paid_count || 0,
    reminder_hour: row.reminder_hour ?? 9,
  };
}

function validateInput(data) {
  const title = (data.title || "").trim();
  const amount = String(data.amount || "").trim();
  const dueType = data.due_type;
  const rawDueValue = String(data.due_value || "").trim();

  if (!title || (dueType !== "once" && dueType !== "monthly") || !rawDueValue) {
    throw new Error("اطلاعات ناقصه");
  }

  let dueValue;
  if (dueType === "once") {
    try {
      dueValue = Jalaali.parseJalaliDate(rawDueValue);
    } catch (e) {
      throw new Error("تاریخ شمسی نامعتبره، به فرمت YYYY-MM-DD بنویس");
    }
  } else {
    const day = parseInt(rawDueValue, 10);
    if (!rawDueValue.match(/^\d+$/) || day < 1 || day > 29) {
      throw new Error("روز باید بین ۱ تا ۲۹ باشه");
    }
    dueValue = rawDueValue;
  }

  let paidCount = parseInt(data.paid_count, 10);
  if (Number.isNaN(paidCount) || paidCount < 0) paidCount = 0;

  let reminderHour = parseInt(data.reminder_hour, 10);
  if (Number.isNaN(reminderHour) || reminderHour < 0 || reminderHour > 23) reminderHour = 9;

  return { title, amount, due_type: dueType, due_value: dueValue, paid_count: paidCount, reminder_hour: reminderHour };
}

const store = {
  add(data) {
    const clean = validateInput(data);
    const rows = loadRaw();
    rows.push({
      id: newId(),
      ...clean,
      paid_due_date: null,
      last_notified: null,
      created_at: new Date().toISOString(),
    });
    saveRaw(rows);
  },

  update(id, data) {
    const clean = validateInput(data);
    const rows = loadRaw();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("قسط پیدا نشد");
    // چون سررسید ممکنه عوض شده باشه، وضعیت پرداخت/یادآوریِ قبلی رو ریست می‌کنیم
    rows[idx] = {
      ...rows[idx],
      ...clean,
      paid_due_date: null,
      last_notified: null,
    };
    saveRaw(rows);
  },

  remove(id) {
    const rows = loadRaw().filter((r) => r.id !== id);
    saveRaw(rows);
  },

  pay(id, dueKey) {
    const rows = loadRaw();
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error("قسط پیدا نشد");
    if (row.paid_due_date !== dueKey) {
      row.paid_count = (row.paid_count || 0) + 1;
    }
    row.paid_due_date = dueKey;
    saveRaw(rows);
    return row.paid_count;
  },

  list() {
    const today = viewAnchorIso();
    const { nextMonthStart } = Jalaali.currentJalaliMonthBounds(today);
    const items = [];
    for (const row of loadRaw()) {
      const item = toDict(row, today);
      let include;
      if (row.due_type === "monthly") {
        include = true; // سررسیدش همیشه همین ماهه (رول نمی‌خوره)
      } else {
        include = item.due_key < nextMonthStart; // همین ماه یا قبل‌تر، نه ماه‌های بعد
      }
      if (include) items.push(item);
    }
    items.sort((a, b) => (a.due_key < b.due_key ? -1 : a.due_key > b.due_key ? 1 : 0));
    return items;
  },

  monthlyTotal() {
    const today = viewAnchorIso();
    const { monthStart, nextMonthStart } = Jalaali.currentJalaliMonthBounds(today);
    const monthName = Jalaali.currentJalaliMonthName(today);

    let total = 0;
    let paidTotal = 0;
    const items = [];
    for (const row of loadRaw()) {
      let included;
      if (row.due_type === "monthly") {
        included = true;
      } else {
        included = row.due_value >= monthStart && row.due_value < nextMonthStart;
      }
      if (!included) continue;
      const amount = parseInt(row.amount, 10) || 0;
      total += amount;
      const item = toDict(row, today);
      if (item.is_paid) paidTotal += amount;
      items.push({ title: row.title, amount: row.amount });
    }
    return { month_name: monthName, total, paid_total: paidTotal, remaining_total: total - paidTotal, items };
  },
};

// ---------------------------------------------------------------------
// همگام‌سازی با Worker (فقط برای اینکه Cron بتونه یادآوری بفرسته)
// ---------------------------------------------------------------------

async function pushApi(path, options = {}) {
  const res = await fetch(`${PUSH_WORKER_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `خطای ${res.status}`);
  }
  return res.json();
}

async function syncToServer() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = registration ? await registration.pushManager.getSubscription() : null;
    await pushApi("/sync", {
      method: "POST",
      body: JSON.stringify({
        deviceId: getDeviceId(),
        subscription: sub ? sub.toJSON() : undefined,
        installments: loadRaw(),
      }),
    });
  } catch (e) {
    /* بی‌صدا؛ دفعه‌ی بعد که چیزی عوض بشه دوباره امتحان می‌شه */
  }
}

// ---------------------------------------------------------------------
// توست
// ---------------------------------------------------------------------

let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

// ---------------------------------------------------------------------
// رندر لیست
// ---------------------------------------------------------------------

let currentItems = [];

// Animated number counter for installments (English digit format)
function animateNumberInst(el, target, duration = 600) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/[^0-9]/g, "")) || 0;
  if (start === target) { el.textContent = formatAmount(String(target)); return; }
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = formatAmount(String(current));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function formatAmount(amount) {
  const n = parseInt(amount, 10);
  if (Number.isNaN(n)) return amount || "0";
  return n.toLocaleString("en-US");
}

function statusBadge(item) {
  if (item.is_paid) return "";
  if (!isViewingCurrentInstallmentMonth()) {
    return `<span class="badge badge-due">سررسید ${item.due_jalali}</span>`;
  }
  if (item.days_left < 0) return `<span class="badge badge-overdue">${Math.abs(item.days_left)} روز گذشته ⚠️</span>`;
  if (item.days_left === 0) return `<span class="badge badge-today">امروز 🔥</span>`;
  return `<span class="badge badge-due">${item.days_left} روز مانده</span>`;
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function toPersianDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
}
function toEnglishDigits(str) {
  return String(str)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}
function formatAmountValue(raw) {
  const digits = toEnglishDigits(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("en-US");
}

const fAmountInput = document.getElementById("fAmount");
fAmountInput.addEventListener("input", () => {
  fAmountInput.value = formatAmountValue(fAmountInput.value);
});

function dueDayLabel(item) {
  const day = parseInt(item.due_jalali.split("/")[2], 10);
  return `${toPersianDigits(day)} ام`;
}

const ORDINAL_UNITS = ["", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم"];
const ORDINAL_UNITS_COMPOUND = ["", "یکم", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم"];
const ORDINAL_TEENS = ["دهم", "یازدهم", "دوازدهم", "سیزدهم", "چهاردهم", "پانزدهم", "شانزدهم", "هفدهم", "هجدهم", "نوزدهم"];
const ORDINAL_TENS = ["", "", "بیستم", "سی‌ام", "چهلم", "پنجاهم", "شصتم", "هفتادم", "هشتادم", "نودم"];
const TENS_PREFIX = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];

function toPersianOrdinal(n) {
  if (!Number.isInteger(n) || n < 1) return "";
  if (n > 99) return `شماره ${toPersianDigits(n)}`;
  if (n <= 9) return ORDINAL_UNITS[n];
  if (n <= 19) return ORDINAL_TEENS[n - 10];
  if (n % 10 === 0) return ORDINAL_TENS[Math.floor(n / 10)];
  return `${TENS_PREFIX[Math.floor(n / 10)]} و ${ORDINAL_UNITS_COMPOUND[n % 10]}`;
}

function renderInstallments(items) {
  currentItems = items;

  const ledger = document.getElementById("ledger");
  const empty = document.getElementById("emptyState");
  ledger.innerHTML = "";

  if (!items.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "row";
    if (item.is_paid) row.classList.add("is-paid");
    else if (item.days_left < 0) row.classList.add("is-overdue");

    const typeLabel = item.due_type === "monthly" ? "🔁 ماهانه" : "📆 یک‌باره";

    row.innerHTML = `
      ${item.is_paid ? `<div class="stamp">پرداخت شد ✓</div>` : ""}
      <div class="row-main">
        <div class="row-title">${escapeHtml(item.title)}</div>
        <div class="row-meta">
          <span>${typeLabel}</span>
          <span>•</span>
          <span class="row-day">${dueDayLabel(item)}</span>
          ${statusBadge(item)}
        </div>
        ${item.is_paid && item.paid_count > 0 ? `<div class="row-paid-count">قسط ${toPersianOrdinal(item.paid_count)}</div>` : ""}
        <div class="row-amount">${formatAmount(item.amount)} تومان</div>
      </div>
      <div class="row-actions">
        ${!item.is_paid ? `<button class="icon-btn pay" title="ثبت پرداخت" data-action="pay" data-id="${item.id}" data-due="${item.due_key}">✓</button>` : ""}
        <button class="icon-btn edit" title="ویرایش" data-action="edit" data-id="${item.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></svg></button>
        <button class="icon-btn del" title="حذف" data-action="del" data-id="${item.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </div>
    `;
    ledger.appendChild(row);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadInstallments() {
  try {
    renderInstallments(store.list());
  } catch (e) {
    showToast("خطا در بارگذاری لیست: " + e.message);
  }
}

function loadMonthlyTotal() {
  try {
    const data = store.monthlyTotal();
    document.getElementById("summaryMonth").textContent = data.month_name;
    animateNumberInst(document.getElementById("summaryTotal"), data.total);
    animateNumberInst(document.getElementById("summaryPaid"), data.paid_total);
    animateNumberInst(document.getElementById("summaryRemaining"), data.remaining_total);
  } catch (e) {
    /* خطای غیرحیاتی، لیست اصلی همچنان کار می‌کنه */
  }
}

function refreshAll() {
  loadInstallments();
  loadMonthlyTotal();
}

// ---------------------------------------------------------------------
// اکشن‌های ردیف (پرداخت / ویرایش / حذف)
// ---------------------------------------------------------------------

document.getElementById("ledger").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === "pay") {
    try {
      const paidCount = store.pay(id, btn.dataset.due);
      // Find the installment details for the event
      const instItem = currentItems.find((i) => String(i.id) === String(id));
      const instAmount = instItem ? parseInt(instItem.amount, 10) || 0 : 0;
      const instTitle = instItem ? instItem.title : "قسط";
      // Dispatch event so script.js can add it as an expense
      window.dispatchEvent(new CustomEvent("installment-paid", {
        detail: { title: instTitle, amount: instAmount, dueKey: btn.dataset.due }
      }));
      showToast(`پرداخت ثبت شد ✅ — قسط شماره ${paidCount}`);
      refreshAll();
      syncToServer();
    } catch (err) {
      showToast("خطا: " + err.message);
    }
  }

  if (btn.dataset.action === "edit") {
    const item = currentItems.find((i) => String(i.id) === String(id));
    if (item) openEditSheet(item);
  }

  if (btn.dataset.action === "del") {
    if (!confirm("این قسط حذف بشه؟")) return;
    try {
      store.remove(id);
      showToast("حذف شد 🗑");
      refreshAll();
      syncToServer();
    } catch (err) {
      showToast("خطا: " + err.message);
    }
  }
});

// ---------------------------------------------------------------------
// شیت افزودن/ویرایش قسط
// ---------------------------------------------------------------------

const sheetOverlay = document.getElementById("sheetOverlay");
const addForm = document.getElementById("addForm");
let currentType = "monthly";
let editingId = null;

function setCustomCountVisible(visible) {
  document.getElementById("fCustomCount").checked = visible;
  document.getElementById("paidCountField").hidden = !visible;
}

function setCustomHourVisible(visible) {
  document.getElementById("fCustomHour").checked = visible;
  document.getElementById("reminderHourField").hidden = !visible;
}

function openAddSheet() {
  addForm.reset();
  editingId = null;
  document.getElementById("sheetTitle").textContent = "قسط جدید";
  document.getElementById("submitBtn").textContent = "ثبت قسط";
  currentType = "monthly";
  setType("monthly");
  document.getElementById("fPaidCount").value = 0;
  setCustomCountVisible(false);
  document.getElementById("fReminderHour").value = 9;
  setCustomHourVisible(false);
  document.getElementById("formError").hidden = true;
  sheetOverlay.hidden = false;
}

function openEditSheet(item) {
  addForm.reset();
  editingId = item.id;
  document.getElementById("sheetTitle").textContent = "ویرایش قسط";
  document.getElementById("submitBtn").textContent = "ذخیره تغییرات";

  document.getElementById("fTitle").value = item.title;
  document.getElementById("fAmount").value = formatAmountValue(item.amount);
  setType(item.due_type);

  if (item.due_type === "monthly") {
    document.getElementById("fDueDay").value = item.due_value;
  } else {
    document.getElementById("fDueDate").value = item.due_jalali.replace(/\//g, "-");
  }

  document.getElementById("fPaidCount").value = item.paid_count || 0;
  setCustomCountVisible(!!item.paid_count);

  document.getElementById("fReminderHour").value = item.reminder_hour ?? 9;
  setCustomHourVisible(item.reminder_hour !== undefined && item.reminder_hour !== 9);

  document.getElementById("formError").hidden = true;
  sheetOverlay.hidden = false;
}

function closeSheet() {
  sheetOverlay.hidden = true;
  editingId = null;
}

document.getElementById("fab").addEventListener("click", openAddSheet);
document.getElementById("cancelBtn").addEventListener("click", closeSheet);

sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

function setType(type) {
  currentType = type;
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === type);
  });
  document.getElementById("monthlyField").hidden = type !== "monthly";
  document.getElementById("onceField").hidden = type !== "once";
  document.getElementById("fDueDay").required = type === "monthly";
  document.getElementById("fDueDate").required = type === "once";
}

document.getElementById("typeSegment").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) setType(btn.dataset.type);
});

document.getElementById("fCustomCount").addEventListener("change", (e) => {
  document.getElementById("paidCountField").hidden = !e.target.checked;
});

document.getElementById("fCustomHour").addEventListener("change", (e) => {
  document.getElementById("reminderHourField").hidden = !e.target.checked;
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const errEl = document.getElementById("formError");
  errEl.hidden = true;

  const title = document.getElementById("fTitle").value.trim();
  const amount = toEnglishDigits(document.getElementById("fAmount").value).replace(/[^\d]/g, "");
  const dueValue =
    currentType === "monthly"
      ? document.getElementById("fDueDay").value.trim()
      : document.getElementById("fDueDate").value.trim();
  const paidCount = document.getElementById("fCustomCount").checked
    ? (parseInt(document.getElementById("fPaidCount").value.trim(), 10) || 0)
    : 0;
  const reminderHour = document.getElementById("fCustomHour").checked
    ? (parseInt(document.getElementById("fReminderHour").value.trim(), 10) || 9)
    : 9;

  try {
    const payload = { title, amount, due_type: currentType, due_value: dueValue, paid_count: paidCount, reminder_hour: reminderHour };
    if (editingId) {
      store.update(editingId, payload);
      showToast("قسط ویرایش شد ✅");
    } else {
      store.add(payload);
      showToast("قسط ثبت شد ✅");
    }
    closeSheet();
    refreshAll();
    syncToServer();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

// ---------------------------------------------------------------------
// نصب و نوتیفیکیشن Push
// ---------------------------------------------------------------------

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function fetchVapidKey() {
  const res = await fetch(`${PUSH_WORKER_URL}/vapid-public-key`);
  if (!res.ok) throw new Error(`خطای ${res.status}`);
  return res.text();
}

async function setupNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return; // مرورگر پشتیبانی نمی‌کنه (نسخه‌های قدیمی iOS)
  }

  if (!isStandalone()) {
    return; // فقط وقتی اپ به هوم‌اسکرین اضافه شده باشه، یادآوری پوش پیشنهاد داده می‌شه
  }

  // این تب از سرویس‌ورکر اصلیِ «دخل و خرج» (sw.js) استفاده می‌کنه که از قبل توسط
  // اسکریپت اصلی ثبت شده؛ رویدادهای push/notificationclick هم به همون فایل اضافه شدن.
  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    // هر بار اپ باز می‌شه دوباره sync می‌کنیم (هم subscription هم لیست اقساط)
    syncToServer();
    return;
  }

  if (Notification.permission === "denied") return;
  if (localStorage.getItem("notify_asked")) return;

  document.addEventListener(
    "click",
    () => requestNotificationPermission(registration),
    { once: true }
  );
}

async function requestNotificationPermission(registration) {
  localStorage.setItem("notify_asked", "1");
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    await subscribeAndSend(registration);
    showToast("یادآوری فعال شد ✅");
  } catch (err) {
    showToast("خطا در فعال‌سازی یادآوری: " + err.message);
  }
}

async function subscribeAndSend(registration) {
  const key = await fetchVapidKey();
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  await syncToServer();
  return sub;
}

async function reactivatePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("این مرورگر پشتیبانی نمی‌کنه");
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("اجازه‌ی نوتیفیکیشن داده نشد");
        return;
      }
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    await subscribeAndSend(registration);
    localStorage.setItem("notify_asked", "1");
    showToast("نوتیفیکیشن دوباره فعال شد ✅ — حالا یه‌بار «تست یادآوری» رو بزن");
  } catch (err) {
    showToast("خطا در فعال‌سازی مجدد: " + err.message);
  }
}

document.getElementById("testPushBtn").addEventListener("click", async () => {
  try {
    const result = await pushApi("/test", {
      method: "POST",
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    if (result.ok) {
      showToast("پوش آزمایشی فرستاده شد ✅ — چند ثانیه صبر کن");
    } else {
      showToast("subscription منقضی شده ❌ — «فعال‌سازی مجدد نوتیفیکیشن» رو بزن");
    }
  } catch (err) {
    if (err.message.includes("no subscription")) {
      showToast("subscriptionی ثبت نشده ❌ — «فعال‌سازی مجدد نوتیفیکیشن» رو بزن");
    } else {
      showToast("خطا: " + err.message);
    }
  }
});

document.getElementById("reactivatePushBtn").addEventListener("click", reactivatePush);

// ---------------------------------------------------------------------
// شروع
// ---------------------------------------------------------------------

function seedTestInstallments() {
  const SEED_FLAG = "installments_test_seed_v2";
  if (localStorage.getItem(SEED_FLAG)) return;
  const now = new Date();
  const jToday = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const todayStr = `${jToday.jy}-${String(jToday.jm).padStart(2, "0")}-${String(jToday.jd).padStart(2, "0")}`;

  let hours = [];
  for (let h = now.getHours() + 1; h <= 21; h += 1) hours.push(h);
  if (hours.length === 0) {
    // بعد از ۹ شبه؛ چندتا ساعت تستی از همین الان به بعد اضافه می‌کنیم (بدون محدودیت ۲۱)
    for (let i = 1; i <= 4; i += 1) hours.push((now.getHours() + i) % 24);
  }

  hours.forEach((h, idx) => {
    try {
      store.add({
        title: `تست یادآوری ساعت ${String(h).padStart(2, "0")}:۰۰`,
        amount: String(100000 * (idx + 1)),
        due_type: "once",
        due_value: todayStr,
        paid_count: 0,
        reminder_hour: h,
      });
    } catch (e) {
      /* نادیده گرفتن خطای احتمالی برای این ردیف تستی */
    }
  });
  localStorage.setItem(SEED_FLAG, "1");
}
seedTestInstallments();

refreshAll();
setupNotifications();

// Expose refreshAll for tab-switch animation (called from script.js)
window.refreshInstallments = refreshAll;
window.resetInstallmentNumbers = function() {
  const totalEl = document.getElementById("summaryTotal");
  const paidEl = document.getElementById("summaryPaid");
  const remainingEl = document.getElementById("summaryRemaining");
  if (totalEl) totalEl.textContent = "0";
  if (paidEl) paidEl.textContent = "0";
  if (remainingEl) remainingEl.textContent = "0";
};

// Expose store for installment payment bridge
window.getInstallmentById = function(id) {
  return currentItems.find((i) => String(i.id) === String(id));
};

})();
