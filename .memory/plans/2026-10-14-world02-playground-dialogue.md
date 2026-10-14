# Plan: 월드 2 놀이터 진입 대본 교체

## Goal

월드 1 클리어 뒤 나오는 기존 월드 2 진입 컷신의 세 이미지를 유지하면서, 사용자가 제공한 나레이션·코기 대사 여섯 문장을 지정한 이미지에 순서대로 표시한다. 마지막 문장 뒤 자동으로 `world-02-stage-1`에 진입한다.

- [확정 대본과 장면 배치](../decisions/2026-10-14-world02-playground-dialogue.md)
- 기존 완료 계획 [월드 2 놀이터 진입 연출과 플레이 배경](./2026-10-14-world02-playground-entrance.md)의 새 PNG 7장, `world-02-intro` 저장 ID, 첫 관람/재관람 정책을 유지한다.
- 이번 계획에서는 이미지 생성, 배경/맵/기믹 변경을 하지 않는다. 원고와 대사 표시·자동 진행만 조정한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 6문장 대본, 3장 이미지 전환, 긴 대사창과 자동 진행 검증 | [P01](../phases/2026-10-14-world02-playground-dialogue/P01-entrance-dialogue/phase.md) |

## Execution Order

1. T01에서 `WORLD02_ENTRANCE_CUTSCENE`을 여섯 비트로 교체한다. `World02EntranceScene.playBeat`은 0·1번 놀이터, 2·3번 당황한 얼굴, 4·5번 비장한 얼굴로 묶어 이미지는 세 번만 전환하고 문장마다 `cutscene-beat`를 보낸다.
2. T01에서 기존 대사창 PNG와 DOM 텍스트를 모두 유지하면서 긴 나레이션의 줄바꿈·프레임 높이를 조정한다. 데스크톱/좁은 화면, 첫 관람 자동 완료·건너뛰기 제한, 재관람 건너뛰기·재접속 저장을 확인한다.

## Existing Runtime Findings

- 현 대본은 3비트이고 첫 두 비트가 텍스트 없이 지나간다. `World02EntranceScene.playBeat()`은 비트 인덱스 1·2를 얼굴 이미지 선택에 직접 사용하며, `cutscene-beat`도 마지막 비트에서만 발행한다. 여섯 문장만 추가하면 이미지/화자가 잘못 배치되므로 같은 Task에서 씬 매핑을 바꿔야 한다.
- `CutsceneOverlay`는 `beat.narration`을 `NarratorText`, `beat.dialogue`를 `DialogueBox`로 그리며 `TypewriterText`는 `durationMs`의 80% 동안 글자를 드러낸다. 새 컴포넌트나 저장 스키마는 필요 없다.
- 현재 월드 2 프레임 CSS는 한 줄 대사를 기준으로 이미지 배경을 `100% auto`로 맞춘다. 77자 나레이션이 좁은 화면에서 4줄로 늘어나므로 프레임 높이와 배경 크기를 검증해야 한다.

## Acceptance

- 제공한 6문장이 띄어쓰기·문장부호·대괄호를 포함해 정확한 순서로 표시되고, 화자 `나레이션`/`코기`가 맞다.
- 놀이터 전경 2문장 → 당황한 얼굴 2문장 → 비장한 얼굴 2문장으로 재생되며 중간 문장에서 이미지가 새로 번쩍이거나 카메라가 되돌아가지 않는다.
- 첫 관람은 읽을 시간 후 자동 완료되며 ESC로 전체 건너뛰지 못한다. 재관람은 건너뛰기 가능하고 완료/건너뛰기 모두 월드 2 첫 스테이지에 한 번 진입한다.
- 긴 문장이 데스크톱과 좁은 화면에서 대사창 밖으로 잘리거나 게임 HUD에 가려지지 않는다. 다른 컷신과 저장 데이터는 유지된다.

## Progress

- done: 0/1 (active: P01-T01)
