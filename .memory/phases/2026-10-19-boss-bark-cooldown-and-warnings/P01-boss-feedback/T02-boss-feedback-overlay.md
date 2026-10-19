# Task: T02 보스전 쿨타임 HUD와 옅은 빨간 경고 화면

## Status: pending

## Goal
보스전과 일반 장애물 구간 왼쪽 아래에 짖기의 실제 남은 쿨타임을 표시하고, 보스전의 사레·밥그릇 경고를 화면 중앙과 동일한 8% 빨간 배경으로 보여 준다. 코기·보스·강아지·공격을 계속 볼 수 있고 경고 중에도 기존 조작을 유지한다.

## Decision Summary
- [결정 기록](../../../decisions/2026-10-19-boss-bark-cooldown-and-warnings.md). T01에서 10000ms 쿨타임과 2500ms 경고 상태를 구현했다. UI에서 별도 타이머를 돌리지 않는다.
- 사레는 화면 효과뿐이며 이동 잠금·피해를 추가하지 않는다. 경고 문구는 아래와 같고, 배경은 두 종류 모두 정확히 같은 색·불투명도를 사용한다.

## Prerequisite contract (T01)
- `src/game/systems/bossFeedback.ts`는 다음 읽기 전용 타입을 내보낸다.
  ```typescript
  type BossWarningKind = "bark-third" | "bowl-alarm";
  interface BossWarningView { readonly kind: BossWarningKind; readonly sequence: number; }
  interface BossFeedbackSnapshot {
    readonly stageId: StageId;
    readonly active: boolean;
    readonly barkUnlocked: boolean;
    readonly barkRemainingMs: number;
    readonly barkCooldownMs: number;
    readonly warning: BossWarningView | null;
  }
  ```
- `GameEventBus`의 `boss-feedback-changed` payload는 `BossFeedbackSnapshot`이다. StageScene이 상태 변화와 0.1초 단위로 발행한다.
- 이름은 기존 계획과 같지만 `active`는 normal/boss의 플레이 상태를 모두 지원한다. 일반 구간에도 쿨타임을 표시하며 경고는 보스전에서만 발생한다.
- `barkRemainingMs`는 0 이상이며 전체 쿨타임은 10000ms다. warning은 최신 한 건뿐이다. pause의 inactive 알림에서는 내부 남은 시간을 보존하고 resume에서 다시 표시한다. death·victory·restart·shutdown에서 초기화한다.

## Implementation

### I01. 구독과 독립 오버레이
- Related Files:
  - `src/components/game/BossCombatOverlay.tsx` :: `BossCombatOverlay` — new
  - `src/components/game/GameShell.tsx` :: 렌더 구성 — modify
  - `src/components/game/Hud.tsx` :: 기존 상단 쿨다운 행 — modify
  - `src/game/input/keybindPresentation.ts` :: `formatKeybindLabel` — read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface BossCombatOverlayProps {
    readonly eventBus: GameEventBus;
    readonly stageId: StageId;
    readonly visible: boolean;
    readonly barkKeybind: string;
  }
  export function BossCombatOverlay(props: BossCombatOverlayProps): ReactElement | null;
  ```
- **Data & Schema Fields**: 로컬 React state는 `BossFeedbackSnapshot | null`, 초기값 null. 타이머·저장·game runtime 객체 복제는 추가하지 않는다.
- **Execution Flow / Logic**:
  1. `use client` 컴포넌트의 `useEffect([eventBus])`에서 `boss-feedback-changed`를 구독해 snapshot을 저장하고 `stage-started`에서는 null로 초기화한다. cleanup에서 두 구독을 해제한다.
  2. 이벤트 콜백에서 props.stageId를 캡처해 payload를 버리지 않는다. stage-started 직후 React props가 갱신되기 전에 오는 첫 snapshot을 잃을 수 있다. 렌더 시 `snapshot.stageId === stageId`를 검사한다.
  3. `!visible`, snapshot 없음, `!snapshot.active`, stageId 불일치면 null. 경고와 쿨타임이 모두 없는 경우에도 null을 반환할 수 있다.
  4. `GameShell`의 `.game-content-frame` 직접 자식으로 컴포넌트를 항상 마운트한다. JSX 순서는 PhaserGame보다 앞에 두어 초기 구독을 준비한다. 숨길 때 unmount하지 않고 `visible`을 false로 넘긴다.
  5. props: `stageId={activeStageId}`, `barkKeybind={progress.keybinds.bark}`, `visible={progressLoaded && introGateStep === "ready" && mode === "play" && !paused && !world02EntranceActive}`. 동작 중인 `eventBus`를 넘긴다.
  6. 기존 `GameOverlay`의 status 패널과 독립되어 경고·쿨타임이 작은 화면에서도 표시된다. 상단 `Hud`의 `<span><b>쿨다운</b>...</span>`은 제거한다. GameShell이 빈 map을 넘겨 만든 가짜 “준비”가 전 구간 공통 짖기 패널과 중복되지 않게 한다. Hud의 미사용activeCooldowns 계산과cooldowns 매개변수 구조 분해만 정리하고 기존props 타입/호출 계약은 유지해 GameOverlay 전체 API 변경으로 번지지 않게 한다. 다른 스킬 해금 표시는 유지한다.
- **Cooldown view**: snapshot `barkUnlocked`일 때 왼쪽 아래 패널. 제목 `짖기`와 `formatKeybindLabel(barkKeybind)`로 실제 지정 키를 표시한다. remaining > 0이면 `(Math.ceil(remaining / 100) / 10).toFixed(1) + "초"`, 0이면 `준비`. 폭 100% 막대의 준비 비율은 `clamp(1 - remaining / cooldown, 0, 1)`. 표시 숫자·막대는 전달된 데이터로만 계산한다.
- **Warning view**: 종류별 제목/본문 고정 매핑, 경고 sequence를 key로 써 같은 종류의 다음 경고도 새 표시로 처리한다. 아이콘은 `aria-hidden=true`인 작은 삼각형 느낌표 SVG를 제목 앞에 둔다. 경고 텍스트에 `role="status"`, `aria-live="polite"`, `aria-atomic=true`; 매 0.1초 바뀌는 숫자에는 aria-live를 넣지 않는다.

```text
bark-third
제목: 3연속 짖기 발동!
본문: 너무 세게 짖은 나머지 사레에 들리고 말았습니다!

