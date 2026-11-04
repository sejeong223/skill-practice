import { GameEventBus, type GameEventType } from "../bridge/GameEventBus";
import type { ProgressState, StageId } from "../core/types";
import type { World02TravelState } from "../data/world02Travel";
import { getWorld01ReplayTarget } from "../systems/worldSelection";
import type { SaveEvent } from "./contracts";
import { parseSaveEvent, validateProgress } from "./validation";
const active = new WeakMap<GameEventBus, GameCloudBridge>();
const auxiliary: readonly GameEventType[] = ["coin-changed", "death-count-updated", "player-name-confirmed", "skill-unlocked",
  "tool-purchased", "market-item-purchased", "cosmetic-change-requested", "equipment-change-requested", "collectible-found",
  "keybinds-changed", "drawback-discovered", "cutscene-finished", "custom-outfit-change-requested", "custom-outfit-saved"];
export class GameCloudBridge {
  private subscriptions: (() => void)[] = [];
  private destroyed = false;
  private scheduled = false;
  private lastProgress = "";
  private stageId: StageId;
  constructor(private readonly bus: GameEventBus, private readonly getProgress: () => ProgressState,
    getRuntime: () => { seed: number; world02Travel: World02TravelState },
    private readonly onObservation: (event: SaveEvent, progress: ProgressState) => void, initialStageId: StageId = "world-01-stage-1") {
    active.get(bus)?.destroy(); active.set(bus, this); this.stageId = initialStageId;
    this.subscriptions.push(bus.on("stage-started", ({ stageId }) => {
      this.stageId = stageId; const runtime = getRuntime();
      this.collectObservation({ kind: "stage-enter", stageId, seed: runtime.seed, world02Travel: runtime.world02Travel });
    }), bus.on("stage-completed", ({ stageId }) => this.collectObservation({ kind: "stage-complete", stageId })),
    bus.on("checkpoint-activated", ({ stageId, origin, snapshot }) => this.collectObservation({ kind: "checkpoint", stageId, origin, snapshot })),
    bus.on("world-selection-committed", ({ selection }) => {
      this.stageId = selection.worldId === "world-01" ? getWorld01ReplayTarget(selection.point).stageId : "world-02-stage-1";
      this.collectObservation({ kind: "world-select", selection });
    }));
    for (const event of auxiliary) this.subscriptions.push(bus.on(event, () => this.requestState()));
  }
  collectObservation(event: SaveEvent): void {
    if (this.destroyed) return;
    const progress = validateProgress(this.getProgress());
    this.lastProgress = JSON.stringify(progress);
    this.onObservation(parseSaveEvent(event), progress);
  }
  requestState(): void {
    if (this.destroyed || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.destroyed) return;
      const progress = validateProgress(this.getProgress());
      if (JSON.stringify(progress) !== this.lastProgress) this.collectObservation({ kind: "state", stageId: this.stageId });
    });
  }
  destroy(): void {
    this.destroyed = true; this.subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
    if (active.get(this.bus) === this) active.delete(this.bus);
  }
}
