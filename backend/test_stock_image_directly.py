"""Test stock image fetcher directly to find the crash"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

async def test():
    print("\n=== TESTING STOCK IMAGE FETCHER DIRECTLY ===\n")
    
    try:
        from linkedpilot.utils.stock_image_fetcher import extract_image_keywords_ai
        print("[OK] Imported extract_image_keywords_ai")
        
        # Test keyword extraction
        print("\n[TEST 1] Extracting keywords...")
        keywords = await extract_image_keywords_ai(
            post_content="A professional photo about technology and innovation",
            topic="tech",
            openai_key=os.getenv("OPENAI_API_KEY", "YOUR_API_KEY_HERE")
        )
        print(f"[OK] Keywords: {keywords}")
        
    except Exception as e:
        import traceback
        print(f"\n[ERROR] Failed at keyword extraction!")
        print(f"Error: {e}")
        print("\nFull traceback:")
        print(traceback.format_exc())
        return
    
    try:
        from linkedpilot.utils.stock_image_fetcher import StockImageFetcher
        print("\n[TEST 2] Creating fetcher...")
        fetcher = StockImageFetcher(unsplash_key=None, pexels_key=None)
        print("[OK] Fetcher created")
        
        print("\n[TEST 3] Fetching image...")
        image_data = await fetcher.fetch_image(keywords, orientation="landscape")
        
        if image_data:
            print(f"[OK] Image found from {image_data['source']}")
        else:
            print("[WARNING] No image found (this is OK for testing)")
        
    except Exception as e:
        import traceback
        print(f"\n[ERROR] Failed at image fetching!")
        print(f"Error: {e}")
        print("\nFull traceback:")
        print(traceback.format_exc())

if __name__ == '__main__':
    asyncio.run(test())

