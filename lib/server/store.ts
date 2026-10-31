/**
 * Tiny key/value + sorted-set store. Picks whatever the host provides:
 *   1. Upstash REST    …KV_REST_API_URL + …KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN
 *   2. any Redis       …REDIS_URL / …KV_URL (redis:// or rediss://), e.g. Redis Cloud from the Vercel marketplace
 *   3. local file      .data/store.json, dev only
 * Env names are matched by suffix, so prefixes Vercel adds (STORAGE_…, MY_DB_…) work too.
 */
import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SetOpts = { ex?: number; nx?: boolean };

export interface Store {
  kind: "upstash" | "redis" | "file";
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
  /** rough size, for the health check */
  usage(): Promise<{ keys?: number; bytes?: number }>;
}

/* ---------- env discovery ---------- */

function findEnv(re: RegExp, valueRe?: RegExp): { name: string; value: string } | null {
  const hits = Object.entries(process.env)
    .filter(([k, v]) => re.test(k) && v && (!valueRe || valueRe.test(v)))
    .sort((a, b) => a[0].length - b[0].length); // prefer the unprefixed name
  return hits.length ? { name: hits[0][0], value: hits[0][1]! } : null;
}

export function detectBackend() {
  const restUrl = findEnv(/(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/, /^https:\/\//);
  const restToken = findEnv(/(KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/);
  if (restUrl && restToken) return { kind: "upstash" as const, url: restUrl, token: restToken };
  const tcp = findEnv(/(REDIS_URL|KV_URL)$/, /^rediss?:\/\//);
  if (tcp) return { kind: "redis" as const, url: tcp };
  return { kind: "none" as const };
}

/* ---------- upstash (http) ---------- */

function upstashStore(url: string, token: string): Store {
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    kind: "upstash",
    async get<T>(key: string) {
      const v = await r.get<string>(key);
      return v == null ? null : (JSON.parse(v) as T);
    },
    async set(key, value, opts = {}) {
      const v = JSON.stringify(value);
      const res =
        opts.ex && opts.nx
          ? await r.set(key, v, { ex: opts.ex, nx: true })
          : opts.ex
            ? await r.set(key, v, { ex: opts.ex })
            : opts.nx
              ? await r.set(key, v, { nx: true })
              : await r.set(key, v);
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
      return (await r.zrevrank(key, member)) ?? null;
    },
    async expire(key, seconds) {
      await r.expire(key, seconds);
    },
    async usage() {
      return { keys: await r.dbsize() };
    },
  };
}

/* ---------- plain redis (tcp), e.g. redis cloud ---------- */

type Tcp = ReturnType<typeof createClient>;
const g = globalThis as unknown as { __wattRedis?: Promise<Tcp> };

function tcpStore(url: string): Store {
  // one connection per server instance, reused across requests
  const client = () =>
    (g.__wattRedis ??= (async () => {
      const c = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: (n: number) => Math.min(n * 200, 2000) } });
      c.on("error", (e: Error) => console.error("[redis]", e.message));
      await c.connect();
      return c as Tcp;
    })().catch((e) => {
      g.__wattRedis = undefined; // retry on the next request
      throw e;
    }));
  const cmd = async <T,>(args: string[]) => (await (await client()).sendCommand(args)) as T;
  return {
    kind: "redis",
    async get<T>(key: string) {
      const v = await cmd<string | null>(["GET", key]);
      return v == null ? null : (JSON.parse(String(v)) as T);
    },
    async set(key, value, opts = {}) {
      const args = ["SET", key, JSON.stringify(value)];
      if (opts.ex) args.push("EX", String(Math.ceil(opts.ex)));
      if (opts.nx) args.push("NX");
      return String(await cmd<string | null>(args)) === "OK";
    },
    async del(key) {
      await cmd(["DEL", key]);
    },
    async zadd(key, score, member) {
      await cmd(["ZADD", key, String(score), member]);
    },
    async ztop(key, n) {
      const flat = (await cmd<unknown[]>(["ZRANGE", key, "0", String(n - 1), "REV", "WITHSCORES"])).map(String);
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
      return out;
    },
    async zrank(key, member) {
      const r = await cmd<number | null>(["ZREVRANK", key, member]);
      return r == null ? null : Number(r);
    },
    async expire(key, seconds) {
      await cmd(["EXPIRE", key, String(Math.ceil(seconds))]);
    },
    async usage() {
      const keys = Number(await cmd<number>(["DBSIZE"]));
      const info = String(await cmd<string>(["INFO", "memory"]));
      const m = /used_memory:(\d+)/.exec(info);
      return { keys, bytes: m ? Number(m[1]) : undefined };
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
    kind: "file",
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
    async usage() {
      load();
      return { keys: Object.keys(data.kv).length, bytes: JSON.stringify(data).length };
    },
  };
}

/** serverless hosts have no shared disk: the leaderboard needs redis there */
export class StoreMissing extends Error {
  constructor() {
    super("no redis configured: connect a redis database to the vercel project and redeploy");
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const b = detectBackend();
  if (b.kind === "upstash") store = upstashStore(b.url.value, b.token.value);
  else if (b.kind === "redis") store = tcpStore(b.url.value);
  else if (process.env.VERCEL) throw new StoreMissing();
  else store = fileStore();
  return store;
}
