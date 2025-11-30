#!/usr/bin/env python3
"""
Quick script to verify the brand router is properly configured.
Run this to check if the route can be imported without errors.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    print("Checking brand router import...")
    from linkedpilot.routes.brand_assistant import router as brand_router
    
    print(f"✓ Router imported successfully")
    print(f"✓ Router prefix: {brand_router.prefix}")
    
    # Check routes
    routes = [r for r in brand_router.routes if hasattr(r, 'path')]
    print(f"✓ Found {len(routes)} route(s):")
    for route in routes:
        methods = getattr(route, 'methods', set())
        path = getattr(route, 'path', 'unknown')
        print(f"  - {', '.join(methods)} {brand_router.prefix}{path}")
    
    print("\n✓ Brand router is properly configured!")
    print("\nNext step: Restart your backend server to load this route.")
    print("  cd backend")
    print("  python server.py")
    print("  # or")
    print("  uvicorn server:app --reload --port 8000")
    
except Exception as e:
    print(f"✗ Error importing brand router: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)





