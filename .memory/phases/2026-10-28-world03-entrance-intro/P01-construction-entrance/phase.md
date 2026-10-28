# Phase: P01 월드 3 공사장 진입

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 확정 대본과 오후 공사장·코기 초상화 자산 등록 | [T01](./T01-script-and-pixel-art.md) |
| T02 | `done ✅` | 드릴·굴착기 합성 효과음과 오디오 재생 계약 | [T02](./T02-construction-audio.md) |
| T03 | `done ✅` | 전용 Phaser 인트로 장면과 React 자막·HUD 표시 | [T03](./T03-entrance-scene-and-overlay.md) |
| T04 | `in_progress 🔵` | 일반·개발 첫 진입 연결 및 통합 회귀 테스트 | [T04](./T04-entry-routing-and-regression.md) |

## Progress

- done: 3/4 (active: T04)

## Dependency Order

T01의 대본·그림과 T02의 오디오 키를 T03 장면에서 사용한다. T03의 장면이 등록된 뒤 T04에서 실제 진입 경로를 전환한다. 각 Task는 해당 파일에 명시된 검증을 통과한 뒤 커밋한다.
