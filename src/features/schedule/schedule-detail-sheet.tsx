"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildGoogleMapsSearchUrl,
  getScheduleDetailArtworkSrc,
  SCHEDULE_MAPS_SNAPSHOT_LABEL,
  SCHEDULE_STATIC_SNAPSHOT_LABEL,
  type ScheduleGuideItem,
  type ScheduleGuideKind,
  type ScheduleLocalPick,
  type ScheduleNearbyCategory,
  type ScheduleNearbyPlace,
} from "./schedule-guide-data";
import {
  buildScheduleDetailPresentation,
  formatSchedulePlaceRating,
  type ScheduleDetailDisclosure,
  type ScheduleDisclosureKey,
} from "./schedule-detail-presentation";

const kindLabels: Record<ScheduleGuideKind, string> = {
  flight: "항공",
  move: "이동",
  meal: "식사",
  attraction: "관광",
  hotel: "숙소",
};

const nearbyCategoryLabels: Record<ScheduleNearbyCategory, string> = {
  food: "먹거리",
  cafe: "카페",
  dessert: "디저트",
  attraction: "명소",
  museum: "박물관",
  shopping: "쇼핑",
};

const localPickKindLabels: Record<ScheduleLocalPick["kind"], string> = {
  snack: "간식",
  dessert: "디저트",
  drink: "음료",
};

const SWIPE_CLOSE_DISTANCE = 96;
const SWIPE_CLOSE_VELOCITY = 0.65;

type ScheduleDetailSheetProps = {
  item: ScheduleGuideItem | null;
  onClose: () => void;
  restoreFocusOnClose: boolean;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  rejected: boolean;
};

