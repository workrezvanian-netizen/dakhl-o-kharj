// =========================================================
// تنظیمات
// =========================================================
const CONFIG = {
  WORKER_URL: "https://dakhl-o-kharj.work-rezvanian.workers.dev"
};

const STORAGE_KEY = "dnk_data_v1";
const ICON_CDN_VERSION = "0.400.0";
function iconUrl(key) {
  return `https://cdn.jsdelivr.net/npm/lucide-static@${ICON_CDN_VERSION}/icons/${key}.svg`;
}
function iconSpanHTML(key, extraStyle) {
  return `<span class="icon-mask" style="--icon-url:url('${iconUrl(key)}');${extraStyle || ""}"></span>`;
}

const ICON_CHOICES = [
  "utensils", "car", "receipt", "shopping-bag", "film", "stethoscope",
  "home", "book-open", "gift", "plane", "coffee", "zap",
  "smartphone", "dog", "shirt", "spray-can", "gamepad-2", "baby",
  "wallet", "dumbbell", "brush", "graduation-cap", "heart-pulse", "package",
  "credit-card"
];
const DEFAULT_CATEGORIES = [
  { name: "خوراک", icon: "utensils" },
  { name: "حمل‌ونقل", icon: "car" },
  { name: "قبض‌ها", icon: "receipt" },
  { name: "خرید", icon: "shopping-bag" },
  { name: "تفریح", icon: "film" },
  { name: "درمان", icon: "stethoscope" },
  { name: "اقساط", icon: "credit-card" },
  { name: "سایر", icon: "package" }
];
const DEFAULT_ICON_MAP = { "خوراک": "utensils", "حمل‌ونقل": "car", "قبض‌ها": "receipt", "خرید": "shopping-bag", "تفریح": "film", "درمان": "stethoscope", "اقساط": "credit-card", "سایر": "package" };
const INCOME_SOURCE_ICON = { "حقوق": "briefcase", "پاداش": "award", "فروش": "tag", "هدیه": "gift", "سایر": "wallet" };
const CATEGORY_COLORS = [
  "#FF5252", "#FF9100", "#FFC400", "#4CAF50",
  "#00BCD4", "#5C6BC0", "#AB47BC", "#EC407A"
];
const CATEGORY_COLOR_CHOICES = [
  "#FF6B6B", "#FF922B", "#FFA94D", "#FFD43B", "#94D82D", "#69DB7C", "#20C997",
  "#22B8CF", "#4DABF7", "#4C6EF5", "#7950F2", "#9775FA", "#DA77F2", "#F783AC",
  "#495057", "#868E96"
];
const CARD_PALETTE = [
  { bg: "#FDDCAE", icon: "#D48806" },
  { bg: "#BADAFF", icon: "#1D6ABF" },
  { bg: "#FDCCA8", icon: "#D2611B" },
  { bg: "#DCC8F5", icon: "#7B3FC2" },
  { bg: "#FDC4CC", icon: "#C42D3D" },
  { bg: "#B8E8E0", icon: "#2A8C7A" },
  { bg: "#C5E0B4", icon: "#4A7A2F" },
  { bg: "#C8C8E2", icon: "#4A4EA0" }
];
const INCOME_CARD_PALETTE = [
  { bg: "#E3F1EF", icon: "#2F7A72" },
  { bg: "#E7F5EF", icon: "#3C8C82" },
  { bg: "#E3F1DE", icon: "#6B8E5A" },
  { bg: "#FBF2D8", icon: "#C9A227" },
  { bg: "#E4EEF6", icon: "#5B7CB0" }
];
const INCOME_SOURCES = ["حقوق", "پاداش", "فروش", "هدیه", "سایر"];

let state = loadState();
let selectedExpenseCategoryName = null;
let selectedNewCategoryIcon = ICON_CHOICES[0];
let selectedNewCategoryColor = CATEGORY_COLOR_CHOICES[0];
let expenseListFilter = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let categories = parsed.categories;
      if (!categories || !categories.length) {
        categories = DEFAULT_CATEGORIES.slice();
      } else if (typeof categories[0] === "string") {
        categories = categories.map((name) => ({ name, icon: DEFAULT_ICON_MAP[name] || "package" }));
      } else if (categories[0] && !categories[0].icon) {
        // migrate from older emoji-based structure
        categories = categories.map((c) => ({ name: c.name, icon: DEFAULT_ICON_MAP[c.name] || "package" }));
      }
      return {
        incomes: parsed.incomes || [],
        expenses: parsed.expenses || [],
        installments: parsed.installments || [],
        categories,
        budget: parsed.budget || { total: 0, categories: {} }, todo: parsed.todo || null,
        syncCode: parsed.syncCode || null,
        profile: parsed.profile || { name: null, avatar: null },
        updatedAt: parsed.updatedAt || Date.now()
      };
    }
  } catch (e) { /* ignore corrupt state */ }
  return { incomes: [], expenses: [], installments: [], categories: DEFAULT_CATEGORIES.slice(), budget: { total: 0, categories: {} }, todo: null, syncCode: null, profile: { name: null, avatar: null }, updatedAt: Date.now() };
}

function saveState({ sync = true } = {}) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if (sync && state.syncCode) scheduleSync();
}

// =========================================================
// Jalali (Persian) calendar conversion — jalaali algorithm
// =========================================================
function jdiv(a, b) { return ~~(a / b); }
function jmod(a, b) { return a - ~~(a / b) * b; }

