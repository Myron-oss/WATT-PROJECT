export const CONFIG = {
  ticker: "$WATT",
  contractAddress: "2dywBj26GeL5J7n2Unass4ydtMr8MDLzNJ5n1bNxpump",
  pumpFunUrl: "https://pump.fun/2dywBj26GeL5J7n2Unass4ydtMr8MDLzNJ5n1bNxpump",
  xUrl: "https://x.com/WATT_PROJECT",

  // weekly leaderboard
  season: "s1", // change this to wipe the game: all coins + the leaderboard restart (old data expires by itself)
  minWattToPlay: 1, // coins are only handed to wallets holding at least this much $WATT
  weeklyCoins: 100, // every wallet starts each week (monday 00:00 utc) with this many coins
  minWattForPrize: 100_000, // a winner must hold at least this much $WATT when prizes are paid
  prizesSol: [0.25, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05], // top 10, in SOL
};
