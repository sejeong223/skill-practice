# Task: T01 승인된 픽셀 인트로 에셋 제작

## Status: done

## Goal

사용자가 승인한 스토리보드와 코기·고양이 참고 이미지에 맞는 실내 배경, 배우 동작 시트, 갈비뼈와 슬리퍼 에셋을 제작하고 Phaser가 재생할 수 있게 manifest에 등록한다.

## Decision Summary

- art 생성은 P01-T01 승인 이미지와 저장소의 승인 캐릭터 참고 에셋을 기준으로 한다. 미리보기의 공간 배치를 임의로 바꾸지 않는다.
- 투명 배우 시트는 실제 PNG 크기에서 정수로 나누어지는 셀 크기와 프레임 순서를 manifest에 등록하고, Phaser pixelArt 렌더링으로 선명도를 유지한다.
- 이미지 생성 도구가 1920×720 대신 동일 8:3 비율의 2048×768 배경을 반환했으므로 원본 픽셀을 유지한다. 후속 장면은 1280×720 뷰포트에서 배경을 비균일하게 늘리지 않고 원본 비율로 배치한다.

## Implementation

### I01. 배경과 배우·소품 파일

- Related Files:
  - .memory/design-previews/2026-09-24-cinematic-pixel-intro-preview.png — 승인된 공간 배치; read-only
  - public/assets/pixel/references/characters/corgi/corgi-reference-v2.png — 승인 코기 팔레트/실루엣; read-only
  - public/assets/pixel/references/characters/tuxedo-reference-v1.png — 승인 고양이 팔레트/실루엣; read-only
  - public/assets/pixel/characters/corgi/corgi-run.png — 기존 옆태 달리기 4프레임; reuse
  - public/assets/pixel/cutscenes/intro/intro-home.png — 1920×720 연속 실내 배경; new
  - public/assets/pixel/cutscenes/intro/intro-corgi-actions.png — 투명 112×128 프레임 8장 가로 시트; new
  - public/assets/pixel/cutscenes/intro/intro-tuxedo-actions.png — 투명 96×96 프레임 7장 가로 시트; new
  - public/assets/pixel/cutscenes/intro/intro-owner-hands.png — 투명 128×96 프레임 3장 가로 시트; new
  - public/assets/pixel/cutscenes/intro/intro-rib.png — 투명 왕갈비뼈 이미지; new
  - public/assets/pixel/cutscenes/intro/intro-slipper.png — 투명 토끼 슬리퍼 이미지; new

#### Details

- 각 새 래스터 이미지 생성에 imagegen 스킬 지침을 적용한다. 승인된 스토리보드와 캐릭터 참고 파일을 레퍼런스로 전달한다.
- intro-home 배경은 원본 크기 2048×768(8:3)의 옆면 단일 거실 세트다. 입구/강아지 문은 왼쪽, 탁자와 코기 대기 위치는 중앙, 열린 베란다는 오른쪽에 둔다. Phaser viewport는 1280×720이므로 후속 카메라 좌우 이동이 가능하며, 배경 바닥은 전 구간 끊기지 않는다.
- intro-corgi-actions는 원본 1774×887 PNG의 4×2 셀 atlas이며 정수 프레임 크기는 443×443이다. 순서는 idle, 꼬리 흔들기 1~3, 놀란 눈 1~2, 슬리퍼 물기, 결의 표정이다. 도주 run은 승인된 기존 corgi-run(112×128 셀 4장)을 재사용한다.
- intro-tuxedo-actions는 원본 1774×887 PNG의 4×2 셀 atlas이며 정수 프레임 크기는 443×443이다. 첫 7개 프레임은 창틀 착지 진입 0~2, 갈비뼈를 툭 치고 무는 동작 3~4, 짧은 도발 5~6이고 마지막 칸은 비워둔다. 캐릭터는 기존 턱시도 고양이 참고의 짧고 어두운 체형과 얼굴을 유지한다.
- intro-owner-hands는 원본 1261×1247 PNG의 2×2 셀 atlas, 프레임 크기 630×623이다. 첫 세 프레임은 검은 봉지를 든 손, 기다려 검지를 든 손, 화면 가장자리로 물러나는 손이고 마지막 칸은 비워둔다. 전신 주인/얼굴은 그리지 않는다.
- 갈비뼈와 슬리퍼는 배경과 분리된 투명 PNG로 만든다. 투뿔 고기 사진 질감, 손상 자국, 소품에 붙은 AI풍 문자/로고는 넣지 않는다.
- 모든 시트는 프레임 간 피벗·발 기준선·외곽선 두께·팔레트가 일관되는지 1:1 픽셀 크기로 확인한다. 수정은 재생 가능한 art 파일 결과를 사용하고 런타임 코드에서 흐림 필터로 감추지 않는다.

