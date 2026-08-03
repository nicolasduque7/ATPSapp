import { test as setup } from "@playwright/test";

import { STUDENT_EMAIL, STUDENT_PASSWORD, login } from "./helpers";

const authFile = "e2e/.auth/student.json";

setup("authenticate as student", async ({ page }) => {
  await login(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await page.context().storageState({ path: authFile });
});
