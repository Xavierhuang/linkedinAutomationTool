"""Test if Stripe keys can be retrieved right now"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from linkedpilot.routes.billing import get_stripe_keys

async def test():
    print("\n=== TESTING STRIPE KEY RETRIEVAL ===\n")
    
    secret, publishable, webhook, price = await get_stripe_keys()
    
    if secret:
        print(f"[OK] Stripe Secret Key: {secret[:15]}...{secret[-4:]}")
    else:
        print("[ERROR] Stripe Secret Key: NOT FOUND")
    
    if publishable:
        print(f"[OK] Stripe Publishable Key: {publishable[:15]}...{publishable[-4:]}")
    else:
        print("[ERROR] Stripe Publishable Key: NOT FOUND")
    
    if webhook:
        print(f"[OK] Webhook Secret: {webhook[:15]}...{webhook[-4:]}")
    else:
        print("[ERROR] Webhook Secret: NOT FOUND")
    
    if price:
        print(f"[OK] Price ID: {price}")
    else:
        print("[ERROR] Price ID: NOT FOUND")
    
    print()
    
    if secret or publishable or webhook or price:
        print("[CONCLUSION] Keys ARE in database!")
        print("The issue must be in the content generation key lookup.\n")
    else:
        print("[CONCLUSION] NO keys in database at all!\n")

if __name__ == '__main__':
    asyncio.run(test())









