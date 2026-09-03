import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  createScheduleGeneratorRows,
  loadCanonicalScheduleRows,
} from "./schedule-itinerary.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const detailDirectory = path.join(root, "private-assets/schedule/detail");
await mkdir(detailDirectory, { recursive: true });
const layout = JSON.parse(
  await readFile(path.join(root, "src/features/schedule/schedule-layout.json"), "utf8"),
);
const { logicalWidth, pixelRatio, route, row: rowLayout, memo } = layout;
const physicalWidth = logicalWidth * pixelRatio;
const px = (value) => Math.round(value * pixelRatio);
const bodyHeight = (rowCount) =>
  rowLayout.firstY +
  rowCount * rowLayout.height +
  (rowCount - 1) * rowLayout.gap +
  memo.gap +
  memo.height +
  memo.bottomMargin;
const generatorRows = createScheduleGeneratorRows(
  await loadCanonicalScheduleRows(root),
);

const day3ScenesPath = "private-assets/schedule/plates/source/day-3-scenes-v25.png";
const days = [
  {
    day: 1,
    scenes: "private-assets/schedule/plates/source/day-1-scenes-v2.png",
    sceneGrid: { x: [0, 362, 724, 1086, 1448], y: [0, 350, 680, 1086], inset: 8 },
    routeArtIndex: 8,
    target: "private-assets/schedule/plates/body/day-1.png",
    routeTitle: "첫째 날, 설레는 출발",
    routePath: "인천 → 후쿠오카 → 야나가와 → 다케오 → 우레시노",
    memoColor: "#db3e60",
    memoLines: ["설레는 시작,", "함께하는 여정의 첫걸음."],
    rows: generatorRows[1],
  },
  {
    day: 2,
    scenes: "private-assets/schedule/plates/source/day-2-scenes-v2.png",
    sceneGrid: { x: [0, 425, 800, 1200, 1570, 1983], y: [0, 385, 793], inset: 8 },
    target: "private-assets/schedule/plates/body/day-2.png",
    routeTitle: "둘째 날, 나가사키의 여름 산책",
    routePath: "우레시노 → 나가사키 → 후쿠오카",
    memoColor: "#3f9548",
    memoLines: ["푸른 하늘 아래,", "나가사키에서의 추억을 마음에 담아요."],
    rows: generatorRows[2],
  },
  {
    day: 3,
    scenes: day3ScenesPath,
    sceneCrops: [
      { left: 515, top: 12, width: 355, height: 275 },
      { left: 520, top: 312, width: 345, height: 165 },
      { left: 520, top: 498, width: 350, height: 180 },
      { left: 515, top: 691, width: 355, height: 178 },
      { left: 515, top: 885, width: 350, height: 168 },
      { left: 500, top: 1067, width: 365, height: 164 },
      { left: 500, top: 1248, width: 370, height: 164 },
      { left: 495, top: 1418, width: 375, height: 170 },
    ],
    target: "private-assets/schedule/plates/body/day-3.png",
    routeTitle: "셋째 날, 아쉬운 귀국의 날",
    routeTitleSize: 25,
    routePath: "후쿠오카 → 다자이후 → 라라포트 → 공항 → 인천",
    routePathSize: 14,
    memoColor: "#1d73a2",
    memoLines: [
      "17:45 후쿠오카 출발 · 19:15 인천 도착",
      "가족들과 함께한 여름의 기억을 오래 간직해요.",
    ],
    rows: generatorRows[3],
  },
];

const chipColors = {
  항공: ["#f9ccc9", "#c83b3f"],
  이동: ["#e8ecd0", "#47743e"],
  식사: ["#f9e4c4", "#a85d19"],
  관광: ["#e8ecd0", "#47743e"],
  숙소: ["#eadde8", "#714866"],
};
const TIMED_ROW_TIME_FONT_SIZE = 21;
const day3IconCrops = {
  식사: { left: 20, top: 321, width: 95, height: 100 },
  관광: { left: 20, top: 502, width: 95, height: 105 },
  이동: { left: 20, top: 1068, width: 95, height: 105 },
  항공: { left: 20, top: 1255, width: 95, height: 105 },
};
const lodgingIconCrop = { left: 24, top: 1844, width: 72, height: 84 };
const day3LeafCrop = { left: 35, top: 35, width: 85, height: 130 };
const day3FlowerCrop = { left: 520, top: 1605, width: 330, height: 150 };
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const chipWidth = (value) => 20 + [...value].length * 16;
const svg = (height, content) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${physicalWidth}" height="${height * pixelRatio}" viewBox="0 0 ${logicalWidth} ${height}">${content}</svg>`,
);

