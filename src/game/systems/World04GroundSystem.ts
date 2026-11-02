import type Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { PlayerSurfaceModifier } from "../entities/playerTypes";
import type { World04DebugEntry, World04Layout, World04Rect, World04RuntimePort } from "../data/world04Types";
import type { PlayerController } from "./PlayerController";
import { advanceGroundState, createGroundState, footOnRect, type World04GroundDefinition, type World04GroundState, type World04GroundStep } from "./world04GroundState";
import { createWorld04Solid, playerRect, type World04SolidHandle } from "./world04RuntimeGeometry";
import { overlapRect, sweepRect } from "./world04Geometry";
interface GroundEntry { definition: World04GroundDefinition; state: World04GroundState; step: World04GroundStep; images: Phaser.GameObjects.Sprite[]; solids: World04SolidHandle[]; }
export class World04GroundSystem {
  private readonly entries: GroundEntry[] = [];
  private previous: World04Rect;
  private previousDashing = false;
  private generation = 0;
  private destroyed = false;
  public constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly controller: PlayerController, layout: World04Layout, private readonly port: World04RuntimePort) {
    this.previous = playerRect(player);
    for (const d of layout.objects) {
      if (d.kind === "crane" || d.kind === "swing" || d.kind === "saw") continue;
      const rect = d.kind === "plate-gate" ? d.plate : d.rect;
      const names = d.kind === "press" ? ["press-left", "press-right"] : d.kind === "plate-gate" ? ["plate", "door"] : [d.kind];
      const images = names.map(key => scene.add.sprite(rect.x + rect.width / 2, rect.y + rect.height, `world-04-scrapyard-${key}`).setOrigin(.5, 1).setDepth(6));
      if (d.kind === "oil" || d.kind === "belt") images[0].setDisplaySize(rect.width, d.kind === "oil" ? 16 : 24);
      const state = createGroundState(d), sample = { before: this.previous, after: this.previous, grounded: false, velocityY: 0, canLaunch: false };
      const e: GroundEntry = { definition: d, state, step: advanceGroundState(d, state, sample, 0), images, solids: [] };
      if (d.kind === "plate-gate") e.solids.push(createWorld04Solid(scene, player, d.door));
      if (d.kind === "press") for (let i = 0; i < 2; i++) e.solids.push(createWorld04Solid(scene, player, d.rect, () => { if (port.isActive()) port.kill(d.id, "physical"); }));
      this.entries.push(e); this.render(e);
    }
  }
  public sampleSurface(): PlayerSurfaceModifier | null {
    if (this.destroyed || !this.port.isActive()) return null;
    const body = this.player.body;
    if (!(body.blocked.down || body.touching.down) || body.velocity.y < 0) return null;
    let acceleration: number | null = null, deceleration: number | null = null, conveyorVelocityX = 0, beltFound = false, found = false;
    for (const e of [...this.entries].sort((a, b) => a.definition.id.localeCompare(b.definition.id))) {
      const d = e.definition;
      if ((d.kind !== "oil" && d.kind !== "belt") || !footOnRect(playerRect(this.player), d.rect)) continue;
      found = true;
      if (d.kind === "oil") { acceleration = Math.min(acceleration ?? Infinity, d.acceleration); deceleration = Math.min(deceleration ?? Infinity, d.deceleration); }
      else if (!beltFound) { conveyorVelocityX = e.step.conveyorVelocityX; beltFound = true; }
    }
    return found ? { acceleration, deceleration, conveyorVelocityX } : null;
  }
  private render(e: GroundEntry): void {
    const d = e.definition, step = e.step;
    e.images[0].setFrame(step.frame);
    if (d.kind === "belt") e.images[0].setFlipX(step.conveyorVelocityX < 0).setAlpha(step.warning && Math.floor(("elapsedMs" in e.state ? e.state.elapsedMs : 0) / 80) % 2 ? .6 : 1);
    if (d.kind === "press") for (let i = 0; i < 2; i++) {
      const r = step.dangerRects[i]; e.solids[i].setRect(r ?? null); e.images[i].setVisible(!!r);
      if (r) e.images[i].setOrigin(0).setPosition(r.x, r.y).setDisplaySize(r.width, r.height);
    }
    if (d.kind === "plate-gate") {
      e.solids[0].setRect(step.blockingRect);
      e.images[1].setPosition(d.door.x + d.door.width / 2, d.door.y + d.door.height - (step.blockingRect ? 0 : 160));
    }
  }
  public update(deltaMs: number): boolean {
    if (this.destroyed || !this.port.isActive()) return false;
    const generation = this.generation, after = playerRect(this.player), body = this.player.body;
    for (const e of this.entries) {
      const old = e.state;
      const step = advanceGroundState(e.definition, old, { before: this.previous, after, grounded: body.blocked.down || body.touching.down, velocityY: body.velocity.y, canLaunch: !this.player.isControlLocked() && !this.player.getControlOverride() }, deltaMs);
      e.state = step.state; e.step = step;
      // Test closing doors before enabling the static body, which would separate the player first.
      const dashEnded = step.risk === "attack" && this.previousDashing && !this.port.isDashing();
      if (step.risk !== "none" && step.dangerRects.some(r => dashEnded ? overlapRect(after, r) : sweepRect(this.previous, after, r, r)) && this.port.kill(e.definition.id, step.risk)) return true;
      if (generation !== this.generation) return true;
      if (step.launchVelocityY !== null && !this.controller.launchFromSurface(step.launchVelocityY)) e.state = old;
      this.render(e);
    }
    this.previous = after; this.previousDashing = this.port.isDashing(); return false;
  }
  public resetForAttempt(spawnX: number): void {
    if (!Number.isFinite(spawnX)) throw new Error("Invalid World 4 respawn");
    this.generation++; this.previous = playerRect(this.player); this.previousDashing = false; this.controller.clearSurfaceModifier();
    for (const e of this.entries) {
      e.state = createGroundState(e.definition);
      e.step = advanceGroundState(e.definition, e.state, { before: this.previous, after: this.previous, grounded: false, velocityY: 0, canLaunch: false }, 0);
      this.render(e);
    }
  }
  public getDebugState(): readonly World04DebugEntry[] { return this.entries.map(e => ({ id: e.definition.id, kind: e.definition.kind, state: "phase" in e.state ? e.state.phase : "started" in e.state ? e.state.started ? "active" : "idle" : "armed" in e.state ? e.state.armed ? "armed" : "launched" : "active", elapsedMs: "elapsedMs" in e.state ? e.state.elapsedMs : 0, rects: e.step.dangerRects })); }
  public destroy(): void { if (this.destroyed) return; this.destroyed = true; this.controller.clearSurfaceModifier(); this.entries.forEach(e => { e.solids.forEach(s => s.destroy()); e.images.forEach(i => i.destroy()); }); this.entries.length = 0; }
}
