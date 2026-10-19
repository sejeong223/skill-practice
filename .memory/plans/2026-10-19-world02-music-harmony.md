# Plan: 월드 2 음악 화음 정렬

## Goal
월드 2 기본 음악의 멜로디와 베이스를 각 화음에 맞춰, 두 곡이 섞인 것처럼 들리는 불협화음을 제거한다. 월드 1에서 월드 2로 넘어갈 때 활성 Tone 시퀀스가 한 곡분만 남는지도 확인한다.

## Decisions
- [결정 기록](../decisions/2026-10-19-world02-music-harmony.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 월드 2 편곡 교정과 음악 전환 회귀 검증 | [P01](../phases/2026-10-19-world02-music-harmony/P01-arrangement-and-transition/phase.md) |

## Scope
- 월드 2 일반 스테이지에 쓰이는 `world-02-amusement`만 수정한다.
- 화음 진행과 BPM은 유지한다. 월드 2 진입 컷신에는 음악 재생 요청이 없다.
