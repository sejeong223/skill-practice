/** Bake a fitted suit around each corgi pose while keeping its face, tail, and paws. */
export function composeCostumePixels(
  corgi: Uint8Array | Uint8ClampedArray,
  costume: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  legCoverage: "body" | "sleeves" = "body",
): Uint8ClampedArray {
  if ((width !== 112 && width !== 448) || height !== 128 ||
      corgi.length !== width * height * 4 || costume.length !== corgi.length) {
    throw new Error("Invalid costume sprite dimensions");
  }
  const result = new Uint8ClampedArray(corgi);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    if (costume[index + 3] < 128) continue;
    const localX = x % 112;
    const frame = Math.floor(x / 112);
    const rise = width === 112 ? 3 : [0, 2, 0, 8][frame];
    const visibleDog = corgi[index + 3] >= 128;
    const paleFur = corgi[index] >= 200 && corgi[index + 1] >= 175 && corgi[index + 2] >= 145;
    const darkOutline = corgi[index] < 90 && corgi[index + 1] < 80 && corgi[index + 2] < 80;
    const head = visibleDog && (localX >= 83 || (legCoverage === "sleeves"
      ? localX >= 51 && y < 54 + rise || localX >= 68 && y < 63 + rise || localX >= 76 && y < 68 + rise
      : localX >= 51 && y < 55 + rise || localX >= 68 && y < 66 + rise || localX >= 76 && y < 72 + rise));
    const tail = visibleDog && localX < 21 && (legCoverage === "body" || y < 78 + rise);
    const paws = visibleDog && (legCoverage === "sleeves"
      ? (paleFur || darkOutline) && (localX < 36 && y >= 82 + rise || y >= 87 + rise)
      : y >= 92 + rise || localX < 34 && y >= 85 + rise || localX >= 60 && y >= 88 + rise);
    if (head || tail || paws || localX < 16 || localX > 90 || y < 22 || y > 100 + rise) continue;
    result[index] = costume[index];
    result[index + 1] = costume[index + 1];
    result[index + 2] = costume[index + 2];
    result[index + 3] = 255;
  }
  return result;
}
