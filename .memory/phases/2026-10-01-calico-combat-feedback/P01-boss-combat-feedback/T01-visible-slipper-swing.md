# Task: T01 J키 슬리퍼 공격 그림 표시

## Status: done

## Goal
보스전에서 인정된 J키 슬리퍼 공격마다 코기 앞에 토끼 슬리퍼 그림을 짧게 표시한다.

## Decision Summary
- `intro-slipper`는 `PreloadScene`의 필수 이미지다. 새 파일이나 에셋 정의가 필요 없다.
- 보스의 근접 명중과 콤보 계산은 유지한다. `SlipperAttackResult.kind === "slipper-hit" && accepted`일 때만 표시한다.

## Implementation

### I01. 공격 오버레이
- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `PlayerAnimator.triggerSlipperSwing`, `update`, `destroy` — modify
  - `src/game/scenes/StageScene.ts` :: `StageScene.update`, shutdown callback — modify

#### Details
- **Signatures & Types**:
  ```typescript
  public triggerSlipperSwing(now: number): void;
  public update(now?: number): void;
  public destroy(): void;
  ```
- **Data & Schema Fields**:
  - `slipperImage: Phaser.GameObjects.Image | undefined` — 전투 중 생성한 그림, 초기 `undefined`.
  - `slipperSwingStartedAt: number`, `slipperSwingUntil: number` — 게임 시각 ms, 초기 `0`.
  - `slipperFacing: -1 | 1` — 발동 시 방향, 초기 `1`.
- **Execution Flow / Logic**:
  1. 유효한 슬리퍼 공격 시 `triggerSlipperSwing(time)`으로 220ms 표시한다. 이미 그림이 있으면 재사용해 타이머를 갱신한다.
  2. `update(time)`에서 코기 입 앞 위치를 따라가며 진행률에 따라 각도와 크기를 변화시킨다. 좌우를 뒤집고 코기보다 앞 depth에 그린다.
  3. 종료되면 숨기고 씬 shutdown의 `destroy()`에서 파괴한다. 공격용 PNG가 없어도 달리기 스프라이트와 물리 몸 크기는 유지한다.
  4. `StageScene.update`의 J키→`CombatSystem.tryAttack`→`acceptMeleeHit` 순서를 유지한다. 유효한 슬리퍼 결과를 받은 프레임에 표시가 시작되도록 애니메이터 업데이트 위치를 조정한다. `PrototypeScene`도 `PlayerAnimator.update()`를 부르므로 인자는 선택으로 두고 생략 시 씬 시각을 사용한다.

## Acceptance Criteria
- [ ] J키의 유효한 슬리퍼 공격에서 토끼 슬리퍼가 보인다.
- [ ] 좌우 방향과 이동 중에도 코기를 따라가고 연속 타격 시 갱신된다.
- [ ] 쿨다운 및 재채기에서는 타격 표시가 새로 시작되지 않는다.

## Validation
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint -- src/game/entities/PlayerAnimator.ts src/game/scenes/StageScene.ts` — 변경 파일 lint 통과.
- `npm.cmd run build` — 게임 빌드 통과.

## Commit Message
```text
fix(world01): show rabbit slipper during J attacks

Plan: 2026-10-01-calico-combat-feedback
Phase: P01-boss-combat-feedback
Task: T01-visible-slipper-swing

- Reuse the loaded slipper image for a short melee swing
- Keep the visual attached to the corgi and clean it on scene shutdown
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`tsc`, `eslint`, `next build`)
- commit: `fix(world01): show rabbit slipper during J attacks`
