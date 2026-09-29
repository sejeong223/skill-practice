# Task: T01 낮 지붕·빨랫줄과 보스 PNG 자산

## Status: pending

## Goal
2·4단계에 실제로 표시되는 낮 지붕·빨랫줄 PNG를 만들고, 정지 갈매기·열린 맨홀·삼색이·생선 가시·강아지 무리·코기 얼굴 이미지를 게임 로더에 등록한다. 그림이 제작만 되고 화면에서 쓰이지 않는 상태를 막는다.

## Decision Summary
- 기존 `world-01-far.png`는 푸른 낮 하늘이므로 유지한다. `world-01-mid.png`는 모든 단계가 공유하므로 2·4단계에 전용 중경 PNG를 추가한다.
- 기존 소품 아틀라스는 빨랫줄/맨홀 프레임 좌표를 유지하며 낮 색으로 다시 그린다. 실제 바닥 타일은 PNG 컨셉 이미지가 아닌 `world-01-tileset.svg`이므로 둘 다 맞춘다.
- 이 Task는 그림과 로드/선택 경로만 다룬다. 맨홀 충돌·보스 공격은 뒤 Task에서 연결한다.

## Implementation

### I01. 낮 배경·소품 제작과 단계별 로드
- Related Files:
  - `public/assets/pixel/backgrounds/world-01/world-01-roof-day-mid.png` :: 2단계 낮 지붕 중경; new
  - `public/assets/pixel/backgrounds/world-01/world-01-clothesline-day-mid.png` :: 4단계 낮 빨랫줄·담벼락 중경; new
  - `public/assets/pixel/props/world-01/world-01-props.png` :: 기존 아틀라스 빨랫줄/맨홀 프레임 재디자인; modify
  - `public/assets/pixel/props/world-01/world-01-props.json` :: 기존 프레임 위치/크기 확인; read-only
  - `public/assets/pixel/tiles/world-01/world-01-tileset-concept.png` :: 지붕 원본 시안 낮 팔레트 동기화; modify
  - `public/assets/pixel/tiles/world-01/world-01-tileset.svg` :: 실제 게임의 16px `roof` 패턴 밝게 수정; modify
  - `src/game/assets/assetManifest.json` :: 새 PNG 이미지 필수 로드; modify
  - `src/game/data/worldMaps.ts` :: `getWorld01StageTheme` 신규 함수; modify
  - `src/game/scenes/StageScene.ts` :: `create`의 테마 선택; modify
  - `src/game/maps/ParallaxRenderer.ts` :: `render`가 받은 theme의 mid asset을 쓰는 기존 경로; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export function getWorld01StageTheme(stageId: StageId, base: WorldMapThemeDefinition): WorldMapThemeDefinition;
  // StageScene.create: const theme = getWorld01StageTheme(stage.id, getWorldMapTheme(stage.worldId));
  ```
- **Data & Schema Fields**:
  - 전용 중경 두 PNG는 각각 `1920×720`, RGBA 투명 배경이다. 맨 위 0~240px은 투명해 먼 낮 하늘이 보이고, 아래에는 햇빛 받은 파란 지붕·밝은 벽·빨랫줄/흰 빨래를 배치한다. 좌우 끝이 반복되어도 절단이 눈에 띄지 않도록 한다.
  - 2단계 이미지 키 `world-01-roof-day-mid`; 4단계 `world-01-clothesline-day-mid`. 매니페스트는 둘 다 `kind:"image"`, `required:true`, 각 URL은 해당 PNG의 `/assets/pixel/...` 경로다.
  - 2단계는 파란 기와·흰 콘크리트·노란 햇빛, 4단계는 밝은 빨랫줄·흰/연분홍 빨래·담벼락을 중심으로 한다. 기존 월드 1 먼 배경의 파란 하늘과 맞추고 위험물과 같은 흰 가시 실루엣은 배경에 그리지 않는다.
  - `world-01-props.png`의 `clothesline` 프레임 `(x976,y465,w245,h205)` 및 `manhole` 프레임 `(x510,y505,w225,h174)`은 밝은 무채색/청색 하이라이트로 다시 그리되 아틀라스 1254×1254와 JSON 프레임 좌표를 바꾸지 않는다. 다른 프레임은 유지한다.
  - `world-01-tileset.svg`의 `roof` 패턴과 컨셉 PNG의 지붕 부분을 같은 낮 팔레트(기와 파랑 `#467aa0`, 밝은 면 `#8db6c3`, 그림자 `#536871`)로 맞춘다. 게임 지면의 16×16 타일 경계와 tilecount 108은 유지한다.
- **Execution Flow / Logic**:
  1. PNG 원본은 기존 월드 1 배경/소품 픽셀 스타일을 참고해 제작하고, 투명 영역을 보존한다. 리사이즈 시 보간을 끄고 픽셀 가장자리를 흐리게 하지 않는다.
  2. `getWorld01StageTheme`는 `stageId`가 2 또는 4일 때 `base.layers`의 `kind === "background-mid"` 항목만 새 assetKey로 복사한다. 1·3단계·보스·다른 월드는 원래 theme을 반환한다. 공용 `WORLD_MAP_THEMES` 배열을 변경하지 않는다.
  3. `StageScene.create`에서 이 반환값을 `ParallaxRenderer.render`와 `TiledMapLoader.load`에 전달한다. 전경 depth -10, 게임플레이 depth 0은 그대로여서 장식이 충돌물/플레이어를 가리지 않는다.