bowl-alarm
제목: 밥그릇 소리 경보!
본문: 밥 소리인 줄 알고 동네 강아지들이 정모하러 왔습니다!
```

### I02. 게임을 가리지 않는 스타일
- Related Files:
  - `src/app/globals.css` :: `.boss-combat-overlay`, `.boss-bark-cooldown`, `.boss-warning` 계열 — modify

#### Details
- **Root**: `.boss-combat-overlay`는 `position:absolute; inset:0; z-index:6; pointer-events:none`. 게임 영역 `.game-content-frame` 내부에만 표시하며 페이지 전체를 덮지 않는다. 카메라 흔들림으로 DOM 텍스트를 흔들지 않는다.
- **Tint**: `.boss-warning` 또는 그 자식 배경 레이어 하나만 `position:absolute; inset:0; background:rgb(239 68 68 / 8%)`. 부모 opacity로 글자까지 흐리게 만들지 않는다. 다른 빨간 배경, 검정 딤, blur, 진한 카드 패널을 추가하지 않는다. 경고가 바뀌어도 이전 DOM 레이어가 남지 않도록 한 개만 렌더한다. 브라우저 조정은 0~10% 범위에서만 허용하고 기본값은 8%.
- **Text**: 화면 중앙 정렬, 제목/본문 두 블록, 너비 `min(90%, 760px)`, `text-align:center`, `word-break:keep-all`, `overflow-wrap:anywhere`. `Galmuri11Pixel` 글꼴, 제목 `clamp(16px, 3vw, 32px)`, 본문 `clamp(11px, 1.7vw, 20px)`, 줄간격 1.5. 밝은 글자 `#fff8e5`에 작은 어두운 외곽 그림자로 대비를 주고 문구 뒤의 넓은 판은 만들지 않는다. 기본 박스 높이는 두 텍스트가 필요한 크기만 차지한다.
- **Cooldown placement**: `position:absolute; left:16px; bottom:16px`, 좁은 화면 8px. 너비 약 150px, 최대 게임폭의 45%, 제목/숫자/얇은 막대. 기존 HUD와 비슷한 옅은 바탕·픽셀 테두리를 작은 패널에만 사용한다. 경고 배경보다 위에 둔다. 스크롤되는 `.hud-stats`나 모바일 display:none 규칙을 상속하지 않는다.
- **Interactions**: root와 자식 모두 pointer-events:none, focusable 요소 없음. 경고 때문에 keydown을 가로채거나 게임 pause를 호출하지 않는다. 기존 pause(z15)·death(z10)·월드 선택 위에 경고를 올리지 않는다.
- **Animation**: 문구의 반복 깜빡임이나 빨간 배경 펄스는 추가하지 않는다. 수명은 T01의 경고 상태로 제어한다. 강한 움직임은 T01의 게임 카메라 800ms 흔들림만 담당한다.

### I03. 실제 전투 통합 검증
- Related Files:
  - `.memory/test-plans/2026-10-19-boss-bark-cooldown-and-warnings.md` — new validation report
  - `.memory/test-plans/assets/2026-10-19-boss-feedback/` — new screenshots if browser tooling permits
  - `scripts/boss-feedback.test.mjs`, `scripts/bark-boss-stun.test.mjs`, `scripts/bowl-defense.test.mjs` — regression

