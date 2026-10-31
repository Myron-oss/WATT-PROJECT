import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { clamp, sparkColor, stream } from "./lib";

/**
 * Frame-driven version of the site's <WeldText>: same layers (bronze base, orange, white-hot),
 * a hot tip running along the letters and throwing sparks.
 * Mark the key word with *stars*: "solana goes *down*."
 */

type Props = {
  text: string;
  start: number;
  size: number;
  tone?: "good" | "bad";
  logo?: boolean;
  style?: CSSProperties;
  step?: number; // frames per letter
};

const TONE = { good: "#3DFF8A", bad: "#FF3B5C" };

type Ch = { ch: string; key: boolean; idx: number };

function parse(text: string) {
  let key = false;
  let idx = 0;
  const words: Ch[][] = [[]];
  for (const c of text) {
    if (c === "*") {
      key = !key;
      continue;
    }
    if (c === " ") {
      words.push([]);
      continue;
    }
    words[words.length - 1].push({ ch: c, key, idx: idx++ });
  }
  return { words, n: idx };
}

type Rect = { x: number; y: number; w: number; h: number };

export function Weld({ text, start, size, tone = "good", logo, style, step }: Props) {
  const f = useCurrentFrame();
  const { words, n } = parse(text);
  const st = step ?? Math.min(1.7, 22 / n);
  const ref = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Rect[] | null>(null);
  const [handle] = useState(() => delayRender("weld measure"));

  useLayoutEffect(() => {
    let done = false;
    document.fonts.ready.then(() => {
      const el = ref.current;
      if (!el || done) return;
      const base = el.getBoundingClientRect();
      const scale = base.width / el.offsetWidth || 1; // rendering may be scaled in the studio
      setRects(
        Array.from(el.querySelectorAll<HTMLElement>("[data-ch]")).map((c) => {
          const r = c.getBoundingClientRect();
          return { x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale };
        }),
      );
      continueRender(handle);
    });
    return () => {
      done = true;
    };
  }, [handle, text, size]);

  const color = TONE[tone];
  const tipAt = (k: number) => {
    if (!rects?.length) return { x: 0, y: 0 };
    const p = clamp((k - start) / st, 0, n - 0.001);
    const i = Math.floor(p);
    const r = rects[i];
    return { x: r.x + r.w * (p - i), y: r.y + r.h * (0.5 + 0.28 * Math.sin(p * 7.3)) };
  };
  const end = start + n * st;
  const tipOn = f >= start && f <= end + 2;
  const tip = tipAt(f);
  const sparks = rects
    ? stream({ seed: `w${text}`, from: start, to: Math.floor(end), perFrame: 4, at: tipAt, speed: 520, spread: Math.PI * 1.4, gravity: 1300, life: 0.45 }, f)
    : [];

  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <div
        ref={ref}
        className={`weld ${logo ? "font-logo" : ""}`}
        style={{ fontSize: size, lineHeight: 1, whiteSpace: "nowrap", textAlign: "center" }}
      >
        {words.map((word, wi) => (
          <span key={wi}>
            <span className="weld-word">
              {word.map(({ ch, key, idx }) => {
                const t = start + idx * st;
                const reveal = clamp((f - t) / (st * 1.15));
                const hot = f < t ? 0 : 1 - clamp((f - t - st - 2) / 12);
                const org = f < t ? 0 : 1 - clamp((f - t - st - 8) / 26);
                return (
                  <span
                    key={idx}
                    data-ch
                    className="weld-ch"
                    style={{
                      clipPath: `inset(-25% ${(1 - reveal) * 100}% -25% 0%)`,
                      transform: key ? "skewX(-10deg)" : undefined,
                      fontWeight: key ? 900 : undefined,
                      margin: key ? "0 0.01em" : undefined,
                    }}
                  >
                    <span
                      className={key ? "weld-c" : "weld-c weld-base"}
                      style={key ? { color, textShadow: `0 0 ${size * 0.25}px ${color}aa` } : undefined}
                    >
                      {ch}
                    </span>
                    <span className="weld-c weld-orange" style={{ opacity: org }}>
                      {ch}
                    </span>
                    <span className="weld-c weld-hot" style={{ opacity: hot }}>
                      {ch}
                    </span>
                  </span>
                );
              })}
            </span>
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
      </div>

      {/* hot tip + sparks */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", width: 1, height: 1, pointerEvents: "none" }}>
        <defs>
          <radialGradient id="weld-tip">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.4" stopColor="#ffe2a8" />
            <stop offset="1" stopColor="#ff9f43" stopOpacity="0" />
          </radialGradient>
        </defs>
        {tipOn && rects && <circle cx={tip.x} cy={tip.y} r={size * 0.16} fill="url(#weld-tip)" />}
        <g style={{ mixBlendMode: "screen" }} strokeLinecap="round">
          {sparks.map((p) => {
            const t = p.age / p.life;
            return (
              <line
                key={p.seed}
                x1={p.x}
                y1={p.y}
                x2={p.x - p.vx * 0.02}
                y2={p.y - p.vy * 0.02}
                stroke={sparkColor(t)}
                strokeWidth={2.2 * (1 - t * 0.5)}
                opacity={1 - t * t}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
