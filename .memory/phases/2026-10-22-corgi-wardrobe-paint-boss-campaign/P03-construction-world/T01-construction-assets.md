# Task: T01 월드 3 공사장 설정과 픽셀 에셋

## Status: pending

## Goal

월드 3의 뒷산 설정을 공사장으로 통일하고, 네 일반 스테이지에서 실제로 보일 배경·바닥·장애물 픽셀 이미지를 만든다.

## Decision Summary

- 사용자 결정: 월드 3 제목·스테이지명·배경·장애물·인트로·보스를 공사장에 맞춘다. 보스는 고등어. 월드 4는 냥아치 아지트(고물상)와 턱시도, 월드 5는 캣타워 공성전과 메인쿤.
- 코드 사실: `WORLD_BLUEPRINTS`의 월드 3은 뒷산/공장장이고 `WORLD_MAP_THEMES`는 rock/log/grass/cave다. 월드 3~5의 타일셋·배경 매니페스트는 일부 파일이 없는 placeholder이며 `ParallaxRenderer`는 빈 색으로 대체한다.

## Implementation

### I01. 제목·테마·스토리 데이터

- Related Files:
  - `src/game/data/worlds.ts` :: `WORLD_BLUEPRINTS`의 월드 3 제목·부제·4개 stageTitles·bossTitle·bossName, 월드 4 bossTitle/bossName, 월드 5 bossName 변경. `BOSS_DEFINITIONS`의 임시 패턴 문자열은 이후 전투 Task에서 갱신.
  - `src/game/data/worldMaps.ts` :: 월드 3 팔레트와 hazardCatalog/objectVisualKeys를 공사장 항목으로 변경, `getWorld03StageTheme(stageId,base)` 추가.
  - `src/game/data/cutscenes/worlds.ts` :: 월드 3 intro를 공사장, 월드 4 intro를 고물상/아지트로 수정. 보스 intro가 없거나 옛 이름을 사용하면 월드 2~5 각각 새 정체성으로 작성. 기존 컷신 ID는 유지.
  - `scripts/stage-progression.test.mjs` :: 표시명·순서·컷신 참조 검사 보강.
- **Signatures & Types**: `getWorld03StageTheme(stageId:StageId,base:WorldMapThemeDefinition):WorldMapThemeDefinition`. 월드 3 stage 1~4가 `world-03-background-mid-{1,2,3,4}`를 사용하고 far/foreground는 공통. `WorldBlueprint`·`BossDefinition` 타입과 stage ID는 그대로.
- **Data & Schema Fields**: 월드 3 타이틀 `공사장`, 보스 `고등어`; 월드 4 타이틀 `냥아치 아지트 (고물상)`, 보스 `턱시도`; 월드 5 `캣타워 공성전`, 보스 `메인쿤`. 월드 3 4개 stage 이름은 진입로/레미콘 구역/비계 통로/자재 야적장처럼 각각 구분한다.
- **Execution Flow / Logic**: 새 세계관과 컷신 텍스트에서 뒷산·품질관리실·공장장·옥상·번개·은회색 우두머리 잔재를 제거한다. 이미 본 컷신 ID는 그대로 유지해 구저장이 깨지지 않게 한다.
- **Error & State Transition**: `stageId`를 바꾸지 않아 클리어 기록·코인 ID가 유지된다. 월드 4/5 일반 지형 전체 신규 제작은 이번 Task에서 하지 않는다.

### I02. 공사장 픽셀 아트 생성과 등록

- Related Files:
  - `scripts/generate-world03-construction.mjs` :: 신규 결정적 SVG→PNG 생성기, `--check` 지원.
  - `public/assets/pixel/backgrounds/world-03/` :: far 1장, stage별 mid 4장, foreground 1장.
  - `public/assets/pixel/tiles/world-03/world-03-tileset.png` :: 실제 공사장 바닥 타일셋.
  - `public/assets/pixel/tiles/world-03/world-03-construction-floor.png` :: 반복 가능한 공사장 바닥 상단/단면.
  - `public/assets/pixel/objects/world-03/{traffic-cone,brick-stack,cement-bag,steel-pipe}.png` :: 점프 장애물 4종.
  - `src/game/assets/assetManifest.json` :: 실제 파일 키·URL을 `required:true`로 등록; 없는 placeholder는 실제 파일로 대체할 때만 제거.
  - `scripts/world03-construction-assets.test.mjs` :: 신규, 이미지 크기/투명도/매니페스트와 시각 구별 가능성 검사.
- **Signatures & Types**: 에셋 키 `world-03-background-far`, `world-03-background-mid-{1..4}`, `world-03-foreground`, `world-03-tileset`, `world-03-construction-floor`, `world-03-{traffic-cone,brick-stack,cement-bag,steel-pipe}`. 장애물은 투명 PNG, 경계 32×40px 이하로 배치 가능한 원본 크기.
- **Execution Flow / Logic**: 기존 월드 1·2의 검은 1~2px 윤곽/평면 픽셀 팔레트와 맞춘다. far는 공사장 스카이라인, mid 4장은 크레인·굴착기·비계·자재더미 비중을 달리하여 같은 공사장 안에서도 스테이지를 구별한다. 바닥은 이어붙일 때 선이 끊기지 않게 하고 충돌면보다 시각적 요철이 4px 이내에 있도록 한다.
- **Error & State Transition**: 에셋 생성 뒤 `--check`가 바이트 차이를 잡는다. 투명 PNG의 실제 불투명 경계가 40px를 넘으면 장애물 아트/충돌 크기를 재조정하고 그대로 플레이에 투입하지 않는다.

## Acceptance Criteria

- [ ] 월드 3·4·5의 제목과 보스명이 확정 설정과 일치한다.
- [ ] 월드 3 일반 스테이지 네 곳에서 서로 다른 공사장 배경이 보이며 바닥과 장애물 파일이 실제 로드된다.
- [ ] 월드 3/4 인트로가 해당 장소를 설명하고 이전 뒷산/옥상 표현이 남지 않는다.

## Validation

- `node scripts/generate-world03-construction.mjs && node scripts/generate-world03-construction.mjs --check` — 에셋 결정성.
- `node --test scripts/world03-construction-assets.test.mjs scripts/stage-progression.test.mjs` — 데이터·에셋.
- `npx tsc --noEmit && npm run build` — 타입·빌드.
- 브라우저에서 월드 3 스테이지 1~4를 직접 열어 배경마다 공사장 요소가 실제로 보이는지 확인.

## Commit Message

```text
feat(공사장): 월드 3 세계관과 네 구역 픽셀 배경 제작

Plan: 2026-10-22-corgi-wardrobe-paint-boss-campaign
Phase: P03-construction-world
Task: T01-construction-assets

- 월드 3~5 보스 이름과 인트로 설정을 확정
- 월드 3 공사장 배경 바닥 장애물 에셋을 등록
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
