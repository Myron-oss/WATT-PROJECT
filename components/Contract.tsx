"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/config";
import { WeldText } from "./WeldText";
import { Hamster } from "./Hamster";
import { sparks } from "@/lib/fx";
import { clink, sizzle } from "@/lib/sound";

const shortCa = (ca: string) => (ca.length > 16 ? `${ca.slice(0, 6)}…${ca.slice(-6)}` : ca);

/** sparks all around an element's border */
function burstAround(el: HTMLElement, n = 28) {
  const r = el.getBoundingClientRect();
  const per = r.width * 2 + r.height * 2;
  for (let i = 0; i < n; i++) {
    const d = Math.random() * per;
    const [x, y, a] =
      d < r.width
        ? [r.left + d, r.top, -Math.PI / 2]
        : d < r.width + r.height
          ? [r.right, r.top + d - r.width, 0]
          : d < r.width * 2 + r.height
            ? [r.right - (d - r.width - r.height), r.bottom, Math.PI / 2]
            : [r.left, r.bottom - (d - r.width * 2 - r.height), Math.PI];
    sparks(x, y, 2, { angle: a, spread: 1.6, speed: 380, life: 0.6 });
  }
}

const RIVETS = [
  "left-4 top-4",
  "right-4 top-4",
  "left-4 bottom-4",
  "right-4 bottom-4",
  "left-1/2 top-4 -translate-x-1/2 hidden md:block",
  "left-1/2 bottom-4 -translate-x-1/2 hidden md:block",
];

export function Contract() {
  const panelRef = useRef<HTMLDivElement>(null);
  const caRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const onFlash = () => {
      setFlash(false);
      requestAnimationFrame(() => setFlash(true));
      if (caRef.current) burstAround(caRef.current, 40);
      sizzle(0.5);
      setTimeout(() => setFlash(false), 1500);
    };
    window.addEventListener("watt:flash-ca", onFlash);
    return () => window.removeEventListener("watt:flash-ca", onFlash);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.contractAddress);
    } catch {
      const t = document.createElement("textarea");
      t.value = CONFIG.contractAddress;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    if (caRef.current) burstAround(caRef.current, 24);
    clink(3);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section id="ca" className="relative px-4 pb-10 pt-28 md:pt-36">
      <div
        id="ca-panel"
        ref={panelRef}
        data-flash={flash}
        className="metal relative mx-auto max-w-4xl rounded-[28px] px-5 pb-12 pt-14 md:px-14 md:pb-16 md:pt-20"
      >
        {RIVETS.map((c) => (
          <span key={c} className={`rivet ${c}`} aria-hidden />
        ))}
        <div
          className="flash-layer absolute inset-0 rounded-[28px]"
          style={{
            background: "radial-gradient(60% 50% at 50% 55%, rgb(255 225 77 / 0.22), transparent 70%)",
            boxShadow: "0 0 0 2px rgb(255 190 110 / 0.8), 0 0 60px 6px rgb(255 159 67 / 0.45)",
          }}
          aria-hidden
        />

        <figure className="text-center">
          <WeldText
            as="blockquote"
            text="every chain needs someone to keep it running."
            className="mx-auto max-w-3xl text-[clamp(34px,7.5vw,68px)] leading-[0.98]"
          />
          <figcaption className="mt-4 text-sm text-muted">— the hamster</figcaption>
        </figure>

        <div className="mt-12 flex flex-col items-center md:mt-14">
          <button
            ref={caRef}
            type="button"
            onClick={copy}
            aria-label={`copy contract address ${CONFIG.contractAddress}`}
            className="seam press group relative w-full max-w-2xl rounded-2xl bg-black/40 px-4 py-5 md:px-8 md:py-7"
          >
            <span className="mb-2 block text-left font-mono text-[11px] text-muted">ca</span>
            <span className="ca-glow block truncate text-center font-mono text-[clamp(18px,4.6vw,28px)] font-semibold tracking-tight">
              <span className="md:hidden">{shortCa(CONFIG.contractAddress)}</span>
              <span className="hidden md:inline">{CONFIG.contractAddress}</span>
            </span>
            <span className="mt-3 block text-center text-xs text-muted transition-colors duration-200" aria-live="polite">
              {copied ? <span className="text-ca">copied</span> : "copy"}
            </span>
          </button>

          <a
            href={CONFIG.pumpFunUrl}
            target="_blank"
            rel="noreferrer"
            className="press mt-10 inline-flex items-center gap-3 rounded-full bg-pump px-9 py-4 font-display text-3xl font-extrabold leading-none text-[#04130a] shadow-[0_0_40px_rgb(61_255_138/0.4)] hover:shadow-[0_0_60px_rgb(61_255_138/0.6)] md:text-4xl"
          >
            buy on pump.fun
          </a>

          <a
            href={CONFIG.xUrl}
            target="_blank"
            rel="noreferrer"
            className="press mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-[15px] font-semibold text-ink/85 hover:border-white/25 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
              <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.72H5.57L16.67 19.2Z" />
            </svg>
            follow on x
          </a>
        </div>
      </div>

      <footer className="mx-auto mt-16 flex max-w-4xl flex-col items-center pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
        <Hamster state="wave" follow className="w-36" />
        <p className="mt-5 font-display text-xl font-bold text-ink/70">he runs. solana stays up.</p>
        <p className="mt-2 max-w-sm text-xs text-muted">a memecoin. no promises, no roadmap, just a hamster.</p>
      </footer>
    </section>
  );
}
