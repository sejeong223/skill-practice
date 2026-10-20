# Plan: 월드 1 고양이 손 상자 열림

## Goal

월드 1의 `box-static` 7개가 코기의 가로 통과 순간 열린 상자와 고양이 손으로 바뀌고, 점프로 넘은 뒤에도 열린 모습을 유지한다. 열린 손의 접촉 사망과 기본 점프 회피를 실제 화면에서 검증한다.

## Decisions

- [확정 결정](../decisions/2026-10-20-world01-cat-box-open.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 참조 그림에 맞는 열린 상자 에셋과 통과 발동·검증 | [P01](../phases/2026-10-20-world01-cat-box-open/P01-box-open/phase.md) |

## Task Order

1. **T01**: 열린 상자와 고양이 앞발의 투명 픽셀 PNG를 만들고 필수 에셋으로 등록한다.
2. **T02**: 월드 1 `box-static`의 가로 통과 발동, 열린 상태 유지·복원, 열린 손 충돌, 점프 가능성을 구현·검증한다.

## Out of Scope

별도 `box-cat-arm` 함정의 동작 변경, 월드 1 맵 좌표 재배치, 월드 2 장애물 계획의 실행.
