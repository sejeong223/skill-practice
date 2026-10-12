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

- DefenseToolSystem/StrayDogEvent 실제 이벤트 연동2건, 시간 기반 경로2건 통과. weak3회 clang3/무리1/count5, 네 번째 무음, reset 반복/destroy 해제 확인. 타입·lint 통과.
- Chromium 실제 게임에서 카메라 left530/right1810 시 출발 x452/376/300/224/148, 목표786/818/850/882/914 확인. 1·2회 무리0,3회5마리. 입장 중pause250ms 동안 위치·boss elapsed 동일, 재개 후 퇴장/잠금해제/개0 확인. 재진입 시 clang 구독2개(오디오1+방패그림1), 이전 예약source0, 공유context 미종료.
- 112×96에서는 원본의 투명 여백 때문에 코기 귀가 남아 실제 표시를140×120으로 조정했다. 종횡비 유지,5마리/간격32 유지. 시작/끝 padding은 반폭70+8=78로 동기화. `assets/world01-refinement-t04-cover.png`에서 코기의 머리·몸 가림 확인. 기존 개 이미지 재사용, 추가 생성 없음.
- `assets/world01-refinement-t04-surge.webm`에 입장/가림/정지/재개/퇴장 기록. `world01-refinement-t04-enter.png` 및 cover.png도 저장.
- 실제 WebAudio 출력 두 스트림(BGM/SFX)을 녹음해 `assets/world01-refinement-t04-audio-mix.wav`로 합쳤다. 길이5.94초, SFX peak0.0350, 합성 peak0.2362, clipping 없음. 정상 unlock 후 성공 방어3회에 전용 clang 호출3,4번째 추가0. 음악key=boss, Phaser context 공유 확인. 합성3개sine/attack3ms/lowpass2400Hz/220ms 상한, rush120ms 후 시작.
- **검증 한계**: 이 실행 환경은 오디오 입력 청취를 지원하지 않는다. 파형·이벤트·녹음 검증은 완료했으나 실제 스피커/이어폰/모바일 기기의 음량·음색 청취는 미검증이다. 녹음 파일을 제공하며 주관적인 청취 완료로 주장하지 않는다.
- 범위 밖 발견 사항 없음.

## T05 — 통합 회귀

검증일: 2026-10-12. 기준 `eb06803`에 이 Task의 회귀 수정을 더한 작업 트리. Windows / Node 24 / Playwright Chromium headless. 일반맵과 F3는 기존 개발 서버, 최종 보스·사망 복귀·클리어는 `next start` 프로덕션 빌드에서도 확인했다. 브라우저별 테스트 저장소를 따로 사용했으며 사용자 저장 데이터는 변경하지 않았다.

- viewport 1280×720: canvas 1280×720, 배율1. 844×390: canvas 약693.3×390, 배율0.5417. 390×844: canvas390×219.375, 배율0.3047. 키보드 입력 및 화면 크기 검증이며 실제 모바일 터치 조작 검증은 아니다.
- 고정 fps를 보장하는 측정은 수행하지 않았다. T01의 실제 프레임 표본과 설치된 Phaser의 이전 카메라 초기화 동작을 근거로 비교했다. 동일 기기의 완전한 이전 빌드 벤치마크는 미실시다.
- 오디오 출력: WebAudio 녹음·PCM 측정. 실제 출력 장치 청음은 불가하여 R08의 주관적 음색·음량 판정은 `not-run`이다.

