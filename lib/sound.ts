/**
 * Tiny Web Audio synth. Off by default; the nav toggle turns it on
 * (inside a user gesture, so the AudioContext is allowed to start).
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
const listeners = new Set<(on: boolean) => void>();

let noiseBuf: AudioBuffer | null = null;

export const isSoundOn = () => enabled;

export function onSound(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setSound(on: boolean) {
  enabled = on;
  if (on) {
    if (!ac) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    void ac.resume();
  } else {
    engineStop("fade");
  }
  listeners.forEach((l) => l(on));
}

/* ---------- charging: a generator spinning up, following the gauge needle ---------- */

/** scale marks on the voltmeter; the needle ticks as it passes each one */
export const GAUGE_MARKS = [2, 5, 10, 25, 50, 100];
/** where the red arc starts */
export const RED_ZONE = 50;
const BUZZ_HZ = 8;

type Engine = {
  saws: OscillatorNode[];
  filter: BiquadFilterNode;
  motor: GainNode;
  whistle: OscillatorNode;
  whistleGain: GainNode;
  oscs: OscillatorNode[];
  buzzGain: GainNode;
  lfoStart: number;
  ticks: number;
};
let eng: Engine | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0..1 needle position, same log scale as the gauge */
const gauge = (m: number) => clamp01(Math.log(m) / Math.log(100));

function buildEngine(a: AudioContext, out: GainNode, m: number): Engine {
  const t = a.currentTime;

  // motor: two detuned saws through a resonant lowpass
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 140;
  filter.Q.value = 4;
  const motor = a.createGain();
  motor.gain.value = 0;
  filter.connect(motor).connect(out);
  const saws = [-9, 9].map((detune) => {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 18; // spins up from here
    o.detune.value = detune;
    o.connect(filter);
    return o;
  });

  // turbo whistle
  const whistle = a.createOscillator();
  whistle.type = "sine";
  whistle.frequency.value = 1100;
  const whistleGain = a.createGain();
  whistleGain.gain.value = 0;
  whistle.connect(whistleGain).connect(out);

  // red-zone warning buzz: square wave with an 8 Hz tremolo
  const buzz = a.createOscillator();
  buzz.type = "square";
  buzz.frequency.value = 96;
  const buzzTone = a.createBiquadFilter();
  buzzTone.type = "lowpass";
  buzzTone.frequency.value = 1700;
  const trem = a.createGain();
  trem.gain.value = 0.5;
  const lfo = a.createOscillator();
  lfo.frequency.value = BUZZ_HZ;
  const depth = a.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(trem.gain);
  const buzzGain = a.createGain();
  buzzGain.gain.value = 0;
  buzz.connect(buzzTone).connect(trem).connect(buzzGain).connect(out);

  const oscs = [...saws, whistle, buzz, lfo];
  oscs.forEach((o) => o.start(t));
  return {
    saws,
    filter,
    motor,
    whistle,
    whistleGain,
    oscs,
    buzzGain,
    lfoStart: t,
    ticks: GAUGE_MARKS.filter((x) => m >= x).length,
  };
}

/** call every frame while charging, with the current multiplier */
export function engine(m: number) {
  if (!enabled || !ac || !master) return;
  eng ??= buildEngine(ac, master, m);
  const t = ac.currentTime;
  const g = gauge(m);

  // low rumble at 1x → aggressive turbine at 100x
  const f = 34 * Math.pow(2, g * 3.4);
  eng.saws.forEach((o) => o.frequency.setTargetAtTime(f, t, 0.06));
  eng.filter.frequency.setTargetAtTime(160 * Math.pow(2, g * 5.4), t, 0.06);
  eng.filter.Q.setTargetAtTime(4 + g * 7, t, 0.1);
  eng.motor.gain.setTargetAtTime(0.06 + g * 0.08, t, 0.08);

  // turbo whistle after 10x, climbing above the motor
  const w = clamp01((Math.log(m) - Math.log(10)) / (Math.log(100) - Math.log(10)));
  eng.whistle.frequency.setTargetAtTime(1100 * Math.pow(2, w * 1.5), t, 0.08);
  eng.whistleGain.gain.setTargetAtTime(w * 0.04, t, 0.1);

  // needle ticks on each scale mark
  while (eng.ticks < GAUGE_MARKS.length && m >= GAUGE_MARKS[eng.ticks]) tick(eng.ticks++);

  // red zone: pulsing buzz + electric crackle
  const red = m >= RED_ZONE;
  eng.buzzGain.gain.setTargetAtTime(red ? 0.07 : 0, t, 0.05);
  if (red && Math.random() < 0.18) noise(t + Math.random() * 0.02, 0.012 + Math.random() * 0.02, 3500, 0.04 + Math.random() * 0.06);
}

