# Task: T01 치즈 태비 픽셀 원화와 네 자세

## Status: done

## Goal

`치즈 태비`를 한눈에 알아볼 수 있는 투명 픽셀 스프라이트 시트와 확대 미리보기를 만든다. 보스다운 곧은 자세·주황 줄무늬·작은 호루라기로 삼색이와 놀이터의 잠자는 주황 고양이를 구별한다.

## Decision Summary

- 사용자가 고른 **놀이터 대장** 방향: 삐딱한 표정과 호루라기. 앞선 게임 아트 피드백에 맞춰 단순한 검은 눈, 안광 없는 만화형 픽셀을 사용한다.
- 원본은 오른쪽 얼굴을 보이는 128×128 프레임 4개, 총 512×128. 공격·피격 규칙은 이 Task에서 만들지 않는다.

## Implementation

### I01. 편집 가능한 원화와 PNG

- Related Files:
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.svg` :: `viewBox="0 0 512 128"` 픽셀 원본; new.
  - `public/assets/pixel/characters/world-02/cheese-tabby-boss.png` :: Phaser용 투명 스프라이트 시트; new.
  - `scripts/generate-world02-cheese-tabby.mjs` :: 원화→PNG·미리보기 생성 및 `--check`; new.
  - `.memory/reviews/2026-10-21-cheese-tabby-boss-preview.png` :: 4배 nearest 확대 검토용 접촉 시트; new.
  - `public/assets/pixel/characters/world-01/calico-boss.png` :: 크기·표정·3프레임 기준; read-only.
  - `public/assets/pixel/props/world-02/sleeping-fat-cat.png` :: 장애물 고양이와 실루엣 구별 기준; read-only.

#### Details

- **Signatures & Types**:
  ```javascript
  // scripts/generate-world02-cheese-tabby.mjs
  async function renderSpriteSheet(svgBytes) { /* Promise<Buffer: PNG 512×128> */ }
  async function renderPreview(pngBytes) { /* Promise<Buffer: PNG 2048×512> */ }
  // 기본 실행: 두 PNG 생성. --check: 두 파일을 다시 생성해 byte 비교하고 불일치 시 비정상 종료.
  ```
- **Data & Schema Fields**: 게임 저장 데이터는 변경하지 않는다. 프레임 인덱스는 `0 idle`, `1 telegraph`, `2 swat`, `3 defeated`로 고정한다. 각 프레임은 128×128 RGBA 투명 캔버스, 공통 중앙축 x≈64, 바닥 화소 y=118~123. 외곽 x=0과 x=127 및 모서리는 투명이다.
- **Execution Flow / Logic**:
  1. SVG의 네 포즈를 `translate(0|128|256|384,0)` 그룹과 정수 픽셀 격자의 `<rect>`/직각 경로로 그린다. `shape-rendering="crispEdges"`; 반투명/흐림 필터·그라데이션·사진 질감은 넣지 않는다. Sharp로 512×128 PNG를 출력하며 리사이즈는 하지 않는다.
  2. 몸통은 치즈색 `#F5B653`, 어두운 줄무늬 `#A85E32`, 밝은 가장자리 `#FFD179`, 주둥이·가슴 `#FFF0D0`, 외곽선 `#49323A`, 코·귀 안쪽 `#DB8B91`, 작은 검은 눈 `#30262C`, 호루라기 `#3DA8AD` 중심의 제한 팔레트(불투명 색 최대 24개)를 쓴다. 눈은 1~2색 단순 점/짧은 선이며 흰 반사점이 없다.
  3. `0`: 네 발을 디디고 가슴을 내밀며 고개를 살짝 비튼다. 높은 줄무늬 꼬리와 목 아래 호루라기가 보인다. `1`: 앞발을 들어 공격을 예고하고 눈썹을 내려다본다. `2`: 오른쪽으로 앞발을 크게 휘두르되 프레임 경계에 닿지 않는다. `3`: 옆으로 납작하게 넘어져 눈이 만화식 선이 되고 호루라기는 바닥 가까이 내려온다. 네 프레임 모두 귀·줄무늬·크림색 주둥이의 정체성이 유지된다.
  4. PNG 각 프레임을 Sharp `kernel.nearest`로 4배 키워 가로 접촉 시트를 만든다. 배경은 월드 2 모래색 `#F5E7C7`; 이미지 가장자리·프레임 간 영역이 분리되어 읽혀야 한다. 1배 원본도 직접 열어 작은 눈/호루라기와 실루엣을 확인한다.
