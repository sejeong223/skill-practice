# Task: T01 레퍼런스 기반 치즈 태비 래스터 원화

## Status: done

## Goal

월드 2 치즈 태비의 네 자세를 새 래스터 픽셀 원화로 완전히 다시 제작한다. 게임용 384×96 PNG와 4배 미리보기가 코기·턱시도·삼색이 실제 에셋 옆에서 같은 작품의 캐릭터로 읽혀야 한다. 현재 치즈 태비 그림의 단순 축소·색 교체·윤곽 추적은 완료로 인정하지 않는다.

## Decision Summary

- 이번 사용자 요청과 실제 레퍼런스 PNG 네 개만 시각 기준으로 삼는다. 기존 치즈 태비 디자인 결정·계획 문서와 현재 치즈 태비 SVG/PNG는 시각 기준에서 제외한다.
- 기술 계약은 투명 96×96 프레임 4개(가로 384×96), 오른쪽을 바라보는 원화, 인덱스 `0 대기 / 1 공격 예고 / 2 공 공격 / 3 패배`다. 이는 현재 `CheeseTabbyBallPattern.telegraph()`, `launch()`, `StageScene.handleLaterBossDefeat()`의 프레임 참조에 맞춘다.

## Implementation

### I01. 실물 레퍼런스 분석과 새 픽셀 원화 제작

- Related Files:
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: `corgi-run` — 따뜻한 털 색, 굽은 몸·다리, 얼굴 크기와 픽셀 테두리 참고; read-only
  - `public/assets/pixel/characters/corgi/corgi-bark.png` :: `corgi-bark` — 얼굴 표정과 공격 순간의 자세 변화 참고; read-only
  - `public/assets/pixel/characters/world-01/calico-boss.png` :: `world-01-calico-boss` — 고양이의 머리·귀·눈·주둥이·꼬리와 낮은 네 발 실루엣 참고; read-only
  - `public/assets/pixel/characters/world-04/tuxedo-boss.png` :: `world-04-tuxedo-boss` — 보스 4프레임 구성, 짙은 윤곽과 명확한 공격 실루엣 참고; read-only
  - `assets/character-source/world-02/cheese-tabby-boss-source.png` :: `CheeseTabbySourceSheet` — **새로 그리는** 편집용 정본; new
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.svg` :: 이전 평면 도형 원본 — 새 래스터 정본으로 대체해 다시 렌더링되지 않게 제거; delete
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.png` :: `world-02-cheese-tabby-boss` — 게임이 로드하는 새 시트; modify

#### Details

- **Signatures & Types**:
  ```text
  CheeseTabbySourceSheet: PNG RGBA, 384 × 96 pixels
  Frame index: 0=idle, 1=telegraph, 2=attack, 3=defeated
  Frame rectangle: { x: index * 96, y: 0, width: 96, height: 96 }
  Facing in source: right; runtime initial facing: left via flipX(true)
  ```
