/**
 * Weekly prize payout, run by you from your own wallet. Nothing is sent without your confirmation.
 *
 *   node scripts/payout.mjs                         # dry run for last week
 *   node scripts/payout.mjs --week 2026-w44         # dry run for a given week
 *   node scripts/payout.mjs --keypair ~/prizes.json --send
 *
 * Needs the same database env vars as the site: REDIS_URL (redis cloud) or KV_REST_API_URL + _TOKEN (upstash),
 * prefixes allowed — `vercel env pull .env.local` then `node --env-file=.env.local scripts/payout.mjs`.
 * Without them it reads the local dev store (.data/store.json).
 * Optional: SOLANA_RPC_URL (defaults to mainnet-beta).
 *
 * The keypair is a Solana CLI JSON file (array of 64 numbers). Use a separate wallet that only
 * holds this week's prize money.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const { CONFIG } = await import("../config.ts");

/* ---------- args ---------- */

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SEND = args.includes("--send");
const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function weekOf(now) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const th = new Date(start + 3 * 864e5);
  const y = th.getUTCFullYear();
  const w = Math.ceil(((th.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { id: `${y}-w${String(w).padStart(2, "0")}`, end: start + 7 * 864e5 };
}
const week = arg("week") ?? weekOf(Date.now() - 7 * 864e5).id; // default: last finished week
if (week === weekOf(Date.now()).id) console.log(`⚠ ${week} is still running, this is only a preview\n`);

/* ---------- store ---------- */

const envBy = (re, valueRe) =>
  Object.entries(process.env)
    .filter(([k, v]) => re.test(k) && v && (!valueRe || valueRe.test(v)))
    .sort((a, b) => a[0].length - b[0].length)[0]?.[1];
const restUrl = envBy(/(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/, /^https:\/\//);
const restToken = envBy(/(KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/);
const tcpUrl = envBy(/(REDIS_URL|KV_URL)$/, /^rediss?:\/\//);
const localFile = join(process.cwd(), ".data", "store.json");

// one tiny interface over upstash / redis / the dev file
let db;
if (restUrl && restToken) {
  const r = new Redis({ url: restUrl, token: restToken, automaticDeserialization: false });
  db = { name: "upstash", cmd: (args) => r.eval("return redis.call(unpack(ARGV))", [], args) };
} else if (tcpUrl) {
  const c = createClient({ url: tcpUrl });
  await c.connect();
  db = { name: "redis", cmd: (args) => c.sendCommand(args.map(String)), close: () => c.quit() };
}
const done = async (code = 0) => {
  await db?.close?.();
  process.exit(code);
};

async function topWallets(n) {
  if (db) {
    const flat = await db.cmd(["ZRANGE", `lb:${CONFIG.season}:${week}`, 0, n - 1, "REV", "WITHSCORES"]);
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ wallet: String(flat[i]), coins: Number(flat[i + 1]) });
    return out;
  }
  if (!existsSync(localFile)) return [];
  const z = JSON.parse(readFileSync(localFile, "utf8")).z?.[`lb:${CONFIG.season}:${week}`] ?? {};
  return Object.entries(z)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([wallet, coins]) => ({ wallet, coins }));
}
async function getPaid() {
  if (db) {
    const v = await db.cmd(["GET", `paid:${CONFIG.season}:${week}`]);
    return v ? JSON.parse(String(v)) : {};
  }
  if (!existsSync(localFile)) return {};
  return JSON.parse(readFileSync(localFile, "utf8")).kv?.[`paid:${CONFIG.season}:${week}`]?.v ?? {};
}
async function setPaid(paid) {
  if (db) return void (await db.cmd(["SET", `paid:${CONFIG.season}:${week}`, JSON.stringify(paid), "EX", 365 * 86400]));
  const data = existsSync(localFile) ? JSON.parse(readFileSync(localFile, "utf8")) : { kv: {}, z: {} };
  data.kv[`paid:${CONFIG.season}:${week}`] = { v: paid };
  writeFileSync(localFile, JSON.stringify(data));
}

/* ---------- $watt balance ---------- */

const conn = new Connection(RPC, "confirmed");
let mint = null;
try {
  mint = new PublicKey(CONFIG.contractAddress);
} catch {}

async function wattOf(wallet) {
  if (!mint) return null;
  const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(wallet), { mint });
  return res.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}

/* ---------- pick winners ---------- */

console.log(`week ${week} · store: ${db?.name ?? "local .data"} · rpc: ${RPC}`);
if (!mint) console.log(`⚠ contractAddress in config.ts isn't a real token address yet, so nobody can be checked for $watt`);

const prizes = CONFIG.prizesSol;
const candidates = await topWallets(50);
if (!candidates.length) {
  console.log("nobody played that week.");
  await done();
}
const paid = await getPaid();
const winners = [];
const table = [];
for (const c of candidates) {
  if (winners.length >= prizes.length) break;
  const watt = await wattOf(c.wallet).catch(() => null);
  const ok = watt !== null && watt >= CONFIG.minWattForPrize;
  const prize = ok ? prizes[winners.length] : 0;
  if (ok) winners.push({ ...c, prize, watt });
  table.push({
    wallet: c.wallet,
    coins: c.coins,
    watt: watt === null ? "?" : Math.floor(watt).toLocaleString("en-US"),
    prize: ok ? `${prize} sol` : "not eligible",
    paid: paid[c.wallet] ? "already paid" : "",
  });
}
console.table(table);

const todo = winners.filter((w) => !paid[w.wallet]);
const total = todo.reduce((s, w) => s + w.prize, 0);
console.log(`\n${todo.length} transfer(s), ${total.toFixed(4)} sol total (min $watt to win: ${CONFIG.minWattForPrize})`);

if (!SEND) {
  console.log("dry run. add --keypair <file> --send to pay.");
  await done();
}
if (!todo.length) await done();

/* ---------- send ---------- */

const kpPath = (arg("keypair") ?? "").replace(/^~/, homedir());
if (!kpPath || !existsSync(kpPath)) {
  console.error("--keypair <path to solana cli keypair json> is required with --send");
  await done(1);
}
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(kpPath, "utf8"))));
const balance = (await conn.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL;
console.log(`\nfrom ${payer.publicKey.toBase58()} · balance ${balance.toFixed(4)} sol`);
if (balance < total + 0.001 * todo.length) {
  console.error("not enough sol in the prize wallet for prizes + fees.");
  await done(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`type PAY to send ${total.toFixed(4)} sol to ${todo.length} wallet(s): `);
rl.close();
if (answer.trim() !== "PAY") {
  console.log("cancelled, nothing sent.");
  await done();
}

for (const w of todo) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(w.wallet),
      lamports: Math.round(w.prize * LAMPORTS_PER_SOL),
    }),
  );
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [payer]);
    paid[w.wallet] = { sig, sol: w.prize, at: new Date().toISOString() };
    await setPaid(paid); // saved after every transfer so a rerun never pays twice
    console.log(`✓ ${w.prize} sol → ${w.wallet}  https://solscan.io/tx/${sig}`);
  } catch (e) {
    console.error(`✗ ${w.wallet}: ${e.message}. rerun later; already-paid wallets are skipped.`);
  }
}
await done();
