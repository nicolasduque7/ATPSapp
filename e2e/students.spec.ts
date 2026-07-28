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
});
