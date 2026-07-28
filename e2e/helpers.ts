import { expect, type Page } from "@playwright/test";

// Matches scripts/seed.ts / scripts/seed-coach-2.ts — seeded dev/test-only
// accounts, not secrets.
export const COACH_EMAIL = "coach@test.courtside.dev";
export const COACH_PASSWORD = "CourtsideTest123!";

// A second, separate coach account, used only by tests that perform their
// own independent login (sign-in/sign-out specs). Logging in for the same
// user concurrently from multiple test files caused real "Session not
// found" errors from Supabase (confirmed via project auth logs) — using a
// different account for those two files means they never race the shared
// session the other spec files log into once and reuse.
export const COACH2_EMAIL = "coach2@test.courtside.dev";
export const COACH2_PASSWORD = "CourtsideTest123!";

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
}
