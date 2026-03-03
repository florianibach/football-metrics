import { expect, test, type Page } from '@playwright/test';

const profileResponse = {
  sessionType: 'Training',
  matchResult: null,
  competition: null,
  opponentName: null,
  opponentLogoUrl: null,
  metricThresholds: {
    maxSpeedMps: 8,
    maxSpeedMode: 'Adaptive',
    maxHeartRateBpm: 190,
    maxHeartRateMode: 'Adaptive'
  },
  preferredAggregationWindowMinutes: 1,
  preferredSmoothingFilter: 'AdaptiveMedian',
  preferredSpeedUnit: 'Kmh',
  preferredLanguage: 'en'
};

async function openUploadPage(page: Page) {
  await page.getByRole('button', { name: 'Upload area' }).click();
  await expect(page.getByRole('heading', { name: 'Football Metrics – TCX Upload' })).toBeVisible();
}

async function openProfilePage(page: Page) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile settings' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/api/tcx') && route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }

    if (url.pathname.endsWith('/api/profile') && route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileResponse) });
      return;
    }

    if (url.pathname.endsWith('/api/profile') && route.request().method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileResponse) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
});

test('smoke01 upload rejects non-tcx file extension', async ({ page }) => {
  await openUploadPage(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'session.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b,c') });
  await expect(page.getByText('Only .tcx files are allowed.')).toBeVisible();
});

test('smoke02 upload accepts tcx extension case-insensitive', async ({ page }) => {
  await openUploadPage(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'SESSION.TCX', mimeType: 'application/xml', buffer: Buffer.from('<tcx />') });
  await expect(page.getByText('Ready to upload: SESSION.TCX.')).toBeVisible();
});

test('smoke03 upload section shows max file size hint', async ({ page }) => {
  await openUploadPage(page);
  await expect(page.getByText('Maximum file size: 20 MB.')).toBeVisible();
});

test('smoke04 english default subtitle is visible in upload', async ({ page }) => {
  await openUploadPage(page);
  await expect(page.getByText('Manual upload for amateur football metrics.')).toBeVisible();
});

test('smoke05 language can be switched to german and reflected in upload subtitle', async ({ page }) => {
  await openProfilePage(page);
  await page.getByLabel('Language').selectOption('de');
  await page.getByRole('button', { name: 'Upload area' }).click();
  await expect(page.getByText('Manueller Upload für Amateur-Fußballmetriken.')).toBeVisible();
});

test('smoke06 language can be switched back to english', async ({ page }) => {
  await openProfilePage(page);
  await page.getByLabel('Language').selectOption('de');
  await page.getByLabel('Sprache').selectOption('en');
  await page.getByRole('button', { name: 'Upload area' }).click();
  await expect(page.getByText('Manual upload for amateur football metrics.')).toBeVisible();
});

test('smoke07 sessions page shows upload history heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Upload history' })).toBeVisible();
});

test('smoke08 sessions filter sidebar opens with controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter & sort' }).click();
  await expect(page.getByLabel('Sort by upload time')).toBeVisible();
  await expect(page.getByLabel('Filter by quality status')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();
});

test('smoke09 sessions filter sidebar close button is actionable', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter & sort' }).click();
  await page.getByRole('complementary', { name: 'Filter & sort' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Upload history' })).toBeVisible();
});

test('smoke10 sessions page exposes date filter inputs', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter & sort' }).click();
  await expect(page.getByLabel('Date from')).toBeVisible();
  await expect(page.getByLabel('Date to')).toBeVisible();
});

test('smoke11 profile page shows display section and theme switch', async ({ page }) => {
  await openProfilePage(page);
  await expect(page.getByRole('group', { name: 'Theme switch' })).toBeVisible();
  await expect(page.getByLabel('Language')).toBeVisible();
});

test('smoke12 profile page shows default smoothing filter value', async ({ page }) => {
  await openProfilePage(page);
  await expect(page.getByLabel('Default smoothing filter')).toHaveValue('AdaptiveMedian');
});

test('smoke13 profile page shows speed unit selector with mph option', async ({ page }) => {
  await openProfilePage(page);
  await page.getByLabel('Preferred speed unit').selectOption('mph');
  await expect(page.getByLabel('Preferred speed unit')).toHaveValue('mph');
});

test('smoke14 profile page shows aggregation window selector', async ({ page }) => {
  await openProfilePage(page);
  await expect(page.getByLabel('Preferred aggregation window')).toBeVisible();
});

test('smoke15 profile save sends PUT request', async ({ page }) => {
  await openProfilePage(page);
  const saveRequestPromise = page.waitForRequest((request) => request.url().includes('/api/v1/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(await saveRequestPromise).toBeTruthy();
});

test('smoke16 primary nav upload tab works', async ({ page }) => {
  await openUploadPage(page);
});

test('smoke17 primary nav sessions tab works', async ({ page }) => {
  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page.getByRole('heading', { name: 'Upload history' })).toBeVisible();
});

test('smoke18 primary nav profile tab works', async ({ page }) => {
  await openProfilePage(page);
});

test('smoke19 app shell shows application version badge', async ({ page }) => {
  await expect(page.getByText('vlocal')).toBeVisible();
});

test('smoke20 metric details sidebar shell is present on sessions page', async ({ page }) => {
  const metricDetails = page.getByRole('complementary', { name: 'Metric details' });
  await expect(metricDetails).toBeVisible();
  await expect(metricDetails.getByText('Not available')).toBeVisible();
});
