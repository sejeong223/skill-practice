# 삼색이 방향·승리 대화 기절 이미지 검증

- 대상: P01/T02, `World01CalicoBoss` 및 `StageScene`.
- 근접 판정·생선 가시·방패·컷신 자동11건, 타입 검사, lint, diff 공백 검사 통과.
- [실제 Chromium 기록](./assets/calico-facing-collapse.json): ready/telegraph/projectile 각각 코기가 좌측이면 flipX=true, 우측이면 false. 같은 x에서는 이전 방향 유지. 몸체 좌표/크기와 HP 이름표 위치 동일.
- 투척 경고 중 좌→우로 이동하면 오른쪽으로 발사한다. 발사 뒤 다시 왼쪽으로 가면 보스 방향만 바뀌고 기존 trajectory는 동일하다.
- 실제 J 마지막 공격 후 cutscene-started부터 frame2·tint 해제·마지막 방향을 확인했다. 자동8개 대사, 클릭/Space/Enter 수동8개, 재시청 Escape 건너뛰기에서 모든 관찰 대사에 frame2 유지. stopAttacks 3회 재호출 후에도 동일하다.
- T01 통합: 대화 중 코기의 최대 좌표 변화 x/y 모두0px. 각 승리에서 보상1개/완료1회/사망 증가0. HP가 남은 전투 중단은 frame0. resetAttempt는 좌우 각각 frame0/HP10/방향을 복원했다.
- [오른쪽 방향 화면](./assets/calico-facing-right.png), [첫 승리 대사 화면](./assets/calico-victory-first-dialogue.png)을 육안 확인했다. 새 이미지는 만들지 않고 기존96×96 스프라이트 frame2를 사용했다.
- 브라우저 pageerror0건. 실제 모바일 터치 검증은 별도로 수행하지 않았다.
- 알아야 할 점: phase defeated만으로는 보스 사망을 알 수 없다. health0까지 확인하는 isDefeated를 사용해 코기 패배와 구별한다. 재정리 때에도 frame2를 보존해야 한다.
- 요청 범위 밖 발견: 특이사항 없음.
