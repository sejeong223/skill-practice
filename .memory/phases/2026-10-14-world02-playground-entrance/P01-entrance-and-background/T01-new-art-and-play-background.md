# Task: T01 새 픽셀 이미지와 월드 2 플레이 배경

## Status: done

## Goal

월드 2 진입 컷신의 세 장면에 쓸 신규 이미지 4장과 실제 플레이용 놀이터 패럴랙스 이미지 3장을 만든다. Phaser의 필수 에셋 manifest에 등록하고 현재 월드 2 플레이 화면에서 단색 대체 대신 새 배경 3개가 그려지는지 확인한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-14-world02-playground-entrance.md): 코기 눈높이의 거대한 놀이터, 새 긴장/결심 얼굴, `....가자!`를 담을 새 픽셀 대사창 이미지와 같은 장소의 플레이 배경을 제작한다.
- 사용자가 다시 선택한 첫 놀이터 이미지의 구도·낮·파란 하늘·노랑/청록 기구를 보존하고, 두 번째 이미지의 적당한 픽셀 질감만 적용한다. 코기 얼굴은 실제 게임의 검은 점눈 디자인을 따른다.
- 현재 `WORLD_MAP_THEMES`/`ParallaxRenderer`는 월드 2 배경 키와 3개 레이어를 이미 지원한다. 맵 타일셋·Tiled 맵·기믹은 이 Task의 대상이 아니다.

## Implementation

### I01. 컷신 신규 이미지 4장

- Related Files:
  - `public/assets/pixel/cutscenes/intro/intro-corgi-actions.png` :: 실제 게임 코기 얼굴과 표정·픽셀 외곽선 참고; read-only
  - `public/assets/pixel/ui/corgi-face.png` :: 실제 게임 코기 눈 형태 참고; read-only
  - `public/assets/pixel/backgrounds/world-01/world-01-mid.png` :: 기존 게임의 배경 해상감 참고; read-only
  - `public/assets/pixel/cutscenes/world-02/world-02-playground-pov.png` :: 첫 장면의 코기 시점 놀이터; new
  - `public/assets/pixel/cutscenes/world-02/world-02-corgi-nervous.png` :: 둘째 장면의 긴장한 얼굴; new
  - `public/assets/pixel/cutscenes/world-02/world-02-corgi-resolved.png` :: 대사 장면의 결심한 얼굴; new
  - `public/assets/pixel/cutscenes/world-02/world-02-dialogue-frame.png` :: 새 픽셀 대사창 프레임; new

#### Details

- 모든 래스터 이미지는 `imagegen` 스킬과 이미지 생성 도구로 새로 만든다. 실제 게임의 코기 인트로 시트와 UI 얼굴을 레퍼런스로 전달한다. 눈은 작은 검은 점/타원만 사용하고 흰자·반사광·안광을 넣지 않는다. 기존 얼굴을 잘라 붙인 결과를 새 이미지로 간주하지 않는다.
- `world-02-playground-pov.png`: 16:9 불투명 PNG. 사용자가 다시 선택한 첫 놀이터 그림의 코기 눈높이, 파란 낮 하늘, 노랑/청록 미끄럼틀과 그네, 정글짐, 모래, 아파트·나무 구도를 유지한다. 두 번째 그림의 **적당한 픽셀 질감만** 적용하며 직전 과도한 큰 픽셀 버전은 쓰지 않는다. 화면에 코기, UI, 글자, 로고를 넣지 않는다.
- `world-02-corgi-nervous.png`와 `world-02-corgi-resolved.png`: 투명 RGBA PNG의 정면 얼굴 클로즈업. 두 파일에서 머리 크기·귀 끝·목 기준점을 맞춘다. nervous는 작은 땀방울, resolved는 입을 여는 표정이다. 눈은 양쪽 모두 기존 게임처럼 단색 검은 점/타원이다.
- `world-02-dialogue-frame.png`: 목표 900×170, 투명 RGBA의 독립된 픽셀 창. 가장자리와 모서리는 두껍고 선명하며 내부는 한글 흰 글자를 읽을 수 있는 어두운 면이다. 화자명·대사 글자를 이미지에 굽지 않는다. 16:9 화면 하단과 좁은 모바일 너비에서도 텍스트 여백이 남게 만든다.
- 생성 도구가 목표 크기와 다른 원본을 반환하면 실제 크기를 먼저 기록한다. 비율/프레임 간 정렬이 맞지 않으면 재생성하거나 이미지 생성 도구로 수정해 최종 파일이 위 목표 크기와 일치하도록 한다. 흐린 보간이나 문자 오류를 런타임 CSS/Phaser 필터로 숨기지 않는다.

### I02. 실제 플레이용 놀이터 배경 3장

- Related Files:
  - `public/assets/pixel/backgrounds/world-02/world-02-far.png` :: 먼 하늘·아파트·놀이터 실루엣; new
  - `public/assets/pixel/backgrounds/world-02/world-02-mid.png` :: 그네·미끄럼틀·정글짐과 나무의 중경; new
  - `public/assets/pixel/backgrounds/world-02/world-02-foreground.png` :: 드문 잎·체인·그림자 전경; new
  - `src/game/data/worldMaps.ts` :: `WORLD_MAP_THEMES`의 월드 2 `layers`와 `createTheme`; read-only, 현재 키가 맞는지 검증
  - `src/game/maps/ParallaxRenderer.ts` :: `ParallaxRenderer.render/createLayer`; modify, 생성된 이미지 높이를 720px 플레이 화면에 맞춰 타일 스케일 적용

#### Details

