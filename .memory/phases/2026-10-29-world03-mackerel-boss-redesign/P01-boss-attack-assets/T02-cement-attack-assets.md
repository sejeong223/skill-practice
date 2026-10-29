# Task: T02 시멘트 세 형태 픽셀 자산

## Status: pending

## Goal

고등어 태비의 흙손 동작에 맞는 시멘트 파도·투척 덩어리·바닥 웅덩이를 전용 투명 PNG로 만들어 로드한다. 세 효과가 벽돌과 혼동되지 않아야 한다.

## Decision Summary

- 바닥 파도는 흙손으로 낮게 밀린 젖은 시멘트, 덩어리는 공중 포물선, 웅덩이는 착지 후 감속 영역이다. 파도 뒤 자국은 최대 160px, 덩어리 착지 자국은 96px 폭이다.
- 기존 오후 공사장 배경·바닥, 벽돌 PNG를 유지한다. 이 Task에서는 충돌·이동 코드를 연결하지 않는다.

## Implementation

### I01. 원본과 게임 자산 제작

- Related Files:
  - `art/source/world03-cement-wave.png` :: 64×24 파도 원본 — new
  - `art/source/world03-cement-lump.png` :: 48×48 덩어리 원본 — new
  - `art/source/world03-cement-puddle.png` :: 96×16 젖은 자국 원본 — new
  - `scripts/generate-world03-cement-attacks.mjs` :: source→game PNG 검증/출력 — new
  - `public/assets/pixel/objects/world-03/cement-wave.png` :: 파도 PNG — new
  - `public/assets/pixel/objects/world-03/cement-lump.png` :: 덩어리 PNG — new
  - `public/assets/pixel/objects/world-03/cement-puddle.png` :: 웅덩이 PNG — new
  - `src/game/assets/assetManifest.json` :: 세 필수 이미지 등록 — modify
  - `scripts/world03-construction-assets.test.mjs` :: 기존 공사장 자산 회귀 — modify
  - `scripts/world03-cement-art.test.mjs` :: 새 자산 알파·크기·서로 다른 실루엣 — new

#### Details

- **Signatures & Types**:
  ```text
  { key: "world-03-cement-wave", kind: "image", url: "/assets/pixel/objects/world-03/cement-wave.png", worldId: "world-03", required: true }
  { key: "world-03-cement-lump", kind: "image", url: "/assets/pixel/objects/world-03/cement-lump.png", worldId: "world-03", required: true }
  { key: "world-03-cement-puddle", kind: "image", url: "/assets/pixel/objects/world-03/cement-puddle.png", worldId: "world-03", required: true }
  ```
- **Data & Schema Fields**: 파도 64×24, 덩어리 48×48, 웅덩이 96×16 RGBA. 실제 물리 판정은 P02-T02에서 별도 설정하며 투명 그림 외곽을 그대로 충돌 상자로 쓰지 않는다. 웅덩이를 160px 파도 꼬리로 늘릴 때 nearest-neighbor를 유지한다.
- **Execution Flow / Logic**:
  1. Precondition: P01-T01의 회청색 고양이·노란 안전모·벽돌 PNG와 대비를 확인한다.
  2. Core: 회색·청회색의 두세 단계 평면 색과 어두운 픽셀 외곽선을 사용한다. 파도는 낮고 긴 전방 실루엣, 덩어리는 높은 둥근 비정형, 웅덩이는 바닥에 낮게 붙은 자국으로 만든다.
  3. Error handling: source 누락, 규격 오류, 모든 픽셀이 투명하거나 불투명 배경인 경우 `--check`와 자산 테스트가 실패한다.
  4. State/return: 필수 manifest를 통해 프리로드되며 현행 벽돌 PNG·월드 3 배경 PNG의 해시는 바뀌지 않는다.

## Acceptance Criteria

- [ ] 파도·덩어리·웅덩이가 벽돌과 분명히 다른 픽셀 실루엣으로 보인다.
- [ ] 세 PNG는 지정 규격·투명 배경이고 필수 에셋으로 로드된다.
- [ ] 기존 공사장 바닥·배경과 장애물 스프라이트는 변경되지 않는다.

## Validation

- `node scripts/generate-world03-cement-attacks.mjs --check` — source/output byte 일치.
- `node --experimental-strip-types --test scripts/world03-construction-assets.test.mjs scripts/world03-cement-art.test.mjs` — 기존+신규 자산 회귀 통과.
- `npx.cmd tsc --noEmit` — manifest 타입 검사 통과.

## Commit Message

```text
feat(월드3): 시멘트 파도와 덩어리 픽셀 자산 추가

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P01-boss-attack-assets
Task: T02-cement-attack-assets

- 파도·투척 덩어리·웅덩이 원본과 게임 PNG 제작
- 필수 프리로드 및 크기·투명도 검증 추가
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
