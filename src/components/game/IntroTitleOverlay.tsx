"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";

const GAME_TITLE = "짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서";

export interface IntroTitleOverlayProps {
  readonly initialName: string;
  readonly onConfirm: (name: string) => void;
}

export function IntroTitleOverlay({
  initialName,
  onConfirm,
}: IntroTitleOverlayProps): ReactElement {
  const [phase, setPhase] = useState<"title" | "name">("title");
  const [name, setName] = useState(initialName);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPhase("name"), 2200);
    return () => window.clearTimeout(timeout);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onConfirm(name);
  };

  return (
    <div className="intro-title-overlay" role="dialog" aria-modal="true">
      {phase === "title" ? (
        <section className="intro-title-card" aria-labelledby="intro-game-title">
          <p className="intro-title-kicker">A VERY SHORT-LEGGED ADVENTURE</p>
          <h2 id="intro-game-title">{GAME_TITLE}</h2>
          <p>왕갈비뼈를 되찾기 위한 코기의 추격이 시작된다</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setPhase("name")}
          >
            시작하기
          </button>
        </section>
      ) : (
        <section className="intro-name-card" aria-labelledby="intro-name-title">
          <p className="intro-title-kicker">PLAYER PROFILE</p>
          <h2 id="intro-name-title">코기의 이름은 무엇인가요?</h2>
          <p>엔딩에서 주인이 이 이름을 불러요.</p>
          <form onSubmit={submit}>
            <label htmlFor="intro-player-name" className="sr-only">
              코기 이름
            </label>
            <input
              id="intro-player-name"
              autoFocus
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="primary-button" type="submit">
              모험 시작
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
