"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BottomNav, MobileShell } from "@/components/ui";
import {
  loadHomeAlbumPhoto,
  loadHomeAlbumPreview,
} from "@/features/album/album-repository";
import type { AlbumPhoto } from "@/features/album/album-types";
import { getCurrentAuthSession, getMemberSwitchState } from "@/features/boarding/current-trip-session";
import { clearPendingMember } from "@/features/boarding/pending-member";
import {
  TripAccessGuard,
  useCurrentTripSession,
} from "@/features/boarding/trip-access-guard";
import { loadLatestMemoryCard } from "@/features/cards/memory-card-repository";
import { getMemoryCardTemplateSpec } from "@/features/cards/memory-card-template-spec";
import type { MemoryCard } from "@/features/cards/memory-card";
import {
  createHomeSchedulePreviewCopy,
  getHomeSchedulePreview,
} from "@/features/home/home-date-state";
import { getHomeImageFit } from "@/features/home/home-preview-fit";
import type { ItineraryItemRow } from "@/features/schedule/schedule-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const HOME_SCHEDULE_PREVIEW_ASSETS = {
  1: "/api/schedule-asset/detail/d1-fukuoka-arrival.webp",
  2: "/api/schedule-asset/detail/d2-nagasaki-chinatown.webp",
  3: "/api/schedule-asset/detail/d3-dazaifu.webp",
} as const;

const HOME_SUMMARY_FACTS = [
  { icon: "destination", label: "여행지", value: "후쿠오카" },
  { icon: "duration", label: "기간", value: "2박 3일" },
  { icon: "family", label: "인원", value: "가족 10명" },
  { icon: "route", label: "주요 경로", value: "야나가와 · 나가사키" },
] as const;

const HOME_QUICK_ACTIONS = [
  {
    href: "/schedule",
    icon: "schedule",
    label: "여행 일정",
    description: "자세히 보기",
    tone: "coral",
  },
  {
    href: "/album",
    icon: "album",
    label: "사진 공유",
    description: "추억 나누기",
    tone: "sage",
  },
  {
    href: "/cards",
    icon: "card",
    label: "추억 카드 만들기",
    description: "나만의 카드",
    tone: "coral",
  },
] as const;

type HomeIconName =
  | (typeof HOME_SUMMARY_FACTS)[number]["icon"]
  | (typeof HOME_QUICK_ACTIONS)[number]["icon"];
type AlbumPreview = { count: number; photo: AlbumPhoto | null };
type CardPreview = { card: MemoryCard | null; photo: AlbumPhoto | null };

function HomeIcon({ icon }: { icon: HomeIconName }) {
  const paths = {
    destination: (
      <>
        <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    duration: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    family: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 20c0-4 2.2-6 5.5-6s5.5 2 5.5 6M14 15c3.7-.8 6.5 1 6.5 5" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="18" cy="17" r="2.5" />
        <path d="M8.5 7h2.25a3 3 0 0 1 0 6H9.5a3 3 0 0 0 0 6H15" />
      </>
    ),
    schedule: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h7" />
      </>
    ),
    album: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m5.5 17 4.2-4.2 3.1 3.1 2.4-2.4 3.3 3.5" />
      </>
    ),
    card: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M12 17s-4.5-2.5-4.5-5.6c0-2.6 3.3-3.1 4.5-1 1.2-2.1 4.5-1.6 4.5 1C16.5 14.5 12 17 12 17Z" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}

function HomeSectionHeading({
  eyebrow,
  id,
  title,
}: {
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <header className="home-v5-section-heading">
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <span className="home-v5-leaf" aria-hidden="true" />
    </header>
  );
}

