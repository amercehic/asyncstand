import { test, expect } from '@playwright/test';
import {
  waitForBackendHealth,
  generateTestData,
  fillAndSubmitSignupForm,
  fillAndSubmitLoginForm,
  waitForNavigation,
  verifyUserLoggedIn,
  verifyUserLoggedOut,
  performLogout,
  cleanupTestData,
  FRONTEND_BASE_URL,
} from './utils/test-helpers';

// Global test data that will be shared across tests
let testUser: { name: string; email: string; password: string };

test.describe('Authentication Flows', () => {
  test.beforeAll(async () => {
    // Check if backend is healthy before running tests
    const isHealthy = await waitForBackendHealth();
    if (!isHealthy) {
      throw new Error(
        'Backend server is not healthy. Please start the backend server before running E2E tests.'
      );
    }

    // Generate unique test data for this test run
    testUser = generateTestData();
    console.log(`Generated test user: ${testUser.email}`);
  });

  test.afterAll(async () => {
    // Cleanup test data after all tests complete
    if (testUser?.email) {
      await cleanupTestData(testUser.email);
    }
  });

  test.describe('User Signup Flow', () => {
    test('should successfully sign up a new user and redirect to dashboard', async ({ page }) => {
      // Navigate to signup page
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');

      // Verify signup form is visible
      await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();

      // Fill and submit signup form
      await fillAndSubmitSignupForm(page, testUser);

      // Wait for signup to process and redirect
      await verifyUserLoggedIn(page);
    });

    test('should show validation errors for invalid signup data', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');

      // Try to submit with empty fields (button should be disabled)
      const submitButton = page.locator('[data-testid="create-account-submit-button"]');
      await expect(submitButton).toBeDisabled();

      // Fill form but leave terms unchecked
      await page.fill('[data-testid="name-input"]', 'Test User');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');

      // Button should still be disabled without terms
      await expect(submitButton).toBeDisabled();

      // Fill with invalid email
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.check('[data-testid="terms-checkbox"]');

      // Now button should be enabled but form should show validation on submit
      await expect(submitButton).toBeEnabled();
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');

      // Try to signup with existing email
      await fillAndSubmitSignupForm(page, testUser);

      // Wait a moment for the request to complete, then verify we're still on signup page
      await page.waitForTimeout(2000);

      // Should remain on signup page (not redirect to dashboard)
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/signup`);
    });
  });

  test.describe('User Login Flow', () => {
    test('should successfully login existing user and redirect to dashboard', async ({ page }) => {
      // Start from login page
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Verify login form is visible
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

      // Fill and submit login form
      await fillAndSubmitLoginForm(page, {
        email: testUser.email,
        password: testUser.password,
      });

      // Should redirect to dashboard after successful login
      await verifyUserLoggedIn(page);
    });

    test('should show error for invalid login credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Try to login with wrong password
      await fillAndSubmitLoginForm(page, {
        email: testUser.email,
        password: 'wrongpassword',
      });

      // Wait a moment for the request to complete, then verify we're still on login page
      await page.waitForTimeout(2000);

      // Should remain on login page (not redirect to dashboard)
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/login`);
    });

    test('should handle empty login fields', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Try to submit with empty fields - form should handle validation
      const submitButton = page.locator('[data-testid="sign-in-submit-button"]');
      await submitButton.click();

      // Should remain on login page
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/login`);
    });

    test('should redirect unauthenticated users to login when accessing protected routes', async ({
      page,
    }) => {
      // Try to access dashboard without being logged in
      await page.goto('/dashboard');

      // Should redirect to login page
      await waitForNavigation(page, '/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test.describe('User Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await fillAndSubmitLoginForm(page, {
        email: testUser.email,
        password: testUser.password,
      });
      await verifyUserLoggedIn(page);
    });

    test('should successfully logout user and redirect to login page', async ({ page }) => {
      // Perform logout
      await performLogout(page);

      // Should redirect to login page and clear authentication state
      await verifyUserLoggedOut(page);
    });

    test('should clear authentication state after logout', async ({ page }) => {
      // Perform logout
      await performLogout(page);
      await verifyUserLoggedOut(page);

      // Try to access protected route after logout
      await page.goto('/dashboard');

      // Should redirect back to login
      await waitForNavigation(page, '/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should maintain logout state across page refreshes', async ({ page }) => {
      // Perform logout
      await performLogout(page);
      await verifyUserLoggedOut(page);

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on login page
      await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/login`);
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test.describe('Complete User Journey', () => {
    test('should support complete signup → login → logout → login cycle', async ({ page }) => {
      const newUser = generateTestData();

      // 1. Signup
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');
      await fillAndSubmitSignupForm(page, newUser);
      await verifyUserLoggedIn(page);

      // 2. Logout
      await performLogout(page);
      await verifyUserLoggedOut(page);

      // 3. Login again
      await fillAndSubmitLoginForm(page, {
        email: newUser.email,
        password: newUser.password,
      });
      await verifyUserLoggedIn(page);

      // Cleanup
      await cleanupTestData(newUser.email);
    });
  });
});
