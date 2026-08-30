"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, LoadingState } from "@/components/ui";
import { FAMILY_SLOT_COUNT } from "@/features/boarding/boarding-logic";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createScheduleDays,
  resolveScheduleDayNo,
  type ItineraryItemRow,
  type ScheduleDay,
  type ScheduleItemType,
} from "./schedule-data";

const typeLabels: Record<ScheduleItemType, string> = {
  flight: "항공",
  move: "이동",
  sightseeing: "관광",
  meal: "식사",
  hotel: "숙소",
  other: "일정",
};

const dayEditorial: Record<
  number,
  {
    title: string;
    route: string;
    introScene: string;
    memo: string;
    memoDetail: string;
  }
> = {
  1: {
    title: "첫째 날, 설레는 출발",
    route: "인천 → 후쿠오카 → 야나가와 → 다케오 → 우레시노",
    introScene: "camera",
    memo: "07:00 인천공항 T1 3층 12번 게이트 LG U+ 앞 집결",
    memoDetail: "내일은 나가사키를 둘러본 뒤 후쿠오카로 이동해요.",
  },
  2: {
    title: "둘째 날, 나가사키의 여름 산책",
    route: "우레시노 → 나가사키 → 후쿠오카",
    introScene: "glover",
    memo: "DAY 2는 원본 일정에 구체 시간이 없어 시간을 표시하지 않아요.",
    memoDetail: "내일은 다자이후와 라라포트를 둘러본 뒤 귀국해요.",
  },
  3: {
    title: "셋째 날, 아쉬운 귀국의 날",
    route: "후쿠오카 → 다자이후 → 라라포트 → 공항 → 인천",
    introScene: "dazaifu",
    memo: "17:45 후쿠오카 출발 · 19:15 인천 도착",
    memoDetail: "가족들과 함께한 여름의 기억을 오래 간직해요.",
  },
};

const daySceneOrder: Record<number, string[]> = {
  1: [
    "incheon-airport",
    "airplane",
    "fukuoka-airport",
    "yanagawa",
    "lunch",
    "yanagawa-boat",
    "fukuoka-bay",
    "takeo-shrine",
    "takeo-library",
    "fukuoka-bay",
    "ureshino-hotel",
  ],
  2: [
    "breakfast",
    "fukuoka-bay",
    "chinatown",
    "oura-church",
    "glover",
    "lunch",
    "fukuoka-bay",
    "tenjin",
    "tenjin-hotel",
  ],
  3: [
    "breakfast",
    "dazaifu",
    "lalaport",
    "lunch",
    "fukuoka-airport",
    "airplane",
    "incheon-airport",
  ],
};

const fallbackScenes: Record<ScheduleItemType, string> = {
  flight: "airplane",
  move: "fukuoka-bay",
  sightseeing: "fukuoka-bay",
  meal: "lunch",
  hotel: "tenjin-hotel",
  other: "fukuoka-bay",
};

