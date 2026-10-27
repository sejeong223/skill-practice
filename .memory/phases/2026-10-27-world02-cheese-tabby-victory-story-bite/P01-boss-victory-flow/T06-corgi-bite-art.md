# Task: T06 무는 코기 이미지 제작과 물기 연출

## Status: pending

## Goal

E 물기를 사용하면 기존 코기 그림과 어울리는 입 벌림→물기→입 닫기 이미지가 약 320ms 동안 실제 게임 화면에 보인다. 해금 화면의 설명만 바뀌는 데 그치지 않고, 치명타·빗나감 어느 경우에도 물기 동작이 보이며 장착 의상과 물리 충돌 상태는 유지된다.

## Decision Summary

- 사용자 추가 요청(2026-10-27): 무는 코기 이미지도 이번 계획에 포함한다. 이미지는 `public/assets/pixel/characters/corgi/corgi-bite.png`에 새로 만들고 T05의 E 물기 성공 경로에 연결한다.
- 현재 manifest의 `corgi-bite`는 파일이 없는 32×48 선택 에셋이다. 실제 플레이어의 `corgi-run.png`는 프레임당 112×128, 오른쪽을 보고 발 기준선은 y≈99이다. 같은 좌표계의 4프레임 448×128 투명 PNG로 맞춘다.
- 장착 의상을 가리지 않도록 `corgi-bite.png`에는 얼굴 앞쪽의 불투명한 주둥이·턱 변화만 그리고 몸통·발·장비 영역은 투명하게 둔다. `PlayerAnimator`는 기존 플레이어 텍스처 위에 이 이미지를 겹쳐 보여준다. `PlayerAppearanceTextures`의 run/bark 계약과 장비 시스템은 바꾸지 않는다.

## Implementation

### I01. 기존 픽셀 아트에 맞는 4프레임 비트맵 제작

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-bite.png` :: 오른쪽 방향 물기 얼굴·턱 4프레임 투명 스프라이트 시트; new
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: 체형·색·오른쪽 방향·112×128 좌표 참조; read-only
  - `public/assets/pixel/characters/corgi/corgi-bark.png` :: 입 벌림·외곽선·발 위치 참조; read-only
  - `src/game/assets/assetManifest.json` :: `corgi-bite` 항목의 실제 규격과 필수 로드 전환; modify
  - `scripts/corgi-bite-art.test.mjs` :: 이미지 크기·알파·프레임/manifest 계약; new

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 PixelAssetDefinition의 corgi-bite 데이터 계약
  { key: "corgi-bite", kind: "spritesheet",
    url: "/assets/pixel/characters/corgi/corgi-bite.png",
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true }
  ```
- **Data & Schema Fields**:
  - PNG 총 크기 `448×128`, RGBA 알파, 가로 4프레임. 각 프레임의 기준 영역은 `frameIndex*112 ... frameIndex*112+111`이다. 아래쪽 발은 기존 run 이미지에 남으므로 물기 파일에는 발 픽셀이 없다.
  - 프레임 0은 입을 벌리기 시작, 1은 크게 벌린 턱, 2는 닫아 무는 순간, 3은 턱을 거두는 모습이다. 원본은 오른쪽을 보고 왼쪽 방향은 `flipX`로 만든다. 색·외곽선 두께·픽셀 크기는 기존 `corgi-run`/`corgi-bark`와 맞춘다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 이미지 제작 전에 기존 run/bark PNG를 실제로 열어 픽셀 배치와 배경 투명도를 확인한다. 비트맵 제작 시 imagegen 도구에 두 그림을 참조로 주고, 4프레임의 턱 움직임·투명 배경·정확한 시트 배치를 요구한다.
  2. Core Processing: 각 칸에서 기존 얼굴의 닫힌 입이 이중으로 보이지 않도록 주둥이 앞부분은 불투명한 털색으로 덮고 입·턱만 바꾼다. 머리 윗부분·몸통·의상 영역은 투명해 기본 run/의상 이미지가 계속 보이게 한다. 생성 결과를 112×128 그리드에 맞춰 확인한 뒤 실제 PNG로 저장한다.
  3. Error & Exception Handling: imagegen 결과가 프레임 경계에 잘리거나 확대 보간·불투명 배경을 만들면 그대로 채택하지 않고 다시 생성/수정한다. 테스트에서 알파 채널, 네 칸 각각의 비어 있지 않은 주둥이 픽셀, 몸통·발 영역 투명도, manifest 규격을 검사한다.
  4. State Transition & Return: `PreloadScene`의 기존 required asset 루프가 `corgi-bite`를 로드한다. 누락 시 이미 구현된 필수 에셋 오류 메시지가 표시된다. 새 저장 필드는 없다.

