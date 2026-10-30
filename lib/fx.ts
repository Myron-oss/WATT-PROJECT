/**
 * One full-screen particle canvas for the whole page: sparks, coins, smoke.
 * The loop only runs while particles are alive.
 */

type Kind = 0 | 1 | 2 | 3; // spark | coin | smoke | seed
type P = {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  g: number;
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let w = 0;
let h = 0;
let raf = 0;
let last = 0;
const ps: P[] = [];
let cap = 260;
let reduced = false;
let coinSprite: HTMLCanvasElement | null = null;
let seedSprite: HTMLCanvasElement | null = null;
let smokeSprite: HTMLCanvasElement | null = null;

function makeCoin() {
  const c = document.createElement("canvas");
  const s = 64;
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1b0f07";
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  const grd = g.createRadialGradient(24, 22, 4, 32, 32, 28);
  grd.addColorStop(0, "#fff6b8");
  grd.addColorStop(0.45, "#FFE14D");
  grd.addColorStop(1, "#c98a00");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#a87200";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(32, 32, 18, 0, Math.PI * 2);
  g.stroke();
  // little bolt
  g.fillStyle = "#a87200";
  g.beginPath();
  g.moveTo(35, 18);
  g.lineTo(25, 35);
  g.lineTo(32, 35);
  g.lineTo(29, 46);
  g.lineTo(40, 28);
  g.lineTo(33, 28);
  g.closePath();
  g.fill();
  return c;
}

function makeSeed() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 48;
  const g = c.getContext("2d")!;
  const shape = () => {
    g.beginPath();
    g.moveTo(16, 2);
    g.bezierCurveTo(30, 14, 28, 36, 16, 46);
    g.bezierCurveTo(4, 36, 2, 14, 16, 2);
    g.closePath();
  };
  shape();
  g.fillStyle = "#1b0f07";
  g.fill();
  g.save();
  g.translate(16, 24);
  g.scale(0.82, 0.86);
  g.translate(-16, -24);
  shape();
  g.fillStyle = "#2c2622";
  g.fill();
  g.restore();
  g.strokeStyle = "#d8cfbf";
  g.lineWidth = 2.2;
  for (const dx of [-5, 0, 5]) {
    g.beginPath();
    g.moveTo(16 + dx * 0.4, 8);
    g.quadraticCurveTo(16 + dx * 1.2, 24, 16 + dx * 0.5, 40);
    g.stroke();
  }
  return c;
}

/** shared sprites for other canvases */
export function sprite(kind: "coin" | "seed") {
  if (kind === "coin") return (coinSprite ??= makeCoin());
  return (seedSprite ??= makeSeed());
}

function makeSmoke() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(120,112,135,0.55)");
  grd.addColorStop(1, "rgba(120,112,135,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

export function mountFx(c: HTMLCanvasElement) {
  canvas = c;
  ctx = c.getContext("2d");
  cap = window.matchMedia("(pointer: coarse)").matches ? 150 : 260;
  reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  coinSprite ??= makeCoin();
  seedSprite ??= makeSeed();
  smokeSprite = makeSmoke();
  resize();
  window.addEventListener("resize", resize);
  return () => {
    window.removeEventListener("resize", resize);
    cancelAnimationFrame(raf);
    raf = 0;
    canvas = null;
    ctx = null;
    ps.length = 0;
  };
}

export const prefersReduced = () => reduced;

function push(p: P) {
  if (!canvas) return;
  if (ps.length >= cap) ps.shift();
  ps.push(p);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

type SparkOpts = { angle?: number; spread?: number; speed?: number; gravity?: number; size?: number; life?: number };

/** welding sparks. angle in radians (0 = right, -PI/2 = up) */
export function sparks(x: number, y: number, n: number, o: SparkOpts = {}) {
  if (reduced) n = Math.ceil(n * 0.2);
  const { angle = -Math.PI / 2, spread = Math.PI, speed = 420, gravity = 900, size = 1.6, life = 0.6 } = o;
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.35 + Math.random() * 0.8);
    push({
      k: 0,
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: life * (0.5 + Math.random() * 0.8),
      size: size * (0.6 + Math.random() * 0.9),
      rot: 0,
      vr: 0,
      g: gravity,
    });
  }
}

/** spinning coins bursting up and falling */
export function coins(x: number, y: number, n: number) {
  if (reduced) n = Math.ceil(n * 0.3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = 380 + Math.random() * 620;
    push({
      k: 1,
      x: x + (Math.random() - 0.5) * 30,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 1.6 + Math.random() * 0.9,
      size: 13 + Math.random() * 11,
      rot: Math.random() * 6,
      vr: 6 + Math.random() * 10,
      g: 1300,
    });
  }
}

/** sunflower seeds, same fountain physics as coins */
export function seeds(x: number, y: number, n: number) {
  if (reduced) n = Math.ceil(n * 0.3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 340 + Math.random() * 560;
    push({
      k: 3,
      x: x + (Math.random() - 0.5) * 40,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 1.5 + Math.random() * 0.8,
      size: 7 + Math.random() * 4,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 16,
      g: 1200,
    });
  }
}

export function smoke(x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    push({
      k: 2,
      x: x + (Math.random() - 0.5) * 30,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: -60 - Math.random() * 60,
      life: 0,
      max: 1.1 + Math.random() * 0.6,
      size: 18 + Math.random() * 16,
      rot: 0,
      vr: 0,
      g: -20,
    });
  }
}

function sparkColor(t: number) {
  // white-hot → yellow → orange → deep red as it cools
  if (t < 0.15) return "255,255,255";
  if (t < 0.4) return "255,226,140";
  if (t < 0.7) return "255,159,67";
  return "230,70,40";
}

function tick(now: number) {
  if (!ctx || !canvas) return;
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life += dt;
    if (p.life >= p.max || p.y > h + 60) {
      ps.splice(i, 1);
      continue;
    }
    p.vy += p.g * dt;
    if (p.k === 0) {
      p.vx *= 1 - 1.2 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }

  // smoke first (under), then coins, then additive sparks on top
  for (const p of ps) {
    if (p.k !== 2 || !smokeSprite) continue;
    const t = p.life / p.max;
    const s = p.size * (1 + t * 1.8);
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.drawImage(smokeSprite, p.x - s, p.y - s, s * 2, s * 2);
  }
  for (const p of ps) {
    if (p.k !== 1 || !coinSprite) continue;
    const t = p.life / p.max;
    ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
    const sx = Math.max(0.12, Math.abs(Math.cos(p.rot)));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(sx, 1);
    ctx.drawImage(coinSprite, -p.size, -p.size, p.size * 2, p.size * 2);
    ctx.restore();
  }
  for (const p of ps) {
    if (p.k !== 3 || !seedSprite) continue;
    const t = p.life / p.max;
    ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(seedSprite, -p.size * 0.66, -p.size, p.size * 1.33, p.size * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const p of ps) {
    if (p.k !== 0) continue;
    const t = p.life / p.max;
    ctx.globalAlpha = 1 - t * t;
    ctx.strokeStyle = `rgb(${sparkColor(t)})`;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  if (ps.length) raf = requestAnimationFrame(tick);
  else {
    ctx.clearRect(0, 0, w, h);
    raf = 0;
  }
}
