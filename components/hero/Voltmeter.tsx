import type { Ref } from "react";

/** Industrial panel voltmeter: log scale 1x → 100x, needle + big mono readout. */

const CX = 130;
const CY = 112;
export const NEEDLE_MIN = -58;
export const NEEDLE_MAX = 58;

const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [r2(CX + Math.sin(a) * r), r2(CY - Math.cos(a) * r)] as const;
};
export const needleAngle = (m: number) =>
  NEEDLE_MIN + (NEEDLE_MAX - NEEDLE_MIN) * Math.min(1, Math.max(0, Math.log(m) / Math.log(100)));

const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
};

const LABELS = [1, 2, 5, 10, 25, 50, 100];
const MINOR = [1.5, 3, 4, 7, 15, 20, 35, 70];

type Props = {
  needleRef?: Ref<SVGSVGElement>;
  numRef?: Ref<HTMLSpanElement>;
  /** frame-driven overrides (video): needle angle in degrees and readout text */
  needle?: number;
  label?: string;
  className?: string;
  tone: "idle" | "pump" | "hot";
};

export function Voltmeter({ needleRef, numRef, tone, needle, label, className }: Props) {
  const numColor = tone === "hot" ? "#FF3B5C" : tone === "pump" ? "#3DFF8A" : "rgb(236 232 244 / 0.55)";
  const numGlow = tone === "hot" ? "0 0 18px rgb(255 59 92 / 0.7)" : tone === "pump" ? "0 0 22px rgb(61 255 138 / 0.6)" : "none";
  return (
    <div className={`relative aspect-[260/170] ${className ?? "w-[min(60vw,25svh,240px)]"}`}>
      <svg viewBox="0 0 260 170" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="vm-bezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3546" />
            <stop offset="0.5" stopColor="#1d1a25" />
            <stop offset="1" stopColor="#0d0c12" />
          </linearGradient>
          <radialGradient id="vm-face" cx="50%" cy="72%" r="75%">
            <stop offset="0" stopColor="#1d1630" />
            <stop offset="1" stopColor="#09080d" />
          </radialGradient>
        </defs>
        <rect x="3" y="3" width="254" height="164" rx="22" fill="url(#vm-bezel)" stroke="#050407" strokeWidth="4" />
        <rect x="14" y="14" width="232" height="142" rx="14" fill="url(#vm-face)" stroke="#050407" strokeWidth="2" />
        {[
          [14, 14],
          [246, 14],
          [14, 156],
          [246, 156],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x === 14 ? 9 : 251} ${y === 14 ? 9 : 161})`}>
            <circle r="3.4" fill="#4a4458" stroke="#050407" strokeWidth="1.2" />
            <path d="M-2 0H2" stroke="#16131c" strokeWidth="1" />
          </g>
        ))}
        {/* scale */}
        <path d={arc(NEEDLE_MIN, NEEDLE_MAX, 88)} stroke="#2e2840" strokeWidth="3" fill="none" />
        <path d={arc(needleAngle(2), needleAngle(10), 88)} stroke="#3DFF8A" strokeOpacity="0.55" strokeWidth="3" fill="none" />
        <path d={arc(needleAngle(10), needleAngle(50), 88)} stroke="#FFE14D" strokeOpacity="0.5" strokeWidth="3" fill="none" />
        <path d={arc(needleAngle(50), NEEDLE_MAX, 88)} stroke="#FF3B5C" strokeOpacity="0.75" strokeWidth="5" fill="none" />
        {MINOR.map((v) => {
          const [x1, y1] = pt(needleAngle(v), 82);
          const [x2, y2] = pt(needleAngle(v), 88);
          return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b6380" strokeWidth="1.2" />;
        })}
        {LABELS.map((v) => {
          const [x1, y1] = pt(needleAngle(v), 78);
          const [x2, y2] = pt(needleAngle(v), 92);
          const [lx, ly] = pt(needleAngle(v), 67);
          return (
            <g key={v}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b9b0cc" strokeWidth="2" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#a39bb5" fontFamily="var(--font-jetbrains), monospace">
                {v}
              </text>
            </g>
          );
        })}
      </svg>

      <span
        ref={numRef}
        className="absolute inset-x-0 top-[71%] text-center font-mono font-bold leading-none tabular-nums transition-colors duration-200"
        style={{ fontSize: "min(9vw, 4.6svh, 40px)", color: numColor, textShadow: numGlow }}
      >
        {label ?? "1.00x"}
      </span>

      {/* needle: own layer, rotated on the compositor */}
      <svg
        ref={needleRef}
        viewBox="0 0 260 170"
        className="absolute inset-0 h-full w-full"
        style={{ transformOrigin: `${(CX / 260) * 100}% ${(CY / 170) * 100}%`, transform: `rotate(${needle ?? NEEDLE_MIN}deg)` }}
        aria-hidden
      >
        <path d={`M${CX - 2.4} ${CY} L${CX} ${CY - 92} L${CX + 2.4} ${CY} Z`} fill="#FF9F43" style={{ filter: "drop-shadow(0 0 4px rgb(255 159 67 / 0.8))" }} />
      </svg>

      {/* pivot cap + glass */}
      <svg viewBox="0 0 260 170" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <circle cx={CX} cy={CY} r="9" fill="#2a2535" stroke="#050407" strokeWidth="2" />
        <circle cx={CX} cy={CY} r="3.5" fill="#FF9F43" />
        <path d="M24 40 Q70 18 150 20" stroke="#fff" strokeOpacity="0.08" strokeWidth="10" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
