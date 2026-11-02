"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hamster, legCycle, type HamsterState } from "./Hamster";
import { Wheel, HAMSTER_IN_WHEEL } from "./Wheel";
import { WeldText } from "./WeldText";
import { BurrowArt, BurrowLeds, FloorCables, LED_ORDER, TUNNELS } from "./hero/Burrow";
import { Voltmeter, needleAngle, NEEDLE_MIN } from "./hero/Voltmeter";
import { Foreground } from "./hero/Foreground";
import { coins, seeds, smoke, sparks, sprite } from "@/lib/fx";
import { clack, clink, crack, engine, engineStop, redPulse, RED_ZONE } from "@/lib/sound";
import { scrollToId } from "@/lib/nav";
import { CONFIG } from "@/config";
import { crashFrom, growth, rand01 } from "@/lib/curve";
import {
  cashoutRanked,
  connectPhantom,
  patchMe,
  refreshMe,
  shortWallet,
  startRanked,
  useRanked,
  waitRanked,
  type RoundResult,
} from "@/lib/ranked";

type Phase = "ready" | "running" | "overheat" | "knocked" | "win";

/** practice rounds (signed out) roll their own crash point; ranked rounds get it from the server */
const rollCrash = () => crashFrom(rand01());

const BETS = [5, 10, 25, "all"] as const;
type Bet = (typeof BETS)[number];

const vibrate = (p: number | number[]) => {
  try {
    if (navigator.userActivation?.hasBeenActive === false) return;
    navigator.vibrate?.(p);
  } catch {}
};

const BUBBLE: Record<Phase, string> = {
  ready: "gm, fren",
  running: "faster?",
  overheat: "too hot",
  knocked: "too hot",
  win: "we're so back",
};

/** background hamsters: where they sit, and the multiplier that wakes each one up */
const T1 = TUNNELS[1];
const T4 = TUNNELS[4];
const BG_HAMSTERS = [
  { style: { left: "calc(3% + 24px)", bottom: "0%" }, size: "w-[clamp(72px,10vw,148px)]", at: 1, delay: "-1.3s" },
  { style: { left: `${T1.x + T1.w / 2}%`, bottom: `${T1.h}%`, translate: "-50% 0" }, size: "w-[clamp(60px,7.5vw,116px)] hidden sm:block", at: 1.6, delay: "-4.1s" },
  { style: { left: `${T4.x + T4.w / 2}%`, bottom: `${T4.h}%`, translate: "-50% 0" }, size: "w-[clamp(60px,7.5vw,116px)] hidden sm:block", at: 2.6, delay: "-6.7s" },
  { style: { right: "calc(3% + 24px)", bottom: "0%" }, size: "w-[clamp(72px,10vw,148px)]", at: 4.2, delay: "-2.4s" },
] as const;

type Timed = { timers: number[]; leds: HTMLElement[]; lit: number };

const later = (st: Timed, fn: () => void, ms: number) => {
  st.timers.push(window.setTimeout(fn, ms));
};
const clearTimers = (st: Timed) => {
  st.timers.forEach(clearTimeout);
  st.timers = [];
};
const setLed = (el: HTMLElement, v: string) => {
  if (el.dataset.s !== v) el.dataset.s = v;
};
const resetLeds = (st: Timed) => {
  st.leds.forEach((el) => setLed(el, ""));
  st.lit = 0;
};
/** blackout: every row flashes red then dies, top to bottom */
const ledsDie = (st: Timed) => {
  [...st.leds].reverse().forEach((el, k) => {
    later(st, () => setLed(el, "red"), k * 22);
    later(st, () => setLed(el, "off"), k * 22 + 280);
  });
};
/** lights coming back, floor first */
const ledsReturn = (st: Timed) => {
  st.leds.forEach((el, k) => later(st, () => setLed(el, ""), k * 36));
};

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#1b0f07" />
      <circle cx="12" cy="12" r="9.2" fill="#FFE14D" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#a87200" strokeWidth="1.4" />
      <path d="M13 6.5 9 12.6h2.6L10.8 17.5l4.3-6.3h-2.6L13 6.5Z" fill="#a87200" />
    </svg>
  );
}

type Mote = { x: number; y: number; vx: number; vy: number; s: number; a: number; warm: boolean };
type Riser = { x: number; y: number; vy: number; ph: number; rot: number; vr: number; s: number; coin: boolean; life: number };

