# Task: T04 왼쪽 사모예드 무리와 부드러운 방패 타격음

## Status: done

## Goal

실제 방어마다 깡 소리가 한 번씩 들리고, 세 번째 방어에서 여러 사모예드가 화면 왼쪽 밖에서 달려와 코기를 가리도록 한다.

## Decision Summary

- 현재 `DefenseToolSystem.tryBlock`은 성공마다 `clang`, 마지막에는 `bowl-broken`→`drawback-triggered`를 발행한다. `StrayDogEvent`는 bowl-broken을 받아 surge를 한 번 발행한다. 이 순서를 재사용한다.
- `StageScene`에 AudioManager가 없어서 이벤트가 소리로 소비되지 않는다. 효과음 파일만 추가하거나 보스 충돌 메서드에서 별도 소리를 호출하지 않는다.
- 기존 제어잠금2200ms·개 무피해·비충돌·보스의 불이익 중 공격을 유지한다. 외형은 초기5마리, 각112×96, 왼쪽 진입650ms와70ms 시차,2200ms 후 잠금해제/300ms 퇴장이다.
- 구현 전에 로컬 Next 문서 `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`를 읽는다. 생성 에셋이 필요할 때만 `imagegen`을 적용한다.

## Implementation

### I01. 무리의 시간·좌표를 명시적인 상태로 표현

- Related Files:
  - `src/game/systems/StrayDogEvent.ts` :: constructor, `spawnSurge`; modify
  - `src/game/systems/samoyedSurge.ts` :: 시간 기반 위치 함수; new
  - `src/game/systems/World01CalicoBoss.ts` :: dogSprites, `spawnDogSurround`, `update`, `clearDogs`; modify
  - `src/game/scenes/StageScene.ts` :: StrayDogEvent 생성 옵션; modify
  - `public/assets/pixel/characters/world-01/stray-dog.png` :: 기존 흰 사모예드 그림; reuse

#### Details

- **Signatures & Types**:
  ```typescript
  // StrayDogEvent: 다른 소비자의 기존 기본값3을 유지하는 선택 옵션
  constructor(eventBus: GameplayEventBus,
    getOrigin?: () => { x: number; y: number }, options?: { count?: number });
  // 새 helper는 Phaser/DOM import 없이 작성
  export type SurgePhase = 'entering' | 'covering' | 'leaving' | 'done';
  export interface SamoyedPath {
    readonly id: string;
    readonly fromX: number;
    readonly targetX: number;
    readonly exitX: number;
    readonly floorY: number;
    readonly delayMs: number;
    readonly index: number;
  }
  export interface SamoyedSurge {
    readonly startedAtMs: number;
    readonly dogs: readonly SamoyedPath[];
  }
  export function createSamoyedSurge(
    origin: { x: number; floorY: number }, viewport: { left: number; right: number },
    startedAtMs: number, count?: number): SamoyedSurge;
  export function sampleSamoyedDog(path: SamoyedPath, elapsedMs: number): {
    x: number; y: number; phase: SurgePhase;
  };
  ```
- **Data & Schema Fields**: `count` 보스5, 기존 StrayDog 기본3. `StrayDogAlly.attacksEnemies=false,blocksPlayerRoute=true,collidesWithPlayer=false` 유지. `World01CalicoBoss` 새 `surge?:SamoyedSurge`, `dogSprites`는 id/image/path 연결 record로 확장. 저장 파일에는 추가하지 않는다.
- **Exact visual path**:
  - 트리거 시점 `camera.worldView.left/right`를 캡처한다. 월드x0을 왼쪽 화면 경계로 가정하지 않는다.
  - fromX=`left-64-index*76` (origin(0.5,1), 이미지 반폭56이 완전히 화면 밖). targetX=`player.x+(index-(count-1)/2)*32`; count5일 때 offset[-64,-32,0,32,64]. exitX=`right+64+index*76`.
  - floorY는 보스 지면512. 공중의 player.y를 바닥으로 사용하지 않는다. 각 개의 baseY는512, 달리는 동안만2px 이내 bob을 주고 covering 상태에는 안정화한다.
  - delay=index*70ms. local t=max(0,elapsedMs-delay)/650을0~1로 clamp해 fromX→targetX를 연속 보간한다. 아직 delay 전에는 화면 밖 원점에서 기다린다. 뒤늦게 생성해 시야 안에 나타나지 않는다.
  - 각자 도착하면 covering. 전체 elapsed2200부터300ms 동안 현재 targetX→exitX로 이동,2500에서done. 시작/도착/퇴장 경계 위치가 연속이어야 한다.
