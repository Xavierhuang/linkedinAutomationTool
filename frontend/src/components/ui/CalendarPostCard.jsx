import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Linkedin, CheckCircle, X, Clock, Edit, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useThemeTokens } from '@/hooks/useThemeTokens';

export const CalendarPostCard = ({
  post,
  timeString,
  onCardClick,
  onDelete,
  onEdit,
  isDragging = false,
  className,
}) => {
  // Defensive check - return null if post is missing
  if (!post) {
    return null;
  }

  const tokens = useThemeTokens();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Prepare images array - use post image or placeholder
  const images = post.image_url 
    ? [post.image_url] 
    : ['https://images.unsplash.com/photo-1611224923853-80b023f02d71?q=80&w=2940&auto=format&fit=crop'];

  // Carousel image change handler
  const changeImage = (newDirection) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => {
      const nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) return images.length - 1;
      if (nextIndex >= images.length) return 0;
      return nextIndex;
    });
  };

  // Animation variants for the carousel
  const carouselVariants = {
    enter: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  // Animation variants for staggering content
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  const postContent = post.content || post.body || 'Untitled Post';
  const truncatedContent = postContent.length > 150 ? postContent.substring(0, 150) + '...' : postContent;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3 }}
      variants={contentVariants}
      whileHover={{ 
        scale: 1.02, 
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      style={{
        width: '100%',
        minHeight: '200px',
        overflow: 'hidden',
        borderRadius: tokens.radius.xl,
        border: `1px solid ${post.is_posted ? tokens.colors.accent.lime + '66' : tokens.colors.border.default}`,
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'pointer',
        backgroundColor: tokens.colors.background.layer1,
        boxShadow: tokens.shadow.subtle,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
      className={cn(
        className
      )}
      onClick={onCardClick}
    >
      {/* Image Carousel Section */}
      <div className="relative group h-40 overflow-hidden rounded-t-xl">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt="Post image"
            custom={direction}
            variants={carouselVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute h-full w-full object-cover"
          />
        </AnimatePresence>
        
        {/* Carousel Navigation - only show if multiple images */}
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-background/60 hover:bg-background text-foreground h-8 w-8" 
              onClick={(e) => {
                e.stopPropagation();
                changeImage(-1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-background/60 hover:bg-background text-foreground h-8 w-8" 
              onClick={(e) => {
                e.stopPropagation();
                changeImage(1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Status Badge - Top Right (like "Top rated" in reference) */}
        <div className="absolute top-3 right-3">
          {post.is_posted ? (
            <Badge 
              variant="secondary" 
              className="bg-primary/20 text-primary px-2.5 py-1 text-[10px] font-medium"
            >
              Posted
            </Badge>
          ) : null}
        </div>

        {/* Pagination Dots - only show if multiple images */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all',
                  currentIndex === index ? 'w-4 bg-white' : 'bg-white/50'
                )}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content Section */}
      <motion.div variants={contentVariants} className="p-3 space-y-2 flex-1 flex flex-col">
        {/* Title and Time */}
        <motion.div variants={itemVariants} className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: tokens.colors.text.primary }}>
              {post.content?.substring(0, 25) || post.body?.substring(0, 25) || 'Scheduled Post'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: tokens.colors.text.secondary }}>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeString}</span>
            </div>
            {post.author_name && (
              <>
                <span>•</span>
                <span>{post.author_name}</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Post Content Description */}
        <motion.p 
          variants={itemVariants} 
          className="text-xs leading-relaxed flex-1 line-clamp-2" 
          style={{ color: tokens.colors.text.secondary }}
        >
          {truncatedContent.length > 80 ? truncatedContent.substring(0, 80) + '...' : truncatedContent}
        </motion.p>

        {/* Footer with Actions */}
        <motion.div 
          variants={itemVariants} 
          className="flex items-center justify-between pt-1"
        >
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {post.hashtags.slice(0, 1).map((tag, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-[9px] px-1.5 py-0.5"
                  style={{
                    borderColor: tokens.colors.border.default,
                    color: tokens.colors.text.tertiary
                  }}
                >
                  {tag.replace(/^#/, '')}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {!post.is_posted && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(e, post);
                }}
                className="h-7 px-2.5 text-[10px] font-medium rounded-md group flex items-center transition-all bg-primary text-primary-foreground shadow hover:bg-primary/90"
              >
                Edit
                <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e, post);
                }}
                className="p-1 rounded-md transition-colors opacity-60 hover:opacity-100 hover:bg-red-500/20"
                style={{ 
                  color: tokens.colors.text.tertiary,
                  borderRadius: tokens.radius.md
                }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