/**
 * stop the generator.
 * instant: cash out, motor cut dead · die: overheat, everything winds down · fade: muted / scrolled away
 */
export function engineStop(mode: "instant" | "die" | "fade") {
  if (!eng || !ac) return;
  const e = eng;
  eng = null;
  const t = ac.currentTime;
  let end = t + 0.6;
  if (mode === "instant") {
    [e.motor, e.whistleGain, e.buzzGain].forEach((g) => g.gain.setTargetAtTime(0, t, 0.006));
    end = t + 0.1;
  } else if (mode === "die") {
    e.saws.forEach((o) => o.frequency.setTargetAtTime(12, t, 0.35));
    e.filter.frequency.setTargetAtTime(80, t, 0.3);
    e.motor.gain.setTargetAtTime(0, t + 0.15, 0.3);
    e.whistle.frequency.setTargetAtTime(220, t, 0.2);
    e.whistleGain.gain.setTargetAtTime(0, t, 0.08);
    e.buzzGain.gain.setTargetAtTime(0, t, 0.04);
    end = t + 2;
  } else {
    [e.motor, e.whistleGain, e.buzzGain].forEach((g) => g.gain.setTargetAtTime(0, t, 0.08));
  }
  e.oscs.forEach((o) => o.stop(end));
}

/** -1..1, the red-zone tremolo phase (drives the needle jitter so it moves with the buzz) */
export function redPulse() {
  const tt = eng && ac ? ac.currentTime - eng.lfoStart : performance.now() / 1000;
  return Math.sin(2 * Math.PI * BUZZ_HZ * tt);
}

function bandNoise(at: number, dur: number, freq: number, q: number, vol: number) {
  if (!ac || !master || !noiseBuf) return;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(master);
  s.start(at, Math.random() * 0.5);
  s.stop(at + dur + 0.02);
}

/** needle passing scale mark i: each one a little louder and higher */
function tick(i: number) {
  if (!ac) return;
  const t = ac.currentTime;
  const v = 0.06 + i * 0.03;
  bandNoise(t, 0.028, 1800 + i * 450, 3, v);
  ping(900 + i * 220, t, 0.06, v * 0.5);
}

/** needle slamming back onto its stop */
export function clack() {
  if (!enabled || !ac || !master) return;
  const t = ac.currentTime;
  bandNoise(t, 0.03, 2400, 2, 0.22);
  bandNoise(t + 0.035, 0.025, 1500, 2, 0.12);
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.1);
}

function ping(freq: number, at: number, dur = 0.25, vol = 0.18) {
  if (!ac || !master) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** coin clinks, n of them sprinkled over ~0.6s */
export function clink(n = 6) {
  if (!enabled || !ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < Math.min(n, 14); i++) {
    const at = t + i * 0.045 + Math.random() * 0.03;
    const f = 1900 + Math.random() * 900;
    ping(f, at, 0.18, 0.12);
    ping(f * 1.51, at + 0.002, 0.12, 0.06);
  }
}

function noise(at: number, dur: number, hp: number, vol: number) {
  if (!ac || !master || !noiseBuf) return;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(master);
  s.start(at, Math.random() * 0.5);
  s.stop(at + dur + 0.02);
}

/** overheat crack: noise burst + low thump */
export function crack() {
  if (!enabled || !ac || !master) return;
  const t = ac.currentTime;
  noise(t, 0.35, 900, 0.5);
  noise(t + 0.06, 0.5, 300, 0.25);
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.5);
}

/** short welding crackle */
export function sizzle(dur = 0.6) {
  if (!enabled || !ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < dur / 0.05; i++) noise(t + i * 0.05 + Math.random() * 0.03, 0.04, 3000, 0.08);
}
