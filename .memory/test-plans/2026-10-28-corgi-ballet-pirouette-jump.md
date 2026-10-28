# 코기 발레 피루엣 점프 검증 기록

- 실행일: 2026-10-28
- 대상: 월드 3을 포함한 일반 스테이지의 점프 시작부터 착지까지, 기본 코기·의상·장신구·색칠 의상

## 자동 검증

| 명령 | 결과 |
| :--- | :--- |
| `node scripts/build-corgi-pirouette-sprites.mjs --check` | 8프레임 기본 시트와 11개 착용 변형 일치 |
| `node --test scripts/corgi-pirouette-art.test.mjs scripts/corgi-pirouette-wardrobe-art.test.mjs scripts/corgi-pirouette-presentation.test.mjs scripts/corgi-pirouette-integration.test.mjs scripts/goodboy-wearables.test.mjs scripts/bite-presentation.test.mjs scripts/bark-presentation.test.mjs scripts/bite-skill.test.mjs scripts/bark-boss-stun.test.mjs` | 48개 통과 |
| `node scripts/validate-assets.mjs` | 169개 manifest 항목과 152개 필수 자산 통과 |
| `npx.cmd tsc --noEmit` | 통과 |
| `npm.cmd run lint` | 오류·경고 없이 통과 |
| `npm.cmd run build` | Next.js 16.3.5 production build 통과 |
| `node scripts/render-corgi-pirouette-review.mjs` | 접촉표 2개 재생성 성공 |

통합 하네스는 실제 `PlayerController.update → PlayerAnimator.update → PlayerWearables.sync` 순서로 점프 승인, 75ms 간격의 8프레임, 600ms 종료, 조기 착지, 재시도, 장비 교체, 색칠 의상 동적 텍스처 정리, 공중 스킬 쿨타임과 전투 방향을 확인한다. Arcade 물리 몸체의 72×40 크기와 발 오프셋은 점프 전후 동일하다. 더블 점프는 `SkillSystem.use`가 호출되었을 때 연출을 재시작하는 경로만 확인했다.

## 접촉표 육안 검사

- [기본 코기 8각도](./assets/2026-10-28-corgi-pirouette-base.png): 오른쪽 옆모습에서 정면·왼쪽 옆모습·뒷모습을 거쳐 돌아온다. 모든 각도에 새 전신, 코기의 주황·흰 무늬, 한 발로 서고 다른 발을 뻗는 발레 자세가 있다. 검은 눈에 흰 안광이 없다.
- [의상·장신구 11종](./assets/2026-10-28-corgi-pirouette-wardrobe.png): 의상 5종은 몸통과 회전 각도를 따라가고, 직접 색칠한 의상은 정면과 뒷면까지 색이 유지된다. 장신구 5종은 기본 코기 머리 위치에만 겹치고 몸통을 복제하지 않는다.
- 시트는 원본의 최근접 4배 확대이며 각 프레임의 발 기준점은 `y=99`다. 거울 시트와 UV 일치는 자동 아트 검사로 확인했다.

## 브라우저 확인 범위

로컬 개발 서버(`http://localhost:3001`)에서 월드 3 첫 일반 스테이지 **공사장 진입로**가 로드되고 코기와 지형, 장애물, HUD가 보이는 것을 확인했다. 일시정지 버튼과 재개 버튼도 반응했다. 브라우저 자동화의 키 입력은 Phaser의 점프 조작에 전달되지 않아 실제 게임 화면의 점프 중간 프레임과 착지 복귀는 직접 포착하지 못했다. 따라서 장애물 회피의 실제 체감과 공중 스킬·외형 교체의 게임 화면 결과는 미확인이다. 이 부분은 위 통합 테스트와 접촉표로만 검증되었으며, 다음 수동 플레이 점검에서 확인해야 한다.

## 변경 범위와 후속 사항

- 이번 검증 태스크는 테스트, 접촉표, 기록만 추가했다. 기존 미커밋 보스·HUD·월드 3 파일은 변경하거나 커밋하지 않았다.
- 더블 점프 입력·해금 연결은 이번 계획의 범위 밖이다.
