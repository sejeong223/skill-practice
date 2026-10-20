# Task: T04 여덟 장애물의 점프 가능성과 실제 플레이 통합 검증

## Status: done

## Goal

월드 2 첫 스테이지를 시작부터 출구까지 실제 조작해 8종 모두 보이고 점프로 넘어갈 수 있음을 확인한다. 접촉 사망, 고양이 할퀴기, 체크포인트 복귀, 일시정지와 월드 전환의 회귀를 없앤다.

## Decision Summary

- T01~T03을 화면·물리·오디오가 함께 작동하는 상태로 검증한다. 단순 데이터 테스트나 아트 연락 시트만으로 완료로 판단하지 않는다.
- 문제가 발견되면 이 Task에서 장애물의 `x`/hitbox와 원본 PNG의 여백·색·크기, 효과음 트림/음량을 조정한다. 모래 바닥 높이·코기 점프 튜닝·월드 1은 바꾸지 않는다.

## Implementation

### I01. 실제 배치와 점프 경로 확인

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `WORLD02_STAGE1_OBSTACLES` — 필요한 경우 x/Zone 폭·높이 조정; modify if needed.
  - `src/game/systems/World02ObstacleSystem.ts` :: Zone 위치·이미지 위치·콜라이더 수명 — 실제 플레이에서 보인 오류만 수정; modify if needed.
  - `src/game/stages/StageRuntime.ts` :: `addCheckpoint` — 연속 모래의 실제 표면 y=504에 월드 2 첫 스테이지 재시작 발 위치 정렬; 실제 브라우저에서 발견한 오류 수정.
  - `src/app/globals.css` :: `.boss-bark-cooldown` 모바일 크기 — 작은 화면에서 코기를 가리는 실제 겹침 수정.
  - `public/assets/pixel/props/world-02/*.png` — 배경과 충돌 윤곽 차이가 크면 수정; modify if needed.
  - `public/assets/audio/world-02-cat-hiss.wav`, `src/game/audio/audioManifest.ts` — 소리가 불명확하거나 너무 크면 원본 발췌/`gain` 조정; modify if needed.
  - `scripts/world02-obstacles.test.mjs`, `scripts/world02-cat-attack.test.mjs`, `scripts/world02-obstacle-assets.test.mjs` — 발견한 실제 버그의 비중복 회귀 테스트 추가; modify if needed.
  - `.memory/test-plans/2026-10-20-world02-playground-jump-obstacles.md` — 새 검증 기록과 화면 증거 경로; modify.
  - `.memory/test-plans/assets/2026-10-20-world02-obstacle-*.png` — 시작/체크포인트/고양이/모바일 캡처; new.

#### Details

- 1280×720에서 `world-02-stage-1` 진입 후 코기가 바닥 y=504 위를 처음부터 끝까지 걸을 수 있어야 한다. 월드 시작 안전구간과 출구 안전구간에는 사물이 없다. 8종을 카메라가 따라가는 실제 화면에서 하나씩 확인한다. 오리/코끼리/토끼 스프링 기구가 서로 구분되고, 삽이 모래에 꽂혀 보이며, 캔·봉지가 밝은 모래에서 읽혀야 한다. 임시 분홍/노랑 사각형 함정·임시 고양이가 중복되면 제거한다.
- 각 장애물 직전에서 기본 점프 1회와 오른쪽 이동만으로 넘어가는 입력을 시도한다. 코기 몸체(폭72·높이40)가 장애물 Zone과 안 겹친 정상 점프에서 죽으면 hitbox 높이/폭을 먼저 줄이고, 여전히 불가능하면 인접 `x`를 16px 단위로 조정한다. 점프 튜닝이나 단일 모래 발판은 이 요청 범위 밖이므로 건드리지 않는다. 성공 뒤 다음 장애물 전에 착지할 시간이 있어야 한다.
- 일반 7종은 걸어서 접촉할 때 사망 카운트가 1 증가하고 시작 또는 활성 체크포인트로 돌아가야 한다. 체크포인트 x=2496 활성화 뒤 오른쪽 코끼리·토끼에서 죽으면 체크포인트로 복귀하며 즉시 재사망하지 않아야 한다. 코인을 주운 뒤 죽는 기존 경제/재시작 흐름도 확인한다.
- 고양이는 잠든 모습에서 접촉 직후 할퀴는 모습·발톱 효과·실제 하악질이 나오고 그 뒤 사망해야 한다. 점프해 넘으면 소리/사망 없음. 충돌을 길게 유지해도 사망과 음원 재생은 각각 한 번이다. 일시정지를 연출 중에 해도 사망 타이머는 멈추고, 재개 후 남은 시간만 진행한다.
- 월드 선택으로 다른 월드로 갔다 돌아와도 장애물과 고양이는 초기 상태다. 월드 1의 기존 맵, 월드 2 스테이지 2~4, 보스전에는 새 장애물 시스템이 생성되지 않는다. 크기 390×844의 모바일 화면에서도 사물이 뚜렷하게 보이고 HUD/코기를 가리지 않는다.
- 브라우저 `pageerror`, 필수 PNG·WAV 404, 반복 오디오 source, 종료 후 남은 Collider/트윈은 0건이어야 한다. 스피커/헤드폰에서 `캬아악`으로 들리는지도 사람이 확인하고, 불명확하면 실제 고양이 녹음의 다른 구간으로 교체한다.

