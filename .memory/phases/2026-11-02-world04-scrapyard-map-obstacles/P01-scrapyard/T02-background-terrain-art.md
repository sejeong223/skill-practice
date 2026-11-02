# Task: T02 노을빛 고물상 배경과 지형 아트

## Status: done

## Goal
일반맵 네 장소가 서로 구분되면서 월드 1~3과 같은 작품으로 보이는 배경·지형 PNG를 제작하고 필수 에셋으로 등록한다.

## Decision Summary
- 노을빛 하늘·녹슨 주황 고철·회청색 그림자·노란 작업등을 사용한다. 뒤쪽 장소로 갈수록 그늘과 기계 조명을 강조한다.
- 게임 지형 연결은 T07이다. 이 Task는 완성 PNG·재현 가능한 정규화 스크립트·manifest만 추가한다. 테스트 폴더/test-plans 문서를 만들지 않는다.

## Implementation

### I01. 기존 그림을 기준으로 원화 제작
- Related Files:
  - docs/art-style.md — 외곽선·픽셀·명암 기준; read-only
  - public/assets/pixel/backgrounds/world-01/world-01-mid.png — 주거지 배경의 묘사 수준; read-only
  - public/assets/pixel/backgrounds/world-02/world-02-mid.png — 사물의 픽셀 표현; read-only
  - public/assets/pixel/backgrounds/world-03/world-03-mid-1.png — 직전 월드 공사장; read-only
  - public/assets/pixel/objects/world-03/traffic-cone.png — 위험물 스케일 비교; read-only
  - art/source/world04-scrapyard-far.png — 먼 배경 원화; new
  - art/source/world04-scrapyard-mid-1.png ~ world04-scrapyard-mid-4.png — 네 중경 원화; new
  - art/source/world04-scrapyard-foreground.png — 전경 원화; new
  - art/source/world04-scrapyard-terrain-sheet.png — 바닥·발판·상승판 원화; new

#### Details
- **Asset production contract**: 실행 단계에서 imagegen 스킬을 읽고 적용하며, 위 기존 PNG를 먼저 눈으로 확인한 뒤 참조 이미지로 전달한다. 밝은 카툰 픽셀 외곽선, 단계적인 명암, 코기와 맞는 사물 크기를 요청한다. 단순 사각형/SVG 도형으로 기존 그림을 대체하지 않는다.
- **Prompts**: 플레이어·고양이·글자·로고·HUD를 넣지 않는다. 원화는 아래 장소의 실제 설비를 풍부하게 묘사하되, 통과 경로·위험물·함정의 정확한 위치를 배경에 그리지 않는다.
| 중경 | 장소·랜드마크 | 조명 |
| --- | --- | --- |
| 1 | 고물상 입구 철망, 낮은 폐차 더미, 낡은 작업실 | 살구빛 하늘과 긴 회청색 그림자 |
| 2 | 분류된 폐타이어·차체·고철 적재장, 운반 설비 | 바랜 청록색 차체와 녹슨 주황 강조 |
| 3 | 큰 압축기 설비, 철골 지붕, 작업 통로 | 천장 그늘, 노란 작업등 |
| 4 | 냥아치 경비 통로의 철문·감시 설비·아지트 외벽 | 깊은 그늘, 작업등과 붉은 경보등 포인트 |
- **Transparency**: far만 불투명. mid는 하늘·주요 플레이 경로가 투명하고 바닥면을 별도 실체로 그리지 않는다. foreground는 y120~548 전 구간을 투명하게 유지해 장애물/코기를 가리지 않는다.
- **Terrain**: floor 윗면은 완전히 같은 재질로 반복한다. collapse/rise 위치에 균열·경고띠·색 변화·높이 차이를 미리 그리지 않는다. 발판 윗면은 평평하고 안전한 면임을 알 수 있게 하며 날카로운 고철 그림과 구분한다.
- **Error handling**: 원화가 없거나 스타일·투명도가 맞지 않으면 생성/수정 후 다시 검수한다. 임시 도형을 완성 아트로 커밋하지 않는다.

### I02. 정확한 출력 크기와 에셋 등록
- Related Files:
  - scripts/build-world04-backgrounds.mjs :: normalizeWorld04Backgrounds — 원화에서 배포 파일 생성; new
  - public/assets/pixel/backgrounds/world-04/world-04-scrapyard-far.png — new
  - public/assets/pixel/backgrounds/world-04/world-04-scrapyard-mid-1.png ~ -mid-4.png — new
  - public/assets/pixel/backgrounds/world-04/world-04-scrapyard-foreground.png — new
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-floor.png — new
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-platform.png — new
  - public/assets/pixel/tiles/world-04/world-04-scrapyard-rise-column.png — new
  - src/game/assets/assetManifest.json :: PIXEL_ASSETS entries — modify
  - scripts/world04-background-assets.test.mjs — new

