import { faker } from '@faker-js/faker';
import { Organization } from '@prisma/client';

export interface CreateOrganizationOptions {
  id?: string;
  name?: string;
}

export interface CreateManyOrganizationsOptions extends CreateOrganizationOptions {
  count: number;
}

export class OrganizationFactory {
  /**
   * Build a single organization object with optional overrides
   */
  static build(overrides: CreateOrganizationOptions = {}): Organization {
    return {
      id: overrides.id ?? faker.string.uuid(),
      name: overrides.name ?? faker.company.name(),
    };
  }

  /**
   * Build multiple organization objects
   */
  static buildMany(options: CreateManyOrganizationsOptions): Organization[] {
    const { count, ...orgOptions } = options;
    return Array.from({ length: count }, (_, index) =>
      this.build({
        ...orgOptions,
        name: orgOptions.name ?? `Test Organization ${index + 1}`,
      }),
    );
  }

  /**
   * Create organization data for API requests
   */
  static buildForRequest(overrides: Partial<CreateOrganizationOptions> = {}) {
    return {
      name: overrides.name ?? faker.company.name(),
    };
  }

  /**
   * Create organization with specific naming patterns for tests
   */
  static buildWithPrefix(prefix: string, overrides: CreateOrganizationOptions = {}) {
    return this.build({
      ...overrides,
      name: `${prefix} ${faker.company.name()}`,
    });
  }

  /**
   * Create test organizations with common scenarios
   */
  static buildTestScenarios() {
    return {
      smallOrg: this.build({ name: 'Small Test Org' }),
      largeOrg: this.build({ name: 'Large Test Corp' }),
      startupOrg: this.build({ name: 'Startup Inc' }),
      enterpriseOrg: this.build({ name: 'Enterprise Solutions Ltd' }),
    };
  }

  /**
   * Generate unique organization name to avoid conflicts in tests
   */
  static generateUniqueName(baseName?: string): string {
    const base = baseName ?? faker.company.name();
    const timestamp = Date.now();
    const random = faker.string.alphanumeric(4);
    return `${base} ${timestamp}-${random}`;
  }
}
