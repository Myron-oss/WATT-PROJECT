# $watt

the hamster that keeps solana running. a one-page memecoin concept site: hold to pump, a three-frame scroll comic, and the contract address.

no backend, no wallet connection, no database.

## run

```bash
npm install
npm run dev
```

open http://localhost:3000. the hamster lab with every state is at `/dev/hamster`.

## before launch

edit `config.ts`:

```ts
export const CONFIG = {
  ticker: "$WATT",
  contractAddress: "2dywBj26GeL5J7n2Unass4ydtMr8MDLzNJ5n1bNxpump",
  pumpFunUrl: "https://pump.fun/2dywBj26GeL5J7n2Unass4ydtMr8MDLzNJ5n1bNxpump",
  xUrl: "https://x.com/WATT_PROJECT",
};
```

## where things live

| file | what |
| --- | --- |
| `components/Game.tsx` | hero game: hold (mouse, touch, space) to pump, hidden crash point, candle canvas, haptics |
| `components/Hamster.tsx` | layered svg hamster. states: `idle` `running` `overheat` `win` `knocked` `wave` |
| `components/Wheel.tsx` | glowing wheel; the rotor is its own svg so spinning it stays on the compositor |
| `components/WeldText.tsx` | welded headings (gsap + scrolltrigger); fades in under reduced motion |
| `components/Comic.tsx` | pinned three-frame scroll comic, click the hamster 10× |
| `components/Contract.tsx` | riveted panel, copy-to-clipboard ca, buy button, footer |
| `components/Nav.tsx` | sticky nav, sound toggle, connect wallet, weld-seam scroll progress |
| `lib/fx.ts` | one full-screen particle canvas (sparks, coins, smoke); idles when empty |
| `lib/sound.ts` | web audio synth (whir, clink, crack, sizzle), off by default |
| `app/globals.css` | color tokens, hamster state animations, grain and scanlines |

## game tuning

in `components/Game.tsx`: `GROW_A` / `GROW_B` set how fast the multiplier grows (`m = e^(A·t + B·t²)`: 2x ≈ 5s, 10x ≈ 11s, 100x ≈ 17s), and `rollCrash()` sets the crash point (`P(crash ≥ x) = 0.97 / x`, so ~3% bust instantly). bets, payouts and the one-time follow bonus live in `lib/wallet.ts` and this browser's storage.

## weekly leaderboard (phantom)

signed-out visitors play free practice rounds. connecting phantom signs a one-time message (not a transaction) and joins the weekly game:

- every wallet holding at least `minWattToPlay` $watt gets `weeklyCoins` (100) each monday 00:00 utc; the balance at sunday 23:59 utc is the score. everyone else plays free practice rounds
- to wipe the game (all coins + the leaderboard), change `season` in `config.ts` and deploy; old data expires by itself
- the server runs every ranked round: it picks the crash point before the round (sha256 of the seed is returned at start, the seed is revealed after), and times the cash-out when the request arrives
- top 10 win `prizesSol`, but only wallets holding at least `minWattForPrize` $watt when prizes are paid; an ineligible wallet's prize goes to the next eligible one
- coins are play money: they can't be bought, sold or withdrawn

all knobs live in `config.ts`. server code is in `lib/server/` and `app/api/`.

### setup

the only thing a deployment needs is redis:

1. vercel → your project → storage → create a **redis** database (redis cloud's free 30 mb, or upstash) → connect it to the project, then **redeploy**. either env style works: `REDIS_URL` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`, with any prefix
2. open `https://<your-site>/api/health`: `"ok": true` means sign-in and the leaderboard work. it also shows memory used and roughly how many more wallets fit (each wallet costs ~300–500 bytes per week; 30 mb ≈ 60k wallets a week, and old weeks expire on their own)
3. set `contractAddress` in `config.ts` to the real token (prize eligibility can't be checked before that)

optional: `SESSION_SECRET` (otherwise one is generated and kept in redis) and `SOLANA_RPC_URL` (the public rpc rate-limits). until redis is connected, visitors see "leaderboard offline" and can still play practice rounds.

locally, without redis, everything is stored in `.data/store.json`.

### paying the week

```bash
node scripts/payout.mjs                                   # dry run for last week: winners, $watt check, amounts
node scripts/payout.mjs --keypair ~/prizes.json --send    # asks you to type PAY, then sends sol
```

use a separate wallet that only holds that week's prize money. every transfer is recorded, so rerunning never pays a wallet twice. run it with the production redis env vars set (e.g. `vercel env pull .env.local` first).

## promo video

a 17-second promo made with [remotion](https://www.remotion.dev), reusing the site's hamster, wheel, voltmeter, colors and fonts.

```bash
npm run video          # renders out/watt-promo-1920x1080.mp4 and out/watt-promo-1080x1920.mp4
npm run video:studio   # live preview / scrubbing in remotion studio
```

| file | what |
| --- | --- |
| `video/timeline.json` | scene cuts and the two multiplier curves (shared by picture and sound) |
| `video/Promo.tsx` | the film: 7 scenes, both formats from one component |
| `video/Weld.tsx` | frame-driven version of the welded headings |
| `video/lib.ts` | curves, wheel/leg integration, deterministic particles |
| `video/video.css` | pauses the site's css animations and scrubs them from the frame clock |
| `video/audio/make-sounds.mjs` | renders the sound effects to `video/public/sfx/*.wav` (motor rev, ticks, crack, power-down, coins, jingle…) |

fonts load from google fonts at render time, so rendering needs a network connection.
