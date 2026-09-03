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
        budget: parsed.budget || { total: 0, categories: {} },
        todoFolders: parsed.todoFolders || null,
        todoOpenFolderId: parsed.todoOpenFolderId || null,
        syncCode: parsed.syncCode || null,
        profile: parsed.profile || { name: null, avatar: null },
        updatedAt: parsed.updatedAt || Date.now()
      };
    }
  } catch (e) { /* ignore corrupt state */ }
  return { incomes: [], expenses: [], installments: [], categories: DEFAULT_CATEGORIES.slice(), budget: { total: 0, categories: {} }, todoFolders: null, todoOpenFolderId: null, syncCode: null, profile: { name: null, avatar: null }, updatedAt: Date.now() };
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
    // Reset analysis numbers to 0 so animateNumber plays from scratch
    const incEl = document.getElementById("incomeChartTotal");
    const expEl = document.getElementById("expenseChartTotal");
    if (incEl) incEl.textContent = "۰";
    if (expEl) expEl.textContent = "۰";
    requestAnimationFrame(() => {
      renderAnalysis();
      // Re-measure and reset the AI card collapse so it starts fresh
      if (typeof window._aiCollapseReset === "function") window._aiCollapseReset();
    });
  }
  if (tab === "installments" && typeof window.refreshInstallments === "function") {
    // Reset numbers to 0 so animation plays from scratch
    if (typeof window.resetInstallmentNumbers === "function") window.resetInstallmentNumbers();
    requestAnimationFrame(() => window.refreshInstallments());
  }
  if (tab === "todo") renderTodo();

  // Settings accordions always start closed, whether we're leaving or entering the tab
  document.querySelectorAll("#tab-settings .settings-group").forEach((d) => { d.open = false; });

  const headerEl = document.querySelector(".app-header");
  if (headerEl) {
    // Toggle compact state via JS-driven transform
    setHeaderCompact(tab !== "dashboard");
  }

  // Show/hide AI floating star (only on analysis tab)
  const aiStar = document.getElementById("aiFloatingStar");
  if (aiStar) {
    if (tab === "analysis") {
      aiStar.style.visibility = "visible";
      aiStar.style.pointerEvents = "auto";
    } else {
      aiStar.style.opacity = "0";
      aiStar.style.visibility = "hidden";
      aiStar.style.pointerEvents = "none";
    }
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

  animateNumber(document.getElementById("dashIncomeChip"), totalIncome);
  animateNumber(document.getElementById("dashExpenseChip"), totalExpense);

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
  incomes.forEach((x) => { bySource[x.source] = (bySource[x.source] || 0) + x.amount; });
  const usedSources = Array.from(new Set([...INCOME_SOURCES, ...state.incomes.map((x) => x.source)]));
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
let analysisPeriod = "month"; // Used for main period selection
const setupPeriodToggle = (toggleId, callback) => {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  toggle.querySelectorAll(".chart-period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      analysisPeriod = btn.dataset.period;
      toggle.querySelectorAll(".chart-period-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (callback) callback();
    });
  });
};
setupPeriodToggle("mainPeriodToggle", renderAll);

function getCompareData(period) {
  let curData, prevData;
  if (period === "month") {
    const t = viewedMonth;
    const p = addMonthsJalali(t.jy, t.jm, -1);
    curData = computeMonthTotals(t.jy, t.jm);
    prevData = computeMonthTotals(p.jy, p.jm);
  } else if (period === "week") {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const getWeekData = (startDate, endDate) => {
      const inRange = (dateStr) => {
        const [gy, gm, gd] = dateStr.split("-").map(Number);
        const d = new Date(gy, gm - 1, gd);
        return d >= startDate && d < endDate;
      };
      const incomes = state.incomes.filter((x) => inRange(x.date));
      const expenses = state.expenses.filter((x) => inRange(x.date));
      const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
      const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
      return { totalIncome, totalExpense, categories: [] };
    };

    curData = getWeekData(weekAgo, today);
    prevData = getWeekData(twoWeeksAgo, weekAgo);
  } else {
    curData = {
      totalIncome: state.incomes.reduce((s, x) => s + x.amount, 0),
      totalExpense: state.expenses.reduce((s, x) => s + x.amount, 0),
      categories: []
    };
    prevData = { totalIncome: 0, totalExpense: 0, categories: [] };
  }

  const monthPrevJ = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, -1);
  const periodLegend = {
    month: {
      cur: isViewingCurrentMonth() ? "این ماه" : JALALI_MONTHS[viewedMonth.jm - 1],
      prev: JALALI_MONTHS[monthPrevJ.jm - 1]
    },
    week: { cur: "این هفته", prev: "هفته قبل" },
    all: { cur: "کل بازه", prev: "بدون مقایسه" }
  }[period] || { cur: "دوره فعلی", prev: "دوره قبل" };

  return { curData, prevData, periodLegend };
}

