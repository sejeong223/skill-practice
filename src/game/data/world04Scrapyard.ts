import type { World04Cell, World04Layout, World04Object, World04Rect, World04Solid, World04StageId, World04Template, World04Terrain } from "./world04Types";
import { validateWorld04Layout } from "./world04LayoutValidation";

const stageTemplates: readonly (readonly World04Template[])[] = [
  ["scrap-hop", "dash-tunnel", "collapse-scrap", "rise-retreat", "plate-saw"],
  ["tire-swing", "oil-electric", "conveyor-press", "rise-retreat", "saw-scrap"],
  ["magnet-cross", "plate-saw", "conveyor-press", "collapse-scrap", "saw-scrap"],
  ["tire-swing-collapse", "oil-electric", "rise-magnet", "conveyor-press", "plate-saw-scrap"],
];
const positions = [[288, 560], [944, 560], [1600, 560], [2736, 400], [3232, 400]] as const;

function buildLayout(stageId: World04StageId, templates: readonly World04Template[]): World04Layout {
  const objects: World04Object[] = [], terrain: World04Terrain[] = [], gaps: World04Rect[] = [], solids: World04Solid[] = [];
  const cells: World04Cell[] = templates.map((template, i) => ({ id: ("ABCDE"[i]) as World04Cell["id"], x: positions[i][0], width: positions[i][1], template }));
  for (const c of cells) {
    const rect = (x: number, y: number, width: number, height: number) => ({ x: c.x + x, y, width, height });
    const id = (kind: string) => `${stageId}-${c.id}-${kind}-${objects.length + terrain.length + solids.length}`;
    const base = (kind: string) => ({ id: id(kind), triggerX: c.x });
    const scrap = (x: number, height = 32) => objects.push({ ...base("scrap"), kind: "scrap", rect: rect(x, 504 - height, 48, height) });
    const oil = (x: number, width = 160) => objects.push({ ...base("oil"), kind: "oil", rect: rect(x, 498, width, 6), acceleration: 900, deceleration: 360 });
    const tire = (x: number, top = 504) => objects.push({ ...base("tire"), kind: "tire", rect: rect(x, top - 6, 72, 6), launchVelocityY: -620 });
    const belt = (x: number, width = 160) => objects.push({ ...base("belt"), kind: "belt", rect: rect(x, 498, width, 6), speed: 90, periodMs: 2400, warningMs: 300, initialDirection: -1 });
    const cable = (x: number) => objects.push({ ...base("cable"), kind: "cable", rect: rect(x, 460, 16, 44), periodMs: 2200, offMs: 210, warningMs: 250 });
    const saw = (a: number, b: number, y = 392) => objects.push({ ...base("saw"), kind: "saw", fromX: c.x + a, toX: c.x + b, centerY: y, radius: 22, periodMs: 1800 });
    const swing = (x: number) => objects.push({ ...base("swing"), kind: "swing", pivot: { x: c.x + x, y: 245 }, length: 150, radius: 24, amplitudeRad: .75, periodMs: 2200 });
    const platform = (x: number, y: number, width: number, role: "platform" | "ceiling" = "platform", height = 24) => solids.push({ ...rect(x, y, width, height), id: id(role), role });
    const collapse = (x: number) => terrain.push({ id: id("collapse"), kind: "collapse", rect: rect(x, 504, 128, 32), edgeDistance: 12, fallMs: 180 });
    const rise = (x: number) => terrain.push({ id: id("rise"), kind: "rise", rect: rect(x, 504, 112, 32), rearWidth: 80, frontWidth: 32, triggerInset: 56, riseHeight: 320, reactMs: 700, holdMs: 300, lowerMs: 180 });
    const gate = () => objects.push({ ...base("plate-gate"), kind: "plate-gate", plate: rect(56, 498, 48, 6), door: rect(240, 360, 16, 144), openMs: 850, rearmMs: 300 });
    const crane = (x: number, trigger: number) => objects.push({ ...base("crane"), triggerX: c.x + trigger, kind: "crane", payload: rect(x, 424, 72, 80), destinationX: c.x + x + 88, liftTopY: 330, dwellMs: 800, legMs: 600 });
    switch (c.template) {
      case "scrap-hop":
        oil(24, 80); scrap(136); platform(256, 448, 128); tire(280, 448);
        gaps.push(rect(408, 504, 96, 216)); saw(300, 440, 280); break;
      case "dash-tunnel":
        oil(64); cable(272); platform(184, 424, 160, "ceiling", 20);
        scrap(456); saw(408, 504); belt(384, 64); break;
      case "collapse-scrap": {
        const compact = c.width === 400;
        collapse(compact ? 96 : 224); scrap(compact ? 296 : 464);
        tire(compact ? 0 : 64); saw(compact ? 272 : 416, compact ? 360 : 504);
        if (!compact) swing(304); break;
      }
      case "rise-retreat":
        rise(160); scrap(320); saw(304, 376, 350); break;
      case "plate-saw":
      case "plate-saw-scrap":
        gate(); saw(144, 304); oil(8, 40); belt(128, 80);
        if (c.template === "plate-saw-scrap") scrap(128, 28);
        else { scrap(320); } break;
      case "tire-swing":
      case "tire-swing-collapse":
        tire(96); swing(310); platform(320, 448, 128); scrap(472);
        oil(8, 48); saw(432, 504, 330);
        if (c.template === "tire-swing") gaps.push(rect(224, 504, 128, 216));
        else collapse(224); break;
      case "oil-electric":
        oil(64); cable(286); platform(214, 424, 128, "ceiling", 20);
        scrap(456); saw(432, 504); belt(8, 48); break;
      case "conveyor-press":
        belt(64, 112); objects.push({ ...base("press"), kind: "press", rect: rect(256, 392, 128, 112), openMs: 700, warningMs: 240, closeMs: 260, holdMs: 500, reopenMs: 260 });
        saw(80, 200, 360); oil(8, 40);
        if (c.width > 400) { scrap(488); saw(432, 504); } break;
      case "saw-scrap":
        scrap(144); saw(120, 312); oil(16, 80); cable(336);
        platform(280, 424, 120, "ceiling", 20); break;
      case "magnet-cross":
        crane(248, 80); scrap(120); saw(96, 192); oil(424, 80); cable(472);
        platform(408, 424, 144, "ceiling", 20); break;
      case "rise-magnet":
        rise(96); crane(392, 304); saw(288, 360, 350); oil(240, 96); break;
    }
  }
  // The last approach to the checkpoint becomes a denser timing puzzle in later stages.
  const number = Number(stageId.slice(-1));
  if (number >= 2) objects.push({ id: `${stageId}-approach-scrap`, triggerX: 2176, kind: "scrap", rect: { x: 2288, y: 472, width: 48, height: 32 } });
  if (number >= 3) objects.push({ id: `${stageId}-approach-saw`, triggerX: 2176, kind: "saw", fromX: 2272, toX: 2344, centerY: 392, radius: 22, periodMs: 1800 });
  if (number >= 4) objects.push({ id: `${stageId}-approach-belt`, triggerX: 2176, kind: "belt", rect: { x: 2224, y: 498, width: 88, height: 6 }, speed: 90, periodMs: 2400, warningMs: 300, initialDirection: -1 });
  const holes = [...gaps, ...terrain.filter(t => t.kind === "collapse").map(t => t.rect)].sort((a, b) => a.x - b.x);
  let x = 0;
  for (const h of [...holes, { x: 3840, width: 0 }]) {
    if (h.x > x) solids.push({ id: `${stageId}-floor-${x}`, role: "ground", x, y: 504, width: h.x - x, height: 32 });
    x = h.x + h.width;
  }
  const coinX = [96, 160, 224, 880, 912, 1568, 2208, 2288, 2400, 2496, 2608, 2672, 3168, 3648, 3744];
  return { stageId, width: 3840, height: 720, floorY: 504, spawn: { x: 96, y: 504 }, checkpoint: { x: 2496, y: 504 }, cells, solids, gaps, terrain, objects,
    coins: coinX.map((x, i) => ({ id: `${stageId}-segment-${Math.floor(i / 3) + 1}-coin-${i % 3 + 1}`, x, y: 464 })) };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const layouts = stageTemplates.map((templates, i) => {
  const layout = buildLayout(`world-04-stage-${i + 1}` as World04StageId, templates);
  const errors = validateWorld04Layout(layout);
  if (errors.length) throw new Error(`${layout.stageId}: ${errors.join("; ")}`);
  return freeze(layout);
});
export function isWorld04StageId(id: string): id is World04StageId { return /^world-04-stage-[1-4]$/.test(id); }
export function getWorld04Layout(id: string): World04Layout | null { return layouts.find(l => l.stageId === id) ?? null; }
