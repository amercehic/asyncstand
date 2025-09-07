/**
 * Manages cleanup operations for tests
 */
export class CleanupManager {
  private cleanupFunctions: Array<{ name: string; fn: () => Promise<void> }> = [];
  private executedCleanups: Set<string> = new Set();

  /**
   * Add a cleanup function to be executed later
   */
  addCleanup(name: string, fn: () => Promise<void>): void {
    // Avoid duplicate cleanups
    if (!this.executedCleanups.has(name)) {
      this.cleanupFunctions.push({ name, fn });
    }
  }

  /**
   * Execute all cleanup functions in reverse order (LIFO)
   */
  async executeCleanup(): Promise<void> {
    const errors: Array<{ name: string; error: Error }> = [];

    // Execute in reverse order to handle dependencies
    for (const { name, fn } of this.cleanupFunctions.reverse()) {
      if (this.executedCleanups.has(name)) {
        continue;
      }

      try {
        await fn();
        this.executedCleanups.add(name);
      } catch (error) {
        console.error(`Cleanup failed for ${name}:`, error);
        errors.push({ name, error: error as Error });
      }
    }

    // Clear the cleanup queue
    this.cleanupFunctions = [];

    if (errors.length > 0) {
      console.warn(
        `${errors.length} cleanup operations failed:`,
        errors.map((e) => e.name).join(', '),
      );
    }
  }

  /**
   * Clear all cleanup functions without executing them
   */
  clear(): void {
    this.cleanupFunctions = [];
    this.executedCleanups.clear();
  }

  /**
   * Get the number of pending cleanup functions
   */
  getPendingCount(): number {
    return this.cleanupFunctions.length;
  }
}
