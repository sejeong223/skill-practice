# 짖기 피드백과 보스 경고 검증

## T01 — 54c3837
- 공통 10초 쿨타임, 3·6번째 성공 사용, 경고 교체/만료/초기화 테스트와 기존 보스 경직·밥그릇 테스트 총7개 통과.
- TypeScript 및 지정 ESLint 통과.
- 기존 삼색이 경직·방어/소환 규칙과 음악은 유지했다.

## T02
- 관련 회귀 테스트20개, TypeScript, 지정 ESLint, Next production build 통과.
- 별도 headless Chrome 프로필에서 실제 키 입력으로 사용, 실시간10초 대기, 쿨타임 중 일시정지3초 동안 플레이 시계가 동일함을 확인했다.
- 2번째 사용 뒤 테스트 시계를10초 전진하고 실제 키 입력으로3번째 경고를 확인했다. 입력 실패와6번째는 단위 테스트에서 확인했다.
- DefenseToolSystem.tryBlock을3회 호출해 기존 방어→소환→경고 경로를 검증했다. 이 단계는 실제 생선 가시 충돌 검증과 구분한다.
- 두 경고가 겹칠 때 최신 경고 하나, computed background `rgba(239, 68, 68, 0.08)`, pointer-events 없음, 경고 중 이동 입력을 확인했다.
- 1280×720 및390px 화면 캡처를 직접 확인했다. 코기와 배경이 보이고 좁은 화면 쿨타임이 잘리지 않는다. 브라우저 pageerror0건.
- 증거: `assets/2026-10-19-boss-feedback/{bark-third,bowl-alarm,mobile-warning}.png`, `ui-result.json`.
- 이미지·소리·일반 구간 이동 및 남은 수명주기 통합 검증은T03에서 추가한다. 실제 모바일 터치와 사람의 스피커 청음은 아직 확인하지 않았다.

## T03
- 짖기 PNG는112×128 RGBA, 마지막 불투명 발 행99px. 실제 플레이와 나란히 확인했고 성공 사용450ms 뒤 달리기/기본 자세로 복귀한다. 이미지 생성은 내장 image_gen, 최종 경로는 `public/assets/pixel/characters/corgi/corgi-bark.png`다.
- 합성 효과음은 `public/assets/audio/corgi-bark.wav`: 44100Hz mono PCM16, 0.4초, peak0.65. generator의 재현성·무음/클리핑·DC·메타데이터 검사 통과.
- 관련 자동 테스트20개, 에셋 검사, TypeScript, 지정 ESLint, production build 통과. 기존 캐시 효과음 수명 테스트는 bark가 binary 경로로 이동했으므로 whine으로 캐시 분기를 검증하도록 갱신했다.
- 별도 Chrome에서 실제 짖기 키 입력→bark texture와AudioBufferSource 시작1회, 쿨타임 중 재입력→추가0회 확인. 기존48×40/72×40 충돌 크기 유지.
- 플레이 도중450ms 표시의 pause/resume, 좌우 반전, 점프 중 사용, 새 키B로 변경 후 사용, 사망 후run 복귀를 확인했다.
- 월드 선택 이벤트의 실제 전환 핸들러를 통해 월드1 보스→월드1 일반→월드2 일반으로 이동하고, 새 구간에서 중복 발음 없이 사용됨을 확인했다. 일반 구간3회 사용에는 보스 경고가 없다.
- 실제 삼색이 투사체를 향해 테스트 코기 위치를 맞춰 충돌시키고, 방어3회→강아지5마리→밥그릇 경고를 확인했다. 방어/소환 이벤트를 직접 발생시키지 않은 검사다. `bowl-projectile-collision.png` 참고.
- 브라우저의 실제 AudioBufferSource를 analyser로 관찰:7회 모두 running context, 각0.4초, RMS 약0.09~0.13의 비무음 출력. 물리 스피커·이어폰 청음 및 합성 음색의 자연스러움은 미확인이다. 사람 청음이나 실제 모바일 터치까지 검증했다고 간주하지 않는다.
- 장면 종료 시 Phaser가 camera를 먼저 정리해 `shakeEffect` 접근이 실패하는 런타임 오류를 발견·수정했다. `main?.shakeEffect.reset()` 및 종료된 Player의 texture 복원 가드로 정리 순서에 대응했다. 수정 후 재도전/월드 이동/사망 전체 브라우저 pageerror0건.
- 증거: `assets/2026-10-19-boss-feedback/bark-integration.json`, `corgi-bark-boss.png`, `world02-bark.png`, `world02-mobile.png`, `bowl-projectile-collision.png`.
- 사용자 원래 저장을 변경하지 않았다. 기존 월드2 악보/BPM, 인트로 대사, 스킬 해금 순서를 유지했다. 요청 범위 밖 추가 변경은 없다.

### 이미지 생성 프롬프트와 원본

- 내장 도구, `transparent_background=true`. 참조는 `public/assets/pixel/characters/corgi/corgi-run.png`.
- 생성 원본: `C:/Users/김세정/.codex/generated_images/01a139cd-5cea-7341-a5c0-7d30f965a769/exec-5fb8db81-da6d-4224-aa76-e5dd0058e125.png`. 원본을 보존하고 trim/nearest-neighbor94×83/투명 패딩으로 게임 프레임에 맞췄다.

```text
Use case: precise-object-edit. Game sprite asset. Reference is existing 4-frame corgi run spritesheet. Create ONE single corgi pose only matching the first corgi's exact side-view character identity and pixel-art style: orange tan coat, white neck and belly, tall ears, short legs and long body, dark thin pixel outlines and simple flat pixel shading. Facing RIGHT, standing on all four paws, same body proportions as reference. Change the mouth to WIDE OPEN in a forceful BARK: visibly open dark mouth cavity, separated upper/lower jaws, small pink tongue inside, muzzle tilted slightly upward, intent eyes; NOT a smiling pant. Keep the body shape, color palette, ears and short legs extremely close to the reference. Clearly readable low-resolution pixel art, about a 100x85 sprite on a 112x128 game frame. Render one isolated complete sprite with genuinely transparent background. No other dogs, no text, no sound lines, no ground, no shadow, no scene, no grid. Do not render a sheet or multiple frames.
```
