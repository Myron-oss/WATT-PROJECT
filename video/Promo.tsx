import type { CSSProperties } from "react";
import { AbsoluteFill, Audio, Sequence, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Hamster, type HamsterState } from "../components/Hamster";
import { Wheel, HAMSTER_IN_WHEEL } from "../components/Wheel";
import { Voltmeter } from "../components/hero/Voltmeter";
import { Weld } from "./Weld";
import {
  ANGLE,
  FPS,
  LEGPHASE,
  RELEASE_M,
  SPEED,
  T,
  burst,
  clamp,
  lerp,
  mood,
  mult,
  needle,
  pop,
  readout,
  sceneOf,
  sparkColor,
  stream,
  type Particle,
} from "./lib";

const { drop, run1, run2 } = T;
const OUTRO = T.scenes[6][0];

const TITLES: { text: string; tone: "good" | "bad" }[] = [
  { text: "solana goes *down*.", tone: "bad" },
  { text: "who keeps it *running*?", tone: "good" },
  { text: "meet the *hamster*.", tone: "good" },
  { text: "hold to *pump*.", tone: "good" },
  { text: "don't *overheat*.", tone: "bad" },
  { text: "release. get *paid*.", tone: "good" },
];

// frames where the multiplier crosses 5x and 25x on the first run
const crossAt = (m: number) => Math.round(run1.start + (Math.log(m) / run1.k) * FPS);
const POPS = [
  { at: crossAt(5), text: "+5x" },
  { at: crossAt(25), text: "+25x" },
];

/* ---------------- layout for both formats ---------------- */

function useLayout(f: number) {
  const { width: W, height: H } = useVideoConfig();
  const portrait = H > W;
  const outro = f >= OUTRO;
  const wheel = outro ? (portrait ? 640 : 440) : portrait ? 600 : 500;
  const floor = outro ? (portrait ? 1110 : 640) : portrait ? 1382 : 868;
  const top = floor - wheel * 1.065;
  return {
    W,
    H,
    portrait,
    wheel,
    floor,
    top,
    cx: W / 2,
    cy: top + wheel / 2,
    textY: portrait ? 250 : 92,
    textSize: portrait ? 104 : 112,
    gauge: portrait ? { x: W / 2, y: 440, w: 430 } : { x: W / 2 + 500, y: 250, w: 380 },
    bg: portrait
      ? [
          { x: W * 0.12, size: 170 },
          { x: W * 0.88, size: 170 },
        ]
      : [
          { x: W * 0.13, size: 220 },
          { x: W * 0.87, size: 220 },
        ],
    racks: portrait ? 5 : 9,
  };
}
type Layout = ReturnType<typeof useLayout>;

/* ---------------- server LEDs ---------------- */

function rackGeometry(L: Layout) {
  const pad = 26;
  const n = L.racks;
  const w = (L.W - pad * 2) / n;
  const maxH = L.floor - (L.portrait ? 620 : 230);
  return Array.from({ length: n }, (_, i) => {
    const h = maxH * (0.55 + 0.45 * random(`rack${i}`));
    const rows = Math.max(5, Math.round(h / 52));
    return { x: pad + i * w + 10, w: w - 20, h, rows };
  });
}

function ledLook(f: number, ord: number, total: number, seed: string): { c: string; o: number } {
  const t = f / FPS;
  const r = random(seed);
  const idle = { c: "#8B5CF6", o: 0.3 + 0.25 * Math.sin(t * Math.PI * 1.1 + r * 9) };
  if (f < T.scenes[1][0]) {
    const flipAt = 10 + r * 58;
    if (f < flipAt) return { c: "#3DFF8A", o: 0.9 };
    return { c: "#FF3B5C", o: f - flipAt < 3 ? 1 : 0.55 + 0.35 * (Math.sin(t * 14 + r * 20) > 0 ? 1 : 0) };
  }
  if (f < drop.plug) return { c: "#FF3B5C", o: 0.12 };
  const fill = (m: number) => clamp(Math.log(m) / Math.log(100)) * total;
  const md = mood(f);
  if (md === "running" || md === "overheat") return ord < fill(mult(f)) ? { c: "#3DFF8A", o: 0.95 } : idle;
  if (f >= run1.crash && f < run2.start) {
    const dieAt = run1.crash + ((total - ord) / total) * 14;
    const backAt = run1.popUp - 4 + (ord / total) * 14;
    if (f < dieAt) return { c: "#FF3B5C", o: 0.95 };
    if (f < backAt) return { c: "#FF3B5C", o: 0.05 };
    return idle;
  }
  if (md === "win") return { c: "#3DFF8A", o: Math.sin((f - run2.release) * 0.9 + ord * 0.35) > -0.2 ? 1 : 0.35 };
  if (f >= OUTRO) return ord % 3 === 0 ? { c: "#3DFF8A", o: 0.6 } : idle;
  return idle;
}

