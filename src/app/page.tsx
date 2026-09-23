import { GameShell } from "@/components/game/GameShell";

export default function Home() {
  return (
    <main className="game-page">
      <section className="game-frame" aria-labelledby="game-title">
        <header className="game-header">
          <div>
            <p className="game-kicker">A VERY SHORT-LEGGED ADVENTURE</p>
            <h1 id="game-title">짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서</h1>
          </div>
          <span className="game-status">WORLD 01  ·  무법지대 뒷골목</span>
        </header>
        <GameShell initialStageId="world-01-stage-1" />
      </section>
    </main>
  );
}
