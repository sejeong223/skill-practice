# Task: T01 열린 상자 픽셀 이미지와 에셋 등록

## Status: done

## Goal

첨부한 두 번째 이미지처럼 상자가 열리고 분홍 발바닥의 고양이 손이 튀어나온 투명 픽셀 PNG를 추가하여 월드 1에서 필수 로드한다.

## Decision Summary

- 기존 `world-01-props.png`의 `cat-box` 프레임이 닫힌 상자다. 새 그림은 같은 판지 색과 검붉은 외곽선, 픽셀 크기를 맞춘다.
- 기존 `cat-box-triggered.svg`는 `box-cat-arm` 전용으로 남겨 두고 새 키 `world-01-prop-cat-box-open`을 `box-static`에 사용한다.

## Implementation

### I01. 참조를 바탕으로 열린 상자 PNG 제작

- Related Files:
  - `public/assets/pixel/props/world-01/world-01-props.png` :: `cat-box` 아틀라스 프레임 — 원본 시각 참조; read-only.
  - `public/assets/pixel/props/world-01/world-01-props.json` :: `frames["cat-box"]` — 원본 영역 210×188 참조; read-only.
  - `public/assets/pixel/props/world-01/cat-box-open.png` — 열린 판지 상자와 고양이 손 단일 투명 스프라이트; new.
  - `public/assets/pixel/props/world-01/cat-box-triggered.svg` — 다른 함정의 기존 에셋; read-only.

#### Details

- `imagegen` 내장 도구의 편집으로 사용자 첨부 이미지 두 장을 참조한다. 첫 그림은 같은 상자의 닫힌 모양·색 참조, 두 번째 그림은 목표 포즈와 구도 참조다. 사각형 검정 배경과 바닥 그림자를 제외한 실제 투명 RGBA 출력으로 만든다.
- 왼쪽·오른쪽으로 펼쳐진 상자 뚜껑, 열린 어두운 내부, 가운데서 위로 솟은 회갈색 고양이 앞발, 분홍 발바닥 무늬와 작은 모래색 픽셀을 살린다. 눈·머리·몸 전체를 추가하거나 뚜껑을 닫지 않는다. 원본 닫힌 상자의 진한 자주색 테두리와 황갈색 면을 보존한다.
- 도구 원본의 불필요한 투명 여백을 제거하고 픽셀 경계를 선명하게 유지한 채 단일 PNG로 보존한다. 최종 PNG 크기와 표시 크기는 열린 손까지의 높이 50~64px, 판지 상자 폭 56~68px 범위에서 맞춘다. 파일에는 상자 1개만 들어간다.
- 실제 원화와 게임 표시 크기를 검사하고 `.memory/test-plans/2026-10-20-world01-cat-box-open.md`에 최종 PNG 크기와 사용 프롬프트를 기록한다.

### I02. 필수 로드와 파일 검증

- Related Files:
  - `src/game/assets/assetManifest.json` :: `PIXEL_ASSETS` 원본 JSON — image 항목 1개 추가; modify.
  - `src/game/scenes/PreloadScene.ts` :: `preload` — 기존 `required` 로드 경로 확인; read-only.
  - `scripts/world01-box-open-art.test.mjs` — PNG 알파·크기·manifest 키/경로 확인; new.

#### Details

- 새 manifest 항목은 `{ "key": "world-01-prop-cat-box-open", "kind": "image", "url": "/assets/pixel/props/world-01/cat-box-open.png", "worldId": "world-01", "required": true }`로 한다. 기존 `world-01-prop-cat-box-triggered`의 URL이나 키는 변경하지 않는다.
- 테스트는 PNG가 실제 존재하는지, 투명 배경과 불투명 상자/손이 모두 있는지, 비율이 세로보다 가로가 지나치게 길지 않은지, manifest 키가 중복되지 않는지 확인한다. 세부 모양은 1× 게임 크기 육안으로도 확인한다.

## Acceptance Criteria

- [ ] 첨부한 두 번째 그림의 열린 상자·분홍 발바닥이 게임 표시 크기에서 식별된다.
- [ ] 투명 PNG와 필수 manifest 키가 존재하고 기존 닫힌 상자와 별도 함정 에셋은 유지된다.

## Validation

- `node --test scripts/world01-box-open-art.test.mjs` — PNG와 manifest 검증.
- `node scripts/validate-assets.mjs` — 필수 에셋 로드 경로 검증.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run build` — 프로덕션 빌드.

## Commit Message

```text
feat(world01): 열린 고양이 손 상자 이미지 추가

Plan: 2026-10-20-world01-cat-box-open
Phase: P01-box-open
Task: T01-open-box-art

- 참조 그림에 맞는 투명 픽셀 상자와 분홍 발바닥 추가
- 필수 에셋 등록과 이미지 검증 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
