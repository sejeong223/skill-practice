# Phase: P02 실제 집 시네마틱 장면

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done | 승인된 스토리보드를 바탕으로 실내·배우·소품 픽셀 에셋을 제작하고 등록한다. | [T01](./T01-intro-pixel-assets.md) |
| T02 | done | 전용 IntroScene에서 11개 배우 동작과 컷신 카메라를 타임라인에 맞춰 재생한다. | [T02](./T02-intro-scene-and-actor-animation.md) |
| T03 | done | 픽셀 대사창·타이프라이터·칩튠·타이틀/이름 입력 흐름을 연결한다. | [T03](./T03-pixel-dialogue-audio-and-gate.md) |
| T04 | in_progress | 처음/재시청, 화면비, 월드 진입과 캠페인 회귀를 통합 검증한다. | [T04](./T04-intro-integration-validation.md) |

## Progress

- done: 3/4 (active: T04 — 인트로 통합 검증)

## Completion gate

모든 비트가 승인된 장소 배치와 기존 대사 순서대로 재생되고, 인트로가 끝난 뒤 이름 입력 확인으로 World 1에 들어가야 한다. 다른 화면비에서 프레임을 왜곡하지 않아야 하며, 자동 검증만으로 사용자의 장면 검수를 대체하지 않는다.
