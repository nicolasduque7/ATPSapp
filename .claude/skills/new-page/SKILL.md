---
name: new-page
description: Use when building a brand-new page/route in CourtSide. Enforces
  our standard page structure, states, and quality bar so every page is
  consistent.
---

# How to build a new page

1. Create the route under `src/app/` with the shared layout shell.
2. Start with mock data from `src/lib/mock-data.ts` (until Phase 5).
3. Apply the `design-system` skill for all styling.
4. Implement loading, empty, and error states.
5. Make it responsive (390 / 768 / 1440).
6. Verify light and dark themes.
7. Run the two-pass screenshot workflow per CLAUDE.md (baseline → change →
   verify, stored in `.screenshots/`). Compare to the reference if one exists.
8. Commit with a clear message.
