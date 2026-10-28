# Task: T01 월드 3 인트로 대본과 픽셀 그림

## Status: done

## Goal

`world-03-intro`를 확정된 여섯 장면 대본으로 교체하고, 오후 공사장 배경과 기본 코기 표정 두 장을 필수 이미지로 등록한다. 실제 파일이 없는 낡은 월드 3 선택형 맵 항목을 정리해 이후 장면 Task가 정확한 텍스트·그림 키만 사용하게 한다.

## Decision Summary

- 월드 2 인트로와 같은 자동 진행 beat 구조를 사용한다. 문구·순서를 바꾸거나 기존 `world-03-intro`와 중복 ID를 만들지 않는다.
- 공사장 그림은 오후 3~4시 하늘, 기침·결의 초상화는 착용 의상 없는 기본 코기와 안광 없는 검은 눈으로 만든다.
- 사용자가 선택한 인접 정리: 실제 파일과 코드 참조가 없는 `world-03-map-placeholder` manifest 항목을 제거한다.

## Implementation

### I01. 임시 인트로를 여섯 beat로 교체

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD03_ENTRANCE_CUTSCENE`, `WORLD_CUTSCENES` — 확정 대본 정의와 기존 임시 항목 교체; modify
  - `src/game/cutscenes/types.ts` :: `CutsceneScript`, `CutsceneBeat` — 기존 타입 계약 확인, 수정 불필요; read-only
  - `scripts/stage-progression.test.mjs` :: `world 3 and 4 intros and later boss intros match their locations` — 상수로 분리해도 월드 3 대본 검증이 유지되도록 테스트 수정; modify
  - `scripts/world03-entrance-content.test.mjs` :: 월드 3 인트로 내용 검증 — 새 테스트; new

#### Details

- **Signatures & Types**:
  ```typescript
  export const WORLD03_ENTRANCE_CUTSCENE: CutsceneScript;
  export const WORLD_CUTSCENES: readonly CutsceneScript[];
  // CutsceneBeat: id:string, durationMs:number, narration?:string,
  // dialogue?:readonly {speaker:CutsceneSpeaker;text:string}[],
  // musicKey?:string, soundCue?:string, skipAllowedAfterSeen:boolean.
  ```
- **Data & Schema Fields**:
  - `WORLD03_ENTRANCE_CUTSCENE.id`: 정확히 `world-03-intro`; `stageId`: `world-03-stage-1`; `beats.length`: 6.
  - beat ID/시간/형식: `construction-reveal` 7500ms 나레이션 + `musicKey:"world-03-factory"`; `construction-noise` 7000ms 나레이션 + `soundCue:"world-03-drill"`; `corgi-cough` 5000ms 코기 대사; `rebar-cement` 7500ms 나레이션; `rib-instinct` 6500ms 나레이션; `corgi-resolved` 4800ms 코기 대사. 전부 `skipAllowedAfterSeen:true`.
  - 정확한 대본(구두점·띄어쓰기 포함):
    1. `지옥의 놀이터를 헤쳐 나온 코기의 앞에 웅장한 위엄을 드러낸 곳은... 철근과 시멘트 가루가 춤추는 위험천만 공사장.`
    2. `사방에서 들려오는 진동드릴 소음과 굴착기의 굉음 속에서, 냥아치들은 이미 자신들만의 요새를 구축하고 있었다.`
    3. 코기: `콜록콜록! 이 먼지 구덩이에 시멘트 냄새까지... 강아지 호흡기 다 망가지겠네!`
    4. `시뻘건 철근이 사방으로 널려 있고, 발 밑은 아직 굳지 않은 촉촉한 시멘트가 코기의 짧은 다리를 유혹하고 있었다.`
    5. `누가 봐도 냥아치들의 덫이지만, 15cm 다리의 왕갈비뼈 집착 본능은 위험을 아예 지워버렸다.`
    6. 코기: `먼지 좀 마시면 어때! 내 갈비뼈만 찾으면 그만이다, 기다려라 냥아치들!`
- **Execution Flow / Logic**:
  1. 기존 한 줄짜리 `{id:"world-03-intro", ...}` 항목을 `WORLD03_ENTRANCE_CUTSCENE` 참조로 교체한다. 다른 월드·보스 대본은 유지한다.
  2. 1·2·4·5번은 `narration`, 3·6번은 `dialogue:[{speaker:"corgi",text:...}]`에 넣는다. 두 번째 효과음은 T02에서 키를 등록하고 T03에서 장면 도중 굴착기 소리를 추가한다.
  3. 기존 `stage-progression.test.mjs`는 배열 내부의 `id: "world-03-intro"` 리터럴을 찾는다. 상수 추출 후 실제 `WORLD03_ENTRANCE_CUTSCENE`을 검증하도록 해당 부분을 고쳐 테스트가 대본 위치에 종속되지 않게 한다.
  4. 새 테스트는 ID 1개, 여섯 문장·순서·화자, 음악·드릴 cue, 모두 본 후 스킵 가능 여부를 검증한다.

### I02. 전용 픽셀 그림 세 장과 manifest

- Related Files:
  - `public/assets/pixel/cutscenes/world-03/world-03-construction-pov.png` :: 오후 공사장 전경 — 새 이미지; new
  - `public/assets/pixel/cutscenes/world-03/world-03-corgi-cough.png` :: 기침하는 기본 코기 — 투명 배경 새 이미지; new
  - `public/assets/pixel/cutscenes/world-03/world-03-corgi-resolved.png` :: 결의에 찬 기본 코기 — 투명 배경 새 이미지; new
  - `art/source/world-03-entrance/` :: 세 그림의 원본 작업 자산 — 후속 수정을 위한 원본; new
  - `src/game/assets/assetManifest.json` :: 세 이미지 `PixelAssetDefinition` 등록과 낡은 `world-03-map-placeholder` 제거; modify
  - `scripts/world03-entrance-content.test.mjs` :: PNG와 manifest 검사 — 새 테스트; new

#### Details

- **Signatures & Types**:
  ```typescript
  type AssetKind = "image" | "spritesheet" | "atlas" | "audio" | "tilemap";
  interface PixelAssetDefinition {
    readonly key: string;
    readonly kind: AssetKind;
    readonly url: string;
    readonly worldId?: string;
    readonly required: boolean;
  }
  ```
- **Data & Schema Fields**:
  - 키/URL: `world-03-entrance-construction` → `/assets/pixel/cutscenes/world-03/world-03-construction-pov.png`; `world-03-entrance-corgi-cough` → `/assets/pixel/cutscenes/world-03/world-03-corgi-cough.png`; `world-03-entrance-corgi-resolved` → `/assets/pixel/cutscenes/world-03/world-03-corgi-resolved.png`.
  - 세 manifest 항목 모두 `kind:"image"`, `worldId:"world-03"`, `required:true`; 프레임 필드는 없다.
  - 배경은 1280×720 화면을 중앙 기준으로 채울 수 있는 넓은 가로 구도다. 3~4시의 푸른 하늘과 따뜻한 오후 빛, 철근·시멘트·크레인·굴착기·먼지 층을 담고 자막 하단 영역에는 복잡한 글자 모양의 사물을 피한다. 인트로 자막 텍스트를 그림에 새기지 않는다.
  - 초상화는 배경 투명한 정사각형 구도이며 주황·흰색 코기의 기존 얼굴 비율과 검은 눈을 유지한다. 기침에는 눈 찡그림·앞발/입 주변 먼지, 결의에는 정면을 향한 단호한 표정을 준다. 두 그림에 의상·흰 안광·발레 자세를 넣지 않는다.
- **Execution Flow / Logic**:
  1. 사용자 승인된 새 비트맵 제작 도구로 세 그림을 생성하고 원본을 `art/source/world-03-entrance/`에 보관한다. 게임용 PNG를 위 경로에 둔다.
  2. 월드 2 PNG는 배경 `1672×941 RGB`, 초상화 `1254×1254 RGBA`다. 정확한 픽셀 크기를 강제하지 말고 배경은 넓은 가로 구도, 초상화는 정사각형·실제 알파 투명도를 확인한다. T03에서 배경 비율을 보존하며 화면을 채운다.
  3. `world-03-map-placeholder`는 `required:false`지만 `/assets/pixel/maps/world-03/world-03-stage-1.json`이 존재하지 않고 코드 참조도 없다. 이 항목 하나만 manifest에서 제거한다. 다른 선택형 맵과 실제 월드 3 배경·스테이지 자산은 유지한다.
  4. 새 테스트는 실제 PNG 파일, 이미지 헤더의 유효한 폭·높이, 초상화 알파, 세 필수 manifest 항목의 중복 없는 키·URL, `world-03-map-placeholder` 부재를 검사한다. 눈·색·원근감은 시각 검토로 확인한다.

## Acceptance Criteria

- [ ] `WORLD_CUTSCENES` 안의 월드 3 인트로는 ID가 하나이고 여섯 줄의 문구·화자·순서가 사용자 대본과 같다.
- [ ] 오후 3~4시 공사장 그림 1장과 의상 없는 기본 코기 그림 2장이 로드되며 기존 코기 눈에 흰 안광이 없다.
- [ ] 파일이 없는 `world-03-map-placeholder` 항목만 제거되고 다른 월드 3 맵·배경 자산은 유지된다.
- [ ] 기존 월드 2·4·5 컷신과 보스 대사가 바뀌지 않는다.

## Validation

- `node scripts/validate-assets.mjs` — 필수 PNG 경로와 manifest가 유효하다.
- `node --experimental-strip-types --test scripts/world03-entrance-content.test.mjs scripts/stage-progression.test.mjs` — 대본·자산 및 기존 스테이지 진행 검증 통과.
- `npx tsc --noEmit` — 컷신 상수와 manifest 타입 오류 없음.
- 세 PNG를 직접 열어 하늘 시간대, 얼굴 비율, 안광 부재, 초상화 투명 배경을 육안 확인한다.

## Commit Message

```text
feat(cutscene): 월드 3 인트로 대본과 픽셀 그림 추가

Plan: 2026-10-28-world03-entrance-intro
Phase: P01-construction-entrance
Task: T01-script-and-pixel-art

- 확정된 여섯 장면 대사로 월드 3 임시 인트로 교체
- 오후 공사장과 기본 코기 초상화 세 장 등록 및 낡은 맵 항목 정리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 77cb2ba
