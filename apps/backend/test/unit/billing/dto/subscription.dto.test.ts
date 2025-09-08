import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
} from '@/billing/dto/subscription.dto';
import { SubscriptionStatus } from '@prisma/client';

describe('Subscription DTOs', () => {
  describe('CreateSubscriptionDto', () => {
    it('should validate valid data', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
        paymentMethodId: 'pm_123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate without optional paymentMethodId', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing planId', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        paymentMethodId: 'pm_123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('planId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string planId', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 123,
        paymentMethodId: 'pm_123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('planId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string paymentMethodId', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
        paymentMethodId: 123,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('paymentMethodId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept empty string for optional paymentMethodId', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
        paymentMethodId: '',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateSubscriptionDto', () => {
    it('should validate with planId only', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        planId: 'enterprise',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with status only', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        status: SubscriptionStatus.active,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with both planId and status', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        planId: 'pro',
        status: SubscriptionStatus.active,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate empty DTO', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid status enum', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        status: 'invalid_status',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should fail validation with non-string planId', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        planId: 123,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('planId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should validate with all valid subscription statuses', async () => {
      const validStatuses = [
        SubscriptionStatus.active,
        SubscriptionStatus.canceled,
        SubscriptionStatus.incomplete,
        SubscriptionStatus.incomplete_expired,
        SubscriptionStatus.past_due,
        SubscriptionStatus.trialing,
        SubscriptionStatus.unpaid,
        SubscriptionStatus.paused,
      ];

      for (const status of validStatuses) {
        const dto = plainToClass(UpdateSubscriptionDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('SubscriptionResponseDto', () => {
    const validResponseData = {
      id: 'sub_123',
      organizationId: 'org_456',
      planId: 'plan_789',
      planKey: 'pro',
      status: SubscriptionStatus.active,
      stripeSubscriptionId: 'stripe_sub_123',
      currentPeriodStart: new Date('2023-01-01'),
      currentPeriodEnd: new Date('2023-01-31'),
      cancelAtPeriodEnd: false,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };

    it('should have all required properties', () => {
      const dto = plainToClass(SubscriptionResponseDto, validResponseData);

      expect(dto.id).toBe('sub_123');
      expect(dto.organizationId).toBe('org_456');
      expect(dto.planId).toBe('plan_789');
      expect(dto.planKey).toBe('pro');
      expect(dto.status).toBe(SubscriptionStatus.active);
      expect(dto.stripeSubscriptionId).toBe('stripe_sub_123');
      expect(dto.currentPeriodStart).toEqual(new Date('2023-01-01'));
      expect(dto.currentPeriodEnd).toEqual(new Date('2023-01-31'));
      expect(dto.cancelAtPeriodEnd).toBe(false);
      expect(dto.createdAt).toEqual(new Date('2023-01-01'));
      expect(dto.updatedAt).toEqual(new Date('2023-01-01'));
    });

    it('should work without optional planKey', () => {
      const dataWithoutPlanKey = { ...validResponseData };
      delete dataWithoutPlanKey.planKey;

      const dto = plainToClass(SubscriptionResponseDto, dataWithoutPlanKey);

      expect(dto.planKey).toBeUndefined();
      expect(dto.id).toBe('sub_123');
      expect(dto.planId).toBe('plan_789');
    });

    it('should preserve date objects', () => {
      const dto = plainToClass(SubscriptionResponseDto, validResponseData);

      expect(dto.currentPeriodStart).toBeInstanceOf(Date);
      expect(dto.currentPeriodEnd).toBeInstanceOf(Date);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle string dates when transforming', () => {
      const dataWithStringDates = {
        ...validResponseData,
        currentPeriodStart: '2023-01-01T00:00:00Z',
        currentPeriodEnd: '2023-01-31T23:59:59Z',
        createdAt: '2023-01-01T12:00:00Z',
        updatedAt: '2023-01-01T12:00:00Z',
      };

      const dto = plainToClass(SubscriptionResponseDto, dataWithStringDates);

      expect(dto.currentPeriodStart).toEqual('2023-01-01T00:00:00Z');
      expect(dto.currentPeriodEnd).toEqual('2023-01-31T23:59:59Z');
      expect(dto.createdAt).toEqual('2023-01-01T12:00:00Z');
      expect(dto.updatedAt).toEqual('2023-01-01T12:00:00Z');
    });

    it('should handle boolean values correctly', () => {
      const dtoWithTrue = plainToClass(SubscriptionResponseDto, {
        ...validResponseData,
        cancelAtPeriodEnd: true,
      });

      const dtoWithFalse = plainToClass(SubscriptionResponseDto, {
        ...validResponseData,
        cancelAtPeriodEnd: false,
      });

      expect(dtoWithTrue.cancelAtPeriodEnd).toBe(true);
      expect(dtoWithFalse.cancelAtPeriodEnd).toBe(false);
    });

    it('should handle all subscription status types', () => {
      const statusTypes = [
        SubscriptionStatus.active,
        SubscriptionStatus.canceled,
        SubscriptionStatus.incomplete,
        SubscriptionStatus.incomplete_expired,
        SubscriptionStatus.past_due,
        SubscriptionStatus.trialing,
        SubscriptionStatus.unpaid,
        SubscriptionStatus.paused,
      ];

      statusTypes.forEach((status) => {
        const dto = plainToClass(SubscriptionResponseDto, {
          ...validResponseData,
          status,
        });

        expect(dto.status).toBe(status);
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle null values gracefully in CreateSubscriptionDto', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
        paymentMethodId: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle undefined values gracefully in UpdateSubscriptionDto', async () => {
      const dto = plainToClass(UpdateSubscriptionDto, {
        planId: undefined,
        status: undefined,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle extra properties in input data', async () => {
      const dto = plainToClass(CreateSubscriptionDto, {
        planId: 'pro',
        paymentMethodId: 'pm_123',
        extraProperty: 'should be ignored',
        anotherExtra: 42,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      // Note: class-validator does not strip extra properties, it only validates defined properties
      expect((dto as unknown as Record<string, unknown>).extraProperty).toBe('should be ignored');
      expect((dto as unknown as Record<string, unknown>).anotherExtra).toBe(42);
    });
  });
});
