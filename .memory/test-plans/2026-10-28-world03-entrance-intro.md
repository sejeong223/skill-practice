# 월드 3 공사장 인트로 검증 기록

## 자동 검증

- `node --experimental-strip-types --test scripts/world03-entrance-routing.test.mjs scripts/development-world03-start.test.mjs scripts/world03-entrance-scene.test.mjs scripts/world03-entrance-content.test.mjs scripts/world03-intro-audio.test.mjs scripts/stage-progression.test.mjs scripts/audio-pause.test.mjs`: 38건 통과. 첫 진입·재방문·선택 월드 재도전·후속 스테이지 복귀, 여섯 beat, 초상화·효과음 키·정리 동작을 검사했다.
- `node scripts/validate-assets.mjs`: 171개 등록 자산, 필수 155개 검증 통과.
- `node scripts/generate-world03-intro-sfx.mjs --check`: 두 WAV 생성 결과 일치.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과. PowerShell 실행 정책 때문에 npm/npx의 `.cmd` 실행기를 사용했다.

## 실제 화면

- 로컬 개발 서버의 첫 월드 3 진입에서 공사장 배경과 첫 자막이 표시됐다. 배경은 월드 2 인트로 픽셀 그림과 같은 선·색·질감으로 확인했다. 코기 초상화 파일도 월드 2 초상화와 나란히 비교했고, 각진 픽셀 윤곽과 안광 없는 눈을 확인했다.
- 이 브라우저 세션에서는 첫 자막을 모두 표시한 뒤 Phaser 시간이 진행되지 않았다. 따라서 여섯 beat의 연속 재생, 화면 속 두 초상화 전환, 종료 후 새로고침·재방문, 모바일 배치는 실제 화면에서 확인하지 못했다. 이 항목들은 위 자동 테스트로만 검증됐다.
- 이 환경에서는 WAV를 직접 청음할 수 없었다. 길이·형식·반복 생성·재생 키·음량 설정은 자동 검증했다. 음악과 두 효과음의 실제 청감은 미확인이다.

## 결과

코드·자산·번들 검사와 첫 장면의 픽셀 화면 확인은 통과했다. 연속 재생·모바일 화면·청음은 수동 확인이 남아 있다.
