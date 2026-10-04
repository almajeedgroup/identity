import { expect, type Page } from '@playwright/test';

export interface DocValues {
  name?: string;
  dob?: [day: string, month: string, year: string] | [year: string];
  gender?: 'Male' | 'Female' | 'Transgender';
  locality?: string;
}

export interface CheckValues {
  ownPhone?: boolean;
  aadhaar?: DocValues;
  pan?: DocValues;
  voter?: DocValues;
  livesAtAddress?: 'Yes' | 'No' | 'Not sure';
  mobileLinked?: 'Yes' | 'No' | 'Not sure';
  documentsUpdated?: 'Yes' | 'No' | 'Not sure';
}

const DOC_LABEL = { aadhaar: 'Aadhaar', pan: 'PAN', voter: 'Voter ID (EPIC)' } as const;

/** Completes the English Health Check through the UI, the way a citizen would. */
export async function completeHealthCheck(page: Page, values: CheckValues) {
  await page.goto('/en/check');
  for (const key of ['aadhaar', 'pan', 'voter'] as const) {
    if (values[key]) await page.getByLabel(DOC_LABEL[key], { exact: true }).check();
  }
  if (values.ownPhone) await page.getByLabel('Yes — keep my result on this phone').check();
  await page.getByRole('button', { name: 'Next' }).click();

  for (const key of ['aadhaar', 'pan', 'voter'] as const) {
    const doc = values[key];
    if (!doc) continue;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Your ${DOC_LABEL[key]}`);
    if (doc.name) await page.getByLabel(`Name as on ${DOC_LABEL[key]}`).fill(doc.name);
    if (doc.dob?.length === 1) {
      await page.getByLabel('Only the year is printed on the card').check();
      await page.getByLabel('Year', { exact: true }).fill(doc.dob[0]);
    } else if (doc.dob) {
      await page.getByLabel('Day', { exact: true }).fill(doc.dob[0]);
      await page.getByLabel('Month', { exact: true }).fill(doc.dob[1]);
      await page.getByLabel('Year', { exact: true }).fill(doc.dob[2]);
    }
    if (doc.gender) await page.getByLabel(doc.gender, { exact: true }).check();
    if (doc.locality) await page.getByLabel('Area or locality on the card').fill(doc.locality);
    await page.getByRole('button', { name: 'Next' }).click();
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A few quick questions');
  const answer = async (question: string, value?: string) => {
    if (value) await page.getByRole('group', { name: question }).getByLabel(value, { exact: true }).check();
  };
  await answer('Do you still live at the address on your documents?', values.livesAtAddress);
  await answer('Is a mobile number linked to your Aadhaar?', values.mobileLinked);
  await answer('Have you updated your Aadhaar documents (proof of identity and address) in the last 10 years?', values.documentsUpdated);
  await page.getByRole('button', { name: 'See my result' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your document health');
}

/** DPR §06 worked example. */
export const IRFAN: CheckValues = {
  aadhaar: { name: 'Mohammed Irfan', dob: ['12', '06', '1990'], gender: 'Male', locality: 'Shivajinagar' },
  pan: { name: 'Mohd. Irfan', dob: ['12', '06', '1990'] },
  voter: { name: 'Mohammed Irfan', dob: ['01', '01', '1990'], gender: 'Male', locality: 'Shivajinagar' },
  livesAtAddress: 'Yes',
  mobileLinked: 'No',
  documentsUpdated: 'Yes',
};

export const HEALTH_CHECK_KEY = 'identity.healthCheck.v1';
