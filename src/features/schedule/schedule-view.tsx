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

const typeMarks: Record<ScheduleItemType, string> = {
  flight: "✈︎",
  move: "",
  sightseeing: "◇",
  meal: "○",
  hotel: "▣",
  optional: "+",
};

const formatDate = (date: string) => date.slice(5).replace("-", ".");

export function ScheduleView() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = scheduleDays[selectedDayIndex];

  return (
    <>
      <nav aria-label="여행 날짜 선택" className="schedule-tabs grid grid-cols-3 gap-1 border-b border-text-primary/15 px-1">
        {scheduleDays.map((day, index) => {
          const selected = index === selectedDayIndex;

          return (
            <button
              key={day.dayNo}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDayIndex(index)}
              className={`tap-target schedule-tab min-w-0 px-1 py-3 text-center leading-tight transition-colors ${
                selected ? "schedule-tab--selected text-accent-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span className="block text-caption font-bold">DAY {day.dayNo}</span>
              <span className="mt-0.5 block text-xs font-medium">{formatDate(day.date)} {day.weekday}</span>
            </button>
          );
        })}
      </nav>

      <section className="mt-8" aria-labelledby="selected-day-title">
        <p className="text-[0.62rem] font-bold tracking-[0.22em] text-accent-primary">CHAPTER · DAY {selectedDay.dayNo}</p>
        <h2 id="selected-day-title" className="font-editorial mt-1 text-[1.55rem] font-semibold tracking-[-0.03em]">
          {formatDate(selectedDay.date)} {selectedDay.weekday}요일
        </h2>
        <div className="schedule-route-note relative mt-4 overflow-hidden rounded-sm border border-[#d7c8b7] bg-surface px-5 py-5 shadow-card">
          <span aria-hidden="true" className="home-tape absolute -top-1 left-1/2 -translate-x-1/2 rotate-1" />
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="grid size-12 shrink-0 rotate-[-5deg] place-items-center rounded-full border border-dashed border-accent-primary/50 font-editorial text-xs font-bold leading-none text-accent-primary">
              D{selectedDay.dayNo}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.6rem] font-bold tracking-[0.2em] text-accent-secondary">TODAY&apos;S ROUTE NOTE</p>
              <p className="font-editorial mt-2 break-keep text-[1.05rem] font-semibold leading-relaxed">{selectedDay.routeSummary}</p>
            </div>
          </div>
          <div aria-hidden="true" className="mt-4 flex items-center gap-2 pl-16 text-accent-primary/50">
            <span className="size-1.5 rounded-full bg-current" />
            <span className="flex-1 border-t border-dashed border-current" />
            <span className="font-handwritten rotate-[-8deg] text-xs">let&apos;s go ↗</span>
          </div>
        </div>

        <ol className="mt-7 space-y-3">
          {selectedDay.items.map((item, index) => {
            const isMove = item.type === "move";

            return (
              <li key={`${item.title}-${index}`} className={`relative pl-9 ${isMove ? "py-0.5" : ""}`}>
                {index < selectedDay.items.length - 1 && (
                  <span aria-hidden="true" className="absolute top-7 bottom-[-1.5rem] left-[13px] border-l border-dashed border-accent-primary/28" />
                )}
                <span
                  aria-hidden="true"
                  className={`absolute grid place-items-center rounded-pill border-2 border-background font-bold leading-none ${
                    isMove
                      ? "top-5 left-[7px] size-3.5 bg-line"
                      : "top-4 left-0 size-7 bg-accent-primary text-xs text-white shadow-card"
                  }`}
                >
                  {typeMarks[item.type]}
                </span>
                <Card
                  variant={isMove ? "outlined" : "default"}
                  className={`schedule-item relative overflow-hidden ${isMove ? "schedule-item--move border-dashed px-4 py-3 text-text-secondary" : "schedule-item--destination px-4 py-4"} ${item.type === "optional" ? "schedule-item--optional border-dashed" : ""}`}
                >
                  {!isMove && (
                    <span aria-hidden="true" className="absolute top-3 right-3 font-editorial text-[0.62rem] font-bold tracking-[0.16em] text-accent-primary/30">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pr-7">
                    <Badge tone={typeTones[item.type]}>{typeLabels[item.type]}</Badge>
                    <span className="text-caption font-semibold text-text-secondary">{item.location}</span>
                    {item.timeLabel && <span className="text-caption font-semibold">{item.timeLabel}</span>}
                  </div>
                  <h3 className={`break-keep [text-wrap:balance] font-semibold ${isMove ? "mt-1 text-sm leading-snug" : "font-editorial mt-2 text-[1.08rem] leading-snug tracking-[-0.02em]"}`}>{item.title}</h3>
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
