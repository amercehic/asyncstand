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
  price: number; // in cents (EUR)
  features: string[];
}

const PLANS: PlanConfig[] = [
  {
    key: 'starter',
    name: 'Starter Plan',
    description: 'Perfect for small teams getting started',
    price: 999, // €9.99
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
    price: 2999, // €29.99
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
    price: 9999, // €99.99
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

async function setupStripeProductsEUR() {
  console.log('🚀 Setting up Stripe products and prices in EUR...\n');

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

      // Archive old USD prices (set active to false)
      const existingUSDPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });

      for (const oldPrice of existingUSDPrices.data) {
        if (oldPrice.currency === 'usd') {
          await stripe.prices.update(oldPrice.id, { active: false });
          console.log(`  ✓ Archived old USD price: ${oldPrice.id}`);
        }
      }

      // Search for existing EUR price
      const existingEURPrices = await stripe.prices.search({
        query: `product:"${product.id}" AND currency:"eur" AND metadata["interval"]:"month"`,
      });

      let price: Stripe.Price;

      if (existingEURPrices.data.length > 0 && existingEURPrices.data[0].active) {
        price = existingEURPrices.data[0];
        console.log(`  ✓ Found existing EUR price: ${price.id}`);
      } else {
        // Create EUR price
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: planConfig.price,
          currency: 'eur', // Changed to EUR
          recurring: {
            interval: 'month',
          },
          metadata: {
            plan_key: planConfig.key,
            interval: 'month',
            currency: 'eur',
          },
        });
        console.log(`  ✓ Created EUR price: ${price.id}`);
      }

      // Update database with Stripe EUR price ID
      await prisma.plan.update({
        where: { key: planConfig.key },
        data: {
          stripePriceId: price.id,
          // Prices remain the same numerically (999 = €9.99 instead of $9.99)
        },
      });
      console.log(`  ✓ Updated database with EUR price ID: ${price.id}`);
      console.log('');
    } catch (error) {
      console.error(`  ✗ Error processing ${planConfig.name}:`, error);
      console.log('');
    }
  }

  console.log('✅ Stripe products setup complete with EUR pricing!\n');

  // Display summary
  const plans = await prisma.plan.findMany({
    where: {
      key: { in: PLANS.map((p) => p.key) },
    },
    select: {
      key: true,
      name: true,
      stripePriceId: true,
      price: true,
    },
  });

  console.log('Summary of configured plans:');
  plans.forEach((plan) => {
    const priceDisplay = Number(plan.price) === 0 ? 'Free' : `€${Number(plan.price) / 100}`;
    console.log(`  ${plan.name} (${plan.key}): ${plan.stripePriceId} - ${priceDisplay}`);
  });
}

// Run the setup
setupStripeProductsEUR()
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
