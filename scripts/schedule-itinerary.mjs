import { readFile } from "node:fs/promises";
import path from "node:path";

const typeLabels = {
  flight: "항공",
  move: "이동",
  meal: "식사",
  sightseeing: "관광",
  hotel: "숙소",
};

const rowVisuals = {
  1: [
    { id: "d1-incheon-meeting", narrowArt: true },
    { id: "d1-incheon-departure", narrowArt: true },
    { id: "d1-fukuoka-arrival", narrowArt: true },
    { id: "d1-move-yanagawa" },
    { id: "d1-lunch-yanagawa" },
    { id: "d1-yanagawa-boat" },
    { id: "d1-move-takeo" },
    { id: "d1-takeo-shrine" },
    { id: "d1-takeo-library" },
    { id: "d1-move-ureshino" },
    {
      id: "d1-ureshino-hotel",
      titleLines: ["오에도 온센 모노가타리", "우레시노칸"],
      titleSize: 21,
      narrowArt: true,
    },
  ],
  2: [
    { id: "d2-hotel-breakfast" },
    { id: "d2-move-nagasaki" },
    { id: "d2-nagasaki-chinatown" },
    { id: "d2-oura-cathedral" },
    { id: "d2-glover-garden" },
    { id: "d2-lunch-nagasaki" },
    { id: "d2-move-fukuoka" },
    { id: "d2-tenjin-free" },
    {
      id: "d2-fukuoka-hotel",
      artSource:
        "private-assets/schedule/plates/source/day-2-hotel-composite-v27.png",
      narrowArt: true,
    },
  ],
  3: [
    { id: "d3-hotel-breakfast" },
    { id: "d3-dazaifu" },
    { id: "d3-lalaport" },
    { id: "d3-lunch" },
    { id: "d3-move-airport" },
    { id: "d3-fukuoka-departure", narrowArt: true },
    { id: "d3-incheon-arrival", narrowArt: true },
  ],
};

function splitSqlValues(tuple) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const character = tuple[index];
    if (character === "'" && quoted && tuple[index + 1] === "'") {
      value += "''";
      index += 1;
    } else if (character === "'") {
      quoted = !quoted;
      value += character;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function parseSqlValue(value) {
  if (value.toLowerCase() === "null") return null;
  const escaped = value.startsWith("E'");
  const start = escaped ? 2 : 1;
  if ((escaped || value.startsWith("'")) && value.endsWith("'")) {
    const text = value.slice(start, -1).replaceAll("''", "'");
    return escaped ? text.replaceAll("\\n", "\n") : text;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Unsupported seed value: ${value}`);
  return number;
}

export function parseCanonicalScheduleRows(sql) {
  return sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\([123],\s/.test(line))
    .map((line) => {
      const tuple = line.match(/^\((.*)\),?$/)?.[1];
      if (!tuple) throw new Error("Invalid canonical itinerary row.");
      const values = splitSqlValues(tuple).map(parseSqlValue);
      if (values.length !== 7) throw new Error("Canonical itinerary row must have 7 fields.");
      const [dayNo, sequence, timeLabel, locationName, title, description, itemType] = values;
      return {
        dayNo,
        sequence,
        timeLabel,
        locationName,
        title,
        description,
        itemType,
      };
    });
}

export async function loadCanonicalScheduleRows(root) {
  return parseCanonicalScheduleRows(
    await readFile(path.join(root, "docs/data/04_SEED_DRAFT.sql"), "utf8"),
  );
}

export function createScheduleGeneratorRows(canonicalRows) {
  return Object.fromEntries(
    [1, 2, 3].map((day) => {
      const rows = canonicalRows
        .filter((row) => row.dayNo === day)
        .sort((left, right) => left.sequence - right.sequence);
      const visuals = rowVisuals[day];
      if (rows.length !== visuals.length) {
        throw new Error(`DAY ${day} visual rows do not match the canonical seed.`);
      }
      return [
        day,
        rows.map((row, index) => ({
          ...visuals[index],
          sequence: row.sequence,
          time: row.timeLabel ?? undefined,
          type: typeLabels[row.itemType],
          itemType: row.itemType,
          location: row.locationName ?? "",
          title: row.title,
          description: row.description?.split("\n") ?? [],
        })),
      ];
    }),
  );
}
