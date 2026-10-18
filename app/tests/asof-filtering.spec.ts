import { test, expect } from "@playwright/test";
import { freshState, setAsOfPct } from "./helpers";
import { pctForDate } from "../src/lib/timelineScale";

// Requirement: "Filter documents and events by the as-of clock everywhere; D72 must not
// appear before 2028-01-26." D72 (IRS Letter 566) has received_at = 2028-01-26T15:00:00Z.
test.describe("as-of clock gates documents everywhere", () => {
  test("D72 is hidden at the default clock (2026-06-23) across documents, viewer, search, and filing", async ({ page }) => {
    await freshState(page);

    await page.goto("/documents");
    await expect(page.getByText("IRS Letter 566", { exact: false })).toHaveCount(0);

    await page.goto("/documents/D72");
    await expect(page.getByText("Not yet received")).toBeVisible();

    await page.goto("/");
    await page.waitForSelector(".cmdk-trigger"); // app mounted and its keydown listener attached
    await page.keyboard.press("Meta+K");
    await page.locator(".cmdk-input").waitFor({ state: "visible" });
    await page.locator(".cmdk-input").fill("Letter 566");
    await expect(page.locator(".cmdk-result")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/filing");
    await expect(page.getByText("Notice response: IRS Letter 566")).toHaveCount(0);
  });

  test("D72 stays hidden just before 2028-01-26, and appears just after", async ({ page }) => {
    await freshState(page);

    // The as-of slider's step (0.2% of a ~2.5-year range) is about 1.5 days, so "just
    // before/after" here means a few days either side of the boundary, not minutes - that's
    // the real precision the UI offers, and it's still well short of the 2028-01-26 date.
    await setAsOfPct(page, pctForDate("2028-01-23T00:00:00Z"));
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page.getByText("IRS Letter 566", { exact: false })).toHaveCount(0);

    await setAsOfPct(page, pctForDate("2028-01-29T00:00:00Z"));
    await expect(page.getByText("IRS Letter 566", { exact: false })).toBeVisible();

    await page.getByText("IRS Letter 566", { exact: false }).click();
    await expect(page.getByText("Not yet received")).toHaveCount(0);
    await expect(page.getByText("Examination letter received after filing")).toBeVisible();
  });

  test("Filing's Letter 566 notice-response section appears only once the clock passes D72's received_at", async ({ page }) => {
    await freshState(page);

    await page.getByRole("link", { name: "Filing lifecycle", exact: true }).click();
    await expect(page.getByText("Notice response: IRS Letter 566")).toHaveCount(0);

    await setAsOfPct(page, pctForDate("2028-01-27T00:00:00Z"));
    await expect(page.getByText("Notice response: IRS Letter 566")).toBeVisible();
  });

  test("events are as-of filtered too, not just documents", async ({ page }) => {
    await freshState(page);
    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText("RSU sales taxed with $0 basis").click();
    await page.getByRole("button", { name: "Accept adjustment" }).click();

    // Recorded "now" (at the default 2026-06-23 as-of), so it's accepted immediately.
    await expect(page.getByText("Adjustment accepted")).toBeVisible();

    // Winding the clock back before the event's own `at` hides its effect everywhere -
    // the event itself (and the fold built from it) is as-of filtered, not just documents.
    await setAsOfPct(page, pctForDate("2026-01-05T00:00:00Z"));
    await expect(page.getByText("Adjustment accepted")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Accept adjustment" })).toBeVisible();

    // Moving it back forward restores the accepted state - nothing was lost, it's just
    // filtered out of the current fold.
    await setAsOfPct(page, pctForDate("2026-06-23T23:59:59Z"));
    await expect(page.getByText("Adjustment accepted")).toBeVisible();
  });
});
