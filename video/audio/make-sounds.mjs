/**
 * Renders the video's sound effects to WAV, offline, with a tiny synth that mirrors
 * the site's Web Audio ideas (lib/sound.ts). The two motor tracks follow the exact
 * multiplier curves from video/timeline.json so ticks and the red-zone buzz line up.
 *
 *   node video/audio/make-sounds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import T from "../timeline.json" with { type: "json" };

const SR = 48000;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(OUT, { recursive: true });

/* ---------- tiny dsp kit ---------- */

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

/** band-limited saw (polyBLEP) */
function saw() {
  let ph = 0;
  return (freq) => {
    const dt = freq / SR;
    ph += dt;
    if (ph >= 1) ph -= 1;
    let v = 2 * ph - 1;
    if (ph < dt) {
      const t = ph / dt;
      v -= t + t - t * t - 1;
    } else if (ph > 1 - dt) {
      const t = (ph - 1) / dt;
      v -= t * t + t + t + 1;
    }
    return v;
  };
}
function sine() {
  let ph = 0;
  return (freq) => {
    ph += freq / SR;
    if (ph >= 1) ph -= 1;
    return Math.sin(ph * 2 * Math.PI);
  };
}
function square() {
  const s = sine();
  return (freq) => (s(freq) >= 0 ? 1 : -1);
}

/** RBJ biquad; call with (x, type, freq, q) */
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let key = "";
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  return (x, type, freq, q = 0.707) => {
    const k = `${type}${Math.round(freq)}${q.toFixed(2)}`;
    if (k !== key) {
      key = k;
      const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
      const al = Math.sin(w) / (2 * q);
      const c = Math.cos(w);
      let B0, B1, B2;
      if (type === "lp") [B0, B1, B2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
      else if (type === "hp") [B0, B1, B2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
      else [B0, B1, B2] = [al, 0, -al]; // band
      const A0 = 1 + al;
      [b0, b1, b2, a1, a2] = [B0 / A0, B1 / A0, B2 / A0, (-2 * c) / A0, (1 - al) / A0];
    }
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

/** one-pole smoother, like setTargetAtTime */
function smooth(tc, init = 0) {
  let v = init;
  const a = 1 - Math.exp(-1 / (tc * SR));
  return (target) => (v += (target - v) * a);
}

const env = (t, a, d) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

function mix(into, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < into.length; i++) if (o + i >= 0) into[o + i] += src[i] * gain;
}

function writeWav(name, data) {
  // soft clip + fade edges
  const n = data.length;
  const pcm = Buffer.alloc(44 + n * 2);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 64, (n - 1 - i) / 256);
    const v = Math.tanh(data[i] * 1.1) * fade;
    pcm.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + n * 2, 4);
  pcm.write("WAVEfmt ", 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(n * 2, 40);
  writeFileSync(join(OUT, name), pcm);
  console.log(`  ${name.padEnd(14)} ${(n / SR).toFixed(2)}s`);
}

/* ---------- one-shots ---------- */

function noiseBurst(sec, type, freq, q, vol, decay) {
  const b = buf(sec);
  const f = biquad();
  for (let i = 0; i < b.length; i++) b[i] = f(rnd(), type, freq, q) * vol * env(i / SR, 0.001, decay);
  return b;
}

function pingBuf(freq, sec, vol, decay = sec / 4) {
  const b = buf(sec);
  const o = sine();
  for (let i = 0; i < b.length; i++) b[i] = o(freq) * vol * env(i / SR, 0.003, decay);
  return b;
}

function tickBuf(i) {
  const b = buf(0.12);
  const v = 0.5 + i * 0.12;
  mix(b, noiseBurst(0.06, "bp", 1800 + i * 450, 3, v, 0.012));
  mix(b, pingBuf(900 + i * 220, 0.08, v * 0.4, 0.02));
  return b;
}

function clack() {
  const b = buf(0.25);
  mix(b, noiseBurst(0.05, "bp", 2400, 2, 1.2, 0.01));
  mix(b, noiseBurst(0.05, "bp", 1500, 2, 0.6, 0.01), 0.035);
  const o = sine();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] += o(170 * Math.pow(70 / 170, Math.min(1, t / 0.06))) * 0.7 * env(t, 0.001, 0.03);
  }
  return b;
}

