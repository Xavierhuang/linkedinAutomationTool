import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * FramerCarousel - A carousel component that accepts custom React components as items
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items, each with { id, content, completed }
 * @param {number} props.currentIndex - Current active index
 * @param {Function} props.onIndexChange - Callback when index changes (index) => void
 * @param {boolean} props.canGoNext - Whether next button should be enabled
 * @param {boolean} props.canGoPrevious - Whether previous button should be enabled
 */
export function FramerCarousel({ 
  items = [], 
  currentIndex = 0,
  onIndexChange,
  canGoNext = true,
  canGoPrevious = true,
}) {
  const containerRef = useRef(null);
  const x = useMotionValue(0);

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth || 1;
      const targetX = -currentIndex * containerWidth;

      animate(x, targetX, {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      });
    }
  }, [currentIndex, x]);

  const handlePrevious = () => {
    if (canGoPrevious && currentIndex > 0) {
      onIndexChange?.(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext && currentIndex < items.length - 1) {
      onIndexChange?.(currentIndex + 1);
    }
  };

  const handleDotClick = (index) => {
    // Only allow navigation to completed steps or current step
    if (index <= currentIndex || items[index]?.completed) {
      onIndexChange?.(index);
    }
  };

  return (
    <div className="w-full mx-auto">
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-2xl" ref={containerRef}>
          <motion.div className="flex" style={{ x }}>
            {items.map((item) => (
              <div key={item.id} className="shrink-0 w-full min-h-[600px] flex items-center justify-center">
                {item.content}
              </div>
            ))}
          </motion.div>

          {/* Previous Button */}
          <motion.button
            disabled={!canGoPrevious || currentIndex === 0}
            onClick={handlePrevious}
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all z-10 backdrop-blur-md",
              !canGoPrevious || currentIndex === 0
                ? "opacity-40 cursor-not-allowed bg-white/20"
                : "bg-white/80 hover:scale-110 hover:opacity-100 opacity-70 hover:bg-white"
            )}
            whileHover={canGoPrevious && currentIndex > 0 ? { scale: 1.1 } : {}}
            whileTap={canGoPrevious && currentIndex > 0 ? { scale: 0.95 } : {}}
          >
            <svg
              className="w-6 h-6 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </motion.button>

          {/* Next Button */}
          <motion.button
            disabled={!canGoNext || currentIndex === items.length - 1}
            onClick={handleNext}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all z-10 backdrop-blur-md",
              !canGoNext || currentIndex === items.length - 1
                ? "opacity-40 cursor-not-allowed bg-white/20"
                : "bg-white/80 hover:scale-110 hover:opacity-100 opacity-70 hover:bg-white"
            )}
            whileHover={canGoNext && currentIndex < items.length - 1 ? { scale: 1.1 } : {}}
            whileTap={canGoNext && currentIndex < items.length - 1 ? { scale: 0.95 } : {}}
          >
            <svg
              className="w-6 h-6 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </motion.button>

          {/* Progress Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 p-3 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/20">
            {items.map((item, i) => {
              const isActive = i === currentIndex;
              const isCompleted = item.completed;
              const isAccessible = i <= currentIndex || isCompleted;

              return (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  disabled={!isAccessible}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    isActive 
                      ? "w-8 bg-white" 
                      : isCompleted
                      ? "w-4 bg-green-500/60 hover:bg-green-500/80"
                      : "w-2 bg-white/30",
                    !isAccessible && "cursor-not-allowed opacity-50"
                  )}
                  title={item.title || `Step ${i + 1}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

