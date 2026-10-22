import type { CustomOutfitDesign } from "../core/types";
import { CUSTOM_OUTFIT_CELL_COUNT, CUSTOM_OUTFIT_HEIGHT, CUSTOM_OUTFIT_WIDTH } from "../data/customOutfitPaint";

export type OutfitPose = "run" | "bark";

const runOffsets = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: -1, y: 0 }, { x: 0, y: 8 }] as const;
const barkOffsets = [{ x: 0, y: 3 }] as const;

export function colorizeCustomOutfitPixels(
  template: Uint8ClampedArray,
  width: number,
  height: number,
  pose: OutfitPose,
  design: CustomOutfitDesign,
): Uint8ClampedArray {
  const frames = pose === "run" ? 4 : 1;
  if (width !== frames * 112 || height !== 128 || template.length !== width * height * 4 ||
      design.cells.length !== CUSTOM_OUTFIT_CELL_COUNT) {
    throw new Error("Invalid custom outfit template or design size");
  }
  const result = new Uint8ClampedArray(template);
  const offsets = pose === "run" ? runOffsets : barkOffsets;
  for (let frame = 0; frame < frames; frame++) {
    const offset = offsets[frame];
    for (let y = 0; y < height; y++) for (let x = 0; x < 112; x++) {
      const pixel = (y * width + frame * 112 + x) * 4;
      if (template[pixel + 3] < 200 || template[pixel] < 200 ||
          template[pixel + 1] < 200 || template[pixel + 2] < 200) continue;
      const cellX = x - offset.x - 20;
      const cellY = y - offset.y - 55;
      if (cellX < 0 || cellX >= CUSTOM_OUTFIT_WIDTH || cellY < 0 || cellY >= CUSTOM_OUTFIT_HEIGHT) continue;
      const color = design.cells[cellY * CUSTOM_OUTFIT_WIDTH + cellX];
      if (color === null) continue;
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error("Invalid custom outfit color");
      result[pixel] = parseInt(color.slice(1, 3), 16);
      result[pixel + 1] = parseInt(color.slice(3, 5), 16);
      result[pixel + 2] = parseInt(color.slice(5, 7), 16);
    }
  }
  return result;
}
