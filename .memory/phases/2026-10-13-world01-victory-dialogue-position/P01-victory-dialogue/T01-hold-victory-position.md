# Task: T01 전투 종료 위치에서 승리 대화 진행

## Status: done

## Goal

월드1 삼색이 전투의 마지막 타격 순간 코기가 있던 위치에서 대화를 진행한다. 첫 대사부터 클리어 화면 전환까지 코기가 움직이거나 시작점으로 돌아가지 않는다.

## Decision Summary

- 기존 코드에 승리 후 시작점 복귀 호출은 없다. 컷신에서 조작만 막고 이동 속도/물리는 멈추지 않아 이전 속도가 남는다. 현재 위치를 보존한 채 코기만 물리 처리에서 제외한다.
- 대사/카메라/장면 타이머는 계속 실행한다. 공중 승리도 당시 x/y를 유지한다. 보스 도입과 패배 부활에는 이 정지 처리를 적용하지 않는다.
- 후속 T02가 삼색이 방향과 기절 이미지 시점을 수정한다. T01에서는 코기 위치 정지에 집중하며 T02 완료 후에는 대사 첫 프레임부터 삼색이 frame2가 보여야 한다. 마지막 대사의 frame2 확인만으로 최종 계획을 완료 처리하지 않는다.

## Implementation

### I01. 승리 대화 시작 전 코기 정지

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `handleCalicoDefeat`, 새 `holdPlayerForVictoryDialogue`, `update` — 승리 확정 순간 정지하고 해당 프레임 게임플레이를 중단; modify.
  - `src/game/entities/Player.ts` :: `lockControl`, `setAnimationState`, `resetTo` — 위치/물리/애니메이션 구조 확인; read-only.
  - `src/game/entities/PlayerAnimator.ts` :: `update`, `stopSlipperSwing` — 대기 자세로 전환하고 남은 공격 그림 제거; read-only.
  - `src/game/systems/World01CalicoBoss.ts` :: `acceptMeleeHit`, `stopAttacks`, `isDefeated` — HP0에서 동기적으로 승리 콜백이 실행됨; read-only.

#### Details

- **Signatures & Types**:

  ```typescript
  // StageScene에 추가
  private holdPlayerForVictoryDialogue(): void;
  // 기존 시그니처 유지
  private async handleCalicoDefeat(): Promise<void>;
  public update(time: number, delta: number): void;
  ```

- **Data & Schema Fields**:
  - 기존 `player?: Player`, `playerAnimator?: PlayerAnimator`, `victorySequenceStarted: boolean`, `runtime?: StageRuntime`를 사용한다. 새 저장 필드와 DTO는 추가하지 않는다.
  - 고정할 위치는 승리 진입 시 `player.x: number`, `player.y: number`의 현재 월드 좌표다. `flipX: boolean`도 유지한다. 프레임마다 좌표를 덮어쓸 별도 상태는 불필요하다.
  - 코기 `body.enable`만 false로 전환한다. GameObject의 `active`와 `visible`은 유지한다. 새 StageScene/Player 생성 시 기존 생성자의 기본 물리 활성화가 적용된다.

