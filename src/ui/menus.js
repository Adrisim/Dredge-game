import { h } from './dom.js';
import { icon } from './icons.js';
import { thumbSvg } from './cargoUI.js';
import { ITEMS, ITEM_LIST } from '../game/items.js';
import { QUESTS, MAIN } from '../game/quests.js';
import { getTown, zoneName } from '../world/worldgen.js';
import { fmtMoney } from '../util/math.js';
import { audio } from '../audio.js';
import { hasSave } from '../game/state.js';

export function openMenu(game) {
  const sheet = h('div', { class: 'sheet overlay', style: 'justify-content:center;align-items:center' });
  const close = () => { sheet.remove(); audio.close(); game.closeModal(); };
  const box = h('div', { class: 'box', style: 'width:min(86vw,340px);display:flex;flex-direction:column;gap:10px;background:#0c1f30;border:1px solid var(--line);border-radius:18px;padding:18px' },
    h('h2', { style: 'margin:0 0 4px;font-family:var(--serif);font-weight:400;color:var(--paper);letter-spacing:2px;text-align:center' }, 'Paused'),
    h('button', { class: 'btn primary block', onclick: close }, 'Resume'),
    h('button', { class: 'btn block', html: icon('book', 18) + 'Journal', onclick: () => { close(); game.openJournal(); } }),
    h('button', { class: 'btn block', html: icon('fish', 18) + 'Fish log', onclick: () => { close(); game.openFishLog(); } }),
    h('button', { class: 'btn block', html: icon('gear', 18) + 'Settings', onclick: () => { close(); game.openSettings(); } }),
    h('button', { class: 'btn block', html: icon('save', 18) + 'Save game', onclick: () => { game.saveGame(true); } }),
    h('button', { class: 'btn block', html: icon('home', 18) + 'Title screen', onclick: () => { close(); game.saveGame(); game.toTitle(); } }),
  );
  sheet.append(box);
  game.openModal(sheet, close);
}

