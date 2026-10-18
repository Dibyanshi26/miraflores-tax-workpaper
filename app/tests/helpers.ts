import type { Page } from "@playwright/test";

// Fresh browser state: no persisted role, no IndexedDB event log (so the only events
// present are whatever init() seeds - the four standing client questions).
export async function freshState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("miraflores-workpaper");
  });
  await page.reload();
  await page.waitForSelector(".role-switcher");
}

// React tracks <input> values through its own property descriptor, so a plain
// `el.value = x` (or a naive dispatchEvent) is invisible to its onChange - this goes
// through the native HTMLInputElement setter first, the same way a real drag does,
// so React's change handler actually fires. Needed because Locator.fill() doesn't
// support type="range".
export async function setAsOfPct(page: Page, pct: number) {
  await page.getByTestId("asof-slider").evaluate((el: HTMLInputElement, value: number) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, pct);
}
