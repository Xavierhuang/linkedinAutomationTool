const designTokens = {
  name: "LinkedIn Pilot Aesthetic",
  version: "2.0.0",
  colors: {
    background: {
      app: "#0E0E0E", // Very dark, near black
      layer1: "#161616", // Slightly lighter
      layer2: "#1F1F1F", // Card background
      input: "#1A1A1A", // Input field background
      pill: "#1A1A1A", // Floating header background
    },
    text: {
      primary: "#EDEDED", // Off-white for better readability on dark
      secondary: "#A1A1A1", // Muted grey
      tertiary: "#666666", // Darker grey
      inverse: "#0E0E0E", // Text on accent colors
    },
    accent: {
      lime: "#88D9E7", // LinkedIn Pilot cyan/blue
      limeHover: "#A0E5F0",
      white: "#FFFFFF",
    },
    border: {
      subtle: "rgba(255, 255, 255, 0.05)",
      default: "rgba(255, 255, 255, 0.1)",
      strong: "rgba(255, 255, 255, 0.2)",
    },
    status: {
      badge: "rgba(255, 255, 255, 0.1)",
    }
  },
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      serif: "'Playfair Display', 'Georgia', serif", // Elegant serif for headings
    },
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "24px",
      "2xl": "32px",
      "3xl": "48px",
      "4xl": "64px",
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
    }
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    full: "9999px",
  },
  shadow: {
    subtle: "0 4px 20px rgba(0, 0, 0, 0.2)",
    card: "0 10px 40px rgba(0, 0, 0, 0.3)",
    floating: "0 20px 60px rgba(0, 0, 0, 0.4)",
  }
};

export default designTokens;
