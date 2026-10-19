import { test, expect } from "@playwright/test";
import { freshState } from "./helpers";

// RSU-BASIS ("RSU sales taxed with $0 basis") has a federal effect around -$15,536 - well
// over the $1,000 partner-approval threshold. HVAC-CAPITALIZE ("HVAC replacement expensed
// instead of capitalized") is federal +$3,633 / CA +$896 - also over threshold, used as a
// second over-threshold check so the self-review test doesn't reuse the first one.
const OVER_THRESHOLD_CHECK = "RSU sales taxed with $0 basis";
const OVER_THRESHOLD_CHECK_2 = "HVAC system replacement expensed as a repair";
// "Mileage log page is a duplicate scan" is federal +$919 / CA +$80 - under the threshold
// on both sides, so it should resolve immediately without needing approval.
const UNDER_THRESHOLD_CHECK = "Mileage log page is a duplicate scan";

async function switchRole(page: import("@playwright/test").Page, label: string) {
  await page.locator(".role-switcher").selectOption({ label });
}

async function acceptCheck(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("link", { name: "Checks", exact: true }).click();
  await page.getByText(title, { exact: true }).click();
  await page.getByRole("button", { name: "Accept adjustment" }).click();
  await page.getByRole("button", { name: "Confirm & accept" }).click();
}

