# Task: T03 물기 때 코기 본체 한 장만 표시

## Status: done

## Goal

E 물기 320ms 동안 `Player` 본체가 전신 물기 4프레임을 재생해 얼굴이 두 겹으로 보이지 않게 한다. 기본 코기, 상점 의상 5종, 직접 그린 의상에서도 각자의 물기 텍스처를 사용하고 장신구·장비·물리 판정을 유지한다.

## Decision Summary

- T01 기본 `corgi-bite`와 T02의 의상별 `*-bite` 시트가 준비되어 있다. 기존 `PlayerAnimator.biteImage` 별도 Sprite를 제거하고 플레이어의 텍스처/프레임만 바꾼다.
- 의상 간 RGBA 차이로 런타임 물기 이미지를 합성하지 않는다. 상점 의상은 T02의 정적 시트를 사용하고, 직접 그린 의상만 기존 run/bark와 동일한 방식으로 T02 물기 템플릿에 사용자 색을 입힌 동적 텍스처를 만든다.

## Implementation

### I01. 기본·상점·직접 그린 의상의 bite 키 연결

- Related Files:
  - `src/game/entities/Player.ts` :: `PlayerAppearanceTextures`, `appearanceTextures`, `getAppearanceTextures`, `setAppearanceTextures` — bite 키 추가; modify
  - `src/game/entities/PlayerWearables.ts` :: `TexturePair`, `BARE_CORGI`, `setEquipment`, `createCustomTextures`, `removeCustomTextures`, `destroy` — bite 텍스처 선택·생성·정리; modify
  - `src/game/entities/customOutfitTexture.ts` :: `OutfitPose`, `colorizeCustomOutfitPixels` — bite 템플릿의 네 프레임 착색; modify
  - `src/game/assets/assetManifest.json` :: T02에 등록된 상점·템플릿 bite 키 확인; read-only
  - `scripts/goodboy-wearables.test.mjs` :: 기본/상점/직접 그린 의상 bite 키와 동적 텍스처 정리; modify
  - `scripts/custom-outfit-paint.test.mjs` :: 사용자 색이 bite 네 프레임에서도 유지되는지; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export type PlayerAppearanceTextures = Readonly<{
    run: string;
    bark: string;
    bite: string | null;
  }>;
  export type OutfitPose = "run" | "bark" | "bite";
  export function colorizeCustomOutfitPixels(
    template: Uint8ClampedArray,
    width: number,
    height: number,
    pose: OutfitPose,
    design: CustomOutfitDesign,
  ): Uint8ClampedArray;
  // PlayerWearables 내부
  type TextureSet = { run: string; bark: string; bite: string | null };
  ```
- **Data & Schema Fields**: 기본 `BARE_CORGI={run:"corgi-run",bark:"corgi-bark",bite:"corgi-bite"}`. 상점 의상 `outfitId`는 `pink-caterpillar-suit|banana-peel-suit|bee-bodysuit|hotdog-outfit|diamond-armor`이고 key는 `wear-${outfitId}-{run|bark|bite}`이다. 직접 그린 의상은 장면 인스턴스·디자인 버전을 포함한 기존 prefix에 `-bite`를 추가한다. bite는 448×128×4 RGBA, 4프레임; bark는 112×128×4 RGBA, 1프레임이다. `CosmeticId`, `CustomOutfitDesign`, 저장 데이터에 새 필드를 추가하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 의상 `run`, `bark`, `bite` key 세 개가 모두 `scene.textures.exists`이면 해당 세트를 선택한다. 누락된 정적 bite는 run/bark를 유지하되 `bite:null`로 둔다. 기본 세트는 필수 manifest 에셋을 사용한다.
  2. Core Processing: `createCustomTextures`의 pose 순회를 `["run","bark","bite"]`로 늘린다. bite는 `custom-outfit-template-bite` 448×128 소스를 `colorizeCustomOutfitPixels`로 칠한다. 이 함수의 프레임 수는 `pose==="bark"?1:4`로 바꾸고 각 pose에서 폭/높이/56×32 셀을 검증한다. `run`과 `bite` 캔버스 텍스처에는 `"0".."3"` 프레임을 등록한다. `ownedTextureKeys`에 bite도 넣어 의상 변경/파괴 때 정리한다.
  3. State Transition & Return: `setEquipment`는 이전 텍스처 제거 전에 현재 플레이어의 run/bark/bite 표시 상태와 프레임을 읽는다. 안전한 기본 run으로 임시 전환한 뒤 이전 동적 텍스처를 제거하고 새 세트를 선택한다. 물기 중이었다면 새 bite의 같은 0~3 프레임으로, 새 bite가 없으면 새 run으로 돌아간다. 기존 장신구 레이어와 `EquipmentVisual`은 계속 `Player`를 따라간다.
  4. Error & Exception Handling: custom bite 캔버스 생성에 실패하면 부분 생성 키를 모두 제거하고 기본 세트로 복구한다. 색상 형식/셀 수 오류는 기존 `colorizeCustomOutfitPixels` 예외 계약을 유지한다. 공용 manifest 텍스처는 `removeCustomTextures`에서 제거하지 않는다.

### I02. 얼굴 오버레이를 본체 텍스처 전환으로 교체

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `triggerBite`, `stopBite`, `updateBite`, `update`, `destroy`, `triggerBark` — 단일 Player Sprite 재생; modify
  - `src/game/scenes/StageScene.ts` :: 승인 후 `triggerBite`/피해/사망·컷신 흐름 확인; read-only
  - `src/game/scenes/PrototypeScene.ts` :: 동일 `triggerBite` 호출 계약 확인; read-only
  - `src/game/entities/EquipmentVisual.ts` :: 무기·방패 레이어 위치/깊이 확인; read-only
  - `scripts/bite-presentation.test.mjs` :: 기존 오버레이 기대를 단일 본체 기대값으로 교체; modify
  - `scripts/bark-presentation.test.mjs` :: `bite` appearance 필드 추가와 전환 회귀; modify

#### Details

- **Signatures & Types**:
  ```typescript
  export const BITE_PRESENTATION_MS = 320;
  public triggerBite(now: number): void;
  public stopBite(): void;
  private updateBite(now: number): boolean; // 물기 표시 중이면 true
  public update(now?: number, deltaMs?: number): void;
  public destroy(): void;
  // biteImage?: Phaser.GameObjects.Sprite 필드와 생성·위치 동기화 코드는 제거
  ```
- **Data & Schema Fields**: bite 프레임은 `min(3,floor(max(0,now-biteStartedAt)/80))`이고 표시 범위는 `[biteStartedAt,biteStartedAt+320)`이다. 발 기준선은 run의 프레임별 `[99,99,100,104]`이다. 별도 타이머·게임 오브젝트·저장 필드는 없다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `getAppearanceTextures().bite`가 null이거나 텍스처가 존재하지 않으면 그림만 건너뛴다. `StageScene`/`PrototypeScene`의 `SkillSystem.use("bite").accepted`, `bite-hit`, 보스 피해 코드는 유지한다.
  2. Core Processing: `triggerBite`는 `stopBark()`, run 애니메이션 정지, `activeAnimationKey=null`, `anims.timeScale=1`, `player.setTexture(biteKey,0)`를 적용한다. `updateBite`는 같은 `Player` Sprite의 프레임만 80ms마다 바꾸고 `alignFeetToFrame`으로 발을 맞춘다. `update`는 물기 표시 중 다른 run/idle 텍스처 갱신을 건너뛴다. 플레이어 visible/alpha/flipX/좌표/72×40 body는 바꾸지 않는다.
  3. State Transition & Return: 320ms 경계, W 짖기, 죽음, 재시도, 컷신, 장면 종료에서 `stopBite`가 현재 의상의 run 텍스처를 복원한다. 물기 중 의상 변경은 `PlayerWearables`가 새 bite 키의 같은 프레임으로 연결하고 다음 `updateBite`가 이어간다. `destroy`에서 기존 슬리퍼 이미지 등은 정리하되 bite Sprite는 존재하지 않는다.
  4. Error & Exception Handling: 물기 중 텍스처가 제거/누락되면 `stopBite`하고 현재 run으로 돌아간다. 전투 결과와 쿨타임은 롤백하지 않는다.

### I03. 통합 화면과 회귀 검증

- Related Files:
  - `scripts/bite-presentation.test.mjs` :: 단일 Player, 0/79/80/159/160/239/240/319/320ms 경계; modify
  - `scripts/goodboy-wearables.test.mjs` :: 의상 5종·직접 그린 의상·장신구·동적 bite 정리; modify
  - `scripts/custom-outfit-paint.test.mjs` :: 네 프레임 색상·셀 매핑; modify
  - `scripts/outfit-bite-art.test.mjs` :: T02 정적 의상 시트 계약; read-only
  - `.memory/test-plans/2026-10-28-corgi-bite-full-body-review.md` :: 브라우저 QA 결과; new during execution

#### Details

- 기본 코기, 상점 의상 5종, 직접 그린 의상과 액세서리 하나를 착용한 상태에서 E 물기를 양방향으로 확인한다. 이중 얼굴/옷 사라짐/발 미끄러짐이 없어야 한다. 물기 중 이동·W 짖기·의상 교체·사망/재시도·컷신/장면 종료를 확인한다. 명중과 빗나감은 둘 다 그림을 표시하고 미해금/6초 쿨타임 거절은 표시하지 않는다.
- 자동 테스트는 별도 물기 Sprite 생성 0개, 현재 의상의 bite/run 키, 물기 중 다른 의상 교체, 복귀 후 의상·액세서리 유지, body 크기 72×40과 프레임별 기존 발 기준 offset, custom bite 텍스처의 교체/파괴를 검사한다.

## Acceptance Criteria

- [ ] 물기 동안 코기는 단일 본체 Sprite로 의상별 전신 물기 네 프레임을 80ms 간격으로 표시한다.
- [ ] 기본·상점 의상 5종·직접 그린 의상에서 옷/장신구/장비가 유지되고 320ms 뒤 현재 의상으로 돌아온다.
- [ ] 짖기·사망·재시도·컷신·장면 종료가 연출을 정리하고 누락된 텍스처가 전투 처리를 막지 않는다.
- [ ] 물기 피해 2, 6초 쿨타임, E 입력, 좌우 방향, 72×40 body가 유지된다.

## Validation

- `node --test scripts/corgi-bite-art.test.mjs scripts/outfit-bite-art.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-skill.test.mjs scripts/custom-outfit-paint.test.mjs` — 이미지·프레임·의상·전투 회귀 통과.
- `node scripts/validate-assets.mjs` — 기본/의상 필수 에셋 검사 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — appearance/pose 타입 오류 없음.
- `node node_modules/eslint/bin/eslint.js src/game/entities/Player.ts src/game/entities/PlayerWearables.ts src/game/entities/PlayerAnimator.ts src/game/entities/customOutfitTexture.ts scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/goodboy-wearables.test.mjs scripts/custom-outfit-paint.test.mjs` — 변경 파일 lint 통과.
- `npm.cmd run build` — 물기 이미지 포함 빌드 성공.
- 브라우저에서 기본/의상/양방향/중단/재시도를 확인하고 `.memory/test-plans/2026-10-28-corgi-bite-full-body-review.md`에 결과를 기록한다. 실제 확인 전에는 수동 QA를 통과했다고 표시하지 않는다.
- `git diff --cached --check` 및 `git diff --cached` — 기존 미커밋 보스·UI 작업과 섞이지 않았는지 확인.

## Commit Message

```text
fix(코기): 물기를 단일 전신 애니메이션으로 표시

Plan: 2026-10-28-corgi-bite-full-body
Phase: P01-bite-sprite
Task: T03-single-actor-bite-presentation

- 의상별 물기 시트를 코기 본체로 재생하고 얼굴 오버레이 제거
- 직접 그린 의상·장신구·중단 전환 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (관련 자동 29건, 에셋·타입·lint·빌드, 기본 코기 브라우저 확인)
- commit: 이 Task의 Git 커밋
