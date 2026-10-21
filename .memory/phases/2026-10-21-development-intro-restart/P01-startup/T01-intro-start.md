# Task: T01 개발 모드 첫 인트로

## Status: done

## 구현 청사진

- `src/app/page.tsx`의 `Home`: 개발 전용 월드 2 `initialStageId` 분기 제거, `world-01-stage-1` 지정.
- `src/components/game/GameShell.tsx`의 초기 로드: `prepareDevelopmentIntroProgress(progress, isDevelopment)`로 로드된 상태를 준비한다.
- `src/game/systems/developmentIntroStart.ts` 신규: `ProgressState`를 복제해 개발 모드에서만 `onboardingCompleted:false`, `seenCutsceneIds`에서 `intro-home` 제외. `selectedWorldId`, `ownedToolIds`, `ownedCosmeticIds`, `bankedCoins`, `clearedStages`, `deathsTotal` 등은 유지한다. 배포 모드에서는 원본 객체 반환.
- `src/game/scenes/PreloadScene.ts`: `getDevelopmentWorld02Entry` 우회 분기를 제거해 `onboardingCompleted:false`가 `IntroScene`으로 이어지도록 한다.
- `src/game/systems/developmentWorld02Start.ts`, `scripts/development-world02-start.test.mjs`: 더 이상 사용하지 않는 월드 2 강제 시작 경로 제거.
- `scripts/development-intro-start.test.mjs` 신규: 새 저장과 기존 저장의 개발 모드 시작 준비 및 배포 모드 무변경을 검증한다. 필요하면 브라우저에서 `IntroScene` 진입을 확인한다.

## 검증 커맨드

- `node --test scripts/development-intro-start.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`

## 커밋

`fix(startup): 로컬 실행을 첫 인트로부터 시작하도록 복원`

Plan: 2026-10-21-development-intro-restart
Phase: P01-startup
Task: T01-intro-start

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `fix(startup): 로컬 실행을 첫 인트로부터 시작하도록 복원` (이 Task 커밋)
