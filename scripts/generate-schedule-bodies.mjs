import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const width = 695;
const day3BodyPath = path.join(root, "public/assets/schedule/plates/body/day-3.png");

const days = [
  {
    day: 1,
    source: "public/assets/schedule/approved/day-1.png",
    scenes: "public/assets/schedule/plates/source/day-1-scenes-v2.png",
    sceneGrid: { x: [0, 362, 724, 1086, 1448], y: [0, 350, 680, 1086], inset: 8 },
    target: "public/assets/schedule/plates/body/day-1.png",
    routeTitle: "첫째 날, 설레는 출발",
    routePath: "인천 → 후쿠오카 → 야나가와 → 다케오 → 우레시노",
    memo: [
      "07:00 인천공항 T1 3층 12번 게이트 L 기둥 앞 집결",
      "내일은 나가사키를 둘러본 뒤 후쿠오카로 이동해요.",
    ],
    rows: [
      { sourceY: 597, sourceH: 134, height: 142, time: "07:00", type: "항공", location: "인천", title: "인천국제공항 1터미널 집결", description: ["탑승수속 및 출발 준비"], artNarrow: true },
      { sourceY: 745, sourceH: 130, height: 142, time: "09:30", type: "항공", location: "인천", title: "인천국제공항 출발", description: ["제주항공 7C1403"] },
      { sourceY: 889, sourceH: 123, height: 142, time: "11:00", type: "항공", location: "후쿠오카", title: "후쿠오카공항 도착", description: ["1명 합류 후 일정 시작"] },
      { sourceY: 1027, sourceH: 111, height: 145, type: "이동", location: "야나가와", title: "야나가와 이동", description: ["약 1시간 20분 · 이동 중 간식 제공"] },
      { sourceY: 1153, sourceH: 111, height: 149, type: "식사", location: "야나가와", title: "중식 · 현지식", description: ["야나가와 도착 후 점심 식사"] },
      { sourceY: 1279, sourceH: 109, height: 169, type: "관광", location: "야나가와", title: "야나가와 뱃놀이", description: ["운하를 따라 즐기는 여름 뱃놀이"] },
      { sourceY: 1402, sourceH: 101, height: 145, type: "이동", location: "다케오", title: "다케오 이동", description: ["약 1시간 10분 소요"] },
      { sourceY: 1516, sourceH: 105, height: 169, type: "관광", location: "다케오", title: "다케오 신사", description: ["3,000여 년의 역사가 있는 신사"] },
      { sourceY: 1634, sourceH: 97, height: 169, type: "관광", location: "다케오", title: "다케오 도서관", description: ["감각적인 공간의 복합문화 요소"] },
      { sourceY: 1744, sourceH: 92, height: 145, type: "이동", location: "우레시노", title: "우레시노 이동", description: ["약 30분 소요"] },
      { sourceY: 1847, sourceH: 108, height: 190, type: "숙소", location: "우레시노", title: "오에도 온센 모노가타리 우레시노칸", titleLines: ["오에도 온센 모노가타리", "우레시노칸"], description: ["체크인 · 석식(호텔식 뷔페) ·", "온천욕으로 하루 마무리"] },
    ],
  },
  {
    day: 2,
    source: "public/assets/schedule/approved/day-2.png",
    scenes: "public/assets/schedule/plates/source/day-2-scenes-v2.png",
    sceneGrid: { x: [0, 425, 800, 1200, 1570, 1983], y: [0, 385, 793], inset: 8 },
    target: "public/assets/schedule/plates/body/day-2.png",
    routeTitle: "둘째 날, 나가사키의 여름 산책",
    routePath: "우레시노 → 나가사키 → 후쿠오카",
    memo: [
      "DAY 2는 원본 일정에 구체 시간이 없어 시간을 표시하지 않아요.",
      "내일은 다자이후와 라라포트를 둘러본 뒤 귀국해요.",
    ],
    rows: [
      { sourceY: 649, sourceH: 139, height: 169, type: "식사", location: "우레시노", title: "호텔 조식", description: ["호텔식으로 여유로운 아침"] },
      { sourceY: 799, sourceH: 137, height: 145, type: "이동", location: "나가사키", title: "나가사키 이동", description: ["약 50분 소요"] },
      { sourceY: 948, sourceH: 136, height: 169, type: "관광", location: "나가사키", title: "나가사키 차이나타운", description: ["일본의 오래된 차이나타운 산책"] },
      { sourceY: 1095, sourceH: 138, height: 169, type: "관광", location: "나가사키", title: "오우라 천주당", description: ["일본 국보 서양식 목조 성당"] },
      { sourceY: 1244, sourceH: 136, height: 169, type: "관광", location: "나가사키", title: "그라바엔", description: ["이국적인 분위기의 역사 정원"] },
      { sourceY: 1390, sourceH: 123, height: 149, type: "식사", location: "나가사키", title: "중식 · 현지식", description: ["현지식으로 점심 식사"] },
      { sourceY: 1523, sourceH: 112, height: 145, type: "이동", location: "후쿠오카", title: "후쿠오카 이동", description: ["약 2시간 소요"] },
      { sourceY: 1646, sourceH: 116, height: 169, type: "관광", location: "텐진", title: "텐진거리 자유시간", description: ["쇼핑과 도심 산책을 여유롭게"] },
      { sourceY: 1772, sourceH: 127, height: 175, type: "숙소", location: "후쿠오카", title: "호텔 이동 및 휴식", description: ["베스트 웨스턴 플러스 후쿠오카", "텐진 미나미 · 석식은 불포함"] },
    ],
  },
];

