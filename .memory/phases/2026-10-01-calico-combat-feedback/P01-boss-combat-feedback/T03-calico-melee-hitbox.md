# Task: T03 삼색이 근접 명중 판정

## Status: done

## Goal
토끼 슬리퍼가 삼색이에게 닿는 모습인데도 체력이 줄지 않는 근접 판정 오류를 고친다.

## Decision Summary
- J키 입력과 `SlipperAttackResult` 계약, 3연타 재채기, 12칸 체력은 유지한다.
- 보스 중심점 거리 검사 대신 코기 앞 슬리퍼의 휘두름 영역과 보스 화면 사각형의 겹침을 검사한다.

## Implementation

### I01. 명중 영역 함수
- Related Files:
  - `src/game/systems/calicoMeleeHitbox.ts` :: `isCalicoInSlipperReach` — new
  - `scripts/calico-melee-hitbox.test.mjs` :: 가까운/먼 거리, 좌우, 점프, 보스 중심 근접 회귀 테스트 — new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface MeleeTargetBounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
  export function isCalicoInSlipperReach(playerCenterX: number, playerCenterY: number, facing: -1 | 1, target: MeleeTargetBounds): boolean;
  ```
- **Data & Schema Fields**:
  - 공격 영역: 오른쪽일 때 x=`centerX+16`부터 `centerX+112`, 왼쪽일 때 `centerX-112`부터 `centerX-16`. y=`centerY-72`부터 `centerY+10`. `center`는 코기 물리 몸 중심 좌표다.
  - `MeleeTargetBounds`: `x`, `y`, `width`, `height` 모두 유한한 숫자. `Phaser.GameObjects.Sprite.getBounds()`와 구조가 같다.
- **Execution Flow / Logic**:
  1. 슬리퍼 표시의 시작/끝 좌표와 크기에서 좌우/위아래 포괄 범위를 만든다.
  2. 이 영역과 보스 사각형이 양 축에서 실제로 겹칠 때만 `true`를 반환한다. 맞닿기만 하고 겹치지 않으면 `false`다.
  3. 테스트로 보스 중심에 코기가 매우 가까워도 겹치면 명중하고, 멀거나 반대쪽을 보거나 너무 높게 점프하면 명중하지 않음을 검증한다.

### I02. 보스 판정 교체
- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: `World01CalicoBoss.acceptMeleeHit` — modify

#### Details
- **Execution Flow / Logic**:
  1. 기존 `result.kind !== "slipper-hit"`, `!accepted`, `intro/defeated` 선행 거부를 유지한다.
  2. `this.sprite.getBounds()`와 코기 몸 중심, `player.flipX`로 새 함수를 호출한다. 기존 보스 중심점 방향/100px 거리/64px 높이 조건은 제거한다.
  3. 명중 시 기존 체력 -1, 흰색 피격, 체력 막대 갱신, 0 HP 승리 흐름을 그대로 실행한다. 한 번의 유효한 J키 입력당 이 함수는 한 번만 호출된다.

## Acceptance Criteria
- [ ] 코기가 삼색이 바로 옆 또는 일부 겹친 상태에서 고양이 쪽을 보고 J키를 누르면 체력이 한 칸 줄어든다.
- [ ] 좌우 모두 동작하며 멀리 있거나 엉뚱한 방향, 너무 높은 점프에서는 피해가 없다.
- [ ] 한 번의 입력은 최대 한 칸만 줄이고 기존 콤보/재채기 규칙을 유지한다.

## Validation
- `node --experimental-strip-types --test scripts/calico-melee-hitbox.test.mjs` — 경계 조건과 회귀 테스트 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint -- src/game/systems/calicoMeleeHitbox.ts src/game/systems/World01CalicoBoss.ts` — 변경 파일 lint 통과.
- `npm.cmd run build` — 게임 빌드 통과.

## Commit Message
```text
fix(world01): align calico melee hits with slipper swing

Plan: 2026-10-01-calico-combat-feedback
Phase: P01-boss-combat-feedback
Task: T03-calico-melee-hitbox

- Replace boss center checks with directional slipper sweep overlap
- Cover close-range, both-facing, and aerial miss cases
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`node --test`, `tsc`, `eslint`, `next build`)
- commit: `fix(world01): align calico melee hits with slipper swing`
