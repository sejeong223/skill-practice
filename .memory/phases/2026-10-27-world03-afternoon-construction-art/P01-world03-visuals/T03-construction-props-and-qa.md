# Task: T03 공사장 장애물 외형과 전 구간 시각 검증

## Status: done

## Goal

월드 3의 작은 공사장 장애물 네 종류를 새 배경과 같은 픽셀 아트 수준으로 바꾸고, 네 일반 스테이지 및 보스 아레나에서 배경·바닥·위험물의 구분과 기존 충돌/진행이 유지되는지 최종 확인한다.

## Decision Summary

- T01/T02 완료 상태를 전제로 원경·전경·바닥·중경 5장이 오후 3~4시 공사장 색/광원을 공유한다. 월드 3은 월드 1·2의 상세 픽셀 아트에 맞춘다.
- 현재 `traffic-cone.png`, `brick-stack.png`, `cement-bag.png`, `steel-pipe.png`는 단순한 작은 도형이다. `World03ConstructionObstacles`는 `(obstacle.x, 504)`에 원점 `(0.5,1)`로 그린다. `getWorld03Obstacles`의 4개 스테이지 × 8개 장애물, 위치·박스 크기는 그대로 둔다.
- 이미지 품질 개선과 플레이 판정 개선은 별개다. 투명 여백 안의 실제 그림을 기존 충돌 박스에 맞춰 플레이어가 눈으로 판단한 위험 범위와 죽음 판정이 어긋나지 않게 한다.

## Implementation

### I01. 네 장애물 PNG를 새 스타일로 교체

- Related Files:
  - `public/assets/pixel/objects/world-03/traffic-cone.png` :: `world-03-traffic-cone` — 안전 콘; modify
  - `public/assets/pixel/objects/world-03/brick-stack.png` :: `world-03-brick-stack` — 벽돌 더미; modify
  - `public/assets/pixel/objects/world-03/cement-bag.png` :: `world-03-cement-bag` — 시멘트 포대; modify
  - `public/assets/pixel/objects/world-03/steel-pipe.png` :: `world-03-steel-pipe` — 철제 파이프; modify
  - `public/assets/pixel/props/world-01/world-01-props.png`, `public/assets/pixel/props/world-02/orange-traffic-cone.png`, `public/assets/pixel/props/world-02/empty-cheetos-bag-ground.png` — 윤곽·채색·픽셀 크기 비교; read-only
  - `src/game/data/world03Construction.ts` :: `POSITIONS`, `KINDS`, `HITBOX`, `getWorld03Obstacles` — 기존 좌표·판정 계약; read-only
  - `src/game/systems/World03ConstructionObstacles.ts` :: `World03ConstructionObstacles` — 기존 그림 원점·충돌 연결; read-only
  - `src/game/assets/assetManifest.json` :: 기존 장애물 키·URL·`required:true` 계약; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type World03ObstacleKind = "traffic-cone" | "brick-stack" | "cement-bag" | "steel-pipe";
  interface World03ObstaclePlacement {
    readonly id: string;
    readonly kind: World03ObstacleKind;
    readonly x: number;
    readonly width: number;
    readonly height: number;
  }
  getWorld03Obstacles(stageId: StageId): readonly World03ObstaclePlacement[]
  ```
- **Data & Schema Fields**:
  - PNG 캔버스 규격 유지: cone 32×40, bricks 36×35, bag 34×36, pipe 40×30. 모두 RGBA 투명 배경, 바닥 접점은 이미지 마지막 행 근처.
  - `HITBOX` 시각 경계 기준: cone 23×34, bricks 34×29, bag 29×32, pipe 37×23. 각 새 그림의 불투명 외곽은 중심 정렬된 해당 폭/높이에 최대한 들어가게 하고, 약간 튀어나온 그림자만 판정 밖에 허용한다. 절대 위치나 위험물 판정 영역을 키우지 않는다.
  - 안전 콘은 주황/크림색 반사띠와 뒤쪽 음영, 벽돌은 쌓임 방향·모서리 결, 포대는 시멘트 접힘·무게감, 파이프는 금속 원형 단면·측면 하이라이트가 작은 크기에서도 구별되게 한다. 월드 1·2와 같은 짙은 자주/청회 윤곽, 제한된 단색 면, 선명한 픽셀 가장자리를 쓴다. 읽을 수 없는 상표 문자·포토 질감은 넣지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 네 원본 PNG의 캔버스와 `HITBOX`를 확인하고, T01/T02 완성 화면에 각각 올려 코인·배경 장식과 형태가 섞이는지 확인한다. 구현 전 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`를 읽는다.
  2. Core Processing: 이미지 생성 도구를 사용해 개별 소품을 만들고, 최근접 픽셀 변환/수동 정리로 위 캔버스와 불투명 외곽을 맞춘다. 이미지 키와 경로를 유지한다.
  3. Error & Exception Handling: 실제 그림이 판정 영역보다 훨씬 크거나 바닥에서 떠 보이면 PNG 여백·불투명 외곽을 수정한다. `getWorld03Obstacles`의 수치나 충돌 시스템을 이미지에 맞춰 변경하지 않는다.
  4. State Transition & Return: stage 1~4의 각 8개 장애물이 기존 좌표와 판정을 유지하며 새 아트로 보인다.

### I02. 자동·실화면 최종 검증

