import { test, expect } from "@playwright/test";

// Regression test: dragging the Classes Timeline slider to its minimum, or
// moving it to any value right after it had been at its maximum, used to
// throw inside classes-timeline-chart.tsx's dot/label renderers and trip the
// app's error boundary ("Something went wrong").
test("Classes Timeline slider can move to min, to max, and to a middle value without crashing", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");
  await expect(page.getByText("Classes Timeline")).toBeVisible();

  const slider = page.getByRole("slider", { name: "Days shown before and after today" });
  await expect(slider).toBeVisible();
  await slider.focus();

  // Minimum (3) — crashed immediately pre-fix.
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("3");
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
  await expect(page.getByText("Classes Timeline")).toBeVisible();

  // Maximum (14) — didn't crash immediately pre-fix, but primed the next change to crash.
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("14");
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
  await expect(page.getByText("Classes Timeline")).toBeVisible();

  // Any other value right after max — the specific sequence that crashed pre-fix.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveValue("11");
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
  await expect(page.getByText("Classes Timeline")).toBeVisible();

  expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
