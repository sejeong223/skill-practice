# Task: T04 발레 점프 통합 회귀와 화면 검증

## Status: done

## Goal

완성된 발레 점프가 실제 플레이에서 한 바퀴 전신 회전으로 읽히고, 장애물 회피·공중 스킬·의상 교체·재시작에 회귀가 없는지 자동 검사와 화면 기록으로 확인한다.

## Decision Summary

- T01~T03의 산출물은 모두 같은 `112×128`, 8프레임, `y=99` 규격을 공유한다. 회전은 `600ms`, `75ms/프레임`이며 시각적 방향만 이륙 순간에 잠근다.
- 이번 Task는 필요한 회귀 검사와 검증 기록을 추가한다. 검증 중 결함이 나오면 원인 파일을 고치고 해당 검사를 다시 실행하되, 미연결 더블 점프 기능은 활성화하지 않는다.

## Implementation

### I01. 점프부터 착지까지의 통합 자동 검사

- Related Files:
  - `scripts/corgi-pirouette-integration.test.mjs` :: `PlayerController`·`PlayerAnimator`·`PlayerWearables` 결합 하네스 — new
  - `src/game/systems/PlayerController.ts` :: 점프 승인 이벤트 — read-only, 결함 확인 시 modify
  - `src/game/entities/PlayerAnimator.ts` :: 회전·스킬 표시 우선순위 — read-only, 결함 확인 시 modify
  - `src/game/entities/PlayerWearables.ts` :: 장신구/색칠 의상 프레임 동기화 — read-only, 결함 확인 시 modify
  - `src/game/systems/SkillSystem.ts` :: 더블 점프 이벤트 및 스킬 사용 계약 — read-only, 결함 확인 시 modify
  - `scripts/goodboy-wearables.test.mjs` :: 기존 외형 회귀 — read-only, 결함 확인 시 modify

#### Details

- **Signatures & Types**:
  ```typescript
  type IntegrationFrame = Readonly<{
    timeMs: number;
    jumpPressed: boolean;
    left: boolean;
    right: boolean;
    grounded: boolean;
    velocityY: number;
    equippedOutfitId: string | null;
    equippedAccessoryId: string | null;
  }>;
  // node:test 시나리오는 실제 PlayerController.update → PlayerAnimator.update → PlayerWearables.sync 순서를 사용.
  ```
- **Data & Schema Fields**:
  - 하네스의 물리 몸체는 기존 `width=72`, `height=40`, `offsetY=59`를 갖고 `blocked.down/touching.down`을 프레임별로 제어한다. 테스트의 기본 텍스처 키는 `corgi-run/bark/bite/pirouette/pirouette-mirror`다.
  - `600ms` 경계 프레임: `0→0`, `74→0`, `75→1`, `150→2`, `300→4`, `450→6`, `525→7`, `600→0`; `>600ms` 공중은 `0` 유지.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T03의 단위 테스트가 통과하고 T01·T02의 모든 PNG가 로드 가능한 상태여야 한다. 기존 `scripts/bite-presentation.test.mjs`, `scripts/bark-presentation.test.mjs`, `scripts/goodboy-wearables.test.mjs` 검사를 먼저 실행한다.
  2. Core Processing: (a) 허용된 일반 점프 1회만 시작 이벤트를 내고, 누른 채 재입력·단순 낙하·기믹 위로 튕김은 새 회전을 만들지 않는다. (b) 이륙 직후 `blocked.down`이 한 틱 남아도 회전이 유지된다. (c) 공중에서 `player.flipX`가 바뀌면 선택 시트가 반대로 바뀌지만 최종 그림 방향은 이륙 방향과 같다. (d) 공중 짖기·물기 사용 성공은 스킬 이벤트/쿨타임을 유지하고 회전 텍스처를 가리지 않는다. (e) 회전 중 의상·장신구 교체와 색칠 의상 갱신은 프레임을 보존한다. (f) 착지·조기 착지·`resetTo`·Scene 파괴는 잔여 회전/동적 텍스처를 정리한다. (g) 더블 점프 `SkillSystem.use`를 하네스에서 직접 호출하면 0프레임부터 다시 시작하지만 일반 스테이지 입력 경로는 늘어나지 않는다.
  3. Error & Exception Handling: 누락 텍스처는 플레이어가 보이지 않거나 충돌 몸체가 바뀌는 결과가 아니라 안전한 기본 표시로 복귀해야 한다. 테스트 하네스가 Phaser DOM 의존성 없이 동작하도록 필요한 scene 메서드만 명시적으로 mock한다.
  4. State Transition & Return: 통합 테스트가 1회 점프·회전·착지 전체와 기존 전투 방향을 검증한다.

### I02. 8방향 아트 접촉 시트와 실제 플레이 시각 검토

