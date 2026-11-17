// Geführter Einstieg: die ersten zehn Minuten.
//
// Keine Klickanleitung mit Pfeilen, sondern eine Liste, die sich selbst abhakt – abgeleitet
// aus dem Spielstand, nichts zusätzlich gespeichert. Jeder Schritt sagt, warum er dran ist
// und wo er zu finden ist. Wer sie nicht braucht, klappt sie zu und sie kommt nicht wieder.
//
// Besonders wichtig, seit man mit 12 Mio startet und sein erstes Flugzeug leasen muss:
// Wer das nicht weiß, sucht im Flugzeugmarkt vergeblich nach etwas Bezahlbarem.

import { RATING } from "../core/config.js";
import { coverage, GROUPS } from "./staff.js";

export function steps(state, now) {
  const fleet = state.fleet.filter(a => a.status !== "crashed");
  const cov = coverage(state);
  const staffed = GROUPS.every(g => cov[g] >= 1);
  const assigned = fleet.filter(a => a.status === "active").length;
  const list = [
    {
      id: "lease", title: "Erstes Flugzeug leasen",
      why: "Kaufen kostet ein Vielfaches des Startkapitals. Geleast wird monatlich gezahlt – so fangen echte Airlines auch an.",
      where: "Betrieb → Flugzeugmarkt → Leasen",
      done: fleet.length > 0,
      app: "shop"
    },
    {
      id: "staff", title: "Personal einstellen",
      why: "Ohne Cockpit, Kabine, Boden und Verwaltung hebt kein Flugzeug ab. Der Bedarf wächst mit Flotte und Zielen.",
      where: "Airline → Personal → Alle offenen Stellen besetzen",
      done: fleet.length > 0 && staffed,
      app: null
    },
    {
      id: "route", title: "Erste Strecke eröffnen",
      why: "Die Streckenwahl entscheidet fast alles. Die Vorschau sagt vorher, ob die Nachfrage ein Flugzeug trägt.",
      where: "Betrieb → Routen → Neue Strecke",
      done: state.routes.length > 0,
      app: "routes"
    },
    {
      id: "assign", title: "Flugzeug auf die Strecke setzen",
      why: "Erst dann fliegt es – im Pendel, rund um die Uhr, auch wenn der Tab zu ist.",
      where: "Betrieb → Hangar → Flugzeug → Einsatz",
      done: assigned > 0,
      app: "hangar"
    },
    {
      id: "firstleg", title: "Ersten Flug abwarten",
      why: "Die ersten zehn Flüge laufen im Zeitraffer. Danach läuft die Uhr in Echtzeit weiter.",
      where: "Airline → Abflüge",
      done: (state.stats?.legs || 0) > 0,
      app: null
    },
    {
      id: "report", title: "Flugabrechnung ansehen",
      why: "Dort steht, woran eine Strecke verdient – und woran sie verliert. Die Sterne nennen die schwächste Note.",
      where: "Airline → Abflüge → Abrechnung",
      done: (state.stats?.legs || 0) >= 6,
      app: "report"
    },
    {
      id: "grow", title: `Auf ${RATING.minFleet} Flugzeuge wachsen`,
      why: "Ab zwei Flugzeugen ist die Airline für Börse und Rangliste qualifiziert.",
      where: "Betrieb → Flugzeugmarkt → Leasen",
      done: fleet.length >= RATING.minFleet,
      app: "shop"
    }
  ];
  const nextIdx = list.findIndex(x => !x.done);
  return { list, next: nextIdx < 0 ? null : list[nextIdx], done: nextIdx < 0, progress: list.filter(x => x.done).length };
}
