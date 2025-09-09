import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsString()
  planId: string;

  @ApiProperty({ description: 'Stripe payment method ID', required: false })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

export class UpdateSubscriptionDto {
  @ApiProperty({ description: 'New plan ID', required: false })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ enum: SubscriptionStatus, required: false })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  planId: string;

  @ApiProperty({ description: 'Plan key (e.g., "starter", "professional")' })
  planKey?: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  stripeSubscriptionId: string;

  @ApiProperty()
  currentPeriodStart: Date;

  @ApiProperty()
  currentPeriodEnd: Date;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
