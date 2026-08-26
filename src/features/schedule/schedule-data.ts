export type ScheduleItemType =
  | "flight"
  | "move"
  | "sightseeing"
  | "meal"
  | "hotel"
  | "optional"
  | "other";

export type ItineraryItemRow = {
  day_no: number;
  sequence: number;
  time_label: string | null;
  location_name: string | null;
  title: string;
  description: string | null;
  item_type: string | null;
};

export type ScheduleItem = {
  location: string;
  title: string;
  description?: string;
  type: ScheduleItemType;
  timeLabel?: string | null;
  statusLabel?: string | null;
};

export type ScheduleDay = {
  dayNo: number;
  date: string;
  weekday: string;
  routeSummary: string;
  items: ScheduleItem[];
};

const itemTypes = new Set<ScheduleItemType>([
  "flight",
  "move",
  "sightseeing",
  "meal",
  "hotel",
  "optional",
]);

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

const readItemType = (value: string | null): ScheduleItemType =>
  itemTypes.has(value as ScheduleItemType) ? (value as ScheduleItemType) : "other";

function readStatusLabel(type: ScheduleItemType, description: string | null) {
  if (type === "optional") return "선택 일정";
  if (description?.includes("재확인 필요")) return "재확인 필요";
  if (type !== "hotel" || !description) return null;
  if (description.includes("후보 표기")) return "숙소 최종 확정 전";
  return description.includes("별도 확정")
    ? "예정 호텔 별도 확정 필요"
    : null;
}

function readDescription(type: ScheduleItemType, description: string | null) {
  if (!description) return undefined;
  return type === "hotel"
    ? description.split(".", 1)[0]
    : description.replace(/\.$/, "");
}

function readDate(startDate: string, dayNo: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayNo - 1);
  return date;
}

export function createScheduleDays(
  rows: ItineraryItemRow[],
  startDate: string,
): ScheduleDay[] {
  const grouped = new Map<number, ItineraryItemRow[]>();

  for (const row of [...rows].sort(
    (left, right) => left.day_no - right.day_no || left.sequence - right.sequence,
  )) {
    const dayRows = grouped.get(row.day_no);
    if (dayRows) dayRows.push(row);
    else grouped.set(row.day_no, [row]);
  }

  return [...grouped].map(([dayNo, dayRows]) => {
    const date = readDate(startDate, dayNo);
    const items = dayRows.map((row): ScheduleItem => {
      const type = readItemType(row.item_type);
      return {
        location: row.location_name ?? "",
        title: row.title,
        description: readDescription(type, row.description),
        type,
        timeLabel: row.time_label,
        statusLabel: readStatusLabel(type, row.description),
      };
    });
    // ponytail: derive summaries from locations; store explicit summaries if editorial overrides grow.
    const routeLocations = items
      .filter((item) => item.type !== "hotel" && item.location)
      .map((item) => item.location)
      .filter((location, index, locations) => location !== locations[index - 1]);

    return {
      dayNo,
      date: date.toISOString().slice(0, 10),
      weekday: weekdays[date.getUTCDay()],
      routeSummary: routeLocations.join(" → "),
      items,
    };
  });
}