### I02. 물기 성공 시 그림을 표시하고 안전하게 되돌리기

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `triggerBite`, `stopBite`, `update`, `destroy` — 4프레임 물기 오버레이 관리; modify
  - `src/game/scenes/StageScene.ts` :: E 물기 성공 경로, 죽음/재시도/승리/종료 처리 — 타이머 시작과 중단; modify
  - `src/game/scenes/PrototypeScene.ts` :: E 물기 성공 경로와 장면 종료 처리 — 동일한 이미지 표시; modify
  - `src/game/entities/PlayerWearables.ts` :: `sync` — 기존 run/bark/액세서리 레이어 계약 확인; read-only
  - `src/game/entities/Player.ts` :: `alignFeetToFrame`, `getAppearanceTextures` — 본체 피벗·충돌 범위 유지 확인; read-only
  - `scripts/bite-presentation.test.mjs` :: E 시각 효과·타이밍·방향·초기화 검증; new
  - `scripts/bark-presentation.test.mjs` :: 기존 짖기와 의상 표시 회귀; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export const BITE_PRESENTATION_MS = 320;
  public triggerBite(now: number): void;
  public stopBite(): void;
  public update(now?: number, deltaMs?: number): void;
  public destroy(): void;
  // PlayerAnimator 내부: biteImage?: Phaser.GameObjects.Sprite;
  // PlayerAnimator 내부: biteStartedAt = 0; biteUntil = 0;
  ```
- **Data & Schema Fields**: 프레임 번호는 `min(3, floor((now-biteStartedAt)/80))`; 표시는 320ms 뒤 끝난다. `SkillSystem`의 6000ms 재사용 대기와 시각 효과의 320ms는 별개의 타이머다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T05의 `SkillSystem.use("bite", skillElapsedMs).accepted===true`일 때만 `triggerBite(time)`를 호출한다. 사거리 밖에서 빗나가도 물기 사용 자체는 성공이므로 이미지를 보여준다. 잠김/쿨타임 중에는 호출하지 않는다.
  2. Core Processing: `PlayerAnimator`가 `corgi-bite` Sprite를 플레이어와 같은 x/y·origin·scale·`flipX`에 두고 플레이어 및 장신구보다 위 깊이에 표시한다. 80ms마다 프레임 0→1→2→3으로 진행하고 320ms에 숨긴다. 기본 플레이어 run/의상 텍스처를 교체하지 않아 옷과 액세서리가 계속 남는다. W 짖기와 E 물기가 같은 순간 겹치면 마지막으로 승인된 동작의 얼굴 표현 하나만 보이도록 기존 bark 표시와 bite 표시를 서로 중지한다.
  3. Error & Exception Handling: 죽음·재시도·컷신 진입·Scene shutdown에서는 `stopBite()`로 즉시 숨기고 `destroy()`에서 Sprite를 파괴한다. 텍스처가 뜻밖에 없으면 시각 표시만 건너뛰고 T05의 피해·쿨타임 처리에는 영향을 주지 않는다.
  4. State Transition & Return: 물기 중 좌우 방향 전환과 움직임에도 얼굴 이미지가 본체를 따라가며, 끝나면 run/의상/액세서리 표현이 그대로 남는다. 플레이어의 physics body 크기·offset·HP·물기 명중 판정은 바꾸지 않는다.

### I03. 이미지와 게임 화면 검증

- Related Files:
  - `scripts/corgi-bite-art.test.mjs` :: 448×128·RGBA·4프레임·투명 몸통 검증; new
  - `scripts/bite-presentation.test.mjs` :: 0/79/80/159/160/239/240/319/320ms 프레임·종료 경계, 양방향, 옷, 중단 검증; new
  - `.memory/test-plans/2026-10-27-world02-cheese-tabby-victory-review.md` :: 브라우저 시각 확인 결과; modify (T03에서 생성)

#### Details

- 브라우저에서 기본 코기와 옷/장신구를 장착한 코기 각각 E 입력을 확인한다. 오른쪽/왼쪽 방향에서 주둥이가 보이는지, 물기 후 본래 외형으로 돌아오는지, 명중과 빗나감에서 모두 동작이 나오는지, 잠김/쿨타임 중에는 재생되지 않는지 확인한다. 파일 유무만 보는 검사는 실제 물기 연출 검증으로 인정하지 않는다.

## Acceptance Criteria

- [ ] `corgi-bite.png`가 기존 코기 화풍의 4프레임 무는 얼굴 이미지로 존재하고 manifest에서 필수 112×128 스프라이트 시트로 로드된다.
- [ ] E 사용 직후 약 320ms 동안 입 벌림·물기·복귀 동작이 보이며 왼쪽/오른쪽 모두 자연스럽다.
- [ ] 의상과 장신구, 플레이어 발 위치·물리 충돌·기존 짖기 연출은 유지된다.
- [ ] 물기 미해금 또는 6초 쿨타임 중 E는 이미지를 재생하지 않는다.

## Validation

- `node --test scripts/corgi-bite-art.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-skill.test.mjs` — 이미지·애니메이션·기존 의상과 스킬 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — `PlayerAnimator`와 두 Scene 타입 오류 0개.
- `node node_modules/eslint/bin/eslint.js src/game/entities/PlayerAnimator.ts src/game/scenes/StageScene.ts src/game/scenes/PrototypeScene.ts scripts/corgi-bite-art.test.mjs scripts/bite-presentation.test.mjs` — lint 오류 0개.
- `node node_modules/next/dist/bin/next build` — 필수 이미지가 포함된 게임 빌드 통과.
- 브라우저에서 실제 프레임·발 정렬·좌우 반전·의상/장신구·컷신/재시도 중단을 확인하고 `.memory/test-plans/2026-10-27-world02-cheese-tabby-victory-review.md`에 기록한다.

## Commit Message

```text
feat(game): 무는 코기 이미지를 물기 동작에 연결하기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T06-corgi-bite-art

- 코기 물기 4프레임 이미지를 제작하고 필수 에셋으로 등록
- E 물기 시 의상을 유지한 채 물기 연출을 표시
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
