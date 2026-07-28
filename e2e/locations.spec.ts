import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

test("coach can create a location", async ({ page }) => {
  const locationName = uniqueName("E2E Court");

  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();

  await page.getByLabel("Name", { exact: true }).fill(locationName);
  await page.getByLabel("Address").fill("1 Test Way");
  await page.getByRole("radio", { name: "Hard" }).click();

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).toBeVisible();

  // Clean up: locations is a shared, club-wide table (see PROJECT.md) — a
  // leftover row here isn't scoped to this test run, so every repeated run
  // would otherwise accumulate junk data other coaches would also see.
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete location" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  // The dialog only unmounts once the delete's server round trip actually
  // resolves — waiting for it is the one reliable signal here. The
  // background row's own visibility check fires early (the dialog's
  // aria-hidden overlay already hides it while still open) and so does the
  // "Confirm delete" button's (its label flips to "Deleting…" the instant
  // the click handler runs, well before the request resolves) — both would
  // let the test end, and the browser context tearing down mid-request
  // cancels it, leaving the row orphaned.
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();
});
