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

- 미실행. T04 완료 시 생성 WAV, 이벤트·일시정지 테스트, 브라우저 청음 결과를 여기에 추가한다.
