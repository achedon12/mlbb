import { test as base, type TestInfo } from "@playwright/test";

/**
 * Each test as a visitor of its own.
 *
 * The site limits its API to 90 calls a minute per address (`src/proxy.ts`),
 * and every page calls a few routes once hydrated (session, notifications,
 * error reports). All the tests come from one machine: together, they would
 * exhaust that window and fail one another with 429 answers that no visitor
 * meets. The address the limit reads is the last `X-Forwarded-For` entry
 * (one trusted proxy by default), so each test sends one derived from its
 * id: the browser and the `request` fixture alike.
 */
function addressOf(testInfo: TestInfo): string {
  const hex = testInfo.testId.replace(/[^0-9a-f]/gi, "").padEnd(6, "0");
  const byte = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) % 256;
  return `10.${byte(0)}.${byte(1)}.${byte(2)}`;
}

export const test = base.extend({
  // `provide` is Playwright's `use`, renamed: the React hooks rule reads that name as a hook.
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": addressOf(testInfo) });
  },
});

export { expect } from "@playwright/test";
