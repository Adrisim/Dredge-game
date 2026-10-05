// Fully procedural audio (no asset files): sea ambience, engine, wind, dread drone and sfx.
class AudioEngine {
  constructor() { this.ctx = null; this.enabled = true; this.ready = false; }

  unlock() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise();
      this.buildAmbience();
      this.ready = true;
    } catch { /* audio unavailable */ }
  }

  makeNoise() {
    const c = this.ctx, len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; }

  buildAmbience() {
    const c = this.ctx;
    // sea wash
    this.sea = c.createGain(); this.sea.gain.value = 0.18;
    const n1 = this.noiseSrc(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    n1.connect(lp).connect(this.sea).connect(this.master); n1.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.11;
    const lg = c.createGain(); lg.gain.value = 0.07; lfo.connect(lg).connect(this.sea.gain); lfo.start();
    // wind
    this.wind = c.createGain(); this.wind.gain.value = 0;
    const n2 = this.noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    n2.connect(bp).connect(this.wind).connect(this.master); n2.start();
    this.windBp = bp;
    // engine
    this.eng = c.createGain(); this.eng.gain.value = 0;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 46;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 23;
    const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 190;
    const eg = c.createGain(); eg.gain.value = 0.5;
    o1.connect(ef); o2.connect(eg).connect(ef); ef.connect(this.eng).connect(this.master);
    o1.start(); o2.start();
    this.engOsc = [o1, o2]; this.engFilter = ef;
    // dread drone
    this.dread = c.createGain(); this.dread.gain.value = 0;
    const d1 = c.createOscillator(); d1.frequency.value = 55; const d2 = c.createOscillator(); d2.frequency.value = 58.3;
    d1.type = d2.type = 'sine';
    d1.connect(this.dread); d2.connect(this.dread); this.dread.connect(this.master); d1.start(); d2.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  /** ctrl: {speed 0..1, night 0..1, dread 0..1, storm 0..1, muffled 0..1} */
  update(ctrl) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.eng.gain.setTargetAtTime(0.035 + ctrl.speed * 0.085, t, 0.15);
    this.engOsc[0].frequency.setTargetAtTime(44 + ctrl.speed * 30, t, 0.2);
    this.engOsc[1].frequency.setTargetAtTime(22 + ctrl.speed * 15, t, 0.2);
    this.engFilter.frequency.setTargetAtTime(150 + ctrl.speed * 160, t, 0.2);
    this.wind.gain.setTargetAtTime(0.02 + ctrl.speed * 0.05 + ctrl.storm * 0.14 + ctrl.night * 0.015, t, 0.4);
    this.windBp.frequency.setTargetAtTime(700 + ctrl.storm * 500, t, 0.5);
    this.dread.gain.setTargetAtTime(ctrl.dread * 0.11, t, 0.6);
    this.sea.gain.setTargetAtTime(0.16 + ctrl.storm * 0.12, t, 0.6);
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slideTo = null, delay = 0) {
    if (!this.ready || !this.enabled) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  burst(freq = 1200, dur = 0.25, vol = 0.25, q = 0.8, type = 'bandpass') {
    if (!this.ready || !this.enabled) return;
    const c = this.ctx, t0 = c.currentTime;
    const s = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t0); s.stop(t0 + dur + 0.05);
  }

  // ---- named sfx
  tap() { this.tone(560, 0.05, 'triangle', 0.12); }
  open() { this.tone(420, 0.07, 'triangle', 0.12); this.tone(640, 0.09, 'triangle', 0.1, null, 0.05); }
  close() { this.tone(560, 0.06, 'triangle', 0.1); this.tone(380, 0.08, 'triangle', 0.1, null, 0.05); }
  splash() { this.burst(1500, 0.35, 0.3, 0.7); this.tone(180, 0.2, 'sine', 0.1, 80); }
  cast() { this.burst(2600, 0.18, 0.12, 1.2, 'highpass'); this.splash(); }
  bite() { this.tone(880, 0.1, 'square', 0.1); this.tone(1175, 0.14, 'square', 0.1, null, 0.09); }
  hit() { this.tone(660, 0.1, 'triangle', 0.2, 990); }
  perfect() { this.tone(784, 0.09, 'triangle', 0.2); this.tone(1175, 0.16, 'triangle', 0.2, null, 0.07); this.tone(1568, 0.2, 'sine', 0.12, null, 0.14); }
  miss() { this.tone(220, 0.22, 'sawtooth', 0.14, 110); }
  catchFish() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.18, null, i * 0.08)); }
  escape() { this.tone(330, 0.35, 'sawtooth', 0.14, 90); }
  bump() { this.tone(110, 0.28, 'sine', 0.4, 38); this.burst(260, 0.3, 0.35, 0.7, 'lowpass'); }
  scrape() { this.burst(900, 0.18, 0.1, 1.2); }
  coin() { this.tone(1318, 0.07, 'square', 0.08); this.tone(1760, 0.18, 'square', 0.08, null, 0.06); }
  place() { this.tone(300, 0.07, 'triangle', 0.16, 240); }
  nope() { this.tone(180, 0.12, 'square', 0.1, 140); }
  bell() { [880, 1320, 1760].forEach((f, i) => this.tone(f, 1.6, 'sine', 0.09 / (i + 1))); }
  whisper() { this.burst(2400, 0.9, 0.06, 4); this.tone(98, 0.8, 'sine', 0.06, 70); }
  dredge() { this.burst(300, 0.4, 0.2, 0.8, 'lowpass'); }
  horn() { this.tone(110, 0.9, 'sawtooth', 0.14, 100); this.tone(165, 0.9, 'sawtooth', 0.08, 150); }
  fanfare() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.18, null, i * 0.16)); }
}

export const audio = new AudioEngine();