export function openJournal(game) {
  const st = game.state;
  const sheet = h('div', { class: 'sheet' });
  const close = () => { sheet.remove(); audio.close(); game.closeModal(); };
  const body = h('div', { class: 'sheet-body' });
  // main story
  const m = st.main;
  const have = m.have.filter(Boolean).length;
  const main = h('div', { class: 'card main' }, h('h3', { html: icon('star', 18) + ' ' + MAIN.title }));
  if (m.stage === 0) main.append(h('p', {}, 'Speak to Marrin the Harbourmaster in Saltmere (Harbour tab) to take up the charge.'));
  else {
    main.append(h('p', {}, `Lens fragments: ${have}/4`), h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, have * 25 + (m.delivered ? 0 : 0))}%;background:var(--accent)` })));
    MAIN.steps.forEach((s, i) => {
      const done = i < 4 ? m.have[i] : m.delivered;
      main.append(h('p', { style: `color:${done ? 'var(--good)' : 'var(--text)'}` }, (done ? '✓ ' : '• ') + s));
    });
  }
  body.append(main, h('div', { class: 'sec-title' }, 'Active jobs'));
  const active = QUESTS.filter((q) => st.quests.active.includes(q.id));
  if (!active.length) body.append(h('div', { class: 'empty' }, 'No jobs yet. Harbourmasters in every town post work.'));
  for (const q of active) {
    const prog = game.questProgress(q);
    body.append(h('div', { class: 'card' }, h('h3', {}, q.title), h('p', {}, 'Deliver to ' + getTown(q.town).name + ' (' + zoneName(getTown(q.town).zone) + ')'),
      h('div', { style: 'margin-top:8px' }, prog.map((p) => h('span', { class: 'mat ' + (p.have >= p.need ? 'ok' : 'no') }, `${p.name} ${Math.min(p.have, p.need)}/${p.need}`)))));
  }
  body.append(h('div', { class: 'sec-title' }, 'Voyage'),
    h('div', { class: 'card' },
      h('div', { class: 'kv' }, h('span', {}, 'Day'), h('b', {}, st.day)),
      h('div', { class: 'kv' }, h('span', {}, 'Catches landed'), h('b', {}, st.stats.caught)),
      h('div', { class: 'kv' }, h('span', {}, 'Coin earned'), h('b', {}, fmtMoney(st.stats.earned))),
      h('div', { class: 'kv' }, h('span', {}, 'Jobs done'), h('b', {}, st.quests.done.length + '/' + QUESTS.length)),
      h('div', { class: 'kv' }, h('span', {}, 'Times wrecked'), h('b', {}, st.stats.sunk)),
      h('div', { class: 'kv' }, h('span', {}, 'Towns visited'), h('b', {}, st.visited.length + '/9'))));
  sheet.append(h('div', { class: 'sheet-head' }, h('h1', {}, 'Journal'), h('button', { class: 'xbtn', html: icon('close', 20), onclick: close })), body);
  game.openModal(sheet, close);
}

export function openFishLog(game) {
  const st = game.state;
  const sheet = h('div', { class: 'sheet' });
  const close = () => { sheet.remove(); audio.close(); game.closeModal(); };
  const list = ITEM_LIST.filter((i) => ['fish', 'crab', 'aberrant'].includes(i.cat));
  const found = list.filter((i) => st.log[i.id]).length;
  const grid = h('div', { class: 'fishgrid' });
  for (const it of list) {
    const n = st.log[it.id] || 0;
    const card = h('div', { class: 'fcard' + (n ? '' : ' unk') });
    card.innerHTML = thumbSvg(it.id, 54) + `<b>${n ? it.name : '???'}</b><span>${n ? '×' + n + (it.cat === 'aberrant' ? ' · aberrant' : '') : 'Not yet caught'}</span>`;
    grid.append(card);
  }
  sheet.append(h('div', { class: 'sheet-head' }, h('h1', {}, 'Fish Log', h('small', {}, `${found}/${list.length} species discovered`)), h('button', { class: 'xbtn', html: icon('close', 20), onclick: close })),
    h('div', { class: 'sheet-body' }, grid));
  game.openModal(sheet, close);
}

export function openSettings(game) {
  const st = game.state;
  const sheet = h('div', { class: 'sheet' });
  const close = () => { sheet.remove(); audio.close(); game.closeModal(); };
  const body = h('div', { class: 'sheet-body' });
  const seg = (opts, cur, onPick) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: cur === v ? 'on' : '', onclick: (e) => { onPick(v); [...e.target.parentNode.children].forEach((c) => c.classList.remove('on')); e.target.classList.add('on'); audio.tap(); } }, l)));
  body.append(
    h('div', { class: 'setting' }, h('span', {}, 'Sound'), seg([[true, 'On'], [false, 'Off']], st.settings.sound, (v) => { st.settings.sound = v; audio.setEnabled(v); })),
    h('div', { class: 'setting' }, h('span', {}, 'Graphics'), seg([['auto', 'Auto'], ['low', 'Low'], ['high', 'High']], st.settings.quality, (v) => { st.settings.quality = v; game.applyQuality(); })),
    h('div', { class: 'setting' }, h('span', {}, 'Tutorial hints'), seg([[true, 'On'], [false, 'Off']], st.settings.hints, (v) => { st.settings.hints = v; })),
    h('div', { class: 'setting' }, h('span', {}, 'Vibration'), seg([[true, 'On'], [false, 'Off']], st.settings.vibrate !== false, (v) => { st.settings.vibrate = v; })),
    h('div', { class: 'sec-title' }, 'How to play'),
    h('div', { class: 'card' }, h('p', { style: 'color:var(--text);line-height:1.6' },
      '• Left stick: steer (left/right) and throttle (up/down). Use the chevron button for cruise control.\n'.replace(/\n/g, ''),
      h('br'), '• Sail into bubbling water and tap FISH. Tap REEL when the needle crosses the gold zone.',
      h('br'), '• Everything you catch is a puzzle piece - drag pieces to fit your hold. Tap to rotate.',
      h('br'), '• Dark patches on the sea floor are for dredging. Shallow coastal spots take crab pots.',
      h('br'), '• Night is dangerous: dread builds in the dark. Keep your lamp on, or get to port.',
      h('br'), '• Sell at the market, repair and upgrade at the shipyard. Find the four lens fragments.')),
    h('button', { class: 'btn danger block', style: 'margin-top:14px', onclick: () => game.confirm('Start over?', 'This erases your saved voyage.', () => { close(); game.newGame(); }, 'Erase & restart') }, 'New game'),
  );
  sheet.append(h('div', { class: 'sheet-head' }, h('h1', {}, 'Settings'), h('button', { class: 'xbtn', html: icon('close', 20), onclick: close })), body);
  game.openModal(sheet, close);
}

export function buildTitle(game, onNew, onContinue) {
  const el = h('div', { class: 'title-screen' },
    h('div', {}, h('h1', {}, 'HOLLOW TIDE'), h('div', { class: 'tag-line' }, 'Fish. Haul. Survive the dark.')),
    h('div', {},
      h('div', { class: 'title-actions' },
        hasSave() ? h('button', { class: 'btn primary', onclick: onContinue }, 'Continue voyage') : null,
        h('button', { class: 'btn' + (hasSave() ? '' : ' primary'), onclick: onNew }, hasSave() ? 'New game' : 'Set sail')),
      h('div', { class: 'title-foot' }, 'Best played full-screen with sound on')),
  );
  return el;
}
