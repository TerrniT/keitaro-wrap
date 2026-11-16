import { expect, test } from "@playwright/test";

import { selectCountry, selectOffer } from "./helpers";
import { installMockApi } from "./mock-api";

test.describe("создание кампании через UI", () => {
  test("полный цикл: форма → создание → редактор кампании", async ({ page }) => {
    const mock = await installMockApi(page);

    await page.goto("/campaigns/new");
    await expect(page.getByRole("heading", { name: "Новая кампания" })).toBeVisible();

    const submit = page.getByRole("button", { name: "Создать кампанию" });
    await expect(submit).toBeDisabled();

    await page.locator("#campaign-name").fill("e2e_campaign");
    await expect(page.getByText("test_kotovsky_e2e_campaign", { exact: true }).first()).toBeVisible();

    await selectCountry(page, "Germany");
    await selectOffer(page, "10184");

    // Preview must reflect the chosen geo and offer before creation.
    await expect(submit).toBeEnabled();
    await expect(page.getByText("#10184", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Germany", { exact: false }).first()).toBeVisible();

    await submit.click();

    // The real React router lands on the campaign editor.
    await expect(page).toHaveURL(/\/campaigns\/999001/);
    await expect(
      page.getByRole("heading", { name: "test_kotovsky_e2e_campaign" }),
    ).toBeVisible();
    await expect(page.getByText("Google", { exact: true })).toBeVisible();
    await expect(page.getByText("Offers", { exact: true })).toBeVisible();
    await expect(page.getByText("#10184", { exact: true })).toBeVisible();
    await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();

    // The form sent exactly the data Keitaro needs for the two streams.
    expect(mock.getCreatedPayload()).toMatchObject({
      name: "test_kotovsky_e2e_campaign",
      geo: ["DE"],
      offer_id: 10184,
      domain_id: 1,
      group_id: 1,
      traffic_source_id: 1,
    });
  });
});
