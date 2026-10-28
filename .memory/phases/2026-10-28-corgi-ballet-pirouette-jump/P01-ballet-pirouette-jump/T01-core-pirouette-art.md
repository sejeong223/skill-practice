# Task: T01 기본 코기 발레 회전 전신 아트

## Status: done

## Goal

기존 코기를 알아볼 수 있는 새로운 전신 발레 자세 8개를 그려, 세로축 한 바퀴 회전에 필요한 필수 스프라이트 두 장(원본·프레임별 좌우 반전)을 게임 에셋으로 제공한다.

## Decision Summary

- 한쪽 뒷발로 서고 반대 뒷발을 옆으로 뻗으며 앞발을 펼친다. 원본 코기의 주황·흰색 털, 짧은 다리, 작은 꼬리, 픽셀 윤곽, 안광 없는 검은 눈을 유지한다. 튀튀·발레슈즈는 그리지 않는다.
- 기존 달리기 몸통이나 얼굴을 잘라 붙이는 방식은 금지한다. 각 방향의 얼굴·몸통·네 발을 전신으로 새로 설계한다. 모든 프레임은 `112×128`, 발 앵커 행 `y=99`, 8프레임 가로 시트 `896×128`이다.

## Implementation

### I01. 기본 코기 8방향 원본과 생성 스크립트

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: 기존 코기 팔레트·귀·코·눈·체형 — read-only
  - `public/assets/pixel/references/characters/corgi-reference-v2.png` :: 정면·옆·뒷모습 기준 — read-only
  - `art/source/corgi-pirouette-base-concept.png` :: 8방향 전신 원본, 투명 `896×128` — new
  - `scripts/build-corgi-pirouette-sprites.mjs` :: `buildBasePirouette`, `mirrorFrames`, `--check` — new
  - `public/assets/pixel/characters/corgi/corgi-pirouette.png` :: 게임용 오른쪽 출발 시트 — new
  - `public/assets/pixel/characters/corgi/corgi-pirouette-mirror.png` :: 8개 프레임을 각각 좌우 반전한 시트 — new

#### Details

- **Signatures & Types**:
  ```javascript
  const FRAME_WIDTH = 112;
  const FRAME_HEIGHT = 128;
  const FRAME_COUNT = 8;
  async function buildBasePirouette(sourcePath, outputPath): Promise<void>;
  async function mirrorFrames(sourcePath, outputPath, frameWidth = 112): Promise<void>;
  // CLI: node scripts/build-corgi-pirouette-sprites.mjs [--check]
  ```
- **Data & Schema Fields**:
  - 원본·출력 PNG: RGBA, 너비 `896`, 높이 `128`, 프레임 8개, 각 프레임 `112×128`; 배경 알파 `0`, 보이는 발의 최하단 `y=99`.
  - 각도와 프레임: `0` 오른쪽 옆모습, `1` 오른쪽 앞 3/4, `2` 정면, `3` 왼쪽 앞 3/4, `4` 왼쪽 옆모습, `5` 왼쪽 뒤 3/4, `6` 뒷모습, `7` 오른쪽 뒤 3/4. 프레임 `7`에서 다시 `0`으로 이어질 때 자세가 튀지 않아야 한다.
  - 머리는 귀·눈·코를 몸통 방향에 맞춰 새로 그린다. 정면은 두 귀와 흰 미간, 뒷면은 두 귀·주황 등·흰 꼬리, 옆면은 기존 코기의 주황 등·흰 가슴이 읽히게 한다. 눈에 흰 안광을 넣지 않는다.
  - 회전 중심은 `x=56` 부근에 유지하고 각 프레임의 지지 뒷발은 `y=99`에 맞춘다. 옆으로 뻗은 뒷발과 펼친 앞발이 프레임 테두리에서 잘리지 않게 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 두 읽기 전용 기준 이미지를 확대해 색·윤곽·눈을 확인하고, 새 투명 전신 8프레임을 제작한다. 비트맵 이미지 생성·편집에는 사용 가능한 `imagegen` 도구를 사용하고 최종 픽셀 가장자리와 프레임 정렬을 점검한다.
  2. Core Processing: 스크립트는 원본의 치수·RGBA·8개 비어 있지 않은 프레임·발 앵커를 검사한 다음 원본을 게임 시트로 내보낸다. `mirrorFrames`는 `896×128` 시트 전체를 한 번 뒤집지 말고, 각 `112×128` 슬롯 안에서만 x좌표를 반전해 프레임 순서 `0..7`을 보존한다.
  3. Error & Exception Handling: 누락 파일, 잘못된 치수, 빈 프레임, `y=99`를 벗어난 발, 출력 불일치에는 `Error`를 던지고 비정상 종료한다. `--check`는 파일을 쓰지 않고 생성 예상 바이트와 실제 PNG를 비교한다.
  4. State Transition & Return: 게임용 원본·반전 시트가 정확히 같은 8프레임 계약을 갖는다. 이 Task에서는 애니메이션 코드를 수정하지 않는다.

