import { SCHEDULE_BODY_DIMENSIONS } from "./schedule-layout";

export const SCHEDULE_DAY_NOS = [1, 2, 3] as const;

export type ScheduleDayNo = (typeof SCHEDULE_DAY_NOS)[number];

export type ScheduleVisualAssetConfig = {
  topSrc?: string;
  bodySrc?: string;
  bodyWidth?: number;
  bodyHeight?: number;
  fullPlateFallbackSrc?: string;
};

export const scheduleVisualAssets: Record<
  ScheduleDayNo,
  ScheduleVisualAssetConfig
> = {
  1: {
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-1.png",
    bodyWidth: SCHEDULE_BODY_DIMENSIONS[1].width,
    bodyHeight: SCHEDULE_BODY_DIMENSIONS[1].height,
    fullPlateFallbackSrc: "/assets/schedule/approved/day-1.png",
  },
  2: {
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-2.png",
    bodyWidth: SCHEDULE_BODY_DIMENSIONS[2].width,
    bodyHeight: SCHEDULE_BODY_DIMENSIONS[2].height,
    fullPlateFallbackSrc: "/assets/schedule/approved/day-2.png",
  },
  3: {
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-3.png",
    bodyWidth: SCHEDULE_BODY_DIMENSIONS[3].width,
    bodyHeight: SCHEDULE_BODY_DIMENSIONS[3].height,
  },
};

export const isScheduleDayNo = (value: number): value is ScheduleDayNo =>
  SCHEDULE_DAY_NOS.some((dayNo) => dayNo === value);

export function resolveScheduleVisual(config: ScheduleVisualAssetConfig) {
  if (config.topSrc && config.bodySrc && config.bodyWidth && config.bodyHeight) {
    return {
      mode: "split" as const,
      topSrc: config.topSrc,
      bodySrc: config.bodySrc,
      bodyWidth: config.bodyWidth,
      bodyHeight: config.bodyHeight,
    };
  }

  if (config.fullPlateFallbackSrc) {
    return { mode: "fallback" as const, src: config.fullPlateFallbackSrc };
  }

  return null;
}
