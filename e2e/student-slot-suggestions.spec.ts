import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

// Runs as the student (not the shared coach session other spec files reuse)
// — see student-auth.setup.ts / helpers.ts.
test.use({ storageState: "e2e/.auth/student.json" });

// Matches scripts/seed.ts's TEST_COACH_EMAIL user_metadata.full_name.
const COACH_NAME = "Alex Rivera";

test("student sees available time suggestions when booking a class", async ({ page, browser }) => {
  const locationName = uniqueName("E2E Slots Court");
  const emptyLocationName = uniqueName("E2E Empty Court");

  // Coach-side setup (working hours + an existing booking) needs its own
  // authenticated context — the default `page` above is the student.
  const coachContext = await browser.newContext({ storageState: "e2e/.auth/coach.json" });
  const coachPage = await coachContext.newPage();

  try {
    // Two locations: one gets working hours + a booking (to prove the panel
    // excludes booked time), the other gets nothing at all (empty-window case).
    await coachPage.goto("/locations");
    for (const name of [locationName, emptyLocationName]) {
      await coachPage.getByRole("button", { name: "Add location" }).click();
      await coachPage.getByLabel("Name", { exact: true }).fill(name);
      await coachPage.getByRole("radio", { name: "Hard" }).click();
      await coachPage.getByRole("button", { name: "Save" }).click();
      await expect(coachPage.getByLabel("Name", { exact: true })).not.toBeVisible();
    }

    // Declare today's working hours 8:00 AM - 11:00 AM at `locationName`.
    await coachPage.goto("/settings");
    await coachPage.getByRole("button", { name: "Add working hours" }).click();
    await coachPage.getByRole("button", { name: locationName }).click();
    await coachPage.getByRole("combobox", { name: "Start time" }).click();
    await coachPage.getByRole("option", { name: "8:00 AM" }).click();
    await expect(coachPage.getByRole("option", { name: "8:00 AM" })).not.toBeVisible();
    await coachPage.getByRole("combobox", { name: "End time" }).click();
    await coachPage.getByRole("option", { name: "11:00 AM" }).click();
    await coachPage.getByRole("button", { name: "Save" }).click();
    await expect(coachPage.getByRole("button", { name: "Add working hours" })).toBeVisible();

    // Deliberately book no class here: scripts/seed.ts already books this
    // coach with Ana Reyes 8:00-9:00 AM today (at a different location —
    // coach conflicts, and therefore the busy-interval RPC this panel reads,
    // are location-agnostic, so it counts against ANY location's working
    // hours). That pre-existing booking is exactly the "already busy" time
    // this test needs, without risking a double-booking of its own.

    // Student side: open the booking dialog and check the suggestions panel.
    await page.goto("/student/calendar");
    await page.getByRole("button", { name: "Book a class" }).click();

    await page.getByRole("combobox", { name: "Coach" }).click();
    await page.getByRole("option", { name: COACH_NAME }).click();
    await page.getByRole("radio", { name: locationName }).click();

    await expect(page.getByText("Available Times")).toBeVisible();
    // 8-9 AM is booked (seed.ts's Ana Reyes class); 9:00/9:30/10:00 AM are
    // the 60-min-duration start times that fit in what's left of the
    // declared 8-11 AM window.
    await expect(page.getByRole("button", { name: "9:00 AM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "9:30 AM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "10:00 AM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "8:00 AM" })).not.toBeVisible();

    await page.getByRole("button", { name: "9:30 AM" }).click();
    await expect(page.getByRole("combobox", { name: "Start time" })).toContainText("9:30 AM");
    await expect(page.getByRole("combobox", { name: "End time" })).toContainText("10:30 AM");

    // A location with no declared working hours anywhere shows the
    // fully-exhausted-window empty state instead of any slot buttons.
    await page.getByRole("radio", { name: emptyLocationName }).click();
    await expect(
      page.getByText("No availability found in the next 14 days for this coach at this location.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    // Clean up: the working-hours block (nothing was booked in this test),
    // then both locations this test created.
    await coachPage.goto("/settings");
    await coachPage.getByRole("button", { name: new RegExp(locationName) }).click();
    await coachPage.getByRole("button", { name: "Delete working hours" }).click();
    await coachPage.getByRole("button", { name: "Confirm delete" }).click();
    await expect(coachPage.getByRole("dialog")).not.toBeVisible();
    // The dialog can close before the delete's server round trip actually
    // resolves — wait for the list entry itself to disappear before
    // navigating away.
    await expect(coachPage.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();

    await coachPage.goto("/locations");
    for (const name of [locationName, emptyLocationName]) {
      await coachPage.getByRole("button", { name: new RegExp(name) }).click();
      await coachPage.getByRole("button", { name: "Delete location" }).click();
      await coachPage.getByRole("button", { name: "Confirm delete" }).click();
      await expect(coachPage.getByRole("dialog")).not.toBeVisible();
      await expect(coachPage.getByRole("button", { name: new RegExp(name) })).not.toBeVisible();
    }
  } finally {
    await coachContext.close();
  }
});

test("student booking outside working hours is blocked", async ({ page, browser }) => {
  const locationName = uniqueName("E2E Hours Court");

  const coachContext = await browser.newContext({ storageState: "e2e/.auth/coach.json" });
  const coachPage = await coachContext.newPage();

  try {
    await coachPage.goto("/locations");
    await coachPage.getByRole("button", { name: "Add location" }).click();
    await coachPage.getByLabel("Name", { exact: true }).fill(locationName);
    await coachPage.getByRole("radio", { name: "Hard" }).click();
    await coachPage.getByRole("button", { name: "Save" }).click();
    await expect(coachPage.getByLabel("Name", { exact: true })).not.toBeVisible();

    // Declare working hours 9:00-11:00 AM tomorrow.
    await coachPage.goto("/settings");
    await coachPage.getByRole("button", { name: "Add working hours" }).click();
    await coachPage.getByRole("button", { name: locationName }).click();
    await coachPage.getByRole("combobox", { name: "Date" }).click();
    await coachPage.getByRole("option", { name: /^Tomorrow/ }).click();
    await expect(coachPage.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
    await coachPage.getByRole("combobox", { name: "Start time" }).click();
    await coachPage.getByRole("option", { name: "9:00 AM" }).click();
    await expect(coachPage.getByRole("option", { name: "9:00 AM" })).not.toBeVisible();
    await coachPage.getByRole("combobox", { name: "End time" }).click();
    await coachPage.getByRole("option", { name: "11:00 AM" }).click();
    await coachPage.getByRole("button", { name: "Save" }).click();
    await expect(coachPage.getByRole("button", { name: "Add working hours" })).toBeVisible();

    // Student attempts to book OUTSIDE those hours (2:00-3:00 PM tomorrow)
    // — must be blocked with the new, correctly-worded message, and nothing
    // gets created.
    await page.goto("/student/calendar");
    await page.getByRole("button", { name: "Book a class" }).click();
    await page.getByRole("combobox", { name: "Coach" }).click();
    await page.getByRole("option", { name: COACH_NAME }).click();
    await page.getByRole("radio", { name: locationName }).click();
    await page.getByRole("radio", { name: "Private" }).click();
    await expect(page.getByText("Available Times")).toBeVisible();

    await page.getByRole("combobox", { name: "Date" }).click();
    await page.getByRole("option", { name: /^Tomorrow/ }).click();
    await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
    await page.getByRole("combobox", { name: "Start time" }).click();
    await page.getByRole("option", { name: "2:00 PM", exact: true }).click();
    await expect(page.getByRole("option", { name: "2:00 PM", exact: true })).not.toBeVisible();
    await page.getByRole("combobox", { name: "End time" }).click();
    await page.getByRole("option", { name: "3:00 PM", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("This time is outside the coach's working hours. See the suggested times above.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    // Clean up.
    await coachPage.goto("/settings");
    await coachPage.getByRole("button", { name: new RegExp(locationName) }).click();
    await coachPage.getByRole("button", { name: "Delete working hours" }).click();
    await coachPage.getByRole("button", { name: "Confirm delete" }).click();
    await expect(coachPage.getByRole("dialog")).not.toBeVisible();
    await expect(coachPage.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();

    await coachPage.goto("/locations");
    await coachPage.getByRole("button", { name: new RegExp(locationName) }).click();
    await coachPage.getByRole("button", { name: "Delete location" }).click();
    await coachPage.getByRole("button", { name: "Confirm delete" }).click();
    await expect(coachPage.getByRole("dialog")).not.toBeVisible();
    await expect(coachPage.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();
  } finally {
    await coachContext.close();
  }
});
