// =========================================================
// تنظیمات — بعد از دیپلوی Cloudflare Worker، آدرس worker رو اینجا بذار
// =========================================================
const CONFIG = {
  WORKER_URL: "https://dakhl-o-kharj.work-rezvanian.workers.dev"
};

const STORAGE_KEY = "dnk_data_v1";
const DEFAULT_CATEGORIES = ["خوراک", "حمل‌ونقل", "قبض‌ها", "خرید", "تفریح", "درمان", "سایر"];
const CATEGORY_COLORS = ["#1B7A4D", "#C9A227", "#B3452C", "#5B7CB0", "#8D6AB8", "#3C8C82", "#C97A3D", "#6B7A72"];

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        incomes: parsed.incomes || [],
        expenses: parsed.expenses || [],
        categories: (parsed.categories && parsed.categories.length) ? parsed.categories : DEFAULT_CATEGORIES.slice(),
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

// ---------- Helpers ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtAmount(n) { return Math.round(n).toLocaleString("fa-IR"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function catColor(name) {
  const idx = state.categories.indexOf(name);
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length];
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
document.getElementById("incomeDate").value = todayISO();
document.getElementById("expenseDate").value = todayISO();

document.getElementById("incomeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById("incomeAmount").value);
  if (!amount || amount <= 0) return;
  state.incomes.push({
    id: uid(),
    amount,
    source: document.getElementById("incomeSource").value,
    note: document.getElementById("incomeNote").value.trim(),
    date: document.getElementById("incomeDate").value || todayISO()
  });
  e.target.reset();
  document.getElementById("incomeDate").value = todayISO();
  saveState();
});

document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById("expenseAmount").value);
  const category = document.getElementById("expenseCategory").value;
  if (!amount || amount <= 0 || !category) return;
  state.expenses.push({
    id: uid(),
    amount,
    category,
    note: document.getElementById("expenseNote").value.trim(),
    date: document.getElementById("expenseDate").value || todayISO()
  });
  e.target.reset();
  document.getElementById("expenseDate").value = todayISO();
  saveState();
});

document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("categoryName");
  const name = input.value.trim();
  if (!name || state.categories.includes(name)) { input.value = ""; return; }
  state.categories.push(name);
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
  state.categories = state.categories.filter((c) => c !== name);
  if (!state.categories.includes("سایر")) state.categories.push("سایر");
  state.expenses.forEach((x) => { if (x.category === name) x.category = "سایر"; });
  saveState();
}

// ---------- Rendering ----------
function renderAll() {
  renderExpenseCategoryOptions();
  renderCategoryManageList();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
}

function renderExpenseCategoryOptions() {
  const sel = document.getElementById("expenseCategory");
  const current = sel.value;
  sel.innerHTML = state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  if (state.categories.includes(current)) sel.value = current;
}

function renderCategoryManageList() {
  const wrap = document.getElementById("categoryManageList");
  if (!state.categories.length) {
    wrap.innerHTML = `<p class="empty-hint">هنوز گروهی نساختی</p>`;
    return;
  }
  wrap.innerHTML = state.categories.map((c) => `
    <div class="category-manage-row">
      <span class="cat-name"><span class="cat-swatch" style="background:${catColor(c)}"></span>${c}</span>
      <button class="entry-delete" onclick="deleteCategory('${c.replace(/'/g, "\\'")}')">حذف</button>
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
  const initial = title ? title[0] : "؟";
  const sub = [formatDateFa(x.date), x.note].filter(Boolean).join(" · ");
  return `
    <div class="entry-row">
      <div class="entry-row-main">
        <span class="entry-icon ${isIncome ? "income-icon" : "expense-icon"}" style="${isIncome ? "" : `background:${catColor(x.category)}`}">${initial}</span>
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

function formatDateFa(iso) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { day: "2-digit", month: "short" });
  } catch (e) { return iso; }
}

function renderDashboard() {
  const period = document.getElementById("dashPeriod").value;
  const now = new Date();
  const inPeriod = (dateStr) => {
    if (period === "all") return true;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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

  // category breakdown
  const byCat = {};
  expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const catWrap = document.getElementById("categoryBreakdown");
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    catWrap.innerHTML = `<p class="empty-hint">هنوز خرجی برای این بازه ثبت نشده</p>`;
  } else {
    const max = rows[0][1];
    catWrap.innerHTML = rows.map(([name, amt]) => `
      <div class="cat-row">
        <div class="cat-row-top">
          <span class="cat-name"><span class="cat-swatch" style="background:${catColor(name)}"></span>${name}</span>
          <span class="cat-amount">${fmtAmount(amt)} تومان</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${(amt / max) * 100}%; background:${catColor(name)}"></div>
        </div>
      </div>
    `).join("");
  }

  // recent transactions (mixed)
  const recent = [
    ...state.incomes.map((x) => ({ ...x, _type: "income" })),
    ...state.expenses.map((x) => ({ ...x, _type: "expense" }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentWrap = document.getElementById("recentList");
  recentWrap.innerHTML = recent.length
    ? recent.map((x) => entryRowHTML(x, x._type)).join("")
    : `<p class="empty-hint">هنوز تراکنشی ثبت نشده</p>`;
}

document.getElementById("dashPeriod").addEventListener("change", renderDashboard);

// ---------- Sync ----------
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function refreshSyncUI() {
  const dot = document.getElementById("syncDot");
  const label = document.getElementById("syncLabel");
  const codeDisplay = document.getElementById("syncCodeDisplay");
  if (state.syncCode) {
    dot.classList.add("linked");
    label.textContent = "متصل";
    codeDisplay.textContent = state.syncCode;
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
  const code = document.getElementById("joinCodeInput").value.trim();
  if (!/^\d{6}$/.test(code)) { setSyncMsg("کد باید ۶ رقم باشه", true); return; }
  setSyncMsg("در حال اتصال...", false);
  const remote = await pullFromServer(code);
  if (remote) {
    state = { ...remote, syncCode: code };
    saveState({ sync: false });
    refreshSyncUI();
    setSyncMsg("متصل شد و اطلاعات همگام شد", false);
  } else {
    // no data yet under that code -> just adopt the code and push current state
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

// pull on load if already linked
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