function renderMonthCompareCard(containerId, period = "month") {
  const wrap = document.getElementById(containerId);
  const { curData, prevData, periodLegend } = getCompareData(period);

  if (!curData.totalIncome && !curData.totalExpense && !prevData.totalIncome && !prevData.totalExpense) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای مقایسه نیست</p>`;
    return;
  }

  const defs = [
    { key: "expense", label: "مخارج", curV: curData.totalExpense, prevV: prevData.totalExpense, goodWhenDown: true },
    { key: "income", label: "درآمد", curV: curData.totalIncome, prevV: prevData.totalIncome, goodWhenDown: false }
  ];

  const overallMax = Math.max(...defs.map((d) => Math.max(d.curV, d.prevV))) || 1;

  const gauges = defs.map((g) => {
    const increased = g.curV > g.prevV;
    const changePct = g.prevV > 0 ? Math.round(((g.curV - g.prevV) / g.prevV) * 100) : (g.curV > 0 ? 100 : 0);
    const isGood = g.prevV === 0 && g.curV === 0 ? null : (g.goodWhenDown ? !increased : increased);

    // رنگ ثابت هر متریک (بدون توجه به وضعیت خوب/بد): مخارج = قرمز/سبز، درآمد = آبی/زرد
    let colorA, colorB, prevColor;
    if (g.key === "expense") {
      colorA = "#FF375F"; colorB = "#E01346";
      prevColor = "#57B928";
    } else {
      colorA = "#2E9BFF"; colorB = "#0A6FDB";
      prevColor = "#FFD426";
    }

    const outerPct = (g.curV / overallMax) * 100;
    const innerPct = (g.prevV / overallMax) * 100;
    return { ...g, outerPct, innerPct, changePct, colorA, colorB, prevColor };
  });

  const cx = 78, cy = 78;
  const rOuter = 62, swOuter = 16;
  const rInner = 40, swInner = 13;
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  const uid = Date.now();

  const gaugeHTML = gauges.map((g, i) => {
    const dashOuter = (g.outerPct / 100) * circOuter;
    const dashInner = (g.innerPct / 100) * circInner;
    return `
      <div class="compare-gauge">
        <svg viewBox="0 0 156 156" class="compare-gauge-svg">
          <defs>
            <linearGradient id="gaugeGrad-${uid}-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${g.colorA}"/>
              <stop offset="100%" stop-color="${g.colorB}"/>
            </linearGradient>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="var(--cream)" stroke-width="${swOuter}"/>
          <circle class="compare-gauge-seg" id="gaugeOuter-${uid}-${i}" cx="${cx}" cy="${cy}" r="${rOuter}" fill="none"
            stroke="url(#gaugeGrad-${uid}-${i})" stroke-width="${swOuter}" stroke-linecap="round"
            stroke-dasharray="0 ${circOuter}" transform="rotate(-90 ${cx} ${cy})"
            data-dash="${dashOuter}" data-circ="${circOuter}"/>
          <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="var(--cream)" stroke-width="${swInner}"/>
          <circle class="compare-gauge-seg" id="gaugeInner-${uid}-${i}" cx="${cx}" cy="${cy}" r="${rInner}" fill="none"
            stroke="${g.prevColor}" stroke-width="${swInner}" stroke-linecap="round"
            stroke-dasharray="0 ${circInner}" transform="rotate(-90 ${cx} ${cy})"
            data-dash="${dashInner}" data-circ="${circInner}"/>
        </svg>
        <div class="compare-gauge-center">
          <span class="compare-gauge-pct">${g.changePct > 0 ? "+" : ""}${toPersianDigits(g.changePct)}٪</span>
        </div>
        <div class="compare-gauge-label">${g.label}</div>
        <div class="compare-gauge-legend">
          <span><i style="background:${g.colorB}"></i>${periodLegend.cur}: ${fmtAmount(g.curV)}</span>
          <span><i style="background:${g.prevColor}"></i>${periodLegend.prev}: ${fmtAmount(g.prevV)}</span>
        </div>
      </div>`;
  }).join("");

  wrap.innerHTML = `<div class="compare-gauges-row chart-graphic-enter">${gaugeHTML}</div>`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gauges.forEach((g, i) => {
        ["Outer", "Inner"].forEach((part) => {
          const seg = document.getElementById(`gauge${part}-${uid}-${i}`);
          if (!seg) return;
          const dash = parseFloat(seg.dataset.dash);
          const circ = parseFloat(seg.dataset.circ);
          seg.setAttribute("stroke-dasharray", `${dash} ${circ - dash}`);
        });
      });
    });
  });
}

function renderIncomeExpensePieCompare(containerId, period = "month") {
  const wrap = document.getElementById(containerId);
  const { curData, periodLegend } = getCompareData(period);
  const totalIncome = curData.totalIncome || 0;
  const totalExpense = curData.totalExpense || 0;
  const total = totalIncome + totalExpense;

  if (!total) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای این دوره نیست</p>`;
    return;
  }

  const incomePct = (totalIncome / total) * 100;
  const cx = 90, cy = 90, r = 68, sw = 24;
  const circ = 2 * Math.PI * r;
  const incomeDash = (incomePct / 100) * circ;
  const balance = totalIncome - totalExpense;
  const uid = Date.now();

  wrap.innerHTML = `
    <div class="pie-compare chart-graphic-enter">
      <svg viewBox="0 0 180 180" class="pie-compare-svg">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#C24A2E" stroke-width="${sw}"/>
        <circle id="pieCompareIncome-${uid}" cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="#2F7A72" stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="0 ${circ}" transform="rotate(-90 ${cx} ${cy})"
          data-dash="${incomeDash}" data-circ="${circ}"/>
      </svg>
      <div class="pie-compare-center">
        <span class="pie-compare-label">تراز ${periodLegend.cur}</span>
        <strong class="pie-compare-balance ${balance >= 0 ? "income-color" : "expense-color"}">${balance >= 0 ? "+" : "−"}${fmtAmount(Math.abs(balance))}</strong>
      </div>
    </div>
    <div class="pie-compare-legend">
      <span><i style="background:#2F7A72"></i>درآمد: ${fmtAmount(totalIncome)} (${toPersianDigits(Math.round(incomePct))}٪)</span>
      <span><i style="background:#C24A2E"></i>مخارج: ${fmtAmount(totalExpense)} (${toPersianDigits(Math.round(100 - incomePct))}٪)</span>
    </div>`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const seg = document.getElementById(`pieCompareIncome-${uid}`);
      if (!seg) return;
      const dash = parseFloat(seg.dataset.dash);
      const c = parseFloat(seg.dataset.circ);
      seg.setAttribute("stroke-dasharray", `${dash} ${c - dash}`);
    });
  });
}

