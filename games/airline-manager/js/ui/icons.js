// Linien-Icons (24×24, currentColor), eigene Zeichnungen.
const s = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  hangar: s('<path d="M3 20V10l9-6 9 6v10"/><path d="M7 20v-6h10v6"/><path d="M10 17h4"/>'),
  shop: s('<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
  routes: s('<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17c6-1 4-9 10-10" stroke-dasharray="2 3"/>'),
  maint: s('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.3-.7-.7-2.3z"/>'),
  fuel: s('<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M4 20h11"/><path d="M8 8h3"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3"/>'),
  airline: s('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  stocks: s('<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M14 7h4v4"/>'),
  board: s('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>'),
  log: s('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: s('<path d="M15 18l-6-6 6-6"/>'),
  plane: s('<path d="M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V9l7 4v2l-7-2v4.5l2 1.5v1.5L12 20l-3.5 1v-1.5l2-1.5V13l-7 2v-2l7-4z"/>')
};
