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

const CARD_PALETTE = [
  { bg: "#FBEED9", icon: "#E8A83C" },
  { bg: "#DCEBFB", icon: "#3B82C4" },
  { bg: "#FBE4D8", icon: "#E0793A" },
  { bg: "#EDE1F7", icon: "#9B6FC9" },
  { bg: "#FBDCE0", icon: "#D9534F" },
  { bg: "#E3F1EF", icon: "#4FA89E" },
  { bg: "#E4EFE0", icon: "#6B8E5A" },
  { bg: "#E7E7EF", icon: "#6B6FA0" }
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
  group.querySelectorAll(".date-quick-btn-clay").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".date-quick-btn-clay").forEach((b) => b.classList.remove("Selected-Teal"));
      btn.classList.add("Selected-Teal");
      dateQuickMode[prefix] = btn.dataset.value;
      customWrap.style.display = btn.dataset.value === "custom" ? "grid" : "none";
    });
  });
}
function resetDateQuickPicker(prefix) {
  dateQuickMode[prefix] = "today";
  const group = document.getElementById(prefix + "DateQuick");
  group.querySelectorAll(".date-quick-btn-clay").forEach((b) => b.classList.toggle("Selected-Teal", b.dataset.value === "today"));
  document.getElementById(prefix + "CustomDate").style.display = "none";
}
setupDateQuickPicker("income");
setupDateQuickPicker("expense");

// ---------- Helpers ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
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

// ---------- Tabs ----------
document.querySelectorAll(".nav-btn-clay").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".nav-btn-clay").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  const navBtn = document.querySelector(`.nav-btn-clay[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add("active");
}

document.getElementById("dashSettingsBtn").addEventListener("click", () => switchTab("settings"));

// ---------- Entry mode toggle (income/expense merged tab) ----------
document.querySelectorAll("#entryModeToggle .entry-mode-btn-clay").forEach((btn) => {
  btn.addEventListener("click", () => setEntryMode(btn.dataset.mode));
});
function setEntryMode(mode) {
  document.querySelectorAll("#entryModeToggle .entry-mode-btn-clay").forEach((b) => {
    b.classList.toggle("Selected-Teal", b.dataset.mode === mode);
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
    date: getSelectedISO("income")
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
    date: getSelectedISO("expense")
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
    <button type="button" class="category-chip-clay Pill-shaped Neumorphic-soft Inward-shadow ${c.name === selectedExpenseCategoryName ? "Selected-Teal Clay-Teal-dark" : "Clay-Cream"}" data-name="${c.name}" style="border: none; padding: 10px 16px">
      ${iconSpanHTML(c.icon)}<span class="chip-name" style="margin-right: 8px">${c.name}</span>
    </button>
  `).join("");
  wrap.querySelectorAll(".category-chip-clay").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedExpenseCategoryName = btn.dataset.name;
      renderExpenseCategoryPicker();
    });
  });
}

