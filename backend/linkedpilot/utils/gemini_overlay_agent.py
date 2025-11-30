"""
Multi-Agent Gemini 2.5 Pro System for Expert-Grade LinkedIn Post Design
Uses Research, Orchestra, Review, and Refinement agents for professional designs
"""

import os
import base64
import io
import json
from typing import Dict, List, Optional, Tuple
from PIL import Image
import httpx
import numpy as np
from linkedpilot.adapters.llm_adapter import LLMAdapter


class GeminiOverlayAgent:
    """
    Multi-agent system using Gemini 2.5 Pro for expert-grade LinkedIn post design
    Agents: Research → Orchestra → Review → Refinement
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
        # Use Gemini 3 Pro for advanced multimodal understanding and design grid knowledge
        self.llm = LLMAdapter(api_key=self.api_key, provider="google_ai_studio", model="gemini-3-pro")
    
    def _extract_compelling_text(self, post_content: str, role: str = "headline") -> str:
        """
        Extract compelling text from post content for headlines and subtext
        Removes placeholder text and generates actual engaging copy
        """
        if not post_content or len(post_content.strip()) < 5:
            return "Engaging Content" if role == "headline" else "Discover more"
        
        post_content = post_content.strip()
        
        if role == "headline":
            # Extract first 5-8 powerful words for headline
            words = post_content.split()
            # Look for natural breaks (capitalization, punctuation)
            headline_words = []
            for i, word in enumerate(words[:10]):
                headline_words.append(word)
                # Stop at natural breaks (periods, exclamation, question marks)
                if any(punct in word for punct in ['.', '!', '?']):
                    break
                # Stop at 8 words max
                if len(headline_words) >= 8:
                    break
            
            headline = ' '.join(headline_words).rstrip('.,!?')
            # Ensure minimum length
            if len(headline) < 10:
                headline = ' '.join(words[:6]) if len(words) >= 6 else post_content[:50]
            
            return headline[:80]  # Max 80 chars
        
        else:  # subtext/body
            # Extract supporting message - prefer second sentence or middle portion
            sentences = [s.strip() for s in post_content.split('.') if s.strip()]
            
            if len(sentences) > 1:
                # Use second sentence (often the supporting message)
                subtext = sentences[1]
            elif len(sentences) > 0:
                # Use middle portion of first sentence
                mid_point = len(sentences[0]) // 2
                subtext = sentences[0][mid_point:mid_point+80]
            else:
                # Fallback: use middle portion of content
                mid_point = len(post_content) // 2
                subtext = post_content[mid_point:mid_point+80]
            
            # Clean up and ensure proper length
            subtext = subtext.strip().rstrip('.,!?')
            if len(subtext) < 15:
                # Use words 8-20 if available
                words = post_content.split()
                if len(words) > 8:
                    subtext = ' '.join(words[8:20]) if len(words) >= 20 else ' '.join(words[8:])
                else:
                    subtext = post_content[len(post_content)//3:len(post_content)//3+80]
            
            return subtext[:100]  # Max 100 chars
    
    def _calculate_adaptive_font_size(self, img_width: int, img_height: int, role: str) -> int:
        """
        Calculate font size relative to image dimensions
        Ensures text is appropriately sized for any image
        """
        base_size = min(img_width, img_height)  # Use smaller dimension for consistency
        
        if role == "headline":
            # Headline: 5-7% of image size, clamped between 48-96px
            size = int(base_size * 0.06)
            return max(48, min(96, size))
        elif role == "subtext":
            # Subtext: 2.5-4% of image size, clamped between 24-48px
            size = int(base_size * 0.035)
            return max(24, min(48, size))
        else:
            # Default: 3.5% of image size
            size = int(base_size * 0.035)
            return max(28, min(56, size))
    
    def _analyze_background_contrast(self, image_data: bytes, x_percent: float, y_percent: float, 
                                    width_percent: float, height_percent: float) -> Dict:
        """
        Analyze background at text position to determine optimal text color
        Returns contrast settings for best readability
        """
        try:
            img = Image.open(io.BytesIO(image_data))
            img_width, img_height = img.size
            
            # Calculate pixel coordinates
            x_start = int((x_percent / 100) * img_width)
            y_start = int((y_percent / 100) * img_height)
            x_end = int(((x_percent + width_percent) / 100) * img_width)
            y_end = int(((y_percent + height_percent) / 100) * img_height)
            
            # Ensure bounds
            x_start = max(0, min(img_width - 1, x_start))
            y_start = max(0, min(img_height - 1, y_start))
            x_end = max(x_start + 1, min(img_width, x_end))
            y_end = max(y_start + 1, min(img_height, y_end))
            
            # Crop region
            region = img.crop((x_start, y_start, x_end, y_end))
            
            # Convert to grayscale and calculate average luminance
            gray = region.convert('L')
            pixels = list(gray.getdata())
            avg_luminance = sum(pixels) / len(pixels) if pixels else 128
            
            # Determine text color based on background brightness
            # Threshold: 128 (middle gray)
            if avg_luminance > 140:  # Light background
                return {
                    "text_color": "#000000",  # Black text
                    "shadow_enabled": True,
                    "shadow_color": "#FFFFFF",  # White shadow for contrast
                    "shadow_blur": 15,
                    "stroke_width": 1,
                    "stroke_color": "#FFFFFF"
                }
            elif avg_luminance > 100:  # Medium-light background
                return {
                    "text_color": "#FFFFFF",  # White text
                    "shadow_enabled": True,
                    "shadow_color": "#000000",  # Black shadow
                    "shadow_blur": 25,
                    "stroke_width": 1,
                    "stroke_color": "#000000"
                }
            else:  # Dark background
                return {
                    "text_color": "#FFFFFF",  # White text
                    "shadow_enabled": True,
                    "shadow_color": "#000000",  # Black shadow
                    "shadow_blur": 28,
                    "stroke_width": 0,
                    "stroke_color": "#000000"
                }
        except Exception as e:
            print(f"[WARNING] Background contrast analysis failed: {e}")
            # Default to white text with black shadow (safe for most backgrounds)
            return {
                "text_color": "#FFFFFF",
                "shadow_enabled": True,
                "shadow_color": "#000000",
                "shadow_blur": 25,
                "stroke_width": 0,
                "stroke_color": "#000000"
            }
    
    def _compute_saliency_map(self, image_data: bytes) -> np.ndarray:
        """
        Compute saliency map using gradient and variance (lightweight, no GPU required)
        Identifies busy vs clear regions for optimal text placement
        """
        try:
            img = Image.open(io.BytesIO(image_data)).convert('RGB')
            img_array = np.array(img)
            
            # Convert to grayscale
            gray = np.mean(img_array, axis=2).astype(np.float32)
            
            # Compute gradients using numpy
            grad_y, grad_x = np.gradient(gray)
            gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
            
            # Compute local variance using convolution-like approach
            kernel_size = 5
            h, w = gray.shape
            
            # Pad image for convolution
            pad = kernel_size // 2
            padded = np.pad(gray, pad, mode='edge')
            
            # Compute local mean using numpy (more efficient)
            local_mean = np.zeros_like(gray)
            for i in range(h):
                for j in range(w):
                    local_mean[i, j] = np.mean(padded[i:i+kernel_size, j:j+kernel_size])
            
            # Compute local variance
            local_variance = np.zeros_like(gray)
            for i in range(h):
                for j in range(w):
                    region = padded[i:i+kernel_size, j:j+kernel_size]
                    local_variance[i, j] = np.var(region)
            
            # Alternative: Use scipy if available (much faster)
            try:
                from scipy import ndimage
                kernel = np.ones((kernel_size, kernel_size)) / (kernel_size * kernel_size)
                local_mean = ndimage.convolve(gray, kernel, mode='constant')
                local_mean_sq = ndimage.convolve(gray**2, kernel, mode='constant')
                local_variance = local_mean_sq - local_mean**2
            except ImportError:
                # Fallback to manual computation (already done above)
                pass
            
            # Combine gradient and variance (normalize first)
            gradient_norm = gradient_magnitude / (gradient_magnitude.max() + 1e-10)
            variance_norm = local_variance / (local_variance.max() + 1e-10)
            
            # Weighted combination
            saliency = gradient_norm * 0.6 + variance_norm * 0.4
            
            # Normalize to 0-1
            saliency = (saliency - saliency.min()) / (saliency.max() - saliency.min() + 1e-10)
            
            return saliency
            
        except Exception as e:
            print(f"[WARNING] Saliency computation failed: {e}")
            # Return uniform map (no saliency information)
            img = Image.open(io.BytesIO(image_data))
            return np.ones((img.height, img.width), dtype=np.float32) * 0.5
    
    def _select_optimal_zone(self, image_data: bytes, saliency_map: np.ndarray,
                            focal_points: List[Dict], img_width: int, img_height: int) -> Dict:
        """
        Select best zone for text placement based on saliency and focal points
        Returns optimal zone configuration
        """
        zones = [
            {"name": "left_top", "x_range": (0.10, 0.20), "y_range": (0.15, 0.30), "width": 0.65, "suitability": "headline"},
            {"name": "left_middle", "x_range": (0.10, 0.20), "y_range": (0.40, 0.55), "width": 0.68, "suitability": "subtext"},
            {"name": "right_top", "x_range": (0.75, 0.90), "y_range": (0.15, 0.30), "width": 0.60, "suitability": "headline"},
            {"name": "right_bottom", "x_range": (0.75, 0.90), "y_range": (0.65, 0.85), "width": 0.65, "suitability": "subtext"},
            {"name": "center_bottom", "x_range": (0.30, 0.70), "y_range": (0.70, 0.90), "width": 0.40, "suitability": "both"},
        ]
        
        best_zone = None
        best_score = -1
        
        for zone in zones:
            # Calculate pixel ranges
            x_start_pct, x_end_pct = zone["x_range"]
            y_start_pct, y_end_pct = zone["y_range"]
            
            x_start = int(x_start_pct * img_width)
            x_end = int(x_end_pct * img_width)
            y_start = int(y_start_pct * img_height)
            y_end = int(y_end_pct * img_height)
            
            # Ensure bounds
            x_start = max(0, min(img_width - 1, x_start))
            x_end = max(x_start + 1, min(img_width, x_end))
            y_start = max(0, min(img_height - 1, y_start))
            y_end = max(y_start + 1, min(img_height, y_end))
            
            # Calculate average saliency in zone (lower is better)
            zone_saliency = saliency_map[y_start:y_end, x_start:x_end].mean()
            
            # Check if zone avoids focal points
            avoids_focal = True
            for fp in focal_points:
                fp_x = int((fp.get("x_percent", 50) / 100) * img_width)
                fp_y = int((fp.get("y_percent", 50) / 100) * img_height)
                if x_start <= fp_x <= x_end and y_start <= fp_y <= y_end:
                    avoids_focal = False
                    break
            
            # Score: low saliency (clear area) + avoids focal points
            score = (1 - zone_saliency) * 0.7 + (1 if avoids_focal else 0) * 0.3
            
            if score > best_score:
                best_score = score
                best_zone = zone.copy()
                best_zone["x_percent"] = (x_start_pct + x_end_pct) / 2
                best_zone["y_percent"] = (y_start_pct + y_end_pct) / 2
                best_zone["score"] = score
        
        # Default to left_top if no good zone found
        if not best_zone or best_score < 0.3:
            best_zone = {
                "name": "left_top",
                "x_percent": 15,
                "y_percent": 22,
                "width": 0.65,
                "suitability": "headline",
                "score": 0.5
            }
        
        return best_zone
    
    def _score_design(self, elements: List[Dict], image_data: bytes, 
                     saliency_map: np.ndarray, img_width: int, img_height: int) -> float:
        """
        Score design quality using multiple metrics
        Returns composite score 0-1 (higher is better)
        """
        if not elements:
            return 0.0
        
        scores = {}
        
        # 1. Contrast Score (0-1)
        contrast_scores = []
        for element in elements:
            x_percent = element.get('position', [50, 50])[0]
            y_percent = element.get('position', [50, 50])[1]
            width_percent = (element.get('width', 400) / img_width) * 100
            
            contrast = self._analyze_background_contrast(
                image_data, x_percent, y_percent, width_percent, 15
            )
            # High contrast = good score
            text_color = contrast.get('text_color', '#FFFFFF')
            if text_color == '#000000':  # Black on light
                contrast_scores.append(0.9)
            elif text_color == '#FFFFFF':  # White on dark
                contrast_scores.append(0.85)
            else:
                contrast_scores.append(0.7)
        
        scores["contrast"] = np.mean(contrast_scores) if contrast_scores else 0.7
        
        # 2. Saliency Avoidance Score (0-1) - lower saliency in text areas = better
        saliency_scores = []
        for element in elements:
            x_percent = element.get('position', [50, 50])[0]
            y_percent = element.get('position', [50, 50])[1]
            width_px = element.get('width', 400)
            height_px = element.get('height', 100)
            
            x_start = int((x_percent / 100) * img_width) - width_px // 2
            x_end = x_start + width_px
            y_start = int((y_percent / 100) * img_height) - height_px // 2
            y_end = y_start + height_px
            
            x_start = max(0, min(img_width - 1, x_start))
            x_end = max(x_start + 1, min(img_width, x_end))
            y_start = max(0, min(img_height - 1, y_start))
            y_end = max(y_start + 1, min(img_height, y_end))
            
            if x_end > x_start and y_end > y_start:
                zone_saliency = saliency_map[y_start:y_end, x_start:x_end].mean()
                # Lower saliency = better (1 - saliency)
                saliency_scores.append(1 - zone_saliency)
        
        scores["saliency_avoidance"] = np.mean(saliency_scores) if saliency_scores else 0.5
        
        # 3. Hierarchy Score (0-1) - proper size difference between headline and subtext
        if len(elements) >= 2:
            headline_size = elements[0].get('font_size', 72)
            subtext_size = elements[1].get('font_size', 36)
            ratio = headline_size / subtext_size if subtext_size > 0 else 2.0
            # Ideal ratio is 1.8-2.2
            if 1.5 <= ratio <= 2.5:
                scores["hierarchy"] = 1.0
            elif 1.2 <= ratio <= 3.0:
                scores["hierarchy"] = 0.8
            else:
                scores["hierarchy"] = 0.6
        else:
            scores["hierarchy"] = 0.7
        
        # 4. Alignment Score (0-1) - left alignment is preferred
        alignment_scores = []
        for element in elements:
            align = element.get('text_align', 'left')
            if align == 'left':
                alignment_scores.append(1.0)
            elif align == 'center':
                alignment_scores.append(0.7)
            else:
                alignment_scores.append(0.5)
        
        scores["alignment"] = np.mean(alignment_scores) if alignment_scores else 0.8
        
        # 5. Readability Score (0-1) - font size appropriateness
        readability_scores = []
        for element in elements:
            font_size = element.get('font_size', 48)
            # Check if font size is reasonable (24-96px)
            if 24 <= font_size <= 96:
                readability_scores.append(1.0)
            elif 18 <= font_size <= 120:
                readability_scores.append(0.8)
            else:
                readability_scores.append(0.5)
        
        scores["readability"] = np.mean(readability_scores) if readability_scores else 0.7
        
        # Weighted composite score
        composite = (
            scores["contrast"] * 0.3 +
            scores["saliency_avoidance"] * 0.25 +
            scores["hierarchy"] * 0.2 +
            scores["alignment"] * 0.15 +
            scores["readability"] * 0.1
        )
        
        return float(composite)
    
    async def _generate_candidate(self, strategy: str, image_data: bytes, img_width: int, 
                                 img_height: int, post_content: str, call_to_action: str,
                                 brand_info: str, saliency_map: np.ndarray, 
                                 research_data: Dict) -> Dict:
        """
        Generate a single design candidate with specified strategy
        """
        # Extract text
        headline_text = self._extract_compelling_text(post_content, "headline")
        subtext_text = self._extract_compelling_text(post_content, "subtext")
        
        # Get recommendations from research data (DYNAMIC - NO HARDCODING)
        safe_zones = research_data.get('safe_zones', [])
        design_recommendations = research_data.get('design_recommendations', {})
        zone_analysis = research_data.get('visual_analysis', {}).get('zone_analysis', {})
        
        # Find best zones from research (DYNAMIC)
        headline_zone = None
        subtext_zone = None
        
        for zone in safe_zones:
            if zone.get('suitability') == 'headline' and not headline_zone:
                headline_zone = zone
            elif zone.get('suitability') == 'subtext' and not subtext_zone:
                subtext_zone = zone
        
        # Use research recommendations or fallback to analysis
        if headline_zone:
            headline_pos = [headline_zone.get('x_percent', 15), headline_zone.get('y_percent', 20)]
            headline_width = int(img_width * (headline_zone.get('width_percent', 65) / 100))
            headline_color = headline_zone.get('recommended_text_color', '#FFFFFF')
            headline_font_rec = headline_zone.get('recommended_font', 'Montserrat')
        else:
            # Fallback: Use zone analysis
            best_zone = max(zone_analysis.items(), key=lambda x: x[1].get('suitability_score', 0) if isinstance(x[1], dict) else 0)
            if isinstance(best_zone[1], dict):
                headline_pos = [best_zone[1].get('x_percent', 15), best_zone[1].get('y_percent', 20)]
                headline_width = int(img_width * 0.35)
                headline_color = best_zone[1].get('recommended_text_color', '#FFFFFF')
                headline_font_rec = design_recommendations.get('recommended_fonts', ['Montserrat'])[0] if design_recommendations.get('recommended_fonts') else 'Montserrat'
            else:
                headline_pos = [15, 20]
                headline_width = int(img_width * 0.35)
                headline_color = '#FFFFFF'
                headline_font_rec = 'Montserrat'
        
        if subtext_zone:
            subtext_pos = [subtext_zone.get('x_percent', 15), subtext_zone.get('y_percent', 45)]
            subtext_width = int(img_width * (subtext_zone.get('width_percent', 68) / 100))
            subtext_color = subtext_zone.get('recommended_text_color', '#F0F0F0')
            subtext_font_rec = subtext_zone.get('recommended_font', headline_font_rec)
        else:
            # Fallback: Position below headline
            subtext_pos = [headline_pos[0], headline_pos[1] + 25]
            subtext_width = int(img_width * 0.38)
            subtext_color = '#F0F0F0'
            subtext_font_rec = headline_font_rec
        
        # Calculate adaptive font sizes
        headline_font_size = self._calculate_adaptive_font_size(img_width, img_height, "headline")
        subtext_font_size = self._calculate_adaptive_font_size(img_width, img_height, "subtext")
        
        # Analyze contrast dynamically (override with research recommendations if available)
        headline_contrast = self._analyze_background_contrast(
            image_data, headline_pos[0], headline_pos[1], (headline_width/img_width)*100, 15
        )
        subtext_contrast = self._analyze_background_contrast(
            image_data, subtext_pos[0], subtext_pos[1], (subtext_width/img_width)*100, 12
        )
        
        # Use recommended colors from research if available (DYNAMIC)
        if headline_zone and headline_zone.get('recommended_text_color'):
            headline_contrast['text_color'] = headline_color
        if subtext_zone and subtext_zone.get('recommended_text_color'):
            subtext_contrast['text_color'] = subtext_color
        
        # Use recommended fonts from research (DYNAMIC - NO HARDCODING)
        headline_font = headline_font_rec
        subtext_font = subtext_font_rec
        
        # Create elements
        elements = [
            {
                "text": headline_text,
                "position": headline_pos,
                "font_size": headline_font_size,
                "font_name": headline_font,  # Use dynamic font from research
                "font_weight": 700,
                "font_style": "normal",
                "text_decoration": "none",
                "text_align": "left" if strategy in ["left_side", "right_side"] else "center",
                "color": headline_contrast['text_color'],
                "stroke_width": headline_contrast['stroke_width'],
                "stroke_color": headline_contrast['stroke_color'],
                "width": headline_width,
                "height": 120,
                "rotation": 0,
                "line_height": 1.22,
                "letter_spacing": 0.5,
                "opacity": 100,
                "shadow_enabled": headline_contrast['shadow_enabled'],
                "shadow_color": headline_contrast['shadow_color'],
                "shadow_blur": headline_contrast['shadow_blur'],
                "shadow_offset_x": 0,
                "shadow_offset_y": 5,
                "background_color": "transparent",
                "background_opacity": 100
            },
            {
                "text": subtext_text,
                "position": subtext_pos,
                "font_size": subtext_font_size,
                "font_name": subtext_font,  # Dynamic from research analysis
                "font_weight": 500,
                "font_style": "normal",
                "text_decoration": "none",
                "text_align": "left" if strategy in ["left_side", "right_side"] else "center",
                "color": subtext_contrast['text_color'],
                "stroke_width": subtext_contrast['stroke_width'],
                "stroke_color": subtext_contrast['stroke_color'],
                "width": subtext_width,
                "height": 90,
                "rotation": 0,
                "line_height": 1.32,
                "letter_spacing": 0,
                "opacity": 96,
                "shadow_enabled": subtext_contrast['shadow_enabled'],
                "shadow_color": subtext_contrast['shadow_color'],
                "shadow_blur": subtext_contrast['shadow_blur'],
                "shadow_offset_x": 0,
                "shadow_offset_y": 4,
                "background_color": "transparent",
                "background_opacity": 100
            }
        ]
        
        # Validate positions
        validated_elements = self._validate_positions(elements, img_width, img_height)
        
        # Score the design
        score = self._score_design(validated_elements, image_data, saliency_map, img_width, img_height)
        
        return {
            "elements": validated_elements,
            "strategy": strategy,
            "score": score,
            "template_id": f"gemini-{strategy}"
        }
    
    # Template Library
    TEMPLATES = {
        "square_left": {
            "aspect_ratio_range": (0.9, 1.1),
            "layout": "left_side",
            "headline": {"x_percent": 6, "y_percent": 18, "width_percent": 35},  # Close to border
            "subtext": {"x_percent": 6, "y_percent": 48, "width_percent": 38}   # Avoids center (40-60%)
        },
        "landscape_center": {
            "aspect_ratio_range": (1.5, 3.0),
            "layout": "left_side",  # Changed from center_bottom to keep center free
            "headline": {"x_percent": 6, "y_percent": 18, "width_percent": 35},
            "subtext": {"x_percent": 6, "y_percent": 48, "width_percent": 38}
        },
        "portrait_left": {
            "aspect_ratio_range": (0.3, 0.9),
            "layout": "left_side",
            "headline": {"x_percent": 6, "y_percent": 18, "width_percent": 38},
            "subtext": {"x_percent": 6, "y_percent": 48, "width_percent": 40}
        },
        "wide_landscape": {
            "aspect_ratio_range": (2.0, 4.0),
            "layout": "left_side",
            "headline": {"x_percent": 5, "y_percent": 15, "width_percent": 30},  # Even closer for wide
            "subtext": {"x_percent": 5, "y_percent": 45, "width_percent": 32}
        }
    }
    
    def _select_template(self, img_width: int, img_height: int, composition_type: str = "default") -> Dict:
        """
        Select best template based on aspect ratio and composition
        """
        aspect_ratio = img_width / img_height if img_height > 0 else 1.0
        
        for template_name, template in self.TEMPLATES.items():
            min_ratio, max_ratio = template["aspect_ratio_range"]
            if min_ratio <= aspect_ratio <= max_ratio:
                return template
        
        # Default to square_left if no match
        return self.TEMPLATES["square_left"]
    
    async def generate_overlay(self, 
                              image_url: str,
                              post_content: str,
                              call_to_action: str = "",
                              brand_info: str = "",
                              return_multiple: bool = True,
                              top_n: int = 3) -> Dict:
        """
        Multi-Agent Expert Design Process with Multi-Candidate Generation:
        1. Research Agent: Deep image and content analysis
        2. Compute saliency map for content-aware placement
        3. Generate multiple design candidates
        4. Score and rank candidates
        5. Return top-N candidates
        
        Args:
            image_url: URL or base64 data URL of image
            post_content: Post content text
            call_to_action: Optional CTA text
            brand_info: Optional brand information
            return_multiple: If True, return multiple candidates (default: True)
            top_n: Number of top candidates to return (default: 3)
        """
        
        print(f"[GEMINI 3 PRO] Starting multi-agent expert design process with design grid knowledge")
        
        # Step 1: Load and analyze image
        image_data, img_width, img_height = await self._load_and_analyze_image(image_url)
        
        if img_width == 0 or img_height == 0:
            raise ValueError("Invalid image dimensions")
        
        # Step 2: Compute saliency map for content-aware placement
        print(f"[SALIENCY] Computing saliency map...")
        saliency_map = self._compute_saliency_map(image_data)
        
        # Step 3: Research Agent - Deep analysis
        print(f"[RESEARCH AGENT] Analyzing image and content...")
        research_data = await self._research_agent(
            image_data, img_width, img_height, post_content, call_to_action, brand_info
        )
        
        # Step 4: Select template based on aspect ratio
        template = self._select_template(img_width, img_height)
        print(f"[TEMPLATE] Selected template: {template.get('layout', 'left_side')}")
        
        if return_multiple:
            # Generate multiple candidates with different strategies
            print(f"[MULTI-CANDIDATE] Generating {top_n + 2} design candidates...")
            strategies = ["left_side", "center_bottom", "right_side", "top_center"]
            
            candidates = []
            
            # Optionally try advanced system integration as one candidate
            try_advanced_system = True
            if try_advanced_system:
                try:
                    from ..utils.ai_text_overlay_advanced import generate_ai_text_overlay
                    image_base64 = base64.b64encode(image_data).decode()
                    
                    headline_text = self._extract_compelling_text(post_content, "headline")
                    subtext_text = self._extract_compelling_text(post_content, "subtext")
                    
                    advanced_candidates = await generate_ai_text_overlay(
                        image_base64=image_base64,
                        text_elements=[
                            {"text": headline_text, "role": "headline"},
                            {"text": subtext_text, "role": "subtext"}
                        ],
                        top_n=1
                    )
                    
                    if advanced_candidates and len(advanced_candidates) > 0:
                        # Convert advanced system format to our format
                        advanced_elements = advanced_candidates[0].get('elements', [])
                        if advanced_elements:
                            # Score the advanced candidate
                            advanced_score = self._score_design(
                                advanced_elements, image_data, saliency_map, img_width, img_height
                            )
                            candidates.append({
                                "elements": advanced_elements,
                                "strategy": "advanced_system",
                                "score": advanced_score,
                                "template_id": "advanced-system"
                            })
                            print(f"[CANDIDATE] Generated advanced_system candidate with score {advanced_score:.3f}")
                except Exception as e:
                    print(f"[WARNING] Advanced system integration failed: {e}")
                    # Continue with regular candidates
            
            # Generate regular candidates
            for strategy in strategies[:top_n + 1]:  # Generate one extra for selection
                try:
                    candidate = await self._generate_candidate(
                        strategy=strategy,
                        image_data=image_data,
                        img_width=img_width,
                        img_height=img_height,
                        post_content=post_content,
                        call_to_action=call_to_action,
                        brand_info=brand_info,
                        saliency_map=saliency_map,
                        research_data=research_data
                    )
                    candidates.append(candidate)
                    print(f"[CANDIDATE] Generated {strategy} candidate with score {candidate['score']:.3f}")
                except Exception as e:
                    print(f"[WARNING] Failed to generate {strategy} candidate: {e}")
                    continue
            
            # Sort by score (highest first)
            candidates.sort(key=lambda x: x['score'], reverse=True)
            
            # Return top-N candidates
            top_candidates = candidates[:top_n]
            
            print(f"[SUCCESS] Generated {len(top_candidates)} top candidates")
            
            return {
                "elements": top_candidates[0]["elements"] if top_candidates else [],
                "alternatives": [c["elements"] for c in top_candidates[1:]] if len(top_candidates) > 1 else [],
                "scores": {i: c["score"] for i, c in enumerate(top_candidates)},
                "strategies": [c["strategy"] for c in top_candidates],
                "template_id": f"gemini-{template.get('layout', 'left_side')}",
                "quality_score": "Expert",
                "system": "gemini-2.5-pro-multi-agent-multi-candidate",
                "research_insights": research_data.get('insights', {}),
                "saliency_used": True,
                "template_used": template.get('layout', 'left_side')
            }
        else:
            # Single candidate mode (original behavior)
            print(f"[SINGLE-CANDIDATE] Generating single design...")
            
            # Agent 2: Orchestra Agent - Design coordination
            print(f"[ORCHESTRA AGENT] Coordinating design strategy...")
            design_strategy = await self._orchestra_agent(research_data, img_width, img_height)
            
            # Agent 3: Review Agent - Quality validation
            print(f"[REVIEW AGENT] Reviewing design quality...")
            reviewed_design = await self._review_agent(
                design_strategy, image_data, img_width, img_height, post_content
            )
            reviewed_design['post_content'] = post_content
            
            # Agent 4: Refinement Agent - Final polish (with research data for dynamic decisions)
            print(f"[REFINEMENT AGENT] Refining final design...")
            refined_elements = await self._refinement_agent(
                reviewed_design, image_data, img_width, img_height, research_data
            )
            
            # Final validation
            validated_elements = self._validate_positions(refined_elements, img_width, img_height)
            
            # Score the design
            score = self._score_design(validated_elements, image_data, saliency_map, img_width, img_height)
            
            print(f"[SUCCESS] Single design generated with score {score:.3f}")
            
            return {
                "elements": validated_elements,
                "template_id": f"gemini-{template.get('layout', 'left_side')}",
                "quality_score": "Expert",
                "score": score,
                "system": "gemini-2.5-pro-multi-agent",
                "research_insights": research_data.get('insights', {}),
                "design_strategy": design_strategy.get('strategy', {}),
                "saliency_used": True,
                "template_used": template.get('layout', 'left_side')
            }
    
    async def _load_and_analyze_image(self, image_url: str) -> Tuple[bytes, int, int]:
        """Step 1: Load image and get dimensions"""
        try:
            if image_url.startswith('data:image'):
                # Extract base64 from data URL
                header, encoded = image_url.split(',', 1)
                image_data = base64.b64decode(encoded)
            else:
                # Fetch image
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(image_url)
                    image_data = response.content
            
            # Get image dimensions
            img = Image.open(io.BytesIO(image_data))
            img_width, img_height = img.size
            
            print(f"[GEMINI AGENT] Image loaded: {img_width}x{img_height}")
            return image_data, img_width, img_height
            
        except Exception as e:
            print(f"[GEMINI AGENT ERROR] Failed to load image: {e}")
            raise
    
    async def _research_agent(self,
                             image_data: bytes,
                             img_width: int,
                             img_height: int,
                             post_content: str,
                             call_to_action: str,
                             brand_info: str) -> Dict:
        """
        Research Agent: Deep analysis of image, content, and design requirements
        Analyzes visual composition, content context, and optimal placement strategies
        """
        image_base64 = base64.b64encode(image_data).decode()
        
        prompt = f"""You are a Research Agent specializing in expert LinkedIn post design analysis using design grid principles and optimal typography placement.

