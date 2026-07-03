// All sound is synthesized with WebAudio — zero audio assets. The palette is
// wafu: filtered-noise whooshes, a taiko-like thump on slices, a plucked
// string for combos, a deep rumble for the bomb and a temple bell at the end.

const MUTE_KEY = "ink-slash:muted";

// Private-browsing modes can throw on ANY localStorage touch — even the
// typeof check. Audio preferences are best-effort.
function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastWhooshAt = 0;
  muted: boolean;

  constructor(private readonly storage: Storage | null = safeStorage()) {
    try {
      this.muted = this.storage?.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  // Must be called from a user gesture at least once (autoplay policy).
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      this.storage?.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      // best-effort persistence only
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  // Blade wind: a short band-passed noise burst, brighter when faster.
  whoosh(speed: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    if (now - this.lastWhooshAt < 0.09) return; // throttle
    this.lastWhooshAt = now;

    const dur = 0.14;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.min(2400, speed * 0.8);
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + dur);
  }

  // Slice hit: taiko-ish — a pitched sine drop plus a noise snap. Combo depth
  // raises the drum pitch slightly so chains feel ascending.
  slice(combo: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    const base = 150 + Math.min(6, combo) * 14;
    osc.frequency.setValueAtTime(base * 2.2, now);
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.09);
    og.gain.setValueAtTime(0.5, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(og).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);

    const snap = ctx.createBufferSource();
    snap.buffer = this.noiseBuffer(0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.18, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    snap.connect(hp).connect(sg).connect(this.master);
    snap.start(now);
  }

  // Combo reward: a plucked-string chime (simple Karplus-Strong).
  pluck(combo: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const freq = 392 * Math.pow(1.122, Math.min(8, combo)); // rising pentatonic-ish
    const dur = 0.8;
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(rate * dur), rate);
    const data = buf.getChannelData(0);
    const period = Math.max(2, Math.floor(rate / freq));
    for (let i = 0; i < period; i += 1) data[i] = Math.random() * 2 - 1;
    for (let i = period; i < data.length; i += 1) {
      data[i] = (data[i - period] + data[i - period + 1]) * 0.497;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.34;
    src.connect(g).connect(this.master);
    src.start();
  }

  // Bomb: sub thump + long dark rumble.
  bomb(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.5);
    og.gain.setValueAtTime(0.9, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(og).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.9);

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer(1.1);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.5, now);
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    rumble.connect(lp).connect(rg).connect(this.master);
    rumble.start(now);
  }

  // Game-over temple bell: two detuned sines with a slow decay.
  bell(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    for (const [freq, gain] of [
      [523.25, 0.3],
      [659.9, 0.12]
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 2.4);
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
