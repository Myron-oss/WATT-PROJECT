/** Dark silhouettes framing the bottom corners: pipes, cables, seed piles. Static. */

const INK = "#040306";
const RIM = "rgb(139 92 246 / 0.35)";
const WARM = "rgb(255 159 67 / 0.22)";

function Pile({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // a mound of sunflower seeds
  const seeds = [
    [-34, -6, -40],
    [-20, -16, 20],
    [-6, -22, -10],
    [10, -18, 35],
    [24, -10, -25],
    [-26, 2, 60],
    [2, -6, -70],
    [30, 0, 15],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-58 8 C-40 -22 -10 -34 6 -32 C30 -30 50 -14 62 8 Z" fill={INK} />
      <path d="M-40 -12 C-20 -30 10 -34 34 -22" stroke={WARM} strokeWidth="1.5" fill="none" />
      {seeds.map(([sx, sy, r], i) => (
        <g key={i} transform={`translate(${sx} ${sy}) rotate(${r})`}>
          <path d="M0 -7 C4 -3 4 3 0 7 C-4 3 -4 -3 0 -7 Z" fill="#0d0b0a" stroke="rgb(207 198 184 / 0.18)" strokeWidth="0.8" />
        </g>
      ))}
    </g>
  );
}

export function Foreground() {
  return (
    <>
      <svg viewBox="0 0 520 260" className="absolute bottom-0 left-0 w-[min(48vw,560px)]" aria-hidden>
        {/* elbow pipe */}
        <path d="M-10 150 H120 Q160 150 160 190 V270" stroke={INK} strokeWidth="34" fill="none" />
        <path d="M-10 134 H120 Q176 134 176 190 V270" stroke={RIM} strokeWidth="2" fill="none" />
        <rect x="70" y="126" width="16" height="48" rx="3" fill={INK} stroke={RIM} strokeWidth="1.5" />
        <rect x="142" y="208" width="52" height="14" rx="3" fill={INK} stroke={RIM} strokeWidth="1.5" />
        {/* cables */}
        <path d="M-10 214 C80 190 140 250 230 236 S330 212 380 262" stroke={INK} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M-10 236 C60 222 110 262 200 258" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M-10 209 C80 185 140 245 230 231" stroke={RIM} strokeWidth="1" fill="none" />
        <Pile x={270} y={262} s={1.3} />
        <rect x="0" y="252" width="520" height="12" fill={INK} />
      </svg>

      <svg viewBox="0 0 520 260" className="absolute bottom-0 right-0 w-[min(48vw,560px)]" aria-hidden>
        {/* vertical pipe with a valve */}
        <path d="M430 -10 V170 Q430 210 470 210 H540" stroke={INK} strokeWidth="30" fill="none" />
        <path d="M416 -10 V170 Q416 226 470 226 H540" stroke={RIM} strokeWidth="2" fill="none" />
        <g transform="translate(430 96)">
          <circle r="30" fill="none" stroke={INK} strokeWidth="8" />
          <circle r="30" fill="none" stroke={RIM} strokeWidth="1.2" />
          <path d="M-30 0H30M0 -30V30" stroke={INK} strokeWidth="6" />
          <circle r="8" fill={INK} stroke={RIM} strokeWidth="1.2" />
        </g>
        {/* coiled cable */}
        <path d="M540 240 C440 250 360 200 300 230 C250 254 290 280 330 262 C370 244 330 214 290 236" stroke={INK} strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M540 236 C440 246 360 196 300 226" stroke={WARM} strokeWidth="1" fill="none" />
        <Pile x={180} y={262} s={1.1} />
        <Pile x={250} y={266} s={0.7} />
        <rect x="0" y="252" width="520" height="12" fill={INK} />
      </svg>
    </>
  );
}
