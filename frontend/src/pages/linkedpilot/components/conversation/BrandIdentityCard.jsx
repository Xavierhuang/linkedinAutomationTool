import React, { useState } from 'react';
import { ExternalLink, Image as ImageIcon, Globe } from 'lucide-react';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BrandIdentityCard = ({ brand }) => {
  const tokens = useThemeTokens();
  const [imageErrors, setImageErrors] = useState({});
  const [screenshotError, setScreenshotError] = useState(false);

  if (!brand) {
    return null;
  }

  const colors = Array.isArray(brand.colorPalette) ? brand.colorPalette : [];
  const fonts = Array.isArray(brand.fontFamilies) ? brand.fontFamilies : [];
  const keywords = Array.isArray(brand.toneKeywords) ? brand.toneKeywords : [];
  const imagery = Array.isArray(brand.imagery) ? brand.imagery : [];
  const websiteUrl = brand.normalizedUrl || brand.websiteUrl;

  const handleImageError = (imageUrl) => {
    setImageErrors((prev) => ({ ...prev, [imageUrl]: true }));
  };

  // Generate screenshot URL using backend proxy to avoid CORS
  const getScreenshotUrl = (url) => {
    if (!url) return null;
    try {
      const encodedUrl = encodeURIComponent(url);
      // Use backend proxy endpoint to avoid CORS issues
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      return `${backendUrl}/api/brand/screenshot?url=${encodedUrl}`;
    } catch {
      return null;
    }
  };

  const screenshotUrl = getScreenshotUrl(websiteUrl);

  return (
    <div
      className="w-full rounded-3xl border backdrop-blur-2xl"
      style={{
        borderColor: tokens.colors.border.default,
        background: tokens.colors.background.layer1,
        boxShadow: tokens.shadow.md,
      }}
    >
      <div className="flex flex-col gap-6 p-6 lg:p-8">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.colors.text.tertiary }}>Brand Identity</p>
          <h3 className="text-xl font-semibold mt-2" style={{ color: tokens.colors.text.primary }}>
            {brand.title || 'Brand Overview'}
          </h3>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: tokens.colors.text.secondary }}>
            {brand.description || 'Brand identity summary pulled from website signals.'}
          </p>
        </div>

        {/* Main Grid Layout - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column */}
          <div className="flex flex-col gap-6">
            {/* Home Page Preview */}
            {websiteUrl ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.24em]" style={{ color: tokens.colors.text.tertiary }}>Home Page Preview</p>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: tokens.colors.text.secondary }}
                    onMouseEnter={(e) => e.target.style.color = tokens.colors.text.primary}
                    onMouseLeave={(e) => e.target.style.color = tokens.colors.text.secondary}
                  >
                    <Globe className="w-3 h-3" />
                    Visit Site
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="w-full h-64 rounded-2xl overflow-hidden border relative group cursor-pointer" style={{ borderColor: tokens.colors.border.default, backgroundColor: tokens.colors.background.layer2 }}>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full"
                  >
                    {screenshotError || !screenshotUrl ? (
                      <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: tokens.colors.text.secondary, backgroundColor: tokens.colors.background.layer2 }}>
                        <Globe className="w-12 h-12 mb-3 opacity-50" style={{ color: tokens.colors.text.tertiary }} />
                        <p className="text-xs mb-1 font-medium" style={{ color: tokens.colors.text.primary }}>
                          {(() => {
                            try {
                              return new URL(websiteUrl).hostname;
                            } catch {
                              return websiteUrl.replace(/^https?:\/\//, '').split('/')[0];
                            }
                          })()}
                        </p>
                        <p className="text-xs" style={{ color: tokens.colors.text.tertiary }}>Click to visit</p>
                      </div>
                    ) : (
                      <>
                        <img
                          src={screenshotUrl}
                          alt={`Preview of ${websiteUrl}`}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                          onError={(e) => {
                            console.error('Screenshot failed to load:', screenshotUrl, e);
                            setScreenshotError(true);
                          }}
                          onLoad={() => {
                            console.log('Screenshot loaded successfully:', screenshotUrl);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-xs font-medium truncate" style={{ color: tokens.colors.text.inverse }}>{websiteUrl}</p>
                        </div>
                      </>
                    )}
                  </a>
                </div>
              </div>
            ) : null}

            {/* Color Palette */}
            {colors.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>Colors</p>
                <div className="flex flex-row gap-3 flex-wrap">
                  {colors.map((color, index) => {
                    // Ensure color is valid hex
                    const validColor = color.startsWith('#') ? color : `#${color}`;
                    return (
                      <div
                        key={`${color}-${index}`}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-12 h-12 rounded-full border flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: validColor, borderColor: tokens.colors.border.default }}
                        />
                        <span className="text-[9px] font-medium text-center" style={{ color: tokens.colors.text.secondary }}>
                          {validColor.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs italic" style={{ color: tokens.colors.text.tertiary }}>No color palette detected</div>
            )}

            {/* Typography / Font Families */}
            {fonts.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>Typography</p>
                <div className="flex flex-wrap gap-2">
                  {fonts.map((font, index) => (
                    <span
                      key={`${font}-${index}`}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        background: tokens.colors.background.layer2,
                        border: `1px solid ${tokens.colors.border.default}`,
                        color: tokens.colors.text.primary,
                        fontFamily: font,
                      }}
                    >
                      {font}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs italic" style={{ color: tokens.colors.text.tertiary }}>No typography detected</div>
            )}

          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {/* Scraped Images */}
            {imagery.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>
                  Images ({imagery.length})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {imagery.map((imageUrl, index) => (
                    <div
                      key={`${imageUrl}-${index}`}
                      className="w-full aspect-square rounded-2xl overflow-hidden relative border"
                      style={{ borderColor: tokens.colors.border.default, backgroundColor: tokens.colors.background.layer2 }}
                    >
                      {imageErrors[imageUrl] ? (
                        <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: tokens.colors.text.tertiary }}>
                          <ImageIcon className="w-8 h-8 mb-2" style={{ color: tokens.colors.text.tertiary }} />
                          <span className="text-xs">Image unavailable</span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={imageUrl.startsWith('/api/brand/images/') 
                              ? `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}${imageUrl}`
                              : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/brand/proxy-image?image_url=${encodeURIComponent(imageUrl)}`}
                            alt={`Brand visual ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => handleImageError(imageUrl)}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs italic" style={{ color: tokens.colors.text.tertiary }}>No images scraped from website</div>
            )}

            {/* Tone Keywords */}
            {keywords.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>Tone Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        background: `${tokens.colors.accent.lime}1A`,
                        border: `1px solid ${tokens.colors.accent.lime}4D`,
                        color: tokens.colors.accent.lime,
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Content Excerpt */}
            {brand.contentExcerpt ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>Content Excerpt</p>
                <p className="text-sm leading-relaxed border rounded-2xl p-4" style={{ color: tokens.colors.text.secondary, borderColor: tokens.colors.border.default, backgroundColor: tokens.colors.background.layer2 }}>
                  {brand.contentExcerpt}
                </p>
              </div>
            ) : null}

            {/* Keyword Summary */}
            {brand.keywordSummary && Array.isArray(brand.keywordSummary) && brand.keywordSummary.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: tokens.colors.text.tertiary }}>Keyword Summary</p>
                <div className="flex flex-wrap gap-2">
                  {brand.keywordSummary.map((keyword, index) => (
                    <span
                      key={`${keyword}-${index}`}
                      className="px-2 py-1 rounded-lg text-xs font-medium border"
                      style={{ color: tokens.colors.text.secondary, backgroundColor: tokens.colors.background.layer2, borderColor: tokens.colors.border.default }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandIdentityCard;



