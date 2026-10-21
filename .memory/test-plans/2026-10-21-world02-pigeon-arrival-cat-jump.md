# 월드 2 비둘기 등장·고양이 점프 확인

## T01 비둘기

- 단위 테스트 10건 통과: 첫 생성 후 50/1550/3050ms에 새 한 마리씩 생성, 배설·사망·일시정지·체크포인트 확인.
- Chrome 실게임 확인: 두 번째 생성 간격 1516.7ms, 첫 비둘기의 세 배설 간격 833.3/816.5ms, 배설 좌표 1364/1280/1196px, 체크포인트 부활 성공, 런타임·자산 오류 없음.
- `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit` 통과.

## T02 고양이

- 잠든 그림·할퀴기 그림은 100×60px, 실제 접촉 구역은 40×26px로 축소.
- 월드 2 장애물·고양이·비둘기·사망 단위 테스트 18건 통과.
- Chrome 실게임에서 코기가 x=2048에서 달리기 시작해 점프로 고양이를 넘어 x=2253에 착지했고, 고양이 사망 0건이었다. 비둘기 1516.6ms 등장, 세 배설, 체크포인트 사망도 재확인했다.
- `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit` 통과.
