# Schedule Visual Design System v1

Status: APPROVED DIRECTION / implementation lock

## 1. Core principle

The Schedule list and Schedule Detail are adjacent artboards from one family travel-journal design file. Detail must inherit the list artwork's watercolor, warm paper, floral restraint, typography, border, and shadow language; recoloring a generic modal is not acceptable.

This lock applies only to Schedule. It does not authorize a global token refactor or a new raster exception.

## 2. Schedule-scoped palette

Use Schedule-local CSS custom properties on the detail sheet:

```css
--schedule-paper: #fff7ee;
--schedule-card: #fffdf8;
--schedule-ink: #3a3028;
--schedule-copy: #66584e;
--schedule-coral: #e36a68;
--schedule-blush: #f8b8b0;
--schedule-sage: #a8b98c;
--schedule-leaf: #6f8a55;
--schedule-peach-border: #e8c9b8;
--schedule-muted-beige: #f3eee4;
--schedule-warm-shadow: 0 8px 24px rgb(98 67 47 / 9%);
```

Coral is the primary action/category color. Sage is secondary/location. Sky blue is limited to supporting travel/day artwork already present in the Schedule plate.

## 3. Surface language

- Sheet: warm ivory paper, almost full mobile height, rounded only at the top edge.
- Texture: very subtle paper grain; it must never reduce text contrast.
- Wash: restrained blush and sage watercolor-like fields, not glossy gradients.
- Cards: paper-card fill, 1px peach border, 16–22px optical radius, calm warm shadow.
- Dividers: peach or warm botanical tones; never hard gray.
- Avoid glassmorphism, SaaS/dashboard cards, sticker collage, cool gray chrome, and heavy shadows.

## 4. Typography

- Place title and section titles: existing `var(--font-editorial)` Korean editorial family.
- Body, metadata, buttons, chips, and ratings: existing `var(--font-sans)` stack.
- Do not add a font package or remote font dependency.
- Long Korean titles may wrap but must not collide with the close control at 360px.

## 5. Illustration and decoration

- Match the Schedule raster's warm watercolor/pastel character: simplified travel imagery, soft pigment edges, and botanical accents.
- Use small floral/leaf accents as punctuation, not as stickers or competing content.
- No photoreal stock imagery, 3D/glossy vectors, emoji, or unrelated icon families.
- Decorative elements are non-interactive and hidden from assistive technology.

## 6. Component mapping

| UI | Implementation lock |
| --- | --- |
| Category chip | blush/coral, pill shape, compact readable label |
| Location chip | sage/leaf, pill shape, compact readable label |
| Section card | paper card, peach border, warm shadow, editorial heading |
| Inline link | ivory paper, warm border, 44px minimum target |
| Primary action | coral fill, white label |
| Secondary action | ivory/sage treatment, leaf label |
| Close | live DOM button, 44×44px minimum target, warm paper circle |
| Drag handle | centered, reachable, warm peach tone |

## 7. Detail hierarchy

Render available content in this order:

1. drag handle
2. category/location chips and close
3. editorial place title
4. concise summary
5. small botanical accent
6. 우리 일정
7. 방문 정보
8. 평점·리뷰, only when a verified static snapshot exists
9. 주변 먹거리, maximum 3
10. 걸어서 둘러보기, maximum 3
11. snapshot/source date
12. sticky bottom actions

`어르신 체크` and `seniorNotes` are excluded.

## 8. Bottom action bar

- The action bar belongs visually and structurally to the sheet.
- It remains sticky below the independently scrolling content.
- `지도 보기` is primary; `공식 사이트` is secondary when available.
- Use an opaque paper surface rather than glass blur.
- Include `env(safe-area-inset-bottom)` without covering the final content.

## 9. Static Google/Maps snapshot policy

There is no runtime Google API.

Future researched snapshot data is stored statically in the canonical Schedule data with `rating`, `reviewCount`, `sourceLabel`, `asOf`, Maps URL, verified `walkingMinutes`/`distanceMeters`, food recommendations, and walkable attractions. The UI must never imply live updating.

Do not add a Google SDK, API key or environment variable, server route, runtime `fetch`, cache, cron, background refresh, or live-refresh state. Ordinary outbound Maps search links remain regular anchors.

## 10. Nearby content

- Food: name/category, optional verified rating and review count, verified walking time/distance, concise reason, and map action.
- Walkable attraction: name/category, verified walking time/distance, optional verified rating/review count, concise reason, and map action.
- Maximum 3 items in each group.
- Never invent rating, review count, walking time, distance, or source date.

## 11. Interaction and accessibility

- Pointer/touch activation must not leave a raw rectangular focus hotspot.
- Keyboard activation shows a rounded visible focus indicator and restores the activating control on close.
- Keep focus trap, `Escape`, backdrop close, close button, downward swipe, and reduced-motion behavior.
- Maintain semantic dialog labelling and 44px minimum interactive targets.

## 12. Responsive acceptance

Validate at 360, 375, 390, 402, and 430px:

- no horizontal overflow;
- title and close do not collide;
- cards and Korean copy remain readable;
- handle remains reachable;
- content scrolls naturally inside the sheet;
- sticky actions do not cover content and respect the safe area.

## 13. Acceptance lock

The detail screen must still read as the same Schedule visual family when its text is mentally removed. Cards, chips, actions, paper, wash, and botanical accents must look authored with the Schedule plate—not imported from a generic component library. All v28 behavior, hotspot geometry, history/deep-link behavior, data truthfulness rules, and static-data-only direction remain unchanged.
