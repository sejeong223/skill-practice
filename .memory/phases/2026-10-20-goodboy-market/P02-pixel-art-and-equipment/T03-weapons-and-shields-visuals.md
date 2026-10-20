# Task: T03 무기와 정면 방패 장착 이미지

## Status: done

## Goal

새 무기 5종의 공격 동작 이미지와 새 방패 4종의 코기 정면 장착 이미지를 실제 플레이 장면에 붙인다.

## Decision Summary

- `BowlShieldVisual`의 기본 밥그릇은 유지하면서 선택한 방패를 코기 앞쪽에 그린다. 착용 무기가 슬리퍼가 아닐 때 슬리퍼 이미지가 나오지 않아야 한다.
- 원본 코기 텍스처는 변경하지 않으며 신규 PNG의 픽셀과 윤곽선은 월드 1 스타일을 따른다.

## Implementation

### I01. 착용 전용 이미지

- Related Files:
  - `public/assets/pixel/characters/corgi/equipment/{id}-held.png` :: 무기 5종·방패 4종, 투명 64×64; new
  - `src/game/assets/assetManifest.json` :: 9개 `held-{id}` image 필수 등록; modify
  - `scripts/goodboy-held-assets.test.mjs` :: 9개 파일·크기·투명도 검증; new

#### Details

- **Data & Schema Fields**: 무기는 `squeaky-ball`, `rolled-newspaper`, `pink-backscratcher`, `drumstick-boomerang`, `plastic-frisbee`; 방패는 `cushion-pad`, `greasy-pizza-box`, `umbrella`, `yellow-pot-lid`. 별도 64×64 PNG는 플레이어 전면 또는 손 앞에서 읽히는 형태로 디자인한다. 상점 카드용 아이콘과 같은 물건·색이어야 한다.
- **Execution Flow / Logic**: 무기는 일반 장착 시 작은 손앞 아이콘으로 보이고 J 공격 때 같은 PNG로 휘두르거나 투척 시 sprite를 분리한다. 방패는 `player.depth + 3`에서 플레이어가 바라보는 쪽 **앞**에 붙는다. `flipX`가 바뀌면 좌우 anchor도 바뀐다. 기본 밥그릇은 현행 자산·방어 횟수 표현을 그대로 사용한다.

### I02. 전투/일반 스테이지 렌더러 연결

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `triggerSlipperSwing`, 공격 시각 전환; modify
  - `src/game/entities/BowlShieldVisual.ts` :: 기본 방패 위치 참조; read-only 또는 공통 클래스로 확장
  - `src/game/entities/EquipmentVisual.ts` :: 무기·방패 렌더러; new
  - `src/game/scenes/StageScene.ts` :: 장비 변경, postupdate, stage restart, shutdown; modify
  - `src/game/stages/stageEvents.ts` :: 기존 `equipment-change-requested`; read-only / payload 보강
  - `src/game/persistence/AutoSaveCoordinator.ts` :: 도구 장착 이벤트 저장; modify

#### Details

- **Signatures & Types**: `EquipmentVisual(scene: Phaser.Scene, player: Player)`, `setTools(attackToolId: ToolId, defenseToolId: ToolId): void`, `showAttack(now: number, kind: "melee" | "projectile"): void`, `sync(): void`, `destroy(): void`. 기존 기본 밥그릇 중복 렌더링을 막기 위해 `BowlShieldVisual`와 책임을 한 군데로 모은다.
- **Execution Flow / Logic**: `StageScene.create`가 월드 1 보스 진입 때 공격/방어를 기본 장비로 강제 교체하는 코드를 제거한다. `ProgressState.equippedAttackToolId/equippedDefenseToolId`로 최초 표시·전투 시스템을 초기화하고 `equipment-change-requested`로 즉시 교체하며 장착 이벤트를 자동 저장한다. 무기는 손앞, 방패는 전면이라는 레이어 순서를 유지한다. 새 방패 장착 시 기본 `BowlShieldVisual`을 숨겨 중복 표시를 막는다. 코기가 죽거나 컷신에 들어가면 필요에 따라 숨기고 재시작 시 다시 보인다. P03의 실제 고유 공격 전까지는 비기본 무기에서 기본 슬리퍼 스윙 이미지를 띄우지 않고 J 입력에 해당 물건의 짧은 시각 동작만 표시한다. 투사체 이미지와 장착 이미지를 혼동하지 않도록 P03 공격 로직이 소유할 투사체의 정리 시점을 노출한다.
- **Error & Exception Handling**: 미구매/오류 ID는 기본 장비로 돌려 파츠 누락으로 게임이 중단되지 않게 한다. scene 종료 때 모든 이미지와 listener를 정리한다.

## Acceptance Criteria

- [x] 4종 방패가 코기 앞에 보이고 좌우 방향을 따라 위치가 바뀐다.
- [x] 5종 무기 선택 시 해당 물건이 보이며 J 입력에 기본 슬리퍼 이미지가 섞이지 않는다. 타격 효과는 P03에서 추가한다.
- [x] 기존 밥그릇 방패는 한 번만 보이고 월드 1·2 플레이에서 장비가 유지된다.

## Validation

- `node --test scripts/goodboy-held-assets.test.mjs scripts/bowl-defense.test.mjs` — 자산·밥그릇 회귀.
- `node scripts/validate-assets.mjs` — 필수 자산 검사.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 브라우저에서 방패별 좌우 전환과 무기 교체 후 공격을 실제 화면으로 확인한다.

## Commit Message

```text
feat(장비): 무기와 방패 이미지를 코기 앞에 장착

Plan: 2026-10-20-goodboy-market
Phase: P02-pixel-art-and-equipment
Task: T03-weapons-and-shields-visuals

- 무기와 방패 착용용 픽셀 이미지 9종 제작
- 코기 방향과 장착 변경에 맞춰 전면 파츠 표시
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
