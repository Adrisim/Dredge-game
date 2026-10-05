// Inline SVG icons. UI glyphs use a 24x24 stroke style; item icons use a 100x100 filled style.
const P = {
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  bag: '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 8v12M8 8V5h8v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  lamp: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 12H3a9 9 0 0018 0h-2M8.5 10.5h7"/>',
  rod: '<path d="M4 20L16 4M16 4c3 0 5 2 5 5v6a3 3 0 11-6 0"/>',
  pick: '<path d="M5 20l9-9M7 8c3-4.5 9-4.5 13 0-4-1.2-7.5-.2-9.5 2.5z"/>',
  pot: '<path d="M5 9a7 5 0 0114 0v7a7 4 0 01-14 0zM5 12.5h14M12 5v16"/>',
  collect: '<path d="M5 9a7 5 0 0114 0v7a7 4 0 01-14 0zM9 14l2 2 4-4"/>',
  ferry: '<path d="M3 18c2 2 4 2 6 0s4-2 6 0 4 2 6 0M5 15l1.5-7h11L19 15M12 8V3h4"/>',
  rotate: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z"/>',
  book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11"/>',
  fish: '<path d="M3 12c3-5 8-6 12-3l4-3v12l-4-3c-4 3-9 2-12-3z"/><circle cx="8" cy="11" r=".9" fill="currentColor"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  up: '<path d="M6 11l6-6 6 6M6 18l6-6 6 6"/>',
  check: '<path d="M5 12.5l5 5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  sound: '<path d="M4 10v4h4l5 4V6l-5 4zM16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11"/>',
  mute: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9l5 6M22 9l-5 6"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>',
  home: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>',
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  skull: '<path d="M5 11a7 7 0 0114 0v4l-2 1v4H7v-4l-2-1zM9 12h.01M15 12h.01M11 17v2M13 17v2"/>',
};
export function icon(name, size = 22, extra = '') {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export { shade };

// 100x100 filled item icons. `c` = main colour, `k` = ink (dark) colour, `l` = light colour.
const ITEM_ICONS = {
  fish: (c, k, l) => `<path d="M6 50c14-26 40-30 58-12l24-16v56L64 62C46 80 20 76 6 50z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M30 30c8 6 10 34 0 40" fill="none" stroke="${k}" stroke-width="3" opacity=".5"/><path d="M40 28c10-10 22-8 28 4" fill="${l}" opacity=".6"/><circle cx="24" cy="46" r="5" fill="#fff"/><circle cx="23" cy="46" r="2.6" fill="${k}"/>`,
  flat: (c, k, l) => `<path d="M8 50L38 20l50 18v24L38 80z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M30 38l30 12-30 12" fill="none" stroke="${k}" stroke-width="3" opacity=".4"/><circle cx="22" cy="44" r="4" fill="#fff"/><circle cx="22" cy="44" r="2" fill="${k}"/>`,
  eel: (c, k) => `<path d="M6 62c12-30 26 18 42-8s28 6 46-10v16c-18 16-26-10-42 12S20 84 6 76z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="14" cy="64" r="3.5" fill="#fff"/><circle cx="14" cy="64" r="1.8" fill="${k}"/>`,
  crab: (c, k, l) => `<g stroke="${k}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M26 66L12 80M36 72l-6 16M64 72l6 16M74 66l14 14"/><path d="M26 48C8 46 6 26 24 22c-4 10 2 16 10 16M74 48c18-2 20-22 2-26 4 10-2 16-10 16"/></g><ellipse cx="50" cy="56" rx="28" ry="20" fill="${c}" stroke="${k}" stroke-width="4"/><circle cx="40" cy="42" r="4" fill="#fff"/><circle cx="60" cy="42" r="4" fill="#fff"/><circle cx="40" cy="42" r="2" fill="${k}"/><circle cx="60" cy="42" r="2" fill="${k}"/>`,
  squid: (c, k) => `<g stroke="${k}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M36 58c-2 14-8 22-16 30M45 60c0 14-2 24-4 32M55 60c0 14 2 24 4 32M64 58c2 14 8 22 16 30"/></g><path d="M50 6c20 14 22 38 12 54H38C28 44 30 20 50 6z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="42" cy="46" r="5" fill="#fff"/><circle cx="58" cy="46" r="5" fill="#fff"/><circle cx="42" cy="47" r="2.5" fill="${k}"/><circle cx="58" cy="47" r="2.5" fill="${k}"/>`,
  ray: (c, k) => `<path d="M50 18c22 10 42 24 48 38-16-4-30 2-36 14L50 96 38 70C32 58 18 52 2 56 8 42 28 28 50 18z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="42" cy="40" r="3" fill="#fff"/><circle cx="58" cy="40" r="3" fill="#fff"/>`,
  shark: (c, k) => `<path d="M4 58C24 36 50 32 72 40l18-24-4 30 10 18-26-6C50 78 24 76 4 58z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M34 54l6 6M42 52l6 6M50 50l6 6" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="22" cy="54" r="3.5" fill="#fff"/><circle cx="22" cy="54" r="1.8" fill="${k}"/>`,
  scrap: (c, k, l) => `<path d="M16 26l54-10 16 32-10 34-48 10-18-32z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="52" r="9" fill="${k}"/><circle cx="48" cy="52" r="4" fill="${l}"/><path d="M24 36l16-3M60 78l14-2" stroke="${l}" stroke-width="3"/>`,
  wood: (c, k, l) => `<rect x="6" y="26" width="88" height="20" rx="6" fill="${c}" stroke="${k}" stroke-width="4"/><rect x="12" y="54" width="78" height="20" rx="6" fill="${l}" stroke="${k}" stroke-width="4"/><path d="M22 36h30M30 64h28" stroke="${k}" stroke-width="3" opacity=".5"/>`,
  ore: (c, k, l) => `<path d="M14 62l10-28 24-16 28 8 14 30-16 24-36 4z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M24 34l24 12 28-20M48 46l-4 38M48 46l38 14" stroke="${k}" stroke-width="3" opacity=".5" fill="none"/><path d="M34 40l8-4" stroke="${l}" stroke-width="5"/>`,
  gem: (c, k, l) => `<path d="M50 6l32 26-32 62L18 32z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M18 32h64M36 32l14-26 14 26-14 62z" stroke="${l}" stroke-width="3" fill="none" opacity=".8"/>`,
  pearl: (c, k, l) => `<circle cx="50" cy="50" r="34" fill="${c}" stroke="${k}" stroke-width="4"/><ellipse cx="38" cy="38" rx="9" ry="6" fill="${l}" opacity=".8" transform="rotate(-30 38 38)"/>`,
  coin: (c, k, l) => `<circle cx="50" cy="50" r="38" fill="${c}" stroke="${k}" stroke-width="4"/><circle cx="50" cy="50" r="25" fill="none" stroke="${k}" stroke-width="3"/><path d="M50 34v32M42 44l8-10 8 10" stroke="${l}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  compass: (c, k, l) => `<circle cx="50" cy="50" r="38" fill="${c}" stroke="${k}" stroke-width="4"/><circle cx="50" cy="50" r="28" fill="${l}" opacity=".5"/><path d="M50 20l11 30-11 30-11-30z" fill="${k}"/><path d="M50 20l11 30H39z" fill="#e24a3a"/>`,
  idol: (c, k, l) => `<path d="M34 10h32l6 24-8 10 10 46H26l10-46-8-10z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="43" cy="30" r="3.5" fill="${k}"/><circle cx="57" cy="30" r="3.5" fill="${k}"/><path d="M42 66h16" stroke="${l}" stroke-width="4"/>`,
  boot: (c, k, l) => `<path d="M28 10h28v36l34 16v24H16z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M16 78h74" stroke="${k}" stroke-width="5"/><path d="M28 24h28" stroke="${l}" stroke-width="3" opacity=".7"/>`,
  can: (c, k, l) => `<rect x="26" y="20" width="48" height="60" rx="7" fill="${c}" stroke="${k}" stroke-width="4"/><path d="M26 36h48M26 62h48" stroke="${k}" stroke-width="3"/><ellipse cx="50" cy="20" rx="24" ry="7" fill="${l}" stroke="${k}" stroke-width="3"/>`,
  net: (c, k) => `<path d="M12 12h76v76H12zM12 37h76M12 62h76M37 12v76M62 12v76" fill="none" stroke="${k}" stroke-width="4"/><circle cx="50" cy="50" r="8" fill="${c}" stroke="${k}" stroke-width="3"/>`,
  lens: (c, k, l) => `<circle cx="50" cy="50" r="38" fill="${c}" stroke="${k}" stroke-width="4"/><circle cx="50" cy="50" r="26" fill="none" stroke="${l}" stroke-width="4"/><circle cx="50" cy="50" r="12" fill="${l}"/><path d="M50 4v16M50 80v16M4 50h16M80 50h16" stroke="${k}" stroke-width="3" opacity=".6"/>`,
};
export function itemIconMarkup(kind, color) {
  const f = ITEM_ICONS[kind] || ITEM_ICONS.fish;
  return f(color, shade(color, -0.32), shade(color, 0.28));
}
