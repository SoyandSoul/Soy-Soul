// Kredite.
//
// Zwei Formen, wie sie Airlines tatsächlich nutzen:
//   Annuität  – jeden Monat dieselbe Rate aus Zins und Tilgung. Planbar, bindet aber dauerhaft Geld.
//   Endfällig – monatlich nur Zinsen, die ganze Summe am Ende. Billig im Betrieb, teuer im Moment der Fälligkeit.
//
// Zahlungen sind feste Termine, keine laufende Verzinsung: Genau wie beim Charter hängt dadurch
// nichts an der Schrittweite des Nachrechnens. Wer drei Tage wegbleibt, zahlt beim nächsten Laden
// dieselben Raten wie jemand, der stündlich reinschaut.
//
// Der Zinssatz kommt aus dem Risiko: Wer wenig verdient, viel Schulden hat oder einen schlechten
// Ruf, zahlt mehr. Das ist der eigentliche Hebel – ein Kredit ist nie „gratis Geld".

import { CREDIT, DAY } from "../core/config.js";
import { clamp } from "../core/util.js";
import { summary } from "./ledger.js";
import { companyValue } from "./stocks.js";
import { monthlyObligation } from "./lease.js";

export const MONTH = CREDIT.monthDays * DAY;

export const loansOf = state => state.credit?.loans || [];
export const openLoans = state => loansOf(state).filter(l => l.rest > 0);

/** Restschuld über alle laufenden Kredite. */
export const totalDebt = state => openLoans(state).reduce((s, l) => s + l.rest, 0);

/** Monatliche Belastung aus Krediten – zum Vergleich mit den Leasingraten. */
export const monthlyLoad = state => openLoans(state).reduce((s, l) => s + l.payment, 0);

/**
 * Was die Bank zutraut. Grundlage ist der Ertrag der letzten 30 Tage, nicht das Vermögen:
 * Eine Bank finanziert den laufenden Betrieb, nicht die Flugzeuge, die schon dem Leasinggeber gehören.
 */
export function creditLimit(state, now) {
  const profit30 = Math.max(0, summary(state, 30, now).profit);
  const v = companyValue(state, now);
  // Eigene Flugzeuge sind Sicherheiten, geleaste gehören dem Leasinggeber – deshalb zählt
  // der Flottenwert voll, der Rest des Vermögens nur anteilig.
  // Firmenwert (goodwill) ist keine Sicherheit – die Bank sieht Flugzeuge, Kasse und Vorräte.
  const assets = v.cash + v.fuel + v.holdings;
  const base = profit30 * CREDIT.profitMultiple + v.fleet * CREDIT.fleetShare + assets * CREDIT.valueShare;
  const load = (monthlyObligation(state) + monthlyLoad(state)) * CREDIT.loadMultiple;
  return Math.max(0, Math.round((base - load - totalDebt(state)) / 1e5) * 1e5);
}

/** Zinssatz pro Jahr. Ruf und bestehende Last entscheiden. */
export function interestRate(state, now, months) {
  const rep = clamp(state.airline.rep, 0, 100);
  const limit = creditLimit(state, now) + totalDebt(state) + 1;
  const leverage = clamp(totalDebt(state) / limit, 0, 1);
  const term = CREDIT.termPremium[months] ?? 0;
  const rate = CREDIT.base + CREDIT.repSpan * (1 - rep / 100) + CREDIT.leverageSpan * leverage + term;
  return Math.round(rate * 10000) / 10000;
}

/** Monatsrate einer Annuität. */
export function annuity(principal, yearRate, months) {
  const i = yearRate / 12;
  if (i <= 0) return principal / months;
  return principal * i / (1 - Math.pow(1 + i, -months));
}

/** Angebot zu einer Wunschsumme. */
export function quote(state, now, amount, months, mode) {
  if (!CREDIT.terms.includes(months) || !["annuity", "bullet"].includes(mode)) return null;
  const rate = interestRate(state, now, months);
  const payment = mode === "annuity" ? annuity(amount, rate, months) : amount * rate / 12;
  const totalPaid = mode === "annuity" ? payment * months : payment * months + amount;
  return {
    amount, months, mode, rate,
    payment: Math.round(payment),
    totalPaid: Math.round(totalPaid),
    interest: Math.round(totalPaid - amount),
    balloon: mode === "bullet" ? amount : 0,
    fee: Math.round(amount * CREDIT.fee)
  };
}

/** Fällige Raten abarbeiten. Wird in settle() vor allem anderen aufgerufen. */
export function dueLoans(state, now) {
  const events = [];
  for (const l of loansOf(state)) {
    while (l.rest > 0 && l.nextDue <= now) {
      const interest = l.rest * l.rate / 12;
      let principal = l.mode === "annuity" ? Math.max(0, l.payment - interest) : 0;
      l.paidCount++;
      if (l.paidCount >= l.months) principal = l.rest;          // letzte Rate bzw. endfällige Summe
      principal = Math.min(principal, l.rest);
      events.push({ loan: l, ts: l.nextDue, interest, principal, last: l.paidCount >= l.months });
      l.rest = Math.round((l.rest - principal) * 100) / 100;
      l.nextDue += MONTH;
    }
  }
  return events;
}

/** Vorzeitige Ablösung: Restschuld plus Vorfälligkeitsentschädigung. */
export function payoffQuote(state, loanId) {
  const l = loansOf(state).find(x => x.id === loanId);
  if (!l || l.rest <= 0) return null;
  const fee = Math.round(l.rest * CREDIT.earlyFee);
  return { loan: l, rest: Math.round(l.rest), fee, total: Math.round(l.rest) + fee };
}

/** Wie viel Luft noch da ist – für die Anzeige. */
export function debtNote(state, now) {
  const debt = totalDebt(state), limit = creditLimit(state, now);
  const load = monthlyLoad(state);
  const lease = monthlyObligation(state);
  return {
    debt, limit, load, lease,
    ratio: debt + limit > 0 ? debt / (debt + limit) : 0,
    text: !debt ? "Schuldenfrei."
      : debt > limit * 2 ? "Hoch verschuldet – die nächste Bank verlangt deutlich mehr Zins."
      : debt > limit ? "Spürbar verschuldet."
      : "Die Schuldenlast ist tragbar."
  };
}