const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy) {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jump = 0;
  let jm;
  for (let i = 1; i < bl; i += 1) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4);
  if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + jdiv(jump, 33) * 33;
  let leap = jmod(jmod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = jdiv(jmod(j, 1461), 4) * 5 + 308;
  const gd = jdiv(jmod(i, 153), 5) + 1;
  const gm = jmod(jdiv(i, 153), 12) + 1;
  const gy = jdiv(j, 1461) - 100100 + jdiv(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm;
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + jdiv(k, 31);
      jd = jmod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + jdiv(k, 30);
  jd = jmod(k, 30) + 1;
  return { jy, jm, jd };
}

function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
function isLeapJalaliYear(jy) { return jalCal(jy).leap === 1; }
function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function todayJalali() {
  const now = new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addMonthsJalali(jy, jm, delta) {
  let total = (jy * 12 + (jm - 1)) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return { jy: ny, jm: nm };
}
function calendarDayOfWeekIndex(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  const jsDay = new Date(g.gy, g.gm - 1, g.gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7; // 0=Sat..6=Fri, matches Persian week order
}

// =========================================================
// Digit / number helpers
// =========================================================
function toPersianDigits(str) {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (d) => fa[d]);
}
function normalizeDigits(str) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return String(str)
    .replace(/[۰-۹]/g, (d) => persian.indexOf(d))
    .replace(/[٠-٩]/g, (d) => arabic.indexOf(d));
}
function fmtAmount(n) {
  const sign = n < 0 ? "−" : "";
  const rounded = Math.round(Math.abs(n));
  const grouped = rounded.toLocaleString("en-US");
  return sign + toPersianDigits(grouped).replace(/,/g, "٬");
}

// Animated number counter with sign prefix (for balance display)
function animateNumberWithSign(el, target, duration = 800, sign = "") {
  if (!el) return;
  const absTarget = Math.abs(target);
  const unitEl = el.querySelector(".month-balance-unit");
  const unitText = unitEl ? unitEl.textContent : "تومان";
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(absTarget * ease);
    el.innerHTML = `${sign}${fmtAmount(current)} <span class="month-balance-unit">${unitText}</span>`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Animated number counter — smoothly counts from current value to target
function animateNumber(el, target, duration = 600) {
  if (!el) return;
  // Use normalizeDigits to correctly parse Persian/Arabic digits
  const startText = normalizeDigits(el.textContent.replace(/[^0-9−۰-۹٠-٩]/g, "")).replace(/−/g, "-");
  const start = parseInt(startText) || 0;
  if (start === target) { el.textContent = fmtAmount(target); return; }
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = fmtAmount(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function fmtCompactEn(n) {
  const sign = n > 0 ? "+" : (n < 0 ? "-" : "");
  const abs = Math.abs(n);
  let out;
  if (abs >= 1000000) {
    const v = abs / 1000000;
    out = (Number.isInteger(v) ? v : Math.round(v * 10) / 10) + "M";
  } else if (abs >= 1000) {
    const v = abs / 1000;
    out = (Number.isInteger(v) ? v : Math.round(v * 10) / 10) + "k";
  } else if (abs > 0) {
    out = String(Math.round(abs));
  } else {
    return "";
  }
  return sign + out;
}

// =========================================================
// Amount input live formatting
// =========================================================
function attachAmountFormatting(input) {
  input.addEventListener("input", () => {
    const digitsOnly = normalizeDigits(input.value).replace(/[^\d]/g, "");
    input.value = digitsOnly ? Number(digitsOnly).toLocaleString("en-US") : "";
  });
}
function getAmountValue(input) {
  const digitsOnly = normalizeDigits(input.value).replace(/[^\d]/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}
attachAmountFormatting(document.getElementById("incomeAmount"));
attachAmountFormatting(document.getElementById("expenseAmount"));

// =========================================================
// Jalali date pickers
// =========================================================
function populateDateSelects(prefix, jy, jm, jd) {
  const daySel = document.getElementById(prefix + "Day");
  const monthSel = document.getElementById(prefix + "Month");
  const yearSel = document.getElementById(prefix + "Year");

  monthSel.innerHTML = JALALI_MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  monthSel.value = jm;

  const curYear = todayJalali().jy;
  const years = [];
  for (let y = curYear - 8; y <= curYear + 1; y++) years.push(y);
  yearSel.innerHTML = years.map((y) => `<option value="${y}">${toPersianDigits(y)}</option>`).join("");
  yearSel.value = jy;

  fillDayOptions(jd);

  function fillDayOptions(selectedDay) {
    const len = jalaaliMonthLength(Number(yearSel.value), Number(monthSel.value));
    const days = [];
    for (let d = 1; d <= len; d++) days.push(d);
    daySel.innerHTML = days.map((d) => `<option value="${d}">${toPersianDigits(d)}</option>`).join("");
    daySel.value = Math.min(selectedDay, len);
  }

  monthSel.addEventListener("change", () => fillDayOptions(Number(daySel.value) || 1));
  yearSel.addEventListener("change", () => fillDayOptions(Number(daySel.value) || 1));
}

function setDatePickerToToday(prefix) {
  const j = todayJalali();
  populateDateSelects(prefix, j.jy, j.jm, j.jd);
}

function getISOFromDatePicker(prefix) {
  const jy = Number(document.getElementById(prefix + "Year").value);
  const jm = Number(document.getElementById(prefix + "Month").value);
  const jd = Number(document.getElementById(prefix + "Day").value);
  const g = toGregorian(jy, jm, jd);
  const mm = String(g.gm).padStart(2, "0");
  const dd = String(g.gd).padStart(2, "0");
  return `${g.gy}-${mm}-${dd}`;
}

function formatDateFa(iso) {
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = toJalaali(gy, gm, gd);
  return `${toPersianDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;
}

setDatePickerToToday("income");
setDatePickerToToday("expense");

// ---------- Quick date picker (امروز / دیروز / تاریخ دلخواه) ----------
const dateQuickMode = { income: "today", expense: "today" };

function isoFromDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function isoToday() { return isoFromDate(new Date()); }
function isoYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoFromDate(d);
}

function getSelectedISO(prefix) {
  const mode = dateQuickMode[prefix];
  if (mode === "today") return isoToday();
  if (mode === "yesterday") return isoYesterday();
  return getISOFromDatePicker(prefix);
}

function setupDateQuickPicker(prefix) {
  const group = document.getElementById(prefix + "DateQuick");
  const customWrap = document.getElementById(prefix + "CustomDate");
  group.querySelectorAll(".date-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".date-quick-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      dateQuickMode[prefix] = btn.dataset.value;
      customWrap.style.display = btn.dataset.value === "custom" ? "grid" : "none";
    });
  });
}
function resetDateQuickPicker(prefix) {
  dateQuickMode[prefix] = "today";
  const group = document.getElementById(prefix + "DateQuick");
  group.querySelectorAll(".date-quick-btn").forEach((b) => b.classList.toggle("selected", b.dataset.value === "today"));
  document.getElementById(prefix + "CustomDate").style.display = "none";
}
setupDateQuickPicker("income");
setupDateQuickPicker("expense");

// ---------- Helpers ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function catColor(name) {
  const cat = state.categories.find((c) => c.name === name);
  if (cat && cat.color) return cat.color;
  const idx = state.categories.findIndex((c) => c.name === name);
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length];
}
function catIcon(name) {
  const cat = state.categories.find((c) => c.name === name);
  return cat ? cat.icon : "package";
}

function applyStaticIcons() {
  document.querySelectorAll(".icon-mask[data-icon]").forEach((el) => {
    el.style.setProperty("--icon-url", `url('${iconUrl(el.dataset.icon)}')`);
  });
}
applyStaticIcons();

// ---------- Welcome screen (FLIP intro animation) ----------
function flipMove(fromEl, toEl, durationMs) {
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const scaleX = toRect.width / fromRect.width;
  const scaleY = toRect.height / fromRect.height;
  const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
  const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
  fromEl.style.transformOrigin = "center center";
  fromEl.style.transition = `transform ${durationMs}ms cubic-bezier(.4,0,.2,1)`;
  requestAnimationFrame(() => {
    fromEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function completeWelcomeIntro() {
  const overlay = document.getElementById("welcomeScreen");
  const DURATION = 650;
  const greeting = document.getElementById("welcomeGreeting");
  greeting.style.transition = "opacity .3s ease";
  greeting.style.opacity = "0";
  const lockArea = document.getElementById("welcomeLockArea");
  if (lockArea && lockArea.style.display !== "none") {
    lockArea.style.transition = "opacity .3s ease";
    lockArea.style.opacity = "0";
  }

  flipMove(document.getElementById("welcomeWatermark"), document.getElementById("headerWatermark"), DURATION);
  flipMove(document.getElementById("welcomeIconImg"), document.getElementById("headerBrandBadge"), DURATION);
  flipMove(document.getElementById("welcomeBrandText"), document.querySelector("#headerBrand .brand-text"), DURATION);
  document.getElementById("welcomeBg").style.opacity = "0";

  setTimeout(() => {
    overlay.style.display = "none";
    if (!isStandalone()) {
      document.getElementById("installGuide").hidden = false;
    }
  }, DURATION + 50);
}

function showWelcomeLockForm() {
  const greeting = document.getElementById("welcomeGreeting");
  greeting.textContent = "برنامه قفل‌شده است";
  const lockArea = document.getElementById("welcomeLockArea");
  lockArea.style.display = "";
  document.getElementById("welcomeLockForm").style.display = "";
  const faceIdBtn = document.getElementById("welcomeLockFaceId");
  const canUseFaceId = appLockStorage.isFaceIdEnabled() && !!appLockStorage.getFaceIdCredId();
  faceIdBtn.style.display = canUseFaceId ? "" : "none";
  document.getElementById("welcomeLockPin").focus();
  if (canUseFaceId) {
    // Offer Face ID immediately so the user isn't forced to type the PIN
    appLockFaceIdBtn.click();
  }
}

function initWelcomeScreen() {
  const overlay = document.getElementById("welcomeScreen");
  if (!overlay) return;
  overlay.style.display = "";
  overlay.style.opacity = "";
  document.getElementById("welcomeBg").style.opacity = "";
  ["welcomeWatermark", "welcomeIconImg", "welcomeBrandText"].forEach((id) => {
    const el = document.getElementById(id);
    el.style.transition = "none";
    el.style.transform = "";
  });
  document.getElementById("welcomeGreeting").style.opacity = "";
  document.getElementById("welcomeGreeting").textContent = "خوش آمدید";
  document.getElementById("welcomeLockArea").style.display = "none";
  document.getElementById("welcomeLockArea").style.opacity = "";

  setTimeout(() => {
    if (appLockStorage.isEnabled() && !appLockStorage.isUnlocked()) {
      showWelcomeLockForm();
    } else {
      completeWelcomeIntro();
    }
  }, 2000);
}
initWelcomeScreen();

document.getElementById("btnDismissInstallGuide").addEventListener("click", () => {
  document.getElementById("installGuide").hidden = true;
});

// ---------- Settings accordions: only one open at a time ----------
document.querySelectorAll('#tab-settings .settings-group').forEach((details) => {
  details.addEventListener("toggle", () => {
    if (!details.open) return;
    document.querySelectorAll('#tab-settings .settings-group').forEach((other) => {
      if (other !== details) other.open = false;
    });
  });
});

// ---------- Tabs ----------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

/* ---------- Meniscus bottom nav bead ---------- */
function moveNavBead(tab, opts = {}) {
  const nav = document.getElementById("bottomNav") || document.querySelector(".bottom-nav");
  const bead = document.getElementById("navBead");
  if (!nav || !bead) return false;
  const tabId = tab || "dashboard";
  const btn = document.querySelector('.nav-btn[data-tab="' + tabId + '"]')
    || document.querySelector(".nav-btn.active")
    || document.querySelector('.nav-btn[data-tab="dashboard"]');
  if (!btn) return false;

  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  // اگر هنوز layout نشده، بعداً دوباره تلاش شود
  if (navRect.width < 20 || btnRect.width < 4) return false;

  const beadW = Math.max(56, Math.min(76, Math.round(btnRect.width * 0.95)));
  const beadH = 48;
  // مرکز دکمه نسبت به نوار
  let centerX = btnRect.left + btnRect.width / 2 - navRect.left;
  if (!isFinite(centerX)) return false;
  centerX = Math.max(beadW / 2, Math.min(navRect.width - beadW / 2, centerX));
  const left = centerX - beadW / 2;
  const color = btn.getAttribute("data-color") || "#22C55E";

  // موقعیت مستقیم با left — مطمئن‌تر از فقط CSS variable
  bead.style.width = beadW + "px";
  bead.style.height = beadH + "px";
  bead.style.marginLeft = "0";
  bead.style.marginTop = (-beadH / 2) + "px";
  bead.style.left = Math.round(left) + "px";
  bead.style.top = "50%";
  bead.style.transform = "translate3d(0,0,0) scale(1)";
  bead.style.background = color;
  bead.style.opacity = "1";
  bead.style.visibility = "visible";
  bead.style.display = "block";
  bead.style.setProperty("--bead-x", Math.round(centerX) + "px");
  bead.style.setProperty("--bead-w", beadW + "px");
  bead.style.setProperty("--bead-color", color);
  bead.classList.add("is-ready");
  return true;
}

function setupMeniscusNavDrag() {
  const nav = document.getElementById("bottomNav");
  const bead = document.getElementById("navBead");
  if (!nav || !bead || nav._meniscusDrag) return;
  nav._meniscusDrag = true;

  let dragging = false;
  let pointerId = null;

  function tabs() {
    return Array.from(nav.querySelectorAll(".nav-btn"));
  }
  function nearestTab(clientX) {
    const list = tabs();
    let best = list[0], bestDist = Infinity;
    list.forEach((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(cx - clientX);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    return best;
  }
  function setBeadXFromClient(clientX) {
    const navRect = nav.getBoundingClientRect();
    let x = clientX - navRect.left;
    x = Math.max(24, Math.min(navRect.width - 24, x));
    bead.style.setProperty("--bead-x", x + "px");
  }

  // درگ دانه: فقط وقتی انگشت واقعاً جابه‌جا شد pointer capture می‌گیریم؛
  // وگرنه capture زودهنگام باعث می‌شد کلیک به دکمه‌ی تب نرسد و تب عوض نشود.
  let longDrag = false;
  let startX = 0;
  let lastX = 0;
  nav.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    longDrag = false;
    startX = e.clientX;
    lastX = e.clientX;
    pointerId = e.pointerId;
  });
  nav.addEventListener("pointermove", (e) => {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    if (!longDrag && Math.abs(e.clientX - startX) > 12) {
      longDrag = true;
      try { nav.setPointerCapture(pointerId); } catch (_) {}
    }
    lastX = e.clientX;
    if (!longDrag) return;
    bead.classList.add("is-dragging");
    setBeadXFromClient(e.clientX);
    const near = nearestTab(e.clientX);
    if (near) {
      const color = near.getAttribute("data-color") || "#22C55E";
      bead.style.background = color;
      bead.style.setProperty("--bead-color", color);
    }
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    bead.classList.remove("is-dragging");
    try { nav.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    if (!longDrag) return;
    const near = nearestTab(e.clientX || lastX);
    if (near && near.dataset.tab) {
      switchTab(near.dataset.tab);
    } else {
      const active = document.querySelector(".nav-btn.active");
      if (active) moveNavBead(active.dataset.tab);
    }
    longDrag = false;
  }
  nav.addEventListener("pointerup", endDrag);
  nav.addEventListener("pointercancel", endDrag);
}


const _tabOrder = ["todo", "entry", "dashboard", "installments", "analysis", "settings"];
function switchTab(tab, opts = {}) {
  const prevTab = document.querySelector(".tab.active");
  const prevTabId = prevTab ? prevTab.id.replace("tab-", "") : null;
  const prevIdx = prevTabId ? _tabOrder.indexOf(prevTabId) : -1;
  const nextIdx = _tabOrder.indexOf(tab);

  // Clean up old transition classes
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.remove("active", "slide-from-right", "slide-from-left",
      "slide-from-bottom", "slide-exit-left", "slide-exit-right", "slide-exit-up");
  });

  // Determine direction for the new tab
  let enterClass = "slide-from-bottom";
  if (prevIdx !== -1 && nextIdx !== -1) {
    if (nextIdx < prevIdx) enterClass = "slide-from-right";
    else if (nextIdx > prevIdx) enterClass = "slide-from-left";
    else enterClass = "slide-from-bottom";
  }

  document.getElementById("tab-" + tab).classList.add("active", enterClass);
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add("active");
  // دانه Meniscus
  if (typeof moveNavBead === "function") {
    requestAnimationFrame(() => moveNavBead(tab));
  }
  if (tab === "entry" && !opts.keepExpenseFilter && expenseListFilter) {
    expenseListFilter = null;
    renderExpenseList();
  }
  if (tab === "dashboard") {
    // Reset numbers to 0 so animateNumber plays from scratch
    const incomeChip = document.getElementById("dashIncomeChip");
    const expenseChip = document.getElementById("dashExpenseChip");
    const balanceAmountEl = document.getElementById("dashBalanceAmount");
    if (incomeChip) incomeChip.textContent = "۰";
    if (expenseChip) expenseChip.textContent = "۰";
    if (balanceAmountEl) balanceAmountEl.textContent = "۰";
    // Small delay to ensure DOM updates before animation starts
    requestAnimationFrame(() => renderDashboard());
  }
  if (tab === "analysis") {
    // نمودارها عرض واقعی را فقط وقتی تب دیده می‌شود دارند
    requestAnimationFrame(() => {
      try { renderAnalysis(); } catch (e) { console.warn("analysis", e); }
    });
  }
  if (tab === "installments" && typeof window.refreshInstallments === "function") {
    // Reset numbers to 0 so animation plays from scratch
    if (typeof window.resetInstallmentNumbers === "function") window.resetInstallmentNumbers();
    requestAnimationFrame(() => window.refreshInstallments());
  }
  if (tab === "todo") {
    try {
      if (typeof setupTodoUI === "function") setupTodoUI();
      renderTodo({ enterAnimate: true });
    } catch (e) { console.warn("todo tab", e); }
    const piFab = document.getElementById("piFab");
    if (piFab) piFab.hidden = false;
  } else {
    const piFab = document.getElementById("piFab");
    if (piFab) piFab.hidden = true;
  }

  // Settings accordions always start closed, whether we're leaving or entering the tab
  document.querySelectorAll("#tab-settings .settings-group").forEach((d) => { d.open = false; });

  const headerEl = document.querySelector(".app-header");
  if (headerEl) {
    // Toggle compact state via JS-driven transform
    setHeaderCompact(tab !== "dashboard");
  }

  // دکمه شناور + اقساط فقط در تب اقساط
  const fab = document.getElementById("fab");
  if (fab) {
    if (tab === "installments") {
      fab.hidden = false;
      fab.setAttribute("aria-hidden", "false");
    } else {
      fab.hidden = true;
      fab.setAttribute("aria-hidden", "true");
    }
  }

  const scrollRoot = document.getElementById("appScroll");
  if (scrollRoot) scrollRoot.scrollTop = 0;
}

document.getElementById("dashSettingsBtn").addEventListener("click", () => switchTab("settings"));

// ---------- Balance eye toggle ----------
let _balanceVisible = true;
(function setupBalanceEye() {
  const eyeBtn = document.getElementById("balanceEyeBtn");
  if (!eyeBtn) return;
  eyeBtn.addEventListener("click", () => {
    _balanceVisible = !_balanceVisible;
    const card = document.getElementById("dashBalanceCard");
    const amountEl = document.getElementById("dashBalanceAmount");
    const eyeOpen = eyeBtn.querySelector(".eye-open");
    const eyeClosed = eyeBtn.querySelector(".eye-closed");
    if (_balanceVisible) {
      card.classList.remove("is-hidden");
      eyeOpen.style.display = "";
      eyeClosed.style.display = "none";
      // Re-animate the number
      const balance = computeCumulativeBalance(viewedMonth.jy, viewedMonth.jm);
      amountEl.textContent = "۰";
      requestAnimationFrame(() => animateNumber(amountEl, Math.abs(balance), 600));
    } else {
      card.classList.add("is-hidden");
      eyeOpen.style.display = "none";
      eyeClosed.style.display = "";
      amountEl.textContent = "*" .repeat(String(Math.abs(computeCumulativeBalance(viewedMonth.jy, viewedMonth.jm))).length);
    }
  });
})();

// ---------- 000 shortcut buttons ----------
document.querySelectorAll(".amount-inline-shortcut").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const current = normalizeDigits(target.value).replace(/[^\d]/g, "");
    const newVal = current + "000";
    target.value = Number(newVal).toLocaleString("en-US");
    target.focus();
  });
});

// ---------- Dismiss keyboard on submit ----------
function dismissKeyboard() {
  if (document.activeElement) document.activeElement.blur();
}

// ---------- Entry mode toggle (income/expense merged tab) ----------
document.querySelectorAll("#entryModeToggle .entry-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setEntryMode(btn.dataset.mode));
});
function setEntryMode(mode) {
  document.querySelectorAll("#entryModeToggle .entry-mode-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mode === mode);
  });
  document.querySelectorAll('[data-mode-panel="income"]').forEach((el) => {
    el.style.display = mode === "income" ? "" : "none";
  });
  document.querySelectorAll('[data-mode-panel="expense"]').forEach((el) => {
    el.style.display = mode === "expense" ? "" : "none";
  });
}

// ---------- Haptic + sound feedback when a transaction is added ----------
let sharedAudioCtx = null;
function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
  return sharedAudioCtx;
}

const coinAudio = new Audio("sounds/coin.mp3");
coinAudio.preload = "auto";

// Decode the sound effect into an AudioBuffer once up front so playback via
// Web Audio has near-zero latency. HTMLAudioElement + cloneNode() has to
// re-decode on every play in several browsers (a noticeable delay), and most
// sound-effect mp3s also carry a short silent header from the encoder — we
// trim that here too so the "kaching" hits right on the tap.
let coinAudioBuffer = null;
let coinAudioBufferPromise = null;
function loadCoinAudioBuffer() {
  const ctx = getAudioCtx();
  if (!ctx) return Promise.resolve(null);
  if (coinAudioBuffer) return Promise.resolve(coinAudioBuffer);
  if (coinAudioBufferPromise) return coinAudioBufferPromise;
  coinAudioBufferPromise = fetch("sounds/coin.mp3")
    .then((res) => res.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buf) => {
      coinAudioBuffer = trimLeadingSilence(buf, ctx);
      return coinAudioBuffer;
    })
    .catch(() => null);
  return coinAudioBufferPromise;
}
// Some encoders (LAME especially) pad the start of an mp3 with a few tens of
// milliseconds of near-silence. Skim past it so playback starts right on the hit.
function trimLeadingSilence(buffer, ctx, thresholdDb = -45) {
  try {
    const threshold = Math.pow(10, thresholdDb / 20);
    const data = buffer.getChannelData(0);
    let startSample = 0;
    const maxScanSamples = Math.min(data.length, buffer.sampleRate * 0.5); // scan at most 500ms
    for (let i = 0; i < maxScanSamples; i++) {
      if (Math.abs(data[i]) > threshold) { startSample = i; break; }
    }
    if (startSample < buffer.sampleRate * 0.005) return buffer; // negligible, skip re-copy
    const trimmedLength = buffer.length - startSample;
    const trimmed = ctx.createBuffer(buffer.numberOfChannels, trimmedLength, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      trimmed.copyToChannel(buffer.getChannelData(ch).subarray(startSample), ch);
    }
    return trimmed;
  } catch (e) {
    return buffer;
  }
}
// Kick off loading/decoding immediately so the buffer is ready before the
// user's first tap (a click/tap elsewhere will also resume the AudioContext).
loadCoinAudioBuffer();
document.addEventListener("pointerdown", () => loadCoinAudioBuffer(), { once: true, passive: true });

// Simulates a coin hitting a hard surface and bouncing to a stop — used only
// as a fallback if the real coin sound file can't be played for some reason.
function playCoinSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Bright metallic "ring" — two closely-detuned sine waves beating together
  function metallicTing(startOffset, freq, peakGain, duration) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now + startOffset);
    osc2.frequency.setValueAtTime(freq * 1.015, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now + startOffset);
    osc2.start(now + startOffset);
    osc1.stop(now + startOffset + duration + 0.02);
    osc2.stop(now + startOffset + duration + 0.02);
  }

  // Sharp noise "click" for the very first impact (adds the metallic edge)
  const bufferSize = Math.floor(ctx.sampleRate * 0.025);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 3500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Coin bouncing and settling: quick fading metallic taps
  [
    { t: 0.00, freq: 2600, gain: 0.24, dur: 0.10 },
    { t: 0.07, freq: 2300, gain: 0.17, dur: 0.09 },
    { t: 0.13, freq: 2750, gain: 0.12, dur: 0.08 },
    { t: 0.19, freq: 2400, gain: 0.08, dur: 0.07 },
    { t: 0.25, freq: 2650, gain: 0.05, dur: 0.09 }
  ].forEach((b) => metallicTing(b.t, b.freq, b.gain, b.dur));
}

// iOS Safari/WebKit has never implemented the public Vibration API (navigator.vibrate
// silently does nothing there — this is an Apple platform restriction, not something
// fixable purely in JS). As a best-effort workaround we toggle a hidden native checkbox,
// which on some iOS versions produces a light system haptic tick since it's a real native
// control changing state within the same trusted click/submit gesture. It's unofficial and
// not guaranteed on every iOS version, but it's harmless if it does nothing.
function triggerHaptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(35); return; } catch (e) {}
  }
  const proxy = document.getElementById("hapticProxy");
  if (proxy) {
    try { proxy.click(); } catch (e) {}
  }
}

function playTransactionFeedback() {
  triggerHaptic();
  const ctx = getAudioCtx();
  if (ctx && coinAudioBuffer) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = coinAudioBuffer;
      src.connect(ctx.destination);
      src.start(0);
      return;
    } catch (e) { /* fall through to HTMLAudioElement path */ }
  }
  try {
    const sound = coinAudio.cloneNode();
    sound.currentTime = 0;
    const p = sound.play();
    if (p && p.catch) p.catch(() => { try { playCoinSound(); } catch (e) {} });
  } catch (e) {
    try { playCoinSound(); } catch (e2) {}
  }
}

// ---------- Income form ----------
document.getElementById("incomeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = getAmountValue(document.getElementById("incomeAmount"));
  if (!amount || amount <= 0) return;
  state.incomes.push({
    id: uid(),
    amount,
    source: document.getElementById("incomeSource").value,
    note: document.getElementById("incomeNote").value.trim(),
    date: getSelectedISO("income"),
    createdAt: Date.now()
  });
  playTransactionFeedback();
  e.target.reset();
  setDatePickerToToday("income");
  resetDateQuickPicker("income");
  saveState();
  dismissKeyboard();
});

// ---------- Expense form ----------
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = getAmountValue(document.getElementById("expenseAmount"));
  const category = selectedExpenseCategoryName;
  if (!amount || amount <= 0 || !category) return;
  state.expenses.push({
    id: uid(),
    amount,
    category,
    note: document.getElementById("expenseNote").value.trim(),
    date: getSelectedISO("expense"),
    createdAt: Date.now()
  });
  playTransactionFeedback();
  e.target.reset();
  setDatePickerToToday("expense");
  resetDateQuickPicker("expense");
  saveState();
  dismissKeyboard();
});

// ---------- Installment payment → add expense under "اقساط" category ----------
window.addEventListener("installment-paid", (e) => {
  const { title, amount, dueKey } = e.detail;
  if (!amount || amount <= 0) return;
  // Convert dueKey (ISO date) to the expense date
  const expDate = dueKey || new Date().toISOString().slice(0, 10);
  // Check if this exact installment payment was already added (avoid duplicates)
  const exists = state.expenses.some(
    (x) => x.category === "اقساط" && x.note === title && x.date === expDate && x.amount === amount
  );
  if (exists) return;
  state.expenses.push({
    id: uid(),
    amount,
    category: "اقساط",
    note: title,
    date: expDate,
    createdAt: Date.now(),
    installmentPaid: true,
  });
  saveState();
});

// ---------- Category form ----------
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("categoryName");
  const name = input.value.trim();
  if (!name || state.categories.some((c) => c.name === name)) { input.value = ""; return; }
  state.categories.push({ name, icon: selectedNewCategoryIcon, color: selectedNewCategoryColor });
  input.value = "";
  selectedNewCategoryColor = nextSuggestedCategoryColor();
  renderCategoryColorPicker();
  saveState();
});

function deleteIncome(id) {
  state.incomes = state.incomes.filter((x) => x.id !== id);
  saveState();
  refreshCalDaySheetIfOpen();
}
function deleteExpense(id) {
  state.expenses = state.expenses.filter((x) => x.id !== id);
  saveState();
  refreshCalDaySheetIfOpen();
}
function refreshCalDaySheetIfOpen() {
  const overlay = document.getElementById("calDaySheetOverlay");
  if (overlay && !overlay.hidden && overlay.dataset.iso) {
    openCalDaySheet(overlay.dataset.iso);
  }
}
function deleteCategory(name) {
  const inUse = state.expenses.some((x) => x.category === name);
  if (inUse && !confirm("این برچسب برای چند خرج ثبت‌شده استفاده شده. حذف بشه؟ خرج‌ها برچسب‌شون «سایر» می‌شه.")) return;
  state.categories = state.categories.filter((c) => c.name !== name);
  if (!state.categories.some((c) => c.name === "سایر")) state.categories.push({ name: "سایر", icon: "package" });
  state.expenses.forEach((x) => { if (x.category === name) x.category = "سایر"; });
  saveState();
}

// ---------- Rendering ----------
function renderAll() {
  document.body.classList.toggle("viewing-past-month", !isViewingCurrentMonth());
  renderExpenseCategoryPicker();
  renderCategoryManageList();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderAnalysis();
  renderCalendar();
  renderWeekCalStrip();
  renderProfileCard();
  if (typeof refreshAll === "function") refreshAll();
}

function renderExpenseCategoryPicker() {
  const wrap = document.getElementById("expenseCategoryPicker");
  if (!selectedExpenseCategoryName || !state.categories.some((c) => c.name === selectedExpenseCategoryName)) {
    selectedExpenseCategoryName = state.categories[0] ? state.categories[0].name : null;
  }
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">اول یک برچسب بساز (تب برچسب‌ها)</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => {
    const color = catColor(c.name);
    const selected = c.name === selectedExpenseCategoryName;
    return `
    <button type="button" class="category-chip ${selected ? "selected" : ""}" data-name="${c.name}"
      style="${selected ? `background:${color}20;border-color:${color};color:${color}` : ""}">
      ${iconSpanHTML(c.icon, `color:${color}`)}<span class="chip-name">${c.name}</span>
    </button>
  `;
  }).join("");
  wrap.querySelectorAll(".category-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedExpenseCategoryName = btn.dataset.name;
      renderExpenseCategoryPicker();
    });
  });
}

function renderCategoryIconPicker() {
  const wrap = document.getElementById("categoryIconPicker");
  wrap.innerHTML = ICON_CHOICES.map((key) => `
    <button type="button" class="icon-chip ${key === selectedNewCategoryIcon ? "selected" : ""}" data-icon="${key}">
      ${iconSpanHTML(key)}
    </button>
  `).join("");
  wrap.querySelectorAll(".icon-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedNewCategoryIcon = btn.dataset.icon;
      renderCategoryIconPicker();
    });
  });
}
renderCategoryIconPicker();

function nextSuggestedCategoryColor() {
  const used = new Set(state.categories.map((c) => c.color).filter(Boolean));
  const free = CATEGORY_COLOR_CHOICES.find((c) => !used.has(c));
  return free || CATEGORY_COLOR_CHOICES[state.categories.length % CATEGORY_COLOR_CHOICES.length];
}

function colorSwatchesHTML(selectedColor, extraClass) {
  return CATEGORY_COLOR_CHOICES.map((c) => `
    <button type="button" class="color-chip ${extraClass || ""} ${c === selectedColor ? "selected" : ""}" data-color="${c}" style="background:${c}"></button>
  `).join("");
}

function renderCategoryColorPicker() {
  const wrap = document.getElementById("categoryColorPicker");
  if (!selectedNewCategoryColor) selectedNewCategoryColor = nextSuggestedCategoryColor();
  wrap.innerHTML = colorSwatchesHTML(selectedNewCategoryColor);
  wrap.querySelectorAll(".color-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedNewCategoryColor = btn.dataset.color;
      renderCategoryColorPicker();
    });
  });
}
renderCategoryColorPicker();

function renderCategoryManageList() {
  const wrap = document.getElementById("categoryManageList");
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">هنوز برچسبی نساختی</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => `
    <div class="category-manage-row">
      <span class="cat-name">
        <span class="cat-color-dot" data-name="${c.name}" style="background:${catColor(c.name)}"></span>
        ${iconSpanHTML(c.icon)}${iconSpanHTML("tag", "width:11px;height:11px;color:#E8791A;margin-left:4px;vertical-align:-1px;")}${c.name}
      </span>
      <button class="entry-delete" onclick="deleteCategory('${c.name.replace(/'/g, "\\'")}')">حذف</button>
    </div>
    <div class="cat-color-swatches" data-swatches-for="${c.name}">
      ${colorSwatchesHTML(catColor(c.name))}
    </div>
  `).join("");
  wrap.querySelectorAll(".cat-color-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const panel = wrap.querySelector(`.cat-color-swatches[data-swatches-for="${CSS.escape(dot.dataset.name)}"]`);
      const wasOpen = panel.classList.contains("open");
      wrap.querySelectorAll(".cat-color-swatches.open").forEach((p) => p.classList.remove("open"));
      if (!wasOpen) panel.classList.add("open");
    });
  });
  wrap.querySelectorAll(".cat-color-swatches").forEach((panel) => {
    panel.querySelectorAll(".color-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cat = state.categories.find((c) => c.name === panel.dataset.swatchesFor);
        if (cat) cat.color = chip.dataset.color;
        saveState();
      });
    });
  });
}

function sortEntriesDesc(items) {
  return items.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

function renderIncomeList() {
  const wrap = document.getElementById("incomeList");
  const items = sortEntriesDesc(state.incomes.filter((x) => inViewedMonth(x.date)));
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint">${isViewingCurrentMonth() ? "هنوز درآمدی ثبت نشده" : "درآمدی در این ماه ثبت نشده"}</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "income")).join("");
}

function renderExpenseList() {
  const wrap = document.getElementById("expenseList");
  const clearBtn = document.getElementById("expenseListFilterClear");
  const titleEl = document.getElementById("expenseListTitle");
  let items = state.expenses.filter((x) => inViewedMonth(x.date));
  if (expenseListFilter) {
    items = items.filter((x) => x.category === expenseListFilter);
    clearBtn.style.display = "";
    titleEl.textContent = `لیست مخارج «${expenseListFilter}»`;
  } else {
    clearBtn.style.display = "none";
    titleEl.textContent = "لیست مخارج";
  }
  items = sortEntriesDesc(items);
  if (!items.length) {
    wrap.innerHTML = `<p class="empty-hint">${expenseListFilter ? "خرجی با این برچسب ثبت نشده" : (isViewingCurrentMonth() ? "هنوز خرجی ثبت نشده" : "خرجی در این ماه ثبت نشده")}</p>`;
    return;
  }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "expense")).join("");
}

function entryRowHTML(x, type) {
  const isIncome = type === "income";
  const title = isIncome ? x.source : x.category;
  const iconKey = isIncome ? (INCOME_SOURCE_ICON[x.source] || "wallet") : catIcon(x.category);
  const noteHTML = x.note ? `<strong class="entry-note-bold">${x.note}</strong>` : "";
  const sub = [formatDateFa(x.date), noteHTML].filter(Boolean).join(" · ");
  const rowColor = isIncome ? null : catColor(x.category);
  return `
    <div class="entry-row" style="${rowColor ? `background:${rowColor}17` : ""}">
      <div class="entry-row-main">
        <span class="entry-icon ${isIncome ? "income-icon" : "expense-icon"}" style="${isIncome ? "" : `background:${rowColor}`}">${iconSpanHTML(iconKey)}</span>
        <div>
          <div class="entry-title">${title}</div>
          <div class="entry-sub">${sub}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="entry-amount ${isIncome ? "income-amt" : "expense-amt"}">${isIncome ? "+" : "−"}${fmtAmount(x.amount)}</span>
        <button class="entry-delete" onclick="${isIncome ? "deleteIncome" : "deleteExpense"}('${x.id}')">✕</button>
      </div>
    </div>`;
}

// ---------- Dashboard month navigation ----------
let dashboardMode = "month";
let viewedMonth = todayJalali();

function inViewedMonth(dateStr) {
  const [gy, gm, gd] = dateStr.split("-").map(Number);
  const j = toJalaali(gy, gm, gd);
  return j.jy === viewedMonth.jy && j.jm === viewedMonth.jm;
}
// جمع درآمد/خرج و دسته‌بندی خرج‌های یک ماه شمسی (برای مقایسه ماه‌ها و تحلیل هوشمند)
function computeMonthTotals(jy, jm) {
  const inMonth = (dateStr) => {
    if (!dateStr) return false;
    const [gy, gm, gd] = String(dateStr).split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    return j.jy === jy && j.jm === jm;
  };
  const incomes = (state.incomes || []).filter((x) => inMonth(x.date));
  const expenses = (state.expenses || []).filter((x) => inMonth(x.date));
  const byCat = {};
  expenses.forEach((x) => {
    const name = x.category || "سایر";
    byCat[name] = (byCat[name] || 0) + (Number(x.amount) || 0);
  });
  return {
    totalIncome: incomes.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    totalExpense: expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    categories: Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }))
  };
}
function isViewingCurrentMonth() {
  const t = todayJalali();
  return viewedMonth.jy === t.jy && viewedMonth.jm === t.jm;
}

function computeCumulativeBalance(jy, jm) {
  // مانده‌ی حساب تا پایان این ماه — با احتساب همه‌ی تراکنش‌های قبل‌تر، پس خودش از ماه به ماه منتقل می‌شه
  const len = jalaaliMonthLength(jy, jm);
  const gEnd = toGregorian(jy, jm, len);
  const endIso = `${gEnd.gy}-${String(gEnd.gm).padStart(2, "0")}-${String(gEnd.gd).padStart(2, "0")}`;
  let income = 0, expense = 0;
  state.incomes.forEach((x) => { if (x.date <= endIso) income += x.amount; });
  state.expenses.forEach((x) => { if (x.date <= endIso) expense += x.amount; });
  return income - expense;
}

function updateMonthLabel() {
  const label = document.getElementById("monthLabel");
  label.textContent = JALALI_MONTHS[viewedMonth.jm - 1];

  const jumpTodayBtn = document.getElementById("jumpTodayBtn");
  if (jumpTodayBtn) jumpTodayBtn.hidden = isViewingCurrentMonth();

  // Update balance hero card with wallet icon
  const balance = computeCumulativeBalance(viewedMonth.jy, viewedMonth.jm);
  const balanceCard = document.getElementById("dashBalanceCard");
  const balanceAmountEl = document.getElementById("dashBalanceAmount");
  if (balanceCard && balanceAmountEl) {
    const isPositive = balance >= 0;
    const hiddenClass = !_balanceVisible ? " is-hidden" : "";
    balanceCard.className = `balance-hero-card ${isPositive ? "positive" : "negative"}${hiddenClass}`;
    animateNumber(balanceAmountEl, Math.abs(balance), 800);
  }
}

// Every tab (dashboard, entry list, analysis) follows the same viewed month,
// and the whole app gets a distinct background tint while browsing history
// so it's obvious you're not looking at the current month.
function applyViewedMonthState() {
  document.body.classList.toggle("viewing-past-month", !isViewingCurrentMonth());
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderAnalysis();
  renderCalendar();
  if (typeof refreshAll === "function") refreshAll(); // تب اقساط هم با همین ماهِ دیده‌شده هماهنگ بشه
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const label = document.getElementById("calendarMonthLabel");
  if (!grid || !label) return;
  label.textContent = `${JALALI_MONTHS[viewedMonth.jm - 1]} ${toPersianDigits(viewedMonth.jy)}`;

  const byDay = {};
  const addTo = (jd, key, amt) => {
    if (!byDay[jd]) byDay[jd] = { income: 0, expense: 0 };
    byDay[jd][key] += amt;
  };
  state.incomes.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (j.jy === viewedMonth.jy && j.jm === viewedMonth.jm) addTo(j.jd, "income", x.amount);
  });
  state.expenses.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (j.jy === viewedMonth.jy && j.jm === viewedMonth.jm) addTo(j.jd, "expense", x.amount);
  });

  const daysInMonth = jalaaliMonthLength(viewedMonth.jy, viewedMonth.jm);
  const firstDow = calendarDayOfWeekIndex(viewedMonth.jy, viewedMonth.jm, 1);
  const today = todayJalali();

  let html = "";
  for (let i = 0; i < firstDow; i += 1) {
    html += `<div class="cal-cell cal-cell-empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const rec = byDay[d];
    const net = rec ? rec.income - rec.expense : 0;
    const amtStr = fmtCompactEn(net);
    const amtClass = net > 0 ? "cal-amt-pos" : (net < 0 ? "cal-amt-neg" : "");
    const isToday = today.jy === viewedMonth.jy && today.jm === viewedMonth.jm && today.jd === d;
    let dayTypeClass = "";
    if (rec) {
      const hasIncome = rec.income > 0;
      const hasExpense = rec.expense > 0;
      if (hasIncome && hasExpense) dayTypeClass = "cal-cell-mixed";
      else if (hasIncome) dayTypeClass = "cal-cell-income-only";
      else if (hasExpense) dayTypeClass = "cal-cell-expense-only";
    }
    html += `
      <button type="button" class="cal-cell ${dayTypeClass} ${isToday ? "cal-cell-today" : ""}" data-day="${d}">
        <span class="cal-day-num">${toPersianDigits(d)}</span>
        ${amtStr ? `<span class="cal-day-amt ${amtClass}">${amtStr}</span>` : ""}
      </button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-cell[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => openCalDaySheet(calISOFromViewedDay(Number(btn.dataset.day))));
  });
}

// ---------- شیت جزئیات روز تقویم ----------
function calISOFromViewedDay(jd) {
  const g = toGregorian(viewedMonth.jy, viewedMonth.jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

function openCalDaySheet(iso) {
  const overlay = document.getElementById("calDaySheetOverlay");
  const title = document.getElementById("calDaySheetTitle");
  const summary = document.getElementById("calDaySheetSummary");
  const list = document.getElementById("calDaySheetList");

  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = toJalaali(gy, gm, gd);
  title.textContent = `${toPersianDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;

  const dayIncomes = state.incomes.filter((x) => x.date === iso);
  const dayExpenses = state.expenses.filter((x) => x.date === iso);
  const incomeSum = dayIncomes.reduce((s, x) => s + x.amount, 0);
  const expenseSum = dayExpenses.reduce((s, x) => s + x.amount, 0);

  summary.innerHTML = `
    <div class="cal-day-sheet-stat">
      <span class="cal-day-sheet-stat-label">درآمد</span>
      <strong class="cal-day-sheet-stat-val income-color">${fmtAmount(incomeSum)}</strong>
    </div>
    <div class="cal-day-sheet-stat">
      <span class="cal-day-sheet-stat-label">مخارج</span>
      <strong class="cal-day-sheet-stat-val expense-color">${fmtAmount(expenseSum)}</strong>
    </div>`;

  const items = sortEntriesDesc([
    ...dayIncomes.map((x) => ({ ...x, __type: "income" })),
    ...dayExpenses.map((x) => ({ ...x, __type: "expense" })),
  ]);
  list.innerHTML = items.length
    ? items.map((x) => entryRowHTML(x, x.__type)).join("")
    : `<p class="empty-hint">تراکنشی برای این روز ثبت نشده</p>`;

  overlay.dataset.iso = iso;
  overlay.hidden = false;
}

function closeCalDaySheet() {
  document.getElementById("calDaySheetOverlay").hidden = true;
}
document.getElementById("calDaySheetClose").addEventListener("click", closeCalDaySheet);
document.getElementById("calDaySheetOverlay").addEventListener("click", (e) => {
  if (e.target.id === "calDaySheetOverlay") closeCalDaySheet();
});

function calDayJumpToEntry(mode) {
  const iso = document.getElementById("calDaySheetOverlay").dataset.iso;
  if (!iso) return;
  closeCalDaySheet();
  switchTab("entry");
  setEntryMode(mode);
  dateQuickMode[mode] = "custom";
  const group = document.getElementById(mode + "DateQuick");
  group.querySelectorAll(".date-quick-btn").forEach((b) => b.classList.toggle("selected", b.dataset.value === "custom"));
  document.getElementById(mode + "CustomDate").style.display = "grid";
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = toJalaali(gy, gm, gd);
  populateDateSelects(mode, j.jy, j.jm, j.jd);
}
document.getElementById("calDayAddExpenseBtn").addEventListener("click", () => calDayJumpToEntry("expense"));
document.getElementById("calDayAddIncomeBtn").addEventListener("click", () => calDayJumpToEntry("income"));

document.getElementById("calPrevMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, -1);
  applyViewedMonthState();
});
document.getElementById("calNextMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, 1);
  applyViewedMonthState();
});
document.getElementById("calTodayBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = todayJalali();
  applyViewedMonthState();
});

// ---------- پاپ‌آپ تقویم ماه (از روی ویجت هفته‌ی اخیر داشبورد باز می‌شه) ----------
function openCalMonthPopup() {
  viewedMonth = todayJalali();
  applyViewedMonthState();
  const ov = document.getElementById("calMonthOverlay");
  ov.classList.add("cal-visible");
}
function closeCalMonthPopup() {
  const ov = document.getElementById("calMonthOverlay");
  ov.classList.remove("cal-visible");
}
document.getElementById("weekCalExpandBtn").addEventListener("click", openCalMonthPopup);
document.getElementById("calMonthCloseBtn").addEventListener("click", closeCalMonthPopup);
document.getElementById("calMonthOverlay").addEventListener("click", (e) => {
  if (e.target.id === "calMonthOverlay") closeCalMonthPopup();
});

// ---------- ویجت تقویم هفته‌ی اخیر (پایین داشبورد) ----------
function renderWeekCalStrip() {
  const strip = document.getElementById("weekCalStrip");
  if (!strip) return;

  const dowLetters = ["ی", "د", "س", "چ", "پ", "ج", "ش"]; // getDay(): 0=یکشنبه..6=شنبه
  const now = new Date();
  const today = todayJalali();
  let html = "";

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
    const iso = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
    const j = toJalaali(gy, gm, gd);

    const dayIncomes = state.incomes.filter((x) => x.date === iso);
    const dayExpenses = state.expenses.filter((x) => x.date === iso);
    const incomeSum = dayIncomes.reduce((s, x) => s + x.amount, 0);
    const expenseSum = dayExpenses.reduce((s, x) => s + x.amount, 0);
    const net = incomeSum - expenseSum;
    const amtStr = fmtCompactEn(net);
    const amtClass = net > 0 ? "cal-amt-pos" : (net < 0 ? "cal-amt-neg" : "");

    let dayTypeClass = "";
    if (incomeSum > 0 && expenseSum > 0) dayTypeClass = "cal-cell-mixed";
    else if (incomeSum > 0) dayTypeClass = "cal-cell-income-only";
    else if (expenseSum > 0) dayTypeClass = "cal-cell-expense-only";

    const isToday = j.jy === today.jy && j.jm === today.jm && j.jd === today.jd;

    html += `
      <button type="button" class="cal-cell week-cal-cell ${dayTypeClass} ${isToday ? "cal-cell-today" : ""}" data-iso="${iso}">
        <span class="week-cal-dow">${dowLetters[d.getDay()]}</span>
        <span class="cal-day-num">${toPersianDigits(j.jd)}</span>
        ${amtStr ? `<span class="cal-day-amt ${amtClass}">${amtStr}</span>` : ""}
      </button>`;
  }
  strip.innerHTML = html;
  strip.querySelectorAll(".cal-cell[data-iso]").forEach((btn) => {
    btn.addEventListener("click", () => openCalDaySheet(btn.dataset.iso));
  });
}

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, -1);
  applyViewedMonthState();
});
document.getElementById("nextMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, 1);
  applyViewedMonthState();
});
document.getElementById("jumpTodayBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = todayJalali();
  applyViewedMonthState();
});

