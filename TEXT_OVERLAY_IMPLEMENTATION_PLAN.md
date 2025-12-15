# Text Overlay Module Implementation Plan
## Fixing Duplicate Text & Enabling Editable Baked-In Text
**Date:** December 12, 2025

**Research Sources:**
- **Canva**: Double-click to edit, comprehensive toolbar, lists support, text effects, Magic Write AI
- **Adobe Express**: Enter key OR double-click to edit, Generative Text Edit (non-destructive)
- **Google Photos**: Drag-and-drop positioning, resize handles, background styles
- **Google Pommeli**: In-app editing, brand-aware content generation, simple visual edits, direct interface editing
- **Figma**: Direct canvas editing, seamless integration
- **WCAG Guidelines**: Accessibility best practices (4.5:1 contrast ratio)

---

## Problem Analysis

### Current Issues:
1. **Duplicate Text Bug**: When text overlays are extracted, new editable elements are created ON TOP of the baked-in image text, creating duplicates
2. **Text Not Selectable**: Users cannot click on text that's already rendered in the image to edit it
3. **No Visual Feedback**: No indication of which text regions are editable
4. **Position Inaccuracy**: Backend only returns center positions, not bounding boxes

### Root Cause:
- Text extraction creates NEW overlay elements instead of making existing text editable
- No mechanism to detect and select text regions in the image
- Konva Text nodes aren't natively editable (need HTML input overlay)

### Inspiration from Google Pommeli:
- **In-app editing**: Direct editing within the interface (no external panels)
- **Brand-aware**: Content generation respects brand identity (colors, fonts, tone)
- **Simple visual edits**: Easy cropping, resizing, and text overlay adjustments
- **Streamlined workflow**: Focus on quick, on-brand content creation

### Inspiration from Google Pommeli:
- **In-app editing**: Direct editing within the interface (no external panels)
- **Brand-aware**: Content generation respects brand identity (colors, fonts, tone)
- **Simple visual edits**: Easy cropping, resizing, and text overlay adjustments
- **Streamlined workflow**: Focus on quick, on-brand content creation

---

## Solution Architecture

### Phase 1: Backend Improvements (Text Detection with Bounding Boxes)

#### 1.1 Enhanced Text Extraction API
**File:** `backend/linkedpilot/routes/drafts.py`

**Changes:**
- Modify Gemini Vision prompt to return bounding boxes (x, y, width, height) in pixels
- Include confidence scores for each detected text region
- Return text regions sorted by reading order (top-to-bottom, left-to-right)
- Add flag to indicate if text is "baked-in" (part of image) vs "overlay" (added separately)

**New Response Format:**
```json
{
  "text_regions": [
    {
      "text": "Sample Text",
      "bbox": {
        "x": 100,      // Left edge in pixels
        "y": 50,       // Top edge in pixels
        "width": 300,  // Width in pixels
        "height": 80   // Height in pixels
      },
      "bbox_percent": {
        "x_percent": 8.33,   // Percentage from left (100/1200)
        "y_percent": 4.63,   // Percentage from top (50/1080)
        "width_percent": 25.0, // Percentage of image width
        "height_percent": 7.41  // Percentage of image height
      },
      "font_size": 64,
      "font_family": "Poppins",
      "color": "#FFFFFF",
      "confidence": 0.95,
      "is_baked_in": true,  // True if text is part of image
      "text_align": "left"
    }
  ]
}
```

**Implementation:**
- Use Gemini Vision API with improved prompt for OCR-style detection
- Parse response to extract bounding boxes
- Convert pixel coordinates to percentages for frontend compatibility
- Store both formats for flexibility

#### 1.2 Text Region Detection Endpoint
**New Endpoint:** `POST /api/drafts/detect-text-regions`

**Purpose:** Standalone endpoint to detect text regions in any image

**Request:**
```json
{
  "image_url": "data:image/png;base64,...",
  "detection_mode": "precise" | "fast"
}
```

**Response:** Same format as above

---

### Phase 2: Frontend Text Region Selection

#### 2.1 Text Region Detection Component
**File:** `frontend/src/pages/linkedpilot/components/TextRegionDetector.js`

**Purpose:** Detect and visualize text regions in images

**Features:**
- Load image and detect text regions on mount
- Display semi-transparent overlays over detected text regions
- Highlight regions on hover
- Show bounding boxes with labels
- Allow clicking regions to select them for editing

**Implementation:**
```javascript
const TextRegionDetector = ({ imageUrl, onRegionSelect, detectedRegions }) => {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [regions, setRegions] = useState([]);
  
  // Detect regions on image load
  useEffect(() => {
    detectTextRegions(imageUrl);
  }, [imageUrl]);
  
  // Render semi-transparent overlays for each region
  // Handle click to select region
  // Handle hover to highlight
};
```

