"use client";

import { forwardRef, useEffect, useId, useRef, type CSSProperties } from "react";

export type HamsterState = "idle" | "running" | "overheat" | "win" | "knocked" | "wave";

type Point = { x: number; y: number };

type Props = {
  state?: HamsterState;
  /** 0..1, only used in "running" — maps to leg cycle speed */
  speed?: number;
  goggles?: "up" | "down";
  /** where the cable from his back plugs in, in the hamster's own viewBox units (240×200) */
  cableTo?: Point;
  /** cable lies unplugged on the floor instead */
  cableLoose?: boolean;
  /** pupils track the pointer */
  follow?: boolean;
  className?: string;
  style?: CSSProperties;
};

const OL = "#1b0f07";
const FUR = "#FF9F43";
const FUR_DARK = "#d9792a";
const CREAM = "#FFE2BF";

export const legCycle = (speed: number) => 0.34 - Math.min(1, Math.max(0, speed)) * 0.25;

const BODY =
  "M46 138 C40 96 78 70 120 68 C150 52 196 56 212 92 C224 118 214 150 196 166 C176 184 120 186 86 180 C60 176 48 160 46 138 Z";

const EYES = [
  { x: 175, y: 106, r: 10 },
  { x: 205, y: 102, r: 8 },
];

/**
 * The $watt hamster. Pure SVG, states are CSS (see globals.css `.ham`).
 * Forward the ref to reach the root <svg> (e.g. to set --ham-cycle without re-rendering).
 */