### I02. 갈매기·맨홀·보스 전투·HUD 자산
- Related Files:
  - `public/assets/pixel/props/world-01/seagull-static.png` :: 정지해 있는 갈매기 장애물; new
  - `public/assets/pixel/props/world-01/manhole-open.png` :: 열린 구멍 테두리; new
  - `public/assets/pixel/characters/world-01/calico-boss.png` :: 삼색이 대기·투척·기절 3프레임 시트; new
  - `public/assets/pixel/props/world-01/fishbone-projectile.png` :: 생선 가시 투사체; new
  - `public/assets/pixel/characters/world-01/stray-dog.png` :: 강아지 무리 반복 스프라이트; new
  - `public/assets/pixel/ui/corgi-face.png` :: 보스전 하트 옆 얼굴; new
  - `src/game/assets/assetManifest.json` :: 6개 자산 등록; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // PixelAssetDefinition { key: string; kind: "image" | "spritesheet"; url: string;
  //   frameWidth?: number; frameHeight?: number; frameCount?: number; required: boolean }
  ```
- **Data & Schema Fields**:
  - `seagull-static.png`: 48×32 RGBA; 비둘기와 구별되는 흰 몸·회색 날개·노란 부리의 가만히 있는 갈매기. 키 `world-01-seagull-static` (`image`).
  - `manhole-open.png`: 96×48 RGBA; 양쪽 금속 테두리와 가운데 명확한 검은 80px 구멍. 이미지 자체는 충돌체가 아니다. 키 `world-01-manhole-open` (`image`).
  - `calico-boss.png`: 288×96 RGBA, 가로 96×96 세 프레임(정면 대기·생선 가시 투척·승리 대사 끝의 기절). 흰 몸에 주황/검정 큰 반점, 얼굴의 서로 다른 색 귀가 읽혀야 하며 기존 턱시도 검정·흰 그림을 재사용하지 않는다. 기절 프레임은 몸이 옆으로 쓰러지고 눈을 감은 상태다. 키 `world-01-calico-boss` (`spritesheet`, `frameWidth:96`, `frameHeight:96`, `frameCount:3`).
  - `fishbone-projectile.png`: 32×16 RGBA, 뾰족한 흰 뼈와 어두운 외곽선, 앞뒤 방향을 `flipX`로 표현. 키 `world-01-fishbone` (`image`).
  - `stray-dog.png`: 48×40 RGBA, 코기와 다른 실루엣의 떠돌이 강아지. 동일 이미지를 위치/반전/색상 차이로 3마리 표시. 키 `world-01-stray-dog` (`image`).
  - `corgi-face.png`: 24×24 RGBA, 현재 플레이어와 같은 주황·흰 얼굴, HUD용. 키 `world-01-corgi-face` (`image`).
  - 6개 항목은 모두 `required:true`, URL은 파일의 `/assets/pixel/...` 절대 경로다. 월드 2~5 보스 자산을 이 Task에서 가짜로 등록하지 않는다.
- **Execution Flow / Logic**:
  1. 이미지 크기·투명도와 프레임 경계를 지킨다. 보스 그림은 y 하단 발, 생선 가시는 날카로운 끝이 이동 방향을 향하게 만든다.
  2. 매니페스트에 항목을 추가해 기존 `PreloadScene.loadAsset`가 이미지를 로드하게 한다. 누락 파일은 기존 필수 에셋 오류로 드러난다.
  3. T02는 갈매기·맨홀 이미지를, T04~T05는 전투 이미지를 사용한다. 이 Task에서는 임시 게임 오브젝트를 남기지 않는다.

## Acceptance Criteria
- [ ] 실제 게임 2·4단계 중경이 서로 다르고 둘 다 낮이며 기존 1·3단계 낮 하늘과 이어진다.
- [ ] 빨랫줄 PNG 프레임과 실제 지붕 타일이 낮 색으로 변경되고 아틀라스 프레임 좌표가 유지된다.
- [ ] 갈매기, 열린 맨홀, 삼색이 3프레임(대기·투척·기절), 생선 가시, 강아지, 코기 얼굴 PNG가 지정 크기와 투명도를 가진다.
- [ ] 월드 1 밖의 배경 선택과 기존 턱시도 인트로 자산은 유지된다.

## Validation
- `npx.cmd tsc --noEmit` — 테마 선택 타입 통과
- `npm.cmd run lint` — 관련 TypeScript 린트 통과
- `npm.cmd run build` — 매니페스트와 자산 경로를 포함한 빌드 통과
- `npm.cmd run dev` — 2·4단계 F2 진입 시 낮 PNG가 실제 표시되고 필수 이미지 로드 오류가 없는지 눈으로 확인

## Commit Message
```text
feat(art): redraw world one rooftops and add calico combat sprites

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T01-daylight-and-boss-art

- Load distinct sunlit roof and clothesline PNG layers
- Add calico, fishbone, dogs, open manhole, and HUD face art
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
