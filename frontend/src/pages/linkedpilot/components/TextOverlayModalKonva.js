import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer, Rect } from 'react-konva';
import { 
  X, Type, Sparkles, Loader, ZoomIn, ZoomOut, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, Layers, Trash2,
  Bold, Italic, Underline, Strikethrough
} from 'lucide-react';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Text component with transformer and inline editing support
const EditableText = ({ shapeProps, isSelected, isEditing, onSelect, onEdit, onChange, onTextChange, onBlur, isMultiSelected = false, onHover, stageRef, zoomLevel = 100, panPosition = { x: 0, y: 0 } }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const textareaRef = useRef();
  const tokens = useThemeTokens();

  // Dynamically measure and update text height to fit all content
  useEffect(() => {
    if (shapeRef.current && !isEditing) {
      const node = shapeRef.current;
      // Measure actual text height after rendering
      if (node.width() > 0) {
        try {
          // Get the actual rendered text height (accounts for wrapping, line height, padding)
          // Check if textHeight method exists (it's a Konva Text method)
          const actualTextHeight = typeof node.textHeight === 'function' ? node.textHeight() : (node.height() || 0);
          
          if (actualTextHeight > 0 && !isNaN(actualTextHeight)) {
            // Add padding for descenders and line spacing (20% extra)
            const paddedHeight = actualTextHeight * 1.2;
            
            // Always update height to ensure all text is visible
            // Use a small threshold to avoid infinite loops
            const currentHeight = node.height() || 0;
            if (Math.abs(paddedHeight - currentHeight) > 1) {
              // Update the node's height to fit all text
              node.height(paddedHeight);
              
              // Update parent state to persist the change
              if (onChange) {
                onChange({
                  ...shapeProps, // Preserve all existing properties
                  height: paddedHeight,
                  // Explicitly preserve all styling properties
                  fontSize: shapeProps.fontSize,
                  fontFamily: shapeProps.fontFamily,
                  fill: shapeProps.fill,
                  fontStyle: shapeProps.fontStyle,
                  textDecoration: shapeProps.textDecoration,
                  align: shapeProps.align,
                  lineHeight: shapeProps.lineHeight,
                  letterSpacing: shapeProps.letterSpacing,
                  opacity: shapeProps.opacity,
                  shadowEnabled: shapeProps.shadowEnabled,
                  shadowColor: shapeProps.shadowColor,
                  shadowBlur: shapeProps.shadowBlur,
                  shadowOffsetX: shapeProps.shadowOffsetX,
                  shadowOffsetY: shapeProps.shadowOffsetY,
                  background_color: shapeProps.background_color,
                  background_opacity: shapeProps.background_opacity,
                  width: shapeProps.width,
                  x: shapeProps.x,
                  y: shapeProps.y,
                  rotation: shapeProps.rotation,
                });
              }
              
              // Clear cache and re-cache with new dimensions
              if (node.cache) {
                try {
                  node.clearCache();
                  if (node.width() > 0 && paddedHeight > 0) {
                    node.cache();
                  }
                } catch (e) {
                  // Ignore cache errors
                }
              }
              
              // Batch draw to update display
              const layer = node.getLayer();
              if (layer) {
                layer.batchDraw();
              }
            }
          }
        } catch (e) {
          console.warn('[EditableText] Error measuring text height:', e);
        }
      }
    }
  }, [shapeProps.text, shapeProps.fontSize, shapeProps.width, shapeProps.fontFamily, shapeProps.lineHeight, isEditing]);

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      // Use batchDraw for performance - batches multiple draw operations
      const layer = trRef.current.getLayer();
      if (layer) {
        layer.batchDraw();
      }
    } else if (!isSelected && trRef.current) {
      // Clean up transformer when deselected
      trRef.current.nodes([]);
    }
  }, [isSelected, isEditing]);

  // Handle Enter key to edit (Adobe Express pattern)
  useEffect(() => {
    if (isSelected && !isEditing) {
      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (onEdit) {
            onEdit();
          }
        }
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isSelected, isEditing, onEdit]);

  // Position and style textarea for direct inline editing
  useEffect(() => {
    if (isEditing && shapeRef.current && textareaRef.current && stageRef?.current) {
      const textNode = shapeRef.current;
      const stage = stageRef.current;
      const stageBox = stage.container().getBoundingClientRect();
      const stageScale = stage.scaleX();
      
      // Get absolute position of text node relative to stage
      const absPos = textNode.getAbsolutePosition();
      
      // Account for pan position
      const panX = panPosition.x || 0;
      const panY = panPosition.y || 0;
      
      // Calculate position accounting for stage transform and pan
      const x = stageBox.left + (absPos.x + panX) * stageScale;
      const y = stageBox.top + (absPos.y + panY) * stageScale;
      
      // Set textarea position and size
      const textarea = textareaRef.current;
      textarea.style.position = 'fixed';
      textarea.style.left = `${x}px`;
      textarea.style.top = `${y}px`;
      textarea.style.width = `${textNode.width() * stageScale}px`;
      textarea.style.minHeight = `${Math.max(30, textNode.height() * stageScale)}px`;
      textarea.style.fontSize = `${(textNode.fontSize() || shapeProps.fontSize || 16) * stageScale}px`;
      textarea.style.fontFamily = textNode.fontFamily() || shapeProps.fontFamily || 'Arial';
      textarea.style.fontStyle = textNode.fontStyle() || shapeProps.fontStyle || 'normal';
      textarea.style.textDecoration = textNode.textDecoration() || shapeProps.textDecoration || 'none';
      textarea.style.color = textNode.fill() || shapeProps.fill || '#000000';
      textarea.style.textAlign = textNode.align() || shapeProps.align || 'left';
      textarea.style.lineHeight = (textNode.lineHeight() || shapeProps.lineHeight || 1.2).toString();
      textarea.style.letterSpacing = `${((textNode.letterSpacing() || shapeProps.letterSpacing || 0) * stageScale)}px`;
      textarea.style.opacity = textNode.opacity() !== undefined ? textNode.opacity() : (shapeProps.opacity !== undefined ? shapeProps.opacity : 1);
      textarea.style.background = shapeProps.background_color && shapeProps.background_color !== 'transparent' 
        ? shapeProps.background_color 
        : 'rgba(255, 255, 255, 0.9)';
      textarea.style.border = '2px solid ' + (tokens?.colors?.accent?.lime || '#00ff00');
      textarea.style.borderRadius = '4px';
      textarea.style.padding = '4px';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.overflow = 'auto';
      textarea.style.whiteSpace = 'pre-wrap';
      textarea.style.wordWrap = 'break-word';
      textarea.style.zIndex = '10000';
      textarea.style.boxSizing = 'border-box';
      textarea.style.display = 'block';
      textarea.style.transform = textNode.rotation() ? `rotate(${textNode.rotation()}deg)` : 'none';
      textarea.style.transformOrigin = 'top left';
      
      // Match text shadow if present
      if (textNode.shadowEnabled && textNode.shadowEnabled()) {
        const shadowOffsetX = (textNode.shadowOffsetX() || shapeProps.shadowOffsetX || 0) * stageScale;
        const shadowOffsetY = (textNode.shadowOffsetY() || shapeProps.shadowOffsetY || 0) * stageScale;
        const shadowBlur = (textNode.shadowBlur() || shapeProps.shadowBlur || 0) * stageScale;
        const shadowColor = textNode.shadowColor() || shapeProps.shadowColor || '#000000';
        textarea.style.textShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
      }
      
      // Focus and select all after a brief delay to ensure positioning is complete
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 10);
    }
    
    // Cleanup: hide textarea when not editing
    if (!isEditing && textareaRef.current) {
      textareaRef.current.style.display = 'none';
    }
  }, [isEditing, shapeProps, zoomLevel, panPosition, stageRef, tokens]);
  
  // Update textarea height dynamically as text changes
  useEffect(() => {
    if (isEditing && textareaRef.current && shapeRef.current) {
      const textarea = textareaRef.current;
      const textNode = shapeRef.current;
      const stage = stageRef?.current;
      
      if (stage) {
        const stageScale = stage.scaleX();
        // Reset height to auto to get natural height, then set it
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const minHeight = Math.max(30, (textNode.height() || 30) * stageScale);
        textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
      }
    }
  }, [isEditing, shapeProps.text, stageRef]);

  // Safety check for tokens
  if (!tokens) {
    return null;
  }

  return (
    <>
      {!isEditing && (
        <>
          {/* Text background - ALWAYS show for baked-in text to cover original */}
          {/* Background height syncs with text height via shapeProps.height */}
          {(shapeProps.is_baked_in && shapeProps.replace_baked_text) ? (
            // For baked-in text that should replace original, use opaque background
            <Rect
              x={shapeProps.x}
              y={shapeProps.y}
              width={shapeProps.width || 400}
              height={shapeProps.height || 100}
              fill={shapeProps.background_color && shapeProps.background_color !== 'transparent' 
                ? shapeProps.background_color 
                : 'rgba(255, 255, 255, 0.95)'} // Default white background to cover baked-in text
              opacity={1.0} // Fully opaque to hide baked-in text
              listening={false}
            />
          ) : shapeProps.background_color && shapeProps.background_color !== 'transparent' ? (
            // Regular background for non-baked-in text
            <Rect
              x={shapeProps.x}
              y={shapeProps.y}
              width={shapeProps.width || 400}
              height={shapeProps.height || 100}
              fill={shapeProps.background_color}
              opacity={(shapeProps.background_opacity || 100) / 100}
              listening={false}
            />
          ) : null}
          <KonvaText
            ref={shapeRef}
            {...shapeProps}
            draggable
            perfectDrawEnabled={true}
            hitStrokeWidth={10}
            onClick={(e) => {
              e.cancelBubble = true;
              const evt = e.evt || e;
              // Single click on already-selected text triggers editing (direct editing)
              if (isSelected && !isMultiSelected && onEdit && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey) {
                // Small delay to distinguish from drag start
                setTimeout(() => {
                  if (onEdit) {
                    onEdit();
                  }
                }, 150);
              }
              // Pass event for selection/multi-select detection
              if (onSelect) {
                onSelect(evt);
              }
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (onSelect) {
                onSelect(e.evt || e);
              }
            }}
            textDecoration={shapeProps.textDecoration || 'none'}
            fontStyle={shapeProps.fontStyle || 'normal'}
            shadowEnabled={shapeProps.glowEnabled || shapeProps.shadowEnabled}
            shadowColor={shapeProps.glowEnabled ? shapeProps.glowColor : (shapeProps.shadowColor || '#000000')}
            shadowBlur={shapeProps.glowEnabled ? shapeProps.glowBlur : (shapeProps.shadowBlur || 10)}
            shadowOffsetX={shapeProps.glowEnabled ? 0 : (shapeProps.shadowOffsetX || 0)}
            shadowOffsetY={shapeProps.glowEnabled ? 0 : (shapeProps.shadowOffsetY || 0)}
            shadowOpacity={shapeProps.glowEnabled ? 0.8 : 1}
            // Ensure text wraps properly and doesn't get cut off
            wrap="word"
            ellipsis={false}
            // Don't set height initially - let Konva calculate it based on text content
            // Height will be set dynamically in useEffect based on textHeight()
            height={shapeProps.height || undefined}
            onDblClick={(e) => {
              // Double-click to edit (backup method)
              e.cancelBubble = true;
              if (onEdit && !isMultiSelected) {
                onEdit();
              }
            }}
            onDragEnd={(e) => {
              const node = e.target;
              // Explicitly read ALL properties from the node to preserve styling
              onChange({
                ...shapeProps, // Base properties
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                // Explicitly preserve all styling properties from node
                fontSize: node.fontSize() || shapeProps.fontSize,
                fontFamily: node.fontFamily() || shapeProps.fontFamily,
                fill: node.fill() || shapeProps.fill,
                fontStyle: node.fontStyle() || shapeProps.fontStyle,
                textDecoration: node.textDecoration() || shapeProps.textDecoration,
                align: node.align() || shapeProps.align,
                lineHeight: node.lineHeight() || shapeProps.lineHeight,
                letterSpacing: node.letterSpacing() || shapeProps.letterSpacing,
                opacity: node.opacity() !== undefined ? node.opacity() : shapeProps.opacity,
                shadowEnabled: node.shadowEnabled() !== undefined ? node.shadowEnabled() : shapeProps.shadowEnabled,
                shadowColor: node.shadowColor() || shapeProps.shadowColor,
                shadowBlur: node.shadowBlur() || shapeProps.shadowBlur,
                shadowOffsetX: node.shadowOffsetX() || shapeProps.shadowOffsetX,
                shadowOffsetY: node.shadowOffsetY() || shapeProps.shadowOffsetY,
                width: node.width() || shapeProps.width,
                height: node.height() || shapeProps.height,
                background_color: shapeProps.background_color,
                background_opacity: shapeProps.background_opacity,
                text: node.text() || shapeProps.text,
              });
            }}
            onTransformEnd={(e) => {
              const node = shapeRef.current;
              if (!node) return;
              
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Reset scale to 1 and apply to dimensions
              node.scaleX(1);
              node.scaleY(1);
              
              // Calculate new dimensions - ensure minimum sizes to prevent cutoff
              const newWidth = Math.max(50, node.width() * scaleX);
              
              // For height: if resizing vertically, use the scaled height
              // If resizing horizontally, measure actual text height after width change
              let newHeight;
              if (Math.abs(scaleY - 1) > 0.01) {
                // User is resizing vertically - use the scaled height
                newHeight = Math.max(30, node.height() * scaleY);
                node.height(newHeight);
              } else {
                // User is resizing horizontally - measure text height after width change
                // Set the new width first so Konva can recalculate wrapping
                node.width(newWidth);
                
                // Get the actual text height after wrapping
                let actualTextHeight = typeof node.textHeight === 'function' ? node.textHeight() : node.height();
                if (actualTextHeight === 0 || isNaN(actualTextHeight)) {
                  // Fallback: use current height
                  actualTextHeight = node.height();
                }
                
                // Add padding for descenders and line spacing (20% extra)
                newHeight = Math.max(30, actualTextHeight * 1.2);
                
                // Update node height to fit text
                node.height(newHeight);
              }
              
              // IMPORTANT: Keep font size unchanged - resizing only changes available space
              // Font size should remain constant so text wraps/reflows within the new bounds
              
              onChange({
                ...shapeProps, // Preserve all existing properties
                x: node.x(),
                y: node.y(),
                width: newWidth,
                height: newHeight,
                // Explicitly preserve all styling properties
                fontSize: shapeProps.fontSize, // Keep original font size - don't scale it
                fontFamily: shapeProps.fontFamily,
                fill: shapeProps.fill,
                fontStyle: shapeProps.fontStyle,
                textDecoration: shapeProps.textDecoration,
                align: shapeProps.align,
                lineHeight: shapeProps.lineHeight,
                letterSpacing: shapeProps.letterSpacing,
                opacity: shapeProps.opacity,
                shadowEnabled: shapeProps.shadowEnabled,
                shadowColor: shapeProps.shadowColor,
                shadowBlur: shapeProps.shadowBlur,
                shadowOffsetX: shapeProps.shadowOffsetX,
                shadowOffsetY: shapeProps.shadowOffsetY,
                background_color: shapeProps.background_color,
                background_opacity: shapeProps.background_opacity,
                rotation: node.rotation(),
              });
              
              // Clear cache and re-cache after transform for updated rendering
              if (node.cache) {
                try {
                  node.clearCache();
                  if (newWidth > 0 && newHeight > 0) {
                    node.cache();
                  }
                } catch (e) {
                  // Ignore cache errors
                }
              }
              
              // Batch draw after transform for performance
              const layer = node.getLayer();
              if (layer) {
                layer.batchDraw();
              }
            }}
            onMouseEnter={(e) => {
              // Visual feedback: change cursor to text cursor
              const stage = e.target.getStage();
              if (stage) {
                stage.container().style.cursor = 'text';
              }
              // Notify parent of hover state
              if (onHover) {
                onHover(true);
              }
            }}
            onMouseLeave={(e) => {
              // Reset cursor
              const stage = e.target.getStage();
              if (stage) {
                stage.container().style.cursor = 'default';
              }
              // Notify parent of hover state
              if (onHover) {
                onHover(false);
              }
            }}
          />
        </>
      )}
      {isEditing && (
        <>
          {/* Hide text while editing - textarea will show instead */}
          <KonvaText
            ref={shapeRef}
            {...shapeProps}
            visible={false}
          />
          {/* HTML textarea for direct inline editing */}
          <textarea
            ref={textareaRef}
            value={shapeProps.text || ''}
            onChange={(e) => {
              if (onTextChange) {
                onTextChange(e.target.value);
              }
            }}
            onBlur={() => {
              if (onBlur) {
                onBlur();
              }
            }}
            onKeyDown={(e) => {
              // Escape to cancel
              if (e.key === 'Escape') {
                e.preventDefault();
                if (onBlur) {
                  onBlur();
                }
              }
              // Enter without Shift to finish (Shift+Enter for new line)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (onBlur) {
                  onBlur();
                }
              }
              e.stopPropagation();
            }}
            style={{
              position: 'fixed',
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          borderStroke={isMultiSelected ? 'rgba(0, 255, 0, 0.5)' : tokens.colors.accent.lime}
          borderStrokeWidth={isMultiSelected ? 1 : 2}
          anchorStroke={tokens.colors.accent.lime}
          anchorFill={tokens.colors.background.app}
          anchorSize={12}
          anchorCornerRadius={4}
          anchorStrokeWidth={2}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'middle-left', 'middle-right']}
          boundBoxFunc={(oldBox, newBox) => {
            // Prevent resizing below minimum size to avoid text cutoff
            // Minimum height should accommodate at least one line of text
            const minWidth = 50;
            const minHeight = shapeRef.current ? Math.max(40, (shapeRef.current.fontSize() || 20) * 1.5) : 40;
            
            if (Math.abs(newBox.width) < minWidth || Math.abs(newBox.height) < minHeight) {
              return oldBox;
            }
            return newBox;
          }}
          ignoreStroke={true}
          flipEnabled={false}
          keepRatio={false}
        />
      )}
    </>
  );
};

