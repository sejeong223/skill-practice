# Task: T05 메인쿤의 생쥐 난사·털뭉치·엔딩

## Status: pending

## Goal

월드 5 최종 보스 메인쿤을 그리고, 코기를 계속 겨냥하는 불규칙 생쥐와 별도로 떨어지는 털뭉치를 갖춘 HP40 전투 및 기존 엔딩을 완성한다.

## Decision Summary

- 사용자 결정: 메인쿤은 HP40, 생쥐 공격 기본 주기 1.5초. 생쥐는 코기를 지속 타게팅하며 매번 회전·직선·고속 등 예측 어려운 궤도로 난사한다. 털뭉치는 하늘에서 계속 떨어진다. 기본 슬리퍼로도 클리어 가능해야 한다.
- 코드 사실: `ending-homecoming` 컷신 데이터는 있지만 실행 경로가 없고 W5 보스는 placeholder다. 월드 5 이후 `getNextStageId`는 null이다.

## Implementation

### I01. 최종 보스와 공격 물체 픽셀 아트

- Related Files:
  - `scripts/generate-world05-boss.mjs` :: 신규 결정적 SVG→PNG `--check` 생성기.
  - `public/assets/pixel/characters/world-05/maine-coon-boss.png` :: 160×160×4프레임 대기/생쥐 투척/피격/쓰러짐.
  - `public/assets/pixel/objects/world-05/{homing-mouse,falling-furball}.png` :: 각각 32×24, 28×28 투명 픽셀 물체.
  - `public/assets/pixel/backgrounds/world-05/boss-cat-tower.png` :: 실제 최종 보스 아레나 배경.
  - `src/game/assets/assetManifest.json` :: 위 네 파일 필수 등록.
  - `scripts/world05-boss-projectiles.test.mjs` :: 이미지 크기/프레임/등록 검증.
- **Signatures & Types**: 에셋 키 `world-05-maine-coon-boss`(frameWidth=160,frameHeight=160,frameCount=4), `world-05-boss-mouse`, `world-05-boss-furball`, `world-05-boss-cat-tower`.
- **Execution Flow / Logic**: 메인쿤의 큰 귀·갈기·꼬리는 단순 픽셀 덩어리로 표현하고 표정은 단순 눈/입으로 읽히게 한다. 생쥐와 털뭉치는 서로 확실히 다른 실루엣과 색상. 배경은 보스와 공격 궤적을 가리지 않게 대비를 낮춘다.
- **Error & State Transition**: 아트 프레임이 부족하거나 필수 에셋이 누락되면 검증 실패.

### I02. 추적 생쥐와 별도 털뭉치 타이머

- Related Files:
  - `src/game/systems/MaineCoonPattern.ts` :: `BossPattern` 구현. 생쥐 궤적 선택과 털뭉치 루프를 포함.
  - `src/game/systems/maineCoonTrajectory.ts` :: 신규 순수 함수 궤도 샘플러.
  - `scripts/world05-boss-projectiles.test.mjs` :: 3궤도, 지속 타겟팅, cap, pause, 안전 시간 검증.
- **Signatures & Types**:
  - `type MouseTrajectoryKind="curve"|"straight"|"fast"`.
  - `interface MouseState { id:string; kind:MouseTrajectoryKind; x:number;y:number;vx:number;vy:number;ageMs:number;turnSeed:number;image:Phaser.GameObjects.Image }`.
  - `sampleMouseStep(mouse:MouseState,target:{x:number;y:number},deltaMs:number):{x:number;y:number;vx:number;vy:number}`.
  - `interface FurballState {id:string;x:number;y:number;vy:number;warningMs:number;image:Phaser.GameObjects.Image}`.