function thud() {
  const b = buf(0.45);
  const o = sine();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = o(150 * Math.pow(50 / 150, Math.min(1, t / 0.12))) * 0.9 * env(t, 0.002, 0.09);
  }
  mix(b, noiseBurst(0.2, "lp", 500, 0.8, 0.8, 0.04));
  return b;
}

function crack() {
  const b = buf(1.1);
  mix(b, noiseBurst(0.6, "hp", 900, 0.7, 0.9, 0.09));
  mix(b, noiseBurst(0.8, "hp", 300, 0.7, 0.45, 0.16), 0.06);
  const o = sine();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] += o(120 * Math.pow(38 / 120, Math.min(1, t / 0.4))) * 0.9 * env(t, 0.002, 0.12);
  }
  // crackle tail
  for (let k = 0; k < 18; k++) mix(b, noiseBurst(0.03, "hp", 3000, 0.7, 0.25 + Math.abs(rnd()) * 0.3, 0.006), 0.1 + Math.abs(rnd()) * 0.8);
  return b;
}

function spark() {
  const b = buf(0.5);
  mix(b, noiseBurst(0.12, "hp", 2500, 0.7, 0.8, 0.025));
  for (let k = 0; k < 8; k++) mix(b, noiseBurst(0.03, "hp", 3500, 0.7, 0.3 + Math.abs(rnd()) * 0.3, 0.005), 0.04 + Math.abs(rnd()) * 0.35);
  return b;
}

function sizzle() {
  const b = buf(0.8);
  for (let k = 0; k < 22; k++) mix(b, noiseBurst(0.04, "hp", 3200, 0.7, 0.2 + Math.abs(rnd()) * 0.25, 0.008), k * 0.03 + Math.abs(rnd()) * 0.02);
  // a soft arc hum underneath
  const f = biquad();
  for (let i = 0; i < b.length; i++) b[i] += f(rnd(), "bp", 5200, 1.2) * 0.12 * env(i / SR, 0.02, 0.25);
  return b;
}

/** sad power-down: everything sags and dies */
function powerdown() {
  const sec = 1.6;
  const b = buf(sec);
  const s1 = saw();
  const s2 = saw();
  const tri = sine();
  const f = biquad();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const k = Math.pow(0.12, t / 1.2);
    const fr = 220 * k + 18;
    const g = Math.max(0, 1 - t / sec) ** 1.6;
    let v = (s1(fr) + s2(fr * 1.012)) * 0.35;
    v = f(v, "lp", 200 + 2400 * k, 3);
    v += tri(440 * Math.pow(0.25, t / 1.1)) * 0.25 * Math.exp(-t / 0.5);
    b[i] = v * g * 0.8;
  }
  return b;
}

function coins() {
  const b = buf(1.4);
  for (let i = 0; i < 16; i++) {
    const at = i * 0.045 + Math.abs(rnd()) * 0.03;
    const fr = 1900 + Math.abs(rnd()) * 900;
    mix(b, pingBuf(fr, 0.2, 0.45, 0.045), at);
    mix(b, pingBuf(fr * 1.51, 0.14, 0.22, 0.03), at + 0.002);
  }
  return b;
}

