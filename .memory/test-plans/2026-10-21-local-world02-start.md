# 로컬 개발 실행의 월드 2 시작 검증 기록

## 동작

- `npm run dev`에서는 기존 저장이 없더라도 월드 1 온보딩 대신 [월드 2 진입 컷신](./assets/2026-10-21-local-world02-start-entrance.png)을 보여 주고 `world-02-stage-1`로 이어진다. 이미 `world-02-intro`를 본 저장이면 컷신을 반복하지 않고 첫 스테이지에 바로 들어간다.
- 월드 1을 선택한 기존 저장도 로컬 재실행에서는 [월드 2 첫 스테이지](./assets/2026-10-21-local-world02-start-saved.png)로 들어간다. 브라우저에서 이름 `초코`, 코인 37개, 사망 5회, 소유한 `squeaky-ball`이 유지됐다. 저장에 월드 2 첫 스테이지 클리어 표시가 있어도 개발 시작은 첫 스테이지로 고정됐다.
- 개발 시작 상태에는 월드 1 보스 완료·짖기 해금 표시를 중복 없이 보충하므로 [월드 선택 메뉴](./assets/2026-10-21-local-world02-start-world-select.png)를 사용할 수 있다. 실제 버튼으로 월드 1을 고른 뒤 `world-01-stage-1`에 진입했다.
- 개발 상태 보정은 로드 후 메모리에서 수행한다. 원본 코인·장비·사망 값은 초기화하지 않는다. 다만 기존 자동 저장은 월드 1 보스 완료·짖기 해금·선택 월드 표시를 이후 브라우저 저장소에 기록할 수 있다. 새 저장 스키마나 강제 저장 삭제는 없다.
- 배포 실행은 `isDevelopment=false`일 때 기존 상태·시작 경로를 그대로 사용한다. `next build`는 통과했다. 배포 서버를 별도 브라우저에서 수동 실행하는 검사는 하지 않았다.

## 검증

- 자동 테스트: `node --test scripts/development-world02-start.test.mjs scripts/world-selection.test.mjs scripts/stage-progression.test.mjs` — **14/14** 통과.
- `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` 통과.
- Chrome 1280×720, `http://localhost:3001`에서 새 저장·기존 저장·월드 1 재선택을 확인했다. 재현 스크립트: `node .memory/test-plans/browser-local-world02-start.mjs` (CDP 포트 9228). 브라우저 예외 **0건**, 필수 `/assets/` 404 **0건**.
