// Spielzeit = echte Uhrzeit des Geräts.
// Es gibt keinen Server, der Flüge weiterlaufen lässt. Stattdessen ist jeder Flug durch Abflugzeit + Blockzeit
// festgelegt, und beim Öffnen rechnet sim/engine.js alles nach, was seit dem letzten Besuch passiert ist.
//
// Für Tests lässt sich die Uhr verschieben: ?dev=1 in der URL, dann clock.shift(stunden) in der Konsole.

let offset = 0;        // Testverschiebung (?dev=1)
let boost = 0;         // zusätzlicher Vorlauf aus dem Schnellstart, wird im Spielstand gehalten
let lastReal = 0;

export const clock = {
  now: () => Date.now() + offset + boost,
  shift(hours) { offset += hours * 3600_000; return new Date(clock.now()).toISOString(); },
  reset() { offset = 0; },
  get offset() { return offset; },

  /**
   * Schnellstart: Solange er läuft, vergeht die Spielzeit schneller als die echte.
   * Der Vorlauf wird aufsummiert und im Spielstand gesichert – sonst spränge die Uhr
   * beim nächsten Laden zurück und der Nachrechner würde sich verschlucken.
   */
  setBoost(ms) { boost = ms || 0; lastReal = Date.now(); },
  get boost() { return boost; },
  /** Einen Zeitschritt im Zeitraffer gutschreiben. factor 4 heißt: vierfaches Tempo. */
  advanceBoost(factor) {
    const real = Date.now();
    if (!lastReal) { lastReal = real; return boost; }
    const elapsed = real - lastReal;
    lastReal = real;
    if (elapsed > 0 && elapsed < 60_000) boost += elapsed * (factor - 1);
    return boost;
  }
};
