import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

test("coach can book a class and it appears on the calendar", async ({ page }) => {
  const locationName = uniqueName("E2E Court");
  const studentName = uniqueName("E2E Student");

  // Prerequisite: a location to book at.
  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByLabel("Name", { exact: true }).fill(locationName);
  await page.getByRole("radio", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  // Prerequisite: a student to book.
  await page.goto("/students");
  await page.getByRole("button", { name: "Add student" }).click();
  await page.getByLabel("Name", { exact: true }).fill(studentName);
  await page.getByRole("radio", { name: "4ta" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  // Book a one-off class for that student, at that location.
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add class" }).click();

  await page.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: new RegExp(studentName) }).click();

  await page.getByRole("radio", { name: locationName }).click();
  await page.getByRole("radio", { name: "Private" }).click();

  // The dialog defaults to today/"now", which collides with the coach's
  // double-booking guard if a previous run of this same test left a class
  // at the same slot (the cleanup below should prevent that, but booking
  // tomorrow instead of today gives extra margin against same-day reruns
  // even if a leftover somehow survives). Matched by visible label rather
  // than a list index, since a deeper index isn't laid out/visible without
  // scrolling the popup — this custom listbox doesn't auto-scroll to it.
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();

  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "6:00 AM" }).click();
  // Wait for this popup's close transition to finish before opening the
  // next one — otherwise the two overlap mid-animation and clicks land on
  // an unstable target.
  await expect(page.getByRole("option", { name: "6:00 AM" })).not.toBeVisible();

  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "7:00 AM" }).click();

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("button", { name: "Add class" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).toBeVisible();

  // Clean up: a fixed time slot is used above for reliability (see comment),
  // so a leftover class here would collide with the next run's own booking.
  await page.getByRole("button", { name: new RegExp(studentName) }).click();
  await page.getByRole("button", { name: "Delete class" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("button", { name: new RegExp(studentName) })).not.toBeVisible();

  // The delete reminder dialog only opens once the delete's server round
  // trip has actually resolved — waiting for it (and dismissing it) before
  // the test ends avoids the browser context closing while that request is
  // still in flight, which would cancel it and leave the class orphaned.
  await page.getByRole("button", { name: "Got it" }).click();
});