- **Data & Schema Fields**: 생쥐 1.5초마다 한 salvo에서 2마리, 180ms 간격; 예고 450ms. 활성 생쥐 최대 4, 수명 2200ms. 궤도 종류는 `StageRandom` seed와 salvo 순번으로 3종이 반복되지 않게 선택; 직선 300px/s, 곡선 260px/s와 좌우 최대 70px 편향, 고속 420px/s. 매 업데이트 코기 현재 중심을 향해 방향을 보정하되 회전속도 상한과 180px 최소 회피 구간을 둔다. 털뭉치는 독립적으로 1200ms마다 1개, 낙하 전 바닥 위치 450ms 예고, 활성 최대 3, 중력/낙하 약 300px/s. 각 충돌체는 이미지보다 작은 생쥐 22×16px, 털뭉치 20×20px.
- **Execution Flow / Logic**: 매 공격 사이에 코기가 보스에게 접근할 500ms 이상 빈 발사 구간을 유지한다. 생쥐는 코기를 계속 겨냥하지만 코기를 지나친 뒤 뒤돌아와 다시 때리지 않고 아레나 밖/수명 만료로 제거. 털뭉치는 생쥐와 별도 타이머로 계속 생성된다. 각 투사체는 방패의 `weak` 공격으로 처리하고 한 ID당 피격/막기 한 번. 짖기 중에는 진행 중 두 종류를 지우고 두 스폰 타이머를 정지, 재개 후 안전 여유를 준다.
- **Error & State Transition**: `Math.min(delta,50)`으로 긴 프레임 뒤 순간 다량 발사 방지. 플레이어가 보스 바로 앞에 있거나 화면 모서리에 있어도 털뭉치 경고 위치와 생쥐 회피 공간이 겹쳐 즉사 불가능한 패턴을 만들지 않도록 안전 거리 검사를 둔다. 포인터/타이머/텍스처는 사망·승리·씬 종료에 모두 정리한다.

### I03. 보스 승리·스킬 보상·엔딩

- Related Files:
  - `src/game/scenes/StageScene.ts` :: W5 전투 생성, HP0→`world-05-boss-clear`→`unlockAfterBoss("world-05-boss")`→`runtime.complete()`→`ending-homecoming`을 `CutsceneDirector`로 재생.
  - `src/components/game/GameShell.tsx` :: 엔딩 완료 이벤트 수신/종료 UI 모드.
  - `src/components/game/EndingOverlay.tsx` :: 신규 최종 카드, `처음부터 다시 보기` 또는 월드 1 재선택의 기존 지원 경로로 이동 버튼.
  - `src/game/stages/stageEvents.ts` :: `"ending-finished":{cutsceneId:"ending-homecoming"}`.
  - `src/game/data/worlds.ts`, `src/game/data/cutscenes/worlds.ts` :: W5 임시 보스 설명/이름 갱신.
- **Execution Flow / Logic**: 승리 컷신과 엔딩은 한 번씩만 시작한다. 컷신 스킵 허용은 기존 `seenCutsceneIds` 규칙 사용. `runtime.complete()`로 클리어/보상을 저장하고 다음 stage가 null인 경우 엔딩을 요청한다. 엔딩 후에는 게임이 멈춘 채 최종 카드를 보이고 명시 버튼으로 재진입한다.
- **Error & State Transition**: 엔딩 재생 중 플레이어 입력·보스 공격·사망을 차단한다. 씬 전환/언마운트 시 남은 타이머를 정리한다. `tail-rotor`는 해금/표시되고 실제 비행 효과는 별도 기능 범위다.

## Acceptance Criteria

- [ ] 생쥐가 지속적으로 코기를 겨냥하면서 곡선·직선·고속 3종 궤도가 보인다.
- [ ] 털뭉치는 독립적으로 계속 떨어지고 예고를 보고 피할 수 있다.
- [ ] HP40 기본 슬리퍼로 실제 처치 가능하며 승리 후 꼬리 모터 해금·기존 엔딩·최종 카드가 한 번씩 나온다.

## Validation

- `node scripts/generate-world05-boss.mjs && node scripts/generate-world05-boss.mjs --check` — 아트 생성.
- `node --test scripts/world05-boss-projectiles.test.mjs scripts/boss-encounter.test.mjs scripts/boss-stage-content.test.mjs` — 궤도·전환.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 슬리퍼만으로 긴 전투→피격/방패/짖기/일시정지→승리→엔딩을 직접 확인.

## Commit Message

```text
feat(최종보스): 메인쿤 생쥐 난사와 털뭉치 엔딩 구현

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P04-boss-combat
Task: T05-maine-coon-finale

- 메인쿤과 세 궤도 생쥐 및 별도 털뭉치 패턴을 제작
- 최종 승리 꼬리 모터 해금과 엔딩 컷신을 연결
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
