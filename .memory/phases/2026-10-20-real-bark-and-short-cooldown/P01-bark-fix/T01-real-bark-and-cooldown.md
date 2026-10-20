# Task: T01 실제 단발 짖음과 3초 쿨타임

## Status: done

## Goal

해금한 짖기를 누르면 개의 실제 짧은 짖음이 한 번 들리고, 3초 후에 다시 사용할 수 있다. 세 번째 성공한 짖기 경고도 새 시간에 맞춰 발생한다.

## Decision Summary

- 실제 개 짖음 녹음을 PCM16/모노 WAV로 변환하여 기존 Web Audio 경로에서 재생한다.
- 쿨타임의 단일 상수 `BARK_COOLDOWN_MS`를 3000으로 바꾸고 시각 HUD 및 게임 동작에서 공유한다.

## Implementation

### I01. 음원

- `public/assets/audio/corgi-bark.wav` — 기존 합성 음원을 단발 실제 녹음으로 교체. RIFF/WAVE, 44100 Hz, mono, PCM16. 원본은 Broadbeer가 공개 도메인으로 올린 `George vuf 1996.ogg`(https://commons.wikimedia.org/wiki/File:George_vuf_1996.ogg).
- `src/game/audio/audioManifest.ts` :: `FEEDBACK_AUDIO.bark` — 필요 시 출력 음량만 조정. URL/캐시 키 유지.
- `scripts/generate-bark-audio.mjs` — 더 이상 실행하면 실제 음원을 합성 소리로 덮어쓰므로 제거.
- `scripts/bark-audio-assets.test.mjs` — 합성 결과 바이트 비교를 제거하고 WAV 디코딩 조건, 단발 길이 및 실제 진폭을 확인. 이미지 검증은 유지.
- `.memory/test-plans/2026-10-20-real-bark-and-short-cooldown.md` — 원본 링크/라이선스/변환과 검증 기록.

### I02. 쿨타임

- `src/game/data/skills.ts` :: `BARK_COOLDOWN_MS: number` — 10000에서 3000으로 변경. `SKILL_DEFINITIONS.bark.cooldownMs`는 이 상수를 계속 참조한다.
- `scripts/boss-feedback.test.mjs` — 2999ms 거절, 3000ms 성공과 세 번째·여섯 번째 성공 경고 시각을 검증.
- `scripts/audio-pause.test.mjs` — 3초 전 입력은 재생하지 않고 3초 후 성공 입력에서 두 번째 실제 음원을 재생하는지 확인.
- 기존 `AudioManager`, `StageScene`, HUD는 재생/쿨타임의 공통 경로를 유지한다. 코드 변경이 불필요하면 건드리지 않는다.

## Validation

- `node --test scripts/bark-audio-assets.test.mjs scripts/boss-feedback.test.mjs scripts/audio-pause.test.mjs`
- `npx tsc --noEmit`
- `npm run build`
- 가능하면 Chrome에서 실제 WAV 로딩, 게임 입력, 3초 HUD 및 두 번째 재생을 확인한다.

## Commit

`Plan: 2026-10-20-real-bark-and-short-cooldown 실제 개 짖음과 3초 쿨타임 적용`