- **Data & Schema Fields**:
  - `CheeseTabbySourceSheet`: 파일 1개, 가로 프레임 4개, 프레임당 `width=96`, `height=96`, `alpha=transparent background`; 별도 저장 모델·API·nullable 필드는 없음.
  - 대기·예고·공격 프레임의 발밑선은 로컬 `y=78..80`; 쓰러진 프레임도 같은 선에 닿는다. 프레임 경계 `x=0` 및 `x=95`는 투명해 이웃 프레임으로 색이 새지 않는다.
  - 보이는 실루엣의 목표 범위(알파 `>16` 기준): 대기·예고·공격은 로컬 `x=4..94`, `y=18..80`, 쓰러짐은 `x=4..94`, `y=42..80`. 이 범위는 기술 정렬을 위한 여유 구간이며, 기존 치즈 태비 도형을 복사하라는 뜻이 아니다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 네 레퍼런스 PNG의 실제 1배 크기와 4배 nearest 확대를 함께 본다. 코기는 112×128 프레임, 삼색이는 96×96 프레임, 턱시도는 128×128 프레임이므로 **캔버스 크기 자체를 그림체로 혼동하지 않는다**.
  2. Core Processing: 삼색이의 고양이 얼굴 비율과 코기의 굽은 몸·짧은 다리, 턱시도의 보스용 실루엣 구분을 합쳐 **새** 주황 줄무늬 고양이를 그린다. 네 발·몸통·목·큰 머리가 하나의 자연스러운 덩어리로 이어져야 한다. 귀는 뾰족하되 둥근 볼과 흰/크림 주둥이가 보이고, 눈은 작은 단색 가로선 대신 픽셀로 읽히는 홍채·눈꺼풀·시선이 있어야 한다. 꼬리와 등 줄무늬는 털색 안에 통합한다.
  3. Color & pixel treatment: 색 기준은 코기 주황 `#F09848`, 코기 크림 `#FFF0D8`, 코기 짙은 윤곽 `#301810`, 삼색이 진주황 `#F88018`, 턱시도 어두운 윤곽 `#241D2C` 근방이다. 색을 그대로 베끼지 말고 이 온도와 대비를 맞춘다. 1~2 논리 픽셀의 어두운 윤곽과 작은 명암 클러스터를 쓴다. 현재 SVG처럼 넓은 균일한 직사각형 색면, 두꺼운 계단식 볼, 큰 청록색 목 장식으로 얼굴을 대체하지 않는다. 전체 이미지에 블러·매끈한 그라데이션을 걸지 않는다.
  4. Pose separation: `0`은 편안하지만 도전적인 네 발 자세, `1`은 귀·시선·앞발과 작은 호루라기로 읽히는 공격 예고, `2`는 앞다리와 몸중심이 움직여 공을 던지는 자세, `3`은 삼색이 패배 프레임처럼 지면에 쓰러진 모습이다. 프레임 1·2는 단순히 같은 몸 위에 발 하나만 덧붙인 그림이 아니어야 한다. 호루라기 소리는 코드에서 이미 쓰므로 호루라기는 얼굴보다 작고 보조적으로 읽히게 한다.
  5. Error & Exception Handling: 배경색이 불투명하게 들어가거나 프레임이 잘리면 해당 원화를 수정한다. 캔버스를 비정수 배율로 축소해 오류를 숨기지 않는다. 레퍼런스 그림을 그대로 오려 붙이거나 기존 치즈 태비 실루엣을 확대·재색칠해 대체하지 않는다.
  6. State Transition & Return: 편집용 PNG를 정본으로 남기고 생성 스크립트가 동일한 내용의 게임용 시트와 미리보기를 출력한다. 레퍼런스 네 개를 수정하지 않는다.

### I02. SVG 의존 생성 흐름을 래스터 정본으로 교체

- Related Files:
  - `scripts/generate-world02-cheese-tabby.mjs` :: `renderSpriteSheet`, `renderPreview`, `main` — 원본 PNG 검증, 게임용 PNG 및 4배 미리보기 생성·동기화; modify
  - `.memory/reviews/2026-10-26-cheese-tabby-boss-preview.png` :: `CheeseTabbyPreview` — 새 그림의 4배 nearest 접촉 시트; modify
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md` :: 정적 파일 경로 규칙 — 실행 중 Next 관련 코드를 건드릴 경우 먼저 읽을 가이드; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  renderSpriteSheet(pngBytes: Buffer): Promise<Buffer>
  renderPreview(pngBytes: Buffer): Promise<Buffer>
  main(): Promise<void>
  ```
- **Data & Schema Fields**:
  - `source`: `assets/character-source/world-02/cheese-tabby-boss-source.png`; PNG, `width=384`, `height=96`, RGBA, 네 프레임. 없는 파일·다른 크기·불투명 배경은 오류.
  - `spriteSheet`: `public/assets/pixel/characters/world-02/cheese-tabby-boss.png`; 원본과 같은 픽셀 배치, 투명 PNG. 비정수 크기 변경 없음.
  - `preview`: `.memory/reviews/2026-10-26-cheese-tabby-boss-preview.png`; `1536×384`, 4배 nearest 확대, 기존 미리보기와 같은 밝은 중립 배경.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `sharp(pngBytes).metadata()`로 PNG 형식, 384×96 크기, alpha 채널을 확인한다. SVG를 읽거나 렌더하지 않는다.
  2. Core Processing: 원본 픽셀을 바꾸지 않고 PNG로 결정적으로 재인코딩해 게임 시트를 만든다. 기존 `renderPreview()`의 nearest 확대와 중립 배경 합성을 유지한다.
  3. Error & Exception Handling: 입력 메타데이터가 다르면 명확한 assertion 오류를 낸다. `--check`는 두 출력의 바이트가 저장 파일과 다른 경우 실패하고 파일을 덮어쓰지 않는다.
  4. State Transition & Return: 일반 실행은 게임 시트·미리보기만 기록한다. 원본 PNG와 네 레퍼런스는 읽기 전용으로 둔다.

