# Plan: 전설의 무한 육즙 왕갈비뼈 쟁탈전

## Goal

Next.js 프로젝트를 데스크톱 브라우저에서 실행되는 2D 횡스크롤 억까 액션 플랫폼 게임으로 전환한다. Phaser 3.90.0과 Arcade Physics를 게임 플레이에 사용하고, React를 상점·상태 창·키 설정·컷신 UI에 사용한다. 최종 결과는 살짝 픽셀 아트풍의 일관된 생성형 에셋, 5개 월드·25개 스테이지, 희소 체크포인트, 스킬·장비·경제·저장 시스템, 도입부와 엔딩 컷신을 포함한 완주 가능한 캠페인이다.

## Product Baseline

- Runtime: Next.js 16.3.5 / React 19 / TypeScript
- Game: Phaser 3.90.0, Arcade Physics, 1280×720 기준 16:9 FIT 스케일
- Input: WASD·방향키 이동, Space 점프, 기본 J/K/L 스킬 입력, 사용자 재매핑
- Art: 밝은 2D 카툰 + 살짝 픽셀 아트 감성, 고정 팔레트·픽셀 그리드·일관된 실루엣
- Assets: 생성형 이미지 도구로 만든 PNG/SVG를 정리해 스프라이트·아틀라스로 사용
- Campaign: 5월드 × 일반 4스테이지 + 보스 1스테이지 = 25스테이지
- Difficulty: 단일 극악 난이도, 목숨 제한 없음, 희소 체크포인트, 사망 즉시 재시작
- Persistence: localStorage 기반 자동 저장. 클리어·스킬·영구 장비·안전 금고 코인·수집품·사망 통계·키 설정을 보존

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 픽셀풍 에셋 규칙, Phaser 실행 셸, 도메인 스키마 | [P01](../phases/2026-09-21-legendary-rib-corgi/P01-foundation-visuals/phase.md) |
| P02 | `pending` | 플레이어·스킬·장비·충돌·체크포인트·스테이지 런타임 | [P02](../phases/2026-09-21-legendary-rib-corgi/P02-core-gameplay/phase.md) |
| P03 | `pending` | 저장·경제·상점·상태 UI·컷신·오디오 | [P03](../phases/2026-09-21-legendary-rib-corgi/P03-progression-presentation/phase.md) |
| P04 | `pending` | 5개 월드와 25개 스테이지 콘텐츠 | [P04](../phases/2026-09-21-legendary-rib-corgi/P04-campaign-content/phase.md) |
| P05 | `pending` | 픽셀 렌더링 폴리시, 성능, 완주 검증 | [P05](../phases/2026-09-21-legendary-rib-corgi/P05-polish-verification/phase.md) |

## Execution Order

1. P01-T01에서 캐릭터·도구·배경의 기준 디자인과 에셋 계약을 확정한다.
2. P01-T02에서 Phaser를 Next.js Client Component에 안전하게 마운트한다.
3. P01-T03에서 이후 모든 시스템이 공유할 타입과 데이터 모델을 만든다.
4. P02에서 플레이 가능한 핵심 루프를 완성한 뒤 P03에서 UI·저장·연출을 연결한다.
5. P04에서 월드별 데이터를 순차 추가하고, P05에서 전체 캠페인을 검증한다.

## Definition of Done

- [ ] 새 게임 시작부터 5월드 최종 보스와 지정된 엔딩까지 플레이할 수 있다.
- [ ] 코기 이름 입력, 키 재매핑, 상점·장비·스킬·저장·사망 통계가 새로고침 후에도 보존된다.
- [ ] 모든 스테이지는 데이터로 정의되며, 고정 함정과 일부 시드 기반 랜덤 함정을 구분한다.
- [ ] 공격·방어 도구마다 장점과 숨겨진 억까 부작용이 있고, 발동 후 상태 창에 기록된다.
- [ ] `npm run lint`와 `npm run build`가 통과한다.
