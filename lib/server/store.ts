/**
 * Tiny key/value + sorted-set store.
 * Production: Upstash Redis (UPSTASH_REDIS_REST_URL / _TOKEN, or Vercel's KV_REST_API_URL / _TOKEN).
 * Local dev: a JSON file in .data/ so everything works without any setup.
 */
import { Redis } from "@upstash/redis";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SetOpts = { ex?: number; nx?: boolean };

export interface Store {
  get<T>(key: string): Promise<T | null>;
  /** returns false when nx is set and the key already exists */
  set(key: string, value: unknown, opts?: SetOpts): Promise<boolean>;
  del(key: string): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  /** highest scores first */
  ztop(key: string, n: number): Promise<{ member: string; score: number }[]>;
  /** 0-based rank, highest score first */
  zrank(key: string, member: string): Promise<number | null>;
  expire(key: string, seconds: number): Promise<void>;
}

/* ---------- upstash ---------- */

function redisStore(url: string, token: string): Store {
  const r = new Redis({ url, token });
  return {
    async get<T>(key: string) {
      return (await r.get<T>(key)) ?? null;
    },
    async set(key, value, opts = {}) {
      const res =
        opts.ex && opts.nx
          ? await r.set(key, value, { ex: opts.ex, nx: true })
          : opts.ex
            ? await r.set(key, value, { ex: opts.ex })
            : opts.nx
              ? await r.set(key, value, { nx: true })
              : await r.set(key, value);
      return res === "OK";
    },
    async del(key) {
      await r.del(key);
    },
    async zadd(key, score, member) {
      await r.zadd(key, { score, member });
    },
    async ztop(key, n) {
      const flat = await r.zrange<(string | number)[]>(key, 0, n - 1, { rev: true, withScores: true });
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      return out;
    },
    async zrank(key, member) {
      const r0 = await r.zrevrank(key, member);
      return r0 ?? null;
    },
    async expire(key, seconds) {
      await r.expire(key, seconds);
    },
  };
}

/* ---------- local file (dev only) ---------- */

type FileData = {
  kv: Record<string, { v: unknown; exp?: number }>;
  z: Record<string, Record<string, number>>;
};

function fileStore(): Store {
  const dir = join(process.cwd(), ".data");
  const file = join(dir, "store.json");
  // re-read on every call: in dev each api route is its own module instance
  let data: FileData = { kv: {}, z: {} };
  const load = () => {
    try {
      data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { kv: {}, z: {} };
    } catch {
      data = { kv: {}, z: {} };
    }
  };
  const save = () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  };
  const live = (key: string) => {
    const e = data.kv[key];
    if (!e) return undefined;
    if (e.exp && e.exp < Date.now()) {
      delete data.kv[key];
      return undefined;
    }
    return e;
  };
  const sorted = (key: string) =>
    Object.entries(data.z[key] ?? {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([member, score]) => ({ member, score }));
  return {
    async get<T>(key: string) {
      load();
      return (live(key)?.v as T) ?? null;
    },
    async set(key, value, opts = {}) {
      load();
      if (opts.nx && live(key)) return false;
      data.kv[key] = { v: JSON.parse(JSON.stringify(value)), exp: opts.ex ? Date.now() + opts.ex * 1000 : undefined };
      save();
      return true;
    },
    async del(key) {
      load();
      delete data.kv[key];
      save();
    },
    async zadd(key, score, member) {
      load();
      (data.z[key] ??= {})[member] = score;
      save();
    },
    async ztop(key, n) {
      load();
      return sorted(key).slice(0, n);
    },
    async zrank(key, member) {
      load();
      const i = sorted(key).findIndex((e) => e.member === member);
      return i < 0 ? null : i;
    },
    async expire(key, seconds) {
      load();
      const e = live(key);
      if (e) {
        e.exp = Date.now() + seconds * 1000;
        save();
      }
    },
  };
}

/** serverless hosts have no shared disk: the leaderboard needs redis there */
export class StoreMissing extends Error {
  constructor() {
    super("no redis configured: connect upstash for redis to the vercel project");
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) store = redisStore(url, token);
  else if (process.env.VERCEL) throw new StoreMissing();
  else store = fileStore();
  return store;
}
