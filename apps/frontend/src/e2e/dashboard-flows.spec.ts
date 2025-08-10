import { test, expect } from '@playwright/test';
import {
  waitForBackendHealth,
  generateTestData,
  fillAndSubmitSignupForm,
  verifyUserLoggedIn,
  performLogout,
  cleanupTestData,
  SELECTORS,
  FRONTEND_BASE_URL,
  takeFullPageScreenshot,
  checkAccessibility,
  measurePagePerformance,
  testKeyboardNavigation,
} from './utils/test-helpers';

let testUser: { name: string; email: string; password: string };

test.describe('Dashboard Flows', () => {
  test.beforeAll(async () => {
    const isHealthy = await waitForBackendHealth();
    if (!isHealthy) {
      throw new Error(
        'Backend server is not healthy. Please start the backend server before running E2E tests.'
      );
    }

    testUser = generateTestData();
    console.log(`Generated test user: ${testUser.email}`);
  });

  test.afterAll(async () => {
    if (testUser?.email) {
      await cleanupTestData(testUser.email);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Signup and login before each test
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await fillAndSubmitSignupForm(page, testUser);
    await verifyUserLoggedIn(page);
  });

  test.describe('Dashboard UI Components', () => {
    test('should display all dashboard elements correctly', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify header elements
      await expect(page.locator('text=AsyncStand')).toBeVisible();
      await expect(page.locator(SELECTORS.NAV_DASHBOARD)).toBeVisible();
      await expect(page.locator(SELECTORS.NAV_TEAMS)).toBeVisible();
      await expect(page.locator(SELECTORS.NAV_STANDUPS)).toBeVisible();
      await expect(page.locator(SELECTORS.LOGOUT_BUTTON)).toBeVisible();

      // Verify user profile section
      await expect(page.locator('text=Welcome back')).toBeVisible();
      await expect(page.locator(`text=${testUser.name.split(' ')[0]}`)).toBeVisible();

      // Verify stats grid
      await expect(page.locator('text=Active Teams')).toBeVisible();
      await expect(page.locator("text=This Week's Standups")).toBeVisible();
      await expect(page.locator('text=Completion Rate')).toBeVisible();

      // Verify quick actions
      await expect(page.locator('text=Quick Actions')).toBeVisible();
      await expect(page.locator(SELECTORS.CREATE_FIRST_TEAM_BUTTON)).toBeVisible();

      // Take screenshot for visual regression
      await takeFullPageScreenshot(page, 'dashboard-main');
    });

    test('should handle quick actions correctly', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Test quick action buttons
      const quickActions = [
        'quick-action-create-team',
        'quick-action-join-team',
        'quick-action-schedule-standup',
        'quick-action-settings',
      ];

      for (const action of quickActions) {
        const button = page.locator(`[data-testid="${action}"]`);
        await expect(button).toBeVisible();

        // Click and verify toast notification appears
        await button.click();
        await expect(page.locator('text=Coming soon!')).toBeVisible();

        // Wait for toast to disappear
        await page.waitForTimeout(1000);
      }
    });

    test('should display user avatar with correct initials', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check user avatar shows first letter of name
      const expectedInitial = testUser.name.charAt(0).toUpperCase();
      const avatar = page.locator('.bg-gradient-to-r.from-primary');
      await expect(avatar).toContainText(expectedInitial);

      // Verify user details are shown
      await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
      await expect(page.locator(`text=${testUser.email}`)).toBeVisible();
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should navigate between dashboard sections', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Test navigation to different sections
      const navItems = [
        { testId: SELECTORS.NAV_TEAMS, expectedText: 'Teams' },
        { testId: SELECTORS.NAV_STANDUPS, expectedText: 'Standups' },
        { testId: SELECTORS.NAV_DASHBOARD, expectedText: 'Dashboard' },
      ];

      for (const navItem of navItems) {
        await page.click(navItem.testId);
        // Verify toast appears for "coming soon" features
        await expect(page.locator('text=Coming soon!')).toBeVisible();
        await page.waitForTimeout(1000); // Wait for toast to disappear
      }
    });

    test('should handle create first team button', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await page.click(SELECTORS.CREATE_FIRST_TEAM_BUTTON);
      await expect(page.locator('text=Navigation to /teams/create - Coming soon!')).toBeVisible();
    });
  });

  test.describe('Dashboard Accessibility', () => {
    test('should be accessible with proper ARIA labels and keyboard navigation', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check accessibility
      await checkAccessibility(page);

      // Test keyboard navigation order
      const expectedFocusOrder = [
        'nav-dashboard',
        'nav-teams',
        'nav-standups',
        'logout-button',
        'quick-action-create-team',
        'quick-action-join-team',
        'quick-action-schedule-standup',
        'quick-action-settings',
        'create-first-team-button',
      ];

      await testKeyboardNavigation(page, expectedFocusOrder);
    });

    test('should have proper semantic HTML structure', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify semantic elements
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('nav')).toBeVisible();

      // Verify heading hierarchy
      await expect(page.locator('h1')).toHaveText(/Welcome back/);
      await expect(page.locator('h2')).toHaveText('Quick Actions');
    });
  });

  test.describe('Dashboard Performance', () => {
    test('should load dashboard within acceptable time limits', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Dashboard should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Measure performance metrics
      const metrics = await measurePagePerformance(page);
      console.log('Dashboard performance metrics:', metrics);
    });

    test('should handle animations smoothly', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for all animations to complete
      await page.waitForTimeout(1000);

      // Verify elements are visible after animations
      await expect(page.locator('text=Welcome back')).toBeVisible();
      await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-3')).toBeVisible();
      await expect(page.locator('text=Quick Actions')).toBeVisible();
    });
  });

  test.describe('Dashboard Error Handling', () => {
    test('should handle logout properly', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Perform logout
      await performLogout(page);

      // Should redirect to login page
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/login`);
      await expect(page.locator(SELECTORS.LOGIN_FORM)).toBeVisible();
    });

    test('should maintain state during page refresh', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify user is logged in
      await expect(page.locator(`text=${testUser.name}`)).toBeVisible();

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on dashboard with user info
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/dashboard`);
      await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
    });
  });
});
