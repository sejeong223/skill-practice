# Task: T02 고양이 점프 여유 확보

## Status: pending

## Goal

월드 2 첫 스테이지의 잠자는 고양이를 조금 작게 만들어 코기가 기본 점프로 안정적으로 넘어가게 한다.

## Decision Summary

- 그림 표시 크기 `112×66 → 100×60`px, 접촉 판정 `52×28 → 40×26`px. 잠든 그림과 할퀴는 그림에 같은 크기를 적용한다.
- 고양이의 x좌표·하악질·할퀴기·사망 방식과 다른 장애물의 크기는 유지한다.

## Implementation

### I01. 고양이 정의

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `WORLD02_STAGE1_OBSTACLES`의 `sleeping-fat-cat` — `hitbox:{width:40,height:26}`, `displaySize:{width:100,height:60}`; modify.
  - `src/game/systems/World02ObstacleSystem.ts` :: `handleCatContact`, `resetForAttempt` — 정의의 표시 크기를 할퀴기/재시작에 재적용하는지 확인; read-only.
- **Signatures & Types**: `World02ObstacleDefinition.displaySize?: Readonly<{width:number;height:number}>`, `hitbox: Readonly<{width:number;height:number}>`; 필드 추가 없음.
- **Execution Flow / Logic**: 정의 한 곳의 크기를 줄인다. `groundY:504`, x=2160은 그대로이며 화면의 그림과 Arcade Zone이 함께 줄어든다.
- **Error & Exception Handling**: 그림만 줄이고 충돌체를 그대로 두면 빈 공간에서 할퀴기가 발생한다. 잠든 그림·공격 그림·재시작에서 같은 크기를 검증한다.

### I02. 점프 검증

- Related Files:
  - `scripts/world02-obstacles.test.mjs` :: 고양이 표시 크기·충돌 폭과 기본 점프 통과 여유; modify.
  - `scripts/world02-cat-attack.test.mjs` :: 잠든 그림·할퀴기·재시작의 표시 크기; modify.
  - `.memory/test-plans/browser-world02-repeating-pigeons.mjs` :: 실제 월드 2 플레이에서 고양이를 기본 점프로 넘고 사망이 늘지 않는지 확인; modify.
  - `.memory/test-plans/2026-10-21-world02-pigeon-arrival-cat-jump.md` :: 최종 검증 결과; modify.
- **Execution Flow / Logic**: 고양이 앞에서 실제 오른쪽 이동·점프 입력을 넣고 코기가 고양이 반대편에 착지하는지 확인한다. 비둘기 낙하가 점프 검증에 끼지 않도록 첫 비둘기 낙하 구간을 벗어난 상태에서 수행한다.

## Acceptance Criteria

- [ ] 고양이의 잠든 그림·할퀴기 그림·충돌 폭이 줄어든다.
- [ ] 코기가 기본 점프로 고양이를 넘어가도 사망하지 않는다.
- [ ] 다른 7종 장애물과 비둘기 동작은 유지된다.

## Validation

- `node --test scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` — 전용 Chrome/CDP 준비 후.

## Commit Message

```text
fix(world02): 고양이를 줄여 기본 점프 통과 여유 늘리기

Plan: 2026-10-21-world02-pigeon-arrival-cat-jump
Phase: P01-stage1-tuning
Task: T02-cat-jump-clearance
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