| id | scenario | expected | observed | status | evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R01 | 네 맵 구간 경계, 보행·방향 전환·점프 | 구간 변경 시 추적 재시작 없음, 발 접지 유지 | 각 맵 x192/912/1648/2368에서 startFollow 호출0, 즉시 scroll 변화0. T01 실제 경계 통과 최대4px/프레임, 발 오차0. 실제 입력 점프 및 좌우 전환 확인 | pass | T01 기록; [맵 측정](assets/world01-refinement-t05-map-results.json) |
| R02 | 끝 배경, stage2/4 단차, F3 왕복 | 빈 영역·새 압축 없음, 원본 자르기 최후 | 네 맵 최대 scroll1280에서 모든 레이어 우측 coverage≥1280. F3 복귀 offset=-320. 원본 비율 유지, crop 미사용 | pass | [끝1](assets/world01-refinement-t05-end-1.png), [끝2](assets/world01-refinement-t05-end-2.png), [끝3](assets/world01-refinement-t05-end-3.png), [끝4](assets/world01-refinement-t05-end-4.png) |
| R03 | 첫 세 간식 및 초록 가짜 | 진짜3개 선행, 접촉 전 구별 불가 | 네 맵 실제 이동으로 첫3개 획득. 진짜/가짜 모두 bone-coin 34×26. 초록 가짜는 접촉 후 코기 tint40d850, 잔액 지급0 | pass | T02 브라우저 기록 및 wallet 화면 |
| R04 | reverse/fire, 가짜 회피와 사망 | 효과 후 사망·복귀, 잔액 보존, 위장 복원 | drift-backward/launch-up 발동, 정해진 강제 이동 종료에도 사망 보장. 복귀 후 frame=bone-coin/status=armed, 잔액12 유지 | pass | [체크포인트·가짜](assets/world01-refinement-t05-checkpoint-results.json) |
| R05 | 장애물·맨홀·체크포인트 | 정적6/맵, 비둘기 확대, 점프 회피 및 정확한 복귀 | 실제 키 입력으로 기믹32개 각각 점프 회피 성공. 맨홀 낙사 확인. stage2/4 체크포인트 활성화 후 해당 위치 복귀, 시도 코인0/진짜5개 복원. 기믹별 검증은 인접 기믹을 테스트 메모리에서 격리했으며 전체 경로 무사망 완주를 뜻하지 않음 | pass | 맵 측정 jumped=7/9/7/9; 체크포인트 결과 |
| R06 | 생선 뼈 세 궤적·양방향 충돌 | 표시72×36, 판정54×24, 관통·중복 없음 | T03 실제 세 패턴 표시와 좌우 swept collision, 방어3회 뒤 네 번째 하트 감소. 궤적·근접 자동 회귀4건 유지 | pass | T03 fish-0~2 화면; fishbone-trajectory/calico-melee-hitbox 검사 |
| R07 | 머리 방패, run4프레임·좌우·점프 | 머리를 따라감, 방어3회 뒤 숨김/재도전 복원 | T03 프레임별8샘플. 실제 달리기·점프에서 물리 갱신 뒤 위치 동기화하여 x anchor 오차0. 재진입 bowl=true | pass | [보스 결과](assets/world01-refinement-t05-boss-results.json), [재도전](assets/world01-refinement-t05-retry-results.json), T03 bowl 화면 |
| R08 | 깡3회, 네 번째 무음, BGM·unlock·재진입 | 중복 없는 부드러운 타격음 | 이벤트3회/추가0, 녹음5.94초, SFX peak0.0350/합성0.2362, clipping 없음. 명시적 suspend로 자동 재생 제한을 모사해 source0/resume 뒤0 확인. 공유 context와 재진입 정리 확인. 실제 스피커·이어폰에서 소리의 부드러움/크기는 청취하지 못함 | not-run | [음원](assets/world01-refinement-t04-audio-mix.wav), T04 기록, 보스 결과 suspendedAudio |
| R09 | 좌·중·우 및 공중에서 셋째 방어 | 화면 왼쪽 밖→5마리→코기 가림→퇴장 | x96/900/1810, 중앙 공중 y380에서 모두5마리가 viewport 왼쪽 밖 출발, floorY512. T04 화면에서 머리·몸 가림 및 퇴장 확인 | pass | 보스 결과 surges; [가림](assets/world01-refinement-t04-cover.png), [동영상](assets/world01-refinement-t04-surge.webm) |
| R10 | 무리 도중 pause·중단·사망·승리 | 정지 중 시간 보존, 종료 시 이미지·잠금 정리 | T04 pause 중 위치/elapsed 동일. 세 위치에서 stopAttacks 후 dogs0/잠금 해제. 셋째 하트 피격도 dogs0/잠금 해제. 승리 후 StageScene 종료/클리어 이동 확인 | pass | T04 동영상, 보스·재도전 결과 |
| R11 | 9/10번째 공격과 재도전 | HP1→0, 다음 시도10/하트3/방어3 | 실제 J 키 유효9회 후1, 10회 후 승리. 재채기/빗나감 무효는 T03 및 근접 검사. 재입장10/3/3, 개0, 방패 표시 | pass | 보스·재도전 결과 |
| R12 | intro/clear 자동 컷신, 셋째 하트 | 입력 없는 대사 진행, 완료1회, checkpoint 복귀 | 소개·승리 대사 진행 입력 없이 종료. 완료 이벤트1회/bark 해금. 하트2→1→0 후 stage4-checkpoint x2360 복귀, 잔액10 | pass | 보스 결과 intro/clear, 재도전 결과 death/respawn |
| R13 | 클리어 뒤 월드2 연결 | 타 월드3840/기존 엔티티 유지 | NEXT STAGE로 world-02-stage-1, 정의·물리 폭3840, 기존 엔티티33. 월드2는 기준 커밋부터 Tiled 완성 에셋 대신 임시 지형을 쓰므로 loadedMap=false; 연결/기본 경로 회귀만 통과 | pass | 보스 결과 world2; 월드2 최종 미술 검증은 범위 밖 |
| R14 | 잔액 숫자, 일반·보스·사망·pause·clear, 작은 화면 | 정확한 보유 수 표시 | T02 0/1,234/1,234,567 세 viewport에서 잘림 없음. 보스/클리어 잔액10 유지. 기존 일반 HUD 장비 문구의 세로 화면 버튼 겹침은 별도 기존 문제로 기록 | pass | T02 wallet 화면; [보스 모바일](assets/world01-refinement-t05-boss-mobile.png), [클리어 세로](assets/world01-refinement-t05-clear-390.png) |
| R15 | 획득·사망·재획득·즉시 reload·clear | 10→13→13→14→14→14 | T02 실제 브라우저 수열 일치. 중복 overlap/가짜 지급0. 스키마2/기존 저장 키와 진행 필드 보존 | pass | T02 기록; snack-wallet 저장 회귀 |
| R16 | 이미 완료한 스테이지·반복 완료·상점 통화 | 새 획득만 적립, clear 중복 지급0 | 추가 자동 회귀에서 완료된 stage 새 획득10→11, 두 차례 complete 모두11/완료 ID 중복0. 기존 bankedCoins 구매 차감 검사 통과. 상점 UI는 추가하지 않음 | pass | scripts/snack-wallet.test.mjs 5건 |