- **Execution Flow / Logic**:
  1. boss 전용 StrayDogEvent를 `{count:5}`로 생성한다. bowl-broken 이전1·2번째에는 surge가 없다. eventBus의 실제 count와 생성하는 sprite 수가 같아야 한다.
  2. `spawnDogSurround()`는 이미 surge 중이거나 defeated면 반환한다. 기존 `lockControl('bowl-stray-dog-blockade')`, velocityX=0, dogUntil=elapsed+2200을 유지한다. 기존 nextThrowAt=min(existing,elapsed+350)도 유지하여 불이익의 공격 규칙을 임의로 없애지 않는다.
  3. 기존처럼 dog.x/y를 코기 옆에 즉시 렌더링하지 않는다. helper 경로를 만들고 시작부터 화면 밖 위치에5개 생성, display112×96, depth=player.depth+4, alpha1, 실제 진행 방향으로 향하게 한다. 실제 개 그림의 불투명 영역이 코기의 몸통·머리를 겹쳐 가리는지 확인한다. 단일 큰 이미지로 무리를 대체하지 않는다.
  4. boss update의 로컬 elapsed(기존처럼 delta 최대50ms)를 기준으로 위치를 갱신한다. 별도 wall-clock timeout 또는 pause 중 계속 움직이는 Scene tween으로 생명주기를 나누지 않는다.
  5. elapsed2200에 제어잠금은 해제하고, sprite는 바로 destroy하지 않아300ms의 오른쪽 퇴장을 보여준다. 기존 `if(dogUntil && elapsed>=dogUntil) clearDogs()`를 이 분리 동작으로 교체한다. clearDogs는 죽음/승리/리셋/scene shutdown의 즉시 정리용으로 유지한다.
  6. 완료/중단 시 sprites, surge, dogUntil, domain dogs를 비우고 해당 control lock을 멱등 해제한다. 개 정리 때문에 다른 control lock을 지우거나 아직 유효한 피격 tint를 무조건 clear하지 않는다.
- **Error & State**: 재시작 후 지연 등장/중복 구독/제어 잠금 잔류가 없어야 한다. 무리는 적에게 피해를 주거나 물리 충돌로 코기를 밀지 않는다. 투명 여백으로 가림이 부족하면 여러 개의 크기/간격부터 조정한다. 기존 흰 개 아트를 재사용하고 판독 불가능할 경우에만 같은 캐릭터의 투명 달리기 에셋을 생성해 manifest에 등록한다.

### I02. 실제 스테이지의 오디오 소유자 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: audioManager 필드, create, boss cutscene 완료, shutdown; modify
  - `src/game/audio/AudioManager.ts` :: constructor, `unlock`, `isAudioReady`, `destroy`, `musicForStage`; modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: 외부 AudioManager 인자/컷신 완료 stopMusic; read-only unless ownership wiring requires adjustment
  - `src/game/core/events.ts` :: clang/bowl-broken/surge 계약; read-only

#### Details

