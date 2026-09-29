# Task: T03 보스 캐릭터와 하트 얼굴 그림

## Status: pending

## Goal
삼색이를 장신구 없는 모습으로 오른쪽을 향해 배치하고, 밥그릇 방어 역효과의 세 마리를 사모예드로 바꾼다. 보스 하트 HUD에는 지정된 코기 참조 이미지의 정면 얼굴을 표시한다.

## Decision Summary
- 기존 보스의 3프레임 상태와 전투 판정은 유지하며, 삼색이 그림에서 옷·모자·목걸이·장신구를 제거하고 StageScene에서 좌우 반전한다.
- 세 마리 동시 등장과 48x40 화면 크기는 유지하고, 흰색 풍성한 털과 단순한 검은 원형 눈을 가진 사모예드로 교체한다.
- HUD 얼굴의 소스 파일은 public/assets/pixel/references/characters/corgi-reference-v2.png로 고정한다. 전체 표정 시트가 아닌 정면 얼굴 영역만 잘라 보인다.

## Implementation

### I01. 보스와 사모예드 이미지
- Related Files:
  - public/assets/pixel/characters/world-01/calico-boss.png :: 3-frame boss spritesheet; replace
  - public/assets/pixel/characters/world-01/stray-dog.png :: surround dog image; replace
  - src/game/scenes/StageScene.ts :: world-01 boss sprite creation; modify
  - src/game/systems/World01CalicoBoss.ts :: spawnDogSurround; verify read-only unless asset sizing requires adjustment

#### Details
- Edit the existing 288x96 calico sheet as three 96x96 frames: neutral, fishbone attack and defeated/collapsed. Remove hat, clothes, collar, necklace and every accessory from every frame. Keep a calico coat, consistent pixel outline and transparent canvas.
- In StageScene boss creation, apply setFlipX(true) to the sprite because Calico is placed to the player's right and should face left. Keep frames, health bar coordinates, attack direction and hitbox behavior unchanged.
- Edit the existing 48x40 dog canvas to a fluffy white Samoyed facing toward center. Give it only small black dot/round eyes; do not add bright eye sparkles, accessories or clothing.
- Keep StrayDogEvent count at three and World01CalicoBoss's current display size, timing and route-blocking behavior.

### I02. 지정 코기 얼굴을 하트 HUD에 연결
- Related Files:
  - src/game/assets/assetManifest.json :: corgi-reference and world-01-corgi-face URLs; modify
  - src/components/game/Hud.tsx :: boss-hearts face markup; modify if needed
  - src/app/globals.css :: boss-hearts-face image source and crop; modify
  - public/assets/pixel/references/characters/corgi-reference-v2.png :: supplied face sheet; read-only

#### Details
- Point the loaded world-01-corgi-face image to /assets/pixel/references/characters/corgi-reference-v2.png.
- Crop the single neutral front-facing face from the sheet using a fixed overflow-hidden viewport and CSS background size/position or an equivalent image crop. Do not copy another reference image or use the old corgi-face icon.
- Preserve the HUD's right-top position immediately left of pause and retain three hearts. Ensure the crop remains correct in the existing max-width:720px style and set image-rendering: pixelated.

## Acceptance Criteria
- [ ] All three Calico animation frames are accessory-free and the in-game sprite faces left toward Corgi.
- [ ] Third bowl defense still displays three fluffy white Samoyeds with black dot eyes and keeps the same short blockade behavior.
- [ ] The 3-heart HUD uses the specified reference image's single neutral Corgi face on desktop and mobile, next to pause.
- [ ] Boss HP, fishbone attacks, slipper hits and victory dialogue remain unchanged.

## Validation
- npx.cmd tsc --noEmit — no type errors.
- npm.cmd run lint — no lint errors.
- npm.cmd run build — production build succeeds.
- Browser visual check — boss intro/attack/defeat frames, dog surround, and 3/2/1/0 heart states.

## Commit Message
feat(보스): 삼색이와 사모예드 그림 교체

Plan: 2026-09-29-world-stage-visual-polish
Phase: P01-progression-and-visuals
Task: T03-boss-and-heart-visuals

- 장신구 없는 삼색이와 사모예드로 보스 자산을 바꾼다
- 지정 코기 참조 얼굴을 하트 HUD에 사용한다

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
