# 월드 3 안전 콘·시멘트 포대 히트박스 검증 기록

## 자동 검사

- `node --experimental-strip-types --test scripts/world03-construction-obstacles.test.mjs scripts/world03-construction-assets.test.mjs scripts/world03-construction-stages.test.mjs`: 10건 통과. 두 PNG의 알파 범위와 4단 띠, 윗부분의 빈 공간과 하단 접촉 좌표, 한 시도당 사망 이벤트 1회, 재시작·해제, 드럼·손수레·스테이지 배치를 검사했다.
- `node scripts/validate-assets.mjs`: 등록 자산 171개, 필수 155개 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 통과. PowerShell 실행 정책에 맞춰 npm/npx의 `.cmd` 실행기를 사용했다.

## 실제 화면

- 로컬 개발 서버와 브라우저에서 월드 3 첫 인트로 화면까지 열었다. 이 브라우저 세션에서는 첫 자막이 완성된 뒤 장면 시간이 진행되지 않아 스테이지 1의 안전 콘(x=380)·포대(x=740)에 직접 접촉하는 화면 검증은 수행하지 못했다.
- 따라서 실제 플레이 감각은 미확인이다. 자동 검사는 윗부분 빈 공간이 판정에서 빠지고 하단 판정이 남는 좌표 계약을 확인한다. 브라우저에서의 접촉 결과와 동일하다고 단정하지 않는다.

## 범위

- 안전 콘·시멘트 포대 PNG, 나머지 장애물 4종, 굴러가는 드럼통, 철골 빔, 보스 벽돌, 코기 몸체 판정은 변경하지 않았다.
