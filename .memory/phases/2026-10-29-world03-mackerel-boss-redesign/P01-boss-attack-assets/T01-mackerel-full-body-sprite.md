# Task: T01 고등어 태비 전신 8자세

## Status: done

## Goal

월드 3 고등어 태비의 실제 전신 픽셀 그림을 새로 만들고 112×112 프레임 8개로 등록한다. 치즈보다 성숙하고 턱시도보다 작은 몸, 세 공격의 서로 다른 자세, 보이는 몸에 맞는 타격 판정을 게임에서 확인할 수 있게 한다.

## Decision Summary

- 사용자 선택: 짙은 외곽선·평면 픽셀 색면, 회청색 줄무늬, 넓은 어깨·긴 다리·반쯤 뜬 눈, 노란 안전모·짧은 조끼. 프레임 112×112, 몸 약 100×80. 기존 도형에 머리나 옷만 덧붙이지 않고 프레임마다 몸통·다리·앞발을 새로 그린다.
- 단계 경계: 0 대기, 1 벽돌 준비, 2 벽돌 발사, 3 쓰러짐은 기존 인덱스로 유지한다. 4 시멘트 파도 준비, 5 파도 발사, 6 시멘트 덩어리 준비, 7 덩어리 발사를 추가한다. 이 Task에서는 새 공격 로직을 연결하지 않는다.

## Implementation

### I01. 원본 래스터와 게임용 시트

- Related Files:
  - `art/source/world03-mackerel-boss-poses.png` :: 전신 원본 8자세 — new
  - `scripts/generate-world03-boss.mjs` :: 기존 SVG 도형 생성 대신 원본 PNG를 결정적으로 검증·복사하고 벽돌 이미지는 보존 — modify
  - `public/assets/pixel/characters/world-03/mackerel-boss.png` :: 896×112 RGBA 시트 — modify
  - `public/assets/pixel/objects/world-03/mackerel-brick.png` :: 기존 32×32 벽돌 — read-only
  - `src/game/assets/assetManifest.json` :: `world-03-mackerel-boss` 프레임 메타데이터 — modify

#### Details

- **Signatures & Types**:
  ```text
  MACKEREL_FRAME: idle=0, brickWindup=1, brickRelease=2, collapsed=3,
                  waveWindup=4, waveRelease=5, lumpWindup=6, lumpRelease=7
  world-03-mackerel-boss: spritesheet, frameWidth=112, frameHeight=112,
                          frameCount=8, required=true, worldId=world-03
  ```
- **Data & Schema Fields**: 원본·출력 모두 896×112 RGBA. 각 프레임은 x=`index×112`부터 112px, 배경 알파 0, 발바닥 기준 행 약 105. 대기·준비·발사 7자세의 가시 외곽은 112px 안에 들어가고 서 있는 몸 전체는 약 100×80px. 쓰러짐은 같은 지면에 닿는다.
- **Execution Flow / Logic**:
  1. Precondition: 실제 `calico-boss.png`, `cheese-tabby-boss.png`, `tuxedo-boss.png`와 코기 에셋을 옆에 놓고 실게임 크기와 픽셀 밀도를 확인한다. 이미지 제작 도구로 독립 원본을 그린 뒤 픽셀 경계·표정·장비 위치를 직접 정리한다.
  2. Core: 여덟 전신 자세에서 머리·몸통·다리·꼬리·안전모·조끼가 함께 움직이도록 한다. 1/2는 벽돌, 4/5는 낮게 미는 흙손, 6/7은 높게 떠올리는 흙손으로 한 프레임만 보고 구별되게 한다. 3은 눈을 감고 무너진 전신이다. 둥근 벡터 테두리·그라데이션·눈 안광을 사용하지 않는다.
  3. Error handling: 생성 스크립트 `--check`는 원본 누락·크기/투명도 불일치·출력 불일치 시 실패한다. 기존 벽돌 PNG는 byte 단위로 변하지 않아야 한다.
  4. State/return: manifest가 8프레임을 필수로 로드한다. 0~3 인덱스를 보존해 아직 기존 벽돌 패턴인 중간 상태에서도 공격·쓰러짐 그림이 맞는다.