- **Error & Exception Handling**: SVG·PNG 산출물이 없거나 너비/높이가 다르면 생성·검사에서 실패한다. `--check`는 파일을 덮어쓰지 않고 차이를 알려준다. PNG 파일은 이 Task에서 아직 에셋 목록에 필수 등록하지 않아 미완성 생성 중 로딩을 깨뜨리지 않는다.

### I02. 아트 계약 검사

- Related Files:
  - `scripts/world02-cheese-tabby-art.test.mjs` :: `sharp`로 시트 구조를 검사; new.

#### Details

- **Signatures & Types**: `node:test`의 `test(name, async () => ...)`; 프레임 가로 시작 x는 `[0,128,256,384]`. `sharp(bytes).metadata()`와 `.ensureAlpha().raw().toBuffer({resolveWithObject:true})`를 사용한다.
- **Data & Schema Fields**: `width=512`, `height=128`, `hasAlpha=true`, 네 프레임. 서명 해시는 각 128×128 RGBA 버퍼의 SHA-256이다.
- **Execution Flow / Logic**: 각 프레임에 충분한 불투명 화소와 투명 테두리가 있는지, 네 해시가 다른지, 모든 포즈의 가장 낮은 화소가 y=118~123인지, 불투명 RGB 팔레트가 24색 이하인지 검사한다. PNG만 통과시키고 확대 미리보기가 2048×512인지 확인한다. 색/알파 검사와 별도로 사람이 1배·4배 이미지를 열어 눈 반사·현실적 질감·월드 1/장애물과의 혼동 여부를 확인한다.
- **Error & Exception Handling**: 한 포즈가 빈 칸이거나 어긋난 기준선, 흐린 가장자리, 원본과 PNG 불일치면 검사 실패 후 이미지 수정·재생성한다.

## Acceptance Criteria

- [ ] 1배 크기에서도 주황 줄무늬·호루라기·삐딱한 표정이 보이며 잠자는 고양이 장애물이나 삼색이와 구분된다.
- [ ] 투명 512×128 시트의 네 128×128 포즈가 분명히 다르고 눈에 안광·사진 질감이 없다.
- [ ] 원본에서 PNG·미리보기를 재생성할 수 있고 프레임의 발끝이 같은 높이다.

## Validation

- `node scripts/generate-world02-cheese-tabby.mjs --check` — 원본과 PNG·미리보기 동기화.
- `node --test scripts/world02-cheese-tabby-art.test.mjs` — 투명도·규격·프레임·팔레트·기준선.
- `node node_modules/typescript/bin/tsc --noEmit` — 기존 타입 안전성.
- `npm.cmd run lint` — 새 생성기·테스트 린트.
- `npm.cmd run build` — 프로젝트 빌드.
- `view_image`로 원본 PNG와 확대 미리보기를 열어 시각 검사한다.

## Commit Message

```text
feat(art): 월드 2 치즈 태비 보스 네 자세 제작

Plan: 2026-10-21-world02-cheese-tabby-design
Phase: P01-boss-art
Task: T01-cheese-tabby-sprite

- 주황 줄무늬와 호루라기를 가진 픽셀 보스 스프라이트 제작
- 투명 프레임·기준선·확대 미리보기 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 생성기 동기화, 이미지 계약 검사 2건, 타입 검사, 린트, 빌드, 1배·4배 육안 확인
- commit: `a19cf28`
