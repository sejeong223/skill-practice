# Task: T01 짧은 맵과 자연스러운 카메라·보행

## Status: done

## Goal

월드 1 일반 맵 네 개를 기존 목표인 2560px로 정합화하고, 구간 경계의 카메라 점프와 속도에 맞지 않는 보행감을 개선한다. 배경 이미지 파일을 먼저 자르지 않는다.

## Decision Summary

- 현재 기준은 소스/Tiled 모두 3840px다. 사용자에게 보였던 버전의 원인을 추측해 확정하지 않고, 현재 빌드에서 재현·전후 비교한다.
- 이 Task는 이전 `2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/T01-compact-normal-maps.md`를 대체한다. 이 Task까지는 기존 24개 기믹을 유지하고, 다음 T02가 32개로 늘린다.
- 2560px는 지형 길이다. 플레이어 속도·스프라이트 크기·배경 텍스처의 가로 비율을 2/3로 압축하는 방식은 쓰지 않는다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`를 읽는다. Phaser 동작은 설치된 `node_modules/phaser/src/cameras/2d/Camera.js`, `physics/arcade/Body.js`를 기준으로 한다.

## Implementation

### I01. 맵 정의·좌표·생성물을 함께 단축

- Related Files:
  - `src/game/core/constants.ts` :: `WORLD01_NORMAL_MAP_WIDTH`; modify
  - `src/game/data/world01Maps.ts` :: `world01Checkpoint`, `sectionIndex`, `createStageMap`; modify
  - `src/game/data/world01Gimmicks.ts` :: `dangers`, `coins`, `section`, `getWorld01FloorY`; modify
  - `src/game/data/worlds.ts` :: `createNormalStage`; modify
  - `scripts/world01-maps.mjs` :: `makeMap`, `verifyMap`, `run`; modify
  - `src/game/data/validateMaps.ts` :: `validateAllMaps`; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json`, `world-01-stage-2.json`, `world-01-stage-3.json`, `world-01-stage-4.json` (같은 디렉터리) :: Tiled maps; regenerate

#### Details

- **Signatures & Types**:
  ```typescript
  export const WORLD01_NORMAL_MAP_WIDTH = 2560;
  // NORMAL_MAP_WIDTH=3840, BOSS_MAP_WIDTH=1920은 기존 다른 맵용으로 유지.
  type Stage = 1 | 2 | 3 | 4;
  function world01Checkpoint(stageNumber: Stage): { id: string; x: number; sectionIndex: 3 | 4 } | null;
  function getWorld01FloorY(stage: Stage, x: number): number;
  function createStageMap(stageNumber: Stage): StageMapDefinition;
  ```
- **Data & Schema Fields**: `StageDefinition.mapWidth` / `StageMapDefinition.mapWidth` 2560, `mapHeight` 720. 일반 맵 `segments[].length`는 `[192,720,736,720,192]`, 구간 경계는 `[0,192,912,1648,2368,2560]`. `MapSectionDefinition`의 `x,width,index,role,checkpointId,mapObjectIds`를 함께 변경한다. 구간 판정은 오브젝트 중앙 x를 사용한다. `Tiled.width=160,height=45,tilewidth=tileheight=16`.
- **Exact intermediate coordinates** (이 Task 통과용, 다음 T02가 밀도를 변경):

  | Stage | 물리 위험 kind:x | 가짜 간식 kind:x |
  | :--- | :--- | :--- |
  | 1 | ant-static:336, white-spike-static:944, box-static:1552, pigeon-static:2160 | fake-bone-green:1360 |
  | 2 | ant-static:320, open-manhole:800, pigeon-static:1280, white-spike-static:1760, box-static:2240 | fake-bone-reverse:600, fake-bone-green:2016 |
  | 3 | ant-static:352, box-static:960, white-spike-static:1568, pigeon-static:2176 | fake-bone-fire:1344 |
  | 4 | pigeon-static:288, open-manhole:736, box-static:1184, white-spike-static:1664, ant-static:2112 | fake-bone-reverse:1056, fake-bone-fire:1952 |

