import * as Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { BossHazardHit, BossPattern } from "./BossPattern";
import { MackerelAttackSchedule, type MackerelAttackKind } from "./mackerelAttackSchedule";
import { advanceMackerelBrick, clampMackerelLanding, clearPlayerFromBrick,
  sweptMackerelBrickBounds, type MackerelBrickMotion } from "./mackerelBrickPhysics";
import { advanceCementLump, advanceCementWave, cementTrailBounds, feetTouchCement,
  sweptCementBounds, CEMENT_PUDDLE_MS, type CementMotion } from "./mackerelCementPhysics";

export type MackerelPrepSoundKey = "world-03-boss-brick" | "world-03-boss-trowel" | "world-03-boss-cement";

interface Brick {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  motion: MackerelBrickMotion;
  phase: "flying" | "landed";
  landedMs: number;
  body?: Phaser.GameObjects.Zone;
  collider?: Phaser.Physics.Arcade.Collider;
}
interface Wave {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  readonly trail: Phaser.GameObjects.Image;
  x: number;
  readonly direction: -1 | 1;
}
interface Lump { readonly id: string; readonly image: Phaser.GameObjects.Image; motion: CementMotion; }
interface Puddle { readonly image: Phaser.GameObjects.Image; readonly x: number; readonly width: number; remainingMs: number; }

const PREP_FRAME: Record<MackerelAttackKind, number> = { brick: 1, "cement-wave": 4, "cement-lump": 6 };
const RELEASE_FRAME: Record<MackerelAttackKind, number> = { brick: 2, "cement-wave": 5, "cement-lump": 7 };
const PREP_SOUND: Record<MackerelAttackKind, MackerelPrepSoundKey> = {
  brick: "world-03-boss-brick", "cement-wave": "world-03-boss-trowel", "cement-lump": "world-03-boss-cement",
};

