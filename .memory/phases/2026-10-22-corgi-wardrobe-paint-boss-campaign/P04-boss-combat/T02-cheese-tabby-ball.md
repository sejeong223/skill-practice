# Task: T02 치즈 태비의 호루라기와 튕기는 고무공

## Status: done

## Goal

월드 2 보스 스테이지의 정지된 치즈 태비 이미지를 실제 HP15 전투로 연결하고, 호루라기로 예고한 고무공이 바닥에서 정확히 한 번 튀도록 만든다.

## Decision Summary

- 사용자 결정: 치즈 태비는 삐딱한 놀이터 대장/작은 호루라기, 공격은 한 번 튕기는 장난감 고무공, HP15/3초. 짖기로 잠시 멈춤.
- 코드 사실: `world-02-cheese-tabby-boss` 4프레임 그림은 이미 있고 `StageScene`에서 x1280,y446에 정지 표시만 한다. 별도 월드 2 맵 2·3 계획은 아직 미실행이다.

## Implementation

### I01. 고무공 픽셀·소리·패턴

- Related Files:
  - `scripts/generate-world02-boss-ball.mjs` :: 신규 결정적 SVG→PNG `--check` 생성기.
  - `public/assets/pixel/objects/world-02/cheese-tabby-rubber-ball.png` :: 신규 32×32 투명 픽셀 고무공.
  - `src/game/assets/assetManifest.json` :: `world-02-boss-rubber-ball` 필수 이미지 등록. 호루라기는 기존 효과음 키를 검토하고 없으면 짧은 신규 효과음과 오디오 매니페스트를 등록.
  - `src/game/systems/CheeseTabbyBallPattern.ts` :: `BossPattern` 구현.
  - `scripts/world02-boss-ball.test.mjs` :: 신규, 발사·한 번 튕김·경계·collision sweep 검증.
- **Signatures & Types**: `CheeseTabbyBallPattern(scene,player,bossSprite)`; 공 상태 `{id,x,y,vx,vy,bounces:0|1,ageMs,image}`. `telegraph(targetX,serial)`, `launch(targetX,serial)`, `update(deltaMs)`, `clear`, `destroy`.
- **Data & Schema Fields**: 예고 600ms, 공 출발은 고양이 쪽 x에서 플레이어 방향으로, 수평속도 약 330px/s, 초기 상향속도 약 -280px/s, 중력 약 900px/s². 바닥 y504에 첫 접촉할 때 vy≈-240px/s로 한 번만 튀고 다음 바닥 접촉에서 제거. 투사체 표시 32×32, 충돌 범위 24×24, 나이 상한 3000ms.
- **Execution Flow / Logic**: 호루라기 프레임과 화면 글씨 `고무공이 온다!`를 예고에 표시, 발사 후 풀어준다. 첫 바운스 이후에도 코기가 두 번째 높이를 읽고 피할 수 있게 24px 충돌체와 그림자/반짝임을 쓴다. 투사체는 `kind:"weak"`라 방패로 한 번 막을 수 있다. 화면 밖/재시작/승리/스턴 시 정리한다.
- **Error & State Transition**: 한 공이 한 피격으로 하트를 여러 번 빼지 않으며, 바닥 충돌에서 두 번 이상 튀지 않는다. 예고 중 메뉴를 열면 진행 시간이 정지한다.

### I02. 보스 스테이지·컷신·진행 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: W2 보스 생성에서 `BossEncounter`와 패턴 연결; `update`의 슬리퍼/도구/짖기/방패/하트 및 shutdown 연결.
  - `src/game/data/worlds.ts` :: W2 `BOSS_DEFINITIONS` 임시 패턴 문구를 고무공 설명으로 교체.
  - `src/game/data/cutscenes/worlds.ts` :: W2 보스 인트로/클리어가 치즈 태비와 호루라기/물기 해금 내용과 맞는지 수정.
  - `scripts/boss-stage-content.test.mjs` :: W2 보스 연결과 보상·다음 월드 ID 검증.
- **Execution Flow / Logic**: 인트로 컷신(이미 본 경우 짧은 재도전 안내) 후 `BossEncounter.start()`. HP0이면 컷신 동안 공격 정지, `SkillSystem.unlockAfterBoss("world-02-boss")`, `StageRuntime.complete()` 후 `world-03-stage-1`로 1회 이동. 월드 1 특수 해금 화면은 재사용하지 않는다. 사망은 현재 보스 스테이지에서 재도전한다.
- **Error & State Transition**: 컷신 완료 전에 전투가 시작되지 않는다. 월드 2 맵 2·3 미구현이어도 보스 스테이지 직접 진입으로 검증하며 그 맵을 이 Task에서 임의 수정하지 않는다.

## Acceptance Criteria

- [x] 치즈 태비를 슬리퍼 15회 또는 피해 단계에 맞는 적중으로 처치할 수 있다.
- [x] 고무공은 한 번만 튀고 예고/짖기/방패/일시정지/재도전이 정상 작동한다.
- [x] 승리 후 물기가 해금되고 월드 3 첫 스테이지로 이어진다.

## Validation

- `node scripts/generate-world02-boss-ball.mjs && node scripts/generate-world02-boss-ball.mjs --check` — 이미지 생성.
- `node --test scripts/world02-boss-ball.test.mjs scripts/boss-encounter.test.mjs scripts/boss-stage-content.test.mjs` — 전투.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 W2 보스 직접 시작→호루라기→한 번 바운스→사망/재도전→승리를 확인.

## Commit Message

```text
feat(월드2): 치즈 태비 호루라기와 튕기는 고무공 전투 구현

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T02-cheese-tabby-ball

- 고무공 예고 발사 1회 바운스와 방어를 연결
- 치즈 태비 승리 물기 해금과 월드 3 이동을 완성
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 이미지 결정성, 보스 테스트 12건, 에셋·타입·린트·빌드, Chrome 패턴·일시정지·짖기·사망 재시작·승리·해금 확인
- commit: 이 Task의 한국어 커밋