// If the app was only backgrounded (not actually closed), some mobile
// browsers keep the page alive rather than reloading it. If it's been
// hidden a while, treat coming back as a fresh open and snap back to
// the current month.
let hiddenSinceTs = null;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenSinceTs = Date.now();
  } else if (hiddenSinceTs && Date.now() - hiddenSinceTs > 5 * 60 * 1000) {
    hiddenSinceTs = null;
    if (!isViewingCurrentMonth()) {
      viewedMonth = todayJalali();
      applyViewedMonthState();
    }
  } else {
    hiddenSinceTs = null;
  }
});

function renderDashboard() {
  updateMonthLabel();
  const inPeriod = (dateStr) => {
    if (dashboardMode === "all") return true;
    return inViewedMonth(dateStr);
  };

  const incomes = state.incomes.filter((x) => inPeriod(x.date));
  const expenses = state.expenses.filter((x) => inPeriod(x.date));

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
  const balance = totalIncome - totalExpense;

  const _incChip = document.getElementById("dashIncomeChip");
  const _expChip = document.getElementById("dashExpenseChip");
  if (_incChip) _incChip.textContent = fmtAmount(totalIncome);
  if (_expChip) _expChip.textContent = fmtAmount(totalExpense);

  const total = totalIncome + totalExpense;
  const incomePct = total ? (totalIncome / total) * 100 : 50;
  const expensePct = total ? (totalExpense / total) * 100 : 50;

  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const catWrap = document.getElementById("categoryBreakdown");
  if (!state.categories.length) {
    catWrap.innerHTML = `<p class="empty-hint">اول یک برچسب بساز (تب برچسب‌ها)</p>`;
  } else {
    catWrap.innerHTML = state.categories.map((c) => {
      const color = catColor(c.name);
      const amt = byCat[c.name] || 0;
      return `
        <button type="button" class="quick-cat-card" style="background:linear-gradient(135deg, ${color}55 0%, ${color}30 100%)" onclick="quickAddExpense('${c.name.replace(/'/g, "\\'")}')">
          <span class="quick-cat-bubble">${iconSpanHTML(c.icon, `color:${color}`)}</span>
          <span class="quick-cat-name">${c.name}</span>
          <span class="quick-cat-amount">${fmtAmount(amt)}</span>
        </button>`;
    }).join("");
  }

  const bySource = {};
  incomes.forEach((x) => { const k = x.source || "سایر"; bySource[k] = (bySource[k] || 0) + x.amount; });
  const usedSources = Array.from(new Set([...INCOME_SOURCES, ...state.incomes.map((x) => x.source || "سایر")]));
  const srcWrap = document.getElementById("incomeSourceGrid");
  srcWrap.innerHTML = usedSources.map((source, i) => {
    const palette = INCOME_CARD_PALETTE[i % INCOME_CARD_PALETTE.length];
    const amt = bySource[source] || 0;
    const iconKey = INCOME_SOURCE_ICON[source] || "wallet";
    return `
      <button type="button" class="quick-cat-card" style="background:${palette.bg}" onclick="quickAddIncome('${source.replace(/'/g, "\\'")}')">
        <span class="quick-cat-bubble" style="background:${palette.icon}33">${iconSpanHTML(iconKey, `color:${palette.icon}`)}</span>
        <span class="quick-cat-name">${source}</span>
        <span class="quick-cat-amount">${fmtAmount(amt)}</span>
      </button>`;
  }).join("");
}

function quickAddExpense(categoryName) {
  selectedExpenseCategoryName = categoryName;
  renderExpenseCategoryPicker();
  expenseListFilter = categoryName;
  switchTab("entry", { keepExpenseFilter: true });
  setEntryMode("expense");
  renderExpenseList();
  setTimeout(() => document.getElementById("expenseAmount").focus(), 150);
}

document.getElementById("expenseListFilterClear").addEventListener("click", () => {
  expenseListFilter = null;
  renderExpenseList();
});

function quickAddIncome(source) {
  const sel = document.getElementById("incomeSource");
  if ([...sel.options].some((o) => o.value === source)) sel.value = source;
  switchTab("entry");
  setEntryMode("income");
  setTimeout(() => document.getElementById("incomeAmount").focus(), 150);
}

// ---------- Analysis charts ----------
// =========================================================
// تب آنالیز — طراحی کامل: حلقه‌های سبک آیفون (Activity Rings)،
// کارت‌های شاخص با اسپارک‌لاین، منحنی نرم خرج تجمعی، دونات دسته‌ها،
// ستون‌های کپسولی ۶ ماه، الگوی روزهای هفته و بزرگ‌ترین خرج‌ها.
// همه‌چیز بر اساس ماهِ دیده‌شده (viewedMonth)
// =========================================================
const AN_INCOME = "#00907C";   // روی کارت روشن
const AN_EXPENSE = "#C9482A";
const AN_CONTEXT = "#C9CFCC";
const AN_RING = { expense: "#F2555A", income: "#12A48A", save: "#5B86F2" }; // روی کارت تیره
const AN_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const AN_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function anJ(dateStr) {
  const [gy, gm, gd] = String(dateStr || "").split("-").map(Number);
  if (!gy || !gm || !gd) return null;
  return toJalaali(gy, gm, gd);
}
function anMonthItems(list, jy, jm) {
  return (list || []).filter((x) => {
    const j = anJ(x.date);
    return j && j.jy === jy && j.jm === jm;
  });
}
function anSum(list) { return list.reduce((s, x) => s + (Number(x.amount) || 0), 0); }
// مبلغ کوتاه: ۱٫۲ میلیون، ۸۵۰ هزار
function anShort(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v) => toPersianDigits(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).replace(".", "٫");
  if (a >= 1e9) return sign + fmt(a / 1e9) + " میلیارد";
  if (a >= 1e6) return sign + fmt(a / 1e6) + " میلیون";
  if (a >= 1e3) return sign + fmt(a / 1e3) + " هزار";
  return sign + toPersianDigits(Math.round(a));
}
function anEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function anNiceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * p;
}
function anPct(n) { return toPersianDigits(Math.round(n)) + "٪"; }
function anDelta(cur, prev, higherIsGood, prevName) {
  if (!prev) return cur ? `<span class="an-delta">${prevName} صفر بود</span>` : `<span class="an-delta">—</span>`;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return `<span class="an-delta">مثل ${prevName}</span>`;
  const up = pct > 0;
  const good = up === higherIsGood;
  return `<span class="an-delta ${good ? "is-good" : "is-bad"}"><i>${up ? "▲" : "▼"}</i>${toPersianDigits(Math.abs(pct))}٪ ${up ? "بیشتر" : "کمتر"} از ${prevName}</span>`;
}
function anEmpty(msg) { return `<div class="an-empty">${msg}</div>`; }

