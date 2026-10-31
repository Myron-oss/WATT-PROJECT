/**
 * The game's math, shared by the browser and the server so both agree on every multiplier.
 */

/** multiplier growth: m = e^(A·t + B·t²). 2x ≈ 5s, 10x ≈ 11s, 100x ≈ 16.7s */
export const GROW_A = 0.0797;
export const GROW_B = 0.01179;
export const growth = (t: number) => Math.exp(GROW_A * t + GROW_B * t * t);

/** seconds until the multiplier reaches m (inverse of growth) */
export const timeFor = (m: number) =>
  m <= 1 ? 0 : (-GROW_A + Math.sqrt(GROW_A * GROW_A + 4 * GROW_B * Math.log(m))) / (2 * GROW_B);

/** house edge: P(crash ≥ x) = EDGE / x, so 1 − EDGE of rounds bust instantly at 1.00x */
export const EDGE = 0.97;
export const MAX_CRASH = 1000;

/** crash point from a uniform u ∈ [0, 1) */
export const crashFrom = (u: number) => {
  const c = EDGE / (1 - u);
  return c < 1 ? 1 : Math.min(c, MAX_CRASH);
};

/** uniform [0, 1) from the crypto RNG (practice rounds in the browser) */
export function rand01() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
}

/** cash-out multipliers are floored to 2 decimals */
export const floor2 = (m: number) => Math.floor(m * 100) / 100;
