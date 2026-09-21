# Task: T01 플레이어 물리·입력·점프·기본 애니메이션

## Status: done

## Goal

WASD·방향키와 Space만으로 코기를 정밀하게 이동·점프할 수 있는 Phaser Arcade Physics 플레이어 컨트롤러를 만들고, J/K/L 기본 입력과 재매핑 가능한 InputManager를 연결한다.

## Decision Summary

- 데스크톱 키보드만 지원하며 기본 이동은 WASD·방향키, 점프는 Space다.
- 고정된 2D 플랫폼 감각을 위해 PlayerTuning 상수로 속도·중력·점프·입력 버퍼를 중앙 관리한다.

## Implementation

### I01. 입력 매핑

- Related Files:
  - src/game/input/inputTypes.ts :: KeybindMap, InputSnapshot — new
  - src/game/input/InputManager.ts :: InputManager — new

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface KeybindMap {
    left: string[];
    right: string[];
    up: string[];
    down: string[];
    jump: string[];
    attack: string[];
    dash: string[];
    bark: string[];
    pause: string[];
  }

  export interface InputSnapshot {
    left: boolean;
    right: boolean;
    jumpPressed: boolean;
    jumpHeld: boolean;
    attackPressed: boolean;
    dashPressed: boolean;
    barkPressed: boolean;
    pausePressed: boolean;
  }

  export class InputManager {
    constructor(scene: Phaser.Scene, keybinds: KeybindMap);
    setKeybinds(keybinds: KeybindMap): void;
    getSnapshot(): InputSnapshot;
    destroy(): void;
  }
  ~~~
- 기본 keybinds는 left: [A, LEFT], right: [D, RIGHT], up: [W, UP], down: [S, DOWN], jump: [SPACE], attack: [J], dash: [K], bark: [L], pause: [ESC]다.
- 키 down edge와 held 상태를 분리한다. 브라우저 key repeat로 스킬이 여러 번 발동하지 않도록 jumpPressed, attackPressed 등은 프레임당 한 번만 true가 된다.

### I02. Arcade Physics 플레이어

- Related Files:
  - src/game/entities/Player.ts :: Player — new
  - src/game/entities/playerTypes.ts :: PlayerTuning, PlayerAnimationState — new
  - src/game/systems/PlayerController.ts :: PlayerController — new

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface PlayerTuning {
    runSpeed: number;        // 220
    acceleration: number;    // 1800
    deceleration: number;    // 2200
    gravityY: number;        // 1200
    jumpVelocity: number;    // -460
    maxFallSpeed: number;    // 900
    coyoteTimeMs: number;    // 80
    jumpBufferMs: number;    // 100
  }

  export class Player extends Phaser.Physics.Arcade.Sprite {
    readonly body: Phaser.Physics.Arcade.Body;
    setAnimationState(state: PlayerAnimationState): void;
    lockControl(reason: string): void;
    unlockControl(reason: string): void;
    resetTo(position: Phaser.Math.Vector2): void;
  }

  export class PlayerController {
    constructor(player: Player, input: InputManager, tuning: PlayerTuning);
    update(time: number, delta: number): void;
    setControlEnabled(enabled: boolean): void;
  }
  ~~~
- 플레이어 Arcade body는 rectangle hitbox를 사용하고, sprite artwork보다 작게 설정해 발끝과 몸통의 판정을 분리한다.
- 좌우 입력은 acceleration/deceleration을 사용하며, 입력이 없을 때 속도를 0으로 보간한다.
- 점프는 지상, coyote window, jump buffer 조건을 모두 검사한다. 이단 점프는 T02에서 skill flag가 있을 때만 허용한다.
- 낙사 경계는 stage runtime이 처리하므로 Player는 falling-out-of-bounds 이벤트만 발행한다.

### I03. 기본 애니메이션 상태

- Related Files:
  - src/game/entities/PlayerAnimator.ts :: PlayerAnimator — new

#### Details

- 상태는 idle, run, jump, fall, hurt, death, attack-slipper, attack-bite, dash, bark, double-jump, tail-rotor를 사용한다.
- 상태 전환은 physics body velocity와 PlayerActionState를 단일 입력으로 받고, 컷신 lock 중에는 자동 idle/컷신 프레임으로 전환한다.
- 애니메이션 key가 manifest에 없을 때는 오류를 발생시키고 투명 프레임으로 조용히 대체하지 않는다.

## Acceptance Criteria

+ [x] WASD와 방향키가 같은 이동 결과를 만든다.
+ [x] Space 점프, coyote window, jump buffer가 동작한다.
+ [x] J/K/L이 각각 attack/dash/bark edge event를 1회씩 발생시킨다.
+ [x] 플레이어가 바닥·플랫폼과 충돌하고, 대각선 이동이나 key repeat로 속도가 누적되지 않는다.
+ [x] 컨트롤 lock/unlock으로 컷신과 사망 연출 중 조작을 차단할 수 있다.

## Validation

- npm run lint — Player/Input 타입과 Phaser Arcade body 타입 통과
- npm run build — Client-only game code가 production build를 통과
- npm run dev — 이동·점프·입력 edge·컷신 lock을 수동 확인

## Commit Message

~~~text
feat(player): add keyboard controller and arcade movement

Plan: 2026-09-21-legendary-rib-corgi
Phase: P02-core-gameplay
Task: T01-player-controller-input

- Add remappable keyboard input manager
- Add tuned corgi movement, jump buffering and animation states
~~~

## Progress

+ [x] 구현 완료
+ [x] 검증 통과
+ commit: T01 commit recorded in git history
