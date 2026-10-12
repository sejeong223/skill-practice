# 보스전 기존 땅 적용과 밥그릇 방어음 수정

- 요청: 보스전에 일반 맵의 땅을 그대로 적용. 배경음은 들리지만 밥그릇으로 생선 가시를 막는 소리가 들리지 않는 문제 수정.
- 환경: Windows, Chromium headless, 실제 게임 런타임. 테스트 저장소를 따로 사용해 사용자 세이브를 변경하지 않았다.

## 기존 땅

- `StageScene.createBossGround`가 기존 `world-01-tileset`의 표면1/내부13 타일을 재사용한다. 이미지 생성·편집 없음.
- 기존 발판 윗면 y504를 유지하고, x0~1920 및 화면 아래까지 이어지는 1920×224 타일 지형을 만든다. 기존 단색 발판은 숨기고 플레이어 충돌을 새 타일 레이어에 연결한다.
- 일반 맵과 표면/내부 타일 인덱스·텍스처 이름 일치. x32/960/1888에서 body.bottom=504, 실제 키보드 점프 후 착지504 확인.
- 기존 보스 코인3개·HP10 유지. 일반 맵 이동 후 지형 정리, 보스 재진입 시 바닥 레이어1개. 브라우저 pageerror 없음.
- [적용 화면](assets/world01-boss-ground.png).

## 방어음

- 기존에는 BGM=Tone 컨텍스트, 합성 효과음=Phaser 컨텍스트였다. BGM이 running인 상태에서 Phaser만 suspend하면 기존 효과음 source0으로 무음이 재현됐다. 사용자 기기에서 이 상태 전이가 일어났는지 직접 관찰한 것은 아니다.
- `AudioManager`의 합성 효과음도 BGM과 같은 Tone 컨텍스트를 사용하도록 변경했다. 같은 재현 조건에서 effect=running/source3으로 출력된다. 장면 종료 시 공유 컨텍스트를 닫지 않는다.
- 초기 입력 이후 다시 정지된 오디오도 다음 키/포인터 입력에서 재개하도록 unlock 구독을 유지하며 destroy에서 해제한다. 정지 중 놓친 효과음을 나중에 몰아서 재생하지 않는다.
- 금속음의 세 배음 gain을0.075/0.026/0.010으로 조정하고 길이를280ms로 늘렸다. 기존 sine/2400Hz lowpass/3ms attack을 유지해 짧고 부드러운 반응을 목표로 한다.
- 실제 보스 `updateFishbone` 충돌4회: 방어잔여2→1→0→0, 하트3→3→3→2, clang 이벤트3회/필터3개. 실시간 분석기 표본 peak0.0519/0.0528/0.0792로 각 방어의 비영 출력 확인. 네 번째 충돌에서는 추가 clang 없음.
- suspend 후 다음 키 입력으로 running 복원, 과거 효과음 재생0. 보스 재진입 시 공유 컨텍스트 유지/running, 이전 source0, clang 구독2개(오디오1+시각1).
- [측정 JSON](assets/world01-bowl-clang-fixed.json), [방어음 녹음](assets/world01-bowl-clang-fixed.webm). 실제 스피커·이어폰 청음은 실행 환경에서 지원하지 않아 미실시다.

## 검증

- `npm.cmd run world01:maps:check`: 일반 맵4개/기믹32/객체58 통과.
- `npx.cmd tsc --noEmit`: 통과.
- `npx.cmd eslint src/game/scenes/StageScene.ts src/game/audio/AudioManager.ts`: 통과.
- `node --experimental-strip-types --test scripts/bowl-defense.test.mjs scripts/samoyed-surge.test.mjs scripts/fishbone-trajectory.test.mjs scripts/calico-melee-hitbox.test.mjs scripts/cutscene-auto-advance.test.mjs`: 13건 통과.
- `npm.cmd run build`: 프로덕션 빌드 통과.
- `git diff --check`: 통과.

이전 짧은 경로 계획의 보스 아레나1280px·배경 단일화 등은 이 요청의 완료 범위에 포함하지 않는다. 기존 상점·재도전 후속 계획과 사망 후 간식 재획득 정책은 유지한다.
