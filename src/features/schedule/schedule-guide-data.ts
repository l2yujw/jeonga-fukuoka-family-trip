import type { ScheduleDayNo } from "./schedule-visual-assets";

export const SCHEDULE_RESEARCH_DATE = "2026-08-31";
export const SCHEDULE_RESEARCH_DATE_LABEL = `${SCHEDULE_RESEARCH_DATE} 조사 기준`;
export const SCHEDULE_MAPS_SNAPSHOT_DATE = "2026-09-02";
export const SCHEDULE_MAPS_SNAPSHOT_LABEL = `Google Maps · ${SCHEDULE_MAPS_SNAPSHOT_DATE} 조사 기준`;
export const SCHEDULE_STATIC_SNAPSHOT_LABEL = `${SCHEDULE_MAPS_SNAPSHOT_DATE} 정적 조사 기준`;

export const SCHEDULE_GUIDE_IDS = [
  "d1-incheon-meeting",
  "d1-incheon-departure",
  "d1-fukuoka-arrival",
  "d1-move-yanagawa",
  "d1-lunch-yanagawa",
  "d1-yanagawa-boat",
  "d1-move-takeo",
  "d1-takeo-shrine",
  "d1-takeo-library",
  "d1-move-ureshino",
  "d1-ureshino-hotel",
  "d2-hotel-breakfast",
  "d2-move-nagasaki",
  "d2-nagasaki-chinatown",
  "d2-oura-cathedral",
  "d2-glover-garden",
  "d2-lunch-nagasaki",
  "d2-move-fukuoka",
  "d2-tenjin-free",
  "d2-fukuoka-hotel",
  "d3-hotel-breakfast",
  "d3-dazaifu",
  "d3-lalaport",
  "d3-lunch",
  "d3-move-airport",
  "d3-fukuoka-departure",
  "d3-incheon-arrival",
] as const;

export type ScheduleGuideItemId = (typeof SCHEDULE_GUIDE_IDS)[number];
export type ScheduleGuideKind =
  | "flight"
  | "move"
  | "meal"
  | "attraction"
  | "hotel";
export type ScheduleNearbyCategory =
  | "food"
  | "cafe"
  | "dessert"
  | "attraction"
  | "museum"
  | "shopping";

export type ScheduleDetailArtworkSrc =
  `/assets/schedule/detail/${string}.webp`;

export type ScheduleNearbyPlace = {
  readonly name: string;
  readonly category: ScheduleNearbyCategory;
  readonly note: string;
  readonly mapUrl: string;
  readonly officialUrl?: string;
  readonly rating?: number;
  readonly reviewCount?: number;
  readonly ratingSourceLabel?: "Google Maps" | "食べログ";
  readonly ratingAsOf?: "2026-09-02";
  readonly walkingMinutes?: number;
  readonly distanceMeters?: number;
  readonly walkingLabel?: string;
  readonly sameComplex?: true;
  readonly validThrough?: string;
  readonly sourceUrl?: string;
  readonly artworkSrc?: ScheduleDetailArtworkSrc;
};

export type ScheduleLocalPick = {
  readonly label: string;
  readonly kind: "snack" | "dessert" | "drink";
  readonly note: string;
};

export type ScheduleGuideEnrichment = {
  readonly places: readonly ScheduleNearbyPlace[];
  readonly localPicks: readonly ScheduleLocalPick[];
};

export type ScheduleRatingSnapshot = {
  readonly rating: number;
  readonly reviewCount: number;
  readonly sourceLabel: "Google Maps";
  readonly sourceUrl: string;
  readonly asOf: "2026-09-02";
};

export type ScheduleGuideItem = {
  readonly id: ScheduleGuideItemId;
  readonly day: ScheduleDayNo;
  readonly title: string;
  readonly kind: ScheduleGuideKind;
  readonly location: string;
  readonly summary: string;
  readonly itineraryFacts?: readonly string[];
  readonly visitInfo?: readonly string[];
  readonly ratingSnapshot?: ScheduleRatingSnapshot;
  readonly mapQuery: string;
  readonly officialUrl?: string;
  readonly nearbyFood?: readonly ScheduleNearbyPlace[];
  readonly walkablePlaces?: readonly ScheduleNearbyPlace[];
};

const GOOGLE_PLACE_RATING_SOURCE = {
  ratingSourceLabel: "Google Maps",
  ratingAsOf: SCHEDULE_MAPS_SNAPSHOT_DATE,
} as const;

