import { expect, Page } from '@playwright/test';
import axios from 'axios';

export const API_BASE_URL = 'http://localhost:3000';
export const FRONTEND_BASE_URL = 'http://localhost:5173';

// Common selectors
export const SELECTORS = {
  // Forms
  SIGNUP_FORM: '[data-testid="signup-form"]',
  LOGIN_FORM: '[data-testid="login-form"]',
  NAME_INPUT: '[data-testid="name-input"]',
  EMAIL_INPUT: '[data-testid="email-input"]',
  PASSWORD_INPUT: '[data-testid="password-input"]',
  TERMS_CHECKBOX: '[data-testid="terms-checkbox"]',

  // Buttons
  CREATE_ACCOUNT_BUTTON: '[data-testid="create-account-submit-button"]',
  SIGN_IN_BUTTON: '[data-testid="sign-in-submit-button"]',
  LOGOUT_BUTTON: '[data-testid="logout-button"]',

  // Navigation
  NAV_DASHBOARD: '[data-testid="nav-dashboard"]',
  NAV_TEAMS: '[data-testid="nav-teams"]',
  NAV_STANDUPS: '[data-testid="nav-standups"]',

  // Dashboard
  CREATE_FIRST_TEAM_BUTTON: '[data-testid="create-first-team-button"]',
  QUICK_ACTION_PREFIX: '[data-testid^="quick-action-"]',
} as const;

/**
 * Check if the backend server is healthy and ready for testing
 */
export async function waitForBackendHealth(timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (response.status === 200 && response.data?.status === 'ok') {
        console.log('✅ Backend health check passed');
        return true;
      }
    } catch {
      // Backend not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.error('❌ Backend health check failed - server may not be running');
  return false;
}

/**
 * Generate unique test data to avoid conflicts between test runs
 */
export function generateTestData() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);

  return {
    email: `test-${timestamp}-${random}@example.com`,
    name: `Test User ${timestamp}`,
    password: 'TestPassword123!',
  };
}

/**
 * Helper to fill and submit the signup form
 */
export async function fillAndSubmitSignupForm(
  page: Page,
  data: { name: string; email: string; password: string }
) {
  // Fill form fields
  await page.fill('[data-testid="name-input"]', data.name);
  await page.fill('[data-testid="email-input"]', data.email);
  await page.fill('[data-testid="password-input"]', data.password);

  // Check terms checkbox
  await page.check('[data-testid="terms-checkbox"]');

  // Submit form
  await page.click('[data-testid="create-account-submit-button"]');
}

/**
 * Helper to fill and submit the login form
 */
export async function fillAndSubmitLoginForm(
  page: Page,
  data: { email: string; password: string }
) {
  // Fill form fields
  await page.fill('[data-testid="email-input"]', data.email);
  await page.fill('[data-testid="password-input"]', data.password);

  // Submit form
  await page.click('[data-testid="sign-in-submit-button"]');
}

/**
 * Helper to wait for navigation to complete
 */
export async function waitForNavigation(page: Page, expectedPath: string, timeout: number = 15000) {
  await page.waitForURL(`${FRONTEND_BASE_URL}${expectedPath}`, { timeout });
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Helper to verify user is logged in by checking for dashboard elements
 */
export async function verifyUserLoggedIn(page: Page) {
  // Wait for dashboard to load with extended timeout
  await waitForNavigation(page, '/dashboard', 20000);

  // Verify dashboard navigation is present
  await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible({ timeout: 10000 });

  // Verify logout button is present (indicates authentication)
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible({ timeout: 10000 });
}

/**
 * Helper to verify user is logged out by checking redirect to login
 */
export async function verifyUserLoggedOut(page: Page) {
  // Should redirect to login page with extended timeout
  await waitForNavigation(page, '/login', 15000);

  // Verify login form is present
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 10000 });

  // Verify no logout button present
  await expect(page.locator('[data-testid="logout-button"]')).not.toBeVisible({ timeout: 5000 });
}

/**
 * Helper to perform logout action
 */
export async function performLogout(page: Page) {
  // Click logout button directly (it's in the header/sidebar)
  await page.click('[data-testid="logout-button"]');
}

/**
 * Helper to clear test database data (if needed)
 * This would require backend endpoint for test cleanup
 */
export async function cleanupTestData(email: string) {
  try {
    // This would call a test-only endpoint to cleanup test data
    // await axios.delete(`${API_BASE_URL}/test/cleanup`, { data: { email } });
    console.log(`Test data cleanup requested for ${email}`);
  } catch (error) {
    console.warn('Test cleanup failed:', error);
  }
}

/**
 * Accessibility testing helpers
 */
export async function checkAccessibility(page: Page) {
  // Check for proper ARIA labels and roles

  // Verify interactive elements have accessible names
  const buttons = await page.locator('button').all();
  for (const button of buttons) {
    const ariaLabel = await button.getAttribute('aria-label');
    const text = await button.textContent();
    if (!ariaLabel && !text?.trim()) {
      console.warn('Button without accessible name found:', await button.innerHTML());
    }
  }

  // Check for proper heading hierarchy
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  if (headings.length > 0) {
    const firstHeading = headings[0];
    const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase());
    if (tagName !== 'h1') {
      console.warn('Page should start with h1, found:', tagName);
    }
  }
}

/**
 * Performance testing helpers
 */
export async function measurePagePerformance(page: Page) {
  // Measure Core Web Vitals
  const performanceMetrics = await page.evaluate(() => {
    return new Promise(resolve => {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const metrics = {
          navigationStart: performance.timeOrigin,
          loadComplete: performance.now(),
          entries: entries.map(entry => ({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          })),
        };
        resolve(metrics);
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });

      // Fallback timeout
      setTimeout(() => resolve({ metrics: 'timeout' }), 5000);
    });
  });

  return performanceMetrics;
}

/**
 * Network simulation helpers
 */
export async function simulateSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50000, // 50 KB/s
    uploadThroughput: 20000, // 20 KB/s
    latency: 500, // 500ms latency
  });
}

export async function simulateOffline(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  });
}

export async function resetNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.disable');
}

/**
 * Visual regression testing helpers
 */
export async function takeFullPageScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e-results/screenshots/${name}-fullpage.png`,
    fullPage: true,
  });
}

export async function compareElementScreenshot(page: Page, selector: string, name: string) {
  const element = page.locator(selector);
  await element.screenshot({
    path: `e2e-results/screenshots/${name}-element.png`,
  });
}

/**
 * Error scenario testing helpers
 */
export async function interceptApiError(page: Page, endpoint: string, statusCode: number = 500) {
  await page.route(`**/*${endpoint}*`, route => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Simulated API error' }),
    });
  });
}

/**
 * Keyboard navigation testing
 */
export async function testKeyboardNavigation(page: Page, expectedFocusOrder: string[]) {
  // Start from body to ensure we're at the beginning
  await page.locator('body').focus();

  for (let i = 0; i < expectedFocusOrder.length; i++) {
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-testid', expectedFocusOrder[i]);
  }
}