#### 2.2 Fix Duplicate Text Prevention
**File:** `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Changes:**
- Check if `initialElements` already contains text at detected positions
- Merge detected regions with existing overlays intelligently
- Prevent duplicate overlays at same/similar positions
- Use bounding box overlap detection (IoU - Intersection over Union)

**Algorithm:**
```javascript
function mergeTextRegions(existing, detected, threshold = 0.3) {
  // For each detected region:
  // 1. Check if it overlaps significantly with existing region
  // 2. If overlap > threshold: Update existing instead of creating new
  // 3. If no overlap: Add as new region
  // 4. Return merged list
}
```

---

### Phase 3: Inline Text Editing

#### 3.1 HTML Input Overlay Component
**File:** `frontend/src/pages/linkedpilot/components/InlineTextEditor.js`

**Purpose:** Provide native HTML text input positioned over Konva text

**Features:**
- Position HTML input exactly over Konva text element
- Match font, size, color, alignment
- Handle transformations (rotation, scale)
- Auto-resize input based on text content
- Handle multiline text
- Sync changes back to Konva element

**Implementation:**
```javascript
const InlineTextEditor = ({ 
  textElement, 
  stageRef, 
  isEditing, 
  onTextChange, 
  onBlur 
}) => {
  const inputRef = useRef();
  const [inputStyle, setInputStyle] = useState({});
  
  useEffect(() => {
    if (isEditing && textElement) {
      // Calculate position relative to stage
      const stageBox = stageRef.current.getStage().getPointerPosition();
      const textNode = stageRef.current.findOne(`#${textElement.id}`);
      
      // Get absolute position accounting for zoom/pan
      const absPos = textNode.getAbsolutePosition();
      const scale = stageRef.current.getStage().scaleX();
      
      // Position input overlay
      setInputStyle({
        position: 'absolute',
        left: absPos.x * scale,
        top: absPos.y * scale,
        fontSize: textElement.fontSize * scale,
        fontFamily: textElement.fontFamily,
        color: textElement.fill,
        // ... match all text properties
      });
    }
  }, [isEditing, textElement]);
  
  return isEditing ? (
    <textarea
      ref={inputRef}
      value={textElement.text}
      onChange={(e) => onTextChange(e.target.value)}
      onBlur={onBlur}
      style={inputStyle}
      autoFocus
    />
  ) : null;
};
```

#### 3.2 Multiple Edit Triggers (Canva/Adobe Express Pattern)
**File:** `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Changes:**
- Add `onDblClick` handler to `EditableText` component (Canva pattern)
- Add `Enter` key handler when element is selected (Adobe Express pattern)
- Add option to disable click-to-edit (user preference - some users find it disruptive)
- Set `isEditing` state for selected element
- Show `InlineTextEditor` when editing
- Hide Konva text while editing (or show placeholder)
- Add visual feedback when entering edit mode

**Implementation:**
```javascript
const EditableText = ({ shapeProps, isSelected, isEditing, onSelect, onEdit, onChange }) => {
  // Handle Enter key to edit (Adobe Express pattern)
  useEffect(() => {
    if (isSelected && !isEditing) {
      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onEdit();
        }
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isSelected, isEditing, onEdit]);

  return (
    <>
      {!isEditing && (
        <KonvaText
          {...shapeProps}
          onDblClick={onEdit}  // Double-click to edit (Canva pattern)
          onClick={onSelect}
          // Visual feedback on hover
          onMouseEnter={(e) => {
            e.target.getStage().container().style.cursor = 'text';
          }}
          onMouseLeave={(e) => {
            e.target.getStage().container().style.cursor = 'default';
          }}
        />
      )}
      {isEditing && (
        // Show placeholder or hide text
        <Rect {...shapeProps} fill="rgba(255,255,255,0.1)" />
      )}
    </>
  );
};
```

**User Preference Setting:**
```javascript
// Add to settings/state
const [clickToEditEnabled, setClickToEditEnabled] = useState(true);

// Conditionally enable double-click
onDblClick={clickToEditEnabled ? onEdit : undefined}
```

---

### Phase 4: Text Masking & Visual Feedback

#### 4.1 Text Region Masking
**Purpose:** Hide original baked-in text when editable overlay is active

**Implementation:**
- When a text region is selected for editing:
  1. Detect the bounding box of the original text in the image
  2. Create a mask/overlay that covers that region
  3. Apply background color matching surrounding area (or blur effect)
  4. Show editable overlay on top

**Method 1: Canvas-based masking**
```javascript
// Create mask layer
const maskLayer = new Konva.Layer();
const maskRect = new Konva.Rect({
  x: bbox.x,
  y: bbox.y,
  width: bbox.width,
  height: bbox.height,
  fill: 'rgba(255,255,255,0.9)', // Match background
  // Or use blur effect
});
maskLayer.add(maskRect);
```

**Method 2: Image processing (more advanced)**
- Use canvas `getImageData` to sample surrounding pixels
- Fill text region with averaged background color
- Apply blur filter for smoother masking

#### 4.2 Visual Feedback for Detected Regions
**Features:**
- Show semi-transparent overlay on detected text regions
- Highlight on hover with border
- Show "Click to edit" tooltip
- Animate selection feedback

**Implementation:**
```javascript
// Add to TextRegionDetector
{regions.map(region => (
  <Konva.Rect
    key={region.id}
    x={region.bbox.x}
    y={region.bbox.y}
    width={region.bbox.width}
    height={region.bbox.height}
    fill={hoveredRegion === region.id ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)'}
    stroke={selectedRegion === region.id ? '#00FF00' : 'transparent'}
    strokeWidth={2}
    onClick={() => onRegionSelect(region)}
    onMouseEnter={() => setHoveredRegion(region.id)}
    onMouseLeave={() => setHoveredRegion(null)}
  />
))}
```

