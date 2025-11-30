"""
Advanced AI Text Overlay System
Implements content-aware placement, adaptive typography, templating, and quality scoring.
Phase 1: Foundations and Guardrails
"""

import os
import base64
import io
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from PIL import Image, ImageDraw, ImageFont
import numpy as np


class OverlayRole(Enum):
    """Role of text element in hierarchy"""
    HEADLINE = "headline"
    SUBHEAD = "subhead"
    CTA = "cta"
    BODY = "body"
    CAPTION = "caption"
    HASHTAG = "hashtag"
    TAGLINE = "tagline"


class TextAlign(Enum):
    """Text alignment options"""
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


class PanelStyle(Enum):
    """Background panel style for text"""
    NONE = "none"
    SOLID = "solid"
    GRADIENT = "gradient"
    BLUR = "blur"
    GLASS = "glass"


@dataclass
class Typography:
    """Typography settings for text element"""
    font_name: str = "Poppins"
    font_size: int = 48
    font_weight: int = 400
    font_style: str = "normal"
    line_height: float = 1.2
    letter_spacing: int = 0
    text_decoration: str = "none"


@dataclass
class Effects:
    """Visual effects for text"""
    stroke_width: int = 0
    stroke_color: str = "#000000"
    shadow_enabled: bool = False
    shadow_color: str = "#000000"
    shadow_blur: int = 10
    shadow_offset_x: int = 0
    shadow_offset_y: int = 0
    opacity: int = 100


@dataclass
class Box:
    """Bounding box for text placement"""
    x: float  # Percentage or pixels
    y: float  # Percentage or pixels
    width: float
    height: float
    use_percentage: bool = True  # If True, x/y/width/height are percentages (0-100)


@dataclass
class OverlayElement:
    """Complete overlay element schema"""
    role: OverlayRole
    text: str
    box: Box
    typography: Typography
    effects: Effects
    color: str = "#FFFFFF"
    text_align: TextAlign = TextAlign.LEFT
    panel_style: PanelStyle = PanelStyle.NONE
    panel_color: str = "#000000"
    panel_opacity: int = 80
    rotation: int = 0


@dataclass
class SafeZone:
    """Safe zone definition to avoid important image regions"""
    top_margin: float = 10.0  # Percentage
    bottom_margin: float = 10.0
    left_margin: float = 5.0
    right_margin: float = 5.0
    center_avoid_radius: float = 20.0  # Avoid center busy areas


@dataclass
class GridSystem:
    """Grid system for alignment"""
    columns: int = 12
    rows: int = 8
    gutter: float = 2.0  # Percentage between grid cells


@dataclass
class TypographicScale:
    """Role-based typographic scale"""
    headline_size: int = 72
    subhead_size: int = 48
    body_size: int = 36
    cta_size: int = 42
    caption_size: int = 24
    hashtag_size: int = 28
    tagline_size: int = 32
    
    def get_size_for_role(self, role: OverlayRole) -> int:
        """Get font size for a role"""
        mapping = {
            OverlayRole.HEADLINE: self.headline_size,
            OverlayRole.SUBHEAD: self.subhead_size,
            OverlayRole.BODY: self.body_size,
            OverlayRole.CTA: self.cta_size,
            OverlayRole.CAPTION: self.caption_size,
            OverlayRole.HASHTAG: self.hashtag_size,
            OverlayRole.TAGLINE: self.tagline_size,
        }
        return mapping.get(role, self.body_size)


@dataclass
class BrandKit:
    """Brand kit tokens for consistency"""
    primary_font: str = "Poppins"
    secondary_font: str = "Roboto"
    primary_color: str = "#FFFFFF"
    secondary_color: str = "#000000"
    accent_color: str = "#0077B5"  # LinkedIn blue
    min_contrast_ratio: float = 4.5  # WCAG AA standard
    spacing_unit: float = 8.0  # Base spacing unit in pixels
    panel_style_preference: PanelStyle = PanelStyle.BLUR
    logo_safe_zones: List[Box] = field(default_factory=list)


class ScoringMetric:
    """Base class for pluggable scoring metrics"""
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """
        Score an overlay element (0.0 to 1.0)
        
        Args:
            element: The overlay element to score
            image: The base image
            context: Additional context (saliency maps, etc.)
        
        Returns:
            Score from 0.0 (poor) to 1.0 (excellent)
        """
        raise NotImplementedError


class ContrastScore(ScoringMetric):
    """Score based on text contrast with background"""
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate contrast score"""
        # Sample background color at element position
        box = element.box
        if box.use_percentage:
            x = int((box.x / 100) * image.width)
            y = int((box.y / 100) * image.height)
        else:
            x = int(box.x)
            y = int(box.y)
        
        # Sample local background
        sample_size = 50
        x_min = max(0, x - sample_size // 2)
        y_min = max(0, y - sample_size // 2)
        x_max = min(image.width, x + sample_size // 2)
        y_max = min(image.height, y + sample_size // 2)
        
        if x_max <= x_min or y_max <= y_min:
            return 0.0
        
        # Get average color in region
        region = image.crop((x_min, y_min, x_max, y_max))
        pixels = np.array(region)
        avg_color = pixels.mean(axis=(0, 1))
        
        # Calculate contrast ratio
        text_color = _hex_to_rgb(element.color)
        contrast = _calculate_contrast_ratio(text_color, avg_color[:3])
        
        # Normalize to 0-1 (target: 4.5+ for WCAG AA)
        return min(1.0, contrast / 7.0)  # 7.0 is excellent contrast


class GridAlignmentScore(ScoringMetric):
    """Score based on grid alignment"""
    
    def __init__(self, grid: GridSystem):
        self.grid = grid
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate grid alignment score"""
        box = element.box
        if not box.use_percentage:
            return 0.5  # Can't align non-percentage boxes
        
        # Check if box aligns to grid
        cell_width = 100.0 / self.grid.columns
        cell_height = 100.0 / self.grid.rows
        
        # Check x alignment
        x_aligned = (box.x % cell_width) < (cell_width * 0.1) or (box.x % cell_width) > (cell_width * 0.9)
        # Check y alignment
        y_aligned = (box.y % cell_height) < (cell_height * 0.1) or (box.y % cell_height) > (cell_height * 0.9)
        
        if x_aligned and y_aligned:
            return 1.0
        elif x_aligned or y_aligned:
            return 0.7
        else:
            return 0.3


