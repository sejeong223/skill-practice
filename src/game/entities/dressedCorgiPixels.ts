/** Bake clothing into the corgi's own pixels so torso fur cannot show between layers. */
export function composeDressedCorgiPixels(
  corgi: Uint8Array | Uint8ClampedArray,
  garment: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  puffed = false,
): Uint8ClampedArray {
  if (width % 112 !== 0 || height !== 128 || corgi.length !== width * height * 4 || garment.length !== corgi.length) {
    throw new Error("Invalid dressed corgi sprite dimensions");
  }
  const result = new Uint8ClampedArray(corgi);
  const baseVisible = (x: number, y: number): boolean => corgi[(y * width + x) * 4 + 3] >= 128;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const garmentAlpha = garment[index + 3] / 255;
    if (garmentAlpha === 0) continue;
    const localX = x % 112;
    const outsideBody = !baseVisible(x, y);
    if (outsideBody) {
      if (!puffed || localX < 11 || localX > 78 || y < 54 || y > 93) continue;
      let closeToBody = false;
      for (let dy = -2; dy <= 2 && !closeToBody; dy++) for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < width && py >= 0 && py < height && Math.floor(px / 112) === Math.floor(x / 112) && baseVisible(px, py)) {
          closeToBody = true;
          break;
        }
      }
      if (!closeToBody) continue;
    } else {
      // Keep the corgi's own pixel outline, face, tail, and paws in front of the sewn suit.
      const darkOutline = corgi[index] < 77 && corgi[index + 1] < 67 && corgi[index + 2] < 68;
      if (darkOutline || localX >= 83 || (y >= 90 && (localX < 36 || localX > 63))) continue;
    }
    if (outsideBody) {
      result[index] = garment[index];
      result[index + 1] = garment[index + 1];
      result[index + 2] = garment[index + 2];
      result[index + 3] = garment[index + 3];
    } else {
      result[index] = Math.round(garment[index] * garmentAlpha + corgi[index] * (1 - garmentAlpha));
      result[index + 1] = Math.round(garment[index + 1] * garmentAlpha + corgi[index + 1] * (1 - garmentAlpha));
      result[index + 2] = Math.round(garment[index + 2] * garmentAlpha + corgi[index + 2] * (1 - garmentAlpha));
    }
  }
  return result;
}
