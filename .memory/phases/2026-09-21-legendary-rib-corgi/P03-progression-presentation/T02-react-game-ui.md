# Task: T02 상점·캐릭터 상태 창·키 설정·HUD·프로필

## Status: pending

## Goal

Phaser 이벤트를 React UI로 연결해 스테이지 HUD, 안전 상점, 캐릭터 상태 창, 장비 교체, 스킬·부작용 기록, 누적 사망 통계, 키 재매핑을 제공한다.

## Decision Summary

- 상점은 각 스테이지 시작 전 안전 구역에만 열리고, 도구 교체는 살아 있는 상태의 캐릭터 상태 창에서만 가능하다.
- 상점 카드는 첫 발견 전에는 도구의 장점만 표시하고, drawback 발견 후 상태 창 기록에서 부작용을 공개한다.

## Implementation

### I01. React 게임 셸과 typed event bridge

- Related Files:
  - src/components/game/GameShell.tsx :: GameShell — new
  - src/components/game/GameEventBridge.tsx :: GameEventBridge — new
  - src/components/game/GameOverlay.tsx :: GameOverlay — new
  - src/game/bridge/GameEventBus.ts :: React subscription API — modify

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface GameShellProps {
    readonly initialStageId: StageId;
    readonly onExit?: () => void;
  }

  export function GameShell(props: GameShellProps): JSX.Element;
  ~~~
- GameShell은 PhaserGame과 GameOverlay를 같은 1280×720 logical root 안에 배치한다.
- GameEventBridge는 subscribe/unsubscribe를 effect cleanup에서 반드시 수행하고, Phaser scene이 destroy될 때 React state를 갱신하지 않는다.

### I02. HUD·상태 창·프로필

- Related Files:
  - src/components/game/Hud.tsx :: Hud — new
  - src/components/game/CharacterStatusPanel.tsx :: CharacterStatusPanel — new
  - src/components/game/ProfilePanel.tsx :: ProfilePanel — new
  - src/components/game/SkillList.tsx :: SkillList — new
  - src/components/game/ToolRecord.tsx :: ToolRecord — new
  - src/app/globals.css :: pixel UI styles — modify

#### Details

- HUD는 world/stage title, banked coins, current-stage coins, equipped attack/defense tool, active cooldowns, checkpoint state를 표시한다.
- CharacterStatusPanel은 equipped tool 변경, unlocked skill 설명, discovered drawbacks, total/world/stage death counts, collected items를 표시한다.
- ProfilePanel에서는 시작 시 playerName을 입력하고, 기본값은 코기다. 이름은 엔딩 대사에 escape-safe 텍스트로 전달한다.
- UI 텍스트는 pixel font 또는 시스템 fallback을 사용하고, 생성 이미지 안에 텍스트를 넣지 않는다.

### I03. 상점과 키 설정

- Related Files:
  - src/components/game/ShopPanel.tsx :: ShopPanel — new
  - src/components/game/KeybindPanel.tsx :: KeybindPanel — new
  - src/components/game/EquipmentSlot.tsx :: EquipmentSlot — new

#### Details

- ShopPanel은 모든 tool catalog를 보여주되 bankedCoins로 구매 가능 여부를 표시한다. 구매 비용은 bankedCoins에서만 차감한다.
- attack slot 1개와 defense slot 1개만 장착 가능하다. 방어 tool charges는 구매 후 새 stage 시작 시 초기화한다.
- 장비 교체는 GameEventBus의 equipment-change-requested를 통해 Phaser runtime에 전달하고, StageScene state가 play일 때만 적용한다. cutscene/death/paused 상태에서는 거부한다.
- KeybindPanel은 InputAction별 새 키를 한 개씩 받고, 동일 키 중복을 감지해 저장 전에 오류를 표시한다.

## Acceptance Criteria

- [ ] HUD가 current/banked coins를 섞지 않고 표시한다.
- [ ] 상태 창에서 공격·방어 장비를 교체할 수 있고, 컷신·사망 중 변경이 거부된다.
- [ ] 기본 이름 코기와 사용자가 입력한 이름이 엔딩 데이터에 반영된다.
- [ ] 누적 사망 횟수와 월드·스테이지별 통계가 표시된다.
- [ ] 상점 구매는 bankedCoins만 사용하고, 장비는 영구 보유된다.
- [ ] 키 재매핑이 game input manager와 localStorage에 반영된다.

## Validation

- npm run lint — React UI/event bridge 타입 통과
- npm run build — overlay CSS와 Client Component build 통과
- npm run dev — 상점·상태 창·프로필·키 설정을 수동 확인

## Commit Message

~~~text
feat(ui): add shop profile hud and settings overlays

Plan: 2026-09-21-legendary-rib-corgi
Phase: P03-progression-presentation
Task: T02-react-game-ui

- Add pixel-styled HUD, shop and character status panel
- Add equipment switching, death statistics and key remapping UI
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