- Related Files:
  - `scripts/world03-visual-assets.test.mjs` :: 공통·중경 PNG 계약과 네 장애물 검증; modify
  - `scripts/world03-construction-stages.test.mjs` :: 4×8 장애물·점프 간격·진행 계약; read-only
  - `scripts/world03-background-routing.test.mjs` :: 구역/보스 레이어 경로; read-only
  - `src/game/scenes/StageScene.ts` :: `createWorld03ConstructionFloor`, `create` — 실제 바닥·배경 순서 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 소품 계약. 자동 검증은 PNG 알파 경계와 기존 배치 정의를 비교한다.
  type ObstacleAssetContract = Readonly<{
    kind: World03ObstacleKind;
    canvasWidth: number;
    canvasHeight: number;
    hitboxWidth: number;
    hitboxHeight: number;
  }>;
  ```
- **Data & Schema Fields**: `ObstacleAssetContract` 네 항목은 위의 캔버스와 `HITBOX` 값을 그대로 쓴다. 테스트에서 각 PNG의 존재·크기·알파·비어 있지 않은 색 영역을 확인한다. 회귀 테스트는 네 일반 스테이지에 각각 8개, 총 32개의 고유 ID와 기존 이격·체크포인트 보호 구역을 확인한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01/T02 테스트 및 현재 미커밋 작업을 확인한다. 자동 이미지 검사가 아트 품질을 판정하지 못하므로 실제 플레이 화면 비교를 필수로 한다.
  2. Core Processing: 1280×720에서 stage 1~4의 시작·중간·출구, boss의 시작·전투 지점을 각각 확인한다. 체크 목록: 오후 하늘이 밝고 동일한 광원, 4구역 랜드마크 구분, 원경·중경 가로 타일 이음새, 바닥 y=504, 코인/체크포인트/출구 시인성, 전경이 코기와 보스를 가리지 않음, 장애물 그림과 죽음 판정 일치. 월드 1·2도 각각 대표 화면을 확인해 기존 아트가 바뀌지 않았음을 기록한다.
  3. Error & Exception Handling: 특정 위치의 타일 반복·레이어 가림·충돌 오해가 발견되면 원인이 된 월드 3 PNG 또는 T01/T02의 월드 3 전용 경로만 바로잡고 같은 위치에서 다시 확인한다. 다른 월드 이미지나 게임 규칙을 조정하지 않는다.
  4. State Transition & Return: 시각 품질 개선과 기존 스테이지 진행이 모두 확인되면 P01을 완료한다.

## Acceptance Criteria

- [x] 네 장애물이 작은 실제 플레이 크기에서도 각각 무엇인지 식별된다. 색·외곽·햇빛 방향이 새 배경과 맞는다.
- [x] 장애물 4×8 배치, 체크포인트/출구, 점프 가능 간격 및 충돌 범위가 기존과 같다.
- [x] stage 1~4와 boss의 시작/중간/출구에서 오후 하늘·중경·지면이 끊기지 않고, 코기·코인·적이 선명하게 보인다. 월드 1·2 대표 화면은 회귀가 없다.

## Validation

- `node --test scripts/world03-visual-assets.test.mjs scripts/world03-background-routing.test.mjs scripts/world03-construction-stages.test.mjs` — 전 PNG 계약·레이어 라우팅·기존 장애물 진행 통과.
- `node scripts/validate-assets.mjs` — 필수 파일 전체 존재.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 통과.
- `node node_modules/eslint/bin/eslint.js scripts/world03-visual-assets.test.mjs` — 테스트 린트 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- 실제 브라우저의 월드 1·2 대표 화면 및 월드 3 stage 1~4/boss 화면을 1280×720로 비교하고, 가로 스크롤 중 x≈0/1280/2560에서 반복 경계와 소품 판정 확인 결과를 Task 진행 기록에 남긴다.

## Commit Message

```text
feat(월드3): 공사장 장애물 픽셀 아트와 맵 가독성 완성

Plan: 2026-10-27-world03-afternoon-construction-art
Phase: P01-world03-visuals
Task: T03-construction-props-and-qa

- 공사장 장애물 네 종류를 배경과 맞는 픽셀 아트로 교체
- 네 일반 구역과 보스 화면의 시각·기존 플레이 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 완료 (Plan/Phase/Task footer로 추적)

## Validation Results

- 내장 이미지 생성 도구로 원본 네 스프라이트를 각각 편집했다. 최종 저장 경로는 `public/assets/pixel/objects/world-03/{traffic-cone,brick-stack,cement-bag,steel-pipe}.png`이다. 프롬프트 핵심은 “orange/cream reflective cone with blue-purple outline”, “three staggered courses of reddish clay bricks”, “folded off-white cement sack”, “blue-gray steel tubes with visible circular ends”이며 모두 오후 왼쪽 위 광원·투명 배경·큰 픽셀 덩어리를 요구했다.
- 각 생성물의 불투명 외곽을 기존 `HITBOX`의 23×34, 34×29, 29×32, 37×23에 맞춰 규격화했다. 좌표·판정 코드는 수정하지 않았다.
- 실제 1280×720 화면에서 stage 1~4의 시작·x≈1280·출구 근처 x≈3560과 stage 1 x≈2560, 보스 시작·전투 화면을 확인했다. 비계 구역의 원경 녹색 띠를 중경 세로 위치로 수정하고, 다섯 중경의 반복 경계를 펜스 이음부로 보정했다. 월드 1·2 대표 화면도 비교했다. QA용 임시 시작 스테이지·스폰 변경은 원본 SHA-256 해시 확인 후 복구했다.
- `node --test scripts/world03-visual-assets.test.mjs scripts/world03-background-routing.test.mjs scripts/world03-construction-stages.test.mjs`: 11/11 통과. 에셋 검사: 136개 엔트리/117개 필수 파일 통과. 타입 검사, 지정 ESLint, 프로덕션 빌드 통과.