### I02. 보스 발 위치·타격·이름 정렬

- Related Files:
  - `src/game/scenes/StageScene.ts` :: 월드 3 `laterBossSprite` 생성 좌표 — modify
  - `src/game/systems/BossEncounter.ts` :: `getHitBounds`, 체력/이름 높이의 월드 3 분기 — modify
  - `src/game/data/bossCombat.ts` :: 월드 3 표시 이름 `고등어 태비` — modify
  - `scripts/world03-boss-bricks.test.mjs` :: 8프레임 메타데이터·기존 벽돌 검증 — modify
  - `scripts/world03-mackerel-art.test.mjs` :: 프레임별 전신·투명도·바닥·자세 차이 검증 — new

#### Details

- **Signatures & Types**:
  ```typescript
  BossEncounter.getHitBounds(): Pick<Phaser.Geom.Rectangle,
    "x" | "y" | "width" | "height" | "centerX" | "centerY">;
  BOSS_COMBAT_CONFIG["world-03"].bossName: "고등어 태비";
  ```
- **Data & Schema Fields**: 월드 3 보스 중심 `(1280,454)`과 발 기준 약 y503을 사용해 공사장 바닥 y504에 맞춘다. 월드 3 실제 몸의 근접 타격 범위는 x=`sprite.x-50`~`sprite.x+50`, y=`sprite.y-31`~`sprite.y+49` (100×80)로 제한한다. 이름/HP 표시가 안전모·준비 자세와 겹치지 않도록 월드 3 전용 높이를 지정한다. 다른 월드 보스 좌표·타격 판정은 그대로 둔다.
- **Execution Flow / Logic**:
  1. Precondition: sprite 중심과 알파 바운드를 먼저 측정한다.
  2. Core: 월드 3에만 새 좌표/타격 바운드를 적용한다. 시작 시 왼쪽을 보는 `flipX=true`와 패배 시 3번 프레임을 유지한다.
  3. Error handling: 프레임에 그려진 몸이 지정 판정을 벗어나거나 발이 뜨면 PNG와 범위를 같이 수정한다. 투명 프레임 외곽을 타격 범위로 쓰지 않는다.
  4. State/return: 벽돌 보스전의 현재 전투·승리 흐름이 깨지지 않는 상태로 다음 Task에 넘긴다.

## Acceptance Criteria

- [x] 896×112 시트의 8프레임이 모두 다른 전신 자세이고, 0~3의 기존 기능이 유효하다.
- [x] 치즈보다 크고 턱시도보다 작게 보이며 발·안전모·체력 막대·실제 명중 범위가 맞는다.
- [x] 기존 공사장 아레나 배경·바닥과 월드 1·2 보스 에셋은 변경되지 않는다.

## Validation

- `node scripts/generate-world03-boss.mjs --check` — 원본과 출력 일치.
- `node --experimental-strip-types --test scripts/world03-boss-bricks.test.mjs scripts/world03-mackerel-art.test.mjs` — 프레임·벽돌 회귀 통과.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 타입·정적 검사 통과.
- 실제 월드 3 보스 화면 캡처 — 치즈/턱시도와 실게임 크기 비교, 첫 등장/벽돌/쓰러짐의 발 정렬 확인.

## Commit Message

```text
feat(월드3): 고등어 태비 전신 픽셀 디자인과 판정 정렬

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P01-boss-attack-assets
Task: T01-mackerel-full-body-sprite

- 현장 반장 고등어의 8개 전신 자세와 112px 시트 제작
- 보스 발 위치와 가시 몸통 타격 범위 보정
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 이미지 생성·5개 자동 테스트·타입 검사·lint. 실제 화면 캡처는 통합 Task에서 확인.
- commit: 이 Task의 Git 커밋
