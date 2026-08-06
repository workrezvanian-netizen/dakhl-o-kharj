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
  "#2F7A72", "#E0793A", "#8D6AB8", "#3B82C4", "#C24A2E",
  "#C9A227", "#4FA89E", "#D9578F", "#6B9E4A", "#B0708C",
  "#5B7CB0", "#C97A3D"
];
const CARD_PALETTE = [
  { bg: "#FEE2E2", icon: "#EF4444" }, // Red
  { bg: "#FFEDD5", icon: "#F97316" }, // Orange
  { bg: "#FEF08A", icon: "#EAB308" }, // Yellow
  { bg: "#DCFCE7", icon: "#22C55E" }, // Green
  { bg: "#CFFAFE", icon: "#0EA5E9" }, // Blue
  { bg: "#E9D5FF", icon: "#8B5CF6" }, // Purple
  { bg: "#FCE7F3", icon: "#EC4899" }, // Pink
  { bg: "#CCFBF1", icon: "#14B8A6" }  // Teal
];
const INCOME_CARD_PALETTE = [
  { bg: "#DCFCE7", icon: "#22C55E" }, // Bright Green
  { bg: "#CCFBF1", icon: "#14B8A6" }, // Teal
  { bg: "#CFFAFE", icon: "#0EA5E9" }, // Blue
  { bg: "#E9D5FF", icon: "#8B5CF6" }, // Purple
  { bg: "#FEF08A", icon: "#EAB308" }  // Yellow
];
const INCOME_SOURCES = ["حقوق", "پاداش", "فروش", "هدیه", "سایر"];

let state = loadState();
let selectedExpenseCategoryName = null;
let selectedNewCategoryIcon = ICON_CHOICES[0];
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
        categories,
        syncCode: parsed.syncCode || null,
        updatedAt: parsed.updatedAt || Date.now()
      };
    }
  } catch (e) { /* ignore corrupt state */ }
  return { incomes: [], expenses: [], categories: DEFAULT_CATEGORIES.slice(), syncCode: null, updatedAt: Date.now() };
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

  setTimeout(() => {
    const DURATION = 650;
    const greeting = document.getElementById("welcomeGreeting");
    greeting.style.transition = "opacity .3s ease";
    greeting.style.opacity = "0";

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
  }, 2000);
}
initWelcomeScreen();

document.getElementById("btnDismissInstallGuide").addEventListener("click", () => {
  document.getElementById("installGuide").hidden = true;
});

// ---------- Tabs ----------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
function switchTab(tab, opts = {}) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add("active");
  if (tab === "entry" && !opts.keepExpenseFilter && expenseListFilter) {
    expenseListFilter = null;
    renderExpenseList();
  }
  if (tab === "analysis") renderAnalysis();
}

document.getElementById("dashSettingsBtn").addEventListener("click", () => switchTab("settings"));

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
  e.target.reset();
  setDatePickerToToday("income");
  resetDateQuickPicker("income");
  saveState();
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
  e.target.reset();
  setDatePickerToToday("expense");
  resetDateQuickPicker("expense");
  saveState();
});

// ---------- Category form ----------
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("categoryName");
  const name = input.value.trim();
  if (!name || state.categories.some((c) => c.name === name)) { input.value = ""; return; }
  state.categories.push({ name, icon: selectedNewCategoryIcon });
  input.value = "";
  saveState();
});

function deleteIncome(id) {
  state.incomes = state.incomes.filter((x) => x.id !== id);
  saveState();
}
function deleteExpense(id) {
  state.expenses = state.expenses.filter((x) => x.id !== id);
  saveState();
}
function deleteCategory(name) {
  const inUse = state.expenses.some((x) => x.category === name);
  if (inUse && !confirm("این گروه برای چند خرج ثبت‌شده استفاده شده. حذف بشه؟ خرج‌ها گروه‌شون «سایر» می‌شه.")) return;
  state.categories = state.categories.filter((c) => c.name !== name);
  if (!state.categories.some((c) => c.name === "سایر")) state.categories.push({ name: "سایر", icon: "package" });
  state.expenses.forEach((x) => { if (x.category === name) x.category = "سایر"; });
  saveState();
}

