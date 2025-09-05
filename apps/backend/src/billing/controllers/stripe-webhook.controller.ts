import {
  Controller,
  Post,
  Body,
  Headers,
  HttpStatus,
  HttpException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { LoggerService } from '@/common/logger.service';
import { StripeService } from '@/billing/services/stripe.service';
import { BillingService } from '@/billing/services/billing.service';
import { CacheService } from '@/common/cache/cache.service';
import Stripe from 'stripe';

@ApiTags('Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly billingService: BillingService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StripeWebhookController.name);
  }

  @Post()
  @ApiOperation({
    summary: 'Handle Stripe webhooks',
    description: 'Endpoint for receiving and processing Stripe webhook events',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid webhook signature or payload',
  })
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      this.logger.error('Missing stripe-signature header');
      throw new HttpException('Missing stripe-signature header', HttpStatus.BAD_REQUEST);
    }

    let event: Stripe.Event;

    try {
      // Get raw body from request
      const payload = request.rawBody;

      if (!payload) {
        this.logger.error('Missing request body');
        throw new HttpException('Missing request body', HttpStatus.BAD_REQUEST);
      }

      // Construct webhook event
      event = this.stripeService.constructWebhookEvent(payload, signature);

      this.logger.debug('Webhook event received', {
        eventId: event.id,
        eventType: event.type,
        created: event.created,
      });
    } catch (error) {
      this.logger.error('Webhook signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        signature: signature.substring(0, 20) + '...', // Log partial signature for debugging
      });

      throw new HttpException('Webhook signature verification failed', HttpStatus.BAD_REQUEST);
    }

    try {
      // Process the webhook event
      await this.billingService.handleWebhookEvent(event);

      // Invalidate invoice caches for affected customer/organization
      try {
        const obj = event.data.object as { customer?: string };
        const customerId = obj?.customer as string | undefined;

        if (customerId) {
          // We don't have orgId here; clear generic invoice cache patterns
          await this.cacheService.invalidate('billing-invoices:*');
          await this.cacheService.invalidate('billing-invoices-cursor:*');
        }
      } catch (err) {
        this.logger.warn('Failed to invalidate invoice caches after webhook', {
          eventType: event.type,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      this.logger.debug('Webhook event processed successfully', {
        eventId: event.id,
        eventType: event.type,
      });

      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to process webhook event', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return 200 to prevent Stripe from retrying if it's a business logic error
      // Stripe will retry 4xx errors but not 2xx
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Webhook received but failed to process',
      };
    }
  }

  @Post('test')
  @ApiOperation({
    summary: 'Test webhook endpoint',
    description: 'Test endpoint to verify webhook configuration (development only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test webhook endpoint is working',
  })
  async testWebhook(@Body() body: Record<string, unknown>) {
    this.logger.debug('Test webhook called', { body });

    return {
      message: 'Test webhook endpoint is working',
      timestamp: new Date().toISOString(),
      receivedData: body,
    };
  }
}
