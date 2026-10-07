# Plan: 컷신 대사 자동 진행

## Goal

오프닝과 모든 월드·보스·엔딩 컷신의 나레이션 및 대사가 문장 길이에 맞는 시간 후 자동으로 다음 문장과 장면으로 넘어간다. Enter 입력 없이 마지막 컷신 종료까지 도달하고, 기존 빠른 넘김·재시청 건너뛰기·이름 입력·스테이지 선택 흐름은 계속 동작한다.

## Decisions

[2026-10-06 컷신 대사 자동 진행 결정](../decisions/2026-10-06-cutscene-auto-advance.md). 기존 인트로의 35~40초 목표보다 문장 가독성을 우선한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 공용 재생 시간과 타임라인, 오프닝 문장 타이머, 대화창 안내와 전체 검증 | [P01](../phases/2026-10-06-cutscene-auto-advance/P01-cutscene-playback/phase.md) |

## Execution Order

T01은 글자 수 기반 표시 시간과 공용 컷신 타임라인을 연결한다. T02는 오프닝의 각 나레이션·대사에 타이머를 붙인다. T03은 자동 진행에 맞게 대화창의 안내를 바꾸고 전체 흐름을 검증한다. 각 Task는 검증 후 청사진의 메시지로 따로 커밋한다.

## Completion Conditions

- 첫 오프닝 재생에서 나레이션과 대사가 순서대로 자동 진행해 타이틀/이름 입력 화면에 도달한다.
- 월드 1 보스 등장 8줄 뒤 전투가 시작되고, 승리 8줄 뒤 `[STAGE CLEAR!]` 화면이 열린다. 문장 진행에 Enter는 필요 없다.
- 이미 자동 진행 중인 다른 월드·엔딩 컷신도 글자 수에 따른 표시 시간을 사용하고 끝까지 완료된다.
- 클릭·Space·Enter의 빠른 넘김과 재시청 건너뛰기가 타이머와 중복 전환을 만들지 않는다.
- 이름 입력과 `NEXT STAGE ->`는 사용자의 선택을 기다린다. 타입 검사, 린트, 빌드, 시간/타임라인 테스트와 실제 화면 검증이 통과한다.

## Existing Work Pointer

이 계획을 시작하기 전 `.memory/current.md`는 [월드 1 짧은 경로 P01-T01](../phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/T01-compact-normal-maps.md)을 가리켰다. 해당 Task의 `pending` 상태와 기존 미커밋 문서는 그대로 두고 현재 포인터만 이 계획의 T01로 전환한다. 필요하면 이전 청사진에서 재개한다.
