"""
Test script to verify Gemini 3 Pro Image Preview works
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from linkedpilot.adapters.image_adapter import ImageAdapter

async def test_gemini3_image():
    """Test Gemini 3 Pro Image Preview image generation"""
    print("=" * 60)
    print("Testing Gemini 3 Pro Image Preview")
    print("=" * 60)
    
    # Get API key from environment
    api_key = os.getenv('GOOGLE_AI_API_KEY')
    if not api_key:
        print("ERROR: GOOGLE_AI_API_KEY not found in environment")
        print("Please set GOOGLE_AI_API_KEY environment variable")
        return False
    
    print(f"API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    # Create adapter with Gemini 3 Pro Image Preview
    try:
        adapter = ImageAdapter(
            api_key=api_key,
            provider="google_ai_studio",
            model="gemini-3-pro-image-preview"
        )
        print(f"Adapter created successfully")
        print(f"  Provider: {adapter.provider}")
        print(f"  Model: {adapter.model}")
        print(f"  Base URL: {adapter.base_url}")
    except Exception as e:
        print(f"ERROR: Failed to create adapter: {e}")
        return False
    
    # Test prompt
    test_prompt = "A professional business meeting in a modern office, people collaborating around a table, natural lighting, LinkedIn post style"
    print(f"\nGenerating image with prompt:")
    print(f"  {test_prompt}")
    
    try:
        result = await adapter.generate_image(
            prompt=test_prompt,
            style="professional",
            size="1376x768"  # 16:9 aspect ratio for LinkedIn
        )
        
        print(f"\n{'='*60}")
        print("SUCCESS! Image generated")
        print(f"{'='*60}")
        print(f"URL: {result.get('url', 'N/A')[:100]}...")
        print(f"Has base64: {bool(result.get('image_base64'))}")
        print(f"Prompt: {result.get('prompt', 'N/A')[:100]}...")
        print(f"Model: {result.get('model', 'N/A')}")
        
        if result.get('url'):
            print(f"\n✓ Image URL generated successfully")
            return True
        elif result.get('image_base64'):
            print(f"\n✓ Image base64 generated successfully")
            return True
        else:
            print(f"\n✗ No image data in response")
            print(f"Result keys: {list(result.keys())}")
            return False
            
    except Exception as e:
        print(f"\n{'='*60}")
        print("ERROR: Image generation failed")
        print(f"{'='*60}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_gemini3_image())
    sys.exit(0 if success else 1)

Test script to verify Gemini 3 Pro Image Preview works
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from linkedpilot.adapters.image_adapter import ImageAdapter

async def test_gemini3_image():
    """Test Gemini 3 Pro Image Preview image generation"""
    print("=" * 60)
    print("Testing Gemini 3 Pro Image Preview")
    print("=" * 60)
    
    # Get API key from environment
    api_key = os.getenv('GOOGLE_AI_API_KEY')
    if not api_key:
        print("ERROR: GOOGLE_AI_API_KEY not found in environment")
        print("Please set GOOGLE_AI_API_KEY environment variable")
        return False
    
    print(f"API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    # Create adapter with Gemini 3 Pro Image Preview
    try:
        adapter = ImageAdapter(
            api_key=api_key,
            provider="google_ai_studio",
            model="gemini-3-pro-image-preview"
        )
        print(f"Adapter created successfully")
        print(f"  Provider: {adapter.provider}")
        print(f"  Model: {adapter.model}")
        print(f"  Base URL: {adapter.base_url}")
    except Exception as e:
        print(f"ERROR: Failed to create adapter: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test prompt
    test_prompt = "A professional business meeting in a modern office, people collaborating around a table, natural lighting, LinkedIn post style"
    print(f"\nGenerating image with prompt:")
    print(f"  {test_prompt}")
    
    try:
        result = await adapter.generate_image(
            prompt=test_prompt,
            style="professional",
            size="1376x768"  # 16:9 aspect ratio for LinkedIn
        )
        
        print(f"\n{'='*60}")
        print("SUCCESS! Image generated")
        print(f"{'='*60}")
        print(f"URL: {result.get('url', 'N/A')[:100]}...")
        print(f"Has base64: {bool(result.get('image_base64'))}")
        print(f"Prompt: {result.get('prompt', 'N/A')[:100]}...")
        print(f"Model: {result.get('model', 'N/A')}")
        
        if result.get('url'):
            print(f"\n✓ Image URL generated successfully")
            return True
        elif result.get('image_base64'):
            print(f"\n✓ Image base64 generated successfully")
            return True
        else:
            print(f"\n✗ No image data in response")
            print(f"Result keys: {list(result.keys())}")
            return False
            
    except Exception as e:
        print(f"\n{'='*60}")
        print("ERROR: Image generation failed")
        print(f"{'='*60}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_gemini3_image())
    sys.exit(0 if success else 1)

