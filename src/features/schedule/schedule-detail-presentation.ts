import {
  getScheduleGuideEnrichment,
  type ScheduleGuideItem,
  type ScheduleGuideKind,
  type ScheduleLocalPick,
  type ScheduleNearbyCategory,
  type ScheduleNearbyPlace,
} from "./schedule-guide-data";

export type SchedulePlaceDisclosureKey =
  | "food"
  | "snack"
  | "cafe"
  | "walkable";
export type ScheduleDisclosureKey =
  | SchedulePlaceDisclosureKey
  | "rating"
  | "official";

export type ScheduleDetailDisclosure =
  | {
      readonly key: SchedulePlaceDisclosureKey;
      readonly label: string;
      readonly kind: "places";
      readonly places: readonly ScheduleNearbyPlace[];
      readonly localPicks: readonly ScheduleLocalPick[];
    }
  | {
      readonly key: "rating";
      readonly label: "평점·리뷰";
      readonly kind: "rating";
      readonly rating: NonNullable<ScheduleGuideItem["ratingSnapshot"]>;
    }
  | {
      readonly key: "official";
      readonly label: "공식 정보";
      readonly kind: "official";
      readonly url: string;
    };

export type ScheduleDetailPresentation = {
  readonly layout: "sparse" | "rich";
  readonly coreTitle: string;
  readonly coreFacts: readonly string[];
  readonly disclosures: readonly ScheduleDetailDisclosure[];
  readonly defaultOpenDisclosure?: ScheduleDisclosureKey;
  readonly hasRecommendations: boolean;
};

const coreTitles: Record<ScheduleGuideKind, string> = {
  flight: "항공 핵심",
  move: "이동 정보",
  meal: "식사 정보",
  attraction: "방문 정보",
  hotel: "숙소 정보",
};

const placeGroups = [
  { key: "food", label: "먹거리", categories: ["food"] },
  { key: "snack", label: "간식·디저트", categories: ["dessert"] },
  { key: "cafe", label: "카페·휴식", categories: ["cafe"] },
  {
    key: "walkable",
    label: "같이 둘러보기",
    categories: ["attraction", "museum", "shopping"],
  },
] as const satisfies readonly {
  key: SchedulePlaceDisclosureKey;
  label: string;
  categories: readonly ScheduleNearbyCategory[];
}[];

export function formatSchedulePlaceRating(
  place: ScheduleNearbyPlace,
): string | undefined {
  if (
    !place.ratingSourceLabel ||
    (place.rating === undefined && place.reviewCount === undefined)
  ) {
    return undefined;
  }

  const reviews =
    place.reviewCount === undefined
      ? undefined
      : `리뷰 ${place.reviewCount.toLocaleString("ko-KR")}`;
  if (place.ratingSourceLabel === "食べログ") {
    return [
      place.rating === undefined
        ? "食べログ"
        : `食べログ ${place.rating.toFixed(2)}`,
      reviews,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    place.rating === undefined ? undefined : `★ ${place.rating.toFixed(1)}`,
    reviews,
    "Google Maps",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildScheduleDetailPresentation(
  item: ScheduleGuideItem,
): ScheduleDetailPresentation {
  const { places, localPicks } = getScheduleGuideEnrichment(item);
  const placeDisclosures = placeGroups.flatMap((group) => {
    const grouped = places
      .filter((place) =>
        (group.categories as readonly ScheduleNearbyCategory[]).includes(
          place.category,
        ),
      )
      .slice(0, 3);
    const groupedLocalPicks =
      group.key === "snack"
        ? localPicks.slice(0, Math.max(0, 3 - grouped.length))
        : [];
    return grouped.length || groupedLocalPicks.length
      ? [
          {
            ...group,
            kind: "places" as const,
            places: grouped,
            localPicks: groupedLocalPicks,
          },
        ]
      : [];
  });
  const disclosures: ScheduleDetailDisclosure[] = [...placeDisclosures];

  if (item.ratingSnapshot) {
    disclosures.push({
      key: "rating",
      label: "평점·리뷰",
      kind: "rating",
      rating: item.ratingSnapshot,
    });
  }
  if (item.officialUrl) {
    disclosures.push({
      key: "official",
      label: "공식 정보",
      kind: "official",
      url: item.officialUrl,
    });
  }

  return {
    layout:
      item.kind === "attraction" || item.kind === "hotel" ? "rich" : "sparse",
    coreTitle: coreTitles[item.kind],
    coreFacts: [...(item.itineraryFacts ?? []), ...(item.visitInfo ?? [])],
    disclosures,
    defaultOpenDisclosure:
      item.kind === "meal" ? placeDisclosures.at(0)?.key : undefined,
    hasRecommendations: placeDisclosures.length > 0,
  };
}
