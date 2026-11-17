// Änderungsverlauf für die Anzeige im Spiel (Knopf unten im Airline-Panel).
// Hier steht die spielerfreundliche Fassung; die technische Langform bleibt im README unter "Änderungen".
// Bei einer neuen Version: Eintrag hier oben ergänzen, GAME.label in core/config.js hochzählen.
//
// tag: "neu" (neue Möglichkeit), "besser" (Verbesserung), "balance" (Zahlenwerk), "fix" (Fehler behoben)

export const CHANGELOG = [
  {
    v: "v0.33", date: "17.11.2026", title: "Echte Seitenrisse",
    intro: "Die Flugzeuge sind jetzt abfotografierte Seitenrisse statt gezeichneter Umrisse.",
    items: [
      ["neu", "47 der 57 Typen zeigen einen echten Seitenriss mit Schattierung, Fenstern und Türen – in Markt, Hangar, Flotte und auf der Flugkarte."],
      ["besser", "Der Größenvergleich bleibt ehrlich: Alle Bilder stehen im selben Maßstab, eine A380 ist neben einer CRJ-200 so groß wie in echt."],
      ["besser", "Die Lackiererei ruht so lange. Ein Bild lässt sich nicht bemalen; die Vektorflugzeuge und die Livery-Werkzeuge bleiben im Code und sind über einen Schalter wieder einschaltbar."],
      ["besser", "Zehn Typen haben noch kein Bild – A220-100 und -300, 737-900ER, CRJ-200/700/900, E170, E175, ERJ 145 und die Concorde. Die werden weiter gezeichnet."]
    ]
  },
  {
    v: "v0.32", date: "17.11.2026", title: "Neunzehn neue Flugzeuge",
    intro: "Der Katalog wächst von 38 auf 57 Typen – und die Hecktriebwerker sehen endlich aus wie Hecktriebwerker.",
    items: [
      ["neu", "Airbus kommt dazu: A300-600R, A310-300, A318 und der A340-500 für Ultralangstrecken."],
      ["neu", "Boeing kommt dazu: 737-600, die komplette MAX-Reihe (7, 8, 9 und 10), die verkürzte 747SP und die 777-9."],
      ["neu", "Neue Hersteller im Markt: McDonnell Douglas mit MD-87 und der dreistrahligen MD-11, Fokker mit 70 und 100, De Havilland Canada mit der Dash 8 Q400."],
      ["neu", "Außerdem neu: CRJ-1000, Embraer E190 und E195-E2."],
      ["besser", "Flugzeuge mit Triebwerken am Heck – 717, CRJ, ERJ, Fokker, MD – haben die Gondeln bisher unter dem Flügel getragen. Jetzt sitzen sie hinten am Rumpf, mit T-Leitwerk darüber."],
      ["besser", "Turboprops bekommen sichtbare Propellerkreise, die MD-11 ihr drittes Triebwerk im Seitenleitwerk."],
      ["besser", "Alle neuen Seitenrisse sind aus echten Rissen abgepaust, nicht geschätzt: Rumpfkontur, Leitwerk und Triebwerkslage stammen aus der Vorlage."]
    ]
  },
  {
    v: "v0.31", date: "17.11.2026", title: "Kleinkram und alte Spielstände",
    intro: "Eine Runde Nacharbeit nach acht Versionen in Folge.",
    items: [
      ["fix", "Im Drehkreuz-Fenster waren die Ankünfte in den Umsteigerwellen unsichtbar: Die Balken hießen intern wie die Abflugliste im Panel und haben deren Abstände geerbt. Jetzt stehen Ankünfte und Abflüge gleich breit nebeneinander."],
      ["fix", "Alte Spielstände werden beim Laden gründlicher ergänzt. Fehlten Felder aus früheren Versionen, blieb das Spiel beim Weiterrechnen stehen; unsinnige Werte setzen sich jetzt auf die Vorgabe zurück, statt alles zu sprengen."],
      ["neu", "Benachrichtigung bei günstigem Kerosin: Steht der Preis nahe am Tief der letzten zwei Wochen und ist das Lager halb leer, lohnt sich Eindecken – eine Gelegenheit, keine Störung."],
      ["besser", "Der Kreditbalken in der Bank zeigt jetzt den freien Rahmen in Farbe statt einer grauen Fläche."]
    ]
  },
  {
    v: "v0.30", date: "17.11.2026", title: "Störfälle mit echten Entscheidungen",
    intro: "Ein Flugzeug fällt aus. Repariert werden muss es so oder so – die Frage ist, was mit den Fluggästen passiert.",
    items: [
      ["neu", "Schwerer Defekt setzt ein Flugzeug fest. Vier Wege, jeder mit eigenen Kosten und Folgen: warten (Entschädigung ab drei Stunden, Ruf minus fünf), Umlauf streichen (Erstattung und Umbuchung, Ruf minus elf), Flugzeug tauschen (günstig und schonend, braucht aber eine freie Maschine) oder leer überführen (wenn die Reserve am falschen Ort steht)."],
      ["neu", "Jede Entscheidung hat zwei Stunden Frist. Wer nicht da ist, bekommt automatisch warten – die sichere, aber selten die beste Wahl. Anwesenheit wird belohnt, Abwesenheit nicht bestraft."],
      ["neu", "Der Störfall-Bereich erscheint nur, wenn wirklich einer offen ist, mit laufendem Countdown je Fall. Benachrichtigungen melden ihn zuerst, noch vor allem anderen."],
      ["neu", "Flugzeuge im Störfall stehen in der Flotte unter Störfall, mit Reparaturende."]
    ]
  },
  {
    v: "v0.29", date: "17.11.2026", title: "Umsteiger am Drehkreuz",
    intro: "Ein Drehkreuz war bisher die Summe seiner Strecken. Jetzt ist es mehr.",
    items: [
      ["neu", "Umsteiger: Wer aus Lissabon kommt und nach Helsinki weiterfliegt, zählt für beide Flüge. Dadurch wird ein Netz aus acht Strecken deutlich mehr wert als acht einzelne Strecken – gemessen steigt der Umsteigeranteil von 5 Prozent des Erlöses bei zwei Strecken auf 16 Prozent bei acht."],
      ["neu", "Ob ein Umstieg zustande kommt, entscheiden drei Dinge: die Umsteigezeit (45 bis 330 Minuten, am besten gut anderthalb Stunden), der Umweg über das Drehkreuz (ab 70 Prozent länger als direkt steigt niemand mehr um) und ob überhaupt ein Zubringer im Fenster landet."],
      ["neu", "Umsteiger füllen nur, was die örtliche Nachfrage frei gelassen hat, und auch davon höchstens zwei Drittel. Ein gut angebundenes Drehkreuz fliegt voller, aber nicht randvoll."],
      ["neu", "Neuer Bereich Umsteiger im Drehkreuz-Fenster: Ankünfte und Abflüge als Wellen über 24 Stunden, der Anteil der Abflüge mit Zubringer und der Erlösanteil der Umsteiger."],
      ["besser", "Die Flugabrechnung nennt jetzt, wie viele der Fluggäste Umsteiger waren."],
      ["besser", "Zwei neue Szenarien im Balance-Werkzeug: Wachstum mit und ohne Personalplanung nebeneinander (95 gegen 0 Prozent Pünktlichkeit) und der Umsteigereffekt über zwei, vier und acht Strecken."]
    ]
  },
  {
    v: "v0.28", date: "17.11.2026", title: "Geführter Einstieg und Benachrichtigungen",
    intro: "Drei Dinge, die das Spiel freundlicher machen, ohne es zu verändern.",
    items: [
      ["neu", "Erste Schritte: eine Liste im Airline-Panel, die sich selbst abhakt. Jeder Schritt sagt, warum er dran ist und wo er zu finden ist – besonders der erste, seit man mit 12 Mio startet und leasen muss statt zu kaufen. Wer sie nicht braucht, blendet sie aus; wer durch ist, sieht sie nie wieder."],
      ["neu", "Browser-Benachrichtigungen, und zwar nur, wenn wirklich etwas wartet: Flugzeug ohne Strecke, überfällige Wartung, auslaufender Leasingvertrag, ungedeckte Kreditrate, Kasse im Minus. Nur im Hintergrund, höchstens eine auf einmal und dieselbe Sache höchstens alle sechs Stunden. Einzuschalten unter Airline → Spielstand."],
      ["fix", "Ein Zähler für überfällige Wartung griff nie: Die Abfrage fragte nach einem Feld, das es nicht gibt. Damit war das Ziel Technisch sauber von Anfang an erfüllt, statt verdient werden zu müssen."],
      ["besser", "Ein Balance-Werkzeug liegt jetzt fest im Projekt (tools/balance.mjs). Es rechnet acht typische Spielsituationen durch und zeigt Marge, Auslastung, Pünktlichkeit und Bewertung nebeneinander – nach jeder Änderung an den Zahlen einmal laufen lassen."]
    ]
  },
  {
    v: "v0.27", date: "17.11.2026", title: "Bewertung, Rangliste und Beteiligungen",
    intro: "Die Rangliste zeigte bisher Kurs, Flotte und Reputation. Jetzt gibt es eine richtige Bewertung – und man kann sich an anderen Airlines beteiligen.",
    items: [
      ["neu", "Bewertung in drei Zahlen: Sterne von 0 bis 5 mit einer Nachkommastelle aus der Reputation, Größe von 0 bis 100 aus Flotte, Personal, Zielen und Fluggästen, Wirtschaftlichkeit von 0 bis 100 Prozent aus Marge und Ergebnis je Flugzeug."],
      ["neu", "Ab zwei Flugzeugen ist eine Airline für Börse und Rangliste qualifiziert. Der eigene Eintrag wird alle zwei Stunden aufgefrischt."],
      ["neu", "Eine Zeile in der Rangliste antippen zeigt das Kurzprofil der fremden Airline: Flotte, Personal, Ziele, Fluggäste, Marge, Ergebnis der letzten 30 Tage, Muster und angeflogene Ziele."],
      ["neu", "Beteiligungen: An einer fremden Airline sind höchstens 49 Prozent erlaubt – die Mehrheit bleibt immer beim Spieler selbst. Der Wert wächst mit der Airline und lässt sich jederzeit verkaufen."],
      ["besser", "Die Demo-Airlines haben jetzt ebenfalls Kurzprofile, damit Bewertung und Detailansicht auch ohne eingerichteten Server etwas zeigen."]
    ]
  },
  {
    v: "v0.26", date: "17.11.2026", title: "Welt, Kalender und Ereignisse",
    intro: "Die Welt war bisher gleichmäßig: jeder Tag wie der andere, nur das Wetter wechselte. Jetzt hat sie Termine und Launen.",
    items: [
      ["neu", "Kalender mit Feiertagen und Ferien: Weihnachten, Ostern, Pfingsten, Sommer- und Herbstferien, Thanksgiving, Independence Day, Oktoberfest, Karneval in Rio, Neujahrsfest in Ostasien, Zuckerfest. Jeder Termin verschiebt Urlaubs- und Geschäftsnachfrage gegenläufig – zu Weihnachten plus 50 Prozent Urlaub und minus 50 Prozent Geschäft."],
      ["neu", "Ereignisse in der Welt: Streiks und Luftraumsperrungen legen Flughäfen vorübergehend still, Unwetterlagen verteuern den Betrieb, Konjunkturdellen drücken die Nachfrage, Großveranstaltungen heben sie. Alles erfunden, alles aus dem Datum gerechnet – jeder Spieler bekommt dieselben Ereignisse."],
      ["neu", "Gesperrte Flughäfen lassen Flüge nicht ausfallen, sondern warten: Der Abflug rückt ans Ende der Sperrung, und die Abflugliste nennt den Grund."],
      ["neu", "Ausweichlandungen: selten, aber teuer. Technischer Defekt, Wetter unter Minimum oder ein medizinischer Notfall an Bord – mit Zusatzkosten, Verspätung und Rufverlust."],
      ["neu", "Neues Fenster Welt mit drei Reitern: was gerade läuft, der Kalender der nächsten Monate und ein Steckbrief zu jedem Flughafen samt Streckenvorschlägen im Rahmen der eigenen Reichweite."],
      ["neu", "Schnellstart: Die ersten zehn Flüge laufen im vierfachen Tempo, danach läuft die Uhr wieder in Echtzeit. Der Vorlauf wird im Spielstand gesichert, damit die Uhr beim nächsten Laden nicht zurückspringt."],
      ["balance", "Der Weihnachtsaufschlag steckte bisher in der Saisonkurve und steckt jetzt im Kalender – sonst hätte er doppelt gezählt."]
    ]
  },
  {
    v: "v0.25", date: "17.11.2026", title: "Kartenstile und Bodenbetrieb",
    intro: "Die Karte konnte bisher genau eine Sache: dunkel sein. Jetzt kann sie vier – und beim Hineinzoomen rollen die Flugzeuge wirklich.",
    items: [
      ["neu", "Vier Kartenstile über das Menü unten rechts: Dunkel, Hell, Schema (ganz ohne Kacheln, läuft auch wenn der Kartendienst streikt) und Satellit (NASA Blue Marble, gemeinfrei)."],
      ["neu", "Nachtschatten: die Erdhälfte, auf der gerade keine Sonne scheint, wird abgedunkelt. Aus Datum und Uhrzeit gerechnet, also für jeden Spieler dieselbe."],
      ["neu", "Bodenbetrieb ab Zoomstufe 11: Bahnen, Vorfeld und Rollwege werden gezeichnet. Für rund 60 große Flughäfen mit den echten Bahnrichtungen, für alle übrigen nach einem festen Schema."],
      ["neu", "Flugzeuge am Boden stehen nicht mehr alle auf dem Flughafenpunkt, sondern an ihrem Gate. Acht Minuten vor dem Abflug rollen sie los, zur Abflugzeit beschleunigen sie auf der Bahn."],
      ["besser", "Der Bodenbetrieb ist reine Darstellung – ein Flug kostet und bringt dasselbe, ob jemand zusieht oder nicht."]
    ]
  },
  {
    v: "v0.24", date: "17.11.2026", title: "Kredite und Kerosin-Diagramme",
    intro: "Geld kam bisher nur aus dem Flugbetrieb oder gar nicht. Jetzt gibt es eine Bank – und sie rechnet nach.",
    items: [
      ["neu", "Kredite in zwei Formen: Annuität mit gleichbleibender Monatsrate oder endfällig mit reinen Zinszahlungen und der ganzen Summe am Schluss. Laufzeiten ein, zwei oder fünf Jahre."],
      ["neu", "Der Zinssatz kommt aus dem Risiko: Ruf, bestehende Schulden und der ausgereizte Rahmen schlagen auf. Wer schon einen Kredit laufen hat, zahlt für den nächsten sichtbar mehr."],
      ["neu", "Der Kreditrahmen wächst mit dem Ertrag der letzten 30 Tage und mit eigenen Flugzeugen. Geleaste gehören dem Leasinggeber und taugen nicht als Sicherheit – Kredit ist damit der Weg ins Eigentum, nicht an ihm vorbei."],
      ["neu", "Vorzeitige Ablösung gegen Vorfälligkeitsentschädigung. Reicht die Kasse bei Fälligkeit nicht, wächst die Restschuld und der Ruf sinkt – ein Spielende gibt es nicht."],
      ["neu", "Kerosin mit Diagrammen: Tagesverbrauch der letzten 14 Tage als Säulen, dazu Schnitt pro Tag und wie lange der Vorrat noch reicht."],
      ["fix", "Die wichtigste Regel des Spiels war ganz leicht verletzt: Ziele wurden am Ende des Nachrechnens geprüft, also je nach Schrittweite zu leicht anderer Zeit. Weil die Belohnung Reputation enthält, lief damit die Nachfrage auseinander. Ziele fallen jetzt am Ereignis selbst – stündlich und täglich Nachrechnen liefert wieder auf den Cent dasselbe."]
    ]
  },
  {
    v: "v0.23", date: "17.11.2026", title: "Drehkreuz, Technik und Kabine",
    intro: "Bisher war der eigene Flughafen nur ein Punkt auf der Karte. Jetzt gehört einem dort etwas – und man merkt es im Betrieb.",
    items: [
      ["neu", "Drehkreuz-Ausbau in drei Bereichen: Gates vom Vorfeldbus bis zum eigenen Terminal, Lounges von keiner bis zur First Lounge, Technik von der Fremdwartung bis zur Großwerft. Jede Stufe kostet einmal und läuft danach mit Unterhalt mit."],
      ["neu", "Gute Gates kürzen die Standzeit und senken das Verspätungsrisiko – aber nur am eigenen Drehkreuz. Draußen entscheidet weiter allein der Abfertiger."],
      ["neu", "Lounges ziehen Nachfrage in die vorderen Klassen und heben den Ruf. Economy merkt davon nichts."],
      ["neu", "Die eigene Werft macht Checks schneller und billiger und senkt die Technikerkosten – aber nur so weit, wie sie Hallenplätze hat. Wer schneller wächst als er baut, kauft den Rest wieder zu."],
      ["neu", "Kabinenausstattung je Flugzeug: Slimline bringt acht Prozent mehr Sitzbudget und kostet Ruf, Komfortsitze umgekehrt. Dazu WLAN und Bildschirme, die Ruf und Bordverkauf heben. Der Umbau kostet je Sitz und Hallenzeit."],
      ["fix", "Die Tests liefen bisher gelegentlich rot: Flugzeug-IDs sind zufällig, und der gesamte deterministische Zufall hängt daran. In den Tests sind sie jetzt fest – damit sind auch die Balance-Zahlen von Lauf zu Lauf vergleichbar."]
    ]
  },
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