export const SCHEDULE_GUIDE_ITEMS = [
  {
    "id": "d1-incheon-meeting",
    "day": 1,
    "title": "인천국제공항 1터미널 집결",
    "kind": "flight",
    "location": "인천",
    "summary": "07:00까지 제1터미널에 모여 탑승수속을 준비해요.",
    "itineraryFacts": [
      "시간: 07:00",
      "공항: 인천국제공항 제1터미널",
      "항공편: 제주항공 7C1403"
    ],
    "mapQuery": "Incheon International Airport Terminal 1",
    "officialUrl": "https://www.airport.kr/"
  },
  {
    "id": "d1-incheon-departure",
    "day": 1,
    "title": "인천국제공항 출발",
    "kind": "flight",
    "location": "인천",
    "summary": "후쿠오카로 출발해요.",
    "itineraryFacts": [
      "시간: 09:30",
      "항공편: 제주항공 7C1403",
      "공항: 인천국제공항 제1터미널"
    ],
    "mapQuery": "Incheon International Airport Terminal 1",
    "officialUrl": "https://www.airport.kr/"
  },
  {
    "id": "d1-fukuoka-arrival",
    "day": 1,
    "title": "후쿠오카공항 도착",
    "kind": "flight",
    "location": "후쿠오카",
    "summary": "입국 수속 후 첫날 일정을 시작해요.",
    "itineraryFacts": [
      "시간: 11:00",
      "항공편: 제주항공 7C1403",
      "공항: 후쿠오카공항"
    ],
    "mapQuery": "Fukuoka Airport International Terminal",
    "officialUrl": "https://www.fukuoka-airport.jp/en/"
  },
  {
    "id": "d1-move-yanagawa",
    "day": 1,
    "title": "야나가와 이동",
    "kind": "move",
    "location": "야나가와",
    "summary": "후쿠오카공항에서 야나가와로 이동해요.",
    "itineraryFacts": [
      "이동 구간: 후쿠오카공항 → 야나가와",
      "예상 이동시간: 약 1시간 20분",
      "도착 후: 중식 · 현지식"
    ],
    "mapQuery": "Yanagawa Fukuoka Japan"
  },
  {
    "id": "d1-lunch-yanagawa",
    "day": 1,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "야나가와",
    "summary": "야나가와에서 현지식 점심을 먹어요.",
    "itineraryFacts": [
      "식사: 중식 · 현지식",
      "확정 식당 없음"
    ],
    "mapQuery": "Yanagawa restaurants Fukuoka",
    "nearbyFood": [
      {
        "name": "Wakamatsuya",
        "category": "food",
        "rating": 4.4,
        "reviewCount": 3640,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Wakamatsuya%20Yanagawa%20Fukuoka",
        "officialUrl": "http://wakamatuya.com/",
        "note": "장어 세이로무시 전통 장어집"
      },
      {
        "name": "Ganso Motoyoshiya",
        "category": "food",
        "rating": 4.2,
        "reviewCount": 2905,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Ganso%20Motoyoshiya%20Yanagawa",
        "officialUrl": "https://www.motoyoshiya.jp/",
        "note": "1681년부터 이어진 장어 세이로무시 노포"
      },
      {
        "name": "Yoakejaya",
        "category": "food",
        "rating": 4.3,
        "reviewCount": 964,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Yoakejaya%20Yanagawa",
        "note": "오하나 일대 해산물 식당"
      }
    ]
  },
  {
    "id": "d1-yanagawa-boat",
    "day": 1,
    "title": "야나가와 뱃놀이",
    "kind": "attraction",
    "location": "야나가와",
    "summary": "야나가와 수로를 작은 배로 둘러보는 체험이에요.",
    "visitInfo": [
      "공식 관광 안내 기준 약 1시간",
      "약 4km 수로 체험",
      "여름 수로 풍경"
    ],
    "mapQuery": "Yanagawa river cruise Fukuoka",
    "officialUrl": "https://www.crossroadfukuoka.jp/en/spot/12901"
  },
  {
    "id": "d1-move-takeo",
    "day": 1,
    "title": "다케오 이동",
    "kind": "move",
    "location": "다케오",
    "summary": "야나가와에서 다케오로 이동해요.",
    "itineraryFacts": [
      "이동 구간: 야나가와 → 다케오",
      "예상 이동시간: 약 1시간 10분",
      "도착 후: 다케오 신사"
    ],
    "mapQuery": "Takeo Saga Japan"
  },
  {
    "id": "d1-takeo-shrine",
    "day": 1,
    "title": "다케오 신사",
    "kind": "attraction",
    "location": "다케오",
    "summary": "다케오 신사와 수령 3,000년 이상으로 소개되는 대녹나무를 둘러봐요.",
    "visitInfo": [
      "수령 3,000년 이상의 대녹나무",
      "대녹나무 코스 공식 안내 약 30~40분",
      "다케오 도서관이 가까움"
    ],
    "mapQuery": "Takeo Shrine Saga",
    "officialUrl": "https://www.takeo-kk.net/sightseeing/001294.php",
    "ratingSnapshot": {
      "rating": 4.4,
      "reviewCount": 3688,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Takeo%20Shrine%20Saga%20Japan",
      "asOf": "2026-09-02"
    },
    "walkablePlaces": [
      {
        "name": "Takeo City Library",
        "category": "attraction",
        "walkingMinutes": 5,
        "rating": 4.5,
        "reviewCount": 1390,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Takeo%20City%20Library%20Saga",
        "note": "높은 서가와 카페가 있는 복합문화 공간",
        "artworkSrc": "/assets/schedule/detail/d1-takeo-library.webp"
      }
    ]
  },
  {
    "id": "d1-takeo-library",
    "day": 1,
    "title": "다케오 도서관",
    "kind": "attraction",
    "location": "다케오",
    "summary": "높은 서가와 카페가 있는 대표 복합문화 공간이에요.",
    "visitInfo": [
      "관광협회 안내: 09:00~21:00, 연중무휴",
      "약 25만 권",
      "카페 있음",
      "무료 주차 190대 안내"
    ],
    "mapQuery": "Takeo City Library Saga",
    "officialUrl": "https://www.takeo-kk.net/sightseeing/001297",
    "ratingSnapshot": {
      "rating": 4.5,
      "reviewCount": 1390,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Takeo%20City%20Library%20Saga%20Japan",
      "asOf": "2026-09-02"
    },
    "nearbyFood": [
      {
        "name": "Starbucks Coffee - Tsutaya Books, Takeo City Library",
        "category": "cafe",
        "rating": 4.5,
        "reviewCount": 456,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Starbucks%20Takeo%20City%20Library",
        "officialUrl": "https://store.starbucks.co.jp/detail-2049/",
        "sameComplex": true,
        "sourceUrl": "https://takeo.city-library.jp/guide/entry-3552.html",
        "note": "도서관 안에서 이동 없이 쉬기 좋은 카페"
      }
    ]
  },
  {
    "id": "d1-move-ureshino",
    "day": 1,
    "title": "우레시노 이동",
    "kind": "move",
    "location": "우레시노",
    "summary": "다케오에서 우레시노 숙소로 이동해요.",
    "itineraryFacts": [
      "이동 구간: 다케오 → 우레시노",
      "예상 이동시간: 약 30분",
      "도착 후: 숙소 체크인"
    ],
    "mapQuery": "Ureshino Saga Japan"
  },
  {
    "id": "d1-ureshino-hotel",
    "day": 1,
    "title": "오에도 온센 모노가타리 우레시노칸",
    "kind": "hotel",
    "location": "우레시노",
    "summary": "체크인 후 저녁 식사와 온천욕으로 쉬어요.",
    "itineraryFacts": [
      "숙소: Ooedo Onsen Monogatari Ureshinokan",
      "체크인 후 휴식 · 온천욕",
      "석식 포함 · 호텔식 뷔페",
      "다음 날 호텔 조식 후 나가사키 이동"
    ],
    "visitInfo": [
      "Otsu-2091 Ureshinomachi Oaza Shimojuku, Ureshino, Saga 843-0301",
      "전화 +81 50-3615-3456"
    ],
    "mapQuery": "Ooedo Onsen Monogatari Ureshinokan",
    "ratingSnapshot": {
      "rating": 3.7,
      "reviewCount": 1770,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Ooedo%20Onsen%20Monogatari%20Ureshinokan",
      "asOf": "2026-09-02"
    }
  },
  {
    "id": "d2-hotel-breakfast",
    "day": 2,
    "title": "호텔 조식",
    "kind": "meal",
    "location": "우레시노",
    "summary": "조식 후 나가사키 일정으로 출발해요.",
    "itineraryFacts": [
      "식사: 호텔 조식",
      "장소: 우레시노 숙소"
    ],
    "mapQuery": "Ooedo Onsen Monogatari Ureshinokan"
  },
  {
    "id": "d2-move-nagasaki",
    "day": 2,
    "title": "나가사키 이동",
    "kind": "move",
    "location": "나가사키",
    "summary": "우레시노에서 나가사키로 이동해요.",
    "itineraryFacts": [
      "이동 구간: 우레시노 → 나가사키",
      "예상 이동시간: 약 50분",
      "도착 후: 나가사키 차이나타운"
    ],
    "mapQuery": "Nagasaki Japan"
  },
  {
    "id": "d2-nagasaki-chinatown",
    "day": 2,
    "title": "나가사키 차이나타운",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "나가사키 신치 중화가를 둘러봐요.",
    "visitInfo": [
      "공식 관광 안내: 가로세로 약 250m",
      "약 40개 중화요리점·상점"
    ],
    "mapQuery": "Nagasaki Shinchi Chinatown",
    "officialUrl": "https://www.discover-nagasaki.com/ko/sightseeing/111",
    "ratingSnapshot": {
      "rating": 3.7,
      "reviewCount": 9223,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Nagasaki%20Shinchi%20Chinatown",
      "asOf": "2026-09-02"
    },
    "nearbyFood": [
      {
        "name": "Shikairo",
        "category": "food",
        "rating": 3.9,
        "reviewCount": 3898,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Shikairo%20Nagasaki",
        "officialUrl": "https://shikairou.com/",
        "note": "나가사키 짬뽕 원조로 알려진 대표 식당"
      },
      {
        "name": "Kozanro Chukagaishinkan",
        "category": "food",
        "rating": 3.8,
        "reviewCount": 1973,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Kozanro%20Chukagaishinkan%20Nagasaki",
        "officialUrl": "http://www.kouzanrou.com/",
        "note": "신치 차이나타운의 유명 중화요리점"
      }
    ],
    "walkablePlaces": [
      {
        "name": "Megane Bridge",
        "category": "attraction",
        "walkingMinutes": 10,
        "distanceMeters": 890,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Megane%20Bridge%20Nagasaki",
        "note": "신치 중화가와 함께 보기 좋은 석조 아치교"
      }
    ]
  },
  {
    "id": "d2-oura-cathedral",
    "day": 2,
    "title": "오우라 천주당",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "일본 국보 서양식 목조 성당을 조용히 관람해요.",
    "visitInfo": [
      "3~10월 08:30~18:00, 마지막 입장 17:30",
      "성인 일반요금 ¥1,000",
      "성당 내부 촬영 금지",
      "방문객 전용 주차장 없음"
    ],
    "mapQuery": "Oura Cathedral Nagasaki",
    "officialUrl": "https://oura-church.jp/guide-en/",
    "ratingSnapshot": {
      "rating": 4.0,
      "reviewCount": 1664,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Oura%20Cathedral%20Nagasaki",
      "asOf": "2026-09-02"
    },
    "walkablePlaces": [
      {
        "name": "Glover Garden",
        "category": "attraction",
        "walkingMinutes": 5,
        "rating": 4.1,
        "reviewCount": 12135,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Glover%20Garden%20Nagasaki",
        "note": "오우라 성당과 함께 보기 좋은 역사 정원",
        "artworkSrc": "/assets/schedule/detail/d2-glover-garden.webp"
      },
      {
        "name": "Nagasaki Confucius Shrine",
        "category": "attraction",
        "walkingMinutes": 10,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Nagasaki%20Confucius%20Shrine",
        "note": "오우라 권역의 중국식 사당"
      }
    ]
  },
  {
    "id": "d2-glover-garden",
    "day": 2,
    "title": "그라바엔",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "나가사키항을 내려다보는 역사 건축 정원이에요.",
    "visitInfo": [
      "서양식 역사 건축물과 나가사키항 전망",
      "운영시간은 방문 전 공식 사이트 확인"
    ],
    "mapQuery": "Glover Garden Nagasaki",
    "officialUrl": "https://glover-garden.jp/",
    "ratingSnapshot": {
      "rating": 4.1,
      "reviewCount": 12135,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Glover%20Garden%20Nagasaki",
      "asOf": "2026-09-02"
    }
  },
  {
    "id": "d2-lunch-nagasaki",
    "day": 2,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "나가사키",
    "summary": "나가사키에서 현지식 점심을 먹어요.",
    "itineraryFacts": [
      "식사: 중식 · 현지식",
      "확정 식당 없음"
    ],
    "mapQuery": "Nagasaki lunch restaurants"
  },
  {
    "id": "d2-move-fukuoka",
    "day": 2,
    "title": "후쿠오카 이동",
    "kind": "move",
    "location": "후쿠오카",
    "summary": "나가사키에서 후쿠오카로 이동해요.",
    "itineraryFacts": [
      "이동 구간: 나가사키 → 후쿠오카",
      "예상 이동시간: 약 2시간",
      "도착 후: 텐진거리 자유시간"
    ],
    "mapQuery": "Tenjin Fukuoka"
  },
  {
    "id": "d2-tenjin-free",
    "day": 2,
    "title": "텐진거리 자유시간",
    "kind": "attraction",
    "location": "텐진",
    "summary": "텐진 지하상가에서 쇼핑과 자유시간을 보내요.",
    "visitInfo": [
      "텐진 지하상가 약 590~600m",
      "약 150개 점포",
      "지하철 텐진·텐진미나미역과 연결"
    ],
    "mapQuery": "Tenjin Chikagai Fukuoka",
    "officialUrl": "https://www.gofukuoka.jp/spots/detail/27127",
    "nearbyFood": [
      {
        "name": "Motsunabe Rakutenchi Tenjin BR",
        "category": "food",
        "rating": 4.7,
        "reviewCount": 20051,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Motsunabe%20Rakutenchi%20Tenjin%20BR",
        "officialUrl": "https://rakutenti.com/",
        "note": "후쿠오카 명물 모츠나베 인기점"
      },
      {
        "name": "Gyukatsu Motomura Fukuoka Parco Branch",
        "category": "food",
        "rating": 4.9,
        "reviewCount": 15206,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Gyukatsu%20Motomura%20Fukuoka%20Parco%20Branch",
        "note": "텐진 PARCO 규카츠 인기점"
      },
      {
        "name": "Kiwamiya Fukuoka Parco Store",
        "category": "food",
        "rating": 4.3,
        "reviewCount": 3302,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Kiwamiya%20Fukuoka%20Parco%20Store",
        "note": "PARCO 지하 함박·고기요리 인기점"
      }
    ]
  },
  {
    "id": "d2-fukuoka-hotel",
    "day": 2,
    "title": "호텔 이동 및 휴식",
    "kind": "hotel",
    "location": "후쿠오카",
    "summary": "호텔로 이동해 체크인하고 쉬어요.",
    "itineraryFacts": [
      "숙소: Best Western Plus Fukuoka Tenjin-minami",
      "체크인 후 휴식",
      "석식 불포함",
      "다음 날 호텔 조식 후 다자이후 일정"
    ],
    "visitInfo": [
      "3 Chome-13-19 Haruyoshi, Chuo Ward, Fukuoka 810-0003",
      "전화 +81 92-718-7700"
    ],
    "mapQuery": "Best Western Plus Fukuoka Tenjin-minami",
    "ratingSnapshot": {
      "rating": 4.1,
      "reviewCount": 760,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Best%20Western%20Plus%20Fukuoka%20Tenjin-minami",
      "asOf": "2026-09-02"
    },
    "walkablePlaces": [
      {
        "name": "Canal City Hakata",
        "category": "shopping",
        "walkingMinutes": 7,
        "rating": 4.2,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Canal%20City%20Hakata",
        "note": "쇼핑·식사를 함께 보기 좋은 복합시설"
      }
    ]
  },
  {
    "id": "d3-hotel-breakfast",
    "day": 3,
    "title": "호텔 조식",
    "kind": "meal",
    "location": "후쿠오카",
    "summary": "조식 후 마지막 날 일정을 준비해요.",
    "itineraryFacts": [
      "식사: 호텔 조식",
      "장소: 후쿠오카 숙소"
    ],
    "mapQuery": "Best Western Plus Fukuoka Tenjin-minami"
  },
  {
    "id": "d3-dazaifu",
    "day": 3,
    "title": "다자이후 텐만구",
    "kind": "attraction",
    "location": "다자이후",
    "summary": "다자이후 텐만구를 참배하고 참도를 둘러봐요.",
    "visitInfo": [
      "다자이후역에서 도보 약 5분",
      "다자이후 주차센터에서 참도까지 도보 약 7분",
      "참도에 우메가에모치 가게 다수"
    ],
    "mapQuery": "Dazaifu Tenmangu Shrine",
    "officialUrl": "https://www.dazaifutenmangu.or.jp/keidaiannai/wheelchair",
    "ratingSnapshot": {
      "rating": 4.5,
      "reviewCount": 43923,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=Dazaifu%20Tenmangu%20Shrine",
      "asOf": "2026-09-02"
    },
    "nearbyFood": [
      {
        "name": "Kasanoya",
        "category": "dessert",
        "rating": 4.4,
        "reviewCount": 1404,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Kasanoya%20Dazaifu",
        "officialUrl": "http://www.kasanoya.com/umegaemochi.html",
        "note": "우메가에모치 대표점"
      },
      {
        "name": "Starbucks Coffee - Dazaifu Tenmangu Shrine Omotesando",
        "category": "cafe",
        "rating": 4.3,
        "reviewCount": 3773,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Starbucks%20Dazaifu%20Tenmangu%20Omotesando",
        "officialUrl": "https://store.starbucks.co.jp/detail-1058/",
        "note": "구마 겐고 목재 격자 디자인 카페"
      },
      {
        "name": "Yasutake",
        "category": "dessert",
        "rating": 4.3,
        "reviewCount": 793,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Yasutake%20Dazaifu%20Umegae%20Mochi",
        "officialUrl": "http://www.umegaemochi.com/",
        "note": "갓 구운 우메가에모치 인기점"
      }
    ],
    "walkablePlaces": [
      {
        "name": "Kyushu National Museum",
        "category": "museum",
        "walkingMinutes": 5,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Kyushu%20National%20Museum",
        "note": "신사와 함께 보기 좋은 실내 문화시설"
      }
    ]
  },
  {
    "id": "d3-lalaport",
    "day": 3,
    "title": "라라포트 후쿠오카",
    "kind": "attraction",
    "location": "후쿠오카",
    "summary": "쇼핑·식사·휴식을 한 건물에서 해결하는 자유시간이에요.",
    "visitInfo": [
      "물판·서비스 10:00~21:00",
      "레스토랑·푸드코트 11:00~22:00",
      "6-23-1 Naka, Hakata-ku, Fukuoka",
      "코인락커·택배카운터·무료 Wi-Fi 안내"
    ],
    "mapQuery": "LaLaport Fukuoka",
    "officialUrl": "https://mitsui-shopping-park.com/en/lalaport/fukuoka/index.html",
    "ratingSnapshot": {
      "rating": 4.3,
      "reviewCount": 9313,
      "sourceLabel": "Google Maps",
      "sourceUrl": "https://www.google.com/maps/search/?api=1&query=LaLaport%20Fukuoka",
      "asOf": "2026-09-02"
    },
    "nearbyFood": [
      {
        "name": "Kamimura Bokujyo LaLaport Fukuoka",
        "category": "food",
        "rating": 4.3,
        "reviewCount": 997,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Kamimura%20Bokujyo%20LaLaport%20Fukuoka",
        "note": "라라포트 내 야키니쿠 식당"
      }
    ],
    "walkablePlaces": [
      {
        "name": "Life-Size RX-93ff ν Gundam Statue",
        "category": "attraction",
        "rating": 4.6,
        "reviewCount": 15266,
        ...GOOGLE_PLACE_RATING_SOURCE,
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Life-Size%20RX-93ff%20Gundam%20Statue%20Fukuoka",
        "sameComplex": true,
        "note": "Forest Park의 실물 크기 건담 동상"
      }
    ]
  },
  {
    "id": "d3-lunch",
    "day": 3,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "후쿠오카",
    "summary": "마지막 날 현지식 점심을 먹어요.",
    "itineraryFacts": [
      "식사: 중식 · 현지식",
      "확정 식당 없음"
    ],
    "mapQuery": "LaLaport Fukuoka restaurants"
  },
  {
    "id": "d3-move-airport",
    "day": 3,
    "title": "후쿠오카공항 이동",
    "kind": "move",
    "location": "공항",
    "summary": "후쿠오카공항 국제선으로 이동해 귀국 수속을 준비해요.",
    "itineraryFacts": [
      "이동 구간: 후쿠오카 시내 → 후쿠오카공항 국제선",
      "예상 이동시간: 약 30분",
      "도착 후: 귀국 수속"
    ],
    "mapQuery": "Fukuoka Airport International Terminal",
    "officialUrl": "https://www.fukuoka-airport.jp/en/"
  },
  {
    "id": "d3-fukuoka-departure",
    "day": 3,
    "title": "후쿠오카공항 출발",
    "kind": "flight",
    "location": "후쿠오카",
    "summary": "인천으로 출발해요.",
    "itineraryFacts": [
      "시간: 17:45",
      "항공편: 제주항공 7C1406",
      "공항: 후쿠오카공항 국제선 3F"
    ],
    "mapQuery": "Fukuoka Airport International Terminal",
    "officialUrl": "https://www.fukuoka-airport.jp/en/flight/flow_int/index.html"
  },
  {
    "id": "d3-incheon-arrival",
    "day": 3,
    "title": "인천국제공항 도착",
    "kind": "flight",
    "location": "인천",
    "summary": "도착 후 가족여행 일정을 마무리해요.",
    "itineraryFacts": [
      "시간: 19:15",
      "항공편: 제주항공 7C1406",
      "공항: 인천국제공항"
    ],
    "mapQuery": "Incheon International Airport",
    "officialUrl": "https://www.airport.kr/"
  }
] as const satisfies readonly ScheduleGuideItem[];

