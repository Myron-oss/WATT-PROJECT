"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToId } from "@/lib/nav";
import { connectPhantom, shortWallet, useRanked } from "@/lib/ranked";
import { isSoundOn, onSound, setSound } from "@/lib/sound";

const LINKS = [
  { id: "play", label: "play" },
  { id: "hamster", label: "hamster" },
  { id: "top", label: "top" },
  { id: "ca", label: "ca" },
];

export function Nav() {
  const seamRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [sound, setSoundState] = useState(false);
  const { me, connecting } = useRanked();

  useEffect(() => {
    setSoundState(isSoundOn());
    return onSound(setSoundState);
  }, []);

  // scroll progress as a glowing weld seam
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      if (seamRef.current) seamRef.current.style.transform = `scaleX(${p})`;
      if (tipRef.current) {
        tipRef.current.style.transform = `translateX(${p * innerWidth}px)`;
        tipRef.current.style.opacity = p > 0.002 && p < 0.998 ? "1" : "0";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
      <nav className="relative flex h-14 items-center gap-2 border-b border-white/[0.06] bg-[rgb(10_10_15/0.55)] px-3 backdrop-blur-md md:px-6">
        <button
          type="button"
          onClick={() => scrollToId("play")}
          aria-label="$watt, back to top"
          className="press mr-1 hidden shrink-0 items-center gap-2 sm:flex"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-logo text-xl leading-none text-hamster">$watt</span>
        </button>

        <ul className="flex items-center text-[15px] font-semibold">
          {LINKS.map((l, i) => (
            <li key={l.id} className="flex items-center">
              {i > 0 && <span className="px-0.5 text-white/30" aria-hidden>·</span>}
              <a
                href={`#${l.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId(l.id);
                }}
                data-text={l.label}
                className={`rounded-md px-1.5 py-2 transition-colors duration-150 ${
                  l.id === "ca" ? "nav-ca" : "text-ink/70 hover:text-ink"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => setSound(!sound)}
            aria-pressed={sound}
            aria-label={sound ? "sound on" : "sound off"}
            className={`press grid h-9 w-9 place-items-center rounded-full transition-colors duration-150 ${
              sound ? "bg-energy/20 text-ink" : "text-ink/50 hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
              {sound ? (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </>
              ) : (
                <path d="m16 9 5 6m0-6-5 6" />
              )}
            </svg>
          </button>
          {me ? (
            <button
              type="button"
              onClick={() => scrollToId("top")}
              className="press whitespace-nowrap rounded-full border border-energy/50 bg-energy/15 px-3.5 py-2 font-mono text-[12px] font-semibold text-ink hover:bg-energy/25 md:px-4 md:text-[13px]"
            >
              {shortWallet(me.wallet)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectPhantom()}
              disabled={connecting}
              className="press whitespace-nowrap rounded-full border border-energy/50 bg-energy/15 px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-energy/25 disabled:opacity-60 md:px-4 md:text-sm"
            >
              {connecting ? "…" : <>connect<span className="hidden sm:inline"> phantom</span></>}
            </button>
          )}
        </div>

        {/* weld seam progress */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[2px]" aria-hidden>
          <div
            ref={seamRef}
            className="h-full origin-left bg-[linear-gradient(90deg,#6e3f1c,#c27a3a_60%,#ffd38a)] shadow-[0_0_8px_rgb(255_159_67/0.7)]"
            style={{ transform: "scaleX(0)" }}
          />
          <div
            ref={tipRef}
            className="absolute left-0 top-1/2 -ml-[5px] -mt-[5px] h-[10px] w-[10px] rounded-full bg-white opacity-0 shadow-[0_0_10px_4px_rgb(255_200_120/0.8)] transition-opacity duration-200"
          />
        </div>
      </nav>
    </header>
  );
}