function HomePreviewImage({
  src,
  sourceWidth = null,
  sourceHeight = null,
  frameWidth,
  frameHeight,
}: {
  src: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  frameWidth: number;
  frameHeight: number;
}) {
  const initialFit = getHomeImageFit(
    sourceWidth,
    sourceHeight,
    frameWidth,
    frameHeight,
  );

  return (
    // Only the selected private runtime image URL is mounted.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      data-fit={initialFit.mode}
      style={{ "--home-media-scale": initialFit.scale } as CSSProperties}
      onLoad={(event) => {
        const fit = getHomeImageFit(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight,
          frameWidth,
          frameHeight,
        );
        event.currentTarget.dataset.fit = fit.mode;
        event.currentTarget.dataset.loaded = "true";
        event.currentTarget.style.setProperty(
          "--home-media-scale",
          String(fit.scale),
        );
      }}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function HomeScreen() {
  const router = useRouter();
  const { trip, member } = useCurrentTripSession();
  const schedule = getHomeSchedulePreview();
  const memberSwitchDialogRef = useRef<HTMLElement>(null);
  const memberSwitchCancelRef = useRef<HTMLButtonElement>(null);
  const memberSwitchPendingRef = useRef(false);
  const cancelSwitchRef = useRef<Promise<unknown>>(Promise.resolve());
  const [memberSwitchOpen, setMemberSwitchOpen] = useState(false);
  const [memberSwitchPending, setMemberSwitchPending] = useState(false);
  const [memberSwitchError, setMemberSwitchError] = useState<string | null>(null);
  const [scheduleState, setScheduleState] = useState<{
    tripId: string;
    dayNo: number;
    items: ItineraryItemRow[] | null;
  } | null>(null);
  const [albumPreview, setAlbumPreview] = useState<
    AlbumPreview | null | undefined
  >(undefined);
  const [cardPreview, setCardPreview] = useState<
    CardPreview | null | undefined
  >(undefined);
  const scheduleItems =
    scheduleState?.tripId === trip.id && scheduleState.dayNo === schedule.dayNo
      ? scheduleState.items
      : undefined;
  const scheduleCopy = Array.isArray(scheduleItems)
    ? createHomeSchedulePreviewCopy(
        scheduleItems,
        trip.startDate,
        schedule.dayNo,
      )
    : null;
  const scheduleTitle =
    scheduleItems === undefined
      ? "일정을 불러오는 중"
      : scheduleItems === null
        ? "일정을 확인하지 못했어요"
        : scheduleCopy?.title ?? "등록된 일정이 없어요";
  const scheduleSupporting =
    scheduleItems === undefined
      ? "잠시만 기다려 주세요"
      : scheduleItems === null
        ? "일정 화면에서 다시 확인해 주세요"
        : scheduleCopy?.supporting ?? "여행 일정을 확인해 보세요";
  const latestCard = cardPreview?.card;
  const latestCardTemplate = latestCard
    ? getMemoryCardTemplateSpec(latestCard.templateKey)?.displayName
    : null;
  const albumTitle =
    albumPreview === undefined
      ? "사진을 불러오는 중"
      : albumPreview === null
        ? "사진을 확인하지 못했어요"
        : albumPreview.count
          ? "함께한 순간들"
          : "사진을 기다리고 있어요";
  const albumMeta =
    albumPreview === undefined
      ? "잠시만 기다려 주세요"
      : albumPreview === null
        ? "앨범에서 다시 확인해 주세요"
        : albumPreview.count
          ? `사진 ${albumPreview.count}장`
          : "아직 공유된 사진이 없어요";
  const cardTitle =
    cardPreview === undefined
      ? "카드를 불러오는 중"
      : cardPreview === null
        ? "카드를 확인하지 못했어요"
        : latestCard?.creatorName
          ? `${latestCard.creatorName}님의 카드`
          : latestCard
            ? "가장 최근 추억 카드"
            : "첫 추억 카드를 만들어보세요";
  const cardMeta =
    cardPreview === undefined
      ? "잠시만 기다려 주세요"
      : cardPreview === null
        ? "카드에서 다시 확인해 주세요"
        : latestCardTemplate ?? "아직 만든 카드가 없어요";
  const tripDateRange = `${trip.startDate.replaceAll("-", ".")} — ${trip.endDate.slice(5).replace("-", ".")}`;

  const closeMemberSwitchDialog = useCallback(() => {
    setMemberSwitchOpen(false);
    setMemberSwitchError(null);
  }, [setMemberSwitchError, setMemberSwitchOpen]);

  useEffect(() => {
    if (!memberSwitchOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      memberSwitchCancelRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!memberSwitchPendingRef.current) closeMemberSwitchDialog();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        memberSwitchDialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
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
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [closeMemberSwitchDialog, memberSwitchOpen]);

  useEffect(() => {
    // Returning Home (including browser Back) cancels an unfinished switch.
    cancelSwitchRef.current = getMemberSwitchState("DELETE").catch(() => {
      setMemberSwitchError("변경 취소를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
    });
  }, []);

  async function confirmMemberSwitch() {
    if (memberSwitchPendingRef.current) return;

    memberSwitchPendingRef.current = true;
    setMemberSwitchPending(true);
    setMemberSwitchError(null);

    try {
      await cancelSwitchRef.current;
      const authSession = await getCurrentAuthSession();
      if (!authSession) {
        throw new Error("인증 정보를 확인할 수 없어요. 초대 링크로 다시 접속해주세요.");
      }

      const response = await fetch("/api/member-switch", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });
      const payload: unknown = await response.json().catch(() => null);
      const status =
        payload && typeof payload === "object" && "status" in payload
          ? payload.status
          : null;
      const responseError =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "사용자 변경을 완료할 수 없어요. 잠시 후 다시 시도해주세요.";

      if (!response.ok) throw new Error(responseError);
      if (status !== "switch_ready") {
        throw new Error("사용자 변경 결과를 확인할 수 없어요. 다시 시도해주세요.");
      }

      clearPendingMember();
      setMemberSwitchOpen(false);
      router.replace("/");
    } catch (error) {
      setMemberSwitchError(
        error instanceof Error
          ? error.message
          : "사용자 변경을 완료할 수 없어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      memberSwitchPendingRef.current = false;
      setMemberSwitchPending(false);
    }
  }

  useEffect(() => {
    let active = true;

    void getSupabaseBrowserClient()
      .from("itinerary_items")
      .select(
        "day_no,sequence,time_label,location_name,title,description,item_type",
      )
      .eq("trip_id", trip.id)
      .eq("day_no", schedule.dayNo)
      .order("sequence", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        setScheduleState({
          tripId: trip.id,
          dayNo: schedule.dayNo,
          items: error ? null : ((data ?? []) as ItineraryItemRow[]),
        });
      });

    return () => {
      active = false;
    };
  }, [schedule.dayNo, trip.id]);

  useEffect(() => {
    let active = true;

    void loadHomeAlbumPreview(trip.id).then(
      (preview) => {
        if (active) setAlbumPreview(preview);
      },
      () => {
        if (active) setAlbumPreview(null);
      },
    );

    void loadLatestMemoryCard(trip.id).then(
      async (card) => {
        if (!active) return;
        setCardPreview({ card, photo: null });

        const photoId = card?.renderModel?.layout.slots[0]?.photoId;
        if (!photoId) return;

        const photo = await loadHomeAlbumPhoto(trip.id, photoId).catch(
          () => null,
        );
        if (active) setCardPreview({ card, photo });
      },
      () => {
        if (active) setCardPreview(null);
      },
    );

    return () => {
      active = false;
    };
  }, [trip.id]);

  return (
    <MobileShell className="home-page-shell">
      <main
        className="home-v5-main"
        aria-labelledby="home-title"
        aria-describedby="home-trip-period"
      >
        <header className="home-v5-hero">
          <button
            type="button"
            className="home-v5-member-switch"
            aria-label={`현재 사용자 ${member.name}, 사용자 변경`}
            onClick={() => {
              setMemberSwitchError(null);
              setMemberSwitchOpen(true);
            }}
          >
            {member.name} · 변경
          </button>
          <div className="home-v5-hero-copy">
            <p className="home-v5-eyebrow">FUKUOKA FAMILY TRIP</p>
            <h1 id="home-title">
              <span>전가네</span>
              <span>후쿠오카</span>
              <span>가족여행</span>
            </h1>
            <p className="home-v5-duration">함께하는 2박 3일</p>
            <time
              id="home-trip-period"
              dateTime={trip.startDate}
              aria-label={`${trip.startDate}부터 ${trip.endDate}까지`}
            >
              {tripDateRange}
            </time>
          </div>
          <Image
            src="/api/home-visual"
            alt=""
            aria-hidden="true"
            width={445}
            height={490}
            draggable="false"
            priority
            unoptimized
            className="home-v5-hero-scene"
          />
        </header>

        <section className="home-v5-summary" aria-label="여행 요약">
          <dl>
            {HOME_SUMMARY_FACTS.map(({ icon, label, value }) => (
              <div key={label}>
                <dt>
                  <HomeIcon icon={icon} />
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="home-v5-our-trip" aria-labelledby="home-our-trip-title">
          <HomeSectionHeading
            eyebrow="OUR TRIP"
            id="home-our-trip-title"
            title="여행을 시작해요"
          />
          <div className="home-v5-quick-grid">
            {HOME_QUICK_ACTIONS.map(
              ({ description, href, icon, label, tone }) => (
                <Link
                  key={href}
                  href={href}
                  className="home-v5-quick-card"
                  data-tone={tone}
                  aria-label={`${label}, ${description}`}
                >
                  <span className="home-v5-quick-icon">
                    <HomeIcon icon={icon} />
                  </span>
                  <strong>{label}</strong>
                  <span className="home-v5-quick-footer">
                    <small>{description}</small>
                    <span className="home-v5-arrow" aria-hidden="true">→</span>
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>

        <section className="home-v5-travel-notes" aria-labelledby="home-travel-notes-title">
          <HomeSectionHeading
            eyebrow="TRAVEL NOTES"
            id="home-travel-notes-title"
            title="여행 미리보기"
          />

          <Link
            href="/schedule"
            className="home-v5-preview-card home-v5-schedule-preview"
            aria-label={`여행 일정, ${schedule.label}, ${scheduleTitle}, ${scheduleSupporting}`}
          >
            <span className="home-v5-preview-media home-v5-schedule-media">
              <HomePreviewImage
                src={HOME_SCHEDULE_PREVIEW_ASSETS[schedule.dayNo]}
                frameWidth={16}
                frameHeight={10}
              />
              <span className="home-v5-day-chip">{schedule.label}</span>
            </span>
            <span className="home-v5-preview-copy">
              <small>오늘의 일정</small>
              <strong>{scheduleTitle}</strong>
              <span>{scheduleSupporting}</span>
            </span>
            <span className="home-v5-preview-arrow" aria-hidden="true">→</span>
          </Link>

          <div className="home-v5-preview-grid">
            <Link
              href="/album"
              className="home-v5-preview-card home-v5-secondary-preview"
              aria-label={`공유 사진, ${albumTitle}, ${albumMeta}`}
            >
              <span className="home-v5-preview-media">
                {albumPreview?.photo?.signedUrl ? (
                  <HomePreviewImage
                    src={albumPreview.photo.signedUrl}
                    sourceWidth={albumPreview.photo.width}
                    sourceHeight={albumPreview.photo.height}
                    frameWidth={3}
                    frameHeight={2}
                  />
                ) : (
                  <span className="home-v5-empty-media" aria-hidden="true">
                    <HomeIcon icon="album" />
                  </span>
                )}
              </span>
              <span className="home-v5-preview-copy">
                <small>공유 사진</small>
                <strong>{albumTitle}</strong>
                <span>{albumMeta}</span>
              </span>
              <span className="home-v5-preview-arrow" aria-hidden="true">→</span>
            </Link>

            <Link
              href="/cards"
              className="home-v5-preview-card home-v5-secondary-preview"
              aria-label={`추억 카드, ${cardTitle}, ${cardMeta}`}
            >
              <span className="home-v5-preview-media home-v5-card-media">
                {latestCard && cardPreview?.photo?.signedUrl ? (
                  <span className="home-v5-card-thumbnail">
                    <HomePreviewImage
                      src={cardPreview.photo.signedUrl}
                      sourceWidth={cardPreview.photo.width}
                      sourceHeight={cardPreview.photo.height}
                      frameWidth={3}
                      frameHeight={2}
                    />
                  </span>
                ) : (
                  <span className="home-v5-empty-media" aria-hidden="true">
                    <HomeIcon icon="card" />
                  </span>
                )}
              </span>
              <span className="home-v5-preview-copy">
                <small>추억 카드</small>
                <strong>{cardTitle}</strong>
                <span>{cardMeta}</span>
              </span>
              <span className="home-v5-preview-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>
      {memberSwitchOpen ? (
        <div
          className="home-v5-switch-overlay"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !memberSwitchPendingRef.current
            ) {
              closeMemberSwitchDialog();
            }
          }}
        >
          <section
            ref={memberSwitchDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-member-switch-title"
            aria-describedby="home-member-switch-description"
            tabIndex={-1}
            className="home-v5-switch-dialog"
          >
            <h2 id="home-member-switch-title" className="break-keep [text-wrap:balance]">다른 가족으로 다시 입장할까요?</h2>
            <p id="home-member-switch-description">
              현재 {member.name}(으)로 입장되어 있어요. 변경하면 현재 프로필에서
              나가고 선택한 가족으로 다시 입장해요.
            </p>
            {memberSwitchError ? (
              <p className="home-v5-switch-error" role="alert">
                {memberSwitchError}
              </p>
            ) : null}
            <div className="home-v5-switch-actions">
              <button
                ref={memberSwitchCancelRef}
                type="button"
                disabled={memberSwitchPending}
                onClick={closeMemberSwitchDialog}
              >
                취소
              </button>
              <button
                type="button"
                className="home-v5-switch-confirm"
                disabled={memberSwitchPending}
                aria-busy={memberSwitchPending}
                onClick={confirmMemberSwitch}
              >
                {memberSwitchPending ? "변경하고 있어요" : "사용자 변경"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <BottomNav activeHref="/home" />
    </MobileShell>
  );
}

export default function HomePage() {
  return (
    <TripAccessGuard>
      {() => <HomeScreen />}
    </TripAccessGuard>
  );
}