- **Execution Flow / Logic**:
  1. Precondition & Validation: `handleCalicoDefeat`의 `victorySequenceStarted || !calicoBoss?.isDefeated()` 방어를 그대로 사용한다. 이 메서드는 월드1 보스 HP0 승리 콜백에서만 호출된다. 새 정지 메서드는 player가 없으면 반환한다.
  2. Core Processing:
     - 기존 순서대로 `victorySequenceStarted = true`, 보스 `stopAttacks()`, runtime `cutscene` 상태 전환을 수행한다.
     - **`cutsceneDirector.play("world-01-boss-clear")` 호출 전에** `holdPlayerForVictoryDialogue()`를 실행한다. 첫 `cutscene-started`/`cutscene-beat` 이벤트가 이미 정지한 캐릭터를 보도록 해야 한다.
     - helper는 `player.disableBody(false, false)`로 코기의 Arcade body 속도를 멈추고 물리를 비활성화한다. false/false는 코기 GameObject의 활성/표시를 유지한다. 필요 시 확인할 설치 소스: `node_modules/phaser/src/physics/arcade/components/Enable.js`의 `disableBody` 및 `Body.js`의 `stop`.
     - `player.setAnimationState("idle")`, `playerAnimator?.stopSlipperSwing()`, `playerAnimator?.update(this.time.now)`로 달리기 반복과 잔여 슬리퍼 공격 이미지를 정리한다. 기존 idle 처리에서 발 anchor가 맞춰지며 월드 x/y는 바꾸지 않는다. `bowlShieldVisual?.update(0, false)`로 전투용 표시도 첫 대사 전에 정리한다.
     - `player.resetTo(stage.spawn)`/체크포인트 복원/고정 좌표 이동/tween은 추가하지 않는다. 임의 착지, facing 강제 변경, 이미지 크기/카메라 줌 변경도 추가하지 않는다.
     - `StageScene.update()`의 `calicoBoss.acceptMeleeHit(...)` 뒤에 이미 있는 `runtime.getStatus() !== "play"` 분기에서 `stopSlipperSwing()` 뒤 즉시 `return`한다. 같은 마지막 공격 프레임에서 나머지 boss/animator/gimmick/mapInteraction 업데이트가 계속 실행되지 않게 한다.
  3. Error & Exception Handling:
     - optional player/animator/director 처리와 기존 씬 활성/보스 처치 확인을 보존한다. 존재하지 않는 캐릭터를 spawn 지점으로 새로 만드는 fallback은 추가하지 않는다.
     - 씬 종료 시 기존 shutdown이 player/animator를 정리한다. 승리 후 대화 완료/건너뛰기에서는 이전 body를 다시 활성화하지 않는다. 해당 메서드의 다음 동작이 클리어 씬 전환이므로 재활성화하면 마지막 한 프레임에 중력/이동이 재개될 수 있다.
  4. State Transition & Return:
     - `play → HP0 → 코기 정지 + cutscene → 짖기 보상 → runtime.complete() → World01StageClearScene` 흐름을 유지한다.
     - 컷신 완료 후 `CutsceneDirector.finish()`의 입력 잠금 해제와 카메라 복귀는 기존 동작이며, 코기 물리는 클리어 씬으로 나갈 때까지 정지한다.
     - 재시작/다음 월드는 새 Player가 생성되므로 이동·점프·중력이 정상이어야 한다. 보스 패배 후4단계 깃발 복귀는 수정하지 않는다.

### I02. 기존 대사와 카메라 흐름 보존 및 실제 위치 회귀 검증

- Related Files:
  - `src/game/cutscenes/CutsceneDirector.ts` :: `play`, `handleBeat`, `finish`, `skip` — 공용 컷신 수정 없이 기존 흐름 검증; read-only.
  - `src/game/cutscenes/CutsceneTimeline.ts` :: 자동/수동 진행 — 기존 타이머 유지; read-only.
  - `src/game/camera/CameraDirector.ts` :: `focusDialogue`, `endCutscene` — 카메라 이동과 코기의 실제 월드 이동 구분; read-only.
  - `src/game/data/cutscenes/worlds.ts` :: `world-01-boss-clear` 8개 대사 — 내용·순서/기절 연출 유지; read-only.
  - `scripts/cutscene-auto-advance.test.mjs`, `scripts/calico-melee-hitbox.test.mjs`, `scripts/death-system.test.mjs` — 인접 동작 검증; read-only.
  - `.memory/test-plans/2026-10-13-world01-victory-dialogue-position.md` 및 `assets/world01-victory-dialogue-position.json` — 구현 후 실제 검증 기록; new.

#### Details

