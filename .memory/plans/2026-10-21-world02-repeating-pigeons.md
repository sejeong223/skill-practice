# Plan: 월드 2 반복 비둘기 배설

## Goal

월드 2 첫 스테이지에서 비둘기를 2초마다 반복 생성하고, 각 비둘기가 비행 중 세 번 연속 배설하도록 한다. 낙하 예고·접촉 사망·일시정지·재시작은 기존 동작을 유지한다.

## Confirmed Decisions

[결정 문서](../decisions/2026-10-21-world02-repeating-pigeons.md)에 따른다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 반복 생성과 다중 낙하 수명주기 및 검증 | [P01](../phases/2026-10-21-world02-repeating-pigeons/P01-recurring-flights/phase.md) |

## Task Order

1. **T01**: 비둘기 시스템을 여러 비행·낙하물을 관리하도록 바꾸고 반복 타이머, 충돌, 정리, 회귀 테스트를 구현한다.

## Out of Scope

새 이미지, 월드 2 후속 스테이지, 월드 1 비둘기, 코인·저장 데이터.
