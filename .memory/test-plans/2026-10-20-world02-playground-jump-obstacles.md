# 월드 2 놀이터 점프 장애물 검증 기록

## T01 — 이미지와 에셋

- 월드 1 `world-01-props.png`를 선·면·눈 스타일의 기준으로 사용하고, 월드 2 놀이터 배경과 모래의 밝은 노랑·청록·분홍을 색 참고로 사용했다.
- 기본 제공 imagegen 도구로 각 물건의 투명 원화를 제작하고, 동물의 눈을 흰 안광 없는 점눈으로 수정했다. `sharp`의 nearest-neighbor 축소·투명 패딩·32색 팔레트로 9개 게임 크기 PNG를 만들었다. 과자 봉지 원화의 배경빛은 투명 알파로 정리했다.
- 결과물: `public/assets/pixel/props/world-02/`의 PNG 9개. 비교 이미지: [연락 시트](./assets/2026-10-20-world02-obstacle-contact-sheet.png).
- 검증: `node --test scripts/world02-obstacle-assets.test.mjs` 11/11, `node scripts/validate-assets.mjs` 통과(70항목·필수 49개), `npm.cmd run build` 통과, `node node_modules/typescript/bin/tsc --noEmit` 통과. 1× PNG를 2배 확대 연락 시트로 육안 확인했다.

## T02 — 배치와 일반 충돌

- 월드 2 첫 스테이지의 색 사각형 임시 함정·적을 제거하고, 8종 PNG의 바닥 기준을 y=504로 맞췄다. 코인의 경로, 연속 모래 발판, 체크포인트와 출구는 유지했다.
- 일반 7종에는 보이지 않는 정적 Arcade Zone의 overlap을 연결하고 기존 `death-requested` 이벤트를 전송한다. 고양이는 T03을 위해 특수 접촉으로 구분했다.
- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-sand-floor.test.mjs` 16/16, `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit` 모두 통과했다. 실제 충돌·점프와 체크포인트 재시작은 T04에서 확인한다.

## T03 — 고양이 하악질과 할퀴기

- 처음 제안한 Wikimedia 녹음은 HTTP 429로 다운로드가 거부되어 [Zabuhailo의 CC0 하악질 녹음](https://www.marefa.org/%D9%85%D9%84%D9%81:Cat_hissing_-_Zabuhailo.wav)으로 교체했다. 0.98~1.93초를 44.1kHz·mono·PCM16 WAV로 변환하고 8ms 페이드를 주었다. 저작자·라이선스·변환 내역·SHA-256은 `public/assets/audio/ATTRIBUTION.md`에 있다.
- 상태·오디오 테스트 `node --test scripts/world02-cat-attack.test.mjs scripts/audio-pause.test.mjs scripts/world02-obstacles.test.mjs` 17/17, 에셋 검사, 린트, 빌드, 타입 검사 통과.
- 실제 Chrome에서 첫 스테이지에 PNG 8종과 연속 모래 바닥이 로드됐다. 고양이 접촉 약 90ms 뒤 공격 이미지·효과음 요청 1건·활성 오디오 버퍼 source 1개·사망 0건, 약 450ms 뒤 사망 1건·시작점 복귀·잠든 고양이 복원·페이지 오류 0건을 확인했다. [공격 순간 화면](./assets/2026-10-20-world02-cat-scratch.png). 실행 환경의 도구는 직접 청음을 지원하지 않으므로 음색은 실제 녹음의 출처와 신호 검증에 근거한다.

## T04 — 실제 플레이와 통합 검증

- Chrome 1280×720에서 첫 스테이지 시작점 x=96부터 출구까지 오른쪽 이동을 계속하고 각 사물 약 92px 앞에서 기본 점프를 눌렀다. 캔·봉지·삽·라바콘·오리·고양이·코끼리·토끼를 순서대로 넘어 사망 0회로 `world-02-stage-2`에 진입했다. 각 장애물 직전에서도 오른쪽 이동과 기본 점프 한 번으로 각각 통과했으며, 잠자는 고양이를 넘을 때 할퀴기·사망·소리 요청은 없었다.
- 최종 물리 Zone은 아래와 같다. 이미지 바닥과 연속 모래 충돌면은 y=504다.

  | 장애물 | x | Zone 폭×높이 |
  | :--- | ---: | :--- |
  | 찌그러진 콜라 캔 | 420 | 28×18 |
  | 빈 과자 봉지 | 760 | 34×22 |
  | 분홍 장난감 삽 | 1100 | 26×40 |
  | 주황 라바콘 | 1460 | 34×40 |
  | 오리 스프링 기구 | 1810 | 42×44 |
  | 잠자는 뚱뚱한 고양이 | 2160 | 62×32 |
  | 코끼리 스프링 기구 | 2850 | 44×44 |
  | 토끼 스프링 기구 | 3220 | 42×44 |

- 일반 장애물 7종을 각각 걸어서 접촉하면 사망 횟수가 정확히 1씩 증가하고 시작점 x=96으로 돌아왔다. 체크포인트 x=2496을 활성화한 뒤 코끼리와 접촉하면 x=2496, 발 y=504로 복귀했다. 브라우저에서 기존 체크포인트가 발 y=520으로 저장돼 모래 속에서 추락하던 문제를 발견해 월드 2 첫 스테이지 깃발의 중심 y를 444로 조정했다. 이후 즉시 재사망 없이 같은 위치에 섰다. 코인 7개를 지나간 뒤에도 사망·재시작과 코인 HUD가 동작했다.
- 고양이 접촉 시 공격 이미지·발톱 그래픽·`cat-hiss` 요청·활성 오디오 source 1개를 확인했다. 약 360ms 뒤 사망 1회, 시작점 복귀 및 잠든 이미지 복원 순서로 진행됐다. 공격 도중 650ms 일시정지해도 남은 시간이 276ms에서 변하지 않았고, 재개 후에만 사망했다. 월드 1로 전환할 때 Phaser가 이미 파괴한 고양이 이미지에 질감을 다시 지정해 발생하던 오류를 수정하고 회귀 테스트를 추가했다. 전환 후 월드 1에는 새 장애물 시스템이 없고 월드 2로 돌아오면 장애물 8개와 잠든 고양이가 새로 생성됐다.
- 390×844 모바일 화면에서 짖기 쿨타임 상자를 폭 96px로 줄여 코기를 가리지 않게 했다. 브라우저 투영 좌표에서 상자 오른쪽 x=100, 코기 중심 x≈117이며 실제 화면에서도 분리돼 보인다. 모바일은 기존 16:9 게임 화면을 세로 화면 중앙에 맞추므로 상하 여백이 남는다.
- 증거 화면: [첫 구간](./assets/2026-10-20-world02-obstacle-start.png), [고양이 공격](./assets/2026-10-20-world02-cat-scratch.png), [체크포인트 이후 기구](./assets/2026-10-20-world02-obstacle-after-checkpoint.png), [모바일](./assets/2026-10-20-world02-obstacle-mobile.png). 브라우저 `pageerror` 0건, 필수 `/assets/` 404 0건. 음원은 실제 고양이 하악질 녹음이며 브라우저 재생 요청과 버퍼 source까지 확인했다. 실행 환경에 직접 청음 수단이 없어 사람 귀로 들리는 인상은 확인하지 못했다.
- 검증: 관련 자동 테스트 37/37, `node scripts/validate-assets.mjs` 70항목·필수 49개 통과, `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit` 통과.
