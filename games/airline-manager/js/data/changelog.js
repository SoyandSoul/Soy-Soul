// Änderungsverlauf für die Anzeige im Spiel (Knopf unten im Airline-Panel).
// Hier steht die spielerfreundliche Fassung; die technische Langform bleibt im README unter "Änderungen".
// Bei einer neuen Version: Eintrag hier oben ergänzen, GAME.label in core/config.js hochzählen.
//
// tag: "neu" (neue Möglichkeit), "besser" (Verbesserung), "balance" (Zahlenwerk), "fix" (Fehler behoben)

export const CHANGELOG = [
  {
    v: "v0.22", date: "17.11.2026", title: "Werbung, Charter und Sonderlackierungen",
    intro: "Bisher gab es genau eine Art, Geld zu verdienen: Tickets verkaufen. Jetzt kommt alles dazu, was eine Airline sonst noch vermarktet.",
    items: [
      ["neu", "Bekanntheit als zweiter Wert neben der Reputation: Die sagt, wie gut über euch geredet wird – die Bekanntheit, ob überhaupt jemand an euch denkt. Sie füllt leere Sitze, schafft aber keine Nachfrage, wo die Flugzeuge schon voll sind."],
      ["neu", "Werbekampagnen in vier Kanälen: TV & Radio (teuer, breit, drei Tage Anlauf), Plakat (solide Dauerwirkung), Zeitung (kleine Reichweite, Geschäftsreisende und Ruf) und Online (sofort und günstig, verpufft schnell, zieht Urlauber). Dazu drei Tarife und drei Laufzeiten."],
      ["neu", "Charteraufträge von Reiseveranstaltern: Flugzeug und Crew für ein paar Tage vermieten. Der Veranstalter zahlt Kerosin und Gebühren – dafür fehlt das Flugzeug im Liniendienst. Die Oberfläche stellt beides nebeneinander, damit die Rechnung ehrlich bleibt."],
      ["neu", "Sonderlackierungen: Firmen mieten die Außenhaut als Werbefläche. Das Flugzeug fliegt und verdient normal weiter, die eigene Marke verschwindet aber darunter – jede Werbemaschine kostet Ruf."],
      ["neu", "Sortiment im Bordverkauf wählbar: schlicht, Standard oder Marken und Region. Mehr Auswahl heißt mehr Umsatz, dünnere Marge und besseren Ruf."],
      ["neu", "Reputation ist aufgeschlüsselt: jeder Baustein mit Hinweis, was ihn hebt, sortiert nach dem, was gerade am meisten schadet."],
      ["fix", "Werbewirkung und Bekanntheit werden wie Kerosinpreis und Wetter aus der Zeit gerechnet, nicht mitgeschleppt – stündlich reinschauen ergibt auf die Kommastelle dasselbe wie drei Tage Pause."]
    ]
  },
  {
    v: "v0.21", date: "17.11.2026", title: "Abflüge und Flugabrechnung",
    intro: "Flüge liefen bisher im Hintergrund durch – man sah weder, was gerade am Gate steht, noch was eine Strecke tatsächlich einbringt.",
    items: [
      ["neu", "Abflug-Bereich im Airline-Panel: alle Flugzeuge am Gate mit laufender Restzeit, Grund einer Verspätung und den Zahlen der letzten sechs Stunden."],
      ["neu", "Schnellabfertigung: Priorität am Gate kürzt die laufende Standzeit um 45 %. Der Preis richtet sich nach der gesparten Zeit, einzeln oder für alle auf einmal. Ohne dich starten die Flugzeuge trotzdem pünktlich – Anwesenheit wird belohnt, Abwesenheit nicht bestraft."],
      ["neu", "Bodenabfertigung wählbar: Sparanbieter, Standard oder Premium. Das verschiebt Standzeit, Verspätungsrisiko, Handlingkosten und Reputation gegeneinander."],
      ["neu", "Flugabrechnung: Fenster mit Zeiträumen von 6 Stunden bis 7 Tage, Umsatz und Kosten nach Posten, dazu jeder einzelne Flug zum Aufklappen."],
      ["neu", "Streckenbewertung mit Sternen aus Auslastung, Pünktlichkeit und Ertrag je Sitz – inklusive Hinweis, woran die schwächste Note hängt."]
    ]
  },
  {
    v: "v0.20", date: "17.11.2026", title: "Änderungsverlauf im Spiel",
    intro: "Bisher stand nur im Projekt-README, was sich geändert hat.",
    items: [
      ["neu", "Knopf unten im Airline-Panel: zeigt alle Versionen seit Projektbeginn mit dem, was jeweils dazukam. Nach einem Update erscheint dort ein Hinweis, bis du ihn gelesen hast."]
    ]
  },
  {
    v: "v0.19", date: "17.11.2026", title: "Ziele, Streckenbewertung, Flottenvereinheitlichung",
    intro: "Bisher konnte man ewig spielen, ohne je ein Etappenziel zu erreichen – und eine schlechte Strecke erkannte man erst an der Abrechnung.",
    items: [
      ["neu", "20 Ziele in fünf Gruppen mit Fortschritt und Belohnung: Einmalzahlung, dauerhafter Leasingrahmen oder Reputation. Oben steht immer, was als Nächstes dran ist."],
      ["neu", "Streckenbewertung vor dem Zuweisen: buchbare Nachfrage, erwartete Auslastung und wie viele Flugzeuge dieses Typs die Strecke trägt. Saisonal – Palma im Juli trägt mehr als im November."],
      ["neu", "Flottenvereinheitlichung: überwiegend eine Baureihe spart bis zu 18 % Wartung, 15 % Cockpit-Bedarf und 25 % Schulung. Ab vier Baureihen gibt es Aufschlag."],
      ["fix", "Die Streckenauswahl im Hangar war nicht an die Bewertung gebunden und rechnete immer mit der ersten Strecke."]
    ]
  },
  {
    v: "v0.18", date: "17.11.2026", title: "Leasing",
    intro: "Die meisten echten Airlines besitzen ihre Flotte gar nicht. Damit wächst man jetzt auch im Spiel, ohne Kapital zu binden.",
    items: [
      ["neu", "Flugzeuge leasen statt kaufen: Kaution plus Monatsrate, dazu Wartungsrücklagen je Flugstunde. Laufzeiten 3 bis 24 Monate – kurz ist teurer."],
      ["neu", "Leasingrahmen: Wie viel du leasen darfst, hängt am Betriebsergebnis und an der Reputation, nicht am Kontostand. Er wächst mit dem Erfolg und schrumpft wieder."],
      ["neu", "Verträge verlängern sich am Ende automatisch, außer du stellst auf Rückgabe. Rückgabe, Verlängerung und Herauskaufen jederzeit im Hangar."],
      ["neu", "Sale-and-Leaseback: eigenes Flugzeug verkaufen und zurückmieten, wenn du schnell Geld brauchst."],
      ["balance", "Startkapital von 200 auf 12 Mio $ gesenkt, Flugzeugpreise zurück auf realistische 50 % vom Listenpreis. Kaufen ist jetzt Spätspiel – gewachsen wird über Leasing."],
      ["fix", "Die Leasingkaution lief als laufender Aufwand, obwohl sie erstattet wird."]
    ]
  },
  {
    v: "v0.17", date: "17.11.2026", title: "Airline-Zentrale und Kostenstruktur",
    intro: "Die Oberfläche steckte in zu vielen Untermenüs, und Personal war nur eine Rechengröße.",
    items: [
      ["neu", "Zwei aufklappbare Panele statt Dock: links „Airline“ mit Übersicht, Flotte, Personal, Kosten und Management, rechts „Betrieb“ mit Routen, Markt, Technik und Börse samt Kurzstatus."],
      ["neu", "Personal stellst du selbst ein: Cockpit, Kabine, Boden und Verwaltung. Der Bedarf wächst mit der Flotte und mit jedem neuen Ziel. Unterbesetzung kostet Pünktlichkeit und Reputation, unter 60 % geht gar nichts mehr."],
      ["neu", "Kostenstruktur wie im Geschäftsbericht: Personal, Flugbetrieb, Technik, Vertrieb, Investitionen – umschaltbar auf 1, 7 oder 30 Tage, mit Kennzahlen je Flug."],
      ["balance", "Gehälter machen jetzt 16–18 % der Betriebskosten aus statt 9 %, Flughafengebühren gesenkt, Beifracht von 30 auf rund 10 % des Umsatzes."],
      ["balance", "Der Ertrag je Kilometer sinkt mit der Entfernung. Vorher war Langstrecke mit 53 % Marge allem anderen überlegen."],
      ["besser", "Meldungen erscheinen unten statt über dem Panel."]
    ]
  },
  {
    v: "v0.16", date: "16.11.2026", title: "Flotte, Datenblätter und Lackier-Vorlagen",
    intro: "Die Flotte wurde auf die Typen umgestellt, für die echte Seitenansichten vorliegen.",
    items: [
      ["neu", "38 Flugzeugtypen: Airbus A220 bis A380, Boeing 717 bis 787, Bombardier CRJ, Embraer E-Jets und ERJ, Beechcraft 1900D und die Concorde (nur gebraucht)."],
      ["neu", "Alle Typen sind aus echten Seitenansichten abgepaust – die Flugzeuge bleiben ab Werk weiß."],
      ["neu", "Lackier-Vorlagen: 10 Schemata (Eurowhite, Cheatline, Billboard, Heckschwung, Retro-Streifen …) in 10 Farbwelten, mit Name und Kürzel vorbelegt. Danach malst du frei weiter."],
      ["neu", "Datenblatt je Typ mit Abmessungen, Gewichten, Leistung, Antrieb, Kabine, Geschichte und Wirtschaft – im Markt und im Hangar."],
      ["neu", "Gebrauchte Flugzeuge haben einen Zustand: weniger Reichweite, mehr Verbrauch, ungeplante Defekte und niedrigerer Restwert."],
      ["besser", "Karte: Flugzeuge am Boden sind grün, in Wartung grau, in der Luft gelb. Die Flug-Infokarte zeigt Höhe in Metern, Geschwindigkeit in km/h und die Ankunftszeit."]
    ]
  },
  {
    v: "v0.15", date: "15.11.2026", title: "Lieferzeiten, Kabine und Wetter",
    intro: "Stand bei der Übernahme des Projekts. Ältere Versionen sind nicht dokumentiert.",
    items: [
      ["neu", "Die ersten fünf Flugzeuge kommen sofort, danach gelten echte Lieferzeiten mit Countdown im Hangar."],
      ["neu", "Wetter je Flughafen nach Klimazone und Jahreszeit – für alle Spieler gleich. Gewitter, Schnee und Nebel verlängern den Turnaround."],
      ["neu", "Kabine mit Schiebereglern pro Klasse und ziehbaren Klassengrenzen im Sitzplan."],
      ["besser", "Lackiererei: Texte lassen sich auswählen, verschieben, umfärben und ändern."],
      ["besser", "Neue Fenster suchen sich den freiesten Platz auf dem Bildschirm."]
    ]
  }
];

export const LATEST = CHANGELOG[0].v;
export const TAGS = {
  neu: { label: "Neu", cls: "good" },
  besser: { label: "Besser", cls: "info" },
  balance: { label: "Balance", cls: "warn" },
  fix: { label: "Behoben", cls: "" }
};
