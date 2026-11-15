// Airline: Finanzen, Reputation, Angebot an Bord, Personal & Schulung, Livery, Verträge, Drehkreuze, Spielstand.
import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CATERING, BAGS, STAFF, CONTRACT } from "../../core/config.js";
import { AIRCRAFT_BY_ID, MAKERS } from "../../data/aircraft.js";
import { AIRPORT_BY_IATA, searchAirports } from "../../data/airports.js";
import { summary, REV, COST } from "../../sim/ledger.js";
import { repFactors, repTarget } from "../../sim/reputation.js";
import { headcount } from "../../sim/economy.js";
import { companyValue } from "../../sim/stocks.js";
import { sideView } from "../aircraftArt.js";
import * as act from "../../sim/actions.js";
import { exportSave, importSave } from "../../core/store.js";
import { online, cloudSave } from "../../net/backend.js";

const TABS = [["finance", "Finanzen"], ["rep", "Reputation"], ["offer", "Angebot"], ["staff", "Personal"], ["livery", "Livery"], ["contract", "Verträge"], ["hubs", "Drehkreuze"], ["account", "Spielstand"]];
const PREVIEW_TYPES = ["a320neo", "b787-9", "a380-800", "b737-max8"];

export default {
  id: "airline", title: "Airline", icon: "airline", width: 640,
  initialView: () => ({ tab: "finance", preview: 0, q: "" }),

  render(ctx, v) {
    const body = { finance, rep, offer, staff, livery, contract, hubs, account }[v.tab](ctx, v);
    return html`<div class="tabs">${TABS.map(([id, l]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${l}</button>`)}</div>${body}`;
  },

  click(ctx, v, api) {
    return {
      training: () => { const r = ctx.run(act.upgradeTraining, ctx.now()); if (r) ctx.toast(`Schulung abgeschlossen: ${STAFF.training.levels[r.level]} für ${fmt.int(r.staff)} Mitarbeiter.`, "good"); },
      sign: el => { if (window.confirm(`Exklusivvertrag mit ${el.dataset.maker} unterschreiben? Neubestellungen beim anderen Hersteller sind dann gesperrt. Kündigung kostet ${fmt.money(CONTRACT.cancelFee)}.`)) ctx.run(act.signContract, el.dataset.maker, ctx.now()) && ctx.toast("Vertrag unterschrieben.", "good"); },
      cancel: () => { if (window.confirm(`Vertrag für ${fmt.money(CONTRACT.cancelFee)} kündigen?`)) ctx.run(act.cancelContract, ctx.now()); },
      paint: () => ctx.openPainter(),
      nextPreview: () => { v.preview = (v.preview + 1) % PREVIEW_TYPES.length; api.rerender(); },
      addHub: el => { const r = ctx.run(act.addHub, el.dataset.iata, ctx.now()); if (r) { ctx.toast(`${el.dataset.iata} ist jetzt Drehkreuz.`, "good"); v.q = ""; } },
      export: async el => {
        const text = exportSave(ctx.state);
        try { await navigator.clipboard.writeText(text); ctx.toast("Spielstand in die Zwischenablage kopiert.", "good"); }
        catch { el.closest(".body").querySelector("[name=io]").value = text; ctx.toast("Spielstand unten ins Feld geschrieben – kopieren und sicher aufbewahren.", "info"); }
      },
      import: el => {
        const text = el.closest(".body").querySelector("[name=io]").value;
        try { const s = importSave(text); if (window.confirm(`Spielstand von „${s.airline.name}“ laden? Der aktuelle wird ersetzt.`)) ctx.replaceState(s); }
        catch (e) { ctx.toast("Import fehlgeschlagen: " + e.message, "bad"); }
      },
      cloud: async () => { try { await cloudSave(ctx.state); ctx.toast("Online gesichert.", "good"); } catch (e) { ctx.toast("Sicherung fehlgeschlagen: " + e.message, "bad"); } },
      reset: () => { if (window.confirm("Wirklich ALLES löschen und neu starten? Exportiere vorher deinen Spielstand.")) ctx.resetGame(); },
      showSecret: el => { el.textContent = ctx.state.player.secret; }
    };
  },

  change(ctx, v, api) {
    return {
      catering: el => ctx.run(act.setCatering, el.value),
      bag: el => ctx.run(act.setBagFee, el.value),
    };
  },

  input(ctx, v) {
    return {
      bag: el => { el.closest(".card").querySelector("[data-bag]").textContent = "$" + el.value; },
      q: el => { v.q = el.value; el.closest(".body").querySelector("[data-results]").innerHTML = hubResults(ctx, v).s; }
    };
  }
};

// ---------- Tabs

function finance(ctx) {
  const s = ctx.state, now = ctx.now(), sum = summary(s, 30, now), val = companyValue(s, now, ctx.marketPrices());
  const rows = (obj, names) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, x]) => html`<tr><td>${names[k] || k}</td><td class="r">${fmt.money(x)}</td></tr>`);
  return html`
    <div class="grid3">
      <div class="card stat"><span>Kasse</span><b>${fmt.money(s.cash)}</b></div>
      <div class="card stat"><span>Ergebnis 30 T</span><b class="${sum.profit < 0 ? "bad" : "good"}">${fmt.money(sum.profit)}</b></div>
      <div class="card stat"><span>Unternehmenswert</span><b>${fmt.money(val.total)}</b></div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><b>Einnahmen</b><table class="t"><tbody>${rows(sum.rev, REV)}</tbody></table></div>
      <div class="card"><b>Ausgaben</b><table class="t"><tbody>${rows(sum.cost, COST)}</tbody></table></div>
    </div>
    <dl class="kv card" style="margin-top:10px"><dt>Flottenwert</dt><dd>${fmt.money(val.fleet)}</dd><dt>Kerosinvorrat</dt><dd>${fmt.money(val.fuel)}</dd>
      <dt>Beteiligungen</dt><dd>${fmt.money(val.holdings)}</dd><dt>Ertragswert (Gewinn-Multiple)</dt><dd>${fmt.money(val.goodwill)}</dd></dl>`;
}

const LABELS = { preis: "Preisfairness", komfort: "Kabinenkomfort", bordservice: "Bordservice", gepaeck: "Gepäckgebühr", schulung: "Schulung", sicherheit: "Vorfälle", unfallfrei: "Unfallfreie Zeit" };

function rep(ctx) {
  const s = ctx.state, now = ctx.now(), last = s.flights[0];
  const f = repFactors(s, now, last), target = repTarget(s, now, last);
  return html`
    <div class="row"><div class="grow"><div class="big-price">${s.airline.rep.toFixed(1)}</div><div class="small muted">Ziel aktuell ${target.toFixed(1)} – die Reputation nähert sich mit jedem Flug langsam an.</div></div></div>
    <div class="card rep-bars" style="margin-top:10px">${Object.entries(f).map(([k, x]) => {
      const w = Math.min(50, Math.abs(x) * 2.5);
      return html`<div><span>${LABELS[k] || k}</span><div class="track"><i style="${x >= 0 ? `left:50%;width:${w}%;background:var(--good)` : `right:50%;width:${w}%;background:var(--bad)`}"></i></div><b class="r mono">${x >= 0 ? "+" : ""}${x.toFixed(1)}</b></div>`;
    })}</div>
    <p class="small muted" style="margin-top:8px">Reputation beeinflusst die Nachfrage: bei 0 nur 60 %, bei 100 bis zu 140 %. Preisfairness und Kabinenkomfort beziehen sich auf den letzten Flug.</p>`;
}

function offer(ctx) {
  const a = ctx.state.airline;
  return html`<div class="stack">
    <div class="card"><b>Bordverpflegung</b><p class="small muted">Gilt für die ganze Airline.</p>
      <div class="opt-list" style="margin-top:8px">${Object.entries(CATERING.modes).map(([k, m]) => html`<label><input type="radio" name="catering" value="${k}" data-act="catering" ${a.catering === k ? "checked" : ""}>
        <div><b>${m.label}</b> <span class="pill ${m.rep > 0 ? "good" : m.rep < 0 ? "bad" : ""}">Reputation ${m.rep > 0 ? "+" : ""}${m.rep}</span>
        <div class="small muted">${k === "free" ? "Essen und Getränke in allen Klassen inklusive. Teuer, Passagiere lieben es." : k === "mixed" ? "Premium-Klassen inklusive, Economy kauft an Bord." : "Alles kostenpflichtig – wie bei Billigairlines. Extra-Umsatz, aber weniger Zufriedenheit."}</div></div></label>`)}</div></div>
    <div class="card"><div class="row"><b class="grow">Gepäckgebühr Economy</b><b data-bag class="acc">$${a.bagFee}</b></div>
      <input type="range" min="0" max="${BAGS.maxFee}" step="5" value="${a.bagFee}" data-act="bag" style="margin-top:8px">
      <p class="small muted">Höhere Gebühren bringen pro Koffer mehr, aber weniger Passagiere zahlen sie – und die Reputation sinkt (bis −${BAGS.repCap}).</p></div>
  </div>`;
}

function staff(ctx) {
  const s = ctx.state, hc = headcount(s), q = act.trainingQuote(s), lvl = s.airline.training;
  return html`<div class="grid3">
      <div class="card stat"><span>Piloten</span><b>${fmt.int(hc.pilots)}</b></div>
      <div class="card stat"><span>Flugbegleiter</span><b>${fmt.int(hc.cabin)}</b></div>
      <div class="card stat"><span>Techniker</span><b>${fmt.int(hc.techs)}</b></div>
    </div>
    <div class="card" style="margin-top:10px"><div class="row"><div class="grow"><b>Schulungsstufe: ${STAFF.training.levels[lvl]}</b>
      <div class="small muted">Reputation +${STAFF.training.rep[lvl]} · Löhne +${lvl * STAFF.training.wageBonus * 100} %</div></div>
      ${q ? html`<button class="btn p" data-act="training">${STAFF.training.levels[q.level]} · ${fmt.money(q.cost)}</button>` : html`<span class="pill good">Höchste Stufe</span>`}</div>
      <p class="small muted" style="margin-top:8px">Die Schulungsgebühr fällt pro Mitarbeiter an (${STAFF.training.feePerEmployee.slice(1).map(x => "$" + fmt.int(x)).join(" / ")}). Neue Mitarbeiter übernehmen die Stufe automatisch.</p></div>`;
}

function livery(ctx, v) {
  const lv = ctx.state.airline.livery;
  return html`<div class="preview-art" data-preview>${raw(sideView(PREVIEW_TYPES[v.preview], lv))}</div>
    <div class="row" style="margin:6px 0 12px"><span class="small muted grow">Vorschau: ${AIRCRAFT_BY_ID[PREVIEW_TYPES[v.preview]].name} – deine Livery gilt für jeden Flugzeugtyp.</span><button class="btn sm" data-act="nextPreview">Anderer Typ</button></div>
    <div class="card row"><div class="grow"><b>Lackiererei</b><div class="small muted">Male deine eigene Livery auf ein weißes Flugzeug: Pinsel, Linien, Bänder, Füllen, Text. Sie wird automatisch auf alle Typen übertragen.</div></div>
      <button class="btn p" data-act="paint">Lackiererei öffnen</button></div>`;
}

function contract(ctx) {
  const c = ctx.state.airline.contract;
  return html`<p class="small muted" style="margin-bottom:10px">Ein Exklusivvertrag bindet dich an einen Hersteller. Dafür gibt es ${CONTRACT.baseDiscount * 100} % Grundrabatt, Mengenrabatte (${CONTRACT.volume.map(([n, d]) => `ab ${n} Stück +${d * 100} %`).join(", ")}) und −${CONTRACT.maintDiscount * 100} % auf alle Checks dieses Herstellers. Gebrauchtkäufe bleiben frei.</p>
    <div class="grid2">${MAKERS.map(m => html`<div class="card"><h3>${m}</h3>
      ${c?.maker === m ? html`<p class="small good" style="margin:6px 0">Aktiv seit ${new Date(c.since).toLocaleDateString("de-DE")}</p><button class="btn sm danger" data-act="cancel">Kündigen (${fmt.money(CONTRACT.cancelFee)})</button>`
        : html`<p class="small muted" style="margin:6px 0">${c ? "Gesperrt durch Vertrag mit " + c.maker : "Verfügbar"}</p><button class="btn sm p" data-act="sign" data-maker="${m}" ${c ? "disabled" : ""}>Unterschreiben</button>`}</div>`)}</div>`;
}

function hubResults(ctx, v) {
  const s = ctx.state;
  return html`${searchAirports(v.q, 8).filter(a => !s.airline.hubs.includes(a.iata)).map(a => html`<button data-act="addHub" data-iata="${a.iata}"><b>${a.iata}</b><span class="grow">${a.city}</span><span class="muted small">${fmt.money(act.hubPrice(a.iata))}</span></button>`)}`;
}

function hubs(ctx, v) {
  const s = ctx.state;
  return html`<div class="card"><b>Deine Drehkreuze</b><div class="row wrap" style="margin-top:8px">${s.airline.hubs.map(h => html`<span class="pill info">${h} · ${AIRPORT_BY_IATA[h].city}</span>`)}</div></div>
    <div class="card" style="margin-top:10px"><b>Weiteres Drehkreuz eröffnen</b><p class="small muted">Strecken starten immer an einem Drehkreuz; dort finden auch die Checks statt. Preis richtet sich nach der Flughafengröße.</p>
      <input class="in" style="width:100%;margin-top:8px" placeholder="Flughafen suchen …" data-act="q" value="${v.q}"><div class="pick" data-results>${v.q ? hubResults(ctx, v) : ""}</div></div>`;
}

function account(ctx) {
  const p = ctx.state.player;
  return html`<div class="card"><dl class="kv"><dt>Spielercode</dt><dd class="mono acc">${p.code}</dd><dt>Airline</dt><dd>${ctx.state.airline.name} (${ctx.state.airline.iata})</dd>
      <dt>Gegründet</dt><dd>${new Date(ctx.state.created).toLocaleDateString("de-DE")}</dd>
      <dt>Wiederherstellungs-Schlüssel</dt><dd><button class="btn sm" data-act="showSecret">Anzeigen</button></dd></dl>
      <p class="small muted" style="margin-top:8px">Dein Spielstand liegt nur in diesem Browser – ohne E-Mail, ohne Passwort. Der Code erscheint öffentlich in Börse und Rangliste. Den Schlüssel niemandem geben.</p></div>
    <div class="card" style="margin-top:10px"><b>Gerät wechseln / Sicherung</b>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="export">Spielstand exportieren</button><button class="btn sm" data-act="import">Importieren</button>${online() ? html`<button class="btn sm" data-act="cloud">Online sichern</button>` : ""}</div>
      <textarea name="io" class="in" rows="3" style="width:100%;margin-top:8px;font:11px var(--mono)" placeholder="Exportierten Spielstand hier einfügen …"></textarea></div>
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn sm danger" data-act="reset">Neu anfangen</button></div>`;
}

