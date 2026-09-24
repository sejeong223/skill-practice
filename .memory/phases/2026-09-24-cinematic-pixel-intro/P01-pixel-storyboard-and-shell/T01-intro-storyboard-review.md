# Task: T01 픽셀 인트로 미리보기와 사용자 승인

## Status: done

## Goal

구현에 들어가기 전에 한 장의 픽셀 스토리보드로 집의 전체 동선과 네 핵심 장면을 보여주고, 사용자가 공간 배치와 비주얼을 직접 확인할 수 있게 한다.

## Decision Summary

- 장면은 입구·거실/탁자·열린 베란다·강아지 전용 문이 한 공간에 이어지는 옆면 집 내부다.
- 주인은 손·팔과 가장자리 실루엣만 보이며, 코기와 턱시도 고양이는 저장소의 승인된 참고 디자인을 따른다.
- 이 Task는 이미지 미리보기만 만든다. 명시적 사용자 승인 전에는 구현·제작용 에셋 생성으로 진행하지 않는다.

## Implementation

### I01. 스토리보드 이미지 생성

- Related Files:
  - public/assets/pixel/references/characters/corgi/corgi-reference-v2.png — 승인된 코기 디자인 참고; read-only
  - public/assets/pixel/references/characters/tuxedo-reference-v1.png — 승인된 턱시도 고양이 디자인 참고; read-only
  - public/assets/pixel/references/items/core-items-reference-v1.png — 픽셀 소품 스타일 참고; read-only
  - .memory/design-previews/2026-09-24-cinematic-pixel-intro-preview.png — 사용자 검수용 이미지; new

#### Details

- imagegen 스킬을 사용해 참고 에셋의 캐릭터 실루엣과 팔레트를 따르는 16:9 픽셀 아트 연락 시트 한 장을 만든다. 스킬 지침은 생성 전에 읽는다.
- 연락 시트에는 첫 칸에 집 전체 옆면 구도를 넓게 보여주고, 나머지 네 칸에 주인 입장, 왕갈비뼈 공개, 고양이 절도, 코기 탈출을 보여준다.
- 공간 배치: 입구와 강아지 문은 왼쪽, 거실 탁자와 코기는 중앙, 열린 베란다 창문은 오른쪽이다. 고양이는 창문으로 들어와 갈비뼈를 문 뒤 창문 쪽으로 도주한다. 코기는 주인 손/팔을 지나 강아지 문으로 달려간다.
- 집 장면은 밝은 낮의 자연광과 따뜻한 실내색을 사용하되 주황색 필터를 전체에 씌우지 않는다. 픽셀 외곽선과 제한 팔레트를 사용하고, 사실적 질감·부드러운 에어브러시·AI 광택 효과를 피한다.
- 미리보기 자체에는 생성형 한글 텍스트를 그리지 않는다. 대사·UI는 추후 실제 픽셀 폰트로 별도 렌더링한다.
- 생성 이미지를 채팅에 직접 표시한다. 사용자가 수정 요청하면 수정 후 다시 보여주고, 사용자 승인 전에는 이 Task를 완료 처리하지 않는다.

### I02. 승인 게이트

- Related Files:
  - .memory/current.md — 활성 포인터와 대기 상태 기록; modify
  - .memory/phases/2026-09-24-cinematic-pixel-intro/P01-pixel-storyboard-and-shell/phase.md — 승인 여부에 따른 진행 상태; modify

#### Details

- 사용자 응답이 명시적 승인일 때만 preview를 승인된 디자인으로 간주한다. 무응답 또는 수정 요청은 승인으로 취급하지 않는다.
- 승인 대기 동안 Active Task는 이 파일을 계속 가리키며, 구현 파일·assetManifest.json·PreloadScene은 변경하지 않는다.
- 승인 후 미리보기를 저장소에 포함하고 이 Task를 완료·커밋한 다음에만 T02로 이동한다.

## Acceptance Criteria

- [ ] 16:9 한 장에서 집 전체 레이아웃과 요청된 네 사건을 모두 확인할 수 있다.
- [ ] 코기와 고양이가 승인된 참고 에셋의 디자인을 따르고 주인은 손·팔/가장자리로만 표현된다.
- [ ] 미리보기가 채팅에 이미지로 표시되어 사용자가 승인하거나 구체적으로 수정 요청할 수 있다.
- [ ] 사용자 승인 전에는 제작용 코드·아트·포인터 전진이 없다.

## Validation

- 생성 이미지를 열어 장면 5칸, 좌우 동선, 캐릭터 참고 일치, 픽셀 외곽선을 직접 확인한다.
- 사용자에게 이미지를 표시하고 승인/수정 의사를 확인한다.

## Commit Message

    design(intro): 픽셀 시네마틱 인트로 미리보기 확정

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P01-pixel-storyboard-and-shell
    Task: T01-intro-storyboard-review

    - 집 전체 동선과 네 핵심 장면의 픽셀 미리보기 추가
    - 사용자 승인 디자인을 후속 에셋 제작의 기준으로 기록

## Progress

- [x] 이미지 생성·직접 표시
- [x] 사용자 승인 획득 — 2026-09-24, “이대로 계속 진행해줘.”
- [x] 승인 미리보기 저장 및 검증 — .memory/design-previews/2026-09-24-cinematic-pixel-intro-preview.png (1672×941 PNG, 1,774,145 bytes)
- commit: design(intro): 픽셀 시네마틱 인트로 미리보기 확정