const chipColors = {
  항공: ["#f9ccc9", "#c83b3f"],
  이동: ["#e8ecd0", "#47743e"],
  식사: ["#f9e4c4", "#a85d19"],
  관광: ["#e8ecd0", "#47743e"],
  숙소: ["#eadde8", "#714866"],
};

const day3IconCrops = {
  식사: { left: 16, top: 190, width: 78, height: 100 },
  관광: { left: 16, top: 382, width: 78, height: 100 },
  이동: { left: 16, top: 907, width: 78, height: 100 },
  항공: { left: 16, top: 1065, width: 78, height: 100 },
};

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const chipWidth = (value) => 20 + [...value].length * 16;

function layout(day) {
  let y = 161;
  for (const [index, row] of day.rows.entries()) {
    row.y = y;
    y += row.height;
    if (index < day.rows.length - 1) y += 18;
  }
  day.memoY = y + 4;
  day.height = day.memoY + 133 + 8;
}

function baseSvg(day) {
  const cards = day.rows.map((row) => `
    <rect x="91" y="${row.y}" width="580" height="${row.height}" rx="20" fill="#fdfaf5" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    ${row.time ? `<line x1="200" y1="${row.y + 14}" x2="200" y2="${row.y + row.height - 14}" stroke="#e6b89d" stroke-width="1.4"/>` : ""}
  `).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${day.height}">
    <defs>
      <filter id="shadow" x="-10%" y="-15%" width="120%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#765747" flood-opacity=".11"/></filter>
      <filter id="grain"><feTurbulence baseFrequency=".72" numOctaves="2" seed="7"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .018 0"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="#faf4ec"/>
    <rect x="28" y="8" width="644" height="134" rx="20" fill="#fcf8f3" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    <line x1="57" y1="169" x2="57" y2="${day.memoY + 3}" stroke="#dc535f" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 11"/>
    ${cards}
    <rect x="28" y="${day.memoY}" width="644" height="133" rx="19" fill="#fefaf4" stroke="#e4c1af" stroke-width="1.15" filter="url(#shadow)"/>
    <rect width="100%" height="100%" filter="url(#grain)" opacity=".38"/>
  </svg>`);
}

function textSvg(day) {
  const rows = day.rows.map((row) => {
    const contentX = row.time ? 213 : 113;
    const typeWidth = chipWidth(row.type);
    const locationWidth = chipWidth(row.location);
    const [typeFill, typeColor] = chipColors[row.type];
    const titleLines = row.titleLines ?? [row.title];
    const titleSize = Math.max(...titleLines.map((line) => line.length)) > 16 ? 22 : Math.max(...titleLines.map((line) => line.length)) > 12 ? 24 : 28;
    const descSize = row.description[0].length > 28 ? 16 : 19;
    const titles = titleLines.map((line, index) => `<text x="${contentX}" y="${row.y + 89 + index * 29}" class="title" font-size="${titleSize}">${escapeXml(line)}</text>`).join("");
    const descriptionY = row.y + (titleLines.length > 1 ? 151 : 124);
    const descriptions = row.description.map((line, index) => `<text x="${contentX}" y="${descriptionY + index * 25}" class="desc" font-size="${descSize}">${escapeXml(line)}</text>`).join("");
    return `
      ${row.time ? `<text x="111" y="${row.y + 48}" class="time">${row.time}</text>` : ""}
      <rect x="${contentX}" y="${row.y + 17}" width="${typeWidth}" height="34" rx="10" fill="${typeFill}"/>
      <text x="${contentX + 11}" y="${row.y + 41}" class="chip" fill="${typeColor}">${row.type}</text>
      <rect x="${contentX + typeWidth + 8}" y="${row.y + 17}" width="${locationWidth}" height="34" rx="10" fill="#e8ecd0"/>
      <text x="${contentX + typeWidth + 19}" y="${row.y + 41}" class="chip" fill="#47743e">${escapeXml(row.location)}</text>
      ${titles}
      ${descriptions}
    `;
  }).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${day.height}">
    <style>
      .route-title,.title{font-family:AppleMyungjo,serif;font-weight:700;fill:#17130f;stroke:#17130f;stroke-width:.65px;paint-order:stroke fill}.route-title{font-size:28px}.route-path{font-family:Pretendard,sans-serif;font-size:17px;font-weight:600;fill:#2c2520}.chip{font-family:Pretendard,sans-serif;font-size:17px;font-weight:700}.time{font-family:AppleMyungjo,serif;font-size:29px;font-weight:700;fill:#17130f;stroke:#17130f;stroke-width:.55px;paint-order:stroke fill}.desc{font-family:Pretendard,sans-serif;font-weight:500;fill:#2c2520}.memo{font-family:AppleMyungjo,serif;font-weight:700;fill:#2c2520;stroke:#2c2520;stroke-width:.2px;paint-order:stroke fill}.memo-label{font-family:Pretendard,sans-serif;font-size:17px;font-weight:800;fill:white}</style>
    <text x="113" y="63" class="route-title">${escapeXml(day.routeTitle)}</text>
    <text x="115" y="100" class="route-path">${escapeXml(day.routePath)}</text>
    ${rows}
    <rect x="59" y="${day.memoY + 7}" width="112" height="34" rx="11" fill="#db3e60"/>
    <text x="73" y="${day.memoY + 31}" class="memo-label">DAY ${day.day} 메모</text>
    <text x="61" y="${day.memoY + 82}" class="memo" font-size="${day.day === 2 ? 15 : 18}">${escapeXml(day.memo[0])}</text>
    <text x="61" y="${day.memoY + 109}" class="memo" font-size="${day.day === 2 ? 15 : 18}">${escapeXml(day.memo[1])}</text>
  </svg>`);
}

