import { expect, test } from '@playwright/test';
import { IRFAN, completeHealthCheck } from './helpers';

test.describe('F03 design system', () => {
  test('@F03-AC-2.1 status chips show an icon and a word; the icon is hidden from screen readers', async ({ page }) => {
    await completeHealthCheck(page, IRFAN);
    const chips = page.locator('[data-status]');
    expect(await chips.count()).toBeGreaterThan(3);
    for (const chip of await chips.all()) {
      await expect(chip.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      expect((await chip.innerText()).trim().length).toBeGreaterThan(1);
    }
  });

  test('@F03-AC-3.1 large text in one tap, remembered, with no sideways scrolling at 360 px', async ({ page }) => {
    await page.goto('/en');
    const before = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    await page.getByRole('button', { name: 'Large text' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
    const after = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(after).toBeCloseTo(before * 1.25, 1);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
    await expect(page.getByRole('button', { name: 'Large text' })).toHaveAttribute('aria-pressed', 'true');

    for (const path of ['/en', '/en/check', '/ur', '/en/help']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('@F03-AC-4.1 touch targets are at least 48 × 48 px', async ({ page }) => {
    const check = async () => {
      const small = await page
        .locator('main button:visible, main a.btn-primary:visible, main a.btn-secondary:visible, main label.choice:visible, header button:visible, header summary:visible')
        .evaluateAll((els) =>
          els
            .map((el) => ({ el: el.textContent?.trim().slice(0, 30), box: el.getBoundingClientRect() }))
            .filter(({ box }) => box.height < 47.5 || box.width < 47.5)
            .map(({ el, box }) => `${el} ${Math.round(box.width)}×${Math.round(box.height)}`),
        );
      expect(small).toEqual([]);
    };
    await page.goto('/en/check');
    await check();
    await completeHealthCheck(page, IRFAN);
    await check();
  });
});

test.describe('C-01 trust cues', () => {
  test('the "not a government office" disclaimer is on every page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('disclaimer')).toContainText('We are not a government office.');
    for (const path of ['/en', '/en/check', '/en/help', '/kn', '/hi/check', '/ur/help']) {
      await page.goto(path);
      await expect(page.getByTestId('disclaimer'), path).toBeVisible();
    }
    await page.goto('/en');
    await expect(page.getByTestId('disclaimer')).toHaveText(
      '1dentity is a community help service of Islamic Information Centre. We are not a government office. All applications are submitted on official government portals, and fees are paid only to the issuing authority. We will never ask for your OTP, PIN or password.',
    );
  });

  test('security headers forbid third-party scripts and framing (C-14, C-07)', async ({ page }) => {
    const response = await page.goto('/en');
    const headers = response!.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
