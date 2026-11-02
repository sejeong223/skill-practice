export type World04StageId =
  | "world-04-stage-1" | "world-04-stage-2"
  | "world-04-stage-3" | "world-04-stage-4";
export type World04ObstacleKind =
  | "scrap" | "tire" | "oil" | "belt" | "cable" | "press" | "plate-gate"
  | "crane" | "swing" | "saw";
export type World04TerrainKind = "collapse" | "rise";
export type World04Risk = "none" | "attack" | "physical" | "fall";
export interface World04Point { readonly x: number; readonly y: number; }
export interface World04Rect extends World04Point {
  readonly width: number; readonly height: number;
}
export interface World04Solid extends World04Rect {
  readonly id: string; readonly role: "ground" | "platform" | "ceiling";
}
export interface World04ObjectBase {
  readonly id: string;
  readonly triggerX: number;
}
export type World04Object =
  | (World04ObjectBase & { readonly kind: "scrap"; readonly rect: World04Rect })
  | (World04ObjectBase & { readonly kind: "tire"; readonly rect: World04Rect;
      readonly launchVelocityY: number })
  | (World04ObjectBase & { readonly kind: "oil"; readonly rect: World04Rect;
      readonly acceleration: number; readonly deceleration: number })
  | (World04ObjectBase & { readonly kind: "belt"; readonly rect: World04Rect;
      readonly speed: number; readonly periodMs: number; readonly warningMs: number;
      readonly initialDirection: -1 | 1 })
  | (World04ObjectBase & { readonly kind: "cable"; readonly rect: World04Rect;
      readonly periodMs: number; readonly offMs: number; readonly warningMs: number })
  | (World04ObjectBase & { readonly kind: "press"; readonly rect: World04Rect;
      readonly openMs: number; readonly warningMs: number; readonly closeMs: number;
      readonly holdMs: number; readonly reopenMs: number })
  | (World04ObjectBase & { readonly kind: "plate-gate";
      readonly plate: World04Rect; readonly door: World04Rect;
      readonly openMs: number; readonly rearmMs: number })
  | (World04ObjectBase & { readonly kind: "crane"; readonly payload: World04Rect;
      readonly liftTopY: number; readonly destinationX: number;
      readonly dwellMs: number; readonly legMs: number })
  | (World04ObjectBase & { readonly kind: "swing"; readonly pivot: World04Point;
      readonly length: number; readonly radius: number;
      readonly amplitudeRad: number; readonly periodMs: number })
  | (World04ObjectBase & { readonly kind: "saw";
      readonly fromX: number; readonly toX: number; readonly centerY: number;
      readonly radius: number; readonly periodMs: number });
export type World04Terrain =
  | { readonly id: string; readonly kind: "collapse"; readonly rect: World04Rect;
      readonly edgeDistance: number; readonly fallMs: number }
  | { readonly id: string; readonly kind: "rise"; readonly rect: World04Rect;
      readonly rearWidth: number; readonly frontWidth: number;
      readonly triggerInset: number; readonly riseHeight: number;
      readonly reactMs: number; readonly holdMs: number; readonly lowerMs: number };
export interface World04Coin extends World04Point { readonly id: string; }
export interface World04Cell {
  readonly id: "A" | "B" | "C" | "D" | "E";
  readonly x: number; readonly width: number; readonly template: World04Template;
}
export type World04Template =
  | "scrap-hop" | "dash-tunnel" | "collapse-scrap" | "rise-retreat"
  | "plate-saw" | "tire-swing" | "oil-electric" | "conveyor-press"
  | "saw-scrap" | "magnet-cross" | "rise-magnet" | "plate-saw-scrap"
  | "tire-swing-collapse";
export interface World04Layout {
  readonly stageId: World04StageId;
  readonly width: 3840; readonly height: 720; readonly floorY: 504;
  readonly spawn: World04Point; readonly checkpoint: World04Point;
  readonly cells: readonly World04Cell[];
  readonly solids: readonly World04Solid[];
  readonly gaps: readonly World04Rect[];
  readonly terrain: readonly World04Terrain[];
  readonly objects: readonly World04Object[];
  readonly coins: readonly World04Coin[];
}
export interface World04RuntimePort {
  isActive(): boolean;
  isDashing(): boolean;
  kill(sourceId: string, risk: Exclude<World04Risk, "none">): boolean;
}
export interface World04DebugEntry {
  readonly id: string;
  readonly kind: World04ObstacleKind | World04TerrainKind;
  readonly state: string;
  readonly elapsedMs: number;
  readonly rects: readonly World04Rect[];
}
