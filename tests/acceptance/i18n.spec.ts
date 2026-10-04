import { expect, test } from '@playwright/test';

test.describe('F04 languages', () => {
  test('@F04-AC-1.1 the site root offers four languages, each in its own script', async ({ page }) => {
    await page.goto('/');
    const choices = page.getByTestId('language-choices').getByRole('link');
    await expect(choices).toHaveText(['English', 'ಕನ್ನಡ', 'हिन्दी', 'اردو']);
    await expect(choices.nth(1)).toHaveAttribute('lang', 'kn');
    await expect(choices.nth(3)).toHaveAttribute('lang', 'ur');
  });

  test('@F04-AC-1.2 the chosen language is remembered on this device', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'ಕನ್ನಡ' }).click();
    await expect(page).toHaveURL(/\/kn$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/kn$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ನಿಮ್ಮ ದಾಖಲೆಗಳು ಒಂದಕ್ಕೊಂದು ಹೊಂದುತ್ತವೆಯೇ?');
  });

  test('@F04-AC-2.1 Urdu is right to left; the others are left to right', async ({ page }) => {
    for (const [locale, dir] of [
      ['en', 'ltr'],
      ['kn', 'ltr'],
      ['hi', 'ltr'],
      ['ur', 'rtl'],
    ] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
    }
  });

  test('switching language keeps you on the same page', async ({ page }) => {
    await page.goto('/en/help');
    await page.locator('header summary').click();
    await page.getByRole('link', { name: 'हिन्दी' }).click();
    await expect(page).toHaveURL(/\/hi\/help$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('सहायता प्राप्त करें');
  });

  test('an unknown language or page shows a 404 with links to the four languages', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page.getByRole('link', { name: 'اردو' })).toHaveAttribute('href', '/ur');
  });
});
