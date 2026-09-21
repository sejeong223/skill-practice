import { GameShell } from "@/components/game/GameShell";

export default function Home() {
  return (
    <main className="game-page">
      <section className="game-frame" aria-labelledby="game-title">
        <header className="game-header">
          <div>
            <p className="game-kicker">LEGENDARY RIB RETRIEVAL</p>
            <h1 id="game-title">전설의 무한 육즙 왕갈비뼈</h1>
          </div>
          <span className="game-status">PROTOTYPE  ·  T02</span>
        </header>
        <GameShell initialStageId="world-01-stage-1" />
      </section>
    </main>
  );
}
