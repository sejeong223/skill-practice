"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type { CustomOutfitDesign } from "@/game/core/types";
import { colorizeCustomOutfitPixels } from "@/game/entities/customOutfitTexture";

export function CustomOutfitPreview({ design }: { readonly design: CustomOutfitDesign }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas?.getContext("2d");
      if (!context) return;
      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const sourceContext = source.getContext("2d", { willReadFrequently: true });
      if (!sourceContext) return;
      sourceContext.drawImage(image, 0, 0);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
      pixels.data.set(colorizeCustomOutfitPixels(pixels.data, source.width, source.height, "run", design));
      sourceContext.putImageData(pixels, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 18, 50, 60, 43, 0, 0, canvas.width, canvas.height);
    };
    image.src = "/assets/pixel/characters/corgi/equipment/custom-outfit-template-run.png";
    return () => { image.onload = null; };
  }, [design]);
  return <canvas className="owned-custom-outfit-preview" ref={canvasRef} width={64} height={48} aria-label={`${design.id.slice(-1)}번 직접 그린 옷 미리보기`} />;
}
