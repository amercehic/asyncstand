import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

// The environment variables should already be loaded when running with pnpm
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil' as any,
});

const prisma = new PrismaClient();

interface PlanConfig {
  key: string;
  name: string;
  description: string;
  price: number; // in cents
  features: string[];
}

const PLANS: PlanConfig[] = [
  {
    key: 'starter',
    name: 'Starter Plan',
    description: 'Perfect for small teams getting started',
    price: 999, // $9.99
    features: [
      'Up to 10 teams',
      'Up to 25 members',
      'Unlimited standup configurations',
      '500 standups per month',
      'Email support',
    ],
  },
  {
    key: 'professional',
    name: 'Professional Plan',
    description: 'For growing teams that need more',
    price: 2999, // $29.99
    features: [
      'Up to 50 teams',
      'Up to 100 members',
      'Unlimited standup configurations',
      '2000 standups per month',
      'Priority email support',
      'Advanced analytics',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise Plan',
    description: 'For large organizations',
    price: 9999, // $99.99
    features: [
      'Unlimited teams',
      'Unlimited members',
      'Unlimited standup configurations',
      'Unlimited standups',
      'Dedicated support',
      'Custom integrations',
      'SSO/SAML',
    ],
  },
];

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  for (const planConfig of PLANS) {
    try {
      console.log(`Processing ${planConfig.name}...`);

      // Search for existing product
      const existingProducts = await stripe.products.search({
        query: `metadata["plan_key"]:"${planConfig.key}"`,
      });

      let product: Stripe.Product;

      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        console.log(`  ✓ Found existing product: ${product.id}`);
      } else {
        // Create product
        product = await stripe.products.create({
          name: planConfig.name,
          description: planConfig.description,
          metadata: {
            plan_key: planConfig.key,
          },
        });
        console.log(`  ✓ Created product: ${product.id}`);
      }

      // Search for existing price
      const existingPrices = await stripe.prices.search({
        query: `product:"${product.id}" AND metadata["interval"]:"month"`,
      });

      let price: Stripe.Price;

      if (existingPrices.data.length > 0) {
        price = existingPrices.data[0];
        console.log(`  ✓ Found existing price: ${price.id}`);
      } else {
        // Create price
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: planConfig.price,
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          metadata: {
            plan_key: planConfig.key,
            interval: 'month',
          },
        });
        console.log(`  ✓ Created price: ${price.id}`);
      }

      // Update database with Stripe price ID
      await prisma.plan.update({
        where: { key: planConfig.key },
        data: { stripePriceId: price.id },
      });
      console.log(`  ✓ Updated database with price ID: ${price.id}`);
      console.log('');
    } catch (error) {
      console.error(`  ✗ Error processing ${planConfig.name}:`, error);
      console.log('');
    }
  }

  console.log('✅ Stripe products setup complete!\n');

  // Display summary
  const plans = await prisma.plan.findMany({
    where: {
      key: { in: PLANS.map((p) => p.key) },
    },
    select: {
      key: true,
      name: true,
      stripePriceId: true,
    },
  });

  console.log('Summary of configured plans:');
  plans.forEach((plan) => {
    console.log(`  ${plan.name} (${plan.key}): ${plan.stripePriceId}`);
  });
}

// Run the setup
setupStripeProducts()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to setup Stripe products:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
