/**
 * افکت سه‌بعدی سبک روی بلوک‌ها و ترنزیشن‌ها — بدون پس‌زمینه WebGL
 * (پس‌زمینه شلوغ Three.js حذف شد؛ عمق روی کارت‌ها و نمودارهاست)
 */
(function initUi3d() {
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (REDUCED) return;

  const SELECTOR = [
    ".settings-card",
    ".balance-hero-card",
    ".week-cal-card",
    ".summary-card",
  ].join(",");

  const maxTilt = 5; // درجه
  // این‌ها خودشون تعامل کشیدنیِ مختص خودشون رو دارن (مثل ورق‌زدن کارت‌ها یا اسلایدر بودجه)
  // پس اگه اشاره‌گر داخل اون‌هاست، نباید بلوک بیرونی هم کج بشه.
  const NO_TILT_INSIDE = ".chart-carousel-page, input[type=range], .todo-task-check, .todo-add-task-input, .todo-add-task-form, .todo-color-swatch, .todo-folder-open-title, .todo-new-folder-input, .todo-add-task-tag-toggle, .todo-add-task-tag-input";

  function bindTilt(el) {
    if (el.dataset.tiltBound === "1") return;
    el.dataset.tiltBound = "1";

    let raf = 0;
    function onMove(e) {
      if (e.target.closest && e.target.closest(NO_TILT_INSIDE)) {
        cancelAnimationFrame(raf);
        el.style.transform = "";
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - y) * maxTilt;
      const ry = (x - 0.5) * maxTilt;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(4px)`;
      });
    }
    function onLeave() {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    }
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    el.addEventListener("pointercancel", onLeave, { passive: true });
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(bindTilt);
  }

  // اولین اسکن + مشاهده تغییرات DOM (نمودارها دوباره ساخته می‌شوند)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  const mo = new MutationObserver(() => {
    clearTimeout(scan._t);
    scan._t = setTimeout(scan, 120);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // هنگام تعویض تب، اسکن دوباره
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTimeout(scan, 80));
  });

  window.__dakhlThree = {
    setPastMonth() {},
    rescan: scan,
  };
})();
