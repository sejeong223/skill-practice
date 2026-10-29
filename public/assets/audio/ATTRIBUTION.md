# Audio attribution

## 월드 3 고등어 태비의 세 공격 준비음

세 출력은 `scripts/generate-world03-boss-attack-sfx.mjs`로 재현할 수 있는 44.1 kHz 모노 PCM16 WAV이다. 각 원본의 실제 녹음 중 아래 구간을 잘라 저역/고역 필터, 피크 정규화, 시작 1 ms 및 끝 25 ms 페이드를 적용했다. 셋 모두 준비 자세 0.3초 안에 끝나며, 음악을 duck하지 않는다. 원본 및 가공본의 라이선스는 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)이다.

| 출력 | 원본 녹음·권리자 | 사용 구간 | 가공 |
| --- | --- | --- | --- |
| `world-03-boss-brick.wav` | [Brick on soil.wav](https://freesound.org/people/deleted_user_2104797/sounds/325268/) by deleted_user_2104797, [고화질 미리듣기](https://cdn.freesound.org/previews/325/325268_2104797-hq.mp3), CC0 | 1.023–1.243 s | 90–6000 Hz, 피크 0.78, 0.22 s |
| `world-03-boss-trowel.wav` | [Metal Scraping with Trowel](https://freesound.org/people/Sheyvan/sounds/831386/) by Sheyvan (recorded by Jakob Jenderek), [고화질 미리듣기](https://cdn.freesound.org/previews/831/831386_3248005-hq.mp3), CC0 | 11.744–11.994 s | 300–9000 Hz, 피크 0.82, 0.25 s |
| `world-03-boss-cement.wav` | [Stir concrete with a trowel](https://bigsoundbank.com/stir-concrete-with-a-trowel-s0623.html) by cecilegatina, [원본 WAV](https://bigsoundbank.com/UPLOAD/bwf-en/0623.wav), CC0 | 1.650–1.920 s | 70–2500 Hz, 피크 0.72, 0.27 s |

벽돌과 흙손 녹음은 Freesound의 CC0 고화질 MP3 미리듣기를 44.1 kHz 모노 WAV로 변환해 각각 `art/source/world03-boss-brick-cc0.wav`, `art/source/world03-boss-trowel-cc0.wav`에 보관했다. 시멘트 WAV의 메타데이터 chunk를 제거해 같은 PCM 포맷으로 `art/source/world03-boss-cement-cc0.wav`에 보관했다. `node scripts/generate-world03-boss-attack-sfx.mjs [--check]`로 출력한다.

## world-03-steel-impact.wav

- Source recording: **Steel, hollow pipe on concrete, Indoor, 8 impacts.wav** by **Bibow**. [Freesound source page](https://freesound.org/people/Bibow/sounds/426849/).
- License: [Creative Commons Zero 1.0 (CC0)](https://creativecommons.org/publicdomain/zero/1.0/). The source page lists this recording as CC0.
- Changes: selected the first impact around **3.685–3.995 s** from the high-quality MP3 preview, mixed stereo to mono, resampled to 44.1 kHz and saved the 0.31 s source clip as `art/source/world03-steel-pipe-drop-bibow-cc0.wav`. `scripts/generate-world03-steel-impact.mjs` removes the first 8.1 ms of the source clip, brightens its attack, rapidly shortens the ring and exports a 0.28 s mono 16-bit PCM effect.
- Recreate or verify with `node scripts/generate-world03-steel-impact.mjs [--check]`.

## world-03-construction-drill.wav / world-03-construction-excavator.wav

- Original sounds synthesized locally by `scripts/generate-world03-intro-sfx.mjs`; no external recordings or samples used.
- The drill combines gated midrange tones and seeded noise (0.55 s). The excavator combines a descending low motor tone and seeded noise (0.85 s).
- Both are exported as 44.1 kHz mono 16-bit PCM. Recreate or verify with `node scripts/generate-world03-intro-sfx.mjs [--check]`.

## corgi-bite.wav

- Original sound synthesized locally by `scripts/generate-bite-sfx.mjs`; no external samples used.
- Two filtered-noise bite transients and a short descending tone, exported as 44.1 kHz mono 16-bit PCM. Duration: 0.20 s.

## world-02-cat-hiss.wav

- Source recording: **Cat hissing - Zabuhailo.wav** by **Zabuhailo**. [Commons source page](https://commons.wikimedia.org/wiki/File:Cat_hissing_-_Zabuhailo.wav), [accessible mirror](https://www.marefa.org/%D9%85%D9%84%D9%81:Cat_hissing_-_Zabuhailo.wav), [Freesound author page](https://freesound.org/people/Zabuhailo/).
- License: [Creative Commons Zero 1.0 (CC0)](https://creativecommons.org/publicdomain/zero/1.0/). The source page lists this sound as CC0. This derived clip is also provided under CC0.
- Changes: selected source time **0.98–1.93 s**, removed frequencies below 150 Hz, converted 96 kHz mono 24-bit PCM to 44.1 kHz mono 16-bit PCM, peak normalized to 0.90 and applied 8 ms fades at both ends. Result duration: 0.95 s.
- SHA-256: `2a465c1792e8da4978304ce98ac7b6764e9f09a6ccc19d4cf7133b99c4c4e525`.
- The earlier proposed Commons recording **Gruñido gato (Chacha).ogg** could not be downloaded due HTTP 429, so the shorter, CC0 cat hiss recording above was used instead.
