import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function useThemeTokens() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Ensure theme is always defined (default to 'dark' if undefined)
  const resolvedTheme = mounted ? (theme || 'dark') : 'dark';
  const isDark = resolvedTheme === 'dark';

  return {
    colors: {
      background: {
        app: isDark ? '#0E0E0E' : '#FFFFFF',
        layer1: isDark ? '#161616' : '#FAFAFA',
        layer2: isDark ? '#1F1F1F' : '#F5F5F5',
        input: isDark ? '#1A1A1A' : '#FFFFFF',
        pill: isDark ? '#1A1A1A' : '#F5F5F5',
      },
      text: {
        primary: isDark ? '#EDEDED' : '#171717',
        secondary: isDark ? '#A1A1A1' : '#737373',
        tertiary: isDark ? '#666666' : '#525252',
        inverse: isDark ? '#0E0E0E' : '#FFFFFF',
      },
      accent: {
        lime: '#88D9E7', // Same blue for both light and dark mode
        limeHover: '#A0E5F0', // Same hover color for both modes
        white: '#FFFFFF',
      },
      border: {
        subtle: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        default: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        strong: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      },
      status: {
        badge: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }
    },
    shadow: {
      subtle: isDark 
        ? '0 4px 20px rgba(0, 0, 0, 0.2)' 
        : '0 4px 20px rgba(0, 0, 0, 0.1)',
      card: isDark 
        ? '0 10px 40px rgba(0, 0, 0, 0.3)' 
        : '0 10px 40px rgba(0, 0, 0, 0.15)',
      floating: isDark 
        ? '0 20px 60px rgba(0, 0, 0, 0.4)' 
        : '0 20px 60px rgba(0, 0, 0, 0.2)',
    },
    radius: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      '2xl': '32px',
      full: '9999px',
    },
    typography: {
      fontFamily: {
        sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        serif: "'Playfair Display', 'Georgia', serif",
      },
    },
    isDark,
  };
}

