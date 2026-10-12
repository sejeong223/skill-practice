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

- 최종 생성/검사: 기믹32개(정적24, 맨홀2, 가짜6), 진짜20개, Tiled 객체58개. 안전구간·간격·높이·첫3개·체크포인트 복귀·atlas 참조 검사 통과.
- 실제 브라우저에서 네 맵 모두 오른쪽 이동 입력만으로 처음 세 개 획득. 진짜/가짜 frame=`bone-coin`, 표시34×26 일치. 이미 먹은 ID에 collectCoin을 다시 호출해도 잔액 증가0.
- 초록 가짜 접촉 후에만 코기 tint40d850 확인. 가짜 지급0, 사망 후 코인 복원. 보유13→사망13→진짜 재획득14→새로고침14→클리어14 확인.
- 잔액0/1,234/1,234,567을1280×720,844×390,390×844에서 표시하고 DOM 숫자/화면 내 bounding box 확인. 스크린샷 `assets/world01-refinement-t02-wallet-{1280,844,390}.png`. 새 카운터는 버튼 아래에 보이며 줄임 없이 표시됨.
- `scripts/snack-wallet.test.mjs` 실제 경제/저장 서비스4건 통과: 즉시 저장·재접속·사망·중복 클리어, 잘못된 입력·0코인 클리어, 기존v2·상점 차감, 저장 실패·구독 해제. 타입·lint·진행 테스트3건 통과. 브라우저 pageerror 없음.
- 별도 발견: 좁은 세로 화면에서 기존 일반맵 HUD 장비 글자가 우측 버튼 뒤까지 이어짐. 새 잔액의 표시·버튼 입력에는 영향 없음. 전체 HUD 개편은 이번 범위 밖으로 보존.

## T03 — 보스 시각 요소·HP

- 생선 뼈 low/mid/high 세 궤적의 표시72×36 확인. 실제 보스 updateFishbone을 양쪽 방향에서 구동해 방어 잔여2→1→0→0, 네 번째 충돌에서 하트3→2 확인. 투사체 이동은 기존 궤적 함수를 유지한다.
- 실제 acceptMeleeHit에서 초기10, 재채기/거리 밖 감소0, 유효9회 후1, 10회 후0/defeated, 추가 공격false. resetAttempt 초기10/방어3 확인.
- 밥그릇 좌/우×run4프레임8가지 anchor 좌표 확인. 최종 x±22, y=-75/-75/-76/-76. 투명 여백 포함64×40 표시(실제 bowl 약43×20), depth12. 플레이어 몸체 크기/원본 시트 변경 없음. 방어 반응140ms, 셋째 반응 후 숨김 확인.
- `assets/world01-refinement-t03-bowl.png`, `world01-refinement-t03-fish-0.png`~`fish-2.png` 참조. 필수 에셋 검사53개/필수31개, 타입·lint, 궤적·근접 회귀4건 통과. 브라우저 pageerror 없음.
- 제작 도구: 내장 image_gen. 참조: 기존 core-items-reference-v1.png의 파란 밥그릇 및 corgi-run.png의 픽셀 스타일. 생성 원본은 사용자 .codex/generated_images/01a12d77-fcc8-74a3-91d6-db988b95d23d/exec-757dbc77-bed2-4b3d-937f-d7ecaa2410c7.png 보존. 게임용은 alpha를 유지해 nearest 방식64×40으로 축소한 `public/assets/pixel/props/world-01/corgi-bowl-shield.png`. 코기 합성 시트/배경 크롭 없음.
- 실제 전투 도중 점프·정지/재개·재진입은 T05에서 추가 확인한다. 범위 밖 발견 사항 없음.

### 밥그릇 생성 프롬프트

Use case: stylized-concept. Asset type: a tiny transparent pixel-art equipment sprite for a 2D side-scrolling corgi game. Generate ONE isolated upside-down blue dog food bowl worn like a small helmet. Reference image 1 supplies the blue bowl's colors and shape only (ignore the meat and rabbit slipper). Reference image 2 supplies the crisp pixel-art sprite style only; do not draw the corgi. Bowl has a shallow domed blue top, flared dark navy bottom rim, light blue highlight at upper left, visible outer blue side, a very narrow dark underside. Orthographic side view, no text, no character, no ground or shadow. Entire bowl centered, approximately 58 pixels wide by 30 pixels tall within a logical 64x40 transparent sprite canvas, chunky clean pixel edges and limited palette. Enlarge this pixel grid cleanly if the output canvas is larger. Keep transparent margins small, preserve actual alpha transparency. It must read clearly when displayed at 44x24 game pixels.

## T04 — 사모예드·효과음

대기.

## T05 — 통합 회귀

대기.
