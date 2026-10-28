# Task: T03 발레 회전 재생과 착용 외형 동기화

## Status: pending

## Goal

실제 일반 점프가 수락된 순간 전신 발레 회전을 시작하고, 약 0.6초에 한 바퀴를 마친 뒤 착지까지 자세를 유지한다. 짖기·물기 효과, 좌우 공중 이동과 공격 방향, 착용 외형을 보존한다.

## Decision Summary

- 점프마다 새 회전을 시작한다. `SkillSystem`의 더블 점프 분기는 향후 호출될 때 회전 시작 이벤트를 내지만 `StageScene`의 더블 점프 입력·해금·물리 동작은 새로 구현하지 않는다.
- 이륙 시 **시각적** 좌우 방향은 착지까지 고정한다. 기존 `player.flipX`는 공중 조작과 전투 판정에서 그대로 갱신되므로, 원본/슬롯별 mirror 텍스처를 전환해 그림만 고정한다.
- 공중 짖기·물기는 피해·경직·쿨타임·효과음이 정상 적용되지만 코기 이미지는 회전이 우선한다. 착지하면 달리기·대기 자세로 복귀한다.

## Implementation

### I01. 점프 시작·초기화 이벤트와 외형 텍스처 계약

- Related Files:
  - `src/game/entities/Player.ts` :: `PlayerAppearanceTextures`, `PlayerJumpStartEvent`, `resetTo` — modify
  - `src/game/systems/PlayerController.ts` :: `update`, `updateAirState` — modify
  - `src/game/systems/SkillSystem.ts` :: `applySkillState`의 `double-jump` 분기 — modify
  - `src/game/entities/playerTypes.ts` :: 기존 `PlayerAnimationState`와 속도 값 확인 — read-only
  - `src/game/scenes/StageScene.ts` :: 기존 `PlayerAnimator`·`PlayerWearables` 생성과 스킬 판정 순서 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export type PlayerAppearanceTextures = Readonly<{
    run: string;
    bark: string;
    bite: string | null;
    pirouette: string;
    pirouetteMirror: string;
  }>;
  export type PlayerJumpStartEvent = Readonly<{
    kind: "normal" | "double";
    facingLeft: boolean;
  }>;
  // Phaser Player events: "player-jump-started"(PlayerJumpStartEvent), "player-reset"().
  // PlayerController.update(time: number, delta: number): void
  // SkillSystem.applySkillState(skillId: SkillId): void
  ```
- **Data & Schema Fields**:
  - 기본 `Player.appearanceTextures`: `{ run:"corgi-run", bark:"corgi-bark", bite:"corgi-bite", pirouette:"corgi-pirouette", pirouetteMirror:"corgi-pirouette-mirror" }`.
  - 점프 시작 payload의 `facingLeft`는 점프 수락 직후 현재 `player.flipX`다. 저장 데이터에는 새 필드를 넣지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `PlayerController`의 점프는 `jumpBufferRemainingMs>0 && coyoteRemainingMs>0`일 때만 수락한다. 버튼을 눌렀지만 점프가 성립하지 않거나 단순히 발판에서 떨어질 때 이벤트를 내지 않는다.
  2. Core Processing: 일반 점프는 `setVelocityY(tuning.jumpVelocity)` 직후 `player.emit("player-jump-started", {kind:"normal", facingLeft:player.flipX})`를 딱 한 번 호출한다. 같은 업데이트에서는 기존 `blocked.down` 값이 한 틱 남을 수 있으므로 `updateAirState(false)`로 점프 상태를 표시한다. `SkillSystem`의 기존 `double-jump` 분기는 `setVelocityY(-420)`과 함께 `kind:"double"` 이벤트를 낸다. `Player.resetTo`는 물리 위치·애니메이션 상태를 초기화한 뒤 `player-reset`을 낸다.
  3. Error & Exception Handling: 물리 속도나 컨트롤 잠금 조건이 기존과 다르게 변하면 안 된다. 미연결 더블 점프를 활성화하려고 `StageScene`, 입력 매핑, 해금 저장 값을 수정하지 않는다.
  4. State Transition & Return: `PlayerAnimator`가 수신할 명시적 점프 시작·초기화 신호가 생긴다. 기믹의 `launch-up`이나 걷다가 떨어짐은 회전을 시작하지 않는다.

### I02. 600ms 전신 회전과 시각적 좌우 방향 고정

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `PlayerAnimator`, `triggerBark`, `triggerBite`, `update`, `destroy` — modify
  - `src/game/entities/Player.ts` :: 기존 `alignFeetToFrame` 및 Arcade Body 치수 — read-only
  - `scripts/corgi-pirouette-presentation.test.mjs` :: 시작·프레임·착지·중단·스킬·좌우 회귀 — new
  - `scripts/bite-presentation.test.mjs` :: 기존 지상 물기 320ms 회귀 — read-only
  - `scripts/bark-presentation.test.mjs` :: 기존 지상 짖기 450ms 회귀 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export const PIROUETTE_DURATION_MS = 600;
  const PIROUETTE_FRAME_MS = 75;
  const PIROUETTE_FOOT_ANCHOR = 99;
  type PirouettePlayback = {
    elapsedMs: number;
    lockedFacingLeft: boolean;
    sawAirborne: boolean;
    kind: "normal" | "double";
  };
  // private pirouette: PirouettePlayback | null
  // private startPirouette(event: PlayerJumpStartEvent): void
  // private stopPirouette(): void
  // public update(now = scene.time.now, deltaMs = 0): void
  ```
