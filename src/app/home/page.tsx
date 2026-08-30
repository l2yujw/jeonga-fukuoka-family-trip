"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { BottomNav, MobileShell } from "@/components/ui";
import {
  loadHomeAlbumPhoto,
  loadHomeAlbumPreview,
} from "@/features/album/album-repository";
import type { AlbumPhoto } from "@/features/album/album-types";
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

type Region = { x: number; y: number; w: number; h: number };

const HOME_ARTBOARD = { width: 895, height: 1756 } as const;
const HOME_MEDIA_BLEED = 3;
const HOME_SCHEDULE_FALLBACK = {
  title: "여행 일정",
  supporting: "일정 보기",
} as const;

const regions = {
  quickSchedule: { x: 20, y: 695, w: 260, h: 259 },
  quickAlbum: { x: 299, y: 695, w: 262, h: 259 },
  quickCards: { x: 583, y: 695, w: 269, h: 259 },
  previewSchedule: { x: 18, y: 1059, w: 263, h: 532 },
  previewAlbum: { x: 294, y: 1059, w: 264, h: 532 },
  previewCards: { x: 577, y: 1059, w: 273, h: 532 },
  scheduleMask: { x: 36, y: 1168, w: 236, h: 295 },
  scheduleMedia: { x: 36, y: 1164, w: 235, h: 241 },
  scheduleTitle: { x: 40, y: 1482, w: 235, h: 47 },
  scheduleMeta: { x: 40, y: 1529, w: 235, h: 58 },
  albumMask: { x: 322, y: 1168, w: 238, h: 295 },
  albumSingle: { x: 322, y: 1168, w: 237, h: 281 },
  albumTitle: { x: 326, y: 1482, w: 230, h: 47 },
  albumCount: { x: 326, y: 1529, w: 230, h: 58 },
  cardMask: { x: 609, y: 1168, w: 242, h: 295 },
  cardThumbnail: { x: 610, y: 1168, w: 240, h: 295 },
  cardTitle: { x: 615, y: 1482, w: 230, h: 47 },
  cardMeta: { x: 615, y: 1529, w: 230, h: 58 },
} as const satisfies Record<string, Region>;

const regionStyle = ({ x, y, w, h }: Region): CSSProperties => ({
  left: `${(x / HOME_ARTBOARD.width) * 100}%`,
  top: `${(y / HOME_ARTBOARD.height) * 100}%`,
  width: `${(w / HOME_ARTBOARD.width) * 100}%`,
  height: `${(h / HOME_ARTBOARD.height) * 100}%`,
});

const mediaRegionStyle = ({ x, y, w, h }: Region) =>
  regionStyle({
    x: x - HOME_MEDIA_BLEED,
    y: y - HOME_MEDIA_BLEED,
    w: w + HOME_MEDIA_BLEED * 2,
    h: h + HOME_MEDIA_BLEED * 2,
  });

const quickActions = [
  { href: "/schedule", label: "여행 일정", region: regions.quickSchedule },
  { href: "/album", label: "사진 공유", region: regions.quickAlbum },
  { href: "/cards", label: "추억 카드 만들기", region: regions.quickCards },
] as const;

const previewLinks = [
  { href: "/schedule", label: "여행 일정 미리보기", region: regions.previewSchedule },
  { href: "/album", label: "공유 사진 미리보기", region: regions.previewAlbum },
  { href: "/cards", label: "추억 카드 미리보기", region: regions.previewCards },
] as const;

