# Plan: 개발 서버에서 월드2부터 시작

## Goal

개발 서버를 새로 열거나 새로고침하면 월드1 인트로와 월드2 입구 컷신을 건너뛰고 월드2 1스테이지 게임플레이에서 시작한다. 프로덕션의 기존 진입 동작은 유지한다.

## Confirmed Decisions

[결정서](../decisions/2026-10-26-dev-start-world02.md)를 따른다. 2026-10-21에 완료된 개발용 월드2 시작 정책을 복원하며, 사용자의 새 요청에 따라 개발 모드에서 첫 인트로를 반복하는 후속 변경을 대체한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 개발용 진행 상태와 월드2 게임플레이 바로 시작 및 배포 회귀 검사 | [P01](../phases/2026-10-26-dev-start-world02/P01-development-bootstrap/phase.md) |

## Out of Scope

저장 초기화, 월드2 후속 스테이지 변경, 프로덕션 기본 시작 화면 변경.
