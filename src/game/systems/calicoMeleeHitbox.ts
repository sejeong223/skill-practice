export interface MeleeTargetBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Cover the full short swing shown by PlayerAnimator, from the corgi's mouth to the tip.
export function isCalicoInSlipperReach(
  playerCenterX: number,
  playerCenterY: number,
  facing: -1 | 1,
  target: MeleeTargetBounds,
): boolean {
  const left = facing === 1 ? playerCenterX + 16 : playerCenterX - 112;
  const right = facing === 1 ? playerCenterX + 112 : playerCenterX - 16;
  const top = playerCenterY - 72;
  const bottom = playerCenterY + 10;

  return left < target.x + target.width
    && right > target.x
    && top < target.y + target.height
    && bottom > target.y;
}
