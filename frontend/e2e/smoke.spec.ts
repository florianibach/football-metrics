import { expect, test } from '@playwright/test';

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
});

test('renders upload UI and validates non-tcx file extensions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Upload area' }).click();

  await expect(page.getByRole('heading', { name: 'Football Metrics – TCX Upload' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'session.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b,c')
  });

  await expect(page.getByText('Only .tcx files are allowed.')).toBeVisible();
});

test('allows switching UI language to german', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByLabel('Language').selectOption('de');

  await page.getByRole('button', { name: 'Upload area' }).click();
  await expect(page.getByRole('heading', { name: 'Football Metrics – TCX Upload' })).toBeVisible();
  await expect(page.getByText('Manueller Upload für Amateur-Fußballmetriken.')).toBeVisible();
});

test('shows session history filter sidebar with default controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Upload history' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter & sort' }).click();

  await expect(page.getByRole('heading', { name: 'Filter & sort' })).toBeVisible();
  await expect(page.getByLabel('Sort by upload time')).toBeVisible();
  await expect(page.getByLabel('Filter by quality status')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();
});

test('shows profile processing defaults and allows saving profile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile' }).click();

  await expect(page.getByRole('heading', { name: 'Profile settings' })).toBeVisible();
  await expect(page.getByLabel('Default smoothing filter')).toHaveValue('AdaptiveMedian');

  await page.getByLabel('Preferred speed unit').selectOption('mph');

  const saveRequestPromise = page.waitForRequest((request) => {
    return request.url().includes('/api/v1/profile') && request.method() === 'PUT';
  });

  await page.getByRole('button', { name: 'Save profile' }).click();
  const saveRequest = await saveRequestPromise;
  expect(saveRequest).toBeTruthy();
});

test('supports primary navigation between sessions upload and profile', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Upload area' }).click();
  await expect(page.getByRole('heading', { name: 'Football Metrics – TCX Upload' })).toBeVisible();

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page.getByRole('heading', { name: 'Upload history' })).toBeVisible();

  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile settings' })).toBeVisible();
});
