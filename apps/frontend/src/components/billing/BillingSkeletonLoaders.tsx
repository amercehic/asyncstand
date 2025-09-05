import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/components/ui/utils';

// Shimmer animation
const shimmerVariants = {
  initial: { backgroundPosition: '-100% 0' },
  animate: { backgroundPosition: '100% 0' },
};

const shimmerTransition = {
  duration: 2,
  repeat: Infinity,
  ease: 'linear' as const,
};

const SkeletonBox: React.FC<{ className?: string; animated?: boolean }> = ({
  className,
  animated = true,
}) => (
  <motion.div
    className={cn(
      'bg-gradient-to-r from-accent via-accent/50 to-accent rounded',
      animated && 'bg-[length:200%_100%]',
      className
    )}
    {...(animated && {
      variants: shimmerVariants,
      animate: 'animate',
      initial: 'initial',
      transition: shimmerTransition,
    })}
    style={{
      backgroundImage: animated
        ? 'linear-gradient(90deg, hsl(var(--accent)) 0%, hsl(var(--accent) / 0.5) 50%, hsl(var(--accent)) 100%)'
        : undefined,
    }}
  />
);

export const PlanCardSkeleton: React.FC = () => (
  <div className="bg-card border border-border rounded-xl p-6">
    <div className="flex items-start justify-between mb-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonBox className="w-5 h-5 rounded" />
          <SkeletonBox className="w-16 h-6 rounded-full" />
        </div>
        <SkeletonBox className="w-24 h-8" />
        <SkeletonBox className="w-32 h-4" />
      </div>
      <SkeletonBox className="w-8 h-8 rounded-lg" />
    </div>

    <div className="space-y-3 mb-6">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between">
          <SkeletonBox className="w-20 h-4" />
          <SkeletonBox className="w-12 h-4" />
        </div>
      ))}
    </div>

    <div className="flex gap-2">
      <SkeletonBox className="flex-1 h-10 rounded-lg" />
      <SkeletonBox className="w-12 h-10 rounded-lg" />
    </div>
  </div>
);

export const UsageCardSkeleton: React.FC = () => (
  <div className="bg-card border border-border rounded-xl p-6">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <SkeletonBox className="w-5 h-5 rounded" />
        <SkeletonBox className="w-32 h-5" />
      </div>
      <SkeletonBox className="w-8 h-8 rounded-lg" />
    </div>

    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-4 h-4 rounded" />
              <SkeletonBox className="w-24 h-4" />
            </div>
            <SkeletonBox className="w-32 h-4" />
          </div>
          <SkeletonBox className="w-full h-2 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export const PaymentMethodCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-lg">
    <div className="flex items-start justify-between mb-4">
      <SkeletonBox className="w-12 h-8 rounded" animated={false} />
      <SkeletonBox className="w-6 h-6 rounded" animated={false} />
    </div>

    <div className="space-y-2">
      <SkeletonBox className="w-48 h-5 rounded" animated={false} />
      <SkeletonBox className="w-24 h-4 rounded" animated={false} />
    </div>
  </div>
);

export const BillingTableSkeleton: React.FC = () => (
  <div className="bg-card border border-border rounded-xl">
    <div className="p-6 border-b border-border">
      <div className="flex items-center justify-between">
        <SkeletonBox className="w-32 h-5" />
        <SkeletonBox className="w-40 h-8 rounded-lg" />
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-3 text-left">
              <SkeletonBox className="w-12 h-3" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonBox className="w-20 h-3" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonBox className="w-16 h-3" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonBox className="w-14 h-3" />
            </th>
            <th className="px-6 py-3 text-right">
              <SkeletonBox className="w-16 h-3 ml-auto" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, idx) => (
            <tr key={idx}>
              <td className="px-6 py-4">
                <SkeletonBox className="w-24 h-4" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBox className="w-32 h-4" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBox className="w-16 h-4" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBox className="w-16 h-6 rounded-full" />
              </td>
              <td className="px-6 py-4 text-right">
                <SkeletonBox className="w-20 h-4 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const BillingPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-background">
    {/* Hero Section Skeleton */}
    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-2">
          <SkeletonBox className="w-80 h-8" />
          <SkeletonBox className="w-96 h-5" />
        </div>
      </div>
    </div>

    {/* Main Content Skeleton */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Subscription Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlanCardSkeleton />
          <UsageCardSkeleton />
        </div>

        {/* Payment Methods */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-5 h-5 rounded" />
              <SkeletonBox className="w-40 h-5" />
            </div>
            <SkeletonBox className="w-32 h-8 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PaymentMethodCardSkeleton />
            <PaymentMethodCardSkeleton />
            <div className="h-full min-h-[180px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3">
              <SkeletonBox className="w-12 h-12 rounded-full" />
              <SkeletonBox className="w-32 h-4" />
            </div>
          </div>
        </div>

        {/* Billing History */}
        <BillingTableSkeleton />

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <SkeletonBox className="w-32 h-5 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="p-4 bg-accent rounded-lg">
                <div className="flex items-center gap-3">
                  <SkeletonBox className="w-5 h-5 rounded" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBox className="w-32 h-4" />
                    <SkeletonBox className="w-24 h-3" />
                  </div>
                  <SkeletonBox className="w-4 h-4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