const scheduleGuideById = new Map<ScheduleGuideItemId, ScheduleGuideItem>(
  SCHEDULE_GUIDE_ITEMS.map((item) => [item.id, item]),
);

type ScheduleSupplement = {
  readonly places?: readonly ScheduleNearbyPlace[];
  readonly localPicks?: readonly ScheduleLocalPick[];
};

const BLUE_BOTTLE_COFFEE_TENJIN = {
  name: "Blue Bottle Coffee Fukuoka Tenjin Cafe",
  category: "cafe",
  note: "쇼핑 중 잠깐 앉아 쉬며 커피를 마시기 좋은 카페",
  rating: 4.5,
  reviewCount: 1290,
  ...GOOGLE_PLACE_RATING_SOURCE,
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Blue%20Bottle%20Coffee%20Fukuoka%20Tenjin%20Cafe",
} as const satisfies ScheduleNearbyPlace;

const scheduleSupplements = {
  yanagawa: {
    places: [
      {
        name: "Kabashima Hyouka",
        category: "dessert",
        note: "산책 중 가볍게 먹기 좋은 아이스캔디·아이스크림",
        rating: 4.5,
        reviewCount: 168,
        ...GOOGLE_PLACE_RATING_SOURCE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Kabashima%20Hyouka%20Yanagawa%20Fukuoka",
      },
      {
        name: "Patisserie Sakura",
        category: "dessert",
        note: "아마오·야메 교쿠로 등 후쿠오카 재료를 활용한 디저트",
        rating: 3.17,
        reviewCount: 29,
        ratingSourceLabel: "食べログ",
        ratingAsOf: SCHEDULE_MAPS_SNAPSHOT_DATE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Patisserie%20Sakura%20Yanagawa",
        walkingLabel: "오하나 하선장 기준 도보 약 1분",
        officialUrl: "https://www.yanagawa-net.com/features/5748/",
        sourceUrl: "https://www.yanagawa-net.com/features/5748/",
      },
      {
        name: "83coffee",
        category: "cafe",
        note: "운하 풍경을 보며 핸드드립 커피로 잠깐 쉬기 좋은 카페",
        rating: 4.1,
        reviewCount: 97,
        ...GOOGLE_PLACE_RATING_SOURCE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=83coffee%20Yanagawa%20Fukuoka",
        walkingLabel: "오하나 하선장 기준 도보 약 2분",
        officialUrl: "https://www.yanagawa-net.com/features/5748/",
        sourceUrl: "https://www.yanagawa-net.com/features/5748/",
      },
    ],
  },
  takeo: {
    places: [
      {
        name: "Kyushu Pancake Cafe",
        category: "dessert",
        note: "규슈산 재료 팬케이크와 스페셜티 커피를 즐길 수 있는 카페",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Kyushu%20Pancake%20Cafe%20Takeo%20Children%27s%20Library",
        sameComplex: true,
        officialUrl: "https://takeo.city-library.jp/guide/entry-3552.html",
        sourceUrl: "https://takeo.city-library.jp/guide/entry-3552.html",
      },
    ],
  },
  nagasakiChinatown: {
    places: [
      {
        name: "Shooken Main Store",
        category: "dessert",
        note: "나가사키 전통 카스텔라를 포장하기 좋은 본점",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Shooken%20Main%20Store%20Nagasaki",
        rating: 4.5,
        reviewCount: 1011,
        ...GOOGLE_PLACE_RATING_SOURCE,
        officialUrl: "https://www.discover-nagasaki.com/en/featured-topics/stroll2",
        sourceUrl: "https://www.discover-nagasaki.com/en/featured-topics/stroll2",
      },
    ],
    localPicks: [
      {
        label: "角煮まんじゅう",
        kind: "snack",
        note: "신치 차이나타운에서 가볍게 먹기 좋은 나가사키식 돼지고기 찐빵.",
      },
      {
        label: "よりより",
        kind: "snack",
        note: "중화가에서 찾아보기 좋은 바삭한 꽈배기 모양 중국 과자.",
      },
      {
        label: "カステラ",
        kind: "dessert",
        note: "나가사키 대표 간식으로, 포장하거나 카페에서 쉬며 먹기 좋음.",
      },
    ],
  },
  nagasakiGlover: {
    places: [
      {
        name: "Glover Café",
        category: "cafe",
        note: "커피·사이다·라무네로 쉬기 좋은 오픈카페",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Glover%20Cafe%20Nagasaki",
        walkingLabel: "글로버가든 내부",
        rating: 3.6,
        reviewCount: 31,
        ...GOOGLE_PLACE_RATING_SOURCE,
        officialUrl: "https://glover-garden.jp/activity-and-shop/glover-cafe/",
        sourceUrl: "https://glover-garden.jp/activity-and-shop/glover-cafe/",
      },
    ],
  },
  tenjin: {
    places: [
      {
        name: "Ito King - Tenjin",
        category: "dessert",
        note: "후쿠오카 아마오 딸기 디저트를 가볍게 보기 좋은 곳",
        rating: 4.2,
        reviewCount: 499,
        ...GOOGLE_PLACE_RATING_SOURCE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Ito%20King%20Tenjin%20Fukuoka",
        officialUrl: "https://www.gofukuoka.jp/en/searches?area%5B0%5D=c2116973-0626-4160-b1ad-38f5710508c1&story%5B%5D=spot",
        sourceUrl: "https://www.gofukuoka.jp/en/searches?area%5B0%5D=c2116973-0626-4160-b1ad-38f5710508c1&story%5B%5D=spot",
      },
      {
        name: "I’m donut? Tenjin",
        category: "dessert",
        note: "텐진에서 간단히 사 먹기 좋은 인기 도넛",
        rating: 3.62,
        reviewCount: 821,
        ratingSourceLabel: "食べログ",
        ratingAsOf: SCHEDULE_MAPS_SNAPSHOT_DATE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=I%27m%20donut%20Tenjin%20Fukuoka",
        sourceUrl: "https://tabelog.com/cafe/fukuoka/A4001/A400103/rank/",
      },
      BLUE_BOTTLE_COFFEE_TENJIN,
    ],
  },
  fukuokaHotel: {
    places: [BLUE_BOTTLE_COFFEE_TENJIN],
  },
  dazaifu: {
    localPicks: [
      {
        label: "梅ヶ枝餅",
        kind: "dessert",
        note: "참배길에서 바로 구워 먹기 좋은 다자이후 대표 간식.",
      },
    ],
  },
  lalaport: {
    places: [
      {
        name: "KAKA cheesecake store",
        category: "dessert",
        note: "여행일에도 운영 기간에 포함되는 1F 기간 한정 치즈케이크 매장",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=KAKA%20cheesecake%20store%20LaLaport%20Fukuoka",
        sameComplex: true,
        validThrough: "2026-10-04",
        officialUrl: "https://mitsui-shopping-park.com/ko/lalaport/fukuoka/",
        sourceUrl: "https://mitsui-shopping-park.com/ko/lalaport/fukuoka/",
      },
      {
        name: "PUG LaLaport Fukuoka",
        category: "dessert",
        note: "쿠키·아이스크림과 커피를 함께 즐기기 좋은 1F 스위트",
        rating: 3.04,
        reviewCount: 24,
        ratingSourceLabel: "食べログ",
        ratingAsOf: SCHEDULE_MAPS_SNAPSHOT_DATE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=PUG%20LaLaport%20Fukuoka",
        sameComplex: true,
        officialUrl: "https://mitsui-shopping-park.com/en/lalaport/fukuoka/shopguide/3071741.html",
        sourceUrl: "https://mitsui-shopping-park.com/en/lalaport/fukuoka/shopguide/3071741.html",
      },
      {
        name: "IYEMON CAFE LaLaport Fukuoka",
        category: "cafe",
        note: "말차 라테·말차 소프트·안미츠 등으로 쉬기 좋은 3F 일본차 카페",
        rating: 3.21,
        reviewCount: 75,
        ratingSourceLabel: "食べログ",
        ratingAsOf: SCHEDULE_MAPS_SNAPSHOT_DATE,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=IYEMON%20CAFE%20LaLaport%20Fukuoka",
        sameComplex: true,
        officialUrl: "https://mitsui-shopping-park.com/en/lalaport/fukuoka/shopguide/2098737.html",
        sourceUrl: "https://mitsui-shopping-park.com/en/lalaport/fukuoka/shopguide/2098737.html",
      },
    ],
  },
} as const satisfies Record<string, ScheduleSupplement>;

