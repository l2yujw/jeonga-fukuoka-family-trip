export type MemoryCardTemplateKey =
  | "polaroid_moodboard"
  | "four_cut"
  | "editorial_collage"
  | "postcard_duo"
  | "scrapbook_trio"
  | "film_contact_sheet";

export type MemoryCardPhotoSlot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  z: number;
  frame: "polaroid" | "strip" | "plain";
};

export type MemoryCardTextStyleKey =
  | "memory-line"
  | "four-cut-footer"
  | "date-small"
  | "editorial-title"
  | "editorial-caption";

export type MemoryCardTextSlot = {
  id: string;
  x: number;
  y: number;
  maxWidth: number;
  style: MemoryCardTextStyleKey;
};

export type MemoryCardCaptionStyle = {
  fontFamily: "editorial" | "sans";
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  lineHeight: number;
  color: string;
  textAlign: "left" | "center";
  maxLines: number;
  letterSpacing?: number;
};

export type ExportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  background: "transparent" | "template";
};

export type MemoryCardTemplateSpec = {
  key: MemoryCardTemplateKey;
  displayName: string;
  acceptedMin: number;
  acceptedMax: number;
  backgroundColor: string;
  exportBounds: ExportBounds;
  slots: readonly MemoryCardPhotoSlot[];
  textSlots: readonly MemoryCardTextSlot[];
};

export const MEMORY_CARD_CANVAS = { width: 1080, height: 1920 } as const;

export const MEMORY_CARD_FONT_STACKS = {
  editorial: '"Noto Serif KR", "AppleMyungjo", "Nanum Myeongjo", Batang, serif',
  sans: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
} as const;

export const MEMORY_CARD_TEXT_STYLES = {
  "memory-line": {
    fontFamily: "editorial",
    fontSize: 32,
    fontWeight: 500,
    lineHeight: 46,
    color: "#4b392d",
    textAlign: "center",
    maxLines: 2,
  },
  "four-cut-footer": {
    fontFamily: "sans",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 38,
    color: "#fff9ec",
    textAlign: "center",
    maxLines: 2,
  },
  "date-small": {
    fontFamily: "sans",
    fontSize: 22,
    fontWeight: 500,
    lineHeight: 30,
    color: "#ded7ca",
    textAlign: "center",
    maxLines: 1,
    letterSpacing: 0.8,
  },
  "editorial-title": {
    fontFamily: "editorial",
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 52,
    color: "#392f28",
    textAlign: "left",
    maxLines: 1,
    letterSpacing: 2,
  },
  "editorial-caption": {
    fontFamily: "editorial",
    fontSize: 32,
    fontWeight: 500,
    lineHeight: 48,
    color: "#4b392d",
    textAlign: "left",
    maxLines: 2,
  },
} as const satisfies Record<MemoryCardTextStyleKey, MemoryCardCaptionStyle>;

const FULL_CANVAS_EXPORT = {
  x: 0,
  y: 0,
  width: MEMORY_CARD_CANVAS.width,
  height: MEMORY_CARD_CANVAS.height,
  background: "template",
} as const;

const FOUR_CUT_SLOTS = [
  { id: "f1", x: 290, y: 170, w: 500, h: 330, r: 0, z: 1, frame: "strip" },
  { id: "f2", x: 290, y: 520, w: 500, h: 330, r: 0, z: 1, frame: "strip" },
  { id: "f3", x: 290, y: 870, w: 500, h: 330, r: 0, z: 1, frame: "strip" },
  { id: "f4", x: 290, y: 1220, w: 500, h: 330, r: 0, z: 1, frame: "strip" },
] as const satisfies readonly MemoryCardPhotoSlot[];

const FOUR_CUT_TEXT_SLOTS = [
  { id: "t1", x: 330, y: 1600, maxWidth: 420, style: "four-cut-footer" },
  { id: "t2", x: 330, y: 1660, maxWidth: 420, style: "date-small" },
] as const satisfies readonly MemoryCardTextSlot[];