function Racks({ L, f }: { L: Layout; f: number }) {
  const racks = rackGeometry(L);
  // order every row from the floor up (that's how they light while he pumps)
  const rows = racks.flatMap((r, ri) => Array.from({ length: r.rows }, (_, i) => ({ ri, i, y: (i + 0.6) * (r.h / r.rows) })));
  const order = new Map(
    [...rows].sort((a, b) => a.y - b.y || a.ri - b.ri).map((r, k) => [`${r.ri}-${r.i}`, k]),
  );
  const total = rows.length;
  return (
    <>
      {racks.map((r, ri) => (
        <div
          key={ri}
          style={{
            position: "absolute",
            left: r.x,
            width: r.w,
            top: L.floor - r.h,
            height: r.h,
            borderRadius: "14px 14px 4px 4px",
            background: "linear-gradient(180deg, #100e16, #0a0910)",
            boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.04), 0 0 0 6px rgb(30 22 28 / 0.5)",
          }}
        >
          {Array.from({ length: r.rows }, (_, i) => {
            const y = r.h - (i + 0.6) * (r.h / r.rows);
            const { c, o } = ledLook(f, order.get(`${ri}-${i}`)!, total, `led${ri}-${i}`);
            return (
              <div key={i}>
                <div style={{ position: "absolute", left: "8%", right: "8%", top: y + 12, height: 3, background: "#1e1a27", borderRadius: 2 }} />
                <div
                  style={{
                    position: "absolute",
                    left: "12%",
                    width: "62%",
                    top: y - 4,
                    height: 8,
                    opacity: o,
                    background: `radial-gradient(circle, ${c} 0 2.2px, transparent 3.2px) 0 50% / 13px 100% repeat-x`,
                    filter: o > 0.8 ? `drop-shadow(0 0 4px ${c})` : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---------------- scene 1 chart ---------------- */

function Chart({ L, f }: { L: Layout; f: number }) {
  if (f >= T.scenes[1][0]) return null;
  const y0 = L.portrait ? L.H * 0.4 : L.H * 0.42;
  const h = L.portrait ? 260 : 300;
  const rise = Array.from({ length: 24 }, (_, i) => {
    const x = (i / 23) * L.W;
    const y = y0 + h * 0.5 - (i / 23) * h * 0.55 + (random(`c${i}`) - 0.5) * 60;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const mid = L.W * 0.55;
  const flat = `M0 ${y0 + h * 0.3} L${mid} ${y0 + h * 0.3} L${mid + 30} ${y0 + h * 0.3 - 90} L${mid + 52} ${y0 + h * 0.3 + 70} L${mid + 72} ${y0 + h * 0.3} L${L.W} ${y0 + h * 0.3}`;
  const greenOn = 1 - clamp((f - 24) / 6);
  const redReveal = clamp((f - 26) / 34);
  return (
    <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0 }}>
      <path d={rise} fill="none" stroke="#3DFF8A" strokeWidth="4" opacity={greenOn} style={{ filter: "drop-shadow(0 0 8px #3DFF8A)" }} />
      <g style={{ clipPath: `inset(0 ${(1 - redReveal) * 100}% 0 0)` }}>
        <path d={flat} fill="none" stroke="#FF3B5C" strokeWidth="4" style={{ filter: "drop-shadow(0 0 8px #FF3B5C)" }} />
      </g>
      {redReveal > 0 && redReveal < 1 && <circle cx={redReveal * L.W} cy={y0 + h * 0.3} r="7" fill="#fff" style={{ filter: "drop-shadow(0 0 10px #FF3B5C)" }} />}
    </svg>
  );
}

/* ---------------- particles ---------------- */

function Sparks({ ps, w = 2.6 }: { ps: Particle[]; w?: number }) {
  return (
    <g strokeLinecap="round" style={{ mixBlendMode: "screen" }}>
      {ps.map((p) => {
        const t = p.age / p.life;
        return (
          <line
            key={p.seed}
            x1={p.x}
            y1={p.y}
            x2={p.x - p.vx * 0.022}
            y2={p.y - p.vy * 0.022}
            stroke={sparkColor(t)}
            strokeWidth={w * (1 - t * 0.5)}
            opacity={1 - t * t}
          />
        );
      })}
    </g>
  );
}

function Coins({ ps, r = 26 }: { ps: Particle[]; r?: number }) {
  return (
    <g>
      {ps.map((p) => {
        const t = p.age / p.life;
        const spin = Math.abs(Math.cos(random(p.seed + "r") * 6 + p.age * (8 + random(p.seed + "s") * 10)));
        const s = r * (0.6 + random(p.seed + "z") * 0.6);
        return (
          <g key={p.seed} transform={`translate(${p.x} ${p.y}) scale(${Math.max(0.15, spin)} 1)`} opacity={t > 0.85 ? (1 - t) / 0.15 : 1}>
            <circle r={s} fill="#1b0f07" />
            <circle r={s * 0.86} fill="url(#coin)" />
            <circle r={s * 0.55} fill="none" stroke="#a87200" strokeWidth={s * 0.1} />
          </g>
        );
      })}
    </g>
  );
}

function Smoke({ ps }: { ps: Particle[] }) {
  return (
    <g>
      {ps.map((p) => {
        const t = p.age / p.life;
        return <circle key={p.seed} cx={p.x} cy={p.y} r={22 + t * 60} fill="url(#smoke)" opacity={(1 - t) * 0.9} />;
      })}
    </g>
  );
}

/* ---------------- the film ---------------- */

export function Promo() {
  const f = useCurrentFrame();
  const L = useLayout(f);
  const sc = sceneOf(f);
  const md = mood(f);
  const sp = SPEED[f];
  const t = f / FPS;
  const m = mult(f);

  // camera: punch-in at each cut, shake when it gets hot
  const sceneStart = T.scenes[Math.max(0, sc)][0];
  let scale = 1.06 - 0.06 * pop(f, sceneStart, { damping: 14, stiffness: 160 });
  if (sc === 3) scale += clamp((f - 210) / 120) * 0.05;
  let shake = md === "running" ? Math.pow(sp, 2.5) * 5 : 0;
  if (md === "overheat") shake = 5 + (f - run1.overheat) * 1.1;
  if (f >= run1.crash && f < run1.crash + 8) shake = 26 * (1 - (f - run1.crash) / 8);
  if (md === "running" && m >= T.redZone) shake += 5;
  const sx = (random(`sx${f}`) - 0.5) * shake;
  const sy = (random(`sy${f}`) - 0.5) * shake;

  // lighting
  let dark = 0;
  if (f >= T.scenes[1][0] && f < drop.start) dark = 0.93;
  else if (f >= drop.start && f < drop.plug) dark = lerp(0.93, 0.55, clamp((f - drop.start) / 30));
  else if (f >= drop.plug && f < drop.plug + 6) dark = 0.55 * (1 - (f - drop.plug) / 6);
  if (f >= run1.crash && f < run1.popUp) dark = Math.max(dark, 0.7);
  const spotOn = f >= 96 && f < drop.plug + 6 ? ([1, 0, 1, 1, 0, 1][Math.min(5, Math.floor((f - 96) / 2))] ?? 1) : 0;
  const spotFall = pop(f, 96, { damping: 13, stiffness: 240 });
  const spotFade = f >= drop.plug ? 1 - clamp((f - drop.plug) / 6) : 1;

  let halo = 0;
  if (f >= drop.plug) halo = 0.35 + 0.6 * sp;
  if (f >= run1.crash && f < run1.popUp) halo = 0.08;
  if (md === "win") halo = 0.95 - clamp((f - run2.release) / 25) * 0.3;
  if (f >= OUTRO) halo = 0.9 + 0.1 * Math.sin(t * 3);

  const floorColor = f < T.scenes[1][0] || (f >= run1.crash && f < run1.popUp) ? "#FF3B5C" : md === "running" || md === "win" ? "#3DFF8A" : "#8B5CF6";
  const floorGlow = f >= T.scenes[1][0] && f < drop.plug ? 0.25 : 0.9;

  /* ----- the main hamster ----- */
  const W = L.wheel;
  const hamState: HamsterState | null =
    md === "none"
      ? null
      : md === "flying"
        ? "overheat"
        : md === "back"
          ? "idle"
          : (md as HamsterState);
  let hx = 0;
  let hy = 0;
  let hrot = 0;
  let hsx = 1;
  let hsy = 1;
  if (f >= drop.start && f < drop.land) {
    const p = (f - drop.start) / (drop.land - drop.start);
    hy = -L.H * (1 - p * p);
  } else if (f >= drop.land && f < drop.land + 14) {
    const s = pop(f, drop.land, { damping: 7, stiffness: 320 });
    hsy = 0.76 + 0.24 * s;
    hsx = 1 + (1 - hsy) * 0.7;
  }
  const dx = -W * 0.95; // he flies out to the left
  const dy = W * 0.125;
  if (md === "flying") {
    const p = (f - run1.crash) / (run1.land - run1.crash);
    hx = dx * p;
    hy = dy * p - Math.sin(p * Math.PI) * W * 0.75;
    hrot = -180 * p;
  } else if (md === "knocked") {
    hx = dx;
    hy = dy;
    const s = pop(f, run1.land, { damping: 7, stiffness: 320 });
    hsy = 0.8 + 0.2 * s;
    hsx = 1 + (1 - hsy) * 0.6;
  } else if (md === "back") {
    const p = (f - run1.popUp) / (run1.back - run1.popUp);
    const e = 1 - Math.pow(1 - p, 2);
    hx = dx * (1 - e);
    hy = dy * (1 - e) - Math.sin(p * Math.PI) * W * 0.55;
    hrot = 24 * Math.sin(p * Math.PI);
  }
  const plugged = f >= drop.plug && md !== "flying" && md !== "knocked" && md !== "back";
  const hub = { x: L.cx, y: L.cy };

  /* ----- particles ----- */
  const contact = (k: number) => ({ x: L.cx - W * 0.16, y: L.top + W * 0.9 + 0 * k });
  const head = () => ({ x: L.cx + W * 0.2, y: L.top + W * 0.6 });
  const sparks: Particle[] = [
    ...stream({ seed: "tr1", from: run1.start + 2, to: run1.overheat - 1, perFrame: 2, at: contact, angle: -Math.PI * 0.86, spread: 0.9, speed: 900, gravity: 1500, life: 0.5 }, f),
    ...stream({ seed: "tr2", from: run1.overheat, to: run1.crash - 1, perFrame: 5, at: contact, angle: -Math.PI * 0.86, spread: 1.2, speed: 1200, gravity: 1500, life: 0.55 }, f),
    ...stream({ seed: "tr3", from: run2.start + 2, to: run2.release - 1, perFrame: 3, at: contact, angle: -Math.PI * 0.86, spread: 0.9, speed: 1100, gravity: 1500, life: 0.5 }, f),
    ...burst({ seed: "plug", x: hub.x, y: hub.y, t0: drop.plug, n: 46, speed: 1100, gravity: 1400, life: 0.8 }, f),
    ...burst({ seed: "crash", x: L.cx, y: L.top + W * 0.8, t0: run1.crash, n: 70, speed: 1700, spread: Math.PI * 1.7, gravity: 1600, life: 0.9 }, f),
    ...burst({ seed: "win", x: L.cx, y: L.top + W * 0.55, t0: run2.release, n: 30, speed: 1200, gravity: 1400, life: 0.7 }, f),
  ];
  // scene 1: a few LEDs spit red sparks as they die
  if (f < T.scenes[1][0]) {
    const racks = rackGeometry(L);
    for (let i = 0; i < 9; i++) {
      const ri = Math.floor(random(`sr${i}`) * racks.length);
      const r = racks[ri];
      const t0 = Math.round(12 + random(`st${i}`) * 60);
      sparks.push(...burst({ seed: `s1${i}`, x: r.x + r.w * 0.4, y: L.floor - r.h * (0.2 + random(`sy${i}`) * 0.7), t0, n: 10, speed: 520, gravity: 1300, life: 0.5 }, f));
    }
  }
  const coins = burst({ seed: "coins", x: L.cx, y: L.top + W * 0.55, t0: run2.release, n: 64, speed: 2100, angle: -Math.PI / 2, spread: 2.3, gravity: 2600, life: 1.6 }, f);
  const smoke = stream({ seed: "smk", from: run1.overheat, to: run1.crash, perFrame: 1, at: head, speed: 90, angle: -Math.PI / 2, spread: 1, gravity: -80, life: 1.2 }, f);

  /* ----- background hamsters ----- */
  const bgState = (i: number): HamsterState => {
    if (f >= run1.crash && f < run1.popUp + 6) return "knocked";
    if (md === "win") return "wave";
    if ((md === "running" || md === "overheat") && m >= (i ? 10 : 2)) return "running";
    return "idle";
  };
  const cheerY = (i: number) => (md === "win" ? -Math.abs(Math.sin(((f - run2.release - 2 - i * 2) / 7) * Math.PI)) * 0.22 : 0);

  const clockVars = { ["--clock" as string]: t } as CSSProperties;
  const fonts = {
    ["--font-stencil" as string]: '"Big Shoulders Stencil", sans-serif',
    ["--font-saira" as string]: '"Saira Stencil One", sans-serif',
    ["--font-manrope" as string]: '"Manrope", sans-serif',
    ["--font-jetbrains" as string]: '"JetBrains Mono", monospace',
  } as CSSProperties;

  const title = sc >= 0 && sc < 6 ? TITLES[sc] : null;
  const titleOut = sc >= 0 && sc < 6 ? clamp((T.scenes[sc][1] - f - 1) / 3) : 1;

  return (
    <AbsoluteFill className="vclock" style={{ ...clockVars, ...fonts, background: "#0A0A0F", overflow: "hidden", fontFamily: "Manrope, sans-serif" }}>
      {/* ---------- world (camera) ---------- */}
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${scale})`, transformOrigin: `50% ${(L.cy / L.H) * 100}%` }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 45% at 50% 38%, rgb(139 92 246 / 0.22), transparent 70%), linear-gradient(180deg, #060509, #0d0a10 60%, #09070b)`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, opacity: f >= OUTRO ? 0.45 : 0.85 }}>
          <Racks L={L} f={f} />
        </div>
        <Chart L={L} f={f} />

        {/* floor + reflection */}
        <div style={{ position: "absolute", left: 0, right: 0, top: L.floor, bottom: 0, background: "linear-gradient(180deg, rgb(16 12 20 / 0.96), #07060a 50%)" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: L.floor - 1,
            height: 3,
            opacity: floorGlow,
            background: `linear-gradient(90deg, transparent, ${floorColor} 30%, ${floorColor} 70%, transparent)`,
            boxShadow: `0 0 24px 4px ${floorColor}88`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: L.cx - W,
            width: W * 2,
            top: L.floor,
            height: W * 0.5,
            opacity: halo * 0.8,
            background: "radial-gradient(50% 50% at 50% 0%, rgb(255 190 120 / 0.35), transparent 100%)",
          }}
        />

        {/* dust */}
        <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: L.portrait ? 50 : 70 }, (_, i) => {
            const vx = (random(`dx${i}`) - 0.5) * 30;
            const vy = 12 + random(`dy${i}`) * 26 * (1 + sp * 3);
            const x = (((random(`px${i}`) * L.W + vx * t) % L.W) + L.W) % L.W;
            const y = L.H - ((random(`py${i}`) * L.H + vy * t) % L.H);
            const tw = 0.3 + 0.3 * Math.sin(t * 2 + i);
            return <rect key={i} x={x} y={y} width={1.5 + random(`ds${i}`) * 2} height={1.5 + random(`ds${i}`) * 2} fill={i % 3 ? "#ffd9a8" : "#b89cff"} opacity={tw} />;
          })}
        </svg>

        {/* background hamsters */}
        {L.bg.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x - b.size / 2,
              top: L.floor - b.size * 1.075,
              width: b.size,
              opacity: f >= OUTRO ? 0.35 : 0.9,
              transform: `translateY(${cheerY(i) * b.size}px)`,
            }}
          >
            <Wheel angle={bgState(i) === "running" ? (t * 520 * (i ? 1.1 : 1)) % 360 : 0} glow={0.3} dead={f < drop.plug || (f >= run1.crash && f < run1.popUp)}>
              <Hamster
                state={bgState(i)}
                goggles={i ? "down" : "up"}
                className="absolute"
                style={
                  {
                    ...HAMSTER_IN_WHEEL.style,
                    ["--ham-delay"]: i ? "-3.1s" : "-6.4s",
                    ["--ham-cycle"]: "0.16s",
                    ["--legphase"]: t / 0.16,
                  } as CSSProperties
                }
              />
            </Wheel>
          </div>
        ))}

        {/* halo behind the main wheel */}
        <div
          style={{
            position: "absolute",
            left: L.cx - W * 0.95,
            top: L.cy - W * 0.95,
            width: W * 1.9,
            height: W * 1.9,
            borderRadius: "50%",
            opacity: halo,
            transform: `scale(${0.9 + sp * 0.2})`,
            background:
              "radial-gradient(circle, rgb(255 250 240 / 0.95) 0%, rgb(255 220 170 / 0.75) 14%, rgb(255 159 67 / 0.38) 32%, rgb(255 159 67 / 0.08) 52%, transparent 66%)",
          }}
        />

        {/* outro particle ring */}
        {f >= OUTRO && (
          <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0 }}>
            {Array.from({ length: 56 }, (_, i) => {
              const a = (i / 56) * Math.PI * 2 + t * 0.45;
              const rr = W * (0.74 + 0.04 * Math.sin(i * 3.1 + t * 2));
              const k = pop(f, OUTRO + 2 + (i % 8));
              return (
                <circle
                  key={i}
                  cx={L.cx + Math.cos(a) * rr * k}
                  cy={L.cy + Math.sin(a) * rr * k}
                  r={2 + 2.5 * random(`rg${i}`)}
                  fill={i % 4 ? "#ffd9a8" : "#3DFF8A"}
                  opacity={(0.5 + 0.5 * Math.sin(t * 4 + i)) * clamp(k)}
                  style={{ filter: "drop-shadow(0 0 6px #ff9f43)" }}
                />
              );
            })}
          </svg>
        )}

        {/* the wheel + the hamster */}
        <div style={{ position: "absolute", left: L.cx - W / 2, top: L.top, width: W }}>
          <Wheel angle={ANGLE[f] % 360} glow={f >= drop.plug ? 0.35 + sp * 0.5 : 0} dead={f < drop.plug && f < T.scenes[1][0]}>
            {hamState && (
              <Hamster
                state={hamState}
                gogglesT={f < drop.goggles ? 0 : f < run2.start || f >= OUTRO ? Math.min(1.1, pop(f, drop.goggles)) : 1}
                look={f >= drop.land + 2 && f < drop.goggles ? { x: -2.4, y: 1.8 } : undefined}
                cableTo={plugged ? HAMSTER_IN_WHEEL.cableTo : undefined}
                cableLoose={f < drop.plug}
                className="absolute"
                style={
                  {
                    ...HAMSTER_IN_WHEEL.style,
                    transformOrigin: "50% 80%",
                    transform: `translate(${hx}px, ${hy}px) rotate(${hrot}deg) scale(${hsx}, ${hsy})`,
                    ["--ham-cycle"]: `${(0.34 - Math.min(1, sp) * 0.25).toFixed(3)}s`,
                    ["--legphase"]: LEGPHASE[f],
                  } as CSSProperties
                }
              />
            )}
            {/* sweat drop */}
            {f >= drop.land + 6 && f < drop.goggles + 4 && (
              <svg
                viewBox="0 0 20 30"
                style={{
                  position: "absolute",
                  left: `${25 + (150 / 240) * 50}%`,
                  top: `${52.4 + (66 / 200) * 41.67}%`,
                  width: W * 0.05,
                  transform: `translateY(${clamp((f - drop.land - 6) / 18) * W * 0.06}px) scale(${pop(f, drop.land + 6)})`,
                  overflow: "visible",
                }}
              >
                <path d="M10 1 C14 10 18 15 18 20 A8 8 0 0 1 2 20 C2 15 6 10 10 1Z" fill="#8fd8ff" stroke="#1b0f07" strokeWidth="2.5" />
                <path d="M6 19 a4 4 0 0 0 3 5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </Wheel>
        </div>

        {/* spotlight (scene 2–3) */}
        {spotOn > 0 && (
          <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0, opacity: spotFade }}>
            <defs>
              <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff6e0" stopOpacity="0.5" />
                <stop offset="1" stopColor="#fff6e0" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <polygon
              points={`${L.cx - 40},-10 ${L.cx + 40},-10 ${L.cx + W * 0.62},${L.floor} ${L.cx - W * 0.62},${L.floor}`}
              fill="url(#beam)"
              style={{ transformOrigin: `${L.cx}px 0px`, transform: `scaleY(${spotFall})` }}
            />
            <ellipse cx={L.cx} cy={L.floor} rx={W * 0.65} ry={W * 0.08} fill="#fff6e0" opacity={0.22 * spotFall} />
          </svg>
        )}

        {/* darkness with a hole where the spotlight is */}
        {dark > 0 && (
          <AbsoluteFill
            style={{
              background: spotOn
                ? `radial-gradient(${W * 0.7}px ${W * 0.75}px at ${L.cx}px ${L.cy}px, rgb(2 2 4 / ${dark * 0.15}), rgb(2 2 4 / ${dark}) 100%)`
                : `rgb(2 2 4 / ${dark})`,
            }}
          />
        )}

        {/* particles */}
        <svg width={L.W} height={L.H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <radialGradient id="coin" cx="38%" cy="32%" r="70%">
              <stop offset="0" stopColor="#fff6b8" />
              <stop offset="0.45" stopColor="#FFE14D" />
              <stop offset="1" stopColor="#c98a00" />
            </radialGradient>
            <radialGradient id="smoke">
              <stop offset="0" stopColor="#787087" stopOpacity="0.6" />
              <stop offset="1" stopColor="#787087" stopOpacity="0" />
            </radialGradient>
          </defs>
          <Smoke ps={smoke} />
          <Sparks ps={sparks} />
          <Coins ps={coins} />
        </svg>

        {/* gauge */}
        {f >= run1.start - 2 && f < OUTRO && (
          <div
            style={{
              position: "absolute",
              left: L.gauge.x - L.gauge.w / 2,
              top: L.gauge.y,
              width: L.gauge.w,
              transform: `scale(${0.6 + 0.4 * pop(f, run1.start - 2)})`,
              transformOrigin: "50% 100%",
            }}
          >
            <Voltmeter
              className="w-full"
              needle={needle(f)}
              label={`${readout(f).toFixed(2)}x`}
              tone={f >= run1.overheat && f < run2.start ? "hot" : md === "running" || md === "win" ? "pump" : "idle"}
            />
          </div>
        )}

        {/* score pops */}
        {POPS.map((p) => {
          const age = f - p.at;
          if (age < 0 || age > 26) return null;
          const s = pop(f, p.at, { damping: 9, stiffness: 300 });
          return (
            <div
              key={p.text}
              style={{
                position: "absolute",
                left: L.cx - W * 0.62,
                top: L.top + W * 0.3 - age * 5,
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 800,
                fontSize: 64,
                color: "#3DFF8A",
                textShadow: "0 0 24px rgb(61 255 138 / 0.7)",
                transform: `scale(${0.5 + 0.5 * s}) rotate(-6deg)`,
                opacity: age > 22 ? (26 - age) / 4 : 1,
              }}
            >
              {p.text}
            </div>
          );
        })}

        {/* big win number */}
        {md === "win" && (
          <div
            style={{
              position: "absolute",
              ...(L.portrait ? { left: 0, right: 0, top: L.floor + 60, textAlign: "center" } : { left: L.W * 0.08, width: L.W * 0.3, top: L.top + W * 0.18, textAlign: "center" }),
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 800,
              fontSize: L.portrait ? 240 : 210,
              lineHeight: 1,
              color: "#3DFF8A",
              textShadow: "0 0 40px rgb(61 255 138 / 0.75), 0 0 90px rgb(61 255 138 / 0.35)",
              transform: `scale(${0.4 + 0.6 * pop(f, run2.release + 1, { damping: 8, stiffness: 260 })})`,
            }}
          >
            {Math.round(RELEASE_M)}x
          </div>
        )}
      </AbsoluteFill>

      {/* flashes */}
      <AbsoluteFill style={{ background: "#fff", opacity: 0.18 * clamp(1 - (f - drop.plug) / 6) * (f >= drop.plug ? 1 : 0) }} />
      <AbsoluteFill style={{ background: "#FF3B5C", opacity: 0.7 * clamp(1 - (f - run1.crash) / 10) * (f >= run1.crash ? 1 : 0) }} />
      <AbsoluteFill style={{ background: "#ffe9c4", opacity: 0.6 * clamp(1 - (f - run2.release) / 12) * (f >= run2.release ? 1 : 0) }} />

      {/* ---------- one line of text per scene ---------- */}
      {title && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: L.textY,
            display: "flex",
            justifyContent: "center",
            opacity: titleOut,
            transform: `scale(${0.96 + 0.04 * titleOut})`,
          }}
        >
          <Weld key={sc} text={title.text} tone={title.tone} start={T.scenes[sc][0] + 2} size={L.textSize} />
        </div>
      )}

      {/* ---------- outro ---------- */}
      {f >= OUTRO && (
        <div style={{ position: "absolute", left: 0, right: 0, top: L.floor + (L.portrait ? 60 : 28), display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Weld text="$watt" logo start={OUTRO + 6} size={L.portrait ? 290 : 220} step={2.4} />
          {[
            { text: "he runs. solana stays up.", at: OUTRO + 26, size: L.portrait ? 44 : 38, color: "rgb(236 232 244 / 0.8)", weight: 600 },
            { text: "a game on solana · play free", at: OUTRO + 34, size: L.portrait ? 30 : 26, color: "#8d879c", weight: 500 },
          ].map((l) => {
            const s = pop(f, l.at);
            return (
              <p
                key={l.text}
                style={{
                  margin: 0,
                  marginTop: L.portrait ? 18 : 12,
                  fontSize: l.size,
                  fontWeight: l.weight,
                  color: l.color,
                  opacity: clamp(s * 1.5),
                  transform: `translateY(${(1 - s) * 24}px)`,
                }}
              >
                {l.text}
              </p>
            );
          })}
        </div>
      )}

      <Soundtrack />
    </AbsoluteFill>
  );
}

