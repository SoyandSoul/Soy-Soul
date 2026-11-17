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
  plane: s('<path d="M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V9l7 4v2l-7-2v4.5l2 1.5v1.5L12 20l-3.5 1v-1.5l2-1.5V13l-7 2v-2l7-4z"/>'),
  overview: s('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/>'),
  fleet: s('<path d="M3 17h18"/><path d="M8 13.5 6.2 7.8a.8.8 0 0 1 .8-1l1 .1L10 11h3.3l1.5-3.6 1.6.3L15.6 11H19a2 2 0 0 1 0 4H7z"/>'),
  staff: s('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14c3 0 6 1.8 6 5"/>'),
  finance: s('<path d="M4 19h16"/><path d="M7 15v-4M12 15V7M17 15v-6"/>'),
  offer: s('<path d="M4 11h16"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M3 15h18"/>'),
  contract: s('<path d="M6 3h9l4 4v14H6z"/><path d="M9 13l2 2 4-4"/>'),
  hub: s('<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/>'),
  account: s('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  paint: s('<path d="M4 20c2 0 4-1 4-4l9-9 3 3-9 9c-3 0-4 2-4 4"/><path d="M14 6l4 4"/>'),
  alert: s('<path d="M12 3L2 20h20L12 3z"/><path d="M12 10v5M12 18h.01"/>'),
  gate: s('<path d="M3 21h18"/><path d="M6 21V8l7-4v17"/><path d="M13 10h5v11"/><path d="M9 12h1"/>'),
  wrench: s('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.3-.7-.7-2.3z"/>'),
  calendar: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  bank: s('<path d="M3 10l9-6 9 6"/><path d="M5 10v9M10 10v9M14 10v9M19 10v9"/><path d="M3 21h18"/>')
};
