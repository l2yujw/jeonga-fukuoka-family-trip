import type { ScheduleGuideItemId } from "./schedule-guide-data";
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

export const SCHEDULE_DETAIL_HOTSPOTS = [
  {
    id: "d1-incheon-meeting",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 7.3415, width: 83.4532, height: 6.4751 },
  },
  {
    id: "d1-incheon-departure",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 14.6375, width: 83.4532, height: 6.4751 },
  },
  {
    id: "d1-fukuoka-arrival",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 21.9334, width: 83.4532, height: 6.4751 },
  },
  {
    id: "d1-move-yanagawa",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 29.2294, width: 83.4532, height: 6.6119 },
  },
  {
    id: "d1-lunch-yanagawa",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 36.6621, width: 83.4532, height: 6.7943 },
  },
  {
    id: "d1-yanagawa-boat",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 44.2772, width: 83.4532, height: 7.7063 },
  },
  {
    id: "d1-move-takeo",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 52.8044, width: 83.4532, height: 6.6119 },
  },
  {
    id: "d1-takeo-shrine",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 60.2371, width: 83.4532, height: 7.7063 },
  },
  {
    id: "d1-takeo-library",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 68.7642, width: 83.4532, height: 7.7063 },
  },
  {
    id: "d1-move-ureshino",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 77.2914, width: 83.4532, height: 6.6119 },
  },
  {
    id: "d1-ureshino-hotel",
    day: 1,
    scope: "body",
    rect: { x: 13.0935, y: 84.7241, width: 83.4532, height: 8.6639 },
  },
  {
    id: "d2-hotel-breakfast",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 8.4337, width: 83.4532, height: 8.8528 },
  },
  {
    id: "d2-move-nagasaki",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 18.2294, width: 83.4532, height: 7.5956 },
  },
  {
    id: "d2-nagasaki-chinatown",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 26.7679, width: 83.4532, height: 8.8528 },
  },
  {
    id: "d2-oura-cathedral",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 36.5636, width: 83.4532, height: 8.8528 },
  },
  {
    id: "d2-glover-garden",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 46.3594, width: 83.4532, height: 8.8528 },
  },
  {
    id: "d2-lunch-nagasaki",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 56.1551, width: 83.4532, height: 7.8051 },
  },
  {
    id: "d2-move-fukuoka",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 64.9031, width: 83.4532, height: 7.5956 },
  },
  {
    id: "d2-tenjin-free",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 73.4416, width: 83.4532, height: 8.8528 },
  },
  {
    id: "d2-fukuoka-hotel",
    day: 2,
    scope: "body",
    rect: { x: 13.0935, y: 83.2373, width: 83.4532, height: 9.1671 },
  },
  {
    id: "d3-hotel-breakfast",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 10.8564,
      width: 83.5971,
      height: 11.3958,
    },
  },
  {
    id: "d3-dazaifu",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 23.4659,
      width: 83.5971,
      height: 11.5981,
    },
  },
  {
    id: "d3-lalaport",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 36.143,
      width: 83.5971,
      height: 11.3958,
    },
  },
  {
    id: "d3-lunch",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 48.6851,
      width: 83.5971,
      height: 10.0472,
    },
  },
  {
    id: "d3-move-airport",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 59.8786,
      width: 83.5971,
      height: 9.7775,
    },
  },
  {
    id: "d3-fukuoka-departure",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 70.6676,
      width: 83.5971,
      height: 9.5752,
    },
  },
  {
    id: "d3-incheon-arrival",
    day: 3,
    scope: "body",
    rect: {
      x: 13.0935,
      y: 81.1868,
      width: 83.5971,
      height: 9.0357,
    },
  },
] as const satisfies readonly ScheduleDetailHotspot[];

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