#### Details
- 별도 브라우저 프로필에서 테스트 진행 상태를 만든다. `createDefaultProgressState()`(`src/game/core/constants.ts`) 기준으로 `onboardingCompleted=true`, `clearedStages=STAGE_IDS.slice(0,5)`, `unlockedSkills=["bark"]`, `selectedWorldId="world-01"`, `world01BossReplayActive=true`, `seenCutsceneIds=["intro-home","world-01-boss-intro"]`. `ProgressStore.save()`와 동일한 schemaVersion 2 envelope를 `legendary-rib-corgi:progress:v1`에 넣고 `/`을 새로고침하면 보스 재도전에 진입한다. 기존 사용자 저장은 변경하지 않는다.
- 실제 입력으로 짖기 1·2·3회 사용한다. 매 성공 직후 10.0초와 막대가 시작되고 10초 전에 재입력하면 변화·경고가 없어야 한다. 3회에서만 사레 문구·옅은 빨강·강한 흔들림이 나타나고 코기는 이동 가능해야 한다. 테스트 실행 시간을 줄이기 위해 단위 테스트는 가상 now를 사용하되, 브라우저에서는 최소 한 번 실제 10초를 확인한다.
- 6회에서도 재발동하는 것은 단위 테스트와 추가 브라우저 확인으로 검증한다. 범위 밖에서 짖어도 횟수는 증가하며 범위 안에서는 기존 삼색이 1.2초 경직이 동작한다.
- 쿨타임이 약 7초 남았을 때 일시정지하고 3초 후 재개한다. 약 7초가 유지되어야 한다. 경고 도중 pause하면 일시정지 화면에서 경고는 숨고, resume 후 남은 경고 시간만 재생한다. 흔들림은 pause 시 중단된다.
- 짖기 없이 생선 가시를 밥그릇으로 3회 방어한다. 첫 두 번에는 새 경고가 없고, 세 번째 강아지 소환 때 지정 문구와 동일한 배경을 한 번 표시한다. 개의 5마리·이동·제어 잠금/해제는 기존과 같아야 한다.
- 경고가 겹치는 상황은 이벤트/상태 주입으로 최신 경고 하나만 표시되는지 확인한다. computed background alpha가 0.08이고 0.16 등으로 합성되지 않아야 한다. 코기·삼색이·소환견·생선 가시가 경고 뒤에서도 식별되는 화면을 남긴다.
- 경고 도중 사망, 재도전, 승리 대사, 월드 선택 이동 후 이전 경고/카운터/쿨타임이 남지 않는지 확인한다. 새 도전에서는 준비 및 사용 횟수 0. 짖기 미해금 보스 진입은 쿨타임 패널이 숨고 밥그릇 경고는 동작해야 한다. 해금 후 일반 스테이지에는 쿨타임 패널을 표시하되 보스용 경고·흔들림은 발생하지 않아야 한다.
- 월드 선택으로 월드 1 일반 맵과 월드 2 첫 장애물 구간에 진입하여 동일한 쿨타임 패널, pause/resume, 키 설정 변경을 확인한다. 이미지·소리를 포함한 최종 검증은 T03에서 수행한다.
- 1280×720과 폭 390px 화면에서 왼쪽 아래 패널과 중앙 두 블록이 잘리지 않는지 확인한다. 사용자 설정으로 짖기 키를 바꾸면 키 라벨도 바뀌는지 확인한다.
- 화면·런타임 콘솔 오류, 검증 결과 및 실제 확인하지 못한 범위는 보고서에 기록한다. DOM에 이벤트만 주입한 결과를 실제 방어/짖기 입력 검증으로 보고하지 않는다.

## Acceptance Criteria
- [ ] 해금된 짖기의 남은 10초 쿨타임이 보스전·일반 장애물 구간 왼쪽 아래에 실제 값으로 표시된다.
- [ ] 두 경고의 제목·본문이 정확하고 공통 8% 빨간 배경을 사용한다.
- [ ] 코기·보스·강아지의 대치 상황이 보이며 경고 UI가 조작을 차단하지 않는다.
- [ ] 모바일에서도 표시되고 pause·death·victory·이동·재도전에서 상태가 맞는다.
- [ ] 이전 기능 회귀 테스트 및 타입·린트·빌드가 통과하며 검증 보고서를 남겼다.

## Validation
- `node --test scripts/boss-feedback.test.mjs scripts/bark-boss-stun.test.mjs scripts/bowl-defense.test.mjs scripts/world-selection.test.mjs scripts/world01-respawn.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js src/components/game/BossCombatOverlay.tsx src/components/game/GameShell.tsx src/components/game/Hud.tsx`
- `npm.cmd run build`
- `npm.cmd run dev -- --port 3000` — 이미 서버가 있으면 그 서버 사용. 위 브라우저 시나리오를 실행하고 검증 문서에 결과 저장.
- 실행 전 Next 클라이언트 컴포넌트 가이드는 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`에서 확인한다.

## Commit Message
```text
feat(ui): 보스전 짖기 쿨타임과 옅은 빨간 경고 표시

Plan: 2026-10-19-boss-bark-cooldown-and-warnings
Phase: P01-boss-feedback
Task: T02-boss-feedback-overlay

- 왼쪽 아래 짖기 쿨타임과 중앙 경고 문구 표시
- 전투가 보이는 공통 빨간 배경과 모바일·일시정지·재도전 검증
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
