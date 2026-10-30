import type { CSSProperties } from "react";

/**
 * The hamster's underground server burrow. Geometry is shared by the static art
 * (<BurrowArt>) and the LED layer (<BurrowLeds>) so the blackout can sit between them.
 * All positions are % of the floor frame (full width, top of hero → floor line).
 */

type Tunnel = { x: number; w: number; h: number; rows: number; ledge?: boolean; seeds: number[] };

export const TUNNELS: Tunnel[] = [
  { x: 1.5, w: 12, h: 64, rows: 7, seeds: [1, 4] },
  { x: 16.5, w: 10.5, h: 42, rows: 4, ledge: true, seeds: [2] },
  { x: 30, w: 12, h: 80, rows: 9, seeds: [0, 5, 7] },
  { x: 58, w: 12, h: 76, rows: 8, seeds: [3, 6] },
  { x: 73, w: 10.5, h: 46, rows: 4, ledge: true, seeds: [1] },
  { x: 86.5, w: 12, h: 66, rows: 7, seeds: [2, 5] },
];

const RACK_TOP = 0.22; // arch takes the top of each tunnel
const RACK_BOTTOM = 0.04;

const rowTop = (t: Tunnel, i: number) => RACK_TOP + ((i + 0.62) / t.rows) * (1 - RACK_TOP - RACK_BOTTOM);
const shelfTop = (t: Tunnel, i: number) => RACK_TOP + ((i + 1) / t.rows) * (1 - RACK_TOP - RACK_BOTTOM);

/** every LED row in the burrow, ordered from the floor up (that's the order they light) */
export const LED_ORDER = TUNNELS.flatMap((t, ti) =>
  Array.from({ length: t.rows }, (_, i) => ({ ti, i, fromFloor: t.h * (1 - rowTop(t, i)), x: t.x })),
)
  .sort((a, b) => a.fromFloor - b.fromFloor || a.x - b.x)
  .map(({ ti, i }) => `${ti}-${i}`);

export const LED_COUNT = LED_ORDER.length;

const tunnelStyle = (t: Tunnel): CSSProperties => ({ left: `${t.x}%`, width: `${t.w}%`, height: `${t.h}%` });

function Seed({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 10 16" className="absolute" style={style} aria-hidden>
      <path d="M5 0.5C9 4 9 11 5 15.5 1 11 1 4 5 0.5Z" fill="#2c2622" stroke="#0d0a08" strokeWidth="1" />
      <path d="M5 2.5Q6.6 8 5.4 14M3.4 3.6Q3.2 8 4 13M6.8 4Q7.4 8 6.6 12" stroke="#cfc6b8" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

export function BurrowArt() {
  return (
    <>
      {TUNNELS.map((t, ti) => (
        <div key={ti} className="tunnel" style={tunnelStyle(t)}>
          {t.ledge && <div className="tunnel-ledge" />}
          {Array.from({ length: t.rows }, (_, i) => (
            <div key={i} className="shelf" style={{ top: `${shelfTop(t, i) * 100}%` }} />
          ))}
          {t.seeds.map((si, k) => (
            <Seed
              key={k}
              style={{
                top: `calc(${shelfTop(t, si) * 100}% - 9px)`,
                right: `${16 + k * 7}%`,
                width: 7,
                height: 11,
                transform: `rotate(${k % 2 ? 70 : -64}deg)`,
              }}
            />
          ))}
        </div>
      ))}

      {/* cables hanging from the ceiling like roots */}
      <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[46%] w-full" aria-hidden>
        <g fill="none" strokeLinecap="round">
          {ROOTS.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="#050407" strokeWidth="7" vectorEffect="non-scaling-stroke" />
              <path d={d} stroke="#1f1a2a" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
              <path d={d} stroke="#8B5CF6" strokeOpacity="0.28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </g>
      </svg>
      {ROOT_TIPS.map(([x, y], i) => (
        <span key={i} data-spark className="absolute h-1.5 w-1.5 rounded-full bg-[#2a2338]" style={{ left: `${x / 10}%`, top: `${(y / 400) * 46}%` }} />
      ))}
    </>
  );
}

const ROOTS = [
  "M40 0 C60 80 20 140 70 230",
  "M70 0 C110 60 90 120 130 170 S150 260 120 300",
  "M210 0 C240 90 200 150 236 210",
  "M330 0 C320 50 360 90 345 140",
  "M470 0 C455 40 500 70 480 110",
  "M560 0 C580 50 540 90 565 130",
  "M680 0 C660 70 710 120 690 190",
  "M800 0 C830 70 780 130 820 200 S840 270 805 320",
  "M930 0 C900 90 960 160 925 250",
  "M975 0 C985 60 960 110 980 160",
];
const ROOT_TIPS: [number, number][] = [
  [70, 230],
  [120, 300],
  [236, 210],
  [690, 190],
  [805, 320],
  [925, 250],
];

export function BurrowLeds() {
  return (
    <>
      {TUNNELS.map((t, ti) => (
        <div key={ti} className="absolute bottom-0" style={tunnelStyle(t)}>
          {Array.from({ length: t.rows }, (_, i) => (
            <div
              key={i}
              className="led-row"
              data-led={`${ti}-${i}`}
              style={{
                top: `${rowTop(t, i) * 100}%`,
                width: `${t.seeds.includes(i) ? 38 : 62}%`,
                ["--d" as string]: `${-((ti * 7 + i * 3) % 10) * 0.26}s`,
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** cables along the floor from the wheel out to the edges; the pulse layer flows outward */
export function FloorCables({ pulseRef }: { pulseRef: React.Ref<SVGSVGElement> }) {
  const paths = [
    "M500 96 C420 70 330 98 250 80 S90 70 0 52",
    "M500 96 C580 72 680 100 760 82 S910 66 1000 48",
    "M500 98 C450 90 380 104 300 100 S120 98 0 92",
    "M500 98 C560 92 640 106 720 100 S880 96 1000 88",
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 h-[16%]" aria-hidden>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {paths.map((d, i) => (
          <g key={i} fill="none">
            <path d={d} stroke="#050407" strokeWidth="8" vectorEffect="non-scaling-stroke" />
            <path d={d} stroke="#221c2e" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <svg ref={pulseRef} viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ opacity: 0 }}>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            className="pulse-cable"
            fill="none"
            stroke="#3DFF8A"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 4px #3DFF8A)", animationDelay: `${-i * 0.22}s` }}
          />
        ))}
      </svg>
      <span data-spark className="absolute left-0 top-[48%]" />
      <span data-spark className="absolute right-0 top-[44%]" />
    </div>
  );
}