const selectionKey = (tripId: string) => `jeonga:schedule-day:${tripId}`;
const dateParts = (date: string) => date.split("-").map(Number);
const weekday = (date: string) =>
  ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${date}T00:00:00Z`).getUTCDay()
  ];
const shortDate = (date: string) => date.slice(5).replace("-", ".");
const tripDateRange = (startDate: string, endDate: string) => {
  const [startYear, startMonth, startDay] = dateParts(startDate);
  const [endYear, endMonth, endDay] = dateParts(endDate);
  const start = `${startYear}.${String(startMonth).padStart(2, "0")}.${String(startDay).padStart(2, "0")} (${weekday(startDate)})`;
  const end = `${startYear === endYear ? "" : `${endYear}.`}${String(endMonth).padStart(2, "0")}.${String(endDay).padStart(2, "0")} (${weekday(endDate)})`;
  return `${start} ~ ${end}`;
};

function LineIcon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ScheduleIcon({ type }: { type: ScheduleItemType }) {
  const paths: Record<ScheduleItemType, ReactNode> = {
    flight: <path d="M3.5 13.5 21 4.5l-5 8.8 4.3 6.2-7.7-3.7-3.8 4.1-2-1 2-5-5.3-.4Z" />,
    move: (
      <>
        <path d="M5 10h14l1 7H4l1-7Zm2 0 2-4h6l2 4" />
        <circle cx="8" cy="18" r="1.5" />
        <circle cx="16" cy="18" r="1.5" />
      </>
    ),
    sightseeing: <path d="m12 3-4.8 6.5h3L6.5 15h4.2v6h2.6v-6h4.2l-3.7-5.5h3L12 3Z" />,
    meal: <path d="M7 3v8M4.8 3v5.2M9.2 3v5.2M7 11v10M15 3v18M15 3c4.2 3.8 4.2 8.5 0 11" />,
    hotel: (
      <>
        <path d="M4 12h16v7H4zM6 8h5v4H6zM4 19v2m16-2v2" />
        <path d="M4 11V7m16 5V9" />
      </>
    ),
    other: (
      <>
        <path d="M12 21s6-6.2 6-12a6 6 0 10-12 0c0 5.8 6 12 6 12Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    ),
  };

  return <LineIcon className="schedule-type-icon">{paths[type]}</LineIcon>;
}

function ScheduleScene({ scene, className = "" }: { scene: string; className?: string }) {
  return <span aria-hidden="true" className={`schedule-scene ${className}`} data-scene={scene} />;
}

function PageHeader() {
  return (
    <header className="schedule-page-header">
      <Link href="/home" aria-label="홈으로 돌아가기" className="schedule-header-action">
        <LineIcon className="schedule-header-icon"><path d="m15.5 19-7-7 7-7" /></LineIcon>
      </Link>
      <div>
        <h1 className="schedule-page-title">
          여행 일정
          <svg aria-hidden="true" className="schedule-title-flower" viewBox="0 0 30 31">
            <path d="M9 30c5-10 9-17 17-25M14 20c-5 0-8-3-8-7 5 0 8 3 8 7Zm5-7c0-5 3-8 7-9 0 5-2 8-7 9Z" />
            <g><circle cx="20" cy="9" r="3.2" /><circle cx="25" cy="8" r="3.2" /><circle cx="23" cy="3.5" r="3.2" /></g>
          </svg>
        </h1>
        <p>소중한 우리 가족의 여행 기록</p>
      </div>
      <span aria-hidden="true" className="schedule-header-action">
        <LineIcon className="schedule-header-icon"><path d="m3.5 6 5.5-2 6 2 5.5-2v14L15 20l-6-2-5.5 2V6ZM9 4v14m6-12v14" /></LineIcon>
      </span>
    </header>
  );
}

function SummaryFlowers({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 66 58">
      <path d="M20 58c1-20-2-35-10-47m10 35c10-4 18-13 23-25M18 40C9 38 4 32 3 24m23 22c10 1 18-2 23-10" />
      <path d="M17 35C9 34 5 29 4 22c8 0 13 5 13 13Zm11 12c8-2 15 1 18 8-8 2-14-1-18-8Z" />
      <g>
        <circle cx="9" cy="12" r="5" /><circle cx="3" cy="14" r="4" /><circle cx="7" cy="6" r="4.5" /><circle cx="14" cy="7" r="4.5" />
        <circle cx="44" cy="21" r="4" /><circle cx="50" cy="23" r="4" /><circle cx="49" cy="16" r="4" />
      </g>
    </svg>
  );
}

function TravelSummaryCard({
  title,
  startDate,
  endDate,
}: {
  title: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <section className="schedule-summary-card" aria-label="여행 요약">
      <svg aria-hidden="true" className="schedule-summary-rings" viewBox="0 0 26 104">
        {[11, 31, 51, 71, 91].map((y) => (
          <g key={y}>
            <circle cx="20" cy={y} r="3.5" />
            <path d={`M20 ${y - 5.5}H10c-8 0-8 11 0 11h10`} />
          </g>
        ))}
      </svg>
      <SummaryFlowers className="schedule-summary-flowers" />
      <div className="schedule-summary-copy">
        <h2>{title.replace(/^전가네\s*/, "")}</h2>
        <p>{tripDateRange(startDate, endDate)}</p>
        <p className="schedule-family-count">
          <LineIcon className="schedule-family-icon"><circle cx="12" cy="8" r="3" /><path d="M6 20v-2a6 6 0 0112 0v2M5 10a3 3 0 00-2 3v4M19 10a3 3 0 012 3v4" /></LineIcon>
          가족 {FAMILY_SLOT_COUNT}명
        </p>
      </div>
      <ScheduleScene scene="fukuoka-bay" className="schedule-summary-art" />
    </section>
  );
}

function RouteNote({ day }: { day: ScheduleDay }) {
  const editorial = dayEditorial[day.dayNo];
  return (
    <aside className="schedule-route-note">
      <span aria-hidden="true" className="schedule-route-leaf">
        <LineIcon><path d="M5 20C6 10 11 4 20 4c0 9-6 14-15 16Zm2-2 10-10M10 14c-3-1-5-3-5-6 4 0 6 2 6 5m3-4c0-3 2-5 5-6" /></LineIcon>
      </span>
      <div>
        <h2>{editorial?.title ?? `DAY ${day.dayNo}`}</h2>
        <p>{editorial?.route ?? day.routeSummary}</p>
      </div>
      <ScheduleScene scene={editorial?.introScene ?? "fukuoka-bay"} className="schedule-route-art" />
    </aside>
  );
}

function ClosingNote({ day }: { day: ScheduleDay }) {
  const editorial = dayEditorial[day.dayNo];
  if (!editorial) return null;

  return (
    <aside className="schedule-closing-note">
      <span aria-hidden="true" className="schedule-closing-tape" />
      <div>
        <strong>DAY {day.dayNo} 메모</strong>
        <p>{editorial.memo}</p>
        <p>{editorial.memoDetail}</p>
      </div>
      <SummaryFlowers className="schedule-closing-flowers" />
    </aside>
  );
}

function DaySchedule({ day }: { day: ScheduleDay }) {
  return (
    <section id={`schedule-day-${day.dayNo}`} aria-label={`DAY ${day.dayNo} 일정`}>
      <RouteNote day={day} />
      <ol className="schedule-timeline">
        {day.items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="schedule-timeline-item" data-type={item.type}>
            <span className={`schedule-timeline-marker schedule-timeline-marker--${item.type}`} aria-hidden="true">
              <ScheduleIcon type={item.type} />
            </span>
            <article className="schedule-item-card" data-timed={Boolean(item.timeLabel)} data-type={item.type}>
              {item.timeLabel && <time className="schedule-item-time">{item.timeLabel}</time>}
              <div className="schedule-item-copy">
                <div className="schedule-item-meta">
                  <span className="schedule-item-type">{typeLabels[item.type]}</span>
                  {item.location && <span>{item.location}</span>}
                </div>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
              <ScheduleScene
                scene={daySceneOrder[day.dayNo]?.[index] ?? fallbackScenes[item.type]}
                className="schedule-card-art"
              />
            </article>
          </li>
        ))}
      </ol>
      <ClosingNote day={day} />
    </section>
  );
}

export function ScheduleView() {
  const { trip } = useCurrentTripSession();
  const [selectedDayNo, setSelectedDayNo] = useState<number | null>(null);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadItinerary() {
      try {
        const { data, error: queryError } = await getSupabaseBrowserClient()
          .from("itinerary_items")
          .select("day_no,sequence,time_label,location_name,title,description,item_type")
          .eq("trip_id", trip.id)
          .order("day_no", { ascending: true })
          .order("sequence", { ascending: true });

        if (!active) return;
        if (queryError || !data?.length) throw queryError;

        const days = createScheduleDays(data as ItineraryItemRow[], trip.startDate);
        let persistedDayNo: number | null = null;
        try {
          const storedDayNo = localStorage.getItem(selectionKey(trip.id));
          persistedDayNo = storedDayNo === null ? null : Number(storedDayNo);
        } catch {
          // Storage can be unavailable in private browsing; the Korea-local default still works.
        }
        setSelectedDayNo(resolveScheduleDayNo(days, persistedDayNo));
        setScheduleDays(days);
      } catch {
        if (active) setError("여행 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }

    void loadItinerary();
    return () => {
      active = false;
    };
  }, [trip.id, trip.startDate]);

  const selectDay = (dayNo: number) => {
    setSelectedDayNo(dayNo);
    try {
      localStorage.setItem(selectionKey(trip.id), String(dayNo));
    } catch {
      // The selected tab still persists for this mounted view.
    }
  };

  const selectedDay = scheduleDays?.find((day) => day.dayNo === selectedDayNo) ?? scheduleDays?.[0];

  return (
    <div className="schedule-content">
      <PageHeader />
      <TravelSummaryCard title={trip.title} startDate={trip.startDate} endDate={trip.endDate} />

      {error ? (
        <div className="schedule-message">
          <p role="alert">{error}</p>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      ) : !scheduleDays || !selectedDay ? (
        <LoadingState className="min-h-80" label="여행 일정을 불러오고 있어요" />
      ) : (
        <>
          <nav aria-label="여행 날짜 선택" className="schedule-tabs">
            {scheduleDays.map((day) => {
              const selected = day.dayNo === selectedDay.dayNo;
              return (
                <button
                  key={day.dayNo}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectDay(day.dayNo)}
                  className="schedule-tab"
                  data-selected={selected}
                >
                  <strong>DAY {day.dayNo}</strong>
                  <span>{shortDate(day.date)} ({day.weekday})</span>
                </button>
              );
            })}
          </nav>
          <DaySchedule day={selectedDay} />
        </>
      )}
    </div>
  );
}