- 세 파일 모두 16:9 PNG이며 좌우 반복 경계가 튀지 않아야 한다. `far`는 불투명, `mid`와 `foreground`는 투명 RGBA다. 원경은 선택한 첫 그림과 같은 화창한 낮의 파란 하늘과 동네 외곽, 중경은 같은 노랑/청록 놀이기구, 전경은 화면 가장자리의 드문 잎/체인만 둔다. 원본과 비슷한 중간 정도의 픽셀 질감을 사용한다.
- `WORLD_MAP_THEMES`의 기존 키 `world-02-background-far`, `world-02-background-mid`, `world-02-foreground`를 그대로 쓴다. 중경의 구조물을 실제 충돌 발판처럼 보이게 놓지 않고 코기, 적, 출구, 발판을 가리는 불투명 띠를 만들지 않는다. 특히 전경은 현재 깊이 20으로 플레이어보다 앞에 그려진다는 점을 반영한다.
- 현재 모든 월드 2 스테이지가 공용 `world-02-theme`을 사용하므로 세 배경이 1~4단계와 보스 화면에 적용된다. 새 타일맵과 상호작용 오브젝트는 만들지 않는다.

### I03. 필수 에셋 메타데이터와 로드

- Related Files:
  - `src/game/assets/assetManifest.json` :: `PIXEL_ASSETS` 원본의 월드 2 이미지 7항목; modify
  - `src/game/assets/assetTypes.ts` :: `PixelAssetDefinition`; read-only
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene.preload/loadAsset`; read-only, 공용 image 로더와 필수 로드 오류 확인

#### Signatures & Data Schema

- 새 타입은 없다. 각 manifest 항목은 기존 `PixelAssetDefinition` 필드 `{ key: string, kind: "image", url: string, worldId: "world-02", required: true }`를 사용한다.
- 정확한 `key → url` 목록:
  - `world-02-entrance-playground` → `/assets/pixel/cutscenes/world-02/world-02-playground-pov.png`
  - `world-02-entrance-corgi-nervous` → `/assets/pixel/cutscenes/world-02/world-02-corgi-nervous.png`
  - `world-02-entrance-corgi-resolved` → `/assets/pixel/cutscenes/world-02/world-02-corgi-resolved.png`
  - `world-02-entrance-dialogue-frame` → `/assets/pixel/cutscenes/world-02/world-02-dialogue-frame.png`
  - `world-02-background-far` → `/assets/pixel/backgrounds/world-02/world-02-far.png`
  - `world-02-background-mid` → `/assets/pixel/backgrounds/world-02/world-02-mid.png`
  - `world-02-foreground` → `/assets/pixel/backgrounds/world-02/world-02-foreground.png`
- 중복 키·파일 누락은 `scripts/validate-assets.mjs`에서 실패해야 한다. 기존 선택적 `world-02-tileset`/`world-02-map-placeholder` 항목은 이번 작업에서 필수로 바꾸지 않는다.

#### Execution Flow / Error Handling

1. 생성 이미지 7장의 실제 픽셀 크기, 투명 알파, 좌우 반복 이음새, 코기 얼굴 두 표정의 위치 일치, 한글/UI용 안전 영역을 확인한다.
2. manifest에 위 7개 항목을 등록한다. `PreloadScene.preload()`가 기존 `required` 경로로 전부 읽는다.
3. 필수 파일을 못 읽으면 기존 `FILE_LOAD_ERROR` 경로에서 파일 키·URL을 드러낸다. 플레이 배경이 조용히 단색 대체로 떨어지는 상태를 완료로 인정하지 않는다.
4. 개발 실행에서 월드 2 첫 스테이지에 들어가 원경/중경/전경이 실제로 표시되는지 확인한다.

## Acceptance Criteria

- [ ] 요청한 컷신에 쓸 새 이미지 4장과 플레이 배경 새 이미지 3장이 실제 PNG 파일로 있다.
- [ ] 코기 첫 시점에는 코기/텍스트가 없고, 두 얼굴의 투명 배경과 정렬이 맞으며, 새 대사창은 별도 그림이다.
- [ ] `world-02-theme`의 기존 3개 키가 필수 이미지와 연결되어 월드 2 플레이의 단색 대체 레이어를 교체한다.
- [ ] 이미지가 읽기 쉽게 보이고 코기·적·출구·발판을 과하게 가리지 않는다. 기존 월드 1 화면과 로드에는 회귀가 없다.

## Validation

- `node scripts/validate-assets.mjs` — 7개 필수 URL과 중복 키를 검사한다.
- `npx.cmd tsc --noEmit` — manifest import 타입 검사.
- `npm.cmd run lint` — JSON 참조·프로젝트 lint 검사.
- `npm.cmd run build` — 프로젝트 빌드 검사.
- `npm.cmd run dev` — 실제 월드 2 플레이 화면에서 새 배경 3층과 이미지 로드 오류 없음 확인; 1280×720 및 좁은 화면을 캡처해 가림·반복 이음새를 확인한다.
- 이미지 정보 및 실제 픽셀 보기로 7개 파일의 크기/알파/코기 두 표정 정렬을 검사한다.

## Commit Message

```text
feat(assets): 월드 2 진입 그림과 놀이터 플레이 배경 추가

Plan: 2026-10-14-world02-playground-entrance
Phase: P01-entrance-and-background
Task: T01-new-art-and-play-background

- 코기 시점 놀이터와 신규 표정 및 대사창 이미지 제작
- 월드 2 패럴랙스 배경과 필수 manifest 키 등록
```

## Progress

- [x] 구현 완료 — 신규 PNG 7장과 필수 manifest 키 등록, 월드 2 레이어 높이 조정
- [x] 검증 통과 — 에셋 검사, TypeScript, lint, production build
- commit: pending