// ---------- Rendering ----------
function renderAll() {
  renderExpenseCategoryPicker();
  renderCategoryManageList();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderAnalysis();
}

function renderExpenseCategoryPicker() {
  const wrap = document.getElementById("expenseCategoryPicker");
  if (!selectedExpenseCategoryName || !state.categories.some((c) => c.name === selectedExpenseCategoryName)) {
    selectedExpenseCategoryName = state.categories[0] ? state.categories[0].name : null;
  }
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">اول یک گروه بساز (تب دسته‌ها)</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => `
    <button type="button" class="category-chip ${c.name === selectedExpenseCategoryName ? "selected" : ""}" data-name="${c.name}">
      ${iconSpanHTML(c.icon)}<span class="chip-name">${c.name}</span>
    </button>
  `).join("");
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

function renderCategoryManageList() {
  const wrap = document.getElementById("categoryManageList");
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">هنوز گروهی نساختی</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => `
    <div class="category-manage-row">
      <span class="cat-name">${iconSpanHTML(c.icon)}${c.name}</span>
      <button class="entry-delete" onclick="deleteCategory('${c.name.replace(/'/g, "\\'")}')">حذف</button>
    </div>
  `).join("");
}

function sortEntriesDesc(items) {
  return items.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

function renderIncomeList() {
  const wrap = document.getElementById("incomeList");
  const items = sortEntriesDesc([...state.incomes]);
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint">هنوز درآمدی ثبت نشده</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "income")).join("");
}

function renderExpenseList() {
  const wrap = document.getElementById("expenseList");
  const clearBtn = document.getElementById("expenseListFilterClear");
  const titleEl = document.getElementById("expenseListTitle");
  let items = [...state.expenses];
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
    wrap.innerHTML = `<p class="empty-hint">${expenseListFilter ? "خرجی در این گروه ثبت نشده" : "هنوز خرجی ثبت نشده"}</p>`;
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
  return `
    <div class="entry-row">
      <div class="entry-row-main">
        <span class="entry-icon ${isIncome ? "income-icon" : "expense-icon"}" style="${isIncome ? "" : `background:${catColor(x.category)}`}">${iconSpanHTML(iconKey)}</span>
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

function updateMonthLabel() {
  const label = document.getElementById("monthLabel");
  label.textContent = JALALI_MONTHS[viewedMonth.jm - 1];
}

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, -1);
  renderDashboard();
});
document.getElementById("nextMonthBtn").addEventListener("click", () => {
  dashboardMode = "month";
  viewedMonth = addMonthsJalali(viewedMonth.jy, viewedMonth.jm, 1);
  renderDashboard();
});

