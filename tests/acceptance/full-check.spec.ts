import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';

const FIXTURES = join(process.cwd(), 'tests/fixtures/ocr');

/** Navigate and wait until the page is interactive (forms submitted before hydration can be dropped). */
async function go(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

/** A fresh 10-digit Indian mobile number per test, so tests never share an account. */
const freshMobile = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

async function signIn(page: Page, mobile = freshMobile()) {
  await go(page, '/en/sign-in');
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByRole('button', { name: 'Send code' }).click();
  // The first server action on a cold server loads its code, so allow it more time.
  await expect(page.getByText(/We sent a 6-digit code to/)).toBeVisible({ timeout: 20_000 });
  const outbox = await page.request.get(`/api/dev/outbox?mobile=${mobile}`);
  expect(outbox.ok()).toBe(true);
  const code = /(\d{6})/.exec(((await outbox.json()) as { body: string }).body)![1]!;
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/me$/);
  return mobile;
}

async function startFullCheck(page: Page) {
  await page.getByLabel(/I have read this and agree/).check();
  await page.getByRole('button', { name: 'Start my Full Check' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Full Check');
}

async function addTyped(page: Page, kind: string, values: Record<string, string>) {
  await go(page, `/en/me/documents/new/${kind}`);
  for (const [label, value] of Object.entries(values)) {
    const box = page.locator('section', { hasText: 'Type the details' }).getByLabel(label, { exact: true });
    if ((await box.evaluate((el) => el.tagName)) === 'SELECT') await box.selectOption(value);
    else await box.fill(value);
  }
  await page.getByRole('button', { name: 'Save document' }).click();
  await expect(page.getByText('Document saved.')).toBeVisible();
}

async function upload(page: Page, kind: string, fixture: string) {
  await go(page, `/en/me/documents/new/${kind}`);
  if (await page.getByTestId('consent-uploads').isVisible()) {
    await page.getByLabel(/I agree to 1dentity keeping my uploaded files/).check();
    await page.getByRole('button', { name: 'Agree and continue' }).click();
  }
  await page.getByLabel('Photo or PDF of the document').setInputFiles(join(FIXTURES, fixture));
  await page.getByRole('button', { name: 'Upload and read' }).click();
}

test.describe('Full Check (M16, M17, M18, F05, F06)', () => {
  test('@F05-AC-1.2 @F05-AC-3.3 @F05-AC-3.4 sign in with a one-time code; the session cookie is HttpOnly and SameSite=Lax; signing out ends it', async ({ page, context }) => {
    await go(page, '/en/me');
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await page.getByLabel('Mobile number').fill('12345');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByTestId('banner-error')).toHaveText('Enter a 10-digit Indian mobile number.', { timeout: 20_000 });
    await signIn(page);
    const cookie = (await context.cookies()).find((c) => c.name === 'identity_session')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    expect(cookie.value.length).toBeGreaterThanOrEqual(43);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await context.addCookies([{ ...cookie }]);
    await go(page, '/en/me');
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test('@F06-AC-1.1 nothing is stored until the Full Check notice is agreed', async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId('consent-full_check')).toBeVisible();
    await expect(page.getByTestId('consent-full_check')).toContainText('1dentity is not a government office');
    await go(page, '/en/me/documents/new/pan');
    await expect(page).toHaveURL(/\/en\/me$/);
    await startFullCheck(page);
    await expect(page.getByTestId('summary')).toContainText('You have not added any documents yet.');
  });

  test('@M17-AC-1.1 @M17-AC-1.2 a typed document asks only for printed fields, Aadhaar only for the last 4 digits, and counts at once', async ({ page }) => {
    await signIn(page);
    await startFullCheck(page);
    await go(page, '/en/me/documents/new/aadhaar');
    const form = page.locator('section', { hasText: 'Type the details' });
    await expect(form.getByLabel('Name', { exact: true })).toBeVisible();
    await expect(form.getByLabel("Father's name")).toHaveCount(0);
    await expect(form.getByLabel('Last 4 digits of Aadhaar')).toBeVisible();
    await form.getByLabel('Name', { exact: true }).fill('Mohammed Ibrahim');
    await form.getByLabel('Last 4 digits of Aadhaar').fill('2346');
    await page.getByRole('button', { name: 'Save document' }).click();
    await expect(page.getByTestId('documents')).toContainText('Aadhaar');
    await expect(page.getByTestId('documents')).toContainText('XXXX XXXX 2346');
    await expect(page.getByTestId('documents')).toContainText('Confirmed');
  });

  test('@M17-AC-2.1 @M17-AC-2.2 @M17-AC-3.3 @M17-AC-3.4 @F07-AC-2.1 @F07-AC-2.2 upload after consent, check what was read, confirm; the original is kept and the file is private', async ({ page, browser }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await startFullCheck(page);
    await go(page, '/en/me/documents/new/pan');
    await expect(page.getByTestId('consent-uploads')).toBeVisible();
    await expect(page.getByLabel('Photo or PDF of the document')).toHaveCount(0);
    await upload(page, 'pan', 'pan.png');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check your PAN');
    const name = page.locator('[data-field="name"]');
    await expect(name).toContainText('We read: MOHAMMED IBRAHIM');
    await expect(name.getByTestId('confidence')).toContainText('% sure');
    await expect(page.getByText(/We read the number as ••••••234F/)).toBeVisible();
    await name.getByLabel('Name').fill('MOHAMMED IBRAHIM KHAN');
    await page.getByRole('button', { name: 'Confirm these details' }).click();
    await expect(page.getByText('Thank you — the details are confirmed')).toBeVisible();
    const field = page.getByTestId('fields').locator('[data-field="name"]');
    await expect(field).toContainText('MOHAMMED IBRAHIM KHAN');
    await expect(field).toContainText('The document says: MOHAMMED IBRAHIM');
    await expect(page.getByText(/We will delete the uploaded file on \d{2}-\d{2}-\d{4}/)).toBeVisible();

    const href = await page.getByRole('link', { name: 'View the file you uploaded' }).getAttribute('href');
    const own = await page.request.get(href!);
    expect(own.status()).toBe(200);
    expect(own.headers()['content-type']).toBe('image/png');
    expect(own.headers()['cache-control']).toBe('private, no-store');
    const stranger = await browser.newContext();
    const other = await stranger.newPage();
    await signIn(other);
    expect((await other.request.get(href!)).status()).toBe(404);
    expect((await stranger.request.get(href!)).status()).toBe(404);
    await stranger.close();
  });

  test('@M17-AC-2.3 an image with a full Aadhaar number is discarded, and the citizen is told why', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await startFullCheck(page);
    await upload(page, 'aadhaar', 'aadhaar-unmasked.png');
    await expect(page.getByTestId('banner-error')).toContainText('This image shows a full Aadhaar number, so we deleted it without saving it.');
    await go(page, '/en/me/documents');
    await expect(page.getByText('No documents yet.')).toBeVisible();
  });

  test('@M17-AC-3.5 an upload that looks like another type says so and can be switched', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await startFullCheck(page);
    await upload(page, 'voter_id', 'pan.png');
    await expect(page.getByTestId('looks-like')).toContainText('This looks like a PAN');
    await page.getByRole('button', { name: 'Change it to PAN' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check your PAN');
  });

  test('@M16-AC-2.1 @M16-AC-3.1 @M18-AC-2.1 report suggests a target, the plan starts by confirming it, and fees are kept separate', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await startFullCheck(page);
    await addTyped(page, 'birth_certificate', { Name: 'Mohamad Ibrahim' });
    await addTyped(page, 'sslc', { Name: 'Mohammed Ibrahim' });
    await addTyped(page, 'aadhaar', { Name: 'MOHAMMED IBRAHIM' });
    await addTyped(page, 'pan', { Name: 'Ibrahim Mujeeb' });

    await go(page, '/en/me/report');
    const nameSection = page.getByTestId('field-name');
    await expect(nameSection.getByTestId('target')).toContainText('Mohammed Ibrahim');
    await expect(nameSection.getByTestId('target')).toContainText('Suggested — not confirmed');
    await expect(nameSection.getByTestId('target')).toContainText('Most of your documents show this.');
    await expect(nameSection.locator('[data-status="major_discrepancy"]')).toContainText('Mismatch');

    await go(page, '/en/me/roadmap');
    await expect(page.locator('[data-step]').first()).toContainText('Confirm your target details');

    await go(page, '/en/me/report');
    await nameSection.getByRole('button', { name: 'Confirm target' }).click();
    await expect(page.getByText('Target confirmed.')).toBeVisible();
    await expect(nameSection.getByTestId('target')).toContainText('Confirmed');

    await go(page, '/en/me/roadmap');
    const steps = page.locator('[data-step="correction"]');
    await expect(steps.first()).toContainText('Correct your Birth certificate');
    const pan = steps.filter({ hasText: 'Correct your PAN' });
    await expect(pan).toContainText('Name: "Ibrahim Mujeeb" → "Mohammed Ibrahim"');
    await expect(pan.getByTestId('verification')).toHaveText('Not yet verified by 1dentity — please confirm on the official site.');
    await expect(pan.getByTestId('government-fee')).toContainText('never to 1dentity');
    await expect(pan.getByTestId('service-fee')).toContainText('1dentity service fee: to be confirmed');
    await expect(page.getByTestId('otp-warning')).toBeVisible();
  });

  test('@M16-AC-4.1 @M17-AC-5.1 a disputed result is shown as the citizen’s decision; an edit creates a new version', async ({ page }) => {
    await signIn(page);
    await startFullCheck(page);
    await addTyped(page, 'aadhaar', { Name: 'Mohammed Ibrahim' });
    await addTyped(page, 'pan', { Name: 'Ibrahim Mujeeb' });
    await go(page, '/en/me/report');
    const result = page.getByTestId('field-name').getByTestId('result').filter({ hasText: 'PAN' });
    await result.getByText('Do you disagree with this result?').click();
    await result.getByLabel('Why?').fill('Mujeeb is my family name');
    await result.getByRole('button', { name: 'Save my decision' }).click();
    await expect(result).toContainText('Your decision');
    await expect(result).toContainText('You said this is the same.');

    await go(page, '/en/me/documents');
    await page.getByTestId('documents').getByText('PAN').click();
    await page.getByRole('link', { name: 'Edit details' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Mohammed Ibrahim');
    await page.getByRole('button', { name: 'Save as new version' }).click();
    await expect(page.getByText('Saved as a new version.')).toBeVisible();
    await expect(page.getByTestId('versions')).toContainText('Version 2 · Edited');
    await expect(page.getByTestId('versions')).toContainText('Version 1 · Typed');
  });

  test('@M17-AC-5.2 @F06-AC-3.3 deleting a document, then closing the account, deletes everything and ends the session', async ({ page }) => {
    await signIn(page);
    await startFullCheck(page);
    await addTyped(page, 'pan', { Name: 'Mohammed Ibrahim' });
    await page.getByTestId('documents').getByText('PAN').click();
    await page.getByText('Delete this document').click();
    await page.getByRole('button', { name: 'Delete document' }).click();
    await expect(page.getByText('Document deleted, with its file.')).toBeVisible();
    await go(page, '/en/me/settings');
    await page.locator('summary', { hasText: 'Close my account' }).click();
    await page.locator('details[open]').getByLabel('I understand this cannot be undone.').check();
    await page.locator('details[open]').getByRole('button', { name: 'Close my account' }).click();
    await expect(page.getByText('Your account and everything in it have been deleted.')).toBeVisible();
    await go(page, '/en/me');
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test('@F06-AC-3.1 withdrawing the Full Check deletes its data and shows the notice again', async ({ page }) => {
    await signIn(page);
    await startFullCheck(page);
    await addTyped(page, 'pan', { Name: 'Mohammed Ibrahim' });
    await go(page, '/en/me/settings');
    await page.locator('summary', { hasText: 'Delete my Full Check data' }).click();
    await page.locator('details[open]').getByLabel('I understand this cannot be undone.').check();
    await page.locator('details[open]').getByRole('button', { name: 'Delete my Full Check data' }).click();
    await expect(page.getByText('Your Full Check data has been deleted.')).toBeVisible();
    await startFullCheck(page);
    await expect(page.getByTestId('summary')).toContainText('You have not added any documents yet.');
  });

  test('@F06-AC-2.1 the privacy notice exists in all four languages with the retention schedule', async ({ page }) => {
    for (const locale of ['en', 'kn', 'hi', 'ur']) {
      await go(page, `/${locale}/privacy`);
      await expect(page.getByTestId('retention').locator('tr')).toHaveCount(3);
      await expect(page.locator('main')).toContainText('2026-10-v2');
    }
    await go(page, '/en/privacy');
    await expect(page.locator('[data-retention="uploads"]')).toContainText('30 days after you confirm the details');
    await expect(page.locator('main')).toContainText('We are not a government office.');
  });

  test('@F03-AC-1.1 @F03-AC-5.1 no serious accessibility violations on the Full Check screens; every status shows an icon and a word', async ({ page }) => {
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), label).toEqual([]);
    };
    await go(page, '/en/sign-in');
    await scan('sign-in');
    await signIn(page);
    await scan('consent');
    await startFullCheck(page);
    await go(page, '/en/me/documents/new/voter_id');
    await scan('add document');
    await addTyped(page, 'aadhaar', { Name: 'Mohammed Ibrahim', Gender: 'Male' });
    await addTyped(page, 'pan', { Name: 'Ibrahim Mujeeb' });
    await go(page, '/en/me/report');
    await scan('report');
    const chips = page.locator('[data-status]');
    expect(await chips.count()).toBeGreaterThan(0);
    for (const chip of await chips.all()) {
      await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(chip).not.toHaveText('');
    }
    await go(page, '/en/me/roadmap');
    await scan('roadmap');
  });
});
