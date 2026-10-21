# Task: T02 출입 딸랑 효과음과 상점 전용 음악

## Status: done

## Goal

상점 입장·퇴장에 `딸랑~` 소리를 내고 주인과 어울리는 반복 BGM을 새로 만들며, 게임 음악이 겹치거나 재시작되지 않게 한다.

## Decision Summary

- `StageScene.setPaused(true)`가 `AudioManager`의 Tone 스테이지 음악 위치를 멈춘 상태로 보존한다. 상점 음악은 독립 `HTMLAudioElement`로 재생하여 스테이지 음악을 건드리지 않는다.
- 실제 음원 파일을 저장소에 넣는다. 상점 입장 버튼 클릭은 사용자 제스처이므로 오디오 시작을 그 handler에서 호출한다.

## Implementation

### I01. 새 음원 제작

- Related Files:
  - `public/assets/audio/goodboy-shop-loop.wav` :: 짧은 완전 반복 BGM; new
  - `public/assets/audio/goodboy-shop-bell.wav` :: 출입 공용 딸랑 효과음; new
  - `scripts/generate-goodboy-shop-audio.mjs` :: 음원 재현 가능한 생성 스크립트; new
  - `scripts/goodboy-shop-audio.test.mjs` :: WAV 포맷·길이·클리핑·반복 경계; new

#### Details

- **Data & Schema Fields**: BGM은 88 BPM, 4/4, 8마디 G장조, 32박(약 21.82초) 분량. 월드 1/2의 기존 멜로디를 재사용하지 않고 친근한 8비트 글로켄/마림바 계열의 짧은 원곡 선율·단순한 베이스·가벼운 화음을 작곡한다. 과도한 저음/시끄러운 리드 없이 대사 읽기를 방해하지 않는 수준으로 믹스한다. 파일은 44.1kHz 16-bit PCM WAV, 반복 시작/끝 파형을 0에 맞춰 클릭 노이즈 없이 루프한다. 벨은 밝은 2~3음 금속성 감쇠 약 0.8초, BGM보다 순간적으로만 조금 크게 들리게 한다.
- **Execution Flow / Logic**: `scripts/generate-goodboy-shop-audio.mjs`를 실행하면 동일한 WAV 결과를 재생성할 수 있어야 한다. 효과음과 BGM의 파형/지속시간을 테스트하고 헤드폰·스피커에서 실제 `딸랑`처럼 들리는지 청음한다. 합성 불가능한 가짜 텍스트/단순 UI 클릭음으로 대체하지 않는다.
- **Error & Exception Handling**: 무음/클리핑/루프 경계 팝/파일 누락을 테스트에서 검출한다.

### I02. 음악 재생 수명주기

- Related Files:
  - `src/game/audio/ShopAudioController.ts` :: 상점 HTML 오디오 소유자; new
  - `src/components/game/GameShell.tsx` :: `handleOpenShop`, `handleCloseShop`, unmount, tab visibility; modify
  - `src/game/audio/AudioManager.ts` :: 기존 `setPaused` 위치 보존 확인; read-only / 필요한 경우 최소 수정
  - `scripts/goodboy-shop-audio.test.mjs` :: play/pause/cleanup 단위 테스트; modify

#### Details

- **Signatures & Types**: `ShopAudioController.enter(): Promise<void>`, `exit(): Promise<void>`, `destroy(): void`; 내부에 BGM과 bell 각각 1개의 `HTMLAudioElement`를 소유한다. `enter()`는 벨 시작 + `loop=true` BGM 시작, `exit()`는 BGM pause/currentTime=0 + 벨 재시작, `destroy()`는 모두 pause하고 source/listener를 정리한다.
- **Execution Flow / Logic**: 입장 처리 순서는 `pause-requested true`로 기존 `AudioManager`를 정지 → 상점 BGM/벨 시작. 퇴장 처리 순서는 상점 BGM 정지 → 벨 시작 → `pause-requested false`로 기존 스테이지 음악을 이전 위치에서 재개. `shopOpen` 중 일반 게임 효과음도 정지 상태로 유지한다. 브라우저 탭이 숨겨지면 상점 BGM을 잠시 멈추고 돌아오면 상점이 열려 있을 때만 재개한다. 중복 클릭/StrictMode 재실행에서도 오디오 엘리먼트가 1개씩만 존재하도록 한다.
- **Error & Exception Handling**: 사용자 제스처 정책으로 `play()`가 거부되면 콘솔에 반복 오류를 내지 않고 상점 자체는 작동한다. 다음 사용자 상호작용에서 재시도한다. 무음/오디오 비지원 환경에서도 UI가 멈추지 않는다. 상점이 열린 채 스테이지 또는 React 컴포넌트가 종료되면 음악을 즉시 정리한다.

## Acceptance Criteria

- [ ] 들어갈 때와 나갈 때 실제 딸랑 벨이 들리고, 상점 안에서는 새 BGM만 반복된다.
- [ ] 월드 1 보스·월드 2에서 들어갔다 나와도 이전 스테이지 음악이 한 트랙만 같은 위치에서 재개된다.
- [ ] 반복 출입, 초기화, 탭 숨김/복귀, 컴포넌트 종료 후에도 음원이 겹치거나 남지 않는다.

## Validation

- `node --test scripts/goodboy-shop-audio.test.mjs scripts/audio-pause.test.mjs` — 음원과 재생 수명주기.
- `npx tsc --noEmit && npm run lint && npm run build` — 프로젝트 통과.
- 브라우저에서 연속 입출입 3회와 월드 1/2 음악 복귀를 실제 소리로 듣고 기록한다.

## Commit Message

```text
feat(상점): 출입 벨과 굿보이 마켓 전용 음악 추가

Plan: 2026-10-20-goodboy-market
Phase: P04-shop-experience
Task: T02-shop-audio

- 딸랑 효과음과 반복 가능한 상점 음악 제작
- 월드 음악 일시정지와 상점 음악 수명주기 분리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (오디오·일시정지 테스트, 타입·린트, 월드 1·2 브라우저 3회 출입; 빌드는 T03에서 재확인)
- commit: pending
