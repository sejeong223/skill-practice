import type Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { World04DebugEntry, World04Layout, World04Rect, World04RuntimePort, World04Terrain } from "../data/world04Types";
import { advanceTerrainState, createTerrainState, type World04TerrainState, type World04TerrainStep } from "./world04TerrainState";
import { overlapRect, sweepRect } from "./world04Geometry";
import { createWorld04Solid, playerRect, syncPlayerHistory, type World04SolidHandle } from "./world04RuntimeGeometry";

interface TerrainEntry {
  definition: World04Terrain; state: World04TerrainState; step: World04TerrainStep | null;
  bridge?: World04SolidHandle; front?: World04SolidHandle; rear?: World04SolidHandle;
  bridgeImage?: Phaser.GameObjects.TileSprite; frontImage?: Phaser.GameObjects.TileSprite; rearImage?: Phaser.GameObjects.TileSprite;
}
export class World04TerrainSystem {
  private readonly solids: World04SolidHandle[] = [];
  private readonly images: Phaser.GameObjects.TileSprite[] = [];
  private readonly entries: TerrainEntry[] = [];
  private previous: World04Rect;
  private generation = 0;
  private destroyed = false;
  public constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly layout: World04Layout, private readonly port: World04RuntimePort) {
    this.previous = playerRect(player);
    for (const r of layout.solids) {
      this.solids.push(createWorld04Solid(scene, player, r));
      this.draw(r, r.role === "ground" ? "floor" : "platform", r.role === "ground" ? 216 : r.height);
    }
    for (const d of layout.terrain) {
      const e: TerrainEntry = { definition: d, state: createTerrainState(d), step: null };
      if (d.kind === "collapse") { e.bridge = createWorld04Solid(scene, player, d.rect); e.bridgeImage = this.draw(d.rect, "floor", 216); }
      else {
        const contact = () => { if (this.port.isActive() && (e.state.phase === "strike" || e.state.phase === "lowering")) this.port.kill(d.id, "physical"); };
        e.front = createWorld04Solid(scene, player, d.rect, contact); e.rear = createWorld04Solid(scene, player, d.rect, contact);
        e.frontImage = this.draw(d.rect, "rise-column", d.riseHeight); e.rearImage = this.draw(d.rect, "rise-column", d.riseHeight);
        e.front.setRect(null); e.rear.setRect(null); e.frontImage.setVisible(false); e.rearImage.setVisible(false);
      }
      this.entries.push(e);
    }
  }
  private draw(r: World04Rect, suffix: string, height: number): Phaser.GameObjects.TileSprite {
    const image = this.scene.add.tileSprite(r.x, r.y, r.width, height, `world-04-scrapyard-${suffix}`).setOrigin(0).setDepth(4);
    image.tilePositionX = r.x % 128; this.images.push(image); return image;
  }
  private renderPillar(image: Phaser.GameObjects.TileSprite | undefined, r: World04Rect | null): void {
    image?.setVisible(!!r); if (image && r) image.setPosition(Math.round(r.x), Math.round(r.y)).setSize(r.width, r.height);
  }
  public update(deltaMs: number): boolean {
    if (this.destroyed || !this.port.isActive()) return false;
    const generation = this.generation, before = this.previous;
    let after = playerRect(this.player);
    if (after.y + after.height >= 704 && this.port.kill(`${this.layout.stageId}-fall`, "fall")) return true;
    for (const e of this.entries) {
      const b = this.player.body;
      const step = advanceTerrainState(e.definition, e.state, { before, after, velocityX: b.velocity.x, velocityY: b.velocity.y, grounded: b.blocked.down || b.touching.down }, Math.min(50, Math.max(0, deltaMs)));
      e.state = step.state; e.step = step;
      e.bridge?.setRect(step.bridgeEnabled ? e.definition.rect : null);
      e.bridgeImage?.setY(e.definition.rect.y + 96 * step.fallProgress).setAlpha(1 - step.fallProgress);
      e.front?.setRect(step.frontRect); e.rear?.setRect(step.rearRect);
      this.renderPillar(e.frontImage, step.frontRect); this.renderPillar(e.rearImage, step.rearRect);
      if (step.dangerRects.some(r => sweepRect(before, after, r, r)) && this.port.kill(e.definition.id, "physical")) return true;
      if (generation !== this.generation) return true;
      if (step.state.phase === "retreat" && step.frontRect && before.x + before.width <= step.frontRect.x &&
        (overlapRect(after, step.frontRect) || sweepRect(before, after, step.frontRect, step.frontRect))) {
        this.player.x += step.frontRect.x - after.x - after.width; this.player.setVelocityX(0); syncPlayerHistory(this.player); after = playerRect(this.player);
      }
    }
    this.previous = after; return false;
  }
  public resetForAttempt(spawnX: number): void {
    if (!Number.isFinite(spawnX)) throw new Error("Invalid World 4 respawn");
    this.generation++; this.previous = playerRect(this.player);
    for (const e of this.entries) {
      e.state = createTerrainState(e.definition); e.step = null;
      e.bridge?.setRect(e.definition.rect); e.bridgeImage?.setY(e.definition.rect.y).setAlpha(1);
      e.front?.setRect(null); e.rear?.setRect(null); e.frontImage?.setVisible(false); e.rearImage?.setVisible(false);
    }
  }
  public getDebugState(): readonly World04DebugEntry[] { return this.entries.map(e => ({ id: e.definition.id, kind: e.definition.kind, state: e.state.phase, elapsedMs: e.state.elapsedMs, rects: e.step?.dangerRects ?? [] })); }
  public destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    this.solids.forEach(s => s.destroy()); this.entries.forEach(e => { e.bridge?.destroy(); e.front?.destroy(); e.rear?.destroy(); });
    this.images.forEach(i => i.destroy()); this.solids.length = 0; this.entries.length = 0; this.images.length = 0;
  }
}
