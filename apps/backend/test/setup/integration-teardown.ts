// Global teardown for integration tests
// This file handles cleanup after all integration tests are complete

export default async function globalTeardown() {
  // Add any global integration test teardown here
  // For example, cleaning up test database, closing connections, etc.
  console.log('Integration test teardown complete');
}
