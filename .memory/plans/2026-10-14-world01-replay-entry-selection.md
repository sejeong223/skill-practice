# Plan: 월드 1 재도전 시작 지점 선택

## Goal

월드 선택 창에서 월드 1을 누르면 `처음부터`, 체크포인트 1, 체크포인트 2, 보스전을 세로로 표시한다. 선택한 시작 지점으로 실제 이동하고, 선택한 체크포인트 또는 보스 재도전 위치를 저장·복귀한다.

## Decisions

- [확정 결정](../decisions/2026-10-14-world01-replay-entry-selection.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 월드 1 지점 목록, Scene 이동, 저장 및 재도전 검증 (`dba6ff7`) | [P01](../phases/2026-10-14-world01-replay-entry-selection/P01-replay-entry/phase.md) |

## Existing Worktree

- 시작 시 `.memory`의 기존 월드 1 로드맵 수정 6개와 월드 2 모래 바닥 계획 문서가 미커밋이었다. 이번 기능 커밋에는 포함하지 않는다.