function renderDashboard() {
  updateMonthLabel();
  const inPeriod = (dateStr) => {
    if (dashboardMode === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    return j.jy === viewedMonth.jy && j.jm === viewedMonth.jm;
  };

  const incomes = state.incomes.filter((x) => inPeriod(x.date));
  const expenses = state.expenses.filter((x) => inPeriod(x.date));

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
  const balance = totalIncome - totalExpense;

  document.getElementById("dashIncomeTotal").textContent = fmtAmount(totalIncome);
  document.getElementById("dashExpenseTotal").textContent = fmtAmount(totalExpense);
  document.getElementById("dashIncomeChip").textContent = fmtAmount(totalIncome);
  document.getElementById("dashExpenseChip").textContent = fmtAmount(totalExpense);
  const balEl = document.getElementById("dashBalance");
  balEl.textContent = fmtAmount(balance) + " تومان";
  balEl.classList.toggle("negative", balance < 0);

  const total = totalIncome + totalExpense;
  const incomePct = total ? (totalIncome / total) * 100 : 50;
  const expensePct = total ? (totalExpense / total) * 100 : 50;
  document.getElementById("scaleIncomeBar").style.width = incomePct + "%";
  document.getElementById("scaleExpenseBar").style.width = expensePct + "%";

  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const catWrap = document.getElementById("categoryBreakdown");
  if (!state.categories.length) {
    catWrap.innerHTML = `<p class="empty-hint">اول یک گروه بساز (تب دسته‌ها)</p>`;
  } else {
    catWrap.innerHTML = state.categories.map((c, i) => {
      const palette = CARD_PALETTE[i % CARD_PALETTE.length];
      const amt = byCat[c.name] || 0;
      return `
        <button type="button" class="quick-cat-card" style="background:${palette.bg}" onclick="quickAddExpense('${c.name.replace(/'/g, "\\'")}')">
          <span class="quick-cat-bubble" style="background:${palette.icon}22">${iconSpanHTML(c.icon, `color:${palette.icon}`)}</span>
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
        <span class="quick-cat-bubble" style="background:${palette.icon}22">${iconSpanHTML(iconKey, `color:${palette.icon}`)}</span>
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
let analysisPeriod = "month";
let analysisPeriodSmartInsights = "month";
let analysisPeriodIncomeExpense = "month";
const setupPeriodToggle = (toggleId, variable) => {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  toggle.querySelectorAll(".chart-period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (variable === "main") analysisPeriod = btn.dataset.period;
      else if (variable === "smart") analysisPeriodSmartInsights = btn.dataset.period;
      else if (variable === "incomeExpense") analysisPeriodIncomeExpense = btn.dataset.period;
      toggle.querySelectorAll(".chart-period-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      renderAnalysis();
    });
  });
};
setupPeriodToggle("analysisPeriodToggle", "expense");
setupPeriodToggle("incomeExpensePeriodToggle", "incomeExpense");

function renderMonthCompareCard(containerId, period = "month") {
  const wrap = document.getElementById(containerId);
  
  // Get data based on period
  let curData, prevData;
  if (period === "month") {
    const t = todayJalali();
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
    // all time - just show all data vs empty
    curData = {
      totalIncome: state.incomes.reduce((s, x) => s + x.amount, 0),
      totalExpense: state.expenses.reduce((s, x) => s + x.amount, 0),
      categories: []
    };
    prevData = { totalIncome: 0, totalExpense: 0, categories: [] };
  }

  if (!curData.totalIncome && !curData.totalExpense && !prevData.totalIncome && !prevData.totalExpense) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای مقایسه نیست</p>`;
    return;
  }

  const defs = [
    { key: "expense", label: "مخارج", curV: curData.totalExpense, prevV: prevData.totalExpense, goodWhenDown: true },
    { key: "income", label: "درآمد", curV: curData.totalIncome, prevV: prevData.totalIncome, goodWhenDown: false }
  ];

  const PREV_COLOR = "#C9A227";
  
  // Set legend labels based on period
  const periodLabels = {
    "month": { cur: "این ماه", prev: "ماه قبل" },
    "week": { cur: "این هفته", prev: "هفته قبل" },
    "all": { cur: "کل", prev: "-" }
  };
  const periodLabel = periodLabels[period] || periodLabels["month"];

  const gauges = defs.map((g) => {
    const increased = g.curV > g.prevV;
    const changePct = g.prevV > 0 ? Math.round(((g.curV - g.prevV) / g.prevV) * 100) : (g.curV > 0 ? 100 : 0);
    const isGood = g.prevV === 0 && g.curV === 0 ? null : (g.goodWhenDown ? !increased : increased);
    
    // 4 modern, vibrant, distinct colors
    let colorA, colorB;
    if (g.key === "income") {
      // Teal/Cyan for income
      colorA = isGood === false ? "#ef4444" : "#14b8a6";
      colorB = isGood === false ? "#dc2626" : "#0d9488";
    } else {
      // Violet/Purple for expense
      colorA = isGood === false ? "#ef4444" : "#8b5cf6";
      colorB = isGood === false ? "#dc2626" : "#7c3aed";
    }
    
    let emoji = "😴";
    if (isGood === true) emoji = changePct === 0 ? "🙂" : "🎉";
    else if (isGood === false) emoji = "😬";
    const maxV = Math.max(g.curV, g.prevV) || 1;
    const outerPct = (g.curV / maxV) * 100;
    const innerPct = (g.prevV / maxV) * 100;
    return { ...g, outerPct, innerPct, changePct, colorA, colorB, emoji };
  });

  const cx = 60, cy = 60;
  const rOuter = 40, swOuter = 9;
  const rInner = 27, swInner = 7;
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  const uid = Date.now();

  const gaugeHTML = gauges.map((g, i) => {
    const dashOuter = (g.outerPct / 100) * circOuter;
    const dashInner = (g.innerPct / 100) * circInner;
    return `
      <div class="compare-gauge">
        <svg viewBox="0 0 120 120" class="compare-gauge-svg">
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
            stroke="${PREV_COLOR}" stroke-width="${swInner}" stroke-linecap="round"
            stroke-dasharray="0 ${circInner}" transform="rotate(-90 ${cx} ${cy})"
            data-dash="${dashInner}" data-circ="${circInner}"/>
        </svg>
        <div class="compare-gauge-center">
          <span class="compare-gauge-emoji">${g.emoji}</span>
          <span class="compare-gauge-pct" style="color:${g.colorB}">${g.changePct > 0 ? "+" : ""}${toPersianDigits(g.changePct)}٪</span>
        </div>
        <div class="compare-gauge-label">${g.label}</div>
        <div class="compare-gauge-legend">
          <span><i style="background:${g.colorB}"></i>${periodLabel.cur}: ${fmtAmount(g.curV)}</span>
          <span><i style="background:${PREV_COLOR}"></i>${periodLabel.prev}: ${fmtAmount(g.prevV)}</span>
        </div>
      </div>`;
  }).join("");

  wrap.innerHTML = `<div class="compare-gauges-row">${gaugeHTML}</div>`;
  
  // Add description
  const descEl = document.getElementById("incomeExpenseDescription");
  if (descEl) {
    let desc = "";
    if (period === "month") {
      const increase = curData.totalExpense > prevData.totalExpense;
      desc = `مقایسه هزینه‌های این ماه با ماه قبل`;
    } else if (period === "week") {
      desc = `مقایسه هزینه‌های این هفته با هفته قبل`;
    } else if (period === "all") {
      desc = `کل درآمد و هزینه‌های تاکنونی`;
    }
    descEl.textContent = desc;
  }

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

function renderPieChart(containerId, segments, chartType = "expense") {
  const wrap = document.getElementById(containerId);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) {
    wrap.innerHTML = `<p class="empty-hint">داده‌ای برای این بازه نیست</p>`;
    return;
  }
  const visible = segments.filter((s) => s.value > 0);
  
  // Override colors based on chart type
  if (chartType === "income") {
    const incomeColors = ["#10B981", "#059669", "#047857", "#065F46"];
    visible.forEach((seg, i) => { seg.color = incomeColors[i % incomeColors.length]; });
  } else if (chartType === "expense") {
    // Vibrant expense colors
    const expenseColors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6"];
    visible.forEach((seg, i) => { seg.color = expenseColors[i % expenseColors.length]; });
  }
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

function renderAnalysis() {
  const inPeriod = (dateStr) => {
    if (analysisPeriod === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const d = new Date(gy, gm - 1, gd);
    const today = new Date();
    const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    
    if (analysisPeriod === "week") return daysDiff >= 0 && daysDiff < 7;
    if (analysisPeriod === "month") {
      const j = toJalaali(gy, gm, gd);
      const t = todayJalali();
      return j.jy === t.jy && j.jm === t.jm;
    }
    return true;
  };
  const expenses = state.expenses.filter((x) => inPeriod(x.date));
  const incomes = state.incomes.filter((x) => inPeriod(x.date));
  
  // Smart insights based on selected period
  const smartInPeriod = (dateStr) => {
    if (analysisPeriodSmartInsights === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const d = new Date(gy, gm - 1, gd);
    const today = new Date();
    const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    
    if (analysisPeriodSmartInsights === "week") return daysDiff >= 0 && daysDiff < 7;
    if (analysisPeriodSmartInsights === "month") {
      const j = toJalaali(gy, gm, gd);
      const t = todayJalali();
      return j.jy === t.jy && j.jm === t.jm;
    }
    return true;
  };
  
  const smartExpenses = state.expenses.filter((x) => smartInPeriod(x.date));
  const smartIncomes = state.incomes.filter((x) => smartInPeriod(x.date));
  const totalExpense = smartExpenses.reduce((s, x) => s + x.amount, 0);
  const totalIncome = smartIncomes.reduce((s, x) => s + x.amount, 0);
  const lastWeekExpense = state.expenses
    .filter((x) => {
      const [gy, gm, gd] = x.date.split("-").map(Number);
      const d = new Date(gy, gm - 1, gd);
      const today = new Date();
      const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      return daysDiff >= 7 && daysDiff < 14;
    })
    .reduce((s, x) => s + x.amount, 0);
  const avgDaily = totalExpense > 0 ? Math.round(totalExpense / (analysisPeriodSmartInsights === "week" ? 7 : 30)) : 0;
  
  let insightMsg = "";
  if (totalExpense === 0) {
    insightMsg = "📊 فعلاً خرجی ثبت نشده";
  } else if (lastWeekExpense > totalExpense * 0.4) {
    insightMsg = "⚠️ هفته پیش‌رو بیش‌تر از حد نرمال خرج شده";
  } else if (totalExpense < avgDaily * (analysisPeriodSmartInsights === "week" ? 3 : 15)) {
    insightMsg = "✨ خرج این دوره کم‌تر از معمول است";
  }
  
  // Update title based on period
  const periodLabels = { "week": "این هفته", "month": "این ماه", "all": "کل بازه" };
  const analysisTitle = document.querySelector(".ai-card-head h2");
  if (analysisTitle) {
    analysisTitle.textContent = `تحلیل هوشمند ${periodLabels[analysisPeriodSmartInsights]}`;
  }
  
  const insightEl = document.getElementById("smartInsights");
  if (insightEl) {
    if (insightMsg) {
      insightEl.innerHTML = `<div style="background:rgba(79,168,158,0.1);padding:12px 14px;border-radius:12px;border-left:3px solid #4FA89E;font-size:13px;color:var(--text);">${insightMsg}</div>`;
    } else {
      insightEl.innerHTML = "";
    }
  }

  renderMonthCompareCard("incomeExpenseChart", analysisPeriodIncomeExpense);

  // Filter expenses based on incomeExpense period (linked)
  const inDiversityPeriod = (dateStr) => {
    if (analysisPeriodIncomeExpense === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const d = new Date(gy, gm - 1, gd);
    const today = new Date();
    const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    
    if (analysisPeriodIncomeExpense === "week") return daysDiff >= 0 && daysDiff < 7;
    if (analysisPeriodIncomeExpense === "month") {
      const j = toJalaali(gy, gm, gd);
      const t = todayJalali();
      return j.jy === t.jy && j.jm === t.jm;
    }
    return true;
  };
  
  const diversityExpenses = state.expenses.filter((x) => inDiversityPeriod(x.date));
  const byCat = {};
  diversityExpenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const expenseSegments = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => ({ label: name, value: amt, color: catColor(name), icon: catIcon(name) }));
  renderPieChart("expenseDiversityChart", expenseSegments, "expense");
  
  // Add description for expense diversity (synced with income-expense period)
  const descEl = document.getElementById("expenseDiversityDescription");
  if (descEl) {
    let desc = "";
    if (analysisPeriodIncomeExpense === "month") {
      desc = `توزیع مخارج این ماه بر اساس دسته‌بندی`;
    } else if (analysisPeriodIncomeExpense === "week") {
      desc = `توزیع مخارج این هفته بر اساس دسته‌بندی`;
    } else if (analysisPeriodIncomeExpense === "all") {
      desc = `توزیع کل مخارج بر اساس دسته‌بندی`;
    }
    descEl.textContent = desc;
  }
}

// ---------- AI analysis ----------
document.getElementById("btnAiAnalyze").addEventListener("click", async () => {
  const resultBox = document.getElementById("aiAnalysisResult");
  const btn = document.getElementById("btnAiAnalyze");
  if (CONFIG.WORKER_URL.includes("YOUR-SUBDOMAIN")) {
    resultBox.innerHTML = `<div class="ai-result-error">😅 هنوز آدرس سرور تنظیم نشده.</div>`;
    return;
  }
  btn.disabled = true;
  resultBox.innerHTML = `<div class="ai-result-loading"><span class="ai-spin"></span>در حال تحلیل این ماه...</div>`;

  const t = todayJalali();
  const lastM = addMonthsJalali(t.jy, t.jm, -1);
  const thisMonth = computeMonthTotals(t.jy, t.jm);
  const lastMonth = computeMonthTotals(lastM.jy, lastM.jm);

  try {
    const res = await fetch(`${CONFIG.WORKER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thisMonth, lastMonth })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.summary) {
      const code = data && data.error;
      let msg = "متأسفانه الان نشد تحلیل کنم، یه‌بار دیگه امتحان کن.";
      if (code === "no_ai_binding") {
        msg = "😅 هنوز Workers AI به این Worker وصل نشده. باید توی wrangler.toml بخش [ai] رو اضافه کنی و دوباره دیپلوی کنی.";
      } else if (code === "ai_request_failed") {
        msg = "سرور هوش مصنوعی جواب درستی نداد. یه‌بار دیگه امتحان کن.";
        if (data && data.detail) msg += `<br><small style="opacity:.75">جزئیات: ${data.detail}</small>`;
      } else if (code === "empty_response" || code === "no summary") {
        msg = "جواب خالی برگشت، یه‌بار دیگه امتحان کن.";
      } else if (res.status === 404) {
        msg = "این قابلیت هنوز روی Worker آپلود نشده. مطمئن شو worker.js جدید رو آپلود کردی.";
      }
      resultBox.innerHTML = `<div class="ai-result-error">${msg}</div>`;
      return;
    }
    resultBox.innerHTML = `<div class="ai-result-text">${data.summary.replace(/\n/g, "<br>")}</div>`;
  } catch (e) {
    resultBox.innerHTML = `<div class="ai-result-error">اتصال به سرور برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.</div>`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Sync ----------
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

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
  state.syncCode = genCode();
  saveState({ sync: false });
  refreshSyncUI();
  await pushToServer();
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
  if (!confirm("همه درآمدها، مخارج و گروه‌های این دستگاه حذف بشه؟ این کار برگشت‌ناپذیره.")) return;
  const keepCode = state.syncCode;
  state = { incomes: [], expenses: [], categories: DEFAULT_CATEGORIES.slice(), syncCode: keepCode, updatedAt: Date.now() };
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
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Header scroll collapse ----------
const appScroll = document.getElementById("appScroll");
const appHeader = document.querySelector(".app-header");
let lastScrollTop = 0;
let headerCollapseTimer = null;

if (appScroll) {
  appScroll.addEventListener("scroll", () => {
    const scrollTop = appScroll.scrollTop;
    clearTimeout(headerCollapseTimer);
    
    if (scrollTop > 12) {
      if (!appHeader.classList.contains("is-compact")) {
        appHeader.classList.add("is-compact");
      }
    } else {
      appHeader.classList.remove("is-compact");
    }
    lastScrollTop = scrollTop;
  }, { passive: true });
}

// ---------- Init ----------
renderAll();
refreshSyncUI();
initSync();
