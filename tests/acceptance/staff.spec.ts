import AxeBuilder from '@axe-core/playwright';
import { base32Decode, totpAt } from '@identity/db';
import { expect, test, type Browser, type Page } from '@playwright/test';

/** The development admin seeded by the test server (playwright.config.ts, M15-FR-07). */
export const ADMIN = { email: 'admin@identity.test', password: 'correct horse battery staple' };
const PASSWORD = 'a long enough password';

/** Navigate and wait until the page is interactive. */
async function go(page: Page, path: string) {
  await page.goto(path);
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

const code = (secret: string) => totpAt(base32Decode(secret.replace(/\s+/g, '')), Math.floor(Date.now() / 30_000));

/** Signs in for the first time: password, then enrolment of an authenticator (F05-AC-2.1). */
async function firstSignIn(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await go(page, '/staff/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set up two-step verification');
  const secret = (await page.getByTestId('totp-secret').textContent())!;
  await page.getByLabel('6-digit code').fill(code(secret));
  await page.getByRole('button', { name: 'Confirm and continue' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  return page;
}

async function addStaff(admin: Page, name: string, email: string, roles: string[]) {
  await go(admin, '/staff/team');
  const form = admin.locator('section', { hasText: 'Add a staff member' });
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('Email').fill(email);
  await form.getByLabel(/Initial password/).fill(PASSWORD);
  for (const r of roles) await form.getByLabel(r, { exact: true }).check();
  await form.getByRole('button', { name: 'Add staff member' }).click();
  await expect(admin.getByTestId('staff-success')).toContainText('Staff member added');
}

test.describe.configure({ mode: 'serial' });

test.describe('Staff console (F05, M13, M15)', () => {
  let admin: Page;

  test('@F05-AC-2.1 a staff page opens only after the password and an authenticator code', async ({ browser, page }) => {
    await go(page, '/staff/rules');
    await expect(page).toHaveURL(/\/staff\/sign-in$/);
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill('wrong password here');
    await page.getByRole('button', { name: 'Continue' }).click();
    // The first server action on a cold server loads its code, so allow it more time.
    await expect(page.getByTestId('staff-error')).toContainText('That did not work', { timeout: 20_000 });
    admin = await firstSignIn(browser, ADMIN.email, ADMIN.password);
    const cookie = (await admin.context().cookies()).find((c) => c.name === 'identity_staff')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/staff' });
  });

  test('@M15-AC-6.1 @M15-AC-6.2 an admin adds staff with roles and cannot lock themselves out', async () => {
    await addStaff(admin, 'Esha Editor', 'editor@identity.test', ['Content editor']);
    await addStaff(admin, 'Paul Publisher', 'publisher@identity.test', ['Publisher']);
    await addStaff(admin, 'Vani Volunteer', 'volunteer@identity.test', ['Volunteer']);
    await expect(admin.getByTestId('team')).toContainText('editor@identity.test');
    const self = admin.locator(`[data-email="${ADMIN.email}"]`);
    await self.getByLabel('Admin', { exact: true }).uncheck();
    await self.getByLabel('Publisher', { exact: true }).check();
    await self.getByRole('button', { name: 'Save roles' }).click();
    await expect(admin.getByTestId('staff-error')).toContainText('You cannot remove your own admin role');
  });

  test('@M13-AC-2.1 @M13-AC-2.2 @M13-AC-3.1 @M13-AC-3.2 an editor drafts, a refused draft keeps its text, a publisher publishes', async ({ browser }) => {
    test.setTimeout(60_000);
    const editor = await firstSignIn(browser, 'editor@identity.test', PASSWORD);
    await go(editor, '/staff/rules/rule/voter-form-8-correction');
    const box = editor.getByLabel('Item (JSON)');
    const original = await box.inputValue();
    await box.fill('{ "id": "voter-form-8-correction", ');
    await editor.getByLabel(/What changed and why/).fill('Broken on purpose');
    await editor.getByRole('button', { name: 'Save as draft' }).click();
    await expect(editor.getByTestId('draft-error')).toContainText('not valid JSON');
    await expect(box).toHaveValue('{ "id": "voter-form-8-correction", ');

    const data = JSON.parse(original) as { steps: { en: string }[] };
    data.steps[0]!.en = 'Open the voters portal and choose Form 8.';
    await box.fill(JSON.stringify(data, null, 2));
    await editor.getByLabel(/What changed and why/).fill('Clearer first step');
    await editor.getByRole('button', { name: 'Save as draft' }).click();
    await expect(editor.getByTestId('staff-success')).toContainText('Draft version 2 saved');
    const draft = editor.locator('[data-version="2"]');
    await expect(draft.getByTestId('diff')).toContainText('steps[0].en');
    await expect(draft.getByRole('button', { name: /Publish/ })).toHaveCount(0);

    const publisher = await firstSignIn(browser, 'publisher@identity.test', PASSWORD);
    await go(publisher, '/staff/rules/rule/voter-form-8-correction');
    await publisher.locator('[data-version="2"]').getByRole('button', { name: 'Publish version 2' }).click();
    await expect(publisher.getByTestId('staff-success')).toContainText('Version 2 is published');
    await expect(publisher.locator('[data-version="2"]')).toHaveAttribute('data-status', 'published');
  });

  test('@M13-AC-1.1 @M13-AC-4.1 the rules list shows versions and freshness; a verification is recorded', async () => {
    await go(admin, '/staff/rules');
    const row = admin.getByTestId('kb-rule').locator('[data-key="voter-form-8-correction"]');
    await expect(row).toContainText('v2 · published');
    await expect(row).toContainText('never · unverified');
    await row.getByRole('link').first().click();
    await admin.getByRole('button', { name: 'Record verification' }).click();
    await expect(admin.getByTestId('staff-success')).toContainText('Verification recorded');
    await expect(admin.locator('[data-version="2"]').getByTestId('verified')).toContainText('Verified on');
  });

  test('@M15-AC-1.1 @M15-AC-5.1 @M15-AC-5.2 a volunteer sees counts and masked customers, never the rules or audit log', async ({ browser }) => {
    const volunteer = await firstSignIn(browser, 'volunteer@identity.test', PASSWORD);
    await expect(volunteer.getByTestId('tile-Customers')).toBeVisible();
    await expect(volunteer.getByRole('navigation', { name: 'Staff console' })).not.toContainText('Rules');
    await go(volunteer, '/staff/rules');
    await expect(volunteer.getByRole('heading', { level: 1 })).toHaveText('Not found');
    await go(volunteer, '/staff/audit');
    await expect(volunteer.getByRole('heading', { level: 1 })).toHaveText('Not found');
    await go(volunteer, '/staff/customers');
    await expect(volunteer.getByTestId('customers')).toBeVisible();
  });

  test('@M15-AC-3.4 the audit log filters events and shows the chain check', async () => {
    await go(admin, '/staff/audit?action=kb.rule.');
    await expect(admin.getByTestId('chain')).toContainText('Chain intact');
    const rows = admin.getByTestId('audit').locator('tbody tr');
    await expect(rows.first()).toContainText('kb.rule.');
    for (const r of await rows.all()) await expect(r).toContainText('kb.rule.');
    await expect(admin.getByTestId('audit')).toContainText('kb.rule.verified');
  });

  test('@M15-AC-1.2 a citizen session never opens the staff console', async ({ page }) => {
    const mobile = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await go(page, '/en/sign-in');
    await page.getByLabel('Mobile number').fill(mobile);
    await page.getByRole('button', { name: 'Send code' }).click();
    const body = ((await (await page.request.get(`/api/dev/outbox?mobile=${mobile}`)).json()) as { body: string }).body;
    await page.getByLabel('6-digit code').fill(/(\d{6})/.exec(body)![1]!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/me$/);
    const citizen = (await page.context().cookies()).find((c) => c.name === 'identity_session')!;
    await page.context().addCookies([{ ...citizen, name: 'identity_staff', path: '/staff' }]);
    await go(page, '/staff');
    await expect(page).toHaveURL(/\/staff\/sign-in$/);
  });

  test('@M19-AC-1.2 @M19-AC-2.1 @M19-AC-3.1 @F08-AC-1.1 @F08-AC-2.1 @F08-AC-3.1 @M04-AC-1.1 @M04-AC-1.3 @M04-AC-2.1 @M04-AC-2.2 @M09-AC-1.1 @M09-AC-3.1 @M09-AC-3.4 a citizen asks for help; staff work the case; the citizen follows it', async ({ browser }) => {
    test.setTimeout(240_000);
    const citizen = await (await browser.newContext()).newPage();
    const mobile = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await go(citizen, '/en/sign-in');
    await citizen.getByLabel('Mobile number').fill(mobile);
    await citizen.getByRole('button', { name: 'Send code' }).click();
    await expect(citizen.getByText(/We sent a 6-digit code/)).toBeVisible({ timeout: 20_000 });
    const body = ((await (await citizen.request.get(`/api/dev/outbox?mobile=${mobile}`)).json()) as { body: string }).body;
    await citizen.getByLabel('6-digit code').fill(/(\d{6})/.exec(body)![1]!);
    await citizen.getByRole('button', { name: 'Sign in' }).click();
    await citizen.getByLabel(/I have read this and agree/).check();
    await citizen.getByRole('button', { name: 'Start my Full Check' }).click();
    for (const [kind, name] of [['aadhaar', 'Mohammed Ibrahim'], ['sslc', 'Mohammed Ibrahim'], ['pan', 'Ibrahim Mujeeb']]) {
      await go(citizen, `/en/me/documents/new/${kind}`);
      await citizen.locator('section', { hasText: 'Type the details' }).getByLabel('Name', { exact: true }).fill(name!);
      await citizen.getByRole('button', { name: 'Save document' }).click();
      await expect(citizen.getByText('Document saved.')).toBeVisible();
    }
    await go(citizen, '/en/me/report');
    await citizen.getByTestId('field-name').getByRole('button', { name: 'Confirm target' }).click();
    await expect(citizen.getByText('Target confirmed.')).toBeVisible();

    await go(citizen, '/en/me/roadmap');
    await citizen.locator('[data-step="correction"]', { hasText: 'Correct your PAN' }).getByTestId('ask-help').click();
    await expect(citizen.getByRole('heading', { level: 1 })).toHaveText('Ask 1dentity to help');
    await expect(citizen.getByTestId('government-fee')).toContainText('never to 1dentity');
    await citizen.getByLabel(/I agree that the 1dentity staff on my case/).check();
    await citizen.getByRole('button', { name: 'Agree and continue' }).click();
    await citizen.getByLabel('I am 60 or older').check();
    await citizen.getByLabel(/Send me SMS updates about my case/).check();
    await citizen.getByRole('button', { name: 'Request help' }).click();
    await expect(citizen.getByTestId('banner-success')).toContainText(/Your case ID is \W?ID-\d{5}/);
    await expect(citizen.getByTestId('stage')).toHaveText('Request received');
    const caseId = /ID-\d{5,}/.exec((await citizen.getByRole('heading', { level: 1 }).textContent())!)![0];

    await go(admin, '/staff/cases?filter=unassigned');
    const row = admin.getByTestId('queue').locator(`[data-case="${caseId}"]`);
    await expect(row).toContainText('Mohammed I.');
    await expect(row).toContainText('60+');
    await row.getByRole('link').click();
    await admin.getByRole('button', { name: 'Take this case' }).click();
    await expect(admin.getByTestId('assignee')).toHaveText('Development admin');
    await admin.getByRole('button', { name: '→ In progress' }).click();
    await admin.getByLabel('New note').fill('Please upload your SSLC marks card.');
    await admin.getByRole('radio', { name: 'For the citizen' }).check();
    await admin.getByRole('button', { name: 'Save note' }).click();
    await expect(admin.getByTestId('notes')).toContainText('visible to the citizen');
    await admin.getByRole('button', { name: '→ Awaiting citizen' }).click();
    await expect(admin.getByTestId('stage')).toContainText('Awaiting citizen');

    await go(citizen, citizen.url().replace(/\?.*$/, ''));
    await expect(citizen.getByTestId('stage')).toHaveText('We need something from you');
    await expect(citizen.getByTestId('case-status')).toContainText('Helping you: Development A.');
    await expect(citizen.getByTestId('notes')).toContainText('Please upload your SSLC marks card.');
    await citizen.getByLabel('Message', { exact: true }).fill('I will bring it to the desk tomorrow.');
    await citizen.getByRole('button', { name: 'Send' }).click();
    await expect(citizen.getByTestId('banner-success')).toContainText('Sent.');

    await go(admin, admin.url().replace(/\?.*$/, ''));
    await expect(admin.getByTestId('notes')).toContainText('I will bring it to the desk tomorrow.');
    await admin.getByRole('button', { name: '→ In progress' }).click();
    await admin.getByLabel('Application reference').fill('PAN-CR-881234');
    await admin.getByRole('button', { name: 'Record filing' }).click();
    await expect(admin.getByTestId('stage')).toContainText('Filed');

    await go(citizen, citizen.url().replace(/\?.*$/, ''));
    await expect(citizen.getByTestId('stage')).toHaveText('Filed on the official portal');
    await expect(citizen.getByTestId('reference')).toContainText('PAN-CR-881234');
    await expect(citizen.getByTestId('timeline')).toContainText('Request received');

    // F08 · the SMS carries only the case ID and a link to 1dentity; the notification list shows what changed.
    const sms = ((await (await citizen.request.get(`/api/dev/outbox?mobile=${mobile}`)).json()) as { body: string }).body;
    expect(sms).toContain(`your application for ${caseId} has been filed`);
    expect(sms).toMatch(/http:\/\/[^ ]+\/en\/me\/cases\//);
    expect(sms).not.toContain('Ibrahim');
    await go(citizen, '/en/me');
    await expect(citizen.getByTestId('notifications-link')).toContainText('new notification');
    await citizen.getByTestId('notifications-link').click();
    await expect(citizen.getByTestId('notifications').locator('[data-kind="case_filed"]')).toContainText(`Your application for`);

    // M19 · the fee is set, accepted by the citizen, paid at the desk, and receipted — never a government fee.
    await go(admin, admin.url().replace(/\?.*$/, ''));
    await admin.getByLabel('Fee (₹)').fill('199');
    await admin.getByRole('button', { name: 'Set fee' }).click();
    await expect(admin.getByTestId('fee-status')).toContainText('Waiting for the citizen to accept');
    await go(citizen, '/en/me/cases');
    await citizen.getByTestId('cases').getByRole('link').first().click();
    await citizen.getByRole('button', { name: /I accept the fee of ₹199/ }).click();
    await expect(citizen.getByTestId('fee-status')).toContainText('To pay at the help desk.');
    await go(admin, admin.url().replace(/\?.*$/, ''));
    await admin.getByRole('button', { name: 'Record payment of ₹199' }).click();
    await expect(admin.getByTestId('ledger')).toContainText('payment · ₹199 · Cash');
    await go(citizen, citizen.url().replace(/\?.*$/, ''));
    await expect(citizen.getByTestId('fee-status')).toContainText('Paid');
    await citizen.getByRole('link', { name: /Receipt \W?R-\d{5}/ }).click();
    await expect(citizen.getByTestId('receipt')).toContainText('This is not a government fee.');
    await go(admin, '/staff/revenue');
    await expect(admin.getByTestId('rev-Collected')).toContainText('₹199');
  });

  test('@F03-AC-1.1 no serious accessibility violations on the staff console', async () => {
    for (const path of ['/staff', '/staff/cases', '/staff/revenue', '/staff/rules', '/staff/rules/rule/voter-form-8-correction', '/staff/audit', '/staff/team', '/staff/customers']) {
      await go(admin, path);
      const results = await new AxeBuilder({ page: admin }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([]);
    }
  });
});
