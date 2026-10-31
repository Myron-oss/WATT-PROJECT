import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, random } from "remotion";
import { Hamster, type HamsterState } from "../components/Hamster";
import { Wheel, HAMSTER_IN_WHEEL } from "../components/Wheel";
import { Voltmeter } from "../components/hero/Voltmeter";
import { needleAngle } from "../components/hero/Voltmeter";
import { Weld } from "./Weld";

/**
 * X / Twitter brand stills, built from the site's own hamster, wheel, gauge and fonts.
 *   Avatar  400×400 (rendered 2×) — shown as a circle
 *   Banner 1500×500 (rendered 2×) — avatar overlaps the bottom-left, phones crop top/bottom
 */

const FONTS = {
  ["--font-stencil" as string]: '"Big Shoulders Stencil", sans-serif',
  ["--font-saira" as string]: '"Saira Stencil One", sans-serif',
  ["--font-manrope" as string]: '"Manrope", sans-serif',
  ["--font-jetbrains" as string]: '"JetBrains Mono", monospace',
  ["--clock" as string]: 1.3,
} as CSSProperties;

function Canvas({ w, h, scale, children }: { w: number; h: number; scale: number; children: ReactNode }) {
  return (
    <AbsoluteFill className="vclock" style={{ ...FONTS, background: "#0A0A0F", overflow: "hidden" }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}

function Ham({ state = "idle", style, phase = 0.3 }: { state?: HamsterState; style?: CSSProperties; phase?: number }) {
  return (
    <Hamster
      state={state}
      goggles="up"
      cableTo={state === "running" ? HAMSTER_IN_WHEEL.cableTo : undefined}
      className="absolute"
      style={
        {
          ...HAMSTER_IN_WHEEL.style,
          ["--ham-cycle"]: "0.2s",
          ["--legphase"]: phase,
          ...style,
        } as CSSProperties
      }
    />
  );
}

function Dust({ w, h, n, seed }: { w: number; h: number; n: number; seed: string }) {
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => (
        <circle
          key={i}
          cx={random(`${seed}x${i}`) * w}
          cy={random(`${seed}y${i}`) * h}
          r={0.6 + random(`${seed}r${i}`) * 1.6}
          fill={i % 3 ? "#ffd9a8" : "#b89cff"}
          opacity={0.25 + random(`${seed}o${i}`) * 0.5}
        />
      ))}
    </svg>
  );
}

