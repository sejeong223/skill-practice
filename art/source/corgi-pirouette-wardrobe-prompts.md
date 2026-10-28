# Corgi pirouette wardrobe source

Generated with the built-in `imagegen` tool on 2026-10-28. Each `*-generated.png` is a transparent eight-view horizontal concept. `scripts/build-corgi-pirouette-sprites.mjs` samples the concept with the T01 base pose transform and writes the `896×128` source and game sheets. The original art files remain in `art/source/` for regeneration and review.

## Shared prompt

> Use case: precise-object-edit. Edit Image 1, the complete eight-view upright ballet corgi turnaround. Preserve exactly eight equal-width panels, angle order, all eight complete body poses, one supporting hind paw, the other hind leg extended sideways, both front paws spread, same foot baseline, face proportions, solid dark eyes without white catchlights, and transparent background. Image 2 is the existing outfit or accessory style reference. Redraw the wearable on the newly posed full body for profile, front, three-quarter, and back views. Do not paste a flat garment onto the horizontal running torso. Crisp dark pixel-art outlines. No text, labels, tutu, ballet shoes, shadow, or extra characters.

## Variant prompts

| ID | Image 2 | Wearable detail |
| :--- | :--- | :--- |
| `pink-caterpillar-suit` | `equipment/pink-caterpillar-suit-run.png` | Soft segmented pink body, rounded caterpillar ridges, corgi face and paws visible. |
| `banana-peel-suit` | `equipment/banana-peel-suit-run.png` | Yellow peel panels and brown tips wrap the upright body. |
| `bee-bodysuit` | `equipment/bee-bodysuit-run.png` | Fitted yellow and dark-brown stripes, small wings correctly placed on side and back. |
| `hotdog-outfit` | `equipment/hotdog-outfit-run.png` | Tan bun sides and reddish sausage center wrap front, side, and back. |
| `diamond-armor` | `equipment/diamond-armor-run.png` | Faceted blue-cyan chest, shoulder, and back plates. |
| `custom-outfit-template` | `equipment/custom-outfit-template-run.png` | Contiguous neutral white vest fabric on front, sides, back; gray seams; original fur on face and paws. |
| `shinchan-eyebrow-sticker` | `equipment/shinchan-eyebrow-sticker-run.png` | Thick dark eyebrows on visible face; hidden on back views. |
| `birthday-party-hat` | `equipment/birthday-party-hat-run.png` | Small cone party hat between ears, with front/side/back geometry. |
| `strawberry-headpiece` | `equipment/strawberry-headpiece-run.png` | Red strawberry cap and green leaves fitted to the turning head. |
| `propeller-hat` | `equipment/propeller-hat-run.png` | Small colorful child's propeller cap fitted between ears. |
| `prince-crown` | `equipment/prince-crown-run.png` | Compact gold prince crown, front peaks and rear band. |

Image 1 for every call: `art/source/corgi-pirouette-generated.png`. Image 2 files are under `public/assets/pixel/characters/corgi/`.
