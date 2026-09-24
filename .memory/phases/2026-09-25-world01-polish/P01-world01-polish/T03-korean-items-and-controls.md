# Task: T03 Korean Item and Control Labels

## Status: done

## Goal

Replace every visible English tool name, tool effect, tool drawback, and tool slot label with Korean. Display action names and bound-key labels in Korean while preserving stored IDs, saved key codes, and actual input behavior.

## Decision Summary

- Add a typed presentation catalog keyed by existing ToolId values; do not rename IDs or effect identifiers.
- Keep saved key codes in their existing KeyboardEvent.code/Phaser format and translate them only for display.
- Apply localized tool labels consistently in the shop, equipped-tool HUD, equipment selector, and tool record.

## Implementation

### I01. Add a Korean presentation catalog for all tools

- **Related Files**
  - src/game/data/toolPresentation.ts :: new ToolPresentation type, full catalog, and lookup helper.
  - src/game/core/types.ts :: ToolId, read-only reference; do not change the union or save schema.
  - src/components/game/ShopPanel.tsx :: use localized slot/name/effect labels.
  - src/components/game/ToolRecord.tsx :: use localized name/effect/drawback labels.
  - src/components/game/EquipmentSlot.tsx :: use localized equipped and option names.
  - src/components/game/Hud.tsx :: use localized equipped tool names.

#### Details

- Define ToolPresentation with readonly nameKo, effectKo, drawbackKo, and slotKo string fields. Export a Readonly<Record<ToolId, ToolPresentation>> covering all six ToolId values and a getToolPresentation(toolId: ToolId): ToolPresentation lookup.
- Use these exact user-facing entries:
  - rabbit-slipper: name “토끼 슬리퍼”; effect “근접 3연타와 물어뜯기 기회”; drawback “재채기 반동”; slot “공격 도구”.
  - squeaky-ball: name “삑삑이 공”; effect “튕기는 투사체”; drawback “삑 소리에 고양이들이 몰려옴”; slot “공격 도구”.
  - cardboard-tube: name “종이관”; effect “근접 공격 사거리 증가”; drawback “시야 사각이 생김”; slot “공격 도구”.
  - upside-down-bowl: name “뒤집힌 밥그릇”; effect “약한 공격 3회 방어, 떠돌이 개를 부름”; drawback “떠돌이 개가 길을 막음”; slot “방어 도구”.
  - cushion-pad: name “쿠션 패드”; effect “낙하 피해 감소”; drawback “옆으로 튕겨남”; slot “방어 도구”.
  - cardboard-box: name “종이 상자”; effect “한 번의 공격을 숨겨 넘김”; drawback “시야를 가림”; slot “방어 도구”.
- In ShopPanel, replace raw slot, id, and passiveEffect text with slotKo, nameKo, and effectKo. Display currency as “코인”.
- In ToolRecord, replace raw id/passiveEffect and discovered hiddenDrawbackId text with nameKo/effectKo/drawbackKo. Preserve undiscovered/owned/equipped behavior.
- In EquipmentSlot, display localized current and option names while retaining existing option.id as the select value.
- In Hud, display localized equipped names while keeping progress.equippedAttackToolId and progress.equippedDefenseToolId unchanged.

### I02. Display action and key names in Korean

- **Related Files**
  - src/game/input/keybindPresentation.ts :: new formatKeybindLabel helper.
  - src/components/game/KeybindPanel.tsx :: use the helper and Korean action labels.
  - src/game/core/constants.ts :: DEFAULT_KEYBINDS, read-only reference; preserve current stored values.
  - src/game/input/InputManager.ts :: key normalization and behavior, read-only reference; preserve.

#### Details

- formatKeybindLabel(keyCode: string): string maps ArrowLeft to “왼쪽 화살표”, ArrowRight to “오른쪽 화살표”, ArrowUp to “위쪽 화살표”, ArrowDown to “아래쪽 화살표”, Space to “스페이스 바”, Escape to “Esc 키”, and KeyA through KeyZ to the matching Latin letter plus “ 키”. Map Digit0 through Digit9 to the matching numeral plus “ 키”. For other code values, remove the Key or Digit prefix when present and append “ 키”; handle Enter as “엔터 키” and Tab as “탭 키”.
- Keep ACTION_LABELS in Korean for 이동, 점프, 공격, 돌진, 짖기, and 일시정지. Use directional labels “왼쪽”, “오른쪽”, “위쪽”, and “아래쪽”.
- Render formatKeybindLabel(keybinds[action]) in KeybindPanel. While waiting for input, retain the Korean “입력 대기...” string.
- Translate the English “INPUT CONFIG” kicker to “조작 설정”.
- Do not transform the string before calling onChange, persisting progress.keybinds, or passing keys into InputManager.

## Acceptance Criteria

- [ ] Every one of the six tools has a Korean name, effect, drawback, and slot label in the shop, equipped HUD, selector, and record.
- [ ] No visible tool ID, passive-effect identifier, or discovered drawback identifier remains in those views.
- [ ] Key action labels and default arrow/space/letter/Escape bindings display with Korean labels.
- [ ] Rebound letters and digits display as a readable key plus “키”; Enter and Tab use Korean names.
- [ ] Purchases, equipment selection, saved progress, and keyboard behavior still use the original stable IDs and key codes.

## Validation

- npm.cmd run lint
- npm.cmd run build
- Manual review: inspect all six shop and tool-record entries, equipped names, each default control label, and one remapped letter and digit key.

## Commit Message

    feat(game-ui): 아이템과 조작키를 한국어로 표시

    Plan: 2026-09-25-world01-polish
    Phase: P01-world01-polish
    Task: T03-korean-items-and-controls

    - 도구 ID를 유지하면서 한국어 표시 정보를 추가한다.
    - 조작 이름과 키 표시를 한국어로 바꾼다.

## Progress

- [x] Implementation complete
- [x] Validation passed (lint, build)
- [ ] Manual visual review of all tool and keybind entries
- commit: pending