const TextOverlayModalKonva = ({ isOpen, onClose, imageUrl, onApply, initialElements = [], campaignData = null, standaloneMode = false }) => {
  const tokens = useThemeTokens();
  const [brandColors, setBrandColors] = useState([]); // Brand color palette
  const [brandFonts, setBrandFonts] = useState([]); // Brand fonts
  
  // Safety check - ensure tokens is always defined
  if (!tokens) {
    return null; // Or return a loading state
  }
  
  // Fetch brand profile (Google Pommeli pattern)
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchBrandProfile = async () => {
      try {
        // Try to get brand colors/fonts from campaignData or organization settings
        if (campaignData?.brand_colors || campaignData?.brand_fonts) {
          setBrandColors(campaignData.brand_colors || []);
          setBrandFonts(campaignData.brand_fonts || []);
          return;
        }
        
        // Try organization materials endpoint (if available)
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
      setBrandFonts(['Poppins', 'Roboto', 'Open Sans']);
    };
    
    fetchBrandProfile();
  }, [isOpen, campaignData]);
  const [textElements, setTextElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState(null);
  const [googleFonts, setGoogleFonts] = useState([]);
  const [loadingFonts, setLoadingFonts] = useState(false);
  const [loadingAiText, setLoadingAiText] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState(null); // Track which element is being edited
  const [clickToEditEnabled, setClickToEditEnabled] = useState(true); // User preference
  const [hoveredElementId, setHoveredElementId] = useState(null); // Track hovered element for visual feedback
  const [showDetectedRegions, setShowDetectedRegions] = useState(true); // Show detected text regions overlay
  const [selectedIds, setSelectedIds] = useState([]); // Multi-select support (array of IDs)

  const stageRef = useRef();
  const containerRef = useRef();
  const elementIdCounter = useRef(1);

  // Load image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      
      // Calculate stage size based on container
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const imageAspect = img.width / img.height;
        const containerAspect = containerWidth / containerHeight;

        let width, height;
        if (imageAspect > containerAspect) {
          width = Math.min(containerWidth * 0.9, img.width);
          height = width / imageAspect;
        } else {
          height = Math.min(containerHeight * 0.9, img.height);
          width = height * imageAspect;
        }

        setStageSize({ width, height });
      }
    };
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
      alert('Failed to load image. Please check the image URL.');
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Utility function to calculate IoU (Intersection over Union) for duplicate detection
  const calculateIoU = (bbox1, bbox2) => {
    if (!bbox1 || !bbox2 || !bbox1.bbox_percent || !bbox2.bbox_percent) return 0;
    
    const b1 = bbox1.bbox_percent;
    const b2 = bbox2.bbox_percent;
    
    // Calculate intersection
    const x1 = Math.max(b1.x_percent, b2.x_percent);
    const y1 = Math.max(b1.y_percent, b2.y_percent);
    const x2 = Math.min(b1.x_percent + b1.width_percent, b2.x_percent + b2.width_percent);
    const y2 = Math.min(b1.y_percent + b1.height_percent, b2.y_percent + b2.height_percent);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = b1.width_percent * b1.height_percent;
    const area2 = b2.width_percent * b2.height_percent;
    const union = area1 + area2 - intersection;
    
    return union > 0 ? intersection / union : 0;
  };

  // Merge text regions to prevent duplicates
  const mergeTextRegions = (existing, detected, threshold = 0.3) => {
    const merged = [...existing];
    
    detected.forEach(detectedEl => {
      let mergedWithExisting = false;
      
      // Check if detected element overlaps significantly with any existing element
      for (let i = 0; i < merged.length; i++) {
        const existingEl = merged[i];
        const iou = calculateIoU(existingEl, detectedEl);
        
        if (iou > threshold) {
          // Update existing element with detected data (prefer detected text/content)
          merged[i] = {
            ...existingEl,
            text: detectedEl.text || existingEl.text, // Prefer detected text
            bbox: detectedEl.bbox || existingEl.bbox,
            bbox_percent: detectedEl.bbox_percent || existingEl.bbox_percent,
            confidence: Math.max(detectedEl.confidence || 0, existingEl.confidence || 0),
            // Keep existing styling but update position/size if detected is more accurate
            position: detectedEl.position || existingEl.position,
            width: detectedEl.width || existingEl.width,
            height: detectedEl.height || existingEl.height,
          };
          mergedWithExisting = true;
          console.log(`[MERGE] Merged detected text "${detectedEl.text?.substring(0, 30)}" with existing element (IoU: ${iou.toFixed(2)})`);
          break;
        }
      }
      
      // If no significant overlap, add as new element
      if (!mergedWithExisting) {
        merged.push(detectedEl);
        console.log(`[NEW] Added new text element: "${detectedEl.text?.substring(0, 30)}"`);
      }
    });
    
    return merged;
  };

  // Initialize elements from props
  useEffect(() => {
    if (!isOpen) return;
    
    // Ensure initialElements is an array
    const safeElements = Array.isArray(initialElements) ? initialElements : [];
    
    // Debug logging
    console.log('[TextOverlayModalKonva] Initialization:', {
      isOpen,
      elementsCount: safeElements.length,
      stageSize: { width: stageSize.width, height: stageSize.height },
      image: image ? { width: image.width, height: image.height } : null,
      elements: safeElements.length > 0 ? safeElements.map(el => ({
        text: el.text?.substring(0, 30),
        is_baked_in: el.is_baked_in,
        fontSize: el.fontSize || el.font_size,
        hasBbox: !!el.bbox_percent,
        hasBboxPixels: !!el.bbox,
        position: el.position,
        width: el.width,
        height: el.height
      })) : []
    });
    
    if (safeElements.length > 0 && stageSize.width > 0 && image) {
      console.log('[TextOverlayModalKonva] Conditions met - will convert elements');
      // Check if elements are already in Konva format (have fontSize, fontFamily, etc.)
      const isKonvaFormat = (el) => {
        return el.hasOwnProperty('fontSize') || el.hasOwnProperty('fontFamily') || el.hasOwnProperty('fill');
      };
      
      // Helper function to convert overlay element to Konva format
      const convertToKonvaElement = (el) => {
        // If already in Konva format, just ensure it has an ID and adjust coordinates if needed
        if (isKonvaFormat(el)) {
          // Calculate scale factor
          const scaleX = stageSize.width / image.width;
          const scaleY = stageSize.height / image.height;
          
          // For baked-in text, recalculate font size from bbox if available
          let fontSize = el.fontSize;
          if (el.is_baked_in && (el.replace_baked_text !== false) && (el.bbox || el.bbox_percent)) {
            const bboxHeight = el.bbox?.height || (el.bbox_percent ? (image.height * el.bbox_percent.height_percent / 100) : el.height);
            const lineCount = (el.text || '').split('\n').length || 1;
            const lineHeight = el.lineHeight || 1.2;
            const calculatedFontSize = bboxHeight / (lineHeight * lineCount);
            fontSize = calculatedFontSize * scaleY; // Scale to stage
            fontSize = Math.max(12, fontSize);
          } else if (el.fontSize) {
            // Scale existing font size
            fontSize = el.fontSize * scaleY;
          } else {
            fontSize = 72 * scaleY;
          }
          
          // Elements are already in Konva format - just ensure they have IDs and proper scaling
          return {
            ...el,
            id: el.id || `text-${elementIdCounter.current++}`,
            // Ensure x, y, width, height are set (they should already be in pixels)
            x: el.x !== undefined ? el.x : (el.position ? (stageSize.width * el.position[0] / 100) : 50),
            y: el.y !== undefined ? el.y : (el.position ? (stageSize.height * el.position[1] / 100) : 50),
            width: el.width || 400,
            height: el.height || 100,
            // Ensure all Konva properties are present
            fontSize: fontSize,
            fontFamily: el.fontFamily || 'Poppins',
            fontStyle: el.fontStyle || 'normal',
            fill: el.fill || '#000000',
            align: el.align || 'left',
            rotation: el.rotation || 0,
            strokeWidth: el.strokeWidth || 0,
            stroke: el.stroke || '#000000',
            shadowEnabled: el.shadowEnabled !== undefined ? el.shadowEnabled : true,
            shadowColor: el.shadowColor || '#000000',
            shadowBlur: el.shadowBlur || 10,
            shadowOffsetX: el.shadowOffsetX || 0,
            shadowOffsetY: el.shadowOffsetY || 0,
            opacity: el.opacity !== undefined ? el.opacity : 1,
            letterSpacing: el.letterSpacing || 0,
            lineHeight: el.lineHeight || 1.2,
            textDecoration: el.textDecoration || 'none',
            background_color: el.background_color || 'transparent',
            background_opacity: el.background_opacity || 0,
            glowEnabled: el.glowEnabled || false,
            glowColor: el.glowColor || '#FFFFFF',
            glowBlur: el.glowBlur || 10,
            ai_generated: el.ai_generated || false,
            bbox: el.bbox,
            bbox_percent: el.bbox_percent,
            confidence: el.confidence,
            is_baked_in: el.is_baked_in !== undefined ? el.is_baked_in : true,
            replace_baked_text: el.replace_baked_text !== undefined ? el.replace_baked_text : false,
          };
        }
        
        // Convert from overlay format to Konva format
        // Prefer bounding box percentages if available (new format)
        let xPos, yPos, width, height;
        
        // Calculate scale factor between actual image and displayed stage size
        const scaleX = stageSize.width / image.width;
        const scaleY = stageSize.height / image.height;
        
        if (el.bbox_percent) {
          // New format with bounding boxes - use percentages relative to ACTUAL image dimensions
          const xPercent = el.bbox_percent.x_percent || el.position?.[0] || 50;
          const yPercent = el.bbox_percent.y_percent || el.position?.[1] || 50;
          const widthPercent = el.bbox_percent.width_percent || 50;
          const heightPercent = el.bbox_percent.height_percent || 10;
          
          // Convert percentages to pixels based on ACTUAL image dimensions
          const xPixels = (image.width * xPercent) / 100;
          const yPixels = (image.height * yPercent) / 100;
          const widthPixels = el.width || (image.width * widthPercent) / 100;
          let heightPixels = el.height || (image.height * heightPercent) / 100;
          
          // Add padding to height to prevent text cutoff (account for descenders and line spacing)
          // Add 20% padding for descenders and better visibility
          if (heightPixels > 0) {
            heightPixels = heightPixels * 1.2; // Add 20% padding
          }
          
          // Scale to stage size
          xPos = xPixels * scaleX;
          yPos = yPixels * scaleY;
          width = widthPixels * scaleX;
          height = heightPixels * scaleY;
        } else if (el.bbox && el.bbox.x !== undefined) {
          // Use pixel bbox directly if available
          xPos = el.bbox.x * scaleX;
          yPos = el.bbox.y * scaleY;
          width = (el.bbox.width || el.width || 400) * scaleX;
          let bboxHeight = el.bbox.height || el.height || 100;
          // Add padding to prevent text cutoff
          bboxHeight = bboxHeight * 1.2; // Add 20% padding
          height = bboxHeight * scaleY;
        } else if (el.position) {
          // Legacy format with center position
          xPos = el.position[0] || 50;
          yPos = el.position[1] || 50;
          
          // If values are > 100, they're likely pixels - convert to percentage then scale
          if (xPos > 100 || yPos > 100) {
            const xPercent = (xPos / image.width) * 100;
            const yPercent = (yPos / image.height) * 100;
            xPos = (image.width * xPercent / 100) * scaleX;
            yPos = (image.height * yPercent / 100) * scaleY;
          } else {
            // Percentage format
            xPos = (image.width * xPos / 100) * scaleX;
            yPos = (image.height * yPos / 100) * scaleY;
          }
          
          width = (el.width || 400) * scaleX;
          height = (el.height || 100) * scaleY;
        } else {
          // Fallback
          xPos = (image.width * 0.5) * scaleX;
          yPos = (image.height * 0.5) * scaleY;
          width = 400 * scaleX;
          height = 100 * scaleY;
        }
        
        // Calculate font size - use bounding box height or extracted font size
        // For baked-in text, font size should match the visual size in the image
        let fontSize;
        try {
          if (el.is_baked_in && (el.replace_baked_text !== false)) {
            // For baked-in text, use bounding box height as font size reference
            const lineCount = (el.text || '').split('\n').length || 1;
            const lineHeight = el.line_height || el.lineHeight || 1.2;
            
            // Get bbox height - try multiple sources
            let bboxHeight = null;
            if (el.bbox && el.bbox.height) {
              bboxHeight = el.bbox.height;
            } else if (el.bbox_percent && el.bbox_percent.height_percent) {
              bboxHeight = (image.height * el.bbox_percent.height_percent) / 100;
            } else if (el.height) {
              bboxHeight = el.height / scaleY; // Convert from stage pixels to image pixels
            } else if (height > 0) {
              bboxHeight = height / scaleY; // Convert from stage pixels to image pixels
            }
            
            // Use extracted font_size if available and reasonable
            if (el.font_size && el.font_size > 10 && el.font_size < 200) {
              fontSize = el.font_size * scaleY;
              console.log(`[FONT SIZE] Using extracted font_size: ${el.font_size}px -> ${fontSize}px (scale: ${scaleY})`);
            } else if (bboxHeight && bboxHeight > 0) {
              // Calculate from bbox height
              const calculatedFontSize = bboxHeight / (lineHeight * lineCount);
              fontSize = calculatedFontSize * scaleY;
              console.log(`[FONT SIZE] Calculated from bbox: ${bboxHeight}px / (${lineHeight} * ${lineCount}) = ${calculatedFontSize}px -> ${fontSize}px`);
            } else {
              // Fallback: use height directly if available
              fontSize = (height / scaleY) * scaleY; // This equals height, but ensures we have a value
              if (fontSize < 12) {
                fontSize = 72 * scaleY; // Final fallback
              }
              console.log(`[FONT SIZE] Using fallback: ${fontSize}px`);
            }
          } else {
            // For non-baked-in text, use extracted font size or default
            fontSize = (el.font_size || 72) * scaleY;
            console.log(`[FONT SIZE] Non-baked-in: ${el.font_size || 72}px -> ${fontSize}px`);
          }
          
          // Ensure minimum font size and valid number
          if (!fontSize || isNaN(fontSize) || fontSize <= 0) {
            fontSize = 72 * scaleY;
            console.warn(`[FONT SIZE] Invalid fontSize, using default: ${fontSize}px`);
          }
          fontSize = Math.max(12, fontSize);
        } catch (error) {
          console.error('[FONT SIZE] Error calculating font size:', error, el);
          fontSize = 72 * scaleY;
        }
        
        return {
          id: el.id || `text-${elementIdCounter.current++}`,
          text: el.text || 'Sample Text',
          x: xPos, // Already scaled to stage coordinates
          y: yPos, // Already scaled to stage coordinates
          fontSize: fontSize, // Font size scaled to match image appearance
          fontFamily: el.font_name || el.fontFamily || 'Poppins', // Use extracted font name
          fontStyle: `${el.font_style || 'normal'} ${el.font_weight || 400}`,
          fill: el.color || '#000000',
          align: el.text_align || 'left',
          width: width,
          height: height,
          // Add padding to height to prevent text cutoff (descenders, line spacing)
          padding: Math.max(4, fontSize * 0.1), // 10% of font size as padding
          rotation: el.rotation || 0,
          strokeWidth: el.stroke_width || 0,
          stroke: el.stroke_color || '#000000',
          shadowEnabled: el.shadow_enabled !== undefined ? el.shadow_enabled : true,
          shadowColor: el.shadow_color || '#000000',
          shadowBlur: el.shadow_blur || 10,
          shadowOffsetX: el.shadow_offset_x || 0,
          shadowOffsetY: el.shadow_offset_y || 0,
          opacity: (el.opacity || 100) / 100,
          letterSpacing: el.letter_spacing || 0,
          lineHeight: el.line_height || 1.2,
          textDecoration: el.text_decoration || 'none',
          background_color: el.background_color || 'transparent',
          background_opacity: el.background_opacity || 0,
          glowEnabled: el.glow_enabled || false,
          glowColor: el.glow_color || '#FFFFFF',
          glowBlur: el.glow_blur || 10,
          ai_generated: el.ai_generated || false,
          // Store bounding box data for duplicate detection
          bbox: el.bbox,
          bbox_percent: el.bbox_percent,
          confidence: el.confidence,
          is_baked_in: el.is_baked_in !== undefined ? el.is_baked_in : true,
        };
      };
      
      // If we have existing elements, merge to prevent duplicates
      let elementsToConvert = safeElements;
      if (textElements.length > 0) {
        const existingAsOverlays = textElements.map(el => ({
          text: el.text,
          position: [(el.x / stageSize.width) * 100, (el.y / stageSize.height) * 100],
          bbox_percent: el.bbox_percent || {
            x_percent: (el.x / stageSize.width) * 100,
            y_percent: (el.y / stageSize.height) * 100,
            width_percent: (el.width / stageSize.width) * 100,
            height_percent: (el.height / stageSize.height) * 100,
          },
          width: el.width,
          height: el.height,
          confidence: el.confidence,
          is_baked_in: el.is_baked_in,
          font_size: el.fontSize,
          font_name: el.fontFamily,
          font_weight: parseInt(el.fontStyle.split(' ')[1]) || 400,
          font_style: el.fontStyle.split(' ')[0] || 'normal',
          color: el.fill,
          text_align: el.align,
          stroke_width: el.strokeWidth,
          stroke_color: el.stroke,
          shadow_enabled: el.shadowEnabled,
          shadow_color: el.shadowColor,
          shadow_blur: el.shadowBlur,
          shadow_offset_x: el.shadowOffsetX,
          shadow_offset_y: el.shadowOffsetY,
          opacity: el.opacity * 100,
          letter_spacing: el.letterSpacing,
          line_height: el.lineHeight,
        }));
        elementsToConvert = mergeTextRegions(existingAsOverlays, safeElements);
      }
      
      console.log(`[CONVERT] Starting conversion of ${elementsToConvert.length} elements`);
      console.log(`[CONVERT] Image dimensions: ${image.width}x${image.height}`);
      console.log(`[CONVERT] Stage dimensions: ${stageSize.width}x${stageSize.height}`);
      
      const convertedElements = elementsToConvert.map((el, idx) => {
        try {
          console.log(`[CONVERT] Converting element ${idx}:`, {
            text: el.text?.substring(0, 30),
            hasBboxPercent: !!el.bbox_percent,
            hasBbox: !!el.bbox,
            hasPosition: !!el.position,
            font_size: el.font_size,
            is_baked_in: el.is_baked_in
          });
          
          const converted = convertToKonvaElement(el);
          
          console.log(`[CONVERT] Element ${idx} converted:`, {
            text: converted.text?.substring(0, 30),
            x: converted.x,
            y: converted.y,
            fontSize: converted.fontSize,
            width: converted.width,
            height: converted.height,
            is_baked_in: converted.is_baked_in,
            fill: converted.fill
          });
          
          // Validate converted element
          if (!converted.text || converted.fontSize <= 0 || converted.width <= 0 || converted.height <= 0) {
            console.warn(`[CONVERT] Element ${idx} has invalid properties:`, converted);
            return null;
          }
          
          return converted;
        } catch (error) {
          console.error(`[CONVERT] Error converting element ${idx}:`, error, el);
          return null;
        }
      }).filter(el => el !== null && el !== undefined); // Remove any failed conversions
      
      console.log(`[CONVERT] Conversion complete: ${convertedElements.length} elements from ${elementsToConvert.length} input elements`);
      
      if (convertedElements.length > 0) {
        setTextElements(convertedElements);
        setSelectedId(convertedElements[0].id);
        setHistory([convertedElements]);
        setHistoryIndex(0);
        console.log(`[CONVERT] Set ${convertedElements.length} text elements`);
      } else {
        console.warn(`[CONVERT] No valid elements after conversion!`);
        setTextElements([]);
        setHistory([[]]);
        setHistoryIndex(0);
      }
    } else if (isOpen && safeElements.length === 0) {
      console.log('[TextOverlayModalKonva] No elements to load - clearing');
      setTextElements([]);
      setHistory([[]]);
      setHistoryIndex(0);
    } else if (isOpen) {
      console.log('[TextOverlayModalKonva] Waiting for conditions:', {
        hasElements: safeElements.length > 0,
        hasStageSize: stageSize.width > 0,
        hasImage: !!image
      });
    }
  }, [isOpen, initialElements, stageSize, image]);

  // Fetch Google Fonts
  const fetchGoogleFonts = async () => {
    if (loadingFonts || googleFonts.length > 0) return;
    setLoadingFonts(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/drafts/google-fonts`);
      setGoogleFonts(response.data.fonts || []);
    } catch (error) {
      console.error('Error fetching Google Fonts:', error);
      setGoogleFonts([
        { family: 'Poppins', display: 'Poppins' },
        { family: 'Roboto', display: 'Roboto' },
        { family: 'Open Sans', display: 'Open Sans' }
      ]);
    }
    setLoadingFonts(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchGoogleFonts();
    }
  }, [isOpen]);

  // Load Google Fonts dynamically
  useEffect(() => {
    if (textElements.length > 0) {
      textElements.forEach((element) => {
        const fontFamily = element.fontFamily;
        if (fontFamily && fontFamily !== 'Arial' && fontFamily !== 'sans-serif') {
          const linkId = `google-font-${fontFamily.replace(/\s+/g, '-')}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700;800;900&display=swap`;
            document.head.appendChild(link);
          }
        }
      });
    }
  }, [textElements]);

  // History management
  const addToHistory = useCallback((elements) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(elements)));
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setTextElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setTextElements(JSON.parse(JSON.stringify(history[newIndex])));
    }
  };

  // Add text element (with brand-aware defaults)
  const handleAddText = () => {
    // Use brand colors/fonts if available (Google Pommeli pattern)
    const defaultColor = brandColors.length > 0 ? brandColors[0] : '#000000';
    const defaultFont = brandFonts.length > 0 ? brandFonts[0] : 'Poppins';
    
    const newElement = {
      id: `text-${elementIdCounter.current++}`,
      text: 'New Text',
      x: stageSize.width / 2 - 100,
      y: stageSize.height / 2 - 36,
      fontSize: 72,
      fontFamily: defaultFont,
      fontStyle: 'normal 400',
      fill: defaultColor,
      align: 'left',
      width: 400,
      height: 100,
      rotation: 0,
      strokeWidth: 0,
      stroke: '#000000',
      shadowEnabled: false,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 1,
      letterSpacing: 0,
      lineHeight: 1.2,
      textDecoration: 'none',
      background_color: 'transparent',
      background_opacity: 0,
      glowEnabled: false,
      glowColor: '#FFFFFF',
      glowBlur: 10,
      ai_generated: false,
      is_baked_in: false,
    };
    const newElements = [...textElements, newElement];
    setTextElements(newElements);
    setSelectedId(newElement.id);
    addToHistory(newElements);
  };

  // Generate AI design
  const handleAiDesign = async () => {
    // Use default content if campaign data is not available
    const content = campaignData?.content || 'Create engaging content';
    const cta = campaignData?.cta || 'Learn More';
    const brand = campaignData?.brand || '';

    setLoadingAiText(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/drafts/generate-ai-overlay`, {
        image_url: imageUrl,
        post_content: content,
        call_to_action: cta,
        brand_info: brand
      });

      if (response.data && response.data.elements) {
        const convertedElements = response.data.elements.map((element, idx) => {
          // Ensure position is valid - default to left-side if missing
          const position = element.position || [15, idx === 0 ? 22 : 47];
          const xPercent = Math.max(10, Math.min(20, position[0] || 15)); // Force left-side: 10-20%
          const yPercent = idx === 0 
            ? Math.max(15, Math.min(30, position[1] || 22))  // Headline: 15-30%
            : Math.max(40, Math.min(55, position[1] || 47)); // Subtext: 40-55%
          
          // Calculate width relative to image size if not provided
          let width = element.width || 400;
          const widthPercent = (width / stageSize.width) * 100;
          if (widthPercent > 70) {
            // If width is more than 70% of image, recalculate to 65%
            width = stageSize.width * 0.65;
          } else if (widthPercent < 50) {
            // If width is less than 50%, set to 60%
            width = stageSize.width * 0.60;
          }
          
          return {
          id: `text-${elementIdCounter.current++}`,
          text: element.text || 'AI Text',
          x: stageSize.width * xPercent / 100,
          y: stageSize.height * yPercent / 100,
          fontSize: element.font_size || 72,
          fontFamily: element.font_name || 'Poppins',
          fontStyle: `${element.font_style || 'normal'} ${element.font_weight || 400}`,
          fill: element.color || '#000000',
          align: element.text_align || 'left',
          width: width,
          rotation: element.rotation || 0,
          strokeWidth: element.stroke_width || 0,
          stroke: element.stroke_color || '#000000',
          shadowEnabled: element.shadow_enabled || false,
          shadowColor: element.shadow_color || '#000000',
          shadowBlur: element.shadow_blur || 10,
          shadowOffsetX: element.shadow_offset_x || 0,
          shadowOffsetY: element.shadow_offset_y || 0,
          opacity: (element.opacity || 100) / 100,
          letterSpacing: element.letter_spacing || 0,
          lineHeight: element.line_height || 1.2,
          ai_generated: true,
        };
        });
        
        const newElements = [...textElements, ...convertedElements];
        setTextElements(newElements);
        if (convertedElements.length > 0) {
          setSelectedId(convertedElements[0].id);
        }
        addToHistory(newElements);
      }
    } catch (error) {
      console.error('Error generating AI overlay:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (error.message?.includes('CORS') || error.message?.includes('Network Error')) {
        alert('CORS Error: Please hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R) to clear the cache. The server is configured correctly.');
      } else {
        alert('Failed to generate AI overlay: ' + errorMessage);
      }
    } finally {
      setLoadingAiText(false);
    }
  };

  // Update selected element
  const updateSelectedElement = (updates) => {
    setTextElements((prev) => {
      const updated = prev.map((el) => {
        if (el.id === selectedId) {
          const merged = { ...el, ...updates };
          // Ensure fontStyle is properly formatted
          if (updates.fontStyle || updates.font_weight || updates.font_style) {
            const fontStyle = merged.font_style || merged.fontStyle?.split(' ')[0] || 'normal';
            const fontWeight = merged.font_weight || parseInt(merged.fontStyle?.split(' ')[1]) || 400;
            merged.fontStyle = `${fontStyle} ${fontWeight}`;
          }
          // Ensure textDecoration is set
          if (updates.text_decoration !== undefined) {
            merged.textDecoration = updates.text_decoration;
          }
          return merged;
        }
        return el;
      });
      addToHistory(updated);
      return updated;
    });
  };

  // Delete selected element
  const handleDeleteElement = () => {
    if (!selectedId) return;
    const newElements = textElements.filter((el) => el.id !== selectedId);
    setTextElements(newElements);
    setSelectedId(newElements.length > 0 ? newElements[0].id : null);
    addToHistory(newElements);
  };

  // Export canvas with format options
  const handleExport = (format = 'png', quality = 0.92) => {
    if (!stageRef.current) return;
    
    let dataURL;
    
    switch (format) {
      case 'jpeg':
      case 'jpg':
        dataURL = stageRef.current.toDataURL({ 
          pixelRatio: 2,
          mimeType: 'image/jpeg',
          quality: quality
        });
        break;
      case 'png':
      default:
        dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
        break;
    }
    
    // Convert canvas elements back to format expected by parent
    const exportElements = textElements.map((el) => ({
      text: el.text,
      position: [(el.x / stageSize.width) * 100, (el.y / stageSize.height) * 100],
      font_size: Math.round(el.fontSize),
      font_name: el.fontFamily,
      font_weight: parseInt(el.fontStyle?.split(' ')[1]) || 400,
      font_style: el.fontStyle?.split(' ')[0] || 'normal',
      color: el.fill,
      text_align: el.align,
      text_decoration: el.textDecoration || 'none',
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      stroke_width: el.strokeWidth,
      stroke_color: el.stroke,
      shadow_enabled: el.shadowEnabled,
      shadow_color: el.shadowColor,
      shadow_blur: el.shadowBlur,
      shadow_offset_x: el.shadowOffsetX,
      shadow_offset_y: el.shadowOffsetY,
      opacity: Math.round(el.opacity * 100),
      letter_spacing: el.letterSpacing,
      line_height: el.lineHeight,
      background_color: el.background_color || 'transparent',
      background_opacity: el.background_opacity || 0,
      glow_enabled: el.glowEnabled || false,
      glow_color: el.glowColor || '#FFFFFF',
      glow_blur: el.glowBlur || 10,
      ai_generated: el.ai_generated,
      bbox: el.bbox,
      bbox_percent: el.bbox_percent,
      confidence: el.confidence,
      is_baked_in: el.is_baked_in,
    }));

    if (onApply) {
      onApply(exportElements, dataURL);
    }
    if (!standaloneMode) {
      onClose();
    }
  };

  const selectedElement = textElements.find((el) => el.id === selectedId);
  const editingElement = textElements.find((el) => el.id === editingId);

  // Handle click outside to save (when editing)
  useEffect(() => {
    if (!isOpen || !editingId) return;

    const handleClickOutside = (e) => {
      // Check if click is outside the input editor
      const inputElement = document.querySelector('textarea[style*="position: absolute"]');
      if (inputElement && !inputElement.contains(e.target)) {
        setEditingId(null); // Save and exit edit mode
      }
    };

    // Use setTimeout to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, editingId]);

  // Keyboard shortcuts for text formatting (Step 9)
  useEffect(() => {
    if (!isOpen || !selectedElement || editingId) return;

    const handleKeyDown = (e) => {
      // Only handle shortcuts when not editing text inline
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      // Ctrl+B: Bold
      if (e.ctrlKey && e.key === 'b' && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const currentWeight = parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400;
        const newWeight = currentWeight === 700 ? 400 : 700;
        const fontStyle = selectedElement.fontStyle?.split(' ')[0] || 'normal';
        updateSelectedElement({ 
          fontStyle: `${fontStyle} ${newWeight}`,
          font_weight: newWeight
        });
      }
      // Ctrl+I: Italic
      else if (e.ctrlKey && e.key === 'i' && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const fontStyle = selectedElement.fontStyle?.split(' ')[0] || 'normal';
        const fontWeight = parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400;
        const newStyle = fontStyle === 'italic' ? 'normal' : 'italic';
        updateSelectedElement({ 
          fontStyle: `${newStyle} ${fontWeight}`,
          font_style: newStyle
        });
      }
      // Ctrl+U: Underline
      else if (e.ctrlKey && e.key === 'u' && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const currentDecoration = selectedElement.text_decoration || 'none';
        const newDecoration = currentDecoration === 'underline' ? 'none' : 'underline';
        updateSelectedElement({ text_decoration: newDecoration });
      }
      // Ctrl+Shift+X: Strikethrough
      else if (e.ctrlKey && e.shiftKey && e.key === 'X' && !e.metaKey) {
        e.preventDefault();
        const currentDecoration = selectedElement.text_decoration || 'none';
        const newDecoration = currentDecoration === 'line-through' ? 'none' : 'line-through';
        updateSelectedElement({ text_decoration: newDecoration });
      }
      // Delete/Backspace: Delete selected element
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !editingId) {
        e.preventDefault();
        handleDeleteElement();
      }
      // Ctrl+D: Duplicate
      else if (e.ctrlKey && e.key === 'd' && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const newElement = {
          ...selectedElement,
          id: `text-${elementIdCounter.current++}`,
          x: selectedElement.x + 20,
          y: selectedElement.y + 20,
        };
        const newElements = [...textElements, newElement];
        setTextElements(newElements);
        setSelectedId(newElement.id);
        addToHistory(newElements);
      }
      // Ctrl+A: Select all
      else if (e.ctrlKey && e.key === 'a' && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const allIds = textElements.map(el => el.id);
        setSelectedIds(allIds);
        if (allIds.length > 0) {
          setSelectedId(allIds[0]);
        }
      }
      // Arrow keys for fine positioning
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !editingId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const delta = {
          'ArrowUp': { y: -step },
          'ArrowDown': { y: step },
          'ArrowLeft': { x: -step },
          'ArrowRight': { x: step }
        }[e.key];
        
        // Apply to all selected elements if multi-select
        if (selectedIds.length > 1) {
          setTextElements((prev) => {
            const updated = prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, x: el.x + delta.x, y: el.y + delta.y } : el
            );
            addToHistory(updated);
            return updated;
          });
        } else if (selectedElement) {
          updateSelectedElement(delta);
        }
      }
      // Escape: Deselect
      else if (e.key === 'Escape' && !editingId) {
        e.preventDefault();
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedElement, editingId, textElements]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1400px',
          height: '90vh',
          backgroundColor: tokens.colors.background.layer2,
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadow.floating,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div
          style={{
            height: '64px',
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: tokens.colors.background.layer1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2
              style={{
                color: tokens.colors.text.primary,
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic',
              }}
            >
              Edit Image
            </h2>
            <div style={{ width: '1px', height: '24px', backgroundColor: tokens.colors.border.default }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                style={{
                  padding: '8px 12px',
                  borderRadius: tokens.radius.md,
                  color: historyIndex <= 0 ? tokens.colors.text.tertiary : tokens.colors.text.secondary,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Undo2 size={16} />
                <span>Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{
                  padding: '8px 12px',
                  borderRadius: tokens.radius.md,
                  color: historyIndex >= history.length - 1 ? tokens.colors.text.tertiary : tokens.colors.text.secondary,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Redo2 size={16} />
                <span>Redo</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                border: `1px solid ${tokens.colors.border.default}`,
                color: tokens.colors.text.secondary,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                onChange={(e) => {
                  const format = e.target.value;
                  handleExport(format, format === 'jpeg' ? 0.92 : 1.0);
                }}
                defaultValue="png"
                style={{
                  padding: '8px 12px',
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.background.input,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
              <button
                onClick={() => handleExport('png')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  backgroundColor: tokens.colors.accent.lime,
                  border: 'none',
                  color: '#000000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Canvas Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.colors.background.app,
              position: 'relative',
              overflow: 'hidden',
            }}
            ref={containerRef}
          >
            {image ? (
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={zoomLevel / 100}
                scaleY={zoomLevel / 100}
                style={{
                  boxShadow: tokens.shadow.card,
                  borderRadius: tokens.radius.md,
                }}
              >
                <Layer>
                  <KonvaImage 
                    image={image} 
                    width={stageSize.width} 
                    height={stageSize.height}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                  
                  {/* Text Masking: Hide original baked-in text when editing overlay is active */}
                  {editingId && textElements.find(el => el.id === editingId)?.is_baked_in && (() => {
                    const editingEl = textElements.find(el => el.id === editingId);
                    // Create mask to cover original text region
                    return (
                      <Rect
                        key={`mask-${editingId}`}
                        x={editingEl.x}
                        y={editingEl.y}
                        width={editingEl.width || 400}
                        height={editingEl.height || 100}
                        fill="rgba(255, 255, 255, 0.95)" // White mask to hide original text
                        listening={false}
                      />
                    );
                  })()}
                  
                  {/* Visual feedback: Highlight detected text regions */}
                  {showDetectedRegions && textElements.map((textEl) => {
                    // Only show overlay for baked-in text (detected from image)
                    if (!textEl.is_baked_in) return null;
                    
                    const isHovered = hoveredElementId === textEl.id;
                    const isSelected = selectedId === textEl.id;
                    const isEditing = editingId === textEl.id;
                    
                    // Don't show overlay if this element is being edited (mask covers it)
                    if (isEditing) return null;
                    
                    return (
                      <Rect
                        key={`region-${textEl.id}`}
                        x={textEl.x}
                        y={textEl.y}
                        width={textEl.width || 400}
                        height={textEl.height || 100}
                        fill={isHovered || isSelected ? 'rgba(0, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
                        stroke={isSelected ? tokens.colors.accent.lime : (isHovered ? 'rgba(0, 255, 0, 0.5)' : 'transparent')}
                        strokeWidth={isSelected ? 2 : (isHovered ? 1 : 0)}
                        dash={isHovered && !isSelected ? [5, 5] : []}
                        listening={false} // Don't interfere with text element clicks
                        opacity={isHovered || isSelected ? 1 : 0.3}
                      />
                    );
                  })}
                  
                  {textElements.map((textEl) => (
                    <EditableText
                      key={textEl.id}
                      shapeProps={textEl}
                      isSelected={textEl.id === selectedId}
                      isMultiSelected={selectedIds.includes(textEl.id) && selectedIds.length > 1}
                      isEditing={textEl.id === editingId}
                      onSelect={(e) => {
                        // Multi-select: Shift+Click or Ctrl+Click
                        if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
                          if (selectedIds.includes(textEl.id)) {
                            // Deselect if already selected
                            setSelectedIds(prev => prev.filter(id => id !== textEl.id));
                            if (selectedId === textEl.id) {
                              setSelectedId(selectedIds.find(id => id !== textEl.id) || null);
                            }
                          } else {
                            // Add to selection
                            setSelectedIds(prev => [...prev, textEl.id]);
                            setSelectedId(textEl.id);
                          }
                        } else {
                          // Single select
                          setSelectedId(textEl.id);
                          setSelectedIds([textEl.id]);
                        }
                        setEditingId(null); // Exit edit mode when selecting different element
                      }}
                      onEdit={() => {
                        if (clickToEditEnabled && selectedIds.length === 1) {
                          setEditingId(textEl.id);
                          setSelectedId(textEl.id);
                        }
                      }}
                      onHover={(isHovering) => {
                        setHoveredElementId(isHovering ? textEl.id : null);
                      }}
                      onTextChange={(newText) => {
                        setTextElements((prev) => {
                          const updated = prev.map((el) =>
                            el.id === textEl.id ? { ...el, text: newText } : el
                          );
                          addToHistory(updated);
                          return updated;
                        });
                      }}
                      onBlur={() => {
                        // Save changes and exit edit mode
                        setEditingId(null);
                      }}
                      stageRef={stageRef}
                      zoomLevel={zoomLevel}
                      panPosition={panPosition}
                      onChange={(newAttrs) => {
                        setTextElements((prev) => {
                          const updated = prev.map((el) => {
                            if (el.id === textEl.id) {
                              // Merge new attributes with existing element to preserve all properties
                              const merged = { ...el, ...newAttrs };
                              // Ensure fontStyle is properly formatted if font_weight or font_style changed
                              if (newAttrs.font_weight !== undefined || newAttrs.font_style !== undefined) {
                                const fontStyle = merged.font_style || merged.fontStyle?.split(' ')[0] || 'normal';
                                const fontWeight = merged.font_weight || parseInt(merged.fontStyle?.split(' ')[1]) || 400;
                                merged.fontStyle = `${fontStyle} ${fontWeight}`;
                              }
                              // Ensure textDecoration is set if text_decoration changed
                              if (newAttrs.text_decoration !== undefined) {
                                merged.textDecoration = newAttrs.text_decoration;
                              }
                              return merged;
                            }
                            return el;
                          });
                          addToHistory(updated);
                          return updated;
                        });
                      }}
                    />
                  ))}
                </Layer>
              </Stage>
            ) : (
              <div style={{ color: tokens.colors.text.tertiary, fontSize: '14px' }}>
                Loading image...
              </div>
            )}


            {/* Zoom Controls */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: tokens.colors.background.layer2,
                borderRadius: tokens.radius.md,
                padding: '8px 12px',
                border: `1px solid ${tokens.colors.border.default}`,
                boxShadow: tokens.shadow.card,
              }}
            >
              <button
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: tokens.colors.text.secondary,
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={16} />
              </button>
              <span
                style={{
                  fontSize: '14px',
                  color: tokens.colors.text.primary,
                  minWidth: '50px',
                  textAlign: 'center',
                }}
              >
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: tokens.colors.text.secondary,
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* Toggle detected regions overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                backgroundColor: tokens.colors.background.layer2,
                borderRadius: tokens.radius.md,
                padding: '8px 12px',
                border: `1px solid ${tokens.colors.border.default}`,
                boxShadow: tokens.shadow.card,
              }}
            >
              <button
                onClick={() => setShowDetectedRegions(!showDetectedRegions)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: showDetectedRegions ? tokens.colors.accent.lime : 'transparent',
                  border: `1px solid ${showDetectedRegions ? tokens.colors.accent.lime : tokens.colors.border.default}`,
                  borderRadius: tokens.radius.sm,
                  color: showDetectedRegions ? '#000000' : tokens.colors.text.secondary,
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {showDetectedRegions ? 'Hide Regions' : 'Show Regions'}
              </button>
            </div>
          </div>

          {/* Right Sidebar */}
          <div
            style={{
              width: '320px',
              borderLeft: `1px solid ${tokens.colors.border.default}`,
              backgroundColor: tokens.colors.background.layer1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sidebar Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: `1px solid ${tokens.colors.border.default}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAiDesign}
                disabled={loadingAiText}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.accent.lime,
                  border: 'none',
                  color: '#000000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: loadingAiText ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loadingAiText ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loadingAiText ? 'Generating...' : 'AI Design'}
              </button>
              <button
                onClick={handleAddText}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.colors.background.input,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Type size={16} />
                Add Text
              </button>
              </div>
              
              {/* User Preferences */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: tokens.colors.text.tertiary }}>
                <input
                  type="checkbox"
                  id="click-to-edit-toggle"
                  checked={clickToEditEnabled}
                  onChange={(e) => setClickToEditEnabled(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="click-to-edit-toggle" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Enable click-to-edit
                </label>
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${tokens.colors.border.default}`,
                backgroundColor: tokens.colors.background.layer2,
              }}
            >
              <button
                onClick={() => setActiveTab('edit')}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'edit' ? `2px solid ${tokens.colors.accent.lime}` : '2px solid transparent',
                  color: activeTab === 'edit' ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                onClick={() => setActiveTab('layers')}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'layers' ? `2px solid ${tokens.colors.accent.lime}` : '2px solid transparent',
                  color: activeTab === 'layers' ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Layers ({textElements.length})
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* Multi-select info */}
              {selectedIds.length > 1 && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  backgroundColor: tokens.colors.accent.lime + '20',
                  border: `1px solid ${tokens.colors.accent.lime}`,
                  borderRadius: tokens.radius.md,
                  fontSize: '14px',
                  color: tokens.colors.text.primary,
                }}>
                  <strong>{selectedIds.length} elements selected</strong>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        // Align left
                        const minX = Math.min(...selectedElements.map(el => el.x));
                        setTextElements((prev) => {
                          const updated = prev.map((el) =>
                            selectedIds.includes(el.id) ? { ...el, x: minX } : el
                          );
                          addToHistory(updated);
                          return updated;
                        });
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: tokens.colors.background.input,
                        border: `1px solid ${tokens.colors.border.default}`,
                        borderRadius: tokens.radius.sm,
                        cursor: 'pointer',
                      }}
                    >
                      Align Left
                    </button>
                    <button
                      onClick={() => {
                        // Align center
                        const avgX = selectedElements.reduce((sum, el) => sum + el.x, 0) / selectedElements.length;
                        setTextElements((prev) => {
                          const updated = prev.map((el) =>
                            selectedIds.includes(el.id) ? { ...el, x: avgX } : el
                          );
                          addToHistory(updated);
                          return updated;
                        });
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: tokens.colors.background.input,
                        border: `1px solid ${tokens.colors.border.default}`,
                        borderRadius: tokens.radius.sm,
                        cursor: 'pointer',
                      }}
                    >
                      Align Center
                    </button>
                    <button
                      onClick={() => {
                        // Delete all selected
                        const newElements = textElements.filter(el => !selectedIds.includes(el.id));
                        setTextElements(newElements);
                        setSelectedIds([]);
                        setSelectedId(null);
                        addToHistory(newElements);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        border: `1px solid #EF4444`,
                        borderRadius: tokens.radius.sm,
                        color: '#EF4444',
                        cursor: 'pointer',
                      }}
                    >
                      Delete All
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === 'edit' && selectedElement ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Text Content */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Text Content
                    </label>
                    <textarea
                      value={selectedElement.text}
                      onChange={(e) => updateSelectedElement({ text: e.target.value })}
                      disabled={editingId === selectedId} // Disable sidebar editing when inline editing is active
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: tokens.radius.md,
                        backgroundColor: editingId === selectedId ? tokens.colors.background.layer2 : tokens.colors.background.input,
                        border: `1px solid ${tokens.colors.border.default}`,
                        color: editingId === selectedId ? tokens.colors.text.tertiary : tokens.colors.text.primary,
                        fontSize: '14px',
                        fontFamily: tokens.typography.fontFamily.sans,
                        resize: 'vertical',
                        cursor: editingId === selectedId ? 'not-allowed' : 'text',
                        opacity: editingId === selectedId ? 0.6 : 1,
                      }}
                      placeholder={editingId === selectedId ? "Editing inline on canvas..." : "Enter text..."}
                    />
                    {editingId === selectedId && (
                      <div style={{ fontSize: '12px', color: tokens.colors.text.tertiary, marginTop: '4px' }}>
                        Double-click text on canvas or press Enter to edit inline
                      </div>
                    )}
                  </div>

                  {/* Font Family */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Font
                    </label>
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: tokens.radius.md,
                        backgroundColor: tokens.colors.background.input,
                        border: `1px solid ${tokens.colors.border.default}`,
                        color: tokens.colors.text.primary,
                        fontSize: '14px',
                      }}
                    >
                      {/* Brand Fonts First (Google Pommeli pattern) */}
                      {brandFonts.length > 0 && (
                        <optgroup label="Brand Fonts">
                          {brandFonts.map((font) => (
                            <option key={font} value={font} style={{ fontWeight: 'bold' }}>
                              {font} (Brand)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Standard Fonts">
                        <option value="Poppins">Poppins</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                      </optgroup>
                      {googleFonts.length > 0 && (
                        <optgroup label="Google Fonts">
                          {googleFonts.map((font) => (
                            <option key={font.family} value={font.family}>
                              {font.display}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Font Size: {Math.round(selectedElement.fontSize)}px
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="200"
                      value={selectedElement.fontSize}
                      onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        accentColor: tokens.colors.accent.lime,
                      }}
                    />
                  </div>

                  {/* Text Color */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Text Color
                    </label>
                    {/* Brand Colors Quick Pick (Google Pommeli pattern) */}
                    {brandColors.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {brandColors.map((color, idx) => (
                          <button
                            key={idx}
                            onClick={() => updateSelectedElement({ fill: color })}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: tokens.radius.sm,
                              backgroundColor: color,
                              border: `2px solid ${selectedElement.fill === color ? tokens.colors.accent.lime : tokens.colors.border.default}`,
                              cursor: 'pointer',
                              boxShadow: selectedElement.fill === color ? `0 0 0 2px ${tokens.colors.accent.lime}40` : 'none',
                            }}
                            title={`Brand Color: ${color}`}
                          />
                        ))}
                      </div>
                    )}
                    <input
                      type="color"
                      value={selectedElement.fill}
                      onChange={(e) => updateSelectedElement({ fill: e.target.value })}
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: tokens.radius.md,
                        border: `1px solid ${tokens.colors.border.default}`,
                        cursor: 'pointer',
                      }}
                    />
                  </div>

                  {/* Text Formatting: Bold/Italic/Underline/Strikethrough */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Text Formatting
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          const currentWeight = parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400;
                          const newWeight = currentWeight === 700 ? 400 : 700;
                          const fontStyle = selectedElement.fontStyle?.split(' ')[0] || 'normal';
                          updateSelectedElement({ 
                            fontStyle: `${fontStyle} ${newWeight}`,
                            font_weight: newWeight
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: (parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400) === 700 
                            ? tokens.colors.accent.lime 
                            : tokens.colors.background.input,
                          border: `1px solid ${(parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400) === 700 
                            ? tokens.colors.accent.lime 
                            : tokens.colors.border.default}`,
                          color: (parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400) === 700 
                            ? '#000000' 
                            : tokens.colors.text.primary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Bold (Ctrl+B)"
                      >
                        <Bold size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const fontStyle = selectedElement.fontStyle?.split(' ')[0] || 'normal';
                          const fontWeight = parseInt(selectedElement.fontStyle?.split(' ')[1]) || 400;
                          const newStyle = fontStyle === 'italic' ? 'normal' : 'italic';
                          updateSelectedElement({ 
                            fontStyle: `${newStyle} ${fontWeight}`,
                            font_style: newStyle
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: selectedElement.fontStyle?.includes('italic')
                            ? tokens.colors.accent.lime 
                            : tokens.colors.background.input,
                          border: `1px solid ${selectedElement.fontStyle?.includes('italic')
                            ? tokens.colors.accent.lime 
                            : tokens.colors.border.default}`,
                          color: selectedElement.fontStyle?.includes('italic')
                            ? '#000000' 
                            : tokens.colors.text.primary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Italic (Ctrl+I)"
                      >
                        <Italic size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const currentDecoration = selectedElement.text_decoration || 'none';
                          const newDecoration = currentDecoration === 'underline' ? 'none' : 'underline';
                          updateSelectedElement({ 
                            text_decoration: newDecoration
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: selectedElement.text_decoration === 'underline'
                            ? tokens.colors.accent.lime 
                            : tokens.colors.background.input,
                          border: `1px solid ${selectedElement.text_decoration === 'underline'
                            ? tokens.colors.accent.lime 
                            : tokens.colors.border.default}`,
                          color: selectedElement.text_decoration === 'underline'
                            ? '#000000' 
                            : tokens.colors.text.primary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Underline (Ctrl+U)"
                      >
                        <Underline size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const currentDecoration = selectedElement.text_decoration || 'none';
                          const newDecoration = currentDecoration === 'line-through' ? 'none' : 'line-through';
                          updateSelectedElement({ 
                            text_decoration: newDecoration
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: selectedElement.text_decoration === 'line-through'
                            ? tokens.colors.accent.lime 
                            : tokens.colors.background.input,
                          border: `1px solid ${selectedElement.text_decoration === 'line-through'
                            ? tokens.colors.accent.lime 
                            : tokens.colors.border.default}`,
                          color: selectedElement.text_decoration === 'line-through'
                            ? '#000000' 
                            : tokens.colors.text.primary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Strikethrough (Ctrl+Shift+X)"
                      >
                        <Strikethrough size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Text Align */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Text Align
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['left', 'center', 'right'].map((align) => (
                        <button
                          key={align}
                          onClick={() => updateSelectedElement({ align })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: tokens.radius.md,
                            backgroundColor: selectedElement.align === align ? tokens.colors.accent.lime : tokens.colors.background.input,
                            border: `1px solid ${selectedElement.align === align ? tokens.colors.accent.lime : tokens.colors.border.default}`,
                            color: selectedElement.align === align ? '#000000' : tokens.colors.text.primary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {align === 'left' && <AlignLeft size={16} />}
                          {align === 'center' && <AlignCenter size={16} />}
                          {align === 'right' && <AlignRight size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Letter Spacing */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Letter Spacing: {selectedElement.letterSpacing || 0}px
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="20"
                      value={selectedElement.letterSpacing || 0}
                      onChange={(e) => updateSelectedElement({ letterSpacing: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        accentColor: tokens.colors.accent.lime,
                      }}
                    />
                  </div>

                  {/* Line Height */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Line Height: {(selectedElement.lineHeight || 1.2).toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.8"
                      max="3.0"
                      step="0.1"
                      value={selectedElement.lineHeight || 1.2}
                      onChange={(e) => updateSelectedElement({ lineHeight: parseFloat(e.target.value) })}
                      style={{
                        width: '100%',
                        accentColor: tokens.colors.accent.lime,
                      }}
                    />
                  </div>

                  {/* Opacity */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Opacity: {Math.round(selectedElement.opacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedElement.opacity * 100}
                      onChange={(e) => updateSelectedElement({ opacity: parseInt(e.target.value) / 100 })}
                      style={{
                        width: '100%',
                        accentColor: tokens.colors.accent.lime,
                      }}
                    />
                  </div>

                  {/* Text Background Styles (Google Photos pattern) */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      Text Background
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        onClick={() => updateSelectedElement({ 
                          background_color: selectedElement.background_color === 'transparent' ? '#FFFFFF' : 'transparent',
                          background_opacity: selectedElement.background_color === 'transparent' ? 100 : 0
                        })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: selectedElement.background_color !== 'transparent' 
                            ? tokens.colors.accent.lime 
                            : tokens.colors.background.input,
                          border: `1px solid ${selectedElement.background_color !== 'transparent'
                            ? tokens.colors.accent.lime 
                            : tokens.colors.border.default}`,
                          color: selectedElement.background_color !== 'transparent' ? '#000000' : tokens.colors.text.primary,
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        {selectedElement.background_color === 'transparent' ? 'Add Background' : 'Remove Background'}
                      </button>
                    </div>
                    {selectedElement.background_color !== 'transparent' && (
                      <>
                        <input
                          type="color"
                          value={selectedElement.background_color || '#FFFFFF'}
                          onChange={(e) => updateSelectedElement({ background_color: e.target.value })}
                          style={{
                            width: '100%',
                            height: '40px',
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${tokens.colors.border.default}`,
                            cursor: 'pointer',
                            marginBottom: '8px',
                          }}
                        />
                        <label style={{ fontSize: '12px', color: tokens.colors.text.tertiary }}>
                          Background Opacity: {selectedElement.background_opacity || 100}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedElement.background_opacity || 100}
                          onChange={(e) => updateSelectedElement({ background_opacity: parseInt(e.target.value) })}
                          style={{
                            width: '100%',
                            accentColor: tokens.colors.accent.lime,
                          }}
                        />
                      </>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={handleDeleteElement}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: tokens.radius.md,
                      backgroundColor: 'transparent',
                      border: `1px solid #EF4444`,
                      color: '#EF4444',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Trash2 size={16} />
                    Delete Element
                  </button>
                </div>
              ) : activeTab === 'edit' ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: tokens.colors.text.tertiary,
                    fontSize: '14px',
                  }}
                >
                  <Type size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <p>No text element selected</p>
                  <p>Click on a text or add a new one</p>
                </div>
              ) : (
                /* Layers Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {textElements.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '200px',
                        color: tokens.colors.text.tertiary,
                        fontSize: '14px',
                      }}
                    >
                      <Layers size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                      <p>No layers yet</p>
                      <p>Add text to get started</p>
                    </div>
                  ) : (
                    textElements.map((el) => (
                      <div
                        key={el.id}
                        onClick={() => setSelectedId(el.id)}
                        style={{
                          padding: '12px',
                          borderRadius: tokens.radius.md,
                          backgroundColor: el.id === selectedId ? tokens.colors.accent.lime + '20' : tokens.colors.background.input,
                          border: `1px solid ${el.id === selectedId ? tokens.colors.accent.lime : tokens.colors.border.default}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: tokens.colors.text.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {el.text}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: tokens.colors.text.tertiary,
                              marginTop: '4px',
                            }}
                          >
                            {el.fontFamily} • {Math.round(el.fontSize)}px
                            {el.ai_generated && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: tokens.colors.accent.lime + '40',
                                  color: tokens.colors.accent.lime,
                                  fontSize: '10px',
                                }}
                              >
                                AI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextOverlayModalKonva;
