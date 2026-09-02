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
  timeLabel?: string;
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

const localDateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const readItemType = (value: string | null): ScheduleItemType =>
  itemTypes.has(value as ScheduleItemType) ? (value as ScheduleItemType) : "other";

function readDescription(description: string | null) {
  if (!description) return undefined;
  return description.replace(/\.$/, "");
}

function readDate(startDate: string, dayNo: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayNo - 1);
  return date;
}

export function getInitialScheduleDayIndex(
  days: Pick<ScheduleDay, "date">[],
  now = new Date(),
  timeZone = "Asia/Seoul",
) {
  if (!days.length) return 0;
  const today = localDateKey(now, timeZone);
  const upcomingIndex = days.findIndex(({ date }) => date >= today);
  return upcomingIndex === -1 ? days.length - 1 : upcomingIndex;
}

export function resolveScheduleDayNo(
  days: Pick<ScheduleDay, "dayNo" | "date">[],
  persistedDayNo: number | null,
  now = new Date(),
) {
  return (
    days.find(({ dayNo }) => dayNo === persistedDayNo)?.dayNo ??
    days[getInitialScheduleDayIndex(days, now)]?.dayNo ??
    null
  );
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
        description: readDescription(row.description),
        type,
        timeLabel: row.time_label?.trim() || undefined,
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
