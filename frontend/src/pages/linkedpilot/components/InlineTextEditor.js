import React, { useRef, useEffect, useState } from 'react';

/**
 * InlineTextEditor - HTML input overlay positioned over Konva text for native editing
 * Follows Canva/Adobe Express pattern: Double-click OR Enter key to edit
 */
const InlineTextEditor = ({ 
  textElement, 
  stageRef, 
  containerRef,
  isEditing, 
  onTextChange, 
  onBlur,
  onCancel,
  zoomLevel = 100,
  panPosition = { x: 0, y: 0 }
}) => {
  const inputRef = useRef(null);
  const [inputStyle, setInputStyle] = useState({});
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    if (!isEditing || !textElement || !stageRef.current || !containerRef.current) return;

    const stage = stageRef.current.getStage();
    if (!stage) return;

    // Find the text node in the stage
    const textNode = stage.findOne(`#${textElement.id}`);
    if (!textNode) return;

    // Get stage container position
    const stageContainer = stage.container();
    const containerRect = containerRef.current.getBoundingClientRect();
    const stageRect = stageContainer.getBoundingClientRect();

    // Calculate absolute position accounting for zoom and pan
    const scale = zoomLevel / 100;
    const absPos = textNode.getAbsolutePosition();
    
    // Account for stage position relative to container
    const stageX = stageRect.left - containerRect.left;
    const stageY = stageRect.top - containerRect.top;
    
    // Calculate input position (account for stage offset and zoom)
    const inputX = stageX + (absPos.x * scale);
    const inputY = stageY + (absPos.y * scale);
    
    // Get text metrics for sizing
    const textWidth = textElement.width || 400;
    const textHeight = textElement.height || 100;
    const fontSize = (textElement.fontSize || 72) * scale;
    
    // Determine if text should be multiline
    const textLines = (textElement.text || '').split('\n');
    setIsMultiline(textLines.length > 1 || textWidth > 500);

    // Match all text properties
    const style = {
      position: 'absolute',
      left: `${inputX}px`,
      top: `${inputY}px`,
      width: `${textWidth * scale}px`,
      minHeight: `${fontSize * 1.2}px`,
      fontSize: `${fontSize}px`,
      fontFamily: textElement.fontFamily || 'Poppins',
      fontWeight: parseInt(textElement.fontStyle?.split(' ')[1]) || 400,
      fontStyle: textElement.fontStyle?.includes('italic') ? 'italic' : 'normal',
      color: textElement.fill || '#000000',
      textAlign: textElement.align || 'left',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '2px solid #00FF00',
      borderRadius: '4px',
      padding: '4px 8px',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      lineHeight: textElement.lineHeight || 1.2,
      letterSpacing: `${textElement.letterSpacing || 0}px`,
      opacity: textElement.opacity || 1,
      transform: textElement.rotation ? `rotate(${textElement.rotation}deg)` : 'none',
      transformOrigin: 'top left',
      zIndex: 10000,
      boxSizing: 'border-box',
      wordWrap: 'break-word',
      whiteSpace: isMultiline ? 'pre-wrap' : 'nowrap',
    };

    setInputStyle(style);

    // Focus input after positioning
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Select all text for easy replacement
        inputRef.current.select();
      }
    }, 10);
  }, [isEditing, textElement, stageRef, containerRef, zoomLevel, panPosition, isMultiline]);

  // Handle keyboard events
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCancel) {
          onCancel();
        }
      }
      // Enter to save (if not multiline, or Shift+Enter for new line)
      else if (e.key === 'Enter' && !isMultiline && !e.shiftKey) {
        e.preventDefault();
        if (onBlur) {
          onBlur();
        }
      }
      // Prevent event bubbling to stage
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isMultiline, onBlur, onCancel]);

  if (!isEditing || !textElement) return null;

  return (
    <textarea
      ref={inputRef}
      value={textElement.text || ''}
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
      style={inputStyle}
      rows={isMultiline ? Math.max(2, Math.ceil((textElement.text || '').split('\n').length)) : 1}
      wrap={isMultiline ? 'soft' : 'off'}
      autoFocus
    />
  );
};

export default InlineTextEditor;








