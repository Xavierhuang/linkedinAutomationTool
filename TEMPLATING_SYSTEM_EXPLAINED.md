# Template System - How It Works

## ✅ What's Already Built-In (No Setup Required)

### 1. **Templates - Already Included**
You don't need to provide templates - **5 professional templates are built-in**:

- **Hero Left** (16:9) - Text on left side, popular for landscape images
- **Hero Right** (16:9) - Text on right side
- **Hero Top** (1:1) - Text at top, great for square images
- **Hero Bottom** (16:9) - Text at bottom, common for social media
- **Center Stack** (1:1) - Text centered vertically, professional look

Each template defines:
- **Position regions** for different text roles (headline, subhead, CTA, hashtags)
- **Aspect ratio** it works best with
- **Priority** (how likely it is to be selected)
- **Max elements** it supports

### 2. **Automatic Template Selection**
The system automatically:
1. **Analyzes your image** - Checks aspect ratio (16:9, 1:1, 4:3, etc.)
2. **Detects text roles** - Identifies headline, subhead, CTA, hashtags from your content
3. **Scores templates** - Matches based on:
   - Aspect ratio compatibility (30% weight)
   - Role coverage (30% weight)
   - Template priority (30% weight)
   - Element count fit (10% weight)
4. **Selects best match** - Chooses highest-scoring template

### 3. **Typography System**
- **Default font**: "Poppins" (modern, clean)
- **Font sizes**: Auto-adjusted based on role:
  - Headline: 48-72px
  - Subhead: 36-48px
  - CTA: 24-36px
  - Hashtags: 16-24px
- **Adaptive sizing**: Automatically fits text to available space
- **Text wrapping**: Handles long text automatically

## 🎨 Fonts - How They Work

### Frontend (TextOverlayModal)
- Uses **Google Fonts API** - Loads fonts dynamically
- User can select from Google Fonts in the UI
- Fonts are loaded on-demand when modal opens

### Backend (AI System)
- **Default**: "Poppins" (clean, professional)
- Uses system fonts (Arial, Helvetica) as fallback
- Font selection happens in frontend - backend receives font name

## 📝 Adding Custom Templates (Optional)

If you want to add your own templates, you can modify:

```python
# backend/linkedpilot/utils/ai_text_overlay_advanced.py
# In TemplateLibrary._initialize_default_templates()

self.templates.append(Template(
    id="my_custom_template",
    name="My Custom Layout",
    composition=CompositionType.ASYMMETRIC,
    aspect_ratio=(16, 9),
    role_regions={
        OverlayRole.HEADLINE: Box(5, 10, 40, 25, use_percentage=True),
        OverlayRole.SUBHEAD: Box(5, 38, 40, 18, use_percentage=True),
        OverlayRole.CTA: Box(5, 60, 35, 15, use_percentage=True),
    },
    constraints={"max_elements": 3},
    priority=7  # Higher = more likely to be selected
))
```

## 🔧 Customization Options

### 1. **Add More Templates**
Edit `_initialize_default_templates()` in `ai_text_overlay_advanced.py`

### 2. **Change Default Font**
Edit `Typography` dataclass:
```python
font_name: str = "YourFont"  # Change from "Poppins"
```

### 3. **Adjust Typography Scale**
Edit `TypographicScale` class to change default sizes for roles

### 4. **Modify Template Selection Logic**
Edit `find_matching_template()` to adjust scoring weights

## 🚀 How It Works in Practice

1. **User clicks "AI Design"**
2. **System analyzes image**:
   - Aspect ratio: 16:9
   - Image size: 1920x1080
3. **System extracts content**:
   - Headline: "Transform Your Business"
   - Subhead: "Join 10,000+ companies"
   - CTA: "Get Started Today"
   - Hashtags: ["#Business", "#Growth"]
4. **Template matching**:
   - Hero Bottom (priority 6, 16:9 match) → Score: 8.5
   - Hero Left (priority 5, 16:9 match) → Score: 7.2
   - **Selects Hero Bottom** (highest score)
5. **Applies template**:
   - Headline at 10% from left, 70% from top
   - Subhead at 10% from left, 50% from top
   - CTA at 10% from left, 85% from top
   - Hashtags at 75% from left, 85% from top
6. **Optimizes**:
   - Checks contrast with background
   - Adjusts font size to fit
   - Adds stroke if needed for readability

## ❓ Do You Need to Provide Anything?

### **No, you don't need to provide:**
- ✅ Templates (5 built-in)
- ✅ Fonts (Google Fonts + system fallbacks)
- ✅ Typography rules (automatic)
- ✅ Layout logic (automatic)

### **Optional - You can customize:**
- Add more templates (if you want specific layouts)
- Change default font (if you prefer a different one)
- Adjust template priorities (if you want certain templates used more)
- Modify typography scales (if you want different sizes)

## 📊 Current Template Priorities

1. **Hero Bottom** - Priority 6 (most common for social)
2. **Hero Left/Right** - Priority 5 (good for landscape)
3. **Hero Top** - Priority 4 (good for square)
4. **Center Stack** - Priority 3 (professional but less common)

## 🎯 Summary

**Everything works out of the box!** The system:
- Has 5 professional templates built-in
- Automatically selects the best template
- Uses Google Fonts (no setup needed)
- Adapts to your image and content

You only need to customize if you want:
- Specific brand layouts
- Custom fonts beyond Google Fonts
- Industry-specific templates