async function sceneCrop(source, grid, index, targetWidth, targetHeight) {
  const columns = grid.x.length - 1;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const left = grid.x[column] + grid.inset;
  const top = grid.y[row] + grid.inset;
  const right = grid.x[column + 1] - grid.inset;
  const bottom = grid.y[row + 1] - grid.inset;
  const cell = await source.clone()
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  return sharp(cell)
    .trim({ background: "#ffffff", threshold: 14 })
    .resize({ width: targetWidth, height: targetHeight, fit: "contain", background: "#ffffff" })
    .sharpen(1)
    .png()
    .toBuffer();
}

async function circleIcon(image, width, height) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="white"/></svg>`);
  return sharp(image).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

for (const day of days) {
  layout(day);
  const sourcePath = path.join(root, day.source);
  const targetPath = path.join(root, day.target);
  const source = sharp(sourcePath);
  const scenes = sharp(path.join(root, day.scenes));
  const day3Body = sharp(day3BodyPath);
  const layers = [{ input: baseSvg(day), top: 0, left: 0 }];

  const routeArt = await sceneCrop(scenes, day.sceneGrid, 0, 205, 118);
  layers.push({ input: routeArt, top: 16, left: 458, blend: "multiply" });
  const routeLeaf = await day3Body.clone().extract({ left: 38, top: 18, width: 70, height: 90 }).png().toBuffer();
  layers.push({ input: routeLeaf, top: 18, left: 38 });

  for (const [index, row] of day.rows.entries()) {
    const artHeight = row.height - 10;
    const narrowArt = row.titleLines || row.artNarrow;
    const artWidth = row.artNarrow ? 150 : narrowArt ? 180 : 265;
    const art = await sceneCrop(scenes, day.sceneGrid, index + 1, artWidth, artHeight);
    layers.push({ input: art, top: row.y + 5, left: row.artNarrow ? 515 : narrowArt ? 485 : 400, blend: "multiply" });
    const iconCrop = day3IconCrops[row.type];
    const iconBase = iconCrop
      ? await day3Body.clone().extract(iconCrop).resize({ width: 74, height: 90, fit: "contain", background: "#ffffff" }).png().toBuffer()
      : await source.clone().extract({ left: 17, top: Math.round(row.sourceY + (row.sourceH - 68) / 2), width: 62, height: 68 }).resize({ width: 74, height: 90, fit: "contain", background: "#ffffff" }).sharpen(1.5).modulate({ saturation: 1.35 }).png().toBuffer();
    const icon = await circleIcon(iconBase, 74, 90);
    layers.push({ input: icon, top: Math.round(row.y + (row.height - 90) / 2), left: 20 });
  }

  const flowerWidth = 140;
  const flowers = await day3Body.clone().extract({ left: 455, top: 1355, width: 205, height: 112 }).resize({ width: flowerWidth, height: 105, fit: "contain", background: "#fefaf4" }).png().toBuffer();
  layers.push({ input: flowers, top: day.memoY + 13, left: 515 });
  layers.push({ input: textSvg(day), top: 0, left: 0 });

  await sharp({ create: { width, height: day.height, channels: 4, background: "#faf4ec" } }).composite(layers).png().toFile(targetPath);
}
