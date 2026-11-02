# Task: T03 지상 7종·공중 3종 장애물 아트

## Status: done

## Goal
사물 10종의 역할과 위험 상태를 실루엣·동작으로 읽을 수 있는 픽셀 PNG를 제작하고 프레임·발 위치를 고정한다.

## Decision Summary
- 지상: scrap/tire/oil/belt/cable/press/plate-gate. 공중: crane/swing/saw. 지형 collapse/rise는 T02의 동일 바닥 그림을 사용한다.
- 고철·압축기·문·크레인 화물은 물리 위험, 전기·추·톱은 대시로 무시할 수 있는 공격 위험이다. 새 테스트 폴더/test-plans 문서는 만들지 않는다.

## Implementation

### I01. 원화·애니메이션 프레임
- Related Files:
  - art/source/world04-scrapyard-obstacles-ground.png — 지상 원화 시트; new
  - art/source/world04-scrapyard-obstacles-air.png — 공중 원화 시트; new
  - public/assets/pixel/objects/world-03/traffic-cone.png, brick-stack.png, drum-barrel.png — 기존 스타일 비교; read-only
  - public/assets/pixel/characters/corgi/corgi-run.png — manifest에서 확인한112×128·4프레임 코기와 크기 비교; read-only
  - docs/art-style.md — 픽셀·외곽선 기준; read-only

#### Details
- **Production**: 실행 때 imagegen 스킬에 따라 기존 사물 PNG를 확인하고 참조하여 새 원화를 생성한다. 원화는 동일한 광원·외곽선·제한된 색면으로 만들고 매 프레임 사물의 기준점·크기를 유지한다. 글자·경고문·UI는 그리지 않는다.
- **Visual intent**:
  - scrap: 찢어진 자동차 철판의 날카로운 끝. 안전 플랫폼처럼 평평한 상면을 만들지 않는다.
  - tire: 압축/반발이 분명한 폐타이어. 자동 도약을 표현하되 밟기 전 경고 애니메이션을 넣지 않는다.
  - oil: 낮게 퍼진 폐유와 무지갯빛 반사. 자체 즉사 위험처럼 붉게 빛내지 않는다.
  - belt: 녹슨 프레임·움직이는 고무 벨트·방향 화살표 모양. 글자 없음.
  - cable: 꺼짐/통전/불꽃의 차이. 실제 전기 위험 폭16·높이44를 중심으로 보이게 한다.
  - press: 좌우 압축판과 배경 하우징을 구분하여 열린 통로가 명확해야 한다.
  - plate/door: 바닥 센서와 같은 금속색 차단문. 기본형의 작동 전에 경고등을 켜지 않는다.
  - crane: 상단 설비·자석·단단한 고철 화물을 분리해 위치를 실제로 이동시킬 수 있게 한다.
  - swing/saw: 몸체의 원형 위험 영역을 꽉 채우고 투명한 외곽에 충돌을 잡지 않는다. 체인·레일은 장식이다.
- **Floor warning prohibition**: 상승 바닥용 대기 프레임·균열·경고 효과를 이 시트에 추가하지 않는다. 일반 바닥과 동일한 그림으로 숨긴다.

### I02. 런타임 자산과 manifest
- Related Files:
  - scripts/build-world04-obstacles.mjs :: normalizeWorld04Obstacles — new
  - public/assets/pixel/objects/world-04/world-04-scrapyard-*.png — 아래14개 자산; new
  - src/game/assets/assetManifest.json :: 아래 entries — modify
  - scripts/world04-obstacle-assets.test.mjs — new
  - src/game/assets/assetTypes.ts :: PixelAssetDefinition — read-only

#### Details
- **Signatures & Types**:
```typescript
export async function normalizeWorld04Obstacles(
  options: { check: boolean }
): Promise<void>;
```
- **Metadata table**: 접두어 world-04-scrapyard-를 모든 key/file stem에 붙인다. 프레임은 가로 한 줄, RGBA, 정수 위치에 정렬한다.
| suffix | kind | 프레임 크기 | 수 | 전체 PNG |
| --- | --- | --- | --- | --- |
| scrap | image | 48×40 | 1 | 48×40 |
| tire | spritesheet | 72×40 | 3 | 216×40 |
| oil | image | 160×16 | 1 | 160×16 |
| belt | spritesheet | 160×24 | 4 | 640×24 |
| cable | spritesheet | 32×48 | 3 | 96×48 |
| press-left | image | 64×112 | 1 | 64×112 |
| press-right | image | 64×112 | 1 | 64×112 |
| plate | spritesheet | 48×8 | 2 | 96×8 |
| door | image | 32×144 | 1 | 32×144 |
| crane | image | 128×96 | 1 | 128×96 |
| magnet | image | 64×32 | 1 | 64×32 |
| payload | image | 72×80 | 1 | 72×80 |
| swing | image | 48×48 | 1 | 48×48 |
| saw | image | 44×44 | 1 | 44×44 |

