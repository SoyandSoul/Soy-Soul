// Spieleridentität ohne E-Mail und Passwort.
//   code   – öffentlich, steht in Börse und Rangliste neben dem Airline-Namen (z. B. AL-7KQ-M3D)
//   secret – bleibt im Browser; beweist dem Backend, dass Updates für diesen Code von dir kommen.
//            Mit Code + Schlüssel lässt sich der Spielstand auf einem anderen Gerät wiederherstellen.

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I

function randomChars(n) {
  const buf = new Uint32Array(n);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, v => ALPHA[v % ALPHA.length]).join("");
}

export function newPlayer() {
  const c = randomChars(6);
  return { code: `AL-${c.slice(0, 3)}-${c.slice(3)}`, secret: randomChars(24) };
}

export const CODE_RE = /^AL-[A-Z0-9]{3}-[A-Z0-9]{3}$/;
