# Task: T01 다섯 스킬 표시 이름 한국어로 변경

## Status: done

## Goal

첨부된 `배운 기술` 목록의 영문 기술 제목 다섯 개만 한국어 표시 이름으로 바꾼다. 저장·입력·해금에 사용되는 기술 ID는 유지한다.

## Decision Summary

- 화면 순서와 표기는 `짖기`, `물기`, `대시`, `더블 점프`, `꼬리 모터`로 확정됐다.
- `SkillId`는 저장 데이터·게임 로직의 키이므로 번역하지 않고 `SkillDefinition`에 별도 `displayName` 필드를 둔다. 설명 문장과 잠김 상태 표시는 현재 값을 유지한다.

## Implementation

### I01. 스킬 정의에 표시 이름 추가

- Related Files:
  - `src/game/core/types.ts` :: `SkillDefinition`; modify.
  - `src/game/data/skills.ts` :: `SKILL_DEFINITIONS`; modify.
  - `src/game/data/validateContent.ts` :: `EXPECTED_SKILL_ORDER`와 스킬 유효성 검사; read-only.
  - `src/game/persistence/migrations.ts` :: 유효 `SkillId` 판별; read-only.

#### Signatures & Types

```typescript
export interface SkillDefinition {
  id: SkillId;
  displayName: string;
  unlockAfterBossId: string;
  cooldownMs: number;
  inputAction: Extract<InputAction, "bark" | "attack" | "dash"> | "jump";
  description: string;
  effect: string;
}
```

#### Data & Schema Fields

| `id: SkillId` | `displayName: string` | Index |
| :--- | :--- | ---: |
| `bark` | `짖기` | 0 |
| `bite` | `물기` | 1 |
| `dash` | `대시` | 2 |
| `double-jump` | `더블 점프` | 3 |
| `tail-rotor` | `꼬리 모터` | 4 |

- `displayName`은 정적 콘텐츠 필드이며 `ProgressState.unlockedSkills: SkillId[]`나 저장 스키마에 추가하지 않는다. 기존 `description`, `unlockAfterBossId`, `inputAction`, `effect`, `cooldownMs` 값은 변경하지 않는다.

#### Execution Flow / Logic

1. 다섯 `SKILL_DEFINITIONS` 객체에 위 `displayName`을 하나씩 추가한다. 배열의 순서와 `id`는 그대로 둔다.
2. 타입 검사는 다른 스킬 정의 생성처의 필수 필드 누락을 확인한다. 누락이 발견되면 해당 정적 정의에만 같은 표시 이름을 넣고, 저장된 ID를 바꾸지 않는다.
3. 목록 제목에서만 새 필드를 읽는다. `id`를 참조하는 해금·입력·검증·마이그레이션은 그대로 동작한다.

### I02. 배운 기술 목록 제목 교체

- Related Files:
  - `src/components/game/SkillList.tsx` :: `SkillList`의 `<strong>{skill.id}</strong>`; modify.
  - `src/components/game/CharacterStatusPanel.tsx` :: `SkillList` 호출; read-only.
  - `src/app/globals.css` :: `.record-row`, `.record-icon`, `.is-locked`; read-only unless `꼬리 모터` 줄바꿈이 실제 화면에서 발생하면 표시 폭만 조정.

#### Signatures & Types

```typescript
export interface SkillListProps {
  readonly progress: ProgressState;
  readonly definitions: readonly SkillDefinition[];
}
export function SkillList({ progress, definitions }: SkillListProps): ReactElement;
```

#### Data & Schema Fields

- 기존 잠금 판정 `progress.unlockedSkills.includes(skill.id)`의 인자는 여전히 `SkillId`다. React `key`도 `skill.id`를 사용한다.
- 제목 텍스트만 `skill.displayName`으로 바꾼다. 해금 설명은 `skill.description`, 잠긴 설명은 `아직 잠겨 있습니다.`를 유지한다.

#### Execution Flow / Logic

1. `definitions.map()`의 기존 순서를 유지하며 `<strong>` 안에 `skill.displayName`을 출력한다.
2. 잠긴 행의 `?` 아이콘과 흐린 상태, 해금 행의 `●` 아이콘과 설명은 그대로 표시한다.
3. 좁은 화면에서 `더블 점프`와 `꼬리 모터`가 레이아웃을 밀어내지 않는지 확인한다. 실제 문제가 있으면 `.record-row` 텍스트 영역의 줄바꿈만 보완한다.

## Acceptance Criteria

- [ ] 첨부 화면의 다섯 제목이 지정한 한국어 순서·띄어쓰기로 보인다.
- [ ] 기존 `SkillId`와 저장된 해금 배열, 해금 순서, 설명·잠금 표시가 변하지 않는다.
- [ ] 모바일 폭에서도 기술명과 설명이 잘리지 않는다.

## Validation

- `npx.cmd eslint src/game/core/types.ts src/game/data/skills.ts src/components/game/SkillList.tsx` — 관련 파일 린트 통과.
- `npx.cmd tsc --noEmit` — 새 필수 필드와 기존 콘텐츠 타입 검사 통과.
- `npm.cmd run build` — 콘텐츠 유효성 검사와 UI 번들 빌드 통과.
- 개발 화면의 `배운 기술` 패널을 데스크톱/작은 화면에서 열어 다섯 이름과 잠금 상태를 확인한다.

## Commit Message

```text
feat(skills): 배운 기술 이름을 한국어로 표시

Plan: 2026-10-14-world01-bark-unlock-and-korean-skills
Phase: P01-skill-ui-and-bark
Task: T01-korean-skill-names

- 스킬 정의에 한국어 표시 이름 추가
- 기술 목록에서 내부 ID 대신 표시 이름 사용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (eslint, TypeScript, build, 서버 렌더링 문자열 확인)
- commit: `e77e5a4`