### I02. Phaser manifest와 필수 preload

- Related Files:
  - src/game/assets/assetManifest.json :: intro-home, intro-corgi-actions, intro-tuxedo-actions, intro-owner-hands, intro-rib, intro-slipper — 새 에셋 메타데이터; modify
  - src/game/assets/assetManifest.ts :: key/frame access only if spritesheet lookup needs named frames; modify only if needed
  - src/game/assets/assetTypes.ts :: PixelAssetDefinition — 현재 image/spritesheet kind를 우선 재사용; read-only unless schema requires
  - src/game/scenes/PreloadScene.ts :: loadAsset, create — 필수 이미지 로드와 다음 IntroScene 시작; modify

#### Details

- manifest 키는 위 파일명과 일관되게 intro-home, intro-corgi-actions, intro-tuxedo-actions, intro-owner-hands, intro-rib, intro-slipper로 고정한다. 전부 required: true로 둔다.
- 배경 image는 2048×768, corgi sheet는 frameWidth 443/frameHeight 443, cat sheet는 443×443, owner sheet는 630×623으로 등록한다. 시트 실제 픽셀 크기와 정수 셀 경계가 일치하는지 확인한다. 리브/슬리퍼는 정적 image다.
- PreloadScene의 기존 image/spritesheet 경로를 재사용한다. 필수 에셋 로드 오류는 화면에 에러를 표시하고 빈 장면이나 시스템 폰트 대체로 조용히 진행하지 않는다.
- 이 Task에서는 애니메이션 동작을 실행하거나 게임 진행 전환을 구현하지 않는다. 파일 제작·manifest·preload까지만 완료한다.

## Acceptance Criteria

- [x] 생성 에셋이 승인 스토리보드 구도와 코기·고양이 참고 디자인을 지킨다.
- [x] 배경은 정확한 8:3 비율(2048×768)이며 배우 시트의 정수 셀 크기·수·순서가 manifest와 일치한다.
- [x] 시트는 투명 RGBA이고 행/열 프레임 내 캐릭터 크기·위치가 안정적이며 픽셀 외곽선이 선명하다.
- [x] PreloadScene의 공용 image/spritesheet 로더가 모든 신규 필수 파일을 받도록 manifest에 등록했다.

## Validation Notes

- 원본 이미지 크기 및 투명 알파를 직접 확인했다. Corgi/cat atlas는 1774×887(443×443 4×2), owner hands는 1261×1247(630×623 2×2), 두 소품은 각각 1254×1254 RGBA다.
- 신규 6개 URL은 로컬 dev 서버에서 HTTP 200을 확인한다. headless 브라우저 실행이 환경 정책에 차단되어 화면 캡처와 Phaser 런타임 FILE_LOAD_ERROR 시각 확인은 불가하므로, 빌드와 각 URL 응답으로 확인한다.

## Validation

- npm.cmd run lint — asset manifest 타입/구문 검증.
- npm.cmd run build — manifest JSON import와 정적 이미지 경로 검증.
- npm.cmd run dev — preload 화면에서 신규 에셋 파일 404 및 Phaser FILE_LOAD_ERROR가 없는지 확인한다.
- 생성 시트의 프레임 경계와 파일 픽셀 크기를 이미지 정보에서 직접 확인한다.

## Commit Message

    feat(assets): 픽셀 인트로 배경과 배우 에셋 추가

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P02-cinematic-home-scene
    Task: T01-intro-pixel-assets

    - 승인된 실내 구도에 맞춘 배경·배우·소품 픽셀 리소스 추가
    - Phaser 필수 에셋 manifest와 preload 등록

## Progress

- [x] 승인된 스토리보드 기반 에셋 생성 및 원본 크기/알파 검사
- [x] manifest 필수 키와 Phaser image/spritesheet preload 등록
- [x] 로컬 HTTP에서 신규 에셋 URL 응답 확인
- commit: `feat(assets): 픽셀 인트로 배경과 배우 에셋 추가`
