import type * as Phaser from "phaser";

export interface BossHazardHit {
  readonly id: string;
  readonly bounds: Phaser.Geom.Rectangle;
  readonly sourceX: number;
  readonly kind: "weak" | "boss-phase";
}

export interface BossPattern {
  telegraph(targetX: number, serial: number): void;
  launch(targetX: number, serial: number): void;
  update(deltaMs: number): readonly BossHazardHit[];
  clear(): void;
  destroy(): void;
}