function renderPieChart(containerId, segments, chartType = "expense") {
  const wrap = document.getElementById(containerId);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای این بازه نیست</p>`;
    return;
  }
  const visible = segments.filter((s) => s.value > 0);

  // رنگ هر بخش از قبل با catColor() تعیین شده تا با داشبورد/تب ثبت/لیست مخارج یکسان بماند
  const cx = 91, cy = 91, r = 72, sw = 30;
  const circumference = 2 * Math.PI * r;
  const uid = Date.now();

  let cumulative = 0;
  const segsHTML = visible.map((seg, i) => {
    const dash = (seg.value / total) * circumference;
    const offset = (cumulative / total) * circumference;
    cumulative += seg.value;
    return `<circle class="donut-seg" id="donutSeg-${uid}-${i}" cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${sw}"
      stroke-dasharray="0 ${circumference}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})" data-dash="${dash}" data-circ="${circumference}"/>`;
  }).join("");

  const legend = visible.map((seg) => {
    const pct = Math.round((seg.value / total) * 100);
    const iconHTML = seg.icon
      ? `<span class="legend-icon" style="background:${seg.color}1f">${iconSpanHTML(seg.icon, `color:${seg.color}`)}</span>`
      : `<span class="legend-dot" style="background:${seg.color}"></span>`;
    return `
      <div class="chart-legend-row">
        ${iconHTML}
        <span class="legend-label">${seg.label}</span>
        <span class="legend-pct" style="background:${seg.color}1c;color:${seg.color}">${toPersianDigits(pct)}٪</span>
        <span class="legend-amt">${fmtAmount(seg.value)}</span>
      </div>`;
  }).join("");

  wrap.innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 182 182" class="donut-svg">
        <defs>
          <filter id="pieShadow-${containerId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#163F3C" flood-opacity="0.18"/>
          </filter>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--cream)" stroke-width="${sw}"/>
        <g style="filter:url(#pieShadow-${containerId})">${segsHTML}</g>
      </svg>
      <div class="donut-center">
        <span class="donut-center-label">مجموع مخارج</span>
        <span class="donut-center-amt">${fmtAmount(total)}</span>
      </div>
    </div>
    <div class="chart-legend">${legend}</div>
  `;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      visible.forEach((seg, i) => {
        const el = document.getElementById(`donutSeg-${uid}-${i}`);
        if (!el) return;
        const dash = parseFloat(el.dataset.dash);
        const circ = parseFloat(el.dataset.circ);
        el.setAttribute("stroke-dasharray", `${dash} ${circ - dash}`);
      });
    });
  });
}

// ---------- نمودار خطی ترکیبی درآمد/مخارج (روزانه قابل‌اسکرول + سالیانه) ----------
function smoothPath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

const JALALI_MONTHS_SHORT = ["فرو", "ارد", "خرد", "تیر", "مرد", "شهر", "مهر", "آبا", "آذر", "دی", "بهم", "اسف"];
let dailyChartMode = "day"; // 'day' | 'year'

function buildDailyChartPool(days) {
  const now = new Date();
  const pool = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
    const iso = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
    const j = toJalaali(gy, gm, gd);
    pool.push({ iso, jy: j.jy, jm: j.jm, jd: j.jd, income: 0, expense: 0 });
  }
  const idx = {};
  pool.forEach((p, i) => { idx[p.iso] = i; });
  state.incomes.forEach((x) => { if (idx[x.date] !== undefined) pool[idx[x.date]].income += x.amount; });
  state.expenses.forEach((x) => { if (idx[x.date] !== undefined) pool[idx[x.date]].expense += x.amount; });
  return pool;
}

function buildYearlyChartPool(jy) {
  const pool = [];
  for (let m = 1; m <= 12; m += 1) pool.push({ jy, jm: m, income: 0, expense: 0 });
  state.incomes.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (j.jy === jy) pool[j.jm - 1].income += x.amount;
  });
  state.expenses.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (j.jy === jy) pool[j.jm - 1].expense += x.amount;
  });
  return pool;
}

