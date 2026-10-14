# Plan: 월드 2 코기 위치 조정

## Goal

월드 2 컷신에서 긴장한·비장한 코기 모두 조금 내려 미끄럼틀 끝부분에 더 가깝게 보이도록 한다. 대사창과 앉은 정지 자세는 유지한다.

- [확정 결정](../decisions/2026-10-14-world02-corgi-position.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 두 코기의 공통 y좌표 조정과 검증 | [P01](../phases/2026-10-14-world02-corgi-position/P01-portrait-placement/phase.md) |

## Execution Order

1. T01에서 `World02EntranceScene.showPortrait()`의 데스크톱·작은 화면 y좌표만 조정한다.
2. 타입 검사와 코드 점검으로 두 이미지의 같은 위치 적용, 전신 노출, 대사창과의 간격을 확인한다.

## Progress

- done: 0/1 (active: T01)