### I02. 기록 및 회귀 검증

- Related Files:
  - `.memory/test-plans/2026-10-20-world02-playground-jump-obstacles.md` — 화면 크기, 이미지 비교, 8종 회피/접촉, 고양이 소리/죽음, 체크포인트, 회귀 및 한계 기록; new/modify.
  - `scripts/world02-sand-floor.test.mjs`, `scripts/stage-progression.test.mjs`, `scripts/death-system.test.mjs` — 기존 바닥·다음 스테이지·사망 로직 회귀; read-only unless bug.

#### Details

- 이미지 크기/투명도와 고양이 음원 출처·가공 해시, 물리 Zone 값의 최종 표를 기록한다. 배치 사진은 첫 구간, 고양이, 체크포인트 이후 기구, 모바일 4장 이상을 보존한다. 아트·충돌을 수정했다면 T01/T02/T03의 완료 기록에 최종값을 반영하되 각 Task 커밋을 다시 쓰지 않는다.
- 새로운 실패가 발견된 코드만 최소한으로 수정하고 관련 테스트를 추가한다. 오래된 [전체 월드 2 Tiled 맵 계획](../../../phases/2026-09-21-world-map-design/P03-world02-playground/T01-world02-maps.md)을 이번 완료로 표시하지 않는다.

## Acceptance Criteria

- [x] 8종을 모두 기본 점프와 오른쪽 이동으로 넘을 수 있고, 각 7종 일반 장애물 접촉은 체크포인트 복귀를 일으킨다.
- [x] 고양이 접촉은 소리·할퀴기·사망 순서로 한 번만 실행되고 재시작 후 다시 잠든다.
- [x] 기존 모래 바닥·음악·짖기·체크포인트·출구와 다른 월드가 정상이다.
- [x] 실제 게임 화면과 모바일 캡처 및 검증 결과가 메모에 남는다.

## Validation

- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-sand-floor.test.mjs scripts/audio-pause.test.mjs scripts/stage-progression.test.mjs scripts/death-system.test.mjs` — 관련 회귀 통과.
- `node scripts/validate-assets.mjs` — 이미지 manifest 누락 없음. 효과음은 고양이 테스트의 WAV 검사와 브라우저 프리로드로 확인한다.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint` — 린트 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- `npm.cmd run dev` — localhost 실제 브라우저에서 위 시나리오 수행 및 증거 저장 후 dev 서버 종료.

## Commit Message

```text
fix(world02): 놀이터 장애물 점프와 재시작 동작 검증

Plan: 2026-10-20-world02-playground-jump-obstacles
Phase: P01-stage1-obstacles
Task: T04-playability-and-integration

- 여덟 장애물의 점프 가능성과 고양이·체크포인트 흐름 확인
- 화면·오디오·모바일 검증 기록 및 발견한 충돌 오차 수정
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — Chrome 연속 완주, 관련 테스트 37건, 에셋 검사, 린트, 빌드, 타입 검사
- commit: 이 Task의 한국어 커밋
