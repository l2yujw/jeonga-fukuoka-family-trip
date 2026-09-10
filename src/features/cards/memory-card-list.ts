export const CARD_TRIP_TIMEZONE = "Asia/Tokyo";
export const CARD_DATE_FILTERS = ["all", "2026-09-11", "2026-09-12", "2026-09-13"] as const;
export type CardDateFilter = typeof CARD_DATE_FILTERS[number];
export type CardSort = "newest" | "oldest";

const tripDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARD_TRIP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function filterSavedCards<T extends { id: string; createdAt: string }>(cards: readonly T[], date: CardDateFilter, sort: CardSort) {
  return cards.filter(card => date === "all" || tripDay.format(new Date(card.createdAt)) === date)
    .sort((a, b) => (sort === "newest" ? -1 : 1) * (Date.parse(a.createdAt) - Date.parse(b.createdAt)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
