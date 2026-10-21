# Plan: 월드 2 비둘기 등장과 고양이 점프 여유

## Goal

비둘기 등장을 1.5초 간격으로 만들고, 월드 2 첫 스테이지의 잠자는 고양이를 조금 줄여 기본 점프로 안정적으로 넘을 수 있게 한다.

## Confirmed Decisions

[결정 문서](../decisions/2026-10-21-world02-pigeon-arrival-cat-jump.md)에 따른다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 비둘기 등장 주기와 고양이 충돌 크기 | [P01](../phases/2026-10-21-world02-pigeon-arrival-cat-jump/P01-stage1-tuning/phase.md) |

## Task Order

1. **T01**: 비둘기를 한 마리씩 1.5초 간격으로 등장시키고 동시 비행 중 배설·사망·정지를 확인한다.
2. **T02**: 고양이 그림과 충돌 범위를 줄이고 실제 기본 점프 통과를 확인한다.
