# Task: T02 삼색이 방향 추적과 승리 대화 기절 이미지

## Status: done

## Goal

삼색이가 전투 중 코기 쪽을 바라보고, HP0이 된 뒤 첫 대사부터 쓰러진 이미지로 표시된다. 코기의 전투 종료 위치는 선행 T01 동작대로 유지한다.

## Decision Summary

- T01 완료 후 실행한다. 원본 이미지가 오른쪽을 보므로 코기가 왼쪽이면 flipX=true, 오른쪽이면 false다. 같은 x에서는 이전 방향을 유지한다.
- 기존 `public/assets/pixel/characters/world-01/calico-boss.png`의 frame2를 사용한다. 원본 스프라이트는96×96 프레임3개(frame0 대기, frame1 투척, frame2 쓰러짐)이다. 이미지 생성/교체는 필요 없다.
- frame2를 마지막 대사(index7)에서만 표시하던 동작을 첫 대사 전으로 옮긴다. 보스 공격 중단이 여러 번 호출되어도 frame0으로 되돌아가지 않아야 한다.

## Implementation

### I01. 코기 위치에 따른 보스 방향

- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: constructor, update, acceptMeleeHit, releaseFishbone, resetAttempt, 새 facePlayer — 방향과 시각 상태 소유; modify.
  - `src/game/scenes/StageScene.ts` :: create의 calicoSprite 생성 — 고정 `.setFlipX(true)` 제거; modify.
  - `src/game/assets/assetManifest.json` :: world-01-calico-boss 96×96 등록 — 기존 자산 확인; read-only.

#### Details

- **Signatures & Types**:

  ```typescript
  // World01CalicoBoss에 추가
  private facePlayer(): void;
  // 기존 메서드 유지
  public update(now: number, delta: number): void;
  public acceptMeleeHit(result: SlipperAttackResult, player: Player): boolean;
  public resetAttempt(now: number): void;
  private releaseFishbone(): void;
  ```

- **Data & Schema Fields**:
  - `player.x: number`, `sprite.x: number`, `sprite.flipX: boolean` 사용. 새로운 저장 필드나 방향 enum은 필요 없다.
  - `CalicoBossState`의 health/phase/공격 시간/하트 구조는 유지한다. HP10, 방어3회, 사모예드5마리 규칙은 변경하지 않는다.

- **Execution Flow / Logic**:
  1. Precondition & Validation: 생성자는 기존 Player/Sprite를 받는다. `facePlayer`는 `isDefeated()`이면 방향을 바꾸지 않는다.
  2. Core Processing:
     - `player.x < sprite.x`이면 `sprite.setFlipX(true)`, `>`이면 false, 같으면 유지한다. sprite.x/y, 크기, HP바 위치는 변경하지 않는다.
     - 생성 직후와 `resetAttempt`가 health10/phase intro로 초기화한 직후 방향을 맞춘다.
     - 전투 update에서 기존 intro/defeated early return 이후, 타이머/투척 처리 전에 방향을 갱신한다. ready/telegraph/projectile 모두 현재 코기 쪽을 본다.
     - 유효한 마지막 근접 타격을 처리할 때 health를0으로 만들기 전에 방향을 갱신한다. StageScene에서 acceptMeleeHit가 update보다 먼저 호출되므로 이 처리가 없으면 마지막 프레임에 반대쪽을 보고 쓰러질 수 있다.
     - releaseFishbone에서 실제 발사 직전에도 방향을 갱신한다. 현재 `direction = player.x < sprite.x ? -1 : 1`과 일치한다. 이미 발사된 생선 가시의 trajectory는 그대로 두어 갑자기 되돌아오지 않게 한다.
  3. Error & Exception Handling: equal x에서 임의로 좌우를 토글하지 않는다. 공격 취소/보스 패배 후 멈춤 상태에서는 새 투척을 발생시키지 않는다.
  4. State Transition & Return: 전투 중에는 코기 상대 위치를 따라 방향만 바뀌고, 보스 처치 후에는 마지막 방향을 유지한다. 재도전은 새 위치에 맞는 방향으로 초기화한다.

### I02. 첫 대사 전 기절 이미지와 멱등성

- Related Files:
  - `src/game/systems/World01CalicoBoss.ts` :: stopAttacks, showCollapseFrame, resetAttempt — frame2 유지 및 재도전 복구; modify.
  - `src/game/scenes/StageScene.ts` :: handleCalicoDefeat, cutscene-beat 구독 — 첫 대사 전에 이미지 변경하고 index7 전용 변경 삭제; modify.
  - `src/game/data/cutscenes/worlds.ts` :: world-01-boss-clear — 기존8개 대사/순서 유지; read-only.

#### Details

- **Signatures & Types**:

  ```typescript
  public stopAttacks(): void;
  public showCollapseFrame(): void;
  public isDefeated(): boolean;
  // StageScene 기존 메서드
  private async handleCalicoDefeat(): Promise<void>;
  ```