export const SCHEDULE_GUIDE_SUPPLEMENT_ATTACHMENTS = {
  "d1-lunch-yanagawa": "yanagawa",
  "d1-yanagawa-boat": "yanagawa",
  "d1-takeo-library": "takeo",
  "d2-nagasaki-chinatown": "nagasakiChinatown",
  "d2-glover-garden": "nagasakiGlover",
  "d2-lunch-nagasaki": "nagasakiChinatown",
  "d2-tenjin-free": "tenjin",
  "d2-fukuoka-hotel": "fukuokaHotel",
  "d3-dazaifu": "dazaifu",
  "d3-lalaport": "lalaport",
  "d3-lunch": "lalaport",
} as const satisfies Partial<
  Record<ScheduleGuideItemId, keyof typeof scheduleSupplements>
>;

export const SCHEDULE_GUIDE_FOOD_ATTACHMENTS = {
  "d2-lunch-nagasaki": "d2-nagasaki-chinatown",
  "d3-lunch": "d3-lalaport",
} as const satisfies Partial<Record<ScheduleGuideItemId, ScheduleGuideItemId>>;

export function getScheduleGuideEnrichment(
  item: ScheduleGuideItem,
): ScheduleGuideEnrichment {
  const foodSourceId = SCHEDULE_GUIDE_FOOD_ATTACHMENTS[
    item.id as keyof typeof SCHEDULE_GUIDE_FOOD_ATTACHMENTS
  ];
  const foodSource = foodSourceId
    ? scheduleGuideById.get(foodSourceId)
    : undefined;
  const supplementKey = SCHEDULE_GUIDE_SUPPLEMENT_ATTACHMENTS[
    item.id as keyof typeof SCHEDULE_GUIDE_SUPPLEMENT_ATTACHMENTS
  ];
  const supplement: ScheduleSupplement | undefined = supplementKey
    ? scheduleSupplements[supplementKey]
    : undefined;

  return {
    places: [
      ...(item.nearbyFood ?? []),
      ...(item.walkablePlaces ?? []),
      ...(foodSource?.nearbyFood ?? []).filter(
        (place) => place.category === "food",
      ),
      ...(supplement?.places ?? []),
    ],
    localPicks: supplement?.localPicks ?? [],
  };
}

