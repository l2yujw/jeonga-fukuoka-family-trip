import {
  createScheduleDays,
  type ItineraryItemRow,
} from "../schedule/schedule-data";

export const HOME_SCHEDULE_DAYS = [
  {
    dayNo: 1,
    date: "2026-09-11",
    label: "DAY 1",
  },
  {
    dayNo: 2,
    date: "2026-09-12",
    label: "DAY 2",
  },
  {
    dayNo: 3,
    date: "2026-09-13",
    label: "DAY 3",
  },
] as const;

const preferredSupportingTypes = new Set(["sightseeing", "meal", "optional"]);
const excludedSupportingTypes = new Set(["move", "flight", "hotel"]);

export function createHomeSchedulePreviewCopy(
  rows: ItineraryItemRow[],
  startDate: string,
  dayNo: number,
): { title: string; supporting: string } | null {
  const day = createScheduleDays(rows, startDate).find(
    (candidate) => candidate.dayNo === dayNo,
  );
  if (!day) return null;

  const preferredTitles = day.items
    .filter((item) => preferredSupportingTypes.has(item.type))
    .map((item) => item.title.trim())
    .filter(Boolean);
  const supportingTitles = preferredTitles.length
    ? preferredTitles
    : day.items
        .filter((item) => !excludedSupportingTypes.has(item.type))
        .map((item) => item.title.trim())
        .filter(Boolean);

  return {
    title: day.routeSummary.replaceAll(" → ", " · ") || "여행 일정",
    supporting: supportingTitles.join(" · ") || "일정 보기",
  };
}

const localDateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export function getHomeSchedulePreview(
  now = new Date(),
  timeZone = "Asia/Seoul",
) {
  const today = localDateKey(now, timeZone);
  if (today < HOME_SCHEDULE_DAYS[1].date) return HOME_SCHEDULE_DAYS[0];
  if (today < HOME_SCHEDULE_DAYS[2].date) return HOME_SCHEDULE_DAYS[1];
  return HOME_SCHEDULE_DAYS[2];
}
