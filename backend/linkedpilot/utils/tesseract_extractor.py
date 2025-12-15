"""
Tesseract OCR-based text extraction for precise text coordinates
"""
import pytesseract
from PIL import Image
import io
import base64
import json
from typing import List, Dict, Any


def extract_text_with_tesseract(image_base64: str) -> List[Dict[str, Any]]:
    """
    Extract text from image using Tesseract OCR with exact bounding box coordinates.
    
    Args:
        image_base64: Base64-encoded image string
        
    Returns:
        List of text elements with bounding boxes and properties
    """
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(image_bytes))
        img_width, img_height = img.size
        
        # Use Tesseract to get detailed text data with bounding boxes
        # Use PSM 11 (Sparse text) for better detection of text overlays on images
        # Use OEM 3 (Default, based on what is available)
        # Try multiple PSM modes for better detection
        tesseract_configs = [
            r'--oem 3 --psm 11',  # Sparse text - best for text overlays
            r'--oem 3 --psm 6',   # Single uniform block - fallback
            r'--oem 3 --psm 12',  # Sparse text with OSD - another option
        ]
        
        data = None
        for config in tesseract_configs:
            try:
                data = pytesseract.image_to_data(img, config=config, output_type=pytesseract.Output.DICT)
                # Check if we got any text
                if any(text.strip() for text in data['text'] if text):
                    print(f"[TESSERACT] Successfully extracted text using config: {config}")
                    break
            except Exception as e:
                print(f"[TESSERACT] Config {config} failed: {e}")
                continue
        
        if not data:
            print("[TESSERACT] All configs failed, trying default PSM 11")
            try:
                tesseract_config = r'--oem 3 --psm 11'
                data = pytesseract.image_to_data(img, config=tesseract_config, output_type=pytesseract.Output.DICT)
            except Exception as e:
                print(f"[TESSERACT] Default config also failed: {e}")
                return []
        
        extracted_elements = []
        current_text = []
        current_bbox = None
        current_line = None
        current_conf = 0
        
        # Group words into text blocks (lines)
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            # Skip empty text and very low confidence detections (lowered threshold for better detection)
            if not text or conf < 20:
                continue
            
            left = data['left'][i]
            top = data['top'][i]
            width = data['width'][i]
            height = data['height'][i]
            level = data['level'][i]
            line_num = data['line_num'][i]
            
            # Start a new text block if this is a new line or word
            if level == 5:  # Word level
                if current_line != line_num:
                    # Save previous line if exists
                    if current_text and current_bbox:
                        text_content = ' '.join(current_text)
                        avg_conf = current_conf / len(current_text) if current_text else 0
                        # Calculate font size from height (approximate)
                        font_size = max(12, min(200, int(current_bbox['height'] * 0.8)))
                        extracted_elements.append({
                            'text': text_content,
                            'bbox': {
                                'x': current_bbox['x'],
                                'y': current_bbox['y'],
                                'width': current_bbox['width'],
                                'height': current_bbox['height']
                            },
                            'bbox_percent': {
                                'x_percent': (current_bbox['x'] / img_width) * 100,
                                'y_percent': (current_bbox['y'] / img_height) * 100,
                                'width_percent': (current_bbox['width'] / img_width) * 100,
                                'height_percent': (current_bbox['height'] / img_height) * 100
                            },
                            'confidence': avg_conf / 100.0 if avg_conf > 0 else 0.8,
                            'font_size': font_size,
                            'line_height': 1.2,
                            'font_weight': 400,
                            'text_align': 'left',
                            'color': '#000000',  # Default, will need color detection separately
                            'letter_spacing': 0,
                            'shadow_enabled': False,
                            'background_color': 'transparent',
                            'is_baked_in': True
                        })
                    
                    # Start new line
                    current_text = [text]
                    current_bbox = {
                        'x': left,
                        'y': top,
                        'width': width,
                        'height': height
                    }
                    current_line = line_num
                    current_conf = conf
                else:
                    # Same line, append word and expand bbox
                    current_text.append(text)
                    current_conf += conf
                    # Expand bounding box to include this word
                    right = left + width
                    bottom = top + height
                    current_bbox['width'] = max(current_bbox['x'] + current_bbox['width'], right) - current_bbox['x']
                    current_bbox['height'] = max(current_bbox['y'] + current_bbox['height'], bottom) - current_bbox['y']
        
        # Add the last line if exists
        if current_text and current_bbox:
            text_content = ' '.join(current_text)
            avg_conf = current_conf / len(current_text) if current_text else 0
            font_size = max(12, min(200, int(current_bbox['height'] * 0.8)))
            extracted_elements.append({
                'text': text_content,
                'bbox': {
                    'x': current_bbox['x'],
                    'y': current_bbox['y'],
                    'width': current_bbox['width'],
                    'height': current_bbox['height']
                },
                'bbox_percent': {
                    'x_percent': (current_bbox['x'] / img_width) * 100,
                    'y_percent': (current_bbox['y'] / img_height) * 100,
                    'width_percent': (current_bbox['width'] / img_width) * 100,
                    'height_percent': (current_bbox['height'] / img_height) * 100
                },
                'confidence': avg_conf / 100.0 if avg_conf > 0 else 0.8,
                'font_size': font_size,
                'line_height': 1.2,
                'font_weight': 400,
                'text_align': 'left',
                'color': '#000000',
                'letter_spacing': 0,
                'shadow_enabled': False,
                'background_color': 'transparent',
                'is_baked_in': True
            })
        
        print(f"[TESSERACT] Extracted {len(extracted_elements)} text elements")
        if len(extracted_elements) == 0:
            print("[TESSERACT] WARNING: No text elements found. This might be normal if image has no text.")
        
        return extracted_elements
        
    except Exception as e:
        print(f"[TESSERACT] Error extracting text: {e}")
        import traceback
        traceback.print_exc()
        print("[TESSERACT] Returning empty list - will fall back to Gemini Vision")
        return []






