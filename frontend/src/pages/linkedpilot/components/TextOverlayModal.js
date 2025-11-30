import React, { useState, useRef, useEffect } from 'react';
import { 
  X, RotateCw, Bold, Italic, Underline, Strikethrough, 
  Type, Palette, Minus, Plus, Move, GripVertical,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Layers, Eye, EyeOff, Trash2, Undo2, Redo2, Link as LinkIcon, Sparkles, Loader, ZoomIn, ZoomOut, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import axios from 'axios';
import designTokens from '@/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TextOverlayModal = ({ isOpen, onClose, imageUrl, onApply, initialElements = [], campaignData = null }) => {
  const [textElements, setTextElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'layers'
  const [previewImageSize, setPreviewImageSize] = useState({ width: 0, height: 0 });
  const [googleFonts, setGoogleFonts] = useState([]);
  const [loadingFonts, setLoadingFonts] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [loadingAiText, setLoadingAiText] = useState(false);
  const [aiGenerationInfo, setAiGenerationInfo] = useState(null); // Track AI generation details
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartElementPos, setResizeStartElementPos] = useState([0, 0]);
  const [rotateStartAngle, setRotateStartAngle] = useState(0);
  const [rotateStartRotation, setRotateStartRotation] = useState(0);
  const [rotateStartPos, setRotateStartPos] = useState({ x: 0, y: 0 });
  const [isEditingText, setIsEditingText] = useState(false);
  const [draggedLayerIndex, setDraggedLayerIndex] = useState(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null); // Template selector
  const [dragAnimationFrame, setDragAnimationFrame] = useState(null); // For optimized dragging
  const [expandedSections, setExpandedSections] = useState({
    image: true,
    header: true,
    description: false,
    callToAction: false
  });
  const [history, setHistory] = useState([]); // History for undo/redo
  const [historyIndex, setHistoryIndex] = useState(-1); // Current position in history
  const [defaultEditorSettings, setDefaultEditorSettings] = useState({
    font_size: 72,
    font_name: 'Poppins',
    font_weight: 300,
    font_style: 'normal',
    text_decoration: 'none',
    text_align: 'left',
    color: '#000000',
    stroke_width: 0,
    stroke_color: '#000000',
    shadow_enabled: false,
    shadow_color: '#000000',
    shadow_blur: 10,
    shadow_offset_x: 0,
    shadow_offset_y: 0,
    background_color: 'transparent',
    background_opacity: 100,
    opacity: 100,
    letter_spacing: 0,
    line_height: 1.2
  });
  const previewContainerRef = useRef(null);
  const elementIdCounter = useRef(1);
  const activeEditableRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Fetch Google Fonts function
  const fetchGoogleFonts = async () => {
    if (loadingFonts) return;
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

  // Load Google Fonts on open
  useEffect(() => {
    if (isOpen && googleFonts.length === 0) {
      fetchGoogleFonts();
    }
  }, [isOpen]);

  // Load initial elements when modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      if (initialElements && initialElements.length > 0) {
        console.log('[TEXT_OVERLAY] Loading initial elements:', initialElements);
        setTextElements(initialElements);
        // Set counter to max ID + 1
        const maxId = Math.max(...initialElements.map(el => el.id || 0), 0);
        elementIdCounter.current = maxId + 1;
        // Initialize history
        setHistory([[...initialElements]]);
        setHistoryIndex(0);
      } else {
        console.log('[TEXT_OVERLAY] No initial elements, starting fresh');
        setTextElements([]);
        // Initialize history with empty array
        setHistory([[]]);
        setHistoryIndex(0);
      }
      setSelectedElementId(null);
      setIsEditingText(false);
    }
  }, [isOpen, imageUrl, initialElements]);

  // Load Google Fonts dynamically when needed
  useEffect(() => {
    if (textElements.length > 0) {
      // Get unique font families used in text elements
      const usedFonts = [...new Set(textElements.map(el => el.font_name))];
      
      usedFonts.forEach(fontFamily => {
        // Check if font link already exists
        const linkId = `font-${fontFamily.replace(/\s+/g, '-')}`;
        if (!document.getElementById(linkId)) {
          // Create and add link tag for Google Fonts
          const link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700;800;900&display=swap`;
          document.head.appendChild(link);
        }
      });
    }
  }, [textElements]);

  const getSelectedElement = () => {
    return textElements.find(el => el.id === selectedElementId) || null;
  };

  const updateSelectedElement = (updates) => {
    setTextElements(prev => {
      const updated = prev.map(el => 
      el.id === selectedElementId ? { ...el, ...updates } : el
      );
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...updated]);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      return updated;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setTextElements([...history[newIndex]]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setTextElements([...history[newIndex]]);
    }
  };

  const handleDoubleClick = (e) => {
    if (previewContainerRef.current && previewImageSize.width > 0 && previewImageSize.height > 0) {
      const rect = previewContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const percentX = (x / rect.width) * 100;
      const percentY = (y / rect.height) * 100;
      
      const pixelX = Math.round((percentX / 100) * previewImageSize.width);
      const pixelY = Math.round((percentY / 100) * previewImageSize.height);
      
      const newElement = {
        id: elementIdCounter.current++,
        text: '', // Empty text instead of placeholder
        position: [pixelX, pixelY],
        font_size: defaultEditorSettings.font_size,
        font_name: defaultEditorSettings.font_name,
        font_weight: defaultEditorSettings.font_weight,
        font_style: defaultEditorSettings.font_style,
        text_decoration: defaultEditorSettings.text_decoration,
        text_align: defaultEditorSettings.text_align,
        color: defaultEditorSettings.color,
        stroke_width: defaultEditorSettings.stroke_width,
        stroke_color: defaultEditorSettings.stroke_color,
        shadow_enabled: defaultEditorSettings.shadow_enabled,
        shadow_color: defaultEditorSettings.shadow_color,
        shadow_blur: defaultEditorSettings.shadow_blur,
        shadow_offset_x: defaultEditorSettings.shadow_offset_x,
        shadow_offset_y: defaultEditorSettings.shadow_offset_y,
        background_color: defaultEditorSettings.background_color,
        background_opacity: defaultEditorSettings.background_opacity,
        opacity: defaultEditorSettings.opacity,
        letter_spacing: defaultEditorSettings.letter_spacing,
        line_height: defaultEditorSettings.line_height,
        width: 300,
        height: 100,
        rotation: 0,
        selected: true
      };
      
      setTextElements(prev => [...prev, newElement]);
      setSelectedElementId(newElement.id);
      setIsEditingText(true);
    }
  };

  const handleElementMouseDown = (e, elementId) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    setIsEditingText(false);
    
    if (!previewContainerRef.current || !previewImageSize.width || !previewImageSize.height) return;
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    const element = textElements.find(el => el.id === elementId);
    if (!element) return;
    
    // Convert element position to screen coordinates
    const elementPercentX = (element.position[0] / previewImageSize.width) * 100;
    const elementPercentY = (element.position[1] / previewImageSize.height) * 100;
    const elementScreenX = (elementPercentX / 100) * rect.width;
    const elementScreenY = (elementPercentY / 100) * rect.height;
    
    setDragOffset({
      x: e.clientX - rect.left - elementScreenX,
      y: e.clientY - rect.top - elementScreenY
    });
    setIsDragging(true);
  };

  const handleResizeMouseDown = (e, elementId, direction) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    setResizeDirection(direction);
    
    const element = textElements.find(el => el.id === elementId);
    if (!element || !previewContainerRef.current) return;
    
    setResizeStartSize(element.font_size);
    setResizeStartWidth(element.width || 300);
    setResizeStartHeight(element.height || 100);
    setResizeStartElementPos([...element.position]);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setIsResizing(true);
  };

  const handleRotateMouseDown = (e, elementId) => {
    e.stopPropagation();
    setSelectedElementId(elementId);
    
    const element = textElements.find(el => el.id === elementId);
    if (!element || !previewContainerRef.current) return;
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    const elementPercentX = (element.position[0] / previewImageSize.width) * 100;
    const elementPercentY = (element.position[1] / previewImageSize.height) * 100;
    const elementScreenX = (elementPercentX / 100) * rect.width;
    const elementScreenY = (elementPercentY / 100) * rect.height;
    const elementCenterX = rect.left + elementScreenX;
    const elementCenterY = rect.top + elementScreenY;
    
    // Calculate initial angle from center to mouse position
    const startAngle = Math.atan2(e.clientY - elementCenterY, e.clientX - elementCenterX);
    setRotateStartAngle(startAngle);
    setRotateStartRotation(element.rotation || 0);
    setRotateStartPos({ x: elementCenterX, y: elementCenterY });
    setIsRotating(true);
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      handleCanvasPanMove(e);
      return;
    }
    
    // Optimize dragging with requestAnimationFrame
    if (isDragging && selectedElementId && previewContainerRef.current && previewImageSize.width > 0 && previewImageSize.height > 0) {
      // Cancel previous frame if exists
      if (dragAnimationFrame) {
        cancelAnimationFrame(dragAnimationFrame);
      }
      
      // Use requestAnimationFrame for smooth dragging
      const frameId = requestAnimationFrame(() => {
        const rect = previewContainerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - dragOffset.x) / rect.width;
        const y = (e.clientY - rect.top - dragOffset.y) / rect.height;
        
        const pixelX = Math.round(x * previewImageSize.width);
        const pixelY = Math.round(y * previewImageSize.height);
        
        updateSelectedElement({ position: [pixelX, pixelY] });
      });
      setDragAnimationFrame(frameId);
    } else if (isResizing && selectedElementId && previewContainerRef.current && resizeDirection) {
      const element = textElements.find(el => el.id === selectedElementId);
      if (!element) return;
      
      const rect = previewContainerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      const deltaXPercent = (deltaX / rect.width) * previewImageSize.width;
      const deltaYPercent = (deltaY / rect.height) * previewImageSize.height;
      
      const isCorner = resizeDirection.includes('left') && resizeDirection.includes('top') ||
                       resizeDirection.includes('left') && resizeDirection.includes('bottom') ||
                       resizeDirection.includes('right') && resizeDirection.includes('top') ||
                       resizeDirection.includes('right') && resizeDirection.includes('bottom');
      
      if (isCorner) {
        // Corner handles: scale font uniformly
        const distance = Math.sqrt(deltaXPercent * deltaXPercent + deltaYPercent * deltaYPercent);
        const sizeChange = distance * 0.5;
        const increasing = resizeDirection.includes('right') || resizeDirection.includes('bottom');
        const newSize = Math.max(12, increasing ? resizeStartSize + sizeChange : resizeStartSize - sizeChange);
        updateSelectedElement({ font_size: Math.round(newSize) });
      } else if (resizeDirection === 'left' || resizeDirection === 'right') {
        // Left/right handles: adjust width only from this side
        const widthChange = resizeDirection === 'left' ? -deltaXPercent : deltaXPercent;
        const newWidth = Math.max(50, resizeStartWidth + widthChange);
        updateSelectedElement({ width: Math.round(newWidth) });
      } else if (resizeDirection === 'top' || resizeDirection === 'bottom') {
        // Top/bottom handles: adjust height only from this side
        const heightChange = resizeDirection === 'top' ? -deltaYPercent : deltaYPercent;
        const newHeight = Math.max(50, resizeStartHeight + heightChange);
        updateSelectedElement({ height: Math.round(newHeight) });
      }
    } else if (isRotating && selectedElementId) {
      // Calculate current angle
      const currentAngle = Math.atan2(e.clientY - rotateStartPos.y, e.clientX - rotateStartPos.x);
      
      // Calculate delta from start angle
      let angleDelta = currentAngle - rotateStartAngle;
      
      // Normalize angle delta to -PI to PI range
      if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
      
      // Add delta to start rotation (not current rotation to avoid accumulation)
      const newRotation = rotateStartRotation + (angleDelta * 180 / Math.PI);
      
      // Normalize final rotation to -180 to 180 range
      let normalizedRotation = newRotation;
      if (normalizedRotation > 180) normalizedRotation -= 360;
      if (normalizedRotation < -180) normalizedRotation += 360;
      
      updateSelectedElement({ rotation: Math.round(normalizedRotation) });
    }
  };

  const handleCanvasMouseUp = () => {
    // Cancel any pending animation frames
    if (dragAnimationFrame) {
      cancelAnimationFrame(dragAnimationFrame);
      setDragAnimationFrame(null);
    }
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setResizeDirection('');
    handleCanvasPanEnd();
  };

  const handleApply = () => {
    // Apply button: Add new text element at center of canvas with current editor settings
    if (!previewContainerRef.current || !previewImageSize.width || !previewImageSize.height) return;
    
    const rect = previewContainerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const percentX = (centerX / rect.width) * 100;
    const percentY = (centerY / rect.height) * 100;
    
    const pixelX = Math.round((percentX / 100) * previewImageSize.width);
    const pixelY = Math.round((percentY / 100) * previewImageSize.height);
    
    // Use current selected element's settings as default, or use default editor settings
    const selectedElement = getSelectedElement();
    const newElement = {
      id: elementIdCounter.current++,
      text: '', // Empty text instead of placeholder
      position: [pixelX, pixelY],
      font_size: selectedElement?.font_size || defaultEditorSettings.font_size,
      font_name: selectedElement?.font_name || defaultEditorSettings.font_name,
      font_weight: selectedElement?.font_weight || defaultEditorSettings.font_weight,
      font_style: selectedElement?.font_style || defaultEditorSettings.font_style,
      text_decoration: selectedElement?.text_decoration || defaultEditorSettings.text_decoration,
      text_align: selectedElement?.text_align || defaultEditorSettings.text_align,
      color: selectedElement?.color || defaultEditorSettings.color,
      stroke_width: selectedElement?.stroke_width || defaultEditorSettings.stroke_width,
      stroke_color: selectedElement?.stroke_color || defaultEditorSettings.stroke_color,
      shadow_enabled: selectedElement?.shadow_enabled || defaultEditorSettings.shadow_enabled,
      shadow_color: selectedElement?.shadow_color || defaultEditorSettings.shadow_color,
      shadow_blur: selectedElement?.shadow_blur || defaultEditorSettings.shadow_blur,
      shadow_offset_x: selectedElement?.shadow_offset_x || defaultEditorSettings.shadow_offset_x,
      shadow_offset_y: selectedElement?.shadow_offset_y || defaultEditorSettings.shadow_offset_y,
      background_color: selectedElement?.background_color || defaultEditorSettings.background_color,
      background_opacity: selectedElement?.background_opacity || defaultEditorSettings.background_opacity,
      opacity: selectedElement?.opacity || defaultEditorSettings.opacity,
      letter_spacing: selectedElement?.letter_spacing || defaultEditorSettings.letter_spacing,
      line_height: selectedElement?.line_height || defaultEditorSettings.line_height,
      width: selectedElement?.width || 300,
      height: selectedElement?.height || 100,
      rotation: 0,
      selected: true
    };
    
    setTextElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    setIsEditingText(true);
  };

  const handleSave = async () => {
    // Save button: Apply overlays to image and close modal
    if (textElements.length === 0) {
      alert('Please add at least one text element');
      return;
    }

    try {
      setLoadingOverlay(true);
      
      const response = await axios.get(imageUrl, { responseType: 'blob' });
      const blob = await response.data;
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        
        // Apply all text overlays sequentially
        let currentImageBase64 = base64data;
        let finalUrl = imageUrl;
        
        for (const element of textElements) {
          const overlayResponse = await axios.post(`${BACKEND_URL}/api/drafts/add-text-overlay`, {
            image_base64: currentImageBase64,
            text: element.text,
            position: element.position,
            font_name: element.font_name,
            font_size: element.font_size,
            font_weight: element.font_weight,
            font_style: element.font_style,
            text_decoration: element.text_decoration,
            text_align: element.text_align,
            color: element.color,
            stroke_width: element.stroke_width || 0,
            stroke_color: element.stroke_color || '#000000',
            shadow_enabled: element.shadow_enabled || false,
            shadow_color: element.shadow_color || '#000000',
            shadow_blur: element.shadow_blur || 10,
            shadow_offset_x: element.shadow_offset_x || 0,
            shadow_offset_y: element.shadow_offset_y || 0,
            background_color: element.background_color || 'transparent',
            opacity: element.opacity !== undefined ? element.opacity : 100,
            letter_spacing: element.letter_spacing || 0,
            line_height: element.line_height || 1.2,
            rotation: element.rotation || 0,
            width: element.width || 300,
            height: element.height || 100
          });
          
          // Update for next iteration
          currentImageBase64 = overlayResponse.data.image_base64?.split(',')[1] || currentImageBase64;
          finalUrl = overlayResponse.data.url || finalUrl;
        }
        
        if (onApply) {
          onApply(finalUrl, textElements);
        }
        
        setLoadingOverlay(false);
        
        // Close modal after saving
        onClose();
      };
    } catch (error) {
      console.error('Error applying text overlay:', error);
      setLoadingOverlay(false);
      alert('Failed to apply text overlay: ' + error.message);
    }
  };

  const handleLayerDragStart = (e, index) => {
    e.stopPropagation();
    setDraggedLayerIndex(index);
  };

  const handleLayerDragOver = (e, index) => {
    e.preventDefault();
    setDragOverLayerIndex(index);
  };

  const handleLayerDragEnd = () => {
    if (draggedLayerIndex !== null && dragOverLayerIndex !== null && draggedLayerIndex !== dragOverLayerIndex) {
      const newElements = [...textElements];
      const draggedElement = newElements[draggedLayerIndex];
      newElements.splice(draggedLayerIndex, 1);
      newElements.splice(dragOverLayerIndex, 0, draggedElement);
      setTextElements(newElements);
    }
    setDraggedLayerIndex(null);
    setDragOverLayerIndex(null);
  };

  const handleRichTextCommand = (command, value = null) => {
    if (activeEditableRef.current) {
      activeEditableRef.current.focus();
      document.execCommand(command, false, value);
      // Update the element with the new HTML content
      if (activeEditableRef.current) {
        const newText = activeEditableRef.current.innerHTML;
        updateSelectedElement({ text: newText });
      }
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleCanvasPanStart = (e) => {
    // Left click to pan (unless clicking on a text element which stops propagation)
    if (e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
    }
  };

  const handleCanvasPanMove = (e) => {
    if (isPanning) {
      setPanPosition({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    }
  };

  const handleCanvasPanEnd = () => {
    setIsPanning(false);
  };

  const handleDeleteElement = () => {
    if (selectedElementId) {
      setTextElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
      setIsEditingText(false);
    }
  };

  // Global mouse move/up handlers for panning
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        setPanPosition({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }
    };

    if (isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoomLevel(prev => Math.max(50, Math.min(200, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Global keyboard listener for Delete key
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle Delete/Backspace when an element is selected and we're not editing text
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && !isEditingText) {
        // Don't delete if user is typing in an input field
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        handleDeleteElement();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, selectedElementId, isEditingText]);

  const handleGenerateAiOverlay = async () => {
    if (!campaignData) {
      alert('No campaign data available. Please ensure you have a campaign message.');
      return;
    }
    
    if (previewImageSize.width === 0 || previewImageSize.height === 0) {
      alert('Please wait for the image to load before generating AI overlay.');
      return;
    }
    
    setLoadingAiText(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/drafts/generate-text-overlay`, {
        content: campaignData.content || '',
        hashtags: campaignData.hashtags || [],
        imagePrompt: campaignData.imagePrompt || '',
        imageDescription: campaignData.imageData?.description || '',
        imageUrl: imageUrl,  // Send image URL for advanced system
        preferred_template: selectedTemplate && selectedTemplate !== 'auto' ? selectedTemplate : null  // Send template preference
      });
      
      if (response.data.overlay_elements && response.data.overlay_elements.length > 0) {
        // Store AI generation info for display
        setAiGenerationInfo({
          template: response.data.template_id || 'Auto-selected',
          quality_score: response.data.quality_score || 'High',
          elements_generated: response.data.overlay_elements.length,
          timestamp: new Date()
        });
        
        // Convert percentage positions to pixel positions
        const convertedElements = response.data.overlay_elements.map((element, idx) => ({
          ...element,
          id: elementIdCounter.current++,
          position: [
            Math.round((element.position[0] / 100) * previewImageSize.width),
            Math.round((element.position[1] / 100) * previewImageSize.height)
          ],
          selected: idx === 0,
          ai_generated: true, // Mark as AI-generated
          template_id: response.data.template_id
        }));
        
        setTextElements(prev => [...prev, ...convertedElements]);
        if (convertedElements.length > 0) {
          setSelectedElementId(convertedElements[0].id);
        }
      }
    } catch (error) {
      console.error('Error generating AI overlay:', error);
      alert('Failed to generate AI overlay: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingAiText(false);
    }
  };

  const fontWeights = [
    { value: 100, label: 'Thin 100' },
    { value: 200, label: 'Extra Light 200' },
    { value: 300, label: 'Light 300' },
    { value: 400, label: 'Regular 400' },
    { value: 500, label: 'Medium 500' },
    { value: 600, label: 'Semi Bold 600' },
    { value: 700, label: 'Bold 700' },
    { value: 800, label: 'Extra Bold 800' },
    { value: 900, label: 'Black 900' }
  ];

  const selectedElement = getSelectedElement();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: designTokens.typography.fontFamily.sans,
      padding: '20px'
    }}
    onClick={onClose}
    >
      <div style={{
        width: '95vw',
        height: '90vh',
        maxWidth: '1600px',
        backgroundColor: designTokens.colors.background.layer2,
        borderRadius: designTokens.radius.xl,
        border: `1px solid ${designTokens.colors.border.default}`,
        boxShadow: designTokens.shadow.floating,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div style={{
          height: '64px',
          borderBottom: `1px solid ${designTokens.colors.border.default}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: designTokens.colors.background.layer1,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{
              color: designTokens.colors.text.primary,
              fontSize: designTokens.typography.fontSize.lg,
              fontWeight: designTokens.typography.fontWeight.semibold,
              fontFamily: designTokens.typography.fontFamily.serif,
              fontStyle: 'italic'
            }}>
              Edit Image
            </h2>
            {selectedElement && (
              <>
                <div style={{ width: '1px', height: '24px', backgroundColor: designTokens.colors.border.default }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    style={{
                      padding: '8px 12px',
                      borderRadius: designTokens.radius.md,
                      color: historyIndex <= 0 ? designTokens.colors.text.tertiary : designTokens.colors.text.secondary,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                      fontSize: designTokens.typography.fontSize.sm,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (historyIndex > 0) {
                        e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                        e.currentTarget.style.color = designTokens.colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (historyIndex > 0) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = designTokens.colors.text.secondary;
                      }
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
                      borderRadius: designTokens.radius.md,
                      color: historyIndex >= history.length - 1 ? designTokens.colors.text.tertiary : designTokens.colors.text.secondary,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: designTokens.typography.fontSize.sm,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (historyIndex < history.length - 1) {
                        e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                        e.currentTarget.style.color = designTokens.colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (historyIndex < history.length - 1) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = designTokens.colors.text.secondary;
                      }
                    }}
                  >
                    <Redo2 size={16} />
                    <span>Redo</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: designTokens.radius.full,
                color: designTokens.colors.text.secondary,
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={loadingOverlay}
              style={{
                padding: '8px 24px',
                borderRadius: designTokens.radius.full,
                color: designTokens.colors.text.inverse,
                backgroundColor: designTokens.colors.accent.lime,
                border: 'none',
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.semibold,
                cursor: loadingOverlay ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: designTokens.shadow.subtle,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loadingOverlay) {
                  e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingOverlay) {
                  e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loadingOverlay ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
              Save Image
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Canvas Area */}
          <div style={{
            flex: 1,
            backgroundColor: designTokens.colors.background.app,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            position: 'relative',
            overflow: 'auto'
          }}>
            {/* Floating Toolbar for Selected Element */}
      {selectedElement && (
        <div style={{
          position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: designTokens.colors.background.layer1,
                border: `1px solid ${designTokens.colors.border.default}`,
                borderRadius: designTokens.radius.lg,
                padding: '8px',
          display: 'flex',
          alignItems: 'center',
                gap: '4px',
                boxShadow: designTokens.shadow.card,
                zIndex: 1000
        }}>
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
              color: historyIndex <= 0 ? designTokens.colors.text.tertiary : designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              if (historyIndex > 0) {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex > 0) {
              e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }
            }}
            title="Undo"
          >
            <Undo2 size={14} />
          </button>

          {/* Redo */}
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
              color: historyIndex >= history.length - 1 ? designTokens.colors.text.tertiary : designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              if (historyIndex < history.length - 1) {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex < history.length - 1) {
              e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }
            }}
            title="Redo"
          >
            <Redo2 size={14} />
          </button>

          <div style={{ width: '1px', height: '20px', backgroundColor: designTokens.colors.border.default, margin: '0 6px' }} />

          {/* Delete */}
          <button
            onClick={handleDeleteElement}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
              color: designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = designTokens.colors.error + '20';
              e.currentTarget.style.color = designTokens.colors.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = designTokens.colors.text.secondary;
            }}
            title="Delete (Del)"
          >
            <Trash2 size={14} />
          </button>

          <div style={{ width: '1px', height: '20px', backgroundColor: designTokens.colors.border.default, margin: '0 6px' }} />

          {/* Font Size */}
          <input
            type="number"
            value={selectedElement.font_size}
            onChange={(e) => updateSelectedElement({ font_size: parseInt(e.target.value) || 12 })}
            style={{
              width: '52px',
              height: '28px',
              padding: '4px 8px',
              border: `1px solid ${designTokens.colors.border.default}`,
              borderRadius: designTokens.radius.sm,
              fontSize: designTokens.typography.fontSize.xs,
              textAlign: 'center',
              outline: 'none',
              fontFamily: designTokens.typography.fontFamily.sans,
              backgroundColor: designTokens.colors.background.input,
              color: designTokens.colors.text.primary,
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = designTokens.colors.border.default;
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Font size"
          />

          {/* Font Family */}
          <select
            value={selectedElement.font_name}
            onChange={(e) => updateSelectedElement({ font_name: e.target.value })}
            style={{
              height: '28px',
              padding: '0 8px',
              fontSize: designTokens.typography.fontSize.xs,
              fontWeight: designTokens.typography.fontWeight.medium,
              color: designTokens.colors.text.primary,
              backgroundColor: designTokens.colors.background.input,
              border: `1px solid ${designTokens.colors.border.default}`,
              borderRadius: designTokens.radius.sm,
              cursor: 'pointer',
              fontFamily: designTokens.typography.fontFamily.sans,
              minWidth: '130px',
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = designTokens.colors.border.default;
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Font family"
          >
            {googleFonts.map((font, idx) => (
              <option key={idx} value={font.family}>{font.display}</option>
            ))}
          </select>

          {/* Bold */}
          <button
            onClick={() => handleRichTextCommand('bold')}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedElement.font_weight >= 700 ? designTokens.colors.accent.lime : 'transparent',
              transition: 'all 0.15s ease',
              fontWeight: 700,
              fontSize: designTokens.typography.fontSize.xs,
              color: selectedElement.font_weight >= 700 ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              if (selectedElement.font_weight < 700) {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedElement.font_weight < 700) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }
            }}
            title="Bold"
          >
            B
          </button>

          {/* Italic */}
          <button
            onClick={() => handleRichTextCommand('italic')}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedElement.font_style === 'italic' ? designTokens.colors.accent.lime : 'transparent',
              transition: 'all 0.15s ease',
              fontStyle: 'italic',
              fontSize: designTokens.typography.fontSize.xs,
              fontWeight: 700,
              color: selectedElement.font_style === 'italic' ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              if (selectedElement.font_style !== 'italic') {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedElement.font_style !== 'italic') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }
            }}
            title="Italic"
          >
            I
          </button>

          {/* Underline */}
          <button
            onClick={() => handleRichTextCommand('underline')}
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: designTokens.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedElement.text_decoration === 'underline' ? designTokens.colors.accent.lime : 'transparent',
              transition: 'all 0.15s ease',
              textDecoration: 'underline',
              fontSize: designTokens.typography.fontSize.xs,
              fontWeight: 700,
              color: selectedElement.text_decoration === 'underline' ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
            }}
            onMouseEnter={(e) => {
              if (selectedElement.text_decoration !== 'underline') {
                e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                e.currentTarget.style.color = designTokens.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedElement.text_decoration !== 'underline') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = designTokens.colors.text.secondary;
              }
            }}
            title="Underline"
          >
            U
          </button>

          {/* Text Color */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                width: '28px',
                height: '28px',
                padding: '0',
                border: `2px solid ${showColorPicker ? designTokens.colors.accent.lime : designTokens.colors.border.default}`,
                borderRadius: designTokens.radius.sm,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedElement.color || designTokens.colors.text.primary,
                transition: 'all 0.15s ease',
                fontSize: designTokens.typography.fontSize.xs,
                fontWeight: 700,
                color: '#FFFFFF',
                boxShadow: showColorPicker ? `0 0 0 3px ${designTokens.colors.accent.lime}20` : 'none'
              }}
              title="Text Color"
            >
              <Palette size={14} />
            </button>
            {showColorPicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                padding: '12px',
                backgroundColor: designTokens.colors.background.layer1,
                border: `1px solid ${designTokens.colors.border.default}`,
                borderRadius: designTokens.radius.md,
                boxShadow: designTokens.shadow.card,
                zIndex: 10001
              }}>
                <input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) => updateSelectedElement({ color: e.target.value })}
                  style={{
                    width: '100%',
                    height: '36px',
                    border: `1px solid ${designTokens.colors.border.default}`,
                    borderRadius: designTokens.radius.sm,
                    cursor: 'pointer'
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: designTokens.colors.border.default, margin: '0 6px' }} />

          {/* Text Align Buttons */}
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${designTokens.colors.border.default}`, borderRadius: designTokens.radius.sm, overflow: 'hidden', backgroundColor: designTokens.colors.background.input }}>
            <button
              onClick={() => updateSelectedElement({ text_align: 'left' })}
              style={{
                width: '28px',
                height: '28px',
                padding: '0',
                border: 'none',
                borderRight: `1px solid ${designTokens.colors.border.default}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedElement.text_align === 'left' ? designTokens.colors.accent.lime : 'transparent',
                transition: 'all 0.15s ease',
                color: selectedElement.text_align === 'left' ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
              }}
              onMouseEnter={(e) => {
                if (selectedElement.text_align !== 'left') {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.layer2;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedElement.text_align !== 'left') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title="Align Left"
            >
              <AlignLeft size={14} />
            </button>
            <button
              onClick={() => updateSelectedElement({ text_align: 'center' })}
              style={{
                width: '28px',
                height: '28px',
                padding: '0',
                border: 'none',
                borderRight: `1px solid ${designTokens.colors.border.default}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedElement.text_align === 'center' ? designTokens.colors.accent.lime : 'transparent',
                transition: 'all 0.15s ease',
                color: selectedElement.text_align === 'center' ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
              }}
              onMouseEnter={(e) => {
                if (selectedElement.text_align !== 'center') {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.layer2;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedElement.text_align !== 'center') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title="Align Center"
            >
              <AlignCenter size={14} />
            </button>
            <button
              onClick={() => updateSelectedElement({ text_align: 'right' })}
              style={{
                width: '28px',
                height: '28px',
                padding: '0',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedElement.text_align === 'right' ? designTokens.colors.accent.lime : 'transparent',
                transition: 'all 0.15s ease',
                color: selectedElement.text_align === 'right' ? designTokens.colors.text.inverse : designTokens.colors.text.secondary
              }}
              onMouseEnter={(e) => {
                if (selectedElement.text_align !== 'right') {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.layer2;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedElement.text_align !== 'right') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title="Align Right"
            >
              <AlignRight size={14} />
            </button>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', margin: '0 6px' }} />

          {/* Link - IMG.LY Style */}
          <button
            style={{
              width: '28px',
              height: '28px',
              padding: '0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
              color: '#6B7280'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
            title="Add Link"
          >
            <LinkIcon size={14} />
          </button>
        </div>
      )}

          <div
            ref={previewContainerRef}
            onDoubleClick={handleDoubleClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseDown={handleCanvasPanStart}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
                backgroundColor: designTokens.colors.background.layer2,
                borderRadius: designTokens.radius.lg,
                border: `1px solid ${designTokens.colors.border.default}`,
                boxShadow: designTokens.shadow.card,
              overflow: 'hidden',
                cursor: isPanning ? 'text' : 'default',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }}
          >
            <div style={{
              position: 'relative',
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel / 100})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.2s ease'
            }}>
            <img
              src={imageUrl}
              alt="Preview"
              onLoad={(e) => {
                setPreviewImageSize({
                  width: e.target.naturalWidth,
                  height: e.target.naturalHeight
                });
              }}
              style={{
                width: previewImageSize.width > 0 ? `${previewImageSize.width * 0.4}px` : 'auto',
                height: previewImageSize.height > 0 ? `${previewImageSize.height * 0.4}px` : 'auto',
                display: 'block',
                objectFit: 'contain'
              }}
              draggable={false}
            />
            
            {/* Render all text elements */}
            {textElements.map((element) => {
              const isSelected = element.id === selectedElementId;
              const fontSize = element.font_size * 0.4;
              const width = element.width || 300;
              const height = element.height || 100;
              const rotation = element.rotation || 0;
              
              return (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left: `${(element.position[0] / previewImageSize.width) * 100}%`,
                    top: `${(element.position[1] / previewImageSize.height) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    cursor: isSelected ? 'move' : 'pointer',
                    zIndex: isSelected ? 20 : 10,
                    width: `${(width / previewImageSize.width) * 100}%`,
                    maxWidth: `${width}px`,
                    minHeight: `${height}px`
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingText(true);
                  }}
                >
                {/* Selection border - IMG.LY Style - Fits actual text bounds */}
                {isSelected && !isEditingText && (
                  <>
                    <div style={{
                      position: 'absolute',
                      left: '-4px',
                      top: '-4px',
                      right: '-4px',
                      bottom: '-4px',
                      border: `2px solid ${designTokens.colors.accent.lime}`,
                      borderRadius: designTokens.radius.md,
                      pointerEvents: 'none',
                      boxShadow: `0 0 0 1px ${designTokens.colors.accent.lime}40`,
                      width: 'calc(100% + 8px)',
                      height: 'calc(100% + 8px)'
                    }} />
                    {/* Resize handles - IMG.LY Style */}
                    {[
                      { position: { top: '-6px', left: '-6px' }, cursor: 'nwse-resize', direction: 'top-left' },
                      { position: { top: '-6px', right: '-6px' }, cursor: 'nesw-resize', direction: 'top-right' },
                      { position: { bottom: '-6px', left: '-6px' }, cursor: 'nesw-resize', direction: 'bottom-left' },
                      { position: { bottom: '-6px', right: '-6px' }, cursor: 'nwse-resize', direction: 'bottom-right' },
                      { position: { top: '-6px', left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize', direction: 'top' },
                      { position: { bottom: '-6px', left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize', direction: 'bottom' },
                      { position: { left: '-6px', top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize', direction: 'left' },
                      { position: { right: '-6px', top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize', direction: 'right' }
                    ].map((handle, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          width: '10px',
                          height: '10px',
                          backgroundColor: designTokens.colors.accent.lime,
                          border: `2px solid ${designTokens.colors.background.layer2}`,
                          borderRadius: designTokens.radius.sm,
                          cursor: handle.cursor,
                          pointerEvents: 'auto',
                          boxShadow: designTokens.shadow.subtle,
                          transition: 'all 0.15s ease',
                          ...handle.position
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                          e.currentTarget.style.transform = 'scale(1.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onMouseDown={(e) => handleResizeMouseDown(e, element.id, handle.direction)}
                      />
                    ))}
                    {/* Rotate handle - IMG.LY Style */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '-26px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '18px',
                        height: '18px',
                        backgroundColor: designTokens.colors.accent.lime,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'grab',
                        pointerEvents: 'auto',
                        border: `2px solid ${designTokens.colors.background.layer2}`,
                        boxShadow: designTokens.shadow.subtle,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                        e.currentTarget.style.transform = 'translateX(-50%) scale(1.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                        e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                      }}
                      onMouseDown={(e) => handleRotateMouseDown(e, element.id)}
                    >
                      <RotateCw size={10} color="#FFFFFF" />
                    </div>
                  </>
                )}
                
                {/* Editable text */}
                {isEditingText && isSelected ? (
                  <div
                    ref={activeEditableRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const newText = e.target.innerHTML;
                      updateSelectedElement({ text: newText });
                    }}
                    onBlur={(e) => {
                      setIsEditingText(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setIsEditingText(false);
                      }
                      if (e.key === 'Escape') {
                        setIsEditingText(false);
                      }
                      // Handle delete key (only when not editing text content)
                      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteElement();
                      }
                      // Handle rich text commands
                      if (e.ctrlKey || e.metaKey) {
                        if (e.key === 'b') {
                          e.preventDefault();
                          document.execCommand('bold', false, null);
                        } else if (e.key === 'i') {
                          e.preventDefault();
                          document.execCommand('italic', false, null);
                        } else if (e.key === 'u') {
                          e.preventDefault();
                          document.execCommand('underline', false, null);
                        }
                      }
                    }}
                    dangerouslySetInnerHTML={{ __html: element.text }}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: element.font_name,
                      fontWeight: element.font_weight,
                      fontStyle: element.font_style || 'normal',
                      textDecoration: element.text_decoration || 'none',
                      color: element.color,
                      WebkitTextStroke: `${element.stroke_width || 0}px ${element.stroke_color || '#000000'}`,
                      textShadow: element.shadow_enabled ? `${element.shadow_offset_x || 0}px ${element.shadow_offset_y || 0}px ${element.shadow_blur || 0}px ${element.shadow_color || '#000000'}` : 'none',
                      backgroundColor: element.background_color === 'transparent' ? 'transparent' : element.background_color || 'transparent',
                      opacity: (element.opacity !== undefined ? element.opacity : 100) / 100,
                      letterSpacing: `${element.letter_spacing || 0}px`,
                      lineHeight: element.line_height || 1.2,
                      outline: 'none',
                      border: 'none',
                      textAlign: element.text_align || 'center',
                      whiteSpace: width < 200 ? 'nowrap' : 'normal',
                      wordBreak: 'break-word',
                      userSelect: 'text',
                      width: '100%',
                      minHeight: '1em',
                      padding: element.background_color && element.background_color !== 'transparent' ? '4px 8px' : '0',
                      borderRadius: element.background_color && element.background_color !== 'transparent' ? '4px' : '0'
                    }}
                  />
                ) : (
                  <div 
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: element.font_name,
                      fontWeight: element.font_weight,
                      fontStyle: element.font_style || 'normal',
                      textDecoration: element.text_decoration || 'none',
                      color: element.color,
                      WebkitTextStroke: `${element.stroke_width || 0}px ${element.stroke_color || '#000000'}`,
                      textShadow: element.shadow_enabled ? `${element.shadow_offset_x || 0}px ${element.shadow_offset_y || 0}px ${element.shadow_blur || 0}px ${element.shadow_color || '#000000'}` : 'none',
                      backgroundColor: element.background_color === 'transparent' ? 'transparent' : element.background_color || 'transparent',
                      opacity: (element.opacity !== undefined ? element.opacity : 100) / 100,
                      letterSpacing: `${element.letter_spacing || 0}px`,
                      lineHeight: element.line_height || 1.2,
                      pointerEvents: 'none',
                      whiteSpace: width < 200 ? 'nowrap' : 'normal',
                      wordBreak: 'break-word',
                      userSelect: 'none',
                      textAlign: element.text_align || 'center',
                      padding: element.background_color && element.background_color !== 'transparent' ? '4px 8px' : '0',
                      borderRadius: element.background_color && element.background_color !== 'transparent' ? '4px' : '0'
                    }}
                    dangerouslySetInnerHTML={{ __html: element.text }}
                  />
                )}
                </div>
              );
            })}
            </div>
            
            {/* Zoom Controls - Bottom Right */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: designTokens.colors.background.layer1,
              border: `1px solid ${designTokens.colors.border.default}`,
              borderRadius: designTokens.radius.lg,
              padding: '4px',
              boxShadow: designTokens.shadow.card,
              zIndex: 100
            }}>
              <button
                onClick={handleZoomOut}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: '0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                  e.currentTarget.style.color = designTokens.colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = designTokens.colors.text.secondary;
                }}
                title="Zoom Out"
              >
                <ZoomOut size={18} style={{ color: designTokens.colors.text.secondary }} />
              </button>
              <button
                onClick={handleZoomReset}
                style={{
                  minWidth: '48px',
                  height: '32px',
                  padding: '0 8px',
                  border: 'none',
                  borderRadius: designTokens.radius.sm,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  transition: 'all 0.2s',
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.medium,
                  color: designTokens.colors.text.secondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                  e.currentTarget.style.color = designTokens.colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = designTokens.colors.text.secondary;
                }}
                title="Reset Zoom"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: '0',
                  border: 'none',
                  borderRadius: designTokens.radius.sm,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  transition: 'all 0.2s',
                  color: designTokens.colors.text.secondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                  e.currentTarget.style.color = designTokens.colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = designTokens.colors.text.secondary;
                }}
                title="Zoom In"
              >
                <ZoomIn size={18} style={{ color: designTokens.colors.text.secondary }} />
              </button>
            </div>
          </div>
        </div>

          {/* Right Sidebar */}
        <div style={{
            width: '380px',
            backgroundColor: designTokens.colors.background.layer1,
            borderLeft: `1px solid ${designTokens.colors.border.default}`,
          display: 'flex',
          flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Sidebar Header */}
          <div style={{
              borderBottom: `1px solid ${designTokens.colors.border.default}`,
              padding: '20px',
            display: 'flex',
              flexDirection: 'column',
              gap: '12px'
          }}>
              {/* AI Design Button */}
            {campaignData ? (
              <button
                onClick={handleGenerateAiOverlay}
                disabled={loadingAiText}
                style={{
                    width: '100%',
                    padding: '12px 20px',
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                    color: designTokens.colors.text.inverse,
                    backgroundColor: designTokens.colors.accent.lime,
                  border: 'none',
                    borderRadius: designTokens.radius.full,
                  cursor: loadingAiText ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                    justifyContent: 'center',
                  gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: designTokens.shadow.subtle
                }}
                onMouseEnter={(e) => {
                  if (!loadingAiText) {
                      e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loadingAiText) {
                      e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {loadingAiText ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>Analyzing Image...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>AI Design</span>
                  </>
                )}
              </button>
            ) : null}
            
              {/* Add Text Button */}
            <button
              onClick={handleApply}
              disabled={loadingOverlay}
              style={{
                  width: '100%',
                  padding: '10px 20px',
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.medium,
                  color: designTokens.colors.text.secondary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${designTokens.colors.border.default}`,
                  borderRadius: designTokens.radius.full,
                cursor: loadingOverlay ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loadingOverlay) {
                    e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                    e.currentTarget.style.borderColor = designTokens.colors.border.subtle;
                    e.currentTarget.style.color = designTokens.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingOverlay) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = designTokens.colors.border.default;
                    e.currentTarget.style.color = designTokens.colors.text.secondary;
                }
              }}
            >
              <Type size={16} />
              <span>Add Text Manually</span>
              </button>
          </div>

          {/* AI Generation Info Banner - Shows when AI elements are generated */}
          {aiGenerationInfo && (
            <div style={{
              backgroundColor: '#EFF6FF',
              borderBottom: '1px solid #BFDBFE',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={14} color="#FFFFFF" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#1E40AF', marginBottom: '2px' }}>
                  ✨ Advanced AI Design Generated
                </div>
                <div style={{ color: '#3B82F6', fontSize: '11px' }}>
                  {aiGenerationInfo.elements_generated} elements • Template: {aiGenerationInfo.template} • Quality: {aiGenerationInfo.quality_score}
                </div>
              </div>
              <button
                onClick={() => setAiGenerationInfo(null)}
                style={{
                  width: '20px',
                  height: '20px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3B82F6'
                }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}

            {/* Tabs */}
          <div style={{
              borderBottom: `1px solid ${designTokens.colors.border.default}`,
              display: 'flex',
              backgroundColor: designTokens.colors.background.layer1
          }}>
              <button
              onClick={() => setActiveTab('edit')}
              style={{
                flex: 1,
                  padding: '12px',
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.semibold,
                  color: activeTab === 'edit' ? designTokens.colors.text.primary : designTokens.colors.text.tertiary,
                textAlign: 'center',
                cursor: 'pointer',
                  borderBottom: activeTab === 'edit' ? `2px solid ${designTokens.colors.accent.lime}` : '2px solid transparent',
                  transition: 'all 0.2s',
                  backgroundColor: 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'edit') {
                    e.currentTarget.style.color = designTokens.colors.text.secondary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'edit') {
                    e.currentTarget.style.color = designTokens.colors.text.tertiary;
                }
              }}
            >
              EDIT
              </button>
              <button
              onClick={() => setActiveTab('layers')}
              style={{
                flex: 1,
                  padding: '12px',
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.semibold,
                  color: activeTab === 'layers' ? designTokens.colors.text.primary : designTokens.colors.text.tertiary,
                textAlign: 'center',
                cursor: 'pointer',
                  borderBottom: activeTab === 'layers' ? `2px solid ${designTokens.colors.accent.lime}` : '2px solid transparent',
                  transition: 'all 0.2s',
                  backgroundColor: 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'layers') {
                    e.currentTarget.style.color = designTokens.colors.text.secondary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'layers') {
                    e.currentTarget.style.color = designTokens.colors.text.tertiary;
                }
              }}
            >
              LAYERS
              </button>
          </div>

          {/* Content */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            {activeTab === 'layers' ? (
              <>
                {/* Layers List */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                      marginBottom: '16px'
                  }}>
                    <div style={{
                        fontSize: designTokens.typography.fontSize.sm,
                        fontWeight: designTokens.typography.fontWeight.semibold,
                        color: designTokens.colors.text.primary
                    }}>
                      Text Layers ({textElements.length})
                      {textElements.some(el => el.ai_generated) && (
                        <span style={{
                          marginLeft: '8px',
                            fontSize: designTokens.typography.fontSize.xs,
                            fontWeight: designTokens.typography.fontWeight.medium,
                            color: designTokens.colors.accent.lime,
                            backgroundColor: designTokens.colors.accent.lime + '20',
                            padding: '4px 8px',
                            borderRadius: designTokens.radius.full
                        }}>
                          {textElements.filter(el => el.ai_generated).length} AI Generated
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleApply}
                      style={{
                          padding: '8px 16px',
                          fontSize: designTokens.typography.fontSize.xs,
                          fontWeight: designTokens.typography.fontWeight.medium,
                          color: designTokens.colors.text.secondary,
                          backgroundColor: 'transparent',
                          border: `1px solid ${designTokens.colors.border.default}`,
                          borderRadius: designTokens.radius.md,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                          gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                          e.currentTarget.style.borderColor = designTokens.colors.border.subtle;
                          e.currentTarget.style.color = designTokens.colors.text.primary;
                      }}
                      onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = designTokens.colors.border.default;
                          e.currentTarget.style.color = designTokens.colors.text.secondary;
                      }}
                      title="Add another text layer"
                    >
                      <Plus size={14} />
                      Add Layer
                    </button>
                  </div>
                  {textElements.length === 0 ? (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: designTokens.colors.text.tertiary,
                      fontSize: designTokens.typography.fontSize.sm
                    }}>
                      No text layers yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {textElements.map((element, idx) => (
                        <div
                          key={element.id}
                          draggable
                          onDragStart={(e) => handleLayerDragStart(e, idx)}
                          onDragOver={(e) => handleLayerDragOver(e, idx)}
                          onDragEnd={handleLayerDragEnd}
                          onClick={() => setSelectedElementId(element.id)}
                          style={{
                            padding: '14px',
                            border: `2px solid ${selectedElementId === element.id ? designTokens.colors.accent.lime : designTokens.colors.border.default}`,
                            borderRadius: designTokens.radius.md,
                            cursor: 'pointer',
                            backgroundColor: dragOverLayerIndex === idx 
                              ? designTokens.colors.accent.lime + '10' 
                              : (selectedElementId === element.id 
                                ? designTokens.colors.accent.lime + '10' 
                                : designTokens.colors.background.input),
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            opacity: draggedLayerIndex === idx ? 0.5 : 1,
                            boxShadow: selectedElementId === element.id ? designTokens.shadow.subtle : 'none'
                          }}
                        >
                          <GripVertical size={16} style={{ cursor: 'grab', color: designTokens.colors.text.tertiary }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '6px'
                            }}>
                              <div style={{
                                fontSize: designTokens.typography.fontSize.xs,
                                fontWeight: designTokens.typography.fontWeight.semibold,
                                color: selectedElementId === element.id ? designTokens.colors.text.primary : designTokens.colors.text.secondary
                              }}>
                                Layer {idx + 1}
                              </div>
                              {element.ai_generated && (
                                <div style={{
                                  fontSize: designTokens.typography.fontSize.xs,
                                  fontWeight: designTokens.typography.fontWeight.semibold,
                                  color: designTokens.colors.accent.lime,
                                  backgroundColor: designTokens.colors.accent.lime + '20',
                                  padding: '2px 8px',
                                  borderRadius: designTokens.radius.sm,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <Sparkles size={10} />
                                  AI
                                </div>
                              )}
                            </div>
                            <div style={{
                              fontSize: designTokens.typography.fontSize.sm,
                              fontWeight: designTokens.typography.fontWeight.medium,
                              color: selectedElementId === element.id ? designTokens.colors.text.primary : designTokens.colors.text.secondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {element.text || 'Empty text'}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (element.id === selectedElementId) {
                                setSelectedElementId(null);
                              }
                              setTextElements(prev => prev.filter(el => el.id !== element.id));
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
                              padding: '0',
                              border: 'none',
                              borderRadius: designTokens.radius.sm,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'transparent',
                              transition: 'all 0.2s',
                              color: designTokens.colors.text.tertiary
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = designTokens.colors.error + '20';
                              e.currentTarget.style.color = designTokens.colors.error;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = designTokens.colors.text.tertiary;
                            }}
                            title="Delete layer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : selectedElement ? (
              <>
                {/* AI Generation Badge - Show if element is AI-generated */}
                {selectedElement.ai_generated && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '10px 12px',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px'
                  }}>
                    <Sparkles size={16} color="#3B82F6" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1E40AF', marginBottom: '2px' }}>
                        AI-Generated Element
                      </div>
                      <div style={{ color: '#3B82F6', fontSize: '11px' }}>
                        {selectedElement.template_id ? `Template: ${selectedElement.template_id}` : 'Optimized placement & styling'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Input */}
                <div style={{ marginBottom: '24px' }}>
                  <input
                    type="text"
                    value={selectedElement.text}
                    onChange={(e) => updateSelectedElement({ text: e.target.value })}
                    placeholder="Add Heading Text"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: designTokens.colors.background.input,
                      border: `1px solid ${designTokens.colors.border.default}`,
                      borderRadius: designTokens.radius.md,
                      color: designTokens.colors.text.primary,
                      fontSize: designTokens.typography.fontSize.sm,
                      fontFamily: designTokens.typography.fontFamily.sans,
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = designTokens.colors.border.default;
                    }}
                  />
                </div>

                {/* Font Section */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                    color: designTokens.colors.text.primary,
                    marginBottom: '12px',
                    display: 'block'
                    }}>
                      Font
                    </label>
                  
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedElement.font_name}
                      onChange={(e) => updateSelectedElement({ font_name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: designTokens.typography.fontSize.sm,
                        fontWeight: designTokens.typography.fontWeight.medium,
                        color: designTokens.colors.text.primary,
                        backgroundColor: designTokens.colors.background.input,
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        cursor: 'pointer',
                        fontFamily: designTokens.typography.fontFamily.sans,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.border.default;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {googleFonts.map((font, idx) => (
                        <option key={idx} value={font.family} style={{ backgroundColor: designTokens.colors.background.input, color: designTokens.colors.text.primary }}>{font.display}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Color Section */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                    color: designTokens.colors.text.primary,
                    marginBottom: '12px',
                    display: 'block'
                  }}>
                    Text Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selectedElement.color || designTokens.colors.text.primary}
                      onChange={(e) => updateSelectedElement({ color: e.target.value })}
                      style={{
                        width: '50px',
                        height: '40px',
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        cursor: 'pointer',
                        padding: '2px',
                        backgroundColor: designTokens.colors.background.input
                      }}
                    />
                    <input
                      type="text"
                      value={selectedElement.color || designTokens.colors.text.primary}
                      onChange={(e) => updateSelectedElement({ color: e.target.value })}
                      placeholder={designTokens.colors.text.primary}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        fontSize: designTokens.typography.fontSize.xs,
                        fontFamily: 'monospace',
                        backgroundColor: designTokens.colors.background.input,
                        color: designTokens.colors.text.primary,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.border.default;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Stroke/Outline Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{
                      fontSize: designTokens.typography.fontSize.sm,
                      fontWeight: designTokens.typography.fontWeight.semibold,
                      color: designTokens.colors.text.primary,
                      margin: 0
                    }}>
                      Outline
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(selectedElement.stroke_width || 0) > 0}
                        onChange={(e) => updateSelectedElement({ stroke_width: e.target.checked ? 2 : 0 })}
                        style={{ 
                          cursor: 'pointer',
                          width: '16px',
                          height: '16px',
                          accentColor: designTokens.colors.accent.lime
                        }}
                      />
                      <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary }}>Enable</span>
                    </label>
                  </div>
                  {(selectedElement.stroke_width || 0) > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={selectedElement.stroke_width || 0}
                        onChange={(e) => updateSelectedElement({ stroke_width: parseInt(e.target.value) || 0 })}
                        style={{
                          width: '80px',
                          padding: '10px',
                          border: `1px solid ${designTokens.colors.border.default}`,
                          borderRadius: designTokens.radius.md,
                          fontSize: designTokens.typography.fontSize.xs,
                          backgroundColor: designTokens.colors.background.input,
                          color: designTokens.colors.text.primary,
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        placeholder="Width"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = designTokens.colors.border.default;
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <input
                        type="color"
                        value={selectedElement.stroke_color || designTokens.colors.text.primary}
                        onChange={(e) => updateSelectedElement({ stroke_color: e.target.value })}
                        style={{
                          width: '50px',
                          height: '40px',
                          border: `1px solid ${designTokens.colors.border.default}`,
                          borderRadius: designTokens.radius.md,
                          cursor: 'pointer',
                          backgroundColor: designTokens.colors.background.input
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Shadow Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{
                      fontSize: designTokens.typography.fontSize.sm,
                      fontWeight: designTokens.typography.fontWeight.semibold,
                      color: designTokens.colors.text.primary,
                      margin: 0
                    }}>
                      Shadow
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedElement.shadow_enabled || false}
                        onChange={(e) => updateSelectedElement({ shadow_enabled: e.target.checked })}
                        style={{ 
                          cursor: 'pointer',
                          width: '16px',
                          height: '16px',
                          accentColor: designTokens.colors.accent.lime
                        }}
                      />
                      <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary }}>Enable</span>
                    </label>
                  </div>
                  {(selectedElement.shadow_enabled || false) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '80px' }}>Color:</label>
                        <input
                          type="color"
                          value={selectedElement.shadow_color || designTokens.colors.text.primary}
                          onChange={(e) => updateSelectedElement({ shadow_color: e.target.value })}
                          style={{
                            width: '50px',
                            height: '40px',
                            border: `1px solid ${designTokens.colors.border.default}`,
                            borderRadius: designTokens.radius.md,
                            cursor: 'pointer',
                            backgroundColor: designTokens.colors.background.input
                          }}
                        />
                        <input
                          type="text"
                          value={selectedElement.shadow_color || designTokens.colors.text.primary}
                          onChange={(e) => updateSelectedElement({ shadow_color: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            border: `1px solid ${designTokens.colors.border.default}`,
                            borderRadius: designTokens.radius.md,
                            fontSize: designTokens.typography.fontSize.xs,
                            fontFamily: 'monospace',
                            backgroundColor: designTokens.colors.background.input,
                            color: designTokens.colors.text.primary,
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                            e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = designTokens.colors.border.default;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '80px' }}>Blur:</label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={selectedElement.shadow_blur || 10}
                          onChange={(e) => updateSelectedElement({ shadow_blur: parseInt(e.target.value) })}
                          style={{ 
                            flex: 1,
                            accentColor: designTokens.colors.accent.lime
                          }}
                        />
                        <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '40px', textAlign: 'right' }}>
                          {selectedElement.shadow_blur || 10}px
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '80px' }}>X Offset:</label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={selectedElement.shadow_offset_x || 0}
                          onChange={(e) => updateSelectedElement({ shadow_offset_x: parseInt(e.target.value) })}
                          style={{ 
                            flex: 1,
                            accentColor: designTokens.colors.accent.lime
                          }}
                        />
                        <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '40px', textAlign: 'right' }}>
                          {selectedElement.shadow_offset_x || 0}px
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '80px' }}>Y Offset:</label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={selectedElement.shadow_offset_y || 0}
                          onChange={(e) => updateSelectedElement({ shadow_offset_y: parseInt(e.target.value) })}
                          style={{ 
                            flex: 1,
                            accentColor: designTokens.colors.accent.lime
                          }}
                        />
                        <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '40px', textAlign: 'right' }}>
                          {selectedElement.shadow_offset_y || 0}px
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Background Color Section */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                    color: designTokens.colors.text.primary,
                    marginBottom: '12px',
                    display: 'block'
                  }}>
                    Background
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selectedElement.background_color === 'transparent' ? designTokens.colors.background.layer2 : (selectedElement.background_color || designTokens.colors.background.layer2)}
                      onChange={(e) => updateSelectedElement({ background_color: e.target.value })}
                      style={{
                        width: '50px',
                        height: '40px',
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        cursor: 'pointer',
                        padding: '2px',
                        backgroundColor: designTokens.colors.background.input
                      }}
                    />
                    <input
                      type="text"
                      value={selectedElement.background_color || 'transparent'}
                      onChange={(e) => updateSelectedElement({ background_color: e.target.value === '' ? 'transparent' : e.target.value })}
                      placeholder="transparent"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        fontSize: designTokens.typography.fontSize.xs,
                        fontFamily: 'monospace',
                        backgroundColor: designTokens.colors.background.input,
                        color: designTokens.colors.text.primary,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.accent.lime;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${designTokens.colors.accent.lime}20`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = designTokens.colors.border.default;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      onClick={() => updateSelectedElement({ background_color: 'transparent' })}
                      style={{
                        padding: '8px 16px',
                        border: `1px solid ${designTokens.colors.border.default}`,
                        borderRadius: designTokens.radius.md,
                        fontSize: designTokens.typography.fontSize.xs,
                        fontWeight: designTokens.typography.fontWeight.medium,
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        color: designTokens.colors.text.secondary,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                        e.currentTarget.style.borderColor = designTokens.colors.border.subtle;
                        e.currentTarget.style.color = designTokens.colors.text.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = designTokens.colors.border.default;
                        e.currentTarget.style.color = designTokens.colors.text.secondary;
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Advanced Styling Section */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.semibold,
                    color: designTokens.colors.text.primary,
                    marginBottom: '12px',
                    display: 'block'
                  }}>
                    Advanced
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '120px' }}>Opacity:</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedElement.opacity !== undefined ? selectedElement.opacity : 100}
                        onChange={(e) => updateSelectedElement({ opacity: parseInt(e.target.value) })}
                        style={{ 
                          flex: 1,
                          accentColor: designTokens.colors.accent.lime
                        }}
                      />
                      <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '50px', textAlign: 'right' }}>
                        {selectedElement.opacity !== undefined ? selectedElement.opacity : 100}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '120px' }}>Letter Spacing:</label>
                      <input
                        type="range"
                        min="-5"
                        max="20"
                        value={selectedElement.letter_spacing || 0}
                        onChange={(e) => updateSelectedElement({ letter_spacing: parseInt(e.target.value) })}
                        style={{ 
                          flex: 1,
                          accentColor: designTokens.colors.accent.lime
                        }}
                      />
                      <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '50px', textAlign: 'right' }}>
                        {selectedElement.letter_spacing || 0}px
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '120px' }}>Line Height:</label>
                      <input
                        type="range"
                        min="0.8"
                        max="3"
                        step="0.1"
                        value={selectedElement.line_height || 1.2}
                        onChange={(e) => updateSelectedElement({ line_height: parseFloat(e.target.value) })}
                        style={{ 
                          flex: 1,
                          accentColor: designTokens.colors.accent.lime
                        }}
                      />
                      <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.text.secondary, width: '50px', textAlign: 'right' }}>
                        {selectedElement.line_height ? selectedElement.line_height.toFixed(1) : '1.2'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: designTokens.typography.fontSize.sm,
                color: designTokens.colors.text.secondary,
                marginBottom: '8px',
                fontWeight: designTokens.typography.fontWeight.medium
              }}>
                {textElements.length === 0 ? 'No text layers yet' : 'No text selected'}
              </p>
              <p style={{
                fontSize: designTokens.typography.fontSize.xs,
                color: designTokens.colors.text.tertiary,
                marginBottom: '12px',
                lineHeight: 1.5
              }}>
                {textElements.length === 0 
                  ? 'Double-click on the canvas or click "Add Text" to add your first layer'
                  : 'Click on a text layer or double-click the canvas to add another layer'}
              </p>
              {textElements.length > 0 && (
                <p style={{
                  fontSize: designTokens.typography.fontSize.xs,
                  color: designTokens.colors.text.tertiary,
                  fontStyle: 'italic'
                }}>
                  You have {textElements.length} layer{textElements.length !== 1 ? 's' : ''} - add more anytime!
                </p>
              )}
            </div>
          )}
        </div>

          {/* Footer Actions */}
          <div style={{
            padding: '16px',
            borderTop: `1px solid ${designTokens.colors.border.default}`,
            backgroundColor: designTokens.colors.background.layer1,
            display: 'flex',
            gap: '8px'
          }}>
            <button
              onClick={handleApply}
              disabled={loadingOverlay}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
                color: designTokens.colors.text.secondary,
                backgroundColor: 'transparent',
                border: `1px solid ${designTokens.colors.border.default}`,
                borderRadius: designTokens.radius.full,
                cursor: loadingOverlay ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: designTokens.typography.fontFamily.sans
              }}
              onMouseEnter={(e) => {
                if (!loadingOverlay) {
                  e.currentTarget.style.backgroundColor = designTokens.colors.background.input;
                  e.currentTarget.style.borderColor = designTokens.colors.border.subtle;
                  e.currentTarget.style.color = designTokens.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingOverlay) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = designTokens.colors.border.default;
                  e.currentTarget.style.color = designTokens.colors.text.secondary;
                }
              }}
            >
              Apply
            </button>
            <button
              onClick={handleSave}
              disabled={loadingOverlay || textElements.length === 0}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.semibold,
                color: designTokens.colors.text.inverse,
                backgroundColor: loadingOverlay || textElements.length === 0 ? designTokens.colors.text.tertiary : designTokens.colors.accent.lime,
                border: 'none',
                borderRadius: designTokens.radius.full,
                cursor: loadingOverlay || textElements.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: designTokens.typography.fontFamily.sans,
                boxShadow: designTokens.shadow.subtle
              }}
              onMouseEnter={(e) => {
                if (!loadingOverlay && textElements.length > 0) {
                  e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingOverlay && textElements.length > 0) {
                  e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loadingOverlay ? 'Saving...' : 'Save'}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextOverlayModal;
