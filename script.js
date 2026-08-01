// =========================================================
// تنظیمات
// =========================================================
const CONFIG = {
  WORKER_URL: "https://dakhl-o-kharj.work-rezvanian.workers.dev"
};

const STORAGE_KEY = "dnk_data_v1";
const EMOJI_CHOICES = ["🍔","🚗","🧾","🛍️","🎬","💊","🏠","📚","🎁","✈️","☕","⚡","📱","🐾","👕","🧴","🎮","🧒","💰","📦","🏋️","🎓","🐶","🧹"];
const DEFAULT_CATEGORIES = [
  { name: "خوراک", emoji: "🍔" },
  { name: "حمل‌ونقل", emoji: "🚗" },
  { name: "قبض‌ها", emoji: "🧾" },
  { name: "خرید", emoji: "🛍️" },
  { name: "تفریح", emoji: "🎬" },
  { name: "درمان", emoji: "💊" },
  { name: "سایر", emoji: "📦" }
];
const DEFAULT_EMOJI_MAP = { "خوراک": "🍔", "حمل‌ونقل": "🚗", "قبض‌ها": "🧾", "خرید": "🛍️", "تفریح": "🎬", "درمان": "💊", "سایر": "📦" };
const INCOME_SOURCE_EMOJI = { "حقوق": "💼", "پاداش": "🎉", "فروش": "🏷️", "هدیه": "🎁", "سایر": "💰" };
const CATEGORY_COLORS = ["#1B7A4D", "#C9A227", "#B3452C", "#5B7CB0", "#8D6AB8", "#3C8C82", "#C97A3D", "#6B7A72"];
const CARD_PALETTE = [
  { bg: "#FBEED9", icon: "#E8A83C" },
  { bg: "#DCEBFB", icon: "#3B82C4" },
  { bg: "#FBE4D8", icon: "#E0793A" },
  { bg: "#EDE1F7", icon: "#9B6FC9" },
  { bg: "#FBDCE0", icon: "#D9534F" },
  { bg: "#DFF3EA", icon: "#2FA97A" },
  { bg: "#E4EFE0", icon: "#6B8E5A" },
  { bg: "#E7E7EF", icon: "#6B6FA0" }
];
const INCOME_CARD_PALETTE = [
  { bg: "#DDF3EA", icon: "#1B7A4D" },
  { bg: "#E7F5EF", icon: "#3C8C82" },
  { bg: "#E3F1DE", icon: "#6B8E5A" },
  { bg: "#FBF2D8", icon: "#C9A227" },
  { bg: "#E4EEF6", icon: "#5B7CB0" }
];
const INCOME_SOURCES = ["حقوق", "پاداش", "فروش", "هدیه", "سایر"];

let state = loadState();
let selectedExpenseCategoryName = null;
let selectedNewCategoryEmoji = EMOJI_CHOICES[0];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let categories = parsed.categories;
      if (!categories || !categories.length) {
        categories = DEFAULT_CATEGORIES.slice();
      } else if (typeof categories[0] === "string") {
        // migrate old string-based categories to {name, emoji}
        categories = categories.map((name) => ({ name, emoji: DEFAULT_EMOJI_MAP[name] || "🏷️" }));
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

  fillDayOptions(prefix, jd);

  function fillDayOptions(prefix, selectedDay) {
    const len = jalaaliMonthLength(Number(yearSel.value), Number(monthSel.value));
    const days = [];
    for (let d = 1; d <= len; d++) days.push(d);
    daySel.innerHTML = days.map((d) => `<option value="${d}">${toPersianDigits(d)}</option>`).join("");
    daySel.value = Math.min(selectedDay, len);
  }

  monthSel.addEventListener("change", () => fillDayOptions(prefix, Number(daySel.value) || 1));
  yearSel.addEventListener("change", () => fillDayOptions(prefix, Number(daySel.value) || 1));
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

// ---------- Helpers ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function catColor(name) {
  const idx = state.categories.findIndex((c) => c.name === name);
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length];
}
function catEmoji(name) {
  const cat = state.categories.find((c) => c.name === name);
  return cat ? cat.emoji : "🏷️";
}

// ---------- Tabs ----------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add("active");
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
    date: getISOFromDatePicker("income")
  });
  e.target.reset();
  setDatePickerToToday("income");
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
    date: getISOFromDatePicker("expense")
  });
  e.target.reset();
  setDatePickerToToday("expense");
  saveState();
});

