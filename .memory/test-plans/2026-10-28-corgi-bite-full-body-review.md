# 코기 물기 전신 시트 검증 기록

- 날짜: 2026-10-28
- 계획: `2026-10-28-corgi-bite-full-body`

## T01–T02 이미지 검증

- 기본 물기 시트는 기존 코기 run의 몸·발·꼬리 픽셀과 발 기준선을 유지한다. 네 표정의 눈에서 흰 안광을 제거했다.
- 상점 의상 5종과 직접 그린 의상 템플릿의 네 프레임을 3배 확대해 머리 1개, 의상·후드·몸통·발·꼬리 유지, 입 모양 차이를 확인했다.
- `node --test scripts/corgi-bite-art.test.mjs scripts/outfit-bite-art.test.mjs`: 9건 통과. `node scripts/validate-assets.mjs`: 필수 에셋 126개 검사 통과.

## T03 재생 검증

- 자동: `node --test scripts/corgi-bite-art.test.mjs scripts/outfit-bite-art.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-skill.test.mjs scripts/custom-outfit-paint.test.mjs`: 29건 통과. 0/79/80/159/160/239/240/319/320ms 경계, 별도 물기 Sprite 생성 0개, 의상 교체 중 물기 프레임 유지, 직접 그린 의상 4프레임 착색, 짖기·종료 복귀를 포함한다.
- 타입 검사, 변경 파일 lint, 빌드 통과.
- 개발 브라우저 `http://localhost:3001`의 월드 3 공사장 진입로에서 해금된 E 물기를 눌러 HUD가 `준비 → 6.0초`로 바뀌는 것을 확인했다. 동작 중 화면에서 코기 머리와 몸은 한 장으로 보였고 겹친 얼굴은 보이지 않았다. 브라우저 error 로그 0건.
- 브라우저 보유 카탈로그의 의상은 0종이었다. 실제 플레이 화면에서 의상 착용, 왼쪽 방향, 사망·재시도, 컷신 중단은 확인하지 못했다. 여섯 의상 시트의 확대 리뷰와 자동 테스트가 해당 경로를 검증하지만 실제 착용 화면의 육안 검증을 대신하지는 않는다.

## T04 전용 물기 효과음

- 자체 합성한 `corgi-bite.wav`는 44.1 kHz·16-bit·mono·0.20초 PCM이다. 생성 스크립트 `--check`로 파일 바이트 재현성을 확인했고 짖기 WAV와 내용이 다르다.
- 자동: 오디오·스킬·물기 연출 관련 테스트 24건 통과. `bite-hit`는 물기 버퍼를 한 번 재생하고 W 짖기는 기존 버퍼를 사용한다. 승인 이벤트 없이 `skill-used(bite)`만 발생하거나 일시정지·잠금·폐기·늦은 디코딩 뒤에는 소리를 재생하지 않는다.
- 에셋 검사 145개(필수 126개), 타입 검사, 변경 파일 lint, 빌드 통과.
- 개발 브라우저를 새로고침해 월드 3 화면 로드와 오류 로그 0건을 확인했다. 브라우저 입력으로 재생음을 직접 청음하거나 출력 장치를 통한 음색 차이를 검증하지는 못했다. E 입력 결과도 이번 브라우저 시도에서 확인되지 않아 수동 청음 결과로 간주하지 않는다.
