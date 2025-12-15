#!/usr/bin/env python3
import re

# Read the file
with open('TextOverlayModalKonva.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the brand-analysis API call with better error handling
old_code = """        // Try organization materials endpoint
        const response = await axios.get(`${BACKEND_URL}/api/organization-materials/brand-analysis`);
        if (response.data?.brand_colors || response.data?.brand_fonts) {
          setBrandColors(response.data.brand_colors || []);
          setBrandFonts(response.data.brand_fonts || []);
        }
      } catch (error) {
        // Fallback: use default colors from tokens
        console.log('[BRAND] Using default brand colors');
        setBrandColors([
          tokens.colors.accent.lime,
          tokens.colors.text.primary,
          tokens.colors.text.secondary,
        ]);
        setBrandFonts(['Poppins', 'Roboto', 'Open Sans']);
      }"""

new_code = """        // Try organization materials endpoint (if available)
        // Silently handle 405/404 errors as the endpoint may not exist
        try {
          const response = await axios.get(`${BACKEND_URL}/api/organization-materials/brand-analysis`, {
            timeout: 2000,
            validateStatus: (status) => status < 500 // Don't throw on 4xx errors
          });
          if (response.status === 200 && (response.data?.brand_colors || response.data?.brand_fonts)) {
            setBrandColors(response.data.brand_colors || []);
            setBrandFonts(response.data.brand_fonts || []);
            return; // Success, exit early
          }
        } catch (apiError) {
          // Silently ignore 405/404 errors - endpoint may not be implemented
          if (apiError.response?.status !== 405 && apiError.response?.status !== 404) {
            console.warn('[BRAND] Brand analysis API error:', apiError.message);
          }
        }
      } catch (error) {
        // Fallback: use default colors from tokens
        if (error.response?.status !== 405 && error.response?.status !== 404) {
          console.log('[BRAND] Using default brand colors');
        }
      }
      
      // Set default colors/fonts if not set above
      setBrandColors([
        tokens.colors.accent.lime,
        tokens.colors.text.primary,
        tokens.colors.text.secondary,
      ]);
      setBrandFonts(['Poppins', 'Roboto', 'Open Sans']);"""

content = content.replace(old_code, new_code)

# Write the file
with open('TextOverlayModalKonva.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully')





