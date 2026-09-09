# Cards watercolor layout v4

New Cards drafts use `layout_version = layout_json.version = 4` and `templateRevision = watercolor-2026-v1`. This contract supersedes the new-writer portion of `03_CARD_LAYOUT_CONTRACT.json`; its v1–v3 geometry and reader behavior remain frozen. SQL15 is a separate, unapplied release gate.

| Stable template key | Photo slots | Text + date regions | Primary caption |
| --- | --- | --- | --- |
| polaroid_moodboard | p1–p4 | 9 | main_title |
| four_cut | f1–f4 | 5 | vertical_title |
| editorial_collage | e1–e6 | 16 | main_title |
| postcard_duo | pd1–pd2 | 7 | main_title |
| scrapbook_trio | st1–st3 | 11 | main_title |
| film_contact_sheet | fc1–fc6 | 18 | main_title |
| one_moment | om1 | 4 | overlay_title |
| instant_memory | im1 | 4 | main_title |

`src/features/cards/watercolor-catalog.json` defines all 74 permitted field IDs, labels, types, defaults, photo roles and code-point/newline limits. `watercolor-template-spec.ts` defines their trusted geometry and style. `memory-card-template-spec.ts` remains the frozen v1–v3 registry. Persisted values cannot supply geometry, HTML, CSS, fonts, assets, or URLs.

A v4 payload contains exactly `version`, `templateRevision`, `slots`, `textValues`, `dateValues`, and `caption`. Every catalog field is present with a string or explicit null. Slots are complete, ordered and unique by photo UUID, including case-insensitive UUID equivalence. Each slot has exactly `slotId`, `photoId`, and `placement`; placement contains finite `zoom`, `rotation`, `offsetX`, `offsetY`. Zoom is 1–10000, rotation is [-180,180), and absolute offsets are at most 10000. Photos must belong to the current trip. JSONB text size is bounded to 32 KiB.

Text normalizes to NFC and LF at finalization; intentional nonempty spaces and newlines remain. Whitespace-only becomes null. NUL, lone surrogates and unsupported control characters are rejected. `caption` equals the normalized primary text, including null. Date-only values use exact Gregorian `YYYY-MM-DD`, 0001–9999, without timezone conversion. Trip dates are both null or an ordered valid pair. Per-photo dates are independent, initially null; Film's upper and lower date displays derive from the same key. No upload-date or reference-art date inference is used.

The accessible native dialog clones the committed draft. Only Apply replaces that draft; Cancel, Escape and backdrop dismissal discard working values. Photo annotations are held by `photoId` and semantic `caption|title|note|date` role within the current template session. Reordering projects those annotations into the new slot; replacement never copies another photo's words. Editorial e1 has no text field. Photo selection and crop have separate Apply/Cancel transactions. Template changes preserve each template's in-memory draft; closing the composer clears the session. There is no localStorage or server draft persistence.

Preview and PNG use the same 1080×1920 logical geometry, shaped horizontal text runs and upright vertical graphemes. Preview and 720 output scale that plan without reflow. Portable private Nanum fonts and actual glyph coverage are required. Pixel-fit, glyph, font, required decoration or photo failures prevent Apply/finalization/download. Overflow is reported; there is no ellipsis or automatic font shrinking. Empty values produce no placeholder in the PNG. Preview selection controls are DOM elements outside the Canvas output.

Saving freezes identity, template/revision, mapping/placement and text/date before preparing the PNG. One attempt owns one random result path; upload uses `upsert:false`, then metadata INSERT occurs once. Explicit transaction rejection permits best-effort removal of that attempt's object. Lost/ambiguous upload or INSERT responses trigger authorized read-back by the exact trip/auth/member/path and metadata. Empty or failed read-back retains the object and attempt, locks duplicate save, and offers read-back again. An identity change stops the attempt; an uploaded object that cannot safely be cleaned needs operational review under the original identity. No automatic re-INSERT or new path is used to resolve an unknown result.

Finalized rows display and download their immutable private PNG even when metadata parsing fails or source photos disappear. Unknown versions/revisions cannot be edited, reconstructed or silently downgraded. There is no saved-card edit, Album/Trip UPDATE, legacy-row UPDATE or PNG replacement.

Release order: separately approve and test SQL15 on isolated Supabase → apply DB migration → deploy the v4 writer → perform authorized real smoke tests. Until then, local mocked integration is distinct from real RLS/Storage E2E. A writer rollback may restore the v3-only policy while retaining v4 rows and stored PNG readability.