const VARIABLE_GUIDE_ITEM_IDS = new Set<ScheduleGuideItemId>([
  "d1-fukuoka-arrival",
  "d1-yanagawa-boat",
  "d1-takeo-shrine",
  "d1-takeo-library",
  "d2-nagasaki-chinatown",
  "d2-oura-cathedral",
  "d2-glover-garden",
  "d2-tenjin-free",
  "d3-dazaifu",
  "d3-lalaport",
  "d3-fukuoka-departure",
]);

export const buildGoogleMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const getScheduleDetailArtworkSrc = (
  id: ScheduleGuideItemId,
): ScheduleDetailArtworkSrc => `/assets/schedule/detail/${id}.webp`;

export const getScheduleNearbyFood = (item: ScheduleGuideItem) =>
  (item.nearbyFood ?? []).slice(0, 3);

export const getScheduleWalkablePlaces = (item: ScheduleGuideItem) =>
  (item.walkablePlaces ?? []).slice(0, 3);

export const getScheduleGuideItem = (id: string | null | undefined) =>
  id
    ? scheduleGuideById.get(id as ScheduleGuideItemId)
    : undefined;

export const resolveScheduleGuideDay = (id: string | null | undefined) =>
  getScheduleGuideItem(id)?.day;

export const hasVariableGuideInfo = (
  item: Pick<ScheduleGuideItem, "id" | "visitInfo">,
) => Boolean(item.visitInfo?.length) && VARIABLE_GUIDE_ITEM_IDS.has(item.id);
