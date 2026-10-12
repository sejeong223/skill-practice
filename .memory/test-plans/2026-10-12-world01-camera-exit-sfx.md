# 대사 카메라·출구·깃발 부활·새 효과음 검증

- 날짜: 2026-10-12, Asia/Seoul.
- [계획](../plans/2026-10-12-world01-camera-exit-sfx.md), [결정](../decisions/2026-10-12-world01-camera-exit-sfx.md).
- Windows / 기존 localhost:3000 개발 서버 / Chromium headless. 데스크톱1280×720과 모바일 화면390×844. 기존 서버와 무관한 미커밋 메모리 변경을 보존했다.

## 결과

| 항목 | 확인 방법과 결과 | 상태 | 증거 |
| :--- | :--- | :--- | :--- |
| 대사별 초점 | 보스 도입·클리어의 삼색이→코기 전환, zoom1, worldView가1920×720 내부. 빠른 대사 진행 완료 후 조작/추적 복원 | pass | [측정](assets/world01-speaker-camera.json), [삼색이](assets/world01-camera-calico.png), [코기](assets/world01-camera-corgi.png) |
| 보이지 않는 출구 | 1~4단계 옛 출구 x2432에서는 play 유지/완료0. 실제 오른쪽 키로 끝을 완전히 이탈하면 다음 단계로 각각 완료1회 | pass | [전환 기록](assets/world01-exit-checkpoint.json) |
| 실제 깃발 부활 | 2단계 깃발 이전 장애물 사망은 시작96/512, 깃발 뒤 실제 가짜 간식 사망2회는 모두1529/480. 차임 활성화 이벤트1회, 깃발1개, 사각형 visible=false | pass | [부활 기록](assets/world01-exit-checkpoint.json), [부활 화면](assets/world01-flag-respawn.png) |
| 보스 실패 복원/다른 월드 | 4단계 자동 복원2329/512로 실제 깃발 바닥과 일치. 월드2도 체크포인트 표시 사각형 없이 깃발1개 | pass | 같은 부활 기록 |
| 간식 획득음 | 첫 간식을 실제 키보드 이동으로 획득, 잔액10→11, 0.40초 WAV source1개, 출력 peak0.23337. 종료 source0, BGM gain1 복원 | pass | [측정](assets/world01-new-sfx.json), [플레이 출력 녹음](assets/world01-new-coin.webm) |
| 새 체크포인트 차임 | 2단계 실제 이동으로 첫 활성화, 1.05초 WAV source1개, 출력 peak0.27295. 재접촉/코인 재생성 시 source0·peak0 | pass | [측정](assets/world01-new-sfx.json), [플레이 출력 녹음](assets/world01-new-checkpoint.webm) |
| 음량·일시정지 경계 | 새 효과음 동안 BGM gain0.38, 종료 뒤1. 재생 중 정지하면 source0/gain0, 재개 시1. 늦은 해독/잠금 해제/폐기 경계 자동 테스트 | pass | 새 효과음 측정, `scripts/audio-pause.test.mjs` |
| 기존 정지 동작 | 일반/보스 각5초: ticks506/893 고정, 출력 peak0. 재개 후755/1178과 출력 복원. 각각10회 토글 및 모바일 크기·초기화 창 겹침·씬 변경 확인 | pass | [정지 측정](assets/world01-current-pause.json), [모바일 화면](assets/world01-current-pause-mobile.png) |
| 기존 방어음 | 실제 생선 가시 충돌3회, clang3회와 출력 peak0.1080/0.0878/0.1080. 3회 뒤 사모예드5마리 왼쪽 진입, 네 번째 피격에 체력 감소. 공용 컨텍스트/씬 정리 유지 | pass | [방어 측정](assets/world01-current-bowl.json), [방어 녹음](assets/world01-current-bowl.webm) |
| 스피커 청음/실기기 | 실제 장치에서 소리 분위기·체감 음량 및 터치를 평가하지 않음. 출력 파형/버퍼/이벤트 검증과 구분 | not-run | 원음 및 녹음 파일을 제공 |

각 최종 브라우저 검증에서 pageerror0, 새 효과음 검증의 console error0을 확인했다. 효과음은 원래 사용자 스피커 설정을 직접 확인한 것으로 표현하지 않는다.

## 새로 제작한 음원

- [간식 동전 소리](../../public/assets/audio/coin-pickup.wav): 0.40초, 반짝이는 동전2음과 짧은 금속성 배음.
- [체크포인트 띠리링](../../public/assets/audio/checkpoint-chime.wav): 1.05초, 상승4음과 잔향.
- `scripts/generate-feedback-audio.mjs`로 새로 합성한 mono44100Hz/PCM16 WAV. 기존 WAV나 기존 실시간 효과음을 복사하지 않았다. 마지막35ms fade와 peak0.65 정규화로 끝단 급변/클리핑을 방지한다.
- BGM과 동일한 Tone rawContext에서 새 BufferSource를 재생한다. 간식은 새 `coin-collected` 이벤트만 사용하며 UI·저장용 `coin-changed`에는 소리를 연결하지 않는다. 깃발은 실제 최초 활성화에만 재생한다.
- [파일 크기·SHA256](assets/world01-map-audio-comparison.json).

## 맵이 비슷한 이유

- 스테이지 파일은 4개이며 순서는1→2→3→4→보스다. 잘못된 단계 재진입은 이번 실제 끝 통과 검증에서 발생하지 않았다.
- **1/3의 gameplay 타일 배열은 실제 동일**하다. `getWorld01FloorY()`가 둘 다512 평지, `getWorld01StageTheme()`도 같은 기본 중경, `realSnackXs`도 동일하다. 일부 장애물 종류와 가짜 간식 효과만 달라 반복감이 생긴다.
- **2/4의 배열은 서로 다르지만 비슷한512→496→480→496→512 구조**다. 2단계는1024/1280/1792/2048에서, 4단계는896/1152/1664/1920에서 높이가 바뀐다. 장애물·간식·체크포인트 위치도 다르다.
- 2단계 지붕길/4단계 빨랫줄 중경 이미지는 서로 다른 파일·SHA256이며, 같은 낮 골목 테마를 공유한다. [비교 결과](assets/world01-map-audio-comparison.json).
- 사용자 요청은 원인 설명이므로 맵 지형/이미지 재설계는 하지 않았다.

## 자동 검사와 커밋

- 전체 테스트38/38 통과: `rg --files scripts -g '*.test.mjs'`로 모아 `node --experimental-strip-types --test` 실행.
- `node scripts/generate-feedback-audio.mjs --check`, `npm.cmd run world01:maps:check`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` 통과. 일반맵4개/기믹32개/객체58개 보존.
- T01 `dc60625`: 화자별 카메라. T02 `974eb99`: 출구/깃발 부활. T03 `7691fdf`: 신규 효과음 제작·연결·통합 검증.
- 기존 밥그릇·HP10·사모예드5마리·지갑 재획득 정책은 유지했다. 추가로 임의 실행할 작업은 없다.
