import type { CustomOutfitDesign } from "../core/types";
import { CUSTOM_OUTFIT_CELL_COUNT, CUSTOM_OUTFIT_HEIGHT, CUSTOM_OUTFIT_WIDTH } from "../data/customOutfitPaint";

export type OutfitPose = "run" | "bark" | "bite";

// The paint grid covers the white fabric in the approved 112 x 128 corgi sprite.
const garmentBounds = { left: 7, top: 40, width: 78, height: 56 } as const;

export function customOutfitPixelForCell(cellX: number, cellY: number): { x: number; y: number } {
  return {
    x: garmentBounds.left + Math.floor((cellX + 0.5) * garmentBounds.width / CUSTOM_OUTFIT_WIDTH),
    y: garmentBounds.top + Math.floor((cellY + 0.5) * garmentBounds.height / CUSTOM_OUTFIT_HEIGHT),
  };
}

export function customOutfitCellForPixel(x: number, y: number): number {
  const garmentX = x - garmentBounds.left;
  const garmentY = y - garmentBounds.top;
  if (garmentX < 0 || garmentX >= garmentBounds.width || garmentY < 0 || garmentY >= garmentBounds.height) return -1;
  const cellX = Math.floor(garmentX * CUSTOM_OUTFIT_WIDTH / garmentBounds.width);
  const cellY = Math.floor(garmentY * CUSTOM_OUTFIT_HEIGHT / garmentBounds.height);
  return cellY * CUSTOM_OUTFIT_WIDTH + cellX;
}

export function isWhiteSuitPixel(template: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  if (customOutfitCellForPixel(x % 112, y) < 0) return false;
  const offset = (y * width + x) * 4;
  const red = template[offset];
  const green = template[offset + 1];
  const blue = template[offset + 2];
  return template[offset + 3] >= 200 && Math.min(red, green, blue) >= 230 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) <= 8;
}

export function colorizeCustomOutfitPixels(
  template: Uint8ClampedArray,
  width: number,
  height: number,
  pose: OutfitPose,
  design: CustomOutfitDesign,
): Uint8ClampedArray {
  const frames = pose === "bark" ? 1 : 4;
  if (width !== frames * 112 || height !== 128 || template.length !== width * height * 4 ||
      design.cells.length !== CUSTOM_OUTFIT_CELL_COUNT) {
    throw new Error("Invalid custom outfit template or design size");
  }
  const result = new Uint8ClampedArray(template);
  const colors = design.cells.map((color) => {
    if (color === null) return null;
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error("Invalid custom outfit color");
    return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isWhiteSuitPixel(template, width, x, y)) continue;
    const color = colors[customOutfitCellForPixel(x % 112, y)];
    if (!color) continue;
    const pixel = (y * width + x) * 4;
    result[pixel] = color[0];
    result[pixel + 1] = color[1];
    result[pixel + 2] = color[2];
  }
  return result;
}
