import * as Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { StageRandom } from "../random/StageRandom";
import type { BossHazardHit, BossPattern } from "./BossPattern";
import {
  chooseFurballX, mouseKindForSalvo, safeMouseSpawnX, sampleMouseStep,
  sweptMouseBounds, type MouseTrajectoryState,
} from "./maineCoonTrajectory";

interface Mouse {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  motion: MouseTrajectoryState;
}

interface Furball {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  readonly marker: Phaser.GameObjects.Ellipse;
  readonly x: number;
  y: number;
  vy: number;
  warningMs: number;
}

export class MaineCoonPattern implements BossPattern {
  public readonly warningText = "생쥐가 코기를 노린다!";
  private readonly mice: Mouse[] = [];
  private readonly furballs: Furball[] = [];
  private readonly kindOffset: number;
  private pendingSecond?: { serial: number; remainingMs: number };
  private furElapsedMs = 0;
  private furSerial = 0;
  private throwPoseMs = 0;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly bossSprite: Phaser.GameObjects.Sprite,
    private readonly random: StageRandom,
  ) {
    this.kindOffset = random.offset([0, 1, 2]);
  }

  public telegraph(): void {
    if (this.destroyed) return;
    this.bossSprite.setFrame(1);
  }

  public launch(_targetX: number, serial: number): void {
    if (this.destroyed) return;
    this.spawnMouse(serial, 0);
    this.pendingSecond = { serial, remainingMs: 180 };
    this.bossSprite.setFrame(2);
    this.throwPoseMs = 200;
  }

  public update(deltaMs: number): readonly BossHazardHit[] {
    if (this.destroyed) return [];
    const delta = Math.max(0, Math.min(50, deltaMs));
    if (this.throwPoseMs > 0) {
      this.throwPoseMs = Math.max(0, this.throwPoseMs - delta);
      if (this.throwPoseMs === 0) this.bossSprite.setFrame(0);
    }
    if (this.pendingSecond) {
      this.pendingSecond.remainingMs -= delta;
      if (this.pendingSecond.remainingMs <= 0) {
        this.spawnMouse(this.pendingSecond.serial, 1);
        this.pendingSecond = undefined;
      }
    }
    this.furElapsedMs += delta;
    if (this.furElapsedMs >= 1200) {
      this.furElapsedMs -= 1200;
      this.spawnFurball();
    }
    const target = { x: this.player.body.center.x, y: this.player.body.center.y };
    const hits: BossHazardHit[] = [];
    for (const mouse of [...this.mice]) {
      const previous = mouse.motion;
      const motion = sampleMouseStep(previous, target, delta);
      mouse.motion = motion;
      mouse.image.setPosition(motion.x, motion.y);
      if (motion.ageMs >= 2200 || motion.x < target.x - 45 || motion.x < -30 ||
          motion.x > this.scene.physics.world.bounds.right + 30 || motion.y < -30 || motion.y > 560) {
        this.removeMouse(mouse);
        continue;
      }
      const bounds = sweptMouseBounds(previous, motion);
      hits.push({ id: mouse.id, kind: "weak", sourceX: this.bossSprite.x,
        bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height) });
    }
    for (const furball of [...this.furballs]) {
      if (furball.warningMs > 0) {
        furball.warningMs = Math.max(0, furball.warningMs - delta);
        if (furball.warningMs === 0) {
          furball.marker.destroy();
          furball.image.setVisible(true);
        }
        continue;
      }
      const previousY = furball.y;
      furball.y += furball.vy * delta / 1000;
      furball.vy += 140 * delta / 1000;
      furball.image.setY(furball.y);
      hits.push({ id: furball.id, kind: "weak", sourceX: furball.x,
        bounds: new Phaser.Geom.Rectangle(furball.x - 10, Math.min(previousY, furball.y) - 10,
          20, Math.abs(furball.y - previousY) + 20) });
      if (furball.y > 518) this.removeFurball(furball);
    }
    return hits;
  }

  public clear(): void {
    for (const mouse of [...this.mice]) this.removeMouse(mouse);
    for (const furball of [...this.furballs]) this.removeFurball(furball);
    this.pendingSecond = undefined;
    this.furElapsedMs = 0;
    this.throwPoseMs = 0;
    if (!this.destroyed) this.bossSprite.setFrame(0);
  }

  public destroy(): void { this.clear(); this.destroyed = true; }

  private spawnMouse(serial: number, index: 0 | 1): void {
    const x = safeMouseSpawnX(this.player.body.center.x, this.bossSprite.x,
      this.scene.physics.world.bounds.right);
    const y = this.bossSprite.y - 38 + index * 14;
    const targetAngle = Math.atan2(this.player.body.center.y - y, this.player.body.center.x - x);
    const kind = mouseKindForSalvo(serial, index, this.kindOffset);
    const speed = kind === "fast" ? 420 : kind === "straight" ? 300 : 260;
    const motion: MouseTrajectoryState = {
      kind, x, y, vx: Math.cos(targetAngle) * speed, vy: Math.sin(targetAngle) * speed,
      ageMs: 0, turnSeed: this.random.next() * Math.PI * 2,
    };
    const image = this.scene.add.image(x, y, "world-05-boss-mouse")
      .setDisplaySize(32, 24).setDepth(11);
    this.mice.push({ id: `maine-mouse-${serial}-${index}`, image, motion });
    if (this.mice.length > 4) this.removeMouse(this.mice[0]);
  }

  private spawnFurball(): void {
    const x = chooseFurballX(this.player.body.center.x, ++this.furSerial,
      this.mice.map(mouse => mouse.motion.x));
    const marker = this.scene.add.ellipse(x, 499, 34, 7, 0xeac58d, 0.7).setDepth(2);
    const image = this.scene.add.image(x, 140, "world-05-boss-furball")
      .setDisplaySize(28, 28).setDepth(11).setVisible(false);
    this.furballs.push({ id: `maine-fur-${this.furSerial}`, x, y: 140, vy: 300,
      warningMs: 450, marker, image });
    if (this.furballs.length > 3) this.removeFurball(this.furballs[0]);
  }

  private removeMouse(mouse: Mouse): void {
    const index = this.mice.indexOf(mouse);
    if (index >= 0) this.mice.splice(index, 1);
    mouse.image.destroy();
  }

  private removeFurball(furball: Furball): void {
    const index = this.furballs.indexOf(furball);
    if (index >= 0) this.furballs.splice(index, 1);
    furball.marker.destroy();
    furball.image.destroy();
  }
}
