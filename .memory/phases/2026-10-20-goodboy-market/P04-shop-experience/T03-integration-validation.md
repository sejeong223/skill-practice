# Task: T03 상점 전체 통합 검증과 회귀 수정

## Status: pending

## Goal

월드 1·2의 코인 수집부터 상점 진입, 19종 탐색·구매·착용, 삼색이 장비 효과, 저장 복원, 음악 복귀까지 실제 브라우저에서 끝까지 검증하고 확인된 결함을 수정한다.

## Decision Summary

- 앞 Task의 파일을 재작성하지 않는다. 확인된 통합 결함만 해당 소유 파일에서 고친다.
- 점프 장애물 즉사, 밥그릇 3회 경고, 짖기 3초 쿨다운, 월드 선택·체크포인트는 계속 작동해야 한다.

## Implementation

### I01. 자동 회귀와 브라우저 시나리오

- Related Files:
  - `scripts/goodboy-market-integration.test.mjs` :: 카탈로그/저장/장비 이벤트/코인 결합 테스트; new
  - `src/components/game/GameShell.tsx` :: 발견된 진입/닫기·복원 결함만 수정; conditional modify
  - `src/game/scenes/StageScene.ts` :: 발견된 일시정지·장비 반영 결함만 수정; conditional modify
  - `src/game/audio/ShopAudioController.ts` :: 발견된 중복 재생 결함만 수정; conditional modify
  - `.memory/test-plans/2026-10-20-goodboy-market.md` :: 실제 검증 결과·스크린샷 경로; new

#### Details

- **Execution Flow / Logic**: 1) 월드 1·2 각각 코인 수집→공유 잔액 확인. 2) 처음 0코인으로 상점에서 구매 시 부족 대사와 잔액 보존 확인. 3) 카테고리마다 상품 수 5/4/5/5와 가격·이미지·좌우 네모 화살표 확인. 4) 19종 전부 자산 및 구매 가능 상태 확인; 테스트 전용 충분한 코인 저장으로 구매/재로드/중복 방지 확인. 5) 의상+장신구 한 쌍을 함께 장착해 정지·좌우 이동·점프·짖기·리스폰에서 확인. 6) 방패를 코기 앞에 놓고 무기 5종·방패 4종을 삼색이에서 사용해 체력·차단 횟수·단점 공개 확인. 7) 상점에서 `Escape`, 닫기 버튼, 월드 전환 직전, 탭 숨김/복귀로 BGM 단일 재생과 플레이 재개 확인. 8) 720px 이하 터치 UI와 데스크톱 UI에서 버튼 겹침 및 주인/대사 가독성을 확인한다.
- **Error & Exception Handling**: 테스트를 위한 잔액 주입은 프로덕션 코드의 치트 경로로 남기지 않는다. 특정 자산/사운드/저장 실패를 발견하면 실패 화면·콘솔·재현 단계를 기록하고 해당 Task 소유 파일을 수정한 뒤 같은 시나리오를 재검증한다.

### I02. 완료 조건과 기록

- 모든 대상 명령을 실행한다. `node --test scripts/*.test.mjs`가 PowerShell/glob 환경에서 동작하지 않으면 `Get-ChildItem scripts -Filter '*.test.mjs' | ForEach-Object { node --test $_.FullName }` 또는 `node --test scripts`의 실제 동작을 확인하여 동일 범위를 실행한다. `node scripts/validate-assets.mjs`, `npm run world01:maps:check`, `npx tsc --noEmit`, `npm run lint`, `npm run build`도 통과한다.
- `.memory/test-plans/2026-10-20-goodboy-market.md`에 실행 명령, 브라우저 폭, 검증 순서, 결과와 남은 범위 제한을 기록한다. 이전 코인 재파밍 정책처럼 이번 기능과 무관한 인접 요구는 별도 보고만 한다.

## Acceptance Criteria

- [ ] 월드 1·2 게임 중 상점을 여러 번 열고 닫아도 플레이·음악·코인·장착이 일치한다.
- [ ] 19종 이미지와 상품 데이터가 전부 맞고, 9종 장비 효과와 10종 착용 파츠가 실제 플레이에서 확인된다.
- [ ] 자동 테스트·타입 검사·린트·빌드·자산 검사 통과, 브라우저 콘솔 오류 0건이며 결과를 기록했다.

## Validation

- `node --test scripts` — 프로젝트 전체 테스트 파일 범위를 확인하여 실행.
- `node scripts/validate-assets.mjs && npm run world01:maps:check && npx tsc --noEmit && npm run lint && npm run build` — 자산·맵·타입·린트·빌드.
- Chrome에서 위 8단계 시나리오 수행 후 화면·소리·콘솔 결과 기록.

## Commit Message

```text
test(상점): 굿보이 마켓 월드 1·2 통합 검증 완료

Plan: 2026-10-20-goodboy-market
Phase: P04-shop-experience
Task: T03-integration-validation

- 구매 착용 전투 오디오의 연결 상태 검증
- 실제 브라우저에서 발견한 회귀 문제 수정 및 결과 기록
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
