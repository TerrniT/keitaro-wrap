import type { Page } from "@playwright/test";

/** Select a country in the multi-select combobox. */
export async function selectCountry(page: Page, countryName: string) {
  await page
    .getByText("Страны, которые пойдут на Google", { exact: true })
    .click();
  await page.getByPlaceholder("Страна или код (например, US)").fill(countryName);
  await page
    .getByRole("option")
    .filter({ hasText: countryName })
    .first()
    .click();
  // The country popover stays open for multi-select; close it before the next
  // combobox interaction.
  await page.keyboard.press("Escape");
}

/** Select an offer in the searchable offer combobox. */
export async function selectOffer(page: Page, offerId: string) {
  await page.getByText("Найдите оффер по названию или ID", { exact: true }).click();
  await page
    .getByPlaceholder("Название, ID или часть названия…")
    .fill(offerId);
  await page
    .getByRole("option")
    .filter({ hasText: offerId })
    .first()
    .click();
}
