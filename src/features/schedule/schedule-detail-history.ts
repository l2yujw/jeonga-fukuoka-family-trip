export const SCHEDULE_DETAIL_HISTORY_KEY = "scheduleDetailEntry";

const isHistoryRecord = (state: unknown): state is Record<string, unknown> =>
  typeof state === "object" && state !== null;

export const createScheduleDetailHistoryState = (state: unknown) => ({
  ...(isHistoryRecord(state) ? state : {}),
  [SCHEDULE_DETAIL_HISTORY_KEY]: true,
});

export const getScheduleDetailCloseMode = (state: unknown) =>
  isHistoryRecord(state) && state[SCHEDULE_DETAIL_HISTORY_KEY] === true
    ? "back"
    : "replace";

export const removeScheduleDetailFromUrl = (href: string) => {
  const url = new URL(href);
  url.searchParams.delete("detail");
  return url;
};