---

### Phase 5: Advanced Features

#### 5.1 Text Region Merging
**Purpose:** Combine overlapping or adjacent text regions intelligently

**Algorithm:**
1. Calculate IoU (Intersection over Union) for all region pairs
2. If IoU > 0.3: Merge regions
3. Combine text content (with space/newline)
4. Expand bounding box to encompass both regions
5. Average font properties

#### 5.2 Smart Text Detection
**Features:**
- Detect text orientation/rotation
- Handle curved text (convert to straight)
- Detect text color from image
- Estimate font family from appearance
- Detect text alignment

#### 5.3 Undo/Redo for Text Editing
- Track text content changes separately from position changes
- Allow undoing text edits without affecting position
- Store text history per element

---

## Implementation Steps

### Step 1: Backend Text Detection Enhancement (Priority: HIGH)
1. Update `drafts.py` text extraction prompt to request bounding boxes
2. Parse bounding box data from Gemini response
3. Add validation for bounding box coordinates
4. Test with various image types

**Files to modify:**
- `backend/linkedpilot/routes/drafts.py` (lines ~2000-2080)

### Step 2: Frontend Duplicate Prevention (Priority: HIGH)
1. Add `mergeTextRegions` utility function
2. Update `TextOverlayModalKonva` to use merge function
3. Add overlap detection (IoU calculation)
4. Test with images containing baked-in text

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

### Step 3: Text Region Detection UI (Priority: MEDIUM)
1. Create `TextRegionDetector` component
2. Add API call to detect text regions
3. Render detection overlays
4. Add click-to-select functionality

**New files:**
- `frontend/src/pages/linkedpilot/components/TextRegionDetector.js`

### Step 4: Inline Text Editing (Priority: HIGH)
1. Create `InlineTextEditor` component
2. Add double-click handler to `EditableText` (Canva pattern)
3. Add Enter key handler when element selected (Adobe Express pattern)
4. Add Escape key to cancel editing
5. Add click-outside-to-save functionality
6. Position HTML input over Konva text
7. Sync changes back to Konva element
8. Add visual feedback when entering edit mode
9. Add user preference to disable click-to-edit

**New files:**
- `frontend/src/pages/linkedpilot/components/InlineTextEditor.js`

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Key Features:**
- Double-click OR Enter key to edit (following Canva/Adobe Express)
- Escape to cancel
- Click outside to save
- Non-destructive editing (overlay only)

### Step 5: Text Masking (Priority: MEDIUM)
1. Implement canvas-based masking
2. Add background color sampling
3. Apply mask when editing text
4. Remove mask when done editing

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

