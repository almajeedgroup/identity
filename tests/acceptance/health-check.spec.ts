import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { HEALTH_CHECK_KEY, IRFAN, completeHealthCheck } from './helpers';

test.describe('M01 Health Check', () => {
  test('@M01-AC-1.1 @M01-AC-2.2 @M01-AC-2.3 the DPR worked example end to end, without an account', async ({ page }) => {
    await completeHealthCheck(page, IRFAN);

    await expect(page.getByRole('img', { name: 'Health score 58 out of 100' })).toBeVisible();
    await expect(page.getByTestId('score-band')).toHaveText('Needs attention — 3 issues');

    // Document status: icon + word (C-09)
    for (const [kind, status, word] of [
      ['aadhaar', 'update_due', 'Update due'],
      ['pan', 'mismatch', 'Mismatch'],
      ['voter_id', 'mismatch', 'Mismatch'],
    ] as const) {
      const chip = page.getByTestId(`doc-card-${kind}`).locator(`[data-status="${status}"]`);
      await expect(chip).toHaveText(word);
      await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    }

    // Mismatch report: what each card says, and the result per detail
    const report = page.getByTestId('mismatch-report');
    await expect(report.getByTestId('report-name')).toContainText('Mohd. Irfan');
    await expect(report.getByTestId('report-name')).toContainText('Mismatch: PAN');
    await expect(report.getByTestId('report-dob')).toContainText('01-01-1990');
    await expect(report.getByTestId('report-dob')).toContainText('Mismatch: Voter ID (EPIC)');
    await expect(report.getByTestId('report-gender')).toContainText('OK');
    await expect(report.getByTestId('report-mobile_link')).toContainText('Update due');
  });

  test('@M01-AC-3.1 @M01-AC-3.2 action plan in order, with form, place, fee, verification status and official links', async ({ page }) => {
    await completeHealthCheck(page, IRFAN);

    // Exactly one primary action, plus "Book assisted help"
    await expect(page.locator('main .btn-primary')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Fix 3 issues' })).toHaveAttribute('href', '#plan');
    await expect(page.getByRole('link', { name: 'Book assisted help' })).toHaveAttribute('href', '/en/help');

    const steps = page.locator('#plan ol > li');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toHaveAttribute('data-testid', 'action-aadhaar-link-mobile');
    await expect(steps.nth(1)).toHaveAttribute('data-testid', 'action-pan-correction');
    await expect(steps.nth(2)).toHaveAttribute('data-testid', 'action-voter-correction');

    const pan = steps.nth(1);
    await expect(pan).toContainText('PAN CR-01');
    await expect(pan.getByTestId('fee')).toContainText('₹101–107');
    await expect(pan.getByTestId('verification')).toHaveText(/Not yet verified by 1dentity/);
    const links = pan.getByRole('link');
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toContainText('Official site');
      await expect(link).toHaveAttribute('href', /^https:\/\//);
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(steps.nth(2).getByTestId('fee')).toHaveText('Free');
    await expect(page.getByTestId('otp-warning')).toHaveText('1dentity will never ask for your OTP, PIN or password.');
  });

  test('@M01-AC-1.2 nothing the citizen types leaves the device, and every request stays on our origin', async ({ page, baseURL }) => {
    const requests: { url: string; body: string }[] = [];
    page.on('request', (r) => requests.push({ url: r.url(), body: r.postData() ?? '' }));

    const secret = { name: 'Zubair Qwertyuiop', other: 'Zubeir Qwertyuiop', place: 'Xylophonepet' };
    await completeHealthCheck(page, {
      aadhaar: { name: secret.name, dob: ['17', '03', '1987'], gender: 'Male', locality: secret.place },
      pan: { name: secret.other, dob: ['17', '03', '1987'] },
      livesAtAddress: 'Yes',
      mobileLinked: 'Yes',
      documentsUpdated: 'Yes',
    });
    await expect(page.getByTestId('score-band')).toContainText('1 issue');

    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) {
      const haystack = decodeURIComponent(`${r.url} ${r.body}`).toLowerCase();
      for (const value of [secret.name, secret.other, secret.place, '17-03-1987', '1987']) {
        expect(haystack, `request to ${r.url}`).not.toContain(value.toLowerCase());
      }
      expect(new URL(r.url).origin, 'C-14: no third-party requests').toBe(new URL(baseURL!).origin);
    }
  });

  test('@M01-AC-1.3 on a phone that is not your own, nothing is saved', async ({ page }) => {
    await completeHealthCheck(page, { ...IRFAN, ownPhone: false });
    await expect(page.getByTestId('save-state')).toHaveText('Not saved — you told us this is not your own phone.');
    expect(await page.evaluate((k) => localStorage.getItem(k), HEALTH_CHECK_KEY)).toBeNull();
    await page.goto('/en');
    await expect(page.getByTestId('last-check')).toHaveCount(0);
  });

  test('@M01-AC-5.1 @M01-AC-1.4 own phone: last check on home, then "Clear my data" removes it', async ({ page }) => {
    await completeHealthCheck(page, { ...IRFAN, ownPhone: true });
    await expect(page.getByTestId('save-state')).toHaveText('Saved on this phone only.');

    await page.goto('/en');
    const last = page.getByTestId('last-check');
    await expect(last).toContainText('Needs attention — 3 issues');
    await expect(last).toContainText(/Last check: \d{2}-\d{2}-\d{4}/);

    await last.getByRole('link', { name: 'See my result' }).click();
    await expect(page.getByTestId('score-band')).toHaveText('Needs attention — 3 issues');
    await page.getByRole('button', { name: 'Clear my data' }).click();
    await expect(page.getByTestId('save-state')).toHaveText('Your Health Check has been removed from this phone.');
    expect(await page.evaluate((k) => localStorage.getItem(k), HEALTH_CHECK_KEY)).toBeNull();
    await page.goto('/en');
    await expect(page.getByTestId('last-check')).toHaveCount(0);
  });

  test('@M01-AC-3.3 when everything agrees, it says so and offers no "Fix" action', async ({ page }) => {
    await completeHealthCheck(page, {
      aadhaar: { name: 'Fatima Shaikh', dob: ['03', '03', '1992'], gender: 'Female', locality: 'Shivajinagar' },
      pan: { name: 'Fatima Shaikh', dob: ['03', '03', '1992'] },
      livesAtAddress: 'Yes',
      mobileLinked: 'Yes',
      documentsUpdated: 'Yes',
    });
    await expect(page.getByTestId('score-band')).toHaveText('All valid');
    await expect(page.getByText('Your documents agree with each other.')).toBeVisible();
    await expect(page.locator('main .btn-primary')).toHaveCount(0);
    await expect(page.locator('#plan')).toHaveCount(0);
  });

  test('a date that does not exist is caught before moving on', async ({ page }) => {
    await page.goto('/en/check');
    await page.getByLabel('Aadhaar', { exact: true }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Day', { exact: true }).fill('31');
    await page.getByLabel('Month', { exact: true }).fill('02');
    await page.getByLabel('Year', { exact: true }).fill('1990');
    await page.getByRole('button', { name: 'Next' }).click();
    // Scoped to main: Next.js adds its own role=alert route announcer.
    await expect(page.locator('main').getByRole('alert')).toHaveText('This date does not exist. Check the day, month and year.');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Aadhaar');
  });

  test('choosing no documents is caught on the first step', async ({ page }) => {
    await page.goto('/en/check');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText('Choose at least one document.');
  });

  test('@M01-AC-4.1 the whole check works in Urdu, right to left', async ({ page }) => {
    await page.goto('/ur/check');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('شروع کرنے سے پہلے');
    await page.getByLabel('آدھار', { exact: true }).check();
    await page.getByRole('button', { name: 'آگے' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('آپ کا آدھار');
    await page.getByLabel('آدھار پر لکھا نام').fill('Haji Yusuf');
    await page.getByRole('button', { name: 'آگے' }).click();
    await page.getByRole('group', { name: 'کیا آپ کے آدھار سے کوئی موبائل نمبر جڑا ہے؟' }).getByLabel('نہیں', { exact: true }).check();
    await page.getByRole('button', { name: 'میرا نتیجہ دیکھیں' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('آپ کے دستاویزات کی صورتحال');
    await expect(page.getByTestId('action-aadhaar-link-mobile')).toContainText('اپنا موبائل نمبر آدھار سے لنک کریں');
  });

  test('@M01-AC-4.2 no serious or critical accessibility violations on start, question and result screens', async ({ page }) => {
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), label).toEqual([]);
    };
    await page.goto('/en/check');
    await scan('start');
    await page.getByLabel('Aadhaar', { exact: true }).check();
    await page.getByLabel('PAN', { exact: true }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await scan('document step');
    await completeHealthCheck(page, IRFAN);
    await scan('result (en)');
    await page.goto('/ur');
    await scan('home (ur)');
  });
});
