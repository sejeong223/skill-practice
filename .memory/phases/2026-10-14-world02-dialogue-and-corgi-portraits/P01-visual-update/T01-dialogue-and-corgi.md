# Task: T01 공통 대사창과 정면 정지 코기

## Status: done

## Goal

월드 2 진입 컷신이 첫 스토리와 같은 캡션 프레임을 사용하고, 긴장한·비장한 코기의 머리·몸통·발이 정면으로 앉은 정지 상태로 보이게 한다.

## Decision Summary

- 월드 2 전용 대사창 PNG를 제거하고 `CutsceneOverlay` 공통 프레임을 재사용한다.
- 두 코기 얼굴 이미지를 기존 이미지 키·URL을 유지한 채 정면 전신 PNG로 교체한다.
- 기존 대본·비트 시간·저장 ID·스테이지 전환은 변경하지 않는다.

## Implementation

### I01. 대사창 통일

- `src/components/game/CutsceneOverlay.tsx` :: `CutsceneOverlay` — `world-02-intro` 식별 클래스는 모바일의 긴 문장과 하단 안내 배치에만 사용하고 공통 `.cutscene-caption-frame`을 그대로 렌더링한다; read-only.
- `src/app/globals.css` :: `.cutscene-overlay--world02`와 모바일 분기 — 전용 프레임 배경·테두리·패딩 규칙을 제거한다. 모바일에서 긴 문장이 잘리지 않도록 `max-height: none`, 작은 글자와 화자 인라인 배치, 기존 하단 안내 숨김만 남긴다; modify.
- `src/game/assets/assetManifest.json` :: `world-02-entrance-dialogue-frame` — 사용하지 않는 이미지 항목을 삭제한다; modify.
- `public/assets/pixel/cutscenes/world-02/world-02-dialogue-frame.png` — 사용하지 않는 전용 PNG를 삭제한다; delete.
- `src/game/scenes/World02EntranceScene.ts` :: `IMAGE_KEYS` — 전용 대사창 키를 필수 이미지 목록에서 제거한다; modify.

### I02. 코기 정면 정지 이미지

- `public/assets/pixel/cutscenes/world-02/world-02-corgi-nervous.png` — 기존 긴장한 얼굴·땀 표정을 참고하여 몸통과 앞발·뒷발이 보이는 투명 배경 정면의 앉은 PNG로 교체한다; modify.
- `public/assets/pixel/cutscenes/world-02/world-02-corgi-resolved.png` — 기존 비장한 얼굴 표정을 참고하여 같은 자세·크기의 투명 배경 정면의 앉은 PNG로 교체한다; modify.
- `src/game/scenes/World02EntranceScene.ts` :: `showPortrait` — 두 이미지를 같은 위치와 크기로 표시하고 무한 반복 yoyo 상하 이동 tween을 삭제한다. 화면 폭 720px 이하에서는 대사창과 겹치지 않도록 두 이미지 모두 360×360, y=225로 표시하고 그보다 큰 화면에서는 480×480, y=310으로 표시한다. 진입 alpha 페이드는 유지한다; modify.

#### Data & Schema Fields

- `IMAGE_KEYS`: `readonly` 문자열 튜플. 배경·긴장·비장 세 키만 남긴다.
- `CutsceneOverlayState`: 필드 변경 없음. `cutsceneId`, `beat`, `index`, `totalBeats` 등 기존 이벤트 계약 유지.
- 두 PNG: RGBA 투명 배경, 정면으로 앉은 정지 자세, 각각 한 마리만 담는다. 기존 `world-02-entrance-corgi-nervous`와 `world-02-entrance-corgi-resolved` manifest 키·URL 유지.

#### Execution Flow / Logic

1. 컷신 시작 시 기존 배경과 비트 이벤트를 유지한다.
2. 비트 2에서 긴장 이미지, 비트 4에서 비장 이미지를 보여준다.
3. 공통 React 캡션 프레임이 모든 6비트 대사를 표시한다.
4. 이미지 누락과 씬 종료 정리는 기존 경로를 따른다. 사용하지 않는 프레임 키는 검사하지 않는다.

## Acceptance Criteria

- [ ] 월드 2에서 첫 스토리와 동일한 캡션 프레임이 보이고 전용 대사창 PNG는 더 이상 참조되지 않는다.
- [ ] 긴장한·비장한 코기는 모두 몸통과 발이 보이는 정면의 앉은 정지 이미지로 나타난다.
- [ ] 6문장 진행·건너뛰기·월드 2 스테이지 진입은 유지된다.

## Validation

- `npx.cmd eslint src/components/game/CutsceneOverlay.tsx src/game/scenes/World02EntranceScene.ts` — 관련 코드 린트 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run build` — Next.js 빌드 통과.
- `npm.cmd run test:progression` — 월드 2 진입 경로를 포함한 진행 테스트 3개 통과.
- `rg -n "world-02-entrance-dialogue-frame|world-02-dialogue-frame" src public --glob '!*.png'` — 검색 결과 없음.
- 두 PNG를 육안으로 확인하고 투명 배경·전신·정면·앉은 정지 자세인지 검토한다.

## Commit Message

```text
feat(world02): 공통 대사창과 정면 코기 이미지 적용

Plan: 2026-10-14-world02-dialogue-and-corgi-portraits
Phase: P01-visual-update
Task: T01-dialogue-and-corgi

- 월드 2 전용 대사창 이미지와 스타일 제거
- 긴장한·비장한 코기 앉은 정면 전신 이미지 및 정지 연출 적용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task와 소스 변경을 함께 커밋함
