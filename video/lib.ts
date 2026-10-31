import { random, spring } from "remotion";
import T from "./timeline.json";
import { legCycle } from "../components/Hamster";
import { needleAngle, NEEDLE_MIN, NEEDLE_MAX } from "../components/hero/Voltmeter";

export { T };
export const FPS = T.fps;
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sceneOf = (f: number) => T.scenes.findIndex(([a, b]) => f >= a && f < b);

/** snappy spring starting at frame `from` */
export const pop = (f: number, from: number, cfg: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  spring({ frame: f - from, fps: FPS, config: { damping: 11, stiffness: 210, mass: 0.6, ...cfg } });

/* ---------- the game curves (shared with the audio script through timeline.json) ---------- */

const { run1, run2 } = T;
export const RELEASE_M = Math.exp((run2.k * (run2.release - run2.start)) / FPS);

/** multiplier shown on the gauge */
export function mult(f: number) {
  if (f >= run1.start && f <= run1.crash) return Math.max(1, Math.exp((run1.k * (f - run1.start)) / FPS));
  if (f >= run2.start && f <= run2.release) return Math.max(1, Math.exp((run2.k * (f - run2.start)) / FPS));
  if (f > run2.release && f < T.scenes[6][0]) return RELEASE_M;
  return 1;
}

/** what the gauge readout says (holds the crash value while he's down) */
export function readout(f: number) {
  if (f > run1.crash && f < run2.start) return Math.exp((run1.k * (run1.crash - run1.start)) / FPS);
  return mult(f);
}

export type Mood = "none" | "idle" | "running" | "overheat" | "flying" | "knocked" | "back" | "win" | "wave";

/** what the main hamster is doing */
export function mood(f: number): Mood {
  if (f < T.drop.start) return "none";
  if (f < run1.start) return "idle";
  if (f < run1.overheat) return "running";
  if (f < run1.crash) return "overheat";
  if (f < run1.land) return "flying";
  if (f < run1.popUp) return "knocked";
  if (f < run1.back) return "back";
  if (f < run2.start) return "idle";
  if (f < run2.release) return "running";
  if (f < T.scenes[6][0]) return "win";
  return f < 470 ? "idle" : "wave";
}

/** 0..1 how hard he runs */
function speedTarget(f: number) {
  const md = mood(f);
  if (md === "running") return 0.16 + 0.84 * clamp(Math.log(mult(f)) / Math.log(40));
  if (md === "overheat") return 1;
  if (f >= T.scenes[6][0]) return 0.08;
  return 0;
}

// integrate speed → wheel angle + leg phase, once, deterministically
const N = T.frames + 1;
export const SPEED = new Float32Array(N);
export const ANGLE = new Float32Array(N);
export const LEGPHASE = new Float32Array(N);
{
  let sp = 0;
  let ang = 0;
  let ph = 0;
  for (let f = 0; f < N; f++) {
    const tgt = speedTarget(f);
    const rate = tgt > sp ? 9 : 2.4;
    sp += (tgt - sp) * (1 - Math.exp(-rate / FPS));
    // release / crash cut the motor hard
    if (f === run2.release) sp *= 0.4;
    ang += (sp * 13 * 180) / Math.PI / FPS;
    ph += 1 / legCycle(Math.max(sp, 0.3)) / FPS;
    SPEED[f] = sp;
    ANGLE[f] = ang;
    LEGPHASE[f] = ph;
  }
}

/** gauge needle in degrees */
export function needle(f: number) {
  const m = mult(f);
  const md = mood(f);
  if (md === "running" || md === "overheat") {
    const red = m >= T.redZone;
    const t = f / FPS;
    const j = red ? Math.sin(2 * Math.PI * 8 * t) * 1.4 + (random(`nj${f}`) - 0.5) * 0.8 : (random(`nj${f}`) - 0.5) * SPEED[f] * 1.6;
    return Math.min(NEEDLE_MAX + 3, needleAngle(m)) + j;
  }
  // crash: power dies, needle falls to zero
  if (f >= run1.crash && f < run2.start) {
    const p = clamp((f - run1.crash) / 16);
    return lerp(NEEDLE_MAX, NEEDLE_MIN, 1 - Math.pow(1 - p, 3));
  }
  // release: snaps back onto the stop
  if (f >= run2.release) {
    const p = clamp((f - run2.release) / 4);
    return lerp(needleAngle(RELEASE_M), NEEDLE_MIN, p * p);
  }
  return NEEDLE_MIN;
}

/* ---------- deterministic particles ---------- */

export type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; i: number; seed: string };

type Burst = {
  seed: string;
  x: number;
  y: number;
  t0: number; // frame
  n: number;
  speed: number;
  angle?: number;
  spread?: number;
  gravity?: number;
  life?: number; // seconds
};

export function burst(b: Burst, f: number): Particle[] {
  const age0 = (f - b.t0) / FPS;
  if (age0 < 0) return [];
  const { angle = -Math.PI / 2, spread = Math.PI * 2, gravity = 900, life = 0.6 } = b;
  const out: Particle[] = [];
  for (let i = 0; i < b.n; i++) {
    const s = `${b.seed}-${i}`;
    const lf = life * (0.5 + random(s + "l") * 0.8);
    if (age0 > lf) continue;
    const a = angle + (random(s + "a") - 0.5) * spread;
    const v = b.speed * (0.35 + random(s + "v") * 0.8);
    const vx = Math.cos(a) * v;
    const vy0 = Math.sin(a) * v;
    out.push({
      x: b.x + vx * age0,
      y: b.y + vy0 * age0 + 0.5 * gravity * age0 * age0,
      vx,
      vy: vy0 + gravity * age0,
      age: age0,
      life: lf,
      i,
      seed: s,
    });
  }
  return out;
}

/** a stream: `perFrame` particles emitted every frame in [from, to] */
export function stream(
  b: Omit<Burst, "t0" | "n" | "x" | "y"> & { from: number; to: number; perFrame: number; at: (k: number) => { x: number; y: number } },
  f: number,
) {
  const lifeFrames = Math.ceil((b.life ?? 0.6) * 1.3 * FPS);
  const out: Particle[] = [];
  for (let k = Math.max(b.from, f - lifeFrames); k <= Math.min(b.to, f); k++) {
    const { x, y } = b.at(k);
    out.push(...burst({ ...b, seed: `${b.seed}${k}`, x, y, t0: k, n: b.perFrame }, f));
  }
  return out;
}

export function sparkColor(t: number) {
  if (t < 0.15) return "#ffffff";
  if (t < 0.4) return "#ffe28c";
  if (t < 0.7) return "#ff9f43";
  return "#e64628";
}