### 통합 중 수정한 회귀

- `BowlShieldVisual`: 실제 이동에서 물리 계산 이전 위치를 그리면 최대12px 뒤처질 수 있었다. `scene.events.on("postupdate", this.syncPosition, this)`로 물리 계산 후에도 머리 위치를 맞추고 destroy에서 구독을 해제했다.
- `MapGimmickSystem.checkWorldBounds`: 낮아진 간식 위치에서 강제 이동이 화면 경계를 넘기 전에 끝나는 경우를 보완했다. 월드1의 원래 fatal outcome은 지정된 duration 종료 시에도 사망으로 처리한다.
- `Player.resetTo`: 스프라이트와 작은 발 충돌체를 함께 옮기고 `body.prev`/`body.prevFrame`을 현재 위치로 맞췄다. 이전 충돌 위치나 순간이동 delta 때문에 복귀 직후 다시 사망하지 않도록 한다.
- 완료 스테이지 재획득에 대한 wallet 회귀1건을 추가했다. 새로운 테스트 프레임워크나 production 디버그 API는 추가하지 않았다.

### 최종 명령 결과

- `npm.cmd run world01:maps:check`: 통과, 기믹32/객체58/체크포인트2.
- `node scripts/validate-assets.mjs`: 통과, 에셋53/필수31.
- `node --experimental-strip-types --test scripts/fishbone-trajectory.test.mjs scripts/calico-melee-hitbox.test.mjs scripts/cutscene-auto-advance.test.mjs scripts/bowl-defense.test.mjs scripts/samoyed-surge.test.mjs`: 13건 통과.
- `node --experimental-strip-types --test scripts/snack-wallet.test.mjs`: 5건 통과.
- `npm.cmd run test:progression`: 3건 통과. 합계21건.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 통과. Next16.3.5 프로덕션 빌드 완료.
- 실제 브라우저 검증에서 pageerror 없음. `git diff --check` 통과.

구현 및 실행 가능한 검증을 완료했다. 남은 검증 한계는 실제 음향 출력 장치 청음과 실제 모바일 터치 기기 테스트다. 기존 세로 HUD 장비 문구 겹침과 월드2 임시 지형 상태는 이번 요청 밖이며 별도 개선 대상으로 남긴다. 이전 짧은 경로 계획 T02~T04는 완료 처리하지 않는다.