- **Data & Schema Fields**:
  - 회전 프레임은 `elapsedMs < 600 ? Math.floor(elapsedMs / 75) : 0`, 범위 `0..7`이다. 프레임 `7` 뒤 `0`으로 돌아온 뒤 착지 전까지 `0`을 유지한다.
  - 시트 선택은 현재 `player.flipX === lockedFacingLeft`면 `appearance.pirouette`, 다르면 `appearance.pirouetteMirror`다. mirror PNG는 각 슬롯만 반전했으므로 Phaser의 현 `flipX`가 바뀌어도 최종 화면의 이륙 방향은 일정하다.
  - `Player` 본체 Sprite의 텍스처를 전신 시트로 교체한다. 추가 코기 얼굴이나 몸통 Sprite를 만들지 않는다. 몸체 `72×40`, 발 앵커 `99`, 중력·속도·충돌 설정을 유지한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `player-jump-started`를 받으면 기존 지상 짖기/물기 표시 타이머와 run animation을 정리하고 새 회전을 `elapsedMs=0`에서 시작한다. 두 번째 점프 이벤트는 공중에서도 프레임 0으로 재시작한다.
  2. Core Processing: `update`에서 회전 상태를 물기/짖기 표시 처리보다 먼저 판정한다. 양수·유한 `deltaMs`만 더한다. 이미지를 해당 시트·프레임으로 바꾸고 발 앵커를 `99`로 맞춘다. 현재 `flipX`는 공격 방향을 위해 건드리지 않는다. `triggerBark`/`triggerBite`는 회전 중일 때 시각적 텍스처와 표시 타이머를 바꾸지 않되, 호출한 `StageScene`의 실제 스킬 판정은 그대로 계속되게 한다.
  3. Error & Exception Handling: 점프 수락 직후 한 틱 남은 `blocked.down` 때문에 즉시 회전을 취소하지 않는다. 실제 비접지 프레임을 본 뒤 `blocked.down || touching.down`이 되면 종료한다. 조기 착지, 머리 충돌 뒤 즉시 접지, `player-reset`, 사망 상태, Scene 파괴에서는 회전 상태를 지우고 기존 run/idle 표시로 복귀한다. 선택한 시트가 로드되지 않았다면 회전 표시만 건너뛰고 기존 run 텍스처로 안전하게 복귀한다.
  4. State Transition & Return: 긴 낙하도 한 바퀴 이상 돌지 않는다. 착지 후에도 공중에서 사용한 짖기·물기 표시가 뒤늦게 나타나지 않는다. 지상 스킬의 기존 450ms/320ms 표시 계약은 유지한다.

### I03. 의상·장신구·색칠 의상 연동

- Related Files:
  - `src/game/entities/PlayerWearables.ts` :: `TextureSet`, `BARE_CORGI`, `setEquipment`, `createCustomTextures`, `syncLayer` — modify
  - `src/game/entities/customOutfitTexture.ts` :: `OutfitPose`, `colorizeCustomOutfitPixels` — modify
  - `scripts/goodboy-wearables.test.mjs` :: 기존 의상·장신구·동적 텍스처 검사 확장 — modify
  - `scripts/corgi-pirouette-presentation.test.mjs` :: 의상 교체·장신구 동기화 검사 — new

#### Details

- **Signatures & Types**:
  ```typescript
  type OutfitPose = "run" | "bark" | "bite" | "pirouette" | "pirouetteMirror";
  type TextureSet = PlayerAppearanceTextures;
  function colorizeCustomOutfitPixels(
    template: Uint8ClampedArray,
    width: number,
    height: number,
    pose: OutfitPose,
    design: CustomOutfitDesign,
    uvMap?: Uint8ClampedArray,
  ): Uint8ClampedArray;
  // pirouette / pirouetteMirror에는 uvMap 필수; run/bark/bite의 기존 56×32 매핑은 유지.
  ```