export class MackerelConstructionPattern implements BossPattern {
  private readonly schedule: MackerelAttackSchedule;
  private readonly bricks: Brick[] = [];
  private readonly waves: Wave[] = [];
  private readonly lumps: Lump[] = [];
  private readonly puddles: Puddle[] = [];
  private releasePoseMs = 0;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly bossSprite: Phaser.GameObjects.Sprite,
    attempt: number,
    private readonly playPrepSound: (key: MackerelPrepSoundKey) => void,
    private readonly onCementContact: () => void,
  ) {
    this.schedule = new MackerelAttackSchedule("world-03-stage-boss", attempt);
  }

  public telegraph(): void {
    if (this.destroyed) return;
    const kind = this.schedule.reserve();
    this.releasePoseMs = 0;
    this.bossSprite.setFrame(PREP_FRAME[kind]);
    this.playPrepSound(PREP_SOUND[kind]);
  }

  public launch(targetX: number, serial: number): void {
    if (this.destroyed) return;
    const kind = this.schedule.commit();
    this.bossSprite.setFrame(RELEASE_FRAME[kind]);
    this.releasePoseMs = 180;
    if (kind === "brick") this.launchBrick(targetX, serial);
    else if (kind === "cement-wave") this.launchWave(targetX, serial);
    else this.launchLump(targetX, serial);
  }

  public update(deltaMs: number): readonly BossHazardHit[] {
    if (this.destroyed) return [];
    const delta = Math.max(0, Math.min(50, deltaMs));
    if (this.releasePoseMs > 0) {
      this.releasePoseMs = Math.max(0, this.releasePoseMs - delta);
      if (this.releasePoseMs === 0) this.bossSprite.setFrame(0);
    }
    const hits: BossHazardHit[] = [];
    this.updateBricks(delta, hits);
    this.updateWaves(delta, hits);
    this.updateLumps(delta, hits);
    for (const puddle of [...this.puddles]) {
      puddle.remainingMs -= delta;
      if (puddle.remainingMs <= 0) this.removePuddle(puddle);
      else if (feetTouchCement(this.player.body, puddle)) this.onCementContact();
    }
    return hits;
  }

  public clear(): void {
    this.schedule.cancel();
    for (const brick of [...this.bricks]) this.removeBrick(brick);
    for (const wave of [...this.waves]) this.removeWave(wave);
    for (const lump of [...this.lumps]) this.removeLump(lump);
    for (const puddle of [...this.puddles]) this.removePuddle(puddle);
    this.releasePoseMs = 0;
    if (!this.destroyed) this.bossSprite.setFrame(0);
  }

  public resetForAttempt(attempt: number): void { this.clear(); this.schedule.reset(attempt); }
  public destroy(): void { this.clear(); this.destroyed = true; }

  private launchBrick(targetX: number, serial: number): void {
    const bossX = this.bossSprite.x;
    const side = targetX < bossX ? -1 : 1;
    const startX = bossX + side * 48;
    const target = clampMackerelLanding(targetX, bossX, this.scene.physics.world.bounds.right);
    const distance = Math.abs(target - startX);
    const speed = Math.max(300, Math.min(370, distance / 2.6));
    const motion: MackerelBrickMotion = {
      x: startX, y: this.bossSprite.y - 48, startX, startY: this.bossSprite.y - 48,
      targetX: target, elapsedMs: 0, durationMs: Math.max(500, distance / speed * 1000),
    };
    const image = this.scene.add.image(motion.x, motion.y, "world-03-boss-brick").setDisplaySize(32, 32).setDepth(11);
    this.bricks.push({ id: `mackerel-brick-${serial}`, image, motion, phase: "flying", landedMs: 0 });
  }

  private launchWave(targetX: number, serial: number): void {
    const direction: -1 | 1 = targetX < this.bossSprite.x ? -1 : 1;
    const x = this.bossSprite.x + direction * 48;
    const image = this.scene.add.image(x, 488, "world-03-cement-wave").setDepth(11);
    const trail = this.scene.add.image(x, 501, "world-03-cement-puddle")
      .setDisplaySize(160, 16).setDepth(2).setAlpha(0.7);
    this.waves.push({ id: `mackerel-wave-${serial}`, image, trail, x, direction });
  }

  private launchLump(targetX: number, serial: number): void {
    const direction = targetX < this.bossSprite.x ? -1 : 1;
    const startX = this.bossSprite.x + direction * 48;
    const motion: CementMotion = { x: startX, y: this.bossSprite.y - 40,
      startX, startY: this.bossSprite.y - 40,
      targetX: clampMackerelLanding(targetX, this.bossSprite.x, this.scene.physics.world.bounds.right),
      elapsedMs: 0, durationMs: 700 };
    const image = this.scene.add.image(motion.x, motion.y, "world-03-cement-lump").setDepth(11);
    this.lumps.push({ id: `mackerel-lump-${serial}`, image, motion });
  }

  private updateBricks(delta: number, hits: BossHazardHit[]): void {
    for (const brick of [...this.bricks]) {
      if (brick.phase === "landed") {
        brick.landedMs += delta;
        if (brick.landedMs >= 1400) this.removeBrick(brick);
        continue;
      }
      const previous = brick.motion;
      const { motion, landed } = advanceMackerelBrick(previous, delta);
      brick.motion = motion;
      brick.image.setPosition(motion.x, motion.y).setAngle(-motion.elapsedMs * 0.06);
      if (landed) { this.landBrick(brick); continue; }
      hits.push(this.hit(brick.id, sweptMackerelBrickBounds(previous, motion)));
    }
  }

  private updateWaves(delta: number, hits: BossHazardHit[]): void {
    for (const wave of [...this.waves]) {
      const previous = { x: wave.x, y: 488 };
      wave.x = advanceCementWave(wave.x, wave.direction, delta);
      wave.image.setPosition(wave.x, 488);
      const trail = cementTrailBounds(wave.x, wave.direction);
      wave.trail.setPosition(trail.x + trail.width / 2, 501);
      if (feetTouchCement(this.player.body, trail)) this.onCementContact();
      hits.push(this.hit(wave.id, sweptCementBounds(previous, { x: wave.x, y: 488 }, 28, 9)));
      if (wave.x < 96 || wave.x > this.scene.physics.world.bounds.right - 96) {
        this.addPuddle(trail.x + trail.width / 2, 160);
        this.removeWave(wave);
      }
    }
  }

  private updateLumps(delta: number, hits: BossHazardHit[]): void {
    for (const lump of [...this.lumps]) {
      const previous = lump.motion;
      const { motion, landed } = advanceCementLump(previous, delta);
      lump.motion = motion;
      lump.image.setPosition(motion.x, motion.y);
      if (landed) { this.addPuddle(motion.x, 96); this.removeLump(lump); }
      else hits.push(this.hit(lump.id, sweptCementBounds(previous, motion, 18, 18)));
    }
  }

  private addPuddle(x: number, width: number): void {
    const image = this.scene.add.image(x, 501, "world-03-cement-puddle").setDisplaySize(width, 16).setDepth(2);
    this.puddles.push({ image, x: x - width / 2, width, remainingMs: CEMENT_PUDDLE_MS });
  }

  private hit(id: string, bounds: { x: number; y: number; width: number; height: number }): BossHazardHit {
    return { id, kind: "weak", sourceX: this.bossSprite.x,
      bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height) };
  }

  private landBrick(brick: Brick): void {
    const x = clearPlayerFromBrick(brick.motion.targetX, this.player.body.center.x,
      this.bossSprite.x, this.scene.physics.world.bounds.right);
    brick.phase = "landed";
    brick.image.setPosition(x, 492).setAngle(0);
    brick.body = this.scene.add.zone(x, 490, 32, 28);
    this.scene.physics.add.existing(brick.body, true);
    (brick.body.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    brick.collider = this.scene.physics.add.collider(this.player, brick.body);
    const landed = this.bricks.filter(candidate => candidate.phase === "landed");
    if (landed.length > 2) this.removeBrick(landed[0]);
  }

  private removeBrick(brick: Brick): void {
    const index = this.bricks.indexOf(brick);
    if (index >= 0) this.bricks.splice(index, 1);
    brick.collider?.destroy(); brick.body?.destroy(); brick.image.destroy();
  }
  private removeWave(wave: Wave): void {
    const index = this.waves.indexOf(wave);
    if (index >= 0) this.waves.splice(index, 1);
    wave.image.destroy(); wave.trail.destroy();
  }
  private removeLump(lump: Lump): void {
    const index = this.lumps.indexOf(lump);
    if (index >= 0) this.lumps.splice(index, 1);
    lump.image.destroy();
  }
  private removePuddle(puddle: Puddle): void {
    const index = this.puddles.indexOf(puddle);
    if (index >= 0) this.puddles.splice(index, 1);
    puddle.image.destroy();
  }
}
