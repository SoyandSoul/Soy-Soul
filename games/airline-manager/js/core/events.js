// Minimaler Event-Bus: Simulation meldet, UI hört zu. So bleibt sim/ frei von DOM-Code.
//
// Ereignisse:
//   state        – Spielstand hat sich geändert (UI neu zeichnen)
//   toast        – { text, kind: "info"|"good"|"warn"|"bad" }
//   crash        – { aircraft, route }
//   incident     – { aircraft, route }
//   checkDue     – { aircraft, check, remainingFH }
//   delivered    – { aircraft }

const handlers = new Map();

export const bus = {
  on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type).delete(fn);
  },
  emit(type, payload) {
    handlers.get(type)?.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }
};