function renderCombinedDailyChart(containerId, incomeTotalElId, expenseTotalElId) {
  const wrap = document.getElementById(containerId);
  const scrollWrap = document.getElementById("dailyChartScroll");
  const incomeTotalEl = document.getElementById(incomeTotalElId);
  const expenseTotalEl = document.getElementById(expenseTotalElId);
  const isYear = dailyChartMode === "year";

  const pool = isYear ? buildYearlyChartPool(todayJalali().jy) : buildDailyChartPool(10);
  const n = pool.length;

  // مقدار بالای نمودار: متناسب با دکمه‌ی بازه‌ی انتخاب‌شده — سالیانه = کل سال جاری، ماهانه = فقط ماه جاری
  const todayJHead = todayJalali();
  let headerIncome = 0, headerExpense = 0;
  state.incomes.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (isYear ? j.jy === todayJHead.jy : (j.jy === todayJHead.jy && j.jm === todayJHead.jm)) headerIncome += x.amount;
  });
  state.expenses.forEach((x) => {
    const [gy, gm, gd] = x.date.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    if (isYear ? j.jy === todayJHead.jy : (j.jy === todayJHead.jy && j.jm === todayJHead.jm)) headerExpense += x.amount;
  });
  if (incomeTotalEl) animateNumber(incomeTotalEl, headerIncome, 500);
  if (expenseTotalEl) animateNumber(expenseTotalEl, headerExpense, 500);

  const totalIncome = pool.reduce((s, p) => s + p.income, 0);
  const totalExpense = pool.reduce((s, p) => s + p.expense, 0);
  if (!totalIncome && !totalExpense) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای این بازه نیست</p>`;
    return;
  }

  const maxIncome = Math.max(...pool.map((p) => p.income)) || 1;
  const maxExpense = Math.max(...pool.map((p) => p.expense)) || 1;

  const H = 200, PAD_TOP = 40, PAD_BOTTOM = 28, PAD_X = 18;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const W = Math.max((scrollWrap && scrollWrap.clientWidth) || 320, 280);
  const stepX = (W - PAD_X * 2) / (n - 1 || 1);

  const buildPts = (key, maxVal) => pool.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + chartH - (p[key] / maxVal) * chartH,
    v: p[key],
    meta: p,
  }));
  const incomePts = buildPts("income", maxIncome);
  const expensePts = buildPts("expense", maxExpense);

  const incomeLine = smoothPath(incomePts);
  const expenseLine = smoothPath(expensePts);
  const baseY = (PAD_TOP + chartH).toFixed(1);
  const incomeArea = `${incomeLine} L${incomePts[incomePts.length - 1].x.toFixed(1)},${baseY} L${incomePts[0].x.toFixed(1)},${baseY} Z`;
  const expenseArea = `${expenseLine} L${expensePts[expensePts.length - 1].x.toFixed(1)},${baseY} L${expensePts[0].x.toFixed(1)},${baseY} Z`;

  const gridLines = [0.28, 0.62].map((f) => {
    const y = PAD_TOP + chartH * f;
    return `<line x1="${PAD_X}" y1="${y.toFixed(1)}" x2="${(W - PAD_X).toFixed(1)}" y2="${y.toFixed(1)}" class="daily-chart-grid"/>`;
  }).join("");

  const axisLabels = pool.map((p, i) => {
    const x = PAD_X + i * stepX;
    const label = isYear ? JALALI_MONTHS_SHORT[p.jm - 1] : toPersianDigits(p.jd);
    return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="daily-chart-axis-label">${label}</text>`;
  }).join("");

  const uid = `${containerId}-${Date.now()}`;
  const todayJ = todayJalali();
  const defaultIdx = isYear ? (todayJ.jm - 1) : (n - 1);

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="daily-chart-svg combined-chart-svg chart-graphic-enter" id="svg-${uid}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fillIncome-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2F7A72" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#2F7A72" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="fillExpense-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C24A2E" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#C24A2E" stop-opacity="0"/>
        </linearGradient>
        <filter id="lineGlow-${uid}" x="-30%" y="-60%" width="160%" height="220%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#163F3C" flood-opacity="0.18"/>
        </filter>
      </defs>
      ${gridLines}
      ${axisLabels}
      <line id="scrubLine-${uid}" x1="0" y1="${PAD_TOP}" x2="0" y2="${baseY}" class="daily-chart-dashed"/>
      <path d="${expenseArea}" fill="url(#fillExpense-${uid})" stroke="none"/>
      <path d="${incomeArea}" fill="url(#fillIncome-${uid})" stroke="none"/>
      <g filter="url(#lineGlow-${uid})">
        <path id="lineExpense-${uid}" d="${expenseLine}" fill="none" stroke="#C24A2E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path id="lineIncome-${uid}" d="${incomeLine}" fill="none" stroke="#2F7A72" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <circle id="scrubDotExpense-${uid}" r="4" fill="#fff" stroke="#C24A2E" stroke-width="2.4"/>
      <circle id="scrubDotIncome-${uid}" r="4" fill="#fff" stroke="#2F7A72" stroke-width="2.4"/>
      <g id="scrubTooltip-${uid}">
        <rect id="scrubTooltipBg-${uid}" y="2" height="34" rx="10" class="daily-chart-tooltip-bg"/>
        <text id="scrubTooltipIncome-${uid}" y="13" text-anchor="middle" class="daily-chart-tooltip-val income-tooltip-val"></text>
        <text id="scrubTooltipExpense-${uid}" y="24" text-anchor="middle" class="daily-chart-tooltip-val expense-tooltip-val"></text>
        <text id="scrubTooltipDate-${uid}" y="34" text-anchor="middle" class="daily-chart-tooltip-date"></text>
      </g>
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent" id="scrubCatcher-${uid}"/>
    </svg>
  `;

  const svg = document.getElementById(`svg-${uid}`);
  const scrubLine = document.getElementById(`scrubLine-${uid}`);
  const scrubDotIncome = document.getElementById(`scrubDotIncome-${uid}`);
  const scrubDotExpense = document.getElementById(`scrubDotExpense-${uid}`);
  const tooltipBg = document.getElementById(`scrubTooltipBg-${uid}`);
  const tooltipIncomeText = document.getElementById(`scrubTooltipIncome-${uid}`);
  const tooltipExpenseText = document.getElementById(`scrubTooltipExpense-${uid}`);
  const tooltipDateText = document.getElementById(`scrubTooltipDate-${uid}`);
  const catcher = document.getElementById(`scrubCatcher-${uid}`);

  function moveToIndex(idx) {
    idx = Math.min(Math.max(idx, 0), n - 1);
    const ip = incomePts[idx];
    const ep = expensePts[idx];
    scrubLine.setAttribute("x1", ip.x.toFixed(1));
    scrubLine.setAttribute("x2", ip.x.toFixed(1));
    scrubDotIncome.setAttribute("cx", ip.x.toFixed(1));
    scrubDotIncome.setAttribute("cy", ip.y.toFixed(1));
    scrubDotExpense.setAttribute("cx", ep.x.toFixed(1));
    scrubDotExpense.setAttribute("cy", ep.y.toFixed(1));

    const p = ip.meta;
    const dateStr = isYear ? `${JALALI_MONTHS[p.jm - 1]} ${toPersianDigits(p.jy)}` : `${toPersianDigits(p.jd)} ${JALALI_MONTHS[p.jm - 1]}`;
    const incomeStr = `درآمد: ${fmtAmount(ip.v)}`;
    const expenseStr = `مخارج: ${fmtAmount(ep.v)}`;
    tooltipIncomeText.textContent = incomeStr;
    tooltipExpenseText.textContent = expenseStr;
    tooltipDateText.textContent = dateStr;

    const maxLen = Math.max(incomeStr.length, expenseStr.length, dateStr.length);
    const tw = Math.max(80, 14 + maxLen * 5.7);
    let tx = ip.x - tw / 2;
    tx = Math.min(Math.max(tx, PAD_X - 10), W - PAD_X + 10 - tw);
    tooltipBg.setAttribute("x", tx.toFixed(1));
    tooltipBg.setAttribute("width", tw.toFixed(1));
    const tcx = (tx + tw / 2).toFixed(1);
    tooltipIncomeText.setAttribute("x", tcx);
    tooltipExpenseText.setAttribute("x", tcx);
    tooltipDateText.setAttribute("x", tcx);
  }

  function xToIndex(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    return Math.round((relX - PAD_X) / stepX);
  }

  // تپ ساده برای انتخاب روز/ماه — بدون preventDefault تا اسکرول افقی دست‌نخورده بمونه
  let downX = null, downY = null, moved = false;
  catcher.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; moved = false; });
  catcher.addEventListener("pointermove", (e) => {
    if (downX === null) return;
    if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) moved = true;
  });
  catcher.addEventListener("pointerup", (e) => {
    if (!moved) moveToIndex(xToIndex(e.clientX));
    downX = null;
  });

  // Line-drawing animation for income/expense paths with glow trail
  const lineExpense = document.getElementById(`lineExpense-${uid}`);
  const lineIncome = document.getElementById(`lineIncome-${uid}`);
  [lineExpense, lineIncome].forEach((path, idx) => {
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    // Stagger: income draws first, expense follows 200ms later
    const delay = idx === 0 ? '0s' : '0.2s';
    path.style.transition = `stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1) ${delay}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        path.style.strokeDashoffset = '0';
      });
    });
  });

  // Fade-in the area fills after lines finish drawing
  const areaExpense = wrap.querySelector(`[fill="url(#fillExpense-${uid})"]`);
  const areaIncome = wrap.querySelector(`[fill="url(#fillIncome-${uid})"]`);
  [areaIncome, areaExpense].forEach((area, idx) => {
    if (!area) return;
    area.style.opacity = '0';
    const delay = idx === 0 ? '0.8s' : '1.0s';
    area.style.transition = `opacity .7s cubic-bezier(.22,1,.36,1) ${delay}`;
    requestAnimationFrame(() => { area.style.opacity = '1'; });
  });

  // Pulse the scrub dots after animation completes
  setTimeout(() => {
    [lineExpense, lineIncome].forEach((path) => {
      if (!path) return;
      path.style.filter = 'drop-shadow(0 0 4px ' + (path === lineIncome ? 'rgba(47,122,114,0.4)' : 'rgba(194,74,46,0.4)') + ')';
    });
  }, 1600);

  moveToIndex(defaultIdx);
}