- **Data & Schema Fields**:
  - 기성 의상 키: `wear-{outfitId}-pirouette`, `wear-{outfitId}-pirouette-mirror`.
  - 장신구 키: `wear-{accessoryId}-pirouette`, `wear-{accessoryId}-pirouette-mirror`.
  - 동적 색칠 키: `wear-custom-{design.id}-{version}-{instanceId}-pirouette` 및 `-pirouette-mirror`. 8프레임 canvas 너비 `896`, 높이 `128`; `texture.add(String(frame),0,frame*112,0,112,128)`을 프레임 `0..7`에 등록한다.
  - UV 키: `custom-outfit-template-pirouette-uv`와 `custom-outfit-template-pirouette-mirror-uv`. 각 픽셀에서 `index = red + (green << 8) - 1`, 유효 `0..1791`; 템플릿의 흰 천과 UV 알파가 함께 있을 때만 해당 셀 색을 입힌다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `setEquipment`는 현재 텍스처가 `pirouette`인지 `pirouetteMirror`인지와 현재 프레임 `0..7`을 외형 교체 전에 저장한다. 기성 의상의 run/bark는 필수, bite는 기존처럼 선택형 처리하고 두 pirouette는 필수로 검사한다.
  2. Core Processing: 교체 후에도 같은 회전 종류·프레임으로 새 의상 텍스처를 보여준다. `syncLayer`는 현재 텍스처를 run/bark/bite/pirouette/pirouetteMirror로 분류하고 장신구도 대응 시트·동일 프레임·동일 `player.flipX`·원점·좌표에 맞춘다. bite의 장신구는 기존 run 레이어를 유지한다. 색칠 의상은 기존 run/bark/bite 3개에 8프레임 pirouette/mirror 2개를 추가로 생성하고, T02 UV를 이용해 기존 저장 색을 입힌다.
  3. Error & Exception Handling: UV 치수·셀 인덱스·흰 천 마스크 불일치는 오류를 던져 기존 `createCustomTextures`의 기본 코기 fallback으로 처리한다. 의상 교체·색 다시 칠하기·Scene 파괴 시 새 동적 2시트까지 `ownedTextureKeys`에서 제거한다. 장신구 시트가 없으면 장신구 레이어만 숨기고 플레이어 이미지는 유지한다.
  4. State Transition & Return: 회전 중 장착/해제·색칠 갱신에도 프레임과 이륙 방향이 튀지 않는다. 발 앵커와 충돌 몸체는 그대로다.

## Acceptance Criteria

- [ ] 일반 점프 한 번에 `0..7→0` 순서로 600ms 회전하고, 공중에 남으면 프레임 0을 유지하며 착지에서 run/idle로 복귀한다.
- [ ] 공중에서 방향을 바꿔도 최종 화면의 회전 방향은 고정되고, `player.flipX`의 전투 판정 방향은 입력을 따른다.
- [ ] 공중 짖기·물기는 회전 이미지를 가리지 않으며 효과 판정은 유지된다. 지상 짖기·물기 표시 시간은 바뀌지 않는다.
- [ ] 의상 5종, 색칠 의상, 장신구 5종이 새 회전 각도와 동기화되고 외형 교체·초기화에서 잔여 텍스처가 남지 않는다.
- [ ] 더블 점프 분기는 회전 재시작 이벤트를 내지만 스테이지에 새로운 더블 점프 조작은 생기지 않는다.

## Validation

- `node --test scripts/corgi-pirouette-presentation.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs` — 회전·의상·색칠·기존 스킬 표시 회귀 통과.
- `node --test scripts/bite-skill.test.mjs scripts/bark-boss-stun.test.mjs` — 짖기·물기 실제 판정 회귀 통과.
- `npx tsc --noEmit` — 새 외형 타입과 이벤트 연결의 TypeScript 검사 통과.
- `npm run lint` — 변경 파일과 기존 코드 린트 통과.

## Commit Message

```text
feat(corgi): 점프마다 발레 회전을 재생하고 의상을 동기화

Plan: 2026-10-28-corgi-ballet-pirouette-jump
Phase: P01-ballet-pirouette-jump
Task: T03-pirouette-runtime

- 점프 시작 이벤트와 600ms 전신 피루엣 재생 연결
- 공중 스킬·좌우 방향·장신구·색칠 의상 동기화
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Worktree Guard

- `StageScene.ts`는 기존 미커밋 변경이 있으므로 이 Task에서 수정하지 않는다. 필요성이 생기면 먼저 현 상태를 확인하고 계획 문서를 수정한다. 지정 파일만 스테이징한다.