/* ---------------- audio ---------------- */

const SFX: { at: number; src: string; volume?: number }[] = [
  // titles get welded
  ...T.scenes.slice(0, 6).map(([a]) => ({ at: a + 2, src: "sizzle.wav", volume: 0.5 })),
  { at: OUTRO + 6, src: "sizzle.wav", volume: 0.7 },
  // 1. solana goes down
  { at: 22, src: "spark.wav", volume: 0.6 },
  { at: 46, src: "spark.wav", volume: 0.7 },
  { at: 58, src: "powerdown.wav", volume: 0.9 },
  // 2. spotlight
  { at: 96, src: "clack.wav", volume: 0.9 },
  // 3. meet the hamster
  { at: drop.land, src: "thud.wav", volume: 1 },
  { at: drop.goggles + 4, src: "clack.wav", volume: 0.6 },
  { at: drop.plug, src: "crack.wav", volume: 0.8 },
  // 4–5. first run: motor, ticks, red-zone buzz, then the crash
  { at: run1.start, src: "motor1.wav", volume: 1 },
  { at: run1.crash, src: "crack.wav", volume: 1 },
  { at: run1.crash, src: "powerdown.wav", volume: 0.9 },
  { at: run1.land, src: "thud.wav", volume: 0.9 },
  { at: run1.popUp, src: "clack.wav", volume: 0.6 },
  // 6. clean run, release, get paid
  { at: run2.start, src: "motor2.wav", volume: 1 },
  { at: run2.release, src: "clack.wav", volume: 1 },
  { at: run2.release + 4, src: "coins.wav", volume: 1 },
  { at: run2.release + 8, src: "jingle.wav", volume: 0.8 },
];

function Soundtrack() {
  return (
    <>
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.at} layout="none">
          <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume ?? 1} />
        </Sequence>
      ))}
    </>
  );
}