- **Floor profile**: 스테이지 1/3은 y512. 스테이지 2는 x<1024→512, <1280→496, <1792→480, <2048→496, 이후512. 스테이지 4는 x<896→512, <1152→496, <1664→480, <1920→496, 이후512. 높이 차 16px와 맨홀 폭80은 유지한다.
- **Execution Flow / Logic**:
  1. 스테이지 2 체크포인트 `world-01-stage-2-checkpoint` x1520/section3, 스테이지 4 `world-01-stage-4-checkpoint` x2320/section4. 출구 x2416,width32, 스폰 x96. y는 변경한 바닥 함수에서 계산한다.
  2. 월드 1 일반 맵만 단축한다. 다른 월드 `NORMAL_MAP_WIDTH`, 보스 `BOSS_MAP_WIDTH`, 기존 저장 stage/checkpoint ID를 바꾸지 않는다.
  3. 생성 스크립트와 앱 검사 모두 폭2560, 이 Task의 위험 x 간격448~640, 기믹24개를 기대한다. 네 JSON을 생성하고 체크 모드가 타일 데이터·오브젝트 좌표·속성까지 재생성 예상값과 비교하게 한다. JSON 포맷/키 순서 차이는 오류로 보지 않는다.
  4. `getWorld01FloorY`와 타일 첫 충돌 행이 일치해야 한다. 맨홀 열은 전부 비어 있어야 한다. 메타데이터만 줄이고 기존 JSON/physics bounds를 남기지 않는다.
- **Error & State**: 정의/생성물 불일치는 검사 실패로 처리한다. 로드 실패를 단색 세그먼트 fallback 화면으로 넘기고 완료로 판정하지 않는다. 게임 저장 스키마 변경은 없다.

### I02. 구간 진입 때 카메라 추적을 다시 시작하지 않기

- Related Files:
  - `src/game/camera/CameraDirector.ts` :: `followPlayer`, `setSectionMode`, `pauseFollow`, `endCutscene`; modify
  - `src/game/scenes/StageScene.ts` :: `create`, `syncSectionCamera`, `toggleMapOverview`; modify
  - `node_modules/phaser/src/cameras/2d/Camera.js` :: `startFollow`, `setLerp`; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  public followPlayer(): void;
  public setSectionMode(section?: MapSectionDefinition): void;
  // StageScene 기존 activeSectionId?: string 은 create에서 undefined로 초기화.
  ```
- **Data & Schema Fields**: follow offset x=-320,y=0, lerpX=0.08. `followsVertical = Boolean(section?.vertical && stage.mapHeight > camera.height)`일 때 lerpY=0.08, 나머지0. 직렬화 상태 추가 없음.
- **Execution Flow / Logic**:
  1. `followPlayer()`의 최초 연결/컷신 복귀/F3 복귀는 `startFollow(player,true,0.08,0,-320,0)`처럼 offset을 인자로 전달한다. `setFollowOffset` 다음에 offset 없는 `startFollow`를 부르는 현재 순서를 제거한다.
  2. `setSectionMode()`는 이미 연결한 follow target과 현재 scroll을 보존하고 `setLerp(0.08, followsVertical ? 0.08 : 0)` 등 설정만 갱신한다. `startFollow`, `centerOn`, `setScroll`을 구간 경계에서 호출하지 않는다.
  3. `StageScene.create()`에서 `activeSectionId`를 초기화해 재사용되는 Scene에서 예전 section ID가 남지 않게 한다. `syncSectionCamera()`의 변경 감지는 유지한다.
  4. 월드 양끝 clamp와 최초 진입/명시적 디버그 개요 전환은 정상 재배치다. 일반 이동 중 구간 경계의 갑작스러운 이동만 제거한다. 컷신 줌/자동 진행은 유지한다.
- **Error & State**: section이 없으면 기본 가로 추적 설정으로 돌아가며 예외를 던지지 않는다. 줌 복귀에서 bounds 밖 배경을 노출시키지 않는다.

### I03. 보행 주기와 발 위치 보정

- Related Files:
  - `src/game/entities/PlayerAnimator.ts` :: `update`, `playRunAnimation`, `destroy`; modify
  - `src/game/entities/Player.ts` :: `alignFeetToFrame`; modify only if baseline proves an anchor/body mismatch
  - `src/game/systems/PlayerController.ts` :: `updateAirState`, `isGrounded`; read-only unless a reproduced false state transition needs a scoped correction
  - `src/game/entities/playerTypes.ts` :: `DEFAULT_PLAYER_TUNING`; read-only
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: 112×128×4 sheet; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  public update(now?: number): void;
  public alignFeetToFrame(footAnchorY: number): void;
  // PlayerAnimator 새 private 프레임 동기화 메서드
  private syncRunFootAnchor(): void;
  ```
