# 월드 3 고등어 태비 보스전 검증 기록

## 구현 이력

| Task | 커밋 | 결과 |
| --- | --- | --- |
| P01-T01 | `7015d21` | 승인된 오른쪽 방향 성숙한 카툰 고등어 태비 전신 |
| P01-T02 | `66dd97c` | 시멘트 파도·덩어리 그림 |
| P01-T03 | `24c0893` | 실제 녹음 기반 벽돌·흙손·시멘트 준비음 |
| P02-T01 | `fde7db4` | 시도별 공격 순서 |
| P02-T02 | `23f5907` | 세 공격, 감속, 체력 절반 연계 |
| P03-T01 | `a83d48b` | 코기 전신 대시와 의상 |
| P03-T02 | `aa55428` | 숫자 1 대시와 공격 피해 무시 |
| P03-T03 | `ac3544c` | 전후 대화·클리어·해금·월드 4 진입 |

## 자동 검증

- `node --experimental-strip-types --test scripts/world03-boss-end-to-end.test.mjs scripts/world03-boss-combat.test.mjs scripts/dash-invulnerability.test.mjs scripts/world03-victory-flow.test.mjs scripts/world02-victory-flow.test.mjs scripts/corgi-pirouette-integration.test.mjs scripts/world03-steel-beams.test.mjs`: 종료 코드 0, **32/32 통과**.
- 통합 시나리오: 첫 진입 대화 6개, 첫 세 공격의 종류, HP 10 이하 서로 다른 두 공격, 짖기에 따른 연계 취소, 1회 승리 처리, 승리 대화 8개, 대시 보상과 월드 4 인트로 분기. 시도 1과 재시도 2를 사용해 HP·하트·방어 상태 초기화와 대시 중 피격 무시·종료 후 피격을 확인했다.
- 지상·공중 대시 연출 첫 틱에 이미 경과한 프레임 시간을 빼던 회귀를 수정했다. 지상 전신 자세와 공중 발레 회전이 대시 시작부터 250ms 유지되는 테스트를 추가했다.
- `node scripts/generate-world03-boss.mjs --check`, `node scripts/generate-world03-cement-attacks.mjs --check`, `node scripts/generate-world03-boss-attack-sfx.mjs --check`, `node scripts/build-corgi-dash-sprites.mjs --check`: 모두 종료 코드 0.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 모두 종료 코드 0.

## 화면·소리 확인

- 환경: ChatGPT 인앱 브라우저, `http://localhost:3000/`, 데스크톱 **1280×720**. 월드 3 인트로 첫 자막과 두 번째 공사장 소음 자막 및 오후 공사장 그림이 표시됐다. 콘솔 경고·오류는 없었다.
- 두 번째 자막 이후 페이지가 표시 상태(`document.visibilityState === "visible"`)이고 캔버스에 초점을 맞춘 뒤 8초 이상 기다려도 다음 자막으로 넘어가지 않았다. 이 세션에서는 보스 아레나에 도달하지 못했다. 원인은 확정하지 않았으며 보스전 수동 플레이를 통과로 간주하지 않는다.
- **미검증:** 실제 화면의 보스 상대 크기·세 준비 자세·코기 대시/의상, 조작으로 확인하는 대시 피해 면역·벽돌 정지·낙하·재시도·모달 순서, 실제 스피커에서 구분되는 세 준비음. 승인 받은 보스 시안은 [미리보기](../previews/world03-mackerel-right-adult-concept.png)에 보관되어 있다.
- 효과음은 각 0.22/0.25/0.27초 WAV의 원본 녹음과 CC0 근거를 [오디오 출처](../../public/assets/audio/ATTRIBUTION.md)에 기록했다. 자산 재생성 검사와 음원 출처 확인은 청음을 대신하지 않는다.

## 작업 범위

- 테스트를 위한 HP 축소나 보상 우회 코드는 추가하지 않았다.
- 기존 미커밋 발레 점프 자산과 월드 1·2·4·5 관련 작업은 보존했다.
- 인트로 자동 진행 문제는 이 검증에서 발견한 수동 테스트 차단 요인으로 기록했다. 별도 원인 조사와 실제 플레이 확인이 필요하다.
