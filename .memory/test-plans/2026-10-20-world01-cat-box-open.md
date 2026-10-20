# 월드 1 고양이 손 상자 검증 기록

- 기준일: 2026-10-20
- 참조: 사용자 첨부 닫힌 상자/열린 상자 2장, 기존 `world-01-props.png`의 `cat-box` 프레임.
- T01 생성 방식: 내장 `image_gen` 편집. 두 첨부 이미지를 참조하여 열린 판지 상자, 회갈색 고양이 앞발, 분홍 발바닥의 픽셀 아트를 투명 배경으로 생성했다. 원본을 알파 기준으로 잘라 nearest-neighbor로 크기를 줄여 `cat-box-open.png` 128×112 RGBA로 저장했다.
- T01 프롬프트 핵심: 첫 그림의 판지 색·진한 외곽선·픽셀 밀도, 두 번째 그림의 펼쳐진 뚜껑·솟은 앞발·분홍 발바닥을 유지하며 배경/다른 고양이 부위/글자는 제외한다.
- T02 표시 크기: 닫힌 상자 44×36px, 열린 상자 64×56px. 두 이미지 모두 기존 판지 상자 바닥에 하단 정렬한다. 닫힌 이미지는 `world-01-props`의 `cat-box`, 열린 이미지는 `world-01-prop-cat-box-open`이다.
- T02 충돌: 상자 몸체 44×36px과 중앙 손 16×54px을 합집합으로 판정한다. 월드 1 코기의 실제 Arcade 몸체는 48×40px이며 기본 점프 속도 -460px/s·중력 1200px/s²를 변경하지 않았다.
- 자동 검사: `world01-box-open-art.test.mjs`, `world01-box-open.test.mjs`, `world01-respawn.test.mjs` 합계 9건 통과. `world01:maps:check`에서 월드 1 네 맵과 `box-static` 7개 확인. 타입·lint·빌드 통과.
- 실제 Chrome 1280×720, 월드 1 첫 스테이지 첫 상자(x=1152): 도약 중 `armed -> triggered`, 열린 이미지와 0사망 확인. 상자를 지난 뒤 `escaped`, 같은 열린 이미지와 0사망 확인. 걸어서 접촉하자 사망 1회 후 `armed` 및 닫힌 이미지로 복귀했다. 저장 스냅샷 복원 시 `escaped`와 열린 이미지, 새 시도 초기화 시 `armed`와 닫힌 이미지가 맞았다. `pageerror` 0건.
- 화면 증거: [점프 도중](./assets/2026-10-20-world01-box-open-midjump.png), [무사히 통과한 뒤](./assets/2026-10-20-world01-box-open-passed.png).
- 검증 범위: 실제 브라우저 조작은 스테이지 1의 상자 1개에서 수행했고, 동일 `box-static` 코드 경로를 쓰는 다른 6개는 맵 데이터와 물리 시뮬레이션으로 확인했다.
