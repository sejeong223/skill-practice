# Task: T04 고물상 턱시도의 자석 고철

## Status: done

## Goal

월드 4 냥아치 아지트(고물상) 보스 턱시도를 그리고, 예고한 곳에 떨어진 고철이 자석에 끌려 한 번 더 이동하는 공격을 구현한다.

## Decision Summary

- 사용자 결정: 보스 이름 턱시도, 자석 고철의 낙하 후 재이동, HP25, 공격 주기 2.2초.
- 코드 사실: 월드 4 보스 이미지는 없고 `WORLD_MAP_THEMES`는 고물상 팔레트만 갖는다. P04 T01의 공통 하트/방패/스턴 계약을 사용한다.

## Implementation

### I01. 턱시도·고철·자석 픽셀 아트

- Related Files:
  - `scripts/generate-world04-boss.mjs` :: 신규 결정적 SVG→PNG `--check` 생성기.
  - `public/assets/pixel/characters/world-04/tuxedo-boss.png` :: 128×128×4 프레임(대기/자석 들기/피격/쓰러짐).
  - `public/assets/pixel/objects/world-04/magnet-scrap.png` :: 40×40 투명 고철 조각.
  - `public/assets/pixel/backgrounds/world-04/boss-scrapyard.png` :: 보스 아레나에서 실제 보이는 고물상 배경.
  - `src/game/assets/assetManifest.json` :: 세 에셋 필수 등록.
  - `scripts/world04-boss-magnet.test.mjs` :: 아트 파일·프레임·매니페스트 검사.
- **Signatures & Types**: 키 `world-04-tuxedo-boss`(128×128,4), `world-04-boss-magnet-scrap`, `world-04-boss-scrapyard`. 배경은 보스 스테이지에서 월드 4 공통 빈 색 레이어 앞/뒤에 배치하되 플레이어/투사체를 가리지 않는다.
- **Execution Flow / Logic**: 고양이는 검정 털/흰 턱시도 무늬와 단순 픽셀 눈, 자석을 들 때 명확한 팔 동작. 고철은 짙은 윤곽/한두 개 반짝임으로 보이며 사실적인 녹 텍스처를 피한다.
- **Error & State Transition**: 배경이 없을 때 투사체/보스가 보이지 않는 상태로 진행하지 않게 필수 등록 검사.

### I02. 고철의 두 단계 이동과 전투 연결

- Related Files:
  - `src/game/systems/TuxedoMagnetPattern.ts` :: `BossPattern` 구현.
  - `src/game/scenes/StageScene.ts` :: W4 보스 스프라이트/배경/패턴 생성, 짖기/방패/도구/씬 종료 연결.
  - `src/game/data/worlds.ts`, `src/game/data/cutscenes/worlds.ts` :: W4 보스 설명과 컷신.
  - `scripts/world04-boss-magnet.test.mjs` :: 낙하·재이동·예고·pause·재시작 검사.
- **Signatures & Types**: `{id,targetX,y,phase:"falling"|"drag-warning"|"dragging"|"done",dragDirection:-1|1,image,ageMs}`. `TuxedoMagnetPattern`이 `BossPattern`을 구현.
- **Data & Schema Fields**: 첫 낙하 targetX는 예고 시 플레이어 x 스냅샷, x는 아레나 160~1120 범위로 clamp. 예고 600ms; 낙하 600~800ms, 24×30px 충돌. 착지 후 250ms 동안 자석 방향 화살표와 소리 예고, 그다음 최대 110px를 450ms 동안 한 번 이동. 동시에 활성 고철 최대 2개.
- **Execution Flow / Logic**: `여기로 떨어진다!` 표식→낙하→자석 방향 표식→한 번 수평 이동. 낙하/이동 중 겹치면 1하트 피격, 약한 투사체로 방패 가능. 같은 고철은 여러 단계에 닿아도 900ms 무적을 존중한다. 이동이 끝난 고철은 제거하고 다음 공격을 위해 빈 공간을 확보한다.
- **Error & State Transition**: 목표가 플레이어/보스 바로 밑이라 회피 불가능하지 않도록 최소 600ms 표식과 이동 전 250ms 신호를 반드시 보여준다. 일시정지 중 두 타이머가 정지하며 짖기/죽음/승리 시 고철과 표식이 모두 제거된다.

### I03. 승리와 월드 5 이동

- Related Files:
  - `src/game/scenes/StageScene.ts` :: HP0→`world-04-boss-clear`→`unlockAfterBoss("world-04-boss")`→`runtime.complete()`→`world-05-stage-1`.
- **Error & State Transition**: 보스 패배 후 월드 4 보스 직접 재도전. 더블 점프는 해금/표시만 이 Task 범위이며 실제 이동 효과는 별도 계획으로 남는다.

## Acceptance Criteria

- [ ] 턱시도 HP25/2.2초와 고물상 배경이 실제 보인다.
- [ ] 고철은 예고 후 낙하하고 자석 신호 뒤 딱 한 번 움직인다.
- [ ] 기본 슬리퍼로 피하면서 처치할 공간이 있고, 승리 후 더블 점프 해금과 월드 5 이동이 된다.

## Validation

- `node scripts/generate-world04-boss.mjs && node scripts/generate-world04-boss.mjs --check` — 아트 생성.
- `node --test scripts/world04-boss-magnet.test.mjs scripts/boss-encounter.test.mjs` — 두 단계 궤도.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 예고를 보고 회피, 방패, 짖기, 사망 재도전, 승리 후 이동을 수동 확인.

## Commit Message

```text
feat(월드4): 턱시도 보스의 자석 고철 두 단계 공격 구현

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T04-tuxedo-magnet

- 고물상 턱시도와 고철 픽셀 아트를 제작
- 낙하 뒤 자석에 끌리는 공격과 더블 점프 보상을 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 픽셀 아트 결정성, 패턴·보스 테스트 7건, 타입·린트·빌드, Chrome 낙하·자석 신호·재이동·사망 재시작·슬리퍼 25회·더블 점프 해금·월드 5 전환
- commit: 이 Task의 한국어 커밋
