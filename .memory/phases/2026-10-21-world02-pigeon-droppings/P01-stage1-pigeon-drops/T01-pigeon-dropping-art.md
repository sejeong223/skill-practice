# Task: T01 비행 비둘기와 똥 픽셀 아트·에셋 등록

## Status: done

## Goal

월드 2 첫 스테이지에서 실제로 보일 비행 비둘기 3프레임, 떨어지는 똥, 바닥에 잠깐 남을 착지 자국을 투명 PNG로 만든다. 현재 놀이터 소품과 같은 만화식 픽셀 스타일로 멀리서도 새와 낙하물을 구분할 수 있어야 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-21-world02-pigeon-droppings.md)의 첫 스테이지 범위와 새 이미지 3개를 따른다. 정적 월드 1 비둘기 이미지를 움직이는 비둘기로 재사용하지 않는다.
- 이 Task는 이미지·manifest·이미지 검증까지만 한다. 비행과 충돌은 T02에서 연결한다.

## Implementation

### I01. 기존 소품 스타일을 기준으로 투명 픽셀 이미지 3개 제작

- Related Files:
  - `public/assets/pixel/props/world-01/pigeon-static.png` — 회청색 비둘기 종 특징 참고; read-only.
  - `public/assets/pixel/props/world-02/duck-spring.png`, `sleeping-fat-cat.png` — 굵은 자주색 픽셀 윤곽·평면 채색·단순한 눈과 게임 크기 참고; read-only.
  - `public/assets/pixel/backgrounds/world-02/world-02-mid.png`, `public/assets/pixel/tiles/world-02/world-02-sand-floor.png` — 푸른 하늘·밝은 모래 위의 대비 참고; read-only.
  - `public/assets/pixel/props/world-02/pigeon-fly.png` — 가로 3프레임 비둘기 스프라이트시트; new.
  - `public/assets/pixel/props/world-02/pigeon-dropping.png` — 낙하 중인 똥; new.
  - `public/assets/pixel/props/world-02/pigeon-splat.png` — 충돌력 없는 바닥 착지 자국; new.
  - `.memory/test-plans/assets/2026-10-21-world02-pigeon-art-sheet.png` — 기존 소품과 1× 크기로 비교하는 연락 시트; new.

#### Details

- **Signatures & Types**: PNG는 모두 RGBA/투명 배경이며, `pigeon-fly.png`는 **240×56**(각 프레임 80×56, 3개가 좌→우), `pigeon-dropping.png`는 **24×32**, `pigeon-splat.png`는 **40×16**이다. 비둘기의 부리는 왼쪽, 꼬리는 오른쪽을 향해 **오른쪽 얼굴 측면**이 보이고 실제 비행도 오른쪽→왼쪽이다. 새의 각 프레임은 날개 올라감/중간/내려감을 같은 몸통·눈·부리 위치로 그린다. 한 프레임의 윤곽을 그대로 복사해 눈·몸이 튀어 보이지 않게 한다.
- **Data & Schema Fields**: 배경/그림자/글자/워터마크는 PNG에 넣지 않는다. 비둘기는 회청색 몸, 자줏빛 목, 연분홍 발, 작은 부리, 흰 반짝임 없는 점눈과 2~3색 면으로 읽혀야 한다. 똥은 미색/연회색의 구불한 실루엣과 보랏빛 그림자로 밝은 모래·뼈다귀 코인과 구분하고, 착지 자국은 납작한 작은 별/방울 형태로 한다. 실사 질감·부드러운 블러·과도한 윤광은 금지한다.
- **Execution Flow / Logic**:
  1. 실행 시 `imagegen` 스킬을 읽고, `view_image`로 위 참조를 확인한 다음 투명 배경 원화를 생성한다. 동일 원화를 기준으로 3프레임을 맞추고 nearest-neighbor 축소/투명 패딩으로 정확한 픽셀 크기를 만든다. 이미지 편집에는 이미지 생성 도구를 사용한다.
  2. 1× 화면 크기에서 날개 포즈 3개가 달라 보이고 비둘기 머리가 왼쪽에서 오른쪽으로 갑자기 이동하지 않는지 확인한다. 똥 24×32가 배경 위에서 최소한의 대비를 유지하는지 확인한다.
  3. 세 파일을 연락 시트에 놓고 기존 오리·고양이와 윤곽 두께·색면을 비교한다. 부자연스러운 실사 느낌이나 읽히지 않는 외형이면 원화를 다시 정리한다.
