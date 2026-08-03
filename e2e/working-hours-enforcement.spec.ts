import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

// Runs as the coach (default shared session) — exercises the coach's own
// "book a class" dialog, which now has the same Available Times panel and
// working-hours enforcement as the student dialog.
test("coach booking outside working hours is blocked, and editing a class shows its own slot as available", async ({
  page,
}) => {
  const locationName = uniqueName("E2E Hours Court");
  const studentName = uniqueName("E2E Hours Student");

  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByLabel("Name", { exact: true }).fill(locationName);
  await page.getByRole("radio", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  await page.goto("/students");
  await page.getByRole("button", { name: "Add student" }).click();
  await page.getByLabel("Name", { exact: true }).fill(studentName);
  await page.getByRole("radio", { name: "4th" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  // Declare working hours 9:00-11:00 AM tomorrow at the new location.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add working hours" }).click();
  await page.getByRole("button", { name: locationName }).click();
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "9:00 AM" }).click();
  await expect(page.getByRole("option", { name: "9:00 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "11:00 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Add working hours" })).toBeVisible();

  // Open the booking dialog — the Available Times panel now exists here too.
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add class" }).click();
  await page.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: new RegExp(studentName) }).click();
  await page.getByRole("radio", { name: locationName }).click();
  await page.getByRole("radio", { name: "Private" }).click();
  await expect(page.getByText("Available Times")).toBeVisible();

  // Attempt to book OUTSIDE the declared hours (noon-1pm tomorrow) — must
  // be blocked with the new, correctly-worded message.
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "12:00 PM" }).click();
  await expect(page.getByRole("option", { name: "12:00 PM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "1:00 PM" }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByText("This time is outside the coach's working hours. See the suggested times above.")
  ).toBeVisible();
  // Nothing was created — the dialog is still open, ready to try again.
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();

  // Book WITHIN hours instead (10:15-11:00 AM — deliberately NOT 9:00-10:00,
  // since scripts/seed.ts already books this coach with Leo Martins
  // 9:30-10:15 AM tomorrow at a different location; coach conflicts are
  // location-agnostic, so it would collide) — this must succeed.
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "10:15 AM" }).click();
  await expect(page.getByRole("option", { name: "10:15 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "11:00 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Add class" })).toBeVisible();

  // Edit that same class: its own 10:15 AM slot must still show as
  // available in the panel, not excluded by its own booking (self-exclusion).
  await page.getByRole("button", { name: new RegExp(studentName) }).click();
  await expect(page.getByText("Available Times")).toBeVisible();
  await expect(page.getByRole("button", { name: "10:15 AM" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Clean up: class, then working-hours block, then student and location.
  await page.getByRole("button", { name: new RegExp(studentName) }).click();
  await page.getByRole("button", { name: "Delete class" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).not.toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();

  await page.goto("/settings");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete working hours" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // The dialog can close before the delete's server round trip actually
  // resolves — wait for the list entry itself to disappear (the one signal
  // tied to the real data change) before navigating away.
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();

  await page.goto("/students");
  await page.getByRole("button", { name: new RegExp(studentName) }).click();
  await page.getByRole("button", { name: "Delete student" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).not.toBeVisible();

  await page.goto("/locations");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete location" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();
});
