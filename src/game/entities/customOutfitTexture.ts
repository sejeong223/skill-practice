import type { CustomOutfitDesign } from "../core/types";
import { CUSTOM_OUTFIT_CELL_COUNT, CUSTOM_OUTFIT_HEIGHT, CUSTOM_OUTFIT_WIDTH } from "../data/customOutfitPaint";

export type OutfitPose = "run" | "bark";

const runOffsets = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }, { x: 0, y: 8 }] as const;
const barkOffsets = [{ x: 0, y: 3 }] as const;
const garmentBounds = { left: 14, top: 52, width: 66, height: 40 } as const;

export function customOutfitPixelForCell(cellX: number, cellY: number): { x: number; y: number } {
  return {
    x: garmentBounds.left + Math.floor((cellX + 0.5) * garmentBounds.width / CUSTOM_OUTFIT_WIDTH),
    y: garmentBounds.top + Math.floor((cellY + 0.5) * garmentBounds.height / CUSTOM_OUTFIT_HEIGHT),
  };
}

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
      const garmentX = x - offset.x - garmentBounds.left;
      const garmentY = y - offset.y - garmentBounds.top;
      if (garmentX < 0 || garmentX >= garmentBounds.width || garmentY < 0 || garmentY >= garmentBounds.height) continue;
      const cellX = Math.floor(garmentX * CUSTOM_OUTFIT_WIDTH / garmentBounds.width);
      const cellY = Math.floor(garmentY * CUSTOM_OUTFIT_HEIGHT / garmentBounds.height);
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
