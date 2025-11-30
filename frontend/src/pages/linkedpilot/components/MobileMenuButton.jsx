import React from 'react';
import { Menu } from 'lucide-react';
import designTokens from '@/designTokens';

const MobileMenuButton = ({ onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lg:hidden h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all ${className}`}
      aria-label="Open navigation menu"
      style={{
        borderColor: designTokens.colors.border.light,
      }}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
};

export default MobileMenuButton;





