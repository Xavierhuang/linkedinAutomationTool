import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer } from 'react-konva';
import { 
  X, Type, Sparkles, Loader, ZoomIn, ZoomOut, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, Layers, Trash2
} from 'lucide-react';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Text component with transformer
const EditableText = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const tokens = useThemeTokens(); // Add hook call here

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  // Safety check for tokens
  if (!tokens) {
    return null;
  }

  return (
    <>
      <KonvaText
        ref={shapeRef}
        {...shapeProps}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);
          
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            fontSize: Math.max(5, shapeProps.fontSize * scaleX),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          borderStroke={tokens.colors.accent.lime}
          borderStrokeWidth={2}
          anchorStroke={tokens.colors.accent.lime}
          anchorFill={tokens.colors.background.app}
          anchorSize={8}
          anchorCornerRadius={4}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
        />
      )}
    </>
  );
};

const TextOverlayModalKonva = ({ isOpen, onClose, imageUrl, onApply, initialElements = [], campaignData = null }) => {
  const tokens = useThemeTokens();
  
  // Safety check - ensure tokens is always defined
  if (!tokens) {
    return null; // Or return a loading state
  }
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

  // Initialize elements from props
  useEffect(() => {
    if (isOpen && initialElements.length > 0 && stageSize.width > 0) {
      const convertedElements = initialElements.map((el) => ({
        id: `text-${elementIdCounter.current++}`,
        text: el.text || 'Sample Text',
        x: stageSize.width * (el.position?.[0] || 50) / 100,
        y: stageSize.height * (el.position?.[1] || 50) / 100,
        fontSize: el.font_size || 72,
        fontFamily: el.font_name || 'Poppins',
        fontStyle: `${el.font_style || 'normal'} ${el.font_weight || 400}`,
        fill: el.color || '#000000',
        align: el.text_align || 'left',
        width: el.width || 400,
        rotation: el.rotation || 0,
        strokeWidth: el.stroke_width || 0,
        stroke: el.stroke_color || '#000000',
        shadowEnabled: el.shadow_enabled || false,
        shadowColor: el.shadow_color || '#000000',
        shadowBlur: el.shadow_blur || 10,
        shadowOffsetX: el.shadow_offset_x || 0,
        shadowOffsetY: el.shadow_offset_y || 0,
        opacity: (el.opacity || 100) / 100,
        letterSpacing: el.letter_spacing || 0,
        lineHeight: el.line_height || 1.2,
        ai_generated: el.ai_generated || false,
      }));
      setTextElements(convertedElements);
      if (convertedElements.length > 0) {
        setSelectedId(convertedElements[0].id);
      }
      setHistory([convertedElements]);
      setHistoryIndex(0);
    } else if (isOpen && initialElements.length === 0) {
      setTextElements([]);
      setHistory([[]]);
      setHistoryIndex(0);
    }
  }, [isOpen, initialElements, stageSize]);

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

  // Add text element
  const handleAddText = () => {
    const newElement = {
      id: `text-${elementIdCounter.current++}`,
      text: 'New Text',
      x: stageSize.width / 2 - 100,
      y: stageSize.height / 2 - 36,
      fontSize: 72,
      fontFamily: 'Poppins',
      fontStyle: 'normal 400',
      fill: '#000000',
      align: 'left',
      width: 400,
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
      ai_generated: false,
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
      const updated = prev.map((el) =>
        el.id === selectedId ? { ...el, ...updates } : el
      );
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

  // Export canvas
  const handleExport = () => {
    if (!stageRef.current) return;
    
    const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
    
    // Convert canvas elements back to format expected by parent
    const exportElements = textElements.map((el) => ({
      text: el.text,
      position: [(el.x / stageSize.width) * 100, (el.y / stageSize.height) * 100],
      font_size: Math.round(el.fontSize),
      font_name: el.fontFamily,
      font_weight: parseInt(el.fontStyle.split(' ')[1]) || 400,
      font_style: el.fontStyle.split(' ')[0] || 'normal',
      color: el.fill,
      text_align: el.align,
      width: el.width,
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
      ai_generated: el.ai_generated,
    }));

    onApply(exportElements, dataURL);
    onClose();
  };

  const selectedElement = textElements.find((el) => el.id === selectedId);

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
            <button
              onClick={handleExport}
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
                  <KonvaImage image={image} width={stageSize.width} height={stageSize.height} />
                  {textElements.map((textEl) => (
                    <EditableText
                      key={textEl.id}
                      shapeProps={textEl}
                      isSelected={textEl.id === selectedId}
                      onSelect={() => setSelectedId(textEl.id)}
                      onChange={(newAttrs) => {
                        setTextElements((prev) => {
                          const updated = prev.map((el) =>
                            el.id === textEl.id ? newAttrs : el
                          );
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
                gap: '8px',
              }}
            >
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
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: tokens.radius.md,
                        backgroundColor: tokens.colors.background.input,
                        border: `1px solid ${tokens.colors.border.default}`,
                        color: tokens.colors.text.primary,
                        fontSize: '14px',
                        fontFamily: tokens.typography.fontFamily.sans,
                        resize: 'vertical',
                      }}
                    />
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
                      <option value="Poppins">Poppins</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      {googleFonts.map((font) => (
                        <option key={font.family} value={font.family}>
                          {font.display}
                        </option>
                      ))}
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
