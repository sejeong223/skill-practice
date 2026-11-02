import type Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { World04DebugEntry, World04Layout, World04Rect, World04RuntimePort } from "../data/world04Types";
import { advanceWorld04AirClock, evaluateWorld04Air, type World04AirClock, type World04AirDefinition, type World04AirPose } from "./world04AirState";
import { createWorld04Solid, playerRect, type World04SolidHandle } from "./world04RuntimeGeometry";
import { overlapCircleRect, sweepCircleRect, sweepRect } from "./world04Geometry";
interface AirEntry {
  definition: World04AirDefinition; clock: World04AirClock; pose: World04AirPose;
  images: Phaser.GameObjects.Image[]; graphics: Phaser.GameObjects.Graphics; solid?: World04SolidHandle;
}
export class World04AirSystem {
  private readonly entries: AirEntry[] = [];
  private previous: World04Rect;
  private previousDashing = false;
  private generation = 0;
  private destroyed = false;
  public constructor(scene: Phaser.Scene, private readonly player: Player, layout: World04Layout, private readonly port: World04RuntimePort) {
    this.previous = playerRect(player);
    for (const d of layout.objects) {
      if (d.kind !== "crane" && d.kind !== "swing" && d.kind !== "saw") continue;
      const names = d.kind === "crane" ? ["crane", "magnet", "payload"] : [d.kind];
      const e: AirEntry = { definition: d, clock: { id: d.id, started: false, elapsedMs: 0 }, pose: evaluateWorld04Air(d, 0),
        images: names.map(n => scene.add.image(0, 0, `world-04-scrapyard-${n}`).setDepth(7)), graphics: scene.add.graphics().setDepth(5) };
      if (d.kind === "crane") e.solid = createWorld04Solid(scene, player, d.payload, () => { if (port.isActive()) port.kill(d.id, "physical"); });
      this.entries.push(e); this.render(e);
    }
  }
  private render(e: AirEntry): void {
    const d = e.definition, pose = e.pose, g = e.graphics;
    g.clear().lineStyle(3, 0x414451, 1);
    if (d.kind === "crane" && pose.rect && pose.magnet) {
      const center = (d.payload.x + d.destinationX + d.payload.width) / 2;
      e.images[0].setPosition(center, 224);
      e.images[1].setPosition(Math.round(pose.magnet.x), Math.round(pose.magnet.y));
      if (pose.warning) e.images[1].setTint(0xffdb8e); else e.images[1].clearTint();
      e.images[2].setOrigin(0).setPosition(Math.round(pose.rect.x), Math.round(pose.rect.y));
      g.lineBetween(pose.magnet.x, 230, pose.magnet.x, pose.magnet.y);
      e.solid?.setRect(pose.rect);
    } else if (pose.circle) {
      const p = pose.circle.center; e.images[0].setPosition(Math.round(p.x), Math.round(p.y));
      if (d.kind === "swing") g.lineBetween(d.pivot.x, d.pivot.y, p.x, p.y);
      else if (d.kind === "saw") { g.lineBetween(d.fromX, d.centerY, d.toX, d.centerY); e.images[0].setRotation(2 * Math.PI * (e.clock.elapsedMs % 400) / 400); }
    }
  }
  public update(deltaMs: number): boolean {
    if (this.destroyed || !this.port.isActive()) return false;
    const after = playerRect(this.player), generation = this.generation;
    for (const e of this.entries) {
      const old = e.pose;
      e.clock = advanceWorld04AirClock(e.definition, e.clock, this.previous.x + this.previous.width, after.x + after.width, deltaMs);
      e.pose = evaluateWorld04Air(e.definition, e.clock.elapsedMs);
      // Physics moved under the preceding frame's dash. On expiry only the current
      // overlap is exposed; do not retroactively damage its protected path.
      const dashEnded = this.previousDashing && !this.port.isDashing();
      const hit = old.rect && e.pose.rect ? sweepRect(this.previous, after, old.rect, e.pose.rect) :
        old.circle && e.pose.circle ? dashEnded ? overlapCircleRect(e.pose.circle.center, e.pose.circle.radius, after) :
          sweepCircleRect(this.previous, after, old.circle.center, e.pose.circle.center, e.pose.circle.radius) : false;
      if (hit && this.port.kill(e.definition.id, e.definition.kind === "crane" ? "physical" : "attack")) return true;
      if (generation !== this.generation) return true;
      this.render(e);
    }
    this.previous = after; this.previousDashing = this.port.isDashing(); return false;
  }
  public resetForAttempt(spawnX: number): void {
    if (!Number.isFinite(spawnX)) throw new Error("Invalid World 4 respawn");
    this.generation++; this.previous = playerRect(this.player); this.previousDashing = false;
    for (const e of this.entries) { e.clock = { id: e.definition.id, started: false, elapsedMs: 0 }; e.pose = evaluateWorld04Air(e.definition, 0); this.render(e); }
  }
  public getDebugState(): readonly World04DebugEntry[] { return this.entries.map(e => ({ id: e.definition.id, kind: e.definition.kind, state: e.pose.phase, elapsedMs: e.clock.elapsedMs,
    rects: e.pose.rect ? [e.pose.rect] : e.pose.circle ? [{ x: e.pose.circle.center.x - e.pose.circle.radius, y: e.pose.circle.center.y - e.pose.circle.radius, width: 2 * e.pose.circle.radius, height: 2 * e.pose.circle.radius }] : [] })); }
  public destroy(): void { if (this.destroyed) return; this.destroyed = true; this.entries.forEach(e => { e.solid?.destroy(); e.images.forEach(i => i.destroy()); e.graphics.destroy(); }); this.entries.length = 0; }
}
