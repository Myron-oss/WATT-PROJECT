"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/config";
import { WeldText } from "./WeldText";
import { connectPhantom, shortWallet, signOutRanked, useRanked } from "@/lib/ranked";

type Row = { rank: number; wallet: string; coins: number; eligible: boolean | null };
type Board = {
  week: string;
  endsAt: number;
  prizes: number[];
  minWatt: number;
  tokenSet: boolean;
  rows: Row[];
  me: { wallet: string; rank: number | null; coins: number } | null;
};

function useCountdown(to: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!to) return "";
  const ms = Math.max(0, to - now);
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function Leaderboard() {
  const { me, connecting } = useRanked();
  const [board, setBoard] = useState<Board | null>(null);
  const ref = useRef<HTMLElement>(null);
  const left = useCountdown(board?.endsAt);

  // refresh while on screen, and whenever the signed-in balance changes
  useEffect(() => {
    let timer = 0;
    let visible = false;
    const load = () =>
      fetch("/api/leaderboard", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setBoard(b))
        .catch(() => {});
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      clearInterval(timer);
      if (visible) {
        void load();
        timer = window.setInterval(load, 15_000);
      }
    });
    if (ref.current) io.observe(ref.current);
    void load();
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [me?.coins, me?.wallet]);

  const prizes = board?.prizes ?? CONFIG.prizesSol;
  const meInTop = me && board?.rows.some((r) => r.wallet === me.wallet);

  return (
    <section id="top" ref={ref} className="relative px-4 pt-28 md:pt-36">
      <div className="metal relative mx-auto max-w-3xl rounded-[28px] px-5 pb-10 pt-12 md:px-12 md:pb-12 md:pt-14">
        {["left-4 top-4", "right-4 top-4", "left-4 bottom-4", "right-4 bottom-4"].map((c) => (
          <span key={c} className={`rivet ${c}`} aria-hidden />
        ))}

        <div className="text-center">
          <WeldText as="h2" text="weekly top 10" className="text-[clamp(44px,10vw,84px)] leading-[0.95]" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            every wallet gets {CONFIG.weeklyCoins} coins on monday. most coins on sunday 23:59 utc wins sol.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-[12px] text-ink/75">
            <span className="h-1.5 w-1.5 rounded-full bg-pump shadow-[0_0_6px_#3DFF8A]" />
            {board ? `${board.week} · ends in ${left}` : "loading…"}
          </p>
        </div>

        <ol className="mt-8 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30">
          {Array.from({ length: 10 }, (_, i) => {
            const row = board?.rows[i];
            const mine = row && me?.wallet === row.wallet;
            return (
              <li
                key={i}
                className={`grid grid-cols-[2.25rem_1fr_auto_auto] items-center gap-3 px-4 py-2.5 font-mono text-[14px] tabular-nums ${
                  mine ? "bg-pump/10" : ""
                }`}
              >
                <span className={i < 3 ? "font-bold text-ca" : "text-muted"}>{i + 1}</span>
                <span className={row ? "text-ink" : "text-white/15"}>
                  {row ? shortWallet(row.wallet) : "—"}
                  {mine && <span className="ml-2 text-[11px] text-pump">you</span>}
                  {row?.eligible === false && (
                    <span className="ml-2 text-[11px] text-muted" title={`needs ${fmt(board!.minWatt)} $watt to win`}>
                      no $watt
                    </span>
                  )}
                </span>
                <span className={row ? "font-semibold text-ca" : "text-white/15"}>{row ? fmt(row.coins) : "—"}</span>
                <span className="w-16 text-right text-[12px] text-pump/80">{prizes[i] ? `${prizes[i]} sol` : ""}</span>
              </li>
            );
          })}
        </ol>

        {me && !meInTop && board?.me && (
          <p className="mt-3 text-center font-mono text-[13px] text-ink/70">
            you: #{board.me.rank ?? "—"} · {fmt(board.me.coins)} coins
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {me ? (
            <>
              <p className="text-center text-[13px] text-ink/70">
                playing as <span className="font-mono text-ink">{shortWallet(me.wallet)}</span>
                {me.eligible === true && <span className="ml-2 text-pump">· prize eligible</span>}
                {me.eligible === false && (
                  <span className="ml-2 text-danger">· hold {fmt(CONFIG.minWattForPrize)} $watt to be eligible</span>
                )}
              </p>
              <button type="button" onClick={() => void signOutRanked()} className="press text-[12px] text-muted underline-offset-4 hover:underline">
                sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void connectPhantom()}
              disabled={connecting}
              className="press rounded-full bg-energy px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_0_30px_rgb(139_92_246/0.45)] disabled:opacity-60"
            >
              {connecting ? "check phantom…" : "connect phantom to join"}
            </button>
          )}
        </div>

        <ul className="mx-auto mt-8 max-w-lg space-y-1.5 text-[12px] leading-relaxed text-muted">
          <li>· signing in is a message signature, not a transaction. we never ask to move funds.</li>
          <li>· the server times every round and picks the crash point before it starts.</li>
          <li>
            · to win a prize, the wallet must hold at least {fmt(CONFIG.minWattForPrize)} $watt when prizes are sent (after sunday).
            if a top-10 wallet doesn&apos;t, the prize goes to the next one that does.
          </li>
          <li>· play money only. coins can&apos;t be bought, sold or withdrawn.</li>
        </ul>
      </div>
    </section>
  );
}
