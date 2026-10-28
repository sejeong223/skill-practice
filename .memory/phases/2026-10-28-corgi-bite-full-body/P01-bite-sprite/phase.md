# Phase: P01 코기 물기 전신 스프라이트

## Goal

물기 네 프레임을 전신 이미지로 교체하고, 코기 본체가 해당 텍스처만 표시하게 해 이중 얼굴을 없앤다. 의상과 장신구를 유지하고 전용 물기 효과음을 연결한다. 물리·전투 수치는 변경하지 않는다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 전신 물기 이미지 4프레임과 픽셀 계약 | [T01](./T01-full-body-bite-art.md) |
| T02 | `in_progress 🔵` | 상점 의상 5종과 직접 그린 의상 물기 이미지 | [T02](./T02-outfit-bite-art.md) |
| T03 | `pending` | 의상 시트 연결, 본체 텍스처 전환, 중단·복귀 검증 | [T03](./T03-single-actor-bite-presentation.md) |
| T04 | `pending` | 전용 물기 효과음과 재생·일시정지 회귀 | [T04](./T04-dedicated-bite-audio.md) |

## Progress

- done: 1/4 (active: T02)

## Shared constraints

- `corgi-bite` 키, 112×128×4 규격, 80ms 프레임, 320ms 연출, E키·6초 쿨타임·보스 HP 2 감소를 유지한다.
- 플레이어의 `Arcade.Body` 72×40 크기와 offset, 발 기준선, `flipX`, 재시도·컷신 정리를 유지한다.
- 상점 의상 5종, 직접 그린 의상, 별도 액세서리·무기·방패 레이어를 함께 확인한다.
- 의상 머리까지 그린 run 시트가 있으므로 기본 물기와 의상 run의 단순 픽셀 diff 합성은 사용하지 않는다.
- `bite-hit`는 현재 스킬 승인 직후 발생하므로 전용 효과음만 매핑하고 전투 이벤트 발행·피해 판정을 바꾸지 않는다.
- 기존 미커밋 보스·UI 작업을 보존하고 Task별 변경만 스테이징한다.
