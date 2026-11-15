// Gründung: Airline-Name, Kürzel, Drehkreuz (per Suche oder Klick auf die Karte).
import { html } from "./dom.js";
import { AIRPORT_BY_IATA, searchAirports } from "../data/airports.js";
import { fmt } from "../core/util.js";
import { GAME } from "../core/config.js";
import { importSave } from "../core/store.js";
import { online, cloudLoad } from "../net/backend.js";

export function showOnboarding(ctx, onDone) {
  let hub = null;
  const el = document.createElement("div");
  el.className = "modal side";
  el.innerHTML = html`<form class="box glass" autocomplete="off">
    <h1>Gründe deine Airline</h1>
    <p class="muted" style="margin-top:6px">Du startest mit ${fmt.money(GAME.startCash)}. Flüge laufen in Echtzeit weiter – auch wenn du nicht da bist.</p>
    <label for="ob-name">Name der Airline</label><input id="ob-name" class="in" name="name" maxlength="28" required placeholder="z. B. Soy Air">
    <label for="ob-iata">Kürzel (2 Zeichen, steht auf dem Leitwerk)</label><input id="ob-iata" class="in" name="iata" maxlength="2" required pattern="[A-Za-z0-9]{2}" placeholder="SA" style="text-transform:uppercase;width:90px">
    <label for="ob-hub">Heimat-Drehkreuz</label><input id="ob-hub" class="in" name="q" placeholder="Stadt oder Code suchen – oder auf der Karte klicken">
    <div class="pick" data-res></div>
    <p class="small" data-hub style="margin-top:8px"></p>
    <div class="row" style="margin-top:18px"><span class="grow small muted">Kein Konto nötig. Dein Spielercode wird automatisch erzeugt.</span><button class="btn p" type="submit">Airline gründen</button></div>
    <details style="margin-top:14px"><summary class="small muted" style="cursor:pointer">Spielstand von einem anderen Gerät übernehmen</summary>
      <textarea class="in" name="io" rows="3" style="width:100%;margin-top:8px;font:11px var(--mono)" placeholder="${online() ? "Exportierten Spielstand einfügen – oder Code und Schlüssel: AL-XXX-XXX SCHLÜSSEL" : "Exportierten Spielstand einfügen"}"></textarea>
      <button class="btn sm" type="button" data-restore style="margin-top:6px">Wiederherstellen</button></details>
  </form>`.s;
  document.body.appendChild(el);
  const form = el.querySelector("form"), res = el.querySelector("[data-res]"), info = el.querySelector("[data-hub]");

  const choose = iata => {
    hub = iata;
    const a = AIRPORT_BY_IATA[iata];
    info.innerHTML = html`Drehkreuz: <b class="acc">${a.iata}</b> · ${a.city} · Bahn ${fmt.int(a.runwayM)} m · ${"★".repeat(a.tier)}`.s;
    res.innerHTML = "";
    form.q.value = "";
    ctx.map.flyTo(a.lon, a.lat, 4);
  };
  form.q.addEventListener("input", () => {
    res.innerHTML = html`${searchAirports(form.q.value, 8).map(a => html`<button type="button" data-i="${a.iata}"><b>${a.iata}</b><span>${a.city}</span><span class="muted small">${"★".repeat(a.tier)}</span></button>`)}`.s;
  });
  res.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) choose(b.dataset.i); });
  ctx.map.pickAirport(choose);

  el.querySelector("[data-restore]").addEventListener("click", async () => {
    const text = form.io.value.trim();
    try {
      const m = text.match(/^(AL-[A-Z0-9]{3}-[A-Z0-9]{3})\s+(\S+)$/i);
      const s = m ? await cloudLoad(m[1].toUpperCase(), m[2]) : importSave(text);
      ctx.replaceState(s);
    } catch (err) { info.innerHTML = html`<span class="bad">Wiederherstellen fehlgeschlagen: ${err.message}</span>`.s; }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = form.name.value.trim(), iata = form.iata.value.trim().toUpperCase();
    if (!hub) { info.innerHTML = '<span class="warn">Bitte ein Drehkreuz wählen.</span>'; return; }
    ctx.map.pickAirport(null);
    el.remove();
    onDone({ name, iata, hub });
  });
  setTimeout(() => form.name.focus(), 50);
}
