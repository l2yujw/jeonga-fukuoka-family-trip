import type { ScheduleDayNo } from "./schedule-visual-assets";

export const SCHEDULE_RESEARCH_DATE = "2026-08-31";
export const SCHEDULE_RESEARCH_DATE_LABEL = `${SCHEDULE_RESEARCH_DATE} 조사 기준`;

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
export type ScheduleRecommendationType =
  | "restaurant"
  | "cafe"
  | "attraction"
  | "food";

export type ScheduleGuideRecommendation = {
  readonly type: ScheduleRecommendationType;
  readonly name: string;
  readonly note: string;
  readonly mapQuery: string;
  readonly officialUrl?: string;
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
  readonly seniorNotes: readonly string[];
  readonly mapQuery: string;
  readonly officialUrl?: string;
  readonly recommendations?: readonly ScheduleGuideRecommendation[];
};

export const SCHEDULE_GUIDE_ITEMS = [
  {
    "id": "d1-incheon-meeting",
    "day": 1,
    "title": "인천국제공항 1터미널 집결",
    "kind": "flight",
    "location": "인천",
    "summary": "가족여행의 출발 집결 지점. 07:00까지 인천공항 제1터미널에서 만나 탑승수속을 준비해요.",
    "itineraryFacts": [
      "집결 07:00",
      "인천국제공항 제1터미널",
      "이후 제주항공 7C1403 탑승 준비"
    ],
    "seniorNotes": [
      "공항 내부 이동거리가 길 수 있으니 화장실과 휴식 시간을 여유 있게 잡아요.",
      "무거운 짐은 카트 사용을 우선하고, 가족끼리 집결 위치를 다시 확인해요."
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
    "summary": "제주항공 7C1403편으로 후쿠오카를 향해 출발해요.",
    "itineraryFacts": [
      "출발 09:30",
      "제주항공 7C1403"
    ],
    "seniorNotes": [
      "탑승구 변경 가능성이 있으니 당일 전광판과 항공사 안내를 우선 확인해요."
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
    "summary": "11:00 후쿠오카공항 도착 후 김해 출발 가족 1명과 합류해 본격적인 일정을 시작해요.",
    "itineraryFacts": [
      "도착 11:00",
      "국제선 도착 후 가족 1명 합류"
    ],
    "seniorNotes": [
      "입국·수하물 수취 시간이 길어질 수 있으니 먼저 화장실과 휴식 여부를 확인해요.",
      "휠체어가 필요하면 공항 안내 카운터에서 도움을 요청할 수 있어요."
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
    "summary": "후쿠오카공항에서 야나가와로 이동해요. 일정표 기준 약 1시간 20분이며 이동 중 간식이 제공돼요.",
    "itineraryFacts": [
      "약 1시간 20분",
      "이동 중 간식 제공"
    ],
    "seniorNotes": [
      "장거리 차량 이동 전 화장실을 먼저 확인해요.",
      "멀미가 있다면 앞좌석·통풍·물 준비를 고려해요."
    ],
    "mapQuery": "Yanagawa Fukuoka Japan"
  },
  {
    "id": "d1-lunch-yanagawa",
    "day": 1,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "야나가와",
    "summary": "야나가와에서 현지식 점심을 먹는 일정이에요. 확정 식당명이 없는 일정이라 주변 추천은 참고용으로만 보여줘요.",
    "itineraryFacts": [
      "점심: 현지식",
      "식당 미지정"
    ],
    "seniorNotes": [
      "정해진 식당이 아니라면 좌식 여부, 대기시간, 화장실 위치를 먼저 확인하면 좋아요."
    ],
    "mapQuery": "Yanagawa restaurants Fukuoka",
    "recommendations": [
      {
        "type": "restaurant",
        "name": "元祖 本吉屋 本店",
        "note": "야나가와 명물 장어 세이로무시로 유명한 340년 이상 전통의 식당. 확정 일정이 아닌 주변 참고 후보예요.",
        "mapQuery": "Ganso Motoyoshiya Main Restaurant Yanagawa",
        "officialUrl": "https://www.crossroadfukuoka.jp/en/spot/10646"
      }
    ]
  },
  {
    "id": "d1-yanagawa-boat",
    "day": 1,
    "title": "야나가와 뱃놀이",
    "kind": "attraction",
    "location": "야나가와",
    "summary": "수로가 발달한 야나가와를 작은 배로 천천히 둘러보는 대표 체험이에요. 공식 관광 안내는 약 1시간, 약 4km의 운항을 소개해요.",
    "visitInfo": [
      "공식 관광 안내 기준 약 1시간",
      "약 4km 수로 체험",
      "여름 풍경을 즐기기 좋은 대표 일정"
    ],
    "seniorNotes": [
      "낮은 배에 타고 내릴 때 균형을 잃지 않도록 한 명씩 천천히 이동해요.",
      "한낮에는 햇빛과 더위가 강할 수 있어 모자·물·부채를 준비해요.",
      "정식 무장애 여부는 이용 선사마다 다를 수 있으니 현장 직원 안내를 우선해요."
    ],
    "mapQuery": "Yanagawa river cruise Fukuoka",
    "officialUrl": "https://www.crossroadfukuoka.jp/en/spot/12901",
    "recommendations": [
      {
        "type": "restaurant",
        "name": "元祖 本吉屋 本店",
        "note": "야나가와 장어 세이로무시 대표 후보.",
        "mapQuery": "Ganso Motoyoshiya Main Restaurant Yanagawa",
        "officialUrl": "https://www.crossroadfukuoka.jp/en/spot/10646"
      },
      {
        "type": "attraction",
        "name": "御花・松濤園 주변",
        "note": "시간 여유가 있을 때 함께 보기 좋은 야나가와 문화권 후보.",
        "mapQuery": "Ohana Yanagawa Fukuoka"
      }
    ]
  },
  {
    "id": "d1-move-takeo",
    "day": 1,
    "title": "다케오 이동",
    "kind": "move",
    "location": "다케오",
    "summary": "야나가와에서 다케오로 이동해요. 일정표 기준 약 1시간 10분이에요.",
    "itineraryFacts": [
      "약 1시간 10분"
    ],
    "seniorNotes": [
      "차량 이동 후 바로 걷는 일정이 이어지므로 도착 직후 잠깐 몸을 풀고 시작해요."
    ],
    "mapQuery": "Takeo Saga Japan"
  },
  {
    "id": "d1-takeo-shrine",
    "day": 1,
    "title": "다케오 신사",
    "kind": "attraction",
    "location": "다케오",
    "summary": "미후네산 동쪽 기슭에 있는 유서 깊은 신사예요. 신사 안쪽에는 수령 3,000년 이상으로 소개되는 다케오 대녹나무가 있어요.",
    "visitInfo": [
      "다케오 관광협회: 수령 3,000년 이상의 대녹나무",
      "대녹나무 코스 공식 안내 약 30~40분",
      "다케오 도서관이 가까움"
    ],
    "seniorNotes": [
      "신사와 대녹나무 구간은 야외 보행이 포함돼요. 무리하면 대녹나무까지 전부 걷지 않고 중간에서 쉬어가요.",
      "계단·경사 상황은 현장 컨디션을 우선 확인해요."
    ],
    "mapQuery": "Takeo Shrine Saga",
    "officialUrl": "https://www.takeo-kk.net/sightseeing/001294.php",
    "recommendations": [
      {
        "type": "attraction",
        "name": "武雄市図書館・歴史資料館",
        "note": "신사에서 가까워 같은 일정으로 묶기 좋은 실내 휴식형 명소.",
        "mapQuery": "Takeo City Library",
        "officialUrl": "https://www.takeo-kk.net/sightseeing/001297"
      }
    ]
  },
  {
    "id": "d1-takeo-library",
    "day": 1,
    "title": "다케오 도서관",
    "kind": "attraction",
    "location": "다케오",
    "summary": "약 25만 권의 장서와 높은 서가 공간으로 알려진 다케오의 대표 복합문화 공간이에요. 내부에 카페도 있어 쉬어가기 좋아요.",
    "visitInfo": [
      "관광협회 안내: 09:00~21:00, 연중무휴",
      "약 25만 권",
      "카페 있음",
      "무료 주차 190대 안내"
    ],
    "seniorNotes": [
      "실내 일정이라 더위·비를 피하며 쉬기 좋아요.",
      "구조화된 장소 정보에는 휠체어 이용 가능한 출입구와 주차가 표시돼 있어요."
    ],
    "mapQuery": "Takeo City Library Saga",
    "officialUrl": "https://www.takeo-kk.net/sightseeing/001297",
    "recommendations": [
      {
        "type": "cafe",
        "name": "도서관 내 카페",
        "note": "이동을 추가하지 않고 바로 쉴 수 있는 가장 편한 선택.",
        "mapQuery": "Takeo City Library cafe"
      },
      {
        "type": "cafe",
        "name": "九州パンケーキカフェ 武雄市こども図書館店",
        "note": "인접 어린이도서관 2층의 팬케이크 카페.",
        "mapQuery": "Kyushu Pancake Cafe Takeo Children's Library",
        "officialUrl": "https://www.takeo-kk.net/sightseeing/001297"
      }
    ]
  },
  {
    "id": "d1-move-ureshino",
    "day": 1,
    "title": "우레시노 이동",
    "kind": "move",
    "location": "우레시노",
    "summary": "다케오에서 우레시노 숙소로 이동해요. 일정표 기준 약 30분이에요.",
    "itineraryFacts": [
      "약 30분"
    ],
    "seniorNotes": [
      "도착 후 온천 일정이 있으니 차량에서 내릴 때 서두르지 말고 객실에서 잠깐 쉬어도 좋아요."
    ],
    "mapQuery": "Ureshino Saga Japan"
  },
  {
    "id": "d1-ureshino-hotel",
    "day": 1,
    "title": "오에도 온센 모노가타리 우레시노칸",
    "kind": "hotel",
    "location": "우레시노",
    "summary": "첫날 확정 숙소. 체크인 후 호텔식 뷔페 저녁과 온천욕으로 하루를 마무리해요.",
    "itineraryFacts": [
      "Ooedo Onsen Monogatari Ureshinokan",
      "석식: 호텔식 뷔페",
      "온천욕"
    ],
    "visitInfo": [
      "Otsu-2091 Ureshinomachi Oaza Shimojuku, Ureshino, Saga 843-0301",
      "전화 +81 50-3615-3456"
    ],
    "seniorNotes": [
      "온천 바닥은 젖으면 미끄러울 수 있으니 이동을 천천히 해요.",
      "탈의실과 욕탕 사이 이동이 부담되면 가족이 함께 이동해요.",
      "목욕 전후 수분 섭취와 휴식을 충분히 해요."
    ],
    "mapQuery": "Ooedo Onsen Monogatari Ureshinokan"
  },
  {
    "id": "d2-hotel-breakfast",
    "day": 2,
    "title": "호텔 조식",
    "kind": "meal",
    "location": "우레시노",
    "summary": "우레시노 숙소에서 호텔식 조식 후 나가사키 일정으로 출발해요.",
    "itineraryFacts": [
      "조식: 호텔식"
    ],
    "seniorNotes": [
      "이동 전에 물과 상비약을 챙기고 화장실을 다녀와요."
    ],
    "mapQuery": "Ooedo Onsen Monogatari Ureshinokan"
  },
  {
    "id": "d2-move-nagasaki",
    "day": 2,
    "title": "나가사키 이동",
    "kind": "move",
    "location": "나가사키",
    "summary": "우레시노에서 나가사키로 이동해요. 일정표 기준 약 50분이에요.",
    "itineraryFacts": [
      "약 50분"
    ],
    "seniorNotes": [
      "도착 후 도심 보행이 이어지므로 차량에서 충분히 쉬어요."
    ],
    "mapQuery": "Nagasaki Japan"
  },
  {
    "id": "d2-nagasaki-chinatown",
    "day": 2,
    "title": "나가사키 차이나타운",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "일본 3대 차이나타운 중 하나인 나가사키 신치 중화가예요. 공식 관광 안내는 십자형 거리 전체가 약 250m이고 약 40개의 중화요리점과 상점이 모여 있다고 소개해요.",
    "visitInfo": [
      "공식 관광 안내: 가로세로 약 250m",
      "약 40개 중화요리점·상점"
    ],
    "seniorNotes": [
      "비교적 압축된 도심 구간이지만 점심시간에는 혼잡할 수 있어요.",
      "9월 낮에는 더울 수 있으니 실내 식당이나 상점에서 중간중간 쉬어요."
    ],
    "mapQuery": "Nagasaki Shinchi Chinatown",
    "officialUrl": "https://www.discover-nagasaki.com/ko/sightseeing/111",
    "recommendations": [
      {
        "type": "restaurant",
        "name": "四海樓",
        "note": "나가사키 짬뽕의 기원으로 공식 관광 안내에서 소개되는 식당. 오우라 천주당·글로버가든 권역과 함께 보기 편해요.",
        "mapQuery": "Shikairo Nagasaki",
        "officialUrl": "https://www.discover-nagasaki.com/en/gourmet/133"
      },
      {
        "type": "restaurant",
        "name": "江山楼 中華街新館",
        "note": "신치 중화가 안에서 찾기 쉬운 중화요리 후보. 확정 식당은 아니에요.",
        "mapQuery": "Kozanro Chukagaishinkan Nagasaki"
      }
    ]
  },
  {
    "id": "d2-oura-cathedral",
    "day": 2,
    "title": "오우라 천주당",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "일본의 국보이자 나가사키의 대표적인 서양식 성당이에요. 내부는 기도 공간이므로 조용한 관람이 필요해요.",
    "visitInfo": [
      "3~10월 08:30~18:00, 마지막 입장 17:30",
      "성인 일반요금 ¥1,000",
      "성당 내부 촬영 금지",
      "방문객 전용 주차장 없음"
    ],
    "seniorNotes": [
      "중요: 정면 광장에서 성당 입구까지 긴 계단이 있어요.",
      "공식 사이트는 계단 외 진입 방법이 없으며 휠체어 이용자는 긴 계단 이동에 도움을 받아야 한다고 안내해요.",
      "어르신 상태가 좋지 않으면 외관 중심 관람 또는 일행 분리 관람을 고려해요."
    ],
    "mapQuery": "Oura Cathedral Nagasaki",
    "officialUrl": "https://oura-church.jp/guide-en/",
    "recommendations": [
      {
        "type": "restaurant",
        "name": "四海樓",
        "note": "짬뽕으로 유명하고 오우라·글로버 권역에 있어 식사 후보로 보기 좋아요.",
        "mapQuery": "Shikairo Nagasaki"
      },
      {
        "type": "attraction",
        "name": "グラバー園",
        "note": "다음 일정으로 바로 연결되는 대표 명소.",
        "mapQuery": "Glover Garden Nagasaki",
        "officialUrl": "https://glover-garden.jp/"
      }
    ]
  },
  {
    "id": "d2-glover-garden",
    "day": 2,
    "title": "그라바엔",
    "kind": "attraction",
    "location": "나가사키",
    "summary": "나가사키항을 내려다보는 언덕 위에 서양식 역사 건축물이 모여 있는 정원이에요.",
    "visitInfo": [
      "서양식 역사 건축물과 나가사키항 전망",
      "여름철 운영시간은 방문 직전 공식 사이트 재확인 필요"
    ],
    "seniorNotes": [
      "언덕과 돌바닥, 경사가 있어 어르신에게는 이동 경로 선택이 중요해요.",
      "공식 안내는 다목적 화장실, 휴게실, 전동 휠체어 무료 대여, 무빙워크·휠체어 경사로 정보를 제공해요.",
      "휠체어·어르신 방문은 Glover Sky Road/엘리베이터 쪽에서 들어가 내리막 위주로 보는 동선을 우선 검토해요."
    ],
    "mapQuery": "Glover Garden Nagasaki",
    "officialUrl": "https://glover-garden.jp/",
    "recommendations": [
      {
        "type": "cafe",
        "name": "園内カフェ・休憩スポット",
        "note": "경사 이동 중 쉬기 위해 정원 내 카페·휴게 공간을 적극 활용해요.",
        "mapQuery": "Glover Garden cafe Nagasaki"
      },
      {
        "type": "attraction",
        "name": "軍艦島デジタルミュージアム",
        "note": "오우라·글로버 권역의 실내 선택지.",
        "mapQuery": "Gunkanjima Digital Museum Nagasaki"
      }
    ]
  },
  {
    "id": "d2-lunch-nagasaki",
    "day": 2,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "나가사키",
    "summary": "나가사키에서 현지식 점심. 확정 식당명은 없으므로 주변 후보를 참고용으로만 제공해요.",
    "itineraryFacts": [
      "점심: 현지식",
      "식당 미지정"
    ],
    "seniorNotes": [
      "계단이 많은 오후 일정 전이라 가능하면 의자석과 화장실이 편한 식당을 우선해요."
    ],
    "mapQuery": "Nagasaki lunch restaurants",
    "recommendations": [
      {
        "type": "restaurant",
        "name": "四海樓",
        "note": "나가사키 짬뽕 기원으로 공식 관광 사이트에 소개되는 대표 후보.",
        "mapQuery": "Shikairo Nagasaki",
        "officialUrl": "https://www.discover-nagasaki.com/en/gourmet/133"
      }
    ]
  },
  {
    "id": "d2-move-fukuoka",
    "day": 2,
    "title": "후쿠오카 이동",
    "kind": "move",
    "location": "후쿠오카",
    "summary": "나가사키에서 후쿠오카로 이동해요. 일정표 기준 약 2시간이에요.",
    "itineraryFacts": [
      "약 2시간"
    ],
    "seniorNotes": [
      "이번 여행에서 긴 차량 이동 중 하나라 중간 휴식 가능 여부를 가이드와 확인하면 좋아요.",
      "목·허리 부담이 있으면 쿠션과 물을 준비해요."
    ],
    "mapQuery": "Tenjin Fukuoka"
  },
  {
    "id": "d2-tenjin-free",
    "day": 2,
    "title": "텐진거리 자유시간",
    "kind": "attraction",
    "location": "텐진",
    "summary": "규슈 최대급 도심 상권인 텐진에서 자유시간을 보내요. 지하상가는 약 590~600m에 150여 점포가 연결돼 있어 더위나 비를 피하기 좋아요.",
    "visitInfo": [
      "텐진 지하상가 약 590~600m",
      "약 150개 점포",
      "지하철 텐진·텐진미나미역과 연결"
    ],
    "seniorNotes": [
      "상권이 넓어 가족끼리 헤어지기 쉬우니 복귀 장소와 시간을 먼저 정해요.",
      "어르신은 지하상가·백화점·카페 중심으로 짧게 움직이고 무리한 전체 순회를 피하는 게 좋아요."
    ],
    "mapQuery": "Tenjin Chikagai Fukuoka",
    "officialUrl": "https://www.gofukuoka.jp/spots/detail/27127",
    "recommendations": [
      {
        "type": "attraction",
        "name": "天神地下街",
        "note": "날씨 영향을 덜 받는 대표 쇼핑 동선.",
        "mapQuery": "Tenjin Chikagai Fukuoka",
        "officialUrl": "https://www.gofukuoka.jp/spots/detail/27127"
      },
      {
        "type": "attraction",
        "name": "警固神社・警固公園",
        "note": "쇼핑 중 잠깐 바깥 공기를 쐬기 좋은 근거리 선택지.",
        "mapQuery": "Kego Shrine Fukuoka",
        "officialUrl": "https://www.gofukuoka.jp/en/route/detail/e1fc570d-185b-4268-92fb-011fae401d09"
      },
      {
        "type": "attraction",
        "name": "ACROS福岡・天神中央公園",
        "note": "공식 텐진 추천 코스에 포함되는 휴식·산책 후보.",
        "mapQuery": "ACROS Fukuoka",
        "officialUrl": "https://www.gofukuoka.jp/en/route/detail/e1fc570d-185b-4268-92fb-011fae401d09"
      }
    ]
  },
  {
    "id": "d2-fukuoka-hotel",
    "day": 2,
    "title": "호텔 이동 및 휴식",
    "kind": "hotel",
    "location": "후쿠오카",
    "summary": "둘째 날 확정 숙소인 베스트 웨스턴 플러스 후쿠오카 텐진 미나미로 이동해 쉬어요. 저녁은 여행상품에 포함되지 않아요.",
    "itineraryFacts": [
      "Best Western Plus Fukuoka Tenjin-minami",
      "석식 불포함"
    ],
    "visitInfo": [
      "3 Chome-13-19 Haruyoshi, Chuo Ward, Fukuoka 810-0003",
      "전화 +81 92-718-7700"
    ],
    "seniorNotes": [
      "자유시간 뒤 피곤할 수 있으니 숙소 복귀 후 무리한 추가 이동은 피하는 편이 좋아요."
    ],
    "mapQuery": "Best Western Plus Fukuoka Tenjin-minami"
  },
  {
    "id": "d3-hotel-breakfast",
    "day": 3,
    "title": "호텔 조식",
    "kind": "meal",
    "location": "후쿠오카",
    "summary": "후쿠오카 숙소에서 호텔식 조식 후 마지막 날 일정을 준비해요.",
    "itineraryFacts": [
      "조식: 호텔식"
    ],
    "seniorNotes": [
      "귀국일까지 이동이 이어지므로 여권·휴대폰·상비약을 아침에 한 번 확인해요."
    ],
    "mapQuery": "Best Western Plus Fukuoka Tenjin-minami"
  },
  {
    "id": "d3-dazaifu",
    "day": 3,
    "title": "다자이후 텐만구",
    "kind": "attraction",
    "location": "다자이후",
    "summary": "학문의 신 스가와라노 미치자네를 모시는 대표 신사예요. 참배길에는 기념품점과 우메가에모치 가게가 이어져 있어요.",
    "visitInfo": [
      "다자이후역에서 도보 약 5분",
      "다자이후 주차센터에서 참도까지 도보 약 7분",
      "참도에 우메가에모치 가게 다수"
    ],
    "seniorNotes": [
      "공식 사이트에서 무료 휠체어 대여를 안내해요.",
      "공식 지도에 단차가 없는 휠체어 참배 동선이 별도로 표시돼 있어요.",
      "경내 화장실 5곳 모두 휠체어 대응으로 안내되고, 휴게실 입구에도 경사로가 있어요."
    ],
    "mapQuery": "Dazaifu Tenmangu Shrine",
    "officialUrl": "https://www.dazaifutenmangu.or.jp/keidaiannai/wheelchair",
    "recommendations": [
      {
        "type": "food",
        "name": "梅ヶ枝餅",
        "note": "참도에 약 30곳의 가게가 있는 다자이후 대표 간식. 가게별 맛 비교도 가능해요.",
        "mapQuery": "Umegae Mochi Dazaifu",
        "officialUrl": "https://www.crossroadfukuoka.jp/en/spot/11380"
      },
      {
        "type": "cafe",
        "name": "スターバックス コーヒー 太宰府天満宮表参道店",
        "note": "건축가 구마 겐고의 목조 디자인으로 공식 관광 사이트에서도 소개돼요.",
        "mapQuery": "Starbucks Coffee Dazaifu Tenmangu Omotesando"
      },
      {
        "type": "cafe",
        "name": "笠乃家",
        "note": "우메가에모치·차를 쉬면서 먹기 좋은 참도 후보.",
        "mapQuery": "Kasanoya Dazaifu",
        "officialUrl": "https://www.crossroadfukuoka.jp/en/inbound-shop/15318"
      },
      {
        "type": "attraction",
        "name": "九州国立博物館",
        "note": "공식 추천 코스에서 신사와 도보 약 5분으로 소개되는 실내 문화시설.",
        "mapQuery": "Kyushu National Museum",
        "officialUrl": "https://gofukuoka.jp/en/route/detail/b52dd2dd-a009-4291-ae76-7bff8f61144a"
      }
    ]
  },
  {
    "id": "d3-lalaport",
    "day": 3,
    "title": "라라포트 후쿠오카",
    "kind": "attraction",
    "location": "후쿠오카",
    "summary": "쇼핑·식사·휴식이 한 건물에서 가능한 대형 복합시설. 여행 마지막 날 더위나 비를 피하며 쉬기 좋은 일정이에요.",
    "visitInfo": [
      "물판·서비스 10:00~21:00",
      "레스토랑·푸드코트 11:00~22:00",
      "6-23-1 Naka, Hakata-ku, Fukuoka",
      "코인락커·택배카운터·무료 Wi-Fi 안내"
    ],
    "seniorNotes": [
      "대형 시설이라 전부 보려 하지 말고 목적 매장과 식사 장소만 정해서 움직여요.",
      "공식 서비스 안내에 휠체어 우선 화장실·주차장 등 장애인 지원 시설이 별도로 정리돼 있어요.",
      "실내 냉방 공간에서 충분히 쉬었다 공항으로 이동하기 좋아요."
    ],
    "mapQuery": "LaLaport Fukuoka",
    "officialUrl": "https://mitsui-shopping-park.com/en/lalaport/fukuoka/index.html",
    "recommendations": [
      {
        "type": "food",
        "name": "館内レストラン・フードコート",
        "note": "중식 장소가 확정되지 않았다면 이동을 추가하지 않는 가장 편한 선택. 점포별 영업시간은 당일 확인해요.",
        "mapQuery": "LaLaport Fukuoka food court"
      }
    ]
  },
  {
    "id": "d3-lunch",
    "day": 3,
    "title": "중식 · 현지식",
    "kind": "meal",
    "location": "후쿠오카",
    "summary": "마지막 날 점심은 현지식으로 잡혀 있지만 식당은 확정되지 않았어요. 일정상 라라포트 내부 또는 이동 동선의 식사를 참고 후보로 볼 수 있어요.",
    "itineraryFacts": [
      "점심: 현지식",
      "확정 식당 없음"
    ],
    "seniorNotes": [
      "공항 이동 전 식사라 너무 긴 대기나 먼 이동은 피하는 게 좋아요."
    ],
    "mapQuery": "LaLaport Fukuoka restaurants",
    "recommendations": [
      {
        "type": "food",
        "name": "ららぽーと福岡 レストラン・フードコート",
        "note": "공식 시설 운영 기준 11:00~22:00. 개별 점포는 시간 차이가 있을 수 있어요.",
        "mapQuery": "LaLaport Fukuoka food court",
        "officialUrl": "https://mitsui-shopping-park.com/en/lalaport/fukuoka/hour/"
      }
    ]
  },
  {
    "id": "d3-move-airport",
    "day": 3,
    "title": "후쿠오카공항 이동",
    "kind": "move",
    "location": "공항",
    "summary": "라라포트/후쿠오카 시내에서 후쿠오카공항 국제선으로 이동해 귀국 수속을 준비해요. 일정표 기준 약 30분이에요.",
    "itineraryFacts": [
      "약 30분",
      "국제선 출발"
    ],
    "seniorNotes": [
      "귀국편은 수속·보안검색 시간을 고려해 관광지에서 출발을 늦추지 않아요.",
      "도착 즉시 화장실과 체크인 카운터 위치를 먼저 확인하면 좋아요."
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
    "summary": "17:45 제주항공 7C1406편으로 인천으로 출발해요.",
    "itineraryFacts": [
      "출발 17:45",
      "제주항공 7C1406"
    ],
    "visitInfo": [
      "국제선 체크인 카운터 3F"
    ],
    "seniorNotes": [
      "공식 공항 안내는 혼잡 시 수속에 시간이 걸릴 수 있으므로 여유 있는 체크인을 권장해요.",
      "국제선 3F 안내데스크에서 공항용 휠체어 대여 안내를 받을 수 있어요."
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
    "summary": "19:15 인천국제공항에 도착하며 가족여행 공식 일정이 끝나요.",
    "itineraryFacts": [
      "도착 19:15",
      "가족여행 마무리"
    ],
    "seniorNotes": [
      "입국·수하물 수취 후 귀가 교통편까지 이동거리가 남으니 마지막까지 천천히 이동해요."
    ],
    "mapQuery": "Incheon International Airport",
    "officialUrl": "https://www.airport.kr/"
  }
] as const satisfies readonly ScheduleGuideItem[];

const scheduleGuideById = new Map<ScheduleGuideItemId, ScheduleGuideItem>(
  SCHEDULE_GUIDE_ITEMS.map((item) => [item.id, item]),
);

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

export const getScheduleGuideItem = (id: string | null | undefined) =>
  id
    ? scheduleGuideById.get(id as ScheduleGuideItemId)
    : undefined;

export const resolveScheduleGuideDay = (id: string | null | undefined) =>
  getScheduleGuideItem(id)?.day;

export const hasVariableGuideInfo = (
  item: Pick<ScheduleGuideItem, "id" | "visitInfo">,
) => Boolean(item.visitInfo?.length) && VARIABLE_GUIDE_ITEM_IDS.has(item.id);