- 정적 코드 검사만으로 이동 정지를 증명하지 않는다. 실제 Chromium/Phaser에서 마지막 타격 전·첫 대사 이벤트·대화 중·종료 직전의 월드 x/y, body.enable/velocity, animationState, camera.scrollX/zoom을 기록한다.
- 준비: 새 브라우저 저장 컨텍스트에서 onboarding을 완료하고 `seenCutsceneIds`에 `intro-home`, `world-01-boss-intro`만 넣는다. `StageScene`을 `world-01-stage-boss`로 시작하고 runtime play를 기다린다. 기존 로컬 테스트 helper `.git/refinement-tools/browser.cjs`의 setup/restart를 사용할 수 있으며, 없으면 동일한 별도 컨텍스트를 구성한다. 테스트 중 사용자 실제 저장은 변경하지 않는다.
- 재현은 실제 `acceptMeleeHit`가 `handleCalicoDefeat`를 호출하는 경로를 거친다. 테스트 fixture에서 보스 HP를1로 두고 코기를 좌측 근접 위치(x약1200, 보스x1280) 또는 우측 근접 위치(x약1350, flipX=true)에 놓은 뒤 이동키를 누른 채 J 공격으로 마무리한다. `cutscene-started` 이벤트의 좌표를 고정 기준으로 삼고 이벤트 이전 좌표와도 비교한다. fixture가 공격 reach를 벗어나면 승리 성립 여부부터 확인한다.
- 필수 시나리오:
  1. 왼쪽에서 오른쪽으로 이동하며 마지막 타격, 오른쪽에서 왼쪽으로 이동하며 마지막 타격. 시작점x160이나 별도 좌표로 이동하지 않고, 첫 대사 이후 최소3초간 최대 x/y변화0.5px 이하.
  2. 공중 마지막 타격(보스와 몸체 높이가 근접 사정거리 안인 점프 초반). 대화 중 낙하/자동 착지 없이 진입 x/y 유지.
  3. 이동/점프/공격 입력을 유지해도 대화 중 위치와 idle 상태가 유지된다. GameObject는 active/visible이고, body는 disabled, velocity0이다. 달리기 반복과 슬리퍼 공격 그림이 남지 않는다.
  4. 코기/삼색이 화자 전환으로 camera.scrollX는 변할 수 있지만 actor 월드 좌표는 바뀌지 않는다. 줌1과 맵 경계 유지. T01 단독 검증 시 기존 마지막 기절 frame2 확인; T02 통합 이후에는 첫 대사부터 frame2 유지 확인.
  5. 자동으로8개 대사가 완료되어 클리어 씬에 도달하는 경우1회. 별도로 클릭/Space/Enter 수동 진행 확인(타임라인 연속 입력 제한120ms 고려). 이미 본 컷신은 건너뛰기해도 보상/완료가 한 번만 발생한다. 처음 본 컷신의 skip 정책은 바꾸지 않는다.
  6. 승리 대화 중 씬 종료 후 새 보스/일반 StageScene을 시작하면 새 player.body.enable=true이며 이동/점프 정상. 보스 도입 대사·기존 패배 후 깃발 복귀도 정상. 승리 대화로 데드 카운트가 늘지 않는다.
- 숫자 기록과 브라우저 오류0건을 검증 기록에 남긴다. 이 작업은 승리 시 정지라는 하나의 동작이므로 구현을 그대로 따라 하는 단위 테스트를 불필요하게 추가하지 않는다. 기존 자동 테스트와 실제 물리 회귀 결과를 함께 사용한다.

## Acceptance Criteria

- [x] 마지막 공격 직후 첫 대사부터 코기는 전투 종료 x/y에 머문다. 시작점/체크포인트로 이동하지 않는다.
- [x] 지상 이동·공중 승리와 대화 중 입력에서도 위치와 대기 자세가 유지된다.
- [x] 화자별 카메라, 자동/수동 진행, 재시청 건너뛰기, 기절·보상·클리어 흐름이 정상이다.
- [x] 새 씬의 물리가 정상이고 도입/패배 부활·최근 사망 반복/맵 끝 수정에 영향이 없다.

## Validation

- `$testFiles = @(rg --files scripts -g '*.test.mjs'); node --experimental-strip-types --test @testFiles` — 기존 자동47건 포함 모두 통과.
- `npx.cmd tsc --noEmit` — 타입 오류0.
- `npm.cmd run lint` — lint 오류0.
- `npm.cmd run build` — 프로덕션 빌드 성공.
- 위 실제 브라우저 시나리오와 좌표 비교 — 대화 중 월드 좌표 최대 변화0.5px 이하, 클리어/보상1회, 오류0.
- `git -c core.autocrlf=false diff --check` — 공백 오류0.

## Commit Message

```text
fix(cutscene): 삼색이 승리 대화를 전투가 끝난 위치에서 진행한다

Plan: 2026-10-13-world01-victory-dialogue-position
Phase: P01-victory-dialogue
Task: T01-hold-victory-position

- 첫 대사 전에 코기의 물리 이동과 달리기·공격 연출을 멈춘다
- 화자 카메라와 보상 흐름을 유지하고 실제 좌표 고정을 검증한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: bcf8229

## Execution Result

- [검증 기록](../../../test-plans/2026-10-13-world01-victory-dialogue-position.md): 자동47건·타입·lint·빌드 통과. 실제 Chromium 지상 좌우/공중 승리에서 좌표 변화0px, 자동/수동/건너뛰기와 씬 재진입·패배 복귀 통과. pageerror0건.
- `disableBody(false, false)`는 표시/활성을 유지하며 물리만 멈춘다. 첫 대사 이전에 호출하고, 마지막 공격 프레임의 나머지 업데이트를 반환하여 애니메이션이 덮어써지지 않게 했다.
- 승리 대화 후 기존 body를 재활성화하지 않는다. 다음 씬의 새 Player가 정상 물리로 시작한다. 요청 범위 밖 발견: 특이사항 없음.
