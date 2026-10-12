# Task: T01 화자별 대사 카메라

## Status: done

## Goal

보스 대사에서 축소로 맵 밖이 보이지 않고 말하는 캐릭터에 초점이 이동한다.

## Decision Summary

- 도입/클리어의 dialogue 첫 speaker를 기준으로 실제 코기/삼색이 좌표를 쓴다. 맵 크기와 보스 바닥은 바꾸지 않는다.

## Implementation

### I01. 카메라 초점과 복원

- Related Files: `src/game/camera/CameraDirector.ts` :: `focusDialogue`, `endCutscene`; modify. `src/game/scenes/StageScene.ts` :: create의 cutscene-beat/도입 시작; modify.
- **Signatures & Types**: `focusDialogue(x: number, y: number, immediate?: boolean): void`. zoom=1 고정, 맵 bounds 내부 center. pan 효과는 새 대사에서 취소/강제 교체하며 300ms 이동, 첫 대사는 즉시 배치한다.
- **Data & Schema Fields**: 저장 모델 변화 없음. StageScene 이벤트 payload의 `beat.dialogue?.[0]?.speaker`, `index` 사용.
- **Execution Flow / Logic**: 보스 intro/clear에만 적용; calico는 calicoSprite, corgi는 player. y는 장면 세로 중앙을 유지해 바닥/하늘을 노출하지 않는다. setZoom(0.8) 제거. endCutscene은 진행 중 pan/zoom 효과를 리셋하고 zoom1/플레이어 추적 복원.
- **Error & Exception Handling**: 캐릭터/카메라가 없으면 무시. 빠른 다음 대사·스킵·씬 종료 후 오래된 pan이 덮어쓰지 않게 한다.
- **State Transition & Return**: 대사 중 follow 정지, 대사 완료 후 follow 복원. 음악/전투 상태는 기존 경로 유지.

### I02. 검증

- 브라우저에서 첫 대사→다음 화자→연속 진행→클리어 대사와 종료를 확인한다. zoom1, 카메라 worldView가 맵 bounds 내부, 캐릭터 표시를 screenshot으로 확인. 테스트 전용 API를 제품에 추가하지 않는다.

## Acceptance Criteria

- [x] 도입/클리어 화자에 따라 카메라가 이동한다.
- [x] 축소/빠른 진행/완료 후 맵 밖이 드러나지 않는다.

## Validation

- `npx.cmd tsc --noEmit`
- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs`
- 기존 localhost:3000 Chromium 대사 수동/자동 진행 및 화면 확인.

## Commit Message

```text
fix(camera): 보스 대사마다 말하는 캐릭터로 초점을 이동한다

Plan: 2026-10-12-world01-camera-exit-sfx
Phase: P01-player-feedback
Task: T01-speaker-camera
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

타입 검사 및 컷신 자동 테스트5건 통과. 실제 도입/클리어 대사 화자별 이동, zoom1 및 worldView 맵 내부 유지, 빠른 진행 후 추적/조작 복원 확인. 화면 증거와 JSON 저장, 브라우저 오류0.
