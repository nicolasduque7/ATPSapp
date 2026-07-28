import { test, expect } from "@playwright/test";

import { COACH2_EMAIL, COACH2_PASSWORD, login } from "./helpers";

// Uses coach 2's independent account — see helpers.ts. Signing out also
// revokes the session server-side, which is exactly the kind of action that
// must never touch the shared coach-1 session other spec files reuse.
test.use({ storageState: { cookies: [], origins: [] } });

test("coach can sign out", async ({ page }) => {
  await login(page, COACH2_EMAIL, COACH2_PASSWORD);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login/);

  // Signed out — protected pages should bounce back to /login.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
