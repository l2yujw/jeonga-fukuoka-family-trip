"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import { resolveScheduleViewDayNo } from "./schedule-data";
import {
  createScheduleDetailHistoryState,
  getScheduleDetailCloseMode,
  removeScheduleDetailFromUrl,
} from "./schedule-detail-history";
import {
  getScheduleDetailHotspots,
  type ScheduleHotspotScope,
} from "./schedule-detail-hotspots";
import { ScheduleDetailSheet } from "./schedule-detail-sheet";
import {
  getScheduleGuideItem,
  type ScheduleGuideItemId,
} from "./schedule-guide-data";
import {
  isScheduleDayNo,
  resolveScheduleVisual,
  SCHEDULE_DAY_NOS,
  scheduleVisualAssets,
  type ScheduleDayNo,
} from "./schedule-visual-assets";

const selectionKey = (tripId: string) => `jeonga:schedule-day:${tripId}`;
const dayDates: Record<ScheduleDayNo, string> = {
  1: "09.11 (금)",
  2: "09.12 (토)",
  3: "09.13 (일)",
};

export function ScheduleView() {
  const { trip } = useCurrentTripSession();
  const [selectedDayNo, setSelectedDayNo] = useState<ScheduleDayNo>(() =>
    resolveScheduleViewDayNo(
      SCHEDULE_DAY_NOS,
      trip.startDate,
      null,
      null,
    ) ?? 1,
  );
  const [selectedDetailId, setSelectedDetailId] =
    useState<ScheduleGuideItemId | null>(null);
  const [restoreDetailFocus, setRestoreDetailFocus] = useState(false);
  const [showHotspotDebug, setShowHotspotDebug] = useState(false);
  const detailActivationRef = useRef<"keyboard" | "pointer" | null>(null);
  const historyBackPendingRef = useRef(false);

  useEffect(() => {
    const syncFromLocation = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const detail = getScheduleGuideItem(searchParams.get("detail"));
      let persistedDayNo: ScheduleDayNo | null = null;
      if (!detail) {
        try {
          const storedDayNo = Number(localStorage.getItem(selectionKey(trip.id)));
          persistedDayNo = isScheduleDayNo(storedDayNo) ? storedDayNo : null;
        } catch {
          // The Korea-local trip day remains available when storage is unavailable.
        }
      }
      const dayNo = resolveScheduleViewDayNo(
        SCHEDULE_DAY_NOS,
        trip.startDate,
        detail?.day ?? null,
        persistedDayNo,
      ) ?? 1;

      historyBackPendingRef.current = false;
      setSelectedDayNo(dayNo);
      setSelectedDetailId(detail?.id ?? null);
      if (!detail) setRestoreDetailFocus(false);
      setShowHotspotDebug(
        process.env.NODE_ENV !== "production" &&
          searchParams.get("debugScheduleHotspots") === "1",
      );
      if (detail) {
        try {
          localStorage.setItem(selectionKey(trip.id), String(dayNo));
        } catch {
          // Direct detail links still select the matching DAY for this view.
        }
      }
    };

    const frame = window.requestAnimationFrame(syncFromLocation);
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [trip.id, trip.startDate]);

  const closeDetail = useCallback(() => {
    const url = removeScheduleDetailFromUrl(window.location.href);
    if (!new URLSearchParams(window.location.search).has("detail")) {
      setSelectedDetailId(null);
      return;
    }
    if (getScheduleDetailCloseMode(window.history.state) === "back") {
      if (!historyBackPendingRef.current) {
        historyBackPendingRef.current = true;
        window.history.back();
      }
      return;
    }

    window.history.replaceState(window.history.state, "", url);
    setSelectedDetailId(null);
    setRestoreDetailFocus(false);
  }, []);

  const selectDay = (dayNo: ScheduleDayNo) => {
    closeDetail();
    setSelectedDayNo(dayNo);
    try {
      localStorage.setItem(selectionKey(trip.id), String(dayNo));
    } catch {
      // The selected plate still persists for this mounted view.
    }
  };

  const openDetail = (
    id: ScheduleGuideItemId,
    activation: "keyboard" | "pointer",
  ) => {
    const item = getScheduleGuideItem(id);
    if (!item) return;

    const url = new URL(window.location.href);
    url.searchParams.set("detail", id);
    window.history.pushState(
      createScheduleDetailHistoryState(window.history.state),
      "",
      url,
    );
    setSelectedDayNo(item.day);
    setSelectedDetailId(id);
    setRestoreDetailFocus(activation === "keyboard");
  };

  const selectedVisual = resolveScheduleVisual(scheduleVisualAssets[selectedDayNo]);
  const selectedDetail = getScheduleGuideItem(selectedDetailId) ?? null;

  const detailHotspots = (scope: ScheduleHotspotScope) =>
    getScheduleDetailHotspots(selectedDayNo, scope).map((hotspot) => {
      const item = getScheduleGuideItem(hotspot.id);
      if (!item) return null;

      const handleDetailKeyDown = (
        event: ReactKeyboardEvent<HTMLButtonElement>,
      ) => {
        if (event.key === "Enter" || event.key === " ") {
          detailActivationRef.current = "keyboard";
        }
      };
      const handleDetailClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        const activation =
          detailActivationRef.current ??
          (event.detail === 0 ? "keyboard" : "pointer");
        detailActivationRef.current = null;
        if (activation === "pointer") event.currentTarget.blur();
        openDetail(hotspot.id, activation);
      };

      return (
        <button
          key={hotspot.id}
          type="button"
          aria-label={`${item.title} 상세 보기`}
          className="schedule-plate-hotspot schedule-detail-hotspot"
          style={{
            left: `${hotspot.rect.x}%`,
            top: `${hotspot.rect.y}%`,
            width: `${hotspot.rect.width}%`,
            height: `${hotspot.rect.height}%`,
          }}
          onPointerDown={() => {
            detailActivationRef.current = "pointer";
          }}
          onPointerCancel={() => {
            detailActivationRef.current = null;
          }}
          onKeyDown={handleDetailKeyDown}
          onClick={handleDetailClick}
        />
      );
    });

  const hotspots = (
    <>
      <Link
        href="/home"
        aria-label="홈으로 돌아가기"
        className="schedule-plate-hotspot schedule-plate-hotspot--back"
      />
      <nav className="schedule-plate-tabs" aria-label="여행 날짜 선택">
        {SCHEDULE_DAY_NOS.map((dayNo) => (
          <button
            key={dayNo}
            type="button"
            aria-label={`DAY ${dayNo} 일정 보기`}
            aria-pressed={selectedDayNo === dayNo}
            className={`schedule-plate-hotspot schedule-plate-hotspot--day-${dayNo}`}
            onClick={() => selectDay(dayNo)}
          >
            <strong>DAY {dayNo}</strong>
            <span>{dayDates[dayNo]}</span>
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <section
      className="schedule-plate-shell"
      aria-labelledby="schedule-title"
      data-debug-hotspots={showHotspotDebug ? "true" : undefined}
    >
      <h1 id="schedule-title" className="sr-only">
        여행 일정
      </h1>
      {!selectedVisual ? (
        <p role="alert">일정 이미지를 불러올 수 없어요.</p>
      ) : selectedVisual.mode === "split" ? (
        <div data-day={selectedDayNo} data-mode="split">
          <div className="schedule-plate-segment schedule-plate-top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedVisual.topSrc}
              alt={`DAY ${selectedDayNo} 후쿠오카 가족여행 일정 상단`}
              width={695}
              height={565}
              className="schedule-plate-image"
              draggable={false}
            />
            {hotspots}
          </div>
          <div className="schedule-plate-segment schedule-plate-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedVisual.bodySrc}
              alt={`DAY ${selectedDayNo} 후쿠오카 가족여행 상세 일정`}
              width={selectedVisual.bodyWidth}
              height={selectedVisual.bodyHeight}
              className="schedule-plate-image"
              draggable={false}
            />
            {detailHotspots("body")}
          </div>
        </div>
      ) : (
        <div
          className="schedule-plate-segment schedule-plate-fallback"
          data-day={selectedDayNo}
          data-mode="fallback"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedVisual.src}
            alt={`DAY ${selectedDayNo} 후쿠오카 가족여행 일정`}
            width={682}
            height={2048}
            className="schedule-plate-image"
            draggable={false}
          />
          {hotspots}
          {detailHotspots("fullPlate")}
        </div>
      )}
      <ScheduleDetailSheet
        key={selectedDetail?.id ?? "closed"}
        item={selectedDetail}
        onClose={closeDetail}
        restoreFocusOnClose={restoreDetailFocus}
      />
    </section>
  );
}