const fourCutLeft = Math.min(...FOUR_CUT_SLOTS.map(({ x }) => x)) - 20;
const fourCutTop = Math.min(...FOUR_CUT_SLOTS.map(({ y }) => y)) - 40;
const fourCutRight = Math.max(...FOUR_CUT_SLOTS.map(({ x, w }) => x + w)) + 20;
const fourCutBottom = FOUR_CUT_TEXT_SLOTS[1].y +
  MEMORY_CARD_TEXT_STYLES["date-small"].lineHeight + 70;

export const FOUR_CUT_EXPORT_BOUNDS = {
  x: fourCutLeft,
  y: fourCutTop,
  width: fourCutRight - fourCutLeft,
  height: fourCutBottom - fourCutTop,
  background: "template",
} as const satisfies ExportBounds;

export const MEMORY_CARD_TEMPLATE_SPECS = [
  {
    key: "polaroid_moodboard",
    displayName: "Polaroid Moodboard",
    acceptedMin: 6,
    acceptedMax: 6,
    backgroundColor: "#ddc7a8",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "p1", x: 70, y: 170, w: 470, h: 560, r: -4, z: 2, frame: "polaroid" },
      { id: "p2", x: 560, y: 120, w: 390, h: 480, r: 3, z: 1, frame: "polaroid" },
      { id: "p3", x: 130, y: 760, w: 360, h: 430, r: 2, z: 3, frame: "polaroid" },
      { id: "p4", x: 520, y: 650, w: 450, h: 520, r: -2, z: 2, frame: "polaroid" },
      { id: "p5", x: 70, y: 1240, w: 420, h: 480, r: -3, z: 1, frame: "polaroid" },
      { id: "p6", x: 520, y: 1210, w: 410, h: 490, r: 4, z: 2, frame: "polaroid" },
    ],
    textSlots: [
      { id: "t1", x: 120, y: 1740, maxWidth: 840, style: "memory-line" },
    ],
  },
  {
    key: "four_cut",
    displayName: "Four Cut",
    acceptedMin: 4,
    acceptedMax: 4,
    backgroundColor: "#2f2925",
    exportBounds: FOUR_CUT_EXPORT_BOUNDS,
    slots: FOUR_CUT_SLOTS,
    textSlots: FOUR_CUT_TEXT_SLOTS,
  },
  {
    key: "editorial_collage",
    displayName: "Editorial Collage",
    acceptedMin: 4,
    acceptedMax: 5,
    backgroundColor: "#f3eadb",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "e1", x: 80, y: 220, w: 600, h: 760, r: 0, z: 1, frame: "plain" },
      { id: "e2", x: 710, y: 240, w: 290, h: 350, r: 0, z: 2, frame: "plain" },
      { id: "e3", x: 700, y: 630, w: 300, h: 350, r: 0, z: 2, frame: "plain" },
      { id: "e4", x: 80, y: 1040, w: 430, h: 500, r: 0, z: 1, frame: "plain" },
      { id: "e5", x: 540, y: 1040, w: 460, h: 500, r: 0, z: 1, frame: "plain" },
    ],
    textSlots: [
      { id: "title", x: 80, y: 100, maxWidth: 900, style: "editorial-title" },
      { id: "caption", x: 80, y: 1600, maxWidth: 900, style: "editorial-caption" },
    ],
  },
  {
    key: "postcard_duo",
    displayName: "Travel Postcard",
    acceptedMin: 2,
    acceptedMax: 2,
    backgroundColor: "#e8d6bd",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "pd1", x: 80, y: 360, w: 920, h: 620, r: 0, z: 1, frame: "plain" },
      { id: "pd2", x: 570, y: 1040, w: 380, h: 470, r: 4, z: 2, frame: "polaroid" },
    ],
    textSlots: [
      { id: "title", x: 90, y: 170, maxWidth: 900, style: "editorial-title" },
      { id: "caption", x: 90, y: 1640, maxWidth: 900, style: "editorial-caption" },
    ],
  },
  {
    key: "scrapbook_trio",
    displayName: "Scrapbook Trio",
    acceptedMin: 3,
    acceptedMax: 3,
    backgroundColor: "#ddc7a8",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "st1", x: 90, y: 170, w: 430, h: 540, r: -4, z: 1, frame: "polaroid" },
      { id: "st2", x: 570, y: 260, w: 420, h: 520, r: 4, z: 2, frame: "polaroid" },
      { id: "st3", x: 300, y: 840, w: 480, h: 600, r: -2, z: 3, frame: "polaroid" },
    ],
    textSlots: [
      { id: "caption", x: 120, y: 1540, maxWidth: 840, style: "memory-line" },
    ],
  },
  {
    key: "film_contact_sheet",
    displayName: "Film Contact Sheet",
    acceptedMin: 6,
    acceptedMax: 6,
    backgroundColor: "#332c28",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "fc1", x: 90, y: 210, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
      { id: "fc2", x: 560, y: 210, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
      { id: "fc3", x: 90, y: 650, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
      { id: "fc4", x: 560, y: 650, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
      { id: "fc5", x: 90, y: 1090, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
      { id: "fc6", x: 560, y: 1090, w: 430, h: 340, r: 0, z: 1, frame: "strip" },
    ],
    textSlots: [
      { id: "caption", x: 90, y: 1580, maxWidth: 900, style: "four-cut-footer" },
      { id: "t2", x: 90, y: 1680, maxWidth: 900, style: "date-small" },
    ],
  },
] as const satisfies readonly MemoryCardTemplateSpec[];

export function getMinimumMemoryCardPhotoCount() {
  return Math.min(...MEMORY_CARD_TEMPLATE_SPECS.map(({ acceptedMin }) => acceptedMin));
}

export const LEGACY_MEMORY_CARD_TEMPLATE_SPECS = [
  {
    key: "polaroid_moodboard",
    displayName: "Polaroid Moodboard",
    acceptedMin: 3,
    acceptedMax: 3,
    backgroundColor: "#ddc7a8",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "hero", x: 227, y: 173, w: 626, h: 782, r: -1, z: 10, frame: "polaroid" },
      { id: "left", x: 54, y: 1200, w: 432, h: 540, r: -4, z: 1, frame: "polaroid" },
      { id: "right", x: 594, y: 1200, w: 432, h: 540, r: 4, z: 1, frame: "polaroid" },
    ],
    textSlots: [],
  },
  {
    key: "four_cut",
    displayName: "Four Cut",
    acceptedMin: 4,
    acceptedMax: 4,
    backgroundColor: "#2f2925",
    exportBounds: FOUR_CUT_EXPORT_BOUNDS,
    slots: FOUR_CUT_SLOTS.map((slot, index) => ({ ...slot, id: `cut-${index + 1}` })),
    textSlots: [],
  },
  {
    key: "editorial_collage",
    displayName: "Editorial Collage",
    acceptedMin: 3,
    acceptedMax: 3,
    backgroundColor: "#f3eadb",
    exportBounds: FULL_CANVAS_EXPORT,
    slots: [
      { id: "feature", x: 80, y: 220, w: 600, h: 1320, r: 0, z: 1, frame: "plain" },
      { id: "top", x: 710, y: 220, w: 290, h: 640, r: 0, z: 2, frame: "plain" },
      { id: "bottom", x: 710, y: 900, w: 290, h: 640, r: 0, z: 2, frame: "plain" },
    ],
    textSlots: [
      { id: "title", x: 80, y: 100, maxWidth: 900, style: "editorial-title" },
    ],
  },
] as const satisfies readonly MemoryCardTemplateSpec[];

export function getMemoryCardTemplateSpec(key: string) {
  return MEMORY_CARD_TEMPLATE_SPECS.find((template) => template.key === key) ?? null;
}

export function getLegacyMemoryCardTemplateSpec(key: string) {
  return LEGACY_MEMORY_CARD_TEMPLATE_SPECS.find((template) => template.key === key) ?? null;
}
