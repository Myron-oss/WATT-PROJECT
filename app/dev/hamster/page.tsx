"use client";

import { useState } from "react";
import { Hamster, type HamsterState } from "@/components/Hamster";
import { Wheel, HAMSTER_IN_WHEEL } from "@/components/Wheel";

const STATES: HamsterState[] = ["idle", "running", "overheat", "win", "knocked", "wave"];

export default function DevHamster() {
  const [speed, setSpeed] = useState(0.5);
  const [goggles, setGoggles] = useState<"up" | "down">("up");
  const [inWheel, setInWheel] = useState<HamsterState>("running");

  return (
    <main className="min-h-svh px-4 py-10 md:px-10">
      <h1 className="font-display text-5xl font-extrabold text-hamster">hamster lab</h1>
      <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-sm text-muted">
        <label className="flex items-center gap-2">
          speed
          <input type="range" min={0} max={1} step={0.01} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          {speed.toFixed(2)}
        </label>
        <button className="press rounded-full border border-white/15 px-3 py-1" onClick={() => setGoggles((g) => (g === "up" ? "down" : "up"))}>
          goggles {goggles}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3">
        {STATES.map((s) => (
          <figure key={s} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <Hamster state={s} speed={speed} goggles={goggles} follow cableLoose className="w-full" />
            <figcaption className="mt-10 font-mono text-xs text-muted">{s}</figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-end gap-10">
        <div className="w-[min(80vw,420px)] pb-10">
          <Wheel spin={inWheel === "running" ? 1.6 - speed * 1.3 : undefined}>
            <Hamster
              state={inWheel}
              speed={speed}
              goggles={goggles}
              cableTo={HAMSTER_IN_WHEEL.cableTo}
              className="absolute"
              style={HAMSTER_IN_WHEEL.style}
            />
          </Wheel>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {STATES.map((s) => (
            <button key={s} className="press rounded-full border border-white/15 px-3 py-1" onClick={() => setInWheel(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="w-[min(60vw,300px)] pb-10">
          <Wheel dead>
            <Hamster state="idle" cableLoose className="absolute" style={HAMSTER_IN_WHEEL.style} />
          </Wheel>
        </div>
      </div>
    </main>
  );
}
