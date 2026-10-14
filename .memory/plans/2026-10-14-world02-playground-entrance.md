# Plan: 월드 2 놀이터 진입 연출과 플레이 배경

## Goal

월드 1 클리어의 `NEXT STAGE ->` 선택 뒤 약 7초 동안 새로 그린 거대한 놀이터 시점 → 긴장한 코기 얼굴 → 새 이미지 대사창의 `....가자!`를 자동 재생하고, 곧바로 `world-02-stage-1`을 시작한다. 월드 2의 실제 플레이 화면에도 새 놀이터 배경 3개 레이어가 나타난다.

- [확정 결정](../decisions/2026-10-14-world02-playground-entrance.md)
- 기존 코기 얼굴 시트와 월드 1 배경은 미술 참고용이다. 컷신의 장면·얼굴·대사창과 플레이 배경은 전부 새 이미지 파일로 만든다.
- 이전 완료 계획의 `.memory/current.md` 상태와 다른 미커밋 메모리 문서는 보존한다. 이번 포인터만 새 계획의 T01로 바꾼다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 신규 픽셀 이미지 7장과 월드 2 배경, 짧은 진입 연출 및 전환 검증 | [P01](../phases/2026-10-14-world02-playground-entrance/P01-entrance-and-background/phase.md) |

## Execution Order

1. T01은 컷신용 4장과 플레이 배경 3장을 제작한다. `assetManifest.json`에 필수 키를 등록해 Phaser preload와 기존 `ParallaxRenderer`가 월드 2 배경을 읽도록 한다. 신규 출력물의 크기·투명도·시인성과 플레이 화면의 실제 렌더링을 확인한다.
2. T02는 기존 `world-02-intro` 대본을 세 비트로 바꾸고 전용 Phaser 씬에서 자동 재생한다. 월드 1 클리어 버튼과 새 씬을 연결하고, 새 대사창 이미지 위에 React의 접근 가능한 한글 대사를 표시한다. 자동 완료·재시청 건너뛰기·재접속·월드 2 시작을 통합 확인한다.

## Existing Runtime Findings

- `World01StageClearScene.continueToNextStage()`가 현재 `StageScene`의 `world-02-stage-1`로 직접 이동한다. `PreloadScene.create()`는 월드 1 완료 후 월드 2 미완료 상태의 재접속에서 클리어 화면을 다시 연다.
- `src/game/data/cutscenes/worlds.ts`에 한 줄짜리 `world-02-intro` 대본은 있으나, 실제 `StageScene`은 월드 1 보스의 컷신만 재생한다. 따라서 이 데이터를 단순 수정하는 것으로는 진입 장면이 보이지 않는다.
- `WORLD_MAP_THEMES`는 이미 월드 2의 `world-02-background-far`, `world-02-background-mid`, `world-02-foreground` 키를 참조한다. 해당 PNG와 manifest 항목이 없어 현재는 단색 대체 화면이다.
- 월드 2의 Tiled 맵과 타일셋은 선택적 자리만 있고 실제 파일이 없다. 이번 계획은 배경과 진입 컷신을 완성하며 맵 지형/기믹 계획을 앞당겨 포함하지 않는다.

## Acceptance

- 월드 1 보스 승리 대사와 클리어 화면을 거쳐 다음 단계를 한 번 누르면 요청한 순서의 새 이미지 컷신이 나오고, 추가 입력 없이 월드 2 첫 스테이지가 시작된다.
- 첫 재생은 자동 완료되며 다시 들어왔을 때 건너뛰기와 정상 완료가 모두 월드 2에 한 번만 진입한다.
- 월드 2 플레이에서 새 먼 배경·중경·전경이 보이고, 검은 빈 화면/파일 로드 오류/캐릭터와 함정의 과한 가림이 없다.
- 기존 월드 1 보스 대사, 진행 저장, 다른 컷신, 모바일 화면의 대사 가독성을 유지한다.

## Progress

- done: 2/2 (active: none)