test.describe("partner approval on adjustments", () => {
  test("accepting prompts for a reason, prefilled, and records who/when/why/effect on the card", async ({ page }) => {
    await freshState(page);
    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText(UNDER_THRESHOLD_CHECK, { exact: true }).click();
    await page.getByRole("button", { name: "Accept adjustment" }).click();

    const reasonBox = page.locator(".accept-reason-form textarea");
    await expect(reasonBox).toBeVisible();
    const prefilled = await reasonBox.inputValue();
    expect(prefilled.trim().length).toBeGreaterThan(10); // a real sentence, not a placeholder

    await reasonBox.fill("Mileage log page 3 is a duplicate of page 2 per the header note.");
    await page.getByRole("button", { name: "Confirm & accept" }).click();

    // Under threshold - resolves immediately, no approval needed.
    await expect(page.getByText("Adjustment accepted")).toBeVisible();
    await expect(page.getByText("Accepted by Priya Raman", { exact: false })).toBeVisible();
    await expect(page.getByText("Mileage log page 3 is a duplicate of page 2 per the header note.")).toBeVisible();
  });

  test("over $1,000 shows 'Awaiting partner approval', not 'Adjustment accepted'", async ({ page }) => {
    await freshState(page);
    await acceptCheck(page, OVER_THRESHOLD_CHECK);
    await expect(page.getByText("Awaiting partner approval")).toBeVisible();
    await expect(page.getByText("Adjustment accepted")).toHaveCount(0);
  });

  test("a preparer cannot approve - no Approve button shows for the preparer role", async ({ page }) => {
    await freshState(page);
    await acceptCheck(page, OVER_THRESHOLD_CHECK);
    await expect(page.getByText("Awaiting partner approval")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("nobody can approve their own adjustment", async ({ page }) => {
    await freshState(page);
    await switchRole(page, "Helen Strand — Partner");
    await acceptCheck(page, OVER_THRESHOLD_CHECK_2);
    await expect(page.getByText("Awaiting partner approval")).toBeVisible();
    // Helen accepted it herself, so even as the partner, she can't also approve it.
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByText("you accepted this adjustment yourself", { exact: false })).toBeVisible();
  });

  test("partner approves from Home's 'Waiting for your approval' section; it leaves Open items and the count drops", async ({ page }) => {
    await freshState(page);
    await acceptCheck(page, OVER_THRESHOLD_CHECK);

    await page.getByRole("link", { name: "Home", exact: true }).click();
    const openItemsHeading = page.getByText(/^Open items \(\d+\)$/);
    const beforeText = await openItemsHeading.textContent();
    const before = Number(/\((\d+)\)/.exec(beforeText ?? "")![1]);
    await expect(page.getByText("Awaiting partner approval")).toBeVisible(); // still in the open-items list

    await switchRole(page, "Helen Strand — Partner");
    await expect(page.getByText(/^Waiting for your approval \(1\)$/)).toBeVisible();
    await page.locator(".approval-queue-row").getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText(/^Waiting for your approval \(0\)$/)).toBeVisible();
    // Resolved now, so it no longer shows anywhere on Home - its approval record lives on
    // the Checks page and in Review notes & sign-offs (checked below).

    const afterText = await page.getByText(/^Open items \(\d+\)$/).textContent();
    const after = Number(/\((\d+)\)/.exec(afterText ?? "")![1]);
    expect(after).toBe(before - 1);
    await expect(page.getByText("Awaiting partner approval")).toHaveCount(0);

    // The approval also shows up in Review notes & sign-offs.
    await page.getByRole("link", { name: "Review notes & sign-offs", exact: true }).click();
    await expect(page.getByText(/^Adjustment approvals \(1\)$/)).toBeVisible();
    await expect(page.getByText("Approved by Helen Strand", { exact: false })).toBeVisible();
  });

  test("the Workpaper (accepted) column only counts approved adjustments, and shows awaiting-approval separately", async ({ page }) => {
    await freshState(page);
    await acceptCheck(page, OVER_THRESHOLD_CHECK);

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForSelector(".totals-strip");
    // Accepted but not yet approved - the real "accepted" column must NOT move yet.
    await expect(page.locator("table.strip-table").first().locator(".strip-table__changed")).toHaveCount(0);
    await expect(page.locator(".strip-count__value--awaiting")).toHaveText("1");
    await expect(page.locator(".strip-count__value--accepted")).toHaveText("1"); // "Accepted so far" still counts the decision itself

    await switchRole(page, "Helen Strand — Partner");
    await page.locator(".approval-queue-row").getByRole("button", { name: "Approve" }).click();

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForSelector(".totals-strip");
    // Now approved - the accepted column reflects it, and the awaiting count drops to 0.
    await expect(page.locator("table.strip-table").first().locator(".strip-table__changed").first()).toBeVisible();
    await expect(page.locator(".strip-count__value--awaiting")).toHaveText("0");
  });

  test("send back requires a note and is recorded in Review notes & sign-offs", async ({ page }) => {
    await freshState(page);
    await acceptCheck(page, OVER_THRESHOLD_CHECK);

    await switchRole(page, "Helen Strand — Partner");
    await page.getByRole("link", { name: "Checks", exact: true }).click();
    await page.getByText(OVER_THRESHOLD_CHECK, { exact: true }).click();
    await page.getByRole("button", { name: "Send back" }).click();

    const sendBackButton = page.getByRole("button", { name: "Send back", exact: true }).last();
    await expect(sendBackButton).toBeDisabled(); // empty note - can't submit

    await page.getByPlaceholder("Why is this going back to the preparer? (required)").fill("Need the D11 statement attached before I'll approve this.");
    await sendBackButton.click();

    // Still awaiting approval - sending back doesn't silently approve or dismiss it.
    await expect(page.getByText("Awaiting partner approval")).toBeVisible();

    await page.getByRole("link", { name: "Review notes & sign-offs", exact: true }).click();
    await expect(page.getByText("Sent back: Need the D11 statement attached before I'll approve this.")).toBeVisible();
  });

  test("Reset returns the As-of clock to Jun 23, 2026", async ({ page }) => {
    await freshState(page);
    await expect(page.locator(".topbar__clock-date")).toHaveText("Jun 23, 2026");

    await page.getByTestId("asof-slider").evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, "10");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator(".topbar__clock-date")).not.toHaveText("Jun 23, 2026");

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator(".topbar__clock-date")).toHaveText("Jun 23, 2026");
  });
});