function rowsWithGeometry(day) {
  return day.rows.map((item, index) => ({
    ...item,
    y: rowLayout.firstY + index * (rowLayout.height + rowLayout.gap),
  }));
}

function baseSvg(day, rows, height, memoY) {
  const cards = rows.map((item) => `
    <rect x="${rowLayout.cardX}" y="${item.y}" width="${rowLayout.cardWidth}" height="${rowLayout.height}" rx="${rowLayout.cardRadius}" fill="#fdfaf5" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    ${item.time ? `<line x1="${rowLayout.timedDividerX}" y1="${item.y + 14}" x2="${rowLayout.timedDividerX}" y2="${item.y + rowLayout.height - 14}" stroke="#e6b89d" stroke-width="1.4"/>` : ""}
  `).join("");
  const timelineEnd = rows.at(-1).y + rowLayout.height / 2;

  return svg(height, `
    <defs>
      <filter id="shadow" x="-10%" y="-15%" width="120%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#765747" flood-opacity=".11"/></filter>
      <filter id="grain"><feTurbulence baseFrequency=".72" numOctaves="2" seed="7"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .018 0"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="#faf4ec"/>
    <rect x="${route.x}" y="${route.y}" width="${route.width}" height="${route.height}" rx="20" fill="#fcf8f3" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    <line x1="${rowLayout.timelineX}" y1="${rowLayout.firstY + rowLayout.height / 2}" x2="${rowLayout.timelineX}" y2="${timelineEnd}" stroke="#dc535f" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 11"/>
    ${cards}
    <rect x="${rowLayout.cardX}" y="${memoY}" width="${rowLayout.cardWidth}" height="${rowLayout.height}" rx="${rowLayout.cardRadius}" fill="#fefaf4" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    <rect width="100%" height="100%" filter="url(#grain)" opacity=".38"/>
  `);
}

