import { test as setup } from "@playwright/test";

import { COACH_EMAIL, COACH_PASSWORD, login } from "./helpers";

const authFile = "e2e/.auth/coach.json";

setup("authenticate as coach", async ({ page }) => {
  await login(page, COACH_EMAIL, COACH_PASSWORD);
  await page.context().storageState({ path: authFile });
});
