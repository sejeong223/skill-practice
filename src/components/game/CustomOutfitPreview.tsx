"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type { CustomOutfitDesign } from "@/game/core/types";
import { colorizeCustomOutfitPixels } from "@/game/entities/customOutfitTexture";

export function CustomOutfitPreview({ design }: { readonly design: CustomOutfitDesign }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const template = new window.Image();
    let disposed = false;
    const draw = () => {
      if (disposed || !template.complete || !template.naturalWidth) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas?.getContext("2d");
      if (!context) return;
      const source = document.createElement("canvas");
      source.width = template.naturalWidth;
      source.height = template.naturalHeight;
      const sourceContext = source.getContext("2d", { willReadFrequently: true });
      if (!sourceContext) return;
      sourceContext.drawImage(template, 0, 0);
      const outfitPixels = sourceContext.getImageData(0, 0, source.width, source.height);
      const colored = colorizeCustomOutfitPixels(outfitPixels.data, source.width, source.height, "run", design);
      outfitPixels.data.set(colored);
      sourceContext.putImageData(outfitPixels, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 0, 0, 112, 128, 11, 0, 42, 48);
    };
    template.onload = draw;
    template.src = "/assets/pixel/characters/corgi/equipment/custom-outfit-template-run.png";
    return () => { disposed = true; template.onload = null; };
  }, [design]);
  return <canvas className="owned-custom-outfit-preview" ref={canvasRef} width={64} height={48} aria-label={`${design.id.slice(-1)}번 직접 그린 옷 미리보기`} />;
}
