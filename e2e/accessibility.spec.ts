import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface AxeViolation {
  id: string;
  help: string;
  nodes: { html: string }[];
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  - ${n.html}`).join("\n")}`)
    .join("\n\n");
}

// react-big-calendar's own header/date-cell markup (role="columnheader" spans
// with no role="row" ancestor, role="row" divs with no gridcell children)
// doesn't satisfy these two rules. It's internal to the library's default
// rendering, not something this app's code controls without replacing its
// header/date-cell components outright — tracked as a known gap rather than
// silently ignored.
const KNOWN_LIBRARY_GAPS: Record<string, string[]> = {
  "/calendar": ["aria-required-children", "aria-required-parent"],
};

async function checkPage(page: Page, path: string): Promise<void> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(path);
  // Let client-side hydration and any on-mount effects settle before
  // reading console state — avoids relying on "networkidle", which hangs
  // on Next.js dev's persistent HMR websocket.
  await page.waitForTimeout(500);

  expect(consoleErrors, `Console errors on ${path}:\n${consoleErrors.join("\n")}`).toEqual([]);

  const knownGaps = KNOWN_LIBRARY_GAPS[path] ?? [];
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(knownGaps)
    .analyze();

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

const COACH_PAGES = ["/", "/calendar", "/locations", "/students", "/notifications", "/settings"];

for (const path of COACH_PAGES) {
  test(`${path} — no console errors, no accessibility violations`, async ({ page }) => {
    await checkPage(page, path);
  });
}

test.describe("logged out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ["/login", "/signup"]) {
    test(`${path} — no console errors, no accessibility violations`, async ({ page }) => {
      await checkPage(page, path);
    });
  }
});
