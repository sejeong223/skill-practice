# Task: T02 전체 캠페인 회귀 검증·빌드·배포 전 점검

## Status: pending

## Goal

처음 시작한 플레이어가 도입부부터 25개 스테이지·최종 엔딩까지 진행할 수 있는지, 저장·사망·체크포인트·상점·키 설정·컷신·오디오·에셋 로딩 회귀가 없는지 검증하고 production build를 확정한다.

## Decision Summary

- 단일 억까 난이도와 목숨 제한 없음은 모든 환경에서 동일해야 한다.
- 진행 중 stage 위치는 저장하지 않으며, bankedCoins·영구 장비·스킬·수집품·사망 통계만 reload 후 유지한다.

## Implementation

### I01. 자동 검사와 수동 회귀 체크리스트

- Related Files:
  - scripts/validate-content.mjs :: validateCampaign — new
  - docs/qa/campaign-checklist.md :: release checklist — new
  - docs/qa/known-issues.md :: accepted issues — new

#### Details

- validateCampaign은 5개 world, 각 4 normal + boss, 25개 stage, 5개 boss reward, skill order, checkpoint count, collectible count, title/id uniqueness를 검사한다.
- 수동 체크리스트는 다음을 포함한다.
  - 새 플레이어 이름 입력과 기본 이름 코기
  - 도입부 자동 재생·이미 본 도입부 스킵
  - J 슬리퍼 3연타 솜먼지 재채기
  - 밥그릇 3회 방어·유기견 길막
  - checkpoint 전후 사망과 coin 분리
  - 상점 구매·상태 창 장비 변경·숨겨진 drawback 발견
  - 키 재매핑 후 새로고침 유지
  - 각 보스 보상 순서와 다음 월드 잠금 해제
  - 왕갈비뼈 비사용 최종전과 지정 엔딩

### I02. 접근성·브라우저·빌드 검증

- Related Files:
  - package.json :: scripts — modify if needed
  - README.md :: run and controls — modify

#### Details

- npm run lint, npm run build를 clean checkout에서 실행한다.
- Chrome·Edge 최신 데스크톱 브라우저에서 1280×720, 작은 브라우저 창 FIT, audio first gesture, localStorage reload를 확인한다.
- canvas와 React overlay가 같은 logical viewport를 사용하고, status/shop panel이 게임 canvas 바깥으로 밀려나지 않는지 확인한다.
- audio context가 잠긴 상태에서 UI 오류가 발생하지 않고 첫 키/클릭 후 재개되는지 확인한다.

### I03. 릴리스 기준

- Related Files:
  - docs/release-checklist.md :: final release checklist — new

#### Details

- 필수 조건 미충족 시 P05를 완료 처리하지 않는다.
- 알려진 문제는 severity와 재현 절차를 기록하고, gameplay blocker·save loss·soft lock은 반드시 해결한다.
- build 산출물에는 debug trap overlays와 developer-only logging을 포함하지 않는다.

## Acceptance Criteria

- [ ] 25개 stage와 5개 boss reward가 registry 검사에 통과한다.
- [ ] 첫 실행부터 엔딩 크레딧까지 soft lock 없이 진행된다.
- [ ] 저장·사망·코인·장비·키 설정·컷신 상태가 요구사항대로 유지된다.
- [ ] intro·world·boss·ending 컷신과 오디오가 스킵/재생 규칙을 지킨다.
- [ ] npm run lint와 npm run build가 clean checkout에서 통과한다.
- [ ] README에 실행법·기본 조작·키 설정·저장·사망 규칙이 기록된다.

## Validation

- node scripts/validate-content.mjs — 캠페인 구조 검증 통과
- npm run lint — 전체 lint 통과
- npm run build — production build 통과
- npm run dev — QA checklist 전체 수동 실행

## Commit Message

~~~text
chore(release): verify full campaign and production build

Plan: 2026-09-21-legendary-rib-corgi
Phase: P05-polish-verification
Task: T02-release-verification

- Add campaign and release validation checklists
- Verify save, gameplay, cutscenes and production build end to end
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
