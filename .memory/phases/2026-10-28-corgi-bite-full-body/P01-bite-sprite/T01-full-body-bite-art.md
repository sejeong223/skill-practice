# Task: T01 코기 물기 전신 4프레임 이미지

## Status: done

## Goal

기존 `corgi-bite.png`의 얼굴 조각을 머리·몸통·네 발·꼬리가 모두 있는 4프레임 시트로 교체한다. T02가 물기 동안 플레이어 본체 텍스처를 직접 바꾸어도 코기가 사라지거나 발 위치가 튀지 않아야 한다.

## Decision Summary

- 기존 `corgi-bite` 키와 448×128 시트/112×128 프레임 네 개를 유지한다. 기존 파일의 몸통 투명 정책과 이를 강제하는 테스트를 폐기한다.
- 각 프레임의 몸통·발·꼬리는 같은 번호의 `corgi-run.png` 프레임을 기준으로 정확히 정렬하고, 머리·목·주둥이에서만 물기 동작을 새로 그린다. 아래쪽 몸이 그대로여야 T02에서 의상 픽셀을 안정적으로 합칠 수 있다.

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
- **Data & Schema Fields**: PNG는 RGBA 448×128이고 `frameIndex` 0~3의 x 범위는 `[frameIndex*112, frameIndex*112+111]`이다. 각 프레임은 오른쪽을 보는 코기 전신 1마리다. 프레임별 발 최하단은 기존 run의 y=`99, 99, 100, 104`와 일치한다. 투명 배경과 칸 경계의 여백을 유지한다. 기존 run과 다르게 그릴 수 있는 영역은 각 칸의 `localX >= 40 && y < 85`에 한정하며, 그 밖의 RGBA 픽셀은 같은 번호 run 프레임과 동일하게 둔다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 run/bark/bite PNG를 시각적으로 열어 크기·윤곽선·네 프레임 발 위치를 확인한다. 현재 bite에는 얼굴만 있고 몸/발 픽셀이 없다는 점을 확인한다.
  2. Core Processing: 이미지 생성 도구에 run/bark를 스타일 참조로 넣어 0=입 벌리기, 1=앞으로 무는 자세, 2=턱 닫기, 3=원위치 복귀의 머리·목·주둥이를 제작한다. 각 칸은 run의 해당 프레임 전신 위에 **기존 얼굴을 지운 단일 머리**를 완성하여 저장한다. 몸통·발·꼬리는 run 픽셀을 기준으로 보존하고 최근접 보간으로 112×128 그리드에 맞춘다.
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
  2. 각 프레임의 전체 전신 픽셀과 0/3번째 모서리의 투명도를 확인하고, `localX < 40 || y >= 85`인 모든 RGBA 픽셀이 같은 run 프레임과 동일한지 검사한다.
  3. 머리 영역 네 프레임의 차이와 몸·발의 가시성을 검사한다. 테스트가 실패하면 이미지 파일을 고치고, 실제 전신이 없는 시트를 통과시키려고 임계값을 낮추지 않는다.

## Acceptance Criteria

- [ ] 기본 물기 네 프레임 각각에서 단일 얼굴과 전신·발·꼬리가 보이고 이미지 크기가 448×128이다.
- [ ] 몸·발 위치는 기존 달리기 프레임과 같고 머리·턱만 물기 동작에 맞게 변한다.
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