// منحنی نرم بدون «بیرون‌زدگی» (monotone cubic — Fritsch–Carlson)؛ هرگز زیر صفر نمی‌رود
function anMonotonePath(pts) {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    dy[i] = pts[i + 1][1] - pts[i][1];
    m[i] = dx[i] ? dy[i] / dx[i] : 0;
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

// تولتیپ مشترک
function anTip(host, html, x) {
  let tip = host.querySelector(".an-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "an-tip";
    host.appendChild(tip);
  }
  if (html == null) { tip.classList.remove("show"); return; }
  tip.innerHTML = html;
  tip.classList.add("show");
  const w = tip.offsetWidth, hw = host.clientWidth;
  tip.style.left = Math.max(0, Math.min(hw - w, x - w / 2)) + "px";
  tip.style.top = -(tip.offsetHeight + 6) + "px";
}

function renderAnalysis() {
  const tab = document.getElementById("tab-analysis");
  if (!tab) return;
  const vm = viewedMonth;
  const pm = addMonthsJalali(vm.jy, vm.jm, -1);
  const monthName = JALALI_MONTHS[vm.jm - 1];
  const prevName = JALALI_MONTHS[pm.jm - 1];
  const isCurrent = isViewingCurrentMonth();

  const label = document.getElementById("anMonthLabel");
  if (label) label.textContent = `${monthName} ${toPersianDigits(vm.jy)}`;
  const nextBtn = document.getElementById("anNextMonth");
  if (nextBtn) nextBtn.disabled = isCurrent;
  const aiTitle = document.querySelector(".ai-card-head h2");
  if (aiTitle) aiTitle.textContent = `تحلیل هوشمند ${isCurrent ? "این ماه" : monthName}`;

  const inc = anMonthItems(state.incomes, vm.jy, vm.jm);
  const exp = anMonthItems(state.expenses, vm.jy, vm.jm);
  const pInc = anMonthItems(state.incomes, pm.jy, pm.jm);
  const pExp = anMonthItems(state.expenses, pm.jy, pm.jm);
  // ماه جاری هنوز تمام نشده؛ با همان چند روزِ اولِ ماه قبل مقایسه کن تا درصدها گمراه‌کننده نباشند
  const cutDay = isCurrent ? todayJalali().jd : 99;
  const upToCut = (list) => list.filter((x) => { const j = anJ(x.date); return j && j.jd <= cutDay; });
  const pIncSame = upToCut(pInc), pExpSame = upToCut(pExp);
  const cmpName = isCurrent ? `${toPersianDigits(cutDay)} روز اول ${prevName}` : prevName;
  // ۶ ماه منتهی به ماه دیده‌شده (برای اسپارک‌لاین‌ها و ستون‌ها)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonthsJalali(vm.jy, vm.jm, -i);
    months.push({ ...m, inc: anSum(anMonthItems(state.incomes, m.jy, m.jm)), exp: anSum(anMonthItems(state.expenses, m.jy, m.jm)) });
  }
  const ctx = { vm, pm, monthName, prevName, isCurrent, inc, exp, pInc, pExp, pIncSame, pExpSame, cmpName, months };

  [anRenderRings, anRenderKpis, anRenderCumulative, anRenderCategories, anRenderTrend, anRenderWeekdays, anRenderTop].forEach((fn) => {
    try { fn(ctx); } catch (e) { console.warn("analysis", fn.name, e); }
  });
  anSetupReveal();
}

// هر بخش وقتی وارد صفحه شد ظاهر می‌شود و نمودارهایش همان لحظه جان می‌گیرند
let _anObserver = null;
function anReduceMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
}
function anCountUp(el) {
  const target = Number(el.getAttribute("data-count"));
  const fmt = el.getAttribute("data-fmt");
  if (!isFinite(target)) return;
  const f = fmt === "pct" ? (v) => anPct(v) : (v) => anShort(v);
  const final = el.textContent;
  if (anReduceMotion() || Math.abs(target) < 1) { el.textContent = final; return; }
  const dur = 900, t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    el.textContent = t < 1 ? f(target * ease(t)) : final;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function anInView(el) {
  if (el.classList.contains("is-in")) return;
  el.classList.add("is-in");
  el.querySelectorAll("[data-count]").forEach(anCountUp);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll(".an-ring-arc").forEach((a) => { a.style.strokeDashoffset = a.getAttribute("data-off"); });
    el.querySelectorAll(".an-donut-seg[data-dash]").forEach((a) => { a.style.strokeDasharray = a.getAttribute("data-dash"); });
  }));
}
function anSetupReveal() {
  const tab = document.getElementById("tab-analysis");
  if (!tab) return;
  const secs = Array.from(tab.children).filter((el) => el.nodeType === 1);
  if (_anObserver) { _anObserver.disconnect(); _anObserver = null; }
  secs.forEach((el) => {
    el.classList.add("an-rv");
    el.classList.remove("is-in");
    el.style.removeProperty("--rv-d");
  });
  // تب پنهان است (رندر پس‌زمینه) — وقتی باز شد دوباره رندر می‌شود
  if (!tab.classList.contains("active")) return;
  if (anReduceMotion() || !("IntersectionObserver" in window)) { secs.forEach(anInView); return; }
  const root = document.getElementById("appScroll");
  _anObserver = new IntersectionObserver((entries) => {
    let k = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--rv-d", (k++ * 70) + "ms");
      anInView(e.target);
      _anObserver && _anObserver.unobserve(e.target);
    });
  }, { root: root && root.scrollHeight > root.clientHeight ? root : null, threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  secs.forEach((el) => _anObserver.observe(el));
}

// ---- ۱) حلقه‌ها (سبک Activity Rings آیفون)
function anRingSvg(rings) {
  const S = 200, C = S / 2, SW = 18, GAP = 4;
  let defs = "", body = "";
  rings.forEach((r, i) => {
    const rad = C - SW / 2 - 2 - i * (SW + GAP);
    const circ = 2 * Math.PI * rad;
    const p = Math.max(0, r.pct);
    const first = Math.min(p, 1);
    const over = Math.max(0, Math.min(p - 1, 1));
    body += `<circle cx="${C}" cy="${C}" r="${rad}" fill="none" stroke="${r.color}" stroke-opacity=".2" stroke-width="${SW}"/>`;
    if (p > 0) {
      body += `<circle class="an-ring-arc" cx="${C}" cy="${C}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${SW}" stroke-linecap="round"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}" data-off="${(circ * (1 - Math.max(first, 0.004))).toFixed(1)}"
        transform="rotate(-90 ${C} ${C})" style="transition-delay:${i * 0.12}s"/>`;
    }
    if (over > 0) {
      // دور دوم: کمی تیره‌تر با سایه‌ی سرِ حلقه، مثل وقتی هدف آیفون رد می‌شود
      defs += `<filter id="anRingShadow${i}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="#000" flood-opacity=".55"/></filter>`;
      body += `<circle class="an-ring-arc" cx="${C}" cy="${C}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${SW}" stroke-linecap="round"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}" data-off="${(circ * (1 - over)).toFixed(1)}"
        transform="rotate(-90 ${C} ${C})" filter="url(#anRingShadow${i})" style="transition-delay:${0.5 + i * 0.12}s"/>`;
    }
  });
  return `<svg viewBox="0 0 ${S} ${S}" class="an-rings-svg" role="img" aria-label="حلقه‌های ماه"><defs>${defs}</defs>${body}</svg>`;
}
function anRenderRings(c) {
  const host = document.getElementById("anRings");
  if (!host) return;
  const ti = anSum(c.inc), te = anSum(c.exp);
  const pi = anSum(c.pInc), pe = anSum(c.pExp);
  const rate = ti > 0 ? (ti - te) / ti : 0;
  const rings = [
    { key: "expense", label: "مخارج", color: AN_RING.expense, pct: pe ? te / pe : (te ? 1 : 0),
      value: anShort(te), count: te, fmt: "short", of: pe ? `از ${anShort(pe)} ${c.prevName}` : `${c.prevName} خرجی نداشت` },
    { key: "income", label: "درآمد", color: AN_RING.income, pct: pi ? ti / pi : (ti ? 1 : 0),
      value: anShort(ti), count: ti, fmt: "short", of: pi ? `از ${anShort(pi)} ${c.prevName}` : `${c.prevName} درآمدی نداشت` },
    { key: "save", label: "پس‌انداز", color: AN_RING.save, pct: Math.max(0, rate),
      value: ti > 0 ? anPct(rate * 100) : "—", count: ti > 0 ? Math.max(0, rate * 100) : null, fmt: "pct", of: ti > 0 ? (rate >= 0 ? "از درآمد این ماه" : "خرج بیشتر از درآمد") : "درآمدی ثبت نشده" }
  ];
  host.innerHTML = `
    <div class="an-rings-wrap">${anRingSvg(rings)}</div>
    <ul class="an-rings-legend">${rings.map((r) => `
      <li style="--rc:${r.color}">
        <span class="an-rl-label">${r.label}</span>
        <strong${r.count != null ? ` data-count="${r.count}" data-fmt="${r.fmt}"` : ""}>${r.value}</strong>
        <small>${r.of}${r.key !== "save" && r.pct ? `، ${anPct(r.pct * 100)}` : ""}</small>
      </li>`).join("")}
    </ul>`;
}

// ---- ۲) شاخص‌ها با اسپارک‌لاین ۶ ماه
function anSpark(values, color) {
  const W = 100, H = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (W - 4), H - 3 - (v / max) * (H - 6)]);
  const d = anMonotonePath(pts);
  const last = pts[pts.length - 1];
  return `<svg class="an-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="M${last[0]} ${last[1]}h0" stroke="${color}" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function anRenderKpis(c) {
  const el = document.getElementById("anKpis");
  if (!el) return;
  const ti = anSum(c.inc), te = anSum(c.exp);
  const pi = anSum(c.pIncSame), pe = anSum(c.pExpSame);
  const bal = ti - te;
  const monthLen = jalaaliMonthLength(c.vm.jy, c.vm.jm);
  const daysSoFar = c.isCurrent ? todayJalali().jd : monthLen;
  const daily = daysSoFar ? te / daysSoFar : 0;
  const forecast = c.isCurrent && daysSoFar < monthLen ? daily * monthLen : null;
  const incSeries = c.months.map((m) => m.inc);
  const expSeries = c.months.map((m) => m.exp);
  const balSeries = c.months.map((m) => Math.max(0, m.inc - m.exp));

  el.innerHTML = `
    <div class="an-kpi">
      <span class="an-kpi-label"><i style="background:${AN_INCOME}"></i>درآمد</span>
      <strong data-count="${ti}" data-fmt="short">${anShort(ti)}</strong>
      ${anDelta(ti, pi, true, c.cmpName)}
      ${anSpark(incSeries, AN_INCOME)}
    </div>
    <div class="an-kpi">
      <span class="an-kpi-label"><i style="background:${AN_EXPENSE}"></i>مخارج</span>
      <strong data-count="${te}" data-fmt="short">${anShort(te)}</strong>
      ${anDelta(te, pe, false, c.cmpName)}
      ${anSpark(expSeries, AN_EXPENSE)}
    </div>
    <div class="an-kpi">
      <span class="an-kpi-label"><i style="background:#5B86F2"></i>مانده</span>
      <strong class="${bal < 0 ? "is-neg" : ""}" data-count="${bal}" data-fmt="short">${anShort(bal)}</strong>
      <span class="an-delta">${ti > 0 ? (bal >= 0 ? `${anPct((bal / ti) * 100)} درآمد ماند` : "بیشتر از درآمد خرج شد") : "درآمدی ثبت نشده"}</span>
      ${anSpark(balSeries, "#5B86F2")}
    </div>
    <div class="an-kpi">
      <span class="an-kpi-label"><i style="background:#8A938F"></i>خرج روزانه</span>
      <strong data-count="${daily}" data-fmt="short">${anShort(daily)}</strong>
      <span class="an-delta">${forecast ? `پیش‌بینی آخر ماه: ${anShort(forecast)}` : `میانگین ${toPersianDigits(monthLen)} روز`}</span>
      <span class="an-kpi-foot">۶ ماه اخیر</span>
    </div>`;
  const foot = el.querySelector(".an-kpi-foot");
  if (foot) foot.outerHTML = anSpark(c.months.map((m) => m.exp / jalaaliMonthLength(m.jy, m.jm)), "#8A938F");
}

// ---- ۳) روند تجمعی خرج در ماه، در برابر ماه قبل (منحنی نرم + گرادیان)
function anCumulative(items, len) {
  const perDay = new Array(len + 1).fill(0);
  items.forEach((x) => { const j = anJ(x.date); if (j && j.jd <= len) perDay[j.jd] += Number(x.amount) || 0; });
  const out = [0];
  for (let d = 1; d <= len; d++) out[d] = out[d - 1] + perDay[d];
  return out;
}
function anRenderCumulative(c) {
  const host = document.getElementById("anCumChart");
  const note = document.getElementById("anCumNote");
  if (!host) return;
  const len = jalaaliMonthLength(c.vm.jy, c.vm.jm);
  const pLen = jalaaliMonthLength(c.pm.jy, c.pm.jm);
  const upto = c.isCurrent ? todayJalali().jd : len;
  const cur = anCumulative(c.exp, len);
  const prev = anCumulative(c.pExp, pLen);
  if (!c.exp.length && !c.pExp.length) {
    host.innerHTML = anEmpty("برای این ماه و ماه قبل خرجی ثبت نشده");
    if (note) note.textContent = "";
    return;
  }
  const W = host.clientWidth || 320, H = 200;
  const pad = { l: 6, r: 56, t: 16, b: 26 };
  const maxDays = Math.max(len, pLen);
  const maxV = anNiceMax(Math.max(cur[upto], prev[pLen], 1));
  const x = (d) => pad.l + ((d - 1) / (maxDays - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
  const pts = (arr, n) => { const p = []; for (let d = 1; d <= n; d++) p.push([x(d), y(arr[d])]); return p; };

  let grid = "";
  [0, 0.5, 1].forEach((f) => {
    const gy = y(maxV * f).toFixed(1);
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" class="an-grid"/>`;
    grid += `<text x="${W}" y="${(+gy + 4).toFixed(1)}" class="an-axis an-axis-y" text-anchor="start">${f ? anShort(maxV * f) : "۰"}</text>`;
  });
  let ticks = "";
  [1, 10, 20, maxDays].forEach((d) => {
    ticks += `<text x="${x(d).toFixed(1)}" y="${H - 6}" class="an-axis" text-anchor="middle">${toPersianDigits(d)}</text>`;
  });
  const curPts = pts(cur, upto);
  const curPath = anMonotonePath(curPts);
  const area = curPath + `L${x(upto).toFixed(1)} ${y(0).toFixed(1)}L${x(1).toFixed(1)} ${y(0).toFixed(1)}Z`;
  const endX = x(upto), endY = y(cur[upto]);

  host.innerHTML = `
    <div class="an-legend">
      <span><i style="background:${AN_EXPENSE}"></i>${c.isCurrent ? "این ماه" : c.monthName}</span>
      <span><i style="background:${AN_CONTEXT}"></i>${c.prevName}</span>
    </div>
    <div class="an-plot">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="روند تجمعی مخارج">
        <defs>
          <linearGradient id="anCumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${AN_EXPENSE}" stop-opacity=".28"/>
            <stop offset="100%" stop-color="${AN_EXPENSE}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}${ticks}
        <path d="${anMonotonePath(pts(prev, pLen))}" fill="none" stroke="${AN_CONTEXT}" stroke-width="2" stroke-linecap="round"/>
        <path d="${area}" fill="url(#anCumGrad)"/>
        <path class="an-draw" d="${curPath}" fill="none" stroke="${AN_EXPENSE}" stroke-width="2.4" stroke-linecap="round" pathLength="1"/>
        <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="9" fill="${AN_EXPENSE}" opacity=".18" class="an-pulse"/>
        <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="4.5" fill="${AN_EXPENSE}" stroke="#fff" stroke-width="2"/>
        <line class="an-cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
        <circle class="an-cross-dot" r="4.5" fill="${AN_EXPENSE}" stroke="#fff" stroke-width="2" visibility="hidden"/>
        <circle class="an-cross-dot2" r="4" fill="#AEB6B3" stroke="#fff" stroke-width="2" visibility="hidden"/>
      </svg>
    </div>`;

  if (note) {
    const same = prev[Math.min(upto, pLen)];
    const now = cur[upto];
    let txt = `${c.isCurrent ? "تا امروز" : "در کل ماه"} <b>${anShort(now)} تومان</b> خرج شده`;
    if (same > 0) {
      const pct = Math.round(((now - same) / same) * 100);
      txt += pct === 0 ? `؛ مثل ${c.prevName}.` : `؛ <b class="${pct > 0 ? "is-bad" : "is-good"}">${toPersianDigits(Math.abs(pct))}٪ ${pct > 0 ? "بیشتر" : "کمتر"}</b> از ${c.isCurrent ? "همین موقع در " : ""}${c.prevName}.`;
    } else txt += ".";
    note.innerHTML = txt;
  }

  const svg = host.querySelector("svg");
  const plot = host.querySelector(".an-plot");
  const cross = svg.querySelector(".an-cross");
  const dot = svg.querySelector(".an-cross-dot");
  const dot2 = svg.querySelector(".an-cross-dot2");
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width);
    let d = Math.round(1 + ((px - pad.l) / (W - pad.l - pad.r)) * (maxDays - 1));
    d = Math.max(1, Math.min(maxDays, d));
    const cx = x(d);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    let html = `<b>روز ${toPersianDigits(d)}</b>`;
    if (d <= upto) {
      dot.setAttribute("cx", cx); dot.setAttribute("cy", y(cur[d])); dot.setAttribute("visibility", "visible");
      html += `<span><i style="background:${AN_EXPENSE}"></i>${c.isCurrent ? "این ماه" : c.monthName}: ${fmtAmount(cur[d])}</span>`;
    } else dot.setAttribute("visibility", "hidden");
    if (d <= pLen) {
      dot2.setAttribute("cx", cx); dot2.setAttribute("cy", y(prev[d])); dot2.setAttribute("visibility", "visible");
      html += `<span><i style="background:${AN_CONTEXT}"></i>${c.prevName}: ${fmtAmount(prev[d])}</span>`;
    } else dot2.setAttribute("visibility", "hidden");
    anTip(plot, html, cx * (r.width / W));
  };
  const onLeave = () => {
    [cross, dot, dot2].forEach((n) => n.setAttribute("visibility", "hidden"));
    anTip(plot, null);
  };
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerdown", onMove);
  svg.addEventListener("pointerleave", onLeave);
}

// ---- ۴) دسته‌ها: دونات حلقه‌ای + فهرست
// رنگ هر دسته: رنگ خود کاربر اگر تعریف شده؛ وگرنه (یا اگر تکراری بود) رنگ آزادِ بعدی از پالت
function anCategoryColors(names) {
  const used = new Set();
  const out = {};
  names.forEach((name) => {
    const own = (state.categories || []).find((c) => c.name === name);
    let color = own ? catColor(name) : null;
    if (!color || used.has(color.toUpperCase())) {
      color = CATEGORY_COLORS.find((cc) => !used.has(cc.toUpperCase())) || "#AEB6B3";
    }
    used.add(color.toUpperCase());
    out[name] = color;
  });
  return out;
}

