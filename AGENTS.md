# AGENTS.md

## Project
Private mobile web for the Jeonga family Fukuoka trip.

## Locked architecture
- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- react-konva later for memory-card editor

## Rules
1. Read `docs/` before making architectural decisions.
2. Treat `docs/02_FINAL_SCOPE_LOCK.md` as the scope authority.
3. Treat `docs/data/` and `docs/contracts/` as data-contract authority.
4. Treat `references/` as visual references only; never embed those mock images as product UI by default. The first narrow exception is the user-approved Feedback #01 landing raster composition: it may be used as a protected private runtime visual plate, must not be committed as a public or private-photo Git asset, must be served only through the invite-authorized private asset boundary, and must keep interactive controls and state as live DOM. The second narrow exception is the approved Feedback #03 confirm decorative plate: passenger name and role plus all interactions must remain live DOM, and the plate must use the same protected/private runtime delivery boundary. These exceptions apply only to their approved screens and are not a pattern for any other page.
5. Do not invent product features.
6. Do not add Spring Boot, Redis, queues, microservices, Redux, or unnecessary architecture.
7. Do not expose Supabase service-role secrets to client code.
8. Keep mobile-first widths 360/375/390/430 safe.
9. Run lint and build at each implementation gate.
10. Stop at the requested phase; do not continue autonomously.

## Current phase
Phase 5 — Memory Card MVP
