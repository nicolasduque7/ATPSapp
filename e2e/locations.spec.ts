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
});
