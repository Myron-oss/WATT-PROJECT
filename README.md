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
  contractAddress: "PASTE_CA_HERE",
  pumpFunUrl: "https://pump.fun/PASTE_CA_HERE",
  xUrl: "https://x.com/PASTE",
  telegramUrl: "https://t.me/PASTE",
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

in `components/Game.tsx`: `K` sets how fast the multiplier grows (`m = e^(K·t)`), and `rollCrash()` sets the crash distribution (about 8% under 2x, 68% 2–10x, 18% 10–50x, 6% 50x+). the best score lives in react state only.
