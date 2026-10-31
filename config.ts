export const CONFIG = {
  ticker: "$WATT",
  contractAddress: "PASTE_CA_HERE",
  pumpFunUrl: "https://pump.fun/PASTE_CA_HERE",
  xUrl: "https://x.com/PASTE",
  telegramUrl: "https://t.me/PASTE",

  // weekly leaderboard
  weeklyCoins: 100, // every wallet starts each week (monday 00:00 utc) with this many coins
  minWattForPrize: 100_000, // a winner must hold at least this much $WATT when prizes are paid
  prizesSol: [0.25, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05], // top 10, in SOL
};
