import {
  SCHEDULE_GUIDE_ITEMS,
  type ScheduleGuideItemId,
} from "./schedule-guide-data";
import {
  getScheduleBodyLogicalHeight,
  SCHEDULE_DAY_ROW_COUNTS,
  SCHEDULE_LAYOUT,
} from "./schedule-layout";
import type { ScheduleDayNo } from "./schedule-visual-assets";

export type ScheduleHotspotScope = "body" | "fullPlate";

export type ScheduleDetailHotspot = {
  readonly id: ScheduleGuideItemId;
  readonly day: ScheduleDayNo;
  readonly scope: ScheduleHotspotScope;
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

const rowIndexes: Record<ScheduleDayNo, number> = { 1: 0, 2: 0, 3: 0 };

export const SCHEDULE_DETAIL_HOTSPOTS: readonly ScheduleDetailHotspot[] =
  SCHEDULE_GUIDE_ITEMS.map((item) => {
    const index = rowIndexes[item.day]++;
    const bodyHeight = getScheduleBodyLogicalHeight(
      SCHEDULE_DAY_ROW_COUNTS[item.day],
    );

    return {
      id: item.id,
      day: item.day,
      scope: "body",
      rect: {
        x: (SCHEDULE_LAYOUT.row.cardX / SCHEDULE_LAYOUT.logicalWidth) * 100,
        y:
          ((SCHEDULE_LAYOUT.row.firstY +
            index * (SCHEDULE_LAYOUT.row.height + SCHEDULE_LAYOUT.row.gap)) /
            bodyHeight) *
          100,
        width:
          (SCHEDULE_LAYOUT.row.cardWidth / SCHEDULE_LAYOUT.logicalWidth) * 100,
        height: (SCHEDULE_LAYOUT.row.height / bodyHeight) * 100,
      },
    };
  });

export const SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS = [
  { id: "d1-incheon-meeting", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 29.1504, width: 81.8182, height: 6.543 } },
  { id: "d1-incheon-departure", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 36.377, width: 81.8182, height: 6.3477 } },
  { id: "d1-fukuoka-arrival", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 43.4082, width: 81.8182, height: 6.0059 } },
  { id: "d1-move-yanagawa", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 50.1465, width: 81.8182, height: 5.4199 } },
  { id: "d1-lunch-yanagawa", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 56.2988, width: 81.8182, height: 5.4199 } },
  { id: "d1-yanagawa-boat", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 62.4512, width: 81.8182, height: 5.3223 } },
  { id: "d1-move-takeo", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 68.457, width: 81.8182, height: 4.9316 } },
  { id: "d1-takeo-shrine", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 74.0234, width: 81.8182, height: 5.127 } },
  { id: "d1-takeo-library", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 79.7852, width: 81.8182, height: 4.7363 } },
  { id: "d1-move-ureshino", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 85.1563, width: 81.8182, height: 4.4922 } },
  { id: "d1-ureshino-hotel", day: 1, scope: "fullPlate", rect: { x: 13.4897, y: 90.1855, width: 81.8182, height: 5.2734 } },
  { id: "d2-hotel-breakfast", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 31.6895, width: 85.044, height: 6.7871 } },
  { id: "d2-move-nagasaki", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 39.0137, width: 85.044, height: 6.6895 } },
  { id: "d2-nagasaki-chinatown", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 46.2891, width: 85.044, height: 6.6406 } },
  { id: "d2-oura-cathedral", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 53.4668, width: 85.044, height: 6.7383 } },
  { id: "d2-glover-garden", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 60.7422, width: 85.044, height: 6.6406 } },
  { id: "d2-lunch-nagasaki", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 67.8711, width: 85.044, height: 6.0059 } },
  { id: "d2-move-fukuoka", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 74.3652, width: 85.044, height: 5.4688 } },
  { id: "d2-tenjin-free", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 80.3711, width: 85.044, height: 5.6641 } },
  { id: "d2-fukuoka-hotel", day: 2, scope: "fullPlate", rect: { x: 10.4106, y: 86.5234, width: 85.044, height: 6.2012 } },
] as const satisfies readonly ScheduleDetailHotspot[];

export const getScheduleDetailHotspots = (
  day: ScheduleDayNo,
  scope: ScheduleHotspotScope,
) => {
  const hotspots: readonly ScheduleDetailHotspot[] =
    scope === "body"
      ? SCHEDULE_DETAIL_HOTSPOTS
      : SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS;
  return hotspots.filter((hotspot) => hotspot.day === day);
};