- **Signatures & Types**: 기존 `new AudioManager(scene, gameplayBus?, gameBus?)`, `unlock():void`, `playSfx(key:string):void`, `destroy():void` 재사용. 새 `StageScene.audioManager?:AudioManager`는 삼색이 전투의 한 인스턴스다. 오디오 컨텍스트를 공유하면 `ownsAudioContext:boolean`(기본false)로 close 소유권을 명시한다.
- **Execution Flow / Logic**:
  1. StageScene의 gameplayEventBus 생성 이후, runtime.start() 이전에 월드1 boss인 경우 AudioManager를 한 번 생성해 gameplayEventBus와 실제 gameBus를 전달한다. 이 Task를 이유로 월드2~5 전체의 음향을 재설계하지 않는다.
  2. 같은 manager를 CutsceneDirector의 마지막 인자로 전달한다. constructor의 기존 clang→bowl-clang 구독을 사용하고 boss/visual에서 별도 playSfx를 호출하지 않는다. `eventUnsubscribers`와 audio destroy 소유권을 중복 등록하지 않는다.
  3. 이미 다른 화면에서 음원이 풀린 상태를 지원한다. Phaser WebAudioSoundManager의 running context를 사용할 수 있으면 공유하되 manager.destroy에서 공유 context를 닫지 않는다. 자체 context를 만들면 정상 입력 gesture에서 resume하고 자기 context만 닫는다. 자동재생 차단 시 예외 없이 대기하되 지난 방어음을 나중에 몰아서 재생하지 않는다.
  4. `scene.sound.locked`와 자체 AudioContext running 상태가 어긋나 첫 방어음이 누락되는지 실제로 확인한다. 브라우저가 허용한 running context 경로와 정상 pointerdown/keydown unlock 경로를 분리해 처리한다. 음원 미지원(NoAudio)에서는 게임 이벤트와 방어 횟수는 정상 진행한다.
  5. boss `stage-started` 음악 선택이 일반 alley 분기보다 먼저 boss를 고르게 한다. intro `cutscene-finished` 뒤 CutsceneDirector가 stopMusic했으므로 전투에 돌아갈 때 boss 음악을 재개한다. victory cutscene 뒤에는 전투 음악을 다시 시작하지 않는다. 이것은 SFX manager 연결 때문에 생기는 인접 회귀 방지다.
  6. shutdown에서 해당 manager.destroy/참조 해제, listener·진행/예약 source 정리. 재진입 후 한 clang이2번 이상 들리면 실패다. 기존 컷신 자동 진행이나 영상 종료 시점을 바꾸지 않는다.

### I03. 깡 음색과 세 번째 타격의 청취 우선순위

- Related Files:
  - `src/game/audio/AudioManager.ts` :: `playSfx`, 새 `playBowlClang`, `trackSource`, `stopSources`; modify
  - `src/game/audio/audioManifest.ts` :: 기존 `bowl-clang`, `stray-dog-rush` key; read-only
  - `src/game/systems/DefenseToolSystem.ts` :: tryBlock 이벤트 발행; preserve

#### Details

- **Signatures & Types**:
  ```typescript
  private playBowlClang(): void;
  // 기존 private playTone/trackSource/stopSources 계약 재사용
  ```
- **Synthesis starting values**: 짧은 금속 공명음을 Web Audio로 합성한다. sine partial frequency[720,1190,1820]Hz, peak gain[0.023,0.009,0.004], attack0.003초, exponential decay[0.18,0.13,0.07]초, 최종gain0.0001. 공통 lowpass 약2400Hz. 전체 길이220ms 이내. 극단적 주파수/클리핑 없이 작은 게임 음량에 어울리게 실제 청취로 조정한다. 전역 BGM/SFX volume은 올리지 않는다.
- **Execution Flow / Logic**:
  1. `playSfx('bowl-clang')`은 현재 `[880,660]` 두 square beep 대신 위 전용 합성으로 분기한다. 같은 키의 기본 패턴까지 함께 재생하지 않는다. 이 합성은 실제 소리를 만들므로 별도 wav 파일이 필수는 아니다.
  2. 세 성공 방어의 remainingCharges2/1/0마다 동일한 짧은 깡을1회 출력한다. sound를 눌러서 재생하는 별도 사용자 버튼은 요구하지 않는다. 실패방어/충돌 없음/4번째 피격에는 깡이 없다.
  3. 같은 순간의 stray-dog-rush 음은 시작을120ms 늦추고 gain을 낮춰 세 번째 clang의 attack을 덮지 않게 한다. WebAudio 시작 시간을 활용해 예약하고 activeSources에 추적한다. setTimeout의 잔여 콜백이 다음 Scene에서 울리게 하지 않는다.
  4. oscillator/source는 ended 후 disconnect하고 gain/filter도 해제한다. destroy/stopAll 시 예약 중인 source까지 정리한다. pause 중 이미 시작한220ms 이내 잔향은 끝나도 되지만 새 타격음을 만들지 않는다.
- **Error & State**: 오디오 context가 닫히거나 unavailable면 무음으로 반환하고 방어 이벤트 자체는 훼손하지 않는다. 시작하려던 소리를 무제한 큐에 쌓지 않는다.

### I04. 이벤트 횟수와 연속 이동의 행동 검증

