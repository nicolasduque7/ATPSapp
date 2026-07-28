import { test, expect } from "@playwright/test";

import { COACH2_EMAIL, COACH2_PASSWORD } from "./helpers";

// Uses coach 2's independent account, not the shared session other spec
// files reuse via storageState — see helpers.ts for why (concurrent logins
// for the same user raced and produced real "Session not found" errors).
// Serial because these two tests would otherwise log in as coach 2
// concurrently with each other, the same race in miniature.
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

test("coach can sign in with email and password", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(COACH2_EMAIL);
  await page.getByLabel("Password").fill(COACH2_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
});

test("wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(COACH2_EMAIL);
  await page.getByLabel("Password").fill("not-the-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