- **Error & Exception Handling**: 특정 그림을 얻지 못했을 때 기존 정적 비둘기를 늘려 대체하지 않는다. PNG 치수/투명도 오류는 검증 스크립트에서 실패로 처리한다.
- **State Transition & Return**: 렌더링 자산만 추가하며 게임 상태·충돌·배치를 바꾸지 않는다.

### I02. 필수 자산 등록과 외형 계약 검증

- Related Files:
  - `src/game/assets/assetManifest.json` :: `PIXEL_ASSETS` JSON 원본 — 3개 필수 항목 추가; modify.
  - `src/game/assets/assetTypes.ts` :: `PixelAssetDefinition` — 현재 스키마 확인; read-only.
  - `src/game/scenes/PreloadScene.ts` :: `loadAsset` — spritesheet 로드 경로 확인; read-only.
  - `scripts/world02-pigeon-assets.test.mjs` — PNG 메타데이터와 manifest 검사; new.

#### Details

- **Signatures & Types**: 다음 스키마로 한 번씩 등록한다.
  ```json
  { "key": "world-02-pigeon-fly", "kind": "spritesheet", "url": "/assets/pixel/props/world-02/pigeon-fly.png", "frameWidth": 80, "frameHeight": 56, "frameCount": 3, "worldId": "world-02", "required": true }
  { "key": "world-02-pigeon-dropping", "kind": "image", "url": "/assets/pixel/props/world-02/pigeon-dropping.png", "worldId": "world-02", "required": true }
  { "key": "world-02-pigeon-splat", "kind": "image", "url": "/assets/pixel/props/world-02/pigeon-splat.png", "worldId": "world-02", "required": true }
  ```
- **Data & Schema Fields**: `frameWidth × frameCount`가 실제 시트 폭과 같아야 한다. 똥/자국은 단일 이미지이므로 `frameWidth`·`frameHeight`를 넣지 않는다.
- **Execution Flow / Logic**: `sharp` 메타데이터로 정확한 치수와 알파 채널을 검사한다. 세 새 프레임의 불투명 영역·해시가 서로 달라야 하고, 똥/착지 자국은 빈 이미지가 아니어야 한다. manifest key 중복·URL·`required: true`를 검사한다. 색감/표정은 연락 시트와 1× 이미지를 사람이 확인한다.
- **Error & Exception Handling**: 에셋 파일이 누락되면 `validate-assets`와 필수 프리로드가 실패하도록 `required: true`를 유지한다.
- **State Transition & Return**: T02가 사용할 텍스처 키가 확정된다.

## Acceptance Criteria

- [x] 새 3프레임이 같은 비둘기의 연속 동작으로 보이고 기존 놀이터 소품 스타일과 어울린다.
- [x] 낙하 똥과 착지 자국이 1× 크기에서 구별되고 투명 PNG 3개가 정확한 치수다.
- [x] manifest·이미지 검사·필수 에셋 검사가 통과한다.

## Validation

- `node --test scripts/world02-pigeon-assets.test.mjs` — 3개 PNG의 치수·알파·프레임 차이·키 검증.
- `node scripts/validate-assets.mjs` — 필수 경로/키/스프라이트시트 필드 검증.
- `node node_modules/typescript/bin/tsc --noEmit` — 자산 정의 타입 검사.
- `npm.cmd run build` — 프리로드 경로를 포함한 빌드 검사.
- `.memory/test-plans/assets/2026-10-21-world02-pigeon-art-sheet.png`와 각 PNG를 1× 화면으로 육안 확인.

## Commit Message

```text
feat(world02): 비행 비둘기와 낙하 똥 픽셀 이미지 추가

Plan: 2026-10-21-world02-pigeon-droppings
Phase: P01-stage1-pigeon-drops
Task: T01-pigeon-dropping-art

- 놀이터 소품 스타일의 비둘기 3프레임과 똥·착지 자국 제작
- 필수 에셋과 크기·투명도 검사 추가
```

## Progress

- [x] 구현 완료 — imagegen 기본 도구로 만든 왼쪽 비행 비둘기 시트와 낙하 똥·착지 자국을 nearest-neighbor로 정리.
- [x] 검증 통과 — 이미지 테스트 5건, 필수 에셋 102개 검사, 타입 검사, 빌드, 1× 연락 시트 육안 확인.
- commit: 이 Task의 한국어 커밋
