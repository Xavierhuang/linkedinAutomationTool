import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import designTokens from '@/designTokens';
import { useTheme } from 'next-themes';

// Define navigation items
import { Calendar, Send, BarChart3, FileCheck, Megaphone, Building2, FileText, Palette } from 'lucide-react';

const navItems = [
  { id: 'create', label: 'Create', path: '/dashboard/create', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', path: '/dashboard/calendar', icon: Calendar },
  { id: 'campaigns', label: 'Campaigns', path: '/dashboard/campaigns', icon: Megaphone },
  { id: 'drafts', label: 'Drafts', path: '/dashboard/drafts', icon: FileText },
  { id: 'posts', label: 'Posts', path: '/dashboard/posts', icon: Send },
  { id: 'review', label: 'Review', path: '/dashboard/review-queue', icon: FileCheck },
  { id: 'analytics', label: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
  { id: 'organizations', label: 'Organizations', path: '/dashboard/organizations', icon: Building2 },
  { id: 'brand-dna', label: 'Brand DNA', path: '/dashboard/brand-dna', icon: Palette },
];

const FloatingToolbar = ({ activeOrgId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path) => location.pathname.startsWith(path);

  // Determine if we're in dark mode
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  // Theme-aware glassmorphic styles
  const glassStyles = {
    background: isDark 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.05)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.18)'
      : '1px solid rgba(0, 0, 0, 0.18)',
    boxShadow: isDark
      ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      : '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
  };

  const badgeStyles = {
    background: isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.15)'
      : '1px solid rgba(0, 0, 0, 0.15)',
    color: isDark
      ? 'rgba(255, 255, 255, 0.7)'
      : 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };

  const dividerStyles = {
    background: isDark
      ? 'rgba(255, 255, 255, 0.18)'
      : 'rgba(0, 0, 0, 0.18)',
  };

  const menuButtonStyles = {
    color: isDark
      ? 'rgba(255, 255, 255, 0.7)'
      : 'rgba(0, 0, 0, 0.7)',
  };

  const menuButtonHoverStyles = {
    background: isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)',
    color: isDark
      ? 'rgba(255, 255, 255, 0.9)'
      : 'rgba(0, 0, 0, 0.9)',
  };

  return (
    <>
      <div className="fixed top-6 left-6 z-50 w-auto max-w-md">
        <div
          className="flex items-center gap-4 px-2 py-2 rounded-full transition-all duration-300"
          style={glassStyles}
        >
          {/* Logo Section */}
          <div
            className="flex items-center gap-3 pl-4 pr-2 cursor-pointer group"
            onClick={() => navigate('/dashboard/create')}
          >
            {/* Pilot GIF Logo */}
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
            </div>
            <span className="text-foreground font-serif text-sm tracking-wide">LinkedIn Pilot</span>

            {/* Badge */}
            <span 
              className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium"
              style={badgeStyles}
            >
              LinkedIn on Autopilot
            </span>
          </div>

          {/* Divider */}
          <div className="h-6 w-px" style={dividerStyles} />

          {/* Menu Trigger */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <button 
                className="p-2 rounded-full transition-all duration-200"
                style={menuButtonStyles}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, menuButtonHoverStyles);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = menuButtonStyles.color;
                }}
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-background border-r border-border text-foreground p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation menu for LinkedIn Pilot</SheetDescription>
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-primary rounded flex items-center justify-center overflow-hidden">
                      <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-serif text-sm italic text-foreground">LinkedIn Pilot</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">LinkedIn on Autopilot</p>
                </div>

                <ScrollArea className="flex-1 py-4">
                  <nav className="space-y-1 px-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.path);
                            setIsOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all
                            ${active
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
};

export default FloatingToolbar;
