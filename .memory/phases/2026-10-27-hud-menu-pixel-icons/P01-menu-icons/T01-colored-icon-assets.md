# Task: T01 우측 상단 메뉴 컬러 픽셀 이미지 7종 제작

## Status: done

## Goal

32×32 베이지색 메뉴 버튼 안에서 20×20로 표시해도 용도를 알아볼 수 있는 투명 컬러 픽셀 PNG 7장을 제작한다. 이후 UI 연결 Task가 파일명만으로 각 버튼에 대응시킬 수 있어야 한다.

## Decision Summary

- 사용자가 요청한 메뉴는 여섯 종류이고 `재생/일시정지`는 서로 다른 두 상태이므로 파일은 7장이다. 최종 규격은 각 20×20 PNG, RGBA, 사방 최소 1px 투명 여백이다.
- 내장 `imagegen`으로 각각 독립된 래스터 원화를 생성한다. 기존 버튼의 베이지 `#e8cda0` 위에서 보이도록 진한 자주색 외곽선 `#5f3942`를 공통으로 쓰고, 노랑 `#f0b95f`, 청록 `#44adac`, 산호 `#e95f68`, 연두 `#9ed760`, 크림 `#fff8e5`를 구분용 포인트 색으로 사용한다.

## Implementation

### I01. 각 기능의 색과 실루엣이 다른 새 이미지 생성

- Related Files:
  - `public/assets/pixel/ui/corgi-face.png` :: 기존 24×24 투명 픽셀 UI 그림의 외곽선·픽셀 크기 참조; read-only
  - `public/assets/pixel/ui/menu-palette.png` :: 그림판용 팔레트; new
  - `public/assets/pixel/ui/menu-bag.png` :: 보유 아이템 카탈로그용 손잡이 달린 가방; new
  - `public/assets/pixel/ui/menu-shop.png` :: 상점용 줄무늬 차양과 문이 있는 가게; new
  - `public/assets/pixel/ui/menu-pause.png` :: 플레이 중 표시할 두 개의 수직 일시정지 막대; new
  - `public/assets/pixel/ui/menu-play.png` :: 일시정지 중 표시할 오른쪽 방향 재생 삼각형; new
  - `public/assets/pixel/ui/menu-reset-clockwise.png` :: 저장 진행 초기화용 시계방향 끊어진 원형 화살표; new
  - `public/assets/pixel/ui/menu-map.png` :: 월드 선택용 3단 접이식 지도; new

#### Details

- **Signatures & Types**:
  ```typescript
  // 런타임 모듈을 추가하지 않는 public 정적 파일 계약.
  type MenuIconFilename =
    | "menu-palette.png" | "menu-bag.png" | "menu-shop.png"
    | "menu-pause.png" | "menu-play.png"
    | "menu-reset-clockwise.png" | "menu-map.png";
  // 각 파일: PNG 20×20 px, RGBA 8-bit, 투명 배경.
  ```
