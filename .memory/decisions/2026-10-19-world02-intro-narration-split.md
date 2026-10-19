# Decisions: 월드 2 인트로 내레이션 분리

- Date: 2026-10-19
- Status: Confirmed

## D01. 분리 지점과 길이
- **Chosen**: `corgi-nervous-narration`은 “녀석은 멈추지 않는다.”에서 끝내고, “녀석의 뇌리를...”부터 별도 비트로 둔다. 기존 8000ms는 두 비트에 4000ms씩 배분한다.
- **Rationale**: 사용자가 지정한 문장 경계이며 전체 자동 진행 길이를 보존한다.

## D02. 표정 전환
- **Chosen**: 새 내레이션 동안 긴장한 코기 이미지를 유지하고, `corgi-resolved-narration`에서 비장한 코기 이미지로 전환한다.
- **Rationale**: 현재 `World02EntranceScene.playBeat()`의 숫자 인덱스 4 조건은 비트가 하나 늘면 한 문장 일찍 전환된다. 비트 ID로 연결하면 대본의 순서가 바뀌어도 의도한 시점에 전환된다.
