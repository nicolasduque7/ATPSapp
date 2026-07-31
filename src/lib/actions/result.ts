// Server Actions that `throw` for expected/business-rule failures lose their
// error message in production: Next.js redacts a thrown Error's `.message`
// once it crosses the Server Action -> client boundary in a prod build (dev
// builds pass it through untouched, which is why this only shows up live).
// Returning the error as ordinary data sidesteps that entirely.
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
