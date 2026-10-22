# Plan: 월드 2 놀이터 맵 1~3과 역방향 이동

## Goal

월드 2의 맵 2·3을 첫 맵과 같은 모래 놀이터 방식으로 완성하고, 맵 2→1·맵 3→2 왼쪽 이동과 안전한 무작위 장애물·비둘기 배치를 제공한다.

## Confirmed Decisions

[결정 문서](../decisions/2026-10-21-world02-three-playground-maps.md)의 사용자 요청과 코드 확인 결과를 따른다. 맵 3을 마치면 기존 월드 2 보스 스테이지로 바로 들어가며, 맵 4는 전역 ID만 보존한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `pending` | 맵 2·3 배경·바닥, 장애물 그림, 시드 배치, 비둘기, 역방향 이동과 검증 | [P01](../phases/2026-10-21-world02-three-playground-maps/P01-three-playgrounds/phase.md) |

## Task Order

1. **T01 배경과 모래 바닥** — 맵 2·3의 다른 놀이기구 중경 이미지를 만들고, 두 맵의 임시 발판·함정·적을 첫 맵과 같은 연속 모래 바닥으로 교체한다.
2. **T02 장애물 외형 7장** — 사이다·환타 캔, 치토스 봉지, 고양이 2종의 잠든/할퀴는 그림을 제작·등록한다.
3. **T03 무작위 장애물과 비둘기** — 맵 2·3의 안전한 시드 배치, 고양이 다중 개체 연출, 비둘기 세 구간을 기존 시스템에 연결한다.
4. **T04 맵 왕복과 통합 확인** — 왼쪽 경계로 이전 맵에 돌아오고, 맵 3 오른쪽에서는 맵 4를 건너뛰어 보스 스테이지로 진입하며, 체크포인트·코인·시드·실제 플레이를 확인한다.

## Task Boundary Rationale

- T01만 끝나도 맵 2·3을 끝까지 걸을 수 있어 배경·바닥을 독립적으로 검증할 수 있다. T02는 이미지 파일과 에셋 등록만 다뤄 게임 로직과 섞지 않는다.
- 무작위 장애물과 비둘기는 같은 좌표 안전성 검사가 필요해 T03 한 Task로 묶는다. T04는 양방향 씬 이동과 저장 상태를 함께 다뤄 재진입 회귀를 한 번에 검증한다.

## Validation Gate

각 Task의 단위/에셋 검사, `node scripts/validate-assets.mjs`, `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit`을 수행한다. 마지막 Task에서 Chrome으로 1→2→3→2→1→2 경로와 위험물·체크포인트·코인을 확인한다.