function PlaceRows({
  places,
}: {
  places: readonly ScheduleNearbyPlace[];
}) {
  return (
    <div className="schedule-detail-place-list">
      {places.map((place) => {
        const ratingLabel = formatSchedulePlaceRating(place);
        const proximityLabel =
          place.walkingLabel ??
          (place.sameComplex
            ? "같은 시설 권역"
            : place.walkingMinutes !== undefined ||
                place.distanceMeters !== undefined
              ? [
                  place.walkingMinutes !== undefined
                    ? `도보 ${place.walkingMinutes}분`
                    : "",
                  place.distanceMeters !== undefined
                    ? `${place.distanceMeters.toLocaleString("ko-KR")}m`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined);

        return (
          <article
            key={`${place.category}-${place.name}`}
            className={place.artworkSrc ? undefined : "schedule-detail-place-card--text-only"}
          >
            {place.artworkSrc ? (
              <div className="schedule-detail-place-art" aria-hidden="true">
                <Image
                  src={place.artworkSrc}
                  alt=""
                  width={96}
                  height={96}
                  sizes="96px"
                />
              </div>
            ) : null}
            <div className="schedule-detail-place-copy">
              <h4>{place.name}</h4>
              <span>{nearbyCategoryLabels[place.category]}</span>
              {ratingLabel || proximityLabel || place.validThrough ? (
                <p className="schedule-detail-place-meta">
                  {ratingLabel ? <span>{ratingLabel}</span> : null}
                  {proximityLabel ? <span>{proximityLabel}</span> : null}
                  {place.validThrough ? (
                    <span>{place.validThrough.replaceAll("-", ".")}까지</span>
                  ) : null}
                </p>
              ) : null}
              <p className="schedule-detail-place-note">{place.note}</p>
              <div className="schedule-detail-place-actions">
                <a
                  href={place.mapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${place.name} 지도 보기`}
                >
                  지도
                </a>
                {place.officialUrl ? (
                  <a
                    href={place.officialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${place.name} 공식 정보 보기`}
                  >
                    공식
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LocalPickRows({ picks }: { picks: readonly ScheduleLocalPick[] }) {
  return (
    <ul className="schedule-detail-local-pick-list">
      {picks.map((pick) => (
        <li key={`${pick.kind}-${pick.label}`}>
          <div>
            <span>{localPickKindLabels[pick.kind]}</span>
            <strong>{pick.label}</strong>
          </div>
          <p>{pick.note}</p>
        </li>
      ))}
    </ul>
  );
}

function DisclosureSection({
  itemId,
  disclosure,
  isOpen,
  onToggle,
}: {
  itemId: string;
  disclosure: ScheduleDetailDisclosure;
  isOpen: boolean;
  onToggle: (key: ScheduleDisclosureKey) => void;
}) {
  const triggerId = `${itemId}-${disclosure.key}-trigger`;
  const contentId = `${itemId}-${disclosure.key}-content`;

  return (
    <section
      className={`schedule-detail-disclosure${isOpen ? " is-open" : ""}`}
      aria-labelledby={triggerId}
    >
      <button
        id={triggerId}
        type="button"
        className="schedule-detail-disclosure-trigger"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => onToggle(disclosure.key)}
      >
        <span>{disclosure.label}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        className="schedule-detail-disclosure-content"
        hidden={!isOpen}
      >
        {disclosure.kind === "places" ? (
          <>
            {disclosure.places.length ? (
              <PlaceRows places={disclosure.places} />
            ) : null}
            {disclosure.localPicks.length ? (
              <LocalPickRows picks={disclosure.localPicks} />
            ) : null}
          </>
        ) : disclosure.kind === "rating" ? (
          <div className="schedule-detail-rating-copy">
            <p>
              <strong>
                <span aria-hidden="true">★</span>{" "}
                {disclosure.rating.rating.toFixed(1)} · 리뷰{" "}
                {disclosure.rating.reviewCount.toLocaleString("ko-KR")}개
              </strong>
            </p>
            <p>{SCHEDULE_MAPS_SNAPSHOT_LABEL}</p>
            <a
              href={disclosure.rating.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${itemId} 평점 지도 출처 보기`}
            >
              지도
            </a>
          </div>
        ) : (
          <a
            href={disclosure.url}
            target="_blank"
            rel="noreferrer noopener"
            className="schedule-detail-disclosure-link"
          >
            공식 사이트
          </a>
        )}
      </div>
    </section>
  );
}

export function ScheduleDetailSheet({
  item,
  onClose,
  restoreFocusOnClose,
}: ScheduleDetailSheetProps) {
  const presentation = item ? buildScheduleDetailPresentation(item) : null;
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [openDisclosures, setOpenDisclosures] = useState<
    readonly ScheduleDisclosureKey[]
  >(() =>
    presentation?.defaultOpenDisclosure
      ? [presentation.defaultOpenDisclosure]
      : [],
  );

  useEffect(() => {
    if (!item) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (restoreFocusOnClose) {
      closeButtonRef.current?.focus({ preventScroll: true });
    } else {
      sheetRef.current?.focus({ preventScroll: true });
    }

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
      ).filter((element) => !element.closest("[hidden]"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sheetRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === sheetRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      if (restoreFocusOnClose && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [item, onClose, restoreFocusOnClose]);

  if (!item || !presentation) return null;

  const titleId = `schedule-detail-title-${item.id}`;
  const descriptionId = `schedule-detail-summary-${item.id}`;
  const toggleDisclosure = (key: ScheduleDisclosureKey) => {
    setOpenDisclosures((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key],
    );
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("button, a")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      rejected: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      drag.rejected = true;
      setDragOffset(0);
      return;
    }
    if (drag.rejected || deltaY <= 0 || Math.abs(deltaY) < Math.abs(deltaX)) return;

    event.preventDefault();
    setDragOffset(deltaY);
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = Math.max(0, event.clientY - drag.startY);
    const duration = Math.max(1, event.timeStamp - drag.startTime);
    const shouldClose =
      !cancelled &&
      !drag.rejected &&
      (deltaY >= SWIPE_CLOSE_DISTANCE ||
        (deltaY >= 32 && deltaY / duration >= SWIPE_CLOSE_VELOCITY));

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
    if (shouldClose) onClose();
  };

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
        tabIndex={-1}
        className={`schedule-detail-sheet${isDragging ? " is-dragging" : ""}`}
        style={{ "--schedule-sheet-drag-y": `${dragOffset}px` } as CSSProperties}
      >
        <div
          className="schedule-detail-drag-region"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={(event) => finishDrag(event, true)}
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
        </div>

        <div className="schedule-detail-content">
          <div className="schedule-detail-intro">
            <h2 id={titleId}>{item.title}</h2>
            <p id={descriptionId} className="schedule-detail-summary">
              {item.summary}
            </p>
            <Image
              src="/assets/schedule/detail/botanical-branch.webp"
              alt=""
              width={180}
              height={240}
              className="schedule-detail-botanical"
              aria-hidden="true"
            />
          </div>

          <div
            className={`schedule-detail-hero-art schedule-detail-hero-art--${presentation.layout}`}
            aria-hidden="true"
          >
            <Image
              src={getScheduleDetailArtworkSrc(item.id)}
              alt=""
              width={720}
              height={400}
              sizes="(max-width: 430px) 100vw, 430px"
            />
          </div>

          <section
            className="schedule-detail-section schedule-detail-core"
            aria-labelledby={`${item.id}-core`}
          >
            <h3 id={`${item.id}-core`}>{presentation.coreTitle}</h3>
            <ul>
              {presentation.coreFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </section>

          {presentation.hasRecommendations ? (
            <p className="schedule-detail-optional-note">
              확정 일정이 아닌, 여유가 있을 때 보는 참고 후보예요.
            </p>
          ) : null}

          {presentation.disclosures.map((disclosure) => (
            <DisclosureSection
              key={disclosure.key}
              itemId={item.id}
              disclosure={disclosure}
              isOpen={openDisclosures.includes(disclosure.key)}
              onToggle={toggleDisclosure}
            />
          ))}

          {presentation.hasRecommendations ? (
            <p className="schedule-detail-research-date">
              {SCHEDULE_STATIC_SNAPSHOT_LABEL}
            </p>
          ) : null}
        </div>

        <footer className="schedule-detail-actions" aria-label="일정 상세 바로가기">
          <a
            href={buildGoogleMapsSearchUrl(item.mapQuery)}
            target="_blank"
            rel="noreferrer noopener"
          >
            지도 보기
          </a>
          {item.officialUrl ? (
            <a href={item.officialUrl} target="_blank" rel="noreferrer noopener">
              공식 사이트
            </a>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
