export const HOME_TRIP = {
  startDate: "2026-09-11",
  endDate: "2026-09-13",
  displayDate: "2026.09.11 - 09.13",
} as const;

export const HOME_SCHEDULE_PREVIEWS = [
  {
    dayNo: 1,
    date: "2026-09-11",
    label: "DAY 1",
    title: "야나가와 · 다케오 · 우레시노",
    supporting: "뱃놀이 · 다케오 신사/도서관 · 온천",
  },
  {
    dayNo: 2,
    date: "2026-09-12",
    label: "DAY 2",
    title: "나가사키 · 그라바엔 · 텐진",
    supporting: "차이나타운 · 오우라 천주당 · 텐진 자유시간",
  },
  {
    dayNo: 3,
    date: "2026-09-13",
    label: "DAY 3",
    title: "다자이후 · 라라포트 · 귀국",
    supporting: "다자이후 텐만구 · 라라포트 후쿠오카",
  },
] as const;

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
  if (today < HOME_SCHEDULE_PREVIEWS[1].date) return HOME_SCHEDULE_PREVIEWS[0];
  if (today < HOME_SCHEDULE_PREVIEWS[2].date) return HOME_SCHEDULE_PREVIEWS[1];
  return HOME_SCHEDULE_PREVIEWS[2];
}
