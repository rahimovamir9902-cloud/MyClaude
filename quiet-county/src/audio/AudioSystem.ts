import { createLogger } from '../core/Logger';
import { clamp, clamp01 } from '../core/math';

const log = createLogger('Audio');

export type SoundId =
  | 'footstep' | 'gunshot' | 'dryfire' | 'reload' | 'reloadDone' | 'swing' | 'hitFlesh' | 'hitMetal'
  | 'impact' | 'glass' | 'groan' | 'alert' | 'attack' | 'hurt' | 'infectedDeath' | 'doorOpen' | 'doorBash'
  | 'pry' | 'pickup' | 'search' | 'click' | 'uiOpen' | 'objective' | 'radio' | 'takedown' | 'heal'
  | 'flashlight' | 'vault' | 'throw' | 'heartbeat' | 'engine' | 'save' | 'death' | 'eat';

export interface PlayOptions {
  x?: number;
  z?: number;
  volume?: number;
  pitch?: number;
  variant?: string;
  maxDistance?: number;
}

interface Loop {
  x: number;
  z: number;
  gain: GainNode;
  pan: StereoPannerNode | null;
  maxDistance: number;
  volume: number;
  stop(): void;
  endsAt: number;
}

/**
 * Procedural audio: every sound is synthesized with WebAudio at runtime (no audio assets).
 * Sounds are spatialized relative to the camera with distance attenuation and stereo pan,
 * so players can locate infected and alarms by ear.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private uiBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private brownBuf!: AudioBuffer;
  private shaper!: WaveShaperNode;
  private listener = { x: 0, z: 0, yaw: 0 };
  private voices = 0;
  private readonly loops = new Set<Loop>();
  private ambience: { wind: GainNode; windFilter: BiquadFilterNode; rain: GainNode; drone: GainNode } | null = null;
  private nextCricket = 0;
  private nextMoan = 4;
  private nextCreak = 9;
  private volumes = { master: 0.9, sfx: 1, ambience: 0.8 };
  enabled = true;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get activeVoices(): number {
    return this.voices;
  }

  /** Must be called from a user gesture on mobile browsers. */
  async unlock(): Promise<void> {
    try {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
    } catch (err) {
      log.warn('Audio unavailable', err);
      this.enabled = false;
    }
  }

  private init(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      this.enabled = false;
      return;
    }
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.uiBus = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.uiBus.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const white = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) white[i] = Math.random() * 2 - 1;
    this.brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      brown[i] = last * 3.5;
    }
    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    this.shaper.curve = curve;
    log.info(`Audio ready (${ctx.sampleRate} Hz)`);
  }

  setVolumes(master: number, sfx: number, ambience: number): void {
    this.volumes = { master, sfx, ambience };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfx.gain.value = this.volumes.sfx;
    this.amb.gain.value = this.volumes.ambience;
    this.uiBus.gain.value = 0.7;
  }

  setListener(x: number, z: number, yaw: number): void {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    if (this.ctx && this.enabled) void this.ctx.resume();
  }

  private spatial(x: number | undefined, z: number | undefined, maxD: number): { gain: number; pan: number } {
    if (x === undefined || z === undefined) return { gain: 1, pan: 0 };
    const dx = x - this.listener.x;
    const dz = z - this.listener.z;
    const d = Math.hypot(dx, dz);
    if (d >= maxD) return { gain: 0, pan: 0 };
    const gain = (1 / (1 + Math.pow(d / 7, 1.4))) * Math.sqrt(1 - d / maxD);
    const rx = Math.cos(this.listener.yaw);
    const rz = -Math.sin(this.listener.yaw);
    const pan = d > 0.01 ? clamp(((dx * rx + dz * rz) / d) * Math.min(1, d / 2), -1, 1) : 0;
    return { gain, pan };
  }

  /** Creates the per-voice output (gain -> pan -> bus). Returns null when culled. */
  private voice(bus: GainNode, opts: PlayOptions, base: number, maxDefault: number): { out: GainNode; t: number } | null {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return null;
    const sp = this.spatial(opts.x, opts.z, opts.maxDistance ?? maxDefault);
    const g = sp.gain * (opts.volume ?? 1) * base;
    if (g < 0.003) return null;
    if (this.voices > 30 && g < 0.15) return null;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = g;
    if (ctx.createStereoPanner && opts.x !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = sp.pan;
      out.connect(p).connect(bus);
    } else {
      out.connect(bus);
    }
    this.voices++;
    return { out, t: ctx.currentTime + 0.005 };
  }

  private release(node: AudioScheduledSourceNode): void {
    node.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
    };
  }

  // ---- synthesis primitives --------------------------------------------------------

  private noise(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.002, freqEnd?: number, brown = false): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = brown ? this.brownBuf : this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  private tone(dest: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, peak: number, attack = 0.005): OscillatorNode {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  /** Vocal-ish sound: buzzy source through two formant filters. */
  private voiceLike(dest: AudioNode, t: number, dur: number, f0: number, f1: number, formants: [number, number], peak: number, rough = 0.3): OscillatorNode {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f1, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4 + Math.random() * 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f0 * 0.06;
    lfo.connect(lfoGain).connect(osc.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + dur * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [i, fq] of formants.entries()) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fq;
      f.Q.value = 5;
      const fg = ctx.createGain();
      fg.gain.value = i === 0 ? 1 : 0.55;
      osc.connect(f).connect(fg).connect(env);
    }
    if (rough > 0) {
      const n = this.noise(env, t, dur, 'bandpass', formants[0] * 1.5, 1, peak * rough, dur * 0.2);
      void n;
    }
    env.connect(dest);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    return osc;
  }

  // ---- public API ------------------------------------------------------------------

  play(id: SoundId, opts: PlayOptions = {}): void {
    if (!this.ctx || !this.enabled) return;
    const p = opts.pitch ?? 1;
    let v: { out: GainNode; t: number } | null;
    let last: AudioScheduledSourceNode | null = null;
    switch (id) {
      case 'footstep': {
        v = this.voice(this.sfx, opts, 0.5, 25);
        if (!v) return;
        const s = opts.variant ?? 'asphalt';
        if (s === 'grass') last = this.noise(v.out, v.t, 0.11, 'highpass', 2200 * p, 0.7, 0.35, 0.01);
        else if (s === 'gravel' || s === 'dirt') {
          this.noise(v.out, v.t, 0.06, 'bandpass', 2800 * p, 0.8, 0.5);
          last = this.noise(v.out, v.t + 0.03, 0.07, 'bandpass', 3600 * p, 0.8, 0.35);
        } else if (s === 'floor' || s === 'wood') last = this.noise(v.out, v.t, 0.07, 'lowpass', 1100 * p, 0.8, 0.7);
        else if (s === 'metal') {
          this.noise(v.out, v.t, 0.06, 'bandpass', 1400 * p, 2, 0.6);
          last = this.tone(v.out, v.t, 0.12, 'triangle', 420 * p, 380 * p, 0.12);
        } else last = this.noise(v.out, v.t, 0.06, 'bandpass', 1700 * p, 1.1, 0.6);
        break;
      }
      case 'gunshot': {
        v = this.voice(this.sfx, opts, 1, 140);
        if (!v) return;
        this.noise(v.out, v.t, 0.22, 'lowpass', 5200 * p, 0.7, 1.2, 0.001, 900);
        this.tone(v.out, v.t, 0.2, 'sine', 150 * p, 38, 1.0, 0.002);
        last = this.noise(v.out, v.t + 0.04, 1.1, 'lowpass', 900 * p, 0.5, 0.22, 0.02, 300, true);
        break;
      }
      case 'dryfire':
        v = this.voice(this.sfx, opts, 0.5, 15);
        if (!v) return;
        last = this.tone(v.out, v.t, 0.025, 'square', 2600, 2000, 0.3, 0.001);
        break;
      case 'reload':
        v = this.voice(this.sfx, opts, 0.45, 15);
        if (!v) return;
        this.tone(v.out, v.t, 0.03, 'square', 1800, 1500, 0.3, 0.001);
        last = this.noise(v.out, v.t + 0.05, 0.08, 'bandpass', 2400, 1.5, 0.3);
        break;
      case 'reloadDone':
        v = this.voice(this.sfx, opts, 0.5, 15);
        if (!v) return;
        this.noise(v.out, v.t, 0.06, 'bandpass', 2000, 1.2, 0.5);
        last = this.tone(v.out, v.t + 0.07, 0.03, 'square', 2200, 1900, 0.35, 0.001);
        break;
      case 'swing':
        v = this.voice(this.sfx, opts, 0.35, 15);
        if (!v) return;
        last = this.noise(v.out, v.t, 0.2, 'bandpass', 500 * p, 1.4, 0.6, 0.06, 2600 * p);
        break;
      case 'hitFlesh':
        v = this.voice(this.sfx, opts, 0.75, 30);
        if (!v) return;
        this.tone(v.out, v.t, 0.14, 'sine', 110 * p, 48, 0.9, 0.002);
        last = this.noise(v.out, v.t, 0.1, 'lowpass', 800 * p, 0.8, 0.6);
        break;
      case 'hitMetal':
        v = this.voice(this.sfx, opts, 0.5, 35);
        if (!v) return;
        for (const f of [523, 1170, 2013]) last = this.tone(v.out, v.t, 0.5, 'sine', f * p, f * p * 0.98, 0.25, 0.002);
        this.noise(v.out, v.t, 0.04, 'highpass', 3000, 0.7, 0.4);
        break;
      case 'impact':
        v = this.voice(this.sfx, opts, 0.4, 30);
        if (!v) return;
        this.noise(v.out, v.t, 0.06, 'bandpass', 2600 * p, 1, 0.6);
        last = this.tone(v.out, v.t, 0.05, 'triangle', 900 * p, 500, 0.15);
        break;
      case 'glass':
        v = this.voice(this.sfx, opts, 0.7, 45);
        if (!v) return;
        for (let i = 0; i < 6; i++) {
          const dt = Math.random() * 0.25;
          this.noise(v.out, v.t + dt, 0.08, 'bandpass', 4000 + Math.random() * 3000, 3, 0.4);
          last = this.tone(v.out, v.t + dt, 0.15, 'sine', 3000 + Math.random() * 3000, 2500, 0.08);
        }
        break;
      case 'groan': {
        v = this.voice(this.sfx, opts, 0.5, 35);
        if (!v) return;
        const f = (70 + Math.random() * 35) * p;
        last = this.voiceLike(v.out, v.t, 1.0 + Math.random() * 0.8, f, f * 0.82, [520 + Math.random() * 180, 1150 + Math.random() * 200], 0.5, 0.4);
        break;
      }
      case 'alert': {
        v = this.voice(this.sfx, opts, 0.75, 55);
        if (!v) return;
        // Rasp: the scream runs through a soft-clipping shaper.
        const f = (190 + Math.random() * 60) * p;
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.shaper.curve;
        shaper.connect(v.out);
        last = this.voiceLike(shaper, v.t, 0.95, f, f * 1.5, [800, 1900], 0.7, 0.7);
        break;
      }
      case 'attack':
        v = this.voice(this.sfx, opts, 0.6, 25);
        if (!v) return;
        last = this.voiceLike(v.out, v.t, 0.45, 150 * p, 110 * p, [700, 1500], 0.6, 0.9);
        break;
      case 'infectedDeath':
        v = this.voice(this.sfx, opts, 0.5, 30);
        if (!v) return;
        last = this.voiceLike(v.out, v.t, 1.1, 120 * p, 55 * p, [480, 1000], 0.45, 0.5);
        break;
      case 'hurt':
        v = this.voice(this.sfx, opts, 0.6, 15);
        if (!v) return;
        this.noise(v.out, v.t, 0.18, 'lowpass', 1200, 0.8, 0.5, 0.01);
        last = this.voiceLike(v.out, v.t, 0.25, 190, 140, [600, 1300], 0.35, 0.2);
        break;
      case 'death':
        v = this.voice(this.sfx, opts, 0.6, 15);
        if (!v) return;
        last = this.voiceLike(v.out, v.t, 1.2, 170, 90, [550, 1200], 0.4, 0.3);
        break;
      case 'doorOpen':
        v = this.voice(this.sfx, opts, 0.45, 30);
        if (!v) return;
        this.tone(v.out, v.t, 0.03, 'square', 1500, 1200, 0.2, 0.001);
        last = this.noise(v.out, v.t + 0.03, 0.55, 'bandpass', 900 * p, 9, 0.6, 0.08, 1400 * p);
        break;
      case 'doorBash':
        v = this.voice(this.sfx, opts, 0.8, 40);
        if (!v) return;
        this.tone(v.out, v.t, 0.18, 'sine', 80, 45, 1.0, 0.002);
        last = this.noise(v.out, v.t, 0.25, 'lowpass', 500, 0.8, 0.8);
        break;
      case 'pry':
        v = this.voice(this.sfx, opts, 0.6, 35);
        if (!v) return;
        this.noise(v.out, v.t, 1.6, 'bandpass', 1500, 5, 0.35, 0.3);
        for (const f of [610, 1430]) this.tone(v.out, v.t + 1.5, 0.4, 'sine', f, f * 0.97, 0.3, 0.002);
        last = this.noise(v.out, v.t + 1.5, 0.15, 'highpass', 2000, 0.7, 0.8);
        break;
      case 'pickup':
        v = this.voice(this.uiBus, opts, 0.5, 15);
        if (!v) return;
        this.noise(v.out, v.t, 0.08, 'bandpass', 3000, 1, 0.3);
        last = this.tone(v.out, v.t + 0.05, 0.04, 'triangle', 1500, 1300, 0.12);
        break;
      case 'search':
        v = this.voice(this.sfx, opts, 0.35, 15);
        if (!v) return;
        for (let i = 0; i < 4; i++) last = this.noise(v.out, v.t + i * 0.12, 0.12, 'bandpass', 2000 + Math.random() * 1500, 1, 0.35, 0.02);
        break;
      case 'click':
        v = this.voice(this.uiBus, opts, 0.3, 10);
        if (!v) return;
        last = this.tone(v.out, v.t, 0.03, 'sine', 1500, 1200, 0.4, 0.001);
        break;
      case 'uiOpen':
        v = this.voice(this.uiBus, opts, 0.25, 10);
        if (!v) return;
        last = this.noise(v.out, v.t, 0.15, 'bandpass', 800, 1, 0.3, 0.04, 2000);
        break;
      case 'objective':
        v = this.voice(this.uiBus, opts, 0.3, 10);
        if (!v) return;
        this.tone(v.out, v.t, 0.5, 'sine', 587, 587, 0.35, 0.01);
        last = this.tone(v.out, v.t + 0.14, 0.7, 'sine', 880, 880, 0.3, 0.01);
        break;
      case 'radio':
        v = this.voice(this.uiBus, opts, 0.35, 10);
        if (!v) return;
        this.noise(v.out, v.t, 0.35, 'bandpass', 1800, 0.6, 0.5, 0.01);
        last = this.tone(v.out, v.t + 0.3, 0.06, 'square', 1200, 1200, 0.15);
        break;
      case 'save':
        v = this.voice(this.uiBus, opts, 0.3, 10);
        if (!v) return;
        this.noise(v.out, v.t, 0.2, 'bandpass', 1800, 0.6, 0.3, 0.01);
        last = this.tone(v.out, v.t + 0.18, 0.4, 'sine', 523, 523, 0.25);
        break;
      case 'takedown':
        v = this.voice(this.sfx, opts, 0.55, 15);
        if (!v) return;
        this.tone(v.out, v.t + 0.25, 0.15, 'sine', 90, 40, 0.7, 0.002);
        last = this.noise(v.out, v.t + 0.25, 0.12, 'lowpass', 600, 0.8, 0.5);
        break;
      case 'heal':
      case 'eat':
        v = this.voice(this.sfx, opts, 0.35, 10);
        if (!v) return;
        this.noise(v.out, v.t, 0.25, 'bandpass', 2500, 1, 0.3, 0.03);
        last = this.noise(v.out, v.t + 0.3, 0.12, 'highpass', 3500, 0.7, 0.3);
        break;
      case 'flashlight':
        v = this.voice(this.sfx, opts, 0.35, 10);
        if (!v) return;
        last = this.tone(v.out, v.t, 0.015, 'square', 3200, 3000, 0.4, 0.001);
        break;
      case 'vault':
        v = this.voice(this.sfx, opts, 0.4, 20);
        if (!v) return;
        this.noise(v.out, v.t, 0.25, 'bandpass', 700, 1, 0.4, 0.05, 1800);
        last = this.tone(v.out, v.t + 0.45, 0.12, 'sine', 90, 50, 0.5);
        break;
      case 'throw':
        v = this.voice(this.sfx, opts, 0.35, 15);
        if (!v) return;
        last = this.noise(v.out, v.t, 0.25, 'bandpass', 900, 1.2, 0.5, 0.05, 2400);
        break;
      case 'heartbeat':
        v = this.voice(this.uiBus, opts, 0.5, 10);
        if (!v) return;
        this.tone(v.out, v.t, 0.12, 'sine', 62, 45, 0.9, 0.005);
        last = this.tone(v.out, v.t + 0.2, 0.12, 'sine', 58, 42, 0.7, 0.005);
        break;
      case 'engine':
        v = this.voice(this.sfx, opts, 0.6, 40);
        if (!v) return;
        this.noise(v.out, v.t, 2.2, 'lowpass', 180, 1, 0.6, 0.3, 320, true);
        last = this.tone(v.out, v.t, 2.2, 'sawtooth', 38, 55, 0.25, 0.4);
        break;
    }
    if (last) this.release(last);
  }

  /** Looping positional alarm (car alarm or siren) for `seconds`. */
  startAlarm(kind: 'car' | 'siren', x: number, z: number, seconds: number): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = kind === 'car' ? 'square' : 'sawtooth';
    const base = kind === 'car' ? 950 : 780;
    osc.frequency.value = base;
    const lfo = ctx.createOscillator();
    lfo.type = kind === 'car' ? 'square' : 'sine';
    lfo.frequency.value = kind === 'car' ? 2.2 : 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = kind === 'car' ? 320 : 360;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let pan: StereoPannerNode | null = null;
    osc.connect(filter).connect(gain);
    if (ctx.createStereoPanner) {
      pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.sfx);
    } else gain.connect(this.sfx);
    osc.start(t);
    lfo.start(t);
    const loop: Loop = {
      x, z, gain, pan, maxDistance: 110, volume: 0.28, endsAt: t + seconds,
      stop: () => {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      },
    };
    this.loops.add(loop);
  }

  stopAllLoops(): void {
    for (const l of this.loops) l.stop();
    this.loops.clear();
  }

  // ---- ambience --------------------------------------------------------------------

  startAmbience(): void {
    if (!this.ctx || this.ambience || !this.enabled) return;
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this.brownBuf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.22;
    wind.connect(windFilter).connect(windGain).connect(this.amb);
    wind.start();

    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuf;
    rainSrc.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainSrc.connect(hp).connect(lp).connect(rainGain).connect(this.amb);
    rainSrc.start();

    // Low tension drone that swells when infected are hunting the player.
    const drone = ctx.createGain();
    drone.gain.value = 0;
    for (const f of [55, 82.4, 110.7]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = f === 55 ? 0.5 : 0.25;
      o.connect(og).connect(drone);
      o.start();
    }
    drone.connect(this.amb);
    this.ambience = { wind: windGain, windFilter, rain: rainGain, drone };
  }

  /** Per-frame: ambience mix, random environmental sounds, alarm loop spatialization. */
  update(dt: number, env: { darkness: number; rain: number; tension: number; time: number }): void {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (this.ambience) {
      const a = this.ambience;
      a.windFilter.frequency.value = 380 + Math.sin(env.time * 0.09) * 180 + Math.sin(env.time * 0.23) * 60;
      a.wind.gain.value = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(env.time * 0.05)) + env.rain * 0.05;
      a.rain.gain.value += (env.rain * 0.22 - a.rain.gain.value) * Math.min(1, dt * 2);
      a.drone.gain.value += (clamp01(env.tension) * 0.07 - a.drone.gain.value) * Math.min(1, dt * 1.5);

      this.nextCricket -= dt;
      if (this.nextCricket <= 0) {
        this.nextCricket = 0.4 + Math.random() * 1.6;
        if (env.darkness > 0.4 && env.rain < 0.3) this.cricket(env.darkness);
      }
      this.nextMoan -= dt;
      if (this.nextMoan <= 0) {
        this.nextMoan = 9 + Math.random() * 14;
        this.distant('groan');
      }
      this.nextCreak -= dt;
      if (this.nextCreak <= 0) {
        this.nextCreak = 14 + Math.random() * 20;
        this.distant('creak');
      }
    }
    for (const loop of this.loops) {
      if (now >= loop.endsAt) {
        loop.stop();
        this.loops.delete(loop);
        continue;
      }
      const sp = this.spatial(loop.x, loop.z, loop.maxDistance);
      loop.gain.gain.value = sp.gain * loop.volume;
      if (loop.pan) loop.pan.pan.value = sp.pan;
    }
  }

  private cricket(darkness: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.025 * darkness;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 2 - 1;
      out.connect(p).connect(this.amb);
    } else out.connect(this.amb);
    const f = 4200 + Math.random() * 700;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(out, t + i * 0.05, 0.03, 'sine', f, f, 0.6, 0.004);
  }

  private distant(kind: 'groan' | 'creak'): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = kind === 'groan' ? 0.07 : 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    out.connect(lp);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 2 - 1;
      lp.connect(p).connect(this.amb);
    } else lp.connect(this.amb);
    if (kind === 'groan') {
      const f = 60 + Math.random() * 30;
      this.voiceLike(out, t, 1.6, f, f * 0.8, [450, 1000], 0.6, 0.3);
    } else {
      this.noise(out, t, 0.9, 'bandpass', 700 + Math.random() * 300, 10, 0.8, 0.2, 500);
    }
  }

  dispose(): void {
    this.stopAllLoops();
    void this.ctx?.close();
    this.ctx = null;
    this.ambience = null;
  }
}