function Coin({ x, y, r, tilt = 1, rot = 0 }: { x: number; y: number; r: number; tilt?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${tilt} 1)`}>
      <circle r={r} fill="#1b0f07" />
      <circle r={r * 0.86} fill="url(#bcoin)" />
      <circle r={r * 0.56} fill="none" stroke="#a87200" strokeWidth={r * 0.1} />
      <path
        d={`M${r * 0.08} ${-r * 0.5} L${-r * 0.28} ${r * 0.06} H${r * 0.02} L${-r * 0.08} ${r * 0.5} L${r * 0.3} ${-r * 0.06} H${r * 0.0} Z`}
        fill="#a87200"
      />
    </g>
  );
}

const CoinDefs = () => (
  <defs>
    <radialGradient id="bcoin" cx="38%" cy="32%" r="70%">
      <stop offset="0" stopColor="#fff6b8" />
      <stop offset="0.45" stopColor="#FFE14D" />
      <stop offset="1" stopColor="#c98a00" />
    </radialGradient>
  </defs>
);

/* ---------------- avatar ---------------- */

export function Avatar() {
  const S = 400;
  return (
    <Canvas w={S} h={S} scale={2.5}>
      {/* deep background + violet room glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 70% at 50% 45%, #1c1430 0%, #0b0912 60%, #07060a 100%)" }} />
      <Dust w={S} h={S} n={40} seed="av" />
      {/* the moon halo */}
      <div
        style={{
          position: "absolute",
          left: S * 0.5 - 190,
          top: S * 0.5 - 190,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgb(255 250 240 / 0.95) 0%, rgb(255 220 170 / 0.8) 16%, rgb(255 159 67 / 0.45) 34%, rgb(255 159 67 / 0.1) 55%, transparent 68%)",
        }}
      />
      {/* the wheel as the round frame */}
      <div style={{ position: "absolute", left: 12, top: 12, width: S - 24 }}>
        <Wheel angle={8} glow={0.9} />
      </div>
      {/* big hamster, centred in the circle */}
      <div style={{ position: "absolute", left: S * 0.5 - 168, top: S * 0.5 - 116, width: 316, height: 264 }}>
        <Hamster state="idle" goggles="up" className="absolute inset-0" style={{ width: "100%", ["--ham-delay" as string]: "-0.2s" }} />
      </div>
      <svg width={S} height={S} style={{ position: "absolute", inset: 0 }}>
        <CoinDefs />
        <Coin x={72} y={286} r={17} tilt={0.85} rot={-12} />
        <Coin x={330} y={110} r={13} tilt={0.5} rot={20} />
        <Coin x={318} y={300} r={10} tilt={0.95} />
        {/* sparks */}
        {[
          [96, 104, -40],
          [104, 92, -70],
          [340, 196, -20],
        ].map(([x, y, a], i) => (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + Math.cos((a * Math.PI) / 180) * 16}
            y2={y + Math.sin((a * Math.PI) / 180) * 16}
            stroke="#ffe28c"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 4px #ff9f43)" }}
          />
        ))}
      </svg>
    </Canvas>
  );
}

/* ---------------- banner ---------------- */

export function Banner() {
  const W = 1500;
  const H = 500;
  const floor = 430;
  const wheel = 360;
  const wx = 1060; // wheel centre x
  const racks = Array.from({ length: 11 }, (_, i) => {
    const h = 210 + random(`bh${i}`) * 170;
    return { x: 16 + i * 136, w: 120, h, rows: Math.round(h / 34) };
  });
  return (
    <Canvas w={W} h={H} scale={2}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(45% 80% at 70% 45%, rgb(139 92 246 / 0.22), transparent 70%), linear-gradient(180deg, #060509, #0d0a10 70%, #09070b)",
        }}
      />
      {/* server racks with lit LEDs */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        {racks.map((r, ri) => (
          <div
            key={ri}
            style={{
              position: "absolute",
              left: r.x,
              width: r.w,
              top: floor - r.h,
              height: r.h,
              borderRadius: "10px 10px 3px 3px",
              background: "linear-gradient(180deg, #100e16, #0a0910)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.04), 0 0 0 4px rgb(30 22 28 / 0.5)",
            }}
          >
            {Array.from({ length: r.rows }, (_, i) => {
              const lit = random(`bl${ri}-${i}`) < 0.55 + (ri > 5 ? 0.25 : 0);
              const c = lit ? "#3DFF8A" : "#8B5CF6";
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "12%",
                    width: "62%",
                    top: r.h - (i + 0.6) * (r.h / r.rows) - 3,
                    height: 6,
                    opacity: lit ? 0.95 : 0.35,
                    background: `radial-gradient(circle, ${c} 0 1.6px, transparent 2.4px) 0 50% / 9px 100% repeat-x`,
                    filter: lit ? `drop-shadow(0 0 3px ${c})` : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* darken behind the text so it reads */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgb(7 6 10 / 0.92) 0%, rgb(7 6 10 / 0.75) 45%, rgb(7 6 10 / 0) 68%)" }} />

      {/* floor */}
      <div style={{ position: "absolute", left: 0, right: 0, top: floor, bottom: 0, background: "linear-gradient(180deg, rgb(16 12 20 / 0.96), #07060a)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: floor - 1,
          height: 2,
          background: "linear-gradient(90deg, transparent, #3DFF8A 40%, #3DFF8A 85%, transparent)",
          boxShadow: "0 0 18px 3px rgb(61 255 138 / 0.5)",
        }}
      />
      <Dust w={W} h={H} n={90} seed="bn" />

      {/* halo + running hamster in the wheel */}
      <div
        style={{
          position: "absolute",
          left: wx - wheel * 0.95,
          top: floor - wheel * 1.065 + wheel / 2 - wheel * 0.95,
          width: wheel * 1.9,
          height: wheel * 1.9,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgb(255 250 240 / 0.95) 0%, rgb(255 220 170 / 0.75) 14%, rgb(255 159 67 / 0.4) 32%, rgb(255 159 67 / 0.08) 52%, transparent 66%)",
        }}
      />
      <div style={{ position: "absolute", left: wx - wheel / 2, top: floor - wheel * 1.065, width: wheel }}>
        <Wheel angle={22} glow={0.95}>
          <Ham state="running" phase={0.32} />
        </Wheel>
      </div>

      {/* gauge */}
      <div style={{ position: "absolute", left: 1282, top: 92, width: 186, transform: "rotate(3deg)" }}>
        <Voltmeter className="w-full" needle={needleAngle(87) + 1} label="87.00x" tone="pump" />
      </div>

      {/* coins + sparks off the track */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <CoinDefs />
        <Coin x={845} y={150} r={16} tilt={0.6} rot={-15} />
        <Coin x={880} y={86} r={11} tilt={0.95} />
        <Coin x={1268} y={300} r={13} tilt={0.4} rot={25} />
        <Coin x={1312} y={385} r={18} tilt={0.9} rot={-8} />
        {Array.from({ length: 22 }, (_, i) => {
          const a = Math.PI * (0.78 + random(`sa${i}`) * 0.2);
          const d = 30 + random(`sd${i}`) * 120;
          const x0 = wx - wheel * 0.16 + Math.cos(a) * d;
          const y0 = floor - 24 + Math.sin(a) * d * 0.8;
          const c = ["#ffffff", "#ffe28c", "#ff9f43"][i % 3];
          return (
            <line
              key={i}
              x1={x0}
              y1={y0}
              x2={x0 + Math.cos(a) * 12}
              y2={y0 + Math.sin(a) * 9}
              stroke={c}
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.9}
              style={{ filter: "drop-shadow(0 0 3px #ff9f43)" }}
            />
          );
        })}
      </svg>

      {/* copy — kept clear of the avatar (bottom-left) and of phone crops (top/bottom) */}
      <div style={{ position: "absolute", left: 330, top: 86, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <Weld text="$watt" logo start={-500} size={150} />
        <p style={{ margin: "6px 0 0 6px", fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 30, color: "#ece8f4" }}>
          he runs. <span style={{ color: "#3DFF8A", textShadow: "0 0 18px rgb(61 255 138 / 0.6)" }}>solana stays up.</span>
        </p>
        <div style={{ display: "flex", gap: 8, margin: "18px 0 0 6px" }}>
          {[
            { t: "hold to pump", c: "#3DFF8A" },
            { t: "weekly sol prizes", c: "#FFE14D" },
            { t: "pump.fun", c: "#8B5CF6" },
          ].map((p) => (
            <span
              key={p.t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgb(255 255 255 / 0.12)",
                background: "rgb(20 17 28 / 0.75)",
                fontFamily: "Manrope, sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: "rgb(236 232 244 / 0.85)",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 9, background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
              {p.t}
            </span>
          ))}
        </div>
      </div>
    </Canvas>
  );
}
