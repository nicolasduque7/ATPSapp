import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

test("coach can create a student", async ({ page }) => {
  const studentName = uniqueName("E2E Student");

  await page.goto("/students");
  await page.getByRole("button", { name: "Add student" }).click();

  await page.getByLabel("Name", { exact: true }).fill(studentName);
  await page.getByRole("radio", { name: "4ta" }).click();

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).toBeVisible();

  // Clean up: students is a shared, club-wide table (see PROJECT.md) — a
  // leftover row here isn't scoped to this test run, so every repeated run
  // would otherwise accumulate junk data other coaches would also see.
  await page.getByRole("button", { name: new RegExp(studentName) }).click();
  await page.getByRole("button", { name: "Delete student" }).click();
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
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).not.toBeVisible();
});
