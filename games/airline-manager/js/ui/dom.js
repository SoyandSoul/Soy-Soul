// DOM-Helfer. Bewusst klein: Templates als Strings, Events per Delegation über data-act.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Tagged Template: html`<b>${wert}</b>` escaped Werte automatisch. raw(x) markiert vertrauenswürdiges HTML. */
const RAW = Symbol("raw");
export const raw = s => ({ [RAW]: true, s: String(s) });
export function html(strings, ...vals) {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i >= vals.length) continue;
    const v = vals[i];
    if (v == null || v === false) continue;
    if (Array.isArray(v)) out += v.map(x => (x && x[RAW] ? x.s : esc(x))).join("");
    else out += v[RAW] ? v.s : esc(v);
  }
  return raw(out);
}

/** Klicks auf [data-act] an Handler weiterleiten: on(el, { buy: (btn, ev) => … }) */
export function delegate(el, handlers, type = "click") {
  el.addEventListener(type, ev => {
    const t = ev.target.closest("[data-act]");
    if (!t || !el.contains(t)) return;
    const fn = handlers[t.dataset.act];
    if (fn) fn(t, ev);
  });
}

export function tabs(current, list) {
  return html`<div class="tabs" role="tablist">${list.map(([id, label]) => html`<button role="tab" data-act="tab" data-tab="${id}" aria-selected="${String(id === current)}">${label}</button>`)}</div>`;
}
