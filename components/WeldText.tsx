"use client";

import { useCallback, useEffect, useRef, type ElementType } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sparks } from "@/lib/fx";
import { sizzle } from "@/lib/sound";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  /** omit to weld on scroll-into-view; pass a boolean to control it (true welds, false resets) */
  active?: boolean;
  delay?: number;
  /** spark density multiplier */
  sparkle?: number;
};

const HIDDEN = "inset(-20% 100% -20% 0%)";
const SHOWN = "inset(-20% -5% -20% 0%)";

/**
 * Headings that get welded in: a white-hot point runs along the letters throwing sparks,
 * each letter cools white → orange → bronze. Reduced motion: plain fade.
 */
export function WeldText({ text, as: Tag = "h2", className, active, delay = 0, sparkle = 1 }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    tlRef.current?.kill();
    el.dataset.done = "false";
    gsap.set(el.querySelectorAll(".weld-ch"), { clipPath: HIDDEN });
    gsap.set(el.querySelectorAll(".weld-hot, .weld-orange"), { opacity: 0 });
    gsap.set(tipRef.current, { opacity: 0 });
  }, []);

  const play = useCallback(() => {
    const el = ref.current;
    const tip = tipRef.current;
    if (!el || !tip) return;
    reset();
    const chars = Array.from(el.querySelectorAll<HTMLElement>(".weld-ch"));
    const n = chars.length;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(chars, { clipPath: SHOWN });
      tlRef.current = gsap.timeline({ delay }).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" });
      el.dataset.done = "true";
      return;
    }

    const base = el.getBoundingClientRect();
    const rects = chars.map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });

    const step = Math.min(0.07, 1.5 / n);
    const tl = gsap.timeline({
      delay,
      onStart: () => sizzle(n * step),
      onComplete: () => {
        el.dataset.done = "true";
      },
    });

    chars.forEach((ch, i) => {
      const t = i * step;
      const hot = ch.querySelector(".weld-hot");
      const org = ch.querySelector(".weld-orange");
      tl.set([hot, org], { opacity: 1 }, t);
      tl.to(ch, { clipPath: SHOWN, duration: step * 1.15, ease: "none" }, t);
      tl.to(hot, { opacity: 0, duration: 0.45, ease: "power1.out" }, t + step + 0.06);
      tl.to(org, { opacity: 0, duration: 1.1, ease: "sine.inOut" }, t + step + 0.3);
    });

    const proxy = { p: 0 };
    let frame = 0;
    tl.set(tip, { opacity: 1 }, 0);
    tl.to(
      proxy,
      {
        p: n,
        duration: n * step,
        ease: "none",
        onUpdate: () => {
          const i = Math.min(n - 1, Math.floor(proxy.p));
          const f = proxy.p - i;
          const r = rects[i];
          const x = r.x + r.w * f;
          const y = r.y + r.h * (0.5 + 0.28 * Math.sin(proxy.p * 7.3));
          tip.style.transform = `translate(${x}px, ${y}px)`;
          if (frame++ % 2 === 0) {
            const b = el.getBoundingClientRect();
            sparks(b.left + x, b.top + y, Math.round(3 * sparkle), {
              angle: -Math.PI / 2,
              spread: Math.PI * 1.4,
              speed: 340,
              life: 0.5,
              size: 1.5,
            });
          }
        },
      },
      0,
    );
    tl.to(tip, { opacity: 0, duration: 0.25 });
    tlRef.current = tl;
  }, [delay, reset, sparkle]);

  // scroll-triggered mode
  useEffect(() => {
    if (active !== undefined) return;
    const el = ref.current;
    if (!el) return;
    const st = ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: play });
    return () => st.kill();
  }, [active, play]);

  // controlled mode
  useEffect(() => {
    if (active === undefined) return;
    if (active) play();
    else reset();
  }, [active, play, reset]);

  useEffect(() => () => void tlRef.current?.kill(), []);

  const words = text.split(" ");
  return (
    <Tag ref={ref} className={`weld ${className ?? ""}`} aria-label={text}>
      <span aria-hidden>
        {words.map((word, wi) => (
          <span key={wi}>
            <span className="weld-word">
              {Array.from(word).map((ch, ci) => (
                <span key={ci} className="weld-ch">
                  <span className="weld-c weld-base">{ch}</span>
                  <span className="weld-c weld-orange">{ch}</span>
                  <span className="weld-c weld-hot">{ch}</span>
                </span>
              ))}
            </span>
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
      <span ref={tipRef} className="weld-tip" aria-hidden />
    </Tag>
  );
}
