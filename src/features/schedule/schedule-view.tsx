"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
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
  const [selectedDayNo, setSelectedDayNo] = useState<ScheduleDayNo>(1);
  const [selectedDetailId, setSelectedDetailId] =
    useState<ScheduleGuideItemId | null>(null);

  useEffect(() => {
    const syncFromLocation = () => {
      const detail = getScheduleGuideItem(
        new URLSearchParams(window.location.search).get("detail"),
      );
      let dayNo: ScheduleDayNo = detail?.day ?? 1;
      if (!detail) {
        try {
          const storedDayNo = Number(localStorage.getItem(selectionKey(trip.id)));
          dayNo = isScheduleDayNo(storedDayNo) ? storedDayNo : 1;
        } catch {
          // DAY 1 remains the safe default when storage is unavailable.
        }
      }

      setSelectedDayNo(dayNo);
      setSelectedDetailId(detail?.id ?? null);
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
  }, [trip.id]);

  const closeDetail = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("detail")) {
      url.searchParams.delete("detail");
      window.history.replaceState(window.history.state, "", url);
    }
    setSelectedDetailId(null);
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

  const openDetail = (id: ScheduleGuideItemId) => {
    const item = getScheduleGuideItem(id);
    if (!item) return;

    const url = new URL(window.location.href);
    url.searchParams.set("detail", id);
    window.history.pushState(window.history.state, "", url);
    setSelectedDayNo(item.day);
    setSelectedDetailId(id);
  };

  const selectedVisual = resolveScheduleVisual(scheduleVisualAssets[selectedDayNo]);
  const selectedDetail = getScheduleGuideItem(selectedDetailId) ?? null;

  const detailHotspots = (scope: ScheduleHotspotScope) =>
    getScheduleDetailHotspots(selectedDayNo, scope).map((hotspot) => {
      const item = getScheduleGuideItem(hotspot.id);
      if (!item) return null;

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
          onClick={() => openDetail(hotspot.id)}
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
    <section className="schedule-plate-shell" aria-labelledby="schedule-title">
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
      <ScheduleDetailSheet item={selectedDetail} onClose={closeDetail} />
    </section>
  );
}
