// Spielzeit = echte Uhrzeit des Geräts.
// Es gibt keinen Server, der Flüge weiterlaufen lässt. Stattdessen ist jeder Flug durch Abflugzeit + Blockzeit
// festgelegt, und beim Öffnen rechnet sim/engine.js alles nach, was seit dem letzten Besuch passiert ist.
//
// Für Tests lässt sich die Uhr verschieben: ?dev=1 in der URL, dann clock.shift(stunden) in der Konsole.

let offset = 0;

export const clock = {
  now: () => Date.now() + offset,
  shift(hours) { offset += hours * 3600_000; return new Date(clock.now()).toISOString(); },
  reset() { offset = 0; },
  get offset() { return offset; }
};