### Step 6: Visual Feedback (Priority: LOW)
1. Add hover effects
2. Add selection highlighting
3. Add tooltips
4. Add animations

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextRegionDetector.js`
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

---

## Best Practices (December 2025)

### 1. OCR/Text Detection
- **Use Gemini 2.5 Flash or Gemini 1.5 Pro** for vision tasks (best accuracy)
- **Request structured JSON** with bounding boxes
- **Include confidence scores** for filtering low-quality detections
- **Handle multiple text orientations** (horizontal, vertical, rotated)

### 2. Canvas Text Editing (Canva/Adobe Express Pattern)
- **Use HTML input overlay** for native editing experience
- **Multiple edit triggers**: Double-click OR Enter key (Adobe Express pattern)
- **Escape to cancel**: Allow users to cancel editing easily
- **Click outside to save**: Intuitive UX pattern
- **Sync styles** between Konva and HTML (font, size, color)
- **Handle transformations** (rotation, scale) when positioning input
- **Debounce updates** to prevent performance issues
- **Non-destructive editing**: Never modify original image, only overlay

### 3. Text Region Selection
- **Use bounding box overlap** (IoU) for duplicate detection
- **Visual feedback** is essential for UX (Canva shows toolbar on selection)
- **Click-to-select** is more intuitive than manual positioning
- **Show detected regions** before editing starts
- **Resize handles**: Visual handles for resizing (Google Photos pattern)
- **User preference**: Option to disable click-to-edit (some users find it disruptive)

### 4. Typography & Formatting (Canva Pattern)
- **Comprehensive toolbar**: Show all formatting options when text is selected
- **Lists support**: Bulleted and numbered lists (Canva feature)
- **Text effects**: Shadows, outlines, curves, 3D effects
- **Background styles**: Solid colors and gradients for text backgrounds (Google Photos)
- **Keyboard shortcuts**: Full set of shortcuts for power users

### 5. Accessibility (WCAG Compliance)
- **Contrast checker**: Ensure 4.5:1 ratio minimum (WCAG AA)
- **High contrast mode**: Option for users with visual impairments
- **Screen reader support**: Proper ARIA labels
- **Keyboard navigation**: Full keyboard accessibility
- **Focus indicators**: Clear focus states for keyboard users
- **Responsive design**: Text overlays adapt to screen sizes

### 6. Performance Optimization
- **Lazy load** text detection (only when needed)
- **Cache detection results** for same image
- **Debounce** text input updates
- **Use requestAnimationFrame** for smooth animations
- **Virtualize** layer list for many elements

### 7. Error Handling
- **Fallback** to manual text addition if detection fails
- **Show error messages** if detection API fails
- **Validate** bounding boxes before rendering
- **Handle edge cases** (no text detected, overlapping text, etc.)
- **Graceful degradation**: Feature works even if advanced features fail

### 8. Brand-Aware Editing (Google Pommeli Pattern)
- **Business DNA Integration**: Use brand profile (colors, fonts, tone) from organization settings
- **Auto-Style**: Automatically apply brand colors/fonts when creating text
- **Brand Consistency**: Ensure all text overlays match brand identity
- **Quick Edits**: Streamlined workflow for on-brand content creation
- **Brand Color Palette**: Quick access to brand colors in text editor
- **AI Suggestions**: Generate text content matching brand tone and voice

---

## Testing Plan

### Unit Tests
1. Test `mergeTextRegions` function with various overlap scenarios
2. Test bounding box calculations (pixels to percentages)
3. Test IoU calculation accuracy

### Integration Tests
1. Test text detection API with various image types
2. Test duplicate prevention with real images
3. Test inline editing with rotated/scaled text

### User Acceptance Tests
1. User can click on baked-in text to edit it
2. No duplicate text appears when editing
3. Text edits are saved correctly
4. Visual feedback is clear and helpful

---

## Timeline Estimate

- **Step 1 (Backend):** 2-3 hours
- **Step 2 (Duplicate Prevention):** 2-3 hours
- **Step 3 (Region Detection UI):** 3-4 hours
- **Step 4 (Inline Editing):** 4-5 hours
- **Step 5 (Text Masking):** 2-3 hours
- **Step 6 (Visual Feedback):** 2-3 hours

**Total:** ~15-21 hours

---

## Success Criteria

1. ✅ Users can click on baked-in text in images to edit it
2. ✅ No duplicate text appears when editing
3. ✅ Text editing feels native and responsive
4. ✅ Visual feedback clearly shows editable regions
5. ✅ Performance is smooth (no lag when editing)
6. ✅ Works with rotated/scaled text
7. ✅ Handles edge cases gracefully

---

## Phase 6: IMG.LY/CE.SDK-Level Improvements

### 6.1 Core Text Formatting (Priority: HIGH)
**Purpose:** Add professional text formatting controls matching Canva/CE.SDK capabilities

**Key Insights from Research:**
- **Canva**: Comprehensive toolbar with font selection, size, color, style (bold/italic/underline/strikethrough)
- **Google Photos**: Background styles for text (solid colors, gradients)
- **Best Practice**: Visual state indicators, keyboard shortcuts, toolbar integration

**Features:**
- **Bold/Italic/Underline/Strikethrough Toggle Buttons** (Canva pattern)
  - Visual state indicators (active/inactive)
  - Toggle font weight (400/700) for bold
  - Toggle italic style
  - Toggle underline decoration
  - Toggle strikethrough decoration
  - Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X (strikethrough)
- **Text Background Styles** (Google Photos pattern)
  - Solid color backgrounds
  - Gradient backgrounds
  - Opacity control
  - Padding control

**Implementation:**
```javascript
// Add to TextOverlayModalKonva sidebar
<div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
  <button
    onClick={() => updateSelectedElement({ 
      font_weight: selectedElement.font_weight === 700 ? 400 : 700 
    })}
    style={{
      padding: '8px 12px',
      backgroundColor: selectedElement.font_weight === 700 ? tokens.colors.accent.lime : tokens.colors.background.input,
      border: `1px solid ${tokens.colors.border.default}`,
      borderRadius: tokens.radius.md,
      cursor: 'pointer'
    }}
  >
    <Bold size={16} />
  </button>
  <button onClick={() => updateSelectedElement({ font_style: selectedElement.font_style === 'italic' ? 'normal' : 'italic' })}>
    <Italic size={16} />
  </button>
  <button onClick={() => updateSelectedElement({ text_decoration: selectedElement.text_decoration === 'underline' ? 'none' : 'underline' })}>
    <Underline size={16} />
  </button>
</div>
```

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

---

### 6.2 Typography Controls Enhancement (Priority: HIGH)
**Purpose:** Add missing typography controls that exist in data but not in UI

**Features:**
- **Letter Spacing Slider** (data exists, needs UI)
- **Line Height Slider** (data exists, needs UI)
- **Text Decoration Options** (underline, strikethrough, none)
- **Font Weight Selector** (100-900, not just toggle)

**Implementation:**
```javascript
// Letter Spacing Control
<div>
  <label>Letter Spacing: {selectedElement.letterSpacing}px</label>
  <input
    type="range"
    min="-5"
    max="20"
    value={selectedElement.letterSpacing}
    onChange={(e) => updateSelectedElement({ letterSpacing: parseInt(e.target.value) })}
  />
</div>