TASK: Analyze this image and content to create designs matching high-performing LinkedIn post examples using professional design grid systems and typography best practices.

DESIGN GRID KNOWLEDGE (Rule of Thirds: Divide image into 3x3 grid (9 equal sections). Place important elements at intersection points (1/3 and 2/3 marks).
Golden Ratio: Use 1.618 ratio for text placement and sizing (e.g., if image is 1200px wide, optimal text width is ~741px).
Typography Grid: Use baseline grid (typically 4px or 8px) for vertical rhythm. Align text to grid lines for professional appearance.
Safe Zones: Maintain 5-10% margins from edges. Text should occupy 60-70% of image width for optimal readability.
Visual Hierarchy: Headline should be 1.8-2.5x larger than subtext. Use font weight contrast (700 vs 400-500).
Optimal Font Sizing: Based on image dimensions - headline: 5-7% of image height, subtext: 2.5-4% of image height.
Text Placement Zones: 
- Left side (10-20% from left): Professional, scannable, leaves visual space
- Top (15-25% from top): Attention-grabbing, above fold
- Bottom (70-85% from top): Call-to-action placement, stable foundation

REFERENCE STYLE: Designs like "10 LinkedIn Post Examples You Can Try for Better Reach"
- Left-side text placement (professional, scannable)
- Bold headlines with strong visual impact
- Clean typography hierarchy following grid principles
- Engaging, modern layouts with proper spacing

IMAGE CONTEXT:
- Dimensions: {img_width}x{img_height} pixels (WIDTH x HEIGHT)
- Aspect Ratio: {round(img_width/img_height, 2) if img_height > 0 else 1.0}:1
- Total Area: {img_width * img_height:,} pixels
- Post Content: "{post_content}"
- Call to Action: "{call_to_action}"
- Brand Info: "{brand_info}"

CRITICAL: You MUST understand image boundaries:
- X-axis: 0 to {img_width} pixels (0% to 100%)
- Y-axis: 0 to {img_height} pixels (0% to 100%)
- Left edge: x = 0 (0%)
- Right edge: x = {img_width} (100%)
- Top edge: y = 0 (0%)
- Bottom edge: y = {img_height} (100%)
- Safe margins: 5% from all edges ({int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical)

RESEARCH ANALYSIS REQUIRED:

1. VISUAL COMPOSITION ANALYSIS (CRITICAL):
   - Identify ALL faces, people, or main subjects in the image
   - Note their positions (x, y coordinates or percentage)
   - Identify logos, branding, or important visual elements
   - Analyze LEFT SIDE of image (10-30% from left edge) - is it clear for text?
   - Detect visual complexity: Is left side busy or clear?
   - Identify color schemes and contrast zones (especially left side)
   - Note any existing text, logos, or graphics to avoid
   - Determine if left side has sufficient contrast for white text

2. CONTENT ANALYSIS:
   - Extract compelling headline from post content (5-8 powerful words)
   - Identify supporting message or CTA (8-12 words)
   - Determine emotional tone (professional, inspirational, educational)
   - Analyze content type and engagement potential

3. LEFT-SIDE SAFE ZONE IDENTIFICATION (CRITICAL):
   - Image width: {img_width}px, height: {img_height}px
   - PRIMARY: Left side zones (10-20% from left = {int(img_width * 0.10)}-{int(img_width * 0.20)}px)
   - Headline zone: 18-25% from top ({int(img_height * 0.18)}-{int(img_height * 0.25)}px)
   - Subtext zone: 42-50% from top ({int(img_height * 0.42)}-{int(img_height * 0.50)}px)
   - Text width: 60-70% of image width ({int(img_width * 0.60)}-{int(img_width * 0.70)}px)
   - CRITICAL: Ensure left side zones DO NOT overlap with faces, people, or main subjects
   - Identify left-side areas with high contrast for readability
   - Determine left-side zones with low visual complexity
   - Ensure right side remains open for visual elements ({int(img_width * 0.70)}-{img_width}px)
   - Maintain 5% margin from all edges ({int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical)
   - If left side is too busy or has faces, recommend alternative zones

4. DESIGN RECOMMENDATIONS (LinkedIn Best Practices):
   - Layout: LEFT-SIDE TEXT (like high-performing examples)
   - Typography: Bold headlines (64-80px), medium subtext (32-40px)
   - Colors: White (#FFFFFF) for headlines, light gray (#F0F0F0) for subtext
   - Effects: Strong shadows (25-30px blur) for depth and readability
   - Text alignment: LEFT (not center) for professional LinkedIn style

Return comprehensive JSON research report:
{{
  "visual_analysis": {{
    "main_elements": ["element1", "element2"],
    "faces_detected": [{{"x_percent": 70, "y_percent": 50, "width_percent": 15, "height_percent": 20, "importance": "high"}}],
    "subjects_detected": [{{"x_percent": 65, "y_percent": 45, "type": "person/object", "importance": "high"}}],
    "focal_points": [{{"x_percent": 50, "y_percent": 40, "importance": "high"}}],
    "zone_analysis": {{
      "left_edge": {{"clarity": "high/medium/low", "contrast": "high/medium/low", "has_faces": false, "recommended_text_color": "#FFFFFF/#000000", "suitability_score": 0.9}},
      "right_edge": {{"clarity": "high/medium/low", "contrast": "high/medium/low", "has_faces": false, "recommended_text_color": "#FFFFFF/#000000", "suitability_score": 0.8}},
      "top_center": {{"clarity": "high/medium/low", "contrast": "high/medium/low", "has_faces": false, "recommended_text_color": "#FFFFFF/#000000", "suitability_score": 0.7}},
      "bottom_center": {{"clarity": "high/medium/low", "contrast": "high/medium/low", "has_faces": false, "recommended_text_color": "#FFFFFF/#000000", "suitability_score": 0.6}},
      "center": {{"clarity": "high/medium/low", "should_avoid": true/false, "reason": "..."}}
    }},
    "complexity_map": "high/low/medium zones",
    "color_scheme": {{"dominant_colors": ["#hex1", "#hex2"], "contrast_level": "high/medium/low", "image_mood": "corporate/creative/minimalist/bold"}},
    "existing_graphics": ["logos", "text", "icons"],
    "image_style": "corporate/creative/minimalist/bold/professional"
  }},
  "content_analysis": {{
    "key_messages": ["message1", "message2"],
    "tone": "professional/inspirational/educational/promotional",
    "content_type": "type",
    "cta_style": "urgent/soft/informational"
  }},
  "safe_zones": [
    {{
      "zone_name": "best_zone_for_headline",
      "x_percent": [DYNAMIC - analyze and recommend],
      "y_percent": [DYNAMIC - analyze and recommend],
      "width_percent": [DYNAMIC - based on image and text length],
      "height_percent": [DYNAMIC - based on font size],
      "confidence": 0.95,
      "reason": "[DYNAMIC - explain why this zone is best based on analysis]",
      "suitability": "headline",
      "recommended_text_color": "[DYNAMIC - white/black based on background]",
      "recommended_font": "[DYNAMIC - suggest font based on image style]",
      "avoids_faces": true,
      "avoids_subjects": true
    }},
    {{
      "zone_name": "best_zone_for_subtext",
      "x_percent": [DYNAMIC - analyze and recommend],
      "y_percent": [DYNAMIC - analyze and recommend],
      "width_percent": [DYNAMIC - based on image and text length],
      "height_percent": [DYNAMIC - based on font size],
      "confidence": 0.95,
      "reason": "[DYNAMIC - explain why this zone is best based on analysis]",
      "suitability": "subtext",
      "recommended_text_color": "[DYNAMIC - white/black based on background]",
      "recommended_font": "[DYNAMIC - suggest font based on image style]",
      "avoids_faces": true,
      "avoids_subjects": true
    }}
  ],
  "design_recommendations": {{
    "recommended_fonts": ["Montserrat", "Roboto", "Inter"] or ["Playfair Display", "Lora"] based on image style,
    "recommended_colors": ["#FFFFFF", "#000000"] or corporate palette based on image,
    "recommended_shadow": "subtle/heavy/none" based on background,
    "layout_style": "minimalist/corporate/creative" based on image analysis
  }},
  "design_recommendations": {{
    "typography_style": "bold/modern/elegant",
    "color_palette": ["#FFFFFF", "#000000"],
    "text_hierarchy": "headline + subtext",
    "layout_pattern": "top_bottom",
    "readability_score": 0.9
  }},
  "insights": {{
    "key_findings": ["finding1", "finding2"],
    "design_opportunities": ["opportunity1"],
    "potential_challenges": ["challenge1"]
  }}
}}

Be thorough and professional - this research will inform expert design decisions."""
        
        try:
            response = await self.llm.generate_completion_with_image(
                prompt=prompt,
                image_base64=image_base64,
                temperature=0.2  # Lower temperature for research accuracy
            )
            
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            research_data = json.loads(response_text.strip())
            print(f"[RESEARCH AGENT] Analysis complete: {len(research_data.get('safe_zones', []))} safe zones identified")
            return research_data
            
        except Exception as e:
            print(f"[RESEARCH AGENT ERROR] {e}")
            import traceback
            traceback.print_exc()
            # Fallback research data
            return self._get_fallback_research(img_width, img_height, post_content)
    
    async def _orchestra_agent(self, research_data: Dict, img_width: int, img_height: int) -> Dict:
        """
        Orchestra Agent: Coordinates overall design strategy for expert-grade LinkedIn posts
        Creates designs similar to professional LinkedIn post examples with engaging layouts
        """
        research_json = json.dumps(research_data, indent=2)
        
        prompt = f"""You are an Orchestra Agent creating expert-grade LinkedIn post designs.

TASK: Design a professional, engaging LinkedIn post overlay similar to high-performing examples.

REFERENCE DESIGN STYLE (Corporate LinkedIn Templates - Freepik Style):
- Clean, minimalist corporate design with professional identity
- Text can be positioned strategically: left edge, center-top, or center-bottom
- Bold, impactful headlines (64-80px) with premium typography
- Supporting subtext (32-40px) with clear hierarchy
- Professional color schemes: white/black text with subtle shadows
- Corporate color palettes: blues, grays, professional tones
- Minimalist backgrounds with ample negative space
- Modern, sophisticated layouts that convey professionalism
- Text often uses geometric shapes or subtle backgrounds for contrast

RESEARCH DATA:
{research_json}

IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px (0-100% = 0-{img_width}px)
- Height: {img_height}px (0-100% = 0-{img_height}px)
- Left edge: x=0px (0%), Right edge: x={img_width}px (100%)
- Top edge: y=0px (0%), Bottom edge: y={img_height}px (100%)
- Safe left zone: {int(img_width * 0.10)}-{int(img_width * 0.20)}px (10-20%)
- Maximum text width: {int(img_width * 0.70)}px (70% of image width)
- Headline vertical zone: {int(img_height * 0.15)}-{int(img_height * 0.30)}px (15-30%)
- Subtext vertical zone: {int(img_height * 0.40)}-{int(img_height * 0.55)}px (40-55%)

DESIGN REQUIREMENTS:

1. LAYOUT STRATEGY (Corporate Template Style):
   - Multiple placement options: left edge, center-top, or center-bottom
   - Keep center area (40-60%) free for visual elements
   - Use vertical stacking for headline + subtext
   - Create visual balance with ample negative space
   - Minimalist approach: less is more
   - Professional spacing and alignment

2. TYPOGRAPHY HIERARCHY:
   - Headline: 64-80px, bold (700-900 weight), white color
   - Subtext/CTA: 32-40px, medium weight (400-600), slightly lighter white (#F0F0F0)
   - Use Montserrat (corporate standard), Roboto (clean professional), or Inter (corporate standard) font family
   - Ensure text is scannable, impactful, and conveys professionalism

3. POSITIONING (DYNAMIC FROM RESEARCH - NO HARDCODING):
   - Headline: USE Research Agent's recommended zone (best_zone_for_headline)
   - Subtext: USE Research Agent's recommended zone (best_zone_for_subtext)
   - DO NOT hardcode positions - use x_percent and y_percent from research
   - Text width: Calculate based on text length and recommended width_percent from research
   - Adapt margins based on image content and safe zones from research
   - Consider image composition - where does text complement best?

4. VISUAL EFFECTS (DYNAMIC FROM RESEARCH):
   - Text color: USE recommended_text_color from zone analysis (DYNAMIC)
   - Shadows: Determine based on background contrast and image style from research
   - Colors: USE recommended colors from design_recommendations (not hardcoded)
   - Background effects: Optional, based on image needs from research
   - Opacity: Adjust based on contrast needs
   - Style: Match image mood and style from research (corporate/creative/minimalist)

Return orchestrated design strategy:
{{
  "strategy": {{
    "design_approach": "professional_engaging",
    "element_count": 2,
    "layout_type": "left_side_text",
    "visual_flow": "left_to_right",
    "style_reference": "freepik_corporate_templates"
  }},
  "element_plan": [
    {{
      "element_id": "headline",
      "zone_assignment": "left_top",
      "content_focus": "main compelling message",
      "position_strategy": {{"x_percent": [USE research safe_zones best_zone_for_headline.x_percent], "y_percent": [USE research safe_zones best_zone_for_headline.y_percent]}},
      "typography": {{"size": [DYNAMIC adaptive], "weight": [DYNAMIC based on style], "style": "bold", "font": [USE design_recommendations.recommended_fonts[0]]}},
      "color_strategy": [USE zone_analysis recommended_text_color],
      "width_strategy": [USE safe_zones width_percent],
      "priority": 1,
      "style": "bold_impactful"
    }},
    {{
      "element_id": "subtext",
      "zone_assignment": "left_bottom",
      "content_focus": "supporting message or CTA",
      "position_strategy": {{"x_percent": [USE research safe_zones best_zone_for_subtext], "y_percent": [USE research safe_zones best_zone_for_subtext]}},
      "typography": {{"size": [DYNAMIC adaptive to image], "weight": [DYNAMIC based on image style], "style": "regular", "font": "[USE design_recommendations.recommended_fonts from research]"}},
      "color_strategy": "[USE zone_analysis.recommended_text_color from research]",
      "width_strategy": [USE safe_zones.width_percent from research],
      "priority": 2,
      "style": "supporting"
    }}
  ],
  "coordination_notes": "Professional left-side text layout with strong visual hierarchy, similar to high-performing LinkedIn post examples"
}}"""
        
        try:
            response = await self.llm.generate_completion(prompt, temperature=0.4)
            
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            strategy = json.loads(response_text.strip())
            print(f"[ORCHESTRA AGENT] Strategy created: {len(strategy.get('element_plan', []))} elements planned")
            return strategy
            
        except Exception as e:
            print(f"[ORCHESTRA AGENT ERROR] {e}")
            return self._get_fallback_strategy(research_data)
    
    async def _review_agent(self,
                           design_strategy: Dict,
                           image_data: bytes,
                           img_width: int,
                           img_height: int,
                           post_content: str) -> Dict:
        """
        Review Agent: Validates design quality against high-performing LinkedIn post examples
        Ensures designs match professional standards seen in top-performing posts
        """
        image_base64 = base64.b64encode(image_data).decode()
        strategy_json = json.dumps(design_strategy, indent=2)
        
        prompt = f"""You are a Review Agent ensuring expert-grade LinkedIn post design quality.

TASK: Review design against high-performing LinkedIn post examples (like "10 LinkedIn Post Examples" style).

DESIGN STRATEGY:
{strategy_json}

IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px, Height: {img_height}px
- Left edge: x=0px (0%), Right edge: x={img_width}px (100%)
- Top edge: y=0px (0%), Bottom edge: y={img_height}px (100%)
- Safe left zone: {int(img_width * 0.10)}-{int(img_width * 0.20)}px (10-20%)
- Maximum text width: {int(img_width * 0.70)}px (70% of image width)

POST CONTENT: "{post_content}"

EXPERT DESIGN STANDARDS (based on high-performing LinkedIn posts):

1. LAYOUT EXCELLENCE:
   - Text should be positioned on LEFT SIDE (not center)
   - Leave right side open for visual elements
   - Vertical text stacking creates clear hierarchy
   - Professional spacing between elements (8-12% gap)

2. TYPOGRAPHY EXCELLENCE:
   - Headlines: 64-80px, bold (700-900), white, strong shadows
   - Subtext: 32-40px, medium weight (500-600), slightly lighter
   - Font: Montserrat or Playfair Display (premium, elegant)
   - Text alignment: LEFT (not center) for better readability
   - Line height: 1.2-1.3 for optimal readability

3. VISUAL IMPACT:
   - Strong shadows (blur 25-30px, offset 4-6px) for depth
   - High contrast (white text on dark/medium backgrounds)
   - Professional color palette (white, light gray, brand colors)
   - Text width: 60-75% of image (leaves visual space)

4. LINKEDIN OPTIMIZATION:
   - Mobile-first: Text readable on small screens
   - Scannable: Quick to read and understand
   - Engaging: Draws attention without overwhelming
   - Professional: Matches LinkedIn's business aesthetic

5. POSITIONING VALIDATION:
   - Headline: Left side, 15-20% from top, 10-15% from left
   - Subtext: Left side, 40-50% from top, 10-15% from left
   - All text within safe bounds (10% margin from edges)
   - No overlap with important visual elements

Return review report with validated design:
{{
  "review_status": "approved",
  "quality_score": 0.95,
  "readability_score": 0.95,
  "visual_balance_score": 0.9,
  "professional_score": 0.95,
  "linkedin_optimization_score": 0.95,
  "issues_found": [],
  "recommendations": ["Ensure left-side alignment", "Use strong shadows for depth"],
  "validated_design": {{
    "elements": [
      {{
        "text": "Extract compelling headline from content (5-8 words)",
        "position": [6, 18],  // Close to border, avoid center
        "font_size": 72,
        "font_name": "Montserrat",  // Premium font
        "font_weight": 700,
        "font_style": "normal",
        "text_decoration": "none",
        "text_align": "left",
        "color": "#FFFFFF",
        "stroke_width": 0,
        "stroke_color": "#000000",
        "width": {int(img_width * 0.65)},
        "height": 120,
        "rotation": 0,
        "line_height": 1.2,
        "letter_spacing": 0,
        "opacity": 100,
        "shadow_enabled": true,
        "shadow_color": "#000000",
        "shadow_blur": 25,
        "shadow_offset_x": 0,
        "shadow_offset_y": 5,
        "background_color": "transparent",
        "background_opacity": 100
      }},
      {{
        "text": "Extract supporting message or CTA",
        "position": [6, 48],  // Close to border, below center
        "font_size": 38,
        "font_name": "Montserrat",  // Premium font
        "font_weight": 500,
        "font_style": "normal",
        "text_decoration": "none",
        "text_align": "left",
        "color": "#F0F0F0",
        "stroke_width": 0,
        "stroke_color": "#000000",
        "width": {int(img_width * 0.68)},  // 68% of image width ({img_width}px * 0.68 = {int(img_width * 0.68)}px)
        "height": 90,
        "rotation": 0,
        "line_height": 1.3,
        "letter_spacing": 0,
        "opacity": 95,
        "shadow_enabled": true,
        "shadow_color": "#000000",
        "shadow_blur": 20,
        "shadow_offset_x": 0,
        "shadow_offset_y": 4,
        "background_color": "transparent",
        "background_opacity": 100
      }}
    ]
  }},
  "review_notes": "Design matches high-performing LinkedIn post examples with left-side text layout and professional typography"
}}"""
        
        try:
            response = await self.llm.generate_completion_with_image(
                prompt=prompt,
                image_base64=image_base64,
                temperature=0.3
            )
            
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            review = json.loads(response_text.strip())
            print(f"[REVIEW AGENT] Review complete: Quality score {review.get('quality_score', 0)}")
            return review
            
        except Exception as e:
            print(f"[REVIEW AGENT ERROR] {e}")
            return self._get_fallback_review(design_strategy, img_width, img_height)
    
    async def _refinement_agent(self,
                               reviewed_design: Dict,
                               image_data: bytes,
                               img_width: int,
                               img_height: int,
                               research_data: Optional[Dict] = None) -> List[Dict]:
        """
        Refinement Agent: Polishes final design using DYNAMIC analysis from Research Agent
        Uses research recommendations for fonts, colors, and positioning (NO HARDCODING)
        """
        image_base64 = base64.b64encode(image_data).decode()
        design_json = json.dumps(reviewed_design.get('validated_design', {}), indent=2)
        post_content = reviewed_design.get('post_content', '')
        
        # Get dynamic recommendations from research (NO HARDCODING)
        safe_zones = research_data.get('safe_zones', []) if research_data else []
        design_recommendations = research_data.get('design_recommendations', {}) if research_data else {}
        zone_analysis = research_data.get('visual_analysis', {}).get('zone_analysis', {}) if research_data else {}
        
        # Find recommended zones from research
        headline_zone = next((z for z in safe_zones if z.get('suitability') == 'headline'), None)
        subtext_zone = next((z for z in safe_zones if z.get('suitability') == 'subtext'), None)
        
        # Extract actual compelling text upfront
        headline_text = self._extract_compelling_text(post_content, "headline")
        subtext_text = self._extract_compelling_text(post_content, "subtext")
        
        # Use DYNAMIC positioning from research (NO HARDCODING)
        if headline_zone:
            headline_pos_x = headline_zone.get('x_percent', 15)
            headline_pos_y = headline_zone.get('y_percent', 20)
            headline_width_pct = headline_zone.get('width_percent', 65)
            headline_color_rec = headline_zone.get('recommended_text_color', '#FFFFFF')
            headline_font_rec = headline_zone.get('recommended_font', design_recommendations.get('recommended_fonts', ['Montserrat'])[0] if design_recommendations.get('recommended_fonts') else 'Montserrat')
        else:
            # Fallback: Use zone analysis or adaptive calculation
            headline_pos_x = 15
            headline_pos_y = 20
            headline_width_pct = 65
            headline_color_rec = '#FFFFFF'
            headline_font_rec = design_recommendations.get('recommended_fonts', ['Montserrat'])[0] if design_recommendations.get('recommended_fonts') else 'Montserrat'
        
        if subtext_zone:
            subtext_pos_x = subtext_zone.get('x_percent', 15)
            subtext_pos_y = subtext_zone.get('y_percent', 45)
            subtext_width_pct = subtext_zone.get('width_percent', 68)
            subtext_color_rec = subtext_zone.get('recommended_text_color', '#F0F0F0')
            subtext_font_rec = subtext_zone.get('recommended_font', headline_font_rec)
        else:
            subtext_pos_x = headline_pos_x
            subtext_pos_y = headline_pos_y + 25
            subtext_width_pct = 68
            subtext_color_rec = '#F0F0F0'
            subtext_font_rec = headline_font_rec
        
        # Calculate adaptive widths and font sizes
        headline_width = int(img_width * (headline_width_pct / 100))
        subtext_width = int(img_width * (subtext_width_pct / 100))
        headline_font_size = self._calculate_adaptive_font_size(img_width, img_height, "headline")
        subtext_font_size = self._calculate_adaptive_font_size(img_width, img_height, "subtext")
        
        # Analyze background contrast at DYNAMIC positions (not hardcoded)
        headline_contrast = self._analyze_background_contrast(
            image_data, headline_pos_x, headline_pos_y, headline_width_pct, 15
        )
        subtext_contrast = self._analyze_background_contrast(
            image_data, subtext_pos_x, subtext_pos_y, subtext_width_pct, 12
        )
        
        # Override with research recommendations if available
        if headline_color_rec and headline_color_rec != '#FFFFFF':
            headline_contrast['text_color'] = headline_color_rec
        if subtext_color_rec and subtext_color_rec != '#F0F0F0':
            subtext_contrast['text_color'] = subtext_color_rec
        
        prompt = f"""You are a Refinement Agent creating expert-grade LinkedIn post designs.

CRITICAL: You MUST use the actual extracted text provided below. Do NOT use placeholder text or instructions like "Extract...". Use the real headline and subtext text exactly as provided.

EXTRACTED TEXT (USE THESE EXACTLY):
- Headline: "{headline_text}"
- Subtext: "{subtext_text}"

You are a Refinement Agent creating expert-grade LinkedIn post designs.

TASK: Create polished, professional design matching high-performing LinkedIn post examples.

REFERENCE STYLE: Designs like "10 LinkedIn Post Examples You Can Try for Better Reach"
- Clean, modern typography
- Left-side text placement
- Bold headlines with strong shadows
- Professional color schemes
- Engaging, scannable layouts

REVIEWED DESIGN:
{design_json}

POST CONTENT: "{post_content}"
IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px (0-100% = 0-{img_width}px)
- Height: {img_height}px (0-100% = 0-{img_height}px)
- Left boundary: x=0px (0%)
- Right boundary: x={img_width}px (100%)
- Top boundary: y=0px (0%)
- Bottom boundary: y={img_height}px (100%)
- Safe margins: 5% = {int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical

REFINEMENT REQUIREMENTS:

1. TEXT EXTRACTION & OPTIMIZATION:
   - USE THE EXACT TEXT PROVIDED ABOVE: "{headline_text}" for headline and "{subtext_text}" for subtext
   - DO NOT use placeholder text like "Extract..." or "Generate..."
   - The text has already been extracted - use it exactly as provided
   - Ensure text is scannable and impactful
   - Match tone to LinkedIn professional standards

2. POSITIONING (DYNAMIC FROM RESEARCH - NO HARDCODING):
   - Headline: USE Research Agent's recommended position: x={headline_pos_x}%, y={headline_pos_y}%
   - Subtext: USE Research Agent's recommended position: x={subtext_pos_x}%, y={subtext_pos_y}%
   - DO NOT hardcode positions - use research recommendations
   - Text alignment: Determine based on image composition and research recommendations
   - Width: Use recommended width_percent from research: headline={headline_width_pct}%, subtext={subtext_width_pct}%

3. TYPOGRAPHY EXCELLENCE (DYNAMIC FROM RESEARCH):
   - Headline: {headline_font_size}px (adaptive to image size), weight 700-800
   - Subtext: {subtext_font_size}px (adaptive to image size), weight 500-600
   - Font: USE Research Agent's recommendation: "{headline_font_rec}" for headline, "{subtext_font_rec}" for subtext
   - DO NOT hardcode font names - use research recommendations based on image style
   - Line height: 1.2-1.25 for headlines, 1.3-1.35 for subtext
   - Letter spacing: 0-1px for optimal readability

4. VISUAL EFFECTS POLISH (ADAPTIVE TO BACKGROUND):
   - Headline color: {headline_contrast['text_color']} (analyzed from background)
   - Subtext color: {subtext_contrast['text_color']} (analyzed from background)
   - Shadows: Blur {headline_contrast['shadow_blur']}px for headline, {subtext_contrast['shadow_blur']}px for subtext
   - Shadow color: {headline_contrast['shadow_color']} for headline, {subtext_contrast['shadow_color']} for subtext
   - Stroke: {headline_contrast['stroke_width']}px for headline if needed for contrast
   - Opacity: 100% for headlines, 95-98% for subtext
   - Ensure high contrast for readability (colors have been analyzed from actual image background)

5. PROFESSIONAL FINISHING:
   - All positions validated within bounds
   - Proper spacing between elements (10-15% gap)
   - Professional color harmony
   - Mobile-optimized sizing

Return refined, expert-grade elements matching high-performing LinkedIn post style:
{{
  "elements": [
    {{
      "text": "{headline_text}",
      "position": [{headline_pos_x}, {headline_pos_y}],  // DYNAMIC from research analysis
      "font_size": {headline_font_size},
      "font_name": "{headline_font_rec}",  // DYNAMIC from research - matches image style
      "font_weight": 700,
      "font_style": "normal",
      "text_decoration": "none",
      "text_align": "left",
      "color": "{headline_contrast['text_color']}",
      "stroke_width": {headline_contrast['stroke_width']},
      "stroke_color": "{headline_contrast['stroke_color']}",
      "width": {headline_width},
      "height": 120,
      "rotation": 0,
      "line_height": 1.22,
      "letter_spacing": 0.5,
      "opacity": 100,
      "shadow_enabled": {str(headline_contrast['shadow_enabled']).lower()},
      "shadow_color": "{headline_contrast['shadow_color']}",
      "shadow_blur": {headline_contrast['shadow_blur']},
      "shadow_offset_x": 0,
      "shadow_offset_y": 5,
      "background_color": "transparent",
      "background_opacity": 100
    }},
    {{
      "text": "{subtext_text}",
      "position": [6, 48],  // 6% from left (close to border), 48% from top (below center)
      "font_size": {subtext_font_size},
      "font_name": "Montserrat",  // Premium font
      "font_weight": 500,
      "font_style": "normal",
      "text_decoration": "none",
      "text_align": "left",
      "color": "{subtext_contrast['text_color']}",
      "stroke_width": {subtext_contrast['stroke_width']},
      "stroke_color": "{subtext_contrast['stroke_color']}",
      "width": {subtext_width},
      "height": 90,
      "rotation": 0,
      "line_height": 1.32,
      "letter_spacing": 0,
      "opacity": 96,
      "shadow_enabled": {str(subtext_contrast['shadow_enabled']).lower()},
      "shadow_color": "{subtext_contrast['shadow_color']}",
      "shadow_blur": {subtext_contrast['shadow_blur']},
      "shadow_offset_x": 0,
      "shadow_offset_y": 4,
      "background_color": "transparent",
      "background_opacity": 100
    }}
  ],
  "refinement_notes": "Design polished to match high-performing LinkedIn post examples with professional left-side layout, adaptive sizing, and contrast-optimized colors"
}}

CRITICAL REQUIREMENTS:
1. Use the EXACT text provided: "{headline_text}" for headline and "{subtext_text}" for subtext
2. Do NOT use placeholder text or instructions
3. Use the exact font sizes: {headline_font_size}px for headline, {subtext_font_size}px for subtext
4. Use the exact colors provided: {headline_contrast['text_color']} for headline, {subtext_contrast['text_color']} for subtext
5. Ensure professional, polished output matching the reference example"""
        
        try:
            response = await self.llm.generate_completion_with_image(
                prompt=prompt,
                image_base64=image_base64,
                temperature=0.5  # Slightly higher for creative refinement
            )
            
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            refined = json.loads(response_text.strip())
            elements = refined.get('elements', [])
            
            # Ensure it's a list
            if isinstance(elements, dict):
                elements = [elements]
            
            # Ensure text is extracted properly (fallback if LLM didn't use provided text)
            for idx, element in enumerate(elements):
                text = element.get('text', '').strip()
                is_headline = element.get('font_size', 0) > 50 or idx == 0
                
                # Check if text is placeholder or invalid
                if (not text or 
                    len(text) < 5 or 
                    text.startswith('Extract') or 
                    'extract' in text.lower() or
                    text.startswith('Generate') or
                    'placeholder' in text.lower()):
                    
                    # Use pre-extracted text
                    if is_headline:
                        element['text'] = headline_text
                    else:
                        element['text'] = subtext_text
                    
                    print(f"[REFINEMENT] Replaced placeholder text with extracted text for element {idx+1}")
                
                # Ensure adaptive font size is applied
                if is_headline and element.get('font_size', 0) != headline_font_size:
                    element['font_size'] = headline_font_size
                elif not is_headline and element.get('font_size', 0) != subtext_font_size:
                    element['font_size'] = subtext_font_size
                
                # Ensure contrast-optimized colors are applied
                if is_headline:
                    element['color'] = headline_contrast['text_color']
                    element['shadow_color'] = headline_contrast['shadow_color']
                    element['shadow_blur'] = headline_contrast['shadow_blur']
                    element['stroke_width'] = headline_contrast['stroke_width']
                    element['stroke_color'] = headline_contrast['stroke_color']
                else:
                    element['color'] = subtext_contrast['text_color']
                    element['shadow_color'] = subtext_contrast['shadow_color']
                    element['shadow_blur'] = subtext_contrast['shadow_blur']
                    element['stroke_width'] = subtext_contrast['stroke_width']
                    element['stroke_color'] = subtext_contrast['stroke_color']
            
            print(f"[REFINEMENT AGENT] Refined {len(elements)} elements to expert-grade quality")
            return elements
            
        except Exception as e:
            print(f"[REFINEMENT AGENT ERROR] {e}")
            import traceback
            traceback.print_exc()
            return reviewed_design.get('validated_design', {}).get('elements', [])
    
    def _get_fallback_research(self, img_width: int, img_height: int, post_content: str) -> Dict:
        """Fallback research data if Research Agent fails"""
        return {
            "visual_analysis": {
                "main_elements": ["background"],
                "focal_points": [{"x_percent": 50, "y_percent": 50, "importance": "medium"}],
                "complexity_map": "medium",
                "color_scheme": {"dominant_colors": ["#000000"], "contrast_level": "medium"},
                "existing_graphics": []
            },
            "content_analysis": {
                "key_messages": [post_content[:50]],
                "tone": "professional",
                "content_type": "general",
                "cta_style": "informational"
            },
            "safe_zones": [
                {
                    "zone_name": "top_center",
                    "x_percent": 50,
                    "y_percent": 15,
                    "width_percent": 80,
                    "height_percent": 20,
                    "confidence": 0.7,
                    "reason": "Default safe zone",
                    "suitability": "headline"
                },
                {
                    "zone_name": "bottom_center",
                    "x_percent": 50,
                    "y_percent": 85,
                    "width_percent": 85,
                    "height_percent": 15,
                    "confidence": 0.7,
                    "reason": "Default safe zone",
                    "suitability": "subtext"
                }
            ],
            "design_recommendations": {
                "typography_style": "modern",
                "color_palette": ["#FFFFFF", "#F0F0F0"],
                "text_hierarchy": "headline + subtext",
                "layout_pattern": "top_bottom",
                "readability_score": 0.8
            },
            "insights": {
                "key_findings": ["Using default safe zones"],
                "design_opportunities": ["Standard top-bottom layout"],
                "potential_challenges": []
            }
        }
    
    def _get_fallback_strategy(self, research_data: Dict) -> Dict:
        """Fallback strategy if Orchestra Agent fails"""
        safe_zones = research_data.get('safe_zones', [])
        return {
            "strategy": {
                "design_approach": "professional",
                "element_count": 2,
                "layout_type": "top_bottom",
                "visual_flow": "top_to_bottom"
            },
            "element_plan": [
                {
                    "element_id": "headline",
                    "zone_assignment": safe_zones[0]['zone_name'] if safe_zones else "top_center",
                    "content_focus": "main message",
                    "typography": {"size": 72, "weight": 700, "style": "bold"},
                    "color_strategy": "#FFFFFF",
                    "priority": 1
                },
                {
                    "element_id": "subtext",
                    "zone_assignment": safe_zones[1]['zone_name'] if len(safe_zones) > 1 else "bottom_center",
                    "content_focus": "supporting message",
                    "typography": {"size": 36, "weight": 400, "style": "regular"},
                    "color_strategy": "#F0F0F0",
                    "priority": 2
                }
            ],
            "coordination_notes": "Default professional layout"
        }
    
    def _get_fallback_review(self, design_strategy: Dict, img_width: int, img_height: int) -> Dict:
        """Fallback review if Review Agent fails - uses left-side layout"""
        element_plan = design_strategy.get('element_plan', [])
        elements = []
        
        for idx, plan in enumerate(element_plan[:2]):  # Max 2 elements
            is_headline = plan.get('priority') == 1 or idx == 0
            elements.append({
                "text": plan.get('content_focus', 'Text'),
                "position": [6, 18 if is_headline else 48],  # Border positioning, avoid center
                "font_size": plan.get('typography', {}).get('size', 72 if is_headline else 38),
                "font_name": "Montserrat",  # Premium font
                "font_weight": plan.get('typography', {}).get('weight', 700 if is_headline else 500),
                "font_style": plan.get('typography', {}).get('style', 'normal'),
                "text_decoration": "none",
                "text_align": "left",  # Left alignment for professional look
                "color": plan.get('color_strategy', '#FFFFFF' if is_headline else '#F0F0F0'),
                "stroke_width": 0,
                "stroke_color": "#000000",
                "width": int(img_width * (0.65 if is_headline else 0.68)),
                "height": 120 if is_headline else 90,
                "rotation": 0,
                "line_height": 1.22 if is_headline else 1.32,
                "letter_spacing": 0.5 if is_headline else 0,
                "opacity": 100 if is_headline else 96,
                "shadow_enabled": True,
                "shadow_color": "#000000",
                "shadow_blur": 28 if is_headline else 22,
                "shadow_offset_x": 0,
                "shadow_offset_y": 5 if is_headline else 4,
                "background_color": "transparent",
                "background_opacity": 100
            })
        
        return {
            "review_status": "approved",
            "quality_score": 0.85,
            "validated_design": {"elements": elements},
            "review_notes": "Default validated design with left-side layout"
        }
    
    async def _analyze_image_content(self, 
                                    image_data: bytes,
                                    img_width: int,
                                    img_height: int,
                                    post_content: str) -> Dict:
        """Step 2: Use Gemini to analyze image and identify safe zones"""
        
        # Convert image to base64 for Gemini
        image_base64 = base64.b64encode(image_data).decode()
        
        prompt = f"""You are an expert image analyst specializing in text overlay placement for social media images.

IMAGE ANALYSIS TASK:
- Image dimensions: {img_width}x{img_height} pixels
- Post content context: "{post_content[:200]}"

Analyze this image and identify SAFE ZONES where text can be placed without:
1. Overlapping important visual elements (faces, logos, key objects)
2. Being placed in areas with high visual complexity
3. Being too close to edges (maintain 10% margin)

Return a JSON object with safe zones:
{{
  "safe_zones": [
    {{
      "zone_name": "top_center",
      "x_percent": 50,
      "y_percent": 15,
      "width_percent": 80,
      "height_percent": 20,
      "confidence": 0.9,
      "reason": "Clear sky/background area"
    }},
    {{
      "zone_name": "bottom_center",
      "x_percent": 50,
      "y_percent": 85,
      "width_percent": 85,
      "height_percent": 15,
      "confidence": 0.85,
      "reason": "Lower area with less visual complexity"
    }}
  ],
  "avoid_zones": [
    {{
      "x_percent": 30,
      "y_percent": 40,
      "width_percent": 40,
      "height_percent": 30,
      "reason": "Contains important subject"
    }}
  ],
  "recommended_layout": "top_bottom" or "center" or "side_by_side"
}}

IMPORTANT:
- All percentages must be between 0-100
- Safe zones should have at least 10% margin from edges
- Recommend 2-3 safe zones maximum
- Consider image composition and visual balance
"""
        
        try:
            # Use Gemini vision API for image analysis
            # Note: generate_completion_with_image uses the LLMAdapter's internal API
            response = await self.llm.generate_completion_with_image(
                prompt=prompt,
                image_base64=image_base64,
                temperature=0.3
            )
            
            # Parse JSON response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            analysis = json.loads(response_text.strip())
            print(f"[GEMINI AGENT] Image analysis complete: {len(analysis.get('safe_zones', []))} safe zones identified")
            return analysis
            
        except Exception as e:
            print(f"[GEMINI AGENT WARNING] Image analysis failed, using default zones: {e}")
            # Fallback to safe default zones
            return {
                "safe_zones": [
                    {
                        "zone_name": "top_center",
                        "x_percent": 50,
                        "y_percent": 15,
                        "width_percent": 80,
                        "height_percent": 20,
                        "confidence": 0.7,
                        "reason": "Default safe zone"
                    },
                    {
                        "zone_name": "bottom_center",
                        "x_percent": 50,
                        "y_percent": 85,
                        "width_percent": 85,
                        "height_percent": 15,
                        "confidence": 0.7,
                        "reason": "Default safe zone"
                    }
                ],
                "recommended_layout": "top_bottom"
            }
    
    async def _generate_text_overlays(self,
                                     image_data: bytes,
                                     img_width: int,
                                     img_height: int,
                                     post_content: str,
                                     call_to_action: str,
                                     brand_info: str,
                                     safe_zones: Dict) -> List[Dict]:
        """Step 3: Generate text overlays using Gemini with validated positions"""
        
        image_base64 = base64.b64encode(image_data).decode()
        safe_zones_json = json.dumps(safe_zones.get('safe_zones', []), indent=2)
        
        prompt = f"""You are an expert graphic designer specializing in text overlay design for social media images.

TASK: Generate text overlay elements for a LinkedIn post image.

IMAGE CONTEXT:
- Dimensions: {img_width}x{img_height} pixels
- Post content: "{post_content}"
- Call to action: "{call_to_action}"
- Brand info: "{brand_info}"

SAFE ZONES (use these for placement):
{safe_zones_json}

REQUIREMENTS:
1. Generate 1-3 text elements maximum
2. Use ONLY the safe zones provided above
3. Each element must fit within its assigned safe zone
4. Text should be readable and impactful
5. Consider visual hierarchy (headline larger, subtext smaller)

Return JSON array:
[
  {{
    "text": "Main headline text (5-8 words max)",
    "position": [x_percent, y_percent],  // Center of text element (0-100)
    "font_size": 64,  // Adjust based on image size (48-96)
    "font_name": "Montserrat",  // Premium font
    "font_weight": 700,
    "font_style": "normal",
    "text_decoration": "none",
    "text_align": "left",  // Border placement, not center
    "color": "#FFFFFF",  // Choose contrasting color
    "stroke_width": 0,
    "stroke_color": "#000000",
    "width": 600,  // Max width in pixels
    "height": 100,  // Estimated height
    "rotation": 0,
    "line_height": 1.2,
    "letter_spacing": 0,
    "opacity": 100,
    "shadow_enabled": true,
    "shadow_color": "#000000",
    "shadow_blur": 20,
    "shadow_offset_x": 0,
    "shadow_offset_y": 4,
    "background_color": "transparent",
    "background_opacity": 100,
    "zone_used": "top_center"  // Which safe zone this uses
  }}
]

CRITICAL CONSTRAINTS:
- position[0] (x_percent) must be between 10-90 (10% margin from edges)
- position[1] (y_percent) must be between 10-90 (10% margin from edges)
- width must be <= 80% of image width ({int(img_width * 0.8)}px max)
- Ensure text fits within safe zone boundaries
- Use contrasting colors for readability
"""
        
        try:
            response = await self.llm.generate_completion_with_image(
                prompt=prompt,
                image_base64=image_base64,
                temperature=0.7
            )
            
            # Parse JSON response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            elements = json.loads(response_text.strip())
            
            # Ensure it's a list
            if isinstance(elements, dict) and 'elements' in elements:
                elements = elements['elements']
            elif not isinstance(elements, list):
                elements = [elements]
            
            print(f"[GEMINI AGENT] Generated {len(elements)} text overlay elements")
            return elements
            
        except Exception as e:
            print(f"[GEMINI AGENT ERROR] Text generation failed: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to basic elements
            return self._generate_fallback_elements(post_content, call_to_action, img_width, img_height)
    
    def _validate_positions(self, elements: List[Dict], img_width: int, img_height: int) -> List[Dict]:
        """
        Step 4: Validate and clamp all positions to ensure they're within image bounds
        Enforces left-side positioning and proper sizing relative to image dimensions
        """
        
        validated = []
        
        print(f"[VALIDATION] Image dimensions: {img_width}x{img_height} pixels")
        
        for idx, element in enumerate(elements):
            # Get position (should be percentage-based: [x_percent, y_percent])
            position = element.get('position', [15, 25])
            x_percent = position[0] if isinstance(position, list) and len(position) >= 1 else 15
            y_percent = position[1] if isinstance(position, list) and len(position) >= 2 else 25
            
            # Validate positions but DON'T force hardcoded values
            # Only ensure positions are within bounds and don't overlap with critical areas
            is_headline = element.get('font_size', 0) > 50 or idx == 0
            
            # Ensure minimum margin from edges (5% minimum)
            x_percent = max(5, min(95, x_percent))
            y_percent = max(5, min(95, y_percent))
            
            # Check if position is in center area (40-60% x, 40-60% y) - warn but don't force move
            # Let AI agent decide if center placement is appropriate for this image
            center_x_min, center_x_max = 40, 60
            center_y_min, center_y_max = 40, 60
            
            if center_x_min <= x_percent <= center_x_max and center_y_min <= y_percent <= center_y_max:
                # Position is in center - this is OK if AI agent determined it's best
                # Just ensure it's not too close to exact center (keep some margin)
                if abs(x_percent - 50) < 5:
                    x_percent = 45 if x_percent < 50 else 55
                if abs(y_percent - 50) < 5:
                    y_percent = 45 if y_percent < 50 else 55
                print(f"[VALIDATION] Position in center area - keeping AI agent's decision: [{x_percent}, {y_percent}]")
            
            # Validate width - convert to percentage-based, then back to pixels
            width_pixels = element.get('width', 600)
            # If width seems too large (more than 70% of image), recalculate
            width_percent = (width_pixels / img_width) * 100 if img_width > 0 else 65
            
            # Enforce proper width: 50-70% of image width for left-side layout
            if width_percent > 70:
                width_percent = 65  # Default to 65% for headlines
            elif width_percent < 50:
                width_percent = 60  # Minimum 60% for readability
            
            # Recalculate pixel width based on percentage
            width_pixels = int((width_percent / 100) * img_width)
            
            # Calculate actual pixel positions for boundary checking
            x_pixels = int((x_percent / 100) * img_width)
            y_pixels = int((y_percent / 100) * img_height)
            
            # Ensure text box fits within image bounds
            # Account for text alignment (left-aligned, so x is the left edge)
            half_width = width_pixels // 2
            margin = int(img_width * 0.05)  # 5% margin
            
            # Check left boundary
            if x_pixels < margin:
                x_percent = (margin / img_width) * 100
                x_pixels = margin
            
            # Check right boundary (text extends from x to x+width)
            if x_pixels + width_pixels > img_width - margin:
                # Move left to fit
                x_pixels = img_width - width_pixels - margin
                x_percent = (x_pixels / img_width) * 100
                # If still doesn't fit, reduce width
                if x_pixels < margin:
                    width_pixels = img_width - (2 * margin)
                    width_percent = (width_pixels / img_width) * 100
                    x_pixels = margin
                    x_percent = (margin / img_width) * 100
            
            # Check vertical boundaries
            estimated_height = element.get('height', 100)
            if y_pixels < margin:
                y_percent = (margin / img_height) * 100
            if y_pixels + estimated_height > img_height - margin:
                y_pixels = img_height - estimated_height - margin
                y_percent = (y_pixels / img_height) * 100
            
            # Update element with validated position and dimensions
            validated_element = element.copy()
            validated_element['position'] = [round(x_percent, 2), round(y_percent, 2)]
            validated_element['width'] = width_pixels
            validated_element['width_percent'] = round(width_percent, 2)  # Store percentage for reference
            
            print(f"[VALIDATION] Element {idx+1}: position=[{round(x_percent, 2)}%, {round(y_percent, 2)}%], width={width_pixels}px ({round(width_percent, 2)}%), pixels=({x_pixels}, {y_pixels})")
            
            validated.append(validated_element)
        
        print(f"[VALIDATION] Validated {len(validated)} elements - all positions within bounds")
        return validated
    
    def _generate_fallback_elements(self, post_content: str, call_to_action: str, 
                                   img_width: int, img_height: int) -> List[Dict]:
        """Fallback elements if Gemini generation fails"""
        elements = []
        
        # Main headline
        if call_to_action:
            elements.append({
                "text": call_to_action,
                "position": [6, 18],  # Close to border, avoid center
                "font_size": 72,
                "font_name": "Montserrat",  # Premium font
                "font_weight": 700,
                "font_style": "normal",
                "text_decoration": "none",
                "text_align": "center",
                "color": "#FFFFFF",
                "stroke_width": 0,
                "stroke_color": "#000000",
                "width": min(600, int(img_width * 0.8)),
                "height": 100,
                "rotation": 0,
                "line_height": 1.2,
                "letter_spacing": 0,
                "opacity": 100,
                "shadow_enabled": True,
                "shadow_color": "#000000",
                "shadow_blur": 20,
                "shadow_offset_x": 0,
                "shadow_offset_y": 4,
                "background_color": "transparent",
                "background_opacity": 100
            })
        
        # Subtext
        if post_content:
            first_sentence = post_content.split('.')[0].strip()[:100]
            elements.append({
                "text": first_sentence,
                "position": [6, 48],  # Close to border, below center
                "font_size": 36,
                "font_name": "Montserrat",  # Premium font
                "font_weight": 400,
                "font_style": "normal",
                "text_decoration": "none",
                "text_align": "center",
                "color": "#F0F0F0",
                "stroke_width": 0,
                "stroke_color": "#000000",
                "width": min(700, int(img_width * 0.8)),
                "height": 100,
                "rotation": 0,
                "line_height": 1.3,
                "letter_spacing": 0,
                "opacity": 90,
                "shadow_enabled": True,
                "shadow_color": "#000000",
                "shadow_blur": 15,
                "shadow_offset_x": 0,
                "shadow_offset_y": 2,
                "background_color": "transparent",
                "background_opacity": 100
            })
        
        return elements if elements else [{
            "text": "Add Your Text Here",
            "position": [50, 50],
            "font_size": 64,
            "font_name": "Poppins",
            "font_weight": 700,
            "font_style": "normal",
            "text_decoration": "none",
            "text_align": "center",
            "color": "#FFFFFF",
            "stroke_width": 0,
            "stroke_color": "#000000",
            "width": min(600, int(img_width * 0.8)),
            "height": 100,
            "rotation": 0,
            "line_height": 1.2,
            "letter_spacing": 0,
            "opacity": 100,
            "shadow_enabled": True,
            "shadow_color": "#000000",
            "shadow_blur": 20,
            "shadow_offset_x": 0,
            "shadow_offset_y": 4,
            "background_color": "transparent",
            "background_opacity": 100
        }]