function anRenderCategories(c) {
  const host = document.getElementById("anCatChart");
  if (!host) return;
  const total = anSum(c.exp);
  if (!total) { host.innerHTML = anEmpty("در این ماه خرجی ثبت نشده"); return; }
  const by = {}, pby = {};
  c.exp.forEach((x) => { const k = x.category || "سایر"; by[k] = (by[k] || 0) + (Number(x.amount) || 0); });
  c.pExpSame.forEach((x) => { const k = x.category || "سایر"; pby[k] = (pby[k] || 0) + (Number(x.amount) || 0); });
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const colors = anCategoryColors(sorted.slice(0, 6).map((r) => r[0]));
  let rows = sorted.map(([name, amt]) => ({ name, amt, prev: pby[name] || 0, color: colors[name] || "#AEB6B3", icon: catIcon(name) }));
  if (rows.length > 6) {
    const rest = rows.slice(5);
    rows = rows.slice(0, 5);
    rows.push({ name: "سایر دسته‌ها", amt: rest.reduce((s, r) => s + r.amt, 0), prev: rest.reduce((s, r) => s + r.prev, 0), color: "#AEB6B3", icon: "package" });
  }
  // دونات با فاصله‌ی ۲px بین قطعه‌ها و سرهای گرد
  const S = 180, C = S / 2, R = 70, SW = 20;
  const circ = 2 * Math.PI * R;
  const gap = rows.length > 1 ? 4 : 0;
  let acc = 0, arcs = "";
  rows.forEach((r, i) => {
    const len = (r.amt / total) * circ;
    // سرِ گرد نیم‌پهنای خط را به هر طرف اضافه می‌کند؛ پس از طول کم می‌کنیم تا فاصله بماند
    const round = rows.length === 1 || len - gap - SW > 1;
    const dash = rows.length === 1 ? circ : Math.max(0.5, round ? len - gap - SW : len - gap);
    const off = rows.length === 1 ? 0 : acc + gap / 2 + (round ? SW / 2 : 0);
    arcs += `<circle class="an-donut-seg" data-i="${i}" cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${r.color}" stroke-width="${SW}"
      stroke-linecap="${round && rows.length > 1 ? "round" : "butt"}" stroke-dasharray="0 ${circ.toFixed(1)}" data-dash="${dash.toFixed(1)} ${circ.toFixed(1)}" style="--i:${i}"
      stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${C} ${C})"/>`;
    acc += len;
  });
  const top = rows[0];
  host.innerHTML = `
    <div class="an-donut">
      <div class="an-donut-fig">
        <svg viewBox="0 0 ${S} ${S}" role="img" aria-label="سهم دسته‌ها">
          <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#F3EFE7" stroke-width="${SW}"/>${arcs}
        </svg>
        <div class="an-donut-center"><small id="anDonutLabel">کل مخارج</small><strong id="anDonutValue" data-count="${total}" data-fmt="short">${anShort(total)}</strong></div>
      </div>
      <p class="an-note an-donut-note">بیشترین سهم: <b>${anEsc(top.name)}</b> با ${anPct((top.amt / total) * 100)} از خرج ${c.isCurrent ? "این ماه" : c.monthName}</p>
    </div>
    <div class="an-cat-list">${rows.map((r, i) => {
      const pct = (r.amt / total) * 100;
      let delta = "";
      if (r.prev > 0) {
        const d = Math.round(((r.amt - r.prev) / r.prev) * 100);
        if (Math.abs(d) >= 5) delta = `<span class="an-cat-delta ${d > 0 ? "is-bad" : "is-good"}">${d > 0 ? "▲" : "▼"}${toPersianDigits(Math.abs(d))}٪</span>`;
      } else delta = `<span class="an-cat-delta">جدید</span>`;
      return `<button type="button" class="an-cat" data-i="${i}" style="--cc:${r.color};--i:${i}">
        <span class="an-cat-icon">${iconSpanHTML(r.icon, `color:${r.color}`)}</span>
        <span class="an-cat-main">
          <span class="an-cat-top"><span class="an-cat-name">${anEsc(r.name)}</span><span class="an-cat-val">${anShort(r.amt)}</span></span>
          <span class="an-cat-track"><span class="an-cat-bar" style="width:${Math.max(2, pct).toFixed(1)}%"></span></span>
          <span class="an-cat-sub"><em>${anPct(pct)}</em>${delta}</span>
        </span>
      </button>`;
    }).join("")}</div>
    <p class="an-foot">▲▼ تغییر نسبت به ${c.cmpName}</p>`;

  const segs = host.querySelectorAll(".an-donut-seg");
  const items = host.querySelectorAll(".an-cat");
  const lab = host.querySelector("#anDonutLabel"), val = host.querySelector("#anDonutValue");
  const focus = (i) => {
    segs.forEach((s) => s.classList.toggle("is-dim", i != null && +s.dataset.i !== i));
    items.forEach((s) => s.classList.toggle("is-active", i != null && +s.dataset.i === i));
    if (i == null) { lab.textContent = "کل مخارج"; val.textContent = anShort(total); }
    else { lab.textContent = rows[i].name; val.textContent = anPct((rows[i].amt / total) * 100); }
  };
  let current = null;
  const toggle = (i) => { current = current === i ? null : i; focus(current); };
  segs.forEach((s) => s.addEventListener("click", () => toggle(+s.dataset.i)));
  items.forEach((s) => s.addEventListener("click", () => toggle(+s.dataset.i)));
}

// ---- ۵) ۶ ماه اخیر: ستون‌های کپسولی درآمد/مخارج
function anRenderTrend(c) {
  const host = document.getElementById("anTrendChart");
  if (!host) return;
  const months = c.months;
  if (months.every((m) => !m.inc && !m.exp)) { host.innerHTML = anEmpty("در ۶ ماه اخیر تراکنشی ثبت نشده"); return; }
  const W = host.clientWidth || 320, H = 210;
  const pad = { l: 4, r: 54, t: 12, b: 28 };
  const maxV = anNiceMax(Math.max(...months.map((m) => Math.max(m.inc, m.exp)), 1));
  const plotW = W - pad.l - pad.r;
  const gw = plotW / months.length;
  const bw = Math.max(6, Math.min(14, (gw - 12) / 2));
  const y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
  const base = y(0);
  let _anBarN = 0;
  const cap = (bx, v, grad) => {
    if (v <= 0) return `<rect x="${bx}" y="${base - 3}" width="${bw}" height="3" rx="1.5" fill="#E7E2D8"/>`;
    const h = Math.max(bw, base - y(v));
    return `<rect class="an-bar-grow" style="animation-delay:${(0.05 * _anBarN++).toFixed(2)}s" x="${bx}" y="${(base - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="${bw / 2}" fill="url(#${grad})"/>`;
  };
  let svg = `<defs>
    <linearGradient id="anGInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19B39A"/><stop offset="1" stop-color="${AN_INCOME}"/></linearGradient>
    <linearGradient id="anGExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4684B"/><stop offset="1" stop-color="${AN_EXPENSE}"/></linearGradient>
  </defs>`;
  [0, 0.5, 1].forEach((f) => {
    const gy = y(maxV * f).toFixed(1);
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" class="an-grid"/>`;
    svg += `<text x="${W}" y="${(+gy + 4).toFixed(1)}" class="an-axis an-axis-y" text-anchor="start">${f ? anShort(maxV * f) : "۰"}</text>`;
  });
  months.forEach((m, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const isCur = i === months.length - 1;
    svg += `<g class="an-trend-g ${isCur ? "is-cur" : ""}">`;
    svg += cap(cx - bw - 2, m.inc, "anGInc");
    svg += cap(cx + 2, m.exp, "anGExp");
    svg += `<text x="${cx}" y="${H - 8}" class="an-axis ${isCur ? "an-axis-strong" : ""}" text-anchor="middle">${JALALI_MONTHS[m.jm - 1]}</text>`;
    svg += `<rect class="an-hit" data-i="${i}" x="${pad.l + gw * i}" y="0" width="${gw}" height="${H}" fill="transparent"/></g>`;
  });
  const avgSave = months.filter((m) => m.inc > 0);
  const saveTxt = avgSave.length
    ? `میانگین پس‌انداز ماهانه: <b>${anShort(avgSave.reduce((s, m) => s + (m.inc - m.exp), 0) / avgSave.length)} تومان</b>`
    : "";
  host.innerHTML = `
    <div class="an-legend">
      <span><i style="background:${AN_INCOME}"></i>درآمد</span>
      <span><i style="background:${AN_EXPENSE}"></i>مخارج</span>
    </div>
    <div class="an-plot"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="درآمد و مخارج ۶ ماه اخیر">${svg}</svg></div>
    ${saveTxt ? `<p class="an-foot">${saveTxt}</p>` : ""}`;
  const plot = host.querySelector(".an-plot");
  const svgEl = plot.querySelector("svg");
  const show = (e) => {
    const hit = e.target.closest(".an-hit");
    if (!hit) return;
    const i = +hit.getAttribute("data-i");
    const m = months[i];
    svgEl.querySelectorAll(".an-trend-g").forEach((g, j) => g.classList.toggle("is-dim", j !== i));
    const r = svgEl.getBoundingClientRect();
    anTip(plot, `<b>${JALALI_MONTHS[m.jm - 1]} ${toPersianDigits(m.jy)}</b>
      <span><i style="background:${AN_INCOME}"></i>درآمد: ${fmtAmount(m.inc)}</span>
      <span><i style="background:${AN_EXPENSE}"></i>مخارج: ${fmtAmount(m.exp)}</span>
      <span>مانده: ${fmtAmount(m.inc - m.exp)}</span>`, (pad.l + gw * i + gw / 2) * (r.width / W));
  };
  svgEl.addEventListener("pointerover", show);
  svgEl.addEventListener("pointerdown", show);
  svgEl.addEventListener("pointerleave", () => {
    svgEl.querySelectorAll(".an-trend-g").forEach((g) => g.classList.remove("is-dim"));
    anTip(plot, null);
  });
}

// ---- ۶) خرج در روزهای هفته (میانگین ۹۰ روز منتهی به ماه دیده‌شده)
function anRenderWeekdays(c) {
  const host = document.getElementById("anWeekChart");
  if (!host) return;
  const len = jalaaliMonthLength(c.vm.jy, c.vm.jm);
  const endJ = c.isCurrent ? todayJalali() : { jy: c.vm.jy, jm: c.vm.jm, jd: len };
  const g = toGregorian(endJ.jy, endJ.jm, endJ.jd);
  const end = new Date(g.gy, g.gm - 1, g.gd);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 89);
  const sums = new Array(7).fill(0);
  let n = 0;
  (state.expenses || []).forEach((x) => {
    const [gy, gm, gd] = String(x.date || "").split("-").map(Number);
    if (!gy) return;
    const d = new Date(gy, gm - 1, gd);
    if (d < start || d > end) return;
    sums[(d.getDay() + 1) % 7] += Number(x.amount) || 0; // 0 = شنبه
    n++;
  });
  if (!n) { host.innerHTML = anEmpty("در ۹۰ روز اخیر خرجی ثبت نشده"); return; }
  const counts = new Array(7).fill(0);
  for (let i = 0; i < 90; i++) counts[(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getDay() + 1) % 7]++;
  const avg = sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
  const maxI = avg.indexOf(Math.max(...avg));
  const max = avg[maxI] || 1;
  const mean = avg.reduce((s, v) => s + v, 0) / 7;
  host.innerHTML = `
    <p class="an-note">بیشترین خرج معمولاً <b>${AN_WEEKDAYS[maxI]}</b>‌ها: میانگین <b>${anShort(avg[maxI])} تومان</b></p>
    <div class="an-week" style="--mean:${((mean / max) * 100).toFixed(1)}">
      <span class="an-week-mean"><em>میانگین</em></span>
      ${avg.map((v, i) => `
      <div class="an-week-col" style="--i:${i}" title="${AN_WEEKDAYS[i]}: میانگین ${fmtAmount(v)} تومان">
        <div class="an-week-track"><div class="an-week-bar ${i === maxI ? "is-max" : ""}" style="height:${Math.max(4, (v / max) * 100).toFixed(1)}%"></div></div>
        <span>${AN_WEEKDAYS_SHORT[i]}</span>
      </div>`).join("")}
    </div>
    <p class="an-foot">میانگین خرج هر روز هفته در ۹۰ روز اخیر</p>`;
}

// ---- ۷) بزرگ‌ترین خرج‌های ماه
function anRenderTop(c) {
  const host = document.getElementById("anTopList");
  if (!host) return;
  const top = c.exp.slice().sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5);
  if (!top.length) { host.innerHTML = anEmpty("در این ماه خرجی ثبت نشده"); return; }
  const total = anSum(c.exp);
  host.innerHTML = top.map((x, i) => {
    const j = anJ(x.date);
    const cat = x.category || "سایر";
    const color = catColor(cat);
    return `<div class="an-top-row" style="--i:${i}">
      <span class="an-top-rank">${toPersianDigits(i + 1)}</span>
      <span class="an-top-icon" style="background:${color}22">${iconSpanHTML(catIcon(cat), `color:${color}`)}</span>
      <span class="an-top-body">
        <b>${anEsc(x.note || cat)}</b>
        <small>${x.note ? anEsc(cat) + "، " : ""}${j ? toPersianDigits(j.jd) + " " + JALALI_MONTHS[j.jm - 1] : ""}</small>
      </span>
      <span class="an-top-amt">${fmtAmount(x.amount)}<small>${anPct((x.amount / total) * 100)} از کل</small></span>
    </div>`;
  }).join("");
}

(function setupAnalysisNav() {
  const prev = document.getElementById("anPrevMonth");
  const next = document.getElementById("anNextMonth");
  let swapping = false;
  const swapMonth = (delta) => {
    if (swapping) return;
    if (delta > 0 && isViewingCurrentMonth()) return;
    const tab = document.getElementById("tab-analysis");
    const go = () => {
      try { dashboardMode = "month"; } catch (_) {}
      viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, delta);
      applyViewedMonthState();
      if (tab) tab.classList.remove("an-out", "an-out-next", "an-out-prev");
      swapping = false;
    };
    if (!tab || anReduceMotion()) { go(); return; }
    swapping = true;
    tab.classList.add("an-out", delta > 0 ? "an-out-next" : "an-out-prev");
    setTimeout(go, 200);
  };
  if (prev) prev.addEventListener("click", () => swapMonth(-1));
  if (next) next.addEventListener("click", () => swapMonth(1));
  let rt = null;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const t = document.getElementById("tab-analysis");
      if (t && t.classList.contains("active")) renderAnalysis();
    }, 150);
  });
})();

// ---------- AI analysis ----------
// مسیرها: 1) llm7.io رایگان بدون کلید (در دسترس از ایران)
//         2) Worker / Workers AI
//         3) تحلیل محلی

function fmtAiToman(n) {
  const v = Math.round(Math.abs(n || 0));
  return v.toLocaleString("fa-IR") + " تومان";
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function enrichMonthCategories(monthObj, jy, jm) {
  if (monthObj.categories && monthObj.categories.length) return monthObj;
  if (typeof state === "undefined" || !state.entries) return monthObj;
  const byCat = {};
  state.entries.forEach((e) => {
    if (e.type !== "expense") return;
    if (e.jy !== jy || e.jm !== jm) return;
    const name = e.category || "سایر";
    byCat[name] = (byCat[name] || 0) + (Number(e.amount) || 0);
  });
  monthObj.categories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount }));
  return monthObj;
}

function buildAnalysisPrompt(thisMonth, lastMonth) {
  const tm = thisMonth || {};
  const lm = lastMonth || {};
  const cats = (tm.categories || []).slice(0, 6)
    .map((c) => `${c.name}: ${fmtAiToman(c.amount)}`)
    .join("، ");
  return `تو یک مشاور مالی خودمونی، شوخ و صادق برای اپ «دخل و خرج» هستی.
لحن: دوستانه + کمی طنز سبک (بدون توهین و بدون اغراق آزاردهنده).
خروجی: ۵ تا ۸ جمله فارسی، کوتاه و خوانا.
حتماً این‌ها را پوشش بده:
1) جمع‌بندی وضعیت این ماه (مانده مثبت/منفی)
2) مقایسه با ماه قبل اگر معنی‌دار است
3) اشاره به ۱–۲ دستهٔ پرخرج
4) یک پیشنهاد عملی و واقعی برای ماه بعد
5) یک جملهٔ طنزآمیز مرتبط با خرج/پس‌انداز
بدون عنوان، بدون بولت، بدون اموجی زیاد.

داده این ماه:
درآمد ${fmtAiToman(tm.totalIncome)}، مخارج ${fmtAiToman(tm.totalExpense)}، مانده ${fmtAiToman((tm.totalIncome || 0) - (tm.totalExpense || 0))}
دسته‌ها: ${cats || "ثبت نشده"}

ماه قبل:
درآمد ${fmtAiToman(lm.totalIncome)}، مخارج ${fmtAiToman(lm.totalExpense)}`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildLocalAnalysis(thisMonth, lastMonth) {
  const inc = Number(thisMonth.totalIncome) || 0;
  const exp = Number(thisMonth.totalExpense) || 0;
  const bal = inc - exp;
  const lInc = Number(lastMonth.totalIncome) || 0;
  const lExp = Number(lastMonth.totalExpense) || 0;
  const lBal = lInc - lExp;
  const cats = Array.isArray(thisMonth.categories)
    ? [...thisMonth.categories].sort((a, b) => (b.amount || 0) - (a.amount || 0))
    : [];
  const top = cats[0];
  const top2 = cats[1];
  const topShare = exp > 0 && top ? Math.round((top.amount / exp) * 100) : 0;
  const expCh = (lExp > 0) ? ((exp - lExp) / Math.abs(lExp)) * 100 : null;
  const incCh = (lInc > 0) ? ((inc - lInc) / Math.abs(lInc)) * 100 : null;
  const ratio = inc > 0 ? exp / inc : null;
  const lines = [];

  if (inc === 0 && exp === 0) {
    return pick([
      "این ماه هنوز صفحه‌ات مثل یخچال بعد از مهمونی خالیه! چند تا دخل و خرج ثبت کن تا بتونم برات تحلیل خودمونی بدم.",
      "داده‌ای برای تحلیل نیست. اول تراکنش‌ها رو بنویس، بعد برمی‌گردم با گزارش مخصوص خودت."
    ]);
  }

  // وضعیت کلی با طنز ملایم
  if (bal > 0) {
    lines.push(pick([
      `خبر خوب: این ماه حدود ${fmtAiToman(bal)} توی جیب‌ت مونده — انگار یه دور از خرج‌های الکی جان سالم به در بردی.`,
      `مانده‌ات حدود ${fmtAiToman(bal)} مثبته. کیف پولت این ماه نفس راحتی کشید.`,
      `این ماه ${fmtAiToman(bal)} جلو هستی. نادره، ولی قشنگه؛ مراقب باش ماه بعد جبرانش نکنی!`
    ]));
  } else if (bal < 0) {
    lines.push(pick([
      `این ماه حدود ${fmtAiToman(Math.abs(bal))} کسری آوردی — دخل دویده، خرج پرواز کرده.`,
      `متأسفانه تراز این ماه منفیه: حدود ${fmtAiToman(Math.abs(bal))} بیشتر از درآمدت خرج شده.`,
      `حساب‌کتاب می‌گه حدود ${fmtAiToman(Math.abs(bal))} از دخل جلو زدی. نگران نباش، قابل ترمیمه.`
    ]));
  } else {
    lines.push("این ماه دخل و خرج تقریباً سر به سر بودن؛ نه جشن، نه عزا.");
  }

  // درآمد و هزینه خام
  if (inc > 0 || exp > 0) {
    lines.push(`جمع درآمد ${fmtAiToman(inc)} و جمع مخارج ${fmtAiToman(exp)} بوده.`);
  }

  // نسبت خرج به درآمد
  if (ratio !== null) {
    if (ratio > 1.05) {
      lines.push(pick([
        "بیشتر از چیزی که اومده خرج شده؛ ماه بعد بهتره قبل از خریدِ ناگهانی یک نفس عمیق بکشی.",
        "نسبت خرج به درآمد بالاست. یعنی دخل هنوز حرف اول را نمی‌زند."
      ]));
    } else if (ratio > 0.85) {
      lines.push("بخش زیادی از درآمدت صرف هزینه‌ها شده؛ فضای پس‌انداز کمی تنگ شده.");
    } else if (ratio < 0.55) {
      lines.push(pick([
        "آفرین — بخش خوبی از درآمدت خرج نشده. این همون جاییه که پس‌انداز شکل می‌گیره.",
        "مخارج نسبت به درآمدت کنترل‌شده‌ست؛ دستت درد نکنه!"
      ]));
    }
  }

  // مقایسه با ماه قبل
  if (expCh !== null) {
    const abs = Math.abs(Math.round(expCh));
    if (expCh > 15) {
      lines.push(pick([
        `مخارج نسبت به ماه قبل حدود ${abs}٪ بیشتر شده؛ انگار این ماه فروشگاه‌ها تخفیف ویژه فقط برای تو داشتن.`,
        `خرج‌ها حدود ${abs}٪ از ماه قبل بالاتر رفته. بد نیست بدونی پول کجا پریده.`
      ]));
    } else if (expCh < -15) {
      lines.push(pick([
        `خبر شیرین: مخارج حدود ${abs}٪ کمتر از ماه قبله. داری رو فرم می‌ای!`,
        `حدود ${abs}٪ کمتر خرج کردی نسبت به ماه قبل. این روند رو نگه دار.`
      ]));
    }
  }
  if (incCh !== null) {
    const abs = Math.abs(Math.round(incCh));
    if (incCh > 15) lines.push(`درآمدت هم حدود ${abs}٪ نسبت به ماه قبل رشد داشته.`);
    else if (incCh < -15) lines.push(`درآمد نسبت به ماه قبل حدود ${abs}٪ کمتر شده؛ اگر موقتی نیست، روی منبع درآمد وقت بذار.`);
  }

  // دسته‌ها
  if (top && topShare >= 40) {
    lines.push(pick([
      `قهرمان بی‌رقیب هزینه‌ها «${top.name}» بوده با حدود ${topShare}٪ از کل مخارج (${fmtAiToman(top.amount)}). اینجا باید ذره‌بین بذاری.`,
      `تقریباً ${topShare}٪ خرج‌ها رفته سمت «${top.name}». اگه قراره جایی کم کنی، از همین‌جا شروع کن.`
    ]));
  } else if (top) {
    let catLine = `بزرگ‌ترین هزینه مربوط به «${top.name}» با حدود ${fmtAiToman(top.amount)} بوده`;
    if (top2) catLine += ` و بعدش «${top2.name}»`;
    catLine += ".";
    lines.push(catLine);
  }

  // پیشنهاد عملی
  if (bal < 0) {
    if (top) {
      const cut = Math.max(50000, Math.round(Math.min(top.amount * 0.12, Math.abs(bal)) / 10000) * 10000);
      lines.push(`پیشنهاد خودمونی: ماه بعد از «${top.name}» حدود ${fmtAiToman(cut)} کم کن؛ هم تراز بهتر می‌شه، هم عذاب وجدان کمتر.`);
    } else {
      lines.push("پیشنهاد: برای هزینه‌های غیراضطراری یک سقف هفتگی بذار و بهش پایبند بمون.");
    }
  } else if (bal > 0) {
    const save = Math.max(50000, Math.round(bal * 0.25 / 10000) * 10000);
    lines.push(pick([
      `پیشنهاد: از این مانده حدود ${fmtAiToman(save)} را «لمس‌نکردنی» کنار بذار — قبل از اینکه وسوسه بشه بره.`,
      `ایده خوب: ${fmtAiToman(save)} از مانده را به پس‌انداز یا پرداخت بدهی اختصاص بده، نه خرید هیجانی.`
    ]));
  } else {
    lines.push("پیشنهاد: ماه بعد یک هدف کوچک عددی برای پس‌انداز تعیین کن تا از حالت سر‌به‌سر بیای بیرون.");
  }

  // جمله پایانی طنز
  lines.push(pick([
    "یادت باشه: پول مثل جوک می‌مونه؛ اگه نتونی نگهش داری، زود تموم می‌شه.",
    "جمع‌بندی با لبخند: دخل را جدی بگیر، خرج را هوشمند، و رسیدها را فراموش نکن.",
    "و حرف آخر: ثبت کردن تراکنش‌ها نصف راه کنترله؛ نصف دیگه‌ش نه گفتن به خریدهای «فقط این یکی» است.",
    "اگر این ماه سخت گذشت، ماه بعد با یک سقف مشخص برای تفریح و خوراک بیرون معمولاً آرام‌تر می‌شه."
  ]));

  return lines.join(" ");
}


function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const opts = Object.assign({}, options || {}, { signal: controller.signal });
  return fetch(url, opts).finally(() => clearTimeout(timer));
}

