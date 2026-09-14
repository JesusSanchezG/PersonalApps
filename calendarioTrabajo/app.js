"use strict";

/* ============================================================
   Calendario 3×4 · aplicación de turnos laborales
   ============================================================ */

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* Semana A (lunes–martes y sábado–domingo trabajados) y su inversa B */
const PATTERN_A = [1, 1, 0, 0, 0, 1, 1]; // L M X J V S D
const PATTERN_B = [0, 0, 1, 1, 1, 0, 0];

const DEFAULT_REF = "2026-09-14";
const DEFAULT_TYPE = "A";
const WEEK_MS = 7 * 86400000;

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* almacenamiento no disponible: se mantiene en memoria */
    }
  },
  del(key) {
    localStorage.removeItem(key);
  },
};

const K_REF = "turno.ref.v1";
const K_OVER = "turno.overrides.v1";
const K_THEME = "turno.theme.v1";

const state = {
  ref: store.get(K_REF, { ref: DEFAULT_REF, type: DEFAULT_TYPE }),
  overrides: store.get(K_OVER, {}),
  view: new Date(),
  selected: null,
};

/* ---------------- date helpers (local time) ---------------- */

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromKey(key) {
  return new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), 12);
}

function noon(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/* Monday = 0 … Sunday = 6 */
function weekdayIndex(d) {
  return (d.getDay() + 6) % 7;
}

function diffDays(a, b) {
  return Math.round((noon(b) - noon(a)) / 86400000);
}

function mondayOf(key) {
  const d = fromKey(key);
  return addDays(d, -weekdayIndex(d));
}

function todayKey() {
  return toKey(new Date());
}

/* ---------------- schedule engine ---------------- */

function weekInfo(key) {
  const d = fromKey(key);
  const dow = weekdayIndex(d);
  const monday = mondayOf(key);
  const refMonday = mondayOf(state.ref.ref);
  const weeks = Math.floor(diffDays(refMonday, monday) / 7);
  const parity = weeks % 2 === 0 ? "A" : "B";
  const weekType = state.ref.type === "A" ? parity : (parity === "A" ? "B" : "A");
  const pattern = weekType === "A" ? PATTERN_A : PATTERN_B;
  return { weekType, dow, baseWork: pattern[dow] === 1 };
}

function getOverride(key) {
  const o = state.overrides[key];
  return o && (o.s || o.n) ? o : null;
}

function effectiveStatus(key, info) {
  const o = state.overrides[key];
  if (o && o.s) return o.s; // "work" | "rest"
  return info.baseWork ? "work" : "rest";
}

function statusLabel(status) {
  return status === "work" ? "Trabajas" : "Descansas";
}

const countOverrides = () => Object.values(state.overrides).filter(o => o && (o.s || o.n)).length;

/* ---------------- element refs ---------------- */

const $ = (id) => document.getElementById(id);

const els = {
  heroPill: $("heroPill"),
  heroWeek: $("heroWeek"),
  heroDay: $("heroDay"),
  heroDate: $("heroDate"),
  heroSub: $("heroSub"),
  calGrid: $("calGrid"),
  calTitle: $("calTitle"),
  todayBtn: $("todayBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  dateInput: $("dateInput"),
  themeToggle: $("themeToggle"),
  installBtn: $("installBtn"),
  settingsBtn: $("settingsBtn"),
  sheetBackdrop: $("sheetBackdrop"),
  sheetClose: $("sheetClose"),
  sheetDay: $("sheetDay"),
  sheetFull: $("sheetFull"),
  sheetPill: $("sheetPill"),
  sheetWeek: $("sheetWeek"),
  sheetBase: $("sheetBase"),
  sheetActions: $("sheetActions"),
  sheetReset: $("sheetReset"),
  sheetNote: $("sheetNote"),
  settingsBackdrop: $("settingsBackdrop"),
  settingsClose: $("settingsClose"),
  refDate: $("refDate"),
  refHint: $("refHint"),
  resetAll: $("resetAll"),
  settingsMeta: $("settingsMeta"),
};

/* ---------------- calendar rendering ---------------- */

function renderCalendar() {
  const year = state.view.getFullYear();
  const month = state.view.getMonth();
  els.calTitle.textContent = `${MONTHS[month]} ${year}`;

  const first = new Date(year, month, 1, 12);
  const blanks = weekdayIndex(first);
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const tKey = todayKey();

  let html = "";
  for (let i = 0; i < blanks; i++) html += `<div class="day blank"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toKey(new Date(year, month, day, 12));
    const info = weekInfo(key);
    const eff = effectiveStatus(key, info);
    const ovr = getOverride(key);
    const ovrStatus = ovr && ovr.s;
    const baseStatus = info.baseWork ? "work" : "rest";
    const cls = ["day"];
    if (ovrStatus && ovrStatus !== baseStatus) {
      cls.push(ovrStatus);
      cls.push(ovrStatus === "rest" ? "ovr-to-rest" : "ovr-to-work");
    } else {
      cls.push(eff);
    }
    if (key === tKey) cls.push("today");
    if (ovr && !ovr.s) cls.push("has-note");
    html += `<button type="button" class="${cls.join(" ")}" data-key="${key}" aria-label="${DAYSAcc(key, eff)}">
        <span class="week-tag">${info.weekType}</span><b class="num">${day}</b></button>`;
  }
  els.calGrid.innerHTML = html;

  const dateInputKey = state.selected && fromKey(state.selected).getMonth() === month
    && fromKey(state.selected).getFullYear() === year
    ? state.selected : tKey;
  els.dateInput.value = dateInputKey;

  els.calGrid.querySelectorAll(".day[data-key]").forEach((cell) => {
    cell.addEventListener("click", () => openSheet(cell.dataset.key));
  });
}

function DAYSAcc(key, eff) {
  const d = fromKey(key);
  return `${DAYS[weekdayIndex(d)]} ${d.getDate()}, ${statusLabel(eff).toLowerCase()}`;
}

/* ---------------- hero (hoy) ---------------- */

function renderHero() {
  const key = todayKey();
  const d = fromKey(key);
  const info = weekInfo(key);
  const eff = effectiveStatus(key, info);
  const ovr = getOverride(key);

  els.heroDay.textContent = DAYS[weekdayIndex(d)];
  els.heroDate.textContent = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  els.heroPill.textContent = statusLabel(eff);
  els.heroPill.classList.toggle("rest", eff === "rest");
  els.heroWeek.textContent = `Semana ${info.weekType}`;
  els.heroSub.textContent = ovr
    ? `Día modificado · ${ovr.n ? `“${ovr.n}”` : "ajuste manual"}`
    : `Según tu turno 3×4 · es un día de ${eff === "work" ? "trabajo" : "descanso"}`;
}

/* ---------------- month navigation ---------------- */

function setMonth(delta) {
  state.view = new Date(state.view.getFullYear(), state.view.getMonth() + delta, 1, 12);
  renderCalendar();
}

function goToday() {
  state.view = new Date();
  renderCalendar();
  renderHero();
}

/* ---------------- day sheet ---------------- */

function openSheet(key) {
  state.selected = key;
  const d = fromKey(key);
  const info = weekInfo(key);
  const eff = effectiveStatus(key, info);
  const ovr = getOverride(key);

  els.sheetDay.textContent = DAYS[weekdayIndex(d)];
  els.sheetFull.textContent = `${d.getDate()} · ${MONTHS[d.getMonth()]} · ${d.getFullYear()}`;
  els.sheetPill.textContent = statusLabel(eff);
  els.sheetPill.classList.toggle("rest", eff === "rest");
  els.sheetWeek.textContent = `Semana ${info.weekType}`;
  els.sheetBase.textContent =
    `Base del turno: ${info.baseWork ? "periodo de trabajo" : "periodo de descanso"}` +
    (ovr && ovr.s ? ` · modificado manualmente` : "");
  els.sheetNote.value = (ovr && ovr.n) || "";
  els.sheetReset.hidden = !(ovr && ovr.s);
  showSheet(els.sheetBackdrop);
}

function setOverride(status) {
  if (!state.selected) return;
  const o = state.overrides[state.selected] || {};
  o.s = status;
  state.overrides[state.selected] = o;
  store.set(K_OVER, state.overrides);
  openSheet(state.selected);
  renderCalendar();
  renderHero();
  syncSettingsMeta();
}

function resetOverride() {
  if (!state.selected) return;
  const o = state.overrides[state.selected];
  if (o && o.n) { delete o.s; state.overrides[state.selected] = o.n ? o : null; }
  else delete state.overrides[state.selected];
  if (JSON.stringify(state.overrides) === "{}") store.del(K_OVER);
  else store.set(K_OVER, state.overrides);
  openSheet(state.selected);
  renderCalendar();
  renderHero();
  syncSettingsMeta();
}

function saveNote() {
  if (!state.selected) return;
  const note = els.sheetNote.value.trim();
  const o = state.overrides[state.selected] || {};
  o.n = note || undefined;
  if (o.n || o.s) state.overrides[state.selected] = o;
  else delete state.overrides[state.selected];
  store.set(K_OVER, state.overrides);
  renderCalendar();
  syncSettingsMeta();
}

function showSheet(backdrop) {
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
}
function hideSheet(backdrop) {
  backdrop.hidden = true;
  document.body.style.overflow = "";
}

/* ---------------- settings ---------------- */

function renderSettings() {
  els.refDate.value = state.ref.ref;
  els.refHint.textContent =
    state.ref.type === "A"
      ? "Semana A: trabajas lunes–martes y sábado–domingo."
      : "Semana B: descansas lunes–martes y sábado–domingo.";
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.rtype === state.ref.type);
  });
  const n = countOverrides();
  els.settingsMeta.textContent = n
    ? `Tienes ${n} día${n === 1 ? "" : "s"} modificado${n === 1 ? "" : "s"} guardado${n === 1 ? "" : "s"}.`
    : "Sin modificaciones guardadas.";
}

function saveRef() {
  store.set(K_REF, state.ref);
  renderCalendar();
  renderHero();
  renderSettings();
}

function onRefDateChange() {
  const value = els.refDate.value;
  if (!value) return;
  const chosen = fromKey(value);
  const monday = mondayOf(toKey(chosen));
  state.ref.ref = toKey(monday);
  state.ref.type = state.ref.type; // keep
  saveRef();
  if (toKey(chosen) !== state.ref.ref) els.refDate.value = state.ref.ref;
}

function changeRefType() {
  state.ref.type = state.ref.type === "A" ? "B" : "A";
  saveRef();
}

function resetAll() {
  const msg = countOverrides()
    ? "Se borrarán todos los días modificados y se restaurará la semana base original. ¿Continuar?"
    : "¿Restaurar la semana base original (14 de septiembre de 2026)?";
  if (!confirm(msg)) return;
  store.del(K_OVER);
  state.overrides = {};
  state.ref = { ref: DEFAULT_REF, type: DEFAULT_TYPE };
  store.set(K_REF, state.ref);
  hideSheet(els.settingsBackdrop);
  renderCalendar();
  renderHero();
  renderSettings();
}

function syncSettingsMeta() {
  if (!els.settingsBackdrop.hidden) renderSettings();
}

/* ---------------- theme ---------------- */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  store.set(K_THEME, theme);
}
function initTheme() {
  const saved = store.get(K_THEME, null);
  if (saved) return applyTheme(saved);
  applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  applyTheme(cur === "dark" ? "light" : "dark");
}

/* ---------------- date jump ---------------- */

function jumpToDate() {
  const value = els.dateInput.value;
  if (!value) return;
  const d = fromKey(value);
  state.view = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  renderCalendar();
  openSheet(value);
  renderHero();
}

/* ---------------- install PWA ---------------- */

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});
els.installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => {
  els.installBtn.hidden = true;
});

/* ---------------- service worker ---------------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------------- events ---------------- */

els.prevBtn.addEventListener("click", () => setMonth(-1));
els.nextBtn.addEventListener("click", () => setMonth(1));
els.todayBtn.addEventListener("click", goToday);
els.dateInput.addEventListener("change", jumpToDate);
els.themeToggle.addEventListener("click", toggleTheme);
els.settingsBtn.addEventListener("click", () => { renderSettings(); showSheet(els.settingsBackdrop); });
els.settingsClose.addEventListener("click", () => hideSheet(els.settingsBackdrop));
els.sheetClose.addEventListener("click", () => hideSheet(els.sheetBackdrop));
[els.sheetBackdrop, els.settingsBackdrop].forEach((bd) => {
  bd.addEventListener("click", (e) => { if (e.target === bd) hideSheet(bd); });
});

els.sheetActions.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-set]");
  if (!btn) return;
  setOverride(btn.dataset.set);
});
els.sheetReset.addEventListener("click", resetOverride);
els.sheetNote.addEventListener("change", saveNote);

document.querySelectorAll(".seg-btn").forEach((b) => {
  b.addEventListener("click", () => {
    state.ref.type = b.dataset.rtype;
    saveRef();
    renderSettings();
  });
});
els.refDate.addEventListener("change", onRefDateChange);
els.resetAll.addEventListener("click", resetAll);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideSheet(els.sheetBackdrop);
    hideSheet(els.settingsBackdrop);
  }
});

/* ---------------- init ---------------- */

initTheme();
renderCalendar();
renderHero();

setInterval(() => { renderHero(); }, 60000); // mantiene "hoy" al día