export function Game() {
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [best, setBest] = useState(0);
  const [showAgain, setShowAgain] = useState(false);
  const [alive, setAlive] = useState(0);
  const [bgOverride, setBgOverride] = useState<(HamsterState | null)[]>([null, null, null, null]);
  const [cheer, setCheer] = useState(false);
  const [lightsOut, setLightsOut] = useState(false);
  const [holding, setHolding] = useState(false);
  // ranked play: the signed-in wallet's weekly coins live on the server
  const { me, connecting } = useRanked();
  const meRef = useRef(me);
  meRef.current = me;
  const [bet, setBet] = useState<Bet>(10);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const balanceRef = useRef<HTMLDivElement>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const reflRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const hamRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGSVGElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const pulseRef = useRef<SVGSVGElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const stageBtnRef = useRef<HTMLButtonElement>(null);
  const holdBtnRef = useRef<HTMLButtonElement>(null);
  const layerRefs = {
    earth: useRef<HTMLDivElement>(null),
    burrow: useRef<HTMLDivElement>(null),
    leds: useRef<HTMLDivElement>(null),
    life: useRef<HTMLDivElement>(null),
    fg: useRef<HTMLDivElement>(null),
  };

  const s = useRef({
    phase: "ready" as Phase,
    t: 0,
    m: 1,
    crash: 2,
    speed: 0,
    angle: 0,
    cycle: 0,
    needle: NEEDLE_MIN,
    lit: 0,
    alive: 0,
    lastVib: 0,
    sparkAcc: 0,
    smokeAcc: 0,
    riseAcc: 0,
    lockUntil: 0,
    visible: true,
    reduced: false,
    px: 0,
    py: 0,
    ppx: 0,
    ppy: 0,
    wheel: { cx: 0, cy: 0, w: 0, floor: 0 },
    w: 0,
    h: 0,
    dpr: 1,
    leds: [] as HTMLElement[],
    motes: [] as Mote[],
    risers: [] as Riser[],
    timers: [] as number[],
    // ranked round bookkeeping
    roundId: null as string | null,
    stake: 0,
    pending: false, // waiting for the server to start the round
    released: false, // let go before the start came back
    settling: false, // cash-out sent, waiting for the server's verdict
    abort: null as AbortController | null,
  });

  const setPhase = useCallback((p: Phase) => {
    s.current.phase = p;
    setPhaseState(p);
  }, []);

  const hamCenter = () => {
    const r = hamRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width * 0.55, y: r.top + r.height * 0.35 } : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  const cableSparks = () => {
    sectionRef.current?.querySelectorAll<HTMLElement>("[data-spark]").forEach((el) => {
      const r = el.getBoundingClientRect();
      sparks(r.left, r.top, 10, { speed: 420, spread: Math.PI * 2, life: 0.6, size: 1.8 });
    });
  };

  // ----- ranked -----
  const betRef = useRef<Bet>(10);
  betRef.current = bet;
  const stakeFor = (b: Bet, coins: number) => (b === "all" ? coins : Math.min(b, coins));
  const showDelta = (v: number) => setDelta({ v, k: performance.now() });
  const nudge = (el: Element | null) =>
    el?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );

  useEffect(() => {
    refreshMe().then((m) => {
      // a round left running in a closed tab: let it finish on the server first
      if (m?.active) {
        setNotice("finishing your last round…");
        waitRanked(m.active, new AbortController().signal)
          .then(() => refreshMe())
          .finally(() => setNotice(null));
      }
    });
  }, []);

  // ----- round flow -----
  const startRound = useCallback((crash: number) => {
    const st = s.current;
    clearTimers(st);
    resetLeds(st);
    st.t = 0;
    st.m = 1;
    st.crash = crash;
    st.settling = false;
    setShowAgain(false);
    setLightsOut(false);
    setCheer(false);
    setBgOverride([null, null, null, null]);
    setPhase("running");
    vibrate(12);
  }, [setPhase]);

  /** win visuals; m and payout come from the server in ranked play */
  const cashOut = useCallback((m: number, payout?: number) => {
    const st = s.current;
    st.m = m;
    setPhase("win");
    setBest((b) => Math.max(b, m));
    if (payout !== undefined) showDelta(payout - st.stake);
    if (numRef.current) numRef.current.textContent = `${m.toFixed(2)}x`;
    st.lockUntil = performance.now() + 650;

    const c = hamCenter();
    const n = Math.round(Math.min(64, 12 + Math.log2(m) * 10));
    coins(c.x, c.y, n);
    seeds(c.x, c.y, Math.round(n * 0.7));
    sparks(c.x, c.y, 22, { speed: 520, spread: Math.PI * 2, life: 0.7 });
    // motor cut dead, needle clacks back, then the coins
    engineStop("instant");
    clack();
    later(st, () => clink(Math.round(4 + Math.log2(m) * 2)), 160);
    vibrate([18, 40, 18, 40, 30]);
    flashRef.current?.animate(
      [{ opacity: 0.55, background: "#ffe9c4" }, { opacity: 0, background: "#ffe9c4" }],
      { duration: 900, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    numRef.current?.animate([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], {
      duration: 520,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });

    // the whole burrow celebrates
    st.leds.forEach((el) => setLed(el, "lit"));
    st.lit = st.leds.length;
    setBgOverride(["wave", "wave", "wave", "wave"]);
    setCheer(true);
    later(st, () => {
      setCheer(false);
      setBgOverride([null, null, null, null]);
      ledsReturn(st);
      st.lit = 0;
    }, 1900);
    later(st, () => setShowAgain(true), 450);
  }, [setPhase]);

  const overheat = useCallback(() => {
    const st = s.current;
    st.m = st.crash;
    setPhase("overheat");
    if (st.stake) showDelta(-st.stake); // the stake is already gone
    if (numRef.current) numRef.current.textContent = `${st.crash.toFixed(2)}x`;
    crack();
    engineStop("die");
    vibrate([70, 40, 140]);
    flashRef.current?.animate(
      [{ opacity: 0.7, background: "#FF3B5C" }, { opacity: 0, background: "#FF3B5C" }],
      { duration: 650, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    const { cx, cy, w } = st.wheel;
    const r = sectionRef.current!.getBoundingClientRect();
    sparks(r.left + cx, r.top + cy + w * 0.3, 36, { speed: 700, spread: Math.PI * 1.6, life: 0.8, size: 2 });

    // blackout: LEDs die red one by one, cables spark, everyone falls over
    setLightsOut(true);
    ledsDie(st);
    cableSparks();
    later(st, cableSparks, 380);
    [0, 1, 2, 3].forEach((i) =>
      later(st, () => setBgOverride((o) => o.map((v, k) => (k === i ? "knocked" : v))), 180 + i * 140),
    );
    st.lockUntil = performance.now() + 1500;
    later(st, () => {
      setPhase("knocked");
      crack();
    }, 900);
    later(st, () => setShowAgain(true), 1350);
    // ...then the lights slowly come back
    later(st, () => {
      setLightsOut(false);
      ledsReturn(st);
      [0, 1, 2, 3].forEach((i) =>
        later(st, () => setBgOverride((o) => o.map((v, k) => (k === i ? null : v))), 400 + i * 260),
      );
    }, 2500);
  }, [setPhase]);

  /** the server's verdict on a ranked round */
  const finish = useCallback(
    (r: RoundResult) => {
      const st = s.current;
      if (st.roundId !== r.id) return; // already handled
      st.roundId = null;
      st.abort?.abort();
      st.settling = false;
      patchMe({ coins: r.coins });
      if (r.state === "won") cashOut(r.m, r.payout);
      else {
        st.crash = r.crash;
        overheat();
      }
      setTimeout(() => void refreshMe(), 1200); // rank may have moved
    },
    [cashOut, overheat],
  );

  const settleRanked = useCallback(() => {
    const st = s.current;
    if (!st.roundId || st.settling) return;
    st.settling = true; // freeze the readout until the server answers
    cashoutRanked(st.roundId)
      .then(finish)
      .catch(() => {
        st.settling = false; // the crash long-poll will still resolve it
      });
  }, [finish]);

  const press = useCallback(() => {
    const st = s.current;
    if (st.phase === "running" || st.phase === "overheat" || st.pending) return;
    if ((st.phase === "win" || st.phase === "knocked") && performance.now() < st.lockUntil) return;
    setNotice(null);
    const signedIn = meRef.current;

    // practice: free, local, no coins. for anyone signed out or not holding $watt
    if (!signedIn?.ranked) {
      st.stake = 0;
      setHolding(true);
      startRound(rollCrash());
      return;
    }

    const stake = stakeFor(betRef.current, signedIn.coins);
    if (stake < 1) {
      nudge(balanceRef.current);
      return;
    }
    st.pending = true;
    st.released = false;
    setHolding(true);
    startRanked(stake)
      .then((r) => {
        st.pending = false;
        st.stake = r.bet;
        st.roundId = r.id;
        patchMe({ coins: r.coins });
        startRound(Infinity); // the crash point stays on the server
        const ac = new AbortController();
        st.abort = ac;
        waitRanked(r.id, ac.signal).then(finish, () => {});
        if (st.released) settleRanked();
      })
      .catch((e: { code?: string }) => {
        st.pending = false;
        setHolding(false);
        setNotice(
          e.code === "signed_out"
            ? "session expired, connect again"
            : e.code === "no_coins"
              ? "out of coins till monday"
              : e.code === "not_holder"
                ? "you need $watt in this wallet to play for coins"
                : e.code === "unverified"
                  ? "couldn't read your $watt balance, try again in a minute"
                  : e.code === "busy"
                    ? "your last round is still running"
                    : e.code === "too_fast"
                      ? "easy, one round at a time"
                      : "couldn't start the round",
        );
        void refreshMe();
      });
  }, [startRound, finish, settleRanked]);

  const release = useCallback(() => {
    const st = s.current;
    setHolding(false);
    if (st.pending) {
      st.released = true; // cash out as soon as the round exists
      return;
    }
    if (st.phase !== "running") return;
    if (st.roundId) settleRanked();
    else cashOut(st.m);
  }, [cashOut, settleRanked]);

  const holdProps = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      press();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  // ----- layout -----
  useEffect(() => {
    const st = s.current;
    st.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const measure = () => {
      const sec = sectionRef.current;
      const cv = canvasRef.current;
      const wb = shakeRef.current;
      if (!sec || !cv || !wb) return;
      st.w = sec.clientWidth;
      st.h = sec.clientHeight;
      st.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(st.w * st.dpr);
      cv.height = Math.round(st.h * st.dpr);
      // offsetTop chain is immune to the shake / parallax transforms
      let top = 0;
      let left = 0;
      let el: HTMLElement | null = wb;
      while (el && el !== sec) {
        top += el.offsetTop;
        left += el.offsetLeft;
        el = el.offsetParent as HTMLElement | null;
      }
      const w = wb.offsetWidth;
      const floor = top + w * 1.065;
      st.wheel = { cx: left + w / 2, cy: top + w / 2, w, floor };
      if (floorRef.current) floorRef.current.style.height = `${floor}px`;
      if (reflRef.current) reflRef.current.style.top = `${floor}px`;
      if (!st.motes.length) {
        const n = coarse ? 26 : 46;
        st.motes = Array.from({ length: n }, () => ({
          x: Math.random() * st.w,
          y: Math.random() * st.h,
          vx: (Math.random() - 0.5) * 8,
          vy: -4 - Math.random() * 10,
          s: 0.6 + Math.random() * 1.6,
          a: Math.random() * Math.PI * 2,
          warm: Math.random() < 0.6,
        }));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sectionRef.current) ro.observe(sectionRef.current);
    // LEDs in lighting order (floor → ceiling)
    const byId = new Map<string, HTMLElement>();
    layerRefs.leds.current?.querySelectorAll<HTMLElement>("[data-led]").forEach((el) => byId.set(el.dataset.led!, el));
    st.leds = LED_ORDER.map((id) => byId.get(id)!).filter(Boolean);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pointer parallax
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      s.current.px = (e.clientX / innerWidth) * 2 - 1;
      s.current.py = (e.clientY / innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // ----- main loop: only while the hero is on screen -----
  useEffect(() => {
    const st = s.current;
    let raf = 0;
    let last = performance.now();
    const coinImg = sprite("coin");
    const seedImg = sprite("seed");
    const layers = [
      { ref: layerRefs.earth, d: 0.15, sy: 0.32 },
      { ref: layerRefs.burrow, d: 0.35, sy: 0.22 },
      { ref: layerRefs.leds, d: 0.35, sy: 0.22 },
      { ref: layerRefs.life, d: 0.6, sy: 0.12 },
      { ref: layerRefs.fg, d: 1.2, sy: -0.06 },
    ];

    const draw = (ctx: CanvasRenderingContext2D, dt: number) => {
      const { w, h } = st;
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // dust and sawdust drifting in the dark
      for (const p of st.motes) {
        if (!st.reduced) {
          p.a += dt * 0.8;
          p.x += (p.vx + Math.sin(p.a) * 4) * dt * (1 + st.speed * 2);
          p.y += p.vy * dt * (1 + st.speed * 3);
          if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        }
        const tw = 0.45 + Math.sin(p.a * 2) * 0.25;
        ctx.globalAlpha = tw * (0.5 + st.speed * 0.5);
        ctx.fillStyle = p.warm ? "#ffd9a8" : "#b89cff";
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }

      // seeds and coins floating up while he pumps
      for (let i = st.risers.length - 1; i >= 0; i--) {
        const r = st.risers[i];
        r.life += dt;
        r.y += r.vy * dt;
        r.ph += dt * 2;
        r.rot += r.vr * dt;
        const x = r.x + Math.sin(r.ph) * 12;
        const fade = Math.min(1, r.life * 2) * Math.min(1, Math.max(0, r.y / (h * 0.35)));
        if (r.y < -30 || fade <= 0.01 && r.life > 1) {
          st.risers.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = fade * 0.85;
        ctx.save();
        ctx.translate(x, r.y);
        if (r.coin) {
          ctx.scale(Math.max(0.15, Math.abs(Math.cos(r.rot))), 1);
          ctx.drawImage(coinImg, -r.s, -r.s, r.s * 2, r.s * 2);
        } else {
          ctx.rotate(r.rot);
          ctx.drawImage(seedImg, -r.s * 0.66, -r.s, r.s * 1.33, r.s * 2);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ph = st.phase;
      const live = ph === "running" || ph === "overheat";

      if (ph === "running") {
        st.t += dt;
        if (!st.settling && !st.pending) {
          st.m = growth(st.t);
          if (st.m >= st.crash) overheat();
        }
      }

      // speed easing
      const target =
        ph === "running" ? 0.16 + 0.84 * Math.min(1, Math.log(st.m) / Math.log(40)) : ph === "overheat" ? 1 : 0;
      const rate = target > st.speed ? 5 : ph === "knocked" ? 2.6 : 1.1;
      st.speed += (target - st.speed) * (1 - Math.exp(-dt * rate));
      if (st.speed < 0.002) st.speed = 0;

      // wheel + legs
      st.angle += st.speed * 13 * dt;
      if (rotorRef.current) rotorRef.current.style.transform = `rotate(${st.angle}rad)`;
      if (glowRef.current) glowRef.current.style.opacity = String(0.25 + st.speed * 0.5);
      const cyc = Math.round(legCycle(st.speed) * 50) / 50;
      if (cyc !== st.cycle && hamRef.current) {
        st.cycle = cyc;
        hamRef.current.style.setProperty("--ham-cycle", `${cyc}s`);
      }

      // voltmeter
      if (ph === "running" && numRef.current) {
        const txt = `${st.m.toFixed(2)}x`;
        if (numRef.current.textContent !== txt) numRef.current.textContent = txt;
      }
      // win: snaps back to the stop · overheat: power dies, needle falls to zero
      const nTarget = ph === "running" ? needleAngle(st.m) : NEEDLE_MIN;
      const nRate = ph === "win" ? 18 : ph === "overheat" || ph === "knocked" ? 2.6 : 10;
      st.needle += (nTarget - st.needle) * (1 - Math.exp(-dt * nRate));
      const red = ph === "running" && st.m >= RED_ZONE;
      const pulse = red ? redPulse() : 0;
      const jitter =
        ph !== "running" || st.reduced ? 0 : red ? pulse * 1.3 + (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * st.speed * 1.6;
      if (needleRef.current) needleRef.current.style.transform = `rotate(${(st.needle + jitter).toFixed(2)}deg)`;

      // halo (the moon behind the wheel)
      const out = ph === "overheat" || ph === "knocked";
      const haloA = out ? 0.12 : 0.62 + st.speed * 0.38;
      if (haloRef.current) {
        haloRef.current.style.opacity = haloA.toFixed(3);
        haloRef.current.style.transform = `scale(${(0.92 + st.speed * 0.22).toFixed(3)})`;
      }
      if (reflRef.current) reflRef.current.style.opacity = (0.4 + haloA * 0.6).toFixed(3);

      // the burrow comes alive with the multiplier
      if (ph === "running") {
        const lit = Math.round(Math.min(1, Math.log(st.m) / Math.log(60)) * st.leds.length);
        if (lit !== st.lit) {
          for (let i = Math.min(lit, st.lit); i < Math.max(lit, st.lit); i++) setLed(st.leds[i], i < lit ? "lit" : "");
          st.lit = lit;
        }
        const a = BG_HAMSTERS.filter((b) => st.m >= b.at).length;
        if (a !== st.alive) {
          st.alive = a;
          setAlive(a);
        }
      } else if (st.alive && ph !== "overheat") {
        st.alive = 0;
        setAlive(0);
      }
      if (pulseRef.current) pulseRef.current.style.opacity = live ? (0.35 + st.speed * 0.65).toFixed(3) : "0";

      // parallax: mouse + scroll
      if (!st.reduced) {
        st.ppx += (st.px - st.ppx) * (1 - Math.exp(-dt * 4));
        st.ppy += (st.py - st.ppy) * (1 - Math.exp(-dt * 4));
        const sy = window.scrollY;
        for (const l of layers) {
          const el = l.ref.current;
          if (!el) continue;
          el.style.transform = `translate3d(${(-st.ppx * l.d * 18).toFixed(2)}px, ${(-st.ppy * l.d * 10 + sy * l.sy).toFixed(2)}px, 0)`;
        }
      }

      // shake
      if (shakeRef.current) {
        const amp = st.reduced
          ? 0
          : ph === "overheat"
            ? 7
            : ph === "running"
              ? Math.pow(st.speed, 2.5) * 5 + (red ? 2.5 + Math.abs(pulse) * 2 : 0)
              : 0;
        shakeRef.current.style.transform = amp
          ? `translate(${((Math.random() - 0.5) * amp).toFixed(2)}px, ${((Math.random() - 0.5) * amp).toFixed(2)}px)`
          : "";
      }

      // sparks off the track, smoke when overheating
      const sec = sectionRef.current;
      if (sec && live) {
        const r = sec.getBoundingClientRect();
        st.sparkAcc += dt * Math.pow(st.speed, 1.4) * 70;
        const n = Math.floor(st.sparkAcc);
        if (n > 0) {
          st.sparkAcc -= n;
          const { cx, cy, w } = st.wheel;
          sparks(r.left + cx - w * 0.16, r.top + cy + w * 0.4, n, {
            angle: -Math.PI * 0.86,
            spread: 0.9,
            speed: 260 + st.speed * 520,
            life: 0.55,
            size: 1.4 + st.speed,
          });
        }
        if (ph === "overheat") {
          st.smokeAcc += dt * 9;
          if (st.smokeAcc > 1) {
            st.smokeAcc = 0;
            const c = hamCenter();
            smoke(c.x + 20, c.y - 10, 1);
          }
        }
      }

      // floating seeds + coins
      if (ph === "running" && st.risers.length < 46) {
        st.riseAcc += dt * st.speed * 16;
        while (st.riseAcc > 1) {
          st.riseAcc -= 1;
          const coin = Math.random() < 0.35;
          st.risers.push({
            x: Math.random() * st.w,
            y: st.h + 20,
            vy: -(50 + Math.random() * 70) * (0.7 + st.speed),
            ph: Math.random() * 6,
            rot: Math.random() * 6,
            vr: (Math.random() - 0.5) * 3,
            s: coin ? 7 + Math.random() * 5 : 5 + Math.random() * 3,
            coin,
            life: 0,
          });
        }
      }

      // haptics
      if (ph === "running" && now - st.lastVib > 260 - st.speed * 190) {
        st.lastVib = now;
        vibrate(Math.round(6 + st.speed * 14));
      }

      if (ph === "running") engine(st.m);

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, dt);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf && st.visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      engineStop("fade");
    };

    const io = new IntersectionObserver(([e]) => {
      st.visible = e.isIntersecting;
      if (st.visible) start();
      else stop();
    });
    if (sectionRef.current) io.observe(sectionRef.current);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      st.timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overheat]);

  // spacebar
  useEffect(() => {
    const ok = (t: EventTarget | null) =>
      t === document.body || t === document.documentElement || t === stageBtnRef.current || t === holdBtnRef.current || t === null;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !s.current.visible || !ok(e.target)) return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !ok(e.target)) return;
      e.preventDefault();
      release();
    };
    const blur = () => release();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [press, release]);

  const live = phase === "running" || phase === "overheat";
  const tone = phase === "overheat" || phase === "knocked" ? "hot" : phase === "ready" ? "idle" : "pump";
  const coinsNow = me?.coins ?? 0;
  const ranked = !!me?.ranked;
  const broke = ranked && coinsNow < 1 && !live && !holding;
  const bubble = broke ? "broke till monday" : BUBBLE[phase];
  const bgState = (i: number): HamsterState => bgOverride[i] ?? (live && i < alive ? "running" : "idle");

  return (
    <section
      id="play"
      ref={sectionRef}
      data-phase={phase}
      className="relative isolate flex min-h-[100svh] flex-col items-center overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-[calc(env(safe-area-inset-top)+66px)]"
    >
      {/* 1. deep earth */}
      <div ref={layerRefs.earth} className="earth absolute -inset-10 z-0" aria-hidden />

      {/* floor frame: everything standing on the burrow floor */}
      <div ref={floorRef} className="pointer-events-none absolute inset-x-0 top-0 h-[70%]" aria-hidden>
        {/* 2. tunnels / racks / roots */}
        <div ref={layerRefs.burrow} className="absolute -inset-x-6 inset-y-0 z-[1]">
          <BurrowArt />
        </div>
        <div ref={layerRefs.leds} className="absolute -inset-x-6 inset-y-0 z-[3]">
          <BurrowLeds />
        </div>
        {/* 3. ambient hamsters + floor cables */}
        <div ref={layerRefs.life} className="absolute -inset-x-6 inset-y-0 z-[6]">
          <FloorCables pulseRef={pulseRef} />
          {BG_HAMSTERS.map((b, i) => {
            const st = bgState(i);
            return (
              <div
                key={i}
                className={`absolute aspect-[400/430] transition-opacity ${lightsOut ? "opacity-25 duration-150" : "opacity-90 duration-[1600ms]"} ${b.size}`}
                style={b.style}
              >
                <div className={cheer ? "cheer" : undefined} style={{ animationDelay: `${i * 70}ms` }}>
                  <Wheel spin={st === "running" ? 0.75 + i * 0.09 : undefined} glow={0.3} dead={lightsOut}>
                    <Hamster
                      state={st}
                      speed={0.75}
                      goggles={i % 2 ? "down" : "up"}
                      className="absolute"
                      style={{ ...HAMSTER_IN_WHEEL.style, ["--ham-delay" as string]: b.delay }}
                    />
                  </Wheel>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="blackout pointer-events-none absolute inset-0 z-[2]" data-out={lightsOut} aria-hidden />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[4] h-full w-full" aria-hidden />

      {/* reflective floor */}
      <div ref={reflRef} className="pointer-events-none absolute inset-x-0 bottom-0 top-[70%] z-[7]" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_14_22/0.92),rgb(8_7_11/0.98)_45%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_200_140/0.25),transparent)]" />
        <div className="absolute left-1/2 top-0 h-[55%] w-[min(90vw,720px)] -translate-x-1/2 bg-[radial-gradient(50%_45%_at_50%_0%,rgb(255_190_120/0.28),transparent_100%)]" />
      </div>

      {/* 5. foreground silhouettes */}
      <div ref={layerRefs.fg} className="pointer-events-none absolute -inset-x-4 bottom-[-12px] top-0 z-[8]" aria-hidden>
        <Foreground />
      </div>

      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-[9] opacity-0" aria-hidden />

      {/* ----- hero ui ----- */}
      <div className="relative z-10 flex w-full flex-1 flex-col items-center">
        <ul className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] font-semibold text-ink/75">
          {[
            { t: "fair launch", c: "#FF9F43" },
            { t: "pump.fun", c: "#3DFF8A" },
            { t: "solana", c: "#8B5CF6" },
          ].map((p) => (
            <li
              key={p.t}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[rgb(20_17_28/0.6)] px-2.5 py-1 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
              {p.t}
            </li>
          ))}
        </ul>

        <div className="relative mt-3">
          <Voltmeter needleRef={needleRef} numRef={numRef} tone={tone} />
          {best > 0 && (
            <p className="absolute left-full top-1/2 ml-3 hidden whitespace-nowrap font-mono text-[11px] text-muted sm:block">
              best {best.toFixed(2)}x
            </p>
          )}
          {best > 0 && (
            <p className="absolute inset-x-0 -bottom-4 text-center font-mono text-[10px] text-muted sm:hidden">best {best.toFixed(2)}x</p>
          )}
        </div>

        {/* 4. the main hamster */}
        <div className="relative mt-5 flex flex-1 items-end">
          <div className="relative">
            <div
              ref={haloRef}
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[175%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgb(255 250 240 / 0.95) 0%, rgb(255 220 170 / 0.75) 14%, rgb(255 159 67 / 0.38) 32%, rgb(255 159 67 / 0.08) 52%, transparent 66%)",
                opacity: 0.5,
              }}
              aria-hidden
            />
            <button
              ref={stageBtnRef}
              type="button"
              aria-label="hold to pump"
              tabIndex={-1}
              className="hold-zone relative block touch-none select-none rounded-full [-webkit-touch-callout:none]"
              {...holdProps}
            >
              <div ref={shakeRef}>
                <Wheel ref={rotorRef} glowRef={glowRef} glow={0.3} className="w-[min(72vw,31svh,400px)]">
                  <Hamster
                    ref={hamRef}
                    state={phase === "ready" ? "idle" : phase}
                    speed={0.3}
                    cableTo={HAMSTER_IN_WHEEL.cableTo}
                    className="absolute"
                    style={HAMSTER_IN_WHEEL.style}
                  />
                </Wheel>
              </div>
            </button>
            <div className="pointer-events-none absolute left-[63%] top-[27%]" aria-live="polite">
              <p
                key={bubble}
                className="bubble relative whitespace-nowrap rounded-2xl rounded-bl-[4px] bg-[#f6efe4] px-3 py-1.5 text-[13px] font-extrabold text-[#1b0f07] shadow-[0_6px_20px_rgb(0_0_0/0.45)]"
              >
                {bubble}
              </p>
            </div>
          </div>
        </div>

        <WeldText
          as="h1"
          text={CONFIG.ticker.toLowerCase()}
          active
          delay={0.35}
          sparkle={1.6}
          className="font-logo mt-3 text-[clamp(52px,min(18vw,10.5svh),140px)] leading-[0.9]"
        />
        <p className="mt-1 text-sm font-medium text-ink/60">he runs. solana stays up.</p>

        {/* ranked: weekly coins + bet · signed out: practice */}
        <div className="mt-4 flex h-9 w-full max-w-md items-center justify-center gap-2">
          {ranked && me ? (
            <>
              <div
                ref={balanceRef}
                className="relative flex h-9 items-center gap-1.5 rounded-full border border-ca/30 bg-[rgb(20_17_28/0.7)] pl-1.5 pr-3 font-mono text-[15px] font-bold tabular-nums text-ca backdrop-blur-sm"
                aria-label={`${coinsNow} coins this week${me.rank ? `, rank ${me.rank}` : ""}`}
              >
                <CoinIcon />
                {coinsNow}
                {me.rank && <span className="ml-1 text-[12px] font-semibold text-muted">#{me.rank}</span>}
                {delta && (
                  <span
                    key={delta.k}
                    className={`delta pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-sm font-extrabold ${delta.v >= 0 ? "text-pump" : "text-danger"}`}
                  >
                    {delta.v >= 0 ? `+${delta.v}` : delta.v}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="bet">
                {BETS.map((b) => {
                  const on = bet === b;
                  const off = live || holding || (b !== "all" && b > coinsNow);
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={off}
                      onClick={() => setBet(b)}
                      className={`press h-9 min-w-10 rounded-full px-2.5 font-mono text-[13px] font-bold transition-colors duration-150 disabled:opacity-35 ${
                        on ? "bg-ca text-[#1a1400]" : "border border-white/10 bg-[rgb(20_17_28/0.6)] text-ink/75 hover:text-ink"
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgb(20_17_28/0.6)] px-3 py-1.5 text-[12px] font-semibold text-ink/70 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-energy shadow-[0_0_6px_#8B5CF6]" />
              {me ? `practice · hold $watt to get ${CONFIG.weeklyCoins} coins` : "practice · $watt holders play for the weekly prize"}
            </p>
          )}
        </div>

        <div className="mt-2.5 flex w-full max-w-md items-center justify-center gap-2.5">
          <button
            ref={holdBtnRef}
            type="button"
            data-holding={holding}
            disabled={broke}
            className="press flex-1 touch-none select-none whitespace-nowrap rounded-full bg-pump px-4 py-3.5 font-display text-[22px] sm:text-2xl font-extrabold leading-none text-[#04130a] shadow-[0_0_30px_rgb(61_255_138/0.4)] transition-[box-shadow,transform] duration-150 [-webkit-touch-callout:none] disabled:bg-white/10 disabled:text-ink/50 disabled:shadow-none data-[holding=true]:scale-[0.97] data-[holding=true]:shadow-[0_0_60px_rgb(61_255_138/0.8)]"
            {...holdProps}
          >
            {broke ? "out of coins" : showAgain ? "again" : "hold to pump"}
          </button>
          {me ? (
            <button
              type="button"
              onClick={() => scrollToId("top")}
              className="press flex-1 whitespace-nowrap rounded-full border border-energy/55 bg-energy/15 px-4 py-3.5 font-mono text-[14px] font-semibold leading-none text-ink backdrop-blur-sm hover:bg-energy/25"
            >
              {shortWallet(me.wallet)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectPhantom()}
              disabled={connecting}
              className="press flex-1 whitespace-nowrap rounded-full border border-energy/55 bg-energy/15 px-4 py-3.5 text-[15px] font-semibold leading-none text-ink backdrop-blur-sm hover:bg-energy/25 disabled:opacity-60"
            >
              {connecting ? "check phantom…" : "connect phantom"}
            </button>
          )}
        </div>
        <p className="mt-2 h-4 text-center text-[12px] text-muted" aria-live="polite">
          {notice ?? ""}
        </p>
      </div>
    </section>
  );
}
