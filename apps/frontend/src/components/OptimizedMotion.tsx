import React from 'react';
import { motion, MotionProps, Transition } from 'framer-motion';

/**
 * Optimized motion variants with reduced GPU usage
 */
export const optimizedVariants = {
  // Fade animations using opacity (GPU-accelerated)
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  // Scale animations (GPU-accelerated)
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },

  // Slide animations using transform (GPU-accelerated)
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },

  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },

  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },

  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
};

/**
 * Optimized motion transition defaults
 */
export const optimizedTransitions = {
  // Smooth easing for better perceived performance
  smooth: {
    type: 'tween' as const,
    ease: 'easeOut' as const,
    duration: 0.3,
  },

  // Fast transitions for immediate feedback
  fast: {
    type: 'tween' as const,
    ease: 'easeOut' as const,
    duration: 0.15,
  },

  // Spring physics for natural feel
  spring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 1,
  },

  // Bouncy spring for playful animations
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 15,
    mass: 0.8,
  },
};

interface OptimizedMotionProps extends Omit<MotionProps, 'transition'> {
  variant?: keyof typeof optimizedVariants;
  transition?: keyof typeof optimizedTransitions;
  reduceMotion?: boolean;
}

/**
 * High-performance motion component with automatic optimizations
 */
export const OptimizedMotion = React.memo<OptimizedMotionProps>(
  ({ variant, transition = 'smooth', reduceMotion, children, ...props }) => {
    // Respect user's reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const shouldReduceMotion = reduceMotion ?? prefersReducedMotion;

    // Use optimized variants if specified
    const motionProps = variant ? optimizedVariants[variant] : {};

    // Apply transition optimization
    const transitionConfig: Transition = shouldReduceMotion
      ? { duration: 0.01 }
      : optimizedTransitions[transition];

    return (
      <motion.div
        {...motionProps}
        transition={transitionConfig}
        style={{
          // Force GPU acceleration for better performance
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          perspective: 1000,
          ...props.style,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

OptimizedMotion.displayName = 'OptimizedMotion';

/**
 * Optimized card component with hover animations
 */
export const OptimizedCard = React.memo<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverScale?: boolean;
}>(({ children, className, onClick, hoverScale = true }) => {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={hoverScale ? { scale: 1.02, y: -2 } : undefined}
      whileTap={{ scale: 0.98 }}
      transition={optimizedTransitions.smooth as Transition}
      style={{
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
});

OptimizedCard.displayName = 'OptimizedCard';
