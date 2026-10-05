import { angleDiff } from '../util/math.js';

const D2R = Math.PI / 180;
const norm = (a) => ((a % 360) + 360) % 360;
const adiff = (a, b) => Math.abs(angleDiff(a * D2R, b * D2R)) / D2R;

/** Pure logic for the rotating-dial reeling minigame. Angles are degrees, 0 = top, clockwise. */
export class FishingGame {
  constructor(fight, stats) {
    this.need = fight.hits;
    this.zoneW = Math.min(150, fight.zone * stats.rodZone);
    this.baseZoneW = this.zoneW;
    this.speed = fight.speed * stats.rodSpeed;
    this.sp = fight.sp || null;
    if (this.sp === 'fast') this.speed *= 1.3;
    this.strainMax = stats.strainMax;
    this.angle = Math.random() * 360;
    this.dir = 1;
    this.hits = 0; this.strain = 0; this.done = null;
    this.idle = 0;
    this.decoy = null;
    this.placeZone();
    if (this.sp === 'decoy') this.placeDecoy();
  }

  get decoyW() { return Math.max(26, this.zoneW * 0.9); }
  get perfectW() { return this.zoneW * 0.34; }

  placeZone() {
    this.zc = norm(this.angle + this.dir * (95 + Math.random() * 140));
    this.dartDone = false;
  }

  placeDecoy() {
    for (let i = 0; i < 20; i++) {
      const c = norm(this.zc + 120 + Math.random() * 120);
      if (adiff(c, this.zc) > this.zoneW / 2 + this.decoyW / 2 + 25) { this.decoy = c; return; }
    }
    this.decoy = norm(this.zc + 180);
  }

  update(dt) {
    if (this.done) return;
    this.angle = norm(this.angle + this.dir * this.speed * dt);
    // darting fish: the zone leaps away when the needle gets close
    if (this.sp === 'dart' && !this.dartDone) {
      const ahead = angleDiff(this.angle * D2R, this.zc * D2R) / D2R * this.dir; // >0 when zone is ahead
      if (ahead > 0 && ahead < 38) {
        this.zc = norm(this.zc + (Math.random() < 0.5 ? 1 : -1) * (110 + Math.random() * 60));
        this.dartDone = true; this.darted = true;
      }
    }
    this.idle += dt;
    if (this.idle > 10) { this.idle = 0; this.strain++; this.afk = true; if (this.strain >= this.strainMax) this.done = 'lost'; }
  }

  /** @returns 'perfect' | 'hit' | 'miss' | 'decoy' */
  tap() {
    if (this.done) return null;
    this.idle = 0;
    const tol = 5;
    if (this.decoy !== null && adiff(this.angle, this.decoy) <= this.decoyW / 2) {
      return this.fail('decoy');
    }
    const d = adiff(this.angle, this.zc);
    if (d <= this.zoneW / 2 + tol) {
      const perfect = d <= this.perfectW / 2;
      this.hits = Math.min(this.need, this.hits + (perfect ? 2 : 1));
      this.speed *= 1.045;
      if (this.sp === 'shrink') this.zoneW = Math.max(18, this.zoneW * 0.84);
      if (this.sp === 'reverse') this.dir *= -1;
      if (this.hits >= this.need) { this.done = 'caught'; return perfect ? 'perfect' : 'hit'; }
      this.placeZone();
      if (this.sp === 'decoy') this.placeDecoy();
      return perfect ? 'perfect' : 'hit';
    }
    return this.fail('miss');
  }

  fail(kind) {
    this.strain++;
    if (this.strain >= this.strainMax) this.done = 'lost';
    return kind;
  }
}