### I03. 구조 검사와 필수 육안 비교

- Related Files:
  - `scripts/world02-cheese-tabby-art.test.mjs` :: 네 프레임·투명도·기준선·미리보기 테스트 — 현재 평면 벡터 그림에 맞춰진 조건 교체; modify
  - `public/assets/pixel/characters/corgi/corgi-run.png`, `public/assets/pixel/characters/world-01/calico-boss.png`, `public/assets/pixel/characters/world-04/tuxedo-boss.png` :: 육안 비교 대상; read-only

#### Details

- **Signatures & Types**:
  ```text
  getOpaqueBounds(frame, alphaThreshold = 16)
    -> { left: number, top: number, right: number, bottom: number, pixels: number }
  ```
- **Data & Schema Fields**:
  - 검사할 프레임 시작 X는 `[0, 96, 192, 288]`, 크기는 각각 96×96. 네 프레임 해시가 모두 달라야 한다. 알파가 있는 픽셀의 본체가 프레임 테두리를 넘지 않아야 하고 기준선 `bottom=78..80`을 지켜야 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: PNG 크기·프레임 수·투명 배경·프레임별 내용 차이와 확대 미리보기 1536×384를 자동 검사한다.
  2. Core Processing: 기존 테스트의 `alpha === 0 || alpha === 255`와 `colors.size <= 24` 단언을 제거한다. 코기·삼색이 실제 PNG는 가장자리와 털 표현에 부분 알파 및 여러 톤을 쓰므로 이 단언은 새 목표를 거꾸로 막는다. 부분 알파를 허용하되 캔버스 경계는 투명하고 프레임 간 누출은 없어야 한다.
  3. Error & Exception Handling: 자동 검사가 통과해도 시각적 유사성을 증명하지 못한다. 원본 크기 1배와 4배 미리보기에서 코기·삼색이·턱시도를 실제로 나란히 보고 얼굴 언어, 윤곽 굵기, 곡면, 포즈 차이를 확인한다. 한눈에 다른 게임 캐릭터처럼 보이면 T01을 완료하지 않고 원화를 다시 손본다.
  4. State Transition & Return: 에셋 검사와 육안 비교가 모두 통과한 뒤에만 T01을 `done`으로 표시한다.

## Acceptance Criteria

- [ ] 현재 치즈 태비 SVG가 더는 원본으로 사용되지 않으며, 새 원본 래스터와 게임 PNG가 동일한 384×96 네 프레임을 가진다.
- [ ] 네 프레임의 실루엣·얼굴·털 표현이 서로 구분되고, 1배/4배로 코기·턱시도·삼색이와 나란히 보아도 같은 게임의 캐릭터로 읽힌다.
- [ ] 기존 치즈 태비 그림을 단순히 축소·재색칠·추적하지 않았고, 기존 치즈 태비 디자인 문서의 색상·형태 제약을 사용하지 않았다.
- [ ] 기준선, 투명도, 프레임 분리, 생성물 동기화가 자동 검사를 통과한다.

## Validation

- `node scripts/generate-world02-cheese-tabby.mjs` — 새 정본에서 게임 PNG와 미리보기 생성.
- `node scripts/generate-world02-cheese-tabby.mjs --check` — 생성물이 정본과 바이트 단위로 동기화됨.
- `node --test scripts/world02-cheese-tabby-art.test.mjs` — 네 프레임·투명 배경·기준선·미리보기 통과.
- `node node_modules/eslint/bin/eslint.js scripts/generate-world02-cheese-tabby.mjs scripts/world02-cheese-tabby-art.test.mjs` — 스크립트 린트 통과.
- `git diff --check` — 공백 오류 없음.
- 레퍼런스 PNG 네 개와 새 시트·미리보기를 1배/4배로 나란히 열어 눈·주둥이·몸통·윤곽의 스타일 차이가 해소되었음을 확인한다.

## Commit Message

```text
feat(art): 치즈 태비를 게임 레퍼런스 스타일로 다시 그리기

Plan: 2026-10-26-world02-cheese-tabby-reference-redraw
Phase: P01-reference-art-rebuild
Task: T01-reference-raster-art

- 코기·턱시도·삼색이를 기준으로 네 자세의 새 래스터 원화 제작
- SVG 생성 흐름을 래스터 정본으로 교체하고 시트·미리보기 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `e1e2b8d`
