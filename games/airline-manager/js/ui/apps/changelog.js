// Änderungsverlauf im Spiel. Erreichbar über den Versionsknopf unten im Airline-Panel.
import { html } from "../dom.js";
import { GAME } from "../../core/config.js";
import { CHANGELOG, TAGS, LATEST } from "../../data/changelog.js";
import { prefs } from "../../core/store.js";

/** Welche Version hat der Spieler zuletzt gesehen? Steuert den "Neu"-Punkt am Knopf. */
export const lastSeen = () => prefs.get("changelog-seen", null);
export const hasUnseen = () => lastSeen() !== LATEST;
export const markSeen = () => prefs.set("changelog-seen", LATEST);

export default {
  id: "changelog", title: "Was ist neu", icon: "log", width: 560,
  // Beim Öffnen merken, welche Version der Spieler zuletzt gesehen hatte – daraus ergibt sich "neu für dich".
  initialView: () => ({ tab: LATEST, seenAtOpen: lastSeen() }),

  render(ctx, v) {
    const seen = v.seenAtOpen;
    return html`
      <p class="small muted" style="margin-bottom:12px">Airline Manager ${GAME.label} · Soy &amp; Soul.
        Die ausführliche technische Fassung steht im README des Projekts.</p>
      ${CHANGELOG.map(e => {
        const open = v.tab === e.v;
        const isNew = seen && e.v > seen;
        return html`<section class="cl ${open ? "open" : ""}">
          <button class="cl-head" data-act="tab" data-tab="${e.v}">
            <b>${e.v}</b>
            <span class="grow">${e.title}</span>
            ${isNew ? html`<i class="pill good">neu für dich</i>` : ""}
            <time>${e.date}</time>
          </button>
          ${open ? html`<div class="cl-body">
            ${e.intro ? html`<p class="cl-intro">${e.intro}</p>` : ""}
            <ul>${e.items.map(([tag, text]) => html`<li><i class="pill ${TAGS[tag]?.cls || ""}">${TAGS[tag]?.label || tag}</i><span>${text}</span></li>`)}</ul>
          </div>` : ""}
        </section>`;
      })}`;
  },

  // Das Auf- und Zuklappen läuft über die allgemeine Tab-Verdrahtung in ui/windows.js (data-act="tab").
  click: () => ({})
};
