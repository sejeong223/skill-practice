# Task: T04 공사장 자산 테스트의 낡은 기대값 수정

## Status: done

## Goal

현재 월드 3 이미지가 1672×941인데 960×720을 기대해 실패하는 기존 공사장 자산 테스트를 고친다. 앞선 Task에서 추가한 드럼·손수레·빔도 같은 manifest·PNG 기본 계약에 포함한다.

## Decision Summary

- 사용자가 요청한 기존 테스트 수정이다. 프로덕션 이미지 크기를 오래된 테스트에 맞춰 되돌리지 않는다.
- T01~T03의 이미지와 manifest가 완성된 뒤 테스트 기대값만 현행 계약에 맞춘다.

## Implementation

### I01. manifest·이미지 크기 계약 갱신

- Related Files:
  - `scripts/world03-construction-assets.test.mjs` :: `expected`, 첫 번째 `test(...)` — modify
  - `src/game/assets/assetManifest.json` :: 실제 키·URL·required 확인 — read-only
  - `scripts/world03-visual-assets.test.mjs` :: 현재 월드 3 배경·위험물 치수 계약 확인 — read-only

#### Details

- **Signatures & Types**:
  ```javascript
  // expected의 각 원소: [assetKey: string, width: number, height: number]
  const expected = [/* 월드 3 필수 PNG */];
  ```
- **Data & Schema Fields**: 원경·전경·중경 1/2/3/4 및 보스 중경은 각 1672×941. 공사장 바닥은 128×216, 타일셋은 64×32. 기존 네 장애물은 cone 32×40, brick 36×35, cement 34×36, pipe 40×30. 새 드럼 48×48, 손수레 56×44, 빔 64×28.
- **Execution Flow / Logic**:
  1. `expected`의 오래된 배경 크기 960×720을 1672×941로 바꾸고 보스 중경 키도 포함한다. 기존 바닥·타일셋·장애물 크기는 그대로 보존한다. 새 PNG 세 개의 key·크기를 추가한다.
  2. 각 키가 manifest에 정확히 한 번 있고 `kind: "image"`, `required: true`, `worldId: "world-03"`이며 URL이 실제 파일을 가리키는지 확인한다. 파일은 `sharp(...).metadata()`가 PNG·기대 치수라고 보고해야 한다.
  3. 누락·크기 불일치가 발견되면 실제 계약과 T01 이미지 파일을 다시 확인한다. 실패를 숨기려고 해당 항목을 검사 목록에서 빼지 않는다.

### I02. 중경 차별화와 투명 실루엣 회귀 검사

- Related Files:
  - `scripts/world03-construction-assets.test.mjs` :: 두 번째 `test(...)` — modify

#### Details

- 중경 1~4의 파일 내용이 각각 다른지 기존 검사를 유지한다. 보스 중경의 존재·치수는 I01에서 검사하며, 보스가 일반 네 구역과 서로 달라야 하는지는 현행 미술 계약에 없으므로 강제하지 않는다.
- 기존 네 장애물에 드럼·손수레·철골 빔을 추가해 알파값 128 초과 픽셀이 충분히 있고 왼쪽 위 모서리 알파가 0인지 검사한다. 작은 빔의 면적 기준도 그림의 실제 불투명 범위에 맞춰 적용하되 빈 그림을 허용하지 않는다.
- `scripts/world03-visual-assets.test.mjs`의 상세 실루엣·바닥 접점 검사를 중복 구현하지 않는다. 이 테스트는 manifest 전체 등록과 기본 PNG 계약에 집중한다.

## Acceptance Criteria

- [x] `world03-construction-assets.test.mjs`가 현행 월드 3 이미지와 새 위험물 모두에 통과한다.
- [x] 네 일반 중경의 차별화, 기존 네 장애물의 투명 실루엣 검사, manifest 유일성 검사가 유지된다.
- [x] 오래된 크기 기대값을 고치기 위해 프로덕션 자산을 되돌리거나 다른 테스트를 약화하지 않는다.

## Validation

- `node --test scripts/world03-construction-assets.test.mjs scripts/world03-visual-assets.test.mjs` — 두 자산 검사 전체 통과.
- `node scripts/validate-assets.mjs` — manifest 파일 참조 검사 통과.
- `node node_modules/eslint/bin/eslint.js scripts/world03-construction-assets.test.mjs` — 수정한 테스트 lint 통과.
- `git diff --cached --check` 및 `git diff --cached --stat` — 해당 Task 변경만 스테이징.

## Commit Message

```text
test(월드3): 현행 공사장 이미지 계약으로 테스트 갱신

Plan: 2026-10-27-world03-construction-hazards
Phase: P01-construction-hazards
Task: T04-construction-assets-test

- 기존 배경 크기 기대값을 현재 자산에 맞춤
- 새 위험물 이미지의 등록·투명 실루엣 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 한국어 커밋에 포함