function renderCategoryIconPicker() {
  const wrap = document.getElementById("categoryIconPicker");
  wrap.innerHTML = ICON_CHOICES.map((key) => `
    <button type="button" class="icon-chip-clay Circle-shaped Neumorphic-soft Inward-shadow ${key === selectedNewCategoryIcon ? "Selected-Teal Clay-Teal-dark" : "Clay-Cream"}" data-icon="${key}" style="border: none; padding: 10px">
      ${iconSpanHTML(key)}
    </button>
  `).join("");
  wrap.querySelectorAll(".icon-chip-clay").forEach((btn) => {
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
    <div class="category-manage-row-clay Pill-shaped Neumorphic-hard Clay-Cream-soft">
      <span class="cat-name">${iconSpanHTML(c.icon, `color:var(--teal-dark)`)}<span style="margin-right: 8px">${c.name}</span></span>
      <button class="entry-delete" onclick="deleteCategory('${c.name.replace(/'/g, "\\'")}')">حذف</button>
    </div>
  `).join("");
}

function renderIncomeList() {
  const wrap = document.getElementById("incomeList");
  const items = [...state.incomes].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint Georgia-font Neumorphic-hard Clay-Teal-light" style="padding: 16px; font-size: 14px">هنوز درآمدی ثبت نشده</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "income")).join("");
}

function renderExpenseList() {
  const wrap = document.getElementById("expenseList");
  const items = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint Georgia-font Neumorphic-hard Clay-Teal-light" style="padding: 16px; font-size: 14px">هنوز خرجی ثبت نشده</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "expense")).join("");
}

function entryRowHTML(x, type) {
  const isIncome = type === "income";
  const title = isIncome ? x.source : x.category;
  const iconKey = isIncome ? (INCOME_SOURCE_ICON[x.source] || "wallet") : catIcon(x.category);
  const sub = [formatDateFa(x.date), x.note].filter(Boolean).join(" · ");
  return `
    <div class="entry-row-pill-shaped Pill-shaped Neumorphic-hard Clay-Cream-soft" style="display:flex; align-items:center; justify-content:space-between; padding: 12px 16px">
      <div class="entry-row-main" style="display:flex; align-items:center; gap:12px">
        <span class="entry-icon ${isIncome ? "income-icon-clay" : "expense-icon-clay"}" style="width: 40px; height: 40px; border-radius: 12px; display:flex; align-items:center; justify-content:center; color: #fff; ${isIncome ? `background:var(--teal-light)` : `background:var(--red-coral)`}">${iconSpanHTML(iconKey, `color:#fff; width: 20px; height: 20px`)}</span>
        <div>
          <div class="entry-title" style="font-size: 14px; font-weight: 700; color: var(--green-deep)">${title}</div>
          <div class="entry-sub" style="font-size: 12px; color: var(--text-mute); margin-top: 2px">${sub}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="entry-amount-clay Georgia-font" style="font-weight: 800; font-size: 14px; ${isIncome ? `color:var(--green-deep)` : `color:var(--expense)`}">${isIncome ? "+" : "−"}${fmtAmount(x.amount)}</span>
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
        <button type="button" class="quick-cat-card-clay Outward-shadow Clay-Teal-dark" style="border: none; transition: transform .12s ease" onclick="quickAddExpense('${c.name.replace(/'/g, "\\'")}')" onmousedown="this.style.transform='scale(0.96)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
          <span class="quick-cat-bubble Neumorphic-soft Inward-shadow" style="background: rgba(0,0,0,0.1)">${iconSpanHTML(c.icon, `color:#fff`)}</span>
          <span class="quick-cat-name">${c.name}</span>
          <span class="quick-cat-amount Georgia-font">${fmtAmount(amt)}</span>
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
      <button type="button" class="quick-cat-card-clay Outward-shadow Clay-Teal-light" style="border: none; transition: transform .12s ease" onclick="quickAddIncome('${source.replace(/'/g, "\\'")}')" onmousedown="this.style.transform='scale(0.96)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
        <span class="quick-cat-bubble Neumorphic-soft Inward-shadow" style="background: rgba(0,0,0,0.1)">${iconSpanHTML(iconKey, `color:#fff`)}</span>
        <span class="quick-cat-name">${source}</span>
        <span class="quick-cat-amount Georgia-font">${fmtAmount(amt)}</span>
      </button>`;
  }).join("");
}

function quickAddExpense(categoryName) {
  selectedExpenseCategoryName = categoryName;
  renderExpenseCategoryPicker();
  switchTab("entry");
  setEntryMode("expense");
  setTimeout(() => document.getElementById("expenseAmount").focus(), 150);
}

function quickAddIncome(source) {
  const sel = document.getElementById("incomeSource");
  if ([...sel.options].some((o) => o.value === source)) sel.value = source;
  switchTab("entry");
  setEntryMode("income");
  setTimeout(() => document.getElementById("incomeAmount").focus(), 150);
}

// ---------- Analysis charts ----------
let analysisPeriod = "month";
document.querySelectorAll("#analysisPeriodToggle .chart-period-btn-clay-soft").forEach((btn) => {
  btn.addEventListener("click", () => {
    analysisPeriod = btn.dataset.period;
    document.querySelectorAll("#analysisPeriodToggle .chart-period-btn-clay-soft").forEach((b) => b.classList.remove("Selected-Teal"));
    btn.classList.add("Selected-Teal");
    renderAnalysis();
  });
});

function renderIncomeExpenseRings(containerId, income, expense) {
  const wrap = document.getElementById(containerId);
  if (!income && !expense) {
    wrap.innerHTML = `<p class="empty-hint Georgia-font Neumorphic-hard Clay-Teal-light" style="padding: 16px; font-size: 14px">داده‌ای برای این بازه نیست</p>`;
    return;
  }
  const ratio = income > 0 ? expense / income : (expense > 0 ? 1.5 : 0);
  const pctClamped = Math.min(ratio, 1) * 100;
  const isOver = ratio > 1;
  const r1 = 76, r2 = 58, cx = 95, cy = 95, sw = 18; // sw = stroke-width
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const dash2 = (pctClamped / 100) * c2;

  let emoji = "😌";
  if (isOver) emoji = "😅";
  else if (pctClamped >= 80) emoji = "😬";
  else if (pctClamped <= 30) emoji = "🎉";

  const expenseColorA = isOver ? "#D9432C" : "#E0793A";
  const expenseColorB = isOver ? "#C24A2E" : "#DA7A52";

  wrap.innerHTML = `
    <div class="rings-wrap-clay" style="position: relative; width: 190px; height: 190px; margin: 4px auto 20px;">
      <svg viewBox="0 0 190 190" class="rings-svg-clay" style="width: 100%; height: 100%;">
        <defs>
          <linearGradient id="ringIncome-${containerId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#52B2AB"/>
            <stop offset="100%" stop-color="#2F7A72"/>
          </linearGradient>
          <linearGradient id="ringExpense-${containerId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${expenseColorA}"/>
            <stop offset="100%" stop-color="${expenseColorB}"/>
          </linearGradient>
          <filter id="shadowIncome-${containerId}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.15)"/>
          </filter>
           <filter id="shadowExpense-${containerId}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.15)"/>
          </filter>
        </defs>
        <circle class="ring-track-clay Inward-shadow" cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="var(--cream-soft)" stroke-width="${sw}" style="box-shadow: inset 2px 2px 4px var(--shadow-dark)"/>
        <circle class="ring-seg-clay Neumorphic-soft Outward-shadow" id="ringSeg1-${containerId}" cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="url(#ringIncome-${containerId})" stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="0 ${c1}" transform="rotate(-90 ${cx} ${cy})" style="filter:url(#shadowIncome-${containerId}); transition: stroke-dasharray .7s cubic-bezier(.4,0,.2,1)"/>
        <circle class="ring-track-clay Inward-shadow" cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="var(--cream-soft)" stroke-width="${sw}" style="box-shadow: inset 2px 2px 4px var(--shadow-dark)"/>
        <circle class="ring-seg-clay Neumorphic-soft Outward-shadow" id="ringSeg2-${containerId}" cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="url(#ringExpense-${containerId})" stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="0 ${c2}" transform="rotate(-90 ${cx} ${cy})" style="filter:url(#shadowExpense-${containerId}); transition: stroke-dasharray .6s ease"/>
      </svg>
      <div class="rings-center-clay Georgia-font Neumorphic-hard Clay-Teal-light" style="position: absolute; inset: 0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 0 20px">
        <span class="rings-emoji" style="font-size: 26px; line-height: 1">${emoji}</span>
        <span class="rings-pct-clay Georgia-font" style="font-size: 20px; font-weight: 800; color: var(--cream)">${toPersianDigits(Math.round(ratio * 100))}٪</span>
        <span class="rings-sub-clay Georgia-font" style="font-size: 11px; color: var(--cream); opacity: 0.8; font-weight: 600">خرج از درآمد</span>
      </div>
    </div>
    <div class="rings-legend-clay Georgia-font Neumorphic-hard Clay-Teal-light" style="border: none; border-top: 1px dashed rgba(27,122,77,0.2); border-radius: 0; padding-top: 16px; margin-top: 16px; display:flex; flex-direction:column; gap:10px">
      <div class="rings-legend-row-clay Pill-shaped Neumorphic-hard Clay-Teal-light" style="background: none; border: none; box-shadow: none; display:flex; align-items:center; gap:8px"><span class="legend-dot-clay Circle-shaped Neumorphic-soft Inward-shadow Clay-Cream" style="width: 10px; height: 10px"></span><span class="legend-label">درآمد</span><span class="legend-amt Georgia-font">${fmtAmount(income)}</span></div>
      <div class="rings-legend-row-clay Pill-shaped Neumorphic-hard Clay-Teal-light" style="background: none; border: none; box-shadow: none; display:flex; align-items:center; gap:8px"><span class="legend-dot-clay Circle-shaped Neumorphic-soft Inward-shadow Clay-Red-Coral" style="width: 10px; height: 10px"></span><span class="legend-label">مخارج</span><span class="legend-amt Georgia-font">${fmtAmount(expense)}</span></div>
    </div>
    ${isOver ? `<p class="rings-warning-clay" style="margin: 10px 2px 0; font-size: 12px; color: var(--expense); text-align: center; font-weight: 600">😅 این ماه خرجت از درآمدت بیشتر شده!</p>` : ""}
  `;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const seg1 = document.getElementById(`ringSeg1-${containerId}`);
      const seg2 = document.getElementById(`ringSeg2-${containerId}`);
      if (seg1) seg1.setAttribute("stroke-dasharray", `${c1} ${c1}`);
      if (seg2) seg2.setAttribute("stroke-dasharray", `${dash2} ${c2 - dash2}`);
    });
  });
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function renderPieChart(containerId, segments) {
  const wrap = document.getElementById(containerId);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) {
    wrap.innerHTML = `<p class="empty-hint Georgia-font Neumorphic-hard Clay-Teal-light" style="padding: 16px; font-size: 14px">داده‌ای برای این بازه نیست</p>`;
    return;
  }
  const visible = segments.filter((s) => s.value > 0);
  const cx = 95, cy = 95, r = 85;
  let cumulative = 0;

  let slices;
  if (visible.length === 1) {
    slices = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${visible[0].color}"/>`;
  } else {
    slices = visible.map((seg) => {
      const startAngle = (cumulative / total) * 360;
      cumulative += seg.value;
      const endAngle = (cumulative / total) * 360;
      const p1 = polarPoint(cx, cy, r, startAngle);
      const p2 = polarPoint(cx, cy, r, endAngle);
      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
      return `<path d="M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z" fill="${seg.color}" stroke="var(--cream-soft)" stroke-width="3"/>`;
    }).join("");
  }

  const legend = visible.map((seg) => {
    const pct = Math.round((seg.value / total) * 100);
    const iconHTML = `<span class="legend-icon-clay-pill Pill-shaped Neumorphic-soft Inward-shadow" style="width: 32px; height: 32px; padding: 4px; display:flex; align-items:center; justify-content:center; flex-shrink: 0; overflow: hidden; background: rgba(0,0,0,0.08);">${iconSpanHTML(seg.icon, `color:${seg.color}`)}</span>`;
    return `
      <div class="chart-legend-row-clay Pill-shaped Neumorphic-hard Clay-Cream-soft" style="display:flex; align-items:center; gap:12px; padding: 10px 14px; margin-bottom: 10px">
        ${iconHTML}
        <span class="legend-label" style="flex: 1; font-weight: 700; color: var(--green-deep); font-size: 13.5px">${seg.label}</span>
        <span class="legend-pct-clay Georgia-font Neumorphic-hard Clay-Teal-light" style="padding: 4px 10px 6px; border-radius: 999px; font-size: 11px; font-weight: 700; background: ${seg.color}22; color: ${seg.color}">${toPersianDigits(pct)}٪</span>
        <span class="legend-amt Georgia-font" style="font-size: 12.5px">${fmtAmount(seg.value)}</span>
      </div>`;
  }).join("");

  wrap.innerHTML = `
    <div class="pie-wrap-clay" style="width: 190px; height: 190px; margin: 4px auto 20px;">
      <svg viewBox="0 0 190 190" class="pie-svg-clay" style="width: 100%; height: 100%;">
        <defs>
          <filter id="pieShadow-${containerId}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="rgba(0,0,0,0.18)"/>
          </filter>
        </defs>
        <g style="filter:url(#pieShadow-${containerId})">${slices}</g>
      </svg>
    </div>
    <div class="chart-legend Georgia-font Neumorphic-hard Clay-Teal-light" style="border: none; border-top: 1px dashed rgba(27,122,77,0.2); border-radius: 0; padding-top: 16px; margin-top: 16px">${legend}</div>
  `;
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
    const j = toJalaali(gy, gm, gd);
    const t = todayJalali();
    return j.jy === t.jy && j.jm === t.jm;
  };
  const incomes = state.incomes.filter((x) => inPeriod(x.date));
  const expenses = state.expenses.filter((x) => inPeriod(x.date));
  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);

  renderIncomeExpenseRings("incomeExpenseChart", totalIncome, totalExpense);

  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const pieSegments = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => ({ label: name, value: amt, color: catColor(name), icon: catIcon(name) }));
  renderPieChart("expenseDiversityChart", pieSegments);
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
  resultBox.innerHTML = `<div class="ai-result-loading" style="color: #fff; font-size: 13px; display:flex; align-items:center; gap:8px"><span class="ai-spin" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; animation: ai-spin-anim 0.8s linear infinite"></span>در حال تحلیل این ماه...</div>`;
   applyStaticIcons();

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
    resultBox.innerHTML = `<div class="ai-result-text" style="color:#fff">${data.summary.replace(/\n/g, "<br>")}</div>`;
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

// ---------- Init ----------
renderAll();
refreshSyncUI();
initSync();
const CACHE_NAME = "dakhl-o-kharj-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/watermark-nelin.png"
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