function textSvg(day, rows, height, memoY) {
  const renderedRows = rows.map((item) => {
    const contentX = item.time ? rowLayout.timedTextX : rowLayout.untimedTextX;
    const typeWidth = chipWidth(item.type);
    const locationWidth = chipWidth(item.location);
    const [typeFill, typeColor] = chipColors[item.type];
    const titleLines = item.titleLines ?? [item.title];
    const longestTitle = Math.max(...titleLines.map((line) => [...line].length));
    const titleSize = item.titleSize ?? (longestTitle > 16 ? 19 : longestTitle > 12 ? 21 : 25);
    const longestDescription = Math.max(...item.description.map((line) => [...line].length));
    const descSize = longestDescription > 28 ? 14 : longestDescription > 22 ? 15 : 17;
    const titleStartY = item.y + (titleLines.length > 1 ? 77 : 87);
    const titleLineHeight = titleLines.length > 1 ? 22 : 25;
    const descriptionStartY = item.y + (titleLines.length > 1 ? 121 : item.description.length > 1 ? 119 : 121);
    const descriptionLineHeight = item.description.length > 1 ? 19 : 22;
    const titles = titleLines.map((line, index) => `<text x="${contentX}" y="${titleStartY + index * titleLineHeight}" class="title" font-size="${titleSize}">${escapeXml(line)}</text>`).join("");
    const descriptions = item.description.map((line, index) => `<text x="${contentX}" y="${descriptionStartY + index * descriptionLineHeight}" class="desc" font-size="${descSize}">${escapeXml(line)}</text>`).join("");
    const locationChip = item.location
      ? `<rect x="${contentX + typeWidth + 8}" y="${item.y + rowLayout.chipYOffset}" width="${locationWidth}" height="${rowLayout.chipHeight}" rx="10" fill="#e8ecd0"/>
      <text x="${contentX + typeWidth + 19}" y="${item.y + 41}" class="chip" fill="#47743e">${escapeXml(item.location)}</text>`
      : "";

    return `
      ${item.time ? `<text x="${rowLayout.timeX}" y="${item.y + 48}" class="time">${item.time}</text>` : ""}
      <rect x="${contentX}" y="${item.y + rowLayout.chipYOffset}" width="${typeWidth}" height="${rowLayout.chipHeight}" rx="10" fill="${typeFill}"/>
      <text x="${contentX + 11}" y="${item.y + 41}" class="chip" fill="${typeColor}">${item.type}</text>
      ${locationChip}
      ${titles}
      ${descriptions}
    `;
  }).join("");
  const memoSize = day.day === 1 ? 18 : 15;
  const memoTextStartY = memoY + 87;
  const memoLines = day.memoLines.map((line, index) =>
    `<text x="${rowLayout.cardX + 22}" y="${memoTextStartY + index * 27}" class="memo" font-size="${memoSize}">${escapeXml(line)}</text>`,
  ).join("");

  return svg(height, `
    <style>
      .route-title,.title{font-family:AppleMyungjo,serif;font-weight:700;fill:#17130f;stroke:#17130f;stroke-width:.55px;paint-order:stroke fill}.route-path{font-family:Pretendard,sans-serif;font-weight:600;fill:#2c2520}.chip{font-family:Pretendard,sans-serif;font-size:17px;font-weight:700}.time{font-family:AppleMyungjo,serif;font-size:${TIMED_ROW_TIME_FONT_SIZE}px;font-weight:600;fill:#17130f;stroke:#17130f;stroke-width:.55px;paint-order:stroke fill}.desc{font-family:Pretendard,sans-serif;font-weight:500;fill:#2c2520}.memo{font-family:AppleMyungjo,serif;font-weight:700;fill:#2c2520;stroke:#2c2520;stroke-width:.2px;paint-order:stroke fill}.memo-label{font-family:Pretendard,sans-serif;font-size:17px;font-weight:800;fill:white}</style>
    <text x="113" y="63" class="route-title" font-size="${day.routeTitleSize ?? 28}">${escapeXml(day.routeTitle)}</text>
    <text x="115" y="100" class="route-path" font-size="${day.routePathSize ?? 16}">${escapeXml(day.routePath)}</text>
    ${renderedRows}
    <rect x="${rowLayout.cardX + 22}" y="${memoY + 13}" width="112" height="34" rx="11" fill="${day.memoColor}"/>
    <text x="${rowLayout.cardX + 36}" y="${memoY + 37}" class="memo-label">DAY ${day.day} 메모</text>
    ${memoLines}
  `);
}

function gridCrop(grid, index) {
  const columns = grid.x.length - 1;
  const column = index % columns;
  const gridRow = Math.floor(index / columns);
  return {
    left: grid.x[column] + grid.inset,
    top: grid.y[gridRow] + grid.inset,
    width: grid.x[column + 1] - grid.x[column] - grid.inset * 2,
    height: grid.y[gridRow + 1] - grid.y[gridRow] - grid.inset * 2,
  };
}

const insetCrop = (crop, inset) => ({
  left: crop.left + inset,
  top: crop.top + inset,
  width: crop.width - inset * 2,
  height: crop.height - inset * 2,
});

