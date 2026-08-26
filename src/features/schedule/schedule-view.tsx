"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { scheduleDays, type ScheduleItemType } from "./schedule-data";

const typeLabels: Record<ScheduleItemType, string> = {
  flight: "항공",
  move: "이동",
  sightseeing: "관광",
  meal: "식사",
  hotel: "숙소",
  optional: "선택",
};

const typeTones: Record<ScheduleItemType, "neutral" | "primary" | "sage"> = {
  flight: "primary",
  move: "neutral",
  sightseeing: "sage",
  meal: "sage",
  hotel: "primary",
  optional: "neutral",
};

const formatDate = (date: string) => date.slice(5).replace("-", ".");

export function ScheduleView() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = scheduleDays[selectedDayIndex];

  return (
    <>
      <nav aria-label="여행 날짜 선택" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1 shadow-card">
        {scheduleDays.map((day, index) => {
          const selected = index === selectedDayIndex;

          return (
            <button
              key={day.dayNo}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDayIndex(index)}
              className={`tap-target min-w-0 rounded-md px-1 py-2 text-center leading-tight transition-colors ${
                selected ? "bg-accent-primary text-white shadow-card" : "text-text-secondary hover:bg-background hover:text-text-primary"
              }`}
            >
              <span className="block text-caption font-bold">DAY {day.dayNo}</span>
              <span className="mt-0.5 block text-xs font-medium">{formatDate(day.date)} {day.weekday}</span>
            </button>
          );
        })}
      </nav>

      <section className="mt-7" aria-labelledby="selected-day-title">
        <p className="text-caption font-bold tracking-[0.14em] text-accent-primary">DAY {selectedDay.dayNo}</p>
        <h2 id="selected-day-title" className="font-editorial mt-1 text-section font-semibold">
          {formatDate(selectedDay.date)} {selectedDay.weekday}요일
        </h2>
        <p className="mt-1 break-keep text-sm text-text-secondary">{selectedDay.routeSummary}</p>

        <ol className="mt-5 space-y-3">
          {selectedDay.items.map((item, index) => {
            const isMove = item.type === "move";

            return (
              <li key={`${item.title}-${index}`} className="relative pl-6">
                {index < selectedDay.items.length - 1 && (
                  <span aria-hidden="true" className="absolute top-5 bottom-[-1.25rem] left-[6px] border-l border-dashed border-accent-primary/30" />
                )}
                <span
                  aria-hidden="true"
                  className={`absolute top-5 left-0 size-[13px] rounded-pill border-2 border-background ${isMove ? "bg-line" : "bg-accent-primary"}`}
                />
                <Card
                  variant={isMove ? "outlined" : "default"}
                  className={`px-4 py-3.5 ${isMove ? "border-dashed text-text-secondary" : ""} ${item.type === "optional" ? "border-dashed" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTones[item.type]}>{typeLabels[item.type]}</Badge>
                    <span className="text-caption font-semibold text-text-secondary">{item.location}</span>
                    {item.timeLabel && <span className="text-caption font-semibold">{item.timeLabel}</span>}
                  </div>
                  <h3 className={`mt-2 break-keep [text-wrap:balance] font-semibold ${isMove ? "text-sm leading-snug" : "font-editorial text-lg leading-snug"}`}>{item.title}</h3>
                  {item.description && <p className="mt-1 break-keep text-sm leading-relaxed text-text-secondary">{item.description}</p>}
                  {item.statusLabel && (
                    <p className="mt-2 inline-flex min-h-7 items-center rounded-pill border border-accent-primary/25 px-3 py-1 text-caption font-semibold text-accent-primary">
                      {item.statusLabel}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
