"use client";

import { useEffect, useRef } from "react";
import {
  buildGoogleMapsSearchUrl,
  hasVariableGuideInfo,
  SCHEDULE_RESEARCH_DATE_LABEL,
  type ScheduleGuideItem,
  type ScheduleGuideKind,
  type ScheduleRecommendationType,
} from "./schedule-guide-data";

const kindLabels: Record<ScheduleGuideKind, string> = {
  flight: "항공",
  move: "이동",
  meal: "식사",
  attraction: "관광",
  hotel: "숙소",
};

const recommendationLabels: Record<ScheduleRecommendationType, string> = {
  restaurant: "맛집",
  cafe: "카페",
  attraction: "관광·휴식",
  food: "먹거리",
};

type ScheduleDetailSheetProps = {
  item: ScheduleGuideItem | null;
  onClose: () => void;
};

export function ScheduleDetailSheet({ item, onClose }: ScheduleDetailSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [item, onClose]);

  if (!item) return null;

  const titleId = `schedule-detail-title-${item.id}`;
  const descriptionId = `schedule-detail-summary-${item.id}`;

  return (
    <div
      className="schedule-detail-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="schedule-detail-sheet"
      >
        <span className="schedule-detail-handle" aria-hidden="true" />
        <header className="schedule-detail-header">
          <div className="schedule-detail-chips" aria-label="분류와 지역">
            <span>{kindLabels[item.kind]}</span>
            <span>{item.location}</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="일정 상세 닫기"
            className="schedule-detail-close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="schedule-detail-content">
          <h2 id={titleId}>{item.title}</h2>
          <p id={descriptionId} className="schedule-detail-summary">
            {item.summary}
          </p>

          {item.itineraryFacts?.length ? (
            <section className="schedule-detail-section" aria-labelledby={`${item.id}-itinerary`}>
              <h3 id={`${item.id}-itinerary`}>우리 일정</h3>
              <ul>
                {item.itineraryFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.visitInfo?.length ? (
            <section className="schedule-detail-section" aria-labelledby={`${item.id}-visit`}>
              <h3 id={`${item.id}-visit`}>방문 정보</h3>
              <ul>
                {item.visitInfo.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <aside className="schedule-detail-senior" aria-labelledby={`${item.id}-senior`}>
            <h3 id={`${item.id}-senior`}>어르신 체크</h3>
            <ul>
              {item.seniorNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </aside>

          {item.recommendations?.length ? (
            <section className="schedule-detail-section" aria-labelledby={`${item.id}-nearby`}>
              <h3 id={`${item.id}-nearby`}>주변 추천</h3>
              <p className="schedule-detail-optional-note">
                확정 일정이 아닌, 시간과 체력에 여유가 있을 때 보는 참고 후보예요.
              </p>
              <div className="schedule-detail-recommendations">
                {item.recommendations.map((recommendation) => (
                  <article key={`${recommendation.type}-${recommendation.name}`}>
                    <span>{recommendationLabels[recommendation.type]}</span>
                    <h4>{recommendation.name}</h4>
                    <p>{recommendation.note}</p>
                    <div className="schedule-detail-inline-links">
                      <a
                        href={buildGoogleMapsSearchUrl(recommendation.mapQuery)}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Google Maps
                      </a>
                      {recommendation.officialUrl ? (
                        <a
                          href={recommendation.officialUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          공식 정보
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="schedule-detail-actions">
            <a
              href={buildGoogleMapsSearchUrl(item.mapQuery)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Google Maps에서 보기
            </a>
            {item.officialUrl ? (
              <a href={item.officialUrl} target="_blank" rel="noreferrer noopener">
                공식 사이트
              </a>
            ) : null}
          </div>

          {hasVariableGuideInfo(item) ? (
            <p className="schedule-detail-research-date">{SCHEDULE_RESEARCH_DATE_LABEL}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