- **Data & Schema Fields**: 기존 phase `"defeated"`와 health0을 함께 확인한다. phase만 확인하면 코기 패배로 전투를 멈춘 경우와 보스 처치가 섞일 수 있다. `isDefeated()`는 이미 이 두 조건을 확인한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: HP0과 승리 콜백이 성립한 경우에만 삼색이 기절 그림을 적용한다.
  2. Core Processing:
     - `stopAttacks()`가 phase를 defeated로 설정하고 공격/개 무리/경고를 정리한 뒤, `isDefeated()`이면 frame2, 아니면 frame0을 적용한다. tint도 제거한다. 여러 번 호출해도 보스 처치 후에는 frame2 유지.
     - `showCollapseFrame()`도 isDefeated 조건에서 frame2 및 clearTint를 적용하는 멱등 메서드로 유지한다.
     - `StageScene.handleCalicoDefeat()`에서 stopAttacks 및 T01의 코기 정지 처리를 마친 뒤 `showCollapseFrame()`을 호출하고, 그 다음 `cutsceneDirector.play("world-01-boss-clear")`를 호출한다. 첫 cutscene-started/beat 이벤트 시점에 이미 frame2여야 한다.
     - `cutscene-beat` 콜백의 `world-01-boss-clear && index === 7` 전용 showCollapseFrame 분기는 제거한다. 화자별 focusDialogue 및 index0 즉시 초점 로직은 유지한다.
     - `resetAttempt`의 기존 health10/phase intro/frame0/clearTint 초기화를 유지하고 방향 초기화만 추가한다. 기절 그림이 다음 전투에 남지 않게 한다.
  3. Error & Exception Handling: 생성 직후 보스 health가10인 상태, 코기 사망, 대사 건너뛰기에서 기절 처리를 중복 트리거하지 않는다. 새 이미지 로더나 대사 문구 변경은 추가하지 않는다.
  4. State Transition & Return: HP0→frame2→승리 대화 전체 frame2→보스 클리어 화면. 코기 현재 위치, 삼색이 위치, 저장/보상은 그대로 유지한다.

### I03. 회귀 검증

- Related Files:
  - `scripts/calico-melee-hitbox.test.mjs`, `scripts/fishbone-trajectory.test.mjs`, `scripts/bowl-defense.test.mjs`, `scripts/cutscene-auto-advance.test.mjs` — 기존 자동 검증; read-only.
  - `.memory/test-plans/2026-10-13-calico-facing-collapse.md` 및 `assets/calico-facing-collapse.json` — 실제 브라우저 검증 기록; new.
- Chromium 별도 저장 컨텍스트에서 onboarding/보스 도입 재시청을 준비하고 StageScene을 world-01-stage-boss로 시작한다. 실제 Player/World01CalicoBoss를 사용한다. 로컬 helper `.git/refinement-tools/browser.cjs`의 setup/restart를 사용할 수 있다. DOM 테스트만으로 canvas 이미지를 검증하지 않는다.
- 코기를 좌/우로 이동시켜 ready/telegraph/projectile 각 상태에서 flipX=true/false를 확인한다. 보스와 같은 x에서는 직전 방향을 유지한다. HP바와 몸체 월드 좌표가 좌우 반전으로 움직이지 않는지 육안 확인한다.
- 코기가 경고 중 반대편으로 이동한 뒤 생선 가시가 실제 코기 쪽으로 출발하는지 확인한다. 발사 후 반대편으로 이동해도 기존 가시의 trajectory는 바뀌지 않는다.
- 좌측/우측에서 실제 마지막 공격으로 HP0을 만들고 첫 cutscene-started/beat에서 frame.name=2, tint 제거, 코기 정지, zoom1을 측정한다. 자동/수동 대사 진행 전체에서 frame2 유지, stopAttacks 재호출 후에도 유지한다.
- 처음 본 대사 완료와 재시청 건너뛰기 모두 짖기 보상/클리어1회를 유지한다. 보스 패배 또는 재도전에서는 frame0과 정상 방향으로 시작한다. 새 자산을 생성하지 않는다.

## Acceptance Criteria

- [x] 삼색이는 코기가 있는 좌우 방향을 보고 같은 x에서 떨리지 않는다.
- [x] 투척 방향/기존 궤도·근접 판정·체력/방패 규칙이 유지된다.
- [x] 첫 승리 대사부터 기절 이미지frame2이며 대화 내내 서 있는 그림으로 돌아가지 않는다.
- [x] T01 코기 위치 고정과 화자 카메라, 재도전, 보상/클리어 흐름이 정상이다.

## Validation

- `node --experimental-strip-types --test scripts/calico-melee-hitbox.test.mjs scripts/fishbone-trajectory.test.mjs scripts/bowl-defense.test.mjs scripts/cutscene-auto-advance.test.mjs`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- 실제 브라우저 좌우 전투/투척/승리 첫 프레임/대사/재도전 확인 및 결과 기록.
- `git -c core.autocrlf=false diff --check`

## Commit Message

```text
fix(boss): 삼색이가 코기를 바라보고 승리 대화부터 기절한 모습으로 보이게 한다

Plan: 2026-10-13-world01-victory-dialogue-position
Phase: P01-victory-dialogue
Task: T02-calico-facing-collapse

- 코기의 좌우 위치에 맞춰 삼색이 방향을 갱신한다
- 첫 대사 전부터 기절 프레임을 유지하고 재도전 때 복원한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 1e4ef5a

## Execution Result

- [검증 기록](../../../test-plans/2026-10-13-calico-facing-collapse.md): 관련 자동11건·타입·lint 통과. 실제 브라우저 3개 전투 상태의 좌우/동일x, 투척 도중 반대편 이동, 자동/수동/건너뛰기 승리의 첫 대사 frame2, stopAttacks 반복, 재도전 초기화 통과. pageerror0건.
- `facePlayer()`로 방향을 통일하고 HP0 직전에도 갱신한다. `stopAttacks()`는 실제 보스 처치일 때 frame2를 유지한다. StageScene은 첫 대사 전에 기절 그림을 적용한다.
- T01 좌표 고정 유지(최대 변화0px), 보상/완료 각1회. 새 자산·저장 필드 없음. 요청 범위 밖 발견: 특이사항 없음.