class SafeZoneScore(ScoringMetric):
    """Score based on safe zone compliance"""
    
    def __init__(self, safe_zone: SafeZone):
        self.safe_zone = safe_zone
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate safe zone score"""
        box = element.box
        if not box.use_percentage:
            return 0.5
        
        score = 1.0
        
        # Check margins
        if box.y < self.safe_zone.top_margin:
            score -= 0.3
        if box.y + box.height > 100 - self.safe_zone.bottom_margin:
            score -= 0.3
        if box.x < self.safe_zone.left_margin:
            score -= 0.2
        if box.x + box.width > 100 - self.safe_zone.right_margin:
            score -= 0.2
        
        # Check center avoidance
        center_x, center_y = 50.0, 50.0
        box_center_x = box.x + box.width / 2
        box_center_y = box.y + box.height / 2
        distance = ((box_center_x - center_x) ** 2 + (box_center_y - center_y) ** 2) ** 0.5
        
        if distance < self.safe_zone.center_avoid_radius:
            score -= 0.2
        
        return max(0.0, score)


class CompositeScorer:
    """Composite scorer combining multiple metrics"""
    
    def __init__(self, metrics: List[Tuple[ScoringMetric, float]]):
        """
        Initialize with list of (metric, weight) tuples
        
        Args:
            metrics: List of (metric, weight) where weight is relative importance
        """
        self.metrics = metrics
        total_weight = sum(weight for _, weight in metrics)
        # Normalize weights
        self.weights = [(metric, weight / total_weight) for metric, weight in metrics]
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate composite score"""
        total_score = 0.0
        for metric, weight in self.weights:
            metric_score = metric.score(element, image, context)
            total_score += metric_score * weight
        
        return total_score


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def _calculate_contrast_ratio(color1: Tuple[int, int, int], color2: Tuple[int, int, int]) -> float:
    """Calculate WCAG contrast ratio between two colors"""
    def relative_luminance(rgb: Tuple[int, int, int]) -> float:
        """Calculate relative luminance"""
        r, g, b = [c / 255.0 for c in rgb]
        
        def to_linear(c):
            if c <= 0.03928:
                return c / 12.92
            return ((c + 0.055) / 1.055) ** 2.4
        
        r = to_linear(r)
        g = to_linear(g)
        b = to_linear(b)
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    
    l1 = relative_luminance(color1)
    l2 = relative_luminance(color2)
    
    lighter = max(l1, l2)
    darker = min(l1, l2)
    
    return (lighter + 0.05) / (darker + 0.05)


def create_default_brand_kit() -> BrandKit:
    """Create default brand kit"""
    return BrandKit()


def create_default_safe_zone() -> SafeZone:
    """Create default safe zone"""
    return SafeZone()


def create_default_grid() -> GridSystem:
    """Create default grid system"""
    return GridSystem()


def create_default_typographic_scale() -> TypographicScale:
    """Create default typographic scale"""
    return TypographicScale()


def create_default_scorer(safe_zone: SafeZone, grid: GridSystem) -> CompositeScorer:
    """Create default composite scorer"""
    metrics = [
        (ContrastScore(), 0.4),
        (GridAlignmentScore(grid), 0.3),
        (SafeZoneScore(safe_zone), 0.3),
    ]
    return CompositeScorer(metrics)


# ============================================================================
# Phase 2: Content-Aware Placement
# ============================================================================

