# Task: T03 공사장 고등어와 남는 벽돌 조각

## Status: done

## Goal

월드 3 공사장 보스 고등어를 픽셀 스타일로 만들고, 날아온 뒤 잠깐 바닥을 막는 벽돌 조각 공격을 실제 전투에 연결한다.

## Decision Summary

- 사용자 결정: 보스 이름 고등어, 벽돌 조각 공격, HP20, 공격 주기 2.6초. 날아온 벽돌은 바닥에 잠시 남아 이동을 막는다.
- 코드 사실: 월드 3 보스는 현재 일반 placeholder 정의와 빈 아트만 있으며 `StageScene`은 보스 시스템을 만들지 않는다. 공통 `BossEncounter`와 착용/방패 로직은 P04 T01에서 준비한다.

## Implementation

### I01. 고등어 보스·벽돌 아트와 에셋

- Related Files:
  - `scripts/generate-world03-boss.mjs` :: 신규 결정적 SVG→PNG `--check` 생성기.
  - `public/assets/pixel/characters/world-03/mackerel-boss.png` :: 신규 128×128×4프레임 시트: 대기/던지기/피격/쓰러짐.
  - `public/assets/pixel/objects/world-03/mackerel-brick.png` :: 신규 32×32 투명 벽돌 조각.
  - `src/game/assets/assetManifest.json` :: 보스 spritesheet/벽돌 필수 등록.
  - `scripts/world03-boss-bricks.test.mjs` :: 신규 이미지 크기·프레임/투명도 확인.
- **Signatures & Types**: 에셋 키 `world-03-mackerel-boss`(frameWidth=128,frameHeight=128,frameCount=4), `world-03-boss-brick` image.
- **Execution Flow / Logic**: 기존 삼색이·치즈 태비처럼 짙은 픽셀 윤곽, 단순 눈, 과장된 어깨/꼬리. 고등어 줄무늬가 명확해야 하며 실사 털 질감은 사용하지 않는다. 작은 공사장 안전모/벽돌 흔적은 주제를 드러내되 얼굴을 가리지 않는다. 벽돌은 낙하 중과 바닥에 남은 상태가 같은 물체임을 알아볼 수 있게 한다.
- **Error & State Transition**: 스프라이트 크기/키가 다르면 매니페스트 검사 실패. 없는 타일맵을 전제로 아트를 로드하지 않는다.

### I02. 날아옴→바닥 잔류→제거 패턴

- Related Files:
  - `src/game/systems/MackerelBrickPattern.ts` :: `BossPattern` 구현.
  - `src/game/scenes/StageScene.ts` :: W3 보스 생성·공통 전투 연결·시작/재시작/정리.
  - `src/game/data/worlds.ts`, `src/game/data/cutscenes/worlds.ts` :: W3 보스 패턴/컷신 설명 갱신.
  - `scripts/world03-boss-bricks.test.mjs` :: 착지 전 피격·착지 후 발판/장벽·만료·pause 검증.
- **Signatures & Types**: 벽돌 상태 `{id,x,y,vx,vy,phase:"flying"|"landed",ageMs,image,body}`. `MackerelBrickPattern`은 공통 `BossPattern` 메서드를 구현한다.
- **Data & Schema Fields**: 예고 600ms; 벽돌은 보스에서 플레이어의 발사 시점 x를 향해 300~370px/s로 날아와 y504 바닥에 착지. 날아갈 때 28×24px 충돌, 착지 후 32×28px 고정 충돌 장벽; 잔류 1400ms; 동시에 남는 벽돌 최대 2개. 보스 x1280 주변 160px와 시작점 120px에는 착지 위치 clamp로 벽돌이 생기지 않게 한다.
- **Execution Flow / Logic**: `벽돌 조각!`과 낙하 지점을 예고한다. 비행 중 플레이어 접촉은 1하트 피격/방패 가능한 `weak` 공격; 착지한 조각은 살상 판정 대신 이동을 막는 static body로 전환해 점프로 넘게 한다. 타이머 종료/짖기/죽음/승리에는 바디와 이미지를 함께 지운다.
- **Error & State Transition**: 착지 프레임의 비행 피격과 고정 충돌이 같은 틱에 중복 적용되지 않게 phase 전환을 한 번만 처리한다. 벽돌이 코기와 겹치며 static body로 생성되지 않도록 착지 위치를 이동시키거나 겹침 해소한다.

### I03. 보상과 다음 지역

- Related Files:
  - `src/game/scenes/StageScene.ts` :: W3 HP0→공격 정지→`world-03-boss-clear`→`unlockAfterBoss("world-03-boss")`→`runtime.complete()`→월드 4 첫 스테이지 1회 전환.
- **Error & State Transition**: 죽으면 W3 보스부터 다시 시작하며 중복 해금/중복 컷신을 막는다. 대시의 실제 이동 효과 구현은 이 결정 범위 밖이지만 스킬 획득 상태와 UI 표시는 갱신한다.

## Acceptance Criteria

- [ ] 고등어 그림이 기존 게임 픽셀 스타일이며 이름·HP20·2.6초 주기가 보인다.
- [ ] 벽돌은 날아와 한 번 착지한 뒤 1.4초 동안 이동을 막고 사라진다.
- [ ] 슬리퍼로도 접근·공격 가능하며 승리하면 대시 해금 후 월드 4로 간다.

## Validation

- `node scripts/generate-world03-boss.mjs && node scripts/generate-world03-boss.mjs --check` — 아트 생성.
- `node --test scripts/world03-boss-bricks.test.mjs scripts/boss-encounter.test.mjs` — 패턴/재시작.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 슬리퍼 장착으로 벽돌 회피·잔류 뛰어넘기·20회 명중·사망 재도전 확인.

## Commit Message

```text
feat(월드3): 고등어 보스와 잔류 벽돌 공격 구현

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T03-mackerel-bricks

- 공사장 고등어의 픽셀 스프라이트와 벽돌을 제작
- 벽돌 비행 착지 장벽 및 대시 보상 전환을 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 고등어 에셋 결정성, 보스 테스트 7건, 타입·빌드, Chrome 벽돌 착지·1.4초 잔류·슬리퍼 20회·사망 재시작·대시 해금·월드 4 전환
- commit: 이 Task의 한국어 커밋
