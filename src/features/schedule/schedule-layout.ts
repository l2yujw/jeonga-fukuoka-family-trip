import scheduleLayout from "./schedule-layout.json" with { type: "json" };

export const SCHEDULE_LAYOUT = scheduleLayout;
export const SCHEDULE_DAY_ROW_COUNTS = {
  1: scheduleLayout.dayRowCounts["1"],
  2: scheduleLayout.dayRowCounts["2"],
  3: scheduleLayout.dayRowCounts["3"],
} as const;

export const getScheduleBodyLogicalHeight = (rowCount: number) =>
  scheduleLayout.row.firstY +
  rowCount * scheduleLayout.row.height +
  (rowCount - 1) * scheduleLayout.row.gap +
  scheduleLayout.memo.gap +
  scheduleLayout.memo.height +
  scheduleLayout.memo.bottomMargin;

export const getScheduleRowLogicalY = (index: number) =>
  scheduleLayout.row.firstY +
  index * (scheduleLayout.row.height + scheduleLayout.row.gap);

const dimensionsFor = (rowCount: number) => ({
  width: scheduleLayout.logicalWidth * scheduleLayout.pixelRatio,
  height: getScheduleBodyLogicalHeight(rowCount) * scheduleLayout.pixelRatio,
});

export const SCHEDULE_BODY_DIMENSIONS = {
  1: dimensionsFor(SCHEDULE_DAY_ROW_COUNTS[1]),
  2: dimensionsFor(SCHEDULE_DAY_ROW_COUNTS[2]),
  3: dimensionsFor(SCHEDULE_DAY_ROW_COUNTS[3]),
} as const;
