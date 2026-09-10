import catalog from "./watercolor-catalog.json" with { type: "json" };
import type { MemoryCardPhotoSlot, MemoryCardTemplateKey, MemoryCardTemplateSpec } from "./memory-card-template-spec";
export const WATERCOLOR_REVISION = "watercolor-2026-v1" as const;
export const WATERCOLOR_ASSET_PREFIX = "/api/cards-asset/wc-";
export type WatercolorBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
};
export type WatercolorField = WatercolorBox & {
  id: string;
  label: string;
  kind: "plainText" | "isoDate";
  photoSlotId: string | null;
  role: string | null;
  vertical: boolean;
  maxCodePoints: number;
  maxLines: number;
  defaultPolicy: string;
  font: "serif" | "pen";
  size: number;
  lineHeight: number;
  color: string;
  align: "left" | "center";
  anchorSlotId?: string;
  z: number;
  optional: true;
  overflow: "reject";
};
export type WatercolorArt = WatercolorBox & {
  asset: string;
  z: number;
  tripDateOnly?: true;
};
export type WatercolorPanel = WatercolorBox & {
  fill: string;
  dashed?: boolean;
  radius?: number;
  shape?: "tag" | "ticket";
  tripDateOnly?: true;
};
export type WatercolorTemplate = MemoryCardTemplateSpec & {
  revision: typeof WATERCOLOR_REVISION;
  primary: string;
  fields: WatercolorField[];
  art: WatercolorArt[];
  panels: WatercolorPanel[];
  label: WatercolorBox;
};
const s = 1080 / 941;
const box = (x: number, y: number, w: number, h: number, r = 0): WatercolorBox => ({ x: x * s, y: y * s, w: w * s, h: h * s, r });
const art = (asset: string, x: number, y: number, w: number, h: number, r = 0): WatercolorArt => ({ ...box(x, y, w, h, r), asset, z: 30 });
const panel = (x: number, y: number, w: number, h: number, fill = "#fffcf6", r = 0, dashed = false, radius = 18): WatercolorPanel => ({ ...box(x, y, w, h, r), fill, dashed, radius: radius * s });
const photo = (id: string, x: number, y: number, w: number, h: number, r = 0, pad = 0, footer = 0): MemoryCardPhotoSlot => ({
  id, x: x * s, y: y * s, w: w * s, h: h * s, r, z: 10, frame: pad ? "polaroid" : "plain",
  viewport: { x: pad * s, y: pad * s, width: (w - pad * 2) * s, height: (h - pad * 2 - footer) * s },
});
type FieldPosition = [
  number,
  number,
  number,
  number,
  number,
  ("serif" | "pen")?,
  ("left" | "center")?,
  number?,
  string?
];
type Geometry = {
  slots: MemoryCardPhotoSlot[];
  fields: Record<string, FieldPosition>;
  art: WatercolorArt[];
  panels: WatercolorPanel[];
  label: WatercolorBox;
};
const geometry: Record<MemoryCardTemplateKey, Geometry> = {
  polaroid_moodboard: {
    label: box(300, 78, 342, 46),
    slots: [photo("p1", 75, 359, 411, 487, -6, 19, 65), photo("p2", 486, 403, 388, 454, 7, 19, 65), photo("p3", 71, 862, 400, 440, -3, 19, 65), photo("p4", 463, 866, 392, 444, 8, 19, 65)],
    fields: { main_title: [203, 199, 545, 87, 60, "serif"], subtitle: [265, 291, 420, 62, 25, "serif"],
      "photo.p1.caption": [27, 415, 357, 65, 26, "serif", "center", 0, "p1"], "photo.p2.caption": [25, 383, 338, 62, 25, "serif", "center", 0, "p2"],
      "photo.p3.caption": [25, 369, 350, 62, 25, "serif", "center", 0, "p3"], "photo.p4.caption": [25, 373, 342, 62, 25, "serif", "center", 0, "p4"],
      footer_note: [192, 1425, 354, 120, 28, "serif", "left"], "trip.start": [635, 1441, 199, 40, 27], "trip.end": [635, 1500, 199, 40, 27] },
    panels: [panel(33, 27, 876, 1619), panel(79, 1370, 500, 189, "#fffaf4", 0, true), { ...panel(612, 1358, 242, 205), shape: "ticket", tripDateOnly: true }],
    art: [art("polaroid-flower", 87, 138, 132, 180), art("polaroid-flower", 727, 144, 131, 176, 24), art("polaroid-sprig", 433, 119, 84, 51), art("fourcut-flower", 93, 1421, 79, 123), { ...art("scrapbook-flower", 802, 1459, 73, 106, 18), tripDateOnly: true }, art("tape-pink", 158, 840, 138, 48, 2)]
  },
  four_cut: {
    label: box(406, 72, 145, 40),
    slots: [0, 1, 2, 3].map(i => photo(`f${i + 1}`, 310, 132 + i * 288, 439, 273)),
    fields: { vertical_title: [193, 220, 66, 499, 52, "serif"], vertical_subtitle: [208, 780, 36, 309, 24, "serif"], footer_note: [210, 1383, 285, 158, 28, "serif", "left"], "trip.start": [564, 1438, 190, 40, 25], "trip.end": [564, 1501, 190, 40, 25] },
    panels: [panel(146, 33, 655, 1545, "#fffcf6", 0, false, 26), panel(299, 119, 463, 1164), { ...panel(565, 1361, 189, 57, "#fff1e8", 0, false, 20), tripDateOnly: true }],
    art: [art("fourcut-flower", 172, 1090, 99, 203), art("moment-sprig", 350, 69, 44, 40, -50), art("moment-sprig", 556, 69, 44, 40, 50), art("polaroid-sprig", 193, 721, 65, 45), art("moment-sprig", 174, 135, 55, 51, -30), art("polaroid-sprig", 451, 1306, 42, 32)]
  },
  editorial_collage: {
    label: box(332, 43, 278, 40),
    slots: [photo("e1", 375, 153, 525, 630), photo("e2", 47, 819, 282, 226), photo("e3", 342, 819, 253, 226), photo("e4", 608, 819, 287, 226), photo("e5", 47, 1169, 411, 247), photo("e6", 473, 1169, 422, 247)],
    fields: { main_title: [57, 172, 304, 184, 70, "serif", "left"], subtitle: [58, 363, 293, 68, 27, "serif", "left"], lead_note: [58, 526, 284, 151, 19, "serif", "left"], "trip.start": [58, 470, 127, 37, 21], "trip.end": [193, 470, 134, 37, 21],
      "photo.e2.title": [62, 1059, 248, 46, 22, "serif", "left"], "photo.e2.note": [62, 1101, 246, 44, 17, "serif", "left"],
      "photo.e3.title": [356, 1059, 220, 46, 22, "serif", "left"], "photo.e3.note": [356, 1101, 220, 44, 17, "serif", "left"],
      "photo.e4.title": [626, 1059, 251, 46, 22, "serif", "left"], "photo.e4.note": [626, 1101, 251, 44, 17, "serif", "left"],
      "photo.e5.title": [63, 1430, 373, 39, 21, "serif", "left"], "photo.e5.note": [63, 1466, 370, 45, 17, "serif", "left"],
      "photo.e6.title": [489, 1430, 390, 39, 21, "serif", "left"], "photo.e6.note": [489, 1466, 389, 45, 17, "serif", "left"], closing_note: [171, 1548, 591, 68, 22, "serif"] },
    panels: [panel(8, 8, 925, 1656, "#fffcf6", 0, false, 30), panel(47, 819, 282, 335), panel(342, 819, 253, 335), panel(608, 819, 287, 335), panel(47, 1169, 411, 345), panel(473, 1169, 422, 345), panel(47, 1530, 848, 100, "#fff1e8", 0, true)],
    art: [art("editorial-sprig", 413, 78, 107, 56), art("editorial-flower", 37, 679, 232, 124), art("scrapbook-flower", 61, 1544, 94, 71), art("scrapbook-flower", 795, 1545, 85, 70, 80)]
  },
  postcard_duo: {
    label: box(343, 48, 254, 40),
    slots: [photo("pd1", 76, 326, 816, 597, -5, 20, 85), photo("pd2", 80, 955, 801, 503, 5, 20, 88)],
    fields: { main_title: [181, 108, 579, 106, 60], subtitle: [303, 232, 337, 65, 34], "photo.pd1.note": [65, 498, 692, 96, 36, "pen", "center", 0, "pd1"], "photo.pd2.note": [70, 402, 660, 96, 36, "pen", "center", 0, "pd2"], location: [202, 1560, 171, 42, 32], "trip.start": [529, 1567, 151, 39, 26], "trip.end": [698, 1567, 150, 39, 26] },
    panels: [panel(82, 1496, 780, 133)],
    art: [art("postcard-stamp", 752, 322, 139, 158), art("postcard-stamp", 74, 981, 131, 149, -12), art("fourcut-flower", 39, 644, 162, 300, -9), art("moment-sprig", 246, 225, 58, 52), art("moment-sprig", 650, 225, 49, 52)]
  },
  scrapbook_trio: {
    label: box(341, 64, 260, 42),
    slots: [photo("st1", 58, 345, 508, 367, -4, 15), photo("st2", 369, 725, 520, 362, 4, 15), photo("st3", 53, 1094, 514, 360, -3, 15)],
    fields: { main_title: [205, 141, 530, 94, 68], subtitle: [294, 258, 375, 53, 32],
      "photo.st1.title": [609, 430, 199, 59, 34, "pen", "left", 13], "photo.st1.note": [592, 492, 210, 132, 33, "pen", "left", 13],
      "photo.st2.title": [120, 849, 212, 63, 34, "pen", "left", -9], "photo.st2.note": [129, 916, 202, 135, 33, "pen", "left", -9],
      "photo.st3.title": [608, 1202, 197, 55, 34, "pen", "left", 6], "photo.st3.note": [597, 1258, 207, 128, 33, "pen", "left", 6],
      footer_note: [450, 1553, 288, 73, 27, "pen", "left"], "trip.start": [72, 1564, 155, 42, 27], "trip.end": [240, 1564, 152, 42, 27] },
    panels: [panel(2, 3, 937, 1665), panel(22, 23, 898, 1627), { ...panel(576, 370, 265, 300, "#fff0e6", 13), shape: "tag" }, { ...panel(77, 792, 269, 268, "#f0f2d8", -9), shape: "tag" }, panel(577, 1164, 270, 281, "#fff1dd", 6), panel(41, 1494, 860, 137)],
    art: [art("scrapbook-flower", 53, 144, 111, 130), art("scrapbook-flower", 779, 145, 109, 136, 80), art("tape-pink", 175, 324, 173, 43, -5), art("tape-pink", 580, 710, 166, 44, 12), art("tape-pink", 172, 1087, 146, 43, -6), art("editorial-flower", 754, 1531, 170, 121, -12)]
  },
  film_contact_sheet: {
    label: box(301, 49, 339, 42),
    slots: [0, 1, 2, 3, 4, 5].map(i => photo(`fc${i + 1}`, 53 + i % 2 * 444, 390 + Math.floor(i / 2) * 402, 393, i < 4 ? 304 : 215)),
    fields: { badge_title: [387, 121, 163, 51, 29], main_title: [226, 189, 491, 71, 53], "trip.start": [320, 282, 145, 38, 25], "trip.end": [477, 282, 153, 38, 25],
      ...Object.fromEntries([0, 1, 2, 3, 4, 5].flatMap(i => [[`photo.fc${i + 1}.caption`, [82 + i % 2 * 444, (i < 4 ? 710 : 1425) + Math.floor(i / 2) * (i < 4 ? 402 : 0), 230, 66, 26, "pen"]], [`photo.fc${i + 1}.date`, [322 + i % 2 * 444, (i < 4 ? 712 : 1427) + Math.floor(i / 2) * (i < 4 ? 402 : 0), 120, 32, 18]]])) as Record<string, FieldPosition>,
      footer_note: [303, 1512, 365, 55, 22, "serif"], signoff: [322, 1569, 339, 45, 26, "pen"] },
    panels: [panel(30, 343, 882, 1125), panel(381, 116, 170, 48, "#fff1e8")],
    art: [art("film-flower", 0, 81, 171, 245), art("film-flower", 793, 159, 127, 190, 80), art("postcard-stamp", 773, 1505, 129, 140, 11)]
  },
  one_moment: {
    label: box(337, 118, 268, 47), slots: [photo("om1", 0, 0, 941, 1672)],
    fields: { overlay_title: [192, 1297, 557, 76, 55], overlay_subtitle: [118, 1373, 705, 105, 51], "trip.start": [269, 1534, 191, 49, 36], "trip.end": [478, 1534, 199, 49, 36] }, panels: [],
    art: [art("moment-sprig", 276, 105, 48, 52), art("moment-sprig", 620, 105, 48, 52, 70), art("polaroid-sprig", 423, 1456, 96, 45)]
  },
  instant_memory: {
    label: box(325, 128, 291, 55), slots: [photo("im1", 133, 303, 697, 770, -4, 22, 97)],
    fields: { short_message: [314, 1193, 313, 69, 43, "pen"], main_title: [209, 1310, 526, 101, 56], "trip.start": [323, 1481, 144, 42, 27], "trip.end": [482, 1481, 153, 42, 27] },
    panels: [panel(71, 48, 812, 1587, "#fffaf0", 0, false, 44), panel(82, 60, 789, 1563, "#fffaf0", 0, false, 44)],
    art: [art("instant-sprig", 392, 180, 169, 69), art("fourcut-flower", 698, 906, 194, 269, 35), art("tape-pink", 64, 286, 204, 59, -24), art("instant-sprig", 389, 1414, 166, 49)]
  },
  double_memory: {
    label: box(270, 83, 401, 42),
    slots: [photo("dm1", 72, 401, 451, 790, -3, 16, 84), photo("dm2", 486, 664, 381, 639, 4, 16, 84)],
    fields: { main_title: [100, 176, 741, 104, 64], subtitle: [166, 294, 609, 80, 30],
      "photo.dm1.caption": [25, 694, 340, 80, 32, "pen", "center", 0, "dm1"],
      "photo.dm2.caption": [24, 543, 333, 80, 32, "pen", "center", 0, "dm2"],
      footer_note: [128, 1373, 685, 124, 32, "pen"], "trip.start": [280, 1552, 178, 42, 27], "trip.end": [484, 1552, 178, 42, 27] },
    panels: [],
    art: [art("editorial-sprig", 404, 127, 133, 57), art("tape-pink", 124, 375, 166, 43, -12), art("fourcut-flower", 717, 460, 93, 164, 15)]
  },
  triptych_story: {
    label: box(67, 62, 330, 42),
    slots: [photo("ts1", 65, 420, 811, 548, 0, 10), photo("ts2", 65, 1010, 388, 337, 0, 10, 70), photo("ts3", 488, 1010, 388, 337, 0, 10, 70)],
    fields: { main_title: [65, 158, 811, 100, 64, "serif", "left"], subtitle: [67, 278, 805, 76, 30, "serif", "left"], lead_note: [67, 356, 805, 60, 24, "serif", "left"],
      "photo.ts2.title": [18, 264, 352, 68, 26, "serif", "left", 0, "ts2"], "photo.ts3.title": [18, 264, 352, 68, 26, "serif", "left", 0, "ts3"],
      footer_note: [67, 1410, 658, 116, 30, "pen", "left"], "trip.start": [480, 1560, 178, 42, 27], "trip.end": [688, 1560, 178, 42, 27] },
    panels: [],
    art: [art("editorial-sprig", 754, 91, 114, 60), art("moment-sprig", 765, 1418, 81, 83, 12)]
  },
  gallery_four: {
    label: box(285, 89, 371, 42),
    slots: [0, 1, 2, 3].map(i => photo(`gf${i + 1}`, 70 + i % 2 * 417, 398 + Math.floor(i / 2) * 509, 384, 461, 0, 12, 82)),
    fields: { main_title: [90, 187, 761, 99, 62], subtitle: [120, 294, 701, 80, 30],
      ...Object.fromEntries([1, 2, 3, 4].map(i => [`photo.gf${i}.caption`, [20, 373, 344, 80, 28, "serif", "center", 0, `gf${i}`]])) as Record<string, FieldPosition>,
      "trip.start": [280, 1538, 178, 42, 27], "trip.end": [484, 1538, 178, 42, 27] },
    panels: [],
    art: [art("instant-sprig", 393, 1417, 155, 63)]
  },
  hero_mosaic: {
    label: box(61, 58, 324, 42),
    slots: [photo("hm1", 60, 395, 821, 575, 0, 10), photo("hm2", 60, 1010, 188, 332, 0, 8, 86), photo("hm3", 271, 1010, 188, 332, 0, 8, 86), photo("hm4", 482, 1010, 188, 332, 0, 8, 86), photo("hm5", 693, 1010, 188, 332, 0, 8, 86)],
    fields: { main_title: [60, 153, 821, 99, 64, "serif", "left"], subtitle: [62, 270, 815, 70, 28, "serif", "left"], lead_note: [62, 342, 815, 52, 21, "serif", "left"],
      ...Object.fromEntries([2, 3, 4, 5].map(i => [`photo.hm${i}.caption`, [12, 247, 164, 76, 27, "pen", "left", 0, `hm${i}`]])) as Record<string, FieldPosition>,
      closing_note: [62, 1408, 650, 124, 32, "pen", "left"], "trip.start": [488, 1570, 178, 42, 27], "trip.end": [696, 1570, 178, 42, 27] },
    panels: [],
    art: [art("editorial-sprig", 743, 70, 122, 60), art("scrapbook-flower", 770, 1416, 82, 108, 15)]
  },
};
export const WATERCOLOR_TEMPLATES: WatercolorTemplate[] = catalog.map(entry => {
  const key = entry.key as MemoryCardTemplateKey, g = geometry[key];
  return { key, displayName: entry.displayName, revision: WATERCOLOR_REVISION, primary: entry.primary, acceptedMin: entry.slotIds.length, acceptedMax: entry.slotIds.length,
    backgroundColor: key === "four_cut" ? "#ffffff" : "#fffaf0", exportBounds: { x: 0, y: 0, width: 1080, height: 1920, background: "template" }, textSlots: [], ...g,
    fields: entry.fields.map(f => {
      const [x, y, w, h, size, font = "serif", align = "center", r = 0, anchorSlotId] = g.fields[f.id];
      const color = key === "one_moment" ? "#fff4dc" : key === "polaroid_moodboard" && f.id === "subtitle" ? "#526638" : key === "four_cut" && f.id === "vertical_subtitle" ? "#403c32" : f.id.includes("subtitle") || f.id === "short_message" || f.id === "closing_note" ? "#c96860" : "#302d26";
      return { ...f, kind: f.kind as "plainText" | "isoDate", ...box(x, y, w, h, r), font, size: size * s, lineHeight: size * s * 1.24, color, align, anchorSlotId, z: 40, optional: true, overflow: "reject" };
    }) };
});
export function getWatercolorTemplate(key: string, revision: string = WATERCOLOR_REVISION) {
  return revision === WATERCOLOR_REVISION ? WATERCOLOR_TEMPLATES.find(t => t.key === key) ?? null : null;
}
export function getWatercolorFieldBox(template: WatercolorTemplate, field: WatercolorField): WatercolorBox {
  const slot = template.slots.find(s => s.id === field.anchorSlotId);
  if (!slot)
    return field;
  const a = slot.r * Math.PI / 180, dx = field.x + field.w / 2 - slot.w / 2, dy = field.y + field.h / 2 - slot.h / 2;
  return { ...field, x: slot.x + slot.w / 2 + dx * Math.cos(a) - dy * Math.sin(a) - field.w / 2, y: slot.y + slot.h / 2 + dx * Math.sin(a) + dy * Math.cos(a) - field.h / 2, r: slot.r };
}
