# Task: T01 코기 몸에 맞는 의상과 흰 옷 마스크

## Status: done

## Goal

기존 코기의 걷기 4프레임과 짖기 1프레임에 밀착되는 의상 5종을 다시 만들고, 사용자 그림판이 공유할 동일한 흰 옷 마스크를 준비한다.

## Decision Summary

- 사용자 결정: 새 코기를 그리지 않고 기존 코기 파츠 위에 의상을 맞춘다. 의상은 애벌레·바나나·꿀벌·핫도그·다이아몬드 5종 전부다.
- 코드 사실: `PlayerWearables`는 112×128 걷기 4프레임을 448×128 PNG로, 짖기 1프레임을 112×128 PNG로 겹치고 좌우 반전한다. 현재 `suitBody` 한 경로에 프레임 오프셋만 줘서 둥근 물체처럼 보인다.

## Implementation

### I01. 프레임별 코기 몸 실루엣과 픽셀 의상

- Related Files:
  - `scripts/generate-goodboy-wearables.mjs` :: `suitBody`, `outfitArt`, `frameSvg`, `offsets` 수정. 코기 걷기·짖기 기준 실루엣을 분리하고 같은 색·검은 픽셀 윤곽을 유지한다.
  - `public/assets/pixel/characters/corgi/equipment/{pink-caterpillar-suit,banana-peel-suit,bee-bodysuit,hotdog-outfit,diamond-armor}-{run,bark}.png` :: 생성 결과 갱신.
- **Signatures & Types**: 생성기의 `outfitArt`는 `(frameIndex: number, pose: "run" | "bark") => string` 형태로 바꾼다. `frameSvg(id: string, frameIndex: number, pose: "run" | "bark"): Buffer`는 동일한 출력 크기를 유지한다.
- **Data & Schema Fields**: 의상 ID·에셋 키 `wear-{id}-run/bark`, PNG 프레임 크기 112×128 및 448×128, 투명 배경은 그대로. 의상별 저장 데이터 변경 없음.
- **Execution Flow / Logic**:
  1. `public/assets/pixel/characters/corgi/corgi-run.png`와 `corgi-bark.png`의 몸통·목·다리·배 윤곽을 프레임별로 확인한다.
  2. 각 프레임에서 목 뒤에서 엉덩이까지 몸통을 감싸는 외곽을 사용하고 얼굴·다리·발·꼬리가 보이게 알파 구멍/경계를 만든다. 단순 타원이나 한 경로의 평행 이동으로 대체하지 않는다.
  3. 애벌레 마디, 바나나 껍질 결, 꿀벌 줄무늬/날개, 핫도그 빵과 소시지, 다이아몬드 갑옷 판을 외곽 안에 그린다. 프레임마다 패턴을 몸과 함께 이동시킨다.
  4. 짖기 포즈는 입·얼굴과 충돌하지 않게 별도 윤곽으로 만든다. 좌우 반전은 Phaser에 맡기므로 오른쪽 방향용 PNG를 중복 생성하지 않는다.
- **Error & State Transition**: 생성기 `--check`는 출력 바이트가 다른 경우 실패한다. 존재하지 않는 코기 기준 PNG나 잘못된 5종 ID는 생성 실패로 드러내고 빈 PNG를 묵인하지 않는다.

### I02. 흰 옷 템플릿

- Related Files:
  - `scripts/generate-goodboy-wearables.mjs` :: `custom-outfit-template-run/bark` 생성 추가.
  - `public/assets/pixel/characters/corgi/equipment/custom-outfit-template-{run,bark}.png` :: 신규.
  - `src/game/assets/assetManifest.json` :: `custom-outfit-template-run` spritesheet/`custom-outfit-template-bark` image를 `required: true`로 등록.
  - `scripts/goodboy-wearables-assets.test.mjs` :: 흰 옷 템플릿 두 파일의 프레임·투명도·등록 검사 추가.
- **Signatures & Types**: 템플릿은 일반 의상과 똑같은 112×128 프레임 네 개와 짖기 한 개. 에디터의 논리 그리드 `56×32`는 옷의 국소 좌표 `x=20..75, y=55..86`에 대응시키고, 마스크 알파가 0인 셀은 그리기 불가로 둔다.
- **Execution Flow / Logic**: 위 I01의 프레임별 실루엣에서 패턴만 제외하고 흰 천/짙은 외곽을 출력한다. 사용자 색은 후속 Task에서 흰 천 내부에만 칠하고 얼굴·다리·외곽을 보존한다.
- **Error & State Transition**: 실제 코기 포즈마다 옷 영역이 달라지므로 단일 고정 마스크를 다섯 포즈에 억지로 재사용하지 않는다.

## Acceptance Criteria

- [x] 5종 모두 걷기 네 프레임, 짖기, 좌우 반전에서 몸에 밀착되고 얼굴과 다리가 보인다.
- [x] 생성 결과는 기존 키·크기를 보존한다. 흰 옷 마스크는 같은 착용 위치에 놓인다.
- [x] 이미지 검사는 알파가 빈 파일과 코기 바깥으로 삐져나온 픽셀을 잡는다.

## Validation

- `node scripts/generate-goodboy-wearables.mjs && node scripts/generate-goodboy-wearables.mjs --check` — 결정적 생성 확인.
- `node --test scripts/goodboy-wearables-assets.test.mjs` — 프레임·에셋 등록 확인.
- `npx tsc --noEmit && npm run build` — 매니페스트 및 타입 확인.
- 브라우저에서 5종을 각각 장착하고 걷기·짖기·좌우 반전 화면을 눈으로 확인한다.

## Commit Message

```text
feat(의상): 코기 몸에 맞는 다섯 벌과 흰 옷 마스크 제작

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P01-fitted-wearables
Task: T01-outfit-silhouettes

- 걷기와 짖기 포즈별 몸통 윤곽에 다섯 의상을 맞춤
- 사용자 그림판용 흰 옷 프레임을 등록
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 생성기 --check, 이미지 테스트 2건, TypeScript, 빌드, 투명 합성 이미지 육안 확인
- commit: 이 Task의 한국어 커밋
