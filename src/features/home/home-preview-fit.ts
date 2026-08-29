export type HomeImageFit = {
  mode: "bounded" | "contain" | "cover";
  scale: number;
};

export function getHomeImageFit(
  sourceWidth: number | null,
  sourceHeight: number | null,
  targetWidth: number,
  targetHeight: number,
): HomeImageFit {
  if (!sourceWidth || !sourceHeight) {
    return { mode: "cover", scale: 1 };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const visibleFraction = Math.min(
    sourceRatio / targetRatio,
    targetRatio / sourceRatio,
  );

  if (visibleFraction >= 0.78) {
    return { mode: "cover", scale: 1 };
  }

  if (visibleFraction <= 0.5) {
    return { mode: "contain", scale: 1 };
  }

  return {
    mode: "bounded",
    scale: Math.min(1.22, Math.max(1.08, 0.86 / visibleFraction)),
  };
}
