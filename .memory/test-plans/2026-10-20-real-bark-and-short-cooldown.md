# 실제 개 짖음과 3초 쿨타임 검증

## 음원 출처와 가공

- 원본: [George vuf 1996.ogg](https://commons.wikimedia.org/wiki/File:George_vuf_1996.ogg). Wikimedia Commons의 설명은 래브라도 George의 단발 짖음이며, 저작권자가 공개 도메인으로 배포했다.
- 원본 보존: [George-vuf-1996.ogg](./assets/George-vuf-1996.ogg), SHA-256 `0915BCDC936EBFEDD725D99C8FE74745C61C895CA099E016F987A4067289716F`.
- Chrome `AudioContext.decodeAudioData`로 원본 Ogg를 디코딩했다. 좌우 채널을 평균해 모노로 만들고 평균값을 빼 DC 오프셋을 제거한 다음 최대 진폭 0.8로 정규화하고 마지막 6ms에 페이드아웃을 적용했다. 44100Hz·16비트 PCM WAV로 저장했다.
- 게임 에셋: `public/assets/audio/corgi-bark.wav`, 0.324초, 28,612바이트, SHA-256 `A6BEF8552D77B39CF41A33E8F5B10D4C95B51B8CB58A854C7523E64D294F8827`.
- 기존 AudioManager는 Tone과 공용인 Web Audio 컨텍스트로 이 파일을 재생한다. 별도 오디오 컨텍스트나 브라우저 내 합성 짖음을 추가하지 않았다.

## 확인 항목

- WAV 헤더, 길이, 진폭, 무음 아님, 마지막 샘플 페이드아웃.
- 첫 사용 후 2999ms 입력 거절, 3000ms 입력 성공, 3·6번째 성공에서 경고 발생.
- 짖기 성공 시 정확히 한 번 재생, 쿨타임 거절 시 재생 없음, 일시정지 시 소리 정지.
- 타입 검사와 프로덕션 빌드, 가능하면 브라우저의 실제 로딩/입력 확인.

## 결과

- `node --test scripts/bark-audio-assets.test.mjs scripts/boss-feedback.test.mjs scripts/audio-pause.test.mjs`: 14개 통과.
- `node node_modules/typescript/bin/tsc --noEmit`: 통과.
- 수정 파일 ESLint: 통과.
- `npm.cmd run build`: Next.js 16.3.5 프로덕션 빌드 통과.
- Chrome 실제 게임 보스전에서 짖기 3회 입력. 각각 0.324초 길이의 PCM 버퍼 1개씩 재생됐고 버퍼 RMS는 약 0.159였다. 첫 입력 직후 남은 시간은 약 2.8초, 쿨타임 중 재입력 시 재생 수는 늘지 않았다. 두 번 모두 3초 경과 후 재입력이 가능했고 세 번째 성공 사용에서 `bark-third` 경고가 발생했다. 페이지 오류 0건.
- 자동 검증은 실제 스피커 청음의 주관적 음색 평가는 대체하지 않는다.
