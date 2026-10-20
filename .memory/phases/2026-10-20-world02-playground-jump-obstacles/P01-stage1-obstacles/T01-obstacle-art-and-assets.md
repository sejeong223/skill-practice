# Task: T01 놀이터 장애물 8종의 픽셀 이미지와 에셋 등록

## Status: done

## Goal

월드 2 첫 스테이지에서 사용할 8종 사물의 투명 픽셀 PNG와 고양이 할퀴기 추가 포즈를 만든다. 기존 낮 놀이터·모래 색감과 어울리고 실제 플레이 크기에서 종류가 바로 구별되어야 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-20-world02-playground-jump-obstacles.md)의 정확한 8종을 만든다. 고양이는 잠든 포즈와 할퀴기 포즈를 포함해 파일 9개다.
- 이번 Task는 이미지·manifest만 추가한다. 충돌과 배치는 T02, 고양이 소리·연출은 T03에서 연결한다.

## Implementation

### I01. 기존 배경을 기준으로 투명 PNG 9개 제작

- Related Files:
  - `public/assets/pixel/cutscenes/world-02/world-02-playground-pov.png` — 낮 놀이터의 파랑·노랑·청록·선명한 픽셀 질감 참고; read-only.
  - `public/assets/pixel/backgrounds/world-02/world-02-mid.png` — 플레이 배경 색과 원근 참고; read-only.
  - `public/assets/pixel/tiles/world-02/world-02-sand-floor.png` — 밝은 모래·연보라 자갈과 그림자 참고; read-only.
  - `public/assets/pixel/characters/corgi/corgi-run.png` — 게임에서 보이는 코기 112×128 한 프레임과 상대 크기 참고; read-only.
  - `public/assets/pixel/props/world-01/world-01-props.png` — 월드 1 소품의 자주색 픽셀 윤곽·넓은 단색 면·단순한 점눈 참고; read-only.
  - `public/assets/pixel/props/world-02/duck-spring.png` — 노란 오리 스프링 기구; new.
  - `public/assets/pixel/props/world-02/elephant-spring.png` — 청록빛 코끼리 스프링 기구; new.
  - `public/assets/pixel/props/world-02/rabbit-spring.png` — 크림/연보라 토끼 스프링 기구; new.
  - `public/assets/pixel/props/world-02/pink-sand-shovel.png` — 모래에 꽂힌 분홍 어린이 삽; new.
  - `public/assets/pixel/props/world-02/orange-traffic-cone.png` — 주황 안전 라바콘; new.
  - `public/assets/pixel/props/world-02/sleeping-fat-cat.png` — 옆으로 웅크려 자는 통통한 고양이; new.
  - `public/assets/pixel/props/world-02/scratching-fat-cat.png` — 동일 고양이가 눈을 뜨고 왼쪽으로 앞발/발톱을 뻗은 포즈; new.
  - `public/assets/pixel/props/world-02/crushed-cola-can.png` — 빨강/은색의 찌그러진 무상표 콜라 캔; new.
  - `public/assets/pixel/props/world-02/empty-snack-bag.png` — 구겨진 노랑/주황색 무상표 빈 과자 봉지; new.

#### Details

