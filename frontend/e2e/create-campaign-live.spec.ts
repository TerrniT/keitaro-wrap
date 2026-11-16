import { expect, test } from "@playwright/test";

import { selectCountry, selectOffer } from "./helpers";

/**
 * Optional live E2E: creates a real campaign through the UI against the
 * configured Keitaro tracker, verifies the two streams and archives the
 * campaign afterwards.
 *
 * Run with:
 *   E2E_LIVE=1 E2E_BACKEND_URL=http://127.0.0.1:8000 npm run test:e2e:live
 */
test.describe("@live создание кампании в реальном Keitaro", () => {
  test.skip(process.env.E2E_LIVE !== "1", "Set E2E_LIVE=1 to run against real Keitaro");

  test("создаёт кампанию через UI и архивирует её", async ({ page, request }) => {
    test.setTimeout(180_000);
    const suffix = `e2e_${Date.now()}`;
    const offerId = process.env.E2E_OFFER_ID ?? "10184";
    const country = process.env.E2E_COUNTRY ?? "Germany";
    const countryCode = process.env.E2E_COUNTRY_CODE ?? "DE";
    let campaignId: number | null = null;

    try {
      await page.goto("/campaigns/new");
      await expect(page.getByRole("heading", { name: "Новая кампания" })).toBeVisible();

      await page.locator("#campaign-name").fill(suffix);
      await selectCountry(page, country);
      await selectOffer(page, offerId);
      await expect(page.getByRole("button", { name: "Создать кампанию" })).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/campaigns") &&
          response.request().method() === "POST",
        { timeout: 120_000 },
      );
      await page.getByRole("button", { name: "Создать кампанию" }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);

      const detail = await response.json();
      campaignId = detail.campaign.id as number;
      expect(campaignId).toBeGreaterThan(0);
      expect(String(detail.campaign.name).startsWith("test_")).toBeTruthy();
      expect(detail.streams).toHaveLength(2);
      expect(detail.streams[0].name).toBe("Google");
      expect(detail.streams[0].action_payload).toBe("https://www.google.com");
      expect(detail.streams[1].name).toBe("Offers");
      expect(detail.streams[1].offers[0].offer_id).toBe(Number(offerId));

      await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}`), {
        timeout: 60_000,
      });
      await expect(
        page.getByRole("heading", { name: detail.campaign.name }),
      ).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText("Google", { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Offers", { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      // Read the campaign back through the backend as an independent check.
      const freshResponse = await request.get(`/api/campaigns/${campaignId}`, {
        timeout: 60_000,
      });
      expect(freshResponse.ok()).toBeTruthy();
      const fresh = await freshResponse.json();
      expect(fresh.streams).toHaveLength(2);
      expect(fresh.campaign.geo).toContain(countryCode);
    } finally {
      // Always clean up the test campaign from Keitaro.
      if (campaignId) {
        await request.delete(`/api/campaigns/${campaignId}`).catch(() => undefined);
      }
    }
  });
});