// Line Height Control
<div>
  <label>Line Height: {selectedElement.lineHeight.toFixed(2)}</label>
  <input
    type="range"
    min="0.8"
    max="3.0"
    step="0.1"
    value={selectedElement.lineHeight}
    onChange={(e) => updateSelectedElement({ lineHeight: parseFloat(e.target.value) })}
  />
</div>
```

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

---

### 6.3 Advanced Text Effects (Priority: MEDIUM)
**Purpose:** Add professional text effects matching CE.SDK capabilities

**Features:**
- **Glow Effect**
  - Separate from shadow
  - Color picker for glow color
  - Blur radius control
  - Intensity control

- **Multiple Shadow Layers**
  - Add/remove shadow layers
  - Each layer: color, blur, offset X/Y, opacity
  - Visual preview

- **Text Gradients**
  - Linear gradient support
  - Gradient direction (horizontal, vertical, diagonal)
  - Color stops editor
  - Preview in real-time

- **Text Patterns/Textures**
  - Pattern overlay support
  - Texture library integration
  - Opacity control

**Implementation:**
```javascript
// Glow Effect Section
<div>
  <label>
    <input
      type="checkbox"
      checked={selectedElement.glowEnabled}
      onChange={(e) => updateSelectedElement({ glowEnabled: e.target.checked })}
    />
    Enable Glow
  </label>
  {selectedElement.glowEnabled && (
    <>
      <input
        type="color"
        value={selectedElement.glowColor}
        onChange={(e) => updateSelectedElement({ glowColor: e.target.value })}
      />
      <input
        type="range"
        min="0"
        max="50"
        value={selectedElement.glowBlur}
        onChange={(e) => updateSelectedElement({ glowBlur: parseInt(e.target.value) })}
      />
    </>
  )}
</div>
```

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/TextEffectsPanel.js`

---

### 6.4 Enhanced User Experience (Priority: HIGH)
**Purpose:** Improve UX to match Canva/Adobe Express/Figma standards

**Key Insights from Research:**
- **Canva**: Double-click to edit, comprehensive toolbar appears on selection
- **Adobe Express**: Enter key OR double-click to edit, Escape to cancel
- **Figma**: Direct canvas editing, seamless integration
- **Best Practice**: Non-destructive editing, accessibility (WCAG contrast), responsive design

**Features:**

#### 6.4.1 Keyboard Shortcuts (Enhanced)
- **Ctrl+B**: Toggle bold
- **Ctrl+I**: Toggle italic
- **Ctrl+U**: Toggle underline
- **Delete/Backspace**: Delete selected element
- **Arrow Keys**: Fine positioning (1px increments)
- **Shift + Arrow Keys**: Coarse positioning (10px increments)
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Escape**: Deselect element
- **Enter**: Start editing selected text

**Implementation:**
```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (!selectedElement) return;
    
    // Ctrl+B: Bold
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      updateSelectedElement({ font_weight: selectedElement.font_weight === 700 ? 400 : 700 });
    }
    
    // Arrow keys for positioning
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = {
        'ArrowUp': { y: -step },
        'ArrowDown': { y: step },
        'ArrowLeft': { x: -step },
        'ArrowRight': { x: step }
      }[e.key];
      updateSelectedElement(delta);
    }
    
    // Delete selected element
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText) {
      e.preventDefault();
      handleDeleteElement();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedElement, isEditingText]);
```

#### 6.4.2 Multi-Select
- **Shift+Click**: Add to selection
- **Ctrl+Click**: Toggle selection
- **Select All**: Ctrl+A
- **Group Operations**: Move, delete, style together
- **Alignment Tools**: Align selected elements (left, center, right, top, middle, bottom)

**Implementation:**
```javascript
const [selectedIds, setSelectedIds] = useState([]); // Multiple selection

const handleElementClick = (e, elementId) => {
  if (e.shiftKey || e.ctrlKey) {
    // Multi-select
    setSelectedIds(prev => 
      prev.includes(elementId) 
        ? prev.filter(id => id !== elementId)
        : [...prev, elementId]
    );
  } else {
    // Single select
    setSelectedIds([elementId]);
  }
};

// Alignment tools
const alignElements = (alignment) => {
  const selectedElements = textElements.filter(el => selectedIds.includes(el.id));
  if (selectedElements.length < 2) return;
  
  // Calculate alignment position
  const positions = selectedElements.map(el => ({ x: el.x, y: el.y }));
  const alignedX = alignment.includes('left') ? Math.min(...positions.map(p => p.x)) :
                   alignment.includes('right') ? Math.max(...positions.map(p => p.x)) :
                   positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  
  // Apply alignment
  setTextElements(prev => prev.map(el => 
    selectedIds.includes(el.id) ? { ...el, x: alignedX } : el
  ));
};
```

#### 6.4.3 Visual Polish & Accessibility
- **Smooth Animations**: Transitions for selection, hover, drag
- **Better Visual Feedback**: Enhanced selection highlight, hover effects
- **Professional Toolbar**: Better layout, icons, tooltips (Canva-style toolbar)
- **Context Menus**: Right-click menu for quick actions
- **Tooltips**: Helpful hints on hover
- **Resize Handles**: Visual resize handles on text boxes (Google Photos pattern)
- **Contrast Checker**: WCAG compliance checker (4.5:1 ratio minimum)
- **Accessibility Features**:
  - High contrast mode
  - Screen reader support
  - Keyboard navigation
  - Focus indicators
