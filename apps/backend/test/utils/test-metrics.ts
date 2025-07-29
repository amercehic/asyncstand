import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, readFileSync } from 'fs';

export interface TestMetrics {
  testName: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
  timestamp: Date;
  memory?: {
    used: number;
    total: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

export interface TestSuiteMetrics {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestMetrics[];
  timestamp: Date;
}

export class TestMetricsCollector {
  private static metrics: TestSuiteMetrics[] = [];
  private static currentSuite: TestSuiteMetrics | null = null;
  private static testStartTime: number = 0;

  /**
   * Start collecting metrics for a test suite
   */
  static startSuite(suiteName: string): void {
    this.currentSuite = {
      suiteName,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      timestamp: new Date(),
    };
  }

  /**
   * Start timing a test
   */
  static startTest(): void {
    this.testStartTime = performance.now();
  }

  /**
   * End timing and record test result
   */
  static endTest(testName: string, status: 'passed' | 'failed' | 'skipped'): void {
    if (!this.currentSuite) return;

    const duration = performance.now() - this.testStartTime;
    const memoryUsage = process.memoryUsage();

    const testMetric: TestMetrics = {
      testName,
      duration,
      status,
      timestamp: new Date(),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
      },
    };

    this.currentSuite.tests.push(testMetric);
    this.currentSuite.totalTests++;
    this.currentSuite[status]++;
  }

  /**
   * End collecting metrics for current suite
   */
  static endSuite(): void {
    if (!this.currentSuite) return;

    this.currentSuite.duration = this.currentSuite.tests.reduce(
      (total, test) => total + test.duration,
      0,
    );

    this.metrics.push(this.currentSuite);
    this.currentSuite = null;
  }

  /**
   * Get current metrics
   */
  static getMetrics(): TestSuiteMetrics[] {
    return this.metrics;
  }

  /**
   * Export metrics to JSON file
   */
  static exportMetrics(outputPath: string = 'test-results/metrics.json'): void {
    try {
      const metricsData = {
        timestamp: new Date().toISOString(),
        totalSuites: this.metrics.length,
        totalTests: this.metrics.reduce((sum, suite) => sum + suite.totalTests, 0),
        totalPassed: this.metrics.reduce((sum, suite) => sum + suite.passed, 0),
        totalFailed: this.metrics.reduce((sum, suite) => sum + suite.failed, 0),
        totalSkipped: this.metrics.reduce((sum, suite) => sum + suite.skipped, 0),
        totalDuration: this.metrics.reduce((sum, suite) => sum + suite.duration, 0),
        suites: this.metrics,
        summary: this.generateSummary(),
      };

      writeFileSync(outputPath, JSON.stringify(metricsData, null, 2));
    } catch (error) {
      console.warn('Failed to export test metrics:', error);
    }
  }

  /**
   * Generate test summary
   */
  private static generateSummary() {
    const totalTests = this.metrics.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.metrics.reduce((sum, suite) => sum + suite.passed, 0);
    const totalDuration = this.metrics.reduce((sum, suite) => sum + suite.duration, 0);

    return {
      passRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
      averageTestDuration: totalTests > 0 ? totalDuration / totalTests : 0,
      slowestTests: this.metrics
        .flatMap((suite) => suite.tests)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map((test) => ({
          name: test.testName,
          duration: test.duration,
        })),
      suitePerformance: this.metrics
        .sort((a, b) => b.duration - a.duration)
        .map((suite) => ({
          name: suite.suiteName,
          duration: suite.duration,
          testCount: suite.totalTests,
          averageDuration: suite.totalTests > 0 ? suite.duration / suite.totalTests : 0,
        })),
    };
  }

  /**
   * Reset all metrics
   */
  static reset(): void {
    this.metrics = [];
    this.currentSuite = null;
    this.testStartTime = 0;
  }

  /**
   * Load previous metrics for comparison
   */
  static loadPreviousMetrics(filePath: string = 'test-results/metrics.json') {
    try {
      if (!existsSync(filePath)) return null;
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load previous metrics:', error);
      return null;
    }
  }

  /**
   * Compare current run with previous run
   */
  static compareWithPrevious(previousMetricsPath?: string) {
    const previous = this.loadPreviousMetrics(previousMetricsPath);
    if (!previous) return null;

    const current = {
      totalTests: this.metrics.reduce((sum, suite) => sum + suite.totalTests, 0),
      totalPassed: this.metrics.reduce((sum, suite) => sum + suite.passed, 0),
      totalFailed: this.metrics.reduce((sum, suite) => sum + suite.failed, 0),
      totalDuration: this.metrics.reduce((sum, suite) => sum + suite.duration, 0),
    };

    return {
      testCountChange: current.totalTests - previous.totalTests,
      passRateChange:
        current.totalTests > 0 && previous.totalTests > 0
          ? (current.totalPassed / current.totalTests) * 100 -
            (previous.totalPassed / previous.totalTests) * 100
          : 0,
      durationChange: current.totalDuration - previous.totalDuration,
      performance: current.totalDuration < previous.totalDuration ? 'improved' : 'degraded',
    };
  }
}

/**
 * Jest hook to automatically collect metrics
 */
export const setupTestMetrics = () => {
  beforeAll(() => {
    TestMetricsCollector.startSuite(expect.getState().testPath || 'unknown');
  });

  beforeEach(() => {
    TestMetricsCollector.startTest();
  });

  afterEach(() => {
    const testState = expect.getState();
    const status = testState.isExpectingAssertions ? 'passed' : 'failed';
    TestMetricsCollector.endTest(testState.currentTestName || 'unknown', status);
  });

  afterAll(() => {
    TestMetricsCollector.endSuite();
  });
};

/**
 * Custom Jest reporter for metrics
 */
export class MetricsReporter {
  onRunComplete() {
    TestMetricsCollector.exportMetrics();

    const comparison = TestMetricsCollector.compareWithPrevious();
    if (comparison) {
      console.log('\n📊 Test Performance Comparison:');
      console.log(
        `Tests: ${comparison.testCountChange >= 0 ? '+' : ''}${comparison.testCountChange}`,
      );
      console.log(
        `Pass Rate: ${comparison.passRateChange >= 0 ? '+' : ''}${comparison.passRateChange.toFixed(2)}%`,
      );
      console.log(
        `Duration: ${comparison.durationChange >= 0 ? '+' : ''}${comparison.durationChange.toFixed(2)}ms`,
      );
      console.log(`Performance: ${comparison.performance}`);
    }
  }
}