- Related Files:
  - `scripts/render-corgi-pirouette-review.mjs` :: 원본·의상·장신구 8프레임 접촉 시트 생성 — new
  - `.memory/test-plans/2026-10-28-corgi-ballet-pirouette-jump.md` :: 검증 결과·화면 관찰 기록 — new
  - `.memory/test-plans/assets/2026-10-28-corgi-pirouette-base.png` :: 기본 8각도 확대 접촉 시트 — new
  - `.memory/test-plans/assets/2026-10-28-corgi-pirouette-wardrobe.png` :: 의상 6종·장신구 5종 겹침 접촉 시트 — new
  - `public/assets/pixel/characters/corgi/corgi-pirouette.png` :: 회전 원본 — read-only, 결함 확인 시 modify
  - `public/assets/pixel/characters/corgi/equipment/*-pirouette.png` :: 착용 외형 — read-only, 결함 확인 시 modify

#### Details

- **Signatures & Types**:
  ```javascript
  // CLI: node scripts/render-corgi-pirouette-review.mjs
  // sharp nearest-neighbor 확대: 원본 프레임 112×128을 4배로 표시하고 0..7 각도를 표시.
  ```
- **Data & Schema Fields**:
  - 접촉 시트는 기본 8프레임과 11개 착용 변형(의상 5 + 색칠 의상 1 + 장신구 5)을 같은 배율로 비교한다. 장신구 5종은 기본 코기 위에 합성하되 게임에서는 기존 분리 레이어를 유지한다.
  - 검증 기록에는 실행 날짜·명령 결과, 기본/의상/장신구의 정면·옆·뒷모습, 안광 유무, 발 위치, 프레임 전환, 미실시 항목을 구분해 적는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: T01·T02 빌드 스크립트의 `--check`가 통과하고 모든 에셋이 현재 소스와 같아야 한다.
  2. Core Processing: 접촉 시트를 만든 뒤 기본 코기의 얼굴·몸통·네 발이 8각도 모두 새 전신인지, 옆→정면→뒤→옆으로 읽히는지, 의상이 각도별로 유지되는지 육안 검토한다. 로컬 게임을 실행해 월드 3을 포함한 일반 스테이지에서 점프 시작·정점·착지·좌우 역전·공중 짖기/물기·장애물 회피를 관찰한다. 가능하면 색칠 의상·장신구 장착 상태도 확인한다.
  3. Error & Exception Handling: 그림이 겹쳐 보임, 흰 안광, 정면/뒷면 누락, 한 프레임의 발 미끄러짐, 의상 소실이 보이면 원본 아트/UV/표시 코드의 해당 원인을 수정하고 접촉 시트 및 관련 테스트를 재실행한다. 실제 브라우저 확인이 불가능한 환경이면 그 사실과 자동 검사 범위를 검증 기록에 명시한다.
  4. State Transition & Return: 검증 결과와 재현 가능한 접촉 시트를 남긴다. 기능 외의 기존 미커밋 보스·HUD·월드 3 코드를 임의 정리하지 않는다.

## Acceptance Criteria

- [ ] 자동 통합 검사가 점프 입력 승인부터 착지/초기화까지 0.6초 회전과 `flipX` 전투 방향 보존을 확인한다.
- [ ] 접촉 시트에서 8개 전신 각도, 안광 없는 눈, 기존 코기 무늬, 모든 의상과 장신구의 위치가 육안으로 확인된다.
- [ ] 실제 일반 스테이지에서 점프 중 한 바퀴 회전 후 착지 복귀가 보이며, 장애물 회피용 점프 높이·충돌 몸체가 바뀌지 않는다.
- [ ] 검증 결과와 남은 시각 확인 한계를 `.memory/test-plans/2026-10-28-corgi-ballet-pirouette-jump.md`에 기록한다.

## Validation

- `node scripts/build-corgi-pirouette-sprites.mjs --check` — 기본·착용 자산이 원본과 일치한다.
- `node --test scripts/corgi-pirouette-art.test.mjs scripts/corgi-pirouette-wardrobe-art.test.mjs scripts/corgi-pirouette-presentation.test.mjs scripts/corgi-pirouette-integration.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/bite-skill.test.mjs scripts/bark-boss-stun.test.mjs` — 아트·런타임·스킬 회귀 통과.
- `node scripts/validate-assets.mjs` — 필수 이미지 경로 검증 통과.
- `npx tsc --noEmit` — 타입 검사 통과.
- `npm run lint` — 린트 통과.
- `npm run build` — Next.js 게임 번들 생성 성공.
- `node scripts/render-corgi-pirouette-review.mjs` — 기본/착용 외형 접촉 시트 생성 성공.

## Commit Message

```text
test(corgi): 발레 점프 통합 회귀와 화면 검증 기록

Plan: 2026-10-28-corgi-ballet-pirouette-jump
Phase: P01-ballet-pirouette-jump
Task: T04-pirouette-regression-qa

- 점프·회전·스킬·착지 통합 시나리오 검증
- 8방향 아트 접촉 시트와 실제 플레이 확인 기록
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (브라우저 점프 중간 프레임은 자동화 입력 한계로 미확인, 검증 기록 참조)
- commit: 이 태스크 커밋에 기록

## Worktree Guard

- 결함 수정이 필요한 경우 해당 기능 파일만 스테이징하고 이유를 검증 기록에 남긴다. 기존 미커밋 보스·HUD·월드 3 변경은 다른 작업으로 간주한다.