- **Non-Destructive Editing**: Never modify original image, only overlay (Adobe Express Generative Text Edit pattern)
- **Responsive Design**: Text overlays adapt to different screen sizes
- **User Preferences**: Option to disable click-to-edit (some users find it disruptive)

**Implementation:**
```javascript
// Smooth selection animation
const selectionStyle = {
  border: `2px solid ${tokens.colors.accent.lime}`,
  borderRadius: '4px',
  transition: 'all 0.2s ease',
  boxShadow: `0 0 0 2px ${tokens.colors.accent.lime}40`
};

// Context menu
const [contextMenu, setContextMenu] = useState(null);

const handleContextMenu = (e, elementId) => {
  e.preventDefault();
  setContextMenu({
      x: e.clientX,
      y: e.clientY,
      elementId
  });
};

// Tooltip component
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div 
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{ position: 'absolute', ... }}>
          {text}
        </div>
      )}
    </div>
  );
};
```

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/ContextMenu.js`
- **New:** `frontend/src/pages/linkedpilot/components/Tooltip.js`

---

### 6.5 Export Capabilities Enhancement (Priority: MEDIUM)
**Purpose:** Add professional export options matching CE.SDK

**Features:**
- **Multiple Export Formats**
  - PNG (current)
  - JPEG (with quality slider)
  - PDF (vector text, raster image)
  - SVG (vector format)

- **Export Quality Options**
  - Resolution selector (1x, 2x, 3x, custom)
  - Quality slider for JPEG (1-100)
  - DPI selector (72, 150, 300)

- **Export Presets**
  - LinkedIn Post (1200x627)
  - LinkedIn Story (1080x1920)
  - LinkedIn Carousel (1080x1080)
  - Custom dimensions

**Implementation:**
```javascript
const handleExport = async (format = 'png', quality = 0.92) => {
  if (!stageRef.current) return;
  
  const stage = stageRef.current.getStage();
  
  switch (format) {
    case 'png':
      const pngDataUrl = stage.toDataURL({ pixelRatio: 2 });
      downloadImage(pngDataUrl, 'image.png');
      break;
      
    case 'jpeg':
      const jpegDataUrl = stage.toDataURL({ 
        pixelRatio: 2,
        mimeType: 'image/jpeg',
        quality: quality
      });
      downloadImage(jpegDataUrl, 'image.jpg');
      break;
      
    case 'pdf':
      // Use jsPDF library
      const pdf = new jsPDF({
        orientation: stageSize.width > stageSize.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [stageSize.width, stageSize.height]
      });
      pdf.addImage(stage.toDataURL(), 'PNG', 0, 0, stageSize.width, stageSize.height);
      pdf.save('image.pdf');
      break;
      
    case 'svg':
      // Convert Konva stage to SVG
      const svg = stage.toSVG();
      downloadSVG(svg, 'image.svg');
      break;
  }
};
```

**Dependencies to add:**
- `jspdf` for PDF export
- `html2canvas` for advanced export options

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/ExportModal.js`

---

### 6.6 Asset Library Integration (Priority: LOW)
**Purpose:** Add media library, stickers, and frames like CE.SDK

**Features:**
- **Media Library Tab**
  - Stock images
  - User-uploaded images
  - Search and filter
  - Drag-and-drop to canvas

- **Stickers Library**
  - Categorized stickers (emojis, shapes, icons)
  - Search functionality
  - Recent/favorites
  - Add to canvas as image elements

- **Frames Library**
  - Static frames (borders, decorative)
  - Dynamic frames (animated preview)
  - Apply to image
  - Custom frame upload

### 6.7 Brand-Aware Text Editing (Google Pommeli Pattern) (Priority: MEDIUM)
**Purpose:** Integrate brand awareness into text editing workflow

**Key Insights from Google Pommeli:**
- **Business DNA**: Extract brand colors, fonts, tone from user's brand profile
- **Auto-Style**: Automatically apply brand colors/fonts when adding text
- **Brand Consistency**: Ensure all text overlays match brand identity
- **Quick Edits**: Simple, streamlined editing workflow

**Features:**
- **Brand Profile Integration**
  - Auto-apply brand colors to new text elements
  - Suggest brand fonts when adding text
  - Maintain brand consistency across all text overlays
  - Quick access to brand color palette

- **Smart Text Suggestions**
  - Generate text content based on brand tone
  - Suggest headlines/subtext matching brand voice
  - AI-powered copy suggestions (similar to Canva Magic Write)

- **Brand-Aware Templates**
  - Pre-styled text templates using brand colors/fonts
  - Quick apply brand styles to existing text
  - Brand style presets

**Implementation:**
```javascript
// Brand-aware text creation
const createBrandText = (text, brandProfile) => {
  return {
    text: text,
    fontFamily: brandProfile.primaryFont || 'Poppins',
    fill: brandProfile.primaryColor || '#000000',
    fontSize: 64,
    font_weight: brandProfile.fontWeight || 700,
    // Apply brand styles automatically
  };
};

// Brand color palette picker
const BrandColorPicker = ({ brandProfile, onColorSelect }) => {
  return (
    <div>
      <h4>Brand Colors</h4>
      {brandProfile.colors.map(color => (
        <button
          key={color}
          onClick={() => onColorSelect(color)}
          style={{ backgroundColor: color }}
        >
          {color}
        </button>
      ))}
    </div>
  );
};
```