- **Data & Schema Fields**: 프레임 순서0,1,2,3, 기본10fps, 발 anchor `[99,99,100,104]`, 코기 scale1. 월드1 body48×40, 다른 월드72×40. 속도 기준240px/s, 가속1800, 감속2200, 중력1200, 점프-460을 유지한다. 애니메이션 속도만 `clamp(abs(body.velocity.x)/240,0.15,1.25)`로 조절한다. 실제 정지/점프는 기존 상태에 따른다.
- **Execution Flow / Logic**:
  1. 평지 정속/가속/감속/좌우 반전/착지에서 `animationState`, 프레임, 발 y와 `body.bottom`을 기록해 접지 떨림과 프레임 재시작을 구분한다.
  2. run 상태가 유지되는 동안 `anims.play`/`setTexture`로 0프레임을 반복 초기화하지 않는다. 플레이어의 animation state `timeScale`을 조정하고 전역 animation definition의 속도는 바꾸지 않는다.
  3. `animationupdate` 이벤트와 run 진입/종료 시 같은 `syncRunFootAnchor()`를 사용해 표시 프레임과 anchor를 동기화한다. destroy에서 해당 listener를 해제한다. 기존 update에서도 멱등 동기화를 허용한다.
  4. `alignFeetToFrame`은 originY=`anchor/128`, body offsetY=`anchor-40`의 짝을 유지한다. 프레임 변경 전후에 body.bottom, body center.x, velocity가 변하면 안 된다. sprite y를 매 프레임 더하거나 body 크기를 프레임별로 바꾸지 않는다.
  5. 점프 중 강제로 grounded=true를 만들거나 맨홀을 메워 보행을 고치지 않는다. 16px 실제 단차에 의한 접촉은 카메라/애니메이션 오류와 구분해 기록한다. 단차 자동 오르기 같은 새 이동 규칙은 이 Task에 추가하지 않는다.
- **Error & State**: 프레임 번호가 유효하지 않으면 anchor99 사용. 이미지 원본의 잔여 포즈 차이는 실측해 기록한다. 이번 Task가 코기 재생성부터 시작하지 않는다.

### I04. 배경 원본 보존과 자르기 최후 조건

- Related Files:
  - `src/game/maps/ParallaxRenderer.ts` :: `createLayer`, `render`, `setOverview`; modify only for reproduced seams/coverage failure
  - `src/game/data/worldMaps.ts` :: `getWorld01StageTheme`, `WORLD_MAP_THEMES`; read-only
  - `src/game/assets/assetManifest.json` :: 월드1 배경 등록; conditional modify
  - `public/assets/pixel/backgrounds/world-01/` :: 기존 배경; read-only by default
  - `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md` :: 원인/전후 기록; new

#### Details