function HomePreviewImage({
  src,
  sourceWidth = null,
  sourceHeight = null,
  region,
}: {
  src: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  region: Region;
}) {
  const initialFit = getHomeImageFit(
    sourceWidth,
    sourceHeight,
    region.w,
    region.h,
  );

  return (
    // Only the single selected runtime image URL is mounted.
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
          region.w,
          region.h,
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
  const { trip } = useCurrentTripSession();
  const [scheduleCopy, setScheduleCopy] = useState<{
    tripId: string;
    dayNo: number;
    title: string;
    supporting: string;
  } | null>(null);
  const [albumPreview, setAlbumPreview] = useState<{
    count: number;
    photo: AlbumPhoto | null;
  } | null>(null);
  const [cardPreview, setCardPreview] = useState<{
    card: MemoryCard | null;
    photo: AlbumPhoto | null;
  } | null>(null);
  const schedule = getHomeSchedulePreview();
  const currentScheduleCopy =
    scheduleCopy?.tripId === trip.id && scheduleCopy.dayNo === schedule.dayNo
      ? scheduleCopy
      : null;
  const scheduleTitle = currentScheduleCopy?.title ?? "여행 일정";
  const scheduleSupporting =
    currentScheduleCopy?.supporting ?? "일정을 불러오는 중";
  const latestCard = cardPreview?.card;
  const latestCardTemplate = latestCard
    ? getMemoryCardTemplateSpec(latestCard.templateKey)?.displayName
    : null;
  const albumTitle =
    albumPreview === null
      ? "사진을 불러오는 중"
      : albumPreview.count
        ? "함께한 순간들"
        : "아직 공유된 사진이 없어요";
  const albumMeta = albumPreview?.count ? `사진 ${albumPreview.count}장` : "";
  const cardTitle =
    cardPreview === null
      ? "카드를 불러오는 중"
      : latestCard
        ? latestCard.creatorName
          ? `${latestCard.creatorName}님의 카드`
          : "가장 최근 추억 카드"
        : "우리만의 추억 카드를 만들어보세요";
  const previewAccessibleDetails = {
    "/schedule": `${scheduleTitle}, ${scheduleSupporting}`,
    "/album": `${albumTitle}${albumMeta ? `, ${albumMeta}` : ""}`,
    "/cards": `${cardTitle}${latestCardTemplate ? `, ${latestCardTemplate}` : ""}`,
  } as const;

  useEffect(() => {
    let active = true;

    async function loadScheduleCopy() {
      try {
        const { data, error } = await getSupabaseBrowserClient()
          .from("itinerary_items")
          .select(
            "day_no,sequence,time_label,location_name,title,description,item_type",
          )
          .eq("trip_id", trip.id)
          .eq("day_no", schedule.dayNo)
          .order("sequence", { ascending: true });

        if (!active) return;
        if (error) throw error;

        setScheduleCopy({
          tripId: trip.id,
          dayNo: schedule.dayNo,
          ...(createHomeSchedulePreviewCopy(
            (data ?? []) as ItineraryItemRow[],
            trip.startDate,
            schedule.dayNo,
          ) ?? HOME_SCHEDULE_FALLBACK),
        });
      } catch {
        if (active) {
          setScheduleCopy({
            tripId: trip.id,
            dayNo: schedule.dayNo,
            ...HOME_SCHEDULE_FALLBACK,
          });
        }
      }
    }

    void loadScheduleCopy();

    return () => {
      active = false;
    };
  }, [schedule.dayNo, trip.id, trip.startDate]);

  useEffect(() => {
    let active = true;

    void loadHomeAlbumPreview(trip.id).then(
      (preview) => {
        if (active) setAlbumPreview(preview);
      },
      () => {
        if (active) setAlbumPreview({ count: 0, photo: null });
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
        if (active) setCardPreview({ card: null, photo: null });
      },
    );

    return () => {
      active = false;
    };
  }, [trip.id]);

  return (
    <MobileShell className="home-page-shell">
      <main
        className="home-artboard"
        aria-labelledby="home-title"
        aria-describedby="home-trip-summary"
      >
        <h1 id="home-title" className="sr-only">
          {trip.title}
        </h1>
        <p id="home-trip-summary" className="sr-only">
          {trip.startDate}부터 {trip.endDate}까지, 가족 10명 여행
        </p>

        <Image
          src="/api/home-visual"
          alt=""
          aria-hidden="true"
          width={HOME_ARTBOARD.width}
          height={HOME_ARTBOARD.height}
          draggable="false"
          priority
          unoptimized
          className="home-runtime-base"
        />

        <div className="home-overlay-root">
          <div
            aria-hidden="true"
            className="home-dynamic-media home-preview-media-mask"
            style={mediaRegionStyle(regions.scheduleMask)}
          />
          <div
            aria-hidden="true"
            className="home-dynamic-media home-schedule-clip"
            data-home-media="schedule"
            style={mediaRegionStyle(regions.scheduleMedia)}
          >
            <div className="home-media-fill home-schedule-media">
              <span className="home-schedule-badge">{schedule.label}</span>
            </div>
          </div>
          <p
            className="home-dynamic-copy home-schedule-title"
            style={regionStyle(regions.scheduleTitle)}
          >
            {scheduleTitle.replaceAll(" · ", "\u00a0· ")}
          </p>
          <p
            className="home-dynamic-copy home-schedule-meta"
            style={regionStyle(regions.scheduleMeta)}
          >
            {scheduleSupporting.replaceAll(" · ", "\u00a0· ")}
          </p>

          <div
            aria-hidden="true"
            className="home-dynamic-media home-preview-media-mask"
            style={mediaRegionStyle(regions.albumMask)}
          />
          <div
            aria-hidden="true"
            className="home-dynamic-media home-album-photo"
            data-home-media="album"
            style={mediaRegionStyle(regions.albumSingle)}
          >
            {albumPreview?.photo?.signedUrl && (
              <HomePreviewImage
                src={albumPreview.photo.signedUrl}
                sourceWidth={albumPreview.photo.width}
                sourceHeight={albumPreview.photo.height}
                region={regions.albumSingle}
              />
            )}
          </div>
          <p
            className="home-dynamic-copy home-album-title"
            style={regionStyle(regions.albumTitle)}
          >
            {albumTitle}
          </p>
          <p
            className="home-dynamic-copy home-album-count"
            style={regionStyle(regions.albumCount)}
          >
            {albumMeta}
          </p>

          <div
            aria-hidden="true"
            className="home-dynamic-media home-preview-media-mask"
            style={mediaRegionStyle(regions.cardMask)}
          />
          <div
            aria-hidden="true"
            className={`home-dynamic-media home-memory-clip${cardPreview === null ? " home-memory-thumbnail--loading" : latestCard ? "" : " home-memory-thumbnail--empty"}`}
            data-home-media="memory-card"
            style={mediaRegionStyle(regions.cardThumbnail)}
          >
            {latestCard && (
              <div className="home-memory-card-thumbnail">
                {cardPreview.photo?.signedUrl && (
                  <HomePreviewImage
                    src={cardPreview.photo.signedUrl}
                    sourceWidth={cardPreview.photo.width}
                    sourceHeight={cardPreview.photo.height}
                    region={regions.cardThumbnail}
                  />
                )}
              </div>
            )}
          </div>
          <p
            className="home-dynamic-copy home-card-title"
            style={regionStyle(regions.cardTitle)}
          >
            {cardTitle}
          </p>
          <p
            className="home-dynamic-copy home-card-meta"
            style={regionStyle(regions.cardMeta)}
          >
            {latestCardTemplate ?? ""}
          </p>

          {quickActions.map(({ href, label, region }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="home-hit-area home-quick-link"
              style={regionStyle(region)}
            />
          ))}
          {previewLinks.map(({ href, label, region }) => (
            <Link
              key={`preview-${href}`}
              href={href}
              aria-label={`${label}: ${previewAccessibleDetails[href]}`}
              className="home-hit-area home-preview-link"
              style={regionStyle(region)}
            />
          ))}
        </div>
      </main>
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
