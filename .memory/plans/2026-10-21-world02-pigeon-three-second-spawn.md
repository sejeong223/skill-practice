# Plan: 월드 2 비둘기 등장 주기 3초

## Goal

월드 2 첫 스테이지에서 비둘기가 구간 진입 후 3초 간격으로 한 마리씩 등장한다.

## Decision

[결정 문서](../decisions/2026-10-21-world02-pigeon-three-second-spawn.md)에 따른다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 반복 등장 상수와 검증 조정 | [P01](../phases/2026-10-21-world02-pigeon-three-second-spawn/P01-spawn-interval/phase.md) |

## Task Order

1. T01: 반복 등장 간격을 3000ms로 변경하고 단위·실제 게임 검증을 갱신한다.
