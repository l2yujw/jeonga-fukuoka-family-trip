// Trusted session appearance only; never part of persisted layout metadata.
export const WATERCOLOR_BACKGROUNDS = [
  { key: "ivory", label: "아이보리", paper: "#fffaf0" },
  { key: "blush", label: "블러시", paper: "#f8dce3" },
  { key: "butter", label: "버터", paper: "#f8e8b5" },
  { key: "sky", label: "스카이", paper: "#d9eaf6" },
] as const;

export type WatercolorAppearance = Readonly<{
  backgroundVariant: (typeof WATERCOLOR_BACKGROUNDS)[number]["key"];
}>;

export function freezeWatercolorAppearance(appearance?: WatercolorAppearance): WatercolorAppearance {
  const backgroundVariant = WATERCOLOR_BACKGROUNDS.find(preset => preset.key === appearance?.backgroundVariant)?.key ?? "ivory";
  return Object.freeze({ backgroundVariant });
}

export const DEFAULT_WATERCOLOR_APPEARANCE = freezeWatercolorAppearance();

// The full-bleed One Moment keeps its original ivory composition. Colored paper
// surrounds the entire composition, so its photo crop and text stay together.
export function watercolorContentInset(templateKey: string, appearance?: WatercolorAppearance) {
  return templateKey === "one_moment" && freezeWatercolorAppearance(appearance).backgroundVariant !== "ivory" ? .025 : 0;
}
