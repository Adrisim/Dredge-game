import { h } from './dom.js';
import { icon } from './icons.js';
import { CargoView, itemCard, thumbSvg } from './cargoUI.js';
import { ITEMS } from '../game/items.js';
import { UPGRADES, UPGRADE_KEYS, curIndex } from '../game/upgrades.js';
import { QUESTS, MAIN } from '../game/quests.js';
import { towns, getTown, zoneName } from '../world/worldgen.js';
import { fmtMoney } from '../util/math.js';
import { audio } from '../audio.js';

const coin = (n, bad) => h('span', { class: 'price' + (bad ? ' bad' : '') }, h('span', { html: icon('coin', 15) }), fmtMoney(n));

export function openTown(game, town) {
  const st = game.state;
  const sheet = h('div', { class: 'sheet' });
  const body = h('div', { class: 'sheet-body' });
  const moneyChip = h('span', { class: 'price', style: 'font-size:15px' });
  let tab = town.noShops ? 'lantern' : (game.lastTownTab || 'market');
  let cargoView = null;

  const tabsDef = town.noShops
    ? [['lantern', 'Lantern', 'lamp']]
    : [['market', 'Market', 'fish'], ['yard', 'Shipyard', 'anchor'], ['harbour', 'Harbour', 'book'], ['tavern', 'Tavern', 'home']];
  const tabsEl = h('div', { class: 'tabs' });

  const refreshHead = () => { moneyChip.replaceChildren(h('span', { html: icon('coin', 16) }), fmtMoney(st.money)); };
  const close = () => {
    if (cargoView) cargoView.destroy();
    sheet.remove();
    audio.close();
    game.closeModal();
    game.onLeaveTown(town);
  };

  const renderTabs = () => {
    tabsEl.replaceChildren(...tabsDef.map(([id, label, ic]) => h('button', {
      class: 'tab' + (tab === id ? ' on' : ''), html: icon(ic, 20) + `<span>${label}</span>`,
      onclick: () => { tab = id; game.lastTownTab = id; audio.tap(); render(); },
    })));
  };

  const render = () => {
    if (cargoView) { cargoView.destroy(); cargoView = null; }
    refreshHead();
    renderTabs();
    body.replaceChildren();
    body.scrollTop = 0;
    ({ market: renderMarket, yard: renderYard, harbour: renderHarbour, tavern: renderTavern, lantern: renderLantern })[tab]();
  };

  // ------------------------------------------------------------ MARKET
  function renderMarket() {
    const inv = st.inv;
    const info = h('div', { style: 'width:100%' });
    const btnSell = h('button', { class: 'btn good block', style: 'display:none' });
    const sellAllBtn = h('button', { class: 'btn primary block' });
    const sellable = (it) => !ITEMS[it.id].quest;
    const updateSellAll = () => {
      const list = inv.items.filter((i) => ['fish', 'crab', 'aberrant', 'trash'].includes(ITEMS[i.id].cat));
      const total = list.reduce((s, i) => s + game.priceFor(i, town.id), 0);
      sellAllBtn.replaceChildren(h('span', { html: icon('coin', 18) }), list.length ? `Sell all catch (${list.length}) for ${fmtMoney(total)}` : 'No catch to sell');
      sellAllBtn.classList.toggle('dis', !list.length);
    };
    const showSel = (it) => {
      if (!it) { info.replaceChildren(h('div', { class: 'itemcard' }, h('p', { style: 'align-self:center' }, 'Tap a piece in your hold to see what the market will pay.'))); btnSell.style.display = 'none'; return; }
      const price = game.priceFor(it, town.id);
      const boosted = town.boost.includes(it.id);
      info.replaceChildren(itemCard(it, { extra: h('p', { style: 'margin-top:4px' }, 'Offer: ', coin(price), boosted ? h('span', { class: 'tag new', style: 'margin-left:6px' }, 'In demand +40%') : null) }));
      if (!sellable(it)) { btnSell.style.display = 'none'; return; }
      btnSell.style.display = '';
      btnSell.replaceChildren(h('span', { html: icon('coin', 18) }), `Sell for ${fmtMoney(price)}`);
      btnSell.onclick = () => { game.sellItem(it.uid, town.id); cargoView.selected = null; cargoView.render(); showSel(null); refreshHead(); updateSellAll(); };
    };
    cargoView = new CargoView({ inv, mode: 'select', maxHeight: window.innerHeight * 0.34, onSelect: showSel, dim: (it) => !sellable(it) });
    sellAllBtn.onclick = () => { game.sellAll(town.id); cargoView.selected = null; cargoView.render(); showSel(null); refreshHead(); updateSellAll(); };
    const demand = town.boost.length
      ? h('div', { class: 'card' }, h('h3', {}, 'In demand here'), h('p', {}, town.boost.map((id) => ITEMS[id].name).join(' · ') + ' fetch 40% more.'))
      : null;
    body.append(h('div', { class: 'split' }, h('div', { class: 'l' }, cargoView.root), h('div', { class: 'r' }, info, btnSell, sellAllBtn, demand || '')));
    showSel(null); updateSellAll();
  }

  // ------------------------------------------------------------ SHIPYARD
  function renderYard() {
    const costs = game.repairCosts();
    const s = game.stats;
    const repairCard = h('div', { class: 'card' },
      h('h3', { html: icon('shield', 18) + ' Repairs' }),
      h('p', {}, `Hull ${st.hull}/${s.hullMax}${st.inv.broken.size ? ` · ${st.inv.broken.size} damaged cargo cell${st.inv.broken.size > 1 ? 's' : ''}` : ''}`),
      h('div', { class: 'meta' },
        h('button', { class: 'btn sm good' + (costs.hull ? '' : ' dis'), onclick: () => { game.repairHull(); render(); } }, costs.hull ? ['Repair hull ', coin(costs.hull, costs.hull > st.money)] : 'Hull sound'),
        h('button', { class: 'btn sm good' + (costs.cargo ? '' : ' dis'), onclick: () => { game.repairCargo(); render(); } }, costs.cargo ? ['Fix hold ', coin(costs.cargo, costs.cargo > st.money)] : 'Hold sound'),
      ));
    body.append(repairCard, h('div', { class: 'sec-title' }, 'Upgrades'));
    for (const key of UPGRADE_KEYS) {
      const U = UPGRADES[key];
      const curIdx = curIndex(key, st.up[key]);
      const next = U.levels[curIdx + 1];
      const cur = U.levels[curIdx];
      const dots = h('div', { class: 'lv' }, ...Array.from({ length: U.levels.length - 1 }, (_, i) => h('i', { class: i < curIdx ? 'on' : '' })));
      const card = h('div', { class: 'card' }, h('h3', {}, U.name, dots), h('p', {}, U.blurb));
      if (!next) { card.append(h('div', { class: 'meta' }, h('span', { class: 'tag new' }, 'Fully upgraded'), h('span', { style: 'font-size:12px;color:var(--dim)' }, U.fmt(cur)))); }
      else {
        const need = Object.entries(next.mats || {});
        const haveAll = need.every(([id, n]) => st.inv.count(id) >= n);
        const afford = st.money >= next.cost;
        card.append(
          h('div', { class: 'kv' }, h('span', {}, 'Now'), h('b', {}, U.fmt(cur))),
          h('div', { class: 'kv' }, h('span', {}, 'Next'), h('b', {}, U.fmt(next))),
          h('div', { style: 'margin-top:8px' }, need.map(([id, n]) => {
            const have = st.inv.count(id);
            return h('span', { class: 'mat ' + (have >= n ? 'ok' : 'no') }, `${n}× ${ITEMS[id].name} (${have})`);
          })),
          h('div', { class: 'meta' }, coin(next.cost, !afford),
            h('button', { class: 'btn sm primary' + (afford && haveAll ? '' : ' dis'), onclick: () => { if (game.buyUpgrade(key)) render(); } }, 'Upgrade')),
        );
      }
      body.append(card);
    }
  }

  // ------------------------------------------------------------ HARBOUR
  function renderHarbour() {
    // main quest
    if (town.id === 'saltmere') {
      const m = st.main;
      const have = m.have.filter(Boolean).length;
      const card = h('div', { class: 'card main' }, h('h3', { html: icon('star', 18) + ' ' + MAIN.title }));
      if (m.stage === 0) {
        card.append(h('p', {}, MAIN.intro), h('div', { class: 'meta' }, h('span', { class: 'tag q' }, 'Main story'), h('button', { class: 'btn sm primary', onclick: () => { game.acceptMain(); render(); } }, 'Take the charge')));
      } else if (m.stage < 5) {
        card.append(h('p', {}, `Lens fragments recovered: ${have}/4. Look for golden markers on your map.`), h('div', { class: 'bar' }, h('i', { style: `width:${have * 25}%;background:var(--accent)` })));
      } else if (!m.delivered) {
        card.append(h('p', {}, 'You have all four fragments. Carry them to the Hollow Light, far to the south-east.'));
      } else card.append(h('p', {}, 'The Hollow Light burns again. Marrin tips his cap whenever you pass.'));
      body.append(card);
    }
    // side quests for this town
    const qs = QUESTS.filter((q) => q.town === town.id);
    if (!qs.length && town.id !== 'saltmere') body.append(h('div', { class: 'empty' }, 'The harbourmaster has no work for you today.'));
    for (const q of qs) {
      const state = game.questState(q.id);
      const prog = game.questProgress(q);
      const complete = prog.every((p) => p.have >= p.need);
      const card = h('div', { class: 'card' + (state === 'done' ? ' done' : '') }, h('h3', {}, q.title, state === 'done' ? h('span', { class: 'tag new' }, 'Done') : null), h('p', {}, q.text));
      if (state !== 'done') {
        card.append(h('div', { style: 'margin-top:8px' }, prog.map((p) => h('span', { class: 'mat ' + (p.have >= p.need ? 'ok' : 'no') }, `${p.name} ${Math.min(p.have, p.need)}/${p.need}`))));
        const rewardTxt = h('span', {}, 'Reward: ', coin(q.reward.money), q.reward.upgrade ? h('span', { class: 'tag q', style: 'margin-left:6px' }, 'Free dredge net') : null);
        if (state === 'available') card.append(h('div', { class: 'meta' }, rewardTxt, h('button', { class: 'btn sm', onclick: () => { game.acceptQuest(q.id); render(); } }, 'Accept')));
        else card.append(h('div', { class: 'meta' }, rewardTxt, h('button', { class: 'btn sm good' + (complete ? '' : ' dis'), onclick: () => { game.deliverQuest(q.id); render(); } }, complete ? 'Deliver' : 'In progress')));
        if (q.hint && state !== 'done') card.append(h('p', { style: 'color:var(--accent)' }, q.hint));
      }
      body.append(card);
    }
    // ferry
    const dests = towns.filter((t) => t.id !== town.id && st.visited.includes(t.id));
    body.append(h('div', { class: 'sec-title' }, 'Ferry service'));
    if (!dests.length) body.append(h('div', { class: 'empty' }, 'Visit other towns by boat first - then the ferry can take you back.'));
    for (const d of dests) {
      const dist = Math.hypot(d.x - town.x, d.z - town.z);
      const cost = Math.round(dist * 0.1);
      body.append(h('div', { class: 'card' }, h('h3', {}, d.name), h('p', {}, `${zoneName(d.zone)} · ${(dist / 1000).toFixed(1)} km`),
        h('div', { class: 'meta' }, coin(cost, cost > st.money), h('button', { class: 'btn sm' + (st.money >= cost ? '' : ' dis'), html: icon('ferry', 16) + 'Sail there', onclick: () => { close(); game.ferryTo(d.id, cost); } }))));
    }
  }

  // ------------------------------------------------------------ TAVERN
  function renderTavern() {
    const night = st.hour >= 19 || st.hour < 5;
    body.append(
      h('div', { class: 'card' }, h('h3', { html: icon('moon', 18) + ' A bed for the night' }),
        h('p', {}, 'Sleep until dawn. The dread fades while you rest, and the fish are fresh in the morning.'),
        h('div', { class: 'meta' }, h('span', { class: 'tag' }, night ? 'It is late' : 'Sleep until 06:00'),
          h('button', { class: 'btn sm primary', onclick: () => { close(); game.rest(); } }, 'Rest'))),
      h('div', { class: 'card' }, h('h3', { html: icon('save', 18) + ' Save your voyage' }), h('p', {}, 'The game also saves automatically whenever you dock.'),
        h('div', { class: 'meta' }, h('span', {}), h('button', { class: 'btn sm', onclick: () => { game.saveGame(true); } }, 'Save now'))),
      h('div', { class: 'sec-title' }, 'Rumours'),
      ...game.rumours(town).map((r) => h('div', { class: 'card' }, h('p', { style: 'color:var(--text);font-style:italic' }, '“' + r + '”'))),
    );
  }

  // ------------------------------------------------------------ LANTERN (final)
  function renderLantern() {
    const m = st.main;
    const have = m.have.filter(Boolean).length;
    const card = h('div', { class: 'card main' }, h('h3', { html: icon('lamp', 18) + ' The Dead Lantern' }));
    if (m.delivered) card.append(h('p', {}, 'The lens blazes at the heart of the lantern. The Hollow Light is alive again.'));
    else if (m.stage < 1) card.append(h('p', {}, 'A cold lantern room, thick with a century of dust. Perhaps old Marrin in Saltmere knows its story.'));
    else if (have < 4) card.append(h('p', {}, `The lantern waits for its lens. You carry ${have} of 4 fragments. Keep dredging - the golden markers on your map show where they sank.`));
    else card.append(h('p', {}, 'Four shards hum in your hold, each in tune with the others. Set them in the lantern.'),
      h('div', { class: 'meta' }, h('span', {}), h('button', { class: 'btn primary', onclick: () => { close(); game.finishMain(); } }, 'Set the lens')));
    body.append(card);
    body.append(h('div', { class: 'card' }, h('p', {}, 'There are no shops at the Hollow Light - only wind, gulls and a very tall staircase.'),
      h('div', { class: 'meta' }, h('span', {}), h('button', { class: 'btn sm', onclick: () => { game.saveGame(true); } }, 'Save'))));
  }

  sheet.append(
    h('div', { class: 'sheet-head' },
      h('h1', {}, town.name, h('small', {}, `${zoneName(town.zone)} · ${town.blurb}`)),
      moneyChip,
      h('button', { class: 'xbtn', html: icon('anchor', 20), title: 'Set sail', onclick: close })),
    tabsEl, body);
  game.openModal(sheet, close);
  render();
  return { refresh: render };
}
void getTown; void thumbSvg;
