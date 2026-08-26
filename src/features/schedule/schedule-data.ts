export type ScheduleItemType =
  | "flight"
  | "move"
  | "sightseeing"
  | "meal"
  | "hotel"
  | "optional";

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

export const scheduleDays: ScheduleDay[] = [
  {
    dayNo: 1,
    date: "2026-09-11",
    weekday: "금",
    routeSummary: "인천 → 후쿠오카 → 가라츠 → 후쿠오카",
    items: [
      { location: "인천", title: "인천 국제공항 출발", description: "항공편 및 출발시간 재확인 필요", type: "flight", statusLabel: "재확인 필요" },
      { location: "후쿠오카", title: "후쿠오카 국제공항 도착", description: "도착시간 재확인 후 입국 수속 및 이동", type: "flight" },
      { location: "가라츠", title: "가라츠 이동", type: "move" },
      { location: "가라츠", title: "니지노 마쓰바라", description: "일본 3대 송림 해안가의 소나무 숲", type: "sightseeing" },
      { location: "가라츠", title: "카가미야마 전망대", description: "가라츠시의 절경 감상", type: "sightseeing" },
      { location: "후쿠오카", title: "후쿠오카 이동", type: "move" },
      { location: "후쿠오카", title: "라라포트 후쿠오카", description: "초대형 건담 입상이 있는 종합 쇼핑몰", type: "sightseeing" },
      { location: "후쿠오카", title: "호텔 체크인 및 휴식", description: "저녁 자유시간", type: "hotel", statusLabel: "예정 호텔 별도 확정 필요" },
      { location: "후쿠오카", title: "모모치 해변공원 / 마크이즈", description: "자유시간 추천 일정", type: "optional", statusLabel: "선택 일정" },
    ],
  },
  {
    dayNo: 2,
    date: "2026-09-12",
    weekday: "토",
    routeSummary: "후쿠오카 → 다자이후 → 유후인 → 벳부",
    items: [
      { location: "후쿠오카", title: "호텔 조식", type: "meal" },
      { location: "다자이후", title: "다자이후 텐만구", description: "사계절이 아름다운 신사", type: "sightseeing" },
      { location: "유후인", title: "유후인 이동", type: "move" },
      { location: "유후인", title: "유노쓰보 가이도", description: "예쁜 상점이 이어지는 거리", type: "sightseeing" },
      { location: "유후인", title: "긴린코 호수", description: "유후인의 대표 호수", type: "sightseeing" },
      { location: "벳부", title: "벳부 이동", type: "move" },
      { location: "벳부", title: "가마도지옥", description: "족욕 체험, 온천계란 및 라무네사이다 특전", type: "sightseeing" },
      { location: "벳부", title: "유노하나 재배지", description: "천연입욕제를 만드는 재배지", type: "sightseeing" },
      { location: "큐슈", title: "온천호텔 체크인", description: "석식 및 온천욕", type: "hotel", statusLabel: "숙소 최종 확정 전" },
    ],
  },
  {
    dayNo: 3,
    date: "2026-09-13",
    weekday: "일",
    routeSummary: "아소 → 고코노에 → 후쿠오카 → 인천",
    items: [
      { location: "아소", title: "아소 이동", type: "move" },
      { location: "아소", title: "아소 대관봉", description: "아소 대자연의 절경", type: "sightseeing" },
      { location: "고코노에", title: "고코노에 이동", type: "move" },
      { location: "고코노에", title: "코코노에 유메오오츠리바시", description: "꿈의 대현수교 산책", type: "sightseeing" },
      { location: "후쿠오카", title: "후쿠오카 이동", type: "move" },
      { location: "후쿠오카", title: "후쿠오카 공항 출발", description: "항공편 및 출발시간 재확인 필요", type: "flight", statusLabel: "재확인 필요" },
      { location: "인천", title: "인천 국제공항 도착", description: "도착시간 재확인 필요", type: "flight", statusLabel: "재확인 필요" },
    ],
  },
];
