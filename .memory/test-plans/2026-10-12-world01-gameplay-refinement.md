# 월드 1 플레이 개선 검증 기록

환경: Windows, Node 24, Next 개발 서버, Playwright Chromium headless. 화면 1280×720 및 844×390. 게임 물리 좌표 1280×720. 자동 브라우저 관찰은 실제 기기 사용자의 체감 평가와 구분한다.

## T01 — 맵·카메라·보행

- 네 일반 맵 정의/로드된 Tiled 폭 2560px 확인. 생성 검사: 기믹24, 객체30, 체크포인트2. 타 월드 상수3840/보스1920 유지.
- 구간마다 `startFollow`가 scroll 및 offset을 초기화하던 설치된 Phaser 동작을 확인하고, 구간 변경은 `setLerp`로 교체. 최초 연결과 F3 복귀 offset=-320 확인.
- stage1 평지 912px 경계 통과 측정: 최대 scroll 변화4px/프레임, 프레임0~3 순환, 발 y와 body.bottom 차0. 표본22개, 평균 프레임 delta20.23ms. headless 환경의 실측이며 30/60/120fps 모두 검증했다는 의미는 아니다.
- 네 테마 진입과 모바일 가로 화면 저장: `assets/world01-refinement-t01-stage1.png`~`stage4.png`, `world01-refinement-t01-mobile.png`.
- 배경 원본 및 비율 유지. 전경 scrollFactor1.05의 끝 coverage 필요 폭2624px(1280+1280×1.05)이 기존2560보다64px 커서 표시 면적만 확대. 파생 이미지/크롭 없음.
- `world01:maps:check`, `test:progression`(3건), `tsc --noEmit`, `lint` 통과. 브라우저 pageerror 없음.
- 상세 점프/맨홀/체크포인트 및 모든 경계 재검증은 최종 배치가 확정되는 T05에도 수행한다.

## T02 — 간식·잔액·장애물

대기.

## T03 — 보스 시각 요소·HP

대기.

## T04 — 사모예드·효과음

대기.

## T05 — 통합 회귀

대기.
