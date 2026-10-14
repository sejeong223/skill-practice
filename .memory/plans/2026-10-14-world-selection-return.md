# Plan: 월드 선택으로 월드 1 재도전

## Goal

월드 1 보스 클리어 이후 플레이 HUD 오른쪽 위에 일시정지·초기화·월드 선택을 순서대로 표시한다. 월드 선택에서 월드 1 첫 스테이지 또는 월드 2 첫 스테이지로 이동하며, 저장된 선택 월드로 새로고침 후 복귀한다. 기존 클리어 보상과 자산은 보존한다.

## Decisions

- [확정 결정](../decisions/2026-10-14-world-selection-return.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 월드 선택 저장·전환·HUD/대화상자와 회귀 검증 | [P01](../phases/2026-10-14-world-selection-return/P01-world-navigation/phase.md) |

## Existing Worktree

- 이 계획을 시작할 때 `.memory`의 과거 월드 1 로드맵 수정 6개와 월드 2 모래 바닥 계획 문서가 이미 미커밋 상태였다. 현재 기능의 소스 변경과 커밋에는 포함하지 않는다.
