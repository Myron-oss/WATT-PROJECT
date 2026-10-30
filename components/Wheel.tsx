"use client";

import { forwardRef, type ReactNode } from "react";

type Props = {
  /** seconds per revolution for CSS spinning; omit to drive rotation yourself through the ref */
  spin?: number;
  /** 0..1 glow strength */
  glow?: number;
  /** dims the wheel to a dead, unlit silhouette */
  dead?: boolean;
  /** hide the whole frame (hamster stays) */
  hidden?: boolean;
  glowRef?: React.Ref<HTMLDivElement>;
  className?: string;
  children?: ReactNode;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const polar = (a: number, r: number) => [r2(200 + Math.cos(a) * r), r2(200 + Math.sin(a) * r)];
const RUNGS = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2;
  return [...polar(a, 171), ...polar(a, 185)];
});
const SPOKES = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
  return [...polar(a, 26), ...polar(a, 168)];
});

/** Glowing hamster wheel. The rotor is its own <svg> so rotating it is a composite-only transform. */
export const Wheel = forwardRef<SVGSVGElement, Props>(function Wheel(
  { spin, glow = 0.6, dead, hidden, glowRef, className, children },
  rotorRef,
) {
  const frameOpacity = hidden ? 0 : dead ? 0.35 : 1;
  return (
    <div className={`relative aspect-square ${className ?? ""}`}>
      <div
        ref={glowRef}
        className="wheel-glow absolute inset-[3.5%]"
        style={{ opacity: hidden || dead ? 0 : glow }}
        aria-hidden
      />

      {/* stand */}
      <svg viewBox="0 0 400 400" className="wheel-part absolute inset-0 overflow-visible" style={{ opacity: frameOpacity }} aria-hidden>
        <g strokeLinecap="round">
          <path d="M200 200 L112 424 M200 200 L288 424" stroke="#07060a" strokeWidth="20" />
          <path d="M200 200 L112 424 M200 200 L288 424" stroke="#221d2e" strokeWidth="11" />
          <path d="M84 426 L316 426" stroke="#07060a" strokeWidth="16" />
          <path d="M84 426 L316 426" stroke="#2a2438" strokeWidth="8" />
        </g>
      </svg>

      {/* rotor */}
      <svg
        ref={rotorRef}
        viewBox="0 0 400 400"
        className="wheel-rotor wheel-part absolute inset-0"
        style={{
          opacity: frameOpacity,
          animation: spin ? `spin ${spin}s linear infinite` : undefined,
        }}
        aria-hidden
      >
        <g fill="none">
          {SPOKES.map(([x1, y1, x2, y2], i) => (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b0a10" strokeWidth="9" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2338" strokeWidth="4" />
            </g>
          ))}
          <circle cx="200" cy="200" r="186" stroke="#0b0a10" strokeWidth="18" />
          <circle cx="200" cy="200" r="186" stroke="#262033" strokeWidth="11" />
          <circle cx="200" cy="200" r="170" stroke="#0b0a10" strokeWidth="7" />
          <circle cx="200" cy="200" r="170" stroke="#332b47" strokeWidth="3.5" />
          {RUNGS.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i % 10 === 0 ? "#b79cff" : "#4a4160"}
              strokeWidth={i % 10 === 0 ? 4 : 3}
              strokeLinecap="round"
            />
          ))}
          <circle cx="200" cy="200" r="193" stroke="#8B5CF6" strokeWidth="2.5" opacity={dead ? 0.2 : 0.95} />
          <circle cx="200" cy="200" r="166" stroke="#8B5CF6" strokeWidth="1.2" opacity={dead ? 0.1 : 0.5} />
        </g>
      </svg>

      {/* hub */}
      <svg viewBox="0 0 400 400" className="wheel-part absolute inset-0" style={{ opacity: frameOpacity }} aria-hidden>
        <circle cx="200" cy="200" r="28" fill="#15121d" stroke="#07060a" strokeWidth="6" />
        <circle cx="200" cy="200" r="28" fill="none" stroke="#3d3550" strokeWidth="2.5" />
        <circle cx="200" cy="200" r="11" fill={dead ? "#2a2238" : "#8B5CF6"} />
        <circle cx="200" cy="200" r="5" fill={dead ? "#3a3048" : "#e7dcff"} />
      </svg>

      {children}
    </div>
  );
});

/**
 * Where the hamster sits inside a Wheel: bottom-centre, feet on the track.
 * Cable target is the hub, expressed in the hamster's own viewBox.
 */
export const HAMSTER_IN_WHEEL = {
  style: { left: "25%", top: "52.4%", width: "50%" } as React.CSSProperties,
  cableTo: { x: 120, y: -12 },
};
