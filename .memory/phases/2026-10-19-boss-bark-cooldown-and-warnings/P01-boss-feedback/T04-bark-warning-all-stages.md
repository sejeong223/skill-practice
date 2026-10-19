# Task: T04 장애물 구간에도 세 번째 짖기 경고 적용

## Status: done

## Goal
사용자의 후속 답변에 따라 보스전과 일반 장애물 구간 모두 성공한 짖기 3·6·9회마다 같은 경고·흔들림을 표시한다.

## Decision Summary
- 이전 보스전 전용 기본값을 사용자 답변으로 대체한다. 10초 쿨타임, 시각 효과만인 사레, 8% 배경·2500ms 경고·800ms/0.035 흔들림을 공통 적용한다.
- 기존 도전 단위 카운트와 사망/장면 이동 초기화는 유지한다. 밥그릇 경고는 기존 실제 소환 이벤트에 연결된 범위를 유지한다.

## Implementation

### I01. 성공한 사용 공통 처리
- Related Files:
  - `src/game/scenes/StageScene.ts` :: `update(time: number, delta: number): void` — modify
  - `src/game/systems/bossFeedback.ts` :: `BossFeedbackController.recordBarkUse(): boolean` — read-only
  - `src/components/game/BossCombatOverlay.tsx` — read-only
- `SkillSystem.use("bark", skillElapsedMs)`의 accepted 분기 안에서 경고 카운트를 제한하던 `stageDefinition.kind === "boss"` 조건을 제거한다. 전환 중/패배 후 가드 및 `recordBarkUse()`가 true일 때만 shake하는 계약은 유지한다.
- 새 스키마·저장 필드·타이머는 없다. 일반 구간도 이미 snapshot을 발행하고 Overlay를 표시하므로 별도 UI를 만들지 않는다.
- 잠금/쿨타임 실패는 세지 않는다. 일반 적의 새로운 피해·경직 효과는 추가하지 않는다.

### I02. 검증
- Related Files:
  - `scripts/boss-feedback.test.mjs`, `scripts/bark-boss-stun.test.mjs`, `scripts/bowl-defense.test.mjs` — existing regression
  - `.memory/test-plans/2026-10-19-boss-bark-cooldown-and-warnings.md` — append evidence
- 별도 Chrome 저장 상태로 월드1 일반과 월드2 일반에 진입해 실제 짖기 키 입력을6회 수행한다. 대기 시간은 테스트용 플레이 시계 전진으로 줄이되, use/입력/경고/카메라는 실제 구현을 사용한다.
- 1·2·4·5번째에는 경고와 흔들림이 없고, 3·6번째에는 경고 한 개·alpha0.08·카메라 흔들림을 확인한다. 쿨타임 중 재입력은 횟수를 증가시키지 않는다. 장면 이동 후 첫 사용부터 새로 센다.
- 보스전/밥그릇 기존 단위 테스트를 유지하고 타입·린트·빌드 확인 후 한국어 커밋한다.

## Acceptance Criteria
- [x] 보스 종류 조건 없이 성공한 사용3회마다 공통 경고와 흔들림이 발생한다.
- [x] 월드1·월드2 일반 구간의3·6번째 실제 입력을 브라우저에서 확인했다.
- [x] 기존 쿨타임·밥그릇·보스 경직 회귀 검증이 통과한다.

## Validation
- `node --test scripts/boss-feedback.test.mjs scripts/bark-boss-stun.test.mjs scripts/bowl-defense.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js src/game/scenes/StageScene.ts`
- `npm.cmd run build`
- 별도 headless Chrome에서 위 일반 구간 시나리오 실행, 사용자 저장 보존.

## Commit Message
```text
feat(game): 장애물 구간에도 세 번째 짖기 경고와 흔들림 적용

Plan: 2026-10-19-boss-bark-cooldown-and-warnings
Phase: P01-boss-feedback
Task: T04-bark-warning-all-stages

- 사용자 후속 답변에 따라 짖기 경고를 모든 플레이 구간에 적용
- 일반 맵의 세 번째·여섯 번째 사용과 기존 전투 동작 검증
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in git history
