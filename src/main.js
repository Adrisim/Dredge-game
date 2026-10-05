import { Game } from './game/game.js';

const game = new Game();
import { towns } from './world/worldgen.js';
window.__towns = towns;
window.__game = game; // handy for debugging / automated tests

// Mobile hardening: no context menu, no page zoom/scroll gestures, keep the screen awake while playing.
document.addEventListener('contextmenu', (e) => e.preventDefault());
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.sheet-body, .modal .box, .tabs')) e.preventDefault(); }, { passive: false });
let lock = null;
const keepAwake = async () => { try { if ('wakeLock' in navigator && !document.hidden) lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ } };
document.addEventListener('visibilitychange', keepAwake);
window.addEventListener('pointerdown', keepAwake, { once: true });
void lock;