- 실제 표의 항목은 14개다. 10종의 게임 장애물 중 압축기·차단문·크레인이 여러 이미지로 구성되는 것이며 종류 수가 늘어나는 것은 아니다.
- manifest 공통 필드: worldId=world-04,required=true,url=/assets/pixel/objects/world-04/<key>.png. image에는 frame metadata를 넣지 않고 spritesheet에만 frameWidth/frameHeight/frameCount를 모두 넣는다.
- **Data & Schema Fields**: 각 entry는 key:string,kind:"image"|"spritesheet",url:string,worldId:"world-04",required:true다. spritesheet일 때만 frameWidth:number,frameHeight:number,frameCount:number를 위 표대로 가진다. null 필드는 없다.
- tire 프레임0=대기,1=압축,2=반발. cable0=꺼짐,1=불꽃,2=통전. plate0=올라옴,1=눌림. belt0~3은 동일 몸체에서 표면만 이동한다.
- **Anchors and collision**:
  - 지상 이미지 기본 origin=(0.5,1), 발 기준504. rect와 이미지 크기를 혼동하지 않는다.
  - scrap의 실제 위험 rect는48×32 또는 최종맵48×28. 그림 하단을 맞추고 위 장식 여백은 피해에 포함하지 않는다.
  - cable 실제 위험 rect16×44는32×48 그림의 중앙에 정렬한다.
  - door 실제 충돌 폭16은32px 그림 중앙, 바닥 y504. 닫힘 시 rect top360.
  - payload72×80는 불투명한 직사각형 고철 덩어리로 그려 물리 충돌과 맞춘다.
  - swing 중심=(24,24),반지름24; saw 중심=(22,22),반지름22. 모서리 투명 픽셀은 위험 영역 밖이다.
- **Execution Flow / Logic**:
  1. sharp를 사용하는 스크립트에 원화별 crop 사각형·프레임 순서·출력 크기를 명시한다. 입력 누락/범위 초과는 Error, 임시 도형 생성으로 대체하지 않는다.
  2. nearest-neighbor 정규화, alpha 배경 정리, 발/중심 정렬 후 PNG 생성. 이미지 내용을 수정해야 하면 이미지 도구로 원화를 수정하고 정규화를 다시 실행한다.
  3. --check는 Buffer 비교만 수행한다. 기존 world-04-boss-magnet-scrap 등 보스 키를 덮어쓰지 않는다.
  4. 각 PNG의 크기·프레임·alpha·비어 있지 않은 그림·기준점과 manifest 중복을 검사한다. 테스트는 기존 scripts/ 아래 단일 파일이다.

## Acceptance Criteria
- [x] 사물10종이 14개 런타임 자산으로 완성되고 지상/공중 구분이 유지된다.
- [x] 원화와 PNG를 코기·월드3 장애물 옆에서 비교해 픽셀 스타일·크기가 맞는다.
- [x] 위험 그림과 충돌 크기의 대응이 명시되어 있고 투명 여백을 즉사 영역으로 사용하지 않는다.
- [x] 보스·기존 캐릭터 자산과 숨은 바닥의 대기 외형을 변경하지 않는다.

## Validation
- node scripts/build-world04-obstacles.mjs --check — 원화와 배포 자산 일치.
- node --experimental-strip-types --test scripts/world04-obstacle-assets.test.mjs — 14개 이미지와 프레임 검사.
- node scripts/validate-assets.mjs — 필수 URL·manifest 검사.
- npx eslint scripts/build-world04-obstacles.mjs scripts/world04-obstacle-assets.test.mjs — 스크립트 검사.
- 실제14개 자산과 애니메이션 프레임을 눈으로 확인한다. 임시 비교 이미지는 OS 임시 폴더의 파일에만 저장하고 결과는 아래 Progress에 기록한다.

## Commit Message
```text
feat(world04): 고물상 장애물 열 종류의 픽셀 아트 제작

Plan: 2026-11-02-world04-scrapyard-map-obstacles
Phase: P01-scrapyard
Task: T03-obstacle-art

- 지상 일곱 종류와 공중 세 종류의 자산과 프레임 제작
- 그림 기준점과 충돌 영역에 맞춘 에셋 검증 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 이 Task의 Plan/Phase/Task 식별자를 가진 커밋
- 검증 결과: 14개 PNG·프레임 크기/투명도/중복/앵커 검증, 정규화 --check, 전체 manifest, 대상 ESLint 통과. OS 임시 비교판에서 14개와 코기 및 월드3 콘을 육안 확인. 기본 imagegen으로 지상·공중 시트 생성 후 크레인 자석 혼입을 원화 수정으로 제거했다. 원화 art/source/world04-scrapyard-obstacles-{ground,air}.png, 배포 public/assets/pixel/objects/world-04. 프롬프트: 동일 카툰 픽셀 외곽선/3~4단 명암/녹슨 주황·회청색, 5×4 지상 프레임과 3×2 공중 부품 시트, 투명 배경·글자 없음. 학습 노트: 프레임별 고정 crop→nearest resize→발 기준 합성으로 애니메이션 기준점을 유지한다. 이미지 크기와 피해 rect는 다르며 원형 투명 모서리는 충돌에 사용하지 않는다. 범위 밖 발견: 특이사항 없음.