(function setupDailyChartModeToggle() {
  const toggle = document.getElementById("dailyChartModeToggle");
  if (!toggle) return;
  toggle.querySelectorAll(".chart-period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggle.querySelectorAll(".chart-period-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      dailyChartMode = btn.dataset.mode;
      renderCombinedDailyChart("combinedDailyChart", "incomeChartTotal", "expenseChartTotal");
      renderCombinedBarChart("combinedBarChart");
    });
  });
})();

// -- نمای دوم (میله‌ای گروهی) همون داده‌ی نمودار ترکیبی — برای صفحه‌ی دومِ ورق‌زدنِ نمودار اول --
function renderCombinedBarChart(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const isYear = dailyChartMode === "year";
  const pool = isYear ? buildYearlyChartPool(todayJalali().jy) : buildDailyChartPool(10);

  const max = Math.max(...pool.map((p) => Math.max(p.income, p.expense))) || 1;
  const today = todayJalali();

  const cols = pool.map((p) => {
    const label = isYear ? JALALI_MONTHS_SHORT[p.jm - 1] : toPersianDigits(p.jd);
    const isToday = !isYear && p.jy === today.jy && p.jm === today.jm && p.jd === today.jd;
    const incomeH = Math.max((p.income / max) * 100, p.income > 0 ? 4 : 0);
    const expenseH = Math.max((p.expense / max) * 100, p.expense > 0 ? 4 : 0);
    return `
      <div class="dual-vbar-col ${isToday ? "is-today" : ""}">
        <div class="dual-vbar-bars">
          <div class="bar income" style="height:0%" data-target="${incomeH}"></div>
          <div class="bar expense" style="height:0%" data-target="${expenseH}"></div>
        </div>
        <span class="dual-vbar-label">${label}</span>
      </div>`;
  }).join("");

  if (max === 0 || pool.every((p) => !p.income && !p.expense)) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای این بازه نیست</p>`;
    return;
  }

  wrap.innerHTML = `<div class="dual-vbar-chart chart-graphic-enter">${cols}</div>`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wrap.querySelectorAll(".bar").forEach((el) => { el.style.height = el.dataset.target + "%"; });
    });
  });
}

// -- کاروسل کشویی به‌شکل «دسته کارت روی هم» — ورق‌خوردن با کشیدن یا زدن دات‌ها --
function setupChartCarousel(trackId, dotsId, onShow) {
  const track = document.getElementById(trackId);
  const dots = document.getElementById(dotsId);
  if (!track || !dots) return;
  const pages = Array.from(track.querySelectorAll(":scope > .chart-carousel-page"));
  const dotEls = Array.from(dots.children);
  if (!pages.length) return;
  let activeIndex = 0;
  let scrollTimer = null;

  function pageWidth() {
    return pages[0] ? pages[0].offsetWidth : (track.clientWidth || 1);
  }

  function setActive(index) {
    if (index < 0 || index >= pages.length) return;
    const changed = index !== activeIndex;
    activeIndex = index;
    dotEls.forEach((d, i) => d.classList.toggle("active", i === activeIndex));
    if (changed && onShow) onShow(activeIndex);
  }

  function goTo(index) {
    if (index < 0 || index >= pages.length) return;
    const left = pages[index].offsetLeft;
    track.scrollTo({ left, behavior: "smooth" });
    setActive(index);
  }

  dotEls.forEach((dot, i) => {
    dot.addEventListener("click", () => goTo(i));
  });

  track.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const w = pageWidth();
      const idx = Math.round(track.scrollLeft / w);
      setActive(Math.min(pages.length - 1, Math.max(0, idx)));
    }, 50);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (pages[activeIndex]) track.scrollLeft = pages[activeIndex].offsetLeft;
  });

  setActive(0);
}
setupChartCarousel("dailyChartTrack", "dailyChartDots", () => {
  // هر دو صفحه رو دوباره می‌سازیم (نه فقط صفحه‌ی تازه‌نمایان‌شده) تا انیمیشن گرافیکی همیشه پخش بشه
  renderCombinedDailyChart("combinedDailyChart", "incomeChartTotal", "expenseChartTotal");
  renderCombinedBarChart("combinedBarChart");
});
setupChartCarousel("compareChartTrack", "compareChartDots", () => {
  renderMonthCompareCard("incomeExpenseChart", analysisPeriod);
  renderIncomeExpensePieCompare("incomeExpensePie", analysisPeriod);
});


function computeMonthTotals(jy, jm) {
  const inMonth = (dateStr) => {
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    return j.jy === jy && j.jm === jm;
  };
  const incomes = state.incomes.filter((x) => inMonth(x.date));
  const expenses = state.expenses.filter((x) => inMonth(x.date));
  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const categories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount }));
  return { totalIncome, totalExpense, categories };
}


function renderTopTransactionsList(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const incomeItems = state.incomes
    .filter((x) => inViewedMonth(x.date))
    .map((x) => ({
      id: x.id, kind: "income", amount: x.amount, date: x.date,
      title: x.source || "درآمد", note: x.note || "",
      icon: INCOME_SOURCE_ICON[x.source] || "wallet",
      color: "#2F7A72",
    }));
  const expenseItems = state.expenses
    .filter((x) => inViewedMonth(x.date))
    .map((x) => ({
      id: x.id, kind: "expense", amount: x.amount, date: x.date,
      title: x.category, note: x.note || "",
      icon: catIcon(x.category),
      color: catColor(x.category),
    }));

  const all = [...incomeItems, ...expenseItems].sort((a, b) => b.amount - a.amount).slice(0, 8);

  if (!all.length) {
    wrap.innerHTML = `<p class="empty-hint">تراکنشی برای این ماه نیست</p>`;
    return;
  }

  const max = Math.max(...all.map((t) => t.amount)) || 1;
  wrap.innerHTML = `
    <div class="vbar-chart">
      ${all.map((tx, i) => `
        <div class="vbar-col">
          <span class="vbar-value">${tx.kind === "income" ? "+" : "−"}${fmtAmount(tx.amount)}</span>
          <div class="vbar" style="height:0%;background:${tx.color};" data-target="${Math.max((tx.amount / max) * 100, 6)}"></div>
          <span class="vbar-label">${tx.title}</span>
        </div>`).join("")}
    </div>`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wrap.querySelectorAll(".vbar").forEach((el) => { el.style.height = el.dataset.target + "%"; });
    });
  });
}

function renderAnalysis() {
  renderCombinedDailyChart("combinedDailyChart", "incomeChartTotal", "expenseChartTotal");
  renderCombinedBarChart("combinedBarChart");

  const inPeriod = (dateStr) => {
    if (analysisPeriod === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const d = new Date(gy, gm - 1, gd);
    const today = new Date();
    const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    
    if (analysisPeriod === "week") return daysDiff >= 0 && daysDiff < 7;
    if (analysisPeriod === "month") return inViewedMonth(dateStr);
    return true;
  };
  const expenses = state.expenses.filter((x) => inPeriod(x.date));
  const incomes = state.incomes.filter((x) => inPeriod(x.date));

  // Update title based on period
  const periodLabels = { "week": "این هفته", "month": isViewingCurrentMonth() ? "این ماه" : JALALI_MONTHS[viewedMonth.jm - 1], "all": "کل بازه" };
  const analysisTitle = document.querySelector(".ai-card-head h2");
  if (analysisTitle) {
    analysisTitle.textContent = `تحلیل هوشمند ${periodLabels[analysisPeriod]}`;
  }

  renderMonthCompareCard("incomeExpenseChart", analysisPeriod);
  renderIncomeExpensePieCompare("incomeExpensePie", analysisPeriod);
  renderTopTransactionsList("topTransactionsList");

  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const expenseSegments = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => ({ label: name, value: amt, color: catColor(name), icon: catIcon(name) }));
  renderPieChart("expenseDiversityChart", expenseSegments, "expense");
}

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
    navigator.serviceWorker.register("sw.js?v=90").catch(() => {});
  });
}

// ---------- AI Analysis Button (toggle + scroll collapse, shared by dashboard & analysis cards) ----------
function setupAiCardToggle(btnId, resultId, insightsId) {
  // غیرفعال — تحلیل توسط setupAiAnalyzeButton انجام می‌شود
  // قبلاً دکمه را مخفی می‌کرد و کلیک را بی‌اثر می‌ساخت
}
// setupAiCardToggle disabled


// ---------- AI card scroll collapse (نرم و پیوسته با اسکرول، شبیه هدر) ----------
function setupAiCardScrollCollapse(cardId, starId, btnId, resultId) {
  const card = document.getElementById(cardId);
  const star = document.getElementById(starId);
  const btn = document.getElementById(btnId);
  const result = document.getElementById(resultId);
  const scrollRoot = document.querySelector(".app-scroll");
  if (!card || !star || !scrollRoot) return;

  const FINAL_SCALE = 0.12;
  let dx = 0, dy = 0, collapseDistance = 160;

  function measureTarget() {
    const prevTransform = card.style.transform;
    card.style.transform = "none";
    const cardRect = card.getBoundingClientRect();
    card.style.transform = prevTransform;
    const starRect = star.getBoundingClientRect();
    const shrunkCenterX = cardRect.right - (cardRect.width * FINAL_SCALE) / 2;
    const shrunkCenterY = cardRect.top + (cardRect.height * FINAL_SCALE) / 2;
    const starCenterX = starRect.left + starRect.width / 2;
    const starCenterY = starRect.top + starRect.height / 2;
    dx = starCenterX - shrunkCenterX;
    dy = starCenterY - shrunkCenterY;
    collapseDistance = Math.max(cardRect.height * 0.75, 80);
  }
  measureTarget();
  window.addEventListener("resize", measureTarget);

  // Smooth easing for collapse
  function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  const applyCollapse = (rawCollapse) => {
    const collapse = easeInOutCubic(Math.min(Math.max(rawCollapse, 0), 1));
    const scale = 1 - collapse * (1 - FINAL_SCALE);
    const radius = 22 + collapse * 30;
    const fade = Math.max(0, (collapse - 0.5) / 0.5);
    const pull = Math.pow(collapse, 1.5);
    card.style.opacity = String(Math.max(0, 1 - fade));
    card.style.transform = `translate(${(dx * pull).toFixed(1)}px, ${(dy * pull).toFixed(1)}px) scale(${scale.toFixed(3)})`;
    card.style.borderRadius = `${radius.toFixed(1)}px`;
    card.style.pointerEvents = collapse > 0.6 ? "none" : "";
    star.style.opacity = String(Math.min(collapse * 1.2, 0.95));
    star.style.transform = `scale(${(0.4 + collapse * 0.6).toFixed(3)}) translateY(${((1 - collapse) * -8).toFixed(1)}px)`;
    star.style.pointerEvents = collapse > 0.5 ? "auto" : "none";
  };

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      applyCollapse(scrollRoot.scrollTop / collapseDistance);
      ticking = false;
    });
  }
  scrollRoot.addEventListener("scroll", onScroll, { passive: true });
  applyCollapse(scrollRoot.scrollTop / collapseDistance);

  star.addEventListener("click", () => {
    scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof window._runAiAnalyze === "function") {
      setTimeout(() => window._runAiAnalyze(), 280);
    } else if (btn) {
      btn.click();
    }
  });

  // Expose for tab switch reset
  window._aiCollapseReset = () => {
    measureTarget();
    applyCollapse(0);
  };
}
setupAiCardScrollCollapse("aiAnalysisCard", "aiFloatingStar", "btnAiAnalyze", "aiAnalysisResult");

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

// ==================== Todo Tab (کارها) ====================
const TODO_COLORS = [
  "#3B6EA5", "#E08A3C", "#3F9B6E", "#7C5CBF",
  "#D1548A", "#2FA0A0", "#C9A227", "#5A6B7A"
];
const TODO_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

function ensureTodoFolders() {
  if (!state.todoFolders || !Array.isArray(state.todoFolders) || !state.todoFolders.length) {
    state.todoFolders = [
      { id: uid(), name: "کارهای امروز", color: TODO_COLORS[0], tasks: [] }
    ];
    state.todoOpenFolderId = state.todoFolders[0].id;
    saveState({ sync: false });
  }
  if (!state.todoOpenFolderId || !state.todoFolders.some((f) => f.id === state.todoOpenFolderId)) {
    state.todoOpenFolderId = state.todoFolders[0].id;
  }
}

function todoFolderById(id) {
  return state.todoFolders.find((f) => f.id === id);
}

function renderTodo() {
  ensureTodoFolders();

  const dateLbl = document.getElementById("todoDateLabel");
  if (dateLbl) {
    const t = todayJalali();
    const now = new Date();
    dateLbl.textContent = `${TODO_WEEKDAYS[now.getDay()]}، ${toPersianDigits(t.jd)} ${JALALI_MONTHS[t.jm - 1]}`;
  }

  const stack = document.getElementById("todoFolderStack");
  const emptyHint = document.getElementById("todoEmptyHint");
  if (!stack) return;

  if (!state.todoFolders.length) {
    stack.innerHTML = "";
    if (emptyHint) emptyHint.style.display = "";
    return;
  }
  if (emptyHint) emptyHint.style.display = "none";

  const openFolder = todoFolderById(state.todoOpenFolderId);
  const otherFolders = state.todoFolders.filter((f) => f.id !== state.todoOpenFolderId);

  const openHTML = openFolder ? todoOpenFolderHTML(openFolder) : "";
  const collapsedHTML = otherFolders.map((f) => todoCollapsedFolderHTML(f)).join("");

  stack.innerHTML = openHTML + collapsedHTML;

  // اتصال رویدادهای پوشه‌ی باز
  if (openFolder) {
    const openEl = stack.querySelector(`.todo-folder-open[data-folder-id="${openFolder.id}"]`);
    if (openEl) {
      openEl.querySelectorAll(".todo-task-check").forEach((cb) => {
        cb.addEventListener("click", () => todoToggleTask(openFolder.id, cb.dataset.taskId));
      });
      openEl.querySelectorAll(".todo-task-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); todoDeleteTask(openFolder.id, btn.dataset.taskId); });
      });
      const form = openEl.querySelector(".todo-add-task-form");
      if (form) form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector(".todo-add-task-input");
        const tagInput = form.querySelector(".todo-add-task-tag-input");
        todoAddTask(openFolder.id, input.value, tagInput ? tagInput.value : "");
        input.value = "";
        if (tagInput) { tagInput.value = ""; tagInput.style.display = "none"; }
        const tagToggle = form.querySelector(".todo-add-task-tag-toggle");
        if (tagToggle) tagToggle.classList.remove("active");
        input.focus();
      });
      const tagToggle = openEl.querySelector(".todo-add-task-tag-toggle");
      const tagInputEl = openEl.querySelector(".todo-add-task-tag-input");
      if (tagToggle && tagInputEl) {
        tagToggle.addEventListener("click", () => {
          const showing = tagInputEl.style.display !== "none";
          tagInputEl.style.display = showing ? "none" : "";
          tagToggle.classList.toggle("active", !showing);
          if (!showing) tagInputEl.focus();
        });
      }
      const delFolderBtn = openEl.querySelector(".todo-folder-delete-btn");
      if (delFolderBtn) delFolderBtn.addEventListener("click", () => todoDeleteFolder(openFolder.id));
      const renameBtn = openEl.querySelector(".todo-folder-rename-btn");
      const titleEl = openEl.querySelector(".todo-folder-open-title");
      if (renameBtn && titleEl) {
        renameBtn.addEventListener("click", () => {
          titleEl.contentEditable = "true";
          titleEl.focus();
          document.execCommand("selectAll", false, null);
        });
        titleEl.addEventListener("blur", () => {
          titleEl.contentEditable = "false";
          const newName = titleEl.textContent.trim();
          if (newName && newName !== openFolder.name) {
            openFolder.name = newName.slice(0, 30);
            saveState();
          }
          renderTodo();
        });
        titleEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); }
        });
      }
    }
  }

  // اتصال رویداد باز کردن پوشه‌های جمع‌شده
  stack.querySelectorAll(".todo-folder-collapsed").forEach((el) => {
    el.addEventListener("click", () => {
      state.todoOpenFolderId = el.dataset.folderId;
      saveState({ sync: false });
      renderTodo();
    });
  });
}

function todoOpenFolderHTML(folder) {
  const doneCount = folder.tasks.filter((t) => t.done).length;
  const sorted = [...folder.tasks].sort((a, b) => Number(a.done) - Number(b.done));
  const tasksHTML = sorted.length
    ? sorted.map((t) => todoTaskRowHTML(t, folder.color)).join("")
    : `<p class="todo-folder-empty-tasks">کاری توی این پوشه نیست</p>`;
  return `
    <div class="todo-folder-open" data-folder-id="${folder.id}">
      <div class="todo-folder-open-header" style="background:${folder.color}">
        <div class="todo-folder-open-header-text">
          <span class="todo-folder-open-title" data-folder-id="${folder.id}">${escapeHtmlTodo(folder.name)}</span>
          <span class="todo-folder-open-count">${toPersianDigits(doneCount)} از ${toPersianDigits(folder.tasks.length)} انجام‌شده</span>
        </div>
        <div class="todo-folder-open-actions">
          <button type="button" class="todo-folder-icon-btn todo-folder-rename-btn" title="ویرایش نام">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button type="button" class="todo-folder-icon-btn todo-folder-delete-btn" title="حذف پوشه">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>
      </div>
      <div class="todo-folder-open-body">
        <div class="todo-task-list">${tasksHTML}</div>
        <form class="todo-add-task-form">
          <button type="button" class="todo-add-task-tag-toggle" title="افزودن برچسب">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41L11 3.83A2 2 0 009.83 3H4a1 1 0 00-1 1v5.83a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.82z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></svg>
          </button>
          <input type="text" class="todo-add-task-tag-input" placeholder="متن برچسب…" maxlength="14" style="display:none;">
          <input type="text" class="todo-add-task-input" placeholder="افزودن کار جدید…" maxlength="120">
          <button type="submit" class="todo-add-task-btn" style="background:${folder.color}">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </form>
      </div>
    </div>`;
}

function todoTaskRowHTML(t, folderColor) {
  const tagHTML = t.tag
    ? `<span class="todo-task-tag" style="background:${folderColor}22;color:${folderColor}">${escapeHtmlTodo(t.tag)}</span>`
    : "";
  return `
    <div class="todo-task-row ${t.done ? "is-done" : ""}">
      <button type="button" class="todo-task-check ${t.done ? "checked" : ""}" data-task-id="${t.id}" aria-label="انجام شد">
        ${t.done ? `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>` : ""}
      </button>
      <span class="todo-task-title">${escapeHtmlTodo(t.title)}</span>
      ${tagHTML}
    </div>`;
}

function todoCollapsedFolderHTML(folder) {
  return `
    <div class="todo-folder-collapsed" data-folder-id="${folder.id}" style="background:${folder.color}">
      <span class="todo-folder-collapsed-name">${escapeHtmlTodo(folder.name)}</span>
      <span class="todo-folder-collapsed-count">${toPersianDigits(folder.tasks.length)} کار</span>
    </div>`;
}

function escapeHtmlTodo(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function todoAddTask(folderId, title, tag) {
  const clean = (title || "").trim();
  if (!clean) return;
  const folder = todoFolderById(folderId);
  if (!folder) return;
  const cleanTag = (tag || "").trim().slice(0, 14);
  folder.tasks.push({ id: uid(), title: clean, done: false, tag: cleanTag || null, createdAt: Date.now() });
  saveState();
  renderTodo();
}

function todoToggleTask(folderId, taskId) {
  const folder = todoFolderById(folderId);
  if (!folder) return;
  const task = folder.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.done = !task.done;
  saveState();
  renderTodo();
}

function todoDeleteTask(folderId, taskId) {
  const folder = todoFolderById(folderId);
  if (!folder) return;
  folder.tasks = folder.tasks.filter((t) => t.id !== taskId);
  saveState();
  renderTodo();
}

function todoDeleteFolder(folderId) {
  if (state.todoFolders.length <= 1) {
    alert("حداقل باید یه پوشه بمونه");
    return;
  }
  const folder = todoFolderById(folderId);
  if (!folder) return;
  if (!confirm(`پوشه‌ی «${folder.name}» و همه‌ی کارهای توش حذف بشه؟`)) return;
  state.todoFolders = state.todoFolders.filter((f) => f.id !== folderId);
  if (state.todoOpenFolderId === folderId) state.todoOpenFolderId = state.todoFolders[0].id;
  saveState();
  renderTodo();
}

// ---- فرم افزودن پوشه‌ی جدید ----
(function initTodoNewFolderPanel() {
  const addBtn = document.getElementById("todoAddFolderBtn");
  const panel = document.getElementById("todoNewFolderPanel");
  const nameInput = document.getElementById("todoNewFolderName");
  const colorRow = document.getElementById("todoNewFolderColors");
  const cancelBtn = document.getElementById("todoNewFolderCancel");
  const saveBtn = document.getElementById("todoNewFolderSave");
  if (!addBtn || !panel) return;

  let selectedColor = TODO_COLORS[0];
  colorRow.innerHTML = TODO_COLORS.map((c, i) => `<button type="button" class="todo-color-swatch ${i === 0 ? "selected" : ""}" data-color="${c}" style="background:${c}"></button>`).join("");
  colorRow.querySelectorAll(".todo-color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      selectedColor = sw.dataset.color;
      colorRow.querySelectorAll(".todo-color-swatch").forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
    });
  });

  function openPanel() {
    panel.style.display = "";
    nameInput.value = "";
    selectedColor = TODO_COLORS[0];
    colorRow.querySelectorAll(".todo-color-swatch").forEach((s, i) => s.classList.toggle("selected", i === 0));
    nameInput.focus();
  }
  function closePanel() { panel.style.display = "none"; }

  addBtn.addEventListener("click", () => { panel.style.display === "none" || !panel.style.display ? openPanel() : closePanel(); });
  cancelBtn.addEventListener("click", closePanel);
  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    ensureTodoFolders();
    const folder = { id: uid(), name: name.slice(0, 30), color: selectedColor, tasks: [] };
    state.todoFolders.push(folder);
    state.todoOpenFolderId = folder.id;
    saveState();
    closePanel();
    renderTodo();
  });
})();

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

