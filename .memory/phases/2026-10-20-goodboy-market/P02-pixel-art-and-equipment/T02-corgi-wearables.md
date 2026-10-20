# Task: T02 코기 의상·장신구 파츠와 즉시 착용

## Status: done

## Goal

의상 5종과 장신구 5종을 기존 코기 몸통·머리 위의 투명 레이어로 제작하고, 구매·장착 직후 모든 플레이 상태에서 보이게 한다.

## Decision Summary

- 코기 본체 `corgi-run`(112×128, 4프레임)과 `corgi-bark`(112×128 단일 프레임)를 유지한다. 투명 파츠만 덧씌우고 충돌 바디·피벗·발 위치를 바꾸지 않는다.
- 의상 슬롯 1개와 장신구 슬롯 1개가 동시 표시된다. 의상은 몸통, 장신구는 얼굴/머리에 붙는다.

## Implementation

### I01. 10종의 투명 픽셀 파츠

- Related Files:
  - `public/assets/pixel/characters/corgi/equipment/{id}-run.png` :: 각 448×128, 4프레임 시트; new
  - `public/assets/pixel/characters/corgi/equipment/{id}-bark.png` :: 각 112×128, 짖기 전용; new
  - `src/game/assets/assetManifest.json` :: 10개 시트+10개 짖기 파츠 필수 자산 등록; modify
  - `scripts/goodboy-wearables-assets.test.mjs` :: 20개 파츠 치수·알파 테스트; new

#### Details

- **Data & Schema Fields**: `id`는 `pink-caterpillar-suit`, `banana-peel-suit`, `bee-bodysuit`, `hotdog-outfit`, `diamond-armor`, `shinchan-eyebrow-sticker`, `birthday-party-hat`, `strawberry-headpiece`, `propeller-hat`, `prince-crown`이다. 파일 키는 `wear-{id}-run`(spritesheet, frameWidth112/frameHeight128/frameCount4) 및 `wear-{id}-bark`(image)로 등록한다.
- **Execution Flow / Logic**: 기존 Corgi run 프레임을 기준으로 각 파츠를 같은 픽셀 좌표에 배치한다. 4프레임 전체에서 다리·귀·눈·입의 움직임이 가려지지 않게 조정한다. 의상은 허리/몸통 위, 모자는 머리 위, 눈썹 스티커는 눈 위, 딸기 탈은 얼굴 프레임 둘레에 놓되 눈과 짖는 입은 보인다. 파츠의 배경 픽셀은 전부 투명이다. `bark`가 450ms 표시되는 동안에도 동일 장비의 전용 프레임을 쓴다.
- **Error & Exception Handling**: 동일 상품의 run/bark 쌍 중 하나만 존재하면 자산 테스트에서 실패한다. 없는 장비 ID가 저장되어 있으면 표시를 생략하고 본체 코기를 정상 렌더링한다.

### I02. 착용 레이어 동기화

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `update`, `triggerBark`, `stopBark`, `destroy`; modify
  - `src/game/entities/PlayerWearables.ts` :: 신규 렌더러; new
  - `src/game/scenes/StageScene.ts` :: `create`, `update`, `shutdown`, 장비 변경 이벤트; modify
  - `src/game/stages/stageEvents.ts` :: `cosmetic-change-requested` payload; modify
  - `src/game/persistence/AutoSaveCoordinator.ts` :: 외형 장착 이벤트 저장; modify
  - `scripts/goodboy-wearables.test.mjs` :: 포즈·방향·장비 변경 테스트; new

#### Details

- **Signatures & Types**: `PlayerWearables(scene: Phaser.Scene, player: Player)`, `setEquipment(outfitId: CosmeticId | null, accessoryId: CosmeticId | null): void`, `sync(): void`, `destroy(): void`. 이벤트 `cosmetic-change-requested: { outfitId?: CosmeticId | null; accessoryId?: CosmeticId | null }`는 필드 누락과 명시적 벗기기 `null`을 구별한다.
- **Execution Flow / Logic**: 플레이어 depth 10 기준 의상 10+1, 장신구 10+2. 플레이어의 `x/y`, `originX/Y`, `scaleX/Y`, `flipX`, `visible`, 현재 run 프레임, bark 텍스처를 매 postupdate 동기화한다. run 애니메이션 frame 0은 정지·점프에도 사용한다. 의상/장신구는 서로 독립 변경하며 즉시 `ProgressState`와 장면을 갱신하고 `cosmetic-change-requested`를 자동 저장에 연결한다. 리스폰·월드 전환·새로고침 시 저장값으로 재생성한다.
- **Error & Exception Handling**: 장비 변경 이벤트를 컷신·사망 상태에서 처리하지 않는다. scene 종료 때 postupdate listener와 이미지 객체를 모두 제거해 유령 파츠를 남기지 않는다. 짖기 중 교체해도 입/얼굴이 가려지거나 이전 파츠가 남지 않아야 한다.

## Acceptance Criteria

- [x] 10종 모두 현재 코기 위에 장착되고, 본체 이미지·충돌 범위는 변하지 않는다.
- [x] 두 슬롯 동시 착용, 뒤집힌 방향, 달리기 4프레임, 점프/정지, 짖기, 리스폰에서 파츠가 붙어 있다.
- [x] 장비 변경 이벤트 직후와 새로고침 직후 같은 모습이다. 구매 버튼에서 이벤트를 부르는 경로는 P04-T01에서 연결한다.

## Validation

- `node --test scripts/goodboy-wearables-assets.test.mjs scripts/goodboy-wearables.test.mjs scripts/bark-presentation.test.mjs` — 이미지·포즈 동기화.
- `node scripts/validate-assets.mjs` — 필수 자산 검사.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- Chrome에서 두 의상/장신구 조합 이상을 좌우 이동·점프·짖기로 확인하고 스크린샷을 검증 기록에 첨부한다.

## Commit Message

```text
feat(코기): 의상 장신구 파츠 10종을 기존 코기에 실시간 착용

Plan: 2026-10-20-goodboy-market
Phase: P02-pixel-art-and-equipment
Task: T02-corgi-wearables

- 코기 달리기와 짖기 프레임에 맞춘 투명 파츠 제작
- 구매 장착과 재진입 때 의상 장신구 레이어 동기화
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `8ac75e0`
