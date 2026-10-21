import { GameShell } from "@/components/game/GameShell";

export default function Home() {
  return (
    <main className="game-page" aria-label="짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서">
      <GameShell initialStageId={process.env.NODE_ENV === "development"
        ? "world-02-stage-1" : "world-01-stage-1"} />
    </main>
  );
}
