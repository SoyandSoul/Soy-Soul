// Browser-Benachrichtigungen – nur dann, wenn wirklich etwas wartet.
//
// Das Spiel läuft nebenher; eine Meldung ist nur dann willkommen, wenn sie eine Entscheidung
// verlangt, die niemand sonst trifft: ein Flugzeug ohne Strecke, ein auslaufender Leasingvertrag,
// ein überfälliger Check, eine fällige Kreditrate. Alles, was sich von selbst erledigt,
// bleibt stumm.
//
// Erlaubnis wird nur auf Knopfdruck gefragt (Browser verlangen das ohnehin), und es gibt
// eine Sperre, damit dieselbe Sache nicht stündlich meldet.

import { prefs } from "../core/store.js";
import { CHECKS, LEASE, DAY, H } from "../core/config.js";
import { isLeased } from "../sim/lease.js";
import { mostUrgent } from "../sim/maintenance.js";
import { openLoans } from "../sim/credit.js";

const KEY = "notify-on", SEEN = "notify-seen";
const QUIET_MS = 6 * 3600_000;    // dieselbe Sache höchstens alle sechs Stunden

export const supported = () => typeof Notification !== "undefined";
export const enabled = () => supported() && prefs.get(KEY, false) && Notification.permission === "granted";
export const permission = () => (supported() ? Notification.permission : "unsupported");

/** Einschalten – fragt die Erlaubnis ab. Muss aus einem Klick heraus aufgerufen werden. */
export async function enable() {
  if (!supported()) return "unsupported";
  let p = Notification.permission;
  if (p === "default") p = await Notification.requestPermission();
  prefs.set(KEY, p === "granted");
  return p;
}

export function disable() { prefs.set(KEY, false); }

/** Was gerade eine Entscheidung verlangt. Reine Funktion über den Spielstand. */
export function pending(state, now) {
  const out = [];
  // Störfälle zuerst: Hier läuft eine Frist, alles andere kann warten.
  for (const c of (state.irops || [])) {
    if (c.done || now >= c.deadline) continue;
    out.push({ id: "irops-" + c.id, title: "Flugzeug steht fest",
      text: `${c.reg} in ${c.at_city}: schwerer Defekt, ${c.pax} Fluggäste. Entscheidung bis ${new Date(c.deadline).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}, sonst wird gewartet.` });
  }

  const idle = state.fleet.filter(a => a.status === "idle" && !a.charter);
  if (idle.length) out.push({ id: "idle", title: "Flugzeug ohne Strecke",
    text: `${idle.map(a => a.reg).join(", ")} steht am Drehkreuz und verdient nichts.` });

  for (const ac of state.fleet) {
    if (ac.status === "crashed") continue;
    const u = mostUrgent(ac, now);
    if (u?.state === "overdue") out.push({ id: "check-" + ac.id, title: "Wartung überfällig",
      text: `${ac.reg}: ${u.check}-Check ist überfällig. Jeder weitere Flug erhöht das Risiko.` });
    if (isLeased(ac) && ac.lease.until - now < 7 * DAY) out.push({ id: "lease-" + ac.id, title: "Leasingvertrag läuft aus",
      text: `${ac.reg} bei ${ac.lease.lessor}: noch ${Math.max(0, Math.round((ac.lease.until - now) / DAY))} Tage. Ohne Entscheidung wird automatisch verlängert.` });
  }

  for (const l of openLoans(state)) {
    if (l.nextDue - now > 2 * DAY) continue;
    if (state.cash >= l.payment) continue;
    out.push({ id: "loan-" + l.id, title: "Kreditrate nicht gedeckt",
      text: `${l.bank}: ${Math.round(l.payment / 1e3)} k$ fällig am ${new Date(l.nextDue).toLocaleDateString("de-DE")}, die Kasse reicht nicht.` });
  }

  if (state.cash < 0) out.push({ id: "cash", title: "Kasse im Minus",
    text: "Die Kasse ist negativ. Strecken prüfen, Flugzeuge zurückgeben oder einen Kredit aufnehmen." });

  return out;
}

/**
 * Prüfen und ggf. melden. Wird im Sekundentakt aufgerufen, meldet aber nur,
 * wenn der Tab im Hintergrund ist – wer zusieht, braucht keine Systemmeldung.
 */
export function check(state, now) {
  if (!enabled() || !state) return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  const seen = prefs.get(SEEN, {});
  const list = pending(state, now);
  if (!list.length) return;
  const real = Date.now();
  for (const item of list) {
    if (seen[item.id] && real - seen[item.id] < QUIET_MS) continue;
    seen[item.id] = real;
    try {
      new Notification("Airline Manager · " + item.title, { body: item.text, tag: item.id, icon: "icon.png" });
    } catch { /* manche Browser erlauben das nur über den Service Worker */ }
    break;   // immer nur eine Meldung auf einmal
  }
  // Aufräumen, damit die Liste nicht ewig wächst
  for (const k of Object.keys(seen)) if (real - seen[k] > 7 * DAY) delete seen[k];
  prefs.set(SEEN, seen);
}
