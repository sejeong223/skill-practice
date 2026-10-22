# Task: T02 코기 얼굴과 귀에 맞는 장신구

## Status: done

## Goal

장신구 다섯 종류를 코기의 머리·얼굴에 맞춰 다시 그리고, 특히 생일 고깔모자가 귀를 모두 덮도록 만든다.

## Decision Summary

- 사용자 결정: 눈썹 스티커, 생일 고깔모자, 딸기 탈, 프로펠러 모자, 왕관 모두 수정. 생일 모자에는 귀가 드러나지 않는다.
- 코드 사실: 장신구는 `PlayerWearables`의 depth `player+2`이며 의상보다 앞에 그려지고 코기 방향과 함께 반전한다.

## Implementation

### I01. 얼굴·귀 기준 다섯 프레임의 장신구

- Related Files:
  - `scripts/generate-goodboy-wearables.mjs` :: `accessoryArt`, `frameSvg` 수정. 걷기 4프레임과 짖기 1프레임의 머리 윤곽 기준 좌표를 적용.
  - `public/assets/pixel/characters/corgi/equipment/{shinchan-eyebrow-sticker,birthday-party-hat,strawberry-headpiece,propeller-hat,prince-crown}-{run,bark}.png` :: 재생성.
  - `scripts/goodboy-wearables-assets.test.mjs` :: 각 프레임 알파 위치·생일 모자 귀 덮기 검사 보강.
- **Signatures & Types**: `accessoryArt: Partial<Record<CosmeticId, (frameIndex: number, pose: "run" | "bark") => string>>` 중 장신구 다섯 ID에 프레임별 머리 기준 렌더를 준다. 에셋은 기존 `wear-{id}-run/bark`와 프레임 크기 112×128을 유지한다.
- **Data & Schema Fields**: 저장 필드 `equippedAccessoryId: CosmeticId|null` 변경 없음. 장신구와 의상의 동시 착용, 벗기기 동작도 유지.
- **Execution Flow / Logic**:
  1. 코기 기본 이미지의 각 포즈에서 머리·귀·눈 위치를 확인하고 장신구별 경계를 잡는다.
  2. 생일 고깔은 현재 꼭대기에 얹힌 작은 삼각형을 머리와 두 귀 전체를 감싸는 고깔/후드로 교체한다. 모자 아래 얼굴·눈·코는 보이게 남긴다.
  3. 딸기 탈은 볼을 따라 내려오게 하고 눈썹은 실제 눈 위, 프로펠러 모자와 왕관은 머리 곡면에 밀착한다. 장신구마다 얼굴 가림의 의도된 범위를 명확히 한다.
  4. 좌우 반전과 프레임 변화에서 위치가 튀지 않도록 조정한다. 픽셀 스타일과 현재 코기 색 대비를 유지한다.
- **Error & State Transition**: 특정 장신구 한 프레임의 출력이 빠지면 생성기와 에셋 검사를 실패시키고 렌더러가 조용히 장신구를 숨기지 않도록 한다.

## Acceptance Criteria

- [x] 다섯 장신구가 걷기·짖기·좌우 방향에서 머리/얼굴에 밀착한다.
- [x] 생일 모자를 쓰면 두 귀가 완전히 덮이며 코기의 표정은 보인다.
- [x] 의상+장신구 동시 장착과 기존 저장의 장신구 복원에 회귀가 없다.

## Validation

- `node scripts/generate-goodboy-wearables.mjs && node scripts/generate-goodboy-wearables.mjs --check` — 생성 결과 일치.
- `node --test scripts/goodboy-wearables-assets.test.mjs scripts/goodboy-wearables.test.mjs` — 에셋·착용 동작.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 다섯 장신구의 걷기·짖기·좌우 방향과 생일 모자의 귀 덮임을 시각 확인.

## Commit Message

```text
feat(장신구): 코기 머리에 맞춰 다섯 장신구 다시 그림

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P01-fitted-wearables
Task: T02-accessory-silhouettes

- 걷기와 짖기 포즈별 머리 기준 장신구를 제작
- 생일 고깔모자로 코기의 두 귀를 덮음
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 생성기 --check, 에셋·착용 테스트 6건, TypeScript, 빌드, 코기 합성 이미지 육안 확인
- commit: 이 Task의 한국어 커밋
