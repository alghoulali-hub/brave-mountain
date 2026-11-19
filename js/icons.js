// Inline stroke icons. size and color are optional.
const s = (d, size = 22, color = 'currentColor', w = 2, fill = 'none') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ic = {
  star: (z = 20) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="#FFB020" stroke="#C77A00" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`,
  mountain: (z, c) => s('<path d="M4 21l6-12 4 6 2-3 4 9z"/>', z, c),
  flag: (z, c) => s('<path d="M4 21l6-12 4 6 2-3 4 9z"/><path d="M10 9V3l5 2-5 2"/>', z, c),
  heart: (z, c) => s('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', z, c),
  heartFill: (z = 22) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="#F28DB2" stroke="#B4366B" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>`,
  gift: (z, c) => s('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/>', z, c),
  moon: (z, c) => s('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', z, c),
  check: (z, c, w = 3) => s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', z, c, w),
  lock: (z, c) => s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', z, c, 2.2),
  back: (z, c) => s('<path d="M15 5l-7 7 7 7"/>', z, c, 2.4),
  close: (z, c) => s('<path d="M6 6l12 12M18 6L6 18"/>', z, c, 2.4),
  sun: (z, c) => s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', z, c),
  school: (z, c) => s('<path d="M3 10l9-6 9 6"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>', z, c),
  eye: (z, c) => s('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', z, c),
  box: (z, c) => s('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M10 15h4"/><path d="M8 7V5h8v2"/>', z, c),
  play: (z, c) => s('<path d="M8 5v14l11-7z"/>', z, c),
  shield: (z, c) => s('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>', z, c),
  wind: (z, c) => s('<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>', z, c),
  car: (z, c) => s('<path d="M5 17h14l-1.5-5h-11z"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/><path d="M7 12l1.5-4h7l1.5 4"/>', z, c),
  today: (z, c) => s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', z, c),
  chart: (z, c) => s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', z, c),
  cog: (z, c) => s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', z, c),
  plus: (z, c) => s('<path d="M12 5v14M5 12h14"/>', z, c, 2.4),
  trash: (z, c) => s('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>', z, c),
  mic: (z, c) => s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', z, c),
  share: (z, c) => s('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/>', z, c),
  apple: (z, c) => s('<path d="M12 7c-1.5-1.2-4-1.4-5.6.2C4.5 9.1 4.8 13 6.6 16.2 8 18.7 9.9 20.6 12 19.6c2.1 1 4-.9 5.4-3.4 1.8-3.2 2.1-7.1.2-9-1.6-1.6-4.1-1.4-5.6-.2z"/><path d="M12 7c0-2 1-3.5 3-4"/>', z, c),
  up: (z, c) => s('<path d="M12 19V5M5 12l7-7 7 7"/>', z, c, 2.4)
};
