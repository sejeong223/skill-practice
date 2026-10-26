# Task: T02 보스 장면 정렬과 실제 화면 검증

## Status: pending

## Goal

T01에서 새로 그린 치즈 태비가 월드 2 보스 장면에서 코기와 함께 같은 게임 캐릭터로 보이는지 확인하고, 네 자세의 발 위치·공 발사점·명중 범위·체력 표시가 새 원화와 일치하도록 현재 런타임 설정을 확정한다. 정적인 시트만 확인하고 끝내지 않는다.

## Decision Summary

- T01 원화가 96×96 네 프레임, 로컬 발밑 `y=78..80`, 오른쪽 방향을 따른다. 기존 치즈 태비 디자인 문서는 이 Task에서도 참조하지 않는다.
- 전투 이름·체력·공의 한 번 튀는 동작은 유지한다. 이번 Task는 그림과 좌표의 정렬 및 실제 표시 검증이며 새 공격 규칙을 만드는 작업이 아니다.

## Implementation

### I01. 에셋 프레임과 보스 스프라이트의 화면 계약

- Related Files:
  - `src/game/assets/assetManifest.json` :: `world-02-cheese-tabby-boss` 엔트리 — PNG 크기·프레임 수 등록; modify
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`, `handleLaterBossDefeat` — 첫 등장 위치와 네 번째 패배 프레임; modify
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.png` :: T01 게임용 시트 — 프레임·발밑 정렬 확인; read-only
  - `src/game/systems/CheeseTabbyBallPattern.ts` :: `telegraph`, `launch`, `update` — 프레임 1·2·0 전환 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // Existing runtime contracts; keep asset key and frame indices stable.
  StageScene.create(data: StageSceneData): void
  StageScene.handleLaterBossDefeat(stage: StageDefinition): Promise<void>
  CheeseTabbyBallPattern.telegraph(): void
  CheeseTabbyBallPattern.launch(targetX: number, serial: number): void
  ```
- **Data & Schema Fields**:
  - `assetManifest.json` 치즈 태비 엔트리: `{ key: "world-02-cheese-tabby-boss", kind: "spritesheet", url: "/assets/pixel/characters/world-02/cheese-tabby-boss.png", frameWidth: 96, frameHeight: 96, frameCount: 4, worldId: "world-02", required: true }`. 다른 보스 엔트리는 변경하지 않는다.
  - 보스 스프라이트 첫 위치 `(x=1280, y=472)`, `depth=10`, `flipX=true`, `frame=0`. 96픽셀 시트 중심 원점에서 로컬 발밑 `y=80`이 세계 좌표 `504`에 닿는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01 출력 PNG가 384×96이고 네 프레임이 있는지 확인한다. 현재 작업 트리에는 이전 시도에서 바뀐 프레임 크기·장면 위치가 이미 커밋되지 않은 상태로 있을 수 있으므로 이 값을 새로 중복 구현하지 말고 목표값과 비교해 정리한다.
  2. Core Processing: `StageScene`은 월드 2에만 `y=472`를 적용하고 월드 3·4·5 보스의 위치를 유지한다. 보스 패배 시 기존 `setFrame(3)`을 계속 사용한다. 좌우를 뒤집어 첫 등장에 코기를 바라보게 한다.
  3. Error & Exception Handling: 프레임 3이 비었거나 투명 범위를 벗어나면 T01 원화부터 수정한다. 시트 해상도를 임의로 확대해 빈 그림을 가리지 않는다.
  4. State Transition & Return: 게임에서 로드한 텍스처가 `frameWidth=96`, `frameHeight=96`이고 상태 변화마다 0→1→2→0 및 패배 3으로 이동한다.

### I02. 몸통 명중 범위, 발사점, HUD 정렬

- Related Files:
  - `src/game/systems/BossEncounter.ts` :: `BossEncounter.getHitBounds`, 생성자 HUD, `drawHealth`, `acceptSlipperHit`, `acceptToolHit`, `tryBarkStun` — 새 그림에 맞는 공통 판정; modify
  - `src/game/systems/CheeseTabbyBallPattern.ts` :: `CheeseTabbyBallPattern.launch` — 공격 프레임 앞발 위치에서 고무공 생성; modify
  - `src/game/systems/cheeseTabbyBallPhysics.ts` :: `advanceCheeseBall` — 바닥 `floorY=504`와 1회 튀기 동작; read-only
  - `scripts/world02-boss-ball.test.mjs` :: 시작 좌표에서 바닥에 한 번 튀고 사라지는 테스트; modify

#### Details

- **Signatures & Types**:
  ```typescript
  BossEncounter.getHitBounds(): Phaser.Geom.Rectangle
  CheeseTabbyBallPattern.launch(targetX: number, serial: number): void
  advanceCheeseBall(state: CheeseBallMotion, deltaMs: number, floorY?: number): CheeseBallMotion | null
  ```
- **Data & Schema Fields**:
  - 월드 2 전용 명중 직사각형: `x=sprite.x-44`, `y=sprite.y-30`, `width=88`, `height=62`. 나머지 보스는 `sprite.getBounds()` 그대로. T01 원화의 본체·머리와 겹치는지 실제 화면에서 확인한다.
  - 월드 2 HUD: 이름 `sprite.y-90`, 경고 `sprite.y-119`, 체력 막대 `sprite.y-68`. 다른 월드 오프셋은 이름 `-112`, 경고 `-143`, 막대 `-89`를 유지한다.
  - 공 시작 위치와 속도: `x=sprite.x + direction*42`, `y=sprite.y+12`, `vy=-420`; `direction`은 코기 위치가 보스보다 왼쪽이면 `-1`, 아니면 `1`. 왼쪽 첫 등장에서 공 시작은 `(1238, 484)`이고, 바닥은 `504`다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 공격 프레임 2의 앞발 끝이 로컬 `x≈88..94`, `y≈54..66`에 있고, 좌우 반전 후 발사점이 그 앞에 놓이는지 1배 게임 화면에서 확인한다.
  2. Core Processing: 현재 `getHitBounds()`는 슬리퍼·무기·짖기 거리 모두에서 사용된다. 원화가 T01 명세대로 나오면 위 숫자를 유지해 판정을 일치시킨다. 공은 앞발 부근에서 생성한 뒤 기존 속도·한 번 튀는 로직으로 진행한다. 기하를 바꿔야 할 정도로 몸이 벗어난 경우 임의 수치 수정 대신 T01 원화의 앵커 계약을 먼저 바로잡는다.
  3. Error & Exception Handling: 그림과 공 사이에 눈에 띄는 간격이 있거나, 보이는 머리·몸통과 명중 사각형이 어긋나면 T02를 완료하지 않는다. 다른 월드 보스의 판정과 HUD 숫자는 변경하지 않는다.
  4. State Transition & Return: 공격 예고·공격·대기·패배의 전투 흐름과 체력/피격 처리가 그대로 동작한다.

### I03. 실제 브라우저 화면에서 레퍼런스와 비교

- Related Files:
  - `.memory/test-plans/browser-world02-cheese-tabby.mjs` :: 보스 장면 직접 진입, `laterBossSprite` 검사와 게임 캡처; modify
  - `.memory/reviews/2026-10-26-cheese-tabby-in-game.png` :: 코기와 새 치즈 태비가 함께 보이는 최종 화면; modify
  - `public/assets/pixel/characters/corgi/corgi-run.png`, `public/assets/pixel/characters/world-04/tuxedo-boss.png`, `public/assets/pixel/characters/world-01/calico-boss.png` :: 시각 비교 기준; read-only
  - `scripts/world02-cheese-tabby-art.test.mjs` :: T01에서 새 그림용으로 바꾼 구조 검사; read-only

#### Details

- **Signatures & Types**:
  ```text
  Browser state.cat = {
    active: boolean, visible: boolean, x: number, y: number,
    frameWidth: number, frameHeight: number, flipX: boolean,
    frame: number, texture: string, depth: number
  }
  ```
- **Data & Schema Fields**:
  - 검증 기대값: `stage="world-02-stage-boss"`, 캔버스 `1280×720`, cat 1개, `(x=1280,y=472)`, `frameWidth=96`, `frameHeight=96`, `flipX=true`, `texture="world-02-cheese-tabby-boss"`, 누락 에셋/콘솔 오류 0개.
  - 스크린샷에는 컷신 오버레이가 없고 코기와 치즈 태비가 같은 화면에 있어야 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 CDP 스크립트의 보스 참조는 `scene.laterBossSprite`여야 한다. 예전 `scene.cheeseTabbySprite`는 현재 코드에 없으므로 쓰지 않는다. 저장 진행값으로 월드 2를 열고 보스 인트로는 이미 본 상태로 설정한다.
  2. Core Processing: 보스 장면에 두 번 진입해 중복 이미지가 생기지 않는지 확인한다. 첫 대기 프레임과 1·2·3 프레임을 실제 Phaser 텍스처로 보여 모두 선명하고 잘리지 않는지 확인한다. 최종 캡처를 저장하고 코기와 치즈 태비가 같은 그림 언어로 보이는지, 제공된 삼색이·턱시도 시트와 육안 비교한다.
  3. Error & Exception Handling: 테스트의 수치 단언만 통과하고 그림체가 이질적이면 T01 원화를 다시 수정한 뒤 생성·검증을 다시 실행한다. 에셋 404나 캔버스 예외가 있으면 실패로 처리한다.
  4. State Transition & Return: 실제 게임 화면에서 정상 표시된 최종 스크린샷과 통과 결과를 남긴다.

## Acceptance Criteria

- [ ] 코기와 나란히 보이는 월드 2 보스 장면에서 치즈 태비의 얼굴·털·윤곽이 레퍼런스 캐릭터와 같은 작품의 그림체로 읽힌다.
- [ ] 4프레임 모두 로드·표시되고 발이 바닥과 일치하며, 예고와 공격의 발/얼굴이 프레임마다 실제로 움직인다.
- [ ] 슬리퍼·무기·짖기의 판정은 보이는 고양이에 맞고 고무공은 앞발 부근에서 출발해 한 번 튄다.
- [ ] 월드 3~5 보스의 위치·HUD·판정과 기존 체력·공격 주기는 바뀌지 않는다.
- [ ] 새 PNG·미리보기·브라우저 캡처가 새 디자인으로 갱신되고 자동 검사가 통과한다.

## Validation

- `node scripts/generate-world02-cheese-tabby.mjs --check` — 정본·게임 시트·미리보기 동기화.
- `node --test scripts/world02-cheese-tabby-art.test.mjs scripts/world02-boss-ball.test.mjs` — 시트와 공 1회 튀기 동작 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 오류 0개.
- `node node_modules/eslint/bin/eslint.js .` — 린트 오류 0개.
- `node node_modules/next/dist/bin/next build` — 프로덕션 빌드 통과.
- `node .memory/test-plans/browser-world02-cheese-tabby.mjs` — 실제 브라우저에서 96×96 프레임, 바닥 정렬, 좌우 방향, 재진입, 에셋 오류 0개 확인·캡처.
- `git diff --check` — 공백 오류 없음.
- 최종 게임 캡처와 코기·삼색이·턱시도 PNG를 1배와 4배로 직접 비교해 그림체 이질감이 해소되었음을 확인한다.

## Commit Message

```text
fix(game): 새 치즈 태비 그림을 보스 전투에 정렬하기

Plan: 2026-10-26-world02-cheese-tabby-reference-redraw
Phase: P01-reference-art-rebuild
Task: T02-runtime-alignment-and-browser-review

- 96픽셀 네 프레임과 월드 2 보스의 바닥·HUD·명중 범위를 일치
- 고무공 발사점과 브라우저 시각 검증을 새 원화에 맞춤
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
