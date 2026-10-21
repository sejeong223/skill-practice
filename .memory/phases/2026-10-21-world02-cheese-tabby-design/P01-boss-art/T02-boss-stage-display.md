# Task: T02 치즈 태비 에셋 등록과 보스 맵 표시

## Status: pending

## Goal

T01의 치즈 태비 그림을 필수 게임 에셋으로 로드하고, `world-02-stage-boss`에 대기 프레임을 보여줘 실제 놀이터 화면에서 크기·방향·실루엣을 확인할 수 있게 한다.

## Decision Summary

- 기존 `world-02-boss` 데이터의 이름과 `bite` 보상은 이미 등록돼 있다. 이번 Task는 **시각 표시만** 연결하며 전투·피격·승리 규칙은 별도 기존 보스 Task에서 이 스프라이트를 재사용한다.
- 원본 오른쪽 얼굴을 왼쪽에 선 코기 쪽으로 향하게 하기 위해 게임 오브젝트에만 `flipX(true)`를 준다. PNG를 반전 복제하지 않는다.

## Implementation

### I01. 필수 스프라이트 등록

- Related Files:
  - `src/game/assets/assetManifest.json` :: `world-02-cheese-tabby-boss` 엔트리; modify.
  - `src/game/assets/assetTypes.ts` :: `PixelAssetDefinition` 규격; read-only.
  - `src/game/scenes/PreloadScene.ts` :: 기존 `loadAsset`의 `spritesheet` 로딩; read-only.
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.png` :: T01 산출물; read-only.

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 PixelAssetDefinition의 단일 엔트리
  {
    key: "world-02-cheese-tabby-boss",
    kind: "spritesheet",
    url: "/assets/pixel/characters/world-02/cheese-tabby-boss.png",
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 4,
    worldId: "world-02",
    required: true
  }
  ```
- **Data & Schema Fields**: 위의 에셋 키만 새로 추가한다. 저장 스키마, `world-02-stage-boss`, `world-02-boss`, `bite`와 기존 월드 1 에셋 키는 바꾸지 않는다.
- **Execution Flow / Logic**: T01의 PNG가 존재하고 512×128인지 확인한 뒤 manifest에 위 엔트리를 한 번 등록한다. `PreloadScene`가 기존 `spritesheet` 분기로 프레임 0~3을 생성한다. 월드 1 삼색이 키·파일을 재사용하지 않는다.
- **Error & Exception Handling**: 파일 경로·크기·중복 키가 틀리면 필수 에셋 검증이 실패하게 둔다. T01 산출물이 없는 상태에서 에셋을 `required:true`로 먼저 등록하지 않는다.

### I02. 보스 스테이지에서 그림만 표시

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageScene.cheeseTabbySprite`, `create`, `SHUTDOWN` 정리; modify.
  - `src/game/data/worlds.ts` :: `world-02-stage-boss`의 기존 1920×720 맵과 보스 이름; read-only.
  - `src/game/systems/World01CalicoBoss.ts` :: 월드 1의 프레임 전환·방향 관례; read-only.
  - `.memory/test-plans/browser-world02-cheese-tabby.mjs` :: 실제 보스 맵의 이미지 표시·방향·누락 에셋 검사; new.
  - `.memory/reviews/2026-10-21-cheese-tabby-in-game.png` :: 브라우저 확인 스크린샷; new.

#### Details

- **Signatures & Types**:
  ```typescript
  private cheeseTabbySprite?: Phaser.GameObjects.Sprite;
  // StageScene.create 내부
  if (stage.id === "world-02-stage-boss") {
    this.cheeseTabbySprite = this.add.sprite(1280, 446, "world-02-cheese-tabby-boss", 0)
      .setDepth(10).setFlipX(true);
  }
  // SHUTDOWN 정리
  this.cheeseTabbySprite?.destroy();
  this.cheeseTabbySprite = undefined;
  ```
- **Data & Schema Fields**: Phaser 스프라이트 필드만 추가한다. 프레임 0의 발끝 y≈122가 보스 맵 바닥 y=504와 맞도록 오브젝트 중심 y=446, x=1280을 사용한다. 오브젝트에 물리 body·적 ID·충돌 판정·체력은 등록하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 월드 1 `if (stage.id === "world-01-stage-boss")` 분기와 분리해 월드 2 보스 ID에서만 생성한다. 이미 로딩된 키를 사용하며 원본 프레임 0을 표시한다.
  2. `flipX(true)`로 왼쪽의 플레이어를 바라보게 하고 `depth=10`으로 바닥보다 앞에 둔다. 게임의 1280×720 내부 해상도와 카메라 설정을 바꾸지 않는다.
  3. 스테이지 종료·재시작 때 기존 정리 흐름에서 스프라이트를 제거한다. 월드 1 삼색이 컨트롤러·피격 판정에는 이 필드를 연결하지 않는다. 나중의 보스 구현은 새 스프라이트를 사용해 프레임 1~3과 전투 동작을 연결한다.
  4. 브라우저 테스트는 개발 모드의 첫 인트로를 우회하는 **테스트 전용 CDP 씬 시작**으로 `world-02-stage-boss`에 진입한다. 캔버스에 새 키의 보이는 스프라이트가 x=1280/y=446·프레임 0·왼쪽 방향으로 있으며 월드 1 보스 오브젝트가 없고, 콘솔 에셋 오류가 없는지 확인한 뒤 스크린샷을 저장한다. 화면 크기를 바꾸거나 저장 진행도를 초기화하는 제품 코드는 넣지 않는다.
- **Error & Exception Handling**: 새 키가 누락된 경우 조용히 다른 고양이를 보여주지 말고 에셋 검증 실패로 발견한다. 씬을 두 번 시작한 뒤 그림이 중복되지 않도록 이전 오브젝트를 정리한다. 정적 시각 오브젝트가 기존 보스 스테이지의 진행 이벤트나 충돌을 변경하지 않아야 한다.

## Acceptance Criteria

- [ ] 월드 2 보스 스테이지에서 치즈 태비가 왼쪽의 코기를 보는 대기 자세로 보인다. 원본 PNG의 네 포즈는 여전히 오른쪽을 본다.
- [ ] 월드 1 삼색이와 놀이터의 잠자는 고양이 외형·판정이 그대로이며 치즈 태비 에셋이 독립 키로 필수 등록된다.
- [ ] 브라우저에서 누락 텍스처·중복 스프라이트·캔버스 크기 변화가 없고, 1배 크기와 스크린샷에서 호루라기·줄무늬가 읽힌다.

## Validation

- `node scripts/generate-world02-cheese-tabby.mjs --check` — T01 PNG/원본 일치.
- `node --test scripts/world02-cheese-tabby-art.test.mjs` — 프레임·투명도·시각 계약 회귀.
- `node scripts/validate-assets.mjs` — 새 필수 키와 파일, 전체 에셋 검증.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run lint` — 린트.
- `npm.cmd run build` — 빌드.
- `node .memory/test-plans/browser-world02-cheese-tabby.mjs` — Chrome CDP에서 스테이지 직접 진입·화면 캡처·오류 확인.
- `view_image`로 저장된 게임 스크린샷의 실제 표시 크기와 방향을 확인한다.

## Commit Message

```text
feat(world02): 치즈 태비 보스 그림을 스테이지에 표시

Plan: 2026-10-21-world02-cheese-tabby-design
Phase: P01-boss-art
Task: T02-boss-stage-display

- 치즈 태비 스프라이트 시트를 필수 에셋으로 등록
- 월드 2 보스 맵의 방향·크기·표시 상태 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
