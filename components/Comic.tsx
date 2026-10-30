"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hamster, type HamsterState } from "./Hamster";
import { Wheel, HAMSTER_IN_WHEEL } from "./Wheel";
import { WeldText } from "./WeldText";
import { Racks } from "./Racks";
import { sparks } from "@/lib/fx";

gsap.registerPlugin(ScrollTrigger);

const LINES = ["solana went down", "one hamster said no", "he runs. solana stays up."];
const TINT = ["rgb(255 59 92 / 0.34)", "rgb(139 92 246 / 0.10)", "rgb(61 255 138 / 0.14)"];
const TONE = ["red", "purple", "green"] as const;

// chart paths in a 1000×300 box
const FLAT = "M0 170 L380 170 L400 120 L415 220 L430 160 L445 170 L1000 170";
const RISE = "M0 250 L120 236 L200 240 L290 206 L360 214 L450 170 L530 178 L610 128 L690 138 L780 86 L860 92 L1000 20";

export function Comic() {
  const sectionRef = useRef<HTMLElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [pokes, setPokes] = useState(0);
  const [fainted, setFainted] = useState(false);
  const hamRef = useRef<SVGSVGElement>(null);

  // pin + three frames
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=220%",
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const f = self.progress < 0.3 ? 0 : self.progress < 0.64 ? 1 : 2;
          setFrame((prev) => (prev === f ? prev : f));
        },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  // plug-in sparks
  useEffect(() => {
    if (frame !== 1) return;
    const t = setTimeout(() => {
      const r = hubRef.current?.getBoundingClientRect();
      if (r) sparks(r.left + r.width / 2, r.top + r.height / 2, 46, { spread: Math.PI * 2, speed: 520, life: 0.8, size: 2 });
    }, 380);
    return () => clearTimeout(t);
  }, [frame]);

  const poke = () => {
    if (fainted) return;
    const n = pokes + 1;
    const r = hamRef.current?.getBoundingClientRect();
    if (r) sparks(r.left + r.width * 0.7, r.top + r.height * 0.3, 6, { speed: 260, life: 0.4 });
    hamRef.current?.animate(
      [{ transform: "scale(1, 1)" }, { transform: "scale(1.06, 0.92)" }, { transform: "scale(1, 1)" }],
      { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    if (n >= 10) {
      setFainted(true);
      setPokes(0);
      setTimeout(() => setFainted(false), 2600);
    } else setPokes(n);
  };

  const hamState: HamsterState = fainted ? "knocked" : frame === 2 ? "running" : "idle";

  return (
    <section id="hamster" ref={sectionRef} className="relative h-[100svh] overflow-hidden">
      <Racks cols={7} tone={TONE[frame]} className="absolute inset-0 px-3 py-16 opacity-45" />
      <div className="absolute inset-0 transition-[background-color] duration-700" style={{ backgroundColor: TINT[frame] }} aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_60%,rgb(10_10_15/0.2),rgb(10_10_15/0.92))]" aria-hidden />

      {/* chart: red flatline → green climb (revealed with clip-path) */}
      <div className="absolute inset-x-0 top-[30%] h-[28%]" aria-hidden>
        <svg
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full transition-opacity duration-500"
          style={{ opacity: frame === 0 ? 0.95 : 0, filter: "drop-shadow(0 0 6px #FF3B5C)" }}
        >
          <path d={FLAT} fill="none" stroke="#FF3B5C" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{
            clipPath: frame === 2 ? "inset(-20% -2% -20% 0)" : "inset(-20% 100% -20% 0)",
            transition: frame === 2 ? "clip-path 1.6s cubic-bezier(0.77, 0, 0.175, 1)" : "clip-path 200ms ease",
            filter: "drop-shadow(0 0 8px #3DFF8A)",
          }}
        >
          <path d={RISE} fill="none" stroke="#3DFF8A" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      {/* caption */}
      <div className="relative z-10 flex h-full flex-col items-center px-5 pt-[calc(env(safe-area-inset-top)+92px)] text-center">
        <div className="grid w-full max-w-4xl">
          {LINES.map((line, i) => (
            <div
              key={line}
              className="[grid-area:1/1] transition-opacity duration-300"
              style={{ opacity: frame === i ? 1 : 0 }}
              aria-hidden={frame !== i}
            >
              <WeldText
                as="h2"
                text={line}
                active={frame === i}
                className="text-[clamp(44px,11vw,112px)] leading-[0.95]"
              />
            </div>
          ))}
        </div>

        {/* scene */}
        <div className="mt-auto mb-[calc(env(safe-area-inset-bottom)+9svh)] w-[min(78vw,40svh,440px)]">
          <Wheel
            spin={frame === 2 ? 0.9 : undefined}
            dead={frame < 2}
            glow={0.8}
          >
            <div ref={hubRef} className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2" aria-hidden />
            <Hamster
              ref={hamRef}
              state={hamState}
              speed={0.7}
              goggles={frame === 0 ? "up" : "down"}
              cableTo={frame === 0 ? undefined : HAMSTER_IN_WHEEL.cableTo}
              cableLoose={frame === 0}
              follow
              className="absolute"
              style={HAMSTER_IN_WHEEL.style}
            />
            <button
              type="button"
              aria-label="poke the hamster"
              onClick={poke}
              className="absolute left-[25%] top-[55%] h-[38%] w-[50%] cursor-pointer rounded-full"
            />
          </Wheel>
        </div>
      </div>

      {/* frame dots */}
      <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 md:right-8" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full transition-[background-color,transform] duration-300"
            style={{
              backgroundColor: i === frame ? ["#FF3B5C", "#8B5CF6", "#3DFF8A"][frame] : "rgb(255 255 255 / 0.15)",
              transform: i === frame ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