**Backend Integration:**
- Use existing brand profile from user's organization settings
- Extract brand colors, fonts, tone from Brand DNA
- Apply automatically when generating text overlays

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/BrandAwareTextEditor.js`
- **New:** `frontend/src/pages/linkedpilot/components/BrandColorPicker.js`

**Implementation:**
```javascript
const AssetLibrary = ({ onAssetSelect, assetType = 'images' }) => {
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    fetchAssets(assetType);
  }, [assetType]);
  
  return (
    <div>
      <input
        type="text"
        placeholder="Search assets..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="asset-grid">
        {assets
          .filter(asset => asset.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(asset => (
            <div
              key={asset.id}
              onClick={() => onAssetSelect(asset)}
              className="asset-item"
            >
              <img src={asset.thumbnail} alt={asset.name} />
              <span>{asset.name}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
```

**Backend Requirements:**
- Asset storage endpoint
- Asset metadata API
- Upload endpoint for user assets

**Files to create:**
- `frontend/src/pages/linkedpilot/components/AssetLibrary.js`
- `frontend/src/pages/linkedpilot/components/StickersPanel.js`
- `frontend/src/pages/linkedpilot/components/FramesPanel.js`

---

## Updated Implementation Steps

### Step 7: Core Text Formatting (Priority: HIGH)
1. Add Bold/Italic/Underline/Strikethrough buttons to sidebar (Canva pattern)
2. Implement toggle functionality
3. Add keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X)
4. Add visual state indicators
5. Add text background styles (Google Photos pattern)
   - Solid color backgrounds
   - Gradient backgrounds
   - Opacity and padding controls

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Time Estimate:** 3-4 hours

---

### Step 8: Typography Controls (Priority: HIGH)
1. Add Letter Spacing slider
2. Add Line Height slider
3. Add Text Decoration options (underline, strikethrough)
4. Add Font Weight selector (100-900)
5. Add Lists support (Canva feature)
   - Bulleted lists
   - Numbered lists
   - Indentation controls
6. Enhance Text Alignment UI (left, center, right, justify)
7. Add Text Effects panel (Canva pattern)
   - Shadows (enhance existing)
   - Outlines/strokes
   - Curves (text along path)
   - 3D effects

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/TextEffectsPanel.js`

**Time Estimate:** 4-5 hours

---

### Step 9: Keyboard Shortcuts & Multi-Select (Priority: HIGH)
1. Implement comprehensive keyboard shortcut handlers
   - Add Enter key to edit (Adobe Express pattern)
   - Add Escape to cancel editing
   - Add Ctrl+Shift+X for strikethrough
   - Add Ctrl+D for duplicate
   - Add Tab to cycle through elements
2. Add multi-select functionality (Shift+Click, Ctrl+Click)
3. Add alignment tools for multiple elements
4. Add Select All (Ctrl+A)
5. Add resize handles on text boxes (Google Photos pattern)
6. Add contrast checker for accessibility (WCAG compliance)

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- **New:** `frontend/src/pages/linkedpilot/components/ContrastChecker.js`

**Time Estimate:** 4-5 hours

---

### Step 10: Advanced Text Effects (Priority: MEDIUM)
1. Create TextEffectsPanel component
2. Implement glow effect
3. Add multiple shadow layers support
4. Add text gradient support
5. Add pattern/texture support

**New files:**
- `frontend/src/pages/linkedpilot/components/TextEffectsPanel.js`

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Time Estimate:** 4-5 hours

---

### Step 11: Export Enhancements (Priority: MEDIUM)
1. Create ExportModal component
2. Add format selector (PNG, JPEG, PDF, SVG)
3. Add quality/resolution controls
4. Add export presets
5. Integrate jsPDF for PDF export

**New files:**
- `frontend/src/pages/linkedpilot/components/ExportModal.js`

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Dependencies:**
- `jspdf`: `npm install jspdf`
- `html2canvas`: `npm install html2canvas`

**Time Estimate:** 3-4 hours

---

### Step 12: Visual Polish & UX (Priority: MEDIUM)
1. Add smooth animations
2. Create ContextMenu component
3. Create Tooltip component
4. Enhance selection visual feedback
5. Improve toolbar layout (Canva-style comprehensive toolbar)
6. Add user preference to disable click-to-edit
7. Implement non-destructive editing (overlay only, never modify original image)
8. Add responsive design for text overlays
9. Add accessibility features:
   - High contrast mode
   - Screen reader support
   - Keyboard navigation
   - Focus indicators

**New files:**
- `frontend/src/pages/linkedpilot/components/ContextMenu.js`
- `frontend/src/pages/linkedpilot/components/Tooltip.js`
- `frontend/src/pages/linkedpilot/components/AccessibilityPanel.js`

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`

**Time Estimate:** 4-5 hours

---

### Step 13: Asset Library (Priority: LOW)
1. Create AssetLibrary component
2. Create StickersPanel component
3. Create FramesPanel component
4. Add backend endpoints for asset management
5. Integrate with canvas

**New files:**
- `frontend/src/pages/linkedpilot/components/AssetLibrary.js`
- `frontend/src/pages/linkedpilot/components/StickersPanel.js`
- `frontend/src/pages/linkedpilot/components/FramesPanel.js`

**Backend files:**
- `backend/linkedpilot/routes/assets.py` (new)

**Time Estimate:** 6-8 hours

---

### Step 14: Brand-Aware Text Editing (Google Pommeli Pattern) (Priority: MEDIUM)
1. Create BrandAwareTextEditor component
2. Create BrandColorPicker component
3. Integrate with existing brand profile/organization settings
4. Auto-apply brand colors/fonts when creating text
5. Add brand style presets
6. Add AI-powered text suggestions based on brand tone
7. Quick apply brand styles to existing text elements

**New files:**
- `frontend/src/pages/linkedpilot/components/BrandAwareTextEditor.js`
- `frontend/src/pages/linkedpilot/components/BrandColorPicker.js`

**Files to modify:**
- `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- `backend/linkedpilot/routes/drafts.py` (for brand-aware text generation)

**Time Estimate:** 4-5 hours

---

## Updated Timeline Estimate

**Core Fixes (Steps 1-6):**
- Step 1 (Backend): 2-3 hours
- Step 2 (Duplicate Prevention): 2-3 hours
- Step 3 (Region Detection UI): 3-4 hours
- Step 4 (Inline Editing): 4-5 hours
- Step 5 (Text Masking): 2-3 hours
- Step 6 (Visual Feedback): 2-3 hours
**Subtotal:** 15-21 hours

**IMG.LY/Canva/Google Pommeli Improvements (Steps 7-14):**
- Step 7 (Core Formatting): 3-4 hours (added background styles)
- Step 8 (Typography Controls): 4-5 hours (added lists, text effects)
- Step 9 (Keyboard Shortcuts & Multi-Select): 4-5 hours (added Enter key, resize handles, contrast checker)
- Step 10 (Advanced Effects): 4-5 hours
- Step 11 (Export Enhancements): 3-4 hours
- Step 12 (Visual Polish): 4-5 hours (added accessibility, non-destructive editing)
- Step 13 (Asset Library): 6-8 hours
- Step 14 (Brand-Aware Editing): 4-5 hours (Google Pommeli pattern)
**Subtotal:** 32-41 hours

**Total Estimated Time:** 47-62 hours

---

## Updated Success Criteria

### Core Fixes:
1. ✅ Users can click on baked-in text in images to edit it
2. ✅ No duplicate text appears when editing
3. ✅ Text editing feels native and responsive
4. ✅ Visual feedback clearly shows editable regions
5. ✅ Performance is smooth (no lag when editing)
6. ✅ Works with rotated/scaled text
7. ✅ Handles edge cases gracefully

### Canva/IMG.LY/Google Pommeli-Level Features:
8. ✅ Professional text formatting (Bold/Italic/Underline/Strikethrough) with keyboard shortcuts
9. ✅ Complete typography controls (letter spacing, line height, lists, text effects)
10. ✅ Advanced text effects (glow, multiple shadows, gradients, curves, 3D)
11. ✅ Multi-select and alignment tools
12. ✅ Multiple export formats (PNG, JPEG, PDF, SVG) with quality options
13. ✅ Smooth animations and professional visual polish
14. ✅ Text background styles (solid colors, gradients) - Google Photos pattern
15. ✅ Multiple edit triggers (Double-click OR Enter key) - Canva/Adobe Express pattern
16. ✅ Non-destructive editing (overlay only, never modify original image)
17. ✅ Accessibility features (WCAG contrast checker, screen reader support)
18. ✅ Resize handles on text boxes - Google Photos pattern
19. ✅ User preferences (option to disable click-to-edit)
20. ✅ **Brand-aware text editing** (Google Pommeli pattern)
    - Auto-apply brand colors/fonts
    - Brand color palette picker
    - Brand style presets
    - AI-powered text suggestions based on brand tone
21. ✅ Asset library integration (optional, Phase 2)

---

## Future Enhancements

1. **Multi-language support** for text detection
2. **Handwriting recognition** for handwritten text
3. **Text style transfer** (match font/style of detected text)
4. **Batch text editing** (edit multiple regions at once)
5. **Text templates** (save common text overlays)
6. **AI-powered text suggestions** while editing (Canva Magic Write style)
7. **Collaborative editing** (real-time multi-user)
8. **Version history** (track all changes with timeline)
9. **Custom font upload** (support for user fonts)
10. **Text animation presets** (fade in, slide, etc.)
11. **Brand DNA auto-extraction** (Google Pommeli pattern - analyze website to extract brand)
12. **Campaign templates** (pre-designed templates using brand colors/fonts)
13. **Platform-specific optimization** (LinkedIn, Instagram, Facebook presets)
14. **Magic Eraser integration** (remove/replace text in images using AI)
15. **Translate function** (Canva feature - translate text to 100+ languages)








