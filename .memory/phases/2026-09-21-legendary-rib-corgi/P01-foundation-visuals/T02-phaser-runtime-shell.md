# Task: T02 Phaser 3.90.0 실행 셸과 1280×720 스케일링

## Status: pending

## Goal

Next.js App Router에서 Phaser 게임을 SSR 없이 한 번만 생성하고 해제할 수 있는 Client Component 실행 셸을 만들며, 1280×720 기준 16:9 FIT 스케일·픽셀 렌더링·Arcade Physics를 확인 가능한 빈 게임 화면으로 제공한다.

## Decision Summary

- Phaser는 현재 Phaser 3 계열 최신 릴리스인 `3.90.0`으로 고정하고, Arcade Physics를 사용한다.
- React는 Phaser 캔버스의 외곽 셸만 담당하며, Phaser 인스턴스는 브라우저에서만 생성한다.

## Implementation

### I01. 의존성과 Phaser game factory

- Related Files:
  - `package.json` :: `dependencies.phaser`, `scripts`; modify
  - `package-lock.json`; modify
  - `src/game/config.ts` :: `GAME_WIDTH`, `GAME_HEIGHT`, `createPhaserConfig`; new
  - `src/game/createGame.ts` :: `createGame`; new

#### Details

- `phaser`를 `3.90.0`으로 설치하고 package-lock을 함께 갱신한다.
- **Signatures & Types**:
  ```typescript
  export const GAME_WIDTH = 1280;
  export const GAME_HEIGHT = 720;

  export interface CreateGameOptions {
    readonly parent: HTMLElement;
    readonly onReady?: (game: Phaser.Game) => void;
  }

  export function createPhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig;
  export function createGame(options: CreateGameOptions): Phaser.Game;
  ```
- Phaser config는 `type: Phaser.AUTO`, `width: 1280`, `height: 720`, `scale.mode: Phaser.Scale.FIT`, `scale.autoCenter: Phaser.Scale.CENTER_BOTH`, `pixelArt: true`, `roundPixels: true`, `physics.default: "arcade"`, `physics.arcade.gravity.y`를 게임 상수에서 주입하도록 구성한다.
- `createGame`은 config를 생성하고 게임을 반환한다. 호출자가 수명 주기를 소유하므로 내부에서 전역 singleton을 만들지 않는다.

### I02. Boot/Preload/Blank Scene

- Related Files:
  - `src/game/scenes/BootScene.ts` :: `BootScene`; new
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene`; new
  - `src/game/scenes/PrototypeScene.ts` :: `PrototypeScene`; new

#### Details

- `BootScene`은 asset manifest를 읽고 `PreloadScene`으로 전환한다.
- `PreloadScene`은 `AssetKind`별로 image·spritesheet·atlas·audio를 로드하고 필수 에셋 실패 시 화면과 console에 key/url을 표시한다.
- `PrototypeScene`은 픽셀 배경색, 테스트 바닥, 코기 idle 스프라이트를 1280×720 안에 배치해 스케일링을 확인한다.

### I03. Next Client Component 수명 주기

- Related Files:
  - `src/components/game/PhaserGame.tsx` :: `PhaserGame`; new
  - `src/app/page.tsx` :: `Home`; modify
  - `src/app/globals.css` :: game viewport styles; modify
  - `src/app/layout.tsx` :: language/metadata; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export interface PhaserGameProps {
    readonly className?: string;
    readonly onGameReady?: (game: Phaser.Game) => void;
  }

  export function PhaserGame(props: PhaserGameProps): JSX.Element;
  ```
- `PhaserGame`은 `'use client'`로 선언하고 `useRef<HTMLDivElement>`에 mount node를 둔다.
- `useEffect`는 mount node가 준비된 뒤 `createGame`을 정확히 한 번 호출하고 cleanup에서 `game.destroy(true)`를 호출한다.
- React Strict Mode에서 개발 중 effect가 재실행되어 Phaser 인스턴스가 중복 생성되지 않도록 `gameRef` guard를 둔다.
- `page.tsx`는 기존 Next starter UI를 제거하고 게임 viewport와 추후 React overlay가 들어갈 root를 제공한다.
- body는 16:9 캔버스를 중앙에 두며, 작은 화면에서 비율이 깨지지 않도록 `overflow: hidden`과 `aspect-ratio`를 적용한다.

## Acceptance Criteria

- [ ] `npm run dev`에서 Next 페이지에 1280×720 FIT Phaser 캔버스가 렌더링된다.
- [ ] 브라우저 콘솔에 `window is not defined`, hydration mismatch, Phaser 중복 생성 오류가 없다.
- [ ] 창 크기를 바꿔도 게임 좌표계는 1280×720을 유지하고 비율만 축소·확대된다.
- [ ] 페이지 이동 또는 HMR 후 Phaser 인스턴스가 destroy된다.
- [ ] Arcade Physics가 켜진 테스트 바닥과 코기 스프라이트가 표시된다.

## Validation

- `npm install` — lockfile과 의존성 설치 성공
- `npm run lint` — Client Component와 Phaser 타입 검사 통과
- `npm run build` — SSR 번들에 Phaser 초기화 코드가 실행되지 않고 production build 통과
- `npm run dev` — 1280×720 canvas와 테스트 코기 수동 확인

## Commit Message

```text
feat(engine): mount Phaser 3.90 game shell in Next.js

Plan: 2026-09-21-legendary-rib-corgi
Phase: P01-foundation-visuals
Task: T02-phaser-runtime-shell

- Add Phaser 3.90 Arcade Physics game factory and scenes
- Add SSR-safe React mount with fixed 16:9 pixel viewport
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
