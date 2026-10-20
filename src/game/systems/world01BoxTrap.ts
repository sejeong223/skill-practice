export interface HorizontalBounds {
  readonly left: number;
  readonly right: number;
}

export interface BoxDangerRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const BOX_OPEN_TEXTURE_KEY = "world-01-prop-cat-box-open";
export const BOX_OPEN_DISPLAY = { width: 64, height: 56 } as const;
const BOX_APPROACH_MARGIN = 12;

export function isAtStaticBox(
  player: HorizontalBounds,
  boxX: number,
  boxWidth: number,
): boolean {
  return player.right >= boxX - BOX_APPROACH_MARGIN &&
    player.left <= boxX + boxWidth + BOX_APPROACH_MARGIN;
}

export function hasPassedStaticBox(
  player: HorizontalBounds,
  boxX: number,
  boxWidth: number,
): boolean {
  return player.left > boxX + boxWidth + BOX_APPROACH_MARGIN;
}

export function getOpenStaticBoxDangerRects(
  boxX: number,
  floorY: number,
): readonly BoxDangerRect[] {
  return [
    { x: boxX, y: floorY - 36, width: 44, height: 36 },
    { x: boxX + 14, y: floorY - 54, width: 16, height: 54 },
  ];
}