- 실행 시 `imagegen` 스킬을 읽고 처음 사용을 사용자에게 알린다. `view_image`로 실제 참고 이미지를 확인한 후 image_gen에 참고 이미지 경로를 전달하고 `transparent_background: true`로 원화를 만든다. 특히 `scratching-fat-cat.png`는 완성한 잠자는 고양이 PNG를 편집 참조로 사용해 털색·무늬·체형을 동일하게 유지한다.
- 한 파일에 장애물 하나만 남긴다. 바닥/배경/글자/이름표/말풍선/실제 브랜드 로고를 구워 넣지 않는다. 오리의 노란 몸통·주황 부리, 코끼리의 코, 토끼의 귀, 삽 날의 매몰부, 원뿔의 밝은 띠, 캔 찌그러진 윤곽, 봉지 접힘이 1× 게임 크기에서 보여야 한다.
- PNG 규격(RGBA, 투명 여백 포함, 표시 배율 1): 오리 80×64, 코끼리 88×68, 토끼 80×68, 삽 40×56, 라바콘 48×52, 잠자는/할퀴는 고양이 각 96×56, 캔 40×28, 봉지 48×32. 생성 원화를 필요 시 `sharp`의 nearest-neighbor 축소와 투명 캔버스 패딩으로 정리한다. 두 고양이는 같은 캔버스·발/배 위치를 사용한다.
- 기준점은 PNG의 불투명 물체 바닥이 마지막 1~3행에 오도록 맞춘다. 삽은 끝 6~10px이 모래에 꽂혀 보이게 그리되 주변 모래는 PNG에 넣지 않는다. 화면 배치는 T02에서 이미지 아래끝을 y=504 근처로 놓는다.
- 스프링 기구는 실제 사람이 탈 수 있는 좌석·쇠 스프링·받침이 한 덩어리로 읽혀야 한다. 동물 얼굴만 그리거나 평범한 장난감 인형처럼 만들지 않는다. 고양이는 턱시도 보스/기존 적과 헷갈리지 않는 통통한 회갈색 놀이터 고양이로 만든다.
- 사용자 피드백에 따라 동물의 눈은 흰 반짝임이 없는 작은 점눈 또는 단순한 눈매로 그리고, 광택이나 실사 음영을 없애 월드 1 소품의 만화식 픽셀 스타일을 따른다.
- `.memory/test-plans/assets/2026-10-20-world02-obstacle-contact-sheet.png`를 비교 검수용으로 저장하고, 산출물/참고/리사이즈 방법을 `.memory/test-plans/2026-10-20-world02-playground-jump-obstacles.md`에 기록한다.

### I02. 필수 에셋 등록과 이미지 검증

- Related Files:
  - `src/game/assets/assetManifest.json` :: `PIXEL_ASSETS` 원본 JSON — 9개 image 항목 추가; modify.
  - `src/game/scenes/PreloadScene.ts` :: `preload`, `loadAsset` — 기존 `required: true` 로드 경로 확인; read-only.
  - `scripts/world02-obstacle-assets.test.mjs` — 아홉 PNG의 크기·알파·manifest 검증; new.

#### Details

- 각 JSON 항목 스키마는 `{ "key": string, "kind": "image", "url": "/assets/pixel/props/world-02/<파일명>.png", "worldId": "world-02", "required": true }`다. key는 파일명 앞에 `world-02-obstacle-`을 붙인다. 예: `world-02-obstacle-duck-spring`, `world-02-obstacle-sleeping-fat-cat`. `frameWidth`/`frameHeight`는 단일 이미지에 넣지 않는다.
- `scripts/world02-obstacle-assets.test.mjs`는 `sharp`로 표의 9개 정확한 크기, RGBA 알파, 충분한 투명 가장자리, 불투명 픽셀과 바닥 끝 픽셀, 두 고양이 포즈의 외형/발 기준을 검사한다. `assetManifest.json`에서 key 중복·URL·`required`를 확인한다. 동일 입력을 그대로 복제한 두 고양이 포즈는 실패로 본다.
- 폴더 또는 파일이 빠지면 `PreloadScene`의 필수 에셋 오류로 드러나야 한다. `world-02-sand-floor.png`, 배경 3장, 기존 코기 이미지는 수정하지 않는다.

## Acceptance Criteria

- [x] 요구한 8종이 9개 투명 PNG로 존재하며 실제 게임 크기에서 알아볼 수 있다.
- [x] 잠자는/할퀴는 고양이가 같은 고양이로 보이고 발 위치가 맞는다.
- [x] 9개 필수 manifest 키와 URL이 정확하며 기존 에셋 검증을 통과한다.

## Validation

- `node --test scripts/world02-obstacle-assets.test.mjs` — 9개 PNG와 manifest 메타데이터 검증.
- `node scripts/validate-assets.mjs` — 필수 파일 누락·중복 키 없음.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run build` — 정적 로드 경로가 포함된 빌드 통과.
- 연락 시트와 실제 1× 크기를 육안 확인한다.

## Commit Message

```text
feat(world02): 놀이터 점프 장애물 8종 이미지 추가

Plan: 2026-10-20-world02-playground-jump-obstacles
Phase: P01-stage1-obstacles
Task: T01-obstacle-art-and-assets

- 모래 바닥과 어울리는 투명 픽셀 사물 8종 및 고양이 할퀴기 포즈 제작
- 필수 에셋 등록과 크기·투명도 검증 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 이미지 테스트 11건, 에셋 검사, 타입 검사, 빌드
- commit: 이 Task의 한국어 커밋
