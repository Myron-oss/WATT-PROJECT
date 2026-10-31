import { Nav } from "@/components/Nav";
import { Game } from "@/components/Game";
import { Comic } from "@/components/Comic";
import { Contract } from "@/components/Contract";
import { Leaderboard } from "@/components/Leaderboard";
import { FxCanvas } from "@/components/FxCanvas";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Game />
        <Comic />
        <Leaderboard />
        <Contract />
      </main>
      <FxCanvas />
    </>
  );
}