export const Hamster = forwardRef<SVGSVGElement, Props>(function Hamster(
  { state = "idle", speed = 0.5, goggles = "up", cableTo, cableLoose, follow, className, style },
  ref,
) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pupilsRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!follow) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      const svg = svgRef.current;
      const g = pupilsRef.current;
      if (!svg || !g) return;
      const r = svg.getBoundingClientRect();
      const ex = r.left + (190 / 240) * r.width;
      const ey = r.top + (102 / 200) * r.height;
      const dx = px - ex;
      const dy = py - ey;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 220) * 2.6;
      g.setAttribute("transform", `translate(${((dx / d) * k).toFixed(2)} ${((dy / d) * k).toFixed(2)})`);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [follow]);

  const setRefs = (el: SVGSVGElement | null) => {
    svgRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const eyeMode = state === "knocked" ? "spiral" : state === "win" || state === "wave" ? "happy" : "open";
  const hot = state === "overheat";
  const showCable = (cableTo || cableLoose) && state !== "win" && state !== "knocked";

  const cablePath = cableTo
    ? `M60 112 C 30 96, ${cableTo.x - 60} ${cableTo.y + 70}, ${cableTo.x} ${cableTo.y}`
    : "M58 118 C 30 128, 22 186, -4 188 S -40 186, -52 186";
  const plug = cableTo ?? { x: -52, y: 186 };

  return (
    <svg
      ref={setRefs}
      viewBox="0 0 240 200"
      className={`ham ${className ?? ""}`}
      data-state={state}
      style={{ ["--ham-cycle" as string]: `${legCycle(speed)}s`, ...style }}
      aria-hidden
    >
      <defs>
        <clipPath id={`body-${uid}`}>
          <path d={BODY} />
        </clipPath>
        <radialGradient id={`glass-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#d9c8ff" />
          <stop offset="0.35" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#2a1660" />
        </radialGradient>
        <radialGradient id={`shade-${uid}`} cx="70%" cy="30%" r="85%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#7a2c00" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id={`heat-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FF3B5C" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF3B5C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* coin stack he rides on when winning */}
      <g className="ham-coins">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} transform={`translate(${116 + (i % 2 ? 5 : -4)} ${226 - i * 9})`}>
            <ellipse rx="34" ry="9" cy="4" fill="#9a6a00" stroke={OL} strokeWidth="3" />
            <ellipse rx="34" ry="9" fill="#FFE14D" stroke={OL} strokeWidth="3" />
            <ellipse rx="22" ry="5" fill="none" stroke="#c99a00" strokeWidth="2" />
          </g>
        ))}
      </g>

      {/* cable: back → wheel hub */}
      {(cableTo || cableLoose) && (
        <g className="ham-cable" style={{ opacity: showCable ? 1 : 0 }}>
          <path d={cablePath} fill="none" stroke={OL} strokeWidth="9" strokeLinecap="round" />
          <path d={cablePath} fill="none" stroke="#2c2640" strokeWidth="5" strokeLinecap="round" />
          <path
            className="ham-current"
            d={cablePath}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={cableTo ? 0.95 : 0.25}
          />
          <g transform={`translate(${plug.x} ${plug.y}) rotate(${cableTo ? -60 : 0})`}>
            <rect x="-7" y="-6" width="14" height="12" rx="3" fill="#3a3347" stroke={OL} strokeWidth="3" />
            <rect x="7" y="-4" width="5" height="2.5" fill="#c7c0d6" />
            <rect x="7" y="1.5" width="5" height="2.5" fill="#c7c0d6" />
          </g>
        </g>
      )}

      <g className="ham-root">
        <g className="ham-body">
          {/* far legs */}
          <g className="ham-leg ham-leg-b2">
            <rect x="100" y="150" width="22" height="40" rx="11" fill={FUR_DARK} stroke={OL} strokeWidth="5" />
          </g>
          <g className="ham-leg ham-leg-f2">
            <rect x="182" y="146" width="18" height="40" rx="9" fill={FUR_DARK} stroke={OL} strokeWidth="5" />
          </g>

          {/* far raised arm (win) sits behind the head */}
          <g className="ham-arm">
            <path d="M196 120 C208 100 216 80 224 56" fill="none" stroke={OL} strokeWidth="17" strokeLinecap="round" />
            <path d="M196 120 C208 100 216 80 224 56" fill="none" stroke={FUR_DARK} strokeWidth="9" strokeLinecap="round" />
            <circle cx="225" cy="52" r="9" fill={FUR_DARK} stroke={OL} strokeWidth="4" />
          </g>

          {/* tail + far ear */}
          <ellipse cx="46" cy="132" rx="9" ry="7" fill={FUR} stroke={OL} strokeWidth="5" />
          <g>
            <ellipse cx="190" cy="60" rx="13" ry="14" fill={FUR_DARK} stroke={OL} strokeWidth="5" />
          </g>

          {/* near legs */}
          <g className="ham-leg ham-leg-b1">
            <rect x="80" y="150" width="26" height="42" rx="13" fill={FUR} stroke={OL} strokeWidth="5" />
            <ellipse cx="93" cy="188" rx="9" ry="3" fill="#ffb3a1" />
          </g>
          <g className="ham-leg ham-leg-f1">
            <rect x="162" y="148" width="20" height="40" rx="10" fill={FUR} stroke={OL} strokeWidth="5" />
          </g>

          {/* body */}
          <path d={BODY} fill={FUR} stroke={OL} strokeWidth="5.5" strokeLinejoin="round" />
          <g clipPath={`url(#body-${uid})`}>
            <ellipse cx="160" cy="170" rx="58" ry="30" fill={CREAM} />
            <path d={BODY} fill={`url(#shade-${uid})`} />
            <path d="M74 88 C96 72 128 66 150 70" stroke="#ffc58a" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.8" />
            {hot && <ellipse cx="140" cy="110" rx="110" ry="80" fill={`url(#heat-${uid})`} />}
          </g>
          <path d={BODY} fill="none" stroke={OL} strokeWidth="5.5" strokeLinejoin="round" />

          {/* near ear */}
          <ellipse cx="156" cy="64" rx="15" ry="16" fill={FUR} stroke={OL} strokeWidth="5" />
          <ellipse cx="156" cy="66" rx="7" ry="8" fill="#ff8fa3" />

          {/* cheek pouch stuffed with coins */}
          <circle cx="190" cy="140" r="21" fill={FUR} stroke={OL} strokeWidth="5" />
          <circle cx="190" cy="140" r="14" fill="#ffb066" opacity="0.6" />
          <g stroke="#7a5200" strokeWidth="2.5">
            <circle cx="210" cy="140" r="7.5" fill="#FFE14D" />
            <circle cx="201" cy="152" r="7" fill="#FFE14D" />
            <path d="M207 137 l4 0" stroke="#fff6c2" strokeWidth="2" />
          </g>

          {/* face */}
          <ellipse cx="219" cy="112" rx="6" ry="4.6" fill="#ff6b8a" stroke={OL} strokeWidth="3" />
          <path d="M216 121 q-4 6 -10 3" fill="none" stroke={OL} strokeWidth="3" strokeLinecap="round" />
          {/* yawn (idle, now and then) */}
          <g className="ham-yawn">
            <ellipse cx="211" cy="125" rx="6.5" ry="8.5" fill="#3a0d12" stroke={OL} strokeWidth="2.5" />
            <ellipse cx="211" cy="130" rx="4" ry="2.6" fill="#ff7c93" />
          </g>
          <g stroke={OL} strokeWidth="1.6" opacity="0.65" strokeLinecap="round">
            <path d="M222 116 L240 110" />
            <path d="M222 119 L241 121" />
          </g>

          {/* eyes */}
          {eyeMode === "open" &&
            EYES.map((e, i) => (
              <g key={i}>
                {hot && <circle cx={e.x} cy={e.y} r={e.r + 7} fill={`url(#heat-${uid})`} />}
                <circle cx={e.x} cy={e.y} r={e.r} fill={hot ? "#FF3B5C" : OL} />
              </g>
            ))}
          {eyeMode === "open" && (
            <g ref={pupilsRef}>
              {EYES.map((e, i) => (
                <g key={i}>
                  <circle cx={e.x + 1.8} cy={e.y - 2.4} r={e.r * 0.34} fill="#fff" />
                  <circle cx={e.x - 2} cy={e.y + 2.4} r={e.r * 0.14} fill="#fff" opacity="0.7" />
                </g>
              ))}
            </g>
          )}
          {eyeMode === "open" &&
            EYES.map((e, i) => (
              <ellipse key={i} className="ham-lid" cx={e.x} cy={e.y} rx={e.r + 2.5} ry={e.r + 2.5} fill={FUR} stroke={OL} strokeWidth="2.5" />
            ))}
          {eyeMode === "happy" &&
            EYES.map((e, i) => (
              <path
                key={i}
                d={`M${e.x - e.r} ${e.y + 2} Q${e.x} ${e.y - e.r - 3} ${e.x + e.r} ${e.y + 2}`}
                fill="none"
                stroke={OL}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
          {eyeMode === "spiral" &&
            EYES.map((e, i) => (
              <g key={i} transform={`translate(${e.x} ${e.y})`}>
                <path
                  className="ham-spiral"
                  d="M0 0 m0 -1 a1 1 0 1 1 -1 1 a2.5 2.5 0 1 1 2.5 2.5 a4 4 0 1 1 -4 -4 a5.5 5.5 0 1 1 5.5 5.5"
                  fill="none"
                  stroke={OL}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            ))}

          {/* welding goggles */}
          <g className="ham-goggles" data-down={goggles === "down"}>
            <path d="M126 92 Q168 64 220 82" fill="none" stroke={OL} strokeWidth="14" strokeLinecap="round" />
            <path d="M126 92 Q168 64 220 82" fill="none" stroke="#2a2235" strokeWidth="7" strokeLinecap="round" />
            {[
              { x: 175, y: 78, r: 13 },
              { x: 204, y: 75, r: 11 },
            ].map((l, i) => (
              <g key={i}>
                <circle cx={l.x} cy={l.y} r={l.r} fill="#3b3450" stroke={OL} strokeWidth="4" />
                <circle cx={l.x} cy={l.y} r={l.r - 4.5} fill={`url(#glass-${uid})`} />
                <path
                  d={`M${l.x - l.r * 0.45} ${l.y - l.r * 0.1} a${l.r * 0.45} ${l.r * 0.45} 0 0 1 ${l.r * 0.4} -${l.r * 0.32}`}
                  stroke="#fff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              </g>
            ))}
          </g>

          {/* chest paws (hidden while running) */}
          <g className="ham-chestpaws">
            <ellipse className="ham-paw-far" cx="206" cy="166" rx="8" ry="7" fill={FUR_DARK} stroke={OL} strokeWidth="4" />
            <g className="ham-paw-tap ham-paw-near">
              <ellipse cx="188" cy="170" rx="9" ry="7.5" fill={FUR} stroke={OL} strokeWidth="4" />
            </g>
          </g>

          {/* near raised arm (win / wave) */}
          <g className="ham-arm ham-arm-near">
            <path d="M150 138 C140 112 132 84 128 50" fill="none" stroke={OL} strokeWidth="19" strokeLinecap="round" />
            <path d="M150 138 C140 112 132 84 128 50" fill="none" stroke={FUR} strokeWidth="10" strokeLinecap="round" />
            <circle cx="127" cy="46" r="10" fill={FUR} stroke={OL} strokeWidth="4.5" />
          </g>
        </g>

        {/* smoke (overheat) */}
        <g className="ham-smoke" fill="#5b5566">
          <circle cx="168" cy="48" r="9" />
          <circle cx="186" cy="44" r="7" />
          <circle cx="150" cy="52" r="8" />
        </g>
      </g>
    </svg>
  );
});
