# Task: T01 코기 물기 전신 4프레임 이미지

## Status: done

## Goal

기존 `corgi-bite.png`의 얼굴 조각을 머리·몸통·네 발·꼬리가 모두 있는 4프레임 시트로 교체한다. T02가 물기 동안 플레이어 본체 텍스처를 직접 바꾸어도 코기가 사라지거나 발 위치가 튀지 않아야 한다.

## Decision Summary

- 기존 `corgi-bite` 키와 448×128 시트/112×128 프레임 네 개를 유지한다. 기존 파일의 몸통 투명 정책과 이를 강제하는 테스트를 폐기한다.
- **정정**: `corgi-run.png`는 코기의 체형·색·안광 없는 눈의 참조다. 물기 네 프레임에서는 머리와 함께 몸통·네 발·꼬리의 자세도 새로 그린다. run의 몸통 픽셀 동일성 조건은 폐기한다.

## Implementation

### I01. 픽셀 아트 교체

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-bite.png` :: 전신 물기 스프라이트 시트 — modify
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: 프레임별 몸·발·꼬리·오른쪽 방향 기준 — read-only
  - `public/assets/pixel/characters/corgi/corgi-bark.png` :: 입·주둥이·외곽선 스타일 참조 — read-only
  - `src/game/assets/assetManifest.json` :: 기존 `corgi-bite` 필수 스프라이트 시트 계약 확인 — read-only
  - `src/game/scenes/PreloadScene.ts` :: 기존 `required` 로드 경로 확인 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 PixelAssetDefinition을 변경하지 않는다.
  { key: "corgi-bite", kind: "spritesheet",
    url: "/assets/pixel/characters/corgi/corgi-bite.png",
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true }
  ```
- **Data & Schema Fields (정정)**: PNG는 RGBA 448×128이고 `frameIndex` 0~3의 x 범위는 `[frameIndex*112, frameIndex*112+111]`이다. 각 프레임은 오른쪽을 보는 코기 전신 1마리다. 발 하단은 y 99~102 범위에 정렬한다. 투명 배경과 칸 경계의 여백을 유지한다. 0=웅크림, 1=몸통·앞다리 돌진, 2=착지와 턱 닫기, 3=낮게 복귀로 **전신 실루엣이 달라야 한다**.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 run/bark/bite PNG를 시각적으로 열어 크기·윤곽선·네 프레임 발 위치를 확인한다. 현재 bite에는 얼굴만 있고 몸/발 픽셀이 없다는 점을 확인한다.
  2. Core Processing (정정): 이미지 생성 도구에 run/bark를 스타일 참조로 넣어 네 단계에서 머리·목·몸통·앞다리·뒷다리·꼬리까지 다른 동작을 그린다. run 전신을 바탕으로 복제하거나 얼굴만 갈아 끼우지 않는다. 최근접 보간으로 112×128 그리드에 맞추고 눈의 안광을 제거한다.
  3. Error & Exception Handling: 두 머리가 남거나, 프레임 밖으로 털/턱이 잘리거나, 배경이 불투명하거나, 발 기준선이 바뀌면 결과를 채택하지 않고 수정한다. 네 프레임은 입 형태가 실제로 달라야 하며 동일 프레임 복사는 허용하지 않는다.
  4. State Transition & Return: 파일 경로와 manifest 키는 그대로 유지한다. 새 저장 데이터와 `PreloadScene` 코드는 만들지 않는다. 누락/파손 시 기존 필수 에셋 오류 경로를 사용한다.

### I02. 전신 시트 계약 검증

- Related Files:
  - `scripts/corgi-bite-art.test.mjs` :: `corgi-bite` manifest·PNG·프레임 검사 — modify

#### Details

- **Signatures & Types**:
  ```javascript
  // sharp(...).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  // frame: 0 | 1 | 2 | 3, localX: 0..111, y: 0..127
  ```
- **Data & Schema Fields**: 각 프레임의 불투명 픽셀(`alpha >= 128`)은 3,000개 이상이며 머리·몸·발이 모두 있어야 한다. 왼쪽 꼬리/몸은 `localX <= 25`, 오른쪽 주둥이는 `localX >= 90`, 발은 `y >= 95`에 불투명 픽셀이 있어야 한다. 네 머리 영역 알파·RGB 체크섬은 서로 달라야 한다.
- **Execution Flow / Logic**:
  1. 기존 `y < 85`, `x >= frame*112+40`의 얼굴 전용 단언을 제거한다. manifest의 112×128×4·필수 로드 단언은 유지한다.
  2. 각 프레임의 전체 전신 픽셀과 모서리 투명도를 확인하고, 몸통 영역의 run 대비 실루엣 변화와 네 물기 자세의 차이를 검사한다. 기존의 몸통 RGBA 동일성 단언은 제거한다.
  3. 두 번째 프레임에서 앞다리가 실제로 전진하는지, 머리·몸·발과 안광 없는 검은 눈이 보이는지 검사한다. 테스트가 실패하면 이미지 파일을 먼저 검토한다.

## Acceptance Criteria

- [ ] 기본 물기 네 프레임 각각에서 단일 얼굴과 전신·발·꼬리가 보이고 이미지 크기가 448×128이다.
- [x] 몸통·네 발·머리가 물기 단계마다 다른 자세로 변하고 발 하단은 안정적으로 정렬된다.
- [ ] `corgi-bite` manifest 필수 로드와 PNG 검사에 통과한다.

## Validation

- `node --test scripts/corgi-bite-art.test.mjs` — 전신·네 프레임·투명도·run 몸 좌표 검사 통과.
- `node scripts/validate-assets.mjs` — 기존 필수 이미지 경로가 유효함.
- `git diff --cached --check` 및 `git diff --cached --stat` — 이미지·해당 테스트·메모리 진행 파일만 스테이징.

## Commit Message

```text
feat(코기): 물기 전신 네 프레임 이미지 제작

Plan: 2026-10-28-corgi-bite-full-body
Phase: P01-bite-sprite
Task: T01-full-body-bite-art

- 얼굴 조각을 발과 몸을 포함한 전신 이미지로 교체
- 전신 픽셀과 기준 프레임 검증 갱신
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`node --test scripts/corgi-bite-art.test.mjs`, `node scripts/validate-assets.mjs`)
- commit: 이 Task의 Git 커밋