async function analyzeViaLlm7(prompt) {
  const models = ["gpt-oss", "codestral-latest"];
  for (const model of models) {
    try {
      const res = await fetchWithTimeout("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a witty, friendly Persian financial coach. Reply only in Persian. Be concise, practical, and lightly humorous without being rude." },
            { role: "user", content: prompt }
          ],
          max_tokens: 400,
          temperature: 0.7
        })
      }, 6000);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const text = data && data.choices && data.choices[0] && data.choices[0].message
        ? String(data.choices[0].message.content || "").trim()
        : "";
      if (text) return { summary: text, model, provider: "llm7" };
    } catch (_) {}
  }
  return null;
}

async function analyzeViaWorker(thisMonth, lastMonth) {
  if (!CONFIG.WORKER_URL || CONFIG.WORKER_URL.includes("YOUR-SUBDOMAIN")) return null;
  try {
    const res = await fetchWithTimeout(`${CONFIG.WORKER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thisMonth, lastMonth })
    }, 8000);
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.summary) {
      return { summary: String(data.summary).trim(), provider: data.provider || "worker" };
    }
  } catch (_) {}
  return null;
}

function setupAiAnalyzeButton(btnId, resultId) {
  const btn = document.getElementById(btnId);
  const resultBox = document.getElementById(resultId);
  if (!btn || !resultBox) return;
  let cooldownUntil = 0;
  let running = false;

  async function runAnalyze() {
    if (running) return;
    const now = Date.now();
    if (now < cooldownUntil) {
      const sec = Math.ceil((cooldownUntil - now) / 1000);
      resultBox.style.display = "";
      resultBox.innerHTML = `<div class="ai-result-error">لطفاً ${sec} ثانیه صبر کن.</div>`;
      return;
    }
    running = true;
    btn.disabled = true;
    resultBox.style.display = "";
    resultBox.innerHTML = `<div class="ai-result-loading"><span class="ai-spin"></span>در حال تحلیل این ماه...</div>`;

    // اطمینان از دیده شدن نتیجه
    try {
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (_) {}

    try {
      const base = (typeof viewedMonth === "object" && viewedMonth && viewedMonth.jy)
        ? viewedMonth
        : todayJalali();
      const lastM = addMonthsJalali(base.jy, base.jm, -1);
      let thisMonth = computeMonthTotals(base.jy, base.jm);
      let lastMonth = computeMonthTotals(lastM.jy, lastM.jm);
      thisMonth = enrichMonthCategories(thisMonth, base.jy, base.jm);
      lastMonth = enrichMonthCategories(lastMonth, lastM.jy, lastM.jm);
      const prompt = buildAnalysisPrompt(thisMonth, lastMonth);

      // اول محلی فوری، بعد اگر LLM جواب داد جایگزین می‌شود
      const localSummary = buildLocalAnalysis(thisMonth, lastMonth);
      resultBox.innerHTML = `<div class="ai-result-text">${localSummary.replace(/\n/g, "<br>")}</div>`;

      let out = null;
      try { out = await analyzeViaLlm7(prompt); } catch (_) {}
      if (!out) {
        try { out = await analyzeViaWorker(thisMonth, lastMonth); } catch (_) {}
      }
      if (out && out.summary) {
        resultBox.innerHTML = `<div class="ai-result-text">${out.summary.replace(/\n/g, "<br>")}</div>`;
      }

      // insights زیر نتیجه
      try {
        if (typeof renderAnalysis === "function") renderAnalysis();
      } catch (_) {}

      cooldownUntil = Date.now() + 4000;
    } catch (e) {
      resultBox.innerHTML = `<div class="ai-result-error">تحلیل انجام نشد. دوباره امتحان کن.</div>`;
    } finally {
      running = false;
      btn.disabled = false;
      // دکمه را مخفی نکن — همیشه قابل کلیک بماند
      btn.style.display = "";
    }
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    runAnalyze();
  });

  // اکسپوز برای ستاره شناور
  window._runAiAnalyze = runAnalyze;
}
setupAiAnalyzeButton("btnAiAnalyze", "aiAnalysisResult");

// ---------- Sync ----------
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Returns true if the code already has data stored on the server (i.e. it's taken).
// If the server can't be reached, we can't be sure — treat as "unknown" (null) so
// the caller can decide not to block the user over a network hiccup.
async function isCodeTaken(code) {
  if (CONFIG.WORKER_URL.includes("YOUR-SUBDOMAIN")) return false;
  try {
    const res = await fetch(`${CONFIG.WORKER_URL}/data?code=${code}`);
    if (res.status === 404) return false;
    if (res.ok) return true;
    return null;
  } catch (e) {
    return null;
  }
}

// Generates a random 6-digit code that isn't already in use on the server.
async function genUniqueCode() {
  const MAX_ATTEMPTS = 8;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = genCode();
    const taken = await isCodeTaken(candidate);
    if (taken === false) return candidate; // confirmed free
    if (taken === null) return candidate; // couldn't reach server — don't block the user
    // taken === true → loop and try another code
  }
  // extremely unlikely fallback after MAX_ATTEMPTS collisions
  return genCode();
}

function refreshSyncUI() {
  const dot = document.getElementById("syncDot");
  const label = document.getElementById("syncLabel");
  const codeDisplay = document.getElementById("syncCodeDisplay");
  if (state.syncCode) {
    dot.classList.add("linked");
    label.textContent = "متصل";
    codeDisplay.textContent = toPersianDigits(state.syncCode);
  } else {
    dot.classList.remove("linked");
    label.textContent = "محلی";
    codeDisplay.textContent = "—";
  }
}

document.getElementById("syncStatusBtn").addEventListener("click", () => switchTab("settings"));

document.getElementById("btnGenerateCode").addEventListener("click", async () => {
  const btn = document.getElementById("btnGenerateCode");
  btn.disabled = true;
  setSyncMsg("در حال ساخت کد...", false);
  state.syncCode = await genUniqueCode();
  saveState({ sync: false });
  refreshSyncUI();
  await pushToServer();
  setSyncMsg("", false);
  btn.disabled = false;
});

document.getElementById("btnCopyCode").addEventListener("click", async () => {
  if (!state.syncCode) return;
  try {
    await navigator.clipboard.writeText(state.syncCode);
    setSyncMsg("کد کپی شد", false);
  } catch (e) { setSyncMsg("کپی نشد، دستی کپی کن", true); }
});

document.getElementById("btnJoinCode").addEventListener("click", async () => {
  const code = normalizeDigits(document.getElementById("joinCodeInput").value.trim());
  if (!/^\d{6}$/.test(code)) { setSyncMsg("کد باید ۶ رقم باشه", true); return; }
  setSyncMsg("در حال اتصال...", false);
  const remote = await pullFromServer(code);
  if (remote) {
    state = { ...remote, syncCode: code };
    saveState({ sync: false });
    refreshSyncUI();
    setSyncMsg("متصل شد و اطلاعات همگام شد", false);
  } else {
    state.syncCode = code;
    saveState({ sync: false });
    refreshSyncUI();
    await pushToServer();
    setSyncMsg("متصل شد", false);
  }
});

document.getElementById("btnSyncNow").addEventListener("click", async () => {
  if (!state.syncCode) { setSyncMsg("اول یک کد بساز یا وارد کن", true); return; }
  setSyncMsg("در حال همگام‌سازی...", false);
  await pushToServer();
  setSyncMsg("همگام‌سازی شد", false);
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (!confirm("همه درآمدها، مخارج و برچسب‌های این دستگاه حذف بشه؟ این کار برگشت‌ناپذیره.")) return;
  const keepCode = state.syncCode;
  state = { incomes: [], expenses: [], categories: DEFAULT_CATEGORIES.slice(), syncCode: keepCode, profile: { name: null, avatar: null }, updatedAt: Date.now() };
  saveState();
  refreshSyncUI();
});

function setSyncMsg(text, isError) {
  const el = document.getElementById("syncMsg");
  el.textContent = text;
  el.classList.toggle("error", !!isError);
}

let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToServer, 1200);
}

async function pushToServer() {
  if (!state.syncCode || CONFIG.WORKER_URL.includes("YOUR-SUBDOMAIN")) return;
  try {
    await fetch(`${CONFIG.WORKER_URL}/data?code=${state.syncCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
  } catch (e) { setSyncMsg("همگام‌سازی ناموفق بود، دوباره امتحان کن", true); }
}

async function pullFromServer(code) {
  if (CONFIG.WORKER_URL.includes("YOUR-SUBDOMAIN")) return null;
  try {
    const res = await fetch(`${CONFIG.WORKER_URL}/data?code=${code}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("bad status");
    return await res.json();
  } catch (e) {
    setSyncMsg("اتصال به سرور برقرار نشد", true);
    return null;
  }
}

async function initSync() {
  if (state.syncCode) {
    const remote = await pullFromServer(state.syncCode);
    if (remote && remote.updatedAt > state.updatedAt) {
      state = { ...remote, syncCode: state.syncCode };
      saveState({ sync: false });
    }
  }
}

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=143").catch(() => {});
  });
}

// ---------- AI Analysis Button (toggle + scroll collapse, shared by dashboard & analysis cards) ----------
function setupAiCardToggle(btnId, resultId, insightsId) {
  // غیرفعال — تحلیل توسط setupAiAnalyzeButton انجام می‌شود
  // قبلاً دکمه را مخفی می‌کرد و کلیک را بی‌اثر می‌ساخت
}
// setupAiCardToggle disabled


// ---------- AI card scroll collapse (نرم و پیوسته با اسکرول، شبیه هدر) ----------

// ---------- Profile card (avatar + name) ----------
// Stored in state.profile so it travels with the sync code, not just this device.
const LEGACY_PROFILE_NAME_KEY = "dnk_profile_name_v1";
const LEGACY_PROFILE_AVATAR_KEY = "dnk_profile_avatar_v1";

function migrateLegacyProfile() {
  if (!state.profile) state.profile = { name: null, avatar: null };
  let changed = false;
  if (!state.profile.name) {
    const legacyName = localStorage.getItem(LEGACY_PROFILE_NAME_KEY);
    if (legacyName) { state.profile.name = legacyName; changed = true; }
  }
  if (!state.profile.avatar) {
    const legacyAvatar = localStorage.getItem(LEGACY_PROFILE_AVATAR_KEY);
    if (legacyAvatar) { state.profile.avatar = legacyAvatar; changed = true; }
  }
  if (changed) saveState();
  localStorage.removeItem(LEGACY_PROFILE_NAME_KEY);
  localStorage.removeItem(LEGACY_PROFILE_AVATAR_KEY);
}

function getProfileName() {
  if (!state.profile) state.profile = { name: null, avatar: null };
  if (!state.profile.name) {
    state.profile.name = "کاربر" + String(Math.floor(1000 + Math.random() * 9000));
    saveState();
  }
  return state.profile.name;
}
function setProfileName(name) {
  if (!state.profile) state.profile = { name: null, avatar: null };
  state.profile.name = name;
  saveState();
}
function getProfileAvatar() {
  return state.profile ? state.profile.avatar : null;
}
function setProfileAvatar(dataUrl) {
  if (!state.profile) state.profile = { name: null, avatar: null };
  state.profile.avatar = dataUrl || null;
  saveState();
}

function renderProfileCard() {
  const nameEl = document.getElementById("profileNameDisplay");
  const img = document.getElementById("profileAvatarImg");
  const defaultAvatar = document.getElementById("profileAvatarDefault");
  if (!nameEl || !img || !defaultAvatar) return;
  nameEl.textContent = getProfileName();
  const avatar = getProfileAvatar();
  if (avatar) {
    img.src = avatar;
    img.style.display = "";
    defaultAvatar.style.display = "none";
  } else {
    img.style.display = "none";
    defaultAvatar.style.display = "";
  }
}

(function setupProfileCard() {
  migrateLegacyProfile();
  const nameEl = document.getElementById("profileNameDisplay");
  const nameInput = document.getElementById("profileNameInput");
  const avatarBadge = document.getElementById("profileAvatarEditBtn");
  const avatarInput = document.getElementById("profileAvatarInput");
  if (!nameEl || !nameInput || !avatarBadge || !avatarInput) return;

  function startEditName() {
    nameInput.value = getProfileName();
    nameEl.style.display = "none";
    nameInput.style.display = "";
    nameInput.focus();
    nameInput.select();
  }
  function commitEditName() {
    const val = nameInput.value.trim();
    if (val) setProfileName(val);
    nameInput.style.display = "none";
    nameEl.style.display = "";
    renderProfileCard();
  }

  nameEl.addEventListener("click", startEditName);
  nameInput.addEventListener("blur", commitEditName);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameInput.blur(); }
  });

  avatarBadge.addEventListener("click", () => avatarInput.click());
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to keep localStorage usage reasonable
        const MAX = 240;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round(height * (MAX / width)); width = MAX; }
        else if (height > MAX) { width = Math.round(width * (MAX / height)); height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setProfileAvatar(dataUrl);
        renderProfileCard();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    avatarInput.value = "";
  });
})();

// ---------- Header scroll collapse ----------
const appScroll = document.getElementById("appScroll");
const appHeader = document.querySelector(".app-header");
let lastScrollTop = 0;
let headerCollapseTimer = null;

// JS-driven header-inner transform (avoids CSS specificity issues)
function setHeaderCompact(compact) {
  const inner = appHeader?.querySelector(".header-inner");
  if (!inner) return;
  if (compact) {
    appHeader.classList.add("is-compact");
  } else {
    appHeader.classList.remove("is-compact");
  }
}

if (appScroll) {
  appScroll.addEventListener("scroll", () => {
    const activeTab = document.querySelector(".nav-btn.active")?.dataset.tab || "dashboard";
    if (activeTab !== "dashboard") return;
    const scrollTop = appScroll.scrollTop;
    clearTimeout(headerCollapseTimer);
    
    if (scrollTop > 12) {
      setHeaderCompact(true);
    } else {
      setHeaderCompact(false);
    }
    lastScrollTop = scrollTop;
  }, { passive: true });
}

// ---------- App Lock ----------
const appLockToggle = document.getElementById("appLockToggle");
const appLockPinInput = document.getElementById("welcomeLockPin");
const appLockSubmit = document.getElementById("welcomeLockSubmit");
const appLockFaceIdBtn = document.getElementById("welcomeLockFaceId");
const appLockMessage = document.getElementById("welcomeLockMessage");
const appLockForm = document.getElementById("welcomeLockForm");

const appLockStorage = {
  isEnabled: () => localStorage.getItem("appLockEnabled") === "true",
  setEnabled: (val) => localStorage.setItem("appLockEnabled", val ? "true" : "false"),
  getPin: () => localStorage.getItem("appLockPin") || "1234",
  setPin: (pin) => localStorage.setItem("appLockPin", pin),
  isPinSet: () => localStorage.getItem("appLockPinSet") === "true",
  setPinSet: (val) => localStorage.setItem("appLockPinSet", val ? "true" : "false"),
  isUnlocked: () => sessionStorage.getItem("appUnlocked") === "true",
  setUnlocked: (val) => sessionStorage.setItem("appUnlocked", val ? "true" : "false"),
  isFaceIdEnabled: () => localStorage.getItem("appLockFaceIdEnabled") === "true",
  setFaceIdEnabled: (val) => localStorage.setItem("appLockFaceIdEnabled", val ? "true" : "false"),
  getFaceIdCredId: () => localStorage.getItem("appLockFaceIdCredId"),
  setFaceIdCredId: (id) => {
    if (id) localStorage.setItem("appLockFaceIdCredId", id);
    else localStorage.removeItem("appLockFaceIdCredId");
  }
};

// ---------- WebAuthn helpers (local device Face ID / Touch ID gate) ----------
// Note: there's no backend verifying these assertions — the credential is only
// used to ask the OS to perform a real biometric check before unlocking the app.
function abToB64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64ToAb(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function isPlatformAuthenticatorAvailable() {
  if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Registers a platform credential (triggers the real Face ID / Touch ID prompt).
async function registerFaceId() {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "دخل و خرج" },
        user: { id: userId, name: "user", displayName: "کاربر" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000
      }
    });
    if (!cred) return false;
    appLockStorage.setFaceIdCredId(abToB64(cred.rawId));
    appLockStorage.setFaceIdEnabled(true);
    return true;
  } catch {
    return false;
  }
}

// Asks the OS to verify the user against the stored credential (real Face ID / Touch ID prompt).
// Resolves true only if the biometric check actually succeeds.
async function verifyFaceId() {
  const credIdB64 = appLockStorage.getFaceIdCredId();
  if (!credIdB64) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64ToAb(credIdB64), type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return !!assertion;
  } catch {
    return false; // cancelled, failed, or no matching biometric
  }
}

const unlockAndProceed = () => {
  appLockStorage.setUnlocked(true);
  appLockPinInput.value = "";
  appLockMessage.textContent = "";
  completeWelcomeIntro();
};

const verifyPin = (pin) => {
  if (pin === appLockStorage.getPin()) {
    unlockAndProceed();
    return true;
  } else {
    appLockMessage.textContent = "رمز نادرست است";
    appLockPinInput.value = "";
    return false;
  }
};

// Shows the right sub-section: first-time setup (no old PIN) vs change (needs old PIN)
function refreshAppLockPasswordAreas() {
  const setupArea = document.getElementById("appLockSetupArea");
  const changeArea = document.getElementById("appLockChangeArea");
  if (appLockStorage.isPinSet()) {
    setupArea.style.display = "none";
    changeArea.style.display = "";
  } else {
    setupArea.style.display = "";
    changeArea.style.display = "none";
  }
}

async function refreshAppLockFaceIdArea() {
  const faceIdArea = document.getElementById("appLockFaceIdSetupArea");
  const faceIdToggle = document.getElementById("appLockFaceIdToggle");
  const available = await isPlatformAuthenticatorAvailable();
  if (available && appLockStorage.isEnabled()) {
    faceIdArea.style.display = "";
    faceIdToggle.checked = appLockStorage.isFaceIdEnabled() && !!appLockStorage.getFaceIdCredId();
  } else {
    faceIdArea.style.display = "none";
  }
}

// App lock toggle
appLockToggle.addEventListener("change", () => {
  appLockStorage.setEnabled(appLockToggle.checked);
  const pwdOptions = document.getElementById("appLockPasswordOptions");
  if (appLockToggle.checked) {
    pwdOptions.style.display = "";
    refreshAppLockPasswordAreas();
    refreshAppLockFaceIdArea();
  } else {
    pwdOptions.style.display = "none";
  }
});

// Load app lock state
appLockToggle.checked = appLockStorage.isEnabled();
if (appLockToggle.checked) {
  document.getElementById("appLockPasswordOptions").style.display = "";
  refreshAppLockPasswordAreas();
  refreshAppLockFaceIdArea();
}

// First-time PIN setup — only asks for the new PIN, no old PIN required
const appLockSetupPin = document.getElementById("appLockSetupPin");
const appLockSetupSubmit = document.getElementById("appLockSetupSubmit");
const appLockSetupMessage = document.getElementById("appLockSetupMessage");

appLockSetupSubmit.addEventListener("click", () => {
  if (!appLockSetupPin.value || appLockSetupPin.value.length < 4) {
    appLockSetupMessage.textContent = "رمز باید حداقل 4 رقم باشد";
    return;
  }
  appLockStorage.setPin(appLockSetupPin.value);
  appLockStorage.setPinSet(true);
  appLockSetupPin.value = "";
  appLockSetupMessage.style.color = "#10B981";
  appLockSetupMessage.textContent = "✓ رمز با موفقیت تنظیم شد";
  setTimeout(() => {
    appLockSetupMessage.textContent = "";
    appLockSetupMessage.style.color = "#ef4444";
    refreshAppLockPasswordAreas();
  }, 1200);
});

// Password change — requires the old PIN
const appLockChangePin = document.getElementById("appLockChangePin");
const appLockCurrentPin = document.getElementById("appLockCurrentPin");
const appLockNewPin = document.getElementById("appLockNewPin");
const appLockPinMessage = document.getElementById("appLockPinMessage");

appLockChangePin.addEventListener("click", () => {
  if (appLockCurrentPin.value !== appLockStorage.getPin()) {
    appLockPinMessage.textContent = "رمز فعلی نادرست است";
    return;
  }
  if (!appLockNewPin.value || appLockNewPin.value.length < 4) {
    appLockPinMessage.textContent = "رمز جدید باید حداقل 4 رقم باشد";
    return;
  }
  appLockStorage.setPin(appLockNewPin.value);
  appLockCurrentPin.value = "";
  appLockNewPin.value = "";
  appLockPinMessage.style.color = "#10B981";
  appLockPinMessage.textContent = "✓ رمز با موفقیت تغییر کرد";
  setTimeout(() => {
    appLockPinMessage.textContent = "";
    appLockPinMessage.style.color = "#ef4444";
  }, 2000);
});

// Face ID enrollment toggle
const appLockFaceIdToggle = document.getElementById("appLockFaceIdToggle");
const appLockFaceIdMessage = document.getElementById("appLockFaceIdMessage");

appLockFaceIdToggle.addEventListener("change", async () => {
  if (appLockFaceIdToggle.checked) {
    appLockFaceIdMessage.style.color = "var(--text-mute)";
    appLockFaceIdMessage.textContent = "در حال تایید هویت...";
    const ok = await registerFaceId();
    if (ok) {
      appLockFaceIdMessage.style.color = "#10B981";
      appLockFaceIdMessage.textContent = "✓ فیس‌آی‌دی فعال شد";
    } else {
      appLockFaceIdToggle.checked = false;
      appLockStorage.setFaceIdEnabled(false);
      appLockStorage.setFaceIdCredId(null);
      appLockFaceIdMessage.style.color = "#ef4444";
      appLockFaceIdMessage.textContent = "فعال‌سازی ناموفق بود";
    }
    setTimeout(() => { appLockFaceIdMessage.textContent = ""; }, 2000);
  } else {
    appLockStorage.setFaceIdEnabled(false);
    appLockStorage.setFaceIdCredId(null);
    appLockFaceIdMessage.textContent = "";
  }
});

// Lock screen listeners
appLockSubmit.addEventListener("click", () => {
  verifyPin(appLockPinInput.value);
});

appLockPinInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") verifyPin(appLockPinInput.value);
});

appLockFaceIdBtn.addEventListener("click", async () => {
  if (!appLockStorage.isFaceIdEnabled() || !appLockStorage.getFaceIdCredId()) {
    appLockMessage.textContent = "فیس‌آی‌دی فعال نیست";
    return;
  }
  appLockMessage.textContent = "";
  const verified = await verifyFaceId();
  if (verified) {
    unlockAndProceed();
  } else {
    appLockMessage.textContent = "تایید فیس‌آی‌دی ناموفق بود، رمز را وارد کنید";
    appLockPinInput.focus();
  }
});

// ---------- Init ----------
renderAll();
refreshSyncUI();
initSync();

// Handle app-shortcut deep links (long-press app icon → "ثبت خرج جدید" / "ثبت درآمد جدید")
(() => {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  if (action === "expense" || action === "income") {
    switchTab("entry");
    setEntryMode(action);
    history.replaceState(null, "", window.location.pathname);
  }
})();

// ==================== Budget Tab ====================


// ---------- Todo ----------

/* ========== تب کارها — پوشه‌ها، موعد، اولویت، ویرایش و برگرداندن ========== */
const PI_COLORS = ["#3B82F6","#F59E0B","#10B981","#06B6D4","#8B5CF6","#EC4899"];
const PI_PRIO_LABELS = { 1: "فوری", 2: "بالا", 3: "عادی", 4: "کم" };
const PI_DAYS = ["یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه","شنبه"];
let _piEditing = null;       // { fid, tid } وقتی در حال ویرایش یک کار هستیم
let _piPendingFolder = null;
let _piPendingPriority = 3;
let _piPendingDue = null;    // "YYYY-MM-DD" یا null
let _piFolderEditing = null; // id پوشه در حال ویرایش، یا null برای پوشه جدید
let _piFolderColor = 0;
let _piToastTimer = null;
let _piUndo = null;

function ensureTodoState() {
  if (!state.todo || typeof state.todo !== "object" || !Array.isArray(state.todo.lists)) {
    state.todo = { lists: [], openId: "all" };
  }
  if (!state.todo.lists.length) {
    state.todo.lists = [
      { id: "f" + Date.now().toString(36) + "a", name: "شخصی", colorIdx: 0, tasks: [] },
      { id: "f" + Date.now().toString(36) + "b", name: "کار", colorIdx: 1, tasks: [] }
    ];
  }
  state.todo.lists.forEach((l, i) => {
    if (!l.id) l.id = "f" + Date.now().toString(36) + i;
    if (!l.name) l.name = "پوشه " + (i + 1);
    if (l.colorIdx == null) l.colorIdx = i % PI_COLORS.length;
    if (!Array.isArray(l.tasks)) l.tasks = [];
    l.tasks.forEach((t, j) => {
      if (!t.id) t.id = "t" + Date.now().toString(36) + i + "_" + j;
      t.done = !!t.done;
      t.priority = Math.min(4, Math.max(1, +t.priority || 3));
      if (!t.due || !/^\d{4}-\d{2}-\d{2}$/.test(t.due)) t.due = null;
      if (!t.createdAt) t.createdAt = Date.now() - (l.tasks.length - j);
    });
  });
  const open = state.todo.openId;
  if (open !== "all" && !state.todo.lists.some((l) => l.id === open)) {
    state.todo.openId = "all";
  }
}

function piEsc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function piFa(n) { return Number(n).toLocaleString("fa-IR"); }

function piIso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function piTodayIso() { return piIso(new Date()); }
function piAddDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return piIso(new Date(y, m - 1, d + n));
}
function piDayDiff(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - a) / 86400000);
}
function piLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const j = toJalaali(y, m, d);
  return PI_DAYS[new Date(y, m - 1, d).getDay()] + "، " + piFa(j.jd) + " " + JALALI_MONTHS[j.jm - 1];
}
// برچسب کوتاه موعد برای ردیف کار
function piDueText(iso) {
  const diff = piDayDiff(iso);
  if (diff === 0) return "امروز";
  if (diff === 1) return "فردا";
  if (diff === 2) return "پس‌فردا";
  if (diff === -1) return "دیروز";
  if (diff < 0) return piFa(-diff) + " روز گذشته";
  const [y, m, d] = iso.split("-").map(Number);
  if (diff < 7) return PI_DAYS[new Date(y, m - 1, d).getDay()];
  const j = toJalaali(y, m, d);
  return piFa(j.jd) + " " + JALALI_MONTHS[j.jm - 1];
}

function piJalaliDate() {
  try { return piLongDate(piTodayIso()); } catch (_) {}
  return new Date().toLocaleDateString("fa-IR");
}

function saveTodoOnly() {
  try {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state.syncCode && typeof scheduleSync === "function") scheduleSync();
  } catch (e) {
    console.warn("saveTodoOnly", e);
  }
}

function piFolder(fid) { return state.todo.lists.find((l) => l.id === fid); }
function piColor(folder) { return PI_COLORS[(folder.colorIdx || 0) % PI_COLORS.length]; }

function piTaskRow(folder, t, showFolder) {
  const p = t.priority || 3;
  const meta = [];
  if (t.due) {
    const diff = piDayDiff(t.due);
    const cls = t.done ? "" : diff < 0 ? "is-late" : diff === 0 ? "is-today" : "";
    meta.push(`<span class="tk-due ${cls}">${piDueText(t.due)}</span>`);
  }
  if (p <= 2 && !t.done) meta.push(`<span class="tk-prio p${p}">${PI_PRIO_LABELS[p]}</span>`);
  if (showFolder) meta.push(`<span class="tk-folder-tag" style="--fc:${piColor(folder)}">${piEsc(folder.name)}</span>`);
  return `<div class="tk-task ${t.done ? "is-done" : ""}" data-fid="${folder.id}" data-tid="${t.id}">
    <button type="button" class="tk-check p${p}" data-act="check" aria-label="${t.done ? "برگرداندن به انجام‌نشده" : "انجام شد"}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
    </button>
    <button type="button" class="tk-task-body" data-act="edit">
      <span class="tk-task-title">${piEsc(t.title)}</span>
      ${t.note ? `<span class="tk-task-note">${piEsc(t.note)}</span>` : ""}
      ${meta.length ? `<span class="tk-task-meta">${meta.join("")}</span>` : ""}
    </button>
  </div>`;
}

function renderTodo(opts = {}) {
  ensureTodoState();
  const dateEl = document.getElementById("piDate");
  if (dateEl) dateEl.textContent = piJalaliDate();
  const stack = document.getElementById("piStack");
  const chipsEl = document.getElementById("tkFolders");
  if (!stack) return;

  const openId = state.todo.openId;
  const isAll = openId === "all";
  const lists = state.todo.lists;
  const scope = isAll ? lists : lists.filter((l) => l.id === openId);
  const items = [];
  scope.forEach((f) => f.tasks.forEach((t) => items.push({ f, t })));

  // ---- پوشه‌ها (چیپ‌ها)
  if (chipsEl) {
    const allLeft = lists.reduce((s, l) => s + l.tasks.filter((t) => !t.done).length, 0);
    let html = `<button type="button" class="tk-chip ${isAll ? "is-active" : ""}" data-act="folder" data-fid="all" role="tab" aria-selected="${isAll}">
      <span>همه</span>${allLeft ? `<b>${piFa(allLeft)}</b>` : ""}</button>`;
    html += lists.map((l) => {
      const left = l.tasks.filter((t) => !t.done).length;
      const act = l.id === openId;
      return `<button type="button" class="tk-chip ${act ? "is-active" : ""}" data-act="folder" data-fid="${l.id}" style="--fc:${piColor(l)}" role="tab" aria-selected="${act}">
        <i class="tk-chip-dot"></i><span>${piEsc(l.name)}</span>${left ? `<b>${piFa(left)}</b>` : ""}${act ? `<em class="tk-chip-edit" aria-label="ویرایش پوشه">✎</em>` : ""}</button>`;
    }).join("");
    html += `<button type="button" class="tk-chip tk-chip-add" data-act="new-folder" aria-label="پوشه جدید">+ پوشه</button>`;
    chipsEl.innerHTML = html;
    const active = chipsEl.querySelector(".tk-chip.is-active");
    if (active && active.scrollIntoView && opts.scrollChip !== false) {
      try { active.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (_) {}
    }
  }

  // ---- خلاصه و حلقه‌ی پیشرفت
  const open = items.filter((x) => !x.t.done);
  const done = items.filter((x) => x.t.done);
  const late = open.filter((x) => x.t.due && piDayDiff(x.t.due) < 0).length;
  const today = open.filter((x) => x.t.due && piDayDiff(x.t.due) === 0).length;
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  const ringFg = document.getElementById("tkRingFg");
  const ringText = document.getElementById("tkRingText");
  if (ringFg) {
    const c = 2 * Math.PI * 18;
    ringFg.style.strokeDasharray = c.toFixed(1);
    ringFg.style.strokeDashoffset = (c * (1 - pct / 100)).toFixed(1);
  }
  if (ringText) ringText.textContent = piFa(pct) + "٪";
  const sumEl = document.getElementById("tkSummary");
  if (sumEl) {
    const parts = [];
    if (!items.length) parts.push("هنوز کاری ثبت نشده");
    else if (!open.length) parts.push("همه‌ی کارها انجام شده 🎉");
    else {
      parts.push(`${piFa(open.length)} کار باقی‌مانده`);
      if (today) parts.push(`<span class="is-today">${piFa(today)} برای امروز</span>`);
      if (late) parts.push(`<span class="is-late">${piFa(late)} عقب‌افتاده</span>`);
    }
    sumEl.innerHTML = parts.join(" · ");
  }

  // ---- لیست کارها، گروه‌بندی بر اساس موعد
  const byPrio = (a, b) => (a.t.priority - b.t.priority) || ((a.t.due || "9") < (b.t.due || "9") ? -1 : (a.t.due || "9") > (b.t.due || "9") ? 1 : 0) || (a.t.createdAt - b.t.createdAt);
  const groups = [
    { key: "late", title: "عقب‌افتاده", test: (d) => d !== null && d < 0 },
    { key: "today", title: "امروز", test: (d) => d === 0 },
    { key: "soon", title: "فردا", test: (d) => d === 1 },
    { key: "later", title: "آینده", test: (d) => d !== null && d > 1 },
    { key: "none", title: "بدون موعد", test: (d) => d === null }
  ];
  let html = "";
  if (!items.length) {
    html = `<div class="tk-empty">
      <div class="tk-empty-icon">✓</div>
      <strong>${isAll ? "لیست کارهات خالیه" : "این پوشه خالیه"}</strong>
      <span>از کادر بالا یا دکمه‌ی + یه کار اضافه کن.</span>
    </div>`;
  } else {
    const usedGroups = groups.map((g) => ({ g, rows: open.filter((x) => g.test(x.t.due ? piDayDiff(x.t.due) : null)).sort(byPrio) }))
      .filter((x) => x.rows.length);
    const onlyNone = usedGroups.length === 1 && usedGroups[0].g.key === "none";
    usedGroups.forEach(({ g, rows }) => {
      html += `<section class="tk-group tk-group-${g.key}">`;
      if (!onlyNone) html += `<h3 class="tk-group-title">${g.title}<span>${piFa(rows.length)}</span></h3>`;
      html += `<div class="tk-card">${rows.map((x) => piTaskRow(x.f, x.t, isAll)).join("")}</div></section>`;
    });
    if (!open.length) {
      html += `<div class="tk-empty tk-empty-small"><strong>آفرین! کار باقی‌مانده‌ای نداری.</strong></div>`;
    }
    if (done.length) {
      const showDone = !!state.todo.showDone;
      done.sort((a, b) => (b.t.doneAt || 0) - (a.t.doneAt || 0));
      html += `<section class="tk-group tk-group-done ${showDone ? "is-open" : ""}">
        <div class="tk-done-head">
          <button type="button" class="tk-done-toggle" data-act="toggle-done" aria-expanded="${showDone}">
            <span class="tk-done-chev">${showDone ? "▾" : "◂"}</span>انجام‌شده<span class="tk-count">${piFa(done.length)}</span>
          </button>
          <button type="button" class="tk-done-clear" data-act="clear-done">پاک کردن</button>
        </div>
        ${showDone ? `<div class="tk-card">${done.map((x) => piTaskRow(x.f, x.t, isAll)).join("")}</div>` : ""}
      </section>`;
    }
  }
  stack.innerHTML = html;
  if (opts.enterAnimate) {
    stack.classList.remove("tk-enter");
    void stack.offsetWidth;
    stack.classList.add("tk-enter");
  }
}

// ---------- Toast با امکان برگرداندن ----------
function piToast(msg, undoFn) {
  const el = document.getElementById("tkToast");
  if (!el) return;
  document.getElementById("tkToastMsg").textContent = msg;
  const undoBtn = document.getElementById("tkToastUndo");
  undoBtn.hidden = !undoFn;
  _piUndo = undoFn || null;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(_piToastTimer);
  _piToastTimer = setTimeout(piHideToast, 4500);
}
function piHideToast() {
  const el = document.getElementById("tkToast");
  if (!el) return;
  el.classList.remove("show");
  _piUndo = null;
  setTimeout(() => { if (!el.classList.contains("show")) el.hidden = true; }, 250);
}

// ---------- شیت‌ها ----------
function piShowSheet(sheet) {
  sheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => sheet.classList.add("show"));
}
function piHideSheet(sheet) {
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove("show");
  document.body.classList.remove("sheet-open");
  setTimeout(() => { sheet.hidden = true; }, 200);
}

function piSyncPrioBtns() {
  document.querySelectorAll("#piPrioBtns .seg-btn").forEach((b) => {
    b.classList.toggle("active", +b.getAttribute("data-p") === _piPendingPriority);
  });
}
function piSyncDueBtns() {
  const diff = _piPendingDue ? piDayDiff(_piPendingDue) : null;
  document.querySelectorAll("#piDueBtns .tk-opt").forEach((b) => {
    const v = b.getAttribute("data-due");
    b.classList.toggle("active", v === "none" ? diff === null : diff === +v);
  });
  const label = document.getElementById("piDueLabel");
  if (label) label.textContent = _piPendingDue ? piLongDate(_piPendingDue) : "بدون موعد";
}
function piSyncFolderBtns() {
  const wrap = document.getElementById("piFolderBtns");
  if (!wrap) return;
  wrap.innerHTML = state.todo.lists.map((l) =>
    `<button type="button" class="tk-opt tk-opt-folder ${l.id === _piPendingFolder ? "active" : ""}" data-fid="${l.id}" style="--fc:${piColor(l)}"><i></i>${piEsc(l.name)}</button>`
  ).join("");
}

function piOpenSheet(folderId, taskId) {
  ensureTodoState();
  const sheet = document.getElementById("piTaskSheet");
  if (!sheet) return;
  const input = document.getElementById("piTaskTitle");
  const note = document.getElementById("piTaskNote");
  const folder = folderId && folderId !== "all" ? piFolder(folderId) : null;
  const task = folder && taskId ? folder.tasks.find((t) => t.id === taskId) : null;

  _piEditing = task ? { fid: folder.id, tid: task.id } : null;
  _piPendingFolder = (folder || state.todo.lists[0]).id;
  _piPendingPriority = task ? task.priority : 3;
  _piPendingDue = task ? task.due : null;
  if (input) input.value = task ? task.title : "";
  if (note) note.value = task ? (task.note || "") : "";
  document.getElementById("piSheetTitle").textContent = task ? "ویرایش کار" : "کار جدید";
  document.getElementById("piTaskSave").textContent = task ? "ذخیره" : "افزودن";
  document.getElementById("piTaskDelete").hidden = !task;
  piSyncPrioBtns();
  piSyncDueBtns();
  piSyncFolderBtns();
  piShowSheet(sheet);
  if (input && !task) setTimeout(() => input.focus(), 80);
}

function piCloseSheet() {
  piHideSheet(document.getElementById("piTaskSheet"));
  _piEditing = null;
}

function piSaveTask(e) {
  if (e) e.preventDefault();
  ensureTodoState();
  const input = document.getElementById("piTaskTitle");
  const title = (input && input.value || "").trim();
  if (!title) {
    if (input) { input.focus(); input.classList.add("error"); setTimeout(() => input.classList.remove("error"), 600); }
    return;
  }
  const note = (document.getElementById("piTaskNote").value || "").trim();
  const target = piFolder(_piPendingFolder) || state.todo.lists[0];
  if (!target) return;

  if (_piEditing) {
    const src = piFolder(_piEditing.fid);
    const task = src && src.tasks.find((t) => t.id === _piEditing.tid);
    if (task) {
      Object.assign(task, { title, note, priority: _piPendingPriority, due: _piPendingDue });
      if (src !== target) {
        src.tasks = src.tasks.filter((t) => t !== task);
        target.tasks.push(task);
      }
    }
  } else {
    target.tasks.push({
      id: "t" + Date.now().toString(36),
      title, note,
      done: false,
      priority: _piPendingPriority || 3,
      due: _piPendingDue,
      createdAt: Date.now()
    });
  }
  saveTodoOnly();
  piCloseSheet();
  renderTodo();
}

function piDeleteTask(fid, tid) {
  const folder = piFolder(fid);
  if (!folder) return;
  const idx = folder.tasks.findIndex((t) => t.id === tid);
  if (idx < 0) return;
  const [removed] = folder.tasks.splice(idx, 1);
  saveTodoOnly();
  renderTodo();
  piToast("کار حذف شد", () => {
    const f = piFolder(fid) || state.todo.lists[0];
    if (!f) return;
    f.tasks.splice(Math.min(idx, f.tasks.length), 0, removed);
    saveTodoOnly();
    renderTodo();
  });
}

function piOpenFolderSheet(fid) {
  ensureTodoState();
  const sheet = document.getElementById("piFolderSheet");
  if (!sheet) return;
  const folder = fid ? piFolder(fid) : null;
  _piFolderEditing = folder ? folder.id : null;
  _piFolderColor = folder ? folder.colorIdx % PI_COLORS.length : state.todo.lists.length % PI_COLORS.length;
  const name = document.getElementById("piFolderName");
  name.value = folder ? folder.name : "";
  document.getElementById("piFolderTitle").textContent = folder ? "ویرایش پوشه" : "پوشه جدید";
  const del = document.getElementById("piFolderDelete");
  del.hidden = !folder || state.todo.lists.length < 2;
  piRenderFolderColors();
  piShowSheet(sheet);
  if (!folder) setTimeout(() => name.focus(), 80);
}
function piRenderFolderColors() {
  const wrap = document.getElementById("piFolderColors");
  if (!wrap) return;
  wrap.innerHTML = PI_COLORS.map((c, i) =>
    `<button type="button" class="tk-color ${i === _piFolderColor ? "active" : ""}" data-ci="${i}" style="--fc:${c}" aria-label="رنگ ${piFa(i + 1)}"></button>`
  ).join("");
}
function piSaveFolder(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("piFolderName");
  const name = (input.value || "").trim();
  if (!name) {
    input.focus(); input.classList.add("error"); setTimeout(() => input.classList.remove("error"), 600);
    return;
  }
  if (_piFolderEditing) {
    const f = piFolder(_piFolderEditing);
    if (f) { f.name = name; f.colorIdx = _piFolderColor; }
  } else {
    const id = "f" + Date.now().toString(36);
    state.todo.lists.push({ id, name, colorIdx: _piFolderColor, tasks: [] });
    state.todo.openId = id;
  }
  saveTodoOnly();
  piHideSheet(document.getElementById("piFolderSheet"));
  renderTodo();
}
function piDeleteFolder() {
  const fid = _piFolderEditing;
  const idx = state.todo.lists.findIndex((l) => l.id === fid);
  if (idx < 0 || state.todo.lists.length < 2) return;
  const [removed] = state.todo.lists.splice(idx, 1);
  state.todo.openId = "all";
  saveTodoOnly();
  piHideSheet(document.getElementById("piFolderSheet"));
  renderTodo();
  piToast(`پوشه «${removed.name}» حذف شد`, () => {
    state.todo.lists.splice(Math.min(idx, state.todo.lists.length), 0, removed);
    state.todo.openId = removed.id;
    saveTodoOnly();
    renderTodo();
  });
}

function setupTodoUI() {
  const stack = document.getElementById("piStack");
  if (!stack) return;
  if (stack._todoBound) return;
  stack._todoBound = true;

  function onAction(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.preventDefault();
    const act = btn.getAttribute("data-act");
    ensureTodoState();
    const row = btn.closest(".tk-task");
    const fid = row ? row.getAttribute("data-fid") : btn.getAttribute("data-fid");
    const tid = row ? row.getAttribute("data-tid") : null;

    if (act === "folder") {
      if (fid !== "all" && state.todo.openId === fid) { piOpenFolderSheet(fid); return; }
      state.todo.openId = fid;
      saveTodoOnly();
      renderTodo();
    } else if (act === "new-folder") {
      piOpenFolderSheet(null);
    } else if (act === "check") {
      const folder = piFolder(fid);
      const task = folder && folder.tasks.find((t) => t.id === tid);
      if (!task) return;
      task.done = !task.done;
      task.doneAt = task.done ? Date.now() : null;
      saveTodoOnly();
      row.classList.add(task.done ? "is-checking" : "is-unchecking");
      if (task.done && navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
      setTimeout(() => renderTodo({ scrollChip: false }), 320);
    } else if (act === "edit") {
      piOpenSheet(fid, tid);
    } else if (act === "toggle-done") {
      state.todo.showDone = !state.todo.showDone;
      saveTodoOnly();
      renderTodo({ scrollChip: false });
    } else if (act === "clear-done") {
      const scope = state.todo.openId === "all" ? state.todo.lists : [piFolder(state.todo.openId)].filter(Boolean);
      const backup = scope.map((l) => ({ l, tasks: l.tasks.slice() }));
      let n = 0;
      scope.forEach((l) => { n += l.tasks.filter((t) => t.done).length; l.tasks = l.tasks.filter((t) => !t.done); });
      if (!n) return;
      saveTodoOnly();
      renderTodo({ scrollChip: false });
      piToast(`${piFa(n)} کار انجام‌شده پاک شد`, () => {
        backup.forEach(({ l, tasks }) => { l.tasks = tasks; });
        saveTodoOnly();
        renderTodo();
      });
    }
  }
  stack.addEventListener("click", onAction);
  const chips = document.getElementById("tkFolders");
  if (chips) chips.addEventListener("click", onAction);

  const quick = document.getElementById("tkQuickForm");
  if (quick) {
    quick.addEventListener("submit", (e) => {
      e.preventDefault();
      ensureTodoState();
      const input = document.getElementById("tkQuickInput");
      const title = (input.value || "").trim();
      if (!title) { input.focus(); return; }
      const folder = piFolder(state.todo.openId) || state.todo.lists[0];
      folder.tasks.push({ id: "t" + Date.now().toString(36), title, note: "", done: false, priority: 3, due: null, createdAt: Date.now() });
      input.value = "";
      saveTodoOnly();
      renderTodo({ scrollChip: false });
    });
  }

  const fab = document.getElementById("piFab");
  if (fab && !fab._todoBound) {
    fab._todoBound = true;
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      piOpenSheet(state.todo && state.todo.openId);
    });
  }

  // شیت کار
  const sheet = document.getElementById("piTaskSheet");
  if (sheet) {
    sheet.addEventListener("click", (e) => { if (e.target === sheet) piCloseSheet(); });
    document.getElementById("piTaskCancel").addEventListener("click", (e) => { e.preventDefault(); piCloseSheet(); });
    document.getElementById("piTaskSave").addEventListener("click", piSaveTask);
    document.getElementById("piTaskTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") piSaveTask(e); });
    document.getElementById("piTaskNote").addEventListener("keydown", (e) => { if (e.key === "Enter") piSaveTask(e); });
    document.getElementById("piTaskDelete").addEventListener("click", (e) => {
      e.preventDefault();
      const ed = _piEditing;
      piCloseSheet();
      if (ed) piDeleteTask(ed.fid, ed.tid);
    });
    document.getElementById("piPrioBtns").addEventListener("click", (e) => {
      const b = e.target.closest("[data-p]");
      if (!b) return;
      e.preventDefault();
      _piPendingPriority = +b.getAttribute("data-p");
      piSyncPrioBtns();
    });
    document.getElementById("piDueBtns").addEventListener("click", (e) => {
      const b = e.target.closest("[data-due]");
      if (!b) return;
      e.preventDefault();
      const v = b.getAttribute("data-due");
      _piPendingDue = v === "none" ? null : piAddDays(piTodayIso(), +v);
      piSyncDueBtns();
    });
    sheet.querySelectorAll(".tk-due-step").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const step = +b.getAttribute("data-step");
      _piPendingDue = piAddDays(_piPendingDue || piTodayIso(), _piPendingDue ? step : Math.max(0, step));
      piSyncDueBtns();
    }));
    document.getElementById("piFolderBtns").addEventListener("click", (e) => {
      const b = e.target.closest("[data-fid]");
      if (!b) return;
      e.preventDefault();
      _piPendingFolder = b.getAttribute("data-fid");
      piSyncFolderBtns();
    });
  }

  // شیت پوشه
  const fSheet = document.getElementById("piFolderSheet");
  if (fSheet) {
    fSheet.addEventListener("click", (e) => { if (e.target === fSheet) piHideSheet(fSheet); });
    document.getElementById("piFolderCancel").addEventListener("click", (e) => { e.preventDefault(); piHideSheet(fSheet); });
    document.getElementById("piFolderSave").addEventListener("click", piSaveFolder);
    document.getElementById("piFolderName").addEventListener("keydown", (e) => { if (e.key === "Enter") piSaveFolder(e); });
    document.getElementById("piFolderDelete").addEventListener("click", (e) => { e.preventDefault(); piDeleteFolder(); });
    document.getElementById("piFolderColors").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ci]");
      if (!b) return;
      e.preventDefault();
      _piFolderColor = +b.getAttribute("data-ci");
      piRenderFolderColors();
    });
  }

  const undo = document.getElementById("tkToastUndo");
  if (undo) undo.addEventListener("click", () => {
    const fn = _piUndo;
    piHideToast();
    if (fn) fn();
  });

  renderTodo();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupTodoUI);
else setupTodoUI();

function renderBudget() {
  if (!document.getElementById("budgetCategoryList")) return;
  if (!state.budget) state.budget = { total: 0, categories: {} };
  const total = state.budget.total || 0;
  const catBudgets = state.budget.categories || {};

  // Calculate spent per category this month
  const inPeriod = (dateStr) => inViewedMonth(dateStr);
  const expenses = state.expenses.filter((x) => inPeriod(x.date));
  const spentByCat = {};
  expenses.forEach((x) => { spentByCat[x.category] = (spentByCat[x.category] || 0) + x.amount; });
  const totalSpent = expenses.reduce((s, x) => s + x.amount, 0);
  const remain = Math.max(total - totalSpent, 0);
  const pct = total > 0 ? Math.min((totalSpent / total) * 100, 100) : 0;

  // Animate numbers
  const spentEl = document.getElementById("budgetTotalSpent");
  const limitEl = document.getElementById("budgetTotalLimit");
  const remainEl = document.getElementById("budgetRemainStat");
  if (spentEl) { spentEl.textContent = "\u06F0"; requestAnimationFrame(() => animateNumber(spentEl, totalSpent, 600)); }
  if (limitEl) { limitEl.textContent = "\u06F0"; requestAnimationFrame(() => animateNumber(limitEl, total, 600)); }
  if (remainEl) { remainEl.textContent = "\u06F0"; requestAnimationFrame(() => animateNumber(remainEl, remain, 600)); }

  // Donut chart
  const CIRCUMFERENCE = 314; // 2 * PI * 50
  const donutFill = document.getElementById("budgetDonutFill");
  if (donutFill) {
    const dashLen = (pct / 100) * CIRCUMFERENCE;
    donutFill.style.strokeDasharray = `${dashLen} ${CIRCUMFERENCE}`;
    // Color: green → orange → red based on pct
    if (pct > 80) donutFill.setAttribute("stroke", "url(#budgetGradDanger)");
    else if (pct > 60) donutFill.setAttribute("stroke", "url(#budgetGradWarn)");
    else donutFill.setAttribute("stroke", "url(#budgetGrad)");
  }

  // Percentage in donut center
  const pctStat = document.getElementById("budgetPercentStat");
  if (pctStat) pctStat.textContent = Math.round(pct) + "%";

  // Category count
  const catCountEl = document.getElementById("budgetCatCount");
  if (catCountEl) catCountEl.textContent = state.categories.length + " دسته";

  // Render category rows with mini donut + gauge slider
  const CAT_CIRC = 126; // 2 * PI * 20
  const listEl = document.getElementById("budgetCategoryList");
  listEl.innerHTML = state.categories.map((c, i) => {
    const budget = catBudgets[c.name] || 0;
    const spent = spentByCat[c.name] || 0;
    const catPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const color = catColor(c.name);
    const dashLen = (catPct / 100) * CAT_CIRC;
    const statusClass = catPct > 80 ? 'cat-danger' : catPct > 60 ? 'cat-warning' : 'cat-ok';
    return `
      <div class="budget-cat-row" data-cat-idx="${i}">
        <div class="budget-cat-top">
          <div class="budget-cat-mini-donut">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="5"/>
              <circle cx="24" cy="24" r="20" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${dashLen} ${CAT_CIRC}" transform="rotate(-90 24 24)" style="transition: stroke-dasharray .6s cubic-bezier(.4,0,.2,1)"/>
            </svg>
            <span class="budget-cat-pct ${statusClass}">${Math.round(catPct)}</span>
          </div>
          <div class="budget-cat-info">
            <div class="budget-cat-head">
              <span class="budget-cat-icon" style="background:${color}">${iconSpanHTML(c.icon, "color:#fff;width:14px;height:14px")}</span>
              <span class="budget-cat-name">${c.name}</span>
            </div>
            <div class="budget-cat-amounts">${fmtAmount(spent)}<small> / ${fmtAmount(budget)}</small></div>
          </div>
        </div>
        <div class="budget-cat-slider-row">
          <span class="budget-cat-slider-label">بودجه:</span>
          <input type="range" class="budget-cat-slider" data-cat="${c.name}" min="0" max="100000000" step="100000" value="${budget || 0}" style="--cat-color:${color}">
          <span class="budget-cat-slider-val" id="sliderVal_${i}">${budget ? fmtAmount(budget) : '−'}</span>
        </div>
      </div>`;
  }).join("");
  // Attach slider listeners
  listEl.querySelectorAll('.budget-cat-slider').forEach((slider, idx) => {
    slider.addEventListener('input', () => {
      const catName = slider.dataset.cat;
      const val = parseInt(slider.value) || 0;
      state.budget.categories[catName] = val;
      const valEl = document.getElementById('sliderVal_' + idx);
      if (valEl) valEl.textContent = val > 0 ? fmtAmount(val) : '−';
    });
    slider.addEventListener('change', () => {
      saveState();
      renderBudget();
    });
  });

  // Set total input
  document.getElementById("budgetTotalInput").value = total || "";
}

// Save total budget
document.getElementById("budgetSaveTotalBtn")?.addEventListener("click", () => {
  const val = getAmountValue(document.getElementById("budgetTotalInput"));
  state.budget.total = val || 0;
  saveState();
  renderBudget();
});

// Save category budgets on input change
document.getElementById("budgetCategoryList")?.addEventListener("input", (e) => {
  if (e.target.classList.contains("budget-cat-input")) {
    const cat = e.target.dataset.cat;
    const val = getAmountValue(e.target);
    if (!state.budget.categories) state.budget.categories = {};
    state.budget.categories[cat] = val || 0;
  }
});

// Save on blur
document.getElementById("budgetCategoryList")?.addEventListener("blur", (e) => {
  if (e.target.classList.contains("budget-cat-input")) {
    saveState();
  }
}, true);

// ═══════════════════════════════════════════════════
// ONBOARDING — Apple-style scroll-driven
// ═══════════════════════════════════════════════════
(function initOnboarding() {
  const KEY = "onboarding_done";
  const overlay = document.getElementById("onboarding");
  if (!overlay || localStorage.getItem(KEY)) return;

  overlay.hidden = false;
  const scroll = document.getElementById("onboardingScroll");
  const sections = overlay.querySelectorAll(".ob-section");
  const progressFill = document.getElementById("obProgressFill");
  let currentIdx = 0;
  const total = sections.length;

  // IntersectionObserver for section reveal
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = parseInt(entry.target.dataset.idx);
        currentIdx = idx;
        sections.forEach(s => s.classList.remove("in-view"));
        entry.target.classList.add("in-view");
      }
    });
  }, { threshold: 0.5 });
  sections.forEach(s => {
    observer.observe(s);
    // Add scroll hint to all sections except the last one (CTA)
    const idx = parseInt(s.dataset.idx);
    if (idx < total - 1) {
      const hint = document.createElement("div");
      hint.className = "ob-scroll-cue-bottom";
      hint.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
      s.appendChild(hint);
    }
  });
  sections[0].classList.add("in-view");

  // Scroll progress bar
  scroll.addEventListener("scroll", () => {
    const pct = Math.min(100, (scroll.scrollTop / (scroll.scrollHeight - scroll.clientHeight)) * 100);
    if (progressFill) progressFill.style.width = pct + "%";
    // Parallax on orbs
    const sy = scroll.scrollTop;
    overlay.querySelectorAll(".ob-orb").forEach((orb, i) => {
      const speed = 0.15 + i * 0.08;
      orb.style.transform = `translateY(${sy * speed}px)`;
    });
    // Hero text parallax (fade & shift up as you scroll past)
    const heroTitle = overlay.querySelector(".ob-hero-title");
    const heroSub = overlay.querySelector(".ob-hero-sub");
    if (heroTitle) {
      const p = Math.min(1, sy / (window.innerHeight * 0.5));
      heroTitle.style.opacity = 1 - p;
      heroTitle.style.transform = `translateY(${-p * 60}px) scale(${1 - p * 0.1})`;
    }
    if (heroSub) {
      const p = Math.min(1, sy / (window.innerHeight * 0.5));
      heroSub.style.opacity = 1 - p;
      heroSub.style.transform = `translateY(${-p * 40}px)`;
    }
  });

  // Dismiss
  function dismiss() {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity .5s cubic-bezier(.4,0,.2,1)";
    setTimeout(() => {
      overlay.hidden = true;
      localStorage.setItem(KEY, "1");
      observer.disconnect();
    }, 500);
  }

  const startBtn = document.getElementById("onboardStartBtn");
  if (startBtn) startBtn.addEventListener("click", dismiss);
  const skipBtn = document.getElementById("onboardSkipBtn");
  if (skipBtn) skipBtn.addEventListener("click", dismiss);
})();

// ═══════════════════════════════════════════════════



(function initMeniscusNav() {
  let tries = 0;
  function placeDashboardBead() {
    try {
      const dash = document.querySelector('.nav-btn[data-tab="dashboard"]');
      if (dash) {
        document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
        dash.classList.add("active");
      }
      const ok = moveNavBead("dashboard");
      const bead = document.getElementById("navBead");
      if (bead) {
        bead.classList.add("is-ready");
        bead.style.opacity = "1";
        bead.style.visibility = "visible";
      }
      return ok;
    } catch (e) {
      console.warn("meniscus", e);
      return false;
    }
  }
  function boot() {
    try { setupMeniscusNavDrag(); } catch (e) {}
    function attempt() {
      tries += 1;
      const ok = placeDashboardBead();
      // تا وقتی layout آماده نشده، چند بار تکرار کن
      if (!ok && tries < 20) {
        setTimeout(attempt, 50);
      }
    }
    attempt();
    requestAnimationFrame(attempt);
    window.addEventListener("load", attempt, { once: true });
    // بعد از اولین تعامل کاربر هم یک‌بار مطمئن شو
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const active = document.querySelector(".nav-btn.active");
        moveNavBead((active && active.dataset.tab) || "dashboard");
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("resize", () => {
    const active = document.querySelector(".nav-btn.active");
    moveNavBead((active && active.dataset.tab) || "dashboard");
  });
})();
