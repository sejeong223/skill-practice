# Task: T01 픽셀 렌더링·카메라·타격감·에셋·성능 폴리시

## Status: pending

## Goal

25개 스테이지 전체에 픽셀 아트풍 렌더링 규칙, 카메라 연출, 타격감, 입자 효과, 오디오 레이어, 에셋 로딩 최적화를 적용해 기능성 프로토타입을 실제 게임처럼 느껴지는 결과물로 끌어올린다.

## Decision Summary

- 생성형 에셋은 스타일 가이드와 기준 시트에 맞게 정리하고, Phaser Graphics는 효과·파티클·간단한 충돌 시각화에만 사용한다.
- 억까는 강하게 유지하되, 입력·카메라·피격·재시작의 피드백은 빠르고 읽기 쉬워야 한다.

## Implementation

### I01. 픽셀 렌더링과 texture 관리

- Related Files:
  - src/game/config.ts :: pixel render options — modify
  - src/game/assets/TextureRegistry.ts :: TextureRegistry — new
  - src/game/scenes/PreloadScene.ts :: atlas loading — modify
  - src/app/globals.css :: canvas image rendering — modify

#### Details

- pixelArt: true, roundPixels: true, integer display scale를 전체 게임에서 유지한다.
- 정적 Graphics는 texture로 bake하고, 매 프레임 다시 그리는 Graphics는 파티클·짧은 효과로 제한한다.
- world별 background layers는 far, mid, near, foreground 순서와 scrollFactor를 사용한다.
- manifest에서 사용하지 않는 월드 에셋을 stage마다 unload하지 않고, world transition에서만 group 단위로 정리한다.

### I02. game feel

- Related Files:
  - src/game/feedback/ScreenEffects.ts :: ScreenEffects — new
  - src/game/feedback/HitFeedback.ts :: HitFeedback — new
  - src/game/feedback/DeathFeedback.ts :: DeathFeedback — new
  - src/game/systems/CombatSystem.ts :: feedback hooks — modify

#### Details

- slipper-hit은 60~90ms hitstop, 짧은 scale punch, pixel spark, 낮은 타격음으로 구성한다.
- sneeze drawback은 화면 방향 반대 knockback, 에취! 텍스트, 솜먼지 particle, 짧은 카메라 shake로 명확히 전달한다.
- bowl clang은 강한 metal sound와 화면의 1-frame flash를 사용하지만, 화면 전체를 가려 플랫폼 판독을 방해하지 않는다.
- death는 hit freeze → cartoon silhouette/털 폭발 → restart transition 순서로 250ms 이내에 끝난다.

### I03. 성능·로딩 검증

- Related Files:
  - scripts/validate-assets.mjs :: performance checks — modify
  - docs/performance-budget.md :: budget — new

#### Details

- 첫 화면의 필수 asset payload, world transition payload, audio payload를 구분해 기록한다.
- 60fps 기준에서 한 화면의 dynamic Graphics object 수와 particle 수를 제한한다.
- 생성형 원본 이미지는 public에 직접 넣지 않고, 게임용으로 축소·압축·프레임 정렬한 출력만 넣는다.

## Acceptance Criteria

- [ ] 모든 캐릭터·배경·UI가 픽셀 그리드와 정수 배율을 지킨다.
- [ ] 월드별 패럴랙스와 카메라 shake가 스프라이트를 흐리게 만들지 않는다.
- [ ] 슬리퍼·밥그릇·사망 효과의 타격감과 부작용이 화면/음향으로 분명하다.
- [ ] 개발자 도구 성능 측정에서 일반 구간 60fps를 목표로 유지한다.
- [ ] 생성형 원본과 런타임 최적화 에셋이 분리되어 있다.

## Validation

- npm run lint — polish/asset utilities 타입 통과
- npm run build — 최적화된 asset manifest build 통과
- npm run dev — 각 월드 대표 스테이지에서 pixel snap, camera, hitstop, particle 확인
- 브라우저 Performance 패널 — 일반 구간과 보스 구간 frame time 기록

## Commit Message

~~~text
perf(polish): tune pixel rendering camera feedback and asset loading

Plan: 2026-09-21-legendary-rib-corgi
Phase: P05-polish-verification
Task: T01-polish-performance

- Apply pixel-perfect rendering and layered world backgrounds
- Add hit feedback, death feedback and asset performance budgets
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