- Related Files:
  - `scripts/bowl-defense.test.mjs` :: 실제 DefenseToolSystem/StrayDogEvent 이벤트 연동; new
  - `scripts/samoyed-surge.test.mjs` :: 순수 시간 샘플링 회귀; new
  - `.memory/test-plans/2026-10-12-world01-gameplay-refinement.md` :: 청취·가림·중단 기록; modify

#### Details

- defense 테스트는 실제 GameplayEventBus/DefenseToolSystem/StrayDogEvent를 사용한다. extensionless TS import는 기존 `scripts/world01-maps.mjs`의 TypeScript transpileModule+createRequire require.extensions 로더 방식으로 테스트 안에서 처리한다. production 코드를 테스트용 정규식으로 복사하지 않는다. 별도 라이브러리 설치가 필요 없다.
- weak3회→remaining[2,1,0]/clang정확히3/bowl-broken정확히1/surge정확히1/count5, weak4번째→blocked=false/추가clang없음, not-weak→차감없음, reset후 동일3회 반복, StrayDogEvent.destroy후구독해제를 검증한다. 동시에 발생하는3번째 이벤트 순서를 수집한다.
- surge 테스트는 순수 helper를 `node --experimental-strip-types`로 import한다. t=0에서 전부 view.left 밖, 첫/마지막 개 도착 전후 좌표 연속, 전체 도착t930에서 코기 중심을 덮는 목표분포, t2200/2500 퇴장 전후 연속, dt 분할과 무관한 같은 최종위치, 카메라left가0이 아닌 경우도 검증한다. 잘못된 count는 최소1의 유효 정수로 정규화하되 보스계약5는 데이터 검사에서 확인한다.
- 자동 테스트는 물리 이동/음향 체감의 대체가 아니다. 실제5마리 입장 동영상·코기 가림 스크린샷과 세 번째 깡의 청취를 따로 기록한다.

## Acceptance Criteria

- [x] 1·2번째 방어에는 무리가 없고 3번째에만5마리가 왼쪽 화면 밖에서 들어온다.
- [x] 여러 개의 불투명 사모예드가 코기의 몸과 머리를 겹쳐 가리며 등장/퇴장 경로가 연속이다.
- [x]2200ms에 제어가 풀리고 정상 퇴장, 죽음/승리/리셋에서는 즉시 정리된다.
- [x] 실제 방어마다 깡1회, 총3회 출력 및4번째 추가0을 녹음·이벤트로 확인했다. BGM과의 합성은 클리핑이 없다.
- [ ] 실제 스피커/이어폰에서 음색·음량 청취 — 환경에서 오디오 청취 입력을 지원하지 않아 미검증. 녹음 파일을 test-plans에 보존했다.
- [x] 세 번째 깡을 무리 소리가 덮지 않으며 재진입/잠금해제 후 중복·지연 몰아재생이 없다.
- [x] 일시정지 중 무리 위치·게임 타이머가 멈추고 재개 시 연속된다.

## Validation

- `node --experimental-strip-types --test scripts/bowl-defense.test.mjs scripts/samoyed-surge.test.mjs` — 이벤트/생명주기/경로 검증 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint` — 통과.
- `npm.cmd run dev` — 화면 왼쪽/중앙/오른쪽에서3회방어, 이동/점프 중3번째, 입장 중pause/resume, 무리 중death/victory, boss 재진입2회를 직접 확인한다.
- 데스크톱 스피커/이어폰과 모바일 가로뷰에서BGM 켠 실제 청취. 무음상태/최초gesture/이미unlocked 상태를 구분해 확인한다. 청취 불가능한 환경은 미검증으로 기록하고 완료 주장하지 않는다.

## Commit Message

```text
feat(world01): 방패 타격음과 왼쪽 사모예드 무리 연출 연결

Plan: 2026-10-12-world01-gameplay-refinement
Phase: P01-gameplay-refinement
Task: T04-samoyed-audio

- 세 번째 방어에서 사모예드 5마리가 달려와 코기를 가리도록 변경
- 방어 이벤트마다 부드러운 깡 소리를 한 번 재생
- 중단과 재진입 시 연출 및 오디오 자원을 정리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 본 Task 제목의 Git 커밋 참조
- 구현 및 자동/화면 검증 완료. 실기기 청취는 위 제한을 따른다.
- 화면 확인 후 사모예드 표시140×120, 좌우 padding78로 조정해 원본의 투명 여백을 보완했다. 5마리/간격32/시간 규칙은 유지했다.