- **Data & Schema Fields**:
  - 픽셀 데이터 외 신규 저장 필드·Phaser manifest 키는 없다. React는 `/assets/pixel/ui/{파일명}`으로 직접 읽는다.
  - 팔레트는 황금색 판과 산호·청록·연두 물감 3점 및 엄지 구멍, 가방은 갈색 몸체·손잡이·청록 잠금쇠, 상점은 산호/크림 차양과 문을 갖는다.
  - 일시정지는 청록색 두 막대, 재생은 연두색 오른쪽 삼각형으로 모양과 색 모두 다르게 한다. 초기화는 산호색 시계방향 C형 호에 분명한 틈과 끝의 화살촉을 두며 숫자·전원 기호·반시계방향 화살표를 넣지 않는다. 지도는 크림색 접힌 3패널과 청록 길·산호 목적지 점을 갖는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 구현 시작 시 `imagegen` 스킬을 읽고 적용 사실을 알린다. `view_image`로 `corgi-face.png`를 확인하고 기존 HUD의 버튼 32×32/안쪽 20×20/베이지 바탕을 참고한다. 로컬 Next 가이드 `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`와 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`를 읽는다.
  2. Core Processing: 내장 `image_gen`에 `transparent_background: true`와 기존 코기 UI 그림을 스타일 참조로 전달한다. 아이콘마다 별도 호출해 한 아이콘만 중앙에 크게 그린다. 공통 프롬프트에는 `crisp 2D pixel art, 20×20 virtual pixel grid, dark plum outline, transparent outside silhouette, no text, no button background, no glow/blur`를 넣고 위 형태·색을 개별로 지정한다. 생성 원본에서 피사체를 골라 투명 캔버스에 중앙 정렬하고 필요하면 nearest-neighbor 방식으로 최종 20×20에 정리한다. 실제 게임 버튼의 1배 크기와 4배 확대 미리보기를 둘 다 눈으로 비교한다.
  3. Error & Exception Handling: 생성 결과에 불투명 사각 배경, 가독성 없는 작은 세부, 뒤집힌 초기화 방향 또는 파일 간 같은 실루엣이 있으면 다시 생성/수정한다. 내장 도구가 실패하면 임의로 CLI/API 모드로 전환하지 않는다. 기존 `corgi-face.png`나 다른 에셋은 덮어쓰지 않는다.
  4. State Transition & Return: 위 7개 경로에 최종 PNG가 존재하고 이미지 자체에 버튼 테두리·배경을 포함하지 않는다. UI 연결이나 Phaser manifest 수정은 이 Task에서 하지 않는다.

### I02. 실제 PNG의 크기·투명도·구별성 검증

- Related Files:
  - `scripts/hud-menu-icon-assets.test.mjs` :: 일곱 파일의 실제 PNG 계약을 `node:test`와 `sharp`로 확인; new
  - `scripts/validate-assets.mjs` :: 기존 Phaser 에셋 검사와 충돌이 없는지 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 테스트 내 자료 구조. 프로덕션 타입 추가 없음.
  type ExpectedIcon = { filename: MenuIconFilename; label: string };
  // sharp(file).metadata() / sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ```
- **Data & Schema Fields**: 파일 목록은 위 7개를 정확히 사용한다. 파일명 중복, 파일 미존재, 이미지 해시 중복을 실패로 처리한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `public/assets/pixel/ui/` 기준으로 각 파일을 읽는다.
  2. Core Processing: `format="png"`, width=20, height=20, `hasAlpha=true`, RGBA 4채널, 사방 바깥 1px의 alpha=0, 불투명 픽셀 수 30~260, 보이는 부분에 최소 두 개 이상의 RGB 색상이 있는지 검사한다. 일곱 PNG의 바이트 해시가 모두 달라야 한다.
  3. Error & Exception Handling: 시계방향 의미·가방/상점 구별처럼 픽셀 통계로 검증할 수 없는 항목은 1배 브라우저/이미지 뷰어의 눈검사로 기록한다. 비어 있거나 과도하게 채워진 PNG는 채택하지 않는다.
  4. State Transition & Return: 에셋 테스트 통과와 육안 검토 후 T02의 입력 파일이 준비된다.

## Acceptance Criteria

- [ ] 팔레트·가방·상점·재생·일시정지·시계방향 끊어진 원형 화살표·지도가 각각 독립된 20×20 투명 컬러 PNG로 존재한다.
- [ ] 베이지색 버튼 바탕에서 원래 크기로 각 실루엣과 색을 구별할 수 있고 확대 시 픽셀 경계가 선명하다.
- [ ] Phaser manifest, 기존 UI 파일과 기존 미커밋 변경을 수정하지 않는다.

## Validation

- `node --test scripts/hud-menu-icon-assets.test.mjs` — 7개 PNG의 규격·투명도·색·중복 검사 통과.
- `node scripts/validate-assets.mjs` — 기존 Phaser 필수 에셋 검사 통과.
- 이미지 뷰어로 20×20 원본과 4배 nearest-neighbor 확대를 확인 — 사용자가 지정한 일곱 모양과 초기화 화살표 방향 확인.

## Commit Message

```text
feat(ui): 메뉴용 컬러 픽셀 아이콘 일곱 개 제작하기

Plan: 2026-10-27-hud-menu-pixel-icons
Phase: P01-menu-icons
Task: T01-colored-icon-assets

- 그림판·가방·상점·재생·일시정지·초기화·지도 이미지를 추가
- 실제 PNG 규격과 투명도·색 구별 검사를 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: T01-colored-icon-assets