def compute_saliency_map(image: Image.Image) -> np.ndarray:
    """
    Compute saliency map using lightweight method (no GPU required)
    Uses gradient magnitude and local variance as saliency indicators
    
    Args:
        image: PIL Image
    
    Returns:
        Saliency map as numpy array (0-1, higher = more salient/busy)
    """
    # Convert to grayscale if needed
    if image.mode != 'L':
        gray = image.convert('L')
    else:
        gray = image
    
    img_array = np.array(gray, dtype=np.float32)
    
    # Compute gradients (Sobel operator approximation)
    # Horizontal gradient
    sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
    # Vertical gradient
    sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])
    
    # Pad image for convolution
    padded = np.pad(img_array, 1, mode='edge')
    
    # Compute gradients
    grad_x = np.zeros_like(img_array)
    grad_y = np.zeros_like(img_array)
    
    h, w = img_array.shape
    for i in range(h):
        for j in range(w):
            region = padded[i:i+3, j:j+3]
            grad_x[i, j] = np.sum(region * sobel_x)
            grad_y[i, j] = np.sum(region * sobel_y)
    
    # Gradient magnitude
    gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
    
    # Local variance (texture/busyness indicator)
    kernel_size = 5
    kernel = np.ones((kernel_size, kernel_size)) / (kernel_size * kernel_size)
    padded_var = np.pad(img_array, kernel_size//2, mode='edge')
    
    local_mean = np.zeros_like(img_array)
    local_variance = np.zeros_like(img_array)
    
    for i in range(h):
        for j in range(w):
            region = padded_var[i:i+kernel_size, j:j+kernel_size]
            local_mean[i, j] = np.mean(region)
            local_variance[i, j] = np.var(region)
    
    # Combine gradient and variance
    # Normalize both to 0-1
    grad_norm = (gradient_magnitude - gradient_magnitude.min()) / (gradient_magnitude.max() - gradient_magnitude.min() + 1e-8)
    var_norm = (local_variance - local_variance.min()) / (local_variance.max() - local_variance.min() + 1e-8)
    
    # Weighted combination (gradient is more important for edges)
    saliency = 0.6 * grad_norm + 0.4 * var_norm
    
    # Normalize to 0-1
    saliency = (saliency - saliency.min()) / (saliency.max() - saliency.min() + 1e-8)
    
    return saliency


def detect_faces_and_logos_lightweight(image: Image.Image) -> List[Box]:
    """
    Lightweight face/logo detection using heuristics
    For production, consider using face_recognition library or API
    
    Args:
        image: PIL Image
    
    Returns:
        List of Box objects (in percentages) to avoid
    """
    # This is a placeholder - in production, use actual face detection
    # For now, return empty list (no faces detected)
    # Can be enhanced with face_recognition library or cloud API
    return []


def generate_candidate_boxes(
    image: Image.Image,
    grid: GridSystem,
    safe_zone: SafeZone,
    text_width_percent: float = 80.0,
    text_height_percent: float = 15.0
) -> List[Box]:
    """
    Generate candidate placement boxes aligned to grid
    
    Args:
        image: PIL Image
        grid: Grid system
        safe_zone: Safe zone constraints
        text_width_percent: Width of text box in percentage
        text_height_percent: Height of text box in percentage
    
    Returns:
        List of candidate Box objects
    """
    candidates = []
    
    # Top placement variants
    for col_offset in range(0, grid.columns - int(text_width_percent / (100.0 / grid.columns)) + 1):
        x = (col_offset * (100.0 / grid.columns)) + safe_zone.left_margin
        y = safe_zone.top_margin
        if x + text_width_percent <= 100 - safe_zone.right_margin:
            candidates.append(Box(x, y, text_width_percent, text_height_percent, use_percentage=True))
    
    # Bottom placement variants
    for col_offset in range(0, grid.columns - int(text_width_percent / (100.0 / grid.columns)) + 1):
        x = (col_offset * (100.0 / grid.columns)) + safe_zone.left_margin
        y = 100 - safe_zone.bottom_margin - text_height_percent
        if x + text_width_percent <= 100 - safe_zone.right_margin and y >= safe_zone.top_margin:
            candidates.append(Box(x, y, text_width_percent, text_height_percent, use_percentage=True))
    
    # Rule of thirds placement (top third)
    third_y = 33.33
    for col_offset in range(0, grid.columns - int(text_width_percent / (100.0 / grid.columns)) + 1):
        x = (col_offset * (100.0 / grid.columns)) + safe_zone.left_margin
        y = third_y - text_height_percent / 2
        if x + text_width_percent <= 100 - safe_zone.right_margin and y >= safe_zone.top_margin:
            candidates.append(Box(x, y, text_width_percent, text_height_percent, use_percentage=True))
    
    # Center horizontal (strapline)
    x = 50 - text_width_percent / 2
    y = 50 - text_height_percent / 2
    if x >= safe_zone.left_margin and x + text_width_percent <= 100 - safe_zone.right_margin:
        candidates.append(Box(x, y, text_width_percent, text_height_percent, use_percentage=True))
    
    return candidates


def sample_local_background(
    image: Image.Image,
    box: Box
) -> Dict[str, Any]:
    """
    Sample local background region for a candidate box
    
    Args:
        image: PIL Image
        box: Box to sample background for
    
    Returns:
        Dictionary with:
        - avg_luminance: Average brightness (0-255)
        - avg_color: Average RGB color
        - busyness: Variance/contrast in region (0-1)
        - texture: Texture complexity estimate
    """
    # Convert box percentages to pixels
    if box.use_percentage:
        x = int((box.x / 100) * image.width)
        y = int((box.y / 100) * image.height)
        width = int((box.width / 100) * image.width)
        height = int((box.height / 100) * image.height)
    else:
        x, y = int(box.x), int(box.y)
        width, height = int(box.width), int(box.height)
    
    # Expand region slightly for better sampling
    padding = 20
    x_min = max(0, x - padding)
    y_min = max(0, y - padding)
    x_max = min(image.width, x + width + padding)
    y_max = min(image.height, y + height + padding)
    
    # Crop region
    region = image.crop((x_min, y_min, x_max, y_max))
    
    # Convert to numpy array
    if region.mode != 'RGB':
        region = region.convert('RGB')
    region_array = np.array(region)
    
    # Calculate statistics
    avg_color = region_array.mean(axis=(0, 1))
    
    # Convert to grayscale for luminance
    if len(avg_color) == 3:
        # RGB to luminance (standard formula)
        luminance = 0.299 * avg_color[0] + 0.587 * avg_color[1] + 0.114 * avg_color[2]
    else:
        luminance = avg_color[0]
    
    # Calculate busyness (variance in region)
    gray_region = region.convert('L')
    gray_array = np.array(gray_region)
    busyness = gray_array.std() / 255.0  # Normalize to 0-1
    
    # Texture estimate (local variance)
    texture = busyness  # Simplified for now
    
    return {
        'avg_luminance': float(luminance),
        'avg_color': tuple(avg_color.astype(int)),
        'busyness': float(busyness),
        'texture': float(texture)
    }


def determine_adaptive_contrast(
    background_sample: Dict[str, Any],
    brand_kit: BrandKit,
    min_contrast: float = 4.5
) -> Dict[str, Any]:
    """
    Determine adaptive text color and effects based on background
    
    Args:
        background_sample: Output from sample_local_background
        brand_kit: Brand kit for color preferences
        min_contrast: Minimum WCAG contrast ratio required
    
    Returns:
        Dictionary with:
        - text_color: Recommended text color (hex)
        - stroke_width: Recommended stroke width
        - stroke_color: Recommended stroke color
        - panel_style: Recommended panel style
        - panel_color: Recommended panel color
        - panel_opacity: Recommended panel opacity
    """
    luminance = background_sample['avg_luminance']
    busyness = background_sample['busyness']
    
    # Determine if background is light or dark
    is_light = luminance > 128
    
    # Choose text color
    if is_light:
        text_color = brand_kit.secondary_color  # Dark text on light
        stroke_color = brand_kit.primary_color  # Light stroke
    else:
        text_color = brand_kit.primary_color  # Light text on dark
        stroke_color = brand_kit.secondary_color  # Dark stroke
    
    # Determine if panel is needed
    needs_panel = busyness > 0.3  # High busyness needs panel
    
    panel_style = PanelStyle.NONE
    panel_color = "#000000"
    panel_opacity = 80
    
    if needs_panel:
        panel_style = brand_kit.panel_style_preference
        if is_light:
            panel_color = "#FFFFFF"
            panel_opacity = 200  # More opaque for light backgrounds
        else:
            panel_color = "#000000"
            panel_opacity = 180
    
    # Determine stroke width - DISABLED by default (user preference)
    # User can manually add stroke if needed
    stroke_width = 0  # Always 0 - no auto stroke
    
    # Verify contrast meets minimum
    text_rgb = _hex_to_rgb(text_color)
    bg_rgb = background_sample['avg_color']
    contrast = _calculate_contrast_ratio(text_rgb, bg_rgb)
    
    if contrast < min_contrast:
        # Use panel instead of stroke for better readability
        if not needs_panel and contrast < 3.0:
            needs_panel = True
            panel_style = PanelStyle.SOLID
            if is_light:
                panel_color = "#FFFFFF"
                panel_opacity = 240
            else:
                panel_color = "#000000"
                panel_opacity = 220
    
    return {
        'text_color': text_color,
        'stroke_width': stroke_width,  # Always 0
        'stroke_color': stroke_color,
        'panel_style': panel_style,
        'panel_color': panel_color,
        'panel_opacity': panel_opacity
    }


# ============================================================================
# Phase 3: Fit and Readability
# ============================================================================

def fit_text_to_box(
    text: str,
    box: Box,
    image: Image.Image,
    typography: Typography,
    typographic_scale: TypographicScale,
    role: OverlayRole,
    min_font_size: int = 24,
    target_density: float = 0.7  # Target text density (0-1)
) -> Tuple[Typography, List[str]]:
    """
    Iteratively fit text to box by adjusting font size and wrapping
    
    Args:
        text: Text to fit
        box: Target box
        image: Base image for pixel calculations
        typography: Initial typography settings
        typographic_scale: Typographic scale for role-based sizing
        role: Text role for size determination
        min_font_size: Minimum font size (brand constraint)
        target_density: Target text density (0-1, lower = more spacing)
    
    Returns:
        Tuple of (adjusted_typography, wrapped_lines)
    """
    # Convert box to pixels
    if box.use_percentage:
        box_width = int((box.width / 100) * image.width)
        box_height = int((box.height / 100) * image.height)
    else:
        box_width = int(box.width)
        box_height = int(box.height)
    
    # Start with role-based size
    font_size = typographic_scale.get_size_for_role(role)
    
    # Try to load font to measure text
    try:
        # Try to get font path (simplified - would need actual font loading)
        font_obj = ImageFont.load_default()
    except:
        font_obj = ImageFont.load_default()
    
    # Binary search for optimal font size
    min_size = min_font_size
    max_size = min(box_height, font_size * 2)
    best_size = min_size
    best_lines = []
    
    for iteration in range(10):  # Max 10 iterations
        test_size = (min_size + max_size) // 2
        if test_size < min_font_size:
            test_size = min_font_size
        
        # Try to load font at this size
        try:
            test_font = ImageFont.truetype("arial.ttf", test_size)
        except:
            try:
                test_font = ImageFont.load_default()
            except:
                test_font = None
        
        if test_font is None:
            break
        
        # Wrap text to fit width
        wrapped_lines = _wrap_text_to_width(text, box_width, test_font)
        
        # Calculate total height needed
        line_height_px = int(test_size * typography.line_height)
        total_height = len(wrapped_lines) * line_height_px
        
        # Check if fits
        if total_height <= box_height * target_density:
            # Fits, try larger
            best_size = test_size
            best_lines = wrapped_lines
            min_size = test_size + 1
        else:
            # Doesn't fit, try smaller
            max_size = test_size - 1
        
        if min_size > max_size:
            break
    
    # Update typography
    adjusted_typography = Typography(
        font_name=typography.font_name,
        font_size=best_size,
        font_weight=typography.font_weight,
        font_style=typography.font_style,
        line_height=typography.line_height,
        letter_spacing=typography.letter_spacing,
        text_decoration=typography.text_decoration
    )
    
    return adjusted_typography, best_lines if best_lines else [text]


def _wrap_text_to_width(text: str, max_width: int, font: ImageFont.ImageFont) -> List[str]:
    """Wrap text to fit within max_width pixels"""
    words = text.split(' ')
    lines = []
    current_line = []
    current_width = 0
    
    for word in words:
        # Measure word width
        bbox = font.getbbox(word)
        word_width = bbox[2] - bbox[0]
        
        # Add space width if not first word
        if current_line:
            space_width = font.getbbox(' ')[2] - font.getbbox(' ')[0]
            word_width += space_width
        
        if current_width + word_width <= max_width:
            current_line.append(word)
            current_width += word_width
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
            current_width = word_width
    
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines if lines else [text]


def shorten_text_for_role(
    text: str,
    role: OverlayRole,
    max_length: int = 100
) -> str:
    """
    Shorten text based on role (CTAs and hashtags can be shortened more aggressively)
    
    Args:
        text: Original text
        role: Text role
        max_length: Maximum character length
    
    Returns:
        Shortened text
    """
    if len(text) <= max_length:
        return text
    
    # Role-specific shortening strategies
    if role == OverlayRole.HASHTAG:
        # Hashtags: keep first few, add ellipsis
        if len(text) > max_length:
            return text[:max_length-3] + "..."
    
    elif role == OverlayRole.CTA:
        # CTAs: keep action words, remove filler
        words = text.split()
        shortened = []
        current_len = 0
        
        # Priority words for CTAs
        action_words = ['learn', 'get', 'try', 'start', 'join', 'download', 'sign', 'read', 'watch', 'discover']
        
        for word in words:
            if word.lower() in action_words or current_len < max_length * 0.7:
                if current_len + len(word) + 1 <= max_length:
                    shortened.append(word)
                    current_len += len(word) + 1
                else:
                    break
            elif current_len < max_length * 0.5:
                if current_len + len(word) + 1 <= max_length:
                    shortened.append(word)
                    current_len += len(word) + 1
        
        if shortened:
            return ' '.join(shortened)
        else:
            return text[:max_length-3] + "..."
    
    elif role == OverlayRole.HEADLINE:
        # Headlines: truncate at word boundary
        if len(text) > max_length:
            truncated = text[:max_length]
            last_space = truncated.rfind(' ')
            if last_space > max_length * 0.8:
                return truncated[:last_space] + "..."
            return truncated + "..."
    
    else:
        # Default: truncate with ellipsis
        return text[:max_length-3] + "..."
    
    return text


def apply_minimum_brand_sizes(
    element: OverlayElement,
    typographic_scale: TypographicScale,
    brand_kit: BrandKit
) -> OverlayElement:
    """
    Enforce minimum brand sizes for text elements
    
    Args:
        element: Overlay element
        typographic_scale: Typographic scale
        brand_kit: Brand kit with constraints
    
    Returns:
        Updated element with minimum sizes enforced
    """
    role = element.role
    min_size = typographic_scale.get_size_for_role(role) * 0.7  # 70% of role size as minimum
    
    if element.typography.font_size < min_size:
        # Update typography
        new_typography = Typography(
            font_name=element.typography.font_name,
            font_size=int(min_size),
            font_weight=element.typography.font_weight,
            font_style=element.typography.font_style,
            line_height=element.typography.line_height,
            letter_spacing=element.typography.letter_spacing,
            text_decoration=element.typography.text_decoration
        )
        
        # Create new element with updated typography
        return OverlayElement(
            role=element.role,
            text=element.text,
            box=element.box,
            typography=new_typography,
            effects=element.effects,
            color=element.color,
            text_align=element.text_align,
            panel_style=element.panel_style,
            panel_color=element.panel_color,
            panel_opacity=element.panel_opacity,
            rotation=element.rotation
        )
    
    return element


# ============================================================================
# Phase 4: Scoring and Search
# ============================================================================

class SaliencyScore(ScoringMetric):
    """Score based on saliency map (avoid busy regions)"""
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate saliency avoidance score"""
        saliency_map = context.get('saliency_map')
        if saliency_map is None:
            return 0.5  # Neutral if no saliency map
        
        box = element.box
        if box.use_percentage:
            x_min = int((box.x / 100) * image.width)
            y_min = int((box.y / 100) * image.height)
            x_max = int(((box.x + box.width) / 100) * image.width)
            y_max = int(((box.y + box.height) / 100) * image.height)
        else:
            x_min, y_min = int(box.x), int(box.y)
            x_max, y_max = int(box.x + box.width), int(box.y + box.height)
        
        # Clip to image bounds
        x_min = max(0, min(x_min, saliency_map.shape[1] - 1))
        y_min = max(0, min(y_min, saliency_map.shape[0] - 1))
        x_max = max(0, min(x_max, saliency_map.shape[1]))
        y_max = max(0, min(y_max, saliency_map.shape[0]))
        
        if x_max <= x_min or y_max <= y_min:
            return 0.5
        
        # Get average saliency in box region
        region = saliency_map[y_min:y_max, x_min:x_max]
        avg_saliency = float(region.mean())
        
        # Lower saliency = better score (we want to avoid busy regions)
        return 1.0 - avg_saliency


class HierarchyScore(ScoringMetric):
    """Score based on typographic hierarchy consistency"""
    
    def __init__(self, typographic_scale: TypographicScale):
        self.typographic_scale = typographic_scale
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate hierarchy consistency score"""
        role = element.role
        expected_size = self.typographic_scale.get_size_for_role(role)
        actual_size = element.typography.font_size
        
        # Score based on how close actual is to expected
        ratio = actual_size / expected_size if expected_size > 0 else 1.0
        
        # Prefer sizes within 80-120% of expected
        if 0.8 <= ratio <= 1.2:
            return 1.0
        elif 0.6 <= ratio < 0.8 or 1.2 < ratio <= 1.5:
            return 0.7
        else:
            return 0.3


class OverflowScore(ScoringMetric):
    """Penalty for text that overflows its box"""
    
    def score(self, element: OverlayElement, image: Image.Image, context: Dict) -> float:
        """Calculate overflow penalty"""
        # This would need actual text measurement - simplified for now
        # In practice, would measure text width/height vs box dimensions
        return 1.0  # Placeholder - assume no overflow


def generate_overlay_candidates(
    image: Image.Image,
    text_elements: List[Dict[str, Any]],  # List of {text, role} dicts
    grid: GridSystem,
    safe_zone: SafeZone,
    typographic_scale: TypographicScale,
    brand_kit: BrandKit,
    max_candidates_per_element: int = 5
) -> List[OverlayElement]:
    """
    Generate multiple candidate overlay elements for each text
    
    Args:
        image: Base image
        text_elements: List of {text, role} dictionaries
        grid: Grid system
        safe_zone: Safe zone constraints
        typographic_scale: Typographic scale
        brand_kit: Brand kit
        max_candidates_per_element: Maximum candidates per text element
    
    Returns:
        List of candidate OverlayElement objects
    """
    # Compute saliency map once
    saliency_map = compute_saliency_map(image)
    
    # Detect faces/logos to avoid
    avoid_regions = detect_faces_and_logos_lightweight(image)
    
    all_candidates = []
    
    for text_data in text_elements:
        text = text_data.get('text', '')
        role = text_data.get('role', OverlayRole.HEADLINE)
        
        if not text:
            continue
        
        # Generate candidate boxes
        candidate_boxes = generate_candidate_boxes(
            image, grid, safe_zone,
            text_width_percent=80.0,
            text_height_percent=15.0
        )
        
        # Filter boxes that overlap with avoid regions
        filtered_boxes = []
        for box in candidate_boxes:
            overlaps = False
            for avoid_box in avoid_regions:
                if _boxes_overlap(box, avoid_box):
                    overlaps = True
                    break
            if not overlaps:
                filtered_boxes.append(box)
        
        if not filtered_boxes:
            filtered_boxes = candidate_boxes[:3]  # Fallback to first 3
        
        # Limit candidates
        filtered_boxes = filtered_boxes[:max_candidates_per_element]
        
        # Create overlay elements for each candidate box
        for box in filtered_boxes:
            # Sample background
            background_sample = sample_local_background(image, box)
            
            # Determine adaptive contrast
            contrast_settings = determine_adaptive_contrast(
                background_sample, brand_kit, brand_kit.min_contrast_ratio
            )
            
            # Get typography for role
            font_size = typographic_scale.get_size_for_role(role)
            typography = Typography(
                font_name=brand_kit.primary_font,
                font_size=font_size,
                font_weight=700 if role == OverlayRole.HEADLINE else 400,
                font_style="normal",
                line_height=1.2,
                letter_spacing=0,
                text_decoration="none"
            )
            
            # Fit text to box
            adjusted_typography, wrapped_lines = fit_text_to_box(
                text, box, image, typography, typographic_scale, role
            )
            
            # Create effects
            effects = Effects(
                stroke_width=contrast_settings['stroke_width'],
                stroke_color=contrast_settings['stroke_color'],
                shadow_enabled=contrast_settings['stroke_width'] > 0,
                shadow_color=contrast_settings['stroke_color'],
                shadow_blur=10,
                shadow_offset_x=2,
                shadow_offset_y=2,
                opacity=100
            )
            
            # Create overlay element
            element = OverlayElement(
                role=role,
                text=text,
                box=box,
                typography=adjusted_typography,
                effects=effects,
                color=contrast_settings['text_color'],
                text_align=TextAlign.CENTER,
                panel_style=contrast_settings['panel_style'],
                panel_color=contrast_settings['panel_color'],
                panel_opacity=contrast_settings['panel_opacity'],
                rotation=0
            )
            
            # Apply minimum brand sizes
            element = apply_minimum_brand_sizes(element, typographic_scale, brand_kit)
            
            all_candidates.append(element)
    
    return all_candidates


def _boxes_overlap(box1: Box, box2: Box) -> bool:
    """Check if two boxes overlap"""
    # Simplified overlap check (assuming both use percentages)
    if not (box1.use_percentage and box2.use_percentage):
        return False
    
    x1_min, y1_min = box1.x, box1.y
    x1_max, y1_max = box1.x + box1.width, box1.y + box1.height
    x2_min, y2_min = box2.x, box2.y
    x2_max, y2_max = box2.x + box2.width, box2.y + box2.height
    
    return not (x1_max < x2_min or x2_max < x1_min or y1_max < y2_min or y2_max < y1_min)


def score_candidates(
    candidates: List[OverlayElement],
    image: Image.Image,
    grid: GridSystem,
    safe_zone: SafeZone,
    typographic_scale: TypographicScale,
    brand_kit: BrandKit
) -> List[Tuple[OverlayElement, float]]:
    """
    Score all candidates using composite scoring
    
    Args:
        candidates: List of candidate elements
        image: Base image
        grid: Grid system
        safe_zone: Safe zone
        typographic_scale: Typographic scale
        brand_kit: Brand kit
    
    Returns:
        List of (element, score) tuples, sorted by score (highest first)
    """
    # Compute saliency map
    saliency_map = compute_saliency_map(image)
    
    # Create composite scorer with all metrics
    base_scorer = create_default_scorer(safe_zone, grid)
    
    # Add additional metrics
    saliency_metric = SaliencyScore()
    hierarchy_metric = HierarchyScore(typographic_scale)
    overflow_metric = OverflowScore()
    
    # Create enhanced composite scorer
    enhanced_metrics = [
        (ContrastScore(), 0.25),
        (GridAlignmentScore(grid), 0.15),
        (SafeZoneScore(safe_zone), 0.15),
        (saliency_metric, 0.25),
        (hierarchy_metric, 0.15),
        (overflow_metric, 0.05),
    ]
    scorer = CompositeScorer(enhanced_metrics)
    
    # Score each candidate
    scored_candidates = []
    context = {'saliency_map': saliency_map}
    
    for candidate in candidates:
        score = scorer.score(candidate, image, context)
        scored_candidates.append((candidate, score))
    
    # Sort by score (highest first)
    scored_candidates.sort(key=lambda x: x[1], reverse=True)
    
    return scored_candidates


def beam_search_top_candidates(
    scored_candidates: List[Tuple[OverlayElement, float]],
    top_n: int = 5,
    beam_width: int = 10
) -> List[OverlayElement]:
    """
    Use beam search to find best combinations of candidates
    
    Args:
        scored_candidates: List of (element, score) tuples
        top_n: Number of top candidates to return
        beam_width: Beam width for search
    
    Returns:
        List of top N overlay elements
    """
    # For now, simple approach: just return top N by score
    # In production, could implement more sophisticated beam search
    # that considers element combinations and avoids overlaps
    
    # Sort by score
    sorted_candidates = sorted(scored_candidates, key=lambda x: x[1], reverse=True)
    
    # Filter to avoid overlaps (simple greedy)
    selected = []
    for candidate, score in sorted_candidates:
        if len(selected) >= top_n:
            break
        
        # Check if overlaps with any selected
        overlaps = False
        for selected_elem in selected:
            if _boxes_overlap(candidate.box, selected_elem.box):
                overlaps = True
                break
        
        if not overlaps:
            selected.append(candidate)
    
    # If we don't have enough non-overlapping, add best ones anyway
    while len(selected) < top_n and len(selected) < len(sorted_candidates):
        for candidate, score in sorted_candidates:
            if candidate not in selected:
                selected.append(candidate)
                break
        if len(selected) >= len(sorted_candidates):
            break
    
    return selected[:top_n]


# ============================================================================
# High-Level API
# ============================================================================

async def generate_ai_text_overlay(
    image_base64: str,
    text_elements: List[Dict[str, Any]],
    brand_kit: Optional[BrandKit] = None,
    safe_zone: Optional[SafeZone] = None,
    grid: Optional[GridSystem] = None,
    typographic_scale: Optional[TypographicScale] = None,
    top_n: int = 3,
    use_template: bool = True,
    use_cache: bool = True,
    preferred_composition: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    High-level API to generate AI-optimized text overlay candidates
    Enhanced with templates, caching, and analytics (Phases 5-10)
    
    Args:
        image_base64: Base64 encoded image
        text_elements: List of {text, role} dictionaries where role is OverlayRole enum value
        brand_kit: Optional brand kit (uses default if not provided)
        safe_zone: Optional safe zone (uses default if not provided)
        grid: Optional grid system (uses default if not provided)
        typographic_scale: Optional typographic scale (uses default if not provided)
        top_n: Number of top candidates to return
        use_template: Whether to use template library (Phase 5)
        use_cache: Whether to use analysis cache (Phase 9)
    
    Returns:
        List of candidate overlay configurations (as dictionaries)
    """
    # Decode image
    img_data = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(img_data))
    
    # Use defaults if not provided
    if brand_kit is None:
        brand_kit = create_default_brand_kit()
    if safe_zone is None:
        safe_zone = create_default_safe_zone()
    if grid is None:
        grid = create_default_grid()
    if typographic_scale is None:
        typographic_scale = create_default_typographic_scale()
    
    # Convert text_elements to use OverlayRole enum
    processed_elements = []
    roles = []
    for elem in text_elements:
        role_str = elem.get('role', 'headline')
        try:
            role = OverlayRole(role_str.lower())
        except ValueError:
            role = OverlayRole.HEADLINE
        
        processed_elements.append({
            'text': elem.get('text', ''),
            'role': role
        })
        roles.append(role)
    
    # Phase 5: Try template matching first
    template_library = TemplateLibrary()
    template = None
    template_elements = []
    
    # Convert preferred_composition string to CompositionType if provided
    preferred_composition_type = None
    if preferred_composition:
        try:
            preferred_composition_type = CompositionType(preferred_composition)
        except ValueError:
            print(f"[WARNING] Invalid preferred_composition: {preferred_composition}, using auto")
    
    if use_template:
        template = template_library.find_matching_template(
            image.width, image.height, roles,
            preferred_composition=preferred_composition_type
        )
        
        if template:
            template_elements = template_library.apply_template(
                template, image, processed_elements
            )
    
    # Phase 9: Use cached analysis if available
    saliency_map = None
    if use_cache:
        saliency_map = _analysis_cache.get_saliency_map(image_base64)
    
    if saliency_map is None:
        saliency_map = compute_saliency_map(image)
        if use_cache:
            _analysis_cache.set_saliency_map(image_base64, saliency_map)
    
    # Generate candidates (use template elements if available, otherwise generate)
    if template_elements:
        candidates = template_elements
    else:
        candidates = generate_overlay_candidates(
            image, processed_elements, grid, safe_zone,
            typographic_scale, brand_kit
        )
    
    # Score candidates
    scored = score_candidates(
        candidates, image, grid, safe_zone, typographic_scale, brand_kit
    )
    
    # Get top N
    top_candidates = beam_search_top_candidates(scored, top_n=top_n)
    
    # Phase 6: Extract palette and check WCAG
    palette = None
    if use_cache:
        palette = _analysis_cache.get_palette(image_base64)
    
    if palette is None:
        brand_colors = [brand_kit.primary_color, brand_kit.secondary_color] if brand_kit else None
        palette = extract_color_palette(image, brand_override_colors=brand_colors)
        if use_cache:
            _analysis_cache.set_palette(image_base64, palette)
    
    # Phase 10: Record analytics
    if top_candidates:
        best_candidate = top_candidates[0]
        context = {'saliency_map': saliency_map}
        
        # Calculate metrics
        contrast_metric = ContrastScore()
        grid_metric = GridAlignmentScore(grid)
        safe_zone_metric = SafeZoneScore(safe_zone)
        saliency_metric = SaliencyScore()
        hierarchy_metric = HierarchyScore(typographic_scale)
        
        metrics = QualityMetrics(
            contrast_score=contrast_metric.score(best_candidate, image, context),
            grid_alignment_score=grid_metric.score(best_candidate, image, context),
            safe_zone_score=safe_zone_metric.score(best_candidate, image, context),
            saliency_score=saliency_metric.score(best_candidate, image, context),
            hierarchy_score=hierarchy_metric.score(best_candidate, image, context),
            overall_score=scored[0][1] if scored else 0.0,
            wcag_level=check_wcag_contrast(
                _hex_to_rgb(best_candidate.color),
                palette[0] if palette else (128, 128, 128)
            )["level"]
        )
        
        _analytics.record_overlay(
            metrics,
            template_id=template.id if template else None,
            accepted=False  # Will be updated when user accepts
        )
    
    # Convert to dictionary format for API response
    result = []
    for candidate in top_candidates:
        result.append({
            'text': candidate.text,
            'role': candidate.role.value,
            'box': {
                'x': candidate.box.x,
                'y': candidate.box.y,
                'width': candidate.box.width,
                'height': candidate.box.height,
                'use_percentage': candidate.box.use_percentage
            },
            'typography': {
                'font_name': candidate.typography.font_name,
                'font_size': candidate.typography.font_size,
                'font_weight': candidate.typography.font_weight,
                'font_style': candidate.typography.font_style,
                'line_height': candidate.typography.line_height,
                'letter_spacing': candidate.typography.letter_spacing
            },
            'effects': {
                'stroke_width': candidate.effects.stroke_width,
                'stroke_color': candidate.effects.stroke_color,
                'shadow_enabled': candidate.effects.shadow_enabled,
                'shadow_color': candidate.effects.shadow_color,
                'shadow_blur': candidate.effects.shadow_blur,
                'opacity': candidate.effects.opacity
            },
            'color': candidate.color,
            'text_align': candidate.text_align.value,
            'panel_style': candidate.panel_style.value,
            'panel_color': candidate.panel_color,
            'panel_opacity': candidate.panel_opacity,
            'rotation': candidate.rotation,
            'template_id': template.id if template else None,
            'palette': [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in palette] if palette else []
        })
    
    return result


# ============================================================================
# Phase 5: Templates and Hierarchy Consistency
# ============================================================================

class CompositionType(Enum):
    """Template composition types"""
    HERO_LEFT = "hero_left"
    HERO_RIGHT = "hero_right"
    HERO_TOP = "hero_top"
    HERO_BOTTOM = "hero_bottom"
    CENTER_STACK = "center_stack"
    SPLIT_SCREEN = "split_screen"
    ASYMMETRIC = "asymmetric"


@dataclass
class Template:
    """Template definition with role mappings"""
    id: str
    name: str
    composition: CompositionType
    aspect_ratio: Tuple[float, float]  # (width, height) ratio
    role_regions: Dict[OverlayRole, Box]  # Mapping of roles to box regions
    constraints: Dict[str, Any]  # Additional constraints
    priority: int = 0  # Higher priority = preferred


class TemplateLibrary:
    """Template library for consistent layouts"""
    
    def __init__(self):
        self.templates: List[Template] = []
        self._initialize_default_templates()
    
    def _initialize_default_templates(self):
        """Initialize default template library"""
        # Hero Left Template
        self.templates.append(Template(
            id="hero_left_16_9",
            name="Hero Left",
            composition=CompositionType.HERO_LEFT,
            aspect_ratio=(16, 9),
            role_regions={
                OverlayRole.HEADLINE: Box(10, 20, 45, 20, use_percentage=True),
                OverlayRole.SUBHEAD: Box(10, 42, 45, 15, use_percentage=True),
                OverlayRole.CTA: Box(10, 60, 35, 12, use_percentage=True),
                OverlayRole.HASHTAG: Box(10, 75, 45, 8, use_percentage=True)
            },
            constraints={"max_elements": 4},
            priority=5
        ))
        
        # Hero Right Template
        self.templates.append(Template(
            id="hero_right_16_9",
            name="Hero Right",
            composition=CompositionType.HERO_RIGHT,
            aspect_ratio=(16, 9),
            role_regions={
                OverlayRole.HEADLINE: Box(55, 20, 35, 20, use_percentage=True),
                OverlayRole.SUBHEAD: Box(55, 42, 35, 15, use_percentage=True),
                OverlayRole.CTA: Box(55, 60, 30, 12, use_percentage=True),
                OverlayRole.HASHTAG: Box(55, 75, 35, 8, use_percentage=True)
            },
            constraints={"max_elements": 4},
            priority=5
        ))
        
        # Hero Top Template
        self.templates.append(Template(
            id="hero_top_1_1",
            name="Hero Top",
            composition=CompositionType.HERO_TOP,
            aspect_ratio=(1, 1),
            role_regions={
                OverlayRole.HEADLINE: Box(10, 10, 80, 25, use_percentage=True),
                OverlayRole.SUBHEAD: Box(10, 37, 80, 18, use_percentage=True),
                OverlayRole.CTA: Box(10, 58, 60, 12, use_percentage=True),
                OverlayRole.HASHTAG: Box(10, 73, 70, 8, use_percentage=True)
            },
            constraints={"max_elements": 4},
            priority=4
        ))
        
        # Hero Bottom Template
        self.templates.append(Template(
            id="hero_bottom_16_9",
            name="Hero Bottom",
            composition=CompositionType.HERO_BOTTOM,
            aspect_ratio=(16, 9),
            role_regions={
                OverlayRole.HEADLINE: Box(10, 70, 80, 18, use_percentage=True),
                OverlayRole.SUBHEAD: Box(10, 50, 80, 15, use_percentage=True),
                OverlayRole.CTA: Box(10, 85, 60, 10, use_percentage=True),
                OverlayRole.HASHTAG: Box(75, 85, 15, 8, use_percentage=True)
            },
            constraints={"max_elements": 4},
            priority=6  # Higher priority - common for social media
        ))
        
        # Center Stack Template
        self.templates.append(Template(
            id="center_stack_1_1",
            name="Center Stack",
            composition=CompositionType.CENTER_STACK,
            aspect_ratio=(1, 1),
            role_regions={
                OverlayRole.HEADLINE: Box(10, 35, 80, 20, use_percentage=True),
                OverlayRole.SUBHEAD: Box(10, 57, 80, 15, use_percentage=True),
                OverlayRole.CTA: Box(10, 75, 60, 12, use_percentage=True)
            },
            constraints={"max_elements": 3},
            priority=3
        ))
    
    def find_matching_template(
        self,
        image_width: int,
        image_height: int,
        text_roles: List[OverlayRole],
        preferred_composition: Optional[CompositionType] = None
    ) -> Optional[Template]:
        """
        Find best matching template for image
        
        Args:
            image_width: Image width in pixels
            image_height: Image height in pixels
            text_roles: List of roles needed
            preferred_composition: Optional preferred composition type
        
        Returns:
            Best matching template or None
        """
        # Calculate aspect ratio
        aspect_ratio = (image_width / image_height) if image_height > 0 else (1, 1)
        target_ratio = (aspect_ratio, 1.0)
        
        # Score templates
        scored_templates = []
        for template in self.templates:
            # Check aspect ratio match
            template_ratio = template.aspect_ratio[0] / template.aspect_ratio[1]
            ratio_diff = abs(template_ratio - target_ratio[0])
            
            # Check role coverage
            template_roles = set(template.role_regions.keys())
            requested_roles = set(text_roles)
            role_coverage = len(template_roles & requested_roles) / max(len(requested_roles), 1)
            
            # Check composition preference
            composition_match = 1.0 if (not preferred_composition or template.composition == preferred_composition) else 0.5
            
            # Check element count
            element_count_match = 1.0 if len(text_roles) <= template.constraints.get("max_elements", 999) else 0.3
            
            # Composite score
            score = (
                template.priority * 0.3 +
                (1.0 - min(ratio_diff, 1.0)) * 0.2 +
                role_coverage * 0.3 +
                composition_match * 0.1 +
                element_count_match * 0.1
            )
            
            scored_templates.append((template, score))
        
        # Sort by score
        scored_templates.sort(key=lambda x: x[1], reverse=True)
        
        return scored_templates[0][0] if scored_templates else None
    
    def apply_template(
        self,
        template: Template,
        image: Image.Image,
        text_elements: List[Dict[str, Any]]
    ) -> List[OverlayElement]:
        """
        Apply template to image and text elements
        
        Args:
            template: Template to apply
            image: Base image
            text_elements: List of {text, role} dictionaries
        
        Returns:
            List of OverlayElement objects positioned according to template
        """
        elements = []
        
        for text_data in text_elements:
            role = text_data.get('role', OverlayRole.HEADLINE)
            text = text_data.get('text', '')
            
            if role not in template.role_regions:
                continue  # Skip if role not in template
            
            box = template.role_regions[role]
            elements.append(OverlayElement(
                role=role,
                text=text,
                box=box,
                typography=Typography(),
                effects=Effects(),
                color="#FFFFFF",
                text_align=TextAlign.LEFT,
                panel_style=PanelStyle.NONE,
                rotation=0
            ))
        
        return elements


# ============================================================================
# Phase 6: Palette and Color Quality
# ============================================================================

def extract_color_palette(
    image: Image.Image,
    n_colors: int = 5,
    brand_override_colors: Optional[List[str]] = None
) -> List[Tuple[int, int, int]]:
    """
    Extract color palette from image using k-means clustering
    Inspired by IMG.LY's color extraction
    
    Args:
        image: PIL Image
        n_colors: Number of colors to extract
        brand_override_colors: Optional list of hex colors to prioritize
    
    Returns:
        List of RGB tuples
    """
    # Resize for faster processing
    small_image = image.resize((150, 150), Image.Resampling.LANCZOS)
    
    # Convert to numpy array
    img_array = np.array(small_image)
    
    # Reshape to 2D array of pixels
    pixels = img_array.reshape(-1, 3)
    
    # Simple k-means (using basic implementation)
    # For production, use sklearn.cluster.KMeans
    centroids = _simple_kmeans(pixels, n_colors)
    
    # Sort by luminance (brightest first)
    centroids = sorted(centroids, key=lambda c: 0.299*c[0] + 0.587*c[1] + 0.114*c[2], reverse=True)
    
    # If brand colors provided, prioritize them
    if brand_override_colors:
        brand_rgb = [_hex_to_rgb(c) for c in brand_override_colors]
        centroids = brand_rgb[:min(len(brand_rgb), 2)] + centroids[:n_colors-2]
    
    return centroids[:n_colors]


def _simple_kmeans(pixels: np.ndarray, k: int, max_iter: int = 10) -> List[Tuple[int, int, int]]:
    """Simple k-means implementation"""
    # Initialize centroids randomly
    np.random.seed(42)
    centroids = pixels[np.random.choice(pixels.shape[0], k, replace=False)]
    
    for _ in range(max_iter):
        # Assign pixels to nearest centroid
        distances = np.sqrt(((pixels - centroids[:, np.newaxis])**2).sum(axis=2))
        labels = np.argmin(distances, axis=0)
        
        # Update centroids
        new_centroids = np.array([pixels[labels == i].mean(axis=0) for i in range(k)])
        
        # Check convergence
        if np.allclose(centroids, new_centroids):
            break
        
        centroids = new_centroids
    
    return [tuple(map(int, c)) for c in centroids]


def check_wcag_contrast(
    text_color: Tuple[int, int, int],
    background_color: Tuple[int, int, int]
) -> Dict[str, Any]:
    """
    Check WCAG contrast compliance
    
    Args:
        text_color: RGB tuple
        background_color: RGB tuple
    
    Returns:
        Dictionary with contrast ratio, level (AA/AAA), and compliance
    """
    contrast_ratio = _calculate_contrast_ratio(text_color, background_color)
    
    # WCAG standards
    aa_normal = 4.5  # Normal text
    aa_large = 3.0   # Large text (18pt+ or 14pt+ bold)
    aaa_normal = 7.0
    aaa_large = 4.5
    
    result = {
        "contrast_ratio": float(contrast_ratio),
        "aa_normal": contrast_ratio >= aa_normal,
        "aa_large": contrast_ratio >= aa_large,
        "aaa_normal": contrast_ratio >= aaa_normal,
        "aaa_large": contrast_ratio >= aaa_large,
        "level": "AAA" if contrast_ratio >= aaa_normal else ("AA" if contrast_ratio >= aa_normal else "FAIL")
    }
    
    return result


def select_smart_panel(
    background_busyness: float,
    background_luminance: float,
    brand_style: PanelStyle
) -> PanelStyle:
    """
    Select smart panel style based on background analysis
    
    Args:
        background_busyness: Busyness score (0-1)
        background_luminance: Average luminance (0-255)
        brand_style: Brand's preferred panel style
    
    Returns:
        Selected PanelStyle
    """
    # High busyness needs stronger panel
    if background_busyness > 0.6:
        return PanelStyle.SOLID if brand_style == PanelStyle.SOLID else PanelStyle.BLUR
    elif background_busyness > 0.4:
        return PanelStyle.BLUR if brand_style != PanelStyle.NONE else PanelStyle.GLASS
    elif background_busyness > 0.2:
        return PanelStyle.GLASS if brand_style != PanelStyle.NONE else PanelStyle.GRADIENT
    else:
        return PanelStyle.NONE if background_luminance < 128 else PanelStyle.GRADIENT


# ============================================================================
# Phase 7: Vector-First Pipeline
# ============================================================================

def render_text_as_svg(
    element: OverlayElement,
    image_width: int,
    image_height: int
) -> str:
    """
    Render text overlay as SVG vector
    
    Args:
        element: OverlayElement to render
        image_width: Image width
        image_height: Image height
    
    Returns:
        SVG string
    """
    box = element.box
    if box.use_percentage:
        x = (box.x / 100) * image_width
        y = (box.y / 100) * image_height
        width = (box.width / 100) * image_width
        height = (box.height / 100) * image_height
    else:
        x, y = box.x, box.y
        width, height = box.width, box.height
    
    # Escape text for XML
    text_escaped = element.text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # Build SVG
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{image_width}" height="{image_height}">
  <defs>
    <filter id="shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="{element.effects.shadow_blur}"/>
      <feOffset dx="{element.effects.shadow_offset_x}" dy="{element.effects.shadow_offset_y}"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.5"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <g transform="rotate({element.rotation} {x + width/2} {y + height/2})">
    {f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="{element.panel_color}" opacity="{element.panel_opacity/255}" rx="4"/>' if element.panel_style != PanelStyle.NONE else ''}
    <text 
      x="{x + width/2}" 
      y="{y + height/2}" 
      font-family="{element.typography.font_name}" 
      font-size="{element.typography.font_size}" 
      font-weight="{element.typography.font_weight}"
      fill="{element.color}"
      text-anchor="middle"
      dominant-baseline="middle"
      stroke="{element.effects.stroke_color}" 
      stroke-width="{element.effects.stroke_width}"
      opacity="{element.effects.opacity/100}"
    >{text_escaped}</text>
  </g>
</svg>'''
    
    return svg


def export_multi_ratio(
    base_image: Image.Image,
    elements: List[OverlayElement],
    ratios: List[Tuple[float, float]],
    output_format: str = "PNG"
) -> Dict[str, bytes]:
    """
    Export image with text overlays in multiple aspect ratios
    
    Args:
        base_image: Base image
        elements: List of overlay elements
        ratios: List of (width, height) ratios
        output_format: Output format (PNG, JPEG, PDF)
    
    Returns:
        Dictionary mapping ratio strings to image bytes
    """
    results = {}
    
    for ratio in ratios:
        ratio_str = f"{ratio[0]}:{ratio[1]}"
        
        # Calculate target size maintaining aspect ratio
        base_width, base_height = base_image.size
        base_ratio = base_width / base_height
        target_ratio = ratio[0] / ratio[1]
        
        if target_ratio > base_ratio:
            # Target is wider, fit to height
            new_height = base_height
            new_width = int(new_height * target_ratio)
        else:
            # Target is taller, fit to width
            new_width = base_width
            new_height = int(new_width / target_ratio)
        
        # Resize image
        resized_image = base_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Reposition elements proportionally
        scale_x = new_width / base_width
        scale_y = new_height / base_height
        
        # For now, render to PNG (vector export would use SVG)
        # In production, would use SVG flattening
        output = io.BytesIO()
        resized_image.save(output, format=output_format)
        results[ratio_str] = output.getvalue()
    
    return results


# ============================================================================
# Phase 9: Performance & Caching
# ============================================================================

class ImageAnalysisCache:
    """Cache for image analysis results"""
    
    def __init__(self, max_size: int = 100):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
        self.access_order: List[str] = []
    
    def _get_cache_key(self, image_base64: str) -> str:
        """Generate cache key from image"""
        import hashlib
        return hashlib.md5(image_base64.encode()).hexdigest()
    
    def get_saliency_map(self, image_base64: str) -> Optional[np.ndarray]:
        """Get cached saliency map"""
        key = self._get_cache_key(image_base64)
        if key in self.cache:
            self._update_access(key)
            return self.cache[key].get('saliency_map')
        return None
    
    def set_saliency_map(self, image_base64: str, saliency_map: np.ndarray):
        """Cache saliency map"""
        key = self._get_cache_key(image_base64)
        if len(self.cache) >= self.max_size:
            # Remove oldest
            oldest_key = self.access_order.pop(0)
            del self.cache[oldest_key]
        
        if key not in self.cache:
            self.cache[key] = {}
        
        self.cache[key]['saliency_map'] = saliency_map
        self._update_access(key)
    
    def get_palette(self, image_base64: str) -> Optional[List[Tuple[int, int, int]]]:
        """Get cached palette"""
        key = self._get_cache_key(image_base64)
        if key in self.cache:
            self._update_access(key)
            return self.cache[key].get('palette')
        return None
    
    def set_palette(self, image_base64: str, palette: List[Tuple[int, int, int]]):
        """Cache palette"""
        key = self._get_cache_key(image_base64)
        if len(self.cache) >= self.max_size:
            oldest_key = self.access_order.pop(0)
            del self.cache[oldest_key]
        
        if key not in self.cache:
            self.cache[key] = {}
        
        self.cache[key]['palette'] = palette
        self._update_access(key)
    
    def _update_access(self, key: str):
        """Update access order"""
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)


# Global cache instance
_analysis_cache = ImageAnalysisCache()


# ============================================================================
# Phase 10: Quality Gates and Analytics
# ============================================================================

@dataclass
class QualityMetrics:
    """Quality metrics for analytics"""
    contrast_score: float
    grid_alignment_score: float
    safe_zone_score: float
    saliency_score: float
    hierarchy_score: float
    overall_score: float
    wcag_level: str
    acceptance_rate: Optional[float] = None


class OverlayAnalytics:
    """Analytics tracking for overlay system"""
    
    def __init__(self):
        self.metrics: List[QualityMetrics] = []
        self.acceptance_count = 0
        self.rejection_count = 0
        self.template_usage: Dict[str, int] = {}
    
    def record_overlay(
        self,
        metrics: QualityMetrics,
        template_id: Optional[str] = None,
        accepted: bool = False
    ):
        """Record overlay metrics"""
        self.metrics.append(metrics)
        
        if template_id:
            self.template_usage[template_id] = self.template_usage.get(template_id, 0) + 1
        
        if accepted:
            self.acceptance_count += 1
        else:
            self.rejection_count += 1
    
    def get_acceptance_rate(self) -> float:
        """Get overall acceptance rate"""
        total = self.acceptance_count + self.rejection_count
        return self.acceptance_count / total if total > 0 else 0.0
    
    def get_average_scores(self) -> Dict[str, float]:
        """Get average quality scores"""
        if not self.metrics:
            return {}
        
        return {
            "contrast": sum(m.contrast_score for m in self.metrics) / len(self.metrics),
            "grid_alignment": sum(m.grid_alignment_score for m in self.metrics) / len(self.metrics),
            "safe_zone": sum(m.safe_zone_score for m in self.metrics) / len(self.metrics),
            "saliency": sum(m.saliency_score for m in self.metrics) / len(self.metrics),
            "hierarchy": sum(m.hierarchy_score for m in self.metrics) / len(self.metrics),
            "overall": sum(m.overall_score for m in self.metrics) / len(self.metrics)
        }
    
    def get_best_template(self) -> Optional[str]:
        """Get most used template"""
        if not self.template_usage:
            return None
        return max(self.template_usage.items(), key=lambda x: x[1])[0]


# Global analytics instance
_analytics = OverlayAnalytics()