// ---------- Category form ----------
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("categoryName");
  const name = input.value.trim();
  if (!name || state.categories.some((c) => c.name === name)) { input.value = ""; return; }
  state.categories.push({ name, emoji: selectedNewCategoryEmoji });
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
  if (!state.categories.some((c) => c.name === "سایر")) state.categories.push({ name: "سایر", emoji: "📦" });
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
      <span class="chip-emoji">${c.emoji}</span><span class="chip-name">${c.name}</span>
    </button>
  `).join("");
  wrap.querySelectorAll(".category-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedExpenseCategoryName = btn.dataset.name;
      renderExpenseCategoryPicker();
    });
  });
}

function renderCategoryEmojiPicker() {
  const wrap = document.getElementById("categoryEmojiPicker");
  wrap.innerHTML = EMOJI_CHOICES.map((e) => `
    <button type="button" class="emoji-chip ${e === selectedNewCategoryEmoji ? "selected" : ""}" data-emoji="${e}">${e}</button>
  `).join("");
  wrap.querySelectorAll(".emoji-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedNewCategoryEmoji = btn.dataset.emoji;
      renderCategoryEmojiPicker();
    });
  });
}
renderCategoryEmojiPicker();

function renderCategoryManageList() {
  const wrap = document.getElementById("categoryManageList");
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">هنوز گروهی نساختی</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => `
    <div class="category-manage-row">
      <span class="cat-name"><span class="chip-emoji">${c.emoji}</span>${c.name}</span>
      <button class="entry-delete" onclick="deleteCategory('${c.name.replace(/'/g, "\\'")}')">حذف</button>
    </div>
  `).join("");
}

function renderIncomeList() {
  const wrap = document.getElementById("incomeList");
  const items = [...state.incomes].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint">هنوز درآمدی ثبت نشده</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "income")).join("");
}

function renderExpenseList() {
  const wrap = document.getElementById("expenseList");
  const items = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { wrap.innerHTML = `<p class="empty-hint">هنوز خرجی ثبت نشده</p>`; return; }
  wrap.innerHTML = items.map((x) => entryRowHTML(x, "expense")).join("");
}

function entryRowHTML(x, type) {
  const isIncome = type === "income";
  const title = isIncome ? x.source : x.category;
  const iconContent = isIncome ? (INCOME_SOURCE_EMOJI[x.source] || "💰") : catEmoji(x.category);
  const sub = [formatDateFa(x.date), x.note].filter(Boolean).join(" · ");
  return `
    <div class="entry-row">
      <div class="entry-row-main">
        <span class="entry-icon ${isIncome ? "income-icon" : "expense-icon"}" style="${isIncome ? "" : `background:${catColor(x.category)}`}">${iconContent}</span>
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

function renderDashboard() {
  const period = document.getElementById("dashPeriod").value;
  const todayJ = todayJalali();
  const inPeriod = (dateStr) => {
    if (period === "all") return true;
    const [gy, gm, gd] = dateStr.split("-").map(Number);
    const j = toJalaali(gy, gm, gd);
    return j.jy === todayJ.jy && j.jm === todayJ.jm;
  };

  const incomes = state.incomes.filter((x) => inPeriod(x.date));
  const expenses = state.expenses.filter((x) => inPeriod(x.date));

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
  const balance = totalIncome - totalExpense;

  document.getElementById("dashIncomeTotal").textContent = fmtAmount(totalIncome);
  document.getElementById("dashExpenseTotal").textContent = fmtAmount(totalExpense);
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
          <span class="quick-cat-bubble" style="background:${palette.icon}22; color:${palette.icon}">${c.emoji}</span>
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
    return `
      <button type="button" class="quick-cat-card" style="background:${palette.bg}" onclick="quickAddIncome('${source.replace(/'/g, "\\'")}')">
        <span class="quick-cat-bubble" style="background:${palette.icon}22; color:${palette.icon}">${INCOME_SOURCE_EMOJI[source] || "💰"}</span>
        <span class="quick-cat-name">${source}</span>
        <span class="quick-cat-amount">${fmtAmount(amt)}</span>
      </button>`;
  }).join("");

  const recent = [
    ...state.incomes.map((x) => ({ ...x, _type: "income" })),
    ...state.expenses.map((x) => ({ ...x, _type: "expense" }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentWrap = document.getElementById("recentList");
  recentWrap.innerHTML = recent.length
    ? recent.map((x) => entryRowHTML(x, x._type)).join("")
    : `<p class="empty-hint">هنوز تراکنشی ثبت نشده</p>`;
}

function quickAddExpense(categoryName) {
  selectedExpenseCategoryName = categoryName;
  renderExpenseCategoryPicker();
  switchTab("expense");
  setTimeout(() => document.getElementById("expenseAmount").focus(), 150);
}

function quickAddIncome(source) {
  const sel = document.getElementById("incomeSource");
  if ([...sel.options].some((o) => o.value === source)) sel.value = source;
  switchTab("income");
  setTimeout(() => document.getElementById("incomeAmount").focus(), 150);
}

document.getElementById("dashPeriod").addEventListener("change", renderDashboard);

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
