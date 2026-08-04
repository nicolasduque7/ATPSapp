import { test, expect } from "@playwright/test";

import { uniqueName } from "./helpers";

// Coach-side multi-student (Group/Match) booking: Type is now the first
// field, picking Group/Match swaps the single student Select for a
// multi-select capped at 8, the first picked student becomes the host, and
// the rest land in class_participants (rendered as a "+N" badge).
test("coach can book a Group class with multiple students, edit the roster, and delete it", async ({ page }) => {
  const locationName = uniqueName("E2E MultiStudent Court");
  const hostName = uniqueName("E2E Host Student");
  const participantName = uniqueName("E2E Participant Student");

  // Prerequisites: a location, two students, and working hours covering the
  // class booked below (tomorrow 6:00-7:00 AM) — see booking.spec.ts for why
  // working hours are required now that they're enforced at submit time.
  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByLabel("Name", { exact: true }).fill(locationName);
  await page.getByRole("radio", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  await page.goto("/students");
  for (const name of [hostName, participantName]) {
    await page.getByRole("button", { name: "Add student" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("radio", { name: "4th" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();
  }

  await page.goto("/settings");
  await page.getByRole("button", { name: "Add working hours" }).click();
  await page.getByRole("button", { name: locationName }).click();
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "6:00 AM" }).click();
  await expect(page.getByRole("option", { name: "6:00 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "8:00 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Add working hours" })).toBeVisible();

  // Book a Group class with both students.
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add class" }).click();

  // Type is the very first field — picking Group swaps in the multi-select
  // before the Student field is even reachable, so this must happen first.
  await page.getByRole("radio", { name: "Group", exact: true }).click();
  // The multi-select is a searchable dropdown now: type a name to filter,
  // then click the matching option. Selected students render as separate
  // chips below (still plain toggle buttons, see the "Host" badge check
  // and the removal step further down).
  const studentsCombobox = page.getByRole("combobox", { name: "Students" });
  await studentsCombobox.click();
  await studentsCombobox.fill(hostName);
  await page.getByRole("option", { name: new RegExp(hostName) }).click();
  await studentsCombobox.fill(participantName);
  await page.getByRole("option", { name: new RegExp(participantName) }).click();
  // First picked student is the host — the chip shows a "Host" badge.
  await expect(page.getByRole("button", { name: new RegExp(`^${hostName}.*Host`) })).toBeVisible();

  await page.getByRole("radio", { name: locationName }).click();

  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();

  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "6:00 AM" }).click();
  await expect(page.getByRole("option", { name: "6:00 AM" })).not.toBeVisible();

  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "7:00 AM" }).click();

  await page.getByRole("button", { name: "Save" }).click();
  // Confirms the save actually succeeded (dialog closed) before moving on —
  // otherwise a rejected save leaves the dialog open, and the next locator
  // (matching bare hostName) could accidentally match this same student's
  // chip still inside the open dialog instead of a real calendar tile,
  // masking the real failure behind a confusing, unrelated assertion error.
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Class tile accessible names are "{time} · {duration} {studentName} ..." —
  // the student name is NOT at the start, so this must not be `^`-anchored
  // (unlike the multi-select chip lookups above, which do start with the name).
  // The tile's own "+N" roster badge is height-gated (hidden when the week
  // view compresses a busy slot below a pixel threshold, the same way the
  // level badge is), so it isn't a reliable assertion target here — instead,
  // reopen the class and check the roster persisted via the dialog's own
  // chip state, which is exactly what's re-verified after the edit below too.
  const classTile = page.getByRole("button", { name: new RegExp(hostName) });
  await expect(classTile).toBeVisible();
  await classTile.click();
  await expect(page.getByRole("button", { name: new RegExp(`^${hostName}.*Host`) })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^${participantName}`), pressed: true })).toBeVisible();

  // Remove the participant — roster diffing should drop their
  // class_participants row.
  await page.getByRole("button", { name: new RegExp(`^${participantName}`) }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Got it" }).click();

  const soloTile = page.getByRole("button", { name: new RegExp(hostName) });
  await expect(soloTile).toBeVisible();
  await soloTile.click();
  await expect(page.getByRole("button", { name: new RegExp(`^${participantName}`), pressed: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Clean up: delete the class, then the students/location/working-hours
  // prerequisites, same order and reasoning as booking.spec.ts.
  await soloTile.click();
  await page.getByRole("button", { name: "Delete class" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("button", { name: new RegExp(hostName) })).not.toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();

  await page.goto("/students");
  for (const name of [hostName, participantName]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Delete student" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(name) })).not.toBeVisible();
  }

  await page.goto("/settings");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete working hours" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();

  await page.goto("/locations");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete location" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();
});

// All-or-nothing conflict handling: when one of several selected students is
// already booked elsewhere at the chosen time, the save is rejected and the
// message names that specific student — nothing gets booked.
test("booking a Group class is rejected and names the conflicting student when one is already busy", async ({
  page,
}) => {
  const locationName = uniqueName("E2E Conflict Court");
  const freeStudentName = uniqueName("E2E Free Student");
  const busyStudentName = uniqueName("E2E Busy Student");

  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByLabel("Name", { exact: true }).fill(locationName);
  await page.getByRole("radio", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();

  await page.goto("/students");
  for (const name of [freeStudentName, busyStudentName]) {
    await page.getByRole("button", { name: "Add student" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("radio", { name: "4th" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel("Name", { exact: true })).not.toBeVisible();
  }

  await page.goto("/settings");
  await page.getByRole("button", { name: "Add working hours" }).click();
  await page.getByRole("button", { name: locationName }).click();
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "6:00 AM" }).click();
  await expect(page.getByRole("option", { name: "6:00 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "8:00 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Add working hours" })).toBeVisible();

  // Give the "busy" student a real Private class tomorrow 7:00-7:30 AM.
  // (Not 6:00 AM — the sibling test in this file books the shared coach
  // 6:00-7:00 AM and both tests run in parallel against the same coach
  // session, so overlapping times here would trip the coach's own
  // double-booking guard between the two tests, not the thing being tested.)
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add class" }).click();
  await page.getByRole("radio", { name: "Private", exact: true }).click();
  await page.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: new RegExp(busyStudentName) }).click();
  await page.getByRole("radio", { name: locationName }).click();
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "7:00 AM" }).click();
  await expect(page.getByRole("option", { name: "7:00 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "7:30 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  // Confirms the save succeeded (dialog closed) before the next lookup —
  // see the comment on the equivalent assertion in the test above.
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // Class tile accessible names lead with the time, not the student name —
  // no `^` anchor here (see the comment on `soloTile` in the test above).
  await expect(page.getByRole("button", { name: new RegExp(busyStudentName) })).toBeVisible();

  // Now try to book a Group class with both students at an overlapping time.
  await page.getByRole("button", { name: "Add class" }).click();
  await page.getByRole("radio", { name: "Group", exact: true }).click();
  const studentsCombobox = page.getByRole("combobox", { name: "Students" });
  await studentsCombobox.click();
  await studentsCombobox.fill(freeStudentName);
  await page.getByRole("option", { name: new RegExp(freeStudentName) }).click();
  await studentsCombobox.fill(busyStudentName);
  await page.getByRole("option", { name: new RegExp(busyStudentName) }).click();
  await page.getByRole("radio", { name: locationName }).click();
  await page.getByRole("combobox", { name: "Date" }).click();
  await page.getByRole("option", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("option", { name: /^Tomorrow/ })).not.toBeVisible();
  await page.getByRole("combobox", { name: "Start time" }).click();
  await page.getByRole("option", { name: "7:00 AM" }).click();
  await expect(page.getByRole("option", { name: "7:00 AM" })).not.toBeVisible();
  await page.getByRole("combobox", { name: "End time" }).click();
  await page.getByRole("option", { name: "7:30 AM" }).click();
  await page.getByRole("button", { name: "Save" }).click();

  // Rejected: names the busy student specifically, not a generic message.
  await expect(page.getByText(new RegExp(`${busyStudentName} is already booked`))).toBeVisible();
  // All-or-nothing: nothing new was booked (still just the one Private tile).
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`${freeStudentName}.*\\+1`) })).not.toBeVisible();

  // Clean up: the Private class, then students/location/working-hours.
  await page.getByRole("button", { name: new RegExp(busyStudentName) }).click();
  await page.getByRole("button", { name: "Delete class" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("button", { name: new RegExp(busyStudentName) })).not.toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();

  await page.goto("/students");
  for (const name of [freeStudentName, busyStudentName]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Delete student" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(name) })).not.toBeVisible();
  }

  await page.goto("/settings");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete working hours" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();

  await page.goto("/locations");
  await page.getByRole("button", { name: new RegExp(locationName) }).click();
  await page.getByRole("button", { name: "Delete location" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(locationName) })).not.toBeVisible();
});