#### Details
- **Signatures & Types**:
```typescript
// .mjs의 공개 함수 계약. 실제 구현은 JavaScript로 작성한다.
export async function normalizeWorld04Backgrounds(
  options: { check: boolean }
): Promise<void>;
```
- **Output table**: 아래 key와 파일 stem은 동일하다. 모두 kind=image, worldId=world-04, required=true이고 /assets/pixel/ 이하 URL을 사용한다.
- **Data & Schema Fields**: manifest entry는 key:string,kind:"image",url:string,worldId:"world-04",required:true다. crop table은 sourcePath:string,left:number,top:number,width:number,height:number,outputWidth:number,outputHeight:number이며 모두 필수·non-null이다.
| key | 폴더 | PNG 크기 | 표시 계약 |
| --- | --- | --- | --- |
| world-04-scrapyard-far | backgrounds/world-04 | 1280×720 | 불투명, 가로 반복 |
| world-04-scrapyard-mid-1~4 | backgrounds/world-04 | 각각1920×720 | RGBA, 지평 기준 y504 |
| world-04-scrapyard-foreground | backgrounds/world-04 | 1280×720 | RGBA, 플레이 높이120~548 투명 |
| world-04-scrapyard-floor | tiles/world-04 | 128×216 | top=0 불투명 바닥, 월드 y504부터 표시 |
| world-04-scrapyard-platform | tiles/world-04 | 128×24 | top=0에 평평한 발판 상면 |
| world-04-scrapyard-rise-column | tiles/world-04 | 112×320 | 활성 상태의 수직 단면, 상단 재질은 일반 바닥과 동일 |

- 원화 terrain-sheet에서 세 산출물을 추출할 영역은 생성 결과에 맞춰 스크립트 안의 명시적 crop table로 고정한다. 표에는 source path, left/top/width/height, outputWidth/outputHeight를 모두 기록하며 자동 추측으로 매 실행 결과를 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. 이미 설치된 sharp와 node:fs/promises를 사용한다. 입력 누락·잘못된 crop 범위는 파일명을 담은 Error로 종료한다. 의존성 추가는 없다.
  2. 원화의 픽셀을 nearest-neighbor로 정규화하고 RGBA PNG로 저장한다. 확대/축소 뒤 코기·기존 월드와 픽셀 크기를 눈으로 비교한다.
  3. --check에서는 동일한 출력 Buffer를 메모리에서 만들고 배포 파일과 비교만 한다. 파일·폴더를 만들지 않는다.
  4. manifest에 위9개 키(중경4개 포함)를 중복 없이 추가한다. 기존 world-04-boss-scrapyard/tileset/보스 자산을 덮어쓰지 않는다.
- **Tests**: 크기·alpha·키/URL·required, 서로 다른 중경 네 장, foreground 플레이 구간 alpha=0, 바닥의 반복 경계, 일반/숨은 바닥이 같은 원본을 사용하도록 키가 하나인 점을 검증한다. 자동 테스트로 미술적 품질을 판정했다고 주장하지 않는다.
- 배경 미리보기는 도구의 이미지 보기 또는 OS 임시 폴더의 개별 PNG만 사용한다. .memory/test-plans·새 screenshots 폴더를 만들지 않는다.

## Acceptance Criteria
- [x] 네 장소의 중경과 공통 far/foreground/지형이 월드 1~3의 픽셀 표현과 일치한다.
- [x] 플레이 바닥과 함정 위치가 배경에 미리 그려져 있지 않다.
- [x] 9개 배포 PNG가 manifest에 등록되고 --check가 원화를 변경하지 않는다.
- [x] 기존 보스·인트로 배경은 이 Task의 변경 목록에 없다.

## Validation
- node scripts/build-world04-backgrounds.mjs --check — 원화와 배포 파일 일치.
- node --experimental-strip-types --test scripts/world04-background-assets.test.mjs — 9개 PNG 규격·투명도 검사.
- node scripts/validate-assets.mjs — manifest 필수 파일 검사.
- npx eslint scripts/build-world04-backgrounds.mjs scripts/world04-background-assets.test.mjs — 스크립트 검사.
- 실제 PNG 9개를 이미지 도구로 확인하고 비교한 기존 파일명·스타일 일치 여부를 Progress에 기록한다.

## Commit Message
```text
feat(world04): 노을 고물상 배경과 지형 아트 제작

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T02-background-terrain-art

- 네 일반맵의 중경과 공통 노을 배경 제작
- 안전 발판과 숨은 바닥에 사용할 지형 자산 등록
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 식별자를 가진 커밋
- 검증 결과: 9개 PNG 규격·필수 manifest·정규화 재현·ESLint 통과. 월드 1/2/3 mid와 OS 임시 contact sheet에서 9개 출력 육안 비교 완료. 기본 imagegen 도구로 원화 7장 생성. 프롬프트: 기존 상세 카툰 픽셀 외곽선과 단계 명암, 노을 살구 하늘/녹슨 주황/회청색 그늘, 장소별 입구·분류장·압축장·경비 통로, 캐릭터·글자·실제 위험 배치 제외. 원화 art/source/world04-scrapyard-*.png, 배포 public/assets/pixel/{backgrounds,tiles}/world-04. 학습 노트: sharp extract→nearest resize로 크기를 고정하고 mid 밑선을504에 맞춘다. 숨은 함정은 일반 floor 키를 공유한다. 범위 밖 발견: 특이사항 없음.

