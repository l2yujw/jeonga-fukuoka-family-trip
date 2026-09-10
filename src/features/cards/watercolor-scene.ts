import type { AlbumPhoto } from "@/features/album/album-types";
import { getMemoryCardPhotoViewport, getPlacedImageRect } from "./memory-card-photo-placement";
import { getWatercolorFieldBox, getWatercolorTemplate, WATERCOLOR_ASSET_PREFIX, type WatercolorBox, type WatercolorField, type WatercolorTemplate } from "./watercolor-template-spec";
import { isWatercolorDate, normalizeWatercolorText, validateWatercolorValues, type MemoryCardLayoutV4 } from "./watercolor-layout";
import type { MemoryCardTemplateKey } from "./memory-card-template-spec";
import { DEFAULT_WATERCOLOR_APPEARANCE, WATERCOLOR_BACKGROUNDS, freezeWatercolorAppearance, watercolorContentInset, type WatercolorAppearance } from "./watercolor-appearance";
import coverage from "./watercolor-font-coverage.json" with { type: "json" };
export const WATERCOLOR_FONT_PROBE = "한글 가나다 0123456789 ♥♡–·";
const fontFiles = { serif: "NanumMyeongjo-Regular.ttf", pen: "NanumPenScript-Regular.ttf" } as const;
const fonts = { serif: '"CardsSerif"', pen: '"CardsPen", "CardsSerif"' };
let fontsReady: Promise<void> | undefined;
export function loadWatercolorFonts() {
  return fontsReady ??= (async () => {
    for (const [kind, file] of Object.entries(fontFiles)) {
      const family = kind === "serif" ? "CardsSerif" : "CardsPen";
      const face = new FontFace(family, `url("${WATERCOLOR_ASSET_PREFIX}${file}")`, { weight: "400", style: "normal" });
      await face.load();
      document.fonts.add(face);
      if (face.status !== "loaded" || !document.fonts.check(`400 32px "${family}"`, kind === "serif" ? WATERCOLOR_FONT_PROBE : "한글 0123"))
        throw new Error("글꼴을 준비하지 못했어요. 다시 시도해주세요.");
    }
  })().catch(error => { fontsReady = undefined; throw error; });
}
export function supportsWatercolorGlyphs(value: string, font: "serif" | "pen") {
  const ranges = font === "serif" ? coverage["NanumMyeongjo-Regular"] : [...coverage["NanumMyeongjo-Regular"], ...coverage["NanumPenScript-Regular"]];
  return Array.from(value).every(c => c === "\n" || c === "\t" || ranges.some(([a, b]) => c.codePointAt(0)! >= a && c.codePointAt(0)! <= b));
}
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadWatercolorImage(url: string) {
  let loaded = imageCache.get(url);
  if (!loaded) {
    loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => { if (image.naturalWidth && image.naturalHeight)
        resolve(image);
      else
        reject(new Error("이미지 크기를 확인할 수 없어요.")); };
      image.onerror = () => reject(new Error("사진 또는 필수 장식을 불러오지 못했어요. 연결을 확인해주세요."));
      image.src = url;
    }).catch(error => { imageCache.delete(url); throw error; });
    // ponytail: bounded session decode cache; use a byte budget if Album sizes grow.
    if (imageCache.size >= 32)
      imageCache.delete(imageCache.keys().next().value!);
    imageCache.set(url, loaded);
  }
  return loaded;
}
export type WatercolorTextRun = {
  text: string;
  x: number;
  y: number;
};
export type WatercolorTextPlan = {
  field: WatercolorField;
  box: WatercolorBox;
  runs: WatercolorTextRun[];
  error?: string;
};
const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
export function wrapWatercolorText(value: string, width: number, measure: (text: string) => number) {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    const chars = [...segmenter.segment(paragraph)].map(x => x.segment);
    let line = "";
    for (const ch of chars) {
      if (line && measure(line + ch) > width) {
        const breakAt = Math.max(line.lastIndexOf(" "), line.lastIndexOf("\t"));
        if (breakAt >= 0 && breakAt < line.length - 1) {
          lines.push(line.slice(0, breakAt + 1));
          line = line.slice(breakAt + 1);
        }
        else {
          lines.push(line);
          line = "";
        }
        if (line && measure(line + ch) > width) {
          lines.push(line);
          line = "";
        }
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}
export function layoutWatercolorText(template: WatercolorTemplate, layout: MemoryCardLayoutV4, context: CanvasRenderingContext2D) {
  context.fontKerning = "normal";
  context.textRendering = "geometricPrecision";
  context.letterSpacing = "0px";
  context.wordSpacing = "0px";
  context.direction = "ltr";
  const errors = validateWatercolorValues(template, layout);
  const plans = template.fields.map(field => {
    const raw = (field.kind === "isoDate" ? layout.dateValues : layout.textValues)[field.id];
    let value = "";
    try {
      value = field.kind === "isoDate" ? (isWatercolorDate(raw) ? raw.replaceAll("-", ".") : "") : normalizeWatercolorText(raw) ?? "";
    }
    catch { /* Input error is presented by its accessible field. */ }
    context.font = `400 ${field.size}px ${fonts[field.font]}`;
    const measure = (text: string) => context.measureText(text.replaceAll("\t", "    ")).width;
    const lines = field.vertical ? [...segmenter.segment(value)].map(x => x.segment) : value ? wrapWatercolorText(value, field.w, measure) : [];
    const lineHeight = field.vertical ? field.size * 1.05 : field.lineHeight;
    const runs = lines.map((text, i) => ({ text: text.replaceAll("\t", "    "), x: field.align === "center" ? field.w / 2 : 0, y: i * lineHeight + field.size * .88 }));
    let error = errors[field.id];
    if (value && !supportsWatercolorGlyphs(value, field.font))
      error = "이 글꼴에 없는 문자가 있어요. 다른 문자로 바꿔주세요.";
    if (lines.some(t => measure(t) > field.w + .01) || (!field.vertical && lines.length > field.maxLines) || lines.length * lineHeight > field.h + .01)
      error = "문구가 인쇄 영역을 넘어요. 글자나 줄 수를 줄여주세요.";
    return { field, box: getWatercolorFieldBox(template, field), runs, error };
  });
  return plans;
}
export type WatercolorScene = {
  appearance: WatercolorAppearance;
  template: WatercolorTemplate;
  layout: MemoryCardLayoutV4;
  images: Map<string, HTMLImageElement>;
  art: Map<string, HTMLImageElement>;
  text: WatercolorTextPlan[];
  errors: Record<string, string>;
};
export async function prepareWatercolorScene(templateKey: MemoryCardTemplateKey, layout: MemoryCardLayoutV4, photos: readonly AlbumPhoto[], allowIncomplete = false, appearance: WatercolorAppearance = DEFAULT_WATERCOLOR_APPEARANCE): Promise<WatercolorScene> {
  const frozenAppearance = freezeWatercolorAppearance(appearance);
  const template = getWatercolorTemplate(templateKey, layout.templateRevision);
  if (!template || layout.version !== 4)
    throw new Error("지원하지 않는 카드 버전이에요.");
  if (!allowIncomplete && layout.slots.length !== template.slots.length)
    throw new Error("사진을 모두 선택해주세요.");
  await loadWatercolorFonts();
  const images = new Map<string, HTMLImageElement>(), art = new Map<string, HTMLImageElement>();
  await Promise.all([
    ...[...new Set(["paper", ...template.art.map(a => a.asset)])].map(async (name) => { art.set(name, await loadWatercolorImage(`${WATERCOLOR_ASSET_PREFIX}${name}.png`)); }),
    ...layout.slots.map(async (slot) => {
      const photo = photos.find(p => p.id === slot.photoId);
      if (!photo?.signedUrl)
        throw new Error("사진을 불러오지 못했어요. 사진 선택에서 다시 확인해주세요.");
      images.set(slot.photoId, await loadWatercolorImage(photo.signedUrl));
    }),
  ]);
  const context = document.createElement("canvas").getContext("2d");
  if (!context)
    throw new Error("카드 미리보기를 준비하지 못했어요.");
  const text = layoutWatercolorText(template, layout, context);
  return { template, layout: structuredClone(layout), appearance: frozenAppearance, images, art, text, errors: Object.fromEntries(text.filter(t => t.error).map(t => [t.field.id, t.error!])) };
}
function withBox(c: CanvasRenderingContext2D, b: WatercolorBox, paint: () => void) { c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.rotate(b.r * Math.PI / 180); c.translate(-b.w / 2, -b.h / 2); paint(); c.restore(); }
function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function paperEdge(c: CanvasRenderingContext2D, w: number, h: number, postage = false) {
  c.beginPath();
  if (postage) {
    const points = [[0, 0], [w, 0], [w, h], [0, h], [0, 0]];
    points.slice(0, -1).forEach(([x, y], i) => { const [nx, ny] = points[i + 1], length = Math.hypot(nx - x, ny - y), steps = Math.ceil(length / 8); for (let j = 0; j <= steps; j++) {
      const d = j % 2 ? 2 : 0;
      c.lineTo(x + (nx - x) * j / steps + (ny - y) / length * d, y + (ny - y) * j / steps - (nx - x) / length * d);
    } });
  }
  else {
    c.moveTo(w * .18, 0);
    c.lineTo(w * .82, 0);
    c.lineTo(w, h * .17);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.lineTo(0, h * .17);
  }
  c.closePath();
}
function ticketEdge(c: CanvasRenderingContext2D, w: number, h: number) {
  c.beginPath();
  c.moveTo(0, 0);
  const corners = [[0, 0], [w, 0], [w, h], [0, h], [0, 0]];
  corners.slice(0, -1).forEach(([x, y], i) => {
    const [nx, ny] = corners[i + 1], length = Math.hypot(nx - x, ny - y), steps = Math.ceil(length / 16);
    for (let j = 0; j < steps; j++) {
      c.quadraticCurveTo(x + (nx - x) * (j + .5) / steps - (ny - y) / length * 5, y + (ny - y) * (j + .5) / steps + (nx - x) / length * 5, x + (nx - x) * (j + 1) / steps, y + (ny - y) * (j + 1) / steps);
    }
  });
  c.closePath();
}
function paintPolaroidAccents(c: CanvasRenderingContext2D, art: WatercolorScene["art"], texture: CanvasPattern) {
  for (const [x, y, w, h, r, color] of [[94, 353, 126, 52, -30, "#ead5ad"], [657, 854, 128, 48, 16, "#bcc7a5"], [51, 1360, 105, 43, -20, "#efb4a0"]] as const) {
    withBox(c, { x, y, w, h, r }, () => {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0);
      for (let i = 1; i <= 8; i++) c.lineTo(w - (i % 2) * 4, h * i / 8);
      c.lineTo(0, h);
      for (let i = 7; i >= 0; i--) c.lineTo((i % 2) * 4, h * i / 8);
      c.closePath(); c.fillStyle = color; c.fill();
      c.save(); c.clip(); c.globalAlpha = .35; c.fillStyle = texture; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#fffaf0"; c.lineWidth = color === "#bcc7a5" ? 8 : 1;
      for (let i = -h; i < w; i += 18) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); }
      c.restore();
    });
  }
  c.fillStyle = "#fff7ed"; c.strokeStyle = "#e2a58d"; c.lineWidth = 1;
  c.beginPath(); c.arc(831, 443, 42, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#f5c4b1";
  c.beginPath(); c.arc(831, 443, 34, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(831, 443, 30, 0, Math.PI * 2); c.stroke();
  // Reuse only the isolated flower within the private sprig, never reference photo pixels.
  c.drawImage(art.get("polaroid-sprig")!, 15, 0, 46, 43, 807, 420, 48, 45);
  c.strokeStyle = "#e8a28b"; c.lineWidth = 1.6;
  rounded(c, 713, 1384, 44, 42, 10); c.stroke();
  c.beginPath(); c.moveTo(713, 1397); c.lineTo(757, 1397);
  for (const x of [723, 747]) { c.moveTo(x, 1377); c.lineTo(x, 1390); }
  c.stroke();
  c.fillStyle = "#e8a28b";
  for (const x of [725, 736, 747]) for (const y of [1406, 1416]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
}
export function paintWatercolorScene(c: CanvasRenderingContext2D, scene: WatercolorScene, width: number, emptyPhotoHints = false) {
  const { template: t, layout, images, art, text } = scene;
  const background = WATERCOLOR_BACKGROUNDS.find(preset => preset.key === scene.appearance?.backgroundVariant) ?? WATERCOLOR_BACKGROUNDS[0];
  const tinted = background.key !== "ivory";
  const paperPanelCount = ["scrapbook_trio", "instant_memory"].includes(t.key) ? 2 : ["polaroid_moodboard", "four_cut", "editorial_collage", "film_contact_sheet"].includes(t.key) ? 1 : 0;
  c.save();
  c.fontKerning = "normal";
  c.textRendering = "geometricPrecision";
  c.letterSpacing = "0px";
  c.wordSpacing = "0px";
  c.direction = "ltr";
  c.scale(width / 1080, width / 1080);
  c.clearRect(0, 0, 1080, 1920);
  c.fillStyle = tinted ? background.paper : t.backgroundColor;
  c.fillRect(0, 0, 1080, 1920);
  const texture = c.createPattern(art.get("paper")!, "repeat")!;
  const corrected = ["polaroid_moodboard", "four_cut", "editorial_collage"].includes(t.key);
  if (t.key !== "four_cut") {
    c.save();
    if (tinted) c.globalCompositeOperation = "multiply";
    c.fillStyle = texture;
    c.fillRect(0, 0, 1080, 1920);
    c.restore();
  }
  const inset = watercolorContentInset(t.key, scene.appearance);
  c.translate(1080 * inset, 1920 * inset);
  c.scale(1 - inset * 2, 1 - inset * 2);
  for (const p of t.panels)
    withBox(c, p, () => {
      c.shadowColor = t.key === "editorial_collage" && p !== t.panels[0] ? "transparent" : "rgba(109,71,39,.15)";
      c.shadowBlur = 9 * width / 1080;
      c.shadowOffsetY = 4 * width / 1080;
      const tintedPanel = tinted && t.panels.indexOf(p) < paperPanelCount;
      c.fillStyle = tintedPanel ? background.paper : p.fill;
      if (p.shape === "tag")
        paperEdge(c, p.w, p.h);
      else if (p.shape === "ticket")
        ticketEdge(c, p.w, p.h);
      else
        rounded(c, 0, 0, p.w, p.h, p.radius ?? 16);
      c.fill();
      c.shadowColor = "transparent";
      c.save();
      c.clip();
      c.globalAlpha = corrected ? .7 : .38;
      if (tintedPanel) c.globalCompositeOperation = "multiply";
      c.fillStyle = texture;
      c.fillRect(0, 0, p.w, p.h);
      c.restore();
      c.strokeStyle = p.dashed ? "#f1b6a3" : "#e6caaa";
      c.lineWidth = 1.4;
      c.setLineDash(p.dashed ? [9, 7] : []);
      c.stroke();
      c.setLineDash([]);
      if (p.shape === "tag") {
        c.beginPath();
        c.arc(p.w * .82, p.h * .12, 11, 0, Math.PI * 2);
        c.strokeStyle = "#ae895c";
        c.lineWidth = 3;
        c.stroke();
        c.beginPath();
        c.moveTo(p.w * .82, p.h * .12);
        c.bezierCurveTo(p.w, p.h * -.1, p.w * 1.07, p.h * -.17, p.w * 1.2, p.h * -.2);
        c.stroke();
      }
    });
  for (const slot of t.slots)
    withBox(c, slot, () => {
      const vp = getMemoryCardPhotoViewport(slot);
      const radius = t.key === "editorial_collage" && slot.id !== "e1" ? [21, 21, 0, 0] : slot.frame === "polaroid" ? 7 : 21;
      c.shadowColor = slot.frame === "polaroid" ? "rgba(105,70,36,.26)" : "transparent";
      c.shadowBlur = 13 * width / 1080;
      c.shadowOffsetY = 5 * width / 1080;
      c.fillStyle = "#fffdf7";
      if (t.key === "postcard_duo")
        paperEdge(c, slot.w, slot.h, true);
      else
        rounded(c, 0, 0, slot.w, slot.h, radius);
      c.fill();
      c.shadowColor = "transparent";
      c.save();
      rounded(c, vp.x, vp.y, vp.width, vp.height, Array.isArray(radius) ? radius : slot.frame === "polaroid" ? 2 : 20);
      c.clip();
      c.fillStyle = "#f2ece0";
      c.fillRect(vp.x, vp.y, vp.width, vp.height);
      const mapping = layout.slots.find(s => s.slotId === slot.id), img = mapping ? images.get(mapping.photoId) : null;
      if (img && mapping) {
        const placed = getPlacedImageRect(img.naturalWidth, img.naturalHeight, vp.width, vp.height, mapping.placement)!;
        c.translate(vp.x + placed.x + placed.width / 2, vp.y + placed.y + placed.height / 2);
        c.rotate(placed.rotation * Math.PI / 180);
        c.drawImage(img, -placed.width / 2, -placed.height / 2, placed.width, placed.height);
      }
      else if (emptyPhotoHints) {
        c.fillStyle = "#e5e5da";
        c.fillRect(vp.x, vp.y, vp.width, vp.height);
        c.globalAlpha = .22; c.fillStyle = texture; c.fillRect(vp.x, vp.y, vp.width, vp.height); c.globalAlpha = 1;
        const inset = Math.min(vp.width, vp.height) * .06;
        c.strokeStyle = "#a8afa0"; c.lineWidth = 2; c.setLineDash([9, 8]);
        rounded(c, vp.x + inset, vp.y + inset, vp.width - inset * 2, vp.height - inset * 2, 8); c.stroke(); c.setLineDash([]);
        c.fillStyle = "#596452"; c.font = `400 ${Math.max(36, Math.min(70, vp.width * .08))}px "CardsSerif"`; c.textAlign = "center";
        c.fillText("사진 선택", vp.x + vp.width / 2, vp.y + vp.height / 2);
      }
      c.restore();
      if (corrected) {
        c.strokeStyle = "#dec3a3"; c.lineWidth = 1.2;
        rounded(c, 0, 0, slot.w, slot.h, radius); c.stroke();
        if (slot.frame === "polaroid") { rounded(c, vp.x, vp.y, vp.width, vp.height, 2); c.stroke(); }
      }
    });
  if (t.key === "one_moment" && images.size) {
    const gradient = c.createLinearGradient(0, 1080, 0, 1920);
    gradient.addColorStop(0, "rgba(48,32,16,0)");
    gradient.addColorStop(.5, "rgba(48,32,16,.72)");
    gradient.addColorStop(1, "rgba(48,32,16,.93)");
    c.fillStyle = gradient;
    c.fillRect(0, 1080, 1080, 840);
  }
  if (corrected) {
    c.save(); c.scale(1080 / 941, 1080 / 941);
    if (t.key === "polaroid_moodboard") paintPolaroidAccents(c, art, texture);
    if (t.key === "four_cut") {
      c.strokeStyle = "#df9686"; c.lineWidth = 3.5; c.lineCap = "round"; c.setLineDash([.1, 10.5]);
      c.beginPath(); c.moveTo(190, 1321); c.lineTo(438, 1321); c.moveTo(500, 1321); c.lineTo(758, 1321); c.moveTo(530, 1365); c.lineTo(530, 1534); c.stroke();
    }
    if (t.key === "editorial_collage") {
      c.strokeStyle = "#d9b68d"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(58, 434); c.lineTo(147, 434); c.moveTo(208, 434); c.lineTo(314, 434); c.stroke();
      c.beginPath(); c.moveTo(177, 430); c.lineTo(182, 434); c.lineTo(177, 438); c.lineTo(172, 434); c.closePath(); c.stroke();
    }
    c.restore();
  }
  if (t.key === "film_contact_sheet") {
    c.strokeStyle = "#e7cfb5";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(540, 394);
    c.lineTo(540, 1685);
    [862, 1312].forEach(y => { c.moveTo(35, y); c.lineTo(1046, y); });
    c.stroke();
    t.slots.forEach((slot, i) => {
      c.font = '400 18px "CardsSerif"';
      c.fillStyle = "#564331";
      c.textAlign = "left";
      c.fillText(String(i + 1).padStart(2, "0"), slot.x + 3, slot.y - 19);
      c.font = '400 10px "CardsSerif"';
      c.textAlign = "center";
      c.fillText("FAMILY MEMORIES", slot.x + slot.w / 2, slot.y - 22);
      const date = layout.dateValues[`photo.${slot.id}.date`];
      if (isWatercolorDate(date)) {
        c.textAlign = "right";
        c.fillText(`${date.slice(8)} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(date.slice(5, 7)) - 1]}`, slot.x + slot.w - 2, slot.y - 22);
      }
    });
  }
  const fixedLabels: Partial<Record<MemoryCardTemplateKey, [
    string,
    number,
    number,
    number
  ][]>> = {
    four_cut: [["여행 기간", 759, 1600, 25]],
    postcard_duo: [["장소", 268, 1775, 24], ["날짜", 629, 1775, 24]],
    scrapbook_trio: [["여행 날짜", 173, 1764, 25], ["짧은 한 줄 기록", 621, 1764, 25]],
  };
  c.font = '400 24px "CardsSerif"';
  c.fillStyle = "#bd8270";
  c.textAlign = "center";
  for (const [label, x, y, size] of fixedLabels[t.key] ?? []) {
    c.font = `400 ${size}px "CardsSerif"`;
    c.fillText(label, x, y);
  }
  const start = text.find(p => p.field.id === "trip.start"), end = text.find(p => p.field.id === "trip.end");
  if (start?.runs.length && end?.runs.length) {
    c.font = `400 ${start.field.size}px "CardsSerif"`;
    c.fillStyle = start.field.color;
    const sameRow = Math.abs(start.box.y - end.box.y) < 20;
    c.fillText("–", sameRow ? (start.box.x + start.box.w + end.box.x) / 2 : start.box.x + start.box.w / 2, sameRow ? start.box.y + start.field.size * .88 : (start.box.y + start.box.h + end.box.y) / 2);
  }
  for (const a of t.art)
    withBox(c, a, () => c.drawImage(art.get(a.asset)!, 0, 0, a.w, a.h));
  withBox(c, t.label, () => { c.font = '400 30px "CardsSerif"'; c.textAlign = "center"; c.letterSpacing = t.key === "polaroid_moodboard" || t.key === "editorial_collage" ? "3px" : "0px"; c.fillStyle = t.key === "one_moment" ? (images.size ? "#ead5b8" : "#66725a") : t.key === "four_cut" ? "#cf8070" : "#be8f6c"; c.fillText(t.displayName, t.label.w / 2, 32); });
  for (const plan of text)
    withBox(c, plan.box, () => {
      if (t.key === "scrapbook_trio" && plan.field.role === "title" && plan.runs.length) {
        c.fillStyle = plan.field.photoSlotId === "st2" ? "#d8dfb8" : "#f5cabc";
        rounded(c, -8, -5, plan.box.w + 16, plan.field.size * 1.15, 10);
        c.fill();
      }
      c.save();
      c.beginPath();
      c.rect(0, 0, plan.box.w, plan.box.h);
      c.clip();
      c.fillStyle = t.key === "one_moment" && emptyPhotoHints && !images.size ? "#596452" : plan.field.color;
      c.font = `400 ${plan.field.size}px ${fonts[plan.field.font]}`;
      c.textAlign = plan.field.align;
      c.textBaseline = "alphabetic";
      for (const run of plan.runs)
        c.fillText(run.text, run.x, run.y);
      c.restore();
    });
  c.restore();
}
// Probe only after a Canvas failure. A generic encode/context error is not a size limit.
export function watercolorCanvasFailure(canvas: HTMLCanvasElement, code: string): Error {
  try {
    if (canvas.width > 0 && canvas.height > 0 && canvas.toDataURL("image/png") === "data:,") {
      return new Error("memory-card-canvas-size-exceeded");
    }
  } catch (error) {
    if (error instanceof Error) return error;
  }
  return new Error(code);
}
export async function renderWatercolorPng(scene: WatercolorScene, width: 1080 | 720 = 1080) {
  if (Object.keys(scene.errors).length)
    throw new Error(Object.values(scene.errors)[0]);
  if (scene.layout.slots.length !== scene.template.slots.length)
    throw new Error("사진을 모두 선택해주세요.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width * 16 / 9;
  const c = canvas.getContext("2d");
  if (!c)
    throw watercolorCanvasFailure(canvas, "memory-card-canvas-unavailable");
  paintWatercolorScene(c, scene, width);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(watercolorCanvasFailure(canvas, "memory-card-canvas-encode-failed")), "image/png"));
}
