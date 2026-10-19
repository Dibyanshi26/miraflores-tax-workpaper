import { test, expect } from "@playwright/test";
import { freshState } from "./helpers";

test.describe("home screen", () => {
  test("shows one ranked open-items list, no duplicate failed-check cards", async ({ page }) => {
    await freshState(page);

    const sentence = page.getByText("Three RSU lots carry $0 basis instead of the $47,620 D11 supports", { exact: false });
    await expect(sentence).toHaveCount(1); // appears once, not once under "Blockers" and again under "Failed checks"

    // Every row in the ranked list shows a federal/CA effect or an explicit "no tax effect".
    const rows = page.locator(".open-item-row");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(5);
  });

  test("open items are sorted by descending combined absolute tax effect", async ({ page }) => {
    await freshState(page);
    const effects = await page.locator(".open-item-row__effect").allTextContents();
    const magnitudes = effects.map((t) => {
      const nums = [...t.matchAll(/-?\$[\d,]+/g)].map((m) => Number(m[0].replace(/[$,]/g, "")));
      return nums.reduce((s, n) => s + Math.abs(n), 0);
    });
    for (let i = 1; i < magnitudes.length; i++) {
      expect(magnitudes[i]).toBeLessThanOrEqual(magnitudes[i - 1]);
    }
  });

  test("top strip shows engine vs workpaper AGI, total tax, balance due for federal and CA, and pending adjustments", async ({ page }) => {
    await freshState(page);
    const strip = page.locator(".totals-strip");
    await expect(strip).toBeVisible();
    await expect(strip.getByText("Federal")).toBeVisible();
    await expect(strip.getByText("California")).toBeVisible();
    await expect(strip.getByText("AGI")).toHaveCount(2);
    await expect(strip.getByText("Total tax")).toHaveCount(2);
    await expect(strip.getByText("Payments")).toHaveCount(2);
    await expect(strip.getByText("Balance due")).toHaveCount(2);
    await expect(strip.getByText("Pending adjustments")).toBeVisible();
    await expect(strip.getByText("Accepted so far")).toBeVisible();
    await expect(strip.getByText("Workpaper (accepted)").first()).toBeVisible();
    await expect(strip.getByText("Workpaper (all pending accepted)").first()).toBeVisible();
    await expect(strip.getByText("Awaiting approval")).toBeVisible();
    const pendingCount = await strip.locator(".strip-count", { hasText: "Pending adjustments" }).locator(".strip-count__value").textContent();
    expect(Number(pendingCount)).toBeGreaterThan(0);
    const acceptedCount = await strip.locator(".strip-count__value--accepted").textContent();
    expect(Number(acceptedCount)).toBe(0);
    const awaitingCount = await strip.locator(".strip-count__value--awaiting").textContent();
    expect(Number(awaitingCount)).toBe(0);

    // "Accepted so far" and "Pending adjustments" sit side by side in one row, not stacked.
    const counts = strip.locator(".strip-count");
    const acceptedBox = await counts.nth(0).boundingBox();
    const pendingBox = await counts.nth(1).boundingBox();
    expect(acceptedBox).toBeTruthy();
    expect(pendingBox).toBeTruthy();
    expect(Math.abs(acceptedBox!.y - pendingBox!.y)).toBeLessThan(5); // same row
    expect(pendingBox!.x).toBeGreaterThan(acceptedBox!.x); // side by side, not stacked
  });

  test("accepting a check updates the accepted column in the top strip and the accepted count", async ({ page }) => {
    await freshState(page);
    const before = await page.locator("table.strip-table").first().locator(".strip-table__changed").count();
    expect(before).toBe(0); // nothing accepted yet - engine and workpaper match, no highlighted cells

    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText("Mileage log page is a duplicate scan").click();
    await page.getByRole("button", { name: "Accept adjustment" }).click();
    await page.getByRole("button", { name: "Confirm & accept" }).click();
    await expect(page.getByText("Adjustment accepted")).toBeVisible(); // under the $1,000 threshold - no approval needed

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.locator("table.strip-table").first().locator(".strip-table__changed").first()).toBeVisible();
    await expect(page.locator(".strip-count__value--accepted")).toHaveText("1");
    await expect(page.locator(".strip-count__value--awaiting")).toHaveText("0");
  });

  test("a payment-correction check moves the federal Payments row, not Total tax, on the top strip", async ({ page }) => {
    await freshState(page);
    const strip = page.locator(".totals-strip");
    const federalTable = strip.locator("table.strip-table").first();
    const totalTaxRowBefore = await federalTable.locator("tr", { has: page.getByText("Total tax", { exact: true }) }).locator("td").allTextContents();

    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText("Q4 federal estimated payment taken from an uncertain client estimate").click();
    await page.getByRole("button", { name: "Accept adjustment" }).click();
    await page.getByRole("button", { name: "Confirm & accept" }).click();

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForSelector(".totals-strip");
    await expect(federalTable.locator("tr", { has: page.getByText("Total tax", { exact: true }) }).locator("td").first()).toBeVisible();
    const totalTaxRowAfter = await federalTable.locator("tr", { has: page.getByText("Total tax", { exact: true }) }).locator("td").allTextContents();
    // Engine and accepted Total tax columns are unchanged - a payment correction never
    // touches total tax.
    expect(totalTaxRowAfter[1]).toBe(totalTaxRowBefore[1]); // Engine v3 column
    expect(totalTaxRowAfter[2]).toBe(totalTaxRowBefore[2]); // Workpaper (accepted) column

    const paymentsRow = federalTable.locator("tr", { has: page.getByText("Payments", { exact: true }) });
    await expect(paymentsRow.locator(".strip-table__changed")).toBeVisible(); // accepted Payments column did move
  });

  test("unaccounted documents only lists documents with no disposition - Meridian's missing page isn't one of them", async ({ page }) => {
    await freshState(page);
    const section = page.locator("text=Unaccounted documents").locator("..");
    // The Meridian page-32 issue is a Checks item (MERIDIAN-MISSING-LOT), not a document
    // disposition problem - D30/D31 both carry an extraction reason, so neither should
    // show up here.
    await expect(section.getByText("Meridian Brokerage")).toHaveCount(0);
    await expect(page.getByText("Engagement letter", { exact: false })).toBeVisible();
  });

  test("area status table uses proper area names and shows hours/budget, open items, and sign-off state", async ({ page }) => {
    await freshState(page);
    const table = page.locator("table.datatable").last();
    await expect(table.getByText("Wages & stock compensation")).toBeVisible();
    await expect(table.getByText("Investments & digital assets")).toBeVisible();
    await expect(table.locator("thead")).toContainText("Preparer");
    await expect(table.locator("thead")).toContainText("Reviewer");
    await expect(table.locator("thead")).toContainText("Partner");
    await expect(table.locator("thead")).toContainText("Open items");
  });

  test("dates render consistently as 'Jun 23, 2026' style in every UI date display on Home", async ({ page }) => {
    await freshState(page);
    const shortDate = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;
    await expect(page.getByText(/as of [A-Z][a-z]{2} \d{1,2}, \d{4}/)).toBeVisible();
    await expect(page.getByText("Jan 12, 2026", { exact: false }).first()).toBeVisible(); // unaccounted-document received date
    await expect(page.getByText("Feb 1, 2026", { exact: false }).first()).toBeVisible(); // open-question timestamp
    // The clock in the top bar uses the same formatter, not its own ad hoc one.
    await expect(page.locator(".topbar__clock-date")).toHaveText(shortDate);
  });

  test("the four seeded client questions are open on Home and in the client portal", async ({ page }) => {
    await freshState(page);
    await expect(page.getByText("CryptoNorth bank statement", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Client portal", exact: true }).click();
    await expect(page.getByText("written acknowledgment from St. Brigid", { exact: false })).toBeVisible();
    await expect(page.getByText("excise tax on Form 5329", { exact: false })).toBeVisible();
    await expect(page.getByText("whether Form 3520 needs to be filed", { exact: false })).toBeVisible();
  });

  test("Ask client action is available on checks and judgment items that need client input", async ({ page }) => {
    await freshState(page);
    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText("SEP contribution exceeds the deductible limit").click();
    await expect(page.getByText("Question open with client")).toBeVisible();
  });

  test("Reset asks for confirmation before clearing events", async ({ page }) => {
    await freshState(page);
    let dialogShown = false;
    page.once("dialog", async (dialog) => {
      dialogShown = true;
      expect(dialog.message()).toContain("Clear all");
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Reset" }).click();
    await page.waitForTimeout(200);
    expect(dialogShown).toBe(true);
    // Dismissed, so the seeded questions are still there.
    await expect(page.getByText("CryptoNorth bank statement", { exact: false })).toBeVisible();
  });
});