/** short congratulation jingle: bright arpeggio + sparkle chord */
function jingle() {
  const b = buf(1.6);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, i) => {
    const s = buf(0.4);
    const o1 = sine();
    const o2 = square();
    const f = biquad();
    for (let k = 0; k < s.length; k++) {
      const t = k / SR;
      s[k] = (o1(n) * 0.6 + f(o2(n), "lp", 2600, 0.8) * 0.18) * env(t, 0.004, 0.12);
    }
    mix(b, s, i * 0.085, 0.6);
  });
  for (const n of [1046.5, 1318.5, 1568]) mix(b, pingBuf(n, 0.9, 0.22, 0.28), 0.36);
  for (let k = 0; k < 6; k++) mix(b, pingBuf(2600 + Math.abs(rnd()) * 1600, 0.2, 0.08, 0.04), 0.42 + k * 0.06);
  return b;
}

/* ---------- the motor, following the gauge ---------- */

/**
 * @param m      multiplier at time t (seconds from the start of this track)
 * @param dur    seconds of driving
 * @param stop   "instant" (cash out) or "die" (overheat: winds down for 1.4s)
 */
function motor(m, dur, stop) {
  const tail = stop === "die" ? 1.6 : 0.05;
  const b = buf(dur + tail);
  const sa = saw();
  const sb = saw();
  const wh = sine();
  const bz = square();
  const lpf = biquad();
  const bzf = biquad();
  const fr = smooth(0.06, 18);
  const cut = smooth(0.06, 140);
  const gain = smooth(0.08, 0);
  const wg = smooth(0.1, 0);
  const wf = smooth(0.08, 1100);
  const bg = smooth(0.05, 0);
  let ticks = 0;
  const g01 = (x) => Math.min(1, Math.max(0, x));

  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    if (t < dur) {
      const mm = m(t);
      const g = g01(Math.log(mm) / Math.log(100));
      const w = g01((Math.log(mm) - Math.log(10)) / (Math.log(100) - Math.log(10)));
      const red = mm >= T.redZone;
      const f0 = fr(34 * Math.pow(2, g * 3.4));
      const c = cut(160 * Math.pow(2, g * 5.4));
      const q = 4 + g * 7;
      v = lpf((sa(f0) + sb(f0 * 1.0105)) * 0.5, "lp", c, q) * gain(0.32 + g * 0.4);
      v += wh(wf(1100 * Math.pow(2, w * 1.5))) * wg(w * 0.16);
      const trem = 0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * t);
      v += bzf(bz(96), "lp", 1700, 0.7) * trem * bg(red ? 0.22 : 0);
      if (red && Math.abs(rnd()) < 0.0006) mix(b, noiseBurst(0.03, "hp", 3500, 0.7, 0.3, 0.006), t);
      while (ticks < T.marks.length && mm >= T.marks[ticks]) {
        mix(b, tickBuf(ticks), t, 0.9);
        ticks++;
      }
    } else if (stop === "die") {
      const k = Math.pow(0.05, (t - dur) / tail);
      const f0 = fr(12 + 300 * k);
      v = lpf((sa(f0) + sb(f0 * 1.0105)) * 0.5, "lp", cut(80 + 3000 * k), 4) * gain(0.7 * k);
      v += wh(wf(220)) * wg(0);
    } else {
      v = lpf((sa(fr(40)) + sb(40)) * 0.5, "lp", 200, 1) * gain(0) * 0; // motor cut dead
    }
    b[i] += v;
  }
  return b;
}

const { run1, run2, fps } = T;
const mAt = (k, start, from) => (t) => Math.max(1, Math.exp(k * (t + (from - start) / fps)));

console.log("rendering sfx →", OUT);
writeWav("motor1.wav", motor(mAt(run1.k, run1.start, run1.start), (run1.crash - run1.start) / fps, "die"));
writeWav("motor2.wav", motor(mAt(run2.k, run2.start, run2.start), (run2.release - run2.start) / fps, "instant"));
writeWav("clack.wav", clack());
writeWav("thud.wav", thud());
writeWav("crack.wav", crack());
writeWav("spark.wav", spark());
writeWav("sizzle.wav", sizzle());
writeWav("powerdown.wav", powerdown());
writeWav("coins.wav", coins());
writeWav("jingle.wav", jingle());
