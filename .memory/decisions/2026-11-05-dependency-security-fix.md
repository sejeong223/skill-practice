# Decisions: 심각·높음 의존성 보안 경고 수정

- Date: 2026-11-05
- Status: confirmed
- Request: 사용자가 취약점 설명 후 `$memory-plan`으로 수정 계획도 함께 추가하도록 요청했다.
- Related plan: [Standard 배포 재개](../plans/2026-11-05-azure-standard-release.md)

## D01. 심각·높음 4개 패키지만 수정

- 사용자 선택: **심각·높음만 포함, 보통은 후속 작업**. 대상은 root 의존성의 next, sharp, source-map-js, zod다.
- 읽기 전용 재검사: `npm.cmd audit --json`에서 critical1/high3/moderate8/total12. 패키지 기준 집계이며 Next 한 패키지에 여러 공지가 있다.
- 기존의 보안 수정 전체 보류 결정을 이 4개 패키지에 한해 변경한다. 보통 8개, 월드3 인트로, 게임 기능 변경은 포함하지 않는다.

## D02. 한 Task에서 업데이트와 검증을 함께 완료

- Next와 eslint-config-next는 모두16.4.5로 맞춘다. sharp 최소0.35.5, source-map-js 최소1.2.2, zod 최소4.6.6을 각 부모의 허용 범위 안에서 해결하고 root 잠금 파일에 확정한다.
- 이 버전들의 배포 여부와 Next/ESLint 의존성은 2026-11-05 `npm view`로 확인했다. 실행 시 현재 보안 공지와 실제 해결된 버전을 재확인한다.
- `npm audit fix --force`, Next/린트 설정의15버전 하향, 광범위한 major 강제 override, React/Phaser/Tone 전체 갱신은 하지 않는다.
- 같은 package.json/package-lock.json과 검증 결과가 하나의 변경 단위이므로 단일 Phase/Task로 작성한다. 검증만 별도 미완료 Task로 떼지 않는다.

## D03. 기존 배포 계획의 선행 조건으로 연결

- 실행 순서는 **보안 수정 → 기존 Standard 배포 T01~T06**이다. 업데이트한 Next로 정적 패키지를 만들어야 중복 빌드·재검증을 줄일 수 있다는 계획상 판단이다.
- 보안 Task 완료 후 current.md를 기존 배포 T01로 넘긴다. 기존6개 Task의 파일명·번호·미완료 상태와 과거 완료 기록을 보존한다.
- 기존 배포 T03의 수동 workflow에 root 전체 의존성 `npm audit --audit-level=high` 검사를 명시한다. 개발용 Zod도 검사하며 보통 경고만으로는 실패시키지 않는다.
- 이번 단계는 .memory 문서만 작성한다. 코드·패키지·Azure/GitHub 리소스 변경이나 배포를 실행하지 않는다. computer-use 금지는 유지한다.
