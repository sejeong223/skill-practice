# Decisions: 개미 위쪽 투명 판정 제거

- Date: 2026-09-29
- Status: Confirmed from request and existing code; scope assumed as the ant's overhead trigger

## D01. 수정 대상
- **Chosen**: World 1의 두 `ant-trip` 기믹에 공통으로 적용되는 감지 영역을 개미 그림의 지상 부분에 맞춘다.
- **Rationale**: 개미 그림은 30×20px이고 중심이 바닥선에 있지만, 현재 감지 영역은 64×28px로 그림 위와 양옆까지 확장된다. 이 보이지 않는 영역이 개미를 점프로 넘는 수동 테스트를 방해한다.

## D02. 기존 함정 유지
- **Chosen**: 개미 그림과 실제로 겹칠 때의 `ant-trip` 결과와 별개의 `forward-jump-wall` 함정은 유지한다.
- **Rationale**: 요청한 개미 위쪽의 투명 판정만 줄이면 기존 월드 구성과 맵 파일을 바꾸지 않고 문제를 해결할 수 있다. 별개의 투명 벽 함정은 다른 좌표에 놓여 있다.

## D03. 검증
- **Chosen**: 코드 검사, 타입 검사, 월드 1 맵 일치 검사를 실행하고 개미 시각 영역과 감지 영역의 좌표를 대조한다.
- **Rationale**: 이 저장소에는 게임 플레이 자동 테스트가 없으므로 정적 검사와 기하 계산으로 회귀 위험을 확인한다.