async function artworkCrop(source, crop, targetWidth, targetHeight, background = "#ffffff") {
  const extracted = await source.clone().extract(crop).png().toBuffer();
  return sharp(extracted)
    .trim({ background, threshold: 14 })
    .resize({ width: px(targetWidth), height: px(targetHeight), fit: "contain", background })
    .sharpen(0.6)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

async function artworkSource(sourcePath, targetWidth, targetHeight) {
  return sharp(path.join(root, sourcePath))
    .trim({ background: "#ffffff", threshold: 14 })
    .resize({ width: px(targetWidth), height: px(targetHeight), fit: "contain", background: "#ffffff" })
    .sharpen(0.6)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

async function detailArtwork(
  source,
  crop,
  background = "#fffdf8",
  width = 720,
  height = 400,
) {
  const extracted = await source.clone().extract(crop).png().toBuffer();
  return sharp(extracted)
    .trim({ background: "#ffffff", threshold: 14 })
    .resize({ width, height, fit: "contain", background })
    .sharpen(0.5)
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toBuffer();
}

async function detailArtworkSource(sourcePath) {
  return sharp(path.join(root, sourcePath))
    .trim({ background: "#ffffff", threshold: 14 })
    .resize({ width: 720, height: 400, fit: "contain", background: "#fffdf8" })
    .sharpen(0.5)
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toBuffer();
}

async function circleIcon(image) {
  const width = px(rowLayout.iconWidth);
  const height = px(rowLayout.iconHeight);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="white"/></svg>`);
  return sharp(image).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

const day3Scenes = sharp(path.join(root, day3ScenesPath));
const day1Approved = sharp(path.join(root, "private-assets/schedule/approved/day-1.png"));
for (const day of days) {
  const expectedRows = layout.dayRowCounts[String(day.day)];
  if (day.rows.length !== expectedRows) {
    throw new Error(`DAY ${day.day} must contain ${expectedRows} rows, received ${day.rows.length}`);
  }

  const rows = rowsWithGeometry(day);
  const logicalHeight = bodyHeight(rows.length);
  const memoY = logicalHeight - memo.height - memo.bottomMargin;
  const scenes = sharp(path.join(root, day.scenes));
  const layers = [{ input: baseSvg(day, rows, logicalHeight, memoY), top: 0, left: 0 }];
  const sourceCrop = (index) => day.sceneGrid ? gridCrop(day.sceneGrid, index) : day.sceneCrops[index];

  const routeArt = await artworkCrop(scenes, sourceCrop(day.routeArtIndex ?? 0), route.artWidth, route.artHeight);
  layers.push({ input: routeArt, top: px(route.artY), left: px(route.artX), blend: "multiply" });
  const routeLeaf = await artworkCrop(day3Scenes, day3LeafCrop, 70, 90);
  layers.push({ input: routeLeaf, top: px(18), left: px(38), blend: "multiply" });

  for (const [index, item] of rows.entries()) {
    const narrowArt = item.narrowArt || item.titleLines;
    const artWidth = narrowArt ? 150 : rowLayout.artWidth;
    const artX = narrowArt ? 515 : rowLayout.artX;
    const art = item.artSource
      ? await artworkSource(item.artSource, artWidth, rowLayout.height - rowLayout.artInsetY * 2)
      : await artworkCrop(
        scenes,
        sourceCrop(index + 1),
        artWidth,
        rowLayout.height - rowLayout.artInsetY * 2,
      );
    layers.push({ input: art, top: px(item.y + rowLayout.artInsetY), left: px(artX), blend: "multiply" });

    const detail = item.artSource
      ? await detailArtworkSource(item.artSource)
      : await detailArtwork(
        scenes,
        day.sceneGrid
          ? sourceCrop(index + 1)
          : insetCrop(sourceCrop(index + 1), 8),
      );
    await writeFile(path.join(detailDirectory, `${item.id}.webp`), detail);

    const iconSource = item.type === "숙소" ? day1Approved : day3Scenes;
    const iconCrop = item.type === "숙소" ? lodgingIconCrop : day3IconCrops[item.type];
    const iconBase = await iconSource.clone()
      .extract(iconCrop)
      .resize({ width: px(rowLayout.iconWidth), height: px(rowLayout.iconHeight), fit: "contain", background: "#ffffff" })
      .sharpen(0.6)
      .png()
      .toBuffer();
    const icon = await circleIcon(iconBase);
    layers.push({
      input: icon,
      top: px(item.y + (rowLayout.height - rowLayout.iconHeight) / 2),
      left: px(rowLayout.iconX),
    });
  }

  const flowers = await artworkCrop(day3Scenes, day3FlowerCrop, 140, 105, "#fefaf4");
  layers.push({
    input: flowers,
    top: px(memoY + (rowLayout.height - 105) / 2),
    left: px(rowLayout.cardX + rowLayout.cardWidth - 156),
    blend: "multiply",
  });
  layers.push({ input: textSvg(day, rows, logicalHeight, memoY), top: 0, left: 0 });

  const targetPath = path.join(root, day.target);
  const info = await sharp({
    create: {
      width: physicalWidth,
      height: logicalHeight * pixelRatio,
      channels: 4,
      background: "#faf4ec",
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(targetPath);
  console.log(`DAY ${day.day}: ${info.width}x${info.height}, ${info.size} bytes`);
}

await writeFile(
  path.join(detailDirectory, "botanical-branch.webp"),
  await detailArtwork(day3Scenes, day3LeafCrop, "#fff7ee", 180, 240),
);
await writeFile(
  path.join(detailDirectory, "botanical-flowers.webp"),
  await detailArtwork(day3Scenes, day3FlowerCrop, "#fff7ee", 420, 190),
);
