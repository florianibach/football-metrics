import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/api/tcx') && route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]'
      });
      return;
    }

    if (url.pathname.endsWith('/api/profile') && route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
          preferredSpeedUnit: 'Kmh'
        })
      });
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
