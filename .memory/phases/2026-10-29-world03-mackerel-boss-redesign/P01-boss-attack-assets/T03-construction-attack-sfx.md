# Task: T03 세 공격 준비 효과음

## Status: done

## Goal

벽돌 접촉·금속 흙손 긁기·젖은 시멘트 뜨기 세 가지를 실제 녹음에 가까운 짧은 효과음으로 준비하고, 보스 전투 시작 전에 해독해 즉시 재생 가능한 오디오 키로 등록한다.

## Decision Summary

- 사용자 선택은 합성 신호음이 아닌 실제 공사장 Foley 기반 소리다. 세 효과음은 각 0.3초 준비 동작 안에 첫 타격이 들리고 서로 구별돼야 한다.
- 소리 재생 타이밍은 P02-T02에서 전투 패턴에 연결한다. 이 Task는 파일·출처·프리로드 계약을 완결한다.

## Implementation

### I01. 녹음 원본·가공·출처

- Related Files:
  - `art/source/world03-boss-brick-cc0.wav` :: 벽돌 접촉 원본 클립 — new
  - `art/source/world03-boss-trowel-cc0.wav` :: 금속 흙손 긁힘 원본 클립 — new
  - `art/source/world03-boss-cement-cc0.wav` :: 젖은 시멘트 원본 클립 — new
  - `scripts/generate-world03-boss-attack-sfx.mjs` :: 원본 절취·필터·정규화·검증 — new
  - `public/assets/audio/world-03-boss-brick.wav` :: 출력 — new
  - `public/assets/audio/world-03-boss-trowel.wav` :: 출력 — new
  - `public/assets/audio/world-03-boss-cement.wav` :: 출력 — new
  - `public/assets/audio/ATTRIBUTION.md` :: 세 원본 URL·저작자·라이선스·절취 구간·변환 기록 — modify
  - `scripts/world03-boss-attack-audio.test.mjs` :: WAV 헤더·길이·출처·재생 경로 — new

#### Details

- **Signatures & Types**:
  ```text
  output: mono PCM16 WAV, 44_100 Hz, each 0.12–0.30 s
  keys: world-03-boss-brick, world-03-boss-trowel, world-03-boss-cement
  ```
- **Data & Schema Fields**: 각 녹음은 CC0 또는 프로젝트에 영구 재배포가 허용된 실제 샘플만 사용한다. ATTRIBUTION에는 개별 원본 URL, 저작자, 라이선스 링크, 원본 시간 범위, 필터/게인/페이드, 출력 파일명과 생성 명령을 기록한다. 파일명은 위 경로로 고정한다.
- **Execution Flow / Logic**:
  1. Precondition: 세 재질에 맞는 실제 녹음을 확보하고 라이선스·다운로드 가능성을 확인한다. 기존 철근 충돌음 하나를 복제해 세 종류로 사용하지 않는다.
  2. Core: 소리의 첫 충격을 파일 시작 10ms 이내에 놓고 긴 잔향을 자른다. 벽돌은 짧고 낮은 단단한 접촉, 흙손은 날카로운 금속 긁힘, 시멘트는 낮고 젖은 덩어리 질감으로 각각 다듬는다. `--check`로 결정적 출력 검증을 지원한다.
  3. Error handling: 출처 권한이 불명확하거나 원본을 구할 수 없는 경우 임의 합성음으로 대체해 완료 처리하지 않는다. 원본/출력 불일치와 클리핑은 실패한다.
  4. State/return: 세 WAV를 필수 준비 효과음으로 프리로드하고 `AudioManager` 생성 시 선해독한다. 재생·일시정지·장면 종료의 기존 오디오 수명 주기를 따른다.

### I02. 오디오 키와 선해독

- Related Files:
  - `src/game/audio/audioManifest.ts` :: `SOUND_KEYS`, `FeedbackSoundKey`, `FEEDBACK_AUDIO` — modify
  - `src/game/audio/AudioManager.ts` :: 생성자 `prepareFeedbackSound` 목록 — modify
  - `src/game/scenes/PreloadScene.ts` :: `FEEDBACK_AUDIO` 자동 binary 로더 — read-only
  - `scripts/audio-pause.test.mjs` :: 새 키 해독·일시정지·종료 회귀 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type FeedbackSoundKey = /* existing keys */ |
    "world-03-boss-brick" | "world-03-boss-trowel" | "world-03-boss-cement";
  AudioManager.playSfx(key: string): void;
  ```
- **Data & Schema Fields**: `FEEDBACK_AUDIO`에 `feedback-world-03-boss-*` cacheKey, `/assets/audio/world-03-boss-*.wav` URL, 낮은 배경음악 아래에서도 들리는 서로 균형 잡힌 gain을 설정한다. `duckMusic:false`로 짧은 준비음이 음악을 과하게 끊지 않게 한다.
- **Execution Flow / Logic**: `PreloadScene`은 `FEEDBACK_AUDIO` 전체를 binary로 로드하므로 별도 로더 분기를 추가하지 않는다. `AudioManager` 선해독과 기존 `playSfx` 경로를 사용하고, 정지/파괴 뒤 비동기 소리가 늦게 재생되지 않는지 기존 테스트를 확장한다.

## Acceptance Criteria

- [x] 세 소리가 실제 재질의 서로 다른 녹음에서 왔고 0.3초 이내·피크 0.82 이하이며 10ms 이내에 시작한다. 실제 청음은 통합 검증에 남긴다.
- [x] 출처와 사용권 및 재현 가능한 변환 절차가 파일마다 기록된다.
- [x] 첫 공격 준비부터 소리 파일이 로드·해독 가능하며 일시정지와 장면 종료 뒤 늦게 나오지 않는다.

## Validation

- `node scripts/generate-world03-boss-attack-sfx.mjs --check` — 원본 대비 출력 결정성.
- `node --experimental-strip-types --test scripts/world03-boss-attack-audio.test.mjs scripts/audio-pause.test.mjs` — WAV/출처/오디오 수명 회귀 통과.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 타입·정적 검사 통과.
- 실제 스피커/헤드폰 청음 — 세 종류 식별·0.3초 준비와 길이 확인; 못 하면 미검증으로 기록.

## Commit Message

```text
feat(월드3): 벽돌 흙손 시멘트 준비 효과음 제작

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P01-boss-attack-assets
Task: T03-construction-attack-sfx

- 실제 녹음 기반 세 짧은 효과음과 사용 출처 기록
- 오디오 키·프리로드·일시정지 검증 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 결정적 출력, 19개 오디오 테스트, 타입 검사, lint. 실제 청음은 미검증으로 통합 Task에 이월.
- commit: 이 Task의 Git 커밋
