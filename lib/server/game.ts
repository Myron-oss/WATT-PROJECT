/**
 * The ranked game. The server owns everything that matters:
 * balances, the crash point (provably fair: committed before the round, revealed after)
 * and the clock (cash-outs are timed on arrival at the server).
 */
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { CONFIG } from "@/config";
import { crashFrom, floor2, growth, timeFor } from "@/lib/curve";
import { getStore } from "./store";

/*
 * storage budget (fits a 30 MB free redis): per wallet per week ≈ one small key + one sorted-set entry
 * (~300 bytes). player keys expire 2 days after their week, the leaderboard 21 days after
 * (time to run payouts); round bookkeeping lives for minutes.
 */
const DAY = 86_400;
const untilWeekEnd = (extraDays: number) => Math.max(DAY, Math.ceil((weekOf().end - Date.now()) / 1000) + extraDays * DAY);
const SHORT_S = 300; // results + settle locks
const MIN_GAP_MS = 700; // between rounds, per wallet

/* ---------- weeks (monday 00:00 utc → next monday) ---------- */

export function weekOf(now = Date.now()) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // monday = 0
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const end = start + 7 * 864e5;
  // iso week number
  const th = new Date(start + 3 * 864e5);
  const y = th.getUTCFullYear();
  const w = Math.ceil(((th.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { id: `${y}-w${String(w).padStart(2, "0")}`, start, end };
}

/* ---------- players ---------- */

export type Player = { coins: number; best: number; rounds: number; lastStart: number };
/** stored as a compact array: [coins, best, rounds, lastStart] */
type PackedPlayer = [number, number, number, number];
const pack = (p: Player): PackedPlayer => [p.coins, Math.round(p.best * 100) / 100, p.rounds, p.lastStart];
const unpack = (a: PackedPlayer): Player => ({ coins: a[0], best: a[1], rounds: a[2], lastStart: a[3] });

const pKey = (week: string, wallet: string) => `p:${week}:${wallet}`;
const lbKey = (week: string) => `lb:${week}`;

export async function getPlayer(wallet: string, week = weekOf().id): Promise<Player> {
  const store = getStore();
  const p = await store.get<PackedPlayer>(pKey(week, wallet));
  if (p) return unpack(p);
  const fresh: Player = { coins: CONFIG.weeklyCoins, best: 0, rounds: 0, lastStart: 0 };
  await savePlayer(wallet, fresh, week);
  return fresh;
}

async function savePlayer(wallet: string, p: Player, week = weekOf().id) {
  const store = getStore();
  await store.set(pKey(week, wallet), pack(p), { ex: untilWeekEnd(2) });
  await store.zadd(lbKey(week), p.coins, wallet);
  await store.expire(lbKey(week), untilWeekEnd(21));
}

export async function rankOf(wallet: string, week = weekOf().id) {
  const r = await getStore().zrank(lbKey(week), wallet);
  return r === null ? null : r + 1;
}

export async function top(n = 10, week = weekOf().id) {
  return getStore().ztop(lbKey(week), n);
}

/* ---------- rounds ---------- */

type Round = {
  id: string;
  wallet: string;
  week: string;
  bet: number;
  start: number; // server ms
  crash: number;
  crashAtMs: number; // ms after start
  seed: string;
};

export type Result = {
  id: string;
  state: "won" | "crashed";
  m: number; // cash-out multiplier, or the crash point
  crash: number;
  bet: number;
  payout: number;
  coins: number;
  seed: string; // reveal: sha256(seed) was the commitment
};

const activeKey = (wallet: string) => `round:${wallet}`;
const resultKey = (id: string) => `result:${id}`;

export class GameError extends Error {
  constructor(
    public code: "no_coins" | "bad_bet" | "busy" | "too_fast" | "no_round",
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export async function startRound(wallet: string, bet: number) {
  const store = getStore();
  const week = weekOf().id;

  // an abandoned round that has already crashed gets settled first
  const prev = await store.get<Round>(activeKey(wallet));
  if (prev) {
    if (Date.now() >= prev.start + prev.crashAtMs) await settle(prev, null);
    else throw new GameError("busy", 409, { id: prev.id });
  }

  const p = await getPlayer(wallet, week);
  if (!Number.isInteger(bet) || bet < 1) throw new GameError("bad_bet");
  if (p.coins < 1) throw new GameError("no_coins");
  if (bet > p.coins) throw new GameError("bad_bet");
  if (Date.now() - p.lastStart < MIN_GAP_MS) throw new GameError("too_fast", 429);

  const id = randomUUID();
  const seed = randomBytes(32).toString("hex");
  const h = createHmac("sha256", seed).update(id).digest();
  const u = h.readUIntBE(0, 6) / 2 ** 48; // 48 random bits → [0, 1)
  const crash = crashFrom(u);
  const round: Round = { id, wallet, week, bet, start: Date.now(), crash, crashAtMs: timeFor(crash) * 1000, seed };

  // one live round per wallet (atomic), then take the bet
  if (!(await store.set(activeKey(wallet), round, { nx: true, ex: 120 }))) throw new GameError("busy", 409);
  p.coins -= bet;
  p.lastStart = round.start;
  await savePlayer(wallet, p, week);

  return { id, bet, coins: p.coins, commit: createHash("sha256").update(seed).digest("hex") };
}

/** settle once; cashAt = server time of a cash-out request, or null when it crashed */
async function settle(round: Round, cashAt: number | null): Promise<Result> {
  const store = getStore();
  if (!(await store.set(`settle:${round.id}`, 1, { nx: true, ex: SHORT_S }))) {
    // someone else settled it (cash-out vs crash race): return their result
    for (let i = 0; i < 20; i++) {
      const r = await store.get<Result>(resultKey(round.id));
      if (r) return r;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    throw new GameError("no_round", 404);
  }
  const elapsed = cashAt === null ? Infinity : cashAt - round.start;
  const won = elapsed < round.crashAtMs;
  const m = won ? Math.min(floor2(growth(elapsed / 1000)), round.crash) : round.crash;
  const payout = won ? Math.floor(round.bet * m) : 0;

  const p = await getPlayer(round.wallet, round.week);
  p.coins += payout;
  p.rounds += 1;
  if (won) p.best = Math.max(p.best, m);
  await savePlayer(round.wallet, p, round.week);

  const result: Result = {
    id: round.id,
    state: won ? "won" : "crashed",
    m,
    crash: round.crash,
    bet: round.bet,
    payout,
    coins: p.coins,
    seed: round.seed,
  };
  await store.set(resultKey(round.id), result, { ex: SHORT_S });
  await store.del(activeKey(round.wallet));
  return result;
}

async function activeRound(wallet: string, id: string) {
  const r = await getStore().get<Round>(activeKey(wallet));
  return r && r.id === id ? r : null;
}

export async function cashOut(wallet: string, id: string): Promise<Result> {
  const at = Date.now(); // the clock that counts: when the request arrived
  const round = await activeRound(wallet, id);
  if (!round) {
    const done = await getStore().get<Result>(resultKey(id));
    if (done) return done;
    throw new GameError("no_round", 404);
  }
  return settle(round, at);
}

/** long-poll: resolves when the round crashes (or was cashed out meanwhile) */
export async function waitRound(wallet: string, id: string, maxMs = 25_000): Promise<Result | { state: "running" }> {
  const round = await activeRound(wallet, id);
  if (!round) {
    const done = await getStore().get<Result>(resultKey(id));
    if (done) return done;
    throw new GameError("no_round", 404);
  }
  const wait = round.start + round.crashAtMs - Date.now();
  if (wait > maxMs) {
    await new Promise((ok) => setTimeout(ok, maxMs));
    return { state: "running" };
  }
  if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
  // cashed out while we slept?
  const done = await getStore().get<Result>(resultKey(id));
  if (done) return done;
  const still = await activeRound(wallet, id);
  return still ? settle(still, null) : ((await getStore().get<Result>(resultKey(id))) ?? { state: "running" });
}

/** settle a round left behind by a closed tab, if it has crashed by now */
export async function sweep(wallet: string) {
  const r = await getStore().get<Round>(activeKey(wallet));
  if (r && Date.now() >= r.start + r.crashAtMs) await settle(r, null);
  return r && Date.now() < r.start + r.crashAtMs ? r.id : null;
}
