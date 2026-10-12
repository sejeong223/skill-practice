# 검증: 맵 끝 전환 구간 낙하 방지

## 변경과 원인

플레이어 이동 범위는 `mapWidth + 256`까지였지만 충돌 타일은 `mapWidth`에서 끝났다. 코기의 충돌 몸체가 그림보다 작아, 몸체가 바닥을 벗어난 뒤 그림이 완전히 사라지기 전부터 중력이 작용했다. 수정 전 실제 1단계에서 완료 순간15px, 전환 대기까지 최대40.33px 낙하를 확인했다.

`src/game/scenes/StageScene.ts`의 `createExitFloor()`는 마지막 타일의 지면 높이를 읽어 화면 밖 물리 경계까지 보이지 않는 정적 바닥을 이어 붙인다. `this.physics.add.collider(this.player, this.exitFloor)`로 플레이어를 지탱한다. 정적 Arcade body는 중력으로 움직이지 않는 충돌 표면이다. 씬 종료 때 정리한다.

알아야 할 점: 카메라 경계를 늘리지 않고 마지막 바닥의 높이에 맞춰야 한다. 중력을 끄거나 완료 지점을 앞당기면 점프와 화면 이탈 연출이 달라진다. 지면 없는 맵 끝이나 보스에는 바닥을 자동 생성하지 않는다.

## 실행 결과

- `node --experimental-strip-types --test scripts/stage-progression.test.mjs scripts/checkpoint-feedback.test.mjs`: 6/6 통과.
- `npm.cmd run world01:maps:check`: 4맵·기믹32개·객체58개 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`: 통과. 마지막 변경 뒤 빌드 내 타입 검사도 통과.
- `git diff --check`: 통과.
- 실제 Chromium/Phaser에서 각 맵 끝100px 전으로 이동시킨 뒤 ArrowRight 입력으로 통과. 프레임별 좌표/속도 및 완료 이벤트를 수집했다. 전환은 모두 1→2→3→4→보스 순서로 발생했다.

| 맵 | 발 높이 | 최대 낙하 | 최대 하강 속도 | 완료 이벤트 |
| :--- | ---: | ---: | ---: | ---: |
| 1 | 512 | 0px | 0 | 1회 |
| 2 | 512 | 0px | 0 | 1회 |
| 3 | 512 | 0px | 0 | 1회 |
| 4 | 512 | 0px | 0 | 1회 |

- 모든 맵에서 완전히 화면을 벗어나야 완료된다. 180ms 전환 대기 중에도 높이가 유지된다.
- 바닥 판정 x2559~2816, y512, invisible. 카메라 너비2560 유지.
- x2592(화면 밖으로 일부 나간 위치)에서 500ms 일시정지 시 좌표 유지. 재개 후 왼쪽으로 걸어 화면 안에 복귀해도 높이512, play 상태 유지.
- 씬마다 이전 바닥 객체가 제거되며 보스에는 바닥 연장 없음. 브라우저 오류0건.
- [수정 전 프레임 기록](./assets/world01-exit-floor-baseline.json), [수정 후 기록](./assets/world01-exit-floor.json), [끝에서 되돌아온 화면](./assets/world01-exit-floor.png).

## 범위 밖에서 확인한 점

월드2 이후는 실제 타일맵 대신 임시 segment 플랫폼을 사용하며, `createSegment()`의 플랫폼 중심/너비와 `offsetPlatform()`의 오프셋 조합으로 마지막 플랫폼이 맵 경계 전에 끝난다. 이 구간 전체를 숨겨진 바닥으로 메우면 화면 안에서 허공을 걷게 되므로 이번 수정으로 메우지 않는다. 해당 월드 제작 시 실제 지형을 끝까지 연결해야 한다. 현재 월드1 네 맵의 전환 수정에는 영향을 주지 않는다.

실제 모바일 기기 검증은 수행하지 않았다. 위 결과는 데스크톱 Chromium에서의 실제 게임 실행 결과다.