### I02. 필수 에셋 등록과 아트 검사

- Related Files:
  - `src/game/assets/assetManifest.json` :: `corgi-pirouette`, `corgi-pirouette-mirror` — modify
  - `scripts/corgi-pirouette-art.test.mjs` :: `test` 기본 시트 규격·전신 차이·좌우 반전 — new

#### Details

- **Signatures & Types**:
  ```typescript
  type PirouetteAsset = {
    key: "corgi-pirouette" | "corgi-pirouette-mirror";
    kind: "spritesheet";
    url: string;
    frameWidth: 112;
    frameHeight: 128;
    frameCount: 8;
    required: true;
  };
  ```
- **Data & Schema Fields**:
  - URL은 `/assets/pixel/characters/corgi/{key}.png`이다. 기존에 파일이 없는 선택형 `corgi-jump`와 `corgi-double-jump` manifest 항목은 두 필수 피루엣 항목으로 대체한다. 다른 자산 키는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `assetManifest.json`의 두 기존 선택형 키는 게임 코드에서 참조하지 않는지 확인한다.
  2. Core Processing: 원본·반전 시트를 `required:true`로 등록한다. 아트 테스트는 PNG 실제 치수·투명도·8개 비어 있지 않은 전신·각 프레임의 발 `y=99`·정면/뒷모습/옆모습의 서로 다른 몸통 실루엣·프레임별 반전 픽셀 일치를 확인한다. 기존 `corgi-run`의 몸통 중심 픽셀 복사율 검사도 넣어 붙여넣은 전신을 걸러낸다.
  3. Error & Exception Handling: `sharp` 읽기 실패나 메타데이터 불일치는 테스트 실패로 보고한다. 시각적 얼굴 품질은 픽셀 검사만으로 완전히 증명하지 못하므로 접촉 시트 육안 검토를 T04에서 수행한다.
  4. State Transition & Return: `PreloadScene`이 두 필수 시트를 자동 로드할 수 있다. 아직 점프 때 보이는 이미지는 T03까지 기존 상태다.

## Acceptance Criteria

- [ ] 원본·반전 시트 각 8개 프레임이 서로 다른 전신 회전 각도를 보여준다. 프레임 `2`는 정면, `6`은 뒷모습이고 눈에 흰 안광이 없다.
- [ ] 양쪽 시트의 각 발 최하단은 `y=99`이며, 전신의 머리·몸통·네 발이 기존 가로 이미지 위에 덧대지 않고 그려져 있다.
- [ ] 필수 에셋 등록과 `--check`가 통과한다.

## Validation

- `node scripts/build-corgi-pirouette-sprites.mjs --check` — 원본에서 두 게임 시트를 재생성했을 때 바이트가 일치한다.
- `node --test scripts/corgi-pirouette-art.test.mjs` — 8방향 전신·치수·앵커·프레임별 반전 검사 통과.
- `node scripts/validate-assets.mjs` — 새 필수 PNG를 포함한 manifest 검사 통과.

## Commit Message

```text
feat(corgi): 발레 점프 전신 회전 기본 아트 추가

Plan: 2026-10-28-corgi-ballet-pirouette-jump
Phase: P01-ballet-pirouette-jump
Task: T01-core-pirouette-art

- 기존 코기 디자인으로 8방향 발레 전신 프레임 제작
- 좌우 보정 시트와 필수 에셋 및 아트 검사 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 완료 (이 Task의 Git 커밋)

## Worktree Guard

- 이 Task의 파일만 스테이징한다. 기존 보스·HUD·월드 3 미커밋 변경을 커밋에 섞지 않는다.