- **Signatures & Types**: 기존 `render(theme: WorldMapThemeDefinition,mapWidth:number,mapHeight:number)` 계약 유지. 필요할 때만 내부 renderer 분기 추가. 맵 길이와 이미지 픽셀 너비는 독립이다.
- **Execution Flow / Logic**:
  1. 4개 테마의 기존 far/mid/foreground를 2560px로 주행하며 빈 영역·반복 접합선 위치를 확인한다. 프레임률 저하와 이미지 이음새는 별도로 기록한다.
  2. `tileSprite`의 표시 크기와 원본 texel 스케일을 혼동하지 않는다. 파일 수정 없이 표시 영역을 카메라 이동 범위에 맞춰 덮는다. 월드고정 레이어의 최소 폭은 `viewportWidth + maxScrollX * scrollFactorX`이며 기존 mapWidth보다 필요 시 더 넓힌다. y도 같은 원칙을 적용한다.
  3. 비반복 일러스트의 이음새가 남으면 원본 image를 종횡비 유지로 한 장 표시하고 필요한 coverage를 채우는 방식, 뷰포트 클리핑/스크롤 계수 보정을 비교한다. 정상 맵의 원근 층을 제거하거나 가로만 찌그러뜨리지 않는다. 다른 월드 renderer는 기존 동작을 유지한다.
  4. **자르기 허용 조건**: I02/I03 개선, coverage 수정, 원본 한 장 표시/스크롤 조정을 실제 비교해도 남는 원본 이미지 문제를 스크린샷과 수치로 기록한 경우에만 적용한다. 파생 파일 `<원본stem>-compact.png`, 원본 유지, crop rectangle `{x,y,width,height}`와 이유·원본 해시 기록, 해당 월드/일반 맵 참조만 교체한다. 실행 시 이미지 편집은 `imagegen` 스킬/도구 지침을 따른다. 배경 자르기가 물리/보행 오류를 해결했다는 주장을 하지 않는다.
  5. 이 Task를 통과하면 자르기 여부와 선택한 렌더링 방식을 검증 기록에 남긴다. 원본 유지로 통과하면 파생 파일은 만들지 않는다.

## Acceptance Criteria

- [x] 일반 맵 네 개의 모든 폭이2560, 구간/출구/체크포인트 정합성이 맞고 타 월드 폭은3840이다.
- [x] 이 Task 시점 기믹24개·체크포인트2개, 맨홀 충돌 빈 공간이 유지된다.
- [x] 일반 이동의 section 전환에서 scroll이 재설정되지 않으며 -320 follow offset이 실제 적용된다.
- [x] 정속 달리기 중 run 프레임이 계속 순환하고 가감속에 맞춰 주기가 변한다. 발 anchor 변경이 몸체 위치를 움직이지 않는다.
- [x] 이미지 원본 유지 개선을 먼저 검증했고, 자르기를 했다면 최후 조건과 파생 파일 기록이 있다.
- [x] 1280×720 및 모바일 가로뷰에서 주행·재시작·F3 복귀를 직접 확인했다.

## Validation

- 변경 전후 `npm.cmd run dev`로 같은 seed의 스테이지1~4를 확인하고 표본 x(900→924,1636→1660,2356→2380), frame/body.bottom/camera.scrollX를 기록한다. 정속60fps의 경계 한 프레임 scroll 변화가 주변 정상 이동과 비슷해야 한다(초기 기준8px 이하, 끝 bounds 제외). 30/60/120fps 비교는 실제 측정 환경을 명시한다.
- `npm.cmd run world01:maps` — 네 JSON 생성.
- `npm.cmd run world01:maps:check` — 중간 목표2560px/24개/2체크포인트.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run test:progression` — 모두 통과.
- 몸체 정합성·평지 왕복·점프·맨홀·체크포인트 복귀는 실제 브라우저로 검증한다. 이번 계획 작성 시에는 구현 검증을 실행하지 않았다.

## Commit Message

```text
fix(world01): 짧은 맵의 카메라와 코기 보행 흐름 개선

Plan: 2026-10-12-world01-gameplay-refinement
Phase: P01-gameplay-refinement
Task: T01-compact-motion

- 일반 맵 길이와 지형 데이터를 2560px로 정합화
- 구간 카메라 재시작을 제거하고 보행 주기와 발 접지를 정렬
- 배경 원본 유지 개선을 우선 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 본 Task 제목의 Git 커밋 참조
