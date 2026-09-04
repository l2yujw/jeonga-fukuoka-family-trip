import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const readAlbumSources = async () => {
  const [page, view, css, ui, route, config] = await Promise.all([
    readFile(new URL("../../app/album/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./album-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../components/ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/album-asset/[asset]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../next.config.ts", import.meta.url), "utf8"),
  ]);
  return { page, view, css, ui, route, config };
};

test("Album restores the shared BottomNav and preserves composer visibility behavior", async () => {
  const { page, ui } = await readAlbumSources();

  assert.match(page, /import \{ BottomNav, MobileShell \} from "@\/components\/ui"/);
  assert.match(page, /<AlbumView onComposerOpenChange=\{setIsComposerOpen\} \/>/);
  assert.match(page, /!isComposerOpen && <BottomNav activeHref="\/album" \/>/);
  assert.match(ui, /export function BottomNav/);
  assert.equal((ui.match(/href: "\/(?:home|schedule|album|cards)"/g) ?? []).length, 4);
});

test("Album keeps live UI around exactly two protected decorative crops", async () => {
  const { page, view, css, route, config } = await readAlbumSources();
  const runtime = `${page}\n${view}\n${css}\n${route}\n${config}`;
  const assetDirectory = new URL("../../../private-assets/album/", import.meta.url);
  const assetNames = [
    "Jeonga_Fukuoka_Album_OurMomentsGarden_v1.png",
    "Jeonga_Fukuoka_Album_TopFloral_v1.png",
  ];

  for (const copy of [
    "FUKUOKA · FAMILY ALBUM",
    "함께한 사진",
    "가족의 추억 기록",
    "OUR MOMENTS",
    "여행의 장면들",
  ]) {
    assert.match(view, new RegExp(copy));
  }

  assert.match(view, /trip\.startDate\.replaceAll\("-", "\."\)/);
  assert.match(view, /trip\.endDate\.slice\(5\)\.replace\("-", "\."\)/);
  assert.match(view, /album-photo-count">\{photos\.length\}장/);
  assert.match(view, /id="album-photo-picker"[\s\S]*multiple[\s\S]*onChange=\{handleFileChange\}/);
  assert.match(view, /onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/);
  assert.match(view, /const filterSummary = `\$\{selectedUploaderLabel\}[\s\S]*\$\{groupMode/);
  assert.match(view, /const \[isFilterPanelOpen, setIsFilterPanelOpen\] = useState\(false\)/);
  assert.match(view, /album-filter-summary[\s\S]*album-filter-label[\s\S]*album-filter-value[\s\S]*\{filterSummary\}/);
  assert.match(css, /\.album-filter-summary\s*\{[\s\S]*min-height: 44px;[\s\S]*gap: 0;[\s\S]*padding: 5px 14px/);
  assert.match(css, /\.album-filter-summary > svg\s*\{[\s\S]*width: 18px;[\s\S]*margin-right: 11px/);
  assert.match(css, /\.album-filter-label\s*\{[\s\S]*margin-right: 17px/);
  assert.match(css, /\.album-filter-chevron\s*\{[\s\S]*margin-left: 12px/);
  assert.match(css, /\.album-filter\s*\{[\s\S]*margin-top: 20px/);
  assert.match(css, /\.album-filter-panel\s*\{[\s\S]*position: absolute;[\s\S]*max-height: 128px;[\s\S]*padding: 7px 10px/);
  assert.match(view, /ref=\{filterRef\}[\s\S]*className="album-filter"/);
  assert.match(view, /document\.addEventListener\("pointerdown", closeOnOutsidePress\)/);
  assert.match(view, /event\.key !== "Escape"/);
  assert.match(view, /className="album-uploader-options"/);
  assert.match(css, /\.album-uploader-options\s*\{[\s\S]*overflow-x: auto/);
  assert.match(css, /\.album-uploader-option\s*\{[\s\S]*min-height: 30px;[\s\S]*white-space: nowrap/);
  assert.match(view, /className="album-filter-groups"/);
  assert.match(css, /\.album-filter-groups\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*margin-top: 3px/);
  assert.match(css, /\.album-filter-group > div\s*\{[\s\S]*min-height: 31px;[\s\S]*margin-top: 3px/);
  assert.match(css, /\.album-masonry\s*\{[\s\S]*margin-top: 11px/);
  assert.match(css, /\.album-photo-caption\s*\{[\s\S]*font-size: 14px/);
  assert.match(css, /\.album-photo-meta\s*\{[\s\S]*font-size: 11\.5px/);
  assert.match(view, /function AlbumHeroBotanical\(\)[\s\S]*<img[\s\S]*TopFloral_v1\.png[\s\S]*alt=""[\s\S]*aria-hidden="true"[\s\S]*className="album-hero-botanical"/);
  assert.match(view, /function AlbumMomentsBotanical\(\)[\s\S]*<img[\s\S]*OurMomentsGarden_v1\.png[\s\S]*alt=""[\s\S]*aria-hidden="true"[\s\S]*className="album-moments-botanical"/);
  assert.match(css, /\.album-hero-botanical\s*\{[\s\S]*position: absolute;[\s\S]*top: -19px;[\s\S]*right: -28px;[\s\S]*width: 106px;[\s\S]*mix-blend-mode: multiply;[\s\S]*pointer-events: none/);
  assert.match(css, /\.album-moments-botanical\s*\{[\s\S]*position: absolute;[\s\S]*right: -14px;[\s\S]*bottom: -20px;[\s\S]*width: 136px;[\s\S]*mix-blend-mode: multiply;[\s\S]*pointer-events: none/);
  assert.doesNotMatch(view, /albumHeroPetal|albumGardenPine|<feTurbulence/);
  assert.deepEqual((await readdir(assetDirectory)).sort(), assetNames);
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /serveLandingVisual\(/);
  assert.match(route, /"private-assets", "album", filename/);
  assert.match(config, /"\/api\/album-asset\/\[asset\]": \["\.\/private-assets\/album\/\*\*\/\*"\]/);
  assert.match(view, /\[0, 1\]\.map\(\(column\)/);
  assert.match(view, /index % 2 === column/);
  assert.match(css, /\.album-masonry\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 375px\)[\s\S]*\.album-page-main/);
  assert.doesNotMatch(
    runtime,
    /Jeonga_Fukuoka_Album_(?:SINGLE_VisualAuthority|VisualAuthority|Redline)|jeonga-album-exact-visual-v1|references\/04_album/i,
  );
  assert.doesNotMatch(`${page}\n${view}`, /(?:\/api\/|private-assets\/)schedule(?:-asset)?\//);
});

test("Album actions and real-data paths remain intact without mock gallery content", async () => {
  const { view } = await readAlbumSources();

  assert.match(view, /<details className="album-photo-actions">/);
  assert.match(view, /downloadAlbumPhoto\(photo\)/);
  assert.match(view, /updateAlbumPhotoCaption\(photo, editedCaption\)/);
  assert.match(view, /deleteAlbumPhoto\(photo\)/);
  assert.match(view, /photo\.isOwner/);
  assert.match(view, /photo\.caption/);
  assert.match(view, /photo\.uploaderName/);
  assert.doesNotMatch(view, /14장|하카타 라멘|다자이후|제주항공|여행 포스터|호후 공원/);
});
